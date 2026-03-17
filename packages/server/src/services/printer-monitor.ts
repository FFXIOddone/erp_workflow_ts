/**
 * Device Monitor Service
 * 
 * Connects to equipment via SNMP, TCP, or Ping to get real-time status:
 * - Printer state (idle, printing, warmup, error, etc.)
 * - Ink/supply levels
 * - Network reachability for any device
 * - TCP port probing for SMB/HTTP devices
 */

import snmp from 'net-snmp';
import net from 'net';
import { exec } from 'child_process';
import type { EWSData } from './hp-ews.js';

// ============ SNMP OID Constants ============

const OID = {
  // System MIB
  SYS_DESCR: '1.3.6.1.2.1.1.1.0',         // System description
  SYS_NAME: '1.3.6.1.2.1.1.5.0',          // System name
  SYS_UPTIME: '1.3.6.1.2.1.1.3.0',        // Uptime
  SYS_CONTACT: '1.3.6.1.2.1.1.4.0',       // Contact info
  SYS_LOCATION: '1.3.6.1.2.1.1.6.0',      // Location

  // Host Resources MIB
  HR_PRINTER_STATUS: '1.3.6.1.2.1.25.3.5.1.1.1', // Printer status (1=other, 2=unknown, 3=idle, 4=printing, 5=warmup)
  HR_DEVICE_STATUS: '1.3.6.1.2.1.25.3.2.1.5.1',  // Device status

  // Host Resources — CPU & Memory
  HR_PROCESSOR_LOAD: '1.3.6.1.2.1.25.3.3.1.2',    // CPU load % per core (walk)
  HR_STORAGE_DESCR: '1.3.6.1.2.1.25.2.3.1.3',     // Storage description (walk)
  HR_STORAGE_ALLOC_UNITS: '1.3.6.1.2.1.25.2.3.1.4', // Allocation unit size (walk)
  HR_STORAGE_SIZE: '1.3.6.1.2.1.25.2.3.1.5',       // Total size in alloc units (walk)
  HR_STORAGE_USED: '1.3.6.1.2.1.25.2.3.1.6',       // Used size in alloc units (walk)
  HR_STORAGE_TYPE: '1.3.6.1.2.1.25.2.3.1.2',       // Storage type OID (walk)
  HR_DEVICE_DESCR: '1.3.6.1.2.1.25.3.2.1.3',       // Device descriptions (walk) - CPU model, etc.
  HR_MEMORY_SIZE: '1.3.6.1.2.1.25.2.2.0',           // Total physical memory (KB)

  // Interfaces MIB (network)
  IF_DESCR: '1.3.6.1.2.1.2.2.1.2',         // Interface description (walk)
  IF_SPEED: '1.3.6.1.2.1.2.2.1.5',         // Interface speed in bits/sec (walk)
  IF_OPER_STATUS: '1.3.6.1.2.1.2.2.1.8',   // Operational status 1=up,2=down (walk)
  IF_IN_OCTETS: '1.3.6.1.2.1.2.2.1.10',    // Bytes received (walk)
  IF_OUT_OCTETS: '1.3.6.1.2.1.2.2.1.16',   // Bytes sent (walk)
  IF_IN_ERRORS: '1.3.6.1.2.1.2.2.1.14',    // Inbound errors (walk)
  IF_OUT_ERRORS: '1.3.6.1.2.1.2.2.1.20',   // Outbound errors (walk)
  IF_PHYS_ADDRESS: '1.3.6.1.2.1.2.2.1.6',  // MAC address (walk)

  // Printer MIB (RFC 3805)
  PRT_GENERAL_CURRENT_LOCALE: '1.3.6.1.2.1.43.5.1.1.2.1',
  PRT_COVER_STATUS: '1.3.6.1.2.1.43.6.1.1.3.1.1',  // Cover status
  PRT_ALERT_SEVERITY: '1.3.6.1.2.1.43.18.1.1.2',    // Alert severity
  PRT_ALERT_DESCRIPTION: '1.3.6.1.2.1.43.18.1.1.8', // Alert description
  PRT_ALERT_CODE: '1.3.6.1.2.1.43.18.1.1.7',        // Alert code (walk)
  PRT_ALERT_GROUP: '1.3.6.1.2.1.43.18.1.1.3',       // Alert group (walk)
  PRT_ALERT_TIME: '1.3.6.1.2.1.43.18.1.1.9',        // Alert time (walk)
  PRT_CONSOLE_DISPLAY: '1.3.6.1.2.1.43.16.5.1.2.1.1', // Display message

  // Marker Supplies (ink/toner)
  PRT_MARKER_SUPPLIES_DESC: '1.3.6.1.2.1.43.11.1.1.6',    // Supply description (walk)
  PRT_MARKER_SUPPLIES_MAX: '1.3.6.1.2.1.43.11.1.1.8',     // Max capacity (walk)
  PRT_MARKER_SUPPLIES_LEVEL: '1.3.6.1.2.1.43.11.1.1.9',   // Current level (walk)
  PRT_MARKER_SUPPLIES_TYPE: '1.3.6.1.2.1.43.11.1.1.4',     // Supply type (walk)
  PRT_MARKER_SUPPLIES_COLOR: '1.3.6.1.2.1.43.12.1.1.4',   // Colorant value (walk)
  PRT_MARKER_SUPPLIES_CLASS: '1.3.6.1.2.1.43.11.1.1.5',   // Supply class 1=other,3=consumed,4=filled (walk)
  PRT_MARKER_SUPPLIES_UNIT: '1.3.6.1.2.1.43.11.1.1.7',    // Capacity unit (walk)

  // Marker (print heads / marking engine)
  PRT_MARKER_COUNTER: '1.3.6.1.2.1.43.10.2.1.4',          // Page counter (walk)
  PRT_MARKER_TECHNOLOGY: '1.3.6.1.2.1.43.10.2.1.2',       // Marking technology (walk) — inkjet, thermal, etc.
  PRT_MARKER_PROCESS_COLORANTS: '1.3.6.1.2.1.43.10.2.1.3', // # process colorants (walk)
  PRT_MARKER_STATUS: '1.3.6.1.2.1.43.10.2.1.15',          // Marker status (walk)
  PRT_MARKER_RESOLUTION_FEED: '1.3.6.1.2.1.43.10.2.1.9',  // Feed resolution DPI (walk)
  PRT_MARKER_RESOLUTION_XFEED: '1.3.6.1.2.1.43.10.2.1.10', // Cross-feed resolution DPI (walk)
  PRT_MARKER_ADDRESSABILITY_FEED: '1.3.6.1.2.1.43.10.2.1.5', // Addressability unit feed (walk)
  PRT_MARKER_ADDRESSABILITY_XFEED: '1.3.6.1.2.1.43.10.2.1.6', // Addressability unit xfeed (walk)
  PRT_MARKER_SPEED: '1.3.6.1.2.1.43.10.2.1.7',            // Print speed (walk)
  PRT_MARKER_SPEED_UNIT: '1.3.6.1.2.1.43.10.2.1.8',       // Speed unit (walk)
  PRT_MARKER_COLORANT_ROLE: '1.3.6.1.2.1.43.10.2.1.7',    // Colorant role (walk)

  // Output bins
  PRT_OUTPUT_TYPE: '1.3.6.1.2.1.43.9.2.1.2',              // Output type (walk)
  PRT_OUTPUT_CAPACITY_UNIT: '1.3.6.1.2.1.43.9.2.1.3',     // Capacity unit (walk)
  PRT_OUTPUT_MAX_CAPACITY: '1.3.6.1.2.1.43.9.2.1.4',      // Max capacity (walk)
  PRT_OUTPUT_REMAINING: '1.3.6.1.2.1.43.9.2.1.5',         // Remaining capacity (walk)
  PRT_OUTPUT_STATUS: '1.3.6.1.2.1.43.9.2.1.6',            // Status (walk)
  PRT_OUTPUT_NAME: '1.3.6.1.2.1.43.9.2.1.7',              // Name (walk)
  PRT_OUTPUT_VENDOR: '1.3.6.1.2.1.43.9.2.1.8',            // Vendor name (walk)
  PRT_OUTPUT_DESCRIPTION: '1.3.6.1.2.1.43.9.2.1.12',      // Description (walk)
  PRT_OUTPUT_PAGES: '1.3.6.1.2.1.43.9.2.1.19',            // Pages delivered (walk)
  PRT_OUTPUT_DIM_FEED: '1.3.6.1.2.1.43.9.2.1.15',         // Feed dimension (walk)
  PRT_OUTPUT_DIM_XFEED: '1.3.6.1.2.1.43.9.2.1.16',        // Cross-feed dimension (walk)

  // Media paths
  PRT_MEDIA_PATH_TYPE: '1.3.6.1.2.1.43.13.4.1.9',         // Media path type (walk)
  PRT_MEDIA_PATH_DESCRIPTION: '1.3.6.1.2.1.43.13.4.1.10', // Media path description (walk)
  PRT_MEDIA_PATH_SPEED: '1.3.6.1.2.1.43.13.4.1.2',        // Max speed (walk)
  PRT_MEDIA_PATH_MAX_MEDIA_FEED: '1.3.6.1.2.1.43.13.4.1.3', // Max media feed dir (walk)
  PRT_MEDIA_PATH_MAX_MEDIA_XFEED: '1.3.6.1.2.1.43.13.4.1.4', // Max media xfeed dir (walk)

  // Print channels
  PRT_CHANNEL_TYPE: '1.3.6.1.2.1.43.14.1.1.2',            // Channel type (walk)
  PRT_CHANNEL_PROTOCOL: '1.3.6.1.2.1.43.14.1.1.3',        // Protocol (walk)
  PRT_CHANNEL_CURRENT_JOB: '1.3.6.1.2.1.43.14.1.1.7',     // Current job index (walk)
  PRT_CHANNEL_STATE: '1.3.6.1.2.1.43.14.1.1.8',           // Channel state (walk)

  // Console lights (LEDs)
  PRT_CONSOLE_LIGHT_ON: '1.3.6.1.2.1.43.17.6.1.2',        // Light on/off (walk)
  PRT_CONSOLE_LIGHT_DESC: '1.3.6.1.2.1.43.17.6.1.3',      // Description (walk)
  PRT_CONSOLE_LIGHT_COLOR: '1.3.6.1.2.1.43.17.6.1.4',     // Color (walk)

  // Colorant table
  PRT_COLORANT_VALUE: '1.3.6.1.2.1.43.12.1.1.4',          // Colorant value (walk) — duplicated from SUPPLIES_COLOR
  PRT_COLORANT_ROLE: '1.3.6.1.2.1.43.12.1.1.3',           // Colorant role (walk)

  // Input (media tray)
  PRT_INPUT_MEDIA_NAME: '1.3.6.1.2.1.43.8.2.1.12',   // Media name (walk)
  PRT_INPUT_CURRENT_LEVEL: '1.3.6.1.2.1.43.8.2.1.10', // Current media level (walk)
  PRT_INPUT_MAX_CAPACITY: '1.3.6.1.2.1.43.8.2.1.9',   // Max media capacity (walk)
  PRT_INPUT_MEDIA_DIMENSION_X: '1.3.6.1.2.1.43.8.2.1.4', // Media width
  PRT_INPUT_MEDIA_DIMENSION_Y: '1.3.6.1.2.1.43.8.2.1.5', // Media length
  PRT_INPUT_TYPE: '1.3.6.1.2.1.43.8.2.1.2',           // Input type (walk)
  PRT_INPUT_NAME: '1.3.6.1.2.1.43.8.2.1.13',          // Input name/description (walk)
  PRT_INPUT_STATUS: '1.3.6.1.2.1.43.8.2.1.11',        // Input status (walk)
};

