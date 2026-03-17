import { Router, type Response } from 'express';
import {
  CreateInventoryItemSchema,
  UpdateInventoryItemSchema,
  PaginationSchema,
  UserRole,
} from '@erp/shared';
import { prisma } from '../db/client.js';
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth.js';
import { NotFoundError } from '../middleware/error-handler.js';

export const inventoryRouter = Router();

inventoryRouter.use(authenticate);

// GET /inventory - List inventory items
inventoryRouter.get('/', async (req: AuthRequest, res: Response) => {
  const { page, pageSize } = PaginationSchema.parse(req.query);
  const status = req.query.status as string | undefined;
  const itemMasterId = req.query.itemMasterId as string | undefined;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (itemMasterId) where.itemMasterId = itemMasterId;

  const [items, total] = await Promise.all([
    prisma.inventoryItem.findMany({
      where,
      include: {
        itemMaster: { select: { id: true, sku: true, name: true } },
        linkedOrder: { select: { orderNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.inventoryItem.count({ where }),
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

// GET /inventory/:id
inventoryRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  const item = await prisma.inventoryItem.findUnique({
    where: { id: req.params.id },
    include: {
      itemMaster: true,
      linkedOrder: { select: { id: true, orderNumber: true } },
      linkedLineItem: true,
    },
  });

  if (!item) throw NotFoundError('Inventory item not found');

  res.json({ success: true, data: item });
});

// POST /inventory - Create inventory item
inventoryRouter.post('/', requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.OPERATOR), async (req: AuthRequest, res: Response) => {
  const data = CreateInventoryItemSchema.parse(req.body);

  const item = await prisma.inventoryItem.create({
    data,
    include: {
      itemMaster: { select: { sku: true, name: true } },
    },
  });

  res.status(201).json({ success: true, data: item });
});

// PATCH /inventory/:id
inventoryRouter.patch('/:id', async (req: AuthRequest, res: Response) => {
  const data = UpdateInventoryItemSchema.parse(req.body);

  const item = await prisma.inventoryItem.update({
    where: { id: req.params.id },
    data,
    include: {
      itemMaster: { select: { sku: true, name: true } },
    },
  });

  res.json({ success: true, data: item });
});

// DELETE /inventory/:id
inventoryRouter.delete('/:id', requireRole(UserRole.ADMIN, UserRole.MANAGER), async (req: AuthRequest, res: Response) => {
  await prisma.inventoryItem.delete({ where: { id: req.params.id } });

  res.json({ success: true, message: 'Inventory item deleted' });
});

// POST /inventory/from-line - Create inventory from line item
inventoryRouter.post('/from-line', async (req: AuthRequest, res: Response) => {
  const { lineItemId, quantity, status } = req.body as {
    lineItemId: string;
    quantity: number;
    status?: string;
  };

  const lineItem = await prisma.lineItem.findUnique({
    where: { id: lineItemId },
    include: { order: true },
  });

  if (!lineItem) throw NotFoundError('Line item not found');
  if (!lineItem.itemMasterId) throw NotFoundError('Line item has no linked item master');

  const item = await prisma.inventoryItem.create({
    data: {
      itemMasterId: lineItem.itemMasterId,
      quantity,
      status: (status as never) ?? 'RESERVED',
      linkedOrderId: lineItem.orderId,
      linkedLineItemId: lineItemId,
    },
    include: {
      itemMaster: { select: { sku: true, name: true } },
    },
  });

  res.status(201).json({ success: true, data: item });
});
