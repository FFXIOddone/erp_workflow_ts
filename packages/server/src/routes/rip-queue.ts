/**
 * RIP Queue Routes
 *
 * API endpoints for the RIP Queue integration.
 * Manages the flow of print files from the ERP into RIP hotfolders
 * and tracks their lifecycle through to completion.
 *
 * Endpoints:
 *   GET    /rip-queue/hotfolders         — List available RIP hotfolder targets
 *   GET    /rip-queue/jobs               — List RIP jobs with filters
 *   GET    /rip-queue/jobs/:id           — Get a single RIP job
 *   POST   /rip-queue/jobs               — Send a file to a RIP hotfolder
 *   PUT    /rip-queue/jobs/:id/status    — Manually update RIP job status
 *   PUT    /rip-queue/jobs/:id/settings  — Update print settings on a RIP job
 *   DELETE /rip-queue/jobs/:id           — Cancel/delete a RIP job
 *   POST   /rip-queue/sync              — Trigger Thrive queue scan & status sync
 *   GET    /rip-queue/kpis              — RIP queue KPI metrics
 *   GET    /rip-queue/dashboard         — Dashboard summary
 *   POST   /rip-queue/validate-file     — Validate a source file path
 */

import path from 'path';
import { createReadStream } from 'fs';
import { promises as fs } from 'fs';
import { Router, type Request, type Response } from 'express';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { BadRequestError, NotFoundError } from '../middleware/error-handler.js';
import { prisma } from '../db/client.js';
import { broadcast } from '../ws/server.js';
import { logActivity, ActivityAction, EntityType } from '../lib/activity-logger.js';
import {
  getAvailableHotfolders,
  getHotfoldersWithEquipment,
  sendToRip,
  syncRipJobStatuses,
  calculateKPIs,
  validateSourceFile,
} from '../services/rip-queue.js';
import {
  getHHGlobalBatches,
  validateBatchFiles,
} from '../services/batch-rip-hh-global.js';
import {
  discoverFieryCapabilities,
  getEffectiveVutekSettings,
  discoverVutekJmfUrl,
  testVutekShareAccess,
  getVutekQueueStatus,
  discoverFieryWorkflows,
  submitVutekJob,
  VUTEK_JOB_DIR,
} from '../services/fiery-jmf.js';
import { buildTokenizedSearchWhere } from '../lib/fuzzy-search.js';

export const ripQueueRouter = Router();

/**
 * GET /rip-queue/vutek-files/:filename
 * Public (no auth) — serves staged VUTEk job files (PDF + JDF) to the VUTEk JDF Connector.
 * The JDF Connector downloads these over HTTP as part of SubmitQueueEntry processing.
 */
ripQueueRouter.get('/vutek-files/:filename', async (req: Request, res: Response) => {
  const { filename } = req.params;
  // Prevent path traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    res.status(400).send('Invalid filename');
    return;
  }
  const filePath = path.join(VUTEK_JOB_DIR, filename);
  try {
    await fs.access(filePath);
  } catch {
    res.status(404).send('Not found');
    return;
  }
  const stat = await fs.stat(filePath);
  const ext = path.extname(filename).toLowerCase();
  const contentType =
    ext === '.pdf'
      ? 'application/pdf'
      : ext === '.jdf'
        ? 'application/vnd.cip4-jdf+xml'
        : 'application/octet-stream';
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Length', stat.size);
  createReadStream(filePath).pipe(res);
});

ripQueueRouter.use(authenticate);

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
const PRINT_FILE_PATTERN = /\.(pdf|eps|ai|psd|tif|tiff|png|jpg|jpeg)$/i;

const LINK_CONFIDENCE_SCORES: Record<string, number> = {
  NONE: 0,
  LOW: 100,
  MEDIUM: 200,
  HIGH: 300,
  CONFIRMED: 400,
};

const FILE_CHAIN_STATUS_SCORES: Record<string, number> = {
  DESIGN: 10,
  SENT_TO_RIP: 20,
  RIPPING: 30,
  READY_TO_PRINT: 40,
  PRINTING: 50,
  PRINTED: 60,
};

const ATTACHMENT_TYPE_SCORES: Record<string, number> = {
  ARTWORK: 300,
  PROOF: 200,
  OTHER: 100,
};

