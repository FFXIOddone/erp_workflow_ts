type TrackingTimestamp = Date | string | null | undefined;

const TRACKING_NUMBER_WRAPPER_QUOTES = /^['"“”‘’]+|['"“”‘’]+$/g;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function pickString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }

  return null;
}

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

export function normalizeTrackingNumber(value: string | null | undefined): string | null {
  const trackingNumber = value?.trim() ?? '';
  if (!trackingNumber) {
    return null;
  }

  const normalized = trackingNumber
    .replace(TRACKING_NUMBER_WRAPPER_QUOTES, '')
    .replace(/\s+/g, '');

  return normalized.length > 0 ? normalized : null;
}

export function formatTrackingLocation(value: unknown): string | null {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  const record = asRecord(value);
  if (Object.keys(record).length === 0) {
    return null;
  }

  const direct = pickString(record, ['locationLabel', 'location', 'cityState']);
  if (direct) {
    return direct;
  }

  for (const nestedSource of [
    record.scanLocation,
    record.location,
    record.destination,
    record.address,
    record.recipient,
  ]) {
    const nested = formatTrackingLocation(nestedSource);
    if (nested) {
      return nested;
    }
  }

  const city = pickString(record, ['city', 'cityName', 'destinationCity', 'scanCity']);
  const state = pickString(record, ['state', 'stateOrProvinceCode', 'destinationState', 'scanState']);
  const zip = pickString(record, ['zip', 'postalCode', 'destinationPostalCode', 'scanZip']);
  const country = pickString(record, ['country', 'countryCode', 'destinationCountry', 'scanCountry']);

  const parts = [city, state, zip, country].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(', ') : null;
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
