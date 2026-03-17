/**
 * Bulk Operations Routes
 * 
 * Provides centralized bulk operation endpoints for multiple entity types:
 * - Quotes: bulk status change, bulk delete, bulk assign
 * - Purchase Orders: bulk status change, bulk cancel
 * - Inventory: bulk update quantities, bulk adjust stock
 * - Customers: bulk tag, bulk archive
 */

import { Router, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { BadRequestError, ForbiddenError } from '../middleware/error-handler.js';
import { broadcast } from '../ws/server.js';
import { logActivity, ActivityAction, EntityType } from '../lib/activity-logger.js';
import { QuoteStatus, POStatus, UserRole } from '@erp/shared';

export const bulkRouter = Router();

// All routes require authentication
bulkRouter.use(authenticate);

// ============================================================
// SCHEMAS - Bulk operation request validation
// ============================================================

const BulkQuoteStatusSchema = z.object({
  quoteIds: z.array(z.string().uuid()).min(1, 'At least one quote ID required'),
  status: z.nativeEnum(QuoteStatus),
});

const BulkQuoteDeleteSchema = z.object({
  quoteIds: z.array(z.string().uuid()).min(1, 'At least one quote ID required'),
  permanent: z.boolean().optional().default(false),
});

const BulkQuoteAssignSchema = z.object({
  quoteIds: z.array(z.string().uuid()).min(1, 'At least one quote ID required'),
  assignedToId: z.string().uuid(),
});

const BulkPOStatusSchema = z.object({
  purchaseOrderIds: z.array(z.string().uuid()).min(1, 'At least one PO ID required'),
  status: z.nativeEnum(POStatus),
});

const BulkPOCancelSchema = z.object({
  purchaseOrderIds: z.array(z.string().uuid()).min(1, 'At least one PO ID required'),
  reason: z.string().optional(),
});

const BulkInventoryAdjustSchema = z.object({
  adjustments: z.array(z.object({
    itemId: z.string().uuid(),
    quantityChange: z.number(), // positive = add, negative = subtract
    reason: z.string().optional(),
  })).min(1, 'At least one adjustment required'),
});

const BulkInventorySetSchema = z.object({
  items: z.array(z.object({
    itemId: z.string().uuid(),
    quantity: z.number().int().min(0),
    reason: z.string().optional(),
  })).min(1, 'At least one item required'),
});

const BulkCustomerArchiveSchema = z.object({
  customerIds: z.array(z.string().uuid()).min(1, 'At least one customer ID required'),
  archive: z.boolean().default(true), // true = archive, false = unarchive
});

// ============================================================
// QUOTE BULK OPERATIONS
// ============================================================

// POST /bulk/quotes/status - Bulk change quote status
bulkRouter.post('/quotes/status', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { quoteIds, status } = BulkQuoteStatusSchema.parse(req.body);

  // Verify user has permission (admin, manager, or sales)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!user || !['ADMIN', 'MANAGER', 'SALES'].includes(user.role)) {
    throw ForbiddenError('Insufficient permissions for bulk quote operations');
  }

  // Fetch quotes
  const quotes = await prisma.quote.findMany({
    where: { id: { in: quoteIds } },
    select: { id: true, quoteNumber: true, status: true, customerName: true },
  });

  if (quotes.length === 0) {
    throw BadRequestError('No valid quotes found');
  }

  // Filter out quotes that already have the target status
  const quotesToUpdate = quotes.filter(q => q.status !== status);

  if (quotesToUpdate.length === 0) {
    return res.json({
      success: true,
      data: { updated: 0, message: `All quotes already have status ${status}` },
    });
  }

  // Update all quotes
  await prisma.quote.updateMany({
    where: { id: { in: quotesToUpdate.map(q => q.id) } },
    data: { status },
  });

  // Log activity for each quote
  for (const quote of quotesToUpdate) {
    await logActivity({
      action: ActivityAction.UPDATE,
      entityType: EntityType.QUOTE,
      entityId: quote.id,
      description: `Bulk status change: ${quote.status} → ${status}`,
      userId,
      req,
    });
  }

  // Broadcast updates
  for (const quote of quotesToUpdate) {
    broadcast({ type: 'QUOTE_UPDATED', payload: { quoteId: quote.id } });
  }

  res.json({
    success: true,
    data: {
      updated: quotesToUpdate.length,
      skipped: quotes.length - quotesToUpdate.length,
      message: `${quotesToUpdate.length} quote(s) status changed to ${status}`,
    },
  });
});

