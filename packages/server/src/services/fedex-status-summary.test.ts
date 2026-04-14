import { describe, expect, it } from 'vitest';
import { selectLatestFedExTrackingEvent } from '@erp/shared';
import { resolveFedExShipmentSourceLabel } from './fedex-source-label.js';
import { resolveFedExAddressIssue, resolveFedExStatusSummary } from './fedex-status-summary.js';
import { resolveFedExShipmentRecordStatus } from './fedex-record-status.js';

describe('resolveFedExStatusSummary', () => {
  it('prefers live FedEx API events and marks them fresh', () => {
    const summary = resolveFedExStatusSummary({
      trackingEvents: [
        {
          sourceSystem: 'fedex_api',
          eventType: 'DELIVERED',
          eventDate: '2099-04-08T10:00:00Z',
          city: 'Muskegon',
          state: 'MI',
          country: 'US',
          description: 'Delivered',
          rawData: {
            derivedStatus: 'DELIVERED',
            fetchedAt: '2099-04-08T11:00:00Z',
            trackingNumber: ' 495213071146 ',
            sourceBaseUrl: 'https://apis.fedex.com',
            location: {
              locationLabel: 'Muskegon, MI, US',
            },
          },
        },
      ],
      workOrder: {
        fedExShipmentRecords: [
          {
            trackingNumber: '495213071146',
          },
        ],
      },
    });

    expect(summary?.status).toBe('Delivered');
    expect(summary?.eventType).toBe('Delivered');
    expect(summary?.location).toBe('Muskegon, MI, US');
    expect(summary?.trackingNumber).toBe('495213071146');
    expect(summary?.sourceLabel).toBe('FedEx API (Production)');
    expect(summary?.stale).toBe(false);
  });

  it('surfaces the FedEx lookup issue when no track result is returned', () => {
    const summary = resolveFedExStatusSummary({
      workOrder: {
        fedExShipmentRecords: [
          {
            trackingNumber: 'PO421',
            rawData: {
              response: {
                output: {
                  completeTrackResults: [
                    {
                      trackResults: [
                        {
                          error: {
                            code: 'TRACKING.REFERENCENUMBER.NOTFOUND',
                            message: 'Reference number cannot be found. Please correct the reference number and try again.',
                          },
                        },
                      ],
                    },
                  ],
                },
              },
            },
          },
        ],
      },
    });

    expect(summary?.issue).toBe(
      'Reference number cannot be found. Please correct the reference number and try again.'
    );
    expect(summary?.location).toBeNull();
  });

  it('falls back to No Address Found when no location or lookup issue exists', () => {
    expect(resolveFedExAddressIssue(null, null)).toBe('No Address Found');
    expect(resolveFedExAddressIssue('Muskegon, MI, US', null)).toBeNull();
  });

  it('reuses the shared record-status parser for latest status fields', () => {
    expect(
      resolveFedExShipmentRecordStatus({
        row: {
          status: 'delivered',
          eventType: 'DL',
          description: 'Delivered successfully',
        },
      })
    ).toEqual({
      latestStatus: 'delivered',
      latestStatusCode: 'DL',
      latestDescription: 'Delivered successfully',
    });
  });

  it('selects the newest FedEx tracking event using shared ordering rules', () => {
    const latest = selectLatestFedExTrackingEvent([
      {
        eventDate: '2026-04-08T09:00:00Z',
        eventTime: '2026-04-08T09:05:00Z',
      },
      {
        eventDate: '2026-04-08T09:00:00Z',
        eventTime: '2026-04-08T09:10:00Z',
      },
    ]);

    expect(latest?.eventTime).toBe('2026-04-08T09:10:00Z');
  });

  it('labels FedEx API rows from the source base URL', () => {
    expect(
      resolveFedExShipmentSourceLabel(
        { sourceBaseUrl: 'https://apis-sandbox.fedex.com' },
        'fedex_api_track'
      )
    ).toBe('FedEx API (Sandbox)');

    expect(
      resolveFedExShipmentSourceLabel(
        { sourceBaseUrl: 'https://apis.fedex.com' },
        'fedex_api_reference_track'
      )
    ).toBe('FedEx API (Production)');

    expect(resolveFedExShipmentSourceLabel({}, 'FxLogSr04142026.xml')).toBe('FxLogSr04142026.xml');
  });
});
