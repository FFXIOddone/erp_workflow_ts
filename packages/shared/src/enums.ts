// Work Order Status
export enum OrderStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  ON_HOLD = 'ON_HOLD',
  COMPLETED = 'COMPLETED',
  SHIPPED = 'SHIPPED',
  CANCELLED = 'CANCELLED',
}

// Printing Methods / Stations
export enum PrintingMethod {
  // Primary stations (in workflow order)
  SALES = 'SALES',
  DESIGN_ONLY = 'DESIGN_ONLY',
  ORDER_ENTRY = 'ORDER_ENTRY',
  DESIGN = 'DESIGN',
  FLATBED = 'FLATBED',
  ROLL_TO_ROLL = 'ROLL_TO_ROLL',
  SCREEN_PRINT = 'SCREEN_PRINT',
  PRODUCTION = 'PRODUCTION',
  SHIPPING_RECEIVING = 'SHIPPING_RECEIVING',
  INSTALLATION = 'INSTALLATION',
  COMPLETE = 'COMPLETE',
  // Design sub-stations
  DESIGN_PROOF = 'DESIGN_PROOF',
  DESIGN_APPROVAL = 'DESIGN_APPROVAL',
  DESIGN_PRINT_READY = 'DESIGN_PRINT_READY',
  // Flatbed sub-stations
  FLATBED_PRINTING = 'FLATBED_PRINTING',
  // Roll to Roll sub-stations
  ROLL_TO_ROLL_PRINTING = 'ROLL_TO_ROLL_PRINTING',
  // Screen Print sub-stations
  SCREEN_PRINT_PRINTING = 'SCREEN_PRINT_PRINTING',
  SCREEN_PRINT_ASSEMBLY = 'SCREEN_PRINT_ASSEMBLY',
  // Production sub-stations
  PRODUCTION_ZUND = 'PRODUCTION_ZUND',
  PRODUCTION_FINISHING = 'PRODUCTION_FINISHING',
  // Shipping sub-stations
  SHIPPING_QC = 'SHIPPING_QC',
  SHIPPING_PACKAGING = 'SHIPPING_PACKAGING',
  SHIPPING_SHIPMENT = 'SHIPPING_SHIPMENT',
  SHIPPING_INSTALL_READY = 'SHIPPING_INSTALL_READY',
  // Installation sub-stations
  INSTALLATION_REMOTE = 'INSTALLATION_REMOTE',
  INSTALLATION_INHOUSE = 'INSTALLATION_INHOUSE',
  // Complete sub-stations
  COMPLETE_INSTALLED = 'COMPLETE_INSTALLED',
  COMPLETE_SHIPPED = 'COMPLETE_SHIPPED',
  COMPLETE_DESIGN_ONLY = 'COMPLETE_DESIGN_ONLY',
}

// Station Status
export enum StationStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

// Event Types for audit log
export enum EventType {
  CREATED = 'CREATED',
  STATUS_CHANGED = 'STATUS_CHANGED',
  LINE_ADDED = 'LINE_ADDED',
  LINE_UPDATED = 'LINE_UPDATED',
  LINE_REMOVED = 'LINE_REMOVED',
  ROUTING_SET = 'ROUTING_SET',
  STATION_STARTED = 'STATION_STARTED',
  STATION_COMPLETED = 'STATION_COMPLETED',
  STATION_UNCOMPLETED = 'STATION_UNCOMPLETED',
  TIME_LOGGED = 'TIME_LOGGED',
  PRINTED = 'PRINTED',
  REPRINTED = 'REPRINTED',
  NOTE_ADDED = 'NOTE_ADDED',
  ASSIGNED = 'ASSIGNED',
  UNASSIGNED = 'UNASSIGNED',
}

// Reprint Reasons
export enum ReprintReason {
  PRINT_DEFECT = 'PRINT_DEFECT',
  CUSTOMER_CHANGE = 'CUSTOMER_CHANGE',
  MATERIAL_DEFECT = 'MATERIAL_DEFECT',
  WRONG_SIZE = 'WRONG_SIZE',
  DAMAGED = 'DAMAGED',
  OTHER = 'OTHER',
}

// Inventory Status
export enum InventoryStatus {
  AVAILABLE = 'AVAILABLE',
  RESERVED = 'RESERVED',
  IN_USE = 'IN_USE',
  DEPLETED = 'DEPLETED',
}

// User Roles
export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  OPERATOR = 'OPERATOR',
  VIEWER = 'VIEWER',
}

// Company Brands (for multi-brand filtering)
export enum CompanyBrand {
  WILDE_SIGNS = 'WILDE_SIGNS',
  PORT_CITY_SIGNS = 'PORT_CITY_SIGNS',
}

// Attachment Types
export enum AttachmentType {
  PROOF = 'PROOF',
  EMAIL = 'EMAIL',
  ARTWORK = 'ARTWORK',
  INVOICE = 'INVOICE',
  PACKING_SLIP = 'PACKING_SLIP',
  SHIPMENT_LOG = 'SHIPMENT_LOG',
  PHOTO = 'PHOTO',
  OTHER = 'OTHER',
}

// Design Revision Reasons (Phase 3)
export enum DesignRevisionReason {
  WRONG_SIZE = 'WRONG_SIZE',
  COLORS_OFF = 'COLORS_OFF',
  WRONG_MATERIAL = 'WRONG_MATERIAL',
  LAYOUT_ISSUE = 'LAYOUT_ISSUE',
  TEXT_ERROR = 'TEXT_ERROR',
  FILE_CORRUPT = 'FILE_CORRUPT',
  OTHER = 'OTHER',
}

export enum DesignRevisionStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  REJECTED = 'REJECTED',
}

// Quote Status
export enum QuoteStatus {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  CONVERTED = 'CONVERTED',
}

// Notification Types
export enum NotificationType {
  ORDER_CREATED = 'ORDER_CREATED',
  ORDER_STATUS_CHANGED = 'ORDER_STATUS_CHANGED',
  ORDER_ASSIGNED = 'ORDER_ASSIGNED',
  ORDER_DUE_SOON = 'ORDER_DUE_SOON',
  ORDER_OVERDUE = 'ORDER_OVERDUE',
  STATION_COMPLETED = 'STATION_COMPLETED',
  REPRINT_REQUESTED = 'REPRINT_REQUESTED',
  REPRINT_RESOLVED = 'REPRINT_RESOLVED',
  TIME_OFF_APPROVED = 'TIME_OFF_APPROVED',
  TIME_OFF_DENIED = 'TIME_OFF_DENIED',
  QUOTE_APPROVED = 'QUOTE_APPROVED',
  QUOTE_REJECTED = 'QUOTE_REJECTED',
  MENTION = 'MENTION',
  SYSTEM = 'SYSTEM',
}

// ============ Procurement Enums ============

// Purchase Order Status
export enum POStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  CONFIRMED = 'CONFIRMED',
  PARTIAL = 'PARTIAL',
  RECEIVED = 'RECEIVED',
  CANCELLED = 'CANCELLED',
}

// Shipping Carrier
export enum Carrier {
  UPS = 'UPS',
  FEDEX = 'FEDEX',
  USPS = 'USPS',
  DHL = 'DHL',
  FREIGHT = 'FREIGHT',
  CUSTOMER_PICKUP = 'CUSTOMER_PICKUP',
  OWN_DELIVERY = 'OWN_DELIVERY',
  OTHER = 'OTHER',
}

// Shipment Status
export enum ShipmentStatus {
  PENDING = 'PENDING',
  PICKED_UP = 'PICKED_UP',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED',
  EXCEPTION = 'EXCEPTION',
}

// ============ Quality Control Enums ============

// QC Inspection Status
export enum QCStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  PASSED = 'PASSED',
  FAILED = 'FAILED',
  PASSED_WITH_NOTES = 'PASSED_WITH_NOTES',
  NEEDS_REWORK = 'NEEDS_REWORK',
}

// ============ Equipment / Asset Management Enums ============

// Equipment Status (extended for routing intelligence)
export enum EquipmentStatus {
  OPERATIONAL = 'OPERATIONAL',
  DEGRADED = 'DEGRADED', // Working but slower (routing intelligence)
  MAINTENANCE = 'MAINTENANCE',
  DOWN = 'DOWN',
  WARMING_UP = 'WARMING_UP', // Starting up (routing intelligence)
  OFFLINE = 'OFFLINE', // Not available (routing intelligence)
  RETIRED = 'RETIRED',
}

// Maintenance Frequency
export enum MaintenanceFrequency {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  BIWEEKLY = 'BIWEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  BIANNUALLY = 'BIANNUALLY',
  YEARLY = 'YEARLY',
  CUSTOM = 'CUSTOM',
}

// Downtime Reason
export enum DowntimeReason {
  BREAKDOWN = 'BREAKDOWN',
  MAINTENANCE = 'MAINTENANCE',
  PARTS_SHORTAGE = 'PARTS_SHORTAGE',
  OPERATOR_ERROR = 'OPERATOR_ERROR',
  POWER_OUTAGE = 'POWER_OUTAGE',
  CALIBRATION = 'CALIBRATION',
  SOFTWARE_ISSUE = 'SOFTWARE_ISSUE',
  OTHER = 'OTHER',
}

// Impact Level
export enum ImpactLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

// Customer Interaction Type
export enum InteractionType {
  CALL = 'CALL',
  EMAIL = 'EMAIL',
  MEETING = 'MEETING',
  NOTE = 'NOTE',
  QUOTE_SENT = 'QUOTE_SENT',
  QUOTE_FOLLOWUP = 'QUOTE_FOLLOWUP',
  SITE_VISIT = 'SITE_VISIT',
  OTHER = 'OTHER',
}

// ============ Customer Portal Enums ============

// Proof Approval Status
export enum ProofStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CHANGES_REQUESTED = 'CHANGES_REQUESTED',
  EXPIRED = 'EXPIRED',
}

// ============ Email Automation Enums ============

// Email Trigger Events
export enum EmailTrigger {
  // Order events
  ORDER_CREATED = 'ORDER_CREATED',
  ORDER_STATUS_CHANGED = 'ORDER_STATUS_CHANGED',
  ORDER_COMPLETED = 'ORDER_COMPLETED',
  ORDER_SHIPPED = 'ORDER_SHIPPED',

  // Quote events
  QUOTE_SENT = 'QUOTE_SENT',
  QUOTE_FOLLOWUP_3DAY = 'QUOTE_FOLLOWUP_3DAY',
  QUOTE_FOLLOWUP_7DAY = 'QUOTE_FOLLOWUP_7DAY',
  QUOTE_FOLLOWUP_14DAY = 'QUOTE_FOLLOWUP_14DAY',
  QUOTE_APPROVED = 'QUOTE_APPROVED',
  QUOTE_REJECTED = 'QUOTE_REJECTED',

  // Proof events
  PROOF_UPLOADED = 'PROOF_UPLOADED',
  PROOF_APPROVED = 'PROOF_APPROVED',
  PROOF_REJECTED = 'PROOF_REJECTED',
  PROOF_REMINDER = 'PROOF_REMINDER',

  // Due date events
  DUE_DATE_7DAY = 'DUE_DATE_7DAY',
  DUE_DATE_3DAY = 'DUE_DATE_3DAY',
  DUE_DATE_1DAY = 'DUE_DATE_1DAY',
  ORDER_LATE = 'ORDER_LATE',

  // Portal events
  PORTAL_WELCOME = 'PORTAL_WELCOME',
  PORTAL_PASSWORD_RESET = 'PORTAL_PASSWORD_RESET',

  // Shipment events
  SHIPMENT_CREATED = 'SHIPMENT_CREATED',
  SHIPMENT_DELIVERED = 'SHIPMENT_DELIVERED',

  // Manual trigger
  MANUAL = 'MANUAL',
}

// Email Queue Status
export enum EmailStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

// ============ Production Scheduling Enums ============

// Production Slot Status
export enum SlotStatus {
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  RESCHEDULED = 'RESCHEDULED',
  CANCELLED = 'CANCELLED',
}
// ============ Credit Approval Enums ============

export enum CreditApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  DENIED = 'DENIED',
}

// ============ Subcontractor Enums ============

export enum SubcontractorService {
  ELECTRICAL = 'ELECTRICAL',
  INSTALLATION = 'INSTALLATION',
  WELDING = 'WELDING',
  PAINTING = 'PAINTING',
  PERMITTING = 'PERMITTING',
  CRANE_SERVICE = 'CRANE_SERVICE',
  FABRICATION = 'FABRICATION',
  CNC_ROUTING = 'CNC_ROUTING',
  POWDER_COATING = 'POWDER_COATING',
  OTHER = 'OTHER',
}

export enum RateType {
  HOURLY = 'HOURLY',
  FIXED = 'FIXED',
  PER_UNIT = 'PER_UNIT',
  PER_SQFT = 'PER_SQFT',
}

export enum SubcontractStatus {
  PENDING = 'PENDING',
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  INVOICED = 'INVOICED',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

// ============ Document Management Enums ============

export enum DocumentCategory {
  DESIGN_FILE = 'DESIGN_FILE', // AI, PSD, InDesign files
  PROOF = 'PROOF', // Proof PDFs for approval
  CONTRACT = 'CONTRACT', // Signed contracts
  LOGO = 'LOGO', // Customer logos
  BRAND_GUIDE = 'BRAND_GUIDE', // Brand guidelines
  INVOICE = 'INVOICE', // Invoices
  PURCHASE_ORDER = 'PURCHASE_ORDER', // PO documents
  DELIVERY_RECEIPT = 'DELIVERY_RECEIPT', // Signed delivery receipts
  PHOTO = 'PHOTO', // Progress photos, install photos
  INSURANCE = 'INSURANCE', // Insurance certificates
  LICENSE = 'LICENSE', // Business licenses
  W9 = 'W9', // W-9 forms
  QUOTE = 'QUOTE', // Quote documents
  SPECIFICATION = 'SPECIFICATION', // Technical specs
  OTHER = 'OTHER', // Miscellaneous
}

// ============ Recurring Orders Enums ============

export enum RecurringFrequency {
  WEEKLY = 'WEEKLY',
  BIWEEKLY = 'BIWEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  SEMIANNUALLY = 'SEMIANNUALLY',
  YEARLY = 'YEARLY',
  CUSTOM = 'CUSTOM',
}

export enum RecurringAction {
  CREATED = 'CREATED',
  UPDATED = 'UPDATED',
  PAUSED = 'PAUSED',
  RESUMED = 'RESUMED',
  CANCELLED = 'CANCELLED',
  ORDER_GENERATED = 'ORDER_GENERATED',
  GENERATION_FAILED = 'GENERATION_FAILED',
  NOTIFICATION_SENT = 'NOTIFICATION_SENT',
  SKIPPED = 'SKIPPED',
}

// ============ Installation / Field Service Enums ============

// Installation Job Status
export enum InstallStatus {
  UNSCHEDULED = 'UNSCHEDULED',
  SCHEDULED = 'SCHEDULED',
  EN_ROUTE = 'EN_ROUTE',
  ON_SITE = 'ON_SITE',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  INCOMPLETE = 'INCOMPLETE',
  RESCHEDULED = 'RESCHEDULED',
  CANCELLED = 'CANCELLED',
}

// Installation Job Priority
export enum InstallPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

// Installation Job Type
export enum InstallType {
  NEW_INSTALL = 'NEW_INSTALL',
  REMOVAL = 'REMOVAL',
  REPAIR = 'REPAIR',
  SURVEY = 'SURVEY',
  PERMIT_PICKUP = 'PERMIT_PICKUP',
  SITE_CHECK = 'SITE_CHECK',
  RETROFIT = 'RETROFIT',
  MAINTENANCE = 'MAINTENANCE',
}

// Installation Photo Type
export enum InstallPhotoType {
  BEFORE = 'BEFORE',
  PROGRESS = 'PROGRESS',
  AFTER = 'AFTER',
  ISSUE = 'ISSUE',
  PERMIT = 'PERMIT',
  SITE = 'SITE',
}

// Installation Event Type
export enum InstallEventType {
  CREATED = 'CREATED',
  SCHEDULED = 'SCHEDULED',
  RESCHEDULED = 'RESCHEDULED',
  ASSIGNED = 'ASSIGNED',
  UNASSIGNED = 'UNASSIGNED',
  STATUS_CHANGED = 'STATUS_CHANGED',
  EN_ROUTE = 'EN_ROUTE',
  ARRIVED = 'ARRIVED',
  STARTED = 'STARTED',
  COMPLETED = 'COMPLETED',
  PHOTO_ADDED = 'PHOTO_ADDED',
  NOTE_ADDED = 'NOTE_ADDED',
  CANCELLED = 'CANCELLED',
}

// ============ Webhook Enums ============

// Events that can trigger webhooks
export enum WebhookEventType {
  // Order lifecycle
  ORDER_CREATED = 'ORDER_CREATED',
  ORDER_UPDATED = 'ORDER_UPDATED',
  ORDER_STATUS_CHANGED = 'ORDER_STATUS_CHANGED',
  ORDER_COMPLETED = 'ORDER_COMPLETED',
  ORDER_SHIPPED = 'ORDER_SHIPPED',
  ORDER_CANCELLED = 'ORDER_CANCELLED',

