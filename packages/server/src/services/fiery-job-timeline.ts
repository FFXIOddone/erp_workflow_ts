type FieryTimelineStageKey = 'submitted' | 'downloaded' | 'processed' | 'printed';

export interface FieryTimelineStage {
  key: FieryTimelineStageKey;
  label: string;
  time: string | null;
  durationMinutes: number | null;
  complete: boolean;
}

export interface FieryJobTimelineSummary {
  jobId: string;
  workOrderId: string;
  orderNumber: string;
  customerName: string;
  sourceFileName: string;
  status: string;
  stages: FieryTimelineStage[];
}

export interface FieryJobTimelineSource {
  id: string;
  workOrderId: string;
  sourceFileName: string;
  status: string;
  queuedAt: Date | string;
  rippedAt?: Date | string | null;
  printCompletedAt?: Date | string | null;
  printSettingsJson?: unknown;
  workOrder: {
    orderNumber: string;
    customerName: string;
  };
}

function normalizeIsoTimestamp(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseTimestampMs(value: string | null): number | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function extractFieryDownloadedAt(printSettingsJson: unknown): string | null {
  if (!printSettingsJson || typeof printSettingsJson !== 'object') return null;

  const fierySettings = (printSettingsJson as { fiery?: unknown }).fiery;
  if (!fierySettings || typeof fierySettings !== 'object') return null;

  const downloadedAt = (fierySettings as { downloadedAt?: unknown }).downloadedAt;
  if (typeof downloadedAt !== 'string') return null;

  return normalizeIsoTimestamp(downloadedAt);
}

function diffMinutes(laterMs: number | null, earlierMs: number | null): number | null {
  if (laterMs == null || earlierMs == null) return null;
  return Math.max(0, Math.round((laterMs - earlierMs) / 60000));
}

export function buildFieryJobTimelineSummary(job: FieryJobTimelineSource): FieryJobTimelineSummary {
  const submittedAt = normalizeIsoTimestamp(job.queuedAt);
  const downloadedAt = extractFieryDownloadedAt(job.printSettingsJson);
  const processedAt = normalizeIsoTimestamp(job.rippedAt);
  const printedAt = normalizeIsoTimestamp(job.printCompletedAt);

  const submittedMs = parseTimestampMs(submittedAt);
  const downloadedMs = parseTimestampMs(downloadedAt);
  const processedMs = parseTimestampMs(processedAt);
  const printedMs = parseTimestampMs(printedAt);

  const processedAnchor = downloadedMs ?? submittedMs;
  const printedAnchor = processedMs ?? downloadedMs ?? submittedMs;

  return {
    jobId: job.id,
    workOrderId: job.workOrderId,
    orderNumber: job.workOrder.orderNumber,
    customerName: job.workOrder.customerName,
    sourceFileName: job.sourceFileName,
    status: job.status,
    stages: [
      {
        key: 'submitted',
        label: 'Submitted',
        time: submittedAt,
        durationMinutes: null,
        complete: submittedAt !== null,
      },
      {
        key: 'downloaded',
        label: 'Downloaded',
        time: downloadedAt,
        durationMinutes: diffMinutes(downloadedMs, submittedMs),
        complete: downloadedAt !== null,
      },
      {
        key: 'processed',
        label: 'Processed',
        time: processedAt,
        durationMinutes: diffMinutes(processedMs, processedAnchor),
        complete: processedAt !== null,
      },
      {
        key: 'printed',
        label: 'Printed',
        time: printedAt,
        durationMinutes: diffMinutes(printedMs, printedAnchor),
        complete: printedAt !== null,
      },
    ],
  };
}
