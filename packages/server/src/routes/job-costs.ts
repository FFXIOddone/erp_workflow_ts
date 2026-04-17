import { Router } from 'express';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../db/client.js';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { BadRequestError, NotFoundError } from '../middleware/error-handler.js';
import { logActivity, ActivityAction, EntityType } from '../lib/activity-logger.js';
import { buildRouteActivityPayload } from '../lib/route-activity.js';
import { broadcast } from '../ws/server.js';
import { buildRouteBroadcastPayload } from '../lib/route-broadcast.js';
import {
  UpdateJobCostSchema,
  JobCostFilterSchema,
} from '@erp/shared';
import { calculateJobCost, updateJobCost, getProfitabilitySummary } from '../services/job-costing.js';

const router = Router();

/**
 * Transform Prisma Decimal fields to plain numbers for JSON serialization
 */
function transformJobCost(jobCost: any): any {
  if (!jobCost) return null;
  
  const decimalFields = [
    'quotedAmount', 'invoicedAmount', 'laborHours', 'laborRate', 'laborCost',
    'materialCost', 'subcontractCost', 'shippingCost', 'otherDirectCost',
    'overheadPercent', 'overheadCost', 'totalCost', 'grossProfit', 'grossMargin'
  ];
  
  const result = { ...jobCost };
  for (const field of decimalFields) {
    if (result[field] !== null && result[field] !== undefined) {
      // Handle Decimal objects, strings, or numbers
      if (result[field] instanceof Decimal) {
        result[field] = result[field].toNumber();
      } else if (typeof result[field] === 'string') {
        result[field] = parseFloat(result[field]);
      }
    }
  }
  
  return result;
}

// All routes require authentication
router.use(authenticate);

// GET /job-costs - List job costs with filtering
router.get('/', async (req: AuthRequest, res) => {
  const filters = JobCostFilterSchema.parse(req.query);
  const { page, pageSize, fromDate, toDate, minMargin, maxMargin, hasLoss, sortBy, sortOrder } = filters;

  const where: any = {};

  if (fromDate || toDate) {
    where.calculatedAt = {};
    if (fromDate) where.calculatedAt.gte = fromDate;
    if (toDate) where.calculatedAt.lte = toDate;
  }

  if (minMargin !== undefined) {
    where.grossMargin = { ...where.grossMargin, gte: minMargin };
  }

  if (maxMargin !== undefined) {
    where.grossMargin = { ...where.grossMargin, lte: maxMargin };
  }

  if (hasLoss) {
    where.grossProfit = { lt: 0 };
  }

  const [jobCosts, total] = await Promise.all([
    prisma.jobCost.findMany({
      where,
      include: {
        workOrder: {
          select: {
            id: true,
            orderNumber: true,
            customerName: true,
            status: true,
          },
        },
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.jobCost.count({ where }),
  ]);

  res.json({
    success: true,
    data: {
      items: jobCosts.map(transformJobCost),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  });
});

// GET /job-costs/summary - Get profitability summary
router.get('/summary', async (req: AuthRequest, res) => {
  const { fromDate, toDate } = req.query;
  
  const summary = await getProfitabilitySummary({
    fromDate: fromDate ? new Date(fromDate as string) : undefined,
    toDate: toDate ? new Date(toDate as string) : undefined,
  });

  res.json({ success: true, data: summary });
});

// GET /job-costs/order/:workOrderId - Get job cost for a specific order
router.get('/order/:workOrderId', async (req: AuthRequest, res) => {
  const { workOrderId } = req.params;

  // Verify order exists
  const order = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    select: { id: true, orderNumber: true },
  });

  if (!order) {
    throw NotFoundError('Work order not found');
  }

  // Get or calculate job cost
  let jobCost = await prisma.jobCost.findUnique({
    where: { workOrderId },
    include: {
      workOrder: {
        select: {
          id: true,
          orderNumber: true,
          customerName: true,
          status: true,
          lineItems: true,
        },
      },
    },
  });

  if (!jobCost) {
    // Calculate fresh
    const calculation = await calculateJobCost(workOrderId);
    res.json({
      success: true,
      data: {
        ...calculation,
        calculatedAt: new Date().toISOString(),
        isCalculated: true,
      },
    });
    return;
  }

  res.json({ success: true, data: transformJobCost(jobCost) });
});

// POST /job-costs/order/:workOrderId/calculate - Calculate/recalculate job cost
router.post('/order/:workOrderId/calculate', async (req: AuthRequest, res) => {
  const { workOrderId } = req.params;

  // Verify order exists
  const order = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    select: { id: true, orderNumber: true },
  });

  if (!order) {
    throw NotFoundError('Work order not found');
  }

  const calculation = await updateJobCost(workOrderId);

  await logActivity(
    buildRouteActivityPayload({
      action: ActivityAction.CALCULATE_COST,
      entityType: EntityType.JOB_COST,
      entityId: workOrderId,
      entityName: order.orderNumber,
      description: `Calculated job cost for ${order.orderNumber}`,
      details: {
        totalCost: calculation.totalCost,
        grossMargin: calculation.grossMargin,
      },
      userId: req.user!.id,
      req,
    }),
  );

  broadcast(buildRouteBroadcastPayload({ type: 'JOB_COST_UPDATED', payload: calculation }));

  res.json({ success: true, data: calculation });
});

// PUT /job-costs/order/:workOrderId - Update job cost manual fields
router.put('/order/:workOrderId', async (req: AuthRequest, res) => {
  const { workOrderId } = req.params;
  const data = UpdateJobCostSchema.parse(req.body);

  // Verify order exists
  const order = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    select: { id: true, orderNumber: true },
  });

  if (!order) {
    throw NotFoundError('Work order not found');
  }

  const calculation = await updateJobCost(workOrderId, {
    laborRate: data.laborRate,
    overheadPercent: data.overheadPercent ?? undefined,
    invoicedAmount: data.invoicedAmount,
    subcontractCost: data.subcontractCost,
    shippingCost: data.shippingCost,
    otherDirectCost: data.otherDirectCost,
  });

  await logActivity(
    buildRouteActivityPayload({
      action: ActivityAction.UPDATE,
      entityType: EntityType.JOB_COST,
      entityId: workOrderId,
      entityName: order.orderNumber,
      description: `Updated job cost for ${order.orderNumber}`,
      details: data,
      userId: req.user!.id,
      req,
    }),
  );

  broadcast(buildRouteBroadcastPayload({ type: 'JOB_COST_UPDATED', payload: calculation }));

  res.json({ success: true, data: calculation });
});

// POST /job-costs/recalculate-all - Recalculate all job costs (admin only)
router.post('/recalculate-all', async (req: AuthRequest, res) => {
  // This can be a long-running operation, so we'll do it in batches
  const orders = await prisma.workOrder.findMany({
    select: { id: true },
  });

  let processed = 0;
  for (const order of orders) {
    try {
      await updateJobCost(order.id);
      processed++;
    } catch (error) {
      console.error(`Failed to calculate job cost for ${order.id}:`, error);
    }
  }

  await logActivity(
    buildRouteActivityPayload({
      action: ActivityAction.CALCULATE_COST,
      entityType: EntityType.JOB_COST,
      entityId: 'recalculate-all',
      entityName: 'Recalculate All Job Costs',
      description: `Recalculated job costs for ${processed} orders`,
      userId: req.user!.id,
      req,
    }),
  );

  res.json({ 
    success: true, 
    data: { 
      total: orders.length, 
      processed,
      message: `Recalculated job costs for ${processed} orders` 
    } 
  });
});

export default router;
