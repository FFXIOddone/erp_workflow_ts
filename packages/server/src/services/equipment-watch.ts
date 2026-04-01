/**
 * Equipment Watch Service
 *
 * A configurable "mad-lib" style monitoring system that evaluates metric rules
 * against live equipment data and sends a single daily digest email at the
 * scheduled time.  Rules are stored in the database and fully configurable
 * from the settings page (data source, metric, operator, threshold, recipients,
 * schedule, email template).
 *
 * Scheduler: called every minute from server index.ts.  On each tick it checks
 * whether any active rule's scheduled time has arrived (within the current
 * minute window, on a valid day-of-week) AND the rule hasn't notified today.
 * If so it evaluates the rule, collects violations, and fires the digest email.
 */

import { prisma } from '../db/client.js';
import { getAllCachedStatuses, setCachedStatus, pollAllEquipment, getCachedEWSData, getAllCachedEWSData, setCachedEWSData } from './printer-monitor.js';
import { getCachedVUTEkInkData, pollVUTEkInk } from './vutek-ink.js';
import { sendEmail } from './email.js';
import { broadcast } from '../ws/server.js';

type WatchRuleOperator = 'LESS_THAN' | 'LESS_THAN_OR_EQUAL' | 'GREATER_THAN' | 'GREATER_THAN_OR_EQUAL' | 'EQUALS' | 'NOT_EQUALS';

// ─── Auto-load equipment data if caches are empty ──────────────────────────

let lastAutoLoadTime = 0;
const AUTO_LOAD_INTERVAL_MS = 5 * 60 * 1000; // Re-poll at most every 5 minutes

/**
 * Ensure equipment data is loaded before evaluating watch rules.
 * Polls all equipment + VUTEk ink if caches are empty or stale.
 * This prevents watch rules from returning empty results when
 * nobody has visited the equipment page yet.
 */
async function ensureEquipmentDataLoaded(): Promise<void> {
  const now = Date.now();
  if (now - lastAutoLoadTime < AUTO_LOAD_INTERVAL_MS) return;

  const promises: Promise<unknown>[] = [];

  // Check if printer/equipment cache is empty
  const cachedStatuses = getAllCachedStatuses();
  if (cachedStatuses.size === 0) {
    console.log('⚡ [Equipment Watch] Printer cache empty — hydrating from Postgres...');
    promises.push(
      prisma.equipmentDataCache
        .findMany({
          where: {
            sourceType: { in: ['PRINTER_STATUS', 'HP_EWS'] },
            cachedAt: { gte: new Date(now - 30 * 60 * 1000) }, // Last 30 minutes only
          },
        })
        .then(async (rows: any[]) => {
          let hydratedStatus = 0;
          let hydratedEws = 0;
          for (const row of rows) {
            if (row.sourceType === 'PRINTER_STATUS' && row.equipmentId) {
              setCachedStatus(row.equipmentId, row.data as any);
              hydratedStatus++;
            } else if (row.sourceType === 'HP_EWS' && row.equipmentId) {
              setCachedEWSData(row.equipmentId, row.data as any);
              hydratedEws++;
            }
          }
          if (hydratedStatus > 0 || hydratedEws > 0) {
            console.log(`⚡ [Equipment Watch] Hydrated from Postgres: ${hydratedStatus} statuses, ${hydratedEws} EWS records`);
          }

          // If Postgres had nothing, fall back to live poll
          if (hydratedStatus === 0) {
            console.log('⚡ [Equipment Watch] No Postgres cache — polling all equipment...');
            const equipList = await prisma.equipment.findMany({ where: { ipAddress: { not: null } } });
            if (equipList.length) {
              const toPoll = equipList.map((e: any) => ({
                id: e.id,
                ipAddress: e.ipAddress!,
                connectionType: e.connectionType || 'PING',
                snmpCommunity: e.snmpCommunity || 'public',
              }));
              const results = await pollAllEquipment(toPoll);
              for (const [eqId, status] of results) {
                setCachedStatus(eqId, status);
              }
              console.log(`⚡ [Equipment Watch] Polled ${results.size} devices`);
            }
          }
        })
        .catch((err: unknown) => console.error('⚡ [Equipment Watch] Hydration failed:', err))
    );
  }

  // Check if VUTEk ink cache is empty
  const inkData = getCachedVUTEkInkData();
  if (!inkData) {
    console.log('⚡ [Equipment Watch] VUTEk ink cache empty — polling...');
    promises.push(
      pollVUTEkInk()
        .then(d => console.log(`⚡ [Equipment Watch] VUTEk ink loaded: ${d.currentBags?.length ?? 0} bags`))
        .catch((err: unknown) => console.error('⚡ [Equipment Watch] VUTEk poll failed:', err))
    );
  }

  if (promises.length > 0) {
    await Promise.allSettled(promises);
  }

  lastAutoLoadTime = now;
}

