import { describe, expect, it } from 'vitest';
import { resolveFedExAddressIssue, resolveFedExStatusSummary } from './fedex-status-summary.js';

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
});
