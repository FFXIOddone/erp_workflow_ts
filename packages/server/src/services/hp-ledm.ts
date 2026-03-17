/**
 * HP Latex LEDM (Lightweight Embedded Device Manager) Service
 * 
 * Polls older HP Latex printers (e.g., 570) via their built-in LEDM XML endpoints.
 * These printers use HTTP XML APIs at /DevMgmt/*.xml instead of the newer
 * HTTPS JSON APIs (/LFPWebServices/PI/*.json) used by the HP Latex 800W.
 * 
 * Supported endpoints:
 * - /DevMgmt/ProductConfigDyn.xml    → Identity (model, serial, firmware, part#)
 * - /DevMgmt/ProductStatusDyn.xml    → Device status & alerts
 * - /DevMgmt/ConsumableConfigDyn.xml → Ink cartridges + printheads
 * - /DevMgmt/ProductUsageDyn.xml     → Lifetime ink usage per color
 * - /DevMgmt/MediaHandlingDyn.xml    → Loaded media info
 * - /LFPWebServices/FibonacciDyn.xml → Printhead life & maintenance counters
 * 
 * Returns the same EWSData interface as hp-ews.ts so the frontend renders both
 * printer generations identically.
 */

import http from 'http';
import https from 'https';
import type {
  EWSData,
  EWSIdentity,
  EWSDeviceStatus,
  EWSInkCartridge,
  EWSPrinthead,
  EWSMaintenanceItem,
  EWSMediaInfo,
  EWSAlert,
} from './hp-ews.js';

// ============ XML Parsing Helpers ============

/**
 * Simple XML tag extractor — no dependency needed.
 * Extracts the text content of the first occurrence of <tag>text</tag>.
 * Handles namespaced tags like <dd:SerialNumber>.
 */
function xmlText(xml: string, tag: string): string {
  // Try namespace-prefixed first, then bare tag
  const patterns = [
    new RegExp(`<[^:>]*:${tag}[^>]*>([^<]*)<`, 'i'),
    new RegExp(`<${tag}[^>]*>([^<]*)<`, 'i'),
  ];
  for (const re of patterns) {
    const m = xml.match(re);
    if (m) return m[1].trim();
  }
  return '';
}

/**
 * Extract all occurrences of a block between opening and closing tags.
 * Returns array of XML strings for each block.
 */
function xmlBlocks(xml: string, tag: string): string[] {
  const results: string[] = [];
  // Match both namespaced and non-namespaced
  const re = new RegExp(`<(?:[^:>]*:)?${tag}[^>]*>(.*?)</(?:[^:>]*:)?${tag}>`, 'gis');
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    results.push(m[1]);
  }
  return results;
}

/**
 * Extract all unique values for a given tag (across the entire XML).
 */
function xmlAll(xml: string, tag: string): string[] {
  const results: string[] = [];
  const re = new RegExp(`<(?:[^:>]*:)?${tag}[^>]*>([^<]*)<`, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    results.push(m[1].trim());
  }
  return results;
}

// ============ HTTP Fetch Helper ============

function fetchLEDM(ip: string, path: string, timeoutMs: number = 8000): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = `http://${ip}${path}`;
    const req = http.get(url, {
      timeout: timeoutMs,
      headers: { 'Accept': '*/*' },
    }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode} for ${path}`));
        return;
      }
      let data = '';
      res.on('data', (chunk: Buffer) => data += chunk.toString());
      res.on('end', () => resolve(data));
    });
    req.on('error', (err: Error) => reject(err));
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout fetching ${path}`)); });
  });
}

// Also try HTTPS for some printers
function fetchLEDMHttps(ip: string, path: string, timeoutMs: number = 8000): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = `https://${ip}${path}`;
    const agent = new https.Agent({ rejectUnauthorized: false });
    const req = https.get(url, {
      agent,
      timeout: timeoutMs,
      headers: { 'Accept': '*/*' },
    }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode} for ${path}`));
        return;
      }
      let data = '';
      res.on('data', (chunk: Buffer) => data += chunk.toString());
      res.on('end', () => resolve(data));
    });
    req.on('error', (err: Error) => reject(err));
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout fetching ${path}`)); });
  });
}

// ============ Color Mapping ============

