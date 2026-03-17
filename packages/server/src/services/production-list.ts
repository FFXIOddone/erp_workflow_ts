/**
 * Production List Service
 * 
 * Provides bidirectional sync between the Excel Production List workbook
 * and the ERP system. The two systems operate independently but complement
 * each other — this service bridges the gap.
 * 
 * Architecture:
 *   Excel Production List ←→ production-list service ←→ ERP WorkOrders
 * 
 * Key concepts from docs/Production List setup:
 * - WO# (col B) is the universal primary key for matching
 * - Section markers in col A define workflow stages
 * - The spreadsheet has its own row-movement lifecycle (see §3)
 * - The ERP has its own status lifecycle (OrderStatus enum)
 * - This service maps between the two without forcing either to change
 */

import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '../db/client.js';
import {
  ProductionListSection,
  ProductionListStyle,
  ProductionListPrintStation,
  PRODUCTION_LIST_SECTION_MARKERS,
  SECTION_TO_ERP_STATUS,
  ERP_STATUS_TO_SECTION,
  PRINT_STATION_TO_ERP_METHOD,
  ERP_METHOD_TO_PRINT_STATION,
} from '@erp/shared';
import type {
  ProductionListRow,
  ProductionListMapping,
  ProductionListFieldDiff,
  ProductionListSyncResult,
  ProductionListSyncRowResult,
  ProductionListSummary,
} from '@erp/shared';

// ─── Constants ─────────────────────────────────────────────────

/** Column indices in the Excel sheet (0-based) */
const COL = {
  A: 0,   // Customer
  B: 1,   // WO#
  C: 2,   // Description
  D: 3,   // Category (hidden)
  E: 4,   // Salesperson
  F: 5,   // Must Ship
  G: 6,   // Proof Date
  H: 7,   // Approval Date
  I: 8,   // Print/Cut Date
  J: 9,   // Print Status
  K: 10,  // Notes
  L: 11,  // Days (calculated)
  M: 12,  // Deadline Warning
} as const;

/** Section marker texts to find (per §3) */
const SECTION_MARKER_MAP: Record<string, ProductionListSection> = {};
for (const [section, marker] of Object.entries(PRODUCTION_LIST_SECTION_MARKERS)) {
  SECTION_MARKER_MAP[marker.toUpperCase()] = section as ProductionListSection;
}
// Legacy markers from removed sections — map to surviving sections
SECTION_MARKER_MAP['FLIP SIGNS & FABRICATION'] = ProductionListSection.DESIGN_PRODUCTION;
SECTION_MARKER_MAP["HARMONY BRANDS INV ORDERS/FOF PO'S"] = ProductionListSection.MONTHLY;

// ─── Types ─────────────────────────────────────────────────────

interface ParseOptions {
  /** Return only rows from these sections */
  sections?: ProductionListSection[];
  /** Include strikethrough (shipped/archived) rows */
  includeArchived?: boolean;
}

// ─── Parsing ───────────────────────────────────────────────────

/**
 * Parse a Production List workbook into structured rows.
 * This is an enhanced version of the existing spreadsheet-import service,
 * designed to capture ALL production list data (not just what's needed for import).
 */
