type FileChainStatus =
  | 'DESIGN'
  | 'SENT_TO_RIP'
  | 'RIPPING'
  | 'READY_TO_PRINT'
  | 'PRINTING'
  | 'PRINTED'
  | 'CUT_PENDING'
  | 'CUTTING'
  | 'CUT_COMPLETE'
  | 'FINISHED'
  | 'FAILED';

type FileChainStepStatus = 'COMPLETED' | 'IN_PROGRESS' | 'PENDING' | 'FAILED';
type FileChainFileKind = 'PRINT' | 'CUT' | 'UNKNOWN';

export type FileChainLinkLike = {
  status: string;
  printFilePath?: string | null;
  printFileName?: string | null;
  cutFilePath?: string | null;
  cutFileName?: string | null;
  printStartedAt?: Date | string | null;
  printCompletedAt?: Date | string | null;
  cutStartedAt?: Date | string | null;
  cutCompletedAt?: Date | string | null;
  ripJob?: {
    status?: string | null;
    rippedAt?: Date | string | null;
    printStartedAt?: Date | string | null;
    printCompletedAt?: Date | string | null;
  } | null;
};

export type FileChainLinkState = {
  effectiveStatus: FileChainStatus;
  ripStatus: FileChainStepStatus;
  printStatus: FileChainStepStatus;
  cutStatus: FileChainStepStatus;
  hasPrintFile: boolean;
  hasCutFile: boolean;
  rippedAt: Date | string | null;
  printedAt: Date | string | null;
  cutAt: Date | string | null;
  cutCompletedAt: Date | string | null;
};

export type FileChainLinkView<T extends FileChainLinkLike = FileChainLinkLike> = T & FileChainLinkState;

export type FileChainTraceSummary = {
  hasPrinted: boolean;
  hasCut: boolean;
  status: 'PRINTED_AND_CUT' | 'PRINTED_NOT_CUT' | 'NOT_PRINTED' | 'NOT_FOUND';
};

export type FileChainCompletionInput =
  | FileChainLinkLike
  | (Pick<FileChainLinkState, 'effectiveStatus'> &
      Partial<Pick<FileChainLinkState, 'hasPrintFile' | 'hasCutFile'>>);

const STATUS_PRIORITY: Record<FileChainStatus, number> = {
  FAILED: 0,
  DESIGN: 1,
  SENT_TO_RIP: 2,
  RIPPING: 3,
  READY_TO_PRINT: 4,
  PRINTING: 5,
  PRINTED: 6,
  CUT_PENDING: 7,
  CUTTING: 8,
  CUT_COMPLETE: 9,
  FINISHED: 10,
};

const RIP_COMPLETE_STATUSES = new Set<FileChainStatus>([
  'READY_TO_PRINT',
  'PRINTING',
  'PRINTED',
  'CUT_PENDING',
  'CUTTING',
  'CUT_COMPLETE',
  'FINISHED',
]);

const RIP_IN_PROGRESS_STATUSES = new Set<FileChainStatus>(['SENT_TO_RIP', 'RIPPING']);

const PRINT_COMPLETE_STATUSES = new Set<FileChainStatus>([
  'PRINTED',
  'CUT_PENDING',
  'CUTTING',
  'CUT_COMPLETE',
  'FINISHED',
]);

const PRINT_IN_PROGRESS_STATUSES = new Set<FileChainStatus>(['PRINTING']);

const CUT_COMPLETE_STATUSES = new Set<FileChainStatus>(['CUT_COMPLETE', 'FINISHED']);

const CUT_IN_PROGRESS_STATUSES = new Set<FileChainStatus>(['CUTTING']);
const POST_READY_STATUSES = new Set<FileChainStatus>([
  'PRINTING',
  'PRINTED',
  'CUT_PENDING',
  'CUTTING',
  'CUT_COMPLETE',
  'FINISHED',
]);
const TRACE_PRINTED_STATUSES = new Set<FileChainStatus>([
  'READY_TO_PRINT',
  'PRINTING',
  'PRINTED',
  'CUT_PENDING',
  'CUTTING',
  'CUT_COMPLETE',
  'FINISHED',
]);
const TRACE_CUT_STATUSES = new Set<FileChainStatus>(['CUT_COMPLETE', 'FINISHED']);

const PRINT_FILE_EXTENSIONS = new Set(['.pdf', '.tif', '.tiff']);
const CUT_FILE_EXTENSIONS = new Set(['.zcc', '.xml', '.xml_tmp', '.dxf']);

