/**
 * Thrive Integration Service
 *
 * Monitors Onyx Thrive RIP queue files to track print jobs
 * and correlate them with ERP work orders.
 *
 * Discovery:
 * - Thrive stores job data in QueueXML.Info files on network shares
 * - Work order numbers are embedded in file paths (pattern: WO#####)
 * - Multiple printers have separate queue folders
 *
 * Folder Structures:
 * - Port City Signs (4-digit): \\wildesigns-fs1\Company Files\Safari\CustomerName\WO####_description\
 * - Wilde Signs (5-digit):     \\wildesigns-fs1\Company Files\CustomerName\YEAR\WO#####_...\
 */

import { promises as fs } from 'fs';
import { XMLParser } from 'fast-xml-parser';
import path from 'path';
import { prisma } from '../db/client.js';
import { normalizeJobName } from './zund-match.js';

// Track last known file sizes to detect truncated/partial reads
const lastKnownSizes = new Map<string, number>();

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

// File server base paths
const FILE_PATHS = {
  safari: '\\\\wildesigns-fs1\\Company Files\\Safari', // Port City Signs (4-digit WO#)
  wilde: '\\\\wildesigns-fs1\\Company Files', // Wilde Signs (5-digit WO#)
};

// Equipment configuration - discovered via network scan
export const THRIVE_CONFIG = {
  machines: [
    {
      id: 'thrive-flatbed',
      name: 'Thrive Flatbed (WILDE-FLATBEDPC)',
      ip: '192.168.254.53',
      share: '\\\\192.168.254.53\\Thrive22Input_WILDE-FLATBEDPC',
      printers: [
        {
          name: 'HP Scitex FB700',
          queuePath:
            '\\\\192.168.254.53\\Thrive22Input_WILDE-FLATBEDPC\\HP Scitex FB700\\Info\\QueueXML.Info',
          printingMethod: 'FLATBED',
        },
        {
          name: 'HP Scitex FB700-2',
          queuePath:
            '\\\\192.168.254.53\\Thrive22Input_WILDE-FLATBEDPC\\HP Scitex FB700-2\\Info\\QueueXML.Info',
          printingMethod: 'FLATBED',
        },
      ],
      cutterPath: '\\\\192.168.254.53\\Thrive22Cutter_WILDE-FLATBEDPC\\Zund Cut Center',
    },
    {
      id: 'thrive-rip2',
      name: 'Thrive RIP2 (WS-RIP2)',
      ip: '192.168.254.77',
      share: '\\\\192.168.254.77\\Thrive22Input_WS-RIP2',
      printers: [
        {
          name: 'HP Latex 570',
          queuePath: '\\\\192.168.254.77\\Thrive22Input_WS-RIP2\\HP Latex 570\\Info\\QueueXML.Info',
          printingMethod: 'ROLL_TO_ROLL',
        },
        {
          name: 'HP Latex 570-2',
          queuePath:
            '\\\\192.168.254.77\\Thrive22Input_WS-RIP2\\HP Latex 570-2\\Info\\QueueXML.Info',
          printingMethod: 'ROLL_TO_ROLL',
        },
        {
          name: 'HP Latex 800 W',
          queuePath:
            '\\\\192.168.254.77\\Thrive22Input_WS-RIP2\\HP Latex 800 W\\Info\\QueueXML.Info',
          printingMethod: 'ROLL_TO_ROLL',
        },
        {
          name: 'HP Scitex FB700 (RIP2)',
          queuePath:
            '\\\\192.168.254.77\\Thrive22Input_WS-RIP2\\HP Scitex FB700\\Info\\QueueXML.Info',
          printingMethod: 'FLATBED',
        },
        {
          name: 'HP Scitex FB700-2 (RIP2)',
          queuePath:
            '\\\\192.168.254.77\\Thrive22Input_WS-RIP2\\HP Scitex FB700-2\\Info\\QueueXML.Info',
          printingMethod: 'FLATBED',
        },
        {
          name: 'Mimaki JV33-160 A',
          queuePath:
            '\\\\192.168.254.77\\Thrive22Input_WS-RIP2\\Mimaki JV33-160 A\\Info\\QueueXML.Info',
          printingMethod: 'ROLL_TO_ROLL',
        },
        {
          name: 'Mimaki JV33-160 B',
          queuePath:
            '\\\\192.168.254.77\\Thrive22Input_WS-RIP2\\Mimaki JV33-160 B\\Info\\QueueXML.Info',
          printingMethod: 'ROLL_TO_ROLL',
        },
      ],
      cutterPath: '\\\\192.168.254.77\\Thrive22Cutter_WS-RIP2\\Zund Cut Center',
    },
  ],
  zundMachines: [
    {
      id: 'zund-1',
      ip: '192.168.254.38',
      name: 'Zund 1',
      statisticsPath: '\\\\192.168.254.38\\Statistics',
    },
    {
      id: 'zund-2',
      ip: '192.168.254.28',
      name: 'Zund 2',
      statisticsPath: '\\\\192.168.254.28\\Statistics',
    },
  ],
  fiery: {
    ip: '192.168.254.57',
    // exportPath = OUTPUT folder where Fiery writes processed files (RTL, JDF, ZCC) — READ ONLY
    exportPath: '\\\\192.168.254.57\\EFI Export Folder',
    // hotfolderPath = INPUT folder where ERP drops PDFs for Fiery to process — must be writable
    // Fiery machine needs a Hot Folder configured to monitor: C:\Users\Public\Documents\VUTEk Jobs
    hotfolderPath: '\\\\192.168.254.57\\Users\\Public\\Documents\\VUTEk Jobs',
  },
  filePaths: FILE_PATHS,
};

