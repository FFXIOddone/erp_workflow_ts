/**
 * Server-side Response Caching Middleware
 * 
 * Provides simple in-memory caching for frequently-accessed endpoints.
 * Part of Critical Improvement #2: API Request Deduplication & Caching
 * 
 * Usage:
 *   import { cacheMiddleware, invalidateCache, cacheConfig } from '../middleware/cache.js';
 *   router.get('/orders', cacheMiddleware({ ttl: 30, key: 'orders' }), getOrders);
 *   // When data changes:
 *   invalidateCache('orders');
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// Configuration
const DEFAULT_TTL_SECONDS = 60; // 1 minute default TTL
const MAX_CACHE_SIZE = 500; // Maximum number of cached responses
const ENABLE_CACHE = process.env.NODE_ENV !== 'test';

interface CacheEntry {
  data: unknown;
  timestamp: number;
  ttl: number;
  headers: Record<string, string>;
}

// In-memory cache store
const cache = new Map<string, CacheEntry>();

// Cache statistics
const stats = {
  hits: 0,
  misses: 0,
  invalidations: 0,
};

/**
 * Generate a cache key from request
 */
function generateCacheKey(req: Request, keyPrefix?: string): string {
  const baseKey = keyPrefix || req.originalUrl;
  const userId = (req as { userId?: string }).userId || 'anonymous';
  const queryHash = crypto
    .createHash('md5')
    .update(JSON.stringify(req.query))
    .digest('hex')
    .substring(0, 8);
  
  return `${baseKey}:${userId}:${queryHash}`;
}

/**
 * Check if cache entry is still valid
 */
function isValid(entry: CacheEntry): boolean {
  return Date.now() - entry.timestamp < entry.ttl * 1000;
}

/**
 * Evict oldest entries if cache is full
 */
function evictIfNeeded(): void {
  if (cache.size < MAX_CACHE_SIZE) return;

  // Find and delete oldest entries (LRU-style)
  const entries = Array.from(cache.entries())
    .sort((a, b) => a[1].timestamp - b[1].timestamp);
  
  // Remove oldest 10%
  const toRemove = Math.floor(MAX_CACHE_SIZE * 0.1);
  entries.slice(0, toRemove).forEach(([key]) => cache.delete(key));
}

/**
 * Caching middleware options
 */
export interface CacheOptions {
  /** Time-to-live in seconds */
  ttl?: number;
  /** Custom cache key prefix */
  key?: string;
  /** Whether to cache based on user (default: true) */
  perUser?: boolean;
  /** Conditions to skip caching */
  condition?: (req: Request) => boolean;
}

/**
 * Express middleware for response caching
 */
export function cacheMiddleware(options: CacheOptions = {}) {
  const { 
    ttl = DEFAULT_TTL_SECONDS, 
    key: keyPrefix, 
    perUser = true,
    condition,
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip caching if disabled or condition fails
    if (!ENABLE_CACHE || (condition && !condition(req))) {
      next();
      return;
    }

    // Only cache GET requests
    if (req.method !== 'GET') {
      next();
      return;
    }

    const cacheKey = perUser 
      ? generateCacheKey(req, keyPrefix)
      : keyPrefix || req.originalUrl;

    // Check cache
    const cached = cache.get(cacheKey);
    if (cached && isValid(cached)) {
      stats.hits++;
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('X-Cache-Age', Math.floor((Date.now() - cached.timestamp) / 1000).toString());
      
      // Restore cached headers
      Object.entries(cached.headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
      
      res.json(cached.data);
      return;
    }

    stats.misses++;
    res.setHeader('X-Cache', 'MISS');

    // Override res.json to capture response
    const originalJson = res.json.bind(res);
    res.json = function(data: unknown) {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        evictIfNeeded();
        
        cache.set(cacheKey, {
          data,
          timestamp: Date.now(),
          ttl,
          headers: {
            'Content-Type': res.getHeader('Content-Type') as string || 'application/json',
          },
        });
      }
      return originalJson(data);
    };

    next();
  };
}

/**
 * Invalidate cache entries matching a pattern
 */
export function invalidateCache(pattern: string): number {
  let count = 0;
  
  for (const key of cache.keys()) {
    if (key.startsWith(pattern) || key.includes(pattern)) {
      cache.delete(key);
      count++;
    }
  }
  
  stats.invalidations += count;
  return count;
}

/**
 * Invalidate all cache entries for a specific user
 */
export function invalidateUserCache(userId: string): number {
  let count = 0;
  
  for (const key of cache.keys()) {
    if (key.includes(`:${userId}:`)) {
      cache.delete(key);
      count++;
    }
  }
  
  return count;
}

/**
 * Clear all cache
 */
export function clearCache(): void {
  cache.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    ...stats,
    size: cache.size,
    hitRate: stats.hits + stats.misses > 0 
      ? ((stats.hits / (stats.hits + stats.misses)) * 100).toFixed(2) + '%'
      : '0%',
  };
}

/**
 * Reset cache statistics
 */
export function resetCacheStats(): void {
  stats.hits = 0;
  stats.misses = 0;
  stats.invalidations = 0;
}

/**
 * Pre-defined cache configurations for common use cases
 */
export const cacheConfig = {
  /** Short-lived cache for dynamic data (30 seconds) */
  shortLived: { ttl: 30 } as CacheOptions,
  
  /** Medium cache for semi-static data (5 minutes) */
  medium: { ttl: 300 } as CacheOptions,
  
  /** Long cache for static data (1 hour) */
  longLived: { ttl: 3600 } as CacheOptions,
  
  /** Dashboard data - shared across users (1 minute) */
  dashboard: { ttl: 60, perUser: false, key: 'dashboard' } as CacheOptions,
  
  /** User-specific data (30 seconds) */
  userSpecific: { ttl: 30, perUser: true } as CacheOptions,
  
  /** Reference data that rarely changes (10 minutes) */
  reference: { ttl: 600, perUser: false } as CacheOptions,
};

export default {
  cacheMiddleware,
  invalidateCache,
  invalidateUserCache,
  clearCache,
  getCacheStats,
  resetCacheStats,
  cacheConfig,
};
