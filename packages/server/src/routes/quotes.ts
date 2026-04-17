import { Router, type Response } from 'express';
import { prisma } from '../db/client.js';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { NotFoundError, BadRequestError, ForbiddenError } from '../middleware/error-handler.js';
import { broadcast } from '../ws/server.js';
import { buildRouteBroadcastPayload } from '../lib/route-broadcast.js';
import { buildTokenizedSearchWhere } from '../lib/fuzzy-search.js';
import {
  CreateQuoteSchema,
  UpdateQuoteSchema,
  QuoteFilterSchema,
  CreateQuoteLineItemSchema,
  UserRole,
  QuoteStatus,
} from '@erp/shared';

export const quotesRouter = Router();

// Apply authentication to all routes
quotesRouter.use(authenticate);

// Generate next quote number
async function generateQuoteNumber(): Promise<string> {
  const prefix = 'Q';
  const year = new Date().getFullYear().toString().slice(-2);
  
  // Find the highest quote number for this year
  const lastQuote = await prisma.quote.findFirst({
    where: {
      quoteNumber: {
        startsWith: `${prefix}${year}`,
      },
    },
    orderBy: { quoteNumber: 'desc' },
  });

  let nextNumber = 1;
  if (lastQuote) {
    const match = lastQuote.quoteNumber.match(/\d+$/);
    if (match) {
      nextNumber = parseInt(match[0], 10) + 1;
    }
  }

  return `${prefix}${year}-${nextNumber.toString().padStart(4, '0')}`;
}

// Calculate quote totals
function calculateTotals(lineItems: Array<{ quantity: number; unitPrice: number }>, taxRate: number, discountPercent: number) {
  const subtotal = lineItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const discountAmount = subtotal * (discountPercent / 100);
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = taxableAmount * taxRate;
  const total = taxableAmount + taxAmount;
  
  return { subtotal, discountAmount, taxAmount, total };
}

// GET /quotes - List all quotes with filtering
quotesRouter.get('/', async (req: AuthRequest, res: Response) => {
  const filters = QuoteFilterSchema.parse(req.query);
  const { page, pageSize, status, customerId, assignedToId, search, fromDate, toDate, sortBy, sortOrder } = filters;

  const where: Record<string, unknown> = {};

  if (status && status.length > 0) {
    // Support filtering by multiple statuses
    if (status.length === 1) {
      where.status = status[0];
    } else {
      where.status = { in: status };
    }
  }

  if (customerId) {
    where.customerId = customerId;
  }

  if (assignedToId) {
    where.assignedToId = assignedToId;
  }

  if (search) {
    const searchWhere = buildTokenizedSearchWhere(search, [
      'quoteNumber',
      'customerName',
      'description',
    ]);
    if (searchWhere) {
      Object.assign(where, searchWhere);
    }
  }

  if (fromDate || toDate) {
    where.createdAt = {};
    if (fromDate) (where.createdAt as Record<string, unknown>).gte = fromDate;
    if (toDate) (where.createdAt as Record<string, unknown>).lte = toDate;
  }

  const [items, total] = await Promise.all([
    prisma.quote.findMany({
      where,
      include: {
        customer: true,
        createdBy: {
          select: { id: true, displayName: true },
        },
        assignedTo: {
          select: { id: true, displayName: true },
        },
        lineItems: true,
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.quote.count({ where }),
  ]);

  res.json({
    success: true,
    data: {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  });
});

// GET /quotes/stats - Get quote statistics for dashboard
quotesRouter.get('/stats', async (req: AuthRequest, res: Response) => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalQuotes,
    draftQuotes,
    sentQuotes,
    approvedQuotes,
    convertedQuotes,
    quotesThisMonth,
    revenueThisMonth,
    conversionRate,
  ] = await Promise.all([
    prisma.quote.count(),
    prisma.quote.count({ where: { status: 'DRAFT' } }),
    prisma.quote.count({ where: { status: 'SENT' } }),
    prisma.quote.count({ where: { status: 'APPROVED' } }),
    prisma.quote.count({ where: { status: 'CONVERTED' } }),
    prisma.quote.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.quote.aggregate({
      where: { status: 'CONVERTED', convertedAt: { gte: startOfMonth } },
      _sum: { total: true },
    }),
    // Calculate conversion rate (converted / (converted + rejected))
    prisma.quote.groupBy({
      by: ['status'],
      where: { status: { in: ['CONVERTED', 'REJECTED'] } },
      _count: true,
    }),
  ]);

  const converted = conversionRate.find(r => r.status === 'CONVERTED')?._count ?? 0;
  const rejected = conversionRate.find(r => r.status === 'REJECTED')?._count ?? 0;
  const rate = converted + rejected > 0 ? (converted / (converted + rejected)) * 100 : 0;

  res.json({
    success: true,
    data: {
      totalQuotes,
      draftQuotes,
      sentQuotes,
      approvedQuotes,
      convertedQuotes,
      quotesThisMonth,
      revenueThisMonth: revenueThisMonth._sum.total ?? 0,
      conversionRate: Math.round(rate),
    },
  });
});

// GET /quotes/:id - Get quote by ID
quotesRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      customer: { include: { contacts: true } },
      createdBy: { select: { id: true, displayName: true } },
      assignedTo: { select: { id: true, displayName: true } },
      lineItems: {
        orderBy: { itemNumber: 'asc' },
        include: { itemMaster: true },
      },
    },
  });

  if (!quote) {
    throw NotFoundError('Quote not found');
  }

  res.json({ success: true, data: quote });
});

