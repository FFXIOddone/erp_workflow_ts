/**
 * RIP Queue Service
 *
 * Manages the flow of print files from the ERP into RIP software hotfolders,
 * then monitors the RIP queue to track status changes through to completion.
 *
 * Flow:
 *   1. User selects a print file from the WO folder → configures print settings
 *   2. ERP copies the file into the target Thrive/Fiery hotfolder
 *   3. Service monitors QueueXML.Info to detect status transitions
 *   4. RipJob record is updated with timestamps for KPI tracking
 *
 * The ERP COPIES files — it never moves or deletes the originals.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { prisma } from '../db/client.js';
import { THRIVE_CONFIG, parseQueueFile, type ThriveJob } from './thrive.js';
import { extractCutId } from './zund-match.js';
import { broadcast } from '../ws/server.js';
import { submitVutekJob, type VutekPrintSettings } from './fiery-jmf.js';

// ─── Types ────────────────────────────────────────────────────

export interface HotfolderTarget {
  id: string;
  name: string;
  path: string;
  ripType: string;
  station: string;
  machineId: string;
  machineName: string;
  equipmentId?: string;
}

export interface SendToRipResult {
  success: boolean;
  ripJobId?: string;
  destinationPath?: string;
  error?: string;
}

export interface RipStatusUpdate {
  ripJobId: string;
  oldStatus: string;
  newStatus: string;
  thriveJob?: ThriveJob;
}

let ripStatusSyncPromise: Promise<RipStatusUpdate[]> | null = null;

// ─── Hotfolder Discovery ──────────────────────────────────────

/**
 * Build a list of available RIP hotfolder targets from the Thrive config.
 * Each target corresponds to a specific printer queue on a specific RIP machine.
 */
