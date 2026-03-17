import { Router, type Response } from 'express';
import {
  CreateOrderTemplateSchema,
  UpdateOrderTemplateSchema,
  PaginationSchema,
  UserRole,
} from '@erp/shared';
import { prisma } from '../db/client.js';
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth.js';
import { NotFoundError } from '../middleware/error-handler.js';

export const templatesRouter = Router();

templatesRouter.use(authenticate);

// GET /templates - List templates
templatesRouter.get('/', async (req: AuthRequest, res: Response) => {
  const { page, pageSize } = PaginationSchema.parse(req.query);

  const [templates, total] = await Promise.all([
    prisma.orderTemplate.findMany({
      include: {
        lineItemTemplates: true,
        createdBy: { select: { displayName: true } },
      },
      orderBy: { name: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.orderTemplate.count(),
  ]);

  res.json({
    success: true,
    data: {
      items: templates,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  });
});

// GET /templates/:id
templatesRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  const template = await prisma.orderTemplate.findUnique({
    where: { id: req.params.id },
    include: {
      lineItemTemplates: true,
      createdBy: { select: { displayName: true } },
    },
  });

  if (!template) throw NotFoundError('Template not found');

  res.json({ success: true, data: template });
});

// POST /templates - Create template
templatesRouter.post('/', requireRole(UserRole.ADMIN, UserRole.MANAGER), async (req: AuthRequest, res: Response) => {
  const data = CreateOrderTemplateSchema.parse(req.body);
  const userId = req.userId!;

  const template = await prisma.orderTemplate.create({
    data: {
      name: data.name,
      description: data.description,
      customerName: data.customerName,
      defaultRouting: data.defaultRouting,
      createdById: userId,
      lineItemTemplates: {
        create: data.lineItemTemplates,
      },
    },
    include: {
      lineItemTemplates: true,
    },
  });

  res.status(201).json({ success: true, data: template });
});

// PATCH /templates/:id
templatesRouter.patch('/:id', requireRole(UserRole.ADMIN, UserRole.MANAGER), async (req: AuthRequest, res: Response) => {
  const data = UpdateOrderTemplateSchema.parse(req.body);

  // If line items are being updated, delete and recreate
  if (data.lineItemTemplates) {
    await prisma.lineItemTemplate.deleteMany({
      where: { templateId: req.params.id },
    });
  }

  const template = await prisma.orderTemplate.update({
    where: { id: req.params.id },
    data: {
      name: data.name,
      description: data.description,
      customerName: data.customerName,
      defaultRouting: data.defaultRouting,
      lineItemTemplates: data.lineItemTemplates
        ? { create: data.lineItemTemplates }
        : undefined,
    },
    include: {
      lineItemTemplates: true,
    },
  });

  res.json({ success: true, data: template });
});

// DELETE /templates/:id
templatesRouter.delete('/:id', requireRole(UserRole.ADMIN), async (req: AuthRequest, res: Response) => {
  await prisma.orderTemplate.delete({ where: { id: req.params.id } });

  res.json({ success: true, message: 'Template deleted' });
});

// POST /templates/:id/create-order - Create order from template
templatesRouter.post('/:id/create-order', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { orderNumber, customerName } = req.body as {
    orderNumber: string;
    customerName?: string;
  };

  const template = await prisma.orderTemplate.findUnique({
    where: { id: req.params.id },
    include: { lineItemTemplates: true },
  });

  if (!template) throw NotFoundError('Template not found');

  const order = await prisma.workOrder.create({
    data: {
      orderNumber,
      customerName: customerName ?? template.customerName ?? 'Customer',
      description: `Created from template: ${template.name}`,
      routing: template.defaultRouting,
      createdById: userId,
      lineItems: {
        create: template.lineItemTemplates.map((item, idx) => ({
          itemNumber: idx + 1,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          itemMasterId: item.itemMasterId,
        })),
      },
      stationProgress: {
        create: template.defaultRouting.map((station) => ({
          station,
          status: 'NOT_STARTED',
        })),
      },
      events: {
        create: {
          eventType: 'CREATED',
          description: `Work order created from template: ${template.name}`,
          userId,
        },
      },
    },
    include: {
      lineItems: true,
      stationProgress: true,
    },
  });

  res.status(201).json({ success: true, data: order });
});
