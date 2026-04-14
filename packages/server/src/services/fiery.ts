/**
 * Fiery/Vutek Integration Service
 * 
 * Parses JDF files from the EFI Fiery export folder to track
 * Vutek flatbed print jobs and link them to ERP work orders.
 * 
 * Linking Strategy (requires 2 data points):
 *   1. Match Fiery job name → Thrive job name
 *   2. Extract WO number AND customer name from Thrive file path
 *   3. Validate both against ERP database
 * 
 * Export Folder: \\192.168.254.57\EFI Export Folder
 * File Types:
 *   - .rtl  - Raster print data
 *   - .gif  - Preview images  
 *   - .jdf  - JDF job metadata (what we parse)
 *   - .zcc  - Zund cut files
 */

import { promises as fs } from 'fs';
import path from 'path';
import { XMLParser } from 'fast-xml-parser';
import { prisma } from '../db/client.js';
import { thriveService } from './thrive.js';
import {
  buildFierySearchTerms,
  extractFieryWorkOrderContext,
  normalizeFieryJobName,
} from './fiery-job-identity.js';

export const FIERY_CONFIG = {
  exportPath: '\\\\192.168.254.57\\EFI Export Folder',
  downloadPath: '\\\\192.168.254.57\\ProgramData\\EFI\\EFI XF\\JDF\\Download',
  ip: '192.168.254.57',
};

export interface FieryJob {
  jobId: string;
  jobName: string;
  fileName: string;
  timestamp: string | null;
  dimensions: {
    widthIn: number;
    heightIn: number;
  } | null;
  media: {
    vutekMedia: string | null;    // EFI:VutekProp Media (actual media loaded)
    brand: string | null;
    description: string | null;
    type: string | null;
  } | null;
  inks: string[];
  previewUrl: string | null;
  rtlUrl: string | null;
  hasZccCutFile: boolean;
  zccFileName: string | null;
  zccFilePath?: string | null;
  // Parsed work order info (from Thrive file path)
  workOrderNumber: string | null;
  customerName: string | null;
  // Thrive cross-reference data
  thriveFilePath: string | null;
  thriveJobMatch: boolean;
}

export interface FieryDownloadFile {
  fileName: string;
  filePath: string;
  timestamp: string | null;
}

export interface FieryJobLinked extends FieryJob {
  workOrder: {
    id: string;
    orderNumber: string;
    customerName: string;
    status: string;
  } | null;
  linkConfidence: 'high' | 'medium' | 'low' | 'none';
  linkReasons: string[];
}

export interface FieryCutJobRow {
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
  companyBrand?: string;
}

/**
 * Parse a JDF file to extract job metadata
 */