export function parseProductionList(filePath: string, options: ParseOptions = {}): ProductionListRow[] {
  const buffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    cellDates: true,
    cellStyles: true,
    cellNF: true,
  });

  const sheetName = workbook.SheetNames[0]; // Sheet1
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet || !worksheet['!ref']) return [];

  const range = XLSX.utils.decode_range(worksheet['!ref']);
  const rows: ProductionListRow[] = [];
  let currentSection: ProductionListSection = ProductionListSection.CUSTOMER;

  // Start from row 4 (index 3) — rows 1-3 are headers
  for (let r = 3; r <= range.e.r; r++) {
    const rowNum = r + 1;

    const cellA = getCellValue(worksheet, r, COL.A);
    const cellB = getCellValue(worksheet, r, COL.B);
    const customerName = cellA ? String(cellA).trim() : '';
    const woNumber = cellB ? String(cellB).trim() : '';

    // Check for section marker
    const detectedSection = detectSection(customerName);
    if (detectedSection) {
      currentSection = detectedSection;
      continue;
    }

    // Apply section filter
    if (options.sections && !options.sections.includes(currentSection)) {
      continue;
    }

    // Skip rows without a valid WO#
    if (!woNumber || !/^\d+$/.test(woNumber)) {
      continue;
    }

    // Read cell styles / formatting for priority and strikethrough detection
    const cellARef = XLSX.utils.encode_cell({ r, c: COL.A });
    const cellStyle = worksheet[cellARef]?.s;
    const isPriority = isYellowCell(cellStyle);
    const isStrikethrough = hasStrikethrough(cellStyle);

    if (isStrikethrough && !options.includeArchived) {
      continue;
    }

    // Determine visual style
    let style = ProductionListStyle.NORMAL;
    if (isPriority) {
      style = ProductionListStyle.MUST_SHIP;
    }
    // HH Global / InnerWorkings detection
    if (customerName.toLowerCase().includes('hh global') || 
        customerName.toLowerCase().includes('innerworkings')) {
      style = ProductionListStyle.INNER_WORKINGS;
    }

    const row: ProductionListRow = {
      customerName,
      orderNumber: woNumber,
      description: getString(worksheet, r, COL.C),
      category: getString(worksheet, r, COL.D) || null,
      salesperson: getString(worksheet, r, COL.E) || null,
      mustShipDate: getDateOrString(worksheet, r, COL.F),
      proofDate: getDateOrString(worksheet, r, COL.G),
      approvalDate: getDateOrString(worksheet, r, COL.H),
      printCutDate: getDateOrString(worksheet, r, COL.I),
      printStatus: getString(worksheet, r, COL.J) || null,
      notes: getString(worksheet, r, COL.K) || null,
      daysRemaining: getNumber(worksheet, r, COL.L),
      deadlineWarning: getDateOrString(worksheet, r, COL.M),
      section: currentSection,
      style: style as string,
      isPriority,
      isStrikethrough,
      rowNumber: rowNum,
    };

    rows.push(row);
  }

  return rows;
}

// ─── Comparison / Mapping ──────────────────────────────────────

/**
 * Compare Production List rows against ERP WorkOrders.
 * Returns a mapping with differences for each matched order.
 */
