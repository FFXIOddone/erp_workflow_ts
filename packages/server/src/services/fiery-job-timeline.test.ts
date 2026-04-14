import { describe, expect, it } from 'vitest';
import { buildFieryJobTimelineMetrics, buildFieryJobTimelineSummary } from './fiery-job-timeline.js';

describe('buildFieryJobTimelineSummary', () => {
  it('builds the four Fiery stage timestamps and durations from job metadata', () => {
    const summary = buildFieryJobTimelineSummary({
      id: 'job-1',
      workOrderId: 'wo-1',
      sourceFileName: 'sample.pdf',
      status: 'PRINTED',
      queuedAt: new Date('2026-04-14T12:00:00.000Z'),
      rippedAt: new Date('2026-04-14T12:08:00.000Z'),
      printCompletedAt: new Date('2026-04-14T12:18:00.000Z'),
      printSettingsJson: {
        fiery: {
          downloadedAt: '2026-04-14T12:03:00.000Z',
        },
      },
      workOrder: {
        orderNumber: '64524',
        customerName: 'Pribusin',
      },
    });

    expect(summary).toEqual(
      expect.objectContaining({
        jobId: 'job-1',
        workOrderId: 'wo-1',
        orderNumber: '64524',
        customerName: 'Pribusin',
        sourceFileName: 'sample.pdf',
        status: 'PRINTED',
      })
    );

    expect(summary.stages).toEqual([
      {
        key: 'submitted',
        label: 'Submitted',
        time: '2026-04-14T12:00:00.000Z',
        durationMinutes: null,
        complete: true,
      },
      {
        key: 'downloaded',
        label: 'Downloaded',
        time: '2026-04-14T12:03:00.000Z',
        durationMinutes: 3,
        complete: true,
      },
      {
        key: 'processed',
        label: 'Processed',
        time: '2026-04-14T12:08:00.000Z',
        durationMinutes: 5,
        complete: true,
      },
      {
        key: 'printed',
        label: 'Printed',
        time: '2026-04-14T12:18:00.000Z',
        durationMinutes: 10,
        complete: true,
      },
    ]);
  });

  it('marks missing stages as pending instead of inventing timestamps', () => {
    const summary = buildFieryJobTimelineSummary({
      id: 'job-2',
      workOrderId: 'wo-2',
      sourceFileName: 'waiting.pdf',
      status: 'PROCESSING',
      queuedAt: new Date('2026-04-14T13:00:00.000Z'),
      rippedAt: null,
      printCompletedAt: null,
      printSettingsJson: {},
      workOrder: {
        orderNumber: '64525',
        customerName: 'Test Customer',
      },
    });

    expect(summary.stages[1]).toEqual(
      expect.objectContaining({
        key: 'downloaded',
        time: null,
        durationMinutes: null,
        complete: false,
      })
    );
    expect(summary.stages[2]).toEqual(
      expect.objectContaining({
        key: 'processed',
        time: null,
        durationMinutes: null,
        complete: false,
      })
    );
    expect(summary.stages[3]).toEqual(
      expect.objectContaining({
        key: 'printed',
        time: null,
        durationMinutes: null,
        complete: false,
      })
    );
  });

  it('reuses the same parsed timestamps for timing metrics', () => {
    const timing = buildFieryJobTimelineMetrics({
      id: 'job-3',
      workOrderId: 'wo-3',
      sourceFileName: 'metrics.pdf',
      status: 'PRINTED',
      queuedAt: new Date('2026-04-14T12:00:00.000Z'),
      rippedAt: new Date('2026-04-14T12:08:00.000Z'),
      printStartedAt: new Date('2026-04-14T12:10:00.000Z'),
      printCompletedAt: new Date('2026-04-14T12:18:00.000Z'),
      printSettingsJson: {
        fiery: {
          downloadedAt: '2026-04-14T12:03:00.000Z',
        },
      },
      workOrder: {
        orderNumber: '64526',
        customerName: 'Timing Customer',
      },
    });

    expect(timing).toEqual({
      queueToRipMinutes: 8,
      ripToPrintMinutes: 2,
      printMinutes: 8,
      totalMinutes: 18,
    });
  });
});
