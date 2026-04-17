/**
 * Alerts Router - API-011
 * 
 * Configurable system alerts for low inventory, overdue orders, equipment
 * maintenance, and other business-critical notifications.
 * 
 * Created by: AGENT-01
 * Date: 2026-01-29
 */

import { Router, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth.js';
import { NotFoundError, BadRequestError } from '../middleware/error-handler.js';
import { broadcast } from '../ws/server.js';
import { buildRouteBroadcastPayload } from '../lib/route-broadcast.js';
import { UserRole } from '@erp/shared';
import {
  AlertType,
  AlertSeverity,
  AlertTriggerType,
  InventoryStatus,
} from '@prisma/client';
import type { Prisma } from '@prisma/client';

export const alertsRouter = Router();

// All routes require authentication
alertsRouter.use(authenticate);

// Role check helper
const requireAdmin = requireRole(UserRole.ADMIN);
const requireManagerOrAdmin = requireRole(UserRole.ADMIN, UserRole.MANAGER);

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const CreateAlertSchema = z.object({
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(2000),
  type: z.nativeEnum(AlertType).default(AlertType.INFO),
  severity: z.nativeEnum(AlertSeverity).default(AlertSeverity.MEDIUM),
  isGlobal: z.boolean().default(false),
  targetRoles: z.array(z.nativeEnum(UserRole)).optional().default([]),
  isDismissible: z.boolean().default(true),
  showOnPages: z.array(z.string()).optional().default([]),
  startsAt: z.string().datetime().optional().transform(v => v ? new Date(v) : new Date()),
  expiresAt: z.string().datetime().optional().nullable().transform(v => v ? new Date(v) : null),
});

const UpdateAlertSchema = CreateAlertSchema.partial().extend({
  isActive: z.boolean().optional(),
});

const AlertFilterSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  type: z.nativeEnum(AlertType).optional(),
  severity: z.nativeEnum(AlertSeverity).optional(),
  isActive: z.enum(['true', 'false', 'all']).default('all'),
  isGlobal: z.enum(['true', 'false', 'all']).default('all'),
});

const CreateAlertRuleSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  triggerType: z.nativeEnum(AlertTriggerType),
  triggerConfig: z.record(z.unknown()),
  alertType: z.nativeEnum(AlertType).default(AlertType.WARNING),
  alertSeverity: z.nativeEnum(AlertSeverity).default(AlertSeverity.MEDIUM),
  titleTemplate: z.string().min(1).max(200),
  messageTemplate: z.string().min(1).max(2000),
  isActive: z.boolean().default(true),
  cooldownMinutes: z.number().int().min(1).default(60),
});

const UpdateAlertRuleSchema = CreateAlertRuleSchema.partial();

const AlertRuleFilterSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  triggerType: z.nativeEnum(AlertTriggerType).optional(),
  isActive: z.enum(['true', 'false', 'all']).default('all'),
});

const AlertHistoryFilterSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(50),
  type: z.nativeEnum(AlertType).optional(),
  severity: z.nativeEnum(AlertSeverity).optional(),
  entityType: z.string().optional(),
  resolved: z.enum(['true', 'false', 'all']).default('all'),
  startDate: z.string().datetime().optional().transform(v => v ? new Date(v) : undefined),
  endDate: z.string().datetime().optional().transform(v => v ? new Date(v) : undefined),
});

type CreateAlertInput = z.infer<typeof CreateAlertSchema>;
type UpdateAlertInput = z.infer<typeof UpdateAlertSchema>;
type AlertFilterInput = z.infer<typeof AlertFilterSchema>;
type CreateAlertRuleInput = z.infer<typeof CreateAlertRuleSchema>;
type UpdateAlertRuleInput = z.infer<typeof UpdateAlertRuleSchema>;
type AlertRuleFilterInput = z.infer<typeof AlertRuleFilterSchema>;
type AlertHistoryFilterInput = z.infer<typeof AlertHistoryFilterSchema>;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Template interpolation helper
 * Replaces {{variable}} with values from data object
 */
function interpolateTemplate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = data[key];
    return value !== undefined && value !== null ? String(value) : '';
  });
}

/**
 * Check if an alert rule is in cooldown
 */
function isInCooldown(rule: { lastTriggeredAt: Date | null; cooldownMinutes: number }): boolean {
  if (!rule.lastTriggeredAt) return false;
  const cooldownEnd = new Date(rule.lastTriggeredAt.getTime() + rule.cooldownMinutes * 60 * 1000);
  return new Date() < cooldownEnd;
}