// Thrive job status codes (discovered from XML)
const THRIVE_STATUS = {
  0: 'Pending',
  2: 'Spooling',
  4: 'Processing',
  6: 'RIPping',
  8: 'Ready to Print',
  10: 'Sending to Printer',
  16: 'Printing',
  32: 'Printed',
  64: 'Error',
} as const;

export interface ThriveJob {
  jobGuid: string;
  jobName: string;
  fileName: string;
  cutId?: string | null;
  workOrderNumber?: string;
  status: string;
  statusCode: number;
  createTime: string;
  createDate: string;
  processStartTime?: string;
  printer: string;
  printMedia: string;
  numCopies: number;
  inkTotal?: string;
  inkCoverage?: string;
  customerName?: string;
  jobSize?: string;
  companyBrand?: 'PORT_CITY_SIGNS' | 'WILDE_SIGNS';
  jobDescription?: string;
}

export interface ThriveCutJob {
  jobName: string;
  fileName: string;
  filePath?: string;
  workOrderNumber?: string;
  device: string;
  printer: string;
  media: string;
  width: number;
  height: number;
  guid: string;
  customerName?: string;
  companyBrand?: 'PORT_CITY_SIGNS' | 'WILDE_SIGNS';
}

export interface ParsedJobInfo {
  workOrderNumber: string | null;
  customerName: string | null;
  companyBrand: 'PORT_CITY_SIGNS' | 'WILDE_SIGNS' | null;
  jobDescription: string | null;
  isSafariPath: boolean;
}

