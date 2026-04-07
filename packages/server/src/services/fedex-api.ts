import { Carrier, ShipmentStatus, TrackingEventType, type Prisma } from '@prisma/client';
import { prisma } from '../db/client.js';

const DEFAULT_FEDEX_API_BASE_URL = 'https://apis-sandbox.fedex.com';
const TRACKING_SNAPSHOT_TTL_MS = 2 * 60 * 1000;
const STATUS_SYNC_MIN_INTERVAL_MS = 15 * 60 * 1000;
const BACKGROUND_REFRESH_COOLDOWN_MS = 5 * 60 * 1000;

type FedExApiConfig = {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  accountNumber: string | null;
};

type FedExApiTokenCache = {
  baseUrl: string;
  token: string;
  expiresAt: number;
};

type FedExTrackScanEvent = {
  timestamp: Date;
  eventType: string | null;
  derivedStatus: string | null;
  description: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  exceptionCode: string | null;
  exceptionDescription: string | null;
  rawData: Record<string, unknown>;
};

type FedExTrackingSnapshot = {
  trackingNumber: string;
  latestStatus: string | null;
  latestStatusCode: string | null;
  latestDescription: string | null;
  latestEventTimestamp: Date | null;
  latestLocation: {
    city: string | null;
    state: string | null;
    zip: string | null;
    country: string | null;
  } | null;
  serviceDescription: string | null;
  recipient: {
    city: string | null;
    state: string | null;
    zip: string | null;
    country: string | null;
  } | null;
  events: FedExTrackScanEvent[];
  fetchedAt: Date;
  sourceBaseUrl: string;
  rawResponse: Record<string, unknown>;
};

export type FedExShipmentStatusSyncResult = {
  shipmentId: string;
  trackingNumber: string | null;
  status: 'synced' | 'skipped' | 'missing_tracking' | 'not_configured';
  reason: string | null;
  shipmentStatus: ShipmentStatus | null;
  actualDelivery: Date | null;
  carrier: Carrier | null;
  eventCount: number;
  lastEventAt: Date | null;
  fedExStatus: string | null;
};

let tokenCache: FedExApiTokenCache | null = null;
const snapshotCache = new Map<string, { expiresAt: number; snapshot: FedExTrackingSnapshot }>();
const trackingRequestInFlight = new Map<string, Promise<FedExTrackingSnapshot>>();
const shipmentSyncInFlight = new Map<string, Promise<FedExShipmentStatusSyncResult>>();
const backgroundRefreshByShipment = new Map<string, number>();

function normalizeTrackingNumber(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/\s+/g, '').trim();
  return normalized.length > 0 ? normalized : null;
}

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

