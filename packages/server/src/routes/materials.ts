import { Router } from 'express';
import { prisma } from '../db/client.js';
import { Decimal } from '@prisma/client/runtime/library';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { BadRequestError, NotFoundError } from '../middleware/error-handler.js';
import { logActivity, ActivityAction, EntityType } from '../lib/activity-logger.js';
import { buildRouteActivityPayload } from '../lib/route-activity.js';
import { broadcast } from '../ws/server.js';
import { buildRouteBroadcastPayload } from '../lib/route-broadcast.js';
import {
  CreateMaterialUsageSchema,
  UpdateMaterialUsageSchema,
  MaterialUsageFilterSchema,
} from '@erp/shared';
import { updateJobCost } from '../services/job-costing.js';
import {
  createBOMFromSuggestions,
  generateBOMSuggestions,
  type MaterialEstimate,
} from '../services/bom-automation.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

type MaterialUsageResponse = {
  id: string;
  workOrderId: string;
  itemMasterId: string;
  quantity: { toNumber(): number };
  unit: string;
  unitCost: { toNumber(): number };
  totalCost: { toNumber(): number };
  usedAt: Date;
  recordedById: string;
  notes: string | null;
  itemMaster?: {
    id: string;
    sku: string;
    name: string;
    costPrice?: { toNumber(): number } | null;
  } | null;
  recordedBy?: {
    id: string;
    displayName: string;
  } | null;
  workOrder?: {
    id: string;
    orderNumber: string;
    customerName: string;
  } | null;
};

function serializeMaterialUsage(material: MaterialUsageResponse) {
  return {
    ...material,
    description: material.itemMaster?.name ?? material.notes ?? 'Material',
    quantity: material.quantity.toNumber(),
    unitCost: material.unitCost.toNumber(),
    totalCost: material.totalCost.toNumber(),
    usedAt: material.usedAt.toISOString(),
  };
}

function serializeMaterialEstimate(material: MaterialEstimate) {
  return {
    ...material,
    quantity: material.quantity.toNumber(),
    unitCost: material.unitCost.toNumber(),
    totalCost: material.totalCost.toNumber(),
  };
}

