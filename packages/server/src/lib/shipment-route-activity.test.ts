import { ActivityAction } from './activity-logger.js';
import { describe, expect, it } from 'vitest';
import { buildShipmentRouteActivityPayload } from './shipment-route-activity.js';

describe('buildShipmentRouteActivityPayload', () => {
  it('uses the tracking number when available', () => {
    const payload = buildShipmentRouteActivityPayload({
      action: ActivityAction.UPDATE,
      shipment: { id: 'shipment-1', trackingNumber: '123456789' },
      description: 'Updated shipment',
      req: { userId: 'user-1' } as never,
      details: { carrier: 'FEDEX' },
    });

    expect(payload.entityType).toBe('Shipment');
    expect(payload.entityName).toBe('123456789');
    expect(payload.details).toEqual({ carrier: 'FEDEX' });
  });

  it('falls back to the shipment id prefix when no tracking number exists', () => {
    const payload = buildShipmentRouteActivityPayload({
      action: ActivityAction.DELETE,
      shipment: { id: 'shipment-abcdef1234', trackingNumber: null },
      description: 'Deleted shipment',
      req: { userId: 'user-1' } as never,
    });

    expect(payload.entityName).toBe('shipment');
  });
});