function parseDate(value: unknown): Date | null {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function resolveFedExApiConfig(): FedExApiConfig | null {
  const clientId = process.env.FEDEX_API_CLIENT_ID?.trim() ?? '';
  const clientSecret = process.env.FEDEX_API_CLIENT_SECRET?.trim() ?? '';
  if (!clientId || !clientSecret) {
    return null;
  }

  return {
    baseUrl: (process.env.FEDEX_API_BASE_URL?.trim() || DEFAULT_FEDEX_API_BASE_URL).replace(/\/+$/, ''),
    clientId,
    clientSecret,
    accountNumber: process.env.FEDEX_API_ACCOUNT_NUMBER?.trim() || null,
  };
}

export function isFedExApiConfigured(): boolean {
  return resolveFedExApiConfig() !== null;
}

async function getFedExAccessToken(config: FedExApiConfig): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.baseUrl === config.baseUrl && tokenCache.expiresAt > now + 10_000) {
    return tokenCache.token;
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });

  const response = await fetch(`${config.baseUrl}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    const payload = await response.text().catch(() => '');
    throw new Error(`FedEx OAuth failed (${response.status}): ${payload || 'no response body'}`);
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const token = pickString(payload, ['access_token']);
  const expiresIn = Number(payload.expires_in ?? 3600);

  if (!token) {
    throw new Error('FedEx OAuth succeeded without access_token');
  }

  tokenCache = {
    baseUrl: config.baseUrl,
    token,
    expiresAt: now + Math.max(60, Number.isFinite(expiresIn) ? expiresIn - 30 : 3570) * 1000,
  };

  return token;
}

function mapScanEventType(scan: FedExTrackScanEvent): TrackingEventType {
  const description = `${scan.description ?? ''} ${scan.derivedStatus ?? ''} ${scan.eventType ?? ''}`
    .toLowerCase()
    .trim();

  if (description.includes('delivered')) return TrackingEventType.DELIVERED;
  if (description.includes('out for delivery')) return TrackingEventType.OUT_FOR_DELIVERY;
  if (description.includes('delivery attempted')) return TrackingEventType.DELIVERY_ATTEMPT;
  if (description.includes('exception') || description.includes('delay')) return TrackingEventType.EXCEPTION;
  if (description.includes('returned')) return TrackingEventType.RETURNED;
  if (description.includes('customs')) return TrackingEventType.CUSTOMS;
  if (description.includes('hold') || description.includes('ready for pickup')) return TrackingEventType.HELD;
  if (description.includes('picked up')) return TrackingEventType.PICKED_UP;
  if (description.includes('label') || description.includes('shipment information sent')) {
    return TrackingEventType.LABEL_CREATED;
  }

  return TrackingEventType.IN_TRANSIT;
}

function mapSnapshotToShipmentStatus(snapshot: FedExTrackingSnapshot): ShipmentStatus {
  const statusText = `${snapshot.latestDescription ?? ''} ${snapshot.latestStatus ?? ''}`
    .toLowerCase()
    .trim();

  if (statusText.includes('delivered')) {
    return ShipmentStatus.DELIVERED;
  }
  if (statusText.includes('exception') || statusText.includes('delay') || statusText.includes('delivery attempted')) {
    return ShipmentStatus.EXCEPTION;
  }
  if (statusText.includes('picked up') && !statusText.includes('ready for pickup')) {
    return ShipmentStatus.PICKED_UP;
  }
  if (
    statusText.includes('in transit') ||
    statusText.includes('out for delivery') ||
    statusText.includes('ready for pickup') ||
    statusText.includes('at local fedex facility')
  ) {
    return ShipmentStatus.IN_TRANSIT;
  }

  return ShipmentStatus.IN_TRANSIT;
}

function parseFedExTrackingSnapshot(
  trackingNumber: string,
  baseUrl: string,
  payload: Record<string, unknown>
): FedExTrackingSnapshot {
  const output = asRecord(payload.output);
  const completeTrackResultsRaw = output.completeTrackResults;
  const completeTrackResults = Array.isArray(completeTrackResultsRaw)
    ? completeTrackResultsRaw
    : completeTrackResultsRaw
      ? [completeTrackResultsRaw]
      : [];
  const firstCompleteTrack = asRecord(completeTrackResults[0]);
  const trackResultsRaw = firstCompleteTrack.trackResults;
  const trackResults = Array.isArray(trackResultsRaw) ? trackResultsRaw : trackResultsRaw ? [trackResultsRaw] : [];
  const trackResult = asRecord(trackResults[0]);

  if (!Object.keys(trackResult).length) {
    throw new Error(`FedEx Track returned no track result for ${trackingNumber}`);
  }

  const latestStatusDetail = asRecord(trackResult.latestStatusDetail);
  const latestStatusLocation = asRecord(latestStatusDetail.scanLocation);
  const serviceDetail = asRecord(trackResult.serviceDetail);
  const recipientAddress = asRecord(asRecord(trackResult.recipientInformation).address);

  const scanEventsRaw = Array.isArray(trackResult.scanEvents) ? trackResult.scanEvents : [];
  const scanEvents: FedExTrackScanEvent[] = scanEventsRaw
    .map((entry) => {
      const item = asRecord(entry);
      const eventTimestamp = parseDate(item.date);
      if (!eventTimestamp) {
        return null;
      }

      const scanLocation = asRecord(item.scanLocation);
      return {
        timestamp: eventTimestamp,
        eventType: pickString(item, ['eventType']),
        derivedStatus: pickString(item, ['derivedStatus']),
        description: pickString(item, ['eventDescription', 'derivedStatus']) ?? 'Tracking update',
        city: pickString(scanLocation, ['city']),
        state: pickString(scanLocation, ['stateOrProvinceCode']),
        zip: pickString(scanLocation, ['postalCode']),
        country: pickString(scanLocation, ['countryCode', 'countryName']),
        exceptionCode: pickString(item, ['exceptionCode']),
        exceptionDescription: pickString(item, ['exceptionDescription']),
        rawData: item,
      };
    })
    .filter((value): value is FedExTrackScanEvent => Boolean(value))
    .sort((left, right) => right.timestamp.getTime() - left.timestamp.getTime());

  const latestEventTimestamp = scanEvents[0]?.timestamp ?? parseDate(pickString(latestStatusDetail, ['scanDate']));

  return {
    trackingNumber,
    latestStatus: pickString(latestStatusDetail, ['statusByLocale', 'derivedCode']),
    latestStatusCode: pickString(latestStatusDetail, ['code', 'derivedCode']),
    latestDescription: pickString(latestStatusDetail, ['description', 'statusByLocale']),
    latestEventTimestamp,
    latestLocation: {
      city: pickString(latestStatusLocation, ['city']),
      state: pickString(latestStatusLocation, ['stateOrProvinceCode']),
      zip: pickString(latestStatusLocation, ['postalCode']),
      country: pickString(latestStatusLocation, ['countryCode', 'countryName']),
    },
    serviceDescription: pickString(serviceDetail, ['description', 'type']),
    recipient: {
      city: pickString(recipientAddress, ['city']),
      state: pickString(recipientAddress, ['stateOrProvinceCode']),
      zip: pickString(recipientAddress, ['postalCode']),
      country: pickString(recipientAddress, ['countryCode', 'countryName']),
    },
    events: scanEvents,
    fetchedAt: new Date(),
    sourceBaseUrl: baseUrl,
    rawResponse: payload,
  };
}

export async function fetchFedExTrackingSnapshot(
  trackingNumber: string,
  options: { force?: boolean } = {}
): Promise<FedExTrackingSnapshot> {
  const normalizedTrackingNumber = normalizeTrackingNumber(trackingNumber);
  if (!normalizedTrackingNumber) {
    throw new Error('Tracking number is required');
  }

  const cacheKey = normalizedTrackingNumber;
  const now = Date.now();
  const cached = snapshotCache.get(cacheKey);
  if (!options.force && cached && cached.expiresAt > now) {
    return cached.snapshot;
  }

  const inFlight = trackingRequestInFlight.get(cacheKey);
  if (!options.force && inFlight) {
    return inFlight;
  }

  const config = resolveFedExApiConfig();
  if (!config) {
    throw new Error('FedEx API is not configured');
  }

  const requestPromise = (async () => {
    const token = await getFedExAccessToken(config);

    const response = await fetch(`${config.baseUrl}/track/v1/trackingnumbers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        includeDetailedScans: true,
        trackingInfo: [
          {
            trackingNumberInfo: {
              trackingNumber: normalizedTrackingNumber,
            },
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorPayload = await response.text().catch(() => '');
      throw new Error(
        `FedEx Track request failed (${response.status}): ${errorPayload || 'no response body'}`
      );
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const snapshot = parseFedExTrackingSnapshot(normalizedTrackingNumber, config.baseUrl, payload);

    snapshotCache.set(cacheKey, {
      snapshot,
      expiresAt: Date.now() + TRACKING_SNAPSHOT_TTL_MS,
    });

    return snapshot;
  })()
    .finally(() => {
      trackingRequestInFlight.delete(cacheKey);
    });

  trackingRequestInFlight.set(cacheKey, requestPromise);
  return requestPromise;
}

