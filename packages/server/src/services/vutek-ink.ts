/**
 * VUTEk GS3250LX Pro — Ink Data Service
 * 
 * Connects via SSH to the VuTek printer controller (Ubuntu 10.04) at 192.168.254.60
 * and queries the local MySQL database + CORBA services for ink-related data.
 * 
 * Data sources:
 *   - VuServer_control RFID readCouplerInkWeight — Real-time load cell weight (kg) per coupler
 *   - controldb.CouplerWeights   — Full/empty weight calibration per ink position
 *   - controldb.InkBagHistory    — Ink bag install/usage tracking per RFID tag
 *   - controldb.EnabledColors    — Active ink channels (C/M/Y/K/c/m/y/k/W/w)
 *   - printdb.InkUsageHistory    — Per-job ink consumption in drops per channel
 *   - printdb.CompletePrints     — Completed print history with timestamp/area
 *   - JMF DeviceStatus on :8013  — Printer status/warnings from JDF Connector
 * 
 * Ink level calculation:
 *   percentage = (currentWeight - emptyWeight) / (fullWeight - emptyWeight) * 100
 *   Weight is read from the physical load cell under each ink coupler.
 *   CouplerWeights table provides FullWeight/EmptyWeight calibration per position.
 * 
 * Ink Path Configuration (from RangeleyInkPathGraphs.xml):
 *   Coupler 1 (RFID0) → y (Yellow)        Location 1, InkSupplyIndex 0
 *   Coupler 2 (RFID1) → C (Cyan)          Location 2, InkSupplyIndex 1
 *   Coupler 3 (RFID2) → m (Magenta)       Location 3, InkSupplyIndex 2
 *   Coupler 4 (RFID3) → K (Black)         Location 4, InkSupplyIndex 3
 *   Coupler 5 (RFID4) → k (Light Black)   Location 5, InkSupplyIndex 4
 *   Coupler 6 (RFID5) → M (Light Magenta) Location 6, InkSupplyIndex 5
 *   Coupler 7 (RFID6) → c (Light Cyan)    Location 7, InkSupplyIndex 6
 *   Coupler 8 (RFID7) → Y (Light Yellow)  Location 8, InkSupplyIndex 7
 *   Coupler 9 (RFID8) → W (White)         Location 9, InkSupplyIndex 8
 */

import { Client } from 'ssh2';

// ============ Constants ============

const VUTEK_IP = '192.168.254.60';
const VUTEK_SSH_USER = 'vutek01';
const VUTEK_SSH_PASS = 'vutek01';
const SSH_TIMEOUT_MS = 10000;
const CMD_TIMEOUT_MS = 15000;

// Color code to display name mapping
const COLOR_MAP: Record<string, { name: string; hexColor: string }> = {
  'C': { name: 'Cyan', hexColor: '#00BCD4' },
  'M': { name: 'Magenta', hexColor: '#E91E63' },
  'Y': { name: 'Yellow', hexColor: '#FFEB3B' },
  'K': { name: 'Black', hexColor: '#212121' },
  'c': { name: 'Light Cyan', hexColor: '#80DEEA' },
  'm': { name: 'Light Magenta', hexColor: '#F48FB1' },
  'y': { name: 'Light Yellow', hexColor: '#FFF9C4' },
  'k': { name: 'Light Black', hexColor: '#757575' },
  'W': { name: 'White', hexColor: '#FAFAFA' },
  'w': { name: 'White 2', hexColor: '#F5F5F5' },
  'A': { name: 'Clear/Varnish', hexColor: '#E0E0E0' },
  'P': { name: 'Primer', hexColor: '#BDBDBD' },
};

// Known ink bag sizes in microliters (EFI VUTEk GS series uses 5L bags)
const DEFAULT_BAG_SIZE_UL = 5_000_000; // 5 liters = 5,000,000 µL

