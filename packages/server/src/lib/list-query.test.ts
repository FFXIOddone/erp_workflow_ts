import { describe, expect, it } from 'vitest';
import { buildCursorOrderBy, buildListOrderBy, normalizeListQuery } from './list-query.js';

describe('normalizeListQuery', () => {
  it('coerces page, pageSize, and search values', () => {
    expect(
      normalizeListQuery({
        page: '2',
        pageSize: '40',
        search: '  fedex  ',
      }),
    ).toEqual({
      page: 2,
      pageSize: 40,
      search: 'fedex',
    });
  });

  it('prefers limit over pageSize and respects the max page size', () => {
    expect(
      normalizeListQuery({
        page: 0,
        pageSize: 25,
        limit: '120',
        defaultPageSize: 25,
        maxPageSize: 100,
      }),
    ).toEqual({
      page: 1,
      pageSize: 100,
      search: undefined,
    });
  });

  it('builds a simple list orderBy object', () => {
    expect(buildListOrderBy('shipDate', 'desc')).toEqual({
      shipDate: 'desc',
    });
  });

  it('builds a cursor orderBy array with an id tie-breaker', () => {
    expect(buildCursorOrderBy('createdAt', 'asc')).toEqual([
      { createdAt: 'asc' },
      { id: 'asc' },
    ]);
  });
});