// ============ Types ============

export interface PrinterLiveStatus {
  equipmentId: string;
  ipAddress: string;
  reachable: boolean;
  lastPolled: string;

  // Printer state
  state: 'idle' | 'printing' | 'warmup' | 'error' | 'offline' | 'unknown' | 'drying' | 'paused';
  stateMessage?: string; // Display message from printer

  // System info (from initial discovery)
  systemName?: string;
  systemDescription?: string;

  // Ink/supply levels
  supplies: SupplyLevel[];

  // Media info
  mediaLoaded?: string;

  // Alerts
  alerts: string[];

  // Error info
  errorMessage?: string;
}

export interface SupplyLevel {
  name: string;
  color: string;
  level: number; // 0-100 percentage, -1 = unknown, -2 = unknown capacity, -3 = level not reportable
  maxCapacity: number;
  currentLevel: number;
  type: string; // ink, toner, etc.
}

export interface DiscoveredPrinter {
  ipAddress: string;
  systemName: string;
  systemDescription: string;
  printerStatus: string;
  supplies: SupplyLevel[];
}

// ============ SNMP Helper Functions ============

function createSession(ipAddress: string, community: string = 'public', timeout: number = 3000): snmp.Session {
  return snmp.createSession(ipAddress, community, {
    timeout,
    retries: 1,
    version: snmp.Version2c,
  });
}

function snmpGet(session: snmp.Session, oids: string[]): Promise<snmp.VarBind[]> {
  return new Promise((resolve, reject) => {
    session.get(oids, (error: Error | null, varbinds: snmp.VarBind[]) => {
      if (error) {
        reject(error);
      } else {
        // Check for SNMP errors in varbinds
        const errors = varbinds.filter((vb) => snmp.isVarbindError(vb));
        if (errors.length === varbinds.length) {
          reject(new Error('All OIDs returned errors'));
        }
        resolve(varbinds);
      }
    });
  });
}

function snmpSubtreeWalk(session: snmp.Session, oid: string, timeoutMs: number = 10000): Promise<snmp.VarBind[]> {
  return new Promise((resolve) => {
    const results: snmp.VarBind[] = [];
    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(results); // Return whatever we have so far
      }
    }, timeoutMs);

    session.subtree(
      oid,
      20, // maxRepetitions
      (varbinds: snmp.VarBind[]) => {
        for (const vb of varbinds) {
          if (!snmp.isVarbindError(vb)) {
            results.push(vb);
          }
        }
      },
      (error?: Error) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve(results);
        }
      }
    );
  });
}

function varbindToString(vb: snmp.VarBind): string {
  if (snmp.isVarbindError(vb)) return '';
  if (Buffer.isBuffer(vb.value)) return vb.value.toString('utf8').replace(/\0/g, '').trim();
  return String(vb.value);
}

function varbindToNumber(vb: snmp.VarBind): number {
  if (snmp.isVarbindError(vb)) return -1;
  return typeof vb.value === 'number' ? vb.value : parseInt(String(vb.value), 10) || -1;
}

// ============ Printer Status Mapping ============

function mapPrinterStatus(hrStatus: number): PrinterLiveStatus['state'] {
  switch (hrStatus) {
    case 1: return 'unknown';  // other
    case 2: return 'unknown';  // unknown
    case 3: return 'idle';     // idle
    case 4: return 'printing'; // printing
    case 5: return 'warmup';   // warmup
    default: return 'unknown';
  }
}

