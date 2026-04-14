import { ShipmentStatus } from '@prisma/client';
import { SHIPMENT_STATUS_DISPLAY_NAMES, selectLatestFedExTrackingEvent } from '@erp/shared';
import { resolveFedExShipmentRecordStatus } from './fedex-record-status.js';
import { resolveFedExShipmentSourceLabel } from './fedex-source-label.js';
import { formatTrackingLocation, normalizeTrackingNumber } from './shipment-tracking.js';

type FedExTrackingEvent = {
  eventType: string;
  eventDate: Date | string;
  eventTime?: Date | string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
  description?: string | null;
  sourceSystem?: string | null;
  rawData?: unknown;
  createdAt?: Date | string | null;
};

type FedExShipmentRecord = {
  trackingNumber: string | null;
  importedAt?: Date | string | null;
  eventTimestamp?: Date | string | null;
  sourceFileDate?: Date | string | null;
  sourceFileName?: string | null;
  service?: string | null;
  rawData?: unknown;
};

export type FedExStatusSummary = {
  status: string | null;
  eventType: string | null;
  description: string | null;
  eventTimestamp: string | null;
  sourceFileName: string | null;
  sourceFileDate: string | null;
  sourceLabel: string | null;
  location: string | null;
  trackingNumber: string | null;
  stale: boolean | null;
  issue: string | null;
};

export type FedExStatusSummarySource = {
  trackingEvents?: FedExTrackingEvent[] | null;
  workOrder?: {
    status?: string | null;
    fedExShipmentRecords?: FedExShipmentRecord[] | null;
  } | null;
};

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

function pickDateIso(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (!value) {
      continue;
    }

    const date = value instanceof Date ? value : new Date(String(value));
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  return null;
}

