/**
 * Zund Live Data Service
 * 
 * Aggregates real-time cutting data for Zund machines from multiple sources:
 * 1. Zund Statistics SQLite DB (Zund 2 only — Zund 1 has no Statistics share)
 * 2. Thrive Cut Center folders (pending cut files to be sent from Thrive to Zund)
 * 3. File Server Zund Queue (\\wildesigns-fs1\Company Files\Zund — JobQueue + JobDoneQueue)
 * 4. Thrive print queue logs (for cross-referencing Cut IDs → Work Orders)
 * 
 * Each Zund job gets a unified status:
 *   'active'    — currently being cut (from SQLite ProductionEnd=0 or recent)
 *   'queued'    — waiting to be cut (found in Thrive Cut Center but not in SQLite)
 *   'completed' — finished cutting (ProductionEnd > 0 in SQLite)
 */

import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import path from 'path';
import { XMLParser } from 'fast-xml-parser';
import { THRIVE_CONFIG, parseCutFile, parseJobInfo, type ThriveCutJob } from './thrive.js';
import {
  getAvailableZunds,
  getRecentJobs,
  getCurrentJob,
  getTodayStats,
  getToolWear,
  getZundCutterInfo,
  isZundStatsAccessible,
  type ZundJob,
  type ZundDashboard,
} from './zund-stats.js';
import { normalizeJobName, extractIdentifiers } from './zund-match.js';
import { prisma } from '../db/client.js';
import { TtlCache } from '../lib/ttl-cache.js';

// Cache Zund live data and queue scans to avoid redundant network I/O
const zundLiveCache = new TtlCache<ZundLiveData>(60_000);   // 60s TTL
const queueFileCache = new TtlCache<ZundQueueFile[]>(60_000); // 60s TTL

// ─── Types ─────────────────────────────────────────────

export type ZundLiveJobStatus = 'active' | 'queued' | 'completed';

export interface ZundLiveJob {
  /** Unique ID: prefixed by source (stats-123, cut-abc, zcc-def) */
  id: string;
  /** Job / file name */
  jobName: string;
  /** Which source provided this job */
  source: 'statistics' | 'thrive-cut' | 'zund-queue';
  /** Unified status */
  status: ZundLiveJobStatus;
  /** ISO timestamp when job started (if known) */
  startTime: string | null;
  /** ISO timestamp when job finished (if known) */
  endTime: string | null;
  /** Duration in seconds */
  durationSeconds: number | null;
  /** Copies completed / total */
  copyDone: number;
  copyTotal: number;
  /** Material / media name */
  material: string | null;
  /** Material thickness in mm */
  materialThickness: number | null;
  /** Cut device name */
  device: string | null;
  /** Cut dimensions in mm (from .zcc or .xml) */
  widthMm: number | null;
  heightMm: number | null;
  /** GUID from Thrive/ZCC */
  guid: string | null;
  /** Linked work order (if matched) */
  workOrderNumber: string | null;
  workOrderId: string | null;
  customerName: string | null;
  /** How confident the WO match is */
  matchConfidence: 'exact' | 'partial' | 'possible' | 'nesting' | null;
  /** Whether this is a nesting job (multiple orders) */
  isNesting: boolean;
  /** Which Thrive machine the cut file came from */
  thriveMachine: string | null;
  /** Original filename */
  fileName: string | null;
  /** File last modified date (for queue files) */
  fileModified: string | null;
  /** File size in bytes */
  fileSizeBytes: number | null;
  /** Which printer the cut is associated with */
  printer: string | null;
}

export interface ZundLiveData {
  /** Which Zund machine */
  zundId: string;
  /** Whether the Statistics DB is accessible */
  hasStatsDb: boolean;
  /** Cutter info from Stats DB (if available) */
  cutter: { cutterId: string; name: string; machineTypeId: number } | null;
  /** DB version */
  dbVersion: string | null;
  /** Today's aggregate stats (if Stats DB available) */
  todayStats: ZundDashboard['todayStats'] | null;
  /** Tool wear (if Stats DB available) */
  toolWear: ZundDashboard['toolWear'];
  /** All jobs unified from all sources */
  jobs: ZundLiveJob[];
  /** Summary counts */
  summary: {
    activeCount: number;
    queuedCount: number;
    completedCount: number;
    totalJobs: number;
    linkedCount: number;
    unlinkedCount: number;
  };
  /** Timestamp of this snapshot */
  timestamp: string;
}

