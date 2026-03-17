import { Router, type Response } from 'express';
import {
  CreateWorkOrderSchema,
  UpdateWorkOrderSchema,
  SetRoutingSchema,
  CompleteStationSchema,
  LogTimeSchema,
  CreateReprintSchema,
  CreateLineItemSchema,
  UpdateLineItemSchema,
  OrderFilterSchema,
  AuditExportSchema,
  CreateAttachmentSchema,
  BulkStatusChangeSchema,
  BulkAssignSchema,
  BulkPrioritySchema,
  BulkDeleteSchema,
  BulkStationStatusSchema,
  BulkMultiStationStatusSchema,
  EmailTrigger,
  PARENT_SUB_STATIONS,
  SUB_STATION_PARENTS,
} from '@erp/shared';
import { prisma } from '../db/client.js';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { NotFoundError, BadRequestError } from '../middleware/error-handler.js';
import { broadcast } from '../ws/server.js';
import { createNotification, notifyAdminsAndManagers } from './notifications.js';
import {
  sendOrderCreatedEmail,
  sendOrderStatusChangedEmail,
  sendOrderAssignedEmail,
} from '../services/email.js';
import { logActivity, ActivityAction, EntityType } from '../lib/activity-logger.js';
import { triggerEmail } from '../services/email-automation.js';
import { bomAutomationService } from '../services/bom-automation.js';
import { resolveCustomerId } from '../lib/customer-matching.js';
import { updateStreak, checkAchievements } from '../services/gamification.js';
import { applyRoutingDefaults } from '../lib/routing-defaults.js';

export const ordersRouter = Router();

// All routes require authentication
ordersRouter.use(authenticate);

// GET /orders/active-time - Get user's active (running) time entry
ordersRouter.get('/active-time', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  
  const activeEntry = await prisma.timeEntry.findFirst({
    where: {
      userId,
      endTime: null, // Still running
    },
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          customerName: true,
        },
      },
    },
    orderBy: { startTime: 'desc' },
  });

  res.json({ success: true, data: activeEntry });
});

// GET /orders/stats - Dashboard summary counts (avoids fetching full order rows)
ordersRouter.get('/stats', async (req: AuthRequest, res: Response) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const [statusCounts, dueToday, overdue] = await Promise.all([
    prisma.workOrder.groupBy({
      by: ['status'],
      _count: { id: true },
    }),
    prisma.workOrder.count({
      where: {
        dueDate: { gte: todayStart, lte: todayEnd },
        status: { notIn: ['COMPLETED', 'SHIPPED', 'CANCELLED'] },
      },
    }),
    prisma.workOrder.count({
      where: {
        dueDate: { lt: todayStart },
        status: { notIn: ['COMPLETED', 'SHIPPED', 'CANCELLED'] },
      },
    }),
  ]);

  const counts: Record<string, number> = {};
  let total = 0;
  for (const row of statusCounts) {
    counts[row.status] = row._count.id;
    total += row._count.id;
  }

  res.json({
    success: true,
    data: {
      total,
      pending: counts['PENDING'] ?? 0,
      inProgress: counts['IN_PROGRESS'] ?? 0,
      completed: counts['COMPLETED'] ?? 0,
      onHold: counts['ON_HOLD'] ?? 0,
      shipped: counts['SHIPPED'] ?? 0,
      cancelled: counts['CANCELLED'] ?? 0,
      dueToday,
      overdue,
    },
  });
});

// GET /orders - List orders with filtering
ordersRouter.get('/', async (req: AuthRequest, res: Response) => {
  const filters = OrderFilterSchema.parse(req.query);
  const { 
    page, pageSize, status, priority, station, myStations,
    search, assignedToId, fromDate, toDate, dueDateFrom, dueDateTo,
    dateFilter, hasAttachments, sortBy, sortOrder, companyBrand, lightweight 
  } = filters;

  // Three tiers of include depth:
  // 1. Default: everything (order detail page)
  // 2. Lightweight: skips attachments (shop floor views that need line items)
  // 3. Summary: only stationProgress + assignedTo (order list table — fastest)
  const isSummary = lightweight && !req.query.includeLineItems;
  const orderInclude = isSummary
    ? {
        stationProgress: { select: { id: true, station: true, status: true } },
        assignedTo: { select: { id: true, displayName: true } },
      }
    : lightweight
    ? {
        lineItems: {
          orderBy: { itemNumber: 'asc' as const },
          include: { itemMaster: { select: { name: true } } },
        },
        stationProgress: true,
        createdBy: { select: { id: true, displayName: true } },
        assignedTo: { select: { id: true, displayName: true } },
      }
    : {
        lineItems: { include: { itemMaster: { select: { name: true } } } },
        stationProgress: true,
        attachments: true,
        createdBy: { select: { id: true, displayName: true } },
        assignedTo: { select: { id: true, displayName: true } },
      };

  const where: Record<string, unknown> = {};
  
  // Multi-status filter (array of statuses)
  if (status && status.length > 0) {
    where.status = status.length === 1 ? status[0] : { in: status };
  }
  
  // Priority filter (array of priorities)
  if (priority && priority.length > 0) {
    where.priority = priority.length === 1 ? priority[0] : { in: priority };
  }
  
  // Company brand filter
  if (companyBrand) {
    where.companyBrand = companyBrand;
  }
  
  if (assignedToId) where.assignedToId = assignedToId;
  
  // Created date range filter
  if (fromDate || toDate) {
    where.createdAt = {};
    if (fromDate) (where.createdAt as Record<string, Date>).gte = fromDate;
    if (toDate) (where.createdAt as Record<string, Date>).lte = toDate;
  }
  
  // Due date range filter
  if (dueDateFrom || dueDateTo) {
    where.dueDate = {};
    if (dueDateFrom) (where.dueDate as Record<string, Date>).gte = dueDateFrom;
    if (dueDateTo) (where.dueDate as Record<string, Date>).lte = dueDateTo;
  }
  
  // Handle dateFilter for dashboard quick filters
  if (dateFilter) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Exclude completed/shipped/cancelled orders for date-based filters
    if (!status || status.length === 0) {
      where.status = { notIn: ['COMPLETED', 'SHIPPED', 'CANCELLED'] };
    }
    
    if (dateFilter === 'dueToday') {
      where.dueDate = {
        gte: today,
        lt: tomorrow,
      };
    } else if (dateFilter === 'overdue') {
      where.dueDate = {
        lt: today,
      };
    } else if (dateFilter === 'dueThisWeek') {
      const endOfWeek = new Date(today);
      endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));
      where.dueDate = {
        gte: today,
        lt: endOfWeek,
      };
    }
  }
  
  if (search) {
    where.OR = [
      { orderNumber: { contains: search, mode: 'insensitive' } },
      { customerName: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { notes: { contains: search, mode: 'insensitive' } },
      { quickbooksOrderNum: { contains: search, mode: 'insensitive' } },
    ];
  }
  
  if (station) {
    where.routing = { has: station };
  }
  
  // Filter by user's allowed stations - show orders where routing includes ANY of user's stations
  if (myStations && req.user?.allowedStations?.length) {
    where.routing = { hasSome: req.user.allowedStations };
  }
  
  // Filter orders that have attachments
  if (hasAttachments !== undefined) {
    if (hasAttachments) {
      where.attachments = { some: {} };
    } else {
      where.attachments = { none: {} };
    }
  }

  // Cursor-based pagination for infinite scroll / virtualized tables
  if (filters.useCursor) {
    const limit = Math.min(filters.pageSize, 100); // Use pageSize as limit, max 100
    const cursor = filters.cursor;
    
    const cursorWhere = cursor 
      ? { ...where, id: { lt: cursor } } // Assuming descending order by default
      : where;
    
    // For cursor pagination, we need to adjust ordering based on sortBy
    // We need a secondary sort on ID for stable pagination
    const orderByArray = [
      { [sortBy]: sortOrder },
      { id: sortOrder }, // Secondary sort for stable pagination
    ];
    
    const orders = await prisma.workOrder.findMany({
      where: cursorWhere,
      include: orderInclude,
      orderBy: orderByArray,
      take: limit + 1, // Fetch one extra to check if there's more
    });
    
    const hasMore = orders.length > limit;
    const items = hasMore ? orders.slice(0, -1) : orders;
    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].id : null;
    const prevCursor = cursor ? items[0]?.id ?? null : null;
    
    return res.json({
      success: true,
      data: {
        items,
        nextCursor,
        prevCursor,
        hasMore,
        // Optionally include total (can be expensive for large datasets)
        // total: await prisma.workOrder.count({ where }),
      },
    });
  }

  // Standard offset-based pagination (legacy)
  const [orders, total] = await Promise.all([
    prisma.workOrder.findMany({
      where,
      include: orderInclude,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.workOrder.count({ where }),
  ]);

  res.json({
    success: true,
    data: {
      items: orders,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  });
});

// ============ Bulk Actions ============

// POST /orders/bulk/status - Bulk change status
ordersRouter.post('/bulk/status', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { orderIds, status } = BulkStatusChangeSchema.parse(req.body);

  // Get current orders to capture old status
  const orders = await prisma.workOrder.findMany({
    where: { id: { in: orderIds } },
    select: { id: true, orderNumber: true, status: true, assignedToId: true },
  });

  if (orders.length === 0) {
    throw BadRequestError('No valid orders found');
  }

  // Filter orders that actually need updating (different status)
  const ordersToUpdate = orders.filter((o) => o.status !== status);

  if (ordersToUpdate.length === 0) {
    return res.json({
      success: true,
      data: { updated: 0, message: 'All orders already have this status' },
    });
  }

  // Update all orders in a transaction
  await prisma.$transaction(async (tx) => {
    // Update status for all orders
    await tx.workOrder.updateMany({
      where: { id: { in: ordersToUpdate.map((o) => o.id) } },
      data: { status },
    });

    // Create events for each order
    await tx.workEvent.createMany({
      data: ordersToUpdate.map((order) => ({
        orderId: order.id,
        eventType: 'STATUS_CHANGED',
        description: `Bulk status change: ${order.status} → ${status}`,
        userId,
      })),
    });

    // Create notifications for assigned users
    for (const order of ordersToUpdate) {
      if (order.assignedToId && order.assignedToId !== userId) {
        await createNotification({
          userId: order.assignedToId,
          type: 'ORDER_STATUS_CHANGED',
          title: 'Order Status Changed',
          message: `Order ${order.orderNumber} status changed to ${status}`,
          relatedOrderId: order.id,
        });
      }
    }
  });

  // Broadcast updates for each order
  for (const order of ordersToUpdate) {
    broadcast({ type: 'ORDER_UPDATED', payload: { orderId: order.id } });
  }

  res.json({
    success: true,
    data: {
      updated: ordersToUpdate.length,
      message: `${ordersToUpdate.length} order(s) updated to ${status}`,
    },
  });
});

