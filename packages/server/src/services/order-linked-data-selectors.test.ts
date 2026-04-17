import { describe, expect, it } from 'vitest';
import {
  selectLatestAttachmentSummaries,
  selectLatestShipmentSummaries,
  selectNormalizedLinkedRecords,
} from './order-linked-data-selectors.js';

describe('order linked data selectors', () => {
  it('projects the latest shipment and attachment rows consistently', () => {
    const sharedDate = new Date('2026-04-15T12:00:00.000Z');
    expect(
      selectLatestShipmentSummaries([
        {
          id: 'ship-1',
          carrier: 'fedex',
          trackingNumber: '123456',
          status: 'DELIVERED',
          shipDate: sharedDate,
          estimatedDelivery: null,
          actualDelivery: new Date('2026-04-16T12:00:00.000Z'),
          createdBy: { displayName: 'Alex' },
          packages: [{ id: 'pkg-1' }],
        },
      ]),
    ).toEqual([
        {
          id: 'ship-1',
          carrier: 'fedex',
          trackingNumber: '123456',
          status: 'DELIVERED',
          shipDate: sharedDate,
          estimatedDelivery: null,
          actualDelivery: new Date('2026-04-16T12:00:00.000Z'),
          packageCount: 1,
          createdByDisplayName: 'Alex',
      },
    ]);

    expect(
      selectLatestAttachmentSummaries([
        {
          id: 'att-1',
          fileName: 'proof.pdf',
          fileType: 'PDF',
          uploadedAt: new Date('2026-04-15T12:15:00.000Z'),
          uploadedBy: { displayName: 'Jamie' },
        },
      ]),
    ).toEqual([
      {
        id: 'att-1',
        fileName: 'proof.pdf',
        fileType: 'PDF',
        uploadedAt: new Date('2026-04-15T12:15:00.000Z'),
        uploadedByDisplayName: 'Jamie',
      },
    ]);

    expect(
      selectNormalizedLinkedRecords({
        shipments: [
          {
            id: 'ship-1',
            carrier: 'fedex',
            trackingNumber: '123456',
            status: 'DELIVERED',
            shipDate: sharedDate,
            estimatedDelivery: null,
            actualDelivery: new Date('2026-04-16T12:00:00.000Z'),
            createdBy: { displayName: 'Alex' },
            packages: [{ id: 'pkg-1' }],
          },
        ],
        attachments: [
          {
            id: 'att-1',
            fileName: 'proof.pdf',
            fileType: 'PDF',
            uploadedAt: new Date('2026-04-15T12:15:00.000Z'),
            uploadedBy: { displayName: 'Jamie' },
          },
        ],
        proofs: [
          {
            id: 'proof-1',
            status: 'APPROVED',
            requestedAt: new Date('2026-04-15T12:05:00.000Z'),
            respondedAt: new Date('2026-04-15T12:20:00.000Z'),
            attachment: { fileName: 'proof.pdf' },
          },
        ],
        fileChainLinks: [
          {
            id: 'chain-1',
            printFileName: 'job.pdf',
            cutFileName: 'job.zcc',
            cutId: 'JOB-1',
            status: 'PRINTING',
            printStatus: 'COMPLETED',
            cutStatus: 'IN_PROGRESS',
            printedAt: new Date('2026-04-15T12:30:00.000Z'),
            cutCompletedAt: null,
          },
        ],
      }).map((entry) => [entry.kind, entry.provenance]),
    ).toEqual([
      ['PRINT', 'Print file-chain record'],
      ['PROOF', 'Proof approval record'],
      ['ATTACHMENT', 'Attachment record'],
      ['SHIPMENT', 'Shipment record'],
      ['CUT', 'Cut file-chain record'],
    ]);
  });
});
