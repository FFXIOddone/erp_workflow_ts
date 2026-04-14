import { Router, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth.js';
import { UserRole } from '@erp/shared';
import os from 'os';

export const settingsRouter = Router();

// All routes require authentication
settingsRouter.use(authenticate);

// Schema for updating settings
const UpdateSettingsSchema = z.object({
  // Company Information
  companyName: z.string().min(1).optional(),
  companyLogo: z.string().nullable().optional(),
  companyAddress: z.string().nullable().optional(),
  companyCity: z.string().nullable().optional(),
  companyState: z.string().nullable().optional(),
  companyZip: z.string().nullable().optional(),
  companyPhone: z.string().nullable().optional(),
  companyEmail: z.string().email().nullable().optional(),
  companyWebsite: z.string().url().nullable().optional(),
  
  // Default Values
  defaultPriority: z.number().int().min(1).max(5).optional(),
  defaultPaymentTerms: z.string().optional(),
  orderNumberPrefix: z.string().optional(),
  quoteNumberPrefix: z.string().optional(),
  autoAssignOrders: z.boolean().optional(),
  
  // Email Settings
  emailFromName: z.string().optional(),
  emailFromAddress: z.string().email().nullable().optional(),
  emailSignature: z.string().nullable().optional(),
  sendOrderCreatedEmail: z.boolean().optional(),
  sendOrderStatusEmail: z.boolean().optional(),
  sendOrderAssignedEmail: z.boolean().optional(),
  sendQuoteEmail: z.boolean().optional(),
  
  // Notification Settings
  notifyOnNewOrder: z.boolean().optional(),
  notifyOnOrderDueSoon: z.boolean().optional(),
  dueSoonDays: z.number().int().min(1).max(30).optional(),
  notifyOnOverdue: z.boolean().optional(),
  
  // Business Hours
  businessHoursStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  businessHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  workDays: z.array(z.number().int().min(0).max(6)).optional(),
  
  // Feature Flags
  enableTimeTracking: z.boolean().optional(),
  enableInventory: z.boolean().optional(),
  enableQuotes: z.boolean().optional(),
  enableCustomers: z.boolean().optional(),
  enableReprints: z.boolean().optional(),
  enableScheduling: z.boolean().optional(),
  
  // Brand Display Names (customizable labels for company brands)
  brandDisplayNames: z.record(z.string(), z.string()).optional(),

  // Production List Settings
  productionListPath: z.string().nullable().optional(),
  enableProductionListSync: z.boolean().optional(),
  fieryWorkflowName: z.string().nullable().optional(),

  // Network Drive
  networkDriveBasePath: z.string().nullable().optional(),
});

// GET /settings - Get current settings
settingsRouter.get('/', async (req: AuthRequest, res: Response) => {
  // Get or create default settings
  let settings = await prisma.systemSettings.findFirst({
    where: { id: 'system' },
  });

  if (!settings) {
    settings = await prisma.systemSettings.create({
      data: { id: 'system' },
    });
  }

  res.json({
    success: true,
    data: settings,
  });
});

// GET /settings/public - Get public settings (no auth required for some settings)
settingsRouter.get('/public', async (_req: AuthRequest, res: Response) => {
  let settings = await prisma.systemSettings.findFirst({
    where: { id: 'system' },
  });

  if (!settings) {
    settings = await prisma.systemSettings.create({
      data: { id: 'system' },
    });
  }

  // Return only public-facing settings
  res.json({
    success: true,
    data: {
      companyName: settings.companyName,
      companyLogo: settings.companyLogo,
      brandDisplayNames: settings.brandDisplayNames ?? {
        WILDE_SIGNS: 'Wilde Signs',
        PORT_CITY_SIGNS: 'Port City Signs',
      },
      enableTimeTracking: settings.enableTimeTracking,
      enableInventory: settings.enableInventory,
      enableQuotes: settings.enableQuotes,
      enableCustomers: settings.enableCustomers,
      enableReprints: settings.enableReprints,
      enableScheduling: settings.enableScheduling,
    },
  });
});

// PATCH /settings - Update settings (Admin only)
settingsRouter.patch(
  '/',
  requireRole(UserRole.ADMIN),
  async (req: AuthRequest, res: Response) => {
    const updates = UpdateSettingsSchema.parse(req.body);

    // Get current settings for audit
    const currentSettings = await prisma.systemSettings.findFirst({
      where: { id: 'system' },
    });

    // Update settings
    const settings = await prisma.systemSettings.upsert({
      where: { id: 'system' },
      update: {
        ...updates,
        updatedAt: new Date(),
      },
      create: {
        id: 'system',
        ...updates,
      },
    });

    // Create audit entries for changed fields
    if (currentSettings) {
      const auditEntries = Object.entries(updates)
        .filter(([key, value]) => {
          const currentValue = (currentSettings as Record<string, unknown>)[key];
          return JSON.stringify(value) !== JSON.stringify(currentValue);
        })
        .map(([field, newValue]) => ({
          field,
          oldValue: JSON.stringify((currentSettings as Record<string, unknown>)[field]),
          newValue: JSON.stringify(newValue),
          changedById: req.user!.id,
        }));

      if (auditEntries.length > 0) {
        await prisma.settingsAudit.createMany({
          data: auditEntries,
        });
      }
    }

    res.json({
      success: true,
      data: settings,
    });
  }
);

// GET /settings/audit - Get settings change history (Admin only)
settingsRouter.get(
  '/audit',
  requireRole(UserRole.ADMIN),
  async (req: AuthRequest, res: Response) => {
    const { page = 1, pageSize = 50 } = req.query;
    const skip = (Number(page) - 1) * Number(pageSize);

    const [audits, total] = await Promise.all([
      prisma.settingsAudit.findMany({
        orderBy: { changedAt: 'desc' },
        skip,
        take: Number(pageSize),
      }),
      prisma.settingsAudit.count(),
    ]);

    res.json({
      success: true,
      data: {
        items: audits,
        total,
        page: Number(page),
        pageSize: Number(pageSize),
        totalPages: Math.ceil(total / Number(pageSize)),
      },
    });
  }
);

// GET /settings/system-info - Get system information (Admin only)
settingsRouter.get(
  '/system-info',
  requireRole(UserRole.ADMIN),
  async (_req: AuthRequest, res: Response) => {
    // Get database stats
    const [
      userCount,
      orderCount,
      customerCount,
      quoteCount,
      inventoryCount,
      templateCount,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.workOrder.count(),
      prisma.customer.count(),
      prisma.quote.count(),
      prisma.inventoryItem.count(),
      prisma.orderTemplate.count(),
    ]);

    // Get order stats by status
    const ordersByStatus = await prisma.workOrder.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    // System info
    const systemInfo = {
      version: '1.0.0',
      nodeVersion: process.version,
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
    };

    // Database stats
    const databaseStats = {
      users: userCount,
      orders: orderCount,
      customers: customerCount,
      quotes: quoteCount,
      inventoryItems: inventoryCount,
      templates: templateCount,
      ordersByStatus: ordersByStatus.reduce(
        (acc, item) => {
          acc[item.status] = item._count.id;
          return acc;
        },
        {} as Record<string, number>
      ),
    };

    res.json({
      success: true,
      data: {
        system: systemInfo,
        database: databaseStats,
        timestamp: new Date().toISOString(),
      },
    });
  }
);

