import {
  OrderStatus,
  PrintingMethod,
  StationStatus,
  EventType,
  ReprintReason,
  InventoryStatus,
  UserRole,
  QuoteStatus,
  NotificationType,
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
  RipJobStatus,
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
  ShortcutCategory,
  PredictionModelType,
  OptimizationRuleType,
  OptimizationCategory,
  EquipmentStatus,
  RoutingDecisionType,
  RoutingTrigger,
  DecisionMaker,
  DecisionOutcome,
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
  // Scheduling & Capacity enums
  ResourceType,
  CalendarEventType,
  RecurrencePattern,
  CapacityGranularity,
  CapacityPlanStatus,
  SkillLevel,
  ScheduleConflictType,
  ConflictResolutionStatus,
  // Customer Relationship enums
  CustomerRelationType,
  ContactRole,
  PreferredContactMethod,
  CustomerTier,
  CommunicationChannel,
  CommunicationDirection,
  CommunicationSentiment,
  // Inventory & Supply Chain enums
  ForecastMethod,
  ForecastStatus,
  ForecastGranularity,
  SupplierTier,
  PerformanceCategory,
  SubstitutionType,
  InventoryTransactionType,
  ReservationStatus,
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
  // Audit Phase 1.1 - Added missing enums
  PricingUnit,
  ValidationTrigger,
  ConstraintSeverity,
  AnomalySeverity,
  AnomalyStatus,
  // Audit Phase 2.1 - Enums for missing types
  DocumentCategory,
  SubcontractStatus,
  RecurringFrequency,
  EmailTrigger,
  // File Chain & Shop Floor enums
  FileChainStatus,
  LinkConfidence,
  CutFileSource,
  ProductionFileType,
  ShopFloorStation,
} from './enums.js';

// ============ Work Order Types ============

export interface WorkOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  description: string;
  status: OrderStatus;
  priority: number;
  dueDate: Date | null;
  notes: string | null;
  routing: PrintingMethod[];
  stationProgress: StationProgress[];
  lineItems: LineItem[];
  events: WorkEvent[];
  timeEntries: TimeEntry[];
  reprintRequests: ReprintRequest[];
  createdAt: Date;
  updatedAt: Date;
  createdById: string;
  assignedToId: string | null;
  nestingEnabled?: boolean;
  nestingFileName?: string | null;
}

export interface LineItem {
  id: string;
  orderId: string;
  itemNumber: number;
  description: string;
  quantity: number;
  unitPrice: number;
  notes: string | null;
  itemMasterId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface StationProgress {
  id: string;
  orderId: string;
  station: PrintingMethod;
  status: StationStatus;
  startedAt: Date | null;
  completedAt: Date | null;
  completedById: string | null;
}

export interface WorkEvent {
  id: string;
  orderId: string;
  eventType: EventType;
  description: string;
  details: Record<string, unknown> | null;
  createdAt: Date;
  userId: string;
}

export interface TimeEntry {
  id: string;
  orderId: string;
  station: PrintingMethod;
  userId: string;
  startTime: Date;
  endTime: Date | null;
  durationMinutes: number | null;
  notes: string | null;
}

export interface ReprintRequest {
  id: string;
  orderId: string;
  lineItemId: string | null;
  reason: ReprintReason;
  description: string;
  quantity: number;
  requestedById: string;
  resolvedAt: Date | null;
  resolvedById: string | null;
  createdAt: Date;
}

// ============ User Types ============

export interface User {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  role: UserRole;
  isActive: boolean;
  allowedStations: PrintingMethod[];
  createdAt: Date;
  updatedAt: Date;
}

export interface UserWithPassword extends User {
  passwordHash: string;
}

// ============ Item Master Types ============

export interface ItemMaster {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  category: string | null;
  unitPrice: number;
  costPrice: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============ Inventory Types ============

export interface InventoryItem {
  id: string;
  itemMasterId: string;
  location: string | null;
  quantity: number;
  status: InventoryStatus;
  notes: string | null;
  linkedOrderId: string | null;
  linkedLineItemId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============ Template Types ============

export interface OrderTemplate {
  id: string;
  name: string;
  description: string | null;
  customerName: string | null;
  defaultRouting: PrintingMethod[];
  lineItemTemplates: LineItemTemplate[];
  createdAt: Date;
  updatedAt: Date;
  createdById: string;
}

export interface LineItemTemplate {
  id: string;
  templateId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  itemMasterId: string | null;
}

// ============ Customer Types ============

export interface Customer {
  id: string;
  name: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  notes: string | null;
  taxExempt: boolean;
  creditLimit: number | null;
  paymentTerms: string | null;
  isActive: boolean;
  contacts: CustomerContact[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerContact {
  id: string;
  customerId: string;
  name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  isPrimary: boolean;
  notes: string | null;
}

// ============ Quote Types ============

export interface Quote {
  id: string;
  quoteNumber: string;
  status: QuoteStatus;
  customerName: string;
  description: string | null;
  validUntil: Date | null;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discountPercent: number;
  discountAmount: number;
  total: number;
  notes: string | null;
  internalNotes: string | null;
  sentAt: Date | null;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  convertedAt: Date | null;
  lostReason: string | null;
  customerId: string | null;
  customer?: Customer;
  createdById: string;
  createdBy?: User;
  assignedToId: string | null;
  assignedTo?: User;
  convertedOrderId: string | null;
  lineItems: QuoteLineItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface QuoteLineItem {
  id: string;
  quoteId: string;
  itemNumber: number;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes: string | null;
  itemMasterId: string | null;
  itemMaster?: ItemMaster;
  createdAt: Date;
  updatedAt: Date;
}

// ============ API Response Types ============

/** Standard API response wrapper */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  details?: unknown;
}

/** Successful API response */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
}

/** Error API response */
export interface ApiErrorResponse {
  success: false;
  error: string;
  message?: string;
  details?: unknown;
}

/** Rate limit information returned in headers/response */
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
  retryAfter?: number;
}

/** Paginated response with metadata */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/** Paginated API response */
export type PaginatedApiResponse<T> = ApiSuccessResponse<PaginatedResponse<T>>;

/** List response (non-paginated) */
export interface ListResponse<T> {
  items: T[];
  total: number;
}

/** Auth response for login/refresh */
export interface AuthResponse {
  token: string;
  user: User;
  expiresAt: Date;
}

/** Bulk operation result */
export interface BulkOperationResult {
  total: number;
  successful: number;
  failed: number;
  errors?: Array<{ id: string; error: string }>;
}

/** Delete confirmation response */
export interface DeleteResponse {
  deleted: boolean;
  id: string;
}

// ============ WebSocket Message Types ============

export enum WsMessageType {
  ORDER_CREATED = 'ORDER_CREATED',
  ORDER_UPDATED = 'ORDER_UPDATED',
  ORDER_DELETED = 'ORDER_DELETED',
  FILE_CHAIN_UPDATED = 'FILE_CHAIN_UPDATED',
  STATION_UPDATED = 'STATION_UPDATED',
  USER_JOINED = 'USER_JOINED',
  USER_LEFT = 'USER_LEFT',
  PING = 'PING',
  PONG = 'PONG',
  NOTIFICATION_CREATED = 'NOTIFICATION_CREATED',
  AUTHENTICATED = 'AUTHENTICATED',
  AUTH_ERROR = 'AUTH_ERROR',
}

export interface WsMessage<T = unknown> {
  type: WsMessageType | string;
  payload: T;
  timestamp?: Date;
  targetUserId?: string;
}

// ============ Notification Types ============

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  data: Record<string, unknown> | null;
  createdAt: Date;
}

// ============ QuickBooks Types (Read-Only) ============

export interface QBCustomer {
  listId: string;
  name: string;
  fullName: string;
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  altPhone: string | null;
  fax: string | null;
  billAddress: QBAddress | null;
  shipAddress: QBAddress | null;
  balance: number;
  totalBalance: number;
  isActive: boolean;
  editSequence: string;
  timeCreated: Date;
  timeModified: Date;
}

export interface QBAddress {
  addr1: string | null;
  addr2: string | null;
  addr3: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
}

export interface QBInvoice {
  txnId: string;
  txnNumber: string;
  refNumber: string | null;
  customerRef: { listId: string; fullName: string };
  txnDate: Date;
  dueDate: Date | null;
  shipDate: Date | null;
  subtotal: number;
  salesTaxTotal: number;
  appliedAmount: number;
  balanceRemaining: number;
  isPaid: boolean;
  isPending: boolean;
  memo: string | null;
  poNumber: string | null;
  lineItems: QBInvoiceLineItem[];
  editSequence: string;
  timeCreated: Date;
  timeModified: Date;
}

export interface QBInvoiceLineItem {
  txnLineId: string;
  itemRef: { listId: string; fullName: string } | null;
  description: string | null;
  quantity: number | null;
  unitOfMeasure: string | null;
  rate: number | null;
  amount: number;
}

export interface QBItem {
  listId: string;
  name: string;
  fullName: string;
  type: 'Service' | 'Inventory' | 'NonInventory' | 'OtherCharge' | 'Subtotal' | 'Group' | 'Discount' | 'Payment' | 'SalesTax' | 'SalesTaxGroup';
  description: string | null;
  price: number | null;
  cost: number | null;
  isActive: boolean;
  quantityOnHand: number | null;
  quantityOnOrder: number | null;
  editSequence: string;
  timeCreated: Date;
  timeModified: Date;
}

export interface QBEstimate {
  txnId: string;
  txnNumber: string;
  refNumber: string | null;
  customerRef: { listId: string; fullName: string };
  txnDate: Date;
  dueDate: Date | null;
  subtotal: number;
  salesTaxTotal: number;
  totalAmount: number;
  isActive: boolean;
  memo: string | null;
  poNumber: string | null;
  lineItems: QBInvoiceLineItem[];
  editSequence: string;
  timeCreated: Date;
  timeModified: Date;
}

export interface QBSalesOrder {
  txnId: string;
  txnNumber: string;
  refNumber: string | null;
  customerRef: { listId: string; fullName: string };
  txnDate: Date;
  dueDate: Date | null;
  shipDate: Date | null;
  subtotal: number;
  salesTaxTotal: number;
  totalAmount: number;
  isManuallyClosed: boolean;
  isFullyInvoiced: boolean;
  memo: string | null;
  poNumber: string | null;
  lineItems: QBInvoiceLineItem[];
  editSequence: string;
  timeCreated: Date;
  timeModified: Date;
}

export interface QBConnectionStatus {
  connected: boolean;
  serverHost: string;
  companyFile: string | null;
  lastSync: Date | null;
  error: string | null;
}

// QuickBooks Payment (Received Payment)
export interface QBPayment {
  txnId: string;
  txnNumber: string;
  refNumber: string | null;
  customerListId: string;
  customerName: string;
  txnDate: Date;
  totalAmount: number;
  paymentMethodName: string | null;
  depositToAccount: string | null;
  memo: string | null;
  editSequence: string;
  timeCreated: Date;
  timeModified: Date;
  appliedToInvoices: QBPaymentAppliedTo[];
}

// Payment applied to specific invoice
export interface QBPaymentAppliedTo {
  invoiceTxnId: string;
  invoiceRefNumber: string | null;
  appliedAmount: number;
  balanceRemaining: number;
}

// ============ QuickBooks Cache Types ============

/** A single line item in a cached QB order */
export interface QBCacheLineItem {
  lineNumber: number;
  itemName: string | null;
  description: string | null;
  quantity: number | null;
  rate: number | null;
  amount: number;
  unit: string | null;
}

/** A cached QB order (invoice, sales order, or estimate) */
export interface QBCacheOrder {
  refNumber: string;
  txnId: string | null;
  type: 'invoice' | 'salesOrder' | 'estimate';
  customerName: string;
  totalAmount: number;
  poNumber: string | null;
  txnDate: string | null; // ISO date string
  memo: string | null;
  lineItems: QBCacheLineItem[];
}

/** Payload sent by the QB Agent USB tool to import data */
export interface QBCacheImportPayload {
  source: 'agent' | 'csv' | 'odbc' | 'manual';
  agentVersion?: string;
  exportedAt: string; // ISO datetime
  orders: QBCacheOrder[];
}

/** Stats returned after a cache import */
export interface QBCacheImportResult {
  ordersUpserted: number;
  lineItemsTotal: number;
  errors: string[];
  duration: string;
}

/** Cache statistics for the UI */
export interface QBCacheStats {
  totalOrders: number;
  totalLineItems: number;
  invoices: number;
  salesOrders: number;
  estimates: number;
  lastSnapshotDate: string | null;
  oldestEntry: string | null;
  newestEntry: string | null;
}

// ============ Vendor / Procurement Types ============

export interface Vendor {
  id: string;
  vendorNumber: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  website: string | null;
  paymentTerms: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  contacts?: VendorContact[];
  purchaseOrders?: PurchaseOrder[];
}

export interface VendorContact {
  id: string;
  vendorId: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  vendorId: string;
  vendor?: Vendor;
  status: POStatus;
  orderDate: Date;
  expectedDate: Date | null;
  receivedDate: Date | null;
  subtotal: number;
  taxAmount: number;
  shippingCost: number;
  total: number;
  notes: string | null;
  createdById: string;
  createdBy?: User;
  lineItems?: POLineItem[];
  receipts?: POReceipt[];
  createdAt: Date;
  updatedAt: Date;
}

export interface POLineItem {
  id: string;
  purchaseOrderId: string;
  itemMasterId: string | null;
  itemMaster?: ItemMaster;
  description: string;
  quantity: number;
  quantityReceived: number;
  unitCost: number;
  totalCost: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface POReceipt {
  id: string;
  purchaseOrderId: string;
  receivedDate: Date;
  receivedById: string;
  receivedBy?: User;
  notes: string | null;
  lineItems?: POReceiptLineItem[];
  createdAt: Date;
}

export interface POReceiptLineItem {
  id: string;
  receiptId: string;
  poLineItemId: string;
  poLineItem?: POLineItem;
  quantityReceived: number;
  notes: string | null;
}

// ============ Shipping Types ============

export interface Shipment {
  id: string;
  workOrderId: string;
  workOrder?: WorkOrder;
  carrier: Carrier;
  trackingNumber: string | null;
  shipDate: Date | null;
  estimatedDelivery: Date | null;
  actualDelivery: Date | null;
  status: ShipmentStatus;
  weight: number | null;
  dimensions: string | null;
  shippingCost: number | null;
  signedBy: string | null;
  proofOfDelivery: string | null;
  notes: string | null;
  packages?: ShipmentPackage[];
  createdById: string;
  createdBy?: User;
  createdAt: Date;
  updatedAt: Date;
}

export interface ShipmentPackage {
  id: string;
  shipmentId: string;
  trackingNumber: string | null;
  weight: number | null;
  dimensions: string | null;
  description: string | null;
}

// ============ Bill of Materials Types ============

export interface BillOfMaterials {
  id: string;
  itemMasterId: string;
  itemMaster?: ItemMaster;
  version: number;
  isActive: boolean;
  notes: string | null;
  components?: BOMComponent[];
  createdAt: Date;
  updatedAt: Date;
}

export interface BOMComponent {
  id: string;
  bomId: string;
  componentId: string;
  component?: ItemMaster;
  quantity: number;
  unit: string;
  wastePercent: number | null;
  notes: string | null;
  sortOrder: number;
}

// ============ Material Usage Types ============

export interface MaterialUsage {
  id: string;
  workOrderId: string;
  workOrder?: WorkOrder;
  itemMasterId: string;
  itemMaster?: ItemMaster;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  usedAt: Date;
  recordedById: string;
  recordedBy?: User;
  notes: string | null;
}

// ============ Job Costing Types ============

export interface JobCost {
  id: string;
  workOrderId: string;
  workOrder?: WorkOrder;
  
  // Revenue
  quotedAmount: number;
  invoicedAmount: number | null;
  
  // Labor Costs
  laborHours: number;
  laborRate: number;
  laborCost: number;
  
  // Material Costs
  materialCost: number;
  
  // Other Direct Costs
  subcontractCost: number | null;
  shippingCost: number | null;
  otherDirectCost: number | null;
  
  // Overhead
  overheadPercent: number | null;
  overheadCost: number | null;
  
  // Totals
  totalCost: number;
  grossProfit: number;
  grossMargin: number;
  
  calculatedAt: Date;
  updatedAt: Date;
}

/** Aggregate job cost report across multiple orders */
export interface JobCostReport {
  totalOrders: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  avgMargin: number;
  laborCost: number;
  materialCost: number;
  otherCost: number;
}

// ============ Analytics Types ============

/**
 * NOTE: AnalyticsPeriod type is also exported from schemas.ts via Zod inference.
 * Use the Zod schema version for validation, these interfaces for API responses.
 */

/** Date range for analytics queries */
export interface AnalyticsDateRange {
  start: Date;
  end: Date;
}

/** Base analytics filter - use AnalyticsFilterSchema from schemas.ts for validation */
export interface AnalyticsQueryFilter {
  period?: 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
  fromDate?: Date;
  toDate?: Date;
}

/** KPI Dashboard data structure */
export interface KPIDashboard {
  period: 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
  dateRange: AnalyticsDateRange;
  kpis: {
    totalOrders: number;
    completedOrders: number;
    totalRevenue: number;
    avgOrderValue: number;
    onTimeDeliveryRate: number;
    totalLaborHours: number;
    totalProfit: number;
    avgMargin: number;
  };
}

/** Overview report statistics */
export interface ReportOverview {
  period: 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
  dateRange: AnalyticsDateRange;
  orders: {
    total: number;
    completed: number;
    pending: number;
    inProgress: number;
    cancelled: number;
    overdue: number;
    completionRate: number;
  };
  time: {
    totalHoursLogged: number;
    avgHoursToComplete: number;
  };
}

/** Status count breakdown */
export interface StatusCount {
  status: string;
  count: number;
}

/** Station count breakdown */
export interface StationCount {
  station: string;
  count: number;
}

/** Priority count breakdown */
export interface PriorityCount {
  priority: number;
  count: number;
}

/** Trend data point */
export interface TrendDataPoint {
  date: string;
  count: number;
}

/** Simple user productivity summary */
export interface UserProductivitySummary {
  userId: string;
  userName: string;
  totalMinutes: number;
  totalHours: number;
  entriesCount: number;
}

/** Station performance metrics */
export interface StationPerformance {
  station: string;
  totalMinutes: number;
  totalHours: number;
  entriesCount: number;
  avgMinutesPerEntry: number;
}

/** Revenue by customer breakdown */
export interface CustomerRevenue {
  customerId: string;
  customerName: string;
  revenue: number;
  orderCount: number;
  percentage: number;
}

/** Revenue by customer report */
export interface RevenueByCustomerReport {
  customers: CustomerRevenue[];
  totalRevenue: number;
  totalCustomers: number;
}

/** Revenue by printing method breakdown */
export interface StationRevenue {
  station: string;
  revenue: number;
  orderCount: number;
  percentage: number;
}

/** Revenue by station report */
export interface RevenueByStationReport {
  stations: StationRevenue[];
  totalRevenue: number;
}

/** Labor efficiency for single order */
export interface OrderLaborEfficiency {
  orderId: string;
  orderNumber: string;
  quotedHours: number;
  actualHours: number;
  variance: number;
  efficiency: number;
}

/** Labor efficiency summary */
export interface LaborEfficiencySummary {
  totalQuotedHours: number;
  totalActualHours: number;
  overallEfficiency: number;
  ordersWithEstimates: number;
  onTarget: number;
  underEstimated: number;
  overEstimated: number;
  accuracyRate: number;
}

/** Labor efficiency report */
export interface LaborEfficiencyReport {
  summary: LaborEfficiencySummary;
  orders: OrderLaborEfficiency[];
}

/** Late order details */
export interface LateOrderInfo {
  orderNumber: string;
  customer: string;
  dueDate: Date;
  completedDate: Date;
  daysLate: number;
}

/** On-time delivery summary */
export interface OnTimeDeliverySummary {
  totalOrders: number;
  onTime: number;
  late: number;
  onTimeRate: number;
  avgDaysLate: number;
}

/** On-time delivery report */
export interface OnTimeDeliveryReport {
  summary: OnTimeDeliverySummary;
  lateOrders: LateOrderInfo[];
}

/** Profitability by order */
export interface OrderProfitability {
  orderId: string;
  orderNumber: string;
  customerName: string;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
}

/** Profitability by customer */
export interface CustomerProfitability {
  customerId: string;
  customerName: string;
  orderCount: number;
  revenue: number;
  cost: number;
  profit: number;
  avgMargin: number;
}

/** Profitability report */
export interface ProfitabilityReport {
  summary: {
    totalRevenue: number;
    totalCost: number;
    totalProfit: number;
    avgMargin: number;
    profitableOrders: number;
    unprofitableOrders: number;
  };
  byCustomer: CustomerProfitability[];
  topOrders: OrderProfitability[];
  bottomOrders: OrderProfitability[];
}

/** Equipment utilization metrics */
export interface EquipmentUtilization {
  equipmentId: string;
  equipmentName: string;
  equipmentType: string;
  station: string | null;
  totalDowntimeMinutes: number;
  downtimeEvents: number;
  maintenanceLogs: number;
}

/** Downtime by reason breakdown */
export interface DowntimeByReason {
  reason: string;
  totalMinutes: number;
  eventCount: number;
}

/** Equipment utilization report */
export interface EquipmentUtilizationReport {
  equipment: EquipmentUtilization[];
  downtimeByReason: DowntimeByReason[];
  totalDowntimeMinutes: number;
  totalMaintenanceLogs: number;
}

/** Daily production capacity */
export interface ProductionCapacity {
  station: string;
  date: Date;
  scheduledHours: number;
  slotCount: number;
  availableHours: number;
  utilizationPercent: number;
}

// Import enum types for use in interfaces
import type { POStatus, Carrier, ShipmentStatus, InstallStatus, InstallPriority, InstallType } from './enums.js';

// ============ Installation / Field Service Types ============

/** Installation job for field service work */
export interface InstallationJob {
  id: string;
  jobNumber: string;
  type: InstallType;
  status: InstallStatus;
  priority: InstallPriority;
  description: string | null;
  
  // Location
  siteAddress: string;
  siteCity: string | null;
  siteState: string | null;
  siteZip: string | null;
  siteContact: string | null;
  sitePhone: string | null;
  
  // Scheduling
  scheduledDate: Date | null;
  scheduledTime: string | null;
  estimatedHours: number | null;
  actualStartTime: Date | null;
  actualEndTime: Date | null;
  
  // Notes
  internalNotes: string | null;
  customerNotes: string | null;
  completionNotes: string | null;
  
  // Cost tracking
  estimatedCost: number | null;
  actualCost: number | null;
  mileage: number | null;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  
  // Relations
  workOrderId: string;
  customerId: string | null;
  installers?: InstallerAssignment[];
  photos?: InstallPhoto[];
  events?: InstallEvent[];
}

/** Installer assignment to a job */
export interface InstallerAssignment {
  id: string;
  installationJobId: string;
  userId: string;
  isLead: boolean;
  hoursWorked: number | null;
  notes: string | null;
  assignedAt: Date;
  user?: User;
}

/** Installer's availability schedule */
export interface InstallerSchedule {
  id: string;
  userId: string;
  date: Date;
  isAvailable: boolean;
  startTime: string | null;
  endTime: string | null;
  notes: string | null;
}

/** Photo from installation job */
export interface InstallPhoto {
  id: string;
  installationJobId: string;
  filename: string;
  filepath: string;
  caption: string | null;
  photoType: 'BEFORE' | 'PROGRESS' | 'AFTER' | 'ISSUE' | 'PERMIT' | 'SITE';
  takenAt: Date;
  uploadedById: string | null;
}

/** Event log for installation job */
export interface InstallEvent {
  id: string;
  installationJobId: string;
  eventType: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  userId: string | null;
}

/** Create installation job payload */
export interface CreateInstallationJobInput {
  workOrderId: string;
  customerId?: string;
  type?: InstallType;
  priority?: InstallPriority;
  description?: string;
  siteAddress: string;
  siteCity?: string;
  siteState?: string;
  siteZip?: string;
  siteContact?: string;
  sitePhone?: string;
  scheduledDate?: Date;
  scheduledTime?: string;
  estimatedHours?: number;
  internalNotes?: string;
  customerNotes?: string;
  estimatedCost?: number;
}

/** Update installation job payload */
export interface UpdateInstallationJobInput {
  type?: InstallType;
  status?: InstallStatus;
  priority?: InstallPriority;
  description?: string;
  siteAddress?: string;
  siteCity?: string;
  siteState?: string;
  siteZip?: string;
  siteContact?: string;
  sitePhone?: string;
  scheduledDate?: Date | null;
  scheduledTime?: string | null;
  estimatedHours?: number | null;
  actualStartTime?: Date | null;
  actualEndTime?: Date | null;
  internalNotes?: string;
  customerNotes?: string;
  completionNotes?: string;
  estimatedCost?: number | null;
  actualCost?: number | null;
  mileage?: number | null;
}

/** Installer dispatch calendar view */
export interface InstallerCalendarDay {
  date: Date;
  installers: {
    userId: string;
    displayName: string;
    isAvailable: boolean;
    scheduledJobs: {
      jobId: string;
      jobNumber: string;
      workOrderNumber: string;
      customerName: string;
      siteAddress: string;
      scheduledTime: string | null;
      estimatedHours: number | null;
      status: InstallStatus;
      isLead: boolean;
    }[];
  }[];
}

/** Installation job with full relations */
export interface InstallationJobWithDetails extends InstallationJob {
  workOrder: {
    id: string;
    orderNumber: string;
    customerName: string;
    description: string;
  };
  customer?: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
  };
  installers: (InstallerAssignment & {
    user: {
      id: string;
      displayName: string;
      email: string | null;
    };
  })[];
  photos: InstallPhoto[];
  events: (InstallEvent & {
    user?: {
      id: string;
      displayName: string;
    };
  })[];
}
// ============ Webhook Types ============

import type { WebhookEventType, WebhookDeliveryStatus } from './enums.js';

/** Webhook subscription for external integrations */
export interface Webhook {
  id: string;
  name: string;
  description: string | null;
  
  // Configuration
  url: string;
  secret: string | null;
  isActive: boolean;
  
  // Event subscriptions
  events: WebhookEventType[];
  
  // Filtering
  filterCustomerId: string | null;
  filterStation: string | null;
  
  // Rate limiting / retry config
  maxRetries: number;
  retryDelayMs: number;
  timeoutMs: number;
  
  // Headers
  headers: Record<string, string> | null;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  lastTriggeredAt: Date | null;
  
  // Relations
  createdById: string;
  createdBy?: User;
  deliveries?: WebhookDelivery[];
}

/** Webhook delivery attempt record */
export interface WebhookDelivery {
  id: string;
  
  // What triggered this
  eventType: WebhookEventType;
  eventId: string | null;
  
  // Request details
  payload: Record<string, unknown>;
  
  // Response details
  status: WebhookDeliveryStatus;
  responseCode: number | null;
  responseBody: string | null;
  responseTimeMs: number | null;
  
  // Retry tracking
  attemptNumber: number;
  nextRetryAt: Date | null;
  errorMessage: string | null;
  
  // Timestamps
  createdAt: Date;
  deliveredAt: Date | null;
  
