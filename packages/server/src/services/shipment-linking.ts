import { Carrier, ShipmentStatus } from '@prisma/client';
import { prisma } from '../db/client.js';
import { findShipmentEvidence } from '../lib/folder-utils.js';
import {
  resolveShipmentTrackingNumber,
  type ShipmentTrackingCandidate,
} from './shipment-tracking.js';

export type ShipmentWorkOrderSeed = {
  id: string;
  orderNumber: string;
  customerName: string;
  description?: string | null;
  createdById: string;
  updatedAt: Date;
};

export interface ShipmentLinkingResult {
  scanned: number;
  created: number;
  updated: number;
}

type ShipmentCarrierSignals = {
  evidenceRoot?: string | null;
  hasFedExRecord?: boolean;
};

type ShipmentRepairShipment = {
  id: string;
  carrier: Carrier;
  status: ShipmentStatus;
  trackingNumber: string | null;
  shipDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  labelScans: Array<{
    trackingNumber: string | null;
    scannedAt: Date | null;
  }>;
};

type ShipmentRepairWorkOrder = ShipmentWorkOrderSeed & {
  shipments: ShipmentRepairShipment[];
  shippingScans: Array<{
    trackingNumber: string | null;
    scannedAt: Date | null;
  }>;
  fedExShipmentRecords: Array<{
    trackingNumber: string | null;
    importedAt: Date;
  }>;
};

export function inferShipmentCarrierFromSignals(signals: ShipmentCarrierSignals): Carrier {
  if (signals.hasFedExRecord) {
    return Carrier.FEDEX;
  }

  const evidenceRoot = signals.evidenceRoot?.toUpperCase() ?? '';
  if (evidenceRoot.includes('FEDEX')) {
    return Carrier.FEDEX;
  }
  if (evidenceRoot.includes('FREIGHT')) {
    return Carrier.FREIGHT;
  }

  return Carrier.OTHER;
}

export function inferBackfilledShipmentStatus(
  fallback: ShipmentStatus = ShipmentStatus.IN_TRANSIT
): ShipmentStatus {
  return fallback === ShipmentStatus.PICKED_UP ? ShipmentStatus.IN_TRANSIT : fallback;
}

let reconcileInFlight: Promise<ShipmentLinkingResult> | null = null;

async function createPlaceholderShipmentForWorkOrder(
  workOrder: ShipmentWorkOrderSeed,
  options: {
    createdById?: string;
    shipDate?: Date;
    notes?: string;
    carrier?: Carrier;
    trackingNumber?: string | null;
    status?: ShipmentStatus;
  } = {}
): Promise<boolean> {
  const existingShipment = await prisma.shipment.findFirst({
    where: { workOrderId: workOrder.id },
    select: { id: true },
  });

  if (existingShipment) {
    return false;
  }

  await prisma.shipment.create({
    data: {
      workOrderId: workOrder.id,
      carrier: options.carrier ?? Carrier.OTHER,
      trackingNumber: options.trackingNumber ?? null,
      shipDate: options.shipDate ?? workOrder.updatedAt,
      status: options.status ?? inferBackfilledShipmentStatus(),
      shippingCost: 0,
      notes:
        options.notes ??
        `Auto-created shipment record for order ${workOrder.orderNumber}`,
      createdById: options.createdById ?? workOrder.createdById,
    },
  });

  return true;
}

function buildShipmentTrackingCandidate(
  shipment: ShipmentRepairShipment,
  workOrder: ShipmentRepairWorkOrder
): ShipmentTrackingCandidate {
  return {
    trackingNumber: shipment.trackingNumber,
    labelScans: shipment.labelScans,
    workOrder: {
      shippingScans: workOrder.shippingScans,
      fedExShipmentRecords: workOrder.fedExShipmentRecords,
    },
  };
}

export async function ensureShipmentRecordForWorkOrder(
  workOrder: ShipmentWorkOrderSeed,
  options: {
    createdById?: string;
    shipDate?: Date;
    notes?: string;
    carrier?: Carrier;
    status?: ShipmentStatus;
  } = {}
): Promise<boolean> {
  const [linkedFedExEvidence, linkedFedExRecord] = await Promise.all([
    prisma.fedExShipmentRecord.findFirst({
      where: {
        workOrderId: workOrder.id,
      },
      select: {
        id: true,
      },
      orderBy: { importedAt: 'desc' },
    }),
    prisma.fedExShipmentRecord.findFirst({
      where: {
        workOrderId: workOrder.id,
        trackingNumber: { not: null },
      },
      select: {
        trackingNumber: true,
      },
      orderBy: { importedAt: 'desc' },
    }),
  ]);

  const carrier =
    options.carrier ??
    inferShipmentCarrierFromSignals({
      hasFedExRecord: Boolean(linkedFedExEvidence),
    });

  return createPlaceholderShipmentForWorkOrder(workOrder, {
    ...options,
    carrier,
    trackingNumber: linkedFedExRecord?.trackingNumber ?? null,
    status: inferBackfilledShipmentStatus(options.status),
  });
}

