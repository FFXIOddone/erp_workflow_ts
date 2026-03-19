/**
 * Zund Job Matching Service
 * 
 * Links ERP work orders to Zund cut jobs by matching print file names
 * to Zund job names (since Zund doesn't track WO numbers)
 * 
 * File naming patterns detected:
 * - PRINTCUT.pdf / PRINTANDCUT.pdf / PRINT_CUT.pdf
 * - PRINT-CUT / PRINT(CUT) / etc.
 * - NESTING jobs = potentially multiple work orders
 */

import { prisma } from '../db/client.js';

// Patterns that indicate print+cut files
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

// Pattern for nesting jobs (multiple orders)
const NESTING_PATTERN = /^Nesting|NESTING/i;

export interface ZundJobMatch {
  zundJobName: string;
  zundJobId?: number;
  productionDate: Date;
  copyCount: number;
  matchedOrderNumber?: string;
  matchedOrderId?: string;
  matchedCustomerName?: string;
  matchConfidence: 'exact' | 'partial' | 'possible' | 'nesting';
  isNesting: boolean;
  possibleOrderNumbers?: string[];
}

/**
 * Extract the CutID identifier from a filename.
 * Two formats exist:
 *   Fiery:  P1_T1_162_57_33277349 (underscore-separated, mostly numeric)
 *   Thrive: 0DGPMDD2632 (alphanumeric mix with letters + trailing digits)
 * CutIDs appear as suffixes on both print and cut job names,
 * making them the strongest link between print→cut files.
 * Returns null if no cutID found.
 */
export function extractCutId(name: string): string | null {
  // Remove file extension first
  const clean = name.replace(/\.(pdf|ai|eps|svg|zcc|xml|xml_tmp)$/i, '');

  // Try Fiery format first (more specific pattern): _P1_T1_162_57_33277349
  const fieryMatch = clean.match(/[_-]?(P\d+_T\d+_\d+_\d+(?:_\d+)?)$/i);
  if (fieryMatch) return fieryMatch[1];

  // Try Thrive format: _0DGPMDD2632 (7+ alphanumeric chars with 3+ trailing digits)
  // Must contain at least one letter to avoid matching pure numeric ONYX/Fiery suffixes
  const thriveMatch = clean.match(/[_-]?([A-Z0-9]{7,}\d{3,})$/i);
  if (thriveMatch && !/^\d+$/.test(thriveMatch[1])) return thriveMatch[1];

  return null;
}

/**
 * Normalize a job/file name for matching
 * Removes common suffixes, extensions, and formatting
 */
export function normalizeJobName(name: string): string {
  return name
    // Remove file extensions
    .replace(/\.(pdf|ai|eps|svg|zcc|xml|xml_tmp)$/i, '')
    // Remove ONYX-specific suffixes
    .replace(/_P\d+_T\d+_\d+_\d+.*$/i, '') // _P1_T1_169_629_132221...
    .replace(/_\d{10,}$/i, '') // Long numeric suffix
    .replace(/[_-]copy\d*$/i, '') // -copy, _copy2, etc.
    // Remove Thrive random ID suffixes (7+ alphanumeric at end)
    .replace(/_[A-Z0-9]{7,}\d{3,}$/i, '') // _0RWRGPI2624
    .replace(/\([^)]+\)$/, '') // (S&R) at end
    // Normalize separators
    .replace(/[-_]+/g, '_')
    .toLowerCase()
    .trim();
}

/**
 * Extract potential identifiers from job name
 */
