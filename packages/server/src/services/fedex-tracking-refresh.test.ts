import { Carrier } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  isAmbiguousFedExTrackingCandidate,
  isFullFedExRefreshCandidate,
  isHourlyFedExRefreshCandidate,
} from './fedex-tracking-refresh.js';

describe('isHourlyFedExRefreshCandidate', () => {
  it('keeps the hourly batch focused on real FedEx tracking numbers only', () => {
    expect(
      isHourlyFedExRefreshCandidate({
        carrier: Carrier.FEDEX,
        trackingNumber: null,
      })
    ).toBe(false);

    expect(
      isHourlyFedExRefreshCandidate({
        carrier: Carrier.OTHER,
        trackingNumber: '495213068323',
      })
    ).toBe(true);

    expect(
      isHourlyFedExRefreshCandidate({
        carrier: Carrier.OTHER,
        trackingNumber: 'PO421',
      })
    ).toBe(false);

    expect(
      isHourlyFedExRefreshCandidate({
        carrier: Carrier.OTHER,
        trackingNumber: null,
      })
    ).toBe(false);
  });
});

describe('isFullFedExRefreshCandidate', () => {
  it('targets real FedEx tracking numbers for full manual reconciliation', () => {
    expect(
      isFullFedExRefreshCandidate({
        trackingNumber: '495213068323',
      })
    ).toBe(true);

    expect(
      isFullFedExRefreshCandidate({
        trackingNumber: 'PO421',
      })
    ).toBe(false);

    expect(
      isFullFedExRefreshCandidate({
        trackingNumber: null,
      })
    ).toBe(false);
  });
});

describe('isAmbiguousFedExTrackingCandidate', () => {
  it('targets reference-style tracking values for the dedicated repair job', () => {
    expect(
      isAmbiguousFedExTrackingCandidate({
        carrier: Carrier.FEDEX,
        trackingNumber: 'PO421',
      })
    ).toBe(true);

    expect(
      isAmbiguousFedExTrackingCandidate({
        carrier: Carrier.OTHER,
        trackingNumber: '64249',
      })
    ).toBe(true);

    expect(
      isAmbiguousFedExTrackingCandidate({
        carrier: Carrier.FEDEX,
        trackingNumber: '495213068323',
      })
    ).toBe(false);
  });
});
