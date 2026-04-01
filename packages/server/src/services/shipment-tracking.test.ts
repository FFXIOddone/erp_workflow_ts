import { describe, expect, it } from 'vitest';
import { resolveShipmentTrackingNumber } from './shipment-tracking.js';

describe('resolveShipmentTrackingNumber', () => {
  it('prefers the shipment tracking number when it exists', () => {
    expect(
      resolveShipmentTrackingNumber({
        trackingNumber: ' 1Z123 ',
        labelScans: [
          { trackingNumber: 'SCANNED-1', scannedAt: '2026-04-01T10:00:00.000Z' },
        ],
        workOrder: {
          shippingScans: [
            { trackingNumber: 'ORDER-SCAN', scannedAt: '2026-04-01T11:00:00.000Z' },
          ],
          fedExShipmentRecords: [
            { trackingNumber: 'FEDEX-RECORD', importedAt: '2026-04-01T12:00:00.000Z' },
          ],
        },
      })
    ).toBe('1Z123');
  });

  it('falls back to the newest label scan when the shipment tracking number is missing', () => {
    expect(
      resolveShipmentTrackingNumber({
        trackingNumber: null,
        labelScans: [
          { trackingNumber: 'OLD-LABEL', scannedAt: '2026-04-01T08:00:00.000Z' },
          { trackingNumber: 'NEW-LABEL', scannedAt: '2026-04-01T09:00:00.000Z' },
        ],
      })
    ).toBe('NEW-LABEL');
  });

  it('falls back to work order scans before FedEx import records', () => {
    expect(
      resolveShipmentTrackingNumber({
        trackingNumber: null,
        workOrder: {
          shippingScans: [
            { trackingNumber: 'ORDER-SCAN', scannedAt: '2026-04-01T11:00:00.000Z' },
          ],
          fedExShipmentRecords: [
            { trackingNumber: 'FEDEX-RECORD', importedAt: '2026-04-01T12:00:00.000Z' },
          ],
        },
      })
    ).toBe('ORDER-SCAN');
  });

  it('uses FedEx records when they are the only linked source', () => {
    expect(
      resolveShipmentTrackingNumber({
        trackingNumber: null,
        workOrder: {
          fedExShipmentRecords: [
            { trackingNumber: 'FEDEX-RECORD-1', importedAt: '2026-04-01T12:00:00.000Z' },
            { trackingNumber: 'FEDEX-RECORD-2', importedAt: '2026-04-01T13:00:00.000Z' },
          ],
        },
      })
    ).toBe('FEDEX-RECORD-2');
  });

  it('returns null when no source has a tracking number', () => {
    expect(
      resolveShipmentTrackingNumber({
        trackingNumber: null,
        labelScans: [{ trackingNumber: null }],
        workOrder: {
          shippingScans: [{ trackingNumber: '   ' }],
          fedExShipmentRecords: [{ trackingNumber: null }],
        },
      })
    ).toBeNull();
  });
});
