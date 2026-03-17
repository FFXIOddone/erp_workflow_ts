import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { AuthRequest, authenticate } from '../middleware/auth.js';
import { prisma } from '../db/client.js';
import { broadcast } from '../ws/server.js';
import { logActivity, ActivityAction, EntityType } from '../lib/activity-logger.js';
import { UploadDocumentSchema, UpdateDocumentSchema, DocumentFilterSchema } from '@erp/shared';
import { DocumentCategory } from '@prisma/client';

export const documentsRouter = Router();

// Configure upload directory for documents
const DOCUMENTS_DIR = process.env.DOCUMENTS_DIR || path.join(process.cwd(), 'uploads', 'documents');

// Ensure directory exists
if (!fs.existsSync(DOCUMENTS_DIR)) {
  fs.mkdirSync(DOCUMENTS_DIR, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, DOCUMENTS_DIR);
  },
  filename: (_req, file, cb) => {
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

// File filter for allowed document types
const fileFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Check file extension blocklist (defense in depth)
  const ext = path.extname(file.originalname).toLowerCase();
  if (BLOCKED_EXTENSIONS.includes(ext)) {
    cb(new Error(`File extension ${ext} is not allowed for security reasons`));
    return;
  }

  const allowedMimes = [
    // Images
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/tiff', 'image/bmp',
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    // Archives
    'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
    // Design files
    'application/postscript', 'application/illustrator',
    // Text
    'text/plain', 'text/csv',
  ];

  if (allowedMimes.includes(file.mimetype) || file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} not allowed`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max
});

// All routes require authentication
documentsRouter.use(authenticate);

// GET /documents - List documents with filters
documentsRouter.get('/', async (req: AuthRequest, res: Response) => {
  const filters = DocumentFilterSchema.parse(req.query);
  
  const where: Record<string, unknown> = {};
  
  if (filters.category) where.category = filters.category;
  if (filters.customerId) where.customerId = filters.customerId;
  if (filters.orderId) where.orderId = filters.orderId;
  if (filters.quoteId) where.quoteId = filters.quoteId;
  if (filters.vendorId) where.vendorId = filters.vendorId;
  if (filters.subcontractorId) where.subcontractorId = filters.subcontractorId;
  if (filters.isLatest !== undefined) where.isLatest = filters.isLatest;
  
  if (filters.tags && filters.tags.length > 0) {
    where.tags = { hasSome: filters.tags };
  }
  
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { fileName: { contains: filters.search, mode: 'insensitive' } },
      { description: { contains: filters.search, mode: 'insensitive' } },
      { tags: { hasSome: [filters.search] } },
    ];
  }

  const documents = await prisma.document.findMany({
    where,
    include: {
      uploadedBy: { select: { id: true, displayName: true } },
      customer: { select: { id: true, name: true } },
      order: { select: { id: true, orderNumber: true } },
      quote: { select: { id: true, quoteNumber: true } },
      vendor: { select: { id: true, name: true } },
      subcontractor: { select: { id: true, name: true } },
      _count: { select: { versions: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ success: true, data: documents });
});

// GET /documents/categories - Get all categories with counts
documentsRouter.get('/categories', async (_req: AuthRequest, res: Response) => {
  const categories = await prisma.document.groupBy({
    by: ['category'],
    where: { isLatest: true },
    _count: { id: true },
  });

  const result = categories.map(c => ({
    category: c.category,
    count: c._count.id,
  }));

  res.json({ success: true, data: result });
});

// GET /documents/tags - Get all unique tags
documentsRouter.get('/tags', async (_req: AuthRequest, res: Response) => {
  const docs = await prisma.document.findMany({
    where: { isLatest: true },
    select: { tags: true },
  });

  const allTags = new Set<string>();
  docs.forEach(d => d.tags.forEach(t => allTags.add(t)));

  res.json({ success: true, data: Array.from(allTags).sort() });
});

// GET /documents/entity/:entityType/:entityId - Get documents for an entity
documentsRouter.get('/entity/:entityType/:entityId', async (req: AuthRequest, res: Response) => {
  const { entityType, entityId } = req.params;
  
  const where: Record<string, unknown> = { isLatest: true };
  
  switch (entityType) {
    case 'customer':
      where.customerId = entityId;
      break;
    case 'order':
      where.orderId = entityId;
      break;
    case 'quote':
      where.quoteId = entityId;
      break;
    case 'vendor':
      where.vendorId = entityId;
      break;
    case 'subcontractor':
      where.subcontractorId = entityId;
      break;
    default:
      res.status(400).json({ success: false, error: 'Invalid entity type' });
      return;
  }

  const documents = await prisma.document.findMany({
    where,
    include: {
      uploadedBy: { select: { id: true, displayName: true } },
      _count: { select: { versions: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ success: true, data: documents });
});

// GET /documents/:id - Get document by ID
documentsRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const document = await prisma.document.findUnique({
    where: { id },
    include: {
      uploadedBy: { select: { id: true, displayName: true } },
      customer: { select: { id: true, name: true } },
      order: { select: { id: true, orderNumber: true, customerName: true } },
      quote: { select: { id: true, quoteNumber: true, customerName: true } },
      vendor: { select: { id: true, name: true } },
      subcontractor: { select: { id: true, name: true } },
      versions: {
        select: { id: true, version: true, createdAt: true, uploadedBy: { select: { displayName: true } } },
        orderBy: { version: 'desc' },
      },
    },
  });

  if (!document) {
    res.status(404).json({ success: false, error: 'Document not found' });
    return;
  }

  res.json({ success: true, data: document });
});

// GET /documents/:id/download - Download document file
documentsRouter.get('/:id/download', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const document = await prisma.document.findUnique({
    where: { id },
    select: { filePath: true, fileName: true, mimeType: true },
  });

  if (!document) {
    res.status(404).json({ success: false, error: 'Document not found' });
    return;
  }

  const filePath = path.join(DOCUMENTS_DIR, document.filePath);
  
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ success: false, error: 'File not found on disk' });
    return;
  }

  const disposition = req.query.inline === 'true' ? 'inline' : 'attachment';
  res.setHeader('Content-Disposition', `${disposition}; filename="${document.fileName}"`);
  res.setHeader('Content-Type', document.mimeType);
  res.sendFile(filePath);
});

// POST /documents - Upload a new document
documentsRouter.post('/', upload.single('file'), async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const file = req.file;

  if (!file) {
    res.status(400).json({ success: false, error: 'No file uploaded' });
    return;
  }

  try {
    const metadata = UploadDocumentSchema.parse(JSON.parse(req.body.metadata || '{}'));
    
    const document = await prisma.document.create({
      data: {
        name: metadata.name || file.originalname,
        fileName: file.originalname,
        filePath: file.filename,
        fileType: path.extname(file.originalname).toLowerCase(),
        fileSize: file.size,
        mimeType: file.mimetype,
        category: metadata.category as DocumentCategory,
        tags: metadata.tags || [],
        description: metadata.description,
        customerId: metadata.customerId,
        orderId: metadata.orderId,
        quoteId: metadata.quoteId,
        vendorId: metadata.vendorId,
        subcontractorId: metadata.subcontractorId,
        uploadedById: userId,
      },
      include: {
        uploadedBy: { select: { id: true, displayName: true } },
      },
    });

    await logActivity({
      action: ActivityAction.CREATE,
      entityType: EntityType.OTHER,
      entityId: document.id,
      description: `Uploaded document: ${document.name}`,
      userId,
      req,
    });

    broadcast({ type: 'DOCUMENT_UPLOADED', payload: document });

    res.status(201).json({ success: true, data: document });
  } catch (error) {
    // Delete uploaded file on error
    fs.unlinkSync(file.path);
    throw error;
  }
});

// POST /documents/:id/version - Upload new version of existing document
documentsRouter.post('/:id/version', upload.single('file'), async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { id } = req.params;
  const file = req.file;

  if (!file) {
    res.status(400).json({ success: false, error: 'No file uploaded' });
    return;
  }

  const existing = await prisma.document.findUnique({
    where: { id },
    select: { id: true, name: true, category: true, tags: true, description: true, version: true,
      customerId: true, orderId: true, quoteId: true, vendorId: true, subcontractorId: true },
  });

  if (!existing) {
    fs.unlinkSync(file.path);
    res.status(404).json({ success: false, error: 'Document not found' });
    return;
  }

  // Update old document to not be latest
  await prisma.document.update({
    where: { id },
    data: { isLatest: false },
  });

  // Create new version
  const newDoc = await prisma.document.create({
    data: {
      name: existing.name,
      fileName: file.originalname,
      filePath: file.filename,
      fileType: path.extname(file.originalname).toLowerCase(),
      fileSize: file.size,
      mimeType: file.mimetype,
      category: existing.category,
      tags: existing.tags,
      description: existing.description,
      version: existing.version + 1,
      parentId: id,
      isLatest: true,
      customerId: existing.customerId,
      orderId: existing.orderId,
      quoteId: existing.quoteId,
      vendorId: existing.vendorId,
      subcontractorId: existing.subcontractorId,
      uploadedById: userId,
    },
    include: {
      uploadedBy: { select: { id: true, displayName: true } },
    },
  });

  await logActivity({
    action: ActivityAction.UPDATE,
    entityType: EntityType.OTHER,
    entityId: newDoc.id,
    description: `Uploaded version ${newDoc.version} of document: ${newDoc.name}`,
    userId,
    req,
  });

  broadcast({ type: 'DOCUMENT_UPDATED', payload: newDoc });

  res.status(201).json({ success: true, data: newDoc });
});

// PATCH /documents/:id - Update document metadata
documentsRouter.patch('/:id', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { id } = req.params;
  const updates = UpdateDocumentSchema.parse(req.body);

  const document = await prisma.document.update({
    where: { id },
    data: updates,
    include: {
      uploadedBy: { select: { id: true, displayName: true } },
    },
  });

  await logActivity({
    action: ActivityAction.UPDATE,
    entityType: EntityType.OTHER,
    entityId: document.id,
    description: `Updated document: ${document.name}`,
    userId,
    req,
  });

  broadcast({ type: 'DOCUMENT_UPDATED', payload: document });

  res.json({ success: true, data: document });
});

// DELETE /documents/:id - Delete a document
documentsRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { id } = req.params;
  const deleteVersions = req.query.deleteVersions === 'true';

  const document = await prisma.document.findUnique({
    where: { id },
    include: { versions: { select: { id: true, filePath: true } } },
  });

  if (!document) {
    res.status(404).json({ success: false, error: 'Document not found' });
    return;
  }

  // Delete physical files
  const filesToDelete = [document.filePath];
  if (deleteVersions) {
    document.versions.forEach(v => filesToDelete.push(v.filePath));
  }

  for (const fp of filesToDelete) {
    const fullPath = path.join(DOCUMENTS_DIR, fp);
    if (fs.existsSync(fullPath)) {
      try {
        fs.unlinkSync(fullPath);
      } catch (err) {
        console.error('Failed to delete file:', fp, err);
      }
    }
  }

  // Delete from database
  if (deleteVersions) {
    await prisma.document.deleteMany({
      where: { OR: [{ id }, { parentId: id }] },
    });
  } else {
    // If deleting latest, promote previous version to latest
    if (document.isLatest && document.parentId) {
      await prisma.document.update({
        where: { id: document.parentId },
        data: { isLatest: true },
      });
    }
    await prisma.document.delete({ where: { id } });
  }

  await logActivity({
    action: ActivityAction.DELETE,
    entityType: EntityType.OTHER,
    entityId: id,
    description: `Deleted document: ${document.name}${deleteVersions ? ' (and all versions)' : ''}`,
    userId,
    req,
  });

  broadcast({ type: 'DOCUMENT_DELETED', payload: { id } });

  res.json({ success: true, message: 'Document deleted' });
});

// POST /documents/:id/tags - Add tags to document
documentsRouter.post('/:id/tags', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { tags } = req.body as { tags: string[] };

  if (!Array.isArray(tags)) {
    res.status(400).json({ success: false, error: 'Tags must be an array' });
    return;
  }

  const document = await prisma.document.findUnique({
    where: { id },
    select: { tags: true },
  });

  if (!document) {
    res.status(404).json({ success: false, error: 'Document not found' });
    return;
  }

  const newTags = [...new Set([...document.tags, ...tags])];

  const updated = await prisma.document.update({
    where: { id },
    data: { tags: newTags },
  });

  res.json({ success: true, data: updated });
});

// DELETE /documents/:id/tags/:tag - Remove tag from document
documentsRouter.delete('/:id/tags/:tag', async (req: AuthRequest, res: Response) => {
  const { id, tag } = req.params;

  const document = await prisma.document.findUnique({
    where: { id },
    select: { tags: true },
  });

  if (!document) {
    res.status(404).json({ success: false, error: 'Document not found' });
    return;
  }

  const newTags = document.tags.filter(t => t !== tag);

  const updated = await prisma.document.update({
    where: { id },
    data: { tags: newTags },
  });

  res.json({ success: true, data: updated });
});
