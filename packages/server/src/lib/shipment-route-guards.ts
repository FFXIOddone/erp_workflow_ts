import { ShipmentStatus } from '@prisma/client';
import { BadRequestError, NotFoundError } from '../middleware/error-handler.js';

type ShipmentMutationGuardOptions = {
  notFoundMessage?: string;
  badRequestMessage?: string;
  allowedStatuses?: ShipmentStatus[];
  disallowedStatuses?: ShipmentStatus[];
};

export function requireShipmentState<T extends { status: ShipmentStatus }>(
  shipment: T | null | undefined,
  options: ShipmentMutationGuardOptions = {},
): T {
  if (!shipment) {
    throw NotFoundError(options.notFoundMessage ?? 'Shipment not found');
  }

  const { allowedStatuses, disallowedStatuses, badRequestMessage } = options;
  const message = badRequestMessage ?? 'Invalid shipment state';

  if (allowedStatuses && !allowedStatuses.includes(shipment.status)) {
    throw BadRequestError(message);
  }

  if (disallowedStatuses && disallowedStatuses.includes(shipment.status)) {
    throw BadRequestError(message);
  }

  return shipment;
}
