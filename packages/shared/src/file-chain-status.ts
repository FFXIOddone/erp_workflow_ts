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
  rippedAt: Date | string | null;
  printedAt: Date | string | null;
  cutAt: Date | string | null;
  cutCompletedAt: Date | string | null;
};

export type FileChainLinkView<T extends FileChainLinkLike = FileChainLinkLike> = T & FileChainLinkState;

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

const CUT_IN_PROGRESS_STATUSES = new Set<FileChainStatus>(['CUT_PENDING', 'CUTTING']);

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

function deriveEffectiveStatus(link: FileChainLinkLike): FileChainStatus {
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
  if (cutCompletedAt || rawStatus === 'CUT_COMPLETE') {
    return 'FINISHED';
  }
  if (cutStartedAt || rawStatus === 'CUTTING') {
    return 'CUTTING';
  }
  if (printCompletedAt || ripStatus === 'PRINTED' || ripStatus === 'COMPLETED' || rawStatus === 'PRINTED') {
    if (cutStartedAt || link.cutFileName || rawStatus === 'CUT_PENDING') {
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

function deriveRipStepStatus(link: FileChainLinkLike, effectiveStatus: FileChainStatus): FileChainStepStatus {
  if (effectiveStatus === 'FAILED') return 'FAILED';
  if (RIP_COMPLETE_STATUSES.has(effectiveStatus)) return 'COMPLETED';
  if (RIP_IN_PROGRESS_STATUSES.has(effectiveStatus)) return 'IN_PROGRESS';
  return 'PENDING';
}

function derivePrintStepStatus(link: FileChainLinkLike, effectiveStatus: FileChainStatus): FileChainStepStatus {
  if (effectiveStatus === 'FAILED') return 'FAILED';
  if (PRINT_COMPLETE_STATUSES.has(effectiveStatus)) return 'COMPLETED';
  if (PRINT_IN_PROGRESS_STATUSES.has(effectiveStatus)) return 'IN_PROGRESS';
  if (link.printStartedAt || link.ripJob?.printStartedAt) return 'IN_PROGRESS';
  return 'PENDING';
}

function deriveCutStepStatus(link: FileChainLinkLike, effectiveStatus: FileChainStatus): FileChainStepStatus {
  if (effectiveStatus === 'FAILED') return 'FAILED';
  if (CUT_COMPLETE_STATUSES.has(effectiveStatus)) return 'COMPLETED';
  if (CUT_IN_PROGRESS_STATUSES.has(effectiveStatus)) return 'IN_PROGRESS';
  if (link.cutFilePath || link.cutFileName) return 'IN_PROGRESS';
  return 'PENDING';
}

export function deriveFileChainLinkState(link: FileChainLinkLike): FileChainLinkState {
  const effectiveStatus = deriveEffectiveStatus(link);
  const rippedAt = chooseTime(link.ripJob?.rippedAt, link.ripJob?.printStartedAt);
  const printedAt = chooseTime(link.printCompletedAt, link.ripJob?.printCompletedAt, link.printStartedAt, link.ripJob?.printStartedAt);
  const cutAt = chooseTime(link.cutStartedAt, link.cutCompletedAt);
  const cutCompletedAt = chooseTime(link.cutCompletedAt);

  return {
    effectiveStatus,
    ripStatus: deriveRipStepStatus(link, effectiveStatus),
    printStatus: derivePrintStepStatus(link, effectiveStatus),
    cutStatus: deriveCutStepStatus(link, effectiveStatus),
    rippedAt,
    printedAt,
    cutAt,
    cutCompletedAt,
  };
}

export function summarizeFileChainLinks(links: FileChainLinkLike[]) {
  const states = links.map((link) => deriveFileChainLinkState(link));

  const chainStatus =
    states.length > 0
      ? states.reduce((worst, state) => {
          const priority = STATUS_PRIORITY[state.effectiveStatus];
          const worstPriority = STATUS_PRIORITY[worst];
          return priority < worstPriority ? state.effectiveStatus : worst;
        }, states[0].effectiveStatus)
      : 'DESIGN';

  return {
    printComplete: states.filter((state) => state.printStatus === 'COMPLETED').length,
    cutComplete: states.filter((state) => state.cutStatus === 'COMPLETED').length,
    chainStatus,
  };
}
