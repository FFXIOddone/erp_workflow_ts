import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { XMLParser } from 'fast-xml-parser';
import * as XLSX from 'xlsx';
import type { FedExShipmentRecord, Prisma } from '@prisma/client';
import { prisma } from '../db/client.js';
import { buildTokenizedSearchWhere } from '../lib/fuzzy-search.js';
import { formatTrackingLocation, normalizeTrackingNumber } from './shipment-tracking.js';

const FEDEX_LOG_FILE_PREFIX = 'FxLogSr';
const FEDEX_LOG_FILE_REGEX = /^FxLogSr(\d{8})\.xml$/i;
const FEDEX_EXPORT_FILE_REGEX = /^shipments_(?:latest|\d{4}-\d{2}-\d{2}(?:_\d{4})?)\.csv$/i;
const DEFAULT_FEDEX_LOG_ROOTS = [
  process.env.FEDEX_LOG_ROOT?.trim(),
  process.env.FEDEX_LOG_DIR?.trim(),
  '\\\\192.168.254.131\\ProgramData\\FedEx\\FSM\\Logs',
  '\\\\192.168.254.131\\C$\\ProgramData\\FedEx\\FSM\\Logs',
  'C:\\ProgramData\\FedEx\\FSM\\Logs',
].filter((value): value is string => Boolean(value));

const DEFAULT_FEDEX_REPORT_ROOTS = [
  process.env.FEDEX_REPORT_ROOT?.trim(),
  process.env.FEDEX_REPORT_DIR?.trim(),
  'C:\\Users\\Shipping1\\OneDrive - Wilde Signs\\Desktop',
  '\\\\192.168.254.131\\Users\\Shipping1\\OneDrive - Wilde Signs\\Desktop',
  'C:\\Users\\Shipping1\\OneDrive - Wilde Signs\\Desktop\\FedExExports',
  '\\\\192.168.254.131\\Users\\Shipping1\\OneDrive - Wilde Signs\\Desktop\\FedExExports',
].filter((value): value is string => Boolean(value));

const DEFAULT_FEDEX_EXPORT_ROOTS = [
  process.env.FEDEX_EXPORT_ROOT?.trim(),
  process.env.FEDEX_EXPORT_DIR?.trim(),
  'C:\\ProgramData\\FedEx\\FSM\\DATABASE\\exports',
  '\\\\192.168.254.131\\DATABASE\\exports',
  '\\\\192.168.254.131\\C$\\ProgramData\\FedEx\\FSM\\DATABASE\\exports',
  'C:\\Users\\Shipping1\\OneDrive - Wilde Signs\\Desktop\\FedExExports',
  '\\\\192.168.254.131\\Users\\Shipping1\\OneDrive - Wilde Signs\\Desktop\\FedExExports',
].filter((value): value is string => Boolean(value));

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  allowBooleanAttributes: true,
  parseAttributeValue: false,
  removeNSPrefix: true,
});

export interface FedExShipmentRecordInput {
  sourceFileName: string;
  sourceFilePath: string | null;
  sourceFileDate: Date;
  eventTimestamp: Date | null;
  trackingNumber: string | null;
  service: string | null;
  recipientCompanyName: string | null;
  recipientContactName: string | null;
  destinationAddressLine1: string | null;
  destinationCity: string | null;
  destinationState: string | null;
  destinationPostalCode: string | null;
  destinationCountry: string | null;
  workOrderId?: string | null;
  sourceKey: string;
  rawPayload: string;
  rawData: Record<string, unknown>;
}

export type FedExShipmentRecordWithWorkOrder = FedExShipmentRecord & {
  workOrder: {
    id: string;
    orderNumber: string;
    customerName: string;
  } | null;
  locationLabel: string | null;
  latestStatus: string | null;
  latestStatusCode: string | null;
  latestDescription: string | null;
  issue: string | null;
};

export type FedExShipmentSummaryRecord = FedExShipmentRecordWithWorkOrder & {
  recordCount: number;
  workOrderCount: number;
  linkedWorkOrderCount: number;
};

type FedExShipmentRecordRow = {
  sourceFileName: string;
  sourceFilePath: string | null;
  sourceFileDate: Date;
  eventTimestamp: Date | null;
  trackingNumber: string | null;
  service: string | null;
  recipientCompanyName: string | null;
  recipientContactName: string | null;
  destinationAddressLine1: string | null;
  destinationCity: string | null;
  destinationState: string | null;
  destinationPostalCode: string | null;
  destinationCountry: string | null;
  workOrderId: string | null;
  sourceKey: string;
  rawPayload: string;
  rawData: Prisma.JsonValue;
};

export interface FedExLogResolution {
  rootPath: string;
  fileName: string;
  filePath: string;
  sourceFileDate: Date;
  matchedBy: 'exact' | 'date-scan';
}

export interface FedExShipmentSyncResult {
  status: 'synced' | 'missing' | 'empty';
  sourceFileName: string | null;
  sourceFilePath: string | null;
  sourceFileDate: Date | null;
  matchedBy: FedExLogResolution['matchedBy'] | null;
  totalRecords: number;
  imported: number;
  updated: number;
  skipped: number;
  records: FedExShipmentRecordInput[];
  warnings: string[];
}

export interface FedExShipmentHistorySyncResult {
  status: 'synced' | 'missing' | 'empty';
  totalFiles: number;
  sourceFileNames: string[];
  totalRecords: number;
  imported: number;
  updated: number;
  skipped: number;
  backfill: {
    linkedRecords: number;
    updatedRecords: number;
    updatedShipments: number;
  } | null;
  warnings: string[];
}

export interface FedExShipmentRecordPage {
  items: FedExShipmentRecordWithWorkOrder[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface FedExShipmentSummaryPage {
  items: FedExShipmentSummaryRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface FedExShipmentQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  trackingNumber?: string;
  fromDate?: Date | null;
  toDate?: Date | null;
}

let lastFedExSync: FedExShipmentSyncResult | null = null;

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())))];
}

function normalizeMatchText(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(
      /\b(llc|l l c|inc|incorporated|co|company|corp|corporation|ltd|limited|lp|llp|plc|group|the)\b/gu,
      ' '
    )
    .replace(/\s+/g, ' ')
    .trim();
}

function splitMatchTerms(value: string | null | undefined): string[] {
  const normalized = normalizeMatchText(value);
  if (!normalized) {
    return [];
  }

  const tokens = normalized
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);

  return uniqueStrings([normalized, ...tokens]);
}

const FEDEX_SERVICE_LABEL_BY_CODE: Record<string, string> = {
  '01': 'Priority Overnight',
  '03': '2Day',
  '05': 'Standard Overnight',
  '06': 'First Overnight',
  '20': 'Express Saver',
  '22': 'Next Day by 9:00 AM',
  '23': 'Next Day by 10 a.m.',
  '24': 'Next Day by 12 noon',
  '25': 'Next Day',
  '26': 'FedEx Economy',
  '32': '1Day Freight',
  '39': 'First Overnight Freight',
  '49': '2Day AM',
  '70': '1Day Freight',
  '80': '2Day Freight',
  '83': '3Day Freight',
  '90': 'Home Delivery',
  '92': 'Ground',
  SB: 'Ground Economy Bound Printed Matter',
  SL: 'Ground Economy Parcel Select Lightweight',
  SM: 'Ground Economy Media',
  SP: 'Ground Economy Parcel Select',
  SR: 'Ground Economy Returns',
};

const FEDEX_SERVICE_LABEL_ALIASES: Record<string, string> = {
  'FEDEX GROUND': 'Ground',
  'FEDEX GROUND SERVICE': 'Ground',
  'FEDEX FREIGHT PRIORITY': 'Freight Priority',
  'FEDEX FREIGHT ECONOMY': 'Freight Economy',
  'FEDEX HOME DELIVERY': 'Home Delivery',
  'FEDEX EXPRESS SAVER': 'Express Saver',
  'GROUND SERVICE': 'Ground',
};

export function normalizeFedExServiceLabel(service: string | null | undefined): string | null {
  const trimmed = service?.trim() ?? '';
  if (!trimmed) {
    return null;
  }

  const unquoted = trimmed.replace(/^['"]+|['"]+$/g, '').trim();
  if (!unquoted) {
    return null;
  }

  const collapsed = unquoted.replace(/\s+/g, ' ');
  const code = collapsed.toUpperCase();

  return FEDEX_SERVICE_LABEL_BY_CODE[code] ?? FEDEX_SERVICE_LABEL_ALIASES[code] ?? collapsed;
}

type FedExWorkOrderCandidate = {
  id: string;
  orderNumber: string;
  customerName: string;
  description: string;
  company: {
    name: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zipCode: string | null;
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
    shipToLine1: string | null;
    shipToLine2: string | null;
    shipToLine3: string | null;
    shipToLine4: string | null;
    shipToLine5: string | null;
  } | null;
};

function toLocalDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = String(date.getFullYear());
  return `${month}${day}${year}`;
}

export function formatFedExLogFileName(date = new Date()): string {
  return `${FEDEX_LOG_FILE_PREFIX}${toLocalDateKey(date)}.xml`;
}

export function parseFedExLogDate(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const mmddyyyyMatch = trimmed.match(
    /\b(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?)?\b/
  );
  if (mmddyyyyMatch) {
    const [, month, day, year, hour = '0', minute = '0', second = '0', fraction = '0'] = mmddyyyyMatch;
    const milliseconds = Number(fraction.slice(0, 3).padEnd(3, '0'));
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
      milliseconds
    );
  }

  const isoMatch = Date.parse(trimmed);
  if (!Number.isNaN(isoMatch)) {
    return new Date(isoMatch);
  }

  return null;
}