export async function compareWithERP(
  rows: ProductionListRow[]
): Promise<ProductionListMapping[]> {
  const orderNumbers = rows.map(r => r.orderNumber);

  // Fetch all matching ERP orders
  const erpOrders = await prisma.workOrder.findMany({
    where: { orderNumber: { in: orderNumbers } },
    include: {
      stationProgress: true,
      company: { select: { name: true } },
    },
  });
  const erpMap = new Map(erpOrders.map(o => [o.orderNumber, o]));

  const mappings: ProductionListMapping[] = [];

  for (const row of rows) {
    const erpOrder = erpMap.get(row.orderNumber);
    const differences: ProductionListFieldDiff[] = [];

    if (!erpOrder) {
      mappings.push({
        orderNumber: row.orderNumber,
        erpOrderId: null,
        spreadsheetSection: row.section,
        erpStatus: null,
        hasDifferences: true,
        differences: [{
          field: 'existence',
          spreadsheetValue: 'exists',
          erpValue: null,
          preferredSource: 'spreadsheet',
        }],
      });
      continue;
    }

    // Compare fields
    if (row.customerName !== erpOrder.customerName) {
      differences.push({
        field: 'customerName',
        spreadsheetValue: row.customerName,
        erpValue: erpOrder.customerName,
      });
    }

    // Compare description (strip the date suffix from spreadsheet description)
    const descClean = row.description.replace(/\s*\(\d{1,2}\/\d{1,2}\/\d{2,4}\)\s*$/, '');
    if (descClean && erpOrder.description && descClean !== erpOrder.description) {
      differences.push({
        field: 'description',
        spreadsheetValue: descClean,
        erpValue: erpOrder.description,
      });
    }

    // Compare due date
    const spreadsheetDue = row.mustShipDate ? new Date(row.mustShipDate).toISOString().split('T')[0] : null;
    const erpDue = erpOrder.dueDate ? erpOrder.dueDate.toISOString().split('T')[0] : null;
    if (spreadsheetDue !== erpDue) {
      differences.push({
        field: 'dueDate',
        spreadsheetValue: spreadsheetDue,
        erpValue: erpDue,
        preferredSource: 'spreadsheet', // Must Ship date on the Excel is usually authoritative
      });
    }

    // Compare status mapping — use same smart logic as getERPAsProductionListRows
    let expectedSection = ERP_STATUS_TO_SECTION[erpOrder.status] || ProductionListSection.DESIGN_PRODUCTION;
    const custLowerCmp = erpOrder.customerName.toLowerCase();
    const isDesignOnlyCmp = erpOrder.description.includes('(DESIGN ONLY)') || (erpOrder.routing?.length > 0 && erpOrder.routing.every((r: string) => r === 'DESIGN'));
    const isOutsourcedCmp = erpOrder.description.includes('(OUTSOURCED)');
    const isHHGlobalCmp = custLowerCmp.includes('hh global') || custLowerCmp.includes('innerworkings') || custLowerCmp.includes('harmony');
    if (isDesignOnlyCmp) expectedSection = ProductionListSection.DESIGN_ONLY;
    else if (isOutsourcedCmp) expectedSection = ProductionListSection.OUTSOURCED;
    else if (isHHGlobalCmp) expectedSection = ProductionListSection.MONTHLY;
    if (row.section !== expectedSection) {
      differences.push({
        field: 'status/section',
        spreadsheetValue: `${row.section} (section)`,
        erpValue: `${erpOrder.status} → expects ${expectedSection}`,
      });
    }

    // Compare notes
    if (row.notes && row.notes !== erpOrder.notes) {
      differences.push({
        field: 'notes',
        spreadsheetValue: row.notes,
        erpValue: erpOrder.notes || null,
      });
    }

    // Compare print status / station completion
    const erpStationStatus = buildPrintStatusFromERP(erpOrder.stationProgress);
    if (row.printStatus && erpStationStatus && row.printStatus !== erpStationStatus) {
      differences.push({
        field: 'printStatus',
        spreadsheetValue: row.printStatus,
        erpValue: erpStationStatus,
      });
    }

    mappings.push({
      orderNumber: row.orderNumber,
      erpOrderId: erpOrder.id,
      spreadsheetSection: row.section,
      erpStatus: erpOrder.status,
      hasDifferences: differences.length > 0,
      differences,
    });
  }

  // Also find ERP orders NOT in the spreadsheet
  const spreadsheetNumbers = new Set(orderNumbers);
  const erpOnlyOrders = await prisma.workOrder.findMany({
    where: {
      orderNumber: { notIn: orderNumbers },
      status: { notIn: ['CANCELLED', 'COMPLETED', 'SHIPPED'] },
    },
    select: { id: true, orderNumber: true, status: true, customerName: true },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  for (const erpOrder of erpOnlyOrders) {
    mappings.push({
      orderNumber: erpOrder.orderNumber,
      erpOrderId: erpOrder.id,
      spreadsheetSection: '',
      erpStatus: erpOrder.status,
      hasDifferences: true,
      differences: [{
        field: 'existence',
        spreadsheetValue: null,
        erpValue: 'exists',
        preferredSource: 'erp',
      }],
    });
  }

  return mappings;
}

// ─── Sync Operations ───────────────────────────────────────────

/**
 * Sync from Production List spreadsheet INTO the ERP.
 * Creates new orders for unmatched WO#s, updates existing orders with
 * missing data from the spreadsheet. Never overwrites ERP data unless
 * preferSpreadsheet is true.
 */
export async function syncFromSpreadsheet(
  filePath: string,
  userId: string,
  options: {
    dryRun?: boolean;
    preferSpreadsheet?: boolean;
    sections?: ProductionListSection[];
  } = {}
): Promise<ProductionListSyncResult> {
  const rows = parseProductionList(filePath, { sections: options.sections });

  const syncId = options.dryRun ? 'dry-run' : `sync-${Date.now()}`;

  const result: ProductionListSyncResult = {
    syncId,
    direction: 'IMPORT',
    startedAt: new Date(),
    completedAt: null,
    status: 'IN_PROGRESS',
    fileName: path.basename(filePath),
    totalRows: rows.length,
    matched: 0,
    spreadsheetOnly: 0,
    erpOnly: 0,
    imported: 0,
    updated: 0,
    exported: 0,
    skipped: 0,
    errors: 0,
    details: [],
  };

  // Get existing orders
  const orderNumbers = rows.map(r => r.orderNumber);
  const existingOrders = await prisma.workOrder.findMany({
    where: { orderNumber: { in: orderNumbers } },
    include: { stationProgress: true },
  });
  const existingMap = new Map(existingOrders.map(o => [o.orderNumber, o]));

  // Company lookup for matching
  const companies = await prisma.company.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });
  const companyMap = new Map(companies.map(c => [c.name.toLowerCase(), c]));

  for (const row of rows) {
    const existing = existingMap.get(row.orderNumber);

    if (existing) {
      result.matched++;

      // Determine what fields to update
      const updates: Record<string, any> = {};
      const updatedFields: string[] = [];

      // Fill in missing data from spreadsheet
      if (!existing.dueDate && row.mustShipDate) {
        updates.dueDate = new Date(row.mustShipDate);
        updatedFields.push('dueDate');
      }

      if ((!existing.notes || existing.notes === '') && row.notes) {
        updates.notes = row.notes;
        updatedFields.push('notes');
      }

      if ((!existing.customerName || existing.customerName === 'Unknown Customer') && row.customerName) {
        updates.customerName = row.customerName;
        updatedFields.push('customerName');
      }

      if ((!existing.description || existing.description === 'Imported Order') && row.description) {
        // Strip the date suffix from the description formula
        const desc = row.description.replace(/\s*\(\d{1,2}\/\d{1,2}\/\d{2,4}\)\s*$/, '');
        if (desc) {
          updates.description = desc;
          updatedFields.push('description');
        }
      }

      // If preferSpreadsheet, overwrite even populated fields
      if (options.preferSpreadsheet) {
        if (row.mustShipDate && existing.dueDate) {
          const newDate = new Date(row.mustShipDate);
          if (newDate.toISOString() !== existing.dueDate.toISOString()) {
            updates.dueDate = newDate;
            if (!updatedFields.includes('dueDate')) updatedFields.push('dueDate');
          }
        }
        if (row.notes && row.notes !== existing.notes) {
          updates.notes = row.notes;
          if (!updatedFields.includes('notes')) updatedFields.push('notes');
        }
      }

      // Update status based on section mapping
      const expectedStatus = SECTION_TO_ERP_STATUS[row.section as ProductionListSection];
      if (expectedStatus && existing.status === 'PENDING' && expectedStatus !== 'PENDING') {
        updates.status = expectedStatus;
        updatedFields.push(`status→${expectedStatus}`);
      }

      // Link company if not linked
      if (!existing.companyId) {
        const matchedCompany = companyMap.get(row.customerName.toLowerCase());
        if (matchedCompany) {
          updates.companyId = matchedCompany.id;
          updatedFields.push('companyId');
        }
      }

      if (updatedFields.length === 0) {
        result.skipped++;
        result.details.push({
          orderNumber: row.orderNumber,
          customerName: row.customerName,
          action: 'skipped',
          reason: 'All fields already populated',
        });
        continue;
      }

      if (!options.dryRun) {
        try {
          await prisma.workOrder.update({
            where: { id: existing.id },
            data: updates,
          });

          await prisma.workEvent.create({
            data: {
              orderId: existing.id,
              eventType: 'NOTE_ADDED',
              description: `Synced from Production List: ${updatedFields.join(', ')}`,
              userId,
            },
          });


        } catch (err: any) {
          result.errors++;
          result.details.push({
            orderNumber: row.orderNumber,
            customerName: row.customerName,
            action: 'error',
            reason: err.message || 'Update failed',
          });
          continue;
        }
      }

      result.updated++;
      result.details.push({
        orderNumber: row.orderNumber,
        customerName: row.customerName,
        action: 'updated',
        reason: `Updated: ${updatedFields.join(', ')}`,
      });
    } else {
      // New order — create in ERP
      result.spreadsheetOnly++;

      if (!options.dryRun) {
        try {
          const status = SECTION_TO_ERP_STATUS[row.section as ProductionListSection] || 'PENDING';
          const routing = parseRoutingFromPrintStatus(row.printStatus);
          const matchedCompany = companyMap.get(row.customerName.toLowerCase());

          // Determine brand from WO# length (4-digit = Port City, 5-digit = Wilde)
          const brand = row.orderNumber.length === 4 ? 'PORT_CITY_SIGNS' : 'WILDE_SIGNS';

          const desc = row.description.replace(/\s*\(\d{1,2}\/\d{1,2}\/\d{2,4}\)\s*$/, '');

          const newOrder = await prisma.workOrder.create({
            data: {
              orderNumber: row.orderNumber,
              customerName: row.customerName,
              description: desc || `Order ${row.orderNumber}`,
              status: status as any,
              priority: row.isPriority ? 1 : (row.style === 'ATTENTION' ? 2 : 3),
              companyBrand: brand as any,
              dueDate: row.mustShipDate ? new Date(row.mustShipDate) : null,
              notes: row.notes,
              routing: routing as any,
              createdById: userId,
              isTempOrder: false,
              ...(matchedCompany ? { companyId: matchedCompany.id } : {}),
              stationProgress: routing.length > 0 ? {
                create: routing.map(station => ({
                  station: station as any,
                  status: (status === 'COMPLETED' ? 'COMPLETED' : 'NOT_STARTED') as any,
                })),
              } : undefined,
              events: {
                create: {
                  eventType: 'CREATED',
                  description: `Imported from Production List (${row.section}, Row ${row.rowNumber})`,
                  userId,
                },
              },
            },
          });


        } catch (err: any) {
          result.errors++;
          result.details.push({
            orderNumber: row.orderNumber,
            customerName: row.customerName,
            action: 'error',
            reason: err.message || 'Create failed',
          });
          continue;
        }
      }

      result.imported++;
      result.details.push({
        orderNumber: row.orderNumber,
        customerName: row.customerName,
        action: 'imported',
        reason: `Imported as ${SECTION_TO_ERP_STATUS[row.section as ProductionListSection] || 'PENDING'}`,
      });
    }
  }

  // Finalize
  result.completedAt = new Date();
  result.status = result.errors > 0
    ? (result.imported > 0 || result.updated > 0 ? 'PARTIAL' : 'FAILED')
    : 'COMPLETED';

  // Count ERP-only orders
  const erpOnlyCount = await prisma.workOrder.count({
    where: {
      orderNumber: { notIn: rows.map(r => r.orderNumber) },
      status: { notIn: ['CANCELLED', 'COMPLETED', 'SHIPPED'] },
    },
  });
  result.erpOnly = erpOnlyCount;



  return result;
}

