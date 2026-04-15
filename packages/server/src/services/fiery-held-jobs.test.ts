import { describe, expect, it } from 'vitest';
import { extractFieryHeldJobs } from './fiery-held-jobs.js';
import type { VUTEkQueueStatus } from './vutek.js';

describe('extractFieryHeldJobs', () => {
  it('returns held and suspended queue entries for inspection', () => {
    const queue: VUTEkQueueStatus = {
      status: 'Held',
      queueSize: 3,
      deviceId: 'device-1',
      lastQueried: '2026-04-15T11:30:00.000Z',
      entries: [
        {
          jobId: 'job-1',
          jobPartId: 'part-1',
          status: 'Running',
          priority: 1,
          submissionTime: '2026-04-15T11:00:00.000Z',
          startTime: '2026-04-15T11:01:00.000Z',
          endTime: null,
          descriptiveName: 'Active job',
        },
        {
          jobId: 'job-2',
          jobPartId: 'part-2',
          status: 'Held',
          priority: 2,
          submissionTime: '2026-04-15T11:02:00.000Z',
          startTime: null,
          endTime: null,
          descriptiveName: 'Held job',
        },
        {
          jobId: 'job-3',
          jobPartId: 'part-3',
          status: 'Suspended',
          priority: 3,
          submissionTime: '2026-04-15T11:03:00.000Z',
          startTime: null,
          endTime: null,
          descriptiveName: 'Suspended job',
        },
      ],
    };

    expect(extractFieryHeldJobs(queue)).toEqual([
      {
        jobId: 'job-2',
        jobPartId: 'part-2',
        status: 'Held',
        priority: 2,
        submissionTime: '2026-04-15T11:02:00.000Z',
        startTime: null,
        endTime: null,
        descriptiveName: 'Held job',
      },
      {
        jobId: 'job-3',
        jobPartId: 'part-3',
        status: 'Suspended',
        priority: 3,
        submissionTime: '2026-04-15T11:03:00.000Z',
        startTime: null,
        endTime: null,
        descriptiveName: 'Suspended job',
      },
    ]);
  });
});
