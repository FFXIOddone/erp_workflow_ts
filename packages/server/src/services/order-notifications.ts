import { type NotificationType } from '../routes/notifications.js';

type OrderNotificationBase = {
  userId: string;
  orderId: string;
  orderNumber: string;
  relatedOrderId?: string;
  link?: string;
  data?: Record<string, unknown>;
};

type OrderStatusChangedNotificationInput = OrderNotificationBase & {
  fromStatus?: string;
  toStatus: string;
  title?: string;
  message?: string;
};

type OrderAssignedNotificationInput = OrderNotificationBase & {
  title?: string;
  message?: string;
};

type BuiltOrderNotification = {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  relatedOrderId?: string;
  data?: Record<string, unknown>;
};

function buildOrderNotificationBase(input: OrderNotificationBase): Pick<BuiltOrderNotification, 'userId' | 'link' | 'relatedOrderId' | 'data'> {
  const relatedOrderId = input.relatedOrderId ?? input.orderId;
  return {
    userId: input.userId,
    link: input.link ?? `/orders/${relatedOrderId}`,
    relatedOrderId,
    data: {
      orderId: input.orderId,
      orderNumber: input.orderNumber,
      ...(input.data ?? {}),
    },
  };
}

export function buildOrderStatusChangedNotification(
  input: OrderStatusChangedNotificationInput,
): BuiltOrderNotification {
  const base = buildOrderNotificationBase(input);
  return {
    ...base,
    type: 'ORDER_STATUS_CHANGED',
    title: input.title ?? 'Order Status Updated',
    message: input.message ?? `Order #${input.orderNumber} status changed to ${input.toStatus}`,
    data: {
      ...(base.data ?? {}),
      fromStatus: input.fromStatus ?? null,
      toStatus: input.toStatus,
    },
  };
}

export function buildOrderAssignedNotification(
  input: OrderAssignedNotificationInput,
): BuiltOrderNotification {
  const base = buildOrderNotificationBase(input);
  return {
    ...base,
    type: 'ORDER_ASSIGNED',
    title: input.title ?? 'Order Assigned to You',
    message: input.message ?? `Order #${input.orderNumber} has been assigned to you`,
    data: base.data,
  };
}
