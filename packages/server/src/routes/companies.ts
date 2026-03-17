import { Router, type Response } from 'express';
import { prisma } from '../db/client.js';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../middleware/error-handler.js';
import { UserRole } from '@erp/shared';
import { z } from 'zod';

export const companiesRouter = Router();

// Apply authentication to all routes
companiesRouter.use(authenticate);

// Schema for company filters
const CompanyFilterSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
  search: z.string().optional(),
  isActive: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  companyType: z.string().optional(),
  salesRep: z.string().optional(),
  hasChildren: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

// Schema for creating a company
const CreateCompanySchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  legalName: z.string().optional(),
  dba: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().default('USA'),
  phone: z.string().optional(),
  fax: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  website: z.string().optional(),
  taxExempt: z.boolean().default(false),
  resaleNumber: z.string().optional(),
  creditLimit: z.number().optional(),
  paymentTerms: z.string().optional(),
  companyType: z.string().optional(),
  industry: z.string().optional(),
  salesRep: z.string().optional(),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
});

// Schema for updating a company
const UpdateCompanySchema = CreateCompanySchema.partial();

// Schema for creating a contact
const CreateContactSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  salutation: z.string().optional(),
  middleInitial: z.string().optional(),
  title: z.string().optional(),
  role: z.enum(['PRIMARY', 'BILLING', 'SHIPPING', 'TECHNICAL', 'APPROVAL', 'EXECUTIVE', 'PROJECT_MANAGER', 'PURCHASING', 'SALES', 'SUPPORT', 'OTHER']).default('PRIMARY'),
  isPrimary: z.boolean().default(false),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  notes: z.string().optional(),
});

