import type { ThriveCutJob, ThriveJob } from './thrive.js';

type ThriveWorkOrderSummary = {
  id: string;
  orderNumber: string;
  title?: string;
  status: string;
  customerName: string;
};

type ThriveLinkedWorkOrder = {
  id: string;
  orderNumber: string;
  customerName: string;
  status: string;
  companyBrand?: string;
  dueDate?: Date | null;
  description?: string | null;
  title?: string;
};

type ThriveJobLike = Partial<ThriveJob> & {
  id?: string | number;
};

type ThriveCutJobLike = Partial<ThriveCutJob> & {
  id?: string | number;
};

type ThriveLinkedJob = {
  job: ThriveJobLike;
  workOrder?: ThriveLinkedWorkOrder | null;
};

type ThriveJobIdentitySource = {
  id?: string | number;
  jobGuid?: string | null;
  guid?: string | null;
  fileName?: string | null;
  jobName?: string | null;
};

type ThriveMachineSummary = {
  id: string;
  name: string;
  ip: string;
  printers: Array<{ name: string }>;
};

type ThriveMachineResponse = {
  machine: { id: string; name: string; ip: string };
  printJobs: Array<ThriveJobLike & { workOrder?: ThriveWorkOrderSummary }>;
  cutJobs: ThriveCutJobLike[];
  summary: {
    totalPrintJobs: number;
    totalCutJobs: number;
    linkedToWorkOrders: number;
    queuedCount: number;
    completedCount: number;
    printers: string[];
  };
};

type ThriveJobsResponse = {
  printJobs: ThriveLinkedJob[];
  cutJobs: ThriveCutJobLike[];
  summary: {
    totalPrintJobs: number;
    totalCutJobs: number;
    linkedToWorkOrders: number;
    queuedCount: number;
    completedCount: number;
  };
};

const THRIVE_QUEUED_STATUSES = new Set([
  'Pending',
  'Spooling',
  'Processing',
  'RIPping',
  'Ready to Print',
  'Sending to Printer',
  'Printing',
]);

function summarizeThriveJobCounts(jobs: Array<ThriveJobLike & { workOrder?: ThriveWorkOrderSummary }>) {
  const uniqueJobs = dedupeThriveJobs(jobs);
  let queuedCount = 0;
  let completedCount = 0;

  for (const job of uniqueJobs) {
    if (job.status === 'Printed') {
      completedCount += 1;
    } else if (job.status && THRIVE_QUEUED_STATUSES.has(job.status)) {
      queuedCount += 1;
    }
  }

  return { queuedCount, completedCount };
}

function getThriveJobIdentity(job: ThriveJobIdentitySource): string | null {
  const rawIdentity =
    job.jobGuid ??
    job.guid ??
    job.id ??
    job.fileName ??
    job.jobName ??
    null;
  const identity = rawIdentity === null || rawIdentity === undefined ? '' : String(rawIdentity).trim().toLowerCase();
  return identity || null;
}

function dedupeThriveJobs<T extends ThriveJobIdentitySource>(jobs: T[]): T[] {
  const seen = new Set<string>();
  const deduped: T[] = [];

  for (const job of jobs) {
    const identity = getThriveJobIdentity(job);
    if (!identity || seen.has(identity)) continue;
    seen.add(identity);
    deduped.push(job);
  }

  return deduped;
}

function countUniqueLinkedThriveJobs(linkedJobs: ThriveLinkedJob[]): number {
  const seen = new Set<string>();
  let count = 0;

  for (const { job, workOrder } of linkedJobs) {
    if (!workOrder) continue;
    const identity = getThriveJobIdentity(job);
    if (!identity || seen.has(identity)) continue;
    seen.add(identity);
    count += 1;
  }

  return count;
}

function flattenThriveLinkedJobs(linkedJobs: ThriveLinkedJob[]): Array<ThriveJobLike & { workOrder?: ThriveWorkOrderSummary }> {
  return linkedJobs.map(({ job, workOrder }) => ({
    ...job,
    workOrder: workOrder
      ? {
          id: workOrder.id,
          orderNumber: workOrder.orderNumber,
          title: workOrder.title ?? workOrder.orderNumber,
          status: workOrder.status,
          customerName: workOrder.customerName,
        }
      : undefined,
  }));
}

export function buildThriveJobsResponse(
  printJobs: ThriveJobLike[],
  cutJobs: ThriveCutJobLike[],
  linkedJobs: ThriveLinkedJob[],
): ThriveJobsResponse {
  const uniquePrintJobs = dedupeThriveJobs(printJobs);
  const uniqueCutJobs = dedupeThriveJobs(cutJobs);
  const { queuedCount, completedCount } = summarizeThriveJobCounts(printJobs as Array<
    ThriveJobLike & { workOrder?: ThriveWorkOrderSummary }
  >);

  return {
    printJobs: linkedJobs,
    cutJobs,
    summary: {
      totalPrintJobs: uniquePrintJobs.length,
      totalCutJobs: uniqueCutJobs.length,
      linkedToWorkOrders: countUniqueLinkedThriveJobs(linkedJobs),
      queuedCount,
      completedCount,
    },
  };
}

export function buildThriveMachineResponse(
  machine: ThriveMachineSummary,
  allJobs: ThriveJobLike[],
  linkedJobs: ThriveLinkedJob[],
  cutJobs: ThriveCutJobLike[],
): ThriveMachineResponse {
  const flatPrintJobs = flattenThriveLinkedJobs(linkedJobs);
  const uniquePrintJobs = dedupeThriveJobs(allJobs);
  const uniqueCutJobs = dedupeThriveJobs(cutJobs);
  const uniqueLinkedJobs = dedupeThriveJobs(flatPrintJobs);
  const { queuedCount, completedCount } = summarizeThriveJobCounts(allJobs as Array<
    ThriveJobLike & { workOrder?: ThriveWorkOrderSummary }
  >);

  return {
    machine: { id: machine.id, name: machine.name, ip: machine.ip },
    printJobs: flatPrintJobs,
    cutJobs,
    summary: {
      totalPrintJobs: uniquePrintJobs.length,
      totalCutJobs: uniqueCutJobs.length,
      linkedToWorkOrders: uniqueLinkedJobs.filter((job) => Boolean(job.workOrder)).length,
      queuedCount,
      completedCount,
      printers: machine.printers.map((printer) => printer.name),
    },
  };
}
