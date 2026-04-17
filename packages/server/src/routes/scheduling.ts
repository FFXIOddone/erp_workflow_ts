import { Router } from 'express';
import { prisma } from '../db/client.js';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { broadcast } from '../ws/server.js';
import { buildRouteBroadcastPayload } from '../lib/route-broadcast.js';
import { NotFoundError, BadRequestError } from '../middleware/error-handler.js';
import { logActivity, ActivityAction, EntityType } from '../lib/activity-logger.js';
import { buildRouteActivityPayload } from '../lib/route-activity.js';
import { buildProductionCalendarView, type ProductionCalendarStation, type WorkOrderCalendarRow } from '../services/production-calendar.js';
import {
  CreateProductionSlotSchema,
  UpdateProductionSlotSchema,
  RescheduleSlotSchema,
  BulkScheduleSchema,
  ScheduleFilterSchema,
} from '@erp/shared';
import { PrintingMethod, SlotStatus } from '@prisma/client';

const router = Router();
router.use(authenticate);

// ============ GET /scheduling - List production slots with filters ============
router.get('/', async (req: AuthRequest, res) => {
  const filters = ScheduleFilterSchema.parse(req.query);

  const where: any = {};

  // Date range filter
  if (filters.startDate || filters.endDate) {
    where.scheduledDate = {};
    if (filters.startDate) {
      where.scheduledDate.gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      where.scheduledDate.lte = new Date(filters.endDate);
    }
  }

  // Station filter
  if (filters.station) {
    where.station = filters.station;
  }

  // Status filter
  if (filters.status) {
    where.status = filters.status;
  }

  // Assigned user filter
  if (filters.assignedToId) {
    where.assignedToId = filters.assignedToId;
  }

  const slots = await prisma.productionSlot.findMany({
    where,
    include: {
      workOrder: {
        select: {
          id: true,
          orderNumber: true,
          customerName: true,
          description: true,
          status: true,
          dueDate: true,
        },
      },
      assignedTo: {
        select: {
          id: true,
          displayName: true,
          email: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          displayName: true,
        },
      },
    },
    orderBy: [
      { scheduledDate: 'asc' },
      { priority: 'desc' },
      { scheduledStart: 'asc' },
    ],
  });

  res.json({ success: true, data: slots });
});

// ============ GET /scheduling/calendar - Calendar view data ============
router.get('/calendar', async (req: AuthRequest, res) => {
  const { startDate, endDate, station } = req.query;

  if (!startDate || !endDate) {
    throw BadRequestError('startDate and endDate are required');
  }

  const orders = await prisma.workOrder.findMany({
    where: {
      status: {
        notIn: ['COMPLETED', 'SHIPPED', 'CANCELLED'],
      },
    },
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      description: true,
      status: true,
      priority: true,
      dueDate: true,
      createdAt: true,
      notes: true,
      routing: true,
      stationProgress: {
        select: {
          station: true,
          status: true,
          startedAt: true,
          completedAt: true,
        },
        orderBy: [
          { station: 'asc' },
          { completedAt: 'asc' },
        ],
      },
      shipments: {
        select: {
          shipDate: true,
          actualDelivery: true,
          status: true,
        },
        orderBy: [
          { shipDate: 'desc' },
          { createdAt: 'desc' },
        ],
        take: 3,
      },
    },
    orderBy: [
      { dueDate: 'asc' },
      { priority: 'desc' },
      { createdAt: 'asc' },
    ],
  });

  const data = await buildProductionCalendarView(
    orders as unknown as WorkOrderCalendarRow[],
    {
      startDate: new Date(startDate as string),
      endDate: new Date(endDate as string),
    },
    station ? (station as ProductionCalendarStation) : undefined,
  );

  res.json({ success: true, data });
});

