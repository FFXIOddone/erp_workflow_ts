import { describe, expect, it } from 'vitest';
import {
  findFieryMediaMapping,
  normalizeFieryMediaLookupCriteria,
} from './fiery-media-map.js';

describe('normalizeFieryMediaLookupCriteria', () => {
  it('treats Any as a wildcard and leaves real values intact', () => {
    expect(
      normalizeFieryMediaLookupCriteria({
        substrate: '  Any  ',
        ripMedia: '60 inch Web',
        inkType: 'EFI GSLX Pro',
        mediaName: 'Any',
        resolution: '1000 720',
        dotSize: 'Any',
        colorMode: 'CMYK',
        printMode: 'Any',
        halftoneMode: 'Any',
        profileType: 'FE',
      }),
    ).toEqual({
      substrate: undefined,
      ripMedia: '60 inch Web',
      inkType: 'EFI GSLX Pro',
      mediaName: undefined,
      resolution: '1000 720',
      dotSize: undefined,
      colorMode: 'CMYK',
      printMode: undefined,
      halftoneMode: undefined,
      profileType: 'FE',
    });
  });
});

describe('findFieryMediaMapping', () => {
  it('prefers the specific live RIP row when the lookup uses Any wildcards', () => {
    const mapping = findFieryMediaMapping({
      substrate: 'Oppboga Wide - Fast 4',
      inkType: 'EFI GSLX Pro',
      mediaName: 'Any',
      resolution: 'Any',
      dotSize: 'Any',
      colorMode: 'Any',
      printMode: 'Any',
      halftoneMode: 'Any',
      profileType: 'Any',
      mediaType: 'Default',
    });

    expect(mapping?.ripMedia).toBe('PSA CMYK 1000dpi Binary F4 SE1 FE');
    expect(mapping?.label).toBe('PSA CMYK 1000dpi Binary F4 SE1 FE');
  });
});
