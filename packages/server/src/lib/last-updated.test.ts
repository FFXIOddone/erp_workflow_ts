import { describe, expect, it } from 'vitest';
import { createLastUpdatedDate, formatLastUpdatedFallback } from './last-updated.js';

describe('last updated fallback helpers', () => {
  it('formats the first valid timestamp candidate', () => {
    const result = formatLastUpdatedFallback(
      null,
      '2026-04-15T12:34:56.000Z',
      '2026-04-15T13:00:00.000Z',
    );

    expect(result).toBe('2026-04-15T12:34:56.000Z');
  });

  it('falls back to the current time when no candidate is valid', () => {
    const resolved = createLastUpdatedDate(null, undefined, '');
    expect(resolved).toBeInstanceOf(Date);
    expect(Number.isNaN(resolved.getTime())).toBe(false);
  });
});
