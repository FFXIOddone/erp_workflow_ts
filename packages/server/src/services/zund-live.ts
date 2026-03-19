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
import { normalizeJobName, extractIdentifiers, extractCutId } from './zund-match.js';
import { prisma } from '../db/client.js';
import { TtlCache } from '../lib/ttl-cache.js';

// Cache Zund live data and queue scans to avoid redundant network I/O
const zundLiveCache = new TtlCache<ZundLiveData>(60_000);   // 60s TTL
const queueFileCache = new TtlCache<ZundQueueFile[]>(60_000); // 60s TTL

/** Race a promise against a timeout. Rejects with TimeoutError on expiry. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout: ${label} (${ms}ms)`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

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
 * Machines are scanned in parallel with a 3s timeout per machine.
 */
async function scanThriveCutFiles(): Promise<ThriveCutFileInfo[]> {
  const machineResults = await Promise.allSettled(
    THRIVE_CONFIG.machines
      .filter(m => m.cutterPath)
      .map(machine => withTimeout((async () => {
        const results: ThriveCutFileInfo[] = [];
        const entries = await fs.readdir(machine.cutterPath!, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isFile()) continue;
          const ext = entry.name.toLowerCase();
          if (!ext.endsWith('.xml') && !ext.endsWith('.xml_tmp')) continue;

          const fullPath = path.join(machine.cutterPath!, entry.name);
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
        return results;
      })(), 5000, `scanThriveCut-${machine.name}`))
  );

  const results: ThriveCutFileInfo[] = [];
  for (const mr of machineResults) {
    if (mr.status === 'fulfilled') {
      results.push(...mr.value);
    } else {
      console.warn(`[ZundLive] Thrive cut scan failed:`, (mr as PromiseRejectedResult).reason?.message);
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

      // Collect .zcc file names first (no stat yet)
      const zccNames: string[] = [];
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.zcc')) continue;
        zccNames.push(entry.name);
      }

      // Stat files in parallel batches of 20 to avoid thread pool exhaustion
      const BATCH_SIZE = 20;
      for (let i = 0; i < zccNames.length; i += BATCH_SIZE) {
        const batch = zccNames.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.allSettled(
          batch.map(async (name) => {
            const fullPath = path.join(folderPath, name);
            const stat = await fs.stat(fullPath);
            return { name, stat };
          })
        );
        for (const br of batchResults) {
          if (br.status === 'fulfilled') zccEntries.push(br.value);
        }
        // Early exit: if we already have enough files and all we need is the newest,
        // stop statting more (DoneQueue has thousands of old files)
        if (zccEntries.length >= maxFiles * 3) break;
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
          size: Number(stat.size),
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
  // Each folder scan has a 10s timeout to avoid hanging on unreachable shares
  await Promise.all([
    withTimeout(scanFolder(ZUND_JOB_QUEUE, 'queued', Math.ceil(limit * 0.6)), 10_000, 'scanZundJobQueue')
      .catch(err => console.warn('[ZundLive] JobQueue scan failed:', err.message)),
    withTimeout(scanFolder(ZUND_JOB_DONE_QUEUE, 'completed', Math.floor(limit * 0.4)), 10_000, 'scanZundDoneQueue')
      .catch(err => console.warn('[ZundLive] DoneQueue scan failed:', err.message)),
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
  // Check TTL cache first (fresh data)
  const cacheKey = `${zundId}-${JSON.stringify(options)}`;
  const cached = zundLiveCache.get(cacheKey);
  if (cached) return cached;

  // Stale-while-revalidate: return stale immediately, refresh in background
  const stale = zundLiveCache.getStale(cacheKey);
  if (stale) {
    // Fire-and-forget refresh
    fetchZundLiveData(zundId, options, cacheKey).catch(
      err => console.warn('[ZundLive] Background refresh failed:', err.message)
    );
    return stale;
  }

  // First call ever — must fetch blocking
  return fetchZundLiveData(zundId, options, cacheKey);
}

/** Internal implementation that does the actual data fetching. */
async function fetchZundLiveData(
  zundId: string,
  options: { recentJobLimit?: number; zccLimit?: number; daysBack?: number },
  cacheKey: string,
): Promise<ZundLiveData> {

  const { recentJobLimit = 50, zccLimit = 50 } = options;
  // NOTE: isZundStatsAccessible moved inside Source 1 so it runs in parallel with Sources 2 & 3

  let hasStatsDb = false;
  let cutter = null;
  let dbVersion: string | null = null;
  let todayStats = null;
  let toolWear: ZundDashboard['toolWear'] = [];

  // ── Run all 3 sources in parallel ──
  // Each source returns its own job array; we merge/dedup after
  type SourceResult = { jobs: ZundLiveJob[]; normalizedNames: Map<string, true> };

  const [source1Result, source2Result, source3Result] = await Promise.allSettled([
    // Source 1: Statistics DB (5s timeout — includes access check)
    withTimeout((async (): Promise<SourceResult> => {
      const srcJobs: ZundLiveJob[] = [];
      const srcNames = new Map<string, true>();
      // Check accessibility inside parallel block to avoid blocking Sources 2 & 3
      const statsAccessible = getAvailableZunds().includes(zundId) && await isZundStatsAccessible(zundId);
      if (!statsAccessible) return { jobs: srcJobs, normalizedNames: srcNames };
      hasStatsDb = true;

      cutter = await getZundCutterInfo(zundId);
      todayStats = await getTodayStats(zundId);
      toolWear = await getToolWear(zundId);

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

      const statsJobs = await getRecentJobs(zundId, recentJobLimit);

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
    })(), 15_000, 'Source1-StatsDB'),

    // Source 2: Thrive Cut Center (5s timeout)
    withTimeout((async (): Promise<SourceResult> => {
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
    })(), 15_000, 'Source2-ThriveCut'),

    // Source 3: File Server Zund Queue (5s timeout)
    withTimeout((async (): Promise<SourceResult> => {
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
    })(), 15_000, 'Source3-ZundQueue'),
  ]);

  // ── Merge results with deduplication (priority: stats > cut > queue) ──
  const jobs: ZundLiveJob[] = [];
  const seenJobNames = new Set<string>();

  const sourceResults = [source1Result, source2Result, source3Result];
  const sourceLabels = ['StatsDB', 'ThriveCut', 'ZundQueue'];
  for (let i = 0; i < sourceResults.length; i++) {
    const sr = sourceResults[i];
    if (sr.status !== 'fulfilled') {
      console.warn(`[ZundLive] ${sourceLabels[i]} source failed:`, (sr as PromiseRejectedResult).reason?.message || sr);
      continue;
    }
    for (const job of sr.value.jobs) {
      const normalized = normalizeJobName(job.jobName);
      if (seenJobNames.has(normalized)) continue;
      seenJobNames.add(normalized);
      jobs.push(job);
    }
  }

  // ── Cross-reference unlinked jobs with Thrive print logs (3s total timeout) ──
  // For jobs without a WO match, try to find the Cut ID (GUID) in Thrive print job names
  try {
    const unlinked = jobs.filter(j => !j.workOrderNumber && j.jobName);
    if (unlinked.length > 0) {
      await withTimeout((async () => {
      const { thriveService } = await import('./thrive.js');
      const { printJobs } = await thriveService.getAllJobs();
      const linkedPrint = await thriveService.linkJobsToWorkOrders(printJobs);

      // Build maps: normalized name → WO, CutID → WO, GUID → WO
      type WoInfo = { wo: string; woId?: string; customer?: string };
      const printJobMap = new Map<string, WoInfo>();
      const cutIdMap = new Map<string, WoInfo>();
      const guidMap = new Map<string, WoInfo>();
      for (const { job, workOrder } of linkedPrint) {
        if (workOrder && job.workOrderNumber) {
          const info: WoInfo = {
            wo: workOrder.orderNumber,
            woId: workOrder.id,
            customer: workOrder.customerName,
          };
          const norm = normalizeJobName(job.jobName);
          printJobMap.set(norm, info);
          // Index by CutID (strongest signal — same ID on print and cut sides)
          const cutId = extractCutId(job.jobName);
          if (cutId) cutIdMap.set(cutId.toLowerCase(), info);
          // Index by GUID if available
          if (job.jobGuid) guidMap.set(job.jobGuid.toLowerCase(), info);
        }
      }

      // Try to match unlinked jobs
      for (const uj of unlinked) {
        // 1. CutID match (highest confidence — shared between print and cut file names)
        const ujCutId = extractCutId(uj.jobName);
        if (ujCutId) {
          const cutIdMatch = cutIdMap.get(ujCutId.toLowerCase());
          if (cutIdMatch) {
            uj.workOrderNumber = cutIdMatch.wo;
            uj.workOrderId = cutIdMatch.woId ?? null;
            uj.customerName = cutIdMatch.customer ?? null;
            uj.matchConfidence = 'exact';
            continue;
          }
        }

        const norm = normalizeJobName(uj.jobName);

        // 2. Direct normalized name match
        const directMatch = printJobMap.get(norm);
        if (directMatch) {
          uj.workOrderNumber = directMatch.wo;
          uj.workOrderId = directMatch.woId ?? null;
          uj.customerName = directMatch.customer ?? null;
          uj.matchConfidence = 'partial';
          continue;
        }

        // 3. Check if any print job name contains the Zund job name or vice versa
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

        // 4. If GUID available, try GUID match
        if (!uj.workOrderNumber && uj.guid) {
          const guidMatch = guidMap.get(uj.guid.toLowerCase());
          if (guidMatch) {
            uj.workOrderNumber = guidMatch.wo;
            uj.workOrderId = guidMatch.woId ?? null;
            uj.customerName = guidMatch.customer ?? null;
            uj.matchConfidence = 'partial';
          }
        }
      }
      })(), 8000, 'cross-ref-all');
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

// ─── Background Cache Warmer ──────────────────────────

let warmerInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start a background interval that pre-warms the Zund live data cache.
 * This ensures the first user request always hits warm cache.
 * Call once at server startup.
 */
export function startZundLiveCacheWarmer(intervalMs = 45_000): void {
  if (warmerInterval) return; // Already running

  // Warm immediately on start
  fetchZundLiveData('zund2', {}, 'zund2-{}').catch(
    err => console.warn('[ZundLive] Initial cache warm failed:', err.message)
  );

  warmerInterval = setInterval(() => {
    fetchZundLiveData('zund2', {}, 'zund2-{}').catch(
      err => console.warn('[ZundLive] Cache warmer failed:', err.message)
    );
  }, intervalMs);

  // Don't block process exit
  if (warmerInterval?.unref) warmerInterval.unref();
  console.log(`[ZundLive] Cache warmer started (${intervalMs}ms interval)`);
}

export function stopZundLiveCacheWarmer(): void {
  if (warmerInterval) {
    clearInterval(warmerInterval);
    warmerInterval = null;
  }
}
