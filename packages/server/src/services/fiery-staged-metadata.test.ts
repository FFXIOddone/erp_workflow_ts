import { describe, expect, it } from 'vitest';
import { resolveFieryStagedMetadata } from './fiery-staged-metadata.js';

describe('resolveFieryStagedMetadata', () => {
  it('normalizes destination path and copied file name from a legacy Fiery row', () => {
    const resolved = resolveFieryStagedMetadata(
      {
        destinationPath: 'C:\\ERPJobs\\test-job.pdf',
      },
      'Zund G7',
    );

    expect(resolved).toEqual({
      normalizedWorkflowName: 'Zund G7',
      normalizedPdfPath: 'C:\\ERPJobs\\test-job.pdf',
      normalizedCopiedFileName: 'test-job.pdf',
      shouldBackfill: true,
    });
  });

  it('leaves already-normalized Fiery metadata unchanged', () => {
    const resolved = resolveFieryStagedMetadata(
      {
        workflowName: 'Zund G7',
        stagedPdfPath: 'C:\\ERPJobs\\test-job.pdf',
        destinationPath: 'C:\\ERPJobs\\test-job.pdf',
        copiedFileName: 'test-job.pdf',
      },
      'Zund G7',
    );

    expect(resolved.shouldBackfill).toBe(false);
    expect(resolved.normalizedWorkflowName).toBe('Zund G7');
  });
});
