/**
 * Audit order-detail linked-data counts against the raw database rows.
 *
 * Run:
 *   npx tsx scripts/audit-linked-data-counts.ts
 *
 * Optional:
 *   npx tsx scripts/audit-linked-data-counts.ts --orderId=<id>
 */

import { PrismaClient } from '@prisma/client';
import { inferRoutingSource, summarizeStationProgressCounts } from '../packages/server/src/lib/routing-defaults.js';
import { getOrderLinkedDataSummary } from '../packages/server/src/services/order-linked-data.js';
import { getOrderFileChainSummary } from '../packages/server/src/services/file-chain.js';

type AuditMismatch = {
  orderId: string;
  orderNumber: string;
  field: string;
  expected: unknown;
  actual: unknown;
};

type AuditOrder = {
  id: string;
  orderNumber: string;
  customerName: string | null;
  description: string | null;
  createdAt: Date;
  routing: unknown[];
  stationProgress: Array<{
    station: string;
    status: string;
  }>;
};

const prisma = new PrismaClient();

function parseArgs() {
  const args = new Map<string, string>();
  for (const rawArg of process.argv.slice(2)) {
    const [rawKey, rawValue] = rawArg.replace(/^--/, '').split('=');
    if (!rawKey) continue;
    args.set(rawKey, rawValue ?? 'true');
  }
  return {
    orderId: args.get('orderId') ?? null,
  };
}

function addMismatch(
  mismatches: AuditMismatch[],
  order: AuditOrder,
  field: string,
  expected: unknown,
  actual: unknown,
) {
  mismatches.push({
    orderId: order.id,
    orderNumber: order.orderNumber,
    field,
    expected,
    actual,
  });
}

async function auditOrder(order: AuditOrder): Promise<AuditMismatch[]> {
  const [
    summary,
    fileChainSummary,
    shipmentCount,
    trackedShipmentCount,
    attachmentCount,
    reprintRequestCount,
    timeEntryCount,
    proofApprovalCount,
  ] = await Promise.all([
    getOrderLinkedDataSummary(order.id),
    getOrderFileChainSummary(order.id),
    prisma.shipment.count({ where: { workOrderId: order.id } }),
    prisma.shipment.count({
      where: {
        workOrderId: order.id,
        trackingNumber: { not: null },
      },
    }),
    prisma.orderAttachment.count({ where: { orderId: order.id } }),
    prisma.reprintRequest.count({ where: { orderId: order.id } }),
    prisma.timeEntry.count({ where: { orderId: order.id } }),
    prisma.proofApproval.count({ where: { orderId: order.id } }),
  ]);

  const mismatches: AuditMismatch[] = [];

  if (!summary) {
    addMismatch(mismatches, order, 'summary', 'summary row exists', null);
    return mismatches;
  }

  if (summary.shipmentCount !== shipmentCount) {
    addMismatch(mismatches, order, 'shipmentCount', shipmentCount, summary.shipmentCount);
  }

  if (summary.trackedShipmentCount !== trackedShipmentCount) {
    addMismatch(mismatches, order, 'trackedShipmentCount', trackedShipmentCount, summary.trackedShipmentCount);
  }

  if (summary.attachmentCount !== attachmentCount) {
    addMismatch(mismatches, order, 'attachmentCount', attachmentCount, summary.attachmentCount);
  }

  if (summary.reprintRequestCount !== reprintRequestCount) {
    addMismatch(mismatches, order, 'reprintRequestCount', reprintRequestCount, summary.reprintRequestCount);
  }

  if (summary.timeEntryCount !== timeEntryCount) {
    addMismatch(mismatches, order, 'timeEntryCount', timeEntryCount, summary.timeEntryCount);
  }

  if (summary.proofApprovalCount !== proofApprovalCount) {
    addMismatch(mismatches, order, 'proofApprovalCount', proofApprovalCount, summary.proofApprovalCount);
  }

  if (summary.routingCount !== order.routing.length) {
    addMismatch(mismatches, order, 'routingCount', order.routing.length, summary.routingCount);
  }

  if (summary.stationProgressCount !== order.stationProgress.length) {
    addMismatch(mismatches, order, 'stationProgressCount', order.stationProgress.length, summary.stationProgressCount);
  }

  const rawStationSummary = summarizeStationProgressCounts(order.routing as never, order.stationProgress as never, {
    source: inferRoutingSource(order.orderNumber, order.customerName ?? order.description),
    entryTimestamp: order.createdAt,
  });
  if (summary.completedStationCount !== rawStationSummary.completedStationCount) {
    addMismatch(
      mismatches,
      order,
      'completedStationCount',
      rawStationSummary.completedStationCount,
      summary.completedStationCount,
    );
  }

  if (summary.fileChainSummary || fileChainSummary) {
    const summaryFileChain = summary.fileChainSummary ?? null;
    const rawFileChain = fileChainSummary
      ? {
          totalFiles: fileChainSummary.totalFiles,
          printCutFiles: fileChainSummary.printCutFiles,
          linked: fileChainSummary.linked,
          unlinked: fileChainSummary.unlinked,
          printComplete: fileChainSummary.printComplete,
          cutComplete: fileChainSummary.cutComplete,
          completedStationCount: fileChainSummary.completedStationCount,
          chainStatus: fileChainSummary.chainStatus,
        }
      : null;

    const comparedFields: Array<keyof NonNullable<typeof rawFileChain>> = [
      'totalFiles',
      'printCutFiles',
      'linked',
      'unlinked',
      'printComplete',
      'cutComplete',
      'completedStationCount',
      'chainStatus',
    ];

    for (const field of comparedFields) {
      const expected = rawFileChain?.[field] ?? null;
      const actual = summaryFileChain?.[field] ?? null;
      if (expected !== actual) {
        addMismatch(mismatches, order, `fileChainSummary.${field}`, expected, actual);
      }
    }
  }

  return mismatches;
}

async function main() {
  const { orderId } = parseArgs();
  const orders = await prisma.workOrder.findMany({
    where: orderId ? { id: orderId } : {},
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      description: true,
      createdAt: true,
      routing: true,
      stationProgress: {
        select: {
          station: true,
          status: true,
        },
      },
    },
    orderBy: { orderNumber: 'asc' },
  });

  const mismatches: AuditMismatch[] = [];
  const chunkSize = 20;
  for (let index = 0; index < orders.length; index += chunkSize) {
    const chunk = orders.slice(index, index + chunkSize);
    const chunkResults = await Promise.all(chunk.map((order) => auditOrder(order as AuditOrder)));
    for (const result of chunkResults) {
      mismatches.push(...result);
    }
  }

  if (mismatches.length > 0) {
    console.error(`Found ${mismatches.length} linked-data count mismatch${mismatches.length === 1 ? '' : 'es'}:`);
    for (const mismatch of mismatches.slice(0, 100)) {
      console.error(
        `${mismatch.orderNumber} (${mismatch.orderId}) ${mismatch.field}: expected ${JSON.stringify(
          mismatch.expected,
        )}, got ${JSON.stringify(mismatch.actual)}`,
      );
    }
    if (mismatches.length > 100) {
      console.error(`... and ${mismatches.length - 100} more`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Audited ${orders.length} order${orders.length === 1 ? '' : 's'} with zero linked-data count mismatches.`);
}

main()
  .catch((error) => {
    console.error('Linked-data count audit failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