function normalizeFileCandidate(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

function getFileExtension(value: string | null | undefined): string {
  const candidate = normalizeFileCandidate(value).split(/[?#]/, 1)[0];
  if (!candidate) return '';
  const separatorIndex = Math.max(candidate.lastIndexOf('/'), candidate.lastIndexOf('\\'));
  const fileName = separatorIndex >= 0 ? candidate.slice(separatorIndex + 1) : candidate;
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex === fileName.length - 1) return '';
  return fileName.slice(dotIndex).toLowerCase();
}

function classifyFileKind(value: string | null | undefined): FileChainFileKind {
  const extension = getFileExtension(value);
  if (PRINT_FILE_EXTENSIONS.has(extension)) return 'PRINT';
  if (CUT_FILE_EXTENSIONS.has(extension)) return 'CUT';
  return 'UNKNOWN';
}

export function isPrintFileName(value: string | null | undefined): boolean {
  return classifyFileKind(value) === 'PRINT';
}

export function isCutFileName(value: string | null | undefined): boolean {
  return classifyFileKind(value) === 'CUT';
}

function normalizeChainStatus(status: string | null | undefined): FileChainStatus {
  if (!status) return 'DESIGN';
  const upper = status.toUpperCase() as FileChainStatus;
  return upper in STATUS_PRIORITY ? upper : 'DESIGN';
}

function normalizeRipStatus(status: string | null | undefined): string {
  return status?.trim().toUpperCase() ?? '';
}

function chooseTime<T>(...values: Array<T | null | undefined>): T | null {
  for (const value of values) {
    if (value !== null && value !== undefined) {
      return value;
    }
  }
  return null;
}

function deriveEffectiveStatus(link: FileChainLinkLike, hasPrintFile: boolean, hasCutFile: boolean): FileChainStatus {
  const rawStatus = normalizeChainStatus(link.status);
  const ripStatus = normalizeRipStatus(link.ripJob?.status);
  const printCompletedAt = chooseTime(link.printCompletedAt, link.ripJob?.printCompletedAt);
  const printStartedAt = chooseTime(link.printStartedAt, link.ripJob?.printStartedAt);
  const cutStartedAt = chooseTime(link.cutStartedAt);
  const cutCompletedAt = chooseTime(link.cutCompletedAt);
  const ripCompletedAt = chooseTime(link.ripJob?.rippedAt);

  if (rawStatus === 'FAILED' || ripStatus === 'FAILED') {
    return 'FAILED';
  }

  if (!hasPrintFile && hasCutFile) {
    if (cutCompletedAt || rawStatus === 'CUT_COMPLETE') {
      return 'FINISHED';
    }
    if (cutStartedAt || rawStatus === 'CUTTING') {
      return 'CUTTING';
    }
    if (rawStatus === 'CUT_PENDING') {
      return 'CUT_PENDING';
    }
    return 'CUT_PENDING';
  }

  if (cutCompletedAt || rawStatus === 'CUT_COMPLETE') {
    return 'FINISHED';
  }
  if (cutStartedAt || rawStatus === 'CUTTING') {
    return 'CUTTING';
  }
  if (printCompletedAt || ripStatus === 'PRINTED' || ripStatus === 'COMPLETED' || rawStatus === 'PRINTED') {
    if (cutStartedAt || hasCutFile || rawStatus === 'CUT_PENDING') {
      return 'CUT_PENDING';
    }
    return 'PRINTED';
  }
  if (printStartedAt || rawStatus === 'PRINTING' || ripStatus === 'PRINTING') {
    return 'PRINTING';
  }
  if (ripCompletedAt || ripStatus === 'READY' || ripStatus === 'SENDING' || rawStatus === 'READY_TO_PRINT') {
    return 'READY_TO_PRINT';
  }
  if (rawStatus === 'RIPPING' || ripStatus === 'PROCESSING') {
    return 'RIPPING';
  }
  if (rawStatus === 'SENT_TO_RIP' || ripStatus === 'QUEUED') {
    return 'SENT_TO_RIP';
  }

  return rawStatus;
}

function deriveRipStepStatus(
  link: FileChainLinkLike,
  effectiveStatus: FileChainStatus,
  hasPrintFile: boolean,
): FileChainStepStatus {
  if (!hasPrintFile) return 'PENDING';
  if (effectiveStatus === 'FAILED') return 'FAILED';
  if (RIP_COMPLETE_STATUSES.has(effectiveStatus)) return 'COMPLETED';
  if (RIP_IN_PROGRESS_STATUSES.has(effectiveStatus)) return 'IN_PROGRESS';
  return 'PENDING';
}

function derivePrintStepStatus(
  link: FileChainLinkLike,
  effectiveStatus: FileChainStatus,
  hasPrintFile: boolean,
): FileChainStepStatus {
  if (!hasPrintFile) return 'PENDING';
  if (effectiveStatus === 'FAILED') return 'FAILED';
  if (PRINT_COMPLETE_STATUSES.has(effectiveStatus)) return 'COMPLETED';
  if (PRINT_IN_PROGRESS_STATUSES.has(effectiveStatus)) return 'IN_PROGRESS';
  if (link.printStartedAt || link.ripJob?.printStartedAt) return 'IN_PROGRESS';
  return 'PENDING';
}

function deriveCutStepStatus(
  link: FileChainLinkLike,
  effectiveStatus: FileChainStatus,
  hasCutFile: boolean,
): FileChainStepStatus {
  if (!hasCutFile) return 'PENDING';
  if (effectiveStatus === 'FAILED') return 'FAILED';
  if (CUT_COMPLETE_STATUSES.has(effectiveStatus)) return 'COMPLETED';
  if (CUT_IN_PROGRESS_STATUSES.has(effectiveStatus)) return 'IN_PROGRESS';
  return 'PENDING';
}

export function deriveFileChainLinkState(link: FileChainLinkLike): FileChainLinkState {
  const hasPrintFile = isPrintFileName(link.printFileName) || isPrintFileName(link.printFilePath);
  const hasCutFile = isCutFileName(link.cutFileName) || isCutFileName(link.cutFilePath);
  const effectiveStatus = deriveEffectiveStatus(link, hasPrintFile, hasCutFile);
  const rippedAt = chooseTime(link.ripJob?.rippedAt, link.ripJob?.printStartedAt);
  const printedAt = chooseTime(link.printCompletedAt, link.ripJob?.printCompletedAt, link.printStartedAt, link.ripJob?.printStartedAt);
  const cutAt = chooseTime(link.cutStartedAt, link.cutCompletedAt);
  const cutCompletedAt = chooseTime(link.cutCompletedAt);

  return {
    effectiveStatus,
    ripStatus: deriveRipStepStatus(link, effectiveStatus, hasPrintFile),
    printStatus: derivePrintStepStatus(link, effectiveStatus, hasPrintFile),
    cutStatus: deriveCutStepStatus(link, effectiveStatus, hasCutFile),
    hasPrintFile,
    hasCutFile,
    rippedAt,
    printedAt,
    cutAt,
    cutCompletedAt,
  };
}

export function summarizeFileChainLinks(links: FileChainLinkLike[]) {
  const states = links.map((link) => deriveFileChainLinkState(link));
  const summaryStates = states.some((state) => POST_READY_STATUSES.has(state.effectiveStatus))
    ? states.filter((state) => state.effectiveStatus !== 'READY_TO_PRINT')
    : states;

  const chainStatus =
    summaryStates.length > 0
      ? summaryStates.reduce((worst, state) => {
          const priority = STATUS_PRIORITY[state.effectiveStatus];
          const worstPriority = STATUS_PRIORITY[worst];
          return priority < worstPriority ? state.effectiveStatus : worst;
        }, summaryStates[0].effectiveStatus)
      : 'DESIGN';

  return {
    printComplete: states.filter((state) => state.hasPrintFile && state.printStatus === 'COMPLETED').length,
    cutComplete: states.filter((state) => state.hasCutFile && state.cutStatus === 'COMPLETED').length,
    chainStatus,
  };
}

export function summarizeFileChainCompletion(entries: FileChainCompletionInput[]): FileChainTraceSummary {
  const states = entries.map((entry) =>
    'hasPrintFile' in entry || 'hasCutFile' in entry
      ? {
          effectiveStatus: entry.effectiveStatus,
          hasPrintFile: Boolean(entry.hasPrintFile),
          hasCutFile: Boolean(entry.hasCutFile),
        }
      : deriveFileChainLinkState(entry as FileChainLinkLike),
  );
  const hasPrinted = states.some((state) => state.hasPrintFile && TRACE_PRINTED_STATUSES.has(state.effectiveStatus));
  const hasCut = states.some((state) => state.hasCutFile && TRACE_CUT_STATUSES.has(state.effectiveStatus));

  return {
    hasPrinted,
    hasCut,
    status: states.length > 0
      ? hasPrinted
        ? hasCut
          ? 'PRINTED_AND_CUT'
          : 'PRINTED_NOT_CUT'
        : 'NOT_PRINTED'
      : 'NOT_FOUND',
  };
}

export function summarizeFileChainTrace(links: FileChainLinkLike[]): FileChainTraceSummary {
  const states = links.map((link) => deriveFileChainLinkState(link));
  return summarizeFileChainCompletion(states);
}
