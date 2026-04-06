/**
 * Zund Queue Watcher
 *
 * Polls the Zund JobQueue folder for new .zcc files.
 * When a new file is detected:
 *   1. Extract CutID from the filename
 *   2. Search Thrive + Fiery print logs for a matching CutID
 *   3. From the matched print log, extract the file path
 *   4. Parse the file path for a work order number
 *   5. Look up the WO in the ERP database
 *   6. Create/update a PrintCutLink tying print, cut, and WO together
 *
 * Every step is logged to the FileChainLog table so operators
 * can trace exactly how each file was routed.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { XMLParser } from 'fast-xml-parser';
import { prisma } from '../db/client.js';
import { extractCutId } from './zund-match.js';
import { findThriveJobByCutId, parseJobInfo } from './thrive.js';
import { getAllFieryJobs, type FieryJob } from './fiery.js';
import { logChainEvent, createPrintCutLink } from './file-chain.js';
import { broadcast } from '../ws/server.js';

// ─── Configuration ─────────────────────────────────────

const ZUND_QUEUE_BASE = '\\\\wildesigns-fs1\\Company Files\\Zund';
const ZUND_JOB_QUEUE = path.join(ZUND_QUEUE_BASE, '03 JobQueue');

/** How often to poll for new .zcc files (ms) */
const POLL_INTERVAL_MS = 20_000; // 20 seconds

/** How many recent files to consider on each scan */
const SCAN_LIMIT = 300;

const SOURCE = 'ZUND_WATCHER';

// ─── ZCC Parser ────────────────────────────────────────

const zccParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

interface ZccMetadata {
  jobName: string;
  material: string | null;
  orderId: string | null;
}

function parseZccHeader(content: string): ZccMetadata {
  try {
    const parsed = zccParser.parse(content);
    const root = parsed?.ZCC_cmd;
    if (!root) return { jobName: '', material: null, orderId: null };
    return {
      jobName: root.Job?.['@_Name'] || '',
      material: root.Material?.['@_Name'] || root.Material?.['@_Description'] || null,
      orderId: root.Meta?.OrderID || null,
    };
  } catch {
    return { jobName: '', material: null, orderId: null };
  }
}

// ─── State ─────────────────────────────────────────────

/** Set of .zcc filenames we've already processed (populated on first scan) */
const seenFiles = new Set<string>();
let initialised = false;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let pollInFlight: Promise<void> | null = null;

// ─── Core Pipeline ─────────────────────────────────────

/**
 * Process a single new .zcc file through the full linking pipeline.
 * Returns a summary of what happened for console output.
 */