export async function parseJdfFile(filePath: string): Promise<FieryJob | null> {
  try {
    let content = await fs.readFile(filePath, 'utf-8');
    
    // Clean BOM if present
    content = content.replace(/^\uFEFF/, '');
    
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      removeNSPrefix: true, // Remove namespace prefixes for easier access
    });
    
    const result = parser.parse(content);
    const jdf = result.JDF;
    
    if (!jdf) return null;
    
    const jobId = jdf.JobID || path.basename(filePath, '.jdf');
    const jobName = extractJobName(jobId);
    
    // Get resources
    const resourcePool = jdf.ResourcePool || {};
    const resources = Array.isArray(resourcePool) ? resourcePool : [resourcePool];

    let previewUrl: string | null = null;
    let rtlUrl: string | null = null;
    let vutekMedia: string | null = null;
    let jdfBrand: string | null = null;
    let jdfDescription: string | null = null;
    let jdfMediaType: string | null = null;
    const inks: string[] = [];

    // Parse all resource elements
    for (const pool of resources) {
      // Preview URL
      const preview = pool.Preview;
      if (preview?.URL) {
        previewUrl = preview.URL;
      }

      // RunList - has file URL
      const runList = pool.RunList;
      if (runList) {
        const layoutElement = runList.LayoutElement;
        if (layoutElement) {
          const fileSpec = layoutElement.FileSpec;
          if (fileSpec?.URL) {
            rtlUrl = fileSpec.URL;
          }
        }
      }

      // JDF Media element (often a Fiery XF default, not actual media)
      const mediaEl = pool.Media;
      if (mediaEl) {
        jdfBrand = mediaEl.Brand || null;
        jdfDescription = mediaEl.DescriptiveName || null;
        jdfMediaType = mediaEl.MediaType || null;
      }

      // MachineProperties > VutekProp — RIP-side media mapping selected on the Fiery workflow
      // (EFI: namespace prefix is stripped by removeNSPrefix: true)
      const machineProps = pool.MachineProperties || pool['EFI:MachineProperties'];
      if (machineProps) {
        const vutekProp = machineProps.VutekProp || machineProps['EFI:VutekProp'];
        if (vutekProp?.Media) {
          vutekMedia = vutekProp.Media;
        }
      }

      // Colorant order (inks)
      const colorantControl = pool.ColorantControl;
      if (colorantControl?.ColorantOrder) {
        const sepSpecs = colorantControl.ColorantOrder.SeparationSpec;
        if (sepSpecs) {
          const specs = Array.isArray(sepSpecs) ? sepSpecs : [sepSpecs];
          for (const spec of specs) {
            if (spec.Name) {
              inks.push(spec.Name);
            }
          }
        }
      }
    }

    // Extract dimensions from job name (e.g., "101x83", "6.37x33.07", "31x8")
    const dimensions = parseDimensionsFromName(jobName);
    
    // Get timestamp: prefer file mtime (when actually printed) over AuditPool.Created.TimeStamp
    // (AuditPool.Created.TimeStamp is the JDF creation date, which can be years old for
    //  stale files that were never cleaned up from the Fiery export folder)
    let timestamp: string | null = null;
    try {
      const fileStat = await fs.stat(filePath);
      timestamp = fileStat.mtime.toISOString();
    } catch {
      // Fall back to AuditPool timestamp if stat fails
      const auditPool = jdf.AuditPool;
      if (auditPool?.Created?.TimeStamp) {
        timestamp = auditPool.Created.TimeStamp;
      }
    }
    
    // Check for matching ZCC file
    const baseName = path.basename(filePath, '.jdf').replace('.rtl_101', '').replace('.rtl', '');
    const dir = path.dirname(filePath);
    const zccFiles = await findMatchingZccFiles(dir, baseName);
    
    // Build media info: the JDF Media resource holds the physical substrate/profile,
    // while VutekProp Media carries the Fiery RIP-side media mapping.
    // Real per-job media comes from Thrive cross-reference (applied later).
    const media: FieryJob['media'] = {
      vutekMedia: vutekMedia || null,
      brand: null,       // JDF brand is always wrong (Appleton)
      description: null, // Will be set from Thrive printMedia if matched
      type: null,
    };

    // Work order info will be populated later via Thrive cross-reference
    return {
      jobId,
      jobName,
      fileName: path.basename(filePath),
      timestamp,
      dimensions,
      media,
      inks,
      previewUrl,
      rtlUrl,
      hasZccCutFile: zccFiles.length > 0,
      zccFileName: zccFiles[0] || null,
      zccFilePath: zccFiles[0] ? path.join(dir, zccFiles[0]) : null,
      workOrderNumber: null,
      customerName: null,
      thriveFilePath: null,
      thriveJobMatch: false,
    };
  } catch (error) {
    console.error(`Error parsing JDF file ${filePath}:`, error);
    return null;
  }
}

/**
 * Extract a clean job name from JDF job ID
 */
function extractJobName(jobId: string): string {
  // Remove .rtl_101 suffix if present
  let name = jobId.replace(/\.rtl(_\d+)?$/, '');
  return name;
}

/**
 * Extract piece dimensions from job name (e.g., "101x83", "6.37x33.07", "31x8")
 * These are the actual piece sizes embedded in the naming convention.
 * JDF Component Dimensions are total tile/nested area and not useful.
 */
