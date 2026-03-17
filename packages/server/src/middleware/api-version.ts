/**
 * API Versioning Utilities
 * 
 * Provides infrastructure for API versioning and deprecation warnings.
 * Part of Critical Improvement #7: API Response Standardization & Versioning
 * 
 * Usage:
 *   import { apiVersionMiddleware, deprecationWarning, API_VERSION } from '../middleware/api-version.js';
 *   router.use(apiVersionMiddleware());
 *   router.get('/old-endpoint', deprecationWarning('2024-06-01', '/api/v1/new-endpoint'), handler);
 */

import { Request, Response, NextFunction } from 'express';

// Current API version
export const API_VERSION = '1.0.0';

// API version header
export const API_VERSION_HEADER = 'X-API-Version';

// Deprecation warning header
export const DEPRECATION_HEADER = 'Deprecation';
export const SUNSET_HEADER = 'Sunset';
export const LINK_HEADER = 'Link';

/**
 * Pagination metadata type
 */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/**
 * Standard API response format
 */
export interface StandardApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: {
    version: string;
    timestamp: string;
    requestId?: string;
    pagination?: PaginationMeta;
  };
}

/**
 * Middleware to add API version headers to all responses
 */
export function apiVersionMiddleware() {
  return (_req: Request, res: Response, next: NextFunction): void => {
    // Add version header to all responses
    res.setHeader(API_VERSION_HEADER, API_VERSION);
    
    // Override res.json to wrap responses in standard format
    const originalJson = res.json.bind(res);
    
    res.json = function(body: unknown) {
      // If already in standard format, add meta
      if (typeof body === 'object' && body !== null && 'success' in body) {
        const standardBody = body as StandardApiResponse;
        if (!standardBody.meta) {
          standardBody.meta = {
            version: API_VERSION,
            timestamp: new Date().toISOString(),
          };
        } else {
          standardBody.meta.version = API_VERSION;
          standardBody.meta.timestamp = new Date().toISOString();
        }
        return originalJson(standardBody);
      }
      
      // Otherwise, just pass through
      return originalJson(body);
    };
    
    next();
  };
}

/**
 * Middleware to add deprecation warning headers
 */
export function deprecationWarning(sunsetDate: string, alternativeEndpoint?: string) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    // RFC 8594 Sunset header
    res.setHeader(DEPRECATION_HEADER, 'true');
    res.setHeader(SUNSET_HEADER, sunsetDate);
    
    if (alternativeEndpoint) {
      // RFC 8288 Link header for alternative
      res.setHeader(LINK_HEADER, `<${alternativeEndpoint}>; rel="successor-version"`);
    }
    
    // Also add a warning header
    const warning = `This endpoint is deprecated and will be removed after ${sunsetDate}`;
    res.setHeader('Warning', `299 - "${warning}"`);
    
    next();
  };
}

/**
 * Helper to create a standardized success response
 */
export function successResponse<T>(
  data: T,
  options?: {
    message?: string;
    pagination?: PaginationMeta;
    requestId?: string;
  }
): StandardApiResponse<T> {
  return {
    success: true,
    data,
    message: options?.message,
    meta: {
      version: API_VERSION,
      timestamp: new Date().toISOString(),
      requestId: options?.requestId,
      pagination: options?.pagination,
    },
  };
}

/**
 * Helper to create a standardized error response
 */
export function errorResponse(
  error: string,
  options?: {
    requestId?: string;
  }
): StandardApiResponse {
  return {
    success: false,
    error,
    meta: {
      version: API_VERSION,
      timestamp: new Date().toISOString(),
      requestId: options?.requestId,
    },
  };
}

/**
 * Helper to calculate pagination metadata
 */
export function paginationMeta(
  page: number,
  pageSize: number,
  total: number
): PaginationMeta {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  };
}

export default {
  API_VERSION,
  apiVersionMiddleware,
  deprecationWarning,
  successResponse,
  errorResponse,
  paginationMeta,
};
