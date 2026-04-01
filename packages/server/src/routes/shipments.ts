import { Router } from 'express';
import { prisma } from '../db/client.js';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { BadRequestError, NotFoundError } from '../middleware/error-handler.js';
import { logActivity, ActivityAction, EntityType } from '../lib/activity-logger.js';
import { reconcileShippedOrdersWithShipments } from '../services/shipment-linking.js';
import { broadcast } from '../ws/server.js';
import {
  CreateShipmentSchema,
  UpdateShipmentSchema,
  ShipmentFilterSchema,
  MarkDeliveredSchema,
} from '@erp/shared';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /shipments - List all shipments with filtering
router.get('/', async (req: AuthRequest, res) => {
  await reconcileShippedOrdersWithShipments().catch((err) => {
    console.warn('Shipment reconciliation warning:', err);
  });

  const filters = ShipmentFilterSchema.parse(req.query);
  const { page, pageSize, status, carrier, workOrderId, search, fromDate, toDate, sortBy, sortOrder } = filters;

  const where: any = {};

  if (status) {
    where.status = status;
  }

  if (carrier) {
    where.carrier = carrier;
  }

  if (workOrderId) {
    where.workOrderId = workOrderId;
  }

  if (search) {
    where.OR = [
      { trackingNumber: { contains: search, mode: 'insensitive' } },
      { workOrder: { orderNumber: { contains: search, mode: 'insensitive' } } },
      { workOrder: { customerName: { contains: search, mode: 'insensitive' } } },
      { workOrder: { customer: { name: { contains: search, mode: 'insensitive' } } } },
      { workOrder: { customer: { companyName: { contains: search, mode: 'insensitive' } } } },
    ];
  }

  if (fromDate || toDate) {
    where.shipDate = {};
    if (fromDate) where.shipDate.gte = fromDate;
    if (toDate) where.shipDate.lte = toDate;
  }

  const [shipments, total] = await Promise.all([
    prisma.shipment.findMany({
      where,
      include: {
        workOrder: {
          select: {
            id: true,
            orderNumber: true,
            customerName: true,
            customer: { select: { id: true, name: true } },
          },
        },
        createdBy: { select: { id: true, displayName: true } },
        packages: true,
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.shipment.count({ where }),
  ]);

  res.json({
    success: true,
    data: {
      items: shipments,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  });
});

// GET /shipments/:id - Get single shipment
router.get('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;

  const shipment = await prisma.shipment.findUnique({
    where: { id },
    include: {
      workOrder: {
        select: {
          id: true,
          orderNumber: true,
          description: true,
          customer: { select: { id: true, name: true, email: true, phone: true } },
        },
      },
      createdBy: { select: { id: true, displayName: true } },
      packages: true,
    },
  });

  if (!shipment) {
    throw NotFoundError('Shipment not found');
  }

  res.json({ success: true, data: shipment });
});

// GET /shipments/order/:workOrderId - Get shipments for a work order
router.get('/order/:workOrderId', async (req: AuthRequest, res) => {
  const { workOrderId } = req.params;

  const shipments = await prisma.shipment.findMany({
    where: { workOrderId },
    include: {
      createdBy: { select: { id: true, displayName: true } },
      packages: true,
    },
    orderBy: { shipDate: 'desc' },
  });

  res.json({ success: true, data: shipments });
});

// POST /shipments - Create new shipment
router.post('/', async (req: AuthRequest, res) => {
  const data = CreateShipmentSchema.parse(req.body);
  const { packages, ...shipmentData } = data;

  // Verify work order exists
  const workOrder = await prisma.workOrder.findUnique({
    where: { id: shipmentData.workOrderId },
    include: { customer: true },
  });

  if (!workOrder) {
    throw BadRequestError('Work order not found');
  }

  const shipment = await prisma.shipment.create({
    data: {
      workOrderId: shipmentData.workOrderId,
      carrier: shipmentData.carrier,
      trackingNumber: shipmentData.trackingNumber,
      shipDate: shipmentData.shipDate || new Date(),
      estimatedDelivery: shipmentData.estimatedDelivery,
      shippingCost: shipmentData.shippingCost || 0,
      notes: shipmentData.notes,
      createdById: req.userId!,
      packages: packages && packages.length > 0 ? {
        create: packages.map((pkg) => ({
          weight: pkg.weight,
          dimensions: pkg.dimensions,
          description: pkg.description,
        })),
      } : undefined,
    },
    include: {
      workOrder: {
        select: {
          id: true,
          orderNumber: true,
          customer: { select: { id: true, name: true } },
        },
      },
      createdBy: { select: { id: true, displayName: true } },
      packages: true,
    },
  });

  await logActivity({
    action: ActivityAction.SHIP_ORDER,
    entityType: EntityType.SHIPMENT,
    entityId: shipment.id,
    entityName: shipment.trackingNumber || shipment.id.slice(0, 8),
    description: `Created shipment for order ${workOrder.orderNumber}`,
    details: {
      carrier: shipmentData.carrier,
      trackingNumber: shipmentData.trackingNumber,
    },
    userId: req.userId,
    req,
  });

  broadcast({ type: 'SHIPMENT_CREATED', payload: shipment });

  res.status(201).json({ success: true, data: shipment });
});

// PUT /shipments/:id - Update shipment
router.put('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;
  const data = UpdateShipmentSchema.parse(req.body);

  const existing = await prisma.shipment.findUnique({ where: { id } });

  if (!existing) {
    throw NotFoundError('Shipment not found');
  }

  if (existing.status === 'DELIVERED') {
    throw BadRequestError('Cannot update delivered shipment');
  }

  const shipment = await prisma.shipment.update({
    where: { id },
    data,
    include: {
      workOrder: {
        select: {
          id: true,
          orderNumber: true,
          customer: { select: { id: true, name: true } },
        },
      },
      packages: true,
    },
  });

  await logActivity({
    action: ActivityAction.UPDATE,
    entityType: EntityType.SHIPMENT,
    entityId: shipment.id,
    entityName: shipment.trackingNumber || shipment.id.slice(0, 8),
    description: `Updated shipment ${shipment.trackingNumber || shipment.id.slice(0, 8)}`,
    details: { changes: data },
    userId: req.userId,
    req,
  });

  broadcast({ type: 'SHIPMENT_UPDATED', payload: shipment });

  res.json({ success: true, data: shipment });
});

// POST /shipments/:id/pickup - Mark as picked up
router.post('/:id/pickup', async (req: AuthRequest, res) => {
  const { id } = req.params;

  const existing = await prisma.shipment.findUnique({ where: { id } });

  if (!existing) {
    throw NotFoundError('Shipment not found');
  }

  if (existing.status !== 'PENDING') {
    throw BadRequestError('Shipment has already been picked up');
  }

  const shipment = await prisma.shipment.update({
    where: { id },
    data: { status: 'PICKED_UP' },
    include: {
      workOrder: { select: { id: true, orderNumber: true } },
    },
  });

  broadcast({ type: 'SHIPMENT_UPDATED', payload: shipment });

  res.json({ success: true, data: shipment });
});

// POST /shipments/:id/transit - Mark as in transit
router.post('/:id/transit', async (req: AuthRequest, res) => {
  const { id } = req.params;

  const existing = await prisma.shipment.findUnique({ where: { id } });

  if (!existing) {
    throw NotFoundError('Shipment not found');
  }

  if (!['PENDING', 'PICKED_UP'].includes(existing.status)) {
    throw BadRequestError('Invalid status transition');
  }

  const shipment = await prisma.shipment.update({
    where: { id },
    data: { status: 'IN_TRANSIT' },
    include: {
      workOrder: { select: { id: true, orderNumber: true } },
    },
  });

  broadcast({ type: 'SHIPMENT_UPDATED', payload: shipment });

  res.json({ success: true, data: shipment });
});

// POST /shipments/:id/deliver - Mark as delivered
router.post('/:id/deliver', async (req: AuthRequest, res) => {
  const { id } = req.params;
  const data = MarkDeliveredSchema.parse(req.body);

  const existing = await prisma.shipment.findUnique({
    where: { id },
    include: { workOrder: true },
  });

  if (!existing) {
    throw NotFoundError('Shipment not found');
  }

  if (existing.status === 'DELIVERED') {
    throw BadRequestError('Shipment already delivered');
  }

  const shipment = await prisma.shipment.update({
    where: { id },
    data: {
      status: 'DELIVERED',
      actualDelivery: new Date(),
      signedBy: data.signedBy,
      proofOfDelivery: data.proofOfDelivery,
      notes: data.notes ? `${existing.notes ? existing.notes + '\n' : ''}Delivery: ${data.notes}` : existing.notes,
    },
    include: {
      workOrder: { select: { id: true, orderNumber: true } },
    },
  });

  await logActivity({
    action: ActivityAction.MARK_DELIVERED,
    entityType: EntityType.SHIPMENT,
    entityId: shipment.id,
    entityName: shipment.trackingNumber || shipment.id.slice(0, 8),
    description: `Marked shipment as delivered`,
    userId: req.userId,
    req,
  });

  broadcast({ type: 'SHIPMENT_UPDATED', payload: shipment });

  res.json({ success: true, data: shipment });
});

// POST /shipments/:id/exception - Mark as exception (problem)
router.post('/:id/exception', async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { notes } = req.body;

  const existing = await prisma.shipment.findUnique({ where: { id } });

  if (!existing) {
    throw NotFoundError('Shipment not found');
  }

  if (existing.status === 'DELIVERED') {
    throw BadRequestError('Cannot mark delivered shipment as exception');
  }

  const shipment = await prisma.shipment.update({
    where: { id },
    data: {
      status: 'EXCEPTION',
      notes: notes ? `${existing.notes ? existing.notes + '\n' : ''}Exception: ${notes}` : existing.notes,
    },
    include: {
      workOrder: { select: { id: true, orderNumber: true } },
    },
  });

  await logActivity({
    action: ActivityAction.UPDATE,
    entityType: EntityType.SHIPMENT,
    entityId: shipment.id,
    entityName: shipment.trackingNumber || shipment.id.slice(0, 8),
    description: `Marked shipment as exception`,
    details: { notes },
    userId: req.userId,
    req,
  });

  broadcast({ type: 'SHIPMENT_UPDATED', payload: shipment });

  res.json({ success: true, data: shipment });
});

// DELETE /shipments/:id - Delete shipment (only pending)
router.delete('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;

  const existing = await prisma.shipment.findUnique({ where: { id } });

  if (!existing) {
    throw NotFoundError('Shipment not found');
  }

  if (existing.status !== 'PENDING') {
    throw BadRequestError('Can only delete pending shipments');
  }

  await prisma.shipment.delete({ where: { id } });

  await logActivity({
    action: ActivityAction.DELETE,
    entityType: EntityType.SHIPMENT,
    entityId: id,
    entityName: existing.trackingNumber || id.slice(0, 8),
    description: `Deleted shipment`,
    userId: req.userId,
    req,
  });

  broadcast({ type: 'SHIPMENT_DELETED', payload: { id } });

  res.json({ success: true, message: 'Shipment deleted' });
});

export default router;