function parseDimensionsFromName(name: string): FieryJob['dimensions'] {
  // Match patterns like: 101x83, 6.37x33.07, 10x10, 28x35
  // Must appear as a standalone segment (preceded by start/underscore/dash/space)
  const match = name.match(/(?:^|[_\- ])(\d+\.?\d*)x(\d+\.?\d?)(?=[_\- (]|$)/i);
  if (match) {
    const w = parseFloat(match[1]);
    const h = parseFloat(match[2]);
    if (w > 0 && h > 0 && w < 500 && h < 500) {
      return { widthIn: w, heightIn: h };
    }
  }
  return null;
}

/**
 * Find matching ZCC files for a job
 */
async function findMatchingZccFiles(dir: string, baseName: string): Promise<string[]> {
  try {
    const files = await fs.readdir(dir);
    return files.filter(f => 
      f.endsWith('.zcc') && 
      f.startsWith(baseName)
    );
  } catch {
    return [];
  }
}

/**
 * Parse work order number from job name
 * Fiery jobs come from Thrive nesting, names like:
 *   - Nesting_P1_T1_189_158
 *   - TostitosPepsi - DoorSign_28x35_2025(S&R)_P1_T1_158_458
 */
function parseWorkOrderFromJobName(jobName: string): { 
  workOrderNumber: string | null; 
  customerName: string | null;
} {
  // Nesting jobs don't have work order numbers
  if (jobName.startsWith('Nesting_')) {
    return { workOrderNumber: null, customerName: null };
  }
  
  // Try to extract customer name (before the first underscore or dash)
  const match = jobName.match(/^([A-Za-z0-9]+)/);
  const customerName = match ? match[1] : null;
  
  // WO##### pattern
  const woMatch = jobName.match(/WO(\d{4,5})/i);
  if (woMatch) {
    return { 
      workOrderNumber: `WO${woMatch[1]}`, 
      customerName 
    };
  }
  
  return { workOrderNumber: null, customerName };
}

/**
 * Get all JDF files from the Fiery export folder
 */
export async function getAllJdfFiles(): Promise<string[]> {
  try {
    const files = await fs.readdir(FIERY_CONFIG.exportPath);
    return files
      .filter(f => f.endsWith('.jdf'))
      .map(f => path.join(FIERY_CONFIG.exportPath, f));
  } catch (error) {
    console.error('Error reading Fiery export folder:', error);
    return [];
  }
}

interface ThriveLookupEntry {
  fileName: string;
  jobName: string;
  printMedia?: string;
}

/**
 * Build Thrive job lookup map for cross-referencing
 * Maps normalized job names to their file paths + media info
 */
async function buildThriveJobLookup(): Promise<Map<string, ThriveLookupEntry>> {
  const lookup = new Map<string, ThriveLookupEntry>();

  try {
    const { printJobs } = await thriveService.getAllJobs();

    for (const job of printJobs) {
      const entry: ThriveLookupEntry = {
        fileName: job.fileName,
        jobName: job.jobName,
        printMedia: (job as any).printMedia || undefined,
      };

      // Create normalized key from job name
      const normalizedName = normalizeFieryJobName(job.jobName);
      lookup.set(normalizedName, entry);

      // Also index by base file name (without path)
      const baseFileName = path.basename(job.fileName, '.pdf');
      const normalizedBaseName = normalizeFieryJobName(baseFileName);
      if (!lookup.has(normalizedBaseName)) {
        lookup.set(normalizedBaseName, entry);
      }
    }
  } catch (error) {
    console.warn('Could not build Thrive job lookup:', error);
  }

  return lookup;
}

/**
 * Search file server for matching print file by partial name
 * Returns the first matching file path containing a WO folder
 */
async function searchFileServerForSource(jobName: string): Promise<string | null> {
  // Extract key search terms from job name (first meaningful part)
  const searchTerms = buildFierySearchTerms(jobName);
  
  if (searchTerms.length === 0) return null;

  const basePaths = [
    '\\\\wildesigns-fs1\\Company Files',
    '\\\\wildesigns-fs1\\Company Files\\Safari',
  ];
  
  for (const basePath of basePaths) {
    try {
      // Get customer folders  
      const customerFolders = await fs.readdir(basePath);
      
      for (const customer of customerFolders.slice(0, 50)) { // Limit for performance
        const customerPath = path.join(basePath, customer);
        
        try {
          const stat = await fs.stat(customerPath);
          if (!stat.isDirectory()) continue;
          
          // Look for WO folders
          const items = await fs.readdir(customerPath);
          const woFolders = items.filter(i => /^WO\d{4,5}/i.test(i));
          
          for (const woFolder of woFolders.slice(0, 10)) { // Limit
            const printPath = path.join(customerPath, woFolder, 'PRINT');
            
            try {
              const printFiles = await fs.readdir(printPath);
              const match = printFiles.find(f => 
                searchTerms.every(term => 
                  f.toLowerCase().includes(term.toLowerCase())
                )
              );
              
              if (match) {
                return path.join(printPath, match);
              }
            } catch {
              // PRINT folder doesn't exist
            }
          }
        } catch {
          // Can't read customer folder
        }
      }
    } catch {
      // Can't access base path
    }
  }
  
  return null;
}

// ─── TTL Cache for getAllFieryJobs ───────────────────
let fieryJobsCache: { data: FieryJob[]; expiresAt: number } | null = null;
const FIERY_CACHE_TTL_MS = 30_000; // 30 seconds
let fieryDownloadCache: { data: FieryDownloadFile[]; expiresAt: number } | null = null;
const FIERY_DOWNLOAD_CACHE_TTL_MS = 10_000; // 10 seconds

/**
 * Build Thrive job lookup from pre-fetched data (avoids duplicate network call)
 */
function buildThriveJobLookupFromData(printJobs: Array<{ fileName: string; jobName: string; printMedia?: string }>): Map<string, ThriveLookupEntry> {
  const lookup = new Map<string, ThriveLookupEntry>();
  for (const job of printJobs) {
    const entry: ThriveLookupEntry = { fileName: job.fileName, jobName: job.jobName, printMedia: job.printMedia };
    const normalizedName = normalizeFieryJobName(job.jobName);
    lookup.set(normalizedName, entry);
    const baseFileName = path.basename(job.fileName, '.pdf');
    const normalizedBaseName = normalizeFieryJobName(baseFileName);
    if (!lookup.has(normalizedBaseName)) {
      lookup.set(normalizedBaseName, entry);
    }
  }
  return lookup;
}

function cloneFieryJob(job: FieryJob): FieryJob {
  return {
    ...job,
    media: job.media
      ? {
          ...job.media,
          description: null,
        }
      : null,
    inks: [...job.inks],
    workOrderNumber: null,
    customerName: null,
    thriveFilePath: null,
    thriveJobMatch: false,
  };
}

async function enrichFieryJobs(
  baseJobs: FieryJob[],
  thriveLookup: Map<string, ThriveLookupEntry>
): Promise<FieryJob[]> {
  const jobs = baseJobs.map(cloneFieryJob);

  for (const job of jobs) {
    const normalizedFieryName = normalizeFieryJobName(job.jobName);
    const thriveMatch = thriveLookup.get(normalizedFieryName);
    if (thriveMatch) {
      const pathInfo = extractFieryWorkOrderContext(thriveMatch.fileName);
      job.workOrderNumber = pathInfo.workOrderNumber;
      job.customerName = pathInfo.customerName;
      job.thriveFilePath = thriveMatch.fileName;
      job.thriveJobMatch = true;
      // Keep the Thrive print-media label separate from the RIP substrate.
      // The actual RIP-side media remains in `vutekMedia` from the parsed JDF.
      if (thriveMatch.printMedia) {
        job.media = {
          brand: job.media?.brand ?? null,
          description: thriveMatch.printMedia,
          type: job.media?.type ?? null,
          vutekMedia: job.media?.vutekMedia ?? null,
        };
      }
    }
  }

  // For recent unlinked jobs, try file server search fallback
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const unlinkedRecent = jobs.filter(
    (j) => !j.thriveJobMatch && j.timestamp && new Date(j.timestamp).getTime() > weekAgo
  );
  // Limit file server searches to avoid slow responses
  const searchBatch = unlinkedRecent.slice(0, 20);
  if (searchBatch.length > 0) {
    await Promise.all(
      searchBatch.map(async (job) => {
        try {
          const sourcePath = await searchFileServerForSource(job.jobName);
          if (sourcePath) {
            const pathInfo = extractFieryWorkOrderContext(sourcePath);
            job.workOrderNumber = pathInfo.workOrderNumber;
            job.customerName = pathInfo.customerName;
            job.thriveFilePath = sourcePath;
          }
        } catch {}
      })
    );
  }

  return jobs;
}

/**
 * Get all Fiery jobs with Thrive cross-reference.
 * Optionally accepts pre-fetched Thrive print jobs to avoid a duplicate network call.
 */
export async function getAllFieryJobs(preFetchedPrintJobs?: Array<{ fileName: string; jobName: string }>): Promise<FieryJob[]> {
  // Build thrive lookup from pre-fetched data or fetch fresh
  const thriveLookup = preFetchedPrintJobs
    ? buildThriveJobLookupFromData(preFetchedPrintJobs)
    : await buildThriveJobLookup();

  // Return cached JDF parse if still valid, then re-apply the current Thrive lookup
  // so callers with fresh pre-fetched queue data still get fast responses.
  if (fieryJobsCache && Date.now() < fieryJobsCache.expiresAt) {
    return enrichFieryJobs(fieryJobsCache.data, thriveLookup);
  }

  const jdfFiles = await getAllJdfFiles();

  // Parse JDF files in parallel (batches of 10 to avoid too many open file handles)
  const BATCH_SIZE = 10;
  const jobs: FieryJob[] = [];
  for (let i = 0; i < jdfFiles.length; i += BATCH_SIZE) {
    const batch = jdfFiles.slice(i, i + BATCH_SIZE);
    const parsed = await Promise.all(batch.map(f => parseJdfFile(f)));
    for (const job of parsed) {
      if (job) jobs.push(job);
    }
  }

  // Cache the parsed JDF snapshot; Thrive enrichment is applied per call.
  fieryJobsCache = { data: jobs, expiresAt: Date.now() + FIERY_CACHE_TTL_MS };

  return enrichFieryJobs(jobs, thriveLookup);
}

async function scanFieryDownloadFiles(dir: string, depth: number): Promise<FieryDownloadFile[]> {
  if (depth > 4) return [];

  const files: FieryDownloadFile[] = [];
  let entries: string[];

  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const lower = entry.toLowerCase();

    try {
      const stat = await fs.stat(fullPath);
      if (stat.isDirectory()) {
        files.push(...(await scanFieryDownloadFiles(fullPath, depth + 1)));
      } else if (stat.isFile() && lower.endsWith('.pdf')) {
        files.push({
          fileName: entry,
          filePath: fullPath,
          timestamp: stat.mtime.toISOString(),
        });
      }
    } catch {
      // Skip unreadable entries.
    }
  }

  return files;
}