// POST /orders/bulk/assign - Bulk assign to user
ordersRouter.post('/bulk/assign', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { orderIds, assignedToId } = BulkAssignSchema.parse(req.body);

  // Verify assignee exists if not null
  if (assignedToId) {
    const assignee = await prisma.user.findUnique({ where: { id: assignedToId } });
    if (!assignee) throw BadRequestError('Assignee not found');
  }

  // Get current orders to capture old assignment
  const orders = await prisma.workOrder.findMany({
    where: { id: { in: orderIds } },
    select: { id: true, orderNumber: true, assignedToId: true },
  });

  if (orders.length === 0) {
    throw BadRequestError('No valid orders found');
  }

  // Filter orders that need updating
  const ordersToUpdate = orders.filter((o) => o.assignedToId !== assignedToId);

  if (ordersToUpdate.length === 0) {
    return res.json({
      success: true,
      data: { updated: 0, message: 'All orders already assigned to this user' },
    });
  }

  // Get assignee name for events
  const assigneeName = assignedToId
    ? (await prisma.user.findUnique({ where: { id: assignedToId }, select: { displayName: true } }))?.displayName || 'Unknown'
    : 'Unassigned';

  // Update all orders in a transaction
  await prisma.$transaction(async (tx) => {
    await tx.workOrder.updateMany({
      where: { id: { in: ordersToUpdate.map((o) => o.id) } },
      data: { assignedToId },
    });

    await tx.workEvent.createMany({
      data: ordersToUpdate.map((order) => ({
        orderId: order.id,
        eventType: 'ASSIGNED',
        description: `Bulk assignment: Assigned to ${assigneeName}`,
        userId,
      })),
    });

    // Notify the new assignee
    if (assignedToId && assignedToId !== userId) {
      await createNotification({
        userId: assignedToId,
        type: 'ORDER_ASSIGNED',
        title: 'Orders Assigned to You',
        message: `${ordersToUpdate.length} order(s) have been assigned to you`,
        relatedOrderId: ordersToUpdate[0].id,
      });
    }
  });

  // Broadcast updates
  for (const order of ordersToUpdate) {
    broadcast({ type: 'ORDER_UPDATED', payload: { orderId: order.id } });
  }

  res.json({
    success: true,
    data: {
      updated: ordersToUpdate.length,
      message: `${ordersToUpdate.length} order(s) assigned to ${assigneeName}`,
    },
  });
});

// POST /orders/bulk/priority - Bulk change priority
ordersRouter.post('/bulk/priority', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { orderIds, priority } = BulkPrioritySchema.parse(req.body);

  const orders = await prisma.workOrder.findMany({
    where: { id: { in: orderIds } },
    select: { id: true, orderNumber: true, priority: true, assignedToId: true },
  });

  if (orders.length === 0) {
    throw BadRequestError('No valid orders found');
  }

  const ordersToUpdate = orders.filter((o) => o.priority !== priority);

  if (ordersToUpdate.length === 0) {
    return res.json({
      success: true,
      data: { updated: 0, message: 'All orders already have this priority' },
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.workOrder.updateMany({
      where: { id: { in: ordersToUpdate.map((o) => o.id) } },
      data: { priority },
    });

    await tx.workEvent.createMany({
      data: ordersToUpdate.map((order) => ({
        orderId: order.id,
        eventType: 'PRIORITY_CHANGED',
        description: `Bulk priority change: ${order.priority} → ${priority}`,
        userId,
      })),
    });
  });

  // Broadcast updates
  for (const order of ordersToUpdate) {
    broadcast({ type: 'ORDER_UPDATED', payload: { orderId: order.id } });
  }

  res.json({
    success: true,
    data: {
      updated: ordersToUpdate.length,
      message: `${ordersToUpdate.length} order(s) priority set to ${priority}`,
    },
  });
});

// POST /orders/bulk/cancel - Bulk cancel orders
ordersRouter.post('/bulk/cancel', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { orderIds } = BulkDeleteSchema.parse(req.body);

  const orders = await prisma.workOrder.findMany({
    where: { id: { in: orderIds } },
    select: { id: true, orderNumber: true, status: true, assignedToId: true },
  });

  if (orders.length === 0) {
    throw BadRequestError('No valid orders found');
  }

  // Filter out already cancelled orders
  const ordersToCancel = orders.filter((o) => o.status !== 'CANCELLED');

  if (ordersToCancel.length === 0) {
    return res.json({
      success: true,
      data: { updated: 0, message: 'All orders already cancelled' },
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.workOrder.updateMany({
      where: { id: { in: ordersToCancel.map((o) => o.id) } },
      data: { status: 'CANCELLED' },
    });

    await tx.workEvent.createMany({
      data: ordersToCancel.map((order) => ({
        orderId: order.id,
        eventType: 'STATUS_CHANGED',
        description: `Bulk cancelled: ${order.status} → CANCELLED`,
        userId,
      })),
    });
  });

  // Broadcast updates
  for (const order of ordersToCancel) {
    broadcast({ type: 'ORDER_UPDATED', payload: { orderId: order.id } });
  }

  res.json({
    success: true,
    data: {
      updated: ordersToCancel.length,
      message: `${ordersToCancel.length} order(s) cancelled`,
    },
  });
});

// POST /orders/bulk/station-status - Bulk change station progress status
ordersRouter.post('/bulk/station-status', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { orderIds, station, status } = BulkStationStatusSchema.parse(req.body);

  // Find all orders that have this station in their routing AND have a stationProgress record
  const orders = await prisma.workOrder.findMany({
    where: {
      id: { in: orderIds },
      routing: { has: station },
    },
    select: { id: true, orderNumber: true },
    });

  if (orders.length === 0) {
    throw BadRequestError('No valid orders found with that station in their routing');
  }

  const orderIdList = orders.map(o => o.id);
  const completedAt = status === 'COMPLETED' ? new Date() : null;
  const completedById = status === 'COMPLETED' ? userId : null;
  const startedAt = status === 'IN_PROGRESS' ? new Date() : undefined;

  await prisma.$transaction(async (tx) => {
    // Update all matching stationProgress records
    await tx.stationProgress.updateMany({
      where: {
        orderId: { in: orderIdList },
        station: station as never,
      },
      data: {
        status,
        completedAt,
        completedById,
        ...(startedAt ? { startedAt } : {}),
      },
    });

    // Log events
    await tx.workEvent.createMany({
      data: orders.map(order => ({
        orderId: order.id,
        eventType: status === 'COMPLETED' ? 'STATION_COMPLETED' : 'STATION_STATUS_CHANGED',
        description: `Bulk station update: ${station} → ${status}`,
        userId,
        details: { station, status },
      })),
    });
  });

  // Broadcast updates
  for (const order of orders) {
    broadcast({ type: 'STATION_UPDATED', payload: { orderId: order.id, station, status }, timestamp: new Date() });
  }

  res.json({
    success: true,
    data: {
      updated: orders.length,
      message: `${orders.length} order(s) station ${station} set to ${status}`,
    },
  });
});

