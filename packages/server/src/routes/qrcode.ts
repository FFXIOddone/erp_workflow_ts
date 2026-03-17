import { Router, Response } from 'express';
import QRCode from 'qrcode';
import jwt from 'jsonwebtoken';
import prisma from '../db/client.js';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { NotFoundError, BadRequestError } from '../middleware/error-handler.js';
import { z } from 'zod';
import { PrintingMethod, StationStatus } from '@erp/shared';

const qrcodeRouter = Router();

// All routes require authentication
qrcodeRouter.use(authenticate);

// Schema for QR code generation options
const QROptionsSchema = z.object({
  size: z.coerce.number().min(100).max(1000).optional().default(300),
  format: z.enum(['png', 'svg', 'dataurl']).optional().default('dataurl'),
  margin: z.coerce.number().min(0).max(10).optional().default(2),
  color: z.string().optional().default('#000000'),
  background: z.string().optional().default('#ffffff'),
});

/**
 * Generate QR code data for a work order
 * The QR code contains a JSON payload with order info for scanning
 */
function generateOrderQRPayload(order: {
  id: string;
  orderNumber: string;
  customerName: string;
  customer?: { name: string; companyName?: string | null } | null;
  status: string;
}): string {
  return JSON.stringify({
    type: 'WORK_ORDER',
    id: order.id,
    orderNumber: order.orderNumber,
    customer: order.customer?.companyName || order.customer?.name || order.customerName,
    status: order.status,
    timestamp: new Date().toISOString(),
  });
}

// GET /qrcode/order/:id - Generate QR code for a specific work order
qrcodeRouter.get('/order/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const options = QROptionsSchema.parse(req.query);

  const order = await prisma.workOrder.findUnique({
    where: { id },
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      status: true,
      customer: {
        select: { name: true, companyName: true },
      },
    },
  });

  if (!order) {
    throw NotFoundError('Work order not found');
  }

  const payload = generateOrderQRPayload(order);

  const qrOptions: QRCode.QRCodeToDataURLOptions = {
    width: options.size,
    margin: options.margin,
    color: {
      dark: options.color,
      light: options.background,
    },
    errorCorrectionLevel: 'M',
  };

  if (options.format === 'svg') {
    const svg = await QRCode.toString(payload, { 
      type: 'svg', 
      width: options.size,
      margin: options.margin,
      errorCorrectionLevel: 'M',
    });
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(svg);
  } else if (options.format === 'png') {
    const buffer = await QRCode.toBuffer(payload, { 
      type: 'png',
      width: options.size,
      margin: options.margin,
      errorCorrectionLevel: 'M',
    });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `inline; filename="${order.orderNumber}-qr.png"`);
    res.send(buffer);
  } else {
    // dataurl format
    const dataUrl = await QRCode.toDataURL(payload, qrOptions);
    res.json({
      success: true,
      data: {
        qrCode: dataUrl,
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          customer: order.customer?.companyName || order.customer?.name || order.customerName,
          status: order.status,
        },
      },
    });
  }
});

// GET /qrcode/order/:id/label - Generate printable label with QR code
qrcodeRouter.get('/order/:id/label', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const size = parseInt(req.query.size as string) || 200;

  const order = await prisma.workOrder.findUnique({
    where: { id },
    include: {
      customer: {
        select: { name: true, companyName: true },
      },
    },
  });

  if (!order) {
    throw NotFoundError('Work order not found');
  }

  const payload = generateOrderQRPayload(order);

  const qrCode = await QRCode.toDataURL(payload, {
    width: size,
    margin: 1,
    errorCorrectionLevel: 'M',
  });

  // Return label data for frontend to render
  res.json({
    success: true,
    data: {
      qrCode,
      label: {
        orderNumber: order.orderNumber,
        customer: order.customer?.companyName || order.customer?.name || order.customerName,
        description: order.description?.substring(0, 50) || '',
        dueDate: order.dueDate?.toISOString().split('T')[0] || '',
        routing: order.routing || [],
      },
    },
  });
});

