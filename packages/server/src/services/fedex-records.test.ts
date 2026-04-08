import { describe, expect, it } from 'vitest';
import {
  extractFedExWorkOrderCandidates,
  resolveFedExShipmentRecordLocationLabel,
  normalizeFedExServiceLabel,
  summarizeFedExShipmentRecords,
} from './fedex.js';

describe('resolveFedExShipmentRecordLocationLabel', () => {
  it('prefers structured scan location data from raw payloads', () => {
    expect(
      resolveFedExShipmentRecordLocationLabel({
        rawData: {
          scanLocation: {
            city: 'Muskegon',
            state: 'MI',
            country: 'US',
          },
        },
      })
    ).toBe('Muskegon, MI, US');
  });

  it('falls back to destination fields when no scan location is present', () => {
    expect(
      resolveFedExShipmentRecordLocationLabel({
        rawData: null,
        destinationAddressLine1: '123 Main St',
        destinationCity: 'Grand Rapids',
        destinationState: 'MI',
        destinationPostalCode: '49503',
        destinationCountry: 'US',
      })
    ).toBe('123 Main St, Grand Rapids, MI, 49503, US');
  });
});

describe('extractFedExWorkOrderCandidates', () => {
  it('extracts candidates from additionalTrackingInfo.packageIdentifiers', () => {
    const candidates = extractFedExWorkOrderCandidates({
      output: {
        completeTrackResults: [
          {
            trackResults: [
              {
                additionalTrackingInfo: {
                  packageIdentifiers: [
                    { type: 'PURCHASE_ORDER', value: 'PO-1683571649' },
                    { type: 'INVOICE', value: '30186971' },
                  ],
                },
              },
            ],
          },
        ],
      },
    });

    expect(candidates).toEqual(expect.arrayContaining(['1683571649', '30186971']));
  });

  it('extracts candidates from trackingNumberInfo.trackingNumberUniqueId', () => {
    const candidates = extractFedExWorkOrderCandidates({
      output: {
        completeTrackResults: [
          {
            trackResults: [
              {
                trackingNumberInfo: {
                  trackingNumberUniqueId: '2458222000~495213069146~FDEG',
                },
              },
            ],
          },
        ],
      },
    });

    expect(candidates).toEqual(expect.arrayContaining(['2458222000', '495213069146', 'FDEG']));
  });

  it('ignores irrelevant strings outside keyed identifier paths', () => {
    const candidates = extractFedExWorkOrderCandidates({
      summary: {
        note: 'customer said reference this internally only',
      },
      unrelatedText: 'PO-999999 should not be parsed here',
      payload: {
        companyName: 'Wilde Signs',
      },
    });

    expect(candidates).toEqual([]);
  });
});

describe('normalizeFedExServiceLabel', () => {
  it('maps raw FedEx service codes to human-readable labels', () => {
    expect(normalizeFedExServiceLabel("'92'")).toBe('Ground');
    expect(normalizeFedExServiceLabel("'03'")).toBe('2Day');
    expect(normalizeFedExServiceLabel("'SB'")).toBe('Ground Economy Bound Printed Matter');
  });

  it('normalizes common descriptive service text', () => {
    expect(normalizeFedExServiceLabel('FedEx Ground Service')).toBe('Ground');
    expect(normalizeFedExServiceLabel('FedEx Freight Priority')).toBe('Freight Priority');
  });
});

describe('summarizeFedExShipmentRecords', () => {
  it('groups records by normalized tracking number and reports record/work-order counts', () => {
    const sourceFileDate = new Date('2026-04-08T12:00:00.000Z');
    const makeRecord = (overrides: Record<string, unknown>) =>
      ({
        id: 'record-default',
        sourceFileName: 'fedex_api_track',
        sourceFilePath: null,
        sourceFileDate,
        eventTimestamp: sourceFileDate,
        trackingNumber: '495213070000',
        service: 'FedEx Ground',
        recipientCompanyName: 'Acme',
        recipientContactName: null,
        destinationAddressLine1: null,
        destinationCity: 'Muskegon',
        destinationState: 'MI',
        destinationPostalCode: null,
        destinationCountry: 'US',
        workOrderId: 'wo-1',
        sourceKey: 'source-key-default',
        rawPayload: '{}',
        rawData: {
          row: {
            status: 'Delivered',
            eventType: 'DL',
            description: 'Delivered',
          },
        },
        importedAt: sourceFileDate,
        updatedAt: sourceFileDate,
        workOrder: {
          id: 'wo-1',
          orderNumber: '64524',
          customerName: 'Pribusin',
        },
        ...overrides,
      }) as any;

    const summaries = summarizeFedExShipmentRecords([
      makeRecord({
        id: 'latest-a',
        sourceKey: 'source-key-a-1',
        trackingNumber: "'495213070001'",
        workOrderId: 'wo-1',
        workOrder: { id: 'wo-1', orderNumber: '64524', customerName: 'Pribusin' },
        rawData: { row: { status: 'Delivered', eventType: 'DL', description: 'Delivered to recipient' } },
      }),
      makeRecord({
        id: 'older-a',
        sourceKey: 'source-key-a-2',
        trackingNumber: '495213070001',
        workOrderId: 'wo-1',
        workOrder: { id: 'wo-1', orderNumber: '64524', customerName: 'Pribusin' },
      }),
      makeRecord({
        id: 'conflict-a',
        sourceKey: 'source-key-a-3',
        trackingNumber: '495213070001',
        workOrderId: 'wo-2',
        workOrder: { id: 'wo-2', orderNumber: '64304', customerName: 'URC' },
      }),
      makeRecord({
        id: 'latest-b',
        sourceKey: 'source-key-b-1',
        trackingNumber: '495213070002',
        workOrderId: 'wo-3',
        workOrder: { id: 'wo-3', orderNumber: '64571', customerName: 'O.W. Larson' },
      }),
    ]);

    expect(summaries).toHaveLength(2);
    expect(summaries[0]).toMatchObject({
      id: 'latest-a',
      trackingNumber: '495213070001',
      recordCount: 3,
      workOrderCount: 2,
      service: 'Ground',
      latestStatus: 'Delivered',
      latestStatusCode: 'DL',
      latestDescription: 'Delivered to recipient',
    });
    expect(summaries[1]).toMatchObject({
      id: 'latest-b',
      trackingNumber: '495213070002',
      recordCount: 1,
      workOrderCount: 1,
    });
  });
});
