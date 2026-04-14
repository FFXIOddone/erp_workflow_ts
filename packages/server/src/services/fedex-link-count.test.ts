import { describe, expect, it } from 'vitest';
import { resolveFedExLinkedWorkOrderCount, resolveFedExShipmentCounts } from './fedex-link-count.js';

describe('resolveFedExLinkedWorkOrderCount', () => {
  it('counts distinct linked work orders once', () => {
    expect(resolveFedExLinkedWorkOrderCount(new Set(['WO1', 'WO2', 'WO2']))).toBe(2);
  });
});

describe('resolveFedExShipmentCounts', () => {
  it('returns the same shared count for list and detail consumers', () => {
    expect(resolveFedExShipmentCounts(new Set(['WO1', 'WO2']))).toEqual({
      workOrderCount: 2,
      linkedWorkOrderCount: 2,
    });
  });
});