  // Station progress
  STATION_STARTED = 'STATION_STARTED',
  STATION_COMPLETED = 'STATION_COMPLETED',

  // Quotes
  QUOTE_CREATED = 'QUOTE_CREATED',
  QUOTE_SENT = 'QUOTE_SENT',
  QUOTE_APPROVED = 'QUOTE_APPROVED',
  QUOTE_REJECTED = 'QUOTE_REJECTED',
  QUOTE_CONVERTED = 'QUOTE_CONVERTED',

  // Customer
  CUSTOMER_CREATED = 'CUSTOMER_CREATED',
  CUSTOMER_UPDATED = 'CUSTOMER_UPDATED',

  // Proofs
  PROOF_UPLOADED = 'PROOF_UPLOADED',
  PROOF_APPROVED = 'PROOF_APPROVED',
  PROOF_REJECTED = 'PROOF_REJECTED',

  // Installation
  INSTALL_SCHEDULED = 'INSTALL_SCHEDULED',
  INSTALL_STARTED = 'INSTALL_STARTED',
  INSTALL_COMPLETED = 'INSTALL_COMPLETED',

  // Inventory
  INVENTORY_LOW = 'INVENTORY_LOW',
  INVENTORY_DEPLETED = 'INVENTORY_DEPLETED',

  // Shipments
  SHIPMENT_CREATED = 'SHIPMENT_CREATED',
  SHIPMENT_SHIPPED = 'SHIPMENT_SHIPPED',
  SHIPMENT_DELIVERED = 'SHIPMENT_DELIVERED',
}

// Webhook delivery status
export enum WebhookDeliveryStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  RETRYING = 'RETRYING',
}

// ============ System Alert Enums ============

// Alert Type
export enum AlertType {
  INFO = 'INFO',
  SUCCESS = 'SUCCESS',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  MAINTENANCE = 'MAINTENANCE',
}

// Alert Severity
export enum AlertSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

// Alert Trigger Type
export enum AlertTriggerType {
  // Inventory triggers
  INVENTORY_LOW_STOCK = 'INVENTORY_LOW_STOCK',
  INVENTORY_DEPLETED = 'INVENTORY_DEPLETED',
  INVENTORY_EXPIRING = 'INVENTORY_EXPIRING',

  // Order triggers
  ORDER_OVERDUE = 'ORDER_OVERDUE',
  ORDER_STUCK_IN_STATION = 'ORDER_STUCK_IN_STATION',
  ORDER_REQUIRES_ATTENTION = 'ORDER_REQUIRES_ATTENTION',

  // Production triggers
  EQUIPMENT_DOWNTIME = 'EQUIPMENT_DOWNTIME',
  EQUIPMENT_MAINTENANCE_DUE = 'EQUIPMENT_MAINTENANCE_DUE',
  PRODUCTION_BOTTLENECK = 'PRODUCTION_BOTTLENECK',

  // Business triggers
  QUOTE_EXPIRING = 'QUOTE_EXPIRING',
  PAYMENT_OVERDUE = 'PAYMENT_OVERDUE',
  CUSTOMER_CREDIT_EXCEEDED = 'CUSTOMER_CREDIT_EXCEEDED',

  // System triggers
  SCHEDULED = 'SCHEDULED',
  MANUAL = 'MANUAL',
  API_TRIGGERED = 'API_TRIGGERED',
}

// ============ Third Party Integration Enums ============

// Integration Type
export enum IntegrationType {
  ACCOUNTING = 'ACCOUNTING', // QuickBooks, Xero
  ECOMMERCE = 'ECOMMERCE', // WooCommerce, Shopify
  PAYMENT = 'PAYMENT', // Stripe, Square
  SHIPPING = 'SHIPPING', // UPS, FedEx, USPS
  EMAIL = 'EMAIL', // SendGrid, Mailgun
  STORAGE = 'STORAGE', // S3, Google Cloud Storage
  CRM = 'CRM', // Salesforce, HubSpot
  CALENDAR = 'CALENDAR', // Google Calendar, Outlook
  CUSTOM = 'CUSTOM', // Custom API integrations
}

// Integration Status
export enum IntegrationStatus {
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  ERROR = 'ERROR',
  SYNCING = 'SYNCING',
  RATE_LIMITED = 'RATE_LIMITED',
  EXPIRED = 'EXPIRED', // OAuth token expired
  REQUIRES_REAUTH = 'REQUIRES_REAUTH', // Needs user to re-authorize
}

// Credential Type
export enum CredentialType {
  API_KEY = 'API_KEY',
  OAUTH2 = 'OAUTH2',
  BASIC_AUTH = 'BASIC_AUTH',
  BEARER_TOKEN = 'BEARER_TOKEN',
  CERTIFICATE = 'CERTIFICATE',
  HMAC_SECRET = 'HMAC_SECRET',
}

// Sync Type
export enum SyncType {
  MANUAL = 'MANUAL', // User-initiated sync
  SCHEDULED = 'SCHEDULED', // Auto-scheduled sync
  WEBHOOK = 'WEBHOOK', // Triggered by webhook
  REALTIME = 'REALTIME', // Continuous sync
}

// Sync Direction
export enum SyncDirection {
  PULL = 'PULL', // External -> ERP
  PUSH = 'PUSH', // ERP -> External
  BIDIRECTIONAL = 'BIDIRECTIONAL', // Both directions
}

// Sync Status
export enum SyncStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  PARTIAL = 'PARTIAL', // Some records failed
  CANCELLED = 'CANCELLED',
}

// ============ Saved Filter Enums ============

// Filter Entity Type
export enum FilterEntityType {
  ORDERS = 'ORDERS',
  QUOTES = 'QUOTES',
  CUSTOMERS = 'CUSTOMERS',
  INVENTORY = 'INVENTORY',
  INSTALLATIONS = 'INSTALLATIONS',
  PRODUCTION = 'PRODUCTION',
  INVOICES = 'INVOICES',
  SHIPMENTS = 'SHIPMENTS',
  REPORTS = 'REPORTS',
  USERS = 'USERS',
  PROOFS = 'PROOFS',
}

// ============ Audit Snapshot Enums ============

// Audit Entity Type
export enum AuditEntityType {
  WORK_ORDER = 'WORK_ORDER',
  LINE_ITEM = 'LINE_ITEM',
  CUSTOMER = 'CUSTOMER',
  QUOTE = 'QUOTE',
  INVOICE = 'INVOICE',
  SHIPMENT = 'SHIPMENT',
  INVENTORY_ITEM = 'INVENTORY_ITEM',
  INSTALLATION_JOB = 'INSTALLATION_JOB',
  PROOF = 'PROOF',
  USER = 'USER',
  LABOR_RATE = 'LABOR_RATE',
  PRICE_BOOK_ITEM = 'PRICE_BOOK_ITEM',
  EMAIL_TEMPLATE = 'EMAIL_TEMPLATE',
  WEBHOOK = 'WEBHOOK',
  INTEGRATION = 'INTEGRATION',
  ALERT_RULE = 'ALERT_RULE',
  SAVED_FILTER = 'SAVED_FILTER',
  SYSTEM_SETTING = 'SYSTEM_SETTING',
}

// Audit Action
export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  ARCHIVE = 'ARCHIVE',
  RESTORE = 'RESTORE',
  STATUS_CHANGE = 'STATUS_CHANGE',
  ASSIGNMENT_CHANGE = 'ASSIGNMENT_CHANGE',
  APPROVAL = 'APPROVAL',
  REJECTION = 'REJECTION',
  IMPORT = 'IMPORT',
  EXPORT = 'EXPORT',
  BULK_UPDATE = 'BULK_UPDATE',
}

// Change Source
export enum ChangeSource {
  WEB_UI = 'WEB_UI', // User action in web app
  PORTAL = 'PORTAL', // Customer portal action
  API = 'API', // REST API call
  WEBHOOK = 'WEBHOOK', // Webhook trigger
  SYNC = 'SYNC', // Integration sync
  IMPORT = 'IMPORT', // Data import
  SYSTEM = 'SYSTEM', // Automated system action
  MIGRATION = 'MIGRATION', // Data migration
}

// ============ Print Station Management Enums ============

// Print Job Status
export enum PrintJobStatus {
  PENDING = 'PENDING', // Waiting in queue
  PREPARING = 'PREPARING', // Pre-print preparation (RIP, layout)
  READY = 'READY', // Ready to print
  PRINTING = 'PRINTING', // Currently printing
  DRYING = 'DRYING', // Print complete, drying
  FINISHING = 'FINISHING', // Post-print processing (laminate, cut)
  QUALITY_CHECK = 'QUALITY_CHECK', // Quality inspection
  COMPLETED = 'COMPLETED', // Successfully completed
  ON_HOLD = 'ON_HOLD', // Paused by operator
  FAILED = 'FAILED', // Failed, needs intervention
  CANCELLED = 'CANCELLED', // Cancelled
  REPRINTING = 'REPRINTING', // Reprinting due to quality issue
}

// RIP job lifecycle status
export enum RipJobStatus {
  QUEUED = 'QUEUED', // File copied to hotfolder, waiting for RIP
  PROCESSING = 'PROCESSING', // RIP is processing (rasterizing)
  READY = 'READY', // RIP done, ready to send to printer
  SENDING = 'SENDING', // Sending to printer
  PRINTING = 'PRINTING', // Currently printing
  PRINTED = 'PRINTED', // Print complete
  COMPLETED = 'COMPLETED', // Fully done (verified/cleared)
  FAILED = 'FAILED', // Error occurred
  CANCELLED = 'CANCELLED', // Cancelled by user
}

// ============ User Preference Enums ============

// Theme Mode
export enum ThemeMode {
  LIGHT = 'LIGHT',
  DARK = 'DARK',
  SYSTEM = 'SYSTEM',
}

// Font Size
export enum FontSize {
  SMALL = 'SMALL',
  MEDIUM = 'MEDIUM',
  LARGE = 'LARGE',
  EXTRA_LARGE = 'EXTRA_LARGE',
}

// Sidebar Position
export enum SidebarPosition {
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
}

// Notification Digest Frequency
export enum NotificationDigest {
  INSTANT = 'INSTANT',
  HOURLY = 'HOURLY',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  NONE = 'NONE',
}

// Time Format
export enum TimeFormat {
  TWELVE_HOUR = 'TWELVE_HOUR',
  TWENTY_FOUR_HOUR = 'TWENTY_FOUR_HOUR',
}

// ============ Favorites System Enums ============

// Favorite Entity Type
export enum FavoriteEntityType {
  WORK_ORDER = 'WORK_ORDER',
  CUSTOMER = 'CUSTOMER',
  QUOTE = 'QUOTE',
  INVOICE = 'INVOICE',
  VENDOR = 'VENDOR',
  MATERIAL = 'MATERIAL',
  EQUIPMENT = 'EQUIPMENT',
  EMPLOYEE = 'EMPLOYEE',
  SUBCONTRACTOR = 'SUBCONTRACTOR',
  SAVED_FILTER = 'SAVED_FILTER',
  REPORT = 'REPORT',
  DASHBOARD_VIEW = 'DASHBOARD_VIEW',
}

// ============ Recent Search Enums ============

// Search Type
export enum SearchType {
  GLOBAL = 'GLOBAL', // Global search bar
  ENTITY = 'ENTITY', // Entity-specific search
  QUICK_ACTION = 'QUICK_ACTION', // Command palette
  FILTER = 'FILTER', // Filter/faceted search
}

// Search Entity Type
export enum SearchEntityType {
  WORK_ORDER = 'WORK_ORDER',
  CUSTOMER = 'CUSTOMER',
  QUOTE = 'QUOTE',
  INVOICE = 'INVOICE',
  VENDOR = 'VENDOR',
  MATERIAL = 'MATERIAL',
  EQUIPMENT = 'EQUIPMENT',
  EMPLOYEE = 'EMPLOYEE',
  SUBCONTRACTOR = 'SUBCONTRACTOR',
  DOCUMENT = 'DOCUMENT',
  ALL = 'ALL',
}

// ============ Batch Import Enums ============

// Import Job Status
export enum ImportJobStatus {
  PENDING = 'PENDING', // Waiting to start
  VALIDATING = 'VALIDATING', // Checking data
  PROCESSING = 'PROCESSING', // Importing records
  COMPLETED = 'COMPLETED', // Successfully finished
  FAILED = 'FAILED', // Failed with errors
  CANCELLED = 'CANCELLED', // User cancelled
  PARTIAL = 'PARTIAL', // Completed with some errors
}

// Import Entity Type
export enum ImportEntityType {
  CUSTOMER = 'CUSTOMER',
  VENDOR = 'VENDOR',
  MATERIAL = 'MATERIAL',
  EMPLOYEE = 'EMPLOYEE',
  EQUIPMENT = 'EQUIPMENT',
  WORK_ORDER = 'WORK_ORDER',
  QUOTE = 'QUOTE',
  INVOICE = 'INVOICE',
  CONTACT = 'CONTACT',
  PRICE_BOOK_ITEM = 'PRICE_BOOK_ITEM',
}

// Import File Type
export enum ImportFileType {
  CSV = 'CSV',
  XLSX = 'XLSX',
  XLS = 'XLS',
  JSON = 'JSON',
}

// ============ Keyboard Shortcuts ============

// Shortcut scope - where the shortcut is active
export enum ShortcutScope {
  GLOBAL = 'GLOBAL', // Works everywhere
  PAGE = 'PAGE', // Works on specific page
  MODAL = 'MODAL', // Works in modals only
  FORM = 'FORM', // Works in form context
}

// Shortcut category for organization
export enum ShortcutCategory {
  NAVIGATION = 'NAVIGATION', // Navigate to pages
  ACTION = 'ACTION', // Perform actions (save, delete, etc.)
  SEARCH = 'SEARCH', // Search-related
  TABLE = 'TABLE', // Table operations
  MODAL = 'MODAL', // Modal control
  EDITING = 'EDITING', // Edit operations
  SELECTION = 'SELECTION', // Select/deselect
  VIEW = 'VIEW', // View changes
  SYSTEM = 'SYSTEM', // System-level (help, settings)
}

// ============ SSS-001: ML Prediction & Routing Intelligence ============

// Types of ML models used for predictions
export enum PredictionModelType {
  GRADIENT_BOOST = 'GRADIENT_BOOST', // XGBoost/LightGBM style
  NEURAL_NET = 'NEURAL_NET', // Deep learning
  RANDOM_FOREST = 'RANDOM_FOREST', // Ensemble decision trees
  LINEAR_REGRESSION = 'LINEAR_REGRESSION', // Simple linear
  RULE_BASED = 'RULE_BASED', // Business rules only
  HYBRID = 'HYBRID', // Combination approach
}