// POST /quotes - Create new quote
quotesRouter.post('/', async (req: AuthRequest, res: Response) => {
  const data = CreateQuoteSchema.parse(req.body);
  const { lineItems, ...quoteData } = data;

  const quoteNumber = await generateQuoteNumber();

  // Calculate line item totals
  const lineItemsWithTotals = lineItems.map((item, index) => ({
    itemNumber: index + 1,
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    notes: item.notes ?? null,
    itemMasterId: item.itemMasterId ?? null,
    totalPrice: item.quantity * item.unitPrice,
  }));

  const totals = calculateTotals(lineItemsWithTotals, quoteData.taxRate ?? 0, quoteData.discountPercent ?? 0);

  // Build create data explicitly to avoid undefined spreading
  const createData: Record<string, unknown> = {
    quoteNumber,
    customerName: quoteData.customerName,
    status: 'DRAFT',
    taxRate: quoteData.taxRate ?? 0,
    discountPercent: quoteData.discountPercent ?? 0,
    ...totals,
    createdById: req.user!.id,
    lineItems: { create: lineItemsWithTotals },
  };
  if (quoteData.customerId !== undefined) createData.customerId = quoteData.customerId;
  if (quoteData.description !== undefined) createData.description = quoteData.description;
  if (quoteData.notes !== undefined) createData.notes = quoteData.notes;
  if (quoteData.internalNotes !== undefined) createData.internalNotes = quoteData.internalNotes;
  if (quoteData.validUntil !== undefined) createData.validUntil = quoteData.validUntil;
  if (quoteData.assignedToId !== undefined) createData.assignedToId = quoteData.assignedToId;

  const quote = await prisma.quote.create({
    data: createData as Parameters<typeof prisma.quote.create>[0]['data'],
    include: {
      customer: true,
      lineItems: true,
      createdBy: { select: { id: true, displayName: true } },
    },
  });

  res.status(201).json({ success: true, data: quote });
});

// PATCH /quotes/:id - Update quote
quotesRouter.patch('/:id', async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const data = UpdateQuoteSchema.parse(req.body);

  const existing = await prisma.quote.findUnique({
    where: { id },
    include: { lineItems: true },
  });

  if (!existing) {
    throw NotFoundError('Quote not found');
  }

  // Don't allow editing converted quotes
  if (existing.status === 'CONVERTED') {
    throw BadRequestError('Cannot edit a converted quote');
  }

  // Handle status transitions
  const updateData: Record<string, unknown> = { ...data };
  
  if (data.status === 'SENT' && existing.status === 'DRAFT') {
    updateData.sentAt = new Date();
  } else if (data.status === 'APPROVED') {
    updateData.approvedAt = new Date();
  } else if (data.status === 'REJECTED') {
    updateData.rejectedAt = new Date();
  }

  // Recalculate totals if tax/discount changed
  if (data.taxRate !== undefined || data.discountPercent !== undefined) {
    const totals = calculateTotals(
      existing.lineItems.map((li: { quantity: number; unitPrice: unknown }) => ({ quantity: li.quantity, unitPrice: Number(li.unitPrice) })),
      data.taxRate ?? Number(existing.taxRate),
      data.discountPercent ?? Number(existing.discountPercent)
    );
    Object.assign(updateData, totals);
  }

  const quote = await prisma.quote.update({
    where: { id },
    data: updateData,
    include: {
      customer: true,
      lineItems: true,
      createdBy: { select: { id: true, displayName: true } },
    },
  });

  res.json({ success: true, data: quote });
});