// POST /bulk/quotes/assign - Bulk assign quotes to user
bulkRouter.post('/quotes/assign', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { quoteIds, assignedToId } = BulkQuoteAssignSchema.parse(req.body);

  // Verify assignee exists
  const assignee = await prisma.user.findUnique({
    where: { id: assignedToId },
    select: { id: true, displayName: true },
  });

  if (!assignee) {
    throw BadRequestError('Assignee user not found');
  }

  // Fetch quotes
  const quotes = await prisma.quote.findMany({
    where: { id: { in: quoteIds } },
    select: { id: true, quoteNumber: true, assignedToId: true },
  });

  if (quotes.length === 0) {
    throw BadRequestError('No valid quotes found');
  }

  // Filter out quotes already assigned to this user
  const quotesToUpdate = quotes.filter(q => q.assignedToId !== assignedToId);

  if (quotesToUpdate.length === 0) {
    return res.json({
      success: true,
      data: { updated: 0, message: `All quotes already assigned to ${assignee.displayName}` },
    });
  }

  // Update all quotes
  await prisma.quote.updateMany({
    where: { id: { in: quotesToUpdate.map(q => q.id) } },
    data: { assignedToId },
  });

  // Log activity
  for (const quote of quotesToUpdate) {
    await logActivity({
      action: ActivityAction.UPDATE,
      entityType: EntityType.QUOTE,
      entityId: quote.id,
      description: `Bulk assignment: Assigned to ${assignee.displayName}`,
      userId,
      req,
    });
  }

  // Broadcast updates
  for (const quote of quotesToUpdate) {
    broadcast({ type: 'QUOTE_UPDATED', payload: { quoteId: quote.id } });
  }

  res.json({
    success: true,
    data: {
      updated: quotesToUpdate.length,
      skipped: quotes.length - quotesToUpdate.length,
      message: `${quotesToUpdate.length} quote(s) assigned to ${assignee.displayName}`,
    },
  });
});

// POST /bulk/quotes/delete - Bulk delete quotes
bulkRouter.post('/quotes/delete', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { quoteIds, permanent } = BulkQuoteDeleteSchema.parse(req.body);

  // Verify user has permission
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!user || !['ADMIN', 'MANAGER'].includes(user.role)) {
    throw ForbiddenError('Only admins and managers can bulk delete quotes');
  }

  // Fetch quotes
  const quotes = await prisma.quote.findMany({
    where: { id: { in: quoteIds } },
    select: { id: true, quoteNumber: true, status: true },
  });

  if (quotes.length === 0) {
    throw BadRequestError('No valid quotes found');
  }

  // Don't allow deleting converted quotes
  const convertedQuotes = quotes.filter(q => q.status === 'CONVERTED');
  if (convertedQuotes.length > 0 && permanent) {
    throw BadRequestError(`Cannot permanently delete ${convertedQuotes.length} converted quote(s)`);
  }

  const quotesToDelete = quotes.filter(q => q.status !== 'CONVERTED');

  if (permanent) {
    // Hard delete
    await prisma.quote.deleteMany({
      where: { id: { in: quotesToDelete.map(q => q.id) } },
    });
  } else {
    // Soft delete - just mark as expired
    await prisma.quote.updateMany({
      where: { id: { in: quotesToDelete.map(q => q.id) } },
      data: { status: 'EXPIRED' },
    });
  }

  // Log activity
  for (const quote of quotesToDelete) {
    await logActivity({
      action: permanent ? ActivityAction.DELETE : ActivityAction.UPDATE,
      entityType: EntityType.QUOTE,
      entityId: quote.id,
      description: permanent ? `Bulk deleted quote ${quote.quoteNumber}` : `Bulk expired quote ${quote.quoteNumber}`,
      userId,
      req,
    });
  }

  // Broadcast updates
  for (const quote of quotesToDelete) {
    broadcast({ type: permanent ? 'QUOTE_DELETED' : 'QUOTE_UPDATED', payload: { quoteId: quote.id } });
  }

  res.json({
    success: true,
    data: {
      deleted: quotesToDelete.length,
      skipped: quotes.length - quotesToDelete.length,
      message: `${quotesToDelete.length} quote(s) ${permanent ? 'deleted' : 'expired'}`,
    },
  });
});

