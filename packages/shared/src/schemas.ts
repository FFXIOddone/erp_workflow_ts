import { z } from 'zod';
import {
  OrderStatus,
  PrintingMethod,
  ReprintReason,
  InventoryStatus,
  UserRole,
  AttachmentType,
  StationStatus,
  QuoteStatus,
  POStatus,
  Carrier,
  ShipmentStatus,
  QCStatus,
  EmailTrigger,
  EmailStatus,
  SlotStatus,
  DocumentCategory,
  RecurringFrequency,
  AlertType,
  AlertSeverity,
  AlertTriggerType,
  IntegrationType,
  IntegrationStatus,
  CredentialType,
  SyncType,
  SyncDirection,
  SyncStatus,
  FilterEntityType,
  AuditEntityType,
  AuditAction,
  ChangeSource,
  PrintJobStatus,
  ThemeMode,
  FontSize,
  SidebarPosition,
  NotificationDigest,
  TimeFormat,
  FavoriteEntityType,
  SearchType,
  SearchEntityType,
  ImportJobStatus,
  ImportEntityType,
  ImportFileType,
  ShortcutScope,
  OptimizationRuleType,
  OptimizationCategory,
  ConstraintType,
  ConstraintTarget,
  ValidationSeverity,
  FieldConstraintType,
  AnomalyType,
  IntegrityCheckStatus,
  CheckFrequency,
  // Financial tracking enums
  CostCenterType,
  BudgetPeriod,
  AllocationMethod,
  MaterialType,
  LaborActivity,
  LaborCostStatus,
  OverheadCategory,
  ProfitEntityType,
  ProfitabilityTier,
  // Quality Management enums
  QualityStandardType,
  SamplingMethod,
  StandardStatus,
  CheckpointType,
  InspectionResult,
  InspectionDisposition,
  NCRCategory,
  NCRSeverity,
  NCRSource,
  NCRStatus,
  NCRDisposition,
  CorrectiveActionType,
  CorrectiveActionPriority,
  RootCauseMethod,
  CAStatus,
  EffectivenessResult,
  QualityMeasurementType,
  SPCChartType,
  // Document Management enums
  DocumentVersionStatus,
  TemplateType,
  ApprovalType,
  ApprovalStatus,
  ApprovalDecision,
  DocumentAccessType,
  DocumentAccessAction,
  // Performance & Analytics enums
  MetricSnapshotType,
  MetricScopeType,
  ThroughputPeriod,
  BottleneckResource,
  BottleneckType,
  BottleneckSeverity,
  BottleneckResolution,
  ProductivityPeriod,
  GoalType,
  GoalDirection,
  GoalPeriod,
  GoalStatus,
  // Project Management enums
  ProjectStatus,
  ProjectPriority,
  MilestoneStatus,
  BudgetLineType,
  BudgetStatus,
  JobTemplateCategory,
  // Nesting & Waste enums
  NestingStatus,
  CutStatus,
  WasteCategory,
  SheetStatus,
  NestingAlgorithm,
  // Notification & Communication enums
  NotificationChannel,
  NotificationPriorityLevel,
  NotificationDeliveryStatus,
  ThreadStatus,
  AnnouncementScope,
  // Company Brand
  CompanyBrand,
} from './enums.js';

// ============ Work Order Schemas ============

export const CreateLineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  notes: z.string().nullable().optional(),
  itemMasterId: z.string().uuid('Item must be selected from the catalog'),
});

export const UpdateLineItemSchema = CreateLineItemSchema.partial();

export const CreateWorkOrderSchema = z.object({
  orderNumber: z.string().min(1).optional(), // Auto-generated server-side if omitted
  customerName: z.string().min(1).optional(), // Derived from company if omitted
  customerId: z.string().uuid().nullable().optional(), // Legacy
  companyId: z.string().uuid(), // Required: Company (who to bill)
  contactId: z.string().uuid().nullable().optional(), // New: Contact (PoC)
  description: z.string().min(1),
  priority: z.number().int().min(1).max(5).default(3),
  companyBrand: z.nativeEnum(CompanyBrand).default(CompanyBrand.WILDE_SIGNS),
  dueDate: z.coerce.date().nullable().optional(),
  notes: z.string().nullable().optional(),
  poNumber: z.string().nullable().optional(),
  routing: z.array(z.nativeEnum(PrintingMethod)).default([]),
  lineItems: z.array(CreateLineItemSchema).default([]),
});

export const UpdateLineItemPayloadSchema = z.object({
  id: z.string().uuid().optional(), // present for existing items
  itemMasterId: z.string().uuid('Item must be selected from the catalog'),
  description: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  notes: z.string().nullable().optional(),
});

export const UpdateWorkOrderSchema = z.object({
  orderNumber: z.string().min(1).optional(),
  customerName: z.string().min(1).optional(),
  customerId: z.string().uuid().nullable().optional(),
  companyId: z.string().uuid().nullable().optional(),
  contactId: z.string().uuid().nullable().optional(),
  description: z.string().min(1).optional(),
  status: z.nativeEnum(OrderStatus).optional(),
  priority: z.number().int().min(1).max(5).optional(),
  companyBrand: z.nativeEnum(CompanyBrand).optional(),
  dueDate: z.coerce.date().nullable().optional(),
  notes: z.string().nullable().optional(),
  poNumber: z.string().nullable().optional(),
  assignedToId: z.string().uuid().nullable().optional(),
  routing: z.array(z.nativeEnum(PrintingMethod)).optional(),
  lineItems: z.array(UpdateLineItemPayloadSchema).optional(),
  nestingEnabled: z.boolean().optional(),
  nestingFileName: z.string().nullable().optional(),
});

export const SetRoutingSchema = z.object({
  routing: z.array(z.nativeEnum(PrintingMethod)),
});

export const CompleteStationSchema = z.object({
  station: z.nativeEnum(PrintingMethod),
});

export const LogTimeSchema = z.object({
  station: z.nativeEnum(PrintingMethod),
  startTime: z.coerce.date(),
  endTime: z.coerce.date().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const CreateReprintSchema = z.object({
  lineItemId: z.string().uuid().nullable().optional(),
  reason: z.nativeEnum(ReprintReason),
  description: z.string().min(1),
  quantity: z.number().int().positive(),
});

// ============ Bulk Action Schemas ============

export const BulkStatusChangeSchema = z.object({
  orderIds: z.array(z.string().uuid()).min(1, 'At least one order must be selected'),
  status: z.nativeEnum(OrderStatus),
});

export const BulkAssignSchema = z.object({
  orderIds: z.array(z.string().uuid()).min(1, 'At least one order must be selected'),
  assignedToId: z.string().uuid().nullable(),
});

export const BulkPrioritySchema = z.object({
  orderIds: z.array(z.string().uuid()).min(1, 'At least one order must be selected'),
  priority: z.number().int().min(1).max(5),
});

export const BulkDeleteSchema = z.object({
  orderIds: z.array(z.string().uuid()).min(1, 'At least one order must be selected'),
});

export const BulkStationStatusSchema = z.object({
  orderIds: z.array(z.string().uuid()).min(1, 'At least one order must be selected'),
  station: z.nativeEnum(PrintingMethod),
  status: z.nativeEnum(StationStatus),
});

export const BulkMultiStationStatusSchema = z.object({
  orderIds: z.array(z.string().uuid()).min(1, 'At least one order must be selected'),
  stationUpdates: z.array(z.object({
    station: z.nativeEnum(PrintingMethod),
    status: z.nativeEnum(StationStatus),
  })).min(1, 'At least one station update is required'),
});

// ============ Attachment Schemas ============

export const CreateAttachmentSchema = z.object({
  fileName: z.string().min(1),
  filePath: z.string().min(1), // Network path like \\server\proofs\order-12345\proof.pdf
  fileType: z.nativeEnum(AttachmentType),
  fileSize: z.number().int().positive().nullable().optional(),
  description: z.string().nullable().optional(),
});

// ============ User Schemas ============

export const CreateUserSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(8),
  displayName: z.string().min(1).max(100),
  email: z.string().email().nullable().optional(),
  role: z.nativeEnum(UserRole).default(UserRole.OPERATOR),
  allowedStations: z.array(z.nativeEnum(PrintingMethod)).default([]),
});

export const UpdateUserSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  email: z.string().email().nullable().optional(),
  role: z.nativeEnum(UserRole).optional(),
  isActive: z.boolean().optional(),
  allowedStations: z.array(z.nativeEnum(PrintingMethod)).optional(),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8),
});

export const LoginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

// ============ Item Master Schemas ============

export const CreateItemMasterSchema = z.object({
  sku: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  unitPrice: z.number().nonnegative(),
  costPrice: z.number().nonnegative().nullable().optional(),
});

export const UpdateItemMasterSchema = CreateItemMasterSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// ============ Inventory Schemas ============

export const CreateInventoryItemSchema = z.object({
  itemMasterId: z.string().uuid(),
  location: z.string().nullable().optional(),
  quantity: z.number().int().nonnegative(),
  status: z.nativeEnum(InventoryStatus).default(InventoryStatus.AVAILABLE),
  notes: z.string().nullable().optional(),
  linkedOrderId: z.string().uuid().nullable().optional(),
  linkedLineItemId: z.string().uuid().nullable().optional(),
});

export const UpdateInventoryItemSchema = z.object({
  location: z.string().nullable().optional(),
  quantity: z.number().int().nonnegative().optional(),
  status: z.nativeEnum(InventoryStatus).optional(),
  notes: z.string().nullable().optional(),
});

// ============ Template Schemas ============

export const LineItemTemplateSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  itemMasterId: z.string().uuid('Item must be selected from the catalog'),
});

export const CreateOrderTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().nullable().optional(),
  customerName: z.string().nullable().optional(),
  defaultRouting: z.array(z.nativeEnum(PrintingMethod)).default([]),
  lineItemTemplates: z.array(LineItemTemplateSchema).default([]),
});

export const UpdateOrderTemplateSchema = CreateOrderTemplateSchema.partial();

// ============ Customer Schemas ============

export const CreateCustomerContactSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  title: z.string().max(100).nullable().optional(),
  isPrimary: z.boolean().default(false),
  notes: z.string().nullable().optional(),
});

export const CreateCustomerSchema = z.object({
  name: z.string().min(1).max(200),
  companyName: z.string().max(200).nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  state: z.string().max(50).nullable().optional(),
  zipCode: z.string().max(20).nullable().optional(),
  notes: z.string().nullable().optional(),
  taxExempt: z.boolean().default(false),
  creditLimit: z.number().nonnegative().nullable().optional(),
  paymentTerms: z.string().max(50).nullable().optional(),
  networkDriveFolderPath: z.string().max(500).nullable().optional(),
  contacts: z.array(CreateCustomerContactSchema).default([]),
});

export const UpdateCustomerSchema = CreateCustomerSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// ============ Quote Schemas ============

export const CreateQuoteLineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  notes: z.string().nullable().optional(),
  itemMasterId: z.string().uuid('Item must be selected from the catalog'),
});

export const CreateQuoteSchema = z.object({
  customerName: z.string().min(1),
  customerId: z.string().uuid().nullable().optional(),
  description: z.string().nullable().optional(),
  validUntil: z.coerce.date().nullable().optional(),
  taxRate: z.number().min(0).max(1).default(0),
  discountPercent: z.number().min(0).max(100).default(0),
  notes: z.string().nullable().optional(),
  internalNotes: z.string().nullable().optional(),
  assignedToId: z.string().uuid().nullable().optional(),
  lineItems: z.array(CreateQuoteLineItemSchema).default([]),
});

export const UpdateQuoteSchema = z.object({
  customerName: z.string().min(1).optional(),
  customerId: z.string().uuid().nullable().optional(),
  description: z.string().nullable().optional(),
  status: z.nativeEnum(QuoteStatus).optional(),
  validUntil: z.coerce.date().nullable().optional(),
  taxRate: z.number().min(0).max(1).optional(),
  discountPercent: z.number().min(0).max(100).optional(),
  notes: z.string().nullable().optional(),
  internalNotes: z.string().nullable().optional(),
  assignedToId: z.string().uuid().nullable().optional(),
  lostReason: z.string().nullable().optional(),
});

// ============ Query Schemas ============

export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(500).default(20),
});

/**
 * Cursor-based pagination schema for infinite scroll / virtualized tables.
 * Uses cursor (last item ID) instead of page offset for consistent results.
 */
export const CursorPaginationSchema = z.object({
  cursor: z.string().optional(), // ID of last item from previous page
  limit: z.coerce.number().int().positive().max(100).default(50),
  direction: z.enum(['forward', 'backward']).default('forward'),
});

