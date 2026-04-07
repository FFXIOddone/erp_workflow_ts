export interface EffectivePriorityInput {
  orderPriority: number | null | undefined;
  customerDefaultPriority: number | null | undefined;
  systemDefaultPriority?: number | null | undefined;
}

export type PrioritySource =
  | 'ORDER_PRIORITY'
  | 'CUSTOMER_DEFAULT'
  | 'ORDER_OVERRIDE';

export interface EffectivePriorityResult {
  orderPriority: number;
  customerPreferenceDefaultPriority: number | null;
  effectivePriority: number;
  prioritySource: PrioritySource;
}

const FALLBACK_PRIORITY = 3;
const MIN_PRIORITY = 1;
const MAX_PRIORITY = 5;

function normalizePriority(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }

  const rounded = Math.round(value);
  return Math.max(MIN_PRIORITY, Math.min(MAX_PRIORITY, rounded));
}

export function resolveEffectivePriority({
  orderPriority,
  customerDefaultPriority,
  systemDefaultPriority,
}: EffectivePriorityInput): EffectivePriorityResult {
  const normalizedOrderPriority = normalizePriority(orderPriority) ?? FALLBACK_PRIORITY;
  const normalizedCustomerDefaultPriority = normalizePriority(customerDefaultPriority);
  const normalizedSystemDefault = normalizePriority(systemDefaultPriority) ?? FALLBACK_PRIORITY;

  if (normalizedCustomerDefaultPriority == null) {
    return {
      orderPriority: normalizedOrderPriority,
      customerPreferenceDefaultPriority: null,
      effectivePriority: normalizedOrderPriority,
      prioritySource: 'ORDER_PRIORITY',
    };
  }

  if (normalizedOrderPriority === normalizedSystemDefault) {
    return {
      orderPriority: normalizedOrderPriority,
      customerPreferenceDefaultPriority: normalizedCustomerDefaultPriority,
      effectivePriority: normalizedCustomerDefaultPriority,
      prioritySource: 'CUSTOMER_DEFAULT',
    };
  }

  return {
    orderPriority: normalizedOrderPriority,
    customerPreferenceDefaultPriority: normalizedCustomerDefaultPriority,
    effectivePriority: normalizedOrderPriority,
    prioritySource: 'ORDER_OVERRIDE',
  };
}