// Types of optimization rules
export enum OptimizationRuleType {
  ROUTING = 'ROUTING', // Affects route selection
  SCHEDULING = 'SCHEDULING', // Affects timing/scheduling
  BATCHING = 'BATCHING', // Groups jobs together
  RESOURCE = 'RESOURCE', // Manages equipment/operators
  QUALITY = 'QUALITY', // Quality-based routing
  COST = 'COST', // Cost optimization
  DEADLINE = 'DEADLINE', // Due date driven
}

// Categories for organizing optimization rules
export enum OptimizationCategory {
  EFFICIENCY = 'EFFICIENCY', // Speed/throughput
  COST_REDUCTION = 'COST_REDUCTION', // Lower costs
  QUALITY = 'QUALITY', // Quality outcomes
  CUSTOMER_SERVICE = 'CUSTOMER_SERVICE', // Customer satisfaction
  RESOURCE_BALANCE = 'RESOURCE_BALANCE', // Even load distribution
  SUSTAINABILITY = 'SUSTAINABILITY', // Waste reduction
}

// NOTE: EquipmentStatus is defined above in Equipment/Asset Management section
// It has been extended with DEGRADED, WARMING_UP, OFFLINE for routing intelligence

// Types of routing decisions
export enum RoutingDecisionType {
  INITIAL = 'INITIAL', // First route assignment
  OPTIMIZATION = 'OPTIMIZATION', // System optimized route
  MANUAL_OVERRIDE = 'MANUAL_OVERRIDE', // User changed route
  REROUTE = 'REROUTE', // Changed due to issue
  SKIP_STATION = 'SKIP_STATION', // Skipped a station
  ADD_STATION = 'ADD_STATION', // Added a station
  REORDER = 'REORDER', // Changed station order
}

// What triggered a routing decision
export enum RoutingTrigger {
  NEW_ORDER = 'NEW_ORDER', // New order created
  QUEUE_IMBALANCE = 'QUEUE_IMBALANCE', // Queue depths unbalanced
  EQUIPMENT_CHANGE = 'EQUIPMENT_CHANGE', // Equipment status changed
  OPERATOR_CHANGE = 'OPERATOR_CHANGE', // Operator availability changed
  DEADLINE_RISK = 'DEADLINE_RISK', // At risk of missing deadline
  USER_REQUEST = 'USER_REQUEST', // User requested change
  QUALITY_ISSUE = 'QUALITY_ISSUE', // Quality problem at station
  BATCH_OPPORTUNITY = 'BATCH_OPPORTUNITY', // Can batch with similar jobs
  SCHEDULE_CHANGE = 'SCHEDULE_CHANGE', // Schedule optimization
}

// Who/what made the routing decision
export enum DecisionMaker {
  SYSTEM = 'SYSTEM', // Automated decision
  USER = 'USER', // Manual user decision
  RULE = 'RULE', // Business rule triggered
  ML_MODEL = 'ML_MODEL', // ML prediction accepted
}

// Outcome of a routing decision
export enum DecisionOutcome {
  PENDING = 'PENDING', // Not yet completed
  SUCCESS = 'SUCCESS', // Route worked well
  PARTIAL = 'PARTIAL', // Partially successful
  FAILED = 'FAILED', // Route caused issues
  REVERTED = 'REVERTED', // Had to change back
}

// Types of scheduling constraints
export enum ConstraintType {
  CAPACITY = 'CAPACITY', // Maximum capacity limits
  AVAILABILITY = 'AVAILABILITY', // Time-based availability
  DEPENDENCY = 'DEPENDENCY', // Job dependencies
  SKILL = 'SKILL', // Operator skill requirements
  EQUIPMENT = 'EQUIPMENT', // Equipment requirements
  MATERIAL = 'MATERIAL', // Material availability
  DEADLINE = 'DEADLINE', // Due date constraints
  PREFERENCE = 'PREFERENCE', // Soft preferences
}

// What the constraint targets
export enum ConstraintTarget {
  STATION = 'STATION', // Specific station
  OPERATOR = 'OPERATOR', // Specific operator
  EQUIPMENT = 'EQUIPMENT', // Specific equipment
  MATERIAL = 'MATERIAL', // Specific material
  JOB_TYPE = 'JOB_TYPE', // Type of job
  CUSTOMER = 'CUSTOMER', // Customer-specific
  GLOBAL = 'GLOBAL', // System-wide
}

// ============ SSS-008/SSS-011: NLP Query & Command Palette ============

// Query intent types - what the user wants to do
export enum QueryIntent {
  SEARCH = 'SEARCH', // Find/search for something
  REPORT = 'REPORT', // Generate a report
  COMPARE = 'COMPARE', // Compare two things
  AGGREGATE = 'AGGREGATE', // Sum/count/average
  NAVIGATE = 'NAVIGATE', // Go to a page/record
  CREATE = 'CREATE', // Create new record
  UPDATE = 'UPDATE', // Modify existing record
  DELETE = 'DELETE', // Remove record
  EXPORT = 'EXPORT', // Export data
  SCHEDULE = 'SCHEDULE', // Schedule something
  NOTIFY = 'NOTIFY', // Send notification
  HELP = 'HELP', // Get help/documentation
}

// Schedule frequency for saved queries
export enum ScheduleFrequency {
  HOURLY = 'HOURLY',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  CUSTOM = 'CUSTOM', // Uses cron expression
}

// Types of commands in the palette
export enum CommandType {
  SEARCH = 'SEARCH', // Search query
  NAVIGATION = 'NAVIGATION', // Go to page/record
  ACTION = 'ACTION', // Quick action (create, edit)
  NLP_QUERY = 'NLP_QUERY', // Natural language query
  SHORTCUT = 'SHORTCUT', // Keyboard shortcut
  RECENT = 'RECENT', // Recent item
}

// Categories for quick actions
export enum ActionCategory {
  CREATE = 'CREATE', // Create new records
  NAVIGATION = 'NAVIGATION', // Go to pages
  WORKFLOW = 'WORKFLOW', // Workflow actions
  REPORT = 'REPORT', // Generate reports
  COMMUNICATION = 'COMMUNICATION', // Send emails/notifications
  SETTINGS = 'SETTINGS', // Settings/preferences
  TOOLS = 'TOOLS', // Utility tools
}

// ============ SSS-015: Integration Automation Platform ============

// Workflow categories
export enum WorkflowCategory {
  NOTIFICATIONS = 'NOTIFICATIONS', // Send emails, SMS, push notifications
  INTEGRATIONS = 'INTEGRATIONS', // Sync with external systems
  DATA_SYNC = 'DATA_SYNC', // Sync data between internal systems
  AUTOMATION = 'AUTOMATION', // Internal automation tasks
  REPORTING = 'REPORTING', // Automated report generation
  MAINTENANCE = 'MAINTENANCE', // System maintenance tasks
}

// Types of workflow triggers
export enum WorkflowTriggerType {
  EVENT = 'EVENT', // Triggered by system event
  SCHEDULE = 'SCHEDULE', // Triggered on schedule (cron)
  WEBHOOK = 'WEBHOOK', // Triggered by external webhook
  MANUAL = 'MANUAL', // Manually triggered by user
  CONDITION = 'CONDITION', // Triggered when condition becomes true
}

// What to do when workflow errors
export enum WorkflowErrorAction {
  STOP = 'STOP', // Stop execution immediately
  CONTINUE = 'CONTINUE', // Skip failed step, continue
  RETRY = 'RETRY', // Retry failed step
  FALLBACK = 'FALLBACK', // Execute fallback step
}

// Types of workflow steps
export enum WorkflowStepType {
  ACTION = 'ACTION', // Execute an action
  CONDITION = 'CONDITION', // Branch based on condition
  DELAY = 'DELAY', // Wait for specified time
  LOOP = 'LOOP', // Loop over items
  PARALLEL = 'PARALLEL', // Execute multiple actions in parallel
  TRANSFORM = 'TRANSFORM', // Transform data
  APPROVAL = 'APPROVAL', // Wait for human approval
}

// Types of actions a step can perform
export enum WorkflowActionType {
  // Notifications
  SEND_EMAIL = 'SEND_EMAIL',
  SEND_SMS = 'SEND_SMS',
  SEND_PUSH = 'SEND_PUSH',
  SEND_WEBHOOK = 'SEND_WEBHOOK',
  // Data operations
  CREATE_RECORD = 'CREATE_RECORD',
  UPDATE_RECORD = 'UPDATE_RECORD',
  DELETE_RECORD = 'DELETE_RECORD',
  QUERY_DATA = 'QUERY_DATA',
  // External integrations
  SYNC_QUICKBOOKS = 'SYNC_QUICKBOOKS',
  SYNC_WOOCOMMERCE = 'SYNC_WOOCOMMERCE',
  CALL_API = 'CALL_API',
  // Internal operations
  ASSIGN_ORDER = 'ASSIGN_ORDER',
  UPDATE_STATUS = 'UPDATE_STATUS',
  GENERATE_DOCUMENT = 'GENERATE_DOCUMENT',
  RUN_REPORT = 'RUN_REPORT',
  // Flow control
  WAIT = 'WAIT',
  BRANCH = 'BRANCH',
  MERGE = 'MERGE',
}

// Execution status for workflows
export enum WorkflowExecutionStatus {
  PENDING = 'PENDING', // Waiting to start
  RUNNING = 'RUNNING', // Currently executing
  WAITING = 'WAITING', // Waiting for external input/approval
  PAUSED = 'PAUSED', // Manually paused
  COMPLETED = 'COMPLETED', // Successfully completed
  FAILED = 'FAILED', // Failed with error
  CANCELLED = 'CANCELLED', // Manually cancelled
  RETRYING = 'RETRYING', // Waiting to retry
}

// Step execution status
export enum WorkflowStepStatus {
  PENDING = 'PENDING', // Not yet started
  RUNNING = 'RUNNING', // Currently executing
  WAITING = 'WAITING', // Waiting for approval/external
  SKIPPED = 'SKIPPED', // Skipped due to conditions
  COMPLETED = 'COMPLETED', // Successfully completed
  FAILED = 'FAILED', // Failed with error
  RETRYING = 'RETRYING', // Waiting to retry
}

// Variable types for workflow variables
export enum WorkflowVariableType {
  STRING = 'STRING',
  NUMBER = 'NUMBER',
  BOOLEAN = 'BOOLEAN',
  JSON = 'JSON',
  SECRET = 'SECRET', // Encrypted credential
  API_KEY = 'API_KEY', // API key (encrypted)
  CONNECTION_STRING = 'CONNECTION_STRING', // Database/service connection
}

// ============================================================================
// DATA INTEGRITY & VALIDATION ENUMS
// ============================================================================

// Severity level for validation rules
export enum ValidationSeverity {
  ERROR = 'ERROR', // Blocks save, must be fixed
  WARNING = 'WARNING', // Allows save, but alerts user
  INFO = 'INFO', // Informational, logged only
}

// Types of field constraints
export enum FieldConstraintType {
  MIN_LENGTH = 'MIN_LENGTH', // Minimum string length
  MAX_LENGTH = 'MAX_LENGTH', // Maximum string length
  MIN_VALUE = 'MIN_VALUE', // Minimum numeric value
  MAX_VALUE = 'MAX_VALUE', // Maximum numeric value
  PATTERN = 'PATTERN', // Regex pattern match
  REQUIRED = 'REQUIRED', // Field must have value
  UNIQUE = 'UNIQUE', // Value must be unique in scope
  ENUM = 'ENUM', // Value must be in allowed list
  CUSTOM = 'CUSTOM', // Custom validation function
  DEPENDENCY = 'DEPENDENCY', // Depends on another field
  DATE_RANGE = 'DATE_RANGE', // Date must be in range
  FUTURE_DATE = 'FUTURE_DATE', // Date must be in future
  PAST_DATE = 'PAST_DATE', // Date must be in past
  FILE_TYPE = 'FILE_TYPE', // Allowed file extensions
  FILE_SIZE = 'FILE_SIZE', // Maximum file size
}

// Types of data anomalies detected
export enum AnomalyType {
  ORPHAN_RECORD = 'ORPHAN_RECORD', // Record with missing parent
  DUPLICATE = 'DUPLICATE', // Duplicate record detected
  CONSTRAINT_VIOLATION = 'CONSTRAINT_VIOLATION', // Business rule violation
  DATA_CORRUPTION = 'DATA_CORRUPTION', // Corrupted or invalid data
  MISSING_REQUIRED = 'MISSING_REQUIRED', // Required field is null
  REFERENTIAL_INTEGRITY = 'REFERENTIAL_INTEGRITY', // FK violation
  RANGE_VIOLATION = 'RANGE_VIOLATION', // Value outside allowed range
  FORMAT_ERROR = 'FORMAT_ERROR', // Wrong data format
  STALE_DATA = 'STALE_DATA', // Data not updated as expected
  CIRCULAR_REFERENCE = 'CIRCULAR_REFERENCE', // Self-referencing loop
}

// Status of integrity checks
export enum IntegrityCheckStatus {
  PENDING = 'PENDING', // Not yet run
  RUNNING = 'RUNNING', // Currently executing
  PASSED = 'PASSED', // All checks passed
  FAILED = 'FAILED', // One or more failures
  SKIPPED = 'SKIPPED', // Check was skipped
}

// Check frequency for scheduled integrity checks
export enum CheckFrequency {
  REAL_TIME = 'REAL_TIME', // On every change
  HOURLY = 'HOURLY',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  ON_DEMAND = 'ON_DEMAND', // Manual trigger only
}

// ============================================================================
// AUDIT & COMPLIANCE ENUMS
// ============================================================================

// Types of audit events
export enum AuditEventType {
  // Data lifecycle
  CREATE = 'CREATE',
  READ = 'READ',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  RESTORE = 'RESTORE',
  ARCHIVE = 'ARCHIVE',
  EXPORT = 'EXPORT',
  IMPORT = 'IMPORT',

  // Access events
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  LOGIN_FAILED = 'LOGIN_FAILED',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  PERMISSION_CHANGE = 'PERMISSION_CHANGE',

  // Business events
  APPROVAL = 'APPROVAL',
  REJECTION = 'REJECTION',
  SIGNATURE = 'SIGNATURE',
  SUBMISSION = 'SUBMISSION',
  CANCELLATION = 'CANCELLATION',
  STATUS_CHANGE = 'STATUS_CHANGE',

  // System events
  SYSTEM_CONFIG = 'SYSTEM_CONFIG',
  INTEGRATION_SYNC = 'INTEGRATION_SYNC',
  SCHEDULED_JOB = 'SCHEDULED_JOB',
  ERROR = 'ERROR',
}

// Categories for filtering audit events
export enum AuditCategory {
  DATA_CHANGE = 'DATA_CHANGE', // Normal CRUD operations
  SECURITY = 'SECURITY', // Authentication, authorization
  BUSINESS = 'BUSINESS', // Workflow actions
  COMPLIANCE = 'COMPLIANCE', // Regulatory actions
  SYSTEM = 'SYSTEM', // System operations
  INTEGRATION = 'INTEGRATION', // External system events
}

// Document types that require signatures
export enum SignatureDocType {
  QUOTE = 'QUOTE', // Quote approval
  PURCHASE_ORDER = 'PURCHASE_ORDER', // PO authorization
  WORK_ORDER = 'WORK_ORDER', // Work order approval
  CHANGE_ORDER = 'CHANGE_ORDER', // Change request approval
  QUALITY_CHECK = 'QUALITY_CHECK', // QC sign-off
  SHIPPING = 'SHIPPING', // Shipping authorization
  INVOICE = 'INVOICE', // Invoice approval
  CONTRACT = 'CONTRACT', // Contract signing
  TIME_ENTRY = 'TIME_ENTRY', // Timesheet approval
  EXPENSE = 'EXPENSE', // Expense approval
}

// Types of signatures
export enum SignatureType {
  TYPED = 'TYPED', // Typed name
  DRAWN = 'DRAWN', // Mouse/touch drawn
  UPLOADED = 'UPLOADED', // Uploaded image
  DIGITAL = 'DIGITAL', // PKI certificate
  BIOMETRIC = 'BIOMETRIC', // Fingerprint/face
  PIN = 'PIN', // PIN verification
}

