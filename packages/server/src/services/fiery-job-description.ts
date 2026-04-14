export interface FieryJobDescriptionInput {
  workOrderDescription?: string | null;
  notes?: string | null;
}

/**
 * Resolve the Fiery job description once so the RIP send path and JMF submission
 * use the exact same text source.
 */
export function resolveFieryJobDescription(
  input: FieryJobDescriptionInput,
): string | null {
  const workOrderDescription = input.workOrderDescription?.trim();
  if (workOrderDescription) return workOrderDescription;

  const notes = input.notes?.trim();
  return notes || null;
}