// Map supply type OID value to human-readable
function mapSupplyType(typeValue: number): string {
  const types: Record<number, string> = {
    1: 'other', 2: 'unknown', 3: 'toner', 4: 'waste toner',
    5: 'ink', 6: 'ink cartridge', 7: 'ink ribbon', 8: 'waste ink',
    9: 'opc', 10: 'developer', 11: 'fuser oil', 12: 'solid wax',
    13: 'ribbon wax', 14: 'waste wax', 15: 'fuser', 16: 'corona wire',
    17: 'fuser oil pad', 18: 'cleaner unit', 19: 'fuser cleaning pad',
    20: 'transfer unit', 21: 'toner cartridge', 22: 'fuser oiler',
    23: 'water', 24: 'waste water', 25: 'glue water additive',
    26: 'waste paper', 27: 'binding supply', 28: 'banding supply',
    29: 'stitching wire', 30: 'shrink wrap', 31: 'paper wrap',
    32: 'staples', 33: 'inserts', 34: 'covers',
  };
  return types[typeValue] || 'supply';
}

// Guess ink color from supply description string
function guessColorFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('cyan') && lower.includes('light')) return '#87CEEB';
  if (lower.includes('magenta') && lower.includes('light')) return '#FFB6C1';
  if (lower.includes('cyan')) return '#00BFFF';
  if (lower.includes('magenta')) return '#FF00FF';
  if (lower.includes('yellow')) return '#FFD700';
  if (lower.includes('black') || lower.includes('matte')) return '#333333';
  if (lower.includes('white')) return '#FFFFFF';
  if (lower.includes('optimizer') || lower.includes('overcoat')) return '#E8E8E8';
  if (lower.includes('red')) return '#FF0000';
  if (lower.includes('blue')) return '#0000FF';
  if (lower.includes('green')) return '#00FF00';
  if (lower.includes('orange')) return '#FF8C00';
  if (lower.includes('primer')) return '#D4D4D4';
  return '#999999';
}

// ---- HP Part Number → Color Reference ----
// Verified against HP EWS supply pages on each printer.
//
// HP 871 (HP Latex 570):
//   G0Y79D = Cyan
//   G0Y80D = Magenta
//   G0Y81D = Yellow
//   G0Y82D = Black
//   G0Y83D = Light Cyan
//   G0Y84D = Light Magenta
//   G0Y85D = Latex Optimizer
//
// HP 873 (HP Latex 800W):
//   4UV84A = Black
//   4UV85A = Cyan
//   4UV86A = Magenta
//   4UV87A = Yellow
//   4UV88A = Light Cyan
//   4UV89A = Light Magenta
//   4UV90A = Optimizer
//   4UV91A = Overcoat
//   4UV62A = White
//
// HPITON (HPITSN) entries are internal reservoir tanks — duplicates of the above.

const HP_PART_COLOR_MAP: Record<string, { color: string; hex: string; displayName: string }> = {
  // HP 871 (Latex 570)
  'G0Y79D': { color: 'cyan',           hex: '#00BFFF', displayName: 'HP 871 Cyan' },
  'G0Y80D': { color: 'magenta',        hex: '#FF00FF', displayName: 'HP 871 Magenta' },
  'G0Y81D': { color: 'yellow',         hex: '#FFD700', displayName: 'HP 871 Yellow' },
  'G0Y82D': { color: 'black',          hex: '#333333', displayName: 'HP 871 Black' },
  'G0Y83D': { color: 'lightCyan',      hex: '#87CEEB', displayName: 'HP 871 Light Cyan' },
  'G0Y84D': { color: 'lightMagenta',   hex: '#FFB6C1', displayName: 'HP 871 Light Magenta' },
  'G0Y85D': { color: 'optimizer',      hex: '#D4D4D4', displayName: 'HP 871 Optimizer' },

  // HP 873 (Latex 800W)
  '4UV84A': { color: 'black',          hex: '#333333', displayName: 'HP 873 Black' },
  '4UV85A': { color: 'cyan',           hex: '#00BFFF', displayName: 'HP 873 Cyan' },
  '4UV86A': { color: 'magenta',        hex: '#FF00FF', displayName: 'HP 873 Magenta' },
  '4UV87A': { color: 'yellow',         hex: '#FFD700', displayName: 'HP 873 Yellow' },
  '4UV88A': { color: 'lightCyan',      hex: '#87CEEB', displayName: 'HP 873 Light Cyan' },
  '4UV89A': { color: 'lightMagenta',   hex: '#FFB6C1', displayName: 'HP 873 Light Magenta' },
  '4UV90A': { color: 'optimizer',      hex: '#E8E8E8', displayName: 'HP 873 Optimizer' },
  '4UV91A': { color: 'overcoat',       hex: '#F5F5F5', displayName: 'HP 873 Overcoat' },
  '4UV62A': { color: 'white',          hex: '#FFFFFF', displayName: 'HP 873 White' },
};

/**
 * Resolve the display name, color name, and hex color for a supply
 * using the part number extracted from the SNMP description string.
 */
function resolvePartColor(name: string, snmpColorHex: string | null): {
  displayName: string;
  color: string;
  hex: string;
} {
  // Try to extract part number from name like "HP 871 ( G0Y80D )"
  const partMatch = name.match(/\(\s*([A-Z0-9]+)\s*\)/);
  if (partMatch) {
    const info = HP_PART_COLOR_MAP[partMatch[1]];
    if (info) {
      return { displayName: info.displayName, color: info.color, hex: info.hex };
    }
  }
  // Fallback to SNMP colorant value or guess from name
  return {
    displayName: name,
    color: snmpColorHex || guessColorFromName(name),
    hex: guessColorFromName(name),
  };
}

// ============ Main Poll Functions ============

/**
 * Poll a single printer for its live status via SNMP.
 */
export async function pollPrinterStatus(
  equipmentId: string,
  ipAddress: string,
  community: string = 'public'
): Promise<PrinterLiveStatus> {
  const result: PrinterLiveStatus = {
    equipmentId,
    ipAddress,
    reachable: false,
    lastPolled: new Date().toISOString(),
    state: 'offline',
    supplies: [],
    alerts: [],
  };

  const session = createSession(ipAddress, community);

  try {
    // Step 1: Get basic printer status and system info
    const basicOids = [
      OID.SYS_DESCR,
      OID.SYS_NAME,
      OID.HR_PRINTER_STATUS,
    ];

    const basicResult = await snmpGet(session, basicOids);
    result.reachable = true;

    for (const vb of basicResult) {
      if (snmp.isVarbindError(vb)) continue;
      const oidStr = vb.oid;
      if (oidStr === OID.SYS_DESCR) result.systemDescription = varbindToString(vb);
      if (oidStr === OID.SYS_NAME) result.systemName = varbindToString(vb);
      if (oidStr === OID.HR_PRINTER_STATUS) result.state = mapPrinterStatus(varbindToNumber(vb));
    }

    // Step 2: Try to get display message
    try {
      const displayResult = await snmpGet(session, [OID.PRT_CONSOLE_DISPLAY]);
      for (const vb of displayResult) {
        if (!snmp.isVarbindError(vb)) {
          result.stateMessage = varbindToString(vb);
        }
      }
    } catch {
      // Not all printers support console display OID
    }

    // Step 3: Get supply/ink levels via subtree walk
    try {
      const [descs, maxLevels, currentLevels, types, colors] = await Promise.all([
        snmpSubtreeWalk(session, OID.PRT_MARKER_SUPPLIES_DESC),
        snmpSubtreeWalk(session, OID.PRT_MARKER_SUPPLIES_MAX),
        snmpSubtreeWalk(session, OID.PRT_MARKER_SUPPLIES_LEVEL),
        snmpSubtreeWalk(session, OID.PRT_MARKER_SUPPLIES_TYPE),
        snmpSubtreeWalk(session, OID.PRT_MARKER_SUPPLIES_COLOR),
      ]);

      // Track seen part numbers to deduplicate cartridge/reservoir pairs
      // HP Latex printers report each ink slot twice (Supply + Reservoir)
      const seenPartNumbers = new Set<string>();

      const count = Math.min(descs.length, maxLevels.length, currentLevels.length);
      for (let i = 0; i < count; i++) {
        const name = varbindToString(descs[i]);
        const max = varbindToNumber(maxLevels[i]);
        const current = varbindToNumber(currentLevels[i]);
        const typeVal = i < types.length ? varbindToNumber(types[i]) : 0;
        const snmpColorHex = i < colors.length ? varbindToString(colors[i]) : null;

        // Skip waste containers and non-visible supplies
        const typeName = mapSupplyType(typeVal);
        if (typeName.includes('waste')) continue;

        // Extract part number from description like "HP 871 ( G0Y80D )"
        const partMatch = name.match(/\(\s*([A-Z0-9]+)\s*\)/);
        const partNumber = partMatch ? partMatch[1] : null;

        // Skip HPITON / HPITSN reservoir entries (internal tank, duplicate of cartridge)
        if (name.includes('HPITON') || name.includes('HPITSN')) continue;

        // Deduplicate by part number (skip if cartridge already seen)
        if (partNumber) {
          if (seenPartNumbers.has(partNumber)) {
            continue;
          }
          seenPartNumbers.add(partNumber);
        }

        // Resolve color from part number (authoritative) or fall back to SNMP colorant
        const resolved = resolvePartColor(name, snmpColorHex);

        // Calculate percentage
        let level = -1;
        if (max > 0 && current >= 0) {
          level = Math.round((current / max) * 100);
        } else if (current === -3) {
          level = -1; // Level not reportable
        } else if (current === -2) {
          level = 100; // Unknown = assume full (some printers do this for non-trackable)
        }

        result.supplies.push({
          name: resolved.displayName,
          color: resolved.hex,
          level,
          maxCapacity: max,
          currentLevel: current,
          type: typeName,
        });
      }
    } catch {
      // Supply info not available — that's OK
    }

    // Step 4: Get alerts
    try {
      const alertDescs = await snmpSubtreeWalk(session, OID.PRT_ALERT_DESCRIPTION);
      for (const vb of alertDescs) {
        const msg = varbindToString(vb);
        if (msg && msg.length > 0 && !msg.match(/^\s*$/)) {
          result.alerts.push(msg);
        }
      }
    } catch {
      // Alerts not available
    }

  } catch (err: any) {
    // Printer not reachable or SNMP error
    result.reachable = false;
    result.state = 'offline';
    result.errorMessage = err.message || 'Failed to connect';
  } finally {
    session.close();
  }

  return result;
}

