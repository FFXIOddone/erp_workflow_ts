import type { VUTEkQueueEntry, VUTEkQueueStatus } from './vutek.js';

export interface FieryHeldJob {
  jobId: string;
  jobPartId: string;
  status: string;
  priority: number;
  submissionTime: string | null;
  startTime: string | null;
  endTime: string | null;
  descriptiveName: string | null;
}

function isHeldStatus(status: string | null | undefined): boolean {
  const normalized = status?.trim().toLowerCase();
  return normalized === 'held' || normalized === 'suspended';
}

function toFieryHeldJob(entry: VUTEkQueueEntry): FieryHeldJob {
  return {
    jobId: entry.jobId,
    jobPartId: entry.jobPartId,
    status: entry.status,
    priority: entry.priority,
    submissionTime: entry.submissionTime,
    startTime: entry.startTime,
    endTime: entry.endTime,
    descriptiveName: entry.descriptiveName,
  };
}

export function extractFieryHeldJobs(queue: VUTEkQueueStatus | null | undefined): FieryHeldJob[] {
  if (!queue?.entries?.length) return [];
  return queue.entries.filter((entry) => isHeldStatus(entry.status)).map(toFieryHeldJob);
}