// ============ GET /scheduling/capacity - Capacity overview by station/date ============
router.get('/capacity', async (req: AuthRequest, res) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    throw BadRequestError('startDate and endDate are required');
  }

  // Get all scheduled slots in range grouped by station and date
  const slots = await prisma.productionSlot.groupBy({
    by: ['station', 'scheduledDate'],
    where: {
      scheduledDate: {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      },
      status: {
        not: 'CANCELLED',
      },
    },
    _sum: {
      estimatedHours: true,
    },
    _count: {
      id: true,
    },
  });

  // Assume 8 hours per day per station capacity (could make this configurable)
  const DAILY_CAPACITY_HOURS = 8;

  const capacityData = slots.map((slot) => {
    const scheduledHours = Number(slot._sum.estimatedHours) || 0;
    return {
      station: slot.station,
      date: slot.scheduledDate,
      scheduledHours,
      slotCount: slot._count.id,
      availableHours: Math.max(0, DAILY_CAPACITY_HOURS - scheduledHours),
      utilizationPercent: Math.round((scheduledHours / DAILY_CAPACITY_HOURS) * 100),
    };
  });

  res.json({ success: true, data: capacityData });
});

// ============ GET /scheduling/unscheduled - Orders without scheduling ============
router.get('/unscheduled', async (req: AuthRequest, res) => {
  const orders = await prisma.workOrder.findMany({
    where: {
      productionSlots: {
        none: {},
      },
      status: {
        in: ['PENDING', 'IN_PROGRESS'],
      },
    },
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      description: true,
      status: true,
      dueDate: true,
      routing: true,
      createdAt: true,
    },
    orderBy: [
      { dueDate: 'asc' },
      { createdAt: 'asc' },
    ],
  });

  res.json({ success: true, data: orders });
});

// ============ GET /scheduling/:id - Get single slot details ============
router.get('/:id', async (req: AuthRequest, res) => {
  const slot = await prisma.productionSlot.findUnique({
    where: { id: req.params.id },
    include: {
      workOrder: true,
      assignedTo: true,
      createdBy: true,
    },
  });

  if (!slot) {
    throw NotFoundError('Production slot not found');
  }

  res.json({ success: true, data: slot });
});

// ============ POST /scheduling - Create new production slot ============
router.post('/', async (req: AuthRequest, res) => {
  const data = CreateProductionSlotSchema.parse(req.body);

  // Verify work order exists
  const workOrder = await prisma.workOrder.findUnique({
    where: { id: data.workOrderId },
    select: { id: true, orderNumber: true },
  });

  if (!workOrder) {
    throw NotFoundError('Work order not found');
  }

  // Check for overlapping slots for same station if times are provided
  if (data.scheduledStart && data.scheduledEnd) {
    const overlapping = await prisma.productionSlot.findFirst({
      where: {
        station: data.station,
        scheduledDate: data.scheduledDate,
        status: { not: 'CANCELLED' },
        OR: [
          {
            AND: [
              { scheduledStart: { lte: data.scheduledStart } },
              { scheduledEnd: { gt: data.scheduledStart } },
            ],
          },
          {
            AND: [
              { scheduledStart: { lt: data.scheduledEnd } },
              { scheduledEnd: { gte: data.scheduledEnd } },
            ],
          },
        ],
      },
    });

    if (overlapping) {
      throw BadRequestError('Time slot overlaps with existing schedule', {
        conflictingSlotId: overlapping.id,
      });
    }
  }

  const slot = await prisma.productionSlot.create({
    data: {
      ...data,
      createdById: req.userId!,
    },
    include: {
      workOrder: {
        select: {
          id: true,
          orderNumber: true,
          customerName: true,
        },
      },
      assignedTo: {
        select: {
          id: true,
          displayName: true,
        },
      },
    },
  });

  await logActivity(
    buildRouteActivityPayload({
      action: ActivityAction.CREATE,
      entityType: EntityType.PRODUCTION_SLOT, // Using ORDER since we don't have SLOT
      entityId: slot.id,
      description: `Scheduled ${workOrder.orderNumber} for ${data.station} on ${data.scheduledDate.toISOString().split('T')[0]}`,
      userId: req.user!.id,
      req,
    }),
  );

  broadcast(buildRouteBroadcastPayload({ type: 'SCHEDULE_CREATED', payload: slot }));

  res.status(201).json({ success: true, data: slot });
});

