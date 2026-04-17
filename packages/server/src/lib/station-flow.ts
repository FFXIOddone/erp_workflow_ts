/**
 * Station Flow Utilities
 *
 * Shared logic for moving orders backward in the pipeline:
 * - Request reprint (resets printing station)
 * - Request design revision (resets design station)
 * - Send back to production (from shipping)
 */
import { prisma } from '../db/client.js';
import { PrintingMethod } from '@erp/shared';
import { broadcast } from '../ws/server.js';
import { logActivity, ActivityAction, EntityType } from './activity-logger.js';

type StationProgressStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

type StationProgressTransitionMode = 'upsert' | 'update';

interface StationProgressTransitionParams {
  orderId: string;
  station: PrintingMethod;
  userId: string;
  status: StationProgressStatus;
  description: string;
  eventType: 'STATION_STATUS_CHANGED' | 'STATION_COMPLETED' | 'STATION_UNCOMPLETED';
  mode: StationProgressTransitionMode;
  startedAt?: Date | null;
  completedAt?: Date | null;
}

/**
 * Persist a station status transition, write the matching work event, and broadcast the update.
 */
export async function saveStationProgressTransition(params: StationProgressTransitionParams) {
  const timestamp = params.completedAt ?? params.startedAt ?? new Date();
  const startedAt =
    params.startedAt !== undefined
      ? params.startedAt
      : params.status === 'IN_PROGRESS'
        ? timestamp
        : null;
  const completedAt =
    params.completedAt !== undefined
      ? params.completedAt
      : params.status === 'COMPLETED'
        ? timestamp
        : null;

  const mutation =
    params.mode === 'upsert'
      ? prisma.stationProgress.upsert({
          where: { orderId_station: { orderId: params.orderId, station: params.station } },
          update: {
            status: params.status,
            startedAt,
            completedAt,
            completedById: params.status === 'COMPLETED' ? params.userId : null,
          },
          create: {
            orderId: params.orderId,
            station: params.station,
            status: params.status,
            startedAt: startedAt ?? undefined,
            completedAt: completedAt ?? undefined,
            completedById: params.status === 'COMPLETED' ? params.userId : undefined,
          },
        })
      : prisma.stationProgress.update({
          where: { orderId_station: { orderId: params.orderId, station: params.station } },
          data: {
            status: params.status,
            startedAt,
            completedAt,
            completedById: params.status === 'COMPLETED' ? params.userId : null,
          },
        });

  const progress = await mutation;

  await prisma.workEvent.create({
    data: {
      orderId: params.orderId,
      eventType: params.eventType,
      description: params.description,
      userId: params.userId,
      details: { station: params.station, status: params.status },
    },
  });

  broadcast({
    type: 'STATION_UPDATED',
    payload: { orderId: params.orderId, station: params.station, status: params.status },
    timestamp,
  });

  return progress;
}

interface ResetStationParams {
  orderId: string;
  station: PrintingMethod;
  userId: string;
}

/**
 * Reset a station back to IN_PROGRESS, broadcasting the change.
 */
export async function resetStationToInProgress({ orderId, station, userId }: ResetStationParams) {
  // Find or create the station progress entry
  const existing = await prisma.stationProgress.findUnique({
    where: { orderId_station: { orderId, station } },
  });

  if (existing) {
    await prisma.stationProgress.update({
      where: { id: existing.id },
      data: {
        status: 'IN_PROGRESS',
        startedAt: new Date(),
        completedAt: null,
        completedById: null,
      },
    });
  } else {
    await prisma.stationProgress.create({
      data: {
        orderId,
        station,
        status: 'IN_PROGRESS',
        startedAt: new Date(),
      },
    });
  }

  // Also ensure order is IN_PROGRESS
  await prisma.workOrder.update({
    where: { id: orderId },
    data: { status: 'IN_PROGRESS' },
  });
}

interface ReprintRequestParams {
  orderId: string;
  lineItemId?: string;
  reason: string;
  description: string;
  quantity?: number;
  userId: string;
  station?: string; // Which printing station to reset (ROLL_TO_ROLL, FLATBED, etc.)
}

/**
 * Create a reprint request and reset the printing station back to IN_PROGRESS.
 */
