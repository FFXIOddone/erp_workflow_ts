/**
 * Global Search Routes
 *
 * Full-text search across all major entities:
 * - Work Orders
 * - Customers
 * - Quotes
 * - Inventory Items
 * - Users
 *
 * Supports filtering by entity type and returning unified results
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthRequest, authenticate } from '../middleware/auth.js';
import { prisma } from '../db/client.js';
import { BadRequestError } from '../middleware/error-handler.js';
import { logActivity, ActivityAction, EntityType } from '../lib/activity-logger.js';
import { buildTokenizedSearchWhere } from '../lib/fuzzy-search.js';

export const searchRouter = Router();

// ============================================================================
// TYPES & SCHEMAS
// ============================================================================

type SearchEntityType = 'workorder' | 'customer' | 'quote' | 'inventory' | 'user' | 'all';

interface SearchResult {
  id: string;
  entityType: SearchEntityType;
  title: string;
  subtitle?: string;
  description?: string;
  url: string;
  matchedField: string;
  relevanceScore: number;
  createdAt?: Date;
  metadata?: Record<string, unknown>;
}

interface SearchResponse {
  query: string;
  entityTypes: SearchEntityType[];
  results: SearchResult[];
  totalCount: number;
  groupedCounts: Record<SearchEntityType, number>;
  took: number; // milliseconds
}

// Validation schemas
const GlobalSearchSchema = z.object({
  q: z.string().min(1).max(200),
  types: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return ['all'] as SearchEntityType[];
      return val.split(',').filter(Boolean) as SearchEntityType[];
    }),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  includeInactive: z.coerce.boolean().default(false),
});

const QuickSearchSchema = z.object({
  q: z.string().min(1).max(100),
  limit: z.coerce.number().min(1).max(10).default(5),
});

const EntitySearchSchema = z.object({
  q: z.string().min(1).max(200),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Escape special characters for PostgreSQL LIKE queries
 */
function escapeLikePattern(pattern: string): string {
  return pattern.replace(/[%_\\]/g, '\\$&');
}

/**
 * Build search pattern for ILIKE
 */
function buildSearchPattern(query: string): string {
  const escaped = escapeLikePattern(query.trim());
  return `%${escaped}%`;
}

/**
 * Calculate simple relevance score based on match position and type
 */
function calculateRelevance(
  query: string,
  value: string | null | undefined,
  fieldWeight: number
): number {
  if (!value) return 0;
  const lowerQuery = query.toLowerCase();
  const lowerValue = value.toLowerCase();

  // Exact match gets highest score
  if (lowerValue === lowerQuery) return 100 * fieldWeight;

  // Starts with query
  if (lowerValue.startsWith(lowerQuery)) return 80 * fieldWeight;

  // Contains query
  const index = lowerValue.indexOf(lowerQuery);
  if (index >= 0) {
    // Earlier matches score higher
    return (60 - Math.min(index, 50)) * fieldWeight;
  }

  return 0;
}

/**
 * Find which field matched the query
 */
function findMatchedField(query: string, fields: { name: string; value: string | null | undefined }[]): string {
  const lowerQuery = query.toLowerCase();
  for (const field of fields) {
    if (field.value && field.value.toLowerCase().includes(lowerQuery)) {
      return field.name;
    }
  }
  return 'content';
}

// ============================================================================
// SEARCH FUNCTIONS BY ENTITY TYPE
// ============================================================================

