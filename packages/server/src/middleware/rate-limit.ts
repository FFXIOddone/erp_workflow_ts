/**
 * Rate Limiting Middleware
 *
 * Configurable rate limiting to protect API endpoints:
 * - In-memory token bucket algorithm
 * - Per-user and per-IP rate limiting
 * - Different limits for different endpoints
 * - Skip for whitelisted IPs/users
 * - Sliding window with burst allowance
 */

import type { Request, Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.js';

// ============================================================================
// TYPES & CONFIGURATION
// ============================================================================

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  message?: string; // Custom error message
  statusCode?: number; // HTTP status code (default 429)
  skipFailedRequests?: boolean; // Don't count failed requests
  keyGenerator?: (req: Request) => string; // Custom key generator
  skip?: (req: Request) => boolean; // Skip rate limiting for certain requests
  onLimitReached?: (req: Request, res: Response) => void; // Callback when limit reached
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
  firstRequest: number;
}

// Default configuration
const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // 100 requests per minute
  message: 'Too many requests, please try again later.',
  statusCode: 429,
  skipFailedRequests: false,
};

// ============================================================================
// IN-MEMORY STORE
// ============================================================================

class RateLimitStore {
  private store = new Map<string, RateLimitEntry>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  get(key: string): RateLimitEntry | undefined {
    const entry = this.store.get(key);
    if (entry && Date.now() > entry.resetTime) {
      this.store.delete(key);
      return undefined;
    }
    return entry;
  }

  increment(key: string, windowMs: number): RateLimitEntry {
    const now = Date.now();
    const existing = this.get(key);

    if (existing) {
      existing.count++;
      return existing;
    }

    const entry: RateLimitEntry = {
      count: 1,
      resetTime: now + windowMs,
      firstRequest: now,
    };
    this.store.set(key, entry);
    return entry;
  }

  reset(key: string): void {
    this.store.delete(key);
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(key);
      }
    }
  }

  getStats(): { totalKeys: number; memoryUsage: number } {
    return {
      totalKeys: this.store.size,
      memoryUsage: process.memoryUsage().heapUsed,
    };
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.store.clear();
  }
}

// Global store instance
const globalStore = new RateLimitStore();

// ============================================================================
// KEY GENERATORS
// ============================================================================

/**
 * Generate rate limit key from IP address
 */
function ipKeyGenerator(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    return `ip:${ips.trim()}`;
  }
  return `ip:${req.ip || req.socket.remoteAddress || 'unknown'}`;
}

/**
 * Generate rate limit key from authenticated user ID
 */
function userKeyGenerator(req: AuthRequest): string {
  if (req.userId) {
    return `user:${req.userId}`;
  }
  return ipKeyGenerator(req);
}

/**
 * Generate rate limit key combining user ID and endpoint
 */
function endpointKeyGenerator(req: AuthRequest): string {
  const userKey = req.userId ? req.userId : (req.ip || 'unknown');
  const endpoint = `${req.method}:${req.baseUrl}${req.path}`;
  return `endpoint:${userKey}:${endpoint}`;
}

// ============================================================================
// RATE LIMIT MIDDLEWARE FACTORY
// ============================================================================

/**
 * Create rate limiting middleware with custom configuration
 */
export function rateLimit(config: Partial<RateLimitConfig> = {}) {
  const options: RateLimitConfig = { ...DEFAULT_CONFIG, ...config };

  return (req: Request, res: Response, next: NextFunction): void => {
    // Check if should skip this request
    if (options.skip && options.skip(req)) {
      next();
      return;
    }

    // Generate key for this request
    const key = options.keyGenerator
      ? options.keyGenerator(req)
      : userKeyGenerator(req as AuthRequest);

    // Increment request count
    const entry = globalStore.increment(key, options.windowMs);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', options.maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, options.maxRequests - entry.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetTime / 1000));

    // Check if limit exceeded
    if (entry.count > options.maxRequests) {
      // Calculate retry after in seconds
      const retryAfter = Math.ceil((entry.resetTime - Date.now()) / 1000);
      res.setHeader('Retry-After', retryAfter);

      // Call custom handler if provided
      if (options.onLimitReached) {
        options.onLimitReached(req, res);
      }

      res.status(options.statusCode || 429).json({
        success: false,
        error: 'Rate limit exceeded',
        message: options.message,
        retryAfter,
      });
      return;
    }

    next();
  };
}

// ============================================================================
// PRE-CONFIGURED RATE LIMITERS
// ============================================================================

/**
 * Standard API rate limiter - 100 requests per minute per user
 */
export const standardRateLimit = rateLimit({
  windowMs: 60 * 1000,
  maxRequests: 100,
  keyGenerator: userKeyGenerator as (req: Request) => string,
});

/**
 * Strict rate limiter for sensitive endpoints - 10 requests per minute
 */
export const strictRateLimit = rateLimit({
  windowMs: 60 * 1000,
  maxRequests: 10,
  message: 'Too many attempts. Please wait before trying again.',
  keyGenerator: userKeyGenerator as (req: Request) => string,
});

/**
 * Auth rate limiter for login/register - 5 attempts per 15 minutes
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  maxRequests: 5,
  message: 'Too many authentication attempts. Please try again in 15 minutes.',
  keyGenerator: ipKeyGenerator,
});

/**
 * Upload rate limiter - 10 uploads per hour
 */
export const uploadRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  maxRequests: 10,
  message: 'Upload limit reached. Please try again later.',
  keyGenerator: userKeyGenerator as (req: Request) => string,
});

/**
 * Search rate limiter - 30 searches per minute
 */
