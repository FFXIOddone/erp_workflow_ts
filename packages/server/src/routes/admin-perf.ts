/**
 * Admin Performance Routes
 * 
 * Exposes query metrics and performance data for monitoring.
 * Part of Critical Improvement #1: Database Query Optimization
 */

import { Router, Response } from 'express';
import { UserRole } from '@erp/shared';
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth.js';
import { getQueryMetrics, getRecentSlowQueries } from '../middleware/query-logger.js';
import { getCacheStats } from '../middleware/cache.js';
import { jobQueue } from '../lib/job-queue.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /admin/perf/query-metrics
 * Get current query performance metrics
 */
router.get('/query-metrics', requireRole(UserRole.ADMIN), (_req: AuthRequest, res: Response) => {
  const metrics = getQueryMetrics();
  const slowQueries = getRecentSlowQueries();
  
  res.json({
    success: true,
    data: {
      metrics,
      recentSlowQueries: slowQueries.slice(0, 20), // Return last 20
    },
  });
});

/**
 * GET /admin/perf/cache-stats
 * Get response cache statistics
 */
router.get('/cache-stats', requireRole(UserRole.ADMIN), (_req: AuthRequest, res: Response) => {
  const cacheStats = getCacheStats();
  
  res.json({
    success: true,
    data: cacheStats,
  });
});

/**
 * GET /admin/perf/job-stats
 * Get background job queue statistics
 */
router.get('/job-stats', requireRole(UserRole.ADMIN), (_req: AuthRequest, res: Response) => {
  const jobStats = jobQueue.getStats();
  
  res.json({
    success: true,
    data: jobStats,
  });
});

/**
 * GET /admin/perf/health
 * Simple health check with basic stats
 */
router.get('/health', requireRole(UserRole.ADMIN), (_req: AuthRequest, res: Response) => {
  const metrics = getQueryMetrics();
  const cacheStats = getCacheStats();
  const jobStats = jobQueue.getStats();
  
  res.json({
    success: true,
    data: {
      status: 'healthy',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      queryStats: {
        total: metrics.totalQueries,
        avgTime: metrics.averageTime.toFixed(2) + 'ms',
        slowPercentage: metrics.totalQueries > 0 
          ? ((metrics.slowQueries / metrics.totalQueries) * 100).toFixed(2) + '%'
          : '0%',
      },
      cacheStats: {
        size: cacheStats.size,
        hitRate: cacheStats.hitRate,
      },
      jobStats: {
        pending: jobStats.pending,
        running: jobStats.running,
        completed: jobStats.completed,
        failed: jobStats.failed,
      },
    },
  });
});

export default router;