/**
 * Get PDF files currently downloaded by the Fiery JDF connector.
 * These are stronger evidence that the job has actually reached the RIP machine
 * even if the export-folder JDF/RTL artifacts have not appeared yet.
 */
export async function getAllFieryDownloadFiles(): Promise<FieryDownloadFile[]> {
  if (fieryDownloadCache && Date.now() < fieryDownloadCache.expiresAt) {
    return fieryDownloadCache.data;
  }

  const files = await scanFieryDownloadFiles(FIERY_CONFIG.downloadPath, 0);
  fieryDownloadCache = { data: files, expiresAt: Date.now() + FIERY_DOWNLOAD_CACHE_TTL_MS };
  return files;
}

/**
 * Enrich a single Fiery job by searching the file server for source
 * Use this for targeted linking when Thrive queue doesn't have the job
 */
export async function enrichFieryJobFromFileServer(job: FieryJob): Promise<FieryJob> {
  if (job.thriveJobMatch) return job; // Already has Thrive data
  
  const sourcePath = await searchFileServerForSource(job.jobName);
  if (sourcePath) {
    const pathInfo = extractFieryWorkOrderContext(sourcePath);
    job.workOrderNumber = pathInfo.workOrderNumber;
    job.customerName = pathInfo.customerName;
    job.thriveFilePath = sourcePath;
    job.thriveJobMatch = false; // File server match, not Thrive
  }
  
  return job;
}

