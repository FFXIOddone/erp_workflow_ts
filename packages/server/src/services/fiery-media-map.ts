/**
 * Fiery media mappings are split into three separate concepts:
 * - physical substrate / stock name
 * - RIP-side media mapping name
 * - profile selector fields (ink, resolution, color mode, print mode, etc.)
 *
 * Keeping those distinct prevents the ERP from collapsing everything into one default.
 */
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

function scoreSpecificity(entry: FieryMediaMappingEntry): number {
  return [
    entry.substrate,
    entry.ripMedia,
    entry.inkType,
    entry.mediaName,
    entry.resolution,
    entry.dotSize,
    entry.colorMode,
    entry.printMode,
    entry.halftoneMode,
    entry.profileType,
    entry.resultingCalibration,
    entry.icc,
    entry.mediaType,
  ].reduce((score, value) => score + (normalizeFieryField(value) ? 1 : 0), 0);
}

export const FIERY_MEDIA_MAPPINGS: readonly FieryMediaMappingEntry[] = [
  {
    label: 'PSA CMYK 1000dpi Binary F4 SE1 FE',
    substrate: 'Oppboga Wide - Fast 4',
    ripMedia: 'PSA CMYK 1000dpi Binary F4 SE1 FE',
    inkType: 'EFI GSLX Pro',
    mediaName: 'PSA',
    resolution: '1000 720',
    dotSize: 'Binary',
    colorMode: 'CMYK',
    printMode: 'F4',
    halftoneMode: 'SE1',
    profileType: 'FE',
    mediaType: 'Default',
    resultingCalibration: 'VUTEk_32h_1000_F4_GSLX-ink_default_081619.epl',
    icc: 'VUTEk_32h_1000_F4_GSLX-ink_default_081619.icc',
    notes: 'Discovered on the live RIP box under EFI Media Profiles. Keep the RIP-side mapping separate from the physical substrate.',
  },
  {
    label: 'PSA CMYK 600dpi Binary F4 SE1 FE',
    substrate: 'Oppboga Wide - Fast 4',
    ripMedia: 'PSA CMYK 600dpi Binary F4 SE1 FE',
    inkType: 'EFI GSLX Pro',
    mediaName: 'PSA',
    resolution: '600 720',
    dotSize: 'Binary',
    colorMode: 'CMYK',
    printMode: 'F4',
    halftoneMode: 'SE1',
    profileType: 'FE',
    mediaType: 'Default',
    resultingCalibration: 'VUTEk_32h_600bin_F4_GSLX-XP_default_081319.epl',
    icc: 'VUTEk_32h_600bin_F4_GSLX-XP_default_081319.icc',
    notes: 'Discovered on the live RIP box under EFI Media Profiles. Prefer this row for 600 dpi binary jobs.',
  },
  {
    label: 'PSA CMYK 600dpi Grayscale F4 SE1 FE',
    substrate: 'Oppboga Wide - Fast 4',
    ripMedia: 'PSA CMYK 600dpi Grayscale F4 SE1 FE',
    inkType: 'EFI GSLX Pro',
    mediaName: 'PSA',
    resolution: '600 720',
    dotSize: 'Grayscale',
    colorMode: 'CMYK',
    printMode: 'F4',
    halftoneMode: 'SE1',
    profileType: 'FE',
    mediaType: 'Default',
    resultingCalibration: 'VUTEk_32h_600gs_F4_GSLX-ink_default_081319.epl',
    icc: 'VUTEk_32h_600gs_F4_GSLX-XP_default_081319.icc',
    notes: 'Discovered on the live RIP box under EFI Media Profiles. Keep after the 600 dpi binary row so the shared lookup can still prefer the binary catalog entry when only the common fields are available.',
  },
  {
    label: 'PSA CMYKcmyk 1000dpi Binary SE1 FE',
    substrate: 'Oppboga Wide - Fast 4',
    ripMedia: 'PSA CMYKcmyk 1000dpi Binary SE1 FE',
    inkType: 'EFI GSLX Pro',
    mediaName: 'PSA',
    resolution: '1000 720',
    dotSize: 'Binary',
    colorMode: 'CMYKcmyk',
    printMode: 'Any',
    halftoneMode: 'SE1',
    profileType: 'FE',
    mediaType: 'Default',
    resultingCalibration: 'VUTEk_32h_1000_8c_GSLX-XP_default_080819.epl',
    icc: 'VUTEk_32h_1000_8c_GSLX-XP_default_080819.icc',
    notes: 'Discovered on the live RIP box under EFI Media Profiles.',
  },
  {
    label: 'PSA CMYKcmyk 600dpi Binary SE1 FE',
    substrate: 'Oppboga Wide - Fast 4',
    ripMedia: 'PSA CMYKcmyk 600dpi Binary SE1 FE',
    inkType: 'EFI GSLX Pro',
    mediaName: 'PSA',
    resolution: '600 720',
    dotSize: 'Binary',
    colorMode: 'CMYKcmyk',
    printMode: 'Any',
    halftoneMode: 'SE1',
    profileType: 'FE',
    mediaType: 'Default',
    resultingCalibration: 'VUTEk_32h_600bin_8c_GSLX-XP_default_080819.epl',
    icc: 'VUTEk_32h_600bin_8c_GSLX-XP_default_080819.icc',
    notes: 'Discovered on the live RIP box under EFI Media Profiles.',
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
    resultingCalibration: 'VUTEk_32h_1000_F4_GSLX-ink_default_081619.epl',
    icc: 'VUTEk_32h_1000_F4_GSLX-ink_default_081619.icc',
    notes: 'Fallback when the job does not declare a more specific live RIP box profile. This remains a wildcard row, not a literal Any value.',
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
  let bestMatch: FieryMediaMappingEntry | undefined;
  let bestScore = -1;

  for (const entry of FIERY_MEDIA_MAPPINGS) {
    const matches =
      fieldsMatch(entry.substrate, criteria.substrate) &&
      fieldsMatch(entry.ripMedia, criteria.ripMedia) &&
      fieldsMatch(entry.inkType, criteria.inkType) &&
      fieldsMatch(entry.mediaName, criteria.mediaName) &&
      fieldsMatch(entry.resolution, criteria.resolution) &&
      fieldsMatch(entry.dotSize, criteria.dotSize) &&
      fieldsMatch(entry.colorMode, criteria.colorMode) &&
      fieldsMatch(entry.printMode, criteria.printMode) &&
      fieldsMatch(entry.halftoneMode, criteria.halftoneMode) &&
      fieldsMatch(entry.profileType, criteria.profileType);

    if (!matches) continue;

    const score = scoreSpecificity(entry);
    if (score > bestScore) {
      bestMatch = entry;
      bestScore = score;
    }
  }

  return bestMatch;
}

export function normalizeFieryMediaName(value: string | null | undefined): string | undefined {
  return normalizeFieryField(value);
}
