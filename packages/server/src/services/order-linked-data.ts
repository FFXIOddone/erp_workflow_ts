import { Prisma } from '@prisma/client';
import { PrintingMethod } from '@erp/shared';
import { prisma } from '../db/client.js';
import { getOrderFileChainSummary } from './file-chain.js';
import {
  applyRoutingDefaults,
  buildInitialStationProgress,
  inferRoutingSource,
} from '../lib/routing-defaults.js';

export type LinkedShipmentSummary = {
  id: string;
  carrier: string;
  trackingNumber: string | null;
  status: string;
  shipDate: Date | null;
  estimatedDelivery: Date | null;
  actualDelivery: Date | null;
  packageCount: number;
  createdByDisplayName: string | null;
};

export type LinkedAttachmentSummary = {
  id: string;
  fileName: string;
  fileType: string;
  uploadedAt: Date;
  uploadedByDisplayName: string | null;
};

export type LinkedFileChainSummary = {
  totalFiles: number;
  printCutFiles: number;
  linked: number;
  unlinked: number;
  printComplete: number;
  cutComplete: number;
  chainStatus: string;
};

export type LinkedFileChainLinkSummary = {
  id: string;
  printFileName: string;
  cutFileName: string | null;
  cutId: string | null;
  status: string;
  printStatus: string;
  cutStatus: string;
  printedAt: Date | string | null;
  cutCompletedAt: Date | string | null;
};

export type OrderLinkedDataSummary = {
  orderId: string;
  orderNumber: string;
  routingCount: number;
  stationProgressCount: number;
  completedStationCount: number;
  shipmentCount: number;
  trackedShipmentCount: number;
  attachmentCount: number;
  reprintRequestCount: number;
  timeEntryCount: number;
  proofApprovalCount: number;
  latestShipments: LinkedShipmentSummary[];
  latestAttachments: LinkedAttachmentSummary[];
  fileChainSummary: LinkedFileChainSummary | null;
  fileChainLinks: LinkedFileChainLinkSummary[];
  latestFileChainLinks: LinkedFileChainLinkSummary[];
  warnings: string[];
};

export type OrderLinkedDataRepairResult = {
  scanned: number;
  routingUpdated: number;
  stationProgressBackfilled: number;
  fileChainsCreated: number;
  shipmentsCreated: number;
  orders: Array<{
    orderId: string;
    orderNumber: string;
    warnings: string[];
  }>;
};

type RepairCandidate = {
  id: string;
  orderNumber: string;
  description: string;
  routing: Prisma.JsonValue | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  createdById: string;
  stationProgress: Array<{
    station: string;
    status: string;
  }>;
  printCutLinks: Array<{ id: string }>;
  shipments: Array<{ id: string }>;
};

function sameRouting(existing: string[], next: PrintingMethod[]): boolean {
  return (
    existing.length === next.length &&
    existing.every((station, index) => station === next[index])
  );
}

function normalizeStationStatus(status: string | null | undefined): string {
  if (status === 'COMPLETED' || status === 'IN_PROGRESS' || status === 'NOT_STARTED') {
    return status;
  }
  return 'NOT_STARTED';
}

