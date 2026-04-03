/**
 * Zund Cutter Statistics Service
 * 
 * Reads production statistics from Zund Cut Center's SQLite database
 * exposed via SMB share on both Zund PCs (\\<ip>\Statistics\Statistic.db3).
 * 
 * Data includes:
 * - Cutting job history (name, start/end, copies, material)
 * - Production time breakdowns (setup, cutting, interrupts)
 * - Knife/bit usage and wear tracking
 * - Cutter machine info (G3 M-2500)
 */

import type BetterSqlite3 from 'better-sqlite3';
import fs from 'fs';
import { promises as fsP } from 'fs';
import path from 'path';
import os from 'os';
import { loadBetterSqlite3, requireBetterSqlite3 } from '../lib/better-sqlite3.js';

// ============ Types ============

export interface ZundJob {
  jobId: number;
  jobName: string;
  productionStart: string;   // ISO date
  productionEnd: string | null;
  copyDone: number;
  copyTotal: number;
  material: string;
  materialThickness: number;
  cutter: string;
  durationSeconds: number;
  isActive: boolean;
}

export interface ZundProductionTime {
  timeId: number;
  jobId: number;
  methodName: string;     // "Thru-cut", "Kiss-cut", "Setup", "Interrupt", "Transport"
  totalTimeMs: number;
  tool: string | null;    // "UCT", "EOT", etc.
  toolInsert: string | null; // "Z46", "Z10", etc.
  lengthDownMm: number;
  lengthUpMm: number;
  upDowns: number;
  beam: number;
}

export interface ZundToolUsage {
  insertId: number;
  toolId: number;
  cutter: string;
  runningMeters: number;
  maxRunningMeters: number;
  materialName: string;
  materialThickness: number;
  lastUsed: string;        // ISO date
  wearPercent: number;     // 0-100
}

export interface ZundCutterInfo {
  cutterId: string;
  name: string;
  machineTypeId: number;
}

export interface ZundDashboard {
  cutter: ZundCutterInfo;
  currentJob: ZundJob | null;
  recentJobs: ZundJob[];
  todayStats: {
    jobCount: number;
    totalCuttingTimeMinutes: number;
    totalSetupTimeMinutes: number;
    totalIdleTimeMinutes: number;
    totalCopiesCut: number;
    totalLengthCutMeters: number;
  };
  toolWear: ZundToolUsage[];
  dbVersion: string;
}

// ============ Config ============

// Zund statistics share paths (both machines have Statistic.db3 via SMB)
const ZUND_STATS_PATHS: Record<string, string> = {
  'zund1': '\\\\192.168.254.38\\Statistics\\Statistic.db3',
  'zund2': '\\\\192.168.254.28\\Statistics\\Statistic.db3',
};

// Local temp copy path (we copy the DB to avoid locking issues over SMB)
const LOCAL_CACHE_DIR = path.join(os.tmpdir(), 'erp-zund-stats');

// How often to re-copy the DB from SMB (in ms)
const REFRESH_INTERVAL_MS = 30000; // 30 seconds

// Last refresh timestamps
const lastRefresh: Record<string, number> = {};
const refreshInFlight: Record<string, Promise<string> | undefined> = {};
const refreshCooldownUntil: Record<string, number> = {};
const REFRESH_BUSY_COOLDOWN_MS = 45_000;
const REFRESH_GENERIC_COOLDOWN_MS = 5_000;
type BetterSqliteDatabase = InstanceType<typeof BetterSqlite3>;

// ============ Helpers ============

function epochToIso(epoch: number): string {
  return new Date(epoch * 1000).toISOString();
}

function ensureCacheDir(): void {
  if (!fs.existsSync(LOCAL_CACHE_DIR)) {
    fs.mkdirSync(LOCAL_CACHE_DIR, { recursive: true });
  }
}

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

/**
 * Copy the Zund stats DB from the SMB share to a local temp file.
 * This avoids lock contention with ZCC writing to the DB.
 * Now async with a 3-second timeout to avoid blocking when SMB is unreachable.
 */
