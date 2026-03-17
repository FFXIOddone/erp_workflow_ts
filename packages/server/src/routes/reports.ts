import { Router, type Response } from 'express';
import { prisma } from '../db/client.js';
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth.js';
import { UserRole } from '@erp/shared';
import { z } from 'zod';

export const reportsRouter = Router();

// All routes require authentication and admin/manager role
reportsRouter.use(authenticate);
reportsRouter.use(requireRole(UserRole.ADMIN, UserRole.MANAGER));

// Date range schema for reports
const DateRangeSchema = z.object({
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  period: z.enum(['today', 'week', 'month', 'quarter', 'year', 'custom']).default('month'),
});

// Helper to get date range from period
function getDateRange(period: string, fromDate?: Date, toDate?: Date) {
  const now = new Date();
  let start: Date;
  let end: Date = new Date(now);
  end.setHours(23, 59, 59, 999);

  if (period === 'custom' && fromDate && toDate) {
    start = fromDate;
    end = toDate;
  } else {
    switch (period) {
      case 'today':
        start = new Date(now);
        start.setHours(0, 0, 0, 0);
        break;
      case 'week':
        start = new Date(now);
        start.setDate(start.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        break;
      case 'month':
        start = new Date(now);
        start.setMonth(start.getMonth() - 1);
        start.setHours(0, 0, 0, 0);
        break;
      case 'quarter':
        start = new Date(now);
        start.setMonth(start.getMonth() - 3);
        start.setHours(0, 0, 0, 0);
        break;
      case 'year':
        start = new Date(now);
        start.setFullYear(start.getFullYear() - 1);
        start.setHours(0, 0, 0, 0);
        break;
      default:
        start = new Date(now);
        start.setMonth(start.getMonth() - 1);
        start.setHours(0, 0, 0, 0);
    }
  }

  return { start, end };
}

// GET /reports/overview - Dashboard overview stats
reportsRouter.get('/overview', async (req: AuthRequest, res: Response) => {
  const { period, fromDate, toDate } = DateRangeSchema.parse(req.query);
  const { start, end } = getDateRange(period, fromDate, toDate);

  const [
    totalOrders,
    completedOrders,
    pendingOrders,
    inProgressOrders,
    cancelledOrders,
    overdueOrders,
    totalTimeEntries,
    avgCompletionTime,
  ] = await Promise.all([
    // Total orders in period
    prisma.workOrder.count({
      where: { createdAt: { gte: start, lte: end } },
    }),
    // Completed orders
    prisma.workOrder.count({
      where: {
        createdAt: { gte: start, lte: end },
        status: { in: ['COMPLETED', 'SHIPPED'] },
      },
    }),
    // Pending orders
    prisma.workOrder.count({
      where: {
        createdAt: { gte: start, lte: end },
        status: 'PENDING',
      },
    }),
    // In progress orders
    prisma.workOrder.count({
      where: {
        createdAt: { gte: start, lte: end },
        status: 'IN_PROGRESS',
      },
    }),
    // Cancelled orders
    prisma.workOrder.count({
      where: {
        createdAt: { gte: start, lte: end },
        status: 'CANCELLED',
      },
    }),
    // Overdue (due date passed, not completed)
    prisma.workOrder.count({
      where: {
        dueDate: { lt: new Date() },
        status: { notIn: ['COMPLETED', 'SHIPPED', 'CANCELLED'] },
      },
    }),
    // Total time logged in period
    prisma.timeEntry.aggregate({
      where: { startTime: { gte: start, lte: end } },
      _sum: { durationMinutes: true },
    }),
    // Average time to completion (for completed orders)
    prisma.$queryRaw<Array<{ avg_hours: number }>>`
      SELECT AVG(EXTRACT(EPOCH FROM ("updatedAt" - "createdAt")) / 3600) as avg_hours
      FROM "WorkOrder"
      WHERE status IN ('COMPLETED', 'SHIPPED')
      AND "createdAt" >= ${start}
      AND "createdAt" <= ${end}
    `,
  ]);

  const completionRate = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0;
  const totalHoursLogged = Math.round((totalTimeEntries._sum?.durationMinutes || 0) / 60 * 10) / 10;
  const avgHoursToComplete = avgCompletionTime[0]?.avg_hours 
    ? Math.round(avgCompletionTime[0].avg_hours * 10) / 10 
    : 0;

  res.json({
    success: true,
    data: {
      period,
      dateRange: { start, end },
      orders: {
        total: totalOrders,
        completed: completedOrders,
        pending: pendingOrders,
        inProgress: inProgressOrders,
        cancelled: cancelledOrders,
        overdue: overdueOrders,
        completionRate,
      },
      time: {
        totalHoursLogged,
        avgHoursToComplete,
      },
    },
  });
});

// GET /reports/orders-by-status - Order counts by status
reportsRouter.get('/orders-by-status', async (req: AuthRequest, res: Response) => {
  const { period, fromDate, toDate } = DateRangeSchema.parse(req.query);
  const { start, end } = getDateRange(period, fromDate, toDate);

  const statusCounts = await prisma.workOrder.groupBy({
    by: ['status'],
    where: { createdAt: { gte: start, lte: end } },
    _count: { id: true },
  });

  const data = statusCounts.map(item => ({
    status: item.status,
    count: item._count.id,
  }));

  res.json({ success: true, data });
});

// GET /reports/orders-by-station - Order counts by routing station
reportsRouter.get('/orders-by-station', async (req: AuthRequest, res: Response) => {
  const { period, fromDate, toDate } = DateRangeSchema.parse(req.query);
  const { start, end } = getDateRange(period, fromDate, toDate);

  // Get all orders with their routing
  const orders = await prisma.workOrder.findMany({
    where: { createdAt: { gte: start, lte: end } },
    select: { routing: true },
  });

  // Count occurrences of each station
  const stationCounts: Record<string, number> = {};
  orders.forEach(order => {
    order.routing.forEach(station => {
      stationCounts[station] = (stationCounts[station] || 0) + 1;
    });
  });

  const data = Object.entries(stationCounts)
    .map(([station, count]) => ({ station, count }))
    .sort((a, b) => b.count - a.count);

  res.json({ success: true, data });
});

// GET /reports/orders-by-priority - Order counts by priority
reportsRouter.get('/orders-by-priority', async (req: AuthRequest, res: Response) => {
  const { period, fromDate, toDate } = DateRangeSchema.parse(req.query);
  const { start, end } = getDateRange(period, fromDate, toDate);

  const priorityCounts = await prisma.workOrder.groupBy({
    by: ['priority'],
    where: { createdAt: { gte: start, lte: end } },
    _count: { id: true },
  });

  const data = priorityCounts
    .map(item => ({
      priority: item.priority,
      count: item._count.id,
    }))
    .sort((a, b) => b.priority - a.priority);

  res.json({ success: true, data });
});

// GET /reports/orders-trend - Orders created over time
reportsRouter.get('/orders-trend', async (req: AuthRequest, res: Response) => {
  const { period, fromDate, toDate } = DateRangeSchema.parse(req.query);
  const { start, end } = getDateRange(period, fromDate, toDate);

  // Determine grouping based on period
  let dateFormat: string;
  if (period === 'today') {
    dateFormat = 'YYYY-MM-DD HH24:00'; // Hour
  } else if (period === 'week') {
    dateFormat = 'YYYY-MM-DD'; // Day
  } else if (period === 'month') {
    dateFormat = 'YYYY-MM-DD'; // Day
  } else {
    dateFormat = 'YYYY-MM'; // Month
  }

  const trend = await prisma.$queryRaw<Array<{ date: string; count: number }>>`
    SELECT 
      date,
      COUNT(*)::int as count
    FROM (
      SELECT TO_CHAR("createdAt", ${dateFormat}) as date
      FROM "WorkOrder"
      WHERE "createdAt" >= ${start}
      AND "createdAt" <= ${end}
    ) sub
    GROUP BY date
    ORDER BY date
  `;

  res.json({ success: true, data: trend });
});

// GET /reports/user-productivity - Time logged per user
reportsRouter.get('/user-productivity', async (req: AuthRequest, res: Response) => {
  const { period, fromDate, toDate } = DateRangeSchema.parse(req.query);
  const { start, end } = getDateRange(period, fromDate, toDate);

  const productivity = await prisma.timeEntry.groupBy({
    by: ['userId'],
    where: { startTime: { gte: start, lte: end } },
    _sum: { durationMinutes: true },
    _count: true,
  });

  // Get user names
  const userIds = productivity.map(p => p.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, displayName: true },
  });

  const userMap = new Map(users.map(u => [u.id, u.displayName]));

  const data = productivity
    .map(item => ({
      userId: item.userId,
      userName: userMap.get(item.userId) || 'Unknown',
      totalMinutes: item._sum?.durationMinutes || 0,
      totalHours: Math.round((item._sum?.durationMinutes || 0) / 60 * 10) / 10,
      entriesCount: item._count,
    }))
    .sort((a, b) => b.totalMinutes - a.totalMinutes);

  res.json({ success: true, data });
});