// =============================================================================
// USER-FACING ALERT ENDPOINTS
// =============================================================================

/**
 * GET /api/alerts/active
 * Get active alerts for the current user based on their role
 */
alertsRouter.get('/active', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const userRole = req.user?.role as UserRole;
  const now = new Date();

  // Get alerts the user hasn't dismissed
  const dismissedAlertIds = await prisma.alertDismissal.findMany({
    where: { userId },
    select: { alertId: true },
  });

  const dismissedIds = dismissedAlertIds.map(d => d.alertId);

  const alerts = await prisma.alert.findMany({
    where: {
      isActive: true,
      startsAt: { lte: now },
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: now } },
      ],
      id: dismissedIds.length > 0 ? { notIn: dismissedIds } : undefined,
      AND: [
        {
          OR: [
            { isGlobal: true },
            { targetRoles: { has: userRole } },
          ],
        },
      ],
    },
    include: {
      createdBy: { select: { displayName: true } },
    },
    orderBy: [
      { severity: 'desc' },
      { createdAt: 'desc' },
    ],
  });

  res.json({ success: true, data: alerts });
});

/**
 * POST /api/alerts/:id/dismiss
 * Dismiss an alert for the current user
 */
alertsRouter.post('/:id/dismiss', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const alertId = req.params.id;

  const alert = await prisma.alert.findUnique({
    where: { id: alertId },
    select: { id: true, isDismissible: true },
  });

  if (!alert) {
    throw NotFoundError('Alert not found');
  }

  if (!alert.isDismissible) {
    throw BadRequestError('This alert cannot be dismissed');
  }

  // Create dismissal record (upsert in case of duplicates)
  await prisma.alertDismissal.upsert({
    where: {
      alertId_userId: { alertId, userId },
    },
    create: { alertId, userId },
    update: { dismissedAt: new Date() },
  });

  res.json({ success: true, message: 'Alert dismissed' });
});

/**
 * POST /api/alerts/dismiss-all
 * Dismiss all dismissible alerts for the current user
 */
alertsRouter.post('/dismiss-all', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const userRole = req.user?.role as UserRole;
  const now = new Date();

  // Get all active, dismissible alerts for user
  const alerts = await prisma.alert.findMany({
    where: {
      isActive: true,
      isDismissible: true,
      startsAt: { lte: now },
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: now } },
      ],
      AND: [
        {
          OR: [
            { isGlobal: true },
            { targetRoles: { has: userRole } },
          ],
        },
      ],
    },
    select: { id: true },
  });

  // Create dismissals
  const dismissals = alerts.map(alert => ({
    alertId: alert.id,
    userId,
  }));

  await prisma.alertDismissal.createMany({
    data: dismissals,
    skipDuplicates: true,
  });

  res.json({ success: true, message: `Dismissed ${alerts.length} alerts` });
});

// =============================================================================
// ALERT MANAGEMENT (Admin/Manager)
// =============================================================================

/**
 * GET /api/alerts
 * List all alerts with filtering (Admin/Manager only)
 */
