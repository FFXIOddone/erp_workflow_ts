import { Router, type Response } from 'express';
import { prisma } from '../db/client.js';
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../middleware/error-handler.js';
import {
  CreateCustomerSchema,
  UpdateCustomerSchema,
  CustomerFilterSchema,
  CreateCustomerContactSchema,
  UserRole,
} from '@erp/shared';

export const customersRouter = Router();

// Apply authentication to all routes
customersRouter.use(authenticate);

// GET /customers - List all customers with filtering
customersRouter.get('/', async (req: AuthRequest, res: Response) => {
  const filters = CustomerFilterSchema.parse(req.query);
  const { page, pageSize, search, isActive, sortBy, sortOrder } = filters;

  const where: Record<string, unknown> = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { companyName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (isActive !== undefined) {
    where.isActive = isActive;
  }

  const [items, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      include: {
        contacts: true,
        _count: {
          select: { quotes: true, workOrders: true },
        },
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.customer.count({ where }),
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

// GET /customers/:id - Get customer by ID
customersRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      contacts: true,
      quotes: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      workOrders: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          orderNumber: true,
          customerName: true,
          description: true,
          status: true,
          priority: true,
          dueDate: true,
          createdAt: true,
        },
      },
      _count: {
        select: { quotes: true, workOrders: true },
      },
    },
  });

  if (!customer) {
    throw NotFoundError('Customer not found');
  }

  res.json({ success: true, data: customer });
});

// POST /customers - Create new customer
customersRouter.post('/', async (req: AuthRequest, res: Response) => {
  const data = CreateCustomerSchema.parse(req.body);
  const { contacts, ...customerData } = data;

  const contactsData = contacts?.map(c => ({
    name: c.name,
    email: c.email ?? null,
    phone: c.phone ?? null,
    title: c.title ?? null,
    isPrimary: c.isPrimary,
    notes: c.notes ?? null,
  }));

  // Build create data explicitly to avoid undefined spreading
  const createData: Record<string, unknown> = {
    name: customerData.name,
    taxExempt: customerData.taxExempt,
  };
  if (customerData.companyName !== undefined) createData.companyName = customerData.companyName;
  if (customerData.email !== undefined) createData.email = customerData.email;
  if (customerData.phone !== undefined) createData.phone = customerData.phone;
  if (customerData.address !== undefined) createData.address = customerData.address;
  if (customerData.city !== undefined) createData.city = customerData.city;
  if (customerData.state !== undefined) createData.state = customerData.state;
  if (customerData.zipCode !== undefined) createData.zipCode = customerData.zipCode;
  if (customerData.notes !== undefined) createData.notes = customerData.notes;
  if (customerData.paymentTerms !== undefined) createData.paymentTerms = customerData.paymentTerms;
  if (customerData.creditLimit !== undefined) createData.creditLimit = customerData.creditLimit;
  if (contactsData) createData.contacts = { create: contactsData };

  const customer = await prisma.customer.create({
    data: createData as Parameters<typeof prisma.customer.create>[0]['data'],
    include: {
      contacts: true,
    },
  });

  res.status(201).json({ success: true, data: customer });
});

// PATCH /customers/:id - Update customer
customersRouter.patch('/:id', async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const data = UpdateCustomerSchema.parse(req.body);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { contacts, ...customerData } = data;

  const existing = await prisma.customer.findUnique({
    where: { id },
  });

  if (!existing) {
    throw NotFoundError('Customer not found');
  }

  // Build update object with only defined fields
  const updateData: Record<string, unknown> = {};
  Object.entries(customerData).forEach(([key, value]) => {
    if (value !== undefined) {
      updateData[key] = value;
    }
  });

  const customer = await prisma.customer.update({
    where: { id },
    data: updateData,
    include: {
      contacts: true,
    },
  });

  res.json({ success: true, data: customer });
});

// DELETE /customers/:id - Soft delete customer (set inactive)
customersRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  if (req.user?.role !== UserRole.ADMIN && req.user?.role !== UserRole.MANAGER) {
    throw ForbiddenError('Only admins and managers can delete customers');
  }

  const customer = await prisma.customer.update({
    where: { id },
    data: { isActive: false },
  });

  res.json({ success: true, data: customer });
});

// ============ Contact Routes ============

