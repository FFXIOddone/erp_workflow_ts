/**
 * Production List Routes
 * 
 * API endpoints for the Production List ↔ ERP integration.
 * The ERP operates independently but these routes allow it to
 * complement the Excel Production List workbook.
 * 
 * IMPORTANT: The ERP NEVER modifies the Excel production list files.
 * Data flows one-way: Excel → ERP (read-only from Excel).
 * Sync can be disabled via Settings > Features > Production List Sync.
 * 
 * Endpoints:
 *   GET    /production-list              — View ERP data in production list format
 *   GET    /production-list/summary      — Dashboard summary  
 *   GET    /production-list/current-file — Auto-find next workday file from configured path
 *   POST   /production-list/sync         — Import from Excel spreadsheet (if sync enabled)
 *   POST   /production-list/sync/preview — Dry-run preview of sync (if sync enabled)
 *   POST   /production-list/compare      — Compare spreadsheet vs ERP (read-only)
 *   GET    /production-list/export       — Export ERP data as a SEPARATE Excel file (never touches the source)
 *   GET    /production-list/export/print  — Export printing sub-list
 *   GET    /production-list/history      — Sync history
 *   GET    /production-list/history/:id  — Single sync details
 */

import { Router, type Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { BadRequestError, NotFoundError } from '../middleware/error-handler.js';
import { logActivity, ActivityAction, EntityType } from '../lib/activity-logger.js';
import { buildRouteActivityPayload } from '../lib/route-activity.js';
import { broadcast } from '../ws/server.js';
import { buildRouteBroadcastPayload } from '../lib/route-broadcast.js';
import { prisma } from '../db/client.js';
import {
  ProductionListSyncSchema,
  ProductionListExportSchema,
  ProductionListSection,
} from '@erp/shared';
import {
  parseProductionList,
  compareWithERP,
  syncFromSpreadsheet,
  getProductionListSummary,
  getERPAsProductionListRows,
  getSyncHistory,
} from '../services/production-list.js';
import {
  exportToProductionListFormat,
  exportPrintingSubList,
} from '../services/production-list-export.js';
import {
  getTallyFileInfo,
  validateProductionLists,
} from '../services/production-list-validation.js';

export const productionListRouter = Router();

// ─── File Upload Config ────────────────────────────────────────

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
    cb(null, `prod-list-${timestamp}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xlsm', '.xls'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${ext}. Allowed: .xlsx, .xlsm, .xls`));
    }
  },
});

productionListRouter.use(authenticate);

// ─── Helpers ───────────────────────────────────────────────────

/** Get production list settings from the database */
async function getProductionListSettings() {
  // Note: productionListPath & enableProductionListSync exist in schema.prisma
  // and in the generated .d.ts. If TS shows errors here, restart the TS server
  // (Ctrl+Shift+P → "TypeScript: Restart TS Server") to pick up the regenerated types.
  const settings = await prisma.systemSettings.findFirst({ where: { id: 'system' } }) as any;
  return {
    basePath: (settings?.productionListPath as string) || null,
    syncEnabled: (settings?.enableProductionListSync as boolean) ?? false,
  };
}

/**
 * Find the next workday's Production List file in the configured directory.
 * File naming convention: Production List_MM_dd_yy.xlsm
 * Directory structure: {basePath}/{Month Year}/Production List_MM_dd_yy.xlsm
 * 
 * Looks for today's file first, then the next workday's, then scans
 * for the most recent file in the current month's folder.
 */