// ─── Summary / Dashboard ───────────────────────────────────────

/**
 * Build a summary of the current Production List state for the UI.
 * This queries the ERP data and maps it to production list concepts.
 */
export async function getProductionListSummary(): Promise<ProductionListSummary> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // No persistent sync record table — return null placeholders
  const lastSync: { startedAt: Date | null; status: string | null; matched: number; spreadsheetOnly: number } | null = null as { startedAt: Date | null; status: string | null; matched: number; spreadsheetOnly: number } | null;

  // Get active orders with station progress
  const activeOrders = await prisma.workOrder.findMany({
    where: {
      status: { notIn: ['CANCELLED', 'COMPLETED'] },
    },
    include: {
      stationProgress: true,
      subcontractJobs: { select: { id: true }, where: { status: { not: 'CANCELLED' } } },
    },
  }) as (Awaited<ReturnType<typeof prisma.workOrder.findMany>>[number] & {
    stationProgress: Array<{ station: string; status: string; completedAt: Date | null }>;
    subcontractJobs: Array<{ id: string }>;
  })[];

  // Section counts based on ERP status mapping
  const sectionCounts: Record<string, number> = {};
  Object.values(ProductionListSection).forEach(s => { sectionCounts[s] = 0; });

  const dayAfterTomorrow = new Date(today);
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

  let dueToday = 0;
  let dueTomorrow = 0;
  let overdue = 0;
  let awaitingApproval = 0;
  let printingComplete = 0;
  let printingPending = 0;

  for (const order of activeOrders) {
    let section = ERP_STATUS_TO_SECTION[order.status] || ProductionListSection.DESIGN_PRODUCTION;

    const custLower = order.customerName.toLowerCase();
    const isHHGlobal = custLower.includes('hh global') || custLower.includes('innerworkings') || custLower.includes('harmony');
    const isDesignOnly = order.description.includes('(DESIGN ONLY)') || (order.routing.length > 0 && order.routing.every((r: string) => r === 'DESIGN'));
    const isOutsourced = order.subcontractJobs.length > 0 || order.description.includes('(OUTSOURCED)');

    if (isDesignOnly) {
      section = ProductionListSection.DESIGN_ONLY;
    } else if (isOutsourced) {
      section = ProductionListSection.OUTSOURCED;
    } else if (isHHGlobal) {
      section = ProductionListSection.MONTHLY;
    }

    if (order.dueDate) {
      const due = new Date(order.dueDate);
      const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());

      if (dueDay.getTime() === today.getTime()) dueToday++;
      else if (dueDay.getTime() === tomorrow.getTime()) dueTomorrow++;
      else if (dueDay < today) overdue++;

      // Override to CUSTOMER section if due today, tomorrow, or overdue
      // But NOT for design-only or outsourced orders
      if (dueDay < dayAfterTomorrow && !isDesignOnly && !isOutsourced && !['ON_HOLD'].includes(order.status)) {
        section = ProductionListSection.CUSTOMER;
      }
    }

    sectionCounts[section] = (sectionCounts[section] || 0) + 1;

    // Check station progress for printing status
    const printStations = order.stationProgress.filter(sp =>
      ['ROLL_TO_ROLL', 'FLATBED', 'PRODUCTION'].includes(sp.station)
    );
    if (printStations.length > 0) {
      const allComplete = printStations.every(sp => sp.status === 'COMPLETED');
      if (allComplete) printingComplete++;
      else printingPending++;
    }

    // Orders in PENDING with no station progress started = awaiting approval
    if (order.status === 'PENDING' && 
        order.stationProgress.every(sp => sp.status === 'NOT_STARTED')) {
      awaitingApproval++;
    }
  }

  return {
    lastSyncAt: lastSync?.startedAt || null,
    lastSyncStatus: lastSync?.status || null,
    sectionCounts,
    totalActiveOrders: activeOrders.length,
    dueToday,
    dueTomorrow,
    overdue,
    awaitingApproval,
    printingComplete,
    printingPending,
    erpMatchedCount: lastSync?.matched || 0,
    unmatchedCount: lastSync?.spreadsheetOnly || 0,
  };
}