function toFedExTrackingEventData(
  shipmentId: string,
  scanEvent: FedExTrackScanEvent,
  fetchedAt: Date
): Prisma.TrackingEventCreateManyInput {
  return {
    shipmentId,
    eventType: mapScanEventType(scanEvent),
    eventDate: scanEvent.timestamp,
    eventTime: scanEvent.timestamp,
    city: scanEvent.city,
    state: scanEvent.state,
    zip: scanEvent.zip,
    country: scanEvent.country,
    description: scanEvent.description,
    exceptionCode: scanEvent.exceptionCode,
    exceptionReason: scanEvent.exceptionDescription,
    sourceSystem: 'fedex_api',
    rawData: {
      fetchedAt: fetchedAt.toISOString(),
      scanEvent: scanEvent.rawData,
      derivedStatus: scanEvent.derivedStatus,
      eventType: scanEvent.eventType,
    } as Prisma.InputJsonValue,
  };
}

export async function syncFedExTrackingForShipment(
  shipmentId: string,
  options: { force?: boolean } = {}
): Promise<FedExShipmentStatusSyncResult> {
  const inFlight = shipmentSyncInFlight.get(shipmentId);
  if (!options.force && inFlight) {
    return inFlight;
  }

  const task = (async (): Promise<FedExShipmentStatusSyncResult> => {
    const config = resolveFedExApiConfig();
    if (!config) {
      return {
        shipmentId,
        trackingNumber: null,
        status: 'not_configured',
        reason: 'FedEx API credentials are not configured',
        shipmentStatus: null,
        actualDelivery: null,
        carrier: null,
        eventCount: 0,
        lastEventAt: null,
        fedExStatus: null,
      };
    }

    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      select: {
        id: true,
        carrier: true,
        status: true,
        trackingNumber: true,
        actualDelivery: true,
        workOrderId: true,
        trackingEvents: {
          where: {
            sourceSystem: 'fedex_api',
          },
          select: {
            id: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
    });

    if (!shipment) {
      throw new Error(`Shipment ${shipmentId} not found`);
    }

    const normalizedTrackingNumber = normalizeTrackingNumber(shipment.trackingNumber);
    if (!normalizedTrackingNumber) {
      return {
        shipmentId,
        trackingNumber: null,
        status: 'missing_tracking',
        reason: 'Shipment has no tracking number',
        shipmentStatus: shipment.status,
        actualDelivery: shipment.actualDelivery,
        carrier: shipment.carrier,
        eventCount: 0,
        lastEventAt: null,
        fedExStatus: null,
      };
    }

    if (!options.force) {
      const lastSyncedAt = shipment.trackingEvents[0]?.createdAt ?? null;
      if (lastSyncedAt && Date.now() - lastSyncedAt.getTime() < STATUS_SYNC_MIN_INTERVAL_MS) {
        return {
          shipmentId,
          trackingNumber: normalizedTrackingNumber,
          status: 'skipped',
          reason: 'Recent FedEx sync already exists',
          shipmentStatus: shipment.status,
          actualDelivery: shipment.actualDelivery,
          carrier: shipment.carrier,
          eventCount: 0,
          lastEventAt: lastSyncedAt,
          fedExStatus: null,
        };
      }
    }

    const snapshot = await fetchFedExTrackingSnapshot(normalizedTrackingNumber, {
      force: options.force,
    });
    const nextShipmentStatus = mapSnapshotToShipmentStatus(snapshot);
    const nextDeliveryDate =
      nextShipmentStatus === ShipmentStatus.DELIVERED
        ? shipment.actualDelivery ?? snapshot.latestEventTimestamp ?? new Date()
        : shipment.actualDelivery;

    const eventInputs = snapshot.events
      .slice(0, 100)
      .map((scanEvent) => toFedExTrackingEventData(shipmentId, scanEvent, snapshot.fetchedAt));

    await prisma.$transaction(async (tx) => {
      await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          carrier: shipment.carrier === Carrier.OTHER ? Carrier.FEDEX : shipment.carrier,
          status: nextShipmentStatus,
          actualDelivery: nextDeliveryDate,
        },
      });

      await tx.trackingEvent.deleteMany({
        where: {
          shipmentId,
          sourceSystem: 'fedex_api',
        },
      });

      if (eventInputs.length > 0) {
        await tx.trackingEvent.createMany({
          data: eventInputs,
        });
      }

      const sourceKey = `fedex_api:${shipmentId}:${normalizedTrackingNumber}`;
      const rawData = {
        sourceType: 'fedex_api_track',
        fetchedAt: snapshot.fetchedAt.toISOString(),
        status: snapshot.latestStatus,
        code: snapshot.latestStatusCode,
        description: snapshot.latestDescription,
        eventTimestamp: snapshot.latestEventTimestamp?.toISOString() ?? null,
        location: snapshot.latestLocation,
        row: {
          status: snapshot.latestStatus,
          eventType: snapshot.latestStatusCode,
          description: snapshot.latestDescription,
          eventTimestamp: snapshot.latestEventTimestamp?.toISOString() ?? null,
          city: snapshot.latestLocation?.city ?? null,
          state: snapshot.latestLocation?.state ?? null,
          zip: snapshot.latestLocation?.zip ?? null,
          trackingNumber: snapshot.trackingNumber,
        },
        response: snapshot.rawResponse,
      };

      await tx.fedExShipmentRecord.upsert({
        where: { sourceKey },
        create: {
          sourceFileName: 'fedex_api_track',
          sourceFilePath: snapshot.sourceBaseUrl,
          sourceFileDate: snapshot.fetchedAt,
          eventTimestamp: snapshot.latestEventTimestamp,
          trackingNumber: snapshot.trackingNumber,
          service: snapshot.serviceDescription,
          recipientCompanyName: null,
          recipientContactName: null,
          destinationAddressLine1: null,
          destinationCity: snapshot.recipient?.city ?? null,
          destinationState: snapshot.recipient?.state ?? null,
          destinationPostalCode: snapshot.recipient?.zip ?? null,
          destinationCountry: snapshot.recipient?.country ?? null,
          workOrderId: shipment.workOrderId,
          sourceKey,
          rawPayload: JSON.stringify(rawData),
          rawData: rawData as Prisma.InputJsonValue,
        },
        update: {
          sourceFileDate: snapshot.fetchedAt,
          eventTimestamp: snapshot.latestEventTimestamp,
          trackingNumber: snapshot.trackingNumber,
          service: snapshot.serviceDescription,
          destinationCity: snapshot.recipient?.city ?? null,
          destinationState: snapshot.recipient?.state ?? null,
          destinationPostalCode: snapshot.recipient?.zip ?? null,
          destinationCountry: snapshot.recipient?.country ?? null,
          workOrderId: shipment.workOrderId,
          rawPayload: JSON.stringify(rawData),
          rawData: rawData as Prisma.InputJsonValue,
        },
      });
    });

    return {
      shipmentId,
      trackingNumber: normalizedTrackingNumber,
      status: 'synced',
      reason: null,
      shipmentStatus: nextShipmentStatus,
      actualDelivery: nextDeliveryDate,
      carrier: shipment.carrier === Carrier.OTHER ? Carrier.FEDEX : shipment.carrier,
      eventCount: eventInputs.length,
      lastEventAt: snapshot.latestEventTimestamp,
      fedExStatus: snapshot.latestStatus ?? snapshot.latestDescription,
    };
  })().finally(() => {
    shipmentSyncInFlight.delete(shipmentId);
  });

  shipmentSyncInFlight.set(shipmentId, task);
  return task;
}

