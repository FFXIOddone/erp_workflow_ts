import { describe, expect, it } from 'vitest';
import { repairMissingCutId } from './file-chain-cut-id.js';

describe('repairMissingCutId', () => {
  it('uses an existing cutId when present', () => {
    expect(repairMissingCutId({ cutId: '  ABC123  ' })).toBe('ABC123');
  });

  it('derives the cut id from print and cut file names when missing', () => {
    expect(
      repairMissingCutId({
        printFileName: '48x3 Logo Graphic-PRINTANDCUT_1Y3BLT1253V.pdf',
        cutFileName: '48x3 Logo Graphic-PRINTANDCUT_1Y3BLT1253V.zcc',
      }),
    ).toBe('1Y3BLT1253V');
  });

  it('falls back to job and file names for cut-only rows', () => {
    expect(
      repairMissingCutId({
        jobName: 'ZUND_JOB_P1_T1_162_57_33277349',
        fileName: 'ZUND_JOB_P1_T1_162_57_33277349.zcc',
      }),
    ).toBe('P1_T1_162_57_33277349');
  });
});
