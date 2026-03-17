import { Router, type Response } from 'express';
import { prisma } from '../db/client.js';
import { authenticate, type AuthRequest } from '../middleware/auth.js';

export const salesRouter = Router();

// Apply authentication to all routes
salesRouter.use(authenticate);

// GET /sales/dashboard - Get comprehensive sales dashboard data
salesRouter.get('/dashboard', async (req: AuthRequest, res: Response) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const [
    // Quote stats
    quotesByStatus,
    quotesThisMonth,
    quotesLastMonth,
    revenueThisMonth,
    revenueLastMonth,
    revenueThisYear,
    
    // Customer stats
    totalCustomers,
    newCustomersThisMonth,
    
    // Recent activity
    recentQuotes,
    topCustomers,
    
    // Pipeline value (sent + approved quotes)
    pipelineValue,
  ] = await Promise.all([
    // Quote counts by status
    prisma.quote.groupBy({
      by: ['status'],
      _count: true,
      _sum: { total: true },
    }),
    
    // Quotes created this month
    prisma.quote.count({
      where: { createdAt: { gte: startOfMonth } },
    }),
    
    // Quotes created last month
    prisma.quote.count({
      where: {
        createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
      },
    }),
    
    // Revenue (converted quotes) this month
    prisma.quote.aggregate({
      where: {
        status: 'CONVERTED',
        convertedAt: { gte: startOfMonth },
      },
      _sum: { total: true },
    }),
    
    // Revenue last month
    prisma.quote.aggregate({
      where: {
        status: 'CONVERTED',
        convertedAt: { gte: startOfLastMonth, lte: endOfLastMonth },
      },
      _sum: { total: true },
    }),
    
    // Revenue this year
    prisma.quote.aggregate({
      where: {
        status: 'CONVERTED',
        convertedAt: { gte: startOfYear },
      },
      _sum: { total: true },
    }),
    
    // Total customers
    prisma.customer.count({ where: { isActive: true } }),
    
    // New customers this month
    prisma.customer.count({
      where: { createdAt: { gte: startOfMonth } },
    }),
    
    // Recent quotes
    prisma.quote.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { displayName: true } },
      },
    }),
    
    // Top customers by quote value (this year)
    prisma.quote.groupBy({
      by: ['customerName'],
      where: {
        status: 'CONVERTED',
        convertedAt: { gte: startOfYear },
      },
      _sum: { total: true },
      _count: true,
      orderBy: { _sum: { total: 'desc' } },
      take: 5,
    }),
    
    // Pipeline value (quotes that are sent or approved but not converted)
    prisma.quote.aggregate({
      where: {
        status: { in: ['SENT', 'APPROVED'] },
      },
      _sum: { total: true },
    }),
  ]);

  // Calculate conversion rate
  const convertedCount = quotesByStatus.find(q => q.status === 'CONVERTED')?._count ?? 0;
  const rejectedCount = quotesByStatus.find(q => q.status === 'REJECTED')?._count ?? 0;
  const conversionRate = convertedCount + rejectedCount > 0
    ? Math.round((convertedCount / (convertedCount + rejectedCount)) * 100)
    : 0;

  // Calculate month-over-month growth
  const thisMonthRevenue = Number(revenueThisMonth._sum.total ?? 0);
  const lastMonthRevenue = Number(revenueLastMonth._sum.total ?? 0);
  const revenueGrowth = lastMonthRevenue > 0
    ? Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
    : thisMonthRevenue > 0 ? 100 : 0;

  res.json({
    success: true,
    data: {
      overview: {
        totalQuotes: quotesByStatus.reduce((sum, q) => sum + q._count, 0),
        draftQuotes: quotesByStatus.find(q => q.status === 'DRAFT')?._count ?? 0,
        sentQuotes: quotesByStatus.find(q => q.status === 'SENT')?._count ?? 0,
        approvedQuotes: quotesByStatus.find(q => q.status === 'APPROVED')?._count ?? 0,
        convertedQuotes: convertedCount,
        rejectedQuotes: rejectedCount,
        conversionRate,
        pipelineValue: Number(pipelineValue._sum.total ?? 0),
      },
      revenue: {
        thisMonth: thisMonthRevenue,
        lastMonth: lastMonthRevenue,
        thisYear: Number(revenueThisYear._sum.total ?? 0),
        growth: revenueGrowth,
      },
      quotes: {
        thisMonth: quotesThisMonth,
        lastMonth: quotesLastMonth,
      },
      customers: {
        total: totalCustomers,
        newThisMonth: newCustomersThisMonth,
      },
      recentQuotes: recentQuotes.map(q => ({
        id: q.id,
        quoteNumber: q.quoteNumber,
        customerName: q.customerName,
        companyId: q.companyId ?? null,
        customerId: q.customerId ?? null,
        total: Number(q.total),
        status: q.status,
        createdAt: q.createdAt,
        createdBy: q.createdBy?.displayName,
      })),
      topCustomers: topCustomers.map(c => ({
        customerName: c.customerName,
        totalRevenue: Number(c._sum.total ?? 0),
        orderCount: c._count,
      })),
    },
  });
});

