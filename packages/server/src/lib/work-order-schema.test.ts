import { describe, expect, it } from 'vitest';
import {
  CompanyBrand,
  CreateWorkOrderSchema,
  PrintingMethod,
  UpdateWorkOrderSchema,
} from '@erp/shared';

describe('work order schemas', () => {
  it('allows manual line items when creating a work order', () => {
    const parsed = CreateWorkOrderSchema.parse({
      companyId: '11111111-1111-1111-1111-111111111111',
      description: 'Manual line item order',
      priority: 3,
      companyBrand: CompanyBrand.WILDE_SIGNS,
      routing: [PrintingMethod.DESIGN],
      lineItems: [
        {
          description: 'Custom install labor',
          quantity: 1,
          unitPrice: 125,
          notes: 'Entered manually',
        },
      ],
    });

    expect(parsed.lineItems[0]?.itemMasterId).toBeUndefined();
    expect(parsed.lineItems[0]?.description).toBe('Custom install labor');
  });

  it('allows manual line items when updating a work order', () => {
    const parsed = UpdateWorkOrderSchema.parse({
      lineItems: [
        {
          id: '22222222-2222-2222-2222-222222222222',
          description: 'Manual revision fee',
          quantity: 1,
          unitPrice: 50,
        },
      ],
    });

    expect(parsed.lineItems?.[0]?.itemMasterId).toBeUndefined();
    expect(parsed.lineItems?.[0]?.description).toBe('Manual revision fee');
  });
});
