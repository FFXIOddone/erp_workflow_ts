import path from 'path';
import { extractCutId } from './zund-match.js';

export type FileChainCutIdCandidate = {
  cutId?: string | null;
  printFileName?: string | null;
  printFilePath?: string | null;
  cutFileName?: string | null;
  cutFilePath?: string | null;
  jobName?: string | null;
  fileName?: string | null;
};

function normalizeCutId(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : null;
}

function extractCutIdFromPath(filePath: string | null | undefined): string | null {
  if (!filePath) return null;
  return extractCutId(path.basename(filePath));
}

export function repairMissingCutId(input: FileChainCutIdCandidate): string | null {
  return (
    normalizeCutId(input.cutId) ||
    extractCutId(input.printFileName || '') ||
    extractCutIdFromPath(input.printFilePath) ||
    extractCutId(input.cutFileName || '') ||
    extractCutIdFromPath(input.cutFilePath) ||
    extractCutId(input.jobName || '') ||
    extractCutId(input.fileName || '')
  );
}