// POST /customers/:id/contacts - Add contact to customer
customersRouter.post('/:id/contacts', async (req: AuthRequest, res: Response) => {
  const customerId = req.params.id as string;
  const data = CreateCustomerContactSchema.parse(req.body);

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
  });

  if (!customer) {
    throw NotFoundError('Customer not found');
  }

  // If this contact is primary, unset other primary contacts
  if (data.isPrimary) {
    await prisma.customerContact.updateMany({
      where: { customerId },
      data: { isPrimary: false },
    });
  }

  const contact = await prisma.customerContact.create({
    data: {
      name: data.name,
      email: data.email ?? null,
      phone: data.phone ?? null,
      title: data.title ?? null,
      isPrimary: data.isPrimary,
      notes: data.notes ?? null,
      customerId,
    },
  });

  res.status(201).json({ success: true, data: contact });
});

// PATCH /customers/:customerId/contacts/:contactId - Update contact
customersRouter.patch('/:customerId/contacts/:contactId', async (req: AuthRequest, res: Response) => {
  const customerId = req.params.customerId as string;
  const contactId = req.params.contactId as string;
  const data = CreateCustomerContactSchema.partial().parse(req.body);

  const contact = await prisma.customerContact.findFirst({
    where: {
      id: contactId,
      customerId,
    },
  });

  if (!contact) {
    throw NotFoundError('Contact not found');
  }

  // If setting as primary, unset other primary contacts
  if (data.isPrimary) {
    await prisma.customerContact.updateMany({
      where: { customerId },
      data: { isPrimary: false },
    });
  }

  // Build update object with only defined fields
  const updateData: Record<string, unknown> = {};
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined) {
      updateData[key] = value;
    }
  });

  const updated = await prisma.customerContact.update({
    where: { id: contactId },
    data: updateData,
  });

  res.json({ success: true, data: updated });
});

// DELETE /customers/:customerId/contacts/:contactId - Delete contact
customersRouter.delete('/:customerId/contacts/:contactId', async (req: AuthRequest, res: Response) => {
  const customerId = req.params.customerId as string;
  const contactId = req.params.contactId as string;

  const contact = await prisma.customerContact.findFirst({
    where: {
      id: contactId,
      customerId,
    },
  });

  if (!contact) {
    throw NotFoundError('Contact not found');
  }

  await prisma.customerContact.delete({
    where: { id: contactId },
  });

  res.json({ success: true, message: 'Contact deleted' });
});

// ============ Portal Invite Management ============

// POST /customers/:id/portal-invites - Create a portal invite for a customer
customersRouter.post('/:id/portal-invites', requireRole(UserRole.ADMIN, UserRole.MANAGER), async (req: AuthRequest, res: Response) => {
  const customerId = req.params.id as string;
  const { email, expiresInDays } = req.body || {};

  // Verify customer exists
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) {
    throw NotFoundError('Customer not found');
  }

  const days = Math.min(Math.max(parseInt(expiresInDays, 10) || 7, 1), 30); // 1-30 days
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  const invite = await prisma.portalInvite.create({
    data: {
      customerId,
      email: email?.toLowerCase() || null,
      createdById: req.userId!,
      expiresAt,
    },
  });

  const portalUrl = process.env.PORTAL_URL || process.env.CORS_ORIGIN?.split(',')[0] || 'http://localhost:5174';
  const registrationLink = `${portalUrl}/register?invite=${invite.token}`;

  res.status(201).json({
    success: true,
    data: {
      id: invite.id,
      token: invite.token,
      email: invite.email,
      expiresAt: invite.expiresAt,
      registrationLink,
    },
  });
});

// GET /customers/:id/portal-invites - List invites for a customer
customersRouter.get('/:id/portal-invites', async (req: AuthRequest, res: Response) => {
  const customerId = req.params.id as string;

  const invites = await prisma.portalInvite.findMany({
    where: { customerId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      token: true,
      email: true,
      expiresAt: true,
      usedAt: true,
      usedByEmail: true,
      createdAt: true,
      createdBy: { select: { displayName: true } },
    },
  });

  res.json({ success: true, data: invites });
});

// DELETE /customers/:id/portal-invites/:inviteId - Revoke an invite
customersRouter.delete('/:id/portal-invites/:inviteId', requireRole(UserRole.ADMIN, UserRole.MANAGER), async (req: AuthRequest, res: Response) => {
  const { id: customerId, inviteId } = req.params;

  const invite = await prisma.portalInvite.findFirst({
    where: { id: inviteId, customerId },
  });

  if (!invite) {
    throw NotFoundError('Invite not found');
  }

  if (invite.usedAt) {
    throw BadRequestError('Cannot revoke an invite that has already been used');
  }

  await prisma.portalInvite.delete({ where: { id: inviteId } });

  res.json({ success: true, message: 'Invite revoked' });
});
