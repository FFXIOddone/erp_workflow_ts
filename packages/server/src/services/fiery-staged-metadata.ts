function pickStringSetting(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

export interface FieryStagedMetadataInput {
  workflowName?: string | null;
  stagedPdfPath?: string | null;
  destinationPath?: string | null;
  copiedFileName?: string | null;
}

export interface FieryStagedMetadataResolution {
  normalizedWorkflowName: string;
  normalizedPdfPath: string | null;
  normalizedCopiedFileName: string | null;
  shouldBackfill: boolean;
}

export function getFieryPdfPath(fierySettings: Record<string, unknown>): string | null {
  const stagedPdfPath = pickStringSetting(fierySettings.stagedPdfPath);
  const destinationPath = pickStringSetting(fierySettings.destinationPath);
  return stagedPdfPath ?? destinationPath ?? null;
}

export function getFieryCopiedFileName(
  fierySettings: Record<string, unknown>,
  pdfPath: string | null,
): string | null {
  const copiedFileName = pickStringSetting(fierySettings.copiedFileName);
  if (copiedFileName) return copiedFileName;
  if (pdfPath) return pdfPath.split(/[\\/]/).pop() ?? null;
  const destinationPath = pickStringSetting(fierySettings.destinationPath);
  return destinationPath ? destinationPath.split(/[\\/]/).pop() ?? null : null;
}

export function resolveFieryStagedMetadata(
  fierySettings: Record<string, unknown>,
  fallbackWorkflowName: string,
): FieryStagedMetadataResolution {
  const normalizedPdfPath = getFieryPdfPath(fierySettings);
  const normalizedCopiedFileName = getFieryCopiedFileName(fierySettings, normalizedPdfPath);
  const normalizedWorkflowName = pickStringSetting(fierySettings.workflowName) ?? fallbackWorkflowName;

  const shouldBackfill =
    fierySettings.workflowName !== normalizedWorkflowName ||
    fierySettings.stagedPdfPath !== normalizedPdfPath ||
    fierySettings.destinationPath !== normalizedPdfPath ||
    fierySettings.copiedFileName !== normalizedCopiedFileName;

  return {
    normalizedWorkflowName,
    normalizedPdfPath,
    normalizedCopiedFileName,
    shouldBackfill,
  };
}
