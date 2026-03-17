/**
 * Equipment Watch Rules — CRUD API
 *
 * GET    /equipment-watch          — List all rules (with counts)
 * GET    /equipment-watch/:id      — Get single rule with recent notifications
 * POST   /equipment-watch          — Create new rule
 * PUT    /equipment-watch/:id      — Update rule
 * DELETE /equipment-watch/:id      — Delete rule
 * POST   /equipment-watch/:id/test — Dry-run evaluation (returns triggered items)
 * POST   /equipment-watch/:id/send — Force-send the alert now (ignores schedule)
 */

import { Router } from 'express';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db/client.js';
import { CreateEquipmentWatchRuleSchema, UpdateEquipmentWatchRuleSchema } from '@erp/shared';
import { testWatchRule, buildAlertEmailHtml, OPERATOR_SYMBOLS } from '../services/equipment-watch.js';
import { sendEmail } from '../services/email.js';

const router = Router();
router.use(authenticate);

// ─── Get equipment list for dropdown ───────────────────────────────────────

router.get('/meta/equipment', async (req: AuthRequest, res) => {
  try {
    const equipment = await prisma.equipment.findMany({
      where: { ipAddress: { not: null } },
      select: { id: true, name: true, type: true, manufacturer: true, ipAddress: true },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: equipment });
  } catch (error) {
    console.error('Failed to list equipment:', error);
    res.status(500).json({ success: false, error: 'Failed to list equipment' });
  }
});

// ─── List all rules ────────────────────────────────────────────────────────

router.get('/', async (req: AuthRequest, res) => {
  try {
    const rules = await prisma.equipmentWatchRule.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        equipment: { select: { id: true, name: true } },
        createdBy: { select: { id: true, displayName: true } },
        _count: { select: { notifications: true } },
      },
    });
    res.json({ success: true, data: rules });
  } catch (error) {
    console.error('Failed to list watch rules:', error);
    res.status(500).json({ success: false, error: 'Failed to list watch rules' });
  }
});

// ─── Get single rule with recent notifications ─────────────────────────────

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const rule = await prisma.equipmentWatchRule.findUnique({
      where: { id: req.params.id },
      include: {
        equipment: { select: { id: true, name: true } },
        createdBy: { select: { id: true, displayName: true } },
        notifications: {
          orderBy: { sentAt: 'desc' },
          take: 20,
        },
        _count: { select: { notifications: true } },
      },
    });
    if (!rule) {
      return res.status(404).json({ success: false, error: 'Watch rule not found' });
    }
    res.json({ success: true, data: rule });
  } catch (error) {
    console.error('Failed to get watch rule:', error);
    res.status(500).json({ success: false, error: 'Failed to get watch rule' });
  }
});

// ─── Create rule ───────────────────────────────────────────────────────────

router.post('/', async (req: AuthRequest, res) => {
  try {
    const data = CreateEquipmentWatchRuleSchema.parse(req.body);
    const rule = await prisma.equipmentWatchRule.create({
      data: {
        ...data,
        createdById: req.userId!,
      },
      include: {
        equipment: { select: { id: true, name: true } },
        createdBy: { select: { id: true, displayName: true } },
        _count: { select: { notifications: true } },
      },
    });
    res.json({ success: true, data: rule });
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return res.status(400).json({ success: false, error: 'Validation failed', details: error.errors });
    }
    console.error('Failed to create watch rule:', error);
    res.status(500).json({ success: false, error: 'Failed to create watch rule' });
  }
});

// ─── Update rule ───────────────────────────────────────────────────────────

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const data = UpdateEquipmentWatchRuleSchema.parse(req.body);
    const rule = await prisma.equipmentWatchRule.update({
      where: { id: req.params.id },
      data,
      include: {
        equipment: { select: { id: true, name: true } },
        createdBy: { select: { id: true, displayName: true } },
        _count: { select: { notifications: true } },
      },
    });
    res.json({ success: true, data: rule });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Watch rule not found' });
    }
    if (error?.name === 'ZodError') {
      return res.status(400).json({ success: false, error: 'Validation failed', details: error.errors });
    }
    console.error('Failed to update watch rule:', error);
    res.status(500).json({ success: false, error: 'Failed to update watch rule' });
  }
});

// ─── Delete rule ───────────────────────────────────────────────────────────

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    await prisma.equipmentWatchRule.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Watch rule not found' });
    }
    console.error('Failed to delete watch rule:', error);
    res.status(500).json({ success: false, error: 'Failed to delete watch rule' });
  }
});

// ─── Test rule (dry run) ───────────────────────────────────────────────────

router.post('/:id/test', async (req: AuthRequest, res) => {
  try {
    const result = await testWatchRule(req.params.id);
    if (!result.ruleFound) {
      return res.status(404).json({ success: false, error: 'Watch rule not found' });
    }
    res.json({ success: true, data: { triggeredItems: result.items, count: result.items.length } });
  } catch (error) {
    console.error('Failed to test watch rule:', error);
    res.status(500).json({ success: false, error: 'Failed to test watch rule' });
  }
});

// ─── Force send now ────────────────────────────────────────────────────────

router.post('/:id/send', async (req: AuthRequest, res) => {
  try {
    const rule = await prisma.equipmentWatchRule.findUnique({ where: { id: req.params.id } });
    if (!rule) {
      return res.status(404).json({ success: false, error: 'Watch rule not found' });
    }

    const result = await testWatchRule(req.params.id);
    if (result.items.length === 0) {
      return res.json({
        success: true,
        data: { sent: false, reason: 'No items currently trigger this rule', triggeredItems: [] },
      });
    }

    const opSymbol = OPERATOR_SYMBOLS[rule.operator] || rule.operator;
    const metricField = rule.metricField || 'levelPercent';

    const html = buildAlertEmailHtml(
      rule.name,
      rule.description,
      opSymbol,
      rule.threshold,
      metricField,
      result.items,
      rule.emailBodyHtml,
    );

    const subject = rule.emailSubject
      .replace(/\{\{ruleName\}\}/g, rule.name)
      .replace(/\{\{itemCount\}\}/g, String(result.items.length))
      .replace(/\{\{threshold\}\}/g, String(rule.threshold));

    const emailSent = await sendEmail({ to: rule.recipients, subject, html });

    // Record notification
    await prisma.equipmentWatchNotification.create({
      data: {
        ruleId: rule.id,
        recipients: rule.recipients,
        subject,
        triggeredItems: result.items as any,
        success: emailSent,
        error: emailSent ? null : 'Email send returned false',
      },
    });

    res.json({
      success: true,
      data: { sent: emailSent, triggeredItems: result.items, count: result.items.length },
    });
  } catch (error) {
    console.error('Failed to force-send watch rule:', error);
    res.status(500).json({ success: false, error: 'Failed to send alert' });
  }
});

export { router as equipmentWatchRouter };
