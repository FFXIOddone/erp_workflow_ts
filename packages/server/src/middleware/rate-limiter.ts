/**
 * Rate Limiting & Brute Force Protection Middleware
 * 
 * Implements:
 * - IP-based rate limiting for login attempts
 * - Account lockout after failed attempts
 * - Progressive delay (exponential backoff)
 * - Failed login audit logging
 */

import rateLimit from 'express-rate-limit';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/client.js';
import { logActivity, ActivityAction, EntityType } from '../lib/activity-logger.js';

// ============ Configuration ============
const LOGIN_RATE_LIMIT = {
  WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  MAX_ATTEMPTS: 5, // 5 attempts per window per IP
  BLOCK_DURATION_MS: 30 * 60 * 1000, // 30 minute block after limit reached
};

const ACCOUNT_LOCKOUT = {
  MAX_FAILED_ATTEMPTS: 10, // Lock account after 10 failed attempts
  LOCKOUT_DURATION_MS: 30 * 60 * 1000, // 30 minute lockout
  RESET_AFTER_SUCCESS: true, // Reset counter on successful login
};

const PROGRESSIVE_DELAY = {
  ENABLED: true,
  BASE_DELAY_MS: 1000, // 1 second base delay
  MAX_DELAY_MS: 30000, // Max 30 second delay
  EXPONENT: 2, // Exponential factor
};

// ============ In-Memory Stores (for production, use Redis) ============
interface FailedAttempt {
  count: number;
  lastAttempt: number;
  lockoutUntil?: number;
}

// Track failed attempts by IP
const ipFailedAttempts = new Map<string, FailedAttempt>();

// Track failed attempts by username
const userFailedAttempts = new Map<string, FailedAttempt>();

// ============ Helper Functions ============

/**
 * Get client IP address from request
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress ?? 'unknown';
}

/**
 * Calculate progressive delay based on failed attempts
 */
function calculateDelay(failedCount: number): number {
  if (!PROGRESSIVE_DELAY.ENABLED || failedCount === 0) return 0;
  const delay = PROGRESSIVE_DELAY.BASE_DELAY_MS * Math.pow(PROGRESSIVE_DELAY.EXPONENT, failedCount - 1);
  return Math.min(delay, PROGRESSIVE_DELAY.MAX_DELAY_MS);
}

/**
 * Clean up old entries from the maps (garbage collection)
 */
function cleanupOldEntries(): void {
  const now = Date.now();
  const staleThreshold = 60 * 60 * 1000; // 1 hour

  for (const [key, value] of ipFailedAttempts.entries()) {
    if (now - value.lastAttempt > staleThreshold) {
      ipFailedAttempts.delete(key);
    }
  }

  for (const [key, value] of userFailedAttempts.entries()) {
    if (now - value.lastAttempt > staleThreshold) {
      userFailedAttempts.delete(key);
    }
  }
}

// Run cleanup every 10 minutes
setInterval(cleanupOldEntries, 10 * 60 * 1000);

// ============ Express Rate Limiter for Login ============

/**
 * IP-based rate limiter for login endpoint
 * Blocks IPs after too many requests
 */
export const loginRateLimiter = rateLimit({
  windowMs: LOGIN_RATE_LIMIT.WINDOW_MS,
  max: LOGIN_RATE_LIMIT.MAX_ATTEMPTS,
  message: {
    success: false,
    error: 'Too many login attempts from this IP. Please try again later.',
    retryAfter: Math.ceil(LOGIN_RATE_LIMIT.WINDOW_MS / 1000),
  },
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false,
  keyGenerator: getClientIp,
  skip: (req) => {
    // Skip rate limiting for internal/trusted IPs in development
    if (process.env.NODE_ENV === 'development') {
      const ip = getClientIp(req);
      return ip === '127.0.0.1' || ip === '::1' || ip === 'localhost';
    }
    return false;
  },
});

/**
 * General API rate limiter (less strict)
 */
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200, // 200 requests per minute per IP
  message: {
    success: false,
    error: 'Too many requests. Please slow down.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientIp,
});

// ============ Pre-Login Check Middleware ============

/**
 * Check if IP or username is currently locked out before processing login
 */
