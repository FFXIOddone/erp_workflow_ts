import { EntityType } from './activity-logger.js';
import type { AuthRequest } from '../middleware/auth.js';

type WorkOrderRouteActivityTarget = {
  id: string;
  orderNumber: string;
};

type WorkOrderRouteActivityInput = {
  action: string;
  workOrder: WorkOrderRouteActivityTarget;
  description: string;
  req: AuthRequest;
  details?: Record<string, unknown>;
};

export function buildWorkOrderRouteActivityPayload({
  action,
  workOrder,
  description,
  req,
  details,
}: WorkOrderRouteActivityInput) {
  return {
    action,
    entityType: EntityType.WORK_ORDER,
    entityId: workOrder.id,
    entityName: workOrder.orderNumber,
    description,
    details,
    userId: req.userId!,
    req,
  };
}