function isAbsoluteOrUncPath(filePath: string): boolean {
  return path.isAbsolute(filePath) || filePath.startsWith('\\\\');
}

function resolveStoredAttachmentPath(storedPath: string): string {
  return isAbsoluteOrUncPath(storedPath)
    ? storedPath
    : path.resolve(UPLOAD_DIR, path.basename(storedPath));
}

async function resolveAttachmentSource(attachment: {
  fileName: string | null;
  filePath: string | null;
}): Promise<{ sourceFilePath: string; displayFileName: string }> {
  const storedPath = attachment.filePath?.trim();
  if (!storedPath) {
    throw BadRequestError('Attachment has no file path');
  }

  const resolvedPath = resolveStoredAttachmentPath(storedPath);
  return {
    sourceFilePath: resolvedPath,
    displayFileName: attachment.fileName || path.basename(resolvedPath),
  };
}

async function resolveAutoRipSourceFile(
  workOrderId: string
): Promise<{ sourceFilePath: string; displayFileName: string }> {
  const [printCutLinks, attachments] = await Promise.all([
    prisma.printCutLink.findMany({
      where: { workOrderId },
      select: {
        printFileName: true,
        printFilePath: true,
        linkConfidence: true,
        status: true,
        confirmed: true,
        ripJobId: true,
        updatedAt: true,
      },
    }),
    prisma.orderAttachment.findMany({
      where: { orderId: workOrderId },
      select: {
        id: true,
        fileName: true,
        filePath: true,
        fileType: true,
        uploadedAt: true,
      },
    }),
  ]);

  const candidates = [
    ...printCutLinks
      .filter((link) => Boolean(link.printFilePath?.trim()))
      .map((link) => ({
        sourceFilePath: link.printFilePath.trim(),
        displayFileName: link.printFileName?.trim() || path.basename(link.printFilePath.trim()),
        score:
          1000 +
          (link.confirmed ? 500 : 0) +
          (LINK_CONFIDENCE_SCORES[link.linkConfidence] || 0) +
          (FILE_CHAIN_STATUS_SCORES[link.status] || 0) +
          (link.ripJobId ? 25 : 0),
        timestamp: link.updatedAt.getTime(),
      })),
    ...attachments
      .filter((attachment) => {
        const storedPath = attachment.filePath?.trim();
        if (!storedPath) return false;
        const fileName = attachment.fileName || path.basename(storedPath);
        return (
          Boolean(ATTACHMENT_TYPE_SCORES[attachment.fileType]) || PRINT_FILE_PATTERN.test(fileName)
        );
      })
      .map((attachment) => {
        const resolved = resolveStoredAttachmentPath(attachment.filePath.trim());
        const fileName = attachment.fileName || path.basename(resolved);
        return {
          sourceFilePath: resolved,
          displayFileName: fileName,
          score:
            (ATTACHMENT_TYPE_SCORES[attachment.fileType] || 0) +
            (PRINT_FILE_PATTERN.test(fileName) ? 50 : 0) +
            (isAbsoluteOrUncPath(attachment.filePath) ? 25 : 0),
          timestamp: attachment.uploadedAt.getTime(),
        };
      }),
  ].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.timestamp - a.timestamp;
  });

  for (const candidate of candidates) {
    const validation = await validateSourceFile(candidate.sourceFilePath);
    if (validation.valid) {
      return {
        sourceFilePath: candidate.sourceFilePath,
        displayFileName: candidate.displayFileName,
      };
    }
  }

  throw BadRequestError('No accessible print files or attachments were found for this work order');
}

async function resolveRipSourceFile(params: {
  workOrderId?: string;
  sourceFilePath?: string | null;
  attachmentId?: string | null;
}): Promise<{ sourceFilePath: string; displayFileName: string }> {
  const directPath = params.sourceFilePath?.trim();
  if (directPath) {
    return {
      sourceFilePath: directPath,
      displayFileName: path.basename(directPath),
    };
  }

  if (!params.attachmentId) {
    if (!params.workOrderId) {
      throw BadRequestError('sourceFilePath, attachmentId, or workOrderId is required');
    }
    return resolveAutoRipSourceFile(params.workOrderId);
  }

  const attachment = await prisma.orderAttachment.findFirst({
    where: {
      id: params.attachmentId,
      ...(params.workOrderId ? { orderId: params.workOrderId } : {}),
    },
    select: {
      fileName: true,
      filePath: true,
    },
  });

  if (!attachment) {
    throw NotFoundError('Attachment not found');
  }

  return resolveAttachmentSource(attachment);
}

