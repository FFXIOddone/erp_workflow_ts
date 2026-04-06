/**
 * Pagination Utilities
 *
 * Standardized pagination helpers for cursor-based and offset-based pagination.
 * Provides consistent response formats and type-safe pagination schemas.
 *
 * @module lib/pagination
 */

import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { buildTokenizedSearchWhere } from './fuzzy-search.js';

// ============ Pagination Schemas ============

/**
 * Standard offset-based pagination schema (page/pageSize)
 */
export const OffsetPaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

/**
 * Standard cursor-based pagination schema
 */
export const CursorPaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  direction: z.enum(['forward', 'backward']).default('forward'),
});

/**
 * Combined pagination schema (supports both styles)
 */
export const FlexiblePaginationSchema = z.object({
  // Offset-based
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  // Cursor-based
  cursor: z.string().optional(),
  // Shared
  limit: z.coerce.number().int().positive().max(100).default(20),
});

/**
 * Standard sorting schema
 */
export const SortingSchema = z.object({
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * Common list query schema with pagination and sorting
 */
export const ListQuerySchema = OffsetPaginationSchema.merge(SortingSchema);

/**
 * Cursor-based list query schema
 */
export const CursorListQuerySchema = CursorPaginationSchema.merge(SortingSchema);

// ============ Type Exports ============

export type OffsetPagination = z.infer<typeof OffsetPaginationSchema>;
export type CursorPagination = z.infer<typeof CursorPaginationSchema>;
export type FlexiblePagination = z.infer<typeof FlexiblePaginationSchema>;
export type Sorting = z.infer<typeof SortingSchema>;
export type ListQuery = z.infer<typeof ListQuerySchema>;
export type CursorListQuery = z.infer<typeof CursorListQuerySchema>;

// ============ Pagination Response Types ============

/**
 * Standard offset-based pagination metadata
 */
export interface OffsetPaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

/**
 * Standard cursor-based pagination metadata
 */
export interface CursorPaginationMeta {
  limit: number;
  hasMore: boolean;
  nextCursor: string | null;
  prevCursor: string | null;
  total?: number; // Optional total count
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: OffsetPaginationMeta | CursorPaginationMeta;
}

// ============ Pagination Helpers ============

/**
 * Calculate offset pagination metadata
 */
export function calculateOffsetMeta(
  page: number,
  pageSize: number,
  total: number
): OffsetPaginationMeta {
  const totalPages = Math.ceil(total / pageSize);
  return {
    page,
    pageSize,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

/**
 * Calculate cursor pagination metadata
 */
export function calculateCursorMeta<T extends { id: string }>(
  items: T[],
  limit: number,
  direction: 'forward' | 'backward' = 'forward',
  total?: number
): CursorPaginationMeta {
  const hasMore = items.length > limit;
  const actualItems = hasMore ? items.slice(0, limit) : items;

  let nextCursor: string | null = null;
  let prevCursor: string | null = null;

  if (actualItems.length > 0) {
    if (direction === 'forward') {
      nextCursor = hasMore ? actualItems[actualItems.length - 1].id : null;
      prevCursor = actualItems[0].id;
    } else {
      prevCursor = hasMore ? actualItems[actualItems.length - 1].id : null;
      nextCursor = actualItems[0].id;
    }
  }

  return {
    limit,
    hasMore,
    nextCursor,
    prevCursor,
    total,
  };
}

/**
 * Build Prisma skip/take from offset pagination params
 */
export function buildOffsetPrismaArgs(params: OffsetPagination): {
  skip: number;
  take: number;
} {
  return {
    skip: (params.page - 1) * params.pageSize,
    take: params.pageSize,
  };
}

/**
 * Build Prisma cursor/take from cursor pagination params
 */
export function buildCursorPrismaArgs(params: CursorPagination): {
  cursor?: { id: string };
  take: number;
  skip?: number;
} {
  const result: {
    cursor?: { id: string };
    take: number;
    skip?: number;
  } = {
    take: params.limit + 1, // Take one extra to check hasMore
  };

  if (params.cursor) {
    result.cursor = { id: params.cursor };
    result.skip = 1; // Skip the cursor item itself
  }

  return result;
}

/**
 * Build Prisma orderBy from sorting params
 */
export function buildOrderByClause(
  sortBy: string | undefined,
  sortOrder: 'asc' | 'desc',
  defaultSort: string = 'createdAt',
  allowedFields?: string[]
): Record<string, 'asc' | 'desc'> {
  // Use default if sortBy not provided
  const field = sortBy || defaultSort;

  // Validate against allowed fields if provided
  if (allowedFields && !allowedFields.includes(field)) {
    return { [defaultSort]: sortOrder };
  }

  // Handle nested field sorting (e.g., "customer.name")
  if (field.includes('.')) {
    const parts = field.split('.');
    let orderBy: Record<string, unknown> = { [parts[parts.length - 1]]: sortOrder };
    for (let i = parts.length - 2; i >= 0; i--) {
      orderBy = { [parts[i]]: orderBy };
    }
    return orderBy as Record<string, 'asc' | 'desc'>;
  }

  return { [field]: sortOrder };
}

/**
 * Create a standardized paginated response
 */
export function createPaginatedResponse<T>(
  data: T[],
  pagination: OffsetPaginationMeta | CursorPaginationMeta
): PaginatedResponse<T> {
  return {
    success: true,
    data,
    pagination,
  };
}

// ============ Cursor Encoding/Decoding ============

/**
 * Encode cursor data to base64 string
 */
export function encodeCursor(data: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(data)).toString('base64url');
}

/**
 * Decode cursor from base64 string
 */
export function decodeCursor<T extends Record<string, unknown>>(cursor: string): T | null {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    return JSON.parse(decoded) as T;
  } catch {
    return null;
  }
}

/**
 * Create a composite cursor from multiple fields
 * Useful for pagination with custom sort orders
 */
export function createCompositeCursor(
  item: Record<string, unknown>,
  fields: string[]
): string {
  const cursorData: Record<string, unknown> = {};
  for (const field of fields) {
    cursorData[field] = item[field];
  }
  return encodeCursor(cursorData);
}

// ============ Sorting Helpers ============

/**
 * Standard sortable fields for common entities
 */
export const SORTABLE_FIELDS = {
  workOrder: [
    'orderNumber',
    'customerName',
    'status',
    'priority',
    'dueDate',
    'createdAt',
    'updatedAt',
  ],
  customer: [
    'name',
    'companyName',
    'email',
    'createdAt',
    'updatedAt',
  ],
  user: [
    'username',
    'displayName',
    'email',
    'role',
    'createdAt',
  ],
  inventory: [
    'sku',
    'name',
    'quantity',
    'location',
    'createdAt',
  ],
  quote: [
    'quoteNumber',
    'customerName',
    'status',
    'total',
    'createdAt',
    'validUntil',
  ],
} as const;

/**
 * Validate and sanitize sort field
 */
export function validateSortField(
  field: string | undefined,
  allowedFields: readonly string[],
  defaultField: string
): string {
  if (!field) return defaultField;
  return allowedFields.includes(field) ? field : defaultField;
}

// ============ Filter Helpers ============

/**
 * Build date range filter
 */
export function buildDateRangeFilter(
  startDate?: Date,
  endDate?: Date
): { gte?: Date; lte?: Date } | undefined {
  if (!startDate && !endDate) return undefined;
  return {
    ...(startDate && { gte: startDate }),
    ...(endDate && { lte: endDate }),
  };
}

/**
 * Build search filter for multiple fields using tokenized fuzzy matching.
 */
export function buildSearchFilter(
  search: string | undefined,
  fields: string[]
): Prisma.JsonValue | undefined {
  if (!search || search.trim().length === 0) return undefined;
  return buildTokenizedSearchWhere(search, fields) as Prisma.JsonValue;
}

/**
 * Create a standardized search schema
 */
export const SearchSchema = z.object({
  search: z.string().optional(),
  searchFields: z.array(z.string()).optional(),
});

// ============ Response Formatters ============

/**
 * Format list response with offset pagination
 */
export function formatOffsetListResponse<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number
): PaginatedResponse<T> {
  return createPaginatedResponse(data, calculateOffsetMeta(page, pageSize, total));
}

/**
 * Format list response with cursor pagination
 */
export function formatCursorListResponse<T extends { id: string }>(
  data: T[],
  limit: number,
  direction: 'forward' | 'backward' = 'forward',
  total?: number
): PaginatedResponse<T> {
  const hasMore = data.length > limit;
  const items = hasMore ? data.slice(0, limit) : data;
  return createPaginatedResponse(items, calculateCursorMeta(data, limit, direction, total));
}

// ============ Common Query Patterns ============

/**
 * Standard list query with filtering, pagination, and sorting
 * Can be extended with additional filters
 */
export function createListQuerySchema<T extends z.ZodRawShape>(
  additionalFilters?: T
) {
  const baseSchema = ListQuerySchema.extend({
    search: z.string().optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  });

  if (additionalFilters) {
    return baseSchema.extend(additionalFilters);
  }

  return baseSchema;
}

/**
 * Execute a paginated Prisma query with count
 */
export async function executePaginatedQuery<T>(
  findMany: () => Promise<T[]>,
  count: () => Promise<number>,
  pagination: OffsetPagination
): Promise<{ data: T[]; total: number; pagination: OffsetPaginationMeta }> {
  const [data, total] = await Promise.all([findMany(), count()]);
  return {
    data,
    total,
    pagination: calculateOffsetMeta(pagination.page, pagination.pageSize, total),
  };
}

/**
 * Execute a cursor-paginated Prisma query
 */
export async function executeCursorPaginatedQuery<T extends { id: string }>(
  findMany: () => Promise<T[]>,
  pagination: CursorPagination,
  getTotal?: () => Promise<number>
): Promise<{ data: T[]; hasMore: boolean; pagination: CursorPaginationMeta }> {
  const [items, total] = await Promise.all([
    findMany(),
    getTotal ? getTotal() : Promise.resolve(undefined),
  ]);

  const hasMore = items.length > pagination.limit;
  const data = hasMore ? items.slice(0, pagination.limit) : items;
  const meta = calculateCursorMeta(items, pagination.limit, pagination.direction, total);

  return {
    data,
    hasMore,
    pagination: meta,
  };
}

// ============ Default Schemas for Common Entities ============

/**
 * Work order list query schema
 */
export const WorkOrderListQuerySchema = createListQuerySchema({
  status: z.string().optional(),
  priority: z.coerce.number().optional(),
  customerId: z.string().uuid().optional(),
  assignedToId: z.string().uuid().optional(),
  station: z.string().optional(),
});

/**
 * Customer list query schema
 */
export const CustomerListQuerySchema = createListQuerySchema({
  isActive: z.coerce.boolean().optional(),
  tags: z.array(z.string()).optional(),
  isOnCreditHold: z.coerce.boolean().optional(),
});

/**
 * User list query schema
 */
export const UserListQuerySchema = createListQuerySchema({
  role: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
});

/**
 * Quote list query schema
 */
export const QuoteListQuerySchema = createListQuerySchema({
  status: z.string().optional(),
  customerId: z.string().uuid().optional(),
  assignedToId: z.string().uuid().optional(),
});

export default {
  // Schemas
  OffsetPaginationSchema,
  CursorPaginationSchema,
  FlexiblePaginationSchema,
  SortingSchema,
  ListQuerySchema,
  CursorListQuerySchema,
  SearchSchema,
  // Helpers
  calculateOffsetMeta,
  calculateCursorMeta,
  buildOffsetPrismaArgs,
  buildCursorPrismaArgs,
  buildOrderByClause,
  buildDateRangeFilter,
  buildSearchFilter,
  // Cursor utils
  encodeCursor,
  decodeCursor,
  createCompositeCursor,
  // Response formatters
  createPaginatedResponse,
  formatOffsetListResponse,
  formatCursorListResponse,
  // Query executors
  executePaginatedQuery,
  executeCursorPaginatedQuery,
  // Sort validation
  validateSortField,
  SORTABLE_FIELDS,
  // Entity-specific schemas
  WorkOrderListQuerySchema,
  CustomerListQuerySchema,
  UserListQuerySchema,
  QuoteListQuerySchema,
};