// POST /qrcode/scan - Parse a scanned QR code and return order info
qrcodeRouter.post('/scan', async (req: AuthRequest, res: Response) => {
  const { payload } = req.body;

  if (!payload || typeof payload !== 'string') {
    throw BadRequestError('Invalid QR code payload');
  }

  try {
    const data = JSON.parse(payload);

    if (data.type !== 'WORK_ORDER') {
      throw BadRequestError('Invalid QR code type');
    }

    // Look up the order
    const order = await prisma.workOrder.findUnique({
      where: { id: data.id },
      include: {
        customer: {
          select: { id: true, name: true, companyName: true },
        },
        stationProgress: true,
      },
    });

    if (!order) {
      throw NotFoundError('Work order not found');
    }

    res.json({
      success: true,
      data: {
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          customer: order.customer?.companyName || order.customer?.name || 'Unknown',
          customerId: order.customer?.id,
          status: order.status,
          priority: order.priority,
          dueDate: order.dueDate,
          routing: order.routing,
          stationProgress: order.stationProgress,
        },
      },
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw BadRequestError('Invalid QR code format');
    }
    throw error;
  }
});

// POST /qrcode/scan/station-checkin - Scan QR and check into station
qrcodeRouter.post('/scan/station-checkin', async (req: AuthRequest, res: Response) => {
  const { payload, station } = req.body;

  if (!payload || typeof payload !== 'string') {
    throw BadRequestError('Invalid QR code payload');
  }

  if (!station || typeof station !== 'string') {
    throw BadRequestError('Station is required');
  }

  try {
    const data = JSON.parse(payload);

    if (data.type !== 'WORK_ORDER') {
      throw BadRequestError('Invalid QR code type');
    }

    // Look up the order
    const order = await prisma.workOrder.findUnique({
      where: { id: data.id },
      include: {
        customer: { select: { name: true, companyName: true } },
        stationProgress: true,
      },
    });

    if (!order) {
      throw NotFoundError('Work order not found');
    }

    // Check if station is in routing
    const stationEnum = station as PrintingMethod;
    if (!order.routing.includes(stationEnum)) {
      throw BadRequestError(`Station ${station} is not in this order's routing`);
    }

    // Find station progress
    const stationProgressEntry = order.stationProgress.find(sp => sp.station === stationEnum);
    const isCompleted = stationProgressEntry?.status === StationStatus.COMPLETED;
    const completedAt = stationProgressEntry?.completedAt;

    // Get station index for progress tracking
    const stationIndex = order.routing.indexOf(stationEnum);
    const completedStations = order.stationProgress.filter(sp => sp.status === StationStatus.COMPLETED).length;
    const progressPercent = order.routing.length > 0
      ? Math.round((completedStations / order.routing.length) * 100)
      : 0;

    res.json({
      success: true,
      data: {
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          customer: order.customer?.companyName || order.customer?.name || 'Unknown',
          status: order.status,
          priority: order.priority,
          dueDate: order.dueDate,
        },
        station: {
          name: station,
          index: stationIndex,
          totalStations: order.routing.length,
          isCompleted,
          completedAt,
        },
        progress: {
          completedStations,
          totalStations: order.routing.length,
          progressPercent,
          routing: order.routing,
          stationProgress: order.stationProgress,
        },
      },
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw BadRequestError('Invalid QR code format');
    }
    throw error;
  }
});

// GET /qrcode/batch - Generate QR codes for multiple orders (for batch printing)
qrcodeRouter.get('/batch', async (req: AuthRequest, res: Response) => {
  const orderIds = req.query.ids as string;

  if (!orderIds) {
    throw BadRequestError('Order IDs are required');
  }

  const ids = orderIds.split(',').map(id => id.trim()).filter(Boolean);

  if (ids.length === 0) {
    throw BadRequestError('At least one order ID is required');
  }

  if (ids.length > 50) {
    throw BadRequestError('Maximum 50 orders per batch');
  }

  const orders = await prisma.workOrder.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      status: true,
      dueDate: true,
      routing: true,
      description: true,
      customer: {
        select: { name: true, companyName: true },
      },
    },
  });

  const labels = await Promise.all(
    orders.map(async (order) => {
      const payload = generateOrderQRPayload(order);
      const qrCode = await QRCode.toDataURL(payload, {
        width: 150,
        margin: 1,
        errorCorrectionLevel: 'M',
      });

      return {
        qrCode,
        orderNumber: order.orderNumber,
        customer: order.customer?.companyName || order.customer?.name || order.customerName,
        description: order.description?.substring(0, 50) || '',
        dueDate: order.dueDate?.toISOString().split('T')[0] || '',
        routing: order.routing || [],
      };
    })
  );

  res.json({
    success: true,
    data: {
      labels,
      count: labels.length,
    },
  });
});

