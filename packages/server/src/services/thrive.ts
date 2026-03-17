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

// File server base paths
const FILE_PATHS = {
  safari: '\\\\wildesigns-fs1\\Company Files\\Safari',       // Port City Signs (4-digit WO#)
  wilde: '\\\\wildesigns-fs1\\Company Files',                // Wilde Signs (5-digit WO#)
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
          queuePath: '\\\\192.168.254.53\\Thrive22Input_WILDE-FLATBEDPC\\HP Scitex FB700\\Info\\QueueXML.Info',
          printingMethod: 'FLATBED',
        },
        {
          name: 'HP Scitex FB700-2',
          queuePath: '\\\\192.168.254.53\\Thrive22Input_WILDE-FLATBEDPC\\HP Scitex FB700-2\\Info\\QueueXML.Info',
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
          queuePath: '\\\\192.168.254.77\\Thrive22Input_WS-RIP2\\HP Latex 570-2\\Info\\QueueXML.Info',
          printingMethod: 'ROLL_TO_ROLL',
        },
        {
          name: 'HP Latex 800 W',
          queuePath: '\\\\192.168.254.77\\Thrive22Input_WS-RIP2\\HP Latex 800 W\\Info\\QueueXML.Info',
          printingMethod: 'ROLL_TO_ROLL',
        },
        {
          name: 'HP Scitex FB700 (RIP2)',
          queuePath: '\\\\192.168.254.77\\Thrive22Input_WS-RIP2\\HP Scitex FB700\\Info\\QueueXML.Info',
          printingMethod: 'FLATBED',
        },
        {
          name: 'HP Scitex FB700-2 (RIP2)',
          queuePath: '\\\\192.168.254.77\\Thrive22Input_WS-RIP2\\HP Scitex FB700-2\\Info\\QueueXML.Info',
          printingMethod: 'FLATBED',
        },
        {
          name: 'Mimaki JV33-160 A',
          queuePath: '\\\\192.168.254.77\\Thrive22Input_WS-RIP2\\Mimaki JV33-160 A\\Info\\QueueXML.Info',
          printingMethod: 'ROLL_TO_ROLL',
        },
        {
          name: 'Mimaki JV33-160 B',
          queuePath: '\\\\192.168.254.77\\Thrive22Input_WS-RIP2\\Mimaki JV33-160 B\\Info\\QueueXML.Info',
          printingMethod: 'ROLL_TO_ROLL',
        },
      ],
      cutterPath: '\\\\192.168.254.77\\Thrive22Cutter_WS-RIP2\\Zund Cut Center',
    },
  ],
  zundMachines: [
    { id: 'zund-1', ip: '192.168.254.38', name: 'Zund 1' },
    { id: 'zund-2', ip: '192.168.254.28', name: 'Zund 2', statisticsPath: '\\\\192.168.254.28\\Statistics' },
  ],
  fiery: {
    ip: '192.168.254.57',
    exportPath: '\\\\192.168.254.57\\EFI Export Folder',
  },
  filePaths: FILE_PATHS,
};

// Thrive job status codes (discovered from XML)
const THRIVE_STATUS = {
  0: 'Pending',
  4: 'Processing',
  8: 'Ready to Print',
  16: 'Printing',
  32: 'Printed',
  64: 'Error',
} as const;

export interface ThriveJob {
  jobGuid: string;
  jobName: string;
  fileName: string;
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
    result.jobDescription = descMatch[1]
      .replace(/[-_]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
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
    let content = await fs.readFile(queuePath, 'utf-8');
    
    // Clean any BOM or invalid XML characters
    content = content.replace(/^\uFEFF/, ''); // Remove BOM if present
    content = content.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ''); // Remove control characters
    
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
      // Thrive queue files can be temporarily invalid while being written — log quietly
      const msg = parseError instanceof Error ? parseError.message : String(parseError);
      console.warn(`Skipping unreadable queue XML ${queuePath}: ${msg}`);
      return [];
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
        jobSize: size.crop_size || undefined,
      };
      
      // Parse work order info from file path (preferred) or job name
      const fileInfo = parseJobInfo(thriveJob.fileName);
      const nameInfo = parseJobInfo(thriveJob.jobName);
      
      // Prefer info from file path, fall back to job name
      thriveJob.workOrderNumber = fileInfo.workOrderNumber ?? nameInfo.workOrderNumber ?? undefined;
      thriveJob.customerName = fileInfo.customerName ?? nameInfo.customerName ?? (metadata.customer_name || undefined);
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
    const xmlFiles = files.filter(f => f.endsWith('.xml_tmp') || f.endsWith('.xml'));
    
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
          .then(jobs => ({ jobs }))
          .catch(err => {
            console.warn(`Could not read queue for ${printer.name}:`, err);
            return { jobs: [] as ThriveJob[] };
          })
      );
    }
    if (machine.cutterPath) {
      cutTasks.push(
        scanCutFolder(machine.cutterPath)
          .then(jobs => ({ jobs }))
          .catch(err => {
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

  const printJobs = printResults.flatMap(r => r.jobs);
  const cutJobs = cutResults.flatMap(r => r.jobs);

  return { printJobs, cutJobs };
}

/**
 * Link Thrive jobs to ERP work orders
 * Enhanced to match by order number and optionally customer name
 */
export async function linkJobsToWorkOrders(jobs: ThriveJob[]): Promise<{
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
}[]> {
  // Collect all unique WO numbers from jobs
  const woNumbers = new Set<string>();
  for (const job of jobs) {
    if (job.workOrderNumber) {
      woNumbers.add(job.workOrderNumber);
    }
  }

  if (woNumbers.size === 0) {
    return jobs.map(job => ({ job, workOrder: null }));
  }

  // Build OR conditions for all WO numbers in a single query
  const orConditions: any[] = [];
  for (const num of woNumbers) {
    if (num.length === 4) {
      orConditions.push(
        { orderNumber: num },
        { orderNumber: `WO${num}` },
        { orderNumber: { endsWith: num } },
      );
    } else {
      orConditions.push(
        { orderNumber: num },
        { orderNumber: `WO${num}` },
        { orderNumber: { contains: num } },
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
  return jobs.map(job => {
    const workOrder = job.workOrderNumber ? (woCache.get(job.workOrderNumber) ?? null) : null;
    return { job, workOrder };
  });
}

/**
 * Link cut jobs to ERP work orders
 */
export async function linkCutJobsToWorkOrders(jobs: ThriveCutJob[]): Promise<{
  job: ThriveCutJob;
  workOrder: { 
    id: string; 
    orderNumber: string; 
    customerName: string;
    companyBrand: string;
    status: string;
  } | null;
}[]> {
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
  printerName?: string,
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
        (p) => p.name.toLowerCase() === printerName.toLowerCase(),
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
      station = routing.find((s) => ['FLATBED', 'ROLL_TO_ROLL', 'SCREEN_PRINT'].includes(s)) || null;
    }
  }

  if (!station) {
    console.warn(`syncJobStatus: Could not determine station for job ${jobGuid} on order ${workOrderId}`);
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
      console.log(`syncJobStatus: Marked ${station} COMPLETED for order ${workOrderId} (job ${jobGuid})`);

      // Auto-advance next station
      const order = await prisma.workOrder.findUnique({
        where: { id: workOrderId },
        select: { routing: true },
      });
      if (order) {
        const routing = order.routing as string[];
        const currentIdx = routing.indexOf(station);
        const nextStation = currentIdx >= 0 && currentIdx < routing.length - 1 ? routing[currentIdx + 1] : null;
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

// Export for use in routes
export const thriveService = {
  getAllJobs: getAllThriveJobs,
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
