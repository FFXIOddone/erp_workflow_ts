import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth.js';
import { UserRole, PaginationSchema } from '@erp/shared';
import { buildTokenizedSearchWhere } from '../lib/fuzzy-search.js';

export const activityRouter = Router();

// All routes require authentication
activityRouter.use(authenticate);

// Query schema for activity log
const ActivityQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(50),
  userId: z.string().uuid().optional(),
  entityType: z.string().optional(),
  action: z.string().optional(),
  entityId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().optional(),
});

// GET /activity - List activity logs (Admin/Manager only)
activityRouter.get(
  '/',
  requireRole(UserRole.ADMIN, UserRole.MANAGER),
  async (req, res, next) => {
    try {
      const query = ActivityQuerySchema.parse(req.query);
      const { page, pageSize, userId, entityType, action, entityId, startDate, endDate, search } = query;

      const where: Record<string, unknown> = {};

      if (userId) {
        where.userId = userId;
      }

      if (entityType) {
        where.entityType = entityType;
      }

      if (action) {
        where.action = action;
      }

      if (entityId) {
        where.entityId = entityId;
      }

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) {
          (where.createdAt as Record<string, unknown>).gte = new Date(startDate);
        }
        if (endDate) {
          (where.createdAt as Record<string, unknown>).lte = new Date(endDate);
        }
      }

      if (search) {
        const searchWhere = buildTokenizedSearchWhere(search, ['description', 'entityName']);
        if (searchWhere) {
          Object.assign(where, searchWhere);
        }
      }

      const [activities, total] = await Promise.all([
        prisma.activityLog.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                username: true,
                profilePhoto: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.activityLog.count({ where }),
      ]);

      res.json({
        success: true,
        data: {
          items: activities,
          pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /activity/stats - Get activity statistics
activityRouter.get(
  '/stats',
  requireRole(UserRole.ADMIN, UserRole.MANAGER),
  async (req, res, next) => {
    try {
      const { startDate, endDate } = z
        .object({
          startDate: z.string().optional(),
          endDate: z.string().optional(),
        })
        .parse(req.query);

      const dateFilter: Record<string, unknown> = {};
      if (startDate || endDate) {
        dateFilter.createdAt = {};
        if (startDate) {
          (dateFilter.createdAt as Record<string, unknown>).gte = new Date(startDate);
        }
        if (endDate) {
          (dateFilter.createdAt as Record<string, unknown>).lte = new Date(endDate);
        }
      }

      // Get counts by action type
      const actionCounts = await prisma.activityLog.groupBy({
        by: ['action'],
        where: dateFilter,
        _count: true,
        orderBy: { _count: { action: 'desc' } },
      });

      // Get counts by entity type
      const entityCounts = await prisma.activityLog.groupBy({
        by: ['entityType'],
        where: dateFilter,
        _count: true,
        orderBy: { _count: { entityType: 'desc' } },
      });

      // Get counts by user (top 10)
      const userCounts = await prisma.activityLog.groupBy({
        by: ['userId'],
        where: { ...dateFilter, userId: { not: null } },
        _count: true,
        orderBy: { _count: { userId: 'desc' } },
        take: 10,
      });

      // Fetch user details for top users
      const userIds = userCounts.map((u) => u.userId).filter(Boolean) as string[];
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, displayName: true, username: true },
      });

      const userCountsWithDetails = userCounts.map((u) => ({
        userId: u.userId,
        count: u._count,
        user: users.find((user) => user.id === u.userId),
      }));

      // Get activity over time (last 7 days by default)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const recentActivity = await prisma.activityLog.findMany({
        where: {
          createdAt: { gte: startDate ? new Date(startDate) : sevenDaysAgo },
        },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      });

      // Group by day
      const activityByDay: Record<string, number> = {};
      recentActivity.forEach((a) => {
        const day = a.createdAt.toISOString().split('T')[0];
        activityByDay[day] = (activityByDay[day] || 0) + 1;
      });

      // Total count
      const totalCount = await prisma.activityLog.count({ where: dateFilter });

      res.json({
        success: true,
        data: {
          totalCount,
          byAction: actionCounts.map((a) => ({ action: a.action, count: a._count })),
          byEntity: entityCounts.map((e) => ({ entityType: e.entityType, count: e._count })),
          byUser: userCountsWithDetails,
          byDay: Object.entries(activityByDay).map(([date, count]) => ({ date, count })),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /activity/entity/:type/:id - Get activity for a specific entity
activityRouter.get(
  '/entity/:type/:id',
  async (req, res, next) => {
    try {
      const { type, id } = req.params;
      const query = PaginationSchema.parse(req.query);

      const [activities, total] = await Promise.all([
        prisma.activityLog.findMany({
          where: {
            entityType: type,
            entityId: id,
          },
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                username: true,
                profilePhoto: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        prisma.activityLog.count({
          where: { entityType: type, entityId: id },
        }),
      ]);

      res.json({
        success: true,
        data: {
          items: activities,
          pagination: {
            page: query.page,
            pageSize: query.pageSize,
            total,
            totalPages: Math.ceil(total / query.pageSize),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /activity/user/:id - Get activity for a specific user
activityRouter.get(
  '/user/:id',
  requireRole(UserRole.ADMIN, UserRole.MANAGER),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const query = PaginationSchema.parse(req.query);

      const [activities, total] = await Promise.all([
        prisma.activityLog.findMany({
          where: { userId: id },
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                username: true,
                profilePhoto: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        prisma.activityLog.count({ where: { userId: id } }),
      ]);

      res.json({
        success: true,
        data: {
          items: activities,
          pagination: {
            page: query.page,
            pageSize: query.pageSize,
            total,
            totalPages: Math.ceil(total / query.pageSize),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /activity/my - Get current user's activity
activityRouter.get('/my', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const query = PaginationSchema.parse(req.query);

    const [activities, total] = await Promise.all([
      prisma.activityLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.activityLog.count({ where: { userId } }),
    ]);

    res.json({
      success: true,
      data: {
        items: activities,
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          total,
          totalPages: Math.ceil(total / query.pageSize),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /activity - Clear old activity logs (Admin only)
activityRouter.delete(
  '/',
  requireRole(UserRole.ADMIN),
  async (req, res, next) => {
    try {
      const { olderThanDays } = z
        .object({
          olderThanDays: z.coerce.number().int().positive().min(7).default(90),
        })
        .parse(req.query);

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await prisma.activityLog.deleteMany({
        where: {
          createdAt: { lt: cutoffDate },
        },
      });

      res.json({
        success: true,
        data: {
          deletedCount: result.count,
          cutoffDate: cutoffDate.toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);
