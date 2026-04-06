/**
 * Audit Log Routes
 * 
 * Comprehensive audit trail system with full before/after snapshots.
 * Unlike activity logs (which are simple descriptions), audit logs store
 * the complete entity state before and after changes for compliance and debugging.
 * 
 * Features:
 * - Full entity snapshots (before/after)
 * - Change diffing with field-level granularity
 * - Advanced filtering by entity, action, user, date range
 * - Entity history timeline
 * - Audit report generation
 * - Compliance export
 */

import { Router } from 'express';
import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/client.js';
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth.js';
import { UserRole } from '@erp/shared';
import { AuditEntityType, AuditAction, ChangeSource, Prisma } from '@prisma/client';
import { buildTokenizedSearchWhere } from '../lib/fuzzy-search.js';

export const auditLogRouter = Router();

// All routes require authentication
auditLogRouter.use(authenticate);

// Async handler wrapper
const asyncHandler = (fn: (req: AuthRequest, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: AuthRequest, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// Field change interface
interface FieldChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  displayName?: string;
}

// Entity audit summary interface
interface EntityAuditSummary {
  entityType: AuditEntityType;
  entityId: string;
  entityName: string | null;
  totalChanges: number;
  firstChange: Date;
  lastChange: Date;
  uniqueUsers: number;
  actionCounts: Record<AuditAction, number>;
}

// Admin-only middleware
const requireAdmin = requireRole(UserRole.ADMIN);
const requireManagerOrAdmin = requireRole(UserRole.ADMIN, UserRole.MANAGER);

// ============ Validation Schemas ============

const AuditQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(50),
  entityType: z.nativeEnum(AuditEntityType).optional(),
  entityTypes: z.string().optional(), // Comma-separated list
  entityId: z.string().optional(),
  action: z.nativeEnum(AuditAction).optional(),
  actions: z.string().optional(), // Comma-separated list
  changeSource: z.nativeEnum(ChangeSource).optional(),
  userId: z.string().uuid().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  search: z.string().optional(),
  hasChanges: z.coerce.boolean().optional(), // Only snapshots with actual changes
  sortBy: z.enum(['createdAt', 'entityType', 'action']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

type AuditQuery = z.infer<typeof AuditQuerySchema>;

const CreateAuditSnapshotSchema = z.object({
  entityType: z.nativeEnum(AuditEntityType),
  entityId: z.string(),
  entityName: z.string().optional(),
  action: z.nativeEnum(AuditAction),
  changeSource: z.nativeEnum(ChangeSource).default(ChangeSource.WEB_UI),
  beforeSnapshot: z.record(z.unknown()).optional(),
  afterSnapshot: z.record(z.unknown()).optional(),
  changedFields: z.array(z.string()).optional(),
  reason: z.string().max(500).optional(),
});

type CreateAuditSnapshotData = z.infer<typeof CreateAuditSnapshotSchema>;

const EntityHistoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(50),
  action: z.nativeEnum(AuditAction).optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});

type EntityHistoryQuery = z.infer<typeof EntityHistoryQuerySchema>;

const ExportQuerySchema = z.object({
  format: z.enum(['json', 'csv']).default('json'),
  entityType: z.nativeEnum(AuditEntityType).optional(),
  entityId: z.string().optional(),
  fromDate: z.string(),
  toDate: z.string(),
  includeSnapshots: z.coerce.boolean().default(false),
});

type ExportQuery = z.infer<typeof ExportQuerySchema>;

// ============ Utility Functions ============

/**
 * Parse comma-separated enum values
 */
function parseEnumList<T extends string>(value: string | undefined, enumObj: Record<string, T>): T[] | undefined {
  if (!value) return undefined;
  const values = value.split(',').map(v => v.trim().toUpperCase());
  return values.filter(v => Object.values(enumObj).includes(v as T)) as T[];
}

/**
 * Compare two objects and extract changed fields
 */