// ============================================================
// PURCHASE ORDER BULK OPERATIONS
// ============================================================

// POST /bulk/purchase-orders/status - Bulk change PO status
bulkRouter.post('/purchase-orders/status', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { purchaseOrderIds, status } = BulkPOStatusSchema.parse(req.body);

  // Verify user has permission
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!user || !['ADMIN', 'MANAGER'].includes(user.role)) {
    throw ForbiddenError('Only admins and managers can bulk update PO status');
  }

  // Fetch POs
  const purchaseOrders = await prisma.purchaseOrder.findMany({
    where: { id: { in: purchaseOrderIds } },
    select: { id: true, poNumber: true, status: true },
  });

  if (purchaseOrders.length === 0) {
    throw BadRequestError('No valid purchase orders found');
  }

  // Filter out POs that already have the target status
  const posToUpdate = purchaseOrders.filter(po => po.status !== status);

  if (posToUpdate.length === 0) {
    return res.json({
      success: true,
      data: { updated: 0, message: `All POs already have status ${status}` },
    });
  }

  // Validate status transitions
  const invalidTransitions = posToUpdate.filter(po => {
    // Can't change status of received or cancelled POs
    return po.status === 'RECEIVED' || po.status === 'CANCELLED';
  });

  if (invalidTransitions.length > 0) {
    throw BadRequestError(`Cannot change status of ${invalidTransitions.length} received/cancelled PO(s)`);
  }

  // Update all POs
  await prisma.purchaseOrder.updateMany({
    where: { id: { in: posToUpdate.map(po => po.id) } },
    data: { status },
  });

  // Log activity
  for (const po of posToUpdate) {
    await logActivity({
      action: ActivityAction.UPDATE,
      entityType: EntityType.PURCHASE_ORDER,
      entityId: po.id,
      description: `Bulk status change: ${po.status} → ${status}`,
      userId,
      req,
    });
  }

  // Broadcast updates
  for (const po of posToUpdate) {
    broadcast({ type: 'PURCHASE_ORDER_UPDATED', payload: { purchaseOrderId: po.id } });
  }

  res.json({
    success: true,
    data: {
      updated: posToUpdate.length,
      skipped: purchaseOrders.length - posToUpdate.length,
      message: `${posToUpdate.length} PO(s) status changed to ${status}`,
    },
  });
});

// POST /bulk/purchase-orders/cancel - Bulk cancel POs
bulkRouter.post('/purchase-orders/cancel', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { purchaseOrderIds, reason } = BulkPOCancelSchema.parse(req.body);

  // Verify user has permission
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!user || !['ADMIN', 'MANAGER'].includes(user.role)) {
    throw ForbiddenError('Only admins and managers can bulk cancel POs');
  }

  // Fetch POs
  const purchaseOrders = await prisma.purchaseOrder.findMany({
    where: { id: { in: purchaseOrderIds } },
    select: { id: true, poNumber: true, status: true },
  });

  if (purchaseOrders.length === 0) {
    throw BadRequestError('No valid purchase orders found');
  }

  // Filter out already cancelled or received POs
  const posToCancel = purchaseOrders.filter(po => 
    po.status !== 'CANCELLED' && po.status !== 'RECEIVED'
  );

  if (posToCancel.length === 0) {
    return res.json({
      success: true,
      data: { updated: 0, message: 'No POs available to cancel' },
    });
  }

  // Update all POs
  await prisma.purchaseOrder.updateMany({
    where: { id: { in: posToCancel.map(po => po.id) } },
    data: { 
      status: 'CANCELLED',
      notes: reason ? `Bulk cancelled: ${reason}` : 'Bulk cancelled',
    },
  });

  // Log activity
  for (const po of posToCancel) {
    await logActivity({
      action: ActivityAction.UPDATE,
      entityType: EntityType.PURCHASE_ORDER,
      entityId: po.id,
      description: `Bulk cancelled: ${po.status} → CANCELLED${reason ? ` (${reason})` : ''}`,
      userId,
      req,
    });
  }

  // Broadcast updates
  for (const po of posToCancel) {
    broadcast({ type: 'PURCHASE_ORDER_UPDATED', payload: { purchaseOrderId: po.id } });
  }

  res.json({
    success: true,
    data: {
      updated: posToCancel.length,
      skipped: purchaseOrders.length - posToCancel.length,
      message: `${posToCancel.length} PO(s) cancelled`,
    },
  });
});