export function reconcileShippedOrdersWithShipments(): Promise<ShipmentLinkingResult> {
  if (reconcileInFlight) {
    return reconcileInFlight;
  }

  reconcileInFlight = (async () => {
    const settings = await prisma.systemSettings.findFirst({
      select: {
        networkDriveBasePath: true,
      },
    });

    const workOrders = await prisma.workOrder.findMany({
      where: {
        status: 'SHIPPED',
        OR: [
          { shipments: { none: {} } },
          {
            shipments: {
              some: {
                OR: [
                  { trackingNumber: null },
                  { carrier: Carrier.OTHER },
                ],
              },
            },
          },
        ],
      },
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        description: true,
        createdById: true,
        updatedAt: true,
        shippingScans: {
          select: {
            trackingNumber: true,
            scannedAt: true,
          },
          orderBy: { scannedAt: 'desc' },
          take: 1,
        },
        fedExShipmentRecords: {
          select: {
            trackingNumber: true,
            importedAt: true,
          },
          orderBy: { importedAt: 'desc' },
          take: 1,
        },
        shipments: {
          select: {
            id: true,
            carrier: true,
            status: true,
            trackingNumber: true,
            shipDate: true,
            createdAt: true,
            updatedAt: true,
            labelScans: {
              select: {
                trackingNumber: true,
                scannedAt: true,
              },
              orderBy: { scannedAt: 'desc' },
              take: 1,
            },
          },
          orderBy: [
            { shipDate: 'desc' },
            { createdAt: 'desc' },
          ],
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    let created = 0;
    let updated = 0;
    for (const workOrder of workOrders) {
      try {
        const woNumber = workOrder.orderNumber.replace(/\D+/g, '');
        const existingShipment = workOrder.shipments[0] ?? null;
        const hasFedExRecord = workOrder.fedExShipmentRecords.some((record) => Boolean(record.trackingNumber?.trim()));
        const needsEvidenceScan =
          !existingShipment ||
          existingShipment.carrier === Carrier.OTHER ||
          !existingShipment.trackingNumber;
        const evidence = needsEvidenceScan && settings?.networkDriveBasePath
          ? findShipmentEvidence(
              settings.networkDriveBasePath,
              woNumber,
              workOrder.customerName,
              workOrder.description ?? undefined,
            )
          : null;
        const carrier = inferShipmentCarrierFromSignals({
          evidenceRoot: evidence?.evidenceRoot,
          hasFedExRecord,
        });
        const shippingCandidate: ShipmentTrackingCandidate = existingShipment
          ? buildShipmentTrackingCandidate(existingShipment, workOrder as ShipmentRepairWorkOrder)
          : {
              trackingNumber: null,
              workOrder: {
                shippingScans: workOrder.shippingScans,
                fedExShipmentRecords: workOrder.fedExShipmentRecords,
              },
            };
        const resolvedTrackingNumber = resolveShipmentTrackingNumber(shippingCandidate);

        if (!existingShipment) {
          const didCreate = await createPlaceholderShipmentForWorkOrder(workOrder, {
            shipDate: workOrder.updatedAt,
            carrier,
            trackingNumber: resolvedTrackingNumber ?? null,
            status: inferBackfilledShipmentStatus(),
            notes: evidence?.found
              ? `Backfilled from SHIPPED order ${workOrder.orderNumber}. Evidence: ${evidence.evidencePath}`
              : `Backfilled from SHIPPED order ${workOrder.orderNumber}`,
          });
          if (didCreate) {
            created += 1;
          }
          continue;
        }

        const nextData: {
          carrier?: Carrier;
          trackingNumber?: string;
          status?: ShipmentStatus;
        } = {};

        if (
          carrier !== Carrier.OTHER &&
          existingShipment.carrier === Carrier.OTHER
        ) {
          nextData.carrier = carrier;
        }

        if (resolvedTrackingNumber && existingShipment.trackingNumber !== resolvedTrackingNumber) {
          nextData.trackingNumber = resolvedTrackingNumber;
        }

        if (
          nextData.trackingNumber ||
          nextData.carrier
        ) {
          if (existingShipment.status !== ShipmentStatus.DELIVERED) {
            nextData.status =
              existingShipment.status === ShipmentStatus.PICKED_UP ||
              existingShipment.status === ShipmentStatus.PENDING
                ? ShipmentStatus.IN_TRANSIT
                : existingShipment.status;
          }

          await prisma.shipment.update({
            where: { id: existingShipment.id },
            data: nextData,
          });
          updated += 1;
        }
      } catch (err) {
        console.warn(`Failed to reconcile shipment for order ${workOrder.orderNumber}:`, err);
      }
    }

    return {
      scanned: workOrders.length,
      created,
      updated,
    };
  })().finally(() => {
    reconcileInFlight = null;
  });

  return reconcileInFlight;
}
