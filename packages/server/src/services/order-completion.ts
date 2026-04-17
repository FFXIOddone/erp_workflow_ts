import { EmailTrigger } from '@erp/shared';
import { prisma } from '../db/client.js';
import { BadRequestError, NotFoundError } from '../middleware/error-handler.js';
import { broadcast } from '../ws/server.js';
import { logActivity, ActivityAction, EntityType } from '../lib/activity-logger.js';
import { notifyAdminsAndManagers } from '../routes/notifications.js';
import { triggerEmail } from './email-automation.js';

type OrderCompletionMutationInput = {
  orderId: string;
  userId: string;
  requestedByName?: string | null;
  requestValidation: boolean;
  estimatedShipDate?: Date;
  notes?: string;
};

type OrderCompletionMutationResult =
  | {
      validationRequested: true;
      orderId: string;
      orderNumber: string;
      estimatedShipDate: string | null;
    }
  | {
      validationRequested: false;
      updatedOrder: Awaited<ReturnType<typeof prisma.workOrder.update>>;
    };

export async function applyOrderCompletionMutation(
  input: OrderCompletionMutationInput,
): Promise<OrderCompletionMutationResult> {
  const order = await prisma.workOrder.findUnique({
    where: { id: input.orderId },
    include: { stationProgress: true },
  });

  if (!order) {
    throw NotFoundError('Order not found');
  }

  if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
    throw BadRequestError(`Order is already ${order.status.toLowerCase()}`);
  }

  if (input.requestValidation) {
    await prisma.workEvent.create({
      data: {
        orderId: input.orderId,
        eventType: 'NOTE_ADDED',
        description: 'Order completion validation requested',
        userId: input.userId,
        details: {
          requestedById: input.userId,
          requestedByName: input.requestedByName ?? null,
          estimatedShipDate: input.estimatedShipDate?.toISOString() ?? null,
          notes: input.notes ?? null,
        },
      },
    });

    await logActivity({
      action: ActivityAction.UPDATE,
      entityType: EntityType.WORK_ORDER,
      entityId: input.orderId,
      userId: input.userId,
      description: `Completion validation requested for order ${order.orderNumber}`,
      details: {
        estimatedShipDate: input.estimatedShipDate?.toISOString() ?? null,
        notes: input.notes ?? null,
      },
    });

    await notifyAdminsAndManagers({
      type: 'ORDER_COMPLETION_VALIDATION_REQUESTED',
      title: 'Order Completion Validation Requested',
      message: `${input.requestedByName ?? 'A user'} requested completion validation for order ${order.orderNumber}.`,
      relatedOrderId: input.orderId,
      data: {
        orderId: input.orderId,
        orderNumber: order.orderNumber,
        requestedById: input.userId,
        requestedByName: input.requestedByName ?? null,
        estimatedShipDate: input.estimatedShipDate?.toISOString() ?? null,
        notes: input.notes ?? null,
      },
    });

    broadcast({
      type: 'ORDER_UPDATED',
      payload: { orderId: input.orderId, validationRequested: true },
      timestamp: new Date(),
    });

    return {
      validationRequested: true,
      orderId: input.orderId,
      orderNumber: order.orderNumber,
      estimatedShipDate: input.estimatedShipDate?.toISOString() ?? null,
    };
  }

  await prisma.stationProgress.updateMany({
    where: { orderId: input.orderId, status: { not: 'COMPLETED' } },
    data: { status: 'COMPLETED', completedAt: new Date(), completedById: input.userId },
  });

  const updatedOrder = await prisma.workOrder.update({
    where: { id: input.orderId },
    data: { status: 'COMPLETED' },
    include: {
      stationProgress: true,
      lineItems: true,
      createdBy: { select: { id: true, displayName: true } },
      assignedTo: { select: { id: true, displayName: true } },
    },
  });

  await prisma.workEvent.create({
    data: {
      orderId: input.orderId,
      eventType: 'STATUS_CHANGED',
      description: 'Order marked complete',
      userId: input.userId,
      details: { previousStatus: order.status, newStatus: 'COMPLETED' },
    },
  });

  await logActivity({
    action: ActivityAction.STATUS_CHANGE,
    entityType: EntityType.WORK_ORDER,
    entityId: input.orderId,
    userId: input.userId,
    description: `Order ${order.orderNumber} marked complete`,
    details: { previousStatus: order.status, newStatus: 'COMPLETED' },
  });

  try {
    await triggerEmail(EmailTrigger.ORDER_COMPLETED, {
      order: {
        id: input.orderId,
        orderNumber: order.orderNumber,
        description: order.description || '',
        status: 'COMPLETED',
        dueDate: order.dueDate,
        customerName: order.customerName,
      },
    });
  } catch (err) {
    console.warn('Email trigger warning:', err);
  }

  broadcast({ type: 'ORDER_UPDATED', payload: updatedOrder, timestamp: new Date() });

  return {
    validationRequested: false,
    updatedOrder,
  };
}
