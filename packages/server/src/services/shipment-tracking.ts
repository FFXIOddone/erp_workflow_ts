type TrackingTimestamp = Date | string | null | undefined;

export interface ShipmentTrackingSource {
  trackingNumber: string | null;
  scannedAt?: TrackingTimestamp;
  eventTimestamp?: TrackingTimestamp;
  importedAt?: TrackingTimestamp;
  createdAt?: TrackingTimestamp;
}

export interface ShipmentTrackingCandidate {
  trackingNumber: string | null;
  labelScans?: ShipmentTrackingSource[] | null;
  workOrder?: {
    shippingScans?: ShipmentTrackingSource[] | null;
    fedExShipmentRecords?: ShipmentTrackingSource[] | null;
  } | null;
}

function normalizeTrackingNumber(value: string | null | undefined): string | null {
  const trackingNumber = value?.trim() ?? '';
  return trackingNumber.length > 0 ? trackingNumber : null;
}

function sourceTimestamp(source: ShipmentTrackingSource): number {
  const candidates = [source.scannedAt, source.eventTimestamp, source.importedAt, source.createdAt];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    const date = candidate instanceof Date ? candidate : new Date(candidate);
    const time = date.getTime();
    if (!Number.isNaN(time)) {
      return time;
    }
  }

  return 0;
}

function latestTrackingNumber(sources?: readonly ShipmentTrackingSource[] | null): string | null {
  if (!sources?.length) {
    return null;
  }

  let latestTrackingNumber: string | null = null;
  let latestTimestamp = Number.NEGATIVE_INFINITY;

  for (const source of sources) {
    const trackingNumber = normalizeTrackingNumber(source.trackingNumber);
    if (!trackingNumber) {
      continue;
    }

    const timestamp = sourceTimestamp(source);
    if (timestamp >= latestTimestamp) {
      latestTimestamp = timestamp;
      latestTrackingNumber = trackingNumber;
    }
  }

  return latestTrackingNumber;
}

export function resolveShipmentTrackingNumber(shipment: ShipmentTrackingCandidate): string | null {
  return (
    normalizeTrackingNumber(shipment.trackingNumber) ??
    latestTrackingNumber(shipment.labelScans) ??
    latestTrackingNumber(shipment.workOrder?.shippingScans) ??
    latestTrackingNumber(shipment.workOrder?.fedExShipmentRecords) ??
    null
  );
}

export function applyShipmentTrackingNumber<T extends ShipmentTrackingCandidate>(
  shipment: T
): T & { trackingNumber: string | null } {
  return {
    ...shipment,
    trackingNumber: resolveShipmentTrackingNumber(shipment),
  };
}