export function extractIdentifiers(name: string): {
  normalized: string;
  dimensions?: string;
  productName?: string;
  isPrintCut: boolean;
  isNesting: boolean;
} {
  const normalized = normalizeJobName(name);
  const isPrintCut = PRINT_CUT_PATTERNS.some(p => p.test(name));
  const isNesting = NESTING_PATTERN.test(name);
  
  // Extract dimensions like "5x13" or "6.37x33.07"
  const dimMatch = name.match(/(\d+\.?\d*)\s*x\s*(\d+\.?\d*)/i);
  const dimensions = dimMatch ? `${dimMatch[1]}x${dimMatch[2]}` : undefined;
  
  // Extract product name (after dimensions, before PRINTCUT/etc)
  let productName: string | undefined;
  if (dimMatch) {
    const afterDim = name.slice(name.indexOf(dimMatch[0]) + dimMatch[0].length);
    const cleanProduct = afterDim
      .replace(/^[-_\s]+/, '')
      .replace(/[-_]?(PRINTCUT|PRINTANDCUT|PRINT_CUT|PRINT-CUT).*/i, '')
      .replace(/[-_]?Blade[-_]?Sign.*/i, '')
      .replace(/[-_]?NEW$/i, '')
      .trim();
    if (cleanProduct.length > 2) {
      productName = cleanProduct;
    }
  }
  
  return { normalized, dimensions, productName, isPrintCut, isNesting };
}

/**
 * Get completed Zund jobs from statistics database (both Zund 1 and Zund 2).
 * Delegates to zund-stats.ts which handles SMB copy, caching, and timeouts.
 */
export async function getZundCompletedJobs(daysBack = 30): Promise<Array<{
  jobId: number;
  jobName: string;
  productionStart: Date;
  productionEnd: Date;
  copyDone: number;
  copyTotal: number;
  cutter: string;
}>> {
  const { getAvailableZunds, getRecentJobs, isZundStatsAccessible } = await import('./zund-stats.js');
  const allJobs: Array<{
    jobId: number;
    jobName: string;
    productionStart: Date;
    productionEnd: Date;
    copyDone: number;
    copyTotal: number;
    cutter: string;
  }> = [];

  const zundIds = getAvailableZunds();
  const results = await Promise.allSettled(
    zundIds.map(async (zundId) => {
      const accessible = await isZundStatsAccessible(zundId);
      if (!accessible) return [];
      // getRecentJobs returns ISO strings; we need Dates for this API
      const jobs = await getRecentJobs(zundId, 500);
      const cutoff = Date.now() - daysBack * 24 * 60 * 60 * 1000;
      return jobs
        .filter(j => new Date(j.productionStart).getTime() > cutoff)
        .map(j => ({
          jobId: j.jobId,
          jobName: j.jobName,
          productionStart: new Date(j.productionStart),
          productionEnd: j.productionEnd ? new Date(j.productionEnd) : new Date(),
          copyDone: j.copyDone,
          copyTotal: j.copyTotal,
          cutter: j.cutter,
        }));
    })
  );

  for (const r of results) {
    if (r.status === 'fulfilled') allJobs.push(...r.value);
  }

  // Sort newest first
  allJobs.sort((a, b) => b.productionStart.getTime() - a.productionStart.getTime());
  return allJobs;
}

/**
 * Get print job file names from Thrive that have PRINTCUT patterns
 */
export async function getPrintCutJobsFromThrive(): Promise<Array<{
  workOrderNumber: string;
  orderId?: string;
  fileName: string;
  normalizedName: string;
  printer: string;
}>> {
  // Import from thrive service
  const { thriveService } = await import('./thrive.js');
  const { printJobs } = await thriveService.getAllJobs();
  
  const results: Array<{
    workOrderNumber: string;
    orderId?: string;
    fileName: string;
    normalizedName: string;
    printer: string;
  }> = [];
  
  // Link to orders
  const linked = await thriveService.linkJobsToWorkOrders(printJobs);
  
  for (const { job, workOrder } of linked) {
    const info = extractIdentifiers(job.jobName);
    
    if (info.isPrintCut && job.workOrderNumber) {
      results.push({
        workOrderNumber: job.workOrderNumber,
        orderId: workOrder?.id,
        fileName: job.jobName,
        normalizedName: info.normalized,
        printer: job.printer,
      });
    }
  }
  
  return results;
}

/**
 * Match Zund completed jobs to work orders
 */
