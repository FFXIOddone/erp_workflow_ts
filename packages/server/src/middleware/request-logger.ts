/**
 * Request Logging Middleware
 *
 * Comprehensive request/response logging with:
 * - Response time measurement
 * - Request body logging (with sanitization)
 * - User context from auth
 * - Error tracking
 * - Optional database persistence
 * - Correlation IDs for request tracing
 */

import type { Request, Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.js';
import { randomUUID } from 'crypto';

// ============================================================================
// TYPES & CONFIGURATION
// ============================================================================

export interface RequestLogConfig {
  enabled?: boolean;
  logBody?: boolean; // Log request body (default: false for safety)
  logHeaders?: boolean; // Log request headers
  logQuery?: boolean; // Log query parameters
  maxBodySize?: number; // Maximum body size to log (bytes)
  sensitiveFields?: string[]; // Fields to redact from logs
  skipPaths?: string[]; // Paths to skip logging
  skipMethods?: string[]; // HTTP methods to skip
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  persistToDb?: boolean; // Save to database
  onLog?: (entry: RequestLogEntry) => void; // Custom log handler
}

export interface RequestLogEntry {
  id: string;
  timestamp: Date;
  method: string;
  path: string;
  fullUrl: string;
  statusCode: number;
  responseTime: number; // milliseconds
  userId?: string;
  userEmail?: string;
  ip: string;
  userAgent?: string;
  contentType?: string;
  contentLength?: number;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  headers?: Record<string, unknown>;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
  correlationId: string;
  referer?: string;
}

// Default sensitive fields to redact
const DEFAULT_SENSITIVE_FIELDS = [
  'password',
  'newPassword',
  'confirmPassword',
  'currentPassword',
  'token',
  'accessToken',
  'refreshToken',
  'apiKey',
  'secret',
  'authorization',
  'cookie',
  'creditCard',
  'cardNumber',
  'cvv',
  'ssn',
  'socialSecurityNumber',
];

// Default paths to skip
const DEFAULT_SKIP_PATHS = ['/health', '/ready', '/favicon.ico', '/api/health'];

const DEFAULT_CONFIG: RequestLogConfig = {
  enabled: true,
  logBody: false,
  logHeaders: false,
  logQuery: true,
  maxBodySize: 10 * 1024, // 10KB
  sensitiveFields: DEFAULT_SENSITIVE_FIELDS,
  skipPaths: DEFAULT_SKIP_PATHS,
  skipMethods: [],
  logLevel: 'info',
  persistToDb: false,
};

// ============================================================================
// IN-MEMORY LOG STORE
// ============================================================================

interface LogStore {
  entries: RequestLogEntry[];
  maxEntries: number;
}

const logStore: LogStore = {
  entries: [],
  maxEntries: 1000,
};

/**
 * Add entry to in-memory store with circular buffer
 */
function storeLogEntry(entry: RequestLogEntry): void {
  logStore.entries.push(entry);
  if (logStore.entries.length > logStore.maxEntries) {
    logStore.entries.shift();
  }
}

/**
 * Get recent log entries
 */
export function getRecentLogs(count: number = 100): RequestLogEntry[] {
  return logStore.entries.slice(-count);
}

/**
 * Get logs filtered by criteria
 */
export function filterLogs(filter: {
  path?: string;
  method?: string;
  statusCode?: number;
  userId?: string;
  minResponseTime?: number;
  since?: Date;
}): RequestLogEntry[] {
  return logStore.entries.filter((entry) => {
    if (filter.path && !entry.path.includes(filter.path)) return false;
    if (filter.method && entry.method !== filter.method) return false;
    if (filter.statusCode && entry.statusCode !== filter.statusCode) return false;
    if (filter.userId && entry.userId !== filter.userId) return false;
    if (filter.minResponseTime && entry.responseTime < filter.minResponseTime) return false;
    if (filter.since && entry.timestamp < filter.since) return false;
    return true;
  });
}

/**
 * Get performance statistics
 */
export function getRequestStats(): {
  totalRequests: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
  requestsByMethod: Record<string, number>;
  requestsByStatus: Record<string, number>;
  slowestEndpoints: Array<{ path: string; avgTime: number; count: number }>;
} {
  const entries = logStore.entries;
  if (entries.length === 0) {
    return {
      totalRequests: 0,
      averageResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      errorRate: 0,
      requestsByMethod: {},
      requestsByStatus: {},
      slowestEndpoints: [],
    };
  }

  // Response time stats
  const times = entries.map((e) => e.responseTime).sort((a, b) => a - b);
  const avg = times.reduce((sum, t) => sum + t, 0) / times.length;
  const p95Index = Math.floor(times.length * 0.95);
  const p99Index = Math.floor(times.length * 0.99);

  // Group by method
  const byMethod: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const pathStats: Record<string, { total: number; count: number }> = {};

  let errorCount = 0;
  for (const entry of entries) {
    byMethod[entry.method] = (byMethod[entry.method] || 0) + 1;
    const statusGroup = `${Math.floor(entry.statusCode / 100)}xx`;
    byStatus[statusGroup] = (byStatus[statusGroup] || 0) + 1;

    if (entry.statusCode >= 400) errorCount++;

    if (!pathStats[entry.path]) {
      pathStats[entry.path] = { total: 0, count: 0 };
    }
    pathStats[entry.path].total += entry.responseTime;
    pathStats[entry.path].count++;
  }

  // Find slowest endpoints
  const slowest = Object.entries(pathStats)
    .map(([path, stats]) => ({
      path,
      avgTime: stats.total / stats.count,
      count: stats.count,
    }))
    .sort((a, b) => b.avgTime - a.avgTime)
    .slice(0, 10);

  return {
    totalRequests: entries.length,
    averageResponseTime: Math.round(avg * 100) / 100,
    p95ResponseTime: times[p95Index] || 0,
    p99ResponseTime: times[p99Index] || 0,
    errorRate: Math.round((errorCount / entries.length) * 10000) / 100,
    requestsByMethod: byMethod,
    requestsByStatus: byStatus,
    slowestEndpoints: slowest,
  };
}

/**
 * Clear log store
 */
export function clearLogs(): void {
  logStore.entries = [];
}

// ============================================================================
// SANITIZATION
// ============================================================================

/**
 * Deep clone and redact sensitive fields from an object
 */
function sanitizeObject(
  obj: unknown,
  sensitiveFields: string[],
  maxDepth: number = 5
): unknown {
  if (maxDepth <= 0 || obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item, sensitiveFields, maxDepth - 1));
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (sensitiveFields.some((field) => key.toLowerCase().includes(field.toLowerCase()))) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeObject(value, sensitiveFields, maxDepth - 1);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Truncate string if too long
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...[truncated]';
}