// ─── Hotfolders ───────────────────────────────────────────────

/**
 * GET /rip-queue/hotfolders
 * List available RIP hotfolder targets (printers you can send files to).
 */
ripQueueRouter.get('/hotfolders', async (_req: AuthRequest, res: Response) => {
  const hotfolders = await getHotfoldersWithEquipment();
  res.json({ success: true, data: hotfolders });
});

// ─── RIP Jobs ─────────────────────────────────────────────────

/**
 * GET /rip-queue/jobs
 * List RIP jobs with optional filters.
 */
ripQueueRouter.get('/jobs', async (req: AuthRequest, res: Response) => {
  const {
    workOrderId,
    status,
    equipmentId,
    ripType,
    fromDate,
    toDate,
    search,
    limit = '50',
    offset = '0',
  } = req.query;

  const where: Record<string, unknown> = {};

  if (workOrderId) where.workOrderId = workOrderId;
  if (equipmentId) where.equipmentId = equipmentId;
  if (ripType) where.ripType = ripType;

  if (status) {
    const statuses = (status as string).split(',');
    where.status = statuses.length === 1 ? statuses[0] : { in: statuses };
  }

  if (fromDate || toDate) {
    where.queuedAt = {
      ...(fromDate ? { gte: new Date(fromDate as string) } : {}),
      ...(toDate ? { lte: new Date(toDate as string) } : {}),
    };
  }

  if (search) {
    const searchWhere = buildTokenizedSearchWhere(search as string, [
      'sourceFileName',
      'hotfolderName',
      'notes',
      'workOrder.orderNumber',
      'workOrder.customerName',
    ]);
    if (searchWhere) {
      Object.assign(where, searchWhere);
    }
  }

  const [jobs, total] = await Promise.all([
    prisma.ripJob.findMany({
      where,
      include: {
        workOrder: {
          select: {
            id: true,
            orderNumber: true,
            customerName: true,
            description: true,
            dueDate: true,
            status: true,
          },
        },
        equipment: { select: { id: true, name: true, station: true } },
        createdBy: { select: { id: true, username: true, displayName: true } },
        operator: { select: { id: true, username: true, displayName: true } },
        printJob: { select: { id: true, jobNumber: true, status: true } },
      },
      orderBy: [{ priority: 'asc' }, { queuedAt: 'desc' }],
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    }),
    prisma.ripJob.count({ where }),
  ]);

  res.json({ success: true, data: jobs, total });
});

/**
 * GET /rip-queue/jobs/:id
 * Get a single RIP job with full details.
 */
ripQueueRouter.get('/jobs/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const job = await prisma.ripJob.findUnique({
    where: { id },
    include: {
      workOrder: {
        select: {
          id: true,
          orderNumber: true,
          customerName: true,
          description: true,
          dueDate: true,
          status: true,
          companyBrand: true,
        },
      },
      equipment: { select: { id: true, name: true, station: true, status: true } },
      createdBy: { select: { id: true, username: true, displayName: true } },
      operator: { select: { id: true, username: true, displayName: true } },
      printJob: { select: { id: true, jobNumber: true, status: true, name: true } },
    },
  });

  if (!job) throw NotFoundError('RIP job not found');

  // Calculate timing KPIs for this job
  const timing: Record<string, number | null> = {};
  if (job.rippedAt && job.queuedAt) {
    timing.queueToRipMinutes = Math.round(
      (new Date(job.rippedAt).getTime() - new Date(job.queuedAt).getTime()) / 60000
    );
  }
  if (job.printStartedAt && job.rippedAt) {
    timing.ripToPrintMinutes = Math.round(
      (new Date(job.printStartedAt).getTime() - new Date(job.rippedAt).getTime()) / 60000
    );
  }
  if (job.printCompletedAt && job.printStartedAt) {
    timing.printMinutes = Math.round(
      (new Date(job.printCompletedAt).getTime() - new Date(job.printStartedAt).getTime()) / 60000
    );
  }
  if (job.printCompletedAt && job.queuedAt) {
    timing.totalMinutes = Math.round(
      (new Date(job.printCompletedAt).getTime() - new Date(job.queuedAt).getTime()) / 60000
    );
  }

  res.json({ success: true, data: { ...job, timing } });
});

