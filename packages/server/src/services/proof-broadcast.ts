type ProofStatusChangedPayloadInput = {
  orderId: string;
  orderNumber: string;
  status: 'SENT' | 'APPROVED';
  revision?: number;
  comments?: string | null;
};

type ProofStatusChangedPayload = {
  orderId: string;
  orderNumber: string;
  status: 'SENT' | 'APPROVED';
  revision?: number;
  comments?: string;
};

export function buildProofStatusChangedPayload(
  input: ProofStatusChangedPayloadInput,
): ProofStatusChangedPayload {
  const payload: ProofStatusChangedPayload = {
    orderId: input.orderId,
    orderNumber: input.orderNumber,
    status: input.status,
  };

  if (typeof input.revision === 'number') {
    payload.revision = input.revision;
  }

  if (typeof input.comments === 'string' && input.comments.trim().length > 0) {
    payload.comments = input.comments.trim();
  }

  return payload;
}