export const QuoteFilterSchema = PaginationSchema.extend({
  status: z.preprocess(
    // Handle comma-separated values from query string
    (val) => {
      if (typeof val === 'string' && val.includes(',')) {
        return val.split(',').map(s => s.trim()).filter(Boolean);
      }
      if (typeof val === 'string') return [val];
      return val;
    },
    z.array(z.nativeEnum(QuoteStatus)).optional()
  ),
  customerId: z.string().uuid().optional(),
  assignedToId: z.string().uuid().optional(),
  search: z.string().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  sortBy: z.enum(['createdAt', 'validUntil', 'total', 'quoteNumber', 'customerName', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const CustomerFilterSchema = PaginationSchema.extend({
  search: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
  sortBy: z.enum(['name', 'companyName', 'createdAt']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export const OrderFilterSchema = PaginationSchema.extend({
  // Cursor-based pagination (alternative to page/pageSize)
  cursor: z.string().optional(), // ID of last item from previous page
  useCursor: z.coerce.boolean().optional(), // Flag to use cursor pagination
  
  status: z.preprocess(
    // Handle comma-separated values from query string
    (val) => {
      if (typeof val === 'string' && val.includes(',')) {
        return val.split(',').map(s => s.trim()).filter(Boolean);
      }
      if (typeof val === 'string') return [val];
      return val;
    },
    z.array(z.nativeEnum(OrderStatus)).optional()
  ),
  priority: z.preprocess(
    (val) => {
      if (typeof val === 'string' && val.includes(',')) {
        return val.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
      }
      if (typeof val === 'string') return [parseInt(val, 10)];
      return val;
    },
    z.array(z.number().int().min(1).max(5)).optional()
  ),
  station: z.nativeEnum(PrintingMethod).optional(),
  myStations: z.coerce.boolean().optional(), // Filter to show only orders matching user's allowed stations
  customerId: z.string().uuid().optional(),
  companyBrand: z.nativeEnum(CompanyBrand).optional(),
  search: z.string().optional(),
  assignedToId: z.string().uuid().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  dueDateFrom: z.coerce.date().optional(),
  dueDateTo: z.coerce.date().optional(),
  dateFilter: z.enum(['dueToday', 'overdue', 'dueThisWeek']).optional(), // Dashboard quick filters
  hasAttachments: z.coerce.boolean().optional(),
  lightweight: z.coerce.boolean().optional(), // Skip lineItems/attachments for faster shop floor loads
  sortBy: z.enum(['createdAt', 'dueDate', 'priority', 'orderNumber', 'customerName', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const AuditExportSchema = z.object({
  orderId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  eventType: z.nativeEnum(OrderStatus).optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  format: z.enum(['json', 'csv']).default('json'),
});

// ============ Type Exports ============

export type CreateLineItem = z.infer<typeof CreateLineItemSchema>;
export type UpdateLineItem = z.infer<typeof UpdateLineItemSchema>;
export type CreateWorkOrder = z.infer<typeof CreateWorkOrderSchema>;
export type UpdateWorkOrder = z.infer<typeof UpdateWorkOrderSchema>;
export type SetRouting = z.infer<typeof SetRoutingSchema>;
export type CompleteStation = z.infer<typeof CompleteStationSchema>;
export type LogTime = z.infer<typeof LogTimeSchema>;
export type CreateReprint = z.infer<typeof CreateReprintSchema>;
export type CreateUser = z.infer<typeof CreateUserSchema>;
export type UpdateUser = z.infer<typeof UpdateUserSchema>;
export type ChangePassword = z.infer<typeof ChangePasswordSchema>;
export type Login = z.infer<typeof LoginSchema>;
export type CreateItemMaster = z.infer<typeof CreateItemMasterSchema>;
export type UpdateItemMaster = z.infer<typeof UpdateItemMasterSchema>;
export type CreateInventoryItem = z.infer<typeof CreateInventoryItemSchema>;
export type UpdateInventoryItem = z.infer<typeof UpdateInventoryItemSchema>;
export type CreateOrderTemplate = z.infer<typeof CreateOrderTemplateSchema>;
export type UpdateOrderTemplate = z.infer<typeof UpdateOrderTemplateSchema>;
export type CreateCustomer = z.infer<typeof CreateCustomerSchema>;
export type UpdateCustomer = z.infer<typeof UpdateCustomerSchema>;
export type CreateCustomerContact = z.infer<typeof CreateCustomerContactSchema>;
export type CreateQuote = z.infer<typeof CreateQuoteSchema>;
export type UpdateQuote = z.infer<typeof UpdateQuoteSchema>;
export type CreateQuoteLineItem = z.infer<typeof CreateQuoteLineItemSchema>;
export type QuoteFilter = z.infer<typeof QuoteFilterSchema>;
export type CustomerFilter = z.infer<typeof CustomerFilterSchema>;
export type Pagination = z.infer<typeof PaginationSchema>;
export type CursorPagination = z.infer<typeof CursorPaginationSchema>;
export type OrderFilter = z.infer<typeof OrderFilterSchema>;
export type AuditExport = z.infer<typeof AuditExportSchema>;

/**
 * Response type for cursor-paginated endpoints
 */
export interface CursorPaginatedResponse<T> {
  items: T[];
  nextCursor: string | null;
  prevCursor: string | null;
  hasMore: boolean;
  total?: number; // Optional total count (expensive for large datasets)
}

// ============ Vendor Schemas ============

export const CreateVendorContactSchema = z.object({
  name: z.string().min(1, 'Contact name is required'),
  title: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  isPrimary: z.boolean().default(false),
});

export const CreateVendorSchema = z.object({
  vendorNumber: z.string().min(1, 'Vendor number is required'),
  name: z.string().min(1, 'Vendor name is required'),
  contactName: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  zip: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  website: z.string().url().nullable().optional(),
  paymentTerms: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
  contacts: z.array(CreateVendorContactSchema).optional(),
});

export const UpdateVendorSchema = CreateVendorSchema.partial().omit({ vendorNumber: true, contacts: true });

export const VendorFilterSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
  search: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
  sortBy: z.enum(['name', 'vendorNumber', 'createdAt']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

// ============ Purchase Order Schemas ============

export const CreatePOLineItemSchema = z.object({
  itemMasterId: z.string().uuid('Item must be selected from the catalog'),
  description: z.string().min(1, 'Description is required'),
  quantity: z.number().int().positive('Quantity must be positive'),
  unitCost: z.number().nonnegative('Unit cost must be non-negative'),
  notes: z.string().nullable().optional(),
});

export const CreatePurchaseOrderSchema = z.object({
  vendorId: z.string().uuid('Vendor is required'),
  expectedDate: z.coerce.date().nullable().optional(),
  taxAmount: z.number().nonnegative().default(0),
  shippingCost: z.number().nonnegative().default(0),
  notes: z.string().nullable().optional(),
  lineItems: z.array(CreatePOLineItemSchema).min(1, 'At least one line item is required'),
});

export const UpdatePurchaseOrderSchema = z.object({
  vendorId: z.string().uuid().optional(),
  expectedDate: z.coerce.date().nullable().optional(),
  taxAmount: z.number().nonnegative().optional(),
  shippingCost: z.number().nonnegative().optional(),
  notes: z.string().nullable().optional(),
  status: z.nativeEnum(POStatus).optional(),
});

export const ReceivePOLineItemSchema = z.object({
  poLineItemId: z.string().uuid(),
  quantityReceived: z.number().int().positive('Quantity must be positive'),
  notes: z.string().nullable().optional(),
});

export const ReceivePurchaseOrderSchema = z.object({
  lineItems: z.array(ReceivePOLineItemSchema).min(1, 'At least one line item is required'),
  notes: z.string().nullable().optional(),
});

export const POFilterSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
  status: z.nativeEnum(POStatus).optional(),
  vendorId: z.string().uuid().optional(),
  search: z.string().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  sortBy: z.enum(['poNumber', 'orderDate', 'expectedDate', 'total', 'status']).default('orderDate'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ============ Shipment Schemas ============

export const CreateShipmentPackageSchema = z.object({
  trackingNumber: z.string().nullable().optional(),
  weight: z.number().positive().nullable().optional(),
  dimensions: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
});

export const CreateShipmentSchema = z.object({
  workOrderId: z.string().uuid('Work order is required'),
  carrier: z.nativeEnum(Carrier),
  trackingNumber: z.string().nullable().optional(),
  shipDate: z.coerce.date().nullable().optional(),
  estimatedDelivery: z.coerce.date().nullable().optional(),
  weight: z.number().positive().nullable().optional(),
  dimensions: z.string().nullable().optional(),
  shippingCost: z.number().nonnegative().nullable().optional(),
  notes: z.string().nullable().optional(),
  packages: z.array(CreateShipmentPackageSchema).optional(),
});

export const UpdateShipmentSchema = z.object({
  carrier: z.nativeEnum(Carrier).optional(),
  trackingNumber: z.string().nullable().optional(),
  shipDate: z.coerce.date().nullable().optional(),
  estimatedDelivery: z.coerce.date().nullable().optional(),
  actualDelivery: z.coerce.date().nullable().optional(),
  status: z.nativeEnum(ShipmentStatus).optional(),
  weight: z.number().positive().nullable().optional(),
  dimensions: z.string().nullable().optional(),
  shippingCost: z.number().nonnegative().nullable().optional(),
  signedBy: z.string().nullable().optional(),
  proofOfDelivery: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const MarkDeliveredSchema = z.object({
  signedBy: z.string().nullable().optional(),
  proofOfDelivery: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const ShipmentFilterSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
  status: z.nativeEnum(ShipmentStatus).optional(),
  carrier: z.nativeEnum(Carrier).optional(),
  workOrderId: z.string().uuid().optional(),
  search: z.string().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  sortBy: z.enum(['shipDate', 'estimatedDelivery', 'status', 'carrier']).default('shipDate'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ============ Procurement Type Exports ============

export type CreateVendorContact = z.infer<typeof CreateVendorContactSchema>;
export type CreateVendor = z.infer<typeof CreateVendorSchema>;
export type UpdateVendor = z.infer<typeof UpdateVendorSchema>;
export type VendorFilter = z.infer<typeof VendorFilterSchema>;
export type CreatePOLineItem = z.infer<typeof CreatePOLineItemSchema>;
export type CreatePurchaseOrder = z.infer<typeof CreatePurchaseOrderSchema>;
export type UpdatePurchaseOrder = z.infer<typeof UpdatePurchaseOrderSchema>;
export type ReceivePOLineItem = z.infer<typeof ReceivePOLineItemSchema>;
export type ReceivePurchaseOrder = z.infer<typeof ReceivePurchaseOrderSchema>;
export type POFilter = z.infer<typeof POFilterSchema>;
export type CreateShipmentPackage = z.infer<typeof CreateShipmentPackageSchema>;
export type CreateShipment = z.infer<typeof CreateShipmentSchema>;
export type UpdateShipment = z.infer<typeof UpdateShipmentSchema>;
export type MarkDelivered = z.infer<typeof MarkDeliveredSchema>;
export type ShipmentFilter = z.infer<typeof ShipmentFilterSchema>;

// ============ Bill of Materials Schemas ============

export const CreateBOMComponentSchema = z.object({
  componentId: z.string().uuid('Component item is required'),
  quantity: z.number().positive('Quantity must be positive'),
  unit: z.string().min(1).default('EACH'),
  wastePercent: z.number().min(0).max(100).nullable().optional(),
  notes: z.string().nullable().optional(),
  sortOrder: z.number().int().nonnegative().default(0),
});

export const UpdateBOMComponentSchema = CreateBOMComponentSchema.partial();

export const CreateBOMSchema = z.object({
  itemMasterId: z.string().uuid('Item is required'),
  version: z.number().int().positive().default(1),
  isActive: z.boolean().default(true),
  notes: z.string().nullable().optional(),
  components: z.array(CreateBOMComponentSchema).default([]),
});

export const UpdateBOMSchema = z.object({
  version: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().nullable().optional(),
});

export const BOMFilterSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
  search: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
  sortBy: z.enum(['itemMaster', 'version', 'updatedAt']).default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ============ Material Usage Schemas ============

export const CreateMaterialUsageSchema = z.object({
  workOrderId: z.string().uuid('Work order is required'),
  itemMasterId: z.string().uuid('Item is required'),
  quantity: z.number().positive('Quantity must be positive'),
  unit: z.string().min(1).default('EACH'),
  unitCost: z.number().nonnegative('Unit cost cannot be negative'),
  notes: z.string().nullable().optional(),
});

export const UpdateMaterialUsageSchema = z.object({
  quantity: z.number().positive('Quantity must be positive').optional(),
  unit: z.string().min(1).optional(),
  unitCost: z.number().nonnegative('Unit cost cannot be negative').optional(),
  notes: z.string().nullable().optional(),
});

export const MaterialUsageFilterSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
  workOrderId: z.string().uuid().optional(),
  itemMasterId: z.string().uuid().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  sortBy: z.enum(['usedAt', 'quantity', 'totalCost']).default('usedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ============ Job Cost Schemas ============

export const UpdateJobCostSchema = z.object({
  quotedAmount: z.number().nonnegative().optional(),
  invoicedAmount: z.number().nonnegative().nullable().optional(),
  laborRate: z.number().nonnegative().optional(),
  subcontractCost: z.number().nonnegative().nullable().optional(),
  shippingCost: z.number().nonnegative().nullable().optional(),
  otherDirectCost: z.number().nonnegative().nullable().optional(),
  overheadPercent: z.number().min(0).max(100).nullable().optional(),
});

export const JobCostFilterSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  minMargin: z.coerce.number().optional(),
  maxMargin: z.coerce.number().optional(),
  hasLoss: z.coerce.boolean().optional(),
  sortBy: z.enum(['quotedAmount', 'totalCost', 'grossProfit', 'grossMargin', 'calculatedAt']).default('calculatedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ============ Phase 2 Type Exports ============

export type CreateBOMComponent = z.infer<typeof CreateBOMComponentSchema>;
export type UpdateBOMComponent = z.infer<typeof UpdateBOMComponentSchema>;
export type CreateBOM = z.infer<typeof CreateBOMSchema>;
export type UpdateBOM = z.infer<typeof UpdateBOMSchema>;
export type BOMFilter = z.infer<typeof BOMFilterSchema>;

export type CreateMaterialUsage = z.infer<typeof CreateMaterialUsageSchema>;
export type UpdateMaterialUsage = z.infer<typeof UpdateMaterialUsageSchema>;
export type MaterialUsageFilter = z.infer<typeof MaterialUsageFilterSchema>;

export type UpdateJobCost = z.infer<typeof UpdateJobCostSchema>;
export type JobCostFilter = z.infer<typeof JobCostFilterSchema>;

// ============ Quality Control Schemas ============

export const CreateQCChecklistItemSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  sortOrder: z.number().int().nonnegative().default(0),
  isCritical: z.boolean().default(false),
});

export const UpdateQCChecklistItemSchema = CreateQCChecklistItemSchema.partial();

export const CreateQCChecklistSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().nullable().optional(),
  printingMethod: z.nativeEnum(PrintingMethod).nullable().optional(),
  isActive: z.boolean().default(true),
  items: z.array(CreateQCChecklistItemSchema).default([]),
});

export const UpdateQCChecklistSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().nullable().optional(),
  printingMethod: z.nativeEnum(PrintingMethod).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const QCChecklistFilterSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
  search: z.string().optional(),
  printingMethod: z.nativeEnum(PrintingMethod).optional(),
  isActive: z.coerce.boolean().optional(),
  sortBy: z.enum(['name', 'printingMethod', 'createdAt', 'updatedAt']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export const CreateQCInspectionSchema = z.object({
  workOrderId: z.string().uuid('Work order is required'),
  checklistId: z.string().uuid('Checklist is required'),
  station: z.nativeEnum(PrintingMethod).nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const UpdateQCInspectionSchema = z.object({
  station: z.nativeEnum(PrintingMethod).nullable().optional(),
  status: z.nativeEnum(QCStatus).optional(),
  notes: z.string().nullable().optional(),
});

export const QCInspectionResultSchema = z.object({
  checklistItemId: z.string().uuid(),
  passed: z.boolean().nullable(),
  notes: z.string().nullable().optional(),
  photoUrl: z.string().url().nullable().optional(),
});

export const SubmitQCInspectionSchema = z.object({
  results: z.array(QCInspectionResultSchema).min(1, 'At least one result is required'),
  notes: z.string().nullable().optional(),
});

export const QCInspectionFilterSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
  workOrderId: z.string().uuid().optional(),
  checklistId: z.string().uuid().optional(),
  station: z.nativeEnum(PrintingMethod).optional(),
  status: z.nativeEnum(QCStatus).optional(),
  inspectedById: z.string().uuid().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  sortBy: z.enum(['createdAt', 'inspectedAt', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ============ Quality Control Type Exports ============

export type CreateQCChecklistItem = z.infer<typeof CreateQCChecklistItemSchema>;
export type UpdateQCChecklistItem = z.infer<typeof UpdateQCChecklistItemSchema>;
export type CreateQCChecklist = z.infer<typeof CreateQCChecklistSchema>;
export type UpdateQCChecklist = z.infer<typeof UpdateQCChecklistSchema>;
export type QCChecklistFilter = z.infer<typeof QCChecklistFilterSchema>;

export type CreateQCInspection = z.infer<typeof CreateQCInspectionSchema>;
export type UpdateQCInspection = z.infer<typeof UpdateQCInspectionSchema>;
export type QCInspectionResult = z.infer<typeof QCInspectionResultSchema>;
export type SubmitQCInspection = z.infer<typeof SubmitQCInspectionSchema>;
export type QCInspectionFilter = z.infer<typeof QCInspectionFilterSchema>;

// ============ Equipment / Asset Management Schemas ============

import { EquipmentStatus, MaintenanceFrequency, DowntimeReason, ImpactLevel } from './enums.js';

export const CreateEquipmentSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  type: z.string().min(1, 'Type is required').max(50),
  manufacturer: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  serialNumber: z.string().nullable().optional(),
  purchaseDate: z.coerce.date().nullable().optional(),
  purchaseCost: z.number().nonnegative().nullable().optional(),
  warrantyExpires: z.coerce.date().nullable().optional(),
  location: z.string().nullable().optional(),
  station: z.nativeEnum(PrintingMethod).nullable().optional(),
  status: z.nativeEnum(EquipmentStatus).default(EquipmentStatus.OPERATIONAL),
  notes: z.string().nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  ipAddress: z.string().nullable().optional(),
  connectionType: z.string().nullable().optional(),
  snmpCommunity: z.string().nullable().optional(),
});

export const UpdateEquipmentSchema = CreateEquipmentSchema.partial();

export const EquipmentFilterSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
  search: z.string().optional(),
  type: z.string().optional(),
  station: z.nativeEnum(PrintingMethod).optional(),
  status: z.nativeEnum(EquipmentStatus).optional(),
  includeRetired: z.coerce.boolean().default(false),
  sortBy: z.enum(['name', 'type', 'station', 'status', 'purchaseDate', 'createdAt']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export const CreateMaintenanceScheduleSchema = z.object({
  equipmentId: z.string().uuid('Equipment is required'),
  taskName: z.string().min(1, 'Task name is required').max(100),
  description: z.string().nullable().optional(),
  frequency: z.nativeEnum(MaintenanceFrequency),
  intervalDays: z.number().int().positive().nullable().optional(),
  nextDue: z.coerce.date(),
  instructions: z.string().nullable().optional(),
  estimatedTime: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().default(true),
});

export const UpdateMaintenanceScheduleSchema = CreateMaintenanceScheduleSchema.partial().omit({ equipmentId: true });

export const MaintenanceScheduleFilterSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
  equipmentId: z.string().uuid().optional(),
  frequency: z.nativeEnum(MaintenanceFrequency).optional(),
  isActive: z.coerce.boolean().optional(),
  overdue: z.coerce.boolean().optional(),
  dueSoon: z.coerce.boolean().optional(), // Due in next 7 days
  sortBy: z.enum(['taskName', 'frequency', 'nextDue', 'lastCompleted']).default('nextDue'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export const CreateMaintenanceLogSchema = z.object({
  equipmentId: z.string().uuid('Equipment is required'),
  scheduleId: z.string().uuid().nullable().optional(),
  taskName: z.string().min(1, 'Task name is required').max(100),
  description: z.string().nullable().optional(),
  performedAt: z.coerce.date().default(() => new Date()),
  timeSpent: z.number().int().positive().nullable().optional(),
  partsCost: z.number().nonnegative().nullable().optional(),
  laborCost: z.number().nonnegative().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const UpdateMaintenanceLogSchema = CreateMaintenanceLogSchema.partial().omit({ equipmentId: true, scheduleId: true });

export const MaintenanceLogFilterSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
  equipmentId: z.string().uuid().optional(),
  scheduleId: z.string().uuid().optional(),
  performedById: z.string().uuid().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  sortBy: z.enum(['performedAt', 'taskName', 'timeSpent', 'partsCost']).default('performedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const CreateDowntimeEventSchema = z.object({
  equipmentId: z.string().uuid('Equipment is required'),
  reason: z.nativeEnum(DowntimeReason),
  description: z.string().nullable().optional(),
  startedAt: z.coerce.date().default(() => new Date()),
  impactLevel: z.nativeEnum(ImpactLevel).default(ImpactLevel.MEDIUM),
});

export const UpdateDowntimeEventSchema = z.object({
  reason: z.nativeEnum(DowntimeReason).optional(),
  description: z.string().nullable().optional(),
  impactLevel: z.nativeEnum(ImpactLevel).optional(),
});

export const ResolveDowntimeEventSchema = z.object({
  endedAt: z.coerce.date().default(() => new Date()),
  resolution: z.string().min(1, 'Resolution is required'),
});

export const DowntimeEventFilterSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
  equipmentId: z.string().uuid().optional(),
  reason: z.nativeEnum(DowntimeReason).optional(),
  impactLevel: z.nativeEnum(ImpactLevel).optional(),
  isActive: z.coerce.boolean().optional(), // Active = not resolved
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  sortBy: z.enum(['startedAt', 'endedAt', 'reason', 'impactLevel']).default('startedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ============ Equipment Type Exports ============

export type CreateEquipment = z.infer<typeof CreateEquipmentSchema>;
export type UpdateEquipment = z.infer<typeof UpdateEquipmentSchema>;
export type EquipmentFilter = z.infer<typeof EquipmentFilterSchema>;

export type CreateMaintenanceSchedule = z.infer<typeof CreateMaintenanceScheduleSchema>;
export type UpdateMaintenanceSchedule = z.infer<typeof UpdateMaintenanceScheduleSchema>;
export type MaintenanceScheduleFilter = z.infer<typeof MaintenanceScheduleFilterSchema>;

export type CreateMaintenanceLog = z.infer<typeof CreateMaintenanceLogSchema>;
export type UpdateMaintenanceLog = z.infer<typeof UpdateMaintenanceLogSchema>;
export type MaintenanceLogFilter = z.infer<typeof MaintenanceLogFilterSchema>;

export type CreateDowntimeEvent = z.infer<typeof CreateDowntimeEventSchema>;
export type UpdateDowntimeEvent = z.infer<typeof UpdateDowntimeEventSchema>;
export type ResolveDowntimeEvent = z.infer<typeof ResolveDowntimeEventSchema>;
export type DowntimeEventFilter = z.infer<typeof DowntimeEventFilterSchema>;

// ============ Customer Interaction Schemas ============

import { InteractionType } from './enums.js';

export const CreateInteractionSchema = z.object({
  customerId: z.string().uuid('Customer is required'),
  type: z.nativeEnum(InteractionType),
  subject: z.string().max(200).nullable().optional(),
  notes: z.string().min(1, 'Notes are required'),
  outcome: z.string().nullable().optional(),
  followUpDate: z.coerce.date().nullable().optional(),
  contactId: z.string().uuid().nullable().optional(),
});

export const UpdateInteractionSchema = z.object({
  type: z.nativeEnum(InteractionType).optional(),
  subject: z.string().max(200).nullable().optional(),
  notes: z.string().min(1).optional(),
  outcome: z.string().nullable().optional(),
  followUpDate: z.coerce.date().nullable().optional(),
  followUpDone: z.boolean().optional(),
  contactId: z.string().uuid().nullable().optional(),
});

export const InteractionFilterSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
  customerId: z.string().uuid().optional(),
  type: z.nativeEnum(InteractionType).optional(),
  createdById: z.string().uuid().optional(),
  followUpPending: z.coerce.boolean().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export type CreateInteraction = z.infer<typeof CreateInteractionSchema>;
export type UpdateInteraction = z.infer<typeof UpdateInteractionSchema>;
export type InteractionFilter = z.infer<typeof InteractionFilterSchema>;

// ============ Customer Portal Schemas ============

import { ProofStatus } from './enums.js';

// Portal Authentication
const portalPasswordSchema = z.string()
  .min(10, 'Password must be at least 10 characters')
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,
    'Password must contain at least one uppercase letter, one lowercase letter, and one number'
  );

export const PortalRegisterSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: portalPasswordSchema,
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().nullable().optional(),
  customerId: z.string().uuid('Invalid customer ID').optional(), // now optional, invite determines customer
  inviteToken: z.string().min(1, 'Invitation token is required'),
});

export const PortalLoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const PortalForgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const PortalResetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: portalPasswordSchema,
});

export const PortalUpdateProfileSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().nullable().optional(),
});

export const PortalChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: portalPasswordSchema,
});

// Proof Approval
export const ProofResponseSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED', 'CHANGES_REQUESTED']),
  comments: z.string().max(2000).nullable().optional(),
});

// Portal Messages
export const CreatePortalMessageSchema = z.object({
  threadId: z.string().optional(), // Auto-generated if new conversation
  orderId: z.string().uuid().optional(),
  subject: z.string().max(200).optional(),
  content: z.string().min(1, 'Message content is required').max(5000),
  attachments: z.array(z.object({
    fileName: z.string(),
    fileUrl: z.string(),
  })).optional(),
});

export const PortalMessageFilterSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(20),
  orderId: z.string().uuid().optional(),
  unreadOnly: z.coerce.boolean().optional(),
});

// Type exports
export type PortalRegister = z.infer<typeof PortalRegisterSchema>;
export type PortalLogin = z.infer<typeof PortalLoginSchema>;
export type PortalForgotPassword = z.infer<typeof PortalForgotPasswordSchema>;
export type PortalResetPassword = z.infer<typeof PortalResetPasswordSchema>;
export type PortalUpdateProfile = z.infer<typeof PortalUpdateProfileSchema>;
export type PortalChangePassword = z.infer<typeof PortalChangePasswordSchema>;
export type ProofResponse = z.infer<typeof ProofResponseSchema>;
export type CreatePortalMessage = z.infer<typeof CreatePortalMessageSchema>;
export type PortalMessageFilter = z.infer<typeof PortalMessageFilterSchema>;

// ============ Email Automation Schemas ============

export const CreateEmailTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required').max(100),
  trigger: z.nativeEnum(EmailTrigger),
  subject: z.string().min(1, 'Subject is required').max(500),
  htmlBody: z.string().min(1, 'HTML body is required'),
  textBody: z.string().nullable().optional(),
  delayMinutes: z.number().int().min(0).default(0),
  conditions: z.record(z.any()).nullable().optional(), // JSON conditions for when to send
  isActive: z.boolean().default(true),
});

export const UpdateEmailTemplateSchema = CreateEmailTemplateSchema.partial();

export const QueueEmailSchema = z.object({
  templateId: z.string().uuid().nullable().optional(),
  recipientEmail: z.string().email(),
  recipientName: z.string().nullable().optional(),
  subject: z.string().min(1).max(500),
  htmlBody: z.string().min(1),
  textBody: z.string().nullable().optional(),
  scheduledAt: z.coerce.date().nullable().optional(),
  orderId: z.string().uuid().nullable().optional(),
  customerId: z.string().uuid().nullable().optional(),
  quoteId: z.string().uuid().nullable().optional(),
});

export const EmailFilterSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
  status: z.nativeEnum(EmailStatus).optional(),
  trigger: z.nativeEnum(EmailTrigger).optional(),
  search: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export const SendTestEmailSchema = z.object({
  templateId: z.string().uuid(),
  recipientEmail: z.string().email(),
  testData: z.record(z.any()).optional(), // Test variables to substitute
});

// Type exports for email
export type CreateEmailTemplate = z.infer<typeof CreateEmailTemplateSchema>;
export type UpdateEmailTemplate = z.infer<typeof UpdateEmailTemplateSchema>;
export type QueueEmail = z.infer<typeof QueueEmailSchema>;
export type EmailFilter = z.infer<typeof EmailFilterSchema>;
export type SendTestEmail = z.infer<typeof SendTestEmailSchema>;

// ============ Production Scheduling Schemas ============

export const CreateProductionSlotSchema = z.object({
  workOrderId: z.string().uuid(),
  station: z.nativeEnum(PrintingMethod),
  scheduledDate: z.coerce.date(),
  scheduledStart: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(), // HH:mm format
  scheduledEnd: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  estimatedHours: z.number().positive().max(24),
  assignedToId: z.string().uuid().nullable().optional(),
  priority: z.number().int().min(1).max(5).default(1),
  notes: z.string().max(1000).nullable().optional(),
});

export const UpdateProductionSlotSchema = z.object({
  scheduledDate: z.coerce.date().optional(),
  scheduledStart: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  scheduledEnd: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  estimatedHours: z.number().positive().max(24).optional(),
  actualHours: z.number().positive().max(24).nullable().optional(),
  assignedToId: z.string().uuid().nullable().optional(),
  priority: z.number().int().min(1).max(5).optional(),
  status: z.nativeEnum(SlotStatus).optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export const RescheduleSlotSchema = z.object({
  newDate: z.coerce.date(),
  newStart: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  newEnd: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  reason: z.string().max(500).optional(),
});

export const BulkScheduleSchema = z.object({
  workOrderIds: z.array(z.string().uuid()).min(1),
  station: z.nativeEnum(PrintingMethod),
  scheduledDate: z.coerce.date(),
  estimatedHours: z.number().positive().max(24),
  assignedToId: z.string().uuid().nullable().optional(),
});

export const ScheduleFilterSchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  station: z.nativeEnum(PrintingMethod).optional(),
  assignedToId: z.string().uuid().optional(),
  status: z.nativeEnum(SlotStatus).optional(),
  workOrderId: z.string().uuid().optional(),
});

// Type exports for scheduling
export type CreateProductionSlot = z.infer<typeof CreateProductionSlotSchema>;
export type UpdateProductionSlot = z.infer<typeof UpdateProductionSlotSchema>;
export type RescheduleSlot = z.infer<typeof RescheduleSlotSchema>;
export type BulkSchedule = z.infer<typeof BulkScheduleSchema>;
export type ScheduleFilter = z.infer<typeof ScheduleFilterSchema>;
// ============ Credit & Payment Terms Schemas ============

import { CreditApprovalStatus } from './enums.js';

export const UpdateCustomerCreditSchema = z.object({
  creditLimit: z.number().min(0).nullable().optional(),
  paymentTerms: z.string().max(50).nullable().optional(),
  isOnCreditHold: z.boolean().optional(),
  creditHoldReason: z.string().max(500).nullable().optional(),
});

export const CreateCreditApprovalSchema = z.object({
  customerId: z.string().uuid(),
  workOrderId: z.string().uuid().nullable().optional(),
  requestedAmount: z.number().positive(),
  notes: z.string().max(1000).nullable().optional(),
});

export const ProcessCreditApprovalSchema = z.object({
  status: z.enum(['APPROVED', 'DENIED']),
  notes: z.string().max(1000).nullable().optional(),
});

export const CreditApprovalFilterSchema = z.object({
  customerId: z.string().uuid().optional(),
  status: z.nativeEnum(CreditApprovalStatus).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
}).partial();

// Payment terms options
export const PAYMENT_TERMS_OPTIONS = [
  'COD',
  'Net 7',
  'Net 15',
  'Net 30',
  'Net 45',
  'Net 60',
  'Net 90',
  'Due on Receipt',
  '50% Deposit',
  'Prepaid',
] as const;

// Type exports for credit
export type UpdateCustomerCredit = z.infer<typeof UpdateCustomerCreditSchema>;
export type CreateCreditApproval = z.infer<typeof CreateCreditApprovalSchema>;
export type ProcessCreditApproval = z.infer<typeof ProcessCreditApprovalSchema>;
export type CreditApprovalFilter = z.infer<typeof CreditApprovalFilterSchema>;

// ============ Subcontractor Schemas ============

import { SubcontractorService, RateType, SubcontractStatus } from './enums.js';

export const CreateSubcontractorSchema = z.object({
  name: z.string().min(1).max(200),
  company: z.string().max(200).nullable().optional(),
  contactName: z.string().min(1).max(100),
  email: z.string().email().nullable().optional(),
  phone: z.string().min(1).max(30),
  address: z.string().max(500).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  state: z.string().max(50).nullable().optional(),
  zip: z.string().max(20).nullable().optional(),
  services: z.array(z.nativeEnum(SubcontractorService)).min(1),
  rate: z.number().positive().nullable().optional(),
  rateType: z.nativeEnum(RateType).default(RateType.FIXED),
  insuranceExpiry: z.coerce.date().nullable().optional(),
  licenseNumber: z.string().max(100).nullable().optional(),
  licenseExpiry: z.coerce.date().nullable().optional(),
  w9OnFile: z.boolean().default(false),
  notes: z.string().max(2000).nullable().optional(),
});

export const UpdateSubcontractorSchema = CreateSubcontractorSchema.partial().extend({
  isActive: z.boolean().optional(),
  rating: z.number().min(0).max(5).nullable().optional(),
});

export const CreateSubcontractJobSchema = z.object({
  subcontractorId: z.string().uuid(),
  workOrderId: z.string().uuid(),
  service: z.nativeEnum(SubcontractorService),
  description: z.string().min(1).max(1000),
  scheduledDate: z.coerce.date().nullable().optional(),
  quotedAmount: z.number().min(0),
  poNumber: z.string().max(50).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const UpdateSubcontractJobSchema = z.object({
  description: z.string().min(1).max(1000).optional(),
  scheduledDate: z.coerce.date().nullable().optional(),
  completedDate: z.coerce.date().nullable().optional(),
  quotedAmount: z.number().min(0).optional(),
  actualAmount: z.number().min(0).nullable().optional(),
  status: z.nativeEnum(SubcontractStatus).optional(),
  poNumber: z.string().max(50).nullable().optional(),
  invoiceNumber: z.string().max(50).nullable().optional(),
  invoiceDate: z.coerce.date().nullable().optional(),
  paidDate: z.coerce.date().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

// Helper to coerce string 'true'/'false' to boolean
const booleanStringSchema = z.preprocess(
  (val) => val === 'true' ? true : val === 'false' ? false : val,
  z.boolean().optional()
);

export const SubcontractorFilterSchema = z.object({
  service: z.nativeEnum(SubcontractorService).optional(),
  isActive: booleanStringSchema,
  hasExpiredInsurance: booleanStringSchema,
  hasExpiredLicense: booleanStringSchema,
}).partial();

export const SubcontractJobFilterSchema = z.object({
  subcontractorId: z.string().uuid().optional(),
  workOrderId: z.string().uuid().optional(),
  status: z.nativeEnum(SubcontractStatus).optional(),
  service: z.nativeEnum(SubcontractorService).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
}).partial();

// Type exports for subcontractors
export type CreateSubcontractor = z.infer<typeof CreateSubcontractorSchema>;
export type UpdateSubcontractor = z.infer<typeof UpdateSubcontractorSchema>;
export type CreateSubcontractJob = z.infer<typeof CreateSubcontractJobSchema>;
export type UpdateSubcontractJob = z.infer<typeof UpdateSubcontractJobSchema>;
export type SubcontractorFilter = z.infer<typeof SubcontractorFilterSchema>;
export type SubcontractJobFilter = z.infer<typeof SubcontractJobFilterSchema>;

// ============ Document Management Schemas ============

export const UploadDocumentSchema = z.object({
  name: z.string().min(1).max(255),
  category: z.nativeEnum(DocumentCategory),
  tags: z.array(z.string().max(50)).default([]),
  description: z.string().max(1000).nullable().optional(),
  // Entity associations - at least one should be provided for context
  customerId: z.string().uuid().nullable().optional(),
  orderId: z.string().uuid().nullable().optional(),
  quoteId: z.string().uuid().nullable().optional(),
  vendorId: z.string().uuid().nullable().optional(),
  subcontractorId: z.string().uuid().nullable().optional(),
});

export const UpdateDocumentSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  category: z.nativeEnum(DocumentCategory).optional(),
  tags: z.array(z.string().max(50)).optional(),
  description: z.string().max(1000).nullable().optional(),
});

export const DocumentFilterSchema = z.object({
  category: z.nativeEnum(DocumentCategory).optional(),
  customerId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  quoteId: z.string().uuid().optional(),
  vendorId: z.string().uuid().optional(),
  subcontractorId: z.string().uuid().optional(),
  tags: z.array(z.string()).optional(),
  search: z.string().optional(),
  isLatest: z.boolean().optional(),
}).partial();

// Type exports for documents
export type UploadDocument = z.infer<typeof UploadDocumentSchema>;
export type UpdateDocument = z.infer<typeof UpdateDocumentSchema>;

// ============ Recurring Orders Schemas ============

export const RecurringLineItemSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().int().positive().default(1),
  unitPrice: z.number().nonnegative(),
  notes: z.string().max(500).nullable().optional(),
  itemMasterId: z.string().uuid().nullable().optional(),
});

export const CreateRecurringOrderSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).nullable().optional(),
  customerId: z.string().uuid(),
  templateId: z.string().uuid().nullable().optional(),
  frequency: z.nativeEnum(RecurringFrequency),
  customDays: z.number().int().positive().nullable().optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().nullable().optional(),
  notifyDaysBefore: z.number().int().min(0).max(30).default(3),
  discountPercent: z.number().min(0).max(100).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  lineItems: z.array(RecurringLineItemSchema).default([]),
});

export const UpdateRecurringOrderSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  frequency: z.nativeEnum(RecurringFrequency).optional(),
  customDays: z.number().int().positive().nullable().optional(),
  endDate: z.coerce.date().nullable().optional(),
  notifyDaysBefore: z.number().int().min(0).max(30).optional(),
  discountPercent: z.number().min(0).max(100).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  isActive: z.boolean().optional(),
  isPaused: z.boolean().optional(),
  pausedReason: z.string().max(500).nullable().optional(),
});

export const RecurringOrderFilterSchema = z.object({
  customerId: z.string().uuid().optional(),
  frequency: z.nativeEnum(RecurringFrequency).optional(),
  isActive: z.boolean().optional(),
  isPaused: z.boolean().optional(),
  search: z.string().optional(),
  dueBefore: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

// Type exports for recurring orders
export type RecurringLineItem = z.infer<typeof RecurringLineItemSchema>;
export type CreateRecurringOrder = z.infer<typeof CreateRecurringOrderSchema>;
export type UpdateRecurringOrder = z.infer<typeof UpdateRecurringOrderSchema>;
export type RecurringOrderFilter = z.infer<typeof RecurringOrderFilterSchema>;
export type DocumentFilter = z.infer<typeof DocumentFilterSchema>;

// ============ Analytics Schemas ============

/** Analytics period options */
export const AnalyticsPeriodSchema = z.enum(['today', 'week', 'month', 'quarter', 'year', 'custom']);

/** Analytics date range filter schema */
export const AnalyticsFilterSchema = z.object({
  period: AnalyticsPeriodSchema.default('month'),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
});

/** Extended analytics filter with limit */
export const AnalyticsFilterWithLimitSchema = AnalyticsFilterSchema.extend({
  limit: z.coerce.number().int().positive().max(100).default(10),
});

/** Chart type options */
export const ChartTypeSchema = z.enum(['line', 'bar', 'pie', 'area', 'gauge']);

/** Report export format options */
export const ReportExportFormatSchema = z.enum(['json', 'csv', 'pdf']);

/** Trend grouping options */
export const TrendGroupingSchema = z.enum(['hour', 'day', 'week', 'month']);

/** Trend filter schema */
export const TrendFilterSchema = AnalyticsFilterSchema.extend({
  groupBy: TrendGroupingSchema.default('day'),
});

/** User productivity filter */
export const UserProductivityFilterSchema = AnalyticsFilterSchema.extend({
  userId: z.string().uuid().optional(),
  station: z.nativeEnum(PrintingMethod).optional(),
});

/** Station performance filter */
export const StationPerformanceFilterSchema = AnalyticsFilterSchema.extend({
  station: z.nativeEnum(PrintingMethod).optional(),
});

/** Revenue filter */
export const RevenueFilterSchema = AnalyticsFilterWithLimitSchema.extend({
  customerId: z.string().uuid().optional(),
  station: z.nativeEnum(PrintingMethod).optional(),
});

/** Profitability filter */
export const ProfitabilityFilterSchema = AnalyticsFilterSchema.extend({
  minMargin: z.number().optional(),
  maxMargin: z.number().optional(),
  customerId: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(50).default(10),
});

/** Equipment utilization filter */
export const EquipmentUtilizationFilterSchema = AnalyticsFilterSchema.extend({
  equipmentId: z.string().uuid().optional(),
  station: z.nativeEnum(PrintingMethod).optional(),
});

/** Production capacity filter */
export const ProductionCapacityFilterSchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  station: z.nativeEnum(PrintingMethod).optional(),
});

// Type exports for analytics
export type AnalyticsPeriod = z.infer<typeof AnalyticsPeriodSchema>;
export type AnalyticsFilter = z.infer<typeof AnalyticsFilterSchema>;
export type AnalyticsFilterWithLimit = z.infer<typeof AnalyticsFilterWithLimitSchema>;
export type ChartType = z.infer<typeof ChartTypeSchema>;
export type ReportExportFormat = z.infer<typeof ReportExportFormatSchema>;
export type TrendGrouping = z.infer<typeof TrendGroupingSchema>;
export type TrendFilter = z.infer<typeof TrendFilterSchema>;
export type UserProductivityFilter = z.infer<typeof UserProductivityFilterSchema>;
export type StationPerformanceFilter = z.infer<typeof StationPerformanceFilterSchema>;
export type RevenueFilter = z.infer<typeof RevenueFilterSchema>;
export type ProfitabilityFilter = z.infer<typeof ProfitabilityFilterSchema>;
export type EquipmentUtilizationFilter = z.infer<typeof EquipmentUtilizationFilterSchema>;
export type ProductionCapacityFilter = z.infer<typeof ProductionCapacityFilterSchema>;

// ============ Installation / Field Service Schemas ============

import {
  InstallStatus,
  InstallPriority,
  InstallType,
  InstallPhotoType,
  InstallEventType,
} from './enums.js';

/** Create installation job schema */
export const CreateInstallationJobSchema = z.object({
  workOrderId: z.string().uuid(),
  customerId: z.string().uuid().optional(),
  type: z.nativeEnum(InstallType).default(InstallType.NEW_INSTALL),
  priority: z.nativeEnum(InstallPriority).default(InstallPriority.NORMAL),
  description: z.string().optional(),
  
  // Location
  siteAddress: z.string().min(1, 'Site address is required'),
  siteCity: z.string().optional(),
  siteState: z.string().optional(),
  siteZip: z.string().optional(),
  siteContact: z.string().optional(),
  sitePhone: z.string().optional(),
  
  // Scheduling (optional at creation)
  scheduledDate: z.coerce.date().optional(),
  scheduledTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:mm)').optional(),
  estimatedHours: z.coerce.number().positive().max(24).optional(),
  
  // Notes
  internalNotes: z.string().optional(),
  customerNotes: z.string().optional(),
  
  // Cost estimate
  estimatedCost: z.coerce.number().nonnegative().optional(),
  
  // Initial installers
  installerIds: z.array(z.string().uuid()).optional(),
});

/** Update installation job schema */
export const UpdateInstallationJobSchema = z.object({
  type: z.nativeEnum(InstallType).optional(),
  status: z.nativeEnum(InstallStatus).optional(),
  priority: z.nativeEnum(InstallPriority).optional(),
  description: z.string().nullable().optional(),
  
  // Location
  siteAddress: z.string().min(1).optional(),
  siteCity: z.string().nullable().optional(),
  siteState: z.string().nullable().optional(),
  siteZip: z.string().nullable().optional(),
  siteContact: z.string().nullable().optional(),
  sitePhone: z.string().nullable().optional(),
  
  // Scheduling
  scheduledDate: z.coerce.date().nullable().optional(),
  scheduledTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).nullable().optional(),
  estimatedHours: z.coerce.number().positive().max(24).nullable().optional(),
  actualStartTime: z.coerce.date().nullable().optional(),
  actualEndTime: z.coerce.date().nullable().optional(),
  
  // Notes
  internalNotes: z.string().nullable().optional(),
  customerNotes: z.string().nullable().optional(),
  completionNotes: z.string().nullable().optional(),
  
  // Cost tracking
  estimatedCost: z.coerce.number().nonnegative().nullable().optional(),
  actualCost: z.coerce.number().nonnegative().nullable().optional(),
  mileage: z.coerce.number().nonnegative().nullable().optional(),
});

/** Assign installers to job schema */
export const AssignInstallersSchema = z.object({
  installerIds: z.array(z.string().uuid()).min(1, 'At least one installer required'),
  leadInstallerId: z.string().uuid().optional(),
});

/** Update installer assignment schema */
export const UpdateInstallerAssignmentSchema = z.object({
  isLead: z.boolean().optional(),
  hoursWorked: z.coerce.number().nonnegative().nullable().optional(),
  notes: z.string().nullable().optional(),
});

/** Update installer schedule schema */
export const UpdateInstallerScheduleSchema = z.object({
  date: z.coerce.date(),
  isAvailable: z.boolean(),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  notes: z.string().optional(),
});

/** Bulk update installer schedule schema */
export const BulkUpdateInstallerScheduleSchema = z.object({
  userId: z.string().uuid(),
  dates: z.array(z.coerce.date()).min(1),
  isAvailable: z.boolean(),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  notes: z.string().optional(),
});

/** Installation job list filter schema */
export const InstallationJobFilterSchema = z.object({
  status: z.union([z.nativeEnum(InstallStatus), z.array(z.nativeEnum(InstallStatus))]).optional(),
  type: z.union([z.nativeEnum(InstallType), z.array(z.nativeEnum(InstallType))]).optional(),
  priority: z.union([z.nativeEnum(InstallPriority), z.array(z.nativeEnum(InstallPriority))]).optional(),
  customerId: z.string().uuid().optional(),
  workOrderId: z.string().uuid().optional(),
  installerId: z.string().uuid().optional(),
  scheduledDateFrom: z.coerce.date().optional(),
  scheduledDateTo: z.coerce.date().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

/** Installation calendar query schema */
export const InstallationCalendarQuerySchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  installerId: z.string().uuid().optional(),
});

/** Add installation photo schema */
export const AddInstallPhotoSchema = z.object({
  installationJobId: z.string().uuid(),
  photoType: z.nativeEnum(InstallPhotoType).default(InstallPhotoType.PROGRESS),
  caption: z.string().optional(),
});

/** Log installation event schema */
export const LogInstallEventSchema = z.object({
  installationJobId: z.string().uuid(),
  eventType: z.nativeEnum(InstallEventType),
  description: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

/** Complete installation job schema */
export const CompleteInstallationJobSchema = z.object({
  completionNotes: z.string().optional(),
  actualCost: z.coerce.number().nonnegative().optional(),
  mileage: z.coerce.number().nonnegative().optional(),
  hoursWorked: z.record(z.string().uuid(), z.coerce.number().nonnegative()).optional(), // userId -> hours
});

// Type exports for installation
export type CreateInstallationJob = z.infer<typeof CreateInstallationJobSchema>;
export type UpdateInstallationJob = z.infer<typeof UpdateInstallationJobSchema>;
export type AssignInstallers = z.infer<typeof AssignInstallersSchema>;
export type UpdateInstallerAssignment = z.infer<typeof UpdateInstallerAssignmentSchema>;
export type UpdateInstallerSchedule = z.infer<typeof UpdateInstallerScheduleSchema>;
export type BulkUpdateInstallerSchedule = z.infer<typeof BulkUpdateInstallerScheduleSchema>;
export type InstallationJobFilter = z.infer<typeof InstallationJobFilterSchema>;
export type InstallationCalendarQuery = z.infer<typeof InstallationCalendarQuerySchema>;
export type AddInstallPhoto = z.infer<typeof AddInstallPhotoSchema>;
export type LogInstallEvent = z.infer<typeof LogInstallEventSchema>;
export type CompleteInstallationJob = z.infer<typeof CompleteInstallationJobSchema>;

// ============ Webhook Schemas ============

import {
  WebhookEventType,
  WebhookDeliveryStatus,
} from './enums.js';

/** Create webhook schema */
export const CreateWebhookSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  url: z.string().url('Invalid webhook URL'),
  secret: z.string().min(16, 'Secret must be at least 16 characters').max(256).optional(),
  events: z.array(z.nativeEnum(WebhookEventType)).min(1, 'At least one event is required'),
  filterCustomerId: z.string().uuid().optional(),
  filterStation: z.nativeEnum(PrintingMethod).optional(),
  maxRetries: z.coerce.number().int().min(0).max(10).default(3),
  retryDelayMs: z.coerce.number().int().min(100).max(60000).default(1000),
  timeoutMs: z.coerce.number().int().min(1000).max(60000).default(10000),
  headers: z.record(z.string()).optional(),
});

/** Update webhook schema */
export const UpdateWebhookSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  url: z.string().url().optional(),
  secret: z.string().min(16).max(256).nullable().optional(),
  isActive: z.boolean().optional(),
  events: z.array(z.nativeEnum(WebhookEventType)).min(1).optional(),
  filterCustomerId: z.string().uuid().nullable().optional(),
  filterStation: z.nativeEnum(PrintingMethod).nullable().optional(),
  maxRetries: z.coerce.number().int().min(0).max(10).optional(),
  retryDelayMs: z.coerce.number().int().min(100).max(60000).optional(),
  timeoutMs: z.coerce.number().int().min(1000).max(60000).optional(),
  headers: z.record(z.string()).nullable().optional(),
});

/** Webhook filter schema */
export const WebhookFilterSchema = z.object({
  isActive: z.coerce.boolean().optional(),
  eventType: z.nativeEnum(WebhookEventType).optional(),
  search: z.string().optional(),
});

/** Webhook delivery filter schema */
export const WebhookDeliveryFilterSchema = z.object({
  webhookId: z.string().uuid().optional(),
  status: z.union([
    z.nativeEnum(WebhookDeliveryStatus),
    z.array(z.nativeEnum(WebhookDeliveryStatus)),
  ]).optional(),
  eventType: z.nativeEnum(WebhookEventType).optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

/** Test webhook schema */
export const TestWebhookSchema = z.object({
  webhookId: z.string().uuid(),
  samplePayload: z.record(z.unknown()).optional(),
});

/** Retry webhook delivery schema */
export const RetryWebhookDeliverySchema = z.object({
  deliveryId: z.string().uuid(),
});

/** Webhook event trigger schema (for manually triggering) */
export const TriggerWebhookEventSchema = z.object({
  eventType: z.nativeEnum(WebhookEventType),
  eventId: z.string().optional(),
  payload: z.record(z.unknown()),
});

// Type exports for webhooks
export type CreateWebhook = z.infer<typeof CreateWebhookSchema>;
export type UpdateWebhook = z.infer<typeof UpdateWebhookSchema>;
export type WebhookFilter = z.infer<typeof WebhookFilterSchema>;
export type WebhookDeliveryFilter = z.infer<typeof WebhookDeliveryFilterSchema>;
export type TestWebhook = z.infer<typeof TestWebhookSchema>;
export type RetryWebhookDelivery = z.infer<typeof RetryWebhookDeliverySchema>;
export type TriggerWebhookEvent = z.infer<typeof TriggerWebhookEventSchema>;

// ============ System Alert Schemas ============

/** Create alert schema */
export const CreateAlertSchema = z.object({
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(2000),
  type: z.nativeEnum(AlertType).default(AlertType.INFO),
  severity: z.nativeEnum(AlertSeverity).default(AlertSeverity.LOW),
  isGlobal: z.boolean().default(true),
  targetRoles: z.array(z.nativeEnum(UserRole)).default([]),
  isDismissible: z.boolean().default(true),
  showOnPages: z.array(z.string()).default([]),
  startsAt: z.coerce.date().default(() => new Date()),
  expiresAt: z.coerce.date().nullable().optional(),
});

/** Update alert schema */
export const UpdateAlertSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  message: z.string().min(1).max(2000).optional(),
  type: z.nativeEnum(AlertType).optional(),
  severity: z.nativeEnum(AlertSeverity).optional(),
  isGlobal: z.boolean().optional(),
  targetRoles: z.array(z.nativeEnum(UserRole)).optional(),
  isDismissible: z.boolean().optional(),
  showOnPages: z.array(z.string()).optional(),
  startsAt: z.coerce.date().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  isActive: z.boolean().optional(),
});

/** Create alert rule schema */
export const CreateAlertRuleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  triggerType: z.nativeEnum(AlertTriggerType),
  triggerConfig: z.record(z.unknown()).default({}),
  alertType: z.nativeEnum(AlertType).default(AlertType.WARNING),
  alertSeverity: z.nativeEnum(AlertSeverity).default(AlertSeverity.MEDIUM),
  titleTemplate: z.string().min(1).max(200),
  messageTemplate: z.string().min(1).max(2000),
  cooldownMinutes: z.number().int().min(0).default(60),
});

/** Update alert rule schema */
export const UpdateAlertRuleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  triggerType: z.nativeEnum(AlertTriggerType).optional(),
  triggerConfig: z.record(z.unknown()).optional(),
  alertType: z.nativeEnum(AlertType).optional(),
  alertSeverity: z.nativeEnum(AlertSeverity).optional(),
  titleTemplate: z.string().min(1).max(200).optional(),
  messageTemplate: z.string().min(1).max(2000).optional(),
  cooldownMinutes: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

/** Alert filter schema */
export const AlertFilterSchema = z.object({
  type: z.union([
    z.nativeEnum(AlertType),
    z.array(z.nativeEnum(AlertType)),
  ]).optional(),
  severity: z.union([
    z.nativeEnum(AlertSeverity),
    z.array(z.nativeEnum(AlertSeverity)),
  ]).optional(),
  isActive: z.coerce.boolean().optional(),
  isGlobal: z.coerce.boolean().optional(),
  search: z.string().optional(),
});

/** Alert history filter schema */
export const AlertHistoryFilterSchema = z.object({
  alertId: z.string().uuid().optional(),
  alertRuleId: z.string().uuid().optional(),
  type: z.union([
    z.nativeEnum(AlertType),
    z.array(z.nativeEnum(AlertType)),
  ]).optional(),
  severity: z.union([
    z.nativeEnum(AlertSeverity),
    z.array(z.nativeEnum(AlertSeverity)),
  ]).optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  resolved: z.coerce.boolean().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

/** Dismiss alert schema */
export const DismissAlertSchema = z.object({
  alertId: z.string().uuid(),
});

/** Resolve alert history schema */
export const ResolveAlertHistorySchema = z.object({
  historyId: z.string().uuid(),
});

// Type exports for alerts
export type CreateAlert = z.infer<typeof CreateAlertSchema>;
export type UpdateAlert = z.infer<typeof UpdateAlertSchema>;
export type CreateAlertRule = z.infer<typeof CreateAlertRuleSchema>;
export type UpdateAlertRule = z.infer<typeof UpdateAlertRuleSchema>;
export type AlertFilter = z.infer<typeof AlertFilterSchema>;
export type AlertHistoryFilter = z.infer<typeof AlertHistoryFilterSchema>;
export type DismissAlert = z.infer<typeof DismissAlertSchema>;
export type ResolveAlertHistory = z.infer<typeof ResolveAlertHistorySchema>;

// ============ Third Party Integration Schemas ============

/** Create integration schema */
export const CreateIntegrationSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.nativeEnum(IntegrationType),
  provider: z.string().min(1).max(50),
  description: z.string().max(500).optional(),
  baseUrl: z.string().url().optional(),
  config: z.record(z.unknown()).default({}),
  syncInterval: z.number().int().min(1).max(1440).optional(), // 1 min to 24 hours
  autoSync: z.boolean().default(false),
});

/** Update integration schema */
export const UpdateIntegrationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  baseUrl: z.string().url().nullable().optional(),
  config: z.record(z.unknown()).optional(),
  syncInterval: z.number().int().min(1).max(1440).nullable().optional(),
  autoSync: z.boolean().optional(),
  isEnabled: z.boolean().optional(),
});

/** Add integration credential schema */
export const AddIntegrationCredentialSchema = z.object({
  integrationId: z.string().uuid(),
  credentialType: z.nativeEnum(CredentialType).default(CredentialType.API_KEY),
  key: z.string().min(1).max(50),
  value: z.string().min(1), // Will be encrypted server-side
  expiresAt: z.coerce.date().nullable().optional(),
  refreshToken: z.string().optional(),
  scope: z.string().max(500).optional(),
  tokenType: z.string().max(50).optional(),
});

/** Update integration credential schema */
export const UpdateIntegrationCredentialSchema = z.object({
  value: z.string().min(1).optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  refreshToken: z.string().nullable().optional(),
  scope: z.string().max(500).nullable().optional(),
  tokenType: z.string().max(50).nullable().optional(),
});

/** Integration filter schema */
export const IntegrationFilterSchema = z.object({
  type: z.union([
    z.nativeEnum(IntegrationType),
    z.array(z.nativeEnum(IntegrationType)),
  ]).optional(),
  status: z.union([
    z.nativeEnum(IntegrationStatus),
    z.array(z.nativeEnum(IntegrationStatus)),
  ]).optional(),
  provider: z.string().optional(),
  isEnabled: z.coerce.boolean().optional(),
  search: z.string().optional(),
});

/** Sync log filter schema */
export const SyncLogFilterSchema = z.object({
  integrationId: z.string().uuid().optional(),
  syncType: z.union([
    z.nativeEnum(SyncType),
    z.array(z.nativeEnum(SyncType)),
  ]).optional(),
  status: z.union([
    z.nativeEnum(SyncStatus),
    z.array(z.nativeEnum(SyncStatus)),
  ]).optional(),
  direction: z.nativeEnum(SyncDirection).optional(),
  entityType: z.string().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

/** Trigger sync schema */
export const TriggerSyncSchema = z.object({
  integrationId: z.string().uuid(),
  entityType: z.string().optional(),
  direction: z.nativeEnum(SyncDirection).default(SyncDirection.PULL),
  fullSync: z.boolean().default(false),
});

/** Test integration connection schema */
export const TestIntegrationSchema = z.object({
  integrationId: z.string().uuid(),
});

/** OAuth callback schema */
export const OAuthCallbackSchema = z.object({
  code: z.string(),
  state: z.string(),
  integrationId: z.string().uuid().optional(),
});

// Type exports for integrations
export type CreateIntegration = z.infer<typeof CreateIntegrationSchema>;
export type UpdateIntegration = z.infer<typeof UpdateIntegrationSchema>;
export type AddIntegrationCredential = z.infer<typeof AddIntegrationCredentialSchema>;
export type UpdateIntegrationCredential = z.infer<typeof UpdateIntegrationCredentialSchema>;
export type IntegrationFilter = z.infer<typeof IntegrationFilterSchema>;
export type SyncLogFilter = z.infer<typeof SyncLogFilterSchema>;
export type TriggerSync = z.infer<typeof TriggerSyncSchema>;
export type TestIntegration = z.infer<typeof TestIntegrationSchema>;
export type OAuthCallback = z.infer<typeof OAuthCallbackSchema>;

// ============ Saved Filter Schemas ============

/** Create saved filter schema */
export const CreateSavedFilterSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(255).optional(),
  entityType: z.nativeEnum(FilterEntityType),
  pageKey: z.string().min(1).max(50),
  filterConfig: z.record(z.unknown()),
  sortConfig: z.record(z.unknown()).optional(),
  columnConfig: z.record(z.unknown()).optional(),
  isDefault: z.boolean().default(false),
  isShared: z.boolean().default(false),
  sharedWithRoles: z.array(z.nativeEnum(UserRole)).default([]),
});

/** Update saved filter schema */
export const UpdateSavedFilterSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(255).nullable().optional(),
  filterConfig: z.record(z.unknown()).optional(),
  sortConfig: z.record(z.unknown()).nullable().optional(),
  columnConfig: z.record(z.unknown()).nullable().optional(),
  isDefault: z.boolean().optional(),
  isShared: z.boolean().optional(),
  sharedWithRoles: z.array(z.nativeEnum(UserRole)).optional(),
});