// ============================================================================
// IP EXTRACTION
// ============================================================================

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    return ips.trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

// ============================================================================
// CONSOLE LOGGING
// ============================================================================

function logToConsole(entry: RequestLogEntry, level: string): void {
  const color = entry.statusCode >= 500 ? '\x1b[31m' : // Red
                entry.statusCode >= 400 ? '\x1b[33m' : // Yellow
                entry.statusCode >= 300 ? '\x1b[36m' : // Cyan
                '\x1b[32m'; // Green
  const reset = '\x1b[0m';

  const msg = `${color}${entry.method} ${entry.path}${reset} ${entry.statusCode} ${entry.responseTime}ms`;

  switch (level) {
    case 'debug':
      console.debug(`[${entry.correlationId}] ${msg}`, entry.userId ? `user:${entry.userId}` : '');
      break;
    case 'warn':
      console.warn(`[${entry.correlationId}] ${msg}`, entry.userId ? `user:${entry.userId}` : '');
      break;
    case 'error':
      console.error(`[${entry.correlationId}] ${msg}`, entry.error || '');
      break;
    default:
      console.log(`[${entry.correlationId}] ${msg}`, entry.userId ? `user:${entry.userId}` : '');
  }
}

// ============================================================================
// MIDDLEWARE FACTORY
// ============================================================================

/**
 * Create request logging middleware with custom configuration
 */