// POST /orders/bulk/multi-station-status - Bulk change multiple stations at once
ordersRouter.post('/bulk/multi-station-status', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { orderIds, stationUpdates } = BulkMultiStationStatusSchema.parse(req.body);

  let totalUpdated = 0;
  const allBroadcasts: { orderId: string; station: string; status: string }[] = [];

  await prisma.$transaction(async (tx) => {
    for (const { station, status } of stationUpdates) {
      // Find orders that have this station in their routing
      const orders = await tx.workOrder.findMany({
        where: {
          id: { in: orderIds },
          routing: { has: station },
        },
        select: { id: true, orderNumber: true },
      });

      if (orders.length === 0) continue;

      const orderIdList = orders.map(o => o.id);
      const completedAt = status === 'COMPLETED' ? new Date() : null;
      const completedById = status === 'COMPLETED' ? userId : null;
      const startedAt = status === 'IN_PROGRESS' ? new Date() : undefined;

      // Update all matching stationProgress records for this station
      await tx.stationProgress.updateMany({
        where: {
          orderId: { in: orderIdList },
          station: station as never,
        },
        data: {
          status,
          completedAt,
          completedById,
          ...(startedAt ? { startedAt } : {}),
        },
      });

      // Log events
      await tx.workEvent.createMany({
        data: orders.map(order => ({
          orderId: order.id,
          eventType: status === 'COMPLETED' ? 'STATION_COMPLETED' : 'STATION_STATUS_CHANGED',
          description: `Bulk station update: ${station} → ${status}`,
          userId,
          details: { station, status },
        })),
      });

      totalUpdated += orders.length;
      for (const order of orders) {
        allBroadcasts.push({ orderId: order.id, station, status });
      }
    }
  });

  // Broadcast all updates
  for (const { orderId, station, status } of allBroadcasts) {
    broadcast({ type: 'STATION_UPDATED', payload: { orderId, station, status }, timestamp: new Date() });
  }

  res.json({
    success: true,
    data: {
      updated: totalUpdated,
      stations: stationUpdates.length,
      message: `Updated ${stationUpdates.length} station(s) across orders`,
    },
  });
});

// POST /orders/bulk/claim - Bulk claim orders (set station to IN_PROGRESS + assign to user)
ordersRouter.post('/bulk/claim', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { orderIds, station } = req.body;

  if (!orderIds?.length || !station) {
    throw BadRequestError('orderIds and station are required');
  }

  const orders = await prisma.workOrder.findMany({
    where: {
      id: { in: orderIds },
      routing: { has: station },
    },
    select: { id: true, orderNumber: true },
  });

  if (orders.length === 0) {
    throw BadRequestError('No valid orders found');
  }

  const orderIdList = orders.map(o => o.id);

  await prisma.$transaction(async (tx) => {
    await tx.stationProgress.updateMany({
      where: {
        orderId: { in: orderIdList },
        station: station as never,
        status: 'NOT_STARTED',
      },
      data: {
        status: 'IN_PROGRESS',
        startedAt: new Date(),
      },
    });

    await tx.workEvent.createMany({
      data: orders.map(order => ({
        orderId: order.id,
        eventType: 'STATION_CLAIMED',
        description: `Order claimed at station ${station}`,
        userId,
        details: { station },
      })),
    });
  });

  for (const order of orders) {
    broadcast({ type: 'STATION_UPDATED', payload: { orderId: order.id, station, status: 'IN_PROGRESS' }, timestamp: new Date() });
  }

  res.json({
    success: true,
    data: { updated: orders.length, message: `${orders.length} order(s) claimed` },
  });
});

// POST /orders/auto-advance-installations - Auto-advance installation orders whose scheduled date has arrived
ordersRouter.post('/auto-advance-installations', async (req: AuthRequest, res: Response) => {
  const now = new Date();

  // Find installation jobs whose scheduled date/time has arrived or passed
  const dueJobs = await prisma.installationJob.findMany({
    where: {
      scheduledDate: { lte: now },
      workOrder: {
        routing: { has: 'INSTALLATION' },
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        stationProgress: {
          some: {
            station: 'INSTALLATION',
            status: 'NOT_STARTED',
          },
        },
      },
    },
    select: {
      workOrderId: true,
      workOrder: { select: { orderNumber: true } },
    },
  });

  if (dueJobs.length === 0) {
    return res.json({ success: true, data: { advanced: 0 } });
  }

  const orderIds = dueJobs.map(j => j.workOrderId);

  await prisma.$transaction(async (tx) => {
    await tx.stationProgress.updateMany({
      where: {
        orderId: { in: orderIds },
        station: 'INSTALLATION',
        status: 'NOT_STARTED',
      },
      data: {
        status: 'IN_PROGRESS',
        startedAt: now,
      },
    });

    await tx.workEvent.createMany({
      data: dueJobs.map(j => ({
        orderId: j.workOrderId,
        eventType: 'STATION_AUTO_ADVANCED' as const,
        description: `Installation auto-started (scheduled date reached)`,
        details: { station: 'INSTALLATION', reason: 'scheduled_date' },
        userId: req.userId!,
      })),
    });
  });

  for (const job of dueJobs) {
    broadcast({ type: 'STATION_UPDATED', payload: { orderId: job.workOrderId, station: 'INSTALLATION', status: 'IN_PROGRESS' }, timestamp: new Date() });
  }

  res.json({
    success: true,
    data: { advanced: dueJobs.length, message: `${dueJobs.length} installation(s) auto-advanced` },
  });
});

// ============ Single Order Routes ============

// GET /orders/by-number/:orderNumber - Lookup order by order number (returns id + basic info)
ordersRouter.get('/by-number/:orderNumber', async (req: AuthRequest, res: Response) => {
  const order = await prisma.workOrder.findFirst({
    where: { orderNumber: { equals: req.params.orderNumber, mode: 'insensitive' } },
    select: { id: true, orderNumber: true, customerName: true, status: true },
  });

  if (!order) throw NotFoundError(`Order ${req.params.orderNumber} not found`);

  res.json({ success: true, data: order });
});

// GET /orders/:id - Get single order
ordersRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  const order = await prisma.workOrder.findUnique({
    where: { id: req.params.id },
    include: {
      lineItems: { orderBy: { itemNumber: 'asc' } },
      stationProgress: true,
      events: { orderBy: { createdAt: 'desc' }, include: { user: { select: { displayName: true } } } },
      timeEntries: { include: { user: { select: { displayName: true } } } },
      reprintRequests: { include: { requestedBy: { select: { displayName: true } } } },
      attachments: { orderBy: { uploadedAt: 'desc' }, include: { uploadedBy: { select: { displayName: true } } } },
      createdBy: { select: { id: true, displayName: true } },
      assignedTo: { select: { id: true, displayName: true } },
    },
  });

  if (!order) throw NotFoundError('Order not found');

  res.json({ success: true, data: order });
});

// POST /orders - Create order
ordersRouter.post('/', async (req: AuthRequest, res: Response) => {
  const data = CreateWorkOrderSchema.parse(req.body);
  const userId = req.userId!;

  // Enforce company requirement
  if (!data.companyId) {
    throw BadRequestError('companyId is required when creating an order');
  }

  // If contactId provided, verify the contact has name + phone
  if (data.contactId) {
    const contact = await prisma.contact.findUnique({
      where: { id: data.contactId },
      select: { firstName: true, lastName: true, phone: true, mobile: true },
    });
    if (contact && !contact.firstName && !contact.lastName) {
      throw BadRequestError('Contact must have a name');
    }
    if (contact && !contact.phone && !contact.mobile) {
      throw BadRequestError('Contact must have a phone number');
    }
  }

  // Auto-resolve primary contact if not provided
  if (data.companyId && !data.contactId) {
    const primaryContact = await prisma.contact.findFirst({
      where: { companyId: data.companyId, isPrimary: true },
      select: { id: true },
    });
    if (primaryContact) {
      data.contactId = primaryContact.id;
    }
  }

  // Apply routing defaults (auto-add PRODUCTION, SHIPPING_RECEIVING, etc.)
  const routing = applyRoutingDefaults(data.routing, {
    description: data.description,
  });

  // Auto-generate order number if not provided (TEMP-YYYYMMDD-XXXX format)
  let orderNumber = data.orderNumber;
  if (!orderNumber) {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const todayCount = await prisma.workOrder.count({
      where: {
        orderNumber: { startsWith: `TEMP-${dateStr}` },
      },
    });
    orderNumber = `TEMP-${dateStr}-${String(todayCount + 1).padStart(4, '0')}`;
  }

  // Resolve customer name: prefer explicit, then look up from company, then contact
  let customerName = data.customerName || '';
  let companyId = data.companyId || undefined;
  let contactId = data.contactId || undefined;

  if (companyId && !customerName) {
    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { name: true } });
    if (company) customerName = company.name;
  }

  // Auto-resolve legacy customerId if not provided but customerName is
  let customerId = data.customerId || undefined;
  if (!customerId && !companyId && customerName) {
    const resolved = await resolveCustomerId(customerName);
    if (resolved) customerId = resolved;
  }

  // Fallback customerName
  if (!customerName) customerName = 'Walk-In';

  const order = await prisma.workOrder.create({
    data: {
      orderNumber,
      customerName,
      companyId,
      contactId,
      customerId,
      poNumber: data.poNumber,
      description: data.description,
      priority: data.priority,
      dueDate: data.dueDate,
      notes: data.notes,
      routing,
      createdById: userId,
      lineItems: {
        create: data.lineItems.map((item, idx) => ({
          itemNumber: idx + 1,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          notes: item.notes,
          itemMasterId: item.itemMasterId,
        })),
      },
      stationProgress: {
        create: routing.map((station) => ({
          station,
          status: 'NOT_STARTED',
        })),
      },
      events: {
        create: {
          eventType: 'CREATED',
          description: 'Work order created',
          userId,
        },
      },
    },
    include: {
      lineItems: true,
      stationProgress: true,
    },
  });

  broadcast({ type: 'ORDER_CREATED', payload: order, timestamp: new Date() });

  // Log activity
  logActivity({
    action: ActivityAction.CREATE,
    entityType: EntityType.WORK_ORDER,
    entityId: order.id,
    entityName: order.orderNumber,
    description: `Created order #${order.orderNumber} for ${order.customerName}`,
    details: { customerName: order.customerName, priority: order.priority, lineItemCount: order.lineItems.length },
    userId,
    req,
  });

  // Notify admins and managers of new order
  notifyAdminsAndManagers({
    type: 'ORDER_CREATED',
    title: 'New Order Created',
    message: `Order #${order.orderNumber} for ${order.customerName} has been created`,
    link: `/orders/${order.id}`,
    data: { orderId: order.id, orderNumber: order.orderNumber },
  }).catch(err => console.error('Failed to create notification:', err));

  // Send email notification to admins/managers
  const adminsManagers = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'MANAGER'] }, isActive: true, email: { not: null } },
    select: { email: true },
  });
  const adminEmails = adminsManagers.map(u => u.email).filter((e): e is string => !!e);
  if (adminEmails.length > 0) {
    sendOrderCreatedEmail(adminEmails, {
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      description: order.description,
      status: order.status,
      dueDate: order.dueDate,
      lineItems: order.lineItems.map(li => ({
        itemNumber: String(li.itemNumber),
        description: li.description,
        quantity: li.quantity,
      })),
    }).catch(err => console.error('Failed to send order created email:', err));
  }

  // Trigger automated emails for ORDER_CREATED
  if (data.customerId) {
    const customer = await prisma.customer.findUnique({
      where: { id: data.customerId },
      select: { id: true, name: true, email: true },
    });
    if (customer?.email) {
      triggerEmail(EmailTrigger.ORDER_CREATED, {
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          description: order.description,
          status: order.status,
          dueDate: order.dueDate,
          customerName: order.customerName,
        },
        customer: {
          id: customer.id,
          name: customer.name,
          email: customer.email,
        },
      }).catch(err => console.error('Failed to trigger ORDER_CREATED email:', err));
    }
  }

  res.status(201).json({ success: true, data: order });
});