/** Saved filter filter schema */
export const SavedFilterFilterSchema = z.object({
  entityType: z.nativeEnum(FilterEntityType).optional(),
  pageKey: z.string().optional(),
  isShared: z.coerce.boolean().optional(),
  includeShared: z.coerce.boolean().default(true),
  search: z.string().optional(),
});

/** Apply saved filter schema */
export const ApplySavedFilterSchema = z.object({
  filterId: z.string().uuid(),
});

/** Set default filter schema */
export const SetDefaultFilterSchema = z.object({
  filterId: z.string().uuid(),
  entityType: z.nativeEnum(FilterEntityType),
});

// Type exports for saved filters
export type CreateSavedFilter = z.infer<typeof CreateSavedFilterSchema>;
export type UpdateSavedFilter = z.infer<typeof UpdateSavedFilterSchema>;
export type SavedFilterFilter = z.infer<typeof SavedFilterFilterSchema>;
export type ApplySavedFilter = z.infer<typeof ApplySavedFilterSchema>;
export type SetDefaultFilter = z.infer<typeof SetDefaultFilterSchema>;

// ============ Audit Snapshot Schemas ============

/** Audit snapshot filter schema */
export const AuditSnapshotFilterSchema = z.object({
  entityType: z.union([
    z.nativeEnum(AuditEntityType),
    z.array(z.nativeEnum(AuditEntityType)),
  ]).optional(),
  entityId: z.string().optional(),
  action: z.union([
    z.nativeEnum(AuditAction),
    z.array(z.nativeEnum(AuditAction)),
  ]).optional(),
  changeSource: z.union([
    z.nativeEnum(ChangeSource),
    z.array(z.nativeEnum(ChangeSource)),
  ]).optional(),
  userId: z.string().uuid().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

/** Get entity audit history schema */
export const GetEntityAuditSchema = z.object({
  entityType: z.nativeEnum(AuditEntityType),
  entityId: z.string(),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

/** Compare snapshots schema */
export const CompareSnapshotsSchema = z.object({
  snapshotId1: z.string().uuid(),
  snapshotId2: z.string().uuid(),
});

// Type exports for audit snapshots
export type AuditSnapshotFilter = z.infer<typeof AuditSnapshotFilterSchema>;
export type GetEntityAudit = z.infer<typeof GetEntityAuditSchema>;
export type CompareSnapshots = z.infer<typeof CompareSnapshotsSchema>;

// ============ Print Station Management Schemas ============

/** Scheduled hours schema */
const ScheduledHoursSchema = z.object({
  start: z.string().regex(/^\d{2}:\d{2}$/, 'Must be in HH:MM format'),
  end: z.string().regex(/^\d{2}:\d{2}$/, 'Must be in HH:MM format'),
});

/** Create print queue schema */
export const CreatePrintQueueSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  station: z.nativeEnum(PrintingMethod),
  priority: z.number().int().min(1).max(10).default(1),
  maxConcurrent: z.number().int().min(1).max(10).default(1),
  autoSchedule: z.boolean().default(false),
  scheduledHours: ScheduledHoursSchema.optional(),
});

/** Update print queue schema */
export const UpdatePrintQueueSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  priority: z.number().int().min(1).max(10).optional(),
  maxConcurrent: z.number().int().min(1).max(10).optional(),
  autoSchedule: z.boolean().optional(),
  scheduledHours: ScheduledHoursSchema.nullable().optional(),
  isActive: z.boolean().optional(),
});

/** Create print job schema */
export const CreatePrintJobSchema = z.object({
  queueId: z.string().uuid(),
  workOrderId: z.string().uuid(),
  lineItemId: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  fileUrl: z.string().url().optional(),
  fileName: z.string().max(255).optional(),
  fileSize: z.number().int().positive().optional(),
  materialType: z.string().max(100).optional(),
  mediaWidth: z.number().positive().optional(),
  mediaLength: z.number().positive().optional(),
  copies: z.number().int().min(1).default(1),
  priority: z.number().int().min(1).max(5).default(3),
  estimatedMinutes: z.number().int().positive().optional(),
  assignedToId: z.string().uuid().optional(),
});

/** Update print job schema */
export const UpdatePrintJobSchema = z.object({
  queueId: z.string().uuid().optional(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  fileUrl: z.string().url().nullable().optional(),
  materialType: z.string().max(100).nullable().optional(),
  mediaWidth: z.number().positive().nullable().optional(),
  mediaLength: z.number().positive().nullable().optional(),
  copies: z.number().int().min(1).optional(),
  priority: z.number().int().min(1).max(5).optional(),
  estimatedMinutes: z.number().int().positive().nullable().optional(),
  assignedToId: z.string().uuid().nullable().optional(),
  operatorNotes: z.string().max(2000).nullable().optional(),
  qualityNotes: z.string().max(2000).nullable().optional(),
});

/** Update print job status schema */
export const UpdatePrintJobStatusSchema = z.object({
  status: z.nativeEnum(PrintJobStatus),
  operatorNotes: z.string().max(2000).optional(),
  errorMessage: z.string().max(1000).optional(),
});

/** Print queue filter schema */
export const PrintQueueFilterSchema = z.object({
  station: z.union([
    z.nativeEnum(PrintingMethod),
    z.array(z.nativeEnum(PrintingMethod)),
  ]).optional(),
  isActive: z.coerce.boolean().optional(),
  search: z.string().optional(),
});

/** Print job filter schema */
export const PrintJobFilterSchema = z.object({
  queueId: z.string().uuid().optional(),
  workOrderId: z.string().uuid().optional(),
  status: z.union([
    z.nativeEnum(PrintJobStatus),
    z.array(z.nativeEnum(PrintJobStatus)),
  ]).optional(),
  priority: z.coerce.number().int().min(1).max(5).optional(),
  assignedToId: z.string().uuid().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

/** Reorder print jobs schema */
export const ReorderPrintJobsSchema = z.object({
  queueId: z.string().uuid(),
  jobOrder: z.array(z.string().uuid()), // Array of job IDs in desired order
});

/** Bulk update print job status schema */
export const BulkUpdatePrintJobStatusSchema = z.object({
  jobIds: z.array(z.string().uuid()).min(1),
  status: z.nativeEnum(PrintJobStatus),
  operatorNotes: z.string().max(2000).optional(),
});

// Type exports for print station management
export type CreatePrintQueue = z.infer<typeof CreatePrintQueueSchema>;
export type UpdatePrintQueue = z.infer<typeof UpdatePrintQueueSchema>;
export type CreatePrintJob = z.infer<typeof CreatePrintJobSchema>;
export type UpdatePrintJob = z.infer<typeof UpdatePrintJobSchema>;
export type UpdatePrintJobStatus = z.infer<typeof UpdatePrintJobStatusSchema>;
export type PrintQueueFilter = z.infer<typeof PrintQueueFilterSchema>;
export type PrintJobFilter = z.infer<typeof PrintJobFilterSchema>;
export type ReorderPrintJobs = z.infer<typeof ReorderPrintJobsSchema>;
export type BulkUpdatePrintJobStatus = z.infer<typeof BulkUpdatePrintJobStatusSchema>;

// ============ User Preference Schemas ============

/** Schema for updating user preferences */
export const UpdateUserPreferenceSchema = z.object({
  // Theme & Appearance
  theme: z.nativeEnum(ThemeMode).optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
  fontSize: z.nativeEnum(FontSize).optional(),
  compactMode: z.boolean().optional(),
  
  // Layout Preferences
  sidebarCollapsed: z.boolean().optional(),
  sidebarPosition: z.nativeEnum(SidebarPosition).optional(),
  dashboardLayout: z.record(z.unknown()).nullable().optional(),
  defaultLandingPage: z.string().max(200).nullable().optional(),
  
  // Table/List Preferences
  defaultPageSize: z.number().int().min(5).max(100).optional(),
  showGridLines: z.boolean().optional(),
  tableColumnWidths: z.record(z.record(z.number())).nullable().optional(),
  hiddenColumns: z.record(z.array(z.string())).nullable().optional(),
  
  // Notification Preferences
  emailNotifications: z.boolean().optional(),
  browserNotifications: z.boolean().optional(),
  soundEnabled: z.boolean().optional(),
  notificationDigest: z.nativeEnum(NotificationDigest).optional(),
  
  // Time & Date Preferences
  timezone: z.string().max(50).optional(),
  dateFormat: z.string().max(20).optional(),
  timeFormat: z.nativeEnum(TimeFormat).optional(),
  weekStartsOn: z.number().int().min(0).max(6).optional(),
  
  // Keyboard & Accessibility
  keyboardShortcutsEnabled: z.boolean().optional(),
  highContrastMode: z.boolean().optional(),
  reduceMotion: z.boolean().optional(),
  
  // Custom Settings
  customSettings: z.record(z.unknown()).nullable().optional(),
});

export type UpdateUserPreference = z.infer<typeof UpdateUserPreferenceSchema>;

/** Schema for updating specific table column widths */
export const UpdateTableColumnWidthsSchema = z.object({
  tableId: z.string(), // e.g., "orders", "customers", "quotes"
  columns: z.record(z.number()), // column key -> width in pixels
});

export type UpdateTableColumnWidths = z.infer<typeof UpdateTableColumnWidthsSchema>;

/** Schema for updating hidden columns for a table */
export const UpdateHiddenColumnsSchema = z.object({
  tableId: z.string(),
  hiddenColumns: z.array(z.string()),
});

export type UpdateHiddenColumns = z.infer<typeof UpdateHiddenColumnsSchema>;

/** Schema for updating dashboard layout */
export const UpdateDashboardLayoutSchema = z.object({
  widgets: z.array(z.object({
    id: z.string(),
    x: z.number().int().min(0),
    y: z.number().int().min(0),
    w: z.number().int().min(1),
    h: z.number().int().min(1),
    visible: z.boolean().optional(),
  })),
});

export type UpdateDashboardLayout = z.infer<typeof UpdateDashboardLayoutSchema>;

/** Schema for partial preference updates (single setting) */
export const PatchUserPreferenceSchema = z.object({
  key: z.string(),
  value: z.unknown(),
});

export type PatchUserPreference = z.infer<typeof PatchUserPreferenceSchema>;

// ============ Favorites Schemas ============

/** Schema for creating a favorite */
export const CreateFavoriteSchema = z.object({
  entityType: z.nativeEnum(FavoriteEntityType),
  entityId: z.string().uuid(),
  displayName: z.string().min(1).max(200),
  description: z.string().max(500).nullable().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
  icon: z.string().max(50).nullable().optional(),
  groupName: z.string().max(100).nullable().optional(),
  showOnDashboard: z.boolean().optional().default(false),
  showInSidebar: z.boolean().optional().default(true),
});

export type CreateFavorite = z.infer<typeof CreateFavoriteSchema>;

/** Schema for updating a favorite */
export const UpdateFavoriteSchema = z.object({
  displayName: z.string().min(1).max(200).optional(),
  description: z.string().max(500).nullable().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
  icon: z.string().max(50).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
  groupName: z.string().max(100).nullable().optional(),
  showOnDashboard: z.boolean().optional(),
  showInSidebar: z.boolean().optional(),
});

export type UpdateFavorite = z.infer<typeof UpdateFavoriteSchema>;

/** Schema for reordering favorites */
export const ReorderFavoritesSchema = z.object({
  favoriteIds: z.array(z.string().uuid()).min(1),
});

export type ReorderFavorites = z.infer<typeof ReorderFavoritesSchema>;

/** Schema for filtering favorites */
export const FavoriteFilterSchema = z.object({
  entityType: z.nativeEnum(FavoriteEntityType).optional(),
  groupName: z.string().optional(),
  showOnDashboard: z.boolean().optional(),
  showInSidebar: z.boolean().optional(),
  search: z.string().optional(),
});

export type FavoriteFilter = z.infer<typeof FavoriteFilterSchema>;

/** Schema for bulk adding favorites */
export const BulkAddFavoritesSchema = z.object({
  favorites: z.array(CreateFavoriteSchema).min(1).max(50),
});

export type BulkAddFavorites = z.infer<typeof BulkAddFavoritesSchema>;

/** Schema for bulk removing favorites */
export const BulkRemoveFavoritesSchema = z.object({
  favoriteIds: z.array(z.string().uuid()).min(1),
});

export type BulkRemoveFavorites = z.infer<typeof BulkRemoveFavoritesSchema>;

// ============ Recent Search Schemas ============

/** Schema for logging a search */
export const LogSearchSchema = z.object({
  searchType: z.nativeEnum(SearchType),
  query: z.string().min(1).max(500),
  entityType: z.nativeEnum(SearchEntityType).nullable().optional(),
  filters: z.record(z.unknown()).nullable().optional(),
  resultCount: z.number().int().min(0).nullable().optional(),
  selectedId: z.string().uuid().nullable().optional(),
  selectedName: z.string().max(200).nullable().optional(),
});

export type LogSearch = z.infer<typeof LogSearchSchema>;

/** Schema for updating a search with selection */
export const UpdateSearchSelectionSchema = z.object({
  searchId: z.string().uuid(),
  selectedId: z.string().uuid(),
  selectedName: z.string().max(200),
});

export type UpdateSearchSelection = z.infer<typeof UpdateSearchSelectionSchema>;

/** Schema for filtering recent searches */
export const RecentSearchFilterSchema = z.object({
  searchType: z.nativeEnum(SearchType).optional(),
  entityType: z.nativeEnum(SearchEntityType).optional(),
  query: z.string().optional(), // Partial match
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(100).optional().default(20),
});

export type RecentSearchFilter = z.infer<typeof RecentSearchFilterSchema>;

/** Schema for clearing search history */
export const ClearSearchHistorySchema = z.object({
  searchType: z.nativeEnum(SearchType).optional(), // Clear only this type
  entityType: z.nativeEnum(SearchEntityType).optional(), // Clear only this entity
  olderThan: z.string().datetime().optional(), // Clear older than date
  all: z.boolean().optional(), // Clear everything
});

export type ClearSearchHistory = z.infer<typeof ClearSearchHistorySchema>;

// ============ Batch Import Schemas ============

/** Schema for a column mapping entry */
export const ColumnMappingSchema = z.object({
  sourceColumn: z.string().min(1).max(200),
  targetField: z.string().min(1).max(100),
  transform: z.enum(['uppercase', 'lowercase', 'trim', 'date', 'number', 'boolean', 'json']).optional(),
  required: z.boolean().optional().default(false),
  defaultValue: z.any().optional(),
});

export type ColumnMappingInput = z.infer<typeof ColumnMappingSchema>;

/** Schema for creating an import mapping */
export const CreateImportMappingSchema = z.object({
  name: z.string().min(1).max(200),
  entityType: z.nativeEnum(ImportEntityType),
  isDefault: z.boolean().optional().default(false),
  mappings: z.array(ColumnMappingSchema).min(1),
  defaults: z.record(z.any()).optional().nullable(),
});

export type CreateImportMappingInput = z.infer<typeof CreateImportMappingSchema>;

/** Schema for updating an import mapping */
export const UpdateImportMappingSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  isDefault: z.boolean().optional(),
  mappings: z.array(ColumnMappingSchema).min(1).optional(),
  defaults: z.record(z.any()).optional().nullable(),
});

export type UpdateImportMappingInput = z.infer<typeof UpdateImportMappingSchema>;

/** Schema for creating an import job */
export const CreateImportJobSchema = z.object({
  name: z.string().min(1).max(200),
  entityType: z.nativeEnum(ImportEntityType),
  mappingId: z.string().uuid().optional().nullable(),
  fileName: z.string().min(1).max(500),
  fileType: z.nativeEnum(ImportFileType),
  skipFirstRow: z.boolean().optional().default(true),
  updateExisting: z.boolean().optional().default(false),
  matchField: z.string().max(100).optional().nullable(),
  dryRun: z.boolean().optional().default(false),
  mappings: z.array(ColumnMappingSchema).optional(), // Inline mappings if no saved mapping
}).refine(
  (data) => data.mappingId || (data.mappings && data.mappings.length > 0),
  { message: 'Either mappingId or mappings must be provided' }
);

export type CreateImportJobInput = z.infer<typeof CreateImportJobSchema>;

/** Schema for starting/resuming an import job */
export const StartImportJobSchema = z.object({
  jobId: z.string().uuid(),
  resumeFromRow: z.number().int().min(0).optional(), // Resume from specific row
});

export type StartImportJobInput = z.infer<typeof StartImportJobSchema>;

/** Schema for filtering import jobs */
export const ImportJobFilterSchema = z.object({
  entityType: z.nativeEnum(ImportEntityType).optional(),
  status: z.union([
    z.nativeEnum(ImportJobStatus),
    z.array(z.nativeEnum(ImportJobStatus)),
  ]).optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type ImportJobFilter = z.infer<typeof ImportJobFilterSchema>;

/** Schema for import file validation */
export const ValidateImportFileSchema = z.object({
  fileName: z.string().min(1),
  fileType: z.nativeEnum(ImportFileType),
  entityType: z.nativeEnum(ImportEntityType),
  previewRows: z.number().int().min(1).max(100).optional().default(10),
});

export type ValidateImportFileInput = z.infer<typeof ValidateImportFileSchema>;

/** Schema for import preview/validation response */
export const ImportPreviewSchema = z.object({
  columns: z.array(z.string()),
  previewRows: z.array(z.record(z.any())),
  totalRows: z.number().int(),
  detectedFieldMappings: z.array(z.object({
    sourceColumn: z.string(),
    suggestedField: z.string().nullable(),
    confidence: z.number().min(0).max(1),
  })).optional(),
  validationErrors: z.array(z.object({
    row: z.number().int(),
    field: z.string(),
    error: z.string(),
  })).optional(),
});

export type ImportPreview = z.infer<typeof ImportPreviewSchema>;

// ============ Keyboard Shortcuts Schemas ============

/** Schema for key combination (e.g., 'ctrl+s', 'cmd+shift+p') */
export const KeyComboSchema = z.string()
  .min(1)
  .max(50)
  .regex(/^[a-z0-9+]+$/i, 'Key combo must be lowercase letters, numbers, and + signs')
  .refine(
    (combo) => {
      const parts = combo.toLowerCase().split('+');
      // Must have at least one actual key (not just modifiers)
      const modifiers = ['ctrl', 'alt', 'shift', 'meta', 'cmd'];
      const nonModifiers = parts.filter(p => !modifiers.includes(p));
      return nonModifiers.length === 1;
    },
    { message: 'Key combo must have exactly one non-modifier key' }
  );

/** Schema for creating a custom keyboard shortcut */
export const CreateKeyboardShortcutSchema = z.object({
  actionId: z.string().min(1).max(100).regex(/^[a-z]+\.[a-z]+$/i, 'ActionId must be in format "category.action"'),
  keyCombo: KeyComboSchema,
  isEnabled: z.boolean().optional().default(true),
  scope: z.nativeEnum(ShortcutScope).optional().default(ShortcutScope.GLOBAL),
  context: z.string().max(100).optional().nullable(),
});

export type CreateKeyboardShortcut = z.infer<typeof CreateKeyboardShortcutSchema>;

/** Schema for updating a custom keyboard shortcut */
export const UpdateKeyboardShortcutSchema = z.object({
  keyCombo: KeyComboSchema.optional(),
  isEnabled: z.boolean().optional(),
  scope: z.nativeEnum(ShortcutScope).optional(),
  context: z.string().max(100).optional().nullable(),
});

export type UpdateKeyboardShortcut = z.infer<typeof UpdateKeyboardShortcutSchema>;

/** Schema for resetting a shortcut to default */
export const ResetShortcutSchema = z.object({
  actionId: z.string().min(1).max(100),
});

export type ResetShortcut = z.infer<typeof ResetShortcutSchema>;

/** Schema for checking shortcut conflicts */
export const CheckShortcutConflictSchema = z.object({
  keyCombo: KeyComboSchema,
  scope: z.nativeEnum(ShortcutScope).optional().default(ShortcutScope.GLOBAL),
  excludeActionId: z.string().optional(), // Exclude this action from conflict check
});

export type CheckShortcutConflict = z.infer<typeof CheckShortcutConflictSchema>;

/** Schema for bulk updating shortcut enabled states */
export const BulkUpdateShortcutsSchema = z.object({
  shortcuts: z.array(z.object({
    actionId: z.string(),
    isEnabled: z.boolean(),
  })).min(1),
});

export type BulkUpdateShortcuts = z.infer<typeof BulkUpdateShortcutsSchema>;

// ============ SSS-001: ML Prediction & Routing Intelligence Schemas ============

/** Schema for prediction factor weights */
export const PredictionFactorWeightsSchema = z.object({
  queueDepth: z.number().min(0).max(1).default(0.2),
  operatorSkill: z.number().min(0).max(1).default(0.15),
  equipmentStatus: z.number().min(0).max(1).default(0.2),
  materialMatch: z.number().min(0).max(1).default(0.1),
  deadline: z.number().min(0).max(1).default(0.2),
  qualityHistory: z.number().min(0).max(1).default(0.1),
  setupTime: z.number().min(0).max(1).default(0.05),
}).refine(
  (weights) => {
    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    return Math.abs(sum - 1.0) < 0.01; // Must sum to ~1.0
  },
  { message: 'Factor weights must sum to 1.0' }
);

export type PredictionFactorWeightsInput = z.infer<typeof PredictionFactorWeightsSchema>;

/** Schema for creating a routing prediction request */
export const CreateRoutingPredictionSchema = z.object({
  workOrderId: z.string().uuid().optional(),
  jobType: z.string().max(100).optional(),
  customerSegment: z.string().max(50).optional(),
  priorityLevel: z.number().int().min(1).max(5).default(3),
  estimatedArea: z.number().positive().optional(),
  factorWeights: PredictionFactorWeightsSchema.optional(),
});

export type CreateRoutingPredictionInput = z.infer<typeof CreateRoutingPredictionSchema>;

/** Schema for prediction feedback */
export const PredictionFeedbackSchema = z.object({
  predictionId: z.string().uuid(),
  wasAccepted: z.boolean(),
  feedbackScore: z.number().int().min(1).max(5).optional(),
  feedbackNotes: z.string().max(500).optional(),
  actualRoute: z.array(z.string()).optional(),
  actualDuration: z.number().int().positive().optional(),
});

export type PredictionFeedbackInput = z.infer<typeof PredictionFeedbackSchema>;

/** Schema for optimization rule conditions */
export const OptimizationConditionsSchema = z.object({
  queueDepthThreshold: z.number().int().min(0).optional(),
  materialMatch: z.array(z.string()).optional(),
  priorityRange: z.tuple([z.number().int().min(1), z.number().int().max(5)]).optional(),
  jobTypeMatch: z.array(z.string()).optional(),
  timeOfDay: z.object({
    start: z.string().regex(/^\d{2}:\d{2}$/),
    end: z.string().regex(/^\d{2}:\d{2}$/),
  }).optional(),
  dayOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
});

export type OptimizationConditionsInput = z.infer<typeof OptimizationConditionsSchema>;

/** Schema for optimization rule actions */
export const OptimizationActionsSchema = z.object({
  preferStation: z.array(z.string()).optional(),
  avoidStation: z.array(z.string()).optional(),
  batchWith: z.array(z.string()).optional(),
  adjustPriority: z.number().int().min(-5).max(5).optional(),
  addWarning: z.string().max(200).optional(),
  requireApproval: z.boolean().optional(),
});

export type OptimizationActionsInput = z.infer<typeof OptimizationActionsSchema>;

/** Schema for creating an optimization rule */
export const CreateOptimizationRuleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  code: z.string().min(1).max(50).regex(/^[A-Z][A-Z0-9_]*$/, 'Code must be UPPER_SNAKE_CASE'),
  ruleType: z.nativeEnum(OptimizationRuleType),
  category: z.nativeEnum(OptimizationCategory),
  conditions: OptimizationConditionsSchema,
  actions: OptimizationActionsSchema,
  weight: z.number().min(0).max(2).default(1.0),
  appliesTo: z.array(z.string()).default([]),
  priority: z.number().int().min(1).max(100).default(50),
});

export type CreateOptimizationRuleInput = z.infer<typeof CreateOptimizationRuleSchema>;

/** Schema for updating an optimization rule */
export const UpdateOptimizationRuleSchema = CreateOptimizationRuleSchema.partial().omit({ code: true });

export type UpdateOptimizationRuleInput = z.infer<typeof UpdateOptimizationRuleSchema>;

/** Schema for constraint definition */
export const ConstraintDefinitionSchema = z.object({
  maxValue: z.number().optional(),
  minValue: z.number().optional(),
  allowedValues: z.array(z.string()).optional(),
  excludedValues: z.array(z.string()).optional(),
  timeWindows: z.array(z.object({
    start: z.string().regex(/^\d{2}:\d{2}$/),
    end: z.string().regex(/^\d{2}:\d{2}$/),
  })).optional(),
  dependencies: z.array(z.string()).optional(),
  expression: z.string().max(500).optional(),
});

export type ConstraintDefinitionInput = z.infer<typeof ConstraintDefinitionSchema>;

/** Schema for creating a scheduling constraint */
export const CreateSchedulingConstraintSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  code: z.string().min(1).max(50).regex(/^[A-Z][A-Z0-9_]*$/),
  constraintType: z.nativeEnum(ConstraintType),
  targetType: z.nativeEnum(ConstraintTarget),
  targetId: z.string().uuid().optional().nullable(),
  definition: ConstraintDefinitionSchema,
  isHard: z.boolean().default(true),
  violationCost: z.number().min(0).optional().nullable(),
  priority: z.number().int().min(1).max(100).default(50),
});

export type CreateSchedulingConstraintInput = z.infer<typeof CreateSchedulingConstraintSchema>;

/** Schema for filtering routing predictions */
export const RoutingPredictionFilterSchema = z.object({
  workOrderId: z.string().uuid().optional(),
  jobType: z.string().optional(),
  modelVersion: z.string().optional(),
  minConfidence: z.number().min(0).max(1).optional(),
  wasAccepted: z.boolean().optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type RoutingPredictionFilter = z.infer<typeof RoutingPredictionFilterSchema>;

/** Schema for requesting routing optimization */
export const RequestRoutingOptimizationSchema = z.object({
  workOrderId: z.string().uuid(),
  currentRoute: z.array(z.string()).optional(),
  constraints: z.array(z.string()).optional(), // Constraint codes to apply
  excludeStations: z.array(z.string()).optional(),
  preferStations: z.array(z.string()).optional(),
  mustIncludeStations: z.array(z.string()).optional(),
});

export type RequestRoutingOptimizationInput = z.infer<typeof RequestRoutingOptimizationSchema>;

/** Schema for bulk route optimization request */
export const BulkRouteOptimizationSchema = z.object({
  workOrderIds: z.array(z.string().uuid()).min(1).max(100),
  applyAutomatically: z.boolean().default(false),
  notifyOnComplete: z.boolean().default(true),
});

export type BulkRouteOptimizationInput = z.infer<typeof BulkRouteOptimizationSchema>;

// ============ SSS-008/SSS-011: NLP Query & Command Palette Schemas ============

import {
  QueryIntent,
  ScheduleFrequency,
  CommandType,
  ActionCategory,
} from './enums.js';

/** Schema for parsed entities */
export const ParsedEntitiesSchema = z.object({
  customer: z.string().optional(),
  customerIds: z.array(z.string()).optional(),
  status: z.array(z.string()).optional(),
  dateRange: z.object({
    start: z.string().datetime().optional(),
    end: z.string().datetime().optional(),
    relative: z.string().optional(),
  }).optional(),
  station: z.array(z.string()).optional(),
  operator: z.array(z.string()).optional(),
  orderNumbers: z.array(z.string()).optional(),
  amount: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
    comparison: z.enum(['gt', 'lt', 'eq', 'gte', 'lte']).optional(),
  }).optional(),
  priority: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  limit: z.number().int().positive().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export type ParsedEntities = z.infer<typeof ParsedEntitiesSchema>;

/** Schema for NLP query input */
export const NLPQueryInputSchema = z.object({
  rawQuery: z.string().min(1).max(500),
  context: z.string().max(100).optional(),   // Current page/context
  executeImmediately: z.boolean().default(false),
});

export type NLPQueryInput = z.infer<typeof NLPQueryInputSchema>;

/** Schema for NLP query feedback */
export const NLPQueryFeedbackSchema = z.object({
  queryId: z.string().uuid(),
  wasSuccessful: z.boolean(),
  feedbackScore: z.number().int().min(1).max(5).optional(),
  feedbackNotes: z.string().max(500).optional(),
  correctedIntent: z.nativeEnum(QueryIntent).optional(),
  correctedEntities: ParsedEntitiesSchema.optional(),
});

export type NLPQueryFeedback = z.infer<typeof NLPQueryFeedbackSchema>;

/** Schema for creating a saved query */
export const CreateSavedQuerySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  rawQuery: z.string().min(1).max(500),
  isShared: z.boolean().default(false),
  sharedWithRoles: z.array(z.string()).optional(),
  isScheduled: z.boolean().default(false),
  scheduleFrequency: z.nativeEnum(ScheduleFrequency).optional(),
  scheduleCron: z.string().max(50).optional(),
  isPinned: z.boolean().default(false),
  dashboardPosition: z.number().int().optional(),
});

export type CreateSavedQueryInput = z.infer<typeof CreateSavedQuerySchema>;

/** Schema for updating a saved query */
export const UpdateSavedQuerySchema = CreateSavedQuerySchema.partial();

export type UpdateSavedQueryInput = z.infer<typeof UpdateSavedQuerySchema>;

/** Schema for creating a quick action */
export const CreateQuickActionSchema = z.object({
  code: z.string().min(1).max(50).regex(/^[a-z_]+$/),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  category: z.nativeEnum(ActionCategory),
  keywords: z.array(z.string().max(50)).optional(),
  routePath: z.string().max(200).optional(),
  actionHandler: z.string().max(100).optional(),
  requiredParams: z.record(z.unknown()).optional(),
  requiredRoles: z.array(z.string()).optional(),
  requiredPermission: z.string().max(100).optional(),
  icon: z.string().max(50).optional(),
  shortcut: z.string().max(50).optional(),
  sortOrder: z.number().int().optional(),
});

export type CreateQuickActionInput = z.infer<typeof CreateQuickActionSchema>;

/** Schema for updating user action preferences */
export const UpdateActionPreferenceSchema = z.object({
  actionId: z.string().uuid(),
  isPinned: z.boolean().optional(),
  customShortcut: z.string().max(50).optional(),
  isHidden: z.boolean().optional(),
});

export type UpdateActionPreferenceInput = z.infer<typeof UpdateActionPreferenceSchema>;

/** Schema for command palette search */
export const CommandPaletteSearchSchema = z.object({
  query: z.string().max(200),
  types: z.array(z.nativeEnum(CommandType)).optional(),
  limit: z.number().int().min(1).max(50).default(10),
  includeRecent: z.boolean().default(true),
  includePinned: z.boolean().default(true),
});

export type CommandPaletteSearchInput = z.infer<typeof CommandPaletteSearchSchema>;

/** Schema for executive dashboard query */
export const ExecutiveDashboardQuerySchema = z.object({
  query: z.string().min(1).max(500),
  dateRange: z.object({
    start: z.string().datetime().optional(),
    end: z.string().datetime().optional(),
    preset: z.enum([
      'today', 'yesterday', 'this_week', 'last_week',
      'this_month', 'last_month', 'this_quarter', 'last_quarter',
      'this_year', 'last_year', 'custom'
    ]).optional(),
  }).optional(),
  compareWith: z.object({
    start: z.string().datetime().optional(),
    end: z.string().datetime().optional(),
    preset: z.enum(['previous_period', 'same_period_last_year', 'custom']).optional(),
  }).optional(),
  groupBy: z.array(z.string()).optional(),
  visualization: z.enum(['table', 'bar', 'line', 'pie', 'metric']).optional(),
});

export type ExecutiveDashboardQueryInput = z.infer<typeof ExecutiveDashboardQuerySchema>;

// ============ SSS-015: Integration Automation Platform Schemas ============

import {
  WorkflowCategory,
  WorkflowTriggerType,
  WorkflowErrorAction,
  WorkflowStepType,
  WorkflowActionType,
} from './enums.js';

/** Schema for workflow trigger conditions */
export const WorkflowConditionSchema: z.ZodType<unknown> = z.lazy(() =>
  z.object({
    field: z.string().optional(),
    operator: z.enum(['eq', 'ne', 'gt', 'lt', 'gte', 'lte', 'contains', 'startsWith', 'endsWith', 'in', 'notIn']).optional(),
    value: z.unknown().optional(),
    and: z.array(WorkflowConditionSchema).optional(),
    or: z.array(WorkflowConditionSchema).optional(),
  })
);

/** Schema for workflow action configuration */
export const WorkflowActionConfigSchema = z.object({
  // Email
  to: z.union([z.string(), z.array(z.string())]).optional(),
  cc: z.array(z.string()).optional(),
  subject: z.string().max(500).optional(),
  body: z.string().optional(),
  templateId: z.string().uuid().optional(),
  
  // Webhook
  url: z.string().url().optional(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).optional(),
  headers: z.record(z.string()).optional(),
  payload: z.unknown().optional(),
  
  // Record operations
  entityType: z.string().max(50).optional(),
  entityId: z.string().optional(),
  data: z.record(z.unknown()).optional(),
  query: z.record(z.unknown()).optional(),
  
  // Status updates
  newStatus: z.string().max(50).optional(),
  
  // Delays
  delaySeconds: z.number().int().min(0).optional(),
  delayUntil: z.string().optional(),
  
  // Conditions
  condition: WorkflowConditionSchema.optional(),
  trueBranch: z.string().optional(),
  falseBranch: z.string().optional(),
  
  // Loops
  items: z.string().optional(),
  itemVariable: z.string().optional(),
  
  // Custom
  params: z.record(z.unknown()).optional(),
});

export type WorkflowActionConfigInput = z.infer<typeof WorkflowActionConfigSchema>;

/** Schema for creating a workflow */
export const CreateWorkflowSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  code: z.string().min(1).max(50).regex(/^[a-z_][a-z0-9_]*$/),
  category: z.nativeEnum(WorkflowCategory),
  triggerType: z.nativeEnum(WorkflowTriggerType),
  triggerEvent: z.string().max(100).optional(),
  triggerSchedule: z.string().max(100).optional(),
  triggerConditions: WorkflowConditionSchema.optional(),
  maxRetries: z.number().int().min(0).max(10).default(3),
  retryDelaySeconds: z.number().int().min(0).max(3600).default(60),
  onErrorAction: z.nativeEnum(WorkflowErrorAction).default(WorkflowErrorAction.STOP),
  notifyOnError: z.boolean().default(true),
  errorNotifyEmails: z.array(z.string().email()).optional(),
});

export type CreateWorkflowInput = z.infer<typeof CreateWorkflowSchema>;

/** Schema for updating a workflow */
export const UpdateWorkflowSchema = CreateWorkflowSchema.partial().extend({
  isActive: z.boolean().optional(),
  isPublished: z.boolean().optional(),
});

export type UpdateWorkflowInput = z.infer<typeof UpdateWorkflowSchema>;

/** Schema for creating a workflow step */
export const CreateWorkflowStepSchema = z.object({
  workflowId: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  stepOrder: z.number().int().min(1),
  stepType: z.nativeEnum(WorkflowStepType),
  actionType: z.nativeEnum(WorkflowActionType),
  actionConfig: WorkflowActionConfigSchema,
  conditions: WorkflowConditionSchema.optional(),
  skipOnCondition: z.boolean().default(false),
  timeoutSeconds: z.number().int().min(1).max(3600).default(30),
  maxRetries: z.number().int().min(0).max(10).optional(),
  retryDelaySeconds: z.number().int().min(0).max(3600).optional(),
  onError: z.nativeEnum(WorkflowErrorAction).optional(),
  nextStepOnSuccess: z.string().uuid().optional(),
  nextStepOnFailure: z.string().uuid().optional(),
});

export type CreateWorkflowStepInput = z.infer<typeof CreateWorkflowStepSchema>;

/** Schema for updating a workflow step */
export const UpdateWorkflowStepSchema = CreateWorkflowStepSchema.omit({ workflowId: true }).partial();

export type UpdateWorkflowStepInput = z.infer<typeof UpdateWorkflowStepSchema>;

/** Schema for triggering a workflow manually */
export const TriggerWorkflowSchema = z.object({
  workflowId: z.string().uuid(),
  triggerData: z.record(z.unknown()).optional(),
  entityType: z.string().max(50).optional(),
  entityId: z.string().uuid().optional(),
});

export type TriggerWorkflowInput = z.infer<typeof TriggerWorkflowSchema>;