// Compliance categories
export enum ComplianceCategory {
  DATA_PRIVACY = 'DATA_PRIVACY', // GDPR, CCPA
  FINANCIAL = 'FINANCIAL', // SOX, financial controls
  SAFETY = 'SAFETY', // Workplace safety
  QUALITY = 'QUALITY', // ISO, quality standards
  SECURITY = 'SECURITY', // Cybersecurity compliance
  INDUSTRY = 'INDUSTRY', // Industry-specific regs
  INTERNAL = 'INTERNAL', // Company policies
}

// Severity of compliance violations
export enum ComplianceSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

// What to do on compliance violation
export enum ComplianceAction {
  LOG = 'LOG', // Just log it
  ALERT = 'ALERT', // Send notification
  BLOCK = 'BLOCK', // Prevent action
  ESCALATE = 'ESCALATE', // Notify management
  QUARANTINE = 'QUARANTINE', // Isolate the record
}

// Status of compliance violations
export enum ViolationStatus {
  OPEN = 'OPEN',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  IN_REMEDIATION = 'IN_REMEDIATION',
  RESOLVED = 'RESOLVED',
  WAIVED = 'WAIVED',
  FALSE_POSITIVE = 'FALSE_POSITIVE',
}

// Basis for data retention
export enum RetentionBasis {
  LEGAL_REQUIREMENT = 'LEGAL_REQUIREMENT', // Required by law
  BUSINESS_NEED = 'BUSINESS_NEED', // Needed for operations
  CONSENT = 'CONSENT', // User consented
  CONTRACT = 'CONTRACT', // Part of contract obligation
  LEGITIMATE_INTEREST = 'LEGITIMATE_INTEREST', // Legitimate business interest
}

// What to do when retention expires
export enum ExpiryAction {
  DELETE = 'DELETE', // Hard delete
  ANONYMIZE = 'ANONYMIZE', // Remove PII but keep record
  ARCHIVE = 'ARCHIVE', // Move to cold storage
  REVIEW = 'REVIEW', // Flag for manual review
}

// Types of access
export enum AccessType {
  VIEW = 'VIEW', // Read single record
  LIST = 'LIST', // List/search records
  EXPORT = 'EXPORT', // Export data
  DOWNLOAD = 'DOWNLOAD', // Download file
  PRINT = 'PRINT', // Print
  SHARE = 'SHARE', // Share with others
  API_CALL = 'API_CALL', // API access
}

// ============================================================================
// MULTI-TENANCY & ORGANIZATION ENUMS
// ============================================================================

// Organization types
export enum OrganizationType {
  COMPANY = 'COMPANY', // Main company
  DIVISION = 'DIVISION', // Business division
  SUBSIDIARY = 'SUBSIDIARY', // Subsidiary company
  FRANCHISE = 'FRANCHISE', // Franchise location
  PARTNER = 'PARTNER', // Partner organization
}

// Organization status
export enum OrgStatus {
  PENDING = 'PENDING', // Awaiting activation
  ACTIVE = 'ACTIVE', // Active and operational
  SUSPENDED = 'SUSPENDED', // Temporarily suspended
  INACTIVE = 'INACTIVE', // Deactivated
  ARCHIVED = 'ARCHIVED', // Archived for records
}

// Subscription tiers
export enum SubscriptionTier {
  FREE = 'FREE', // Free tier
  BASIC = 'BASIC', // Basic paid
  PROFESSIONAL = 'PROFESSIONAL', // Pro tier
  ENTERPRISE = 'ENTERPRISE', // Enterprise tier
  CUSTOM = 'CUSTOM', // Custom agreement
}

// Location types
export enum LocationType {
  PRODUCTION = 'PRODUCTION', // Manufacturing facility
  WAREHOUSE = 'WAREHOUSE', // Storage/distribution
  OFFICE = 'OFFICE', // Office only
  RETAIL = 'RETAIL', // Retail storefront
  HYBRID = 'HYBRID', // Mixed use
}

// Department member roles
export enum DeptMemberRole {
  MEMBER = 'MEMBER',
  LEAD = 'LEAD',
  MANAGER = 'MANAGER',
  HEAD = 'HEAD',
}

// Team types
export enum TeamType {
  PRODUCTION = 'PRODUCTION', // Production crew
  INSTALLATION = 'INSTALLATION', // Install team
  SALES = 'SALES', // Sales team
  SUPPORT = 'SUPPORT', // Customer support
  ADMIN = 'ADMIN', // Administrative
  CROSS_FUNCTIONAL = 'CROSS_FUNCTIONAL', // Cross-department
}

// Team member roles
export enum TeamMemberRole {
  MEMBER = 'MEMBER',
  SENIOR = 'SENIOR',
  LEAD = 'LEAD',
}

// Org-level user roles
export enum OrgUserRole {
  OWNER = 'OWNER', // Organization owner
  ADMIN = 'ADMIN', // Org admin
  MANAGER = 'MANAGER', // Manager
  MEMBER = 'MEMBER', // Regular member
  GUEST = 'GUEST', // Guest/limited access
}

// Setting categories
export enum SettingCategory {
  GENERAL = 'GENERAL', // General settings
  BRANDING = 'BRANDING', // Brand/appearance
  WORKFLOW = 'WORKFLOW', // Workflow rules
  NOTIFICATIONS = 'NOTIFICATIONS', // Notification preferences
  INTEGRATIONS = 'INTEGRATIONS', // Integration configs
  BILLING = 'BILLING', // Billing settings
  SECURITY = 'SECURITY', // Security settings
  FEATURES = 'FEATURES', // Feature toggles
}

// Setting value types
export enum SettingValueType {
  STRING = 'STRING',
  NUMBER = 'NUMBER',
  BOOLEAN = 'BOOLEAN',
  JSON = 'JSON',
  SECRET = 'SECRET', // Encrypted value
}

// ============================================================================
// FINANCIAL TRACKING & COST ACCOUNTING ENUMS
// ============================================================================

// Cost center types
export enum CostCenterType {
  REVENUE = 'REVENUE', // Revenue-generating
  EXPENSE = 'EXPENSE', // Expense only
  PROFIT = 'PROFIT', // Both revenue and expense
  SERVICE = 'SERVICE', // Internal service department
  OVERHEAD = 'OVERHEAD', // Overhead/indirect
}

// Budget periods
export enum BudgetPeriod {
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  ANNUAL = 'ANNUAL',
  PROJECT = 'PROJECT', // Per-project budget
}

// Overhead allocation methods
export enum AllocationMethod {
  DIRECT = 'DIRECT', // Direct assignment
  LABOR_HOURS = 'LABOR_HOURS', // Based on labor hours
  MACHINE_HOURS = 'MACHINE_HOURS', // Based on machine hours
  SQUARE_FOOTAGE = 'SQUARE_FOOTAGE', // Based on space used
  HEADCOUNT = 'HEADCOUNT', // Based on employee count
  REVENUE = 'REVENUE', // Based on revenue
  EQUAL = 'EQUAL', // Split equally
}

// Types of materials
export enum MaterialType {
  SUBSTRATE = 'SUBSTRATE', // Print substrates (vinyl, paper, etc.)
  INK = 'INK', // Inks and toners
  LAMINATE = 'LAMINATE', // Laminates and overlays
  HARDWARE = 'HARDWARE', // Mounting hardware
  PACKAGING = 'PACKAGING', // Packaging materials
  SUPPLIES = 'SUPPLIES', // Consumable supplies
  OTHER = 'OTHER',
}

// Types of labor activities
export enum LaborActivity {
  SETUP = 'SETUP', // Machine setup
  PRODUCTION = 'PRODUCTION', // Actual production
  FINISHING = 'FINISHING', // Post-production finishing
  PACKAGING = 'PACKAGING', // Packaging
  QUALITY_CHECK = 'QUALITY_CHECK', // QC inspection
  REWORK = 'REWORK', // Fixing issues
  MAINTENANCE = 'MAINTENANCE', // Equipment maintenance
  ADMIN = 'ADMIN', // Administrative
}

// Labor cost approval status
export enum LaborCostStatus {
  PENDING = 'PENDING', // Awaiting approval
  APPROVED = 'APPROVED', // Approved for payroll/billing
  REJECTED = 'REJECTED', // Rejected - needs correction
  BILLED = 'BILLED', // Included in invoice
}

// Overhead categories
export enum OverheadCategory {
  FACILITY = 'FACILITY', // Rent, utilities, maintenance
  EQUIPMENT = 'EQUIPMENT', // Equipment depreciation
  INSURANCE = 'INSURANCE', // Insurance costs
  ADMINISTRATIVE = 'ADMINISTRATIVE', // Admin overhead
  MANAGEMENT = 'MANAGEMENT', // Management costs
  IT = 'IT', // IT/technology costs
  OTHER = 'OTHER',
}

// Entity types for profitability tracking
export enum ProfitEntityType {
  WORK_ORDER = 'WORK_ORDER',
  QUOTE = 'QUOTE',
  CUSTOMER = 'CUSTOMER',
  PRODUCT = 'PRODUCT',
  STATION = 'STATION',
  PERIOD = 'PERIOD', // Monthly/quarterly summary
}

// Profitability classification
export enum ProfitabilityTier {
  EXCELLENT = 'EXCELLENT', // > 40% margin
  GOOD = 'GOOD', // 25-40% margin
  ACCEPTABLE = 'ACCEPTABLE', // 15-25% margin
  MARGINAL = 'MARGINAL', // 5-15% margin
  LOSS = 'LOSS', // < 5% margin
}

// ============================================================================
// SCHEDULING & CAPACITY PLANNING ENUMS
// ============================================================================

/** Resource types for scheduling */
export enum ResourceType {
  EQUIPMENT = 'EQUIPMENT', // Printers, cutters, etc.
  WORKSTATION = 'WORKSTATION', // Physical work areas
  VEHICLE = 'VEHICLE', // Installation vehicles
  OPERATOR = 'OPERATOR', // Human resources
  TOOL = 'TOOL', // Specialized tools
}

/** Calendar event types */
export enum CalendarEventType {
  AVAILABLE = 'AVAILABLE', // Normal working hours
  UNAVAILABLE = 'UNAVAILABLE', // Blocked time
  MAINTENANCE = 'MAINTENANCE', // Scheduled maintenance
  HOLIDAY = 'HOLIDAY', // Company holiday
  VACATION = 'VACATION', // Personal time off
  TRAINING = 'TRAINING', // Training/education
  SETUP = 'SETUP', // Equipment setup
  BUFFER = 'BUFFER', // Buffer time between jobs
}

/** Recurrence patterns for scheduling */
export enum RecurrencePattern {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  BIWEEKLY = 'BIWEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  ANNUAL = 'ANNUAL',
  CUSTOM = 'CUSTOM',
}

/** Capacity plan granularity */
export enum CapacityGranularity {
  HOURLY = 'HOURLY',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
}

/** Capacity plan status */
export enum CapacityPlanStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  APPROVED = 'APPROVED',
  ARCHIVED = 'ARCHIVED',
}

/** Skill levels for operator capabilities */
export enum SkillLevel {
  TRAINEE = 'TRAINEE', // Learning
  BASIC = 'BASIC', // Can perform under supervision
  PROFICIENT = 'PROFICIENT', // Can perform independently
  ADVANCED = 'ADVANCED', // Can handle complex work
  EXPERT = 'EXPERT', // Can train others
}

/** Schedule conflict types */
export enum ScheduleConflictType {
  RESOURCE_DOUBLE_BOOKED = 'RESOURCE_DOUBLE_BOOKED',
  CAPACITY_EXCEEDED = 'CAPACITY_EXCEEDED',
  SKILL_UNAVAILABLE = 'SKILL_UNAVAILABLE',
  MATERIAL_SHORTAGE = 'MATERIAL_SHORTAGE',
  DEPENDENCY_VIOLATION = 'DEPENDENCY_VIOLATION',
  DEADLINE_IMPOSSIBLE = 'DEADLINE_IMPOSSIBLE',
  MAINTENANCE_OVERLAP = 'MAINTENANCE_OVERLAP',
  PRIORITY_CONFLICT = 'PRIORITY_CONFLICT',
}

/** Conflict resolution status */
export enum ConflictResolutionStatus {
  DETECTED = 'DETECTED',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  RESOLVING = 'RESOLVING',
  RESOLVED = 'RESOLVED',
  IGNORED = 'IGNORED',
  ESCALATED = 'ESCALATED',
}

// ============================================================================
// CUSTOMER RELATIONSHIP ENHANCEMENT ENUMS
// ============================================================================

/** Customer relationship types for hierarchy */
export enum CustomerRelationType {
  PARENT = 'PARENT', // Parent company
  SUBSIDIARY = 'SUBSIDIARY', // Child company
  FRANCHISE = 'FRANCHISE', // Franchise location
  AFFILIATE = 'AFFILIATE', // Affiliated company
  PARTNER = 'PARTNER', // Business partner
  BILLING = 'BILLING', // Billing relationship
}

/** Contact roles */
export enum ContactRole {
  PRIMARY = 'PRIMARY', // Main contact
  BILLING = 'BILLING', // Billing/accounts payable
  SHIPPING = 'SHIPPING', // Shipping/receiving
  TECHNICAL = 'TECHNICAL', // Technical/design contact
  APPROVAL = 'APPROVAL', // Approval authority
  EXECUTIVE = 'EXECUTIVE', // C-level / executive
  PROJECT_MANAGER = 'PROJECT_MANAGER', // Project manager
  PURCHASING = 'PURCHASING', // Purchasing agent
  OTHER = 'OTHER',
}

/** Preferred contact methods */
export enum PreferredContactMethod {
  EMAIL = 'EMAIL',
  PHONE = 'PHONE',
  TEXT = 'TEXT',
  PORTAL = 'PORTAL',
}

/** Customer tiers for scoring */
export enum CustomerTier {
  PLATINUM = 'PLATINUM',
  GOLD = 'GOLD',
  SILVER = 'SILVER',
  BRONZE = 'BRONZE',
  NEW = 'NEW',
  AT_RISK = 'AT_RISK',
  INACTIVE = 'INACTIVE',
}

/** Communication channels */
export enum CommunicationChannel {
  EMAIL = 'EMAIL',
  PHONE = 'PHONE',
  SMS = 'SMS',
  PORTAL_MESSAGE = 'PORTAL_MESSAGE',
  IN_PERSON = 'IN_PERSON',
  VIDEO_CALL = 'VIDEO_CALL',
  SOCIAL_MEDIA = 'SOCIAL_MEDIA',
  MAIL = 'MAIL',
  FAX = 'FAX',
  MEETING = 'MEETING', // In-person/scheduled meeting
  TEXT = 'TEXT', // Text/SMS message
}

/** Communication directions */
export enum CommunicationDirection {
  INBOUND = 'INBOUND', // Customer contacted us
  OUTBOUND = 'OUTBOUND', // We contacted customer
}

/** Communication sentiment */
export enum CommunicationSentiment {
  POSITIVE = 'POSITIVE',
  NEUTRAL = 'NEUTRAL',
  NEGATIVE = 'NEGATIVE',
  MIXED = 'MIXED',
}

// ============================================================================
// INVENTORY & SUPPLY CHAIN INTELLIGENCE ENUMS
// ============================================================================

/** Forecast methods */
export enum ForecastMethod {
  MOVING_AVERAGE = 'MOVING_AVERAGE',
  EXPONENTIAL_SMOOTHING = 'EXPONENTIAL_SMOOTHING',
  LINEAR_REGRESSION = 'LINEAR_REGRESSION',
  SEASONAL = 'SEASONAL',
  ARIMA = 'ARIMA',
  MACHINE_LEARNING = 'MACHINE_LEARNING',
  MANUAL = 'MANUAL',
}

/** Forecast status */
export enum ForecastStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  SUPERSEDED = 'SUPERSEDED',
  ARCHIVED = 'ARCHIVED',
}

/** Forecast granularity */
export enum ForecastGranularity {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
}

