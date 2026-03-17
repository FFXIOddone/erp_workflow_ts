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

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
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
 * CutIDs look like: P1_T1_162_57_33277349
 * Found in Fiery/Thrive/Zund job names as a suffix.
 * Returns null if no cutID found.
 */
export function extractCutId(name: string): string | null {
  const match = name.match(/_(P\d+_T\d+_\d+_\d+(?:_\d+)?)(?:\.[^.]+)?$/i);
  return match ? match[1] : null;
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

// Cache Zund jobs to avoid hammering the network share on every request
let zundJobsCache: { data: any[]; timestamp: number } | null = null;
let zundErrorCache: { timestamp: number } | null = null;
const ZUND_CACHE_TTL = 60_000; // 1 minute cache for successful data
const ZUND_ERROR_TTL = 120_000; // 2 minute cooldown after failure

/**
 * Get completed Zund jobs from statistics database
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
  // Return cached data if still fresh
  if (zundJobsCache && (Date.now() - zundJobsCache.timestamp) < ZUND_CACHE_TTL) {
    return zundJobsCache.data;
  }
  // Don't retry if we recently failed — avoids spamming network share
  if (zundErrorCache && (Date.now() - zundErrorCache.timestamp) < ZUND_ERROR_TTL) {
    return [];
  }
  const source = '\\\\192.168.254.28\\Statistics\\Statistic.db3';
  // Use a unique temp filename to avoid collisions with locked temp files
  const dest = path.join(os.tmpdir(), `Statistic_match_${process.pid}_${Date.now()}.db3`);
  
  try {
    // Try direct copy first
    fs.copyFileSync(source, dest);
  } catch {
    try {
      // Fallback: buffer copy works when the file is locked by another process
      // because readFileSync uses a different OS primitive than copyFileSync
      const buffer = fs.readFileSync(source);
      fs.writeFileSync(dest, buffer);
    } catch {
      try {
        // Fallback 2: Use Windows shell copy which handles locked files better
        // The /Y flag suppresses overwrite prompt, /B copies as binary
        const { execSync } = await import('child_process');
        execSync(`copy /Y /B "${source}" "${dest}"`, { 
          timeout: 15000, 
          windowsHide: true,
          stdio: 'pipe',
        });
        // Verify the file was actually copied
        if (!fs.existsSync(dest) || fs.statSync(dest).size === 0) {
          throw new Error('Copy produced empty file');
        }
      } catch (error3) {
        try {
          // Fallback 3: robocopy (can copy locked files via backup mode)
          const { execSync } = await import('child_process');
          const sourceDir = '\\\\192.168.254.28\\Statistics';
          const destDir = path.dirname(dest);
          const destFilename = path.basename(dest);
          // robocopy exits with codes 0-7 for success, rename after copy
          execSync(`robocopy "${sourceDir}" "${destDir}" "Statistic.db3" /B /R:1 /W:1`, {
            timeout: 15000,
            windowsHide: true,
            stdio: 'pipe',
          });
          // robocopy copies with original name, rename to our temp name
          const robocopyDest = path.join(destDir, 'Statistic.db3');
          if (fs.existsSync(robocopyDest)) {
            fs.renameSync(robocopyDest, dest);
          }
          if (!fs.existsSync(dest) || fs.statSync(dest).size === 0) {
            throw new Error('Robocopy produced empty file');
          }
        } catch (error4) {
          console.warn('Zund statistics DB unavailable (will retry in 2 min)');
          zundErrorCache = { timestamp: Date.now() };
          try { fs.unlinkSync(dest); } catch {}
          return [];
        }
      }
    }
  }
  
  let db: Database.Database;
  try {
    db = new Database(dest, { readonly: true });
  } catch (error) {
    console.error('Could not open Zund statistics database:', error);
    // Clean up temp file
    try { fs.unlinkSync(dest); } catch {}
    return [];
  }
  
  const cutoffTime = Math.floor((Date.now() - daysBack * 24 * 60 * 60 * 1000) / 1000);
  
  const jobs = db.prepare(`
    SELECT JobID, JobName, ProductionStart, ProductionEnd, CopyDone, CopyTotal, Cutter
    FROM ProductionTimeJob 
    WHERE ProductionStart > ?
    ORDER BY ProductionStart DESC
  `).all(cutoffTime);
  
  db.close();
  // Clean up temp file after reading
  try { fs.unlinkSync(dest); } catch {}
  
  const result = (jobs as any[]).map(j => ({
    jobId: j.JobID,
    jobName: j.JobName,
    productionStart: new Date(j.ProductionStart * 1000),
    productionEnd: new Date(j.ProductionEnd * 1000),
    copyDone: j.CopyDone,
    copyTotal: j.CopyTotal,
    cutter: j.Cutter,
  }));

  // Store in cache
  zundJobsCache = { data: result, timestamp: Date.now() };
  return result;
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
  
  // Build a lookup map of normalized print job names to WO
  const printJobMap = new Map<string, typeof printCutJobs[0]>();
  for (const pj of printCutJobs) {
    printJobMap.set(pj.normalizedName, pj);
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
      // Try exact match on normalized name
      const exactMatch = printJobMap.get(info.normalized);
      if (exactMatch) {
        match.matchedOrderNumber = exactMatch.workOrderNumber;
        match.matchedOrderId = exactMatch.orderId;
        match.matchConfidence = 'exact';
      } else {
        // Try partial match - look for Zund job name containing print job name or vice versa
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
