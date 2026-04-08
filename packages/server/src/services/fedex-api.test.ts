import { describe, expect, it } from 'vitest';
import { collectFedExReferenceCandidates, resolveFedExApiBaseUrl } from './fedex-api.js';

describe('collectFedExReferenceCandidates', () => {
  it('builds reference lookups from normal order fields', () => {
    const candidates = collectFedExReferenceCandidates({
      shipDate: new Date('2026-04-07T12:00:00Z'),
      workOrder: {
        orderNumber: '64524',
        customerName: 'Acme PO67890',
        description: 'FedEx order PO11111',
        poNumber: 'PO12345',
        quickbooksOrderNum: '1683571649',
        company: null,
        customer: null,
      },
    });

    expect(candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'PURCHASE_ORDER',
          value: 'PO12345',
          shipDateBegin: '2026-03-23',
          shipDateEnd: '2026-04-08',
        }),
        expect.objectContaining({
          type: 'PURCHASE_ORDER',
          value: 'PO67890',
        }),
        expect.objectContaining({
          type: 'PURCHASE_ORDER',
          value: 'PO11111',
        }),
        expect.objectContaining({
          type: 'INVOICE',
          value: '1683571649',
        }),
        expect.objectContaining({
          type: 'CUSTOMER_REFERENCE',
          value: '1683571649',
        }),
        expect.objectContaining({
          type: 'CUSTOMER_REFERENCE',
          value: '64524',
        }),
      ])
    );
  });
});

describe('resolveFedExApiBaseUrl', () => {
  it('defaults to production when FEDEX_API_BASE_URL is not set', () => {
    expect(resolveFedExApiBaseUrl(undefined)).toBe('https://apis.fedex.com');
    expect(resolveFedExApiBaseUrl(null)).toBe('https://apis.fedex.com');
    expect(resolveFedExApiBaseUrl('   ')).toBe('https://apis.fedex.com');
  });

  it('supports explicit sandbox override', () => {
    expect(resolveFedExApiBaseUrl('sandbox')).toBe('https://apis-sandbox.fedex.com');
    expect(resolveFedExApiBaseUrl(' https://apis-sandbox.fedex.com/ ')).toBe('https://apis-sandbox.fedex.com');
  });

  it('supports explicit production aliases and trims trailing slashes', () => {
    expect(resolveFedExApiBaseUrl('production')).toBe('https://apis.fedex.com');
    expect(resolveFedExApiBaseUrl('prod')).toBe('https://apis.fedex.com');
    expect(resolveFedExApiBaseUrl('https://apis.fedex.com/')).toBe('https://apis.fedex.com');
  });
});
