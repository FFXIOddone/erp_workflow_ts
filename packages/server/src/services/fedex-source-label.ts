type FedExSourceLabelData = {
  sourceBaseUrl?: string | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function pickString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value !== 'string') {
      continue;
    }

    const trimmed = value.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return null;
}

function resolveFedExApiEnvironment(rawData: FedExSourceLabelData): 'Sandbox' | 'Production' | 'Live' {
  const baseUrl = rawData.sourceBaseUrl?.trim().toLowerCase() ?? '';
  if (baseUrl.includes('apis-sandbox.fedex.com')) {
    return 'Sandbox';
  }

  if (baseUrl.includes('apis.fedex.com')) {
    return 'Production';
  }

  return 'Live';
}

export function resolveFedExShipmentSourceLabel(
  rawData: unknown,
  sourceFileName: string | null,
  sourceFilePath: string | null = null
): string | null {
  const sourceName = sourceFileName?.trim() ?? '';
  const sourcePath = sourceFilePath?.trim().toLowerCase() ?? '';
  const record = asRecord(rawData);
  const baseUrl = pickString(record, ['sourceBaseUrl']);

  const looksLikeApiSource =
    sourceName.toLowerCase().startsWith('fedex_api') ||
    sourcePath.includes('apis.fedex.com') ||
    sourcePath.includes('apis-sandbox.fedex.com') ||
    (baseUrl?.toLowerCase().includes('apis.fedex.com') ?? false) ||
    (baseUrl?.toLowerCase().includes('apis-sandbox.fedex.com') ?? false);

  if (!looksLikeApiSource) {
    return sourceName || null;
  }

  return `FedEx API (${resolveFedExApiEnvironment({ sourceBaseUrl: baseUrl ?? null })})`;
}