async function searchWorkOrders(
  query: string,
  limit: number,
  offset: number,
  includeInactive: boolean
): Promise<SearchResult[]> {
  const pattern = buildSearchPattern(query);

  const orders = await prisma.workOrder.findMany({
    where: {
      ...(includeInactive ? {} : { status: { notIn: ['CANCELLED'] } }),
      ...(buildTokenizedSearchWhere(query, ['orderNumber', 'customerName', 'description', 'notes']) || {}),
    },
    take: limit,
    skip: offset,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      description: true,
      status: true,
      createdAt: true,
      dueDate: true,
    },
  });

  return orders.map((order) => {
    const fields = [
      { name: 'orderNumber', value: order.orderNumber },
      { name: 'customerName', value: order.customerName },
      { name: 'description', value: order.description },
    ];

    const matchedField = findMatchedField(query, fields);
    const relevance = Math.max(
      calculateRelevance(query, order.orderNumber, 2.0),
      calculateRelevance(query, order.customerName, 1.5),
      calculateRelevance(query, order.description, 1.0)
    );

    return {
      id: order.id,
      entityType: 'workorder' as const,
      title: `${order.orderNumber} - ${order.customerName}`,
      subtitle: order.status,
      description: order.description.length > 100 ? order.description.slice(0, 100) + '...' : order.description,
      url: `/orders/${order.id}`,
      matchedField,
      relevanceScore: relevance,
      createdAt: order.createdAt,
      metadata: {
        status: order.status,
        dueDate: order.dueDate,
      },
    };
  });
}

async function searchCustomers(
  query: string,
  limit: number,
  offset: number,
  includeInactive: boolean
): Promise<SearchResult[]> {
  const customers = await prisma.customer.findMany({
    where: {
      ...(includeInactive ? {} : { isActive: true }),
      ...(buildTokenizedSearchWhere(query, ['name', 'companyName', 'email', 'phone', 'city']) || {}),
    },
    take: limit,
    skip: offset,
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      companyName: true,
      email: true,
      phone: true,
      city: true,
      state: true,
      createdAt: true,
      isActive: true,
    },
  });

  return customers.map((customer) => {
    const fields = [
      { name: 'name', value: customer.name },
      { name: 'companyName', value: customer.companyName },
      { name: 'email', value: customer.email },
      { name: 'phone', value: customer.phone },
    ];

    const matchedField = findMatchedField(query, fields);
    const relevance = Math.max(
      calculateRelevance(query, customer.name, 2.0),
      calculateRelevance(query, customer.companyName, 1.8),
      calculateRelevance(query, customer.email, 1.5),
      calculateRelevance(query, customer.phone, 1.2)
    );

    const location = [customer.city, customer.state].filter(Boolean).join(', ');

    return {
      id: customer.id,
      entityType: 'customer' as const,
      title: customer.companyName || customer.name,
      subtitle: customer.name !== customer.companyName ? customer.name : undefined,
      description: [customer.email, customer.phone, location].filter(Boolean).join(' • '),
      url: `/customers/${customer.id}`,
      matchedField,
      relevanceScore: relevance,
      createdAt: customer.createdAt,
      metadata: {
        isActive: customer.isActive,
      },
    };
  });
}

async function searchQuotes(
  query: string,
  limit: number,
  offset: number,
  includeInactive: boolean
): Promise<SearchResult[]> {
  const quotes = await prisma.quote.findMany({
    where: {
      ...(includeInactive ? {} : { status: { notIn: ['EXPIRED', 'REJECTED'] } }),
      ...(buildTokenizedSearchWhere(query, ['quoteNumber', 'customerName', 'description', 'notes']) || {}),
    },
    take: limit,
    skip: offset,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      quoteNumber: true,
      customerName: true,
      description: true,
      status: true,
      total: true,
      createdAt: true,
      validUntil: true,
    },
  });

  return quotes.map((quote) => {
    const fields = [
      { name: 'quoteNumber', value: quote.quoteNumber },
      { name: 'customerName', value: quote.customerName },
      { name: 'description', value: quote.description },
    ];

    const matchedField = findMatchedField(query, fields);
    const relevance = Math.max(
      calculateRelevance(query, quote.quoteNumber, 2.0),
      calculateRelevance(query, quote.customerName, 1.5),
      calculateRelevance(query, quote.description, 1.0)
    );

    return {
      id: quote.id,
      entityType: 'quote' as const,
      title: `${quote.quoteNumber} - ${quote.customerName}`,
      subtitle: `${quote.status} • $${Number(quote.total).toFixed(2)}`,
      description: quote.description?.slice(0, 100),
      url: `/quotes/${quote.id}`,
      matchedField,
      relevanceScore: relevance,
      createdAt: quote.createdAt,
      metadata: {
        status: quote.status,
        total: Number(quote.total),
        validUntil: quote.validUntil,
      },
    };
  });
}

