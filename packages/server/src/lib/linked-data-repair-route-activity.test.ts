import { describe, expect, it } from 'vitest';
import { buildLinkedDataRepairRouteActivityPayload } from './linked-data-repair-route-activity.js';

describe('buildLinkedDataRepairRouteActivityPayload', () => {
  it('builds a stable system repair payload', () => {
    const payload = buildLinkedDataRepairRouteActivityPayload({
      description: 'Linked data repair scanned 2 order(s)',
      req: { userId: 'user-1' } as never,
      details: {
        scanned: 2,
        routingUpdated: 1,
        stationProgressBackfilled: 2,
        fileChainsCreated: 1,
        shipmentsCreated: 0,
      },
    });

    expect(payload.entityType).toBe('WorkOrder');
    expect(payload.entityId).toBe('system');
    expect(payload.entityName).toBe('system');
    expect(payload.details.scanned).toBe(2);
  });
});