/** Supplier performance tiers */
export enum SupplierTier {
  PREFERRED = 'PREFERRED',
  APPROVED = 'APPROVED',
  CONDITIONAL = 'CONDITIONAL',
  PROBATION = 'PROBATION',
  DISQUALIFIED = 'DISQUALIFIED',
}

/** Performance categories for supplier scoring */
export enum PerformanceCategory {
  DELIVERY = 'DELIVERY',
  QUALITY = 'QUALITY',
  PRICE = 'PRICE',
  RESPONSIVENESS = 'RESPONSIVENESS',
  DOCUMENTATION = 'DOCUMENTATION',
  OVERALL = 'OVERALL',
}

/** Material substitution types */
export enum SubstitutionType {
  EQUIVALENT = 'EQUIVALENT', // Functionally equivalent
  ALTERNATIVE = 'ALTERNATIVE', // Different but acceptable
  UPGRADE = 'UPGRADE', // Better than original
  DOWNGRADE = 'DOWNGRADE', // Lesser but acceptable
  TEMPORARY = 'TEMPORARY', // Short-term only
}

/** Inventory transaction types */
export enum InventoryTransactionType {
  RECEIPT = 'RECEIPT', // Goods received
  ISSUE = 'ISSUE', // Issued to production
  ADJUSTMENT_IN = 'ADJUSTMENT_IN', // Positive adjustment
  ADJUSTMENT_OUT = 'ADJUSTMENT_OUT', // Negative adjustment
  TRANSFER = 'TRANSFER', // Location transfer
  RETURN_TO_VENDOR = 'RETURN_TO_VENDOR',
  RETURN_FROM_CUSTOMER = 'RETURN_FROM_CUSTOMER',
  SCRAP = 'SCRAP', // Written off as scrap
  CYCLE_COUNT = 'CYCLE_COUNT', // Cycle count adjustment
  PHYSICAL_COUNT = 'PHYSICAL_COUNT',
  CONSUMPTION = 'CONSUMPTION', // Used in production
  RESERVE = 'RESERVE', // Reserved for order
  UNRESERVE = 'UNRESERVE', // Released reservation
}

/** Inventory reservation status */
export enum ReservationStatus {
  ACTIVE = 'ACTIVE',
  PARTIALLY_CONSUMED = 'PARTIALLY_CONSUMED',
  FULLY_CONSUMED = 'FULLY_CONSUMED',
  RELEASED = 'RELEASED',
  EXPIRED = 'EXPIRED',
}

// ============================================================================
// QUALITY MANAGEMENT ENUMS
// ============================================================================

/** Types of quality standards */
export enum QualityStandardType {
  INCOMING_MATERIAL = 'INCOMING_MATERIAL',
  IN_PROCESS = 'IN_PROCESS',
  FINAL_PRODUCT = 'FINAL_PRODUCT',
  PACKAGING = 'PACKAGING',
  SHIPPING = 'SHIPPING',
}

/** Sampling methods for quality inspections */
export enum SamplingMethod {
  RANDOM = 'RANDOM',
  SYSTEMATIC = 'SYSTEMATIC',
  STRATIFIED = 'STRATIFIED',
  ONE_HUNDRED_PERCENT = 'ONE_HUNDRED_PERCENT',
  SKIP_LOT = 'SKIP_LOT',
}

/** Quality standard status */
export enum StandardStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  ACTIVE = 'ACTIVE',
  SUPERSEDED = 'SUPERSEDED',
  RETIRED = 'RETIRED',
}

/** Types of inspection checkpoints */
export enum CheckpointType {
  RECEIVING = 'RECEIVING',
  FIRST_ARTICLE = 'FIRST_ARTICLE',
  IN_PROCESS = 'IN_PROCESS',
  FINAL = 'FINAL',
  SHIPPING = 'SHIPPING',
  CUSTOMER_RETURN = 'CUSTOMER_RETURN',
}

/** Inspection result */
export enum InspectionResult {
  PENDING = 'PENDING',
  PASSED = 'PASSED',
  FAILED = 'FAILED',
  CONDITIONAL_PASS = 'CONDITIONAL_PASS',
  NOT_APPLICABLE = 'NOT_APPLICABLE',
}

/** Inspection disposition decisions */
export enum InspectionDisposition {
  ACCEPT = 'ACCEPT',
  REJECT = 'REJECT',
  REWORK = 'REWORK',
  USE_AS_IS = 'USE_AS_IS',
  SCRAP = 'SCRAP',
  RETURN_TO_VENDOR = 'RETURN_TO_VENDOR',
}

/** NCR (Non-Conformance Report) categories */
export enum NCRCategory {
  MATERIAL = 'MATERIAL',
  PROCESS = 'PROCESS',
  EQUIPMENT = 'EQUIPMENT',
  DESIGN = 'DESIGN',
  VENDOR = 'VENDOR',
  CUSTOMER_COMPLAINT = 'CUSTOMER_COMPLAINT',
  SHIPPING = 'SHIPPING',
  OTHER = 'OTHER',
}

/** NCR severity levels */
export enum NCRSeverity {
  CRITICAL = 'CRITICAL', // Safety hazard or complete failure
  MAJOR = 'MAJOR', // Significant impact on function
  MINOR = 'MINOR', // Cosmetic or minor deviation
  OBSERVATION = 'OBSERVATION', // Noted for improvement
}

/** Source of NCR detection */
export enum NCRSource {
  INCOMING_INSPECTION = 'INCOMING_INSPECTION',
  IN_PROCESS = 'IN_PROCESS',
  FINAL_INSPECTION = 'FINAL_INSPECTION',
  CUSTOMER_RETURN = 'CUSTOMER_RETURN',
  CUSTOMER_COMPLAINT = 'CUSTOMER_COMPLAINT',
  INTERNAL_AUDIT = 'INTERNAL_AUDIT',
  EXTERNAL_AUDIT = 'EXTERNAL_AUDIT',
}

/** NCR status workflow */
export enum NCRStatus {
  OPEN = 'OPEN',
  UNDER_INVESTIGATION = 'UNDER_INVESTIGATION',
  PENDING_DISPOSITION = 'PENDING_DISPOSITION',
  IN_CORRECTIVE_ACTION = 'IN_CORRECTIVE_ACTION',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  CLOSED = 'CLOSED',
  VOID = 'VOID',
}

/** NCR disposition options */
export enum NCRDisposition {
  USE_AS_IS = 'USE_AS_IS',
  REWORK = 'REWORK',
  REPAIR = 'REPAIR',
  SCRAP = 'SCRAP',
  RETURN_TO_VENDOR = 'RETURN_TO_VENDOR',
  REJECT = 'REJECT',
  CONCESSION = 'CONCESSION',
}

/** Types of corrective actions */
export enum CorrectiveActionType {
  CORRECTION = 'CORRECTION', // Fix the immediate issue
  CORRECTIVE = 'CORRECTIVE', // Eliminate root cause
  PREVENTIVE = 'PREVENTIVE', // Prevent recurrence
  IMPROVEMENT = 'IMPROVEMENT', // Continuous improvement
}