function parseDateFromFileName(fileName: string): Date | null {
  const match = FEDEX_LOG_FILE_REGEX.exec(fileName);
  if (!match) return null;

  const raw = match[1];
  const month = Number(raw.slice(0, 2));
  const day = Number(raw.slice(2, 4));
  const year = Number(raw.slice(4, 8));

  if (!month || !day || !year) return null;
  return new Date(year, month - 1, day);
}

function decodeXmlEntities(value: string): string {
  let decoded = value;

  for (let i = 0; i < 2; i += 1) {
    const next = decoded
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');

    if (next === decoded) {
      break;
    }
    decoded = next;
  }

  return decoded;
}

function stripXmlTags(value: string): string {
  return value.replace(/<[^>]+>/g, ' ');
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function extractTextPayload(block: string): string {
  return normalizeWhitespace(decodeXmlEntities(stripXmlTags(block)));
}

function extractFieldMap(payload: string): Record<string, string> {
  const matches = [...payload.matchAll(/FDXPSP_I_[A-Z0-9_]+/g)];
  const result: Record<string, string> = {};

  if (!matches.length) {
    return result;
  }

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const key = match[0];
    const start = (match.index ?? 0) + key.length;
    const end = matches[index + 1]?.index ?? payload.length;
    const rawValue = payload.slice(start, end);
    const cleaned = decodeXmlEntities(
      rawValue
        .replace(/^[\s,:=;|-]+/, '')
        .replace(/[\s,;|-]+$/, '')
        .trim()
    );

    result[key] = cleaned;
  }

  return result;
}

function extractEventTimestamp(block: string): Date | null {
  const tagPatterns = [
    /<(?:LogDate|LogDateTime|Timestamp|DateTime)>([^<]+)<\/(?:LogDate|LogDateTime|Timestamp|DateTime)>/i,
    /(?:LogDate|LogDateTime|Timestamp|DateTime)\s*[:=]\s*([^\r\n<]+)/i,
  ];

  for (const pattern of tagPatterns) {
    const match = block.match(pattern);
    if (!match?.[1]) continue;
    const parsed = parseFedExLogDate(match[1]);
    if (parsed) return parsed;
  }

  const inlineMatch = block.match(/\b\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2}(?:\.\d+)?\b/);
  if (inlineMatch?.[0]) {
    const parsed = parseFedExLogDate(inlineMatch[0]);
    if (parsed) return parsed;
  }

  return null;
}

function hashRecordSource(parts: string[]): string {
  return createHash('sha256').update(parts.join('|')).digest('hex');
}

function normalizeFedExHeaderKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function stringifyFedExValue(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isNaN(time) ? null : value.toISOString();
  }

  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function normalizeFedExWorkOrderToken(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const token = trimmed.replace(/[^A-Za-z0-9-]/g, '').toUpperCase();
  if (!token) {
    return null;
  }

  const digitsOnly = token.replace(/\D/g, '');
  if (digitsOnly.length >= 4 && digitsOnly.length <= 8) {
    return digitsOnly;
  }

  if (token.length >= 4 && token.length <= 16) {
    return token;
  }

  return null;
}

function extractFedExStoreCodeTokens(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  return uniqueStrings((value.match(/\b[A-Z]\d{4}\b/gi) ?? []).map((token) => token.toUpperCase()));
}

function extractFedExWorkOrderTokensFromText(value: string): string[] {
  const stopWords = new Set([
    'SHIPMENT',
    'SHIPMENTS',
    'SHIPMENTID',
    'SHIPID',
    'REFERENCE',
    'REFERENCE1',
    'REFERENCE2',
    'REFERENCE3',
    'REF',
    'ORDER',
    'ORDERNUMBER',
    'WORKORDER',
    'PO',
    'PONUMBER',
    'WO',
    'TRACKING',
    'NUMBER',
    'LABEL',
    'SERVICE',
    'RECIPIENT',
    'COMPANY',
    'CONTACT',
  ]);

  const tokens = value.match(/[A-Za-z0-9]+/g) ?? [];
  const candidates = new Set<string>();

  for (const token of tokens) {
    const normalized = token.toUpperCase();
    if (normalized.length < 4 || stopWords.has(normalized)) {
      continue;
    }

    const candidate = normalizeFedExWorkOrderToken(normalized);
    if (candidate) {
      candidates.add(candidate);
    }
  }

  return [...candidates];
}

export function extractFedExWorkOrderCandidates(rawData: Record<string, unknown>): string[] {
  const candidates = new Set<string>();
  const keyHints = [
    'shipmentid',
    'shipmentnumber',
    'shipmentref',
    'shipmentreference',
    'ordernumber',
    'orderid',
    'workorder',
    'workordernumber',
    'ponumber',
    'reference',
    'reference1',
    'reference2',
    'reference3',
    'ref1',
    'ref2',
    'ref3',
    'po',
    'wo',
    'packageidentifier',
    'packageidentifiers',
    'trackingnumberuniqueid',
  ];

  const visit = (value: unknown, keyPath: string[] = []): void => {
    if (typeof value === 'string') {
      const normalizedLeafKey = normalizeFedExHeaderKey(keyPath[keyPath.length - 1] ?? '');
      if (normalizedLeafKey === 'type') {
        return;
      }

      const normalizedKeyPath = normalizeFedExHeaderKey(keyPath.join(' '));
      if (!keyHints.some((hint) => normalizedKeyPath.includes(hint))) {
        return;
      }

      for (const candidate of extractFedExWorkOrderTokensFromText(value)) {
        candidates.add(candidate);
      }
      return;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        visit(entry, keyPath);
      }
      return;
    }

    if (value && typeof value === 'object') {
      for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
        visit(entry, [...keyPath, key]);
      }
    }
  };

  visit(rawData);
  return [...candidates];
}

async function resolveFedExWorkOrderByExactCandidate(candidate: string): Promise<string | null> {
  const normalized = candidate.trim();
  if (!normalized) {
    return null;
  }

  const digitsOnly = normalized.replace(/\D/g, '');
  const lookupValues = uniqueStrings([
    normalized,
    normalized.toUpperCase(),
    normalized.replace(/\s+/g, ''),
    digitsOnly.length >= 4 ? digitsOnly : null,
  ]);

  for (const lookupValue of lookupValues) {
    const exact = await prisma.workOrder.findFirst({
      where: {
        OR: [
          { orderNumber: lookupValue },
          { quickbooksOrderNum: lookupValue },
          { poNumber: lookupValue },
        ],
      },
      select: { id: true },
    });

    if (exact?.id) {
      return exact.id;
    }
  }

  return null;
}

function getFedExMatchTerms(record: FedExShipmentRecordInput): string[] {
  const addressParts = [
    record.destinationAddressLine1,
    record.destinationCity,
    record.destinationState,
    record.destinationPostalCode,
    record.destinationCountry,
  ];

  return uniqueStrings([
    ...splitMatchTerms(record.recipientCompanyName),
    ...splitMatchTerms(record.recipientContactName),
    ...splitMatchTerms(addressParts.join(' ')),
  ]);
}

