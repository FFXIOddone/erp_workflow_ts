import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { XMLParser } from 'fast-xml-parser';
import type { FedExShipmentRecord, Prisma } from '@prisma/client';
import { prisma } from '../db/client.js';

const FEDEX_LOG_FILE_PREFIX = 'FxLogSr';
const FEDEX_LOG_FILE_REGEX = /^FxLogSr(\d{8})\.xml$/i;
const DEFAULT_FEDEX_LOG_ROOTS = [
  process.env.FEDEX_LOG_ROOT?.trim(),
  process.env.FEDEX_LOG_DIR?.trim(),
  '\\\\192.168.254.131\\ProgramData\\FedEx\\FSM\\Logs',
  '\\\\192.168.254.131\\C$\\ProgramData\\FedEx\\FSM\\Logs',
  'C:\\ProgramData\\FedEx\\FSM\\Logs',
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

export interface FedExShipmentRecordPage {
  items: FedExShipmentRecordWithWorkOrder[];
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

type FedExWorkOrderCandidate = {
  id: string;
  orderNumber: string;
  customerName: string;
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
  if (searchTerms.length === 0) {
    return null;
  }

  const orConditions = searchTerms.slice(0, 8).flatMap((term) => [
    { customerName: { contains: term, mode: 'insensitive' as const } },
    { company: { name: { contains: term, mode: 'insensitive' as const } } },
    { customer: { companyName: { contains: term, mode: 'insensitive' as const } } },
    { customer: { name: { contains: term, mode: 'insensitive' as const } } },
    { description: { contains: term, mode: 'insensitive' as const } },
  ]);

  const candidates = await prisma.workOrder.findMany({
    where: orConditions.length > 0 ? { OR: orConditions } : undefined,
    select: {
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
    },
    take: 100,
  }) as FedExWorkOrderCandidate[];

  let bestCandidate: FedExWorkOrderCandidate | null = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    const score = scoreFedExWorkOrderCandidate(record, candidate);
    if (score > bestScore) {
      bestScore = score;
      bestCandidate = candidate;
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

  const trackingNumber = fields.FDXPSP_I_TRACKING_NUMBER?.trim() ?? null;
  const service = fields.FDXPSP_I_SERVICE?.trim() ?? null;
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

  const sourceKey = hashRecordSource([
    fileName,
    sourceFileDate.toISOString(),
    eventTimestamp?.toISOString() ?? '',
    trackingNumber ?? '',
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

export async function parseFedExLogFile(filePath: string): Promise<FedExShipmentRecordInput[]> {
  const fileName = path.win32.basename(filePath);
  const sourceFileDate = parseDateFromFileName(fileName) ?? new Date();
  const blocks = await readCandidateBlocks(filePath);

  return blocks
    .map((block) => buildRecordFromBlock(block, fileName, sourceFileDate, filePath))
    .filter((record): record is FedExShipmentRecordInput => Boolean(record));
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

export async function listFedExShipmentRecords(
  query: FedExShipmentQuery = {}
): Promise<FedExShipmentRecordPage> {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25));

  const where: Prisma.FedExShipmentRecordWhereInput = {};

  if (query.trackingNumber) {
    where.trackingNumber = {
      contains: query.trackingNumber,
      mode: 'insensitive',
    };
  }

  if (query.search) {
    where.OR = [
      { trackingNumber: { contains: query.search, mode: 'insensitive' } },
      { recipientCompanyName: { contains: query.search, mode: 'insensitive' } },
      { recipientContactName: { contains: query.search, mode: 'insensitive' } },
      { destinationAddressLine1: { contains: query.search, mode: 'insensitive' } },
      { destinationCity: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  if (query.fromDate ?? query.toDate) {
    const dateFilter: Prisma.DateTimeFilter = {};
    if (query.fromDate) {
      dateFilter.gte = query.fromDate;
    }
    if (query.toDate) {
      dateFilter.lte = query.toDate;
    }
    where.sourceFileDate = dateFilter;
  }

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
} {
  return {
    lastSync: lastFedExSync,
    logRoots: getFedExLogRoots(),
  };
}