/**
 * Get ERP orders formatted as Production List rows.
 * This is for the UI to display ERP data in the familiar spreadsheet layout.
 */
export async function getERPAsProductionListRows(
  options: {
    sections?: string[];
    includeCompleted?: boolean;
    search?: string;
  } = {}
): Promise<ProductionListRow[]> {
  const where: any = {};

  if (!options.includeCompleted) {
    where.status = { notIn: ['CANCELLED', 'SHIPPED', 'COMPLETED'] };
  }

  if (options.search) {
    where.OR = [
      { orderNumber: { contains: options.search, mode: 'insensitive' } },
      { customerName: { contains: options.search, mode: 'insensitive' } },
      { description: { contains: options.search, mode: 'insensitive' } },
    ];
  }

  const orders = await prisma.workOrder.findMany({
    where,
    include: {
      stationProgress: true,
      assignedTo: { select: { displayName: true } },
      company: { select: { name: true } },
      subcontractJobs: { select: { id: true }, where: { status: { not: 'CANCELLED' } } },
    },
    orderBy: [
      { dueDate: 'asc' },
      { customerName: 'asc' },
    ],
  });

  const rows: ProductionListRow[] = [];
  let rowNum = 4; // Starting row like the Excel sheet

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayAfterTomorrow = new Date(today);
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

  for (const order of orders) {
    let section = ERP_STATUS_TO_SECTION[order.status] || ProductionListSection.DESIGN_PRODUCTION;

    const custLower = order.customerName.toLowerCase();
    const isHHGlobal = custLower.includes('hh global') || custLower.includes('innerworkings') || custLower.includes('harmony');
    const isDesignOnly = order.description.includes('(DESIGN ONLY)') || (order.routing.length > 0 && order.routing.every((r: string) => r === 'DESIGN'));
    const isOutsourced = order.subcontractJobs.length > 0 || order.description.includes('(OUTSOURCED)');

    // Category-based overrides (highest priority first, except CUSTOMER date override)
    if (isDesignOnly) {
      section = ProductionListSection.DESIGN_ONLY;
    } else if (isOutsourced) {
      section = ProductionListSection.OUTSOURCED;
    } else if (isHHGlobal) {
      section = ProductionListSection.MONTHLY;
    }

    // Override to CUSTOMER ("Shipping Today/Tomorrow") if due date is today, tomorrow, or overdue
    // But NOT for design-only or outsourced orders — those stay in their dedicated sections
    if (
      order.dueDate &&
      !isDesignOnly &&
      !isOutsourced &&
      !['COMPLETED', 'SHIPPED', 'CANCELLED', 'ON_HOLD'].includes(order.status)
    ) {
      const dueDate = new Date(order.dueDate);
      const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
      if (dueDateOnly < dayAfterTomorrow) {
        section = ProductionListSection.CUSTOMER;
      }
    }

    // Filter by section if specified
    if (options.sections && options.sections.length > 0 && !options.sections.includes(section)) {
      continue;
    }

    const printStatus = buildPrintStatusFromERP(order.stationProgress);
    const isOverdue = order.dueDate && new Date(order.dueDate) < now;
    const isPriority = order.priority <= 1 || isOverdue;

    let style = ProductionListStyle.NORMAL;
    if (isPriority) style = ProductionListStyle.MUST_SHIP;
    if (order.priority === 2) style = ProductionListStyle.ATTENTION;
    if (order.customerName.toLowerCase().includes('hh global') ||
        order.customerName.toLowerCase().includes('innerworkings')) {
      style = ProductionListStyle.INNER_WORKINGS;
    }

    // Calculate days remaining (like col L formula)
    let daysRemaining: number | null = null;
    if (order.dueDate) {
      const msPerDay = 86400000;
      daysRemaining = Math.ceil((new Date(order.dueDate).getTime() - now.getTime()) / msPerDay);
    }

    rows.push({
      customerName: order.customerName,
      orderNumber: order.orderNumber,
      description: order.description + (order.dueDate ? ` (${formatShortDate(order.dueDate)})` : ''),
      category: null,
      salesperson: order.assignedTo?.displayName || null,
      mustShipDate: order.dueDate?.toISOString() || null,
      proofDate: null, // Would come from proof index
      approvalDate: null, // Would come from email scan
      printCutDate: null, // Would come from print/cut index
      printStatus,
      notes: order.notes,
      daysRemaining,
      deadlineWarning: daysRemaining !== null && daysRemaining < 7 && daysRemaining >= 0
        ? new Date(now.getTime() + 7 * 86400000).toISOString()
        : null,
      section,
      style: style as string,
      isPriority: isPriority || false,
      isStrikethrough: ['SHIPPED', 'COMPLETED'].includes(order.status),
      rowNumber: rowNum++,
    });
  }

  return rows;
}