const INK_COLOR_HEX: Record<string, string> = {
  'cyan': '#00BCD4',
  'c': '#00BCD4',
  'magenta': '#E91E63',
  'm': '#E91E63',
  'yellow': '#FFEB3B',
  'y': '#FFEB3B',
  'black': '#212121',
  'k': '#212121',
  'light-cyan': '#80DEEA',
  'lc': '#80DEEA',
  'light cyan': '#80DEEA',
  'light-magenta': '#F48FB1',
  'lm': '#F48FB1',
  'light magenta': '#F48FB1',
  'pre-treatment': '#9E9E9E',
  'optimizer': '#9E9E9E',
};

const INK_DISPLAY_NAMES: Record<string, string> = {
  'cyan': 'Cyan',
  'c': 'Cyan',
  'magenta': 'Magenta',
  'm': 'Magenta',
  'yellow': 'Yellow',
  'y': 'Yellow',
  'black': 'Black',
  'k': 'Black',
  'light-cyan': 'Light Cyan',
  'lc': 'Light Cyan',
  'light cyan': 'Light Cyan',
  'light-magenta': 'Light Magenta',
  'lm': 'Light Magenta',
  'light magenta': 'Light Magenta',
  'pre-treatment': 'Optimizer',
  'optimizer': 'Optimizer',
};

// HP 831 printhead label codes to color names
const PRINTHEAD_LABEL_COLORS: Record<string, string[]> = {
  'C': ['Cyan', 'Light Cyan'],
  'MY': ['Magenta', 'Yellow'],
  'K': ['Black'],
  'O': ['Optimizer'],
};

// HP 871 part number to color
const HP871_PART_COLORS: Record<string, string> = {
  'G0Y79D': 'Cyan',
  'G0Y80D': 'Magenta',
  'G0Y81D': 'Yellow',
  'G0Y82D': 'Black',
  'G0Y83D': 'Light Cyan',
  'G0Y84D': 'Light Magenta',
  'G0Y85D': 'Optimizer',
};

// ============ Parsers ============

function parseIdentity(configXml: string): EWSIdentity | null {
  try {
    const model = xmlText(configXml, 'MakeAndModel');
    if (!model) return null;
    
    const serial = xmlText(configXml, 'SerialNumber');
    const partNumber = xmlText(configXml, 'ProductNumber');
    const timestamp = xmlText(configXml, 'TimeStamp');
    
    // Firmware is the Revision inside ProductInformation, NOT the schema-level Version/Revision
    const prodInfoBlock = xmlBlocks(configXml, 'ProductInformation')[0] || '';
    const firmware = prodInfoBlock ? xmlText(prodInfoBlock, 'Revision') : xmlText(configXml, 'Revision');
    
    return {
      productName: model,
      productNumber: partNumber,
      serialNumber: serial,
      firmwareVersion: firmware,
      biosVersion: '',
      memoryMb: 0,
      storageSizeGb: 0,
      colorSupported: true,
      uptimeSeconds: 0,  // LEDM doesn't provide uptime directly
      systemTime: timestamp,
    };
  } catch {
    return null;
  }
}

function parseStatus(statusXml: string): { status: EWSDeviceStatus; alerts: EWSAlert[] } {
  const alerts: EWSAlert[] = [];
  
  // Device status
  const statusCategory = xmlText(statusXml, 'StatusCategory');
  const englishString = xmlText(statusXml, 'EnglishString');
  
  const activity = statusCategory || englishString || 'Unknown';
  const displayActivity = activity.charAt(0).toUpperCase() + activity.slice(1);
  
  const status: EWSDeviceStatus = {
    currentActivity: displayActivity === 'Ready' ? 'Idle' : displayActivity,
    activityDetails: '',
    remainingTimeSec: 0,
    statusSeverity: 'normal',
    mostRelevantStatus: displayActivity,
  };
  
  // Parse alerts
  const alertBlocks = xmlBlocks(statusXml, 'Alert');
  for (const block of alertBlocks) {
    const alertId = xmlText(block, 'ProductStatusAlertID');
    const severity = xmlText(block, 'Severity');
    const consumableType = xmlText(block, 'AlertDetailsConsumableTypeEnum');
    const markerColor = xmlText(block, 'AlertDetailsMarkerColor');
    const markerLocation = xmlText(block, 'AlertDetailsMarkerLocation');
    
    if (!alertId || alertId === 'ready') continue;
    
    // Build human-readable description
    let desc = alertId.replace(/([A-Z])/g, ' $1').trim();
    if (markerColor) desc += ` (${markerColor})`;
    if (consumableType) desc += ` [${consumableType}]`;
    if (markerLocation) desc += ` Slot ${markerLocation}`;
    
    alerts.push({
      description: desc,
      severity: severity.toLowerCase() || 'info',
      type: consumableType || undefined,
    });
    
    // If any alert is critical, update status severity
    if (severity.toLowerCase() === 'critical') {
      status.statusSeverity = 'critical';
    } else if (severity.toLowerCase() === 'warning' && status.statusSeverity !== 'critical') {
      status.statusSeverity = 'warning';
    }
  }
  
  return { status, alerts };
}

