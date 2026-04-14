export interface FieryMediaMappingEntry {
  label: string;
  substrate?: string;
  ripMedia: string;
  inkType?: string;
  mediaName?: string;
  resolution?: string;
  dotSize?: string;
  colorMode?: string;
  printMode?: string;
  halftoneMode?: string;
  profileType?: string;
  resultingCalibration?: string;
  icc?: string;
  mediaType?: string;
  notes?: string;
}

function normalizeFieryField(value: string | null | undefined): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^any$/i.test(trimmed)) return undefined;
  return trimmed;
}

function fieldsMatch(candidate: string | null | undefined, expected: string | null | undefined): boolean {
  const normalizedCandidate = normalizeFieryField(candidate);
  const normalizedExpected = normalizeFieryField(expected);
  if (!normalizedCandidate || !normalizedExpected) return true;
  return normalizedCandidate.toLowerCase() === normalizedExpected.toLowerCase();
}

export const FIERY_MEDIA_MAPPINGS: readonly FieryMediaMappingEntry[] = [
  {
    label: 'Oppboga Wide - Fast 4',
    substrate: 'Oppboga Wide - Fast 4',
    ripMedia: '60 inch Web',
    inkType: 'EFI GSLX Pro',
    mediaName: 'Any',
    resolution: 'Any',
    dotSize: 'Any',
    colorMode: 'Any',
    printMode: 'Any',
    halftoneMode: 'Any',
    profileType: 'Any',
    mediaType: 'Default',
    resultingCalibration: 'VUTEK_32h_1000_F4_GSLX-ink_default_081619.epl',
    icc: 'VUTEK_32h_1000_F4_GSLX-ink_default_081619.icc',
    notes: 'Verified on real Jimmy Dean smoke jobs; keep the RIP-side mapping separate from the physical substrate.',
  },
  {
    label: '3M 8518',
    substrate: '3M 8518',
    ripMedia: '3M 8518',
    inkType: 'EFI GSLX Pro',
    mediaName: 'Any',
    resolution: 'Any',
    dotSize: 'Any',
    colorMode: 'Any',
    printMode: 'Any',
    halftoneMode: 'Any',
    profileType: 'Any',
    mediaType: 'Default',
    notes: 'Verified on live ERP smoke submissions; the RIP media mapping matches the substrate name.',
  },
  {
    label: 'Wildcard fallback',
    ripMedia: '60 inch Web',
    inkType: 'EFI GSLX Pro',
    mediaName: 'Any',
    resolution: 'Any',
    dotSize: 'Any',
    colorMode: 'Any',
    printMode: 'Any',
    halftoneMode: 'Any',
    profileType: 'Any',
    mediaType: 'Default',
    notes: 'Fallback when the job does not declare a substrate or explicit RIP mapping. This is a wildcard row, not a literal Any value.',
  },
];

export function findFieryMediaMapping(criteria: Partial<FieryMediaMappingEntry>): FieryMediaMappingEntry | undefined {
  return FIERY_MEDIA_MAPPINGS.find((entry) =>
    fieldsMatch(entry.substrate, criteria.substrate) &&
    fieldsMatch(entry.inkType, criteria.inkType) &&
    fieldsMatch(entry.mediaName, criteria.mediaName) &&
    fieldsMatch(entry.resolution, criteria.resolution) &&
    fieldsMatch(entry.dotSize, criteria.dotSize) &&
    fieldsMatch(entry.colorMode, criteria.colorMode) &&
    fieldsMatch(entry.printMode, criteria.printMode) &&
    fieldsMatch(entry.halftoneMode, criteria.halftoneMode) &&
    fieldsMatch(entry.profileType, criteria.profileType)
  );
}

export function normalizeFieryMediaName(value: string | null | undefined): string | undefined {
  return normalizeFieryField(value);
}