// ─── Thrive Cut File Scanner ──────────────────────────

interface ThriveCutFileInfo {
  cutJob: ThriveCutJob;
  machine: string;
  fileName: string;
  fullPath: string;
  size: number;
  modified: Date;
}

/**
 * Scan all Thrive Cut Center folders for pending cut files (.xml, .xml_tmp).
 */
async function scanThriveCutFiles(): Promise<ThriveCutFileInfo[]> {
  const results: ThriveCutFileInfo[] = [];

  for (const machine of THRIVE_CONFIG.machines) {
    if (!machine.cutterPath) continue;
    try {
      const entries = await fs.readdir(machine.cutterPath, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const ext = entry.name.toLowerCase();
        if (!ext.endsWith('.xml') && !ext.endsWith('.xml_tmp')) continue;

        const fullPath = path.join(machine.cutterPath, entry.name);
        try {
          const stat = await fs.stat(fullPath);
          const cutJob = await parseCutFile(fullPath);
          if (cutJob) {
            results.push({
              cutJob,
              machine: machine.name,
              fileName: entry.name,
              fullPath,
              size: stat.size,
              modified: stat.mtime,
            });
          }
        } catch {
          // Skip unparseable files
        }
      }
    } catch (err) {
      console.warn(`[ZundLive] Cannot scan ${machine.name} cutter folder:`, (err as Error).message);
    }
  }

  return results;
}

// ─── File Server Zund Queue Scanner ───────────────────

/**
 * Scans \\wildesigns-fs1\Company Files\Zund for JobQueue (incomplete) and JobDoneQueue (complete).
 * .zcc files are XML with ZCC_cmd root containing Job, Meta, Material elements.
 * .busy files (JSON) alongside .zcc files indicate actively cutting jobs with progress info.
 */

const ZUND_QUEUE_BASE = '\\\\wildesigns-fs1\\Company Files\\Zund';
const ZUND_JOB_QUEUE = path.join(ZUND_QUEUE_BASE, '03 JobQueue');
const ZUND_JOB_DONE_QUEUE = path.join(ZUND_QUEUE_BASE, '04 JobDoneQueue');

const zccParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

interface ZccParsed {
  jobName: string;
  material: string | null;
  materialBrand: string | null;
  creationDate: string | null;
  orderId: string | null;
}

interface BusyInfo {
  copyDone: number;
  copyTotal: number;
  cutterName: string | null;
  hostName: string | null;
  remainingTimeMs: number | null;
  statusTime: string | null;
}

function parseZccXml(content: string): ZccParsed {
  try {
    const parsed = zccParser.parse(content);
    const root = parsed?.ZCC_cmd;
    if (!root) return { jobName: '', material: null, materialBrand: null, creationDate: null, orderId: null };

    const job = root.Job;
    const meta = root.Meta;
    const mat = root.Material;

    return {
      jobName: job?.['@_Name'] || '',
      material: mat?.['@_Name'] || mat?.['@_Description'] || null,
      materialBrand: mat?.['@_Brand'] || null,
      creationDate: meta?.Creation?.['@_Date'] || null,
      orderId: meta?.OrderID || null,
    };
  } catch {
    return { jobName: '', material: null, materialBrand: null, creationDate: null, orderId: null };
  }
}

function parseBusyFile(content: string): BusyInfo {
  try {
    const data = JSON.parse(content);
    return {
      copyDone: data?.copies?.done ?? 0,
      copyTotal: data?.copies?.total ?? 0,
      cutterName: data?.cutterName || null,
      hostName: data?.hostName || null,
      remainingTimeMs: data?.remainingTimeInfo?.remainingTime ?? null,
      statusTime: data?.statusTime || null,
    };
  } catch {
    return { copyDone: 0, copyTotal: 0, cutterName: null, hostName: null, remainingTimeMs: null, statusTime: null };
  }
}

export interface ZundQueueFile {
  fileName: string;
  fullPath: string;
  size: number;
  modified: Date;
  status: ZundLiveJobStatus;
  zccData: ZccParsed;
  busyInfo: BusyInfo | null;
}

