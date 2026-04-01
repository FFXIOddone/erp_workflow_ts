import { describe, expect, it } from 'vitest';
import { PrintingMethod } from '@erp/shared';
import {
  applyRoutingDefaults,
  inferRoutingFromDescription,
  resolveImportedRouting,
} from './routing-defaults.js';

describe('routing defaults', () => {
  it('adds downstream stations for explicit print routing', () => {
    expect(applyRoutingDefaults([PrintingMethod.FLATBED], { description: 'Dibond sign' })).toEqual([
      PrintingMethod.FLATBED,
      PrintingMethod.FLATBED_PRINTING,
      PrintingMethod.PRODUCTION,
      PrintingMethod.PRODUCTION_ZUND,
      PrintingMethod.PRODUCTION_FINISHING,
      PrintingMethod.SHIPPING_RECEIVING,
      PrintingMethod.SHIPPING_QC,
      PrintingMethod.SHIPPING_PACKAGING,
    ]);
  });

  it('infers likely print stations from description text', () => {
    expect(inferRoutingFromDescription('Window perf banner (RR)')).toEqual([
      PrintingMethod.ROLL_TO_ROLL,
    ]);
  });

  it('heals sparse spreadsheet routing using description and section hints', () => {
    expect(
      resolveImportedRouting({
        routing: [PrintingMethod.PRODUCTION],
        description: '48x96 Dibond sign',
        section: 'DESIGN; PRODUCTION',
        needsProof: true,
      }),
    ).toEqual([
      PrintingMethod.DESIGN,
      PrintingMethod.FLATBED,
      PrintingMethod.FLATBED_PRINTING,
      PrintingMethod.PRODUCTION,
      PrintingMethod.PRODUCTION_ZUND,
      PrintingMethod.PRODUCTION_FINISHING,
      PrintingMethod.SHIPPING_RECEIVING,
      PrintingMethod.SHIPPING_QC,
      PrintingMethod.SHIPPING_PACKAGING,
    ]);
  });

  it('keeps design-only imports out of the print queue', () => {
    expect(
      resolveImportedRouting({
        routing: [],
        description: 'Front counter proof (DESIGN ONLY)',
        section: 'DESIGN; DESIGN ONLY',
      }),
    ).toEqual([PrintingMethod.DESIGN]);
  });
});
