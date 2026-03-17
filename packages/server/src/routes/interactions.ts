import { Router } from 'express';
import { prisma } from '../db/client.js';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { BadRequestError, NotFoundError } from '../middleware/error-handler.js';
import { logActivity, ActivityAction, EntityType } from '../lib/activity-logger.js';
import { broadcast } from '../ws/server.js';
import {
  CreateInteractionSchema,
  UpdateInteractionSchema,
  InteractionFilterSchema,
} from '@erp/shared';
import { Prisma } from '@prisma/client';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============ Customer Interactions ============

// GET /interactions - List all interactions with filters
router.get('/', async (req: AuthRequest, res) => {
  const params = InteractionFilterSchema.parse(req.query);
  const { page, pageSize, customerId, type, createdById, followUpPending, startDate, endDate } = params;

  const where: Prisma.CustomerInteractionWhereInput = {};

  if (customerId) {
    where.customerId = customerId;
  }

  if (type) {
    where.type = type;
  }

  if (createdById) {
    where.createdById = createdById;
  }

  if (followUpPending) {
    where.followUpDate = { not: null };
    where.followUpDone = false;
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      where.createdAt.gte = startDate;
    }
    if (endDate) {
      where.createdAt.lte = endDate;
    }
  }

  const [items, total] = await Promise.all([
    prisma.customerInteraction.findMany({
      where,
      include: {
        customer: {
          select: { id: true, name: true, companyName: true },
        },
        createdBy: {
          select: { id: true, displayName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.customerInteraction.count({ where }),
  ]);

  res.json({
    success: true,
    data: {
      items,
      total,
      page,
      pageSize,
      pages: Math.ceil(total / pageSize),
    },
  });
});

// GET /interactions/follow-ups - Get pending follow-ups
router.get('/follow-ups', async (req: AuthRequest, res) => {
  const now = new Date();

  const followUps = await prisma.customerInteraction.findMany({
    where: {
      followUpDate: { not: null },
      followUpDone: false,
    },
    include: {
      customer: {
        select: { id: true, name: true, companyName: true },
      },
      createdBy: {
        select: { id: true, displayName: true },
      },
    },
    orderBy: { followUpDate: 'asc' },
    take: 50,
  });

  // Separate into overdue, today, upcoming
  const overdue = followUps.filter(f => f.followUpDate! < now);
  const today = followUps.filter(f => {
    const fDate = f.followUpDate!;
    return fDate.toDateString() === now.toDateString();
  });
  const upcoming = followUps.filter(f => f.followUpDate! > now && f.followUpDate!.toDateString() !== now.toDateString());

  res.json({
    success: true,
    data: {
      overdue,
      today,
      upcoming,
      totalPending: followUps.length,
    },
  });
});

// GET /interactions/customer/:customerId - Get interactions for a customer
router.get('/customer/:customerId', async (req: AuthRequest, res) => {
  const { customerId } = req.params;
  const { page = '1', pageSize = '25' } = req.query;

  const pageNum = parseInt(page as string, 10);
  const pageSizeNum = parseInt(pageSize as string, 10);

  const [items, total] = await Promise.all([
    prisma.customerInteraction.findMany({
      where: { customerId },
      include: {
        createdBy: {
          select: { id: true, displayName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * pageSizeNum,
      take: pageSizeNum,
    }),
    prisma.customerInteraction.count({ where: { customerId } }),
  ]);

  res.json({
    success: true,
    data: {
      items,
      total,
      page: pageNum,
      pageSize: pageSizeNum,
      pages: Math.ceil(total / pageSizeNum),
    },
  });
});

// GET /interactions/:id - Get single interaction
router.get('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;

  const interaction = await prisma.customerInteraction.findUnique({
    where: { id },
    include: {
      customer: {
        select: { id: true, name: true, companyName: true, email: true, phone: true },
      },
      createdBy: {
        select: { id: true, displayName: true },
      },
    },
  });

  if (!interaction) {
    throw NotFoundError('Interaction not found');
  }

  res.json({
    success: true,
    data: interaction,
  });
});

// POST /interactions - Create new interaction
router.post('/', async (req: AuthRequest, res) => {
  const data = CreateInteractionSchema.parse(req.body);

  // Verify customer exists
  const customer = await prisma.customer.findUnique({
    where: { id: data.customerId },
    select: { id: true, name: true },
  });

  if (!customer) {
    throw NotFoundError('Customer not found');
  }

  const interaction = await prisma.customerInteraction.create({
    data: {
      ...data,
      createdById: req.userId!,
    },
    include: {
      customer: {
        select: { id: true, name: true, companyName: true },
      },
      createdBy: {
        select: { id: true, displayName: true },
      },
    },
  });

  await logActivity({
    action: ActivityAction.CREATE,
    entityType: EntityType.INTERACTION,
    entityId: interaction.id,
    description: `Added ${data.type} interaction for ${customer.name}`,
    userId: req.userId,
    details: { customerId: data.customerId, type: data.type },
    req,
  });

  broadcast({ type: 'INTERACTION_CREATED', payload: interaction });

  res.status(201).json({
    success: true,
    data: interaction,
  });
});

// PUT /interactions/:id - Update interaction
router.put('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;
  const data = UpdateInteractionSchema.parse(req.body);

  const existing = await prisma.customerInteraction.findUnique({
    where: { id },
    include: { customer: { select: { name: true } } },
  });

  if (!existing) {
    throw NotFoundError('Interaction not found');
  }

  const interaction = await prisma.customerInteraction.update({
    where: { id },
    data,
    include: {
      customer: {
        select: { id: true, name: true, companyName: true },
      },
      createdBy: {
        select: { id: true, displayName: true },
      },
    },
  });

  await logActivity({
    action: ActivityAction.UPDATE,
    entityType: EntityType.INTERACTION,
    entityId: id,
    description: `Updated interaction for ${existing.customer.name}`,
    userId: req.userId,
    details: { customerId: existing.customerId },
    req,
  });

  broadcast({ type: 'INTERACTION_UPDATED', payload: interaction });

  res.json({
    success: true,
    data: interaction,
  });
});

// POST /interactions/:id/complete-followup - Mark follow-up as done
router.post('/:id/complete-followup', async (req: AuthRequest, res) => {
  const { id } = req.params;

  const existing = await prisma.customerInteraction.findUnique({
    where: { id },
    include: { customer: { select: { name: true } } },
  });

  if (!existing) {
    throw NotFoundError('Interaction not found');
  }

  if (!existing.followUpDate) {
    throw BadRequestError('This interaction has no follow-up scheduled');
  }

  const interaction = await prisma.customerInteraction.update({
    where: { id },
    data: { followUpDone: true },
    include: {
      customer: {
        select: { id: true, name: true, companyName: true },
      },
      createdBy: {
        select: { id: true, displayName: true },
      },
    },
  });

  await logActivity({
    action: ActivityAction.UPDATE,
    entityType: EntityType.INTERACTION,
    entityId: id,
    description: `Completed follow-up for ${existing.customer.name}`,
    userId: req.userId,
    details: { customerId: existing.customerId },
    req,
  });

  broadcast({ type: 'INTERACTION_UPDATED', payload: interaction });

  res.json({
    success: true,
    data: interaction,
  });
});

// DELETE /interactions/:id - Delete interaction
router.delete('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;

  const existing = await prisma.customerInteraction.findUnique({
    where: { id },
    include: { customer: { select: { name: true } } },
  });

  if (!existing) {
    throw NotFoundError('Interaction not found');
  }

  await prisma.customerInteraction.delete({ where: { id } });

  await logActivity({
    action: ActivityAction.DELETE,
    entityType: EntityType.CUSTOMER,
    entityId: existing.customerId,
    description: `Deleted ${existing.type} interaction for ${existing.customer.name}`,
    userId: req.userId,
    req,
  });

  broadcast({ type: 'INTERACTION_DELETED', payload: { id, customerId: existing.customerId } });

  res.json({
    success: true,
    message: 'Interaction deleted successfully',
  });
});

// GET /interactions/stats - Get interaction statistics
router.get('/stats', async (req: AuthRequest, res) => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [totalInteractions, recentInteractions, pendingFollowUps, overdueFollowUps, byType] = await Promise.all([
    prisma.customerInteraction.count(),
    prisma.customerInteraction.count({
      where: { createdAt: { gte: thirtyDaysAgo } },
    }),
    prisma.customerInteraction.count({
      where: {
        followUpDate: { not: null },
        followUpDone: false,
      },
    }),
    prisma.customerInteraction.count({
      where: {
        followUpDate: { lt: now },
        followUpDone: false,
      },
    }),
    prisma.customerInteraction.groupBy({
      by: ['type'],
      _count: { id: true },
      where: { createdAt: { gte: thirtyDaysAgo } },
    }),
  ]);

  res.json({
    success: true,
    data: {
      totalInteractions,
      recentInteractions,
      pendingFollowUps,
      overdueFollowUps,
      byType: byType.reduce((acc, item) => {
        acc[item.type] = item._count.id;
        return acc;
      }, {} as Record<string, number>),
    },
  });
});

export default router;