// ============================================================
// INVENTORY BULK OPERATIONS
// ============================================================

// POST /bulk/inventory/adjust - Bulk adjust inventory quantities
bulkRouter.post('/inventory/adjust', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { adjustments } = BulkInventoryAdjustSchema.parse(req.body);

  const results: Array<{ itemId: string; itemName: string; oldQuantity: number; newQuantity: number }> = [];
  const errors: Array<{ itemId: string; error: string }> = [];

  // Process each adjustment in a transaction
  await prisma.$transaction(async (tx) => {
    for (const adj of adjustments) {
      try {
        const item = await tx.inventoryItem.findUnique({
          where: { id: adj.itemId },
          select: { 
            id: true, 
            quantity: true,
            itemMaster: { select: { name: true, sku: true } },
          },
        });

        if (!item) {
          errors.push({ itemId: adj.itemId, error: 'Item not found' });
          continue;
        }

        const newQuantity = item.quantity + adj.quantityChange;
        
        if (newQuantity < 0) {
          errors.push({ itemId: adj.itemId, error: `Would result in negative quantity (${newQuantity})` });
          continue;
        }

        await tx.inventoryItem.update({
          where: { id: adj.itemId },
          data: { quantity: newQuantity },
        });

        results.push({
          itemId: item.id,
          itemName: item.itemMaster?.name || item.itemMaster?.sku || 'Unknown',
          oldQuantity: item.quantity,
          newQuantity,
        });
      } catch {
        errors.push({ itemId: adj.itemId, error: 'Update failed' });
      }
    }
  });

  // Log activity
  if (results.length > 0) {
    await logActivity({
      action: ActivityAction.UPDATE,
      entityType: EntityType.INVENTORY_ITEM,
      entityId: 'bulk',
      description: `Bulk inventory adjustment: ${results.length} item(s) updated`,
      userId,
      req,
    });
  }

  // Broadcast updates
  for (const result of results) {
    broadcast({ type: 'INVENTORY_UPDATED', payload: { itemId: result.itemId } });
  }

  res.json({
    success: true,
    data: {
      updated: results.length,
      failed: errors.length,
      results,
      errors,
    },
  });
});

// POST /bulk/inventory/set - Bulk set inventory quantities to specific values
bulkRouter.post('/inventory/set', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { items } = BulkInventorySetSchema.parse(req.body);

  // Verify user has permission
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!user || !['ADMIN', 'MANAGER'].includes(user.role)) {
    throw ForbiddenError('Only admins and managers can bulk set inventory quantities');
  }

  const results: Array<{ itemId: string; itemName: string; oldQuantity: number; newQuantity: number }> = [];
  const errors: Array<{ itemId: string; error: string }> = [];

  // Process each item
  await prisma.$transaction(async (tx) => {
    for (const item of items) {
      try {
        const existing = await tx.inventoryItem.findUnique({
          where: { id: item.itemId },
          select: { 
            id: true, 
            quantity: true,
            itemMaster: { select: { name: true, sku: true } },
          },
        });

        if (!existing) {
          errors.push({ itemId: item.itemId, error: 'Item not found' });
          continue;
        }

        await tx.inventoryItem.update({
          where: { id: item.itemId },
          data: { quantity: item.quantity },
        });

        results.push({
          itemId: existing.id,
          itemName: existing.itemMaster?.name || existing.itemMaster?.sku || 'Unknown',
          oldQuantity: existing.quantity,
          newQuantity: item.quantity,
        });
      } catch {
        errors.push({ itemId: item.itemId, error: 'Update failed' });
      }
    }
  });

  // Log activity
  if (results.length > 0) {
    await logActivity({
      action: ActivityAction.UPDATE,
      entityType: EntityType.INVENTORY_ITEM,
      entityId: 'bulk',
      description: `Bulk inventory set: ${results.length} item(s) quantity updated`,
      userId,
      req,
    });
  }

  // Broadcast updates
  for (const result of results) {
    broadcast({ type: 'INVENTORY_UPDATED', payload: { itemId: result.itemId } });
  }

  res.json({
    success: true,
    data: {
      updated: results.length,
      failed: errors.length,
      results,
      errors,
    },
  });
});

