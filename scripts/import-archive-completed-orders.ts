/**
 * One-time archive backfill for the Production List archive workbook.
 *
 * This script:
 * - Reads `C:\Users\Jake\OneDrive - Wilde Signs\Production List\Archive\archive.xlsx`
 * - Dedupes by WO #
 * - Updates existing ERP work orders
 * - Creates missing historical work orders as terminal records
 * - Seeds shipment placeholders for shipped archive rows
 *
 * Run:
 *   npx tsx scripts/import-archive-completed-orders.ts --apply
 *
 * Dry run:
 *   npx tsx scripts/import-archive-completed-orders.ts
 */

import { PrismaClient } from '@prisma/client';
import XLSX from 'xlsx';
import {
  PrintingMethod,
  StationStatus,
  isDesignOnlyOrder,
} from '@erp/shared';
import { resolveImportedRouting } from '../packages/server/src/lib/routing-defaults.js';
import { ensureShipmentRecordForWorkOrder } from '../packages/server/src/services/shipment-linking.js';

type MaybeDate = Date | null;

interface ArchiveRow {
  rowNumber: number;
  customerName: string;
  orderNumber: string;
  description: string;
  createdDate: MaybeDate;
  mustShipDate: MaybeDate;
  proofedDate: MaybeDate;
  approvedDate: MaybeDate;
  printSetupDate: MaybeDate;
  mmPrintedDate: MaybeDate;
  mmPrintedRouting: PrintingMethod[];
  shippedDate: MaybeDate;
}

interface ExistingOrderRow {
  id: string;
  orderNumber: string;
  customerName: string;
  description: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'SHIPPED' | 'CANCELLED';
  dueDate: Date | null;
  notes: string | null;
  routing: PrintingMethod[];
  companyId: string | null;
  _count: {
    stationProgress: number;
    shipments: number;
  };
}

interface CompanyRow {
  id: string;
  name: string;
}

const prisma = new PrismaClient();
const INPUT_PATH = 'C:\\Users\\Jake\\OneDrive - Wilde Signs\\Production List\\Archive\\archive.xlsx';

const DATE_FMT = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const ROUTING_TOKEN_MAP: Record<string, PrintingMethod[]> = {
  RR: [PrintingMethod.ROLL_TO_ROLL, PrintingMethod.ROLL_TO_ROLL_PRINTING],
  MM: [PrintingMethod.ROLL_TO_ROLL, PrintingMethod.ROLL_TO_ROLL_PRINTING],
  FB: [PrintingMethod.FLATBED, PrintingMethod.FLATBED_PRINTING],
  SP: [PrintingMethod.SCREEN_PRINT, PrintingMethod.SCREEN_PRINT_PRINTING, PrintingMethod.SCREEN_PRINT_ASSEMBLY],
  Z: [PrintingMethod.PRODUCTION, PrintingMethod.PRODUCTION_ZUND, PrintingMethod.PRODUCTION_FINISHING],
  ZUND: [PrintingMethod.PRODUCTION, PrintingMethod.PRODUCTION_ZUND, PrintingMethod.PRODUCTION_FINISHING],
  PROD: [PrintingMethod.PRODUCTION, PrintingMethod.PRODUCTION_ZUND, PrintingMethod.PRODUCTION_FINISHING],
  PRODUCTION: [PrintingMethod.PRODUCTION, PrintingMethod.PRODUCTION_ZUND, PrintingMethod.PRODUCTION_FINISHING],
  FAB: [PrintingMethod.PRODUCTION, PrintingMethod.PRODUCTION_ZUND, PrintingMethod.PRODUCTION_FINISHING],
};

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const epoch = new Date(1899, 11, 30);
    return new Date(epoch.getTime() + value * 86400000);
  }
  const text = String(value).trim();
  if (!text || /^N\/A$/i.test(text) || text === '-' || /^x$/i.test(text)) {
    return null;
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value: Date | null): string {
  return value ? DATE_FMT.format(value) : '-';
}