/**
 * POST /rip-queue/jobs
 * Send a file to a RIP hotfolder. Creates a tracking RipJob record.
 */
ripQueueRouter.post('/jobs', async (req: AuthRequest, res: Response) => {
  const {
    workOrderId,
    sourceFilePath: rawSourceFilePath,
    attachmentId,
    hotfolderId,
    // Print settings
    colorProfile,
    printResolution,
    printMode,
    mediaProfile,
    mediaType,
    mediaWidth,
    mediaLength,
    copies,
    whiteInk,
    mirror,
    nestingEnabled,
    additionalSettings,
    // Metadata
    notes,
    priority,
  } = req.body;

  if (!workOrderId) throw BadRequestError('workOrderId is required');
  if (!rawSourceFilePath && !attachmentId && !workOrderId) {
    throw BadRequestError('workOrderId is required');
  }
  if (!hotfolderId) throw BadRequestError('hotfolderId is required');

  // Verify work order exists
  const workOrder = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    select: { id: true, orderNumber: true, customerName: true },
  });
  if (!workOrder) throw NotFoundError('Work order not found');

  // Find the hotfolder target
  const hotfolders = await getHotfoldersWithEquipment();
  const hotfolder = hotfolders.find((hf) => hf.id === hotfolderId);
  if (!hotfolder) throw BadRequestError(`Unknown hotfolder: ${hotfolderId}`);

  const { sourceFilePath, displayFileName } = await resolveRipSourceFile({
    workOrderId,
    sourceFilePath: rawSourceFilePath,
    attachmentId,
  });

  // Send to RIP
  const result = await sendToRip({
    workOrderId,
    sourceFilePath,
    hotfolderTarget: hotfolder,
    printSettings: {
      colorProfile,
      printResolution,
      printMode,
      mediaProfile,
      mediaType,
      mediaWidth,
      mediaLength,
      copies,
      whiteInk,
      mirror,
      nestingEnabled,
      additionalSettings,
    },
    notes,
    priority,
    userId: req.userId!,
  });

  if (!result.success) {
    throw BadRequestError(result.error || 'Failed to send file to RIP');
  }

  // Log activity
  await logActivity({
    action: ActivityAction.CREATE,
    entityType: EntityType.WORK_ORDER,
    entityId: result.ripJobId!,
    entityName: `RIP Job → ${hotfolder.name}`,
    description: `Sent ${displayFileName} to ${hotfolder.name} (WO ${workOrder.orderNumber})`,
    userId: req.userId!,
    req,
  });

  // Fetch the created job for response
  const ripJob = await prisma.ripJob.findUnique({
    where: { id: result.ripJobId! },
    include: {
      workOrder: { select: { id: true, orderNumber: true, customerName: true } },
      equipment: { select: { id: true, name: true, station: true } },
      createdBy: { select: { id: true, username: true, displayName: true } },
    },
  });

  res.status(201).json({ success: true, data: ripJob });
});

/**
 * PUT /rip-queue/jobs/:id/status
 * Manually update the status of a RIP job.
 */
