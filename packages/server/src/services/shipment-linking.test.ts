import { Carrier, ShipmentStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  inferBackfilledShipmentStatus,
  inferShipmentCarrierFromSignals,
} from './shipment-linking.js';

describe('inferShipmentCarrierFromSignals', () => {
  it('prefers FEDEX when linked FedEx records exist', () => {
    expect(
      inferShipmentCarrierFromSignals({
        evidenceRoot: 'shipping',
        hasFedExRecord: true,
      })
    ).toBe(Carrier.FEDEX);
  });

  it('maps evidence roots when no linked FedEx record exists', () => {
    expect(
      inferShipmentCarrierFromSignals({
        evidenceRoot: 'FedEx/Freight',
        hasFedExRecord: false,
      })
    ).toBe(Carrier.FEDEX);

    expect(
      inferShipmentCarrierFromSignals({
        evidenceRoot: 'freight',
        hasFedExRecord: false,
      })
    ).toBe(Carrier.FREIGHT);
  });
});

describe('inferBackfilledShipmentStatus', () => {
  it('defaults shipped placeholders to IN_TRANSIT', () => {
    expect(inferBackfilledShipmentStatus()).toBe(ShipmentStatus.IN_TRANSIT);
  });

  it('never returns PICKED_UP as the shipped-placeholder fallback', () => {
    expect(inferBackfilledShipmentStatus(ShipmentStatus.PICKED_UP)).toBe(
      ShipmentStatus.IN_TRANSIT
    );
  });
});
