import { Router } from 'express';
import { Carrier, ShipmentStatus } from '@prisma/client';
import { prisma } from '../db/client.js';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { BadRequestError } from '../middleware/error-handler.js';
import { logActivity, ActivityAction } from '../lib/activity-logger.js';
import { buildShipmentRouteActivityPayload } from '../lib/shipment-route-activity.js';
import { requireShipmentState } from '../lib/shipment-route-guards.js';
import { resolveFedExCarrier } from '../services/fedex-carrier.js';
import { reconcileShippedOrdersWithShipments } from '../services/shipment-linking.js';
import { applyShipmentTrackingNumber, normalizeTrackingNumber } from '../services/shipment-tracking.js';
import { resolveFedExStatusSummary, type FedExStatusSummary } from '../services/fedex-status-summary.js';
import { buildListOrderBy, normalizeListQuery } from '../lib/list-query.js';
import {
  scheduleFedExTrackingRefreshIfStale,
  syncFedExTrackingForShipment,
} from '../services/fedex-api.js';
import { broadcast } from '../ws/server.js';
import { buildRouteBroadcastPayload } from '../lib/route-broadcast.js';
import { buildTokenizedSearchWhere } from '../lib/fuzzy-search.js';
import {
  CreateShipmentSchema,
  UpdateShipmentSchema,
  ShipmentFilterSchema,
  MarkDeliveredSchema,
} from '@erp/shared';

const router = Router();

const fedExShipmentRecordSelect = {
  trackingNumber: true,
  importedAt: true,
  eventTimestamp: true,
  sourceFileDate: true,
  sourceFileName: true,
  service: true,
} as const;

const shipmentWorkOrderInclude = {
  id: true,
  orderNumber: true,
  customerName: true,
  status: true,
  customer: { select: { id: true, name: true } },
  shippingScans: {
    select: {
      trackingNumber: true,
      scannedAt: true,
    },
    orderBy: {
      scannedAt: 'desc',
    },
    take: 1,
  },
  fedExShipmentRecords: {
    select: fedExShipmentRecordSelect,
    orderBy: {
      importedAt: 'desc',
    },
    take: 1,
  },
} as const;

const shipmentTrackingInclude = {
  labelScans: {
    select: {
      trackingNumber: true,
      scannedAt: true,
    },
    orderBy: {
      scannedAt: 'desc',
    },
    take: 1,
  },
  workOrder: {
    select: shipmentWorkOrderInclude,
  },
  createdBy: { select: { id: true, displayName: true } },
  trackingEvents: {
    where: {
      sourceSystem: 'fedex_api',
    },
    select: {
      eventType: true,
      eventDate: true,
      eventTime: true,
      city: true,
      state: true,
      zip: true,
      country: true,
      description: true,
      sourceSystem: true,
      rawData: true,
      createdAt: true,
    },
    orderBy: {
      eventDate: 'desc',
    },
    take: 1,
  },
  packages: true,
} as const;

const shipmentDetailWorkOrderInclude = {
  ...shipmentWorkOrderInclude,
  description: true,
  customer: { select: { id: true, name: true, email: true, phone: true } },
  fedExShipmentRecords: {
    select: {
      ...fedExShipmentRecordSelect,
      rawData: true,
    },
    orderBy: {
      importedAt: 'desc',
    },
    take: 1,
  },
} as const;

const shipmentDetailInclude = {
  ...shipmentTrackingInclude,
  trackingEvents: {
    select: {
      id: true,
      eventType: true,
      eventDate: true,
      eventTime: true,
      city: true,
      state: true,
      zip: true,
      country: true,
      description: true,
      sourceSystem: true,
      rawData: true,
      createdAt: true,
    },
    orderBy: {
      eventDate: 'desc',
    },
    take: 25,
  },
  workOrder: {
    select: shipmentDetailWorkOrderInclude,
  },
} as const;