/** Corrective action priority */
export enum CorrectiveActionPriority {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

/** Root cause analysis methods */
export enum RootCauseMethod {
  FIVE_WHY = 'FIVE_WHY',
  FISHBONE = 'FISHBONE',
  FMEA = 'FMEA',
  FAULT_TREE = 'FAULT_TREE',
  PARETO = 'PARETO',
  OTHER = 'OTHER',
}

/** Corrective action status workflow */
export enum CAStatus {
  OPEN = 'OPEN',
  ROOT_CAUSE_ANALYSIS = 'ROOT_CAUSE_ANALYSIS',
  PLANNING = 'PLANNING',
  IMPLEMENTATION = 'IMPLEMENTATION',
  VERIFICATION = 'VERIFICATION',
  EFFECTIVENESS_REVIEW = 'EFFECTIVENESS_REVIEW',
  CLOSED = 'CLOSED',
  CANCELLED = 'CANCELLED',
}

/** Effectiveness review results */
export enum EffectivenessResult {
  EFFECTIVE = 'EFFECTIVE',
  PARTIALLY_EFFECTIVE = 'PARTIALLY_EFFECTIVE',
  NOT_EFFECTIVE = 'NOT_EFFECTIVE',
  PENDING = 'PENDING',
}

/** Quality measurement types */
export enum QualityMeasurementType {
  CONTINUOUS = 'CONTINUOUS', // Measurements (length, weight)
  ATTRIBUTE = 'ATTRIBUTE', // Pass/fail counts
  DEFECTS = 'DEFECTS', // Number of defects per unit
  PERCENTAGE = 'PERCENTAGE', // Percentage values
}

/** SPC chart types */
export enum SPCChartType {
  X_BAR_R = 'X_BAR_R', // Average and Range
  X_BAR_S = 'X_BAR_S', // Average and Std Dev
  I_MR = 'I_MR', // Individual and Moving Range
  P_CHART = 'P_CHART', // Proportion defective
  NP_CHART = 'NP_CHART', // Number defective
  C_CHART = 'C_CHART', // Defects per unit
  U_CHART = 'U_CHART', // Defects per unit (variable sample)
}

// ============================================================================
// DOCUMENT MANAGEMENT ENUMS
// ============================================================================

/** Document version status */
export enum DocumentVersionStatus {
  DRAFT = 'DRAFT',
  PENDING_REVIEW = 'PENDING_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  SUPERSEDED = 'SUPERSEDED',
  ARCHIVED = 'ARCHIVED',
}

/** Document template types */
export enum TemplateType {
  FORM = 'FORM', // Fillable form
  REPORT = 'REPORT', // Report template
  LETTER = 'LETTER', // Letter/correspondence
  CERTIFICATE = 'CERTIFICATE', // Certificate of conformance
  LABEL = 'LABEL', // Labels/tags
  CHECKLIST = 'CHECKLIST', // Inspection checklist
  CONTRACT = 'CONTRACT', // Contract template
  INVOICE = 'INVOICE', // Invoice template
  QUOTE = 'QUOTE', // Quote template
  WORK_INSTRUCTION = 'WORK_INSTRUCTION', // SOPs
  OTHER = 'OTHER',
}

/** Approval types for document review */
export enum ApprovalType {
  REVIEW = 'REVIEW', // General review
  TECHNICAL = 'TECHNICAL', // Technical review
  QUALITY = 'QUALITY', // Quality approval
  MANAGEMENT = 'MANAGEMENT', // Management approval
  CUSTOMER = 'CUSTOMER', // Customer approval
  LEGAL = 'LEGAL', // Legal review
  FINAL = 'FINAL', // Final sign-off
}

/** Approval workflow status */
export enum ApprovalStatus {
  PENDING = 'PENDING',
  IN_REVIEW = 'IN_REVIEW',
  COMPLETED = 'COMPLETED',
  SKIPPED = 'SKIPPED',
  DELEGATED = 'DELEGATED',
  EXPIRED = 'EXPIRED',
}

/** Approval decision options */
export enum ApprovalDecision {
  APPROVED = 'APPROVED',
  APPROVED_WITH_COMMENTS = 'APPROVED_WITH_COMMENTS',
  REJECTED = 'REJECTED',
  NEEDS_REVISION = 'NEEDS_REVISION',
  DEFERRED = 'DEFERRED',
}

/** Document access types */
export enum DocumentAccessType {
  USER = 'USER', // Specific user
  ROLE = 'ROLE', // Role-based
  DEPARTMENT = 'DEPARTMENT', // Department-based
  PUBLIC = 'PUBLIC', // Public access
  CUSTOMER = 'CUSTOMER', // Customer portal
}

/** Document access action types */
export enum DocumentAccessAction {
  VIEW = 'VIEW',
  DOWNLOAD = 'DOWNLOAD',
  PRINT = 'PRINT',
  SHARE = 'SHARE',
  EDIT = 'EDIT',
  DELETE = 'DELETE',
  VERSION_UPLOAD = 'VERSION_UPLOAD',
}

// ============================================================================
// PERFORMANCE & ANALYTICS ENUMS
// ============================================================================

/** Metric snapshot types */
export enum MetricSnapshotType {
  OVERALL = 'OVERALL', // Company-wide
  STATION = 'STATION', // Per station
  USER = 'USER', // Per operator
  CUSTOMER = 'CUSTOMER', // Per customer
  PRODUCT_LINE = 'PRODUCT_LINE', // Per product category
}

/** Metric scope types */
export enum MetricScopeType {
  GLOBAL = 'GLOBAL', // No specific scope
  STATION = 'STATION', // Station-level
  USER = 'USER', // User-level
  CUSTOMER = 'CUSTOMER', // Customer-level
  DEPARTMENT = 'DEPARTMENT', // Department-level
}

/** Throughput measurement periods */
export enum ThroughputPeriod {
  HOURLY = 'HOURLY',
  SHIFT = 'SHIFT',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
}

/** Bottleneck resource types */
export enum BottleneckResource {
  EQUIPMENT = 'EQUIPMENT', // Printer, cutter, etc.
  LABOR = 'LABOR', // Operator availability
  MATERIAL = 'MATERIAL', // Material shortage
  SPACE = 'SPACE', // Physical space constraint
  TOOLING = 'TOOLING', // Tools, dies, etc.
}

/** Bottleneck types */
export enum BottleneckType {
  CAPACITY = 'CAPACITY', // Max capacity reached
  EQUIPMENT_DOWN = 'EQUIPMENT_DOWN', // Equipment not working
  STAFF_SHORTAGE = 'STAFF_SHORTAGE', // Not enough operators
  MATERIAL_OUT = 'MATERIAL_OUT', // Material stockout
  QUALITY_HOLD = 'QUALITY_HOLD', // QC holding up work
  DEPENDENCY = 'DEPENDENCY', // Waiting on upstream
  EXTERNAL = 'EXTERNAL', // Customer delay, vendor, etc.
}

/** Bottleneck severity levels */
export enum BottleneckSeverity {
  CRITICAL = 'CRITICAL', // Production stopped
  HIGH = 'HIGH', // Significant delay
  MEDIUM = 'MEDIUM', // Moderate impact
  LOW = 'LOW', // Minor inconvenience
}

/** Bottleneck resolution types */
export enum BottleneckResolution {
  CLEARED = 'CLEARED', // Natural resolution
  OVERTIME = 'OVERTIME', // Added overtime
  RESEQUENCED = 'RESEQUENCED', // Changed priorities
  OUTSOURCED = 'OUTSOURCED', // Sent to subcontractor
  ESCALATED = 'ESCALATED', // Escalated to management
  EQUIPMENT_FIXED = 'EQUIPMENT_FIXED', // Repaired equipment
  MATERIAL_RECEIVED = 'MATERIAL_RECEIVED', // Received materials
  OTHER = 'OTHER',
}

/** Productivity measurement periods */
export enum ProductivityPeriod {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
}

/** Performance goal types */
export enum GoalType {
  PRODUCTIVITY = 'PRODUCTIVITY',
  QUALITY = 'QUALITY',
  EFFICIENCY = 'EFFICIENCY',
  REVENUE = 'REVENUE',
  CUSTOMER_SATISFACTION = 'CUSTOMER_SATISFACTION',
  SAFETY = 'SAFETY',
  DELIVERY = 'DELIVERY',
}

/** Goal direction - is higher or lower better */
export enum GoalDirection {
  HIGHER = 'HIGHER', // Higher is better
  LOWER = 'LOWER', // Lower is better
  TARGET = 'TARGET', // Closest to target
}

/** Goal time periods */
export enum GoalPeriod {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  ANNUAL = 'ANNUAL',
}

/** Goal status */
export enum GoalStatus {
  NOT_STARTED = 'NOT_STARTED',
  ON_TRACK = 'ON_TRACK',
  AT_RISK = 'AT_RISK',
  BEHIND = 'BEHIND',
  ACHIEVED = 'ACHIEVED',
  MISSED = 'MISSED',
}

// ============================================================================
// SSS-019: ADVANCED QUALITY ASSURANCE SYSTEM ENUMS
// ============================================================================

/** Defect severity classification */
export enum DefectSeverity {
  COSMETIC = 'COSMETIC', // Visual only, no functionality impact
  MINOR = 'MINOR', // Minor impact, can be used with notes
  MAJOR = 'MAJOR', // Significant impact, may need rework
  CRITICAL = 'CRITICAL', // Cannot be used/shipped, must be fixed
  SAFETY = 'SAFETY', // Safety hazard, immediate action required
}

/** Defect disposition decisions */
export enum DefectDisposition {
  PENDING = 'PENDING', // Awaiting decision
  USE_AS_IS = 'USE_AS_IS', // Accept with deviation
  REWORK = 'REWORK', // Repair/fix the defect
  SCRAP = 'SCRAP', // Cannot be salvaged
  RETURN_TO_VENDOR = 'RETURN_TO_VENDOR', // Supplier issue
  DOWNGRADE = 'DOWNGRADE', // Use for lesser purpose
}

/** Where defect was discovered */
export enum DefectSource {
  INCOMING = 'INCOMING', // Incoming inspection (materials)
  IN_PROCESS = 'IN_PROCESS', // Found during production
  FINAL_QC = 'FINAL_QC', // Final inspection before shipping
  CUSTOMER = 'CUSTOMER', // Customer complaint/return
  INTERNAL_AUDIT = 'INTERNAL_AUDIT', // Internal quality audit
  EQUIPMENT = 'EQUIPMENT', // Equipment-caused defect
}

/** Evidence/attachment types for QC */
export enum EvidenceType {
  PHOTO = 'PHOTO', // Image evidence
  VIDEO = 'VIDEO', // Video evidence
  DOCUMENT = 'DOCUMENT', // Document/PDF
  MEASUREMENT = 'MEASUREMENT', // Measurement data
  TEST_RESULT = 'TEST_RESULT', // Test results
  CUSTOMER_REPORT = 'CUSTOMER_REPORT', // Customer complaint
  AUDIO = 'AUDIO', // Audio recording
}

/** Root cause analysis categories */
export enum RootCauseCategoryQC {
  OPERATOR_ERROR = 'OPERATOR_ERROR', // Human error
  EQUIPMENT = 'EQUIPMENT', // Machine/equipment failure
  MATERIAL = 'MATERIAL', // Material defect
  PROCESS = 'PROCESS', // Process issue
  DESIGN = 'DESIGN', // Design flaw
  ENVIRONMENTAL = 'ENVIRONMENTAL', // Temperature, humidity, etc.
  MAINTENANCE = 'MAINTENANCE', // Maintenance-related
  TRAINING = 'TRAINING', // Training deficiency
  VENDOR = 'VENDOR', // Supplier issue
  UNKNOWN = 'UNKNOWN', // Under investigation
}

/** Supplier quality rating tiers */
export enum SupplierQualityTier {
  PREFERRED = 'PREFERRED', // Excellent quality history
  APPROVED = 'APPROVED', // Meets quality standards
  CONDITIONAL = 'CONDITIONAL', // On probation/watch
  RESTRICTED = 'RESTRICTED', // Limited use only
  BLOCKED = 'BLOCKED', // Quality issues, cannot use
}

/** Customer feedback types */
export enum FeedbackType {
  COMPLIMENT = 'COMPLIMENT', // Positive feedback
  COMPLAINT = 'COMPLAINT', // Quality issue
  SUGGESTION = 'SUGGESTION', // Improvement idea
  WARRANTY_CLAIM = 'WARRANTY_CLAIM', // Warranty-related
  RETURN = 'RETURN', // Return request
  QUESTION = 'QUESTION', // Quality question
}

/** Customer feedback status */
export enum FeedbackStatus {
  RECEIVED = 'RECEIVED', // Just received
  ACKNOWLEDGED = 'ACKNOWLEDGED', // Customer contacted
  INVESTIGATING = 'INVESTIGATING', // Under investigation
  RESOLVED = 'RESOLVED', // Issue resolved
  CLOSED = 'CLOSED', // Feedback closed
  ESCALATED = 'ESCALATED', // Escalated to management
}

/** Quality trend metric types */
export enum QualityTrendType {
  FIRST_PASS_YIELD = 'FIRST_PASS_YIELD', // Percentage passing on first try
  DEFECT_RATE = 'DEFECT_RATE', // Defects per 100 units
  CUSTOMER_RETURNS = 'CUSTOMER_RETURNS', // Return rate
  REWORK_RATE = 'REWORK_RATE', // Rework percentage
  SCRAP_RATE = 'SCRAP_RATE', // Scrap percentage
  INSPECTION_TIME = 'INSPECTION_TIME', // Average inspection time
  ESCAPE_RATE = 'ESCAPE_RATE', // Defects that reach customer
}

// ============================================================================
// NEW-CRITICAL-01: PROJECT MANAGEMENT & JOB TEMPLATES ENUMS
// ============================================================================

/** Project lifecycle status */
export enum ProjectStatus {
  PLANNING = 'PLANNING', // Initial planning phase
  APPROVED = 'APPROVED', // Budget approved, ready to start
  IN_PROGRESS = 'IN_PROGRESS', // Active work in progress
  ON_HOLD = 'ON_HOLD', // Temporarily paused
  COMPLETED = 'COMPLETED', // All work finished
  CANCELLED = 'CANCELLED', // Project cancelled
  ARCHIVED = 'ARCHIVED', // Archived for records
}

/** Project priority levels */
export enum ProjectPriority {
  CRITICAL = 'CRITICAL', // Highest priority, immediate attention
  HIGH = 'HIGH', // High priority
  MEDIUM = 'MEDIUM', // Normal priority
  LOW = 'LOW', // Low priority, as time permits
}

/** Milestone status */
export enum MilestoneStatus {
  NOT_STARTED = 'NOT_STARTED', // Milestone not yet begun
  IN_PROGRESS = 'IN_PROGRESS', // Milestone work underway
  COMPLETED = 'COMPLETED', // Milestone achieved
  OVERDUE = 'OVERDUE', // Past due date
  SKIPPED = 'SKIPPED', // Milestone skipped/not applicable
}

/** Budget line item types */
export enum BudgetLineType {
  MATERIAL = 'MATERIAL', // Material costs
  LABOR = 'LABOR', // Labor costs
  EQUIPMENT = 'EQUIPMENT', // Equipment/machine time
  SUBCONTRACT = 'SUBCONTRACT', // Subcontractor costs
  SHIPPING = 'SHIPPING', // Shipping/freight costs
  OVERHEAD = 'OVERHEAD', // Overhead allocation
  OTHER = 'OTHER', // Miscellaneous costs
}

/** Budget status */
export enum BudgetStatus {
  DRAFT = 'DRAFT', // Budget not finalized
  APPROVED = 'APPROVED', // Budget approved
  OVER_BUDGET = 'OVER_BUDGET', // Exceeded approved amount
  UNDER_BUDGET = 'UNDER_BUDGET', // Under approved amount
  CLOSED = 'CLOSED', // Budget closed out
}

/** Job template categories */
export enum JobTemplateCategory {
  SIGNAGE = 'SIGNAGE', // Standard signage templates
  VEHICLE_WRAP = 'VEHICLE_WRAP', // Vehicle wrap templates
  BANNER = 'BANNER', // Banner templates
  DISPLAY = 'DISPLAY', // Display/trade show templates
  WAYFINDING = 'WAYFINDING', // Wayfinding system templates
  CHANNEL_LETTER = 'CHANNEL_LETTER', // Channel letter templates
  MONUMENT = 'MONUMENT', // Monument sign templates
  CUSTOM = 'CUSTOM', // Custom/other templates
}

// ============================================================================
// NEW-CRITICAL-02: MATERIAL NESTING & WASTE OPTIMIZATION ENUMS
// ============================================================================

/** Nesting job status */
export enum NestingStatus {
  DRAFT = 'DRAFT', // Being created
  PENDING = 'PENDING', // Waiting to be nested
  PROCESSING = 'PROCESSING', // Nesting algorithm running
  COMPLETED = 'COMPLETED', // Nesting done
  APPROVED = 'APPROVED', // Approved for cutting
  IN_PRODUCTION = 'IN_PRODUCTION', // Currently being cut
  FINISHED = 'FINISHED', // All cuts complete
  CANCELLED = 'CANCELLED', // Cancelled
}

/** Individual cut status */
export enum CutStatus {
  PENDING = 'PENDING', // Not yet cut
  IN_PROGRESS = 'IN_PROGRESS', // Currently cutting
  COMPLETED = 'COMPLETED', // Cut finished
  FAILED = 'FAILED', // Cut failed
  SKIPPED = 'SKIPPED', // Skipped/not needed
}

/** Waste/scrap category */
export enum WasteCategory {
  USABLE_REMNANT = 'USABLE_REMNANT', // Large enough to reuse
  EDGE_TRIM = 'EDGE_TRIM', // Edge waste, recyclable
  SCRAP = 'SCRAP', // Too small to reuse
  DEFECTIVE = 'DEFECTIVE', // Material defect
  SETUP_WASTE = 'SETUP_WASTE', // Calibration/setup cuts
}

/** Material sheet/panel status */
export enum SheetStatus {
  AVAILABLE = 'AVAILABLE', // Ready to use
  RESERVED = 'RESERVED', // Reserved for a job
  IN_USE = 'IN_USE', // Currently being cut
  DEPLETED = 'DEPLETED', // Fully used
  DAMAGED = 'DAMAGED', // Damaged, cannot use
}

/** Nesting algorithm type */
export enum NestingAlgorithm {
  BOTTOM_LEFT = 'BOTTOM_LEFT', // Simple bottom-left fill
  BEST_FIT = 'BEST_FIT', // Best fit decreasing
  GENETIC = 'GENETIC', // Genetic algorithm optimization
  GUILLOTINE = 'GUILLOTINE', // Guillotine cutting
}

// ============================================================================
// NEW-CRITICAL-03: ADVANCED NOTIFICATION & COMMUNICATION HUB ENUMS
// ============================================================================

/** Notification delivery channel */
export enum NotificationChannel {
  IN_APP = 'IN_APP', // In-application notification
  EMAIL = 'EMAIL', // Email delivery
  SMS = 'SMS', // SMS text message
  PUSH = 'PUSH', // Push notification
  SLACK = 'SLACK', // Slack integration
  TEAMS = 'TEAMS', // Microsoft Teams
  WEBHOOK = 'WEBHOOK', // Custom webhook
}

/** Notification priority */
export enum NotificationPriorityLevel {
  LOW = 'LOW', // Can wait, batch delivery OK
  NORMAL = 'NORMAL', // Standard delivery
  HIGH = 'HIGH', // Deliver promptly
  URGENT = 'URGENT', // Immediate delivery required
}

/** Notification delivery status */
export enum NotificationDeliveryStatus {
  PENDING = 'PENDING', // Queued for delivery
  SENDING = 'SENDING', // Currently being sent
  DELIVERED = 'DELIVERED', // Successfully delivered
  FAILED = 'FAILED', // Delivery failed
  BOUNCED = 'BOUNCED', // Email bounced
  READ = 'READ', // User has read it
  DISMISSED = 'DISMISSED', // User dismissed without reading
}

/** Message thread status */
export enum ThreadStatus {
  OPEN = 'OPEN', // Active conversation
  RESOLVED = 'RESOLVED', // Issue resolved
  ARCHIVED = 'ARCHIVED', // Archived for records
}

/** Announcement target scope */
export enum AnnouncementScope {
  ALL = 'ALL', // All users
  ROLE = 'ROLE', // Specific roles
  DEPARTMENT = 'DEPARTMENT', // Specific departments
  USER = 'USER', // Specific users
  CUSTOMER = 'CUSTOMER', // Customer portal users
}

// ============================================================================
// NEW-CRITICAL-04: EQUIPMENT CALIBRATION & CERTIFICATION ENUMS
// ============================================================================

/** Calibration type */
export enum CalibrationType {
  INITIAL = 'INITIAL', // First calibration after purchase/install
  PERIODIC = 'PERIODIC', // Regular scheduled calibration
  AFTER_REPAIR = 'AFTER_REPAIR', // Calibration following repair
  AFTER_MOVE = 'AFTER_MOVE', // Calibration after equipment relocation
  VERIFICATION = 'VERIFICATION', // Quick verification check
  ADJUSTMENT = 'ADJUSTMENT', // Adjustment-only calibration
}

/** Calibration result */
export enum CalibrationResult {
  PASS = 'PASS', // Passed all tests within tolerance
  PASS_WITH_ADJUSTMENT = 'PASS_WITH_ADJUSTMENT', // Passed after adjustment
  FAIL = 'FAIL', // Failed calibration
  CONDITIONAL = 'CONDITIONAL', // Conditionally passed with limitations
  DEFERRED = 'DEFERRED', // Calibration deferred
}

/** Equipment certification type */
export enum CertificationType {
  SAFETY = 'SAFETY', // Safety certification
  QUALITY = 'QUALITY', // Quality certification
  ENVIRONMENTAL = 'ENVIRONMENTAL', // Environmental compliance
  CALIBRATION_CERT = 'CALIBRATION_CERT', // Calibration certificate
  OPERATOR = 'OPERATOR', // Operator certification for equipment
  WARRANTY = 'WARRANTY', // Warranty documentation
  INSURANCE = 'INSURANCE', // Insurance certificate
  REGULATORY = 'REGULATORY', // Regulatory compliance
}

/** Certification status */
export enum CertificationStatus {
  VALID = 'VALID', // Currently valid
  EXPIRING_SOON = 'EXPIRING_SOON', // Expiring within reminder period
  EXPIRED = 'EXPIRED', // Has expired
  SUSPENDED = 'SUSPENDED', // Temporarily suspended
  REVOKED = 'REVOKED', // Permanently revoked
  PENDING_RENEWAL = 'PENDING_RENEWAL', // Renewal in progress
}

// ============================================================================
// NEW-CRITICAL-05: ADVANCED USER TRAINING & COMPETENCY ENUMS
// ============================================================================

/** Training program category */
export enum TrainingCategory {
  EQUIPMENT_OPERATION = 'EQUIPMENT_OPERATION',
  SAFETY = 'SAFETY',
  QUALITY_CONTROL = 'QUALITY_CONTROL',
  SOFTWARE_SYSTEMS = 'SOFTWARE_SYSTEMS',
  CUSTOMER_SERVICE = 'CUSTOMER_SERVICE',
  PRODUCTION_PROCESS = 'PRODUCTION_PROCESS',
  MAINTENANCE = 'MAINTENANCE',
  LEADERSHIP = 'LEADERSHIP',
  COMPLIANCE = 'COMPLIANCE',
  GENERAL = 'GENERAL',
}

/** Training level */
export enum TrainingLevel {
  BEGINNER = 'BEGINNER',
  INTERMEDIATE = 'INTERMEDIATE',
  ADVANCED = 'ADVANCED',
  EXPERT = 'EXPERT',
  CERTIFICATION = 'CERTIFICATION',
}

/** Training delivery method */
export enum TrainingDeliveryMethod {
  IN_PERSON = 'IN_PERSON',
  ONLINE = 'ONLINE',
  HYBRID = 'HYBRID',
  SELF_PACED = 'SELF_PACED',
  ON_THE_JOB = 'ON_THE_JOB',
  MENTORSHIP = 'MENTORSHIP',
}

/** Training session status */
export enum TrainingSessionStatus {
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  POSTPONED = 'POSTPONED',
}

/** Enrollment status */
export enum EnrollmentStatus {
  ENROLLED = 'ENROLLED',
  WAITLISTED = 'WAITLISTED',
  ATTENDED = 'ATTENDED',
  COMPLETED = 'COMPLETED',
  NO_SHOW = 'NO_SHOW',
  CANCELLED = 'CANCELLED',
  FAILED = 'FAILED',
}

/** Competency type */
export enum CompetencyType {
  EQUIPMENT_OPERATION = 'EQUIPMENT_OPERATION',
  STATION_CERTIFICATION = 'STATION_CERTIFICATION',
  SAFETY_CERTIFICATION = 'SAFETY_CERTIFICATION',
  SOFTWARE_PROFICIENCY = 'SOFTWARE_PROFICIENCY',
  QUALITY_CERTIFICATION = 'QUALITY_CERTIFICATION',
  SPECIALIZED_SKILL = 'SPECIALIZED_SKILL',
  LICENSE = 'LICENSE',
  GENERAL_TRAINING = 'GENERAL_TRAINING',
}

/** Competency status */
export enum CompetencyStatus {
  ACTIVE = 'ACTIVE',
  EXPIRING_SOON = 'EXPIRING_SOON',
  EXPIRED = 'EXPIRED',
  SUSPENDED = 'SUSPENDED',
  REVOKED = 'REVOKED',
}

/** Training target type */
export enum TrainingTargetType {
  ROLE = 'ROLE',
  DEPARTMENT = 'DEPARTMENT',
  ALL_USERS = 'ALL_USERS',
  STATION = 'STATION',
}

/** Training priority level */
export enum TrainingPriorityLevel {
  REQUIRED = 'REQUIRED',
  RECOMMENDED = 'RECOMMENDED',
  OPTIONAL = 'OPTIONAL',
}

// ============================================================================
// NEW-CRITICAL-06: VENDOR RELATIONSHIP MANAGEMENT ENUMS
// ============================================================================

/** Vendor contract types */
export enum VendorContractType {
  MASTER_AGREEMENT = 'MASTER_AGREEMENT',
  BLANKET_PURCHASE = 'BLANKET_PURCHASE',
  FIXED_PRICE = 'FIXED_PRICE',
  TIME_AND_MATERIALS = 'TIME_AND_MATERIALS',
  CONSIGNMENT = 'CONSIGNMENT',
  EXCLUSIVE = 'EXCLUSIVE',
  DISTRIBUTOR = 'DISTRIBUTOR',
  SERVICE_LEVEL = 'SERVICE_LEVEL',
  LEASE = 'LEASE',
  MAINTENANCE = 'MAINTENANCE',
}

/** Contract status */
export enum ContractStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  ACTIVE = 'ACTIVE',
  EXPIRING_SOON = 'EXPIRING_SOON',
  EXPIRED = 'EXPIRED',
  TERMINATED = 'TERMINATED',
  SUSPENDED = 'SUSPENDED',
  RENEWED = 'RENEWED',
}