// GET /reports/station-performance - Time per station
reportsRouter.get('/station-performance', async (req: AuthRequest, res: Response) => {
  const { period, fromDate, toDate } = DateRangeSchema.parse(req.query);
  const { start, end } = getDateRange(period, fromDate, toDate);

  const stationTime = await prisma.timeEntry.groupBy({
    by: ['station'],
    where: { startTime: { gte: start, lte: end } },
    _sum: { durationMinutes: true },
    _count: true,
  });

  const data = stationTime
    .map(item => ({
      station: item.station,
      totalMinutes: item._sum?.durationMinutes || 0,
      totalHours: Math.round((item._sum?.durationMinutes || 0) / 60 * 10) / 10,
      entriesCount: item._count,
    }))
    .sort((a, b) => b.totalMinutes - a.totalMinutes);

  res.json({ success: true, data });
});

// GET /reports/completion-times - Average completion times by station
reportsRouter.get('/completion-times', async (req: AuthRequest, res: Response) => {
  const { period, fromDate, toDate } = DateRangeSchema.parse(req.query);
  const { start, end } = getDateRange(period, fromDate, toDate);

  const completionTimes = await prisma.$queryRaw<Array<{ station: string; avg_minutes: number; completed_count: number }>>`
    SELECT 
      station,
      AVG(EXTRACT(EPOCH FROM ("completedAt" - "startedAt")) / 60)::float as avg_minutes,
      COUNT(*)::int as completed_count
    FROM "StationProgress"
    WHERE status = 'COMPLETED'
    AND "completedAt" >= ${start}
    AND "completedAt" <= ${end}
    GROUP BY station
    ORDER BY avg_minutes DESC
  `;

  const data = completionTimes.map(item => ({
    station: item.station,
    avgMinutes: Math.round(item.avg_minutes || 0),
    avgHours: Math.round((item.avg_minutes || 0) / 60 * 10) / 10,
    completedCount: item.completed_count,
  }));

  res.json({ success: true, data });
});

