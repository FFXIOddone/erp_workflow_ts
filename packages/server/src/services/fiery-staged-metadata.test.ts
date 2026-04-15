import { describe, expect, it } from 'vitest';
import { buildFieryStagedMetadata, resolveFieryStagedMetadata } from './fiery-staged-metadata.js';

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

  it('builds one normalized Fiery metadata object for repair and sync writes', () => {
    const resolved = buildFieryStagedMetadata(
      {
        workflowName: '  ',
        stagedPdfPath: 'C:\\ERPJobs\\legacy-job.pdf',
        copiedFileName: '',
        customField: 'keep-me',
      },
      'Zund G7',
    );

    expect(resolved).toEqual({
      normalizedWorkflowName: 'Zund G7',
      normalizedPdfPath: 'C:\\ERPJobs\\legacy-job.pdf',
      normalizedCopiedFileName: 'legacy-job.pdf',
      shouldBackfill: true,
      normalizedFierySettings: {
        workflowName: 'Zund G7',
        stagedPdfPath: 'C:\\ERPJobs\\legacy-job.pdf',
        destinationPath: 'C:\\ERPJobs\\legacy-job.pdf',
        copiedFileName: 'legacy-job.pdf',
        customField: 'keep-me',
      },
    });
  });
});
