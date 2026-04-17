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

import { promises as fs } from 'fs';
import path from 'path';
import { prisma } from '../db/client.js';
import { 
  THRIVE_CONFIG, 
  parseQueueFile, 
  parseCutFile, 
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
import { FIERY_CONFIG, getAllFieryJobs } from './fiery.js';
import { scanZundQueueFiles } from './zund-live.js';
import { WorkOrderReferenceSelect } from '../lib/dto-selects.js';
import {
  deriveFileChainLinkState,
  isCutFileName,
  isPrintFileName,
  summarizeFileChainLinks,
  summarizeFileChainTrace,
} from './file-chain-state.js';
import { repairMissingCutId } from './file-chain-cut-id.js';
import type { Prisma, PrintCutLink } from '@prisma/client';
import { buildTokenizedSearchWhere } from '../lib/fuzzy-search.js';
import { inferRoutingSource, summarizeStationProgressCounts } from '../lib/routing-defaults.js';
import {
  extractWorkOrderNumber,
  matchesWorkOrderNumber,
} from './workorder-equipment-matching.js';

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

let autoLinkingCyclePromise: Promise<{
  linksCreated: number;
  linksUpdated: number;
  errors: string[];
}> | null = null;

type AutoLinkingSnapshot = {
  thriveData: { printJobs: ThriveJob[]; cutJobs: ThriveCutJob[] } | null;
  fieryJobs: Awaited<ReturnType<typeof getAllFieryJobs>>;
  zundCompletedJobs: Awaited<ReturnType<typeof getZundCompletedJobs>>;
  queueFiles: Awaited<ReturnType<typeof scanZundQueueFiles>>;
};

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

function hasAbsolutePath(filePath: string | null | undefined): boolean {
  if (!filePath) return false;
  return path.isAbsolute(filePath) || filePath.startsWith('\\\\');
}

async function pathExists(filePath: string | null | undefined): Promise<boolean> {
  if (!filePath) return false;
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveCutFilePath(
  link: Pick<PrintCutLink, 'cutFileName' | 'cutFilePath' | 'cutFileSource'>,
): Promise<string | null> {
  const storedPath = link.cutFilePath?.trim() || null;

  if (storedPath && hasAbsolutePath(storedPath)) {
    return storedPath;
  }

  if (link.cutFileSource === 'FIERY' && link.cutFileName) {
    const fieryPath = path.join(FIERY_CONFIG.exportPath, link.cutFileName);
    if (await pathExists(fieryPath)) {
      return fieryPath;
    }
  }

  if (link.cutFileSource === 'THRIVE') {
    const candidateNames = new Set<string>();
    if (storedPath) {
      const storedName = path.basename(storedPath);
      if (/\.(xml|xml_tmp)$/i.test(storedName)) {
        candidateNames.add(storedName);
      }
    }
    if (link.cutFileName && /\.(xml|xml_tmp)$/i.test(link.cutFileName)) {
      candidateNames.add(path.basename(link.cutFileName));
    }

    for (const machine of THRIVE_CONFIG.machines) {
      for (const candidateName of candidateNames) {
        const thrivePath = path.join(machine.cutterPath, candidateName);
        if (await pathExists(thrivePath)) {
          return thrivePath;
        }
      }
    }
  }

  return storedPath;
}

// ─── Core Queries ──────────────────────────────────────

/**
 * Get all print-cut links for a work order
 */
async function loadOrderFileChainLinks(workOrderId: string) {
  const links = await prisma.printCutLink.findMany({
    where: { workOrderId },
    include: {
      workOrder: { select: WorkOrderReferenceSelect },
      ripJob: {
        select: {
          id: true,
          status: true,
          hotfolderName: true,
          ripJobGuid: true,
          rippedAt: true,
          printStartedAt: true,
          printCompletedAt: true,
        },
      },
      linkedBy: { select: { id: true, username: true, displayName: true } },
      confirmedBy: { select: { id: true, username: true, displayName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return Promise.all(
    links.map(async (link) => {
      const cutFilePath = await resolveCutFilePath(link);
      return {
        ...link,
        cutFilePath,
        cutId: repairMissingCutId({
          cutId: link.cutId,
          printFileName: link.printFileName,
          printFilePath: link.printFilePath,
          cutFileName: link.cutFileName,
          cutFilePath,
        }),
        ...deriveFileChainLinkState(link),
      };
    }),
  );
}

type OrderFileChainLink = Awaited<ReturnType<typeof loadOrderFileChainLinks>>[number];

function normalizeFileChainStem(value: string | null | undefined): string {
  const candidate = value?.trim() ?? '';
  if (!candidate) return '';

  const withoutQuery = candidate.split(/[?#]/, 1)[0];
  const baseName = path.basename(withoutQuery);
  const shouldStripExtension = isPrintFileName(baseName) || isCutFileName(baseName);
  const stem = shouldStripExtension && baseName.includes('.')
    ? baseName.slice(0, baseName.lastIndexOf('.'))
    : baseName;
  return stem.replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

function isPlaceholderFileChainLink(link: OrderFileChainLink): boolean {
  return (
    link.status === 'DESIGN' &&
    link.linkConfidence === 'NONE' &&
    !link.hasPrintFile &&
    !link.hasCutFile
  );
}

export function selectFileChainSummaryLinks(links: OrderFileChainLink[]): OrderFileChainLink[] {
  return links.filter((link) => !isPlaceholderFileChainLink(link));
}

function getFileChainGroupingKeys(link: Pick<
  OrderFileChainLink,
  'cutId' | 'printFileName' | 'printFilePath' | 'cutFileName' | 'cutFilePath'
>): string[] {
  const keys = new Set<string>();

  if (link.cutId?.trim()) {
    keys.add(`cutId:${link.cutId.trim().toLowerCase()}`);
  }

  const stemCandidates = [link.printFileName, link.printFilePath, link.cutFileName, link.cutFilePath];
  for (const candidate of stemCandidates) {
    const stem = normalizeFileChainStem(candidate);
    if (stem) {
      keys.add(`stem:${stem}`);
      break;
    }
  }

  return [...keys];
}

function pickPrimaryFileChainLink(group: OrderFileChainLink[]): OrderFileChainLink {
  return group.find((link) => link.hasPrintFile) ?? group[0];
}

function pickCutFileChainLink(group: OrderFileChainLink[]): OrderFileChainLink | null {
  return group.find((link) => link.hasCutFile) ?? null;
}

function pickFirstDefined<T>(...values: Array<T | null | undefined>): T | null {
  for (const value of values) {
    if (value !== null && value !== undefined) {
      return value;
    }
  }
  return null;
}

export function groupOrderFileChainLinksForDisplay(links: OrderFileChainLink[]): OrderFileChainLink[] {
  const normalizedLinks = links.map((link) =>
    'hasPrintFile' in link && 'hasCutFile' in link
      ? link
      : (Object.assign({}, link, deriveFileChainLinkState(link as any)) as OrderFileChainLink),
  );

  const grouped: OrderFileChainLink[][] = [];
  const keyToGroup = new Map<string, OrderFileChainLink[]>();

  for (const link of normalizedLinks) {
    const keys = getFileChainGroupingKeys(link);
    const existingGroup = keys.map((key) => keyToGroup.get(key)).find((group): group is OrderFileChainLink[] => !!group);

    if (existingGroup) {
      existingGroup.push(link);
      for (const key of keys) {
        keyToGroup.set(key, existingGroup);
      }
      continue;
    }

    const group = [link];
    grouped.push(group);
    for (const key of keys) {
      keyToGroup.set(key, group);
    }
  }

  return grouped
    .map((group) => {
      const primary = pickPrimaryFileChainLink(group);
      const cutLink = pickCutFileChainLink(group);
      const displayLink = (cutLink ?? primary) as OrderFileChainLink;

      const merged: OrderFileChainLink = {
        ...primary,
        ...displayLink,
        id: displayLink.id,
        createdAt: primary.createdAt,
        updatedAt: group.reduce((latest, link) => (link.updatedAt > latest.updatedAt ? link : latest), primary).updatedAt,
        printFileName: pickFirstDefined(primary.printFileName, displayLink.printFileName) ?? '',
        printFilePath: pickFirstDefined(primary.printFilePath, displayLink.printFilePath) ?? '',
        cutFileName: pickFirstDefined(cutLink?.cutFileName, primary.cutFileName, displayLink.cutFileName) ?? null,
        cutFilePath: pickFirstDefined(cutLink?.cutFilePath, primary.cutFilePath, displayLink.cutFilePath) ?? null,
        cutFileSource: pickFirstDefined(cutLink?.cutFileSource, primary.cutFileSource, displayLink.cutFileSource) ?? null,
        cutFileFormat: pickFirstDefined(cutLink?.cutFileFormat, primary.cutFileFormat, displayLink.cutFileFormat) ?? null,
        cutId: pickFirstDefined(cutLink?.cutId, primary.cutId, displayLink.cutId) ?? null,
        ripJobId: pickFirstDefined(primary.ripJobId, displayLink.ripJobId) ?? null,
        ripJob: pickFirstDefined(primary.ripJob, displayLink.ripJob) ?? null,
        linkedById: pickFirstDefined(primary.linkedById, displayLink.linkedById) ?? null,
        linkedBy: pickFirstDefined(primary.linkedBy, displayLink.linkedBy) ?? null,
        confirmed: group.some((link) => link.confirmed),
        confirmedAt:
          pickFirstDefined(
            group.find((link) => link.confirmedAt)?.confirmedAt,
            primary.confirmedAt,
            displayLink.confirmedAt,
          ) ?? null,
        confirmedById:
          pickFirstDefined(
            group.find((link) => link.confirmedById)?.confirmedById,
            primary.confirmedById,
            displayLink.confirmedById,
          ) ?? null,
        confirmedBy:
          pickFirstDefined(
            group.find((link) => link.confirmedBy)?.confirmedBy,
            primary.confirmedBy,
            displayLink.confirmedBy,
          ) ?? null,
        printStartedAt:
          pickFirstDefined(
            primary.printStartedAt,
            displayLink.printStartedAt,
            group.find((link) => link.printStartedAt && link.hasPrintFile)?.printStartedAt,
          ) ?? null,
        printCompletedAt:
          pickFirstDefined(
            primary.printCompletedAt,
            displayLink.printCompletedAt,
            group.find((link) => link.printCompletedAt && link.hasPrintFile)?.printCompletedAt,
          ) ?? null,
        printerName: pickFirstDefined(primary.printerName, displayLink.printerName) ?? null,
        ripMachine: pickFirstDefined(primary.ripMachine, displayLink.ripMachine) ?? null,
        cutStartedAt: pickFirstDefined(cutLink?.cutStartedAt, primary.cutStartedAt, displayLink.cutStartedAt) ?? null,
        cutCompletedAt: pickFirstDefined(cutLink?.cutCompletedAt, primary.cutCompletedAt, displayLink.cutCompletedAt) ?? null,
        cutterName: pickFirstDefined(cutLink?.cutterName, primary.cutterName, displayLink.cutterName) ?? null,
        cutJobName: pickFirstDefined(cutLink?.cutJobName, primary.cutJobName, displayLink.cutJobName) ?? null,
        cutCopiesDone: pickFirstDefined(cutLink?.cutCopiesDone, primary.cutCopiesDone, displayLink.cutCopiesDone) ?? null,
        cutCopiesTotal: pickFirstDefined(cutLink?.cutCopiesTotal, primary.cutCopiesTotal, displayLink.cutCopiesTotal) ?? null,
        zundJobId: pickFirstDefined(cutLink?.zundJobId, primary.zundJobId, displayLink.zundJobId) ?? null,
        zundMaterialGuid: pickFirstDefined(cutLink?.zundMaterialGuid, primary.zundMaterialGuid, displayLink.zundMaterialGuid) ?? null,
        cuttingTimeMs: pickFirstDefined(cutLink?.cuttingTimeMs, primary.cuttingTimeMs, displayLink.cuttingTimeMs) ?? null,
        setupTimeMs: pickFirstDefined(cutLink?.setupTimeMs, primary.setupTimeMs, displayLink.setupTimeMs) ?? null,
        cutLengthMm: pickFirstDefined(cutLink?.cutLengthMm, primary.cutLengthMm, displayLink.cutLengthMm) ?? null,
        status: primary.status,
        linkConfidence:
          pickFirstDefined(
            group.find((link) => link.linkConfidence && link.linkConfidence !== 'NONE')?.linkConfidence,
            primary.linkConfidence,
            displayLink.linkConfidence,
          ) ?? primary.linkConfidence,
        errorMessage: pickFirstDefined(group.find((link) => link.errorMessage)?.errorMessage, primary.errorMessage, displayLink.errorMessage) ?? null,
      };

      return {
        ...merged,
        ...deriveFileChainLinkState(merged),
      };
    })
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
}

/**
 * Get all print-cut links for a work order
 */
export async function getOrderFileChain(workOrderId: string) {
  const links = await loadOrderFileChainLinks(workOrderId);
  return groupOrderFileChainLinksForDisplay(links);
}

/**
 * Get a summary of the file chain for an order
 */
export async function getOrderFileChainSummary(workOrderId: string) {
  const [links, order] = await Promise.all([
    getOrderFileChain(workOrderId),
    prisma.workOrder.findUnique({
      where: { id: workOrderId },
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        description: true,
        createdAt: true,
        routing: true,
        stationProgress: {
          select: {
            station: true,
            status: true,
          },
        },
      },
    }),
  ]);

  if (!order) return null;

  const stationProgressCounts = summarizeStationProgressCounts(order.routing, order.stationProgress, {
    source: inferRoutingSource(order.orderNumber, order.customerName ?? order.description),
    entryTimestamp: order.createdAt,
  });
  const summaryLinks = selectFileChainSummaryLinks(links);
  const totalFiles = summaryLinks.length;
  const printCutFiles = summaryLinks.filter((link) => link.hasPrintFile && link.hasCutFile).length;
  const linked = summaryLinks.filter((link) => link.cutFileName !== null).length;
  const unlinked = summaryLinks.filter((link) => link.cutFileName === null).length;
  const { printComplete, cutComplete, chainStatus } = summarizeFileChainLinks(summaryLinks);

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
    completedStationCount: stationProgressCounts.completedStationCount,
    chainStatus,
    normalizedLinks: summaryLinks,
    links,
  };
}

type LinkedFileChainSummaryShape = {
  totalFiles: number;
  printCutFiles: number;
  linked: number;
  unlinked: number;
  printComplete: number;
  cutComplete: number;
  completedStationCount: number;
  chainStatus: string;
};

type LinkedFileChainLinkShape = {
  id: string;
  printFileName: string;
  cutFileName: string | null;
  cutId: string | null;
  status: string;
  printStatus: string;
  cutStatus: string;
  printedAt: Date | string | null;
  cutCompletedAt: Date | string | null;
};

type PrintCutLinkCreateClient = {
  printCutLink: {
    create: (args: {
      data: Prisma.PrintCutLinkUncheckedCreateInput;
    }) => Promise<PrintCutLink>;
  };
};

export function formatLinkedFileChainSummary(
  fileChainSummary: Awaited<ReturnType<typeof getOrderFileChainSummary>> | null,
): {
  fileChainSummary: LinkedFileChainSummaryShape | null;
  fileChainLinks: LinkedFileChainLinkShape[];
  latestFileChainLinks: LinkedFileChainLinkShape[];
} {
  if (!fileChainSummary) {
    return {
      fileChainSummary: null,
      fileChainLinks: [],
      latestFileChainLinks: [],
    };
  }

  const fileChainLinks = fileChainSummary.links.map((link) => ({
    id: link.id,
    printFileName: link.printFileName,
    cutFileName: link.cutFileName ?? null,
    cutId: link.cutId ?? null,
    status: link.effectiveStatus,
    printStatus: link.printStatus,
    cutStatus: link.cutStatus,
    printedAt: link.printedAt,
    cutCompletedAt: link.cutCompletedAt,
  }));

  return {
    fileChainSummary: {
      totalFiles: fileChainSummary.totalFiles,
      printCutFiles: fileChainSummary.printCutFiles,
      linked: fileChainSummary.linked,
      unlinked: fileChainSummary.unlinked,
      printComplete: fileChainSummary.printComplete,
      cutComplete: fileChainSummary.cutComplete,
      completedStationCount: fileChainSummary.completedStationCount,
      chainStatus: fileChainSummary.chainStatus,
    },
    fileChainLinks,
    latestFileChainLinks: fileChainLinks.slice(0, 5),
  };
}

export function buildPlaceholderPrintCutLinkData(input: {
  workOrderId: string;
  orderNumber?: string;
  printFileName?: string;
  printFilePath?: string;
  status?: string;
}): Prisma.PrintCutLinkUncheckedCreateInput {
  const printFileName = input.printFileName ?? input.orderNumber ?? '';
  const extractedCutId = extractCutId(printFileName) ?? undefined;

  return {
    workOrderId: input.workOrderId,
    printFileName,
    printFilePath: input.printFilePath ?? '',
    status: (input.status ?? 'DESIGN') as any,
    linkConfidence: 'NONE',
    cutId: extractedCutId,
  };
}

export async function createPlaceholderPrintCutLinkRow(
  client: PrintCutLinkCreateClient,
  input: {
    workOrderId: string;
    orderNumber: string;
    status?: string;
  },
) {
  return client.printCutLink.create({
    data: buildPlaceholderPrintCutLinkData(input),
  });
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
    const searchWhere = buildTokenizedSearchWhere(filters.search, [
      'printFileName',
      'cutFileName',
      'workOrder.orderNumber',
      'workOrder.customerName',
    ]);
    if (searchWhere) {
      Object.assign(where, searchWhere);
    }
  }

  const page = filters.page || 1;
  const limit = filters.limit || 50;
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    prisma.printCutLink.findMany({
      where,
      include: {
          workOrder: { select: WorkOrderReferenceSelect },
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
          workOrder: { select: WorkOrderReferenceSelect },
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
          workOrder: { select: WorkOrderReferenceSelect },
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
  const extractedCutId =
    extractCutId(input.printFileName) ||
    extractCutId(path.basename(input.printFilePath || '')) ||
    null;
  
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
        cutId: existing.cutId ?? extractedCutId ?? undefined,
      },
    });
  }

  return prisma.printCutLink.create({
    data: {
      ...buildPlaceholderPrintCutLinkData({
        workOrderId: input.workOrderId,
        printFileName: input.printFileName,
        printFilePath: input.printFilePath,
        status: input.status,
      }),
      printFileSize: input.printFileSize,
      ripJobId: input.ripJobId,
      cutId: extractedCutId ?? undefined,
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
async function selectBestPrintCutLinkForCutAttachment(input: {
  workOrderId: string;
  orderNumber: string;
  cutId?: string | null;
  cutFileName: string;
}) {
  const links = await prisma.printCutLink.findMany({
    where: { workOrderId: input.workOrderId },
    orderBy: { updatedAt: 'desc' },
  });

  const normalizedCutId = input.cutId?.toLowerCase() || null;
  const normalizedCutName = input.cutFileName.toLowerCase();

  const byCutId = normalizedCutId
    ? links.find((link) => link.cutId?.toLowerCase() === normalizedCutId)
    : null;
  if (byCutId) return byCutId;

  const byCutName = links.find((link) => link.cutFileName?.toLowerCase() === normalizedCutName);
  if (byCutName) return byCutName;

  const byUnlinkedPrint = links.find(
    (link) => !link.cutFileName && link.printFileName !== input.orderNumber,
  );
  if (byUnlinkedPrint) return byUnlinkedPrint;

  const byAnyUnlinked = links.find((link) => !link.cutFileName);
  if (byAnyUnlinked) return byAnyUnlinked;

  return createPrintCutLink({
    workOrderId: input.workOrderId,
    printFileName: input.orderNumber,
    printFilePath: '',
    status: 'PRINTED',
  });
}

export async function ensureCutFileLinkedToOrder(input: {
  workOrderId: string;
  orderNumber: string;
  cutFileName: string;
  cutFilePath?: string | null;
  cutFileSource: 'THRIVE' | 'FIERY' | 'MANUAL' | 'ZUND_CENTER';
  cutFileFormat?: string | null;
  cutId?: string | null;
  linkedById?: string | null;
  status?: 'CUT_PENDING' | 'CUTTING' | 'CUT_COMPLETE' | 'FINISHED';
}) {
  const target = await selectBestPrintCutLinkForCutAttachment(input);
  const nextStatus =
    target.status === 'CUT_COMPLETE' || target.status === 'FINISHED'
      ? target.status
      : (input.status ?? 'CUT_PENDING');

  const data: Prisma.PrintCutLinkUpdateInput = {
    cutFileName: input.cutFileName,
    cutFilePath: input.cutFilePath ?? null,
    cutFileSource: input.cutFileSource as any,
    cutFileFormat: input.cutFileFormat ?? null,
    cutId: target.cutId ?? input.cutId ?? undefined,
    linkedAt: new Date(),
    status: nextStatus as any,
  };

  if (input.linkedById) {
    data.linkConfidence = 'MANUAL';
    data.linkedBy = { connect: { id: input.linkedById } };
    data.confirmed = true;
    data.confirmedAt = new Date();
    data.confirmedBy = { connect: { id: input.linkedById } };
  }

  return prisma.printCutLink.update({
    where: { id: target.id },
    data,
  });
}

export async function clearManualCutFileLinkForOrder(input: {
  workOrderId: string;
  cutFileName?: string | null;
  cutFilePath?: string | null;
  cutId?: string | null;
}) {
  const links = await prisma.printCutLink.findMany({
    where: {
      workOrderId: input.workOrderId,
      linkConfidence: 'MANUAL',
    },
  });

  const normalizedCutId = input.cutId?.toLowerCase() || null;
  const normalizedCutName = input.cutFileName?.toLowerCase() || null;
  const normalizedCutPath = input.cutFilePath?.toLowerCase() || null;

  const matchingLinks = links.filter((link) => {
    if (normalizedCutId && link.cutId?.toLowerCase() === normalizedCutId) return true;
    if (normalizedCutName && link.cutFileName?.toLowerCase() === normalizedCutName) return true;
    if (normalizedCutPath && link.cutFilePath?.toLowerCase() === normalizedCutPath) return true;
    return false;
  });

  let cleared = 0;
  for (const link of matchingLinks) {
    const resetStatus =
      link.printCompletedAt || ['PRINTED', 'CUT_PENDING'].includes(link.status)
        ? 'PRINTED'
        : 'DESIGN';

    await prisma.printCutLink.update({
      where: { id: link.id },
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
    cleared++;
  }

  return cleared;
}

export async function syncManualJobLinksToPrintCutLinks(options?: {
  workOrderId?: string;
}, snapshot?: Partial<AutoLinkingSnapshot>) {
  const manualLinks = await prisma.manualJobLink.findMany({
    where: {
      ...(options?.workOrderId ? { workOrderId: options.workOrderId } : {}),
      jobType: { in: ['CUT_JOB', 'ZUND_QUEUE', 'ZUND_COMPLETED', 'FIERY_JOB'] as any },
    },
    include: {
      workOrder: { select: { id: true, orderNumber: true } },
    },
  });

  if (manualLinks.length === 0) return 0;

  const hasThriveSnapshot = snapshot ? 'thriveData' in snapshot : false;
  const hasQueueFilesSnapshot = snapshot ? 'queueFiles' in snapshot : false;
  const hasFieryJobsSnapshot = snapshot ? 'fieryJobs' in snapshot : false;
  const hasZundCompletedSnapshot = snapshot ? 'zundCompletedJobs' in snapshot : false;

  let thriveData: { printJobs: ThriveJob[]; cutJobs: ThriveCutJob[] } | null = hasThriveSnapshot
    ? snapshot?.thriveData ?? null
    : null;
  let queueFiles: Awaited<ReturnType<typeof scanZundQueueFiles>> = hasQueueFilesSnapshot
    ? snapshot?.queueFiles ?? []
    : [];
  let fieryJobs: Awaited<ReturnType<typeof getAllFieryJobs>> = hasFieryJobsSnapshot
    ? snapshot?.fieryJobs ?? []
    : [];
  let zundCompletedJobs: Awaited<ReturnType<typeof getZundCompletedJobs>> = hasZundCompletedSnapshot
    ? snapshot?.zundCompletedJobs ?? []
    : [];

  if (!hasThriveSnapshot && manualLinks.some((link) => link.jobType === 'CUT_JOB')) {
    try {
      thriveData = await getAllThriveJobs();
    } catch {
      thriveData = null;
    }
  }

  if (!hasQueueFilesSnapshot && manualLinks.some((link) => link.jobType === 'ZUND_QUEUE')) {
    try {
      queueFiles = await scanZundQueueFiles(200);
    } catch {
      queueFiles = [];
    }
  }

  if (!hasFieryJobsSnapshot && manualLinks.some((link) => link.jobType === 'FIERY_JOB')) {
    try {
      fieryJobs = await getAllFieryJobs();
    } catch {
      fieryJobs = [];
    }
  }

  if (!hasZundCompletedSnapshot && manualLinks.some((link) => link.jobType === 'ZUND_COMPLETED')) {
    try {
      zundCompletedJobs = await getZundCompletedJobs(MATCH_LOOKBACK_DAYS);
    } catch {
      zundCompletedJobs = [];
    }
  }

  let synced = 0;

  for (const link of manualLinks) {
    let cutFileName: string | null = null;
    let cutFilePath: string | null = null;
    let cutFileFormat: string | null = null;
    let cutFileSource: 'THRIVE' | 'FIERY' | 'MANUAL' | 'ZUND_CENTER' | null = null;
    let cutId: string | null = null;

    if (link.jobType === 'CUT_JOB') {
      const cutJob = thriveData?.cutJobs.find(
        (job) => job.guid?.toLowerCase() === link.jobIdentifier.toLowerCase(),
      );
      cutFileName = cutJob?.jobName || link.jobName;
      cutFilePath = cutJob?.filePath || cutJob?.fileName || null;
      cutFileFormat = cutJob?.fileName ? path.extname(cutJob.fileName) || '.xml' : '.xml';
      cutFileSource = 'THRIVE';
      cutId = extractCutId(cutJob?.jobName || cutJob?.fileName || link.jobName || '') || null;
    } else if (link.jobType === 'ZUND_QUEUE') {
      const queueFile = queueFiles.find((file) => file.fileName === link.jobIdentifier);
      cutFileName = queueFile?.fileName || link.jobIdentifier;
      cutFilePath = queueFile?.fullPath || null;
      cutFileFormat = path.extname(cutFileName) || '.zcc';
      cutFileSource = 'ZUND_CENTER';
      cutId =
        extractCutId(queueFile?.zccData.jobName || '') ||
        extractCutId(queueFile?.fileName || '') ||
        extractCutId(link.jobName || '') ||
        null;
    } else if (link.jobType === 'ZUND_COMPLETED') {
      const jobId = Number(link.jobIdentifier);
      const completedJob = zundCompletedJobs.find((job: any) => job.jobId === jobId);
      cutFileName = completedJob?.jobName || link.jobName;
      cutFilePath = null;
      cutFileFormat = path.extname(cutFileName) || '.zcc';
      cutFileSource = 'ZUND_CENTER';
      cutId = extractCutId(completedJob?.jobName || link.jobName || '') || null;
    } else if (link.jobType === 'FIERY_JOB') {
      const fieryJob = fieryJobs.find((job: any) => job.jobId === link.jobIdentifier);
      cutFileName = fieryJob?.zccFileName || link.jobName;
      cutFilePath =
        fieryJob?.zccFilePath ||
        (fieryJob?.zccFileName ? path.join(FIERY_CONFIG.exportPath, fieryJob.zccFileName) : null);
      cutFileFormat = cutFileName ? path.extname(cutFileName) || '.zcc' : '.zcc';
      cutFileSource = 'FIERY';
      cutId =
        extractCutId(fieryJob?.zccFileName || '') ||
        extractCutId(fieryJob?.jobName || '') ||
        extractCutId(link.jobName || '') ||
        null;
    }

    if (!cutFileName || !cutFileSource) continue;

    await ensureCutFileLinkedToOrder({
      workOrderId: link.workOrderId,
      orderNumber: link.workOrder.orderNumber,
      cutFileName,
      cutFilePath,
      cutFileSource,
      cutFileFormat,
      cutId,
      linkedById: link.linkedById,
      status: 'CUT_PENDING',
    });
    synced++;
  }

  return synced;
}

async function runAutoLinkingCycleInternal(): Promise<{
  linksCreated: number;
  linksUpdated: number;
  errors: string[];
}> {
  const result = { linksCreated: 0, linksUpdated: 0, errors: [] as string[] };
  const SRC = 'AUTO_LINKER';
  const snapshot: Partial<AutoLinkingSnapshot> = {};

  try {
    // Phase 1: Sync RIP job status → PrintCutLink status
    await syncRipJobsToPrintCutLinks(result);
    await logChainEvent({ level: 'DEBUG', source: SRC, event: 'PHASE1_COMPLETE', message: `RIP sync done — ${result.linksUpdated} updated` });
  } catch (err: any) {
    result.errors.push(`RIP sync error: ${err.message}`);
    await logChainEvent({ level: 'ERROR', source: SRC, event: 'PHASE1_ERROR', message: err.message, success: false });
  }

  [snapshot.thriveData, snapshot.fieryJobs, snapshot.zundCompletedJobs] = await Promise.all([
    getAllThriveJobs().catch(() => null),
    getAllFieryJobs().catch(() => [] as Awaited<ReturnType<typeof getAllFieryJobs>>),
    getZundCompletedJobs(MATCH_LOOKBACK_DAYS).catch(() => [] as Awaited<ReturnType<typeof getZundCompletedJobs>>),
  ]);

  try {
    // Phase 2: Discover new print-cut files from Thrive queues
    const beforeCreated = result.linksCreated;
    await discoverThrivePrintCutFiles(result, snapshot.thriveData ?? null);
    const newLinks = result.linksCreated - beforeCreated;
    if (newLinks > 0) await logChainEvent({ level: 'INFO', source: SRC, event: 'PHASE2_COMPLETE', message: `Thrive discovery: ${newLinks} new links created` });
  } catch (err: any) {
    if (!err.message?.includes('ENOENT') && !err.message?.includes('ECONNREFUSED')) {
      result.errors.push(`Thrive discovery error: ${err.message}`);
      await logChainEvent({ level: 'ERROR', source: SRC, event: 'PHASE2_ERROR', message: err.message, success: false });
    }
  }

  try {
    // Phase 2.25: Promote manual equipment links into persistent file-chain rows
    const beforeUpdated = result.linksUpdated;
    const synced = await syncManualJobLinksToPrintCutLinks(undefined, snapshot);
    result.linksUpdated += synced;
    const matched = result.linksUpdated - beforeUpdated;
    if (matched > 0) {
      await logChainEvent({
        level: 'INFO',
        source: SRC,
        event: 'PHASE2_25_COMPLETE',
        message: `Manual link sync: ${matched} links updated`,
      });
    }
  } catch (err: any) {
    result.errors.push(`Manual link sync error: ${err.message}`);
    await logChainEvent({ level: 'ERROR', source: SRC, event: 'PHASE2_25_ERROR', message: err.message, success: false });
  }

  try {
    // Phase 2.5: CutID-based linking (highest confidence matching)
    const beforeUpdated = result.linksUpdated;
    await matchByCutId(result, snapshot);
    const matched = result.linksUpdated - beforeUpdated;
    if (matched > 0) await logChainEvent({ level: 'INFO', source: SRC, event: 'PHASE2_5_COMPLETE', message: `CutID matching: ${matched} links matched` });
  } catch (err: any) {
    result.errors.push(`CutID match error: ${err.message}`);
    await logChainEvent({ level: 'ERROR', source: SRC, event: 'PHASE2_5_ERROR', message: err.message, success: false });
  }

  try {
    // Phase 3: Match Thrive cut files to existing links
    const beforeUpdated = result.linksUpdated;
    await matchThriveCutFiles(result, snapshot.thriveData ?? null);
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
    await matchFieryCutFiles(result, snapshot.fieryJobs ?? []);
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
    await matchZundCompletedCuts(result, snapshot.zundCompletedJobs ?? []);
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

export async function runAutoLinkingCycle(): Promise<{
  linksCreated: number;
  linksUpdated: number;
  errors: string[];
}> {
  if (autoLinkingCyclePromise) {
    return autoLinkingCyclePromise;
  }

  autoLinkingCyclePromise = runAutoLinkingCycleInternal().finally(() => {
    autoLinkingCyclePromise = null;
  });

  return autoLinkingCyclePromise;
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
      printCutLinks: { select: { id: true, status: true, printFileName: true } },
    },
  });

  for (const rj of activeRipJobs) {
    const newStatus = ripJobStatusToChainStatus(rj.status);
    
    for (const link of rj.printCutLinks) {
      if (!isPrintFileName(link.printFileName)) continue;

      if (link.status !== newStatus) {
        const updateData: Prisma.PrintCutLinkUpdateInput = { status: newStatus as any };
        
        // Set timing fields based on status transitions
        if (newStatus === 'PRINTING' && rj.printStartedAt) {
          updateData.printStartedAt = rj.printStartedAt;
        }
        if (newStatus === 'PRINTED' && rj.printCompletedAt) {
          updateData.printCompletedAt = rj.printCompletedAt;
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
      if (!isPrintFileName(link.printFileName)) continue;
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
async function discoverThrivePrintCutFiles(
  result: { linksCreated: number },
  thriveData: { printJobs: ThriveJob[]; cutJobs: ThriveCutJob[] } | null,
) {
  if (!thriveData) return;

  for (const job of thriveData.printJobs) {
    // Only process PRINTCUT files
    const isPrintCut = PRINT_CUT_PATTERNS.some(p => p.test(job.jobName));
    if (!isPrintCut && !NESTING_PATTERN.test(job.jobName)) continue;
    
    // Need a WO number to link
    if (!job.workOrderNumber) continue;
    
    // Find the work order
    const woNumber = job.workOrderNumber;
    const wo = await prisma.workOrder.findFirst({
      where: woNumber.length === 4
        ? {
            OR: [
              { orderNumber: woNumber },
              { orderNumber: `WO${woNumber}` },
              { orderNumber: { endsWith: woNumber } },
            ],
          }
        : {
            OR: [
              { orderNumber: woNumber },
              { orderNumber: `WO${woNumber}` },
              { orderNumber: { contains: woNumber } },
            ],
          },
      select: { id: true },
    });
    if (!wo) continue;
    
    // Skip if this print job was dismissed by a user
    if (job.jobGuid && await isJobDismissed(wo.id, 'PRINT_JOB', job.jobGuid)) continue;
    
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

    const cutId =
      job.cutId ||
      extractCutId(job.jobName) ||
      extractCutId(path.basename(job.fileName || '')) ||
      null;

    // Reuse an existing chain row when Thrive is describing the same RIP-backed job.
    const existing = await prisma.printCutLink.findFirst({
      where: {
        workOrderId: wo.id,
        OR: [
          { printFileName: job.jobName },
          ...(ripJob?.id ? [{ ripJobId: ripJob.id }] : []),
        ],
      },
    });
    if (existing) {
      const updateData: Prisma.PrintCutLinkUpdateInput = {
        status: status as any,
        printerName: job.printer,
      };

      if (ripJob?.id && ripJob.id !== existing.ripJobId) {
        updateData.ripJob = { connect: { id: ripJob.id } };
      }

      if (!existing.cutId && cutId) {
        updateData.cutId = cutId;
      }
      if (!existing.printFilePath && job.fileName) {
        updateData.printFilePath = job.fileName;
      }

      await prisma.printCutLink.update({
        where: { id: existing.id },
        data: updateData,
      });
      continue;
    }
    
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
        cutId,
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
async function matchByCutId(
  result: { linksUpdated: number },
  snapshot: Partial<AutoLinkingSnapshot> = {},
) {
  // Backfill cutId before matching so RIP/manual-created links are eligible immediately.
  const linksMissingCutId = await prisma.printCutLink.findMany({
    where: { cutId: null },
    select: { id: true, printFileName: true, printFilePath: true },
  });
  for (const link of linksMissingCutId) {
    const cid = repairMissingCutId({
      printFileName: link.printFileName,
      printFilePath: link.printFilePath,
    });
    if (cid) {
      await prisma.printCutLink.update({
        where: { id: link.id },
        data: { cutId: cid },
      });
    }
  }

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
  const thriveData = snapshot.thriveData ?? null;
  const fieryJobs = snapshot.fieryJobs ?? [];

  // Build cutID → cut file map from all sources
  const cutIdMap = new Map<string, { name: string; path: string; source: string; format: string; guid?: string }>();

  if (thriveData) {
    for (const cj of thriveData.cutJobs) {
      const cid = extractCutId(cj.jobName);
      if (cid) cutIdMap.set(cid, { name: cj.jobName, path: cj.filePath || cj.fileName || '', source: 'THRIVE', format: '.xml', guid: cj.guid });
    }
  }

  for (const fj of fieryJobs) {
    if (!fj.hasZccCutFile || !fj.zccFileName) continue;
    const cid = extractCutId(fj.zccFileName) || extractCutId(fj.jobName || '');
    if (cid) cutIdMap.set(cid, { name: fj.zccFileName, path: fj.zccFilePath || (fj.zccFileName ? path.join(FIERY_CONFIG.exportPath, fj.zccFileName) : ''), source: 'FIERY', format: '.zcc' });
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

}

/**
 * Phase 3: Match Thrive Cut Center XML files to existing print links
 */
async function matchThriveCutFiles(
  result: { linksUpdated: number },
  thriveData: { printJobs: ThriveJob[]; cutJobs: ThriveCutJob[] } | null,
) {
  if (!thriveData) return;

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
      const cutWorkOrderNumber = extractWorkOrderNumber(cutJob.fileName || cutJob.jobName);
      if (matchesWorkOrderNumber(cutWorkOrderNumber, link.workOrder.orderNumber)) {
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
async function matchFieryCutFiles(
  result: { linksUpdated: number },
  fieryJobs: Awaited<ReturnType<typeof getAllFieryJobs>>,
) {
  if (fieryJobs.length === 0) return;

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
            cutFilePath: fieryJob.zccFilePath || (fieryJob.zccFileName ? path.join(FIERY_CONFIG.exportPath, fieryJob.zccFileName) : ''),
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
      const woMatch = matchesWorkOrderNumber(fieryJob.workOrderNumber, link.workOrder.orderNumber);
      const nameMatch = fieryNormalized === printNormalized || 
                        fieryNormalized.includes(printNormalized) || 
                        printNormalized.includes(fieryNormalized);
      
      if (woMatch || nameMatch) {
        const confidence = (woMatch && nameMatch) ? 'EXACT' : woMatch ? 'HIGH' : 'PARTIAL';
        
        await prisma.printCutLink.update({
          where: { id: link.id },
          data: {
            cutFileName: fieryJob.zccFileName,
            cutFilePath: fieryJob.zccFilePath || (fieryJob.zccFileName ? path.join(FIERY_CONFIG.exportPath, fieryJob.zccFileName) : ''),
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
async function matchZundCompletedCuts(
  result: { linksUpdated: number },
  zundJobs: Awaited<ReturnType<typeof getZundCompletedJobs>>,
) {
  if (zundJobs.length === 0) return;

  // Ready-to-print links can still complete if the Zund side already has a
  // matching finished job and the daemon has not yet backfilled the status.
  const pendingCutLinks = await prisma.printCutLink.findMany({
    where: {
      status: { in: ['READY_TO_PRINT', 'CUT_PENDING', 'CUTTING'] },
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
      cutFilePath: cutJob.filePath || cutJob.fileName || '',
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
      workOrder: { select: WorkOrderReferenceSelect },
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
      workOrder: { select: WorkOrderReferenceSelect },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  const traceSummary = summarizeFileChainTrace(asprint);

  return {
    fileName,
    normalized,
    printCutLinks: asprint,
    ripJobs,
    hasPrinted: traceSummary.hasPrinted,
    hasCut: traceSummary.hasCut,
    status: traceSummary.status,
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
    const details = entry.details as Prisma.InputJsonValue | undefined;

    await prisma.fileChainLog.create({
      data: {
        level: entry.level,
        source: entry.source,
        event: entry.event,
        message: entry.message,
        details,
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
