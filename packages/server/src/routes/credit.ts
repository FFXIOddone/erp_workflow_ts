import { Router } from 'express';
import { prisma } from '../db/client.js';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { broadcast } from '../ws/server.js';
import { NotFoundError, BadRequestError, ForbiddenError } from '../middleware/error-handler.js';
import { logActivity, ActivityAction, EntityType } from '../lib/activity-logger.js';
import {
  UpdateCustomerCreditSchema,
  CreateCreditApprovalSchema,
  ProcessCreditApprovalSchema,
  CreditApprovalFilterSchema,
} from '@erp/shared';
import { CreditApprovalStatus, UserRole } from '@prisma/client';

const router = Router();
router.use(authenticate);

// ============ GET /credit/customers-on-hold - List customers on credit hold ============
router.get('/customers-on-hold', async (req: AuthRequest, res) => {
  const customers = await prisma.customer.findMany({
    where: {
      isOnCreditHold: true,
    },
    select: {
      id: true,
      name: true,
      companyName: true,
      creditLimit: true,
      currentBalance: true,
      creditHoldReason: true,
      creditHoldDate: true,
      _count: {
        select: {
          workOrders: {
            where: {
              status: { in: ['PENDING', 'IN_PROGRESS'] },
            },
          },
        },
      },
    },
    orderBy: { creditHoldDate: 'desc' },
  });

  res.json({ success: true, data: customers });
});

// ============ GET /credit/over-limit - List customers over credit limit ============
router.get('/over-limit', async (req: AuthRequest, res) => {
  const customers = await prisma.customer.findMany({
    where: {
      creditLimit: { not: null },
      currentBalance: { not: null },
    },
    select: {
      id: true,
      name: true,
      companyName: true,
      creditLimit: true,
      currentBalance: true,
      paymentTerms: true,
      isOnCreditHold: true,
    },
  });

  // Filter to only those over limit
  const overLimit = customers.filter((c) => {
    const limit = Number(c.creditLimit);
    const balance = Number(c.currentBalance);
    return balance > limit;
  }).map((c) => ({
    ...c,
    overBy: Number(c.currentBalance) - Number(c.creditLimit),
    percentUsed: Math.round((Number(c.currentBalance) / Number(c.creditLimit)) * 100),
  }));

  res.json({ success: true, data: overLimit });
});

// ============ PATCH /credit/customers/:id - Update customer credit settings ============
router.patch('/customers/:id', async (req: AuthRequest, res) => {
  const data = UpdateCustomerCreditSchema.parse(req.body);
  const customerId = req.params.id;

  // Only admins and managers can update credit settings
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { role: true },
  });

  if (user?.role !== 'ADMIN' && user?.role !== 'MANAGER') {
    throw ForbiddenError('Only admins and managers can update credit settings');
  }

  const existing = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { name: true, isOnCreditHold: true },
  });

  if (!existing) {
    throw NotFoundError('Customer not found');
  }

  const updateData: any = { ...data };

  // Track when credit hold is applied
  if (data.isOnCreditHold && !existing.isOnCreditHold) {
    updateData.creditHoldDate = new Date();
  } else if (data.isOnCreditHold === false) {
    updateData.creditHoldDate = null;
    updateData.creditHoldReason = null;
  }

  const customer = await prisma.customer.update({
    where: { id: customerId },
    data: updateData,
  });

  await logActivity({
    action: ActivityAction.UPDATE,
    entityType: EntityType.CUSTOMER,
    entityId: customerId,
    description: `Updated credit settings for ${existing.name}`,
    userId: req.userId,
    req,
  });

  broadcast({ type: 'CUSTOMER_CREDIT_UPDATED', payload: customer });

  res.json({ success: true, data: customer });
});

// ============ POST /credit/customers/:id/hold - Put customer on credit hold ============
router.post('/customers/:id/hold', async (req: AuthRequest, res) => {
  const { reason } = req.body;
  const customerId = req.params.id;

  const existing = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { name: true },
  });

  if (!existing) {
    throw NotFoundError('Customer not found');
  }

  const customer = await prisma.customer.update({
    where: { id: customerId },
    data: {
      isOnCreditHold: true,
      creditHoldReason: reason || 'Credit limit exceeded',
      creditHoldDate: new Date(),
    },
  });

  await logActivity({
    action: ActivityAction.UPDATE,
    entityType: EntityType.CUSTOMER,
    entityId: customerId,
    description: `Put ${existing.name} on credit hold: ${reason || 'Credit limit exceeded'}`,
    userId: req.userId,
    req,
  });

  broadcast({ type: 'CUSTOMER_ON_HOLD', payload: customer });

  res.json({ success: true, data: customer });
});

// ============ POST /credit/customers/:id/release - Release customer from credit hold ============
router.post('/customers/:id/release', async (req: AuthRequest, res) => {
  const customerId = req.params.id;

  const existing = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { name: true, isOnCreditHold: true },
  });

  if (!existing) {
    throw NotFoundError('Customer not found');
  }

  if (!existing.isOnCreditHold) {
    throw BadRequestError('Customer is not on credit hold');
  }

  const customer = await prisma.customer.update({
    where: { id: customerId },
    data: {
      isOnCreditHold: false,
      creditHoldReason: null,
      creditHoldDate: null,
    },
  });

  await logActivity({
    action: ActivityAction.UPDATE,
    entityType: EntityType.CUSTOMER,
    entityId: customerId,
    description: `Released ${existing.name} from credit hold`,
    userId: req.userId,
    req,
  });

  broadcast({ type: 'CUSTOMER_RELEASED', payload: customer });

  res.json({ success: true, data: customer });
});