  // Relations
  webhookId: string;
  webhook?: Webhook;
}

/** Create webhook request */
export interface CreateWebhookInput {
  name: string;
  description?: string;
  url: string;
  secret?: string;
  events: WebhookEventType[];
  filterCustomerId?: string;
  filterStation?: string;
  maxRetries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

/** Update webhook request */
export interface UpdateWebhookInput {
  name?: string;
  description?: string | null;
  url?: string;
  secret?: string | null;
  isActive?: boolean;
  events?: WebhookEventType[];
  filterCustomerId?: string | null;
  filterStation?: string | null;
  maxRetries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
  headers?: Record<string, string> | null;
}

/** Webhook list filter */
export interface WebhookFilters {
  isActive?: boolean;
  eventType?: WebhookEventType;
  search?: string;
}

/** Webhook delivery filter */
export interface WebhookDeliveryFilters {
  webhookId?: string;
  status?: WebhookDeliveryStatus | WebhookDeliveryStatus[];
  eventType?: WebhookEventType;
  fromDate?: Date | string;
  toDate?: Date | string;
  page?: number;
  limit?: number;
}

/** Webhook test result */
export interface WebhookTestResult {
  success: boolean;
  responseCode: number | null;
  responseBody: string | null;
  responseTimeMs: number | null;
  errorMessage: string | null;
}

/** Webhook delivery statistics */
export interface WebhookStats {
  webhookId: string;
  webhookName: string;
  totalDeliveries: number;
  successCount: number;
  failedCount: number;
  pendingCount: number;
  successRate: number;
  avgResponseTimeMs: number | null;
  lastDeliveryAt: Date | null;
}

// ============ Labor Rate Types ============

/** Labor rate configuration */
export interface LaborRate {
  id: string;
  name: string;
  description: string | null;
  hourlyRate: number;
  station: PrintingMethod | null;
  userRole: UserRole | null;
  overtimeMultiplier: number;
  rushMultiplier: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdById: string;
}

/** Labor rate with creator details */
export interface LaborRateWithDetails extends LaborRate {
  createdBy: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
  };
  _count?: {
    history: number;
  };
}

/** Labor rate history entry */
export interface LaborRateHistory {
  id: string;
  laborRateId: string;
  changedById: string;
  changeType: 'CREATE' | 'UPDATE' | 'DEACTIVATE' | 'REACTIVATE';
  previousValues: Record<string, unknown> | null;
  newValues: Record<string, unknown>;
  reason: string | null;
  createdAt: Date;
}

/** Labor rate history with details */
export interface LaborRateHistoryWithDetails extends LaborRateHistory {
  laborRate: {
    id: string;
    name: string;
  };
  changedBy: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
  };
}

/** Create labor rate input */
export interface CreateLaborRateInput {
  name: string;
  description?: string | null;
  hourlyRate: number;
  station?: PrintingMethod | null;
  userRole?: UserRole | null;
  overtimeMultiplier?: number;
  rushMultiplier?: number;
  effectiveFrom?: Date | string;
  effectiveTo?: Date | string | null;
}

/** Update labor rate input */
export interface UpdateLaborRateInput {
  name?: string;
  description?: string | null;
  hourlyRate?: number;
  station?: PrintingMethod | null;
  userRole?: UserRole | null;
  overtimeMultiplier?: number;
  rushMultiplier?: number;
  effectiveFrom?: Date | string;
  effectiveTo?: Date | string | null;
  isActive?: boolean;
  changeReason?: string;
}

/** Labor rate filter options */
export interface LaborRateFilters {
  station?: PrintingMethod;
  userRole?: UserRole;
  isActive?: boolean;
  effectiveDate?: Date | string;
  search?: string;
  page?: number;
  limit?: number;
}

/** Effective rate calculation result */
export interface EffectiveRate {
  baseRate: number;
  effectiveRate: number;
  overtimeMultiplier: number;
  rushMultiplier: number;
  laborRateId: string;
  laborRateName: string;
  appliedMultipliers: string[];
}

/** Labor rate summary statistics */
export interface LaborRateStats {
  totalRates: number;
  activeRates: number;
  inactiveRates: number;
  averageHourlyRate: number;
  ratesByStation: Record<string, number>;
  ratesByRole: Record<string, number>;
}

// ============ System Alert Types ============

/** System alert for displaying notifications to users */
export interface Alert {
  id: string;
  title: string;
  message: string;
  type: AlertType;
  severity: AlertSeverity;
  
  // Targeting
  isGlobal: boolean;
  targetRoles: UserRole[];
  
  // Display settings
  isDismissible: boolean;
  showOnPages: string[];
  
  // Scheduling
  startsAt: Date;
  expiresAt: Date | null;
  
  // Metadata
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  
  // Relations
  createdById: string;
  createdBy?: User;
}

/** Alert rule for automated alert generation */
export interface AlertRule {
  id: string;
  name: string;
  description: string | null;
  
  // Trigger configuration
  triggerType: AlertTriggerType;
  triggerConfig: Record<string, unknown>;
  
  // Alert template
  alertType: AlertType;
  alertSeverity: AlertSeverity;
  titleTemplate: string;
  messageTemplate: string;
  
  // Behavior
  isActive: boolean;
  cooldownMinutes: number;
  lastTriggeredAt: Date | null;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  
  // Relations
  createdById: string;
  createdBy?: User;
}

/** Alert history record */
export interface AlertHistory {
  id: string;
  
  // Alert snapshot
  title: string;
  message: string;
  type: AlertType;
  severity: AlertSeverity;
  
  // Context
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  
  // Timestamps
  triggeredAt: Date;
  resolvedAt: Date | null;
  
  // Relations
  alertId: string | null;
  alertRuleId: string | null;
  resolvedById: string | null;
}

/** Alert dismissal record */
export interface AlertDismissal {
  id: string;
  dismissedAt: Date;
  alertId: string;
  userId: string;
}

/** Create alert request */
export interface CreateAlertInput {
  title: string;
  message: string;
  type?: AlertType;
  severity?: AlertSeverity;
  isGlobal?: boolean;
  targetRoles?: UserRole[];
  isDismissible?: boolean;
  showOnPages?: string[];
  startsAt?: Date | string;
  expiresAt?: Date | string | null;
}

/** Update alert request */
export interface UpdateAlertInput {
  title?: string;
  message?: string;
  type?: AlertType;
  severity?: AlertSeverity;
  isGlobal?: boolean;
  targetRoles?: UserRole[];
  isDismissible?: boolean;
  showOnPages?: string[];
  startsAt?: Date | string;
  expiresAt?: Date | string | null;
  isActive?: boolean;
}

/** Create alert rule request */
export interface CreateAlertRuleInput {
  name: string;
  description?: string;
  triggerType: AlertTriggerType;
  triggerConfig: Record<string, unknown>;
  alertType?: AlertType;
  alertSeverity?: AlertSeverity;
  titleTemplate: string;
  messageTemplate: string;
  cooldownMinutes?: number;
}

/** Update alert rule request */
export interface UpdateAlertRuleInput {
  name?: string;
  description?: string | null;
  triggerType?: AlertTriggerType;
  triggerConfig?: Record<string, unknown>;
  alertType?: AlertType;
  alertSeverity?: AlertSeverity;
  titleTemplate?: string;
  messageTemplate?: string;
  cooldownMinutes?: number;
  isActive?: boolean;
}

/** Alert list filter */
export interface AlertFilters {
  type?: AlertType | AlertType[];
  severity?: AlertSeverity | AlertSeverity[];
  isActive?: boolean;
  isGlobal?: boolean;
  search?: string;
}

/** Alert history filter */
export interface AlertHistoryFilters {
  alertId?: string;
  alertRuleId?: string;
  type?: AlertType | AlertType[];
  severity?: AlertSeverity | AlertSeverity[];
  entityType?: string;
  entityId?: string;
  resolved?: boolean;
  fromDate?: Date | string;
  toDate?: Date | string;
  page?: number;
  limit?: number;
}

/** Active alerts for current user */
export interface UserActiveAlerts {
  global: Alert[];
  roleSpecific: Alert[];
  pageSpecific: Alert[];
  dismissedIds: string[];
}

// ============ Third Party Integration Types ============

/** Third party integration configuration */
export interface Integration {
  id: string;
  name: string;
  type: IntegrationType;
  provider: string;
  description: string | null;
  
  // Configuration
  baseUrl: string | null;
  config: Record<string, unknown>;
  
  // Status
  isEnabled: boolean;
  status: IntegrationStatus;
  lastSyncAt: Date | null;
  lastErrorAt: Date | null;
  lastError: string | null;
  
  // Sync settings
  syncInterval: number | null;
  autoSync: boolean;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  
  // Relations
  createdById: string;
  createdBy?: User;
  credentials?: IntegrationCredential[];
  syncLogs?: IntegrationSyncLog[];
}

/** Integration credential (encrypted storage) */
export interface IntegrationCredential {
  id: string;
  integrationId: string;
  credentialType: CredentialType;
  key: string;
  // Note: value is encrypted, not exposed to frontend
  expiresAt: Date | null;
  scope: string | null;
  tokenType: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt: Date | null;
}

/** Integration sync log record */
export interface IntegrationSyncLog {
  id: string;
  integrationId: string;
  syncType: SyncType;
  direction: SyncDirection;
  entityType: string | null;
  status: SyncStatus;
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsFailed: number;
  startedAt: Date;
  completedAt: Date | null;
  durationMs: number | null;
  errorMessage: string | null;
  errorDetails: Record<string, unknown> | null;
}

/** Create integration request */
export interface CreateIntegrationInput {
  name: string;
  type: IntegrationType;
  provider: string;
  description?: string;
  baseUrl?: string;
  config?: Record<string, unknown>;
  syncInterval?: number;
  autoSync?: boolean;
}

/** Update integration request */
export interface UpdateIntegrationInput {
  name?: string;
  description?: string | null;
  baseUrl?: string | null;
  config?: Record<string, unknown>;
  syncInterval?: number | null;
  autoSync?: boolean;
  isEnabled?: boolean;
}

/** Add integration credential request */
export interface AddIntegrationCredentialInput {
  credentialType?: CredentialType;
  key: string;
  value: string;  // Will be encrypted server-side
  expiresAt?: Date | string;
  refreshToken?: string;
  scope?: string;
  tokenType?: string;
}

/** Update integration credential request */
export interface UpdateIntegrationCredentialInput {
  value?: string;
  expiresAt?: Date | string | null;
  refreshToken?: string | null;
  scope?: string | null;
  tokenType?: string | null;
}

/** Integration filter */
export interface IntegrationFilters {
  type?: IntegrationType | IntegrationType[];
  status?: IntegrationStatus | IntegrationStatus[];
  provider?: string;
  isEnabled?: boolean;
  search?: string;
}

/** Sync log filter */
export interface SyncLogFilters {
  integrationId?: string;
  syncType?: SyncType | SyncType[];
  status?: SyncStatus | SyncStatus[];
  direction?: SyncDirection;
  entityType?: string;
  fromDate?: Date | string;
  toDate?: Date | string;
  page?: number;
  limit?: number;
}

/** Integration with sync statistics */
export interface IntegrationWithStats extends Integration {
  stats: {
    totalSyncs: number;
    successfulSyncs: number;
    failedSyncs: number;
    lastSuccessAt: Date | null;
    avgDurationMs: number | null;
    totalRecordsProcessed: number;
  };
}

/** Trigger sync request */
export interface TriggerSyncInput {
  integrationId: string;
  entityType?: string;
  direction?: SyncDirection;
  fullSync?: boolean;
}

// ============ Saved Filter Types ============

/** Saved filter for persistent user preferences */
export interface SavedFilter {
  id: string;
  name: string;
  description: string | null;
  
  // Filter target
  entityType: FilterEntityType;
  pageKey: string;
  
  // Filter configuration
  filterConfig: Record<string, unknown>;
  sortConfig: Record<string, unknown> | null;
  columnConfig: Record<string, unknown> | null;
  
  // Sharing
  isDefault: boolean;
  isShared: boolean;
  sharedWithRoles: UserRole[];
  
  // Usage tracking
  usageCount: number;
  lastUsedAt: Date | null;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  
  // Relations
  userId: string;
  user?: User;
}

/** Create saved filter input */
export interface CreateSavedFilterInput {
  name: string;
  description?: string;
  entityType: FilterEntityType;
  pageKey: string;
  filterConfig: Record<string, unknown>;
  sortConfig?: Record<string, unknown>;
  columnConfig?: Record<string, unknown>;
  isDefault?: boolean;
  isShared?: boolean;
  sharedWithRoles?: UserRole[];
}

/** Update saved filter input */
export interface UpdateSavedFilterInput {
  name?: string;
  description?: string | null;
  filterConfig?: Record<string, unknown>;
  sortConfig?: Record<string, unknown> | null;
  columnConfig?: Record<string, unknown> | null;
  isDefault?: boolean;
  isShared?: boolean;
  sharedWithRoles?: UserRole[];
}

/** Saved filter list filter */
export interface SavedFilterFilters {
  entityType?: FilterEntityType;
  pageKey?: string;
  isShared?: boolean;
  includeShared?: boolean;  // Include filters shared with current user
  search?: string;
}

/** Page filter presets (all filters for a specific page) */
export interface PageFilterPresets {
  personal: SavedFilter[];       // User's own filters
  shared: SavedFilter[];         // Filters shared with user's role
  defaults: SavedFilter[];       // Default system filters
}

// ============ Price Book Types ============

// PricingUnit enum is defined in enums.ts

/** Price book category */
export interface PriceBookCategory {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  sortOrder: number;
  icon: string | null;
  color: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Category with hierarchy info */
export interface PriceBookCategoryWithHierarchy extends PriceBookCategory {
  parent?: PriceBookCategory | null;
  children?: PriceBookCategory[];
  _count?: {
    items: number;
    children: number;
  };
  depth?: number;
  path?: string[];
}

/** Pricing tier for quantity breaks */
export interface PricingTier {
  minQty: number;
  maxQty: number | null;
  price: number;
  discountPercent?: number;
}

/** Material item for BOM */
export interface MaterialItem {
  inventoryItemId: string;
  quantity: number;
  wasteFactor?: number;
}

/** Price book item */
export interface PriceBookItem {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  basePrice: number;
  costPrice: number | null;
  pricingUnit: PricingUnit;
  minQuantity: number;
  pricingTiers: PricingTier[] | null;
  laborRateId: string | null;
  estimatedHours: number | null;
  materialItems: MaterialItem[] | null;
  defaultStation: PrintingMethod | null;
  estimatedLeadDays: number | null;
  isActive: boolean;
  isTaxable: boolean;
  tags: string[];
  notes: string | null;
  quickbooksItemId: string | null;
  externalSku: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdById: string;
}

/** Price book item with relations */
export interface PriceBookItemWithDetails extends PriceBookItem {
  category?: PriceBookCategory | null;
  createdBy: {
    id: string;
    username: string;
    displayName: string;
  };
  _count?: {
    history: number;
  };
}

/** Price book history entry */
export interface PriceBookHistory {
  id: string;
  itemId: string;
  changeType: 'CREATE' | 'UPDATE' | 'PRICE_CHANGE' | 'DEACTIVATE';
  previousValues: Record<string, unknown> | null;
  newValues: Record<string, unknown>;
  reason: string | null;
  changedById: string;
  createdAt: Date;
}

/** Price book history with details */
export interface PriceBookHistoryWithDetails extends PriceBookHistory {
  item: {
    id: string;
    sku: string;
    name: string;
  };
  changedBy: {
    id: string;
    username: string;
    displayName: string;
  };
}

/** Create price book category input */
export interface CreatePriceBookCategoryInput {
  name: string;
  description?: string | null;
  parentId?: string | null;
  sortOrder?: number;
  icon?: string | null;
  color?: string | null;
}

/** Update price book category input */
export interface UpdatePriceBookCategoryInput {
  name?: string;
  description?: string | null;
  parentId?: string | null;
  sortOrder?: number;
  icon?: string | null;
  color?: string | null;
  isActive?: boolean;
}

/** Create price book item input */
export interface CreatePriceBookItemInput {
  sku: string;
  name: string;
  description?: string | null;
  categoryId?: string | null;
  basePrice: number;
  costPrice?: number | null;
  pricingUnit?: PricingUnit;
  minQuantity?: number;
  pricingTiers?: PricingTier[] | null;
  laborRateId?: string | null;
  estimatedHours?: number | null;
  materialItems?: MaterialItem[] | null;
  defaultStation?: PrintingMethod | null;
  estimatedLeadDays?: number | null;
  isTaxable?: boolean;
  tags?: string[];
  notes?: string | null;
  quickbooksItemId?: string | null;
  externalSku?: string | null;
}

/** Update price book item input */
export interface UpdatePriceBookItemInput {
  sku?: string;
  name?: string;
  description?: string | null;
  categoryId?: string | null;
  basePrice?: number;
  costPrice?: number | null;
  pricingUnit?: PricingUnit;
  minQuantity?: number;
  pricingTiers?: PricingTier[] | null;
  laborRateId?: string | null;
  estimatedHours?: number | null;
  materialItems?: MaterialItem[] | null;
  defaultStation?: PrintingMethod | null;
  estimatedLeadDays?: number | null;
  isActive?: boolean;
  isTaxable?: boolean;
  tags?: string[];
  notes?: string | null;
  quickbooksItemId?: string | null;
  externalSku?: string | null;
  changeReason?: string;
}

/** Price book item filters */
export interface PriceBookItemFilters {
  categoryId?: string;
  pricingUnit?: PricingUnit;
  defaultStation?: PrintingMethod;
  isActive?: boolean;
  isTaxable?: boolean;
  tags?: string[];
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  page?: number;
  limit?: number;
}

/** Price book category filters */
export interface PriceBookCategoryFilters {
  parentId?: string | null;
  isActive?: boolean;
  search?: string;
  includeItemCounts?: boolean;
}

/** Price calculation request */
export interface PriceCalculationRequest {
  itemId: string;
  quantity: number;
  isRush?: boolean;
  customizations?: Record<string, unknown>;
}

/** Price calculation result */
export interface PriceCalculationResult {
  itemId: string;
  itemName: string;
  sku: string;
  quantity: number;
  pricingUnit: PricingUnit;
  unitPrice: number;
  tierApplied?: PricingTier | null;
  laborCost: number | null;
  materialCost: number | null;
  subtotal: number;
  rushMultiplier: number;
  total: number;
  breakdown: {
    base: number;
    laborHours?: number;
    laborRate?: number;
    materials?: Array<{ name: string; quantity: number; cost: number }>;
    rush?: number;
  };
}

/** Price book statistics */
export interface PriceBookStats {
  totalItems: number;
  activeItems: number;
  inactiveItems: number;
  totalCategories: number;
  itemsByCategory: Record<string, number>;
  itemsByPricingUnit: Record<string, number>;
  averagePrice: number;
  priceRange: { min: number; max: number };
}

// ============ Audit Snapshot Types ============

/** Audit snapshot for detailed change tracking */
export interface AuditSnapshot {
  id: string;
  
  // Entity identification
  entityType: AuditEntityType;
  entityId: string;
  entityName: string | null;
  
  // Change details
  action: AuditAction;
  changeSource: ChangeSource;
  
  // Before/After snapshots
  beforeSnapshot: Record<string, unknown> | null;
  afterSnapshot: Record<string, unknown> | null;
  changedFields: string[];
  
  // Context
  reason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
  
  // Metadata
  createdAt: Date;
  
  // Relations
  userId: string;
  user?: User;
}

/** Create audit snapshot input (internal use) */
export interface CreateAuditSnapshotInput {
  entityType: AuditEntityType;
  entityId: string;
  entityName?: string;
  action: AuditAction;
  changeSource?: ChangeSource;
  beforeSnapshot?: Record<string, unknown>;
  afterSnapshot?: Record<string, unknown>;
  changedFields?: string[];
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

/** Audit snapshot filter */
export interface AuditSnapshotFilters {
  entityType?: AuditEntityType | AuditEntityType[];
  entityId?: string;
  action?: AuditAction | AuditAction[];
  changeSource?: ChangeSource | ChangeSource[];
  userId?: string;
  fromDate?: Date | string;
  toDate?: Date | string;
  search?: string;
  page?: number;
  limit?: number;
}

/** Field change detail */
export interface FieldChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  displayName?: string;  // Human-readable field name
  fieldLabel?: string;   // Alternative display name (merged from duplicate)
}

/** Audit snapshot with parsed changes */
export interface AuditSnapshotWithChanges extends AuditSnapshot {
  changes: FieldChange[];
}

/** Entity audit history summary */
export interface EntityAuditSummary {
  entityType: AuditEntityType;
  entityId: string;
  entityName: string | null;
  totalChanges: number;
  firstChange: Date;
  lastChange: Date;
  uniqueUsers: number;
  actionCounts: Record<AuditAction, number>;
}

// ============ Print Station Management Types ============

/** Print queue for organizing print jobs by station */
export interface PrintQueue {
  id: string;
  name: string;
  description: string | null;
  
  // Station assignment
  station: PrintingMethod;
  
  // Queue settings
  priority: number;
  isActive: boolean;
  maxConcurrent: number;
  
  // Status
  currentJobs: number;
  pendingJobs: number;
  
  // Scheduling
  autoSchedule: boolean;
  scheduledHours: { start: string; end: string } | null;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  
  // Relations
  jobs?: PrintJob[];
}

/** Print job for individual print tasks */
export interface PrintJob {
  id: string;
  
  // Queue assignment
  queueId: string;
  queue?: PrintQueue;
  
  // Work order reference
  workOrderId: string;
  workOrder?: WorkOrder;
  lineItemId: string | null;
  
  // Job details
  jobNumber: string;
  name: string;
  description: string | null;
  
  // Files and materials
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  materialType: string | null;
  mediaWidth: number | null;
  mediaLength: number | null;
  copies: number;
  
  // Status
  status: PrintJobStatus;
  priority: number;
  
  // Progress
  estimatedMinutes: number | null;
  actualMinutes: number | null;
  startedAt: Date | null;
  completedAt: Date | null;
  
  // Operator notes
  operatorNotes: string | null;
  qualityNotes: string | null;
  
  // Error handling
  errorMessage: string | null;
  retryCount: number;
  maxRetries: number;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  
  // Relations
  assignedToId: string | null;
  assignedTo?: User;
  createdById: string;
  createdBy?: User;
}

/** Create print queue input */
export interface CreatePrintQueueInput {
  name: string;
  description?: string;
  station: PrintingMethod;
  priority?: number;
  maxConcurrent?: number;
  autoSchedule?: boolean;
  scheduledHours?: { start: string; end: string };
}

/** Update print queue input */
export interface UpdatePrintQueueInput {
  name?: string;
  description?: string | null;
  priority?: number;
  maxConcurrent?: number;
  autoSchedule?: boolean;
  scheduledHours?: { start: string; end: string } | null;
  isActive?: boolean;
}

/** Create print job input */
export interface CreatePrintJobInput {
  queueId: string;
  workOrderId: string;
  lineItemId?: string;
  name: string;
  description?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  materialType?: string;
  mediaWidth?: number;
  mediaLength?: number;
  copies?: number;
  priority?: number;
  estimatedMinutes?: number;
  assignedToId?: string;
}

/** Update print job input */
export interface UpdatePrintJobInput {
  queueId?: string;
  name?: string;
  description?: string | null;
  fileUrl?: string | null;
  materialType?: string | null;
  mediaWidth?: number | null;
  mediaLength?: number | null;
  copies?: number;
  priority?: number;
  estimatedMinutes?: number | null;
  assignedToId?: string | null;
  operatorNotes?: string | null;
  qualityNotes?: string | null;
}

/** Update print job status input */
export interface UpdatePrintJobStatusInput {
  status: PrintJobStatus;
  operatorNotes?: string;
  errorMessage?: string;
}

/** Print queue filter */
export interface PrintQueueFilters {
  station?: PrintingMethod | PrintingMethod[];
  isActive?: boolean;
  search?: string;
}

/** Print job filter */
export interface PrintJobFilters {
  queueId?: string;
  workOrderId?: string;
  status?: PrintJobStatus | PrintJobStatus[];
  priority?: number;
  assignedToId?: string;
  fromDate?: Date | string;
  toDate?: Date | string;
  search?: string;
  page?: number;
  limit?: number;
}

/** Print queue with statistics */
export interface PrintQueueWithStats extends PrintQueue {
  stats: {
    totalJobs: number;
    pendingJobs: number;
    printingJobs: number;
    completedToday: number;
    averageJobMinutes: number | null;
    queueTimeMinutes: number | null;
  };
}

/** Operator dashboard data */
export interface OperatorDashboard {
  assignedJobs: PrintJob[];
  queuedJobs: PrintJob[];
  recentlyCompleted: PrintJob[];
  dailyStats: {
    completed: number;
    inProgress: number;
    totalMinutes: number;
  };
}

// ============ User Preference Types ============

// ============ RIP Queue Types ============

/** Print settings that can be configured in the ERP before sending to RIP */
export interface PrintSettings {
  colorProfile?: string | null;
  printResolution?: string | null;
  printMode?: string | null;
  mediaProfile?: string | null;
  mediaType?: string | null;
  mediaWidth?: number | null;
  mediaLength?: number | null;
  copies?: number;
  whiteInk?: string | null;
  mirror?: boolean;
  nestingEnabled?: boolean;
}

/** RIP Job - tracks a file from ERP through RIP to print */
export interface RipJob {
  id: string;
  workOrderId: string;
  workOrder?: WorkOrder;
  sourceFilePath: string;
  sourceFileName: string;
  sourceFileSize: number | null;
  hotfolderPath: string;
  hotfolderName: string;
  ripType: string;
  status: RipJobStatus;
  colorProfile: string | null;
  printResolution: string | null;
  printMode: string | null;
  mediaProfile: string | null;
  mediaType: string | null;
  mediaWidth: number | null;
  mediaLength: number | null;
  copies: number;
  whiteInk: string | null;
  mirror: boolean;
  nestingEnabled: boolean;
  printSettingsJson: Record<string, unknown> | null;
  queuedAt: Date | string;
  rippedAt: Date | string | null;
  sentToPrinterAt: Date | string | null;
  printStartedAt: Date | string | null;
  printCompletedAt: Date | string | null;
  cancelledAt: Date | string | null;
  ripJobGuid: string | null;
  ripStatusCode: number | null;
  ripInkUsage: string | null;
  ripInkCoverage: string | null;
  errorMessage: string | null;
  retryCount: number;
  notes: string | null;
  priority: number;
  equipmentId: string | null;
  equipment?: { id: string; name: string; station: string | null };
  createdById: string;
  createdBy?: { id: string; username: string; displayName: string | null };
  operatorId: string | null;
  operator?: { id: string; username: string; displayName: string | null };
  printJob?: { id: string; jobNumber: string; status: string } | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/** Input to create a RIP job (send file to hotfolder) */
export interface CreateRipJobInput {
  workOrderId: string;
  sourceFilePath?: string;
  attachmentId?: string;
  hotfolderId?: string;
  hotfolderPath?: string;
  hotfolderName?: string;
  ripType?: string;
  equipmentId?: string;
  printSettings?: PrintSettings;
  notes?: string;
  priority?: number;
}

/** Input to update RIP job status */
export interface UpdateRipJobStatusInput {
  status: RipJobStatus;
  notes?: string;
  errorMessage?: string;
}

/** RIP job filters for listing */
export interface RipJobFilters {
  workOrderId?: string;
  status?: RipJobStatus | RipJobStatus[];
  equipmentId?: string;
  ripType?: string;
  fromDate?: Date | string;
  toDate?: Date | string;
  search?: string;
  page?: number;
  limit?: number;
}

/** RIP Queue KPI data */
export interface RipQueueKPIs {
  totalJobs: number;
  inQueue: number;
  processing: number;
  printing: number;
  completedToday: number;
  failedToday: number;
  avgQueueToRipMinutes: number | null;   // Time from queued to RIP processed
  avgRipToPrintMinutes: number | null;   // Time from RIP done to print start
  avgPrintMinutes: number | null;        // Print duration
  avgTotalMinutes: number | null;        // Total queued → completed
}

/** Hotfolder config for sending files (matches Thrive discovery) */
export interface HotfolderTarget {
  id: string;           // e.g., "thrive-rip2-hp-latex-800-w"
  name: string;         // e.g., "HP Latex 800 W"
  path: string;         // UNC path to hotfolder
  ripType: string;      // "Onyx", "Fiery", etc.
  station: string;      // PrintingMethod enum
  machineId: string;    // Thrive machine ID
  machineName: string;  // Thrive machine name
  equipmentId?: string; // ERP Equipment UUID (if linked)
}

// ============ User Preference Types (continued) ============

/** User preferences model */
export interface UserPreference {
  id: string;
  userId: string;
  
  // Theme & Appearance
  theme: ThemeMode;
  primaryColor: string | null;
  fontSize: FontSize;
  compactMode: boolean;
  
  // Layout Preferences
  sidebarCollapsed: boolean;
  sidebarPosition: SidebarPosition;
  dashboardLayout: Record<string, unknown> | null;
  defaultLandingPage: string | null;
  
  // Table/List Preferences
  defaultPageSize: number;
  showGridLines: boolean;
  tableColumnWidths: Record<string, Record<string, number>> | null;
  hiddenColumns: Record<string, string[]> | null;
  
  // Notification Preferences
  emailNotifications: boolean;
  browserNotifications: boolean;
  soundEnabled: boolean;
  notificationDigest: NotificationDigest;
  
  // Time & Date Preferences
  timezone: string;
  dateFormat: string;
  timeFormat: TimeFormat;
  weekStartsOn: number;
  
  // Keyboard & Accessibility
  keyboardShortcutsEnabled: boolean;
  highContrastMode: boolean;
  reduceMotion: boolean;
  
  // Custom Settings
  customSettings: Record<string, unknown> | null;
  