/** Schema for creating a workflow variable */
export const CreateWorkflowVariableSchema = z.object({
  name: z.string().min(1).max(50).regex(/^[A-Z_][A-Z0-9_]*$/),
  description: z.string().max(500).optional(),
  variableType: z.enum(['STRING', 'NUMBER', 'BOOLEAN', 'JSON', 'SECRET', 'API_KEY', 'CONNECTION_STRING']),
  defaultValue: z.string().optional(),
  isSecret: z.boolean().default(false),
  isGlobal: z.boolean().default(true),
  workflowIds: z.array(z.string().uuid()).optional(),
});

export type CreateWorkflowVariableInput = z.infer<typeof CreateWorkflowVariableSchema>;

/** Schema for workflow execution filters */
export const WorkflowExecutionFilterSchema = z.object({
  workflowId: z.string().uuid().optional(),
  status: z.array(z.enum(['PENDING', 'RUNNING', 'WAITING', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED', 'RETRYING'])).optional(),
  triggeredBy: z.nativeEnum(WorkflowTriggerType).optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type WorkflowExecutionFilter = z.infer<typeof WorkflowExecutionFilterSchema>;

// ============================================================================
// DATA INTEGRITY & VALIDATION SCHEMAS
// ============================================================================

// Validation trigger enum schema
export const ValidationTriggerSchema = z.enum([
  'BEFORE_CREATE',
  'AFTER_CREATE',
  'BEFORE_UPDATE',
  'AFTER_UPDATE',
  'BEFORE_DELETE',
  'ON_STATUS_CHANGE',
  'CUSTOM',
]);

// Constraint severity enum schema
export const ConstraintSeveritySchema = z.enum(['WARNING', 'ERROR', 'INFO']);

// Validation severity enum schema
export const ValidationSeveritySchema = z.nativeEnum(ValidationSeverity);

// Check frequency enum schema
export const CheckFrequencySchema = z.enum([
  'REAL_TIME',
  'HOURLY',
  'DAILY',
  'WEEKLY',
  'MONTHLY',
  'ON_DEMAND',
]);

// Integrity check status enum schema
export const IntegrityCheckStatusSchema = z.enum([
  'PENDING',
  'RUNNING',
  'PASSED',
  'FAILED',
  'SKIPPED',
]);

// Field constraint type enum schema
export const FieldConstraintTypeSchema = z.enum([
  'MIN_LENGTH',
  'MAX_LENGTH',
  'MIN_VALUE',
  'MAX_VALUE',
  'PATTERN',
  'REQUIRED',
  'UNIQUE',
  'ENUM',
  'CUSTOM',
  'DEPENDENCY',
  'DATE_RANGE',
  'FUTURE_DATE',
  'PAST_DATE',
  'FILE_TYPE',
  'FILE_SIZE',
]);

// Anomaly type enum schema
export const AnomalyTypeSchema = z.enum([
  'ORPHAN_RECORD',
  'DUPLICATE',
  'CONSTRAINT_VIOLATION',
  'DATA_CORRUPTION',
  'MISSING_REQUIRED',
  'REFERENTIAL_INTEGRITY',
  'RANGE_VIOLATION',
  'FORMAT_ERROR',
  'STALE_DATA',
  'CIRCULAR_REFERENCE',
]);

// Anomaly severity enum schema
export const AnomalySeveritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

// Anomaly status enum schema
export const AnomalyStatusSchema = z.enum([
  'DETECTED',
  'ACKNOWLEDGED',
  'IN_PROGRESS',
  'RESOLVED',
  'IGNORED',
  'FALSE_POSITIVE',
]);

// Create validation rule schema
export const CreateValidationRuleSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().optional(),
  entityType: z.string().min(1, 'Entity type is required'),
  triggerEvent: ValidationTriggerSchema,
  expression: z.string().min(1, 'Expression is required'),
  conditionExpression: z.string().optional(),
  errorMessage: z.string().min(1, 'Error message is required'),
  errorField: z.string().optional(),
  severity: ValidationSeveritySchema.default(ValidationSeverity.ERROR),
  priority: z.number().int().min(0).default(0),
  isEnabled: z.boolean().default(true),
});

export type CreateValidationRule = z.infer<typeof CreateValidationRuleSchema>;

// Update validation rule schema
export const UpdateValidationRuleSchema = CreateValidationRuleSchema.partial();
export type UpdateValidationRule = z.infer<typeof UpdateValidationRuleSchema>;

// Create field constraint schema
export const CreateFieldConstraintSchema = z.object({
  entityType: z.string().min(1),
  fieldName: z.string().min(1),
  constraintType: FieldConstraintTypeSchema,
  minValue: z.number().optional(),
  maxValue: z.number().optional(),
  pattern: z.string().optional(),
  allowedValues: z.array(z.string()).optional(),
  customValidator: z.string().optional(),
  errorMessage: z.string().min(1),
  severity: ConstraintSeveritySchema.default('ERROR'),
  isEnabled: z.boolean().default(true),
});

export type CreateFieldConstraint = z.infer<typeof CreateFieldConstraintSchema>;

// Update field constraint schema
export const UpdateFieldConstraintSchema = CreateFieldConstraintSchema.partial();
export type UpdateFieldConstraint = z.infer<typeof UpdateFieldConstraintSchema>;

// Create data integrity check schema
export const CreateDataIntegrityCheckSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  category: z.string().optional(),
  entityType: z.string().optional(),
  checkQuery: z.string().min(1, 'Check query is required'),
  expectedResult: z.string().optional(),
  frequency: CheckFrequencySchema.default('DAILY'),
  canAutoFix: z.boolean().default(false),
  autoFixQuery: z.string().optional(),
  isEnabled: z.boolean().default(true),
});

export type CreateDataIntegrityCheck = z.infer<typeof CreateDataIntegrityCheckSchema>;

// Update data integrity check schema
export const UpdateDataIntegrityCheckSchema = CreateDataIntegrityCheckSchema.partial();
export type UpdateDataIntegrityCheck = z.infer<typeof UpdateDataIntegrityCheckSchema>;

// Validation result schema
export const ValidationResultSchema = z.object({
  isValid: z.boolean(),
  errors: z.array(z.object({
    ruleId: z.string().optional(),
    field: z.string(),
    message: z.string(),
    code: z.string().optional(),
  })),
  warnings: z.array(z.object({
    ruleId: z.string().optional(),
    field: z.string(),
    message: z.string(),
  })),
});

export type ValidationResultInput = z.infer<typeof ValidationResultSchema>;

// Batch validation request schema
export const BatchValidationRequestSchema = z.object({
  entityType: z.string().min(1),
  entities: z.array(z.object({
    id: z.string(),
    data: z.record(z.unknown()),
  })),
  triggerEvent: ValidationTriggerSchema.optional(),
});

export type BatchValidationRequestInput = z.infer<typeof BatchValidationRequestSchema>;

// Resolve anomaly schema
export const ResolveAnomalySchema = z.object({
  status: AnomalyStatusSchema,
  resolutionNotes: z.string().optional(),
});

export type ResolveAnomaly = z.infer<typeof ResolveAnomalySchema>;

// ============================================================================
// AUDIT & COMPLIANCE SCHEMAS
// ============================================================================

import {
  AuditEventType,
  AuditCategory,
  SignatureDocType,
  SignatureType,
  ComplianceCategory,
  ComplianceSeverity,
  ComplianceAction,
  ViolationStatus,
  RetentionBasis,
  ExpiryAction,
  AccessType,
} from './enums.js';

// Audit event type schema
export const AuditEventTypeSchema = z.nativeEnum(AuditEventType);

// Audit category schema
export const AuditCategorySchema = z.nativeEnum(AuditCategory);

// Signature document type schema
export const SignatureDocTypeSchema = z.nativeEnum(SignatureDocType);

// Signature type schema
export const SignatureTypeSchema = z.nativeEnum(SignatureType);

// Compliance category schema
export const ComplianceCategorySchema = z.nativeEnum(ComplianceCategory);

// Compliance severity schema
export const ComplianceSeveritySchema = z.nativeEnum(ComplianceSeverity);

// Compliance action schema
export const ComplianceActionSchema = z.nativeEnum(ComplianceAction);

// Violation status schema
export const ViolationStatusSchema = z.nativeEnum(ViolationStatus);

// Retention basis schema
export const RetentionBasisSchema = z.nativeEnum(RetentionBasis);

// Expiry action schema
export const ExpiryActionSchema = z.nativeEnum(ExpiryAction);

// Access type schema
export const AccessTypeSchema = z.nativeEnum(AccessType);

// Create audit event schema
export const CreateAuditEventSchema = z.object({
  eventType: AuditEventTypeSchema,
  category: AuditCategorySchema.default(AuditCategory.DATA_CHANGE),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  entityName: z.string().optional(),
  action: z.string().min(1),
  fieldChanges: z.array(z.object({
    field: z.string(),
    oldValue: z.unknown(),
    newValue: z.unknown(),
    fieldLabel: z.string().optional(),
  })).optional(),
  previousState: z.record(z.unknown()).optional(),
  newState: z.record(z.unknown()).optional(),
  reason: z.string().optional(),
  comment: z.string().optional(),
  ticketReference: z.string().optional(),
});

export type CreateAuditEvent = z.infer<typeof CreateAuditEventSchema>;

// Audit filter schema
export const AuditFilterSchema = z.object({
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  userId: z.string().optional(),
  eventTypes: z.array(AuditEventTypeSchema).optional(),
  categories: z.array(AuditCategorySchema).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  includeSystem: z.boolean().optional(),
  limit: z.number().int().positive().max(1000).default(100),
  offset: z.number().int().min(0).default(0),
});

export type AuditFilter = z.infer<typeof AuditFilterSchema>;

// Create signature request schema
export const CreateSignatureSchema = z.object({
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  documentType: SignatureDocTypeSchema,
  signatureType: SignatureTypeSchema,
  signatureValue: z.string().optional(),
  signatureImage: z.string().optional(),
  signatureIntent: z.string().min(1),
  legalStatement: z.string().optional(),
});

export type CreateSignature = z.infer<typeof CreateSignatureSchema>;

// Create compliance rule schema
export const CreateComplianceRuleSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(50).regex(/^[A-Z0-9_]+$/, 'Code must be uppercase alphanumeric'),
  description: z.string().optional(),
  category: ComplianceCategorySchema,
  regulation: z.string().optional(),
  entityType: z.string().optional(),
  checkExpression: z.string().min(1),
  severity: ComplianceSeveritySchema,
  onViolation: ComplianceActionSchema.default(ComplianceAction.ALERT),
  alertRecipients: z.array(z.string()).optional(),
  blockingLevel: z.number().int().min(0).max(2).default(0),
  checkFrequency: CheckFrequencySchema.default('REAL_TIME'),
  effectiveFrom: z.coerce.date().optional(),
  effectiveUntil: z.coerce.date().optional(),
  isEnabled: z.boolean().default(true),
});

export type CreateComplianceRule = z.infer<typeof CreateComplianceRuleSchema>;

// Update compliance rule schema
export const UpdateComplianceRuleSchema = CreateComplianceRuleSchema.omit({ code: true }).partial();
export type UpdateComplianceRule = z.infer<typeof UpdateComplianceRuleSchema>;

// Create data retention policy schema
export const CreateDataRetentionPolicySchema = z.object({
  name: z.string().min(1).max(100),
  entityType: z.string().min(1),
  description: z.string().optional(),
  retentionPeriodDays: z.number().int().positive(),
  retentionBasis: RetentionBasisSchema,
  legalReference: z.string().optional(),
  triggerField: z.string().default('createdAt'),
  triggerCondition: z.string().optional(),
  expiryAction: ExpiryActionSchema.default(ExpiryAction.ANONYMIZE),
  archiveLocation: z.string().optional(),
  excludeCondition: z.string().optional(),
  legalHoldExempt: z.boolean().default(false),
  isEnabled: z.boolean().default(true),
});

export type CreateDataRetentionPolicy = z.infer<typeof CreateDataRetentionPolicySchema>;

// Update data retention policy schema
export const UpdateDataRetentionPolicySchema = CreateDataRetentionPolicySchema.partial();
export type UpdateDataRetentionPolicy = z.infer<typeof UpdateDataRetentionPolicySchema>;

// Resolve violation schema
export const ResolveViolationSchema = z.object({
  status: ViolationStatusSchema,
  resolution: z.string().optional(),
  remediation: z.string().optional(),
});

export type ResolveViolation = z.infer<typeof ResolveViolationSchema>;

// ============================================================================
// MULTI-TENANCY & ORGANIZATION SCHEMAS
// ============================================================================

import {
  OrganizationType,
  OrgStatus,
  SubscriptionTier,
  LocationType,
  DeptMemberRole,
  TeamType,
  TeamMemberRole,
  OrgUserRole,
  SettingCategory,
  SettingValueType,
} from './enums.js';

// Organization type schema
export const OrganizationTypeSchema = z.nativeEnum(OrganizationType);

// Org status schema
export const OrgStatusSchema = z.nativeEnum(OrgStatus);

// Subscription tier schema
export const SubscriptionTierSchema = z.nativeEnum(SubscriptionTier);

// Location type schema
export const LocationTypeSchema = z.nativeEnum(LocationType);

// Dept member role schema
export const DeptMemberRoleSchema = z.nativeEnum(DeptMemberRole);

// Team type schema
export const TeamTypeSchema = z.nativeEnum(TeamType);

// Team member role schema
export const TeamMemberRoleSchema = z.nativeEnum(TeamMemberRole);

// Org user role schema
export const OrgUserRoleSchema = z.nativeEnum(OrgUserRole);

// Setting category schema
export const SettingCategorySchema = z.nativeEnum(SettingCategory);

// Setting value type schema
export const SettingValueTypeSchema = z.nativeEnum(SettingValueType);

// Create organization schema
export const CreateOrganizationSchema = z.object({
  name: z.string().min(1).max(100),
  legalName: z.string().optional(),
  code: z.string().min(2).max(20).regex(/^[A-Z0-9_]+$/, 'Code must be uppercase alphanumeric'),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase with dashes'),
  orgType: OrganizationTypeSchema.default(OrganizationType.COMPANY),
  parentId: z.string().uuid().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  website: z.string().url().optional(),
  address1: z.string().optional(),
  address2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().default('US'),
  taxId: z.string().optional(),
  industry: z.string().optional(),
  timezone: z.string().default('America/Chicago'),
  currency: z.string().default('USD'),
  fiscalYearStart: z.number().int().min(1).max(12).default(1),
});

export type CreateOrganization = z.infer<typeof CreateOrganizationSchema>;

// Update organization schema
export const UpdateOrganizationSchema = CreateOrganizationSchema.omit({ code: true, slug: true }).partial();
export type UpdateOrganization = z.infer<typeof UpdateOrganizationSchema>;

// Create location schema
export const CreateLocationSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1).max(100),
  code: z.string().min(2).max(20),
  locationType: LocationTypeSchema.default(LocationType.PRODUCTION),
  address1: z.string().min(1),
  address2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  postalCode: z.string().min(1),
  country: z.string().default('US'),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  managerUserId: z.string().uuid().optional(),
  timezone: z.string().default('America/Chicago'),
  isHeadquarters: z.boolean().default(false),
  squareFootage: z.number().positive().optional(),
  maxCapacity: z.number().int().positive().optional(),
});

export type CreateLocation = z.infer<typeof CreateLocationSchema>;

// Update location schema
export const UpdateLocationSchema = CreateLocationSchema.omit({ organizationId: true }).partial();
export type UpdateLocation = z.infer<typeof UpdateLocationSchema>;

// Create department schema
export const CreateDepartmentSchema = z.object({
  organizationId: z.string().uuid(),
  locationId: z.string().uuid().optional(),
  name: z.string().min(1).max(100),
  code: z.string().min(2).max(20),
  description: z.string().optional(),
  parentId: z.string().uuid().optional(),
  costCenterCode: z.string().optional(),
  budgetCode: z.string().optional(),
  annualBudget: z.number().positive().optional(),
  managerUserId: z.string().uuid().optional(),
});

export type CreateDepartment = z.infer<typeof CreateDepartmentSchema>;

// Update department schema
export const UpdateDepartmentSchema = CreateDepartmentSchema.omit({ organizationId: true }).partial();
export type UpdateDepartment = z.infer<typeof UpdateDepartmentSchema>;

// Create team schema
export const CreateTeamSchema = z.object({
  organizationId: z.string().uuid(),
  locationId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  name: z.string().min(1).max(100),
  code: z.string().min(2).max(20),
  description: z.string().optional(),
  teamType: TeamTypeSchema.default(TeamType.PRODUCTION),
  maxMembers: z.number().int().positive().optional(),
  targetCapacity: z.number().positive().optional(),
  leadUserId: z.string().uuid().optional(),
});

export type CreateTeam = z.infer<typeof CreateTeamSchema>;

// Update team schema
export const UpdateTeamSchema = CreateTeamSchema.omit({ organizationId: true }).partial();
export type UpdateTeam = z.infer<typeof UpdateTeamSchema>;

// Add team member schema
export const AddTeamMemberSchema = z.object({
  teamId: z.string().uuid(),
  userId: z.string().uuid(),
  role: TeamMemberRoleSchema.default(TeamMemberRole.MEMBER),
  allocation: z.number().min(0).max(100).default(100),
});

export type AddTeamMember = z.infer<typeof AddTeamMemberSchema>;

// Add department member schema
export const AddDepartmentMemberSchema = z.object({
  departmentId: z.string().uuid(),
  userId: z.string().uuid(),
  role: DeptMemberRoleSchema.default(DeptMemberRole.MEMBER),
  isPrimary: z.boolean().default(false),
});

export type AddDepartmentMember = z.infer<typeof AddDepartmentMemberSchema>;

// Invite user to organization schema
export const InviteOrgUserSchema = z.object({
  organizationId: z.string().uuid(),
  email: z.string().email(),
  role: OrgUserRoleSchema.default(OrgUserRole.MEMBER),
});

export type InviteOrgUser = z.infer<typeof InviteOrgUserSchema>;

// Create organization setting schema
export const CreateOrgSettingSchema = z.object({
  organizationId: z.string().uuid(),
  category: SettingCategorySchema,
  key: z.string().min(1).max(100),
  value: z.string(),
  valueType: SettingValueTypeSchema.default(SettingValueType.STRING),
  description: z.string().optional(),
  isSecret: z.boolean().default(false),
});

export type CreateOrgSetting = z.infer<typeof CreateOrgSettingSchema>;

// Update organization setting schema
export const UpdateOrgSettingSchema = z.object({
  value: z.string(),
  description: z.string().optional(),
});

export type UpdateOrgSetting = z.infer<typeof UpdateOrgSettingSchema>;

// ============================================================================
// FINANCIAL TRACKING & COST ACCOUNTING SCHEMAS
// ============================================================================

// Cost center schemas
export const CreateCostCenterSchema = z.object({
  organizationId: z.string().uuid().optional(),
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  glAccountCode: z.string().optional(),
  glSubAccount: z.string().optional(),
  parentId: z.string().uuid().optional(),
  centerType: z.nativeEnum(CostCenterType),
  annualBudget: z.number().positive().optional(),
  budgetPeriod: z.nativeEnum(BudgetPeriod).default(BudgetPeriod.ANNUAL),
  allocationMethod: z.nativeEnum(AllocationMethod).optional(),
  allocationBasis: z.string().optional(),
  effectiveFrom: z.coerce.date().optional(),
  effectiveUntil: z.coerce.date().optional(),
});

export type CreateCostCenter = z.infer<typeof CreateCostCenterSchema>;

export const UpdateCostCenterSchema = CreateCostCenterSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type UpdateCostCenter = z.infer<typeof UpdateCostCenterSchema>;

// Material cost schemas
export const CreateMaterialCostSchema = z.object({
  workOrderId: z.string().uuid(),
  lineItemId: z.string().uuid().optional(),
  costCenterId: z.string().uuid().optional(),
  materialType: z.nativeEnum(MaterialType),
  description: z.string().min(1),
  itemMasterId: z.string().uuid().optional(),
  vendorId: z.string().uuid().optional(),
  purchaseOrderId: z.string().uuid().optional(),
  quantityUsed: z.number().positive(),
  quantityUnit: z.string().default('UNIT'),
  quantityWasted: z.number().min(0).default(0),
  wasteReason: z.string().optional(),
  unitCost: z.number().min(0),
  usedAt: z.coerce.date().optional(),
});

export type CreateMaterialCost = z.infer<typeof CreateMaterialCostSchema>;

export const UpdateMaterialCostSchema = CreateMaterialCostSchema.partial().omit({
  workOrderId: true,
});

export type UpdateMaterialCost = z.infer<typeof UpdateMaterialCostSchema>;

// Labor cost schemas
export const CreateLaborCostSchema = z.object({
  workOrderId: z.string().uuid(),
  costCenterId: z.string().uuid().optional(),
  userId: z.string().uuid(),
  station: z.nativeEnum(PrintingMethod).optional(),
  activity: z.nativeEnum(LaborActivity),
  description: z.string().optional(),
  startTime: z.coerce.date(),
  endTime: z.coerce.date().optional(),
  regularRate: z.number().min(0),
  overtimeRate: z.number().min(0).optional(),
  burdenRate: z.number().min(0).default(0),
  isBillable: z.boolean().default(true),
  billingRate: z.number().min(0).optional(),
});

export type CreateLaborCost = z.infer<typeof CreateLaborCostSchema>;

export const UpdateLaborCostSchema = CreateLaborCostSchema.partial().omit({
  workOrderId: true,
  userId: true,
});

export type UpdateLaborCost = z.infer<typeof UpdateLaborCostSchema>;

export const ApproveLaborCostSchema = z.object({
  status: z.enum([LaborCostStatus.APPROVED, LaborCostStatus.REJECTED]),
  notes: z.string().optional(),
});

export type ApproveLaborCost = z.infer<typeof ApproveLaborCostSchema>;

// Overhead allocation schemas
export const CreateOverheadAllocationSchema = z.object({
  fromCostCenterId: z.string().uuid(),
  workOrderId: z.string().uuid().optional(),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  allocationMethod: z.nativeEnum(AllocationMethod),
  allocationBasis: z.string().optional(),
  basisValue: z.number().optional(),
  totalPoolValue: z.number().optional(),
  amount: z.number(),
  category: z.nativeEnum(OverheadCategory),
});

export type CreateOverheadAllocation = z.infer<typeof CreateOverheadAllocationSchema>;

// Profitability snapshot schemas
export const CreateProfitabilitySnapshotSchema = z.object({
  entityType: z.nativeEnum(ProfitEntityType),
  entityId: z.string().uuid(),
  snapshotDate: z.coerce.date().optional(),
  periodStart: z.coerce.date().optional(),
  periodEnd: z.coerce.date().optional(),
  grossRevenue: z.number().min(0),
  discounts: z.number().min(0).default(0),
  materialCost: z.number().min(0).default(0),
  laborCost: z.number().min(0).default(0),
  outsourcedCost: z.number().min(0).default(0),
  shippingCost: z.number().min(0).default(0),
  overheadAllocation: z.number().min(0).default(0),
  estimatedProfit: z.number().optional(),
  notes: z.string().optional(),
});

export type CreateProfitabilitySnapshot = z.infer<typeof CreateProfitabilitySnapshotSchema>;

// ============================================================================
// SCHEDULING & CAPACITY PLANNING SCHEMAS
// ============================================================================

import {
  ResourceType,
  CalendarEventType,
  RecurrencePattern,
  CapacityGranularity,
  CapacityPlanStatus,
  SkillLevel,
  ScheduleConflictType,
  ConflictResolutionStatus,
} from './enums.js';

// Resource calendar event schemas
export const CreateResourceCalendarSchema = z.object({
  organizationId: z.string().uuid().optional(),
  resourceType: z.nativeEnum(ResourceType),
  resourceId: z.string().uuid(),
  resourceName: z.string(),
  title: z.string().optional(),
  eventType: z.nativeEnum(CalendarEventType),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  allDay: z.boolean().default(false),
  isRecurring: z.boolean().default(false),
  recurrencePattern: z.nativeEnum(RecurrencePattern).optional(),
  recurrenceEndDate: z.coerce.date().optional(),
  availableCapacity: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
});

export type CreateResourceCalendar = z.infer<typeof CreateResourceCalendarSchema>;

export const UpdateResourceCalendarSchema = CreateResourceCalendarSchema.partial();

export type UpdateResourceCalendar = z.infer<typeof UpdateResourceCalendarSchema>;

// Capacity plan schemas
export const CreateCapacityPlanSchema = z.object({
  organizationId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  granularity: z.nativeEnum(CapacityGranularity),
});

export type CreateCapacityPlan = z.infer<typeof CreateCapacityPlanSchema>;

export const UpdateCapacityPlanSchema = CreateCapacityPlanSchema.partial().extend({
  status: z.nativeEnum(CapacityPlanStatus).optional(),
});

export type UpdateCapacityPlan = z.infer<typeof UpdateCapacityPlanSchema>;

// Capacity period schemas
export const CreateCapacityPeriodSchema = z.object({
  planId: z.string().uuid(),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  resourceType: z.nativeEnum(ResourceType),
  resourceId: z.string().uuid(),
  station: z.nativeEnum(PrintingMethod).optional(),
  totalCapacity: z.number().min(0),
  targetUtilization: z.number().min(0).max(100).default(80),
});

export type CreateCapacityPeriod = z.infer<typeof CreateCapacityPeriodSchema>;

// Setup time schemas
export const CreateSetupTimeSchema = z.object({
  organizationId: z.string().uuid().optional(),
  resourceType: z.nativeEnum(ResourceType).default(ResourceType.EQUIPMENT),
  resourceId: z.string().uuid().optional(),
  station: z.nativeEnum(PrintingMethod),
  fromProductType: z.string().optional(),
  toProductType: z.string().optional(),
  fromMaterial: z.string().optional(),
  toMaterial: z.string().optional(),
  setupTimeMinutes: z.number().int().min(0),
  teardownTimeMinutes: z.number().int().min(0).default(0),
  cleanupTimeMinutes: z.number().int().min(0).default(0),
  minMinutes: z.number().int().min(0).optional(),
  maxMinutes: z.number().int().min(0).optional(),
  requiresOperatorSkill: z.string().optional(),
  notes: z.string().optional(),
});

export type CreateSetupTime = z.infer<typeof CreateSetupTimeSchema>;

export const UpdateSetupTimeSchema = CreateSetupTimeSchema.partial();

export type UpdateSetupTime = z.infer<typeof UpdateSetupTimeSchema>;

// Skill matrix schemas
export const CreateSkillMatrixSchema = z.object({
  userId: z.string().uuid(),
  organizationId: z.string().uuid().optional(),
  station: z.nativeEnum(PrintingMethod).optional(),
  skillCategory: z.string().min(1),
  skillName: z.string().min(1),
  skillLevel: z.nativeEnum(SkillLevel),
  certifiedDate: z.coerce.date().optional(),
  expirationDate: z.coerce.date().optional(),
  efficiencyFactor: z.number().min(0).max(3).default(1.0),
  qualityFactor: z.number().min(0).max(3).default(1.0),
  trainingRequired: z.boolean().default(false),
  trainingNotes: z.string().optional(),
  mentorId: z.string().uuid().optional(),
});

export type CreateSkillMatrix = z.infer<typeof CreateSkillMatrixSchema>;

export const UpdateSkillMatrixSchema = CreateSkillMatrixSchema.partial().omit({
  userId: true,
});

export type UpdateSkillMatrix = z.infer<typeof UpdateSkillMatrixSchema>;

// Schedule conflict schemas
export const CreateScheduleConflictSchema = z.object({
  organizationId: z.string().uuid().optional(),
  conflictType: z.nativeEnum(ScheduleConflictType),
  severity: z.nativeEnum(AlertSeverity).default(AlertSeverity.MEDIUM),
  primaryEntityType: z.string(),
  primaryEntityId: z.string().uuid(),
  secondaryEntityType: z.string().optional(),
  secondaryEntityId: z.string().uuid().optional(),
  conflictStart: z.coerce.date(),
  conflictEnd: z.coerce.date(),
  description: z.string(),
  impact: z.string().optional(),
  suggestedResolutions: z.array(z.string()).optional(),
});

export type CreateScheduleConflict = z.infer<typeof CreateScheduleConflictSchema>;

export const ResolveScheduleConflictSchema = z.object({
  resolutionMethod: z.string(),
  resolutionNotes: z.string().optional(),
});

export type ResolveScheduleConflict = z.infer<typeof ResolveScheduleConflictSchema>;

// Resource availability filter schema
export const ResourceAvailabilityFilterSchema = z.object({
  resourceType: z.nativeEnum(ResourceType).optional(),
  resourceIds: z.array(z.string().uuid()).optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  includeUnavailable: z.boolean().default(false),
});

export type ResourceAvailabilityFilter = z.infer<typeof ResourceAvailabilityFilterSchema>;

// ============================================================================
// CUSTOMER RELATIONSHIP ENHANCEMENT SCHEMAS
// ============================================================================

import {
  CustomerRelationType,
  ContactRole,
  PreferredContactMethod,
  CustomerTier,
  CommunicationChannel,
  CommunicationDirection,
  CommunicationSentiment,
} from './enums.js';

// Customer hierarchy schemas
export const CreateCustomerHierarchySchema = z.object({
  parentCustomerId: z.string().uuid(),
  childCustomerId: z.string().uuid(),
  relationType: z.nativeEnum(CustomerRelationType),
  effectiveFrom: z.coerce.date().optional(),
  effectiveUntil: z.coerce.date().optional(),
  isPrimary: z.boolean().default(true),
  inheritBilling: z.boolean().default(false),
  inheritPricing: z.boolean().default(false),
  inheritTerms: z.boolean().default(false),
  notes: z.string().optional(),
});

export type CreateCustomerHierarchy = z.infer<typeof CreateCustomerHierarchySchema>;

export const UpdateCustomerHierarchySchema = CreateCustomerHierarchySchema.partial().omit({
  parentCustomerId: true,
  childCustomerId: true,
});

export type UpdateCustomerHierarchy = z.infer<typeof UpdateCustomerHierarchySchema>;

// Contact person schemas
export const CreateContactPersonSchema = z.object({
  customerId: z.string().uuid(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  fax: z.string().optional(),
  role: z.nativeEnum(ContactRole).default(ContactRole.PRIMARY),
  jobTitle: z.string().optional(),
  department: z.string().optional(),
  preferredContactMethod: z.nativeEnum(PreferredContactMethod).default(PreferredContactMethod.EMAIL),
  timezone: z.string().optional(),
  language: z.string().default('en'),
  hasPortalAccess: z.boolean().default(false),
  receiveOrderUpdates: z.boolean().default(true),
  receiveProofApprovals: z.boolean().default(true),
  receiveInvoices: z.boolean().default(false),
  receiveMarketing: z.boolean().default(false),
  isPrimary: z.boolean().default(false),
  notes: z.string().optional(),
});

export type CreateContactPerson = z.infer<typeof CreateContactPersonSchema>;

export const UpdateContactPersonSchema = CreateContactPersonSchema.partial().omit({
  customerId: true,
});

export type UpdateContactPerson = z.infer<typeof UpdateContactPersonSchema>;

// Customer preference schemas
export const CreateCustomerPreferenceSchema = z.object({
  customerId: z.string().uuid(),
  defaultPriority: z.number().int().min(1).max(5).optional(),
  defaultPaymentTerms: z.string().optional(),
  defaultShippingMethod: z.string().optional(),
  defaultCarrier: z.nativeEnum(Carrier).optional(),
  defaultRouting: z.array(z.nativeEnum(PrintingMethod)).default([]),
  brandGuidelinesUrl: z.string().url().optional(),
  logoUrl: z.string().url().optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  defaultFont: z.string().optional(),
  requiresProofApproval: z.boolean().default(true),
  proofApprovalEmails: z.array(z.string().email()).default([]),
  artworkFormat: z.string().optional(),
  minimumDPI: z.number().int().min(72).optional(),
  colorProfile: z.string().optional(),
  shipCompleteOnly: z.boolean().default(false),
  allowPartialShip: z.boolean().default(true),
  requireSignature: z.boolean().default(false),
  liftgateRequired: z.boolean().default(false),
  residentialDelivery: z.boolean().default(false),
  packingInstructions: z.string().optional(),
  labelingRequirements: z.string().optional(),
  specialHandling: z.string().optional(),
  orderConfirmationRequired: z.boolean().default(true),
  shipmentNotificationRequired: z.boolean().default(true),
  invoiceDeliveryMethod: z.enum(['email', 'portal', 'mail']).optional(),
});

export type CreateCustomerPreference = z.infer<typeof CreateCustomerPreferenceSchema>;

export const UpdateCustomerPreferenceSchema = CreateCustomerPreferenceSchema.partial().omit({
  customerId: true,
});

export type UpdateCustomerPreference = z.infer<typeof UpdateCustomerPreferenceSchema>;

// Customer communication log schemas
export const CreateCustomerCommunicationLogSchema = z.object({
  customerId: z.string().uuid(),
  contactPersonId: z.string().uuid().optional(),
  channel: z.nativeEnum(CommunicationChannel),
  direction: z.nativeEnum(CommunicationDirection),
  subject: z.string().optional(),
  summary: z.string().min(1),
  content: z.string().optional(),
  workOrderId: z.string().uuid().optional(),
  quoteId: z.string().uuid().optional(),
  invoiceId: z.string().uuid().optional(),
  ticketId: z.string().uuid().optional(),
  externalId: z.string().optional(),
  duration: z.number().int().min(0).optional(),
  sentiment: z.nativeEnum(CommunicationSentiment).optional(),
  sentimentScore: z.number().min(-1).max(1).optional(),
  keyPhrases: z.array(z.string()).default([]),
  topics: z.array(z.string()).default([]),
  requiresFollowUp: z.boolean().default(false),
  followUpDate: z.coerce.date().optional(),
  followUpAssignedTo: z.string().uuid().optional(),
});

export type CreateCustomerCommunicationLog = z.infer<typeof CreateCustomerCommunicationLogSchema>;

// Customer tier filter schema
export const CustomerTierFilterSchema = z.object({
  tier: z.nativeEnum(CustomerTier).optional(),
  minScore: z.number().min(0).max(100).optional(),
  maxScore: z.number().min(0).max(100).optional(),
  daysSinceLastOrderMin: z.number().int().min(0).optional(),
  daysSinceLastOrderMax: z.number().int().min(0).optional(),
  minLifetimeValue: z.number().min(0).optional(),
  hasChurnRisk: z.boolean().optional(),
});

export type CustomerTierFilter = z.infer<typeof CustomerTierFilterSchema>;

// ============================================================================
// INVENTORY & SUPPLY CHAIN INTELLIGENCE SCHEMAS
// ============================================================================

import {
  ForecastMethod,
  ForecastStatus,
  ForecastGranularity,
  SupplierTier,
  SubstitutionType,
  InventoryTransactionType,
  ReservationStatus,
} from './enums.js';

// Demand forecast schemas
export const CreateDemandForecastSchema = z.object({
  organizationId: z.string().uuid().optional(),
  itemMasterId: z.string().uuid().optional(),
  materialCategory: z.string().optional(),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  granularity: z.nativeEnum(ForecastGranularity),
  forecastQuantity: z.number().min(0),
  minQuantity: z.number().min(0).optional(),
  maxQuantity: z.number().min(0).optional(),
  confidenceLevel: z.number().min(0).max(100).optional(),
  forecastMethod: z.nativeEnum(ForecastMethod),
  historicalPeriods: z.number().int().min(1).optional(),
});

export type CreateDemandForecast = z.infer<typeof CreateDemandForecastSchema>;

export const UpdateDemandForecastSchema = CreateDemandForecastSchema.partial().extend({
  status: z.nativeEnum(ForecastStatus).optional(),
  actualQuantity: z.number().min(0).optional(),
});

export type UpdateDemandForecast = z.infer<typeof UpdateDemandForecastSchema>;

// Reorder point schemas
export const CreateReorderPointSchema = z.object({
  organizationId: z.string().uuid().optional(),
  itemMasterId: z.string().uuid(),
  minQuantity: z.number().min(0),
  reorderQuantity: z.number().min(0),
  maxQuantity: z.number().min(0).optional(),
  isDynamic: z.boolean().default(false),
  leadTimeDays: z.number().int().min(0).default(7),
  safetyStockDays: z.number().int().min(0).default(3),
  preferredSupplierId: z.string().uuid().optional(),
  alternateSupplierIds: z.array(z.string().uuid()).default([]),
});

export type CreateReorderPoint = z.infer<typeof CreateReorderPointSchema>;

export const UpdateReorderPointSchema = CreateReorderPointSchema.partial().omit({
  itemMasterId: true,
});

export type UpdateReorderPoint = z.infer<typeof UpdateReorderPointSchema>;

// Material substitution schemas
export const CreateMaterialSubstitutionSchema = z.object({
  organizationId: z.string().uuid().optional(),
  primaryItemId: z.string().uuid(),
  substituteItemId: z.string().uuid(),
  substitutionType: z.nativeEnum(SubstitutionType),
  conversionFactor: z.number().min(0).default(1.0),
  maxSubstituteQty: z.number().min(0).optional(),
  requiresApproval: z.boolean().default(false),
  approvalThreshold: z.number().min(0).optional(),
  costDifference: z.number().optional(),
  qualityImpact: z.string().optional(),
  notes: z.string().optional(),
});

export type CreateMaterialSubstitution = z.infer<typeof CreateMaterialSubstitutionSchema>;

export const UpdateMaterialSubstitutionSchema = CreateMaterialSubstitutionSchema.partial().omit({
  primaryItemId: true,
  substituteItemId: true,
});

export type UpdateMaterialSubstitution = z.infer<typeof UpdateMaterialSubstitutionSchema>;

// Inventory transaction schemas
export const CreateInventoryTransactionSchema = z.object({
  organizationId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  itemMasterId: z.string().uuid(),
  transactionType: z.nativeEnum(InventoryTransactionType),
  transactionDate: z.coerce.date().optional(),
  quantity: z.number(),
  unitCost: z.number().min(0).optional(),
  referenceType: z.string().optional(),
  referenceId: z.string().uuid().optional(),
  referenceNumber: z.string().optional(),
  fromLocationId: z.string().uuid().optional(),
  toLocationId: z.string().uuid().optional(),
  lotNumber: z.string().optional(),
  batchNumber: z.string().optional(),
  expirationDate: z.coerce.date().optional(),
  serialNumbers: z.array(z.string()).default([]),
  inspectionRequired: z.boolean().default(false),
  reasonCode: z.string().optional(),
  notes: z.string().optional(),
});

export type CreateInventoryTransaction = z.infer<typeof CreateInventoryTransactionSchema>;

// Inventory reservation schemas
export const CreateInventoryReservationSchema = z.object({
  organizationId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  itemMasterId: z.string().uuid(),
  workOrderId: z.string().uuid().optional(),
  quoteId: z.string().uuid().optional(),
  lineItemId: z.string().uuid().optional(),
  quantity: z.number().min(0),
  expiresAt: z.coerce.date().optional(),
});

export type CreateInventoryReservation = z.infer<typeof CreateInventoryReservationSchema>;

export const UpdateInventoryReservationSchema = z.object({
  quantity: z.number().min(0).optional(),
  expiresAt: z.coerce.date().optional(),
  status: z.nativeEnum(ReservationStatus).optional(),
});

export type UpdateInventoryReservation = z.infer<typeof UpdateInventoryReservationSchema>;

// Inventory filter schema
export const InventoryFilterSchema = z.object({
  itemMasterId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  transactionType: z.nativeEnum(InventoryTransactionType).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  lotNumber: z.string().optional(),
  referenceType: z.string().optional(),
  referenceId: z.string().uuid().optional(),
});

export type InventoryFilter = z.infer<typeof InventoryFilterSchema>;

// ============================================================================
// QUALITY MANAGEMENT SCHEMAS
// ============================================================================

// Quality criterion schema (used in QualityStandard criteria array)
export const QualityCriterionSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  target: z.number().optional(),
  unit: z.string().optional(),
  isCritical: z.boolean().optional(),
});

