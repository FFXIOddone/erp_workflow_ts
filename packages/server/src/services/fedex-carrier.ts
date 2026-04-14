import { Carrier } from '@prisma/client';

export function resolveFedExCarrier(
  currentCarrier: Carrier,
  hasFedExEvidence: boolean
): Carrier {
  return currentCarrier === Carrier.OTHER && hasFedExEvidence ? Carrier.FEDEX : currentCarrier;
}
