export function resolveFedExLinkedWorkOrderCount(workOrderIds: Set<string>): number {
  return workOrderIds.size;
}

export function resolveFedExShipmentCounts(workOrderIds: Set<string>): {
  workOrderCount: number;
  linkedWorkOrderCount: number;
} {
  const count = resolveFedExLinkedWorkOrderCount(workOrderIds);

  return {
    workOrderCount: count,
    linkedWorkOrderCount: count,
  };
}
