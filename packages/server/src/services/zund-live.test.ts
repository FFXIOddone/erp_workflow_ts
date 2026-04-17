import { describe, expect, it } from 'vitest';
import { buildZundQueueSnapshot, type ZundQueueFile } from './zund-live.js';

describe('zund queue snapshot', () => {
  it('builds reusable lookup sets from one queue file set', () => {
    const files = [
      {
        fileName: 'Example Job_0DGPMDD2632.zcc',
        fullPath: 'C:/queue/Example Job_0DGPMDD2632.zcc',
        size: 1200,
        modified: new Date('2026-04-17T08:00:00.000Z'),
        status: 'queued',
        zccData: {
          jobName: 'Example Job_0DGPMDD2632',
          material: 'Vinyl',
          creationDate: '2026-04-17T07:55:00.000Z',
          orderId: 'WO64524',
        },
        busyInfo: null,
      },
      {
        fileName: 'Second Job.zcc',
        fullPath: 'C:/queue/Second Job.zcc',
        size: 1400,
        modified: new Date('2026-04-17T08:05:00.000Z'),
        status: 'completed',
        zccData: {
          jobName: 'Second Job',
          material: 'Corrugated Plastic',
          creationDate: '2026-04-17T08:00:00.000Z',
          orderId: null,
        },
        busyInfo: null,
      },
    ] as ZundQueueFile[];

    const snapshot = buildZundQueueSnapshot(files, 2);

    expect(snapshot.files).toHaveLength(2);
    expect(snapshot.scannedLimit).toBe(2);
    expect(Array.from(snapshot.fileNames)).toEqual([
      'Example Job_0DGPMDD2632.zcc',
      'Second Job.zcc',
    ]);
    expect(Array.from(snapshot.normalizedNames)).toEqual([
      'example job',
      'second job',
    ]);
    expect(Array.from(snapshot.cutIds)).toEqual(['0dgpmdd2632']);
  });
});
