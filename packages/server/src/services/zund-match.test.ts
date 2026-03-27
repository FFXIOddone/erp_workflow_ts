import { describe, expect, it } from 'vitest';
import { extractCutId } from './zund-match.js';

describe('extractCutId', () => {
  it('extracts CutID with underscore prefix', () => {
    expect(extractCutId('WO12345_JobName_0DGPMDD2632.pdf')).toBe('0DGPMDD2632');
    expect(extractCutId('Customer_Job_1365JIN263K.zcc')).toBe('1365JIN263K');
  });

  it('extracts CutID with dash prefix', () => {
    expect(extractCutId('JobName-0DGPMDD2632.pdf')).toBe('0DGPMDD2632');
  });

  it('extracts bare CutID when whole filename is the CutID', () => {
    expect(extractCutId('0DGPMDD2632.zcc')).toBe('0DGPMDD2632');
    expect(extractCutId('1365JIN263K')).toBe('1365JIN263K');
  });

  it('extracts Fiery format CutID', () => {
    expect(extractCutId('Job_P1_T1_162_57_33277349.pdf')).toBe('P1_T1_162_57_33277349');
  });

  it('returns null when no CutID present', () => {
    expect(extractCutId('ordinary-job-name.pdf')).toBeNull();
    expect(extractCutId('12345678')).toBeNull(); // pure numeric
    expect(extractCutId('ABCDEFGH')).toBeNull(); // pure alpha
    expect(extractCutId('')).toBeNull();
  });
});
