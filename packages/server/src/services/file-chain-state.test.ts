import { describe, expect, it } from 'vitest';
import { deriveFileChainLinkState, summarizeFileChainLinks } from './file-chain-state.js';

describe('file chain state normalization', () => {
  it('treats timestamped print and cut progress as complete even when the raw chain status is stale', () => {
    const state = deriveFileChainLinkState({
      status: 'READY_TO_PRINT',
      printFilePath: '\\\\server\\design\\file.pdf',
      printCompletedAt: '2026-04-06T10:00:00.000Z',
      cutFileName: 'file.zcc',
      cutFilePath: '\\\\server\\cut\\file.zcc',
      cutStartedAt: '2026-04-06T10:05:00.000Z',
      cutCompletedAt: '2026-04-06T10:08:00.000Z',
      ripJob: {
        status: 'PRINTED',
        rippedAt: '2026-04-06T09:55:00.000Z',
        printStartedAt: '2026-04-06T09:58:00.000Z',
        printCompletedAt: '2026-04-06T10:00:00.000Z',
      },
    });

    expect(state).toMatchObject({
      effectiveStatus: 'FINISHED',
      ripStatus: 'COMPLETED',
      printStatus: 'COMPLETED',
      cutStatus: 'COMPLETED',
      rippedAt: '2026-04-06T09:55:00.000Z',
      printedAt: '2026-04-06T10:00:00.000Z',
      cutAt: '2026-04-06T10:05:00.000Z',
      cutCompletedAt: '2026-04-06T10:08:00.000Z',
    });
  });

  it('keeps a rip job that is still printing in the in-progress state', () => {
    const state = deriveFileChainLinkState({
      status: 'PRINTING',
      printStartedAt: '2026-04-06T11:00:00.000Z',
      ripJob: {
        status: 'PRINTING',
        rippedAt: '2026-04-06T10:45:00.000Z',
        printStartedAt: '2026-04-06T11:00:00.000Z',
      },
    });

    expect(state).toMatchObject({
      effectiveStatus: 'PRINTING',
      ripStatus: 'COMPLETED',
      printStatus: 'IN_PROGRESS',
      cutStatus: 'PENDING',
      rippedAt: '2026-04-06T10:45:00.000Z',
      printedAt: '2026-04-06T11:00:00.000Z',
    });
  });

  it('summarizes completed links from derived states', () => {
    const summary = summarizeFileChainLinks([
      {
        status: 'READY_TO_PRINT',
        printFilePath: '\\\\server\\design\\file.pdf',
        printCompletedAt: '2026-04-06T10:00:00.000Z',
        cutFileName: 'file.zcc',
        cutCompletedAt: '2026-04-06T10:08:00.000Z',
        ripJob: {
          status: 'PRINTED',
          rippedAt: '2026-04-06T09:55:00.000Z',
        },
      },
      {
        status: 'SENT_TO_RIP',
        printFilePath: '\\\\server\\design\\file-2.pdf',
        ripJob: {
          status: 'PROCESSING',
        },
      },
    ]);

    expect(summary).toMatchObject({
      printComplete: 1,
      cutComplete: 1,
      chainStatus: 'RIPPING',
    });
  });
});