// RFID coupler index → color code mapping (from RangeleyInkPathGraphs.xml)
// All 9 RFID services are hosted on VuServer port 3107
const RFID_COLOR_MAP: { rfidIndex: number; colorCode: string }[] = [
  { rfidIndex: 0, colorCode: 'y' },  // Coupler 1 — Yellow light
  { rfidIndex: 1, colorCode: 'C' },  // Coupler 2 — Cyan
  { rfidIndex: 2, colorCode: 'm' },  // Coupler 3 — Magenta light
  { rfidIndex: 3, colorCode: 'K' },  // Coupler 4 — Black
  { rfidIndex: 4, colorCode: 'k' },  // Coupler 5 — Light Black
  { rfidIndex: 5, colorCode: 'M' },  // Coupler 6 — Magenta
  { rfidIndex: 6, colorCode: 'c' },  // Coupler 7 — Light Cyan
  { rfidIndex: 7, colorCode: 'Y' },  // Coupler 8 — Yellow
  { rfidIndex: 8, colorCode: 'W' },  // Coupler 9 — White
];

const VUSERVER_CONTROL = '/usr/vutek/bin/VuServer_control';
const RFID_PORT = 3107; // All RFID services on this port

// ============ Interfaces ============

export interface VUTEkInkBag {
  id: number;
  bagId: string;          // RFID tag serial
  installedAt: string;    // ISO timestamp
  lastUsedAt: string;     // ISO timestamp  
  microlitersUsed: number;
  colorCode: string;      // Single char: C, M, Y, K, c, m, y, k, W
  colorName: string;      // Human readable
  hexColor: string;
  estimatedRemainingUl: number;
  estimatedPercentRemaining: number;
  /** Live weight reading from coupler load cell (kg) */
  currentWeight?: number;
  /** Percentage from weight sensor: (current - empty) / (full - empty) * 100 */
  weightBasedPercent?: number;
}

export interface VUTEkEnabledColor {
  colorCode: string;
  colorName: string;
  hexColor: string;
  enabled: boolean;
}

export interface VUTEkInkUsageRecord {
  printId: number;
  jobName: string;
  printStart: string;
  printFinish: string;
  sqFeet: number;
  percentComplete: number;
  printResult: number; // 2=complete, 3=partial
  cyan: number;
  magenta: number;
  yellow: number;
  black: number;
  lightCyan: number;
  lightMagenta: number;
  lightYellow: number;
  lightBlack: number;
  white: number;
  clear: number;
}

export interface VUTEkCouplerWeight {
  index: number;
  fullWeight: number;   // kg
  emptyWeight: number;  // kg
}

export interface VUTEkInkData {
  available: boolean;
  lastPolled: string;
  error?: string;
  
  /** Currently installed ink bags — one per active color channel */
  currentBags: VUTEkInkBag[];
  
  /** All enabled ink channels */
  enabledColors: VUTEkEnabledColor[];
  
  /** Coupler weight calibration */
  couplerWeights: VUTEkCouplerWeight[];
  
  /** Recent print jobs with ink usage (today + yesterday) */
  recentUsage: VUTEkInkUsageRecord[];
  
  /** Total ink consumed all-time per channel (in drops) */
  totalUsage: {
    cyan: number;
    magenta: number;
    yellow: number;
    black: number;
    lightCyan: number;
    lightMagenta: number;
    white: number;
    totalJobs: number;
  };
  
  /** Printer status from JMF connector (port 8013) */
  printerStatus: {
    deviceStatus: string;    // Setup, Idle, Running, etc.
    statusDetails: string;   // Warning/error text
    deviceId: string;
    serialNumber: string;
  } | null;
  
  /** RFID tag status — currently all reporting errors */
  rfidStatus: {
    workingTags: string[];
    errorTags: string[];
    message: string;
  };
}

// ============ SSH Helpers ============