function findCurrentProductionListFile(basePath: string): {
  filePath: string;
  fileName: string;
  fileDate: Date;
  fileSize: number;
} | null {
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  // Production lists are always created one day ahead (for the next workday),
  // so try next workday first, then today, then previous workday as fallback.
  const now = new Date();
  const candidates: Date[] = [];

  // Add next workday (most likely — we build tomorrow's list today)
  const next = new Date(now);
  const day = next.getDay();
  if (day === 5) next.setDate(next.getDate() + 3); // Fri → Mon
  else if (day === 6) next.setDate(next.getDate() + 2); // Sat → Mon
  else next.setDate(next.getDate() + 1);
  candidates.push(next);

  // Add today as fallback
  candidates.push(new Date(now));

  // Add previous workday as last resort
  const prev = new Date(now);
  const prevDay = prev.getDay();
  if (prevDay === 0) prev.setDate(prev.getDate() - 2); // Sun → Fri
  else if (prevDay === 1) prev.setDate(prev.getDate() - 3); // Mon → Fri
  else prev.setDate(prev.getDate() - 1);
  candidates.push(prev);

  // Try each candidate date
  for (const date of candidates) {
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const yy = String(date.getFullYear()).slice(-2);
    const monthFolder = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
    const fileName = `Production List_${mm}_${dd}_${yy}.xlsm`;

    // Try with month subfolder
    const withSubfolder = path.join(basePath, monthFolder, fileName);
    if (fs.existsSync(withSubfolder)) {
      const stat = fs.statSync(withSubfolder);
      return { filePath: withSubfolder, fileName, fileDate: date, fileSize: stat.size };
    }

    // Try directly in base path
    const direct = path.join(basePath, fileName);
    if (fs.existsSync(direct)) {
      const stat = fs.statSync(direct);
      return { filePath: direct, fileName, fileDate: date, fileSize: stat.size };
    }
  }

  // Fallback: scan current month folder for the most recent file
  const currentMonthFolder = path.join(basePath, `${monthNames[now.getMonth()]} ${now.getFullYear()}`);
  if (fs.existsSync(currentMonthFolder)) {
    try {
      const files = fs.readdirSync(currentMonthFolder)
        .filter(f => /^Production List_\d{2}_\d{2}_\d{2}\.xlsm$/i.test(f))
        .map(f => {
          const stat = fs.statSync(path.join(currentMonthFolder, f));
          // Parse date from filename: Production List_MM_dd_yy.xlsm
          const match = f.match(/Production List_(\d{2})_(\d{2})_(\d{2})\.xlsm/i);
          let fileDate = stat.mtime;
          if (match) {
            const [, mm, dd, yy] = match;
            fileDate = new Date(2000 + parseInt(yy), parseInt(mm) - 1, parseInt(dd));
          }
          return { filePath: path.join(currentMonthFolder, f), fileName: f, fileDate, fileSize: stat.size };
        })
        .sort((a, b) => b.fileDate.getTime() - a.fileDate.getTime());

      if (files.length > 0) return files[0];
    } catch {
      // Ignore read errors
    }
  }

  return null;
}

// ─── GET /production-list/current-file — Auto-find the current production list ─