// PATCH /orders/:id - Update order
ordersRouter.patch('/:id', async (req: AuthRequest, res: Response) => {
  const data = UpdateWorkOrderSchema.parse(req.body);
  const userId = req.userId!;

  const existing = await prisma.workOrder.findUnique({
    where: { id: req.params.id },
    include: { lineItems: true },
  });
  if (!existing) throw NotFoundError('Order not found');

  // Collect events for this update
  const eventData: Array<{ eventType: string; description: string; userId: string; details?: object }> = [];

  if (data.status && data.status !== existing.status) {
    eventData.push({
      eventType: 'STATUS_CHANGED',
      description: `Status changed from ${existing.status} to ${data.status}`,
      userId,
      details: { from: existing.status, to: data.status },
    });
  }

  if (data.assignedToId !== undefined && data.assignedToId !== existing.assignedToId) {
    eventData.push({
      eventType: data.assignedToId ? 'ASSIGNED' : 'UNASSIGNED',
      description: data.assignedToId ? 'Order assigned' : 'Order unassigned',
      userId,
    });
  }

  // Extract lineItems and routing before spreading into workOrder update
  const { lineItems: incomingLineItems, routing: incomingRouting, ...orderData } = data;

  const order = await prisma.$transaction(async (tx) => {
    // Build work order update data (without lineItems/routing initially)
    const updateData: Record<string, unknown> = { ...orderData };

    // Handle routing changes - sync stationProgress
    if (incomingRouting !== undefined) {
      // Apply routing defaults to any routing change
      const resolvedRouting = applyRoutingDefaults(incomingRouting, {
        description: orderData.description ?? existing.description,
      });
      const existingRouting = (existing.routing as string[]) || [];
      const routingChanged = JSON.stringify(existingRouting.sort()) !== JSON.stringify([...resolvedRouting].sort());

      if (routingChanged) {
        updateData.routing = resolvedRouting;

        // Delete old station progress and recreate for the new routing
        await tx.stationProgress.deleteMany({ where: { orderId: req.params.id } });

        if (resolvedRouting.length > 0) {
          await tx.stationProgress.createMany({
            data: resolvedRouting.map((station) => ({
              orderId: req.params.id,
              station,
              status: 'NOT_STARTED',
            })),
          });
        }

        eventData.push({
          eventType: 'ROUTING_SET',
          description: `Routing updated to: ${resolvedRouting.join(', ') || 'none'}`,
          userId,
          details: { from: existingRouting, to: resolvedRouting },
        });
      }
    }

    // Update the work order fields
    await tx.workOrder.update({
      where: { id: req.params.id },
      data: updateData,
    });

    // Handle line items if provided
    if (incomingLineItems !== undefined) {
      const oldDescriptions = existing.lineItems.map(li => li.description);
      const newDescriptions = incomingLineItems.map(li => li.description);

      // Track additions and removals for timeline
      const added = newDescriptions.filter(d => !oldDescriptions.includes(d));
      const removed = oldDescriptions.filter(d => !newDescriptions.includes(d));

      // Delete all existing line items and recreate from the submitted list
      await tx.lineItem.deleteMany({ where: { orderId: req.params.id } });

      if (incomingLineItems.length > 0) {
        await tx.lineItem.createMany({
          data: incomingLineItems.map((item, index) => ({
            orderId: req.params.id,
            itemNumber: index + 1,
            itemMasterId: item.itemMasterId,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            notes: item.notes || null,
          })),
        });
      }

      // Create events for line item changes
      for (const desc of added) {
        eventData.push({
          eventType: 'LINE_ADDED',
          description: `Line item added: ${desc}`,
          userId,
        });
      }
      for (const desc of removed) {
        eventData.push({
          eventType: 'LINE_REMOVED',
          description: `Line item removed: ${desc}`,
          userId,
        });
      }

      // If items were updated (same description but different qty/price), log update
      if (added.length === 0 && removed.length === 0 && existing.lineItems.length > 0) {
        const hasChanges = incomingLineItems.some((newLi, idx) => {
          const oldLi = existing.lineItems.find(o => o.description === newLi.description);
          return oldLi && (oldLi.quantity !== newLi.quantity || Number(oldLi.unitPrice) !== newLi.unitPrice);
        });
        if (hasChanges) {
          eventData.push({
            eventType: 'LINE_UPDATED',
            description: `Line items updated`,
            userId,
          });
        }
      }
    }

    // Re-fetch with includes
    return tx.workOrder.findUniqueOrThrow({
      where: { id: req.params.id },
      include: {
        lineItems: true,
        stationProgress: true,
      },
    });
  });

  // Create events separately
  if (eventData.length > 0) {
    await prisma.workEvent.createMany({
      data: eventData.map(e => ({
        orderId: order.id,
        eventType: e.eventType as 'STATUS_CHANGED' | 'ASSIGNED' | 'UNASSIGNED' | 'ROUTING_SET' | 'LINE_ADDED' | 'LINE_REMOVED' | 'LINE_UPDATED',
        description: e.description,
        userId: e.userId,
        details: e.details,
      })),
    });
  }

  broadcast({ type: 'ORDER_UPDATED', payload: order, timestamp: new Date() });

  // Log activity for status change
  if (data.status && data.status !== existing.status) {
    logActivity({
      action: ActivityAction.STATUS_CHANGE,
      entityType: EntityType.WORK_ORDER,
      entityId: order.id,
      entityName: order.orderNumber,
      description: `Changed order #${order.orderNumber} status from ${existing.status} to ${data.status}`,
      details: { fromStatus: existing.status, toStatus: data.status },
      userId,
      req,
    });
  }

  // Log activity for assignment change
  if (data.assignedToId !== undefined && data.assignedToId !== existing.assignedToId) {
    logActivity({
      action: data.assignedToId ? ActivityAction.ASSIGN : ActivityAction.UNASSIGN,
      entityType: EntityType.WORK_ORDER,
      entityId: order.id,
      entityName: order.orderNumber,
      description: data.assignedToId 
        ? `Assigned order #${order.orderNumber} to user`
        : `Unassigned order #${order.orderNumber}`,
      details: { previousAssignee: existing.assignedToId, newAssignee: data.assignedToId },
      userId,
      req,
    });
  }

  // Send notifications for status changes
  if (data.status && data.status !== existing.status && order.assignedToId) {
    createNotification({
      userId: order.assignedToId,
      type: 'ORDER_STATUS_CHANGED',
      title: 'Order Status Updated',
      message: `Order #${order.orderNumber} status changed to ${data.status}`,
      link: `/orders/${order.id}`,
      data: { orderId: order.id, fromStatus: existing.status, toStatus: data.status },
    }).catch(err => console.error('Failed to create notification:', err));

    // Send email to assigned user about status change
    const assignedUser = await prisma.user.findUnique({
      where: { id: order.assignedToId },
      select: { email: true },
    });
    if (assignedUser?.email) {
      sendOrderStatusChangedEmail(assignedUser.email, {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        description: order.description,
        status: order.status,
        dueDate: order.dueDate,
      }, existing.status, data.status).catch(err => console.error('Failed to send status change email:', err));
    }
  }

  // Notify assigned user when order is assigned to them
  if (data.assignedToId && data.assignedToId !== existing.assignedToId) {
    createNotification({
      userId: data.assignedToId,
      type: 'ORDER_ASSIGNED',
      title: 'Order Assigned to You',
      message: `Order #${order.orderNumber} has been assigned to you`,
      link: `/orders/${order.id}`,
      data: { orderId: order.id, orderNumber: order.orderNumber },
    }).catch(err => console.error('Failed to create notification:', err));

    // Send email to newly assigned user
    const assignedUser = await prisma.user.findUnique({
      where: { id: data.assignedToId },
      select: { email: true },
    });
    if (assignedUser?.email) {
      sendOrderAssignedEmail(assignedUser.email, {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        description: order.description,
        status: order.status,
        dueDate: order.dueDate,
      }).catch(err => console.error('Failed to send order assigned email:', err));
    }
  }

  // Trigger automated emails for status changes
  if (data.status && data.status !== existing.status && order.customerId) {
    const customer = await prisma.customer.findUnique({
      where: { id: order.customerId },
      select: { id: true, name: true, email: true },
    });
    if (customer?.email) {
      const orderContext = {
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          description: order.description,
          status: order.status,
          dueDate: order.dueDate,
          customerName: order.customerName,
        },
        customer: {
          id: customer.id,
          name: customer.name,
          email: customer.email,
        },
      };
      
      // Trigger general status change
      triggerEmail(EmailTrigger.ORDER_STATUS_CHANGED, orderContext)
        .catch(err => console.error('Failed to trigger ORDER_STATUS_CHANGED email:', err));
      
      // Trigger specific status events
      if (data.status === 'COMPLETED') {
        triggerEmail(EmailTrigger.ORDER_COMPLETED, orderContext)
          .catch(err => console.error('Failed to trigger ORDER_COMPLETED email:', err));
      } else if (data.status === 'SHIPPED') {
        triggerEmail(EmailTrigger.ORDER_SHIPPED, orderContext)
          .catch(err => console.error('Failed to trigger ORDER_SHIPPED email:', err));
      }
    }
  }

  res.json({ success: true, data: order });
});

