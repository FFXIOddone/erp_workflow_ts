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
import type { Prisma } from '@prisma/client';
import { prisma } from '../db/client.js';
import { THRIVE_CONFIG, parseQueueFile, type ThriveJob } from './thrive.js';
import { extractCutId } from './zund-match.js';
import { broadcast } from '../ws/server.js';
import {
  getAllFieryDownloadFiles,
  getAllFieryJobs,
  type FieryDownloadFile,
  type FieryJob,
} from './fiery.js';
import { buildFieryJobTicketName, submitVutekJob } from './fiery-jmf.js';

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
  queueEntryId?: string;
  submissionJobId?: string;
  error?: string;
}

export interface RipStatusUpdate {
  ripJobId: string;
  oldStatus: string;
  newStatus: string;
  thriveJob?: ThriveJob;
}

let ripStatusSyncPromise: Promise<RipStatusUpdate[]> | null = null;
let fieryMetadataRepairPromise: Promise<number> | null = null;

function normalizeJsonObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return { ...(value as Record<string, unknown>) };
}

function pickStringSetting(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function pickMeaningfulId(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed && trimmed !== '0') {
      return trimmed;
    }
  }

  return undefined;
}

function deriveMediaDimensionFromSize(width?: number | null, height?: number | null): string | undefined {
  if (!width || !height || width <= 0 || height <= 0) return undefined;
  return `${Math.round(width * 72)} ${Math.round(height * 72)}`;
}