  createdAt: Date;
  updatedAt: Date;
}

/** Input for creating/updating user preferences */
export interface UpdateUserPreferenceInput {
  theme?: ThemeMode;
  primaryColor?: string | null;
  fontSize?: FontSize;
  compactMode?: boolean;
  sidebarCollapsed?: boolean;
  sidebarPosition?: SidebarPosition;
  dashboardLayout?: Record<string, unknown> | null;
  defaultLandingPage?: string | null;
  defaultPageSize?: number;
  showGridLines?: boolean;
  tableColumnWidths?: Record<string, Record<string, number>> | null;
  hiddenColumns?: Record<string, string[]> | null;
  emailNotifications?: boolean;
  browserNotifications?: boolean;
  soundEnabled?: boolean;
  notificationDigest?: NotificationDigest;
  timezone?: string;
  dateFormat?: string;
  timeFormat?: TimeFormat;
  weekStartsOn?: number;
  keyboardShortcutsEnabled?: boolean;
  highContrastMode?: boolean;
  reduceMotion?: boolean;
  customSettings?: Record<string, unknown> | null;
}

/** User preference with user info */
export interface UserPreferenceWithUser extends UserPreference {
  user: {
    id: string;
    username: string;
    displayName: string;
  };
}

/** Theme preset for quick switching */
export interface ThemePreset {
  id: string;
  name: string;
  theme: ThemeMode;
  primaryColor: string;
  fontSize: FontSize;
  compactMode: boolean;
}

/** Common timezone options */
export const COMMON_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'UTC',
] as const;

/** Common date format options */
export const DATE_FORMAT_OPTIONS = [
  'MM/dd/yyyy',
  'dd/MM/yyyy',
  'yyyy-MM-dd',
  'MMM d, yyyy',
  'MMMM d, yyyy',
] as const;

// ============ Favorites Types ============

/** Favorite item model */
export interface Favorite {
  id: string;
  userId: string;
  entityType: FavoriteEntityType;
  entityId: string;
  displayName: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  sortOrder: number;
  groupName: string | null;
  showOnDashboard: boolean;
  showInSidebar: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Input for creating a favorite */
export interface CreateFavoriteInput {
  entityType: FavoriteEntityType;
  entityId: string;
  displayName: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  groupName?: string | null;
  showOnDashboard?: boolean;
  showInSidebar?: boolean;
}

/** Input for updating a favorite */
export interface UpdateFavoriteInput {
  displayName?: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  sortOrder?: number;
  groupName?: string | null;
  showOnDashboard?: boolean;
  showInSidebar?: boolean;
}

/** Favorite with entity details (hydrated) */
export interface FavoriteWithEntity extends Favorite {
  entity?: {
    id: string;
    displayName: string;
    status?: string;
    [key: string]: unknown;
  };
}

/** Favorites grouped by entity type */
export type FavoritesByType = {
  [K in FavoriteEntityType]?: Favorite[];
};

/** Favorites grouped by custom group name */
export interface FavoritesByGroup {
  [groupName: string]: Favorite[];
}

/** Quick access favorites for sidebar/dashboard */
export interface QuickAccessFavorites {
  sidebar: Favorite[];
  dashboard: Favorite[];
}

/** Entity paths for navigation */
export const FAVORITE_ENTITY_PATHS: Record<FavoriteEntityType, string> = {
  [FavoriteEntityType.WORK_ORDER]: '/orders',
  [FavoriteEntityType.CUSTOMER]: '/customers',
  [FavoriteEntityType.QUOTE]: '/quotes',
  [FavoriteEntityType.INVOICE]: '/invoices',
  [FavoriteEntityType.VENDOR]: '/vendors',
  [FavoriteEntityType.MATERIAL]: '/inventory',
  [FavoriteEntityType.EQUIPMENT]: '/equipment',
  [FavoriteEntityType.EMPLOYEE]: '/employees',
  [FavoriteEntityType.SUBCONTRACTOR]: '/subcontractors',
  [FavoriteEntityType.SAVED_FILTER]: '/filters',
  [FavoriteEntityType.REPORT]: '/reports',
  [FavoriteEntityType.DASHBOARD_VIEW]: '/dashboard',
};

// ============ Recent Search Types ============

/** Recent search model */
export interface RecentSearch {
  id: string;
  userId: string;
  searchType: SearchType;
  query: string;
  entityType: SearchEntityType | null;
  filters: Record<string, unknown> | null;
  resultCount: number | null;
  selectedId: string | null;
  selectedName: string | null;
  searchedAt: Date;
}

/** Input for logging a search */
export interface LogSearchInput {
  searchType: SearchType;
  query: string;
  entityType?: SearchEntityType | null;
  filters?: Record<string, unknown> | null;
  resultCount?: number | null;
  selectedId?: string | null;
  selectedName?: string | null;
}

/** Recent search with formatted time */
export interface RecentSearchDisplay extends RecentSearch {
  timeAgo: string; // "2 minutes ago", "yesterday", etc.
}

/** Recent searches grouped by date */
export interface RecentSearchesByDate {
  today: RecentSearch[];
  yesterday: RecentSearch[];
  thisWeek: RecentSearch[];
  older: RecentSearch[];
}

/** Search history statistics */
export interface SearchHistoryStats {
  totalSearches: number;
  uniqueQueries: number;
  mostSearchedEntities: Array<{
    entityType: SearchEntityType;
    count: number;
  }>;
  recentQueries: string[];
}

/** User's search history entry */
export interface UserSearchEntry {
  query: string;
  entityType?: SearchEntityType;
  frequency: number;
  lastUsed: Date;
}

// ============ Batch Import Types ============

/** Import job model */
export interface ImportJob {
  id: string;
  userId: string;
  name: string;
  entityType: ImportEntityType;
  mappingId: string | null;
  fileName: string;
  filePath: string | null;
  fileSize: number | null;
  fileType: ImportFileType;
  status: ImportJobStatus;
  totalRows: number | null;
  processedRows: number;
  successRows: number;
  errorRows: number;
  skippedRows: number;
  errorLog: ImportError[] | null;
  warningLog: ImportWarning[] | null;
  createdIds: string[];
  updatedIds: string[];
  skipFirstRow: boolean;
  updateExisting: boolean;
  matchField: string | null;
  dryRun: boolean;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Import error entry */
export interface ImportError {
  row: number;
  field: string;
  value: unknown;
  error: string;
}

/** Import warning entry */
export interface ImportWarning {
  row: number;
  field?: string;
  message: string;
}

/** Import mapping model */
export interface ImportMapping {
  id: string;
  userId: string;
  name: string;
  entityType: ImportEntityType;
  isDefault: boolean;
  mappings: ColumnMapping[];
  defaults: Record<string, unknown> | null;
  usageCount: number;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Column mapping entry */
export interface ColumnMapping {
  sourceColumn: string;      // Column name or index from file
  targetField: string;       // Entity field name
  transform?: string;        // Optional transform: 'uppercase', 'lowercase', 'trim', 'date', etc.
  required?: boolean;        // Is this mapping required
  defaultValue?: unknown;    // Default if source is empty
}

// Note: CreateImportJobInput and CreateImportMappingInput are provided by Zod schemas
// Use the types from schemas.ts for form validation

/** Import job with mapping (extended type for API responses) */
export interface ImportJobWithMapping extends ImportJob {
  mapping: ImportMapping | null;
  user: {
    id: string;
    displayName: string;
  };
}

/** Import job progress */
export interface ImportJobProgress {
  id: string;
  status: ImportJobStatus;
  processedRows: number;
  totalRows: number | null;
  successRows: number;
  errorRows: number;
  percentComplete: number;
  estimatedTimeRemaining: number | null; // seconds
}

/** Import job filter options */
export interface ImportJobFilters {
  entityType?: ImportEntityType;
  status?: ImportJobStatus | ImportJobStatus[];
  fromDate?: Date | string;
  toDate?: Date | string;
  search?: string;
  page?: number;
  limit?: number;
}

/** Available fields for an entity type */
export interface ImportFieldDefinition {
  field: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'enum';
  required: boolean;
  enumValues?: string[];
  example?: string;
}

/** Entity import configuration */
export interface ImportEntityConfig {
  entityType: ImportEntityType;
  displayName: string;
  fields: ImportFieldDefinition[];
  requiredFields: string[];
  matchFields: string[]; // Fields that can be used for updateExisting matching
}

// ============ Keyboard Shortcuts Types ============

/** Custom keyboard shortcut model */
export interface KeyboardShortcut {
  id: string;
  userId: string;
  actionId: string;          // Action identifier (e.g., 'navigation.orders', 'action.save')
  keyCombo: string;          // Key combination (e.g., 'ctrl+s', 'cmd+shift+p')
  isEnabled: boolean;
  scope: ShortcutScope;
  context: string | null;    // Page or component context
  createdAt: Date;
  updatedAt: Date;
}

/** Default shortcut definition (not user-specific) */
export interface DefaultShortcut {
  actionId: string;
  label: string;             // Human-readable label
  description: string;       // Description of what the shortcut does
  defaultKeyCombo: string;   // Default key combination
  category: ShortcutCategory;
  scope: ShortcutScope;
  context?: string;          // Required context (page/component)
  isOverridable: boolean;    // Can user override this shortcut
}

/** Key combination parsed */
export interface KeyComboParts {
  key: string;               // Main key (letter, number, or special key)
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;             // Cmd on Mac, Win on Windows
}

/** Shortcut action being performed */
export interface ShortcutAction {
  actionId: string;
  handler: () => void | Promise<void>;
  condition?: () => boolean; // Only trigger if condition returns true
}

/** Shortcut with override info */
export interface ShortcutWithDefault extends KeyboardShortcut {
  default: DefaultShortcut;
  isCustomized: boolean;     // User has customized this shortcut
}

/** Grouped shortcuts by category */
export type ShortcutsByCategory = {
  [K in ShortcutCategory]?: DefaultShortcut[];
};

/** Input for creating a custom shortcut */
export interface CreateKeyboardShortcutInput {
  actionId: string;
  keyCombo: string;
  isEnabled?: boolean;
  scope?: ShortcutScope;
  context?: string | null;
}

/** Input for updating a custom shortcut */
export interface UpdateKeyboardShortcutInput {
  keyCombo?: string;
  isEnabled?: boolean;
  scope?: ShortcutScope;
  context?: string | null;
}

/** Shortcut conflict detection result */
export interface ShortcutConflict {
  existingActionId: string;
  existingLabel: string;
  keyCombo: string;
  scope: ShortcutScope;
}

/** Shortcut list with defaults */
export interface ShortcutListResponse {
  shortcuts: ShortcutWithDefault[];
  defaults: DefaultShortcut[];
}

// ============ SSS-001: ML Prediction & Routing Intelligence ============

/** Alternative route with score */
export interface AlternativeRoute {
  route: string[];               // PrintingMethod values
  score: number;                 // 0-100 score
  reason: string;                // Why this alternative
  estimatedDuration: number;     // Minutes
}

/** Structured explanation factor for a routing recommendation */
export interface RoutingExplanationFactor {
  key: string;                   // Stable factor identifier
  label: string;                 // Human-readable label
  direction: 'positive' | 'negative' | 'neutral';
  scoreImpact: number;           // Relative impact on the score
  value: string | number | boolean | null;
  description: string | null;
}

/** Factor weights for prediction */
export interface PredictionFactorWeights {
  queueDepth: number;            // Weight for queue depth consideration
  operatorSkill: number;         // Weight for operator skills
  equipmentStatus: number;       // Weight for equipment availability
  materialMatch: number;         // Weight for material batching
  deadline: number;              // Weight for deadline urgency
  qualityHistory: number;        // Weight for quality track record
  setupTime: number;             // Weight for setup/changeover time
}

/** Estimated time per station */
export interface EstimatedPerStation {
  [station: string]: number;     // Station name to minutes
}

/** Routing prediction model */
export interface RoutingPrediction {
  id: string;
  workOrderId: string | null;
  jobType: string | null;
  customerSegment: string | null;
  priorityLevel: number;
  estimatedArea: number | null;
  predictedRoute: string[];
  confidence: number;
  alternativeRoutes: AlternativeRoute[] | null;
  factorWeights: PredictionFactorWeights | null;
  estimatedDuration: number | null;
  estimatedPerStation: EstimatedPerStation | null;
  actualRoute: string[];
  actualDuration: number | null;
  wasAccepted: boolean | null;
  feedbackScore: number | null;
  feedbackNotes: string | null;
  modelVersion: string;
  modelType: PredictionModelType;
  createdAt: Date;
  updatedAt: Date;
}

/** Rule conditions for optimization */
export interface OptimizationConditions {
  queueDepthThreshold?: number;
  materialMatch?: string[];
  priorityRange?: [number, number];
  jobTypeMatch?: string[];
  timeOfDay?: { start: string; end: string };
  dayOfWeek?: number[];
}

/** Rule actions for optimization */
export interface OptimizationActions {
  preferStation?: string[];
  avoidStation?: string[];
  batchWith?: string[];
  adjustPriority?: number;
  addWarning?: string;
  requireApproval?: boolean;
}

/** Optimization rule model */
export interface OptimizationRule {
  id: string;
  name: string;
  description: string | null;
  code: string;
  ruleType: OptimizationRuleType;
  category: OptimizationCategory;
  conditions: OptimizationConditions;
  actions: OptimizationActions;
  weight: number;
  appliesTo: string[];
  successCount: number;
  failureCount: number;
  averageImprovement: number | null;
  isActive: boolean;
  priority: number;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Operator skill entry */
export interface OperatorSkillEntry {
  skillLevel: number;            // 1-5
  certifications: string[];
  lastTraining: Date | null;
  productivityScore: number;     // 0-100
}

/** Operator skills by user */
export interface OperatorSkillsMap {
  [userId: string]: OperatorSkillEntry;
}

/** Station intelligence model */
export interface StationIntelligence {
  id: string;
  station: string;               // PrintingMethod
  currentQueueDepth: number;
  currentWaitTime: number;
  activeJobs: number;
  activeOperators: number;
  equipmentStatus: EquipmentStatus;
  dailyCapacityHours: number;
  scheduledHours: number;
  availableHours: number;
  utilizationPct: number;
  avgJobDuration: number | null;
  avgSetupTime: number | null;
  avgQualityScore: number | null;
  throughputPerHour: number | null;
  operatorSkills: OperatorSkillsMap | null;
  isBottleneck: boolean;
  bottleneckReason: string | null;
  bottleneckSince: Date | null;
  lastCalculated: Date;
}

/** Factors considered in routing decision */
export interface RoutingFactorsConsidered {
  queueDepths: { [station: string]: number };
  waitTimes: { [station: string]: number };
  operatorAvailability: { [station: string]: number };
  equipmentStatus: { [station: string]: EquipmentStatus };
  deadlineRisk: number;          // 0-100
  qualityScores: { [station: string]: number };
}

/** Routing decision model */
export interface RoutingDecision {
  id: string;
  workOrderId: string;
  decisionType: RoutingDecisionType;
  previousRoute: string[];
  newRoute: string[];
  trigger: RoutingTrigger;
  triggerReason: string | null;
  factorsConsidered: RoutingFactorsConsidered | null;
  rulesApplied: string[];
  predictionId: string | null;
  predictionScore: number | null;
  decisionMaker: DecisionMaker;
  userId: string | null;
  outcomeStatus: DecisionOutcome | null;
  outcomeNotes: string | null;
  actualDuration: number | null;
  createdAt: Date;
}

/** Constraint definition */
export interface ConstraintDefinition {
  maxValue?: number;
  minValue?: number;
  allowedValues?: string[];
  excludedValues?: string[];
  timeWindows?: { start: string; end: string }[];
  dependencies?: string[];
  expression?: string;           // Advanced: custom expression
}

/** Scheduling constraint model */
export interface SchedulingConstraint {
  id: string;
  name: string;
  description: string | null;
  code: string;
  constraintType: ConstraintType;
  targetType: ConstraintTarget;
  targetId: string | null;
  definition: ConstraintDefinition;
  isHard: boolean;
  violationCost: number | null;
  isActive: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

// NOTE: Input types (CreateRoutingPredictionInput, PredictionFeedbackInput, CreateOptimizationRuleInput)
// are defined in schemas.ts via Zod inference to avoid duplication

/** Routing suggestion for UI */
export interface RoutingSuggestion {
  suggestedRoute: string[];
  confidence: number;
  estimatedDuration: number;
  reasoning: string[];           // Why this route
  alternatives: AlternativeRoute[];
  warnings: string[];            // Any concerns
  explanationFactors: RoutingExplanationFactor[];
}

/** Payload for manually overriding or applying a routing recommendation */
export interface RoutingOverrideInput {
  workOrderId: string;
  predictionId: string | null;
  newRoute: string[];
  reason: string;
  notes: string | null;
  preserveCompletedStations: boolean;
}

/** Station status summary for dashboard */
export interface StationStatusSummary {
  station: string;
  displayName: string;
  status: EquipmentStatus;
  queueDepth: number;
  waitTimeMinutes: number;
  utilizationPct: number;
  isBottleneck: boolean;
  activeOperators: number;
}

/** Routing intelligence dashboard data */
export interface RoutingIntelligenceDashboard {
  stations: StationStatusSummary[];
  bottlenecks: StationStatusSummary[];
  predictions: {
    total: number;
    accepted: number;
    avgConfidence: number;
    avgAccuracy: number;
  };
  recentDecisions: RoutingDecision[];
}

// ============ SSS-008/SSS-011: NLP Query & Command Palette Types ============

import {
  QueryIntent,
  ScheduleFrequency,
  CommandType,
  ActionCategory,
} from './enums.js';

// NOTE: ParsedEntities type is defined in schemas.ts via Zod inference
// Import from '@erp/shared' when needed in consuming code

/** Parsed entities interface for type checking (mirrors Zod schema) */
interface ParsedEntitiesFields {
  customer?: string;
  customerIds?: string[];
  status?: string[];
  dateRange?: {
    start?: Date;
    end?: Date;
    relative?: string;          // "last 30 days", "this quarter"
  };
  station?: string[];
  operator?: string[];
  orderNumbers?: string[];
  amount?: {
    min?: number;
    max?: number;
    comparison?: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  };
  priority?: string[];
  keywords?: string[];
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/** NLP Query record */
export interface NLPQuery {
  id: string;
  userId: string;
  rawQuery: string;
  normalizedQuery: string | null;
  intent: QueryIntent;
  confidence: number;
  entities: ParsedEntitiesFields;
  generatedSQL: string | null;
  generatedAction: string | null;
  actionParams: Record<string, unknown> | null;
  wasExecuted: boolean;
  executedAt: Date | null;
  resultCount: number | null;
  executionTimeMs: number | null;
  wasSuccessful: boolean | null;
  feedbackScore: number | null;
  feedbackNotes: string | null;
  createdAt: Date;
}

/** Saved query for reuse */
export interface SavedQuery {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  rawQuery: string;
  parsedIntent: QueryIntent;
  parsedEntities: ParsedEntitiesFields;
  generatedSQL: string | null;
  generatedAction: string | null;
  actionParams: Record<string, unknown> | null;
  isShared: boolean;
  sharedWithRoles: string[];
  useCount: number;
  lastUsedAt: Date | null;
  isScheduled: boolean;
  scheduleFrequency: ScheduleFrequency | null;
  scheduleCron: string | null;
  nextRunAt: Date | null;
  lastRunAt: Date | null;
  isPinned: boolean;
  dashboardPosition: number | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Command history entry */
export interface CommandHistory {
  id: string;
  userId: string;
  commandType: CommandType;
  command: string;
  context: string | null;
  targetType: string | null;
  targetId: string | null;
  targetLabel: string | null;
  wasSuccessful: boolean;
  resultCount: number | null;
  executionTimeMs: number | null;
  executedAt: Date;
}

/** Quick action definition */
export interface QuickAction {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: ActionCategory;
  keywords: string[];
  routePath: string | null;
  actionHandler: string | null;
  requiredParams: Record<string, unknown> | null;
  requiredRoles: string[];
  requiredPermission: string | null;
  icon: string | null;
  shortcut: string | null;
  isEnabled: boolean;
  sortOrder: number;
  useCount: number;
}

/** User-specific action preferences */
export interface UserActionPreference {
  id: string;
  userId: string;
  actionId: string;
  isPinned: boolean;
  customShortcut: string | null;
  useCount: number;
  lastUsedAt: Date | null;
  isHidden: boolean;
}

/** Search suggestion */
export interface SearchSuggestion {
  id: string;
  userId: string | null;
  phrase: string;
  targetType: string;
  resultCount: number;
  globalScore: number;
  userScore: number;
  lastUsedAt: Date;
}

/** NLP parse result */
export interface NLPParseResult {
  intent: QueryIntent;
  confidence: number;
  entities: ParsedEntitiesFields;
  suggestions: string[];         // Suggested completions
  alternateIntents: Array<{
    intent: QueryIntent;
    confidence: number;
  }>;
}

/** Command palette item */
export interface CommandPaletteItem {
  id: string;
  type: CommandType;
  label: string;
  sublabel?: string;
  icon?: string;
  shortcut?: string;
  score: number;                 // For sorting
  action: () => void | Promise<void>;
  metadata?: Record<string, unknown>;
}

/** Command palette state */
export interface CommandPaletteState {
  isOpen: boolean;
  query: string;
  results: CommandPaletteItem[];
  selectedIndex: number;
  isLoading: boolean;
  recentCommands: CommandHistory[];
  pinnedActions: QuickAction[];
}

/** Executive dashboard query result */
export interface DashboardQueryResult {
  queryId: string;
  title: string;
  description: string;
  data: unknown[];
  columns: Array<{
    key: string;
    label: string;
    type: 'string' | 'number' | 'date' | 'currency' | 'percent';
  }>;
  visualization?: 'table' | 'bar' | 'line' | 'pie' | 'metric';
  summary?: {
    label: string;
    value: string | number;
    change?: number;
    changeLabel?: string;
  };
  executedAt: Date;
  executionTimeMs: number;
}

/** NLP training example */
export interface NLPTrainingExample {
  rawQuery: string;
  intent: QueryIntent;
  entities: ParsedEntitiesFields;
  isVerified: boolean;
}

// ============ SSS-015: Integration Automation Platform Types ============

import {
  WorkflowCategory,
  WorkflowTriggerType,
  WorkflowErrorAction,
  WorkflowStepType,
  WorkflowActionType,
  WorkflowExecutionStatus,
  WorkflowStepStatus,
  WorkflowVariableType,
} from './enums.js';

/** Trigger conditions for workflows */
export interface WorkflowTriggerConditions {
  field?: string;                // Field to check
  operator?: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'startsWith' | 'endsWith' | 'in' | 'notIn';
  value?: unknown;
  and?: WorkflowTriggerConditions[];
  or?: WorkflowTriggerConditions[];
}

/** Action configuration for workflow steps */
export interface WorkflowActionConfig {
  // For email
  to?: string | string[];
  cc?: string[];
  subject?: string;
  body?: string;
  templateId?: string;
  
  // For webhook
  url?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  payload?: unknown;
  
  // For record operations
  entityType?: string;
  entityId?: string;
  data?: Record<string, unknown>;
  query?: Record<string, unknown>;
  
  // For status updates
  newStatus?: string;
  
  // For delays
  delaySeconds?: number;
  delayUntil?: string;         // Datetime or expression
  
  // For conditions
  condition?: WorkflowTriggerConditions;
  trueBranch?: string;         // Step ID
  falseBranch?: string;        // Step ID
  
  // For loops
  items?: string;              // Expression returning array
  itemVariable?: string;       // Variable name for current item
  
  // Custom parameters
  params?: Record<string, unknown>;
}

/** Workflow definition */
export interface Workflow {
  id: string;
  createdById: string;
  name: string;
  description: string | null;
  code: string;
  category: WorkflowCategory;
  triggerType: WorkflowTriggerType;
  triggerEvent: string | null;
  triggerSchedule: string | null;
  triggerWebhook: string | null;
  triggerConditions: WorkflowTriggerConditions | null;
  version: number;
  isPublished: boolean;
  publishedAt: Date | null;
  maxRetries: number;
  retryDelaySeconds: number;
  onErrorAction: WorkflowErrorAction;
  notifyOnError: boolean;
  errorNotifyEmails: string[];
  isActive: boolean;
  lastTriggeredAt: Date | null;
  successCount: number;
  failureCount: number;
  createdAt: Date;
  updatedAt: Date;
  
  // Relations
  steps?: WorkflowStep[];
  executions?: WorkflowExecution[];
}

/** Workflow step definition */
export interface WorkflowStep {
  id: string;
  workflowId: string;
  name: string;
  description: string | null;
  stepOrder: number;
  stepType: WorkflowStepType;
  actionType: WorkflowActionType;
  actionConfig: WorkflowActionConfig;
  conditions: WorkflowTriggerConditions | null;
  skipOnCondition: boolean;
  timeoutSeconds: number;
  maxRetries: number | null;
  retryDelaySeconds: number | null;
  onError: WorkflowErrorAction | null;
  nextStepOnSuccess: string | null;
  nextStepOnFailure: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Workflow execution instance */
export interface WorkflowExecution {
  id: string;
  workflowId: string;
  triggeredBy: WorkflowTriggerType;
  triggerData: Record<string, unknown> | null;
  triggerEntityType: string | null;
  triggerEntityId: string | null;
  status: WorkflowExecutionStatus;
  startedAt: Date | null;
  completedAt: Date | null;
  currentStepId: string | null;
  output: unknown | null;
  error: string | null;
  errorDetails: Record<string, unknown> | null;
  attemptNumber: number;
  nextRetryAt: Date | null;
  durationMs: number | null;
  createdAt: Date;
  updatedAt: Date;
  
  // Relations
  stepExecutions?: WorkflowStepExecution[];
}

/** Individual step execution */
export interface WorkflowStepExecution {
  id: string;
  executionId: string;
  stepId: string;
  status: WorkflowStepStatus;
  startedAt: Date | null;
  completedAt: Date | null;
  inputData: unknown | null;
  outputData: unknown | null;
  error: string | null;
  errorDetails: Record<string, unknown> | null;
  attemptNumber: number;
  durationMs: number | null;
  createdAt: Date;
}

/** Workflow template */
export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  code: string;
  category: WorkflowCategory;
  definition: WorkflowTemplateDefinition;
  useCount: number;
  isBuiltIn: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Template definition structure */
export interface WorkflowTemplateDefinition {
  triggerType: WorkflowTriggerType;
  triggerConfig: Record<string, unknown>;
  steps: Array<{
    name: string;
    stepType: WorkflowStepType;
    actionType: WorkflowActionType;
    actionConfig: WorkflowActionConfig;
    conditions?: WorkflowTriggerConditions;
  }>;
  variables?: Record<string, unknown>;
}

/** Workflow variable */
export interface WorkflowVariable {
  id: string;
  name: string;
  description: string | null;
  variableType: WorkflowVariableType;
  defaultValue: string | null;
  isSecret: boolean;
  encryptedValue: string | null;
  isGlobal: boolean;
  workflowIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

/** Workflow builder canvas state */
export interface WorkflowBuilderState {
  workflow: Partial<Workflow>;
  steps: WorkflowStep[];
  selectedStepId: string | null;
  isDirty: boolean;
  validationErrors: WorkflowValidationError[];
}

/** Validation error for workflow builder */
export interface WorkflowValidationError {
  stepId?: string;
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

/** Workflow execution summary for dashboard */
export interface WorkflowExecutionSummary {
  workflowId: string;
  workflowName: string;
  totalExecutions: number;
  successCount: number;
  failureCount: number;
  avgDurationMs: number;
  lastExecutedAt: Date | null;
  lastStatus: WorkflowExecutionStatus | null;
}

// ============================================================================
// DATA INTEGRITY & VALIDATION TYPES
// ============================================================================

/** Validation rule definition */
export interface ValidationRule {
  id: string;
  name: string;
  description: string | null;
  entityType: string;
  triggerEvent: ValidationTrigger;
  expression: string;
  conditionExpression: string | null;
  errorMessage: string;
  errorField: string | null;
  severity: ValidationSeverity;
  priority: number;
  isEnabled: boolean;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ValidationTrigger enum is defined in enums.ts

/** Field constraint definition */
export interface FieldConstraint {
  id: string;
  entityType: string;
  fieldName: string;
  constraintType: FieldConstraintType;
  minValue: number | null;
  maxValue: number | null;
  pattern: string | null;
  allowedValues: string[];
  customValidator: string | null;
  errorMessage: string;
  severity: ConstraintSeverity;
  isEnabled: boolean;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ConstraintSeverity enum is defined in enums.ts

/** Data integrity check definition */
export interface DataIntegrityCheck {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  entityType: string | null;
  checkQuery: string;
  expectedResult: string | null;
  frequency: CheckFrequency;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  lastStatus: IntegrityCheckStatus;
  lastViolationCount: number;
  lastErrorMessage: string | null;
  canAutoFix: boolean;
  autoFixQuery: string | null;
  isEnabled: boolean;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
  
  // Relations
  anomalyLogs?: DataAnomalyLog[];
}

/** Data anomaly log entry */
export interface DataAnomalyLog {
  id: string;
  integrityCheckId: string | null;
  anomalyType: AnomalyType;
  entityType: string;
  entityId: string | null;
  fieldName: string | null;
  description: string;
  details: Record<string, unknown> | null;
  severity: AnomalySeverity;
  status: AnomalyStatus;
  resolvedAt: Date | null;
  resolvedById: string | null;
  resolutionNotes: string | null;
  createdAt: Date;
  
