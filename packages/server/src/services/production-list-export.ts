/**
 * Production List Export Service
 * 
 * Generates Excel workbooks in the Production List format from ERP data.
 * This allows the ERP to produce a spreadsheet that is compatible with
 * the existing VBA macro workbook, so both systems can be used side by side.
 * 
 * The export follows the exact column layout and section structure from
 * docs/Production List setup §2-§4.
 */

import * as XLSX from 'xlsx';
import { prisma } from '../db/client.js';
import {
  ProductionListSection,
  PRODUCTION_LIST_SECTION_MARKERS,
  PRODUCTION_LIST_SECTION_DISPLAY_NAMES,
  ERP_STATUS_TO_SECTION,
  ERP_METHOD_TO_PRINT_STATION,
} from '@erp/shared';
import { PrintingMethod } from '@prisma/client';

// ─── Export to Excel ───────────────────────────────────────────

interface ExportOptions {
  sections?: ProductionListSection[];
  includeCompleted?: boolean;
  includeOnHold?: boolean;
  listDate?: Date;
  format?: 'xlsx' | 'csv' | 'json';
}

/**
 * Generate a Production List Excel workbook from ERP data.
 * Returns a Buffer containing the .xlsx file.
 */
export async function exportToProductionListFormat(
  options: ExportOptions = {}
): Promise<{ buffer: Buffer; filename: string }> {
  const {
    sections,
    includeCompleted = false,
    includeOnHold = true,
    listDate = getNextWorkday(),
  } = options;

  // Query all relevant orders
  const where: any = {
    status: { notIn: ['CANCELLED'] },
  };
  if (!includeCompleted) {
    where.status.notIn = ['CANCELLED', 'SHIPPED'];
  }
  if (!includeOnHold) {
    where.status.notIn = [...(where.status.notIn || []), 'ON_HOLD'];
  }

  const orders = await prisma.workOrder.findMany({
    where,
    include: {
      stationProgress: true,
      assignedTo: { select: { displayName: true } },
    },
    orderBy: [
      { dueDate: 'asc' },
      { customerName: 'asc' },
    ],
  });

  // Group orders by section
  const sectionGroups = new Map<ProductionListSection, typeof orders>();
  for (const section of Object.values(ProductionListSection)) {
    sectionGroups.set(section, []);
  }

  for (const order of orders) {
    const section = ERP_STATUS_TO_SECTION[order.status] || ProductionListSection.DESIGN_PRODUCTION;
    if (sections && !sections.includes(section)) continue;
    sectionGroups.get(section)?.push(order);
  }

  // Build the worksheet data
  const wsData: (string | number | Date | null)[][] = [];

  // Row 1: Date header
  const d = new Date(listDate);
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const dateStr = `${dayNames[d.getDay()]}, ${monthNames[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  wsData.push([dateStr, null, null, null, null, null, null, null, null, null, null, null, null]);

  // Row 2: Empty (formula seeds in the real sheet)
  wsData.push([null, null, null, null, null, null, null, null, null, null, null, null, null]);

  // Row 3: Column headers
  wsData.push([
    'Customer', 'WO#', 'Description', '', 'Salesperson',
    'Must Ship', 'Proof Date', 'Approval', 'Print/Cut', 'Print Status',
    'Notes', 'Days', 'Deadline',
  ]);

  // Build sections in the canonical order
  const sectionOrder: ProductionListSection[] = [
    ProductionListSection.CUSTOMER,
    ProductionListSection.MONTHLY,
    ProductionListSection.COMING_UP,
    ProductionListSection.DESIGN_PRODUCTION,
    ProductionListSection.DESIGN_ONLY,
    ProductionListSection.OUTSOURCED,
    ProductionListSection.INSTALL_READY,
    ProductionListSection.ON_HOLD,
  ];

  for (const section of sectionOrder) {
    if (sections && !sections.includes(section)) continue;

    const sectionOrders = sectionGroups.get(section) || [];

    // Section marker row
    const markerText = PRODUCTION_LIST_SECTION_MARKERS[section];
    wsData.push([markerText, null, null, null, null, null, null, null, null, null, null, null, null]);

    // Order rows
    for (const order of sectionOrders) {
      const printStatus = buildPrintStatus(order.stationProgress);
      const daysRemaining = order.dueDate
        ? Math.ceil((new Date(order.dueDate).getTime() - Date.now()) / 86400000)
        : null;

      wsData.push([
        order.customerName,
        order.orderNumber,
        order.description + (order.dueDate ? ` (${formatDate(order.dueDate)})` : ''),
        '', // Col D hidden category
        order.assignedTo?.displayName || '',
        order.dueDate ? formatDate(order.dueDate) : '',
        '', // Proof date — from external index
        '', // Approval date — from email scan
        '', // Print/Cut date — from external index
        printStatus || '',
        order.notes || '',
        daysRemaining != null ? daysRemaining : '',
        '', // Deadline warning — formula-based
      ]);
    }
  }

  // Create workbook
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths to match the Excel sheet
  ws['!cols'] = [
    { wch: 25 },  // A: Customer
    { wch: 10 },  // B: WO#
    { wch: 40 },  // C: Description
    { wch: 2 },   // D: Category (hidden)
    { wch: 15 },  // E: Salesperson
    { wch: 12 },  // F: Must Ship
    { wch: 12 },  // G: Proof Date
    { wch: 12 },  // H: Approval
    { wch: 12 },  // I: Print/Cut
    { wch: 12 },  // J: Print Status
    { wch: 25 },  // K: Notes
    { wch: 8 },   // L: Days
    { wch: 12 },  // M: Deadline
  ];

  // Hide column D
  ws['!cols'][3].hidden = true;

  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

  // Generate filename
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  const filename = `Production List_${mm}_${dd}_${yy}.xlsx`;

  const buffer = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

  return { buffer, filename };
}

/**
 * Export ERP orders as a printing sub-list (Roll-to-Roll, Flatbed, or Zund).
 * Follows the sub-list column mapping from §4.
 */
export async function exportPrintingSubList(
  station: 'RR' | 'FB' | 'Z'
): Promise<{ buffer: Buffer; filename: string }> {
  // Map station code to ERP PrintingMethod
  const stationMethodMap: Record<string, PrintingMethod> = {
    'RR': 'ROLL_TO_ROLL' as PrintingMethod,
    'FB': 'FLATBED' as PrintingMethod,
    'Z': 'PRODUCTION' as PrintingMethod,
  };
  const method = stationMethodMap[station];

  // Find orders that have this station in their routing & not fully complete
  const orders = await prisma.workOrder.findMany({
    where: {
      status: { notIn: ['CANCELLED', 'SHIPPED'] },
      stationProgress: {
        some: {
          station: method,
          status: { not: 'COMPLETED' },
        },
      },
    },
    include: {
      stationProgress: { where: { station: method } },
      assignedTo: { select: { displayName: true } },
    },
    orderBy: [
      { dueDate: 'asc' },
      { customerName: 'asc' },
    ],
  });

  const wsData: (string | number | Date | null)[][] = [];

  // Row 1: Title
  const stationNames: Record<string, string> = {
    'RR': 'Roll to Roll',
    'FB': 'Flatbed',
    'Z': 'Zund',
  };
  wsData.push([`${stationNames[station]} Print List`, null, null, null, null, null, null]);

  // Row 2: empty
  wsData.push([null, null, null, null, null, null, null]);

  // Row 3: Headers (matches sub-list format from §4)
  wsData.push(['Customer', 'WO#', 'Description', '', 'Salesperson', 'Must Ship', 'Complete']);

  // Data rows
  for (const order of orders) {
    const progress = order.stationProgress[0];
    const completeStatus = progress?.status === 'COMPLETED'
      ? formatDate(progress.completedAt || new Date())
      : '';

    wsData.push([
      order.customerName,
      order.orderNumber,
      order.description + (order.dueDate ? ` (${formatDate(order.dueDate)})` : ''),
      '', // Spacer col D
      order.assignedTo?.displayName || '',
      order.dueDate ? formatDate(order.dueDate) : '',
      completeStatus,
    ]);
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  ws['!cols'] = [
    { wch: 25 },  // A: Customer
    { wch: 10 },  // B: WO#
    { wch: 40 },  // C: Description
    { wch: 2 },   // D: Spacer
    { wch: 15 },  // E: Salesperson
    { wch: 12 },  // F: Must Ship
    { wch: 12 },  // G: Complete
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

  const filename = `${stationNames[station]} List.xlsx`;
  const buffer = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

  return { buffer, filename };
}

// ─── Helpers ───────────────────────────────────────────────────

function buildPrintStatus(stationProgress: Array<{ station: string; status: string; completedAt: Date | null }>): string | null {
  const printStations = stationProgress.filter(sp =>
    ERP_METHOD_TO_PRINT_STATION[sp.station] != null
  );

  if (printStations.length === 0) return null;

  const allComplete = printStations.every(sp => sp.status === 'COMPLETED');
  if (allComplete) {
    const latest = printStations
      .filter(sp => sp.completedAt)
      .map(sp => sp.completedAt!)
      .sort((a, b) => b.getTime() - a.getTime())[0];
    return latest ? formatDate(latest) : 'Complete';
  }

  return printStations
    .filter(sp => sp.status !== 'COMPLETED')
    .map(sp => ERP_METHOD_TO_PRINT_STATION[sp.station])
    .filter(Boolean)
    .join(' ');
}

function formatDate(date: Date | string): string {
  const d = new Date(date);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${mm}/${dd}/${yy}`;
}

function getNextWorkday(): Date {
  const now = new Date();
  const day = now.getDay();
  const add = day === 5 ? 3 : day === 6 ? 2 : 1;
  const next = new Date(now);
  next.setDate(next.getDate() + add);
  return next;
}