async function processNewZccFile(fileName: string, fullPath: string): Promise<string> {
  const log = (
    level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG',
    event: string,
    message: string,
    extra?: Partial<Parameters<typeof logChainEvent>[0]>,
  ) =>
    logChainEvent({
      level,
      source: SOURCE,
      event,
      message,
      zccFileName: fileName,
      ...extra,
    });

  // Step 1 — Parse the .zcc for metadata
  let zccMeta: ZccMetadata = { jobName: '', material: null, orderId: null };
  try {
    const fd = await fs.open(fullPath, 'r');
    try {
      const buf = Buffer.alloc(4096);
      await fd.read(buf, 0, 4096, 0);
      zccMeta = parseZccHeader(buf.toString('utf-8').replace(/\0+$/, ''));
    } finally {
      await fd.close().catch(() => {});
    }
  } catch { /* will work with filename alone */ }

  const displayName = zccMeta.jobName || fileName;

  await log('INFO', 'NEW_ZCC_DETECTED', `New cut file detected: ${displayName}`, {
    details: { fileName, jobName: zccMeta.jobName, material: zccMeta.material, orderId: zccMeta.orderId },
  });

  // Step 2 — Extract CutID from filename
  const cutId = extractCutId(fileName) || extractCutId(zccMeta.jobName);

  if (!cutId) {
    await log('WARN', 'CUTID_NOT_FOUND', `No CutID could be extracted from: ${displayName}`, {
      success: false,
      details: { fileName, zccJobName: zccMeta.jobName },
    });
    return `⚠ ${displayName}: no CutID`;
  }

  await log('INFO', 'CUTID_EXTRACTED', `CutID "${cutId}" extracted from ${displayName}`, { cutId });

  // Step 3 — Search Thrive print logs + Fiery for matching CutID
  let matchedPrintJob: { source: 'THRIVE' | 'FIERY'; jobName: string; filePath: string; printer?: string } | null = null;

  // 3a. Search Thrive JobLog history (real print records, not temp queue files)
  try {
    const thriveEntry = await findThriveJobByCutId(cutId);
    if (thriveEntry) {
      matchedPrintJob = {
        source: 'THRIVE',
        jobName: thriveEntry.fileName,
        filePath: thriveEntry.sourceFilePath || thriveEntry.fileName || thriveEntry.customizedName,
        printer: thriveEntry.printer,
      };
    }
  } catch (err) {
    await log('DEBUG', 'THRIVE_OFFLINE', `Could not reach Thrive job logs: ${(err as Error).message}`, { success: false });
  }

  // 3b. If no Thrive match, search Fiery
  if (!matchedPrintJob) {
    try {
      const fieryJobs = await getAllFieryJobs();
      for (const fj of fieryJobs) {
        const fjCutId = extractCutId(fj.jobName || '') || extractCutId(fj.zccFileName || '');
        if (fjCutId && fjCutId === cutId) {
          matchedPrintJob = { source: 'FIERY', jobName: fj.jobName, filePath: fj.fileName || fj.thriveFilePath || '' };
          break;
        }
      }
    } catch (err) {
      await log('DEBUG', 'FIERY_OFFLINE', `Could not reach Fiery: ${(err as Error).message}`, { success: false });
    }
  }

  if (!matchedPrintJob) {
    await log('WARN', 'PRINT_LOG_NO_MATCH', `No print log matched CutID "${cutId}" for ${displayName}`, {
      cutId,
      success: false,
      details: { cutId, fileName },
    });
    return `⚠ ${displayName}: CutID "${cutId}" — no print log match`;
  }

  await log('INFO', 'PRINT_LOG_MATCH', `Matched ${matchedPrintJob.source} print job "${matchedPrintJob.jobName}" via CutID "${cutId}"`, {
    cutId,
    printFileName: matchedPrintJob.jobName,
    details: {
      cutId,
      source: matchedPrintJob.source,
      printJobName: matchedPrintJob.jobName,
      printFilePath: matchedPrintJob.filePath,
      printer: matchedPrintJob.printer,
    },
  });

  // Step 4 — Extract work order number from the print file path
  const jobInfo = parseJobInfo(matchedPrintJob.filePath || matchedPrintJob.jobName);
  const woNumber = jobInfo.workOrderNumber;

  if (!woNumber) {
    await log('WARN', 'WO_NOT_IN_PATH', `No WO number found in file path for CutID "${cutId}"`, {
      cutId,
      printFileName: matchedPrintJob.jobName,
      success: false,
      details: { filePath: matchedPrintJob.filePath, cutId },
    });
    return `⚠ ${displayName}: CutID "${cutId}" → ${matchedPrintJob.source} match → no WO in path`;
  }

  await log('INFO', 'WO_EXTRACTED', `Extracted WO# ${woNumber} from ${matchedPrintJob.source} path`, {
    cutId,
    workOrderNumber: woNumber,
    printFileName: matchedPrintJob.jobName,
    details: { woNumber, filePath: matchedPrintJob.filePath, brand: jobInfo.companyBrand },
  });

  // Step 5 — Look up WO in the ERP database
  const wo = await prisma.workOrder.findFirst({
    where: {
      OR: [
        { orderNumber: woNumber },
        { orderNumber: `WO${woNumber}` },
        { orderNumber: { endsWith: woNumber } },
      ],
    },
    select: { id: true, orderNumber: true, customerName: true },
  });

  if (!wo) {
    await log('WARN', 'WO_NOT_FOUND_IN_ERP', `WO# ${woNumber} not found in ERP database`, {
      cutId,
      workOrderNumber: woNumber,
      printFileName: matchedPrintJob.jobName,
      success: false,
    });
    return `⚠ ${displayName}: CutID "${cutId}" → WO${woNumber} not in ERP`;
  }

  await log('INFO', 'WO_FOUND', `Matched WO ${wo.orderNumber} (${wo.customerName})`, {
    cutId,
    workOrderId: wo.id,
    workOrderNumber: wo.orderNumber,
    printFileName: matchedPrintJob.jobName,
    details: { orderId: wo.id, orderNumber: wo.orderNumber, customerName: wo.customerName },
  });

  // Step 6 — Create or update PrintCutLink
  // 6a. Find or create the print-side link
  let link = await prisma.printCutLink.findFirst({
    where: {
      workOrderId: wo.id,
      printFileName: matchedPrintJob.jobName,
    },
  });

  if (!link) {
    link = await createPrintCutLink({
      workOrderId: wo.id,
      printFileName: matchedPrintJob.jobName,
      printFilePath: matchedPrintJob.filePath,
      status: 'CUT_PENDING',
    });

    await log('INFO', 'PRINT_LINK_CREATED', `Created PrintCutLink for "${matchedPrintJob.jobName}" on WO ${wo.orderNumber}`, {
      cutId,
      workOrderId: wo.id,
      workOrderNumber: wo.orderNumber,
      printFileName: matchedPrintJob.jobName,
      printCutLinkId: link.id,
    });
  }

  // 6b. Attach the cut file to the link
  const updated = await prisma.printCutLink.update({
    where: { id: link.id },
    data: {
      cutFileName: fileName,
      cutFilePath: fullPath,
      cutFileSource: matchedPrintJob.source === 'FIERY' ? 'FIERY' : 'ZUND_CENTER',
      cutFileFormat: '.zcc',
      cutId,
      linkConfidence: 'EXACT',
      linkedAt: new Date(),
      status: 'CUT_PENDING',
    },
  });

  await log('INFO', 'LINK_CREATED', `Linked cut file "${fileName}" → print "${matchedPrintJob.jobName}" → WO ${wo.orderNumber}`, {
    cutId,
    workOrderId: wo.id,
    workOrderNumber: wo.orderNumber,
    printFileName: matchedPrintJob.jobName,
    zccFileName: fileName,
    printCutLinkId: updated.id,
    details: {
      cutId,
      cutFile: fileName,
      printFile: matchedPrintJob.jobName,
      printFilePath: matchedPrintJob.filePath,
      source: matchedPrintJob.source,
      orderNumber: wo.orderNumber,
      customerName: wo.customerName,
      linkId: updated.id,
    },
  });

  // Broadcast real-time update
  broadcast({
    type: 'FILE_CHAIN_UPDATED',
    payload: {
      linkId: updated.id,
      workOrderId: wo.id,
      orderNumber: wo.orderNumber,
      cutFileName: fileName,
      printFileName: matchedPrintJob.jobName,
      cutId,
      event: 'ZCC_AUTO_LINKED',
    },
  });

  return `✅ ${displayName}: CutID "${cutId}" → ${matchedPrintJob.source} → WO${wo.orderNumber} (${wo.customerName}) — linked`;
}