export function getAvailableHotfolders(): HotfolderTarget[] {
  const hotfolders: HotfolderTarget[] = [];

  for (const machine of THRIVE_CONFIG.machines) {
    for (const printer of machine.printers) {
      // The hotfolder input path is the queue path minus the Info/QueueXML.Info suffix
      const hotfolderPath = printer.queuePath
        .replace(/\\Info\\QueueXML\.Info$/i, '')
        .replace(/\/Info\/QueueXML\.Info$/i, '');

      hotfolders.push({
        id: `${machine.id}-${printer.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        name: printer.name,
        path: hotfolderPath,
        ripType: 'Onyx',
        station: printer.printingMethod,
        machineId: machine.id,
        machineName: machine.name,
      });
    }
  }

  // Add Fiery/VUTEk hotfolder only when a writable input path is configured
  // (exportPath is the Fiery OUTPUT folder — read-only; hotfolderPath is the INPUT drop folder)
  if (THRIVE_CONFIG.fiery?.hotfolderPath) {
    hotfolders.push({
      id: 'fiery-vutek',
      name: 'EFI VUTEk GS3250LX Pro',
      path: THRIVE_CONFIG.fiery.hotfolderPath,
      ripType: 'Fiery',
      station: 'FLATBED',
      machineId: 'fiery',
      machineName: 'EFI Fiery DFE',
    });
  }

  return hotfolders;
}

/**
 * Link hotfolder targets to ERP Equipment records by matching names/IPs.
 */
export async function getHotfoldersWithEquipment(): Promise<HotfolderTarget[]> {
  const hotfolders = getAvailableHotfolders();

  const equipment = await prisma.equipment.findMany({
    where: { type: { in: ['Printer', 'Large Format Printer'] } },
    select: { id: true, name: true, ipAddress: true, station: true },
  });

  // Try to match equipment by name similarity
  for (const hf of hotfolders) {
    const match = equipment.find((eq) => {
      const eqName = eq.name.toLowerCase();
      const hfName = hf.name.toLowerCase();
      return eqName === hfName || eqName.includes(hfName) || hfName.includes(eqName);
    });
    if (match) {
      hf.equipmentId = match.id;
    }
  }

  return hotfolders;
}

// ─── File Operations ──────────────────────────────────────────

/**
 * Validate that a source file exists and is readable.
 */
export async function validateSourceFile(filePath: string): Promise<{
  valid: boolean;
  size?: number;
  error?: string;
}> {
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      return { valid: false, error: 'Path is not a file' };
    }
    return { valid: true, size: stat.size };
  } catch (err: any) {
    return { valid: false, error: `Cannot access file: ${err.message}` };
  }
}

/**
 * Copy a print file to a RIP hotfolder.
 * Returns the destination path on success.
 *
 * IMPORTANT: This COPIES the file — the original is never modified or deleted.
 */
export async function copyToHotfolder(
  sourceFilePath: string,
  hotfolderPath: string
): Promise<{ success: boolean; destinationPath?: string; error?: string }> {
  try {
    // Validate source exists
    const validation = await validateSourceFile(sourceFilePath);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Ensure hotfolder directory exists and is accessible
    try {
      await fs.access(hotfolderPath);
    } catch {
      return { success: false, error: `Hotfolder not accessible: ${hotfolderPath}` };
    }

    const fileName = path.basename(sourceFilePath);
    const destinationPath = path.join(hotfolderPath, fileName);

    // Check if file already exists in hotfolder
    try {
      await fs.access(destinationPath);
      // File exists — append timestamp to avoid overwrite
      const ext = path.extname(fileName);
      const base = path.basename(fileName, ext);
      const timestamp = Date.now();
      const newName = `${base}_${timestamp}${ext}`;
      const newDest = path.join(hotfolderPath, newName);
      await fs.copyFile(sourceFilePath, newDest);
      return { success: true, destinationPath: newDest };
    } catch {
      // File doesn't exist yet — copy directly
      await fs.copyFile(sourceFilePath, destinationPath);
      return { success: true, destinationPath };
    }
  } catch (err: any) {
    return { success: false, error: `Copy failed: ${err.message}` };
  }
}

// ─── RIP Job CRUD ─────────────────────────────────────────────

/**
 * Send a file to a RIP hotfolder and create a tracking RipJob record.
 */
export async function sendToRip(params: {
  workOrderId: string;
  sourceFilePath: string;
  hotfolderTarget: HotfolderTarget;
  printSettings?: {
    colorProfile?: string;
    printResolution?: string;
    printMode?: string;
    mediaProfile?: string;
    mediaType?: string;
    mediaWidth?: number;
    mediaLength?: number;
    copies?: number;
    whiteInk?: string;
    mirror?: boolean;
    nestingEnabled?: boolean;
    additionalSettings?: Record<string, unknown>;
  };
  notes?: string;
  priority?: number;
  userId: string;
}): Promise<SendToRipResult> {
  const { workOrderId, sourceFilePath, hotfolderTarget, printSettings, notes, priority, userId } =
    params;

  // Validate source file
  const fileValidation = await validateSourceFile(sourceFilePath);
  if (!fileValidation.valid) {
    return { success: false, error: fileValidation.error };
  }

  // For Fiery/VUTEk targets, use JMF SubmitQueueEntry instead of plain file copy.
  // This ensures Fiery XF applies the correct print settings (media profile, curing, etc.)
  // rather than just dropping a raw file into a folder.
  let destinationPath: string | undefined;
  if (hotfolderTarget.ripType === 'Fiery') {
    const vutekSettings: Partial<VutekPrintSettings> = {
      media: printSettings?.mediaProfile ?? undefined,
      whiteInk: printSettings?.whiteInk ? printSettings.whiteInk !== 'none' : undefined,
      mirror: printSettings?.mirror,
      copies: printSettings?.copies,
    };
    const jmfResult = await submitVutekJob({
      jobId: workOrderId,
      sourceFilePath,
      settings: vutekSettings,
    });
    if (!jmfResult.success) {
      return { success: false, error: jmfResult.error };
    }
    destinationPath = jmfResult.pdfDestPath;
  } else {
    // Standard Onyx Thrive hotfolder — plain file copy
    const copyResult = await copyToHotfolder(sourceFilePath, hotfolderTarget.path);
    if (!copyResult.success) {
      return { success: false, error: copyResult.error };
    }
    destinationPath = copyResult.destinationPath;
  }

  // Create tracking record
  const ripJob = await prisma.ripJob.create({
    data: {
      workOrderId,
      sourceFilePath,
      sourceFileName: path.basename(sourceFilePath),
      sourceFileSize: fileValidation.size ?? null,
      hotfolderPath: hotfolderTarget.path,
      hotfolderName: hotfolderTarget.name,
      ripType: hotfolderTarget.ripType,
      status: 'QUEUED',
      equipmentId: hotfolderTarget.equipmentId ?? null,
      colorProfile: printSettings?.colorProfile ?? null,
      printResolution: printSettings?.printResolution ?? null,
      printMode: printSettings?.printMode ?? null,
      mediaProfile: printSettings?.mediaProfile ?? null,
      mediaType: printSettings?.mediaType ?? null,
      mediaWidth: printSettings?.mediaWidth ?? null,
      mediaLength: printSettings?.mediaLength ?? null,
      copies: printSettings?.copies ?? 1,
      whiteInk: printSettings?.whiteInk ?? null,
      mirror: printSettings?.mirror ?? false,
      nestingEnabled: printSettings?.nestingEnabled ?? false,
      printSettingsJson: printSettings?.additionalSettings
        ? (printSettings.additionalSettings as Parameters<
            typeof prisma.ripJob.create
          >[0]['data']['printSettingsJson'])
        : undefined,
      notes: notes ?? null,
      priority: priority ?? 3,
      createdById: userId,
    },
    include: {
      workOrder: { select: { id: true, orderNumber: true, customerName: true } },
      equipment: { select: { id: true, name: true, station: true } },
      createdBy: { select: { id: true, username: true, displayName: true } },
    },
  });

  // Broadcast
  broadcast({
    type: 'RIP_JOB_CREATED',
    payload: ripJob,
    timestamp: new Date(),
  });

  // Auto-create PrintCutLink for file chain tracking
  try {
    const printFileName = path.basename(sourceFilePath);
    const cutId = extractCutId(printFileName);
    const existing = await prisma.printCutLink.findFirst({
      where: { workOrderId, printFileName },
    });
    if (existing) {
      // Link existing chain record to this RIP job and advance status
      await prisma.printCutLink.update({
        where: { id: existing.id },
        data: {
          ripJobId: ripJob.id,
          status: 'SENT_TO_RIP',
          ripMachine: hotfolderTarget.name,
          cutId: existing.cutId ?? cutId ?? undefined,
        },
      });
    } else {
      await prisma.printCutLink.create({
        data: {
          workOrderId,
          printFileName,
          printFilePath: sourceFilePath,
          printFileSize: fileValidation.size ?? null,
          ripJobId: ripJob.id,
          status: 'SENT_TO_RIP',
          ripMachine: hotfolderTarget.name,
          cutId,
        },
      });
    }
  } catch (err) {
    // Non-critical — don't fail the RIP submission
    console.error('⚠️ File chain link creation failed (non-critical):', err);
  }

  return {
    success: true,
    ripJobId: ripJob.id,
    destinationPath,
  };
}

// ─── Thrive Queue Monitoring ──────────────────────────────────

/**
 * Thrive status code → RipJobStatus mapping
 */
function thriveStatusToRipStatus(statusCode: number): string | null {
  switch (statusCode) {
    case 0:
      return 'QUEUED'; // Pending
    case 4:
      return 'PROCESSING'; // Processing (RIPping)
    case 8:
      return 'READY'; // Ready to Print
    case 16:
      return 'PRINTING'; // Printing
    case 32:
      return 'PRINTED'; // Printed
    case 64:
      return 'FAILED'; // Error
    default:
      return null;
  }
}

/**
 * Scan all Thrive queues and update RipJob records based on what we find.
 *
 * Matching strategy:
 *   1. If RipJob has a ripJobGuid, match by GUID
 *   2. Otherwise, match by source file name in the queue
 *
 * Returns list of status changes detected.
 */
async function syncRipJobStatusesInternal(): Promise<RipStatusUpdate[]> {
  const updates: RipStatusUpdate[] = [];

  // Get all active (non-terminal) RipJobs
  const activeJobs = await prisma.ripJob.findMany({
    where: {
      status: { in: ['QUEUED', 'PROCESSING', 'READY', 'SENDING', 'PRINTING'] },
    },
  });

  if (activeJobs.length === 0) return updates;

  // Parse all Thrive queue files
  const allThriveJobs: ThriveJob[] = [];
  for (const machine of THRIVE_CONFIG.machines) {
    for (const printer of machine.printers) {
      try {
        const jobs = await parseQueueFile(printer.queuePath);
        allThriveJobs.push(...jobs);
      } catch {
        // Queue file not accessible — skip
      }
    }
  }

  // Match and update
  for (const ripJob of activeJobs) {
    let thriveJob: ThriveJob | undefined;

    // Strategy 1: Match by GUID
    if (ripJob.ripJobGuid) {
      thriveJob = allThriveJobs.find((tj) => tj.jobGuid === ripJob.ripJobGuid);
    }

    // Strategy 2: Match by file name
    if (!thriveJob) {
      thriveJob = allThriveJobs.find((tj) => {
        const tjFileName = path.basename(tj.fileName).toLowerCase();
        const ripFileName = ripJob.sourceFileName.toLowerCase();
        return (
          tjFileName === ripFileName ||
          tjFileName.includes(ripFileName) ||
          ripFileName.includes(tjFileName)
        );
      });
    }

    if (!thriveJob) continue;

    // Determine new status
    const newStatus = thriveStatusToRipStatus(thriveJob.statusCode);
    if (!newStatus || newStatus === ripJob.status) continue;

    // Build update data
    const updateData: Record<string, unknown> = {
      status: newStatus,
      ripJobGuid: thriveJob.jobGuid,
      ripStatusCode: thriveJob.statusCode,
      ripInkUsage: thriveJob.inkTotal ?? undefined,
      ripInkCoverage: thriveJob.inkCoverage ?? undefined,
    };

    // Set timestamps based on status transition
    const now = new Date();
    if (newStatus === 'PROCESSING' && !ripJob.rippedAt) {
      // Actually rippedAt marks when RIP finishes, but we track the processing start here
    }
    if (newStatus === 'READY' && !ripJob.rippedAt) {
      updateData.rippedAt = now;
    }
    if (newStatus === 'PRINTING' && !ripJob.printStartedAt) {
      updateData.sentToPrinterAt = ripJob.sentToPrinterAt ?? now;
      updateData.printStartedAt = now;
    }
    if (newStatus === 'PRINTED' && !ripJob.printCompletedAt) {
      updateData.printCompletedAt = now;
    }
    if (newStatus === 'FAILED') {
      updateData.errorMessage = `Thrive error (status code ${thriveJob.statusCode})`;
    }

    await prisma.ripJob.update({
      where: { id: ripJob.id },
      data: updateData,
    });

    updates.push({
      ripJobId: ripJob.id,
      oldStatus: ripJob.status,
      newStatus,
      thriveJob,
    });
  }

  // Broadcast updates
  if (updates.length > 0) {
    broadcast({
      type: 'RIP_JOB_STATUS_SYNC',
      payload: updates,
      timestamp: new Date(),
    });
  }

  return updates;
}

export async function syncRipJobStatuses(): Promise<RipStatusUpdate[]> {
  if (ripStatusSyncPromise) {
    return ripStatusSyncPromise;
  }

  ripStatusSyncPromise = syncRipJobStatusesInternal().finally(() => {
    ripStatusSyncPromise = null;
  });

  return ripStatusSyncPromise;
}

// ─── KPI Calculations ─────────────────────────────────────────

/**
 * Calculate RIP queue KPI metrics.
 */
export async function calculateKPIs(options?: {
  fromDate?: Date;
  toDate?: Date;
  equipmentId?: string;
}): Promise<{
  totalJobs: number;
  inQueue: number;
  processing: number;
  printing: number;
  completedToday: number;
  failedToday: number;
  avgQueueToRipMinutes: number | null;
  avgRipToPrintMinutes: number | null;
  avgPrintMinutes: number | null;
  avgTotalMinutes: number | null;
}> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const baseWhere: Record<string, unknown> = {};
  if (options?.equipmentId) baseWhere.equipmentId = options.equipmentId;
  if (options?.fromDate) baseWhere.queuedAt = { gte: options.fromDate };
  if (options?.toDate) {
    baseWhere.queuedAt = { ...((baseWhere.queuedAt as object) || {}), lte: options.toDate };
  }

  const [statusCounts, completedToday, failedToday, completedJobs] = await Promise.all([
    prisma.ripJob.groupBy({
      by: ['status'],
      where: baseWhere,
      _count: true,
    }),
    prisma.ripJob.count({
      where: { ...baseWhere, status: 'COMPLETED', printCompletedAt: { gte: today } },
    }),
    prisma.ripJob.count({
      where: { ...baseWhere, status: 'FAILED', updatedAt: { gte: today } },
    }),
    // Get completed jobs with full timing data for averages
    prisma.ripJob.findMany({
      where: {
        ...baseWhere,
        status: { in: ['PRINTED', 'COMPLETED'] },
        queuedAt: {
          gte: options?.fromDate ?? new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000),
        },
      },
      select: {
        queuedAt: true,
        rippedAt: true,
        sentToPrinterAt: true,
        printStartedAt: true,
        printCompletedAt: true,
      },
    }),
  ]);

  // Calculate averages
  const timings = completedJobs.map((j) => ({
    queueToRip: j.rippedAt ? (j.rippedAt.getTime() - j.queuedAt.getTime()) / 60000 : null,
    ripToPrint:
      j.printStartedAt && j.rippedAt
        ? (j.printStartedAt.getTime() - j.rippedAt.getTime()) / 60000
        : null,
    printDuration:
      j.printCompletedAt && j.printStartedAt
        ? (j.printCompletedAt.getTime() - j.printStartedAt.getTime()) / 60000
        : null,
    total: j.printCompletedAt
      ? (j.printCompletedAt.getTime() - j.queuedAt.getTime()) / 60000
      : null,
  }));

  const avg = (arr: (number | null)[]): number | null => {
    const nums = arr.filter((n): n is number => n !== null && n > 0);
    return nums.length > 0 ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : null;
  };

  const total = Object.values(statusCounts).reduce((sum, s) => sum + s._count, 0);
  const countFor = (status: string) => statusCounts.find((s) => s.status === status)?._count ?? 0;

  return {
    totalJobs: total,
    inQueue: countFor('QUEUED'),
    processing: countFor('PROCESSING') + countFor('READY'),
    printing: countFor('PRINTING') + countFor('SENDING'),
    completedToday,
    failedToday,
    avgQueueToRipMinutes: avg(timings.map((t) => t.queueToRip)),
    avgRipToPrintMinutes: avg(timings.map((t) => t.ripToPrint)),
    avgPrintMinutes: avg(timings.map((t) => t.printDuration)),
    avgTotalMinutes: avg(timings.map((t) => t.total)),
  };
}

// ─── Exports ──────────────────────────────────────────────────

export const ripQueueService = {
  getAvailableHotfolders,
  getHotfoldersWithEquipment,
  validateSourceFile,
  copyToHotfolder,
  sendToRip,
  syncRipJobStatuses,
  calculateKPIs,
};