  // Relations
  integrityCheck?: DataIntegrityCheck;
}

// AnomalySeverity and AnomalyStatus enums are defined in enums.ts

// ============================================================================
// VALIDATION SERVICE TYPES
// ============================================================================

/** Validation result from running a rule - extended interface */
export interface ValidationResultDetails {
  isValid: boolean;
  errors: ValidationErrorInfo[];
  warnings: ValidationWarningInfo[];
  rulesEvaluated: number;
  executionTimeMs: number;
}

/** Validation error info */
export interface ValidationErrorInfo {
  ruleId?: string;
  ruleName?: string;
  field: string;
  message: string;
  code?: string;
  severity: 'ERROR';
}

/** Validation warning info */
export interface ValidationWarningInfo {
  ruleId?: string;
  ruleName?: string;
  field: string;
  message: string;
  severity: 'WARNING';
}

/** Integrity check result */
export interface IntegrityCheckResult {
  checkId: string;
  checkName: string;
  status: IntegrityCheckStatus;
  violationCount: number;
  violations: IntegrityViolation[];
  executionTimeMs: number;
  autoFixed: number;
}

/** Individual integrity violation */
export interface IntegrityViolation {
  entityType: string;
  entityId: string;
  fieldName?: string;
  description: string;
  suggestedFix?: string;
}

/** Batch validation request payload */
export interface BatchValidationPayload {
  entityType: string;
  entities: Array<{ id: string; data: Record<string, unknown> }>;
  triggerEvent?: ValidationTrigger;
}

/** Batch validation response */
export interface BatchValidationResponseDetails {
  totalCount: number;
  validCount: number;
  invalidCount: number;
  results: Array<{
    entityId: string;
    isValid: boolean;
    errors: ValidationErrorInfo[];
  }>;
}

// ============================================================================
// AUDIT & COMPLIANCE TYPES
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

/** Audit event record */
export interface AuditEvent {
  id: string;
  eventType: AuditEventType;
  category: AuditCategory;
  entityType: string;
  entityId: string;
  entityName: string | null;
  userId: string | null;
  userEmail: string | null;
  userRole: string | null;
  action: string;
  fieldChanges: FieldChange[] | null;
  previousState: Record<string, unknown> | null;
  newState: Record<string, unknown> | null;
  reason: string | null;
  comment: string | null;
  ticketReference: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  sessionId: string | null;
  requestId: string | null;
  timestamp: Date;
  processedAt: Date | null;
  retainUntil: Date | null;
  isLegalHold: boolean;
}

// Note: FieldChange interface defined earlier in Audit Types section
// This duplicate removed during audit cleanup

/** Signature log record */
export interface SignatureLog {
  id: string;
  entityType: string;
  entityId: string;
  documentType: SignatureDocType;
  documentVersion: number;
  signerId: string;
  signerName: string;
  signerEmail: string;
  signerTitle: string | null;
  signatureType: SignatureType;
  signatureValue: string | null;
  signatureImage: string | null;
  certificateId: string | null;
  isVerified: boolean;
  verifiedAt: Date | null;
  verificationMethod: string | null;
  signatureIntent: string;
  legalStatement: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  geolocation: string | null;
  signedAt: Date;
  expiresAt: Date | null;
}

/** Compliance rule definition */
export interface ComplianceRule {
  id: string;
  name: string;
  code: string;
  description: string | null;
  category: ComplianceCategory;
  regulation: string | null;
  entityType: string | null;
  checkExpression: string;
  severity: ComplianceSeverity;
  onViolation: ComplianceAction;
  alertRecipients: string[];
  blockingLevel: number;
  checkFrequency: CheckFrequency;
  lastCheckedAt: Date | null;
  isEnabled: boolean;
  effectiveFrom: Date | null;
  effectiveUntil: Date | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Compliance violation record */
export interface ComplianceViolation {
  id: string;
  ruleId: string;
  entityType: string;
  entityId: string;
  fieldName: string | null;
  description: string;
  violationData: Record<string, unknown> | null;
  severity: ComplianceSeverity;
  status: ViolationStatus;
  resolvedById: string | null;
  resolvedAt: Date | null;
  resolution: string | null;
  remediation: string | null;
  evidenceUrls: string[];
  createdAt: Date;
  
  // Relations
  rule?: ComplianceRule;
}

/** Data retention policy */
export interface DataRetentionPolicy {
  id: string;
  name: string;
  entityType: string;
  description: string | null;
  retentionPeriodDays: number;
  retentionBasis: RetentionBasis;
  legalReference: string | null;
  triggerField: string;
  triggerCondition: string | null;
  expiryAction: ExpiryAction;
  archiveLocation: string | null;
  excludeCondition: string | null;
  legalHoldExempt: boolean;
  isEnabled: boolean;
  lastRunAt: Date | null;
  recordsProcessed: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Access log record */
export interface AccessLog {
  id: string;
  userId: string | null;
  userEmail: string | null;
  sessionId: string | null;
  resourceType: string;
  resourceId: string | null;
  resourceName: string | null;
  accessType: AccessType;
  accessMethod: string | null;
  endpoint: string | null;
  queryParams: Record<string, unknown> | null;
  wasSuccessful: boolean;
  failureReason: string | null;
  dataVolume: number | null;
  ipAddress: string | null;
  userAgent: string | null;
  geolocation: string | null;
  deviceId: string | null;
  riskScore: number | null;
  riskFactors: string[];
  flaggedForReview: boolean;
  timestamp: Date;
}

/** Audit trail filter options - extended interface */
export interface AuditEventFilterOptions {
  entityType?: string;
  entityId?: string;
  userId?: string;
  eventTypes?: AuditEventType[];
  categories?: AuditCategory[];
  startDate?: Date;
  endDate?: Date;
  includeSystem?: boolean;
  limit?: number;
  offset?: number;
}

/** Comprehensive audit trail summary for entity */
export interface EntityAuditTrailSummary {
  entityType: string;
  entityId: string;
  totalEvents: number;
  lastModified: Date | null;
  lastModifiedBy: string | null;
  createdAt: Date | null;
  createdBy: string | null;
  eventsByType: Partial<Record<AuditEventType, number>>;
}

// ============================================================================
// MULTI-TENANCY & ORGANIZATION TYPES
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

/** Organization entity */
export interface Organization {
  id: string;
  name: string;
  legalName: string | null;
  code: string;
  slug: string;
  orgType: OrganizationType;
  parentId: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address1: string | null;
  address2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string;
  taxId: string | null;
  industry: string | null;
  timezone: string;
  currency: string;
  fiscalYearStart: number;
  logoUrl: string | null;
  primaryColor: string | null;
  subscriptionTier: SubscriptionTier;
  maxUsers: number;
  maxLocations: number;
  status: OrgStatus;
  activatedAt: Date | null;
  suspendedAt: Date | null;
  suspendReason: string | null;
  features: string[];
  createdAt: Date;
  updatedAt: Date;
  
  // Relations
  parent?: Organization;
  children?: Organization[];
  locations?: Location[];
  departments?: Department[];
  teams?: Team[];
}

/** Location entity */
export interface Location {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  locationType: LocationType;
  address1: string;
  address2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  email: string | null;
  managerUserId: string | null;
  timezone: string;
  operatingHours: Record<string, { open: string; close: string }> | null;
  isHeadquarters: boolean;
  squareFootage: number | null;
  maxCapacity: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  
  // Relations
  organization?: Organization;
  departments?: Department[];
  teams?: Team[];
}

/** Department entity */
export interface Department {
  id: string;
  organizationId: string;
  locationId: string | null;
  name: string;
  code: string;
  description: string | null;
  parentId: string | null;
  costCenterCode: string | null;
  budgetCode: string | null;
  annualBudget: number | null;
  managerUserId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  
  // Relations
  organization?: Organization;
  location?: Location;
  parent?: Department;
  children?: Department[];
  teams?: Team[];
}

/** Department membership */
export interface DepartmentMember {
  id: string;
  departmentId: string;
  userId: string;
  role: DeptMemberRole;
  isPrimary: boolean;
  joinedAt: Date;
}

/** Team entity */
export interface Team {
  id: string;
  organizationId: string;
  locationId: string | null;
  departmentId: string | null;
  name: string;
  code: string;
  description: string | null;
  teamType: TeamType;
  maxMembers: number | null;
  targetCapacity: number | null;
  leadUserId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  
  // Relations
  organization?: Organization;
  location?: Location;
  department?: Department;
  members?: TeamMember[];
}

/** Team membership */
export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: TeamMemberRole;
  allocation: number;
  joinedAt: Date;
}

/** Organization-user relationship */
export interface OrganizationUser {
  id: string;
  organizationId: string;
  userId: string;
  role: OrgUserRole;
  isPrimaryOrg: boolean;
  invitedById: string | null;
  joinedAt: Date;
}

/** Organization setting */
export interface OrganizationSetting {
  id: string;
  organizationId: string;
  category: SettingCategory;
  key: string;
  value: string;
  valueType: SettingValueType;
  description: string | null;
  isSecret: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** User's organization context */
export interface UserOrgContext {
  organizationId: string;
  organizationName: string;
  role: OrgUserRole;
  isPrimary: boolean;
  permissions: string[];
}

// ============================================================================
// FINANCIAL TRACKING & COST ACCOUNTING TYPES
// ============================================================================

/** Cost center entity */
export interface CostCenter {
  id: string;
  organizationId: string | null;
  code: string;
  name: string;
  description: string | null;
  glAccountCode: string | null;
  glSubAccount: string | null;
  parentId: string | null;
  centerType: CostCenterType;
  annualBudget: number | null;
  budgetPeriod: BudgetPeriod;
  allocationMethod: AllocationMethod | null;
  allocationBasis: string | null;
  isActive: boolean;
  effectiveFrom: Date | null;
  effectiveUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
  
  // Relations
  parent?: CostCenter;
  children?: CostCenter[];
}

/** Material cost record */
export interface MaterialCost {
  id: string;
  workOrderId: string;
  lineItemId: string | null;
  costCenterId: string | null;
  materialType: MaterialType;
  description: string;
  itemMasterId: string | null;
  vendorId: string | null;
  purchaseOrderId: string | null;
  quantityUsed: number;
  quantityUnit: string;
  quantityWasted: number;
  wasteReason: string | null;
  unitCost: number;
  totalCost: number;
  wasteCost: number;
  chargedAmount: number | null;
  usedAt: Date;
  recordedById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Labor cost actual record */
export interface LaborCostActual {
  id: string;
  workOrderId: string;
  costCenterId: string | null;
  userId: string;
  station: PrintingMethod | null;
  activity: LaborActivity;
  description: string | null;
  startTime: Date;
  endTime: Date | null;
  regularHours: number;
  overtimeHours: number;
  regularRate: number;
  overtimeRate: number;
  burdenRate: number;
  laborCost: number;
  burdenCost: number;
  totalCost: number;
  isBillable: boolean;
  billedAmount: number | null;
  billingRate: number | null;
  status: LaborCostStatus;
  approvedById: string | null;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Overhead allocation record */
export interface OverheadAllocation {
  id: string;
  fromCostCenterId: string;
  workOrderId: string | null;
  periodStart: Date;
  periodEnd: Date;
  allocationMethod: AllocationMethod;
  allocationBasis: string | null;
  basisValue: number | null;
  totalPoolValue: number | null;
  amount: number;
  category: OverheadCategory;
  createdAt: Date;
}

/** Profitability snapshot */
export interface ProfitabilitySnapshot {
  id: string;
  entityType: ProfitEntityType;
  entityId: string;
  snapshotDate: Date;
  periodStart: Date | null;
  periodEnd: Date | null;
  grossRevenue: number;
  discounts: number;
  netRevenue: number;
  materialCost: number;
  laborCost: number;
  outsourcedCost: number;
  shippingCost: number;
  totalDirectCost: number;
  grossProfit: number;
  grossMarginPct: number;
  overheadAllocation: number;
  operatingProfit: number;
  operatingMarginPct: number;
  estimatedProfit: number | null;
  varianceAmount: number | null;
  variancePct: number | null;
  profitabilityTier: ProfitabilityTier | null;
  notes: string | null;
  createdAt: Date;
}

/** Job cost summary */
export interface JobCostSummary {
  workOrderId: string;
  orderNumber: string;
  revenue: number;
  materialCosts: number;
  laborCosts: number;
  overheadAllocation: number;
  totalCost: number;
  grossProfit: number;
  grossMarginPct: number;
  status: 'ESTIMATED' | 'IN_PROGRESS' | 'FINAL';
}

// ============================================================================
// SCHEDULING & CAPACITY PLANNING TYPES
// ============================================================================

/** Resource calendar event */
export interface ResourceCalendar {
  id: string;
  organizationId: string | null;
  resourceType: ResourceType;
  resourceId: string;
  resourceName: string;
  title: string | null;
  eventType: CalendarEventType;
  startTime: Date;
  endTime: Date;
  allDay: boolean;
  isRecurring: boolean;
  recurrencePattern: RecurrencePattern | null;
  recurrenceEndDate: Date | null;
  recurrenceExceptions: Date[] | null;
  parentEventId: string | null;
  availableCapacity: number | null;
  notes: string | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Capacity plan */
export interface CapacityPlan {
  id: string;
  organizationId: string | null;
  locationId: string | null;
  name: string;
  description: string | null;
  periodStart: Date;
  periodEnd: Date;
  granularity: CapacityGranularity;
  status: CapacityPlanStatus;
  approvedById: string | null;
  approvedAt: Date | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
  periods?: CapacityPeriod[];
}

/** Capacity period within a plan */
export interface CapacityPeriod {
  id: string;
  planId: string;
  periodStart: Date;
  periodEnd: Date;
  resourceType: ResourceType;
  resourceId: string;
  station: PrintingMethod | null;
  totalCapacity: number;
  allocatedCapacity: number;
  reservedCapacity: number;
  availableCapacity: number;
  forecastedDemand: number;
  actualDemand: number;
  targetUtilization: number;
  projectedUtilization: number | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Setup time for changeover tracking */
export interface SetupTime {
  id: string;
  organizationId: string | null;
  resourceType: ResourceType;
  resourceId: string | null;
  station: PrintingMethod;
  fromProductType: string | null;
  toProductType: string | null;
  fromMaterial: string | null;
  toMaterial: string | null;
  setupTimeMinutes: number;
  teardownTimeMinutes: number;
  cleanupTimeMinutes: number;
  totalMinutes: number;
  minMinutes: number | null;
  maxMinutes: number | null;
  requiresOperatorSkill: string | null;
  requiresTools: string[] | null;
  notes: string | null;
  lastUsed: Date | null;
  useCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Skill matrix entry for operator capabilities */
export interface SkillMatrixEntry {
  id: string;
  userId: string;
  organizationId: string | null;
  station: PrintingMethod | null;
  skillCategory: string;
  skillName: string;
  skillLevel: SkillLevel;
  certifiedDate: Date | null;
  expirationDate: Date | null;
  efficiencyFactor: number;
  qualityFactor: number;
  trainingRequired: boolean;
  trainingNotes: string | null;
  mentorId: string | null;
  assessedById: string | null;
  assessedAt: Date | null;
  assessmentNotes: string | null;
  nextAssessmentDate: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Schedule conflict */
export interface ScheduleConflict {
  id: string;
  organizationId: string | null;
  conflictType: ScheduleConflictType;
  severity: AlertSeverity;
  primaryEntityType: string;
  primaryEntityId: string;
  secondaryEntityType: string | null;
  secondaryEntityId: string | null;
  conflictStart: Date;
  conflictEnd: Date;
  description: string;
  impact: string | null;
  suggestedResolutions: string[] | null;
  status: ConflictResolutionStatus;
  resolutionMethod: string | null;
  resolutionNotes: string | null;
  resolvedById: string | null;
  resolvedAt: Date | null;
  detectedById: string | null;
  detectedAt: Date;
  acknowledgedById: string | null;
  acknowledgedAt: Date | null;
  escalatedTo: string | null;
  escalatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Capacity utilization summary */
export interface CapacityUtilizationSummary {
  resourceType: ResourceType;
  resourceId: string;
  resourceName: string;
  periodStart: Date;
  periodEnd: Date;
  totalCapacityHours: number;
  allocatedHours: number;
  utilizationPct: number;
  availableHours: number;
  status: 'UNDER_UTILIZED' | 'OPTIMAL' | 'NEAR_CAPACITY' | 'OVER_CAPACITY';
}

/** Operator skill summary */
export interface OperatorSkillSummary {
  userId: string;
  userName: string;
  stationSkills: {
    station: PrintingMethod;
    skillLevel: SkillLevel;
    efficiencyFactor: number;
  }[];
  certificationStatus: 'CURRENT' | 'EXPIRING_SOON' | 'EXPIRED' | 'NEEDS_ASSESSMENT';
}

// ============================================================================
// CUSTOMER RELATIONSHIP ENHANCEMENT TYPES
// ============================================================================

/** Customer hierarchy relationship */
export interface CustomerHierarchy {
  id: string;
  parentCustomerId: string;
  childCustomerId: string;
  relationType: CustomerRelationType;
  effectiveFrom: Date;
  effectiveUntil: Date | null;
  isPrimary: boolean;
  inheritBilling: boolean;
  inheritPricing: boolean;
  inheritTerms: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Contact person */
export interface ContactPerson {
  id: string;
  customerId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  fax: string | null;
  role: ContactRole;
  jobTitle: string | null;
  department: string | null;
  preferredContactMethod: PreferredContactMethod;
  timezone: string | null;
  language: string;
  hasPortalAccess: boolean;
  portalUserId: string | null;
  receiveOrderUpdates: boolean;
  receiveProofApprovals: boolean;
  receiveInvoices: boolean;
  receiveMarketing: boolean;
  isPrimary: boolean;
  isActive: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Customer preferences */
export interface CustomerPreference {
  id: string;
  customerId: string;
  defaultPriority: number | null;
  defaultPaymentTerms: string | null;
  defaultShippingMethod: string | null;
  defaultCarrier: string | null;
  defaultRouting: PrintingMethod[];
  brandGuidelinesUrl: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  defaultFont: string | null;
  requiresProofApproval: boolean;
  proofApprovalEmails: string[];
  artworkFormat: string | null;
  minimumDPI: number | null;
  colorProfile: string | null;
  shipCompleteOnly: boolean;
  allowPartialShip: boolean;
  requireSignature: boolean;
  liftgateRequired: boolean;
  residentialDelivery: boolean;
  packingInstructions: string | null;
  labelingRequirements: string | null;
  specialHandling: string | null;
  orderConfirmationRequired: boolean;
  shipmentNotificationRequired: boolean;
  invoiceDeliveryMethod: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Customer score */
export interface CustomerScore {
  id: string;
  customerId: string;
  scoreDate: Date;
  lifetimeValue: number | null;
  last12MonthsRevenue: number | null;
  averageOrderValue: number | null;
  paymentScore: number | null;
  orderCount: number;
  last12MonthsOrders: number;
  daysSinceLastOrder: number | null;
  orderFrequencyDays: number | null;
  portalLogins: number;
  emailOpenRate: number | null;
  responseTime: number | null;
  relationshipDays: number | null;
  escalationCount: number;
  complaintCount: number;
  financialScore: number;
  engagementScore: number;
  loyaltyScore: number;
  overallScore: number;
  tier: CustomerTier;
  previousTier: CustomerTier | null;
  tierChangedAt: Date | null;
  churnRiskScore: number | null;
  churnRiskFactors: Record<string, unknown> | null;
  recommendations: string[] | null;
  createdAt: Date;
}

/** Customer communication log */
export interface CustomerCommunicationLog {
  id: string;
  customerId: string;
  contactPersonId: string | null;
  channel: CommunicationChannel;
  direction: CommunicationDirection;
  subject: string | null;
  summary: string;
  content: string | null;
  workOrderId: string | null;
  quoteId: string | null;
  invoiceId: string | null;
  ticketId: string | null;
  externalId: string | null;
  duration: number | null;
  sentiment: CommunicationSentiment | null;
  sentimentScore: number | null;
  keyPhrases: string[];
  topics: string[];
  requiresFollowUp: boolean;
  followUpDate: Date | null;
  followUpAssignedTo: string | null;
  followUpCompleted: boolean;
  followUpCompletedAt: Date | null;
  createdById: string | null;
  createdAt: Date;
}

/** Customer 360 view summary */
export interface Customer360Summary {
  customerId: string;
  customerName: string;
  companyName: string | null;
  tier: CustomerTier;
  overallScore: number;
  lifetimeValue: number;
  last12MonthsRevenue: number;
  openOrdersCount: number;
  openOrdersValue: number;
  averageOrderValue: number;
  daysSinceLastOrder: number | null;
  paymentStatus: 'CURRENT' | 'OVERDUE' | 'CREDIT_HOLD';
  primaryContact: {
    name: string;
    email: string | null;
    phone: string | null;
  } | null;
  recentInteractions: number;
  pendingFollowUps: number;
  churnRisk: 'LOW' | 'MEDIUM' | 'HIGH' | null;
}

// ============================================================================
// INVENTORY & SUPPLY CHAIN INTELLIGENCE TYPES
// ============================================================================

/** Demand forecast */
export interface DemandForecast {
  id: string;
  organizationId: string | null;
  itemMasterId: string | null;
  materialCategory: string | null;
  periodStart: Date;
  periodEnd: Date;
  granularity: ForecastGranularity;
  forecastQuantity: number;
  minQuantity: number | null;
  maxQuantity: number | null;
  confidenceLevel: number | null;
  historicalPeriods: number | null;
  historicalAverage: number | null;
  trendFactor: number | null;
  seasonalFactor: number | null;
  forecastMethod: ForecastMethod;
  modelParameters: Record<string, unknown> | null;
  actualQuantity: number | null;
  forecastError: number | null;
  errorPercentage: number | null;
  status: ForecastStatus;
  approvedById: string | null;
  approvedAt: Date | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Reorder point */
export interface ReorderPoint {
  id: string;
  organizationId: string | null;
  itemMasterId: string;
  minQuantity: number;
  reorderQuantity: number;
  maxQuantity: number | null;
  isDynamic: boolean;
  leadTimeDays: number;
  safetyStockDays: number;
  demandPerDay: number | null;
  calculatedReorderPoint: number | null;
  calculatedSafetyStock: number | null;
  nextReorderDate: Date | null;
  preferredSupplierId: string | null;
  alternateSupplierIds: string[];
  lastCalculatedAt: Date | null;
  lastOrderedAt: Date | null;
  lastOrderQuantity: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Supplier performance */
export interface SupplierPerformance {
  id: string;
  vendorId: string;
  organizationId: string | null;
  periodStart: Date;
  periodEnd: Date;
  ordersPlaced: number;
  ordersReceived: number;
  ordersOnTime: number;
  ordersComplete: number;
  ordersCancelled: number;
  averageLeadDays: number | null;
  itemsReceived: number;
  itemsDefective: number;
  itemsReturned: number;
  qualityScore: number | null;
  totalSpend: number | null;
  priceVariance: number | null;
  savingsAchieved: number | null;
  avgResponseTime: number | null;
  quotesRequested: number;
  quotesReceived: number;
  deliveryScore: number | null;
  qualityMetricScore: number | null;
  priceScore: number | null;
  responsivenessScore: number | null;
  overallScore: number | null;
  performanceTier: SupplierTier | null;
  issues: string[] | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Material substitution */
export interface MaterialSubstitution {
  id: string;
  organizationId: string | null;
  primaryItemId: string;
  substituteItemId: string;
  substitutionType: SubstitutionType;
  conversionFactor: number;
  maxSubstituteQty: number | null;
  requiresApproval: boolean;
  approvalThreshold: number | null;
  costDifference: number | null;
  qualityImpact: string | null;
  isActive: boolean;
  usageCount: number;
  lastUsedAt: Date | null;
  notes: string | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Inventory transaction */
export interface InventoryTransaction {
  id: string;
  organizationId: string | null;
  locationId: string | null;
  itemMasterId: string;
  transactionType: InventoryTransactionType;
  transactionDate: Date;
  quantity: number;
  quantityBefore: number | null;
  quantityAfter: number | null;
  unitCost: number | null;
  totalValue: number | null;
  referenceType: string | null;
  referenceId: string | null;
  referenceNumber: string | null;
  fromLocationId: string | null;
  toLocationId: string | null;
  lotNumber: string | null;
  batchNumber: string | null;
  expirationDate: Date | null;
  serialNumbers: string[];
  inspectionRequired: boolean;
  inspectionStatus: string | null;
  inspectedById: string | null;
  inspectedAt: Date | null;
  reasonCode: string | null;
  notes: string | null;
  createdById: string | null;
  createdAt: Date;
}

/** Inventory reservation */
export interface InventoryReservation {
  id: string;
  organizationId: string | null;
  locationId: string | null;
  itemMasterId: string;
  workOrderId: string | null;
  quoteId: string | null;
  lineItemId: string | null;
  quantity: number;
  reservedAt: Date;
  expiresAt: Date | null;
  status: ReservationStatus;
  consumedQuantity: number;
  releasedAt: Date | null;
  releasedById: string | null;
  releaseReason: string | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Inventory status summary */
export interface InventoryStatusSummary {
  itemMasterId: string;
  itemName: string;
  currentQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  reorderPoint: number | null;
  reorderQuantity: number | null;
  status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'OVERSTOCKED';
  nextReorderDate: Date | null;
  forecastedDemand: number | null;
}

// ============================================================================
// QUALITY MANAGEMENT TYPES
// ============================================================================

/** Quality standard - acceptance criteria for products/materials */
export interface QualityStandard {
  id: string;
  code: string;
  name: string;
  description: string | null;
  version: string;
  standardType: QualityStandardType;
  category: string | null;
  applicableTo: string | null;
  criteria: QualityCriterion[];
  samplingMethod: SamplingMethod;
  sampleSize: number | null;
  aqlLevel: number | null;
  status: StandardStatus;
  effectiveDate: Date | null;
  expiryDate: Date | null;
  referenceStandards: string[];
  createdById: string | null;
  approvedById: string | null;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Single quality criterion with tolerance */
export interface QualityCriterion {
  name: string;
  description?: string;
  min?: number;
  max?: number;
  target?: number;
  unit?: string;
  isCritical?: boolean;
}

/** Inspection checkpoint - in-process QC point */
export interface InspectionCheckpoint {
  id: string;
  workOrderId: string | null;
  standardId: string | null;
  stationId: string | null;
  checkpointType: CheckpointType;
  sequenceNumber: number;
  name: string;
  scheduledAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  inspectorId: string | null;
  result: InspectionResult;
  measurements: InspectionMeasurement[] | null;
  passedCount: number;
  failedCount: number;
  totalChecked: number;
  notes: string | null;
  photoUrls: string[];
  disposition: InspectionDisposition | null;
  dispositionNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Individual inspection measurement */
export interface InspectionMeasurement {
  criterion: string;
  value: number | string;
  unit?: string;
  passed: boolean;
  notes?: string;
}

/** Non-Conformance Report (NCR) - defect tracking */
export interface NonConformanceReport {
  id: string;
  ncrNumber: string;
  title: string;
  description: string;
  workOrderId: string | null;
  inspectionId: string | null;
  customerId: string | null;
  category: NCRCategory;
  severity: NCRSeverity;
  source: NCRSource;
  defectType: string | null;
  defectLocation: string | null;
  quantityAffected: number;
  lotNumber: string | null;
  estimatedCost: number | null;
  actualCost: number | null;
  costCategory: string | null;
  status: NCRStatus;
  disposition: NCRDisposition | null;
  dispositionNote: string | null;
  reportedById: string;
  assignedToId: string | null;
  approvedById: string | null;
  approvedAt: Date | null;
  closedById: string | null;
  closedAt: Date | null;
  rootCauseCategory: string | null;
  rootCauseDetail: string | null;
  photoUrls: string[];
  documentUrls: string[];
  createdAt: Date;
  updatedAt: Date;
}

/** Corrective Action - issue resolution workflow */
export interface CorrectiveAction {
  id: string;
  carNumber: string;
  title: string;
  ncrId: string | null;
  actionType: CorrectiveActionType;
  priority: CorrectiveActionPriority;
  problemStatement: string;
  immediateAction: string | null;
  immediateActionDate: Date | null;
  rootCauseMethod: RootCauseMethod | null;
  rootCauseAnalysis: string | null;
  rootCauseCategory: string | null;
  correctiveAction: string | null;
  plannedCompletionDate: Date | null;
  actualCompletionDate: Date | null;
  preventiveAction: string | null;
  preventiveActionDate: Date | null;
  verificationMethod: string | null;
  verificationResult: string | null;
  verifiedAt: Date | null;
  verifiedById: string | null;
  effectivenessReviewDate: Date | null;
  effectivenessResult: EffectivenessResult | null;
  effectivenessNotes: string | null;
  status: CAStatus;
  assignedToId: string | null;
  createdById: string;
  approvedById: string | null;
  approvedAt: Date | null;
  closedById: string | null;
  closedAt: Date | null;
  implementationCost: number | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Quality Metric - trend analysis and SPC */
export interface QualityMetric {
  id: string;
  metricCode: string;
  name: string;
  description: string | null;
  standardId: string | null;
  stationId: string | null;
  category: string | null;
  measurementType: QualityMeasurementType;
  unit: string | null;
  targetValue: number | null;
  lowerLimit: number | null;
  upperLimit: number | null;
  lowerSpec: number | null;
  upperSpec: number | null;
  sampleSize: number;
  calculationMethod: string | null;
  enableSPC: boolean;
  chartType: SPCChartType | null;
  isActive: boolean;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Quality observation - individual measurement */
export interface QualityObservation {
  id: string;
  metricId: string;
  workOrderId: string | null;
  lotNumber: string | null;
  sampleNumber: number | null;
  value: number;
  timestamp: Date;
  inControl: boolean;
  inSpec: boolean;
  alertTriggered: boolean;
  alertType: string | null;
  recordedById: string | null;
  notes: string | null;
  createdAt: Date;
}

/** SPC chart data point */
export interface SPCDataPoint {
  timestamp: Date;
  value: number;
  sampleNumber: number;
  inControl: boolean;
  inSpec: boolean;
}

/** SPC control chart data */
export interface SPCChartData {
  metricId: string;
  metricName: string;
  chartType: SPCChartType;
  centerLine: number;
  upperControlLimit: number;
  lowerControlLimit: number;
  upperSpecLimit: number | null;
  lowerSpecLimit: number | null;
  dataPoints: SPCDataPoint[];
  isOutOfControl: boolean;
  outOfControlPoints: number[];
}

/** Quality dashboard summary */
export interface QualityDashboardSummary {
  totalInspections: number;
  passRate: number;
  failRate: number;
  openNCRs: number;
  criticalNCRs: number;
  openCARs: number;
  overdueCARs: number;
  avgTimeToClose: number;  // Days
  topDefectTypes: { type: string; count: number }[];
  topRootCauses: { cause: string; count: number }[];
  trendData: {
    period: string;
    inspections: number;
    passRate: number;
    ncrCount: number;
  }[];
}

// ============================================================================
// DOCUMENT MANAGEMENT TYPES
// ============================================================================

/** Document version - version control for documents */
export interface DocumentVersion {
  id: string;
  documentId: string;
  versionNumber: number;
  majorVersion: number;
  minorVersion: number;
  versionLabel: string | null;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  checksum: string | null;
  changeNotes: string | null;
  changedFields: string[];
  status: DocumentVersionStatus;
  isCurrentVersion: boolean;
  createdById: string;
  createdAt: Date;
}

/** Document template - reusable document templates */
export interface DocumentTemplate {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string;  // DocumentCategory from Prisma
  subcategory: string | null;
  templateType: TemplateType;
  templateUrl: string | null;
  templateContent: string | null;
  placeholders: TemplatePlaceholder[] | null;
  outputFormat: string;
  paperSize: string;
  orientation: string;
  usageCount: number;
  lastUsedAt: Date | null;
  isActive: boolean;
  isDefault: boolean;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Template placeholder definition */
export interface TemplatePlaceholder {
  name: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'list' | 'image';
  required: boolean;
  defaultValue?: string;
  description?: string;
  validation?: string;  // Regex pattern
}

/** Document approval - review workflow */
export interface DocumentApproval {
  id: string;
  documentVersionId: string;
  approvalLevel: number;
  approvalType: ApprovalType;
  approverId: string;
  status: ApprovalStatus;
  decision: ApprovalDecision | null;
  comments: string | null;
  decidedAt: Date | null;
  dueDate: Date | null;
  reminderSentAt: Date | null;
  delegatedToId: string | null;
  delegatedAt: Date | null;
  delegationReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Document tag - tagging system */
export interface DocumentTag {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string | null;
  parentId: string | null;
  usageCount: number;
  createdById: string | null;
  createdAt: Date;
}

/** Document access rule - permission management */
export interface DocumentAccess {
  id: string;
  documentId: string;
  accessType: DocumentAccessType;
  userId: string | null;
  role: string | null;
  canView: boolean;
  canDownload: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canShare: boolean;
  canApprove: boolean;
  validFrom: Date;
  validUntil: Date | null;
  grantedById: string | null;
  grantedAt: Date;
  revokedAt: Date | null;
  revokedById: string | null;
}

/** Document access log entry */
export interface DocumentAccessLog {
  id: string;
  documentId: string;
  versionId: string | null;
  accessType: DocumentAccessAction;
  userId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  success: boolean;
  failureReason: string | null;
  accessedAt: Date;
}

/** Document with full version history */
export interface DocumentWithVersions {
  id: string;
  name: string;
  fileName: string;
  category: string;
  tags: string[];
  description: string | null;
  currentVersion: DocumentVersion | null;
  versions: DocumentVersion[];
  accessRules: DocumentAccess[];
  pendingApprovals: DocumentApproval[];
  createdAt: Date;
  updatedAt: Date;
}

/** Approval workflow status summary */
export interface ApprovalWorkflowStatus {
  documentVersionId: string;
  documentName: string;
  totalApprovers: number;
  approvedCount: number;
  rejectedCount: number;
  pendingCount: number;
  currentLevel: number;
  isComplete: boolean;
  isFinalApproved: boolean;
  nextApprover: { id: string; name: string } | null;
  daysInReview: number;
}

// ============================================================================
// PERFORMANCE & ANALYTICS TYPES
// ============================================================================

/** Daily metric snapshot - pre-calculated KPIs */
export interface DailyMetricSnapshot {
  id: string;
  date: Date;
  metricType: MetricSnapshotType;
  scopeType: MetricScopeType;
  scopeId: string | null;
  