function normalizeThriveTicketSegment(value: string | null | undefined): string {
  return normalizeWhitespace(String(value ?? '').replace(/[<>:"/\\|?*\x00-\x1F]+/g, ' '));
}

function parseStructuredThriveTicketName(text: string): ParsedJobInfo | null {
  const baseName = path.basename(text).replace(/\.[^.]+$/u, '');
  const parts = baseName
    .split('__')
    .map((part) => normalizeThriveTicketSegment(part))
    .filter((part) => Boolean(part));

  if (parts.length < 2) return null;

  const workOrderMatch = parts[0]?.match(/^WO(\d{4,6})$/i);
  if (!workOrderMatch) return null;

  const workOrderNumber = workOrderMatch[1];
  return {
    workOrderNumber,
    customerName: parts[1] || null,
    companyBrand: workOrderNumber.length === 4 ? 'PORT_CITY_SIGNS' : 'WILDE_SIGNS',
    jobDescription: parts[2] || null,
    isSafariPath: text.toLowerCase().includes('\\safari\\'),
  };
}

export function buildThriveJobTicketName(params: {
  workOrderNumber?: string | null;
  customerName?: string | null;
  sourceFileName?: string | null;
  jobDescription?: string | null;
}): string {
  const parts: string[] = [];
  const workOrderNumber = params.workOrderNumber?.trim().replace(/^wo/i, '');
  const customerName = normalizeThriveTicketSegment(params.customerName);
  const sourceBaseName = params.sourceFileName
    ? normalizeThriveTicketSegment(
        path.basename(params.sourceFileName, path.extname(params.sourceFileName)),
      )
    : '';
  const effectiveDescription = normalizeThriveTicketSegment(params.jobDescription || sourceBaseName);

  if (workOrderNumber) parts.push(`WO${workOrderNumber}`);
  if (customerName) parts.push(customerName);
  if (effectiveDescription) parts.push(effectiveDescription);

  const ext = params.sourceFileName ? path.extname(params.sourceFileName) || '.pdf' : '.pdf';
  const rawLabel = parts.join('__');
  const sanitized = normalizeThriveTicketSegment(rawLabel).replace(/__+/g, '__');
  const maxBaseLength = Math.max(40, 240 - ext.length);
  const clipped = sanitized.slice(0, maxBaseLength).replace(/[.\s_-]+$/g, '');

  return clipped ? `${clipped}${ext}` : `ERP-${Date.now()}${ext}`;
}

/**
 * Extract work order info from file path or job name
 *
 * Port City Signs (Safari): \\wildesigns-fs1\Company Files\Safari\CustomerName\WO####_description\PRINT\file.pdf
 * Wilde Signs:              \\wildesigns-fs1\Company Files\CustomerName\2026\WO#####_description\PRINT\file.pdf
 */
export function parseJobInfo(text: string): ParsedJobInfo {
  const result: ParsedJobInfo = {
    workOrderNumber: null,
    customerName: null,
    companyBrand: null,
    jobDescription: null,
    isSafariPath: false,
  };

  // Normalize path separators
  const normalized = text.replace(/\//g, '\\');
  const structuredInfo = parseStructuredThriveTicketName(normalized);
  if (structuredInfo) {
    return structuredInfo;
  }

  // Check if it's a Safari path (Port City Signs)
  const isSafari = normalized.toLowerCase().includes('\\safari\\');
  result.isSafariPath = isSafari;

  // Extract WO number
  const woMatch = normalized.match(/WO(\d{4,6})/i);
  if (woMatch) {
    result.workOrderNumber = woMatch[1];
    // 4 digits = Port City Signs, 5+ digits = Wilde Signs
    result.companyBrand = woMatch[1].length === 4 ? 'PORT_CITY_SIGNS' : 'WILDE_SIGNS';
  } else {
    // Try order number at start of filename (e.g., "64058_CustomerName")
    const numMatch = text.match(/(?:^|\\)(\d{4,6})[-_]/);
    if (numMatch) {
      result.workOrderNumber = numMatch[1];
      result.companyBrand = numMatch[1].length === 4 ? 'PORT_CITY_SIGNS' : 'WILDE_SIGNS';
    }
  }

  // Override brand detection based on folder structure
  if (isSafari) {
    result.companyBrand = 'PORT_CITY_SIGNS';
  }

  // Extract customer name from path
  if (isSafari) {
    // Safari path: \Safari\CustomerName\WO####_description\
    const safariMatch = normalized.match(/\\Safari\\([^\\]+)\\WO\d{4}/i);
    if (safariMatch) {
      result.customerName = safariMatch[1].replace(/_/g, ' ').trim();
    }
  } else {
    // Wilde path: \Company Files\CustomerName\2026\WO#####_
    const wildeMatch = normalized.match(/\\Company Files\\([^\\]+)\\(?:\d{4}\\)?WO\d{5}/i);
    if (wildeMatch && !wildeMatch[1].toLowerCase().includes('safari')) {
      result.customerName = wildeMatch[1].replace(/_/g, ' ').trim();
    }
  }

  // Extract job description from WO folder name
  const descMatch = normalized.match(/WO\d{4,6}[-_]([^\\]+)/i);
  if (descMatch) {
    result.jobDescription = descMatch[1].replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  return result;
}

/**
 * Legacy function for backward compatibility
 */
export function extractWorkOrderNumber(text: string): string | null {
  return parseJobInfo(text).workOrderNumber;
}

/**
 * Parse a Thrive QueueXML.Info file
 */
export async function parseQueueFile(queuePath: string): Promise<ThriveJob[]> {
  try {
    const readAndClean = async (): Promise<string> => {
      let raw = await fs.readFile(queuePath, 'utf-8');
      raw = raw.replace(/^\uFEFF/, ''); // Remove BOM if present
      raw = raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ''); // Remove control characters
      return raw;
    };

    let content = await readAndClean();

    // File-size sanity check: if the file shrank dramatically vs last read,
    // it may be mid-write — wait briefly and re-read
    const lastSize = lastKnownSizes.get(queuePath) ?? 0;
    if (content.length < 100 && lastSize > 500) {
      await new Promise((r) => setTimeout(r, 250));
      content = await readAndClean();
    }
    lastKnownSizes.set(queuePath, content.length);

    // Guard against empty or whitespace-only files
    if (!content || !content.trim()) {
      return [];
    }

    // Guard against non-XML content (must start with < after trimming)
    const trimmed = content.trim();
    if (!trimmed.startsWith('<')) {
      return [];
    }

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      allowBooleanAttributes: true,
      parseAttributeValue: false, // Keep as strings to avoid parsing issues
    });

    let result: any;
    try {
      result = parser.parse(content);
    } catch (parseError) {
      // Thrive queue files can be temporarily invalid while being written —
      // retry once after a short delay before giving up
      await new Promise((r) => setTimeout(r, 250));
      content = await readAndClean();
      lastKnownSizes.set(queuePath, content.length);
      if (!content.trim() || !content.trim().startsWith('<')) return [];
      try {
        result = parser.parse(content);
      } catch (retryError) {
        const msg = retryError instanceof Error ? retryError.message : String(retryError);
        console.warn(`Skipping unreadable queue XML ${queuePath} (after retry): ${msg}`);
        return [];
      }
    }
    const jobs: ThriveJob[] = [];

    const jobList = result.queue_info?.jobs?.job;
    if (!jobList) return jobs;

    // Ensure it's an array
    const jobArray = Array.isArray(jobList) ? jobList : [jobList];

    for (const job of jobArray) {
      const id = job.id || {};
      const time = job.time || {};
      const info = job.info || {};
      const print = job.print || {};
      const size = job.size || {};
      const metadata = job.metadata || {};

      const thriveJob: ThriveJob = {
        jobGuid: id.job_guid || '',
        jobName: id.job_name || '',
        fileName: id.file_name || '',
        status: THRIVE_STATUS[id.status as keyof typeof THRIVE_STATUS] || `Unknown (${id.status})`,
        statusCode: parseInt(id.status) || 0,
        createTime: time.create_time || '',
        createDate: time.create_date || '',
        processStartTime: time.process_start_time || undefined,
        printer: info.printer || '',
        printMedia: info.print_media || '',
        numCopies: parseInt(print.numcopies) || 1,
        inkTotal: job.ink_total || undefined,
        inkCoverage: job.ink_coverage?.replace('%', '') || undefined,
        jobSize: size.crop_size ? size.crop_size.replace(/(\d+\.\d{3})\d*/g, '$1') : undefined,
      };

      // Parse work order info from file path (preferred) or job name
      const fileInfo = parseJobInfo(thriveJob.fileName);
      const nameInfo = parseJobInfo(thriveJob.jobName);

      // Prefer info from file path, fall back to job name
      thriveJob.workOrderNumber = fileInfo.workOrderNumber ?? nameInfo.workOrderNumber ?? undefined;
      thriveJob.customerName =
        fileInfo.customerName ?? nameInfo.customerName ?? (metadata.customer_name || undefined);
      thriveJob.companyBrand = fileInfo.companyBrand ?? nameInfo.companyBrand ?? undefined;
      thriveJob.jobDescription = fileInfo.jobDescription ?? nameInfo.jobDescription ?? undefined;

      // If customer provided in metadata, use it
      if (metadata.customer_name) {
        thriveJob.customerName = metadata.customer_name;
      }

      jobs.push(thriveJob);
    }

    return jobs;
  } catch (error) {
    console.error(`Error parsing queue file ${queuePath}:`, error);
    return [];
  }
}

/**
 * Parse a Zund cut file (XML)
 */
export async function parseCutFile(filePath: string): Promise<ThriveCutJob | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
    });

    const result = parser.parse(content);
    const cutList = result['cut-list'];

    if (!cutList) return null;

    const cutJob: ThriveCutJob = {
      jobName: cutList.job || '',
      fileName: cutList.filename || '',
      filePath,
      device: cutList.device || '',
      printer: cutList.printer || '',
      media: cutList.media || '',
      width: parseFloat(cutList.width) || 0,
      height: parseFloat(cutList.height) || 0,
      guid: cutList.GUID || '',
    };

    // Parse work order info from job name
    const jobInfo = parseJobInfo(cutJob.jobName);
    cutJob.workOrderNumber = jobInfo.workOrderNumber ?? undefined;
    cutJob.customerName = jobInfo.customerName ?? undefined;
    cutJob.companyBrand = jobInfo.companyBrand ?? undefined;

    return cutJob;
  } catch (error) {
    console.error(`Error parsing cut file ${filePath}:`, error);
    return null;
  }
}

