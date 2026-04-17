type NormalizeListQueryInput = {
  page?: unknown;
  pageSize?: unknown;
  limit?: unknown;
  search?: unknown;
  defaultPageSize?: number;
  maxPageSize?: number;
};

type NormalizeListQueryResult = {
  page: number;
  pageSize: number;
  search?: string;
};

type SortOrder = 'asc' | 'desc';

function coercePositiveInteger(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return Math.floor(parsed);
}

export function normalizeListQuery(input: NormalizeListQueryInput): NormalizeListQueryResult {
  const page = coercePositiveInteger(input.page) ?? 1;
  const requestedPageSize =
    coercePositiveInteger(input.limit) ??
    coercePositiveInteger(input.pageSize) ??
    input.defaultPageSize ??
    25;
  const maxPageSize = input.maxPageSize;
  const pageSize =
    typeof maxPageSize === 'number' && Number.isFinite(maxPageSize) && maxPageSize > 0
      ? Math.min(requestedPageSize, maxPageSize)
      : requestedPageSize;
  const search = typeof input.search === 'string' ? input.search.trim() : '';

  return {
    page,
    pageSize,
    search: search || undefined,
  };
}

export function buildListOrderBy(sortBy: string, sortOrder: SortOrder): Record<string, SortOrder> {
  return { [sortBy]: sortOrder };
}

export function buildCursorOrderBy(
  sortBy: string,
  sortOrder: SortOrder,
): Array<Record<string, SortOrder>> {
  return [{ [sortBy]: sortOrder }, { id: sortOrder }];
}
