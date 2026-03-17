/**
 * Production List Validation Service
 * 
 * Reads the last 28 days of Brenda's, Christina's, and Pam's
 * daily tally Excel files and cross-references WO#s against
 * orders in the ERP to find any that were missed during
 * production list sync.
 * 
 * Tally file column mapping (from docs/Production List setup §8):
 *   K (col 10) → Customer name
 *   L (col 11) → WO#
 *   M (col 12) → Description
 *   F (col 5) → Must Ship date
 */

import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '../db/client.js';
import { PRODUCTION_LIST_FILE_PATTERNS } from '@erp/shared';

// ─── Types ─────────────────────────────────────────────────────

export interface TallyEntry {
  orderNumber: string;
  customerName: string;
  description: string;
  mustShipDate: string | null;
  source: 'brenda' | 'christina' | 'pam';
  fileDate: string; // YYYY-MM-DD  
  fileName: string;
}

export interface ValidationMissedOrder {
  orderNumber: string;
  customerName: string;
  description: string;
  mustShipDate: string | null;
  sources: Array<{
    source: 'brenda' | 'christina' | 'pam';
    fileDate: string;
    fileName: string;
  }>;
}

export interface ValidationResult {
  totalTallyEntries: number;
  uniqueOrderNumbers: number;
  matchedInERP: number;
  missedOrders: ValidationMissedOrder[];
  filesScanned: Array<{
    source: 'brenda' | 'christina' | 'pam';
    fileName: string;
    fileDate: string;
    rowCount: number;
    exists: boolean;
  }>;
  daysScanned: number;
  errors: string[];
}

export interface TallyFileInfo {
  source: 'brenda' | 'christina' | 'pam';
  label: string;
  todayPath: string | null;
  todayExists: boolean;
  configuredBasePath: string | null;
}

// ─── Path Resolution ───────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Resolve today's tally file path using the file naming pattern.
 * 
 * Brenda: {base}\Brenda's Daily List\{MMMM yyyy}\Brenda Tally_MMMM_d_yyyy.xlsx
 * Christina: {base}\Christina's Daily List\{MMMM yyyy}\Christina Tally_MMMM_d_yyyy.xlsx
 * Pam: {base}\Pam's Daily List\{MMMM yyyy}\Shipping Tally_MMMM_dd_yy.xlsm
 * 
 * Note: Christina and Pam archive past months into year subfolders
 * (e.g., 2026/February 2026/), while current month is flat.
 * We try the flat path first, then fall back to the year-nested path.
 */
function resolveTallyPath(
  basePath: string,
  source: 'brenda' | 'christina' | 'pam',
  date: Date,
): string {
  const month = MONTH_NAMES[date.getMonth()];
  const yyyy = date.getFullYear().toString();
  const yy = yyyy.slice(-2);
  const d = date.getDate().toString();
  const dd = date.getDate().toString().padStart(2, '0');
  const monthFolder = `${month} ${yyyy}`;

  let dailyListFolder: string;
  let fileName: string;

  switch (source) {
    case 'brenda':
      dailyListFolder = "Brenda's Daily List";
      fileName = `Brenda Tally_${month}_${d}_${yyyy}.xlsx`;
      break;
    case 'christina':
      dailyListFolder = "Christina's Daily List";
      fileName = `Christina Tally_${month}_${d}_${yyyy}.xlsx`;
      break;
    case 'pam':
      dailyListFolder = "Pam's Daily List";
      fileName = `Shipping Tally_${month}_${dd}_${yy}.xlsm`;
      break;
  }

  // Try flat path first: {base}/{Daily List}/{Month Year}/filename
  const flatPath = path.join(basePath, dailyListFolder, monthFolder, fileName);
  if (fs.existsSync(flatPath)) return flatPath;

  // Fall back to year-nested path: {base}/{Daily List}/{yyyy}/{Month Year}/filename
  const yearNestedPath = path.join(basePath, dailyListFolder, yyyy, monthFolder, fileName);
  if (fs.existsSync(yearNestedPath)) return yearNestedPath;

  // Return flat path as default (will show as "not found" in scan results)
  return flatPath;
}

/**
 * Get all dates for the last N days (skipping weekends).
 */
function getWorkdaysInRange(days: number): Date[] {
  const dates: Date[] = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  let current = new Date(now);
  let count = 0;

  while (count < days) {
    const dow = current.getDay();
    if (dow !== 0 && dow !== 6) { // Skip weekends
      dates.push(new Date(current));
      count++;
    }
    current.setDate(current.getDate() - 1);
  }

  return dates;
}

// ─── Tally Parsing ─────────────────────────────────────────────

/**
 * Parse a single tally Excel file and extract WO#s.
 * 
 * Tally files use:
 *   Column K (index 10) = Customer name
 *   Column L (index 11) = WO#
 *   Column M (index 12) = Description
 *   Column F (index 5) = Must Ship date
 */
