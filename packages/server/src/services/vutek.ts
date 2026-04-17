/**
 * VUTEk GS3250LX Pro Data Service
 * 
 * Collects data from available sources for the VUTEk flatbed UV printer:
 *   - Fiery Controller JDF export files (print job queue/history)
 *   - Port connectivity checks (SSH, VNC)
 *   - Known printer specifications
 * 
 * The VUTEk does NOT expose SNMP or HTTP APIs — only SSH (22) and VNC (5900).
 * The Fiery controller (192.168.254.57) exposes SMB file shares only.
 */

import * as net from 'net';
import * as http from 'http';
import { promises as fs } from 'fs';
import path from 'path';
import { XMLParser } from 'fast-xml-parser';
import type { FieryJob } from './fiery.js';
import { pollVUTEkInk } from './vutek-ink.js';

// ============ Interfaces ============

export interface VUTEkIdentity {
  productName: string;
  manufacturer: string;
  model: string;
  technology: string;
  maxPrintWidth: string;
  maxPrintLength: string;
  bedSize: string;
  resolution: string;
  inkType: string;
  inkChannels: string[];
  printModes: string[];
}

export interface VUTEkConnectivity {
  printerIp: string;
  fieryIp: string;
  printerReachable: boolean;
  fieryReachable: boolean;
  ports: {
    ssh: boolean;
    vnc: boolean;
  };
  fieryPorts: {
    smb: boolean;
    rdp: boolean;
    rpc: boolean;
  };
  fieryShareAccessible: boolean;
  lastChecked: string;
}

export interface VUTEkQueueEntry {
  jobId: string;
  jobPartId: string;
  status: string;        // Waiting, Running, Completed, Aborted, Suspended, Held
  priority: number;
  submissionTime: string | null;
  startTime: string | null;
  endTime: string | null;
  descriptiveName: string | null;
}

export interface VUTEkQueueStatus {
  status: string;         // Running, Held, Waiting, Blocked
  queueSize: number;
  deviceId: string;
  entries: VUTEkQueueEntry[];
  lastQueried: string;
}

export interface VUTEkDeviceStatus {
  deviceName: string;          // e.g. "VUTEk 32h [FAST DRIVE]"
  deviceId: string;
  deviceStatus: string;        // Idle, Running, Down, Setup, Cleanup, Stopped
  deviceCondition: string;     // OK, NeedsAttention, Failure, OffLine
  operationMode: string;       // Productive, NonProductive, Maintenance
  statusDetails: string;       // free-form status text
  moduleStatus: string;        // Printer module status
  jmfUrl: string;
  lastQueried: string;
}

export interface VUTEkFieryJob {
  jobId: string;
  jobName: string;
  fileName: string;
  timestamp: string | null;
  inks: string[];
  dimensions: {
    widthIn: number;
    heightIn: number;
    sqFt: number;
  } | null;
  media: {
    brand: string | null;
    description: string | null;
    type: string | null;
  } | null;
  hasZccCutFile: boolean;
}

export interface VUTEkData {
  available: boolean;
  lastPolled: string;
  identity: VUTEkIdentity;
  connectivity: VUTEkConnectivity;
  fieryJobs: VUTEkFieryJob[];
  fieryJobCount: number;
  fieryShareFiles: {
    total: number;
    jdf: number;
    rtl: number;
    zcc: number;
    gif: number;
  } | null;
  inkConfiguration: {
    channel: string;
    color: string;
    hexColor: string;
  }[];
  queue: VUTEkQueueStatus | null;
  deviceStatus: VUTEkDeviceStatus | null;
  /** Ink data from MySQL via SSH (bags, usage, RFID status) */
  ink: import('./vutek-ink.js').VUTEkInkData | null;
  error?: string;
}

// ============ Constants ============

const VUTEK_IP = '192.168.254.60';
const FIERY_IP = '192.168.254.57';
const FIERY_EXPORT_PATH = '\\\\192.168.254.57\\EFI Export Folder';
const FIERY_JMF_URL = `http://${FIERY_IP}:8010/`;
const JMF_TIMEOUT_MS = 5000;