function extractChangedFields(before: Record<string, unknown> | null, after: Record<string, unknown> | null): FieldChange[] {
  const changes: FieldChange[] = [];
  
  if (!before && !after) return changes;
  
  const beforeObj = before || {};
  const afterObj = after || {};
  
  // Get all unique keys from both objects
  const allKeys = new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)]);
  
  for (const field of allKeys) {
    const oldValue = beforeObj[field];
    const newValue = afterObj[field];
    
    // Skip functions and undefined comparisons
    if (typeof oldValue === 'function' || typeof newValue === 'function') continue;
    
    // Deep comparison for objects/arrays
    const oldStr = JSON.stringify(oldValue);
    const newStr = JSON.stringify(newValue);
    
    if (oldStr !== newStr) {
      changes.push({
        field,
        oldValue,
        newValue,
        displayName: humanizeFieldName(field),
      });
    }
  }
  
  return changes;
}

/**
 * Convert camelCase/snake_case field names to human-readable format
 */
function humanizeFieldName(field: string): string {
  return field
    // Handle camelCase
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    // Handle snake_case
    .replace(/_/g, ' ')
    // Capitalize first letter of each word
    .replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Get request metadata for audit context
 */
function getRequestContext(req: Request): { ipAddress: string; userAgent: string; requestId?: string } {
  return {
    ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown',
    userAgent: req.headers['user-agent'] || 'unknown',
    requestId: req.headers['x-request-id'] as string | undefined,
  };
}

// ============ Routes ============

/**
 * GET /audit-log
 * List audit snapshots with advanced filtering
 */
auditLogRouter.get('/', requireManagerOrAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const query = AuditQuerySchema.parse(req.query);
  const {
    page,
    pageSize,
    entityType,
    entityTypes,
    entityId,
    action,
    actions,
    changeSource,
    userId,
    fromDate,
    toDate,
    search,
    hasChanges,
    sortBy,
    sortOrder,
  } = query;

  // Build where clause
  const where: Record<string, unknown> = {};

  // Entity type filtering (single or multiple)
  if (entityType) {
    where.entityType = entityType;
  } else if (entityTypes) {
    const types = parseEnumList(entityTypes, AuditEntityType);
    if (types && types.length > 0) {
      where.entityType = { in: types };
    }
  }

  // Entity ID filtering
  if (entityId) {
    where.entityId = entityId;
  }

  // Action filtering (single or multiple)
  if (action) {
    where.action = action;
  } else if (actions) {
    const actionList = parseEnumList(actions, AuditAction);
    if (actionList && actionList.length > 0) {
      where.action = { in: actionList };
    }
  }

  // Change source filtering
  if (changeSource) {
    where.changeSource = changeSource;
  }

  // User filtering
  if (userId) {
    where.userId = userId;
  }

  // Date range filtering
  if (fromDate || toDate) {
    where.createdAt = {};
    if (fromDate) {
      (where.createdAt as Record<string, unknown>).gte = new Date(fromDate);
    }
    if (toDate) {
      (where.createdAt as Record<string, unknown>).lte = new Date(toDate);
    }
  }

  // Only records with actual changes
  if (hasChanges) {
    where.changedFields = { isEmpty: false };
  }

  // Search across entity name and reason
  if (search) {
    const searchWhere = buildTokenizedSearchWhere(search, ['entityName', 'reason', 'entityId']);
    if (searchWhere) {
      Object.assign(where, searchWhere);
    }
  }

  // Execute query with pagination
  const [snapshots, total] = await Promise.all([
    prisma.auditSnapshot.findMany({
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
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditSnapshot.count({ where }),
  ]);

  // Optionally parse changes for display
  const snapshotsWithChanges = snapshots.map(snapshot => ({
    ...snapshot,
    changes: extractChangedFields(
      snapshot.beforeSnapshot as Record<string, unknown> | null,
      snapshot.afterSnapshot as Record<string, unknown> | null
    ),
  }));

  res.json({
    success: true,
    data: snapshotsWithChanges,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  });
}));

/**
 * GET /audit-log/:id
 * Get a specific audit snapshot with full details
 */
auditLogRouter.get('/:id', requireManagerOrAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const snapshot = await prisma.auditSnapshot.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          displayName: true,
          username: true,
          email: true,
          profilePhoto: true,
        },
      },
    },
  });

  if (!snapshot) {
    return res.status(404).json({
      success: false,
      error: 'Audit snapshot not found',
    });
  }

  // Parse changes for detailed view
  const changes = extractChangedFields(
    snapshot.beforeSnapshot as Record<string, unknown> | null,
    snapshot.afterSnapshot as Record<string, unknown> | null
  );

  res.json({
    success: true,
    data: {
      ...snapshot,
      changes,
    },
  });
}));

