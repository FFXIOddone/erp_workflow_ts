import { describe, expect, it } from 'vitest';
import { scoreSearchText, parseSearchQuery } from '@erp/shared';
import { buildTokenizedSearchWhere } from './fuzzy-search.js';

describe('search query parsing', () => {
  it('keeps quoted phrases exact and preserves exclusions', () => {
    expect(parseSearchQuery('blue "red sign" -draft')).toEqual([
      { value: 'blue', exact: false, excluded: false },
      { value: 'red sign', exact: true, excluded: false },
      { value: 'draft', exact: false, excluded: true },
    ]);
  });
});

describe('search scoring', () => {
  it('treats quoted phrases as exact matches', () => {
    expect(scoreSearchText('Large red sign banner', '"red sign"')).toBeGreaterThan(0);
    expect(scoreSearchText('Large red banner sign', '"red sign"')).toBe(0);
  });

  it('supports simple exclusions', () => {
    expect(scoreSearchText('Large red sign banner', 'red -banner')).toBe(0);
    expect(scoreSearchText('Large red sign banner', 'red -draft')).toBeGreaterThan(0);
  });
});

describe('server search where builder', () => {
  it('builds exact and exclusion clauses for quoted search terms', () => {
    expect(buildTokenizedSearchWhere('"red sign" -draft', ['description'])).toEqual({
      AND: [
        {
          OR: [
            { description: { contains: 'red sign', mode: 'insensitive' } },
          ],
        },
        {
          NOT: {
            OR: [
              { description: { contains: 'draft', mode: 'insensitive' } },
            ],
          },
        },
      ],
    });
  });
});