function scoreFedExWorkOrderCandidate(
  record: FedExShipmentRecordInput,
  candidate: FedExWorkOrderCandidate
): number {
  const recordLabels = uniqueStrings([
    record.recipientCompanyName,
    record.recipientContactName,
  ]).map((value) => normalizeMatchText(value));

  const recordAddress = normalizeMatchText(
    [
      record.destinationAddressLine1,
      record.destinationCity,
      record.destinationState,
      record.destinationPostalCode,
      record.destinationCountry,
    ]
      .filter((value): value is string => Boolean(value))
      .join(' ')
  );

  const candidateLabels = uniqueStrings([
    candidate.customerName,
    candidate.description,
    candidate.company?.name,
    candidate.customer?.companyName,
    candidate.customer?.name,
  ]).map((value) => normalizeMatchText(value));

  const candidateAddresses = uniqueStrings([
    candidate.company?.address,
    candidate.company?.city,
    candidate.company?.state,
    candidate.company?.zipCode,
    candidate.company?.shipToLine1,
    candidate.company?.shipToLine2,
    candidate.company?.shipToLine3,
    candidate.company?.shipToLine4,
    candidate.company?.shipToLine5,
    candidate.customer?.address,
    candidate.customer?.city,
    candidate.customer?.state,
    candidate.customer?.zipCode,
    candidate.customer?.shipToLine1,
    candidate.customer?.shipToLine2,
    candidate.customer?.shipToLine3,
    candidate.customer?.shipToLine4,
    candidate.customer?.shipToLine5,
  ]).map((value) => normalizeMatchText(value));

  const recordStoreCodes = new Set([
    ...extractFedExStoreCodeTokens(record.recipientCompanyName),
    ...extractFedExStoreCodeTokens(record.recipientContactName),
    ...extractFedExStoreCodeTokens(
      [
        record.destinationAddressLine1,
        record.destinationCity,
        record.destinationState,
        record.destinationPostalCode,
      ]
        .filter((value): value is string => Boolean(value))
        .join(' ')
    ),
  ]);
  const candidateStoreCodes = new Set([
    ...extractFedExStoreCodeTokens(candidate.customerName),
    ...extractFedExStoreCodeTokens(candidate.description),
    ...extractFedExStoreCodeTokens(candidate.company?.name),
    ...extractFedExStoreCodeTokens(candidate.customer?.companyName),
    ...extractFedExStoreCodeTokens(candidate.customer?.name),
  ]);

  let score = 0;

  for (const recordLabel of recordLabels) {
    if (!recordLabel) continue;
    for (const candidateLabel of candidateLabels) {
      if (!candidateLabel) continue;
      if (recordLabel === candidateLabel) {
        score = Math.max(score, 100);
        continue;
      }
      if (recordLabel.includes(candidateLabel) || candidateLabel.includes(recordLabel)) {
        score = Math.max(score, 85);
      }
    }
  }

  if (recordAddress) {
    for (const candidateAddress of candidateAddresses) {
      if (!candidateAddress) continue;
      if (recordAddress === candidateAddress) {
        score = Math.max(score, 95);
        continue;
      }
      if (recordAddress.includes(candidateAddress) || candidateAddress.includes(recordAddress)) {
        score = Math.max(score, 70);
      }
    }
  }

  for (const storeCode of recordStoreCodes) {
    if (candidateStoreCodes.has(storeCode)) {
      score = Math.max(score, 90);
      break;
    }
  }

  const recordTokens = new Set(
    uniqueStrings([
      ...splitMatchTerms(record.recipientCompanyName),
      ...splitMatchTerms(record.recipientContactName),
      ...splitMatchTerms(recordAddress),
    ]).filter((term) => term.length >= 3)
  );
  const candidateTokens = new Set(
    uniqueStrings([
      ...candidateLabels,
      ...candidateAddresses,
    ])
      .flatMap((value) => value.split(' '))
      .filter((token) => token.length >= 3)
  );

  let overlap = 0;
  for (const token of recordTokens) {
    if (candidateTokens.has(token)) {
      overlap += 1;
    }
  }

  score += overlap * 5;

  return score;
}

async function resolveFedExWorkOrderId(record: FedExShipmentRecordInput): Promise<string | null> {
  const exactCandidates = extractFedExWorkOrderCandidates(record.rawData);
  for (const candidate of exactCandidates) {
    const workOrderId = await resolveFedExWorkOrderByExactCandidate(candidate);
    if (workOrderId) {
      return workOrderId;
    }
  }

  if (record.trackingNumber) {
    const shipment = await prisma.shipment.findFirst({
      where: {
        trackingNumber: record.trackingNumber,
      },
      select: {
        workOrderId: true,
      },
    });

    if (shipment?.workOrderId) {
      return shipment.workOrderId;
    }
  }

  const searchTerms = getFedExMatchTerms(record);
  const orConditions = searchTerms.slice(0, 8).flatMap((term) => [
    { customerName: { contains: term, mode: 'insensitive' as const } },
    { company: { name: { contains: term, mode: 'insensitive' as const } } },
    { customer: { companyName: { contains: term, mode: 'insensitive' as const } } },
    { customer: { name: { contains: term, mode: 'insensitive' as const } } },
    { description: { contains: term, mode: 'insensitive' as const } },
  ]);

  const workOrderSelect = {
    id: true,
    orderNumber: true,
    customerName: true,
    company: {
      select: {
        name: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
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
        shipToLine1: true,
        shipToLine2: true,
        shipToLine3: true,
        shipToLine4: true,
        shipToLine5: true,
      },
    },
    description: true,
  } as const;

  const scoreCandidates = (candidates: FedExWorkOrderCandidate[]): {
    bestCandidate: FedExWorkOrderCandidate | null;
    bestScore: number;
  } => {
    let bestCandidate: FedExWorkOrderCandidate | null = null;
    let bestScore = 0;

    for (const candidate of candidates) {
      const score = scoreFedExWorkOrderCandidate(record, candidate);
      if (score > bestScore) {
        bestScore = score;
        bestCandidate = candidate;
      }
    }

    return { bestCandidate, bestScore };
  };

  const searchCandidates = orConditions.length > 0
    ? (await prisma.workOrder.findMany({
        where: { OR: orConditions },
        select: workOrderSelect,
        take: 100,
      })) as FedExWorkOrderCandidate[]
    : [];

  let { bestCandidate, bestScore } = scoreCandidates(searchCandidates);
  if (bestScore < 60) {
    const allCandidates = (await prisma.workOrder.findMany({
      select: workOrderSelect,
      take: 500,
    })) as FedExWorkOrderCandidate[];
    const fallback = scoreCandidates(allCandidates);
    if (fallback.bestScore > bestScore) {
      bestCandidate = fallback.bestCandidate;
      bestScore = fallback.bestScore;
    }
  }

  return bestScore >= 60 ? bestCandidate?.id ?? null : null;
}

function buildRecordFromBlock(block: string, fileName: string, sourceFileDate: Date, sourceFilePath: string | null): FedExShipmentRecordInput | null {
  const decodedBlock = decodeXmlEntities(block);
  const payload = extractTextPayload(decodedBlock);
  if (payload.length === 0 || payload.indexOf('FDXPSP_I_') === -1) {
    return null;
  }

  const fields = extractFieldMap(payload);
  const eventTimestamp = extractEventTimestamp(decodedBlock);

  const rawTrackingNumber = fields.FDXPSP_I_TRACKING_NUMBER?.trim() ?? null;
  const trackingNumber = normalizeTrackingNumber(rawTrackingNumber);
  const service = normalizeFedExServiceLabel(fields.FDXPSP_I_SERVICE);
  const recipientCompanyName = fields.FDXPSP_I_RECIPIENT_COMPANY_NAME?.trim() ?? null;
  const recipientContactName = fields.FDXPSP_I_RECIPIENT_CONTACT_NAME?.trim() ?? null;
  const destinationAddressLine1 = fields.FDXPSP_I_DEST_ADDRESS_LINE1?.trim() ?? null;
  const destinationCity = fields.FDXPSP_I_DEST_CITY_NAME?.trim() ?? null;
  const destinationState =
    fields.FDXPSP_I_DEST_STATE_PROV?.trim() ??
    fields.FDXPSP_I_DEST_STATE?.trim() ??
    fields.FDXPSP_I_DEST_STATE_CODE?.trim() ??
    null;
  const destinationPostalCode =
    fields.FDXPSP_I_DEST_POSTAL?.trim() ??
    fields.FDXPSP_I_DEST_POSTAL_CODE?.trim() ??
    null;
  const destinationCountry =
    fields.FDXPSP_I_DEST_COUNTRY_CODE?.trim() ??
    fields.FDXPSP_I_DEST_COUNTRY?.trim() ??
    null;
  const locationLabel = formatTrackingLocation({
    city: destinationCity,
    state: destinationState,
    zip: destinationPostalCode,
    country: destinationCountry,
  });

  const sourceKey = hashRecordSource([
    fileName,
    sourceFileDate.toISOString(),
    eventTimestamp?.toISOString() ?? '',
    rawTrackingNumber ?? '',
    recipientCompanyName ?? '',
    destinationAddressLine1 ?? '',
    destinationCity ?? '',
    destinationPostalCode ?? '',
    payload,
  ]);

  return {
    sourceFileName: fileName,
    sourceFilePath,
    sourceFileDate,
    eventTimestamp,
    trackingNumber,
    service,
    recipientCompanyName,
    recipientContactName,
    destinationAddressLine1,
    destinationCity,
    destinationState,
    destinationPostalCode,
    destinationCountry,
    sourceKey,
    rawPayload: decodedBlock.trim(),
    rawData: {
      fields,
      payload,
      sourceFileName: fileName,
      sourceFilePath,
      sourceFileDate: sourceFileDate.toISOString(),
      eventTimestamp: eventTimestamp?.toISOString() ?? null,
      locationLabel,
    },
  };
}

async function readCandidateBlocks(filePath: string): Promise<string[]> {
  const content = await fs.readFile(filePath, 'utf-8');
  const cleanContent = content.replace(/^\uFEFF/, '');

  const blockMatches = [...cleanContent.matchAll(/<FxLogItem\b[^>]*>[\s\S]*?<\/FxLogItem>/gi)];
  if (blockMatches.length > 0) {
    return blockMatches.map((match) => match[0]);
  }

  try {
    const parsed: unknown = xmlParser.parse(cleanContent);

    const collected: string[] = [];
    const visit = (value: unknown): void => {
      if (typeof value === 'string') {
        if (value.includes('FDXPSP_I_') || value.includes('request,')) {
          collected.push(value);
        }
        return;
      }

      if (Array.isArray(value)) {
        for (const entry of value) {
          visit(entry);
        }
        return;
      }

      if (value && typeof value === 'object') {
        for (const entry of Object.values(value as Record<string, unknown>)) {
          visit(entry);
        }
      }
    };

    visit(parsed);

    return uniqueStrings(collected);
  } catch {
    return [];
  }
}

export function getFedExLogRoots(): string[] {
  return [...new Set(DEFAULT_FEDEX_LOG_ROOTS)];
}

export function getFedExReportRoots(): string[] {
  return [...new Set(DEFAULT_FEDEX_REPORT_ROOTS)];
}

