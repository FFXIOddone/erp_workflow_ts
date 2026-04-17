import { describe, expect, it } from 'vitest';
import {
  buildOrderAssignedNotification,
  buildOrderStatusChangedNotification,
} from './order-notifications.js';

describe('order notification builders', () => {
  it('builds a status-change notification with a default order link and structured data', () => {
    const notification = buildOrderStatusChangedNotification({
      userId: 'user-1',
      orderId: 'order-1',
      orderNumber: '64586',
      fromStatus: 'IN_PROGRESS',
      toStatus: 'COMPLETED',
    });

    expect(notification).toEqual({
      userId: 'user-1',
      type: 'ORDER_STATUS_CHANGED',
      title: 'Order Status Updated',
      message: 'Order #64586 status changed to COMPLETED',
      link: '/orders/order-1',
      relatedOrderId: 'order-1',
      data: {
        orderId: 'order-1',
        orderNumber: '64586',
        fromStatus: 'IN_PROGRESS',
        toStatus: 'COMPLETED',
      },
    });
  });

  it('builds an assigned-order notification with custom copy and related order context', () => {
    const notification = buildOrderAssignedNotification({
      userId: 'user-2',
      orderId: 'order-2',
      orderNumber: '64487',
      relatedOrderId: 'order-3',
      title: 'Orders Assigned to You',
      message: '2 order(s) have been assigned to you',
    });

    expect(notification).toEqual({
      userId: 'user-2',
      type: 'ORDER_ASSIGNED',
      title: 'Orders Assigned to You',
      message: '2 order(s) have been assigned to you',
      link: '/orders/order-3',
      relatedOrderId: 'order-3',
      data: {
        orderId: 'order-2',
        orderNumber: '64487',
      },
    });
  });
});
