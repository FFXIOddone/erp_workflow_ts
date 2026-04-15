import { describe, expect, it } from 'vitest';
import {
  buildJdf,
  getEffectiveVutekSettings,
  matchFieryWorkflowName,
  normalizeFieryJobId,
  normalizeFieryQueueEntryId,
  resolveFieryMediaMappingName,
} from './fiery-jmf.js';
import { findFieryMediaMapping } from './fiery-media-map.js';
import {
  getDefaultFieryWorkflowName,
  resolveFieryWorkflowSelection,
} from './fiery-workflow-selection.js';

describe('matchFieryWorkflowName', () => {
  it('resolves an exact case-insensitive workflow match from the discovered names', () => {
    const resolved = matchFieryWorkflowName('Zund G7', ['ZUND G7', 'Zund COFFEE BEANERY']);
    expect(resolved).toBe('ZUND G7');
  });

  it('keeps the preferred workflow when no discovered match exists', () => {
    const resolved = matchFieryWorkflowName('Custom Workflow', ['ZUND G7', 'Zund COFFEE BEANERY']);
    expect(resolved).toBe('Custom Workflow');
  });

  it('prefers the explicit workflow, then persisted workflow, then default', () => {
    expect(resolveFieryWorkflowSelection('Workflow A', 'Workflow B')).toBe('Workflow A');
    expect(resolveFieryWorkflowSelection(undefined, 'Workflow B')).toBe('Workflow B');
    expect(resolveFieryWorkflowSelection(undefined, undefined)).toBe(getDefaultFieryWorkflowName());
  });

  it('preserves queue entry id zero from Fiery', () => {
    expect(normalizeFieryJobId('0')).toBe('0');
    expect(normalizeFieryQueueEntryId('0')).toBe('0');
    expect(normalizeFieryQueueEntryId(' 0 ')).toBe('0');
    expect(normalizeFieryQueueEntryId('')).toBeUndefined();
    expect(normalizeFieryQueueEntryId(null)).toBeUndefined();
  });

  it('keeps an explicit Fiery RIP media name when present', () => {
    expect(
      resolveFieryMediaMappingName({
        media: 'Oppboga Wide - Fast 4',
        ripMedia: '60 inch Web',
        inkType: 'EFI GSLX Pro',
        mediaType: 'Paper',
        resolution: '1000 720',
        colorMode: 'CMYK',
      }),
    ).toBe('60 inch Web');
  });

  it('falls back from PSA to the mapped Fiery RIP media name', () => {
    expect(
      resolveFieryMediaMappingName({
        media: 'Oppboga Wide - Fast 4',
        ripMedia: 'PSA',
        inkType: 'EFI GSLX Pro',
        mediaType: 'Paper',
        resolution: '1000 720',
        colorMode: 'CMYK',
      }),
    ).toBe('PSA CMYK 1000dpi Binary F4 SE1 FE');
  });

  it('keeps print mode aligned with the RIP catalog row instead of copying color mode', () => {
    const settings = getEffectiveVutekSettings({
      media: 'Oppboga Wide - Fast 4',
      ripMedia: 'PSA',
      inkType: 'EFI GSLX Pro',
      mediaType: 'Paper',
      resolution: '1000 720',
      colorMode: 'CMYK',
    });

    expect(settings.ripMedia).toBe('PSA CMYK 1000dpi Binary F4 SE1 FE');
    expect(settings.printMode).toBe('F4');

    const jdf = buildJdf({
      workOrderId: '64524',
      submissionJobId: 'ERP-64524-1776176299000',
      jobTicketName: 'WO#64524',
      pdfLocalPath: 'http://example.test/jimmy_deans_blades.pdf',
      settings: {
        media: 'Oppboga Wide - Fast 4',
        ripMedia: 'PSA',
        mediaType: 'Paper',
        mediaUnit: 'Sheet',
        outputChannelName: 'Zund G7',
        mediaDimension: '6912 3456',
        colorMode: 'CMYK',
        inkType: 'EFI GSLX Pro',
        whiteInkOptions: 'Spot color WHITE_INK',
        resolution: '1000 720',
      },
    });

    expect(jdf).toContain('PrintMode="F4"');
    expect(jdf).toContain('<Feature FeatureName="ColorMode" Value="CMYK"/>');
  });

  it('treats Any as a wildcard while still preferring the most specific live RIP row', () => {
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

  it('still falls back to the broad live RIP mapping when no specific profile matches', () => {
    const mapping = findFieryMediaMapping({
      substrate: 'Custom Stock',
      inkType: 'EFI GSLX Pro',
      mediaType: 'Default',
    });

    expect(mapping?.ripMedia).toBe('60 inch Web');
  });

  it('defaults the RIP media mapping to the known Fiery media mapping name', () => {
    expect(getEffectiveVutekSettings().ripMedia).toBe('60 inch Web');
  });
});