alertsRouter.get('/', requireManagerOrAdmin, async (req: AuthRequest, res: Response) => {
  const filters: AlertFilterInput = AlertFilterSchema.parse(req.query);
  const { page, pageSize, type, severity, isActive, isGlobal } = filters;

  const where: Prisma.AlertWhereInput = {};

  if (type) where.type = type;
  if (severity) where.severity = severity;
  if (isActive !== 'all') where.isActive = isActive === 'true';
  if (isGlobal !== 'all') where.isGlobal = isGlobal === 'true';

  const [alerts, total] = await Promise.all([
    prisma.alert.findMany({
      where,
      include: {
        createdBy: { select: { displayName: true } },
        _count: { select: { dismissedBy: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.alert.count({ where }),
  ]);

  res.json({
    success: true,
    data: {
      items: alerts,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  });
});

/**
 * GET /api/alerts/:id
 * Get specific alert details
 */
alertsRouter.get('/:id', requireManagerOrAdmin, async (req: AuthRequest, res: Response) => {
  const alert = await prisma.alert.findUnique({
    where: { id: req.params.id },
    include: {
      createdBy: { select: { displayName: true } },
      dismissedBy: {
        include: { user: { select: { displayName: true } } },
        orderBy: { dismissedAt: 'desc' },
        take: 50,
      },
      history: {
        orderBy: { triggeredAt: 'desc' },
        take: 20,
      },
    },
  });

  if (!alert) {
    throw NotFoundError('Alert not found');
  }

  res.json({ success: true, data: alert });
});

/**
 * POST /api/alerts
 * Create a new alert (Admin only)
 */
alertsRouter.post('/', requireAdmin, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const data: CreateAlertInput = CreateAlertSchema.parse(req.body);

  const alert = await prisma.alert.create({
    data: {
      title: data.title,
      message: data.message,
      type: data.type,
      severity: data.severity,
      isGlobal: data.isGlobal,
      targetRoles: data.targetRoles,
      isDismissible: data.isDismissible,
      showOnPages: data.showOnPages,
      startsAt: data.startsAt,
      expiresAt: data.expiresAt,
      createdById: userId,
    },
    include: {
      createdBy: { select: { displayName: true } },
    },
  });

  // Broadcast to connected users
  broadcast(buildRouteBroadcastPayload({ type: 'ALERT_CREATED', payload: alert }));

  res.status(201).json({ success: true, data: alert });
});

/**
 * PATCH /api/alerts/:id
 * Update an alert (Admin only)
 */
alertsRouter.patch('/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  const data: UpdateAlertInput = UpdateAlertSchema.parse(req.body);

  const existing = await prisma.alert.findUnique({
    where: { id: req.params.id },
    select: { id: true },
  });

  if (!existing) {
    throw NotFoundError('Alert not found');
  }

  const updateData: Prisma.AlertUpdateInput = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.message !== undefined) updateData.message = data.message;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.severity !== undefined) updateData.severity = data.severity;
  if (data.isGlobal !== undefined) updateData.isGlobal = data.isGlobal;
  if (data.targetRoles !== undefined) updateData.targetRoles = data.targetRoles;
  if (data.isDismissible !== undefined) updateData.isDismissible = data.isDismissible;
  if (data.showOnPages !== undefined) updateData.showOnPages = data.showOnPages;
  if (data.startsAt !== undefined) updateData.startsAt = data.startsAt;
  if (data.expiresAt !== undefined) updateData.expiresAt = data.expiresAt;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  const alert = await prisma.alert.update({
    where: { id: req.params.id },
    data: updateData,
    include: {
      createdBy: { select: { displayName: true } },
    },
  });

  broadcast(buildRouteBroadcastPayload({ type: 'ALERT_UPDATED', payload: alert }));

  res.json({ success: true, data: alert });
});

/**
 * DELETE /api/alerts/:id
 * Delete an alert (Admin only)
 */
alertsRouter.delete('/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  const existing = await prisma.alert.findUnique({
    where: { id: req.params.id },
    select: { id: true },
  });

  if (!existing) {
    throw NotFoundError('Alert not found');
  }

  await prisma.alert.delete({ where: { id: req.params.id } });

  broadcast(buildRouteBroadcastPayload({ type: 'ALERT_DELETED', payload: { id: req.params.id } }));

  res.json({ success: true, message: 'Alert deleted' });
});

// =============================================================================
// ALERT RULES (Admin only)
// =============================================================================

/**
 * GET /api/alerts/rules
 * List all alert rules
 */