// VUTEk GS3250LX Pro specifications
const VUTEK_IDENTITY: VUTEkIdentity = {
  productName: 'EFI VUTEk GS3250LX Pro',
  manufacturer: 'EFI / Electronics for Imaging',
  model: 'GS3250LX Pro',
  technology: 'UV LED Flatbed / Roll-to-Roll',
  maxPrintWidth: '126 in (3.2 m)',
  maxPrintLength: '120 in (flatbed) / unlimited (roll)',
  bedSize: '126" × 120" (10.5\' × 10\')',
  resolution: 'Up to 1000 dpi',
  inkType: 'EFI GS3250LX UV Ink',
  inkChannels: ['Cyan', 'Magenta', 'Yellow', 'Black', 'Light Cyan', 'Light Magenta', 'White', 'Clear'],
  printModes: ['Production', 'High Quality', 'Backlit', 'Day/Night'],
};

// Ink channel colors for display
const INK_CHANNELS: VUTEkData['inkConfiguration'] = [
  { channel: 'Cyan', color: 'Cyan', hexColor: '#00BCD4' },
  { channel: 'Magenta', color: 'Magenta', hexColor: '#E91E63' },
  { channel: 'Yellow', color: 'Yellow', hexColor: '#FFEB3B' },
  { channel: 'Black', color: 'Black', hexColor: '#212121' },
  { channel: 'Light Cyan', color: 'Light Cyan', hexColor: '#80DEEA' },
  { channel: 'Light Magenta', color: 'Light Magenta', hexColor: '#F48FB1' },
  { channel: 'White', color: 'White', hexColor: '#FAFAFA' },
  { channel: 'Clear', color: 'Clear', hexColor: '#E0E0E0' },
];

// ============ Cache ============

interface VUTEkCache {
  data: VUTEkData;
  lastFull: number;
}

let cache: VUTEkCache | null = null;

// ============ Helpers ============

function checkPort(ip: string, port: number, timeoutMs: number = 2000): Promise<boolean> {
  return new Promise((resolve) => {
    const s = new net.Socket();
    s.setTimeout(timeoutMs);
    s.on('connect', () => { s.destroy(); resolve(true); });
    s.on('timeout', () => { s.destroy(); resolve(false); });
    s.on('error', () => { s.destroy(); resolve(false); });
    s.connect(port, ip);
  });
}

/**
 * Query the Fiery JDF Connector's JMF interface for live queue status.
 * Endpoint: http://192.168.254.57:8010 (EFI JDF Connector 1.51)
 * Protocol: JMF (Job Messaging Format) over HTTP — CIP4/JDF standard
 */
async function queryFieryQueue(): Promise<VUTEkQueueStatus | null> {
  const jmfBody = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<JMF xmlns="http://www.CIP4.org/JDFSchema_1_1" SenderID="ERP-VUTEk" Version="1.4"',
    `  TimeStamp="${new Date().toISOString()}">`,
    '  <Query ID="Q1" Type="QueueStatus">',
    '    <QueueFilter QueueEntryDetails="Full"/>',
    '  </Query>',
    '</JMF>',
  ].join('\n');

  return new Promise((resolve) => {
    const req = http.request(FIERY_JMF_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/vnd.cip4-jmf+xml',
        'Content-Length': Buffer.byteLength(jmfBody),
      },
      timeout: JMF_TIMEOUT_MS,
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '',
            removeNSPrefix: true,
          });
          const parsed = parser.parse(body);
          const response = parsed?.JMF?.Response;
          if (!response) { resolve(null); return; }

          const queue = response.Queue;
          if (!queue) { resolve(null); return; }

          // Parse queue entries (present when jobs are in queue)
          const rawEntries = queue.QueueEntry;
          const entries: VUTEkQueueEntry[] = [];
          if (rawEntries) {
            const arr = Array.isArray(rawEntries) ? rawEntries : [rawEntries];
            for (const e of arr) {
              entries.push({
                jobId: e.JobID || '',
                jobPartId: e.JobPartID || '',
                status: e.Status || 'Unknown',
                priority: parseInt(e.Priority || '0', 10),
                submissionTime: e.SubmissionTime || null,
                startTime: e.StartTime || null,
                endTime: e.EndTime || null,
                descriptiveName: e.DescriptiveName || null,
              });
            }
          }

          resolve({
            status: queue.Status || 'Unknown',
            queueSize: parseInt(queue.QueueSize || '0', 10),
            deviceId: queue.DeviceID || '',
            entries,
            lastQueried: new Date().toISOString(),
          });
        } catch {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.write(jmfBody);
    req.end();
  });
}

