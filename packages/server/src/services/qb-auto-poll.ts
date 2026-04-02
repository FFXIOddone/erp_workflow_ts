/**
 * QuickBooks Auto-Poll Service
 *
 * Polls QB Desktop every 5 minutes for new invoices and sales orders,
 * then auto-creates WorkOrders in the ERP. This eliminates manual data entry for 90%+ of orders.
 */
import { prisma } from '../db/client.js';
import { PrintingMethod } from '@erp/shared';
import * as quickbooks from './quickbooks.js';
import { resolveCustomerId } from '../lib/customer-matching.js';
import { applyRoutingDefaults, buildInitialStationProgress } from '../lib/routing-defaults.js';
import { ensureOrderFolder } from '../lib/folder-utils.js';
import { broadcast } from '../ws/server.js';
import { logActivity, ActivityAction, EntityType } from '../lib/activity-logger.js';

// Track last poll time in memory (also persisted in QBPollLog)
let lastPollTime: Date | null = null;
let isPolling = false;

/**
 * Resolve company ID from QB customer name.
 * Falls back to fuzzy matching.
 */
async function resolveCompanyId(customerName: string): Promise<string | null> {
  if (!customerName?.trim()) return null;

  // Strip PO numbers and suffixes from QB customer names like "ACME Corp PO#12345"
  const stripped = customerName
    .replace(/\s+PO\s*#?\s*\d+.*$/i, '')
    .replace(/\s*\([^)]*\)\s*/g, '')
    .replace(/\s*#\d+$/i, '')
    .replace(/;\s*.+$/i, '')
    .trim();

  // Exact match
  const exact = await prisma.company.findFirst({
    where: { name: { equals: stripped, mode: 'insensitive' } },
    select: { id: true },
  });
  if (exact) return exact.id;

  // Also try DBA and legal name
  const dbaMatch = await prisma.company.findFirst({
    where: {
      OR: [
        { dba: { equals: stripped, mode: 'insensitive' } },
        { legalName: { equals: stripped, mode: 'insensitive' } },
      ],
    },
    select: { id: true },
  });
  if (dbaMatch) return dbaMatch.id;

  // Contains match
  if (stripped.length >= 4) {
    const contains = await prisma.company.findFirst({
      where: { name: { contains: stripped, mode: 'insensitive' } },
      select: { id: true },
    });
    if (contains) return contains.id;
  }

  return null;
}

/**
 * Get the system user ID for auto-created orders.
 * Uses the first ADMIN user, or creates a "System" user if none exists.
 */
async function getSystemUserId(): Promise<string> {
  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN', isActive: true },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
  if (admin) return admin.id;

  // Fallback: any active user
  const anyUser = await prisma.user.findFirst({
    where: { isActive: true },
    select: { id: true },
  });
  if (anyUser) return anyUser.id;

  throw new Error('No active users found — cannot create auto-poll orders');
}

/**
 * Generate the next order number in WO-XXXXXX format.
 */
async function getNextOrderNumber(): Promise<string> {
  const lastOrder = await prisma.workOrder.findFirst({
    where: { orderNumber: { startsWith: 'WO-' } },
    orderBy: { orderNumber: 'desc' },
    select: { orderNumber: true },
  });

  if (lastOrder) {
    const match = lastOrder.orderNumber.match(/WO-(\d+)/);
    if (match) {
      const nextNum = parseInt(match[1], 10) + 1;
      return `WO-${nextNum.toString().padStart(6, '0')}`;
    }
  }
  return 'WO-000001';
}

interface PollResult {
  newOrders: number;
  skipped: number;
  errors: string[];
  invoicesFound: number;
  salesOrdersFound: number;
}

/**
 * Main polling function. Fetches new QB orders and creates WorkOrders.
 */
export async function pollQuickBooks(): Promise<PollResult> {
  if (isPolling) {
    return { newOrders: 0, skipped: 0, errors: ['Poll already in progress'], invoicesFound: 0, salesOrdersFound: 0 };
  }

  isPolling = true;
  const result: PollResult = { newOrders: 0, skipped: 0, errors: [], invoicesFound: 0, salesOrdersFound: 0 };

  try {
    // Check if QB is connected
    const status = quickbooks.getConnectionStatus();
    if (!status.connected) {
      result.errors.push('QuickBooks not connected');
      return result;
    }

    // Determine poll window
    if (!lastPollTime) {
      // First poll: check last log entry
      const lastLog = await prisma.qBPollLog.findFirst({
        orderBy: { polledAt: 'desc' },
      });
      lastPollTime = lastLog?.polledAt ?? new Date(Date.now() - 24 * 60 * 60 * 1000); // Default: last 24 hours
    }

    const systemUserId = await getSystemUserId();
    const fromDate = lastPollTime;
    const now = new Date();

    // Fetch invoices
    let invoices: any[] = [];
    try {
      invoices = await quickbooks.getInvoices({ fromDate: fromDate ?? undefined, limit: 200 });
      result.invoicesFound = invoices.length;
    } catch (e: any) {
      result.errors.push(`Invoice fetch error: ${e.message}`);
    }

    // Fetch sales orders
    let salesOrders: any[] = [];
    try {
      salesOrders = await quickbooks.getSalesOrders({ fromDate: fromDate ?? undefined, openOnly: true, limit: 200 });
      result.salesOrdersFound = salesOrders.length;
    } catch (e: any) {
      result.errors.push(`Sales order fetch error: ${e.message}`);
    }

    // Process invoices
    for (const inv of invoices) {
      try {
        const created = await processQBOrder({
          refNumber: inv.refNumber || inv.RefNumber,
          txnId: inv.txnId || inv.TxnID,
          customerName: inv.customerName || inv.CustomerRefFullName,
          memo: inv.memo || inv.Memo,
          poNumber: inv.poNumber || inv.PONumber,
          type: 'invoice',
          systemUserId,
        });
        if (created) result.newOrders++;
        else result.skipped++;
      } catch (e: any) {
        result.errors.push(`Invoice ${inv.refNumber || inv.RefNumber}: ${e.message}`);
      }
    }

    // Process sales orders
    for (const so of salesOrders) {
      try {
        const created = await processQBOrder({
          refNumber: so.refNumber || so.RefNumber,
          txnId: so.txnId || so.TxnID,
          customerName: so.customerName || so.CustomerRefFullName,
          memo: so.memo || so.Memo,
          poNumber: so.poNumber || so.PONumber,
          type: 'salesOrder',
          systemUserId,
        });
        if (created) result.newOrders++;
        else result.skipped++;
      } catch (e: any) {
        result.errors.push(`SO ${so.refNumber || so.RefNumber}: ${e.message}`);
      }
    }

    // Update last poll time
    lastPollTime = now;

    // Log the poll
    await prisma.qBPollLog.create({
      data: {
        newOrdersCreated: result.newOrders,
        errors: result.errors,
        lastQBTimestamp: now.toISOString(),
        invoicesFound: result.invoicesFound,
        salesOrdersFound: result.salesOrdersFound,
        skipped: result.skipped,
      },
    });

  } finally {
    isPolling = false;
  }

  return result;
}

interface ProcessQBOrderParams {
  refNumber: string;
  txnId: string;
  customerName: string;
  memo?: string;
  poNumber?: string;
  type: 'invoice' | 'salesOrder';
  systemUserId: string;
}

/**
 * Process a single QB order: check for duplicates, create WorkOrder, sync line items.
 * Returns true if a new order was created, false if skipped.
 */
async function processQBOrder(params: ProcessQBOrderParams): Promise<boolean> {
  const { refNumber, txnId, customerName, memo, poNumber, type, systemUserId } = params;

  if (!refNumber) return false;

  // Dedup check: by qbTxnId (most reliable) or quickbooksOrderNum
  const existing = await prisma.workOrder.findFirst({
    where: {
      OR: [
        { qbTxnId: txnId },
        { quickbooksOrderNum: refNumber },
      ],
    },
    select: { id: true },
  });
  if (existing) return false;

  // Resolve company
  const companyId = await resolveCompanyId(customerName);

  // Resolve legacy customer
  const customerId = await resolveCustomerId(customerName);

  // Fetch line items from QB
  const lineItemData = await quickbooks.getLineItemsForQBOrder(refNumber);

  // Build description from memo or first line item
  const description = memo
    || lineItemData?.lineItems?.[0]?.description
    || `${type === 'invoice' ? 'Invoice' : 'Sales Order'} #${refNumber}`;

  // Determine initial routing based on description
  // Default: DESIGN + ROLL_TO_ROLL (most common for sign shop)
  const defaultRouting = [PrintingMethod.DESIGN, PrintingMethod.ROLL_TO_ROLL];
  const routing = applyRoutingDefaults(defaultRouting, {
    description,
    source: 'qb',
    needsProof: true, // Almost all new orders need proofing
  });

  // Generate order number
  const orderNumber = await getNextOrderNumber();

  // Create the work order
  const workOrder = await prisma.workOrder.create({
    data: {
      orderNumber,
      customerName: customerName || 'Unknown Customer',
      description,
      status: 'PENDING',
      priority: 3,
      isTempOrder: false,
      quickbooksOrderNum: refNumber,
      qbTxnId: txnId || undefined,
      linkedAt: new Date(),
      companyId,
      customerId,
      createdById: systemUserId,
      routing,
      poNumber: poNumber || lineItemData?.poNumber || undefined,
      // Create station progress entries
      stationProgress: {
        create: buildInitialStationProgress(routing, { source: 'qb' }),
      },
      // Create line items from QB data
      lineItems: lineItemData?.lineItems ? {
        create: lineItemData.lineItems.map((li, idx) => ({
          itemNumber: idx + 1,
          description: li.description || `Item ${idx + 1}`,
          quantity: li.quantity || 1,
          unitPrice: li.rate || li.amount || 0,
          notes: li.itemRef?.fullName || undefined,
        })),
      } : undefined,
    },
    select: { id: true, orderNumber: true, customerName: true },
  });

  // Create network folder (non-blocking)
  try {
    await ensureOrderFolder(workOrder.id);
  } catch (e) {
    console.error(`[QB Auto-Poll] Failed to create folder for ${workOrder.orderNumber}:`, e);
  }

  // Broadcast new order
  broadcast({
    type: 'ORDER_CREATED',
    payload: {
      id: workOrder.id,
      orderNumber: workOrder.orderNumber,
      customerName: workOrder.customerName,
      source: 'qb-auto-poll',
    },
    timestamp: new Date(),
  });

  // Log activity
  await logActivity({
    action: ActivityAction.CREATE,
    entityType: EntityType.WORK_ORDER,
    entityId: workOrder.id,
    entityName: workOrder.orderNumber,
    description: `Auto-created from QB ${type} #${refNumber}`,
    details: { source: 'qb-auto-poll', qbRefNumber: refNumber, qbTxnId: txnId, type },
  });

  console.log(`[QB Auto-Poll] Created ${workOrder.orderNumber} from QB ${type} #${refNumber}`);
  return true;
}

/**
 * Start the auto-poll interval. Call this from server startup.
 */
export function startQBAutoPoll(intervalMs: number = 300000): ReturnType<typeof setInterval> | null {
  const enabled = process.env.QB_AUTO_POLL_ENABLED !== 'false';
  if (!enabled) {
    console.log('[QB Auto-Poll] Disabled via QB_AUTO_POLL_ENABLED=false');
    return null;
  }

  console.log(`[QB Auto-Poll] Started (interval: ${intervalMs / 1000}s)`);

  // Run initial poll after 30s delay (let QB connect first)
  setTimeout(async () => {
    try {
      const result = await pollQuickBooks();
      if (result.newOrders > 0 || result.errors.length > 0) {
        console.log(`[QB Auto-Poll] Initial: ${result.newOrders} new, ${result.skipped} skipped, ${result.errors.length} errors`);
      }
    } catch (e) {
      console.error('[QB Auto-Poll] Initial poll error:', e);
    }
  }, 30000);

  // Start recurring poll
  return setInterval(async () => {
    try {
      const result = await pollQuickBooks();
      if (result.newOrders > 0 || result.errors.length > 0) {
        console.log(`[QB Auto-Poll] ${result.newOrders} new, ${result.skipped} skipped, ${result.errors.length} errors`);
      }
    } catch (e) {
      console.error('[QB Auto-Poll] Poll error:', e);
    }
  }, intervalMs);
}
