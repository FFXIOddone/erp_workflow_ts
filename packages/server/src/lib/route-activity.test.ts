import { describe, expect, it } from 'vitest';
import { buildRouteActivityPayload } from './route-activity.js';

describe('buildRouteActivityPayload', () => {
  it('builds a standard route activity envelope', () => {
    const payload = buildRouteActivityPayload({
      action: 'CREATE',
      entityType: 'Other',
      entityId: 'row-1',
      entityName: 'Row One',
      description: 'Created row',
      userId: 'user-1',
      req: { userId: 'user-1' } as never,
      details: { source: 'test' },
    });

    expect(payload.entityType).toBe('Other');
    expect(payload.entityName).toBe('Row One');
    expect(payload.details).toEqual({ source: 'test' });
  });
});