alertsRouter.get('/rules', requireAdmin, async (req: AuthRequest, res: Response) => {
  const filters: AlertRuleFilterInput = AlertRuleFilterSchema.parse(req.query);
  const { page, pageSize, triggerType, isActive } = filters;

  const where: Prisma.AlertRuleWhereInput = {};

  if (triggerType) where.triggerType = triggerType;
  if (isActive !== 'all') where.isActive = isActive === 'true';

  const [rules, total] = await Promise.all([
    prisma.alertRule.findMany({
      where,
      include: {
        createdBy: { select: { displayName: true } },
        _count: { select: { generatedAlerts: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.alertRule.count({ where }),
  ]);

  res.json({
    success: true,
    data: {
      items: rules,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  });
});

/**
 * GET /api/alerts/rules/:id
 * Get specific alert rule
 */
alertsRouter.get('/rules/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  const rule = await prisma.alertRule.findUnique({
    where: { id: req.params.id },
    include: {
      createdBy: { select: { displayName: true } },
      generatedAlerts: {
        orderBy: { triggeredAt: 'desc' },
        take: 50,
      },
    },
  });

  if (!rule) {
    throw NotFoundError('Alert rule not found');
  }

  res.json({ success: true, data: rule });
});

/**
 * POST /api/alerts/rules
 * Create a new alert rule
 */
alertsRouter.post('/rules', requireAdmin, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const data: CreateAlertRuleInput = CreateAlertRuleSchema.parse(req.body);

  const rule = await prisma.alertRule.create({
    data: {
      name: data.name,
      description: data.description,
      triggerType: data.triggerType,
      triggerConfig: data.triggerConfig as Prisma.InputJsonValue,
      alertType: data.alertType,
      alertSeverity: data.alertSeverity,
      titleTemplate: data.titleTemplate,
      messageTemplate: data.messageTemplate,
      isActive: data.isActive,
      cooldownMinutes: data.cooldownMinutes,
      createdById: userId,
    },
    include: {
      createdBy: { select: { displayName: true } },
    },
  });

  res.status(201).json({ success: true, data: rule });
});

/**
 * PATCH /api/alerts/rules/:id
 * Update an alert rule
 */
alertsRouter.patch('/rules/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  const data: UpdateAlertRuleInput = UpdateAlertRuleSchema.parse(req.body);

  const existing = await prisma.alertRule.findUnique({
    where: { id: req.params.id },
    select: { id: true },
  });

  if (!existing) {
    throw NotFoundError('Alert rule not found');
  }

  const updateData: Prisma.AlertRuleUpdateInput = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.triggerType !== undefined) updateData.triggerType = data.triggerType;
  if (data.triggerConfig !== undefined) updateData.triggerConfig = data.triggerConfig as Prisma.InputJsonValue;
  if (data.alertType !== undefined) updateData.alertType = data.alertType;
  if (data.alertSeverity !== undefined) updateData.alertSeverity = data.alertSeverity;
  if (data.titleTemplate !== undefined) updateData.titleTemplate = data.titleTemplate;
  if (data.messageTemplate !== undefined) updateData.messageTemplate = data.messageTemplate;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.cooldownMinutes !== undefined) updateData.cooldownMinutes = data.cooldownMinutes;

  const rule = await prisma.alertRule.update({
    where: { id: req.params.id },
    data: updateData,
    include: {
      createdBy: { select: { displayName: true } },
    },
  });

  res.json({ success: true, data: rule });
});

/**
 * DELETE /api/alerts/rules/:id
 * Delete an alert rule
 */
alertsRouter.delete('/rules/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  const existing = await prisma.alertRule.findUnique({
    where: { id: req.params.id },
    select: { id: true },
  });

  if (!existing) {
    throw NotFoundError('Alert rule not found');
  }

  await prisma.alertRule.delete({ where: { id: req.params.id } });

  res.json({ success: true, message: 'Alert rule deleted' });
});

/**
 * POST /api/alerts/rules/:id/trigger
 * Manually trigger an alert rule (for testing)
 */
alertsRouter.post('/rules/:id/trigger', requireAdmin, async (req: AuthRequest, res: Response) => {
  const rule = await prisma.alertRule.findUnique({
    where: { id: req.params.id },
  });

  if (!rule) {
    throw NotFoundError('Alert rule not found');
  }

  if (!rule.isActive) {
    throw BadRequestError('This rule is not active');
  }

  // Create alert history entry
  const history = await prisma.alertHistory.create({
    data: {
      title: rule.titleTemplate,
      message: rule.messageTemplate,
      type: rule.alertType,
      severity: rule.alertSeverity,
      entityType: 'MANUAL_TRIGGER',
      alertRuleId: rule.id,
      metadata: { triggeredManually: true, triggeredAt: new Date().toISOString() } as Prisma.InputJsonValue,
    },
  });

  // Update last triggered time
  await prisma.alertRule.update({
    where: { id: rule.id },
    data: { lastTriggeredAt: new Date() },
  });

  broadcast(buildRouteBroadcastPayload({ type: 'ALERT_TRIGGERED', payload: history }));

  res.json({ success: true, data: history });
});

// =============================================================================
// ALERT HISTORY
// =============================================================================

/**
 * GET /api/alerts/history
 * Get alert history
 */