// DELETE /orders/:id
ordersRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  await prisma.workOrder.delete({ where: { id: req.params.id } });
  broadcast({ type: 'ORDER_DELETED', payload: { id: req.params.id }, timestamp: new Date() });
  res.json({ success: true, message: 'Order deleted' });
});

// POST /orders/:id/routing - Set routing
ordersRouter.post('/:id/routing', async (req: AuthRequest, res: Response) => {
  const { routing: rawRouting } = SetRoutingSchema.parse(req.body);
  const userId = req.userId!;

  // Fetch existing order to get description for routing defaults
  const existing = await prisma.workOrder.findUnique({ where: { id: req.params.id }, select: { description: true } });
  const routing = applyRoutingDefaults(rawRouting, { description: existing?.description ?? '' });

  // Delete existing station progress and recreate
  await prisma.stationProgress.deleteMany({ where: { orderId: req.params.id } });

  const order = await prisma.workOrder.update({
    where: { id: req.params.id },
    data: {
      routing,
      stationProgress: {
        create: routing.map((station) => ({ station, status: 'NOT_STARTED' })),
      },
      events: {
        create: {
          eventType: 'ROUTING_SET',
          description: `Routing set to: ${routing.join(', ')}`,
          userId,
          details: { routing },
        },
      },
    },
    include: { stationProgress: true },
  });

  broadcast({ type: 'ORDER_UPDATED', payload: order, timestamp: new Date() });
  res.json({ success: true, data: order });
});

// POST /orders/:id/stations/:station/start - Mark station as in-progress
ordersRouter.post('/:id/stations/:station/start', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const station = req.params.station;

  const progress = await prisma.stationProgress.update({
    where: { orderId_station: { orderId: req.params.id, station: station as never } },
    data: {
      status: 'IN_PROGRESS',
      startedAt: new Date(),
    },
  });

  await prisma.workEvent.create({
    data: {
      orderId: req.params.id,
      eventType: 'STATION_STATUS_CHANGED',
      description: `Station ${station} started`,
      userId,
      details: { station, status: 'IN_PROGRESS' },
    },
  });

  broadcast({ type: 'STATION_UPDATED', payload: { orderId: req.params.id, station, status: 'IN_PROGRESS' }, timestamp: new Date() });
  res.json({ success: true, data: progress });
});

// POST /orders/:id/stations/:station/complete
ordersRouter.post('/:id/stations/:station/complete', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const station = req.params.station;

  const progress = await prisma.stationProgress.update({
    where: { orderId_station: { orderId: req.params.id, station: station as never } },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      completedById: userId,
    },
  });

  await prisma.workEvent.create({
    data: {
      orderId: req.params.id,
      eventType: 'STATION_COMPLETED',
      description: `Station ${station} completed`,
      userId,
      details: { station },
    },
  });

  // Automatically deduct materials from inventory when production station completes
  // Only do this for production stations (skip ORDER_ENTRY, SHIPPING, etc.)
  const productionStations = ['ROLL_TO_ROLL', 'FLATBED', 'SCREEN_PRINT', 'CUT', 'FABRICATION', 'INSTALLATION'];
  if (productionStations.includes(station)) {
    try {
      const deductResult = await bomAutomationService.deductMaterialsOnStationComplete(
        req.params.id,
        station,
        userId
      );
      
      if (deductResult.deducted > 0) {
        await prisma.workEvent.create({
          data: {
            orderId: req.params.id,
            eventType: 'MATERIAL_DEDUCTED',
            description: `Auto-deducted ${deductResult.deducted} material(s) from inventory`,
            userId,
            details: { station, deducted: deductResult.deducted, errors: deductResult.errors },
          },
        });
        
        broadcast({ type: 'INVENTORY_UPDATED', payload: { orderId: req.params.id } });
      }
    } catch (err) {
      // Non-blocking - log but don't fail the station completion
      console.warn(`Material deduction warning for order ${req.params.id}:`, err);
    }
  }

  broadcast({ type: 'STATION_UPDATED', payload: { orderId: req.params.id, station, status: 'COMPLETED' }, timestamp: new Date() });

  // ─── Sub-station auto-completion: if a sub-station completes, check if parent should auto-complete ───
  try {
    const parentStation = SUB_STATION_PARENTS[station];
    if (parentStation) {
      const siblingSubStations = PARENT_SUB_STATIONS[parentStation] || [];
      // Check if all sibling sub-stations in the routing are COMPLETED
      const siblingProgress = await prisma.stationProgress.findMany({
        where: {
          orderId: req.params.id,
          station: { in: siblingSubStations as never[] },
        },
      });
      const allComplete = siblingProgress.length > 0 && siblingProgress.every(sp => sp.status === 'COMPLETED');
      if (allComplete) {
        // Auto-complete the parent station
        const parentExists = await prisma.stationProgress.findUnique({
          where: { orderId_station: { orderId: req.params.id, station: parentStation as never } },
        });
        if (parentExists && parentExists.status !== 'COMPLETED') {
          await prisma.stationProgress.update({
            where: { orderId_station: { orderId: req.params.id, station: parentStation as never } },
            data: { status: 'COMPLETED', completedAt: new Date(), completedById: userId },
          });
          await prisma.workEvent.create({
            data: {
              orderId: req.params.id,
              eventType: 'STATION_COMPLETED',
              description: `Station ${parentStation} auto-completed (all sub-stations done)`,
              userId,
              details: { station: parentStation, autoCompleted: true },
            },
          });
          broadcast({ type: 'STATION_UPDATED', payload: { orderId: req.params.id, station: parentStation, status: 'COMPLETED' }, timestamp: new Date() });
        }
      }
    }
  } catch (err) {
    console.warn(`Sub-station auto-completion warning for order ${req.params.id}:`, err);
  }

  // Gamification: update streak and check achievements
  try {
    await updateStreak(userId);
    await checkAchievements(userId);
  } catch (err) {
    console.warn('Gamification warning:', err);
  }

  // ─── Auto-advance: when certain stations complete, move the next station to IN_PROGRESS ───
  try {
    const order = await prisma.workOrder.findUnique({
      where: { id: req.params.id },
      select: { routing: true },
    });
    if (order) {
      const routing = order.routing as string[];
      const currentIdx = routing.indexOf(station);
      const nextStation = currentIdx >= 0 && currentIdx < routing.length - 1 ? routing[currentIdx + 1] : null;

      // Production completing → auto-start Shipping
      // Any printing station completing → auto-start Production (if next)
      if (nextStation) {
        const autoAdvanceFrom = ['PRODUCTION', 'SCREEN_PRINT', 'FLATBED', 'ROLL_TO_ROLL', 'DESIGN',
          'FLATBED_PRINTING', 'ROLL_TO_ROLL_PRINTING', 'PRODUCTION_ZUND', 'PRODUCTION_FINISHING', 'SHIPPING_QC'];
        if (autoAdvanceFrom.includes(station)) {
          await prisma.stationProgress.updateMany({
            where: {
              orderId: req.params.id,
              station: nextStation as never,
              status: 'NOT_STARTED',
            },
            data: {
              status: 'IN_PROGRESS',
              startedAt: new Date(),
            },
          });
          broadcast({ type: 'STATION_UPDATED', payload: { orderId: req.params.id, station: nextStation, status: 'IN_PROGRESS' }, timestamp: new Date() });
        }
      }
    }
  } catch (err) {
    console.warn(`Auto-advance warning for order ${req.params.id}:`, err);
  }

  res.json({ success: true, data: progress });
});