function parseTallyFile(
  filePath: string,
  source: 'brenda' | 'christina' | 'pam',
  fileDate: string,
): TallyEntry[] {
  const entries: TallyEntry[] = [];

  try {
    const buffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return entries;

    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
    const fileName = path.basename(filePath);

    // Pam's shipping tally may have a different column layout.
    // For Brenda & Christina: K=Customer, L=WO#, M=Description, F=MustShip
    // For Pam: We'll try the same layout first, then fall back to
    //   checking if col A=WO# or col B=WO# (shipping tally is simpler).
    
    const isShippingTally = source === 'pam';
    
    for (let r = 1; r <= range.e.r; r++) { // Skip row 0 (header)
      let orderNumber: string | null = null;
      let customerName = '';
      let description = '';
      let mustShipDate: string | null = null;

      if (isShippingTally) {
        // Pam's Shipping Tally — try multiple known layouts
        // Layout 1: Same as Brenda/Christina (K, L, M)
        const cellL = sheet[XLSX.utils.encode_cell({ r, c: 11 })];
        if (cellL) {
          const val = String(cellL.v || '').trim();
          if (/^\d{4,5}$/.test(val)) {
            orderNumber = val;
            const cellK = sheet[XLSX.utils.encode_cell({ r, c: 10 })];
            customerName = cellK ? String(cellK.v || '').trim() : '';
            const cellM = sheet[XLSX.utils.encode_cell({ r, c: 12 })];
            description = cellM ? String(cellM.v || '').trim() : '';
          }
        }
        // Layout 2: col A=Customer, col B=WO#, col C=Description
        if (!orderNumber) {
          const cellB = sheet[XLSX.utils.encode_cell({ r, c: 1 })];
          if (cellB) {
            const val = String(cellB.v || '').trim();
            if (/^\d{4,5}$/.test(val)) {
              orderNumber = val;
              const cellA = sheet[XLSX.utils.encode_cell({ r, c: 0 })];
              customerName = cellA ? String(cellA.v || '').trim() : '';
              const cellC = sheet[XLSX.utils.encode_cell({ r, c: 2 })];
              description = cellC ? String(cellC.v || '').trim() : '';
            }
          }
        }
      } else {
        // Brenda & Christina tallies: K=Customer, L=WO#, M=Description
        const cellL = sheet[XLSX.utils.encode_cell({ r, c: 11 })];
        if (!cellL) continue;

        const woVal = String(cellL.v || '').trim();
        if (!/^\d{4,5}$/.test(woVal)) continue;

        orderNumber = woVal;
        
        const cellK = sheet[XLSX.utils.encode_cell({ r, c: 10 })];
        customerName = cellK ? String(cellK.v || '').trim() : '';

        const cellM = sheet[XLSX.utils.encode_cell({ r, c: 12 })];
        description = cellM ? String(cellM.v || '').trim() : '';

        const cellF = sheet[XLSX.utils.encode_cell({ r, c: 5 })];
        if (cellF) {
          if (cellF.t === 'd' && cellF.v instanceof Date) {
            mustShipDate = cellF.v.toISOString().split('T')[0];
          } else if (typeof cellF.v === 'string') {
            mustShipDate = cellF.v;
          }
        }
      }

      if (orderNumber) {
        entries.push({
          orderNumber,
          customerName,
          description,
          mustShipDate,
          source,
          fileDate,
          fileName,
        });
      }
    }
  } catch (err: any) {
    // File read errors are expected for days that don't have tally files
    console.warn(`[validation] Could not parse ${filePath}: ${err.message}`);
  }

  return entries;
}

// ─── Main Validation ───────────────────────────────────────────

/**
 * Get the base path and per-source overrides from settings.
 */
async function getValidationPaths(): Promise<{
  basePath: string | null;
  brendaPath: string | null;
  christinaPath: string | null;
  pamPath: string | null;
}> {
  const settings = await prisma.systemSettings.findFirst({ where: { id: 'system' } }) as any;
  return {
    basePath: settings?.productionListPath || null,
    brendaPath: settings?.brendaTallyPath || null,
    christinaPath: settings?.christinaTallyPath || null,
    pamPath: settings?.pamTallyPath || null,
  };
}

/**
 * Get file info for today's tally files (used by the UI card).
 */
