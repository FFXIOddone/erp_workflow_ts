/**
 * QuickBooks Cache Service
 * 
 * Manages a local cache of QB invoices, sales orders, and estimates
 * with their line items. Data is imported from:
 *   - The QB Agent USB tool (runs on the QB machine, sends data via HTTP)
 *   - ODBC snapshot (when live connection is available)
 *   - Manual CSV/IIF upload
 * 
 * This decouples daily ERP line-item lookup from needing a live QB connection.
 */

import { prisma } from '../db/client.js';
import type {
  QBCacheImportPayload,
  QBCacheImportResult,
  QBCacheStats,
  QBInvoiceLineItem,
} from '@erp/shared';

// ─── Import ────────────────────────────────────────────────────

/**
 * Import a batch of QB orders into the local cache.
 * Upserts by (refNumber, type) — existing entries get updated.
 */
export async function importToCache(
  payload: QBCacheImportPayload,
): Promise<QBCacheImportResult> {
  const start = Date.now();
  const errors: string[] = [];
  let ordersUpserted = 0;
  let lineItemsTotal = 0;

  for (const order of payload.orders) {
    try {
      // Delete existing line items for this order if it exists
      const existing = await prisma.qBCachedOrder.findUnique({
        where: { refNumber_type: { refNumber: order.refNumber, type: order.type } },
      });

      if (existing) {
        await prisma.qBCachedLineItem.deleteMany({ where: { orderId: existing.id } });
      }

      // Upsert the order
      const cachedOrder = await prisma.qBCachedOrder.upsert({
        where: { refNumber_type: { refNumber: order.refNumber, type: order.type } },
        update: {
          txnId: order.txnId,
          customerName: order.customerName,
          totalAmount: order.totalAmount,
          poNumber: order.poNumber,
          txnDate: order.txnDate ? new Date(order.txnDate) : null,
          memo: order.memo,
          snapshotDate: new Date(),
          source: payload.source,
        },
        create: {
          refNumber: order.refNumber,
          txnId: order.txnId,
          type: order.type,
          customerName: order.customerName,
          totalAmount: order.totalAmount,
          poNumber: order.poNumber,
          txnDate: order.txnDate ? new Date(order.txnDate) : null,
          memo: order.memo,
          source: payload.source,
        },
      });

      // Create line items
      if (order.lineItems.length > 0) {
        await prisma.qBCachedLineItem.createMany({
          data: order.lineItems.map((li) => ({
            orderId: cachedOrder.id,
            lineNumber: li.lineNumber,
            itemName: li.itemName,
            description: li.description,
            quantity: li.quantity,
            rate: li.rate,
            amount: li.amount,
            unit: li.unit,
          })),
        });
        lineItemsTotal += order.lineItems.length;
      }

      ordersUpserted++;
    } catch (err: any) {
      errors.push(`${order.type} ${order.refNumber}: ${err.message}`);
    }
  }

  const duration = `${((Date.now() - start) / 1000).toFixed(1)}s`;

  return { ordersUpserted, lineItemsTotal, errors, duration };
}

// ─── Query ─────────────────────────────────────────────────────

/**
 * Look up a cached QB order by its reference number.
 * Returns the first match across all types (invoice, salesOrder, estimate).
 */
export async function getCachedOrder(refNumber: string) {
  return prisma.qBCachedOrder.findFirst({
    where: { refNumber },
    include: { lineItems: { orderBy: { lineNumber: 'asc' } } },
    orderBy: { snapshotDate: 'desc' },
  });
}

/**
 * Search cached orders by customer name, ref number, or PO.
 */
export async function searchCache(params: {
  search?: string;
  type?: string;
  limit?: number;
  offset?: number;
}) {
  const { search, type, limit = 50, offset = 0 } = params;
  const where: any = {};

  if (type) where.type = type;

  if (search) {
    where.OR = [
      { refNumber: { contains: search, mode: 'insensitive' } },
      { customerName: { contains: search, mode: 'insensitive' } },
      { poNumber: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [orders, total] = await Promise.all([
    prisma.qBCachedOrder.findMany({
      where,
      include: { lineItems: { orderBy: { lineNumber: 'asc' } } },
      orderBy: { snapshotDate: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.qBCachedOrder.count({ where }),
  ]);

  return { orders, total };
}

/**
 * Get cache statistics for the dashboard.
 */
export async function getCacheStats(): Promise<QBCacheStats> {
  const [totalOrders, totalLineItems, invoices, salesOrders, estimates, newest, oldest] =
    await Promise.all([
      prisma.qBCachedOrder.count(),
      prisma.qBCachedLineItem.count(),
      prisma.qBCachedOrder.count({ where: { type: 'invoice' } }),
      prisma.qBCachedOrder.count({ where: { type: 'salesOrder' } }),
      prisma.qBCachedOrder.count({ where: { type: 'estimate' } }),
      prisma.qBCachedOrder.findFirst({ orderBy: { snapshotDate: 'desc' }, select: { snapshotDate: true } }),
      prisma.qBCachedOrder.findFirst({ orderBy: { snapshotDate: 'asc' }, select: { snapshotDate: true } }),
    ]);

  return {
    totalOrders,
    totalLineItems,
    invoices,
    salesOrders,
    estimates,
    lastSnapshotDate: newest?.snapshotDate?.toISOString() ?? null,
    oldestEntry: oldest?.snapshotDate?.toISOString() ?? null,
    newestEntry: newest?.snapshotDate?.toISOString() ?? null,
  };
}

/**
 * Convert cached line items to the QBInvoiceLineItem format
 * used by the rest of the codebase.
 */
export function toCachedLineItems(
  items: Array<{ id: string; itemName: string | null; description: string | null; quantity: number | null; rate: number | null; amount: number; unit: string | null }>,
): QBInvoiceLineItem[] {
  return items.map((li) => ({
    txnLineId: li.id,
    itemRef: li.itemName ? { listId: '', fullName: li.itemName } : null,
    description: li.description,
    quantity: li.quantity,
    unitOfMeasure: li.unit,
    rate: li.rate,
    amount: li.amount,
  }));
}

/**
 * Clear the entire cache (admin action).
 */
export async function clearCache(): Promise<{ deleted: number }> {
  // Line items cascade-deleted via onDelete: Cascade
  const { count } = await prisma.qBCachedOrder.deleteMany();
  return { deleted: count };
}