function createSSHConnection(): Promise<Client> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    const timer = setTimeout(() => {
      conn.end();
      reject(new Error('SSH connection timeout'));
    }, SSH_TIMEOUT_MS);

    conn.on('ready', () => {
      clearTimeout(timer);
      resolve(conn);
    });
    conn.on('error', (err: Error) => {
      clearTimeout(timer);
      reject(err);
    });
    conn.connect({
      host: VUTEK_IP,
      port: 22,
      username: VUTEK_SSH_USER,
      password: VUTEK_SSH_PASS,
      readyTimeout: SSH_TIMEOUT_MS,
      algorithms: {
        kex: [
          'diffie-hellman-group-exchange-sha256',
          'diffie-hellman-group-exchange-sha1',
          'diffie-hellman-group14-sha1',
          'diffie-hellman-group1-sha1',
        ],
        serverHostKey: ['ssh-rsa', 'ssh-dss', 'ecdsa-sha2-nistp256'],
        cipher: ['aes128-ctr', 'aes192-ctr', 'aes256-ctr', 'aes128-cbc', '3des-cbc'],
        hmac: ['hmac-sha2-256', 'hmac-sha1', 'hmac-md5'],
      },
    });
  });
}

function execSSH(conn: Client, cmd: string, timeoutMs = CMD_TIMEOUT_MS): Promise<string> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(''), timeoutMs);
    conn.exec(cmd, (err: Error | undefined, stream: any) => {
      if (err) { clearTimeout(timer); resolve(''); return; }
      let out = '';
      stream.on('data', (data: Buffer) => { out += data.toString(); });
      stream.stderr.on('data', (data: Buffer) => { out += data.toString(); });
      stream.on('close', () => {
        clearTimeout(timer);
        resolve(out);
      });
    });
  });
}

