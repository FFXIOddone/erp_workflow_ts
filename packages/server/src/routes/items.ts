import { Router, type Response } from 'express';
import { z } from 'zod';
import {
  CreateItemMasterSchema,
  UpdateItemMasterSchema,
  UserRole,
} from '@erp/shared';
import { prisma } from '../db/client.js';
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth.js';
import { NotFoundError } from '../middleware/error-handler.js';
import { buildTokenizedSearchWhere } from '../lib/fuzzy-search.js';

// Items are a catalog lookup — allow larger page sizes than the default PaginationSchema (500)
const ItemPaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(5000).default(20),
});

export const itemsRouter = Router();

itemsRouter.use(authenticate);

// GET /items - List items
// Optional: ?companyId=<uuid> filters to items previously ordered by that company
itemsRouter.get('/', async (req: AuthRequest, res: Response) => {
  const { page, pageSize } = ItemPaginationSchema.parse(req.query);
  const search = req.query.search as string | undefined;
  const category = req.query.category as string | undefined;
  const activeOnly = req.query.activeOnly !== 'false';
  const companyId = req.query.companyId as string | undefined;

  const where: Record<string, unknown> = {};
  if (activeOnly) where.isActive = true;
  if (category) where.category = category;
  if (search) {
    const searchWhere = buildTokenizedSearchWhere(search, ['sku', 'name', 'description']);
    if (searchWhere) {
      Object.assign(where, searchWhere);
    }
  }

  // Restrict to items that have been used on orders belonging to this company
  if (companyId) {
    where.lineItems = {
      some: {
        order: { companyId },
      },
    };
  }

  const [items, total] = await Promise.all([
    prisma.itemMaster.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.itemMaster.count({ where }),
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

// GET /items/categories - List unique categories
itemsRouter.get('/categories', async (_req: AuthRequest, res: Response) => {
  const categories = await prisma.itemMaster.findMany({
    where: { category: { not: null } },
    select: { category: true },
    distinct: ['category'],
    orderBy: { category: 'asc' },
  });

  res.json({
    success: true,
    data: categories.map((c) => c.category).filter(Boolean),
  });
});

// GET /items/:id
itemsRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  const item = await prisma.itemMaster.findUnique({
    where: { id: req.params.id },
  });

  if (!item) throw NotFoundError('Item not found');

  res.json({ success: true, data: item });
});

// GET /items/:id/history - Get order history for this item
itemsRouter.get('/:id/history', async (req: AuthRequest, res: Response) => {
  const { page, pageSize } = ItemPaginationSchema.parse(req.query);
  
  const item = await prisma.itemMaster.findUnique({
    where: { id: req.params.id },
  });

  if (!item) throw NotFoundError('Item not found');

  // Find all orders that have line items with this item master
  const [lineItems, total] = await Promise.all([
    prisma.lineItem.findMany({
      where: { itemMasterId: req.params.id },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            customerName: true,
            status: true,
            dueDate: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.lineItem.count({ where: { itemMasterId: req.params.id } }),
  ]);

  // Get inventory items linked to this item master
  const inventoryItems = await prisma.inventoryItem.findMany({
    where: { itemMasterId: req.params.id },
    include: {
      linkedOrder: {
        select: { id: true, orderNumber: true, customerName: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({
    success: true,
    data: {
      item,
      orderHistory: lineItems.map(li => ({
        lineItemId: li.id,
        quantity: li.quantity,
        order: li.order,
        createdAt: li.createdAt,
      })),
      inventoryItems,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  });
});

// POST /items - Create item (admin/manager only)
itemsRouter.post('/', requireRole(UserRole.ADMIN, UserRole.MANAGER), async (req: AuthRequest, res: Response) => {
  const data = CreateItemMasterSchema.parse(req.body);

  const item = await prisma.itemMaster.create({
    data: {
      ...data,
      createdById: req.userId,
      updatedById: req.userId,
    },
  });

  res.status(201).json({ success: true, data: item });
});

// PATCH /items/:id
itemsRouter.patch('/:id', requireRole(UserRole.ADMIN, UserRole.MANAGER), async (req: AuthRequest, res: Response) => {
  const data = UpdateItemMasterSchema.parse(req.body);

  const item = await prisma.itemMaster.update({
    where: { id: req.params.id },
    data: {
      ...data,
      updatedById: req.userId,
    },
  });

  res.json({ success: true, data: item });
});

// DELETE /items/:id
itemsRouter.delete('/:id', requireRole(UserRole.ADMIN), async (req: AuthRequest, res: Response) => {
  await prisma.itemMaster.delete({ where: { id: req.params.id } });

  res.json({ success: true, message: 'Item deleted' });
});
