import { describe, expect, it } from 'vitest';
import { buildFieryConnectionHealth } from './fiery-connection-health.js';

describe('buildFieryConnectionHealth', () => {
  it('surfaces a file share failure first', () => {
    const health = buildFieryConnectionHealth({
      share: { accessible: false, writable: false, error: 'Share not accessible' },
      queue: { status: 'Running', queueSize: 0, raw: null },
      workflow: { outputChannelName: 'Zund G7', discoveredWorkflows: ['Zund G7'], discoveryError: null },
    });

    expect(health).toEqual({
      issue: true,
      stageKey: 'share',
      stageLabel: 'File Share',
      message: 'Share not accessible',
    });
  });

  it('surfaces the first incomplete Fiery job stage when the infrastructure is healthy', () => {
    const health = buildFieryConnectionHealth({
      share: { accessible: true, writable: true, error: null },
      queue: { status: 'Running', queueSize: 0, raw: null },
      workflow: { outputChannelName: 'Zund G7', discoveredWorkflows: ['Zund G7'], discoveryError: null },
      latestJob: {
        stages: [
          { key: 'submitted', label: 'Submitted', complete: true },
          { key: 'downloaded', label: 'Downloaded', complete: false },
          { key: 'processed', label: 'Processed', complete: false },
        ],
      },
    });

    expect(health).toEqual({
      issue: false,
      stageKey: 'downloaded',
      stageLabel: 'Downloaded',
      message: 'Latest job waiting on downloaded',
    });
  });

  it('returns a healthy result when all stages are complete', () => {
    const health = buildFieryConnectionHealth({
      share: { accessible: true, writable: true, error: null },
      queue: { status: 'Running', queueSize: 0, raw: null },
      workflow: { outputChannelName: 'Zund G7', discoveredWorkflows: ['Zund G7'], discoveryError: null },
      latestJob: {
        stages: [
          { key: 'submitted', label: 'Submitted', complete: true },
          { key: 'downloaded', label: 'Downloaded', complete: true },
          { key: 'processed', label: 'Processed', complete: true },
          { key: 'printed', label: 'Printed', complete: true },
        ],
      },
    });

    expect(health).toEqual({
      issue: false,
      stageKey: null,
      stageLabel: 'Healthy',
      message: 'Fiery connection looks healthy',
    });
  });
});