// POST /orders/:id/stations/:station/uncomplete
ordersRouter.post('/:id/stations/:station/uncomplete', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const station = req.params.station;

  const progress = await prisma.stationProgress.update({
    where: { orderId_station: { orderId: req.params.id, station: station as never } },
    data: {
      status: 'NOT_STARTED',
      completedAt: null,
      completedById: null,
    },
  });

  await prisma.workEvent.create({
    data: {
      orderId: req.params.id,
      eventType: 'STATION_UNCOMPLETED',
      description: `Station ${station} marked incomplete`,
      userId,
      details: { station },
    },
  });

  broadcast({ type: 'STATION_UPDATED', payload: { orderId: req.params.id, station, status: 'NOT_STARTED' }, timestamp: new Date() });
  res.json({ success: true, data: progress });
});

// POST /orders/:id/complete - Mark entire order as COMPLETED
ordersRouter.post('/:id/complete', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const orderId = req.params.id;

  const order = await prisma.workOrder.findUnique({
    where: { id: orderId },
    include: { stationProgress: true },
  });
  if (!order) throw NotFoundError('Order not found');
  if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
    throw BadRequestError(`Order is already ${order.status.toLowerCase()}`);
  }

  // Mark all station progress as COMPLETED
  await prisma.stationProgress.updateMany({
    where: { orderId, status: { not: 'COMPLETED' } },
    data: { status: 'COMPLETED', completedAt: new Date(), completedById: userId },
  });

  // Update order status
  const updated = await prisma.workOrder.update({
    where: { id: orderId },
    data: { status: 'COMPLETED' },
    include: {
      stationProgress: true,
      lineItems: true,
      createdBy: { select: { id: true, displayName: true } },
      assignedTo: { select: { id: true, displayName: true } },
    },
  });

  // Create work event
  await prisma.workEvent.create({
    data: {
      orderId,
      eventType: 'STATUS_CHANGED',
      description: 'Order marked complete',
      userId,
      details: { previousStatus: order.status, newStatus: 'COMPLETED' },
    },
  });

  // Log activity
  await logActivity({
    action: ActivityAction.STATUS_CHANGE,
    entityType: EntityType.WORK_ORDER,
    entityId: orderId,
    userId,
    description: `Order ${order.orderNumber} marked complete`,
    details: { previousStatus: order.status, newStatus: 'COMPLETED' },
  });

  // Trigger email automation
  try {
    await triggerEmail(EmailTrigger.ORDER_COMPLETED, {
      order: {
        id: orderId,
        orderNumber: order.orderNumber,
        description: order.description || '',
        status: 'COMPLETED',
        dueDate: order.dueDate,
        customerName: order.customerName,
      },
    });
  } catch (err) {
    console.warn('Email trigger warning:', err);
  }

  broadcast({ type: 'ORDER_UPDATED', payload: updated, timestamp: new Date() });
  res.json({ success: true, data: updated });
});

// POST /orders/:id/time - Log time
ordersRouter.post('/:id/time', async (req: AuthRequest, res: Response) => {
  const data = LogTimeSchema.parse(req.body);
  const userId = req.userId!;

  const durationMinutes = data.endTime
    ? Math.round((data.endTime.getTime() - data.startTime.getTime()) / 60000)
    : null;

  const entry = await prisma.timeEntry.create({
    data: {
      orderId: req.params.id,
      station: data.station,
      userId,
      startTime: data.startTime,
      endTime: data.endTime,
      durationMinutes,
      notes: data.notes,
    },
  });

  await prisma.workEvent.create({
    data: {
      orderId: req.params.id,
      eventType: 'TIME_LOGGED',
      description: `Time logged: ${durationMinutes ?? 'ongoing'} minutes at ${data.station}`,
      userId,
      details: { station: data.station, durationMinutes },
    },
  });

  res.status(201).json({ success: true, data: entry });
});

// POST /orders/:id/reprints - Create reprint request
ordersRouter.post('/:id/reprints', async (req: AuthRequest, res: Response) => {
  const data = CreateReprintSchema.parse(req.body);
  const userId = req.userId!;

  const reprint = await prisma.reprintRequest.create({
    data: {
      orderId: req.params.id,
      lineItemId: data.lineItemId,
      reason: data.reason,
      description: data.description,
      quantity: data.quantity,
      requestedById: userId,
    },
  });

  await prisma.workEvent.create({
    data: {
      orderId: req.params.id,
      eventType: 'REPRINTED',
      description: `Reprint requested: ${data.reason}`,
      userId,
      details: { reason: data.reason, quantity: data.quantity },
    },
  });

  res.status(201).json({ success: true, data: reprint });
});

// Line items
ordersRouter.post('/:id/lines', async (req: AuthRequest, res: Response) => {
  const data = CreateLineItemSchema.parse(req.body);
  const userId = req.userId!;

  const lastItem = await prisma.lineItem.findFirst({
    where: { orderId: req.params.id },
    orderBy: { itemNumber: 'desc' },
  });

  const lineItem = await prisma.lineItem.create({
    data: {
      orderId: req.params.id,
      itemNumber: (lastItem?.itemNumber ?? 0) + 1,
      ...data,
    },
  });

  await prisma.workEvent.create({
    data: {
      orderId: req.params.id,
      eventType: 'LINE_ADDED',
      description: `Line item added: ${data.description}`,
      userId,
    },
  });

  res.status(201).json({ success: true, data: lineItem });
});

ordersRouter.patch('/:id/lines/:lineId', async (req: AuthRequest, res: Response) => {
  const data = UpdateLineItemSchema.parse(req.body);
  const userId = req.userId!;

  const lineItem = await prisma.lineItem.update({
    where: { id: req.params.lineId },
    data,
  });

  await prisma.workEvent.create({
    data: {
      orderId: req.params.id,
      eventType: 'LINE_UPDATED',
      description: `Line item updated`,
      userId,
    },
  });

  res.json({ success: true, data: lineItem });
});

ordersRouter.delete('/:id/lines/:lineId', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;

  await prisma.lineItem.delete({ where: { id: req.params.lineId } });

  await prisma.workEvent.create({
    data: {
      orderId: req.params.id,
      eventType: 'LINE_REMOVED',
      description: 'Line item removed',
      userId,
    },
  });

  res.json({ success: true, message: 'Line item deleted' });
});

// GET /orders/:id/events - Get audit log
ordersRouter.get('/:id/events', async (req: AuthRequest, res: Response) => {
  const events = await prisma.workEvent.findMany({
    where: { orderId: req.params.id },
    include: { user: { select: { displayName: true } } },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ success: true, data: events });
});

