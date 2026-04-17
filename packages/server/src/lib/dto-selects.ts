/**
 * Prisma Select Helpers (DTO Mappers)
 * 
 * Provides type-safe Prisma select objects to avoid over-fetching data.
 * Part of Critical Improvement #1: Database Query Optimization
 * 
 * Usage:
 *   import { OrderListSelect, CustomerSummarySelect } from '../lib/dto-selects.js';
 *   const orders = await prisma.workOrder.findMany({ select: OrderListSelect });
 */

import { Prisma } from '@prisma/client';

// ============ Work Order Selects ============

/**
 * Minimal order data for list views
 */
export const OrderListSelect = {
  id: true,
  orderNumber: true,
  customerName: true,
  description: true,
  status: true,
  priority: true,
  dueDate: true,
  createdAt: true,
  routing: true,
  customer: {
    select: {
      id: true,
      name: true,
      companyName: true,
    },
  },
  assignedTo: {
    select: {
      id: true,
      displayName: true,
    },
  },
} satisfies Prisma.WorkOrderSelect;

/**
 * Order data for kanban/board views
 */
export const OrderKanbanSelect = {
  id: true,
  orderNumber: true,
  customerName: true,
  description: true,
  status: true,
  priority: true,
  dueDate: true,
  customer: {
    select: {
      id: true,
      name: true,
    },
  },
  stationProgress: {
    select: {
      station: true,
      status: true,
    },
  },
} satisfies Prisma.WorkOrderSelect;

/**
 * Order summary for dropdowns/references
 */
export const OrderSummarySelect = {
  id: true,
  orderNumber: true,
  customerName: true,
  status: true,
} satisfies Prisma.WorkOrderSelect;

/**
 * Work order reference data for nested relations and linked rows
 */
export const WorkOrderReferenceSelect = {
  id: true,
  orderNumber: true,
  customerName: true,
} satisfies Prisma.WorkOrderSelect;

// ============ Customer Selects ============

/**
 * Customer data for list views
 */
export const CustomerListSelect = {
  id: true,
  name: true,
  companyName: true,
  email: true,
  phone: true,
  isActive: true,
  isOnCreditHold: true,
  createdAt: true,
} satisfies Prisma.CustomerSelect;

/**
 * Customer summary for dropdowns/references
 */
export const CustomerSummarySelect = {
  id: true,
  name: true,
  companyName: true,
  email: true,
} satisfies Prisma.CustomerSelect;

/**
 * Customer with address for forms
 */
export const CustomerWithAddressSelect = {
  id: true,
  name: true,
  companyName: true,
  email: true,
  phone: true,
  address: true,
  city: true,
  state: true,
  zipCode: true,
} satisfies Prisma.CustomerSelect;

// ============ User Selects ============

/**
 * User data for list views (no sensitive fields)
 */
export const UserListSelect = {
  id: true,
  username: true,
  displayName: true,
  email: true,
  role: true,
  isActive: true,
  allowedStations: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

/**
 * User summary for dropdowns/references
 */
export const UserSummarySelect = {
  id: true,
  displayName: true,
  email: true,
  role: true,
} satisfies Prisma.UserSelect;

/**
 * User for assignment dropdowns
 */
export const UserAssigneeSelect = {
  id: true,
  displayName: true,
  allowedStations: true,
  isActive: true,
} satisfies Prisma.UserSelect;

// ============ Quote Selects ============

/**
 * Quote data for list views
 */
export const QuoteListSelect = {
  id: true,
  quoteNumber: true,
  customerName: true,
  description: true,
  status: true,
  total: true,
  validUntil: true,
  createdAt: true,
  customer: {
    select: {
      id: true,
      name: true,
      companyName: true,
    },
  },
  assignedTo: {
    select: {
      id: true,
      displayName: true,
    },
  },
} satisfies Prisma.QuoteSelect;

/**
 * Quote summary for references
 */
export const QuoteSummarySelect = {
  id: true,
  quoteNumber: true,
  customerName: true,
  status: true,
  total: true,
} satisfies Prisma.QuoteSelect;

// ============ Activity Log Selects ============

/**
 * Activity log for timeline views
 */
export const ActivityListSelect = {
  id: true,
  action: true,
  entityType: true,
  entityId: true,
  entityName: true,
  description: true,
  details: true,
  createdAt: true,
  user: {
    select: {
      id: true,
      displayName: true,
    },
  },
} satisfies Prisma.ActivityLogSelect;

// ============ Type Exports ============

export type OrderListData = Prisma.WorkOrderGetPayload<{ select: typeof OrderListSelect }>;
export type OrderKanbanData = Prisma.WorkOrderGetPayload<{ select: typeof OrderKanbanSelect }>;
export type OrderSummaryData = Prisma.WorkOrderGetPayload<{ select: typeof OrderSummarySelect }>;
export type CustomerListData = Prisma.CustomerGetPayload<{ select: typeof CustomerListSelect }>;
export type CustomerSummaryData = Prisma.CustomerGetPayload<{ select: typeof CustomerSummarySelect }>;
export type UserListData = Prisma.UserGetPayload<{ select: typeof UserListSelect }>;
export type UserSummaryData = Prisma.UserGetPayload<{ select: typeof UserSummarySelect }>;
export type QuoteListData = Prisma.QuoteGetPayload<{ select: typeof QuoteListSelect }>;
export type ActivityListData = Prisma.ActivityLogGetPayload<{ select: typeof ActivityListSelect }>;