function parseConsumables(consumableXml: string): { ink: EWSInkCartridge[]; printheads: EWSPrinthead[] } {
  const ink: EWSInkCartridge[] = [];
  const printheads: EWSPrinthead[] = [];
  
  const blocks = xmlBlocks(consumableXml, 'ConsumableInfo');
  
  for (const block of blocks) {
    const consumableType = xmlText(block, 'ConsumableTypeEnum');
    const station = parseInt(xmlText(block, 'ConsumableStation') || '0', 10);
    const partNumber = xmlText(block, 'ProductNumber');
    const serialNumber = xmlText(block, 'SerialNumber');
    const state = xmlText(block, 'ConsumableState');
    const expirationDate = xmlText(block, 'ExpirationDate');
    const labelCode = xmlText(block, 'ConsumableLabelCode');
    const selectabilityNumber = xmlText(block, 'ConsumableSelectibilityNumber');
    const warrantyStatus = xmlText(block, 'WarrantyStatus');
    
    // Installation date
    const installBlocks = xmlBlocks(block, 'Installation');
    const installDate = installBlocks.length > 0 ? xmlText(installBlocks[0], 'Date') : '';
    
    // Manufacturing date
    const manufacturedDate = xmlText(block, 'ManufacturingDate') || xmlText(block, 'DateOfManufacture') || '';
    
    if (consumableType === 'ink') {
      const levelPercent = parseInt(xmlText(block, 'ConsumablePercentageLevelRemaining') || '0', 10);
      const maxCapacity = parseInt(xmlText(block, 'MaxCapacity') || '3000', 10);
      const levelCc = Math.round(maxCapacity * levelPercent / 100);
      const measuredState = xmlText(block, 'MeasuredQuantityState');
      
      // Determine color from part number or label code
      let color = HP871_PART_COLORS[partNumber] || '';
      if (!color && labelCode) {
        const lc = labelCode.toLowerCase();
        color = INK_DISPLAY_NAMES[lc] || labelCode;
      }
      if (!color) color = `Slot ${station}`;
      
      const colorKey = color.toLowerCase().replace(' ', '-');
      
      ink.push({
        slotId: station,
        color,
        colorHex: INK_COLOR_HEX[colorKey] || INK_COLOR_HEX[color.toLowerCase()] || '#757575',
        levelPercent,
        levelCc,
        capacityCc: maxCapacity,
        partNumber,
        orderNumber: selectabilityNumber,  // e.g., "HP 871"
        serialNumber,
        batchId: '',  // Not available in LEDM
        brand: selectabilityNumber || 'HP',
        state: measuredState || state || 'unknown',
        expirationDate: expirationDate || null,
        installDate: installDate || null,
        warrantyStatus: warrantyStatus || 'unknown',
        cumulativeInkUsedCc: 0,  // Filled from ProductUsageDyn
        insertionCount: 0,  // Not available in LEDM consumable data
        supplyType: 'Supply',
        isPresent: true,
      });
    } else if (consumableType === 'printhead') {
      // Determine colors from label code
      const colors = PRINTHEAD_LABEL_COLORS[labelCode] || [labelCode || `Slot ${station}`];
      
      // Warranty expiration date
      const warrantyExpiration = xmlText(block, 'ExpirationDate');
      
      printheads.push({
        slotId: station,
        colors,
        healthGaugeLevel: 0,     // Not available in LEDM
        healthGaugeStatus: state === 'ok' ? 'OK' : state,
        expirationDate: warrantyExpiration || null,
        inkConsumptionCc: 0,     // Not available in LEDM consumable data
        expiredInkUsedCc: 0,
        inWarranty: warrantyStatus === 'active',
        positionX: 0,
        positionY: 0,
        statusFlag: state || 'unknown',
        // Extended fields (not available in LEDM XML, populated for 800W JSON)
        orderNumber: selectabilityNumber || '',
        partNumber: partNumber || '',
        serialNumber: serialNumber || '',
        installDate: installDate || null,
        manufacturingDate: manufacturedDate || null,
        warrantyStatus: warrantyStatus || 'unknown',
        warrantyExpirationDate: warrantyExpiration || null,
        nominalLife: 0,
        usageTime: '',
        manufacturer: 'HP',
        state: state || 'unknown',
      });
    }
  }
  
  return { ink, printheads };
}

