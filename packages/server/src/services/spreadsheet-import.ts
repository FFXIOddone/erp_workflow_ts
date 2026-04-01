import * as XLSX from 'xlsx';
import * as fs from 'fs';
import { prisma } from '../db/client.js';
import { PrintingMethod } from '@erp/shared';
import { resolveImportedRouting } from '../lib/routing-defaults.js';

// ─── Types ─────────────────────────────────────────────────────
export interface SpreadsheetRow {
  rowNumber: number;
  customerName: string;
  orderNumber: string;
  description: string;
  createdDate: Date | null;
  dueDate: Date | null;
  proofedDate: Date | null;
  approvedDate: Date | null;
  printSetupDate: Date | null;
  routing: PrintingMethod[];
  notes: string | null;
  section: string;
}

export interface ImportResult {
  totalRows: number;
  imported: number;
  updated: number;
  skipped: number;
  errors: number;
  details: ImportRowResult[];
}

export interface ImportRowResult {
  rowNumber: number;
  orderNumber: string;
  customerName: string;
  status: 'imported' | 'updated' | 'skipped' | 'error';
  reason?: string;
}

const PRINTING_STATIONS = new Set<PrintingMethod>([
  PrintingMethod.ROLL_TO_ROLL,
  PrintingMethod.FLATBED,
  PrintingMethod.SCREEN_PRINT,
]);

// ─── Section/header detection ──────────────────────────────────
const SECTION_HEADERS = [
  'MONTHLY',
  'COMING UP',
  'FLIP SIGNS',
  'DESIGN; PRODUCTION',
  'DESIGN; DESIGN ONLY',
  'INSTALL READY',
  'OUTSOURCED',
  'ON-HOLD',
] as const;

// Rows where WO# is "-" or the customer column contains section labels
function isSectionRow(woNumber: string | null, customerName: string): boolean {
  if (!woNumber || woNumber === '-') {
    // Check if it looks like a section header
    const upper = (customerName || '').toUpperCase();
    return SECTION_HEADERS.some(h => upper.includes(h)) || upper === '(PRODUCTION)' || !customerName;
  }
  return false;
}

// ─── Routing code mapping ──────────────────────────────────────
function parseRouting(routingStr: string | null): PrintingMethod[] {
  if (!routingStr || routingStr === 'x') return [];

  const methods: PrintingMethod[] = [];
  const upper = routingStr.toUpperCase().trim();
  const tokens = upper.split(/\s+/);

  for (const token of tokens) {
    switch (token) {
      case 'RR':
        methods.push(PrintingMethod.ROLL_TO_ROLL);
        break;
      case 'FB':
        methods.push(PrintingMethod.FLATBED);
        break;
      case 'Z':
        methods.push(PrintingMethod.PRODUCTION);
        break;
    }
  }

  return methods;
}

// ─── Date parsing ──────────────────────────────────────────────
function parseDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;

  const str = String(value).trim();
  if (str === 'N/A' || str === '-' || str === '') return null;

  // Try parsing as date string
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d;

  // Excel serial date number
  if (typeof value === 'number') {
    const epoch = new Date(1899, 11, 30); // Excel epoch
    const ms = value * 86400000;
    return new Date(epoch.getTime() + ms);
  }

  return null;
}

// ─── Status determination ──────────────────────────────────────
function determineStatus(row: SpreadsheetRow): string {
  const section = row.section.toUpperCase();

  // ON-HOLD section → ON_HOLD
  if (section.includes('ON-HOLD') || section.includes('ON HOLD')) {
    return 'ON_HOLD';
  }

  // INSTALL READY/SHIPPING section → COMPLETED (done producing, ready to ship)
  if (section.includes('INSTALL READY') || section.includes('SHIPPING') || section.includes('INVOICING')) {
    return 'COMPLETED';
  }

  // Has print setup date → actively IN_PROGRESS
  if (row.printSetupDate) {
    return 'IN_PROGRESS';
  }

  // Has approval → IN_PROGRESS (approved, moving to production)
  if (row.approvedDate) {
    return 'IN_PROGRESS';
  }

  // Has proof date → IN_PROGRESS (at least in design/proofing phase)
  if (row.proofedDate) {
    return 'IN_PROGRESS';
  }

  // Default: PENDING
  return 'PENDING';
}