async function refreshLocalCopy(zundId: string): Promise<string> {
  const remotePath = ZUND_STATS_PATHS[zundId];
  if (!remotePath) {
    throw new Error(`Unknown Zund ID: ${zundId}. Available: ${Object.keys(ZUND_STATS_PATHS).join(', ')}`);
  }

  ensureCacheDir();
  const localPath = path.join(LOCAL_CACHE_DIR, `${zundId}_stats.db3`);

  const now = Date.now();
  const localExists = fs.existsSync(localPath);
  const cooldownUntil = refreshCooldownUntil[zundId] || 0;

  if (localExists && now < cooldownUntil) {
    return localPath;
  }

  const lastTime = lastRefresh[zundId] || 0;
  const needsRefresh = !localExists || now - lastTime > REFRESH_INTERVAL_MS;
  if (!needsRefresh) {
    return localPath;
  }

  const inflight = refreshInFlight[zundId];
  if (inflight) {
    return inflight;
  }

  const refreshPromise = (async () => {
    try {
      await withTimeout(fsP.copyFile(remotePath, localPath), 3000, `copyFile ${zundId}`);
      lastRefresh[zundId] = Date.now();
      delete refreshCooldownUntil[zundId];
      return localPath;
    } catch (err: any) {
      const message = err?.message ?? String(err);
      if (fs.existsSync(localPath)) {
        const cooldownMs = message.includes('Timeout: copyFile') || isBusyLikeError(err)
          ? REFRESH_BUSY_COOLDOWN_MS
          : REFRESH_GENERIC_COOLDOWN_MS;
        refreshCooldownUntil[zundId] = Date.now() + cooldownMs;
        console.warn(`[Zund] Failed to refresh ${zundId} stats, using cached copy: ${message}`);
        return localPath;
      }
      throw new Error(`Cannot access Zund stats at ${remotePath}: ${message}`);
    } finally {
      delete refreshInFlight[zundId];
    }
  })();

  refreshInFlight[zundId] = refreshPromise;
  return refreshPromise;
}

async function openDb(zundId: string): Promise<BetterSqliteDatabase> {
  const Database = await requireBetterSqlite3('Zund');
  const localPath = await refreshLocalCopy(zundId);
  // Ensure material name map is loaded (no-op after first load, refreshes every 24h)
  loadMaterialMap().catch(err => console.warn('[Zund] Material map load error:', err.message));
  return new Database(localPath, { readonly: true });
}

// ============ Material GUID to Name Mapping ============

// Paths to Material.db3 on each Zund's "Zund Cut Center" share
const ZUND_MATERIAL_PATHS: Record<string, string> = {
  'zund1': '\\\\192.168.254.38\\Zund Cut Center\\Material.db3',
  'zund2': '\\\\192.168.254.28\\Zund Cut Center\\Material.db3',
};

// Merged GUID→Name map from all Zund Material.db3 files (loaded on first use, refreshed every 24h)
let materialNameMap: Record<string, string> = {};
let materialMapLoadedAt = 0;
const MATERIAL_MAP_TTL_MS = 86_400_000; // 24h
let materialMapLoadPromise: Promise<void> | null = null;

function isBusyLikeError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return message.includes('EBUSY') || message.includes('EPERM') || message.includes('resource busy or locked');
}

async function safeReplaceFromRemote(remotePath: string, localPath: string, timeoutMs: number, label: string): Promise<void> {
  const tempPath = `${localPath}.${process.pid}.${Date.now()}.tmp`;
  try {
    await withTimeout(fsP.copyFile(remotePath, tempPath), timeoutMs, label);
    await fsP.rename(tempPath, localPath);
  } catch (err) {
    try {
      if (fs.existsSync(tempPath)) {
        await fsP.unlink(tempPath);
      }
    } catch {
      // best effort cleanup
    }
    throw err;
  }
}

export async function loadMaterialMap(): Promise<void> {
  if (materialMapLoadPromise) return materialMapLoadPromise;

  materialMapLoadPromise = (async () => {
  const now = Date.now();
  if (now - materialMapLoadedAt < MATERIAL_MAP_TTL_MS && Object.keys(materialNameMap).length > 0) return;

  const Database = await loadBetterSqlite3('Zund');
  if (!Database) return;

  const newMap: Record<string, string> = {};
  ensureCacheDir();

  for (const [zundId, remotePath] of Object.entries(ZUND_MATERIAL_PATHS)) {
    const localPath = path.join(LOCAL_CACHE_DIR, `${zundId}_material.db3`);
    try {
      await safeReplaceFromRemote(remotePath, localPath, 5000, `copyMaterial ${zundId}`);
    } catch (err: any) {
      if (!fs.existsSync(localPath)) {
        console.warn(`[Zund] Cannot load Material.db3 for ${zundId}: ${err.message}`);
        continue;
      }
      const severity = isBusyLikeError(err) ? 'log' : 'warn';
      console[severity](`[Zund] Using cached Material.db3 for ${zundId}: ${err.message}`);
    }

    try {
      const db = new Database(localPath, { readonly: true });
      const rows = db.prepare('SELECT GUID, Name FROM Material WHERE Hidden = 0').all() as { GUID: string; Name: string }[];
      for (const row of rows) {
        // Normalize GUID to lowercase for case-insensitive lookup
        newMap[row.GUID.toLowerCase()] = row.Name;
      }
      db.close();
    } catch (err: any) {
      console.warn(`[Zund] Failed to read Material.db3 for ${zundId}: ${err.message}`);
    }
  }

  if (Object.keys(newMap).length > 0) {
    materialNameMap = newMap;
    materialMapLoadedAt = now;
    console.log(`[Zund] Loaded ${Object.keys(newMap).length} material names from Material.db3`);
  }
  })();

  try {
    await materialMapLoadPromise;
  } finally {
    materialMapLoadPromise = null;
  }
}