function parseUsage(usageXml: string, ink: EWSInkCartridge[]): void {
  // Extract cumulative ink usage per color and merge with ink cartridges
  const consumableBlocks = xmlBlocks(usageXml, 'Consumable');
  
  for (const block of consumableBlocks) {
    const consumableType = xmlText(block, 'ConsumableTypeEnum');
    if (consumableType !== 'ink') continue;
    
    const markerColor = xmlText(block, 'MarkerColor');
    const cumulativeUsed = parseFloat(xmlText(block, 'ValueFloat') || '0');
    const cumulativeCount = parseInt(xmlText(block, 'CumulativeConsumableCount') || '0', 10);
    
    if (!markerColor) continue;
    
    // Map color name to display name
    const displayName = INK_DISPLAY_NAMES[markerColor.toLowerCase()] || markerColor;
    
    // Find matching cartridge and update
    const cartridge = ink.find(c => c.color.toLowerCase() === displayName.toLowerCase());
    if (cartridge) {
      cartridge.cumulativeInkUsedCc = Math.round(cumulativeUsed);
      cartridge.insertionCount = cumulativeCount;
    }
  }
  
  // Also extract total cumulative usage
  const totalUsed = parseFloat(xmlText(usageXml, 'CumulativeHPMarkingAgentUsed') || '0');
  // Not stored directly but useful for logging
}

function parseFibonacci(fibXml: string, printheads: EWSPrinthead[]): { maintenanceKits: number[] } {
  // Extract printhead life data
  const penLifeBlocks = xmlBlocks(fibXml, 'currentPenLife');
  for (const block of penLifeBlocks) {
    const penIndex = parseInt(xmlText(block, 'Pen') || '-1', 10);
    const life = parseInt(xmlText(block, 'Life') || '0', 10);
    
    // Match pen index to printhead slot (offset: pen 0 = printhead slot 1)
    const ph = printheads.find(p => p.slotId === penIndex + 1);
    if (ph) {
      // Life is in some unit — likely cc or ml
      ph.inkConsumptionCc = life;
    }
  }
  
  // Extract maintenance kit usage
  const kitBlocks = xmlBlocks(fibXml, 'maintenanceKitUsage');
  const kits: number[] = [];
  for (const block of kitBlocks) {
    const usage = parseInt(xmlText(block, 'Usage') || '0', 10);
    kits.push(usage);
  }
  
  return { maintenanceKits: kits };
}

function parseMedia(mediaXml: string): EWSMediaInfo | null {
  try {
    const trayBlocks = xmlBlocks(mediaXml, 'InputTray');
    if (trayBlocks.length === 0) return null;
    
    const tray = trayBlocks[0]; // Use first tray
    const mediaType = xmlText(tray, 'MediaType');
    const widthMm = parseInt(xmlText(tray, 'Width') || '0', 10);
    const lengthMm = parseInt(xmlText(tray, 'Length') || '0', 10);
    const trayState = xmlText(tray, 'TrayState');
    const trayType = xmlText(tray, 'TrayType');
    const inputBin = xmlText(tray, 'InputBin');
    
    // Convert mm to inches for display
    const widthIn = widthMm > 0 ? (widthMm / 25.4).toFixed(1) : '0';
    
    return {
      type: mediaType || 'Unknown',
      width: `${widthIn} in`,
      source: `${inputBin} (${trayType})`,
      cutterInstalled: false,
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      remainingLengthIn: lengthMm > 0 ? Math.round(lengthMm / 25.4) : undefined,
    };
  } catch {
    return null;
  }
}

// ============ Cache ============

interface LEDMCacheEntry {
  data: EWSData;
  lastFull: number;
}

const ledmCache = new Map<string, LEDMCacheEntry>();

// ============ Main Poll Function ============

/**
 * Poll an HP Latex printer via LEDM XML endpoints.
 * Returns the same EWSData interface as pollHPEWS for frontend compatibility.
 */
