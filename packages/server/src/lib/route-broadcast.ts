type RouteBroadcastPayloadInput = {
  type: string;
  payload: unknown;
  timestamp?: Date;
} & Record<string, unknown>;

type RouteBroadcastPayload = {
  type: string;
  payload: unknown;
  timestamp: Date;
} & Record<string, unknown>;

export function buildRouteBroadcastPayload({
  type,
  payload,
  timestamp = new Date(),
  ...rest
}: RouteBroadcastPayloadInput): RouteBroadcastPayload {
  return {
    type,
    payload,
    timestamp,
    ...rest,
  };
}
