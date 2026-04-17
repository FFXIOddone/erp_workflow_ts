import { Router, type Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import rateLimit from 'express-rate-limit';
import {
  PortalRegisterSchema,
  PortalLoginSchema,
  PortalForgotPasswordSchema,
  PortalResetPasswordSchema,
  PortalUpdateProfileSchema,
  PortalChangePasswordSchema,
  ProofResponseSchema,
  CreatePortalMessageSchema,
  PortalMessageFilterSchema,
  ProofStatus,
} from '@erp/shared';
import { prisma } from '../db/client.js';
import { BadRequestError, NotFoundError, UnauthorizedError } from '../middleware/error-handler.js';
import {
  sendPortalVerificationEmail,
  sendPortalPasswordResetEmail,
  sendProofResponseNotificationEmail,
  sendNewMessageNotificationEmail,
} from '../services/email.js';
import { createLastUpdatedDate } from '../lib/last-updated.js';

const router = Router();

// ============ File Upload Configuration ============

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
const PORTAL_UPLOAD_DIR = path.join(UPLOAD_DIR, 'portal');

// Ensure upload directories exist
if (!fs.existsSync(PORTAL_UPLOAD_DIR)) {
  fs.mkdirSync(PORTAL_UPLOAD_DIR, { recursive: true });
}

// Configure multer storage for portal uploads
const portalStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, PORTAL_UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9-_]/g, '_');
    cb(null, `${baseName}-${uniqueSuffix}${ext}`);
  },
});

// Blocked extensions for security
const BLOCKED_EXTENSIONS = [
  '.exe', '.msi', '.bat', '.cmd', '.com', '.scr', '.pif', '.vbs', '.vbe',
  '.js', '.jse', '.ws', '.wsf', '.wsc', '.wsh', '.ps1', '.psm1', '.psd1',
  '.msc', '.msp', '.lnk', '.inf', '.reg', '.dll', '.sys', '.drv',
];

const portalFileFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (BLOCKED_EXTENSIONS.includes(ext)) {
    cb(new Error(`File extension ${ext} is not allowed`));
    return;
  }

  // Allow images and common design files
  const allowedMimes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/tiff',
    'application/pdf', 'application/postscript', 'application/illustrator',
    'application/zip', 'application/x-rar-compressed',
  ];

  if (allowedMimes.includes(file.mimetype) || file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} not allowed`));
  }
};

const portalUpload = multer({
  storage: portalStorage,
  fileFilter: portalFileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// ============ Portal Authentication Middleware ============

interface PortalRequest extends Request {
  portalUser?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    customerId: string;
  };
}

const PORTAL_JWT_SECRET = (process.env.PORTAL_JWT_SECRET || process.env.JWT_SECRET)!;
if (!PORTAL_JWT_SECRET) {
  throw new Error('FATAL: PORTAL_JWT_SECRET (or JWT_SECRET) environment variable is required');
}
const JWT_EXPIRES_IN = process.env.PORTAL_JWT_EXPIRES_IN || '7d';

// Rate limiters for portal auth routes
const portalAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                   // 10 attempts per window
  message: { success: false, error: 'Too many attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const portalRegisterLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,                    // 5 registration attempts per hour
  message: { success: false, error: 'Too many registration attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

function generatePortalToken(user: { id: string; email: string; customerId: string }) {
  return jwt.sign(
    { sub: user.id, email: user.email, customerId: user.customerId, type: 'portal' },
    PORTAL_JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] }
  );
}

async function portalAuth(req: any, res: Response, next: Function) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw UnauthorizedError('No token provided');
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, PORTAL_JWT_SECRET) as any;

    if (decoded.type !== 'portal') {
      throw UnauthorizedError('Invalid token type');
    }

    const portalUser = await prisma.portalUser.findUnique({
      where: { id: decoded.sub },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        customerId: true,
        isActive: true,
      },
    });

    if (!portalUser || !portalUser.isActive) {
      throw UnauthorizedError('Account not found or inactive');
    }

    req.portalUser = portalUser;
    next();
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }
    next(error);
  }
}

// ============ Public Auth Routes ============

// POST /portal/auth/register
router.post('/auth/register', portalRegisterLimiter, async (req: any, res: Response) => {
  const data = PortalRegisterSchema.parse(req.body);

  // Validate invite token — registration requires a valid invitation
  if (!data.inviteToken) {
    throw BadRequestError('An invitation token is required to register');
  }

  const invite = await prisma.portalInvite.findUnique({
    where: { token: data.inviteToken },
  });

  if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
    throw BadRequestError('Invalid or expired invitation token');
  }

  // Use the customer from the invite, not user-supplied
  const customerId = invite.customerId;

  // Check if email already exists
  const existingUser = await prisma.portalUser.findUnique({
    where: { email: data.email.toLowerCase() },
  });

  if (existingUser) {
    throw BadRequestError('An account with this email already exists');
  }

  // Verify customer exists
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
  });

  if (!customer) {
    throw NotFoundError('Customer not found');
  }

  // Hash password and create user
  const passwordHash = await bcrypt.hash(data.password, 12);
  const verifyToken = crypto.randomBytes(32).toString('hex');

  const portalUser = await prisma.portalUser.create({
    data: {
      email: data.email.toLowerCase(),
      passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      customerId,
      verifyToken,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      customerId: true,
    },
  });

  // Send verification email
  sendPortalVerificationEmail({
    email: portalUser.email,
    firstName: portalUser.firstName || undefined,
    lastName: portalUser.lastName || undefined,
    companyName: customer.companyName || customer.name,
    token: verifyToken,
  }).catch((err) => console.error('Failed to send verification email:', err));

  // Mark invite as used
  await prisma.portalInvite.update({
    where: { id: invite.id },
    data: { usedAt: new Date(), usedByEmail: portalUser.email },
  });

  if (!portalUser.customerId) {
    throw BadRequestError('Portal user is not linked to a customer');
  }
  const token = generatePortalToken({ id: portalUser.id, email: portalUser.email, customerId: portalUser.customerId });

  res.status(201).json({
    success: true,
    data: {
      token,
      user: portalUser,
    },
  });
});

// POST /portal/auth/login
router.post('/auth/login', portalAuthLimiter, async (req: any, res: Response) => {
  const { email, password } = PortalLoginSchema.parse(req.body);

  const portalUser = await prisma.portalUser.findUnique({
    where: { email: email.toLowerCase() },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      firstName: true,
      lastName: true,
      customerId: true,
      isActive: true,
      customer: {
        select: { name: true, companyName: true },
      },
    },
  });

  if (!portalUser || !portalUser.isActive) {
    throw UnauthorizedError('Invalid email or password');
  }

  const validPassword = await bcrypt.compare(password, portalUser.passwordHash);
  if (!validPassword) {
    throw UnauthorizedError('Invalid email or password');
  }

  // Update last login
  await prisma.portalUser.update({
    where: { id: portalUser.id },
    data: { lastLoginAt: new Date() },
  });

  if (!portalUser.customerId) {
    throw BadRequestError('Portal user is not linked to a customer');
  }
  const token = generatePortalToken({ id: portalUser.id, email: portalUser.email, customerId: portalUser.customerId });

  res.json({
    success: true,
    data: {
      token,
      user: {
        id: portalUser.id,
        email: portalUser.email,
        firstName: portalUser.firstName,
        lastName: portalUser.lastName,
        customerId: portalUser.customerId,
        customerName: portalUser.customer?.companyName || portalUser.customer?.name,
      },
    },
  });
});

// POST /portal/auth/forgot-password
router.post('/auth/forgot-password', portalAuthLimiter, async (req: any, res: Response) => {
  const { email } = PortalForgotPasswordSchema.parse(req.body);

  const portalUser = await prisma.portalUser.findUnique({
    where: { email: email.toLowerCase() },
  });

  // Always return success to prevent email enumeration
  if (portalUser) {
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 3600000); // 1 hour

    await prisma.portalUser.update({
      where: { id: portalUser.id },
      data: { resetToken, resetExpires },
    });

    // Send password reset email
    sendPortalPasswordResetEmail({
      email: portalUser.email,
      firstName: portalUser.firstName || undefined,
      token: resetToken,
    }).catch((err) => console.error('Failed to send password reset email:', err));
  }

  res.json({
    success: true,
    message: 'If an account exists with this email, you will receive reset instructions.',
  });
});

// POST /portal/auth/reset-password
router.post('/auth/reset-password', portalAuthLimiter, async (req: any, res: Response) => {
  const { token, password } = PortalResetPasswordSchema.parse(req.body);

  const portalUser = await prisma.portalUser.findFirst({
    where: {
      resetToken: token,
      resetExpires: { gt: new Date() },
    },
  });

  if (!portalUser) {
    throw BadRequestError('Invalid or expired reset token');
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.portalUser.update({
    where: { id: portalUser.id },
    data: {
      passwordHash,
      resetToken: null,
      resetExpires: null,
    },
  });

  res.json({
    success: true,
    message: 'Password has been reset successfully',
  });
});

// ============ Protected Routes ============

// GET /portal/profile
router.get('/profile', portalAuth, async (req: any, res: Response) => {
  const portalUser = await prisma.portalUser.findUnique({
    where: { id: req.portalUser.id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      emailVerified: true,
      createdAt: true,
      customer: {
        select: {
          id: true,
          name: true,
          companyName: true,
          address: true,
          city: true,
          state: true,
          zipCode: true,
          phone: true,
          email: true,
        },
      },
    },
  });

  res.json({ success: true, data: portalUser });
});

// PUT /portal/profile
router.put('/profile', portalAuth, async (req: any, res: Response) => {
  const data = PortalUpdateProfileSchema.parse(req.body);

  const portalUser = await prisma.portalUser.update({
    where: { id: req.portalUser.id },
    data,
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
    },
  });

  res.json({ success: true, data: portalUser });
});

// PUT /portal/profile/password
router.put('/profile/password', portalAuth, async (req: any, res: Response) => {
  const { currentPassword, newPassword } = PortalChangePasswordSchema.parse(req.body);

  const portalUser = await prisma.portalUser.findUnique({
    where: { id: req.portalUser.id },
    select: { passwordHash: true },
  });

  const validPassword = await bcrypt.compare(currentPassword, portalUser!.passwordHash);
  if (!validPassword) {
    throw BadRequestError('Current password is incorrect');
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.portalUser.update({
    where: { id: req.portalUser.id },
    data: { passwordHash },
  });

  res.json({ success: true, message: 'Password updated successfully' });
});

// ============ Orders Routes ============

// GET /portal/orders - List customer's orders
router.get('/orders', portalAuth, async (req: any, res: Response) => {
  const { page = 1, pageSize = 20, status } = req.query;

  const where: any = { customerId: req.portalUser.customerId };
  if (status) where.status = status;

  const [orders, total] = await Promise.all([
    prisma.workOrder.findMany({
      where,
      select: {
        id: true,
        orderNumber: true,
        description: true,
        status: true,
        priority: true,
        dueDate: true,
        createdAt: true,
        routing: true,
        stationProgress: {
          select: {
            station: true,
            status: true,
            completedAt: true,
          },
        },
        lineItems: {
          select: {
            id: true,
            description: true,
            quantity: true,
            unitPrice: true,
          },
        },
        proofApprovals: {
          where: { status: 'PENDING' },
          select: { id: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (Number(page) - 1) * Number(pageSize),
      take: Number(pageSize),
    }),
    prisma.workOrder.count({ where }),
  ]);

  // Calculate progress for each order
  const ordersWithProgress = orders.map((order) => {
    const totalStations = order.routing.length;
    const completedStations = order.stationProgress.filter(
      (sp) => sp.status === 'COMPLETED'
    ).length;
    const progress = totalStations > 0 ? Math.round((completedStations / totalStations) * 100) : 0;
    const total = order.lineItems.reduce(
      (sum, li) => sum + Number(li.quantity) * Number(li.unitPrice),
      0
    );
    const pendingProofs = order.proofApprovals.length;

    return {
      ...order,
      progress,
      total,
      pendingProofs,
      stationProgress: undefined,
      proofApprovals: undefined,
    };
  });

  res.json({
    success: true,
    data: {
      orders: ordersWithProgress,
      pagination: {
        page: Number(page),
        pageSize: Number(pageSize),
        total,
        totalPages: Math.ceil(total / Number(pageSize)),
      },
    },
  });
});

// GET /portal/orders/:id - Get order detail
router.get('/orders/:id', portalAuth, async (req: any, res: Response) => {
  const { id } = req.params;

  const order = await prisma.workOrder.findFirst({
    where: {
      id,
      customerId: req.portalUser.customerId,
    },
    include: {
      lineItems: {
        orderBy: { itemNumber: 'asc' },
      },
      stationProgress: {
        orderBy: { station: 'asc' },
      },
      attachments: {
        where: {
          fileType: { in: ['PROOF', 'ARTWORK'] },
        },
        orderBy: { uploadedAt: 'desc' },
      },
      shipments: {
        include: {
          packages: true,
        },
        orderBy: { createdAt: 'desc' },
      },
      proofApprovals: {
        include: {
          attachment: {
            select: {
              id: true,
              fileName: true,
              filePath: true,
              fileType: true,
              uploadedAt: true,
            },
          },
        },
        orderBy: { requestedAt: 'desc' },
      },
    },
  });

  if (!order) {
    throw NotFoundError('Order not found');
  }

  // Calculate progress
  const totalStations = order.routing.length;
  const completedStations = order.stationProgress.filter(
    (sp) => sp.status === 'COMPLETED'
  ).length;
  const progress = totalStations > 0 ? Math.round((completedStations / totalStations) * 100) : 0;

  // Calculate total
  const total = order.lineItems.reduce(
    (sum, li) => sum + Number(li.quantity) * Number(li.unitPrice),
    0
  );

  res.json({
    success: true,
    data: {
      ...order,
      progress,
      total,
    },
  });
});

// GET /portal/orders/:id/timeline - Get order activity timeline
router.get('/orders/:id/timeline', portalAuth, async (req: any, res: Response) => {
  const { id } = req.params;

  // Verify the order belongs to this customer
  const order = await prisma.workOrder.findFirst({
    where: {
      id,
      customerId: req.portalUser.customerId,
    },
    select: {
      id: true,
      orderNumber: true,
      createdAt: true,
      status: true,
    },
  });

  if (!order) {
    throw NotFoundError('Order not found');
  }

  // Get activity logs for this order
  const activities = await prisma.activityLog.findMany({
    where: {
      entityType: 'WorkOrder',
      entityId: id,
    },
    select: {
      id: true,
      action: true,
      description: true,
      details: true,
      createdAt: true,
      user: {
        select: {
          displayName: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50, // Limit to most recent 50 activities
  });

  // Get station progress history
  const stationProgress = await prisma.stationProgress.findMany({
    where: { orderId: id },
    orderBy: { completedAt: 'desc' },
  });

  // Get shipment events
  const shipments = await prisma.shipment.findMany({
    where: { workOrderId: id },
    select: {
      id: true,
      carrier: true,
      trackingNumber: true,
      status: true,
      shipDate: true,
      actualDelivery: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // Get proof approval events
  const proofApprovals = await prisma.proofApproval.findMany({
    where: { orderId: id },
    select: {
      id: true,
      status: true,
      requestedAt: true,
      respondedAt: true,
      comments: true,
      attachment: {
        select: {
          fileName: true,
        },
      },
    },
    orderBy: { requestedAt: 'desc' },
  });

  // Combine all events into a unified timeline
  const timelineEvents: Array<{
    id: string;
    type: string;
    title: string;
    description?: string;
    timestamp: Date;
    metadata?: Record<string, unknown>;
  }> = [];

  // Add order creation event
  timelineEvents.push({
    id: `order-created-${order.id}`,
    type: 'create',
    title: 'Order Created',
    description: `Order #${order.orderNumber} was created`,
    timestamp: order.createdAt,
  });

  // Add activity log events (filtered for customer-relevant info)
  const customerRelevantActions = [
    'STATUS_CHANGE',
    'UPDATE',
    'ASSIGN',
    'COMPLETE',
    'SHIP_ORDER',
    'PROOF_SENT',
    'PROOF_APPROVED',
    'PROOF_REJECTED',
    'COMPLETE_STATION',
  ];

  activities.forEach((activity) => {
    if (customerRelevantActions.includes(activity.action)) {
      timelineEvents.push({
        id: activity.id,
        type: activity.action.toLowerCase().includes('status') ? 'status_change' :
              activity.action.toLowerCase().includes('complete') ? 'complete' :
              activity.action.toLowerCase().includes('ship') ? 'shipment' :
              activity.action.toLowerCase().includes('proof') ? 'document' : 'update',
        title: activity.description.replace(/by .*$/, '').trim(), // Remove user name for privacy
        description: undefined,
        timestamp: activity.createdAt,
        metadata: activity.details as Record<string, unknown> || undefined,
      });
    }
  });

  // Add station completion events
  stationProgress.forEach((sp) => {
    if (sp.status === 'COMPLETED' && sp.completedAt) {
      timelineEvents.push({
        id: `station-${sp.id}`,
        type: 'complete',
        title: `${sp.station.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} Completed`,
        description: 'Production step completed',
        timestamp: sp.completedAt,
      });
    } else if (sp.status === 'IN_PROGRESS' && sp.startedAt) {
      timelineEvents.push({
        id: `station-start-${sp.id}`,
        type: 'status_change',
        title: `${sp.station.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} Started`,
        description: 'Production step in progress',
        timestamp: sp.startedAt,
      });
    }
  });

  // Add shipment events
  shipments.forEach((shipment) => {
    if (shipment.shipDate) {
      timelineEvents.push({
        id: `shipment-${shipment.id}`,
        type: 'shipment',
        title: 'Order Shipped',
        description: `Shipped via ${shipment.carrier}${shipment.trackingNumber ? ` • Tracking: ${shipment.trackingNumber}` : ''}`,
        timestamp: shipment.shipDate,
        metadata: { carrier: shipment.carrier, tracking: shipment.trackingNumber },
      });
    }
    if (shipment.actualDelivery) {
      timelineEvents.push({
        id: `delivery-${shipment.id}`,
        type: 'delivery',
        title: 'Order Delivered',
        description: `Delivered via ${shipment.carrier}`,
        timestamp: shipment.actualDelivery,
      });
    }
  });

  // Add proof approval events
  proofApprovals.forEach((proof) => {
    timelineEvents.push({
      id: `proof-request-${proof.id}`,
      type: 'document',
      title: 'Proof Sent for Approval',
      description: proof.attachment?.fileName,
      timestamp: proof.requestedAt,
    });

    if (proof.respondedAt) {
      timelineEvents.push({
        id: `proof-response-${proof.id}`,
        type: proof.status === 'APPROVED' ? 'complete' : proof.status === 'REJECTED' ? 'error' : 'info',
        title: proof.status === 'APPROVED' ? 'Proof Approved' :
               proof.status === 'REJECTED' ? 'Proof Rejected' :
               'Proof Response',
        description: proof.comments || undefined,
        timestamp: proof.respondedAt,
      });
    }
  });

  // Sort by timestamp descending (most recent first)
  timelineEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  // Remove duplicates based on id
  const uniqueEvents = timelineEvents.filter(
    (event, index, self) => index === self.findIndex((e) => e.id === event.id)
  );

  res.json({
    success: true,
    data: uniqueEvents,
  });
});