export function getFedExExportRoots(): string[] {
  return [...new Set(DEFAULT_FEDEX_EXPORT_ROOTS)];
}

function parseFedExReportDate(value: string): Date | null {
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) {
    return null;
  }

  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);

  return Number.isNaN(date.getTime()) ? null : date;
}

function extractFedExReportSourceDate(content: string, fallback: Date): Date {
  const headerMatch = content.match(/^\s*(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})\s+/m);
  const parsed = headerMatch?.[1] ? parseFedExReportDate(headerMatch[1]) : null;
  return parsed ?? fallback;
}

function parseFedExShipmentReportRecipientLine(line: string): {
  recipientCompanyName: string | null;
  recipientContactName: string | null;
  destinationAddressLine1: string | null;
  destinationCity: string | null;
  destinationState: string | null;
  destinationPostalCode: string | null;
} | null {
  const trimmedLine = line.trim();
  if (!trimmedLine) {
    return null;
  }

  const parts = trimmedLine.split(/\s{2,}/).filter((part) => part.trim().length > 0);
  if (parts.length >= 6) {
    const [recipientCompanyName, recipientContactName, destinationAddressLine1, destinationCity, destinationState, destinationPostalCode] = parts;
    return {
      recipientCompanyName: recipientCompanyName.trim() || null,
      recipientContactName: recipientContactName.trim() || null,
      destinationAddressLine1: destinationAddressLine1.trim() || null,
      destinationCity: destinationCity.trim() || null,
      destinationState: destinationState.trim() || null,
      destinationPostalCode: destinationPostalCode.trim() || null,
    };
  }

  const fallbackMatch = trimmedLine.match(
    /^(.+?)\s{2,}(.+?)\s{2,}(.+?)\s{2,}(.+?)\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)\s*$/
  );
  if (!fallbackMatch) {
    return null;
  }

  return {
    recipientCompanyName: fallbackMatch[1].trim() || null,
    recipientContactName: fallbackMatch[2].trim() || null,
    destinationAddressLine1: fallbackMatch[3].trim() || null,
    destinationCity: fallbackMatch[4].trim() || null,
    destinationState: fallbackMatch[5].trim() || null,
    destinationPostalCode: fallbackMatch[6].trim() || null,
  };
}

function isFedExShipmentReportFileName(fileName: string): boolean {
  return /^(?:KF|SHIPMENTS_).+\.txt$/i.test(fileName);
}

function isFedExShipmentExportFileName(fileName: string): boolean {
  return FEDEX_EXPORT_FILE_REGEX.test(fileName);
}

function parseFedExExportDate(fileName: string): Date | null {
  const latestMatch = fileName.match(/^shipments_latest\.csv$/i);
  if (latestMatch) {
    return null;
  }

  const datedMatch = fileName.match(/^shipments_(\d{4})-(\d{2})-(\d{2})(?:_\d{4})?\.csv$/i);
  if (!datedMatch) {
    return null;
  }

  const year = Number(datedMatch[1]);
  const month = Number(datedMatch[2]);
  const day = Number(datedMatch[3]);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function resolveFedExLogFile(date = new Date()): Promise<FedExLogResolution | null> {
  const fileName = formatFedExLogFileName(date);
  const sourceFileDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  for (const rootPath of getFedExLogRoots()) {
    const filePath = path.win32.join(rootPath, fileName);
    try {
      await fs.access(filePath);
      return {
        rootPath,
        fileName,
        filePath,
        sourceFileDate,
        matchedBy: 'exact',
      };
    } catch {
      // Continue searching other roots.
    }
  }

  return null;
}

export async function resolveFedExShipmentLogFiles(rootPaths = getFedExLogRoots()): Promise<string[]> {
  const candidates = new Map<string, number>();

  for (const rootPath of rootPaths) {
    let entries: import('fs').Dirent[] = [];
    try {
      entries = await fs.readdir(rootPath, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isFile() || !FEDEX_LOG_FILE_REGEX.test(entry.name)) {
        continue;
      }

      const filePath = path.win32.join(rootPath, entry.name);
      try {
        const stats = await fs.stat(filePath);
        candidates.set(filePath, stats.mtimeMs);
      } catch {
        // Skip files we cannot inspect in the current environment.
      }
    }
  }

  return [...candidates.entries()]
    .sort((left, right) => left[1] - right[1] || left[0].localeCompare(right[0]))
    .map(([filePath]) => filePath);
}

export async function parseFedExLogFile(filePath: string): Promise<FedExShipmentRecordInput[]> {
  const fileName = path.win32.basename(filePath);
  const sourceFileDate = parseDateFromFileName(fileName) ?? new Date();
  const blocks = await readCandidateBlocks(filePath);

  return blocks
    .map((block) => buildRecordFromBlock(block, fileName, sourceFileDate, filePath))
    .filter((record): record is FedExShipmentRecordInput => Boolean(record));
}

async function resolveFedExShipmentReportFiles(): Promise<string[]> {
  const candidates = new Map<string, number>();

  for (const rootPath of getFedExReportRoots()) {
    let entries: import('fs').Dirent[] = [];
    try {
      entries = await fs.readdir(rootPath, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isFile() || !isFedExShipmentReportFileName(entry.name)) {
        continue;
      }

      const filePath = path.win32.join(rootPath, entry.name);

      try {
        const content = await fs.readFile(filePath, 'utf-8');
        if (!content.includes('TRACKING #') || !/SHIPMENT DETAIL/i.test(content)) {
          continue;
        }

        const stats = await fs.stat(filePath);
        candidates.set(filePath, stats.mtimeMs);
      } catch {
        // Skip files we cannot read in the current environment.
      }
    }
  }

  return [...candidates.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([filePath]) => filePath);
}

async function resolveFedExShipmentExportFiles(): Promise<string[]> {
  const candidates = new Map<string, number>();

  for (const rootPath of getFedExExportRoots()) {
    let entries: import('fs').Dirent[] = [];
    try {
      entries = await fs.readdir(rootPath, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isFile() || !isFedExShipmentExportFileName(entry.name)) {
        continue;
      }

      const filePath = path.win32.join(rootPath, entry.name);

      try {
        const stats = await fs.stat(filePath);
        candidates.set(filePath, stats.mtimeMs);
      } catch {
        // Skip files we cannot inspect in the current environment.
      }
    }
  }

  return [...candidates.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([filePath]) => filePath);
}

export async function parseFedExShipmentDetailReport(filePath: string): Promise<FedExShipmentRecordInput[]> {
  const fileName = path.win32.basename(filePath);
  const fileContent = (await fs.readFile(filePath, 'utf-8')).replace(/^\uFEFF/, '');
  const fileStats = await fs.stat(filePath);
  const sourceFileDate = extractFedExReportSourceDate(fileContent, fileStats.mtime);
  const lines = fileContent.split(/\r?\n/);
  const records: FedExShipmentRecordInput[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const reportLine = lines[index];
    const trackingMatch = reportLine.match(
      /^\s*(\d{12,15})\s+([\d.]+)\s+(.+?)\s+([\d.]+)\s+([\d.]+)\s*$/
    );
    if (!trackingMatch) {
      continue;
    }

    const recipientLine = lines[index + 1]?.trimEnd() ?? '';
  const recipient = parseFedExShipmentReportRecipientLine(recipientLine);
  if (!recipient) {
    continue;
  }

    const rawTrackingNumber = trackingMatch[1].trim();
    const trackingNumber = normalizeTrackingNumber(rawTrackingNumber);
    const service = normalizeFedExServiceLabel(trackingMatch[3]);
    const rawPayload = `${reportLine.trimEnd()}\n${recipientLine.trimEnd()}`.trim();
    const locationLabel = formatTrackingLocation({
      city: recipient.destinationCity,
      state: recipient.destinationState,
      zip: recipient.destinationPostalCode,
      country: null,
    });

    const sourceKey = hashRecordSource([
      fileName,
      sourceFileDate.toISOString(),
      rawTrackingNumber,
      recipient.recipientCompanyName ?? '',
      recipient.recipientContactName ?? '',
      recipient.destinationAddressLine1 ?? '',
      recipient.destinationCity ?? '',
      recipient.destinationState ?? '',
      recipient.destinationPostalCode ?? '',
      service ?? '',
      rawPayload,
    ]);

    records.push({
      sourceFileName: fileName,
      sourceFilePath: filePath,
      sourceFileDate,
      eventTimestamp: null,
      trackingNumber,
      service,
      recipientCompanyName: recipient.recipientCompanyName,
      recipientContactName: recipient.recipientContactName,
      destinationAddressLine1: recipient.destinationAddressLine1,
      destinationCity: recipient.destinationCity,
      destinationState: recipient.destinationState,
      destinationPostalCode: recipient.destinationPostalCode,
      destinationCountry: null,
      sourceKey,
      rawPayload,
      rawData: {
        reportLine: reportLine.trimEnd(),
        recipientLine: recipientLine.trimEnd(),
        sourceFileName: fileName,
        sourceFilePath: filePath,
        sourceFileDate: sourceFileDate.toISOString(),
        sourceType: 'shipment_detail_report',
        locationLabel,
      },
    });

    index += 1;
  }

  return records;
}

function parseFedExCsvRowDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const parsedByReportFormat = parseFedExLogDate(value);
  if (parsedByReportFormat) {
    return parsedByReportFormat;
  }

  const parsed = Date.parse(value);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed);
  }

  return null;
}

