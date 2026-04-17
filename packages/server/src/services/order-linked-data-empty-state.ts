export type LinkedDataEmptyStateCounts = {
  routingCount: number;
  stationProgressCount: number;
  fileChainCount: number;
  shipmentCount: number;
  attachmentCount: number;
  proofApprovalCount: number;
  reprintRequestCount: number;
};

export function buildLinkedDataEmptyStateWarnings({
  routingCount,
  stationProgressCount,
  fileChainCount,
  shipmentCount,
  attachmentCount,
  proofApprovalCount,
  reprintRequestCount,
}: LinkedDataEmptyStateCounts): string[] {
  const warnings: string[] = [];

  if (routingCount === 0) {
    warnings.push('No routing records are linked yet');
  }

  if (stationProgressCount === 0) {
    warnings.push('No station progress records are linked yet');
  }

  if (fileChainCount === 0) {
    warnings.push('No print/cut file-chain records are linked yet');
  }

  if (shipmentCount === 0) {
    warnings.push('No shipment records are linked yet');
  }

  if (attachmentCount === 0) {
    warnings.push('No attachment records are linked yet');
  }

  if (proofApprovalCount === 0) {
    warnings.push('No proof approval records are linked yet');
  }

  if (reprintRequestCount === 0) {
    warnings.push('No reprint request records are linked yet');
  }

  return warnings;
}