type ShipmentReadShape = {
  id: string;
  carrier: Carrier;
  status: ShipmentStatus;
  trackingEvents?: Array<{
    eventType: string;
    eventDate: Date | string;
    eventTime?: Date | string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    country?: string | null;
    description?: string | null;
    sourceSystem?: string | null;
    rawData?: unknown;
    createdAt?: Date | string | null;
  }>;
  workOrder?: {
    status?: string | null;
    fedExShipmentRecords?: Array<{
      trackingNumber: string | null;
      importedAt?: Date | string | null;
      eventTimestamp?: Date | string | null;
      sourceFileDate?: Date | string | null;
      sourceFileName?: string | null;
      service?: string | null;
      rawData?: unknown;
    }>;
  } | null;
};

export function resolveShipmentReadCorrections<T extends ShipmentReadShape>(
  shipment: T
): T & { carrier: Carrier; status: ShipmentStatus; fedExStatusSummary: FedExStatusSummary | null } {
  const fedExStatusSummary = resolveFedExStatusSummary(shipment);
  const hasLinkedFedExRecord = Boolean(shipment.workOrder?.fedExShipmentRecords?.length);

  const carrier = resolveFedExCarrier(shipment.carrier, hasLinkedFedExRecord);

  const fedExStatus = fedExStatusSummary?.status?.toUpperCase() ?? '';
  const status =
    fedExStatus.includes('DELIVERED')
      ? ShipmentStatus.DELIVERED
      : fedExStatus.includes('EXCEPTION')
        ? ShipmentStatus.EXCEPTION
        : fedExStatus.includes('IN TRANSIT') ||
            fedExStatus.includes('OUT FOR DELIVERY') ||
            fedExStatus.includes('PICKED UP') ||
            fedExStatus.includes('LABEL CREATED')
          ? ShipmentStatus.IN_TRANSIT
          : shipment.status === ShipmentStatus.PICKED_UP && shipment.workOrder?.status === 'SHIPPED'
            ? ShipmentStatus.IN_TRANSIT
            : shipment.status;

  return {
    ...shipment,
    carrier,
    status,
    fedExStatusSummary,
  };
}

function applyReadSideShipmentCorrections<T extends ShipmentReadShape>(
  shipments: T[]
): Array<T & { carrier: Carrier; status: ShipmentStatus; fedExStatusSummary: FedExStatusSummary | null }> {
  return shipments.map((shipment) => resolveShipmentReadCorrections(shipment));
}

// All routes require authentication
router.use(authenticate);

// GET /shipments - List all shipments with filtering
router.get('/', async (req: AuthRequest, res) => {
  await reconcileShippedOrdersWithShipments().catch((err) => {
    console.warn('Shipment reconciliation warning:', err);
  });

  const filters = ShipmentFilterSchema.parse(req.query);
  const { page: normalizedPage, pageSize: normalizedPageSize, search: normalizedSearch } =
    normalizeListQuery({
      page: filters.page,
      pageSize: filters.pageSize,
      search: filters.search,
      defaultPageSize: filters.pageSize,
      maxPageSize: 100,
    });
  const { status, carrier, workOrderId, fromDate, toDate, sortBy, sortOrder } = filters;

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

  if (normalizedSearch) {
    const searchWhere = buildTokenizedSearchWhere(normalizedSearch, [
      'trackingNumber',
      'workOrder.orderNumber',
      'workOrder.customerName',
      'workOrder.customer.name',
      'workOrder.customer.companyName',
    ]);
    if (searchWhere) {
      Object.assign(where, searchWhere);
    }
  }

  if (fromDate || toDate) {
    where.shipDate = {};
    if (fromDate) where.shipDate.gte = fromDate;
    if (toDate) where.shipDate.lte = toDate;
  }

  const [shipments, total] = await Promise.all([
    prisma.shipment.findMany({
      where,
      include: shipmentTrackingInclude,
      orderBy: buildListOrderBy(sortBy, sortOrder),
      skip: (normalizedPage - 1) * normalizedPageSize,
      take: normalizedPageSize,
    }),
    prisma.shipment.count({ where }),
  ]);
  const trackedShipments = shipments.map((shipment) => applyShipmentTrackingNumber(shipment));
  const correctedShipments = applyReadSideShipmentCorrections(trackedShipments);

  res.json({
    success: true,
    data: {
      items: correctedShipments,
      total,
      page: normalizedPage,
      pageSize: normalizedPageSize,
      totalPages: Math.ceil(total / normalizedPageSize),
    },
  });
});

