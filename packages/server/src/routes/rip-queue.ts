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

import { Router, type Response } from 'express';
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

export const ripQueueRouter = Router();
ripQueueRouter.use(authenticate);

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
    where.OR = [
      { sourceFileName: { contains: search as string, mode: 'insensitive' } },
      { hotfolderName: { contains: search as string, mode: 'insensitive' } },
      { notes: { contains: search as string, mode: 'insensitive' } },
      { workOrder: { orderNumber: { contains: search as string, mode: 'insensitive' } } },
      { workOrder: { customerName: { contains: search as string, mode: 'insensitive' } } },
    ];
  }

  const [jobs, total] = await Promise.all([
    prisma.ripJob.findMany({
      where,
      include: {
        workOrder: {
          select: { id: true, orderNumber: true, customerName: true, description: true, dueDate: true, status: true },
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
          id: true, orderNumber: true, customerName: true,
          description: true, dueDate: true, status: true, companyBrand: true,
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
    timing.queueToRipMinutes = Math.round((new Date(job.rippedAt).getTime() - new Date(job.queuedAt).getTime()) / 60000);
  }
  if (job.printStartedAt && job.rippedAt) {
    timing.ripToPrintMinutes = Math.round((new Date(job.printStartedAt).getTime() - new Date(job.rippedAt).getTime()) / 60000);
  }
  if (job.printCompletedAt && job.printStartedAt) {
    timing.printMinutes = Math.round((new Date(job.printCompletedAt).getTime() - new Date(job.printStartedAt).getTime()) / 60000);
  }
  if (job.printCompletedAt && job.queuedAt) {
    timing.totalMinutes = Math.round((new Date(job.printCompletedAt).getTime() - new Date(job.queuedAt).getTime()) / 60000);
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
    sourceFilePath,
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
  if (!sourceFilePath) throw BadRequestError('sourceFilePath is required');
  if (!hotfolderId) throw BadRequestError('hotfolderId is required');

  // Verify work order exists
  const workOrder = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    select: { id: true, orderNumber: true, customerName: true },
  });
  if (!workOrder) throw NotFoundError('Work order not found');

  // Find the hotfolder target
  const hotfolders = await getHotfoldersWithEquipment();
  const hotfolder = hotfolders.find(hf => hf.id === hotfolderId);
  if (!hotfolder) throw BadRequestError(`Unknown hotfolder: ${hotfolderId}`);

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
    description: `Sent ${sourceFilePath.split(/[/\\]/).pop()} to ${hotfolder.name} (WO ${workOrder.orderNumber})`,
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
      updates: updates.map(u => ({
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
        workOrder: { select: { id: true, orderNumber: true, customerName: true, description: true, dueDate: true } },
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
  const { filePath } = req.body;
  if (!filePath) throw BadRequestError('filePath is required');

  const result = await validateSourceFile(filePath);
  res.json({ success: true, data: result });
});