// ─── Types ─────────────────────────────────────────────────────────────────

interface TriggeredItem {
  label: string;
  currentValue: number;
  threshold: number;
  equipmentName: string;
}

// ─── Comparison helpers ────────────────────────────────────────────────────

function compare(value: number, operator: WatchRuleOperator, threshold: number): boolean {
  switch (operator) {
    case 'LESS_THAN':              return value < threshold;
    case 'LESS_THAN_OR_EQUAL':     return value <= threshold;
    case 'GREATER_THAN':           return value > threshold;
    case 'GREATER_THAN_OR_EQUAL':  return value >= threshold;
    case 'EQUALS':                 return value === threshold;
    case 'NOT_EQUALS':             return value !== threshold;
    default:                       return false;
  }
}

export const OPERATOR_SYMBOLS: Record<string, string> = {
  LESS_THAN: '<',
  LESS_THAN_OR_EQUAL: '≤',
  GREATER_THAN: '>',
  GREATER_THAN_OR_EQUAL: '≥',
  EQUALS: '=',
  NOT_EQUALS: '≠',
};

// ─── Data-source evaluators ────────────────────────────────────────────────

function evaluateVUTEkInk(
  metricField: string,
  operator: WatchRuleOperator,
  threshold: number,
  _equipmentId: string | null,
): TriggeredItem[] {
  const ink = getCachedVUTEkInkData();
  if (!ink?.available || !ink.currentBags?.length) return [];

  const items: TriggeredItem[] = [];
  for (const bag of ink.currentBags) {
    const value = (bag as any)[metricField];
    if (typeof value !== 'number') continue;
    if (compare(value, operator, threshold)) {
      items.push({
        label: `${bag.colorName} Ink Bag`,
        currentValue: Math.round(value * 100) / 100,
        threshold,
        equipmentName: 'VUTEk GS3250LX Pro',
      });
    }
  }
  return items;
}

function evaluateHPInk(
  metricField: string,
  operator: WatchRuleOperator,
  threshold: number,
  equipmentId: string | null,
): TriggeredItem[] {
  const allStatuses = getAllCachedStatuses();
  const items: TriggeredItem[] = [];

  for (const [eqId, status] of allStatuses.entries()) {
    if (equipmentId && eqId !== equipmentId) continue;
    // HP EWS ink data is stored on the cached status under a `.ews` key
    // which is set when the equipment detail route is polled.  We also
    // check supplies from SNMP which are always available.
    const supplies = status.supplies || [];
    for (const supply of supplies) {
      if (supply.type !== 'ink' && supply.type !== 'toner') continue;
      const value = metricField === 'levelPercent' ? supply.level : (supply as any)[metricField];
      if (typeof value !== 'number' || value < 0) continue;
      if (compare(value, operator, threshold)) {
        items.push({
          label: `${supply.name || supply.color} Cartridge`,
          currentValue: Math.round(value * 100) / 100,
          threshold,
          equipmentName: status.systemName || `Equipment ${status.ipAddress}`,
        });
      }
    }
  }
  return items;
}

function evaluateHPPrinthead(
  metricField: string,
  operator: WatchRuleOperator,
  threshold: number,
  equipmentId: string | null,
): TriggeredItem[] {
  const items: TriggeredItem[] = [];

  const evalPrintheads = (ews: any, eqName: string) => {
    if (!ews?.printheads?.length) return;
    for (const ph of ews.printheads) {
      const value = metricField === 'healthGaugeLevel'
        ? ph.healthGaugeLevel
        : (ph as any)[metricField];
      if (typeof value !== 'number' || value < 0) continue;
      if (compare(value, operator, threshold)) {
        items.push({
          label: `Printhead ${ph.slotId} (${ph.colors?.join('/') || 'Unknown'})`,
          currentValue: Math.round(value * 100) / 100,
          threshold,
          equipmentName: ews.identity?.productName || eqName,
        });
      }
    }
  };

  if (equipmentId) {
    const ews = getCachedEWSData(equipmentId);
    if (ews) evalPrintheads(ews, 'Equipment');
  } else {
    const allEws = getAllCachedEWSData();
    for (const [_eqId, ews] of allEws) {
      evalPrintheads(ews, 'Equipment');
    }
  }

  return items;
}

