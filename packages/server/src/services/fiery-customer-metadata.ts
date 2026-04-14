const UNKNOWN_CUSTOMER_NAME = 'Unknown Customer';
const UNKNOWN_CUSTOMER_ID = 'Unknown Customer ID';

function normalizeText(value?: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export interface FieryCustomerMetadataInput {
  workOrderNumber?: string | null;
  workOrderId?: string | null;
  customerName?: string | null;
  customerId?: string | null;
  companyName?: string | null;
  companyId?: string | null;
  sourceFileName?: string | null;
  jobDescription?: string | null;
}

export interface FieryCustomerMetadata {
  customerName: string;
  customerId: string;
  commentParts: string[];
}

/**
 * Resolve the customer-facing name/ID pair used in Fiery submissions.
 * The helper prefers explicit customer values, then company values, then
 * work-order-derived fallbacks, and finally stable "Unknown" labels.
 */
export function resolveFieryCustomerMetadata(
  input: FieryCustomerMetadataInput,
): FieryCustomerMetadata {
  const workOrderLabel = normalizeText(input.workOrderNumber) || normalizeText(input.workOrderId);
  const customerName =
    normalizeText(input.customerName) ||
    normalizeText(input.companyName) ||
    (workOrderLabel ? `Work Order ${workOrderLabel}` : UNKNOWN_CUSTOMER_NAME);
  const customerId =
    normalizeText(input.customerId) ||
    normalizeText(input.companyId) ||
    workOrderLabel ||
    UNKNOWN_CUSTOMER_ID;

  const commentParts: string[] = [];
  const sourceFileName = normalizeText(input.sourceFileName);
  if (sourceFileName) commentParts.push(`Source: ${sourceFileName}`);
  commentParts.push(`Customer: ${customerName}`);
  commentParts.push(`CustomerID: ${customerId}`);

  return {
    customerName,
    customerId,
    commentParts,
  };
}