// GET /shipments/:id - Get single shipment
router.get('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;

  const shipment = await prisma.shipment.findUnique({
    where: { id },
    include: {
      ...shipmentTrackingInclude,
      workOrder: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          description: true,
          customer: { select: { id: true, name: true, email: true, phone: true } },
          shippingScans: {
            select: {
              trackingNumber: true,
              scannedAt: true,
            },
            orderBy: {
              scannedAt: 'desc',
            },
            take: 1,
          },
          fedExShipmentRecords: {
            select: {
              trackingNumber: true,
              importedAt: true,
            },
            orderBy: {
              importedAt: 'desc',
            },
            take: 1,
          },
        },
      },
    },
  });

  const trackedSourceShipment = requireShipmentState(shipment);

  const trackedShipment = applyShipmentTrackingNumber(trackedSourceShipment);
  const [correctedShipment] = applyReadSideShipmentCorrections([trackedShipment]);

  void scheduleFedExTrackingRefreshIfStale(id).catch((error) => {
    console.warn(`FedEx background refresh check failed for shipment ${id}:`, error);
  });

  res.json({ success: true, data: correctedShipment ?? trackedShipment });
});

// POST /shipments/:id/refresh-status - Force a FedEx API refresh for this shipment
router.post('/:id/refresh-status', async (req: AuthRequest, res) => {
  const { id } = req.params;
  const force = req.body?.force === true;

  const result = await syncFedExTrackingForShipment(id, { force });
  if (result.status === 'synced') {
    broadcast(buildRouteBroadcastPayload({
      type: 'SHIPMENT_UPDATED',
      payload: {
        id: result.shipmentId,
        status: result.shipmentStatus,
        trackingNumber: result.trackingNumber,
        carrier: result.carrier,
        actualDelivery: result.actualDelivery,
      },
    }));
  }

  res.json({ success: true, data: result });
});

// GET /shipments/order/:workOrderId - Get shipments for a work order
router.get('/order/:workOrderId', async (req: AuthRequest, res) => {
  const { workOrderId } = req.params;

  const shipments = await prisma.shipment.findMany({
    where: { workOrderId },
    include: shipmentTrackingInclude,
    orderBy: { shipDate: 'desc' },
  });
  const trackedShipments = shipments.map((shipment) => applyShipmentTrackingNumber(shipment));
  const correctedShipments = applyReadSideShipmentCorrections(trackedShipments);

  res.json({ success: true, data: correctedShipments });
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

  await logActivity(
    buildShipmentRouteActivityPayload({
      action: ActivityAction.SHIP_ORDER,
      shipment,
      description: `Created shipment for order ${workOrder.orderNumber}`,
      details: {
        carrier: shipmentData.carrier,
        trackingNumber: shipmentData.trackingNumber,
      },
      req,
    }),
  );

  broadcast(buildRouteBroadcastPayload({ type: 'SHIPMENT_CREATED', payload: shipment }));

  res.status(201).json({ success: true, data: shipment });
});

// PUT /shipments/:id - Update shipment
router.put('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;
  const data = UpdateShipmentSchema.parse(req.body);

  const existing = requireShipmentState(await prisma.shipment.findUnique({ where: { id } }), {
    disallowedStatuses: ['DELIVERED'],
    badRequestMessage: 'Cannot update delivered shipment',
  });

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

  await logActivity(
    buildShipmentRouteActivityPayload({
      action: ActivityAction.UPDATE,
      shipment,
      description: `Updated shipment ${shipment.trackingNumber || shipment.id.slice(0, 8)}`,
      details: { changes: data },
      req,
    }),
  );

  broadcast(buildRouteBroadcastPayload({ type: 'SHIPMENT_UPDATED', payload: shipment }));

  res.json({ success: true, data: shipment });
});

