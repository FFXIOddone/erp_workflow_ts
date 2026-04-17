import { describe, expect, it } from 'vitest';
import { buildLinkedDataEmptyStateWarnings } from './order-linked-data-empty-state.js';

describe('buildLinkedDataEmptyStateWarnings', () => {
  it('surfaces all standard empty-state warnings when the order has no linked records', () => {
    expect(
      buildLinkedDataEmptyStateWarnings({
        routingCount: 0,
        stationProgressCount: 0,
        fileChainCount: 0,
        shipmentCount: 0,
        attachmentCount: 0,
        proofApprovalCount: 0,
        reprintRequestCount: 0,
      }),
    ).toEqual([
      'No routing records are linked yet',
      'No station progress records are linked yet',
      'No print/cut file-chain records are linked yet',
      'No shipment records are linked yet',
      'No attachment records are linked yet',
      'No proof approval records are linked yet',
      'No reprint request records are linked yet',
    ]);
  });

  it('omits empty-state warnings for populated linked-data categories', () => {
    expect(
      buildLinkedDataEmptyStateWarnings({
        routingCount: 1,
        stationProgressCount: 2,
        fileChainCount: 3,
        shipmentCount: 1,
        attachmentCount: 4,
        proofApprovalCount: 0,
        reprintRequestCount: 0,
      }),
    ).toEqual([
      'No proof approval records are linked yet',
      'No reprint request records are linked yet',
    ]);
  });
});