/** Run a MySQL query via SSH and return parsed rows */
async function mysqlQuery(conn: Client, query: string, db = 'controldb'): Promise<Record<string, string>[]> {
  const escapedQuery = query.replace(/"/g, '\\"');
  const cmd = `mysql -u vutek01 -pvutek01 ${db} -N -B -e "${escapedQuery}" 2>/dev/null`;
  const raw = await execSSH(conn, cmd);
  if (!raw.trim()) return [];

  // Tab-separated values, no headers (-N = no column names, -B = batch/tab-separated)
  const rows = raw.trim().split('\n').map(line => line.split('\t'));
  
  // Return as array of string arrays since we don't have headers
  return rows.map(r => {
    const obj: Record<string, string> = {};
    r.forEach((val, i) => { obj[`col${i}`] = val; });
    return obj;
  });
}

/** Run a MySQL query with column headers */
async function mysqlQueryWithHeaders(conn: Client, query: string, db = 'controldb'): Promise<Record<string, string>[]> {
  const escapedQuery = query.replace(/"/g, '\\"');
  const cmd = `mysql -u vutek01 -pvutek01 ${db} -B -e "${escapedQuery}" 2>/dev/null`;
  const raw = await execSSH(conn, cmd);
  if (!raw.trim()) return [];

  const lines = raw.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split('\t');
  return lines.slice(1).map(line => {
    const vals = line.split('\t');
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
    return obj;
  });
}

// ============ Data Query Functions ============

/**
 * Read real-time ink coupler weights via VuServer_control → RFID readCouplerInkWeight.
 * Each coupler has a physical load cell that measures the ink bag weight in kg.
 * Returns map of color code → current weight in kg.
 */
async function readRealTimeInkWeights(conn: Client): Promise<Map<string, number>> {
  const weights = new Map<string, number>();

  // Read all 9 couplers — they all live on the same VuServer port 3107
  const promises = RFID_COLOR_MAP.map(async ({ rfidIndex, colorCode }) => {
    try {
      const cmd = `${VUSERVER_CONTROL} localhost ${RFID_PORT} RFID${rfidIndex} readCouplerInkWeight 2>/dev/null`;
      const result = await execSSH(conn, cmd, 5000);
      const match = result.match(/readCouplerInkWeight=\s*([\d.-]+)/);
      if (match) {
        weights.set(colorCode, parseFloat(match[1]));
      }
    } catch {
      // Silently skip — weight unavailable for this coupler
    }
  });

  await Promise.all(promises);
  return weights;
}

/**
 * Get the most recently installed ink bag for each color from InkBagHistory,
 * then overlay real-time weight-based ink levels from the coupler load cells.
 */
async function getCurrentInkBags(
  conn: Client,
  couplerWeights: VUTEkCouplerWeight[],
  liveWeights: Map<string, number>,
): Promise<VUTEkInkBag[]> {
  // Get the most recent bag per color from InkBagHistory
  let rows = await mysqlQueryWithHeaders(conn, `
    SELECT ibh.ID, ibh.BagID, ibh.CreationTime, ibh.LastUsedTime, 
           ibh.Microliters, ibh.Color
    FROM InkBagHistory ibh
    INNER JOIN (
      SELECT Color, MAX(ID) as MaxID 
      FROM InkBagHistory 
      GROUP BY Color
    ) latest ON ibh.Color = latest.Color AND ibh.ID = latest.MaxID
    ORDER BY ibh.Color
  `, 'controldb');

  // Fallback: if the subquery doesn't work on old MySQL, try simpler approach
  if (rows.length === 0) {
    const rawRows = await mysqlQueryWithHeaders(conn, `
      SELECT ID, BagID, CreationTime, LastUsedTime, Microliters, Color
      FROM InkBagHistory 
      ORDER BY ID DESC 
      LIMIT 30
    `, 'controldb');

    // Group by color, keep most recent
    const byColor = new Map<string, typeof rawRows[0]>();
    for (const row of rawRows) {
      const color = row.Color?.trim();
      if (color && !byColor.has(color)) {
        byColor.set(color, row);
      }
    }
    rows = Array.from(byColor.values());
  }

  // Build coupler weight lookup: color code → { full, empty }
  const calibration = buildCalibrationMap(couplerWeights);

  // Map bags and overlay weight-based percentages
  const bags = rows.map(row => mapInkBag(row, calibration, liveWeights));

  // Add any colors that have live weight data but no InkBagHistory entry
  const existingColors = new Set(bags.map(b => b.colorCode));
  for (const [colorCode, weight] of liveWeights) {
    if (!existingColors.has(colorCode)) {
      const colorInfo = COLOR_MAP[colorCode] || { name: colorCode, hexColor: '#9E9E9E' };
      const cal = calibration.get(colorCode);
      const pct = cal
        ? Math.max(0, Math.min(100, ((weight - cal.empty) / (cal.full - cal.empty)) * 100))
        : 0;
      bags.push({
        id: 0,
        bagId: '',
        installedAt: '',
        lastUsedAt: '',
        microlitersUsed: 0,
        colorCode,
        colorName: colorInfo.name,
        hexColor: colorInfo.hexColor,
        estimatedRemainingUl: Math.round(pct / 100 * DEFAULT_BAG_SIZE_UL),
        estimatedPercentRemaining: Math.round(pct),
        currentWeight: weight,
        weightBasedPercent: Math.round(pct),
      });
    }
  }

  return bags;
}

/**
 * Build a map of color code → { full, empty } from CouplerWeights + RFID_COLOR_MAP.
 */
function buildCalibrationMap(
  couplerWeights: VUTEkCouplerWeight[],
): Map<string, { full: number; empty: number }> {
  const map = new Map<string, { full: number; empty: number }>();
  const weightByIndex = new Map(couplerWeights.map(w => [w.index, w]));

  for (const { rfidIndex, colorCode } of RFID_COLOR_MAP) {
    const w = weightByIndex.get(rfidIndex);
    if (w) {
      map.set(colorCode, { full: w.fullWeight, empty: w.emptyWeight });
    }
  }
  return map;
}

function mapInkBag(
  row: Record<string, string>,
  calibration: Map<string, { full: number; empty: number }>,
  liveWeights: Map<string, number>,
): VUTEkInkBag {
  const colorCode = row.Color?.trim() || '?';
  const colorInfo = COLOR_MAP[colorCode] || { name: colorCode, hexColor: '#9E9E9E' };
  const microlitersUsed = parseInt(row.Microliters || '0', 10);

  // Primary source: real-time coupler weight from load cell
  const currentWeight = liveWeights.get(colorCode);
  const cal = calibration.get(colorCode);
  let weightBasedPercent: number | undefined;
  let estimatedPercentRemaining: number;
  let estimatedRemainingUl: number;

  if (currentWeight !== undefined && cal && cal.full > cal.empty) {
    // Weight-based calculation (accurate — matches printer diagnostic screen)
    weightBasedPercent = Math.max(0, Math.min(100,
      ((currentWeight - cal.empty) / (cal.full - cal.empty)) * 100));
    estimatedPercentRemaining = Math.round(weightBasedPercent);
    estimatedRemainingUl = Math.round((weightBasedPercent / 100) * DEFAULT_BAG_SIZE_UL);
  } else {
    // Fallback: Microliters-based estimate (less accurate)
    const remaining = Math.max(0, DEFAULT_BAG_SIZE_UL - microlitersUsed);
    estimatedPercentRemaining = Math.round((remaining / DEFAULT_BAG_SIZE_UL) * 100);
    estimatedRemainingUl = remaining;
  }

  return {
    id: parseInt(row.ID || '0', 10),
    bagId: row.BagID || '',
    installedAt: row.CreationTime || '',
    lastUsedAt: row.LastUsedTime || '',
    microlitersUsed,
    colorCode,
    colorName: colorInfo.name,
    hexColor: colorInfo.hexColor,
    estimatedRemainingUl,
    estimatedPercentRemaining,
    currentWeight,
    weightBasedPercent: weightBasedPercent !== undefined ? Math.round(weightBasedPercent) : undefined,
  };
}

async function getEnabledColors(conn: Client): Promise<VUTEkEnabledColor[]> {
  const rows = await mysqlQueryWithHeaders(conn, 
    'SELECT Color, IsEnabled FROM EnabledColors', 'controldb');
  
  return rows.map(row => {
    const colorCode = row.Color?.trim() || '?';
    const colorInfo = COLOR_MAP[colorCode] || { name: colorCode, hexColor: '#9E9E9E' };
    return {
      colorCode,
      colorName: colorInfo.name,
      hexColor: colorInfo.hexColor,
      enabled: row.IsEnabled === '1',
    };
  });
}

async function getCouplerWeights(conn: Client): Promise<VUTEkCouplerWeight[]> {
  const rows = await mysqlQueryWithHeaders(conn,
    'SELECT InkSupplyIndex, FullWeight, EmptyWeight FROM CouplerWeights', 'controldb');
  
  return rows.map(row => ({
    index: parseInt(row.InkSupplyIndex || '0', 10),
    fullWeight: parseFloat(row.FullWeight || '0'),
    emptyWeight: parseFloat(row.EmptyWeight || '0'),
  }));
}

/**
 * Get recent print jobs with ink usage (last 2 days)
 */
async function getRecentInkUsage(conn: Client): Promise<VUTEkInkUsageRecord[]> {
  const rows = await mysqlQueryWithHeaders(conn, `
    SELECT 
      cp.uid, cp.Name, cp.PrintStart, cp.PrintFinish, 
      cp.SqFeet, cp.PercentComplete, cp.PrintResult,
      iu.Cyan, iu.Magenta, iu.Yellow, iu.Black,
      iu.LightCyan, iu.LightMagenta, iu.LightYellow, iu.LightBlack,
      iu.White, iu.Clear
    FROM CompletePrints cp 
    JOIN InkUsageHistory iu ON cp.uid = iu.ID 
    WHERE cp.PrintFinish >= DATE_SUB(NOW(), INTERVAL 2 DAY)
      AND cp.PrintFinish != '0000-00-00 00:00:00'
    ORDER BY cp.uid DESC 
    LIMIT 50
  `, 'printdb');

  return rows.map(row => ({
    printId: parseInt(row.uid || '0', 10),
    jobName: row.Name || '',
    printStart: row.PrintStart || '',
    printFinish: row.PrintFinish || '',
    sqFeet: parseFloat(row.SqFeet || '0'),
    percentComplete: parseFloat(row.PercentComplete || '0'),
    printResult: parseInt(row.PrintResult || '0', 10),
    cyan: parseFloat(row.Cyan || '0'),
    magenta: parseFloat(row.Magenta || '0'),
    yellow: parseFloat(row.Yellow || '0'),
    black: parseFloat(row.Black || '0'),
    lightCyan: parseFloat(row.LightCyan || '0'),
    lightMagenta: parseFloat(row.LightMagenta || '0'),
    lightYellow: parseFloat(row.LightYellow || '0'),
    lightBlack: parseFloat(row.LightBlack || '0'),
    white: parseFloat(row.White || '0'),
    clear: parseFloat(row.Clear || '0'),
  }));
}

async function getTotalInkUsage(conn: Client): Promise<VUTEkInkData['totalUsage']> {
  const rows = await mysqlQueryWithHeaders(conn, `
    SELECT 
      SUM(Cyan) as TotalCyan,
      SUM(Magenta) as TotalMagenta,
      SUM(Yellow) as TotalYellow,
      SUM(Black) as TotalBlack,
      SUM(LightCyan) as TotalLightCyan,
      SUM(LightMagenta) as TotalLightMagenta,
      SUM(White) as TotalWhite,
      COUNT(*) as TotalJobs
    FROM InkUsageHistory
  `, 'printdb');

  if (rows.length === 0) {
    return { cyan: 0, magenta: 0, yellow: 0, black: 0, lightCyan: 0, lightMagenta: 0, white: 0, totalJobs: 0 };
  }

  const r = rows[0];
  return {
    cyan: parseFloat(r.TotalCyan || '0'),
    magenta: parseFloat(r.TotalMagenta || '0'),
    yellow: parseFloat(r.TotalYellow || '0'),
    black: parseFloat(r.TotalBlack || '0'),
    lightCyan: parseFloat(r.TotalLightCyan || '0'),
    lightMagenta: parseFloat(r.TotalLightMagenta || '0'),
    white: parseFloat(r.TotalWhite || '0'),
    totalJobs: parseInt(r.TotalJobs || '0', 10),
  };
}

/**
 * Query the VuTek's local JDF Connector (port 8013) via SSH + curl for device status
 */
async function getJMFDeviceStatus(conn: Client): Promise<VUTEkInkData['printerStatus']> {
  const jmf = `<?xml version="1.0" encoding="UTF-8"?><JMF xmlns="http://www.CIP4.org/JDFSchema_1_1" SenderID="ERP" Version="1.4" TimeStamp="${new Date().toISOString()}"><Query ID="Q1" Type="KnownDevices"><DeviceFilter DeviceDetails="Details"/></Query></JMF>`;
  
  const cmd = `curl -s -m 5 -X POST -H "Content-Type: application/vnd.cip4-jmf+xml" -d '${jmf}' http://localhost:8013/ 2>/dev/null`;
  const xml = await execSSH(conn, cmd);
  
  if (!xml || !xml.includes('DeviceInfo')) {
    return null;
  }

  // Parse key values from XML with regex (lightweight — avoids XML parser dep in SSH context)
  const deviceStatusMatch = xml.match(/DeviceStatus="([^"]+)"/);
  const statusDetailsMatch = xml.match(/StatusDetails="([^"]+)"/);
  const deviceIdMatch = xml.match(/DeviceID="([^"]+)"/);
  const snMatch = xml.match(/"SN":"(\d+)"/);

  return {
    deviceStatus: deviceStatusMatch?.[1] || 'Unknown',
    statusDetails: statusDetailsMatch?.[1] || '',
    deviceId: deviceIdMatch?.[1] || '',
    serialNumber: snMatch?.[1] || '',
  };
}