// POST /quotes/:id/convert - Convert quote to work order
quotesRouter.post('/:id/convert', async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: { lineItems: true },
  });

  if (!quote) {
    throw NotFoundError('Quote not found');
  }

  if (quote.status === 'CONVERTED') {
    throw BadRequestError('Quote has already been converted');
  }

  if (quote.status !== 'APPROVED') {
    throw BadRequestError('Only approved quotes can be converted to work orders');
  }

  // Generate work order number
  const prefix = 'WO';
  const year = new Date().getFullYear().toString().slice(-2);
  const lastOrder = await prisma.workOrder.findFirst({
    orderBy: { orderNumber: 'desc' },
  });
  let nextNum = 1;
  if (lastOrder) {
    const match = lastOrder.orderNumber.match(/\d+$/);
    if (match) nextNum = parseInt(match[0], 10) + 1;
  }
  const orderNumber = `${prefix}${year}-${nextNum.toString().padStart(5, '0')}`;

  // Create work order from quote
  const workOrder = await prisma.workOrder.create({
    data: {
      orderNumber,
      customerName: quote.customerName,
      description: quote.description ?? `Converted from ${quote.quoteNumber}`,
      notes: quote.notes,
      createdById: req.user!.id,
      lineItems: {
        create: quote.lineItems.map((li, index) => ({
          itemNumber: index + 1,
          description: li.description,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          notes: li.notes,
          itemMasterId: li.itemMasterId,
        })),
      },
    },
    include: { lineItems: true },
  });

  // Update quote status
  await prisma.quote.update({
    where: { id },
    data: {
      status: 'CONVERTED',
      convertedAt: new Date(),
      convertedOrderId: workOrder.id,
    },
  });

  broadcast(buildRouteBroadcastPayload({
    type: 'ORDER_CREATED' as any,
    payload: { orderNumber: workOrder.orderNumber },
    timestamp: new Date(),
  }));

  res.json({ success: true, data: workOrder });
});

// ============ Line Item Routes ============

// POST /quotes/:id/line-items - Add line item to quote
quotesRouter.post('/:id/line-items', async (req: AuthRequest, res: Response) => {
  const quoteId = req.params.id as string;
  const data = CreateQuoteLineItemSchema.parse(req.body);

  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: { lineItems: true },
  });

  if (!quote) {
    throw NotFoundError('Quote not found');
  }

  if (quote.status === 'CONVERTED') {
    throw BadRequestError('Cannot modify a converted quote');
  }

  const nextItemNumber = quote.lineItems.length > 0
    ? Math.max(...quote.lineItems.map((li: { itemNumber: number }) => li.itemNumber)) + 1
    : 1;

  const lineItem = await prisma.quoteLineItem.create({
    data: {
      description: data.description,
      quantity: data.quantity,
      unitPrice: data.unitPrice,
      notes: data.notes ?? null,
      itemMasterId: data.itemMasterId ?? null,
      quoteId,
      itemNumber: nextItemNumber,
      totalPrice: data.quantity * data.unitPrice,
    },
  });

  // Recalculate quote totals
  const allLineItems = [...quote.lineItems, lineItem];
  const totals = calculateTotals(
    allLineItems.map((li: { quantity: number; unitPrice: unknown }) => ({ quantity: li.quantity, unitPrice: Number(li.unitPrice) })),
    Number(quote.taxRate),
    Number(quote.discountPercent)
  );

  await prisma.quote.update({
    where: { id: quoteId },
    data: totals,
  });

  res.status(201).json({ success: true, data: lineItem });
});

// DELETE /quotes/:quoteId/line-items/:lineItemId - Delete line item
quotesRouter.delete('/:quoteId/line-items/:lineItemId', async (req: AuthRequest, res: Response) => {
  const quoteId = req.params.quoteId as string;
  const lineItemId = req.params.lineItemId as string;

  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: { lineItems: true },
  });

  if (!quote) {
    throw NotFoundError('Quote not found');
  }

  if (quote.status === 'CONVERTED') {
    throw BadRequestError('Cannot modify a converted quote');
  }

  await prisma.quoteLineItem.delete({
    where: { id: lineItemId },
  });

  // Recalculate quote totals
  const remainingItems = quote.lineItems.filter((li: { id: string }) => li.id !== lineItemId);
  const totals = calculateTotals(
    remainingItems.map((li: { quantity: number; unitPrice: unknown }) => ({ quantity: li.quantity, unitPrice: Number(li.unitPrice) })),
    Number(quote.taxRate),
    Number(quote.discountPercent)
  );

  await prisma.quote.update({
    where: { id: quoteId },
    data: totals,
  });

  res.json({ success: true, message: 'Line item deleted' });
});

// DELETE /quotes/:id - Delete quote (only drafts)
quotesRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const quote = await prisma.quote.findUnique({
    where: { id },
  });

  if (!quote) {
    throw NotFoundError('Quote not found');
  }

  if (quote.status !== 'DRAFT') {
    throw BadRequestError('Only draft quotes can be deleted');
  }

  await prisma.quote.delete({
    where: { id },
  });

  res.json({ success: true, message: 'Quote deleted' });
});
