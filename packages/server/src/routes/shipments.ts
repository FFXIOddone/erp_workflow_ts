import { Router } from 'express';
import { Carrier, ShipmentStatus } from '@prisma/client';
import { prisma } from '../db/client.js';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { BadRequestError, NotFoundError } from '../middleware/error-handler.js';
import { logActivity, ActivityAction, EntityType } from '../lib/activity-logger.js';
import { reconcileShippedOrdersWithShipments } from '../services/shipment-linking.js';
import { applyShipmentTrackingNumber } from '../services/shipment-tracking.js';
import {
  scheduleFedExTrackingRefreshIfStale,
  syncFedExTrackingForShipment,
} from '../services/fedex-api.js';
import { broadcast } from '../ws/server.js';
import { buildTokenizedSearchWhere } from '../lib/fuzzy-search.js';
import {
  CreateShipmentSchema,
  UpdateShipmentSchema,
  ShipmentFilterSchema,
  MarkDeliveredSchema,
  SHIPMENT_STATUS_DISPLAY_NAMES,
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

type FedExStatusSummary = {
  status: string | null;
  eventType: string | null;
  description: string | null;
  eventTimestamp: string | null;
  sourceFileName: string | null;
  sourceFileDate: string | null;
  location: string | null;
  trackingNumber: string | null;
  stale: boolean | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function pickString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }

  return null;
}

function pickDateIso(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (!value) {
      continue;
    }

    const date = value instanceof Date ? value : new Date(String(value));
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  return null;
}

