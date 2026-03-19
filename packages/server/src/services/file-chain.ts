/**
 * File Chain Service
 * 
 * Persistent print-to-cut file linking system.
 * Unifies data from Thrive RIP, Fiery DFE, and Zund cutters
 * to create traceable chains: Design → RIP → Print → Cut → Finished
 * 
 * Auto-linking daemon runs on an interval, scanning Thrive queues,
 * Fiery exports, and Zund statistics to create/update PrintCutLink records.
 */

import { prisma } from '../db/client.js';
import { 
  THRIVE_CONFIG, 
  parseQueueFile, 
  parseCutFile, 
  parseJobInfo, 
  getAllThriveJobs,
  type ThriveJob, 
  type ThriveCutJob 
} from './thrive.js';
import { 
  normalizeJobName, 
  extractIdentifiers, 
  extractCutId,
  getZundCompletedJobs 
} from './zund-match.js';
import { getAllFieryJobs } from './fiery.js';
import type { Prisma, PrintCutLink } from '@prisma/client';

// ─── Constants ─────────────────────────────────────────

const PRINT_CUT_PATTERNS = [
  /PRINTCUT/i,
  /PRINTANDCUT/i,
  /PRINT_CUT/i,
  /PRINT-CUT/i,
  /PRINT\(CUT\)/i,
  /PRINT\s*&\s*CUT/i,
  /-CUT$/i,
  /_CUT$/i,
];

const NESTING_PATTERN = /^Nesting|NESTING/i;

/** How long to look back for matching (days) */
const MATCH_LOOKBACK_DAYS = 90;

/** Stale threshold — links stuck in one stage for this many hours */
const STALE_THRESHOLD_HOURS = 48;

/** Check if a job has been dismissed by a user for a given work order */
async function isJobDismissed(workOrderId: string, jobType: string, jobIdentifier: string): Promise<boolean> {
  const dismissed = await prisma.dismissedJobLink.findUnique({
    where: {
      workOrderId_jobType_jobIdentifier: {
        workOrderId,
        jobType: jobType as any,
        jobIdentifier,
      },
    },
  });
  return !!dismissed;
}

// ─── Core Queries ──────────────────────────────────────

/**
 * Get all print-cut links for a work order
 */