// ============ POST /scheduling/bulk - Bulk schedule multiple orders ============
router.post('/bulk', async (req: AuthRequest, res) => {
  const data = BulkScheduleSchema.parse(req.body);

  const results = await prisma.$transaction(
    data.workOrderIds.map((workOrderId) =>
      prisma.productionSlot.create({
        data: {
          workOrderId,
          station: data.station,
          scheduledDate: data.scheduledDate,
          estimatedHours: data.estimatedHours,
          assignedToId: data.assignedToId ?? null,
          createdById: req.userId!,
        },
        include: {
          workOrder: {
            select: {
              id: true,
              orderNumber: true,
              customerName: true,
            },
          },
        },
      })
    )
  );

  await logActivity(
    buildRouteActivityPayload({
      action: ActivityAction.CREATE,
      entityType: EntityType.PRODUCTION_SLOT,
      entityId: 'bulk',
      description: `Bulk scheduled ${results.length} production slots`,
      userId: req.user!.id,
      req,
    }),
  );

  broadcast(buildRouteBroadcastPayload({ type: 'SCHEDULE_BULK_CREATED', payload: results }));

  res.status(201).json({ success: true, data: results });
});

// ============ PATCH /scheduling/:id - Update production slot ============
router.patch('/:id', async (req: AuthRequest, res) => {
  const data = UpdateProductionSlotSchema.parse(req.body);

  const existing = await prisma.productionSlot.findUnique({
    where: { id: req.params.id },
    include: { workOrder: true },
  });

  if (!existing) {
    throw NotFoundError('Production slot not found');
  }

  const slot = await prisma.productionSlot.update({
    where: { id: req.params.id },
    data,
    include: {
      workOrder: {
        select: {
          id: true,
          orderNumber: true,
          customerName: true,
        },
      },
      assignedTo: {
        select: {
          id: true,
          displayName: true,
        },
      },
    },
  });

  await logActivity(
    buildRouteActivityPayload({
      action: ActivityAction.UPDATE,
      entityType: EntityType.PRODUCTION_SLOT,
      entityId: slot.id,
      description: `Updated production slot for ${existing.workOrder.orderNumber}`,
      userId: req.user!.id,
      req,
    }),
  );

  broadcast(buildRouteBroadcastPayload({ type: 'SCHEDULE_UPDATED', payload: slot }));

  res.json({ success: true, data: slot });
});

// ============ POST /scheduling/:id/reschedule - Reschedule with reason ============
router.post('/:id/reschedule', async (req: AuthRequest, res) => {
  const data = RescheduleSlotSchema.parse(req.body);

  const existing = await prisma.productionSlot.findUnique({
    where: { id: req.params.id },
    include: { workOrder: true },
  });

  if (!existing) {
    throw NotFoundError('Production slot not found');
  }

  const oldDate = existing.scheduledDate.toISOString().split('T')[0];
  const newDate = new Date(data.newDate).toISOString().split('T')[0];

  const slot = await prisma.productionSlot.update({
    where: { id: req.params.id },
    data: {
      scheduledDate: new Date(data.newDate),
      scheduledStart: data.newStart ?? existing.scheduledStart,
      scheduledEnd: data.newEnd ?? existing.scheduledEnd,
      status: 'RESCHEDULED',
      notes: data.reason
        ? `${existing.notes ? existing.notes + '\n' : ''}[Rescheduled ${new Date().toISOString().split('T')[0]}] ${data.reason}`
        : existing.notes,
    },
    include: {
      workOrder: {
        select: {
          id: true,
          orderNumber: true,
          customerName: true,
        },
      },
      assignedTo: {
        select: {
          id: true,
          displayName: true,
        },
      },
    },
  });

  await logActivity(
    buildRouteActivityPayload({
      action: ActivityAction.UPDATE,
      entityType: EntityType.PRODUCTION_SLOT,
      entityId: slot.id,
      description: `Rescheduled ${existing.workOrder.orderNumber} from ${oldDate} to ${newDate}${data.reason ? `: ${data.reason}` : ''}`,
      userId: req.user!.id,
      req,
    }),
  );

  broadcast(buildRouteBroadcastPayload({ type: 'SCHEDULE_RESCHEDULED', payload: slot }));

  res.json({ success: true, data: slot });
});

