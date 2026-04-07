import { Carrier, ShipmentStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { resolveShipmentReadCorrections } from './shipments.js';

describe('resolveShipmentReadCorrections', () => {
  it('promotes OTHER to FEDEX when linked FedEx evidence exists', () => {
    const corrected = resolveShipmentReadCorrections({
      id: 'shipment-1',
      carrier: Carrier.OTHER,
      status: ShipmentStatus.IN_TRANSIT,
      workOrder: {
        status: 'SHIPPED',
        fedExShipmentRecords: [{ trackingNumber: '805941978240' }],
      },
    });

    expect(corrected.carrier).toBe(Carrier.FEDEX);
  });

  it('promotes OTHER to FEDEX when FedEx status evidence exists even without a tracking number', () => {
    const corrected = resolveShipmentReadCorrections({
      id: 'shipment-1b',
      carrier: Carrier.OTHER,
      status: ShipmentStatus.PICKED_UP,
      workOrder: {
        status: 'SHIPPED',
        fedExShipmentRecords: [
          {
            trackingNumber: null,
            importedAt: new Date('2026-04-06T10:00:00Z'),
            rawData: {
              row: {
                status: 'In Transit',
                description: 'Package is moving through FedEx network',
                eventTimestamp: '2026-04-06T10:00:00Z',
              },
            },
          },
        ],
      },
    });

    expect(corrected.carrier).toBe(Carrier.FEDEX);
    expect(corrected.status).toBe(ShipmentStatus.IN_TRANSIT);
  });

  it('promotes shipped PICKED_UP placeholders to IN_TRANSIT', () => {
    const corrected = resolveShipmentReadCorrections({
      id: 'shipment-2',
      carrier: Carrier.FEDEX,
      status: ShipmentStatus.PICKED_UP,
      workOrder: {
        status: 'SHIPPED',
        fedExShipmentRecords: [{ trackingNumber: null }],
      },
    });

    expect(corrected.status).toBe(ShipmentStatus.IN_TRANSIT);
  });

  it('keeps values unchanged when there is no correction signal', () => {
    const corrected = resolveShipmentReadCorrections({
      id: 'shipment-3',
      carrier: Carrier.OTHER,
      status: ShipmentStatus.PICKED_UP,
      workOrder: {
        status: 'PENDING',
        fedExShipmentRecords: [],
      },
    });

    expect(corrected.carrier).toBe(Carrier.OTHER);
    expect(corrected.status).toBe(ShipmentStatus.PICKED_UP);
  });
});
