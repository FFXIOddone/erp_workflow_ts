import { Carrier } from '@prisma/client';
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

let reconcileInFlight: Promise<ShipmentLinkingResult> | null = null;

async function createPlaceholderShipmentForWorkOrder(
  workOrder: ShipmentWorkOrderSeed,
  options: {
    createdById?: string;
    shipDate?: Date;
    notes?: string;
    carrier?: Carrier;
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
      trackingNumber: null,
      shipDate: options.shipDate ?? workOrder.updatedAt,
      status: 'PICKED_UP',
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
  } = {}
): Promise<boolean> {
  return createPlaceholderShipmentForWorkOrder(workOrder, options);
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
        const carrier = evidence?.found
          ? evidence.evidenceRoot?.toUpperCase().includes('FEDEX')
            ? Carrier.FEDEX
            : evidence.evidenceRoot?.toUpperCase().includes('FREIGHT')
              ? Carrier.FREIGHT
              : Carrier.OTHER
          : Carrier.OTHER;

        const didCreate = await createPlaceholderShipmentForWorkOrder(workOrder, {
          shipDate: workOrder.updatedAt,
          carrier,
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