// GET /orders/export/audit - Export audit log
ordersRouter.get('/export/audit', async (req: AuthRequest, res: Response) => {
  const filters = AuditExportSchema.parse(req.query);

  const where: Record<string, unknown> = {};
  if (filters.orderId) where.orderId = filters.orderId;
  if (filters.userId) where.userId = filters.userId;
  if (filters.fromDate || filters.toDate) {
    where.createdAt = {};
    if (filters.fromDate) (where.createdAt as Record<string, Date>).gte = filters.fromDate;
    if (filters.toDate) (where.createdAt as Record<string, Date>).lte = filters.toDate;
  }

  const events = await prisma.workEvent.findMany({
    where,
    include: {
      order: { select: { orderNumber: true } },
      user: { select: { displayName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (filters.format === 'csv') {
    const csv = [
      'timestamp,order_number,event_type,description,user',
      ...events.map((e) =>
        `"${e.createdAt.toISOString()}","${e.order.orderNumber}","${e.eventType}","${e.description}","${e.user.displayName}"`
      ),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=audit_log.csv');
    res.send(csv);
  } else {
    res.json({ success: true, data: events });
  }
});

// ============ Attachment Routes ============

// GET /orders/:id/attachments - List attachments for an order
ordersRouter.get('/:id/attachments', async (req: AuthRequest, res: Response) => {
  const attachments = await prisma.orderAttachment.findMany({
    where: { orderId: req.params.id },
    include: { uploadedBy: { select: { displayName: true } } },
    orderBy: { uploadedAt: 'desc' },
  });

  res.json({ success: true, data: attachments });
});

// POST /orders/:id/attachments - Add attachment to order
ordersRouter.post('/:id/attachments', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const data = CreateAttachmentSchema.parse(req.body);

  // Verify order exists
  const order = await prisma.workOrder.findUnique({
    where: { id: req.params.id },
    select: { id: true, orderNumber: true },
  });

  if (!order) throw NotFoundError('Order not found');

  const attachment = await prisma.orderAttachment.create({
    data: {
      ...data,
      orderId: req.params.id,
      uploadedById: userId,
    },
    include: { uploadedBy: { select: { displayName: true } } },
  });

  // Log event
  await prisma.workEvent.create({
    data: {
      orderId: req.params.id,
      eventType: 'ATTACHMENT_ADDED',
      description: `Attachment added: ${data.fileName} (${data.fileType})`,
      userId,
    },
  });

  broadcast({ type: 'ORDER_UPDATED', payload: { orderId: req.params.id } });

  res.status(201).json({ success: true, data: attachment });
});

// DELETE /orders/:id/attachments/:attachmentId - Remove attachment
ordersRouter.delete('/:id/attachments/:attachmentId', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;

  const attachment = await prisma.orderAttachment.findUnique({
    where: { id: req.params.attachmentId },
    select: { id: true, fileName: true, fileType: true, orderId: true },
  });

  if (!attachment) throw NotFoundError('Attachment not found');
  if (attachment.orderId !== req.params.id) throw BadRequestError('Attachment does not belong to this order');

  await prisma.orderAttachment.delete({ where: { id: req.params.attachmentId } });

  // Log event
  await prisma.workEvent.create({
    data: {
      orderId: req.params.id,
      eventType: 'ATTACHMENT_REMOVED',
      description: `Attachment removed: ${attachment.fileName}`,
      userId,
    },
  });

  broadcast({ type: 'ORDER_UPDATED', payload: { orderId: req.params.id } });

  res.json({ success: true, message: 'Attachment deleted' });
});

// ============ Temp Order Linking ============

// GET /orders/temp - List all temp (unlinked) orders
ordersRouter.get('/temp', async (req: AuthRequest, res: Response) => {
  const tempOrders = await prisma.workOrder.findMany({
    where: {
      isTempOrder: true,
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      description: true,
      status: true,
      createdAt: true,
      dueDate: true,
      customer: {
        select: { name: true, id: true },
      },
    },
  });

  res.json({ success: true, data: tempOrders });
});

// POST /orders/:id/link - Link temp order to QuickBooks order & sync line items
ordersRouter.post('/:id/link', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { qbOrderNumber, syncLineItems = true } = req.body;

  if (!qbOrderNumber || typeof qbOrderNumber !== 'string') {
    throw BadRequestError('QuickBooks order number is required');
  }

  const order = await prisma.workOrder.findUnique({
    where: { id: req.params.id },
    select: { 
      id: true, 
      orderNumber: true, 
      isTempOrder: true, 
      quickbooksOrderNum: true,
      customerName: true,
      lineItems: { select: { id: true } },
    },
  });

  if (!order) throw NotFoundError('Order not found');

  if (!order.isTempOrder) {
    throw BadRequestError('Order is already linked to QuickBooks');
  }

  // Import QB functions
  const { validateTempOrderLink, getLineItemsForQBOrder } = await import('../services/quickbooks.js');

  // Validate the link with QuickBooks
  const validation = await validateTempOrderLink(order.orderNumber, qbOrderNumber);

  if (!validation.isValid) {
    throw BadRequestError(`Invalid link: ${validation.issues.join(', ')}`);
  }

  // Sync line items from QuickBooks if requested and available
  let syncedLineItems = 0;
  if (syncLineItems) {
    try {
      const qbOrder = await getLineItemsForQBOrder(qbOrderNumber);
      if (qbOrder && qbOrder.lineItems.length > 0) {
        // Delete existing line items if any (they'll be replaced by QB data)
        if (order.lineItems.length > 0) {
          await prisma.lineItem.deleteMany({ where: { orderId: order.id } });
        }

        // Create line items from QB data
        const lineItemData = qbOrder.lineItems.map((item, index) => ({
          orderId: order.id,
          itemNumber: index + 1,
          description: item.description || item.itemRef?.fullName || 'QB Line Item',
          quantity: Math.max(1, Math.round(item.quantity || 1)),
          unitPrice: item.rate ?? item.amount ?? 0,
          notes: [
            item.itemRef?.fullName ? `QB Item: ${item.itemRef.fullName}` : null,
            item.unitOfMeasure ? `Unit: ${item.unitOfMeasure}` : null,
            item.itemRef?.listId ? `QB ListID: ${item.itemRef.listId}` : null,
          ].filter(Boolean).join(' | ') || null,
        }));

        await prisma.lineItem.createMany({ data: lineItemData });
        syncedLineItems = lineItemData.length;
        console.log(`✅ Synced ${syncedLineItems} line items from QB order ${qbOrderNumber} to ${order.orderNumber}`);
      }
    } catch (syncError) {
      console.log(`⚠️ Line item sync failed (non-blocking):`, syncError);
      validation.warnings.push(`Line item sync failed: ${syncError instanceof Error ? syncError.message : 'Unknown error'}. You can manually sync later.`);
    }
  }

  // Update the order to mark it as linked
  const updatedOrder = await prisma.workOrder.update({
    where: { id: req.params.id },
    data: {
      isTempOrder: false,
      quickbooksOrderNum: qbOrderNumber,
      linkedAt: new Date(),
      linkedById: userId,
    },
    include: {
      lineItems: true,
    },
  });

  // Log the linking activity
  await logActivity({
    action: ActivityAction.UPDATE,
    entityType: EntityType.WORK_ORDER,
    entityId: order.id,
    entityName: order.orderNumber,
    description: `Linked temp order ${order.orderNumber} to QuickBooks order ${qbOrderNumber}${syncedLineItems > 0 ? ` (synced ${syncedLineItems} line items)` : ''}`,
    userId,
    req,
  });

  // Log event
  await prisma.workEvent.create({
    data: {
      orderId: req.params.id,
      eventType: 'STATUS_CHANGED',
      description: `Order linked to QuickBooks: ${qbOrderNumber}${syncedLineItems > 0 ? ` — ${syncedLineItems} line items synced` : ''}`,
      userId,
    },
  });

  broadcast({ type: 'ORDER_UPDATED', payload: { orderId: req.params.id } });

  res.json({ 
    success: true, 
    data: updatedOrder,
    syncedLineItems,
    validation: {
      warnings: validation.warnings,
    },
  });
});

// POST /orders/:id/sync-line-items - Re-sync line items from QB for an already-linked order
ordersRouter.post('/:id/sync-line-items', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;

  const order = await prisma.workOrder.findUnique({
    where: { id: req.params.id },
    select: { 
      id: true, 
      orderNumber: true, 
      isTempOrder: true, 
      quickbooksOrderNum: true,
      lineItems: { select: { id: true } },
    },
  });

  if (!order) throw NotFoundError('Order not found');
  if (!order.quickbooksOrderNum) {
    throw BadRequestError('Order is not linked to a QuickBooks order');
  }

  const { getLineItemsForQBOrder } = await import('../services/quickbooks.js');
  const qbOrder = await getLineItemsForQBOrder(order.quickbooksOrderNum);
  
  if (!qbOrder) {
    throw BadRequestError(`QuickBooks order "${order.quickbooksOrderNum}" not found. Ensure QB is connected and the order exists.`);
  }

  if (qbOrder.lineItems.length === 0) {
    return res.json({ success: true, data: { syncedLineItems: 0, message: 'No line items found in QuickBooks order' } });
  }

  // Replace existing line items
  await prisma.lineItem.deleteMany({ where: { orderId: order.id } });

  const lineItemData = qbOrder.lineItems.map((item, index) => ({
    orderId: order.id,
    itemNumber: index + 1,
    description: item.description || item.itemRef?.fullName || 'QB Line Item',
    quantity: Math.max(1, Math.round(item.quantity || 1)),
    unitPrice: item.rate ?? item.amount ?? 0,
    notes: [
      item.itemRef?.fullName ? `QB Item: ${item.itemRef.fullName}` : null,
      item.unitOfMeasure ? `Unit: ${item.unitOfMeasure}` : null,
      item.itemRef?.listId ? `QB ListID: ${item.itemRef.listId}` : null,
    ].filter(Boolean).join(' | ') || null,
  }));

  await prisma.lineItem.createMany({ data: lineItemData });

  await logActivity({
    action: ActivityAction.UPDATE,
    entityType: EntityType.WORK_ORDER,
    entityId: order.id,
    entityName: order.orderNumber,
    description: `Re-synced ${lineItemData.length} line items from QuickBooks order ${order.quickbooksOrderNum}`,
    userId,
    req,
  });

  broadcast({ type: 'ORDER_UPDATED', payload: { orderId: order.id } });

  res.json({
    success: true,
    data: {
      syncedLineItems: lineItemData.length,
      qbOrderType: qbOrder.type,
      message: `Synced ${lineItemData.length} line items from ${qbOrder.type} ${order.quickbooksOrderNum}`,
    },
  });
});

// POST /orders/:id/unlink - Unlink order (revert to temp)
ordersRouter.post('/:id/unlink', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;

  const order = await prisma.workOrder.findUnique({
    where: { id: req.params.id },
    select: { 
      id: true, 
      orderNumber: true, 
      isTempOrder: true, 
      quickbooksOrderNum: true,
    },
  });

  if (!order) throw NotFoundError('Order not found');

  if (order.isTempOrder) {
    throw BadRequestError('Order is not linked to QuickBooks');
  }

  const previousQBNum = order.quickbooksOrderNum;

  const updatedOrder = await prisma.workOrder.update({
    where: { id: req.params.id },
    data: {
      isTempOrder: true,
      quickbooksOrderNum: null,
      linkedAt: null,
      linkedById: null,
    },
  });

  await logActivity({
    action: ActivityAction.UPDATE,
    entityType: EntityType.WORK_ORDER,
    entityId: order.id,
    entityName: order.orderNumber,
    description: `Unlinked order from QuickBooks order ${previousQBNum}`,
    userId,
    req,
  });

  broadcast({ type: 'ORDER_UPDATED', payload: { orderId: req.params.id } });

  res.json({ success: true, data: updatedOrder });
});

// ============ Design Revision Requests (Phase 3) ============

// POST /orders/:id/revision-request - Create a design revision request
ordersRouter.post('/:id/revision-request', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.userId!;
  const { reason, notes } = req.body;

  if (!reason) {
    throw BadRequestError('Reason is required');
  }

  const { createRevisionRequest } = await import('../lib/station-flow.js');
  const revision = await createRevisionRequest({
    orderId: id,
    reason,
    notes,
    userId,
  });

  res.json({ success: true, data: revision });
});

