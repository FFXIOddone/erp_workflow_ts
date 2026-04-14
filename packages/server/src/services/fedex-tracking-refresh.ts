import { Carrier, ShipmentStatus } from '@prisma/client';
import { prisma } from '../db/client.js';
import { reconcileShippedOrdersWithShipments } from './shipment-linking.js';
import {
  applyShipmentTrackingNumber,
  type ShipmentTrackingCandidate,
} from './shipment-tracking.js';
import {
  isFedExApiConfigured,
  isLikelyFedExTrackingNumber,
  syncFedExTrackingForShipment,
} from './fedex-api.js';

export interface FedExTrackingRefreshCycleResult {
  status: 'synced' | 'skipped' | 'not_configured';
  startedAt: Date;
  finishedAt: Date;
  scanned: number;
  eligible: number;
  refreshed: number;
  skipped: number;
  errors: number;
}

type FedExTrackingRefreshShipment = ShipmentTrackingCandidate & {
  id: string;
  carrier: Carrier;
  status: ShipmentStatus;
  shipDate: Date | null;
};

export function isHourlyFedExRefreshCandidate(shipment: {
  carrier: Carrier;
  trackingNumber: string | null;
}): boolean {
  return Boolean(shipment.trackingNumber && isLikelyFedExTrackingNumber(shipment.trackingNumber));
}

export function isFullFedExRefreshCandidate(shipment: {
  trackingNumber: string | null;
}): boolean {
  return Boolean(shipment.trackingNumber);
}

let refreshTimer: NodeJS.Timeout | null = null;
let refreshInFlight = false;
let lastRefreshStartedAt: Date | null = null;