/**
 * Fetch actual device name from the JDF Connector HTML page.
 * The page at http://192.168.254.57:8010/{deviceId} lists devices in a table.
 * We parse the first device's Name column.
 */
async function fetchJdfConnectorDeviceName(): Promise<string | null> {
  return new Promise((resolve) => {
    const req = http.get(FIERY_JMF_URL, { timeout: 3000 }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        // HTML table has: <TR><TD>VUTEk 32h [FAST DRIVE]<TD>device-id<TD>url
        const match = body.match(/<TBODY>\s*<TR><TD>([^<]+)/i);
        resolve(match?.[1]?.trim() || null);
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

/**
 * Query EFI JDF Connector KnownDevices for live printer status.
 * Returns device name, status (Idle/Running/Down), condition (OK/NeedsAttention/Failure).
 * Also fetches real device name from JDF Connector HTML page in parallel.
 */
async function queryFieryDeviceStatus(): Promise<VUTEkDeviceStatus | null> {
  // Run JMF query and HTML name fetch in parallel
  const [jmfResult, htmlDeviceName] = await Promise.all([
    queryKnownDevicesJMF(),
    fetchJdfConnectorDeviceName(),
  ]);

  if (!jmfResult) return null;

  // Use HTML device name if JMF FriendlyName is empty/generic
  if ((!jmfResult.deviceName || jmfResult.deviceName === 'XF' || jmfResult.deviceName === 'VUTEk') && htmlDeviceName) {
    jmfResult.deviceName = htmlDeviceName;
  }
  return jmfResult;
}

/** Internal: send KnownDevices JMF query */
function queryKnownDevicesJMF(): Promise<VUTEkDeviceStatus | null> {
  const jmfBody = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<JMF xmlns="http://www.CIP4.org/JDFSchema_1_1" SenderID="ERP-VUTEk" Version="1.4"',
    `  TimeStamp="${new Date().toISOString()}">`,
    '  <Query ID="Q2" Type="KnownDevices">',
    '    <DeviceFilter DeviceDetails="Details"/>',
    '  </Query>',
    '</JMF>',
  ].join('\n');

  return new Promise((resolve) => {
    const req = http.request(FIERY_JMF_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/vnd.cip4-jmf+xml',
        'Content-Length': Buffer.byteLength(jmfBody),
      },
      timeout: JMF_TIMEOUT_MS,
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '',
            removeNSPrefix: true,
          });
          const parsed = parser.parse(body);
          const response = parsed?.JMF?.Response;
          if (!response) { resolve(null); return; }

          const deviceList = response.DeviceList;
          if (!deviceList) { resolve(null); return; }

          const info = deviceList.DeviceInfo;
          if (!info) { resolve(null); return; }

          const device = info.Device;
          const moduleStatus = info.ModuleStatus;

          resolve({
            deviceName: device?.FriendlyName || device?.DeviceType || 'VUTEk',
            deviceId: device?.DeviceID || '',
            deviceStatus: info.DeviceStatus || 'Unknown',
            deviceCondition: info.DeviceCondition || 'Unknown',
            operationMode: info.DeviceOperationMode || 'Unknown',
            statusDetails: info.StatusDetails || '',
            moduleStatus: moduleStatus?.DeviceStatus || info.DeviceStatus || 'Unknown',
            jmfUrl: device?.JMFURL || '',
            lastQueried: new Date().toISOString(),
          });
        } catch {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.write(jmfBody);
    req.end();
  });
}

async function checkConnectivity(): Promise<VUTEkConnectivity> {
  // Check all ports in parallel
  const [ssh, vnc, smb, rdp, rpc] = await Promise.all([
    checkPort(VUTEK_IP, 22),
    checkPort(VUTEK_IP, 5900),
    checkPort(FIERY_IP, 445),
    checkPort(FIERY_IP, 3389),
    checkPort(FIERY_IP, 135),
  ]);

  // Check Fiery SMB share accessibility
  let fieryShareAccessible = false;
  if (smb) {
    try {
      await fs.access(FIERY_EXPORT_PATH);
      fieryShareAccessible = true;
    } catch {
      // Share not accessible (permissions or not mounted)
    }
  }

  return {
    printerIp: VUTEK_IP,
    fieryIp: FIERY_IP,
    printerReachable: ssh || vnc,
    fieryReachable: smb || rdp || rpc,
    ports: { ssh, vnc },
    fieryPorts: { smb, rdp, rpc },
    fieryShareAccessible,
    lastChecked: new Date().toISOString(),
  };
}

async function scanFieryExportFolder(): Promise<{
  files: string[];
  counts: VUTEkData['fieryShareFiles'];
}> {
  try {
    const allFiles = await fs.readdir(FIERY_EXPORT_PATH);
    const jdf = allFiles.filter(f => f.toLowerCase().endsWith('.jdf'));
    const rtl = allFiles.filter(f => f.toLowerCase().endsWith('.rtl'));
    const zcc = allFiles.filter(f => f.toLowerCase().endsWith('.zcc'));
    const gif = allFiles.filter(f => f.toLowerCase().endsWith('.gif'));

    return {
      files: allFiles,
      counts: {
        total: allFiles.length,
        jdf: jdf.length,
        rtl: rtl.length,
        zcc: zcc.length,
        gif: gif.length,
      },
    };
  } catch {
    return { files: [], counts: null };
  }
}

async function parseFieryJdfFile(filePath: string): Promise<VUTEkFieryJob | null> {
  try {
    let content = await fs.readFile(filePath, 'utf-8');
    content = content.replace(/^\uFEFF/, ''); // Strip BOM

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      removeNSPrefix: true,
    });

    const result = parser.parse(content);
    const jdf = result.JDF;
    if (!jdf) return null;

    const jobId = jdf.JobID || path.basename(filePath, '.jdf');
    // Clean job name: strip .rtl_101 suffix
    const jobName = jobId.replace(/\.rtl(_\d+)?$/, '');
    const fileName = path.basename(filePath);

    // Timestamp from audit pool
    let timestamp: string | null = null;
    if (jdf.AuditPool?.Created?.TimeStamp) {
      timestamp = jdf.AuditPool.Created.TimeStamp;
    }

    // Parse resources
    const resourcePool = jdf.ResourcePool;
    const pools = Array.isArray(resourcePool) ? resourcePool : (resourcePool ? [resourcePool] : []);

    let dimensions: VUTEkFieryJob['dimensions'] = null;
    let media: VUTEkFieryJob['media'] = null;
    const inks: string[] = [];

    for (const pool of pools) {
      // Dimensions (in points — 72 points = 1 inch)
      const component = pool.Component;
      if (component?.Dimensions) {
        const parts = String(component.Dimensions).split(' ').map(Number);
        if (parts.length >= 2) {
          const wIn = parts[0] / 72;
          const hIn = parts[1] / 72;
          dimensions = {
            widthIn: Math.round(wIn * 10) / 10,
            heightIn: Math.round(hIn * 10) / 10,
            sqFt: Math.round((wIn * hIn / 144) * 100) / 100,
          };
        }
      }

      // Media
      const mediaEl = pool.Media;
      if (mediaEl) {
        media = {
          brand: mediaEl.Brand || null,
          description: mediaEl.DescriptiveName || null,
          type: mediaEl.MediaType || null,
        };
      }

      // Inks (ColorantOrder)
      const colorantControl = pool.ColorantControl;
      if (colorantControl?.ColorantOrder) {
        const sepSpecs = colorantControl.ColorantOrder.SeparationSpec;
        if (sepSpecs) {
          const specs = Array.isArray(sepSpecs) ? sepSpecs : [sepSpecs];
          for (const spec of specs) {
            if (spec.Name) inks.push(spec.Name);
          }
        }
      }
    }

    // Check for ZCC cut file
    const baseName = path.basename(filePath, '.jdf').replace('.rtl_101', '').replace('.rtl', '');
    const dir = path.dirname(filePath);
    let hasZccCutFile = false;
    try {
      const dirFiles = await fs.readdir(dir);
      hasZccCutFile = dirFiles.some(f => f.endsWith('.zcc') && f.startsWith(baseName));
    } catch {}

    return {
      jobId,
      jobName,
      fileName,
      timestamp,
      inks,
      dimensions,
      media,
      hasZccCutFile,
    };
  } catch {
    return null;
  }
}