// ============ POST /scheduling/:id/start - Start production on slot ============
router.post('/:id/start', async (req: AuthRequest, res) => {
  const existing = await prisma.productionSlot.findUnique({
    where: { id: req.params.id },
    include: { workOrder: true },
  });

  if (!existing) {
    throw NotFoundError('Production slot not found');
  }

  if (existing.status !== 'SCHEDULED' && existing.status !== 'RESCHEDULED') {
    throw BadRequestError('Can only start scheduled or rescheduled slots');
  }

  const slot = await prisma.productionSlot.update({
    where: { id: req.params.id },
    data: {
      status: 'IN_PROGRESS',
    },
    include: {
      workOrder: {
        select: {
          id: true,
          orderNumber: true,
          customerName: true,
        },
      },
    },
  });

  await logActivity(
    buildRouteActivityPayload({
      action: ActivityAction.UPDATE,
      entityType: EntityType.PRODUCTION_SLOT,
      entityId: slot.id,
      description: `Started production for ${existing.workOrder.orderNumber} at ${existing.station}`,
      userId: req.user!.id,
      req,
    }),
  );

  broadcast(buildRouteBroadcastPayload({ type: 'SCHEDULE_STARTED', payload: slot }));

  res.json({ success: true, data: slot });
});

// ============ POST /scheduling/:id/complete - Complete production slot ============
router.post('/:id/complete', async (req: AuthRequest, res) => {
  const { actualHours } = req.body;

  const existing = await prisma.productionSlot.findUnique({
    where: { id: req.params.id },
    include: { workOrder: true },
  });

  if (!existing) {
    throw NotFoundError('Production slot not found');
  }

  if (existing.status !== 'IN_PROGRESS') {
    throw BadRequestError('Can only complete in-progress slots');
  }

  const slot = await prisma.productionSlot.update({
    where: { id: req.params.id },
    data: {
      status: 'COMPLETED',
      actualHours: actualHours ?? null,
    },
    include: {
      workOrder: {
        select: {
          id: true,
          orderNumber: true,
          customerName: true,
        },
      },
    },
  });

  await logActivity(
    buildRouteActivityPayload({
      action: ActivityAction.UPDATE,
      entityType: EntityType.PRODUCTION_SLOT,
      entityId: slot.id,
      description: `Completed production for ${existing.workOrder.orderNumber} at ${existing.station}${actualHours ? ` (${actualHours}hrs)` : ''}`,
      userId: req.user!.id,
      req,
    }),
  );

  broadcast(buildRouteBroadcastPayload({ type: 'SCHEDULE_COMPLETED', payload: slot }));

  res.json({ success: true, data: slot });
});

// ============ DELETE /scheduling/:id - Cancel/delete production slot ============
router.delete('/:id', async (req: AuthRequest, res) => {
  const existing = await prisma.productionSlot.findUnique({
    where: { id: req.params.id },
    include: { workOrder: true },
  });

  if (!existing) {
    throw NotFoundError('Production slot not found');
  }

  // Soft delete by setting status to CANCELLED instead of hard delete
  const slot = await prisma.productionSlot.update({
    where: { id: req.params.id },
    data: {
      status: 'CANCELLED',
    },
  });

  await logActivity(
    buildRouteActivityPayload({
      action: ActivityAction.DELETE,
      entityType: EntityType.PRODUCTION_SLOT,
      entityId: slot.id,
      description: `Cancelled production slot for ${existing.workOrder.orderNumber} at ${existing.station}`,
      userId: req.user!.id,
      req,
    }),
  );

  broadcast(buildRouteBroadcastPayload({ type: 'SCHEDULE_CANCELLED', payload: slot }));

  res.json({ success: true, data: slot });
});

export default router;