function pickFedExRowValue(row: Record<string, unknown>, aliases: string[]): string | null {
  const normalizedAliases = aliases.map((alias) => normalizeFedExHeaderKey(alias));

  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = normalizeFedExHeaderKey(key);
    if (!normalizedAliases.some((alias) => normalizedKey === alias || normalizedKey.includes(alias) || alias.includes(normalizedKey))) {
      continue;
    }

    const text = stringifyFedExValue(value);
    if (text) {
      return text;
    }
  }

  return null;
}

export async function parseFedExShipmentExportCsv(filePath: string): Promise<FedExShipmentRecordInput[]> {
  const fileName = path.win32.basename(filePath);
  const workbook = XLSX.readFile(filePath, {
    cellDates: true,
  });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return [];
  }

  const fileStats = await fs.stat(filePath);
  const sourceFileDate = parseFedExExportDate(fileName) ?? fileStats.mtime;
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
  });
  const records: FedExShipmentRecordInput[] = [];

  for (const row of rows) {
    const rawTrackingNumber =
      pickFedExRowValue(row, [
        'tracking number',
        'tracking #',
        'tracking#',
        'tracking',
      ]) ?? null;
    const trackingNumber = normalizeTrackingNumber(rawTrackingNumber);

    if (!trackingNumber) {
      continue;
    }

    const service = normalizeFedExServiceLabel(
      pickFedExRowValue(row, [
        'service type desc',
        'service type description',
        'service type',
        'service',
      ]) ?? null
    );

    const recipientCompanyName =
      pickFedExRowValue(row, [
        'recipient company name',
        'recipient company',
        'ship to company name',
        'ship to company',
        'company name',
        'company',
        'recipient',
      ]) ?? null;

    const recipientContactName =
      pickFedExRowValue(row, [
        'recipient contact name',
        'recipient contact',
        'contact name',
        'contact',
        'attention',
        'attn',
      ]) ?? null;

    const destinationAddressLine1 =
      pickFedExRowValue(row, [
        'recipient address 1',
        'recipient address',
        'ship to address 1',
        'ship to address',
        'address 1',
        'address',
      ]) ?? null;

    const destinationCity =
      pickFedExRowValue(row, [
        'recipient city',
        'ship to city',
        'city',
      ]) ?? null;

    const destinationState =
      pickFedExRowValue(row, [
        'st',
        'state',
        'recipient state',
        'ship to state',
        'province',
      ]) ?? null;

    const destinationPostalCode =
      pickFedExRowValue(row, [
        'zip',
        'zip code',
        'postal code',
        'postal',
        'recipient postal code',
        'ship to postal code',
      ]) ?? null;

    const destinationCountry =
      pickFedExRowValue(row, [
        'country',
      ]) ?? null;
    const locationLabel = formatTrackingLocation({
      city: destinationCity,
      state: destinationState,
      zip: destinationPostalCode,
      country: destinationCountry,
    });

    const eventTimestamp =
      parseFedExCsvRowDate(
        pickFedExRowValue(row, [
          'ship date',
          'shipment date',
          'date shipped',
          'shipping date',
          'date',
        ])
      ) ?? null;

    const normalizedRow = Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, stringifyFedExValue(value) ?? ''])
    );
    const rawPayload = JSON.stringify(normalizedRow);

    const sourceKey = hashRecordSource([
      fileName,
      sourceFileDate.toISOString(),
      eventTimestamp?.toISOString() ?? '',
      rawTrackingNumber ?? '',
      recipientCompanyName ?? '',
      recipientContactName ?? '',
      destinationAddressLine1 ?? '',
      destinationCity ?? '',
      destinationState ?? '',
      destinationPostalCode ?? '',
      service ?? '',
      rawPayload,
    ]);

    records.push({
      sourceFileName: fileName,
      sourceFilePath: filePath,
      sourceFileDate,
      eventTimestamp,
      trackingNumber,
      service,
      recipientCompanyName,
      recipientContactName,
      destinationAddressLine1,
      destinationCity,
      destinationState,
      destinationPostalCode,
      destinationCountry,
      sourceKey,
      rawPayload,
      rawData: {
        row: normalizedRow,
        sourceFileName: fileName,
        sourceFilePath: filePath,
        sourceFileDate: sourceFileDate.toISOString(),
        eventTimestamp: eventTimestamp?.toISOString() ?? null,
        sourceType: 'shipment_export_csv',
        locationLabel,
      },
    });
  }

  return records;
}

async function backfillShipmentTrackingNumbers(records: FedExShipmentRecordInput[]): Promise<number> {
  const latestTrackingByWorkOrder = new Map<string, FedExShipmentRecordInput>();

  for (const record of records) {
    if (!record.workOrderId || !record.trackingNumber) {
      continue;
    }

    const existing = latestTrackingByWorkOrder.get(record.workOrderId);
    if (!existing) {
      latestTrackingByWorkOrder.set(record.workOrderId, record);
      continue;
    }

    const existingTimestamp = existing.eventTimestamp?.getTime() ?? existing.sourceFileDate.getTime();
    const candidateTimestamp = record.eventTimestamp?.getTime() ?? record.sourceFileDate.getTime();
    if (candidateTimestamp >= existingTimestamp) {
      latestTrackingByWorkOrder.set(record.workOrderId, record);
    }
  }

  if (latestTrackingByWorkOrder.size === 0) {
    return 0;
  }

  const shipments = await prisma.shipment.findMany({
    where: {
      workOrderId: { in: [...latestTrackingByWorkOrder.keys()] },
      trackingNumber: null,
    },
    select: {
      id: true,
      workOrderId: true,
      shipDate: true,
      createdAt: true,
    },
    orderBy: [
      { shipDate: 'desc' },
      { createdAt: 'desc' },
    ],
  });

  const shipmentByWorkOrder = new Map<string, { id: string; workOrderId: string }>();
  for (const shipment of shipments) {
    if (!shipmentByWorkOrder.has(shipment.workOrderId)) {
      shipmentByWorkOrder.set(shipment.workOrderId, shipment);
    }
  }

  let updated = 0;
  for (const [workOrderId, record] of latestTrackingByWorkOrder) {
    const shipment = shipmentByWorkOrder.get(workOrderId);
    if (!shipment) {
      continue;
    }

    await prisma.shipment.update({
      where: { id: shipment.id },
      data: { trackingNumber: record.trackingNumber },
    });
    updated += 1;
  }

  return updated;
}

function mapFedExShipmentRecordRowToInput(row: FedExShipmentRecordRow): FedExShipmentRecordInput {
  return {
    sourceFileName: row.sourceFileName,
    sourceFilePath: row.sourceFilePath,
    sourceFileDate: row.sourceFileDate,
    eventTimestamp: row.eventTimestamp,
    trackingNumber: normalizeTrackingNumber(row.trackingNumber),
    service: normalizeFedExServiceLabel(row.service),
    recipientCompanyName: row.recipientCompanyName,
    recipientContactName: row.recipientContactName,
    destinationAddressLine1: row.destinationAddressLine1,
    destinationCity: row.destinationCity,
    destinationState: row.destinationState,
    destinationPostalCode: row.destinationPostalCode,
    destinationCountry: row.destinationCountry,
    workOrderId: row.workOrderId,
    sourceKey: row.sourceKey,
    rawPayload: row.rawPayload,
    rawData: (row.rawData ?? {}) as Record<string, unknown>,
  };
}

interface FedExShipmentRecordLocationSource {
  rawData: unknown;
  destinationAddressLine1?: string | null;
  destinationCity?: string | null;
  destinationState?: string | null;
  destinationPostalCode?: string | null;
  destinationCountry?: string | null;
}

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

