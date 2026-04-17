import type { AuthRequest } from '../middleware/auth.js';

type RouteActivityPayloadInput = {
  action: string;
  entityType: string;
  entityId: string;
  description: string;
  userId: string;
  req: AuthRequest;
  entityName?: string;
  details?: Record<string, unknown>;
};

export function buildRouteActivityPayload({
  action,
  entityType,
  entityId,
  entityName,
  description,
  userId,
  req,
  details,
}: RouteActivityPayloadInput) {
  return {
    action,
    entityType,
    entityId,
    entityName,
    description,
    details,
    userId,
    req,
  };
}
