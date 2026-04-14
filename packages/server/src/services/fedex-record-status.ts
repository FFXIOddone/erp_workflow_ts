function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function pickString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value !== 'string') {
      continue;
    }
    const trimmed = value.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return null;
}

export type FedExShipmentRecordStatus = {
  latestStatus: string | null;
  latestStatusCode: string | null;
  latestDescription: string | null;
};

export function resolveFedExShipmentRecordStatus(rawData: unknown): FedExShipmentRecordStatus {
  const root = asRecord(rawData);
  const row = asRecord(root.row);

  const latestStatus =
    pickString(root, ['status', 'shipmentStatus', 'trackingStatus', 'deliveryStatus']) ??
    pickString(row, ['status', 'shipment status', 'tracking status', 'delivery status']) ??
    null;

  const latestStatusCode =
    pickString(root, ['code', 'statusCode']) ??
    pickString(row, ['eventType', 'event type', 'code']) ??
    null;

  const latestDescription =
    pickString(root, ['description', 'message']) ??
    pickString(row, ['description', 'status description', 'event description']) ??
    null;

  return {
    latestStatus,
    latestStatusCode,
    latestDescription,
  };
}
