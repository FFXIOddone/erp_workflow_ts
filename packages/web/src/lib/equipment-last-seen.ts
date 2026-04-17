export function resolveEquipmentLastSeenTimestamp(
  ...candidates: Array<string | number | Date | null | undefined>
): Date | null {
  for (const candidate of candidates) {
    if (candidate == null || candidate === '') continue;

    const resolved = candidate instanceof Date ? candidate : new Date(candidate);
    if (!Number.isNaN(resolved.getTime())) {
      return resolved;
    }
  }

  return null;
}