/**
 * GET /audit-log/entity/:entityType/:entityId
 * Get complete audit history for a specific entity
 */
auditLogRouter.get('/entity/:entityType/:entityId', requireManagerOrAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { entityType, entityId } = req.params;
  const query = EntityHistoryQuerySchema.parse(req.query);
  const { page, pageSize, action, fromDate, toDate } = query;

  // Validate entity type
  if (!Object.values(AuditEntityType).includes(entityType as AuditEntityType)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid entity type',
    });
  }

  const where: Record<string, unknown> = {
    entityType: entityType as AuditEntityType,
    entityId,
  };

  if (action) {
    where.action = action;
  }

  if (fromDate || toDate) {
    where.createdAt = {};
    if (fromDate) {
      (where.createdAt as Record<string, unknown>).gte = new Date(fromDate);
    }
    if (toDate) {
      (where.createdAt as Record<string, unknown>).lte = new Date(toDate);
    }
  }

  const [snapshots, total] = await Promise.all([
    prisma.auditSnapshot.findMany({
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
    prisma.auditSnapshot.count({ where }),
  ]);

  // Add changes to each snapshot
  const history = snapshots.map(snapshot => ({
    ...snapshot,
    changes: extractChangedFields(
      snapshot.beforeSnapshot as Record<string, unknown> | null,
      snapshot.afterSnapshot as Record<string, unknown> | null
    ),
  }));

  res.json({
    success: true,
    data: history,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
    entity: {
      type: entityType,
      id: entityId,
    },
  });
}));

/**
 * GET /audit-log/entity/:entityType/:entityId/summary
 * Get audit summary for an entity (total changes, action breakdown, etc.)
 */
auditLogRouter.get('/entity/:entityType/:entityId/summary', requireManagerOrAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { entityType, entityId } = req.params;

  // Validate entity type
  if (!Object.values(AuditEntityType).includes(entityType as AuditEntityType)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid entity type',
    });
  }

  const where = {
    entityType: entityType as AuditEntityType,
    entityId,
  };

  // Get aggregated stats
  const [totalChanges, firstSnapshot, lastSnapshot, uniqueUsers, actionCounts] = await Promise.all([
    prisma.auditSnapshot.count({ where }),
    prisma.auditSnapshot.findFirst({
      where,
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true, entityName: true },
    }),
    prisma.auditSnapshot.findFirst({
      where,
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
    prisma.auditSnapshot.groupBy({
      by: ['userId'],
      where,
    }),
    prisma.auditSnapshot.groupBy({
      by: ['action'],
      where,
      _count: { action: true },
    }),
  ]);

  // Build action counts map
  const actionCountsMap: Record<string, number> = {};
  for (const ac of actionCounts) {
    actionCountsMap[ac.action] = ac._count.action;
  }

  const summary: EntityAuditSummary = {
    entityType: entityType as AuditEntityType,
    entityId,
    entityName: firstSnapshot?.entityName || null,
    totalChanges,
    firstChange: firstSnapshot?.createdAt || new Date(),
    lastChange: lastSnapshot?.createdAt || new Date(),
    uniqueUsers: uniqueUsers.length,
    actionCounts: actionCountsMap as Record<AuditAction, number>,
  };

  res.json({
    success: true,
    data: summary,
  });
}));

/**
 * GET /audit-log/user/:userId
 * Get all audit snapshots created by a specific user
 */
