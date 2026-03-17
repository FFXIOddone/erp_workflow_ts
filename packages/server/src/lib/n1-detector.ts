/**
 * N+1 Query Detection Utility
 * 
 * Helps detect potential N+1 query patterns during development.
 * Part of Critical Improvement #1: Database Query Optimization
 * 
 * Usage:
 *   import { trackQueries, detectN1Pattern, QueryTracker } from '../lib/n1-detector.js';
 *   
 *   const tracker = new QueryTracker();
 *   tracker.track('User.findUnique', userId);
 *   // ... later, in a loop...
 *   tracker.track('Order.findMany', userId); // Will warn if called repeatedly
 */

const ENABLE_N1_DETECTION = process.env.NODE_ENV === 'development';
const N1_THRESHOLD = 5; // Warn after this many similar queries

interface QueryRecord {
  model: string;
  action: string;
  count: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

/**
 * Tracks queries to detect N+1 patterns
 */
export class QueryTracker {
  private queries = new Map<string, QueryRecord>();
  private warned = new Set<string>();
  private requestId: string;

  constructor(requestId?: string) {
    this.requestId = requestId || `req-${Date.now()}`;
  }

  /**
   * Track a query execution
   */
  track(modelAction: string, _context?: unknown): void {
    if (!ENABLE_N1_DETECTION) return;

    const key = modelAction;
    const existing = this.queries.get(key);

    if (existing) {
      existing.count++;
      existing.lastSeenAt = new Date();

      // Check for N+1 pattern
      if (existing.count >= N1_THRESHOLD && !this.warned.has(key)) {
        this.warned.add(key);
        console.warn(
          `⚠️ Potential N+1 Query Detected [${this.requestId}]:\n` +
          `   ${key} called ${existing.count} times\n` +
          `   Consider using include/select or batch loading`
        );
      }
    } else {
      this.queries.set(key, {
        model: modelAction.split('.')[0],
        action: modelAction.split('.')[1] || 'unknown',
        count: 1,
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
      });
    }
  }

  /**
   * Get summary of tracked queries
   */
  getSummary(): Array<{ query: string; count: number }> {
    return Array.from(this.queries.entries())
      .map(([query, record]) => ({ query, count: record.count }))
      .filter(q => q.count > 1)
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Reset the tracker
   */
  reset(): void {
    this.queries.clear();
    this.warned.clear();
  }

  /**
   * Log final summary if there were issues
   */
  logSummary(): void {
    if (!ENABLE_N1_DETECTION) return;

    const suspicious = this.getSummary().filter(q => q.count >= N1_THRESHOLD);
    if (suspicious.length > 0) {
      console.log(`\n📊 Query Summary [${this.requestId}]:`);
      suspicious.forEach(q => {
        console.log(`   ${q.query}: ${q.count} calls`);
      });
      console.log('');
    }
  }
}

// Global tracker for simple usage
let globalTracker: QueryTracker | null = null;

/**
 * Start tracking queries for the current request
 */
export function startTracking(requestId?: string): QueryTracker {
  globalTracker = new QueryTracker(requestId);
  return globalTracker;
}

/**
 * Track a query using the global tracker
 */
export function trackQuery(modelAction: string, context?: unknown): void {
  globalTracker?.track(modelAction, context);
}

/**
 * End tracking and log summary
 */
export function endTracking(): void {
  globalTracker?.logSummary();
  globalTracker = null;
}

/**
 * Express middleware to track N+1 queries per request
 */
export function n1DetectionMiddleware() {
  return (req: { n1Tracker?: QueryTracker }, _res: unknown, next: () => void): void => {
    if (ENABLE_N1_DETECTION) {
      const tracker = startTracking(`${req.constructor.name}-${Date.now()}`);
      req.n1Tracker = tracker;
      
      // Log on response finish (would need res.on('finish') in real impl)
    }
    next();
  };
}

export default {
  QueryTracker,
  startTracking,
  trackQuery,
  endTracking,
  n1DetectionMiddleware,
};
