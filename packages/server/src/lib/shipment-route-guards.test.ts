import { ShipmentStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { requireShipmentState } from './shipment-route-guards.js';

describe('requireShipmentState', () => {
  it('throws not found when the shipment is missing', () => {
    expect(() => requireShipmentState(null)).toThrow('Shipment not found');
  });

  it('throws bad request when the status is not allowed', () => {
    expect(() =>
      requireShipmentState(
        { status: ShipmentStatus.DELIVERED },
        {
          allowedStatuses: [ShipmentStatus.PENDING],
          badRequestMessage: 'Can only mutate pending shipments',
        },
      ),
    ).toThrow('Can only mutate pending shipments');
  });

  it('returns the shipment when the status is allowed', () => {
    const shipment = requireShipmentState(
      { status: ShipmentStatus.PENDING, trackingNumber: '123' },
      {
        allowedStatuses: [ShipmentStatus.PENDING, ShipmentStatus.PICKED_UP],
      },
    );

    expect(shipment.trackingNumber).toBe('123');
  });
});