// POST /shipments/:id/pickup - Mark as picked up
router.post('/:id/pickup', async (req: AuthRequest, res) => {
  const { id } = req.params;

  const existing = requireShipmentState(await prisma.shipment.findUnique({ where: { id } }), {
    allowedStatuses: ['PENDING'],
    badRequestMessage: 'Shipment has already been picked up',
  });

  const shipment = await prisma.shipment.update({
    where: { id },
    data: { status: 'PICKED_UP' },
    include: {
      workOrder: { select: { id: true, orderNumber: true } },
    },
  });

  broadcast(buildRouteBroadcastPayload({ type: 'SHIPMENT_UPDATED', payload: shipment }));

  res.json({ success: true, data: shipment });
});

// POST /shipments/:id/transit - Mark as in transit
router.post('/:id/transit', async (req: AuthRequest, res) => {
  const { id } = req.params;

  const existing = requireShipmentState(await prisma.shipment.findUnique({ where: { id } }), {
    allowedStatuses: ['PENDING', 'PICKED_UP'],
    badRequestMessage: 'Invalid status transition',
  });

  const shipment = await prisma.shipment.update({
    where: { id },
    data: { status: 'IN_TRANSIT' },
    include: {
      workOrder: { select: { id: true, orderNumber: true } },
    },
  });

  broadcast(buildRouteBroadcastPayload({ type: 'SHIPMENT_UPDATED', payload: shipment }));

  res.json({ success: true, data: shipment });
});

// POST /shipments/:id/deliver - Mark as delivered
router.post('/:id/deliver', async (req: AuthRequest, res) => {
  const { id } = req.params;
  const data = MarkDeliveredSchema.parse(req.body);

  const existing = requireShipmentState(await prisma.shipment.findUnique({
    where: { id },
    include: { workOrder: true },
  }), {
    disallowedStatuses: ['DELIVERED'],
    badRequestMessage: 'Shipment already delivered',
  });

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

  await logActivity(
    buildShipmentRouteActivityPayload({
      action: ActivityAction.MARK_DELIVERED,
      shipment,
      description: `Marked shipment as delivered`,
      req,
    }),
  );

  broadcast(buildRouteBroadcastPayload({ type: 'SHIPMENT_UPDATED', payload: shipment }));

  res.json({ success: true, data: shipment });
});

// POST /shipments/:id/exception - Mark as exception (problem)
router.post('/:id/exception', async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { notes } = req.body;

  const existing = requireShipmentState(await prisma.shipment.findUnique({ where: { id } }), {
    disallowedStatuses: ['DELIVERED'],
    badRequestMessage: 'Cannot mark delivered shipment as exception',
  });

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

  await logActivity(
    buildShipmentRouteActivityPayload({
      action: ActivityAction.UPDATE,
      shipment,
      description: `Marked shipment as exception`,
      details: { notes },
      req,
    }),
  );

  broadcast(buildRouteBroadcastPayload({ type: 'SHIPMENT_UPDATED', payload: shipment }));

  res.json({ success: true, data: shipment });
});

// DELETE /shipments/:id - Delete shipment (only pending)
router.delete('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;

  const existing = requireShipmentState(await prisma.shipment.findUnique({ where: { id } }), {
    allowedStatuses: ['PENDING'],
    badRequestMessage: 'Can only delete pending shipments',
  });

  await prisma.shipment.delete({ where: { id } });

  await logActivity(
    buildShipmentRouteActivityPayload({
      action: ActivityAction.DELETE,
      shipment: existing,
      description: `Deleted shipment`,
      req,
    }),
  );

  broadcast(buildRouteBroadcastPayload({ type: 'SHIPMENT_DELETED', payload: { id } }));

  res.json({ success: true, message: 'Shipment deleted' });
});

export default router;
