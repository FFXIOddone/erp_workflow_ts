import { Router, type Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { BadRequestError } from '../middleware/error-handler.js';
import { importSpreadsheetOrders, parseProductionSpreadsheet } from '../services/spreadsheet-import.js';
import { logActivity, ActivityAction, EntityType } from '../lib/activity-logger.js';
import { broadcast } from '../ws/server.js';
import { prisma } from '../db/client.js';

export const importRouter = Router();

// Configure upload for spreadsheet files
const IMPORT_DIR = process.env.UPLOAD_DIR
  ? path.join(process.env.UPLOAD_DIR, 'imports')
  : path.join(process.cwd(), 'uploads', 'imports');

if (!fs.existsSync(IMPORT_DIR)) {
  fs.mkdirSync(IMPORT_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, IMPORT_DIR),
  filename: (_req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `import-${timestamp}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  fileFilter: (_req, file, cb) => {
    const allowedExtensions = ['.xlsx', '.xlsm', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${ext}. Allowed: ${allowedExtensions.join(', ')}`));
    }
  },
});

importRouter.use(authenticate);

// POST /import/preview - Parse spreadsheet and return preview (dry run)
importRouter.post('/preview', upload.single('file'), async (req: AuthRequest, res: Response) => {
  if (!req.file) {
    throw BadRequestError('No file uploaded');
  }

  try {
    const result = await importSpreadsheetOrders(req.file.path, req.userId!, { dryRun: true });

    res.json({
      success: true,
      data: result,
    });
  } finally {
    // Clean up uploaded file after preview
    fs.unlink(req.file.path, () => {});
  }
});

// POST /import/execute - Parse spreadsheet and import orders
importRouter.post('/execute', upload.single('file'), async (req: AuthRequest, res: Response) => {
  if (!req.file) {
    throw BadRequestError('No file uploaded');
  }

  const userId = req.userId!;

  try {
    const result = await importSpreadsheetOrders(req.file.path, userId, { dryRun: false });

    // Log activity
    await logActivity({
      action: ActivityAction.CREATE,
      entityType: EntityType.WORK_ORDER,
      entityId: 'batch-import',
      entityName: 'Spreadsheet Import',
      description: `Imported ${result.imported} orders from ${req.file.originalname} (${result.updated} updated, ${result.skipped} skipped, ${result.errors} errors)`,
      details: {
        totalRows: result.totalRows,
        imported: result.imported,
        updated: result.updated,
        skipped: result.skipped,
        errors: result.errors,
        fileName: req.file.originalname,
      },
      userId,
      req,
    });

    // Save import history
    await prisma.importHistory.create({
      data: {
        fileName: req.file.originalname,
        totalRows: result.totalRows,
        imported: result.imported,
        updated: result.updated,
        skipped: result.skipped,
        errors: result.errors,
        details: result.details as any,
        userId,
      },
    });

    // Broadcast to refresh order lists
    if (result.imported > 0) {
      broadcast({
        type: 'ORDERS_IMPORTED',
        payload: { count: result.imported },
        timestamp: new Date(),
      });
    }

    res.json({
      success: true,
      data: result,
    });
  } finally {
    // Clean up uploaded file
    fs.unlink(req.file.path, () => {});
  }
});

// POST /import/from-path - Import directly from a server file path (admin only)
importRouter.post('/from-path', async (req: AuthRequest, res: Response) => {
  const { filePath, dryRun = false } = req.body;

  if (!filePath) {
    throw BadRequestError('filePath is required');
  }

  if (!fs.existsSync(filePath)) {
    throw BadRequestError(`File not found: ${filePath}`);
  }

  const userId = req.userId!;
  const result = await importSpreadsheetOrders(filePath, userId, { dryRun });

  if (!dryRun) {
    // Save import history
    await prisma.importHistory.create({
      data: {
        fileName: path.basename(filePath),
        filePath,
        totalRows: result.totalRows,
        imported: result.imported,
        updated: result.updated,
        skipped: result.skipped,
        errors: result.errors,
        details: result.details as any,
        userId,
      },
    });

    if (result.imported > 0 || result.updated > 0) {
      await logActivity({
        action: ActivityAction.CREATE,
        entityType: EntityType.WORK_ORDER,
        entityId: 'batch-import',
        entityName: 'Spreadsheet Import (Server Path)',
        description: `Imported ${result.imported} orders from ${path.basename(filePath)} (${result.updated} updated, ${result.skipped} skipped, ${result.errors} errors)`,
        details: {
          totalRows: result.totalRows,
          imported: result.imported,
          updated: result.updated,
          skipped: result.skipped,
          errors: result.errors,
          filePath,
        },
        userId,
        req,
      });

      broadcast({
        type: 'ORDERS_IMPORTED',
        payload: { count: result.imported },
        timestamp: new Date(),
      });
    }
  }

  res.json({
    success: true,
    data: result,
  });
});

// GET /import/history - Get import history
importRouter.get('/history', async (req: AuthRequest, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = parseInt(req.query.offset as string) || 0;

  const [history, total] = await Promise.all([
    prisma.importHistory.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        user: { select: { id: true, displayName: true, username: true } },
      },
    }),
    prisma.importHistory.count(),
  ]);

  res.json({
    success: true,
    data: history,
    pagination: { total, limit, offset },
  });
});

// GET /import/history/:id - Get a specific import's details
importRouter.get('/history/:id', async (req: AuthRequest, res: Response) => {
  const record = await prisma.importHistory.findUnique({
    where: { id: req.params.id },
    include: {
      user: { select: { id: true, displayName: true, username: true } },
    },
  });

  if (!record) {
    throw BadRequestError('Import record not found');
  }

  res.json({
    success: true,
    data: record,
  });
});