ripQueueRouter.put('/jobs/:id/status', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { status, notes, errorMessage } = req.body;

  if (!status) throw BadRequestError('status is required');

  const existing = await prisma.ripJob.findUnique({ where: { id } });
  if (!existing) throw NotFoundError('RIP job not found');

  const now = new Date();
  const updateData: Record<string, unknown> = { status };

  // Set timestamps based on transition
  if (status === 'PROCESSING' && existing.status === 'QUEUED') {
    // RIP started processing
  }
  if (status === 'READY' && !existing.rippedAt) {
    updateData.rippedAt = now;
  }
  if (status === 'PRINTING' && !existing.printStartedAt) {
    updateData.sentToPrinterAt = existing.sentToPrinterAt ?? now;
    updateData.printStartedAt = now;
  }
  if (status === 'PRINTED' && !existing.printCompletedAt) {
    updateData.printCompletedAt = now;
  }
  if (status === 'COMPLETED' && !existing.printCompletedAt) {
    updateData.printCompletedAt = now;
  }
  if (status === 'CANCELLED') {
    updateData.cancelledAt = now;
  }
  if (status === 'FAILED') {
    updateData.errorMessage = errorMessage || 'Manually marked as failed';
  }
  if (notes) {
    updateData.notes = notes;
  }

  const job = await prisma.ripJob.update({
    where: { id },
    data: updateData,
    include: {
      workOrder: { select: { id: true, orderNumber: true, customerName: true } },
      equipment: { select: { id: true, name: true, station: true } },
      createdBy: { select: { id: true, username: true, displayName: true } },
    },
  });

  await logActivity({
    action: ActivityAction.UPDATE,
    entityType: EntityType.WORK_ORDER,
    entityId: job.id,
    description: `RIP job status → ${status} (WO ${job.workOrder.orderNumber})`,
    userId: req.userId!,
    req,
  });

  broadcast({
    type: 'RIP_JOB_STATUS_CHANGED',
    payload: { ...job, previousStatus: existing.status },
    timestamp: new Date(),
  });

  res.json({ success: true, data: job });
});

/**
 * PUT /rip-queue/jobs/:id/settings
 * Update print settings on a RIP job (before or during processing).
 */
ripQueueRouter.put('/jobs/:id/settings', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const {
    colorProfile,
    printResolution,
    printMode,
    mediaProfile,
    mediaType,
    mediaWidth,
    mediaLength,
    copies,
    whiteInk,
    mirror,
    nestingEnabled,
    additionalSettings,
  } = req.body;

  const existing = await prisma.ripJob.findUnique({ where: { id } });
  if (!existing) throw NotFoundError('RIP job not found');

  // Only allow settings changes on jobs that haven't started printing
  if (['PRINTING', 'PRINTED', 'COMPLETED'].includes(existing.status)) {
    throw BadRequestError('Cannot change print settings on a job that has already printed');
  }

  const updateData: Record<string, unknown> = {};
  if (colorProfile !== undefined) updateData.colorProfile = colorProfile;
  if (printResolution !== undefined) updateData.printResolution = printResolution;
  if (printMode !== undefined) updateData.printMode = printMode;
  if (mediaProfile !== undefined) updateData.mediaProfile = mediaProfile;
  if (mediaType !== undefined) updateData.mediaType = mediaType;
  if (mediaWidth !== undefined) updateData.mediaWidth = mediaWidth;
  if (mediaLength !== undefined) updateData.mediaLength = mediaLength;
  if (copies !== undefined) updateData.copies = copies;
  if (whiteInk !== undefined) updateData.whiteInk = whiteInk;
  if (mirror !== undefined) updateData.mirror = mirror;
  if (nestingEnabled !== undefined) updateData.nestingEnabled = nestingEnabled;
  if (additionalSettings !== undefined) updateData.printSettingsJson = additionalSettings;

  const job = await prisma.ripJob.update({
    where: { id },
    data: updateData,
    include: {
      workOrder: { select: { id: true, orderNumber: true, customerName: true } },
      equipment: { select: { id: true, name: true, station: true } },
    },
  });

  broadcast({ type: 'RIP_JOB_UPDATED', payload: job, timestamp: new Date() });
  res.json({ success: true, data: job });
});

/**
 * DELETE /rip-queue/jobs/:id
 * Cancel/delete a RIP job. Only allowed for non-printing jobs.
 */
ripQueueRouter.delete('/jobs/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const existing = await prisma.ripJob.findUnique({
    where: { id },
    include: { workOrder: { select: { orderNumber: true } } },
  });
  if (!existing) throw NotFoundError('RIP job not found');

  if (['PRINTING'].includes(existing.status)) {
    throw BadRequestError('Cannot delete a job that is currently printing. Cancel it first.');
  }

  // If not yet completed, mark as cancelled instead of deleting
  if (!['COMPLETED', 'PRINTED', 'FAILED', 'CANCELLED'].includes(existing.status)) {
    await prisma.ripJob.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
  } else {
    await prisma.ripJob.delete({ where: { id } });
  }

  await logActivity({
    action: ActivityAction.DELETE,
    entityType: EntityType.WORK_ORDER,
    entityId: id,
    description: `RIP job cancelled/deleted (WO ${existing.workOrder.orderNumber})`,
    userId: req.userId!,
    req,
  });

  broadcast({ type: 'RIP_JOB_DELETED', payload: { id }, timestamp: new Date() });
  res.json({ success: true });
});

