/**
 * Request Validation Middleware
 * 
 * Provides Express middleware for validating requests using Zod schemas.
 * Part of Critical Improvement #9: Request Validation & Sanitization
 * 
 * Usage:
 *   import { validateBody, validateQuery, validateParams } from '../middleware/validate.js';
 *   
 *   router.post('/orders', validateBody(CreateOrderSchema), handler);
 *   router.get('/orders', validateQuery(PaginationSchema), handler);
 *   router.get('/orders/:id', validateParams(IdParamSchema), handler);
 */

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError, z } from 'zod';
import { BadRequestError } from './error-handler.js';

/**
 * Format Zod errors into a user-friendly message
 */
function formatZodError(error: ZodError): string {
  const errors = error.errors.map(err => {
    const path = err.path.join('.');
    return path ? `${path}: ${err.message}` : err.message;
  });
  return errors.join('; ');
}

/**
 * Format Zod errors into a structured object
 */
function formatZodErrorDetails(error: ZodError): Record<string, string[]> {
  const details: Record<string, string[]> = {};
  
  for (const err of error.errors) {
    const path = err.path.join('.') || '_root';
    if (!details[path]) {
      details[path] = [];
    }
    details[path].push(err.message);
  }
  
  return details;
}

/**
 * Middleware to validate request body against a Zod schema
 */
export function validateBody<T extends ZodSchema>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const message = formatZodError(error);
        const details = formatZodErrorDetails(error);
        throw BadRequestError(message, details);
      }
      throw error;
    }
  };
}

/**
 * Middleware to validate query parameters against a Zod schema
 */
export function validateQuery<T extends ZodSchema>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const message = formatZodError(error);
        const details = formatZodErrorDetails(error);
        throw BadRequestError(message, details);
      }
      throw error;
    }
  };
}

/**
 * Middleware to validate URL parameters against a Zod schema
 */
export function validateParams<T extends ZodSchema>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.params = schema.parse(req.params);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const message = formatZodError(error);
        const details = formatZodErrorDetails(error);
        throw BadRequestError(message, details);
      }
      throw error;
    }
  };
}

/**
 * Middleware to validate all parts of a request
 */
export function validateRequest<
  TBody extends ZodSchema = ZodSchema,
  TQuery extends ZodSchema = ZodSchema,
  TParams extends ZodSchema = ZodSchema
>(options: {
  body?: TBody;
  query?: TQuery;
  params?: TParams;
}) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const errors: Record<string, Record<string, string[]>> = {};

    try {
      if (options.body) {
        req.body = options.body.parse(req.body);
      }
    } catch (error) {
      if (error instanceof ZodError) {
        errors.body = formatZodErrorDetails(error);
      }
    }

    try {
      if (options.query) {
        req.query = options.query.parse(req.query);
      }
    } catch (error) {
      if (error instanceof ZodError) {
        errors.query = formatZodErrorDetails(error);
      }
    }

    try {
      if (options.params) {
        req.params = options.params.parse(req.params);
      }
    } catch (error) {
      if (error instanceof ZodError) {
        errors.params = formatZodErrorDetails(error);
      }
    }

    if (Object.keys(errors).length > 0) {
      throw BadRequestError('Validation failed', errors);
    }

    next();
  };
}

// ============================================================================
// Common Schemas
// ============================================================================

/**
 * UUID parameter schema
 */
export const UuidParamSchema = z.object({
  id: z.string().uuid('Invalid ID format'),
});

/**
 * Common ID parameter schema (accepts UUID or any string for flexibility)
 */
export const IdParamSchema = z.object({
  id: z.string().min(1, 'ID is required'),
});

/**
 * Order ID parameter schema
 */
export const OrderIdParamSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
});

/**
 * Pagination query schema with sensible defaults
 */
export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

/**
 * Search query schema
 */
export const SearchQuerySchema = z.object({
  q: z.string().optional(),
  search: z.string().optional(),
}).transform(data => ({
  search: data.q || data.search || '',
}));

/**
 * Date range query schema
 */
export const DateRangeQuerySchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
}).refine(
  data => {
    if (data.startDate && data.endDate) {
      return data.startDate <= data.endDate;
    }
    return true;
  },
  { message: 'Start date must be before or equal to end date' }
);

export default {
  validateBody,
  validateQuery,
  validateParams,
  validateRequest,
  UuidParamSchema,
  IdParamSchema,
  OrderIdParamSchema,
  PaginationQuerySchema,
  SearchQuerySchema,
  DateRangeQuerySchema,
};
