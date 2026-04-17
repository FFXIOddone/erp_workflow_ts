function resolveDateFallback(...candidates: Array<Date | string | number | null | undefined>): Date {
  for (const candidate of candidates) {
    if (candidate == null || candidate === '') continue;

    const resolved = candidate instanceof Date ? candidate : new Date(candidate);
    if (!Number.isNaN(resolved.getTime())) {
      return resolved;
    }
  }

  return new Date();
}

export function formatLastUpdatedFallback(
  ...candidates: Array<Date | string | number | null | undefined>
): string {
  return resolveDateFallback(...candidates).toISOString();
}

export function createLastUpdatedDate(
  ...candidates: Array<Date | string | number | null | undefined>
): Date {
  return resolveDateFallback(...candidates);
}