function resolveSpreadsheetRowRouting(row: SpreadsheetRow): PrintingMethod[] {
  return resolveImportedRouting({
    routing: row.routing,
    description: row.description,
    section: row.section,
    needsProof: Boolean(row.proofedDate || row.approvedDate || row.printSetupDate),
  });
}

function getImportedStationStatus(
  row: SpreadsheetRow,
  station: PrintingMethod,
  overallStatus: string,
): 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' {
  if (overallStatus === 'COMPLETED') {
    return 'COMPLETED';
  }

  if (row.printSetupDate && PRINTING_STATIONS.has(station)) {
    return 'IN_PROGRESS';
  }

  if ((row.proofedDate || row.approvedDate || row.printSetupDate) && station === PrintingMethod.DESIGN) {
    return 'COMPLETED';
  }

  return 'NOT_STARTED';
}

// ─── WO number validation ──────────────────────────────────────
function isValidOrderNumber(woNumber: string): boolean {
  if (!woNumber || woNumber === '-') return false;
  // Skip non-numeric shorthand codes like CF, KF
  if (!/^\d+$/.test(woNumber)) return false;
  return true;
}

// ─── Main parse function ───────────────────────────────────────
export function parseProductionSpreadsheet(filePath: string): SpreadsheetRow[] {
  const buffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });

  const sheetName = workbook.SheetNames[0]; // Sheet1
  const worksheet = workbook.Sheets[sheetName];

  // Get range
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  const rows: SpreadsheetRow[] = [];
  let currentSection = '(Production)'; // Default section from row 1

  // Start from row 4 (index 3) — rows 1-3 are header/title
  for (let r = 3; r <= range.e.r; r++) {
    const rowNum = r + 1; // 1-indexed for display

    // Read cell values
    const cellA = worksheet[XLSX.utils.encode_cell({ r, c: 0 })]?.v; // Customer
    const cellB = worksheet[XLSX.utils.encode_cell({ r, c: 1 })]?.v; // WO#
    const cellC = worksheet[XLSX.utils.encode_cell({ r, c: 2 })]?.v; // Description
    const cellE = worksheet[XLSX.utils.encode_cell({ r, c: 4 })]?.v; // Created
    const cellF = worksheet[XLSX.utils.encode_cell({ r, c: 5 })]?.v; // Must Ship
    const cellG = worksheet[XLSX.utils.encode_cell({ r, c: 6 })]?.v; // Proofed
    const cellH = worksheet[XLSX.utils.encode_cell({ r, c: 7 })]?.v; // Approved
    const cellI = worksheet[XLSX.utils.encode_cell({ r, c: 8 })]?.v; // Print Setup
    const cellJ = worksheet[XLSX.utils.encode_cell({ r, c: 9 })]?.v; // Routing/Completed
    const cellK = worksheet[XLSX.utils.encode_cell({ r, c: 10 })]?.v; // Notes

    const woNumber = cellB ? String(cellB).trim() : null;
    const customerName = cellA ? String(cellA).trim() : '';

    // Check for section header
    if (isSectionRow(woNumber, customerName)) {
      if (customerName) {
        currentSection = customerName;
      }
      continue;
    }

    // Skip rows without a valid order number
    if (!woNumber || !isValidOrderNumber(woNumber)) {
      continue;
    }

    // Skip rows without a customer name or description
    if (!customerName || !cellC) {
      continue;
    }

    rows.push({
      rowNumber: rowNum,
      customerName,
      orderNumber: woNumber,
      description: String(cellC).trim(),
      createdDate: parseDate(cellE),
      dueDate: parseDate(cellF),
      proofedDate: parseDate(cellG),
      approvedDate: parseDate(cellH),
      printSetupDate: parseDate(cellI),
      routing: parseRouting(cellJ ? String(cellJ) : null),
      notes: cellK ? String(cellK).trim() : null,
      section: currentSection,
    });
  }

  return rows;
}