// ─── Polling Loop ──────────────────────────────────────

/**
 * Single poll iteration: scan the Zund JobQueue, detect new files, process them.
 */
async function pollOnce(): Promise<void> {
  let entries: string[];
  try {
    const allEntries = await fs.readdir(ZUND_JOB_QUEUE);
    entries = allEntries.filter(e => e.toLowerCase().endsWith('.zcc'));
  } catch (err) {
    // Network share offline — silently skip
    return;
  }

  if (!initialised) {
    // First run: populate the seen-set without processing old files
    for (const name of entries) seenFiles.add(name);
    initialised = true;

    await logChainEvent({
      level: 'INFO',
      source: SOURCE,
      event: 'WATCHER_INIT',
      message: `Zund watcher initialised — ${entries.length} existing .zcc files in queue`,
      details: { queuePath: ZUND_JOB_QUEUE, fileCount: entries.length },
    });
    console.log(`👁️  Zund watcher: ${entries.length} existing files in queue (watching for new)`);
    return;
  }

  // Detect new files (present on disk but not in our set)
  const newFiles = entries.filter(name => !seenFiles.has(name));

  // Update seen set (also remove files that disappeared)
  const currentSet = new Set(entries);
  for (const old of seenFiles) {
    if (!currentSet.has(old)) seenFiles.delete(old);
  }
  for (const name of entries) seenFiles.add(name);

  if (newFiles.length === 0) return;

  console.log(`👁️  Zund watcher: ${newFiles.length} new .zcc file(s) detected`);

  for (const fileName of newFiles) {
    const fullPath = path.join(ZUND_JOB_QUEUE, fileName);
    try {
      const summary = await processNewZccFile(fileName, fullPath);
      console.log(`   ${summary}`);
    } catch (err) {
      const msg = (err as Error).message || String(err);
      console.error(`   ❌ ${fileName}: ${msg}`);
      await logChainEvent({
        level: 'ERROR',
        source: SOURCE,
        event: 'PROCESS_ERROR',
        message: `Error processing ${fileName}: ${msg}`,
        zccFileName: fileName,
        success: false,
        details: { error: msg },
      });
    }
  }
}

async function pollIfIdle(): Promise<void> {
  if (pollInFlight) {
    return pollInFlight;
  }

  pollInFlight = pollOnce().finally(() => {
    pollInFlight = null;
  });

  return pollInFlight;
}

// ─── Public API ────────────────────────────────────────

/**
 * Start the Zund queue watcher.
 * Called once at server startup.
 */
export function startZundWatcher(intervalMs = POLL_INTERVAL_MS): void {
  if (pollTimer) {
    console.warn('Zund watcher already running');
    return;
  }

  // First poll immediately (async, fire-and-forget)
  pollIfIdle().catch(err => console.error('Zund watcher init error:', err));

  pollTimer = setInterval(() => {
    pollIfIdle().catch(err => console.error('Zund watcher poll error:', err));
  }, intervalMs);

  console.log(`👁️  Zund queue watcher started (poll every ${intervalMs / 1000}s)`);
}

/**
 * Stop the watcher (for graceful shutdown).
 */
export function stopZundWatcher(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

/**
 * Get watcher status for diagnostics.
 */
export function getZundWatcherStatus() {
  return {
    running: pollTimer !== null,
    initialised,
    trackedFiles: seenFiles.size,
    queuePath: ZUND_JOB_QUEUE,
    pollIntervalMs: POLL_INTERVAL_MS,
  };
}
