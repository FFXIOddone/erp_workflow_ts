import { matchesSearchFields } from '@erp/shared';

type ThriveFilterOption = string | 'all';
type ZundFilterOption = string | 'all';

interface ThriveFilterableJob {
  jobName?: string;
  workOrderNumber?: string;
  customerName?: string;
  printer?: string;
  fileName?: string;
  status?: string;
}

interface ZundFilterableJob {
  jobName?: string | null;
  workOrderNumber?: string | null;
  customerName?: string | null;
  material?: string | null;
  device?: string | null;
  fileName?: string | null;
  status?: string | null;
  source?: string | null;
}

export function filterThriveLiveDataJobs<T extends ThriveFilterableJob>(
  jobs: T[],
  filters: {
    search: string;
    statusFilter: ThriveFilterOption;
    printerFilter: ThriveFilterOption;
  },
): T[] {
  const { search, statusFilter, printerFilter } = filters;

  return jobs.filter((job) => {
    if (search) {
      const searchMatches = matchesSearchFields(
        [job.jobName, job.workOrderNumber, job.customerName, job.printer, job.fileName],
        search,
      );
      if (!searchMatches) {
        return false;
      }
    }

    if (statusFilter !== 'all' && job.status !== statusFilter) {
      return false;
    }

    if (printerFilter !== 'all' && job.printer !== printerFilter) {
      return false;
    }

    return true;
  });
}

export function filterZundLiveDataJobs<T extends ZundFilterableJob>(
  jobs: T[],
  filters: {
    search: string;
    statusFilter: ZundFilterOption;
    linkedFilter: 'all' | 'linked' | 'unlinked';
    sourceFilter: ZundFilterOption;
  },
): T[] {
  const { search, statusFilter, linkedFilter, sourceFilter } = filters;

  return jobs.filter((job) => {
    if (statusFilter !== 'all' && job.status !== statusFilter) {
      return false;
    }

    if (linkedFilter === 'linked' && !job.workOrderNumber) {
      return false;
    }

    if (linkedFilter === 'unlinked' && job.workOrderNumber) {
      return false;
    }

    if (sourceFilter !== 'all' && job.source !== sourceFilter) {
      return false;
    }

    if (search.trim()) {
      const searchMatches = matchesSearchFields(
        [job.jobName, job.workOrderNumber, job.customerName, job.material, job.device, job.fileName],
        search,
      );
      if (!searchMatches) {
        return false;
      }
    }

    return true;
  });
}
