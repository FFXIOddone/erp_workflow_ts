import { describe, expect, it } from 'vitest';
import { PrintingMethod, StationStatus } from '@erp/shared';
import {
  applyRoutingDefaults,
  buildInitialStationProgress,
  inferRoutingFromDescription,
  inferRoutingSource,
  resolveImportedRouting,
  summarizeStationProgressCounts,
} from './routing-defaults.js';

describe('routing defaults', () => {
  it('adds downstream stations for explicit print routing', () => {
    expect(applyRoutingDefaults([PrintingMethod.FLATBED], { description: 'Dibond sign' })).toEqual([
      PrintingMethod.ORDER_ENTRY,
      PrintingMethod.DESIGN,
      PrintingMethod.FLATBED,
      PrintingMethod.FLATBED_PRINTING,
      PrintingMethod.PRODUCTION,
      PrintingMethod.PRODUCTION_ZUND,
      PrintingMethod.PRODUCTION_FINISHING,
      PrintingMethod.SHIPPING_RECEIVING,
      PrintingMethod.SHIPPING_QC,
      PrintingMethod.SHIPPING_PACKAGING,
      PrintingMethod.SHIPPING_SHIPMENT,
      PrintingMethod.SHIPPING_INSTALL_READY,
    ]);
  });

  it('omits order entry for woocommerce print routes', () => {
    expect(
      applyRoutingDefaults([PrintingMethod.FLATBED], {
        description: 'Dibond sign',
        source: 'woocommerce',
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
      PrintingMethod.SHIPPING_SHIPMENT,
      PrintingMethod.SHIPPING_INSTALL_READY,
    ]);
  });

  it('strips order entry from woocommerce fallbacks and keeps a safe design-only lane', () => {
    expect(applyRoutingDefaults([], { source: 'woocommerce' })).toEqual([
      PrintingMethod.DESIGN_ONLY,
    ]);

    expect(
      applyRoutingDefaults([PrintingMethod.ORDER_ENTRY], {
        source: 'woocommerce',
      }),
    ).toEqual([
      PrintingMethod.DESIGN_ONLY,
    ]);
  });

  it('infers likely print stations from description text', () => {
    expect(inferRoutingFromDescription('Window perf banner (RR)')).toEqual([
      PrintingMethod.ROLL_TO_ROLL,
      PrintingMethod.ROLL_TO_ROLL_PRINTING,
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
      PrintingMethod.ORDER_ENTRY,
      PrintingMethod.DESIGN,
      PrintingMethod.DESIGN_PROOF,
      PrintingMethod.DESIGN_APPROVAL,
      PrintingMethod.DESIGN_PRINT_READY,
      PrintingMethod.FLATBED,
      PrintingMethod.FLATBED_PRINTING,
      PrintingMethod.PRODUCTION,
      PrintingMethod.PRODUCTION_ZUND,
      PrintingMethod.PRODUCTION_FINISHING,
      PrintingMethod.SHIPPING_RECEIVING,
      PrintingMethod.SHIPPING_QC,
      PrintingMethod.SHIPPING_PACKAGING,
      PrintingMethod.SHIPPING_SHIPMENT,
      PrintingMethod.SHIPPING_INSTALL_READY,
    ]);
  });

  it('keeps design-only imports out of the print queue', () => {
    expect(
      resolveImportedRouting({
        routing: [],
        description: 'Front counter proof (DESIGN ONLY)',
        section: 'DESIGN; DESIGN ONLY',
      }),
    ).toEqual([PrintingMethod.ORDER_ENTRY, PrintingMethod.DESIGN_ONLY]);
  });

  it('keeps woocommerce design-only imports out of order entry', () => {
    expect(
      resolveImportedRouting({
        routing: [],
        description: 'Front counter proof (DESIGN ONLY)',
        section: 'DESIGN; DESIGN ONLY',
        source: 'woocommerce',
      }),
    ).toEqual([PrintingMethod.DESIGN_ONLY]);
  });

  it('marks order entry complete for non-woocommerce imports', () => {
    const entryTimestamp = new Date('2026-04-02T15:30:00.000Z');

    expect(
      buildInitialStationProgress([PrintingMethod.ORDER_ENTRY, PrintingMethod.DESIGN], {
        source: 'manual',
        entryTimestamp,
      }),
    ).toEqual([
      {
        station: PrintingMethod.ORDER_ENTRY,
        status: StationStatus.COMPLETED,
        startedAt: entryTimestamp,
        completedAt: entryTimestamp,
      },
      {
        station: PrintingMethod.DESIGN,
        status: StationStatus.NOT_STARTED,
      },
    ]);
  });

  it('summarizes completed station counts from the same normalized routing', () => {
    const entryTimestamp = new Date('2026-04-02T15:30:00.000Z');
    const routing = applyRoutingDefaults([PrintingMethod.FLATBED], {
      description: 'Dibond sign',
    });

    expect(
      summarizeStationProgressCounts(routing, [
        {
          station: PrintingMethod.ORDER_ENTRY,
          status: StationStatus.COMPLETED,
        },
        {
          station: PrintingMethod.DESIGN,
          status: StationStatus.IN_PROGRESS,
        },
        {
          station: PrintingMethod.FLATBED,
          status: StationStatus.COMPLETED,
        },
      ], {
        source: 'manual',
        entryTimestamp,
      }),
    ).toEqual({
      routingCount: 12,
      stationProgressCount: 3,
      completedStationCount: 2,
    });
  });

  it('detects woocommerce order sources', () => {
    expect(
      inferRoutingSource('WOO-12345', 'Online order from shop.wilde-signs.com - Order #12345')
    ).toBe('woocommerce');
  });
});