// ============ Proof Approval Routes ============

// GET /portal/proofs - List pending proofs
router.get('/proofs', portalAuth, async (req: any, res: Response) => {
  const proofs = await prisma.proofApproval.findMany({
    where: {
      order: { customerId: req.portalUser.customerId },
      status: 'PENDING',
    },
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          description: true,
        },
      },
      attachment: {
        select: {
          id: true,
          fileName: true,
          filePath: true,
          uploadedAt: true,
        },
      },
    },
    orderBy: { requestedAt: 'desc' },
  });

  res.json({ success: true, data: proofs });
});

// GET /portal/proofs/:id - Get proof detail
router.get('/proofs/:id', portalAuth, async (req: any, res: Response) => {
  const { id } = req.params;

  const proof = await prisma.proofApproval.findFirst({
    where: {
      id,
      order: { customerId: req.portalUser.customerId },
    },
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          description: true,
          customerName: true,
        },
      },
      attachment: true,
      respondedBy: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (!proof) {
    throw NotFoundError('Proof not found');
  }

  res.json({ success: true, data: proof });
});

// POST /portal/proofs/:id/respond - Approve/reject proof
router.post('/proofs/:id/respond', portalAuth, async (req: any, res: Response) => {
  const { id } = req.params;
  const { status, comments } = ProofResponseSchema.parse(req.body);

  const proof = await prisma.proofApproval.findFirst({
    where: {
      id,
      order: { customerId: req.portalUser.customerId },
      status: 'PENDING',
    },
  });

  if (!proof) {
    throw NotFoundError('Proof not found or already responded');
  }

  const updatedProof = await prisma.proofApproval.update({
    where: { id },
    data: {
      status: status as any,
      comments,
      respondedAt: new Date(),
      respondedById: req.portalUser.id,
    },
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          customer: {
            select: { name: true, companyName: true },
          },
        },
      },
    },
  });

  // Notify internal team of proof response
  // Get admin/sales emails to notify
  const staffToNotify = await prisma.user.findMany({
    where: {
      isActive: true,
      role: { in: ['ADMIN', 'MANAGER'] },
    },
    select: { email: true },
  });

  if (staffToNotify.length > 0) {
    const customerName = updatedProof.order?.customer?.companyName || 
                         updatedProof.order?.customer?.name || 
                         `${req.portalUser.firstName || ''} ${req.portalUser.lastName || ''}`.trim() || 
                         'Customer';
    
    sendProofResponseNotificationEmail({
      staffEmail: staffToNotify.map(u => u.email).filter((e): e is string => e !== null),
      customerName,
      orderNumber: updatedProof.order?.orderNumber || 'Unknown',
      orderId: updatedProof.order?.id || proof.orderId,
      proofNumber: updatedProof.revision,
      approved: status === ProofStatus.APPROVED,
      feedback: comments || undefined,
    }).catch((err) => console.error('Failed to send proof response notification:', err));
  }

  res.json({
    success: true,
    data: updatedProof,
    message: `Proof ${status.toLowerCase()} successfully`,
  });
});

// ============ Messages Routes ============

// GET /portal/messages - List message threads
router.get('/messages', portalAuth, async (req: any, res: Response) => {
  const filters = PortalMessageFilterSchema.parse(req.query);

  // Get threads with original subject (from first message) but latest content
  const threads = await prisma.$queryRaw`
    WITH thread_first AS (
      SELECT DISTINCT ON (m."threadId")
        m."threadId",
        m.subject as "originalSubject",
        m."orderId" as "originalOrderId"
      FROM "PortalMessage" m
      WHERE m."customerId" = ${req.portalUser.customerId}
      ORDER BY m."threadId", m."createdAt" ASC
    ),
    thread_latest AS (
      SELECT DISTINCT ON (m."threadId")
        m."threadId",
        m.id,
        m.content,
        m."isFromCustomer",
        m."isRead",
        m."createdAt"
      FROM "PortalMessage" m
      WHERE m."customerId" = ${req.portalUser.customerId}
      ORDER BY m."threadId", m."createdAt" DESC
    )
    SELECT 
      tl."threadId",
      tl.id,
      tf."originalSubject" as subject,
      tl.content,
      tl."isFromCustomer",
      tl."isRead",
      tl."createdAt",
      tf."originalOrderId" as "orderId",
      o."orderNumber"
    FROM thread_latest tl
    JOIN thread_first tf ON tl."threadId" = tf."threadId"
    LEFT JOIN "WorkOrder" o ON tf."originalOrderId" = o.id
    ORDER BY tl."createdAt" DESC
  `;

  res.json({ success: true, data: threads });
});