function normalizeCustomerName(name: string): string {
  return name
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/#\s*\d+/g, '')
    .replace(/\bPO\s*#?\s*\d+/gi, '')
    .replace(/\bstore\s*#?\s*\d+/gi, '')
    .replace(/\bloc\w*\s*#?\s*\d+/gi, '')
    .replace(/\b(inc|llc|ltd|corp|co|company|enterprises|group)\b\.?/gi, '')
    .replace(/[^a-zA-Z0-9\s&'-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function parseRoutingTokens(value: unknown): PrintingMethod[] {
  if (!value) return [];
  if (value instanceof Date) return [];
  if (typeof value === 'number') return [];

  const text = String(value).trim();
  if (!text || /^N\/A$/i.test(text) || /^x$/i.test(text)) {
    return [];
  }

  const stations = new Set<PrintingMethod>();
  for (const rawToken of text.split(/[\s/,+;&]+/)) {
    const token = rawToken.trim().toUpperCase();
    if (!token) continue;
    const mapped = ROUTING_TOKEN_MAP[token];
    if (!mapped) continue;
    for (const station of mapped) {
      stations.add(station);
    }
  }

  return Array.from(stations);
}

function inferTerminalStatus(row: ArchiveRow, routing: PrintingMethod[]): 'COMPLETED' | 'SHIPPED' {
  const designOnly = isDesignOnlyOrder({ description: row.description, routing });
  const installCue = /\b(INSTALL(?:ATION)?|INSTALLED|DONE|COMPLETE(?:D)?)\b/i.test(row.description);
  return designOnly || installCue ? 'COMPLETED' : 'SHIPPED';
}

function buildArchiveNotes(row: ArchiveRow, terminalStatus: 'COMPLETED' | 'SHIPPED'): string {
  const parts = [
    `Archive backfill from Production List archive.xlsx`,
    `Terminal status: ${terminalStatus}`,
    `Created: ${formatDate(row.createdDate)}`,
    `Must Ship: ${formatDate(row.mustShipDate)}`,
    `Proofed: ${formatDate(row.proofedDate)}`,
    `Approved: ${formatDate(row.approvedDate)}`,
    `Print Setup: ${formatDate(row.printSetupDate)}`,
    `MM Printed: ${formatDate(row.mmPrintedDate)}`,
    `Shipped Date: ${formatDate(row.shippedDate)}`,
  ];
  return parts.join(' | ');
}

function buildArchiveStationProgress(
  routing: readonly PrintingMethod[],
  row: ArchiveRow,
  systemUserId: string,
): Array<{
  station: PrintingMethod;
  status: StationStatus;
  startedAt?: Date;
  completedAt?: Date;
  completedById?: string;
}> {
  const terminalDate = row.shippedDate ?? row.mustShipDate ?? row.createdDate ?? new Date();

  const completedAtForStation = (station: PrintingMethod): Date => {
    switch (station) {
      case PrintingMethod.ORDER_ENTRY:
        return row.createdDate ?? terminalDate;
      case PrintingMethod.DESIGN_ONLY:
      case PrintingMethod.DESIGN:
      case PrintingMethod.DESIGN_PROOF:
        return row.proofedDate ?? row.approvedDate ?? row.printSetupDate ?? row.mmPrintedDate ?? terminalDate;
      case PrintingMethod.DESIGN_APPROVAL:
        return row.approvedDate ?? row.proofedDate ?? row.printSetupDate ?? row.mmPrintedDate ?? terminalDate;
      case PrintingMethod.DESIGN_PRINT_READY:
        return row.printSetupDate ?? row.mmPrintedDate ?? terminalDate;
      case PrintingMethod.ROLL_TO_ROLL:
      case PrintingMethod.ROLL_TO_ROLL_PRINTING:
      case PrintingMethod.FLATBED:
      case PrintingMethod.FLATBED_PRINTING:
      case PrintingMethod.SCREEN_PRINT:
      case PrintingMethod.SCREEN_PRINT_PRINTING:
      case PrintingMethod.SCREEN_PRINT_ASSEMBLY:
      case PrintingMethod.PRODUCTION:
      case PrintingMethod.PRODUCTION_ZUND:
      case PrintingMethod.PRODUCTION_FINISHING:
        return row.mmPrintedDate ?? row.printSetupDate ?? terminalDate;
      case PrintingMethod.SHIPPING_RECEIVING:
      case PrintingMethod.SHIPPING_QC:
      case PrintingMethod.SHIPPING_PACKAGING:
      case PrintingMethod.SHIPPING_SHIPMENT:
      case PrintingMethod.SHIPPING_INSTALL_READY:
      case PrintingMethod.INSTALLATION:
      case PrintingMethod.INSTALLATION_REMOTE:
      case PrintingMethod.INSTALLATION_INHOUSE:
      case PrintingMethod.COMPLETE:
      case PrintingMethod.COMPLETE_INSTALLED:
      case PrintingMethod.COMPLETE_SHIPPED:
      case PrintingMethod.COMPLETE_DESIGN_ONLY:
        return terminalDate;
      default:
        return terminalDate;
    }
  };

  return routing.map((station) => {
    const completedAt = completedAtForStation(station);
    return {
      station,
      status: StationStatus.COMPLETED,
      startedAt: completedAt,
      completedAt,
      completedById: systemUserId,
    };
  });
}

async function getSystemUserId(): Promise<string> {
  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN', isActive: true },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
  if (admin) return admin.id;

  const anyActive = await prisma.user.findFirst({
    where: { isActive: true },
    select: { id: true },
  });
  if (anyActive) return anyActive.id;

  throw new Error('No active users available to own archive backfill orders');
}

function extractArchiveRows(): ArchiveRow[] {
  const workbook = XLSX.readFile(INPUT_PATH, { cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null, raw: true });
  const deduped = new Map<string, ArchiveRow>();

  for (let index = 0; index < rawRows.length; index++) {
    const row = rawRows[index];
    const woRaw = row['WO #'];
    const wo = typeof woRaw === 'number' && Number.isFinite(woRaw)
      ? String(Math.trunc(woRaw))
      : String(woRaw ?? '').trim();
    if (!wo || wo === '-' || !/^\d+$/.test(wo)) {
      continue;
    }

    const customerName = String(row.CUSTOMER ?? '').trim();
    const description = String(row.DESCRIPTION ?? '').trim();
    if (!customerName || !description) {
      continue;
    }

    const archiveRow: ArchiveRow = {
      rowNumber: index + 2,
      customerName,
      orderNumber: wo,
      description,
      createdDate: parseDate(row.Created),
      mustShipDate: parseDate(row['Must Ship']),
      proofedDate: parseDate(row.Proofed),
      approvedDate: parseDate(row.Approved),
      printSetupDate: parseDate(row['Print Setup']),
      mmPrintedDate: parseDate(row['MM Printed']),
      mmPrintedRouting: parseRoutingTokens(row['MM Printed']),
      shippedDate: parseDate(row['Shipped Date']),
    };

    // There are no known duplicates in the workbook, but keep the latest row if one appears later.
    deduped.set(archiveRow.orderNumber, archiveRow);
  }

  return Array.from(deduped.values());
}

async function main() {
  const apply = process.argv.includes('--apply');
  const rows = extractArchiveRows();
  const systemUserId = await getSystemUserId();

  const companies = await prisma.company.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });
  const companyByExact = new Map<string, CompanyRow>();
  const companyByNormalized = new Map<string, CompanyRow>();
  for (const company of companies) {
    companyByExact.set(company.name.toLowerCase(), company);
    const normalized = normalizeCustomerName(company.name);
    if (normalized && !companyByNormalized.has(normalized)) {
      companyByNormalized.set(normalized, company);
    }
  }

  const existingOrders = await prisma.workOrder.findMany({
    where: { orderNumber: { in: rows.map((row) => row.orderNumber) } },
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
      _count: {
        select: { stationProgress: true, shipments: true },
      },
    },
  });

  const existingByOrderNumber = new Map(existingOrders.map((order) => [order.orderNumber, order as ExistingOrderRow]));

  let createdOrders = 0;
  let updatedOrders = 0;
  let statusUpdatedOrders = 0;
  let shipmentPlaceholdersCreated = 0;
  let stationProgressCreated = 0;
  let skippedOrders = 0;
  let failedOrders = 0;
  const failures: Array<{ orderNumber: string; customerName: string; error: string }> = [];

  for (const row of rows) {
    try {
      const existing = existingByOrderNumber.get(row.orderNumber);
      const resolvedRouting = resolveImportedRouting({
        routing: row.mmPrintedRouting,
        description: row.description,
        needsProof: Boolean(row.proofedDate || row.approvedDate || row.printSetupDate),
        source: 'production-list',
      });
      const terminalStatus = inferTerminalStatus(row, resolvedRouting);
      const archiveNotes = buildArchiveNotes(row, terminalStatus);
      const shipmentDate = row.shippedDate ?? row.mustShipDate ?? row.createdDate ?? new Date();
      const matchedCompany =
        companyByExact.get(row.customerName.toLowerCase()) ??
        companyByNormalized.get(normalizeCustomerName(row.customerName)) ??
        null;

      if (!apply) {
        const action = existing ? 'update' : 'create';
        console.log(
          `${action.toUpperCase()} WO ${row.orderNumber} | ${row.customerName} | ${terminalStatus} | ship ${formatDate(shipmentDate)}`,
        );
        continue;
      }

      if (existing) {
        const nextRouting = Array.from(new Set<PrintingMethod>([...existing.routing, ...resolvedRouting]));
        const needsRoutingUpdate = nextRouting.length !== existing.routing.length;
        const shouldUpdateStatus = existing.status !== terminalStatus;
        const shouldUpdateDescription =
          !existing.description ||
          existing.description === existing.orderNumber ||
          existing.description === 'Imported Order';
        const shouldUpdateCustomer =
          !existing.customerName || existing.customerName === 'Unknown Customer';
        const shouldUpdateNotes = !existing.notes;
        const shouldUpdateDueDate = !existing.dueDate && Boolean(row.mustShipDate);
        const shouldUpdateCompany = !existing.companyId && Boolean(matchedCompany);

        const updateData: Record<string, unknown> = {};
        if (shouldUpdateStatus) {
          updateData.status = terminalStatus;
        }
        if (shouldUpdateDescription) {
          updateData.description = row.description;
        }
        if (shouldUpdateCustomer) {
          updateData.customerName = row.customerName;
        }
        if (shouldUpdateNotes) {
          updateData.notes = archiveNotes;
        }
        if (shouldUpdateDueDate) {
          updateData.dueDate = row.mustShipDate;
        }
        if (needsRoutingUpdate) {
          updateData.routing = nextRouting;
        }
        if (shouldUpdateCompany && matchedCompany) {
          updateData.companyId = matchedCompany.id;
        }

        const hasUpdate = Object.keys(updateData).length > 0;
        const needsStationProgress = existing._count.stationProgress === 0;
        const needsShipment = terminalStatus === 'SHIPPED' && existing._count.shipments === 0;

        if (!hasUpdate && !needsStationProgress && !needsShipment) {
          skippedOrders++;
          continue;
        }

        if (hasUpdate) {
          await prisma.workOrder.update({
            where: { id: existing.id },
            data: updateData,
          });
          updatedOrders++;
          if (shouldUpdateStatus) {
            statusUpdatedOrders++;
            await prisma.workEvent.create({
              data: {
                orderId: existing.id,
                eventType: 'STATUS_CHANGED',
                description: `Archive backfill set order to ${terminalStatus} from archive.xlsx`,
                userId: systemUserId,
                details: {
                  source: 'archive.xlsx',
                  previousStatus: existing.status,
                  nextStatus: terminalStatus,
                  shippedDate: row.shippedDate?.toISOString() ?? null,
                  rowNumber: row.rowNumber,
                },
              },
            });
          }
        }

        if (needsStationProgress) {
          await prisma.stationProgress.createMany({
            data: buildArchiveStationProgress(nextRouting, row, systemUserId).map((entry) => ({
              orderId: existing.id,
              station: entry.station,
              status: entry.status,
              startedAt: entry.startedAt ?? undefined,
              completedAt: entry.completedAt ?? undefined,
              completedById: entry.completedById ?? undefined,
            })),
          });
          stationProgressCreated += nextRouting.length;
        }

        if (needsShipment) {
          await ensureShipmentRecordForWorkOrder(
            {
              id: existing.id,
              orderNumber: row.orderNumber,
              customerName: row.customerName,
              description: row.description,
              createdById: systemUserId,
              updatedAt: row.createdDate ?? shipmentDate,
            },
            {
              createdById: systemUserId,
              shipDate: shipmentDate,
              notes: `Archive backfill from Production List archive.xlsx (row ${row.rowNumber})`,
            },
          );
          shipmentPlaceholdersCreated++;
        }

        continue;
      }

      const stationProgress = buildArchiveStationProgress(resolvedRouting, row, systemUserId);
      const createData: Record<string, unknown> = {
        orderNumber: row.orderNumber,
        customerName: row.customerName,
        description: row.description,
        status: terminalStatus,
        priority: 3,
        companyBrand: 'WILDE_SIGNS',
        dueDate: row.mustShipDate,
        notes: archiveNotes,
        routing: resolvedRouting,
        createdById: systemUserId,
        isTempOrder: false,
        createdAt: row.createdDate ?? shipmentDate,
        ...(matchedCompany ? { companyId: matchedCompany.id } : {}),
        stationProgress: {
          create: stationProgress.map((entry) => ({
            station: entry.station,
            status: entry.status,
            startedAt: entry.startedAt ?? undefined,
            completedAt: entry.completedAt ?? undefined,
            completedById: entry.completedById ?? undefined,
          })),
        },
        events: {
          create: [
            {
              eventType: 'CREATED',
              description: `Imported from Production List archive (row ${row.rowNumber})`,
              userId: systemUserId,
            },
            {
              eventType: 'STATUS_CHANGED',
              description: `Archive backfill set order to ${terminalStatus} from archive.xlsx`,
              userId: systemUserId,
              details: {
                source: 'archive.xlsx',
                shippedDate: row.shippedDate?.toISOString() ?? null,
                rowNumber: row.rowNumber,
              },
            },
          ],
        },
      };

      if (terminalStatus === 'SHIPPED') {
        (createData as any).shipments = {
          create: {
            carrier: 'OTHER',
            trackingNumber: null,
            shipDate: shipmentDate,
            status: 'PICKED_UP',
            shippingCost: 0,
            notes: `Archive backfill from Production List archive.xlsx (row ${row.rowNumber})`,
            createdById: systemUserId,
          },
        };
        shipmentPlaceholdersCreated++;
      }

      await prisma.workOrder.create({ data: createData as any });
      createdOrders++;
      stationProgressCreated += stationProgress.length;
    } catch (error) {
      failedOrders++;
      const message = error instanceof Error ? error.message : String(error);
      failures.push({
        orderNumber: row.orderNumber,
        customerName: row.customerName,
        error: message,
      });
      console.error(`Failed WO ${row.orderNumber} | ${row.customerName}: ${message}`);
    }
  }

  console.log('\nArchive backfill summary');
  console.log(`  Rows processed: ${rows.length}`);
  console.log(`  Existing orders matched: ${existingOrders.length}`);
  console.log(`  Orders created: ${createdOrders}`);
  console.log(`  Orders updated: ${updatedOrders}`);
  console.log(`  Status changes written: ${statusUpdatedOrders}`);
  console.log(`  Shipment placeholders created: ${shipmentPlaceholdersCreated}`);
  console.log(`  Station progress rows created: ${stationProgressCreated}`);
  console.log(`  Skipped unchanged orders: ${skippedOrders}`);
  console.log(`  Failed orders: ${failedOrders}`);
  if (failures.length > 0) {
    console.log('  Failures:');
    for (const failure of failures.slice(0, 20)) {
      console.log(`    - WO ${failure.orderNumber} | ${failure.customerName} | ${failure.error}`);
    }
    if (failures.length > 20) {
      console.log(`    ...and ${failures.length - 20} more`);
    }
  }
}

main()
  .catch((error) => {
    console.error('Archive backfill failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