// ─── Normalize a customer name for company matching ────────────
function normalizeForMatch(name: string): string {
  return name
    .replace(/\(.*?\)/g, '')           // Remove (PO#123), (Store 45), etc.
    .replace(/\[.*?\]/g, '')           // Remove [anything]
    .replace(/#\s*\d+/g, '')           // Remove #123 store numbers
    .replace(/\bPO\s*#?\s*\d+/gi, '')  // Remove PO numbers
    .replace(/\bstore\s*#?\s*\d+/gi, '') // Remove "Store 123"
    .replace(/\bloc\w*\s*#?\s*\d+/gi, '') // Remove "Location 123"
    .replace(/\b(inc|llc|ltd|corp|co|company|enterprises|group)\b\.?/gi, '')
    .replace(/[^a-zA-Z0-9\s&'-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// ─── Import into database ──────────────────────────────────────
export async function importSpreadsheetOrders(
  filePath: string,
  userId: string,
  options: { dryRun?: boolean } = {}
): Promise<ImportResult> {
  const rows = parseProductionSpreadsheet(filePath);

  const result: ImportResult = {
    totalRows: rows.length,
    imported: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    details: [],
  };

  // Get all existing orders with their current data for comparison
  const existingOrders = await prisma.workOrder.findMany({
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      description: true,
      status: true,
      dueDate: true,
      notes: true,
      routing: true,
      companyId: true,
    },
  });
  const existingOrderMap = new Map(existingOrders.map(o => [o.orderNumber, o]));

  // Build company lookup: lowercase name → company, and normalized name → company
  const allCompanies = await prisma.company.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });
  const companyByExactLower = new Map<string, { id: string; name: string }>();
  const companyByNormalized = new Map<string, { id: string; name: string }>();
  for (const c of allCompanies) {
    companyByExactLower.set(c.name.toLowerCase(), c);
    const norm = normalizeForMatch(c.name);
    if (norm.length >= 2 && !companyByNormalized.has(norm)) {
      companyByNormalized.set(norm, c);
    }
  }

  // Helper: find matching company for a customer name
  function findMatchingCompany(customerName: string): { id: string; name: string } | null {
    // 1. Exact case-insensitive match
    const exact = companyByExactLower.get(customerName.toLowerCase());
    if (exact) return exact;
    // 2. Normalized match (strips PO numbers, suffixes, etc.)
    const norm = normalizeForMatch(customerName);
    const normalized = companyByNormalized.get(norm);
    if (normalized) return normalized;
    return null;
  }

  for (const row of rows) {
    const existing = existingOrderMap.get(row.orderNumber);
    const spreadsheetStatus = determineStatus(row);
    const resolvedRouting = resolveSpreadsheetRowRouting(row);

    // ──── UPDATE existing order if it's missing data ────
    if (existing) {
      try {
        const updateData: Record<string, any> = {};
        const updatedFields: string[] = [];

        // Update description if existing is empty/generic
        if ((!existing.description || existing.description === existing.orderNumber || existing.description === 'Imported Order')
            && row.description) {
          updateData.description = row.description;
          updatedFields.push('description');
        }

        // Update customer name if existing is empty/generic
        if ((!existing.customerName || existing.customerName === 'Unknown Customer')
            && row.customerName) {
          updateData.customerName = row.customerName;
          updatedFields.push('customerName');
        }

        // Update due date if missing
        if (!existing.dueDate && row.dueDate) {
          updateData.dueDate = row.dueDate;
          updatedFields.push('dueDate');
        }

        // Update notes if missing
        if (!existing.notes && row.notes) {
          updateData.notes = row.notes;
          updatedFields.push('notes');
        }

        // Heal incomplete routing without removing any stations already on the order.
        const existingRouting = ((existing.routing as PrintingMethod[]) || []);
        const mergedRouting = resolveImportedRouting({
          routing: Array.from(new Set([...existingRouting, ...resolvedRouting])),
          description: row.description || existing.description,
          section: row.section,
          needsProof: Boolean(row.proofedDate || row.approvedDate || row.printSetupDate),
        });
        const missingRouting = mergedRouting.filter(station => !existingRouting.includes(station));
        if (missingRouting.length > 0) {
          updateData.routing = mergedRouting;
          updatedFields.push(`routing(+${missingRouting.join(', ')})`);
        }

        // Update status if currently PENDING and spreadsheet shows further progress
        if (existing.status === 'PENDING' && spreadsheetStatus !== 'PENDING') {
          updateData.status = spreadsheetStatus;
          updatedFields.push(`status→${spreadsheetStatus}`);
        }

        // Link to company if not already linked
        if (!existing.companyId) {
          const matchedCompany = findMatchingCompany(row.customerName);
          if (matchedCompany) {
            updateData.companyId = matchedCompany.id;
            updatedFields.push('companyId');
          }
        }

        // Nothing to update — truly skip
        if (updatedFields.length === 0) {
          result.skipped++;
          result.details.push({
            rowNumber: row.rowNumber,
            orderNumber: row.orderNumber,
            customerName: row.customerName,
            status: 'skipped',
            reason: 'Order exists and all fields are already populated',
          });
          continue;
        }

        // Dry run — just report what would change
        if (options.dryRun) {
          result.updated++;
          result.details.push({
            rowNumber: row.rowNumber,
            orderNumber: row.orderNumber,
            customerName: row.customerName,
            status: 'updated',
            reason: `Would update: ${updatedFields.join(', ')}`,
          });
          continue;
        }

        // Apply updates
        await prisma.workOrder.update({
          where: { id: existing.id },
          data: updateData,
        });

        // Log the update as an event
        await prisma.workEvent.create({
          data: {
            orderId: existing.id,
            eventType: 'NOTE_ADDED',
            description: `Updated from production spreadsheet import: ${updatedFields.join(', ')}`,
            userId,
          },
        });

        // Create station progress if routing was added
        if (updateData.routing && updateData.routing.length > 0) {
          // Check if station progress already exists
          const existingProgress = await prisma.stationProgress.findMany({
            where: { orderId: existing.id },
            select: { station: true },
          });
          const existingStations = new Set(existingProgress.map(p => p.station));

          const newStations = (updateData.routing as PrintingMethod[]).filter(s => !existingStations.has(s));
          if (newStations.length > 0) {
            await prisma.stationProgress.createMany({
              data: newStations.map((station: PrintingMethod) => ({
                orderId: existing.id,
                station,
                status: getImportedStationStatus(row, station, spreadsheetStatus),
              })),
            });
          }
        }

        result.updated++;
        result.details.push({
          rowNumber: row.rowNumber,
          orderNumber: row.orderNumber,
          customerName: row.customerName,
          status: 'updated',
          reason: `Updated: ${updatedFields.join(', ')}`,
        });
      } catch (err: any) {
        result.errors++;
        result.details.push({
          rowNumber: row.rowNumber,
          orderNumber: row.orderNumber,
          customerName: row.customerName,
          status: 'error',
          reason: `Update failed: ${err.message || 'Unknown error'}`,
        });
      }
      continue;
    }

    // ──── CREATE new order ────
    if (options.dryRun) {
      result.imported++;
      result.details.push({
        rowNumber: row.rowNumber,
        orderNumber: row.orderNumber,
        customerName: row.customerName,
        status: 'imported',
        reason: `Would import as ${spreadsheetStatus}`,
      });
      existingOrderMap.set(row.orderNumber, { id: '', orderNumber: row.orderNumber, customerName: row.customerName, description: row.description, status: 'PENDING' as const, dueDate: row.dueDate, notes: row.notes, routing: resolvedRouting, companyId: null });
      continue;
    }

    try {
      const status = spreadsheetStatus;
      const matchedCompany = findMatchingCompany(row.customerName);

      await prisma.workOrder.create({
        data: {
          orderNumber: row.orderNumber,
          customerName: row.customerName,
          description: row.description,
          status: status as any,
          priority: 3, // Default priority
          companyBrand: 'WILDE_SIGNS',
          dueDate: row.dueDate,
          notes: row.notes,
          routing: resolvedRouting,
          createdById: userId,
          isTempOrder: false, // Imported from spreadsheet, these are real orders
          createdAt: row.createdDate || new Date(),
          ...(matchedCompany ? { companyId: matchedCompany.id } : {}),
          stationProgress: {
            create: resolvedRouting.map((station) => ({
              station,
              status: getImportedStationStatus(row, station, status),
            })),
          },
          events: {
            create: {
              eventType: 'CREATED',
              description: `Imported from production spreadsheet (Row ${row.rowNumber})`,
              userId,
            },
          },
        },
      });

      result.imported++;
      existingOrderMap.set(row.orderNumber, { id: '', orderNumber: row.orderNumber, customerName: row.customerName, description: row.description, status: 'PENDING' as const, dueDate: row.dueDate, notes: row.notes, routing: resolvedRouting, companyId: matchedCompany?.id ?? null });
      result.details.push({
        rowNumber: row.rowNumber,
        orderNumber: row.orderNumber,
        customerName: row.customerName,
        status: 'imported',
        reason: `Imported as ${status}`,
      });
    } catch (err: any) {
      result.errors++;
      result.details.push({
        rowNumber: row.rowNumber,
        orderNumber: row.orderNumber,
        customerName: row.customerName,
        status: 'error',
        reason: err.message || 'Unknown error',
      });
    }
  }

  return result;
}