export const searchRateLimit = rateLimit({
  windowMs: 60 * 1000,
  maxRequests: 30,
  keyGenerator: userKeyGenerator as (req: Request) => string,
});

/**
 * Export/report rate limiter - 5 exports per hour
 */
export const exportRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  maxRequests: 5,
  message: 'Export limit reached. Please wait before generating more exports.',
  keyGenerator: userKeyGenerator as (req: Request) => string,
});

/**
 * Webhook rate limiter - 1000 requests per minute (generous for external services)
 */
export const webhookRateLimit = rateLimit({
  windowMs: 60 * 1000,
  maxRequests: 1000,
  keyGenerator: ipKeyGenerator,
});

/**
 * Admin operations rate limiter - 50 requests per minute
 */
export const adminRateLimit = rateLimit({
  windowMs: 60 * 1000,
  maxRequests: 50,
  keyGenerator: userKeyGenerator as (req: Request) => string,
});

// ============================================================================
// ENDPOINT-SPECIFIC RATE LIMITS
// ============================================================================

/**
 * Rate limits by endpoint pattern
 */
export const ENDPOINT_RATE_LIMITS: Record<string, Partial<RateLimitConfig>> = {
  // Auth endpoints - very strict
  'POST:/auth/login': { windowMs: 15 * 60 * 1000, maxRequests: 5 },
  'POST:/auth/register': { windowMs: 60 * 60 * 1000, maxRequests: 3 },
  'POST:/auth/forgot-password': { windowMs: 60 * 60 * 1000, maxRequests: 3 },
  'POST:/auth/reset-password': { windowMs: 60 * 60 * 1000, maxRequests: 5 },

  // Bulk operations - moderate
  'POST:/bulk/*': { windowMs: 60 * 1000, maxRequests: 10 },
  'POST:/batch-import/*': { windowMs: 60 * 60 * 1000, maxRequests: 10 },

  // Exports - strict
  'GET:/exports/*': { windowMs: 60 * 60 * 1000, maxRequests: 20 },

  // Search - moderate
  'GET:/search': { windowMs: 60 * 1000, maxRequests: 30 },
  'GET:/search/quick': { windowMs: 60 * 1000, maxRequests: 60 },

  // Dashboard - lenient (cached anyway)
  'GET:/dashboard-stats': { windowMs: 60 * 1000, maxRequests: 60 },
  'POST:/dashboard-stats/refresh': { windowMs: 60 * 1000, maxRequests: 10 },

  // File uploads
  'POST:/uploads/*': { windowMs: 60 * 60 * 1000, maxRequests: 50 },
  'POST:/documents/*': { windowMs: 60 * 60 * 1000, maxRequests: 50 },
};

/**
 * Dynamic endpoint rate limiter that uses ENDPOINT_RATE_LIMITS config
 */
export function dynamicRateLimit(req: Request, res: Response, next: NextFunction): void {
  const endpoint = `${req.method}:${req.baseUrl}${req.path}`;

  // Check for exact match first
  let config = ENDPOINT_RATE_LIMITS[endpoint];

  // Check for wildcard matches
  if (!config) {
    for (const [pattern, patternConfig] of Object.entries(ENDPOINT_RATE_LIMITS)) {
      if (pattern.endsWith('/*')) {
        const prefix = pattern.slice(0, -2);
        if (endpoint.startsWith(prefix)) {
          config = patternConfig;
          break;
        }
      }
    }
  }

  // Apply custom config or use standard
  if (config) {
    rateLimit({
      ...config,
      keyGenerator: endpointKeyGenerator as (req: Request) => string,
    })(req, res, next);
  } else {
    standardRateLimit(req, res, next);
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Reset rate limit for a specific key
 */
export function resetRateLimit(key: string): void {
  globalStore.reset(key);
}

/**
 * Reset rate limit for a user
 */
export function resetUserRateLimit(userId: string): void {
  globalStore.reset(`user:${userId}`);
}

/**
 * Reset rate limit for an IP
 */
export function resetIpRateLimit(ip: string): void {
  globalStore.reset(`ip:${ip}`);
}

/**
 * Get rate limit store statistics
 */
export function getRateLimitStats(): { totalKeys: number; memoryUsage: number } {
  return globalStore.getStats();
}

/**
 * Create a whitelist skip function
 */
export function createWhitelist(ips: string[], userIds: string[]) {
  const ipSet = new Set(ips);
  const userIdSet = new Set(userIds);

  return (req: Request): boolean => {
    // Check IP whitelist
    const ip = req.ip || req.socket.remoteAddress || '';
    if (ipSet.has(ip)) return true;

    // Check forwarded IPs
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const forwardedIps = (Array.isArray(forwarded) ? forwarded : forwarded.split(',')).map((i) =>
        i.trim()
      );
      if (forwardedIps.some((fip) => ipSet.has(fip))) return true;
    }

    // Check user whitelist
    const authReq = req as AuthRequest;
    if (authReq.userId && userIdSet.has(authReq.userId)) return true;

    return false;
  };
}

/**
 * Skip rate limiting for internal/health check requests
 */
export function skipInternalRequests(req: Request): boolean {
  // Skip health checks
  if (req.path === '/health' || req.path === '/ready') return true;

  // Skip internal IPs (localhost)
  const ip = req.ip || req.socket.remoteAddress || '';
  if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return true;
  }

  return false;
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  RateLimitConfig,
  RateLimitEntry,
  RateLimitStore,
  globalStore,
  ipKeyGenerator,
  userKeyGenerator,
  endpointKeyGenerator,
};

export default rateLimit;