// ─── Sync History ──────────────────────────────────────────────

/**
 * Get sync history with pagination.
 */
export async function getSyncHistory(options: { limit?: number; offset?: number } = {}) {
  // Sync history table not yet available in the Prisma schema
  return { syncs: [] as any[], total: 0 };
}

// ─── Helpers ───────────────────────────────────────────────────

function getCellValue(ws: XLSX.WorkSheet, row: number, col: number): unknown {
  const ref = XLSX.utils.encode_cell({ r: row, c: col });
  return ws[ref]?.v;
}

function getString(ws: XLSX.WorkSheet, row: number, col: number): string {
  const v = getCellValue(ws, row, col);
  return v != null ? String(v).trim() : '';
}

function getNumber(ws: XLSX.WorkSheet, row: number, col: number): number | null {
  const v = getCellValue(ws, row, col);
  if (v == null) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function getDateOrString(ws: XLSX.WorkSheet, row: number, col: number): Date | string | null {
  const v = getCellValue(ws, row, col);
  if (v == null) return null;
  if (v instanceof Date) return v;
  const s = String(v).trim();
  if (s === 'N/A' || s === '-' || s === '') return s || null;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  // Try Excel serial date
  if (typeof v === 'number') {
    const epoch = new Date(1899, 11, 30);
    return new Date(epoch.getTime() + v * 86400000);
  }
  return s;
}

function detectSection(text: string): ProductionListSection | null {
  if (!text) return null;
  const upper = text.toUpperCase();

  // Check each marker (order matters — some markers are substrings of others)
  for (const [marker, section] of Object.entries(SECTION_MARKER_MAP)) {
    if (upper.includes(marker)) return section;
  }

  // Also handle the Unicode ellipsis variant
  if (upper.includes('COMING UP') || text.includes('\u2026')) {
    if (upper.includes('COMING UP')) return ProductionListSection.COMING_UP;
  }

  return null;
}

function isYellowCell(_style: any): boolean {
  // XLSX cellStyles parsing is limited without full style support — this is a best-effort
  if (!_style) return false;
  if (_style.fill?.fgColor?.rgb === 'FFFF00' || _style.fill?.fgColor?.rgb === 'FFFFFF00') return true;
  return false;
}

function hasStrikethrough(_style: any): boolean {
  if (!_style) return false;
  return _style.font?.strike === true;
}

/**
 * Build a print status string from ERP station progress (like col J).
 * Returns a date string if all print stations complete, or station flags otherwise.
 */
function buildPrintStatusFromERP(stationProgress: Array<{ station: string; status: string; completedAt: Date | null }>): string | null {
  const printStations = stationProgress.filter(sp =>
    ERP_METHOD_TO_PRINT_STATION[sp.station] != null
  );

  if (printStations.length === 0) return null;

  const allComplete = printStations.every(sp => sp.status === 'COMPLETED');
  if (allComplete) {
    // Return the latest completion date
    const latestDate = printStations
      .filter(sp => sp.completedAt)
      .map(sp => sp.completedAt!)
      .sort((a, b) => b.getTime() - a.getTime())[0];
    return latestDate ? formatShortDate(latestDate) : 'Complete';
  }

  // Return flags for incomplete stations
  const flags = printStations
    .filter(sp => sp.status !== 'COMPLETED')
    .map(sp => ERP_METHOD_TO_PRINT_STATION[sp.station])
    .filter(Boolean)
    .join(' ');

  return flags || null;
}

/**
 * Parse routing stations from print status text (e.g., "RR FB" → PrintingMethod[])
 */
function parseRoutingFromPrintStatus(printStatus: string | null): string[] {
  if (!printStatus) return [];
  const methods: string[] = [];
  const upper = printStatus.toUpperCase().trim();
  const tokens = upper.split(/\s+/);

  for (const token of tokens) {
    const method = PRINT_STATION_TO_ERP_METHOD[token as ProductionListPrintStation];
    if (method) methods.push(method);
  }

  return methods;
}

function formatShortDate(date: Date | string): string {
  const d = new Date(date);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()}-${months[d.getMonth()]}`;
}

// Snapshot creation is a no-op until the ProductionListSnapshot model is added to Prisma schema
async function createSnapshot(
  _syncId: string,
  _row: ProductionListRow,
  _workOrderId: string | null
): Promise<void> {
  // TODO: Implement once productionListSnapshot model is added to the Prisma schema
}