async function getFieryJobs(maxJobs: number = 50): Promise<VUTEkFieryJob[]> {
  try {
    const allFiles = await fs.readdir(FIERY_EXPORT_PATH);
    const jdfFiles = allFiles
      .filter(f => f.toLowerCase().endsWith('.jdf'))
      .map(f => path.join(FIERY_EXPORT_PATH, f));

    // Get file stats for sorting by modification time (newest first)
    const fileStats = await Promise.allSettled(
      jdfFiles.map(async (f) => {
        const stat = await fs.stat(f);
        return { path: f, mtime: stat.mtimeMs };
      })
    );

    const sortedFiles = fileStats
      .filter((r): r is PromiseFulfilledResult<{ path: string; mtime: number }> => r.status === 'fulfilled')
      .map(r => r.value)
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, maxJobs);

    const jobs: VUTEkFieryJob[] = [];
    for (const { path: filePath } of sortedFiles) {
      const job = await parseFieryJdfFile(filePath);
      if (job) jobs.push(job);
    }

    return jobs;
  } catch {
    return [];
  }
}

function mapFieryJobsToVUTEkFieryJobs(jobs: FieryJob[]): VUTEkFieryJob[] {
  return jobs.map((job) => ({
    jobId: job.jobId,
    jobName: job.jobName,
    fileName: job.fileName,
    timestamp: job.timestamp,
    inks: job.inks,
    dimensions: job.dimensions
      ? {
          widthIn: job.dimensions.widthIn,
          heightIn: job.dimensions.heightIn,
          sqFt: Number((job.dimensions.widthIn * job.dimensions.heightIn / 144).toFixed(2)),
        }
      : null,
    media: job.media
      ? {
          brand: job.media.brand ?? job.media.vutekMedia ?? null,
          description: job.media.description,
          type: job.media.type,
        }
      : null,
    hasZccCutFile: job.hasZccCutFile,
  }));
}