/**
 * Scan both JobQueue and JobDoneQueue folders for .zcc files.
 * JobQueue = incomplete/queued, JobDoneQueue = completed.
 * .busy files adjacent to .zcc files indicate actively cutting (status = 'active').
 * Limits scan to most recent files by modified date to avoid scanning 10k+ files.
 */
export async function scanZundQueueFiles(limit = 200): Promise<ZundQueueFile[]> {
  const results: ZundQueueFile[] = [];

  // Scan a queue folder for .zcc files
  async function scanFolder(folderPath: string, defaultStatus: ZundLiveJobStatus, maxFiles: number) {
    try {
      const entries = await fs.readdir(folderPath, { withFileTypes: true });
      const zccEntries: { name: string; stat: Awaited<ReturnType<typeof fs.stat>> }[] = [];
      const busyFileNames = new Set<string>();

      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const lower = entry.name.toLowerCase();
        if (lower.endsWith('.busy')) {
          busyFileNames.add(entry.name);
        }
      }

      // Stat .zcc files only (avoid reading all 11k+ at once)
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.zcc')) continue;
        try {
          const fullPath = path.join(folderPath, entry.name);
          const stat = await fs.stat(fullPath);
          zccEntries.push({ name: entry.name, stat });
        } catch { /* skip inaccessible */ }
      }

      // Sort newest first, limit
      zccEntries.sort((a, b) => b.stat.mtime.getTime() - a.stat.mtime.getTime());
      const limited = zccEntries.slice(0, maxFiles);

      for (const { name, stat } of limited) {
        const fullPath = path.join(folderPath, name);
        
        // Check for .busy file — indicates actively cutting
        const busyFileName = busyFileNames.has(name + '.i.busy') ? name + '.i.busy'
          : busyFileNames.has(name + '.busy') ? name + '.busy'
          : null;
        // Also check pattern: original.zcc.i.busy
        const altBusy = Array.from(busyFileNames).find(bf => bf.startsWith(name));
        const actualBusyFile = busyFileName || altBusy || null;

        let busyInfo: BusyInfo | null = null;
        let status = defaultStatus;

        if (actualBusyFile) {
          try {
            const busyContent = await fs.readFile(path.join(folderPath, actualBusyFile), 'utf-8');
            busyInfo = parseBusyFile(busyContent);
            status = 'active'; // Has .busy file = actively cutting
          } catch { /* ignore */ }
        }

        // Parse .zcc XML for metadata (read only first 4KB for speed)
        let zccData: ZccParsed = { jobName: '', material: null, materialBrand: null, creationDate: null, orderId: null };
        try {
          const fd = await fs.open(fullPath, 'r');
          const buf = Buffer.alloc(4096);
          await fd.read(buf, 0, 4096, 0);
          await fd.close();
          const xmlStr = buf.toString('utf-8').replace(/\0+$/, '');
          zccData = parseZccXml(xmlStr);
        } catch { /* skip unparseable */ }

        results.push({
          fileName: name,
          fullPath,
          size: stat.size,
          modified: stat.mtime,
          status,
          zccData,
          busyInfo,
        });
      }
    } catch (err) {
      console.warn(`[ZundLive] Cannot scan Zund queue folder ${folderPath}:`, (err as Error).message);
    }
  }

  // Scan both folders — allocate more to job queue (active/pending), fewer to done
  await Promise.all([
    scanFolder(ZUND_JOB_QUEUE, 'queued', Math.ceil(limit * 0.6)),
    scanFolder(ZUND_JOB_DONE_QUEUE, 'completed', Math.floor(limit * 0.4)),
  ]);

  return results;
}

// ─── Work Order Matching ──────────────────────────────

const woCache = new Map<string, { id: string; orderNumber: string; customerName: string } | null>();

async function findWorkOrder(orderNumber: string): Promise<{ id: string; orderNumber: string; customerName: string } | null> {
  if (woCache.has(orderNumber)) return woCache.get(orderNumber)!;

  const where: any = {};
  if (orderNumber.length === 4) {
    where.OR = [
      { orderNumber },
      { orderNumber: `WO${orderNumber}` },
      { orderNumber: { endsWith: orderNumber } },
    ];
  } else {
    where.OR = [
      { orderNumber },
      { orderNumber: `WO${orderNumber}` },
      { orderNumber: { contains: orderNumber } },
    ];
  }

  const found = await prisma.workOrder.findFirst({
    where,
    select: { id: true, orderNumber: true, customerName: true },
    orderBy: { createdAt: 'desc' },
  });

  const result = found ? { id: found.id, orderNumber: found.orderNumber, customerName: found.customerName || '' } : null;
  woCache.set(orderNumber, result);
  return result;
}