async function loadRepairCandidates(orderIds?: string[]): Promise<RepairCandidate[]> {
  return prisma.workOrder.findMany({
    where: orderIds && orderIds.length > 0 ? { id: { in: orderIds } } : {},
    select: {
      id: true,
      orderNumber: true,
      description: true,
      routing: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      createdById: true,
      stationProgress: {
        select: {
          station: true,
          status: true,
        },
      },
      printCutLinks: {
        select: {
          id: true,
        },
      },
      shipments: {
        select: {
          id: true,
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function getOrderLinkedDataSummary(orderId: string): Promise<OrderLinkedDataSummary | null> {
  const order = await prisma.workOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      routing: true,
      stationProgress: {
        select: {
          station: true,
          status: true,
        },
      },
    },
  });

  if (!order) {
    return null;
  }

  const [shipmentCount, trackedShipmentCount, latestShipments, attachmentCount, latestAttachments, reprintRequestCount, timeEntryCount, proofApprovalCount, fileChainSummary] =
    await Promise.all([
      prisma.shipment.count({ where: { workOrderId: orderId } }),
      prisma.shipment.count({
        where: {
          workOrderId: orderId,
          trackingNumber: { not: null },
        },
      }),
      prisma.shipment.findMany({
        where: { workOrderId: orderId },
        orderBy: { shipDate: 'desc' },
        take: 5,
        select: {
          id: true,
          carrier: true,
          trackingNumber: true,
          status: true,
          shipDate: true,
          estimatedDelivery: true,
          actualDelivery: true,
          createdBy: { select: { displayName: true } },
          packages: { select: { id: true } },
        },
      }),
      prisma.orderAttachment.count({ where: { orderId } }),
      prisma.orderAttachment.findMany({
        where: { orderId },
        orderBy: { uploadedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          fileName: true,
          fileType: true,
          uploadedAt: true,
          uploadedBy: { select: { displayName: true } },
        },
      }),
      prisma.reprintRequest.count({ where: { orderId } }),
      prisma.timeEntry.count({ where: { orderId } }),
      prisma.proofApproval.count({ where: { orderId } }),
      getOrderFileChainSummary(orderId),
    ]);

  const completedStationCount = order.stationProgress.filter((entry) => entry.status === 'COMPLETED').length;
  const normalizedFileChain = fileChainSummary
    ? {
        totalFiles: fileChainSummary.totalFiles,
        printCutFiles: fileChainSummary.printCutFiles,
        linked: fileChainSummary.linked,
        unlinked: fileChainSummary.unlinked,
        printComplete: fileChainSummary.printComplete,
        cutComplete: fileChainSummary.cutComplete,
        chainStatus: fileChainSummary.chainStatus,
      }
    : null;
  const latestFileChainLinks = fileChainSummary
    ? fileChainSummary.links.slice(0, 5).map((link) => ({
        id: link.id,
        printFileName: link.printFileName,
        cutFileName: link.cutFileName ?? null,
        cutId: link.cutId ?? null,
        status: link.effectiveStatus,
        printStatus: link.printStatus,
        cutStatus: link.cutStatus,
        printedAt: link.printedAt,
        cutCompletedAt: link.cutCompletedAt,
      }))
    : [];
  const fileChainLinks = fileChainSummary
    ? fileChainSummary.links.map((link) => ({
        id: link.id,
        printFileName: link.printFileName,
        cutFileName: link.cutFileName ?? null,
        cutId: link.cutId ?? null,
        status: link.effectiveStatus,
        printStatus: link.printStatus,
        cutStatus: link.cutStatus,
        printedAt: link.printedAt,
        cutCompletedAt: link.cutCompletedAt,
      }))
    : [];

  const warnings: string[] = [];
  if (order.routing.length === 0) {
    warnings.push('Routing is empty and needs repair');
  }
  if (order.stationProgress.length === 0) {
    warnings.push('Station progress is missing');
  }
  if (!normalizedFileChain || normalizedFileChain.totalFiles === 0) {
    warnings.push('No file chain records are linked yet');
  }
  if (shipmentCount === 0 && order.status === 'SHIPPED') {
    warnings.push('No shipment records are linked yet');
  }

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    routingCount: order.routing.length,
    stationProgressCount: order.stationProgress.length,
    completedStationCount,
    shipmentCount,
    trackedShipmentCount,
    attachmentCount,
    reprintRequestCount,
    timeEntryCount,
    proofApprovalCount,
    latestShipments: latestShipments.map((shipment) => ({
      id: shipment.id,
      carrier: shipment.carrier,
      trackingNumber: shipment.trackingNumber,
      status: shipment.status,
      shipDate: shipment.shipDate,
      estimatedDelivery: shipment.estimatedDelivery,
      actualDelivery: shipment.actualDelivery,
      packageCount: shipment.packages.length,
      createdByDisplayName: shipment.createdBy?.displayName ?? null,
    })),
    latestAttachments: latestAttachments.map((attachment) => ({
      id: attachment.id,
      fileName: attachment.fileName,
      fileType: attachment.fileType,
      uploadedAt: attachment.uploadedAt,
      uploadedByDisplayName: attachment.uploadedBy?.displayName ?? null,
    })),
    fileChainSummary: normalizedFileChain,
    fileChainLinks,
    latestFileChainLinks,
    warnings,
  };
}

export async function repairOrderLinkedDataIntegrity(options: {
  orderIds?: string[];
  actorUserId?: string;
} = {}): Promise<OrderLinkedDataRepairResult> {
  const orders = await loadRepairCandidates(options.orderIds);

  const result: OrderLinkedDataRepairResult = {
    scanned: orders.length,
    routingUpdated: 0,
    stationProgressBackfilled: 0,
    fileChainsCreated: 0,
    shipmentsCreated: 0,
    orders: [],
  };

  for (const order of orders) {
    const warnings: string[] = [];
    const source = inferRoutingSource(order.orderNumber, order.description);
    const currentRouting = Array.isArray(order.routing)
      ? (order.routing as PrintingMethod[])
      : [];
    const repairedRouting = applyRoutingDefaults(currentRouting, {
      description: order.description,
      source,
    });
    const routingChanged = !sameRouting(currentRouting, repairedRouting);
    const existingStations = new Set(order.stationProgress.map((entry) => entry.station));
    const initialProgress = buildInitialStationProgress(repairedRouting, {
      source,
      entryTimestamp: order.createdAt,
    });
    const missingProgress = initialProgress.filter(
      (entry) => entry.station !== PrintingMethod.ORDER_ENTRY && !existingStations.has(entry.station),
    );
    const orderEntryProgress = initialProgress.find((entry) => entry.station === PrintingMethod.ORDER_ENTRY);
    const shouldRepairOrderEntry =
      !!orderEntryProgress && source !== 'woocommerce' && (
        !existingStations.has(PrintingMethod.ORDER_ENTRY) ||
        order.stationProgress.some(
          (entry) => entry.station === PrintingMethod.ORDER_ENTRY && normalizeStationStatus(entry.status) !== 'COMPLETED',
        )
      );
    const shouldCreateFileChain = order.printCutLinks.length === 0;
    const shouldCreateShipment = order.status === 'SHIPPED' && order.shipments.length === 0;

    if (!routingChanged && missingProgress.length === 0 && !shouldCreateFileChain && !shouldCreateShipment && !shouldRepairOrderEntry) {
      continue;
    }

    const stationProgressBackfilled = missingProgress.length + (shouldRepairOrderEntry ? 1 : 0);

    await prisma.$transaction(async (tx) => {
      if (routingChanged) {
        await tx.workOrder.update({
          where: { id: order.id },
          data: {
            routing: repairedRouting,
          },
        });

        await tx.stationProgress.deleteMany({
          where: {
            orderId: order.id,
            station: { notIn: repairedRouting as never[] },
          },
        });
      }

      if (missingProgress.length > 0) {
        await tx.stationProgress.createMany({
          data: missingProgress.map((entry) => ({
            orderId: order.id,
            station: entry.station as never,
            status: entry.status as never,
            startedAt: entry.startedAt ?? undefined,
            completedAt: entry.completedAt ?? undefined,
          })),
        });
      }

      if (shouldRepairOrderEntry && orderEntryProgress) {
        await tx.stationProgress.upsert({
          where: {
            orderId_station: {
              orderId: order.id,
              station: PrintingMethod.ORDER_ENTRY as never,
            },
          },
          update: {
            status: 'COMPLETED',
            startedAt: order.createdAt,
            completedAt: order.createdAt,
            completedById: options.actorUserId ?? order.createdById,
          },
          create: {
            orderId: order.id,
            station: PrintingMethod.ORDER_ENTRY as never,
            status: 'COMPLETED',
            startedAt: order.createdAt,
            completedAt: order.createdAt,
            completedById: options.actorUserId ?? order.createdById,
          },
        });
      }

      if (shouldCreateFileChain) {
        await tx.printCutLink.create({
          data: {
            workOrderId: order.id,
            printFileName: order.orderNumber,
            printFilePath: '',
            status: 'DESIGN',
            linkConfidence: 'NONE',
          },
        });
      }

      if (shouldCreateShipment) {
        await tx.shipment.create({
          data: {
            workOrderId: order.id,
            carrier: 'OTHER',
            trackingNumber: null,
            shipDate: order.updatedAt,
            status: 'PICKED_UP',
            shippingCost: 0,
            notes: `Auto-created shipment record for order ${order.orderNumber}`,
            createdById: options.actorUserId ?? order.createdById,
          },
        });
      }
    });

    if (routingChanged) {
      result.routingUpdated += 1;
      warnings.push(`Routing normalized to ${repairedRouting.join(' > ')}`);
    }
    if (missingProgress.length > 0 || shouldRepairOrderEntry) {
      result.stationProgressBackfilled += stationProgressBackfilled;
      warnings.push(`Backfilled ${stationProgressBackfilled} station progress row(s)`);
    }
    if (shouldCreateFileChain) {
      result.fileChainsCreated += 1;
      warnings.push('Created placeholder file chain row');
    }
    if (shouldCreateShipment) {
      result.shipmentsCreated += 1;
      warnings.push('Created placeholder shipment row');
    }

    result.orders.push({
      orderId: order.id,
      orderNumber: order.orderNumber,
      warnings,
    });
  }

  return result;
}