/**
 * Poll multiple printers in parallel.
 */
export async function pollAllPrinters(
  printers: Array<{ id: string; ipAddress: string; snmpCommunity?: string }>
): Promise<Map<string, PrinterLiveStatus>> {
  const results = new Map<string, PrinterLiveStatus>();

  const promises = printers.map(async (p) => {
    const status = await pollPrinterStatus(p.id, p.ipAddress, p.snmpCommunity || 'public');
    results.set(p.id, status);
  });

  await Promise.allSettled(promises);
  return results;
}

/**
 * Discover printers on a subnet by scanning common IPs.
 * Tries SNMP on each IP, returns those that respond as printers.
 */
export async function discoverPrintersOnSubnet(
  subnet: string = '192.168.254',
  startIp: number = 1,
  endIp: number = 254,
  community: string = 'public'
): Promise<DiscoveredPrinter[]> {
  const discovered: DiscoveredPrinter[] = [];
  const batchSize = 20; // Scan 20 IPs at a time

  for (let batch = startIp; batch <= endIp; batch += batchSize) {
    const end = Math.min(batch + batchSize - 1, endIp);
    const promises: Promise<void>[] = [];

    for (let i = batch; i <= end; i++) {
      const ip = `${subnet}.${i}`;
      promises.push(
        (async () => {
          try {
            const status = await pollPrinterStatus('discovery', ip, community);
            if (status.reachable) {
              discovered.push({
                ipAddress: ip,
                systemName: status.systemName || '',
                systemDescription: status.systemDescription || '',
                printerStatus: status.state,
                supplies: status.supplies,
              });
            }
          } catch {
            // Not a printer or not reachable
          }
        })()
      );
    }

    await Promise.allSettled(promises);
  }

  return discovered;
}

// ============ Ping & TCP Connectivity ============

/**
 * Ping a device using system ping command.
 * Returns true if the device responds within timeout.
 */
export function pingDevice(ipAddress: string, timeoutMs: number = 2000): Promise<boolean> {
  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    const cmd = isWindows
      ? `ping -n 1 -w ${timeoutMs} ${ipAddress}`
      : `ping -c 1 -W ${Math.ceil(timeoutMs / 1000)} ${ipAddress}`;

    exec(cmd, { timeout: timeoutMs + 2000 }, (error, stdout) => {
      if (error) {
        resolve(false);
        return;
      }
      // Check for "Reply from" (Windows) or "bytes from" (Linux)
      const success = /Reply from|bytes from|1 received/i.test(stdout);
      resolve(success);
    });
  });
}

/**
 * Probe a TCP port on a device.
 * Returns true if the port is open and accepts connections.
 */
export function tcpProbe(ipAddress: string, port: number, timeoutMs: number = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let resolved = false;

    const done = (result: boolean) => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve(result);
      }
    };

    socket.setTimeout(timeoutMs);
    socket.on('connect', () => done(true));
    socket.on('timeout', () => done(false));
    socket.on('error', () => done(false));
    socket.connect(port, ipAddress);
  });
}

/**
 * Try to get hostname via NetBIOS (nbtstat on Windows).
 */
export function getNetBIOSName(ipAddress: string): Promise<string | null> {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve(null);
      return;
    }
    exec(`nbtstat -A ${ipAddress}`, { timeout: 5000 }, (error, stdout) => {
      if (error) {
        resolve(null);
        return;
      }
      // Parse first UNIQUE <00> entry
      const match = stdout.match(/^\s+(\S+)\s+<00>\s+UNIQUE/m);
      resolve(match ? match[1].trim() : null);
    });
  });
}

/**
 * Comprehensive device connectivity check.
 * Supports multiple connection types: SNMP, PING, TCP, SMB, HTTP.
 */
export async function checkDeviceConnectivity(
  equipmentId: string,
  ipAddress: string,
  connectionType: string = 'PING', // SNMP | PING | TCP | SMB | HTTP
  snmpCommunity: string = 'public'
): Promise<PrinterLiveStatus> {
  const result: PrinterLiveStatus = {
    equipmentId,
    ipAddress,
    reachable: false,
    lastPolled: new Date().toISOString(),
    state: 'offline',
    supplies: [],
    alerts: [],
  };

  const connType = (connectionType || 'PING').toUpperCase();

  try {
    switch (connType) {
      case 'SNMP': {
        // Full SNMP poll (existing logic)
        return await pollPrinterStatus(equipmentId, ipAddress, snmpCommunity);
      }

      case 'SMB':
      case 'TCP': {
        // Probe SMB (port 445) or fall back to ping
        const port = connType === 'SMB' ? 445 : 445; // Default to SMB for TCP too
        const portOpen = await tcpProbe(ipAddress, port, 3000);
        result.reachable = portOpen;
        result.state = portOpen ? 'idle' : 'offline';

        // If port 445 open, try to get hostname via NetBIOS
        if (portOpen) {
          const hostname = await getNetBIOSName(ipAddress);
          if (hostname) {
            result.systemName = hostname;
          }
        }

        // Also try SNMP as bonus (some devices support both)
        if (!portOpen) {
          const pingOk = await pingDevice(ipAddress, 2000);
          result.reachable = pingOk;
          result.state = pingOk ? 'idle' : 'offline';
        }
        break;
      }

      case 'SSH': {
        // Probe SSH port 22 - ideal for Linux-based devices (e.g., VUTEk printers)
        const sshOpen = await tcpProbe(ipAddress, 22, 3000);
        result.reachable = sshOpen;
        result.state = sshOpen ? 'idle' : 'offline';

        if (sshOpen) {
          // Try to get hostname via NetBIOS (some Linux devices run Samba)
          const hostname = await getNetBIOSName(ipAddress);
          if (hostname) {
            result.systemName = hostname;
          }
          // Also check if VNC is available (port 5900) - indicates active display
          const vncOpen = await tcpProbe(ipAddress, 5900, 1500);
          if (vncOpen) {
            result.stateMessage = 'VNC remote display available';
          }
        }

        // Fallback to ping if SSH port is closed
        if (!sshOpen) {
          const pingOk = await pingDevice(ipAddress, 2000);
          result.reachable = pingOk;
          result.state = pingOk ? 'idle' : 'offline';
        }
        break;
      }

      case 'HTTP': {
        // Try HTTP port 80 or 443
        const http80 = await tcpProbe(ipAddress, 80, 2000);
        const https443 = http80 ? false : await tcpProbe(ipAddress, 443, 2000);
        result.reachable = http80 || https443;
        result.state = result.reachable ? 'idle' : 'offline';
        if (result.reachable) {
          result.stateMessage = http80 ? 'HTTP service running' : 'HTTPS service running';
        }
        break;
      }

      case 'PING':
      default: {
        // Simple ping check
        const alive = await pingDevice(ipAddress, 2000);
        result.reachable = alive;
        result.state = alive ? 'idle' : 'offline';

        // If alive, try to get hostname
        if (alive) {
          const hostname = await getNetBIOSName(ipAddress);
          if (hostname) {
            result.systemName = hostname;
          }
        }
        break;
      }
    }
  } catch (err: any) {
    result.reachable = false;
    result.state = 'offline';
    result.errorMessage = err.message || 'Connectivity check failed';
  }

  return result;
}

