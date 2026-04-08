import { Router } from 'express';
import { prisma } from '../db/client.js';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { z } from 'zod';

const router = Router();

router.use(authenticate);

const ListSubcontractorsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
  search: z.string().trim().optional(),
  isActive: z.enum(['true', 'false']).optional(),
});

router.get('/', async (req: AuthRequest, res) => {
  const parsed = ListSubcontractorsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(200).json({
      success: true,
      data: {
        items: [],
        pagination: {
          page: 1,
          pageSize: 25,
          total: 0,
          totalPages: 0,
        },
      },
      message: 'Invalid filters were ignored',
    });
  }

  try {
    const { page, pageSize, search, isActive } = parsed.data;
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {};

    if (search && search.length > 0) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
        { contactName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (typeof isActive === 'string') {
      where.isActive = isActive === 'true';
    }

    const [items, total] = await Promise.all([
      prisma.subcontractor.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      }),
      prisma.subcontractor.count({ where }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

    return res.json({
      success: true,
      data: {
        items,
        pagination: {
          page,
          pageSize,
          total,
          totalPages,
        },
      },
    });
  } catch (error) {
    console.error('[Subcontractors] list failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to load subcontractors',
    });
  }
});

export default router;
