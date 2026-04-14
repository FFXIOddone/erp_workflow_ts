import { describe, expect, it } from 'vitest';
import {
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

  it('keeps the Fiery media mapping separate from the physical substrate name', () => {
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
    ).toBe('60 inch Web');
  });

  it('treats Any as a wildcard in the media mapping table', () => {
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

    expect(mapping?.ripMedia).toBe('60 inch Web');
    expect(mapping?.label).toBe('Oppboga Wide - Fast 4');
  });

  it('defaults the RIP media mapping to the known Fiery media mapping name', () => {
    expect(getEffectiveVutekSettings().ripMedia).toBe('60 inch Web');
  });
});