// QualityCriterion type is exported from types.ts

// Quality Standard schemas
export const CreateQualityStandardSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  version: z.string().optional().default('1.0'),
  standardType: z.nativeEnum(QualityStandardType),
  category: z.string().optional(),
  applicableTo: z.string().optional(),
  criteria: z.array(QualityCriterionSchema).min(1),
  samplingMethod: z.nativeEnum(SamplingMethod).optional().default(SamplingMethod.RANDOM),
  sampleSize: z.number().int().positive().optional(),
  aqlLevel: z.number().min(0).max(100).optional(),
  status: z.nativeEnum(StandardStatus).optional().default(StandardStatus.DRAFT),
  effectiveDate: z.coerce.date().optional(),
  expiryDate: z.coerce.date().optional(),
  referenceStandards: z.array(z.string()).optional(),
});

export type CreateQualityStandard = z.infer<typeof CreateQualityStandardSchema>;

export const UpdateQualityStandardSchema = CreateQualityStandardSchema.partial();
export type UpdateQualityStandard = z.infer<typeof UpdateQualityStandardSchema>;

// Inspection measurement schema
export const InspectionMeasurementSchema = z.object({
  criterion: z.string().min(1),
  value: z.union([z.number(), z.string()]),
  unit: z.string().optional(),
  passed: z.boolean(),
  notes: z.string().optional(),
});

// InspectionMeasurement type is exported from types.ts

// Inspection Checkpoint schemas
export const CreateInspectionCheckpointSchema = z.object({
  workOrderId: z.string().uuid().optional(),
  standardId: z.string().uuid().optional(),
  stationId: z.string().optional(),
  checkpointType: z.nativeEnum(CheckpointType),
  sequenceNumber: z.number().int().nonnegative(),
  name: z.string().min(1).max(200),
  scheduledAt: z.coerce.date().optional(),
  inspectorId: z.string().uuid().optional(),
});

export type CreateInspectionCheckpoint = z.infer<typeof CreateInspectionCheckpointSchema>;

export const UpdateInspectionCheckpointSchema = z.object({
  startedAt: z.coerce.date().optional(),
  completedAt: z.coerce.date().optional(),
  inspectorId: z.string().uuid().optional(),
  result: z.nativeEnum(InspectionResult).optional(),
  measurements: z.array(InspectionMeasurementSchema).optional(),
  passedCount: z.number().int().nonnegative().optional(),
  failedCount: z.number().int().nonnegative().optional(),
  totalChecked: z.number().int().nonnegative().optional(),
  notes: z.string().optional(),
  photoUrls: z.array(z.string().url()).optional(),
  disposition: z.nativeEnum(InspectionDisposition).optional(),
  dispositionNote: z.string().optional(),
});

export type UpdateInspectionCheckpoint = z.infer<typeof UpdateInspectionCheckpointSchema>;

// Non-Conformance Report schemas
export const CreateNCRSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  workOrderId: z.string().uuid().optional(),
  inspectionId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  category: z.nativeEnum(NCRCategory),
  severity: z.nativeEnum(NCRSeverity).optional().default(NCRSeverity.MINOR),
  source: z.nativeEnum(NCRSource),
  defectType: z.string().optional(),
  defectLocation: z.string().optional(),
  quantityAffected: z.number().int().positive().optional().default(1),
  lotNumber: z.string().optional(),
  estimatedCost: z.number().nonnegative().optional(),
  photoUrls: z.array(z.string().url()).optional(),
  documentUrls: z.array(z.string().url()).optional(),
});

export type CreateNCR = z.infer<typeof CreateNCRSchema>;

export const UpdateNCRSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).optional(),
  assignedToId: z.string().uuid().optional(),
  category: z.nativeEnum(NCRCategory).optional(),
  severity: z.nativeEnum(NCRSeverity).optional(),
  status: z.nativeEnum(NCRStatus).optional(),
  disposition: z.nativeEnum(NCRDisposition).optional(),
  dispositionNote: z.string().optional(),
  actualCost: z.number().nonnegative().optional(),
  costCategory: z.string().optional(),
  rootCauseCategory: z.string().optional(),
  rootCauseDetail: z.string().optional(),
  photoUrls: z.array(z.string().url()).optional(),
  documentUrls: z.array(z.string().url()).optional(),
});

export type UpdateNCR = z.infer<typeof UpdateNCRSchema>;

// Corrective Action schemas
export const CreateCorrectiveActionSchema = z.object({
  title: z.string().min(1).max(200),
  ncrId: z.string().uuid().optional(),
  actionType: z.nativeEnum(CorrectiveActionType),
  priority: z.nativeEnum(CorrectiveActionPriority).optional().default(CorrectiveActionPriority.MEDIUM),
  problemStatement: z.string().min(1),
  immediateAction: z.string().optional(),
  immediateActionDate: z.coerce.date().optional(),
  assignedToId: z.string().uuid().optional(),
  plannedCompletionDate: z.coerce.date().optional(),
});

export type CreateCorrectiveAction = z.infer<typeof CreateCorrectiveActionSchema>;

export const UpdateCorrectiveActionSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  priority: z.nativeEnum(CorrectiveActionPriority).optional(),
  status: z.nativeEnum(CAStatus).optional(),
  assignedToId: z.string().uuid().optional(),
  rootCauseMethod: z.nativeEnum(RootCauseMethod).optional(),
  rootCauseAnalysis: z.string().optional(),
  rootCauseCategory: z.string().optional(),
  correctiveAction: z.string().optional(),
  plannedCompletionDate: z.coerce.date().optional(),
  actualCompletionDate: z.coerce.date().optional(),
  preventiveAction: z.string().optional(),
  preventiveActionDate: z.coerce.date().optional(),
  verificationMethod: z.string().optional(),
  verificationResult: z.string().optional(),
  effectivenessReviewDate: z.coerce.date().optional(),
  effectivenessResult: z.nativeEnum(EffectivenessResult).optional(),
  effectivenessNotes: z.string().optional(),
  implementationCost: z.number().nonnegative().optional(),
});

export type UpdateCorrectiveAction = z.infer<typeof UpdateCorrectiveActionSchema>;

// Quality Metric schemas
export const CreateQualityMetricSchema = z.object({
  metricCode: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  standardId: z.string().uuid().optional(),
  stationId: z.string().optional(),
  category: z.string().optional(),
  measurementType: z.nativeEnum(QualityMeasurementType),
  unit: z.string().optional(),
  targetValue: z.number().optional(),
  lowerLimit: z.number().optional(),
  upperLimit: z.number().optional(),
  lowerSpec: z.number().optional(),
  upperSpec: z.number().optional(),
  sampleSize: z.number().int().positive().optional().default(1),
  calculationMethod: z.string().optional(),
  enableSPC: z.boolean().optional().default(false),
  chartType: z.nativeEnum(SPCChartType).optional(),
});

export type CreateQualityMetric = z.infer<typeof CreateQualityMetricSchema>;

export const UpdateQualityMetricSchema = CreateQualityMetricSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type UpdateQualityMetric = z.infer<typeof UpdateQualityMetricSchema>;

// Quality Observation schemas
export const CreateQualityObservationSchema = z.object({
  metricId: z.string().uuid(),
  workOrderId: z.string().uuid().optional(),
  lotNumber: z.string().optional(),
  sampleNumber: z.number().int().optional(),
  value: z.number(),
  notes: z.string().optional(),
});

export type CreateQualityObservation = z.infer<typeof CreateQualityObservationSchema>;

// Quality filter schemas
export const QualityStandardFilterSchema = z.object({
  standardType: z.nativeEnum(QualityStandardType).optional(),
  status: z.nativeEnum(StandardStatus).optional(),
  category: z.string().optional(),
  search: z.string().optional(),
});

export type QualityStandardFilter = z.infer<typeof QualityStandardFilterSchema>;

export const InspectionFilterSchema = z.object({
  workOrderId: z.string().uuid().optional(),
  standardId: z.string().uuid().optional(),
  checkpointType: z.nativeEnum(CheckpointType).optional(),
  result: z.nativeEnum(InspectionResult).optional(),
  inspectorId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export type InspectionFilter = z.infer<typeof InspectionFilterSchema>;

export const NCRFilterSchema = z.object({
  workOrderId: z.string().uuid().optional(),
  category: z.nativeEnum(NCRCategory).optional(),
  severity: z.nativeEnum(NCRSeverity).optional(),
  status: z.nativeEnum(NCRStatus).optional(),
  source: z.nativeEnum(NCRSource).optional(),
  assignedToId: z.string().uuid().optional(),
  reportedById: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  search: z.string().optional(),
});

export type NCRFilter = z.infer<typeof NCRFilterSchema>;

export const CorrectiveActionFilterSchema = z.object({
  ncrId: z.string().uuid().optional(),
  actionType: z.nativeEnum(CorrectiveActionType).optional(),
  priority: z.nativeEnum(CorrectiveActionPriority).optional(),
  status: z.nativeEnum(CAStatus).optional(),
  assignedToId: z.string().uuid().optional(),
  overdue: z.boolean().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export type CorrectiveActionFilter = z.infer<typeof CorrectiveActionFilterSchema>;

// ============================================================================
// DOCUMENT MANAGEMENT SCHEMAS
// ============================================================================

// Document Version schemas
export const CreateDocumentVersionSchema = z.object({
  documentId: z.string().uuid(),
  versionLabel: z.string().max(50).optional(),
  fileName: z.string().min(1),
  fileUrl: z.string().url(),
  fileSize: z.number().int().positive(),
  mimeType: z.string().min(1),
  checksum: z.string().optional(),
  changeNotes: z.string().optional(),
  changedFields: z.array(z.string()).optional(),
  status: z.nativeEnum(DocumentVersionStatus).optional().default(DocumentVersionStatus.DRAFT),
});

export type CreateDocumentVersion = z.infer<typeof CreateDocumentVersionSchema>;

export const UpdateDocumentVersionSchema = z.object({
  versionLabel: z.string().max(50).optional(),
  changeNotes: z.string().optional(),
  status: z.nativeEnum(DocumentVersionStatus).optional(),
  isCurrentVersion: z.boolean().optional(),
});

export type UpdateDocumentVersion = z.infer<typeof UpdateDocumentVersionSchema>;

// Template placeholder schema
export const TemplatePlaceholderSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['text', 'number', 'date', 'boolean', 'list', 'image']),
  required: z.boolean(),
  defaultValue: z.string().optional(),
  description: z.string().optional(),
  validation: z.string().optional(),
});

// TemplatePlaceholder type is exported from types.ts

// Document Template schemas
export const CreateDocumentTemplateSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  category: z.string().min(1),  // DocumentCategory
  subcategory: z.string().optional(),
  templateType: z.nativeEnum(TemplateType),
  templateUrl: z.string().url().optional(),
  templateContent: z.string().optional(),
  placeholders: z.array(TemplatePlaceholderSchema).optional(),
  outputFormat: z.string().optional().default('pdf'),
  paperSize: z.string().optional().default('letter'),
  orientation: z.enum(['portrait', 'landscape']).optional().default('portrait'),
  isDefault: z.boolean().optional().default(false),
});

export type CreateDocumentTemplate = z.infer<typeof CreateDocumentTemplateSchema>;

export const UpdateDocumentTemplateSchema = CreateDocumentTemplateSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type UpdateDocumentTemplate = z.infer<typeof UpdateDocumentTemplateSchema>;

// Document Approval schemas
export const CreateDocumentApprovalSchema = z.object({
  documentVersionId: z.string().uuid(),
  approvalLevel: z.number().int().positive().optional().default(1),
  approvalType: z.nativeEnum(ApprovalType).optional().default(ApprovalType.REVIEW),
  approverId: z.string().uuid(),
  dueDate: z.coerce.date().optional(),
});

export type CreateDocumentApproval = z.infer<typeof CreateDocumentApprovalSchema>;

export const UpdateDocumentApprovalSchema = z.object({
  decision: z.nativeEnum(ApprovalDecision).optional(),
  comments: z.string().optional(),
  delegatedToId: z.string().uuid().optional(),
  delegationReason: z.string().optional(),
});

export type UpdateDocumentApproval = z.infer<typeof UpdateDocumentApprovalSchema>;

// Document Tag schemas
export const CreateDocumentTagSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  parentId: z.string().uuid().optional(),
});

export type CreateDocumentTag = z.infer<typeof CreateDocumentTagSchema>;

export const UpdateDocumentTagSchema = CreateDocumentTagSchema.partial();
export type UpdateDocumentTag = z.infer<typeof UpdateDocumentTagSchema>;

// Document Access schemas
export const CreateDocumentAccessSchema = z.object({
  documentId: z.string().uuid(),
  accessType: z.nativeEnum(DocumentAccessType),
  userId: z.string().uuid().optional(),
  role: z.string().optional(),
  canView: z.boolean().optional().default(true),
  canDownload: z.boolean().optional().default(true),
  canEdit: z.boolean().optional().default(false),
  canDelete: z.boolean().optional().default(false),
  canShare: z.boolean().optional().default(false),
  canApprove: z.boolean().optional().default(false),
  validFrom: z.coerce.date().optional(),
  validUntil: z.coerce.date().optional(),
});

export type CreateDocumentAccess = z.infer<typeof CreateDocumentAccessSchema>;

export const UpdateDocumentAccessSchema = z.object({
  canView: z.boolean().optional(),
  canDownload: z.boolean().optional(),
  canEdit: z.boolean().optional(),
  canDelete: z.boolean().optional(),
  canShare: z.boolean().optional(),
  canApprove: z.boolean().optional(),
  validUntil: z.coerce.date().optional(),
});

export type UpdateDocumentAccess = z.infer<typeof UpdateDocumentAccessSchema>;

// Document filter schemas
export const DocumentVersionFilterSchema = z.object({
  documentId: z.string().uuid().optional(),
  status: z.nativeEnum(DocumentVersionStatus).optional(),
  isCurrentVersion: z.boolean().optional(),
  createdById: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export type DocumentVersionFilter = z.infer<typeof DocumentVersionFilterSchema>;

export const DocumentTemplateFilterSchema = z.object({
  category: z.string().optional(),
  templateType: z.nativeEnum(TemplateType).optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  search: z.string().optional(),
});

export type DocumentTemplateFilter = z.infer<typeof DocumentTemplateFilterSchema>;

export const DocumentApprovalFilterSchema = z.object({
  documentVersionId: z.string().uuid().optional(),
  approverId: z.string().uuid().optional(),
  approvalType: z.nativeEnum(ApprovalType).optional(),
  status: z.nativeEnum(ApprovalStatus).optional(),
  decision: z.nativeEnum(ApprovalDecision).optional(),
  overdue: z.boolean().optional(),
});

export type DocumentApprovalFilter = z.infer<typeof DocumentApprovalFilterSchema>;

// ============================================================================
// PERFORMANCE & ANALYTICS SCHEMAS
// ============================================================================

// Daily Metric Snapshot schemas
export const CreateDailyMetricSnapshotSchema = z.object({
  date: z.coerce.date(),
  metricType: z.nativeEnum(MetricSnapshotType),
  scopeType: z.nativeEnum(MetricScopeType),
  scopeId: z.string().optional(),
  
  // Order metrics
  ordersReceived: z.number().int().nonnegative().optional(),
  ordersCompleted: z.number().int().nonnegative().optional(),
  ordersShipped: z.number().int().nonnegative().optional(),
  ordersCancelled: z.number().int().nonnegative().optional(),
  ordersOnHold: z.number().int().nonnegative().optional(),
  ordersInProgress: z.number().int().nonnegative().optional(),
  orderBacklog: z.number().int().nonnegative().optional(),
  
  // Financial metrics
  revenueTotal: z.number().nonnegative().optional(),
  revenueCompleted: z.number().nonnegative().optional(),
  costTotal: z.number().nonnegative().optional(),
  profitMargin: z.number().min(-100).max(100).optional(),
  
  // Production metrics
  unitsProduced: z.number().int().nonnegative().optional(),
  sqftProduced: z.number().nonnegative().optional(),
  hoursWorked: z.number().nonnegative().optional(),
  productiveHours: z.number().nonnegative().optional(),
  
  // Efficiency metrics
  utilization: z.number().min(0).max(100).optional(),
  efficiency: z.number().min(0).optional(),
  firstPassYield: z.number().min(0).max(100).optional(),
  
  // Lead time metrics
  avgLeadTime: z.number().nonnegative().optional(),
  minLeadTime: z.number().nonnegative().optional(),
  maxLeadTime: z.number().nonnegative().optional(),
  p50LeadTime: z.number().nonnegative().optional(),
  p90LeadTime: z.number().nonnegative().optional(),
  
  // Customer metrics
  newCustomers: z.number().int().nonnegative().optional(),
  repeatOrders: z.number().int().nonnegative().optional(),
  customerComplaints: z.number().int().nonnegative().optional(),
});

export type CreateDailyMetricSnapshot = z.infer<typeof CreateDailyMetricSnapshotSchema>;

// Station Throughput schemas
export const CreateStationThroughputSchema = z.object({
  stationId: z.string().min(1),
  date: z.coerce.date(),
  periodType: z.nativeEnum(ThroughputPeriod).optional().default(ThroughputPeriod.HOURLY),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  
  // Volume metrics
  ordersCompleted: z.number().int().nonnegative().optional(),
  itemsCompleted: z.number().int().nonnegative().optional(),
  unitsCompleted: z.number().int().nonnegative().optional(),
  sqftCompleted: z.number().nonnegative().optional(),
  
  // Time metrics
  availableMinutes: z.number().int().nonnegative().optional(),
  productiveMinutes: z.number().int().nonnegative().optional(),
  downtimeMinutes: z.number().int().nonnegative().optional(),
  setupMinutes: z.number().int().nonnegative().optional(),
  
  // Rate metrics
  throughputRate: z.number().nonnegative().optional(),
  cycleTime: z.number().nonnegative().optional(),
  
  // Quality
  defectCount: z.number().int().nonnegative().optional(),
  reworkCount: z.number().int().nonnegative().optional(),
  scrapCount: z.number().int().nonnegative().optional(),
  
  // Queue
  queueSizeStart: z.number().int().nonnegative().optional(),
  queueSizeEnd: z.number().int().nonnegative().optional(),
  avgQueueSize: z.number().nonnegative().optional(),
});

export type CreateStationThroughput = z.infer<typeof CreateStationThroughputSchema>;

// Bottleneck Event schemas
export const CreateBottleneckEventSchema = z.object({
  stationId: z.string().min(1),
  resourceType: z.nativeEnum(BottleneckResource),
  resourceId: z.string().optional(),
  bottleneckType: z.nativeEnum(BottleneckType),
  severity: z.nativeEnum(BottleneckSeverity),
  queueDepth: z.number().int().nonnegative().optional(),
  waitTimeMinutes: z.number().nonnegative().optional(),
  affectedOrderCount: z.number().int().nonnegative().optional(),
  thresholdExceeded: z.number().optional(),
  currentValue: z.number().optional(),
  estimatedDelay: z.number().optional(),
  revenueAtRisk: z.number().nonnegative().optional(),
  detectionMethod: z.string().optional(),
  autoDetected: z.boolean().optional().default(true),
});

export type CreateBottleneckEvent = z.infer<typeof CreateBottleneckEventSchema>;

export const UpdateBottleneckEventSchema = z.object({
  resolvedAt: z.coerce.date().optional(),
  resolutionType: z.nativeEnum(BottleneckResolution).optional(),
  resolutionNotes: z.string().optional(),
});

export type UpdateBottleneckEvent = z.infer<typeof UpdateBottleneckEventSchema>;

// User Productivity schemas
export const CreateUserProductivitySchema = z.object({
  userId: z.string().uuid(),
  date: z.coerce.date(),
  periodType: z.nativeEnum(ProductivityPeriod).optional().default(ProductivityPeriod.DAILY),
  
  // Time metrics
  scheduledHours: z.number().nonnegative().optional(),
  clockedHours: z.number().nonnegative().optional(),
  productiveHours: z.number().nonnegative().optional(),
  indirectHours: z.number().nonnegative().optional(),
  breakHours: z.number().nonnegative().optional(),
  
  // Output metrics
  ordersWorked: z.number().int().nonnegative().optional(),
  ordersCompleted: z.number().int().nonnegative().optional(),
  itemsCompleted: z.number().int().nonnegative().optional(),
  unitsCompleted: z.number().int().nonnegative().optional(),
  sqftCompleted: z.number().nonnegative().optional(),
  
  // Quality metrics
  defectsCreated: z.number().int().nonnegative().optional(),
  reworkRequired: z.number().int().nonnegative().optional(),
});

export type CreateUserProductivity = z.infer<typeof CreateUserProductivitySchema>;

// Performance Goal schemas
export const CreatePerformanceGoalSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  goalType: z.nativeEnum(GoalType),
  scopeType: z.nativeEnum(MetricScopeType),
  scopeId: z.string().optional(),
  metricName: z.string().min(1),
  metricUnit: z.string().optional(),
  targetValue: z.number(),
  targetDirection: z.nativeEnum(GoalDirection),
  periodType: z.nativeEnum(GoalPeriod),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  warningThreshold: z.number().optional(),
  criticalThreshold: z.number().optional(),
});

export type CreatePerformanceGoal = z.infer<typeof CreatePerformanceGoalSchema>;

export const UpdatePerformanceGoalSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  targetValue: z.number().optional(),
  currentValue: z.number().optional(),
  status: z.nativeEnum(GoalStatus).optional(),
  warningThreshold: z.number().optional(),
  criticalThreshold: z.number().optional(),
});

export type UpdatePerformanceGoal = z.infer<typeof UpdatePerformanceGoalSchema>;