// ============ GET /credit/approvals - List credit approvals ============
router.get('/approvals', async (req: AuthRequest, res) => {
  const filters = CreditApprovalFilterSchema.parse(req.query);

  const where: any = {};

  if (filters.customerId) {
    where.customerId = filters.customerId;
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) where.createdAt.gte = filters.startDate;
    if (filters.endDate) where.createdAt.lte = filters.endDate;
  }

  const approvals = await prisma.creditApproval.findMany({
    where,
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          companyName: true,
          creditLimit: true,
          currentBalance: true,
        },
      },
      workOrder: {
        select: {
          id: true,
          orderNumber: true,
          description: true,
        },
      },
      requestedBy: {
        select: { id: true, displayName: true },
      },
      approvedBy: {
        select: { id: true, displayName: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ success: true, data: approvals });
});

// ============ GET /credit/approvals/pending - List pending approvals ============
router.get('/approvals/pending', async (req: AuthRequest, res) => {
  const approvals = await prisma.creditApproval.findMany({
    where: { status: 'PENDING' },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          companyName: true,
          creditLimit: true,
          currentBalance: true,
        },
      },
      workOrder: {
        select: {
          id: true,
          orderNumber: true,
          description: true,
        },
      },
      requestedBy: {
        select: { id: true, displayName: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  res.json({ success: true, data: approvals });
});

// ============ POST /credit/approvals - Request credit approval ============
router.post('/approvals', async (req: AuthRequest, res) => {
  const data = CreateCreditApprovalSchema.parse(req.body);

  // Verify customer exists
  const customer = await prisma.customer.findUnique({
    where: { id: data.customerId },
    select: { id: true, name: true, creditLimit: true, currentBalance: true },
  });

  if (!customer) {
    throw NotFoundError('Customer not found');
  }

  const approval = await prisma.creditApproval.create({
    data: {
      ...data,
      requestedById: req.userId!,
    },
    include: {
      customer: {
        select: { id: true, name: true },
      },
      workOrder: {
        select: { id: true, orderNumber: true },
      },
      requestedBy: {
        select: { id: true, displayName: true },
      },
    },
  });

  await logActivity({
    action: ActivityAction.CREATE,
    entityType: EntityType.OTHER,
    entityId: approval.id,
    description: `Requested $${data.requestedAmount} credit approval for ${customer.name}`,
    userId: req.userId,
    req,
  });

  broadcast({ type: 'CREDIT_APPROVAL_REQUESTED', payload: approval });

  res.status(201).json({ success: true, data: approval });
});

// ============ POST /credit/approvals/:id/process - Approve or deny request ============
router.post('/approvals/:id/process', async (req: AuthRequest, res) => {
  const data = ProcessCreditApprovalSchema.parse(req.body);
  const approvalId = req.params.id;

  // Only admins and managers can process approvals
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { role: true },
  });

  if (user?.role !== 'ADMIN' && user?.role !== 'MANAGER') {
    throw ForbiddenError('Only admins and managers can process credit approvals');
  }

  const existing = await prisma.creditApproval.findUnique({
    where: { id: approvalId },
    include: {
      customer: { select: { name: true } },
    },
  });

  if (!existing) {
    throw NotFoundError('Credit approval request not found');
  }

  if (existing.status !== 'PENDING') {
    throw BadRequestError('This approval request has already been processed');
  }

  const approval = await prisma.creditApproval.update({
    where: { id: approvalId },
    data: {
      status: data.status,
      notes: data.notes ?? existing.notes,
      approvedById: req.userId,
      approvedAt: new Date(),
    },
    include: {
      customer: {
        select: { id: true, name: true },
      },
      workOrder: {
        select: { id: true, orderNumber: true },
      },
      requestedBy: {
        select: { id: true, displayName: true },
      },
      approvedBy: {
        select: { id: true, displayName: true },
      },
    },
  });

  await logActivity({
    action: ActivityAction.UPDATE,
    entityType: EntityType.OTHER,
    entityId: approvalId,
    description: `${data.status} credit approval for ${existing.customer.name}`,
    userId: req.userId,
    req,
  });

  broadcast({ type: 'CREDIT_APPROVAL_PROCESSED', payload: approval });

  res.json({ success: true, data: approval });
});

// ============ GET /credit/check/:customerId - Check customer credit status ============
router.get('/check/:customerId', async (req: AuthRequest, res) => {
  const customer = await prisma.customer.findUnique({
    where: { id: req.params.customerId },
    select: {
      id: true,
      name: true,
      creditLimit: true,
      currentBalance: true,
      paymentTerms: true,
      isOnCreditHold: true,
      creditHoldReason: true,
      creditHoldDate: true,
    },
  });

  if (!customer) {
    throw NotFoundError('Customer not found');
  }

  const creditLimit = customer.creditLimit ? Number(customer.creditLimit) : null;
  const currentBalance = customer.currentBalance ? Number(customer.currentBalance) : 0;
  
  let creditStatus: 'OK' | 'WARNING' | 'OVER_LIMIT' | 'ON_HOLD' = 'OK';
  let availableCredit = creditLimit !== null ? creditLimit - currentBalance : null;
  let percentUsed = creditLimit !== null ? Math.round((currentBalance / creditLimit) * 100) : null;

  if (customer.isOnCreditHold) {
    creditStatus = 'ON_HOLD';
  } else if (creditLimit !== null && currentBalance > creditLimit) {
    creditStatus = 'OVER_LIMIT';
  } else if (creditLimit !== null && percentUsed !== null && percentUsed >= 80) {
    creditStatus = 'WARNING';
  }

  res.json({
    success: true,
    data: {
      ...customer,
      creditStatus,
      availableCredit,
      percentUsed,
      canPlaceOrder: creditStatus !== 'ON_HOLD' && creditStatus !== 'OVER_LIMIT',
    },
  });
});

export default router;
