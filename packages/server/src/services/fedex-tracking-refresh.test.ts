import { Carrier } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
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
  it('targets all shipments that already have tracking numbers for full manual reconciliation', () => {
    expect(
      isFullFedExRefreshCandidate({
        trackingNumber: '495213068323',
      })
    ).toBe(true);

    expect(
      isFullFedExRefreshCandidate({
        trackingNumber: null,
      })
    ).toBe(false);
  });
});
