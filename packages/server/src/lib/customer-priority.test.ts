import { describe, expect, it } from 'vitest';
import { resolveEffectivePriority } from './customer-priority.js';

describe('resolveEffectivePriority', () => {
  it('uses order priority when there is no customer preference', () => {
    const result = resolveEffectivePriority({
      orderPriority: 4,
      customerDefaultPriority: null,
    });

    expect(result).toEqual({
      orderPriority: 4,
      customerPreferenceDefaultPriority: null,
      effectivePriority: 4,
      prioritySource: 'ORDER_PRIORITY',
    });
  });

  it('uses customer default when order priority is still at the system default', () => {
    const result = resolveEffectivePriority({
      orderPriority: 3,
      customerDefaultPriority: 5,
      systemDefaultPriority: 3,
    });

    expect(result).toEqual({
      orderPriority: 3,
      customerPreferenceDefaultPriority: 5,
      effectivePriority: 5,
      prioritySource: 'CUSTOMER_DEFAULT',
    });
  });

  it('keeps explicit order override when order priority differs from system default', () => {
    const result = resolveEffectivePriority({
      orderPriority: 2,
      customerDefaultPriority: 5,
      systemDefaultPriority: 3,
    });

    expect(result).toEqual({
      orderPriority: 2,
      customerPreferenceDefaultPriority: 5,
      effectivePriority: 2,
      prioritySource: 'ORDER_OVERRIDE',
    });
  });

  it('normalizes out-of-range values', () => {
    const result = resolveEffectivePriority({
      orderPriority: 99,
      customerDefaultPriority: -2,
      systemDefaultPriority: 3,
    });

    expect(result).toEqual({
      orderPriority: 5,
      customerPreferenceDefaultPriority: 1,
      effectivePriority: 5,
      prioritySource: 'ORDER_OVERRIDE',
    });
  });
});