// GET /materials - List all material usage records with filtering
router.get('/', async (req: AuthRequest, res) => {
  const filters = MaterialUsageFilterSchema.parse(req.query);
  const { page, pageSize, workOrderId, itemMasterId, fromDate, toDate, sortBy, sortOrder } = filters;

  const where: any = {};

  if (workOrderId) {
    where.workOrderId = workOrderId;
  }

  if (itemMasterId) {
    where.itemMasterId = itemMasterId;
  }

  if (fromDate || toDate) {
    where.usedAt = {};
    if (fromDate) where.usedAt.gte = fromDate;
    if (toDate) where.usedAt.lte = toDate;
  }

  const [materials, total] = await Promise.all([
    prisma.materialUsage.findMany({
      where,
      include: {
        workOrder: {
          select: {
            id: true,
            orderNumber: true,
            customerName: true,
          },
        },
        itemMaster: {
          select: {
            id: true,
            sku: true,
            name: true,
            costPrice: true,
          },
        },
        recordedBy: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.materialUsage.count({ where }),
  ]);

  const serializedMaterials = materials.map((material) =>
    serializeMaterialUsage(material as unknown as MaterialUsageResponse),
  );

  res.json({
    success: true,
    data: {
      items: serializedMaterials,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  });
});

// GET /materials/order/:workOrderId - Get material usage for a specific order
router.get('/order/:workOrderId', async (req: AuthRequest, res) => {
  const { workOrderId } = req.params;

  const materials = await prisma.materialUsage.findMany({
    where: { workOrderId },
    include: {
      itemMaster: {
        select: {
          id: true,
          sku: true,
          name: true,
          costPrice: true,
        },
      },
      recordedBy: {
        select: {
          id: true,
          displayName: true,
        },
      },
    },
    orderBy: { usedAt: 'desc' },
  });

  const serializedMaterials = materials.map((material) =>
    serializeMaterialUsage(material as unknown as MaterialUsageResponse),
  );
  const totalCost = serializedMaterials.reduce((sum, material) => sum + material.totalCost, 0);

  res.json({
    success: true,
    data: {
      items: serializedMaterials,
      totalCost,
    },
  });
});

// GET /materials/:id - Get single material usage record
router.get('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;

  const material = await prisma.materialUsage.findUnique({
    where: { id },
    include: {
      workOrder: {
        select: {
          id: true,
          orderNumber: true,
          customerName: true,
        },
      },
      itemMaster: {
        select: {
          id: true,
          sku: true,
          name: true,
          costPrice: true,
        },
      },
      recordedBy: {
        select: {
          id: true,
          displayName: true,
        },
      },
    },
  });

  if (!material) {
    throw NotFoundError('Material usage record not found');
  }

  res.json({
    success: true,
    data: serializeMaterialUsage(material as unknown as MaterialUsageResponse),
  });
});

// GET /materials/order/:workOrderId/bom-suggestions - Generate suggested materials for an order
router.get('/order/:workOrderId/bom-suggestions', async (req: AuthRequest, res) => {
  const { workOrderId } = req.params;
  const suggestion = await generateBOMSuggestions(workOrderId);

  if (!suggestion) {
    throw NotFoundError('Work order not found');
  }

  res.json({
    success: true,
    data: {
      ...suggestion,
      materials: suggestion.materials.map(serializeMaterialEstimate),
      totalEstimatedCost: suggestion.totalEstimatedCost.toNumber(),
    },
  });
});

// POST /materials - Record new material usage
router.post('/', async (req: AuthRequest, res) => {
  const data = CreateMaterialUsageSchema.parse(req.body);

  // Verify work order exists
  const workOrder = await prisma.workOrder.findUnique({
    where: { id: data.workOrderId },
    select: { id: true, orderNumber: true },
  });

  if (!workOrder) {
    throw BadRequestError('Work order not found');
  }

  // Verify item exists and get cost if not provided
  const item = await prisma.itemMaster.findUnique({
    where: { id: data.itemMasterId },
    select: { id: true, sku: true, name: true, costPrice: true },
  });

  if (!item) {
    throw BadRequestError('Item not found');
  }

  // Use provided unit cost or fall back to item's cost price
  const unitCost = data.unitCost ?? item.costPrice?.toNumber() ?? 0;
  const totalCost = data.quantity * unitCost;

  const material = await prisma.materialUsage.create({
    data: {
      workOrderId: data.workOrderId,
      itemMasterId: data.itemMasterId,
      quantity: data.quantity,
      unit: data.unit,
      unitCost,
      totalCost,
      notes: data.notes,
      recordedById: req.userId!,
    },
    include: {
      itemMaster: {
        select: {
          id: true,
          sku: true,
          name: true,
        },
      },
      recordedBy: {
        select: {
          id: true,
          displayName: true,
        },
      },
    },
  });

  // Update job cost
  await updateJobCost(data.workOrderId);

  await logActivity(
    buildRouteActivityPayload({
      action: ActivityAction.RECORD_MATERIAL,
      entityType: EntityType.MATERIAL_USAGE,
      entityId: material.id,
      entityName: `${item.sku} - ${item.name}`,
      description: `Recorded ${data.quantity} ${data.unit} of ${item.name} for order ${workOrder.orderNumber}`,
      details: {
        quantity: data.quantity,
        unit: data.unit,
        totalCost,
      },
      userId: req.user!.id,
      req,
    }),
  );

  const serializedMaterial = serializeMaterialUsage(material as unknown as MaterialUsageResponse);

  broadcast(buildRouteBroadcastPayload({ type: 'MATERIAL_RECORDED', payload: serializedMaterial }));

  res.status(201).json({ success: true, data: serializedMaterial });
});

// PUT /materials/:id - Update material usage record
router.put('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;
  const data = UpdateMaterialUsageSchema.parse(req.body);

  const existing = await prisma.materialUsage.findUnique({
    where: { id },
    include: { workOrder: { select: { orderNumber: true } } },
  });

  if (!existing) {
    throw NotFoundError('Material usage record not found');
  }

  // Recalculate total cost if quantity or unit cost changed
  const quantity = data.quantity ?? existing.quantity.toNumber();
  const unitCost = data.unitCost ?? existing.unitCost.toNumber();
  const totalCost = quantity * unitCost;

  const material = await prisma.materialUsage.update({
    where: { id },
    data: {
      quantity: data.quantity,
      unit: data.unit,
      unitCost: data.unitCost,
      totalCost,
      notes: data.notes,
    },
    include: {
      itemMaster: {
        select: {
          id: true,
          sku: true,
          name: true,
        },
      },
      recordedBy: {
        select: {
          id: true,
          displayName: true,
        },
      },
    },
  });

  // Update job cost
  await updateJobCost(existing.workOrderId);

  await logActivity(
    buildRouteActivityPayload({
      action: ActivityAction.UPDATE,
      entityType: EntityType.MATERIAL_USAGE,
      entityId: material.id,
      entityName: material.itemMaster?.name ?? existing.workOrder.orderNumber,
      description: `Updated material usage for order ${existing.workOrder.orderNumber}`,
      details: data,
      userId: req.user!.id,
      req,
    }),
  );

  const serializedMaterial = serializeMaterialUsage(material as unknown as MaterialUsageResponse);

  broadcast(buildRouteBroadcastPayload({ type: 'MATERIAL_UPDATED', payload: serializedMaterial }));

  res.json({ success: true, data: serializedMaterial });
});

// DELETE /materials/:id - Delete material usage record
router.delete('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;

  const existing = await prisma.materialUsage.findUnique({
    where: { id },
    include: {
      workOrder: { select: { id: true, orderNumber: true } },
      itemMaster: { select: { name: true } },
    },
  });

  if (!existing) {
    throw NotFoundError('Material usage record not found');
  }

  await prisma.materialUsage.delete({ where: { id } });

  // Update job cost
  await updateJobCost(existing.workOrderId);

  await logActivity(
    buildRouteActivityPayload({
      action: ActivityAction.DELETE,
      entityType: EntityType.MATERIAL_USAGE,
      entityId: id,
      entityName: existing.itemMaster.name,
      description: `Deleted material usage (${existing.itemMaster.name}) from order ${existing.workOrder.orderNumber}`,
      userId: req.user!.id,
      req,
    }),
  );

  broadcast(buildRouteBroadcastPayload({ type: 'MATERIAL_DELETED', payload: { id, workOrderId: existing.workOrderId } }));

  res.json({ success: true, message: 'Material usage record deleted' });
});

// POST /materials/order/:workOrderId/from-bom - Add materials from BOM
router.post('/order/:workOrderId/from-bom', async (req: AuthRequest, res) => {
  const { workOrderId } = req.params;
  const body = (req.body ?? {}) as { itemMasterId?: string; multiplier?: number | string };
  const itemMasterId =
    typeof body.itemMasterId === 'string' && body.itemMasterId.trim().length > 0
      ? body.itemMasterId
      : undefined;
  const parsedMultiplier = Number(body.multiplier);
  const multiplier = Number.isFinite(parsedMultiplier) && parsedMultiplier > 0 ? parsedMultiplier : 1;

  // Verify work order exists and get line items
  const workOrder = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    select: { 
      id: true, 
      orderNumber: true,
      lineItems: {
        select: {
          itemMasterId: true,
          quantity: true,
        },
      },
    },
  });

  if (!workOrder) {
    throw BadRequestError('Work order not found');
  }

  // Collect all BOMs to process
  let bomsToProcess: { itemMasterId: string; quantity: number }[] = [];

  if (itemMasterId) {
    // Specific item requested
    bomsToProcess = [{ itemMasterId, quantity: multiplier }];
  } else {
    // Auto-detect: find all line items that have itemMasterIds and check if they have BOMs
    const lineItemsWithItems = workOrder.lineItems.filter(li => li.itemMasterId);
    
    if (lineItemsWithItems.length === 0) {
      // No line items have item masters linked, return success with 0 count
      return res.status(200).json({ 
        success: true, 
        data: [],
        count: 0,
        message: 'No line items have linked item masters with BOMs',
      });
    }
    
    bomsToProcess = lineItemsWithItems.map(li => ({
      itemMasterId: li.itemMasterId!,
      quantity: li.quantity,
    }));
  }

  // Get BOMs for all items
  const boms = await prisma.billOfMaterials.findMany({
    where: { 
      itemMasterId: { in: bomsToProcess.map(b => b.itemMasterId) },
      isActive: true,
    },
    include: {
      components: {
        include: {
          component: {
            select: {
              id: true,
              sku: true,
              name: true,
              costPrice: true,
            },
          },
        },
      },
    },
  });

  if (boms.length === 0) {
    // No BOMs found - return success with 0 count instead of error
    return res.status(200).json({ 
      success: true, 
      data: [],
      count: 0,
      message: 'No Bill of Materials found for order items',
    });
  }

  // Create material usage records for each component from each BOM
  const materials = [];
  for (const bom of boms) {
    const bomConfig = bomsToProcess.find(b => b.itemMasterId === bom.itemMasterId);
    const qty = bomConfig?.quantity ?? 1;
    
    for (const comp of bom.components) {
      const baseQuantity = comp.quantity.toNumber() * qty;
      const wasteMultiplier = 1 + (comp.wastePercent?.toNumber() ?? 0) / 100;
      const quantity = baseQuantity * wasteMultiplier;
      const unitCost = comp.component.costPrice?.toNumber() ?? 0;

      const material = await prisma.materialUsage.create({
        data: {
          workOrderId,
          itemMasterId: comp.componentId,
          quantity,
          unit: comp.unit,
          unitCost,
          totalCost: quantity * unitCost,
          notes: `From BOM: ${bom.itemMasterId}`,
          recordedById: req.userId!,
        },
        include: {
          itemMaster: {
            select: {
              id: true,
              sku: true,
              name: true,
            },
          },
          recordedBy: {
            select: {
              id: true,
              displayName: true,
            },
          },
        },
      });
      materials.push(material);
    }
  }

  const serializedMaterials = materials.map((material) =>
    serializeMaterialUsage(material as unknown as MaterialUsageResponse),
  );

  // Update job cost
  await updateJobCost(workOrderId);

  await logActivity(
    buildRouteActivityPayload({
      action: ActivityAction.RECORD_MATERIAL,
      entityType: EntityType.MATERIAL_USAGE,
      entityId: workOrderId,
      entityName: workOrder.orderNumber,
      description: `Added ${serializedMaterials.length} materials from BOM for order ${workOrder.orderNumber}`,
      details: { bomCount: boms.length, multiplier },
      userId: req.user!.id,
      req,
    }),
  );

  broadcast(buildRouteBroadcastPayload({ type: 'MATERIALS_BULK_ADDED', payload: { workOrderId, count: serializedMaterials.length } }));

  res.status(201).json({ 
    success: true, 
    data: serializedMaterials,
    count: serializedMaterials.length,
    message: `Added ${serializedMaterials.length} materials from BOM`,
  });
});

