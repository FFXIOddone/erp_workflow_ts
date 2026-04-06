import { describe, expect, it } from 'vitest';
import { normalizeUsername } from './username.js';

describe('normalizeUsername', () => {
  it('trims whitespace and lowercases the username', () => {
    expect(normalizeUsername('  JaKe.SMiTh  ')).toBe('jake.smith');
  });

  it('returns an empty string for blank input', () => {
    expect(normalizeUsername('   ')).toBe('');
  });
});
