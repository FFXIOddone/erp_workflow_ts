export type FedExTrackingEventLike = {
  eventDate: Date | string;
  eventTime?: Date | string | null;
  createdAt?: Date | string | null;
};

function toComparableTimestamp(value: Date | string | null | undefined): number {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }

  const date = value instanceof Date ? value : new Date(value);
  const timestamp = date.getTime();
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

export function compareFedExTrackingEventsDescending<T extends FedExTrackingEventLike>(
  left: T,
  right: T
): number {
  const leftTimestamp = Math.max(
    toComparableTimestamp(left.eventTime),
    toComparableTimestamp(left.eventDate),
    toComparableTimestamp(left.createdAt)
  );
  const rightTimestamp = Math.max(
    toComparableTimestamp(right.eventTime),
    toComparableTimestamp(right.eventDate),
    toComparableTimestamp(right.createdAt)
  );

  return rightTimestamp - leftTimestamp;
}

export function sortFedExTrackingEventsNewestFirst<T extends FedExTrackingEventLike>(
  events: readonly T[]
): T[] {
  return [...events].sort(compareFedExTrackingEventsDescending);
}

export function selectLatestFedExTrackingEvent<T extends FedExTrackingEventLike>(
  events?: readonly T[] | null
): T | null {
  return events?.length ? sortFedExTrackingEventsNewestFirst(events)[0] ?? null : null;
}