alertsRouter.get('/history', requireManagerOrAdmin, async (req: AuthRequest, res: Response) => {
  const filters: AlertHistoryFilterInput = AlertHistoryFilterSchema.parse(req.query);
  const { page, pageSize, type, severity, entityType, resolved, startDate, endDate } = filters;

  const where: Prisma.AlertHistoryWhereInput = {};

  if (type) where.type = type;
  if (severity) where.severity = severity;
  if (entityType) where.entityType = entityType;
  if (resolved === 'true') where.resolvedAt = { not: null };
  if (resolved === 'false') where.resolvedAt = null;
  
  if (startDate || endDate) {
    where.triggeredAt = {};
    if (startDate) where.triggeredAt.gte = startDate;
    if (endDate) where.triggeredAt.lte = endDate;
  }

  const [history, total] = await Promise.all([
    prisma.alertHistory.findMany({
      where,
      include: {
        alert: { select: { title: true } },
        alertRule: { select: { name: true } },
        resolvedBy: { select: { displayName: true } },
      },
      orderBy: { triggeredAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.alertHistory.count({ where }),
  ]);

  res.json({
    success: true,
    data: {
      items: history,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  });
});

/**
 * POST /api/alerts/history/:id/resolve
 * Mark an alert history entry as resolved
 */
alertsRouter.post('/history/:id/resolve', requireManagerOrAdmin, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;

  const existing = await prisma.alertHistory.findUnique({
    where: { id: req.params.id },
    select: { id: true, resolvedAt: true },
  });

  if (!existing) {
    throw NotFoundError('Alert history entry not found');
  }

  if (existing.resolvedAt) {
    throw BadRequestError('This alert has already been resolved');
  }

  const history = await prisma.alertHistory.update({
    where: { id: req.params.id },
    data: {
      resolvedAt: new Date(),
      resolvedById: userId,
    },
    include: {
      resolvedBy: { select: { displayName: true } },
    },
  });

  res.json({ success: true, data: history });
});

// =============================================================================
// ALERT RULE PROCESSOR (Exported for use by cron/scheduler)
// =============================================================================

/**
 * Process all active alert rules and trigger alerts as needed
 * This should be called periodically (e.g., every 5 minutes)
 */
export async function processAlertRules(): Promise<{ processed: number; triggered: number; errors: number }> {
  const result = { processed: 0, triggered: 0, errors: 0 };

  const rules = await prisma.alertRule.findMany({
    where: { isActive: true },
  });

  for (const rule of rules) {
    result.processed++;

    try {
      // Check cooldown
      if (isInCooldown(rule)) {
        continue;
      }

      const config = rule.triggerConfig as Record<string, unknown>;
      let shouldTrigger = false;
      let context: Record<string, unknown> = {};

      switch (rule.triggerType) {
        case AlertTriggerType.INVENTORY_LOW_STOCK: {
          const threshold = (config.threshold as number) || 10;
          const lowStockItems = await prisma.itemMaster.findMany({
            where: {
              isActive: true,
            },
            include: {
              inventoryItems: {
                where: { status: InventoryStatus.AVAILABLE },
              },
            },
          });

          const itemsBelow = lowStockItems.filter(item => {
            const totalQty = item.inventoryItems.reduce((sum, inv) => sum + inv.quantity, 0);
            return totalQty < threshold;
          });

          if (itemsBelow.length > 0) {
            shouldTrigger = true;
            context = {
              count: itemsBelow.length,
              items: itemsBelow.slice(0, 5).map(i => i.name).join(', '),
              threshold,
            };
          }
          break;
        }

        case AlertTriggerType.INVENTORY_DEPLETED: {
          const depletedItems = await prisma.itemMaster.findMany({
            where: {
              isActive: true,
              inventoryItems: {
                every: { status: InventoryStatus.DEPLETED },
              },
            },
          });

          if (depletedItems.length > 0) {
            shouldTrigger = true;
            context = {
              count: depletedItems.length,
              items: depletedItems.slice(0, 5).map(i => i.name).join(', '),
            };
          }
          break;
        }

        case AlertTriggerType.ORDER_OVERDUE: {
          const now = new Date();
          const overdueOrders = await prisma.workOrder.findMany({
            where: {
              status: { notIn: ['COMPLETED', 'SHIPPED', 'CANCELLED'] },
              dueDate: { lt: now },
            },
          });

          if (overdueOrders.length > 0) {
            shouldTrigger = true;
            context = {
              count: overdueOrders.length,
              orders: overdueOrders.slice(0, 5).map(o => o.orderNumber).join(', '),
            };
          }
          break;
        }

        case AlertTriggerType.ORDER_STUCK_IN_STATION: {
          const hoursThreshold = (config.hoursThreshold as number) || 48;
          const cutoff = new Date(Date.now() - hoursThreshold * 60 * 60 * 1000);
          
          const stuckProgress = await prisma.stationProgress.findMany({
            where: {
              status: 'IN_PROGRESS',
              startedAt: { lt: cutoff },
              completedAt: null,
            },
            include: {
              order: { select: { orderNumber: true, customerName: true } },
            },
          });

          if (stuckProgress.length > 0) {
            shouldTrigger = true;
            context = {
              count: stuckProgress.length,
              orders: stuckProgress.slice(0, 5).map(sp => sp.order.orderNumber).join(', '),
              hoursThreshold,
            };
          }
          break;
        }

        case AlertTriggerType.QUOTE_EXPIRING: {
          const daysAhead = (config.daysAhead as number) || 7;
          const now = new Date();
          const cutoff = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
          
          const expiringQuotes = await prisma.quote.findMany({
            where: {
              status: 'SENT',
              validUntil: {
                gte: now,
                lte: cutoff,
              },
            },
          });

          if (expiringQuotes.length > 0) {
            shouldTrigger = true;
            context = {
              count: expiringQuotes.length,
              quotes: expiringQuotes.slice(0, 5).map(q => q.quoteNumber).join(', '),
              daysAhead,
            };
          }
          break;
        }

        case AlertTriggerType.SCHEDULED:
        case AlertTriggerType.MANUAL:
        case AlertTriggerType.API_TRIGGERED:
          // These are not auto-processed
          continue;

        default:
          // Unknown trigger type, skip
          continue;
      }

      if (shouldTrigger) {
        // Create alert history
        const title = interpolateTemplate(rule.titleTemplate, context);
        const message = interpolateTemplate(rule.messageTemplate, context);

        await prisma.alertHistory.create({
          data: {
            title,
            message,
            type: rule.alertType,
            severity: rule.alertSeverity,
            entityType: rule.triggerType,
            alertRuleId: rule.id,
            metadata: context as Prisma.InputJsonValue,
          },
        });

        // Update last triggered
        await prisma.alertRule.update({
          where: { id: rule.id },
          data: { lastTriggeredAt: new Date() },
        });

        result.triggered++;

        // Broadcast
        broadcast(buildRouteBroadcastPayload({
          type: 'ALERT_TRIGGERED',
          payload: { title, message, type: rule.alertType, severity: rule.alertSeverity },
        }));
      }
    } catch (error) {
      result.errors++;
      console.error(`Error processing alert rule ${rule.name}:`, error);
    }
  }

  return result;
}

// =============================================================================
// TRIGGER TYPES INFO
// =============================================================================

/**
 * GET /api/alerts/trigger-types
 * Get available trigger types with configuration schema
 */
alertsRouter.get('/trigger-types', requireAdmin, async (_req: AuthRequest, res: Response) => {
  const triggerTypes = [
    {
      type: AlertTriggerType.INVENTORY_LOW_STOCK,
      name: 'Inventory Low Stock',
      description: 'Trigger when item quantity falls below threshold',
      configSchema: {
        threshold: { type: 'number', default: 10, description: 'Minimum quantity threshold' },
      },
      availableVariables: ['count', 'items', 'threshold'],
    },
    {
      type: AlertTriggerType.INVENTORY_DEPLETED,
      name: 'Inventory Depleted',
      description: 'Trigger when items are completely out of stock',
      configSchema: {},
      availableVariables: ['count', 'items'],
    },
    {
      type: AlertTriggerType.ORDER_OVERDUE,
      name: 'Order Overdue',
      description: 'Trigger when orders are past their due date',
      configSchema: {},
      availableVariables: ['count', 'orders'],
    },
    {
      type: AlertTriggerType.ORDER_STUCK_IN_STATION,
      name: 'Order Stuck in Station',
      description: 'Trigger when orders have been at a station too long',
      configSchema: {
        hoursThreshold: { type: 'number', default: 48, description: 'Hours before considered stuck' },
      },
      availableVariables: ['count', 'orders', 'hoursThreshold'],
    },
    {
      type: AlertTriggerType.QUOTE_EXPIRING,
      name: 'Quote Expiring',
      description: 'Trigger when quotes are about to expire',
      configSchema: {
        daysAhead: { type: 'number', default: 7, description: 'Days before expiry to trigger' },
      },
      availableVariables: ['count', 'quotes', 'daysAhead'],
    },
    {
      type: AlertTriggerType.SCHEDULED,
      name: 'Scheduled',
      description: 'Manually scheduled alerts',
      configSchema: {},
      availableVariables: [],
    },
    {
      type: AlertTriggerType.MANUAL,
      name: 'Manual',
      description: 'Manually triggered alerts',
      configSchema: {},
      availableVariables: [],
    },
  ];

  res.json({ success: true, data: triggerTypes });
});

export default alertsRouter;
