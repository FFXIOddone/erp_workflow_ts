import { splitSearchTerms } from '@erp/shared';

type SearchWhere = Record<string, unknown>;

function buildNestedContainsCondition(path: string, term: string): SearchWhere {
  const segments = path.split('.').filter(Boolean);
  let condition: SearchWhere = {
    contains: term,
    mode: 'insensitive',
  };

  for (let index = segments.length - 1; index >= 0; index -= 1) {
    condition = { [segments[index]]: condition };
  }

  return condition;
}

export function buildTokenizedSearchWhere(
  query: string | undefined,
  fields: string[],
): SearchWhere | null {
  const terms = splitSearchTerms(query || '');
  if (terms.length === 0 || fields.length === 0) {
    return null;
  }

  return {
    AND: terms.map((term) => ({
      OR: fields.map((field) => buildNestedContainsCondition(field, term)),
    })),
  };
}
