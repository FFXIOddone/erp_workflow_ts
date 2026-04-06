import { Router, type Response } from 'express';
import bcrypt from 'bcrypt';
import {
  CreateUserSchema,
  UpdateUserSchema,
  ChangePasswordSchema,
  PaginationSchema,
  UserRole,
} from '@erp/shared';
import { prisma } from '../db/client.js';
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth.js';
import { NotFoundError, BadRequestError, ForbiddenError, ConflictError } from '../middleware/error-handler.js';
import { normalizeUsername } from '../lib/username.js';

export const usersRouter = Router();

usersRouter.use(authenticate);

// GET /users - List users (admin/manager only)
usersRouter.get('/', requireRole(UserRole.ADMIN, UserRole.MANAGER), async (req: AuthRequest, res: Response) => {
  const { page, pageSize } = PaginationSchema.parse(req.query);

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        role: true,
        isActive: true,
        allowedStations: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { displayName: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count(),
  ]);

  res.json({
    success: true,
    data: {
      items: users,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  });
});

// GET /users/:id
usersRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  // Users can view themselves, admins/managers can view anyone
  if (req.params.id !== req.userId && req.user?.role !== 'ADMIN' && req.user?.role !== 'MANAGER') {
    throw ForbiddenError();
  }

  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      username: true,
      displayName: true,
      email: true,
      role: true,
      isActive: true,
      allowedStations: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) throw NotFoundError('User not found');

  res.json({ success: true, data: user });
});

// POST /users - Create user (admin only)
usersRouter.post('/', requireRole(UserRole.ADMIN), async (req: AuthRequest, res: Response) => {
  const data = CreateUserSchema.parse(req.body);
  const username = normalizeUsername(data.username);

  if (username.length < 3) {
    throw BadRequestError('Username must be at least 3 characters');
  }

  const existingUser = await prisma.user.findFirst({
    where: {
      username: {
        equals: username,
        mode: 'insensitive',
      },
    },
    select: { id: true },
  });

  if (existingUser) {
    throw ConflictError('Username already exists');
  }

  const passwordHash = await bcrypt.hash(data.password, 12);

  const user = await prisma.user.create({
    data: {
      username,
      passwordHash,
      displayName: data.displayName,
      email: data.email,
      role: data.role,
      allowedStations: data.allowedStations,
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      email: true,
      role: true,
      isActive: true,
      allowedStations: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  res.status(201).json({ success: true, data: user });
});

// PATCH /users/:id
usersRouter.patch('/:id', async (req: AuthRequest, res: Response) => {
  const data = UpdateUserSchema.parse(req.body);

  // Only admins can update other users or change roles
  if (req.params.id !== req.userId) {
    if (req.user?.role !== 'ADMIN') {
      throw ForbiddenError();
    }
  } else {
    // Users can't change their own role or active status
    delete data.role;
    delete data.isActive;
  }

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data,
    select: {
      id: true,
      username: true,
      displayName: true,
      email: true,
      role: true,
      isActive: true,
      allowedStations: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  res.json({ success: true, data: user });
});

// POST /users/:id/password - Change password
usersRouter.post('/:id/password', async (req: AuthRequest, res: Response) => {
  // Users can change their own password, admins can change anyone's
  if (req.params.id !== req.userId && req.user?.role !== 'ADMIN') {
    throw ForbiddenError();
  }

  const data = ChangePasswordSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) throw NotFoundError('User not found');

  // Verify current password (skip for admin changing others)
  if (req.params.id === req.userId) {
    const valid = await bcrypt.compare(data.currentPassword, user.passwordHash);
    if (!valid) throw BadRequestError('Current password is incorrect');
  }

  const passwordHash = await bcrypt.hash(data.newPassword, 12);
  await prisma.user.update({
    where: { id: req.params.id },
    data: { passwordHash },
  });

  res.json({ success: true, message: 'Password updated' });
});

// DELETE /users/:id (admin only)
usersRouter.delete('/:id', requireRole(UserRole.ADMIN), async (req: AuthRequest, res: Response) => {
  if (req.params.id === req.userId) {
    throw BadRequestError('Cannot delete your own account');
  }

  await prisma.user.delete({ where: { id: req.params.id } });

  res.json({ success: true, message: 'User deleted' });
});

// GET /users/me/profile - Get current user's full profile
usersRouter.get('/me/profile', async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: {
      id: true,
      username: true,
      displayName: true,
      email: true,
      role: true,
      isActive: true,
      allowedStations: true,
      profilePhoto: true,
      createdAt: true,
      updatedAt: true,
      workSchedules: {
        orderBy: { dayOfWeek: 'asc' },
      },
      timeOffRequests: {
        where: { startDate: { gte: new Date() } },
        orderBy: { startDate: 'asc' },
      },
    },
  });

  if (!user) throw NotFoundError('User not found');

  res.json({ success: true, data: user });
});