export async function getTallyFileInfo(): Promise<TallyFileInfo[]> {
  const { basePath, brendaPath, christinaPath, pamPath } = await getValidationPaths();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sources: Array<{ key: 'brenda' | 'christina' | 'pam'; label: string; override: string | null }> = [
    { key: 'brenda', label: "Brenda's Daily List", override: brendaPath },
    { key: 'christina', label: "Christina's Daily List", override: christinaPath },
    { key: 'pam', label: "Pam's Daily List (Shipping)", override: pamPath },
  ];

  return sources.map(({ key, label, override }) => {
    const effectiveBase = override || basePath;
    let todayPath: string | null = null;
    let todayExists = false;

    if (effectiveBase) {
      todayPath = resolveTallyPath(effectiveBase, key, today);
      todayExists = fs.existsSync(todayPath);
    }

    return {
      source: key,
      label,
      todayPath,
      todayExists,
      configuredBasePath: effectiveBase,
    };
  });
}

/**
 * Validate production list accuracy by scanning tally files
 * from the last N workdays and cross-referencing with ERP orders.
 */
export async function validateProductionLists(
  days: number = 28,
): Promise<ValidationResult> {
  const { basePath, brendaPath, christinaPath, pamPath } = await getValidationPaths();
  const errors: string[] = [];

  if (!basePath && !brendaPath && !christinaPath && !pamPath) {
    return {
      totalTallyEntries: 0,
      uniqueOrderNumbers: 0,
      matchedInERP: 0,
      missedOrders: [],
      filesScanned: [],
      daysScanned: 0,
      errors: ['No production list base path or tally paths configured. Set the Production List Directory in Settings.'],
    };
  }

  const workdays = getWorkdaysInRange(days);
  const allEntries: TallyEntry[] = [];
  const filesScanned: ValidationResult['filesScanned'] = [];

  const sources: Array<{ key: 'brenda' | 'christina' | 'pam'; override: string | null }> = [
    { key: 'brenda', override: brendaPath },
    { key: 'christina', override: christinaPath },
    { key: 'pam', override: pamPath },
  ];

  // Scan each source for each workday
  for (const date of workdays) {
    const dateStr = date.toISOString().split('T')[0];

    for (const { key, override } of sources) {
      const effectiveBase = override || basePath;
      if (!effectiveBase) continue;

      const filePath = resolveTallyPath(effectiveBase, key, date);
      const exists = fs.existsSync(filePath);
      const fileName = path.basename(filePath);

      if (exists) {
        const entries = parseTallyFile(filePath, key, dateStr);
        allEntries.push(...entries);
        filesScanned.push({
          source: key,
          fileName,
          fileDate: dateStr,
          rowCount: entries.length,
          exists: true,
        });
      } else {
        filesScanned.push({
          source: key,
          fileName,
          fileDate: dateStr,
          rowCount: 0,
          exists: false,
        });
      }
    }
  }

  // Collect unique WO#s from all entries
  const tallyByWO = new Map<string, TallyEntry[]>();
  for (const entry of allEntries) {
    const existing = tallyByWO.get(entry.orderNumber) || [];
    existing.push(entry);
    tallyByWO.set(entry.orderNumber, existing);
  }

  const uniqueOrderNumbers = tallyByWO.size;

  if (uniqueOrderNumbers === 0) {
    return {
      totalTallyEntries: allEntries.length,
      uniqueOrderNumbers: 0,
      matchedInERP: 0,
      missedOrders: [],
      filesScanned,
      daysScanned: workdays.length,
      errors: allEntries.length === 0
        ? ['No tally entries found in any files for the last ' + days + ' workdays.']
        : errors,
    };
  }

  // Query ERP for all these order numbers
  const orderNumbers = Array.from(tallyByWO.keys());
  
  // Batch query in chunks of 500 to avoid query limits
  const erpOrders = new Set<string>();
  for (let i = 0; i < orderNumbers.length; i += 500) {
    const chunk = orderNumbers.slice(i, i + 500);
    const found = await prisma.workOrder.findMany({
      where: { orderNumber: { in: chunk } },
      select: { orderNumber: true },
    });
    for (const order of found) {
      erpOrders.add(order.orderNumber);
    }
  }

  // Find missed orders (in tally but NOT in ERP)
  const missedOrders: ValidationMissedOrder[] = [];
  for (const [wo, entries] of tallyByWO) {
    if (!erpOrders.has(wo)) {
      // Use the most recent entry for name/description
      const latest = entries.sort((a, b) => b.fileDate.localeCompare(a.fileDate))[0];
      missedOrders.push({
        orderNumber: wo,
        customerName: latest.customerName,
        description: latest.description,
        mustShipDate: latest.mustShipDate,
        sources: entries.map(e => ({
          source: e.source,
          fileDate: e.fileDate,
          fileName: e.fileName,
        })),
      });
    }
  }

  // Sort missed orders by order number descending (newest first)
  missedOrders.sort((a, b) => b.orderNumber.localeCompare(a.orderNumber));

  return {
    totalTallyEntries: allEntries.length,
    uniqueOrderNumbers,
    matchedInERP: erpOrders.size,
    missedOrders,
    filesScanned,
    daysScanned: workdays.length,
    errors,
  };
}
