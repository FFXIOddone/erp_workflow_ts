import { describe, expect, it } from 'vitest';
import { formatLinkedFileChainSummary, selectFileChainSummaryLinks } from './file-chain.js';

describe('formatLinkedFileChainSummary', () => {
  it('reuses the same file-chain source for counts and row summaries', () => {
    const summary = formatLinkedFileChainSummary({
      totalFiles: 4,
      printCutFiles: 2,
      linked: 3,
      unlinked: 1,
      printComplete: 2,
      cutComplete: 1,
      chainStatus: 'PRINTED',
      links: [
        {
          id: '1',
          printFileName: 'alpha.pdf',
          cutFileName: 'alpha.zcc',
          status: 'PRINTED',
          effectiveStatus: 'PRINTED',
          printStatus: 'COMPLETED',
          cutStatus: 'PENDING',
          rippedAt: null,
          printedAt: '2026-04-15T08:00:00.000Z',
          cutAt: null,
          cutCompletedAt: null,
        },
        {
          id: '2',
          printFileName: 'beta.pdf',
          cutFileName: null,
          status: 'SENT_TO_RIP',
          effectiveStatus: 'SENT_TO_RIP',
          printStatus: 'PENDING',
          cutStatus: 'PENDING',
          rippedAt: null,
          printedAt: null,
          cutAt: null,
          cutCompletedAt: null,
        },
      ],
    } as any);

    expect(summary.fileChainSummary).toEqual({
      totalFiles: 4,
      printCutFiles: 2,
      linked: 3,
      unlinked: 1,
      printComplete: 2,
      cutComplete: 1,
      chainStatus: 'PRINTED',
    });
    expect(summary.fileChainLinks).toHaveLength(2);
    expect(summary.latestFileChainLinks).toHaveLength(2);
    expect(summary.latestFileChainLinks[0]).toMatchObject({
      id: '1',
      status: 'PRINTED',
      printStatus: 'COMPLETED',
    });
  });

  it('drops pure placeholder rows from summary counters', () => {
    const filtered = selectFileChainSummaryLinks([
      {
        status: 'DESIGN',
        linkConfidence: 'NONE',
        hasPrintFile: false,
        hasCutFile: false,
      },
      {
        status: 'PRINTED',
        linkConfidence: 'EXACT',
        hasPrintFile: true,
        hasCutFile: true,
      },
    ] as any);

    expect(filtered).toHaveLength(1);
    expect(filtered[0]).toMatchObject({
      status: 'PRINTED',
      linkConfidence: 'EXACT',
    });
  });

  it('does not let a stale READY_TO_PRINT row dominate once a later print state exists', () => {
    const summary = formatLinkedFileChainSummary({
      totalFiles: 2,
      printCutFiles: 1,
      linked: 2,
      unlinked: 0,
      printComplete: 1,
      cutComplete: 0,
      chainStatus: 'PRINTED',
      links: [
        {
          id: '1',
          printFileName: 'alpha.pdf',
          cutFileName: null,
          status: 'READY_TO_PRINT',
          effectiveStatus: 'READY_TO_PRINT',
          printStatus: 'COMPLETED',
          cutStatus: 'PENDING',
          rippedAt: null,
          printedAt: '2026-04-15T08:00:00.000Z',
          cutAt: null,
          cutCompletedAt: null,
        },
        {
          id: '2',
          printFileName: 'beta.pdf',
          cutFileName: null,
          status: 'PRINTED',
          effectiveStatus: 'PRINTED',
          printStatus: 'COMPLETED',
          cutStatus: 'PENDING',
          rippedAt: null,
          printedAt: '2026-04-15T09:00:00.000Z',
          cutAt: null,
          cutCompletedAt: null,
        },
      ],
    } as any);

    expect(summary.fileChainSummary?.chainStatus).toBe('PRINTED');
  });
});
