import {
  PrintingMethod,
  inferRoutingFromOrderDetails,
  isDesignOnlyOrder,
  stripOrderCategoryTags,
} from '@erp/shared';
import { api } from './api';

interface OrderLineItemSource {
  itemMasterId?: string | null;
  description?: string | null;
  quantity?: number | string | null;
  unitPrice?: number | string | null;
  notes?: string | null;
}

export interface OrderRecreationSource {
  id: string;
  orderNumber: string;
  customerName?: string | null;
  customerId?: string | null;
  companyId?: string | null;
  contactId?: string | null;
  poNumber?: string | null;
  description?: string | null;
  notes?: string | null;
  priority?: number | null;
  companyBrand?: string | null;
  dueDate?: string | null;
  routing?: string[] | null;
  lineItems?: OrderLineItemSource[] | null;
}

function requireCompanyId(source: OrderRecreationSource): string {
  if (!source.companyId) {
    throw new Error(`Cannot recreate ${source.orderNumber} because the source order has no company.`);
  }

  return source.companyId;
}

function normalizeLineItems(source: OrderRecreationSource) {
  return (source.lineItems || [])
    .map((item) => {
      const description = item.description?.trim() || '';

      return {
        itemMasterId: item.itemMasterId || undefined,
        description: description || (item.itemMasterId ? 'Item' : undefined),
        quantity: Math.max(1, Math.round(Number(item.quantity) || 1)),
        unitPrice: Math.max(0, Number(item.unitPrice) || 0),
        notes: item.notes || undefined,
      };
    })
    .filter((item) => Boolean(item.itemMasterId || item.description));
}

function buildCustomerFields(source: OrderRecreationSource) {
  return {
    customerName: source.customerName || 'Unknown Customer',
    customerId: source.customerId || undefined,
    companyId: requireCompanyId(source),
    contactId: source.contactId || undefined,
  };
}

export function isDesignOnlySource(source: Pick<OrderRecreationSource, 'description' | 'routing'>): boolean {
  return isDesignOnlyOrder({
    description: source.description ?? '',
    routing: source.routing ?? [],
  });
}

export async function fetchOrderRecreationSource(orderId: string): Promise<OrderRecreationSource> {
  const response = await api.get(`/orders/${orderId}`);
  return response.data.data as OrderRecreationSource;
}

export function buildDuplicateOrderPayload(source: OrderRecreationSource) {
  return {
    ...buildCustomerFields(source),
    poNumber: source.poNumber || undefined,
    description: `${source.description || 'Duplicated Order'} (Copy)`,
    notes: source.notes || undefined,
    priority: typeof source.priority === 'number' ? source.priority : 3,
    companyBrand: source.companyBrand ?? 'WILDE_SIGNS',
    dueDate: source.dueDate || null,
    routing: Array.isArray(source.routing) ? source.routing : [],
    lineItems: normalizeLineItems(source),
  };
}

export function buildDesignFollowOnPayload(source: OrderRecreationSource) {
  const description =
    stripOrderCategoryTags(source.description || '').trim() || `Follow-up for ${source.orderNumber}`;
  const routing = inferRoutingFromOrderDetails({
    description,
    notes: source.notes,
  }).filter((station) => station !== PrintingMethod.DESIGN);
  const followOnNote = `Follow-up order created from design-only order ${source.orderNumber}.`;
  const nextRouting = routing.length > 0 ? routing : [PrintingMethod.ORDER_ENTRY];

  return {
    ...buildCustomerFields(source),
    poNumber: source.poNumber || undefined,
    description,
    notes: source.notes ? `${source.notes}\n\n${followOnNote}` : followOnNote,
    priority: typeof source.priority === 'number' ? source.priority : 3,
    companyBrand: source.companyBrand ?? 'WILDE_SIGNS',
    dueDate: source.dueDate || null,
    routing: nextRouting,
    lineItems: normalizeLineItems(source),
  };
}
