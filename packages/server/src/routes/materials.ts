import { Router } from 'express';
import { prisma } from '../db/client.js';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { BadRequestError, NotFoundError } from '../middleware/error-handler.js';
import { logActivity, ActivityAction, EntityType } from '../lib/activity-logger.js';
import { broadcast } from '../ws/server.js';
import {
  CreateMaterialUsageSchema,
  UpdateMaterialUsageSchema,
  MaterialUsageFilterSchema,
} from '@erp/shared';
import { updateJobCost } from '../services/job-costing.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

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

  res.json({
    success: true,
    data: {
      items: materials,
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

  // Calculate total
  const totalCost = materials.reduce((sum, m) => sum + m.totalCost.toNumber(), 0);

  res.json({
    success: true,
    data: {
      items: materials,
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

  res.json({ success: true, data: material });
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

  await logActivity({
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
    userId: req.userId,
    req,
  });

  broadcast({ type: 'MATERIAL_RECORDED', payload: material });

  res.status(201).json({ success: true, data: material });
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
    },
  });

  // Update job cost
  await updateJobCost(existing.workOrderId);

  await logActivity({
    action: ActivityAction.UPDATE,
    entityType: EntityType.MATERIAL_USAGE,
    entityId: material.id,
    description: `Updated material usage for order ${existing.workOrder.orderNumber}`,
    details: data,
    userId: req.userId,
    req,
  });

  broadcast({ type: 'MATERIAL_UPDATED', payload: material });

  res.json({ success: true, data: material });
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

  await logActivity({
    action: ActivityAction.DELETE,
    entityType: EntityType.MATERIAL_USAGE,
    entityId: id,
    description: `Deleted material usage (${existing.itemMaster.name}) from order ${existing.workOrder.orderNumber}`,
    userId: req.userId,
    req,
  });

  broadcast({ type: 'MATERIAL_DELETED', payload: { id, workOrderId: existing.workOrderId } });

  res.json({ success: true, message: 'Material usage record deleted' });
});

// POST /materials/order/:workOrderId/from-bom - Add materials from BOM
router.post('/order/:workOrderId/from-bom', async (req: AuthRequest, res) => {
  const { workOrderId } = req.params;
  const { itemMasterId, multiplier = 1 } = req.body;

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
        },
      });
      materials.push(material);
    }
  }

  // Update job cost
  await updateJobCost(workOrderId);

  await logActivity({
    action: ActivityAction.RECORD_MATERIAL,
    entityType: EntityType.MATERIAL_USAGE,
    entityName: workOrder.orderNumber,
    description: `Added ${materials.length} materials from BOM for order ${workOrder.orderNumber}`,
    details: { bomCount: boms.length, multiplier },
    userId: req.userId,
    req,
  });

  broadcast({ type: 'MATERIALS_BULK_ADDED', payload: { workOrderId, count: materials.length } });

  res.status(201).json({ 
    success: true, 
    data: materials,
    message: `Added ${materials.length} materials from BOM`,
  });
});

export default router;
