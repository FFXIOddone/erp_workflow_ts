import { describe, expect, it } from 'vitest';
import { buildRouteBroadcastPayload } from './route-broadcast.js';

describe('buildRouteBroadcastPayload', () => {
  it('builds a standard broadcast envelope with a timestamp', () => {
    const payload = buildRouteBroadcastPayload({
      type: 'ORDER_UPDATED',
      payload: { orderId: 'order-1' },
      timestamp: new Date('2026-04-16T12:00:00.000Z'),
    });

    expect(payload.type).toBe('ORDER_UPDATED');
    expect(payload.payload).toEqual({ orderId: 'order-1' });
    expect(payload.timestamp).toEqual(new Date('2026-04-16T12:00:00.000Z'));
  });
});