/**
 * Scan all pending cut files in a Zund folder
 */
export async function scanCutFolder(cutterPath: string): Promise<ThriveCutJob[]> {
  try {
    const files = await fs.readdir(cutterPath);
    const xmlFiles = files.filter((f) => f.endsWith('.xml_tmp') || f.endsWith('.xml'));

    const jobs: ThriveCutJob[] = [];
    for (const file of xmlFiles) {
      const job = await parseCutFile(path.join(cutterPath, file));
      if (job) {
        jobs.push(job);
      }
    }

    return jobs;
  } catch (error) {
    console.error(`Error scanning cut folder ${cutterPath}:`, error);
    return [];
  }
}

/**
 * Get all jobs from all Thrive machines
 */
export async function getAllThriveJobs(): Promise<{
  printJobs: ThriveJob[];
  cutJobs: ThriveCutJob[];
}> {
  // Build all async tasks upfront, then run in parallel
  const printTasks: Promise<{ jobs: ThriveJob[] }>[] = [];
  const cutTasks: Promise<{ jobs: ThriveCutJob[] }>[] = [];

  for (const machine of THRIVE_CONFIG.machines) {
    for (const printer of machine.printers) {
      printTasks.push(
        parseQueueFile(printer.queuePath)
          .then((jobs) => ({ jobs }))
          .catch((err) => {
            console.warn(`Could not read queue for ${printer.name}:`, err);
            return { jobs: [] as ThriveJob[] };
          })
      );
    }
    if (machine.cutterPath) {
      cutTasks.push(
        scanCutFolder(machine.cutterPath)
          .then((jobs) => ({ jobs }))
          .catch((err) => {
            console.warn(`Could not read cutter folder for ${machine.name}:`, err);
            return { jobs: [] as ThriveCutJob[] };
          })
      );
    }
  }

  const [printResults, cutResults] = await Promise.all([
    Promise.all(printTasks),
    Promise.all(cutTasks),
  ]);

  const printJobs = printResults.flatMap((r) => r.jobs);
  const cutJobs = cutResults.flatMap((r) => r.jobs);

  // Keep the live queue snapshot on the critical path only.
  // JobLog enrichment is best-effort and should warm in the background so a cold
  // or slow network share does not hold the order-detail print/cut cards hostage.
  void getAllThriveJobLogEntries().catch(() => {});

  return { printJobs, cutJobs };
}

