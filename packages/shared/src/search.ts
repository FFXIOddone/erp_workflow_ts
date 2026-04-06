export type SearchValue = string | number | boolean | null | undefined;

export interface SearchQueryTerm {
  value: string;
  exact: boolean;
  excluded: boolean;
}

export function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseSearchQuery(query: string): SearchQueryTerm[] {
  const rawTerms = query.match(/-?"[^"]+"|-?\S+/g) ?? [];
  const terms: SearchQueryTerm[] = [];

  for (const rawTerm of rawTerms) {
    let term = rawTerm.trim();
    if (!term) {
      continue;
    }

    let excluded = false;
    if (term.startsWith('-')) {
      excluded = true;
      term = term.slice(1);
    }

    let exact = false;
    if (term.startsWith('"') && term.endsWith('"') && term.length >= 2) {
      exact = true;
      term = term.slice(1, -1);
    }

    const normalized = normalizeSearchText(term);
    if (!normalized) {
      continue;
    }

    if (exact) {
      terms.push({ value: normalized, exact: true, excluded });
      continue;
    }

    for (const token of normalized.split(' ').filter(Boolean)) {
      terms.push({ value: token, exact: false, excluded });
    }
  }

  return terms;
}

export function splitSearchTerms(query: string): string[] {
  return parseSearchQuery(query)
    .filter((term) => !term.excluded)
    .map((term) => term.value);
}

export function scoreSearchText(haystack: string, query: string): number {
  const normalizedHaystack = normalizeSearchText(haystack);
  const parsedTerms = parseSearchQuery(query);

  if (parsedTerms.length === 0) {
    return 1;
  }

  if (!normalizedHaystack) {
    return 0;
  }

  const haystackTokens = normalizedHaystack.split(' ').filter(Boolean);
  let score = 0;
  let matchedPositiveTerm = false;

  for (const term of parsedTerms) {
    const exactPhraseIndex = normalizedHaystack.indexOf(term.value);
    if (term.excluded) {
      if (term.exact) {
        if (exactPhraseIndex >= 0) {
          return 0;
        }
        continue;
      }

      if (haystackTokens.some((haystackToken) =>
        haystackToken === term.value ||
        haystackToken.includes(term.value) ||
        term.value.includes(haystackToken),
      )) {
        return 0;
      }
      continue;
    }

    matchedPositiveTerm = true;

    if (term.exact) {
      if (exactPhraseIndex === -1) {
        return 0;
      }

      if (normalizedHaystack === term.value) {
        score += 1000;
      } else {
        score += 800 + term.value.length - Math.min(50, exactPhraseIndex);
      }
      continue;
    }

    const index = haystackTokens.findIndex((haystackToken) =>
      haystackToken === term.value ||
      haystackToken.includes(term.value) ||
      term.value.includes(haystackToken),
    );

    if (index === -1) {
      return 0;
    }

    score += 100 - Math.min(50, index * 2);
  }

  return matchedPositiveTerm ? score : 1;
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
  if (!query.trim()) {
    return items;
  }

  const minScore = options.minScore ?? 1;
  const ranked = items
    .map((item, index) => ({
      item,
      index,
      score: scoreSearchFields(getValues(item), query),
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