// ─── Main Aggregator ──────────────────────────────────

/**
 * Get comprehensive live data for a Zund machine.
 * 
 * For Zund 2: SQLite stats + Thrive cuts + Zund queue files
 * For Zund 1: Thrive cuts + Zund queue files (no Stats DB available)
 */
export async function getZundLiveData(
  zundId: string,
  options: { recentJobLimit?: number; zccLimit?: number; daysBack?: number } = {}
): Promise<ZundLiveData> {
  // Check TTL cache first
  const cacheKey = `${zundId}-${JSON.stringify(options)}`;
  const cached = zundLiveCache.get(cacheKey);
  if (cached) return cached;

  const { recentJobLimit = 50, zccLimit = 50 } = options;
  const hasStatsDb = getAvailableZunds().includes(zundId) && isZundStatsAccessible(zundId);

  let cutter = null;
  let dbVersion: string | null = null;
  let todayStats = null;
  let toolWear: ZundDashboard['toolWear'] = [];

  // ── Run all 3 sources in parallel ──
  // Each source returns its own job array; we merge/dedup after
  type SourceResult = { jobs: ZundLiveJob[]; normalizedNames: Map<string, true> };

  const [source1Result, source2Result, source3Result] = await Promise.allSettled([
    // Source 1: Statistics DB
    (async (): Promise<SourceResult> => {
      const srcJobs: ZundLiveJob[] = [];
      const srcNames = new Map<string, true>();
      if (!hasStatsDb) return { jobs: srcJobs, normalizedNames: srcNames };

      cutter = getZundCutterInfo(zundId);
      todayStats = getTodayStats(zundId);
      toolWear = getToolWear(zundId);

      // Get DB version
      const { default: Database } = await import('better-sqlite3');
      const localPath = path.join(
        (await import('os')).tmpdir(),
        'erp-zund-stats',
        `${zundId}_stats.db3`
      );
      if (fsSync.existsSync(localPath)) {
        const db = new Database(localPath, { readonly: true });
        try {
          const rows = db.prepare("SELECT Name, Value FROM DBInfo WHERE Name IN ('MajorVersion','MinorVersion','BugFixVersion') ORDER BY Name").all() as any[];
          const v: Record<string, number> = {};
          rows.forEach((r: any) => v[r.Name] = r.Value);
          dbVersion = `${v.MajorVersion || 0}.${v.MinorVersion || 0}.${v.BugFixVersion || 0}`;
        } finally {
          db.close();
        }
      }

      const statsJobs = getRecentJobs(zundId, recentJobLimit);

      for (const sj of statsJobs) {
        const info = extractIdentifiers(sj.jobName);
        const normalized = normalizeJobName(sj.jobName);
        srcNames.set(normalized, true);

        const jobInfo = parseJobInfo(sj.jobName);
        let wo: { id: string; orderNumber: string; customerName: string } | null = null;
        let matchConfidence: ZundLiveJob['matchConfidence'] = null;

        if (jobInfo.workOrderNumber) {
          wo = await findWorkOrder(jobInfo.workOrderNumber);
          if (wo) matchConfidence = 'exact';
        }

        let status: ZundLiveJobStatus = 'completed';
        if (sj.isActive) {
          status = 'active';
        } else if (sj.productionEnd === null) {
          status = 'queued';
        }

        srcJobs.push({
          id: `stats-${sj.jobId}`,
          jobName: sj.jobName,
          source: 'statistics',
          status,
          startTime: sj.productionStart,
          endTime: sj.productionEnd,
          durationSeconds: sj.durationSeconds,
          copyDone: sj.copyDone,
          copyTotal: sj.copyTotal,
          material: sj.material,
          materialThickness: sj.materialThickness,
          device: sj.cutter,
          widthMm: null,
          heightMm: null,
          guid: null,
          workOrderNumber: wo?.orderNumber ?? null,
          workOrderId: wo?.id ?? null,
          customerName: wo?.customerName ?? null,
          matchConfidence,
          isNesting: info.isNesting,
          thriveMachine: null,
          fileName: null,
          fileModified: null,
          fileSizeBytes: null,
          printer: null,
        });
      }
      return { jobs: srcJobs, normalizedNames: srcNames };
    })(),

    // Source 2: Thrive Cut Center
    (async (): Promise<SourceResult> => {
      const srcJobs: ZundLiveJob[] = [];
      const srcNames = new Map<string, true>();
      const cutFiles = await scanThriveCutFiles();
      for (const cf of cutFiles) {
        const normalized = normalizeJobName(cf.cutJob.jobName || cf.fileName);
        srcNames.set(normalized, true);

        let wo: { id: string; orderNumber: string; customerName: string } | null = null;
        let matchConfidence: ZundLiveJob['matchConfidence'] = null;
        if (cf.cutJob.workOrderNumber) {
          wo = await findWorkOrder(cf.cutJob.workOrderNumber);
          if (wo) matchConfidence = 'exact';
        }

        srcJobs.push({
          id: `cut-${cf.fileName}`,
          jobName: cf.cutJob.jobName || cf.fileName,
          source: 'thrive-cut',
          status: 'queued',
          startTime: null,
          endTime: null,
          durationSeconds: null,
          copyDone: 0,
          copyTotal: 1,
          material: cf.cutJob.media || null,
          materialThickness: null,
          device: cf.cutJob.device || null,
          widthMm: cf.cutJob.width || null,
          heightMm: cf.cutJob.height || null,
          guid: cf.cutJob.guid || null,
          workOrderNumber: wo?.orderNumber ?? cf.cutJob.workOrderNumber ?? null,
          workOrderId: wo?.id ?? null,
          customerName: wo?.customerName ?? cf.cutJob.customerName ?? null,
          matchConfidence,
          isNesting: /nesting/i.test(cf.cutJob.jobName || ''),
          thriveMachine: cf.machine,
          fileName: cf.fileName,
          fileModified: cf.modified.toISOString(),
          fileSizeBytes: cf.size,
          printer: cf.cutJob.printer || null,
        });
      }
      return { jobs: srcJobs, normalizedNames: srcNames };
    })(),

    // Source 3: File Server Zund Queue
    (async (): Promise<SourceResult> => {
      const srcJobs: ZundLiveJob[] = [];
      const srcNames = new Map<string, true>();
      const queueFiles = await queueFileCache.getOrFetch(
        `queue-${zccLimit * 2}`,
        () => scanZundQueueFiles(zccLimit * 2),
      );
      for (const qf of queueFiles) {
        const jobName = qf.zccData.jobName || qf.fileName.replace(/\.zcc$/i, '');
        const normalized = normalizeJobName(jobName);
        srcNames.set(normalized, true);

        const jobInfo = parseJobInfo(jobName);
        let wo: { id: string; orderNumber: string; customerName: string } | null = null;
        let matchConfidence: ZundLiveJob['matchConfidence'] = null;
        const woNumber = jobInfo.workOrderNumber || qf.zccData.orderId || null;
        if (woNumber) {
          wo = await findWorkOrder(woNumber);
          if (wo) matchConfidence = 'exact';
        }

        let device: string | null = null;
        if (qf.busyInfo?.hostName) {
          device = qf.busyInfo.hostName;
        } else if (qf.busyInfo?.cutterName) {
          device = qf.busyInfo.cutterName;
        }

        srcJobs.push({
          id: `zq-${qf.fileName}`,
          jobName,
          source: 'zund-queue',
          status: qf.status,
          startTime: qf.busyInfo?.statusTime || qf.zccData.creationDate || null,
          endTime: qf.status === 'completed' ? qf.modified.toISOString() : null,
          durationSeconds: null,
          copyDone: qf.busyInfo?.copyDone ?? (qf.status === 'completed' ? 1 : 0),
          copyTotal: qf.busyInfo?.copyTotal ?? 1,
          material: qf.zccData.material,
          materialThickness: null,
          device,
          widthMm: null,
          heightMm: null,
          guid: null,
          workOrderNumber: wo?.orderNumber ?? null,
          workOrderId: wo?.id ?? null,
          customerName: wo?.customerName ?? jobInfo.customerName ?? null,
          matchConfidence,
          isNesting: /nesting/i.test(jobName),
          thriveMachine: null,
          fileName: qf.fileName,
          fileModified: qf.modified.toISOString(),
          fileSizeBytes: qf.size,
          printer: null,
        });
      }
      return { jobs: srcJobs, normalizedNames: srcNames };
    })(),
  ]);

  // ── Merge results with deduplication (priority: stats > cut > queue) ──
  const jobs: ZundLiveJob[] = [];
  const seenJobNames = new Set<string>();

  const sourceResults = [source1Result, source2Result, source3Result];
  for (const sr of sourceResults) {
    if (sr.status !== 'fulfilled') continue;
    for (const job of sr.value.jobs) {
      const normalized = normalizeJobName(job.jobName);
      if (seenJobNames.has(normalized)) continue;
      seenJobNames.add(normalized);
      jobs.push(job);
    }
  }

  // ── Cross-reference unlinked jobs with Thrive print logs ──
  // For jobs without a WO match, try to find the Cut ID (GUID) in Thrive print job names
  try {
    const unlinked = jobs.filter(j => !j.workOrderNumber && j.jobName);
    if (unlinked.length > 0) {
      const { thriveService } = await import('./thrive.js');
      const { printJobs } = await thriveService.getAllJobs();
      const linkedPrint = await thriveService.linkJobsToWorkOrders(printJobs);

      // Build a map of normalized print job names to WO info
      const printJobMap = new Map<string, { wo: string; woId?: string; customer?: string }>();
      for (const { job, workOrder } of linkedPrint) {
        if (workOrder && job.workOrderNumber) {
          const norm = normalizeJobName(job.jobName);
          printJobMap.set(norm, {
            wo: workOrder.orderNumber,
            woId: workOrder.id,
            customer: workOrder.customerName,
          });
          // Also index by GUID if available
          if (job.jobGuid) {
            printJobMap.set(job.jobGuid.toLowerCase(), {
              wo: workOrder.orderNumber,
              woId: workOrder.id,
              customer: workOrder.customerName,
            });
          }
        }
      }

      // Try to match unlinked jobs
      for (const uj of unlinked) {
        const norm = normalizeJobName(uj.jobName);

        // 1. Direct normalized name match
        const directMatch = printJobMap.get(norm);
        if (directMatch) {
          uj.workOrderNumber = directMatch.wo;
          uj.workOrderId = directMatch.woId ?? null;
          uj.customerName = directMatch.customer ?? null;
          uj.matchConfidence = 'partial';
          continue;
        }

        // 2. Check if any print job name contains the Zund job name or vice versa
        for (const [printNorm, info] of printJobMap) {
          if (printNorm.length < 5) continue; // Skip very short names
          if (norm.includes(printNorm) || printNorm.includes(norm)) {
            uj.workOrderNumber = info.wo;
            uj.workOrderId = info.woId ?? null;
            uj.customerName = info.customer ?? null;
            uj.matchConfidence = 'partial';
            break;
          }
        }

        // 3. If GUID available, try GUID match
        if (!uj.workOrderNumber && uj.guid) {
          const guidMatch = printJobMap.get(uj.guid.toLowerCase());
          if (guidMatch) {
            uj.workOrderNumber = guidMatch.wo;
            uj.workOrderId = guidMatch.woId ?? null;
            uj.customerName = guidMatch.customer ?? null;
            uj.matchConfidence = 'partial';
          }
        }
      }
    }
  } catch (err) {
    console.warn('[ZundLive] Cross-ref error:', (err as Error).message);
  }

  // ── Build summary ──
  const activeCount = jobs.filter(j => j.status === 'active').length;
  const queuedCount = jobs.filter(j => j.status === 'queued').length;
  const completedCount = jobs.filter(j => j.status === 'completed').length;
  const linkedCount = jobs.filter(j => j.workOrderNumber).length;
  const unlinkedCount = jobs.filter(j => !j.workOrderNumber).length;

  // Clear WO cache after each request to keep it fresh
  woCache.clear();

  const result: ZundLiveData = {
    zundId,
    hasStatsDb,
    cutter,
    dbVersion,
    todayStats,
    toolWear,
    jobs,
    summary: {
      activeCount,
      queuedCount,
      completedCount,
      totalJobs: jobs.length,
      linkedCount,
      unlinkedCount,
    },
    timestamp: new Date().toISOString(),
  };

  // Store in cache
  zundLiveCache.set(cacheKey, result);

  return result;
}
