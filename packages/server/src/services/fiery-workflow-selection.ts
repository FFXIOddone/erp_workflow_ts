const DEFAULT_FIERY_WORKFLOW_NAME = process.env.VUTEK_OUTPUT_CHANNEL?.trim() || 'Zund G7';

function normalizeWorkflowName(value?: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

/**
 * Resolve the workflow name used for Fiery submissions.
 *
 * Preferred means an explicit user/controller choice.
 * Persisted means the saved ERP default.
 * The final fallback is the known-safe Fiery default.
 */
export function resolveFieryWorkflowSelection(
  preferred?: string | null,
  persisted?: string | null,
): string {
  return (
    normalizeWorkflowName(preferred) ||
    normalizeWorkflowName(persisted) ||
    DEFAULT_FIERY_WORKFLOW_NAME
  );
}

export function getDefaultFieryWorkflowName(): string {
  return DEFAULT_FIERY_WORKFLOW_NAME;
}