async function searchInventory(
  query: string,
  limit: number,
  offset: number,
  includeInactive: boolean
): Promise<SearchResult[]> {
  const items = await prisma.itemMaster.findMany({
    where: {
      ...(includeInactive ? {} : { isActive: true }),
      ...(buildTokenizedSearchWhere(query, ['sku', 'name', 'description', 'category']) || {}),
    },
    take: limit,
    skip: offset,
    orderBy: { name: 'asc' },
    include: {
      inventoryItems: {
        select: {
          quantity: true,
          status: true,
        },
      },
    },
  });

  return items.map((item) => {
    const fields = [
      { name: 'sku', value: item.sku },
      { name: 'name', value: item.name },
      { name: 'description', value: item.description },
      { name: 'category', value: item.category },
    ];

    const matchedField = findMatchedField(query, fields);
    const relevance = Math.max(
      calculateRelevance(query, item.sku, 2.5),
      calculateRelevance(query, item.name, 2.0),
      calculateRelevance(query, item.description, 1.0),
      calculateRelevance(query, item.category, 1.2)
    );

    const totalQuantity = item.inventoryItems.reduce((sum, inv) => sum + inv.quantity, 0);

    return {
      id: item.id,
      entityType: 'inventory' as const,
      title: item.name,
      subtitle: item.sku,
      description: `${item.category || 'No category'} • $${Number(item.unitPrice).toFixed(2)} • Qty: ${totalQuantity}`,
      url: `/inventory/${item.id}`,
      matchedField,
      relevanceScore: relevance,
      createdAt: item.createdAt,
      metadata: {
        category: item.category,
        unitPrice: Number(item.unitPrice),
        quantity: totalQuantity,
        isActive: item.isActive,
      },
    };
  });
}