/** Vendor pricing types */
export enum VendorPricingType {
  LIST_PRICE = 'LIST_PRICE',
  CONTRACT_PRICE = 'CONTRACT_PRICE',
  VOLUME_PRICE = 'VOLUME_PRICE',
  PROMOTIONAL = 'PROMOTIONAL',
  SPOT_PRICE = 'SPOT_PRICE',
  COST_PLUS = 'COST_PLUS',
}

/** Vendor certification types */
export enum VendorCertificationType {
  ISO_9001 = 'ISO_9001',
  ISO_14001 = 'ISO_14001',
  ISO_27001 = 'ISO_27001',
  OSHA_COMPLIANCE = 'OSHA_COMPLIANCE',
  MINORITY_OWNED = 'MINORITY_OWNED',
  WOMAN_OWNED = 'WOMAN_OWNED',
  VETERAN_OWNED = 'VETERAN_OWNED',
  SMALL_BUSINESS = 'SMALL_BUSINESS',
  LIABILITY_INSURANCE = 'LIABILITY_INSURANCE',
  WORKERS_COMP = 'WORKERS_COMP',
  PROFESSIONAL_LICENSE = 'PROFESSIONAL_LICENSE',
  TRADE_CERTIFICATION = 'TRADE_CERTIFICATION',
  ENVIRONMENTAL_PERMIT = 'ENVIRONMENTAL_PERMIT',
  CREDIT_RATING = 'CREDIT_RATING',
  BONDING = 'BONDING',
  OTHER = 'OTHER',
}

/** Quote request types */
export enum QuoteRequestType {
  RFQ = 'RFQ',
  RFP = 'RFP',
  RFI = 'RFI',
  EMERGENCY = 'EMERGENCY',
  REBID = 'REBID',
}

/** Quote request status */
export enum QuoteRequestStatus {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  RESPONSES_RECEIVED = 'RESPONSES_RECEIVED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  AWARDED = 'AWARDED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

/** Quote response status */
export enum QuoteResponseStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  RECEIVED = 'RECEIVED',
  NO_RESPONSE = 'NO_RESPONSE',
  DECLINED = 'DECLINED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  SELECTED = 'SELECTED',
  NOT_SELECTED = 'NOT_SELECTED',
}

// ============================================================================
// NEW-CRITICAL-07: ADVANCED SHIPPING & LOGISTICS ENUMS
// ============================================================================

/** Shipping rate types */
export enum ShippingRateType {
  WEIGHT_BASED = 'WEIGHT_BASED',
  FLAT_RATE = 'FLAT_RATE',
  DIMENSIONAL = 'DIMENSIONAL',
  CUSTOM = 'CUSTOM',
}

/** Freight types */
export enum FreightType {
  LTL = 'LTL',
  FTL = 'FTL',
  PARTIAL_TL = 'PARTIAL_TL',
  EXPEDITED = 'EXPEDITED',
  WHITE_GLOVE = 'WHITE_GLOVE',
  FLATBED = 'FLATBED',
}

/** Freight quote status */
export enum FreightQuoteStatus {
  DRAFT = 'DRAFT',
  QUOTING = 'QUOTING',
  QUOTED = 'QUOTED',
  BOOKED = 'BOOKED',
  PICKED_UP = 'PICKED_UP',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

/** Delivery route status */
export enum DeliveryRouteStatus {
  PLANNED = 'PLANNED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

/** Delivery stop types */
export enum DeliveryStopType {
  DELIVERY = 'DELIVERY',
  PICKUP = 'PICKUP',
  SIGNATURE_ONLY = 'SIGNATURE_ONLY',
  SERVICE_CALL = 'SERVICE_CALL',
}

/** Delivery stop status */
export enum DeliveryStopStatus {
  PENDING = 'PENDING',
  EN_ROUTE = 'EN_ROUTE',
  ARRIVED = 'ARRIVED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED',
}

/** Tracking event types */
export enum TrackingEventType {
  LABEL_CREATED = 'LABEL_CREATED',
  PICKED_UP = 'PICKED_UP',
  IN_TRANSIT = 'IN_TRANSIT',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
  DELIVERY_ATTEMPT = 'DELIVERY_ATTEMPT',
  EXCEPTION = 'EXCEPTION',
  RETURNED = 'RETURNED',
  HELD = 'HELD',
  CUSTOMS = 'CUSTOMS',
}

// ============================================================================
// NEW-CRITICAL-08: Version Control & Revision Management
// ============================================================================

/** Entity types that can have revisions tracked */
export enum RevisionEntityType {
  WORK_ORDER = 'WORK_ORDER',
  QUOTE = 'QUOTE',
  LINE_ITEM = 'LINE_ITEM',
  DESIGN_FILE = 'DESIGN_FILE',
  BOM = 'BOM',
  BOM_ITEM = 'BOM_ITEM',
  CUSTOMER = 'CUSTOMER',
  PRODUCT = 'PRODUCT',
  PRICING_RULE = 'PRICING_RULE',
  TEMPLATE = 'TEMPLATE',
  VENDOR = 'VENDOR',
  ITEM_MASTER = 'ITEM_MASTER',
}

/** Types of revisions */
export enum RevisionType {
  INITIAL_VERSION = 'INITIAL_VERSION',
  MINOR_CHANGE = 'MINOR_CHANGE',
  MAJOR_CHANGE = 'MAJOR_CHANGE',
  CORRECTION = 'CORRECTION',
  ROLLBACK = 'ROLLBACK',
  MERGE = 'MERGE',
  BRANCH = 'BRANCH',
  AUTO_SAVE = 'AUTO_SAVE',
}

/** Reasons for making changes */
export enum ChangeReason {
  CUSTOMER_REQUEST = 'CUSTOMER_REQUEST',
  DESIGN_ERROR = 'DESIGN_ERROR',
  SPECIFICATION_CHANGE = 'SPECIFICATION_CHANGE',
  MATERIAL_SUBSTITUTION = 'MATERIAL_SUBSTITUTION',
  PRICING_ADJUSTMENT = 'PRICING_ADJUSTMENT',
  SCHEDULE_CHANGE = 'SCHEDULE_CHANGE',
  QUALITY_ISSUE = 'QUALITY_ISSUE',
  REGULATORY_REQUIREMENT = 'REGULATORY_REQUIREMENT',
  COST_OPTIMIZATION = 'COST_OPTIMIZATION',
  SCOPE_ADDITION = 'SCOPE_ADDITION',
  SCOPE_REDUCTION = 'SCOPE_REDUCTION',
  OTHER = 'OTHER',
}

/** Revision status */
export enum RevisionStatus {
  DRAFT = 'DRAFT',
  PENDING_REVIEW = 'PENDING_REVIEW',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  SUPERSEDED = 'SUPERSEDED',
  ARCHIVED = 'ARCHIVED',
}

/** Approval workflow types */
export enum ApprovalWorkflow {
  NONE = 'NONE',
  MANAGER_ONLY = 'MANAGER_ONLY',
  CUSTOMER_ONLY = 'CUSTOMER_ONLY',
  MANAGER_THEN_CUSTOMER = 'MANAGER_THEN_CUSTOMER',
  CUSTOMER_THEN_MANAGER = 'CUSTOMER_THEN_MANAGER',
  PARALLEL_APPROVAL = 'PARALLEL_APPROVAL',
  CUSTOM = 'CUSTOM',
}

/** Design version status */
export enum DesignVersionStatus {
  DRAFT = 'DRAFT',
  REVIEW = 'REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  SUPERSEDED = 'SUPERSEDED',
  ARCHIVED = 'ARCHIVED',
}

/** Change order types */
export enum ChangeOrderType {
  SCOPE_ADDITION = 'SCOPE_ADDITION',
  SCOPE_REDUCTION = 'SCOPE_REDUCTION',
  SPECIFICATION_CHANGE = 'SPECIFICATION_CHANGE',
  SCHEDULE_CHANGE = 'SCHEDULE_CHANGE',
  MATERIAL_CHANGE = 'MATERIAL_CHANGE',
  DESIGN_REVISION = 'DESIGN_REVISION',
  PRICING_ADJUSTMENT = 'PRICING_ADJUSTMENT',
  DELIVERY_CHANGE = 'DELIVERY_CHANGE',
  CANCELLATION = 'CANCELLATION',
}

/** Change order priority levels */
export enum ChangeOrderPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
  CRITICAL = 'CRITICAL',
}

/** Change order status */
export enum ChangeOrderStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  PENDING_CUSTOMER = 'PENDING_CUSTOMER',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  IMPLEMENTED = 'IMPLEMENTED',
  CANCELLED = 'CANCELLED',
}

/** Change request source */
export enum ChangeRequestSource {
  INTERNAL = 'INTERNAL',
  CUSTOMER = 'CUSTOMER',
  VENDOR = 'VENDOR',
  QUALITY = 'QUALITY',
  REGULATORY = 'REGULATORY',
}

/** Change order approval status (renamed from ApprovalStatus to avoid conflict) */
export enum ChangeApprovalStatus {
  NOT_REQUIRED = 'NOT_REQUIRED',
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  SKIPPED = 'SKIPPED',
}

// ============================================================================
// NEW-CRITICAL-09: Environmental & Sustainability Tracking
// ============================================================================

/** Material categories for environmental tracking */
export enum MaterialCategory {
  VINYL = 'VINYL',
  ALUMINUM = 'ALUMINUM',
  ACRYLIC = 'ACRYLIC',
  WOOD = 'WOOD',
  STEEL = 'STEEL',
  PLASTIC = 'PLASTIC',
  PAPER = 'PAPER',
  FABRIC = 'FABRIC',
  COMPOSITE = 'COMPOSITE',
  ELECTRONIC = 'ELECTRONIC',
  INK = 'INK',
  ADHESIVE = 'ADHESIVE',
  OTHER = 'OTHER',
}

/** Recyclability ratings */
export enum RecyclabilityRating {
  FULLY_RECYCLABLE = 'FULLY_RECYCLABLE',
  PARTIALLY_RECYCLABLE = 'PARTIALLY_RECYCLABLE',
  SPECIALTY_RECYCLING = 'SPECIALTY_RECYCLING',
  NOT_RECYCLABLE = 'NOT_RECYCLABLE',
  COMPOSTABLE = 'COMPOSTABLE',
  BIODEGRADABLE = 'BIODEGRADABLE',
}

/** Environmental certification types */
export enum EnvironmentalCertificationType {
  FSC = 'FSC', // Forest Stewardship Council
  GREENGUARD = 'GREENGUARD',
  ENERGY_STAR = 'ENERGY_STAR',
  CRADLE_TO_CRADLE = 'CRADLE_TO_CRADLE',
  ISO_14001 = 'ISO_14001',
  LEED_COMPLIANT = 'LEED_COMPLIANT',
  EPA_SAFER_CHOICE = 'EPA_SAFER_CHOICE',
  UL_ECOLOGO = 'UL_ECOLOGO',
  CARBON_NEUTRAL = 'CARBON_NEUTRAL',
  RECYCLED_CONTENT = 'RECYCLED_CONTENT',
  VOC_FREE = 'VOC_FREE',
  CUSTOM = 'CUSTOM',
}

/** Production waste categories */
export enum ProductionWasteCategory {
  PRODUCTION_SCRAP = 'PRODUCTION_SCRAP',
  SETUP_WASTE = 'SETUP_WASTE',
  DEFECTIVE_OUTPUT = 'DEFECTIVE_OUTPUT',
  PACKAGING = 'PACKAGING',
  CHEMICAL_WASTE = 'CHEMICAL_WASTE',
  ELECTRONIC_WASTE = 'ELECTRONIC_WASTE',
  HAZARDOUS = 'HAZARDOUS',
  GENERAL_WASTE = 'GENERAL_WASTE',
  RECYCLABLE_WASTE = 'RECYCLABLE_WASTE',
}

/** Waste disposal methods */
export enum WasteDisposalMethod {
  RECYCLED = 'RECYCLED',
  COMPOSTED = 'COMPOSTED',
  LANDFILL = 'LANDFILL',
  INCINERATED = 'INCINERATED',
  HAZARDOUS_DISPOSAL = 'HAZARDOUS_DISPOSAL',
  RETURNED_TO_VENDOR = 'RETURNED_TO_VENDOR',
  REPURPOSED = 'REPURPOSED',
  DONATED = 'DONATED',
}

/** Energy sources */
export enum EnergySource {
  GRID_ELECTRICITY = 'GRID_ELECTRICITY',
  SOLAR = 'SOLAR',
  WIND = 'WIND',
  NATURAL_GAS = 'NATURAL_GAS',
  PROPANE = 'PROPANE',
  DIESEL = 'DIESEL',
  HYBRID = 'HYBRID',
  RENEWABLE_CREDIT = 'RENEWABLE_CREDIT',
}

/** Carbon emission scopes */
export enum EmissionScope {
  SCOPE_1 = 'SCOPE_1', // Direct emissions from owned sources
  SCOPE_2 = 'SCOPE_2', // Indirect from purchased energy
  SCOPE_3 = 'SCOPE_3', // Other indirect (supply chain, etc.)
}

/** Sustainability goal types */
export enum SustainabilityGoalType {
  WASTE_REDUCTION = 'WASTE_REDUCTION',
  ENERGY_REDUCTION = 'ENERGY_REDUCTION',
  EMISSION_REDUCTION = 'EMISSION_REDUCTION',
  RECYCLING_RATE = 'RECYCLING_RATE',
  RENEWABLE_USAGE = 'RENEWABLE_USAGE',
  WATER_REDUCTION = 'WATER_REDUCTION',
  SUSTAINABLE_SOURCING = 'SUSTAINABLE_SOURCING',
  CERTIFICATION_TARGET = 'CERTIFICATION_TARGET',
  CUSTOM = 'CUSTOM',
}

/** Goal timeframes */
export enum GoalTimeframe {
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  ANNUAL = 'ANNUAL',
  MULTI_YEAR = 'MULTI_YEAR',
}

