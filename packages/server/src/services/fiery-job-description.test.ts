import { describe, expect, it } from 'vitest';
import { resolveFieryJobDescription } from './fiery-job-description.js';

describe('resolveFieryJobDescription', () => {
  it('prefers the work order description when present', () => {
    expect(
      resolveFieryJobDescription({
        workOrderDescription: 'Work order description',
        notes: 'Fallback notes',
      }),
    ).toBe('Work order description');
  });

  it('falls back to notes when the work order description is blank', () => {
    expect(
      resolveFieryJobDescription({
        workOrderDescription: '   ',
        notes: 'Fallback notes',
      }),
    ).toBe('Fallback notes');
  });

  it('returns null when neither source has usable text', () => {
    expect(
      resolveFieryJobDescription({
        workOrderDescription: null,
        notes: '   ',
      }),
    ).toBeNull();
  });
});