// PATCH /users/me/profile - Update current user's profile
usersRouter.patch('/me/profile', async (req: AuthRequest, res: Response) => {
  const { displayName, email, profilePhoto } = req.body;

  const user = await prisma.user.update({
    where: { id: req.userId },
    data: {
      ...(displayName && { displayName }),
      ...(email !== undefined && { email }),
      ...(profilePhoto !== undefined && { profilePhoto }),
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      email: true,
      role: true,
      isActive: true,
      allowedStations: true,
      profilePhoto: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  res.json({ success: true, data: user });
});

// GET /users/me/schedule - Get current user's work schedule
usersRouter.get('/me/schedule', async (req: AuthRequest, res: Response) => {
  const schedules = await prisma.workSchedule.findMany({
    where: { userId: req.userId },
    orderBy: { dayOfWeek: 'asc' },
  });

  res.json({ success: true, data: schedules });
});

// PUT /users/me/schedule - Set current user's work schedule
usersRouter.put('/me/schedule', async (req: AuthRequest, res: Response) => {
  const { schedules } = req.body as {
    schedules: Array<{
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      isActive: boolean;
    }>;
  };

  // Delete existing schedules and create new ones
  await prisma.workSchedule.deleteMany({ where: { userId: req.userId } });

  const created = await prisma.workSchedule.createMany({
    data: schedules.map((s) => ({
      userId: req.userId!,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      isActive: s.isActive,
    })),
  });

  const updatedSchedules = await prisma.workSchedule.findMany({
    where: { userId: req.userId },
    orderBy: { dayOfWeek: 'asc' },
  });

  res.json({ success: true, data: updatedSchedules });
});

// GET /users/me/time-off - Get current user's time off requests
usersRouter.get('/me/time-off', async (req: AuthRequest, res: Response) => {
  const requests = await prisma.timeOffRequest.findMany({
    where: { userId: req.userId },
    orderBy: { startDate: 'desc' },
  });

  res.json({ success: true, data: requests });
});

// POST /users/me/time-off - Create time off request
usersRouter.post('/me/time-off', async (req: AuthRequest, res: Response) => {
  const { startDate, endDate, type, reason } = req.body as {
    startDate: string;
    endDate: string;
    type: string;
    reason?: string;
  };

  const request = await prisma.timeOffRequest.create({
    data: {
      userId: req.userId!,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      type: type as never,
      reason,
    },
  });

  res.status(201).json({ success: true, data: request });
});

// DELETE /users/me/time-off/:id - Cancel time off request
usersRouter.delete('/me/time-off/:requestId', async (req: AuthRequest, res: Response) => {
  const request = await prisma.timeOffRequest.findFirst({
    where: { id: req.params.requestId, userId: req.userId },
  });

  if (!request) throw NotFoundError('Time off request not found');
  if (request.status !== 'PENDING') {
    throw BadRequestError('Can only cancel pending requests');
  }

  await prisma.timeOffRequest.update({
    where: { id: req.params.requestId },
    data: { status: 'CANCELLED' },
  });

  res.json({ success: true, message: 'Time off request cancelled' });
});

// PATCH /users/:userId/time-off/:requestId - Approve/Deny time off (admin/manager)
usersRouter.patch('/:userId/time-off/:requestId', requireRole(UserRole.ADMIN, UserRole.MANAGER), async (req: AuthRequest, res: Response) => {
  const { status } = req.body as { status: string };

  if (!['APPROVED', 'DENIED'].includes(status)) {
    throw BadRequestError('Invalid status');
  }

  const request = await prisma.timeOffRequest.update({
    where: { id: req.params.requestId },
    data: { 
      status: status as never,
      approvedBy: req.userId,
    },
  });

  res.json({ success: true, data: request });
});
