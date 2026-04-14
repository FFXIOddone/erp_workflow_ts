import path from 'node:path';
import type { FieryDownloadFile } from './fiery.js';

function normalizeFieryDownloadName(value: string | null | undefined): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return path.basename(trimmed).toLowerCase();
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => normalizeFieryDownloadName(value))
        .filter((value): value is string => Boolean(value))
    )
  );
}

export function findMatchingFieryDownloadFile(
  downloadFiles: readonly FieryDownloadFile[],
  candidates: Array<string | null | undefined>,
): FieryDownloadFile | undefined {
  const normalizedCandidates = uniqueStrings(candidates);
  if (normalizedCandidates.length === 0) return undefined;

  return downloadFiles.find((file) => normalizedCandidates.includes(normalizeFieryDownloadName(file.fileName) ?? ''));
}