productionListRouter.get('/current-file', async (_req: AuthRequest, res: Response) => {
  try {
    const { basePath } = await getProductionListSettings();

    if (!basePath) {
      return res.json({
        success: true,
        data: {
          configured: false,
          message: 'Production List path not configured. Set it in Settings > Features.',
          file: null,
        },
      });
    }

    if (!fs.existsSync(basePath)) {
      return res.json({
        success: true,
        data: {
          configured: true,
          message: `Configured path not found: ${basePath}`,
          file: null,
        },
      });
    }

    const file = findCurrentProductionListFile(basePath);

    res.json({
      success: true,
      data: {
        configured: true,
        basePath,
        file: file ? {
          filePath: file.filePath,
          fileName: file.fileName,
          fileDate: file.fileDate.toISOString(),
          fileSize: file.fileSize,
        } : null,
        message: file
          ? `Found: ${file.fileName}`
          : 'No production list file found for today or adjacent workdays.',
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /production-list — View ERP data in spreadsheet layout ─

productionListRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const sections = req.query.sections
      ? String(req.query.sections).split(',') as ProductionListSection[]
      : undefined;
    const includeCompleted = req.query.includeCompleted === 'true';
    const search = req.query.search ? String(req.query.search) : undefined;

    const rows = await getERPAsProductionListRows({
      sections,
      includeCompleted,
      search,
    });

    // Group by section for the UI
    const grouped: Record<string, typeof rows> = {};
    for (const row of rows) {
      if (!grouped[row.section]) grouped[row.section] = [];
      grouped[row.section].push(row);
    }

    res.json({
      success: true,
      data: {
        rows,
        grouped,
        totalRows: rows.length,
        sections: Object.keys(grouped),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /production-list/summary — Dashboard stats ────────────

productionListRouter.get('/summary', async (_req: AuthRequest, res: Response) => {
  try {
    const summary = await getProductionListSummary();
    res.json({ success: true, data: summary });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /production-list/sync/preview — Dry-run sync ─────────

productionListRouter.post('/sync/preview', upload.single('file'), async (req: AuthRequest, res: Response) => {
  let filePath: string | null = null;

  try {
    const { syncEnabled, basePath } = await getProductionListSettings();
    if (!syncEnabled) {
      throw BadRequestError('Production List sync is disabled. Enable it in Settings > Features.');
    }

    // File upload, explicit server path, or auto-discover from configured path
    if (req.file) {
      filePath = req.file.path;
    } else if (req.body.filePath) {
      filePath = req.body.filePath;
      if (!filePath || !fs.existsSync(filePath)) {
        throw BadRequestError(`File not found: ${filePath}`);
      }
    } else if (req.body.useConfigured === 'true' || req.body.useConfigured === true) {
      if (!basePath) throw BadRequestError('Production List path not configured in Settings.');
      const found = findCurrentProductionListFile(basePath);
      if (!found) throw BadRequestError('No production list file found for today or adjacent workdays.');
      filePath = found.filePath;
    } else {
      throw BadRequestError('No file uploaded and no filePath provided');
    }

    const sections = req.body.sections
      ? (Array.isArray(req.body.sections) ? req.body.sections : [req.body.sections])
      : undefined;

    const result = await syncFromSpreadsheet(filePath, req.userId!, {
      dryRun: true,
      preferSpreadsheet: req.body.preferSpreadsheet === 'true' || req.body.preferSpreadsheet === true,
      sections,
    });

    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  } finally {
    // Clean up uploaded file after preview
    if (req.file && filePath) {
      try { fs.unlinkSync(filePath); } catch {}
    }
  }
});

// ─── POST /production-list/sync — Execute sync ─────────────────

productionListRouter.post('/sync', upload.single('file'), async (req: AuthRequest, res: Response) => {
  let filePath: string | null = null;

  try {
    const { syncEnabled, basePath } = await getProductionListSettings();
    if (!syncEnabled) {
      throw BadRequestError('Production List sync is disabled. Enable it in Settings > Features.');
    }

    if (req.file) {
      filePath = req.file.path;
    } else if (req.body.filePath) {
      filePath = req.body.filePath;
      if (!filePath || !fs.existsSync(filePath)) {
        throw BadRequestError(`File not found: ${filePath}`);
      }
    } else if (req.body.useConfigured === 'true' || req.body.useConfigured === true) {
      if (!basePath) throw BadRequestError('Production List path not configured in Settings.');
      const found = findCurrentProductionListFile(basePath);
      if (!found) throw BadRequestError('No production list file found for today or adjacent workdays.');
      filePath = found.filePath;
    } else {
      throw BadRequestError('No file uploaded and no filePath provided');
    }

    const sections = req.body.sections
      ? (Array.isArray(req.body.sections) ? req.body.sections : [req.body.sections])
      : undefined;

    const result = await syncFromSpreadsheet(filePath, req.userId!, {
      dryRun: false,
      preferSpreadsheet: req.body.preferSpreadsheet === 'true' || req.body.preferSpreadsheet === true,
      sections,
    });

    // Log activity
    await logActivity(
      buildRouteActivityPayload({
        action: ActivityAction.CREATE,
        entityType: EntityType.WORK_ORDER,
        entityId: result.syncId,
        description: `Production List sync: ${result.imported} imported, ${result.updated} updated, ${result.errors} errors`,
        userId: req.userId!,
        req,
      }),
    );

    // Broadcast real-time update
    broadcast(buildRouteBroadcastPayload({
      type: 'PRODUCTION_LIST_SYNCED',
      payload: {
        syncId: result.syncId,
        imported: result.imported,
        updated: result.updated,
        errors: result.errors,
      },
    }));

    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

// ─── POST /production-list/compare — Compare spreadsheet vs ERP ─

productionListRouter.post('/compare', upload.single('file'), async (req: AuthRequest, res: Response) => {
  let filePath: string | null = null;

  try {
    if (req.file) {
      filePath = req.file.path;
    } else if (req.body.filePath) {
      filePath = req.body.filePath;
      if (!filePath || !fs.existsSync(filePath)) {
        throw BadRequestError(`File not found: ${filePath}`);
      }
    } else {
      throw BadRequestError('No file uploaded and no filePath provided');
    }

    const rows = parseProductionList(filePath, {});
    const mappings = await compareWithERP(rows);

    const stats = {
      totalRows: rows.length,
      matched: mappings.filter(m => m.erpOrderId && m.spreadsheetSection).length,
      spreadsheetOnly: mappings.filter(m => !m.erpOrderId).length,
      erpOnly: mappings.filter(m => !m.spreadsheetSection).length,
      withDifferences: mappings.filter(m => m.hasDifferences && m.erpOrderId && m.spreadsheetSection).length,
      identical: mappings.filter(m => !m.hasDifferences).length,
    };

    res.json({
      success: true,
      data: {
        mappings,
        stats,
      },
    });
  } catch (err: any) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  } finally {
    if (req.file && filePath) {
      try { fs.unlinkSync(filePath); } catch {}
    }
  }
});

// ─── GET /production-list/export — Export ERP → Excel ───────────

productionListRouter.get('/export', async (req: AuthRequest, res: Response) => {
  try {
    const format = (req.query.format as string) || 'xlsx';
    const sections = req.query.sections
      ? String(req.query.sections).split(',') as ProductionListSection[]
      : undefined;
    const includeCompleted = req.query.includeCompleted === 'true';
    const includeOnHold = req.query.includeOnHold !== 'false'; // default true

    if (format === 'json') {
      // Return JSON for API consumers
      const rows = await getERPAsProductionListRows({
        sections,
        includeCompleted,
      });
      res.json({ success: true, data: rows });
      return;
    }

    // Generate Excel file
    const { buffer, filename } = await exportToProductionListFormat({
      sections,
      includeCompleted,
      includeOnHold,
      listDate: req.query.listDate ? new Date(String(req.query.listDate)) : undefined,
    });

    // Log activity
    await logActivity(
      buildRouteActivityPayload({
        action: ActivityAction.CREATE,
        entityType: EntityType.WORK_ORDER,
        entityId: filename,
        description: `Exported Production List (${filename})`,
        userId: req.userId!,
        req,
      }),
    );

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /production-list/export/print — Export printing sub-list ─

productionListRouter.get('/export/print', async (req: AuthRequest, res: Response) => {
  try {
    const station = (req.query.station as string || 'RR').toUpperCase();
    if (!['RR', 'FB', 'Z'].includes(station)) {
      throw BadRequestError('Invalid station. Must be RR, FB, or Z');
    }

    const { buffer, filename } = await exportPrintingSubList(station as 'RR' | 'FB' | 'Z');

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err: any) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

// ─── GET /production-list/history — Sync history ────────────────

productionListRouter.get('/history', async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit || '20')), 100);
    const offset = parseInt(String(req.query.offset || '0'));

    const { syncs, total } = await getSyncHistory({ limit, offset });

    res.json({
      success: true,
      data: {
        items: syncs,
        total,
        limit,
        offset,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /production-list/history/:id — Single sync details ─────

productionListRouter.get('/history/:id', async (req: AuthRequest, res: Response) => {
  try {
    const sync = await (prisma as any).productionListSync.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { displayName: true } },
        snapshots: {
          orderBy: { orderNumber: 'asc' },
          take: 500,
        },
      },
    });

    if (!sync) {
      throw NotFoundError('Sync record not found');
    }

    res.json({ success: true, data: sync });
  } catch (err: any) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

// ─── GET /production-list/validation/files — Tally file info for UI card ─────

productionListRouter.get('/validation/files', async (_req: AuthRequest, res: Response) => {
  try {
    const files = await getTallyFileInfo();
    res.json({ success: true, data: files });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /production-list/validation/run — Run cross-validation across tally files ─

productionListRouter.post('/validation/run', async (req: AuthRequest, res: Response) => {
  try {
    const days = parseInt(req.body.days as string) || 28;
    const result = await validateProductionLists(Math.min(days, 90));
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PATCH /production-list/validation/paths — Update tally file paths ───────

productionListRouter.patch('/validation/paths', async (req: AuthRequest, res: Response) => {
  try {
    const { brendaTallyPath, christinaTallyPath, pamTallyPath } = req.body;
    const updates: Record<string, string | null> = {};
    
    if (brendaTallyPath !== undefined) updates.brendaTallyPath = brendaTallyPath || null;
    if (christinaTallyPath !== undefined) updates.christinaTallyPath = christinaTallyPath || null;
    if (pamTallyPath !== undefined) updates.pamTallyPath = pamTallyPath || null;

    if (Object.keys(updates).length === 0) {
      throw BadRequestError('No paths provided to update');
    }

    await prisma.systemSettings.upsert({
      where: { id: 'system' },
      update: updates,
      create: { id: 'system', ...updates } as any,
    });

    res.json({ success: true, message: 'Tally paths updated' });
  } catch (err: any) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});
