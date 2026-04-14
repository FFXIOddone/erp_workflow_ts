import { Carrier } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { resolveFedExCarrier } from './fedex-carrier.js';

describe('resolveFedExCarrier', () => {
  it('promotes OTHER to FEDEX when FedEx evidence exists', () => {
    expect(resolveFedExCarrier(Carrier.OTHER, true)).toBe(Carrier.FEDEX);
  });

  it('keeps non-OTHER carriers unchanged', () => {
    expect(resolveFedExCarrier(Carrier.FEDEX, true)).toBe(Carrier.FEDEX);
    expect(resolveFedExCarrier(Carrier.USPS, true)).toBe(Carrier.USPS);
  });

  it('keeps OTHER when no FedEx evidence exists', () => {
    expect(resolveFedExCarrier(Carrier.OTHER, false)).toBe(Carrier.OTHER);
  });
});
