/**
 * Global error reporter for Shop Floor app.
 * 
 * Catches unhandled errors and promise rejections, then POSTs them
 * to the server's /client-errors endpoint for centralized logging.
 * 
 * Call initErrorReporter() once at app startup (main.tsx).
 */

import { useConfigStore } from '../stores/config';

const SOURCE = 'shop-floor';
const MAX_QUEUE = 50;
const FLUSH_INTERVAL = 5000; // 5 seconds

interface ErrorEntry {
  source: string;
  level: 'error' | 'warn' | 'info';
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
  url?: string;
  userAgent?: string;
}

let queue: ErrorEntry[] = [];
let flushing = false;

function getApiUrl(): string {
  try {
    return useConfigStore.getState().config.apiUrl;
  } catch {
    return 'http://localhost:8001/api/v1';
  }
}

/** Send queued errors to the server */
async function flushQueue() {
  if (flushing || queue.length === 0) return;
  flushing = true;

  const batch = queue.splice(0, MAX_QUEUE);
  const apiUrl = getApiUrl();

  for (const entry of batch) {
    try {
      await fetch(`${apiUrl}/client-errors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });
    } catch {
      // Server unreachable — don't re-queue to avoid infinite loop
      console.error('[ErrorReporter] Failed to send error to server:', entry.message);
    }
  }

  flushing = false;
}

/** Report an error to the server */
export function reportError(
  message: string,
  stack?: string,
  context?: Record<string, unknown>,
  level: 'error' | 'warn' | 'info' = 'error',
) {
  const entry: ErrorEntry = {
    source: SOURCE,
    level,
    message: message.substring(0, 2000),
    stack: stack?.substring(0, 3000),
    context,
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
  };

  queue.push(entry);

  // Flush immediately for errors 
  if (level === 'error') {
    flushQueue();
  }
}

/** Report an Error object */
export function reportErrorObj(err: unknown, context?: Record<string, unknown>) {
  if (err instanceof Error) {
    reportError(err.message, err.stack, context);
  } else {
    reportError(String(err), undefined, context);
  }
}

/** Initialize global error catching — call once at app startup */
export function initErrorReporter() {
  // Catch unhandled errors
  window.addEventListener('error', (event) => {
    reportError(
      event.message || 'Unhandled error',
      event.error?.stack,
      {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    );
  });

  // Catch unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    if (reason instanceof Error) {
      reportError(
        `Unhandled rejection: ${reason.message}`,
        reason.stack,
        { type: 'unhandledrejection' },
      );
    } else {
      reportError(
        `Unhandled rejection: ${String(reason)}`,
        undefined,
        { type: 'unhandledrejection' },
      );
    }
  });

  // Periodic flush for warn/info level
  setInterval(flushQueue, FLUSH_INTERVAL);

  // Intercept console.error to also report
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    originalConsoleError.apply(console, args);
    const message = args.map(a => {
      if (a instanceof Error) return `${a.message}\n${a.stack || ''}`;
      if (typeof a === 'object') try { return JSON.stringify(a); } catch { return String(a); }
      return String(a);
    }).join(' ');
    
    // Avoid recursion: don't report our own failures
    if (!message.includes('[ErrorReporter]')) {
      reportError(message.substring(0, 2000), undefined, { via: 'console.error' }, 'error');
    }
  };

  console.log('[ErrorReporter] Initialized — errors will be sent to server');
}