// GET /portal/messages/thread/:threadId - Get messages in thread
router.get('/messages/thread/:threadId', portalAuth, async (req: any, res: Response) => {
  const { threadId } = req.params;

  const messages = await prisma.portalMessage.findMany({
    where: {
      threadId,
      customerId: req.portalUser.customerId,
    },
    include: {
      portalUser: {
        select: { firstName: true, lastName: true },
      },
      user: {
        select: { displayName: true },
      },
      order: {
        select: { orderNumber: true, description: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  if (messages.length === 0) {
    throw NotFoundError('Thread not found');
  }

  // Mark unread messages as read
  await prisma.portalMessage.updateMany({
    where: {
      threadId,
      customerId: req.portalUser.customerId,
      isFromCustomer: false,
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  res.json({ success: true, data: messages });
});

// POST /portal/messages - Send new message
router.post('/messages', portalAuth, async (req: any, res: Response) => {
  const data = CreatePortalMessageSchema.parse(req.body);

  // Generate thread ID if not provided (new conversation)
  const isReply = !!data.threadId;
  const threadId = data.threadId || crypto.randomUUID();

  let orderId = data.orderId;
  let subject = data.subject;

  // If replying to existing thread, inherit orderId and subject from original message
  if (isReply) {
    const originalMessage = await prisma.portalMessage.findFirst({
      where: {
        threadId,
        customerId: req.portalUser.customerId,
      },
      orderBy: { createdAt: 'asc' },
    });
    if (originalMessage) {
      orderId = orderId || originalMessage.orderId || undefined;
      // Don't set subject for replies - they inherit from thread
    }
  }

  // If orderId provided, verify it belongs to customer
  if (orderId) {
    const order = await prisma.workOrder.findFirst({
      where: {
        id: orderId,
        customerId: req.portalUser.customerId,
      },
    });
    if (!order) {
      throw BadRequestError('Order not found');
    }
  }

  const message = await prisma.portalMessage.create({
    data: {
      threadId,
      orderId: orderId ?? undefined,
      subject: isReply ? undefined : subject, // Only set subject for new threads
      content: data.content,
      isFromCustomer: true,
      attachments: data.attachments,
      portalUserId: req.portalUser.id,
      customerId: req.portalUser.customerId,
    },
    include: {
      order: {
        select: { orderNumber: true },
      },
    },
  });

  // Notify internal team of new message
  const staffToNotify = await prisma.user.findMany({
    where: {
      isActive: true,
      role: { in: ['ADMIN', 'MANAGER'] },
    },
    select: { email: true, displayName: true },
  });

  const customerName = `${req.portalUser.firstName || ''} ${req.portalUser.lastName || ''}`.trim() || 'Customer';
  
  for (const staff of staffToNotify) {
    if (!staff.email) continue;
    sendNewMessageNotificationEmail({
      recipientEmail: staff.email,
      recipientName: staff.displayName || 'Team Member',
      senderName: customerName,
      orderNumber: message.order?.orderNumber,
      orderId: orderId,
      messagePreview: data.content,
      isToCustomer: false, // customer to staff
    }).catch((err) => console.error('Failed to send message notification:', err));
  }

  res.status(201).json({ success: true, data: message });
});

// GET /portal/messages/unread-count
router.get('/messages/unread-count', portalAuth, async (req: any, res: Response) => {
  const count = await prisma.portalMessage.count({
    where: {
      customerId: req.portalUser.customerId,
      isFromCustomer: false,
      isRead: false,
    },
  });

  res.json({ success: true, data: { count } });
});

// ============ Dashboard Stats ============

// GET /portal/dashboard
router.get('/dashboard', portalAuth, async (req: any, res: Response) => {
  const customerId = req.portalUser.customerId;

  const [
    activeOrders,
    completedOrders,
    pendingProofs,
    unreadMessages,
    recentOrders,
  ] = await Promise.all([
    prisma.workOrder.count({
      where: {
        customerId,
        status: { in: ['PENDING', 'IN_PROGRESS', 'ON_HOLD'] },
      },
    }),
    prisma.workOrder.count({
      where: {
        customerId,
        status: { in: ['COMPLETED', 'SHIPPED'] },
      },
    }),
    prisma.proofApproval.count({
      where: {
        order: { customerId },
        status: 'PENDING',
      },
    }),
    prisma.portalMessage.count({
      where: {
        customerId,
        isFromCustomer: false,
        isRead: false,
      },
    }),
    prisma.workOrder.findMany({
      where: { customerId },
      select: {
        id: true,
        orderNumber: true,
        description: true,
        status: true,
        dueDate: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ]);

  res.json({
    success: true,
    data: {
      stats: {
        activeOrders,
        completedOrders,
        pendingProofs,
        unreadMessages,
      },
      recentOrders,
    },
  });
});

// ============ Notification Preferences Routes ============

// GET /portal/notifications/preferences - Get notification preferences
router.get('/notifications/preferences', portalAuth, async (req: any, res: Response) => {
  // Try to find existing preferences in PortalNotificationPrefs table
  // If not found, return defaults
  let preferences = await prisma.portalNotificationPref.findUnique({
    where: { portalUserId: req.portalUser.id },
  });

  // Default preferences if none exist
  const defaultPreferences = {
    order_status: { emailEnabled: true, portalEnabled: true },
    proof_ready: { emailEnabled: true, portalEnabled: true },
    shipment_updates: { emailEnabled: true, portalEnabled: true },
    new_messages: { emailEnabled: true, portalEnabled: true },
  };

  res.json({
    success: true,
    data: {
      preferences: preferences?.preferences || defaultPreferences,
    },
  });
});

// PUT /portal/notifications/preferences - Update notification preferences
router.put('/notifications/preferences', portalAuth, async (req: any, res: Response) => {
  const { preferences } = req.body;

  if (!preferences || typeof preferences !== 'object') {
    throw BadRequestError('Invalid preferences format');
  }

  // Upsert the preferences
  const updated = await prisma.portalNotificationPref.upsert({
    where: { portalUserId: req.portalUser.id },
    update: { preferences, updatedAt: new Date() },
    create: {
      portalUserId: req.portalUser.id,
      preferences,
    },
  });

  res.json({
    success: true,
    data: {
      preferences: updated.preferences,
    },
  });
});

// ==================== RECURRING ORDERS ====================

// GET /portal/recurring-orders - List customer's recurring orders/subscriptions
router.get('/recurring-orders', portalAuth, async (req: any, res: Response) => {
  const recurringOrders = await prisma.recurringOrder.findMany({
    where: {
      customerId: req.portalUser.customerId,
    },
    include: {
      lineItems: true,
      generatedOrders: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 5, // Last 5 generated orders
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({
    success: true,
    data: recurringOrders,
  });
});

// GET /portal/recurring-orders/:id - Get single recurring order details
router.get('/recurring-orders/:id', portalAuth, async (req: any, res: Response) => {
  const { id } = req.params;

  const recurringOrder = await prisma.recurringOrder.findFirst({
    where: {
      id,
      customerId: req.portalUser.customerId,
    },
    include: {
      lineItems: true,
      generatedOrders: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          createdAt: true,
          dueDate: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      generationLogs: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });

  if (!recurringOrder) {
    throw NotFoundError('Recurring order not found');
  }

  res.json({
    success: true,
    data: recurringOrder,
  });
});

// POST /portal/recurring-orders/:id/pause - Pause a recurring order
router.post('/recurring-orders/:id/pause', portalAuth, async (req: any, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;

  const recurringOrder = await prisma.recurringOrder.findFirst({
    where: {
      id,
      customerId: req.portalUser.customerId,
    },
  });

  if (!recurringOrder) {
    throw NotFoundError('Recurring order not found');
  }

  if (recurringOrder.isPaused) {
    throw BadRequestError('This subscription is already paused');
  }

  const updated = await prisma.recurringOrder.update({
    where: { id },
    data: {
      isPaused: true,
      pausedReason: reason || 'Paused by customer via portal',
    },
  });

  // Log the action
  await prisma.recurringOrderLog.create({
    data: {
      recurringOrderId: id,
      action: 'PAUSED',
      details: reason || 'Paused by customer via portal',
    },
  });

  res.json({
    success: true,
    data: updated,
    message: 'Subscription paused successfully',
  });
});

// POST /portal/recurring-orders/:id/resume - Resume a paused recurring order
router.post('/recurring-orders/:id/resume', portalAuth, async (req: any, res: Response) => {
  const { id } = req.params;

  const recurringOrder = await prisma.recurringOrder.findFirst({
    where: {
      id,
      customerId: req.portalUser.customerId,
    },
  });

  if (!recurringOrder) {
    throw NotFoundError('Recurring order not found');
  }

  if (!recurringOrder.isPaused) {
    throw BadRequestError('This subscription is not paused');
  }

  const updated = await prisma.recurringOrder.update({
    where: { id },
    data: {
      isPaused: false,
      pausedReason: null,
    },
  });

  // Log the action
  await prisma.recurringOrderLog.create({
    data: {
      recurringOrderId: id,
      action: 'RESUMED',
      details: 'Resumed by customer via portal',
    },
  });

  res.json({
    success: true,
    data: updated,
    message: 'Subscription resumed successfully',
  });
});

// ============ SELF-SERVICE EXPERIENCE HUB ============

// POST /portal/orders/:id/artwork/upload - Upload artwork file for an order (multipart form)
router.post('/orders/:id/artwork/upload', portalAuth, portalUpload.single('file'), async (req: any, res: Response) => {
  const { id } = req.params;
  const { notes } = req.body;
  const file = req.file;

  if (!file) {
    throw BadRequestError('No file uploaded');
  }

  // Verify order belongs to customer
  const order = await prisma.workOrder.findFirst({
    where: {
      id,
      customerId: req.portalUser.customerId,
    },
    select: { id: true, orderNumber: true },
  });

  if (!order) {
    // Delete uploaded file if order not found
    fs.unlinkSync(file.path);
    throw NotFoundError('Order not found');
  }

  // Create attachment record with actual file path
  const attachment = await prisma.document.create({
    data: {
      name: file.originalname,
      fileName: file.originalname,
      filePath: file.path,
      fileSize: file.size,
      fileType: path.extname(file.originalname),
      mimeType: file.mimetype,
      category: 'DESIGN_FILE',
      orderId: id,
      uploadedById: req.portalUser.id,
    },
  });

  // Log the activity
  await prisma.activityLog.create({
    data: {
      action: 'CREATE',
      entityType: 'ATTACHMENT',
      entityId: attachment.id,
      description: `Customer uploaded artwork: ${file.originalname}`,
    },
  });

  // Create a message thread about the artwork upload if notes provided
  if (notes) {
    await prisma.portalMessage.create({
      data: {
        threadId: crypto.randomUUID(),
        portalUserId: req.portalUser.id,
        customerId: req.portalUser.customerId,
        subject: `Artwork uploaded for Order #${order.orderNumber}`,
        content: `I've uploaded artwork for this order.\n\nNotes: ${notes}`,
        isFromCustomer: true,
        orderId: id,
      },
    });
  }

  res.json({
    success: true,
    data: attachment,
    message: 'Artwork uploaded successfully',
  });
});

// POST /portal/orders/:id/artwork - Upload artwork for an order (JSON metadata - legacy)
router.post('/orders/:id/artwork', portalAuth, async (req: any, res: Response) => {
  const { id } = req.params;
  const { fileName, fileUrl, fileSize, mimeType, notes } = req.body;

  // Verify order belongs to customer
  const order = await prisma.workOrder.findFirst({
    where: {
      id,
      customerId: req.portalUser.customerId,
    },
    select: { id: true, orderNumber: true },
  });

  if (!order) {
    throw NotFoundError('Order not found');
  }

  // Create attachment record
  const attachment = await prisma.document.create({
    data: {
      name: fileName,
      fileName,
      filePath: fileUrl,
      fileSize: fileSize || 0,
      fileType: path.extname(fileName),
      mimeType: mimeType || 'application/octet-stream',
      category: 'DESIGN_FILE',
      orderId: id,
      uploadedById: req.portalUser.id,
    },
  });

  // Log the activity
  await prisma.activityLog.create({
    data: {
      action: 'CREATE',
      entityType: 'ATTACHMENT',
      entityId: attachment.id,
      description: `Customer uploaded artwork: ${fileName}`,
    },
  });

  // Create a message thread about the artwork upload if notes provided
  if (notes) {
    await prisma.portalMessage.create({
      data: {
        threadId: crypto.randomUUID(),
        portalUserId: req.portalUser.id,
        customerId: req.portalUser.customerId,
        subject: `Artwork uploaded for Order #${order.orderNumber}`,
        content: `I've uploaded artwork for this order.\n\nNotes: ${notes}`,
        isFromCustomer: true,
        orderId: id,
      },
    });
  }

  res.json({
    success: true,
    data: attachment,
    message: 'Artwork uploaded successfully',
  });
});

// GET /portal/orders/:id/artwork - Get all artwork for an order
router.get('/orders/:id/artwork', portalAuth, async (req: any, res: Response) => {
  const { id } = req.params;

  // Verify order belongs to customer
  const order = await prisma.workOrder.findFirst({
    where: {
      id,
      customerId: req.portalUser.customerId,
    },
    select: { id: true },
  });

  if (!order) {
    throw NotFoundError('Order not found');
  }

  const artwork = await prisma.document.findMany({
    where: {
      orderId: id,
      category: 'DESIGN_FILE',
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({
    success: true,
    data: artwork,
  });
});

// POST /portal/proofs/:id/annotations - Save proof annotations
router.post('/proofs/:id/annotations', portalAuth, async (req: any, res: Response) => {
  const { id } = req.params;
  const { annotations, imageDataUrl } = req.body;

  // Get the proof and verify ownership
  const proof = await prisma.proofApproval.findFirst({
    where: { id },
    include: {
      order: {
        select: { id: true, customerId: true, orderNumber: true },
      },
    },
  });

  if (!proof || proof.order.customerId !== req.portalUser.customerId) {
    throw NotFoundError('Proof not found');
  }

  // Store annotations as JSON in proof notes or separate table
  // For now, append to existing customer notes
  const annotationSummary = annotations
    .map((a: any, i: number) => `${i + 1}. ${a.type}: ${a.text || a.color || 'mark'}`)
    .join('\n');

  const updatedProof = await prisma.proofApproval.update({
    where: { id },
    data: {
      comments: proof.comments
        ? `${proof.comments}\n\n--- Annotations ---\n${annotationSummary}`
        : `--- Annotations ---\n${annotationSummary}`,
    },
  });

  // If annotated image provided, save as new attachment
  if (imageDataUrl) {
    // In production, save the data URL to file storage
    // For now, we'll store a reference
    await prisma.document.create({
      data: {
        name: `annotated-proof-${id}.png`,
        fileName: `annotated-proof-${id}.png`,
        filePath: `annotations/${id}-${Date.now()}.png`,
        fileType: '.png',
        mimeType: 'image/png',
        category: 'PROOF',
        orderId: proof.order.id,
        fileSize: imageDataUrl.length,
        uploadedById: req.portalUser.id,
      },
    });
  }

  res.json({
    success: true,
    data: updatedProof,
    message: 'Annotations saved successfully',
  });
});

// POST /portal/orders/:id/reorder - Quick reorder from an existing order
router.post('/orders/:id/reorder', portalAuth, async (req: any, res: Response) => {
  const { id } = req.params;
  const { notes, quantity } = req.body;

  // Get original order
  const originalOrder = await prisma.workOrder.findFirst({
    where: {
      id,
      customerId: req.portalUser.customerId,
    },
    include: {
      lineItems: true,
      customer: { select: { id: true, name: true } },
    },
  });

  if (!originalOrder) {
    throw NotFoundError('Order not found');
  }

  // Generate new order number
  const orderCount = await prisma.workOrder.count();
  const newOrderNumber = `WO-REORDER-${String(orderCount + 1).padStart(6, '0')}`;

  // Create new order based on original
  const newOrder = await prisma.workOrder.create({
    data: {
      orderNumber: newOrderNumber,
      customerName: originalOrder.customer?.name || 'Unknown',
      description: `Reorder of #${originalOrder.orderNumber}: ${originalOrder.description}`,
      status: 'PENDING',
      priority: originalOrder.priority,
      customerId: originalOrder.customerId,
      createdById: req.portalUser.id,
      notes: notes || `Reorder of #${originalOrder.orderNumber}`,
      // Copy line items with optional quantity multiplier
      lineItems: {
        create: originalOrder.lineItems.map((item, index) => ({
          itemNumber: index + 1,
          description: item.description,
          quantity: quantity ? item.quantity * quantity : item.quantity,
          unitPrice: item.unitPrice,
          notes: item.notes,
        })),
      },
    },
    include: {
      lineItems: true,
    },
  });

  // Log the activity
  await prisma.activityLog.create({
    data: {
      action: 'CREATE',
      entityType: 'WORK_ORDER',
      entityId: newOrder.id,
      description: `Reorder created from #${originalOrder.orderNumber} via portal`,
    },
  });

  // Create a message about the reorder
  await prisma.portalMessage.create({
    data: {
      threadId: crypto.randomUUID(),
      portalUserId: req.portalUser.id,
      customerId: req.portalUser.customerId,
      subject: `Reorder Request - ${newOrderNumber}`,
      content: `I would like to reorder based on Order #${originalOrder.orderNumber}.\n\n${notes || 'Please proceed with the same specifications.'}`,
      isFromCustomer: true,
      orderId: newOrder.id,
    },
  });

  res.json({
    success: true,
    data: newOrder,
    message: 'Reorder created successfully',
  });
});

// GET /portal/brand-assets - Get customer's brand assets
router.get('/brand-assets', portalAuth, async (req: any, res: Response) => {
  // Brand assets are attachments with type BRAND_ASSET linked to customer
  const assets = await prisma.document.findMany({
    where: {
      category: 'OTHER',
      customerId: req.portalUser.customerId,
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  // Also get any documents marked as brand guides
  const brandDocs = await prisma.document.findMany({
    where: {
      customerId: req.portalUser.customerId,
      OR: [
        { tags: { has: 'brand' } },
        { tags: { has: 'logo' } },
        { tags: { has: 'style-guide' } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  res.json({
    success: true,
    data: {
      assets,
      documents: brandDocs,
    },
  });
});

// POST /portal/brand-assets/upload - Upload a new brand asset file (multipart form)
router.post('/brand-assets/upload', portalAuth, portalUpload.single('file'), async (req: any, res: Response) => {
  const { assetType, description } = req.body;
  const file = req.file;

  if (!file) {
    throw BadRequestError('No file uploaded');
  }

  // Create as document with brand tag
  const document = await prisma.document.create({
    data: {
      name: file.originalname,
      fileName: file.originalname,
      description: description || `Brand asset: ${assetType || 'general'}`,
      filePath: file.path,
      fileType: path.extname(file.originalname),
      fileSize: file.size,
      mimeType: file.mimetype,
      category: 'BRAND_GUIDE',
      customerId: req.portalUser.customerId,
      tags: ['brand', assetType?.toLowerCase() || 'asset'],
      uploadedById: req.portalUser.id,
    },
  });

  res.json({
    success: true,
    data: document,
    message: 'Brand asset uploaded successfully',
  });
});

// POST /portal/brand-assets - Upload a new brand asset (JSON metadata - legacy)
router.post('/brand-assets', portalAuth, async (req: any, res: Response) => {
  const { fileName, fileUrl, fileSize, mimeType, assetType, description } = req.body;

  // Create as document with brand tag
  const document = await prisma.document.create({
    data: {
      name: fileName,
      fileName,
      description: description || `Brand asset: ${assetType}`,
      filePath: fileUrl,
      fileType: path.extname(fileName),
      fileSize: fileSize || 0,
      mimeType: mimeType || 'application/octet-stream',
      category: 'BRAND_GUIDE',
      customerId: req.portalUser.customerId,
      tags: ['brand', assetType?.toLowerCase() || 'asset'],
      uploadedById: req.portalUser.id,
    },
  });

  res.json({
    success: true,
    data: document,
    message: 'Brand asset uploaded successfully',
  });
});

// GET /portal/orders/:id/live-status - Get live production status for WebSocket
router.get('/orders/:id/live-status', portalAuth, async (req: any, res: Response) => {
  const { id } = req.params;

  const order = await prisma.workOrder.findFirst({
    where: {
      id,
      customerId: req.portalUser.customerId,
    },
    include: {
      stationProgress: {
        orderBy: { station: 'asc' },
      },
      shipments: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!order) {
    throw NotFoundError('Order not found');
  }

  // Calculate completion percentage
  const totalStations = order.stationProgress.length;
  const completedStations = order.stationProgress.filter((s) => s.completedAt).length;
  const completionPercent = totalStations > 0 ? Math.round((completedStations / totalStations) * 100) : 0;

  // Get current station
  const currentStation = order.stationProgress.find((s) => s.startedAt && !s.completedAt);
  const nextStation = order.stationProgress.find((s) => !s.startedAt);

  res.json({
    success: true,
    data: {
      orderId: id,
      status: order.status,
      completionPercent,
      totalStations,
      completedStations,
      currentStation: currentStation ? {
        name: currentStation.station,
        startedAt: currentStation.startedAt,
      } : null,
      nextStation: nextStation ? {
        name: nextStation.station,
      } : null,
      estimatedCompletion: order.dueDate,
      shipment: order.shipments[0] || null,
      lastUpdated: createLastUpdatedDate(),
    },
  });
});

// ============ Quote Engine Routes ============

// GET /portal/quote/categories - Get product categories for quote builder
router.get('/quote/categories', portalAuth, async (req: any, res: Response) => {
  const categories = await prisma.priceBookCategory.findMany({
    where: { isActive: true },
    include: {
      children: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
    orderBy: { sortOrder: 'asc' },
  });

  // Filter to only root-level categories
  const rootCategories = categories.filter(c => !c.parentId);

  res.json({
    success: true,
    data: rootCategories,
  });
});

// GET /portal/quote/products - Get products for a category
router.get('/quote/products', portalAuth, async (req: any, res: Response) => {
  const { categoryId } = req.query;

  const where: any = { isActive: true };
  if (categoryId) {
    // Include products from this category AND all child categories
    const childCategories = await prisma.priceBookCategory.findMany({
      where: { parentId: categoryId, isActive: true },
      select: { id: true },
    });
    const categoryIds = [categoryId, ...childCategories.map(c => c.id)];
    where.categoryId = { in: categoryIds };
  }

  const products = await prisma.priceBookItem.findMany({
    where,
    select: {
      id: true,
      sku: true,
      name: true,
      description: true,
      basePrice: true,
      pricingUnit: true,
      minQuantity: true,
      pricingTiers: true,
      artworkOptions: true,
      estimatedLeadDays: true,
      category: {
        select: { id: true, name: true, icon: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  res.json({
    success: true,
    data: products,
  });
});

// POST /portal/quote/artwork-upload - Upload custom artwork for a quote item
router.post('/quote/artwork-upload', portalAuth, portalUpload.single('artwork'), async (req: any, res: Response) => {
  if (!req.file) {
    throw BadRequestError('No file uploaded');
  }

  const fileUrl = `/uploads/portal/${req.file.filename}`;
  res.json({
    success: true,
    data: {
      filename: req.file.filename,
      originalName: req.file.originalname,
      url: fileUrl,
      size: req.file.size,
      mimetype: req.file.mimetype,
    },
  });
});

// POST /portal/quote/calculate - Calculate price for a quote line item
router.post('/quote/calculate', portalAuth, async (req: any, res: Response) => {
  const { productId, quantity, dimensions } = req.body;

  if (!productId) {
    throw BadRequestError('Product ID is required');
  }

  // Validate max printable width
  if (dimensions?.width && dimensions.width > 126) {
    throw BadRequestError('Width cannot exceed 126 inches (maximum printable width)');
  }

  const product = await prisma.priceBookItem.findUnique({
    where: { id: productId },
  });

  if (!product || !product.isActive) {
    throw NotFoundError('Product not found');
  }

  let basePricePerUnit = Number(product.basePrice);
  let quantityUsed = quantity || 1;

  // Apply quantity-based pricing tiers first (adjusts base rate)
  if (product.pricingTiers && Array.isArray(product.pricingTiers)) {
    const tiers = product.pricingTiers as Array<{
      minQty: number;
      maxQty?: number;
      price?: number;
      discountPercent?: number;
    }>;

    for (const tier of tiers) {
      if (quantityUsed >= tier.minQty && (!tier.maxQty || quantityUsed <= tier.maxQty)) {
        if (tier.price) {
          basePricePerUnit = tier.price;
        } else if (tier.discountPercent) {
          basePricePerUnit = basePricePerUnit * (1 - tier.discountPercent / 100);
        }
        break;
      }
    }
  }

  let unitPrice = basePricePerUnit;
  let calculatedPrice = basePricePerUnit * quantityUsed;

  // Calculate based on pricing unit (using tier-adjusted base price)
  switch (product.pricingUnit) {
    case 'SQFT':
      if (dimensions?.width && dimensions?.height) {
        const sqft = (dimensions.width * dimensions.height) / 144; // Convert from sq inches
        unitPrice = basePricePerUnit * sqft;
        calculatedPrice = unitPrice * quantityUsed;
      }
      break;
    case 'SQIN':
      if (dimensions?.width && dimensions?.height) {
        const sqin = dimensions.width * dimensions.height;
        unitPrice = basePricePerUnit * sqin;
        calculatedPrice = unitPrice * quantityUsed;
      }
      break;
    case 'LNFT':
      if (dimensions?.length) {
        unitPrice = basePricePerUnit * (dimensions.length / 12); // Convert from inches
        calculatedPrice = unitPrice * quantityUsed;
      }
      break;
    default: // EACH, SET, PACK
      calculatedPrice = unitPrice * quantityUsed;
  }

  res.json({
    success: true,
    data: {
      productId,
      productName: product.name,
      quantity: quantityUsed,
      pricingUnit: product.pricingUnit,
      dimensions,
      unitPrice: Math.round(unitPrice * 100) / 100,
      totalPrice: Math.round(calculatedPrice * 100) / 100,
      estimatedLeadDays: product.estimatedLeadDays || 5,
    },
  });
});

// GET /portal/quotes - Get customer's quotes
router.get('/quotes', portalAuth, async (req: any, res: Response) => {
  const { status, page = 1, pageSize = 20 } = req.query;

  const where: any = { customerId: req.portalUser.customerId };
  if (status) where.status = status;

  const [quotes, total] = await Promise.all([
    prisma.quote.findMany({
      where,
      include: {
        lineItems: {
          orderBy: { itemNumber: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (Number(page) - 1) * Number(pageSize),
      take: Number(pageSize),
    }),
    prisma.quote.count({ where }),
  ]);

  res.json({
    success: true,
    data: {
      quotes,
      pagination: {
        page: Number(page),
        pageSize: Number(pageSize),
        total,
        totalPages: Math.ceil(total / Number(pageSize)),
      },
    },
  });
});

// GET /portal/quotes/:id - Get quote detail
router.get('/quotes/:id', portalAuth, async (req: any, res: Response) => {
  const { id } = req.params;

  const quote = await prisma.quote.findFirst({
    where: {
      id,
      customerId: req.portalUser.customerId,
    },
    include: {
      lineItems: {
        orderBy: { itemNumber: 'asc' },
      },
    },
  });

  if (!quote) {
    throw NotFoundError('Quote not found');
  }

  res.json({
    success: true,
    data: quote,
  });
});

// POST /portal/quotes - Create a new quote request
router.post('/quotes', portalAuth, async (req: any, res: Response) => {
  const { items, notes, description, attachmentIds } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw BadRequestError('At least one item is required');
  }

  // Get customer info
  const customer = await prisma.customer.findUnique({
    where: { id: req.portalUser.customerId },
    select: { name: true, companyName: true },
  });

  // Generate quote number
  const lastQuote = await prisma.quote.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { quoteNumber: true },
  });
  const nextNumber = lastQuote
    ? parseInt(lastQuote.quoteNumber.replace('Q-', '')) + 1
    : 1001;
  const quoteNumber = `Q-${nextNumber}`;

  // Calculate totals
  let subtotal = 0;
  const lineItems: Array<{
    itemNumber: number;
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    notes?: string;
  }> = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const product = item.productId
      ? await prisma.priceBookItem.findUnique({ where: { id: item.productId } })
      : null;

    const quantity = item.quantity || 1;
    // SECURITY: Always use server-side pricing, never trust client-provided prices
    // For portal quotes, use product base price or 0 (staff will finalize)
    const unitPrice = product ? Number(product.basePrice) : 0;
    const totalPrice = unitPrice * quantity;
    subtotal += totalPrice;

    lineItems.push({
      itemNumber: i + 1,
      description: item.description || product?.name || 'Custom item',
      quantity,
      unitPrice,
      totalPrice,
      notes: item.notes,
    });
  }

  // Create quote with line items
  const quote = await prisma.quote.create({
    data: {
      quoteNumber,
      status: 'DRAFT',
      customerName: customer?.companyName || customer?.name || 'Unknown',
      description: description || `Quote request from ${customer?.companyName || customer?.name}`,
      subtotal,
      total: subtotal, // Tax will be added by staff
      notes: notes || undefined,
      customerId: req.portalUser.customerId,
      createdById: req.portalUser.id,
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      lineItems: {
        create: lineItems,
      },
    },
    include: {
      lineItems: true,
    },
  });

  // Link any uploaded attachments
  if (attachmentIds && attachmentIds.length > 0) {
    // Future: Update attachments to link to quote
  }

  res.status(201).json({
    success: true,
    data: quote,
    message: 'Quote request submitted successfully! Our team will review and finalize your quote.',
  });
});

// POST /portal/quotes/:id/approve - Approve a quote (convert to order)
router.post('/quotes/:id/approve', portalAuth, async (req: any, res: Response) => {
  const { id } = req.params;

  const quote = await prisma.quote.findFirst({
    where: {
      id,
      customerId: req.portalUser.customerId,
      status: 'SENT',
    },
    include: {
      lineItems: true,
      customer: true,
    },
  });

  if (!quote) {
    throw NotFoundError('Quote not found or not available for approval');
  }

  // Check if not expired
  if (quote.validUntil && quote.validUntil < new Date()) {
    throw BadRequestError('This quote has expired. Please request a new quote.');
  }

  // Generate order number
  const orderCount = await prisma.workOrder.count();
  const orderNumber = `WO-${String(orderCount + 1).padStart(6, '0')}`;

  // Get system user for order creation (or use first admin)
  const systemUser = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
  });

  if (!systemUser) {
    throw BadRequestError('No admin user found to create order');
  }

  // Create work order from quote in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create the work order
    const workOrder = await tx.workOrder.create({
      data: {
        orderNumber,
        customerName: quote.customerName,
        description: quote.description || `Order from Quote #${quote.quoteNumber}`,
        status: 'PENDING',
        priority: 3,
        customerId: quote.customerId,
        createdById: systemUser.id,
        isTempOrder: true,
        notes: `Auto-created from approved quote #${quote.quoteNumber}`,
        lineItems: {
          create: quote.lineItems.map((item, index) => ({
            itemNumber: index + 1,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            notes: item.notes,
            itemMasterId: item.itemMasterId,
          })),
        },
      },
      include: {
        lineItems: true,
      },
    });

    // Update quote with approval info and link to order
    await tx.quote.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        convertedAt: new Date(),
        convertedOrderId: workOrder.id,
      },
    });

    return workOrder;
  });

  res.json({
    success: true,
    message: `Quote approved! Order #${result.orderNumber} has been created.`,
    data: {
      quoteId: id,
      status: 'APPROVED',
      orderId: result.id,
      orderNumber: result.orderNumber,
    },
  });
});

// POST /portal/quotes/:id/reject - Reject a quote
router.post('/quotes/:id/reject', portalAuth, async (req: any, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;

  const quote = await prisma.quote.findFirst({
    where: {
      id,
      customerId: req.portalUser.customerId,
      status: 'SENT',
    },
  });

  if (!quote) {
    throw NotFoundError('Quote not found or not available for rejection');
  }

  await prisma.quote.update({
    where: { id },
    data: {
      status: 'REJECTED',
      rejectedAt: new Date(),
      lostReason: reason || undefined,
    },
  });

  res.json({
    success: true,
    message: 'Quote declined. Let us know if you would like to discuss alternatives.',
    data: { quoteId: id, status: 'REJECTED' },
  });
});

// ============ 360° CUSTOMER INTELLIGENCE ============

// GET /portal/intelligence/overview - Get customer intelligence overview
router.get('/intelligence/overview', portalAuth, async (req: any, res: Response) => {
  const customerId = req.portalUser.customerId;

  // Get customer basic info
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      name: true,
      companyName: true,
      email: true,
      phone: true,
      createdAt: true,
      tags: true,
    },
  });

  if (!customer) {
    throw NotFoundError('Customer not found');
  }

  // Get latest customer score
  const latestScore = await prisma.customerScore.findFirst({
    where: { customerId },
    orderBy: { scoreDate: 'desc' },
  });

  // Calculate lifetime stats from orders (sum from line items)
  const allOrders = await prisma.workOrder.findMany({
    where: { customerId },
    select: {
      id: true,
      createdAt: true,
      lineItems: {
        select: {
          quantity: true,
          unitPrice: true,
        },
      },
    },
  });

  const totalOrderCount = allOrders.length;
  const lifetimeValue = allOrders.reduce((sum, order) => {
    const orderTotal = order.lineItems.reduce((itemSum, item) => 
      itemSum + (item.quantity * Number(item.unitPrice)), 0);
    return sum + orderTotal;
  }, 0);

  // Get last 12 months revenue
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const recentOrders = allOrders.filter(o => o.createdAt >= twelveMonthsAgo);
  const last12MonthsRevenue = recentOrders.reduce((sum, order) => {
    const orderTotal = order.lineItems.reduce((itemSum, item) => 
      itemSum + (item.quantity * Number(item.unitPrice)), 0);
    return sum + orderTotal;
  }, 0);

  // Get order status breakdown
  const ordersByStatus = await prisma.workOrder.groupBy({
    by: ['status'],
    where: { customerId },
    _count: { id: true },
  });

  // Get first and last order dates
  const firstOrder = await prisma.workOrder.findFirst({
    where: { customerId },
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true },
  });

  const lastOrder = await prisma.workOrder.findFirst({
    where: { customerId },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true, orderNumber: true },
  });

  // Calculate relationship duration
  const relationshipDays = firstOrder
    ? Math.floor((Date.now() - firstOrder.createdAt.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  // Get average order value
  const avgOrderValue = totalOrderCount > 0
    ? lifetimeValue / totalOrderCount
    : 0;

  res.json({
    success: true,
    data: {
      customer,
      metrics: {
        lifetimeValue,
        totalOrders: totalOrderCount,
        averageOrderValue: avgOrderValue,
        last12MonthsRevenue,
        last12MonthsOrders: recentOrders.length,
        relationshipDays,
        firstOrderDate: firstOrder?.createdAt,
        lastOrderDate: lastOrder?.createdAt,
        lastOrderNumber: lastOrder?.orderNumber,
      },
      scores: latestScore ? {
        overall: latestScore.overallScore,
        financial: latestScore.financialScore,
        engagement: latestScore.engagementScore,
        loyalty: latestScore.loyaltyScore,
        churnRisk: latestScore.churnRiskScore,
        tier: latestScore.tier,
        paymentScore: latestScore.paymentScore,
      } : null,
      ordersByStatus: ordersByStatus.reduce((acc, item) => {
        acc[item.status] = item._count.id;
        return acc;
      }, {} as Record<string, number>),
    },
  });
});

// GET /portal/intelligence/timeline - Get customer relationship timeline
router.get('/intelligence/timeline', portalAuth, async (req: any, res: Response) => {
  const customerId = req.portalUser.customerId;
  const { limit = 50 } = req.query;

  // Get orders as timeline events
  const orders = await prisma.workOrder.findMany({
    where: { customerId },
    select: {
      id: true,
      orderNumber: true,
      description: true,
      status: true,
      createdAt: true,
      lineItems: {
        select: {
          quantity: true,
          unitPrice: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: Number(limit),
  });

  // Get quotes
  const quotes = await prisma.quote.findMany({
    where: { customerId },
    select: {
      id: true,
      quoteNumber: true,
      description: true,
      status: true,
      total: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: Number(limit),
  });

  // Get messages
  const messages = await prisma.portalMessage.findMany({
    where: { customerId },
    select: {
      id: true,
      subject: true,
      content: true,
      isFromCustomer: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: Number(limit),
  });

  // Get proof approvals
  const proofApprovals = await prisma.proofApproval.findMany({
    where: {
      order: { customerId },
    },
    select: {
      id: true,
      status: true,
      requestedAt: true,
      respondedAt: true,
      order: {
        select: { orderNumber: true },
      },
    },
    orderBy: { requestedAt: 'desc' },
    take: Number(limit),
  });

  // Combine and sort all events
  const timeline = [
    ...orders.map(o => {
      const orderTotal = o.lineItems.reduce((sum, item) => 
        sum + (item.quantity * Number(item.unitPrice)), 0);
      return {
        type: 'ORDER' as const,
        id: o.id,
        title: `Order #${o.orderNumber}`,
        description: o.description,
        status: o.status,
        amount: orderTotal,
        date: o.createdAt,
      };
    }),
    ...quotes.map(q => ({
      type: 'QUOTE' as const,
      id: q.id,
      title: `Quote #${q.quoteNumber}`,
      description: q.description,
      status: q.status,
      amount: Number(q.total || 0),
      date: q.createdAt,
    })),
    ...messages.map(m => ({
      type: 'MESSAGE' as const,
      id: m.id,
      title: m.subject || 'Message',
      description: m.content?.substring(0, 100) + (m.content && m.content.length > 100 ? '...' : ''),
      status: m.isFromCustomer ? 'SENT' : 'RECEIVED',
      amount: null,
      date: m.createdAt,
    })),
    ...proofApprovals.map(p => ({
      type: 'PROOF' as const,
      id: p.id,
      title: `Proof for #${p.order.orderNumber}`,
      description: `Proof ${p.status.toLowerCase()}`,
      status: p.status,
      amount: null,
      date: p.respondedAt || p.requestedAt,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
   .slice(0, Number(limit));

  res.json({
    success: true,
    data: timeline,
  });
});

// GET /portal/intelligence/trends - Get spending and order trends
router.get('/intelligence/trends', portalAuth, async (req: any, res: Response) => {
  const customerId = req.portalUser.customerId;
  const { months = 12 } = req.query;

  // Get orders grouped by month for the last N months
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - Number(months));

  const orders = await prisma.workOrder.findMany({
    where: {
      customerId,
      createdAt: { gte: startDate },
    },
    select: {
      id: true,
      createdAt: true,
      status: true,
      lineItems: {
        select: {
          quantity: true,
          unitPrice: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Group by month
  const monthlyData: Record<string, { orders: number; revenue: number }> = {};
  
  for (let i = 0; i < Number(months); i++) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthlyData[key] = { orders: 0, revenue: 0 };
  }

  orders.forEach(order => {
    const key = `${order.createdAt.getFullYear()}-${String(order.createdAt.getMonth() + 1).padStart(2, '0')}`;
    if (monthlyData[key]) {
      monthlyData[key].orders++;
      const orderTotal = order.lineItems.reduce((sum, item) => 
        sum + (item.quantity * Number(item.unitPrice)), 0);
      monthlyData[key].revenue += orderTotal;
    }
  });

  // Convert to array sorted by date
  const trends = Object.entries(monthlyData)
    .map(([month, data]) => ({ month, ...data }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // Get top product categories (from line items)
  const lineItems = await prisma.lineItem.findMany({
    where: {
      order: {
        customerId,
        createdAt: { gte: startDate },
      },
    },
    select: {
      description: true,
      quantity: true,
      unitPrice: true,
    },
  });

  // Simple categorization by keywords
  const categories: Record<string, { count: number; revenue: number }> = {};
  lineItems.forEach(item => {
    const desc = item.description.toLowerCase();
    let category = 'Other';
    if (desc.includes('sign') || desc.includes('banner') || desc.includes('vinyl')) {
      category = 'Signs & Banners';
    } else if (desc.includes('vehicle') || desc.includes('wrap') || desc.includes('decal')) {
      category = 'Vehicle Graphics';
    } else if (desc.includes('window') || desc.includes('glass')) {
      category = 'Window Graphics';
    } else if (desc.includes('print') || desc.includes('poster')) {
      category = 'Printed Materials';
    }
    
    if (!categories[category]) {
      categories[category] = { count: 0, revenue: 0 };
    }
    categories[category].count += item.quantity;
    categories[category].revenue += item.quantity * Number(item.unitPrice);
  });

  const topCategories = Object.entries(categories)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  res.json({
    success: true,
    data: {
      monthly: trends,
      topCategories,
    },
  });
});

// GET /portal/intelligence/recommendations - Get personalized recommendations
router.get('/intelligence/recommendations', portalAuth, async (req: any, res: Response) => {
  const customerId = req.portalUser.customerId;

  // Get customer score for recommendations
  const score = await prisma.customerScore.findFirst({
    where: { customerId },
    orderBy: { scoreDate: 'desc' },
  });

  // Get recent orders to understand patterns
  const recentOrders = await prisma.workOrder.findMany({
    where: { customerId },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: {
      lineItems: {
        select: { description: true },
      },
    },
  });

  // Generate recommendations based on data
  const recommendations: Array<{
    type: 'REORDER' | 'SEASONAL' | 'UPGRADE' | 'CROSS_SELL' | 'LOYALTY' | 'ACTION';
    title: string;
    description: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    actionUrl?: string;
  }> = [];

  // Check days since last order
  if (recentOrders.length > 0) {
    const daysSinceLastOrder = Math.floor(
      (Date.now() - recentOrders[0].createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceLastOrder > 90) {
      recommendations.push({
        type: 'REORDER',
        title: 'Time to reorder?',
        description: `It's been ${daysSinceLastOrder} days since your last order. Need to replenish any signage?`,
        priority: 'HIGH',
        actionUrl: '/hub/reorder',
      });
    }
  }

  // Seasonal recommendations
  const month = new Date().getMonth();
  if (month >= 9 && month <= 11) { // Oct-Dec
    recommendations.push({
      type: 'SEASONAL',
      title: 'Holiday Season Signage',
      description: 'Get ready for the holiday rush with festive banners and promotional signs!',
      priority: 'MEDIUM',
      actionUrl: '/hub/quote',
    });
  } else if (month >= 2 && month <= 4) { // Mar-May
    recommendations.push({
      type: 'SEASONAL',
      title: 'Spring Refresh',
      description: 'Spring is here! Update your exterior signage with fresh designs.',
      priority: 'MEDIUM',
      actionUrl: '/hub/quote',
    });
  }

  // Check if they've used all services
  const hasVehicleGraphics = recentOrders.some(o => 
    o.lineItems.some(li => 
      li.description.toLowerCase().includes('vehicle') || 
      li.description.toLowerCase().includes('wrap')
    )
  );

  if (!hasVehicleGraphics && recentOrders.length >= 3) {
    recommendations.push({
      type: 'CROSS_SELL',
      title: 'Mobile Advertising Opportunity',
      description: 'Turn your company vehicles into moving billboards with vehicle wraps!',
      priority: 'MEDIUM',
      actionUrl: '/hub/quote',
    });
  }

  // Loyalty recommendation based on tier
  if (score?.tier === 'GOLD' || score?.tier === 'PLATINUM') {
    recommendations.push({
      type: 'LOYALTY',
      title: `Thank you, ${score.tier} member!`,
      description: 'As a valued customer, you qualify for priority production and exclusive offers.',
      priority: 'LOW',
    });
  }

  // Check for pending proofs
  const pendingProofs = await prisma.proofApproval.count({
    where: {
      order: { customerId },
      status: 'PENDING',
    },
  });

  if (pendingProofs > 0) {
    recommendations.push({
      type: 'ACTION',
      title: `${pendingProofs} Proof${pendingProofs > 1 ? 's' : ''} Awaiting Approval`,
      description: 'Review and approve your proofs to keep your orders on schedule.',
      priority: 'HIGH',
      actionUrl: '/proofs',
    });
  }

  // Check for draft quotes
  const draftQuotes = await prisma.quote.count({
    where: {
      customerId,
      status: 'SENT',
    },
  });

  if (draftQuotes > 0) {
    recommendations.push({
      type: 'ACTION',
      title: `${draftQuotes} Quote${draftQuotes > 1 ? 's' : ''} Ready for Review`,
      description: 'We\'ve prepared quotes for you. Review and approve to get started!',
      priority: 'HIGH',
      actionUrl: '/quotes',
    });
  }

  // Sort by priority
  const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  res.json({
    success: true,
    data: recommendations,
  });
});

// ============ PAYMENT HISTORY (QuickBooks) ============

// GET /portal/payments - Get customer's payment history from QuickBooks
router.get('/payments', portalAuth, async (req: any, res: Response) => {
  const { fromDate, toDate, page = 1, pageSize = 20 } = req.query;
  const customerId = req.portalUser.customerId;

  try {
    // First, get the customer to find their QB ListID
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, name: true, accountNumber: true },
    });

    if (!customer?.accountNumber) {
      // No QB link - return empty with helpful message
      return res.json({
        success: true,
        data: {
          payments: [],
          pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
          qbConnected: false,
          message: 'Payment history not available - no QuickBooks link found',
        },
      });
    }

    // Check if QuickBooks is connected
    const { quickbooks } = await import('../services/quickbooks.js');
    const qbStatus = quickbooks.getConnectionStatus();

    if (!qbStatus.connected) {
      return res.json({
        success: true,
        data: {
          payments: [],
          pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
          qbConnected: false,
          message: 'QuickBooks is not currently connected',
        },
      });
    }

    // Get payments from QuickBooks
    const payments = await quickbooks.getPayments({
      customerId: customer.accountNumber,
      fromDate: fromDate ? new Date(fromDate as string) : undefined,
      toDate: toDate ? new Date(toDate as string) : undefined,
      limit: 100,
    });

    // Paginate results
    const total = payments.length;
    const startIdx = (Number(page) - 1) * Number(pageSize);
    const paginatedPayments = payments.slice(startIdx, startIdx + Number(pageSize));

    res.json({
      success: true,
      data: {
        payments: paginatedPayments.map(p => ({
          id: p.txnId,
          refNumber: p.refNumber,
          date: p.txnDate,
          amount: p.totalAmount,
          paymentMethod: p.paymentMethodName,
          memo: p.memo,
          appliedTo: p.appliedToInvoices.map(inv => ({
            invoiceRef: inv.invoiceRefNumber,
            appliedAmount: inv.appliedAmount,
          })),
        })),
        pagination: {
          page: Number(page),
          pageSize: Number(pageSize),
          total,
          totalPages: Math.ceil(total / Number(pageSize)),
        },
        qbConnected: true,
      },
    });
  } catch (error) {
    console.error('Error fetching payment history:', error);
    res.json({
      success: true,
      data: {
        payments: [],
        pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
        qbConnected: false,
        message: 'Unable to fetch payment history from QuickBooks',
      },
    });
  }
});

// GET /portal/payments/summary - Get payment summary (paid vs outstanding)
router.get('/payments/summary', portalAuth, async (req: any, res: Response) => {
  const customerId = req.portalUser.customerId;

  try {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, accountNumber: true },
    });

    if (!customer?.accountNumber) {
      return res.json({
        success: true,
        data: {
          qbConnected: false,
          totalPaid: 0,
          totalOutstanding: 0,
          invoiceCount: 0,
          paidInvoices: 0,
          unpaidInvoices: 0,
        },
      });
    }

    const { quickbooks } = await import('../services/quickbooks.js');
    const qbStatus = quickbooks.getConnectionStatus();

    if (!qbStatus.connected) {
      return res.json({
        success: true,
        data: {
          qbConnected: false,
          totalPaid: 0,
          totalOutstanding: 0,
          invoiceCount: 0,
          paidInvoices: 0,
          unpaidInvoices: 0,
        },
      });
    }

    // Get all invoices for this customer
    const invoices = await quickbooks.getInvoices({
      customerId: customer.accountNumber,
      limit: 500,
    });

    const invoiceCount = invoices.length;
    const paidInvoices = invoices.filter(inv => inv.isPaid).length;
    const unpaidInvoices = invoiceCount - paidInvoices;
    const totalPaid = invoices.reduce((sum, inv) => sum + inv.appliedAmount, 0);
    const totalOutstanding = invoices.reduce((sum, inv) => sum + inv.balanceRemaining, 0);

    res.json({
      success: true,
      data: {
        qbConnected: true,
        totalPaid,
        totalOutstanding,
        invoiceCount,
        paidInvoices,
        unpaidInvoices,
      },
    });
  } catch (error) {
    console.error('Error fetching payment summary:', error);
    res.json({
      success: true,
      data: {
        qbConnected: false,
        totalPaid: 0,
        totalOutstanding: 0,
        invoiceCount: 0,
        paidInvoices: 0,
        unpaidInvoices: 0,
      },
    });
  }
});

export default router;
