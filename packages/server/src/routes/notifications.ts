import { Router, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { NotFoundError, ForbiddenError } from '../middleware/error-handler.js';
import { broadcast } from '../ws/server.js';

export const notificationsRouter = Router();

notificationsRouter.use(authenticate);

// GET /notifications - Get current user's notifications
notificationsRouter.get('/', async (req: AuthRequest, res: Response) => {
  const { unreadOnly, limit } = z.object({
    unreadOnly: z.coerce.boolean().optional().default(false),
    limit: z.coerce.number().min(1).max(100).optional().default(50),
  }).parse(req.query);

  const notifications = await prisma.notification.findMany({
    where: {
      userId: req.userId!,
      ...(unreadOnly ? { isRead: false } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  res.json({ success: true, data: notifications });
});

// GET /notifications/count - Get unread count
notificationsRouter.get('/count', async (req: AuthRequest, res: Response) => {
  const count = await prisma.notification.count({
    where: {
      userId: req.userId!,
      isRead: false,
    },
  });

  res.json({ success: true, data: { count } });
});

// PATCH /notifications/:id/read - Mark single notification as read
notificationsRouter.patch('/:id/read', async (req: AuthRequest, res: Response) => {
  const notification = await prisma.notification.findUnique({
    where: { id: req.params.id },
  });

  if (!notification) throw NotFoundError('Notification not found');
  if (notification.userId !== req.userId) throw ForbiddenError();

  const updated = await prisma.notification.update({
    where: { id: req.params.id },
    data: { isRead: true },
  });

  res.json({ success: true, data: updated });
});

// PATCH /notifications/read-all - Mark all notifications as read
notificationsRouter.patch('/read-all', async (req: AuthRequest, res: Response) => {
  await prisma.notification.updateMany({
    where: {
      userId: req.userId!,
      isRead: false,
    },
    data: { isRead: true },
  });

  res.json({ success: true, message: 'All notifications marked as read' });
});

// DELETE /notifications/:id - Delete a notification
notificationsRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  const notification = await prisma.notification.findUnique({
    where: { id: req.params.id },
  });

  if (!notification) throw NotFoundError('Notification not found');
  if (notification.userId !== req.userId) throw ForbiddenError();

  await prisma.notification.delete({
    where: { id: req.params.id },
  });

  res.json({ success: true, message: 'Notification deleted' });
});

// DELETE /notifications - Delete all read notifications
notificationsRouter.delete('/', async (req: AuthRequest, res: Response) => {
  await prisma.notification.deleteMany({
    where: {
      userId: req.userId!,
      isRead: true,
    },
  });

  res.json({ success: true, message: 'Read notifications deleted' });
});

// ============ Notification Helper Functions ============

export type NotificationType = 
  | 'ORDER_CREATED'
  | 'ORDER_STATUS_CHANGED'
  | 'ORDER_ASSIGNED'
  | 'ORDER_DUE_SOON'
  | 'ORDER_OVERDUE'
  | 'STATION_COMPLETED'
  | 'REPRINT_REQUESTED'
  | 'REPRINT_RESOLVED'
  | 'TIME_OFF_APPROVED'
  | 'TIME_OFF_DENIED'
  | 'QUOTE_APPROVED'
  | 'QUOTE_REJECTED'
  | 'MENTION'
  | 'SYSTEM';

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  data?: Record<string, unknown>;
  relatedOrderId?: string;
}

/**
 * Create a notification for a user and broadcast via WebSocket
 */
export async function createNotification(params: CreateNotificationParams): Promise<void> {
  const notification = await prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      link: params.link ?? (params.relatedOrderId ? `/orders/${params.relatedOrderId}` : undefined),
      data: params.data as object | undefined,
    },
  });

  // Broadcast to the specific user via WebSocket
  broadcast({
    type: 'NOTIFICATION_CREATED',
    payload: notification,
    targetUserId: params.userId,
  });
}

/**
 * Create notifications for multiple users
 */
export async function createNotifications(
  userIds: string[],
  params: Omit<CreateNotificationParams, 'userId'>
): Promise<void> {
  await Promise.all(
    userIds.map(userId => createNotification({ ...params, userId }))
  );
}

/**
 * Notify all admins and managers of an event
 */
export async function notifyAdminsAndManagers(
  params: Omit<CreateNotificationParams, 'userId'>
): Promise<void> {
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      role: { in: ['ADMIN', 'MANAGER'] },
    },
    select: { id: true },
  });

  await createNotifications(users.map(u => u.id), params);
}
