import { Carrier, ShipmentStatus } from '@prisma/client';
import { prisma } from '../db/client.js';
import { findShipmentEvidence } from '../lib/folder-utils.js';

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
}

type ShipmentCarrierSignals = {
  evidenceRoot?: string | null;
  hasFedExRecord?: boolean;
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
        shipments: { none: {} },
      },
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        description: true,
        createdById: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    const linkedFedExRows = workOrders.length
      ? await prisma.fedExShipmentRecord.findMany({
          where: {
            workOrderId: { in: workOrders.map((workOrder) => workOrder.id) },
          },
          select: {
            workOrderId: true,
            trackingNumber: true,
            importedAt: true,
          },
          orderBy: [{ importedAt: 'desc' }],
        })
      : [];

    const fedExEvidenceByWorkOrder = new Set<string>();
    const latestFedExByWorkOrder = new Map<string, { trackingNumber: string | null }>();
    for (const row of linkedFedExRows) {
      if (!row.workOrderId) {
        continue;
      }

      fedExEvidenceByWorkOrder.add(row.workOrderId);

      if (!latestFedExByWorkOrder.has(row.workOrderId) && row.trackingNumber?.trim()) {
        latestFedExByWorkOrder.set(row.workOrderId, {
          trackingNumber: row.trackingNumber.trim(),
        });
      }
    }

    let created = 0;
    for (const workOrder of workOrders) {
      try {
        const woNumber = workOrder.orderNumber.replace(/\D+/g, '');
        const evidence = settings?.networkDriveBasePath
          ? findShipmentEvidence(
              settings.networkDriveBasePath,
              woNumber,
              workOrder.customerName,
              workOrder.description ?? undefined,
            )
          : null;
        const linkedFedEx = latestFedExByWorkOrder.get(workOrder.id);
        const carrier = inferShipmentCarrierFromSignals({
          evidenceRoot: evidence?.evidenceRoot,
          hasFedExRecord: fedExEvidenceByWorkOrder.has(workOrder.id),
        });

        const didCreate = await createPlaceholderShipmentForWorkOrder(workOrder, {
          shipDate: workOrder.updatedAt,
          carrier,
          trackingNumber: linkedFedEx?.trackingNumber ?? null,
          status: inferBackfilledShipmentStatus(),
          notes: evidence?.found
            ? `Backfilled from SHIPPED order ${workOrder.orderNumber}. Evidence: ${evidence.evidencePath}`
            : `Backfilled from SHIPPED order ${workOrder.orderNumber}`,
        });
        if (didCreate) {
          created += 1;
        }
      } catch (err) {
        console.warn(`Failed to reconcile shipment for order ${workOrder.orderNumber}:`, err);
      }
    }

    return {
      scanned: workOrders.length,
      created,
    };
  })().finally(() => {
    reconcileInFlight = null;
  });

  return reconcileInFlight;
}
