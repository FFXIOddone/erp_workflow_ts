/**
 * Dashboard Statistics Routes
 *
 * Aggregated homepage statistics with caching for performance:
 * - Order statistics (total, by status, recent)
 * - Customer statistics (active, new, top performers)
 * - Production statistics (in progress, completed today)
 * - Financial summaries (revenue, outstanding)
 * - Staff utilization
 * - Inventory alerts
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthRequest, authenticate } from '../middleware/auth.js';
import { prisma } from '../db/client.js';
import { OrderStatus, PrintingMethod, StationStatus, QCStatus } from '@prisma/client';
import { thriveService } from '../services/thrive.js';

export const dashboardStatsRouter = Router();

// ============================================================================
// TYPES & SCHEMAS
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface OrderStats {
  total: number;
  pending: number;
  inProgress: number;
  onHold: number;
  completed: number;
  shipped: number;
  cancelled: number;
  overdueCount: number;
  dueTodayCount: number;
  dueThisWeekCount: number;
  createdToday: number;
  createdThisWeek: number;
  createdThisMonth: number;
  averageCompletionDays: number | null;
}

interface CustomerStats {
  totalCustomers: number;
  activeCustomers: number;
  newThisMonth: number;
  withActiveOrders: number;
  onCreditHold: number;
  averageOrderValue: number | null;
  topCustomers: { id: string; name: string; orderCount: number; totalValue: number }[];
}

interface ProductionStats {
  ordersInProgress: number;
  completedToday: number;
  completedThisWeek: number;
  averageOrdersPerDay: number;
  stationWorkload: { station: string; count: number; percentage: number }[];
  bottleneckStations: { station: string; waitingCount: number }[];
}

interface FinancialStats {
  revenueToday: number;
  revenueThisWeek: number;
  revenueThisMonth: number;
  revenueThisYear: number;
  outstandingBalance: number;
  averageInvoiceValue: number | null;
  pendingQuotesValue: number;
  pendingQuotesCount: number;
}

interface StaffStats {
  totalUsers: number;
  activeToday: number;
  clockedInNow: number;
  hoursLoggedToday: number;
  hoursLoggedThisWeek: number;
  topPerformers: { userId: string; displayName: string; ordersCompleted: number; hoursWorked: number }[];
}

interface InventoryStats {
  totalItems: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalValue: number;
  lowStockItems: { id: string; sku: string; name: string; quantity: number; threshold?: number }[];
}

interface DashboardSummary {
  orderStats: OrderStats;
  customerStats: CustomerStats;
  productionStats: ProductionStats;
  financialStats: FinancialStats;
  staffStats: StaffStats;
  inventoryStats: InventoryStats;
  recentOrders: RecentOrder[];
  upcomingDeadlines: UpcomingDeadline[];
  systemHealth: SystemHealth;
  lastUpdated: Date;
}

interface RecentOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  status: string;
  priority: number;
  createdAt: Date;
  dueDate: Date | null;
}

interface UpcomingDeadline {
  id: string;
  orderNumber: string;
  customerName: string;
  dueDate: Date;
  daysUntilDue: number;
  status: string;
}

interface SystemHealth {
  databaseConnected: boolean;
  queuedEmailsCount: number;
  pendingWebhooksCount: number;
  lastActivityLogTimestamp: Date | null;
}

// Validation schemas
const StatsPeriodSchema = z.object({
  period: z.enum(['today', 'week', 'month', 'quarter', 'year']).default('month'),
});

const TopNSchema = z.object({
  limit: z.coerce.number().min(1).max(50).default(10),
});

// ============================================================================
// CACHE CONFIGURATION
// ============================================================================

const CACHE_TTL = 60 * 1000; // 1 minute in milliseconds
const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache<T>(key: string, data: T, ttl = CACHE_TTL): void {
  const now = Date.now();
  cache.set(key, {
    data,
    timestamp: now,
    expiresAt: now + ttl,
  });
}

function clearCache(): void {
  cache.clear();
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getStartOfDay(date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getEndOfDay(date = new Date()): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function getStartOfWeek(date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getStartOfMonth(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getStartOfYear(date = new Date()): Date {
  return new Date(date.getFullYear(), 0, 1);
}

function daysBetween(date1: Date, date2: Date): number {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round(Math.abs((date2.getTime() - date1.getTime()) / oneDay));
}

// ============================================================================
// STAT GENERATORS
// ============================================================================

async function generateOrderStats(): Promise<OrderStats> {
  const now = new Date();
  const startOfToday = getStartOfDay();
  const endOfToday = getEndOfDay();
  const startOfWeek = getStartOfWeek();
  const startOfMonth = getStartOfMonth();
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  const [
    statusCounts,
    overdueCount,
    dueTodayCount,
    dueThisWeekCount,
    createdToday,
    createdThisWeek,
    createdThisMonth,
    avgCompletionTime,
  ] = await Promise.all([
    // Count by status
    prisma.workOrder.groupBy({
      by: ['status'],
      _count: true,
    }),
    // Overdue orders
    prisma.workOrder.count({
      where: {
        dueDate: { lt: now },
        status: { notIn: [OrderStatus.COMPLETED, OrderStatus.SHIPPED, OrderStatus.CANCELLED] },
      },
    }),
    // Due today
    prisma.workOrder.count({
      where: {
        dueDate: { gte: startOfToday, lte: endOfToday },
        status: { notIn: [OrderStatus.COMPLETED, OrderStatus.SHIPPED, OrderStatus.CANCELLED] },
      },
    }),
    // Due this week
    prisma.workOrder.count({
      where: {
        dueDate: { gte: startOfWeek, lte: endOfWeek },
        status: { notIn: [OrderStatus.COMPLETED, OrderStatus.SHIPPED, OrderStatus.CANCELLED] },
      },
    }),
    // Created today
    prisma.workOrder.count({
      where: { createdAt: { gte: startOfToday } },
    }),
    // Created this week
    prisma.workOrder.count({
      where: { createdAt: { gte: startOfWeek } },
    }),
    // Created this month
    prisma.workOrder.count({
      where: { createdAt: { gte: startOfMonth } },
    }),
    // Average completion time (for orders completed in last 30 days)
    prisma.$queryRaw<{ avg_days: number | null }[]>`
      SELECT AVG(EXTRACT(EPOCH FROM (wo."updatedAt" - wo."createdAt")) / 86400) as avg_days
      FROM "WorkOrder" wo
      WHERE wo.status = 'COMPLETED'
        AND wo."updatedAt" >= NOW() - INTERVAL '30 days'
    `,
  ]);

  // Build status map
  const statusMap = new Map<OrderStatus, number>();
  for (const row of statusCounts) {
    statusMap.set(row.status, row._count);
  }

  const total = Array.from(statusMap.values()).reduce((sum, count) => sum + count, 0);

  return {
    total,
    pending: statusMap.get(OrderStatus.PENDING) || 0,
    inProgress: statusMap.get(OrderStatus.IN_PROGRESS) || 0,
    onHold: statusMap.get(OrderStatus.ON_HOLD) || 0,
    completed: statusMap.get(OrderStatus.COMPLETED) || 0,
    shipped: statusMap.get(OrderStatus.SHIPPED) || 0,
    cancelled: statusMap.get(OrderStatus.CANCELLED) || 0,
    overdueCount,
    dueTodayCount,
    dueThisWeekCount,
    createdToday,
    createdThisWeek,
    createdThisMonth,
    averageCompletionDays: avgCompletionTime[0]?.avg_days ?? null,
  };
}

async function generateCustomerStats(limit = 5): Promise<CustomerStats> {
  const startOfMonth = getStartOfMonth();

  const [
    totalCustomers,
    activeCustomers,
    newThisMonth,
    withActiveOrders,
    onCreditHold,
    avgOrderValue,
    topCustomersResult,
  ] = await Promise.all([
    prisma.customer.count(),
    prisma.customer.count({ where: { isActive: true } }),
    prisma.customer.count({
      where: { createdAt: { gte: startOfMonth } },
    }),
    prisma.customer.count({
      where: {
        workOrders: {
          some: {
            status: { in: [OrderStatus.PENDING, OrderStatus.IN_PROGRESS, OrderStatus.ON_HOLD] },
          },
        },
      },
    }),
    prisma.customer.count({ where: { isOnCreditHold: true } }),
    prisma.$queryRaw<{ avg_value: number | null }[]>`
      SELECT AVG(total_value) as avg_value
      FROM (
        SELECT wo."customerId", SUM(li.quantity * li."unitPrice") as total_value
        FROM "WorkOrder" wo
        JOIN "LineItem" li ON li."orderId" = wo.id
        WHERE wo."customerId" IS NOT NULL
        GROUP BY wo.id
      ) subq
    `,
    prisma.$queryRaw<{ id: string; name: string; order_count: number; total_value: number }[]>`
      SELECT 
        c.id,
        c.name,
        COUNT(DISTINCT wo.id)::int as order_count,
        COALESCE(SUM(li.quantity * li."unitPrice"), 0)::float as total_value
      FROM "Customer" c
      LEFT JOIN "WorkOrder" wo ON wo."customerId" = c.id
      LEFT JOIN "LineItem" li ON li."orderId" = wo.id
      GROUP BY c.id, c.name
      ORDER BY total_value DESC
      LIMIT ${limit}
    `,
  ]);

  return {
    totalCustomers,
    activeCustomers,
    newThisMonth,
    withActiveOrders,
    onCreditHold,
    averageOrderValue: avgOrderValue[0]?.avg_value ?? null,
    topCustomers: topCustomersResult.map((c) => ({
      id: c.id,
      name: c.name,
      orderCount: c.order_count,
      totalValue: Number(c.total_value),
    })),
  };
}

async function generateProductionStats(): Promise<ProductionStats> {
  const startOfToday = getStartOfDay();
  const startOfWeek = getStartOfWeek();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [ordersInProgress, completedToday, completedThisWeek, completedLast30Days, stationWorkload] =
    await Promise.all([
      prisma.workOrder.count({
        where: { status: OrderStatus.IN_PROGRESS },
      }),
      prisma.workOrder.count({
        where: {
          status: OrderStatus.COMPLETED,
          updatedAt: { gte: startOfToday },
        },
      }),
      prisma.workOrder.count({
        where: {
          status: OrderStatus.COMPLETED,
          updatedAt: { gte: startOfWeek },
        },
      }),
      prisma.workOrder.count({
        where: {
          status: OrderStatus.COMPLETED,
          updatedAt: { gte: thirtyDaysAgo },
        },
      }),
      // Station workload (orders with each station in routing that are in progress)
      prisma.$queryRaw<{ station: string; count: number }[]>`
        SELECT 
          unnest(wo.routing) as station,
          COUNT(*)::int as count
        FROM "WorkOrder" wo
        WHERE wo.status = 'IN_PROGRESS'
        GROUP BY station
        ORDER BY count DESC
      `,
    ]);

  const totalStationWork = stationWorkload.reduce((sum, s) => sum + Number(s.count), 0);
  const formattedStationWorkload = stationWorkload.map((s) => ({
    station: s.station,
    count: Number(s.count),
    percentage: totalStationWork > 0 ? (Number(s.count) / totalStationWork) * 100 : 0,
  }));

  // Find bottleneck stations (stations with most waiting orders)
  const bottleneckStations = await prisma.$queryRaw<{ station: string; waiting_count: number }[]>`
    SELECT 
      sp.station::text as station,
      COUNT(*)::int as waiting_count
    FROM "StationProgress" sp
    JOIN "WorkOrder" wo ON wo.id = sp."orderId"
    WHERE sp."isCompleted" = false
      AND wo.status = 'IN_PROGRESS'
    GROUP BY sp.station
    ORDER BY waiting_count DESC
    LIMIT 5
  `;

  return {
    ordersInProgress,
    completedToday,
    completedThisWeek,
    averageOrdersPerDay: completedLast30Days / 30,
    stationWorkload: formattedStationWorkload,
    bottleneckStations: bottleneckStations.map((b) => ({
      station: b.station,
      waitingCount: Number(b.waiting_count),
    })),
  };
}

async function generateFinancialStats(): Promise<FinancialStats> {
  const startOfToday = getStartOfDay();
  const startOfWeek = getStartOfWeek();
  const startOfMonth = getStartOfMonth();
  const startOfYear = getStartOfYear();

  const [revenueStats, outstandingBalance, pendingQuotes] = await Promise.all([
    // Revenue by period (from completed orders)
    prisma.$queryRaw<
      { today: number; week: number; month: number; year: number; avg_invoice: number | null }[]
    >`
      SELECT
        COALESCE(SUM(CASE WHEN wo."updatedAt" >= ${startOfToday} THEN li.quantity * li."unitPrice" ELSE 0 END), 0)::float as today,
        COALESCE(SUM(CASE WHEN wo."updatedAt" >= ${startOfWeek} THEN li.quantity * li."unitPrice" ELSE 0 END), 0)::float as week,
        COALESCE(SUM(CASE WHEN wo."updatedAt" >= ${startOfMonth} THEN li.quantity * li."unitPrice" ELSE 0 END), 0)::float as month,
        COALESCE(SUM(CASE WHEN wo."updatedAt" >= ${startOfYear} THEN li.quantity * li."unitPrice" ELSE 0 END), 0)::float as year,
        AVG(order_total.total)::float as avg_invoice
      FROM "WorkOrder" wo
      JOIN "LineItem" li ON li."orderId" = wo.id
      LEFT JOIN LATERAL (
        SELECT SUM(li2.quantity * li2."unitPrice") as total
        FROM "LineItem" li2
        WHERE li2."orderId" = wo.id
      ) order_total ON true
      WHERE wo.status IN ('COMPLETED', 'SHIPPED')
    `,
    // Outstanding customer balance
    prisma.customer.aggregate({
      _sum: { currentBalance: true },
      where: {
        currentBalance: { gt: 0 },
      },
    }),
    // Pending quotes value and count
    prisma.$queryRaw<{ count: number; total_value: number }[]>`
      SELECT 
        COUNT(DISTINCT q.id)::int as count,
        COALESCE(SUM(qli.quantity * qli."unitPrice"), 0)::float as total_value
      FROM "Quote" q
      JOIN "QuoteLineItem" qli ON qli."quoteId" = q.id
      WHERE q.status IN ('DRAFT', 'SENT')
    `,
  ]);

  const revenue = revenueStats[0] || { today: 0, week: 0, month: 0, year: 0, avg_invoice: null };

  return {
    revenueToday: Number(revenue.today),
    revenueThisWeek: Number(revenue.week),
    revenueThisMonth: Number(revenue.month),
    revenueThisYear: Number(revenue.year),
    outstandingBalance: Number(outstandingBalance._sum.currentBalance || 0),
    averageInvoiceValue: revenue.avg_invoice ? Number(revenue.avg_invoice) : null,
    pendingQuotesValue: Number(pendingQuotes[0]?.total_value || 0),
    pendingQuotesCount: Number(pendingQuotes[0]?.count || 0),
  };
}

async function generateStaffStats(limit = 5): Promise<StaffStats> {
  const startOfToday = getStartOfDay();
  const startOfWeek = getStartOfWeek();

  const [totalUsers, activeToday, clockedInNow, hoursToday, hoursThisWeek, topPerformers] =
    await Promise.all([
      prisma.user.count({ where: { isActive: true } }),
      // Users with activity today
      prisma.$queryRaw<{ count: number }[]>`
        SELECT COUNT(DISTINCT te."userId")::int as count
        FROM "TimeEntry" te
        WHERE te."startTime" >= ${startOfToday}
      `,
      // Currently clocked in (no end time)
      prisma.timeEntry.count({
        where: { endTime: null },
      }),
      // Hours logged today
      prisma.$queryRaw<{ hours: number }[]>`
        SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(te."endTime", NOW()) - te."startTime")) / 3600), 0)::float as hours
        FROM "TimeEntry" te
        WHERE te."startTime" >= ${startOfToday}
      `,
      // Hours logged this week
      prisma.$queryRaw<{ hours: number }[]>`
        SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(te."endTime", NOW()) - te."startTime")) / 3600), 0)::float as hours
        FROM "TimeEntry" te
        WHERE te."startTime" >= ${startOfWeek}
      `,
      // Top performers (by orders completed + hours)
      prisma.$queryRaw<
        { user_id: string; display_name: string; orders_completed: number; hours_worked: number }[]
      >`
        SELECT 
          u.id as user_id,
          u."displayName" as display_name,
          COUNT(DISTINCT sp."orderId")::int as orders_completed,
          COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(te."endTime", NOW()) - te."startTime")) / 3600), 0)::float as hours_worked
        FROM "User" u
        LEFT JOIN "StationProgress" sp ON sp."completedById" = u.id AND sp."completedAt" >= ${startOfWeek}
        LEFT JOIN "TimeEntry" te ON te."userId" = u.id AND te."startTime" >= ${startOfWeek}
        WHERE u."isActive" = true
        GROUP BY u.id, u."displayName"
        HAVING COUNT(DISTINCT sp."orderId") > 0 OR SUM(EXTRACT(EPOCH FROM (COALESCE(te."endTime", NOW()) - te."startTime"))) > 0
        ORDER BY orders_completed DESC, hours_worked DESC
        LIMIT ${limit}
      `,
    ]);

  return {
    totalUsers,
    activeToday: Number(activeToday[0]?.count || 0),
    clockedInNow,
    hoursLoggedToday: Number(hoursToday[0]?.hours || 0),
    hoursLoggedThisWeek: Number(hoursThisWeek[0]?.hours || 0),
    topPerformers: topPerformers.map((p) => ({
      userId: p.user_id,
      displayName: p.display_name,
      ordersCompleted: Number(p.orders_completed),
      hoursWorked: Number(p.hours_worked),
    })),
  };
}

async function generateInventoryStats(limit = 10): Promise<InventoryStats> {
  const LOW_STOCK_THRESHOLD = 10; // Default threshold

  const [totalItems, lowStockCount, outOfStockCount, totalValue, lowStockItems] = await Promise.all([
    prisma.itemMaster.count({ where: { isActive: true } }),
    // Low stock (assuming threshold of 10 for now)
    prisma.$queryRaw<{ count: number }[]>`
      SELECT COUNT(DISTINCT im.id)::int as count
      FROM "ItemMaster" im
      JOIN "InventoryItem" ii ON ii."itemMasterId" = im.id
      WHERE im."isActive" = true
        AND ii.quantity > 0
        AND ii.quantity <= ${LOW_STOCK_THRESHOLD}
    `,
    // Out of stock
    prisma.$queryRaw<{ count: number }[]>`
      SELECT COUNT(DISTINCT im.id)::int as count
      FROM "ItemMaster" im
      LEFT JOIN "InventoryItem" ii ON ii."itemMasterId" = im.id
      WHERE im."isActive" = true
        AND (ii.id IS NULL OR ii.quantity = 0)
    `,
    // Total inventory value
    prisma.$queryRaw<{ total: number }[]>`
      SELECT COALESCE(SUM(ii.quantity * COALESCE(im."costPrice", im."unitPrice")), 0)::float as total
      FROM "InventoryItem" ii
      JOIN "ItemMaster" im ON im.id = ii."itemMasterId"
      WHERE im."isActive" = true
    `,
    // Low stock items list
    prisma.$queryRaw<{ id: string; sku: string; name: string; quantity: number }[]>`
      SELECT 
        im.id,
        im.sku,
        im.name,
        COALESCE(SUM(ii.quantity), 0)::int as quantity
      FROM "ItemMaster" im
      LEFT JOIN "InventoryItem" ii ON ii."itemMasterId" = im.id
      WHERE im."isActive" = true
      GROUP BY im.id, im.sku, im.name
      HAVING COALESCE(SUM(ii.quantity), 0) <= ${LOW_STOCK_THRESHOLD}
      ORDER BY quantity ASC
      LIMIT ${limit}
    `,
  ]);

  return {
    totalItems,
    lowStockCount: Number(lowStockCount[0]?.count || 0),
    outOfStockCount: Number(outOfStockCount[0]?.count || 0),
    totalValue: Number(totalValue[0]?.total || 0),
    lowStockItems: lowStockItems.map((item) => ({
      id: item.id,
      sku: item.sku,
      name: item.name,
      quantity: Number(item.quantity),
    })),
  };
}

async function getRecentOrders(limit = 10): Promise<RecentOrder[]> {
  const orders = await prisma.workOrder.findMany({
    take: limit,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      status: true,
      priority: true,
      createdAt: true,
      dueDate: true,
    },
  });

  return orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    customerName: o.customerName,
    status: o.status,
    priority: o.priority,
    createdAt: o.createdAt,
    dueDate: o.dueDate,
  }));
}

async function getUpcomingDeadlines(limit = 10): Promise<UpcomingDeadline[]> {
  const now = new Date();
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);

  const orders = await prisma.workOrder.findMany({
    where: {
      dueDate: { gte: now, lte: nextWeek },
      status: { notIn: [OrderStatus.COMPLETED, OrderStatus.SHIPPED, OrderStatus.CANCELLED] },
    },
    orderBy: { dueDate: 'asc' },
    take: limit,
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      dueDate: true,
      status: true,
    },
  });

  return orders
    .filter((o) => o.dueDate !== null)
    .map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: o.customerName,
      dueDate: o.dueDate!,
      daysUntilDue: daysBetween(now, o.dueDate!),
      status: o.status,
    }));
}

async function getSystemHealth(): Promise<SystemHealth> {
  const [queuedEmails, pendingWebhooks, lastActivity] = await Promise.all([
    prisma.emailQueue.count({ where: { status: 'PENDING' } }),
    prisma.$queryRaw<{ count: number }[]>`
      SELECT COUNT(*)::int as count
      FROM "WebhookDelivery"
      WHERE status = 'PENDING' OR status = 'FAILED'
    `.catch(() => [{ count: 0 }]),
    prisma.activityLog.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
  ]);

  return {
    databaseConnected: true,
    queuedEmailsCount: queuedEmails,
    pendingWebhooksCount: Number(pendingWebhooks[0]?.count || 0),
    lastActivityLogTimestamp: lastActivity?.createdAt || null,
  };
}

// ============================================================================
// ROUTES
// ============================================================================

// All routes require authentication
dashboardStatsRouter.use(authenticate);

// --------------------------------------------------------------------------
// GET /dashboard-stats - Full dashboard summary (cached)
// --------------------------------------------------------------------------
dashboardStatsRouter.get('/', async (_req: AuthRequest, res: Response) => {
  const cacheKey = 'dashboard-summary';
  const cached = getCached<DashboardSummary>(cacheKey);

  if (cached) {
    res.json({
      success: true,
      data: cached,
      cached: true,
    });
    return;
  }

  // Generate all stats in parallel
  const [
    orderStats,
    customerStats,
    productionStats,
    financialStats,
    staffStats,
    inventoryStats,
    recentOrders,
    upcomingDeadlines,
    systemHealth,
  ] = await Promise.all([
    generateOrderStats(),
    generateCustomerStats(),
    generateProductionStats(),
    generateFinancialStats(),
    generateStaffStats(),
    generateInventoryStats(),
    getRecentOrders(),
    getUpcomingDeadlines(),
    getSystemHealth(),
  ]);

  const summary: DashboardSummary = {
    orderStats,
    customerStats,
    productionStats,
    financialStats,
    staffStats,
    inventoryStats,
    recentOrders,
    upcomingDeadlines,
    systemHealth,
    lastUpdated: new Date(),
  };

  setCache(cacheKey, summary);

  res.json({
    success: true,
    data: summary,
    cached: false,
  });
});

// --------------------------------------------------------------------------
// GET /dashboard-stats/orders - Order statistics only
// --------------------------------------------------------------------------
dashboardStatsRouter.get('/orders', async (_req: AuthRequest, res: Response) => {
  const cacheKey = 'stats-orders';
  const cached = getCached<OrderStats>(cacheKey);

  if (cached) {
    res.json({ success: true, data: cached, cached: true });
    return;
  }

  const stats = await generateOrderStats();
  setCache(cacheKey, stats);

  res.json({ success: true, data: stats, cached: false });
});

// --------------------------------------------------------------------------
// GET /dashboard-stats/customers - Customer statistics only
// --------------------------------------------------------------------------
dashboardStatsRouter.get('/customers', async (req: AuthRequest, res: Response) => {
  const { limit } = TopNSchema.parse(req.query);
  const cacheKey = `stats-customers-${limit}`;
  const cached = getCached<CustomerStats>(cacheKey);

  if (cached) {
    res.json({ success: true, data: cached, cached: true });
    return;
  }

  const stats = await generateCustomerStats(limit);
  setCache(cacheKey, stats);

  res.json({ success: true, data: stats, cached: false });
});

// --------------------------------------------------------------------------
// GET /dashboard-stats/production - Production statistics only
// --------------------------------------------------------------------------
dashboardStatsRouter.get('/production', async (_req: AuthRequest, res: Response) => {
  const cacheKey = 'stats-production';
  const cached = getCached<ProductionStats>(cacheKey);

  if (cached) {
    res.json({ success: true, data: cached, cached: true });
    return;
  }

  const stats = await generateProductionStats();
  setCache(cacheKey, stats);

  res.json({ success: true, data: stats, cached: false });
});

// --------------------------------------------------------------------------
// GET /dashboard-stats/financial - Financial statistics only
// --------------------------------------------------------------------------
dashboardStatsRouter.get('/financial', async (_req: AuthRequest, res: Response) => {
  const cacheKey = 'stats-financial';
  const cached = getCached<FinancialStats>(cacheKey);

  if (cached) {
    res.json({ success: true, data: cached, cached: true });
    return;
  }

  const stats = await generateFinancialStats();
  setCache(cacheKey, stats);

  res.json({ success: true, data: stats, cached: false });
});

// --------------------------------------------------------------------------
// GET /dashboard-stats/staff - Staff/user statistics only
// --------------------------------------------------------------------------
dashboardStatsRouter.get('/staff', async (req: AuthRequest, res: Response) => {
  const { limit } = TopNSchema.parse(req.query);
  const cacheKey = `stats-staff-${limit}`;
  const cached = getCached<StaffStats>(cacheKey);

  if (cached) {
    res.json({ success: true, data: cached, cached: true });
    return;
  }

  const stats = await generateStaffStats(limit);
  setCache(cacheKey, stats);

  res.json({ success: true, data: stats, cached: false });
});

// --------------------------------------------------------------------------
// GET /dashboard-stats/inventory - Inventory statistics only
// --------------------------------------------------------------------------
dashboardStatsRouter.get('/inventory', async (req: AuthRequest, res: Response) => {
  const { limit } = TopNSchema.parse(req.query);
  const cacheKey = `stats-inventory-${limit}`;
  const cached = getCached<InventoryStats>(cacheKey);

  if (cached) {
    res.json({ success: true, data: cached, cached: true });
    return;
  }

  const stats = await generateInventoryStats(limit);
  setCache(cacheKey, stats);

  res.json({ success: true, data: stats, cached: false });
});

// --------------------------------------------------------------------------
// GET /dashboard-stats/recent-orders - Recent orders list
// --------------------------------------------------------------------------
dashboardStatsRouter.get('/recent-orders', async (req: AuthRequest, res: Response) => {
  const { limit } = TopNSchema.parse(req.query);
  const cacheKey = `recent-orders-${limit}`;
  const cached = getCached<RecentOrder[]>(cacheKey);

  if (cached) {
    res.json({ success: true, data: cached, cached: true });
    return;
  }

  const orders = await getRecentOrders(limit);
  setCache(cacheKey, orders);

  res.json({ success: true, data: orders, cached: false });
});

// --------------------------------------------------------------------------
// GET /dashboard-stats/deadlines - Upcoming deadlines
// --------------------------------------------------------------------------
dashboardStatsRouter.get('/deadlines', async (req: AuthRequest, res: Response) => {
  const { limit } = TopNSchema.parse(req.query);
  const cacheKey = `deadlines-${limit}`;
  const cached = getCached<UpcomingDeadline[]>(cacheKey);

  if (cached) {
    res.json({ success: true, data: cached, cached: true });
    return;
  }

  const deadlines = await getUpcomingDeadlines(limit);
  setCache(cacheKey, deadlines);

  res.json({ success: true, data: deadlines, cached: false });
});

// --------------------------------------------------------------------------
// GET /dashboard-stats/health - System health check
// --------------------------------------------------------------------------
dashboardStatsRouter.get('/health', async (_req: AuthRequest, res: Response) => {
  // No caching for health checks
  const health = await getSystemHealth();

  res.json({ success: true, data: health });
});

// --------------------------------------------------------------------------
// POST /dashboard-stats/refresh - Clear cache and regenerate
// --------------------------------------------------------------------------
dashboardStatsRouter.post('/refresh', async (_req: AuthRequest, res: Response) => {
  clearCache();

  // Regenerate full summary
  const [
    orderStats,
    customerStats,
    productionStats,
    financialStats,
    staffStats,
    inventoryStats,
    recentOrders,
    upcomingDeadlines,
    systemHealth,
  ] = await Promise.all([
    generateOrderStats(),
    generateCustomerStats(),
    generateProductionStats(),
    generateFinancialStats(),
    generateStaffStats(),
    generateInventoryStats(),
    getRecentOrders(),
    getUpcomingDeadlines(),
    getSystemHealth(),
  ]);

  const summary: DashboardSummary = {
    orderStats,
    customerStats,
    productionStats,
    financialStats,
    staffStats,
    inventoryStats,
    recentOrders,
    upcomingDeadlines,
    systemHealth,
    lastUpdated: new Date(),
  };

  setCache('dashboard-summary', summary);

  res.json({
    success: true,
    message: 'Dashboard cache refreshed',
    data: summary,
  });
});

// ============================================================================
// LIVE PRODUCTION DASHBOARD ENDPOINTS
// ============================================================================

// --------------------------------------------------------------------------
// GET /dashboard-stats/production-feeds - Per-station live feeds
// --------------------------------------------------------------------------
dashboardStatsRouter.get('/production-feeds', async (_req: AuthRequest, res: Response) => {
  try {
    const cacheKey = 'production-feeds';
    const cached = getCached<any[]>(cacheKey);
    if (cached) {
      res.json({ success: true, data: cached, cached: true });
      return;
    }

    const startOfToday = getStartOfDay();

    // Get all station progress data with related order + user info
    const [activeProgress, completedToday, queuedCounts, thriveData] = await Promise.all([
      // Active (IN_PROGRESS) jobs per station
      prisma.stationProgress.findMany({
        where: { status: 'IN_PROGRESS' },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              customerName: true,
              description: true,
              priority: true,
              dueDate: true,
              status: true,
              createdAt: true,
              updatedAt: true,
            },
          },
          completedBy: {
            select: { id: true, displayName: true },
          },
        },
      }),
      // Completed today per station
      prisma.$queryRaw<{ station: string; count: number }[]>`
        SELECT sp.station::text as station, COUNT(*)::int as count
        FROM "StationProgress" sp
        WHERE sp.status = 'COMPLETED'
          AND sp."completedAt" >= ${startOfToday}
        GROUP BY sp.station
      `.catch(() => [] as { station: string; count: number }[]),
      // Queued (NOT_STARTED) per station on IN_PROGRESS orders
      prisma.$queryRaw<{ station: string; count: number }[]>`
        SELECT sp.station::text as station, COUNT(*)::int as count
        FROM "StationProgress" sp
        JOIN "WorkOrder" wo ON wo.id = sp."orderId"
        WHERE sp.status = 'NOT_STARTED'
          AND wo.status IN ('PENDING', 'IN_PROGRESS')
        GROUP BY sp.station
      `,
      // Thrive RIP data (best-effort)
      thriveService.getAllJobs().catch(() => ({ printJobs: [], cutJobs: [] })),
    ]);

    // Build maps
    const completedMap = new Map<string, number>();
    for (const row of completedToday) {
      completedMap.set(row.station, (completedMap.get(row.station) || 0) + Number(row.count));
    }

    const queuedMap = new Map<string, number>();
    for (const row of queuedCounts) {
      queuedMap.set(row.station, Number(row.count));
    }

    // Average completion time per station (last 30 days)
    const avgTimes = await prisma.$queryRaw<{ station: string; avg_minutes: number }[]>`
      SELECT 
        sp.station::text as station,
        COALESCE(AVG(EXTRACT(EPOCH FROM (sp."completedAt" - sp."startedAt")) / 60), 0)::float as avg_minutes
      FROM "StationProgress" sp
      WHERE sp.status = 'COMPLETED'
        AND sp."startedAt" IS NOT NULL
        AND sp."completedAt" IS NOT NULL
        AND sp."completedAt" >= NOW() - INTERVAL '30 days'
      GROUP BY sp.station
    `.catch(() => [] as { station: string; avg_minutes: number }[]);

    const avgTimeMap = new Map<string, number>();
    for (const row of avgTimes) {
      avgTimeMap.set(row.station, Math.round(Number(row.avg_minutes)));
    }

    // Users currently assigned (have IN_PROGRESS station work)
    const claimedStations = await prisma.$queryRaw<{ station: string; user_id: string; display_name: string }[]>`
      SELECT DISTINCT sp.station::text as station, u.id as user_id, u."displayName" as display_name
      FROM "StationProgress" sp
      JOIN "WorkOrder" wo ON wo.id = sp."orderId"
      LEFT JOIN "User" u ON u.id = sp."completedById"
      WHERE sp.status = 'IN_PROGRESS'
        AND sp."completedById" IS NOT NULL
      LIMIT 50
    `.catch(() => [] as { station: string; user_id: string; display_name: string }[]);

    const operatorMap = new Map<string, { id: string; displayName: string; initials: string }>();
    for (const row of claimedStations) {
      if (row.user_id && !operatorMap.has(row.station)) {
        const initials = row.display_name
          .split(' ')
          .map((n: string) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2);
        operatorMap.set(row.station, {
          id: row.user_id,
          displayName: row.display_name,
          initials,
        });
      }
    }

    // Map Thrive print jobs by station for enrichment + inject as active jobs
    const thriveByStation = new Map<string, number>();
    const thriveJobsByStation = new Map<string, any[]>();
    
    // Link Thrive jobs to work orders for richer data
    const linkedThriveJobs = await thriveService.linkJobsToWorkOrders(thriveData.printJobs).catch(() => []);
    
    for (const { job, workOrder } of linkedThriveJobs) {
      // Determine station from the printer config
      let station: string | null = null;
      for (const machine of thriveService.config.machines) {
        const printerConfig = machine.printers.find(
          (p) => p.name.toLowerCase() === job.printer.toLowerCase(),
        );
        if (printerConfig) {
          station = printerConfig.printingMethod;
          break;
        }
      }
      if (!station) continue;

      thriveByStation.set(station, (thriveByStation.get(station) || 0) + 1);

      // Only inject jobs that are actively printing or processing (not already printed)
      if (job.statusCode < 32) {
        const thriveJobs = thriveJobsByStation.get(station) || [];

        // Build a proper ISO timestamp from Thrive date + time strings
        // createDate is like "2/24/2026", createTime is like "10:55:27"
        let thriveStartedAt: string;
        const timeStr = job.processStartTime || job.createTime;
        const dateStr = job.createDate;
        if (dateStr && timeStr) {
          // Parse createDate (M/D/YYYY) and combine with time
          const parsed = new Date(`${dateStr} ${timeStr}`);
          thriveStartedAt = isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
        } else if (timeStr && /^\d{1,2}:\d{2}/.test(timeStr)) {
          // Time-only: prepend today's date
          const today = new Date().toISOString().split('T')[0];
          const parsed = new Date(`${today}T${timeStr}`);
          thriveStartedAt = isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
        } else {
          thriveStartedAt = timeStr || new Date().toISOString();
        }

        thriveJobs.push({
          id: `thrive-${job.jobGuid}`,
          orderId: workOrder?.id || '',
          orderNumber: workOrder?.orderNumber || (job.workOrderNumber ? `WO${job.workOrderNumber}` : job.jobName),
          customerName: workOrder?.customerName || job.customerName || 'Unknown',
          description: `${job.printer}: ${job.status} — ${job.jobDescription || job.jobName}`,
          priority: 3,
          startedAt: thriveStartedAt,
          estimatedMinutes: null,
          percentComplete: job.statusCode === 16 ? 50 : job.statusCode === 8 ? 10 : 0,
          assignedTo: null,
        });
        thriveJobsByStation.set(station, thriveJobs);
      }
    }

    // Get all station names from the PrintingMethod enum
    const allStations = Object.values(PrintingMethod);

    // Display name mapping
    const STATION_NAMES: Record<string, string> = {
      ROLL_TO_ROLL: 'Roll to Roll',
      SCREEN_PRINT: 'Screen Print',
      FLATBED: 'Flatbed',
      DESIGN: 'Design',
      PRODUCTION: 'Production',
      INSTALLATION: 'Installation',
      SALES: 'Sales',
      ORDER_ENTRY: 'Order Entry',
      SHIPPING_RECEIVING: 'Shipping & Receiving',
      WIDE_FORMAT: 'Wide Format',
      CUT: 'Cut',
      FABRICATION: 'Fabrication',
      PAINT: 'Paint',
      ELECTRICAL: 'Electrical',
    };

    const feeds = allStations.map((station) => {
      const stationStr = station as string;
      const erpActiveJobs = activeProgress
        .filter((sp) => sp.station === station)
        .map((sp) => ({
          id: sp.id,
          orderId: sp.order.id,
          orderNumber: sp.order.orderNumber,
          customerName: sp.order.customerName,
          description: sp.order.description || '',
          priority: sp.order.priority,
          startedAt: sp.startedAt?.toISOString() || sp.order.updatedAt?.toISOString() || sp.order.createdAt?.toISOString() || new Date().toISOString(),
          estimatedMinutes: null,
          percentComplete: 0,
          assignedTo: sp.completedBy
            ? {
                id: sp.completedBy.id,
                displayName: sp.completedBy.displayName,
                initials: sp.completedBy.displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2),
              }
            : null,
        }));

      // Merge Thrive RIP jobs that aren't already represented by ERP station progress
      const thriveJobs = thriveJobsByStation.get(stationStr) || [];
      const erpOrderIds = new Set(erpActiveJobs.map((j) => j.orderId));
      const uniqueThriveJobs = thriveJobs.filter((tj) => !tj.orderId || !erpOrderIds.has(tj.orderId));
      const activeJobs = [...erpActiveJobs, ...uniqueThriveJobs];

      const completed = completedMap.get(stationStr) || 0;
      const queued = queuedMap.get(stationStr) || 0;
      const avgTime = avgTimeMap.get(stationStr) || 0;
      const operator = operatorMap.get(stationStr) || null;
      const thriveActive = thriveByStation.get(stationStr) || 0;

      // Station status
      let status: 'active' | 'idle' | 'offline' = 'idle';
      if (activeJobs.length > 0 || thriveActive > 0) {
        status = 'active';
      }

      // Efficiency: completed / (completed + queued + active) * 100
      const totalWork = completed + queued + activeJobs.length;
      const efficiency = totalWork > 0 ? Math.round((completed / totalWork) * 100) : 0;

      return {
        station: stationStr,
        displayName: STATION_NAMES[stationStr] || stationStr,
        activeJobs,
        queuedJobs: queued,
        completedToday: completed,
        averageTimeMinutes: avgTime,
        currentOperator: operator,
        status,
        efficiency,
        lastActivity: activeJobs.length > 0 ? activeJobs[0].startedAt : null,
        thriveActiveJobs: thriveActive, // Bonus: RIP jobs currently processing
      };
    });

    // Filter out stations with no data at all (never used)
    const activeFeeds = feeds.filter(
      (f) => f.activeJobs.length > 0 || f.queuedJobs > 0 || f.completedToday > 0 || f.thriveActiveJobs > 0,
    );

    // If all stations are empty, return all stations so the UI isn't blank
    const result = activeFeeds.length > 0 ? activeFeeds : feeds;

    setCache(cacheKey, result, 5000); // 5s cache for near-real-time

    res.json({ success: true, data: result, cached: false });
  } catch (error) {
    console.error('Error generating production feeds:', error);
    res.status(500).json({ success: false, error: 'Failed to generate production feeds' });
  }
});

// --------------------------------------------------------------------------
// GET /dashboard-stats/production-summary - Aggregate production stats
// --------------------------------------------------------------------------
dashboardStatsRouter.get('/production-summary', async (_req: AuthRequest, res: Response) => {
  try {
    const cacheKey = 'production-summary';
    const cached = getCached<any>(cacheKey);
    if (cached) {
      res.json({ success: true, data: cached, cached: true });
      return;
    }

    const startOfToday = getStartOfDay();
    const now = new Date();

    const [
      totalActive,
      totalQueued,
      completedToday,
      activeOperators,
      onTimeRate,
      avgCycleTime,
      bottleneck,
    ] = await Promise.all([
      // Total active (IN_PROGRESS) station items
      prisma.stationProgress.count({
        where: { status: 'IN_PROGRESS' },
      }),
      // Total queued (NOT_STARTED on active orders)
      prisma.stationProgress.count({
        where: {
          status: 'NOT_STARTED',
          order: {
            status: { in: [OrderStatus.PENDING, OrderStatus.IN_PROGRESS] },
          },
        },
      }),
      // Completed today
      prisma.stationProgress.count({
        where: {
          status: 'COMPLETED',
          completedAt: { gte: startOfToday },
        },
      }),
      // Active operators (users with IN_PROGRESS station claims)
      prisma.$queryRaw<{ count: number }[]>`
        SELECT COUNT(DISTINCT sp."completedById")::int as count
        FROM "StationProgress" sp
        WHERE sp.status = 'IN_PROGRESS'
          AND sp."completedById" IS NOT NULL
      `.then((r) => Number(r[0]?.count || 0)),
      // On-time delivery rate (last 30 days)
      prisma.$queryRaw<{ rate: number }[]>`
        SELECT 
          CASE 
            WHEN COUNT(*) = 0 THEN 100
            ELSE (COUNT(*) FILTER (WHERE wo."updatedAt" <= wo."dueDate" OR wo."dueDate" IS NULL)::float / COUNT(*)::float * 100)
          END as rate
        FROM "WorkOrder" wo
        WHERE wo.status IN ('COMPLETED', 'SHIPPED')
          AND wo."updatedAt" >= NOW() - INTERVAL '30 days'
      `.then((r) => Number(r[0]?.rate || 0)),
      // Average cycle time in minutes (start → complete, last 30 days)
      prisma.$queryRaw<{ avg_minutes: number }[]>`
        SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (sp."completedAt" - sp."startedAt")) / 60), 0)::float as avg_minutes
        FROM "StationProgress" sp
        WHERE sp.status = 'COMPLETED'
          AND sp."startedAt" IS NOT NULL
          AND sp."completedAt" IS NOT NULL
          AND sp."completedAt" >= NOW() - INTERVAL '30 days'
      `.then((r) => Number(r[0]?.avg_minutes || 0)),
      // Bottleneck station (most queued)
      prisma.$queryRaw<{ station: string; count: number }[]>`
        SELECT sp.station::text as station, COUNT(*)::int as count
        FROM "StationProgress" sp
        JOIN "WorkOrder" wo ON wo.id = sp."orderId"
        WHERE sp.status = 'NOT_STARTED'
          AND wo.status IN ('PENDING', 'IN_PROGRESS')
        GROUP BY sp.station
        ORDER BY count DESC
        LIMIT 1
      `.then((r) => r[0]?.station || null),
    ]);

    // Throughput per hour (completed today / hours elapsed today)
    const hoursElapsed = Math.max(1, (now.getTime() - startOfToday.getTime()) / 3600000);
    const throughputPerHour = completedToday / hoursElapsed;

    const summary = {
      totalActiveJobs: totalActive,
      totalQueuedJobs: totalQueued,
      completedToday,
      onTimeDeliveryRate: Math.round(onTimeRate * 10) / 10,
      activeOperators,
      bottleneckStation: bottleneck,
      avgCycleTimeMinutes: Math.round(avgCycleTime),
      throughputPerHour: Math.round(throughputPerHour * 10) / 10,
    };

    setCache(cacheKey, summary, 10000); // 10s cache

    res.json({ success: true, data: summary, cached: false });
  } catch (error) {
    console.error('Error generating production summary:', error);
    res.status(500).json({ success: false, error: 'Failed to generate production summary' });
  }
});

// --------------------------------------------------------------------------
// GET /dashboard-stats/quality-metrics - QC pass rates by station
// --------------------------------------------------------------------------
dashboardStatsRouter.get('/quality-metrics', async (_req: AuthRequest, res: Response) => {
  try {
    const cacheKey = 'quality-metrics';
    const cached = getCached<any[]>(cacheKey);
    if (cached) {
      res.json({ success: true, data: cached, cached: true });
      return;
    }

    // QC inspections by station in the last 30 days
    const recentMetrics = await prisma.$queryRaw<{
      station: string;
      total: number;
      passed: number;
      failed: number;
    }[]>`
      SELECT 
        qi.station::text as station,
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE qi.status IN ('PASSED', 'PASSED_WITH_NOTES'))::int as passed,
        COUNT(*) FILTER (WHERE qi.status IN ('FAILED', 'NEEDS_REWORK'))::int as failed
      FROM "QCInspection" qi
      WHERE qi.station IS NOT NULL
        AND qi."inspectedAt" >= NOW() - INTERVAL '30 days'
      GROUP BY qi.station
      ORDER BY total DESC
    `.catch(() => [] as { station: string; total: number; passed: number; failed: number }[]);

    // Also get defect counts
    const defectCounts = await prisma.$queryRaw<{ station: string; defect_count: number }[]>`
      SELECT 
        qi.station::text as station,
        COUNT(d.id)::int as defect_count
      FROM "QCInspection" qi
      JOIN "Defect" d ON d."inspectionId" = qi.id
      WHERE qi.station IS NOT NULL
        AND qi."inspectedAt" >= NOW() - INTERVAL '30 days'
      GROUP BY qi.station
    `.catch(() => [] as { station: string; defect_count: number }[]);

    const defectMap = new Map<string, number>();
    for (const row of defectCounts) {
      defectMap.set(row.station, Number(row.defect_count));
    }

    // Trend: compare last 30 days vs prior 30 days
    const priorMetrics = await prisma.$queryRaw<{
      station: string;
      pass_rate: number;
    }[]>`
      SELECT 
        qi.station::text as station,
        CASE 
          WHEN COUNT(*) = 0 THEN 0
          ELSE (COUNT(*) FILTER (WHERE qi.status IN ('PASSED', 'PASSED_WITH_NOTES'))::float / COUNT(*)::float * 100)
        END as pass_rate
      FROM "QCInspection" qi
      WHERE qi.station IS NOT NULL
        AND qi."inspectedAt" >= NOW() - INTERVAL '60 days'
        AND qi."inspectedAt" < NOW() - INTERVAL '30 days'
      GROUP BY qi.station
    `.catch(() => [] as { station: string; pass_rate: number }[]);

    const priorMap = new Map<string, number>();
    for (const row of priorMetrics) {
      priorMap.set(row.station, Number(row.pass_rate));
    }

    const metrics = recentMetrics.map((m) => {
      const passRate = m.total > 0 ? (m.passed / m.total) * 100 : 0;
      const priorRate = priorMap.get(m.station);
      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (priorRate !== undefined) {
        if (passRate > priorRate + 2) trend = 'up';
        else if (passRate < priorRate - 2) trend = 'down';
      }

      return {
        station: m.station,
        passRate: Math.round(passRate * 10) / 10,
        totalChecks: m.total,
        defectCount: defectMap.get(m.station) || 0,
        trend,
      };
    });

    // If no QC data exists yet, return empty array (not mock data)
    setCache(cacheKey, metrics, 30000); // 30s cache

    res.json({ success: true, data: metrics, cached: false });
  } catch (error) {
    console.error('Error generating quality metrics:', error);
    res.status(500).json({ success: false, error: 'Failed to generate quality metrics' });
  }
});

export default dashboardStatsRouter;