// Analytics filter schemas
export const MetricSnapshotFilterSchema = z.object({
  metricType: z.nativeEnum(MetricSnapshotType).optional(),
  scopeType: z.nativeEnum(MetricScopeType).optional(),
  scopeId: z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export type MetricSnapshotFilter = z.infer<typeof MetricSnapshotFilterSchema>;

export const ThroughputFilterSchema = z.object({
  stationId: z.string().optional(),
  periodType: z.nativeEnum(ThroughputPeriod).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export type ThroughputFilter = z.infer<typeof ThroughputFilterSchema>;

export const BottleneckFilterSchema = z.object({
  stationId: z.string().optional(),
  resourceType: z.nativeEnum(BottleneckResource).optional(),
  bottleneckType: z.nativeEnum(BottleneckType).optional(),
  severity: z.nativeEnum(BottleneckSeverity).optional(),
  resolved: z.boolean().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export type BottleneckFilter = z.infer<typeof BottleneckFilterSchema>;

export const ProductivityFilterSchema = z.object({
  userId: z.string().uuid().optional(),
  periodType: z.nativeEnum(ProductivityPeriod).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export type ProductivityFilter = z.infer<typeof ProductivityFilterSchema>;

export const GoalFilterSchema = z.object({
  goalType: z.nativeEnum(GoalType).optional(),
  scopeType: z.nativeEnum(MetricScopeType).optional(),
  scopeId: z.string().optional(),
  status: z.nativeEnum(GoalStatus).optional(),
  periodType: z.nativeEnum(GoalPeriod).optional(),
});

export type GoalFilter = z.infer<typeof GoalFilterSchema>;

// ============================================================================
// SSS-019: ADVANCED QUALITY ASSURANCE SYSTEM SCHEMAS
// ============================================================================

import {
  DefectSeverity,
  DefectDisposition,
  DefectSource,
  EvidenceType,
  RootCauseCategoryQC,
  SupplierQualityTier,
  FeedbackType,
  FeedbackStatus,
  QualityTrendType,
} from './enums.js';

// ----- Defect Category Schemas -----

export const CreateDefectCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required'),
  description: z.string().optional(),
  parentId: z.string().uuid().optional(),
  defaultSeverity: z.nativeEnum(DefectSeverity).optional(),
  applicableStations: z.array(z.string()).optional(),
  standardReworkMinutes: z.number().int().positive().optional(),
  sortOrder: z.number().int().default(0),
});

export type CreateDefectCategory = z.infer<typeof CreateDefectCategorySchema>;

export const UpdateDefectCategorySchema = CreateDefectCategorySchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type UpdateDefectCategory = z.infer<typeof UpdateDefectCategorySchema>;

// ----- Defect Schemas -----

export const CreateDefectSchema = z.object({
  workOrderId: z.string().uuid('Valid work order ID required'),
  inspectionId: z.string().uuid().optional(),
  categoryId: z.string().uuid('Valid defect category required'),
  severity: z.nativeEnum(DefectSeverity).default(DefectSeverity.MINOR),
  source: z.nativeEnum(DefectSource).default(DefectSource.IN_PROCESS),
  description: z.string().min(1, 'Description is required'),
  location: z.string().optional(),
  quantity: z.number().int().positive().default(1),
  station: z.string().optional(),
});

export type CreateDefect = z.infer<typeof CreateDefectSchema>;

export const UpdateDefectSchema = z.object({
  categoryId: z.string().uuid().optional(),
  severity: z.nativeEnum(DefectSeverity).optional(),
  description: z.string().min(1).optional(),
  location: z.string().optional(),
  quantity: z.number().int().positive().optional(),
});

export type UpdateDefect = z.infer<typeof UpdateDefectSchema>;

export const DispositionDefectSchema = z.object({
  disposition: z.nativeEnum(DefectDisposition),
  dispositionNotes: z.string().optional(),
  laborCostImpact: z.number().nonnegative().optional(),
  materialCostImpact: z.number().nonnegative().optional(),
});

export type DispositionDefect = z.infer<typeof DispositionDefectSchema>;

// ----- QC Evidence Schemas -----

export const CreateQCEvidenceSchema = z.object({
  defectId: z.string().uuid().optional(),
  inspectionResultId: z.string().uuid().optional(),
  type: z.nativeEnum(EvidenceType).default(EvidenceType.PHOTO),
  fileUrl: z.string().url('Valid file URL required'),
  fileName: z.string().min(1, 'File name required'),
  fileSize: z.number().int().positive().optional(),
  mimeType: z.string().optional(),
  caption: z.string().optional(),
  takenAt: z.coerce.date().optional(),
  gpsLatitude: z.number().min(-90).max(90).optional(),
  gpsLongitude: z.number().min(-180).max(180).optional(),
  deviceInfo: z.string().optional(),
});

export type CreateQCEvidence = z.infer<typeof CreateQCEvidenceSchema>;

// ----- Root Cause Analysis Schemas -----

export const CreateRootCauseAnalysisSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  category: z.nativeEnum(RootCauseCategoryQC).default(RootCauseCategoryQC.UNKNOWN),
  
  // 5 Whys
  why1: z.string().optional(),
  why2: z.string().optional(),
  why3: z.string().optional(),
  why4: z.string().optional(),
  why5: z.string().optional(),
  
  // Fishbone
  manContributor: z.string().optional(),
  machineContributor: z.string().optional(),
  materialContributor: z.string().optional(),
  methodContributor: z.string().optional(),
  measurementContributor: z.string().optional(),
  environmentContributor: z.string().optional(),
  
  rootCauseStatement: z.string().optional(),
});

export type CreateRootCauseAnalysis = z.infer<typeof CreateRootCauseAnalysisSchema>;

export const UpdateRootCauseAnalysisSchema = CreateRootCauseAnalysisSchema.partial();

export type UpdateRootCauseAnalysis = z.infer<typeof UpdateRootCauseAnalysisSchema>;

// ----- Supplier Quality Schemas -----

export const CreateSupplierQualityScoreSchema = z.object({
  vendorId: z.string().uuid().optional(),
  supplierName: z.string().min(1, 'Supplier name required'),
  tier: z.nativeEnum(SupplierQualityTier).default(SupplierQualityTier.APPROVED),
  qualityScore: z.number().min(0).max(100).default(100),
  deliveryScore: z.number().min(0).max(100).default(100),
  responseScore: z.number().min(0).max(100).default(100),
  notes: z.string().optional(),
});

export type CreateSupplierQualityScore = z.infer<typeof CreateSupplierQualityScoreSchema>;

export const UpdateSupplierQualityScoreSchema = z.object({
  tier: z.nativeEnum(SupplierQualityTier).optional(),
  qualityScore: z.number().min(0).max(100).optional(),
  deliveryScore: z.number().min(0).max(100).optional(),
  responseScore: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
  nextAuditDue: z.coerce.date().optional(),
});

export type UpdateSupplierQualityScore = z.infer<typeof UpdateSupplierQualityScoreSchema>;

export const CreateSupplierQualityEventSchema = z.object({
  scoreId: z.string().uuid('Supplier score ID required'),
  eventType: z.string().min(1, 'Event type required'),
  description: z.string().optional(),
  qualityImpact: z.number().optional(),
  deliveryImpact: z.number().optional(),
  responseImpact: z.number().optional(),
  defectId: z.string().uuid().optional(),
  purchaseOrderNumber: z.string().optional(),
});

export type CreateSupplierQualityEvent = z.infer<typeof CreateSupplierQualityEventSchema>;

// ----- Customer Feedback Schemas -----

export const CreateCustomerFeedbackSchema = z.object({
  customerId: z.string().uuid().optional(),
  workOrderId: z.string().uuid().optional(),
  type: z.nativeEnum(FeedbackType).default(FeedbackType.COMPLAINT),
  subject: z.string().min(1, 'Subject is required'),
  description: z.string().optional(),
  sourceChannel: z.string().optional(),
  overallRating: z.number().int().min(1).max(5).optional(),
  qualityRating: z.number().int().min(1).max(5).optional(),
  serviceRating: z.number().int().min(1).max(5).optional(),
  tags: z.array(z.string()).optional(),
});

export type CreateCustomerFeedback = z.infer<typeof CreateCustomerFeedbackSchema>;

export const UpdateCustomerFeedbackSchema = z.object({
  status: z.nativeEnum(FeedbackStatus).optional(),
  description: z.string().optional(),
  resolution: z.string().optional(),
  creditIssued: z.number().nonnegative().optional(),
  refundIssued: z.number().nonnegative().optional(),
  linkedDefectId: z.string().uuid().optional(),
  tags: z.array(z.string()).optional(),
});

export type UpdateCustomerFeedback = z.infer<typeof UpdateCustomerFeedbackSchema>;

// ----- Quality Trend Schemas -----

export const CreateQualityTrendSchema = z.object({
  trendType: z.nativeEnum(QualityTrendType),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  station: z.string().optional(),
  productType: z.string().optional(),
  customerId: z.string().uuid().optional(),
  metricValue: z.number(),
  targetValue: z.number().optional(),
  previousValue: z.number().optional(),
  sampleSize: z.number().int().positive(),
  standardDeviation: z.number().optional(),
  upperControlLimit: z.number().optional(),
  lowerControlLimit: z.number().optional(),
  notes: z.string().optional(),
});

export type CreateQualityTrend = z.infer<typeof CreateQualityTrendSchema>;

// ----- Quality Objective Schemas -----

export const CreateQualityObjectiveSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  metricType: z.nativeEnum(QualityTrendType),
  targetValue: z.number(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  station: z.string().optional(),
  ownerId: z.string().uuid().optional(),
});

export type CreateQualityObjective = z.infer<typeof CreateQualityObjectiveSchema>;

export const UpdateQualityObjectiveSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  targetValue: z.number().optional(),
  currentValue: z.number().optional(),
  status: z.nativeEnum(GoalStatus).optional(),
  lastReviewDate: z.coerce.date().optional(),
  nextReviewDate: z.coerce.date().optional(),
  isActive: z.boolean().optional(),
});

export type UpdateQualityObjective = z.infer<typeof UpdateQualityObjectiveSchema>;

// ----- Filter Schemas -----

export const DefectFilterSchema = z.object({
  workOrderId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  severity: z.nativeEnum(DefectSeverity).optional(),
  source: z.nativeEnum(DefectSource).optional(),
  disposition: z.nativeEnum(DefectDisposition).optional(),
  station: z.string().optional(),
  discoveredById: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export type DefectFilter = z.infer<typeof DefectFilterSchema>;

export const CustomerFeedbackFilterSchema = z.object({
  customerId: z.string().uuid().optional(),
  workOrderId: z.string().uuid().optional(),
  type: z.nativeEnum(FeedbackType).optional(),
  status: z.nativeEnum(FeedbackStatus).optional(),
  minRating: z.number().int().min(1).max(5).optional(),
  maxRating: z.number().int().min(1).max(5).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export type CustomerFeedbackFilter = z.infer<typeof CustomerFeedbackFilterSchema>;

export const SupplierQualityFilterSchema = z.object({
  tier: z.nativeEnum(SupplierQualityTier).optional(),
  minQualityScore: z.number().min(0).max(100).optional(),
  maxQualityScore: z.number().min(0).max(100).optional(),
  vendorId: z.string().uuid().optional(),
});

export type SupplierQualityFilter = z.infer<typeof SupplierQualityFilterSchema>;

export const QualityTrendFilterSchema = z.object({
  trendType: z.nativeEnum(QualityTrendType).optional(),
  station: z.string().optional(),
  customerId: z.string().uuid().optional(),
  outOfControlOnly: z.boolean().optional(),
  requiresActionOnly: z.boolean().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export type QualityTrendFilter = z.infer<typeof QualityTrendFilterSchema>;

// ============================================================================
// NEW-CRITICAL-01: PROJECT MANAGEMENT & JOB TEMPLATES SCHEMAS
// ============================================================================

// ============ Project Status/Priority Enums ============

export const ProjectStatusSchema = z.nativeEnum(ProjectStatus);
export const ProjectPrioritySchema = z.nativeEnum(ProjectPriority);
export const MilestoneStatusSchema = z.nativeEnum(MilestoneStatus);
export const BudgetLineTypeSchema = z.nativeEnum(BudgetLineType);
export const BudgetStatusSchema = z.nativeEnum(BudgetStatus);
export const JobTemplateCategorySchema = z.nativeEnum(JobTemplateCategory);

// ============ Project Schemas ============

export const CreateProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  customerId: z.string().uuid().nullable().optional(),
  priority: ProjectPrioritySchema.default(ProjectPriority.MEDIUM),
  estimatedBudget: z.number().nonnegative().nullable().optional(),
  startDate: z.coerce.date().nullable().optional(),
  targetEndDate: z.coerce.date().nullable().optional(),
  estimatedHours: z.number().nonnegative().nullable().optional(),
  managerId: z.string().uuid().nullable().optional(),
  templateId: z.string().uuid().nullable().optional(),
  tags: z.array(z.string()).default([]),
});

export const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  customerId: z.string().uuid().nullable().optional(),
  status: ProjectStatusSchema.optional(),
  priority: ProjectPrioritySchema.optional(),
  budgetStatus: BudgetStatusSchema.optional(),
  estimatedBudget: z.number().nonnegative().nullable().optional(),
  actualCost: z.number().nonnegative().nullable().optional(),
  startDate: z.coerce.date().nullable().optional(),
  targetEndDate: z.coerce.date().nullable().optional(),
  actualEndDate: z.coerce.date().nullable().optional(),
  estimatedHours: z.number().nonnegative().nullable().optional(),
  actualHours: z.number().nonnegative().nullable().optional(),
  managerId: z.string().uuid().nullable().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
});

export const ProjectFilterSchema = z.object({
  status: z.array(ProjectStatusSchema).optional(),
  priority: z.array(ProjectPrioritySchema).optional(),
  customerId: z.string().uuid().optional(),
  managerId: z.string().uuid().optional(),
  budgetStatus: z.array(BudgetStatusSchema).optional(),
  search: z.string().optional(),
  startDateFrom: z.coerce.date().optional(),
  startDateTo: z.coerce.date().optional(),
  dueDateFrom: z.coerce.date().optional(),
  dueDateTo: z.coerce.date().optional(),
  tags: z.array(z.string()).optional(),
  isOverBudget: z.boolean().optional(),
  isOverdue: z.boolean().optional(),
});

export type CreateProject = z.infer<typeof CreateProjectSchema>;
export type UpdateProject = z.infer<typeof UpdateProjectSchema>;
export type ProjectFilter = z.infer<typeof ProjectFilterSchema>;

// ============ Project Work Order Link Schemas ============

export const AddWorkOrderToProjectSchema = z.object({
  workOrderId: z.string().uuid(),
  phaseNumber: z.number().int().positive().default(1),
  phaseName: z.string().max(100).nullable().optional(),
  sortOrder: z.number().int().nonnegative().default(0),
  notes: z.string().max(1000).nullable().optional(),
});

export const UpdateProjectWorkOrderSchema = z.object({
  phaseNumber: z.number().int().positive().optional(),
  phaseName: z.string().max(100).nullable().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export type AddWorkOrderToProject = z.infer<typeof AddWorkOrderToProjectSchema>;
export type UpdateProjectWorkOrder = z.infer<typeof UpdateProjectWorkOrderSchema>;

// ============ Milestone Schemas ============

export const CreateMilestoneSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  dependsOnId: z.string().uuid().nullable().optional(),
  deliverables: z.string().max(2000).nullable().optional(),
  notifyOnComplete: z.boolean().default(false),
});

export const UpdateMilestoneSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  status: MilestoneStatusSchema.optional(),
  dueDate: z.coerce.date().nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  dependsOnId: z.string().uuid().nullable().optional(),
  deliverables: z.string().max(2000).nullable().optional(),
  notifyOnComplete: z.boolean().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
});

export const CompleteMilestoneSchema = z.object({
  completedAt: z.coerce.date().optional(),
  notes: z.string().max(1000).optional(),
});

export type CreateMilestone = z.infer<typeof CreateMilestoneSchema>;
export type UpdateMilestone = z.infer<typeof UpdateMilestoneSchema>;
export type CompleteMilestone = z.infer<typeof CompleteMilestoneSchema>;

// ============ Budget Line Schemas ============

export const CreateBudgetLineSchema = z.object({
  workOrderId: z.string().uuid().nullable().optional(),
  lineType: BudgetLineTypeSchema,
  description: z.string().min(1).max(500),
  estimatedAmount: z.number().nonnegative(),
  quantity: z.number().positive().default(1),
  unitCost: z.number().nonnegative().nullable().optional(),
  unit: z.string().max(50).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export const UpdateBudgetLineSchema = z.object({
  lineType: BudgetLineTypeSchema.optional(),
  description: z.string().min(1).max(500).optional(),
  estimatedAmount: z.number().nonnegative().optional(),
  actualAmount: z.number().nonnegative().nullable().optional(),
  quantity: z.number().positive().optional(),
  unitCost: z.number().nonnegative().nullable().optional(),
  unit: z.string().max(50).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export const ApproveBudgetLineSchema = z.object({
  approve: z.boolean(),
  notes: z.string().max(500).optional(),
});

export type CreateBudgetLine = z.infer<typeof CreateBudgetLineSchema>;
export type UpdateBudgetLine = z.infer<typeof UpdateBudgetLineSchema>;
export type ApproveBudgetLine = z.infer<typeof ApproveBudgetLineSchema>;

// ============ Project Note Schemas ============

export const CreateProjectNoteSchema = z.object({
  content: z.string().min(1).max(5000),
  isInternal: z.boolean().default(true),
  isPinned: z.boolean().default(false),
});

export const UpdateProjectNoteSchema = z.object({
  content: z.string().min(1).max(5000).optional(),
  isInternal: z.boolean().optional(),
  isPinned: z.boolean().optional(),
});

export type CreateProjectNote = z.infer<typeof CreateProjectNoteSchema>;
export type UpdateProjectNote = z.infer<typeof UpdateProjectNoteSchema>;

// ============ Project Attachment Schemas ============

export const CreateProjectAttachmentSchema = z.object({
  filename: z.string().min(1).max(255),
  originalName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(100),
  sizeBytes: z.number().int().nonnegative(),
  description: z.string().max(500).nullable().optional(),
  category: z.string().max(100).nullable().optional(),
});

export type CreateProjectAttachment = z.infer<typeof CreateProjectAttachmentSchema>;

// ============ Job Template Schemas ============

export const CreateJobTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).nullable().optional(),
  category: JobTemplateCategorySchema,
  defaultRouting: z.array(z.string()).default([]),
  estimatedHours: z.number().nonnegative().nullable().optional(),
  defaultPriority: ProjectPrioritySchema.default(ProjectPriority.MEDIUM),
  defaultSpecifications: z.record(z.unknown()).nullable().optional(),
  checklistItems: z.array(z.string()).default([]),
  requiredDocuments: z.array(z.string()).default([]),
  standardNotes: z.string().max(2000).nullable().optional(),
});

export const UpdateJobTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  category: JobTemplateCategorySchema.optional(),
  defaultRouting: z.array(z.string()).optional(),
  estimatedHours: z.number().nonnegative().nullable().optional(),
  defaultPriority: ProjectPrioritySchema.optional(),
  defaultSpecifications: z.record(z.unknown()).nullable().optional(),
  checklistItems: z.array(z.string()).optional(),
  requiredDocuments: z.array(z.string()).optional(),
  standardNotes: z.string().max(2000).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const JobTemplateFilterSchema = z.object({
  category: z.array(JobTemplateCategorySchema).optional(),
  search: z.string().optional(),
  isActive: z.boolean().optional(),
});

export type CreateJobTemplate = z.infer<typeof CreateJobTemplateSchema>;
export type UpdateJobTemplate = z.infer<typeof UpdateJobTemplateSchema>;
export type JobTemplateFilter = z.infer<typeof JobTemplateFilterSchema>;

// ============ Template Line Item Schemas ============

export const CreateTemplateLineItemSchema = z.object({
  lineType: BudgetLineTypeSchema,
  description: z.string().min(1).max(500),
  defaultQuantity: z.number().positive().default(1),
  defaultUnitCost: z.number().nonnegative().nullable().optional(),
  unit: z.string().max(50).nullable().optional(),
  isRequired: z.boolean().default(false),
  sortOrder: z.number().int().nonnegative().default(0),
});

export const UpdateTemplateLineItemSchema = z.object({
  lineType: BudgetLineTypeSchema.optional(),
  description: z.string().min(1).max(500).optional(),
  defaultQuantity: z.number().positive().optional(),
  defaultUnitCost: z.number().nonnegative().nullable().optional(),
  unit: z.string().max(50).nullable().optional(),
  isRequired: z.boolean().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
});

export type CreateTemplateLineItem = z.infer<typeof CreateTemplateLineItemSchema>;
export type UpdateTemplateLineItem = z.infer<typeof UpdateTemplateLineItemSchema>;

// ============ Project from Template Schema ============

export const CreateProjectFromTemplateSchema = z.object({
  templateId: z.string().uuid(),
  name: z.string().min(1).max(200),
  customerId: z.string().uuid().nullable().optional(),
  startDate: z.coerce.date().nullable().optional(),
  targetEndDate: z.coerce.date().nullable().optional(),
  managerId: z.string().uuid().nullable().optional(),
  budgetMultiplier: z.number().positive().default(1),
  overrideSpecifications: z.record(z.unknown()).nullable().optional(),
});

export type CreateProjectFromTemplate = z.infer<typeof CreateProjectFromTemplateSchema>;

// ============ Project Budget Analysis Schemas ============

export const ProjectBudgetAnalysisSchema = z.object({
  projectId: z.string().uuid(),
  includeProjectedCosts: z.boolean().default(true),
  breakdownByWorkOrder: z.boolean().default(false),
  breakdownByType: z.boolean().default(true),
});

export type ProjectBudgetAnalysis = z.infer<typeof ProjectBudgetAnalysisSchema>;

// ============================================================================
// NEW-CRITICAL-02: MATERIAL NESTING & WASTE OPTIMIZATION SCHEMAS
// ============================================================================

// ============ Nesting Enum Schemas ============

export const NestingStatusSchema = z.nativeEnum(NestingStatus);
export const CutStatusSchema = z.nativeEnum(CutStatus);
export const WasteCategorySchema = z.nativeEnum(WasteCategory);
export const SheetStatusSchema = z.nativeEnum(SheetStatus);
export const NestingAlgorithmSchema = z.nativeEnum(NestingAlgorithm);

// ============ Material Sheet Schemas ============

export const CreateMaterialSheetSchema = z.object({
  materialId: z.string().uuid().nullable().optional(),
  materialSku: z.string().min(1).max(100),
  materialName: z.string().min(1).max(200),
  width: z.number().positive(),
  height: z.number().positive(),
  thickness: z.number().positive().nullable().optional(),
  poNumber: z.string().max(100).nullable().optional(),
  lotNumber: z.string().max(100).nullable().optional(),
  unitCost: z.number().nonnegative().nullable().optional(),
  warehouseLocation: z.string().max(100).nullable().optional(),
  binNumber: z.string().max(50).nullable().optional(),
  gradeRating: z.string().max(10).nullable().optional(),
});

export const UpdateMaterialSheetSchema = z.object({
  status: SheetStatusSchema.optional(),
  warehouseLocation: z.string().max(100).nullable().optional(),
  binNumber: z.string().max(50).nullable().optional(),
  gradeRating: z.string().max(10).nullable().optional(),
  hasDefects: z.boolean().optional(),
  defectNotes: z.string().max(500).nullable().optional(),
});

export const MaterialSheetFilterSchema = z.object({
  status: z.array(SheetStatusSchema).optional(),
  materialSku: z.string().optional(),
  isRemnant: z.boolean().optional(),
  minWidth: z.number().positive().optional(),
  minHeight: z.number().positive().optional(),
  warehouseLocation: z.string().optional(),
  hasDefects: z.boolean().optional(),
});

export type CreateMaterialSheet = z.infer<typeof CreateMaterialSheetSchema>;
export type UpdateMaterialSheet = z.infer<typeof UpdateMaterialSheetSchema>;
export type MaterialSheetFilter = z.infer<typeof MaterialSheetFilterSchema>;

// ============ Nesting Job Schemas ============

export const CreateNestingJobSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).nullable().optional(),
  materialSku: z.string().max(100).nullable().optional(),
  maxSheetWidth: z.number().positive().nullable().optional(),
  maxSheetHeight: z.number().positive().nullable().optional(),
  itemSpacing: z.number().nonnegative().default(0.25),
  edgeMargin: z.number().nonnegative().default(0.5),
  allowRotation: z.boolean().default(true),
  prioritizeByDueDate: z.boolean().default(true),
});

export const UpdateNestingJobSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  status: NestingStatusSchema.optional(),
  materialSku: z.string().max(100).nullable().optional(),
  maxSheetWidth: z.number().positive().nullable().optional(),
  maxSheetHeight: z.number().positive().nullable().optional(),
  itemSpacing: z.number().nonnegative().optional(),
  edgeMargin: z.number().nonnegative().optional(),
  allowRotation: z.boolean().optional(),
  prioritizeByDueDate: z.boolean().optional(),
});

export const NestingJobFilterSchema = z.object({
  status: z.array(NestingStatusSchema).optional(),
  materialSku: z.string().optional(),
  createdById: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  search: z.string().optional(),
});

export const ApproveNestingJobSchema = z.object({
  notes: z.string().max(500).optional(),
});

export type CreateNestingJob = z.infer<typeof CreateNestingJobSchema>;
export type UpdateNestingJob = z.infer<typeof UpdateNestingJobSchema>;
export type NestingJobFilter = z.infer<typeof NestingJobFilterSchema>;
export type ApproveNestingJob = z.infer<typeof ApproveNestingJobSchema>;

// ============ Nest Item Schemas ============

export const CreateNestItemSchema = z.object({
  workOrderId: z.string().uuid().nullable().optional(),
  lineItemId: z.string().uuid().nullable().optional(),
  itemName: z.string().min(1).max(200),
  quantity: z.number().int().positive().default(1),
  width: z.number().positive(),
  height: z.number().positive(),
  canRotate: z.boolean().default(true),
  grainDirection: z.enum(['horizontal', 'vertical', 'none']).nullable().optional(),
  priority: z.number().int().min(1).max(10).default(5),
  dueDate: z.coerce.date().nullable().optional(),
});

export const UpdateNestItemSchema = z.object({
  itemName: z.string().min(1).max(200).optional(),
  quantity: z.number().int().positive().optional(),
  canRotate: z.boolean().optional(),
  grainDirection: z.enum(['horizontal', 'vertical', 'none']).nullable().optional(),
  priority: z.number().int().min(1).max(10).optional(),
  dueDate: z.coerce.date().nullable().optional(),
});

export const BulkAddNestItemsSchema = z.object({
  items: z.array(CreateNestItemSchema).min(1),
});

export type CreateNestItem = z.infer<typeof CreateNestItemSchema>;
export type UpdateNestItem = z.infer<typeof UpdateNestItemSchema>;
export type BulkAddNestItems = z.infer<typeof BulkAddNestItemsSchema>;

// ============ Nest Placement Schemas ============

export const UpdateNestPlacementSchema = z.object({
  positionX: z.number().nonnegative().optional(),
  positionY: z.number().nonnegative().optional(),
  isRotated: z.boolean().optional(),
  rotationDegrees: z.number().int().min(0).max(360).optional(),
});

export const UpdateCutStatusSchema = z.object({
  cutStatus: CutStatusSchema,
  qcNotes: z.string().max(500).nullable().optional(),
  passedQC: z.boolean().nullable().optional(),
});

export type UpdateNestPlacement = z.infer<typeof UpdateNestPlacementSchema>;
export type UpdateCutStatus = z.infer<typeof UpdateCutStatusSchema>;

// ============ Waste Record Schemas ============

export const CreateWasteRecordSchema = z.object({
  nestingJobId: z.string().uuid().nullable().optional(),
  workOrderId: z.string().uuid().nullable().optional(),
  materialSku: z.string().min(1).max(100),
  materialName: z.string().min(1).max(200),
  width: z.number().positive().nullable().optional(),
  height: z.number().positive().nullable().optional(),
  areaSqIn: z.number().positive(),
  weight: z.number().positive().nullable().optional(),
  category: WasteCategorySchema,
  estimatedCost: z.number().nonnegative().nullable().optional(),
  isRecyclable: z.boolean().default(false),
  reason: z.string().max(500).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export const RecycleWasteSchema = z.object({
  recycleValue: z.number().nonnegative().nullable().optional(),
  notes: z.string().max(500).optional(),
});

export const WasteFilterSchema = z.object({
  category: z.array(WasteCategorySchema).optional(),
  materialSku: z.string().optional(),
  nestingJobId: z.string().uuid().optional(),
  workOrderId: z.string().uuid().optional(),
  isRecyclable: z.boolean().optional(),
  wasRecycled: z.boolean().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export type CreateWasteRecord = z.infer<typeof CreateWasteRecordSchema>;
export type RecycleWaste = z.infer<typeof RecycleWasteSchema>;
export type WasteFilter = z.infer<typeof WasteFilterSchema>;

// ============ Nesting Config Schemas ============

export const CreateNestingConfigSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  algorithmType: NestingAlgorithmSchema.default(NestingAlgorithm.BOTTOM_LEFT),
  maxIterations: z.number().int().positive().default(1000),
  timeoutMs: z.number().int().positive().default(30000),
  defaultItemSpacing: z.number().nonnegative().default(0.25),
  defaultEdgeMargin: z.number().nonnegative().default(0.5),
  utilizationWeight: z.number().int().min(0).max(100).default(70),
  cutPathWeight: z.number().int().min(0).max(100).default(20),
  setupTimeWeight: z.number().int().min(0).max(100).default(10),
  minRemnantSize: z.number().nonnegative().default(36),
  preferRemnants: z.boolean().default(true),
});

export const UpdateNestingConfigSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  algorithmType: NestingAlgorithmSchema.optional(),
  maxIterations: z.number().int().positive().optional(),
  timeoutMs: z.number().int().positive().optional(),
  defaultItemSpacing: z.number().nonnegative().optional(),
  defaultEdgeMargin: z.number().nonnegative().optional(),
  utilizationWeight: z.number().int().min(0).max(100).optional(),
  cutPathWeight: z.number().int().min(0).max(100).optional(),
  setupTimeWeight: z.number().int().min(0).max(100).optional(),
  minRemnantSize: z.number().nonnegative().optional(),
  preferRemnants: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export type CreateNestingConfig = z.infer<typeof CreateNestingConfigSchema>;
export type UpdateNestingConfig = z.infer<typeof UpdateNestingConfigSchema>;

// ============ Run Nesting Algorithm Schema ============

export const RunNestingSchema = z.object({
  configId: z.string().uuid().optional(),
  sheetIds: z.array(z.string().uuid()).optional(), // Specific sheets to use
  useRemnants: z.boolean().default(true),
  maxSheets: z.number().int().positive().optional(),
});

export type RunNesting = z.infer<typeof RunNestingSchema>;

// ============ Utilization Report Schema ============

export const UtilizationReportSchema = z.object({
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  materialSku: z.string().optional(),
  groupBy: z.enum(['day', 'week', 'month']).default('week'),
});

export type UtilizationReport = z.infer<typeof UtilizationReportSchema>;

// ============================================================================
// NEW-CRITICAL-03: ADVANCED NOTIFICATION & COMMUNICATION HUB SCHEMAS
// ============================================================================

// ============ Notification Enum Schemas ============

export const NotificationChannelSchema = z.nativeEnum(NotificationChannel);
export const NotificationPriorityLevelSchema = z.nativeEnum(NotificationPriorityLevel);
export const NotificationDeliveryStatusSchema = z.nativeEnum(NotificationDeliveryStatus);
export const ThreadStatusSchema = z.nativeEnum(ThreadStatus);
export const AnnouncementScopeSchema = z.nativeEnum(AnnouncementScope);
export const CommunicationChannelSchema = z.nativeEnum(CommunicationChannel);
export const CommunicationDirectionSchema = z.nativeEnum(CommunicationDirection);

// ============ Notification Template Schemas ============

export const CreateNotificationTemplateSchema = z.object({
  code: z.string().min(1).max(100).regex(/^[A-Z_]+$/, 'Code must be uppercase with underscores'),
  name: z.string().min(1).max(200),
  description: z.string().max(500).nullable().optional(),
  subjectTemplate: z.string().max(500).nullable().optional(),
  bodyTemplate: z.string().min(1).max(5000),
  htmlTemplate: z.string().max(50000).nullable().optional(),
  channels: z.array(NotificationChannelSchema).min(1),
  defaultPriority: NotificationPriorityLevelSchema.default(NotificationPriorityLevel.NORMAL),
  category: z.string().max(50).nullable().optional(),
  variables: z.array(z.string()).default([]),
});

export const UpdateNotificationTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).nullable().optional(),
  subjectTemplate: z.string().max(500).nullable().optional(),
  bodyTemplate: z.string().min(1).max(5000).optional(),
  htmlTemplate: z.string().max(50000).nullable().optional(),
  channels: z.array(NotificationChannelSchema).min(1).optional(),
  defaultPriority: NotificationPriorityLevelSchema.optional(),
  category: z.string().max(50).nullable().optional(),
  variables: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export type CreateNotificationTemplate = z.infer<typeof CreateNotificationTemplateSchema>;
export type UpdateNotificationTemplate = z.infer<typeof UpdateNotificationTemplateSchema>;

// ============ Notification Preference Schemas ============

export const UpdateNotificationPreferenceSchema = z.object({
  templateCode: z.string().max(100).nullable().optional(),
  category: z.string().max(50).nullable().optional(),
  enabledChannels: z.array(NotificationChannelSchema).optional(),
  disabledChannels: z.array(NotificationChannelSchema).optional(),
  emailEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  inAppEnabled: z.boolean().optional(),
  quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  timezone: z.string().max(50).nullable().optional(),
  digestEnabled: z.boolean().optional(),
  digestFrequency: z.enum(['daily', 'weekly']).nullable().optional(),
  digestTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
});

export type UpdateNotificationPreference = z.infer<typeof UpdateNotificationPreferenceSchema>;

// ============ Send Notification Schemas ============

export const SendNotificationSchema = z.object({
  userId: z.string().uuid().nullable().optional(),
  recipientEmail: z.string().email().nullable().optional(),
  recipientPhone: z.string().max(20).nullable().optional(),
  recipientName: z.string().max(200).nullable().optional(),
  templateCode: z.string().max(100).nullable().optional(),
  subject: z.string().max(500).nullable().optional(),
  body: z.string().min(1).max(10000),
  htmlBody: z.string().max(50000).nullable().optional(),
  channel: NotificationChannelSchema,
  priority: NotificationPriorityLevelSchema.default(NotificationPriorityLevel.NORMAL),
  entityType: z.string().max(50).nullable().optional(),
  entityId: z.string().uuid().nullable().optional(),
  scheduledFor: z.coerce.date().nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
});

export const BulkSendNotificationSchema = z.object({
  notifications: z.array(SendNotificationSchema).min(1).max(100),
});

export const NotificationFilterSchema = z.object({
  channel: z.array(NotificationChannelSchema).optional(),
  status: z.array(NotificationDeliveryStatusSchema).optional(),
  priority: z.array(NotificationPriorityLevelSchema).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  unreadOnly: z.boolean().optional(),
});

export type SendNotification = z.infer<typeof SendNotificationSchema>;
export type BulkSendNotification = z.infer<typeof BulkSendNotificationSchema>;
export type NotificationFilter = z.infer<typeof NotificationFilterSchema>;

// ============ Message Thread Schemas ============

export const CreateMessageThreadSchema = z.object({
  subject: z.string().min(1).max(300),
  entityType: z.string().max(50).nullable().optional(),
  entityId: z.string().uuid().nullable().optional(),
  participantIds: z.array(z.string().uuid()).min(1),
  initialMessage: z.string().max(10000).optional(),
  isUrgent: z.boolean().default(false),
});

export const UpdateMessageThreadSchema = z.object({
  subject: z.string().min(1).max(300).optional(),
  status: ThreadStatusSchema.optional(),
  isPinned: z.boolean().optional(),
  isUrgent: z.boolean().optional(),
});

export const ThreadFilterSchema = z.object({
  status: z.array(ThreadStatusSchema).optional(),
  entityType: z.string().optional(),
  entityId: z.string().uuid().optional(),
  participantId: z.string().uuid().optional(),
  unreadOnly: z.boolean().optional(),
  search: z.string().optional(),
});

export type CreateMessageThread = z.infer<typeof CreateMessageThreadSchema>;
export type UpdateMessageThread = z.infer<typeof UpdateMessageThreadSchema>;
export type ThreadFilter = z.infer<typeof ThreadFilterSchema>;

// ============ Message Schemas ============

export const SendMessageSchema = z.object({
  content: z.string().min(1).max(10000),
  contentType: z.enum(['text', 'html', 'markdown']).default('text'),
  replyToId: z.string().uuid().nullable().optional(),
});

export const UpdateMessageSchema = z.object({
  content: z.string().min(1).max(10000),
});

export const AddReactionSchema = z.object({
  emoji: z.string().min(1).max(10),
});

export type SendMessage = z.infer<typeof SendMessageSchema>;
export type UpdateMessage = z.infer<typeof UpdateMessageSchema>;
export type AddReaction = z.infer<typeof AddReactionSchema>;

// ============ Thread Participant Schemas ============

export const AddParticipantSchema = z.object({
  userId: z.string().uuid(),
  canReply: z.boolean().default(true),
  isAdmin: z.boolean().default(false),
});

export const UpdateParticipantSchema = z.object({
  notifyOnReply: z.boolean().optional(),
  isMuted: z.boolean().optional(),
  canReply: z.boolean().optional(),
  isAdmin: z.boolean().optional(),
});

export type AddParticipant = z.infer<typeof AddParticipantSchema>;
export type UpdateParticipant = z.infer<typeof UpdateParticipantSchema>;

// ============ Announcement Schemas ============

export const CreateAnnouncementSchema = z.object({
  title: z.string().min(1).max(300),
  content: z.string().min(1).max(10000),
  contentType: z.enum(['text', 'html', 'markdown']).default('text'),
  scope: AnnouncementScopeSchema.default(AnnouncementScope.ALL),
  targetRoles: z.array(z.string()).default([]),
  targetUserIds: z.array(z.string().uuid()).default([]),
  startsAt: z.coerce.date().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  priority: NotificationPriorityLevelSchema.default(NotificationPriorityLevel.NORMAL),
  isPinned: z.boolean().default(false),
  requiresAck: z.boolean().default(false),
  bannerColor: z.string().max(20).nullable().optional(),
  icon: z.string().max(50).nullable().optional(),
  isDraft: z.boolean().default(false),
});

export const UpdateAnnouncementSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  content: z.string().min(1).max(10000).optional(),
  contentType: z.enum(['text', 'html', 'markdown']).optional(),
  scope: AnnouncementScopeSchema.optional(),
  targetRoles: z.array(z.string()).optional(),
  targetUserIds: z.array(z.string().uuid()).optional(),
  startsAt: z.coerce.date().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  priority: NotificationPriorityLevelSchema.optional(),
  isPinned: z.boolean().optional(),
  requiresAck: z.boolean().optional(),
  bannerColor: z.string().max(20).nullable().optional(),
  icon: z.string().max(50).nullable().optional(),
  isActive: z.boolean().optional(),
  isDraft: z.boolean().optional(),
});