export async function pollHPLEDM(ip: string): Promise<EWSData> {
  const now = Date.now();
  const cached = ledmCache.get(ip);
  
  // Return cache if polled within last 10 seconds
  if (cached && (now - cached.lastFull) < 10_000) {
    return cached.data;
  }
  
  const result: EWSData = {
    available: false,
    lastPolled: new Date().toISOString(),
    identity: null,
    status: null,
    ink: [],
    printheads: [],
    maintenance: [],
    media: null,
    alerts: [],
    jobs: [],            // LEDM doesn't have job queue; Thrive RIP provides this
    jobQueueStatus: 'Unknown',
    jobQueueTotal: 0,
    activeJob: null,
    totalImpressions: null,
  };
  
  try {
    // Fetch all LEDM endpoints in parallel (HTTP)
    const [
      configResult,
      statusResult,
      consumableResult,
      usageResult,
      mediaResult,
      fibonacciResult,
    ] = await Promise.allSettled([
      fetchLEDM(ip, '/DevMgmt/ProductConfigDyn.xml'),
      fetchLEDM(ip, '/DevMgmt/ProductStatusDyn.xml'),
      fetchLEDM(ip, '/DevMgmt/ConsumableConfigDyn.xml'),
      fetchLEDM(ip, '/DevMgmt/ProductUsageDyn.xml'),
      fetchLEDM(ip, '/DevMgmt/MediaHandlingDyn.xml'),
      fetchLEDM(ip, '/LFPWebServices/FibonacciDyn.xml'),
    ]);
    
    // Parse identity
    if (configResult.status === 'fulfilled') {
      result.identity = parseIdentity(configResult.value);
    }
    
    // Parse status & alerts
    if (statusResult.status === 'fulfilled') {
      const { status, alerts } = parseStatus(statusResult.value);
      result.status = status;
      result.alerts = alerts;
    }
    
    // Parse consumables (ink + printheads)
    if (consumableResult.status === 'fulfilled') {
      const { ink, printheads } = parseConsumables(consumableResult.value);
      result.ink = ink;
      result.printheads = printheads;
    }
    
    // Merge usage data with ink cartridges
    if (usageResult.status === 'fulfilled' && result.ink.length > 0) {
      parseUsage(usageResult.value, result.ink);
    }
    
    // Parse fibonacci counters (printhead life, maintenance)
    if (fibonacciResult.status === 'fulfilled') {
      const { maintenanceKits } = parseFibonacci(fibonacciResult.value, result.printheads);
      
      // Add maintenance kits as maintenance items
      const kitNames = ['Maintenance Kit 1', 'Maintenance Kit 2'];
      maintenanceKits.forEach((usage, i) => {
        if (i < kitNames.length) {
          result.maintenance.push({
            id: `kit-${i}`,
            name: kitNames[i],
            type: 'maintenance_kit',
            levelPercent: usage,  // Usage percentage
            currentCc: 0,
            totalCapacityCc: 0,
            state: 'ok',
            isPresent: true,
          });
        }
      });
    }
    
    // Parse media
    if (mediaResult.status === 'fulfilled') {
      result.media = parseMedia(mediaResult.value);
    }
    
    // Mark as available if we got at least identity or consumables
    result.available = !!(result.identity || result.ink.length > 0);
    
    // Cache
    if (result.available) {
      ledmCache.set(ip, { data: result, lastFull: now });
    }
    
  } catch (err: any) {
    result.error = err.message || 'Unknown error polling LEDM';
    if (cached) {
      cached.data.error = result.error;
      cached.data.lastPolled = result.lastPolled;
      return cached.data;
    }
  }
  
  return result;
}

/**
 * Quick probe to check if an IP has LEDM XML endpoints.
 * Returns true if /DevMgmt/ProductConfigDyn.xml responds with HP Latex in the model name.
 */
export async function isHPLatexLEDM(ip: string): Promise<boolean> {
  try {
    const xml = await fetchLEDM(ip, '/DevMgmt/ProductConfigDyn.xml', 4000);
    const model = xmlText(xml, 'MakeAndModel');
    return model.toLowerCase().includes('latex') || model.toLowerCase().includes('hp');
  } catch {
    // Try HTTPS
    try {
      const xml = await fetchLEDMHttps(ip, '/DevMgmt/ProductConfigDyn.xml', 4000);
      const model = xmlText(xml, 'MakeAndModel');
      return model.toLowerCase().includes('latex') || model.toLowerCase().includes('hp');
    } catch {
      return false;
    }
  }
}
