/**
 * Structured Logging Service
 * 
 * Provides a consistent logging interface with structured data,
 * log levels, and optional external logging integrations.
 * Part of Critical Improvement #4: Centralized Logging & Monitoring
 * 
 * Usage:
 *   import { logger, createChildLogger } from '../lib/logger.js';
 *   
 *   logger.info('Order created', { orderId: '123', customer: 'Acme' });
 *   logger.error('Failed to process', { error: e, context: { orderId: '123' } });
 *   
 *   const orderLogger = createChildLogger('orders');
 *   orderLogger.info('Processing order', { id: '123' });
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  service: string;
  context?: LogContext;
  requestId?: string;
  userId?: string;
  duration?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

// Configuration
const LOG_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
const SERVICE_NAME = process.env.SERVICE_NAME || 'erp-server';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const LOG_JSON = process.env.LOG_FORMAT === 'json' || IS_PRODUCTION;

// Log level priority (higher = more severe)
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Check if a log level should be logged based on configured level
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[LOG_LEVEL];
}

/**
 * Format error for logging
 */
function formatError(error: unknown): LogEntry['error'] | undefined {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: IS_PRODUCTION ? undefined : error.stack,
    };
  }
  if (error && typeof error === 'object') {
    return {
      name: 'UnknownError',
      message: String(error),
    };
  }
  if (error) {
    return {
      name: 'UnknownError',
      message: String(error),
    };
  }
  return undefined;
}

/**
 * Format log entry for output
 */
function formatLogEntry(entry: LogEntry): string {
  if (LOG_JSON) {
    return JSON.stringify(entry);
  }

  // Pretty format for development
  const timestamp = entry.timestamp.split('T')[1].split('.')[0];
  const levelColor = {
    debug: '\x1b[36m', // cyan
    info: '\x1b[32m',  // green
    warn: '\x1b[33m',  // yellow
    error: '\x1b[31m', // red
  };
  const reset = '\x1b[0m';
  
  let output = `${levelColor[entry.level]}[${entry.level.toUpperCase().padEnd(5)}]${reset} ${timestamp} | ${entry.message}`;
  
  if (entry.context && Object.keys(entry.context).length > 0) {
    output += ` | ${JSON.stringify(entry.context)}`;
  }
  
  if (entry.error) {
    output += ` | Error: ${entry.error.message}`;
    if (entry.error.stack) {
      output += `\n${entry.error.stack}`;
    }
  }
  
  return output;
}

/**
 * Output log entry
 */
function writeLog(entry: LogEntry): void {
  const output = formatLogEntry(entry);
  
  switch (entry.level) {
    case 'error':
      console.error(output);
      break;
    case 'warn':
      console.warn(output);
      break;
    default:
      console.log(output);
  }
}

// Request context storage (using AsyncLocalStorage would be ideal in Node 14+)
let currentRequestContext: { requestId?: string; userId?: string } = {};

/**
 * Set the current request context for logging
 */
export function setRequestContext(context: { requestId?: string; userId?: string }): void {
  currentRequestContext = context;
}

/**
 * Clear the current request context
 */
export function clearRequestContext(): void {
  currentRequestContext = {};
}

/**
 * Create a log entry and write it
 */
function log(
  level: LogLevel, 
  message: string, 
  context?: LogContext & { error?: unknown; duration?: number }
): void {
  if (!shouldLog(level)) return;

  const { error, duration, ...restContext } = context || {};

  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    service: SERVICE_NAME,
    context: Object.keys(restContext).length > 0 ? restContext : undefined,
    requestId: currentRequestContext.requestId,
    userId: currentRequestContext.userId,
    duration,
    error: formatError(error),
  };

  writeLog(entry);
}

/**
 * Main logger interface
 */
export const logger = {
  debug: (message: string, context?: LogContext) => log('debug', message, context),
  info: (message: string, context?: LogContext) => log('info', message, context),
  warn: (message: string, context?: LogContext) => log('warn', message, context),
  error: (message: string, context?: LogContext & { error?: unknown }) => log('error', message, context),
  
  /**
   * Time a function execution
   */
  time: async <T>(
    label: string, 
    fn: () => Promise<T>,
    context?: LogContext
  ): Promise<T> => {
    const start = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - start;
      log('info', label, { ...context, duration });
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      log('error', `${label} (failed)`, { ...context, duration, error });
      throw error;
    }
  },
  
  /**
   * Create a child logger with a prefix
   */
  child: (prefix: string) => createChildLogger(prefix),
};

/**
 * Create a child logger with a module prefix
 */
export function createChildLogger(module: string) {
  const prefix = `[${module}]`;
  
  return {
    debug: (message: string, context?: LogContext) => 
      log('debug', `${prefix} ${message}`, context),
    info: (message: string, context?: LogContext) => 
      log('info', `${prefix} ${message}`, context),
    warn: (message: string, context?: LogContext) => 
      log('warn', `${prefix} ${message}`, context),
    error: (message: string, context?: LogContext & { error?: unknown }) => 
      log('error', `${prefix} ${message}`, context),
    time: async <T>(label: string, fn: () => Promise<T>, context?: LogContext): Promise<T> => {
      return logger.time(`${prefix} ${label}`, fn, context);
    },
  };
}

/**
 * Express middleware for request logging
 */
export function requestLoggerMiddleware() {
  return (req: { method: string; originalUrl: string; userId?: string }, res: { on: (event: string, fn: () => void) => void; statusCode: number }, next: () => void): void => {
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const start = Date.now();
    
    setRequestContext({ requestId, userId: req.userId });
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      const level: LogLevel = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
      
      log(level, `${req.method} ${req.originalUrl}`, {
        statusCode: res.statusCode,
        duration,
        userId: req.userId,
      });
      
      clearRequestContext();
    });
    
    next();
  };
}

export default logger;