auditLogRouter.get('/user/:userId', requireManagerOrAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { userId } = req.params;
  const query = AuditQuerySchema.parse(req.query);
  const { page, pageSize, entityType, action, fromDate, toDate, sortBy, sortOrder } = query;

  // Verify user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, displayName: true, username: true },
  });

  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found',
    });
  }

  const where: Record<string, unknown> = { userId };

  if (entityType) {
    where.entityType = entityType;
  }

  if (action) {
    where.action = action;
  }

  if (fromDate || toDate) {
    where.createdAt = {};
    if (fromDate) {
      (where.createdAt as Record<string, unknown>).gte = new Date(fromDate);
    }
    if (toDate) {
      (where.createdAt as Record<string, unknown>).lte = new Date(toDate);
    }
  }

  const [snapshots, total] = await Promise.all([
    prisma.auditSnapshot.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditSnapshot.count({ where }),
  ]);

  res.json({
    success: true,
    data: snapshots,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
    user,
  });
}));

/**
 * POST /audit-log
 * Create a new audit snapshot (for programmatic use)
 */
auditLogRouter.post('/', requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = CreateAuditSnapshotSchema.parse(req.body) as CreateAuditSnapshotData;
  const userId = req.userId!;
  const context = getRequestContext(req);

  // Auto-detect changed fields if not provided
  let changedFields = data.changedFields || [];
  if (changedFields.length === 0 && data.beforeSnapshot && data.afterSnapshot) {
    const changes = extractChangedFields(
      data.beforeSnapshot as Record<string, unknown>,
      data.afterSnapshot as Record<string, unknown>
    );
    changedFields = changes.map(c => c.field);
  }

  const snapshot = await prisma.auditSnapshot.create({
    data: {
      entityType: data.entityType,
      entityId: data.entityId,
      entityName: data.entityName ?? null,
      action: data.action,
      changeSource: data.changeSource ?? ChangeSource.API,
      beforeSnapshot: data.beforeSnapshot ? (data.beforeSnapshot as Prisma.InputJsonValue) : Prisma.JsonNull,
      afterSnapshot: data.afterSnapshot ? (data.afterSnapshot as Prisma.InputJsonValue) : Prisma.JsonNull,
      changedFields,
      reason: data.reason ?? null,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      requestId: context.requestId ?? null,
      userId,
    },
    include: {
      user: {
        select: {
          id: true,
          displayName: true,
          username: true,
        },
      },
    },
  });

  res.status(201).json({
    success: true,
    data: snapshot,
    message: 'Audit snapshot created',
  });
}));

/**
 * GET /audit-log/stats
 * Get audit statistics (for dashboard)
 */