function chunkArray<T>(values: T[], size: number): T[][] {
  if (values.length === 0) {
    return [];
  }

  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

function getDelayUntilNextTopOfHour(now = new Date()): number {
  const next = new Date(now);
  next.setMinutes(0, 0, 0);
  next.setHours(next.getHours() + 1);
  return Math.max(1_000, next.getTime() - now.getTime());
}

async function loadTrackableFedExShipments(): Promise<FedExTrackingRefreshShipment[]> {
  const shipments = await prisma.shipment.findMany({
    where: {
      shipDate: { not: null },
      status: {
        not: ShipmentStatus.DELIVERED,
      },
    },
    select: {
      id: true,
      carrier: true,
      status: true,
      shipDate: true,
      trackingNumber: true,
      labelScans: {
        select: {
          trackingNumber: true,
          scannedAt: true,
        },
        orderBy: {
          scannedAt: 'desc',
        },
        take: 1,
      },
      workOrder: {
        select: {
          shippingScans: {
            select: {
              trackingNumber: true,
              scannedAt: true,
            },
            orderBy: {
              scannedAt: 'desc',
            },
            take: 1,
          },
          fedExShipmentRecords: {
            select: {
              trackingNumber: true,
              importedAt: true,
              eventTimestamp: true,
            },
            orderBy: {
              importedAt: 'desc',
            },
            take: 1,
          },
        },
      },
    },
    orderBy: [
      { shipDate: 'desc' },
      { updatedAt: 'desc' },
    ],
  });

  return shipments.map((shipment) => applyShipmentTrackingNumber(shipment)) as FedExTrackingRefreshShipment[];
}

async function loadTrackedShipmentsForFullReconciliation(): Promise<FedExTrackingRefreshShipment[]> {
  const shipments = await prisma.shipment.findMany({
    where: {
      trackingNumber: { not: null },
    },
    select: {
      id: true,
      carrier: true,
      status: true,
      shipDate: true,
      trackingNumber: true,
      labelScans: {
        select: {
          trackingNumber: true,
          scannedAt: true,
        },
        orderBy: {
          scannedAt: 'desc',
        },
        take: 1,
      },
      workOrder: {
        select: {
          shippingScans: {
            select: {
              trackingNumber: true,
              scannedAt: true,
            },
            orderBy: {
              scannedAt: 'desc',
            },
            take: 1,
          },
          fedExShipmentRecords: {
            select: {
              trackingNumber: true,
              importedAt: true,
              eventTimestamp: true,
            },
            orderBy: {
              importedAt: 'desc',
            },
            take: 1,
          },
        },
      },
    },
    orderBy: [
      { updatedAt: 'desc' },
      { shipDate: 'desc' },
    ],
  });

  return shipments.map((shipment) => applyShipmentTrackingNumber(shipment)) as FedExTrackingRefreshShipment[];
}

export async function runFedExTrackingRefreshCycle(): Promise<FedExTrackingRefreshCycleResult> {
  const startedAt = new Date();

  if (!isFedExApiConfigured()) {
    return {
      status: 'not_configured',
      startedAt,
      finishedAt: new Date(),
      scanned: 0,
      eligible: 0,
      refreshed: 0,
      skipped: 0,
      errors: 0,
    };
  }

  if (refreshInFlight) {
    return {
      status: 'skipped',
      startedAt,
      finishedAt: new Date(),
      scanned: 0,
      eligible: 0,
      refreshed: 0,
      skipped: 0,
      errors: 0,
    };
  }

  refreshInFlight = true;
  lastRefreshStartedAt = startedAt;

  try {
    await reconcileShippedOrdersWithShipments();

    const shipments = await loadTrackableFedExShipments();
    const eligibleShipments = shipments.filter((shipment) => isHourlyFedExRefreshCandidate(shipment));
    let refreshed = 0;
    let skipped = 0;
    let errors = 0;

    for (const batch of chunkArray(eligibleShipments, 4)) {
      await Promise.all(
        batch.map(async (shipment) => {
          try {
            const result = await syncFedExTrackingForShipment(shipment.id);
            if (result.status === 'synced') {
              refreshed += 1;
            } else {
              skipped += 1;
            }
          } catch (error) {
            errors += 1;
            console.warn(`[FedEx Hourly] Failed to refresh shipment ${shipment.id}:`, error);
          }
        })
      );
    }

    return {
      status: 'synced',
      startedAt,
      finishedAt: new Date(),
      scanned: shipments.length,
      eligible: eligibleShipments.length,
      refreshed,
      skipped,
      errors,
    };
  } finally {
    refreshInFlight = false;
  }
}

export async function runFedExTrackingFullReconciliationCycle(): Promise<FedExTrackingRefreshCycleResult> {
  const startedAt = new Date();

  if (!isFedExApiConfigured()) {
    return {
      status: 'not_configured',
      startedAt,
      finishedAt: new Date(),
      scanned: 0,
      eligible: 0,
      refreshed: 0,
      skipped: 0,
      errors: 0,
    };
  }

  if (refreshInFlight) {
    return {
      status: 'skipped',
      startedAt,
      finishedAt: new Date(),
      scanned: 0,
      eligible: 0,
      refreshed: 0,
      skipped: 0,
      errors: 0,
    };
  }

  refreshInFlight = true;
  lastRefreshStartedAt = startedAt;

  try {
    await reconcileShippedOrdersWithShipments();

    const shipments = await loadTrackedShipmentsForFullReconciliation();
    const eligibleShipments = shipments.filter((shipment) => isFullFedExRefreshCandidate(shipment));
    let refreshed = 0;
    let skipped = 0;
    let errors = 0;

    for (const batch of chunkArray(eligibleShipments, 4)) {
      await Promise.all(
        batch.map(async (shipment) => {
          try {
            const result = await syncFedExTrackingForShipment(shipment.id, { force: true });
            if (result.status === 'synced') {
              refreshed += 1;
            } else {
              skipped += 1;
            }
          } catch (error) {
            errors += 1;
            console.warn(`[FedEx Full Reconcile] Failed to refresh shipment ${shipment.id}:`, error);
          }
        })
      );
    }

    return {
      status: 'synced',
      startedAt,
      finishedAt: new Date(),
      scanned: shipments.length,
      eligible: eligibleShipments.length,
      refreshed,
      skipped,
      errors,
    };
  } finally {
    refreshInFlight = false;
  }
}

function scheduleNextHourlyRefresh(): void {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
  }

  const delay = getDelayUntilNextTopOfHour();
  refreshTimer = setTimeout(() => {
    void runFedExTrackingRefreshCycle()
      .catch((error) => {
        console.warn('[FedEx Hourly] Refresh cycle failed:', error);
      })
      .finally(() => {
        scheduleNextHourlyRefresh();
      });
  }, delay);
}

export function startFedExHourlyTrackingRefresh(): void {
  if (refreshTimer) {
    return;
  }

  void runFedExTrackingRefreshCycle()
    .catch((error) => {
      console.warn('[FedEx Hourly] Initial refresh cycle failed:', error);
    })
    .finally(() => {
      scheduleNextHourlyRefresh();
    });
}

export function getFedExHourlyTrackingRefreshState(): {
  inFlight: boolean;
  lastRefreshStartedAt: Date | null;
} {
  return {
    inFlight: refreshInFlight,
    lastRefreshStartedAt,
  };
}
