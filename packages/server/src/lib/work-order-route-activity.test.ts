import { ActivityAction } from './activity-logger.js';
import { describe, expect, it } from 'vitest';
import { buildWorkOrderRouteActivityPayload } from './work-order-route-activity.js';

describe('buildWorkOrderRouteActivityPayload', () => {
  it('returns the work order number as the entity name', () => {
    const payload = buildWorkOrderRouteActivityPayload({
      action: ActivityAction.UPDATE,
      workOrder: { id: 'wo-1', orderNumber: 'WO12345' },
      description: 'Updated work order',
      req: { userId: 'user-1' } as never,
      details: { status: 'SHIPPED' },
    });

    expect(payload.entityType).toBe('WorkOrder');
    expect(payload.entityId).toBe('wo-1');
    expect(payload.entityName).toBe('WO12345');
    expect(payload.details).toEqual({ status: 'SHIPPED' });
  });
});