// POST /materials/order/:workOrderId/apply-bom-suggestions - Apply suggested materials as usage records
router.post('/order/:workOrderId/apply-bom-suggestions', async (req: AuthRequest, res) => {
  const { workOrderId } = req.params;
  const materials = Array.isArray(req.body?.materials) ? req.body.materials : [];

  if (materials.length === 0) {
    throw BadRequestError('At least one suggested material is required');
  }

  const workOrder = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    select: { id: true, orderNumber: true },
  });

  if (!workOrder) {
    throw NotFoundError('Work order not found');
  }

  const normalizedMaterials: MaterialEstimate[] = materials.map((material: any) => {
    if (!material?.itemMasterId || !material?.itemName || !material?.itemSku || !material?.unit || !material?.source) {
      throw BadRequestError('Each suggested material must include itemMasterId, itemName, itemSku, unit, and source');
    }

    const quantity = Number(material.quantity);
    const unitCost = Number(material.unitCost);
    const totalCost = Number(material.totalCost);
    const wastePercent = Number(material.wastePercent ?? 0);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw BadRequestError('Suggested material quantity must be greater than zero');
    }

    if (!Number.isFinite(unitCost) || unitCost < 0 || !Number.isFinite(totalCost) || totalCost < 0) {
      throw BadRequestError('Suggested material costs must be valid numbers');
    }

    if (!Number.isFinite(wastePercent) || wastePercent < 0) {
      throw BadRequestError('Suggested material wastePercent must be a valid number');
    }

    return {
      itemMasterId: String(material.itemMasterId),
      itemName: String(material.itemName),
      itemSku: String(material.itemSku),
      quantity: new Decimal(quantity),
      unit: String(material.unit),
      unitCost: new Decimal(unitCost),
      totalCost: new Decimal(totalCost),
      wastePercent,
      source: material.source === 'template' || material.source === 'print_analysis' || material.source === 'manual'
        ? material.source
        : 'manual',
    };
  });

  await createBOMFromSuggestions(workOrderId, normalizedMaterials, req.userId!);
  await updateJobCost(workOrderId);

  await logActivity(
    buildRouteActivityPayload({
      action: ActivityAction.RECORD_MATERIAL,
      entityType: EntityType.MATERIAL_USAGE,
      entityId: workOrderId,
      entityName: workOrder.orderNumber,
      description: `Applied ${normalizedMaterials.length} BOM suggestions to order ${workOrder.orderNumber}`,
      details: { count: normalizedMaterials.length },
      userId: req.user!.id,
      req,
    }),
  );

  broadcast(buildRouteBroadcastPayload({ type: 'MATERIALS_BULK_ADDED', payload: { workOrderId, count: normalizedMaterials.length } }));

  res.status(201).json({
    success: true,
    count: normalizedMaterials.length,
    message: `Applied ${normalizedMaterials.length} suggested materials`,
  });
});

export default router;