async function searchUsers(
  query: string,
  limit: number,
  offset: number,
  includeInactive: boolean
): Promise<SearchResult[]> {
  const users = await prisma.user.findMany({
    where: {
      ...(includeInactive ? {} : { isActive: true }),
      ...(buildTokenizedSearchWhere(query, ['username', 'displayName', 'email']) || {}),
    },
    take: limit,
    skip: offset,
    orderBy: { displayName: 'asc' },
    select: {
      id: true,
      username: true,
      displayName: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  return users.map((user) => {
    const fields = [
      { name: 'username', value: user.username },
      { name: 'displayName', value: user.displayName },
      { name: 'email', value: user.email },
    ];

    const matchedField = findMatchedField(query, fields);
    const relevance = Math.max(
      calculateRelevance(query, user.username, 2.0),
      calculateRelevance(query, user.displayName, 1.8),
      calculateRelevance(query, user.email, 1.5)
    );

    return {
      id: user.id,
      entityType: 'user' as const,
      title: user.displayName,
      subtitle: `@${user.username}`,
      description: `${user.role} • ${user.email || 'No email'}`,
      url: `/users/${user.id}`,
      matchedField,
      relevanceScore: relevance,
      createdAt: user.createdAt,
      metadata: {
        role: user.role,
        isActive: user.isActive,
      },
    };
  });
}

// ============================================================================
// ROUTES
// ============================================================================

// All routes require authentication
searchRouter.use(authenticate);

// --------------------------------------------------------------------------
// GET /search - Global search across all entities
// --------------------------------------------------------------------------
searchRouter.get('/', async (req: AuthRequest, res: Response) => {
  const startTime = Date.now();
  const { q, types, limit, offset, includeInactive } = GlobalSearchSchema.parse(req.query);

  const searchAll = types.includes('all');
  const searchTypes = searchAll
    ? ['workorder', 'customer', 'quote', 'inventory', 'user']
    : types.filter((t) => t !== 'all');

  // Execute searches in parallel
  const searchPromises: Promise<SearchResult[]>[] = [];
  const entityTypesSearched: SearchEntityType[] = [];

  for (const type of searchTypes) {
    switch (type) {
      case 'workorder':
        searchPromises.push(searchWorkOrders(q, limit, offset, includeInactive));
        entityTypesSearched.push('workorder');
        break;
      case 'customer':
        searchPromises.push(searchCustomers(q, limit, offset, includeInactive));
        entityTypesSearched.push('customer');
        break;
      case 'quote':
        searchPromises.push(searchQuotes(q, limit, offset, includeInactive));
        entityTypesSearched.push('quote');
        break;
      case 'inventory':
        searchPromises.push(searchInventory(q, limit, offset, includeInactive));
        entityTypesSearched.push('inventory');
        break;
      case 'user':
        searchPromises.push(searchUsers(q, limit, offset, includeInactive));
        entityTypesSearched.push('user');
        break;
    }
  }

  const searchResults = await Promise.all(searchPromises);

  // Combine and sort by relevance
  const allResults: SearchResult[] = [];
  const groupedCounts: Record<SearchEntityType, number> = {
    workorder: 0,
    customer: 0,
    quote: 0,
    inventory: 0,
    user: 0,
    all: 0,
  };

  for (let i = 0; i < searchResults.length; i++) {
    const results = searchResults[i];
    const entityType = entityTypesSearched[i];
    groupedCounts[entityType] = results.length;
    allResults.push(...results);
  }

  // Sort by relevance score (descending)
  allResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

  // Apply global limit
  const finalResults = allResults.slice(0, limit);
  const totalCount = allResults.length;
  groupedCounts.all = totalCount;

  const took = Date.now() - startTime;

  // Log search activity
  await logActivity({
    action: ActivityAction.VIEW,
    entityType: EntityType.OTHER,
    entityId: 'global-search',
    description: `Search: "${q}" (${totalCount} results in ${took}ms)`,
    userId: req.userId!,
    req,
  });

  const response: SearchResponse = {
    query: q,
    entityTypes: entityTypesSearched,
    results: finalResults,
    totalCount,
    groupedCounts,
    took,
  };

  res.json({
    success: true,
    data: response,
  });
});

// --------------------------------------------------------------------------
// GET /search/quick - Quick search for autocomplete/command palette
// --------------------------------------------------------------------------
searchRouter.get('/quick', async (req: AuthRequest, res: Response) => {
  const startTime = Date.now();
  const { q, limit } = QuickSearchSchema.parse(req.query);

  // Search top entities with lower limits for speed
  const [orders, customers, quotes, inventory] = await Promise.all([
    searchWorkOrders(q, limit, 0, false),
    searchCustomers(q, limit, 0, false),
    searchQuotes(q, limit, 0, false),
    searchInventory(q, limit, 0, false),
  ]);

  // Combine and sort by relevance, take top results
  const allResults = [...orders, ...customers, ...quotes, ...inventory];
  allResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

  const finalResults = allResults.slice(0, limit);
  const took = Date.now() - startTime;

  res.json({
    success: true,
    data: {
      query: q,
      results: finalResults,
      took,
    },
  });
});

// --------------------------------------------------------------------------
// GET /search/orders - Search work orders only
// --------------------------------------------------------------------------
searchRouter.get('/orders', async (req: AuthRequest, res: Response) => {
  const { q, limit, offset } = EntitySearchSchema.parse(req.query);
  const startTime = Date.now();

  const results = await searchWorkOrders(q, limit, offset, false);
  const took = Date.now() - startTime;

  res.json({
    success: true,
    data: {
      query: q,
      entityType: 'workorder',
      results,
      count: results.length,
      took,
    },
  });
});

// --------------------------------------------------------------------------
// GET /search/customers - Search customers only
// --------------------------------------------------------------------------
searchRouter.get('/customers', async (req: AuthRequest, res: Response) => {
  const { q, limit, offset } = EntitySearchSchema.parse(req.query);
  const startTime = Date.now();

  const results = await searchCustomers(q, limit, offset, false);
  const took = Date.now() - startTime;

  res.json({
    success: true,
    data: {
      query: q,
      entityType: 'customer',
      results,
      count: results.length,
      took,
    },
  });
});

// --------------------------------------------------------------------------
// GET /search/quotes - Search quotes only
// --------------------------------------------------------------------------
searchRouter.get('/quotes', async (req: AuthRequest, res: Response) => {
  const { q, limit, offset } = EntitySearchSchema.parse(req.query);
  const startTime = Date.now();

  const results = await searchQuotes(q, limit, offset, false);
  const took = Date.now() - startTime;

  res.json({
    success: true,
    data: {
      query: q,
      entityType: 'quote',
      results,
      count: results.length,
      took,
    },
  });
});

// --------------------------------------------------------------------------
// GET /search/inventory - Search inventory items only
// --------------------------------------------------------------------------
searchRouter.get('/inventory', async (req: AuthRequest, res: Response) => {
  const { q, limit, offset } = EntitySearchSchema.parse(req.query);
  const startTime = Date.now();

  const results = await searchInventory(q, limit, offset, false);
  const took = Date.now() - startTime;

  res.json({
    success: true,
    data: {
      query: q,
      entityType: 'inventory',
      results,
      count: results.length,
      took,
    },
  });
});

// --------------------------------------------------------------------------
// GET /search/users - Search users only
// --------------------------------------------------------------------------
searchRouter.get('/users', async (req: AuthRequest, res: Response) => {
  const { q, limit, offset } = EntitySearchSchema.parse(req.query);
  const startTime = Date.now();

  const results = await searchUsers(q, limit, offset, false);
  const took = Date.now() - startTime;

  res.json({
    success: true,
    data: {
      query: q,
      entityType: 'user',
      results,
      count: results.length,
      took,
    },
  });
});

// --------------------------------------------------------------------------
// GET /search/suggestions - Get search suggestions based on history
// --------------------------------------------------------------------------
searchRouter.get('/suggestions', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;

  // Get recent searches from activity log
  const recentSearches = await prisma.activityLog.findMany({
    where: {
      userId,
      action: 'VIEW',
      entityId: 'global-search',
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      description: true,
      createdAt: true,
    },
  });

  // Extract search queries from descriptions
  const suggestions = recentSearches
    .map((s) => {
      const match = s.description.match(/Search: "(.+?)"/);
      return match ? match[1] : null;
    })
    .filter((q): q is string => q !== null)
    .filter((q, i, arr) => arr.indexOf(q) === i) // Unique
    .slice(0, 5);

  res.json({
    success: true,
    data: {
      recentSearches: suggestions,
    },
  });
});

// --------------------------------------------------------------------------
// GET /search/advanced - Advanced search with field-specific queries
// --------------------------------------------------------------------------
const AdvancedSearchSchema = z.object({
  entityType: z.enum(['workorder', 'customer', 'quote', 'inventory']),
  fields: z.record(z.string()).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  status: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

searchRouter.get('/advanced', async (req: AuthRequest, res: Response) => {
  const { entityType, fields, dateFrom, dateTo, status, limit, offset } = AdvancedSearchSchema.parse(
    req.query
  );
  const startTime = Date.now();

  let results: SearchResult[] = [];

  // Build date filter
  const dateFilter: { createdAt?: { gte?: Date; lte?: Date } } = {};
  if (dateFrom) {
    dateFilter.createdAt = { ...dateFilter.createdAt, gte: new Date(dateFrom) };
  }
  if (dateTo) {
    dateFilter.createdAt = { ...dateFilter.createdAt, lte: new Date(dateTo) };
  }

  switch (entityType) {
    case 'workorder': {
      const where: Record<string, unknown> = { ...dateFilter };
      if (fields) {
        const orConditions: Record<string, unknown>[] = [];
        if (fields.orderNumber) {
          orConditions.push({ orderNumber: { contains: fields.orderNumber, mode: 'insensitive' } });
        }
        if (fields.customerName) {
          orConditions.push({ customerName: { contains: fields.customerName, mode: 'insensitive' } });
        }
        if (fields.description) {
          orConditions.push({ description: { contains: fields.description, mode: 'insensitive' } });
        }
        if (orConditions.length > 0) {
          where.OR = orConditions;
        }
      }
      if (status) {
        where.status = status;
      }

      const orders = await prisma.workOrder.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          orderNumber: true,
          customerName: true,
          description: true,
          status: true,
          createdAt: true,
        },
      });

      results = orders.map((order) => ({
        id: order.id,
        entityType: 'workorder' as const,
        title: `${order.orderNumber} - ${order.customerName}`,
        subtitle: order.status,
        description: order.description.slice(0, 100),
        url: `/orders/${order.id}`,
        matchedField: 'advanced',
        relevanceScore: 50,
        createdAt: order.createdAt,
      }));
      break;
    }

    case 'customer': {
      const where: Record<string, unknown> = { ...dateFilter };
      if (fields) {
        const orConditions: Record<string, unknown>[] = [];
        if (fields.name) {
          orConditions.push({ name: { contains: fields.name, mode: 'insensitive' } });
        }
        if (fields.companyName) {
          orConditions.push({ companyName: { contains: fields.companyName, mode: 'insensitive' } });
        }
        if (fields.email) {
          orConditions.push({ email: { contains: fields.email, mode: 'insensitive' } });
        }
        if (fields.city) {
          orConditions.push({ city: { contains: fields.city, mode: 'insensitive' } });
        }
        if (orConditions.length > 0) {
          where.OR = orConditions;
        }
      }

      const customers = await prisma.customer.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          companyName: true,
          email: true,
          createdAt: true,
        },
      });

      results = customers.map((customer) => ({
        id: customer.id,
        entityType: 'customer' as const,
        title: customer.companyName || customer.name,
        subtitle: customer.name,
        description: customer.email || '',
        url: `/customers/${customer.id}`,
        matchedField: 'advanced',
        relevanceScore: 50,
        createdAt: customer.createdAt,
      }));
      break;
    }

    case 'quote': {
      const where: Record<string, unknown> = { ...dateFilter };
      if (fields) {
        const orConditions: Record<string, unknown>[] = [];
        if (fields.quoteNumber) {
          orConditions.push({ quoteNumber: { contains: fields.quoteNumber, mode: 'insensitive' } });
        }
        if (fields.customerName) {
          orConditions.push({ customerName: { contains: fields.customerName, mode: 'insensitive' } });
        }
        if (orConditions.length > 0) {
          where.OR = orConditions;
        }
      }
      if (status) {
        where.status = status;
      }

      const quotes = await prisma.quote.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          quoteNumber: true,
          customerName: true,
          status: true,
          total: true,
          createdAt: true,
        },
      });

      results = quotes.map((quote) => ({
        id: quote.id,
        entityType: 'quote' as const,
        title: `${quote.quoteNumber} - ${quote.customerName}`,
        subtitle: `${quote.status} • $${Number(quote.total).toFixed(2)}`,
        url: `/quotes/${quote.id}`,
        matchedField: 'advanced',
        relevanceScore: 50,
        createdAt: quote.createdAt,
      }));
      break;
    }

    case 'inventory': {
      const where: Record<string, unknown> = { ...dateFilter };
      if (fields) {
        const orConditions: Record<string, unknown>[] = [];
        if (fields.sku) {
          orConditions.push({ sku: { contains: fields.sku, mode: 'insensitive' } });
        }
        if (fields.name) {
          orConditions.push({ name: { contains: fields.name, mode: 'insensitive' } });
        }
        if (fields.category) {
          orConditions.push({ category: { contains: fields.category, mode: 'insensitive' } });
        }
        if (orConditions.length > 0) {
          where.OR = orConditions;
        }
      }

      const items = await prisma.itemMaster.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          sku: true,
          name: true,
          category: true,
          unitPrice: true,
          createdAt: true,
        },
      });

      results = items.map((item) => ({
        id: item.id,
        entityType: 'inventory' as const,
        title: item.name,
        subtitle: item.sku,
        description: `${item.category || 'No category'} • $${Number(item.unitPrice).toFixed(2)}`,
        url: `/inventory/${item.id}`,
        matchedField: 'advanced',
        relevanceScore: 50,
        createdAt: item.createdAt,
      }));
      break;
    }
  }

  const took = Date.now() - startTime;

  res.json({
    success: true,
    data: {
      entityType,
      results,
      count: results.length,
      took,
    },
  });
});

export default searchRouter;