/**
 * Poll all equipment with IPs - uses appropriate method per connectionType.
 */
export async function pollAllEquipment(
  equipment: Array<{ id: string; ipAddress: string; connectionType?: string | null; snmpCommunity?: string }>
): Promise<Map<string, PrinterLiveStatus>> {
  const results = new Map<string, PrinterLiveStatus>();

  const promises = equipment.map(async (e) => {
    const connType = e.connectionType || 'PING';
    const status = connType === 'SNMP'
      ? await pollPrinterStatus(e.id, e.ipAddress, e.snmpCommunity || 'public')
      : await checkDeviceConnectivity(e.id, e.ipAddress, connType, e.snmpCommunity || 'public');
    results.set(e.id, status);
  });

  await Promise.allSettled(promises);
  return results;
}

// ============ Deep Poll (Extended SNMP Data) ============

export interface DeepPrinterData {
  uptime: string | null;          // Human-readable uptime
  uptimeTicks: number | null;     // Raw ticks
  pageCount: number | null;       // Total pages printed
  coverStatus: string | null;     // Cover open/closed
  mediaTrays: Array<{
    name: string;
    currentLevel: number;
    maxCapacity: number;
    width: number | null;         // Media width in tenths of mm
    height: number | null;        // Media height in tenths of mm
  }>;
  consoleDisplay: string | null;  // LCD display message
  alertSeverities: Array<{ severity: number; description: string; code?: number; group?: number; time?: number }>;

  // ---- System Hardware ----
  cpu: {
    model: string | null;         // CPU model string from hrDeviceDescr
    coreLoads: number[];          // Per-core CPU load percentages
    averageLoad: number | null;   // Average across all cores
  } | null;
  memory: {
    totalKb: number | null;       // Physical memory in KB
  } | null;
  storage: Array<{
    description: string;          // Mount point / description (e.g., "/data", "Physical Memory")
    totalBytes: number;           // Total capacity in bytes
    usedBytes: number;            // Used in bytes
    usedPercent: number;          // Used percentage
    type: string;                 // hrStorageType mapped
  }>;

  // ---- Network Interfaces ----
  networkInterfaces: Array<{
    description: string;          // Interface description (e.g., "eth0")
    speed: number;                // Speed in bits/sec
    operStatus: string;           // 'up' | 'down' | 'testing'
    inBytes: number;              // Total bytes received
    outBytes: number;             // Total bytes sent
    inErrors: number;             // Inbound error count
    outErrors: number;            // Outbound error count
    macAddress: string | null;    // Physical address
  }>;

  // ---- Print Heads / Markers ----
  markers: Array<{
    technology: string;           // "inkjet", "thermal", "electrophotographic", etc.
    processColorants: number;     // Number of colors used by this marker
    feedResolutionDpi: number;    // DPI in feed direction
    crossFeedResolutionDpi: number; // DPI in cross-feed direction
    speed: number;                // Print speed
    speedUnit: string;            // Speed unit description
    status: string;               // Marker operational status
  }>;

  // ---- Output Bins ----
  outputBins: Array<{
    name: string;                 // Bin name (e.g., "Default", "TakeUpReel")
    description: string;          // Bin description
    type: string;                 // Output type
    vendor: string;               // Vendor
    maxCapacity: number;          // Max capacity
    remaining: number;            // Remaining capacity
    status: string;               // Status
    pagesDelivered: number;       // Total pages delivered to this bin
    feedDimension: number;        // Feed direction max dimension
    crossFeedDimension: number;   // Cross-feed direction max dimension
  }>;

  // ---- Media Paths ----
  mediaPaths: Array<{
    description: string;
    type: string;                 // Media path type
    maxSpeed: number;             // Max pages/min or similar
    maxMediaFeed: number;         // Max media size feed direction
    maxMediaXfeed: number;        // Max media size cross-feed direction
  }>;

  // ---- Print Channels ----
  channels: Array<{
    type: string;                 // Channel type (e.g., "TCP/IP", "USB")
    protocol: string;             // Protocol
    currentJobIndex: number;      // Current job being processed
    state: string;                // Channel state
  }>;

  // ---- Console Lights (LEDs) ----
  consoleLights: Array<{
    isOn: boolean;
    description: string;
    color: string;
  }>;

  // ---- System Info ----
  systemContact: string | null;
  systemLocation: string | null;
}

/**
 * Deep poll a printer for extended data — everything the printer exposes via SNMP.
 * Collects: uptime, page counters, media trays, cover status, CPU/memory/disk,
 * network interfaces, print heads, output bins, media paths, channels, LEDs.
 * This is separate from the regular poll to avoid slowing down the 15s interval.
 */