// ============================================
// ADVANCED REPORTING ENDPOINTS
// ============================================

// GET /reports/revenue-by-customer - Revenue breakdown by customer
reportsRouter.get('/revenue-by-customer', async (req: AuthRequest, res: Response) => {
  const { period, fromDate, toDate } = DateRangeSchema.parse(req.query);
  const { start, end } = getDateRange(period, fromDate, toDate);
  const limit = parseInt(req.query.limit as string) || 10;

  // Get revenue from JobCost records which have quotedAmount
  const jobCosts = await prisma.jobCost.findMany({
    where: {
      workOrder: {
        createdAt: { gte: start, lte: end },
        status: { in: ['COMPLETED', 'SHIPPED'] },
        customerId: { not: null },
      },
    },
    include: {
      workOrder: {
        select: {
          customerId: true,
          customer: { select: { id: true, name: true, companyName: true } },
        },
      },
    },
  });

  // Aggregate by customer
  const customerRevenue: Record<string, { revenue: number; orderCount: number; name: string }> = {};
  
  jobCosts.forEach(jc => {
    const customerId = jc.workOrder.customerId;
    if (!customerId || !jc.workOrder.customer) return;
    
    const revenue = jc.invoicedAmount?.toNumber() || jc.quotedAmount?.toNumber() || 0;
    const customerName = jc.workOrder.customer.companyName || jc.workOrder.customer.name;
    
    if (!customerRevenue[customerId]) {
      customerRevenue[customerId] = { revenue: 0, orderCount: 0, name: customerName };
    }
    customerRevenue[customerId].revenue += revenue;
    customerRevenue[customerId].orderCount += 1;
  });

  const totalRevenue = Object.values(customerRevenue).reduce((sum, c) => sum + c.revenue, 0);

  const data = Object.entries(customerRevenue)
    .map(([customerId, stats]) => ({
      customerId,
      customerName: stats.name,
      revenue: Math.round(stats.revenue * 100) / 100,
      orderCount: stats.orderCount,
      percentage: totalRevenue > 0 ? Math.round((stats.revenue / totalRevenue) * 100 * 10) / 10 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);

  res.json({
    success: true,
    data: {
      customers: data,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalCustomers: Object.keys(customerRevenue).length,
    },
  });
});

// GET /reports/revenue-by-printing-method - Revenue by station/printing method
reportsRouter.get('/revenue-by-printing-method', async (req: AuthRequest, res: Response) => {
  const { period, fromDate, toDate } = DateRangeSchema.parse(req.query);
  const { start, end } = getDateRange(period, fromDate, toDate);

  // Get job costs with work order routing
  const jobCosts = await prisma.jobCost.findMany({
    where: {
      workOrder: {
        createdAt: { gte: start, lte: end },
        status: { in: ['COMPLETED', 'SHIPPED'] },
      },
    },
    include: {
      workOrder: {
        select: { routing: true },
      },
    },
  });

  // Distribute revenue across stations in routing
  const stationRevenue: Record<string, { revenue: number; orderCount: number }> = {};
  
  jobCosts.forEach(jc => {
    const price = jc.invoicedAmount?.toNumber() || jc.quotedAmount?.toNumber() || 0;
    const routing = jc.workOrder.routing || [];
    const stationCount = routing.length || 1;
    const revenuePerStation = price / stationCount;

    routing.forEach(station => {
      if (!stationRevenue[station]) {
        stationRevenue[station] = { revenue: 0, orderCount: 0 };
      }
      stationRevenue[station].revenue += revenuePerStation;
      stationRevenue[station].orderCount += 1;
    });
  });

  const totalRevenue = Object.values(stationRevenue).reduce((sum, s) => sum + s.revenue, 0);

  const data = Object.entries(stationRevenue)
    .map(([station, stats]) => ({
      station,
      revenue: Math.round(stats.revenue * 100) / 100,
      orderCount: stats.orderCount,
      percentage: totalRevenue > 0 ? Math.round((stats.revenue / totalRevenue) * 100 * 10) / 10 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  res.json({
    success: true,
    data: {
      stations: data,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
    },
  });
});

// GET /reports/labor-efficiency - Quoted hours vs actual hours comparison
reportsRouter.get('/labor-efficiency', async (req: AuthRequest, res: Response) => {
  const { period, fromDate, toDate } = DateRangeSchema.parse(req.query);
  const { start, end } = getDateRange(period, fromDate, toDate);

  // Get completed orders with job costs (which have labor hours) and actual time entries
  const jobCosts = await prisma.jobCost.findMany({
    where: {
      workOrder: {
        createdAt: { gte: start, lte: end },
        status: { in: ['COMPLETED', 'SHIPPED'] },
      },
    },
    include: {
      workOrder: {
        select: {
          id: true,
          orderNumber: true,
          timeEntries: {
            select: { durationMinutes: true },
          },
        },
      },
    },
  });

  let totalQuotedHours = 0;
  let totalActualHours = 0;
  let ordersWithEstimates = 0;
  let underEstimated = 0;
  let overEstimated = 0;
  let onTarget = 0;

  const orderEfficiency = jobCosts.map(jc => {
    // Use laborHours from JobCost as "quoted" since it represents expected labor
    const quotedHours = jc.laborHours?.toNumber() || 0;
    const actualMinutes = jc.workOrder.timeEntries.reduce((sum: number, te) => sum + (te.durationMinutes || 0), 0);
    const actualHours = actualMinutes / 60;

    totalQuotedHours += quotedHours;
    totalActualHours += actualHours;

    let efficiency = 100;
    if (quotedHours > 0 && actualHours > 0) {
      ordersWithEstimates++;
      efficiency = Math.round((quotedHours / actualHours) * 100);
      
      const variance = Math.abs(quotedHours - actualHours) / quotedHours;
      if (variance <= 0.1) {
        onTarget++;
      } else if (actualHours > quotedHours) {
        underEstimated++;
      } else {
        overEstimated++;
      }
    }

    return {
      orderId: jc.workOrder.id,
      orderNumber: jc.workOrder.orderNumber,
      quotedHours: Math.round(quotedHours * 10) / 10,
      actualHours: Math.round(actualHours * 10) / 10,
      variance: Math.round((actualHours - quotedHours) * 10) / 10,
      efficiency,
    };
  });

  const overallEfficiency = totalActualHours > 0 
    ? Math.round((totalQuotedHours / totalActualHours) * 100) 
    : 100;

  res.json({
    success: true,
    data: {
      summary: {
        totalQuotedHours: Math.round(totalQuotedHours * 10) / 10,
        totalActualHours: Math.round(totalActualHours * 10) / 10,
        overallEfficiency,
        ordersWithEstimates,
        onTarget,
        underEstimated,
        overEstimated,
        accuracyRate: ordersWithEstimates > 0 ? Math.round((onTarget / ordersWithEstimates) * 100) : 0,
      },
      orders: orderEfficiency
        .filter(o => o.quotedHours > 0)
        .sort((a, b) => a.efficiency - b.efficiency)
        .slice(0, 20),
    },
  });
});

// GET /reports/on-time-delivery - On-time delivery rate analysis
reportsRouter.get('/on-time-delivery', async (req: AuthRequest, res: Response) => {
  const { period, fromDate, toDate } = DateRangeSchema.parse(req.query);
  const { start, end } = getDateRange(period, fromDate, toDate);

  // Get completed/shipped orders with due dates
  const orders = await prisma.workOrder.findMany({
    where: {
      createdAt: { gte: start, lte: end },
      status: { in: ['COMPLETED', 'SHIPPED'] },
      dueDate: { not: null },
    },
    select: {
      id: true,
      orderNumber: true,
      dueDate: true,
      updatedAt: true,
      priority: true,
      customer: {
        select: { name: true, companyName: true },
      },
    },
  });

  let onTime = 0;
  let late = 0;
  let totalDaysLate = 0;
  const lateOrders: Array<{
    orderNumber: string;
    customer: string;
    dueDate: Date;
    completedDate: Date;
    daysLate: number;
  }> = [];

  orders.forEach(order => {
    if (order.dueDate) {
      const dueDate = new Date(order.dueDate);
      const completedDate = new Date(order.updatedAt);
      
      if (completedDate <= dueDate) {
        onTime++;
      } else {
        late++;
        const daysLate = Math.ceil((completedDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        totalDaysLate += daysLate;
        const customerName = order.customer?.companyName || order.customer?.name || 'Unknown';
        lateOrders.push({
          orderNumber: order.orderNumber,
          customer: customerName,
          dueDate: order.dueDate,
          completedDate: order.updatedAt,
          daysLate,
        });
      }
    }
  });

  const totalWithDueDate = onTime + late;
  const onTimeRate = totalWithDueDate > 0 ? Math.round((onTime / totalWithDueDate) * 100) : 100;
  const avgDaysLate = late > 0 ? Math.round((totalDaysLate / late) * 10) / 10 : 0;

  // Monthly trend for on-time delivery
  const monthlyTrend = await prisma.$queryRaw<Array<{ month: string; on_time: number; late: number }>>`
    SELECT 
      TO_CHAR("updatedAt", 'YYYY-MM') as month,
      SUM(CASE WHEN "updatedAt" <= "dueDate" THEN 1 ELSE 0 END)::int as on_time,
      SUM(CASE WHEN "updatedAt" > "dueDate" THEN 1 ELSE 0 END)::int as late
    FROM "WorkOrder"
    WHERE status IN ('COMPLETED', 'SHIPPED')
    AND "dueDate" IS NOT NULL
    AND "createdAt" >= ${start}
    AND "createdAt" <= ${end}
    GROUP BY TO_CHAR("updatedAt", 'YYYY-MM')
    ORDER BY month
  `;

  res.json({
    success: true,
    data: {
      summary: {
        totalOrders: totalWithDueDate,
        onTime,
        late,
        onTimeRate,
        avgDaysLate,
      },
      lateOrders: lateOrders.sort((a, b) => b.daysLate - a.daysLate).slice(0, 10),
      trend: monthlyTrend.map(t => ({
        month: t.month,
        onTime: t.on_time,
        late: t.late,
        rate: t.on_time + t.late > 0 ? Math.round((t.on_time / (t.on_time + t.late)) * 100) : 100,
      })),
    },
  });
});

// GET /reports/profitability - Job cost profitability analysis
reportsRouter.get('/profitability', async (req: AuthRequest, res: Response) => {
  const { period, fromDate, toDate } = DateRangeSchema.parse(req.query);
  const { start, end } = getDateRange(period, fromDate, toDate);

  // Get job costs for completed orders
  const jobCosts = await prisma.jobCost.findMany({
    where: {
      workOrder: {
        createdAt: { gte: start, lte: end },
        status: { in: ['COMPLETED', 'SHIPPED'] },
      },
    },
    include: {
      workOrder: {
        select: {
          orderNumber: true,
          customer: { select: { name: true, companyName: true } },
        },
      },
    },
  });

  let totalRevenue = 0;
  let totalCost = 0;
  let totalProfit = 0;
  let profitableOrders = 0;
  let unprofitableOrders = 0;

  const orderProfitability = jobCosts.map(jc => {
    const revenue = jc.invoicedAmount?.toNumber() || jc.quotedAmount?.toNumber() || 0;
    const cost = jc.totalCost?.toNumber() || 0;
    const profit = jc.grossProfit?.toNumber() || (revenue - cost);
    const margin = jc.grossMargin?.toNumber() || (revenue > 0 ? (profit / revenue) * 100 : 0);

    totalRevenue += revenue;
    totalCost += cost;
    totalProfit += profit;

    if (profit >= 0) {
      profitableOrders++;
    } else {
      unprofitableOrders++;
    }

    const customerName = jc.workOrder.customer?.companyName || jc.workOrder.customer?.name || 'Unknown';

    return {
      orderId: jc.workOrderId,
      orderNumber: jc.workOrder.orderNumber,
      customer: customerName,
      revenue: Math.round(revenue * 100) / 100,
      laborCost: Math.round((jc.laborCost?.toNumber() || 0) * 100) / 100,
      materialCost: Math.round((jc.materialCost?.toNumber() || 0) * 100) / 100,
      overheadCost: Math.round((jc.overheadCost?.toNumber() || 0) * 100) / 100,
      totalCost: Math.round(cost * 100) / 100,
      profit: Math.round(profit * 100) / 100,
      margin: Math.round(margin * 10) / 10,
    };
  });

  const avgMargin = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100 * 10) / 10 : 0;

  // Get profitability by customer
  const customerProfitability: Record<string, { revenue: number; cost: number; profit: number; orders: number }> = {};
  orderProfitability.forEach(op => {
    if (!customerProfitability[op.customer]) {
      customerProfitability[op.customer] = { revenue: 0, cost: 0, profit: 0, orders: 0 };
    }
    customerProfitability[op.customer].revenue += op.revenue;
    customerProfitability[op.customer].cost += op.totalCost;
    customerProfitability[op.customer].profit += op.profit;
    customerProfitability[op.customer].orders += 1;
  });

  const customerData = Object.entries(customerProfitability)
    .map(([customer, stats]) => ({
      customer,
      revenue: Math.round(stats.revenue * 100) / 100,
      cost: Math.round(stats.cost * 100) / 100,
      profit: Math.round(stats.profit * 100) / 100,
      margin: stats.revenue > 0 ? Math.round((stats.profit / stats.revenue) * 100 * 10) / 10 : 0,
      orders: stats.orders,
    }))
    .sort((a, b) => b.profit - a.profit);

  res.json({
    success: true,
    data: {
      summary: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalCost: Math.round(totalCost * 100) / 100,
        totalProfit: Math.round(totalProfit * 100) / 100,
        avgMargin,
        profitableOrders,
        unprofitableOrders,
        profitabilityRate: jobCosts.length > 0 ? Math.round((profitableOrders / jobCosts.length) * 100) : 100,
      },
      topProfitable: orderProfitability.sort((a, b) => b.profit - a.profit).slice(0, 10),
      leastProfitable: orderProfitability.sort((a, b) => a.profit - b.profit).slice(0, 10),
      byCustomer: customerData.slice(0, 10),
    },
  });
});

// GET /reports/equipment-utilization - Equipment usage and downtime analysis
reportsRouter.get('/equipment-utilization', async (req: AuthRequest, res: Response) => {
  const { period, fromDate, toDate } = DateRangeSchema.parse(req.query);
  const { start, end } = getDateRange(period, fromDate, toDate);

  // Get all equipment with downtime events and maintenance logs
  const equipment = await prisma.equipment.findMany({
    where: { status: { not: 'RETIRED' } },
    include: {
      downtimeEvents: {
        where: {
          createdAt: { gte: start, lte: end },
        },
      },
      maintenanceLogs: {
        where: {
          createdAt: { gte: start, lte: end },
        },
      },
    },
  });

  // Calculate period hours
  const periodHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

  const utilizationData = equipment.map(eq => {
    // Calculate total downtime hours
    let downtimeHours = 0;
    eq.downtimeEvents.forEach((dt: any) => {
      const startTime = dt.startedAt || dt.createdAt;
      const endTime = dt.resolvedAt || new Date();
      downtimeHours += (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
    });

    // Calculate maintenance hours
    const maintenanceHours = eq.maintenanceLogs.reduce((sum: number, ml: any) => {
      return sum + (ml.duration || 0) / 60; // duration is in minutes
    }, 0);

    // Uptime = period - downtime
    const uptimeHours = Math.max(0, periodHours - downtimeHours);
    const utilization = periodHours > 0 ? Math.round((uptimeHours / periodHours) * 100) : 100;

    // Count downtime events by reason
    const downtimeByReason: Record<string, number> = {};
    eq.downtimeEvents.forEach((dt: any) => {
      const reason = dt.reason || 'UNKNOWN';
      if (!downtimeByReason[reason]) {
        downtimeByReason[reason] = 0;
      }
      const startTime = dt.startedAt || dt.createdAt;
      const endTime = dt.resolvedAt || new Date();
      downtimeByReason[reason] += (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
    });

    return {
      equipmentId: eq.id,
      name: eq.name,
      station: eq.station,
      status: eq.status,
      periodHours: Math.round(periodHours),
      uptimeHours: Math.round(uptimeHours * 10) / 10,
      downtimeHours: Math.round(downtimeHours * 10) / 10,
      maintenanceHours: Math.round(maintenanceHours * 10) / 10,
      utilization,
      downtimeEvents: eq.downtimeEvents.length,
      maintenanceCount: eq.maintenanceLogs.length,
      downtimeByReason,
    };
  });

  // Summary stats
  const totalEquipment = equipment.length;
  const avgUtilization = totalEquipment > 0
    ? Math.round(utilizationData.reduce((sum, u) => sum + u.utilization, 0) / totalEquipment)
    : 100;
  const totalDowntimeHours = utilizationData.reduce((sum, u) => sum + u.downtimeHours, 0);
  const equipmentDown = equipment.filter(e => e.status === 'DOWN' || e.status === 'MAINTENANCE').length;

  // Aggregate downtime by reason
  const downtimeByReason: Record<string, number> = {};
  utilizationData.forEach(u => {
    Object.entries(u.downtimeByReason).forEach(([reason, hours]) => {
      if (!downtimeByReason[reason]) downtimeByReason[reason] = 0;
      downtimeByReason[reason] += hours;
    });
  });

  res.json({
    success: true,
    data: {
      summary: {
        totalEquipment,
        avgUtilization,
        totalDowntimeHours: Math.round(totalDowntimeHours * 10) / 10,
        equipmentDown,
        operationalEquipment: totalEquipment - equipmentDown,
      },
      equipment: utilizationData.sort((a, b) => a.utilization - b.utilization),
      downtimeByReason: Object.entries(downtimeByReason)
        .map(([reason, hours]) => ({ reason, hours: Math.round(hours * 10) / 10 }))
        .sort((a, b) => b.hours - a.hours),
    },
  });
});

// GET /reports/kpi-dashboard - All KPIs in one call for dashboard
reportsRouter.get('/kpi-dashboard', async (req: AuthRequest, res: Response) => {
  const { period, fromDate, toDate } = DateRangeSchema.parse(req.query);
  const { start, end } = getDateRange(period, fromDate, toDate);

  // Parallel fetch all key metrics
  const [
    orderStats,
    completedOrders,
    onTimeData,
    laborData,
    profitData,
  ] = await Promise.all([
    // Order statistics
    prisma.workOrder.count({
      where: { createdAt: { gte: start, lte: end } },
    }),
    // Completed orders count
    prisma.workOrder.count({
      where: {
        createdAt: { gte: start, lte: end },
        status: { in: ['COMPLETED', 'SHIPPED'] },
      },
    }),
    // On-time delivery
    prisma.workOrder.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        status: { in: ['COMPLETED', 'SHIPPED'] },
        dueDate: { not: null },
      },
      select: { dueDate: true, updatedAt: true },
    }),
    // Labor hours
    prisma.timeEntry.aggregate({
      where: { startTime: { gte: start, lte: end } },
      _sum: { durationMinutes: true },
    }),
    // Profitability from JobCost
    prisma.jobCost.aggregate({
      where: {
        workOrder: {
          createdAt: { gte: start, lte: end },
          status: { in: ['COMPLETED', 'SHIPPED'] },
        },
      },
      _sum: { grossProfit: true, quotedAmount: true },
      _avg: { grossMargin: true },
      _count: true,
    }),
  ]);

  // Calculate on-time rate
  let onTime = 0;
  onTimeData.forEach(o => {
    if (o.dueDate && o.updatedAt <= o.dueDate) onTime++;
  });
  const onTimeRate = onTimeData.length > 0 ? Math.round((onTime / onTimeData.length) * 100) : 100;

  const totalRevenue = profitData._sum.quotedAmount?.toNumber() || 0;

  res.json({
    success: true,
    data: {
      period,
      dateRange: { start, end },
      kpis: {
        totalOrders: orderStats,
        completedOrders,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        avgOrderValue: profitData._count > 0
          ? Math.round((totalRevenue / profitData._count) * 100) / 100
          : 0,
        onTimeDeliveryRate: onTimeRate,
        totalLaborHours: Math.round((laborData._sum.durationMinutes || 0) / 60 * 10) / 10,
        totalProfit: Math.round((profitData._sum.grossProfit?.toNumber() || 0) * 100) / 100,
        avgMargin: Math.round((profitData._avg.grossMargin?.toNumber() || 0) * 10) / 10,
      },
    },
  });
});