export async function scheduleFedExTrackingRefreshIfStale(
  shipmentId: string,
  options: { staleAfterMs?: number } = {}
): Promise<void> {
  const staleAfterMs = options.staleAfterMs ?? 6 * 60 * 60 * 1000;
  const now = Date.now();
  const cooldownUntil = backgroundRefreshByShipment.get(shipmentId);
  if (cooldownUntil && cooldownUntil > now) {
    return;
  }

  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    select: {
      carrier: true,
      trackingNumber: true,
      trackingEvents: {
        where: {
          sourceSystem: 'fedex_api',
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
        select: {
          createdAt: true,
        },
      },
    },
  });

  if (!shipment) {
    return;
  }

  const trackingNumber = normalizeTrackingNumber(shipment.trackingNumber);
  if (!trackingNumber) {
    return;
  }

  if (shipment.carrier !== Carrier.FEDEX && shipment.carrier !== Carrier.OTHER) {
    return;
  }

  const lastSyncedAt = shipment.trackingEvents[0]?.createdAt ?? null;
  if (lastSyncedAt && now - lastSyncedAt.getTime() < staleAfterMs) {
    return;
  }

  backgroundRefreshByShipment.set(shipmentId, now + BACKGROUND_REFRESH_COOLDOWN_MS);
  void syncFedExTrackingForShipment(shipmentId).catch((error) => {
    console.warn(`[FedEx API] Background refresh failed for shipment ${shipmentId}:`, error);
  });
}

export async function fetchFedExStatusPreview(
  trackingNumber: string,
  options: { force?: boolean } = {}
): Promise<{
  trackingNumber: string;
  latestStatus: string | null;
  latestStatusCode: string | null;
  latestDescription: string | null;
  latestEventTimestamp: Date | null;
  eventCount: number;
  sourceBaseUrl: string;
}> {
  const snapshot = await fetchFedExTrackingSnapshot(trackingNumber, options);
  return {
    trackingNumber: snapshot.trackingNumber,
    latestStatus: snapshot.latestStatus,
    latestStatusCode: snapshot.latestStatusCode,
    latestDescription: snapshot.latestDescription,
    latestEventTimestamp: snapshot.latestEventTimestamp,
    eventCount: snapshot.events.length,
    sourceBaseUrl: snapshot.sourceBaseUrl,
  };
}