/**
 * Link Thrive jobs to ERP work orders
 * Enhanced to match by order number and optionally customer name
 */
export async function linkJobsToWorkOrders(jobs: ThriveJob[]): Promise<
  {
    job: ThriveJob;
    workOrder: {
      id: string;
      orderNumber: string;
      customerName: string;
      companyBrand: string;
      status: string;
      dueDate: Date | null;
      description: string | null;
    } | null;
  }[]
> {
  // Collect all unique WO numbers from jobs
  const woNumbers = new Set<string>();
  for (const job of jobs) {
    if (job.workOrderNumber) {
      woNumbers.add(job.workOrderNumber);
    }
  }

  if (woNumbers.size === 0) {
    return jobs.map((job) => ({ job, workOrder: null }));
  }

  // Build OR conditions for all WO numbers in a single query
  const orConditions: any[] = [];
  for (const num of woNumbers) {
    if (num.length === 4) {
      orConditions.push(
        { orderNumber: num },
        { orderNumber: `WO${num}` },
        { orderNumber: { endsWith: num } }
      );
    } else {
      orConditions.push(
        { orderNumber: num },
        { orderNumber: `WO${num}` },
        { orderNumber: { contains: num } }
      );
    }
  }

  // Single batch query for all work orders
  const allMatches = await prisma.workOrder.findMany({
    where: { OR: orConditions },
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      companyBrand: true,
      status: true,
      dueDate: true,
      description: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // Build lookup: WO number -> best match (most recent)
  const woCache = new Map<string, (typeof allMatches)[0]>();
  for (const match of allMatches) {
    for (const num of woNumbers) {
      const matchesNum =
        match.orderNumber === num ||
        match.orderNumber === `WO${num}` ||
        (num.length === 4 ? match.orderNumber.endsWith(num) : match.orderNumber.includes(num));
      if (matchesNum && !woCache.has(num)) {
        woCache.set(num, match);
      }
    }
  }

  // Map jobs to results
  return jobs.map((job) => {
    const workOrder = job.workOrderNumber ? (woCache.get(job.workOrderNumber) ?? null) : null;
    return { job, workOrder };
  });
}

/**
 * Link cut jobs to ERP work orders
 */
export async function linkCutJobsToWorkOrders(jobs: ThriveCutJob[]): Promise<
  {
    job: ThriveCutJob;
    workOrder: {
      id: string;
      orderNumber: string;
      customerName: string;
      companyBrand: string;
      status: string;
    } | null;
  }[]
> {
  const results = [];
  const woCache = new Map<string, any>();

  for (const job of jobs) {
    let workOrder = null;

    if (job.workOrderNumber) {
      const cacheKey = job.workOrderNumber;
      if (woCache.has(cacheKey)) {
        workOrder = woCache.get(cacheKey);
      } else {
        const where: any = {};

        if (job.workOrderNumber.length === 4) {
          where.OR = [
            { orderNumber: job.workOrderNumber },
            { orderNumber: `WO${job.workOrderNumber}` },
            { orderNumber: { endsWith: job.workOrderNumber } },
          ];
          if (job.companyBrand === 'PORT_CITY_SIGNS') {
            where.companyBrand = 'PORT_CITY_SIGNS';
          }
        } else {
          where.OR = [
            { orderNumber: job.workOrderNumber },
            { orderNumber: `WO${job.workOrderNumber}` },
            { orderNumber: { contains: job.workOrderNumber } },
          ];
        }

        const found = await prisma.workOrder.findFirst({
          where,
          select: {
            id: true,
            orderNumber: true,
            customerName: true,
            companyBrand: true,
            status: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

        if (found) {
          workOrder = found;
          woCache.set(cacheKey, found);
        }
      }
    }

    results.push({ job, workOrder });
  }

  return results;
}

/**
 * Update work order station progress based on Thrive job status.
 * Uses the printer → printingMethod mapping from THRIVE_CONFIG to determine
 * which station (FLATBED or ROLL_TO_ROLL) to mark as completed.
 */
export async function syncJobStatus(
  jobGuid: string,
  workOrderId: string,
  status: number,
  printerName?: string
): Promise<{ updated: boolean; station?: string }> {
  // Status 32 = Printed means the job completed on the RIP
  if (status < 32) {
    return { updated: false };
  }

  // Determine which station this printer maps to
  let station: string | null = null;
  if (printerName) {
    for (const machine of THRIVE_CONFIG.machines) {
      const printer = machine.printers.find(
        (p) => p.name.toLowerCase() === printerName.toLowerCase()
      );
      if (printer) {
        station = printer.printingMethod;
        break;
      }
    }
  }

  // Fallback: look at the order's routing and pick the first printing station that exists
  if (!station) {
    const order = await prisma.workOrder.findUnique({
      where: { id: workOrderId },
      select: { routing: true },
    });
    if (order) {
      const routing = order.routing as string[];
      station =
        routing.find((s) => ['FLATBED', 'ROLL_TO_ROLL', 'SCREEN_PRINT'].includes(s)) || null;
    }
  }

  if (!station) {
    console.warn(
      `syncJobStatus: Could not determine station for job ${jobGuid} on order ${workOrderId}`
    );
    return { updated: false };
  }

  try {
    // Only update if the station is currently NOT_STARTED or IN_PROGRESS
    const result = await prisma.stationProgress.updateMany({
      where: {
        orderId: workOrderId,
        station: station as any,
        status: { in: ['NOT_STARTED', 'IN_PROGRESS'] },
      },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    if (result.count > 0) {
      console.log(
        `syncJobStatus: Marked ${station} COMPLETED for order ${workOrderId} (job ${jobGuid})`
      );

      // Auto-advance next station
      const order = await prisma.workOrder.findUnique({
        where: { id: workOrderId },
        select: { routing: true },
      });
      if (order) {
        const routing = order.routing as string[];
        const currentIdx = routing.indexOf(station);
        const nextStation =
          currentIdx >= 0 && currentIdx < routing.length - 1 ? routing[currentIdx + 1] : null;
        if (nextStation) {
          await prisma.stationProgress.updateMany({
            where: {
              orderId: workOrderId,
              station: nextStation as any,
              status: 'NOT_STARTED',
            },
            data: {
              status: 'IN_PROGRESS',
              startedAt: new Date(),
            },
          });
        }
      }

      return { updated: true, station };
    }

    return { updated: false, station };
  } catch (error) {
    console.error(`syncJobStatus error for ${workOrderId}/${station}:`, error);
    return { updated: false, station };
  }
}

// ─── JobLog.xml — Actual Print History ─────────────────

/**
 * Paths to the ONYX Thrive 22 print-history logs on each machine.
 * These are the REAL job logs (not the QueueXML.Info temp files).
 * Located at C:\ONYXThrive22\records\JobLog.xml, accessed via admin share.
 */
const JOB_LOG_PATHS = [
  {
    id: 'thrive-flatbed',
    name: 'Thrive Flatbed (WILDE-FLATBEDPC)',
    xmlPath: '\\\\192.168.254.53\\c$\\ONYXThrive22\\records\\JobLog.xml',
  },
  {
    id: 'thrive-rip2',
    name: 'Thrive RIP2 (WS-RIP2)',
    xmlPath: '\\\\192.168.254.77\\c$\\ONYXThrive22\\records\\JobLog.xml',
  },
];

export interface ThriveJobLogEntry {
  fileName: string;
  customizedName: string;
  status: string;
  printedTime: string;
  sizeWidth: number;
  sizeHeight: number;
  copies: number;
  totalArea: number;
  printer: string;
  media: string;
  printMode: string;
  resolution: string;
  ripTime: string;
  printTime: string;
  inkUsed: string;
  totalInk: string;
  cutId: string | null;
  machineId: string;
  sourceFilePath?: string | null;
}

// ─── Cache for parsed JobLog entries ───────────────────
interface JobLogCache {
  mtime: number;
  size: number;
  entries: ThriveJobLogEntry[];
  cutIdIndex: Map<string, ThriveJobLogEntry>;
}

const jobLogCaches = new Map<string, JobLogCache>();
const THRIVE_PRINT_QUEUE_CACHE_TTL_MS = 30_000;
let thrivePrintQueueCache: { expiresAt: number; printJobs: ThriveJob[] } | null = null;

function parseThrivePrintedTimestamp(printedTime: string): number | null {
  const match = printedTime.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/);
  if (!match) return null;

  const [, month, day, year, hour, minute] = match;
  const parsed = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    0,
    0
  );

  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function parseThriveQueueTimestamp(
  job: Pick<ThriveJob, 'createDate' | 'createTime'>
): number | null {
  if (!job.createDate || !job.createTime) return null;

  const dateMatch = job.createDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeMatch = job.createTime.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!dateMatch || !timeMatch) return null;

  const [, year, month, day] = dateMatch;
  const [, hour, minute, second = '0'] = timeMatch;
  const parsed = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    0
  );

  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function getNormalizedThriveLogNames(
  entry: Pick<ThriveJobLogEntry, 'fileName' | 'customizedName'>
): string[] {
  return Array.from(
    new Set(
      [entry.fileName, entry.customizedName]
        .map((name) => normalizeJobName(name || ''))
        .filter((name): name is string => Boolean(name))
    )
  );
}

function getNormalizedThriveQueueNames(job: Pick<ThriveJob, 'jobName' | 'fileName'>): string[] {
  return Array.from(
    new Set(
      [job.jobName, path.basename(job.fileName || '')]
        .map((name) => normalizeJobName(name || ''))
        .filter((name): name is string => Boolean(name))
    )
  );
}

export function matchThriveQueueJobToLogEntry(
  entry: Pick<ThriveJobLogEntry, 'fileName' | 'customizedName' | 'printer' | 'printedTime'>,
  printJobs: ThriveJob[]
): ThriveJob | null {
  const targetNames = getNormalizedThriveLogNames(entry);
  if (targetNames.length === 0 || printJobs.length === 0) return null;

  const printedAt = parseThrivePrintedTimestamp(entry.printedTime);
  const ranked = printJobs
    .map((job) => {
      const queueNames = getNormalizedThriveQueueNames(job);
      const hasExactNameMatch = queueNames.some((name) => targetNames.includes(name));
      const hasPartialNameMatch =
        !hasExactNameMatch &&
        queueNames.some((name) =>
          targetNames.some((target) => name.includes(target) || target.includes(name))
        );

      let score = 0;
      if (hasExactNameMatch) score += 100;
      else if (hasPartialNameMatch) score += 60;

      if (
        entry.printer &&
        job.printer &&
        entry.printer.toLowerCase() === job.printer.toLowerCase()
      ) {
        score += 25;
      }

      const createdAt = parseThriveQueueTimestamp(job);
      if (printedAt !== null && createdAt !== null) {
        const diffMinutes = Math.abs(printedAt - createdAt) / 60_000;
        if (diffMinutes <= 60) score += 15;
        else if (diffMinutes <= 24 * 60) score += 10;
        else if (diffMinutes <= 7 * 24 * 60) score += 5;
      }

      return {
        job,
        score,
        createdAt,
      };
    })
    .filter((candidate) => candidate.score >= 60)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;

      if (printedAt !== null) {
        const aDiff =
          a.createdAt === null ? Number.POSITIVE_INFINITY : Math.abs(a.createdAt - printedAt);
        const bDiff =
          b.createdAt === null ? Number.POSITIVE_INFINITY : Math.abs(b.createdAt - printedAt);
        if (aDiff !== bDiff) return aDiff - bDiff;
      }

      const aCreated = a.createdAt ?? 0;
      const bCreated = b.createdAt ?? 0;
      return bCreated - aCreated;
    });

  return ranked[0]?.job ?? null;
}

async function getCachedThrivePrintJobs(): Promise<ThriveJob[]> {
  if (thrivePrintQueueCache && Date.now() < thrivePrintQueueCache.expiresAt) {
    return thrivePrintQueueCache.printJobs;
  }

  const { printJobs } = await getAllThriveJobs();
  thrivePrintQueueCache = {
    expiresAt: Date.now() + THRIVE_PRINT_QUEUE_CACHE_TTL_MS,
    printJobs,
  };

  return printJobs;
}

async function resolveThriveJobLogSourcePath(entry: ThriveJobLogEntry): Promise<string | null> {
  if (entry.sourceFilePath !== undefined) {
    return entry.sourceFilePath;
  }

  try {
    const printJobs = await getCachedThrivePrintJobs();
    const matchedQueueJob = matchThriveQueueJobToLogEntry(entry, printJobs);
    entry.sourceFilePath = matchedQueueJob?.fileName || null;
  } catch {
    entry.sourceFilePath = null;
  }

  return entry.sourceFilePath;
}

/**
 * Parse a single ONYX JobLog.xml file into structured entries.
 */
async function parseJobLogXml(xmlPath: string, machineId: string): Promise<ThriveJobLogEntry[]> {
  const content = await fs.readFile(xmlPath, 'utf-8');

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    allowBooleanAttributes: true,
    parseAttributeValue: false,
  });

  const result = parser.parse(content);
  const jobList = result?.Printed_Job_List?.Job;
  if (!jobList) return [];

  const jobs = Array.isArray(jobList) ? jobList : [jobList];
  const entries: ThriveJobLogEntry[] = [];

  for (const job of jobs) {
    entries.push({
      fileName: job['@_name'] || '',
      customizedName: job['@_customized_name'] || '',
      status: job.Status || '',
      printedTime: job.Printed_Time || '',
      sizeWidth: parseFloat(job.Size_Width) || 0,
      sizeHeight: parseFloat(job.Size_Height) || 0,
      copies: parseInt(job.Copies) || 0,
      totalArea: parseFloat(job.Total_Area) || 0,
      printer: job.Printer || '',
      media: job.Media || '',
      printMode: job.PrintMode || '',
      resolution: job.Resolution || '',
      ripTime: job.Rip_Time || '',
      printTime: job.Print_Time || '',
      inkUsed: typeof job.Ink_Used === 'object' ? job.Ink_Used['#text'] || '' : job.Ink_Used || '',
      totalInk: job.Total_Ink || '',
      cutId: job.CutID || null,
      machineId,
    });
  }

  return entries;
}

/**
 * Get all print history entries from both Thrive machines.
 * Uses mtime-based caching so we only re-parse when the file changes.
 */
export async function getAllThriveJobLogEntries(): Promise<ThriveJobLogEntry[]> {
  const allEntries: ThriveJobLogEntry[] = [];

  await Promise.all(
    JOB_LOG_PATHS.map(async (log) => {
      try {
        const stat = await fs.stat(log.xmlPath);
        const cached = jobLogCaches.get(log.id);

        if (cached && cached.mtime === stat.mtimeMs && cached.size === stat.size) {
          allEntries.push(...cached.entries);
          return;
        }

        const entries = await parseJobLogXml(log.xmlPath, log.id);
        const cutIdIndex = new Map<string, ThriveJobLogEntry>();
        for (const e of entries) {
          if (e.cutId) cutIdIndex.set(e.cutId, e);
        }

        jobLogCaches.set(log.id, {
          mtime: stat.mtimeMs,
          size: stat.size,
          entries,
          cutIdIndex,
        });

        allEntries.push(...entries);
      } catch (err) {
        console.warn(`Could not read job log ${log.xmlPath}:`, (err as Error).message);
      }
    })
  );

  return allEntries;
}

/**
 * Look up a Thrive print job by its CutID in the JobLog history.
 * Uses the cached CutID index for O(1) lookup.
 */
export async function findThriveJobByCutId(cutId: string): Promise<ThriveJobLogEntry | null> {
  // Ensure caches are fresh
  await getAllThriveJobLogEntries();

  for (const cache of jobLogCaches.values()) {
    const entry = cache.cutIdIndex.get(cutId);
    if (entry) {
      await resolveThriveJobLogSourcePath(entry);
      return entry;
    }
  }

  return null;
}

// Export for use in routes
export const thriveService = {
  getAllJobs: getAllThriveJobs,
  getAllJobLogEntries: getAllThriveJobLogEntries,
  findJobByCutId: findThriveJobByCutId,
  buildJobTicketName: buildThriveJobTicketName,
  parseQueueFile,
  parseCutFile,
  scanCutFolder,
  linkJobsToWorkOrders,
  linkCutJobsToWorkOrders,
  syncJobStatus,
  extractWorkOrderNumber,
  parseJobInfo,
  config: THRIVE_CONFIG,
};