// ============================================================================
// NEW-CRITICAL-10: Advanced Pricing & Quote Intelligence
// ============================================================================

/** Pricing strategies */
export enum PricingStrategy {
  COST_PLUS = 'COST_PLUS', // Cost + markup percentage
  MARKET_BASED = 'MARKET_BASED', // Based on market rates
  VALUE_BASED = 'VALUE_BASED', // Based on perceived value
  COMPETITIVE = 'COMPETITIVE', // Match/beat competitors
  DYNAMIC = 'DYNAMIC', // Real-time based on demand
  TIERED = 'TIERED', // Volume-based tiers
  PROMOTIONAL = 'PROMOTIONAL', // Special pricing
  CUSTOM = 'CUSTOM', // Custom calculation
}

/** Quote confidence levels */
export enum QuoteConfidenceLevel {
  LOW = 'LOW', // < 50% likely to close
  MEDIUM = 'MEDIUM', // 50-70% likely
  HIGH = 'HIGH', // 70-90% likely
  VERY_HIGH = 'VERY_HIGH', // > 90% likely
}

/** Price adjustment types */
export enum PriceAdjustmentType {
  DISCOUNT_PERCENT = 'DISCOUNT_PERCENT',
  DISCOUNT_AMOUNT = 'DISCOUNT_AMOUNT',
  MARKUP_PERCENT = 'MARKUP_PERCENT',
  MARKUP_AMOUNT = 'MARKUP_AMOUNT',
  OVERRIDE = 'OVERRIDE',
  VOLUME_DISCOUNT = 'VOLUME_DISCOUNT',
  LOYALTY_DISCOUNT = 'LOYALTY_DISCOUNT',
  PROMOTIONAL = 'PROMOTIONAL',
  RUSH_FEE = 'RUSH_FEE',
  COMPLEXITY_FACTOR = 'COMPLEXITY_FACTOR',
}

/** Pricing rule conditions */
export enum PricingRuleCondition {
  QUANTITY_GREATER_THAN = 'QUANTITY_GREATER_THAN',
  QUANTITY_LESS_THAN = 'QUANTITY_LESS_THAN',
  TOTAL_GREATER_THAN = 'TOTAL_GREATER_THAN',
  TOTAL_LESS_THAN = 'TOTAL_LESS_THAN',
  CUSTOMER_TYPE_EQUALS = 'CUSTOMER_TYPE_EQUALS',
  PRODUCT_CATEGORY_EQUALS = 'PRODUCT_CATEGORY_EQUALS',
  ORDER_FREQUENCY_ABOVE = 'ORDER_FREQUENCY_ABOVE',
  LIFETIME_VALUE_ABOVE = 'LIFETIME_VALUE_ABOVE',
  FIRST_ORDER = 'FIRST_ORDER',
  REPEAT_CUSTOMER = 'REPEAT_CUSTOMER',
  RUSH_ORDER = 'RUSH_ORDER',
  SEASONAL = 'SEASONAL',
}

/** Quote score categories */
export enum QuoteScoreCategory {
  WIN_PROBABILITY = 'WIN_PROBABILITY',
  PROFITABILITY = 'PROFITABILITY',
  STRATEGIC_VALUE = 'STRATEGIC_VALUE',
  RISK = 'RISK',
  COMPLEXITY = 'COMPLEXITY',
}

/** Competitor price sources */
export enum CompetitorPriceSource {
  WEBSITE = 'WEBSITE',
  RFQ_RESPONSE = 'RFQ_RESPONSE',
  CUSTOMER_FEEDBACK = 'CUSTOMER_FEEDBACK',
  SALES_INTEL = 'SALES_INTEL',
  PUBLIC_RECORD = 'PUBLIC_RECORD',
  ESTIMATE = 'ESTIMATE',
}

/** Quote outcome types */
export enum QuoteOutcome {
  WON = 'WON',
  LOST = 'LOST',
  NO_DECISION = 'NO_DECISION',
  PENDING = 'PENDING',
}

/** Customer price segments */
export enum CustomerPriceSegment {
  BUDGET = 'BUDGET',
  VALUE = 'VALUE',
  PREMIUM = 'PREMIUM',
}

/** Customer loyalty tiers */
export enum CustomerLoyaltyTier {
  BRONZE = 'BRONZE',
  SILVER = 'SILVER',
  GOLD = 'GOLD',
  PLATINUM = 'PLATINUM',
}

// ============ AUDIT PHASE 1.1 - MISSING PRISMA ENUMS ============

/** Time off request types */
export enum TimeOffType {
  VACATION = 'VACATION',
  SICK = 'SICK',
  PERSONAL = 'PERSONAL',
  UNPAID = 'UNPAID',
  HOLIDAY = 'HOLIDAY',
  OTHER = 'OTHER',
}

/** Time off request status */
export enum TimeOffStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  DENIED = 'DENIED',
  CANCELLED = 'CANCELLED',
}

/** Pricing units for materials and labor */
export enum PricingUnit {
  EACH = 'EACH',
  SQFT = 'SQFT',
  SQIN = 'SQIN',
  LNFT = 'LNFT',
  HOUR = 'HOUR',
  SET = 'SET',
  PACK = 'PACK',
}

/** Archive action when archiving records */
export enum ArchiveAction {
  ARCHIVE = 'ARCHIVE',
  COMPRESS = 'COMPRESS',
  EXPORT = 'EXPORT',
  NONE = 'NONE',
}

/** Purge action when deleting records */
export enum PurgeAction {
  SOFT_DELETE = 'SOFT_DELETE',
  HARD_DELETE = 'HARD_DELETE',
  ANONYMIZE = 'ANONYMIZE',
}

/** Type of data change */
export enum ChangeType {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  RESTORE = 'RESTORE',
  ARCHIVE = 'ARCHIVE',
}

/** Constraint severity levels */
export enum ConstraintSeverity {
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  INFO = 'INFO',
}

/** Validation trigger events */
export enum ValidationTrigger {
  BEFORE_CREATE = 'BEFORE_CREATE',
  AFTER_CREATE = 'AFTER_CREATE',
  BEFORE_UPDATE = 'BEFORE_UPDATE',
  AFTER_UPDATE = 'AFTER_UPDATE',
  BEFORE_DELETE = 'BEFORE_DELETE',
  ON_STATUS_CHANGE = 'ON_STATUS_CHANGE',
  CUSTOM = 'CUSTOM',
}

/** Anomaly severity levels */
export enum AnomalySeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

/** Anomaly resolution status */
export enum AnomalyStatus {
  DETECTED = 'DETECTED',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  IGNORED = 'IGNORED',
  FALSE_POSITIVE = 'FALSE_POSITIVE',
}

/** Root cause categories for quality issues */
export enum RootCauseCategory {
  OPERATOR_ERROR = 'OPERATOR_ERROR',
  EQUIPMENT = 'EQUIPMENT',
  MATERIAL = 'MATERIAL',
  PROCESS = 'PROCESS',
  DESIGN = 'DESIGN',
  ENVIRONMENTAL = 'ENVIRONMENTAL',
  MAINTENANCE = 'MAINTENANCE',
  TRAINING = 'TRAINING',
  VENDOR = 'VENDOR',
  UNKNOWN = 'UNKNOWN',
}

/** Template categories for job templates */
export enum TemplateCategory {
  SIGNAGE = 'SIGNAGE',
  VEHICLE_WRAP = 'VEHICLE_WRAP',
  BANNER = 'BANNER',
  DISPLAY = 'DISPLAY',
  WAYFINDING = 'WAYFINDING',
  CHANNEL_LETTER = 'CHANNEL_LETTER',
  MONUMENT = 'MONUMENT',
  CUSTOM = 'CUSTOM',
}

/** Notification priority levels */
export enum NotificationPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

// ─── Equipment Watch Rule Enums ──────────────────────────────────────────────

/** Comparison operators for equipment watch rules */
export enum WatchRuleOperator {
  LESS_THAN = 'LESS_THAN',
  LESS_THAN_OR_EQUAL = 'LESS_THAN_OR_EQUAL',
  GREATER_THAN = 'GREATER_THAN',
  GREATER_THAN_OR_EQUAL = 'GREATER_THAN_OR_EQUAL',
  EQUALS = 'EQUALS',
  NOT_EQUALS = 'NOT_EQUALS',
}

/** Data source categories available for equipment watch rules */
export enum WatchRuleDataSource {
  VUTEK_INK = 'VUTEK_INK',
  HP_INK = 'HP_INK',
  HP_PRINTHEAD = 'HP_PRINTHEAD',
  HP_MAINTENANCE = 'HP_MAINTENANCE',
  EQUIPMENT_STATUS = 'EQUIPMENT_STATUS',
}

/** Display-friendly operator labels */
export const WATCH_RULE_OPERATOR_LABELS: Record<WatchRuleOperator, string> = {
  [WatchRuleOperator.LESS_THAN]: '< Less than',
  [WatchRuleOperator.LESS_THAN_OR_EQUAL]: '≤ Less than or equal',
  [WatchRuleOperator.GREATER_THAN]: '> Greater than',
  [WatchRuleOperator.GREATER_THAN_OR_EQUAL]: '≥ Greater than or equal',
  [WatchRuleOperator.EQUALS]: '= Equals',
  [WatchRuleOperator.NOT_EQUALS]: '≠ Not equal',
};

/** Metric fields available per data source */
export const WATCH_RULE_METRICS: Record<
  WatchRuleDataSource,
  Array<{ field: string; label: string; unit: string }>
> = {
  [WatchRuleDataSource.VUTEK_INK]: [
    { field: 'estimatedPercentRemaining', label: 'Estimated % Remaining', unit: '%' },
    { field: 'microlitersUsed', label: 'Microliters Used', unit: 'µL' },
  ],
  [WatchRuleDataSource.HP_INK]: [{ field: 'levelPercent', label: 'Cartridge Level', unit: '%' }],
  [WatchRuleDataSource.HP_PRINTHEAD]: [
    { field: 'healthGaugeLevel', label: 'Health Gauge Level', unit: '%' },
  ],
  [WatchRuleDataSource.HP_MAINTENANCE]: [
    { field: 'levelPercent', label: 'Component Level', unit: '%' },
  ],
  [WatchRuleDataSource.EQUIPMENT_STATUS]: [
    { field: 'isOnline', label: 'Online Status (1=online, 0=offline)', unit: '' },
  ],
};

/** Default (primary) metric field for each data source — used when rule has multiple sources */
export const WATCH_RULE_DEFAULT_METRIC: Record<WatchRuleDataSource, string> = {
  [WatchRuleDataSource.VUTEK_INK]: 'estimatedPercentRemaining',
  [WatchRuleDataSource.HP_INK]: 'levelPercent',
  [WatchRuleDataSource.HP_PRINTHEAD]: 'healthGaugeLevel',
  [WatchRuleDataSource.HP_MAINTENANCE]: 'levelPercent',
  [WatchRuleDataSource.EQUIPMENT_STATUS]: 'isOnline',
};

/** Display names for data sources */
export const WATCH_RULE_DATA_SOURCE_LABELS: Record<WatchRuleDataSource, string> = {
  [WatchRuleDataSource.VUTEK_INK]: 'VUTEk UV Ink Bags',
  [WatchRuleDataSource.HP_INK]: 'HP Latex Ink Cartridges',
  [WatchRuleDataSource.HP_PRINTHEAD]: 'HP Latex Printheads',
  [WatchRuleDataSource.HP_MAINTENANCE]: 'HP Maintenance Components',
  [WatchRuleDataSource.EQUIPMENT_STATUS]: 'Equipment Online Status',
};

// ─── Production List Integration ─────────────────────────────────────────────
// Maps to the vertical section blocks in the Excel Production List workbook.
// See docs/Production List setup §3 for detailed descriptions.

/** Sections in the Excel Production List (column A marker text) */
export enum ProductionListSection {
  CUSTOMER = 'CUSTOMER',
  MONTHLY = 'MONTHLY',
  COMING_UP = 'COMING_UP',
  DESIGN_PRODUCTION = 'DESIGN_PRODUCTION',
  DESIGN_ONLY = 'DESIGN_ONLY',
  OUTSOURCED = 'OUTSOURCED',
  INSTALL_READY = 'INSTALL_READY',
  ON_HOLD = 'ON_HOLD',
}

/** Cell style applied to a row in the production list (col A:C) */
export enum ProductionListStyle {
  NORMAL = 'NORMAL',
  ATTENTION = 'ATTENTION', // Rush / Must Ship / Redo / Sample
  INNER_WORKINGS = 'INNER_WORKINGS', // HH Global / InnerWorkings
  MUST_SHIP = 'MUST_SHIP', // Yellow-highlighted, reached Must Ship date
}

/** Printing station codes used in the Excel sub-lists (col J) */
export enum ProductionListPrintStation {
  RR = 'RR', // Roll-to-Roll
  FB = 'FB', // Flatbed
  Z = 'Z', // Zund
}

/** Sync direction for production list integration */
export enum ProductionListSyncDirection {
  IMPORT = 'IMPORT', // Excel → ERP
  EXPORT = 'EXPORT', // ERP → Excel
  BIDIRECTIONAL = 'BIDIRECTIONAL', // Merge both
}

/** Status of a production list sync operation */
export enum ProductionListSyncStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  PARTIAL = 'PARTIAL', // Some rows synced, some failed
}

// ============ File Chain & Print-Cut Linking ============

/** Status of a print-to-cut file link */
export enum FileChainStatus {
  DESIGN = 'DESIGN', // File exists in design, not yet sent anywhere
  SENT_TO_RIP = 'SENT_TO_RIP', // Sent to RIP hotfolder
  RIPPING = 'RIPPING', // RIP is processing
  READY_TO_PRINT = 'READY_TO_PRINT', // RIP done, queued for printer
  PRINTING = 'PRINTING', // Currently printing
  PRINTED = 'PRINTED', // Print complete
  CUT_PENDING = 'CUT_PENDING', // Has a cut file queued/waiting
  CUTTING = 'CUTTING', // Zund is actively cutting
  CUT_COMPLETE = 'CUT_COMPLETE', // Cut complete
  FINISHED = 'FINISHED', // Print+cut both done, entering finishing
  FAILED = 'FAILED', // Error at any stage
}

/** How a cut file was linked to its print file */
export enum LinkConfidence {
  EXACT = 'EXACT', // WO# + filename exact match
  HIGH = 'HIGH', // WO# match + customer match
  MEDIUM = 'MEDIUM', // WO# match only
  PARTIAL = 'PARTIAL', // Substring/normalized match
  NESTING = 'NESTING', // Nesting pattern detected
  MANUAL = 'MANUAL', // Manually linked by operator
  NONE = 'NONE', // Auto-detected, low confidence
}

/** Source system that generated the cut file */
export enum CutFileSource {
  THRIVE = 'THRIVE', // Thrive Onyx Cut Center XML
  FIERY = 'FIERY', // EFI Fiery .zcc contour file
  MANUAL = 'MANUAL', // Manually imported cut file
  ZUND_CENTER = 'ZUND_CENTER', // Created in Zund Cut Center directly
}

/** Type of production file */
export enum ProductionFileType {
  DESIGN_SOURCE = 'DESIGN_SOURCE', // .ai, .psd, .indd source files
  PRINT_READY = 'PRINT_READY', // Print-ready PDF/TIFF
  RIP_OUTPUT = 'RIP_OUTPUT', // RIP raster output (RTL, etc.)
  CUT_FILE = 'CUT_FILE', // .zcc, .xml, .dxf cut files
  PROOF = 'PROOF', // Customer proof PDF/image
  PHOTO = 'PHOTO', // Install/QC photos
  SHIPPING_LABEL = 'SHIPPING_LABEL', // Shipping label PDF/ZPL
}

/** Station types for the Shop Floor app */
export enum ShopFloorStation {
  DESIGN = 'DESIGN',
  PRINTING = 'PRINTING',
  PRODUCTION = 'PRODUCTION', // Zund/finishing
  SHIPPING = 'SHIPPING',
  INSTALLATION = 'INSTALLATION',
  ORDER_ENTRY = 'ORDER_ENTRY',
}