function getMaterialName(guid: string): string {
  if (!guid || !guid.startsWith('{')) return guid;
  return materialNameMap[guid.toLowerCase()] || guid;
}

function readCutterInfoFromDb(db: BetterSqliteDatabase): ZundCutterInfo {
  const row = db.prepare('SELECT Cutter, Name, MachineTypeID FROM CutterNames LIMIT 1').get() as any;
  return {
    cutterId: row?.Cutter || 'unknown',
    name: row?.Name || 'Unknown Zund',
    machineTypeId: row?.MachineTypeID || 0,
  };
}

function readCurrentJobFromDb(db: BetterSqliteDatabase): ZundJob | null {
  const row = db.prepare(`
    SELECT * FROM ProductionTimeJob
    ORDER BY ProductionStart DESC
    LIMIT 1
  `).get() as any;

  if (!row) return null;

  const now = Math.floor(Date.now() / 1000);
  const endTime = row.ProductionEnd || 0;
  const isActive = endTime === 0 || (now - endTime < 120);

  return {
    jobId: row.JobID,
    jobName: row.JobName,
    productionStart: epochToIso(row.ProductionStart),
    productionEnd: row.ProductionEnd ? epochToIso(row.ProductionEnd) : null,
    copyDone: row.CopyDone,
    copyTotal: row.CopyTotal,
    material: getMaterialName(row.Material),
    materialThickness: row.MaterialThickness,
    cutter: row.Cutter,
    durationSeconds: row.ProductionEnd
      ? row.ProductionEnd - row.ProductionStart
      : now - row.ProductionStart,
    isActive,
  };
}

function readRecentJobsFromDb(db: BetterSqliteDatabase, limit: number = 20): ZundJob[] {
  const rows = db.prepare(`
    SELECT * FROM ProductionTimeJob
    WHERE IsDemoJob = 0
    ORDER BY ProductionStart DESC
    LIMIT ?
  `).all(limit) as any[];

  const now = Math.floor(Date.now() / 1000);
  return rows.map(row => ({
    jobId: row.JobID,
    jobName: row.JobName,
    productionStart: epochToIso(row.ProductionStart),
    productionEnd: row.ProductionEnd ? epochToIso(row.ProductionEnd) : null,
    copyDone: row.CopyDone,
    copyTotal: row.CopyTotal,
    material: getMaterialName(row.Material),
    materialThickness: row.MaterialThickness,
    cutter: row.Cutter,
    durationSeconds: row.ProductionEnd
      ? row.ProductionEnd - row.ProductionStart
      : now - row.ProductionStart,
    isActive: !row.ProductionEnd || (now - row.ProductionEnd < 120),
  }));
}

function readTodayStatsFromDb(db: BetterSqliteDatabase): ZundDashboard['todayStats'] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayEpoch = Math.floor(today.getTime() / 1000);

  const jobs = db.prepare(`
    SELECT COUNT(*) as cnt, COALESCE(SUM(CopyDone), 0) as copies
    FROM ProductionTimeJob
    WHERE ProductionStart >= ? AND IsDemoJob = 0
  `).get(todayEpoch) as any;

  const times = db.prepare(`
    SELECT
      pt.MethodName,
      COALESCE(SUM(pt.TotalTime), 0) as totalMs,
      COALESCE(SUM(pt.LengthDown), 0) as lengthMm
    FROM ProductionTimes pt
    JOIN ProductionTimeJob pj ON pt.JobID = pj.JobID
    WHERE pj.ProductionStart >= ? AND pj.IsDemoJob = 0
    GROUP BY pt.MethodName
  `).all(todayEpoch) as any[];

  let cuttingTimeMs = 0;
  let setupTimeMs = 0;
  let idleTimeMs = 0;
  let totalLengthMm = 0;

  for (const t of times) {
    const name = (t.MethodName || '').toLowerCase();
    if (name.includes('cut') || name.includes('crease') || name.includes('route') || name.includes('draw')) {
      cuttingTimeMs += t.totalMs;
      totalLengthMm += t.lengthMm;
    } else if (name === 'setup' || name === 'transport') {
      setupTimeMs += t.totalMs;
    } else if (name === 'interrupt') {
      idleTimeMs += t.totalMs;
    }
  }

  return {
    jobCount: jobs.cnt,
    totalCuttingTimeMinutes: Math.round(cuttingTimeMs / 60000),
    totalSetupTimeMinutes: Math.round(setupTimeMs / 60000),
    totalIdleTimeMinutes: Math.round(idleTimeMs / 60000),
    totalCopiesCut: jobs.copies,
    totalLengthCutMeters: Math.round(totalLengthMm / 1000),
  };
}