export function requestLogger(config: Partial<RequestLogConfig> = {}) {
  const options = { ...DEFAULT_CONFIG, ...config };

  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip if disabled
    if (!options.enabled) {
      next();
      return;
    }

    // Skip specific paths
    if (options.skipPaths?.some((p) => req.path.startsWith(p))) {
      next();
      return;
    }

    // Skip specific methods
    if (options.skipMethods?.includes(req.method)) {
      next();
      return;
    }

    const startTime = process.hrtime.bigint();
    const correlationId = (req.headers['x-correlation-id'] as string) || randomUUID();

    // Add correlation ID to response headers
    res.setHeader('X-Correlation-ID', correlationId);

    // Capture original end function
    const originalEnd = res.end.bind(res);
    let responseBody: unknown;

    // Override end to capture response
    res.end = function (
      chunk?: unknown,
      encodingOrCb?: BufferEncoding | (() => void),
      cb?: () => void
    ): Response {
      // Capture response body if it's JSON
      if (chunk && typeof chunk === 'string') {
        try {
          responseBody = JSON.parse(chunk);
        } catch {
          // Not JSON, ignore
        }
      }

      // Calculate response time
      const endTime = process.hrtime.bigint();
      const responseTimeNs = Number(endTime - startTime);
      const responseTimeMs = Math.round(responseTimeNs / 1_000_000);

      // Build log entry
      const authReq = req as AuthRequest;
      const entry: RequestLogEntry = {
        id: randomUUID(),
        timestamp: new Date(),
        method: req.method,
        path: req.path,
        fullUrl: req.originalUrl,
        statusCode: res.statusCode,
        responseTime: responseTimeMs,
        userId: authReq.userId,
        userEmail: authReq.user?.email ?? undefined,
        ip: getClientIp(req),
        userAgent: req.headers['user-agent'],
        contentType: req.headers['content-type'],
        contentLength: parseInt(req.headers['content-length'] || '0', 10) || undefined,
        correlationId,
        referer: req.headers['referer'] as string | undefined,
      };

      // Add query params if enabled
      if (options.logQuery && Object.keys(req.query).length > 0) {
        entry.query = sanitizeObject(
          req.query,
          options.sensitiveFields!
        ) as Record<string, unknown>;
      }

      // Add request body if enabled and within size limit
      if (options.logBody && req.body) {
        const bodyStr = JSON.stringify(req.body);
        if (bodyStr.length <= options.maxBodySize!) {
          entry.body = sanitizeObject(
            req.body,
            options.sensitiveFields!
          ) as Record<string, unknown>;
        } else {
          entry.body = { _note: `Body too large (${bodyStr.length} bytes)` };
        }
      }

      // Add headers if enabled
      if (options.logHeaders) {
        entry.headers = sanitizeObject(
          req.headers,
          options.sensitiveFields!
        ) as Record<string, unknown>;
      }

      // Capture error info from response body
      if (res.statusCode >= 400 && responseBody && typeof responseBody === 'object') {
        const errBody = responseBody as Record<string, unknown>;
        if (errBody.error || errBody.message) {
          entry.error = {
            message: (errBody.error as string) || (errBody.message as string) || 'Unknown error',
            code: errBody.code as string | undefined,
          };
        }
      }

      // Store in memory
      storeLogEntry(entry);

      // Log to console
      const logLevel =
        res.statusCode >= 500
          ? 'error'
          : res.statusCode >= 400
          ? 'warn'
          : options.logLevel!;
      logToConsole(entry, logLevel);

      // Custom handler
      if (options.onLog) {
        options.onLog(entry);
      }

      // Call original end with correct signature
      if (typeof encodingOrCb === 'function') {
        return originalEnd(chunk, encodingOrCb);
      }
      if (encodingOrCb) {
        return originalEnd(chunk, encodingOrCb, cb);
      }
      return originalEnd(chunk);
    } as typeof res.end;

    next();
  };
}

// ============================================================================
// PRE-CONFIGURED LOGGERS
// ============================================================================

/**
 * Standard request logger - logs path, method, status, time, user
 */
export const standardLogger = requestLogger({
  enabled: true,
  logBody: false,
  logHeaders: false,
  logQuery: true,
});

/**
 * Debug logger - logs everything including bodies and headers
 */
export const debugLogger = requestLogger({
  enabled: true,
  logBody: true,
  logHeaders: true,
  logQuery: true,
  logLevel: 'debug',
});

/**
 * Production logger - minimal logging, errors only
 */
export const productionLogger = requestLogger({
  enabled: true,
  logBody: false,
  logHeaders: false,
  logQuery: false,
  logLevel: 'info',
  skipPaths: [...DEFAULT_SKIP_PATHS, '/api/dashboard-stats', '/api/ws'],
});

/**
 * Security logger - logs auth-related requests with more detail
 */
export const securityLogger = requestLogger({
  enabled: true,
  logBody: true, // Need to log login attempts
  logHeaders: true,
  logQuery: true,
  skipPaths: [], // Don't skip anything for security
  maxBodySize: 1024, // Small body limit
});

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

export {
  DEFAULT_SENSITIVE_FIELDS,
  DEFAULT_SKIP_PATHS,
  sanitizeObject,
  getClientIp,
};

export default requestLogger;