  // Order metrics
  ordersReceived: number;
  ordersCompleted: number;
  ordersShipped: number;
  ordersCancelled: number;
  ordersOnHold: number;
  ordersInProgress: number;
  orderBacklog: number;
  
  // Financial metrics
  revenueTotal: number;
  revenueCompleted: number;
  costTotal: number;
  profitMargin: number | null;
  
  // Production metrics
  unitsProduced: number;
  sqftProduced: number;
  hoursWorked: number;
  productiveHours: number;
  
  // Efficiency metrics
  utilization: number | null;
  efficiency: number | null;
  firstPassYield: number | null;
  
  // Lead time metrics
  avgLeadTime: number | null;
  minLeadTime: number | null;
  maxLeadTime: number | null;
  p50LeadTime: number | null;
  p90LeadTime: number | null;
  
  // Customer metrics
  newCustomers: number;
  repeatOrders: number;
  customerComplaints: number;
  
  createdAt: Date;
  updatedAt: Date;
}

/** Station throughput - production rate tracking */
export interface StationThroughput {
  id: string;
  stationId: string;
  date: Date;
  periodType: ThroughputPeriod;
  periodStart: Date;
  periodEnd: Date;
  
  // Volume metrics
  ordersCompleted: number;
  itemsCompleted: number;
  unitsCompleted: number;
  sqftCompleted: number;
  
  // Time metrics
  availableMinutes: number;
  productiveMinutes: number;
  downtimeMinutes: number;
  setupMinutes: number;
  
  // Rate metrics
  throughputRate: number | null;
  cycleTime: number | null;
  
  // Quality
  defectCount: number;
  reworkCount: number;
  scrapCount: number;
  
  // Queue
  queueSizeStart: number;
  queueSizeEnd: number;
  avgQueueSize: number | null;
  
  createdAt: Date;
}

/** Lead time history - trend analysis */
export interface LeadTimeHistory {
  id: string;
  workOrderId: string;
  
  // Timestamps
  orderReceivedAt: Date;
  orderCompletedAt: Date | null;
  orderShippedAt: Date | null;
  
  // Lead times (in hours)
  totalLeadTime: number | null;
  productionLeadTime: number | null;
  shippingLeadTime: number | null;
  
  // Station breakdowns
  stationTimes: StationTimeBreakdown[] | null;
  
  // Queue times
  totalQueueTime: number | null;
  stationQueueTimes: Record<string, number> | null;
  
  // Classification
  orderType: string | null;
  complexity: string | null;
  
  // Comparison
  estimatedLeadTime: number | null;
  variance: number | null;
  variancePercent: number | null;
  
  createdAt: Date;
}

/** Station time breakdown for lead time analysis */
export interface StationTimeBreakdown {
  stationId: string;
  stationName: string;
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
  queueMinutes: number;
}

/** Bottleneck event - capacity constraint logging */
export interface BottleneckEvent {
  id: string;
  detectedAt: Date;
  resolvedAt: Date | null;
  stationId: string;
  resourceType: BottleneckResource;
  resourceId: string | null;
  bottleneckType: BottleneckType;
  severity: BottleneckSeverity;
  queueDepth: number;
  waitTimeMinutes: number;
  affectedOrderCount: number;
  thresholdExceeded: number | null;
  currentValue: number | null;
  estimatedDelay: number | null;
  revenueAtRisk: number | null;
  resolutionType: BottleneckResolution | null;
  resolutionNotes: string | null;
  detectionMethod: string | null;
  autoDetected: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** User productivity - operator performance metrics */
export interface UserProductivity {
  id: string;
  userId: string;
  date: Date;
  periodType: ProductivityPeriod;
  
  // Time metrics
  scheduledHours: number;
  clockedHours: number;
  productiveHours: number;
  indirectHours: number;
  breakHours: number;
  
  // Output metrics
  ordersWorked: number;
  ordersCompleted: number;
  itemsCompleted: number;
  unitsCompleted: number;
  sqftCompleted: number;
  
  // Efficiency metrics
  productivity: number | null;
  efficiency: number | null;
  utilization: number | null;
  
  // Quality metrics
  defectsCreated: number;
  reworkRequired: number;
  firstPassYield: number | null;
  
  // Comparison
  peerAvgProductivity: number | null;
  rankInTeam: number | null;
  rankPercentile: number | null;
  
  // Station breakdown
  stationBreakdown: StationProductivityBreakdown[] | null;
  
  createdAt: Date;
}

/** Station productivity breakdown */
export interface StationProductivityBreakdown {
  stationId: string;
  stationName: string;
  hours: number;
  units: number;
}

/** Performance goal */
export interface PerformanceGoal {
  id: string;
  name: string;
  description: string | null;
  goalType: GoalType;
  scopeType: MetricScopeType;
  scopeId: string | null;
  metricName: string;
  metricUnit: string | null;
  targetValue: number;
  targetDirection: GoalDirection;
  periodType: GoalPeriod;
  startDate: Date;
  endDate: Date;
  currentValue: number | null;
  lastUpdatedAt: Date | null;
  progressPercent: number | null;
  status: GoalStatus;
  warningThreshold: number | null;
  criticalThreshold: number | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Dashboard KPI summary */
export interface KPIDashboardSummary {
  date: Date;
  
  // Order metrics
  ordersToday: number;
  ordersThisWeek: number;
  ordersThisMonth: number;
  orderBacklog: number;
  
  // Revenue metrics
  revenueToday: number;
  revenueThisWeek: number;
  revenueThisMonth: number;
  
  // Production metrics
  unitsToday: number;
  sqftToday: number;
  avgThroughputRate: number;
  
  // Efficiency metrics
  overallUtilization: number;
  overallEfficiency: number;
  firstPassYield: number;
  
  // Lead time metrics
  avgLeadTimeDays: number;
  onTimeDeliveryRate: number;
  
  // Bottleneck summary
  activeBottlenecks: number;
  criticalBottlenecks: number;
  
