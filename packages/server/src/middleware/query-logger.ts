/**
 * Query Performance Logger Middleware
 * 
 * Logs slow Prisma queries and provides visibility into database performance.
 * Part of Critical Improvement #1: Database Query Optimization
 */

import { Prisma } from '@prisma/client';

// Configuration
const SLOW_QUERY_THRESHOLD_MS = 100; // Log queries slower than 100ms
const VERY_SLOW_QUERY_THRESHOLD_MS = 500; // Warn on queries slower than 500ms
const ENABLE_QUERY_LOGGING = process.env.ENABLE_QUERY_LOGGING === 'true';
const LOG_ALL_QUERIES = process.env.LOG_ALL_QUERIES === 'true';

interface QueryMetrics {
  totalQueries: number;
  slowQueries: number;
  verySlowQueries: number;
  averageTime: number;
  totalTime: number;
}

// In-memory metrics (reset on server restart)
const metrics: QueryMetrics = {
  totalQueries: 0,
  slowQueries: 0,
  verySlowQueries: 0,
  averageTime: 0,
  totalTime: 0,
};

// Recent slow queries buffer (last 50)
const recentSlowQueries: Array<{
  query: string;
  duration: number;
  timestamp: Date;
  params?: string;
}> = [];
const MAX_SLOW_QUERIES_BUFFER = 50;

/**
 * Create Prisma middleware for query logging
 */
export function createQueryLoggingMiddleware(): Prisma.Middleware {
  return async (params, next) => {
    if (!ENABLE_QUERY_LOGGING) {
      return next(params);
    }

    const startTime = Date.now();
    const result = await next(params);
    const duration = Date.now() - startTime;

    // Update metrics
    metrics.totalQueries++;
    metrics.totalTime += duration;
    metrics.averageTime = metrics.totalTime / metrics.totalQueries;

    const queryDescription = `${params.model}.${params.action}`;

    if (duration >= VERY_SLOW_QUERY_THRESHOLD_MS) {
      metrics.verySlowQueries++;
      console.warn(`🐢 VERY SLOW QUERY [${duration}ms]: ${queryDescription}`);
      if (params.args) {
        console.warn('  Args:', JSON.stringify(params.args, null, 2).substring(0, 500));
      }
    } else if (duration >= SLOW_QUERY_THRESHOLD_MS) {
      metrics.slowQueries++;
      console.log(`⚠️ SLOW QUERY [${duration}ms]: ${queryDescription}`);
    } else if (LOG_ALL_QUERIES) {
      console.log(`✓ Query [${duration}ms]: ${queryDescription}`);
    }

    // Buffer slow queries
    if (duration >= SLOW_QUERY_THRESHOLD_MS) {
      recentSlowQueries.unshift({
        query: queryDescription,
        duration,
        timestamp: new Date(),
        params: params.args ? JSON.stringify(params.args).substring(0, 200) : undefined,
      });
      
      if (recentSlowQueries.length > MAX_SLOW_QUERIES_BUFFER) {
        recentSlowQueries.pop();
      }
    }

    return result;
  };
}

/**
 * Get current query metrics
 */
export function getQueryMetrics(): QueryMetrics {
  return { ...metrics };
}

/**
 * Get recent slow queries
 */
export function getRecentSlowQueries() {
  return [...recentSlowQueries];
}

/**
 * Reset metrics (useful for testing)
 */
export function resetQueryMetrics(): void {
  metrics.totalQueries = 0;
  metrics.slowQueries = 0;
  metrics.verySlowQueries = 0;
  metrics.averageTime = 0;
  metrics.totalTime = 0;
  recentSlowQueries.length = 0;
}

/**
 * Log a metrics summary (call periodically or on shutdown)
 */
export function logMetricsSummary(): void {
  console.log('\n📊 Query Performance Summary:');
  console.log(`  Total Queries: ${metrics.totalQueries}`);
  console.log(`  Slow Queries (>${SLOW_QUERY_THRESHOLD_MS}ms): ${metrics.slowQueries}`);
  console.log(`  Very Slow Queries (>${VERY_SLOW_QUERY_THRESHOLD_MS}ms): ${metrics.verySlowQueries}`);
  console.log(`  Average Query Time: ${metrics.averageTime.toFixed(2)}ms`);
  console.log(`  Total Query Time: ${metrics.totalTime}ms\n`);
}

export default {
  createQueryLoggingMiddleware,
  getQueryMetrics,
  getRecentSlowQueries,
  resetQueryMetrics,
  logMetricsSummary,
};
