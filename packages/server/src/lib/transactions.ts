/**
 * Database Transaction Utilities
 * 
 * Provides helper functions for safely executing multi-table operations
 * within transactions to ensure data integrity.
 */

import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../db/client.js';

// Type for transaction client
export type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/**
 * Execute a function within a database transaction
 * 
 * @example
 * ```typescript
 * const result = await withTransaction(async (tx) => {
 *   const order = await tx.workOrder.create({ data: orderData });
 *   await tx.stationProgress.createMany({ data: progressData });
 *   await tx.activityLog.create({ data: logData });
 *   return order;
 * });
 * ```
 */
export async function withTransaction<T>(
  fn: (tx: TransactionClient) => Promise<T>,
  options?: {
    maxWait?: number; // Maximum time to wait for transaction slot (ms)
    timeout?: number; // Maximum time for transaction to complete (ms)
    isolationLevel?: Prisma.TransactionIsolationLevel;
  }
): Promise<T> {
  return prisma.$transaction(fn, {
    maxWait: options?.maxWait ?? 5000,
    timeout: options?.timeout ?? 10000,
    isolationLevel: options?.isolationLevel ?? Prisma.TransactionIsolationLevel.ReadCommitted,
  });
}

/**
 * Execute multiple operations in a transaction with automatic retry on deadlock
 * 
 * @example
 * ```typescript
 * await withRetryableTransaction(async (tx) => {
 *   await tx.inventory.update({ ... });
 *   await tx.materialUsage.create({ ... });
 * }, { maxRetries: 3 });
 * ```
 */
export async function withRetryableTransaction<T>(
  fn: (tx: TransactionClient) => Promise<T>,
  options?: {
    maxRetries?: number;
    retryDelayMs?: number;
    maxWait?: number;
    timeout?: number;
  }
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 3;
  const retryDelayMs = options?.retryDelayMs ?? 100;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await withTransaction(fn, {
        maxWait: options?.maxWait,
        timeout: options?.timeout,
      });
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if it's a retryable error (deadlock, serialization failure)
      const isRetryable =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2034', 'P2002'].includes(error.code); // Deadlock or unique constraint

      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff
      const delay = retryDelayMs * Math.pow(2, attempt);
      await sleep(delay);
    }
  }

  throw lastError ?? new Error('Transaction failed after retries');
}

/**
 * Batch create records in chunks to avoid memory issues and timeouts
 * 
 * @example
 * ```typescript
 * await batchCreate(
 *   items,
 *   100, // chunk size
 *   (chunk, tx) => tx.inventoryItem.createMany({ data: chunk })
 * );
 * ```
 */
export async function batchCreate<T>(
  items: T[],
  chunkSize: number,
  createFn: (chunk: T[], tx: TransactionClient) => Promise<unknown>
): Promise<void> {
  const chunks = chunkArray(items, chunkSize);

  await withTransaction(async (tx) => {
    for (const chunk of chunks) {
      await createFn(chunk, tx);
    }
  });
}

/**
 * Safely update with optimistic locking
 * Checks version/updatedAt before update to prevent lost updates
 * 
 * @example
 * ```typescript
 * const updated = await optimisticUpdate(
 *   prisma.workOrder,
 *   { id: orderId },
 *   existingOrder.updatedAt,
 *   { status: 'COMPLETED' }
 * );
 * ```
 */
export async function optimisticUpdate<
  T extends { update: (args: { where: W; data: D }) => Promise<R> },
  W extends { id: string },
  D extends { updatedAt?: Date },
  R
>(
  model: T,
  where: W,
  expectedUpdatedAt: Date,
  data: D
): Promise<R> {
  // Add version check to the where clause
  const whereWithVersion = {
    ...where,
    updatedAt: expectedUpdatedAt,
  };

  try {
    return await model.update({
      where: whereWithVersion as W,
      data,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025' // Record not found (version mismatch)
    ) {
      throw new OptimisticLockError(
        'Record was modified by another user. Please refresh and try again.'
      );
    }
    throw error;
  }
}

/**
 * Custom error for optimistic locking failures
 */
export class OptimisticLockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OptimisticLockError';
  }
}

/**
 * Execute a read-only query outside of any transaction
 * Useful for analytics/reporting queries that shouldn't block writes
 */
export async function readOnly<T>(
  fn: () => Promise<T>
): Promise<T> {
  // For now, just execute directly
  // In the future, could use read replicas
  return fn();
}

// ============ Utility Functions ============

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// ============ Pre-built Transaction Patterns ============

/**
 * Create an order with all related records in a single transaction
 */
export interface CreateOrderTransactionData {
  order: Prisma.WorkOrderCreateInput;
  stationProgress?: Prisma.StationProgressCreateManyInput[];
  lineItems?: Prisma.LineItemCreateManyInput[];
  activityLog?: Prisma.ActivityLogCreateInput;
}

export async function createOrderWithRelations(
  data: CreateOrderTransactionData
): Promise<{ orderId: string }> {
  return withTransaction(async (tx) => {
    // Create the order first
    const order = await tx.workOrder.create({
      data: data.order,
    });

    // Create station progress if provided
    if (data.stationProgress && data.stationProgress.length > 0) {
      await tx.stationProgress.createMany({
        data: data.stationProgress.map((sp) => ({
          ...sp,
          orderId: order.id,
        })),
      });
    }

    // Create line items if provided
    if (data.lineItems && data.lineItems.length > 0) {
      await tx.lineItem.createMany({
        data: data.lineItems.map((li) => ({
          ...li,
          workOrderId: order.id,
        })),
      });
    }

    // Create activity log if provided
    if (data.activityLog) {
      await tx.activityLog.create({
        data: {
          ...data.activityLog,
          entityId: order.id,
        },
      });
    }

    return { orderId: order.id };
  });
}

/**
 * Update inventory with usage tracking in a single transaction
 */
export async function updateInventoryWithUsage(
  itemMasterId: string,
  quantityChange: number,
  usageData: {
    orderId: string;
    recordedById: string;
    unitCost?: number;
    notes?: string;
  }
): Promise<void> {
  await withTransaction(async (tx) => {
    // Get the item master to find related inventory items
    const itemMaster = await tx.itemMaster.findUnique({
      where: { id: itemMasterId },
      include: { inventoryItems: true },
    });

    if (!itemMaster) {
      throw new Error(`Item master ${itemMasterId} not found`);
    }

    // Update inventory quantity if there's inventory linked
    const inventoryItem = itemMaster.inventoryItems[0];
    if (inventoryItem) {
      await tx.inventoryItem.update({
        where: { id: inventoryItem.id },
        data: {
          quantity: {
            increment: quantityChange,
          },
        },
      });
    }

    // Record the material usage
    const quantity = Math.abs(quantityChange);
    const unitCost = usageData.unitCost ?? 0;
    await tx.materialUsage.create({
      data: {
        itemMasterId,
        workOrderId: usageData.orderId,
        quantity,
        unitCost,
        totalCost: quantity * unitCost,
        recordedById: usageData.recordedById,
        notes: usageData.notes,
      },
    });
  });
}
