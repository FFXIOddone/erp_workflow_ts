import { Carrier, ShipmentStatus, TrackingEventType, type Prisma } from '@prisma/client';
import { prisma } from '../db/client.js';
import {
  formatTrackingLocation,
  normalizeTrackingNumber,
  resolveShipmentTrackingNumber,
  type ShipmentTrackingCandidate,
} from './shipment-tracking.js';

const FEDEX_API_BASE_URL_PRODUCTION = 'https://apis.fedex.com';
const FEDEX_API_BASE_URL_SANDBOX = 'https://apis-sandbox.fedex.com';
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

type FedExReferenceType =
  | 'BILL_OF_LADING'
  | 'CUSTOMER_REFERENCE'
  | 'INVOICE'
  | 'PURCHASE_ORDER';

type FedExReferenceLookup = {
  type: FedExReferenceType;
  value: string;
  shipDateBegin: string;
  shipDateEnd: string;
  destinationCountryCode?: string | null;
  destinationPostalCode?: string | null;
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

type FedExShipmentSyncContext = ShipmentTrackingCandidate & {
  id: string;
  carrier: Carrier;
  status: ShipmentStatus;
  actualDelivery: Date | null;
  shipDate: Date | null;
  workOrderId: string | null;
  workOrder: {
    orderNumber: string;
    customerName: string;
    description: string;
    poNumber: string | null;
    quickbooksOrderNum: string | null;
    company: {
      name: string | null;
      address: string | null;
      city: string | null;
      state: string | null;
      zipCode: string | null;
      country: string | null;
      shipToLine1: string | null;
      shipToLine2: string | null;
      shipToLine3: string | null;
      shipToLine4: string | null;
      shipToLine5: string | null;
    } | null;
    customer: {
      name: string | null;
      companyName: string | null;
      address: string | null;
      city: string | null;
      state: string | null;
      zipCode: string | null;
      country: string | null;
      shipToLine1: string | null;
      shipToLine2: string | null;
      shipToLine3: string | null;
      shipToLine4: string | null;
      shipToLine5: string | null;
    } | null;
  } | null;
  trackingEvents: Array<{
    createdAt: Date;
  }>;
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

export function isFedExShipmentCarrierEligible(carrier: Carrier | null | undefined): boolean {
  return carrier === Carrier.FEDEX || carrier === Carrier.OTHER;
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

function formatFedExDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function normalizeFedExReferenceValue(value: string | null | undefined): string | null {
  const normalized = value?.replace(/\s+/g, ' ').trim() ?? '';
  return normalized.length > 0 ? normalized : null;
}

function normalizeFedExCountryCode(value: string | null | undefined): string | null {
  const normalized = value?.trim().toUpperCase() ?? '';
  if (!normalized) {
    return null;
  }
  if (normalized === 'USA' || normalized === 'UNITED STATES') {
    return 'US';
  }
  return normalized.length > 2 ? normalized.slice(0, 2) : normalized;
}

function normalizeFedExPostalCode(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? '';
  return normalized.length > 0 ? normalized : null;
}

function extractFedExPurchaseOrderToken(value: string | null | undefined): string | null {
  const text = value?.trim() ?? '';
  if (!text) {
    return null;
  }

  const match = text.match(/\bPO[\s-]*[A-Z0-9-]{3,}\b/i);
  if (!match) {
    return null;
  }

  return match[0].replace(/\s+/g, '').replace(/PO[-\s]*/i, 'PO').toUpperCase();
}

function buildFedExDateWindow(shipDate: Date | null | undefined): { shipDateBegin: string; shipDateEnd: string } {
  const baseDate = shipDate ? new Date(shipDate) : new Date();
  const beginDate = new Date(baseDate);
  beginDate.setDate(beginDate.getDate() - 15);
  const endDate = new Date(baseDate);
  endDate.setDate(endDate.getDate() + 1);

  return {
    shipDateBegin: formatFedExDate(beginDate),
    shipDateEnd: formatFedExDate(endDate),
  };
}

export function resolveFedExApiBaseUrl(rawBaseUrl: string | null | undefined): string {
  const normalized = rawBaseUrl?.trim().toLowerCase() ?? '';
  if (!normalized) {
    return FEDEX_API_BASE_URL_PRODUCTION;
  }

  if (normalized === 'sandbox') {
    return FEDEX_API_BASE_URL_SANDBOX;
  }

  if (normalized === 'production' || normalized === 'prod') {
    return FEDEX_API_BASE_URL_PRODUCTION;
  }

  return (rawBaseUrl?.trim() ?? FEDEX_API_BASE_URL_PRODUCTION).replace(/\/+$/, '');
}

export function collectFedExReferenceCandidates(
  shipment: Pick<FedExShipmentSyncContext, 'shipDate' | 'workOrder'>
): FedExReferenceLookup[] {
  const candidates = new Map<string, FedExReferenceLookup>();
  const workOrder = shipment.workOrder;
  if (!workOrder) {
    return [];
  }

  const { shipDateBegin, shipDateEnd } = buildFedExDateWindow(shipment.shipDate);
  const destinationCountryCode = normalizeFedExCountryCode(
    workOrder.company?.country ?? workOrder.customer?.country ?? null
  );
  const destinationPostalCode = normalizeFedExPostalCode(
    workOrder.company?.zipCode ?? workOrder.customer?.zipCode ?? null
  );

  const addCandidate = (type: FedExReferenceType, value: string | null | undefined): void => {
    const normalizedValue = normalizeFedExReferenceValue(value);
    if (!normalizedValue) {
      return;
    }

    const key = `${type}:${normalizedValue}`;
    if (candidates.has(key)) {
      return;
    }

    candidates.set(key, {
      type,
      value: normalizedValue,
      shipDateBegin,
      shipDateEnd,
      destinationCountryCode,
      destinationPostalCode,
    });
  };

  addCandidate('PURCHASE_ORDER', workOrder.poNumber);
  addCandidate('PURCHASE_ORDER', extractFedExPurchaseOrderToken(workOrder.customerName));
  addCandidate('PURCHASE_ORDER', extractFedExPurchaseOrderToken(workOrder.description));
  addCandidate('INVOICE', workOrder.quickbooksOrderNum);
  addCandidate('CUSTOMER_REFERENCE', workOrder.quickbooksOrderNum);
  addCandidate('CUSTOMER_REFERENCE', workOrder.orderNumber);

  return [...candidates.values()];
}

async function loadFedExShipmentSyncContext(shipmentId: string): Promise<FedExShipmentSyncContext | null> {
  return prisma.shipment.findUnique({
    where: { id: shipmentId },
    select: {
      id: true,
      carrier: true,
      status: true,
      trackingNumber: true,
      actualDelivery: true,
      shipDate: true,
      workOrderId: true,
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
          orderNumber: true,
          customerName: true,
          description: true,
          poNumber: true,
          quickbooksOrderNum: true,
          company: {
            select: {
              name: true,
              address: true,
              city: true,
              state: true,
              zipCode: true,
              country: true,
              shipToLine1: true,
              shipToLine2: true,
              shipToLine3: true,
              shipToLine4: true,
              shipToLine5: true,
            },
          },
          customer: {
            select: {
              name: true,
              companyName: true,
              address: true,
              city: true,
              state: true,
              zipCode: true,
              country: true,
              shipToLine1: true,
              shipToLine2: true,
              shipToLine3: true,
              shipToLine4: true,
              shipToLine5: true,
            },
          },
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
      trackingEvents: {
        where: {
          sourceSystem: 'fedex_api',
        },
        select: {
          createdAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      },
    },
  }) as Promise<FedExShipmentSyncContext | null>;
}

function resolveFedExApiConfig(): FedExApiConfig | null {
  const clientId = process.env.FEDEX_API_CLIENT_ID?.trim() ?? '';
  const clientSecret = process.env.FEDEX_API_CLIENT_SECRET?.trim() ?? '';
  if (!clientId || !clientSecret) {
    return null;
  }

  return {
    baseUrl: resolveFedExApiBaseUrl(process.env.FEDEX_API_BASE_URL),
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

  const trackingInfo = asRecord(trackResult.trackingNumberInfo);
  const resolvedTrackingNumber =
    pickString(firstCompleteTrack, ['trackingNumber']) ??
    pickString(trackingInfo, ['trackingNumber']) ??
    trackingNumber;
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
    trackingNumber: resolvedTrackingNumber,
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

async function fetchFedExTrackingSnapshotFromRequest(
  cacheKey: string,
  requestUrl: string,
  requestBody: Record<string, unknown>,
  trackingIdentifier: string,
  options: { force?: boolean } = {}
): Promise<FedExTrackingSnapshot> {
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

    const response = await fetch(`${config.baseUrl}${requestUrl}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorPayload = await response.text().catch(() => '');
      throw new Error(
        `FedEx Track request failed (${response.status}): ${errorPayload || 'no response body'}`
      );
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const snapshot = parseFedExTrackingSnapshot(trackingIdentifier, config.baseUrl, payload);

    snapshotCache.set(cacheKey, {
      snapshot,
      expiresAt: Date.now() + TRACKING_SNAPSHOT_TTL_MS,
    });

    return snapshot;
  })().finally(() => {
    trackingRequestInFlight.delete(cacheKey);
  });

  trackingRequestInFlight.set(cacheKey, requestPromise);
  return requestPromise;
}

export async function fetchFedExTrackingSnapshot(
  trackingNumber: string,
  options: { force?: boolean } = {}
): Promise<FedExTrackingSnapshot> {
  const normalizedTrackingNumber = normalizeTrackingNumber(trackingNumber);
  if (!normalizedTrackingNumber) {
    throw new Error('Tracking number is required');
  }

  return fetchFedExTrackingSnapshotFromRequest(
    `tracking:${normalizedTrackingNumber}`,
    '/track/v1/trackingnumbers',
    {
      includeDetailedScans: true,
      trackingInfo: [
        {
          trackingNumberInfo: {
            trackingNumber: normalizedTrackingNumber,
          },
        },
      ],
    },
    normalizedTrackingNumber,
    options
  );
}

export async function fetchFedExTrackingSnapshotByReference(
  candidate: FedExReferenceLookup,
  options: { force?: boolean } = {}
): Promise<FedExTrackingSnapshot> {
  const normalizedReferenceValue = normalizeFedExReferenceValue(candidate.value);
  if (!normalizedReferenceValue) {
    throw new Error('Reference value is required');
  }

  const config = resolveFedExApiConfig();
  if (!config) {
    throw new Error('FedEx API is not configured');
  }

  const requestBody: Record<string, unknown> = {
    referencesInformation: {
      type: candidate.type,
      value: normalizedReferenceValue,
      ...(config.accountNumber ? { accountNumber: config.accountNumber } : {}),
      shipDateBegin: candidate.shipDateBegin,
      shipDateEnd: candidate.shipDateEnd,
      ...(candidate.destinationCountryCode ? { destinationCountryCode: candidate.destinationCountryCode } : {}),
      ...(candidate.destinationPostalCode ? { destinationPostalCode: candidate.destinationPostalCode } : {}),
    },
    includeDetailedScans: true,
  };

  return fetchFedExTrackingSnapshotFromRequest(
    `reference:${candidate.type}:${normalizedReferenceValue}:${candidate.shipDateBegin}:${candidate.shipDateEnd}:${candidate.destinationCountryCode ?? ''}:${candidate.destinationPostalCode ?? ''}`,
    '/track/v1/referencenumbers',
    requestBody,
    normalizedReferenceValue,
    options
  );
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
      locationLabel: formatTrackingLocation({
        city: scanEvent.city,
        state: scanEvent.state,
        zip: scanEvent.zip,
        country: scanEvent.country,
      }),
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

    const shipment = await loadFedExShipmentSyncContext(shipmentId);

    if (!shipment) {
      throw new Error(`Shipment ${shipmentId} not found`);
    }

    const normalizedTrackingNumber = resolveShipmentTrackingNumber(shipment);
    let snapshot: FedExTrackingSnapshot | null = null;
    let lookupMode: 'tracking' | 'reference' = 'tracking';
    let referenceCandidate: FedExReferenceLookup | null = null;

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

    if (normalizedTrackingNumber) {
      snapshot = await fetchFedExTrackingSnapshot(normalizedTrackingNumber, {
        force: options.force,
      });
    } else {
      if (!isFedExShipmentCarrierEligible(shipment.carrier)) {
        return {
          shipmentId,
          trackingNumber: null,
          status: 'missing_tracking',
          reason: 'Shipment is not eligible for FedEx reference lookup',
          shipmentStatus: shipment.status,
          actualDelivery: shipment.actualDelivery,
          carrier: shipment.carrier,
          eventCount: 0,
          lastEventAt: null,
          fedExStatus: null,
        };
      }

      const referenceCandidates = collectFedExReferenceCandidates(shipment);
      for (const candidate of referenceCandidates) {
        try {
          snapshot = await fetchFedExTrackingSnapshotByReference(candidate, {
            force: options.force,
          });
          referenceCandidate = candidate;
          lookupMode = 'reference';
          break;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (
            message.includes('TRACKING.REFERENCENUMBER.NOTFOUND') ||
            message.includes('TRACKING.DATA.NOTUNIQUE') ||
            message.includes('TRACKING.REFERENCEDATA.INCOMPLETE') ||
            message.includes('TRACKING.REFERENCEVALUE.EMPTY')
          ) {
            continue;
          }
          throw error;
        }
      }

      if (!snapshot) {
        return {
          shipmentId,
          trackingNumber: null,
          status: 'missing_tracking',
          reason: referenceCandidates.length > 0
            ? 'FedEx reference lookup did not find a unique match'
            : 'Shipment has no tracking number or FedEx reference candidates',
          shipmentStatus: shipment.status,
          actualDelivery: shipment.actualDelivery,
          carrier: shipment.carrier,
          eventCount: 0,
          lastEventAt: null,
          fedExStatus: null,
        };
      }
    }

    const resolvedTrackingNumber = snapshot.trackingNumber;
    if (!resolvedTrackingNumber) {
      return {
        shipmentId,
        trackingNumber: null,
        status: 'missing_tracking',
        reason: 'FedEx lookup returned no tracking number',
        shipmentStatus: shipment.status,
        actualDelivery: shipment.actualDelivery,
        carrier: shipment.carrier,
        eventCount: 0,
        lastEventAt: null,
        fedExStatus: null,
      };
    }

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
          trackingNumber: resolvedTrackingNumber,
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

      const sourceType = lookupMode === 'reference' ? 'fedex_api_reference_track' : 'fedex_api_track';
      const sourceKey = `${sourceType}:${shipmentId}:${resolvedTrackingNumber}`;
      const rawData = {
        sourceType,
        fetchedAt: snapshot.fetchedAt.toISOString(),
        status: snapshot.latestStatus,
        code: snapshot.latestStatusCode,
      description: snapshot.latestDescription,
      eventTimestamp: snapshot.latestEventTimestamp?.toISOString() ?? null,
      location: snapshot.latestLocation,
      locationLabel: formatTrackingLocation(snapshot.latestLocation),
      lookup: referenceCandidate
        ? {
            type: referenceCandidate.type,
              value: referenceCandidate.value,
              shipDateBegin: referenceCandidate.shipDateBegin,
              shipDateEnd: referenceCandidate.shipDateEnd,
              destinationCountryCode: referenceCandidate.destinationCountryCode ?? null,
              destinationPostalCode: referenceCandidate.destinationPostalCode ?? null,
            }
          : null,
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
          sourceFileName: sourceType,
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
      trackingNumber: resolvedTrackingNumber,
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

  const shipment = await loadFedExShipmentSyncContext(shipmentId);

  if (!shipment) {
    return;
  }

  const trackingNumber = resolveShipmentTrackingNumber(shipment);
  if (!trackingNumber && !isFedExShipmentCarrierEligible(shipment.carrier)) {
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