/**
 * Link Fiery jobs to ERP work orders with dual validation
 * Requires matching both WO number AND customer name for high confidence
 */
export async function linkFieryJobsToOrders(jobs: FieryJob[]): Promise<FieryJobLinked[]> {
  const results: FieryJobLinked[] = [];
  const woCache = new Map<string, any>();
  
  for (const job of jobs) {
    let workOrder = null;
    let linkConfidence: FieryJobLinked['linkConfidence'] = 'none';
    const linkReasons: string[] = [];
    
    if (job.workOrderNumber) {
      // Check cache first
      const cacheKey = job.workOrderNumber;
      if (woCache.has(cacheKey)) {
        workOrder = woCache.get(cacheKey);
      } else {
        // Query database for WO number (with and without prefix)
        const woNumber = job.workOrderNumber.replace('WO', '');
        const wo = await prisma.workOrder.findFirst({
          where: {
            OR: [
              { orderNumber: job.workOrderNumber },
              { orderNumber: woNumber },
            ],
          },
          select: {
            id: true,
            orderNumber: true,
            customerName: true,
            status: true,
          },
        });
        
        if (wo) {
          workOrder = wo;
          woCache.set(cacheKey, wo);
        }
      }
      
      if (workOrder) {
        linkReasons.push(`WO number match: ${job.workOrderNumber}`);
        
        // Validate customer name for high confidence
        if (job.customerName && job.thriveJobMatch) {
          const normalizedThriveCustomer = job.customerName.toLowerCase().replace(/[^a-z0-9]/g, '');
          const normalizedDbCustomer = workOrder.customerName.toLowerCase().replace(/[^a-z0-9]/g, '');
          
          // Check for partial match (one contains the other)
          if (normalizedThriveCustomer.includes(normalizedDbCustomer) ||
              normalizedDbCustomer.includes(normalizedThriveCustomer) ||
              normalizedThriveCustomer === normalizedDbCustomer) {
            linkConfidence = 'high';
            linkReasons.push(`Customer match: "${job.customerName}" ↔ "${workOrder.customerName}"`);
          } else {
            linkConfidence = 'medium';
            linkReasons.push(`Customer mismatch: "${job.customerName}" vs "${workOrder.customerName}"`);
          }
        } else {
          // WO match only, no Thrive cross-reference
          linkConfidence = 'low';
          linkReasons.push('No Thrive cross-reference for customer validation');
        }
      }
    } else if (job.thriveJobMatch) {
      // Thrive match but no WO number (might be nesting job)
      linkReasons.push('Thrive job matched but no WO in file path');
    }
    
    results.push({
      ...job,
      workOrder,
      linkConfidence,
      linkReasons,
    });
  }
  
  return results;
}