// ─── Sync & Monitoring ────────────────────────────────────────

/**
 * POST /rip-queue/sync
 * Trigger a scan of all Thrive queues and update RIP job statuses.
 */
ripQueueRouter.post('/sync', async (_req: AuthRequest, res: Response) => {
  const updates = await syncRipJobStatuses();
  res.json({
    success: true,
    data: {
      updatedCount: updates.length,
      updates: updates.map((u) => ({
        ripJobId: u.ripJobId,
        oldStatus: u.oldStatus,
        newStatus: u.newStatus,
      })),
    },
  });
});

// ─── KPIs & Dashboard ────────────────────────────────────────

/**
 * GET /rip-queue/kpis
 * RIP queue KPI metrics (timing averages, counts).
 */
ripQueueRouter.get('/kpis', async (req: AuthRequest, res: Response) => {
  const { fromDate, toDate, equipmentId } = req.query;

  const kpis = await calculateKPIs({
    fromDate: fromDate ? new Date(fromDate as string) : undefined,
    toDate: toDate ? new Date(toDate as string) : undefined,
    equipmentId: equipmentId as string | undefined,
  });

  res.json({ success: true, data: kpis });
});

/**
 * GET /rip-queue/dashboard
 * Dashboard summary: active jobs, hotfolder status, KPIs, recent activity.
 */
ripQueueRouter.get('/dashboard', async (_req: AuthRequest, res: Response) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [hotfolders, activeJobs, recentCompleted, kpis] = await Promise.all([
    getHotfoldersWithEquipment(),
    prisma.ripJob.findMany({
      where: { status: { in: ['QUEUED', 'PROCESSING', 'READY', 'SENDING', 'PRINTING'] } },
      include: {
        workOrder: {
          select: {
            id: true,
            orderNumber: true,
            customerName: true,
            description: true,
            dueDate: true,
          },
        },
        equipment: { select: { id: true, name: true, station: true } },
        createdBy: { select: { id: true, username: true, displayName: true } },
      },
      orderBy: [{ priority: 'asc' }, { queuedAt: 'desc' }],
    }),
    prisma.ripJob.findMany({
      where: { status: { in: ['PRINTED', 'COMPLETED'] }, printCompletedAt: { gte: today } },
      include: {
        workOrder: { select: { id: true, orderNumber: true, customerName: true } },
        equipment: { select: { id: true, name: true } },
      },
      orderBy: { printCompletedAt: 'desc' },
      take: 20,
    }),
    calculateKPIs(),
  ]);

  res.json({
    success: true,
    data: {
      hotfolders,
      activeJobs,
      recentCompleted,
      kpis,
    },
  });
});

// ─── Utility ──────────────────────────────────────────────────

/**
 * POST /rip-queue/validate-file
 * Validate that a source file path is accessible.
 */
ripQueueRouter.post('/validate-file', async (req: AuthRequest, res: Response) => {
  const { filePath, attachmentId, workOrderId } = req.body;
  if (!filePath && !attachmentId && !workOrderId) {
    throw BadRequestError('filePath, attachmentId, or workOrderId is required');
  }

  const resolved = await resolveRipSourceFile({
    workOrderId,
    sourceFilePath: filePath,
    attachmentId,
  });
  const result = await validateSourceFile(resolved.sourceFilePath);
  res.json({
    success: true,
    data: {
      ...result,
      fileName: resolved.displayFileName,
      resolvedPath: resolved.sourceFilePath,
    },
  });
});

/**
 * POST /rip-queue/batches/hh-global
 * Submit HH Global orders as batches grouped by material and size
 */
