import { describe, expect, it } from 'vitest';
import {
  buildFierySearchTerms,
  extractFieryWorkOrderContext,
  normalizeFieryJobName,
  normalizeFieryWorkOrderNumber,
} from './fiery-job-identity.js';

describe('normalizeFieryJobName', () => {
  it('strips Fiery suffixes and normalizes spacing', () => {
    expect(normalizeFieryJobName('WSTC-02_Unleaded_Regular_Tank_Collar_PRINTANDCUT.rtl_101')).toBe(
      'wstc-02_unleaded_regular_tank_collar_printandcut',
    );
    expect(normalizeFieryJobName('Job Name ~12_p1_r2_c3')).toBe('job name');
  });
});

describe('normalizeFieryWorkOrderNumber', () => {
  it('removes WO prefixes and non-digits', () => {
    expect(normalizeFieryWorkOrderNumber('WO-64586')).toBe('64586');
    expect(normalizeFieryWorkOrderNumber('wo 64487')).toBe('64487');
  });
});

describe('extractFieryWorkOrderContext', () => {
  it('extracts a work order and customer from a Safari-style Thrive path', () => {
    expect(
      extractFieryWorkOrderContext(
        '\\\\wildesigns-fs1\\Company Files\\Safari\\Customer Name\\WO64586_job\\PRINT\\file.pdf',
      ),
    ).toEqual({
      workOrderNumber: 'WO64586',
      customerName: 'Customer Name',
    });
  });

  it('extracts a work order and customer from a drive-letter Thrive path', () => {
    expect(extractFieryWorkOrderContext('S:\\Customer Name\\WO64487_job\\PRINT\\file.pdf')).toEqual(
      {
        workOrderNumber: 'WO64487',
        customerName: 'Customer Name',
      },
    );
  });
});

describe('buildFierySearchTerms', () => {
  it('returns the first meaningful long search terms from a Fiery job name', () => {
    expect(buildFierySearchTerms('WSTC-02_Unleaded_Regular_Tank_Collar_PRINTANDCUT')).toEqual([
      'Unleaded',
      'Regular',
    ]);
  });
});
