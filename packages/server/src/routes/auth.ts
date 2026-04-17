import { Router, type Response } from 'express';
import bcrypt from 'bcrypt';
import { LoginSchema, UserRole } from '@erp/shared';
import { EULA_VERSION } from '@erp/shared';
import { prisma } from '../db/client.js';
import { generateToken, authenticate, type AuthRequest } from '../middleware/auth.js';
import { UnauthorizedError } from '../middleware/error-handler.js';
import { logActivity, ActivityAction, EntityType } from '../lib/activity-logger.js';
import { buildRouteActivityPayload } from '../lib/route-activity.js';
import { normalizeUsername } from '../lib/username.js';
import {
  loginRateLimiter,
  preLoginCheck,
  recordFailedLogin,
  recordSuccessfulLogin,
  unlockAccount,
  unblockIp,
  getLockoutStatus,
} from '../middleware/rate-limiter.js';

export const authRouter = Router();

// POST /auth/login - Protected by rate limiting and lockout checks
authRouter.post('/login', loginRateLimiter, preLoginCheck, async (req: AuthRequest, res: Response) => {
  const { username: rawUsername, password } = LoginSchema.parse(req.body);
  const username = normalizeUsername(rawUsername);
  const ip = req.headers['x-forwarded-for'];
  const clientIp = typeof ip === 'string' ? ip.split(',')[0].trim() : req.socket?.remoteAddress ?? 'unknown';

  console.info(`[AUTH] Login attempt for "${username}" from ${clientIp}`);

  const user = await prisma.user.findFirst({
    where: {
      username: {
        equals: username,
        mode: 'insensitive',
      },
    },
  });

  if (!user || !user.isActive) {
    // Record failed attempt for brute force protection
    await recordFailedLogin(req, username, user ? 'Account inactive' : 'User not found');
    console.warn(`[AUTH] Login failed for "${username}" from ${clientIp}: ${user ? 'Account inactive' : 'User not found'}`);
    
    logActivity(
      buildRouteActivityPayload({
        action: ActivityAction.LOGIN_FAILED,
        entityType: EntityType.USER,
        entityId: username,
        entityName: username,
        description: `Failed login attempt for username: ${username}`,
        userId: 'system',
        req,
      }),
    );
    throw UnauthorizedError('Invalid credentials');
  }

  const validPassword = await bcrypt.compare(password, user.passwordHash);
  if (!validPassword) {
    // Record failed attempt for brute force protection
    await recordFailedLogin(req, username, 'Invalid password');
    console.warn(`[AUTH] Login failed for "${username}" from ${clientIp}: Invalid password`);
    
    logActivity(
      buildRouteActivityPayload({
        action: ActivityAction.LOGIN_FAILED,
        entityType: EntityType.USER,
        entityId: user.id,
        entityName: username,
        description: `Failed login attempt (wrong password) for: ${username}`,
        userId: 'system',
        req,
      }),
    );
    throw UnauthorizedError('Invalid credentials');
  }

  // Record successful login (resets lockout counters)
  await recordSuccessfulLogin(req, user.id, username);

  const token = generateToken(user);

  // Log successful login
  logActivity(
    buildRouteActivityPayload({
      action: ActivityAction.LOGIN,
      entityType: EntityType.USER,
      entityId: user.id,
      entityName: user.username,
      description: `User ${user.displayName} logged in`,
      userId: user.id,
      req,
    }),
  );
  console.info(`[AUTH] Login successful for "${username}" from ${clientIp}`);

  res.json({
    success: true,
    data: {
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        role: user.role,
        allowedStations: user.allowedStations,
        eulaAcceptedAt: user.eulaAcceptedAt,
        eulaAcceptedVersion: user.eulaAcceptedVersion,
      },
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
});

// GET /auth/me
authRouter.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  res.json({
    success: true,
    data: req.user,
  });
});

// POST /auth/refresh
authRouter.post('/refresh', authenticate, async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw UnauthorizedError();
  }

  const token = generateToken({
    id: req.user.id,
    username: req.user.username,
    role: req.user.role,
  });

  res.json({
    success: true,
    data: {
      token,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
});

// POST /auth/accept-eula
authRouter.post('/accept-eula', authenticate, async (req: AuthRequest, res: Response) => {
  if (!req.userId || !req.user) {
    throw UnauthorizedError();
  }

  const acceptedAt = new Date();
  const user = await prisma.user.update({
    where: { id: req.userId },
    data: {
      eulaAcceptedAt: acceptedAt,
      eulaAcceptedVersion: EULA_VERSION,
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      email: true,
      role: true,
      isActive: true,
      allowedStations: true,
      eulaAcceptedAt: true,
      eulaAcceptedVersion: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  logActivity(
    buildRouteActivityPayload({
      action: ActivityAction.UPDATE,
      entityType: EntityType.USER,
      entityId: user.id,
      entityName: user.username,
      description: `Accepted ERP EULA version ${EULA_VERSION}`,
      userId: user.id,
      req,
    }),
  );

  res.json({
    success: true,
    data: {
      user,
      acceptedAt,
    },
  });
});

// ============ Admin Lockout Management Endpoints ============
import { requireRole } from '../middleware/auth.js';

// GET /auth/lockout-status - View current lockouts (admin only)
authRouter.get('/lockout-status', authenticate, requireRole(UserRole.ADMIN), async (_req: AuthRequest, res: Response) => {
  const status = getLockoutStatus();
  res.json({
    success: true,
    data: status,
  });
});

// POST /auth/unlock-account - Unlock a specific account (admin only)
authRouter.post('/unlock-account', authenticate, requireRole(UserRole.ADMIN), async (req: AuthRequest, res: Response) => {
  const { username } = req.body as { username?: string };
  
  if (!username) {
    res.status(400).json({
      success: false,
      error: 'Username is required',
    });
    return;
  }

  const unlocked = unlockAccount(username);
  
  if (unlocked) {
    logActivity(
      buildRouteActivityPayload({
        action: ActivityAction.UPDATE,
        entityType: EntityType.USER,
        entityId: username,
        entityName: username,
        description: `Account "${username}" was manually unlocked by ${req.user?.displayName}`,
        userId: req.userId!,
        req,
      }),
    );
  }

  res.json({
    success: true,
    data: {
      unlocked,
      message: unlocked 
        ? `Account "${username}" has been unlocked` 
        : `Account "${username}" was not locked`,
    },
  });
});

// POST /auth/unblock-ip - Unblock a specific IP (admin only)
authRouter.post('/unblock-ip', authenticate, requireRole(UserRole.ADMIN), async (req: AuthRequest, res: Response) => {
  const { ip } = req.body as { ip?: string };
  
  if (!ip) {
    res.status(400).json({
      success: false,
      error: 'IP address is required',
    });
    return;
  }

  const unblocked = unblockIp(ip);
  
  if (unblocked) {
    logActivity(
      buildRouteActivityPayload({
        action: ActivityAction.UPDATE,
        entityType: EntityType.SYSTEM,
        entityId: ip,
        entityName: ip,
        description: `IP "${ip}" was manually unblocked by ${req.user?.displayName}`,
        userId: req.userId!,
        req,
      }),
    );
  }

  res.json({
    success: true,
    data: {
      unblocked,
      message: unblocked 
        ? `IP "${ip}" has been unblocked` 
        : `IP "${ip}" was not blocked`,
    },
  });
});