export async function getOrderFileChain(workOrderId: string) {
  return prisma.printCutLink.findMany({
    where: { workOrderId },
    include: {
      workOrder: { select: { id: true, orderNumber: true, customerName: true } },
      ripJob: { select: { id: true, status: true, hotfolderName: true, ripJobGuid: true } },
      linkedBy: { select: { id: true, username: true, displayName: true } },
      confirmedBy: { select: { id: true, username: true, displayName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get a summary of the file chain for an order
 */
export async function getOrderFileChainSummary(workOrderId: string) {
  const links = await getOrderFileChain(workOrderId);
  const order = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    select: { id: true, orderNumber: true, customerName: true },
  });

  if (!order) return null;

  const totalFiles = links.length;
  const printCutFiles = links.filter(l => PRINT_CUT_PATTERNS.some(p => p.test(l.printFileName))).length;
  const linked = links.filter(l => l.cutFileName !== null).length;
  const unlinked = links.filter(l => l.cutFileName === null).length;
  const printComplete = links.filter(l => 
    ['PRINTED', 'CUT_PENDING', 'CUTTING', 'CUT_COMPLETE', 'FINISHED'].includes(l.status)
  ).length;
  const cutComplete = links.filter(l => 
    ['CUT_COMPLETE', 'FINISHED'].includes(l.status)
  ).length;

  // Overall status = worst status
  const statusPriority: Record<string, number> = {
    FAILED: 0, DESIGN: 1, SENT_TO_RIP: 2, RIPPING: 3,
    READY_TO_PRINT: 4, PRINTING: 5, PRINTED: 6,
    CUT_PENDING: 7, CUTTING: 8, CUT_COMPLETE: 9, FINISHED: 10,
  };
  const chainStatus = links.length > 0
    ? links.reduce((worst, l) => {
        const p = statusPriority[l.status] ?? 99;
        const wp = statusPriority[worst] ?? 99;
        return p < wp ? l.status : worst;
      }, links[0].status)
    : 'DESIGN';

  return {
    workOrderId: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    totalFiles,
    printCutFiles,
    linked,
    unlinked,
    printComplete,
    cutComplete,
    chainStatus,
    links,
  };
}

/**
 * Query print-cut links with filters
 */
export async function queryPrintCutLinks(filters: {
  workOrderId?: string;
  status?: string | string[];
  linkConfidence?: string;
  cutFileSource?: string;
  hasUnlinkedCut?: boolean;
  fromDate?: string | Date;
  toDate?: string | Date;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const where: Prisma.PrintCutLinkWhereInput = {};
  
  if (filters.workOrderId) where.workOrderId = filters.workOrderId;
  if (filters.status) {
    where.status = Array.isArray(filters.status) 
      ? { in: filters.status as any[] } 
      : filters.status as any;
  }
  if (filters.linkConfidence) where.linkConfidence = filters.linkConfidence as any;
  if (filters.cutFileSource) where.cutFileSource = filters.cutFileSource as any;
  if (filters.hasUnlinkedCut === true) where.cutFileName = null;
  if (filters.hasUnlinkedCut === false) where.cutFileName = { not: null };
  if (filters.fromDate || filters.toDate) {
    where.createdAt = {};
    if (filters.fromDate) where.createdAt.gte = new Date(filters.fromDate);
    if (filters.toDate) where.createdAt.lte = new Date(filters.toDate);
  }
  if (filters.search) {
    where.OR = [
      { printFileName: { contains: filters.search, mode: 'insensitive' } },
      { cutFileName: { contains: filters.search, mode: 'insensitive' } },
      { workOrder: { orderNumber: { contains: filters.search, mode: 'insensitive' } } },
      { workOrder: { customerName: { contains: filters.search, mode: 'insensitive' } } },
    ];
  }

  const page = filters.page || 1;
  const limit = filters.limit || 50;
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    prisma.printCutLink.findMany({
      where,
      include: {
        workOrder: { select: { id: true, orderNumber: true, customerName: true } },
        ripJob: { select: { id: true, status: true, hotfolderName: true } },
        linkedBy: { select: { id: true, username: true, displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.printCutLink.count({ where }),
  ]);

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

/**
 * Get dashboard summary for file chain monitoring
 */
export async function getFileChainDashboard() {
  const now = new Date();
  const staleDate = new Date(now.getTime() - STALE_THRESHOLD_HOURS * 60 * 60 * 1000);

  const [counts, recentLinks, staleLinks] = await Promise.all([
    // Status counts
    prisma.printCutLink.groupBy({
      by: ['status'],
      _count: true,
    }),
    // Recent auto-links (last 24h with cut file)
    prisma.printCutLink.findMany({
      where: {
        linkedAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
        cutFileName: { not: null },
      },
      include: {
        workOrder: { select: { id: true, orderNumber: true, customerName: true } },
      },
      orderBy: { linkedAt: 'desc' },
      take: 20,
    }),
    // Stale links (stuck in a non-terminal state for too long)
    prisma.printCutLink.findMany({
      where: {
        status: { notIn: ['FINISHED', 'FAILED', 'CUT_COMPLETE'] },
        updatedAt: { lt: staleDate },
      },
      include: {
        workOrder: { select: { id: true, orderNumber: true, customerName: true } },
      },
      orderBy: { updatedAt: 'asc' },
      take: 20,
    }),
  ]);

  const statusMap: Record<string, number> = {};
  for (const c of counts) {
    statusMap[c.status] = c._count;
  }

  const totalActive = Object.values(statusMap).reduce((a, b) => a + b, 0);
  const unlinked = await prisma.printCutLink.count({ where: { cutFileName: null } });

  return {
    totalActiveLinks: totalActive,
    pendingPrint: (statusMap['DESIGN'] || 0) + (statusMap['SENT_TO_RIP'] || 0) + (statusMap['RIPPING'] || 0) + (statusMap['READY_TO_PRINT'] || 0),
    printing: statusMap['PRINTING'] || 0,
    pendingCut: statusMap['CUT_PENDING'] || 0,
    cutting: statusMap['CUTTING'] || 0,
    completed: (statusMap['CUT_COMPLETE'] || 0) + (statusMap['FINISHED'] || 0),
    failed: statusMap['FAILED'] || 0,
    unlinkedPrintFiles: unlinked,
    recentLinks,
    staleLinks,
  };
}

// ─── Link Management ───────────────────────────────────

/**
 * Create a new print-cut link (when a file is first sent to RIP)
 */
export async function createPrintCutLink(input: {
  workOrderId: string;
  printFileName: string;
  printFilePath: string;
  printFileSize?: number;
  ripJobId?: string;
  status?: string;
}) {
  const isPrintCut = PRINT_CUT_PATTERNS.some(p => p.test(input.printFileName));
  
  // Check for existing link with same print file for this order
  const existing = await prisma.printCutLink.findFirst({
    where: {
      workOrderId: input.workOrderId,
      printFileName: input.printFileName,
    },
  });

  if (existing) {
    // Update the existing link
    return prisma.printCutLink.update({
      where: { id: existing.id },
      data: {
        printFilePath: input.printFilePath,
        printFileSize: input.printFileSize ?? existing.printFileSize,
        ripJobId: input.ripJobId ?? existing.ripJobId,
        status: (input.status ?? 'SENT_TO_RIP') as any,
      },
    });
  }

  return prisma.printCutLink.create({
    data: {
      workOrderId: input.workOrderId,
      printFileName: input.printFileName,
      printFilePath: input.printFilePath,
      printFileSize: input.printFileSize,
      ripJobId: input.ripJobId,
      status: (input.status ?? 'DESIGN') as any,
      linkConfidence: 'NONE',
    },
  });
}

/**
 * Manually link a cut file to an existing print chain
 */
export async function manuallyLinkCutFile(input: {
  printCutLinkId: string;
  cutFileName: string;
  cutFilePath: string;
  cutFileSource: string;
  userId: string;
}) {
  const ext = input.cutFileName.split('.').pop()?.toLowerCase() ?? '';
  
  return prisma.printCutLink.update({
    where: { id: input.printCutLinkId },
    data: {
      cutFileName: input.cutFileName,
      cutFilePath: input.cutFilePath,
      cutFileSource: input.cutFileSource as any,
      cutFileFormat: `.${ext}`,
      linkConfidence: 'MANUAL',
      linkedAt: new Date(),
      linkedById: input.userId,
      confirmed: true,
      confirmedAt: new Date(),
      confirmedById: input.userId,
      status: 'CUT_PENDING',
    },
  });
}

/**
 * Update the status of a print-cut link
 */
export async function updatePrintCutLinkStatus(
  linkId: string, 
  status: string, 
  extra?: Partial<Prisma.PrintCutLinkUpdateInput>
) {
  return prisma.printCutLink.update({
    where: { id: linkId },
    data: { 
      status: status as any,
      ...extra,
    },
  });
}

/**
 * Confirm an auto-linked cut file (user accepts the suggestion)
 */
export async function confirmPrintCutLink(linkId: string, userId: string) {
  const link = await prisma.printCutLink.findUnique({ where: { id: linkId } });
  if (!link) throw new Error('PrintCutLink not found');

  return prisma.printCutLink.update({
    where: { id: linkId },
    data: {
      confirmed: true,
      confirmedAt: new Date(),
      confirmedById: userId,
    },
  });
}

/**
 * Dismiss an auto-linked cut file (user rejects the suggestion)
 * Creates a DismissedJobLink to prevent re-linking, then clears cut data.
 */
export async function dismissPrintCutLink(linkId: string, userId: string) {
  const link = await prisma.printCutLink.findUnique({ where: { id: linkId } });
  if (!link) throw new Error('PrintCutLink not found');

  // Create dismissed record to prevent auto-linker from re-linking
  if (link.cutFileName && link.cutFileSource) {
    const jobType = link.cutFileSource === 'FIERY' ? 'FIERY_JOB' : 'CUT_JOB';
    const jobIdentifier = link.cutFileName;

    await prisma.dismissedJobLink.upsert({
      where: {
        workOrderId_jobType_jobIdentifier: {
          workOrderId: link.workOrderId,
          jobType: jobType as any,
          jobIdentifier,
        },
      },
      update: { dismissedById: userId },
      create: {
        workOrderId: link.workOrderId,
        jobType: jobType as any,
        jobIdentifier,
        dismissedById: userId,
      },
    });
  }

  // Determine reset status
  const resetStatus = link.printCompletedAt || 
    ['PRINTED', 'CUT_PENDING'].includes(link.status)
    ? 'PRINTED'
    : 'DESIGN';

  return prisma.printCutLink.update({
    where: { id: linkId },
    data: {
      cutFileName: null,
      cutFilePath: null,
      cutFileSize: null,
      cutFileSource: null,
      cutFileFormat: null,
      linkedAt: null,
      linkedById: null,
      linkConfidence: 'NONE',
      confirmed: false,
      confirmedAt: null,
      confirmedById: null,
      status: resetStatus as any,
    },
  });
}

// ─── Auto-Linking Engine ───────────────────────────────

/**
 * Main auto-linking daemon function.
 * Scans all sources and creates/updates PrintCutLink records.
 * Called on an interval from the server startup.
 */
export async function runAutoLinkingCycle(): Promise<{
  linksCreated: number;
  linksUpdated: number;
  errors: string[];
}> {
  const result = { linksCreated: 0, linksUpdated: 0, errors: [] as string[] };
  const SRC = 'AUTO_LINKER';

  try {
    // Phase 1: Sync RIP job status → PrintCutLink status
    await syncRipJobsToPrintCutLinks(result);
    await logChainEvent({ level: 'DEBUG', source: SRC, event: 'PHASE1_COMPLETE', message: `RIP sync done — ${result.linksUpdated} updated` });
  } catch (err: any) {
    result.errors.push(`RIP sync error: ${err.message}`);
    await logChainEvent({ level: 'ERROR', source: SRC, event: 'PHASE1_ERROR', message: err.message, success: false });
  }

  try {
    // Phase 2: Discover new print-cut files from Thrive queues
    const beforeCreated = result.linksCreated;
    await discoverThrivePrintCutFiles(result);
    const newLinks = result.linksCreated - beforeCreated;
    if (newLinks > 0) await logChainEvent({ level: 'INFO', source: SRC, event: 'PHASE2_COMPLETE', message: `Thrive discovery: ${newLinks} new links created` });
  } catch (err: any) {
    if (!err.message?.includes('ENOENT') && !err.message?.includes('ECONNREFUSED')) {
      result.errors.push(`Thrive discovery error: ${err.message}`);
      await logChainEvent({ level: 'ERROR', source: SRC, event: 'PHASE2_ERROR', message: err.message, success: false });
    }
  }

  try {
    // Phase 2.5: CutID-based linking (highest confidence matching)
    const beforeUpdated = result.linksUpdated;
    await matchByCutId(result);
    const matched = result.linksUpdated - beforeUpdated;
    if (matched > 0) await logChainEvent({ level: 'INFO', source: SRC, event: 'PHASE2_5_COMPLETE', message: `CutID matching: ${matched} links matched` });
  } catch (err: any) {
    result.errors.push(`CutID match error: ${err.message}`);
    await logChainEvent({ level: 'ERROR', source: SRC, event: 'PHASE2_5_ERROR', message: err.message, success: false });
  }

  try {
    // Phase 3: Match Thrive cut files to existing links
    const beforeUpdated = result.linksUpdated;
    await matchThriveCutFiles(result);
    const matched = result.linksUpdated - beforeUpdated;
    if (matched > 0) await logChainEvent({ level: 'INFO', source: SRC, event: 'PHASE3_COMPLETE', message: `Thrive cut matching: ${matched} links updated` });
  } catch (err: any) {
    if (!err.message?.includes('ENOENT') && !err.message?.includes('ECONNREFUSED')) {
      result.errors.push(`Thrive cut match error: ${err.message}`);
      await logChainEvent({ level: 'ERROR', source: SRC, event: 'PHASE3_ERROR', message: err.message, success: false });
    }
  }

  try {
    // Phase 4: Match Fiery .zcc cut files to existing links
    const beforeUpdated = result.linksUpdated;
    await matchFieryCutFiles(result);
    const matched = result.linksUpdated - beforeUpdated;
    if (matched > 0) await logChainEvent({ level: 'INFO', source: SRC, event: 'PHASE4_COMPLETE', message: `Fiery cut matching: ${matched} links updated` });
  } catch (err: any) {
    if (!err.message?.includes('ENOENT') && !err.message?.includes('ECONNREFUSED')) {
      result.errors.push(`Fiery cut match error: ${err.message}`);
      await logChainEvent({ level: 'ERROR', source: SRC, event: 'PHASE4_ERROR', message: err.message, success: false });
    }
  }

  try {
    // Phase 5: Match Zund completed cuts to existing links
    const beforeUpdated = result.linksUpdated;
    await matchZundCompletedCuts(result);
    const matched = result.linksUpdated - beforeUpdated;
    if (matched > 0) await logChainEvent({ level: 'INFO', source: SRC, event: 'PHASE5_COMPLETE', message: `Zund completed matching: ${matched} links updated` });
  } catch (err: any) {
    if (!err.message?.includes('ENOENT') && !err.message?.includes('ECONNREFUSED')) {
      result.errors.push(`Zund match error: ${err.message}`);
      await logChainEvent({ level: 'ERROR', source: SRC, event: 'PHASE5_ERROR', message: err.message, success: false });
    }
  }

  const total = result.linksCreated + result.linksUpdated;
  if (total > 0 || result.errors.length > 0) {
    await logChainEvent({
      level: result.errors.length > 0 ? 'WARN' : 'INFO',
      source: SRC,
      event: 'CYCLE_COMPLETE',
      message: `Auto-link cycle: ${result.linksCreated} created, ${result.linksUpdated} updated, ${result.errors.length} errors`,
      details: { linksCreated: result.linksCreated, linksUpdated: result.linksUpdated, errors: result.errors },
    });
  }

  return result;
}

/**
 * Phase 1: Sync RipJob statuses to their PrintCutLink records
 */
async function syncRipJobsToPrintCutLinks(result: { linksUpdated: number }) {
  // Find RipJobs that have PrintCutLinks
  const activeRipJobs = await prisma.ripJob.findMany({
    where: {
      status: { notIn: ['COMPLETED', 'CANCELLED', 'FAILED'] },
      printCutLinks: { some: {} },
    },
    include: {
      printCutLinks: { select: { id: true, status: true } },
    },
  });

  for (const rj of activeRipJobs) {
    const newStatus = ripJobStatusToChainStatus(rj.status);
    
    for (const link of rj.printCutLinks) {
      if (link.status !== newStatus) {
        const updateData: Prisma.PrintCutLinkUpdateInput = { status: newStatus as any };
        
        // Set timing fields based on status transitions
        if (newStatus === 'PRINTING' && rj.printStartedAt) {
          updateData.printStartedAt = rj.printStartedAt;
        }
        if (newStatus === 'PRINTED' && rj.printCompletedAt) {
          updateData.printCompletedAt = rj.printCompletedAt;
          // If this is a PRINTCUT file, advance to CUT_PENDING
          const isPrintCut = PRINT_CUT_PATTERNS.some(p => p.test(link.id)); // Check actual file
          // We'll check the print file name from a separate query if needed
        }
        
        await prisma.printCutLink.update({ where: { id: link.id }, data: updateData });
        result.linksUpdated++;
      }
    }
  }

  // Handle completed RipJobs → advance links to PRINTED or CUT_PENDING
  const completedRipJobs = await prisma.ripJob.findMany({
    where: {
      status: { in: ['PRINTED', 'COMPLETED'] },
      printCutLinks: {
        some: { status: { notIn: ['PRINTED', 'CUT_PENDING', 'CUTTING', 'CUT_COMPLETE', 'FINISHED', 'FAILED'] } },
      },
    },
    include: {
      printCutLinks: { select: { id: true, status: true, printFileName: true } },
    },
  });

  for (const rj of completedRipJobs) {
    for (const link of rj.printCutLinks) {
      const isPrintCut = PRINT_CUT_PATTERNS.some(p => p.test(link.printFileName));
      const newStatus = isPrintCut ? 'CUT_PENDING' : 'FINISHED';
      
      if (link.status !== newStatus && link.status !== 'FINISHED') {
        await prisma.printCutLink.update({
          where: { id: link.id },
          data: {
            status: newStatus as any,
            printCompletedAt: rj.printCompletedAt ?? new Date(),
            printerName: rj.hotfolderName,
          },
        });
        result.linksUpdated++;
      }
    }
  }
}

/**
 * Phase 2: Discover PRINTCUT files from Thrive print queues and create links
 */
async function discoverThrivePrintCutFiles(result: { linksCreated: number }) {
  let thriveData: { printJobs: ThriveJob[]; cutJobs: ThriveCutJob[] };
  try {
    thriveData = await getAllThriveJobs();
  } catch {
    return; // Thrive offline
  }

  for (const job of thriveData.printJobs) {
    // Only process PRINTCUT files
    const isPrintCut = PRINT_CUT_PATTERNS.some(p => p.test(job.jobName));
    if (!isPrintCut && !NESTING_PATTERN.test(job.jobName)) continue;
    
    // Need a WO number to link
    if (!job.workOrderNumber) continue;
    
    // Find the work order
    const wo = await prisma.workOrder.findFirst({
      where: { orderNumber: job.workOrderNumber },
      select: { id: true },
    });
    if (!wo) continue;
    
    // Skip if this print job was dismissed by a user
    if (job.jobGuid && await isJobDismissed(wo.id, 'PRINT_JOB', job.jobGuid)) continue;
    
    // Check if link already exists
    const existing = await prisma.printCutLink.findFirst({
      where: {
        workOrderId: wo.id,
        printFileName: job.jobName,
      },
    });
    if (existing) continue;
    
    // Determine status from Thrive status code
    const status = thriveStatusToChainStatus(job.statusCode);
    
    // Find matching RipJob
    const ripJob = await prisma.ripJob.findFirst({
      where: {
        workOrderId: wo.id,
        OR: [
          { ripJobGuid: job.jobGuid },
          { sourceFileName: { contains: normalizeJobName(job.jobName).slice(0, 30) } },
        ],
      },
      select: { id: true },
    });
    
    await prisma.printCutLink.create({
      data: {
        workOrderId: wo.id,
        printFileName: job.jobName,
        printFilePath: job.fileName || '',
        ripJobId: ripJob?.id,
        status: status as any,
        linkConfidence: 'NONE',
        printerName: job.printer,
        ripMachine: null,
        cutId: extractCutId(job.jobName),
      },
    });
    result.linksCreated++;
  }
}

/**
 * Phase 2.5: Match unlinked print chains to cut files by cutID.
 * CutIDs (e.g. P1_T1_162_57_33277349) appear in both print and cut filenames.
 * This is the highest-confidence automatic match.
 */
async function matchByCutId(result: { linksUpdated: number }) {
  // Find links that have a cutId but no cut file linked yet
  const linksWithCutId = await prisma.printCutLink.findMany({
    where: {
      cutId: { not: null },
      cutFileName: null,
      status: { in: ['PRINTED', 'CUT_PENDING'] },
      confirmed: false,
    },
  });
  if (linksWithCutId.length === 0) return;

  // Gather cut files from Thrive and Fiery
  let thriveData: { printJobs: ThriveJob[]; cutJobs: ThriveCutJob[] } | null = null;
  try { thriveData = await getAllThriveJobs(); } catch { /* offline */ }
  
  let fieryJobs: any[] = [];
  try { fieryJobs = await getAllFieryJobs(); } catch { /* offline */ }

  // Build cutID → cut file map from all sources
  const cutIdMap = new Map<string, { name: string; path: string; source: string; format: string; guid?: string }>();

  if (thriveData) {
    for (const cj of thriveData.cutJobs) {
      const cid = extractCutId(cj.jobName);
      if (cid) cutIdMap.set(cid, { name: cj.jobName, path: cj.fileName || '', source: 'THRIVE', format: '.xml', guid: cj.guid });
    }
  }

  for (const fj of fieryJobs) {
    if (!fj.hasZccCutFile || !fj.zccFileName) continue;
    const cid = extractCutId(fj.zccFileName) || extractCutId(fj.jobName || '');
    if (cid) cutIdMap.set(cid, { name: fj.zccFileName, path: fj.fileName || '', source: 'FIERY', format: '.zcc' });
  }

  // Match by cutID
  for (const link of linksWithCutId) {
    const match = cutIdMap.get(link.cutId!);
    if (!match) continue;

    // Skip if this cut file was dismissed for this work order
    const dismissJobType = match.source === 'FIERY' ? 'FIERY_JOB' : 'CUT_JOB';
    const dismissId = match.guid || match.name;
    if (await isJobDismissed(link.workOrderId, dismissJobType, dismissId)) continue;

    await prisma.printCutLink.update({
      where: { id: link.id },
      data: {
        cutFileName: match.name,
        cutFilePath: match.path,
        cutFileSource: match.source as any,
        cutFileFormat: match.format,
        linkConfidence: 'EXACT',
        linkedAt: new Date(),
        status: 'CUT_PENDING',
      },
    });
    result.linksUpdated++;
  }

  // Also backfill cutId on existing links that don't have one yet
  const linksMissingCutId = await prisma.printCutLink.findMany({
    where: { cutId: null },
    select: { id: true, printFileName: true },
  });
  for (const link of linksMissingCutId) {
    const cid = extractCutId(link.printFileName);
    if (cid) {
      await prisma.printCutLink.update({
        where: { id: link.id },
        data: { cutId: cid },
      });
    }
  }
}

/**
 * Phase 3: Match Thrive Cut Center XML files to existing print links
 */
async function matchThriveCutFiles(result: { linksUpdated: number }) {
  let thriveData: { printJobs: ThriveJob[]; cutJobs: ThriveCutJob[] };
  try {
    thriveData = await getAllThriveJobs();
  } catch {
    return;
  }

  // Get all unlinked print-cut links (no cut file yet)
  const unlinkedLinks = await prisma.printCutLink.findMany({
    where: {
      cutFileName: null,
      status: { in: ['PRINTED', 'CUT_PENDING'] },
      confirmed: false,
    },
    include: {
      workOrder: { select: { orderNumber: true } },
    },
  });

  for (const cutJob of thriveData.cutJobs) {
    const cutNormalized = normalizeJobName(cutJob.jobName);
    const cutCutId = extractCutId(cutJob.jobName);
    const cutGuidId = (cutJob as any).jobGuid || cutJob.guid;
    
    for (const link of unlinkedLinks) {
      // Skip if this cut job was dismissed for this work order
      if (cutGuidId && await isJobDismissed(link.workOrderId, 'CUT_JOB', cutGuidId)) continue;

      const printNormalized = normalizeJobName(link.printFileName);
      
      // Strategy 0: CutID match (highest confidence)
      if (cutCutId && link.cutId && cutCutId === link.cutId) {
        await linkCutToChain(link.id, cutJob, 'EXACT', result);
        break;
      }
      
      // Strategy 1: Exact normalized match
      if (cutNormalized === printNormalized) {
        await linkCutToChain(link.id, cutJob, 'EXACT', result);
        break;
      }
      
      // Strategy 2: WO number match + substring
      const cutInfo = parseJobInfo(cutJob.fileName || cutJob.jobName);
      if (cutInfo.workOrderNumber && link.workOrder.orderNumber === cutInfo.workOrderNumber) {
        if (cutNormalized.includes(printNormalized) || printNormalized.includes(cutNormalized)) {
          await linkCutToChain(link.id, cutJob, 'HIGH', result);
          break;
        } else {
          await linkCutToChain(link.id, cutJob, 'MEDIUM', result);
          break;
        }
      }
      
      // Strategy 3: GUID match (Thrive GUIDs connect print and cut)
      const cutGuid = (cutJob as any).jobGuid || cutJob.guid;
      if (cutGuid && link.ripJobId) {
        const ripJob = await prisma.ripJob.findUnique({
          where: { id: link.ripJobId },
          select: { ripJobGuid: true },
        });
        if (ripJob?.ripJobGuid && ripJob.ripJobGuid === cutGuid) {
          await linkCutToChain(link.id, cutJob, 'EXACT', result);
          break;
        }
      }
    }
  }
}

/**
 * Phase 4: Match Fiery .zcc contour files to existing print links
 */
async function matchFieryCutFiles(result: { linksUpdated: number }) {
  let fieryJobs: any[];
  try {
    fieryJobs = await getAllFieryJobs();
  } catch {
    return;
  }

  const unlinkedLinks = await prisma.printCutLink.findMany({
    where: {
      cutFileName: null,
      status: { in: ['PRINTED', 'CUT_PENDING'] },
      confirmed: false,
    },
    include: {
      workOrder: { select: { orderNumber: true } },
    },
  });

  for (const fieryJob of fieryJobs) {
    if (!fieryJob.hasZccCutFile || !fieryJob.zccFileName) continue;
    
    const fieryNormalized = normalizeJobName(fieryJob.jobName || '');
    const fieryCutId = extractCutId(fieryJob.zccFileName) || extractCutId(fieryJob.jobName || '');
    
    for (const link of unlinkedLinks) {
      // Skip if this Fiery job was dismissed for this work order
      if (fieryJob.jobId && await isJobDismissed(link.workOrderId, 'FIERY_JOB', fieryJob.jobId)) continue;

      const printNormalized = normalizeJobName(link.printFileName);
      
      // CutID match (highest confidence)
      if (fieryCutId && link.cutId && fieryCutId === link.cutId) {
        await prisma.printCutLink.update({
          where: { id: link.id },
          data: {
            cutFileName: fieryJob.zccFileName,
            cutFilePath: fieryJob.fileName || '',
            cutFileSource: 'FIERY',
            cutFileFormat: '.zcc',
            linkConfidence: 'EXACT',
            linkedAt: new Date(),
            status: 'CUT_PENDING',
          },
        });
        result.linksUpdated++;
        break;
      }
      
      // Match by normalized name or WO number
      const woMatch = fieryJob.workOrderNumber && link.workOrder.orderNumber === fieryJob.workOrderNumber;
      const nameMatch = fieryNormalized === printNormalized || 
                        fieryNormalized.includes(printNormalized) || 
                        printNormalized.includes(fieryNormalized);
      
      if (woMatch || nameMatch) {
        const confidence = (woMatch && nameMatch) ? 'EXACT' : woMatch ? 'HIGH' : 'PARTIAL';
        
        await prisma.printCutLink.update({
          where: { id: link.id },
          data: {
            cutFileName: fieryJob.zccFileName,
            cutFilePath: fieryJob.fileName || '',
            cutFileSource: 'FIERY',
            cutFileFormat: '.zcc',
            linkConfidence: confidence as any,
            linkedAt: new Date(),
            status: 'CUT_PENDING',
          },
        });
        result.linksUpdated++;
        break;
      }
    }
  }
}

/**
 * Phase 5: Match Zund completed cuts → update links to CUT_COMPLETE
 */
async function matchZundCompletedCuts(result: { linksUpdated: number }) {
  let zundJobs: any[];
  try {
    zundJobs = await getZundCompletedJobs(MATCH_LOOKBACK_DAYS);
  } catch {
    return;
  }

  // Get links that are pending cut or cutting
  const pendingCutLinks = await prisma.printCutLink.findMany({
    where: {
      status: { in: ['CUT_PENDING', 'CUTTING'] },
    },
    include: {
      workOrder: { select: { orderNumber: true } },
    },
  });

  for (const zundJob of zundJobs) {
    if (!zundJob.productionEnd) continue; // Not yet complete
    
    const zundNormalized = normalizeJobName(zundJob.jobName);
    const zundCutId = extractCutId(zundJob.jobName);
    
    for (const link of pendingCutLinks) {
      // Skip if this Zund job was dismissed for this work order
      if (await isJobDismissed(link.workOrderId, 'ZUND_COMPLETED', String(zundJob.jobId))) continue;

      // CutID match (highest confidence)
      const cutIdMatch = zundCutId && link.cutId && zundCutId === link.cutId;

      // Match by cut file name or print file name
      const printNormalized = normalizeJobName(link.printFileName);
      const cutNormalized = link.cutFileName ? normalizeJobName(link.cutFileName) : null;
      
      const matchesPrint = zundNormalized === printNormalized || 
                          zundNormalized.includes(printNormalized) || 
                          printNormalized.includes(zundNormalized);
      const matchesCut = cutNormalized && (
        zundNormalized === cutNormalized || 
        zundNormalized.includes(cutNormalized) || 
        cutNormalized.includes(zundNormalized)
      );
      
      if (cutIdMatch || matchesPrint || matchesCut) {
        await prisma.printCutLink.update({
          where: { id: link.id },
          data: {
            status: 'CUT_COMPLETE',
            cutStartedAt: zundJob.productionStart,
            cutCompletedAt: zundJob.productionEnd,
            cutterName: zundJob.cutter || 'Zund',
            cutJobName: zundJob.jobName,
            cutCopiesDone: zundJob.copyDone,
            cutCopiesTotal: zundJob.copyTotal,
            zundJobId: String(zundJob.jobId),
            // If no cut file was linked, backfill
            cutFileName: link.cutFileName || zundJob.jobName,
            cutFileSource: link.cutFileSource || ('THRIVE' as any),
            linkConfidence: (cutIdMatch || matchesCut ? 'EXACT' : 'PARTIAL') as any,
            linkedAt: link.linkedAt || new Date(),
          },
        });
        result.linksUpdated++;
        break;
      }
    }
  }
}

// ─── Helpers ───────────────────────────────────────────

/**
 * Link a Thrive cut job to an existing PrintCutLink
 */
async function linkCutToChain(
  linkId: string, 
  cutJob: ThriveCutJob, 
  confidence: string, 
  result: { linksUpdated: number }
) {
  const ext = cutJob.fileName?.split('.').pop()?.toLowerCase() ?? 'xml';
  
  await prisma.printCutLink.update({
    where: { id: linkId },
    data: {
      cutFileName: cutJob.jobName,
      cutFilePath: cutJob.fileName || '',
      cutFileSource: 'THRIVE',
      cutFileFormat: `.${ext}`,
      linkConfidence: confidence as any,
      linkedAt: new Date(),
      status: 'CUT_PENDING',
    },
  });
  result.linksUpdated++;
}

/**
 * Map RipJob status to FileChainStatus
 */
function ripJobStatusToChainStatus(ripStatus: string): string {
  switch (ripStatus) {
    case 'QUEUED': return 'SENT_TO_RIP';
    case 'PROCESSING': return 'RIPPING';
    case 'READY': return 'READY_TO_PRINT';
    case 'SENDING': return 'READY_TO_PRINT';
    case 'PRINTING': return 'PRINTING';
    case 'PRINTED': return 'PRINTED';
    case 'COMPLETED': return 'FINISHED';
    case 'FAILED': return 'FAILED';
    case 'CANCELLED': return 'FAILED';
    default: return 'DESIGN';
  }
}

/**
 * Map Thrive status code to FileChainStatus
 */
function thriveStatusToChainStatus(statusCode: number): string {
  switch (statusCode) {
    case 0: return 'SENT_TO_RIP';      // Pending
    case 4: return 'RIPPING';          // Processing
    case 8: return 'READY_TO_PRINT';   // Ready
    case 16: return 'PRINTING';        // Printing
    case 32: return 'PRINTED';         // Printed
    case 64: return 'FAILED';          // Error
    default: return 'SENT_TO_RIP';
  }
}

/**
 * Trace a single file through the entire production chain.
 * Returns where the file is and what linked files exist.
 */
export async function traceFile(fileName: string) {
  const normalized = normalizeJobName(fileName);
  
  // Search in PrintCutLink as print file or cut file
  const asprint = await prisma.printCutLink.findMany({
    where: {
      OR: [
        { printFileName: { contains: fileName, mode: 'insensitive' } },
        { cutFileName: { contains: fileName, mode: 'insensitive' } },
      ],
    },
    include: {
      workOrder: { select: { id: true, orderNumber: true, customerName: true } },
      ripJob: { select: { id: true, status: true, hotfolderName: true, ripJobGuid: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Also search RipJob directly
  const ripJobs = await prisma.ripJob.findMany({
    where: {
      sourceFileName: { contains: fileName, mode: 'insensitive' },
    },
    include: {
      workOrder: { select: { id: true, orderNumber: true, customerName: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  return {
    fileName,
    normalized,
    printCutLinks: asprint,
    ripJobs,
    hasPrinted: asprint.some(l => ['PRINTED', 'CUT_PENDING', 'CUTTING', 'CUT_COMPLETE', 'FINISHED'].includes(l.status)),
    hasCut: asprint.some(l => ['CUT_COMPLETE', 'FINISHED'].includes(l.status)),
    status: asprint.length > 0
      ? asprint.some(l => l.status === 'CUT_COMPLETE' || l.status === 'FINISHED') ? 'PRINTED_AND_CUT'
        : asprint.some(l => ['PRINTED', 'CUT_PENDING', 'CUTTING'].includes(l.status)) ? 'PRINTED_NOT_CUT'
        : 'NOT_PRINTED'
      : 'NOT_FOUND',
  };
}

// ─── Structured Logging ────────────────────────────────

/**
 * Write a structured log entry to the FileChainLog table.
 * Used by the Zund watcher, auto-linker, and manual operations
 * so the full print→cut→WO linking flow is traceable.
 */
export async function logChainEvent(entry: {
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  source: string;
  event: string;
  message: string;
  details?: Record<string, unknown>;
  cutId?: string;
  zccFileName?: string;
  printFileName?: string;
  workOrderId?: string;
  workOrderNumber?: string;
  printCutLinkId?: string;
  success?: boolean;
}): Promise<void> {
  try {
    await prisma.fileChainLog.create({
      data: {
        level: entry.level,
        source: entry.source,
        event: entry.event,
        message: entry.message,
        details: entry.details ?? undefined,
        cutId: entry.cutId,
        zccFileName: entry.zccFileName,
        printFileName: entry.printFileName,
        workOrderId: entry.workOrderId,
        workOrderNumber: entry.workOrderNumber,
        printCutLinkId: entry.printCutLinkId,
        success: entry.success ?? true,
      },
    });
  } catch (err) {
    // Logging should never crash the caller
    console.error('Failed to write FileChainLog:', err);
  }
}

/**
 * Query file chain logs with filters
 */
export async function queryFileChainLogs(filters: {
  source?: string;
  event?: string;
  level?: string;
  cutId?: string;
  workOrderId?: string;
  zccFileName?: string;
  success?: boolean;
  fromDate?: string | Date;
  toDate?: string | Date;
  limit?: number;
  page?: number;
}) {
  const where: any = {};

  if (filters.source) where.source = filters.source;
  if (filters.event) where.event = filters.event;
  if (filters.level) where.level = filters.level;
  if (filters.cutId) where.cutId = { contains: filters.cutId, mode: 'insensitive' };
  if (filters.workOrderId) where.workOrderId = filters.workOrderId;
  if (filters.zccFileName) where.zccFileName = { contains: filters.zccFileName, mode: 'insensitive' };
  if (filters.success !== undefined) where.success = filters.success;
  if (filters.fromDate || filters.toDate) {
    where.timestamp = {};
    if (filters.fromDate) where.timestamp.gte = new Date(filters.fromDate);
    if (filters.toDate) where.timestamp.lte = new Date(filters.toDate);
  }

  const limit = filters.limit || 100;
  const page = filters.page || 1;
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    prisma.fileChainLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      skip,
      take: limit,
    }),
    prisma.fileChainLog.count({ where }),
  ]);

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}
