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
  printStartedAt?: Date | string | null;
  printCompletedAt?: Date | string | null;
  printSettingsJson?: unknown;
  workOrder: {
    orderNumber: string;
    customerName: string;
  };
}

export interface FieryJobTimelineMetrics {
  queueToRipMinutes: number | null;
  ripToPrintMinutes: number | null;
  printMinutes: number | null;
  totalMinutes: number | null;
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

function buildFieryJobTimelineState(job: FieryJobTimelineSource): {
  submittedAt: string | null;
  downloadedAt: string | null;
  processedAt: string | null;
  printStartedAt: string | null;
  printedAt: string | null;
  submittedMs: number | null;
  downloadedMs: number | null;
  processedMs: number | null;
  printStartedMs: number | null;
  printedMs: number | null;
} {
  const submittedAt = normalizeIsoTimestamp(job.queuedAt);
  const downloadedAt = extractFieryDownloadedAt(job.printSettingsJson);
  const processedAt = normalizeIsoTimestamp(job.rippedAt);
  const printStartedAt = normalizeIsoTimestamp(job.printStartedAt);
  const printedAt = normalizeIsoTimestamp(job.printCompletedAt);

  return {
    submittedAt,
    downloadedAt,
    processedAt,
    printStartedAt,
    printedAt,
    submittedMs: parseTimestampMs(submittedAt),
    downloadedMs: parseTimestampMs(downloadedAt),
    processedMs: parseTimestampMs(processedAt),
    printStartedMs: parseTimestampMs(printStartedAt),
    printedMs: parseTimestampMs(printedAt),
  };
}

export function buildFieryJobTimelineMetrics(job: FieryJobTimelineSource): FieryJobTimelineMetrics {
  const state = buildFieryJobTimelineState(job);
  const processedAnchor = state.downloadedMs ?? state.submittedMs;
  const printStartAnchor = state.processedMs ?? processedAnchor;
  const printedAnchor = state.printStartedMs ?? printStartAnchor;

  return {
    queueToRipMinutes: diffMinutes(state.processedMs, state.submittedMs),
    ripToPrintMinutes: diffMinutes(state.printStartedMs, printStartAnchor),
    printMinutes: diffMinutes(state.printedMs, printedAnchor),
    totalMinutes: diffMinutes(state.printedMs, state.submittedMs),
  };
}

export function buildFieryJobTimelineSummary(job: FieryJobTimelineSource): FieryJobTimelineSummary {
  const state = buildFieryJobTimelineState(job);
  const processedAnchor = state.downloadedMs ?? state.submittedMs;
  const printedAnchor = state.processedMs ?? state.downloadedMs ?? state.submittedMs;

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
        time: state.submittedAt,
        durationMinutes: null,
        complete: state.submittedAt !== null,
      },
      {
        key: 'downloaded',
        label: 'Downloaded',
        time: state.downloadedAt,
        durationMinutes: diffMinutes(state.downloadedMs, state.submittedMs),
        complete: state.downloadedAt !== null,
      },
      {
        key: 'processed',
        label: 'Processed',
        time: state.processedAt,
        durationMinutes: diffMinutes(state.processedMs, processedAnchor),
        complete: state.processedAt !== null,
      },
      {
        key: 'printed',
        label: 'Printed',
        time: state.printedAt,
        durationMinutes: diffMinutes(state.printedMs, printedAnchor),
        complete: state.printedAt !== null,
      },
    ],
  };
}