/**
 * Check RFID tag status from the vutekd log
 */
async function getRFIDStatus(conn: Client): Promise<VUTEkInkData['rfidStatus']> {
  const output = await execSSH(conn, 
    `grep -i "RFID" /var/log/vutekd.log 2>/dev/null | tail -50`);
  
  const errorTags = new Set<string>();
  const workingTags = new Set<string>();
  
  for (const line of output.split('\n')) {
    const tagMatch = line.match(/RFID(\d+)/);
    if (!tagMatch) continue;
    const tag = `RFID${tagMatch[1]}`;
    
    if (line.includes('Tag has errors') || line.includes('expired') || line.includes('No Tag')) {
      errorTags.add(tag);
    } else {
      workingTags.add(tag);
    }
  }

  // Remove working tags from error set (if they later recovered)
  for (const t of workingTags) {
    errorTags.delete(t);
  }

  const message = errorTags.size > 0 
    ? `${errorTags.size} RFID tags reporting errors — ink level readings unavailable. Ink bags may need RFID tag replacement.`
    : 'All RFID tags operational';

  return {
    workingTags: Array.from(workingTags),
    errorTags: Array.from(errorTags),
    message,
  };
}

// ============ Cache ============

let inkCache: { data: VUTEkInkData; timestamp: number } | null = null;
const INK_CACHE_TTL_MS = 60_000; // 60 seconds — ink levels change slowly