function normalizeRipMatchName(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/\.[^.]+$/g, '')
    .replace(/\.rtl(_\d+)?$/i, '')
    .replace(/_P\d+_T\d+_\d+_\d+$/i, '')
    .replace(/~\d+(_p\d+)?(_r\d+)?(_c\d+)?$/i, '')
    .replace(/[&()[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizeWorkOrderNumber(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/^wo/i, '')
    .replace(/[^0-9]/g, '');
}

function namesLooselyMatch(left: string, right: string): boolean {
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

function toJsonValue(value: Record<string, unknown> | undefined): Prisma.InputJsonValue | undefined {
  return value as Prisma.InputJsonValue | undefined;
}

function findMatchingFieryJob(
  ripJob: {
    sourceFileName: string;
    sourceFilePath: string;
    ripJobGuid?: string | null;
    workOrder?: { orderNumber: string } | null;
  },
  fieryJobs: FieryJob[],
  fierySettings?: Record<string, unknown>
): FieryJob | undefined {
  const ripWorkOrder = normalizeWorkOrderNumber(ripJob.workOrder?.orderNumber);
  const ripSubmissionId = pickMeaningfulId(ripJob.ripJobGuid);
  const ripNames = uniqueStrings([
    normalizeRipMatchName(ripJob.sourceFileName),
    normalizeRipMatchName(path.basename(ripJob.sourceFilePath || '')),
    normalizeRipMatchName(getFieryImportedFileName(fierySettings ?? {})),
  ]);

  return fieryJobs
    .filter((fieryJob) => {
      const fierySubmissionId = pickMeaningfulId(fieryJob.jobId);
      if (ripSubmissionId) {
        return Boolean(fierySubmissionId && ripSubmissionId === fierySubmissionId);
      }

      const fieryWorkOrder = normalizeWorkOrderNumber(fieryJob.workOrderNumber);
      if (ripWorkOrder && fieryWorkOrder && ripWorkOrder !== fieryWorkOrder) {
        return false;
      }

      const fieryNames = uniqueStrings([
        normalizeRipMatchName(fieryJob.jobName),
        normalizeRipMatchName(fieryJob.fileName),
        normalizeRipMatchName(fieryJob.thriveFilePath ? path.basename(fieryJob.thriveFilePath) : ''),
      ]);

      return ripNames.some((ripName) =>
        fieryNames.some((fieryName) => namesLooselyMatch(ripName, fieryName))
      );
    })
    .sort((left, right) => {
      const leftTime = left.timestamp ? new Date(left.timestamp).getTime() : 0;
      const rightTime = right.timestamp ? new Date(right.timestamp).getTime() : 0;
      return rightTime - leftTime;
    })[0];
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function getFierySettingsFromPrintSettings(printSettingsJson: unknown): Record<string, unknown> {
  const printSettings = normalizeJsonObject(printSettingsJson);
  return normalizeJsonObject(printSettings.fiery);
}

function getFierySubmissionJobId(fierySettings: Record<string, unknown>, ripJobGuid?: string | null): string | undefined {
  return pickMeaningfulId(fierySettings.submissionJobId, ripJobGuid);
}

async function readFierySubmissionJobIdFromJdfPath(
  jdfPath: unknown
): Promise<string | undefined> {
  if (typeof jdfPath !== 'string' || !jdfPath.trim()) return undefined;

  try {
    const jdfContent = await fs.readFile(jdfPath, 'utf-8');
    const match = jdfContent.match(/JobID="([^"]+)"/i);
    return pickMeaningfulId(match?.[1]);
  } catch {
    return undefined;
  }
}

function getFieryStagedPdfName(fierySettings: Record<string, unknown>): string | undefined {
  const stagedPdfPath = typeof fierySettings.stagedPdfPath === 'string' ? fierySettings.stagedPdfPath : undefined;
  const destinationPath = typeof fierySettings.destinationPath === 'string' ? fierySettings.destinationPath : undefined;
  const copiedFileName = typeof fierySettings.copiedFileName === 'string' ? fierySettings.copiedFileName : undefined;

  if (stagedPdfPath) return path.basename(stagedPdfPath);
  if (destinationPath) return path.basename(destinationPath);
  return copiedFileName ?? undefined;
}

function getFieryImportedFileName(fierySettings: Record<string, unknown>): string | undefined {
  const jobTicketName = typeof fierySettings.jobTicketName === 'string' ? fierySettings.jobTicketName : undefined;
  const copiedFileName = typeof fierySettings.copiedFileName === 'string' ? fierySettings.copiedFileName : undefined;
  const destinationPath = typeof fierySettings.destinationPath === 'string' ? fierySettings.destinationPath : undefined;

  return jobTicketName ?? copiedFileName ?? (destinationPath ? path.basename(destinationPath) : undefined);
}

function getFieryPdfPath(fierySettings: Record<string, unknown>): string | null {
  const stagedPdfPath = pickStringSetting(fierySettings.stagedPdfPath);
  const destinationPath = pickStringSetting(fierySettings.destinationPath);
  return stagedPdfPath ?? destinationPath ?? null;
}

function getFieryCopiedFileName(
  fierySettings: Record<string, unknown>,
  pdfPath: string | null
): string | null {
  const copiedFileName = pickStringSetting(fierySettings.copiedFileName);
  if (copiedFileName) return copiedFileName;
  if (pdfPath) return path.basename(pdfPath);
  const destinationPath = pickStringSetting(fierySettings.destinationPath);
  return destinationPath ? path.basename(destinationPath) : null;
}

async function repairFieryJobMetadataInternal(): Promise<number> {
  const persistedWorkflow = await prisma.systemSettings.findFirst({
    where: { id: 'system' },
    select: { fieryWorkflowName: true },
  });
  const fallbackWorkflowName = persistedWorkflow?.fieryWorkflowName?.trim() || 'Zund G7';

  const fieryJobs = await prisma.ripJob.findMany({
    where: { ripType: 'Fiery' },
    select: { id: true, printSettingsJson: true },
  });

  let updatedCount = 0;
  for (const ripJob of fieryJobs) {
    const existingPrintSettings = normalizeJsonObject(ripJob.printSettingsJson);
    const existingFierySettings = getFierySettingsFromPrintSettings(ripJob.printSettingsJson);
    if (existingFierySettings.importMode !== 'jmf') continue;

    const normalizedPdfPath = getFieryPdfPath(existingFierySettings);
    const normalizedCopiedFileName = getFieryCopiedFileName(existingFierySettings, normalizedPdfPath);
    const normalizedFierySettings = {
      ...existingFierySettings,
      workflowName: pickStringSetting(existingFierySettings.workflowName) ?? fallbackWorkflowName,
      stagedPdfPath: normalizedPdfPath,
      destinationPath: normalizedPdfPath,
      copiedFileName: normalizedCopiedFileName,
    };

    const shouldBackfill =
      existingFierySettings.workflowName !== normalizedFierySettings.workflowName ||
      existingFierySettings.stagedPdfPath !== normalizedFierySettings.stagedPdfPath ||
      existingFierySettings.destinationPath !== normalizedFierySettings.destinationPath ||
      existingFierySettings.copiedFileName !== normalizedFierySettings.copiedFileName;

    if (!shouldBackfill) continue;

    await prisma.ripJob.update({
      where: { id: ripJob.id },
      data: {
        printSettingsJson: toJsonValue({
          ...existingPrintSettings,
          fiery: normalizedFierySettings,
        }),
      },
    });
    updatedCount++;
  }

  return updatedCount;
}

async function repairFieryJobMetadata(): Promise<number> {
  if (fieryMetadataRepairPromise) {
    return fieryMetadataRepairPromise;
  }

  fieryMetadataRepairPromise = repairFieryJobMetadataInternal().finally(() => {
    fieryMetadataRepairPromise = null;
  });

  return fieryMetadataRepairPromise;
}

function normalizeFieryFileName(value: string): string {
  return value.trim().toLowerCase();
}

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
    where: { type: { in: ['Printer', 'Large Format Printer', 'Workstation'] } },
    select: { id: true, name: true, ipAddress: true, station: true },
  });

  // Try to match equipment by name similarity
  for (const hf of hotfolders) {
    const nameMatch = equipment.find((eq) => {
      const eqName = eq.name.toLowerCase();
      const hfName = hf.name.toLowerCase();
      const machineName = hf.machineName.toLowerCase();
      return (
        eqName === hfName ||
        eqName.includes(hfName) ||
        hfName.includes(eqName) ||
        eqName === machineName ||
        eqName.includes(machineName) ||
        machineName.includes(eqName)
      );
    });
    const fieryIpMatch =
      hf.ripType === 'Fiery' && THRIVE_CONFIG.fiery?.ip
        ? equipment.find((eq) => eq.ipAddress === THRIVE_CONFIG.fiery?.ip)
        : undefined;
    const match = nameMatch ?? fieryIpMatch;
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
  hotfolderPath: string,
  targetFileName?: string
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

    const fileName = path.basename(targetFileName?.trim() || sourceFilePath);
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
  const additionalSettings = normalizeJsonObject(printSettings?.additionalSettings);

  // Validate source file
  const fileValidation = await validateSourceFile(sourceFilePath);
  if (!fileValidation.valid) {
    return { success: false, error: fileValidation.error };
  }

  let destinationPath: string | undefined;
  let queueEntryId: string | undefined;
  let submissionJobId: string | undefined;
  let printSettingsJson = Object.keys(additionalSettings).length > 0 ? additionalSettings : undefined;
  if (hotfolderTarget.ripType === 'Fiery') {
    const fieryWorkOrder = await prisma.workOrder.findUnique({
      where: { id: workOrderId },
      select: {
        orderNumber: true,
        customerName: true,
        description: true,
        companyId: true,
        customerId: true,
        company: { select: { id: true, name: true } },
      },
    });
    const persistedWorkflow = await prisma.systemSettings.findFirst({
      where: { id: 'system' },
      select: { fieryWorkflowName: true },
    });
    const effectiveWorkflowName = persistedWorkflow?.fieryWorkflowName?.trim() || 'Zund G7';
    const customerName =
      fieryWorkOrder?.customerName?.trim() ||
      fieryWorkOrder?.company?.name?.trim() ||
      `Work Order ${fieryWorkOrder?.orderNumber ?? workOrderId}`;
    const customerId =
      fieryWorkOrder?.companyId?.trim() ||
      fieryWorkOrder?.customerId?.trim() ||
      fieryWorkOrder?.company?.id?.trim() ||
      fieryWorkOrder?.orderNumber?.trim() ||
      workOrderId;
    const jobTicketName = buildFieryJobTicketName({
      workOrderNumber: fieryWorkOrder?.orderNumber ?? null,
      customerName,
      sourceFileName: path.basename(sourceFilePath),
      jobDescription: fieryWorkOrder?.description ?? notes ?? null,
    });

    const fierySubmit = await submitVutekJob({
      jobId: workOrderId,
      sourceFilePath,
      jobInfo: {
        workOrderNumber: fieryWorkOrder?.orderNumber ?? null,
        customerName,
        customerId,
        sourceFileName: path.basename(sourceFilePath),
        jobDescription: fieryWorkOrder?.description ?? notes ?? null,
      },
      settings: {
        ...additionalSettings,
        outputChannelName: effectiveWorkflowName,
        media: printSettings?.mediaType ?? undefined,
        ripMedia: printSettings?.mediaProfile ?? printSettings?.mediaType ?? undefined,
      },
    });

    if (!fierySubmit.success) {
      return { success: false, error: fierySubmit.error ?? 'Failed to submit Fiery job' };
    }

    destinationPath = fierySubmit.pdfDestPath;
    queueEntryId = fierySubmit.queueEntryId;
    submissionJobId = fierySubmit.submissionJobId;
    printSettingsJson = {
      ...additionalSettings,
      fiery: {
        importMode: 'jmf',
        workflowName: effectiveWorkflowName,
        workOrderNumber: fieryWorkOrder?.orderNumber ?? null,
        customerName,
        customerId,
        jobDescription: fieryWorkOrder?.description ?? notes ?? null,
        jobTicketName,
        sourceFileName: path.basename(sourceFilePath),
        copiedFileName: path.basename(fierySubmit.pdfDestPath ?? sourceFilePath),
        destinationPath: fierySubmit.pdfDestPath ?? null,
        stagedPdfPath: fierySubmit.pdfDestPath ?? null,
        jdfPath: fierySubmit.jdfPath ?? null,
        queueEntryId: fierySubmit.queueEntryId ?? null,
        submissionJobId: fierySubmit.submissionJobId ?? null,
        importedAt: new Date().toISOString(),
      },
    };
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
      ripJobGuid: submissionJobId ?? queueEntryId ?? null,
      equipmentId: hotfolderTarget.equipmentId ?? null,
      colorProfile: printSettings?.colorProfile ?? null,
      printResolution:
        printSettings?.printResolution ?? null,
      printMode:
        printSettings?.printMode ?? null,
      mediaProfile:
        printSettings?.mediaProfile ?? null,
      mediaType:
        printSettings?.mediaType ?? null,
      mediaWidth: printSettings?.mediaWidth ?? null,
      mediaLength: printSettings?.mediaLength ?? null,
      copies: printSettings?.copies ?? 1,
      whiteInk: printSettings?.whiteInk ?? null,
      mirror: printSettings?.mirror ?? false,
      nestingEnabled: printSettings?.nestingEnabled ?? false,
      printSettingsJson: toJsonValue(printSettingsJson),
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

  if (hotfolderTarget.ripType === 'Fiery') {
    void syncRipJobStatuses().catch((err) => {
      console.warn('[RipQueue] Fiery post-submit sync failed:', err instanceof Error ? err.message : err);
    });
  }

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
    queueEntryId,
    submissionJobId,
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

  try {
    const repairedCount = await repairFieryJobMetadata();
    if (repairedCount > 0) {
      console.info(`[RipQueue] Repaired ${repairedCount} Fiery job metadata row(s)`);
    }
  } catch (err) {
    console.warn('[RipQueue] Fiery metadata repair failed:', err instanceof Error ? err.message : err);
  }

  // Get all active (non-terminal) RipJobs
  const activeJobs = await prisma.ripJob.findMany({
    where: {
      status: { in: ['QUEUED', 'PROCESSING', 'READY', 'SENDING', 'PRINTING'] },
    },
    include: {
      workOrder: { select: { orderNumber: true } },
    },
  });

  if (activeJobs.length === 0) return updates;

  const allThriveJobs: ThriveJob[] = [];
  const allFieryJobs: FieryJob[] = [];
  const allFieryDownloads: FieryDownloadFile[] = [];
  const activeThriveJobs = activeJobs.filter((job) => job.ripType !== 'Fiery');
  const activeFieryJobs = activeJobs.filter((job) => job.ripType === 'Fiery');

  if (activeThriveJobs.length > 0) {
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
  }

  if (activeFieryJobs.length > 0) {
    try {
      allFieryJobs.push(...(await getAllFieryJobs()));
    } catch (err) {
      console.warn('[RipQueue] Fiery sync scan failed:', err instanceof Error ? err.message : err);
    }

    try {
      allFieryDownloads.push(...(await getAllFieryDownloadFiles()));
    } catch (err) {
      console.warn(
        '[RipQueue] Fiery download scan failed:',
        err instanceof Error ? err.message : err
      );
    }
  }

  // Match and update
  for (const ripJob of activeJobs) {
    if (ripJob.ripType === 'Fiery') {
      const existingPrintSettings = normalizeJsonObject(ripJob.printSettingsJson);
      const existingFierySettings = getFierySettingsFromPrintSettings(ripJob.printSettingsJson);
      const normalizedWorkflowName =
        typeof existingFierySettings.workflowName === 'string' && existingFierySettings.workflowName.trim()
          ? existingFierySettings.workflowName.trim()
          : 'Zund G7';
      const normalizedStagedPdfPath =
        typeof existingFierySettings.stagedPdfPath === 'string' && existingFierySettings.stagedPdfPath.trim()
          ? existingFierySettings.stagedPdfPath.trim()
          : typeof existingFierySettings.destinationPath === 'string' && existingFierySettings.destinationPath.trim()
            ? existingFierySettings.destinationPath.trim()
            : null;
      const shouldBackfillFierySettings =
        existingFierySettings.workflowName !== normalizedWorkflowName ||
        existingFierySettings.stagedPdfPath !== normalizedStagedPdfPath;
      const normalizedFierySettings = shouldBackfillFierySettings
        ? {
            ...existingFierySettings,
            workflowName: normalizedWorkflowName,
            stagedPdfPath: normalizedStagedPdfPath,
          }
        : existingFierySettings;

      if (shouldBackfillFierySettings) {
        const backfilledPrintSettings = {
          ...existingPrintSettings,
          fiery: normalizedFierySettings,
        };

        await prisma.ripJob.update({
          where: { id: ripJob.id },
          data: {
            printSettingsJson: toJsonValue(backfilledPrintSettings),
          },
        });
      }

      const jdfSubmissionJobId = await readFierySubmissionJobIdFromJdfPath(
        normalizedFierySettings.jdfPath
      );
      const submissionJobId = getFierySubmissionJobId(
        normalizedFierySettings,
        ripJob.ripJobGuid
      ) ?? jdfSubmissionJobId;
      const stagedPdfName = getFieryStagedPdfName(normalizedFierySettings);
      const downloadMatch = stagedPdfName
        ? allFieryDownloads.find(
            (file) =>
              normalizeFieryFileName(file.fileName) === normalizeFieryFileName(stagedPdfName)
          )
        : undefined;

      if (submissionJobId && ripJob.ripJobGuid !== submissionJobId) {
        const backfilledPrintSettings = {
          ...existingPrintSettings,
          fiery: {
            ...normalizedFierySettings,
            submissionJobId,
          },
        };

        await prisma.ripJob.update({
          where: { id: ripJob.id },
          data: {
            ripJobGuid: submissionJobId,
            printSettingsJson: toJsonValue(backfilledPrintSettings),
          },
        });

        ripJob.ripJobGuid = submissionJobId;
      }

      const fieryJob = findMatchingFieryJob(ripJob, allFieryJobs, normalizedFierySettings);
      if (fieryJob) {
        const matchedAt = fieryJob.timestamp ? new Date(fieryJob.timestamp) : new Date();
        const updatedPrintSettings = {
          ...existingPrintSettings,
          fiery: {
            ...normalizedFierySettings,
            submissionJobId: submissionJobId ?? normalizedFierySettings.submissionJobId ?? null,
            exportedJobId: fieryJob.jobId,
            exportedJobName: fieryJob.jobName,
            exportedFileName: fieryJob.fileName,
            exportedAt: fieryJob.timestamp ?? null,
            exportedMedia: fieryJob.media?.description ?? fieryJob.media?.vutekMedia ?? null,
            exportedInks: fieryJob.inks,
          },
        };

        await prisma.ripJob.update({
          where: { id: ripJob.id },
          data: {
            status: 'PRINTED',
            rippedAt: ripJob.rippedAt ?? matchedAt,
            sentToPrinterAt: ripJob.sentToPrinterAt ?? matchedAt,
            printStartedAt: ripJob.printStartedAt ?? matchedAt,
            printCompletedAt: ripJob.printCompletedAt ?? matchedAt,
            printSettingsJson: toJsonValue(updatedPrintSettings),
            errorMessage: null,
          },
        });

        updates.push({
          ripJobId: ripJob.id,
          oldStatus: ripJob.status,
          newStatus: 'PRINTED',
        });
        continue;
      }

      if (!downloadMatch) continue;

      const matchedAt = downloadMatch.timestamp ? new Date(downloadMatch.timestamp) : new Date();
      const updatedPrintSettings = {
        ...existingPrintSettings,
        fiery: {
          ...normalizedFierySettings,
          submissionJobId: submissionJobId ?? normalizedFierySettings.submissionJobId ?? null,
          downloadedFileName: downloadMatch.fileName,
          downloadedFilePath: downloadMatch.filePath,
          downloadedAt: matchedAt.toISOString(),
        },
      };

      if (
        ripJob.status !== 'PROCESSING' ||
        normalizedFierySettings.downloadedFileName !== downloadMatch.fileName ||
        normalizedFierySettings.downloadedAt == null
      ) {
        await prisma.ripJob.update({
          where: { id: ripJob.id },
          data: {
            status: 'PROCESSING',
            sentToPrinterAt: ripJob.sentToPrinterAt ?? matchedAt,
            printSettingsJson: toJsonValue(updatedPrintSettings),
            errorMessage: null,
          },
        });

        updates.push({
          ripJobId: ripJob.id,
          oldStatus: ripJob.status,
          newStatus: 'PROCESSING',
        });
      }
      continue;
    }

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
      where: {
        ...baseWhere,
        status: { in: ['PRINTED', 'COMPLETED'] },
        printCompletedAt: { gte: today },
      },
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
