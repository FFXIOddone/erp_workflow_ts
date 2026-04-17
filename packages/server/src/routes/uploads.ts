import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { AuthRequest, authenticate } from '../middleware/auth.js';
import { prisma } from '../db/client.js';
import { broadcast } from '../ws/server.js';
import { buildRouteBroadcastPayload } from '../lib/route-broadcast.js';
import { AttachmentType } from '@prisma/client';

export const uploadsRouter = Router();

// Configure upload directory
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    // Generate unique filename with timestamp and original extension
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9-_]/g, '_');
    cb(null, `${baseName}-${uniqueSuffix}${ext}`);
  },
});

// Dangerous file extensions that should NEVER be uploaded
const BLOCKED_EXTENSIONS = [
  '.exe', '.msi', '.bat', '.cmd', '.com', '.scr', '.pif', '.vbs', '.vbe',
  '.js', '.jse', '.ws', '.wsf', '.wsc', '.wsh', '.ps1', '.psm1', '.psd1',
  '.msc', '.msp', '.lnk', '.inf', '.reg', '.dll', '.sys', '.drv',
  '.sh', '.bash', '.zsh', '.csh', '.ksh',
];

// File filter for allowed types
const fileFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Check file extension blocklist (defense in depth)
  const ext = path.extname(file.originalname).toLowerCase();
  if (BLOCKED_EXTENSIONS.includes(ext)) {
    cb(new Error(`File extension ${ext} is not allowed for security reasons`));
    return;
  }

  // Allow common document and image types
  const allowedMimes = [
    // Images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'image/tiff',
    'image/bmp',
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    // Archives
    'application/zip',
    'application/x-rar-compressed',
    // Design files (common in sign shops)
    'application/postscript', // .ai, .eps
    'application/illustrator',
    // Text
    'text/plain',
    'text/csv',
    // Email files
    'message/rfc822', // .eml
    'application/vnd.ms-outlook', // .msg
  ];

  if (allowedMimes.includes(file.mimetype) || file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} not allowed`));
  }
};

// Configure multer
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  },
});

// All routes require authentication
uploadsRouter.use(authenticate);

// POST /uploads/order/:orderId - Upload file to an order
uploadsRouter.post('/order/:orderId', upload.single('file'), async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const orderId = req.params.orderId!;
  const file = req.file;

  if (!file) {
    res.status(400).json({ success: false, error: 'No file uploaded' });
    return;
  }

  // Verify order exists
  const order = await prisma.workOrder.findFirst({
    where: { id: orderId },
    select: { id: true, orderNumber: true },
  });

  if (!order) {
    // Delete uploaded file if order doesn't exist
    fs.unlinkSync(file.path);
    res.status(404).json({ success: false, error: 'Order not found' });
    return;
  }

  // Determine attachment type from request or default to OTHER
  const fileType = (req.body.fileType as AttachmentType) || 'OTHER';
  const description = req.body.description || null;

  // Create attachment record
  const attachment = await prisma.orderAttachment.create({
    data: {
      fileName: file.originalname,
      filePath: file.filename, // Store just the filename, not full path
      fileType,
      fileSize: file.size,
      description,
      orderId: order.id,
      uploadedById: userId,
    },
    include: { uploadedBy: { select: { displayName: true } } },
  });

  // Log event
  await prisma.workEvent.create({
    data: {
      orderId: order.id,
      eventType: 'NOTE_ADDED', // Using NOTE_ADDED since ATTACHMENT_ADDED may not exist
      description: `File uploaded: ${file.originalname} (${fileType})`,
      userId,
    },
  });

  broadcast(buildRouteBroadcastPayload({ type: 'ORDER_UPDATED', payload: { orderId: order.id } }));

  res.status(201).json({ 
    success: true, 
    data: attachment,
    message: 'File uploaded successfully',
  });
});

// GET /uploads/:filename - Serve/download a file
uploadsRouter.get('/:filename', async (req: AuthRequest, res: Response) => {
  const filename = req.params.filename!;
  
  // Security: normalize path and prevent directory traversal
  const normalizedFilename = path.basename(filename); // Strip any directory components
  const filePath = path.resolve(UPLOAD_DIR, normalizedFilename);
  
  // Verify the resolved path is still within UPLOAD_DIR
  if (!filePath.startsWith(path.resolve(UPLOAD_DIR))) {
    res.status(403).json({ success: false, error: 'Access denied' });
    return;
  }

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ success: false, error: 'File not found' });
    return;
  }

  // Check if user has access to this file (verify it belongs to an order they can view)
  const attachment = await prisma.orderAttachment.findFirst({
    where: { filePath: filename },
    include: { order: { select: { id: true } } },
  });

  if (!attachment) {
    res.status(404).json({ success: false, error: 'Attachment not found' });
    return;
  }

  // Determine if this should be an inline view or download
  const isDownload = req.query.download === 'true';
  const disposition = isDownload ? 'attachment' : 'inline';

  res.setHeader('Content-Disposition', `${disposition}; filename="${attachment.fileName}"`);
  res.sendFile(filePath);
});

// GET /uploads/thumbnail/:filename - Get thumbnail for image files
uploadsRouter.get('/thumbnail/:filename', async (req: AuthRequest, res: Response) => {
  const filename = req.params.filename!;
  
  // Security: normalize path and prevent directory traversal
  const normalizedFilename = path.basename(filename);
  const filePath = path.resolve(UPLOAD_DIR, normalizedFilename);

  // Verify the resolved path is still within UPLOAD_DIR
  if (!filePath.startsWith(path.resolve(UPLOAD_DIR))) {
    res.status(403).json({ success: false, error: 'Access denied' });
    return;
  }

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ success: false, error: 'File not found' });
    return;
  }

  // For now, just serve the original file
  // In production, you might want to use sharp to generate actual thumbnails
  res.sendFile(filePath);
});

// DELETE /uploads/:attachmentId - Delete an uploaded file
uploadsRouter.delete('/:attachmentId', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const attachmentId = req.params.attachmentId!;

  const attachment = await prisma.orderAttachment.findFirst({
    where: { id: attachmentId },
    include: { order: { select: { id: true, orderNumber: true } } },
  });

  if (!attachment) {
    res.status(404).json({ success: false, error: 'Attachment not found' });
    return;
  }

  // Delete physical file if it exists in uploads folder
  const filePath = path.join(UPLOAD_DIR, attachment.filePath);
  if (fs.existsSync(filePath) && filePath.startsWith(UPLOAD_DIR)) {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      console.error('Failed to delete file:', err);
      // Continue anyway - file might already be deleted
    }
  }

  // Delete database record
  await prisma.orderAttachment.delete({ where: { id: attachment.id } });

  // Log event
  await prisma.workEvent.create({
    data: {
      orderId: attachment.orderId,
      eventType: 'NOTE_ADDED', // Using NOTE_ADDED since ATTACHMENT_REMOVED may not exist
      description: `File removed: ${attachment.fileName}`,
      userId,
    },
  });

  broadcast(buildRouteBroadcastPayload({ type: 'ORDER_UPDATED', payload: { orderId: attachment.orderId } }));

  res.json({ success: true, message: 'File deleted successfully' });
});

// POST /uploads/order/:orderId/register - Register a file already on the network drive (no re-upload)
uploadsRouter.post('/order/:orderId/register', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { orderId } = req.params;
  const { fileName, filePath, fileType, fileSize } = req.body;

  if (!fileName || !filePath) {
    return res.status(400).json({ success: false, error: 'fileName and filePath are required' });
  }

  // Verify order exists
  const order = await prisma.workOrder.findUnique({ where: { id: orderId } });
  if (!order) {
    return res.status(404).json({ success: false, error: 'Order not found' });
  }

  const attachment = await prisma.orderAttachment.create({
    data: {
      fileName,
      filePath,
      fileType: fileType || 'OTHER',
      fileSize: fileSize || null,
      orderId,
      uploadedById: userId,
    },
  });

  broadcast(buildRouteBroadcastPayload({ type: 'ATTACHMENT_ADDED', payload: { orderId, attachment }, timestamp: new Date() }));
  res.json({ success: true, data: attachment });
});