ripQueueRouter.post('/batches/hh-global', async (req: AuthRequest, res: Response) => {
  try {
    // Get all HH Global orders ready for FLATBED RIP
    const batches = await getHHGlobalBatches();

    if (batches.length === 0) {
      return res.json({
        success: true,
        batchesSubmitted: 0,
        jobsCreated: 0,
        results: [],
        message: 'No HH Global orders ready for RIP',
      });
    }

    const fieryHotfolders = await getHotfoldersWithEquipment();
    const fieryHotfolder = fieryHotfolders.find(
      (h) => h.ripType === 'Fiery' && h.station === 'FLATBED'
    );
    if (!fieryHotfolder) {
      throw NotFoundError('Fiery hotfolder not configured');
    }

    // Validate that all orders have printable files
    const allOrderIds = batches.flatMap((b) => b.orderIds);
    const { valid, missing } = await validateBatchFiles(allOrderIds);

    if (missing.length > 0) {
      return res.json({
        success: false,
        error: `${missing.length} orders missing PDF files`,
        ordersWithoutFiles: missing,
        batchesSubmitted: 0,
        jobsCreated: 0,
      });
    }

    // Submit each batch to RIP
    const results: any[] = [];
    let totalJobsCreated = 0;

    for (const batch of batches) {
      const batchResults: any[] = [];

      for (const orderId of batch.orderIds) {
        try {
          // Resolve the best accessible print file for this order.
          // resolveAutoRipSourceFile considers PrintCutLinks (highest priority),
          // then attachments with proper path resolution, and validates each
          // candidate is actually reachable on disk before selecting it.
          const { sourceFilePath, displayFileName } = await resolveAutoRipSourceFile(orderId);

          // Send to RIP
          const jobResult = await sendToRip({
            workOrderId: orderId,
            sourceFilePath,
            hotfolderTarget: fieryHotfolder,
            printSettings: {
              mediaProfile: batch.material,
              mediaType: batch.material,
              additionalSettings: {
                batchGroup: `${batch.material}_${batch.size}`,
                wobbler: batch.wobbler,
              },
            },
            notes: `Batch: ${batch.description}`,
            userId: req.user!.id,
          });

          if (jobResult.success) {
            batchResults.push({
              orderId,
              status: 'submitted',
              jobId: jobResult.ripJobId,
            });
            totalJobsCreated++;
          } else {
            batchResults.push({
              orderId,
              status: 'failed',
              error: jobResult.error || 'Unknown error',
            });
          }
        } catch (orderError) {
          batchResults.push({
            orderId,
            status: 'failed',
            error: orderError instanceof Error ? orderError.message : 'Unknown error',
          });
        }
      }

      results.push({
        batchKey: `${batch.material}|${batch.size}${batch.wobbler ? '|wobbler' : ''}`,
        description: batch.description,
        orderCount: batch.orderIds.length,
        jobsCreated: batchResults.filter((r) => r.status === 'submitted').length,
        orderResults: batchResults,
      });
    }

    // Log activity
    await logActivity({
      userId: req.user!.id,
      entityType: EntityType.OTHER,
      entityId: '',
      action: ActivityAction.CREATE,
      description: `Submitted ${batches.length} HH Global batches to RIP`,
      details: {
        batchesSubmitted: batches.length,
        jobsCreated: totalJobsCreated,
      },
    });

    // Broadcast update
    broadcast({
      type: 'RIP_BATCH_SUBMITTED',
      payload: {
        batchesSubmitted: batches.length,
        jobsCreated: totalJobsCreated,
        timestamp: new Date(),
      },
    });

    res.json({
      success: true,
      batchesSubmitted: batches.length,
      jobsCreated: totalJobsCreated,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to submit HH Global batches';
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

/**
 * GET /rip-queue/fiery/diagnostics
 * Run connectivity checks against the VUTEk/Fiery system.
 * Returns share accessibility, JMF endpoint discovery, and queue status.
 */
ripQueueRouter.get('/fiery/diagnostics', async (_req: AuthRequest, res: Response) => {
  const [shareResult, discovery, queueStatus, workflowDiscovery, capabilities, settings] = await Promise.all([
    testVutekShareAccess(),
    discoverVutekJmfUrl(),
    getVutekQueueStatus(),
    discoverFieryWorkflows(),
    discoverFieryCapabilities(),
    prisma.systemSettings.findFirst({
      where: { id: 'system' },
      select: { fieryWorkflowName: true },
    }),
  ]);
  const effective = getEffectiveVutekSettings({
    outputChannelName: settings?.fieryWorkflowName ?? undefined,
  });

  res.json({
    success: true,
    data: {
      share: {
        path: '\\\\192.168.254.57\\Users\\Public\\Documents\\VUTEk Jobs',
        accessible: shareResult.accessible,
        writable: shareResult.writable,
        error: shareResult.error ?? null,
      },
      jmf: {
        host: '192.168.254.57',
        port: 8010,
        discoveredUrl: discovery.url,
        autoDiscovered: discovery.discovered,
        discoveryRaw: discovery.raw ?? null,
      },
      queue: {
        status: queueStatus.status,
        queueSize: queueStatus.queueSize,
        jobId: queueStatus.jobId ?? null,
        queueEntryId: queueStatus.queueEntryId ?? null,
        raw: queueStatus.raw ?? null,
      },
      workflow: {
        outputChannelName: effective.outputChannelName,
        colorMode: effective.colorMode,
        inkType: effective.inkType,
        whiteInkOptions: effective.whiteInkOptions,
        discoveredWorkflows: workflowDiscovery.workflows,
        discoverySource: workflowDiscovery.source,
        discoveryError: workflowDiscovery.error ?? null,
        hint:
          workflowDiscovery.workflows.length > 0
            ? `Found ${workflowDiscovery.workflows.length} workflow(s). Use the Workflow dropdown to choose the controller default: ${workflowDiscovery.workflows.join(', ')}`
            : 'Plain hotfolder imports still work with controller defaults. The Workflow dropdown only affects Fiery controller/JMF submissions.',
      },
      media: {
        media: effective.media,
        mediaType: effective.mediaType,
        mediaUnit: effective.mediaUnit,
        mediaDimension: effective.mediaDimension,
        resolution: effective.resolution,
        whiteInkEnabled: effective.whiteInk,
      },
      capabilities: {
        workflows: capabilities.workflows,
        colorModes: capabilities.colorModes,
        inkTypes: capabilities.inkTypes,
        whiteInkOptions: capabilities.whiteInkOptions,
        source: capabilities.source,
        error: capabilities.error ?? null,
      },
    },
  });
});

/**
 * GET /rip-queue/fiery/queue-status
 * Return the live VUTEk print queue status via JMF QueueStatus query.
 */
ripQueueRouter.get('/fiery/queue-status', async (_req: AuthRequest, res: Response) => {
  const result = await getVutekQueueStatus();
  res.json({ success: true, data: result });
});

/**
 * GET /rip-queue/fiery/workflows
 * Scan ProgramData share + EFI Export Folder to discover Fiery XF workflow names.
 */
ripQueueRouter.get('/fiery/workflows', async (_req: AuthRequest, res: Response) => {
  const result = await discoverFieryWorkflows();
  res.json({ success: true, data: result });
});

/**
 * POST /rip-queue/fiery/test-submit
 * Legacy diagnostic: submit a test JDF job to the VUTEk using a PDF already on the VUTEk Jobs share.
 * Body: { pdfFilename: string } — filename of an existing PDF in the VUTEk Jobs share
 */
ripQueueRouter.post('/fiery/test-submit', async (req: AuthRequest, res: Response) => {
  const { pdfFilename, outputChannelName } = req.body as {
    pdfFilename?: string;
    outputChannelName?: string;
  };
  if (!pdfFilename) {
    throw BadRequestError('pdfFilename is required');
  }
  const shareRoot = '\\\\192.168.254.57\\Users\\Public\\Documents\\VUTEk Jobs';
  const sourcePath = path.join(shareRoot, pdfFilename);
  const persistedWorkflow = await prisma.systemSettings.findFirst({
    where: { id: 'system' },
    select: { fieryWorkflowName: true },
  });
  const result = await submitVutekJob({
    jobId: `TEST-${Date.now()}`,
    sourceFilePath: sourcePath,
    settings: {
      outputChannelName:
        outputChannelName?.trim() || persistedWorkflow?.fieryWorkflowName || undefined,
    },
  });
  res.json({ success: result.success, data: result });
});