export const AnnouncementFilterSchema = z.object({
  scope: z.array(AnnouncementScopeSchema).optional(),
  priority: z.array(NotificationPriorityLevelSchema).optional(),
  isActive: z.boolean().optional(),
  isPinned: z.boolean().optional(),
  requiresAck: z.boolean().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export type CreateAnnouncement = z.infer<typeof CreateAnnouncementSchema>;
export type UpdateAnnouncement = z.infer<typeof UpdateAnnouncementSchema>;
export type AnnouncementFilter = z.infer<typeof AnnouncementFilterSchema>;

// ============ Communication Log Schemas ============

export const CreateCommunicationLogSchema = z.object({
  entityType: z.string().min(1).max(50),
  entityId: z.string().uuid(),
  channel: CommunicationChannelSchema,
  direction: CommunicationDirectionSchema,
  subject: z.string().max(300).nullable().optional(),
  summary: z.string().min(1).max(2000),
  details: z.string().max(10000).nullable().optional(),
  contactName: z.string().max(200).nullable().optional(),
  contactEmail: z.string().email().nullable().optional(),
  contactPhone: z.string().max(30).nullable().optional(),
  occurredAt: z.coerce.date().optional(),
  duration: z.number().int().positive().nullable().optional(),
  requiresFollowUp: z.boolean().default(false),
  followUpDate: z.coerce.date().nullable().optional(),
  followUpNotes: z.string().max(1000).nullable().optional(),
});

export const UpdateCommunicationLogSchema = z.object({
  subject: z.string().max(300).nullable().optional(),
  summary: z.string().min(1).max(2000).optional(),
  details: z.string().max(10000).nullable().optional(),
  requiresFollowUp: z.boolean().optional(),
  followUpDate: z.coerce.date().nullable().optional(),
  followUpNotes: z.string().max(1000).nullable().optional(),
  followUpCompleted: z.boolean().optional(),
});

export const CommunicationLogFilterSchema = z.object({
  entityType: z.string().optional(),
  entityId: z.string().uuid().optional(),
  channel: z.array(CommunicationChannelSchema).optional(),
  direction: z.array(CommunicationDirectionSchema).optional(),
  userId: z.string().uuid().optional(),
  requiresFollowUp: z.boolean().optional(),
  followUpCompleted: z.boolean().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  search: z.string().optional(),
});

export type CreateCommunicationLog = z.infer<typeof CreateCommunicationLogSchema>;
export type UpdateCommunicationLog = z.infer<typeof UpdateCommunicationLogSchema>;
export type CommunicationLogFilter = z.infer<typeof CommunicationLogFilterSchema>;

// ============================================================================
// NEW-CRITICAL-04: EQUIPMENT CALIBRATION & CERTIFICATION SCHEMAS
// ============================================================================

import {
  CalibrationType,
  CalibrationResult,
  CertificationType,
  CertificationStatus,
} from './enums.js';

// ============ Base Enum Schemas ============

export const CalibrationTypeSchema = z.nativeEnum(CalibrationType);
export const CalibrationResultSchema = z.nativeEnum(CalibrationResult);
export const CertificationTypeSchema = z.nativeEnum(CertificationType);
export const CertificationStatusSchema = z.nativeEnum(CertificationStatus);

// ============ Calibration Schemas ============

export const CreateCalibrationSchema = z.object({
  equipmentId: z.string().uuid(),
  calibrationType: CalibrationTypeSchema,
  calibrationDate: z.coerce.date(),
  dueDate: z.coerce.date(),
  result: CalibrationResultSchema,
  performedBy: z.string().max(200).nullable().optional(),
  performedByUserId: z.string().uuid().nullable().optional(),
  externalCompany: z.string().max(200).nullable().optional(),
  externalTechName: z.string().max(200).nullable().optional(),
  certificateNumber: z.string().max(100).nullable().optional(),
  tolerancesMet: z.boolean().default(true),
  adjustmentsMade: z.boolean().default(false),
  adjustmentNotes: z.string().max(2000).nullable().optional(),
  measurements: z.record(z.any()).nullable().optional(),
  standardsUsed: z.string().max(500).nullable().optional(),
  traceability: z.string().max(500).nullable().optional(),
  temperature: z.number().min(-50).max(100).nullable().optional(),
  humidity: z.number().min(0).max(100).nullable().optional(),
  certificateUrl: z.string().url().nullable().optional(),
  reportUrl: z.string().url().nullable().optional(),
  cost: z.number().nonnegative().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const UpdateCalibrationSchema = z.object({
  result: CalibrationResultSchema.optional(),
  tolerancesMet: z.boolean().optional(),
  adjustmentsMade: z.boolean().optional(),
  adjustmentNotes: z.string().max(2000).nullable().optional(),
  measurements: z.record(z.any()).nullable().optional(),
  certificateUrl: z.string().url().nullable().optional(),
  reportUrl: z.string().url().nullable().optional(),
  cost: z.number().nonnegative().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const CalibrationFilterSchema = z.object({
  equipmentId: z.string().uuid().optional(),
  calibrationType: z.array(CalibrationTypeSchema).optional(),
  result: z.array(CalibrationResultSchema).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  dueFrom: z.coerce.date().optional(),
  dueTo: z.coerce.date().optional(),
  performedByUserId: z.string().uuid().optional(),
  includeOverdue: z.boolean().optional(),
});

export type CreateCalibration = z.infer<typeof CreateCalibrationSchema>;
export type UpdateCalibration = z.infer<typeof UpdateCalibrationSchema>;
export type CalibrationFilter = z.infer<typeof CalibrationFilterSchema>;

// ============ Certification Schemas ============

export const CreateCertificationSchema = z.object({
  equipmentId: z.string().uuid(),
  certificationType: CertificationTypeSchema,
  certificationName: z.string().min(1).max(200),
  issuingAuthority: z.string().min(1).max(200),
  issueDate: z.coerce.date(),
  expirationDate: z.coerce.date().nullable().optional(),
  certificateNumber: z.string().max(100).nullable().optional(),
  certificateUrl: z.string().url().nullable().optional(),
  complianceStandard: z.string().max(200).nullable().optional(),
  requirements: z.string().max(2000).nullable().optional(),
  renewalReminder: z.number().int().positive().nullable().optional(),
  renewalCost: z.number().nonnegative().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const UpdateCertificationSchema = z.object({
  status: CertificationStatusSchema.optional(),
  expirationDate: z.coerce.date().nullable().optional(),
  certificateNumber: z.string().max(100).nullable().optional(),
  certificateUrl: z.string().url().nullable().optional(),
  renewalReminder: z.number().int().positive().nullable().optional(),
  renewalCost: z.number().nonnegative().nullable().optional(),
  lastRenewalDate: z.coerce.date().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const CertificationFilterSchema = z.object({
  equipmentId: z.string().uuid().optional(),
  certificationType: z.array(CertificationTypeSchema).optional(),
  status: z.array(CertificationStatusSchema).optional(),
  expiringSoon: z.boolean().optional(),
  expiringWithinDays: z.number().int().positive().optional(),
  complianceStandard: z.string().optional(),
});

export type CreateCertification = z.infer<typeof CreateCertificationSchema>;
export type UpdateCertification = z.infer<typeof UpdateCertificationSchema>;
export type CertificationFilter = z.infer<typeof CertificationFilterSchema>;

// ============ Equipment Part Schemas ============

export const CreateEquipmentPartSchema = z.object({
  equipmentId: z.string().uuid(),
  partNumber: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).nullable().optional(),
  category: z.string().max(100).nullable().optional(),
  isConsumable: z.boolean().default(false),
  isCritical: z.boolean().default(false),
  quantityOnHand: z.number().int().nonnegative().default(0),
  minimumQuantity: z.number().int().nonnegative().default(1),
  reorderPoint: z.number().int().nonnegative().default(1),
  unitCost: z.number().nonnegative().nullable().optional(),
  vendor: z.string().max(200).nullable().optional(),
  vendorPartNumber: z.string().max(100).nullable().optional(),
  expectedLifeHours: z.number().int().positive().nullable().optional(),
  replacementInterval: z.number().int().positive().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const UpdateEquipmentPartSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  category: z.string().max(100).nullable().optional(),
  isConsumable: z.boolean().optional(),
  isCritical: z.boolean().optional(),
  quantityOnHand: z.number().int().nonnegative().optional(),
  minimumQuantity: z.number().int().nonnegative().optional(),
  reorderPoint: z.number().int().nonnegative().optional(),
  unitCost: z.number().nonnegative().nullable().optional(),
  vendor: z.string().max(200).nullable().optional(),
  vendorPartNumber: z.string().max(100).nullable().optional(),
  expectedLifeHours: z.number().int().positive().nullable().optional(),
  replacementInterval: z.number().int().positive().nullable().optional(),
  lastReplacedAt: z.coerce.date().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const EquipmentPartFilterSchema = z.object({
  equipmentId: z.string().uuid().optional(),
  category: z.string().optional(),
  isConsumable: z.boolean().optional(),
  isCritical: z.boolean().optional(),
  belowReorderPoint: z.boolean().optional(),
  search: z.string().optional(),
});

export type CreateEquipmentPart = z.infer<typeof CreateEquipmentPartSchema>;
export type UpdateEquipmentPart = z.infer<typeof UpdateEquipmentPartSchema>;
export type EquipmentPartFilter = z.infer<typeof EquipmentPartFilterSchema>;

// ============ Equipment Meter Schemas ============

export const CreateEquipmentMeterSchema = z.object({
  equipmentId: z.string().uuid(),
  name: z.string().min(1).max(100),
  unit: z.string().min(1).max(50),
  currentReading: z.number().nonnegative(),
  maintenanceThreshold: z.number().nonnegative().nullable().optional(),
  calibrationThreshold: z.number().nonnegative().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export const UpdateMeterReadingSchema = z.object({
  currentReading: z.number().nonnegative(),
  notes: z.string().max(1000).nullable().optional(),
});

export const EquipmentMeterFilterSchema = z.object({
  equipmentId: z.string().uuid().optional(),
  approachingThreshold: z.boolean().optional(),
  thresholdPercentage: z.number().min(0).max(100).optional(),
});

export type CreateEquipmentMeter = z.infer<typeof CreateEquipmentMeterSchema>;
export type UpdateMeterReading = z.infer<typeof UpdateMeterReadingSchema>;
export type EquipmentMeterFilter = z.infer<typeof EquipmentMeterFilterSchema>;

// ============================================================================
// NEW-CRITICAL-05: ADVANCED USER TRAINING & COMPETENCY SCHEMAS
// ============================================================================

import {
  TrainingCategory,
  TrainingLevel,
  TrainingDeliveryMethod,
  TrainingSessionStatus,
  EnrollmentStatus,
  CompetencyType,
  CompetencyStatus,
  TrainingTargetType,
  TrainingPriorityLevel,
} from './enums.js';

// ============ Base Enum Schemas ============

export const TrainingCategorySchema = z.nativeEnum(TrainingCategory);
export const TrainingLevelSchema = z.nativeEnum(TrainingLevel);
export const TrainingDeliveryMethodSchema = z.nativeEnum(TrainingDeliveryMethod);
export const TrainingSessionStatusSchema = z.nativeEnum(TrainingSessionStatus);
export const EnrollmentStatusSchema = z.nativeEnum(EnrollmentStatus);
export const CompetencyTypeSchema = z.nativeEnum(CompetencyType);
export const CompetencyStatusSchema = z.nativeEnum(CompetencyStatus);
export const TrainingTargetTypeSchema = z.nativeEnum(TrainingTargetType);
export const TrainingPriorityLevelSchema = z.nativeEnum(TrainingPriorityLevel);

// ============ Training Program Schemas ============

const CurriculumModuleSchema = z.object({
  module: z.string().min(1).max(200),
  topics: z.array(z.string().max(500)),
});

const TrainingMaterialSchema = z.object({
  name: z.string().min(1).max(200),
  url: z.string().url(),
  type: z.string().max(50),
});

export const CreateTrainingProgramSchema = z.object({
  code: z.string().min(1).max(50).regex(/^[A-Z0-9-]+$/, 'Code must be uppercase alphanumeric with dashes'),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  category: TrainingCategorySchema,
  level: TrainingLevelSchema.default(TrainingLevel.BEGINNER),
  objectives: z.string().max(2000).nullable().optional(),
  curriculum: z.array(CurriculumModuleSchema).nullable().optional(),
  duration: z.number().int().positive().nullable().optional(),
  prerequisites: z.string().max(1000).nullable().optional(),
  equipmentRequired: z.string().max(500).nullable().optional(),
  stationsApplicable: z.array(z.string()).nullable().optional(),
  deliveryMethod: TrainingDeliveryMethodSchema.default(TrainingDeliveryMethod.IN_PERSON),
  materials: z.array(TrainingMaterialSchema).nullable().optional(),
  certificationRequired: z.boolean().default(false),
  certificationValidDays: z.number().int().positive().nullable().optional(),
  recertificationRequired: z.boolean().default(false),
  version: z.string().max(50).nullable().optional(),
});

export const UpdateTrainingProgramSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  category: TrainingCategorySchema.optional(),
  level: TrainingLevelSchema.optional(),
  objectives: z.string().max(2000).nullable().optional(),
  curriculum: z.array(CurriculumModuleSchema).nullable().optional(),
  duration: z.number().int().positive().nullable().optional(),
  prerequisites: z.string().max(1000).nullable().optional(),
  equipmentRequired: z.string().max(500).nullable().optional(),
  stationsApplicable: z.array(z.string()).nullable().optional(),
  deliveryMethod: TrainingDeliveryMethodSchema.optional(),
  materials: z.array(TrainingMaterialSchema).nullable().optional(),
  certificationRequired: z.boolean().optional(),
  certificationValidDays: z.number().int().positive().nullable().optional(),
  recertificationRequired: z.boolean().optional(),
  isActive: z.boolean().optional(),
  version: z.string().max(50).nullable().optional(),
});

export const TrainingProgramFilterSchema = z.object({
  category: z.array(TrainingCategorySchema).optional(),
  level: z.array(TrainingLevelSchema).optional(),
  deliveryMethod: z.array(TrainingDeliveryMethodSchema).optional(),
  isActive: z.boolean().optional(),
  certificationRequired: z.boolean().optional(),
  search: z.string().optional(),
});

export type CreateTrainingProgram = z.infer<typeof CreateTrainingProgramSchema>;
export type UpdateTrainingProgram = z.infer<typeof UpdateTrainingProgramSchema>;
export type TrainingProgramFilter = z.infer<typeof TrainingProgramFilterSchema>;

// ============ Training Session Schemas ============

export const CreateTrainingSessionSchema = z.object({
  programId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  scheduledDate: z.coerce.date(),
  scheduledEndDate: z.coerce.date().nullable().optional(),
  location: z.string().max(300).nullable().optional(),
  instructorId: z.string().uuid().nullable().optional(),
  externalInstructor: z.string().max(200).nullable().optional(),
  maxParticipants: z.number().int().positive().nullable().optional(),
});

export const UpdateTrainingSessionSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  scheduledDate: z.coerce.date().optional(),
  scheduledEndDate: z.coerce.date().nullable().optional(),
  location: z.string().max(300).nullable().optional(),
  instructorId: z.string().uuid().nullable().optional(),
  externalInstructor: z.string().max(200).nullable().optional(),
  maxParticipants: z.number().int().positive().nullable().optional(),
  status: TrainingSessionStatusSchema.optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const SessionFilterSchema = z.object({
  programId: z.string().uuid().optional(),
  status: z.array(TrainingSessionStatusSchema).optional(),
  instructorId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  upcoming: z.boolean().optional(),
});

export type CreateTrainingSession = z.infer<typeof CreateTrainingSessionSchema>;
export type UpdateTrainingSession = z.infer<typeof UpdateTrainingSessionSchema>;
export type SessionFilter = z.infer<typeof SessionFilterSchema>;

// ============ Enrollment Schemas ============

export const EnrollUserSchema = z.object({
  sessionId: z.string().uuid(),
  userId: z.string().uuid(),
});

export const BulkEnrollSchema = z.object({
  sessionId: z.string().uuid(),
  userIds: z.array(z.string().uuid()).min(1),
});

export const RecordAttendanceSchema = z.object({
  attended: z.boolean(),
  score: z.number().min(0).max(100).nullable().optional(),
  passed: z.boolean().nullable().optional(),
  assessmentNotes: z.string().max(2000).nullable().optional(),
});

export const UpdateEnrollmentSchema = z.object({
  status: EnrollmentStatusSchema.optional(),
  attended: z.boolean().optional(),
  passed: z.boolean().nullable().optional(),
  score: z.number().min(0).max(100).nullable().optional(),
  assessmentNotes: z.string().max(2000).nullable().optional(),
  certificateIssued: z.boolean().optional(),
  certificateNumber: z.string().max(100).nullable().optional(),
  certificateUrl: z.string().url().nullable().optional(),
  feedback: z.string().max(2000).nullable().optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
});

export type EnrollUser = z.infer<typeof EnrollUserSchema>;
export type BulkEnroll = z.infer<typeof BulkEnrollSchema>;
export type RecordAttendance = z.infer<typeof RecordAttendanceSchema>;
export type UpdateEnrollment = z.infer<typeof UpdateEnrollmentSchema>;

// ============ Competency Schemas ============

export const CreateUserCompetencySchema = z.object({
  userId: z.string().uuid(),
  competencyType: CompetencyTypeSchema,
  name: z.string().min(1).max(200),
  description: z.string().max(1000).nullable().optional(),
  level: z.string().min(1).max(50),
  acquiredDate: z.coerce.date(),
  expirationDate: z.coerce.date().nullable().optional(),
  programId: z.string().uuid().nullable().optional(),
  equipmentType: z.string().max(100).nullable().optional(),
  station: z.string().max(100).nullable().optional(),
  isCertified: z.boolean().default(false),
  certificationNumber: z.string().max(100).nullable().optional(),
  certificationUrl: z.string().url().nullable().optional(),
  issuingAuthority: z.string().max(200).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const UpdateUserCompetencySchema = z.object({
  level: z.string().min(1).max(50).optional(),
  expirationDate: z.coerce.date().nullable().optional(),
  status: CompetencyStatusSchema.optional(),
  isCertified: z.boolean().optional(),
  certificationNumber: z.string().max(100).nullable().optional(),
  certificationUrl: z.string().url().nullable().optional(),
  issuingAuthority: z.string().max(200).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const CompetencyFilterSchema = z.object({
  userId: z.string().uuid().optional(),
  competencyType: z.array(CompetencyTypeSchema).optional(),
  status: z.array(CompetencyStatusSchema).optional(),
  station: z.string().optional(),
  equipmentType: z.string().optional(),
  expiringWithinDays: z.number().int().positive().optional(),
  isCertified: z.boolean().optional(),
});

export type CreateUserCompetency = z.infer<typeof CreateUserCompetencySchema>;
export type UpdateUserCompetency = z.infer<typeof UpdateUserCompetencySchema>;
export type CompetencyFilter = z.infer<typeof CompetencyFilterSchema>;

// ============ Training Requirement Schemas ============

const RequiredCompetencySchema = z.object({
  type: CompetencyTypeSchema,
  name: z.string().min(1).max(200),
  level: z.string().min(1).max(50),
});

export const CreateTrainingRequirementSchema = z.object({
  targetType: TrainingTargetTypeSchema,
  targetValue: z.string().min(1).max(100),
  requirementName: z.string().min(1).max(200),
  description: z.string().max(1000).nullable().optional(),
  requiredCompetencies: z.array(RequiredCompetencySchema).nullable().optional(),
  requiredPrograms: z.array(z.string().uuid()).nullable().optional(),
  completionDeadlineDays: z.number().int().positive().nullable().optional(),
  renewalIntervalDays: z.number().int().positive().nullable().optional(),
  priority: TrainingPriorityLevelSchema.default(TrainingPriorityLevel.REQUIRED),
});

export const UpdateTrainingRequirementSchema = z.object({
  requirementName: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  requiredCompetencies: z.array(RequiredCompetencySchema).nullable().optional(),
  requiredPrograms: z.array(z.string().uuid()).nullable().optional(),
  completionDeadlineDays: z.number().int().positive().nullable().optional(),
  renewalIntervalDays: z.number().int().positive().nullable().optional(),
  priority: TrainingPriorityLevelSchema.optional(),
  isActive: z.boolean().optional(),
});

export const TrainingRequirementFilterSchema = z.object({
  targetType: TrainingTargetTypeSchema.optional(),
  targetValue: z.string().optional(),
  priority: z.array(TrainingPriorityLevelSchema).optional(),
  isActive: z.boolean().optional(),
});

export type CreateTrainingRequirement = z.infer<typeof CreateTrainingRequirementSchema>;
export type UpdateTrainingRequirement = z.infer<typeof UpdateTrainingRequirementSchema>;
export type TrainingRequirementFilter = z.infer<typeof TrainingRequirementFilterSchema>;

// ============================================================================
// NEW-CRITICAL-06: VENDOR RELATIONSHIP MANAGEMENT SCHEMAS
// ============================================================================

import {
  VendorContractType,
  ContractStatus,
  VendorPricingType,
  VendorCertificationType,
  QuoteRequestType,
  QuoteRequestStatus,
  QuoteResponseStatus,
} from './enums.js';

// Vendor contract type enum schema
export const VendorContractTypeSchema = z.nativeEnum(VendorContractType);

// Contract status enum schema
export const ContractStatusSchema = z.nativeEnum(ContractStatus);

// Vendor pricing type enum schema
export const VendorPricingTypeSchema = z.nativeEnum(VendorPricingType);

// Vendor certification type enum schema
export const VendorCertificationTypeSchema = z.nativeEnum(VendorCertificationType);

// Quote request type enum schema
export const QuoteRequestTypeSchema = z.nativeEnum(QuoteRequestType);

// Quote request status enum schema
export const QuoteRequestStatusSchema = z.nativeEnum(QuoteRequestStatus);

// Quote response status enum schema
export const QuoteResponseStatusSchema = z.nativeEnum(QuoteResponseStatus);

// ----- Vendor Contract Schemas -----

export const CreateVendorContractSchema = z.object({
  contractNumber: z.string().min(1).max(50),
  vendorId: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  contractType: VendorContractTypeSchema,
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  autoRenew: z.boolean().default(false),
  renewalPeriodDays: z.number().int().positive().optional(),
  renewalNoticeDays: z.number().int().positive().optional(),
  paymentTerms: z.string().max(100).optional(),
  minimumOrderValue: z.number().positive().optional(),
  annualCommitment: z.number().positive().optional(),
  discountPercent: z.number().min(0).max(100).optional(),
  exclusivityTerms: z.string().max(500).optional(),
  termsAndConditions: z.string().optional(),
  liabilityLimit: z.number().positive().optional(),
  insuranceRequired: z.boolean().default(false),
  insuranceMinimum: z.number().positive().optional(),
  documentUrls: z.array(z.string().url()).optional(),
  notes: z.string().max(2000).optional(),
});

export const UpdateVendorContractSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  contractType: VendorContractTypeSchema.optional(),
  status: ContractStatusSchema.optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  signedDate: z.coerce.date().nullable().optional(),
  terminationDate: z.coerce.date().nullable().optional(),
  autoRenew: z.boolean().optional(),
  renewalPeriodDays: z.number().int().positive().nullable().optional(),
  renewalNoticeDays: z.number().int().positive().nullable().optional(),
  paymentTerms: z.string().max(100).nullable().optional(),
  minimumOrderValue: z.number().positive().nullable().optional(),
  annualCommitment: z.number().positive().nullable().optional(),
  discountPercent: z.number().min(0).max(100).nullable().optional(),
  exclusivityTerms: z.string().max(500).nullable().optional(),
  termsAndConditions: z.string().nullable().optional(),
  liabilityLimit: z.number().positive().nullable().optional(),
  insuranceRequired: z.boolean().optional(),
  insuranceMinimum: z.number().positive().nullable().optional(),
  documentUrls: z.array(z.string().url()).optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const VendorContractFilterSchema = z.object({
  vendorId: z.string().uuid().optional(),
  contractType: z.array(VendorContractTypeSchema).optional(),
  status: z.array(ContractStatusSchema).optional(),
  expiringWithinDays: z.number().int().positive().optional(),
  autoRenew: z.boolean().optional(),
});

export type CreateVendorContract = z.infer<typeof CreateVendorContractSchema>;
export type UpdateVendorContract = z.infer<typeof UpdateVendorContractSchema>;
export type VendorContractFilter = z.infer<typeof VendorContractFilterSchema>;

// ----- Vendor Pricing Schemas -----

export const VolumeTierSchema = z.object({
  minQty: z.number().int().nonnegative(),
  maxQty: z.number().int().positive().optional(),
  price: z.number().positive(),
  discount: z.number().min(0).max(100).optional(),
});

export const CreateVendorPricingSchema = z.object({
  vendorId: z.string().uuid(),
  contractId: z.string().uuid().optional(),
  itemMasterId: z.string().uuid().optional(),
  categoryName: z.string().max(100).optional(),
  pricingType: VendorPricingTypeSchema,
  basePrice: z.number().positive(),
  currency: z.string().length(3).default('USD'),
  unitOfMeasure: z.string().min(1).max(50),
  volumeTiers: z.array(VolumeTierSchema).optional(),
  contractDiscount: z.number().min(0).max(100).optional(),
  effectiveDate: z.coerce.date(),
  expirationDate: z.coerce.date().optional(),
  leadTimeDays: z.number().int().nonnegative().optional(),
  minimumOrderQty: z.number().int().positive().optional(),
  notes: z.string().max(1000).optional(),
});

export const UpdateVendorPricingSchema = z.object({
  pricingType: VendorPricingTypeSchema.optional(),
  basePrice: z.number().positive().optional(),
  currency: z.string().length(3).optional(),
  unitOfMeasure: z.string().min(1).max(50).optional(),
  volumeTiers: z.array(VolumeTierSchema).nullable().optional(),
  contractDiscount: z.number().min(0).max(100).nullable().optional(),
  volumeDiscount: z.number().min(0).max(100).nullable().optional(),
  effectiveDate: z.coerce.date().optional(),
  expirationDate: z.coerce.date().nullable().optional(),
  leadTimeDays: z.number().int().nonnegative().nullable().optional(),
  minimumOrderQty: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export const VendorPricingFilterSchema = z.object({
  vendorId: z.string().uuid().optional(),
  itemMasterId: z.string().uuid().optional(),
  categoryName: z.string().optional(),
  pricingType: z.array(VendorPricingTypeSchema).optional(),
  isActive: z.boolean().optional(),
  effectiveAsOf: z.coerce.date().optional(),
});

export type CreateVendorPricing = z.infer<typeof CreateVendorPricingSchema>;
export type UpdateVendorPricing = z.infer<typeof UpdateVendorPricingSchema>;
export type VendorPricingFilter = z.infer<typeof VendorPricingFilterSchema>;

// ----- Vendor Certification Schemas -----

export const CreateVendorCertificationSchema = z.object({
  vendorId: z.string().uuid(),
  certificationType: VendorCertificationTypeSchema,
  certificationName: z.string().min(1).max(200),
  issuingBody: z.string().max(200).optional(),
  certificateNumber: z.string().max(100).optional(),
  issueDate: z.coerce.date(),
  expirationDate: z.coerce.date().optional(),
  documentUrl: z.string().url().optional(),
  notes: z.string().max(1000).optional(),
});

export const UpdateVendorCertificationSchema = z.object({
  certificationName: z.string().min(1).max(200).optional(),
  issuingBody: z.string().max(200).nullable().optional(),
  certificateNumber: z.string().max(100).nullable().optional(),
  issueDate: z.coerce.date().optional(),
  expirationDate: z.coerce.date().nullable().optional(),
  status: CertificationStatusSchema.optional(),
  documentUrl: z.string().url().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export const VendorCertificationFilterSchema = z.object({
  vendorId: z.string().uuid().optional(),
  certificationType: z.array(VendorCertificationTypeSchema).optional(),
  status: z.array(CertificationStatusSchema).optional(),
  expiringWithinDays: z.number().int().positive().optional(),
});

export type CreateVendorCertification = z.infer<typeof CreateVendorCertificationSchema>;
export type UpdateVendorCertification = z.infer<typeof UpdateVendorCertificationSchema>;
export type VendorCertificationFilter = z.infer<typeof VendorCertificationFilterSchema>;

// ----- Vendor Rating Schemas -----

export const CreateVendorRatingSchema = z.object({
  vendorId: z.string().uuid(),
  purchaseOrderId: z.string().uuid().optional(),
  qualityScore: z.number().int().min(1).max(5),
  deliveryScore: z.number().int().min(1).max(5),
  priceScore: z.number().int().min(1).max(5),
  communicationScore: z.number().int().min(1).max(5),
  overallScore: z.number().int().min(1).max(5),
  title: z.string().max(200).optional(),
  review: z.string().max(2000).optional(),
  pros: z.string().max(500).optional(),
  cons: z.string().max(500).optional(),
  wouldRecommend: z.boolean().default(true),
  isPublic: z.boolean().default(false),
});

export const UpdateVendorRatingSchema = z.object({
  qualityScore: z.number().int().min(1).max(5).optional(),
  deliveryScore: z.number().int().min(1).max(5).optional(),
  priceScore: z.number().int().min(1).max(5).optional(),
  communicationScore: z.number().int().min(1).max(5).optional(),
  overallScore: z.number().int().min(1).max(5).optional(),
  title: z.string().max(200).nullable().optional(),
  review: z.string().max(2000).nullable().optional(),
  pros: z.string().max(500).nullable().optional(),
  cons: z.string().max(500).nullable().optional(),
  wouldRecommend: z.boolean().optional(),
  isPublic: z.boolean().optional(),
});

export const VendorRatingFilterSchema = z.object({
  vendorId: z.string().uuid().optional(),
  ratedById: z.string().uuid().optional(),
  minOverallScore: z.number().int().min(1).max(5).optional(),
  maxOverallScore: z.number().int().min(1).max(5).optional(),
  wouldRecommend: z.boolean().optional(),
  isPublic: z.boolean().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
});

export type CreateVendorRating = z.infer<typeof CreateVendorRatingSchema>;
export type UpdateVendorRating = z.infer<typeof UpdateVendorRatingSchema>;
export type VendorRatingFilter = z.infer<typeof VendorRatingFilterSchema>;

// ----- Vendor Communication Schemas -----

export const CreateVendorCommunicationSchema = z.object({
  vendorId: z.string().uuid(),
  vendorContactId: z.string().uuid().optional(),
  channel: CommunicationChannelSchema,
  direction: CommunicationDirectionSchema,
  subject: z.string().max(200).optional(),
  content: z.string().min(1).max(10000),
  relatedEntityType: z.string().max(50).optional(),
  relatedEntityId: z.string().uuid().optional(),
  communicationDate: z.coerce.date().default(() => new Date()),
  followUpDate: z.coerce.date().optional(),
  attachmentUrls: z.array(z.string().url()).optional(),
  notes: z.string().max(1000).optional(),
});

export const UpdateVendorCommunicationSchema = z.object({
  subject: z.string().max(200).nullable().optional(),
  content: z.string().min(1).max(10000).optional(),
  followUpDate: z.coerce.date().nullable().optional(),
  followUpComplete: z.boolean().optional(),
  attachmentUrls: z.array(z.string().url()).optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export const VendorCommunicationFilterSchema = z.object({
  vendorId: z.string().uuid().optional(),
  vendorContactId: z.string().uuid().optional(),
  channel: z.array(CommunicationChannelSchema).optional(),
  direction: CommunicationDirectionSchema.optional(),
  userId: z.string().uuid().optional(),
  hasFollowUp: z.boolean().optional(),
  followUpComplete: z.boolean().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
});

export type CreateVendorCommunication = z.infer<typeof CreateVendorCommunicationSchema>;
export type UpdateVendorCommunication = z.infer<typeof UpdateVendorCommunicationSchema>;
export type VendorCommunicationFilter = z.infer<typeof VendorCommunicationFilterSchema>;

// ----- Quote Request Schemas -----

export const QuoteRequestLineItemSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().int().positive(),
  specs: z.string().max(1000).optional(),
  unitOfMeasure: z.string().max(50).optional(),
});

export const CreateQuoteRequestSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  requestType: QuoteRequestTypeSchema,
  lineItems: z.array(QuoteRequestLineItemSchema).min(1),
  vendorIds: z.array(z.string().uuid()).min(1),
  responseDeadline: z.coerce.date().optional(),
  requiredByDate: z.coerce.date().optional(),
  notes: z.string().max(2000).optional(),
});

export const UpdateQuoteRequestSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  requestType: QuoteRequestTypeSchema.optional(),
  status: QuoteRequestStatusSchema.optional(),
  lineItems: z.array(QuoteRequestLineItemSchema).min(1).optional(),
  responseDeadline: z.coerce.date().nullable().optional(),
  requiredByDate: z.coerce.date().nullable().optional(),
  selectedVendorId: z.string().uuid().nullable().optional(),
  selectedResponseId: z.string().uuid().nullable().optional(),
  selectionReason: z.string().max(1000).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const QuoteRequestFilterSchema = z.object({
  requestType: z.array(QuoteRequestTypeSchema).optional(),
  status: z.array(QuoteRequestStatusSchema).optional(),
  requestedById: z.string().uuid().optional(),
  vendorId: z.string().uuid().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
});

export type CreateQuoteRequest = z.infer<typeof CreateQuoteRequestSchema>;
export type UpdateQuoteRequest = z.infer<typeof UpdateQuoteRequestSchema>;
export type QuoteRequestFilter = z.infer<typeof QuoteRequestFilterSchema>;

// ----- Quote Response Schemas -----

export const QuoteResponseLineItemSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  totalPrice: z.number().nonnegative(),
});

export const RecordQuoteResponseSchema = z.object({
  responseId: z.string().uuid(),
  quoteNumber: z.string().max(50).optional(),
  totalAmount: z.number().nonnegative(),
  currency: z.string().length(3).default('USD'),
  validUntil: z.coerce.date().optional(),
  leadTimeDays: z.number().int().nonnegative().optional(),
  lineItems: z.array(QuoteResponseLineItemSchema).optional(),
  paymentTerms: z.string().max(200).optional(),
  shippingTerms: z.string().max(200).optional(),
  warranty: z.string().max(500).optional(),
  attachmentUrls: z.array(z.string().url()).optional(),
  notes: z.string().max(2000).optional(),
});

export const EvaluateQuoteResponseSchema = z.object({
  responseId: z.string().uuid(),
  evaluationScore: z.number().min(0).max(100),
  evaluationNotes: z.string().max(2000).optional(),
});

export const SelectQuoteResponseSchema = z.object({
  quoteRequestId: z.string().uuid(),
  selectedResponseId: z.string().uuid(),
  selectionReason: z.string().max(1000).optional(),
});

export type RecordQuoteResponse = z.infer<typeof RecordQuoteResponseSchema>;
export type EvaluateQuoteResponse = z.infer<typeof EvaluateQuoteResponseSchema>;
export type SelectQuoteResponse = z.infer<typeof SelectQuoteResponseSchema>;

// ============================================================================
// NEW-CRITICAL-07: ADVANCED SHIPPING & LOGISTICS SCHEMAS
// ============================================================================

import {
  ShippingRateType,
  FreightType,
  FreightQuoteStatus,
  DeliveryRouteStatus,
  DeliveryStopType,
  DeliveryStopStatus,
  TrackingEventType,
} from './enums.js';

// Enum schemas
export const ShippingRateTypeSchema = z.nativeEnum(ShippingRateType);
export const FreightTypeSchema = z.nativeEnum(FreightType);
export const FreightQuoteStatusSchema = z.nativeEnum(FreightQuoteStatus);
export const DeliveryRouteStatusSchema = z.nativeEnum(DeliveryRouteStatus);
export const DeliveryStopTypeSchema = z.nativeEnum(DeliveryStopType);
export const DeliveryStopStatusSchema = z.nativeEnum(DeliveryStopStatus);
export const TrackingEventTypeSchema = z.nativeEnum(TrackingEventType);

// ----- Carrier Account Schemas -----

export const CreateCarrierAccountSchema = z.object({
  carrier: z.string().min(1).max(50),
  accountName: z.string().min(1).max(100),
  accountNumber: z.string().min(1).max(50),
  apiKey: z.string().max(500).optional(),
  apiSecret: z.string().max(500).optional(),
  accessToken: z.string().max(1000).optional(),
  contactName: z.string().max(100).optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().max(20).optional(),
  defaultService: z.string().max(50).optional(),
  isDefault: z.boolean().default(false),
  discountPercent: z.number().min(0).max(100).optional(),
  fuelSurchargeRate: z.number().min(0).max(100).optional(),
  residentialSurcharge: z.number().nonnegative().optional(),
  pickupScheduled: z.boolean().default(false),
  pickupAddress: z.object({}).passthrough().optional(),
  notes: z.string().max(1000).optional(),
});

export const UpdateCarrierAccountSchema = z.object({
  accountName: z.string().min(1).max(100).optional(),
  apiKey: z.string().max(500).nullable().optional(),
  apiSecret: z.string().max(500).nullable().optional(),
  accessToken: z.string().max(1000).nullable().optional(),
  contactName: z.string().max(100).nullable().optional(),
  contactEmail: z.string().email().nullable().optional(),
  contactPhone: z.string().max(20).nullable().optional(),
  defaultService: z.string().max(50).nullable().optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
  discountPercent: z.number().min(0).max(100).nullable().optional(),
  fuelSurchargeRate: z.number().min(0).max(100).nullable().optional(),
  residentialSurcharge: z.number().nonnegative().nullable().optional(),
  pickupScheduled: z.boolean().optional(),
  pickupAddress: z.object({}).passthrough().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export type CreateCarrierAccount = z.infer<typeof CreateCarrierAccountSchema>;
export type UpdateCarrierAccount = z.infer<typeof UpdateCarrierAccountSchema>;

// ----- Shipping Rate Schemas -----

export const WeightBreakSchema = z.object({
  minWeight: z.number().nonnegative(),
  maxWeight: z.number().positive().optional(),
  rate: z.number().positive(),
});

export const CreateShippingRateSchema = z.object({
  carrierAccountId: z.string().uuid(),
  zoneId: z.string().uuid().optional(),
  serviceCode: z.string().min(1).max(50),
  serviceName: z.string().min(1).max(100),
  deliveryDays: z.number().int().positive().optional(),
  rateType: ShippingRateTypeSchema,
  weightBreaks: z.array(WeightBreakSchema).optional(),
  perPoundRate: z.number().positive().optional(),
  flatRate: z.number().positive().optional(),
  dimFactor: z.number().int().positive().optional(),
  fuelSurcharge: z.boolean().default(true),
  residentialSurcharge: z.number().nonnegative().optional(),
  deliveryAreaSurcharge: z.number().nonnegative().optional(),
  effectiveDate: z.coerce.date(),
  expirationDate: z.coerce.date().optional(),
  notes: z.string().max(1000).optional(),
});

export const UpdateShippingRateSchema = z.object({
  serviceName: z.string().min(1).max(100).optional(),
  deliveryDays: z.number().int().positive().nullable().optional(),
  rateType: ShippingRateTypeSchema.optional(),
  weightBreaks: z.array(WeightBreakSchema).nullable().optional(),
  perPoundRate: z.number().positive().nullable().optional(),
  flatRate: z.number().positive().nullable().optional(),
  dimFactor: z.number().int().positive().nullable().optional(),
  fuelSurcharge: z.boolean().optional(),
  residentialSurcharge: z.number().nonnegative().nullable().optional(),
  deliveryAreaSurcharge: z.number().nonnegative().nullable().optional(),
  expirationDate: z.coerce.date().nullable().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export const ShippingRateFilterSchema = z.object({
  carrierAccountId: z.string().uuid().optional(),
  zoneId: z.string().uuid().optional(),
  serviceCode: z.string().optional(),
  rateType: z.array(ShippingRateTypeSchema).optional(),
  isActive: z.boolean().optional(),
});

export type CreateShippingRate = z.infer<typeof CreateShippingRateSchema>;
export type UpdateShippingRate = z.infer<typeof UpdateShippingRateSchema>;
export type ShippingRateFilter = z.infer<typeof ShippingRateFilterSchema>;

// ----- Shipping Zone Schemas -----

export const ZipRangeSchema = z.object({
  start: z.string().min(1).max(10),
  end: z.string().min(1).max(10),
});

export const CreateShippingZoneSchema = z.object({
  zoneName: z.string().min(1).max(100),
  zoneCode: z.string().min(1).max(20),
  description: z.string().max(500).optional(),
  zipPrefixes: z.array(z.string().max(10)).optional(),
  zipRanges: z.array(ZipRangeSchema).optional(),
  statesCovered: z.array(z.string().length(2)).optional(),
  countryCodes: z.array(z.string().length(2)).optional(),
  isResidential: z.boolean().default(false),
  isRemote: z.boolean().default(false),
  isInternational: z.boolean().default(false),
  additionalHandling: z.boolean().default(false),
  holidayDelivery: z.boolean().default(true),
});

export const UpdateShippingZoneSchema = z.object({
  zoneName: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  zipPrefixes: z.array(z.string().max(10)).optional(),
  zipRanges: z.array(ZipRangeSchema).optional(),
  statesCovered: z.array(z.string().length(2)).optional(),
  countryCodes: z.array(z.string().length(2)).optional(),
  isResidential: z.boolean().optional(),
  isRemote: z.boolean().optional(),
  isInternational: z.boolean().optional(),
  additionalHandling: z.boolean().optional(),
  holidayDelivery: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export type CreateShippingZone = z.infer<typeof CreateShippingZoneSchema>;
export type UpdateShippingZone = z.infer<typeof UpdateShippingZoneSchema>;

// ----- Freight Quote Schemas -----

export const DimensionSchema = z.object({
  length: z.number().positive(),
  width: z.number().positive(),
  height: z.number().positive(),
});

export const CreateFreightQuoteSchema = z.object({
  workOrderId: z.string().uuid().optional(),
  freightType: FreightTypeSchema,
  originName: z.string().min(1).max(200),
  originAddress: z.string().min(1).max(500),
  originCity: z.string().min(1).max(100),
  originState: z.string().min(2).max(50),
  originZip: z.string().min(3).max(20),
  originCountry: z.string().length(2).default('US'),
  originContact: z.string().max(100).optional(),
  originPhone: z.string().max(20).optional(),
  destName: z.string().min(1).max(200),
  destAddress: z.string().min(1).max(500),
  destCity: z.string().min(1).max(100),
  destState: z.string().min(2).max(50),
  destZip: z.string().min(3).max(20),
  destCountry: z.string().length(2).default('US'),
  destContact: z.string().max(100).optional(),
  destPhone: z.string().max(20).optional(),
  destIsResidential: z.boolean().default(false),
  destHasLiftgate: z.boolean().default(false),
  destInsideDelivery: z.boolean().default(false),
  freightClass: z.string().max(10).optional(),
  pieces: z.number().int().positive().default(1),
  weight: z.number().positive(),
  pallets: z.number().int().positive().optional(),
  dimensions: z.array(DimensionSchema).optional(),
  stackable: z.boolean().default(true),
  hazmat: z.boolean().default(false),
  pickupDate: z.coerce.date().optional(),
  deliveryDate: z.coerce.date().optional(),
  guaranteedDelivery: z.boolean().default(false),
  notes: z.string().max(2000).optional(),
});

export const UpdateFreightQuoteSchema = z.object({
  status: FreightQuoteStatusSchema.optional(),
  freightClass: z.string().max(10).nullable().optional(),
  pieces: z.number().int().positive().optional(),
  weight: z.number().positive().optional(),
  pallets: z.number().int().positive().nullable().optional(),
  dimensions: z.array(DimensionSchema).nullable().optional(),
  pickupDate: z.coerce.date().nullable().optional(),
  deliveryDate: z.coerce.date().nullable().optional(),
  selectedQuoteIdx: z.number().int().nonnegative().nullable().optional(),
  freightCost: z.number().nonnegative().nullable().optional(),
  fuelSurcharge: z.number().nonnegative().nullable().optional(),
  accessorialCharges: z.number().nonnegative().nullable().optional(),
  totalCost: z.number().nonnegative().nullable().optional(),
  bookingReference: z.string().max(100).nullable().optional(),
  bolNumber: z.string().max(50).nullable().optional(),
  proNumber: z.string().max(50).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const FreightQuoteFilterSchema = z.object({
  workOrderId: z.string().uuid().optional(),
  freightType: z.array(FreightTypeSchema).optional(),
  status: z.array(FreightQuoteStatusSchema).optional(),
  requestedById: z.string().uuid().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
});

export type CreateFreightQuote = z.infer<typeof CreateFreightQuoteSchema>;
export type UpdateFreightQuote = z.infer<typeof UpdateFreightQuoteSchema>;
export type FreightQuoteFilter = z.infer<typeof FreightQuoteFilterSchema>;

// ----- Delivery Route Schemas -----

export const CreateDeliveryRouteSchema = z.object({
  routeDate: z.coerce.date(),
  routeName: z.string().max(100).optional(),
  driverId: z.string().uuid().optional(),
  vehicleInfo: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
});

export const UpdateDeliveryRouteSchema = z.object({
  routeName: z.string().max(100).nullable().optional(),
  driverId: z.string().uuid().nullable().optional(),
  vehicleInfo: z.string().max(200).nullable().optional(),
  status: DeliveryRouteStatusSchema.optional(),
  startTime: z.coerce.date().nullable().optional(),
  endTime: z.coerce.date().nullable().optional(),
  totalMiles: z.number().nonnegative().nullable().optional(),
  totalTime: z.number().int().nonnegative().nullable().optional(),
  optimized: z.boolean().optional(),
  routePolyline: z.string().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export const DeliveryRouteFilterSchema = z.object({
  routeDate: z.coerce.date().optional(),
  driverId: z.string().uuid().optional(),
  status: z.array(DeliveryRouteStatusSchema).optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
});

export type CreateDeliveryRoute = z.infer<typeof CreateDeliveryRouteSchema>;
export type UpdateDeliveryRoute = z.infer<typeof UpdateDeliveryRouteSchema>;
export type DeliveryRouteFilter = z.infer<typeof DeliveryRouteFilterSchema>;

// ----- Delivery Stop Schemas -----

export const AddDeliveryStopSchema = z.object({
  routeId: z.string().uuid(),
  stopOrder: z.number().int().positive(),
  shipmentId: z.string().uuid().optional(),
  workOrderId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  stopType: DeliveryStopTypeSchema,
  companyName: z.string().min(1).max(200),
  contactName: z.string().max(100).optional(),
  address: z.string().min(1).max(500),
  city: z.string().min(1).max(100),
  state: z.string().min(2).max(50),
  zip: z.string().min(3).max(20),
  phone: z.string().max(20).optional(),
  deliveryInstructions: z.string().max(1000).optional(),
  requiresSignature: z.boolean().default(false),
  requiresPhoto: z.boolean().default(false),
  scheduledArrival: z.coerce.date().optional(),
});

export const UpdateDeliveryStopSchema = z.object({
  stopOrder: z.number().int().positive().optional(),
  contactName: z.string().max(100).nullable().optional(),
  deliveryInstructions: z.string().max(1000).nullable().optional(),
  requiresSignature: z.boolean().optional(),
  requiresPhoto: z.boolean().optional(),
  scheduledArrival: z.coerce.date().nullable().optional(),
});

export const CompleteDeliveryStopSchema = z.object({
  stopId: z.string().uuid(),
  status: DeliveryStopStatusSchema,
  signedBy: z.string().max(100).optional(),
  signatureUrl: z.string().url().optional(),
  photoUrls: z.array(z.string().url()).optional(),
  deliveryNotes: z.string().max(1000).optional(),
});

export type AddDeliveryStop = z.infer<typeof AddDeliveryStopSchema>;
export type UpdateDeliveryStop = z.infer<typeof UpdateDeliveryStopSchema>;
export type CompleteDeliveryStop = z.infer<typeof CompleteDeliveryStopSchema>;

// ----- Tracking Event Schemas -----

export const CreateTrackingEventSchema = z.object({
  shipmentId: z.string().uuid(),
  carrierAccountId: z.string().uuid().optional(),
  eventType: TrackingEventTypeSchema,
  eventDate: z.coerce.date(),
  eventTime: z.coerce.date().optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(50).optional(),
  zip: z.string().max(20).optional(),
  country: z.string().max(50).optional(),
  description: z.string().min(1).max(500),
  signedBy: z.string().max(100).optional(),
  exceptionCode: z.string().max(50).optional(),
  exceptionReason: z.string().max(500).optional(),
  sourceSystem: z.string().max(50).optional(),
  rawData: z.object({}).passthrough().optional(),
});

export const TrackingEventFilterSchema = z.object({
  shipmentId: z.string().uuid().optional(),
  eventType: z.array(TrackingEventTypeSchema).optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
});

export type CreateTrackingEvent = z.infer<typeof CreateTrackingEventSchema>;
export type TrackingEventFilter = z.infer<typeof TrackingEventFilterSchema>;

// ============================================================================
// NEW-CRITICAL-08: Version Control & Revision Management
// ============================================================================

import {
  RevisionEntityType,
  RevisionType,
  ChangeReason,
  RevisionStatus,
  ApprovalWorkflow,
  DesignVersionStatus,
  ChangeOrderType,
  ChangeOrderPriority,
  ChangeOrderStatus,
  ChangeRequestSource,
  ChangeApprovalStatus,
} from './enums.js';

// Enum schemas
export const RevisionEntityTypeSchema = z.nativeEnum(RevisionEntityType);
export const RevisionTypeSchema = z.nativeEnum(RevisionType);
export const ChangeReasonSchema = z.nativeEnum(ChangeReason);
export const RevisionStatusSchema = z.nativeEnum(RevisionStatus);
export const ApprovalWorkflowSchema = z.nativeEnum(ApprovalWorkflow);
export const DesignVersionStatusSchema = z.nativeEnum(DesignVersionStatus);
export const ChangeOrderTypeSchema = z.nativeEnum(ChangeOrderType);
export const ChangeOrderPrioritySchema = z.nativeEnum(ChangeOrderPriority);
export const ChangeOrderStatusSchema = z.nativeEnum(ChangeOrderStatus);
export const ChangeRequestSourceSchema = z.nativeEnum(ChangeRequestSource);
export const ChangeApprovalStatusSchema = z.nativeEnum(ChangeApprovalStatus);

// Entity Revision Schemas
export const CreateEntityRevisionSchema = z.object({
  entityType: RevisionEntityTypeSchema,
  entityId: z.string().uuid(),
  revisionNumber: z.number().int().positive().optional(),
  majorVersion: z.number().int().nonnegative().optional(),
  minorVersion: z.number().int().nonnegative().optional(),
  versionLabel: z.string().max(50).optional(),
  revisionType: RevisionTypeSchema,
  changeReason: ChangeReasonSchema.optional(),
  status: RevisionStatusSchema.optional(),
  previousData: z.object({}).passthrough().optional(),
  currentData: z.object({}).passthrough().optional(),
  changedFields: z.array(z.string()).optional(),
  changeSummary: z.string().max(2000).optional(),
  createdById: z.string().uuid().optional(),
  approvalWorkflow: ApprovalWorkflowSchema.optional(),
  requiresCustomerApproval: z.boolean().optional(),
  parentRevisionId: z.string().uuid().optional(),
  changeOrderId: z.string().uuid().optional(),
  tags: z.array(z.string().max(50)).optional(),
  notes: z.string().max(2000).optional(),
});

export const UpdateEntityRevisionSchema = z.object({
  status: RevisionStatusSchema.optional(),
  versionLabel: z.string().max(50).optional(),
  changeSummary: z.string().max(2000).optional(),
  approvedById: z.string().uuid().optional(),
  approvedAt: z.coerce.date().optional(),
  rejectedById: z.string().uuid().optional(),
  rejectedAt: z.coerce.date().optional(),
  rejectionReason: z.string().max(1000).optional(),
  customerApprovedAt: z.coerce.date().optional(),
  customerApprovalNotes: z.string().max(1000).optional(),
  tags: z.array(z.string().max(50)).optional(),
  notes: z.string().max(2000).optional(),
  isActive: z.boolean().optional(),
  isCurrent: z.boolean().optional(),
});

export const EntityRevisionFilterSchema = z.object({
  entityType: RevisionEntityTypeSchema.optional(),
  entityId: z.string().uuid().optional(),
  revisionType: RevisionTypeSchema.optional(),
  status: RevisionStatusSchema.optional(),
  changeReason: ChangeReasonSchema.optional(),
  createdById: z.string().uuid().optional(),
  approvedById: z.string().uuid().optional(),
  isCurrent: z.boolean().optional(),
  isActive: z.boolean().optional(),
  minVersion: z.number().int().nonnegative().optional(),
  maxVersion: z.number().int().nonnegative().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  hasChangeOrder: z.boolean().optional(),
  requiresApproval: z.boolean().optional(),
});

export type CreateEntityRevision = z.infer<typeof CreateEntityRevisionSchema>;
export type UpdateEntityRevision = z.infer<typeof UpdateEntityRevisionSchema>;
export type EntityRevisionFilter = z.infer<typeof EntityRevisionFilterSchema>;

// Design Version Schemas
export const CreateDesignVersionSchema = z.object({
  designFileId: z.string().uuid(),
  versionNumber: z.number().int().positive().optional(),
  majorVersion: z.number().int().nonnegative().optional(),
  minorVersion: z.number().int().nonnegative().optional(),
  patchVersion: z.number().int().nonnegative().optional(),
  versionLabel: z.string().max(50).optional(),
  status: DesignVersionStatusSchema.optional(),
  filePath: z.string().min(1).max(500),
  fileUrl: z.string().url().optional(),
  thumbnailUrl: z.string().url().optional(),
  fileSize: z.number().int().nonnegative().optional(),
  fileHash: z.string().max(128).optional(),
  fileFormat: z.string().max(20).optional(),
  dimensions: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
    unit: z.enum(['INCHES', 'FEET', 'MM', 'CM', 'PIXELS']),
  }).optional(),
  colorProfile: z.string().max(50).optional(),
  resolution: z.number().int().positive().optional(),
  layerCount: z.number().int().nonnegative().optional(),
  linkedAssets: z.array(z.string()).optional(),
  createdById: z.string().uuid().optional(),
  changeDescription: z.string().max(1000).optional(),
  changeReason: ChangeReasonSchema.optional(),
  previousVersionId: z.string().uuid().optional(),
  tags: z.array(z.string().max(50)).optional(),
});

export const UpdateDesignVersionSchema = z.object({
  status: DesignVersionStatusSchema.optional(),
  versionLabel: z.string().max(50).optional(),
  thumbnailUrl: z.string().url().optional(),
  approvedById: z.string().uuid().optional(),
  approvedAt: z.coerce.date().optional(),
  reviewedById: z.string().uuid().optional(),
  reviewedAt: z.coerce.date().optional(),
  reviewNotes: z.string().max(2000).optional(),
  customerApprovedAt: z.coerce.date().optional(),
  customerSignatureUrl: z.string().url().optional(),
  customerNotes: z.string().max(1000).optional(),
  tags: z.array(z.string().max(50)).optional(),
  isLatest: z.boolean().optional(),
  isReleased: z.boolean().optional(),
});

export const DesignVersionFilterSchema = z.object({
  designFileId: z.string().uuid().optional(),
  status: DesignVersionStatusSchema.optional(),
  createdById: z.string().uuid().optional(),
  approvedById: z.string().uuid().optional(),
  isLatest: z.boolean().optional(),
  isReleased: z.boolean().optional(),
  minVersion: z.number().int().nonnegative().optional(),
  maxVersion: z.number().int().nonnegative().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  hasCustomerApproval: z.boolean().optional(),
});

export type CreateDesignVersion = z.infer<typeof CreateDesignVersionSchema>;
export type UpdateDesignVersion = z.infer<typeof UpdateDesignVersionSchema>;
export type DesignVersionFilter = z.infer<typeof DesignVersionFilterSchema>;

// Change Order Schemas
export const CreateChangeOrderSchema = z.object({
  changeOrderNumber: z.string().max(50).optional(),
  workOrderId: z.string().uuid().optional(),
  quoteId: z.string().uuid().optional(),
  type: ChangeOrderTypeSchema,
  priority: ChangeOrderPrioritySchema.optional(),
  status: ChangeOrderStatusSchema.optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  justification: z.string().max(2000).optional(),
  scopeImpact: z.string().max(2000).optional(),
  scheduleImpact: z.string().max(1000).optional(),
  scheduleDelayDays: z.number().int().optional(),
  costImpact: z.number().optional(),
  costChangePercent: z.number().min(-100).max(1000).optional(),
  qualityImpact: z.string().max(1000).optional(),
  riskAssessment: z.string().max(2000).optional(),
  requestSource: ChangeRequestSourceSchema,
  requestedById: z.string().uuid().optional(),
  customerRequestDate: z.coerce.date().optional(),
  customerContact: z.string().max(200).optional(),
  createdById: z.string().uuid().optional(),
  affectedItems: z.object({}).passthrough().optional(),
  attachments: z.array(z.string().url()).optional(),
});

export const UpdateChangeOrderSchema = z.object({
  type: ChangeOrderTypeSchema.optional(),
  priority: ChangeOrderPrioritySchema.optional(),
  status: ChangeOrderStatusSchema.optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  justification: z.string().max(2000).optional(),
  scopeImpact: z.string().max(2000).optional(),
  scheduleImpact: z.string().max(1000).optional(),
  scheduleDelayDays: z.number().int().optional(),
  costImpact: z.number().optional(),
  costChangePercent: z.number().min(-100).max(1000).optional(),
  qualityImpact: z.string().max(1000).optional(),
  riskAssessment: z.string().max(2000).optional(),
  internalApprovalStatus: ChangeApprovalStatusSchema.optional(),
  internalApprovedById: z.string().uuid().optional(),
  internalApprovedAt: z.coerce.date().optional(),
  internalNotes: z.string().max(2000).optional(),
  customerApprovalStatus: ChangeApprovalStatusSchema.optional(),
  customerApprovedAt: z.coerce.date().optional(),
  customerSignature: z.string().optional(),
  customerNotes: z.string().max(2000).optional(),
  implementedById: z.string().uuid().optional(),
  implementedAt: z.coerce.date().optional(),
  implementationNotes: z.string().max(2000).optional(),
  affectedItems: z.object({}).passthrough().optional(),
  attachments: z.array(z.string().url()).optional(),
});

export const ChangeOrderFilterSchema = z.object({
  workOrderId: z.string().uuid().optional(),
  quoteId: z.string().uuid().optional(),
  type: ChangeOrderTypeSchema.optional(),
  priority: ChangeOrderPrioritySchema.optional(),
  status: ChangeOrderStatusSchema.optional(),
  requestSource: ChangeRequestSourceSchema.optional(),
  requestedById: z.string().uuid().optional(),
  createdById: z.string().uuid().optional(),
  internalApprovalStatus: ChangeApprovalStatusSchema.optional(),
  customerApprovalStatus: ChangeApprovalStatusSchema.optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  hasCostImpact: z.boolean().optional(),
  hasScheduleImpact: z.boolean().optional(),
});

export type CreateChangeOrder = z.infer<typeof CreateChangeOrderSchema>;
export type UpdateChangeOrder = z.infer<typeof UpdateChangeOrderSchema>;
export type ChangeOrderFilter = z.infer<typeof ChangeOrderFilterSchema>;

// Version Comparison Schemas
export const CreateVersionComparisonSchema = z.object({
  entityType: RevisionEntityTypeSchema,
  entityId: z.string().uuid(),
  sourceRevisionId: z.string().uuid(),
  targetRevisionId: z.string().uuid(),
  fieldChanges: z.object({}).passthrough().optional(),
  addedFields: z.array(z.string()).optional(),
  removedFields: z.array(z.string()).optional(),
  modifiedFields: z.array(z.string()).optional(),
  visualDiffUrl: z.string().url().optional(),
  sideBySideUrl: z.string().url().optional(),
  overlayDiffUrl: z.string().url().optional(),
  changeSummary: z.string().max(2000).optional(),
  changeCount: z.number().int().nonnegative().optional(),
  significanceScore: z.number().min(0).max(100).optional(),
  comparedById: z.string().uuid().optional(),
  notes: z.string().max(2000).optional(),
});

export type CreateVersionComparison = z.infer<typeof CreateVersionComparisonSchema>;

// ============================================================================
// NEW-CRITICAL-09: Environmental & Sustainability Tracking
// ============================================================================

import {
  MaterialCategory,
  RecyclabilityRating,
  EnvironmentalCertificationType,
  ProductionWasteCategory,
  WasteDisposalMethod,
  EnergySource,
  EmissionScope,
  SustainabilityGoalType,
  GoalTimeframe,
} from './enums.js';

// Enum schemas
export const MaterialCategorySchema = z.nativeEnum(MaterialCategory);
export const RecyclabilityRatingSchema = z.nativeEnum(RecyclabilityRating);
export const EnvironmentalCertificationTypeSchema = z.nativeEnum(EnvironmentalCertificationType);
export const ProductionWasteCategorySchema = z.nativeEnum(ProductionWasteCategory);
export const WasteDisposalMethodSchema = z.nativeEnum(WasteDisposalMethod);
export const EnergySourceSchema = z.nativeEnum(EnergySource);
export const EmissionScopeSchema = z.nativeEnum(EmissionScope);
export const SustainabilityGoalTypeSchema = z.nativeEnum(SustainabilityGoalType);
export const GoalTimeframeSchema = z.nativeEnum(GoalTimeframe);

// Material Environmental Profile Schemas
export const CreateMaterialEnvironmentalProfileSchema = z.object({
  itemMasterId: z.string().uuid(),
  materialCategory: MaterialCategorySchema,
  primaryMaterial: z.string().max(100).optional(),
  materialWeight: z.number().positive().optional(),
  weightUnit: z.enum(['LBS', 'KG', 'OZ', 'G']).optional(),
  recyclabilityRating: RecyclabilityRatingSchema.optional(),
  recycledContentPercent: z.number().min(0).max(100).optional(),
  recyclablePercent: z.number().min(0).max(100).optional(),
  recyclingInstructions: z.string().max(1000).optional(),
  certifications: z.array(z.object({
    type: EnvironmentalCertificationTypeSchema,
    certNumber: z.string().max(100).optional(),
    validUntil: z.coerce.date().optional(),
  })).optional(),
  hasFscCertification: z.boolean().optional(),
  hasGreenguardCert: z.boolean().optional(),
  carbonFootprint: z.number().nonnegative().optional(),
  embodiedEnergy: z.number().nonnegative().optional(),
  waterUsage: z.number().nonnegative().optional(),
  vocContent: z.number().nonnegative().optional(),
  isVocFree: z.boolean().optional(),
  containsHazardous: z.boolean().optional(),
  hazardousMaterials: z.string().max(500).optional(),
  sdsDocumentUrl: z.string().url().optional(),
  biodegradable: z.boolean().optional(),
  compostable: z.boolean().optional(),
  expectedLifespan: z.number().int().positive().optional(),
  disposalMethod: WasteDisposalMethodSchema.optional(),
  disposalInstructions: z.string().max(1000).optional(),
  supplierSustainabilityScore: z.number().min(0).max(100).optional(),
  locallySourced: z.boolean().optional(),
  distanceFromSource: z.number().nonnegative().optional(),
  dataSource: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
});

export const UpdateMaterialEnvironmentalProfileSchema = CreateMaterialEnvironmentalProfileSchema.partial().omit({ itemMasterId: true });

export type CreateMaterialEnvironmentalProfile = z.infer<typeof CreateMaterialEnvironmentalProfileSchema>;
export type UpdateMaterialEnvironmentalProfile = z.infer<typeof UpdateMaterialEnvironmentalProfileSchema>;

// Waste Log Entry Schemas
export const CreateWasteLogEntrySchema = z.object({
  workOrderId: z.string().uuid().optional(),
  stationId: z.string().max(50).optional(),
  category: ProductionWasteCategorySchema,
  materialType: z.string().max(200).optional(),
  itemMasterId: z.string().uuid().optional(),
  quantity: z.number().positive(),
  unit: z.string().max(20),
  estimatedWeight: z.number().nonnegative().optional(),
  disposalMethod: WasteDisposalMethodSchema,
  disposalVendorId: z.string().uuid().optional(),
  disposalCost: z.number().nonnegative().optional(),
  disposalDate: z.coerce.date().optional(),
  disposalDocumentUrl: z.string().url().optional(),
  manifestNumber: z.string().max(100).optional(),
  carbonOffset: z.number().optional(),
  recyclableValue: z.number().nonnegative().optional(),
  loggedById: z.string().uuid().optional(),
  notes: z.string().max(1000).optional(),
});

export const WasteLogFilterSchema = z.object({
  workOrderId: z.string().uuid().optional(),
  category: ProductionWasteCategorySchema.optional(),
  disposalMethod: WasteDisposalMethodSchema.optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  disposalVendorId: z.string().uuid().optional(),
  loggedById: z.string().uuid().optional(),
});

export type CreateWasteLogEntry = z.infer<typeof CreateWasteLogEntrySchema>;
export type WasteLogFilter = z.infer<typeof WasteLogFilterSchema>;

// Energy Consumption Record Schemas
export const CreateEnergyConsumptionRecordSchema = z.object({
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  energySource: EnergySourceSchema,
  equipmentId: z.string().uuid().optional(),
  areaName: z.string().max(100).optional(),
  quantity: z.number().positive(),
  unit: z.string().max(20),
  kwhEquivalent: z.number().nonnegative().optional(),
  cost: z.number().nonnegative().optional(),
  ratePerUnit: z.number().nonnegative().optional(),
  carbonEmissions: z.number().nonnegative().optional(),
  emissionScope: EmissionScopeSchema.optional(),
  renewablePercent: z.number().min(0).max(100).optional(),
  previousPeriodQty: z.number().nonnegative().optional(),
  baselineQty: z.number().nonnegative().optional(),
  meterNumber: z.string().max(50).optional(),
  meterReadingStart: z.number().nonnegative().optional(),
  meterReadingEnd: z.number().nonnegative().optional(),
  isEstimated: z.boolean().optional(),
  recordedById: z.string().uuid().optional(),
  notes: z.string().max(1000).optional(),
});

export const EnergyConsumptionFilterSchema = z.object({
  energySource: EnergySourceSchema.optional(),
  equipmentId: z.string().uuid().optional(),
  areaName: z.string().max(100).optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  isEstimated: z.boolean().optional(),
});

export type CreateEnergyConsumptionRecord = z.infer<typeof CreateEnergyConsumptionRecordSchema>;
export type EnergyConsumptionFilter = z.infer<typeof EnergyConsumptionFilterSchema>;

// Carbon Emission Record Schemas
export const CreateCarbonEmissionRecordSchema = z.object({
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  emissionScope: EmissionScopeSchema,
  sourceCategory: z.string().min(1).max(100),
  sourceDescription: z.string().max(500).optional(),
  emissionsKgCo2e: z.number().nonnegative(),
  emissionsMtCo2e: z.number().nonnegative().optional(),
  activityType: z.string().max(100).optional(),
  activityQuantity: z.number().nonnegative().optional(),
  activityUnit: z.string().max(20).optional(),
  emissionFactor: z.number().nonnegative().optional(),
  emissionFactorSource: z.string().max(200).optional(),
  workOrderId: z.string().uuid().optional(),
  energyRecordId: z.string().uuid().optional(),
  shipmentId: z.string().uuid().optional(),
  vendorId: z.string().uuid().optional(),
  offsetsApplied: z.number().nonnegative().optional(),
  offsetCertificateUrl: z.string().url().optional(),
  calculatedById: z.string().uuid().optional(),
  methodology: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
});

export const CarbonEmissionFilterSchema = z.object({
  emissionScope: EmissionScopeSchema.optional(),
  sourceCategory: z.string().max(100).optional(),
  workOrderId: z.string().uuid().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  hasOffsets: z.boolean().optional(),
});

export type CreateCarbonEmissionRecord = z.infer<typeof CreateCarbonEmissionRecordSchema>;
export type CarbonEmissionFilter = z.infer<typeof CarbonEmissionFilterSchema>;

// Sustainability Goal Schemas
export const CreateSustainabilityGoalSchema = z.object({
  goalType: SustainabilityGoalTypeSchema,
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  timeframe: GoalTimeframeSchema,
  startDate: z.coerce.date(),
  targetDate: z.coerce.date(),
  baselineValue: z.number(),
  baselineDate: z.coerce.date(),
  targetValue: z.number(),
  targetUnit: z.string().max(20),
  isReduction: z.boolean().optional(),
  appliesToArea: z.string().max(100).optional(),
  appliesToCategory: z.string().max(100).optional(),
  ownerId: z.string().uuid().optional(),
  createdById: z.string().uuid().optional(),
  notes: z.string().max(2000).optional(),
});

export const UpdateSustainabilityGoalSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  targetDate: z.coerce.date().optional(),
  targetValue: z.number().optional(),
  currentValue: z.number().optional(),
  lastMeasuredAt: z.coerce.date().optional(),
  progressPercent: z.number().min(0).max(100).optional(),
  onTrack: z.boolean().optional(),
  isActive: z.boolean().optional(),
  achievedAt: z.coerce.date().optional(),
  notes: z.string().max(2000).optional(),
});

export const SustainabilityGoalFilterSchema = z.object({
  goalType: SustainabilityGoalTypeSchema.optional(),
  timeframe: GoalTimeframeSchema.optional(),
  isActive: z.boolean().optional(),
  ownerId: z.string().uuid().optional(),
  onTrack: z.boolean().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
});

export type CreateSustainabilityGoal = z.infer<typeof CreateSustainabilityGoalSchema>;
export type UpdateSustainabilityGoal = z.infer<typeof UpdateSustainabilityGoalSchema>;
export type SustainabilityGoalFilter = z.infer<typeof SustainabilityGoalFilterSchema>;

// Sustainability Snapshot Schemas
export const CreateSustainabilitySnapshotSchema = z.object({
  goalId: z.string().uuid(),
  snapshotDate: z.coerce.date(),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  measuredValue: z.number(),
  unit: z.string().max(20),
  changeFromPrevious: z.number().optional(),
  changePercent: z.number().optional(),
  context: z.string().max(1000).optional(),
  affectingFactors: z.string().max(1000).optional(),
  recordedById: z.string().uuid().optional(),
});

export type CreateSustainabilitySnapshot = z.infer<typeof CreateSustainabilitySnapshotSchema>;

// ============================================================================
// NEW-CRITICAL-10: Advanced Pricing & Quote Intelligence
// ============================================================================

import {
  PricingStrategy,
  QuoteConfidenceLevel,
  PriceAdjustmentType,
  PricingRuleCondition,
  CompetitorPriceSource,
  QuoteOutcome,
  CustomerPriceSegment,
  CustomerLoyaltyTier,
} from './enums.js';

// Enum schemas
export const PricingStrategySchema = z.nativeEnum(PricingStrategy);
export const QuoteConfidenceLevelSchema = z.nativeEnum(QuoteConfidenceLevel);
export const PriceAdjustmentTypeSchema = z.nativeEnum(PriceAdjustmentType);
export const PricingRuleConditionSchema = z.nativeEnum(PricingRuleCondition);
export const CompetitorPriceSourceSchema = z.nativeEnum(CompetitorPriceSource);
export const QuoteOutcomeSchema = z.nativeEnum(QuoteOutcome);
export const CustomerPriceSegmentSchema = z.nativeEnum(CustomerPriceSegment);
export const CustomerLoyaltyTierSchema = z.nativeEnum(CustomerLoyaltyTier);

// Pricing Rule Schemas
export const CreatePricingRuleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  priority: z.number().int().min(1).max(1000).optional(),
  isActive: z.boolean().optional(),
  conditions: z.array(z.object({
    field: z.string(),
    operator: z.string(),
    value: z.union([z.string(), z.number(), z.boolean()]),
  })),
  conditionLogic: z.enum(['AND', 'OR']).optional(),
  adjustmentType: PriceAdjustmentTypeSchema,
  adjustmentValue: z.number(),
  minAdjustment: z.number().optional(),
  maxAdjustment: z.number().optional(),
  appliesToProducts: z.array(z.string()).optional(),
  appliesToCustomers: z.array(z.string()).optional(),
  excludeProducts: z.array(z.string()).optional(),
  excludeCustomers: z.array(z.string()).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  usageLimit: z.number().int().positive().optional(),
  stackable: z.boolean().optional(),
  stackOrder: z.number().int().optional(),
  createdById: z.string().uuid().optional(),
});

export const UpdatePricingRuleSchema = CreatePricingRuleSchema.partial().omit({ createdById: true });

export const PricingRuleFilterSchema = z.object({
  isActive: z.boolean().optional(),
  adjustmentType: PriceAdjustmentTypeSchema.optional(),
  appliesToProducts: z.array(z.string()).optional(),
  appliesToCustomers: z.array(z.string()).optional(),
  validNow: z.boolean().optional(),
});

export type CreatePricingRule = z.infer<typeof CreatePricingRuleSchema>;
export type UpdatePricingRule = z.infer<typeof UpdatePricingRuleSchema>;
export type PricingRuleFilter = z.infer<typeof PricingRuleFilterSchema>;

// Quote Scorecard Schemas
export const CreateQuoteScorecardSchema = z.object({
  quoteId: z.string().uuid(),
  winProbability: z.number().min(0).max(100).optional(),
  confidenceLevel: QuoteConfidenceLevelSchema.optional(),
  estimatedMargin: z.number().optional(),
  estimatedProfit: z.number().optional(),
  profitabilityScore: z.number().min(0).max(100).optional(),
  strategicScore: z.number().min(0).max(100).optional(),
  strategicFactors: z.array(z.string()).optional(),
  riskScore: z.number().min(0).max(100).optional(),
  riskFactors: z.array(z.string()).optional(),
  complexityScore: z.number().min(0).max(100).optional(),
  complexityFactors: z.array(z.string()).optional(),
  recommendations: z.array(z.string()).optional(),
  calculatedById: z.string().uuid().optional(),
});

export type CreateQuoteScorecard = z.infer<typeof CreateQuoteScorecardSchema>;

// Competitor Price Schemas
export const CreateCompetitorPriceSchema = z.object({
  competitorName: z.string().min(1).max(200),
  competitorId: z.string().uuid().optional(),
  productCategory: z.string().min(1).max(100),
  productDescription: z.string().max(500).optional(),
  price: z.number().positive(),
  priceUnit: z.string().max(20).optional(),
  currency: z.string().length(3).optional(),
  source: CompetitorPriceSourceSchema,
  sourceUrl: z.string().url().optional(),
  sourceDocument: z.string().max(200).optional(),
  observedAt: z.coerce.date(),
  validFrom: z.coerce.date().optional(),
  validUntil: z.coerce.date().optional(),
  confidenceLevel: z.number().int().min(1).max(5).optional(),
  isVerified: z.boolean().optional(),
  notes: z.string().max(1000).optional(),
  recordedById: z.string().uuid().optional(),
});

export const CompetitorPriceFilterSchema = z.object({
  competitorName: z.string().optional(),
  productCategory: z.string().optional(),
  source: CompetitorPriceSourceSchema.optional(),
  isVerified: z.boolean().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
});

export type CreateCompetitorPrice = z.infer<typeof CreateCompetitorPriceSchema>;
export type CompetitorPriceFilter = z.infer<typeof CompetitorPriceFilterSchema>;

// Quote Analysis Schemas
export const CreateQuoteAnalysisSchema = z.object({
  quoteId: z.string().uuid(),
  outcome: QuoteOutcomeSchema,
  outcomeReason: z.string().max(200).optional(),
  outcomeDetails: z.string().max(2000).optional(),
  lostToCompetitor: z.string().max(200).optional(),
  competitorPrice: z.number().positive().optional(),
  priceWasReason: z.boolean().optional(),
  priceCompetitiveness: z.number().min(0).max(100).optional(),
  responseTime: z.number().int().nonnegative().optional(),
  proposalQuality: z.number().min(0).max(100).optional(),
  relationshipStrength: z.number().min(0).max(100).optional(),
  lessonsLearned: z.string().max(2000).optional(),
  improvementAreas: z.array(z.string()).optional(),
  followUpRequired: z.boolean().optional(),
  followUpNotes: z.string().max(1000).optional(),
  followUpDate: z.coerce.date().optional(),
  analyzedById: z.string().uuid().optional(),
});

export const QuoteAnalysisFilterSchema = z.object({
  outcome: QuoteOutcomeSchema.optional(),
  lostToCompetitor: z.string().optional(),
  priceWasReason: z.boolean().optional(),
  followUpRequired: z.boolean().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
});

export type CreateQuoteAnalysis = z.infer<typeof CreateQuoteAnalysisSchema>;
export type QuoteAnalysisFilter = z.infer<typeof QuoteAnalysisFilterSchema>;

// Customer Price Profile Schemas
export const UpdateCustomerPriceProfileSchema = z.object({
  priceElasticity: z.number().min(0).max(10).optional(),
  sensitivityScore: z.number().min(0).max(100).optional(),
  preferredPricing: PricingStrategySchema.optional(),
  avgAcceptedDiscount: z.number().min(0).max(100).optional(),
  avgRejectedPrice: z.number().positive().optional(),
  priceThreshold: z.number().positive().optional(),
  lifetimeValue: z.number().nonnegative().optional(),
  avgOrderValue: z.number().nonnegative().optional(),
  orderFrequency: z.number().nonnegative().optional(),
  paymentTermsPreferred: z.string().max(50).optional(),
  avgDaysToPayment: z.number().nonnegative().optional(),
  negotiatesOften: z.boolean().optional(),
  typicalCounterOffer: z.number().min(0).max(100).optional(),
  priceSegment: CustomerPriceSegmentSchema.optional(),
  loyaltyTier: CustomerLoyaltyTierSchema.optional(),
});

export type UpdateCustomerPriceProfile = z.infer<typeof UpdateCustomerPriceProfileSchema>;

// ─── Equipment Watch Rule Schemas ───────────────────────────────────────────

export const CreateEquipmentWatchRuleSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional().nullable(),
  dataSources: z.array(z.string().min(1)).min(1),
  metricField: z.string().min(1).optional().nullable(),
  operator: z.enum(['LESS_THAN', 'LESS_THAN_OR_EQUAL', 'GREATER_THAN', 'GREATER_THAN_OR_EQUAL', 'EQUALS', 'NOT_EQUALS']),
  threshold: z.number(),
  equipmentId: z.string().uuid().optional().nullable(),
  recipients: z.array(z.string().email()).min(1),
  emailSubject: z.string().min(1).max(500).default('Equipment Alert: {{ruleName}}'),
  emailBodyHtml: z.string().max(10000).optional().nullable(),
  scheduleTime: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:mm format').default('17:00'),
  scheduleDays: z.array(z.number().min(1).max(7)).min(1).default([1, 2, 3, 4, 5]),
  isActive: z.boolean().default(true),
});

export const UpdateEquipmentWatchRuleSchema = CreateEquipmentWatchRuleSchema.partial();

export type CreateEquipmentWatchRule = z.infer<typeof CreateEquipmentWatchRuleSchema>;
export type UpdateEquipmentWatchRule = z.infer<typeof UpdateEquipmentWatchRuleSchema>;

// ─── Production List Integration Schemas ─────────────────────────────────────

/** Schema for importing/syncing from a Production List spreadsheet */
export const ProductionListSyncSchema = z.object({
  direction: z.enum(['IMPORT', 'EXPORT', 'BIDIRECTIONAL']).default('IMPORT'),
  /** Server-side file path to the production list workbook */
  filePath: z.string().min(1).optional(),
  /** Whether to do a dry run (preview only) */
  dryRun: z.boolean().default(false),
  /** Whether to overwrite ERP data with spreadsheet data on conflicts */
  preferSpreadsheet: z.boolean().default(false),
  /** Sections to include (all if empty) */
  sections: z.array(z.string()).optional(),
});

/** Schema for exporting ERP data to Production List format */
export const ProductionListExportSchema = z.object({
  /** Which sections to include */
  sections: z.array(z.string()).optional(),
  /** Include completed/shipped orders */
  includeCompleted: z.boolean().default(false),
  /** Include on-hold orders */
  includeOnHold: z.boolean().default(true),
  /** Export date for the header */
  listDate: z.string().optional(),
  /** Export format */
  format: z.enum(['xlsx', 'csv', 'json']).default('json'),
});

/** Schema for mapping a Production List row to an ERP order */
export const ProductionListLinkSchema = z.object({
  orderNumber: z.string().min(1),
  erpOrderId: z.string().uuid(),
});

export type ProductionListSyncInput = z.infer<typeof ProductionListSyncSchema>;
export type ProductionListExportInput = z.infer<typeof ProductionListExportSchema>;
export type ProductionListLinkInput = z.infer<typeof ProductionListLinkSchema>;

// ============ QuickBooks Cache Schemas ============

export const QBCacheLineItemSchema = z.object({
  lineNumber: z.number().int().min(1),
  itemName: z.string().nullable(),
  description: z.string().nullable(),
  quantity: z.number().nullable(),
  rate: z.number().nullable(),
  amount: z.number(),
  unit: z.string().nullable(),
});

export const QBCacheOrderSchema = z.object({
  refNumber: z.string().min(1),
  txnId: z.string().nullable(),
  type: z.enum(['invoice', 'salesOrder', 'estimate']),
  customerName: z.string().min(1),
  totalAmount: z.number(),
  poNumber: z.string().nullable(),
  txnDate: z.string().nullable(), // ISO date
  memo: z.string().nullable(),
  lineItems: z.array(QBCacheLineItemSchema),
});

export const QBCacheImportPayloadSchema = z.object({
  source: z.enum(['agent', 'csv', 'odbc', 'manual']),
  agentVersion: z.string().optional(),
  exportedAt: z.string(),
  orders: z.array(QBCacheOrderSchema).min(1, 'At least one order is required'),
});

export type QBCacheLineItemInput = z.infer<typeof QBCacheLineItemSchema>;
export type QBCacheOrderInput = z.infer<typeof QBCacheOrderSchema>;
export type QBCacheImportPayloadInput = z.infer<typeof QBCacheImportPayloadSchema>;