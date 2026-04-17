import type { Prisma } from '@prisma/client';
import { WorkOrderReferenceSelect } from './dto-selects.js';

export function buildWorkOrderNumberWhere(orderNumber: string): Prisma.WorkOrderWhereInput {
  if (orderNumber.length === 4) {
    return {
      OR: [
        { orderNumber },
        { orderNumber: `WO${orderNumber}` },
        { orderNumber: { endsWith: orderNumber } },
      ],
    };
  }

  return {
    OR: [
      { orderNumber },
      { orderNumber: `WO${orderNumber}` },
      { orderNumber: { contains: orderNumber } },
    ],
  };
}

export const WORK_ORDER_REFERENCE_SELECT = WorkOrderReferenceSelect;