export async function deepPollPrinterStatus(
  ipAddress: string,
  community: string = 'public'
): Promise<DeepPrinterData> {
  const result: DeepPrinterData = {
    uptime: null,
    uptimeTicks: null,
    pageCount: null,
    coverStatus: null,
    mediaTrays: [],
    consoleDisplay: null,
    alertSeverities: [],
    cpu: null,
    memory: null,
    storage: [],
    networkInterfaces: [],
    markers: [],
    outputBins: [],
    mediaPaths: [],
    channels: [],
    consoleLights: [],
    systemContact: null,
    systemLocation: null,
  };

  // Use shorter timeout for deep poll — subtree walks wait up to timeout for end-of-subtree detection
  const session = createSession(ipAddress, community, 2000);

  // Map for SNMP enums
  const markerTechMap: Record<number, string> = {
    1: 'other', 2: 'unknown', 3: 'electrophotographic-LED', 4: 'electrophotographic-laser',
    5: 'electrophotographic-other', 6: 'impact-moving-head-dot-matrix-9pin',
    7: 'impact-moving-head-dot-matrix-24pin', 8: 'impact-moving-head-dot-matrix-other',
    9: 'impact-moving-head-fully-formed', 10: 'impact-band', 11: 'impact-other',
    12: 'inkjet-aqueous', 13: 'inkjet-solid', 14: 'inkjet-other',
    15: 'pen', 16: 'thermal-transfer', 17: 'thermal-sensitive', 18: 'thermal-diffusion',
    19: 'thermal-other', 20: 'electroerosion', 21: 'electrostatic',
    22: 'photographic-microcapsule', 23: 'photographic-other', 24: 'ion-deposition',
    25: 'e-beam', 26: 'typesetter',
  };

  const speedUnitMap: Record<number, string> = {
    3: 'tenths-ppm', 4: 'inches/min', 5: 'cm/min', 7: 'impressions/hr',
    8: 'feet/min', 9: 'meters/min',
  };

  const outputTypeMap: Record<number, string> = {
    1: 'other', 2: 'unknown', 3: 'removable-bin', 4: 'unremovable-bin',
    5: 'continuous-roll', 6: 'mail-box', 7: 'continuous-fan-fold',
  };

  const channelTypeMap: Record<number, string> = {
    1: 'other', 3: 'chLangDecoder', 4: 'chPort9100',
    5: 'chAppSocket', 7: 'chDLCLLC', 8: 'chIBM3270',
    9: 'chIBM5250', 10: 'chFax', 11: 'chIEEE1284Port',
    12: 'chUSB', 13: 'chBidirPortTCP', 14: 'chUNPP',
    26: 'chAppleTalkPAP', 27: 'chLPDServer', 28: 'chNetwareRPrinter',
    29: 'chNetwarePServer', 30: 'chPort631', 31: 'chIPP',
    32: 'chWebServer', 33: 'chFTP', 34: 'chSMTP', 35: 'chPOP3',
  };

  const channelStateMap: Record<number, string> = {
    1: 'other', 3: 'printDataAccepted', 4: 'noDataAccepted',
  };

  const mediaPathTypeMap: Record<number, string> = {
    1: 'other', 2: 'unknown', 3: 'longEdgeBindingDuplex', 4: 'shortEdgeBindingDuplex',
    5: 'simplex',
  };

  const operStatusMap: Record<number, string> = {
    1: 'up', 2: 'down', 3: 'testing', 4: 'unknown', 5: 'dormant', 6: 'notPresent', 7: 'lowerLayerDown',
  };

  const markerStatusMap: Record<number, string> = {
    0: 'available', 2: 'broken', 4: 'onRequest', 5: 'standby', 13: 'idle',
  };

  const storageTypeMap: Record<string, string> = {
    '1.3.6.1.2.1.25.2.1.1': 'other',
    '1.3.6.1.2.1.25.2.1.2': 'ram',
    '1.3.6.1.2.1.25.2.1.3': 'virtualMemory',
    '1.3.6.1.2.1.25.2.1.4': 'fixedDisk',
    '1.3.6.1.2.1.25.2.1.5': 'removableDisk',
    '1.3.6.1.2.1.25.2.1.6': 'floppyDisk',
    '1.3.6.1.2.1.25.2.1.7': 'compactDisc',
    '1.3.6.1.2.1.25.2.1.8': 'ramDisk',
    '1.3.6.1.2.1.25.2.1.9': 'flashMemory',
    '1.3.6.1.2.1.25.2.1.10': 'networkDisk',
  };

  try {
    // ── Group A: Run scalar OIDs, cover, console, page counter, trays, and alerts in parallel ──
    await Promise.allSettled([
      // 1. Basic scalar OIDs (uptime, contact, location, memory)
      (async () => {
        const scalarOids = [
          OID.SYS_UPTIME,
          OID.SYS_CONTACT,
          OID.SYS_LOCATION,
          OID.HR_MEMORY_SIZE,
        ];
        const scalarResult = await snmpGet(session, scalarOids);
        for (const vb of scalarResult) {
          if (snmp.isVarbindError(vb)) continue;
          if (vb.oid === OID.SYS_UPTIME) {
            const ticks = varbindToNumber(vb);
            result.uptimeTicks = ticks;
            const totalSec = Math.floor(ticks / 100);
            const days = Math.floor(totalSec / 86400);
            const hours = Math.floor((totalSec % 86400) / 3600);
            const mins = Math.floor((totalSec % 3600) / 60);
            result.uptime = days > 0
              ? `${days}d ${hours}h ${mins}m`
              : hours > 0
              ? `${hours}h ${mins}m`
              : `${mins}m`;
          }
          if (vb.oid === OID.SYS_CONTACT) {
            const v = varbindToString(vb);
            if (v) result.systemContact = v;
          }
          if (vb.oid === OID.SYS_LOCATION) {
            const v = varbindToString(vb);
            if (v) result.systemLocation = v;
          }
          if (vb.oid === OID.HR_MEMORY_SIZE) {
            const memKb = varbindToNumber(vb);
            if (memKb > 0) result.memory = { totalKb: memKb };
          }
        }
      })().catch(() => {}),

      // 2. Cover status
      (async () => {
        const coverResult = await snmpGet(session, [OID.PRT_COVER_STATUS]);
        for (const vb of coverResult) {
          if (!snmp.isVarbindError(vb)) {
            const val = varbindToNumber(vb);
            const coverMap: Record<number, string> = {
              1: 'Other', 2: 'Unknown', 3: 'Open', 4: 'Closed',
              5: 'Interlock Open', 6: 'Interlock Closed',
            };
            result.coverStatus = coverMap[val] || `Unknown (${val})`;
          }
        }
      })().catch(() => {}),

      // 3. Console display
      (async () => {
        const displayResult = await snmpGet(session, [OID.PRT_CONSOLE_DISPLAY]);
        for (const vb of displayResult) {
          if (!snmp.isVarbindError(vb)) {
            result.consoleDisplay = varbindToString(vb);
          }
        }
      })().catch(() => {}),

      // 4. Page counter
      (async () => {
        const counterResults = await snmpSubtreeWalk(session, OID.PRT_MARKER_COUNTER);
        if (counterResults.length > 0) {
          let maxCount = 0;
          for (const vb of counterResults) {
            const val = varbindToNumber(vb);
            if (val > maxCount) maxCount = val;
          }
          result.pageCount = maxCount > 0 ? maxCount : null;
        }
      })().catch(() => {}),

      // 5. Media/input trays
      (async () => {
        const [trayNames, trayLevels, trayMax, trayWidths, trayHeights] = await Promise.all([
          snmpSubtreeWalk(session, OID.PRT_INPUT_MEDIA_NAME),
          snmpSubtreeWalk(session, OID.PRT_INPUT_CURRENT_LEVEL),
          snmpSubtreeWalk(session, OID.PRT_INPUT_MAX_CAPACITY),
          snmpSubtreeWalk(session, OID.PRT_INPUT_MEDIA_DIMENSION_X),
          snmpSubtreeWalk(session, OID.PRT_INPUT_MEDIA_DIMENSION_Y),
        ]);

        const count = Math.max(trayNames.length, trayLevels.length);
        for (let i = 0; i < count; i++) {
          const name = i < trayNames.length ? varbindToString(trayNames[i]) : `Tray ${i + 1}`;
          const level = i < trayLevels.length ? varbindToNumber(trayLevels[i]) : -1;
          const max = i < trayMax.length ? varbindToNumber(trayMax[i]) : -1;
          const width = i < trayWidths.length ? varbindToNumber(trayWidths[i]) : null;
          const height = i < trayHeights.length ? varbindToNumber(trayHeights[i]) : null;

          if (name || level >= 0) {
            result.mediaTrays.push({
              name: name || `Tray ${i + 1}`,
              currentLevel: level,
              maxCapacity: max,
              width: width && width > 0 ? width : null,
              height: height && height > 0 ? height : null,
            });
          }
        }
      })().catch(() => {}),

      // 6. Alert severities
      (async () => {
        const [severities, descriptions, codes, groups, times] = await Promise.all([
          snmpSubtreeWalk(session, OID.PRT_ALERT_SEVERITY),
          snmpSubtreeWalk(session, OID.PRT_ALERT_DESCRIPTION),
          snmpSubtreeWalk(session, OID.PRT_ALERT_CODE).catch(() => [] as snmp.VarBind[]),
          snmpSubtreeWalk(session, OID.PRT_ALERT_GROUP).catch(() => [] as snmp.VarBind[]),
          snmpSubtreeWalk(session, OID.PRT_ALERT_TIME).catch(() => [] as snmp.VarBind[]),
        ]);
        const count = Math.min(severities.length, descriptions.length);
        for (let i = 0; i < count; i++) {
          const sev = varbindToNumber(severities[i]);
          const desc = varbindToString(descriptions[i]);
          if (desc) {
            result.alertSeverities.push({
              severity: sev,
              description: desc,
              code: i < codes.length ? varbindToNumber(codes[i]) : undefined,
              group: i < groups.length ? varbindToNumber(groups[i]) : undefined,
              time: i < times.length ? varbindToNumber(times[i]) : undefined,
            });
          }
        }
      })().catch(() => {}),
    ]);
    await Promise.allSettled([
      // 7. CPU info
      (async () => {
        const [deviceDescrs, cpuLoads] = await Promise.all([
          snmpSubtreeWalk(session, OID.HR_DEVICE_DESCR),
          snmpSubtreeWalk(session, OID.HR_PROCESSOR_LOAD),
        ]);
        let cpuModel: string | null = null;
        for (const vb of deviceDescrs) {
          const desc = varbindToString(vb);
          if (desc && (desc.includes('CPU') || desc.includes('Processor') || desc.includes('Intel') || desc.includes('AMD') || desc.includes('ARM'))) {
            cpuModel = desc;
            break;
          }
        }
        const coreLoads = cpuLoads
          .filter(vb => !snmp.isVarbindError(vb))
          .map(vb => varbindToNumber(vb))
          .filter(v => v >= 0 && v <= 100);
        if (cpuModel || coreLoads.length > 0) {
          result.cpu = {
            model: cpuModel,
            coreLoads,
            averageLoad: coreLoads.length > 0
              ? Math.round(coreLoads.reduce((a, b) => a + b, 0) / coreLoads.length)
              : null,
          };
        }
      })().catch(() => {}),

      // 8. Storage
      (async () => {
        const [descrs, allocUnits, sizes, used, stTypes] = await Promise.all([
          snmpSubtreeWalk(session, OID.HR_STORAGE_DESCR),
          snmpSubtreeWalk(session, OID.HR_STORAGE_ALLOC_UNITS),
          snmpSubtreeWalk(session, OID.HR_STORAGE_SIZE),
          snmpSubtreeWalk(session, OID.HR_STORAGE_USED),
          snmpSubtreeWalk(session, OID.HR_STORAGE_TYPE).catch(() => [] as snmp.VarBind[]),
        ]);
        const count = Math.min(descrs.length, allocUnits.length, sizes.length, used.length);
        for (let i = 0; i < count; i++) {
          const desc = varbindToString(descrs[i]);
          const allocUnit = varbindToNumber(allocUnits[i]);
          const totalUnits = varbindToNumber(sizes[i]);
          const usedUnits = varbindToNumber(used[i]);
          const typeOid = i < stTypes.length ? varbindToString(stTypes[i]) : '';
          if (desc && allocUnit > 0 && totalUnits > 0) {
            const totalBytes = allocUnit * totalUnits;
            const usedB = allocUnit * usedUnits;
            result.storage.push({
              description: desc,
              totalBytes,
              usedBytes: usedB,
              usedPercent: totalBytes > 0 ? Math.round((usedB / totalBytes) * 100) : 0,
              type: storageTypeMap[typeOid] || 'unknown',
            });
          }
        }
      })().catch(() => {}),

      // 9. Network interfaces
      (async () => {
        const [ifDescrs, ifSpeeds, ifOper, ifIn, ifOut, ifInErr, ifOutErr, ifMac] = await Promise.all([
          snmpSubtreeWalk(session, OID.IF_DESCR),
          snmpSubtreeWalk(session, OID.IF_SPEED),
          snmpSubtreeWalk(session, OID.IF_OPER_STATUS),
          snmpSubtreeWalk(session, OID.IF_IN_OCTETS),
          snmpSubtreeWalk(session, OID.IF_OUT_OCTETS),
          snmpSubtreeWalk(session, OID.IF_IN_ERRORS).catch(() => [] as snmp.VarBind[]),
          snmpSubtreeWalk(session, OID.IF_OUT_ERRORS).catch(() => [] as snmp.VarBind[]),
          snmpSubtreeWalk(session, OID.IF_PHYS_ADDRESS).catch(() => [] as snmp.VarBind[]),
        ]);
        const count = Math.min(ifDescrs.length, ifSpeeds.length, ifOper.length);
        for (let i = 0; i < count; i++) {
          const desc = varbindToString(ifDescrs[i]);
          const speed = varbindToNumber(ifSpeeds[i]);
          const oper = varbindToNumber(ifOper[i]);
          if (desc && desc.toLowerCase() === 'lo') continue;
          if (desc) {
            let mac: string | null = null;
            if (i < ifMac.length && !snmp.isVarbindError(ifMac[i]) && Buffer.isBuffer(ifMac[i].value)) {
              const buf = ifMac[i].value as Buffer;
              if (buf.length === 6) mac = Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join(':');
            }
            result.networkInterfaces.push({
              description: desc,
              speed,
              operStatus: operStatusMap[oper] || `unknown(${oper})`,
              inBytes: i < ifIn.length ? varbindToNumber(ifIn[i]) : 0,
              outBytes: i < ifOut.length ? varbindToNumber(ifOut[i]) : 0,
              inErrors: i < ifInErr.length ? varbindToNumber(ifInErr[i]) : 0,
              outErrors: i < ifOutErr.length ? varbindToNumber(ifOutErr[i]) : 0,
              macAddress: mac,
            });
          }
        }
      })().catch(() => {}),
    ]);

    // Sections 10-14: Printer MIB data — separate group to avoid SNMP agent overload
    await Promise.allSettled([
      // 10. Print markers
      (async () => {
        const [techVbs, colorantVbs, feedResVbs, xfeedResVbs, speedVbs, speedUnitVbs, statusVbs] = await Promise.all([
          snmpSubtreeWalk(session, OID.PRT_MARKER_TECHNOLOGY),
          snmpSubtreeWalk(session, OID.PRT_MARKER_PROCESS_COLORANTS),
          snmpSubtreeWalk(session, OID.PRT_MARKER_RESOLUTION_FEED),
          snmpSubtreeWalk(session, OID.PRT_MARKER_RESOLUTION_XFEED),
          snmpSubtreeWalk(session, OID.PRT_MARKER_SPEED),
          snmpSubtreeWalk(session, OID.PRT_MARKER_SPEED_UNIT).catch(() => [] as snmp.VarBind[]),
          snmpSubtreeWalk(session, OID.PRT_MARKER_STATUS).catch(() => [] as snmp.VarBind[]),
        ]);
        for (let i = 0; i < techVbs.length; i++) {
          const tech = varbindToNumber(techVbs[i]);
          result.markers.push({
            technology: markerTechMap[tech] || `unknown(${tech})`,
            processColorants: i < colorantVbs.length ? varbindToNumber(colorantVbs[i]) : 0,
            feedResolutionDpi: i < feedResVbs.length ? varbindToNumber(feedResVbs[i]) : 0,
            crossFeedResolutionDpi: i < xfeedResVbs.length ? varbindToNumber(xfeedResVbs[i]) : 0,
            speed: i < speedVbs.length ? varbindToNumber(speedVbs[i]) : 0,
            speedUnit: i < speedUnitVbs.length ? (speedUnitMap[varbindToNumber(speedUnitVbs[i])] || 'unknown') : 'unknown',
            status: i < statusVbs.length ? (markerStatusMap[varbindToNumber(statusVbs[i])] || `unknown(${varbindToNumber(statusVbs[i])})`) : 'unknown',
          });
        }
      })().catch(() => {}),

      // 11. Output bins
      (async () => {
        const [outTypes, outNames, outDescs, outMax, outRemain, outStatus, outPages, outVendors, outFeed, outXfeed] = await Promise.all([
          snmpSubtreeWalk(session, OID.PRT_OUTPUT_TYPE),
          snmpSubtreeWalk(session, OID.PRT_OUTPUT_NAME),
          snmpSubtreeWalk(session, OID.PRT_OUTPUT_DESCRIPTION),
          snmpSubtreeWalk(session, OID.PRT_OUTPUT_MAX_CAPACITY),
          snmpSubtreeWalk(session, OID.PRT_OUTPUT_REMAINING),
          snmpSubtreeWalk(session, OID.PRT_OUTPUT_STATUS),
          snmpSubtreeWalk(session, OID.PRT_OUTPUT_PAGES).catch(() => [] as snmp.VarBind[]),
          snmpSubtreeWalk(session, OID.PRT_OUTPUT_VENDOR).catch(() => [] as snmp.VarBind[]),
          snmpSubtreeWalk(session, OID.PRT_OUTPUT_DIM_FEED).catch(() => [] as snmp.VarBind[]),
          snmpSubtreeWalk(session, OID.PRT_OUTPUT_DIM_XFEED).catch(() => [] as snmp.VarBind[]),
        ]);
        for (let i = 0; i < outNames.length; i++) {
          const name = varbindToString(outNames[i]);
          result.outputBins.push({
            name: name || `Bin ${i + 1}`,
            description: i < outDescs.length ? varbindToString(outDescs[i]) : '',
            type: i < outTypes.length ? (outputTypeMap[varbindToNumber(outTypes[i])] || 'unknown') : 'unknown',
            vendor: i < outVendors.length ? varbindToString(outVendors[i]) : '',
            maxCapacity: i < outMax.length ? varbindToNumber(outMax[i]) : -1,
            remaining: i < outRemain.length ? varbindToNumber(outRemain[i]) : -1,
            status: i < outStatus.length ? String(varbindToNumber(outStatus[i])) : 'unknown',
            pagesDelivered: i < outPages.length ? varbindToNumber(outPages[i]) : 0,
            feedDimension: i < outFeed.length ? varbindToNumber(outFeed[i]) : 0,
            crossFeedDimension: i < outXfeed.length ? varbindToNumber(outXfeed[i]) : 0,
          });
        }
      })().catch(() => {}),

      // 12. Media paths + 13. Channels + 14. Console lights (smaller walks, combined)
      (async () => {
        const [mpDescs, mpTypes, mpSpeeds, mpFeed, mpXfeed] = await Promise.all([
          snmpSubtreeWalk(session, OID.PRT_MEDIA_PATH_DESCRIPTION),
          snmpSubtreeWalk(session, OID.PRT_MEDIA_PATH_TYPE),
          snmpSubtreeWalk(session, OID.PRT_MEDIA_PATH_SPEED),
          snmpSubtreeWalk(session, OID.PRT_MEDIA_PATH_MAX_MEDIA_FEED),
          snmpSubtreeWalk(session, OID.PRT_MEDIA_PATH_MAX_MEDIA_XFEED),
        ]);
        const mpCount = Math.max(mpDescs.length, mpTypes.length);
        for (let i = 0; i < mpCount; i++) {
          result.mediaPaths.push({
            description: i < mpDescs.length ? varbindToString(mpDescs[i]) : `Path ${i + 1}`,
            type: i < mpTypes.length ? (mediaPathTypeMap[varbindToNumber(mpTypes[i])] || `type(${varbindToNumber(mpTypes[i])})`) : 'unknown',
            maxSpeed: i < mpSpeeds.length ? varbindToNumber(mpSpeeds[i]) : 0,
            maxMediaFeed: i < mpFeed.length ? varbindToNumber(mpFeed[i]) : 0,
            maxMediaXfeed: i < mpXfeed.length ? varbindToNumber(mpXfeed[i]) : 0,
          });
        }
      })().catch(() => {}),

      (async () => {
        const [chTypes, chProtos, chJobs, chStates] = await Promise.all([
          snmpSubtreeWalk(session, OID.PRT_CHANNEL_TYPE),
          snmpSubtreeWalk(session, OID.PRT_CHANNEL_PROTOCOL).catch(() => [] as snmp.VarBind[]),
          snmpSubtreeWalk(session, OID.PRT_CHANNEL_CURRENT_JOB).catch(() => [] as snmp.VarBind[]),
          snmpSubtreeWalk(session, OID.PRT_CHANNEL_STATE).catch(() => [] as snmp.VarBind[]),
        ]);
        for (let i = 0; i < chTypes.length; i++) {
          const typeVal = varbindToNumber(chTypes[i]);
          result.channels.push({
            type: channelTypeMap[typeVal] || `type(${typeVal})`,
            protocol: i < chProtos.length ? varbindToString(chProtos[i]) : '',
            currentJobIndex: i < chJobs.length ? varbindToNumber(chJobs[i]) : 0,
            state: i < chStates.length ? (channelStateMap[varbindToNumber(chStates[i])] || `state(${varbindToNumber(chStates[i])})`) : 'unknown',
          });
        }
      })().catch(() => {}),

      (async () => {
        const [lightOn, lightDesc, lightColor] = await Promise.all([
          snmpSubtreeWalk(session, OID.PRT_CONSOLE_LIGHT_ON),
          snmpSubtreeWalk(session, OID.PRT_CONSOLE_LIGHT_DESC).catch(() => [] as snmp.VarBind[]),
          snmpSubtreeWalk(session, OID.PRT_CONSOLE_LIGHT_COLOR).catch(() => [] as snmp.VarBind[]),
        ]);
        for (let i = 0; i < lightOn.length; i++) {
          result.consoleLights.push({
            isOn: varbindToNumber(lightOn[i]) === 1,
            description: i < lightDesc.length ? varbindToString(lightDesc[i]) : `LED ${i + 1}`,
            color: i < lightColor.length ? varbindToString(lightColor[i]) : 'unknown',
          });
        }
      })().catch(() => {}),
    ]);

  } catch {
    // Unable to deep poll
  } finally {
    session.close();
  }

  return result;
}