function formatFedExStatusLabel(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  const enumName = normalized.toUpperCase().replace(/[\s-]+/g, '_');
  if (enumName in ShipmentStatus) {
    const enumValue = ShipmentStatus[enumName as keyof typeof ShipmentStatus];
    return SHIPMENT_STATUS_DISPLAY_NAMES[enumValue] ?? normalized;
  }

  return normalized
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function resolveFedExStatusSummary(shipment: ShipmentReadShape): FedExStatusSummary | null {
  const latestFedExApiEvent = shipment.trackingEvents?.find(
    (event) => event.sourceSystem?.toLowerCase() === 'fedex_api'
  );

  if (latestFedExApiEvent) {
    const eventRawData = asRecord(latestFedExApiEvent.rawData);
    const fetchedAtIso =
      pickDateIso(eventRawData, ['fetchedAt']) ??
      (latestFedExApiEvent.createdAt
        ? new Date(latestFedExApiEvent.createdAt).toISOString()
        : null);
    const eventDateIso = new Date(latestFedExApiEvent.eventDate).toISOString();
    const staleThresholdMs = 24 * 60 * 60 * 1000;
    const staleFromDate = fetchedAtIso ? new Date(fetchedAtIso) : new Date(eventDateIso);
    const isStale = Number.isNaN(staleFromDate.getTime())
      ? null
      : Date.now() - staleFromDate.getTime() > staleThresholdMs;

    return {
      status: formatFedExStatusLabel(
        pickString(eventRawData, ['derivedStatus', 'status']) ?? latestFedExApiEvent.eventType
      ),
      eventType: formatFedExStatusLabel(latestFedExApiEvent.eventType ?? null),
      description: latestFedExApiEvent.description ?? null,
      eventTimestamp: eventDateIso,
      sourceFileName: 'fedex_api',
      sourceFileDate: fetchedAtIso,
      location:
        [latestFedExApiEvent.city, latestFedExApiEvent.state]
          .filter((value): value is string => Boolean(value))
          .join(', ') || null,
      trackingNumber:
        pickString(eventRawData, ['trackingNumber']) ??
        shipment.workOrder?.fedExShipmentRecords?.[0]?.trackingNumber ??
        null,
      stale: isStale,
    };
  }

  const latestRecord = shipment.workOrder?.fedExShipmentRecords?.[0];
  if (!latestRecord) {
    return null;
  }

  const rawRecord = asRecord(latestRecord.rawData);
  const rawRow = asRecord(rawRecord.row);
  const status = formatFedExStatusLabel(
    pickString(rawRow, [
      'status',
      'shipment status',
      'current status',
      'tracking status',
      'delivery status',
      'package status',
      'shipmentStatus',
    ]) ??
      pickString(rawRecord, ['status', 'shipmentStatus', 'trackingStatus', 'deliveryStatus']) ??
      null
  );

  const eventTimestamp =
    pickDateIso(rawRow, [
      'eventTimestamp',
      'status updated at',
      'status date',
      'last scan date',
      'scan date',
      'delivery date',
    ]) ??
    pickDateIso(rawRecord, ['eventTimestamp', 'statusUpdatedAt', 'statusDate', 'lastScanAt']) ??
    (latestRecord.eventTimestamp instanceof Date
      ? latestRecord.eventTimestamp.toISOString()
      : latestRecord.eventTimestamp
        ? new Date(latestRecord.eventTimestamp).toISOString()
        : null) ??
    (latestRecord.sourceFileDate instanceof Date
      ? latestRecord.sourceFileDate.toISOString()
      : latestRecord.sourceFileDate
        ? new Date(latestRecord.sourceFileDate).toISOString()
        : null) ??
    (latestRecord.importedAt instanceof Date
      ? latestRecord.importedAt.toISOString()
      : latestRecord.importedAt
        ? new Date(latestRecord.importedAt).toISOString()
        : null);

  const city = pickString(rawRow, ['city', 'last scan city', 'scan city', 'destination city']);
  const state = pickString(rawRow, ['state', 'last scan state', 'scan state', 'destination state']);
  const zip = pickString(rawRow, ['zip', 'postal code', 'last scan zip', 'scan zip']);
  const location = [city, state, zip].filter(Boolean).join(', ') || null;

  return {
    status,
    eventType: formatFedExStatusLabel(
      pickString(rawRow, ['eventType', 'event type', 'type', 'scan type']) ?? null
    ),
    description:
      pickString(rawRow, [
        'description',
        'message',
        'status description',
        'tracking message',
        'event description',
      ]) ??
      pickString(rawRecord, ['description', 'message']) ??
      null,
    eventTimestamp,
    sourceFileName:
      pickString(rawRecord, ['sourceFileName']) ??
      latestRecord.sourceFileName ??
      null,
    sourceFileDate:
      pickDateIso(rawRecord, ['sourceFileDate']) ??
      (latestRecord.sourceFileDate instanceof Date
        ? latestRecord.sourceFileDate.toISOString()
        : latestRecord.sourceFileDate
          ? new Date(latestRecord.sourceFileDate).toISOString()
          : null),
    location,
    trackingNumber: latestRecord.trackingNumber,
    stale: false,
  };
}

export function resolveShipmentReadCorrections<T extends ShipmentReadShape>(
  shipment: T
): T & { carrier: Carrier; status: ShipmentStatus; fedExStatusSummary: FedExStatusSummary | null } {
  const fedExStatusSummary = resolveFedExStatusSummary(shipment);
  const hasLinkedFedExRecord = Boolean(shipment.workOrder?.fedExShipmentRecords?.length);

  const carrier =
    shipment.carrier === Carrier.OTHER && hasLinkedFedExRecord
      ? Carrier.FEDEX
      : shipment.carrier;

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
    const searchWhere = buildTokenizedSearchWhere(search, [
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
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
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

  if (!shipment) {
    throw NotFoundError('Shipment not found');
  }

  const trackedShipment = applyShipmentTrackingNumber(shipment);
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
    broadcast({
      type: 'SHIPMENT_UPDATED',
      payload: {
        id: result.shipmentId,
        status: result.shipmentStatus,
        trackingNumber: result.trackingNumber,
        carrier: result.carrier,
        actualDelivery: result.actualDelivery,
      },
    });
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
