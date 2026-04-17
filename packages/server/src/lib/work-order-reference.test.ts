import { describe, expect, it } from 'vitest';
import { buildWorkOrderNumberWhere } from './work-order-reference.js';

describe('buildWorkOrderNumberWhere', () => {
  it('builds the 4-digit WO matcher with endsWith matching', () => {
    expect(buildWorkOrderNumberWhere('6452')).toEqual({
      OR: [
        { orderNumber: '6452' },
        { orderNumber: 'WO6452' },
        { orderNumber: { endsWith: '6452' } },
      ],
    });
  });

  it('builds the 5-digit WO matcher with contains matching', () => {
    expect(buildWorkOrderNumberWhere('64524')).toEqual({
      OR: [
        { orderNumber: '64524' },
        { orderNumber: 'WO64524' },
        { orderNumber: { contains: '64524' } },
      ],
    });
  });
});