// ============ Main Poll Function ============

/**
 * Poll the VuTek printer for ink data via SSH + MySQL.
 * Results are cached for 60 seconds.
 */
export async function pollVUTEkInk(): Promise<VUTEkInkData> {
  const now = Date.now();

  // Return cache if still fresh
  if (inkCache && (now - inkCache.timestamp) < INK_CACHE_TTL_MS) {
    return inkCache.data;
  }

  const result: VUTEkInkData = {
    available: false,
    lastPolled: new Date().toISOString(),
    currentBags: [],
    enabledColors: [],
    couplerWeights: [],
    recentUsage: [],
    totalUsage: {
      cyan: 0, magenta: 0, yellow: 0, black: 0,
      lightCyan: 0, lightMagenta: 0, white: 0, totalJobs: 0,
    },
    printerStatus: null,
    rfidStatus: { workingTags: [], errorTags: [], message: 'Not checked' },
  };

  let conn: Client | null = null;

  try {
    conn = await createSSHConnection();
    result.available = true;

    // Run all queries in parallel over the same SSH connection
    const [colors, weights, liveWeights, usage, totals, jmfStatus, rfid] = await Promise.all([
      getEnabledColors(conn),
      getCouplerWeights(conn),
      readRealTimeInkWeights(conn),
      getRecentInkUsage(conn),
      getTotalInkUsage(conn),
      getJMFDeviceStatus(conn),
      getRFIDStatus(conn),
    ]);

    // Get current bags with weight-based levels (depends on weights + liveWeights)
    const bags = await getCurrentInkBags(conn, weights, liveWeights);

    result.currentBags = bags;
    result.enabledColors = colors;
    result.couplerWeights = weights;
    result.recentUsage = usage;
    result.totalUsage = totals;
    result.printerStatus = jmfStatus;
    result.rfidStatus = rfid;

    // Cache on success
    inkCache = { data: result, timestamp: now };
  } catch (err: any) {
    result.error = err.message || 'Failed to connect to VuTek';
    console.error('[VUTEk-Ink] Poll error:', err.message);
  } finally {
    if (conn) {
      try { conn.end(); } catch { /* ignore */ }
    }
  }

  return result;
}

/**
 * Get cached ink data without triggering a new poll
 */
export function getCachedVUTEkInkData(): VUTEkInkData | null {
  return inkCache?.data || null;
}

/**
 * Force a fresh poll, ignoring cache
 */
export async function forceRefreshVUTEkInk(): Promise<VUTEkInkData> {
  inkCache = null;
  return pollVUTEkInk();
}