export async function preLoginCheck(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const ip = getClientIp(req);
  const { username } = req.body as { username?: string };
  const now = Date.now();

  // Check IP lockout
  const ipAttempts = ipFailedAttempts.get(ip);
  if (ipAttempts?.lockoutUntil && ipAttempts.lockoutUntil > now) {
    const remainingMs = ipAttempts.lockoutUntil - now;
    const remainingMinutes = Math.ceil(remainingMs / 60000);
    
    res.status(429).json({
      success: false,
      error: `Your IP is temporarily blocked. Please try again in ${remainingMinutes} minute(s).`,
      lockedOut: true,
      retryAfter: Math.ceil(remainingMs / 1000),
    });
    return;
  }

  // Check username lockout
  if (username) {
    const userAttempts = userFailedAttempts.get(username.toLowerCase());
    if (userAttempts?.lockoutUntil && userAttempts.lockoutUntil > now) {
      const remainingMs = userAttempts.lockoutUntil - now;
      const remainingMinutes = Math.ceil(remainingMs / 60000);
      
      // Log the blocked attempt
      await logSecurityEvent('LOGIN_BLOCKED_LOCKOUT', ip, username, {
        reason: 'Account locked due to too many failed attempts',
        remainingMinutes,
      });
      
      res.status(429).json({
        success: false,
        error: `This account is temporarily locked. Please try again in ${remainingMinutes} minute(s) or contact an administrator.`,
        lockedOut: true,
        retryAfter: Math.ceil(remainingMs / 1000),
      });
      return;
    }

    // Apply progressive delay if there were previous failures
    if (userAttempts && userAttempts.count > 0) {
      const delay = calculateDelay(userAttempts.count);
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  next();
}

// ============ Post-Login Handlers ============

/**
 * Record a failed login attempt
 */
export async function recordFailedLogin(
  req: Request,
  username: string,
  reason: string
): Promise<void> {
  const ip = getClientIp(req);
  const now = Date.now();

  // Update IP failed attempts
  const ipAttempts = ipFailedAttempts.get(ip) ?? { count: 0, lastAttempt: 0 };
  ipAttempts.count++;
  ipAttempts.lastAttempt = now;
  
  // Check if IP should be locked out
  if (ipAttempts.count >= LOGIN_RATE_LIMIT.MAX_ATTEMPTS * 2) {
    ipAttempts.lockoutUntil = now + LOGIN_RATE_LIMIT.BLOCK_DURATION_MS;
  }
  ipFailedAttempts.set(ip, ipAttempts);

  // Update username failed attempts
  const userKey = username.toLowerCase();
  const userAttempts = userFailedAttempts.get(userKey) ?? { count: 0, lastAttempt: 0 };
  userAttempts.count++;
  userAttempts.lastAttempt = now;
  
  // Check if account should be locked out
  if (userAttempts.count >= ACCOUNT_LOCKOUT.MAX_FAILED_ATTEMPTS) {
    userAttempts.lockoutUntil = now + ACCOUNT_LOCKOUT.LOCKOUT_DURATION_MS;
    
    // Log account lockout
    await logSecurityEvent('ACCOUNT_LOCKED', ip, username, {
      failedAttempts: userAttempts.count,
      lockoutDurationMinutes: ACCOUNT_LOCKOUT.LOCKOUT_DURATION_MS / 60000,
    });
  }
  userFailedAttempts.set(userKey, userAttempts);

  // Log the failed attempt
  await logSecurityEvent('LOGIN_FAILED', ip, username, {
    reason,
    attemptNumber: userAttempts.count,
    ipAttemptNumber: ipAttempts.count,
  });
}

/**
 * Record a successful login (resets counters)
 */
export async function recordSuccessfulLogin(
  req: Request,
  userId: string,
  username: string
): Promise<void> {
  const ip = getClientIp(req);

  // Reset username failed attempts
  if (ACCOUNT_LOCKOUT.RESET_AFTER_SUCCESS) {
    userFailedAttempts.delete(username.toLowerCase());
  }

  // Don't fully reset IP - just reduce the count to prevent abuse
  const ipAttempts = ipFailedAttempts.get(ip);
  if (ipAttempts) {
    ipAttempts.count = Math.max(0, ipAttempts.count - 2);
    if (ipAttempts.count === 0) {
      ipFailedAttempts.delete(ip);
    }
  }

  // Log successful login
  await logSecurityEvent('LOGIN_SUCCESS', ip, username, { userId });
}

// ============ Security Event Logging ============

type SecurityEventType = 
  | 'LOGIN_FAILED'
  | 'LOGIN_SUCCESS'
  | 'LOGIN_BLOCKED_LOCKOUT'
  | 'ACCOUNT_LOCKED'
  | 'RATE_LIMIT_EXCEEDED';

/**
 * Log security events to the activity log
 */
async function logSecurityEvent(
  eventType: SecurityEventType,
  ip: string,
  username: string,
  details: Record<string, unknown>
): Promise<void> {
  try {
    // Find user if exists (for activity logging)
    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    const description = formatSecurityEventDescription(eventType, username, details);

    await prisma.activityLog.create({
      data: {
        action: eventType === 'LOGIN_SUCCESS' ? 'LOGIN' : 'LOGIN_ATTEMPT',
        entityType: 'USER',
        entityId: user?.id ?? 'unknown',
        description,
        userId: user?.id ?? null,
        ipAddress: ip,
        details: {
          eventType,
          username,
          ...details,
          timestamp: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    // Don't throw - logging failures shouldn't break auth
    console.error('Failed to log security event:', error);
  }
}

/**
 * Format human-readable description for security events
 */
function formatSecurityEventDescription(
  eventType: SecurityEventType,
  username: string,
  details: Record<string, unknown>
): string {
  switch (eventType) {
    case 'LOGIN_FAILED':
      return `Failed login attempt for user "${username}" (attempt #${details.attemptNumber}): ${details.reason}`;
    case 'LOGIN_SUCCESS':
      return `Successful login for user "${username}"`;
    case 'LOGIN_BLOCKED_LOCKOUT':
      return `Login blocked for user "${username}" - account is locked (${details.remainingMinutes} minutes remaining)`;
    case 'ACCOUNT_LOCKED':
      return `Account "${username}" locked after ${details.failedAttempts} failed attempts`;
    case 'RATE_LIMIT_EXCEEDED':
      return `Rate limit exceeded for user "${username}"`;
    default:
      return `Security event: ${eventType} for user "${username}"`;
  }
}

// ============ Admin Functions ============

/**
 * Manually unlock a user account (for admin use)
 */
export function unlockAccount(username: string): boolean {
  const userKey = username.toLowerCase();
  if (userFailedAttempts.has(userKey)) {
    userFailedAttempts.delete(userKey);
    return true;
  }
  return false;
}

/**
 * Manually unblock an IP address (for admin use)
 */
export function unblockIp(ip: string): boolean {
  if (ipFailedAttempts.has(ip)) {
    ipFailedAttempts.delete(ip);
    return true;
  }
  return false;
}

/**
 * Get current lockout status for monitoring
 */
export function getLockoutStatus(): {
  lockedAccounts: Array<{ username: string; lockoutUntil: Date; failedAttempts: number }>;
  blockedIps: Array<{ ip: string; lockoutUntil: Date; failedAttempts: number }>;
} {
  const now = Date.now();
  const lockedAccounts: Array<{ username: string; lockoutUntil: Date; failedAttempts: number }> = [];
  const blockedIps: Array<{ ip: string; lockoutUntil: Date; failedAttempts: number }> = [];

  for (const [username, data] of userFailedAttempts.entries()) {
    if (data.lockoutUntil && data.lockoutUntil > now) {
      lockedAccounts.push({
        username,
        lockoutUntil: new Date(data.lockoutUntil),
        failedAttempts: data.count,
      });
    }
  }

  for (const [ip, data] of ipFailedAttempts.entries()) {
    if (data.lockoutUntil && data.lockoutUntil > now) {
      blockedIps.push({
        ip,
        lockoutUntil: new Date(data.lockoutUntil),
        failedAttempts: data.count,
      });
    }
  }

  return { lockedAccounts, blockedIps };
}
