import { EntityType } from './activity-logger.js';
import type { AuthRequest } from '../middleware/auth.js';

type LinkedDataRepairRouteActivityInput = {
  description: string;
  req: AuthRequest;
  details: {
    scanned: number;
    routingUpdated: number;
    stationProgressBackfilled: number;
    fileChainsCreated: number;
    shipmentsCreated: number;
  };
};

export function buildLinkedDataRepairRouteActivityPayload({
  description,
  req,
  details,
}: LinkedDataRepairRouteActivityInput) {
  return {
    action: 'UPDATE',
    entityType: EntityType.WORK_ORDER,
    entityId: 'system',
    entityName: 'system',
    description,
    details,
    userId: req.userId!,
    req,
  };
}