auditLogRouter.get('/admin/stats', requireManagerOrAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const thisWeekStart = new Date(today);
  thisWeekStart.setDate(today.getDate() - today.getDay());

  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const [
    totalSnapshots,
    todayCount,
    weekCount,
    monthCount,
    byEntityType,
    byAction,
    byChangeSource,
    topUsers,
    recentActivity,
  ] = await Promise.all([
    // Total count
    prisma.auditSnapshot.count(),
    
    // Today's count
    prisma.auditSnapshot.count({
      where: { createdAt: { gte: today } },
    }),
    
    // This week's count
    prisma.auditSnapshot.count({
      where: { createdAt: { gte: thisWeekStart } },
    }),
    
    // This month's count
    prisma.auditSnapshot.count({
      where: { createdAt: { gte: thisMonthStart } },
    }),
    
    // Breakdown by entity type
    prisma.auditSnapshot.groupBy({
      by: ['entityType'],
      _count: { entityType: true },
      orderBy: { _count: { entityType: 'desc' } },
    }),
    
    // Breakdown by action
    prisma.auditSnapshot.groupBy({
      by: ['action'],
      _count: { action: true },
      orderBy: { _count: { action: 'desc' } },
    }),
    
    // Breakdown by change source
    prisma.auditSnapshot.groupBy({
      by: ['changeSource'],
      _count: { changeSource: true },
      orderBy: { _count: { changeSource: 'desc' } },
    }),
    
    // Top 10 users by activity
    prisma.auditSnapshot.groupBy({
      by: ['userId'],
      _count: { userId: true },
      orderBy: { _count: { userId: 'desc' } },
      take: 10,
    }),
    
    // Recent activity (last 24 hours by hour)
    prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('hour', "createdAt") as hour,
        COUNT(*) as count
      FROM "AuditSnapshot"
      WHERE "createdAt" >= NOW() - INTERVAL '24 hours'
      GROUP BY DATE_TRUNC('hour', "createdAt")
      ORDER BY hour DESC
    ` as Promise<Array<{ hour: Date; count: bigint }>>,
  ]);

  // Fetch user details for top users
  const userIds = topUsers.map(u => u.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, displayName: true, username: true },
  });

  const topUsersWithDetails = topUsers.map(u => ({
    count: u._count.userId,
    user: users.find(user => user.id === u.userId),
  }));

  res.json({
    success: true,
    data: {
      counts: {
        total: totalSnapshots,
        today: todayCount,
        thisWeek: weekCount,
        thisMonth: monthCount,
      },
      byEntityType: byEntityType.map(e => ({
        entityType: e.entityType,
        count: e._count.entityType,
      })),
      byAction: byAction.map(a => ({
        action: a.action,
        count: a._count.action,
      })),
      byChangeSource: byChangeSource.map(s => ({
        changeSource: s.changeSource,
        count: s._count.changeSource,
      })),
      topUsers: topUsersWithDetails,
      recentActivity: recentActivity.map(r => ({
        hour: r.hour,
        count: Number(r.count),
      })),
    },
  });
}));

/**
 * GET /audit-log/export
 * Export audit logs for compliance reporting
 */
auditLogRouter.get('/admin/export', requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const query = ExportQuerySchema.parse(req.query);
  const { format, entityType, entityId, fromDate, toDate, includeSnapshots } = query;

  const where: Record<string, unknown> = {
    createdAt: {
      gte: new Date(fromDate),
      lte: new Date(toDate),
    },
  };

  if (entityType) {
    where.entityType = entityType;
  }

  if (entityId) {
    where.entityId = entityId;
  }

  // Get all matching snapshots (limit to prevent memory issues)
  const snapshots = await prisma.auditSnapshot.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          displayName: true,
          username: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
    take: 10000, // Safety limit
  });

  if (format === 'json') {
    const data = snapshots.map(s => ({
      id: s.id,
      entityType: s.entityType,
      entityId: s.entityId,
      entityName: s.entityName,
      action: s.action,
      changeSource: s.changeSource,
      changedFields: s.changedFields,
      reason: s.reason,
      createdAt: s.createdAt.toISOString(),
      user: {
        id: s.user.id,
        displayName: s.user.displayName,
        username: s.user.username,
        email: s.user.email,
      },
      ...(includeSnapshots ? {
        beforeSnapshot: s.beforeSnapshot,
        afterSnapshot: s.afterSnapshot,
      } : {}),
    }));

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="audit-log-export-${fromDate}-to-${toDate}.json"`);
    res.json({
      exportDate: new Date().toISOString(),
      dateRange: { from: fromDate, to: toDate },
      totalRecords: data.length,
      records: data,
    });
  } else {
    // CSV format
    const csvHeaders = [
      'ID',
      'Timestamp',
      'Entity Type',
      'Entity ID',
      'Entity Name',
      'Action',
      'Change Source',
      'Changed Fields',
      'Reason',
      'User ID',
      'User Name',
      'User Email',
    ];

    const csvRows = snapshots.map(s => [
      s.id,
      s.createdAt.toISOString(),
      s.entityType,
      s.entityId,
      s.entityName || '',
      s.action,
      s.changeSource,
      s.changedFields.join('; '),
      (s.reason || '').replace(/"/g, '""'),
      s.user.id,
      s.user.displayName || '',
      s.user.email || '',
    ]);

    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.map(v => `"${v}"`).join(',')),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="audit-log-export-${fromDate}-to-${toDate}.csv"`);
    res.send(csvContent);
  }
}));

/**
 * GET /audit-log/compare/:id1/:id2
 * Compare two snapshots to see what changed between them
 */
auditLogRouter.get('/compare/:id1/:id2', requireManagerOrAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id1, id2 } = req.params;

  const [snapshot1, snapshot2] = await Promise.all([
    prisma.auditSnapshot.findUnique({
      where: { id: id1 },
      include: {
        user: {
          select: { id: true, displayName: true },
        },
      },
    }),
    prisma.auditSnapshot.findUnique({
      where: { id: id2 },
      include: {
        user: {
          select: { id: true, displayName: true },
        },
      },
    }),
  ]);

  if (!snapshot1 || !snapshot2) {
    return res.status(404).json({
      success: false,
      error: 'One or both snapshots not found',
    });
  }

  // Ensure they're for the same entity
  if (snapshot1.entityType !== snapshot2.entityType || snapshot1.entityId !== snapshot2.entityId) {
    return res.status(400).json({
      success: false,
      error: 'Snapshots must be for the same entity',
    });
  }

  // Order by time
  const [earlier, later] = snapshot1.createdAt < snapshot2.createdAt 
    ? [snapshot1, snapshot2] 
    : [snapshot2, snapshot1];

  // Compare the "after" state of earlier with "before" state of later
  // This shows what might have changed between these two audit points
  const stateAtEarlier = earlier.afterSnapshot as Record<string, unknown> | null;
  const stateAtLater = later.beforeSnapshot as Record<string, unknown> | null;

  const changes = extractChangedFields(stateAtEarlier, stateAtLater);

  res.json({
    success: true,
    data: {
      earlier: {
        id: earlier.id,
        action: earlier.action,
        createdAt: earlier.createdAt,
        user: earlier.user,
      },
      later: {
        id: later.id,
        action: later.action,
        createdAt: later.createdAt,
        user: later.user,
      },
      entity: {
        type: earlier.entityType,
        id: earlier.entityId,
        name: earlier.entityName || later.entityName,
      },
      changesInBetween: changes,
    },
  });
}));

/**
 * GET /audit-log/timeline/:entityType/:entityId
 * Get a visual timeline of all changes to an entity
 */
auditLogRouter.get('/timeline/:entityType/:entityId', requireManagerOrAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { entityType, entityId } = req.params;

  // Validate entity type
  if (!Object.values(AuditEntityType).includes(entityType as AuditEntityType)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid entity type',
    });
  }

  const snapshots = await prisma.auditSnapshot.findMany({
    where: {
      entityType: entityType as AuditEntityType,
      entityId,
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
    orderBy: { createdAt: 'asc' },
  });

  // Build timeline with changes
  const timeline = snapshots.map((snapshot, index) => {
    const changes = extractChangedFields(
      snapshot.beforeSnapshot as Record<string, unknown> | null,
      snapshot.afterSnapshot as Record<string, unknown> | null
    );

    return {
      id: snapshot.id,
      timestamp: snapshot.createdAt,
      action: snapshot.action,
      changeSource: snapshot.changeSource,
      user: snapshot.user,
      reason: snapshot.reason,
      changedFields: snapshot.changedFields,
      changes,
      isFirst: index === 0,
      isLast: index === snapshots.length - 1,
    };
  });

  res.json({
    success: true,
    data: {
      entity: {
        type: entityType,
        id: entityId,
        name: snapshots[0]?.entityName || null,
      },
      timeline,
      totalEvents: timeline.length,
      dateRange: timeline.length > 0 ? {
        first: timeline[0].timestamp,
        last: timeline[timeline.length - 1].timestamp,
      } : null,
    },
  });
}));

/**
 * DELETE /audit-log/admin/purge
 * Purge old audit logs (Admin only, for compliance periods)
 */
auditLogRouter.delete('/admin/purge', requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const PurgeSchema = z.object({
    olderThanDays: z.coerce.number().int().min(365), // Minimum 1 year retention
    confirm: z.literal(true),
  });

  const data = PurgeSchema.parse(req.body);
  const userId = req.userId!;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - data.olderThanDays);

  // Count before delete
  const countToDelete = await prisma.auditSnapshot.count({
    where: { createdAt: { lt: cutoffDate } },
  });

  if (countToDelete === 0) {
    return res.json({
      success: true,
      data: { deleted: 0 },
      message: 'No audit logs older than the specified period',
    });
  }

  // Delete old records
  const result = await prisma.auditSnapshot.deleteMany({
    where: { createdAt: { lt: cutoffDate } },
  });

  // Log this action (meta!)
  await prisma.auditSnapshot.create({
    data: {
      entityType: AuditEntityType.SYSTEM_SETTING,
      entityId: 'audit-purge',
      entityName: 'Audit Log Purge',
      action: AuditAction.DELETE,
      changeSource: ChangeSource.WEB_UI,
      afterSnapshot: {
        olderThanDays: data.olderThanDays,
        deletedCount: result.count,
        cutoffDate: cutoffDate.toISOString(),
      },
      changedFields: ['purge'],
      reason: `Purged ${result.count} audit records older than ${data.olderThanDays} days`,
      userId,
    },
  });

  res.json({
    success: true,
    data: { deleted: result.count },
    message: `Purged ${result.count} audit logs older than ${data.olderThanDays} days`,
  });
}));

/**
 * GET /audit-log/search
 * Full-text search across audit logs
 */
auditLogRouter.get('/search', requireManagerOrAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const SearchSchema = z.object({
    q: z.string().min(2),
    limit: z.coerce.number().int().positive().max(50).default(20),
  });

  const { q, limit } = SearchSchema.parse(req.query);

  const snapshots = await prisma.auditSnapshot.findMany({
    where: {
      OR: [
        { entityName: { contains: q, mode: 'insensitive' } },
        { entityId: { contains: q, mode: 'insensitive' } },
        { reason: { contains: q, mode: 'insensitive' } },
      ],
    },
    include: {
      user: {
        select: {
          id: true,
          displayName: true,
          username: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  res.json({
    success: true,
    data: snapshots,
    query: q,
    count: snapshots.length,
  });
}));

// ============ Audit Helper Function (for use by other routes) ============

// Audit Snapshot return type
interface AuditSnapshotResult {
  id: string;
  entityType: AuditEntityType;
  entityId: string;
  entityName: string | null;
  action: AuditAction;
  changeSource: ChangeSource;
  beforeSnapshot: Prisma.JsonValue;
  afterSnapshot: Prisma.JsonValue;
  changedFields: string[];
  reason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
  createdAt: Date;
  userId: string;
  user?: {
    id: string;
    displayName: string | null;
    username: string;
  };
}

/**
 * Create an audit snapshot from another route
 * This is exported for use by other route files
 */
export async function createAuditSnapshot(params: {
  entityType: AuditEntityType;
  entityId: string;
  entityName?: string;
  action: AuditAction;
  changeSource?: ChangeSource;
  beforeSnapshot?: Record<string, unknown>;
  afterSnapshot?: Record<string, unknown>;
  changedFields?: string[];
  reason?: string;
  userId: string;
  req?: Request;
}): Promise<AuditSnapshotResult | null> {
  try {
    const {
      entityType,
      entityId,
      entityName,
      action,
      changeSource = ChangeSource.WEB_UI,
      beforeSnapshot,
      afterSnapshot,
      changedFields: providedFields,
      reason,
      userId,
      req,
    } = params;

    // Auto-detect changed fields if not provided
    let changedFields = providedFields || [];
    if (changedFields.length === 0 && beforeSnapshot && afterSnapshot) {
      const changes = extractChangedFields(beforeSnapshot, afterSnapshot);
      changedFields = changes.map(c => c.field);
    }

    const context = req ? getRequestContext(req) : { ipAddress: 'system', userAgent: 'system' };

    const snapshot = await prisma.auditSnapshot.create({
      data: {
        entityType,
        entityId,
        entityName: entityName ?? null,
        action,
        changeSource,
        beforeSnapshot: beforeSnapshot ? (beforeSnapshot as Prisma.InputJsonValue) : Prisma.JsonNull,
        afterSnapshot: afterSnapshot ? (afterSnapshot as Prisma.InputJsonValue) : Prisma.JsonNull,
        changedFields,
        reason: reason ?? null,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        requestId: (req?.headers['x-request-id'] as string) ?? null,
        userId,
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            username: true,
          },
        },
      },
    });

    return snapshot;
  } catch (error) {
    console.error('Failed to create audit snapshot:', error);
    return null;
  }
}