// Schema for smart batch label printing
const SmartBatchSchema = z.object({
  dueDateFrom: z.coerce.date().optional(),
  dueDateTo: z.coerce.date().optional(),
  printingMethod: z.nativeEnum(PrintingMethod).optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'ALL']).optional().default('ALL'),
  groupByMethod: z.coerce.boolean().optional().default(false),
});

/**
 * Calculate business days from a date
 * Skips weekends (Sat/Sun)
 */
function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = result.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      added++;
    }
  }
  return result;
}

// GET /qrcode/batch/smart - Generate labels based on date range and printing method
qrcodeRouter.get('/batch/smart', async (req: AuthRequest, res: Response) => {
  const params = SmartBatchSchema.parse(req.query);
  
  // Default to today through +7 business days
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const dueDateFrom = params.dueDateFrom || today;
  const dueDateTo = params.dueDateTo || addBusinessDays(today, 7);
  dueDateTo.setHours(23, 59, 59, 999);

  // Build query
  const where: any = {
    dueDate: {
      gte: dueDateFrom,
      lte: dueDateTo,
    },
  };

  // Status filter
  if (params.status === 'PENDING') {
    where.status = 'PENDING';
  } else if (params.status === 'IN_PROGRESS') {
    where.status = 'IN_PROGRESS';
  } else {
    where.status = { in: ['PENDING', 'IN_PROGRESS'] };
  }

  // Printing method filter (routing is an array, filter orders that include this station)
  if (params.printingMethod) {
    where.routing = { has: params.printingMethod };
  }

  const orders = await prisma.workOrder.findMany({
    where,
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      status: true,
      dueDate: true,
      routing: true,
      description: true,
      customerId: true,
    },
    orderBy: [
      { dueDate: 'asc' },
      { orderNumber: 'asc' },
    ],
    take: 100, // Safety limit
  });

  // Generate labels
  const labelsWithMethod = await Promise.all(
    orders.map(async (order) => {
      const payload = generateOrderQRPayload(order);
      const qrCode = await QRCode.toDataURL(payload, {
        width: 150,
        margin: 1,
        errorCorrectionLevel: 'M',
      });

      return {
        orderId: order.id,
        qrCode,
        orderNumber: order.orderNumber,
        customer: order.customerName,
        description: order.description?.substring(0, 50) || '',
        dueDate: order.dueDate?.toISOString().split('T')[0] || '',
        routing: order.routing || [],
        printingMethod: (order.routing && order.routing.length > 0) ? order.routing[0] : null,
      };
    })
  );

  // Group by printing method if requested
  if (params.groupByMethod) {
    const grouped: Record<string, typeof labelsWithMethod> = {};
    for (const label of labelsWithMethod) {
      const method = label.printingMethod || 'UNASSIGNED';
      if (!grouped[method]) {
        grouped[method] = [];
      }
      grouped[method].push(label);
    }

    res.json({
      success: true,
      data: {
        grouped,
        totalCount: labelsWithMethod.length,
        dateRange: {
          from: dueDateFrom.toISOString().split('T')[0],
          to: dueDateTo.toISOString().split('T')[0],
        },
      },
    });
    return;
  }

  res.json({
    success: true,
    data: {
      labels: labelsWithMethod,
      count: labelsWithMethod.length,
      dateRange: {
        from: dueDateFrom.toISOString().split('T')[0],
        to: dueDateTo.toISOString().split('T')[0],
      },
    },
  });
});

// GET /qrcode/photo-upload/:orderId - Generate QR code for photo upload
qrcodeRouter.get('/photo-upload/:orderId', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { orderId } = req.params;

  // Generate a photo upload token
  const uploadToken = jwt.sign(
    { orderId, userId, purpose: 'photo-upload' },
    process.env.JWT_SECRET!,
    { expiresIn: '10m' }
  );

  // Build the URL that the QR code will contain
  const serverHost = process.env.SERVER_HOST_EXTERNAL || req.get('host') || 'localhost:8001';
  const protocol = req.protocol;
  const photoUrl = `${protocol}://${serverHost}/api/v1/photo-upload/${uploadToken}`;

  // Generate QR code as data URL
  const qrDataUrl = await QRCode.toDataURL(photoUrl, { width: 300, margin: 2 });

  res.json({ success: true, data: { qrDataUrl, photoUrl, expiresIn: 600 } });
});

export default qrcodeRouter;
