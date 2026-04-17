import { EmailTrigger } from '@erp/shared';
import { prisma } from '../db/client.js';
import { type AuthRequest } from '../middleware/auth.js';
import { logActivity, ActivityAction, EntityType } from '../lib/activity-logger.js';
import { ensureShipmentRecordForWorkOrder } from './shipment-linking.js';
import { triggerEmail } from './email-automation.js';
import { sendOrderStatusChangedEmail } from './email.js';
import { createNotification } from '../routes/notifications.js';
import { buildOrderStatusChangedNotification } from './order-notifications.js';

type OrderStatusTransitionOrder = {
  id: string;
  orderNumber: string;
  description: string | null;
  status: string;
  dueDate: Date | null;
  customerName: string;
  customerId: string | null;
  assignedToId: string | null;
  updatedAt: Date;
};

type OrderStatusTransitionInput = {
  order: OrderStatusTransitionOrder;
  previousStatus: string;
  userId: string;
  req: AuthRequest;
};

export async function applyOrderStatusTransitionEffects(input: OrderStatusTransitionInput): Promise<void> {
  if (input.order.status === input.previousStatus) {
    return;
  }

  await logActivity({
    action: ActivityAction.STATUS_CHANGE,
    entityType: EntityType.WORK_ORDER,
    entityId: input.order.id,
    entityName: input.order.orderNumber,
    description: `Changed order #${input.order.orderNumber} status from ${input.previousStatus} to ${input.order.status}`,
    details: { fromStatus: input.previousStatus, toStatus: input.order.status },
    userId: input.userId,
    req: input.req,
  });

  if (input.order.assignedToId) {
    createNotification(
      buildOrderStatusChangedNotification({
        userId: input.order.assignedToId,
        orderId: input.order.id,
        orderNumber: input.order.orderNumber,
        fromStatus: input.previousStatus,
        toStatus: input.order.status,
      }),
    ).catch((err) => console.error('Failed to create notification:', err));

    const assignedUser = await prisma.user.findUnique({
      where: { id: input.order.assignedToId },
      select: { email: true },
    });
    if (assignedUser?.email) {
      sendOrderStatusChangedEmail(
        assignedUser.email,
        {
          orderId: input.order.id,
          orderNumber: input.order.orderNumber,
          customerName: input.order.customerName,
          description: input.order.description || '',
          status: input.order.status,
          dueDate: input.order.dueDate,
        },
        input.previousStatus,
        input.order.status,
      ).catch((err) => console.error('Failed to send status change email:', err));
    }
  }

  if (input.order.customerId) {
    const customer = await prisma.customer.findUnique({
      where: { id: input.order.customerId },
      select: { id: true, name: true, email: true },
    });
    if (customer?.email) {
      const orderContext = {
        order: {
          id: input.order.id,
          orderNumber: input.order.orderNumber,
          description: input.order.description || '',
          status: input.order.status,
          dueDate: input.order.dueDate,
          customerName: input.order.customerName,
        },
        customer: {
          id: customer.id,
          name: customer.name,
          email: customer.email,
        },
      };

      triggerEmail(EmailTrigger.ORDER_STATUS_CHANGED, orderContext).catch((err) =>
        console.error('Failed to trigger ORDER_STATUS_CHANGED email:', err),
      );

      if (input.order.status === 'COMPLETED') {
        triggerEmail(EmailTrigger.ORDER_COMPLETED, orderContext).catch((err) =>
          console.error('Failed to trigger ORDER_COMPLETED email:', err),
        );
      } else if (input.order.status === 'SHIPPED') {
        triggerEmail(EmailTrigger.ORDER_SHIPPED, orderContext).catch((err) =>
          console.error('Failed to trigger ORDER_SHIPPED email:', err),
        );
      }
    }
  }

  if (input.order.status === 'SHIPPED') {
    try {
      await ensureShipmentRecordForWorkOrder(
        {
          id: input.order.id,
          orderNumber: input.order.orderNumber,
          customerName: input.order.customerName,
          description: input.order.description,
          createdById: input.userId,
          updatedAt: input.order.updatedAt,
        },
        {
          createdById: input.userId,
          shipDate: new Date(),
          notes: `Auto-created from SHIPPED order ${input.order.orderNumber}`,
        },
      );
    } catch (err) {
      console.warn(`Failed to auto-create shipment record for order ${input.order.orderNumber}:`, err);
    }
  }
}