  // Trend indicators
  ordersTrend: 'up' | 'down' | 'flat';
  revenueTrend: 'up' | 'down' | 'flat';
  efficiencyTrend: 'up' | 'down' | 'flat';
}

// ============================================================================
// SSS-019: ADVANCED QUALITY ASSURANCE SYSTEM TYPES
// ============================================================================

import type {
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

/** Defect category for classification */
export interface DefectCategory {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  isActive: boolean;
  sortOrder: number;
  defaultSeverity: DefectSeverity | null;
  applicableStations: string[];
  standardReworkMinutes: number | null;
  createdAt: Date;
  updatedAt: Date;
  
  // Relations
  parent?: DefectCategory | null;
  children?: DefectCategory[];
  defects?: Defect[];
}

/** Defect record */
export interface Defect {
  id: string;
  workOrderId: string;
  inspectionId: string | null;
  categoryId: string;
  severity: DefectSeverity;
  source: DefectSource;
  description: string;
  location: string | null;
  quantity: number;
  disposition: DefectDisposition;
  dispositionById: string | null;
  dispositionAt: Date | null;
  dispositionNotes: string | null;
  laborCostImpact: number | null;
  materialCostImpact: number | null;
  discoveredById: string;
  discoveredAt: Date;
  station: string | null;
  rootCauseId: string | null;
  createdAt: Date;
  updatedAt: Date;
  
  // Relations
  workOrder?: WorkOrder;
  category?: DefectCategory;
  discoveredBy?: User;
  dispositionBy?: User | null;
  rootCause?: RootCauseAnalysisQC | null;
  evidence?: QCEvidence[];
}

/** QC evidence/attachment */
export interface QCEvidence {
  id: string;
  defectId: string | null;
  inspectionResultId: string | null;
  type: EvidenceType;
  fileUrl: string;
  fileName: string;
  fileSize: number | null;
  mimeType: string | null;
  caption: string | null;
  takenAt: Date | null;
  takenById: string | null;
  gpsLatitude: number | null;
  gpsLongitude: number | null;
  deviceInfo: string | null;
  createdAt: Date;
  updatedAt: Date;
  
  // Relations
  defect?: Defect | null;
  takenBy?: User | null;
}

/** Root cause analysis for QC */
export interface RootCauseAnalysisQC {
  id: string;
  title: string;
  description: string | null;
  category: RootCauseCategoryQC;
  
  // 5 Whys
  why1: string | null;
  why2: string | null;
  why3: string | null;
  why4: string | null;
  why5: string | null;
  
  // Fishbone contributors
  manContributor: string | null;
  machineContributor: string | null;
  materialContributor: string | null;
  methodContributor: string | null;
  measurementContributor: string | null;
  environmentContributor: string | null;
  
  rootCauseStatement: string | null;
  analyzedById: string | null;
  analyzedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  
  // Relations
  analyzedBy?: User | null;
  defects?: Defect[];
}

/** Supplier quality score */
export interface SupplierQualityScore {
  id: string;
  vendorId: string | null;
  supplierName: string;
  tier: SupplierQualityTier;
  qualityScore: number;
  deliveryScore: number;
  responseScore: number;
  totalLots: number;
  rejectedLots: number;
  defectCount: number;
  currentPPM: number | null;
  lastAuditDate: Date | null;
  lastAuditScore: number | null;
  nextAuditDue: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  
  // Relations
  qualityEvents?: SupplierQualityEvent[];
}

/** Supplier quality event */
export interface SupplierQualityEvent {
  id: string;
  scoreId: string;
  eventDate: Date;
  eventType: string;
  description: string | null;
  qualityImpact: number | null;
  deliveryImpact: number | null;
  responseImpact: number | null;
  defectId: string | null;
  purchaseOrderNumber: string | null;
  recordedById: string | null;
  createdAt: Date;
  
  // Relations
  score?: SupplierQualityScore;
}

/** Customer feedback record */
export interface CustomerFeedback {
  id: string;
  customerId: string | null;
  workOrderId: string | null;
  type: FeedbackType;
  subject: string;
  description: string | null;
  status: FeedbackStatus;
  sourceChannel: string | null;
  receivedAt: Date;
  receivedById: string | null;
  overallRating: number | null;
  qualityRating: number | null;
  serviceRating: number | null;
  resolvedAt: Date | null;
  resolvedById: string | null;
  resolution: string | null;
  creditIssued: number | null;
  refundIssued: number | null;
  linkedDefectId: string | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  
  // Relations
  customer?: Customer | null;
  workOrder?: WorkOrder | null;
  receivedBy?: User | null;
  resolvedBy?: User | null;
}

/** Quality trend data point */
export interface QualityTrend {
  id: string;
  trendType: QualityTrendType;
  periodStart: Date;
  periodEnd: Date;
  station: string | null;
  productType: string | null;
  customerId: string | null;
  metricValue: number;
  targetValue: number | null;
  previousValue: number | null;
  changePercent: number | null;
  isImproving: boolean | null;
  sampleSize: number;
  standardDeviation: number | null;
  upperControlLimit: number | null;
  lowerControlLimit: number | null;
  isOutOfControl: boolean;
  requiresAction: boolean;
  notes: string | null;
  calculatedAt: Date;
}

/** Quality objective */
export interface QualityObjective {
  id: string;
  name: string;
  description: string | null;
  metricType: QualityTrendType;
  targetValue: number;
  currentValue: number | null;
  startDate: Date;
  endDate: Date;
  station: string | null;
  progressPercent: number | null;
  status: GoalStatus;
  ownerId: string | null;
  lastReviewDate: Date | null;
  nextReviewDate: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Quality dashboard summary */
export interface QualityDashboardSummarySSS019 {
  // Overall metrics
  firstPassYield: number;
  defectRate: number;
  customerReturnRate: number;
  reworkRate: number;
  scrapRate: number;
  
  // Defect breakdown by severity
  defectsBySeverity: {
    cosmetic: number;
    minor: number;
    major: number;
    critical: number;
    safety: number;
  };
  
  // Defect breakdown by source
  defectsBySource: {
    incoming: number;
    inProcess: number;
    finalQc: number;
    customer: number;
    internalAudit: number;
  };
  
  // Top defect categories
  topDefectCategories: Array<{
    categoryId: string;
    categoryName: string;
    count: number;
    percentage: number;
  }>;
  
  // Feedback metrics
  totalFeedback: number;
  openComplaints: number;
  avgResolutionTimeHours: number;
  customerSatisfactionScore: number | null;
  
  // Supplier metrics
  suppliersOnWatch: number;
  suppliersBlocked: number;
  avgSupplierScore: number;
  
  // Trend direction
  qualityTrend: 'improving' | 'declining' | 'stable';
  defectTrend: 'up' | 'down' | 'flat';
}

// ============================================================================
// NEW-CRITICAL-01: PROJECT MANAGEMENT & JOB TEMPLATES TYPES
// ============================================================================

/** Project model for multi-order/phase management */
export interface Project {
  id: string;
  projectNumber: string;
  name: string;
  description: string | null;
  customerId: string | null;
  status: ProjectStatus;
  priority: ProjectPriority;
  
  // Budget tracking
  budgetStatus: BudgetStatus;
  estimatedBudget: number | null;
  actualCost: number | null;
  budgetVariance: number | null;
  profitMargin: number | null;
  
  // Timeline
  startDate: Date | null;
  targetEndDate: Date | null;
  actualEndDate: Date | null;
  estimatedHours: number | null;
  actualHours: number | null;
  
  // Relationships
  managerId: string | null;
  createdById: string;
  templateId: string | null;
  
  // Tracking
  tags: string[];
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Project-to-WorkOrder junction with ordering */
export interface ProjectWorkOrder {
  id: string;
  projectId: string;
  workOrderId: string;
  phaseNumber: number;
  phaseName: string | null;
  sortOrder: number;
  notes: string | null;
  addedAt: Date;
}

/** Project milestone for phase tracking */
export interface ProjectMilestone {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  status: MilestoneStatus;
  sortOrder: number;
  dueDate: Date | null;
  completedAt: Date | null;
  completedById: string | null;
  assigneeId: string | null;
  dependsOnId: string | null;
  deliverables: string | null;
  notifyOnComplete: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Budget line item for detailed cost tracking */
export interface BudgetLine {
  id: string;
  projectId: string;
  workOrderId: string | null;
  lineType: BudgetLineType;
  description: string;
  estimatedAmount: number;
  actualAmount: number | null;
  quantity: number;
  unitCost: number | null;
  unit: string | null;
  variance: number | null;
  notes: string | null;
  isApproved: boolean;
  approvedById: string | null;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Project-level note */
export interface ProjectNote {
  id: string;
  projectId: string;
  content: string;
  authorId: string;
  isInternal: boolean;
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Project file attachment */
export interface ProjectAttachment {
  id: string;
  projectId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  description: string | null;
  category: string | null;
  uploadedById: string;
  createdAt: Date;
}

/** Reusable job template for common job types */
export interface JobTemplate {
  id: string;
  name: string;
  description: string | null;
  category: JobTemplateCategory;
  defaultRouting: string[];
  estimatedHours: number | null;
  defaultPriority: ProjectPriority;
  
  // Template configuration
  defaultSpecifications: Record<string, unknown> | null;
  checklistItems: string[];
  requiredDocuments: string[];
  standardNotes: string | null;
  
  // Tracking
  usageCount: number;
  isActive: boolean;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Pre-defined line items for job templates */
export interface TemplateLineItem {
  id: string;
  templateId: string;
  lineType: BudgetLineType;
  description: string;
  defaultQuantity: number;
  defaultUnitCost: number | null;
  unit: string | null;
  isRequired: boolean;
  sortOrder: number;
}

// ============ Project Input Types ============

/** Input for creating a project */
export interface CreateProjectInput {
  name: string;
  description?: string | null;
  customerId?: string | null;
  priority?: ProjectPriority;
  estimatedBudget?: number | null;
  startDate?: Date | null;
  targetEndDate?: Date | null;
  estimatedHours?: number | null;
  managerId?: string | null;
  templateId?: string | null;
  tags?: string[];
}

/** Input for updating a project */
export interface UpdateProjectInput {
  name?: string;
  description?: string | null;
  customerId?: string | null;
  status?: ProjectStatus;
  priority?: ProjectPriority;
  budgetStatus?: BudgetStatus;
  estimatedBudget?: number | null;
  actualCost?: number | null;
  startDate?: Date | null;
  targetEndDate?: Date | null;
  actualEndDate?: Date | null;
  estimatedHours?: number | null;
  actualHours?: number | null;
  managerId?: string | null;
  tags?: string[];
  metadata?: Record<string, unknown> | null;
}

/** Input for adding work order to project */
export interface AddWorkOrderToProjectInput {
  workOrderId: string;
  phaseNumber?: number;
  phaseName?: string | null;
  sortOrder?: number;
  notes?: string | null;
}

/** Input for creating a milestone */
export interface CreateMilestoneInput {
  name: string;
  description?: string | null;
  dueDate?: Date | null;
  assigneeId?: string | null;
  dependsOnId?: string | null;
  deliverables?: string | null;
  notifyOnComplete?: boolean;
}

/** Input for updating a milestone */
export interface UpdateMilestoneInput {
  name?: string;
  description?: string | null;
  status?: MilestoneStatus;
  dueDate?: Date | null;
  assigneeId?: string | null;
  dependsOnId?: string | null;
  deliverables?: string | null;
  notifyOnComplete?: boolean;
  sortOrder?: number;
}

/** Input for creating a budget line */
export interface CreateBudgetLineInput {
  workOrderId?: string | null;
  lineType: BudgetLineType;
  description: string;
  estimatedAmount: number;
  quantity?: number;
  unitCost?: number | null;
  unit?: string | null;
  notes?: string | null;
}

/** Input for updating a budget line */
export interface UpdateBudgetLineInput {
  lineType?: BudgetLineType;
  description?: string;
  estimatedAmount?: number;
  actualAmount?: number | null;
  quantity?: number;
  unitCost?: number | null;
  unit?: string | null;
  notes?: string | null;
}

/** Input for creating a job template */
export interface CreateJobTemplateInput {
  name: string;
  description?: string | null;
  category: JobTemplateCategory;
  defaultRouting?: string[];
  estimatedHours?: number | null;
  defaultPriority?: ProjectPriority;
  defaultSpecifications?: Record<string, unknown> | null;
  checklistItems?: string[];
  requiredDocuments?: string[];
  standardNotes?: string | null;
}

/** Input for creating template line item */
export interface CreateTemplateLineItemInput {
  lineType: BudgetLineType;
  description: string;
  defaultQuantity?: number;
  defaultUnitCost?: number | null;
  unit?: string | null;
  isRequired?: boolean;
}

// ============ Project Summary Types ============

/** Project with computed summaries */
export interface ProjectWithSummary extends Project {
  customer?: { id: string; name: string } | null;
  manager?: { id: string; name: string } | null;
  workOrderCount: number;
  completedWorkOrderCount: number;
  milestoneCount: number;
  completedMilestoneCount: number;
  budgetUtilization: number | null;
  timeProgress: number | null;
}

/** Project budget summary */
export interface ProjectBudgetSummary {
  projectId: string;
  estimatedTotal: number;
  actualTotal: number;
  variance: number;
  variancePercent: number;
  byType: {
    [K in BudgetLineType]?: {
      estimated: number;
      actual: number;
      variance: number;
    };
  };
  isOverBudget: boolean;
  projectedFinalCost: number | null;
}

/** Project timeline summary */
export interface ProjectTimelineSummary {
  projectId: string;
  startDate: Date | null;
  targetEndDate: Date | null;
  projectedEndDate: Date | null;
  daysRemaining: number | null;
  daysOverdue: number | null;
  completionPercent: number;
  milestones: Array<{
    id: string;
    name: string;
    status: MilestoneStatus;
    dueDate: Date | null;
    isOverdue: boolean;
  }>;
}

/** Project dashboard overview */
export interface ProjectDashboardSummary {
  totalProjects: number;
  activeProjects: number;
  projectsByStatus: { [K in ProjectStatus]?: number };
  projectsByPriority: { [K in ProjectPriority]?: number };
  overBudgetProjects: number;
  overdueProjects: number;
  upcomingMilestones: Array<{
    projectId: string;
    projectName: string;
    milestoneId: string;
    milestoneName: string;
    dueDate: Date;
    daysUntilDue: number;
  }>;
  recentActivity: Array<{
    projectId: string;
    projectName: string;
    action: string;
    timestamp: Date;
  }>;
}

// ============================================================================
// NEW-CRITICAL-02: MATERIAL NESTING & WASTE OPTIMIZATION TYPES
// ============================================================================

/** Material sheet/panel for cutting */
export interface MaterialSheet {
  id: string;
  materialId: string | null;
  materialSku: string;
  materialName: string;
  
  // Dimensions (inches)
  width: number;
  height: number;
  thickness: number | null;
  
  // Area tracking
  totalAreaSqIn: number;
  usedAreaSqIn: number;
  remainingAreaSqIn: number;
  utilizationPct: number;
  
  // Status
  status: SheetStatus;
  
  // Source
  poNumber: string | null;
  lotNumber: string | null;
  receivedAt: Date | null;
  unitCost: number | null;
  
  // Location
  warehouseLocation: string | null;
  binNumber: string | null;
  
  // Quality
  gradeRating: string | null;
  hasDefects: boolean;
  defectNotes: string | null;
  
  // Remnant
  isRemnant: boolean;
  parentSheetId: string | null;
  
  createdAt: Date;
  updatedAt: Date;
}

/** Nesting job for optimizing material usage */
export interface NestingJob {
  id: string;
  jobNumber: string;
  name: string;
  description: string | null;
  
  status: NestingStatus;
  
  // Constraints
  materialSku: string | null;
  maxSheetWidth: number | null;
  maxSheetHeight: number | null;
  
  // Parameters
  itemSpacing: number;
  edgeMargin: number;
  allowRotation: boolean;
  prioritizeByDueDate: boolean;
  
  // Results
  totalItems: number;
  nestedItems: number;
  sheetsUsed: number;
  totalMaterialArea: number | null;
  totalUsedArea: number | null;
  overallUtilization: number | null;
  totalWasteArea: number | null;
  wasteCost: number | null;
  
  // Timing
  startedAt: Date | null;
  completedAt: Date | null;
  processingTimeMs: number | null;
  
  // Assignment
  createdById: string;
  approvedById: string | null;
  approvedAt: Date | null;
  
  createdAt: Date;
  updatedAt: Date;
}

/** Item to be nested */
export interface NestItem {
  id: string;
  nestingJobId: string;
  workOrderId: string | null;
  lineItemId: string | null;
  
  itemName: string;
  quantity: number;
  
  // Dimensions
  width: number;
  height: number;
  areaSqIn: number;
  
  // Constraints
  canRotate: boolean;
  grainDirection: string | null;
  
  // Priority
  priority: number;
  dueDate: Date | null;
  
  // Status
  nestedCount: number;
  cutCount: number;
  
  createdAt: Date;
}

/** Placement of item on sheet */
export interface NestPlacement {
  id: string;
  nestingJobId: string;
  sheetId: string;
  nestItemId: string;
  
  // Position
  positionX: number;
  positionY: number;
  
  // Orientation
  isRotated: boolean;
  rotationDegrees: number;
  
  // Cut status
  cutStatus: CutStatus;
  cutStartedAt: Date | null;
  cutCompletedAt: Date | null;
  
  // QC
  passedQC: boolean | null;
  qcNotes: string | null;
  
  createdAt: Date;
  updatedAt: Date;
}

/** Waste/scrap record */
export interface WasteRecord {
  id: string;
  nestingJobId: string | null;
  workOrderId: string | null;
  
  materialSku: string;
  materialName: string;
  
  // Dimensions
  width: number | null;
  height: number | null;
  areaSqIn: number;
  weight: number | null;
  
  category: WasteCategory;
  estimatedCost: number | null;
  
  // Disposition
  isRecyclable: boolean;
  wasRecycled: boolean;
  recycledAt: Date | null;
  recycleValue: number | null;
  
  reason: string | null;
  notes: string | null;
  
  recordedById: string;
  recordedAt: Date;
}

/** Material utilization snapshot */
export interface MaterialUtilizationSnapshot {
  id: string;
  periodStart: Date;
  periodEnd: Date;
  periodType: string;
  
  materialSku: string | null;
  materialName: string | null;
  
  // Usage
  totalMaterialUsed: number;
  totalWasteGenerated: number;
  utilizationRate: number;
  
  // Cost
  materialCost: number | null;
  wasteCost: number | null;
  recycleRevenue: number | null;
  netMaterialCost: number | null;
  
  // Counts
  sheetsUsed: number;
  nestingJobsCompleted: number;
  itemsNested: number;
  remnantsCreated: number;
  remnantsUsed: number;
  
  // Comparison
  utilizationChange: number | null;
  wasteChange: number | null;
  
  createdAt: Date;
}

/** Nesting algorithm configuration */
export interface NestingConfig {
  id: string;
  name: string;
  description: string | null;
  
  algorithmType: NestingAlgorithm;
  maxIterations: number;
  timeoutMs: number;
  
  defaultItemSpacing: number;
  defaultEdgeMargin: number;
  
  // Optimization weights
  utilizationWeight: number;
  cutPathWeight: number;
  setupTimeWeight: number;
  
  // Remnant handling
  minRemnantSize: number;
  preferRemnants: boolean;
  
  isDefault: boolean;
  isActive: boolean;
  
  createdAt: Date;
  updatedAt: Date;
}

// ============ Nesting Input Types ============

/** Input for creating a material sheet */
export interface CreateMaterialSheetInput {
  materialSku: string;
  materialName: string;
  width: number;
  height: number;
  thickness?: number | null;
  poNumber?: string | null;
  lotNumber?: string | null;
  unitCost?: number | null;
  warehouseLocation?: string | null;
  binNumber?: string | null;
  gradeRating?: string | null;
}

/** Input for creating a nesting job */
export interface CreateNestingJobInput {
  name: string;
  description?: string | null;
  materialSku?: string | null;
  maxSheetWidth?: number | null;
  maxSheetHeight?: number | null;
  itemSpacing?: number;
  edgeMargin?: number;
  allowRotation?: boolean;
  prioritizeByDueDate?: boolean;
}

/** Input for adding item to nest */
export interface CreateNestItemInput {
  workOrderId?: string | null;
  lineItemId?: string | null;
  itemName: string;
  quantity?: number;
  width: number;
  height: number;
  canRotate?: boolean;
  grainDirection?: string | null;
  priority?: number;
  dueDate?: Date | null;
}

/** Input for recording waste */
export interface CreateWasteRecordInput {
  nestingJobId?: string | null;
  workOrderId?: string | null;
  materialSku: string;
  materialName: string;
  width?: number | null;
  height?: number | null;
  areaSqIn: number;
  weight?: number | null;
  category: WasteCategory;
  estimatedCost?: number | null;
  isRecyclable?: boolean;
  reason?: string | null;
  notes?: string | null;
}

// ============ Nesting Summary Types ============

/** Nesting job with computed metrics */
export interface NestingJobWithMetrics extends NestingJob {
  items: NestItem[];
  sheets: Array<{
    id: string;
    materialName: string;
    width: number;
    height: number;
    utilization: number;
    placementCount: number;
  }>;
  savingsVsSequential: number | null;
}

/** Material waste summary */
export interface WasteSummary {
  periodStart: Date;
  periodEnd: Date;
  totalWasteArea: number;
  totalWasteCost: number;
  byCategory: { [K in WasteCategory]?: { area: number; cost: number; count: number } };
  byMaterial: Array<{
    materialSku: string;
    materialName: string;
    wasteArea: number;
    wasteCost: number;
    wastePercent: number;
  }>;
  recyclingRate: number;
  recycleRevenue: number;
}

/** Nesting dashboard overview */
export interface NestingDashboardSummary {
  // Active jobs
  activeNestingJobs: number;
  pendingItems: number;
  
  // Utilization
  avgUtilization: number;
  utilizationTrend: 'up' | 'down' | 'stable';
  
  // Waste
  wasteThisMonth: number;
  wasteCostThisMonth: number;
  wasteVsLastMonth: number;
  
  // Inventory
  availableSheets: number;
  usableRemnants: number;
  lowStockMaterials: string[];
  
  // Recent activity
  recentJobs: Array<{
    id: string;
    jobNumber: string;
    name: string;
    status: NestingStatus;
    utilization: number | null;
    completedAt: Date | null;
  }>;
}

// ============================================================================
// NEW-CRITICAL-03: ADVANCED NOTIFICATION & COMMUNICATION HUB TYPES
// ============================================================================

/** Notification template */
export interface NotificationTemplate {
  id: string;
  code: string;
  name: string;
  description: string | null;
  subjectTemplate: string | null;
  bodyTemplate: string;
  htmlTemplate: string | null;
  channels: NotificationChannel[];
  defaultPriority: NotificationPriorityLevel;
  category: string | null;
  variables: string[];
  isActive: boolean;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** User notification preferences */
export interface NotificationPreference {
  id: string;
  userId: string;
  templateCode: string | null;
  category: string | null;
  enabledChannels: NotificationChannel[];
  disabledChannels: NotificationChannel[];
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  inAppEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  timezone: string | null;
  digestEnabled: boolean;
  digestFrequency: string | null;
  digestTime: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Notification queue item */
export interface NotificationQueueItem {
  id: string;
  userId: string | null;
  recipientEmail: string | null;
  recipientPhone: string | null;
  recipientName: string | null;
  templateCode: string | null;
  subject: string | null;
  body: string;
  htmlBody: string | null;
  channel: NotificationChannel;
  priority: NotificationPriorityLevel;
  status: NotificationDeliveryStatus;
  entityType: string | null;
  entityId: string | null;
  scheduledFor: Date | null;
  sentAt: Date | null;
  deliveredAt: Date | null;
  readAt: Date | null;
  attempts: number;
  lastError: string | null;
  nextRetryAt: Date | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Message thread */
export interface MessageThread {
  id: string;
  subject: string;
  entityType: string | null;
  entityId: string | null;
  status: ThreadStatus;
  createdById: string;
  lastMessageAt: Date | null;
  messageCount: number;
  isPinned: boolean;
  isUrgent: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Thread participant */
export interface ThreadParticipant {
  id: string;
  threadId: string;
  userId: string;
  lastReadAt: Date | null;
  unreadCount: number;
  notifyOnReply: boolean;
  isMuted: boolean;
  canReply: boolean;
  isAdmin: boolean;
  joinedAt: Date;
  leftAt: Date | null;
}

/** Message */
export interface MessageItem {
  id: string;
  threadId: string;
  authorId: string;
  content: string;
  contentType: string;
  replyToId: string | null;
  isEdited: boolean;
  editedAt: Date | null;
  isDeleted: boolean;
  deletedAt: Date | null;
  reactions: Record<string, string[]> | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Message attachment */
export interface MessageAttachment {
  id: string;
  messageId: string;
  fileName: string;
  fileUrl: string;
  fileSize: number | null;
  mimeType: string | null;
  uploadedAt: Date;
}

/** Announcement */
export interface Announcement {
  id: string;
  title: string;
  content: string;
  contentType: string;
  scope: AnnouncementScope;
  targetRoles: string[];
  targetUserIds: string[];
  startsAt: Date;
  expiresAt: Date | null;
  priority: NotificationPriorityLevel;
  isPinned: boolean;
  requiresAck: boolean;
  bannerColor: string | null;
  icon: string | null;
  createdById: string;
  viewCount: number;
  ackCount: number;
  isActive: boolean;
  isDraft: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Announcement acknowledgment */
export interface AnnouncementAck {
  id: string;
  announcementId: string;
  userId: string;
  acknowledgedAt: Date;
}

/** Communication log entry */
export interface CommunicationLogEntry {
  id: string;
  entityType: string;
  entityId: string;
  channel: CommunicationChannel;
  direction: CommunicationDirection;
  subject: string | null;
  summary: string;
  details: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  userId: string;
  occurredAt: Date;
  duration: number | null;
  requiresFollowUp: boolean;
  followUpDate: Date | null;
  followUpNotes: string | null;
  followUpCompleted: boolean;
  followUpCompletedAt: Date | null;
  attachments: Array<{ name: string; url: string }> | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============ Notification Input Types ============

/** Input for creating notification template */
export interface CreateNotificationTemplateInput {
  code: string;
  name: string;
  description?: string | null;
  subjectTemplate?: string | null;
  bodyTemplate: string;
  htmlTemplate?: string | null;
  channels: NotificationChannel[];
  defaultPriority?: NotificationPriorityLevel;
  category?: string | null;
  variables?: string[];
}

/** Input for updating notification preferences */
export interface UpdateNotificationPreferenceInput {
  enabledChannels?: NotificationChannel[];
  disabledChannels?: NotificationChannel[];
  emailEnabled?: boolean;
  smsEnabled?: boolean;
  pushEnabled?: boolean;
  inAppEnabled?: boolean;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  timezone?: string | null;
  digestEnabled?: boolean;
  digestFrequency?: string | null;
  digestTime?: string | null;
}

/** Input for sending notification */
export interface SendNotificationInput {
  userId?: string | null;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
  recipientName?: string | null;
  templateCode?: string | null;
  subject?: string | null;
  body: string;
  htmlBody?: string | null;
  channel: NotificationChannel;
  priority?: NotificationPriorityLevel;
  entityType?: string | null;
  entityId?: string | null;
  scheduledFor?: Date | null;
  metadata?: Record<string, unknown> | null;
}

/** Input for creating message thread */
export interface CreateMessageThreadInput {
  subject: string;
  entityType?: string | null;
  entityId?: string | null;
  participantIds: string[];
  initialMessage?: string;
  isUrgent?: boolean;
}

/** Input for sending message */
export interface SendMessageInput {
  content: string;
  contentType?: string;
  replyToId?: string | null;
}

/** Input for creating announcement */
export interface CreateAnnouncementInput {
  title: string;
  content: string;
  contentType?: string;
  scope?: AnnouncementScope;
  targetRoles?: string[];
  targetUserIds?: string[];
  startsAt?: Date;
  expiresAt?: Date | null;
  priority?: NotificationPriorityLevel;
  isPinned?: boolean;
  requiresAck?: boolean;
  bannerColor?: string | null;
  icon?: string | null;
}

/** Input for logging communication */
export interface CreateCommunicationLogInput {
  entityType: string;
  entityId: string;
  channel: CommunicationChannel;
  direction: CommunicationDirection;
  subject?: string | null;
  summary: string;
  details?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  occurredAt?: Date;
  duration?: number | null;
  requiresFollowUp?: boolean;
  followUpDate?: Date | null;
  followUpNotes?: string | null;
}

// ============ Notification Summary Types ============

/** Thread with preview info */
export interface ThreadWithPreview extends MessageThread {
  lastMessage?: { content: string; authorName: string; createdAt: Date } | null;
  participantCount: number;
  myUnreadCount: number;
}

/** Notification stats for user */
export interface UserNotificationStats {
  unreadCount: number;
  unreadByChannel: { [K in NotificationChannel]?: number };
  pendingCount: number;
  recentNotifications: NotificationQueueItem[];
}

/** Communication summary for entity */
export interface EntityCommunicationSummary {
  totalCommunications: number;
  lastContact: Date | null;
  pendingFollowUps: number;
  byChannel: { [K in CommunicationChannel]?: number };
  recentLogs: CommunicationLogEntry[];
}

// ============================================================================
// NEW-CRITICAL-04: EQUIPMENT CALIBRATION & CERTIFICATION TYPES
// ============================================================================

import {
  CalibrationType,
  CalibrationResult,
  CertificationType,
  CertificationStatus,
} from './enums.js';

/** Calibration record */
export interface Calibration {
  id: string;
  equipmentId: string;
  
  // Calibration details
  calibrationType: CalibrationType;
  calibrationDate: Date;
  dueDate: Date;
  
  // Performer
  performedBy?: string | null;
  performedByUserId?: string | null;
  
  // External calibration
  externalCompany?: string | null;
  externalTechName?: string | null;
  certificateNumber?: string | null;
  
  // Results
  result: CalibrationResult;
  tolerancesMet: boolean;
  adjustmentsMade: boolean;
  adjustmentNotes?: string | null;
  
  // Measurements
  measurements?: Record<string, any> | null;
  
  // Reference standards
  standardsUsed?: string | null;
  traceability?: string | null;
  
  // Environmental conditions
  temperature?: number | null;
  humidity?: number | null;
  
  // Documentation
  certificateUrl?: string | null;
  reportUrl?: string | null;
  
  // Cost
  cost?: number | null;
  
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Equipment certification */
export interface EquipmentCertification {
  id: string;
  equipmentId: string;
  
  // Certification details
  certificationType: CertificationType;
  certificationName: string;
  issuingAuthority: string;
  
  // Validity
  issueDate: Date;
  expirationDate?: Date | null;
  
  // Status
  status: CertificationStatus;
  
  // Documentation
  certificateNumber?: string | null;
  certificateUrl?: string | null;
  
  // Compliance
  complianceStandard?: string | null;
  requirements?: string | null;
  
  // Renewal tracking
  renewalReminder?: number | null;
  renewalCost?: number | null;
  lastRenewalDate?: Date | null;
  
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Equipment part/consumable */
export interface EquipmentPart {
  id: string;
  equipmentId: string;
  
  // Part details
  partNumber: string;
  name: string;
  description?: string | null;
  
  // Classification
  category?: string | null;
  isConsumable: boolean;
  isCritical: boolean;
  
  // Inventory
  quantityOnHand: number;
  minimumQuantity: number;
  reorderPoint: number;
  
  // Pricing
  unitCost?: number | null;
  vendor?: string | null;
  vendorPartNumber?: string | null;
  
  // Lifespan
  expectedLifeHours?: number | null;
  replacementInterval?: number | null;
  
  // Last replaced
  lastReplacedAt?: Date | null;
  
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Equipment usage meter */
export interface EquipmentMeter {
  id: string;
  equipmentId: string;
  
  // Meter details
  name: string;
  unit: string;
  
  // Current reading
  currentReading: number;
  lastReadingDate: Date;
  
  // Maintenance triggers
  maintenanceThreshold?: number | null;
  calibrationThreshold?: number | null;
  
  // History
  readingHistory?: Array<{ date: Date; reading: number }> | null;
  
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============ Calibration Input Types ============

/** Create calibration input */
export interface CreateCalibrationInput {
  equipmentId: string;
  calibrationType: CalibrationType;
  calibrationDate: Date;
  dueDate: Date;
  result: CalibrationResult;
  performedBy?: string;
  performedByUserId?: string;
  externalCompany?: string;
  externalTechName?: string;
  certificateNumber?: string;
  tolerancesMet?: boolean;
  adjustmentsMade?: boolean;
  adjustmentNotes?: string;
  measurements?: Record<string, any>;
  standardsUsed?: string;
  traceability?: string;
  temperature?: number;
  humidity?: number;
  certificateUrl?: string;
  reportUrl?: string;
  cost?: number;
  notes?: string;
}

/** Update calibration input */
export interface UpdateCalibrationInput {
  result?: CalibrationResult;
  tolerancesMet?: boolean;
  adjustmentsMade?: boolean;
  adjustmentNotes?: string;
  measurements?: Record<string, any>;
  certificateUrl?: string;
  reportUrl?: string;
  cost?: number;
  notes?: string;
}

/** Create certification input */
export interface CreateCertificationInput {
  equipmentId: string;
  certificationType: CertificationType;
  certificationName: string;
  issuingAuthority: string;
  issueDate: Date;
  expirationDate?: Date;
  certificateNumber?: string;
  certificateUrl?: string;
  complianceStandard?: string;
  requirements?: string;
  renewalReminder?: number;
  renewalCost?: number;
  notes?: string;
}

/** Update certification input */
export interface UpdateCertificationInput {
  status?: CertificationStatus;
  expirationDate?: Date;
  certificateNumber?: string;
  certificateUrl?: string;
  renewalReminder?: number;
  renewalCost?: number;
  lastRenewalDate?: Date;
  notes?: string;
}

/** Create equipment part input */
export interface CreateEquipmentPartInput {
  equipmentId: string;
  partNumber: string;
  name: string;
  description?: string;
  category?: string;
  isConsumable?: boolean;
  isCritical?: boolean;
  quantityOnHand?: number;
  minimumQuantity?: number;
  reorderPoint?: number;
  unitCost?: number;
  vendor?: string;
  vendorPartNumber?: string;
  expectedLifeHours?: number;
  replacementInterval?: number;
  notes?: string;
}

/** Update equipment part input */
export interface UpdateEquipmentPartInput {
  name?: string;
  description?: string;
  category?: string;
  isConsumable?: boolean;
  isCritical?: boolean;
  quantityOnHand?: number;
  minimumQuantity?: number;
  reorderPoint?: number;
  unitCost?: number;
  vendor?: string;
  vendorPartNumber?: string;
  expectedLifeHours?: number;
  replacementInterval?: number;
  lastReplacedAt?: Date;
  notes?: string;
}

/** Create meter input */
export interface CreateEquipmentMeterInput {
  equipmentId: string;
  name: string;
  unit: string;
  currentReading: number;
  maintenanceThreshold?: number;
  calibrationThreshold?: number;
  notes?: string;
}

/** Update meter reading input */
export interface UpdateMeterReadingInput {
  currentReading: number;
  notes?: string;
}

// ============ Calibration Summary Types ============

/** Calibration due summary */
export interface CalibrationDueSummary {
  equipmentId: string;
  equipmentName: string;
  lastCalibration: Date | null;
  nextDue: Date;
  daysUntilDue: number;
  isOverdue: boolean;
  calibrationType: CalibrationType;
}

/** Certification expiry summary */
export interface CertificationExpirySummary {
  equipmentId: string;
  equipmentName: string;
  certificationName: string;
  certificationType: CertificationType;
  expirationDate: Date;
  daysUntilExpiry: number;
  status: CertificationStatus;
}

/** Equipment compliance status */
export interface EquipmentComplianceStatus {
  equipmentId: string;
  equipmentName: string;
  calibrationStatus: 'current' | 'due_soon' | 'overdue' | 'not_required';
  certificationsValid: number;
  certificationsExpiring: number;
  certificationsExpired: number;
  partsBelowReorder: number;
  overallStatus: 'compliant' | 'attention_needed' | 'non_compliant';
}

// ============================================================================
// NEW-CRITICAL-05: ADVANCED USER TRAINING & COMPETENCY TYPES
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

/** Training program */
export interface TrainingProgram {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  
  category: TrainingCategory;
  level: TrainingLevel;
  
  objectives?: string | null;
  curriculum?: Array<{ module: string; topics: string[] }> | null;
  duration?: number | null;
  
  prerequisites?: string | null;
  equipmentRequired?: string | null;
  stationsApplicable?: string[];
  
  deliveryMethod: TrainingDeliveryMethod;
  materials?: Array<{ name: string; url: string; type: string }> | null;
  
  certificationRequired: boolean;
  certificationValidDays?: number | null;
  recertificationRequired: boolean;
  
  isActive: boolean;
  version?: string | null;
  
  createdById?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Training session */
export interface TrainingSession {
  id: string;
  programId: string;
  
  title: string;
  description?: string | null;
  
  scheduledDate: Date;
  scheduledEndDate?: Date | null;
  location?: string | null;
  
  status: TrainingSessionStatus;
  
  instructorId?: string | null;
  externalInstructor?: string | null;
  
  maxParticipants?: number | null;
  
  completedAt?: Date | null;
  notes?: string | null;
  
  createdAt: Date;
  updatedAt: Date;
}

/** Training enrollment */
export interface TrainingEnrollment {
  id: string;
  sessionId: string;
  userId: string;
  
  status: EnrollmentStatus;
  enrolledAt: Date;
  
  attended: boolean;
  attendedAt?: Date | null;
  
  completedAt?: Date | null;
  
  passed?: boolean | null;
  score?: number | null;
  assessmentNotes?: string | null;
  
  certificateIssued: boolean;
  certificateNumber?: string | null;
  certificateUrl?: string | null;
  
  feedback?: string | null;
  rating?: number | null;
  
  createdAt: Date;
  updatedAt: Date;
}

/** User competency */
export interface UserCompetency {
  id: string;
  userId: string;
  
  competencyType: CompetencyType;
  
  programId?: string | null;
  equipmentType?: string | null;
  station?: string | null;
  
  name: string;
  description?: string | null;
  
  level: string; // SkillLevel
  
  acquiredDate: Date;
  expirationDate?: Date | null;
  
  isCertified: boolean;
  certificationNumber?: string | null;
  certificationUrl?: string | null;
  issuingAuthority?: string | null;
  
  status: CompetencyStatus;
  
  verifiedById?: string | null;
  verifiedAt?: Date | null;
  
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Training requirement */
export interface TrainingRequirement {
  id: string;
  
  targetType: TrainingTargetType;
  targetValue: string;
  
  requirementName: string;
  description?: string | null;
  
  requiredCompetencies?: Array<{ type: CompetencyType; name: string; level: string }> | null;
  requiredPrograms?: string[] | null;
  
  completionDeadlineDays?: number | null;
  renewalIntervalDays?: number | null;
  
  priority: TrainingPriorityLevel;
  
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============ Training Input Types ============

/** Create training program input */
export interface CreateTrainingProgramInput {
  code: string;
  name: string;
  description?: string;
  category: TrainingCategory;
  level?: TrainingLevel;
  objectives?: string;
  curriculum?: Array<{ module: string; topics: string[] }>;
  duration?: number;
  prerequisites?: string;
  equipmentRequired?: string;
  stationsApplicable?: string[];
  deliveryMethod?: TrainingDeliveryMethod;
  materials?: Array<{ name: string; url: string; type: string }>;
  certificationRequired?: boolean;
  certificationValidDays?: number;
  recertificationRequired?: boolean;
  version?: string;
}

/** Update training program input */
export interface UpdateTrainingProgramInput {
  name?: string;
  description?: string;
  category?: TrainingCategory;
  level?: TrainingLevel;
  objectives?: string;
  curriculum?: Array<{ module: string; topics: string[] }>;
  duration?: number;
  prerequisites?: string;
  equipmentRequired?: string;
  stationsApplicable?: string[];
  deliveryMethod?: TrainingDeliveryMethod;
  materials?: Array<{ name: string; url: string; type: string }>;
  certificationRequired?: boolean;
  certificationValidDays?: number;
  recertificationRequired?: boolean;
  isActive?: boolean;
  version?: string;
}

/** Create training session input */
export interface CreateTrainingSessionInput {
  programId: string;
  title: string;
  description?: string;
  scheduledDate: Date;
  scheduledEndDate?: Date;
  location?: string;
  instructorId?: string;
  externalInstructor?: string;
  maxParticipants?: number;
}

/** Enroll user input */
export interface EnrollUserInput {
  sessionId: string;
  userId: string;
}

/** Record attendance input */
export interface RecordAttendanceInput {
  enrollmentId: string;
  attended: boolean;
  score?: number;
  passed?: boolean;
  assessmentNotes?: string;
}

/** Create competency input */
export interface CreateUserCompetencyInput {
  userId: string;
  competencyType: CompetencyType;
  name: string;
  description?: string;
  level: string;
  acquiredDate: Date;
  expirationDate?: Date;
  programId?: string;
  equipmentType?: string;
  station?: string;
  isCertified?: boolean;
  certificationNumber?: string;
  certificationUrl?: string;
  issuingAuthority?: string;
  notes?: string;
}

/** Create training requirement input */
export interface CreateTrainingRequirementInput {
  targetType: TrainingTargetType;
  targetValue: string;
  requirementName: string;
  description?: string;
  requiredCompetencies?: Array<{ type: CompetencyType; name: string; level: string }>;
  requiredPrograms?: string[];
  completionDeadlineDays?: number;
  renewalIntervalDays?: number;
  priority?: TrainingPriorityLevel;
}

// ============ Training Summary Types ============

/** User training status */
export interface UserTrainingStatus {
  userId: string;
  userName: string;
  completedPrograms: number;
  pendingEnrollments: number;
  expiringCompetencies: number;
  expiredCompetencies: number;
  compliancePercentage: number;
  missingRequirements: string[];
}

/** Training program summary */
export interface TrainingProgramSummary extends TrainingProgram {
  totalSessions: number;
  upcomingSessions: number;
  totalEnrollments: number;
  completionRate: number;
  averageScore: number | null;
}

/** Session with enrollments */
export interface SessionWithEnrollments extends TrainingSession {
  program: { name: string; code: string };
  enrollments: Array<{
    id: string;
    userId: string;
    userName: string;
    status: EnrollmentStatus;
    attended: boolean;
    score?: number | null;
  }>;
  enrolledCount: number;
  attendedCount: number;
}

// ============================================================================
// NEW-CRITICAL-06: VENDOR RELATIONSHIP MANAGEMENT TYPES
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

/** Vendor contract */
export interface VendorContract {
  id: string;
  contractNumber: string;
  vendorId: string;
  name: string;
  description?: string | null;
  contractType: VendorContractType;
  status: ContractStatus;
  startDate: Date;
  endDate: Date;
  signedDate?: Date | null;
  terminationDate?: Date | null;
  autoRenew: boolean;
  renewalPeriodDays?: number | null;
  renewalNoticeDays?: number | null;
  paymentTerms?: string | null;
  minimumOrderValue?: number | null;
  annualCommitment?: number | null;
  discountPercent?: number | null;
  exclusivityTerms?: string | null;
  termsAndConditions?: string | null;
  liabilityLimit?: number | null;
  insuranceRequired: boolean;
  insuranceMinimum?: number | null;
  documentUrls?: string[] | null;
  createdById: string;
  approvedById?: string | null;
  approvedAt?: Date | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Create vendor contract input */
export interface CreateVendorContractInput {
  contractNumber: string;
  vendorId: string;
  name: string;
  description?: string;
  contractType: VendorContractType;
  startDate: Date;
  endDate: Date;
  autoRenew?: boolean;
  renewalPeriodDays?: number;
  renewalNoticeDays?: number;
  paymentTerms?: string;
  minimumOrderValue?: number;
  annualCommitment?: number;
  discountPercent?: number;
  exclusivityTerms?: string;
  termsAndConditions?: string;
  liabilityLimit?: number;
  insuranceRequired?: boolean;
  insuranceMinimum?: number;
  documentUrls?: string[];
  notes?: string;
}

/** Update vendor contract input */
export interface UpdateVendorContractInput {
  name?: string;
  description?: string;
  contractType?: VendorContractType;
  status?: ContractStatus;
  startDate?: Date;
  endDate?: Date;
  signedDate?: Date;
  terminationDate?: Date;
  autoRenew?: boolean;
  renewalPeriodDays?: number | null;
  renewalNoticeDays?: number | null;
  paymentTerms?: string;
  minimumOrderValue?: number | null;
  annualCommitment?: number | null;
  discountPercent?: number | null;
  exclusivityTerms?: string | null;
  termsAndConditions?: string;
  liabilityLimit?: number | null;
  insuranceRequired?: boolean;
  insuranceMinimum?: number | null;
  documentUrls?: string[];
  notes?: string;
}

/** Vendor pricing */
export interface VendorPricing {
  id: string;
  vendorId: string;
  contractId?: string | null;
  itemMasterId?: string | null;
  categoryName?: string | null;
  pricingType: VendorPricingType;
  basePrice: number;
  currency: string;
  unitOfMeasure: string;
  volumeTiers?: Array<{
    minQty: number;
    maxQty?: number;
    price: number;
    discount?: number;
  }> | null;
  contractDiscount?: number | null;
  volumeDiscount?: number | null;
  effectiveDate: Date;
  expirationDate?: Date | null;
  leadTimeDays?: number | null;
  minimumOrderQty?: number | null;
  isActive: boolean;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Create vendor pricing input */
export interface CreateVendorPricingInput {
  vendorId: string;
  contractId?: string;
  itemMasterId?: string;
  categoryName?: string;
  pricingType: VendorPricingType;
  basePrice: number;
  currency?: string;
  unitOfMeasure: string;
  volumeTiers?: Array<{
    minQty: number;
    maxQty?: number;
    price: number;
    discount?: number;
  }>;
  contractDiscount?: number;
  effectiveDate: Date;
  expirationDate?: Date;
  leadTimeDays?: number;
  minimumOrderQty?: number;
  notes?: string;
}

/** Vendor certification */
export interface VendorCertification {
  id: string;
  vendorId: string;
  certificationType: VendorCertificationType;
  certificationName: string;
  issuingBody?: string | null;
  certificateNumber?: string | null;
  issueDate: Date;
  expirationDate?: Date | null;
  status: CertificationStatus;
  verifiedById?: string | null;
  verifiedAt?: Date | null;
  documentUrl?: string | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Create vendor certification input */
export interface CreateVendorCertificationInput {
  vendorId: string;
  certificationType: VendorCertificationType;
  certificationName: string;
  issuingBody?: string;
  certificateNumber?: string;
  issueDate: Date;
  expirationDate?: Date;
  documentUrl?: string;
  notes?: string;
}

/** Vendor rating */
export interface VendorRating {
  id: string;
  vendorId: string;
  purchaseOrderId?: string | null;
  ratedById: string;
  ratingDate: Date;
  qualityScore: number;
  deliveryScore: number;
  priceScore: number;
  communicationScore: number;
  overallScore: number;
  title?: string | null;
  review?: string | null;
  pros?: string | null;
  cons?: string | null;
  wouldRecommend: boolean;
  isPublic: boolean;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Create vendor rating input */
export interface CreateVendorRatingInput {
  vendorId: string;
  purchaseOrderId?: string;
  qualityScore: number;
  deliveryScore: number;
  priceScore: number;
  communicationScore: number;
  overallScore: number;
  title?: string;
  review?: string;
  pros?: string;
  cons?: string;
  wouldRecommend?: boolean;
  isPublic?: boolean;
}

/** Vendor communication log */
export interface VendorCommunication {
  id: string;
  vendorId: string;
  vendorContactId?: string | null;
  channel: CommunicationChannel;
  direction: CommunicationDirection;
  subject?: string | null;
  content: string;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  userId: string;
  communicationDate: Date;
  followUpDate?: Date | null;
  followUpComplete: boolean;
  attachmentUrls?: string[] | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Create vendor communication input */
export interface CreateVendorCommunicationInput {
  vendorId: string;
  vendorContactId?: string;
  channel: CommunicationChannel;
  direction: CommunicationDirection;
  subject?: string;
  content: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  communicationDate?: Date;
  followUpDate?: Date;
  attachmentUrls?: string[];
  notes?: string;
}

/** Vendor quote request */
export interface VendorQuoteRequest {
  id: string;
  requestNumber: string;
  title: string;
  description?: string | null;
  requestType: QuoteRequestType;
  status: QuoteRequestStatus;
  lineItems: Array<{
    description: string;
    quantity: number;
    specs?: string;
    unitOfMeasure?: string;
  }>;
  requestDate?: Date | null;
  responseDeadline?: Date | null;
  requiredByDate?: Date | null;
  requestedById: string;
  selectedVendorId?: string | null;
  selectedResponseId?: string | null;
  selectionReason?: string | null;
  awardedAt?: Date | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Create quote request input */
export interface CreateQuoteRequestInput {
  title: string;
  description?: string;
  requestType: QuoteRequestType;
  lineItems: Array<{
    description: string;
    quantity: number;
    specs?: string;
    unitOfMeasure?: string;
  }>;
  vendorIds: string[]; // Vendors to request quotes from
  responseDeadline?: Date;
  requiredByDate?: Date;
  notes?: string;
}

/** Vendor quote response */
export interface VendorQuoteResponse {
  id: string;
  quoteRequestId: string;
  vendorId: string;
  status: QuoteResponseStatus;
  sentAt?: Date | null;
  respondedAt?: Date | null;
  quoteNumber?: string | null;
  totalAmount?: number | null;
  currency: string;
  validUntil?: Date | null;
  leadTimeDays?: number | null;
  lineItems?: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }> | null;
  paymentTerms?: string | null;
  shippingTerms?: string | null;
  warranty?: string | null;
  attachmentUrls?: string[] | null;
  evaluationScore?: number | null;
  evaluationNotes?: string | null;
  isSelected: boolean;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Record quote response input */
export interface RecordQuoteResponseInput {
  responseId: string;
  quoteNumber?: string;
  totalAmount: number;
  currency?: string;
  validUntil?: Date;
  leadTimeDays?: number;
  lineItems?: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  paymentTerms?: string;
  shippingTerms?: string;
  warranty?: string;
  attachmentUrls?: string[];
  notes?: string;
}

/** Vendor relationship summary */
export interface VendorRelationshipSummary {
  vendor: {
    id: string;
    vendorNumber: string;
    name: string;
  };
  activeContracts: number;
  expiringContracts: number;
  totalSpendYTD: number;
  averageRating: number | null;
  ratingCount: number;
  certifications: number;
  expiredCertifications: number;
  openQuoteRequests: number;
  performanceTier?: string;
}

/** Contract expiry alert */
export interface ContractExpiryAlert {
  contractId: string;
  contractNumber: string;
  vendorName: string;
  endDate: Date;
  daysUntilExpiry: number;
  autoRenew: boolean;
  annualValue?: number | null;
}

// ============================================================================
// NEW-CRITICAL-07: ADVANCED SHIPPING & LOGISTICS TYPES
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

/** Carrier account */
export interface CarrierAccount {
  id: string;
  carrier: string; // Uses existing Carrier enum
  accountName: string;
  accountNumber: string;
  apiKey?: string | null;
  apiSecret?: string | null;
  accessToken?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  defaultService?: string | null;
  isDefault: boolean;
  isActive: boolean;
  discountPercent?: number | null;
  fuelSurchargeRate?: number | null;
  residentialSurcharge?: number | null;
  pickupScheduled: boolean;
  pickupAddress?: object | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Create carrier account input */
export interface CreateCarrierAccountInput {
  carrier: string;
  accountName: string;
  accountNumber: string;
  apiKey?: string;
  apiSecret?: string;
  accessToken?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  defaultService?: string;
  isDefault?: boolean;
  discountPercent?: number;
  fuelSurchargeRate?: number;
  residentialSurcharge?: number;
  pickupScheduled?: boolean;
  pickupAddress?: object;
  notes?: string;
}

/** Shipping rate */
export interface ShippingRate {
  id: string;
  carrierAccountId: string;
  zoneId?: string | null;
  serviceCode: string;
  serviceName: string;
  deliveryDays?: number | null;
  rateType: ShippingRateType;
  weightBreaks?: Array<{
    minWeight: number;
    maxWeight?: number;
    rate: number;
  }> | null;
  perPoundRate?: number | null;
  flatRate?: number | null;
  dimFactor?: number | null;
  fuelSurcharge: boolean;
  residentialSurcharge?: number | null;
  deliveryAreaSurcharge?: number | null;
  effectiveDate: Date;
  expirationDate?: Date | null;
  isActive: boolean;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Create shipping rate input */
export interface CreateShippingRateInput {
  carrierAccountId: string;
  zoneId?: string;
  serviceCode: string;
  serviceName: string;
  deliveryDays?: number;
  rateType: ShippingRateType;
  weightBreaks?: Array<{
    minWeight: number;
    maxWeight?: number;
    rate: number;
  }>;
  perPoundRate?: number;
  flatRate?: number;
  dimFactor?: number;
  fuelSurcharge?: boolean;
  residentialSurcharge?: number;
  deliveryAreaSurcharge?: number;
  effectiveDate: Date;
  expirationDate?: Date;
  notes?: string;
}

/** Shipping zone */
export interface ShippingZone {
  id: string;
  zoneName: string;
  zoneCode: string;
  description?: string | null;
  zipPrefixes?: string[] | null;
  zipRanges?: Array<{ start: string; end: string }> | null;
  statesCovered?: string[] | null;
  countryCodes?: string[] | null;
  isResidential: boolean;
  isRemote: boolean;
  isInternational: boolean;
  additionalHandling: boolean;
  holidayDelivery: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Create shipping zone input */
export interface CreateShippingZoneInput {
  zoneName: string;
  zoneCode: string;
  description?: string;
  zipPrefixes?: string[];
  zipRanges?: Array<{ start: string; end: string }>;
  statesCovered?: string[];
  countryCodes?: string[];
  isResidential?: boolean;
  isRemote?: boolean;
  isInternational?: boolean;
  additionalHandling?: boolean;
  holidayDelivery?: boolean;
}

/** Freight quote */
export interface FreightQuote {
  id: string;
  quoteNumber: string;
  workOrderId?: string | null;
  freightType: FreightType;
  status: FreightQuoteStatus;
  originName: string;
  originAddress: string;
  originCity: string;
  originState: string;
  originZip: string;
  originCountry: string;
  originContact?: string | null;
  originPhone?: string | null;
  destName: string;
  destAddress: string;
  destCity: string;
  destState: string;
  destZip: string;
  destCountry: string;
  destContact?: string | null;
  destPhone?: string | null;
  destIsResidential: boolean;
  destHasLiftgate: boolean;
  destInsideDelivery: boolean;
  freightClass?: string | null;
  pieces: number;
  weight: number;
  pallets?: number | null;
  dimensions?: Array<{ length: number; width: number; height: number }> | null;
  stackable: boolean;
  hazmat: boolean;
  pickupDate?: Date | null;
  deliveryDate?: Date | null;
  guaranteedDelivery: boolean;
  quotes?: Array<{
    carrier: string;
    rate: number;
    transitDays: number;
    service: string;
  }> | null;
  selectedQuoteIdx?: number | null;
  freightCost?: number | null;
  fuelSurcharge?: number | null;
  accessorialCharges?: number | null;
  totalCost?: number | null;
  bookedAt?: Date | null;
  bookingReference?: string | null;
  bolNumber?: string | null;
  proNumber?: string | null;
  requestedById: string;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Create freight quote input */
export interface CreateFreightQuoteInput {
  workOrderId?: string;
  freightType: FreightType;
  originName: string;
  originAddress: string;
  originCity: string;
  originState: string;
  originZip: string;
  originCountry?: string;
  originContact?: string;
  originPhone?: string;
  destName: string;
  destAddress: string;
  destCity: string;
  destState: string;
  destZip: string;
  destCountry?: string;
  destContact?: string;
  destPhone?: string;
  destIsResidential?: boolean;
  destHasLiftgate?: boolean;
  destInsideDelivery?: boolean;
  freightClass?: string;
  pieces?: number;
  weight: number;
  pallets?: number;
  dimensions?: Array<{ length: number; width: number; height: number }>;
  stackable?: boolean;
  hazmat?: boolean;
  pickupDate?: Date;
  deliveryDate?: Date;
  guaranteedDelivery?: boolean;
  notes?: string;
}

/** Delivery route */
export interface DeliveryRoute {
  id: string;
  routeDate: Date;
  routeName?: string | null;
  driverId?: string | null;
  vehicleInfo?: string | null;
  status: DeliveryRouteStatus;
  startTime?: Date | null;
  endTime?: Date | null;
  totalMiles?: number | null;
  totalTime?: number | null;
  optimized: boolean;
  optimizedAt?: Date | null;
  routePolyline?: string | null;
  notes?: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Create delivery route input */
export interface CreateDeliveryRouteInput {
  routeDate: Date;
  routeName?: string;
  driverId?: string;
  vehicleInfo?: string;
  notes?: string;
}

/** Delivery stop */
export interface DeliveryStop {
  id: string;
  routeId: string;
  stopOrder: number;
  shipmentId?: string | null;
  workOrderId?: string | null;
  customerId?: string | null;
  stopType: DeliveryStopType;
  companyName: string;
  contactName?: string | null;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone?: string | null;
  deliveryInstructions?: string | null;
  requiresSignature: boolean;
  requiresPhoto: boolean;
  scheduledArrival?: Date | null;
  actualArrival?: Date | null;
  actualDeparture?: Date | null;
  status: DeliveryStopStatus;
  signedBy?: string | null;
  signatureUrl?: string | null;
  photoUrls?: string[] | null;
  deliveryNotes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Add delivery stop input */
export interface AddDeliveryStopInput {
  routeId: string;
  stopOrder: number;
  shipmentId?: string;
  workOrderId?: string;
  customerId?: string;
  stopType: DeliveryStopType;
  companyName: string;
  contactName?: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone?: string;
  deliveryInstructions?: string;
  requiresSignature?: boolean;
  requiresPhoto?: boolean;
  scheduledArrival?: Date;
}

/** Complete delivery stop input */
export interface CompleteDeliveryStopInput {
  stopId: string;
  status: DeliveryStopStatus;
  signedBy?: string;
  signatureUrl?: string;
  photoUrls?: string[];
  deliveryNotes?: string;
}

/** Tracking event */
export interface TrackingEvent {
  id: string;
  shipmentId: string;
  carrierAccountId?: string | null;
  eventType: TrackingEventType;
  eventDate: Date;
  eventTime?: Date | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
  description: string;
  signedBy?: string | null;
  exceptionCode?: string | null;
  exceptionReason?: string | null;
  sourceSystem?: string | null;
  rawData?: object | null;
  createdAt: Date;
}

/** Create tracking event input */
export interface CreateTrackingEventInput {
  shipmentId: string;
  carrierAccountId?: string;
  eventType: TrackingEventType;
  eventDate: Date;
  eventTime?: Date;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  description: string;
  signedBy?: string;
  exceptionCode?: string;
  exceptionReason?: string;
  sourceSystem?: string;
  rawData?: object;
}

/** Route with stops summary */
export interface RouteWithStops extends DeliveryRoute {
  stops: DeliveryStop[];
  totalStops: number;
  completedStops: number;
  driverName?: string;
}

/** Shipment tracking summary */
export interface ShipmentTrackingSummary {
  shipmentId: string;
  trackingNumber?: string;
  carrier: string;
  status: string;
  lastEvent?: TrackingEvent;
  estimatedDelivery?: Date;
  actualDelivery?: Date;
  events: TrackingEvent[];
}

// ============================================================================
// NEW-CRITICAL-08: Version Control & Revision Management
// ============================================================================

import type {
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

/** Entity revision record - tracks all changes to entities */
export interface EntityRevision {
  id: string;
  entityType: RevisionEntityType;
  entityId: string;
  revisionNumber: number;
  majorVersion: number;
  minorVersion: number;
  versionLabel?: string | null;
  revisionType: RevisionType;
  changeReason?: ChangeReason | null;
  status: RevisionStatus;
  
  // Change details
  previousData?: object | null;
  currentData?: object | null;
  changedFields?: string[] | null;
  changeSummary?: string | null;
  
  // Attribution
  createdById?: string | null;
  createdAt: Date;
  approvedById?: string | null;
  approvedAt?: Date | null;
  rejectedById?: string | null;
  rejectedAt?: Date | null;
  rejectionReason?: string | null;
  
  // Workflow
  approvalWorkflow: ApprovalWorkflow;
  requiresCustomerApproval: boolean;
  customerApprovedAt?: Date | null;
  customerApprovalNotes?: string | null;
  
  // Relationships
  parentRevisionId?: string | null;
  changeOrderId?: string | null;
  
  // Metadata
  tags?: string[] | null;
  notes?: string | null;
  isActive: boolean;
  isCurrent: boolean;
}

/** Create entity revision input */
export interface CreateEntityRevisionInput {
  entityType: RevisionEntityType;
  entityId: string;
  revisionNumber?: number;
  majorVersion?: number;
  minorVersion?: number;
  versionLabel?: string;
  revisionType: RevisionType;
  changeReason?: ChangeReason;
  status?: RevisionStatus;
  previousData?: object;
  currentData?: object;
  changedFields?: string[];
  changeSummary?: string;
  createdById?: string;
  approvalWorkflow?: ApprovalWorkflow;
  requiresCustomerApproval?: boolean;
  parentRevisionId?: string;
  changeOrderId?: string;
  tags?: string[];
  notes?: string;
}

/** Update entity revision input */
export interface UpdateEntityRevisionInput {
  status?: RevisionStatus;
  versionLabel?: string;
  changeSummary?: string;
  approvedById?: string;
  approvedAt?: Date;
  rejectedById?: string;
  rejectedAt?: Date;
  rejectionReason?: string;
  customerApprovedAt?: Date;
  customerApprovalNotes?: string;
  tags?: string[];
  notes?: string;
  isActive?: boolean;
  isCurrent?: boolean;
}

/** Design version - tracks design file versions */
export interface DesignVersion {
  id: string;
  designFileId: string;
  versionNumber: number;
  majorVersion: number;
  minorVersion: number;
  patchVersion: number;
  versionLabel?: string | null;
  status: DesignVersionStatus;
  
  // File information
  filePath: string;
  fileUrl?: string | null;
  thumbnailUrl?: string | null;
  fileSize?: number | null;
  fileHash?: string | null;
  fileFormat?: string | null;
  
  // Design metadata
  dimensions?: object | null;
  colorProfile?: string | null;
  resolution?: number | null;
  layerCount?: number | null;
  linkedAssets?: string[] | null;
  
  // Attribution
  createdById?: string | null;
  createdAt: Date;
  approvedById?: string | null;
  approvedAt?: Date | null;
  
  // Review tracking
  reviewedById?: string | null;
  reviewedAt?: Date | null;
  reviewNotes?: string | null;
  
  // Change tracking
  changeDescription?: string | null;
  changeReason?: ChangeReason | null;
  previousVersionId?: string | null;
  
  // Customer approval
  customerApprovedAt?: Date | null;
  customerSignatureUrl?: string | null;
  customerNotes?: string | null;
  
  // Metadata
  tags?: string[] | null;
  isLatest: boolean;
  isReleased: boolean;
}

/** Create design version input */
export interface CreateDesignVersionInput {
  designFileId: string;
  versionNumber?: number;
  majorVersion?: number;
  minorVersion?: number;
  patchVersion?: number;
  versionLabel?: string;
  status?: DesignVersionStatus;
  filePath: string;
  fileUrl?: string;
  thumbnailUrl?: string;
  fileSize?: number;
  fileHash?: string;
  fileFormat?: string;
  dimensions?: object;
  colorProfile?: string;
  resolution?: number;
  layerCount?: number;
  linkedAssets?: string[];
  createdById?: string;
  changeDescription?: string;
  changeReason?: ChangeReason;
  previousVersionId?: string;
  tags?: string[];
}

/** Update design version input */
export interface UpdateDesignVersionInput {
  status?: DesignVersionStatus;
  versionLabel?: string;
  thumbnailUrl?: string;
  approvedById?: string;
  approvedAt?: Date;
  reviewedById?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
  customerApprovedAt?: Date;
  customerSignatureUrl?: string;
  customerNotes?: string;
  tags?: string[];
  isLatest?: boolean;
  isReleased?: boolean;
}

/** Change order - formal scope change tracking */
export interface ChangeOrder {
  id: string;
  changeOrderNumber: string;
  workOrderId?: string | null;
  quoteId?: string | null;
  type: ChangeOrderType;
  priority: ChangeOrderPriority;
  status: ChangeOrderStatus;
  
  // Description
  title: string;
  description?: string | null;
  justification?: string | null;
  
  // Impact analysis
  scopeImpact?: string | null;
  scheduleImpact?: string | null;
  scheduleDelayDays?: number | null;
  costImpact?: number | null;
  costChangePercent?: number | null;
  qualityImpact?: string | null;
  riskAssessment?: string | null;
  
  // Request source
  requestSource: ChangeRequestSource;
  requestedById?: string | null;
  customerRequestDate?: Date | null;
  customerContact?: string | null;
  
  // Approval chain
  internalApprovalStatus: ChangeApprovalStatus;
  internalApprovedById?: string | null;
  internalApprovedAt?: Date | null;
  internalNotes?: string | null;
  
  customerApprovalStatus: ChangeApprovalStatus;
  customerApprovedAt?: Date | null;
  customerSignature?: string | null;
  customerNotes?: string | null;
  
  // Implementation
  implementedById?: string | null;
  implementedAt?: Date | null;
  implementationNotes?: string | null;
  
  // Audit
  createdById?: string | null;
  createdAt: Date;
  updatedAt: Date;
  
  // Related data
  affectedItems?: object | null;
  attachments?: string[] | null;
}

/** Create change order input */
export interface CreateChangeOrderInput {
  changeOrderNumber?: string;
  workOrderId?: string;
  quoteId?: string;
  type: ChangeOrderType;
  priority?: ChangeOrderPriority;
  status?: ChangeOrderStatus;
  title: string;
  description?: string;
  justification?: string;
  scopeImpact?: string;
  scheduleImpact?: string;
  scheduleDelayDays?: number;
  costImpact?: number;
  costChangePercent?: number;
  qualityImpact?: string;
  riskAssessment?: string;
  requestSource: ChangeRequestSource;
  requestedById?: string;
  customerRequestDate?: Date;
  customerContact?: string;
  createdById?: string;
  affectedItems?: object;
  attachments?: string[];
}

/** Update change order input */
export interface UpdateChangeOrderInput {
  type?: ChangeOrderType;
  priority?: ChangeOrderPriority;
  status?: ChangeOrderStatus;
  title?: string;
  description?: string;
  justification?: string;
  scopeImpact?: string;
  scheduleImpact?: string;
  scheduleDelayDays?: number;
  costImpact?: number;
  costChangePercent?: number;
  qualityImpact?: string;
  riskAssessment?: string;
  internalApprovalStatus?: ChangeApprovalStatus;
  internalApprovedById?: string;
  internalApprovedAt?: Date;
  internalNotes?: string;
  customerApprovalStatus?: ChangeApprovalStatus;
  customerApprovedAt?: Date;
  customerSignature?: string;
  customerNotes?: string;
  implementedById?: string;
  implementedAt?: Date;
  implementationNotes?: string;
  affectedItems?: object;
  attachments?: string[];
}

/** Version comparison record */
export interface VersionComparison {
  id: string;
  entityType: RevisionEntityType;
  entityId: string;
  sourceRevisionId: string;
  targetRevisionId: string;
  
  // Comparison results
  fieldChanges?: object | null;
  addedFields?: string[] | null;
  removedFields?: string[] | null;
  modifiedFields?: string[] | null;
  
  // Visual diff
  visualDiffUrl?: string | null;
  sideBySideUrl?: string | null;
  overlayDiffUrl?: string | null;
  
  // Summary
  changeSummary?: string | null;
  changeCount: number;
  significanceScore?: number | null;
  
  // Metadata
  comparedById?: string | null;
  comparedAt: Date;
  notes?: string | null;
}

/** Create version comparison input */
export interface CreateVersionComparisonInput {
  entityType: RevisionEntityType;
  entityId: string;
  sourceRevisionId: string;
  targetRevisionId: string;
  fieldChanges?: object;
  addedFields?: string[];
  removedFields?: string[];
  modifiedFields?: string[];
  visualDiffUrl?: string;
  sideBySideUrl?: string;
  overlayDiffUrl?: string;
  changeSummary?: string;
  changeCount?: number;
  significanceScore?: number;
  comparedById?: string;
  notes?: string;
}

/** Entity revision with relations */
export interface EntityRevisionWithRelations extends EntityRevision {
  createdBy?: { id: string; name: string; email: string };
  approvedBy?: { id: string; name: string; email: string };
  rejectedBy?: { id: string; name: string; email: string };
  parentRevision?: EntityRevision;
  childRevisions?: EntityRevision[];
  changeOrder?: ChangeOrder;
}

/** Design version with relations */
export interface DesignVersionWithRelations extends DesignVersion {
  createdBy?: { id: string; name: string; email: string };
  approvedBy?: { id: string; name: string; email: string };
  reviewedBy?: { id: string; name: string; email: string };
  previousVersion?: DesignVersion;
}

/** Change order with relations */
export interface ChangeOrderWithRelations extends ChangeOrder {
  workOrder?: { id: string; orderNumber: string };
  quote?: { id: string; quoteNumber: string };
  requestedBy?: { id: string; name: string; email: string };
  internalApprovedBy?: { id: string; name: string; email: string };
  implementedBy?: { id: string; name: string; email: string };
  createdBy?: { id: string; name: string; email: string };
  entityRevisions?: EntityRevision[];
}

/** Version history summary */
export interface VersionHistorySummary {
  entityType: RevisionEntityType;
  entityId: string;
  currentVersion: string;
  totalRevisions: number;
  latestRevision?: EntityRevision;
  pendingChanges: number;
  hasActiveChangeOrders: boolean;
}

// ============================================================================
// NEW-CRITICAL-09: Environmental & Sustainability Tracking
// ============================================================================

import type {
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

/** Material environmental profile */
export interface MaterialEnvironmentalProfile {
  id: string;
  itemMasterId: string;
  
  // Material composition
  materialCategory: MaterialCategory;
  primaryMaterial?: string | null;
  materialWeight?: number | null;
  weightUnit?: string | null;
  
  // Recyclability
  recyclabilityRating?: RecyclabilityRating | null;
  recycledContentPercent?: number | null;
  recyclablePercent?: number | null;
  recyclingInstructions?: string | null;
  
  // Certifications
  certifications?: object | null;
  hasFscCertification: boolean;
  hasGreenguardCert: boolean;
  
  // Environmental impact
  carbonFootprint?: number | null;
  embodiedEnergy?: number | null;
  waterUsage?: number | null;
  
  // VOC and chemical info
  vocContent?: number | null;
  isVocFree: boolean;
  containsHazardous: boolean;
  hazardousMaterials?: string | null;
  sdsDocumentUrl?: string | null;
  
  // End of life
  biodegradable: boolean;
  compostable: boolean;
  expectedLifespan?: number | null;
  disposalMethod?: WasteDisposalMethod | null;
  disposalInstructions?: string | null;
  
  // Supplier sustainability
  supplierSustainabilityScore?: number | null;
  locallySourced: boolean;
  distanceFromSource?: number | null;
  
  // Metadata
  dataSource?: string | null;
  verifiedAt?: Date | null;
  verifiedById?: string | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Create material environmental profile input */
export interface CreateMaterialEnvironmentalProfileInput {
  itemMasterId: string;
  materialCategory: MaterialCategory;
  primaryMaterial?: string;
  materialWeight?: number;
  weightUnit?: string;
  recyclabilityRating?: RecyclabilityRating;
  recycledContentPercent?: number;
  recyclablePercent?: number;
  recyclingInstructions?: string;
  certifications?: object;
  hasFscCertification?: boolean;
  hasGreenguardCert?: boolean;
  carbonFootprint?: number;
  embodiedEnergy?: number;
  waterUsage?: number;
  vocContent?: number;
  isVocFree?: boolean;
  containsHazardous?: boolean;
  hazardousMaterials?: string;
  sdsDocumentUrl?: string;
  biodegradable?: boolean;
  compostable?: boolean;
  expectedLifespan?: number;
  disposalMethod?: WasteDisposalMethod;
  disposalInstructions?: string;
  supplierSustainabilityScore?: number;
  locallySourced?: boolean;
  distanceFromSource?: number;
  dataSource?: string;
  notes?: string;
}

/** Waste log entry */
export interface WasteLogEntry {
  id: string;
  workOrderId?: string | null;
  stationId?: string | null;
  
  // Waste details
  category: ProductionWasteCategory;
  materialType?: string | null;
  itemMasterId?: string | null;
  
  // Quantity
  quantity: number;
  unit: string;
  estimatedWeight?: number | null;
  
  // Disposal
  disposalMethod: WasteDisposalMethod;
  disposalVendorId?: string | null;
  disposalCost?: number | null;
  disposalDate?: Date | null;
  disposalDocumentUrl?: string | null;
  manifestNumber?: string | null;
  
  // Environmental impact
  carbonOffset?: number | null;
  recyclableValue?: number | null;
  
  // Audit
  loggedById: string;
  loggedAt: Date;
  verifiedById?: string | null;
  verifiedAt?: Date | null;
  
  notes?: string | null;
}

/** Create waste log entry input */
export interface CreateWasteLogEntryInput {
  workOrderId?: string;
  stationId?: string;
  category: ProductionWasteCategory;
  materialType?: string;
  itemMasterId?: string;
  quantity: number;
  unit: string;
  estimatedWeight?: number;
  disposalMethod: WasteDisposalMethod;
  disposalVendorId?: string;
  disposalCost?: number;
  disposalDate?: Date;
  disposalDocumentUrl?: string;
  manifestNumber?: string;
  carbonOffset?: number;
  recyclableValue?: number;
  loggedById?: string;
  notes?: string;
}

/** Energy consumption record */
export interface EnergyConsumptionRecord {
  id: string;
  periodStart: Date;
  periodEnd: Date;
  energySource: EnergySource;
  equipmentId?: string | null;
  areaName?: string | null;
  quantity: number;
  unit: string;
  kwhEquivalent?: number | null;
  cost?: number | null;
  ratePerUnit?: number | null;
  carbonEmissions?: number | null;
  emissionScope?: EmissionScope | null;
  renewablePercent?: number | null;
  previousPeriodQty?: number | null;
  baselineQty?: number | null;
  variancePercent?: number | null;
  meterNumber?: string | null;
  meterReadingStart?: number | null;
  meterReadingEnd?: number | null;
  isEstimated: boolean;
  recordedById?: string | null;
  createdAt: Date;
  verifiedAt?: Date | null;
  notes?: string | null;
}

/** Create energy consumption record input */
export interface CreateEnergyConsumptionRecordInput {
  periodStart: Date;
  periodEnd: Date;
  energySource: EnergySource;
  equipmentId?: string;
  areaName?: string;
  quantity: number;
  unit: string;
  kwhEquivalent?: number;
  cost?: number;
  ratePerUnit?: number;
  carbonEmissions?: number;
  emissionScope?: EmissionScope;
  renewablePercent?: number;
  previousPeriodQty?: number;
  baselineQty?: number;
  meterNumber?: string;
  meterReadingStart?: number;
  meterReadingEnd?: number;
  isEstimated?: boolean;
  recordedById?: string;
  notes?: string;
}

/** Carbon emission record */
export interface CarbonEmissionRecord {
  id: string;
  periodStart: Date;
  periodEnd: Date;
  emissionScope: EmissionScope;
  sourceCategory: string;
  sourceDescription?: string | null;
  emissionsKgCo2e: number;
  emissionsMtCo2e?: number | null;
  activityType?: string | null;
  activityQuantity?: number | null;
  activityUnit?: string | null;
  emissionFactor?: number | null;
  emissionFactorSource?: string | null;
  workOrderId?: string | null;
  energyRecordId?: string | null;
  shipmentId?: string | null;
  vendorId?: string | null;
  offsetsApplied?: number | null;
  offsetCertificateUrl?: string | null;
  netEmissions?: number | null;
  calculatedById?: string | null;
  calculatedAt: Date;
  verifiedById?: string | null;
  verifiedAt?: Date | null;
  methodology?: string | null;
  notes?: string | null;
}

/** Create carbon emission record input */
export interface CreateCarbonEmissionRecordInput {
  periodStart: Date;
  periodEnd: Date;
  emissionScope: EmissionScope;
  sourceCategory: string;
  sourceDescription?: string;
  emissionsKgCo2e: number;
  emissionsMtCo2e?: number;
  activityType?: string;
  activityQuantity?: number;
  activityUnit?: string;
  emissionFactor?: number;
  emissionFactorSource?: string;
  workOrderId?: string;
  energyRecordId?: string;
  shipmentId?: string;
  vendorId?: string;
  offsetsApplied?: number;
  offsetCertificateUrl?: string;
  calculatedById?: string;
  methodology?: string;
  notes?: string;
}

/** Sustainability goal */
export interface SustainabilityGoal {
  id: string;
  goalType: SustainabilityGoalType;
  title: string;
  description?: string | null;
  timeframe: GoalTimeframe;
  startDate: Date;
  targetDate: Date;
  baselineValue: number;
  baselineDate: Date;
  targetValue: number;
  targetUnit: string;
  isReduction: boolean;
  currentValue?: number | null;
  lastMeasuredAt?: Date | null;
  progressPercent?: number | null;
  onTrack?: boolean | null;
  appliesToArea?: string | null;
  appliesToCategory?: string | null;
  isActive: boolean;
  achievedAt?: Date | null;
  ownerId?: string | null;
  createdById?: string | null;
  createdAt: Date;
  updatedAt: Date;
  notes?: string | null;
}

/** Create sustainability goal input */
export interface CreateSustainabilityGoalInput {
  goalType: SustainabilityGoalType;
  title: string;
  description?: string;
  timeframe: GoalTimeframe;
  startDate: Date;
  targetDate: Date;
  baselineValue: number;
  baselineDate: Date;
  targetValue: number;
  targetUnit: string;
  isReduction?: boolean;
  appliesToArea?: string;
  appliesToCategory?: string;
  ownerId?: string;
  createdById?: string;
  notes?: string;
}

/** Update sustainability goal input */
export interface UpdateSustainabilityGoalInput {
  title?: string;
  description?: string;
  targetDate?: Date;
  targetValue?: number;
  currentValue?: number;
  lastMeasuredAt?: Date;
  progressPercent?: number;
  onTrack?: boolean;
  isActive?: boolean;
  achievedAt?: Date;
  notes?: string;
}

/** Sustainability snapshot */
export interface SustainabilitySnapshot {
  id: string;
  goalId: string;
  snapshotDate: Date;
  periodStart: Date;
  periodEnd: Date;
  measuredValue: number;
  unit: string;
  changeFromPrevious?: number | null;
  changePercent?: number | null;
  context?: string | null;
  affectingFactors?: string | null;
  recordedById?: string | null;
  recordedAt: Date;
}

/** Work order sustainability summary */
export interface WorkOrderSustainability {
  id: string;
  workOrderId: string;
  totalMaterialWeight?: number | null;
  recycledContentWeight?: number | null;
  recycledContentPercent?: number | null;
  totalWasteWeight?: number | null;
  recycledWasteWeight?: number | null;
  recyclingRate?: number | null;
  landfillWeight?: number | null;
  estimatedEnergyUsage?: number | null;
  renewableEnergyPercent?: number | null;
  totalCarbonEmissions?: number | null;
  carbonScope1?: number | null;
  carbonScope2?: number | null;
  carbonScope3?: number | null;
  carbonPerUnit?: number | null;
  carbonOffset?: number | null;
  netCarbon?: number | null;
  sustainabilityScore?: number | null;
  materialScore?: number | null;
  wasteScore?: number | null;
  energyScore?: number | null;
  certificationsApplicable?: object | null;
  calculatedAt: Date;
  calculatedById?: string | null;
  notes?: string | null;
}

/** Sustainability dashboard data */
export interface SustainabilityDashboard {
  totalWasteThisPeriod: number;
  recyclingRatePercent: number;
  totalEnergyUsage: number;
  renewableEnergyPercent: number;
  totalCarbonEmissions: number;
  carbonOffsets: number;
  netCarbonEmissions: number;
  activeGoals: SustainabilityGoal[];
  recentWasteLogs: WasteLogEntry[];
  emissionsByScope: { scope1: number; scope2: number; scope3: number };
}

// ============================================================================
// NEW-CRITICAL-10: Advanced Pricing & Quote Intelligence
// ============================================================================

import type {
  PricingStrategy,
  QuoteConfidenceLevel,
  PriceAdjustmentType,
  PricingRuleCondition,
  QuoteScoreCategory,
  CompetitorPriceSource,
  QuoteOutcome,
  CustomerPriceSegment,
  CustomerLoyaltyTier,
} from './enums.js';

/** Pricing rule */
export interface PricingRule {
  id: string;
  name: string;
  description?: string | null;
  priority: number;
  isActive: boolean;
  conditions: object;
  conditionLogic?: string | null;
  adjustmentType: PriceAdjustmentType;
  adjustmentValue: number;
  minAdjustment?: number | null;
  maxAdjustment?: number | null;
  appliesToProducts: string[];
  appliesToCustomers: string[];
  excludeProducts: string[];
  excludeCustomers: string[];
  startDate?: Date | null;
  endDate?: Date | null;
  usageLimit?: number | null;
  usageCount: number;
  stackable: boolean;
  stackOrder?: number | null;
  createdById?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Create pricing rule input */
export interface CreatePricingRuleInput {
  name: string;
  description?: string;
  priority?: number;
  isActive?: boolean;
  conditions: object;
  conditionLogic?: string;
  adjustmentType: PriceAdjustmentType;
  adjustmentValue: number;
  minAdjustment?: number;
  maxAdjustment?: number;
  appliesToProducts?: string[];
  appliesToCustomers?: string[];
  excludeProducts?: string[];
  excludeCustomers?: string[];
  startDate?: Date;
  endDate?: Date;
  usageLimit?: number;
  stackable?: boolean;
  stackOrder?: number;
  createdById?: string;
}

/** Pricing rule application record */
export interface PricingRuleApplication {
  id: string;
  ruleId: string;
  quoteId?: string | null;
  quoteLineItemId?: string | null;
  workOrderId?: string | null;
  originalPrice: number;
  adjustedPrice: number;
  adjustmentAmount: number;
  appliedAt: Date;
  appliedById?: string | null;
}

/** Quote scorecard */
export interface QuoteScorecard {
  id: string;
  quoteId: string;
  winProbability?: number | null;
  confidenceLevel?: QuoteConfidenceLevel | null;
  estimatedMargin?: number | null;
  estimatedProfit?: number | null;
  profitabilityScore?: number | null;
  strategicScore?: number | null;
  strategicFactors?: object | null;
  riskScore?: number | null;
  riskFactors?: object | null;
  complexityScore?: number | null;
  complexityFactors?: object | null;
  similarQuotesCount?: number | null;
  avgSimilarQuoteValue?: number | null;
  avgSimilarWinRate?: number | null;
  predictedOutcome?: string | null;
  predictionConfidence?: number | null;
  predictionModel?: string | null;
  recommendations?: object | null;
  calculatedAt: Date;
  calculatedById?: string | null;
}

/** Quote comparison */
export interface QuoteComparison {
  id: string;
  quoteId: string;
  comparedQuoteId: string;
  overallSimilarity: number;
  productSimilarity?: number | null;
  sizeSimilarity?: number | null;
  customerSimilarity?: number | null;
  sourceOutcome?: string | null;
  comparedOutcome?: string | null;
  sourcePriceTotal?: number | null;
  comparedPriceTotal?: number | null;
  priceVariance?: number | null;
  keyDifferences?: object | null;
  learnings?: string | null;
  createdAt: Date;
}

/** Competitor price */
export interface CompetitorPrice {
  id: string;
  competitorName: string;
  competitorId?: string | null;
  productCategory: string;
  productDescription?: string | null;
  price: number;
  priceUnit?: string | null;
  currency: string;
  source: CompetitorPriceSource;
  sourceUrl?: string | null;
  sourceDocument?: string | null;
  observedAt: Date;
  validFrom?: Date | null;
  validUntil?: Date | null;
  confidenceLevel?: number | null;
  isVerified: boolean;
  notes?: string | null;
  recordedById?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Create competitor price input */
export interface CreateCompetitorPriceInput {
  competitorName: string;
  competitorId?: string;
  productCategory: string;
  productDescription?: string;
  price: number;
  priceUnit?: string;
  currency?: string;
  source: CompetitorPriceSource;
  sourceUrl?: string;
  sourceDocument?: string;
  observedAt: Date;
  validFrom?: Date;
  validUntil?: Date;
  confidenceLevel?: number;
  isVerified?: boolean;
  notes?: string;
  recordedById?: string;
}

/** Price history record */
export interface PriceHistory {
  id: string;
  entityType: string;
  entityId: string;
  price: number;
  costBasis?: number | null;
  margin?: number | null;
  strategy?: PricingStrategy | null;
  customerId?: string | null;
  quoteId?: string | null;
  workOrderId?: string | null;
  accepted?: boolean | null;
  wonOrder?: boolean | null;
  finalPrice?: number | null;
  adjustments?: object | null;
  recordedAt: Date;
}

/** Customer price profile */
export interface CustomerPriceProfile {
  id: string;
  customerId: string;
  priceElasticity?: number | null;
  sensitivityScore?: number | null;
  preferredPricing?: PricingStrategy | null;
  avgAcceptedDiscount?: number | null;
  avgRejectedPrice?: number | null;
  priceThreshold?: number | null;
  lifetimeValue?: number | null;
  avgOrderValue?: number | null;
  orderFrequency?: number | null;
  paymentTermsPreferred?: string | null;
  avgDaysToPayment?: number | null;
  negotiatesOften: boolean;
  typicalCounterOffer?: number | null;
  priceSegment?: CustomerPriceSegment | null;
  loyaltyTier?: CustomerLoyaltyTier | null;
  updatedAt: Date;
}

/** Quote analysis record */
export interface QuoteAnalysis {
  id: string;
  quoteId: string;
  outcome: QuoteOutcome;
  outcomeReason?: string | null;
  outcomeDetails?: string | null;
  lostToCompetitor?: string | null;
  competitorPrice?: number | null;
  priceWasReason?: boolean | null;
  priceCompetitiveness?: number | null;
  responseTime?: number | null;
  proposalQuality?: number | null;
  relationshipStrength?: number | null;
  lessonsLearned?: string | null;
  improvementAreas?: object | null;
  followUpRequired: boolean;
  followUpNotes?: string | null;
  followUpDate?: Date | null;
  analyzedById?: string | null;
  analyzedAt: Date;
}

/** Create quote analysis input */
export interface CreateQuoteAnalysisInput {
  quoteId: string;
  outcome: QuoteOutcome;
  outcomeReason?: string;
  outcomeDetails?: string;
  lostToCompetitor?: string;
  competitorPrice?: number;
  priceWasReason?: boolean;
  priceCompetitiveness?: number;
  responseTime?: number;
  proposalQuality?: number;
  relationshipStrength?: number;
  lessonsLearned?: string;
  improvementAreas?: object;
  followUpRequired?: boolean;
  followUpNotes?: string;
  followUpDate?: Date;
  analyzedById?: string;
}

/** Quote intelligence dashboard */
export interface QuoteIntelligenceDashboard {
  totalQuotesAnalyzed: number;
  winRate: number;
  avgMargin: number;
  topWinFactors: string[];
  topLossReasons: string[];
  avgResponseTime: number;
  recentQuotes: QuoteScorecard[];
  competitorInsights: { competitor: string; avgPrice: number; winRateAgainst: number }[];
}

/** Pricing recommendation */
export interface PricingRecommendation {
  recommendedPrice: number;
  priceRange: { min: number; max: number };
  confidence: number;
  strategy: PricingStrategy;
  factors: string[];
  comparisons: { type: string; value: number; difference: number }[];
}

// ============================================================================
// AUDIT PHASE 2.1 - MISSING PRISMA MODEL TYPES
// ============================================================================

/** Company entity - business customer organization */
export interface Company {
  id: string;
  name: string;
  legalName: string | null;
  dba: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  country: string;
  phone: string | null;
  fax: string | null;
  email: string | null;
  website: string | null;
  billToLine1: string | null;
  billToLine2: string | null;
  billToLine3: string | null;
  billToLine4: string | null;
  billToLine5: string | null;
  shipToLine1: string | null;
  shipToLine2: string | null;
  shipToLine3: string | null;
  shipToLine4: string | null;
  shipToLine5: string | null;
  taxExempt: boolean;
  resaleNumber: string | null;
  creditLimit: number | null;
  currentBalance: number | null;
  paymentTerms: string | null;
  isOnCreditHold: boolean;
  creditHoldReason: string | null;
  creditHoldDate: Date | null;
  accountNumber: string | null;
  companyType: string | null;
  industry: string | null;
  salesRep: string | null;
  salesTaxCode: string | null;
  taxItem: string | null;
  tags: string[];
  notes: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Relations
  contacts?: Contact[];
}

/** Contact person for a company */
export interface Contact {
  id: string;
  companyId: string;
  firstName: string;
  lastName: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  isPrimary: boolean;
  notes: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Equipment/machinery entity */
export interface Equipment {
  id: string;
  name: string;
  type: string;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  purchaseDate: Date | null;
  purchaseCost: number | null;
  warrantyExpires: Date | null;
  location: string | null;
  station: PrintingMethod | null;
  status: EquipmentStatus;
  notes: string | null;
  imageUrl: string | null;
  requiresCalibration: boolean;
  calibrationInterval: number | null;
  lastCalibrated: Date | null;
  nextCalibrationDue: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Document entity */
export interface Document {
  id: string;
  name: string;
  description: string | null;
  fileName: string;
  mimeType: string;
  fileSize: number;
  storagePath: string;
  category: DocumentCategory;
  version: number;
  isLatest: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Subcontractor entity */
export interface Subcontractor {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  services: string[];
  hourlyRate: number | null;
  notes: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Subcontract job entity */
export interface SubcontractJob {
  id: string;
  subcontractorId: string;
  orderId: string;
  description: string;
  status: SubcontractStatus;
  estimatedCost: number | null;
  actualCost: number | null;
  sentDate: Date | null;
  dueDate: Date | null;
  receivedDate: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Recurring order template */
export interface RecurringOrder {
  id: string;
  name: string;
  companyId: string | null;
  customerId: string | null;
  description: string | null;
  frequency: RecurringFrequency;
  intervalDays: number | null;
  lastGenerated: Date | null;
  nextGeneration: Date;
  isActive: boolean;
  routing: PrintingMethod[];
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

/** System settings */
export interface SystemSettings {
  id: string;
  key: string;
  value: string;
  category: SettingCategory;
  description: string | null;
  updatedAt: Date;
}

/** Email template */
export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  trigger: EmailTrigger | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** QC Checklist */
export interface QCChecklist {
  id: string;
  name: string;
  description: string | null;
  station: PrintingMethod | null;
  items: QCChecklistItem[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** QC Checklist Item */
export interface QCChecklistItem {
  id: string;
  checklistId: string;
  description: string;
  sortOrder: number;
  isRequired: boolean;
}

// Note: QCInspectionResult is exported from schemas.ts via z.infer

/** QC Inspection */
export interface QCInspection {
  id: string;
  orderId: string;
  checklistId: string;
  inspectedById: string;
  inspectedAt: Date;
  overallResult: InspectionResult;
  notes: string | null;
  // results relation - use QCInspectionResult from schemas.ts
  results?: { id: string; inspectionId: string; checklistItemId: string; passed: boolean; notes: string | null }[];
  createdAt: Date;
}

// ─── Equipment Watch Rules ──────────────────────────────────────────────────

export interface EquipmentWatchRule {
  id: string;
  name: string;
  description: string | null;
  dataSources: string[];
  metricField: string | null;
  operator: string;
  threshold: number;
  equipmentId: string | null;
  recipients: string[];
  emailSubject: string;
  emailBodyHtml: string | null;
  scheduleTime: string;
  scheduleDays: number[];
  isActive: boolean;
  lastNotifiedAt: Date | null;
  lastEvaluatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdById: string;
  equipment?: { id: string; name: string } | null;
  createdBy?: { id: string; displayName: string };
  _count?: { notifications: number };
}

export interface EquipmentWatchNotification {
  id: string;
  ruleId: string;
  sentAt: Date;
  recipients: string[];
  subject: string;
  triggeredItems: Array<{
    label: string;
    currentValue: number;
    threshold: number;
    equipmentName: string;
  }>;
  success: boolean;
  error: string | null;
}

export interface WatchRuleTriggeredItem {
  label: string;
  currentValue: number;
  threshold: number;
  equipmentName: string;
}

// ─── Production List Integration Types ───────────────────────────────────────
// Mirrors the Excel Production List columns and sections from docs/Production List setup

/** A single row from the Production List spreadsheet (maps to §4 Column Map) */
export interface ProductionListRow {
  /** Column A — Customer name or section marker */
  customerName: string;
  /** Column B — Work order number (4-digit = Port City, 5-digit = Wilde) */
  orderNumber: string;
  /** Column C — Job description (may include Must Ship date appended) */
  description: string;
  /** Column D (hidden) — Category tag: (OUTSOURCED), (DESIGN ONLY), (INSTALL), (INV), (COM) */
  category: string | null;
  /** Column E — Salesperson name */
  salesperson: string | null;
  /** Column F — Must Ship date */
  mustShipDate: Date | string | null;
  /** Column G — Proof date from file_index.xlsx, or "N/A" */
  proofDate: Date | string | null;
  /** Column H — Approval date from Outlook emails */
  approvalDate: Date | string | null;
  /** Column I — Print/Cut date from PrintCut_Index.xlsx, or "N/A" */
  printCutDate: Date | string | null;
  /** Column J — Print status: date if complete, or station flags like "RR", "FB", "RR FB" */
  printStatus: string | null;
  /** Column K — Free-text notes */
  notes: string | null;
  /** Column L — Calculated: network days between approval (H) and must-ship (F) */
  daysRemaining: number | null;
  /** Column M — Deadline warning: 7-workday deadline from approval */
  deadlineWarning: Date | string | null;
  /** Which section block this row belongs to */
  section: string;
  /** Row style (Normal, Attention, InnerWorkings, Must Ship) */
  style: string;
  /** Priority flag — yellow highlight on column A */
  isPriority: boolean;
  /** Whether the row has strikethrough (shipped/archived) */
  isStrikethrough: boolean;
  /** Source row number in the spreadsheet */
  rowNumber: number;
}

/** Mapping between a Production List row and an ERP WorkOrder */
export interface ProductionListMapping {
  /** The WO# from the spreadsheet */
  orderNumber: string;
  /** The ERP work order ID (null if not yet linked) */
  erpOrderId: string | null;
  /** The section the row is in on the spreadsheet */
  spreadsheetSection: string;
  /** The status in the ERP */
  erpStatus: string | null;
  /** Whether the data differs between spreadsheet and ERP */
  hasDifferences: boolean;
  /** Field-level differences */
  differences: ProductionListFieldDiff[];
}

/** A single field difference between spreadsheet and ERP */
export interface ProductionListFieldDiff {
  field: string;
  spreadsheetValue: string | null;
  erpValue: string | null;
  /** Which value takes precedence (optional — bidirectional merge hint) */
  preferredSource?: 'spreadsheet' | 'erp';
}

/** Result of a sync operation between Production List and ERP */
export interface ProductionListSyncResult {
  syncId: string;
  direction: string;
  startedAt: Date | string;
  completedAt: Date | string | null;
  status: string;
  /** File that was synced */
  fileName: string | null;
  /** Total rows in the spreadsheet */
  totalRows: number;
  /** Orders that matched between spreadsheet and ERP */
  matched: number;
  /** Orders only in the spreadsheet (not in ERP) */
  spreadsheetOnly: number;
  /** Orders only in the ERP (not in spreadsheet) */
  erpOnly: number;
  /** Orders imported from spreadsheet → ERP */
  imported: number;
  /** Orders updated in ERP from spreadsheet data */
  updated: number;
  /** Orders exported from ERP → spreadsheet */
  exported: number;
  /** Rows skipped */
  skipped: number;
  /** Errors encountered */
  errors: number;
  /** Per-row details */
  details: ProductionListSyncRowResult[];
}

/** Per-row result of a sync operation */
export interface ProductionListSyncRowResult {
  orderNumber: string;
  customerName: string;
  action: 'imported' | 'updated' | 'exported' | 'skipped' | 'error';
  reason?: string;
  differences?: ProductionListFieldDiff[];
}

/** Summary view of the Production List for the UI dashboard */
export interface ProductionListSummary {
  /** When the last sync happened */
  lastSyncAt: Date | string | null;
  lastSyncStatus: string | null;
  /** Counts by section */
  sectionCounts: Record<string, number>;
  /** Total active orders on the production list */
  totalActiveOrders: number;
  /** Orders due today */
  dueToday: number;
  /** Orders due tomorrow */
  dueTomorrow: number;
  /** Orders overdue */
  overdue: number;
  /** Orders waiting for proof approval */
  awaitingApproval: number;
  /** Orders with all printing complete */
  printingComplete: number;
  /** Orders with printing still pending (have station flags) */
  printingPending: number;
  /** How many ERP orders have matching spreadsheet rows */
  erpMatchedCount: number;
  /** How many spreadsheet rows have no ERP match */
  unmatchedCount: number;
}

/** Input for generating a Production List export from ERP data */
export interface ProductionListExportOptions {
  /** Which sections to include (all if empty) */
  sections?: string[];
  /** Include completed/shipped orders */
  includeCompleted?: boolean;
  /** Include on-hold orders */
  includeOnHold?: boolean;
  /** Date for the export header (defaults to next workday) */
  listDate?: Date | string;
  /** Export format */
  format?: 'xlsx' | 'csv' | 'json';
}

/** Configuration for how ERP status maps to Production List sections */
export interface ProductionListStatusMapping {
  erpStatus: string;
  defaultSection: string;
  /** Conditions that override the default */
  overrides?: Array<{
    condition: string;
    section: string;
  }>;
}

// ============ File Chain & Print-Cut Linking ============

/** A production file tracked through the entire workflow */
export interface ProductionFile {
  id: string;
  workOrderId: string;
  workOrder?: { id: string; orderNumber: string; customerName: string };
  
  // File identity
  fileName: string;              // Original file name
  filePath: string;              // Full UNC path or relative path
  fileType: ProductionFileType;
  fileSize: number | null;
  checksum: string | null;       // MD5 for dedup/integrity
  
  // Metadata
  isPrintCut: boolean;           // Has both print + cut components
  dimensions: string | null;     // e.g., "48x96"
  mediaType: string | null;      // e.g., "3M 8518"
  
  // Chain links
  printCutLinks: PrintCutLink[];
  ripJob: RipJob | null;
  
  // Timestamps
  discoveredAt: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/** Link between a print file and its corresponding cut file */
export interface PrintCutLink {
  id: string;
  workOrderId: string;
  workOrder?: { id: string; orderNumber: string; customerName: string };
  
  // Print side
  printFileName: string;
  printFilePath: string;
  printFileSize: number | null;
  ripJobId: string | null;
  ripJob?: RipJob | null;
  
  // Cut side
  cutFileName: string | null;
  cutFilePath: string | null;
  cutFileSize: number | null;
  cutFileSource: CutFileSource | null;
  cutFileFormat: string | null;  // .zcc, .xml, .dxf
  
  // Linking metadata
  status: FileChainStatus;
  linkConfidence: LinkConfidence;
  linkedAt: Date | string | null;
  linkedById: string | null;     // null = auto-linked
  linkedBy?: { id: string; username: string; displayName: string | null } | null;
  
  // Print tracking
  printStartedAt: Date | string | null;
  printCompletedAt: Date | string | null;
  printerName: string | null;
  ripMachine: string | null;
  
  // Cut tracking
  cutStartedAt: Date | string | null;
  cutCompletedAt: Date | string | null;
  cutterName: string | null;     // "Zund 1" or "Zund 2"
  cutJobName: string | null;     // Name from Zund stats DB
  cutCopiesDone: number | null;
  cutCopiesTotal: number | null;
  
  // Zund stats (from Statistics DB)
  zundJobId: string | null;      // Zund ProductionTimeJob.JobID
  zundMaterialGuid: string | null;
  cuttingTimeMs: number | null;
  setupTimeMs: number | null;
  cutLengthMm: number | null;
  
  // Error tracking
  errorMessage: string | null;
  
  // Timestamps
  createdAt: Date | string;
  updatedAt: Date | string;
}

/** Input to create a print-cut link */
export interface CreatePrintCutLinkInput {
  workOrderId: string;
  printFileName: string;
  printFilePath: string;
  printFileSize?: number;
  ripJobId?: string;
  cutFileName?: string;
  cutFilePath?: string;
  cutFileSource?: CutFileSource;
  linkConfidence?: LinkConfidence;
  notes?: string;
}

/** Input to manually link a cut file to an existing print chain */
export interface LinkCutFileInput {
  printCutLinkId: string;
  cutFileName: string;
  cutFilePath: string;
  cutFileSource: CutFileSource;
}

/** Filters for querying print-cut links */
export interface PrintCutLinkFilters {
  workOrderId?: string;
  status?: FileChainStatus | FileChainStatus[];
  linkConfidence?: LinkConfidence;
  cutFileSource?: CutFileSource;
  hasUnlinkedCut?: boolean;      // true = print exists but no cut file
  fromDate?: Date | string;
  toDate?: Date | string;
  search?: string;
  page?: number;
  limit?: number;
}

/** Summary of file chain status for an order */
export interface OrderFileChainSummary {
  workOrderId: string;
  orderNumber: string;
  customerName: string;
  totalFiles: number;
  printCutFiles: number;         // Files with isPrintCut=true
  linked: number;                // Have both print + cut linked
  unlinked: number;              // Print exists, no cut file found
  printComplete: number;
  cutComplete: number;
  chainStatus: FileChainStatus;  // Overall status (worst status of all links)
  links: PrintCutLink[];
}

/** Dashboard summary for file chain monitoring */
export interface FileChainDashboard {
  totalActiveLinks: number;
  pendingPrint: number;
  printing: number;
  pendingCut: number;
  cutting: number;
  completed: number;
  failed: number;
  unlinkedPrintFiles: number;    // Print files with no matching cut file
  recentLinks: PrintCutLink[];   // Last N auto-linked pairs
  staleLinks: PrintCutLink[];    // Links stuck in one stage too long
}

// ============ Shop Floor App Types ============

/** Shop Floor app configuration */
export interface ShopFloorConfig {
  station: ShopFloorStation;
  apiUrl: string;
  offlineEnabled: boolean;
  syncIntervalMs: number;
  autoLogin: boolean;            // Remember credentials
  compactMode: boolean;
}

/** Offline pending action queued for sync */
export interface PendingAction {
  id: string;
  action: string;                // e.g., "UPDATE_STATUS", "UPLOAD_PHOTO", "LOG_TIME"
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
  createdAt: Date | string;
  retries: number;
  lastError: string | null;
}

/** Install session tracking */
export interface InstallSession {
  id: string;
  workOrderId: string;
  installerUserId: string;
  startedAt: Date | string;
  completedAt: Date | string | null;
  durationMinutes: number | null;
  photos: InstallPhoto[];
  notes: string | null;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'PAUSED';
  latitude: number | null;
  longitude: number | null;
}

/** Photo from an installation */
export interface InstallPhoto {
  id: string;
  installSessionId: string;
  fileName: string;
  filePath: string;
  thumbnailPath: string | null;
  capturedAt: Date | string;
  uploadedAt: Date | string | null;
  synced: boolean;
  latitude: number | null;
  longitude: number | null;
}

/** Shipping label scan result */
export interface ShippingLabelScan {
  id: string;
  workOrderId: string;
  scannedAt: Date | string;
  scannedById: string;
  rawBarcode: string;
  carrier: string;               // UPS, FedEx, USPS, etc.
  trackingNumber: string;
  serviceType: string | null;    // Ground, 2-Day, Overnight, etc.
  shipTo: {
    name: string | null;
    street: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    country: string | null;
  } | null;
  weight: number | null;         // ounces
  dimensions: string | null;     // LxWxH
  labelImagePath: string | null;
}