export async function createReprintRequest(params: ReprintRequestParams) {
  const { orderId, lineItemId, reason, description, quantity, userId, station } = params;

  // Create the reprint request record
  const reprint = await prisma.reprintRequest.create({
    data: {
      orderId,
      lineItemId: lineItemId || undefined,
      reason: reason as any,
      description,
      quantity: quantity || 1,
      requestedById: userId,
    },
    include: {
      order: { select: { orderNumber: true, customerName: true, routing: true } },
    },
  });

  // Determine which printing station(s) to reset
  const stationsToReset: PrintingMethod[] = station
    ? [station as PrintingMethod]
    : (reprint.order.routing as PrintingMethod[]).filter(r =>
        [PrintingMethod.ROLL_TO_ROLL, PrintingMethod.FLATBED, PrintingMethod.SCREEN_PRINT].includes(r),
      );

  for (const st of stationsToReset) {
    await resetStationToInProgress({ orderId, station: st, userId });
  }

  // Broadcast
  broadcast({
    type: 'REPRINT_REQUESTED',
    payload: {
      orderId,
      orderNumber: reprint.order.orderNumber,
      customerName: reprint.order.customerName,
      reason,
      station: stationsToReset,
      requestedBy: userId,
    },
    timestamp: new Date(),
  });

  // Log
  await logActivity({
    action: 'REPRINT_REQUEST',
    entityType: EntityType.WORK_ORDER,
    entityId: orderId,
    entityName: reprint.order.orderNumber,
    description: `Reprint requested: ${reason} — ${description}`,
    userId,
  });

  return reprint;
}

interface RevisionRequestParams {
  orderId: string;
  reason: string;
  notes?: string;
  userId: string;
}

/**
 * Create a design revision request and reset DESIGN station back to IN_PROGRESS.
 */
export async function createRevisionRequest(params: RevisionRequestParams) {
  const { orderId, reason, notes, userId } = params;

  const revision = await prisma.designRevisionRequest.create({
    data: {
      orderId,
      reason: reason as any,
      notes,
      requestedById: userId,
      status: 'PENDING',
    },
    include: {
      order: { select: { orderNumber: true, customerName: true } },
    },
  });

  // Reset DESIGN station
  await resetStationToInProgress({ orderId, station: PrintingMethod.DESIGN, userId });

  // Broadcast
  broadcast({
    type: 'REVISION_REQUESTED',
    payload: {
      orderId,
      orderNumber: revision.order.orderNumber,
      customerName: revision.order.customerName,
      reason,
      notes,
      requestedBy: userId,
    },
    timestamp: new Date(),
  });

  // Log
  await logActivity({
    action: 'REVISION_REQUEST',
    entityType: EntityType.WORK_ORDER,
    entityId: orderId,
    entityName: revision.order.orderNumber,
    description: `Design revision requested: ${reason}${notes ? ' — ' + notes : ''}`,
    userId,
  });

  return revision;
}

interface MaterialRequestParams {
  orderId: string;
  description: string;
  userId: string;
}

/**
 * Create a material request notification for warehouse/admin users.
 */
export async function createMaterialRequest(params: MaterialRequestParams) {
  const { orderId, description, userId } = params;

  const order = await prisma.workOrder.findUnique({
    where: { id: orderId },
    select: { orderNumber: true, customerName: true },
  });

  if (!order) throw new Error('Order not found');

  // Create notifications for admin/manager users
  const admins = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'MANAGER'] }, isActive: true },
    select: { id: true },
  });

  for (const admin of admins) {
    await prisma.notification.create({
      data: {
        userId: admin.id,
        type: 'SYSTEM',
        title: `Material Request: ${order.orderNumber}`,
        message: `${description} — ${order.customerName}`,
        link: `/orders/${orderId}`,
      },
    });
  }

  // Broadcast
  broadcast({
    type: 'MATERIAL_REQUESTED',
    payload: {
      orderId,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      description,
      requestedBy: userId,
    },
    timestamp: new Date(),
  });

  // Log
  await logActivity({
    action: 'MATERIAL_REQUEST',
    entityType: EntityType.WORK_ORDER,
    entityId: orderId,
    entityName: order.orderNumber,
    description: `Material requested: ${description}`,
    userId,
  });
}