function resolveFedExShipmentRecordStatus(rawData: unknown): {
  latestStatus: string | null;
  latestStatusCode: string | null;
  latestDescription: string | null;
} {
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

function resolveFedExShipmentRecordIssue(rawData: unknown): string | null {
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

export function resolveFedExShipmentRecordLocationLabel(
  record: FedExShipmentRecordLocationSource
): string | null {
  const rawData = asRecord(record.rawData);
  const rawRow = asRecord(rawData.row);
  const scanLocation =
    formatTrackingLocation(rawData.location) ??
    formatTrackingLocation(rawData.scanLocation) ??
    formatTrackingLocation(rawRow.location) ??
    formatTrackingLocation(rawRow.scanLocation);

  if (scanLocation) {
    return scanLocation;
  }

  return pickString(rawData, ['locationLabel']) ?? pickString(rawRow, ['locationLabel']) ?? null;
}

function normalizeFedExShipmentRecordPageItem<T extends { trackingNumber: string | null; service: string | null } & FedExShipmentRecordLocationSource>(
  item: T
): T & {
  locationLabel: string | null;
  latestStatus: string | null;
  latestStatusCode: string | null;
  latestDescription: string | null;
  issue: string | null;
} {
  const statusMeta = resolveFedExShipmentRecordStatus(item.rawData);
  return {
    ...item,
    trackingNumber: normalizeTrackingNumber(item.trackingNumber),
    service: normalizeFedExServiceLabel(item.service),
    locationLabel: resolveFedExShipmentRecordLocationLabel(item),
    latestStatus: statusMeta.latestStatus,
    latestStatusCode: statusMeta.latestStatusCode,
    latestDescription: statusMeta.latestDescription,
    issue: resolveFedExShipmentRecordIssue(item.rawData),
  };
}

function isFedExApiShipmentRecord(
  item: {
    sourceFileName: string;
    sourceFilePath: string | null;
    rawData: unknown;
  }
): boolean {
  const sourceName = item.sourceFileName.trim().toLowerCase();
  const sourcePath = item.sourceFilePath?.trim().toLowerCase() ?? '';
  const rawData = asRecord(item.rawData);
  const sourceBaseUrl = typeof rawData.sourceBaseUrl === 'string' ? rawData.sourceBaseUrl.trim().toLowerCase() : '';

  return (
    sourceName.startsWith('fedex_api') ||
    sourcePath.includes('apis.fedex.com') ||
    sourcePath.includes('apis-sandbox.fedex.com') ||
    sourceBaseUrl.includes('apis.fedex.com') ||
    sourceBaseUrl.includes('apis-sandbox.fedex.com')
  );
}

type FedExShipmentSummaryCandidate = {
  id: string;
  sourceFileName: string;
  sourceFilePath: string | null;
  rawData: unknown;
  sourceFileDate: Date;
  eventTimestamp: Date | null;
  importedAt: Date;
};

function compareFedExShipmentSummaryCandidates(
  left: FedExShipmentSummaryCandidate,
  right: FedExShipmentSummaryCandidate
): number {
  const leftIsApi = isFedExApiShipmentRecord(left);
  const rightIsApi = isFedExApiShipmentRecord(right);

  if (leftIsApi !== rightIsApi) {
    return leftIsApi ? 1 : -1;
  }

  const leftTimestamp = left.eventTimestamp?.getTime() ?? left.sourceFileDate.getTime() ?? left.importedAt.getTime();
  const rightTimestamp = right.eventTimestamp?.getTime() ?? right.sourceFileDate.getTime() ?? right.importedAt.getTime();

  if (leftTimestamp !== rightTimestamp) {
    return leftTimestamp - rightTimestamp;
  }

  const leftImportedAt = left.importedAt.getTime();
  const rightImportedAt = right.importedAt.getTime();
  if (leftImportedAt !== rightImportedAt) {
    return leftImportedAt - rightImportedAt;
  }

  return 0;
}

export async function repairFedExTrackingNumberFormatting(options: {
  dryRun?: boolean;
} = {}): Promise<{
  status: 'synced' | 'empty';
  updatedFedExRecords: number;
  updatedShipments: number;
  warnings: string[];
}> {
  const warnings: string[] = [];

  const [fedExRecords, shipments] = await Promise.all([
    prisma.fedExShipmentRecord.findMany({
      where: {
        trackingNumber: { not: null },
      },
      select: {
        id: true,
        trackingNumber: true,
      },
    }),
    prisma.shipment.findMany({
      where: {
        trackingNumber: { not: null },
      },
      select: {
        id: true,
        trackingNumber: true,
      },
    }),
  ]);

  let updatedFedExRecords = 0;
  for (const record of fedExRecords) {
    const normalizedTrackingNumber = normalizeTrackingNumber(record.trackingNumber);
    if (!normalizedTrackingNumber || normalizedTrackingNumber === record.trackingNumber) {
      continue;
    }

    if (!options.dryRun) {
      await prisma.fedExShipmentRecord.update({
        where: { id: record.id },
        data: { trackingNumber: normalizedTrackingNumber },
      });
    }
    updatedFedExRecords += 1;
  }

  let updatedShipments = 0;
  for (const shipment of shipments) {
    const normalizedTrackingNumber = normalizeTrackingNumber(shipment.trackingNumber);
    if (!normalizedTrackingNumber || normalizedTrackingNumber === shipment.trackingNumber) {
      continue;
    }

    if (!options.dryRun) {
      await prisma.shipment.update({
        where: { id: shipment.id },
        data: { trackingNumber: normalizedTrackingNumber },
      });
    }
    updatedShipments += 1;
  }

  if (updatedFedExRecords === 0 && updatedShipments === 0) {
    warnings.push('No quoted or whitespace-padded FedEx tracking numbers were found to normalize.');
  }

  return {
    status: updatedFedExRecords > 0 || updatedShipments > 0 ? 'synced' : 'empty',
    updatedFedExRecords,
    updatedShipments,
    warnings,
  };
}

export async function repairFedExServiceFormatting(options: {
  dryRun?: boolean;
} = {}): Promise<{
  status: 'synced' | 'empty';
  updatedFedExRecords: number;
  warnings: string[];
}> {
  const warnings: string[] = [];

  const fedExRecords = await prisma.fedExShipmentRecord.findMany({
    where: {
      service: { not: null },
    },
    select: {
      id: true,
      service: true,
    },
  });

  let updatedFedExRecords = 0;
  for (const record of fedExRecords) {
    const normalizedService = normalizeFedExServiceLabel(record.service);
    if (!normalizedService || normalizedService === record.service) {
      continue;
    }

    if (!options.dryRun) {
      await prisma.fedExShipmentRecord.update({
        where: { id: record.id },
        data: { service: normalizedService },
      });
    }
    updatedFedExRecords += 1;
  }

  if (updatedFedExRecords === 0) {
    warnings.push('No FedEx shipment record service labels needed normalization.');
  }

  return {
    status: updatedFedExRecords > 0 ? 'synced' : 'empty',
    updatedFedExRecords,
    warnings,
  };
}

export async function backfillFedExShipmentTrackingFromDatabase(options: {
  dryRun?: boolean;
} = {}): Promise<{
  status: 'synced' | 'empty';
  totalRecords: number;
  linkedRecords: number;
  updatedRecords: number;
  updatedShipments: number;
  warnings: string[];
}> {
  const warnings: string[] = [];
  const rows = await prisma.fedExShipmentRecord.findMany({
    where: {
      trackingNumber: { not: null },
    },
    select: {
      sourceFileName: true,
      sourceFilePath: true,
      sourceFileDate: true,
      eventTimestamp: true,
      trackingNumber: true,
      service: true,
      recipientCompanyName: true,
      recipientContactName: true,
      destinationAddressLine1: true,
      destinationCity: true,
      destinationState: true,
      destinationPostalCode: true,
      destinationCountry: true,
      workOrderId: true,
      sourceKey: true,
      rawPayload: true,
      rawData: true,
    },
  });

  if (rows.length === 0) {
    return {
      status: 'empty',
      totalRecords: 0,
      linkedRecords: 0,
      updatedRecords: 0,
      updatedShipments: 0,
      warnings: ['No stored FedEx shipment records were found to reconcile.'],
    };
  }

  const records = rows.map((row) => mapFedExShipmentRecordRowToInput(row));

  let updatedRecords = 0;
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const record = records[index];
    const workOrderId = await resolveFedExWorkOrderId(record);
    record.workOrderId = workOrderId;

    if (!workOrderId || workOrderId === row.workOrderId || options.dryRun) {
      continue;
    }

    await prisma.fedExShipmentRecord.update({
      where: { sourceKey: row.sourceKey },
      data: { workOrderId },
    });
    updatedRecords += 1;
  }

  const linkedRecords = records.filter((record) => Boolean(record.workOrderId)).length;
  const updatedShipments = options.dryRun ? 0 : await backfillShipmentTrackingNumbers(records);

  if (updatedRecords === 0 && updatedShipments === 0 && linkedRecords === 0) {
    warnings.push('Stored FedEx records were scanned, but no work order matches were found.');
  }

  return {
    status: 'synced',
    totalRecords: rows.length,
    linkedRecords,
    updatedRecords,
    updatedShipments,
    warnings,
  };
}

export async function syncFedExShipmentRecords(options: {
  date?: Date;
  filePath?: string;
  dryRun?: boolean;
} = {}): Promise<FedExShipmentSyncResult> {
  const warnings: string[] = [];

  let resolution: FedExLogResolution | null = null;
  if (options.filePath) {
    const fileName = path.win32.basename(options.filePath);
    const sourceFileDate = parseDateFromFileName(fileName) ?? options.date ?? new Date();
    resolution = {
      rootPath: path.win32.dirname(options.filePath),
      fileName,
      filePath: options.filePath,
      sourceFileDate: new Date(
        sourceFileDate.getFullYear(),
        sourceFileDate.getMonth(),
        sourceFileDate.getDate()
      ),
      matchedBy: 'exact',
    };
  } else {
    resolution = await resolveFedExLogFile(options.date ?? new Date());
  }

  if (!resolution) {
    const result: FedExShipmentSyncResult = {
      status: 'missing',
      sourceFileName: null,
      sourceFilePath: null,
      sourceFileDate: null,
      matchedBy: null,
      totalRecords: 0,
      imported: 0,
      updated: 0,
      skipped: 0,
      records: [],
      warnings: ['No FedEx log file found for the requested date.'],
    };
    lastFedExSync = result;
    return result;
  }

  const records = await parseFedExLogFile(resolution.filePath);
  if (records.length === 0) {
    warnings.push('The FedEx log file was found, but no shipment request records were parsed.');
  }

  const sourceKeys = uniqueStrings(records.map((record) => record.sourceKey));
  const existingRecords = sourceKeys.length
    ? await prisma.fedExShipmentRecord.findMany({
        where: { sourceKey: { in: sourceKeys } },
        select: { sourceKey: true },
      })
    : [];
  const existingKeys = new Set(existingRecords.map((record) => record.sourceKey));

  let imported = 0;
  let updated = 0;
  const skipped = 0;

  for (const record of records) {
    const workOrderId = await resolveFedExWorkOrderId(record);
    record.workOrderId = workOrderId;

    if (options.dryRun) {
      if (existingKeys.has(record.sourceKey)) {
        updated += 1;
      } else {
        imported += 1;
      }
      continue;
    }

    await prisma.fedExShipmentRecord.upsert({
      where: { sourceKey: record.sourceKey },
      create: {
        sourceFileName: record.sourceFileName,
        sourceFilePath: record.sourceFilePath,
        sourceFileDate: record.sourceFileDate,
        eventTimestamp: record.eventTimestamp,
        trackingNumber: record.trackingNumber,
        service: record.service,
        recipientCompanyName: record.recipientCompanyName,
        recipientContactName: record.recipientContactName,
        destinationAddressLine1: record.destinationAddressLine1,
        destinationCity: record.destinationCity,
        destinationState: record.destinationState,
        destinationPostalCode: record.destinationPostalCode,
        destinationCountry: record.destinationCountry,
        workOrderId,
        sourceKey: record.sourceKey,
        rawPayload: record.rawPayload,
        rawData: record.rawData as Prisma.InputJsonValue,
      },
      update: {
        sourceFileName: record.sourceFileName,
        sourceFilePath: record.sourceFilePath,
        sourceFileDate: record.sourceFileDate,
        eventTimestamp: record.eventTimestamp,
        trackingNumber: record.trackingNumber,
        service: record.service,
        recipientCompanyName: record.recipientCompanyName,
        recipientContactName: record.recipientContactName,
        destinationAddressLine1: record.destinationAddressLine1,
        destinationCity: record.destinationCity,
        destinationState: record.destinationState,
        destinationPostalCode: record.destinationPostalCode,
        destinationCountry: record.destinationCountry,
        workOrderId,
        rawPayload: record.rawPayload,
        rawData: record.rawData as Prisma.InputJsonValue,
      },
    });

    if (existingKeys.has(record.sourceKey)) {
      updated += 1;
    } else {
      imported += 1;
    }
  }

  if (!options.dryRun) {
    const shipmentTrackingUpdated = await backfillShipmentTrackingNumbers(records);
    if (shipmentTrackingUpdated > 0) {
      console.log(
        `FedEx tracking backfill: ${shipmentTrackingUpdated} shipment rows updated from XML log records.`
      );
    }
  }

  const result: FedExShipmentSyncResult = {
    status: records.length > 0 ? 'synced' : 'empty',
    sourceFileName: resolution.fileName,
    sourceFilePath: resolution.filePath,
    sourceFileDate: resolution.sourceFileDate,
    matchedBy: resolution.matchedBy,
    totalRecords: records.length,
    imported,
    updated,
    skipped,
    records,
    warnings,
  };

  lastFedExSync = result;
  return result;
}

export async function syncFedExShipmentHistory(options: {
  rootPaths?: string[];
  dryRun?: boolean;
} = {}): Promise<FedExShipmentHistorySyncResult> {
  const warnings: string[] = [];
  const filePaths = await resolveFedExShipmentLogFiles(options.rootPaths ?? getFedExLogRoots());

  if (filePaths.length === 0) {
    return {
      status: 'missing',
      totalFiles: 0,
      sourceFileNames: [],
      totalRecords: 0,
      imported: 0,
      updated: 0,
      skipped: 0,
      backfill: null,
      warnings: ['No FedEx log files were found.'],
    };
  }

  let totalRecords = 0;
  let imported = 0;
  let updated = 0;
  let skipped = 0;
  const sourceFileNames: string[] = [];

  for (const filePath of filePaths) {
    const result = await syncFedExShipmentRecords({
      filePath,
      dryRun: options.dryRun,
    });

    totalRecords += result.totalRecords;
    imported += result.imported;
    updated += result.updated;
    skipped += result.skipped;
    if (result.sourceFileName) {
      sourceFileNames.push(result.sourceFileName);
    }
    warnings.push(...result.warnings);
  }

  const backfill = options.dryRun
    ? null
    : await backfillFedExShipmentTrackingFromDatabase();

  if (backfill && (backfill.updatedRecords > 0 || backfill.updatedShipments > 0)) {
    console.log(
      `FedEx history backfill: ${backfill.linkedRecords} linked, ${backfill.updatedRecords} records updated, ${backfill.updatedShipments} shipment rows updated`
    );
  }

  return {
    status: totalRecords > 0 ? 'synced' : 'empty',
    totalFiles: filePaths.length,
    sourceFileNames,
    totalRecords,
    imported,
    updated,
    skipped,
    backfill,
    warnings,
  };
}

export async function syncFedExShipmentReports(options: {
  filePath?: string;
  dryRun?: boolean;
} = {}): Promise<FedExShipmentSyncResult> {
  const warnings: string[] = [];

  const filePaths = options.filePath ? [options.filePath] : await resolveFedExShipmentReportFiles();

  if (filePaths.length === 0) {
    const result: FedExShipmentSyncResult = {
      status: 'missing',
      sourceFileName: null,
      sourceFilePath: null,
      sourceFileDate: null,
      matchedBy: null,
      totalRecords: 0,
      imported: 0,
      updated: 0,
      skipped: 0,
      records: [],
      warnings: ['No FedEx shipment detail report files were found.'],
    };
    lastFedExSync = result;
    return result;
  }

  const recordsByFile = await Promise.all(
    filePaths.map(async (filePath) => ({
      filePath,
      records: await parseFedExShipmentDetailReport(filePath),
    }))
  );
  const records = recordsByFile.flatMap((entry) => entry.records);

  if (records.length === 0) {
    warnings.push('The FedEx shipment detail report files were found, but no shipment rows were parsed.');
  }

  const sourceKeys = uniqueStrings(records.map((record) => record.sourceKey));
  const existingRecords = sourceKeys.length
    ? await prisma.fedExShipmentRecord.findMany({
        where: { sourceKey: { in: sourceKeys } },
        select: { sourceKey: true },
      })
    : [];
  const existingKeys = new Set(existingRecords.map((record) => record.sourceKey));

  let imported = 0;
  let updated = 0;
  const skipped = 0;

  for (const record of records) {
    const workOrderId = await resolveFedExWorkOrderId(record);
    record.workOrderId = workOrderId;

    if (options.dryRun) {
      if (existingKeys.has(record.sourceKey)) {
        updated += 1;
      } else {
        imported += 1;
      }
      continue;
    }

    await prisma.fedExShipmentRecord.upsert({
      where: { sourceKey: record.sourceKey },
      create: {
        sourceFileName: record.sourceFileName,
        sourceFilePath: record.sourceFilePath,
        sourceFileDate: record.sourceFileDate,
        eventTimestamp: record.eventTimestamp,
        trackingNumber: record.trackingNumber,
        service: record.service,
        recipientCompanyName: record.recipientCompanyName,
        recipientContactName: record.recipientContactName,
        destinationAddressLine1: record.destinationAddressLine1,
        destinationCity: record.destinationCity,
        destinationState: record.destinationState,
        destinationPostalCode: record.destinationPostalCode,
        destinationCountry: record.destinationCountry,
        workOrderId,
        sourceKey: record.sourceKey,
        rawPayload: record.rawPayload,
        rawData: record.rawData as Prisma.InputJsonValue,
      },
      update: {
        sourceFileName: record.sourceFileName,
        sourceFilePath: record.sourceFilePath,
        sourceFileDate: record.sourceFileDate,
        eventTimestamp: record.eventTimestamp,
        trackingNumber: record.trackingNumber,
        service: record.service,
        recipientCompanyName: record.recipientCompanyName,
        recipientContactName: record.recipientContactName,
        destinationAddressLine1: record.destinationAddressLine1,
        destinationCity: record.destinationCity,
        destinationState: record.destinationState,
        destinationPostalCode: record.destinationPostalCode,
        destinationCountry: record.destinationCountry,
        workOrderId,
        rawPayload: record.rawPayload,
        rawData: record.rawData as Prisma.InputJsonValue,
      },
    });

    if (existingKeys.has(record.sourceKey)) {
      updated += 1;
    } else {
      imported += 1;
    }
  }

  if (!options.dryRun) {
    const shipmentTrackingUpdated = await backfillShipmentTrackingNumbers(records);
    if (shipmentTrackingUpdated > 0) {
      console.log(
        `FedEx tracking backfill: ${shipmentTrackingUpdated} shipment rows updated from shipment detail report records.`
      );
    }
  }

  const result: FedExShipmentSyncResult = {
    status: records.length > 0 ? 'synced' : 'empty',
    sourceFileName: filePaths[0] ? path.win32.basename(filePaths[0]) : null,
    sourceFilePath: filePaths[0] ?? null,
    sourceFileDate: records[0]?.sourceFileDate ?? null,
    matchedBy: null,
    totalRecords: records.length,
    imported,
    updated,
    skipped,
    records,
    warnings,
  };

  lastFedExSync = result;
  return result;
}

export async function syncFedExShipmentExports(options: {
  filePath?: string;
  dryRun?: boolean;
} = {}): Promise<FedExShipmentSyncResult> {
  const warnings: string[] = [];

  const filePaths = options.filePath ? [options.filePath] : await resolveFedExShipmentExportFiles();

  if (filePaths.length === 0) {
    const result: FedExShipmentSyncResult = {
      status: 'missing',
      sourceFileName: null,
      sourceFilePath: null,
      sourceFileDate: null,
      matchedBy: null,
      totalRecords: 0,
      imported: 0,
      updated: 0,
      skipped: 0,
      records: [],
      warnings: ['No FedEx shipment export CSV files were found.'],
    };
    lastFedExSync = result;
    return result;
  }

  const recordsByFile = await Promise.all(
    filePaths.map(async (filePath) => ({
      filePath,
      records: await parseFedExShipmentExportCsv(filePath),
    }))
  );
  const records = recordsByFile.flatMap((entry) => entry.records);

  if (records.length === 0) {
    warnings.push('The FedEx shipment export CSV files were found, but no shipment rows were parsed.');
  }

  const sourceKeys = uniqueStrings(records.map((record) => record.sourceKey));
  const existingRecords = sourceKeys.length
    ? await prisma.fedExShipmentRecord.findMany({
        where: { sourceKey: { in: sourceKeys } },
        select: { sourceKey: true },
      })
    : [];
  const existingKeys = new Set(existingRecords.map((record) => record.sourceKey));

  let imported = 0;
  let updated = 0;
  const skipped = 0;

  for (const record of records) {
    const workOrderId = await resolveFedExWorkOrderId(record);
    record.workOrderId = workOrderId;

    if (options.dryRun) {
      if (existingKeys.has(record.sourceKey)) {
        updated += 1;
      } else {
        imported += 1;
      }
      continue;
    }

    await prisma.fedExShipmentRecord.upsert({
      where: { sourceKey: record.sourceKey },
      create: {
        sourceFileName: record.sourceFileName,
        sourceFilePath: record.sourceFilePath,
        sourceFileDate: record.sourceFileDate,
        eventTimestamp: record.eventTimestamp,
        trackingNumber: record.trackingNumber,
        service: record.service,
        recipientCompanyName: record.recipientCompanyName,
        recipientContactName: record.recipientContactName,
        destinationAddressLine1: record.destinationAddressLine1,
        destinationCity: record.destinationCity,
        destinationState: record.destinationState,
        destinationPostalCode: record.destinationPostalCode,
        destinationCountry: record.destinationCountry,
        workOrderId,
        sourceKey: record.sourceKey,
        rawPayload: record.rawPayload,
        rawData: record.rawData as Prisma.InputJsonValue,
      },
      update: {
        sourceFileName: record.sourceFileName,
        sourceFilePath: record.sourceFilePath,
        sourceFileDate: record.sourceFileDate,
        eventTimestamp: record.eventTimestamp,
        trackingNumber: record.trackingNumber,
        service: record.service,
        recipientCompanyName: record.recipientCompanyName,
        recipientContactName: record.recipientContactName,
        destinationAddressLine1: record.destinationAddressLine1,
        destinationCity: record.destinationCity,
        destinationState: record.destinationState,
        destinationPostalCode: record.destinationPostalCode,
        destinationCountry: record.destinationCountry,
        workOrderId,
        rawPayload: record.rawPayload,
        rawData: record.rawData as Prisma.InputJsonValue,
      },
    });

    if (existingKeys.has(record.sourceKey)) {
      updated += 1;
    } else {
      imported += 1;
    }
  }

  if (!options.dryRun) {
    const shipmentTrackingUpdated = await backfillShipmentTrackingNumbers(records);
    if (shipmentTrackingUpdated > 0) {
      console.log(
        `FedEx tracking backfill: ${shipmentTrackingUpdated} shipment rows updated from shipment export CSV records.`
      );
    }
  }

  const result: FedExShipmentSyncResult = {
    status: records.length > 0 ? 'synced' : 'empty',
    sourceFileName: filePaths[0] ? path.win32.basename(filePaths[0]) : null,
    sourceFilePath: filePaths[0] ?? null,
    sourceFileDate: records[0]?.sourceFileDate ?? null,
    matchedBy: null,
    totalRecords: records.length,
    imported,
    updated,
    skipped,
    records,
    warnings,
  };

  lastFedExSync = result;
  return result;
}

function buildFedExShipmentRecordWhere(
  query: FedExShipmentQuery = {},
  options: { requireTrackingNumber?: boolean } = {}
): Prisma.FedExShipmentRecordWhereInput {
  const andConditions: Prisma.FedExShipmentRecordWhereInput[] = [];

  if (options.requireTrackingNumber) {
    andConditions.push({
      trackingNumber: { not: null },
    });
  }

  if (query.trackingNumber) {
    andConditions.push({
      trackingNumber: {
        contains: query.trackingNumber,
        mode: 'insensitive',
      },
    });
  }

  if (query.search) {
    const searchWhere = buildTokenizedSearchWhere(query.search, [
      'trackingNumber',
      'recipientCompanyName',
      'recipientContactName',
      'destinationAddressLine1',
      'destinationCity',
    ]);
    if (searchWhere) {
      andConditions.push(searchWhere);
    }
  }

  if (query.fromDate ?? query.toDate) {
    const dateFilter: Prisma.DateTimeFilter = {};
    if (query.fromDate) {
      dateFilter.gte = query.fromDate;
    }
    if (query.toDate) {
      dateFilter.lte = query.toDate;
    }
    andConditions.push({
      sourceFileDate: dateFilter,
    });
  }

  if (andConditions.length === 0) {
    return {};
  }

  if (andConditions.length === 1) {
    return andConditions[0];
  }

  return {
    AND: andConditions,
  };
}

export function summarizeFedExShipmentRecords(
  records: Array<
    FedExShipmentRecord & {
      workOrder: {
        id: string;
        orderNumber: string;
        customerName: string;
      } | null;
    }
  >
): FedExShipmentSummaryRecord[] {
  const groupedByTracking = new Map<
    string,
    { summary: FedExShipmentSummaryRecord; workOrderIds: Set<string> }
  >();

  for (const record of records) {
    const normalizedRecord = normalizeFedExShipmentRecordPageItem(record);
    const trackingNumber = normalizeTrackingNumber(normalizedRecord.trackingNumber);
    if (!trackingNumber) {
      continue;
    }

    const existingGroup = groupedByTracking.get(trackingNumber);
    if (existingGroup) {
      existingGroup.summary.recordCount += 1;
      if (normalizedRecord.workOrder?.id) {
        existingGroup.workOrderIds.add(normalizedRecord.workOrder.id);
      }
      existingGroup.summary.workOrderCount = existingGroup.workOrderIds.size;
      existingGroup.summary.linkedWorkOrderCount = existingGroup.workOrderIds.size;
      if (
        compareFedExShipmentSummaryCandidates(
          existingGroup.summary,
          normalizedRecord as FedExShipmentSummaryCandidate
        ) < 0
      ) {
        existingGroup.summary = {
          ...normalizedRecord,
          recordCount: existingGroup.summary.recordCount,
          workOrderCount: existingGroup.workOrderIds.size,
          linkedWorkOrderCount: existingGroup.workOrderIds.size,
        };
      }
      continue;
    }

    const workOrderIds = new Set<string>();
    if (normalizedRecord.workOrder?.id) {
      workOrderIds.add(normalizedRecord.workOrder.id);
    }

    groupedByTracking.set(trackingNumber, {
      summary: {
        ...normalizedRecord,
        trackingNumber,
        recordCount: 1,
        workOrderCount: workOrderIds.size,
        linkedWorkOrderCount: workOrderIds.size,
      },
      workOrderIds,
    });
  }

  return [...groupedByTracking.values()].map((group) => group.summary);
}

export async function listFedExShipmentRecords(
  query: FedExShipmentQuery = {}
): Promise<FedExShipmentRecordPage> {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25));
  const where = buildFedExShipmentRecordWhere(query);

  const [items, total] = await Promise.all([
    prisma.fedExShipmentRecord.findMany({
      where,
      orderBy: [{ sourceFileDate: 'desc' }, { eventTimestamp: 'desc' }, { importedAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        workOrder: {
          select: {
            id: true,
            orderNumber: true,
            customerName: true,
          },
        },
      },
    }),
    prisma.fedExShipmentRecord.count({ where }),
  ]);

  return {
    items: items.map(normalizeFedExShipmentRecordPageItem),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function listFedExShipmentSummaries(
  query: FedExShipmentQuery = {}
): Promise<FedExShipmentSummaryPage> {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25));
  const where = buildFedExShipmentRecordWhere(query, {
    requireTrackingNumber: true,
  });

  const records = await prisma.fedExShipmentRecord.findMany({
    where,
    orderBy: [{ sourceFileDate: 'desc' }, { eventTimestamp: 'desc' }, { importedAt: 'desc' }],
    include: {
      workOrder: {
        select: {
          id: true,
          orderNumber: true,
          customerName: true,
        },
      },
    },
  });

  const grouped = summarizeFedExShipmentRecords(records);
  const total = grouped.length;
  const items = grouped.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export function getFedExSyncStatus(): {
  lastSync: FedExShipmentSyncResult | null;
  logRoots: string[];
  reportRoots: string[];
  exportRoots: string[];
} {
  return {
    lastSync: lastFedExSync,
    logRoots: getFedExLogRoots(),
    reportRoots: getFedExReportRoots(),
    exportRoots: getFedExExportRoots(),
  };
}
