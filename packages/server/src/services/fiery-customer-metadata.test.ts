import { describe, expect, it } from 'vitest';
import { resolveFieryCustomerMetadata } from './fiery-customer-metadata.js';

describe('resolveFieryCustomerMetadata', () => {
  it('prefers explicit customer fields and includes the source file comment', () => {
    const metadata = resolveFieryCustomerMetadata({
      workOrderNumber: '64524',
      customerName: 'Pribusin',
      customerId: 'PO23402',
      sourceFileName: 'jimmy_deans_blades.pdf',
    });

    expect(metadata).toEqual({
      customerName: 'Pribusin',
      customerId: 'PO23402',
      commentParts: [
        'Source: jimmy_deans_blades.pdf',
        'Customer: Pribusin',
        'CustomerID: PO23402',
      ],
    });
  });

  it('falls back to company and work-order values when explicit customer data is missing', () => {
    const metadata = resolveFieryCustomerMetadata({
      workOrderNumber: '64586',
      workOrderId: 'wo-64586',
      companyName: 'Mastertag',
      companyId: 'C-123',
    });

    expect(metadata.customerName).toBe('Mastertag');
    expect(metadata.customerId).toBe('C-123');
    expect(metadata.commentParts).toContain('Customer: Mastertag');
    expect(metadata.commentParts).toContain('CustomerID: C-123');
  });

  it('falls back to stable unknown labels when nothing is available', () => {
    const metadata = resolveFieryCustomerMetadata({});

    expect(metadata.customerName).toBe('Unknown Customer');
    expect(metadata.customerId).toBe('Unknown Customer ID');
  });
});
