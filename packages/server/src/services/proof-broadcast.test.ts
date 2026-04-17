import { describe, expect, it } from 'vitest';
import { buildProofStatusChangedPayload } from './proof-broadcast.js';

describe('proof broadcast payloads', () => {
  it('builds a proof status payload without optional fields when they are absent', () => {
    expect(
      buildProofStatusChangedPayload({
        orderId: 'order-1',
        orderNumber: '64524',
        status: 'APPROVED',
      }),
    ).toEqual({
      orderId: 'order-1',
      orderNumber: '64524',
      status: 'APPROVED',
    });
  });

  it('trims comments and preserves the revision when present', () => {
    expect(
      buildProofStatusChangedPayload({
        orderId: 'order-2',
        orderNumber: '64586',
        status: 'SENT',
        revision: 3,
        comments: '  Looks good  ',
      }),
    ).toEqual({
      orderId: 'order-2',
      orderNumber: '64586',
      status: 'SENT',
      revision: 3,
      comments: 'Looks good',
    });
  });
});