export async function matchZundJobsToOrders(daysBack = 30): Promise<ZundJobMatch[]> {
  console.log(`Matching Zund jobs from last ${daysBack} days...`);
  
  // Get Zund completed jobs
  const zundJobs = await getZundCompletedJobs(daysBack);
  console.log(`Found ${zundJobs.length} completed Zund jobs`);
  
  // Get Thrive print jobs with PRINTCUT patterns
  const printCutJobs = await getPrintCutJobsFromThrive();
  console.log(`Found ${printCutJobs.length} print jobs with PRINTCUT patterns`);
  
  // Build lookup maps: normalized name → WO and cutId → WO
  const printJobMap = new Map<string, typeof printCutJobs[0]>();
  const cutIdMap = new Map<string, typeof printCutJobs[0]>();
  for (const pj of printCutJobs) {
    printJobMap.set(pj.normalizedName, pj);
    // Index by CutID for highest-confidence matching
    const cutId = extractCutId(pj.fileName);
    if (cutId) cutIdMap.set(cutId.toLowerCase(), pj);
  }
  
  const results: ZundJobMatch[] = [];
  
  for (const zj of zundJobs) {
    const info = extractIdentifiers(zj.jobName);
    
    const match: ZundJobMatch = {
      zundJobName: zj.jobName,
      zundJobId: zj.jobId,
      productionDate: zj.productionStart,
      copyCount: zj.copyDone,
      isNesting: info.isNesting,
      matchConfidence: 'possible',
    };
    
    if (info.isNesting) {
      // Nesting jobs may contain multiple orders
      match.matchConfidence = 'nesting';
      // Try to extract possible order numbers from the filename if any
      const woMatches = zj.jobName.match(/\d{4,5}/g);
      if (woMatches) {
        match.possibleOrderNumbers = woMatches;
      }
    } else {
      // Priority 1: CutID match (strongest signal — same ID on print and cut sides)
      const zundCutId = extractCutId(zj.jobName);
      const cutIdMatch = zundCutId ? cutIdMap.get(zundCutId.toLowerCase()) : null;
      if (cutIdMatch) {
        match.matchedOrderNumber = cutIdMatch.workOrderNumber;
        match.matchedOrderId = cutIdMatch.orderId;
        match.matchConfidence = 'exact';
      } else {
        // Priority 2: Exact normalized name match
        const exactMatch = printJobMap.get(info.normalized);
        if (exactMatch) {
          match.matchedOrderNumber = exactMatch.workOrderNumber;
          match.matchedOrderId = exactMatch.orderId;
          match.matchConfidence = 'exact';
        } else {
          // Priority 3: Partial match - substring containment
          for (const [normalizedPrint, printJob] of printJobMap) {
            if (info.normalized.includes(normalizedPrint) || normalizedPrint.includes(info.normalized)) {
              match.matchedOrderNumber = printJob.workOrderNumber;
              match.matchedOrderId = printJob.orderId;
              match.matchConfidence = 'partial';
              break;
            }
          }
        }
      }
    }
    
    // If we have an order ID, get customer name
    if (match.matchedOrderId) {
      const order = await prisma.workOrder.findUnique({
        where: { id: match.matchedOrderId },
        select: { customerName: true }
      });
      match.matchedCustomerName = order?.customerName;
    }
    
    results.push(match);
  }
  
  return results;
}

/**
 * Get summary of Zund matching results
 */
export async function getZundMatchingSummary(daysBack = 30) {
  const matches = await matchZundJobsToOrders(daysBack);
  
  const summary = {
    total: matches.length,
    exact: matches.filter(m => m.matchConfidence === 'exact').length,
    partial: matches.filter(m => m.matchConfidence === 'partial').length,
    possible: matches.filter(m => m.matchConfidence === 'possible').length,
    nesting: matches.filter(m => m.matchConfidence === 'nesting').length,
    matchRate: 0,
    topMatches: [] as ZundJobMatch[],
    nestingJobs: [] as ZundJobMatch[],
  };
  
  summary.matchRate = ((summary.exact + summary.partial) / summary.total) * 100;
  summary.topMatches = matches.filter(m => m.matchConfidence === 'exact' || m.matchConfidence === 'partial').slice(0, 10);
  summary.nestingJobs = matches.filter(m => m.isNesting).slice(0, 10);
  
  return { summary, matches };
}

export const zundMatchService = {
  normalizeJobName,
  extractIdentifiers,
  getZundCompletedJobs,
  getPrintCutJobsFromThrive,
  matchZundJobsToOrders,
  getZundMatchingSummary,
};
