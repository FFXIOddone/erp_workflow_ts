export type SearchValue = string | number | boolean | null | undefined;

export function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function splitSearchTerms(query: string): string[] {
  return normalizeSearchText(query)
    .split(' ')
    .filter(Boolean);
}

export function scoreSearchText(haystack: string, query: string): number {
  const normalizedHaystack = normalizeSearchText(haystack);
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return 1;
  }

  if (!normalizedHaystack) {
    return 0;
  }

  if (normalizedHaystack === normalizedQuery) {
    return 1000;
  }

  if (normalizedHaystack.includes(normalizedQuery)) {
    return 800 + normalizedQuery.length;
  }

  const queryTokens = normalizedQuery.split(' ').filter(Boolean);
  const haystackTokens = normalizedHaystack.split(' ').filter(Boolean);
  let score = 0;

  for (const token of queryTokens) {
    const index = haystackTokens.findIndex((haystackToken) =>
      haystackToken === token ||
      haystackToken.includes(token) ||
      token.includes(haystackToken),
    );

    if (index === -1) {
      return 0;
    }

    score += 100 - Math.min(50, index * 2);
  }

  return score;
}

export function scoreSearchFields(values: SearchValue[], query: string): number {
  const haystack = values
    .map((value) => (value === null || value === undefined ? '' : String(value)))
    .filter(Boolean)
    .join(' ');

  return scoreSearchText(haystack, query);
}

export function matchesSearchFields(values: SearchValue[], query: string): boolean {
  return scoreSearchFields(values, query) > 0;
}

export function filterBySearchFields<T>(
  items: T[],
  query: string,
  getValues: (item: T) => SearchValue[],
  options: { limit?: number; minScore?: number } = {},
): T[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return items;
  }

  const minScore = options.minScore ?? 1;
  const ranked = items
    .map((item, index) => ({
      item,
      index,
      score: scoreSearchFields(getValues(item), normalizedQuery),
    }))
    .filter(({ score }) => score >= minScore)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return a.index - b.index;
    });

  return options.limit ? ranked.slice(0, options.limit).map(({ item }) => item) : ranked.map(({ item }) => item);
}