// ============ Main Poll Function ============

export async function pollVUTEk(preFetchedFieryJobs?: FieryJob[]): Promise<VUTEkData> {
  const now = Date.now();

  // Return cache if polled within last 15 seconds
  if (cache && (now - cache.lastFull) < 15_000) {
    return cache.data;
  }

  const result: VUTEkData = {
    available: false,
    lastPolled: new Date().toISOString(),
    identity: VUTEK_IDENTITY,
    connectivity: {
      printerIp: VUTEK_IP,
      fieryIp: FIERY_IP,
      printerReachable: false,
      fieryReachable: false,
      ports: { ssh: false, vnc: false },
      fieryPorts: { smb: false, rdp: false, rpc: false },
      fieryShareAccessible: false,
      lastChecked: new Date().toISOString(),
    },
    fieryJobs: [],
    fieryJobCount: 0,
    fieryShareFiles: null,
    inkConfiguration: INK_CHANNELS,
    queue: null,
    deviceStatus: null,
    ink: null,
  };

  try {
    // Run connectivity check, file scan, JMF queue query, and ink data in parallel
    const [connectivity, shareData, queueStatus, devStatus, inkData] = await Promise.all([
      checkConnectivity(),
      scanFieryExportFolder(),
      queryFieryQueue(),
      queryFieryDeviceStatus(),
      pollVUTEkInk().catch(err => {
        console.error('[VUTEk] Ink poll error:', err.message);
        return null;
      }),
    ]);

    result.connectivity = connectivity;
    result.fieryShareFiles = shareData.counts;
    result.queue = queueStatus;
    result.deviceStatus = devStatus;
    result.ink = inkData;
    result.available = connectivity.printerReachable || connectivity.fieryReachable;

    // Parse Fiery JDF jobs if share is accessible.
    // When the caller already fetched the Fiery snapshot, reuse it so we do not
    // parse the same JDF files twice in the same request path.
    if (connectivity.fieryShareAccessible && shareData.counts && shareData.counts.jdf > 0) {
      result.fieryJobs = preFetchedFieryJobs
        ? mapFieryJobsToVUTEkFieryJobs(preFetchedFieryJobs).slice(0, 50)
        : await getFieryJobs(50);
      result.fieryJobCount = shareData.counts.jdf;
    }

    // Cache results
    cache = {
      data: result,
      lastFull: now,
    };
  } catch (err: any) {
    result.error = err.message || 'Unknown error polling VUTEk';
  }

  return result;
}

/**
 * Quick check if an IP belongs to the VUTEk system
 */
export function isVUTEkIP(ip: string): boolean {
  return ip === VUTEK_IP || ip === FIERY_IP;
}

/**
 * Get cached VUTEk data without triggering a new poll
 */
export function getCachedVUTEkData(): VUTEkData | null {
  return cache?.data || null;
}