// POST /settings/test-email - Send a test email (Admin only)
settingsRouter.post(
  '/test-email',
  requireRole(UserRole.ADMIN),
  async (req: AuthRequest, res: Response) => {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);

    // For now, just log - in a real implementation, this would send an email
    console.log(`[Settings] Test email requested to: ${email}`);

    res.json({
      success: true,
      message: `Test email would be sent to ${email}`,
    });
  }
);

// POST /settings/reset - Reset settings to defaults (Admin only)
settingsRouter.post(
  '/reset',
  requireRole(UserRole.ADMIN),
  async (req: AuthRequest, res: Response) => {
    // Delete current settings
    await prisma.systemSettings.deleteMany({
      where: { id: 'system' },
    });

    // Create new default settings
    const settings = await prisma.systemSettings.create({
      data: { id: 'system' },
    });

    // Log the reset
    await prisma.settingsAudit.create({
      data: {
        field: 'ALL',
        oldValue: 'Previous settings',
        newValue: 'Reset to defaults',
        changedById: req.user!.id,
      },
    });

    res.json({
      success: true,
      data: settings,
      message: 'Settings reset to defaults',
    });
  }
);

// GET /settings/export - Export all data (Admin only)
settingsRouter.get(
  '/export',
  requireRole(UserRole.ADMIN),
  async (_req: AuthRequest, res: Response) => {
    const [
      settings,
      users,
      customers,
      orders,
      quotes,
      templates,
      inventory,
    ] = await Promise.all([
      prisma.systemSettings.findFirst({ where: { id: 'system' } }),
      prisma.user.findMany({
        select: {
          id: true,
          username: true,
          displayName: true,
          email: true,
          role: true,
          isActive: true,
          allowedStations: true,
          createdAt: true,
        },
      }),
      prisma.customer.findMany(),
      prisma.workOrder.findMany({
        include: {
          lineItems: true,
          stationProgress: true,
        },
      }),
      prisma.quote.findMany({
        include: {
          lineItems: true,
        },
      }),
      prisma.orderTemplate.findMany({
        include: {
          lineItemTemplates: true,
        },
      }),
      prisma.inventoryItem.findMany(),
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
      settings,
      users,
      customers,
      orders,
      quotes,
      templates,
      inventory,
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="erp-export-${new Date().toISOString().split('T')[0]}.json"`
    );
    res.json(exportData);
  }
);
