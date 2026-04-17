import { EntityType } from './activity-logger.js';
import type { AuthRequest } from '../middleware/auth.js';

type ShipmentRouteActivityTarget = {
  id: string;
  trackingNumber?: string | null;
};

type ShipmentRouteActivityInput = {
  action: string;
  shipment: ShipmentRouteActivityTarget;
  description: string;
  req: AuthRequest;
  details?: Record<string, unknown>;
};

export function buildShipmentRouteActivityPayload({
  action,
  shipment,
  description,
  req,
  details,
}: ShipmentRouteActivityInput) {
  return {
    action,
    entityType: EntityType.SHIPMENT,
    entityId: shipment.id,
    entityName: shipment.trackingNumber || shipment.id.slice(0, 8),
    description,
    details,
    userId: req.userId!,
    req,
  };
}