/**
 * Convert Fiery jobs into the cut-job row shape used by the equipment detail panel.
 * Only Fiery jobs with an actual cut file and a usable Thrive/work-order match are included.
 */
export function buildFieryCutJobRows(jobs: FieryJob[]): FieryCutJobRow[] {
  return jobs
    .filter((job) => job.hasZccCutFile && (job.thriveJobMatch || Boolean(job.workOrderNumber)))
    .map((job) => {
      const widthMm = job.dimensions?.widthIn ? Math.round(job.dimensions.widthIn * 25.4) : 0;
      const heightMm = job.dimensions?.heightIn ? Math.round(job.dimensions.heightIn * 25.4) : 0;
      const displayMedia = job.media?.description || job.media?.vutekMedia || '—';

      return {
        jobName: job.jobName,
        fileName: job.zccFileName || job.fileName,
        workOrderNumber: job.workOrderNumber ?? undefined,
        device: 'Fiery ZCC',
        printer: job.media?.vutekMedia || job.media?.description || 'Fiery',
        media: displayMedia,
        width: widthMm,
        height: heightMm,
        guid: job.jobId,
        customerName: job.customerName ?? undefined,
        companyBrand: undefined,
      };
    });
}

/**
 * Get Fiery job summary statistics
 */
export async function getFierySummary(): Promise<{
  totalJobs: number;
  jobsWithCutFiles: number;
  jobsByInkConfig: Record<string, number>;
  uniqueMediaTypes: string[];
  linkedToOrders: number;
  nestingJobs: number;
  thriveMatched: number;
  linkConfidence: {
    high: number;
    medium: number;
    low: number;
    none: number;
  };
}> {
  const jobs = await getAllFieryJobs();
  const linked = await linkFieryJobsToOrders(jobs);
  
  const inkConfigs: Record<string, number> = {};
  const mediaTypes = new Set<string>();
  let jobsWithCutFiles = 0;
  let linkedToOrders = 0;
  let nestingJobs = 0;
  let thriveMatched = 0;
  const confidence = { high: 0, medium: 0, low: 0, none: 0 };
  
  for (const job of linked) {
    // Count cut files
    if (job.hasZccCutFile) jobsWithCutFiles++;
    
    // Count linked
    if (job.workOrder) linkedToOrders++;
    
    // Count nesting jobs
    if (job.jobName.startsWith('Nesting_')) nestingJobs++;
    
    // Count Thrive matches
    if (job.thriveJobMatch) thriveMatched++;
    
    // Count confidence levels
    confidence[job.linkConfidence]++;
    
    // Track ink configurations
    const inkKey = job.inks.sort().join('+');
    inkConfigs[inkKey] = (inkConfigs[inkKey] || 0) + 1;
    
    // Track media types
    const mediaName = job.media?.vutekMedia || job.media?.description;
    if (mediaName) {
      mediaTypes.add(mediaName);
    }
  }
  
  return {
    totalJobs: jobs.length,
    jobsWithCutFiles,
    jobsByInkConfig: inkConfigs,
    uniqueMediaTypes: Array.from(mediaTypes),
    linkedToOrders,
    nestingJobs,
    thriveMatched,
    linkConfidence: confidence,
  };
}

// Export service object
export const fieryService = {
  parseJdfFile,
  getAllJdfFiles,
  getAllFieryJobs,
  linkFieryJobsToOrders,
  buildFieryCutJobRows,
  getFierySummary,
  enrichFieryJobFromFileServer,
  config: FIERY_CONFIG,
};

export default fieryService;