// GET /companies - List all companies with filtering
companiesRouter.get('/', async (req: AuthRequest, res: Response) => {
  const filters = CompanyFilterSchema.parse(req.query);
  const { page, pageSize, search, isActive, companyType, salesRep, hasChildren, sortBy, sortOrder } = filters;

  const where: Record<string, unknown> = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { legalName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
      { city: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (isActive !== undefined) {
    where.isActive = isActive;
  }

  if (companyType) {
    where.companyType = companyType;
  }

  if (salesRep) {
    where.salesRep = salesRep;
  }

  // Filter for parent companies only (has child relationships)
  if (hasChildren === true) {
    where.childRelationships = {
      some: {},
    };
  }

  const [items, total] = await Promise.all([
    prisma.company.findMany({
      where,
      include: {
        contacts: {
          where: { isPrimary: true },
          take: 1,
        },
        _count: {
          select: { 
            quotes: true, 
            workOrders: true,
            contacts: true,
            childRelationships: true,
          },
        },
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.company.count({ where }),
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

// GET /companies/types - Get list of company types for filtering
companiesRouter.get('/types', async (_req: AuthRequest, res: Response) => {
  const types = await prisma.company.groupBy({
    by: ['companyType'],
    where: { companyType: { not: null } },
    _count: true,
  });

  res.json({
    success: true,
    data: types.filter(t => t.companyType).map(t => ({
      type: t.companyType,
      count: t._count,
    })),
  });
});

// GET /companies/sales-reps - Get list of sales reps for filtering
companiesRouter.get('/sales-reps', async (_req: AuthRequest, res: Response) => {
  const reps = await prisma.company.groupBy({
    by: ['salesRep'],
    where: { salesRep: { not: null } },
    _count: true,
  });

  res.json({
    success: true,
    data: reps.filter(r => r.salesRep).map(r => ({
      salesRep: r.salesRep,
      count: r._count,
    })),
  });
});

// GET /companies/:id - Get company by ID
companiesRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  
  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      contacts: {
        orderBy: [{ isPrimary: 'desc' }, { lastName: 'asc' }],
      },
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
      // Get child companies (locations/franchises)
      childRelationships: {
        include: {
          childCompany: {
            select: {
              id: true,
              name: true,
              city: true,
              state: true,
              _count: { select: { workOrders: true } },
            },
          },
        },
      },
      // Get parent company if exists
      parentRelationships: {
        include: {
          parentCompany: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      _count: {
        select: { quotes: true, workOrders: true, contacts: true },
      },
    },
  });

  if (!company) {
    throw NotFoundError('Company not found');
  }

  res.json({ success: true, data: company });
});

// POST /companies - Create new company
companiesRouter.post('/', async (req: AuthRequest, res: Response) => {
  const data = CreateCompanySchema.parse(req.body);

  const company = await prisma.company.create({
    data: {
      ...data,
      email: data.email || null,
      creditLimit: data.creditLimit ? data.creditLimit : null,
    },
    include: {
      contacts: true,
      _count: { select: { workOrders: true, quotes: true } },
    },
  });

  res.status(201).json({ success: true, data: company });
});

// PATCH /companies/:id - Update company
companiesRouter.patch('/:id', async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const data = UpdateCompanySchema.parse(req.body);

  const existing = await prisma.company.findUnique({ where: { id } });
  if (!existing) {
    throw NotFoundError('Company not found');
  }

  const company = await prisma.company.update({
    where: { id },
    data: {
      ...data,
      email: data.email || null,
    },
    include: {
      contacts: true,
      _count: { select: { workOrders: true, quotes: true } },
    },
  });

  res.json({ success: true, data: company });
});

// DELETE /companies/:id - Delete company
companiesRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const user = req.user!;

  // Only admins can delete
  if (user.role !== UserRole.ADMIN) {
    throw ForbiddenError('Only admins can delete companies');
  }

  const existing = await prisma.company.findUnique({
    where: { id },
    include: {
      _count: { select: { workOrders: true, quotes: true } },
    },
  });

  if (!existing) {
    throw NotFoundError('Company not found');
  }

  // Prevent deletion if company has orders
  if (existing._count.workOrders > 0 || existing._count.quotes > 0) {
    throw BadRequestError('Cannot delete company with existing orders or quotes. Deactivate instead.');
  }

  await prisma.company.delete({ where: { id } });

  res.json({ success: true, message: 'Company deleted' });
});

// ============ Contact endpoints ============

// GET /companies/:id/contacts - Get all contacts for a company
companiesRouter.get('/:id/contacts', async (req: AuthRequest, res: Response) => {
  const companyId = req.params.id as string;

  const contacts = await prisma.contact.findMany({
    where: { companyId },
    orderBy: [{ isPrimary: 'desc' }, { lastName: 'asc' }],
  });

  res.json({ success: true, data: contacts });
});

// POST /companies/:id/contacts - Add contact to company
companiesRouter.post('/:id/contacts', async (req: AuthRequest, res: Response) => {
  const companyId = req.params.id as string;
  const data = CreateContactSchema.parse(req.body);

  // Check company exists
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) {
    throw NotFoundError('Company not found');
  }

  // If this is primary, unset other primaries
  if (data.isPrimary) {
    await prisma.contact.updateMany({
      where: { companyId, isPrimary: true },
      data: { isPrimary: false },
    });
  }

  const contact = await prisma.contact.create({
    data: {
      ...data,
      email: data.email || null,
      companyId,
    },
  });

  res.status(201).json({ success: true, data: contact });
});

// PATCH /companies/:companyId/contacts/:contactId - Update contact
companiesRouter.patch('/:companyId/contacts/:contactId', async (req: AuthRequest, res: Response) => {
  const { companyId, contactId } = req.params;
  const data = CreateContactSchema.partial().parse(req.body);

  const existing = await prisma.contact.findFirst({
    where: { id: contactId, companyId },
  });

  if (!existing) {
    throw NotFoundError('Contact not found');
  }

  // If setting as primary, unset other primaries
  if (data.isPrimary) {
    await prisma.contact.updateMany({
      where: { companyId, isPrimary: true, id: { not: contactId } },
      data: { isPrimary: false },
    });
  }

  const contact = await prisma.contact.update({
    where: { id: contactId },
    data: {
      ...data,
      email: data.email || null,
    },
  });

  res.json({ success: true, data: contact });
});

// DELETE /companies/:companyId/contacts/:contactId - Delete contact
companiesRouter.delete('/:companyId/contacts/:contactId', async (req: AuthRequest, res: Response) => {
  const { companyId, contactId } = req.params;

  const existing = await prisma.contact.findFirst({
    where: { id: contactId, companyId },
  });

  if (!existing) {
    throw NotFoundError('Contact not found');
  }

  await prisma.contact.delete({ where: { id: contactId } });

  res.json({ success: true, message: 'Contact deleted' });
});

// ============ Hierarchy endpoints ============

// GET /companies/:id/locations - Get child companies (locations/franchises)
companiesRouter.get('/:id/locations', async (req: AuthRequest, res: Response) => {
  const companyId = req.params.id as string;

  const locations = await prisma.companyHierarchy.findMany({
    where: { parentCompanyId: companyId },
    include: {
      childCompany: {
        include: {
          _count: { select: { workOrders: true, contacts: true } },
        },
      },
    },
    orderBy: { childCompany: { name: 'asc' } },
  });

  res.json({
    success: true,
    data: locations.map((l) => ({
      ...l.childCompany,
      relationType: l.relationType,
      inheritBilling: l.inheritBilling,
      inheritPricing: l.inheritPricing,
    })),
  });
});

// POST /companies/:id/locations - Add child company (location)
companiesRouter.post('/:id/locations', async (req: AuthRequest, res: Response) => {
  const parentId = req.params.id as string;
  const { childId, relationType = 'FRANCHISE' } = req.body;

  // Verify both companies exist
  const [parent, child] = await Promise.all([
    prisma.company.findUnique({ where: { id: parentId } }),
    prisma.company.findUnique({ where: { id: childId } }),
  ]);

  if (!parent) throw NotFoundError('Parent company not found');
  if (!child) throw NotFoundError('Child company not found');

  // Check if relationship already exists
  const existing = await prisma.companyHierarchy.findUnique({
    where: {
      parentCompanyId_childCompanyId: {
        parentCompanyId: parentId,
        childCompanyId: childId,
      },
    },
  });

  if (existing) {
    throw BadRequestError('This relationship already exists');
  }

  const hierarchy = await prisma.companyHierarchy.create({
    data: {
      parentCompanyId: parentId,
      childCompanyId: childId,
      relationType,
    },
    include: {
      childCompany: true,
    },
  });

  res.status(201).json({ success: true, data: hierarchy });
});

// DELETE /companies/:parentId/locations/:childId - Remove child company
companiesRouter.delete('/:parentId/locations/:childId', async (req: AuthRequest, res: Response) => {
  const { parentId, childId } = req.params;

  const existing = await prisma.companyHierarchy.findUnique({
    where: {
      parentCompanyId_childCompanyId: {
        parentCompanyId: parentId,
        childCompanyId: childId,
      },
    },
  });

  if (!existing) {
    throw NotFoundError('Relationship not found');
  }

  await prisma.companyHierarchy.delete({
    where: { id: existing.id },
  });

  res.json({ success: true, message: 'Location removed from company' });
});