export function formatFedExStatusLabel(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  const enumName = normalized.toUpperCase().replace(/[\s-]+/g, '_');
  if (enumName in ShipmentStatus) {
    const enumValue = ShipmentStatus[enumName as keyof typeof ShipmentStatus];
    return SHIPMENT_STATUS_DISPLAY_NAMES[enumValue] ?? normalized;
  }

  return normalized
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function extractFedExLookupIssue(rawData: unknown): string | null {
  const root = asRecord(rawData);
  const response = asRecord(root.response);
  const output = asRecord(response.output);
  const completeTrackResults = Array.isArray(output.completeTrackResults) ? output.completeTrackResults : [];

  for (const completeTrackResult of completeTrackResults) {
    const trackResultRecord = asRecord(completeTrackResult);
    const trackResults = Array.isArray(trackResultRecord.trackResults) ? trackResultRecord.trackResults : [];
    for (const trackResult of trackResults) {
      const error = asRecord(asRecord(trackResult).error);
      const message = pickString(error, ['message', 'code']);
      if (message) {
        return message;
      }
    }
  }

  return pickString(root, ['issue', 'error', 'message', 'warning']);
}

export function resolveFedExAddressIssue(
  location: string | null,
  lookupIssue: string | null
): string | null {
  return lookupIssue ?? (!location ? 'No Address Found' : null);
}

export function resolveFedExStatusSummary(
  shipment: FedExStatusSummarySource
): FedExStatusSummary | null {
  const latestFedExApiEvent = selectLatestFedExTrackingEvent(
    shipment.trackingEvents?.filter((event) => event.sourceSystem?.toLowerCase() === 'fedex_api') ?? []
  );

  if (latestFedExApiEvent) {
    const eventRawData = asRecord(latestFedExApiEvent.rawData);
    const fetchedAtIso =
      pickDateIso(eventRawData, ['fetchedAt']) ??
      (latestFedExApiEvent.createdAt ? new Date(latestFedExApiEvent.createdAt).toISOString() : null);
    const eventDateIso = new Date(latestFedExApiEvent.eventDate).toISOString();
    const staleThresholdMs = 24 * 60 * 60 * 1000;
    const staleFromDate = fetchedAtIso ? new Date(fetchedAtIso) : new Date(eventDateIso);
    const isStale = Number.isNaN(staleFromDate.getTime())
      ? null
      : Date.now() - staleFromDate.getTime() > staleThresholdMs;

    return {
      status: formatFedExStatusLabel(
        pickString(eventRawData, ['derivedStatus', 'status']) ?? latestFedExApiEvent.eventType
      ),
      eventType: formatFedExStatusLabel(latestFedExApiEvent.eventType ?? null),
      description: latestFedExApiEvent.description ?? null,
      eventTimestamp: eventDateIso,
      sourceFileName: 'fedex_api',
      sourceFileDate: fetchedAtIso,
      sourceLabel: resolveFedExShipmentSourceLabel(eventRawData, 'fedex_api'),
      location:
        (formatTrackingLocation(eventRawData.location) ??
          formatTrackingLocation(eventRawData.scanEvent) ??
          [latestFedExApiEvent.city, latestFedExApiEvent.state, latestFedExApiEvent.zip, latestFedExApiEvent.country]
            .filter((value): value is string => Boolean(value))
            .join(', ')) || null,
      trackingNumber:
        normalizeTrackingNumber(pickString(eventRawData, ['trackingNumber'])) ??
        normalizeTrackingNumber(shipment.workOrder?.fedExShipmentRecords?.[0]?.trackingNumber) ??
        null,
      stale: isStale,
      issue: null,
    };
  }

  const latestRecord = shipment.workOrder?.fedExShipmentRecords?.[0];
  if (!latestRecord) {
    return null;
  }

  const rawRecord = asRecord(latestRecord.rawData);
  const rawRow = asRecord(rawRecord.row);
  const lookupIssue = extractFedExLookupIssue(rawRecord);
  const statusMeta = resolveFedExShipmentRecordStatus(rawRecord);
  const status = formatFedExStatusLabel(statusMeta.latestStatus);

  const eventTimestamp =
    pickDateIso(rawRow, [
      'eventTimestamp',
      'status updated at',
      'status date',
      'last scan date',
      'scan date',
      'delivery date',
    ]) ??
    pickDateIso(rawRecord, ['eventTimestamp', 'statusUpdatedAt', 'statusDate', 'lastScanAt']) ??
    (latestRecord.eventTimestamp instanceof Date
      ? latestRecord.eventTimestamp.toISOString()
      : latestRecord.eventTimestamp
        ? new Date(latestRecord.eventTimestamp).toISOString()
        : null) ??
    (latestRecord.sourceFileDate instanceof Date
      ? latestRecord.sourceFileDate.toISOString()
      : latestRecord.sourceFileDate
        ? new Date(latestRecord.sourceFileDate).toISOString()
        : null) ??
    (latestRecord.importedAt instanceof Date
      ? latestRecord.importedAt.toISOString()
      : latestRecord.importedAt
        ? new Date(latestRecord.importedAt).toISOString()
        : null);

  const city = pickString(rawRow, ['city', 'last scan city', 'scan city', 'destination city']);
  const state = pickString(rawRow, ['state', 'last scan state', 'scan state', 'destination state']);
  const zip = pickString(rawRow, ['zip', 'postal code', 'last scan zip', 'scan zip']);
  const location =
    (formatTrackingLocation(rawRecord.location) ??
      formatTrackingLocation(rawRecord.scanEvent) ??
      [city, state, zip].filter((value): value is string => Boolean(value)).join(', ')) || null;

  return {
    status,
    eventType: formatFedExStatusLabel(
      pickString(rawRow, ['eventType', 'event type', 'type', 'scan type']) ?? null
    ),
    description:
      statusMeta.latestDescription ??
      pickString(rawRow, [
        'tracking message',
        'event description',
      ]) ??
      null,
    eventTimestamp,
    sourceFileName:
      pickString(rawRecord, ['sourceFileName']) ??
      latestRecord.sourceFileName ??
      null,
    sourceFileDate:
      pickDateIso(rawRecord, ['sourceFileDate']) ??
      (latestRecord.sourceFileDate instanceof Date
        ? latestRecord.sourceFileDate.toISOString()
        : latestRecord.sourceFileDate
          ? new Date(latestRecord.sourceFileDate).toISOString()
          : null),
    sourceLabel: resolveFedExShipmentSourceLabel(
      rawRecord,
      pickString(rawRecord, ['sourceFileName']) ?? latestRecord.sourceFileName ?? null,
      pickString(rawRecord, ['sourceFilePath']) ?? null
    ),
    location,
    trackingNumber: normalizeTrackingNumber(latestRecord.trackingNumber),
    stale: false,
    issue: resolveFedExAddressIssue(location, lookupIssue),
  };
}
