import { describe, expect, it } from 'vitest';
import { matchFieryWorkflowName, normalizeFieryQueueEntryId } from './fiery-jmf.js';

describe('matchFieryWorkflowName', () => {
  it('resolves an exact case-insensitive workflow match from the discovered names', () => {
    const resolved = matchFieryWorkflowName('Zund G7', ['ZUND G7', 'Zund COFFEE BEANERY']);
    expect(resolved).toBe('ZUND G7');
  });

  it('keeps the preferred workflow when no discovered match exists', () => {
    const resolved = matchFieryWorkflowName('Custom Workflow', ['ZUND G7', 'Zund COFFEE BEANERY']);
    expect(resolved).toBe('Custom Workflow');
  });

  it('preserves queue entry id zero from Fiery', () => {
    expect(normalizeFieryQueueEntryId('0')).toBe('0');
    expect(normalizeFieryQueueEntryId(' 0 ')).toBe('0');
    expect(normalizeFieryQueueEntryId('')).toBeUndefined();
    expect(normalizeFieryQueueEntryId(null)).toBeUndefined();
  });
});