function readToolWearFromDb(db: BetterSqliteDatabase): ZundToolUsage[] {
  const rows = db.prepare(`
    SELECT * FROM KnifeBitUsage
    ORDER BY DateTime DESC
  `).all() as any[];

  const seen = new Map<number, any>();
  for (const row of rows) {
    if (!seen.has(row.InsertID)) {
      seen.set(row.InsertID, row);
    }
  }

  return Array.from(seen.values()).map(row => ({
    insertId: row.InsertID,
    toolId: row.ToolID,
    cutter: row.Cutter,
    runningMeters: Math.round(row.RunningMeters * 100) / 100,
    maxRunningMeters: row.MaxRunningMeters,
    materialName: row.MatName || getMaterialName(row.MatGuid || ''),
    materialThickness: row.MatThickness,
    lastUsed: epochToIso(row.DateTime),
    wearPercent: row.MaxRunningMeters > 0
      ? Math.min(100, Math.round((row.RunningMeters / row.MaxRunningMeters) * 100))
      : 0,
  }));
}

function readDbVersionFromDb(db: BetterSqliteDatabase): string {
  const rows = db.prepare("SELECT Name, Value FROM DBInfo WHERE Name IN ('MajorVersion','MinorVersion','BugFixVersion') ORDER BY Name").all() as any[];
  const v: Record<string, number> = {};
  rows.forEach(r => v[r.Name] = r.Value);
  return `${v.MajorVersion || 0}.${v.MinorVersion || 0}.${v.BugFixVersion || 0}`;
}

// ============ Public API ============

/**
 * Get the cutter info for a Zund machine.
 */
export async function getZundCutterInfo(zundId: string = 'zund2'): Promise<ZundCutterInfo> {
  const db = await openDb(zundId);
  try {
    return readCutterInfoFromDb(db);
  } finally {
    db.close();
  }
}

/**
 * Get the current (most recent) job. If it ended recently, it's still "current".
 */
export async function getCurrentJob(zundId: string = 'zund2'): Promise<ZundJob | null> {
  const db = await openDb(zundId);
  try {
    return readCurrentJobFromDb(db);
  } finally {
    db.close();
  }
}

/**
 * Get recent cutting jobs.
 */
export async function getRecentJobs(zundId: string = 'zund2', limit: number = 20): Promise<ZundJob[]> {
  const db = await openDb(zundId);
  try {
    return readRecentJobsFromDb(db, limit);
  } finally {
    db.close();
  }
}

/**
 * Get today's production statistics.
 */
export async function getTodayStats(zundId: string = 'zund2') {
  const db = await openDb(zundId);
  try {
    return readTodayStatsFromDb(db);
  } finally {
    db.close();
  }
}

/**
 * Get tool/knife wear status.
 */
export async function getToolWear(zundId: string = 'zund2'): Promise<ZundToolUsage[]> {
  const db = await openDb(zundId);
  try {
    return readToolWearFromDb(db);
  } finally {
    db.close();
  }
}

/**
 * Get complete Zund dashboard data.
 */
export async function getZundDashboard(zundId: string = 'zund2', recentJobLimit = 15): Promise<ZundDashboard> {
  const db = await openDb(zundId);
  try {
    return {
      cutter: readCutterInfoFromDb(db),
      currentJob: readCurrentJobFromDb(db),
      recentJobs: readRecentJobsFromDb(db, recentJobLimit),
      todayStats: readTodayStatsFromDb(db),
      toolWear: readToolWearFromDb(db),
      dbVersion: readDbVersionFromDb(db),
    };
  } finally {
    db.close();
  }
}

/**
 * Get all available Zund machines.
 */
export function getAvailableZunds(): string[] {
  return Object.keys(ZUND_STATS_PATHS);
}

/**
 * Check if a Zund stats DB is accessible (async with 2s timeout + 30s cache).
 */
const accessCache: Record<string, { result: boolean; expiresAt: number }> = {};

export async function isZundStatsAccessible(zundId: string): Promise<boolean> {
  const remotePath = ZUND_STATS_PATHS[zundId];
  if (!remotePath) return false;

  const cached = accessCache[zundId];
  if (cached && Date.now() < cached.expiresAt) return cached.result;

  try {
    await withTimeout(fsP.access(remotePath, fs.constants.R_OK), 2000, `access ${zundId}`);
    accessCache[zundId] = { result: true, expiresAt: Date.now() + 30_000 };
    return true;
  } catch {
    accessCache[zundId] = { result: false, expiresAt: Date.now() + 30_000 };
    return false;
  }
}