// GET /orders/:id/revision-requests - List revision requests for an order
ordersRouter.get('/:id/revision-requests', async (req: AuthRequest, res: Response) => {
  const revisions = await prisma.designRevisionRequest.findMany({
    where: { orderId: req.params.id },
    include: {
      requestedBy: { select: { id: true, displayName: true } },
      resolvedBy: { select: { id: true, displayName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ success: true, data: revisions });
});

// PUT /orders/revision-requests/:revisionId/resolve - Resolve a revision request
ordersRouter.put('/revision-requests/:revisionId/resolve', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { revisionId } = req.params;

  const revision = await prisma.designRevisionRequest.update({
    where: { id: revisionId },
    data: {
      status: 'RESOLVED',
      resolvedAt: new Date(),
      resolvedById: userId,
    },
    include: {
      requestedBy: { select: { id: true, displayName: true } },
      resolvedBy: { select: { id: true, displayName: true } },
    },
  });

  // Check if there are any remaining pending revisions for this order
  const pendingCount = await prisma.designRevisionRequest.count({
    where: { orderId: revision.orderId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
  });

  // If no more pending revisions, mark design station as complete
  if (pendingCount === 0) {
    await prisma.stationProgress.updateMany({
      where: { orderId: revision.orderId, station: 'DESIGN' },
      data: { status: 'COMPLETED', completedAt: new Date(), completedById: userId },
    });
    broadcast({ type: 'STATION_UPDATED', payload: { orderId: revision.orderId, station: 'DESIGN', status: 'COMPLETED' }, timestamp: new Date() });
  }

  broadcast({ type: 'REVISION_RESOLVED', payload: { orderId: revision.orderId, revision }, timestamp: new Date() });
  res.json({ success: true, data: revision });
});

// ─── Proof Status ─────────────────────────────────────
ordersRouter.post('/:id/proof-status', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.userId!;
  const { status, revision, attachmentId, comments } = req.body;

  const order = await prisma.workOrder.findUnique({
    where: { id },
    select: { id: true, orderNumber: true },
  });
  if (!order) throw NotFoundError('Order not found');

  if (status === 'SENT') {
    // Determine next revision number
    const lastProof = await prisma.proofApproval.findFirst({
      where: { orderId: id },
      orderBy: { revision: 'desc' },
      select: { revision: true },
    });
    const nextRevision = (lastProof?.revision ?? 0) + 1;

    // Create a placeholder attachment if none provided
    let attId = attachmentId;
    if (!attId) {
      const att = await prisma.orderAttachment.create({
        data: {
          orderId: id,
          fileName: `Proof_v${nextRevision}`,
          filePath: '',
          fileType: 'PROOF',
          uploadedById: userId,
        },
      });
      attId = att.id;
    }

    const proof = await prisma.proofApproval.create({
      data: {
        orderId: id,
        attachmentId: attId,
        status: 'PENDING',
        revision: nextRevision,
      },
    });

    // Set DESIGN station to IN_PROGRESS
    await prisma.stationProgress.upsert({
      where: { orderId_station: { orderId: id, station: 'DESIGN' } },
      update: { status: 'IN_PROGRESS', startedAt: new Date() },
      create: { orderId: id, station: 'DESIGN', status: 'IN_PROGRESS', startedAt: new Date() },
    });

    broadcast({
      type: 'PROOF_STATUS_CHANGED',
      payload: { orderId: id, orderNumber: order.orderNumber, status: 'SENT', revision: nextRevision },
      timestamp: new Date(),
    });

    return res.json({ success: true, data: proof });
  }

  if (status === 'APPROVED') {
    const latestProof = await prisma.proofApproval.findFirst({
      where: { orderId: id },
      orderBy: { revision: 'desc' },
    });
    if (latestProof) {
      await prisma.proofApproval.update({
        where: { id: latestProof.id },
        data: { status: 'APPROVED', respondedAt: new Date(), comments },
      });
    }

    broadcast({
      type: 'PROOF_STATUS_CHANGED',
      payload: { orderId: id, orderNumber: order.orderNumber, status: 'APPROVED' },
      timestamp: new Date(),
    });

    return res.json({ success: true, data: { status: 'APPROVED' } });
  }

  if (status === 'COMPLETED') {
    // Mark DESIGN station as COMPLETED
    await prisma.stationProgress.upsert({
      where: { orderId_station: { orderId: id, station: 'DESIGN' } },
      update: { status: 'COMPLETED', completedAt: new Date(), completedById: userId },
      create: { orderId: id, station: 'DESIGN', status: 'COMPLETED', completedAt: new Date(), completedById: userId },
    });

    broadcast({
      type: 'STATION_COMPLETED',
      payload: { orderId: id, orderNumber: order.orderNumber, station: 'DESIGN' },
      timestamp: new Date(),
    });

    return res.json({ success: true, data: { status: 'COMPLETED' } });
  }

  throw BadRequestError('Invalid proof status. Use SENT, APPROVED, or COMPLETED');
});

// ─── Line Item Station Completion ─────────────────────
ordersRouter.post('/:id/line-items/:lineItemId/station-complete', async (req: AuthRequest, res: Response) => {
  const { id, lineItemId } = req.params;
  const userId = req.userId!;
  const { station, completed } = req.body;

  // Verify line item belongs to this order
  const lineItem = await prisma.lineItem.findFirst({
    where: { id: lineItemId, orderId: id },
  });
  if (!lineItem) throw NotFoundError('Line item not found');

  // Upsert completion
  const completion = await prisma.lineItemCompletion.upsert({
    where: { lineItemId_station: { lineItemId, station } },
    update: {
      completed: completed !== false,
      completedAt: completed !== false ? new Date() : null,
      completedById: completed !== false ? userId : null,
    },
    create: {
      lineItemId,
      station,
      completed: completed !== false,
      completedAt: completed !== false ? new Date() : null,
      completedById: completed !== false ? userId : null,
    },
  });

  // Check if ALL line items for this order at this station are now completed
  const allLineItems = await prisma.lineItem.findMany({
    where: { orderId: id },
    select: { id: true },
  });
  const completions = await prisma.lineItemCompletion.findMany({
    where: {
      lineItemId: { in: allLineItems.map(li => li.id) },
      station,
      completed: true,
    },
  });

  const allCompleted = completions.length >= allLineItems.length;

  if (allCompleted) {
    // Auto-complete the station
    await prisma.stationProgress.upsert({
      where: { orderId_station: { orderId: id, station } },
      update: { status: 'COMPLETED', completedAt: new Date(), completedById: userId },
      create: { orderId: id, station, status: 'COMPLETED', completedAt: new Date(), completedById: userId },
    });

    broadcast({
      type: 'STATION_COMPLETED',
      payload: { orderId: id, station, autoCompleted: true },
      timestamp: new Date(),
    });
  }

  res.json({ success: true, data: { completion, allCompleted } });
});

// GET line item completions for an order
ordersRouter.get('/:id/line-items/completion', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const lineItems = await prisma.lineItem.findMany({
    where: { orderId: id },
    select: { id: true },
  });

  const completions = await prisma.lineItemCompletion.findMany({
    where: { lineItemId: { in: lineItems.map(li => li.id) } },
    include: { completedBy: { select: { displayName: true } } },
  });

  res.json({ success: true, data: completions });
});

// ─── Reprint Request ──────────────────────────────────
ordersRouter.post('/:id/reprint-request', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.userId!;
  const { reason, description, quantity, lineItemId, station } = req.body;

  if (!reason || !description) {
    throw BadRequestError('Reason and description are required');
  }

  const { createReprintRequest } = await import('../lib/station-flow.js');
  const reprint = await createReprintRequest({
    orderId: id,
    lineItemId,
    reason,
    description,
    quantity,
    userId,
    station,
  });

  res.json({ success: true, data: reprint });
});

// ─── Material Request ─────────────────────────────────
ordersRouter.post('/:id/material-request', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.userId!;
  const { description } = req.body;

  if (!description) {
    throw BadRequestError('Description is required');
  }

  const { createMaterialRequest } = await import('../lib/station-flow.js');
  await createMaterialRequest({ orderId: id, description, userId });

  res.json({ success: true, data: { message: 'Material request sent' } });
});

// ─── Shipping QC Checklist ────────────────────────────
ordersRouter.post('/:id/shipping-qc', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.userId!;
  const { checks } = req.body;
  // checks: Array<{ label: string; passed: boolean }>

  const order = await prisma.workOrder.findUnique({ where: { id }, select: { orderNumber: true } });
  if (!order) throw NotFoundError('Order not found');

  const allPassed = Array.isArray(checks) && checks.every((c: any) => c.passed);

  // Store as activity log with details (lightweight approach — no QC checklist model needed)
  await logActivity({
    action: 'QC_CHECK',
    entityType: EntityType.WORK_ORDER,
    entityId: id,
    entityName: order.orderNumber,
    description: allPassed ? 'Shipping QC passed' : 'Shipping QC incomplete',
    details: { checks, allPassed },
    userId,
  });

  res.json({ success: true, data: { allPassed, checks } });
});