function evaluateHPMaintenance(
  metricField: string,
  operator: WatchRuleOperator,
  threshold: number,
  equipmentId: string | null,
): TriggeredItem[] {
  const items: TriggeredItem[] = [];

  const evalMaintenance = (ews: any, eqName: string) => {
    if (!ews?.maintenance?.length) return;
    for (const mi of ews.maintenance) {
      const value = metricField === 'levelPercent'
        ? mi.levelPercent
        : (mi as any)[metricField];
      if (typeof value !== 'number' || value < 0) continue;
      if (compare(value, operator, threshold)) {
        items.push({
          label: mi.name || mi.type || 'Maintenance Item',
          currentValue: Math.round(value * 100) / 100,
          threshold,
          equipmentName: ews.identity?.productName || eqName,
        });
      }
    }
  };

  if (equipmentId) {
    const ews = getCachedEWSData(equipmentId);
    if (ews) evalMaintenance(ews, 'Equipment');
  } else {
    const allEws = getAllCachedEWSData();
    for (const [_eqId, ews] of allEws) {
      evalMaintenance(ews, 'Equipment');
    }
  }

  return items;
}

function evaluateEquipmentStatus(
  metricField: string,
  operator: WatchRuleOperator,
  threshold: number,
  equipmentId: string | null,
): TriggeredItem[] {
  const allStatuses = getAllCachedStatuses();
  const items: TriggeredItem[] = [];

  for (const [eqId, status] of allStatuses.entries()) {
    if (equipmentId && eqId !== equipmentId) continue;
    if (metricField === 'isOnline') {
      const value = status.reachable ? 1 : 0;
      if (compare(value, operator, threshold)) {
        items.push({
          label: 'Online Status',
          currentValue: value,
          threshold,
          equipmentName: status.systemName || `Equipment ${status.ipAddress}`,
        });
      }
    }
  }
  return items;
}

/** Dispatch to the right evaluator based on dataSource */
function evaluateSingleSource(
  dataSource: string,
  metricField: string,
  operator: WatchRuleOperator,
  threshold: number,
  equipmentId: string | null,
): TriggeredItem[] {
  switch (dataSource) {
    case 'VUTEK_INK':          return evaluateVUTEkInk(metricField, operator, threshold, equipmentId);
    case 'HP_INK':             return evaluateHPInk(metricField, operator, threshold, equipmentId);
    case 'HP_PRINTHEAD':       return evaluateHPPrinthead(metricField, operator, threshold, equipmentId);
    case 'HP_MAINTENANCE':     return evaluateHPMaintenance(metricField, operator, threshold, equipmentId);
    case 'EQUIPMENT_STATUS':   return evaluateEquipmentStatus(metricField, operator, threshold, equipmentId);
    default:
      console.warn(`\u26A1 Unknown watch rule data source: ${dataSource}`);
      return [];
  }
}

/** Default metric per data source (used when rule has multiple sources) */
const DEFAULT_METRICS: Record<string, string> = {
  VUTEK_INK: 'estimatedPercentRemaining',
  HP_INK: 'levelPercent',
  HP_PRINTHEAD: 'healthGaugeLevel',
  HP_MAINTENANCE: 'levelPercent',
  EQUIPMENT_STATUS: 'isOnline',
};

/**
 * Evaluate a rule across one or more data sources.
 * If metricField is set, it overrides the default for all sources.
 * If null, each source uses its own default metric.
 */