// ============ Status Cache (in-memory) ============

const statusCache = new Map<string, PrinterLiveStatus>();
let lastPollTime = 0;
const POLL_INTERVAL_MS = 15000; // 15 seconds

export function getCachedStatus(equipmentId: string): PrinterLiveStatus | undefined {
  return statusCache.get(equipmentId);
}

export function getAllCachedStatuses(): Map<string, PrinterLiveStatus> {
  return statusCache;
}

export function setCachedStatus(equipmentId: string, status: PrinterLiveStatus): void {
  statusCache.set(equipmentId, status);
}

export function getLastPollTime(): number {
  return lastPollTime;
}

export function setLastPollTime(time: number): void {
  lastPollTime = time;
}

// ─── EWS/LEDM data cache (printheads, maintenance, rich ink) ─────────────

const ewsDataCache = new Map<string, { data: EWSData; cachedAt: number }>();
const EWS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function getCachedEWSData(equipmentId: string): EWSData | null {
  const entry = ewsDataCache.get(equipmentId);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > EWS_CACHE_TTL_MS) return null;
  return entry.data;
}

export function getAllCachedEWSData(): Map<string, EWSData> {
  const result = new Map<string, EWSData>();
  const now = Date.now();
  for (const [id, entry] of ewsDataCache) {
    if (now - entry.cachedAt <= EWS_CACHE_TTL_MS) {
      result.set(id, entry.data);
    }
  }
  return result;
}

export function setCachedEWSData(equipmentId: string, data: EWSData): void {
  ewsDataCache.set(equipmentId, { data, cachedAt: Date.now() });
}

export { POLL_INTERVAL_MS };