// GET /sales/pipeline - Get sales pipeline data
salesRouter.get('/pipeline', async (req: AuthRequest, res: Response) => {
  const pipeline = await prisma.quote.findMany({
    where: {
      status: { in: ['DRAFT', 'SENT', 'APPROVED'] },
    },
    include: {
      customer: { select: { id: true, name: true, companyName: true } },
      assignedTo: { select: { id: true, displayName: true } },
    },
    orderBy: [
      { status: 'asc' },
      { createdAt: 'desc' },
    ],
  });

  // Group by status
  const stages = {
    DRAFT: pipeline.filter(q => q.status === 'DRAFT'),
    SENT: pipeline.filter(q => q.status === 'SENT'),
    APPROVED: pipeline.filter(q => q.status === 'APPROVED'),
  };

  const stageValues = {
    DRAFT: stages.DRAFT.reduce((sum, q) => sum + Number(q.total), 0),
    SENT: stages.SENT.reduce((sum, q) => sum + Number(q.total), 0),
    APPROVED: stages.APPROVED.reduce((sum, q) => sum + Number(q.total), 0),
  };

  res.json({
    success: true,
    data: {
      stages,
      stageValues,
      totalPipelineValue: Object.values(stageValues).reduce((a, b) => a + b, 0),
    },
  });
});

// GET /sales/reports/monthly - Get monthly sales report
salesRouter.get('/reports/monthly', async (req: AuthRequest, res: Response) => {
  const year = parseInt(req.query.year as string) || new Date().getFullYear();

  // Get monthly data for the year
  const months = [];
  for (let month = 0; month < 12; month++) {
    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59);

    const [quotesCreated, quotesConverted, revenue] = await Promise.all([
      prisma.quote.count({
        where: { createdAt: { gte: startOfMonth, lte: endOfMonth } },
      }),
      prisma.quote.count({
        where: {
          status: 'CONVERTED',
          convertedAt: { gte: startOfMonth, lte: endOfMonth },
        },
      }),
      prisma.quote.aggregate({
        where: {
          status: 'CONVERTED',
          convertedAt: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { total: true },
      }),
    ]);

    months.push({
      month: month + 1,
      monthName: startOfMonth.toLocaleString('default', { month: 'short' }),
      quotesCreated,
      quotesConverted,
      revenue: Number(revenue._sum.total ?? 0),
    });
  }

  res.json({
    success: true,
    data: {
      year,
      months,
      totals: {
        quotesCreated: months.reduce((sum, m) => sum + m.quotesCreated, 0),
        quotesConverted: months.reduce((sum, m) => sum + m.quotesConverted, 0),
        revenue: months.reduce((sum, m) => sum + m.revenue, 0),
      },
    },
  });
});