// ============================================================
// CUSTOMER BULK OPERATIONS
// ============================================================

// POST /bulk/customers/archive - Bulk archive/unarchive customers
bulkRouter.post('/customers/archive', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { customerIds, archive } = BulkCustomerArchiveSchema.parse(req.body);

  // Verify user has permission
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!user || !['ADMIN', 'MANAGER', 'SALES'].includes(user.role)) {
    throw ForbiddenError('Insufficient permissions for bulk customer operations');
  }

  // Fetch customers
  const customers = await prisma.customer.findMany({
    where: { id: { in: customerIds } },
    select: { id: true, name: true, isActive: true },
  });

  if (customers.length === 0) {
    throw BadRequestError('No valid customers found');
  }

  // Filter customers that need updating (archive = set inactive, unarchive = set active)
  const customersToUpdate = customers.filter(c => c.isActive === archive);

  if (customersToUpdate.length === 0) {
    return res.json({
      success: true,
      data: { 
        updated: 0, 
        message: `All customers already ${archive ? 'archived' : 'active'}` 
      },
    });
  }

  // Update all customers
  await prisma.customer.updateMany({
    where: { id: { in: customersToUpdate.map(c => c.id) } },
    data: { isActive: !archive },
  });

  // Log activity
  for (const customer of customersToUpdate) {
    await logActivity({
      action: ActivityAction.UPDATE,
      entityType: EntityType.CUSTOMER,
      entityId: customer.id,
      description: `Bulk ${archive ? 'archived' : 'unarchived'} customer`,
      userId,
      req,
    });
  }

  // Broadcast updates
  for (const customer of customersToUpdate) {
    broadcast({ type: 'CUSTOMER_UPDATED', payload: { customerId: customer.id } });
  }

  res.json({
    success: true,
    data: {
      updated: customersToUpdate.length,
      skipped: customers.length - customersToUpdate.length,
      message: `${customersToUpdate.length} customer(s) ${archive ? 'archived' : 'unarchived'}`,
    },
  });
});

// ============================================================
// HELPER: Get summary of bulk operation capabilities
// ============================================================

// GET /bulk/capabilities - List available bulk operations
bulkRouter.get('/capabilities', async (_req: AuthRequest, res: Response) => {
  res.json({
    success: true,
    data: {
      quotes: {
        endpoints: [
          { method: 'POST', path: '/bulk/quotes/status', description: 'Bulk change quote status' },
          { method: 'POST', path: '/bulk/quotes/assign', description: 'Bulk assign quotes to user' },
          { method: 'POST', path: '/bulk/quotes/delete', description: 'Bulk delete/expire quotes' },
        ],
        availableStatuses: Object.values(QuoteStatus),
      },
      purchaseOrders: {
        endpoints: [
          { method: 'POST', path: '/bulk/purchase-orders/status', description: 'Bulk change PO status' },
          { method: 'POST', path: '/bulk/purchase-orders/cancel', description: 'Bulk cancel POs' },
        ],
        availableStatuses: Object.values(POStatus),
      },
      inventory: {
        endpoints: [
          { method: 'POST', path: '/bulk/inventory/adjust', description: 'Bulk adjust quantities (add/subtract)' },
          { method: 'POST', path: '/bulk/inventory/set', description: 'Bulk set quantities to specific values' },
        ],
      },
      customers: {
        endpoints: [
          { method: 'POST', path: '/bulk/customers/archive', description: 'Bulk archive/unarchive customers' },
        ],
      },
    },
  });
});