async function evaluateRule(
  dataSources: string[],
  metricField: string | null,
  operator: WatchRuleOperator,
  threshold: number,
  equipmentId: string | null,
): Promise<TriggeredItem[]> {
  // Ensure data is loaded before evaluating
  await ensureEquipmentDataLoaded();

  const allItems: TriggeredItem[] = [];
  for (const ds of dataSources) {
    const metric = metricField || DEFAULT_METRICS[ds] || 'levelPercent';
    const items = evaluateSingleSource(ds, metric, operator, threshold, equipmentId);
    allItems.push(...items);
  }
  return allItems;
}

// ─── Email builder ─────────────────────────────────────────────────────────

export function buildAlertEmailHtml(
  ruleName: string,
  ruleDescription: string | null,
  operatorSymbol: string,
  threshold: number,
  metricField: string,
  items: TriggeredItem[],
  customBodyHtml: string | null,
): string {
  if (customBodyHtml) {
    // Replace template placeholders in custom body
    return customBodyHtml
      .replace(/\{\{ruleName\}\}/g, ruleName)
      .replace(/\{\{threshold\}\}/g, String(threshold))
      .replace(/\{\{metricField\}\}/g, metricField)
      .replace(/\{\{itemCount\}\}/g, String(items.length))
      .replace(/\{\{itemList\}\}/g, items.map(i =>
        `<li><strong>${i.label}</strong> on <em>${i.equipmentName}</em> — currently <strong>${i.currentValue}</strong> (threshold: ${operatorSymbol} ${threshold})</li>`
      ).join('\n'));
  }

  // Auto-generated email
  const rows = items.map(item => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${item.equipmentName}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${item.label}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:bold;color:${item.currentValue <= 20 ? '#dc2626' : item.currentValue <= 40 ? '#d97706' : '#374151'};">
        ${item.currentValue}
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${operatorSymbol} ${threshold}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Equipment Alert</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 640px; margin: 20px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,.1); }
    .header { background: #7c3aed; color: #fff; padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 22px; }
    .content { padding: 24px; }
    .footer { background: #f9fafb; padding: 14px 24px; text-align: center; font-size: 11px; color: #6b7280; border-top: 1px solid #e5e7eb; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th { background: #f3f4f6; padding: 8px 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280; }
    .alert-badge { display: inline-block; padding: 4px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; background: #fef3c7; color: #92400e; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚠️ Equipment Alert: ${ruleName}</h1>
    </div>
    <div class="content">
      <p>${ruleDescription || `The following items have triggered the <strong>${ruleName}</strong> watch rule.`}</p>
      <p><span class="alert-badge">${items.length} item${items.length === 1 ? '' : 's'} need${items.length === 1 ? 's' : ''} attention</span></p>

      <table>
        <thead>
          <tr>
            <th>Equipment</th>
            <th>Component</th>
            <th style="text-align:center;">Current Value</th>
            <th style="text-align:center;">Threshold</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <p style="font-size:13px;color:#6b7280;margin-top:20px;">
        This is a daily digest alert. The rule <strong>${ruleName}</strong> checks whether
        <em>${metricField}</em> is ${operatorSymbol} <strong>${threshold}</strong>.
      </p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} Wilde Signs &middot; Equipment Monitoring System
    </div>
  </div>
</body>
</html>`.trim();
}

// ─── Scheduler tick ────────────────────────────────────────────────────────

/**
 * Called every 60 seconds from server index.ts.
 *
 * Checks all active rules.  If the current time is within the rule's
 * scheduled minute AND the current day-of-week matches AND the rule
 * hasn't already sent today → evaluate and send.
 */
let equipmentWatchRulesPromise: Promise<{ evaluated: number; sent: number }> | null = null;

async function processEquipmentWatchRulesInternal(): Promise<{ evaluated: number; sent: number }> {
  const now = new Date();
  const currentHH = String(now.getHours()).padStart(2, '0');
  const currentMM = String(now.getMinutes()).padStart(2, '0');
  const currentTime = `${currentHH}:${currentMM}`;
  // JS getDay(): 0=Sun, 1=Mon … 6=Sat  →  Our convention: 1=Mon … 7=Sun
  const jsDay = now.getDay();
  const currentDay = jsDay === 0 ? 7 : jsDay;

  // Fetch all active rules whose scheduleTime matches the current minute
  const rules = await prisma.equipmentWatchRule.findMany({
    where: {
      isActive: true,
      scheduleTime: currentTime,
      scheduleDays: { has: currentDay },
    },
  });

  if (rules.length === 0) return { evaluated: 0, sent: 0 };

  let evaluated = 0;
  let sent = 0;

  for (const rule of rules) {
    // Skip if already notified today
    if (rule.lastNotifiedAt) {
      const lastDate = new Date(rule.lastNotifiedAt);
      if (
        lastDate.getFullYear() === now.getFullYear() &&
        lastDate.getMonth() === now.getMonth() &&
        lastDate.getDate() === now.getDate()
      ) {
        continue;
      }
    }

    evaluated++;

    try {
      const items = await evaluateRule(
        rule.dataSources,
        rule.metricField,
        rule.operator,
        rule.threshold,
        rule.equipmentId,
      );

      // Update lastEvaluatedAt regardless
      await prisma.equipmentWatchRule.update({
        where: { id: rule.id },
        data: { lastEvaluatedAt: now },
      });

      if (items.length === 0) continue; // No violations — nothing to send

      // Build email
      const opSymbol = OPERATOR_SYMBOLS[rule.operator] || rule.operator;
      const subject = rule.emailSubject
        .replace(/\{\{ruleName\}\}/g, rule.name)
        .replace(/\{\{itemCount\}\}/g, String(items.length))
        .replace(/\{\{threshold\}\}/g, String(rule.threshold));

      const html = buildAlertEmailHtml(
        rule.name,
        rule.description,
        opSymbol,
        rule.threshold,
        rule.metricField || 'levelPercent',
        items,
        rule.emailBodyHtml,
      );

      let success = false;
      let sendError: string | null = null;
      try {
        await sendEmail({
          to: rule.recipients,
          subject,
          html,
        });
        success = true;
      } catch (emailErr: any) {
        sendError = emailErr?.message || 'Email send failed';
        console.error(`⚡ Watch rule "${rule.name}" email send failed:`, emailErr?.message);
      }

      // Record notification
      await prisma.equipmentWatchNotification.create({
        data: {
          ruleId: rule.id,
          recipients: rule.recipients,
          subject,
          triggeredItems: items as any,
          success,
          error: sendError,
        },
      });

      // Update lastNotifiedAt
      await prisma.equipmentWatchRule.update({
        where: { id: rule.id },
        data: { lastNotifiedAt: now },
      });

      if (success) sent++;

      // Notify connected clients that a watch rule fired
      broadcast({
        type: 'EQUIPMENT_WATCH_ALERT' as any,
        payload: {
          ruleId: rule.id,
          ruleName: rule.name,
          itemCount: items.length,
          sentAt: now.toISOString(),
        },
        timestamp: new Date(),
      });

      console.log(
        `⚡ Watch rule "${rule.name}": ${items.length} items triggered → email ${success ? 'sent' : 'FAILED'} to ${rule.recipients.join(', ')}`,
      );
    } catch (err) {
      console.error(`⚡ Watch rule "${rule.name}" error:`, err);

      // Log failed notification
      await prisma.equipmentWatchNotification.create({
        data: {
          ruleId: rule.id,
          recipients: rule.recipients,
          subject: `ERROR: ${rule.name}`,
          triggeredItems: [],
          success: false,
          error: String(err),
        },
      }).catch(() => {}); // Don't fail if logging fails
    }
  }

  return { evaluated, sent };
}

export async function processEquipmentWatchRules(): Promise<{ evaluated: number; sent: number }> {
  if (equipmentWatchRulesPromise) {
    return equipmentWatchRulesPromise;
  }

  equipmentWatchRulesPromise = processEquipmentWatchRulesInternal().finally(() => {
    equipmentWatchRulesPromise = null;
  });

  return equipmentWatchRulesPromise;
}

/**
 * Force-evaluate a single rule right now (used from the settings page "Test" button).
 * Returns the triggered items without sending email.
 */
export async function testWatchRule(ruleId: string): Promise<{ items: TriggeredItem[]; ruleFound: boolean }> {
  const rule = await prisma.equipmentWatchRule.findUnique({ where: { id: ruleId } });
  if (!rule) return { items: [], ruleFound: false };

  const items = await evaluateRule(
    rule.dataSources,
    rule.metricField,
    rule.operator,
    rule.threshold,
    rule.equipmentId,
  );

  return { items, ruleFound: true };
}
