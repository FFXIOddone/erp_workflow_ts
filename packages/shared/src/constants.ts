// Constants shared across the application

export const STATION_DISPLAY_NAMES: Record<string, string> = {
  ROLL_TO_ROLL: 'Roll to Roll',
  SCREEN_PRINT: 'Screen Print',
  PRODUCTION: 'Production',
  FLATBED: 'Flatbed',
  DESIGN: 'Design',
  SALES: 'Sales',
  INSTALLATION: 'Installation',
  ORDER_ENTRY: 'Order Entry',
  SHIPPING_RECEIVING: 'Shipping & Receiving',
  // Sub-stations
  FLATBED_PRINTING: 'Flatbed Printing',
  ROLL_TO_ROLL_PRINTING: 'Roll to Roll Printing',
  PRODUCTION_ZUND: 'Zund Cutting',
  PRODUCTION_FINISHING: 'Finishing',
  SHIPPING_QC: 'Quality Check',
  SHIPPING_PACKAGING: 'Packaging',
};

/** Maps sub-stations to their parent station */
export const SUB_STATION_PARENTS: Record<string, string> = {
  FLATBED_PRINTING: 'FLATBED',
  ROLL_TO_ROLL_PRINTING: 'ROLL_TO_ROLL',
  PRODUCTION_ZUND: 'PRODUCTION',
  PRODUCTION_FINISHING: 'PRODUCTION',
  SHIPPING_QC: 'SHIPPING_RECEIVING',
  SHIPPING_PACKAGING: 'SHIPPING_RECEIVING',
};

/** Maps parent stations to their sub-stations */
export const PARENT_SUB_STATIONS: Record<string, string[]> = {
  FLATBED: ['FLATBED_PRINTING'],
  ROLL_TO_ROLL: ['ROLL_TO_ROLL_PRINTING'],
  PRODUCTION: ['PRODUCTION_ZUND', 'PRODUCTION_FINISHING'],
  SHIPPING_RECEIVING: ['SHIPPING_QC', 'SHIPPING_PACKAGING'],
};

export const STATUS_DISPLAY_NAMES: Record<string, string> = {
  PENDING: 'Pending',
  IN_PROGRESS: 'In Progress',
  ON_HOLD: 'On Hold',
  COMPLETED: 'Completed',
  SHIPPED: 'Shipped',
  CANCELLED: 'Cancelled',
};

export const STATUS_COLORS: Record<string, string> = {
  PENDING: '#f59e0b',      // amber
  IN_PROGRESS: '#3b82f6',  // blue
  ON_HOLD: '#ef4444',      // red
  COMPLETED: '#22c55e',    // green
  SHIPPED: '#8b5cf6',      // purple
  CANCELLED: '#6b7280',    // gray
};

export const PRIORITY_LABELS: Record<number, string> = {
  1: 'Lowest',
  2: 'Low',
  3: 'Normal',
  4: 'High',
  5: 'Urgent',
};

export const PRIORITY_COLORS: Record<number, string> = {
  1: '#6b7280',  // gray
  2: '#3b82f6',  // blue
  3: '#22c55e',  // green
  4: '#f59e0b',  // amber
  5: '#ef4444',  // red
};

// Company Brand Display Names
export const COMPANY_BRAND_DISPLAY_NAMES: Record<string, string> = {
  WILDE_SIGNS: 'Wilde Signs',
  PORT_CITY_SIGNS: 'Port City Signs',
};

export const COMPANY_BRAND_COLORS: Record<string, string> = {
  WILDE_SIGNS: '#1e40af',   // blue
  PORT_CITY_SIGNS: '#15803d',  // green
};

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const API_VERSION = 'v1';
export const API_BASE_PATH = `/api/${API_VERSION}`;

// Quote Status Display Names
export const QUOTE_STATUS_DISPLAY_NAMES: Record<string, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  EXPIRED: 'Expired',
  CONVERTED: 'Converted',
};

export const QUOTE_STATUS_COLORS: Record<string, string> = {
  DRAFT: '#6b7280',      // gray
  SENT: '#3b82f6',       // blue
  APPROVED: '#22c55e',   // green
  REJECTED: '#ef4444',   // red
  EXPIRED: '#f59e0b',    // amber
  CONVERTED: '#8b5cf6',  // purple
};

// Purchase Order Status Display Names
export const PO_STATUS_DISPLAY_NAMES: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  CONFIRMED: 'Confirmed',
  PARTIAL: 'Partially Received',
  RECEIVED: 'Received',
  CANCELLED: 'Cancelled',
};

export const PO_STATUS_COLORS: Record<string, string> = {
  DRAFT: '#6b7280',      // gray
  SUBMITTED: '#3b82f6',  // blue
  CONFIRMED: '#22c55e',  // green
  PARTIAL: '#f59e0b',    // amber
  RECEIVED: '#8b5cf6',   // purple
  CANCELLED: '#ef4444',  // red
};

// Carrier Display Names
export const CARRIER_DISPLAY_NAMES: Record<string, string> = {
  UPS: 'UPS',
  FEDEX: 'FedEx',
  USPS: 'USPS',
  DHL: 'DHL',
  FREIGHT: 'Freight',
  CUSTOMER_PICKUP: 'Customer Pickup',
  OWN_DELIVERY: 'Own Delivery',
  OTHER: 'Other',
};

// Shipment Status Display Names
export const SHIPMENT_STATUS_DISPLAY_NAMES: Record<string, string> = {
  PENDING: 'Pending',
  PICKED_UP: 'Picked Up',
  IN_TRANSIT: 'In Transit',
  DELIVERED: 'Delivered',
  EXCEPTION: 'Exception',
};

export const SHIPMENT_STATUS_COLORS: Record<string, string> = {
  PENDING: '#6b7280',    // gray
  PICKED_UP: '#3b82f6',  // blue
  IN_TRANSIT: '#f59e0b', // amber
  DELIVERED: '#22c55e',  // green
  EXCEPTION: '#ef4444',  // red
};

// Material Unit Display Names
export const MATERIAL_UNIT_DISPLAY_NAMES: Record<string, string> = {
  EACH: 'Each',
  SQFT: 'Sq Ft',
  SQIN: 'Sq In',
  SQYD: 'Sq Yd',
  SQMETER: 'Sq M',
  LINEARFT: 'Linear Ft',
  LINEARYD: 'Linear Yd',
  LINEARMETER: 'Linear M',
  ROLL: 'Roll',
  SHEET: 'Sheet',
  GAL: 'Gallon',
  QT: 'Quart',
  OZ: 'Oz',
  LB: 'Lb',
  KG: 'Kg',
  BOX: 'Box',
  CASE: 'Case',
  PACK: 'Pack',
};

// Default labor rate for job costing
export const DEFAULT_LABOR_RATE = 50.00;

// Default overhead percentage for job costing
export const DEFAULT_OVERHEAD_PERCENT = 15.00;

// ============ Quality Control Constants ============

// QC Status Display Names
export const QC_STATUS_DISPLAY_NAMES: Record<string, string> = {
  PENDING: 'Pending',
  IN_PROGRESS: 'In Progress',
  PASSED: 'Passed',
  FAILED: 'Failed',
  PASSED_WITH_NOTES: 'Passed with Notes',
};

export const QC_STATUS_COLORS: Record<string, string> = {
  PENDING: '#6b7280',         // gray
  IN_PROGRESS: '#3b82f6',     // blue
  PASSED: '#22c55e',          // green
  FAILED: '#ef4444',          // red
  PASSED_WITH_NOTES: '#f59e0b', // amber
};

// ============ Equipment / Asset Management Constants ============

// Equipment Status Display Names (extended for routing intelligence)
export const EQUIPMENT_STATUS_DISPLAY_NAMES: Record<string, string> = {
  OPERATIONAL: 'Operational',
  DEGRADED: 'Degraded',
  MAINTENANCE: 'Maintenance',
  DOWN: 'Down',
  WARMING_UP: 'Warming Up',
  OFFLINE: 'Offline',
  RETIRED: 'Retired',
};

export const EQUIPMENT_STATUS_COLORS: Record<string, string> = {
  OPERATIONAL: '#22c55e',     // green
  DEGRADED: '#f59e0b',        // amber
  MAINTENANCE: '#3b82f6',     // blue
  DOWN: '#ef4444',            // red
  WARMING_UP: '#f97316',      // orange
  OFFLINE: '#6b7280',         // gray
  RETIRED: '#6b7280',         // gray
};

// Maintenance Frequency Display Names
export const MAINTENANCE_FREQUENCY_DISPLAY_NAMES: Record<string, string> = {
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  BIWEEKLY: 'Bi-weekly',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  BIANNUALLY: 'Bi-annually',
  YEARLY: 'Yearly',
  CUSTOM: 'Custom',
};

// Downtime Reason Display Names
export const DOWNTIME_REASON_DISPLAY_NAMES: Record<string, string> = {
  BREAKDOWN: 'Breakdown',
  MAINTENANCE: 'Scheduled Maintenance',
  PARTS_SHORTAGE: 'Parts Shortage',
  OPERATOR_ERROR: 'Operator Error',
  POWER_OUTAGE: 'Power Outage',
  CALIBRATION: 'Calibration',
  SOFTWARE_ISSUE: 'Software Issue',
  OTHER: 'Other',
};

export const DOWNTIME_REASON_COLORS: Record<string, string> = {
  BREAKDOWN: '#ef4444',       // red
  MAINTENANCE: '#3b82f6',     // blue
  PARTS_SHORTAGE: '#f59e0b',  // amber
  OPERATOR_ERROR: '#f97316',  // orange
  POWER_OUTAGE: '#8b5cf6',    // purple
  CALIBRATION: '#06b6d4',     // cyan
  SOFTWARE_ISSUE: '#ec4899',  // pink
  OTHER: '#6b7280',           // gray
};

// Impact Level Display Names
export const IMPACT_LEVEL_DISPLAY_NAMES: Record<string, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
};

export const IMPACT_LEVEL_COLORS: Record<string, string> = {
  LOW: '#22c55e',             // green
  MEDIUM: '#f59e0b',          // amber
  HIGH: '#f97316',            // orange
  CRITICAL: '#ef4444',        // red
};

// Equipment Type Suggestions
export const EQUIPMENT_TYPES = [
  'Large Format Printer',
  'Flatbed Printer',
  'Vinyl Cutter',
  'CNC Router',
  'Laminator',
  'Welder',
  'Brake',
  'Saw',
  'Compressor',
  'Heat Press',
  'Laser Cutter',
  'Other',
];

// ============ Customer Interaction Constants ============

export const INTERACTION_TYPE_DISPLAY_NAMES: Record<string, string> = {
  CALL: 'Phone Call',
  EMAIL: 'Email',
  MEETING: 'Meeting',
  NOTE: 'Note',
  QUOTE_SENT: 'Quote Sent',
  QUOTE_FOLLOWUP: 'Quote Follow-up',
  SITE_VISIT: 'Site Visit',
  OTHER: 'Other',
};

export const INTERACTION_TYPE_COLORS: Record<string, string> = {
  CALL: '#3b82f6',           // blue
  EMAIL: '#8b5cf6',          // purple
  MEETING: '#22c55e',        // green
  NOTE: '#6b7280',           // gray
  QUOTE_SENT: '#f59e0b',     // amber
  QUOTE_FOLLOWUP: '#f97316', // orange
  SITE_VISIT: '#06b6d4',     // cyan
  OTHER: '#64748b',          // slate
};

export const INTERACTION_TYPE_ICONS: Record<string, string> = {
  CALL: 'phone',
  EMAIL: 'mail',
  MEETING: 'users',
  NOTE: 'file-text',
  QUOTE_SENT: 'send',
  QUOTE_FOLLOWUP: 'refresh-cw',
  SITE_VISIT: 'map-pin',
  OTHER: 'more-horizontal',
};

// ============ Customer Portal Constants ============

export const PROOF_STATUS_DISPLAY_NAMES: Record<string, string> = {
  PENDING: 'Awaiting Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CHANGES_REQUESTED: 'Changes Requested',
  EXPIRED: 'Expired',
};

export const PROOF_STATUS_COLORS: Record<string, string> = {
  PENDING: '#f59e0b',           // amber
  APPROVED: '#22c55e',          // green
  REJECTED: '#ef4444',          // red
  CHANGES_REQUESTED: '#3b82f6', // blue
  EXPIRED: '#6b7280',           // gray
};

// Customer-friendly order status descriptions
export const ORDER_STATUS_CUSTOMER_DESCRIPTIONS: Record<string, string> = {
  PENDING: 'Your order is in our queue and will begin production soon.',
  IN_PROGRESS: 'Your order is currently being produced.',
  ON_HOLD: 'Your order is on hold. Please contact us for more information.',
  COMPLETED: 'Your order has been completed and is ready for pickup or shipping.',
  SHIPPED: 'Your order has been shipped! Check the tracking information below.',
  CANCELLED: 'This order has been cancelled.',
};
// ============ Credit & Payment Terms Constants ============

export const CREDIT_APPROVAL_STATUS_DISPLAY_NAMES: Record<string, string> = {
  PENDING: 'Pending Approval',
  APPROVED: 'Approved',
  DENIED: 'Denied',
};

export const CREDIT_APPROVAL_STATUS_COLORS: Record<string, string> = {
  PENDING: '#f59e0b',  // amber
  APPROVED: '#22c55e', // green
  DENIED: '#ef4444',   // red
};

export const PAYMENT_TERMS_DISPLAY: Record<string, string> = {
  COD: 'Cash on Delivery',
  'Net 7': 'Net 7 Days',
  'Net 15': 'Net 15 Days',
  'Net 30': 'Net 30 Days',
  'Net 45': 'Net 45 Days',
  'Net 60': 'Net 60 Days',
  'Net 90': 'Net 90 Days',
  'Due on Receipt': 'Due on Receipt',
  '50% Deposit': '50% Deposit Required',
  'Prepaid': 'Prepaid',
};

// ============ Subcontractor Constants ============

export const SUBCONTRACTOR_SERVICE_DISPLAY_NAMES: Record<string, string> = {
  ELECTRICAL: 'Electrical',
  INSTALLATION: 'Installation',
  WELDING: 'Welding',
  PAINTING: 'Painting',
  PERMITTING: 'Permitting',
  CRANE_SERVICE: 'Crane Service',
  FABRICATION: 'Fabrication',
  CNC_ROUTING: 'CNC Routing',
  POWDER_COATING: 'Powder Coating',
  OTHER: 'Other',
};

export const SUBCONTRACT_STATUS_DISPLAY_NAMES: Record<string, string> = {
  PENDING: 'Pending',
  SCHEDULED: 'Scheduled',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  INVOICED: 'Invoiced',
  PAID: 'Paid',
  CANCELLED: 'Cancelled',
};

export const SUBCONTRACT_STATUS_COLORS: Record<string, string> = {
  PENDING: '#6b7280',     // gray
  SCHEDULED: '#3b82f6',   // blue
  IN_PROGRESS: '#f59e0b', // amber
  COMPLETED: '#22c55e',   // green
  INVOICED: '#8b5cf6',    // purple
  PAID: '#10b981',        // emerald
  CANCELLED: '#ef4444',   // red
};

export const RATE_TYPE_DISPLAY_NAMES: Record<string, string> = {
  HOURLY: 'Per Hour',
  FIXED: 'Fixed Price',
  PER_UNIT: 'Per Unit',
  PER_SQFT: 'Per Sq Ft',
};

// Document Category Display Names
export const DOCUMENT_CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  DESIGN_FILE: 'Design File',
  PROOF: 'Proof',
  CONTRACT: 'Contract',
  LOGO: 'Logo',
  BRAND_GUIDE: 'Brand Guide',
  INVOICE: 'Invoice',
  PURCHASE_ORDER: 'Purchase Order',
  DELIVERY_RECEIPT: 'Delivery Receipt',
  PHOTO: 'Photo',
  INSURANCE: 'Insurance',
  LICENSE: 'License',
  W9: 'W-9',
  QUOTE: 'Quote',
  SPECIFICATION: 'Specification',
  OTHER: 'Other',
};

// Document Category Colors (for badges)
export const DOCUMENT_CATEGORY_COLORS: Record<string, string> = {
  DESIGN_FILE: '#8b5cf6',    // purple
  PROOF: '#f59e0b',          // amber
  CONTRACT: '#3b82f6',       // blue
  LOGO: '#ec4899',           // pink
  BRAND_GUIDE: '#14b8a6',    // teal
  INVOICE: '#22c55e',        // green
  PURCHASE_ORDER: '#6366f1', // indigo
  DELIVERY_RECEIPT: '#84cc16', // lime
  PHOTO: '#06b6d4',          // cyan
  INSURANCE: '#f97316',      // orange
  LICENSE: '#a855f7',        // violet
  W9: '#64748b',             // slate
  QUOTE: '#0ea5e9',          // sky
  SPECIFICATION: '#78716c',  // stone
  OTHER: '#6b7280',          // gray
};

// File type icons mapping
export const FILE_TYPE_ICONS: Record<string, string> = {
  pdf: 'FileText',
  doc: 'FileText',
  docx: 'FileText',
  xls: 'FileSpreadsheet',
  xlsx: 'FileSpreadsheet',
  ppt: 'Presentation',
  pptx: 'Presentation',
  ai: 'Image',
  psd: 'Image',
  eps: 'Image',
  svg: 'Image',
  jpg: 'Image',
  jpeg: 'Image',
  png: 'Image',
  gif: 'Image',
  tiff: 'Image',
  zip: 'Archive',
  rar: 'Archive',
  default: 'File',
};

// ============ Recurring Orders Constants ============

export const RECURRING_FREQUENCY_DISPLAY_NAMES: Record<string, string> = {
  WEEKLY: 'Weekly',
  BIWEEKLY: 'Every 2 Weeks',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  SEMIANNUALLY: 'Every 6 Months',
  YEARLY: 'Yearly',
  CUSTOM: 'Custom',
};

export const RECURRING_FREQUENCY_COLORS: Record<string, string> = {
  WEEKLY: '#ef4444',       // red (high frequency)
  BIWEEKLY: '#f97316',     // orange
  MONTHLY: '#f59e0b',      // amber
  QUARTERLY: '#22c55e',    // green
  SEMIANNUALLY: '#3b82f6', // blue
  YEARLY: '#8b5cf6',       // purple
  CUSTOM: '#6b7280',       // gray
};

export const RECURRING_ACTION_DISPLAY_NAMES: Record<string, string> = {
  CREATED: 'Created',
  UPDATED: 'Updated',
  PAUSED: 'Paused',
  RESUMED: 'Resumed',
  CANCELLED: 'Cancelled',
  ORDER_GENERATED: 'Order Generated',
  GENERATION_FAILED: 'Generation Failed',
  NOTIFICATION_SENT: 'Notification Sent',
  SKIPPED: 'Skipped',
};

// ============ Alert System Constants ============

export const ALERT_TYPE_DISPLAY_NAMES: Record<string, string> = {
  INVENTORY_LOW: 'Low Inventory',
  EQUIPMENT_MAINTENANCE: 'Equipment Maintenance',
  ORDER_DEADLINE: 'Order Deadline',
  PAYMENT_OVERDUE: 'Payment Overdue',
  APPROVAL_NEEDED: 'Approval Needed',
  SYSTEM_ERROR: 'System Error',
  CAPACITY_WARNING: 'Capacity Warning',
  QUALITY_ISSUE: 'Quality Issue',
  SCHEDULE_CONFLICT: 'Schedule Conflict',
  CUSTOM: 'Custom Alert',
};

export const ALERT_TYPE_COLORS: Record<string, string> = {
  INVENTORY_LOW: '#f59e0b',        // amber
  EQUIPMENT_MAINTENANCE: '#3b82f6', // blue
  ORDER_DEADLINE: '#ef4444',        // red
  PAYMENT_OVERDUE: '#dc2626',       // red-600
  APPROVAL_NEEDED: '#8b5cf6',       // purple
  SYSTEM_ERROR: '#ef4444',          // red
  CAPACITY_WARNING: '#f97316',      // orange
  QUALITY_ISSUE: '#ec4899',         // pink
  SCHEDULE_CONFLICT: '#6366f1',     // indigo
  CUSTOM: '#6b7280',                // gray
};

export const ALERT_TYPE_ICONS: Record<string, string> = {
  INVENTORY_LOW: 'package',
  EQUIPMENT_MAINTENANCE: 'tool',
  ORDER_DEADLINE: 'clock',
  PAYMENT_OVERDUE: 'dollar-sign',
  APPROVAL_NEEDED: 'check-circle',
  SYSTEM_ERROR: 'alert-triangle',
  CAPACITY_WARNING: 'trending-up',
  QUALITY_ISSUE: 'alert-octagon',
  SCHEDULE_CONFLICT: 'calendar',
  CUSTOM: 'bell',
};

export const ALERT_SEVERITY_DISPLAY_NAMES: Record<string, string> = {
  INFO: 'Info',
  WARNING: 'Warning',
  CRITICAL: 'Critical',
  URGENT: 'Urgent',
};

export const ALERT_SEVERITY_COLORS: Record<string, string> = {
  INFO: '#3b82f6',      // blue
  WARNING: '#f59e0b',   // amber
  CRITICAL: '#ef4444',  // red
  URGENT: '#dc2626',    // red-600 (darker red)
};

export const ALERT_TRIGGER_TYPE_DISPLAY_NAMES: Record<string, string> = {
  THRESHOLD: 'Threshold',
  SCHEDULE: 'Schedule',
  EVENT: 'Event',
  MANUAL: 'Manual',
};

// ============ Integration System Constants ============

export const INTEGRATION_TYPE_DISPLAY_NAMES: Record<string, string> = {
  WOOCOMMERCE: 'WooCommerce',
  QUICKBOOKS_DESKTOP: 'QuickBooks Desktop',
  QUICKBOOKS_ONLINE: 'QuickBooks Online',
  XERO: 'Xero',
  SALESFORCE: 'Salesforce',
  HUBSPOT: 'HubSpot',
  MAILCHIMP: 'Mailchimp',
  SENDGRID: 'SendGrid',
  TWILIO: 'Twilio',
  STRIPE: 'Stripe',
  SQUARE: 'Square',
  SHOPIFY: 'Shopify',
  GOOGLE_CALENDAR: 'Google Calendar',
  MICROSOFT_365: 'Microsoft 365',
  SLACK: 'Slack',
  WEBHOOK: 'Webhook',
  CUSTOM: 'Custom',
};

export const INTEGRATION_TYPE_ICONS: Record<string, string> = {
  WOOCOMMERCE: 'shopping-cart',
  QUICKBOOKS_DESKTOP: 'calculator',
  QUICKBOOKS_ONLINE: 'cloud',
  XERO: 'dollar-sign',
  SALESFORCE: 'users',
  HUBSPOT: 'target',
  MAILCHIMP: 'mail',
  SENDGRID: 'send',
  TWILIO: 'phone',
  STRIPE: 'credit-card',
  SQUARE: 'square',
  SHOPIFY: 'shopping-bag',
  GOOGLE_CALENDAR: 'calendar',
  MICROSOFT_365: 'grid',
  SLACK: 'message-square',
  WEBHOOK: 'link',
  CUSTOM: 'settings',
};

export const INTEGRATION_STATUS_DISPLAY_NAMES: Record<string, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  ERROR: 'Error',
  PENDING_SETUP: 'Pending Setup',
  EXPIRED: 'Expired',
};

export const INTEGRATION_STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#22c55e',       // green
  INACTIVE: '#6b7280',     // gray
  ERROR: '#ef4444',        // red
  PENDING_SETUP: '#f59e0b', // amber
  EXPIRED: '#f97316',      // orange
};

export const CREDENTIAL_TYPE_DISPLAY_NAMES: Record<string, string> = {
  API_KEY: 'API Key',
  OAUTH2: 'OAuth 2.0',
  BASIC_AUTH: 'Basic Auth',
  BEARER_TOKEN: 'Bearer Token',
  CERTIFICATE: 'Certificate',
  CUSTOM: 'Custom',
};

export const SYNC_TYPE_DISPLAY_NAMES: Record<string, string> = {
  ORDERS: 'Orders',
  CUSTOMERS: 'Customers',
  PRODUCTS: 'Products',
  INVOICES: 'Invoices',
  PAYMENTS: 'Payments',
  INVENTORY: 'Inventory',
  ALL: 'All Data',
};

export const SYNC_DIRECTION_DISPLAY_NAMES: Record<string, string> = {
  IMPORT: 'Import',
  EXPORT: 'Export',
  BIDIRECTIONAL: 'Bidirectional',
};

export const SYNC_DIRECTION_ICONS: Record<string, string> = {
  IMPORT: 'download',
  EXPORT: 'upload',
  BIDIRECTIONAL: 'refresh-cw',
};

export const SYNC_STATUS_DISPLAY_NAMES: Record<string, string> = {
  SUCCESS: 'Success',
  PARTIAL: 'Partial',
  FAILED: 'Failed',
  IN_PROGRESS: 'In Progress',
  CANCELLED: 'Cancelled',
};

export const SYNC_STATUS_COLORS: Record<string, string> = {
  SUCCESS: '#22c55e',     // green
  PARTIAL: '#f59e0b',     // amber
  FAILED: '#ef4444',      // red
  IN_PROGRESS: '#3b82f6', // blue
  CANCELLED: '#6b7280',   // gray
};

// ============ Filter System Constants ============

export const FILTER_ENTITY_TYPE_DISPLAY_NAMES: Record<string, string> = {
  WORK_ORDER: 'Work Orders',
  CUSTOMER: 'Customers',
  QUOTE: 'Quotes',
  INVOICE: 'Invoices',
  PURCHASE_ORDER: 'Purchase Orders',
  INVENTORY: 'Inventory',
  EQUIPMENT: 'Equipment',
  EMPLOYEE: 'Employees',
  VENDOR: 'Vendors',
  SHIPMENT: 'Shipments',
  SUBCONTRACTOR: 'Subcontractors',
};

// ============ Audit System Constants ============

export const AUDIT_ENTITY_TYPE_DISPLAY_NAMES: Record<string, string> = {
  WORK_ORDER: 'Work Order',
  CUSTOMER: 'Customer',
  QUOTE: 'Quote',
  INVOICE: 'Invoice',
  PAYMENT: 'Payment',
  PURCHASE_ORDER: 'Purchase Order',
  INVENTORY_ITEM: 'Inventory Item',
  EQUIPMENT: 'Equipment',
  USER: 'User',
  EMPLOYEE: 'Employee',
  VENDOR: 'Vendor',
  SUBCONTRACTOR: 'Subcontractor',
  SHIPMENT: 'Shipment',
  PROOF: 'Proof',
  DOCUMENT: 'Document',
  INTEGRATION: 'Integration',
  ALERT_RULE: 'Alert Rule',
  PRINT_QUEUE: 'Print Queue',
};

export const AUDIT_ACTION_DISPLAY_NAMES: Record<string, string> = {
  CREATE: 'Created',
  UPDATE: 'Updated',
  DELETE: 'Deleted',
  RESTORE: 'Restored',
  ARCHIVE: 'Archived',
  STATUS_CHANGE: 'Status Changed',
  APPROVAL: 'Approved',
  REJECTION: 'Rejected',
  ASSIGNMENT: 'Assigned',
  UNASSIGNMENT: 'Unassigned',
  COMMENT: 'Commented',
  ATTACHMENT: 'File Attached',
};

export const AUDIT_ACTION_COLORS: Record<string, string> = {
  CREATE: '#22c55e',       // green
  UPDATE: '#3b82f6',       // blue
  DELETE: '#ef4444',       // red
  RESTORE: '#8b5cf6',      // purple
  ARCHIVE: '#6b7280',      // gray
  STATUS_CHANGE: '#f59e0b', // amber
  APPROVAL: '#22c55e',     // green
  REJECTION: '#ef4444',    // red
  ASSIGNMENT: '#06b6d4',   // cyan
  UNASSIGNMENT: '#64748b', // slate
  COMMENT: '#8b5cf6',      // purple
  ATTACHMENT: '#f97316',   // orange
};

export const AUDIT_ACTION_ICONS: Record<string, string> = {
  CREATE: 'plus-circle',
  UPDATE: 'edit',
  DELETE: 'trash-2',
  RESTORE: 'rotate-ccw',
  ARCHIVE: 'archive',
  STATUS_CHANGE: 'refresh-cw',
  APPROVAL: 'check-circle',
  REJECTION: 'x-circle',
  ASSIGNMENT: 'user-plus',
  UNASSIGNMENT: 'user-minus',
  COMMENT: 'message-circle',
  ATTACHMENT: 'paperclip',
};

export const CHANGE_SOURCE_DISPLAY_NAMES: Record<string, string> = {
  WEB_UI: 'Web Interface',
  PORTAL: 'Customer Portal',
  API: 'API',
  WEBHOOK: 'Webhook',
  SYNC: 'Sync',
  IMPORT: 'Import',
  SYSTEM: 'System',
  MIGRATION: 'Migration',
};

export const CHANGE_SOURCE_ICONS: Record<string, string> = {
  WEB_UI: 'monitor',
  PORTAL: 'globe',
  API: 'code',
  WEBHOOK: 'link',
  SYNC: 'refresh-cw',
  IMPORT: 'upload',
  SYSTEM: 'server',
  MIGRATION: 'database',
};

// ============ Print Queue System Constants ============

export const PRINT_JOB_STATUS_DISPLAY_NAMES: Record<string, string> = {
  PENDING: 'Pending',
  QUEUED: 'Queued',
  IN_PROGRESS: 'In Progress',
  PRINTING: 'Printing',
  PAUSED: 'Paused',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
  ON_HOLD: 'On Hold',
  RIPPING: 'RIP Processing',
  RIP_FAILED: 'RIP Failed',
  REPRINTING: 'Reprinting',
};

export const PRINT_JOB_STATUS_COLORS: Record<string, string> = {
  PENDING: '#6b7280',     // gray
  QUEUED: '#3b82f6',      // blue
  IN_PROGRESS: '#f59e0b', // amber
  PRINTING: '#8b5cf6',    // purple
  PAUSED: '#f97316',      // orange
  COMPLETED: '#22c55e',   // green
  FAILED: '#ef4444',      // red
  CANCELLED: '#64748b',   // slate
  ON_HOLD: '#dc2626',     // red-600
  RIPPING: '#06b6d4',     // cyan
  RIP_FAILED: '#ec4899',  // pink
  REPRINTING: '#a855f7',  // violet
};

export const PRINT_JOB_STATUS_ICONS: Record<string, string> = {
  PENDING: 'clock',
  QUEUED: 'list',
  IN_PROGRESS: 'loader',
  PRINTING: 'printer',
  PAUSED: 'pause-circle',
  COMPLETED: 'check-circle',
  FAILED: 'x-circle',
  CANCELLED: 'slash',
  ON_HOLD: 'pause',
  RIPPING: 'cpu',
  RIP_FAILED: 'alert-triangle',
  REPRINTING: 'repeat',
};

// ============ RIP Job Constants ============

export const RIP_JOB_STATUS_DISPLAY_NAMES: Record<string, string> = {
  QUEUED: 'In Queue',
  PROCESSING: 'RIP Processing',
  READY: 'Ready to Print',
  SENDING: 'Sending to Printer',
  PRINTING: 'Printing',
  PRINTED: 'Printed',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
};

export const RIP_JOB_STATUS_COLORS: Record<string, string> = {
  QUEUED: '#6b7280',      // gray
  PROCESSING: '#06b6d4',  // cyan
  READY: '#3b82f6',       // blue
  SENDING: '#f59e0b',     // amber
  PRINTING: '#8b5cf6',    // purple
  PRINTED: '#22c55e',     // green
  COMPLETED: '#10b981',   // emerald
  FAILED: '#ef4444',      // red
  CANCELLED: '#64748b',   // slate
};

export const RIP_TYPE_DISPLAY_NAMES: Record<string, string> = {
  Onyx: 'Onyx Thrive',
  Fiery: 'EFI Fiery',
  Flexi: 'FlexiSIGN',
  Caldera: 'Caldera',
  VersaWorks: 'VersaWorks',
  Wasatch: 'Wasatch SoftRIP',
  Other: 'Other',
};

export const WHITE_INK_OPTIONS = ['None', 'Underflood', 'Overflood', 'Spot'] as const;

export const PRINT_MODE_OPTIONS = ['Draft', 'Production', 'Quality', 'Billboard', 'Backlit'] as const;

export const PRINT_RESOLUTION_OPTIONS = [
  '360x360',
  '540x720',
  '720x720',
  '1080x1080',
  '1440x720',
  '1440x1440',
] as const;

// ============ User Preference Constants ============

export const THEME_MODE_DISPLAY_NAMES: Record<string, string> = {
  LIGHT: 'Light',
  DARK: 'Dark',
  SYSTEM: 'System',
};

export const THEME_MODE_ICONS: Record<string, string> = {
  LIGHT: 'sun',
  DARK: 'moon',
  SYSTEM: 'monitor',
};

export const FONT_SIZE_DISPLAY_NAMES: Record<string, string> = {
  SMALL: 'Small',
  MEDIUM: 'Medium',
  LARGE: 'Large',
  EXTRA_LARGE: 'Extra Large',
};

export const FONT_SIZE_VALUES: Record<string, number> = {
  SMALL: 14,
  MEDIUM: 16,
  LARGE: 18,
  EXTRA_LARGE: 20,
};

export const SIDEBAR_POSITION_DISPLAY_NAMES: Record<string, string> = {
  LEFT: 'Left',
  RIGHT: 'Right',
};

export const NOTIFICATION_DIGEST_DISPLAY_NAMES: Record<string, string> = {
  INSTANT: 'Instant',
  HOURLY: 'Hourly Digest',
  DAILY: 'Daily Digest',
  WEEKLY: 'Weekly Digest',
  NONE: 'None',
};

export const TIME_FORMAT_DISPLAY_NAMES: Record<string, string> = {
  TWELVE_HOUR: '12-hour (AM/PM)',
  TWENTY_FOUR_HOUR: '24-hour',
};

export const TIMEZONE_DISPLAY_NAMES: Record<string, string> = {
  'America/New_York': 'Eastern Time (ET)',
  'America/Chicago': 'Central Time (CT)',
  'America/Denver': 'Mountain Time (MT)',
  'America/Los_Angeles': 'Pacific Time (PT)',
  'America/Anchorage': 'Alaska Time (AKT)',
  'Pacific/Honolulu': 'Hawaii Time (HST)',
  'UTC': 'UTC',
};

export const DATE_FORMAT_DISPLAY_NAMES: Record<string, string> = {
  'MM/dd/yyyy': 'MM/DD/YYYY (01/31/2026)',
  'dd/MM/yyyy': 'DD/MM/YYYY (31/01/2026)',
  'yyyy-MM-dd': 'YYYY-MM-DD (2026-01-31)',
  'MMM d, yyyy': 'Jan 31, 2026',
  'MMMM d, yyyy': 'January 31, 2026',
};

// ============ Favorites System Constants ============

export const FAVORITE_ENTITY_TYPE_DISPLAY_NAMES: Record<string, string> = {
  WORK_ORDER: 'Work Order',
  CUSTOMER: 'Customer',
  QUOTE: 'Quote',
  INVOICE: 'Invoice',
  VENDOR: 'Vendor',
  MATERIAL: 'Material',
  EQUIPMENT: 'Equipment',
  EMPLOYEE: 'Employee',
  SUBCONTRACTOR: 'Subcontractor',
  SAVED_FILTER: 'Saved Filter',
  REPORT: 'Report',
  DASHBOARD_VIEW: 'Dashboard View',
};

export const FAVORITE_ENTITY_TYPE_ICONS: Record<string, string> = {
  WORK_ORDER: 'file-text',
  CUSTOMER: 'users',
  QUOTE: 'file-plus',
  INVOICE: 'receipt',
  VENDOR: 'truck',
  MATERIAL: 'package',
  EQUIPMENT: 'tool',
  EMPLOYEE: 'user',
  SUBCONTRACTOR: 'hard-hat',
  SAVED_FILTER: 'filter',
  REPORT: 'bar-chart-2',
  DASHBOARD_VIEW: 'layout-dashboard',
};

export const FAVORITE_ENTITY_TYPE_COLORS: Record<string, string> = {
  WORK_ORDER: '#3b82f6',   // blue
  CUSTOMER: '#22c55e',     // green
  QUOTE: '#f59e0b',        // amber
  INVOICE: '#8b5cf6',      // purple
  VENDOR: '#f97316',       // orange
  MATERIAL: '#06b6d4',     // cyan
  EQUIPMENT: '#ec4899',    // pink
  EMPLOYEE: '#6366f1',     // indigo
  SUBCONTRACTOR: '#14b8a6', // teal
  SAVED_FILTER: '#64748b', // slate
  REPORT: '#0ea5e9',       // sky
  DASHBOARD_VIEW: '#a855f7', // violet
};

// Default favorite icon colors
export const DEFAULT_FAVORITE_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#0ea5e9', // sky
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#ec4899', // pink
  '#f43f5e', // rose
];

// ============ Recent Search Constants ============

export const SEARCH_TYPE_DISPLAY_NAMES: Record<string, string> = {
  GLOBAL: 'Global Search',
  ENTITY: 'Entity Search',
  QUICK_ACTION: 'Quick Action',
  FILTER: 'Filter Search',
};

export const SEARCH_TYPE_ICONS: Record<string, string> = {
  GLOBAL: 'search',
  ENTITY: 'database',
  QUICK_ACTION: 'command',
  FILTER: 'filter',
};

export const SEARCH_ENTITY_TYPE_DISPLAY_NAMES: Record<string, string> = {
  WORK_ORDER: 'Work Orders',
  CUSTOMER: 'Customers',
  QUOTE: 'Quotes',
  INVOICE: 'Invoices',
  VENDOR: 'Vendors',
  MATERIAL: 'Materials',
  EQUIPMENT: 'Equipment',
  EMPLOYEE: 'Employees',
  SUBCONTRACTOR: 'Subcontractors',
  DOCUMENT: 'Documents',
  ALL: 'All',
};

export const SEARCH_ENTITY_TYPE_ICONS: Record<string, string> = {
  WORK_ORDER: 'file-text',
  CUSTOMER: 'users',
  QUOTE: 'file-plus',
  INVOICE: 'receipt',
  VENDOR: 'truck',
  MATERIAL: 'package',
  EQUIPMENT: 'tool',
  EMPLOYEE: 'user',
  SUBCONTRACTOR: 'hard-hat',
  DOCUMENT: 'file',
  ALL: 'layers',
};

// Maximum recent searches to store per user
export const MAX_RECENT_SEARCHES = 100;

// How long to keep search history (days)
export const SEARCH_HISTORY_RETENTION_DAYS = 30;

// ============ Batch Import Constants ============

import {
  ImportJobStatus,
  ImportEntityType,
  ImportFileType,
} from './enums.js';

/** Display names for import job statuses */
export const IMPORT_JOB_STATUS_DISPLAY_NAMES: Record<ImportJobStatus, string> = {
  PENDING: 'Pending',
  VALIDATING: 'Validating',
  PROCESSING: 'Processing',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
  PARTIAL: 'Partial Success',
};

/** Colors for import job statuses */
export const IMPORT_JOB_STATUS_COLORS: Record<ImportJobStatus, string> = {
  PENDING: 'gray',
  VALIDATING: 'blue',
  PROCESSING: 'yellow',
  COMPLETED: 'green',
  FAILED: 'red',
  CANCELLED: 'gray',
  PARTIAL: 'orange',
};

/** Tailwind classes for import job status badges */
export const IMPORT_JOB_STATUS_BADGE_CLASSES: Record<ImportJobStatus, string> = {
  PENDING: 'bg-gray-100 text-gray-800',
  VALIDATING: 'bg-blue-100 text-blue-800',
  PROCESSING: 'bg-yellow-100 text-yellow-800',
  COMPLETED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-600',
  PARTIAL: 'bg-orange-100 text-orange-800',
};

/** Icons for import job statuses (lucide-react) */
export const IMPORT_JOB_STATUS_ICONS: Record<ImportJobStatus, string> = {
  PENDING: 'clock',
  VALIDATING: 'file-search',
  PROCESSING: 'loader',
  COMPLETED: 'check-circle-2',
  FAILED: 'x-circle',
  CANCELLED: 'slash',
  PARTIAL: 'alert-circle',
};

/** Display names for import entity types */
export const IMPORT_ENTITY_TYPE_DISPLAY_NAMES: Record<ImportEntityType, string> = {
  CUSTOMER: 'Customers',
  VENDOR: 'Vendors',
  MATERIAL: 'Materials',
  EMPLOYEE: 'Employees',
  EQUIPMENT: 'Equipment',
  WORK_ORDER: 'Work Orders',
  QUOTE: 'Quotes',
  INVOICE: 'Invoices',
  CONTACT: 'Contacts',
  PRICE_BOOK_ITEM: 'Price Book Items',
};

/** Icons for import entity types (lucide-react) */
export const IMPORT_ENTITY_TYPE_ICONS: Record<ImportEntityType, string> = {
  CUSTOMER: 'users',
  VENDOR: 'truck',
  MATERIAL: 'package',
  EMPLOYEE: 'user',
  EQUIPMENT: 'tool',
  WORK_ORDER: 'clipboard-list',
  QUOTE: 'file-text',
  INVOICE: 'receipt',
  CONTACT: 'contact',
  PRICE_BOOK_ITEM: 'tag',
};

/** Display names for import file types */
export const IMPORT_FILE_TYPE_DISPLAY_NAMES: Record<ImportFileType, string> = {
  CSV: 'CSV (Comma Separated)',
  XLSX: 'Excel (XLSX)',
  XLS: 'Excel (XLS)',
  JSON: 'JSON',
};

/** Icons for import file types */
export const IMPORT_FILE_TYPE_ICONS: Record<ImportFileType, string> = {
  CSV: 'file-spreadsheet',
  XLSX: 'file-spreadsheet',
  XLS: 'file-spreadsheet',
  JSON: 'file-json',
};

/** File extensions for import file types */
export const IMPORT_FILE_TYPE_EXTENSIONS: Record<ImportFileType, string[]> = {
  CSV: ['.csv'],
  XLSX: ['.xlsx'],
  XLS: ['.xls'],
  JSON: ['.json'],
};

/** MIME types for import file types */
export const IMPORT_FILE_TYPE_MIME_TYPES: Record<ImportFileType, string[]> = {
  CSV: ['text/csv', 'text/plain'],
  XLSX: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  XLS: ['application/vnd.ms-excel'],
  JSON: ['application/json'],
};

/** Maximum import file size in bytes (10 MB default) */
export const MAX_IMPORT_FILE_SIZE = 10 * 1024 * 1024;

/** Maximum rows per import job */
export const MAX_IMPORT_ROWS = 10000;

/** Default number of preview rows */
export const IMPORT_PREVIEW_ROWS = 10;

// ============ Keyboard Shortcuts Constants ============

import {
  ShortcutScope,
  ShortcutCategory,
} from './enums.js';

/** Display names for shortcut scopes */
export const SHORTCUT_SCOPE_DISPLAY_NAMES: Record<ShortcutScope, string> = {
  GLOBAL: 'Global',
  PAGE: 'Page-Specific',
  MODAL: 'Modal Only',
  FORM: 'Form Context',
};

/** Display names for shortcut categories */
export const SHORTCUT_CATEGORY_DISPLAY_NAMES: Record<ShortcutCategory, string> = {
  NAVIGATION: 'Navigation',
  ACTION: 'Actions',
  SEARCH: 'Search',
  TABLE: 'Tables',
  MODAL: 'Modals',
  EDITING: 'Editing',
  SELECTION: 'Selection',
  VIEW: 'View',
  SYSTEM: 'System',
};

/** Icons for shortcut categories (lucide-react) */
export const SHORTCUT_CATEGORY_ICONS: Record<ShortcutCategory, string> = {
  NAVIGATION: 'navigation',
  ACTION: 'play',
  SEARCH: 'search',
  TABLE: 'table',
  MODAL: 'layout',
  EDITING: 'edit',
  SELECTION: 'check-square',
  VIEW: 'eye',
  SYSTEM: 'settings',
};

/** Default keyboard shortcuts */
export const DEFAULT_KEYBOARD_SHORTCUTS = {
  // Navigation
  'navigation.orders': { key: 'g+o', label: 'Go to Orders', category: ShortcutCategory.NAVIGATION },
  'navigation.quotes': { key: 'g+q', label: 'Go to Quotes', category: ShortcutCategory.NAVIGATION },
  'navigation.customers': { key: 'g+c', label: 'Go to Customers', category: ShortcutCategory.NAVIGATION },
  'navigation.materials': { key: 'g+m', label: 'Go to Materials', category: ShortcutCategory.NAVIGATION },
  'navigation.dashboard': { key: 'g+d', label: 'Go to Dashboard', category: ShortcutCategory.NAVIGATION },
  'navigation.settings': { key: 'g+s', label: 'Go to Settings', category: ShortcutCategory.NAVIGATION },
  
  // Actions
  'action.save': { key: 'ctrl+s', label: 'Save', category: ShortcutCategory.ACTION },
  'action.new': { key: 'ctrl+n', label: 'New Item', category: ShortcutCategory.ACTION },
  'action.delete': { key: 'delete', label: 'Delete Selected', category: ShortcutCategory.ACTION },
  'action.refresh': { key: 'ctrl+r', label: 'Refresh', category: ShortcutCategory.ACTION },
  'action.print': { key: 'ctrl+p', label: 'Print', category: ShortcutCategory.ACTION },
  
  // Search
  'search.global': { key: 'ctrl+k', label: 'Global Search', category: ShortcutCategory.SEARCH },
  'search.focus': { key: '/', label: 'Focus Search', category: ShortcutCategory.SEARCH },
  'search.clear': { key: 'escape', label: 'Clear Search', category: ShortcutCategory.SEARCH },
  
  // Table
  'table.selectAll': { key: 'ctrl+a', label: 'Select All', category: ShortcutCategory.TABLE },
  'table.nextPage': { key: 'ctrl+right', label: 'Next Page', category: ShortcutCategory.TABLE },
  'table.prevPage': { key: 'ctrl+left', label: 'Previous Page', category: ShortcutCategory.TABLE },
  'table.firstRow': { key: 'home', label: 'First Row', category: ShortcutCategory.TABLE },
  'table.lastRow': { key: 'end', label: 'Last Row', category: ShortcutCategory.TABLE },
  
  // Modal
  'modal.close': { key: 'escape', label: 'Close Modal', category: ShortcutCategory.MODAL },
  'modal.confirm': { key: 'enter', label: 'Confirm', category: ShortcutCategory.MODAL },
  
  // System
  'system.help': { key: '?', label: 'Show Help', category: ShortcutCategory.SYSTEM },
  'system.shortcuts': { key: 'ctrl+/', label: 'Show Shortcuts', category: ShortcutCategory.SYSTEM },
} as const;

/** Modifier key display names */
export const MODIFIER_KEY_DISPLAY_NAMES: Record<string, string> = {
  ctrl: '⌃ Ctrl',
  alt: '⌥ Alt',
  shift: '⇧ Shift',
  meta: '⌘ Cmd',
  cmd: '⌘ Cmd',
};

/** Special key display names */
export const SPECIAL_KEY_DISPLAY_NAMES: Record<string, string> = {
  escape: 'Esc',
  enter: '↵ Enter',
  space: 'Space',
  tab: 'Tab',
  backspace: '⌫',
  delete: 'Del',
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
  home: 'Home',
  end: 'End',
  pageup: 'PgUp',
  pagedown: 'PgDn',
};

// ============ SSS-001: ML Prediction & Routing Intelligence Constants ============

import {
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
} from './enums.js';

/** Display names for prediction model types */
export const PREDICTION_MODEL_TYPE_DISPLAY_NAMES: Record<PredictionModelType, string> = {
  GRADIENT_BOOST: 'Gradient Boosting',
  NEURAL_NET: 'Neural Network',
  RANDOM_FOREST: 'Random Forest',
  LINEAR_REGRESSION: 'Linear Regression',
  RULE_BASED: 'Rule-Based',
  HYBRID: 'Hybrid Model',
};

/** Display names for optimization rule types */
export const OPTIMIZATION_RULE_TYPE_DISPLAY_NAMES: Record<OptimizationRuleType, string> = {
  ROUTING: 'Routing',
  SCHEDULING: 'Scheduling',
  BATCHING: 'Batching',
  RESOURCE: 'Resource',
  QUALITY: 'Quality',
  COST: 'Cost',
  DEADLINE: 'Deadline',
};

/** Display names for optimization categories */
export const OPTIMIZATION_CATEGORY_DISPLAY_NAMES: Record<OptimizationCategory, string> = {
  EFFICIENCY: 'Efficiency',
  COST_REDUCTION: 'Cost Reduction',
  QUALITY: 'Quality',
  CUSTOMER_SERVICE: 'Customer Service',
  RESOURCE_BALANCE: 'Resource Balance',
  SUSTAINABILITY: 'Sustainability',
};

/** Icons for optimization categories */
export const OPTIMIZATION_CATEGORY_ICONS: Record<OptimizationCategory, string> = {
  EFFICIENCY: 'zap',
  COST_REDUCTION: 'trending-down',
  QUALITY: 'award',
  CUSTOMER_SERVICE: 'heart',
  RESOURCE_BALANCE: 'scale',
  SUSTAINABILITY: 'leaf',
};

/** Badge classes for equipment status (UI specific) */
export const EQUIPMENT_STATUS_BADGE_CLASSES: Record<EquipmentStatus, string> = {
  OPERATIONAL: 'bg-green-100 text-green-800',
  DEGRADED: 'bg-yellow-100 text-yellow-800',
  MAINTENANCE: 'bg-blue-100 text-blue-800',
  DOWN: 'bg-red-100 text-red-800',
  WARMING_UP: 'bg-orange-100 text-orange-800',
  OFFLINE: 'bg-gray-100 text-gray-800',
  RETIRED: 'bg-gray-200 text-gray-600',
};

/** Display names for routing decision types */
export const ROUTING_DECISION_TYPE_DISPLAY_NAMES: Record<RoutingDecisionType, string> = {
  INITIAL: 'Initial Assignment',
  OPTIMIZATION: 'System Optimization',
  MANUAL_OVERRIDE: 'Manual Override',
  REROUTE: 'Reroute',
  SKIP_STATION: 'Skip Station',
  ADD_STATION: 'Add Station',
  REORDER: 'Reorder',
};

/** Display names for routing triggers */
export const ROUTING_TRIGGER_DISPLAY_NAMES: Record<RoutingTrigger, string> = {
  NEW_ORDER: 'New Order',
  QUEUE_IMBALANCE: 'Queue Imbalance',
  EQUIPMENT_CHANGE: 'Equipment Change',
  OPERATOR_CHANGE: 'Operator Change',
  DEADLINE_RISK: 'Deadline Risk',
  USER_REQUEST: 'User Request',
  QUALITY_ISSUE: 'Quality Issue',
  BATCH_OPPORTUNITY: 'Batch Opportunity',
  SCHEDULE_CHANGE: 'Schedule Change',
};

/** Display names for decision makers */
export const DECISION_MAKER_DISPLAY_NAMES: Record<DecisionMaker, string> = {
  SYSTEM: 'System',
  USER: 'User',
  RULE: 'Business Rule',
  ML_MODEL: 'ML Model',
};

/** Icons for decision makers */
export const DECISION_MAKER_ICONS: Record<DecisionMaker, string> = {
  SYSTEM: 'cpu',
  USER: 'user',
  RULE: 'scroll',
  ML_MODEL: 'brain',
};

/** Display names for decision outcomes */
export const DECISION_OUTCOME_DISPLAY_NAMES: Record<DecisionOutcome, string> = {
  PENDING: 'Pending',
  SUCCESS: 'Success',
  PARTIAL: 'Partial Success',
  FAILED: 'Failed',
  REVERTED: 'Reverted',
};

/** Colors for decision outcomes */
export const DECISION_OUTCOME_COLORS: Record<DecisionOutcome, string> = {
  PENDING: 'gray',
  SUCCESS: 'green',
  PARTIAL: 'yellow',
  FAILED: 'red',
  REVERTED: 'orange',
};

/** Display names for constraint types */
export const CONSTRAINT_TYPE_DISPLAY_NAMES: Record<ConstraintType, string> = {
  CAPACITY: 'Capacity',
  AVAILABILITY: 'Availability',
  DEPENDENCY: 'Dependency',
  SKILL: 'Skill',
  EQUIPMENT: 'Equipment',
  MATERIAL: 'Material',
  DEADLINE: 'Deadline',
  PREFERENCE: 'Preference',
};

/** Display names for constraint targets */
export const CONSTRAINT_TARGET_DISPLAY_NAMES: Record<ConstraintTarget, string> = {
  STATION: 'Station',
  OPERATOR: 'Operator',
  EQUIPMENT: 'Equipment',
  MATERIAL: 'Material',
  JOB_TYPE: 'Job Type',
  CUSTOMER: 'Customer',
  GLOBAL: 'Global',
};

/** Default prediction factor weights */
export const DEFAULT_PREDICTION_FACTOR_WEIGHTS = {
  queueDepth: 0.20,
  operatorSkill: 0.15,
  equipmentStatus: 0.20,
  materialMatch: 0.10,
  deadline: 0.20,
  qualityHistory: 0.10,
  setupTime: 0.05,
} as const;

/** ML Model configuration */
export const ML_MODEL_CONFIG = {
  minConfidenceThreshold: 0.7,    // Minimum confidence to auto-apply
  retrainingInterval: 7,          // Days between model retraining
  minSamplesForTraining: 100,     // Minimum historical decisions
  maxAlternatives: 5,             // Max alternative routes to suggest
  predictionCacheTTL: 300,        // Seconds to cache predictions
} as const;

// ============ SSS-008/SSS-011: NLP Query & Command Palette Constants ============

import {
  QueryIntent,
  ScheduleFrequency,
  CommandType,
  ActionCategory,
} from './enums.js';

/** Display names for query intents */
export const QUERY_INTENT_DISPLAY_NAMES: Record<QueryIntent, string> = {
  SEARCH: 'Search',
  REPORT: 'Report',
  COMPARE: 'Compare',
  AGGREGATE: 'Aggregate',
  NAVIGATE: 'Navigate',
  CREATE: 'Create',
  UPDATE: 'Update',
  DELETE: 'Delete',
  EXPORT: 'Export',
  SCHEDULE: 'Schedule',
  NOTIFY: 'Notify',
  HELP: 'Help',
};

/** Icons for query intents */
export const QUERY_INTENT_ICONS: Record<QueryIntent, string> = {
  SEARCH: 'search',
  REPORT: 'file-text',
  COMPARE: 'git-compare',
  AGGREGATE: 'calculator',
  NAVIGATE: 'arrow-right',
  CREATE: 'plus',
  UPDATE: 'edit',
  DELETE: 'trash',
  EXPORT: 'download',
  SCHEDULE: 'calendar',
  NOTIFY: 'bell',
  HELP: 'help-circle',
};

/** Display names for schedule frequencies */
export const SCHEDULE_FREQUENCY_DISPLAY_NAMES: Record<ScheduleFrequency, string> = {
  HOURLY: 'Hourly',
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  CUSTOM: 'Custom',
};

/** Display names for command types */
export const COMMAND_TYPE_DISPLAY_NAMES: Record<CommandType, string> = {
  SEARCH: 'Search',
  NAVIGATION: 'Navigation',
  ACTION: 'Action',
  NLP_QUERY: 'Smart Query',
  SHORTCUT: 'Shortcut',
  RECENT: 'Recent',
};

/** Icons for command types */
export const COMMAND_TYPE_ICONS: Record<CommandType, string> = {
  SEARCH: 'search',
  NAVIGATION: 'arrow-right',
  ACTION: 'zap',
  NLP_QUERY: 'sparkles',
  SHORTCUT: 'command',
  RECENT: 'clock',
};

/** Display names for action categories */
export const ACTION_CATEGORY_DISPLAY_NAMES: Record<ActionCategory, string> = {
  CREATE: 'Create',
  NAVIGATION: 'Navigation',
  WORKFLOW: 'Workflow',
  REPORT: 'Reports',
  COMMUNICATION: 'Communication',
  SETTINGS: 'Settings',
  TOOLS: 'Tools',
};

/** Icons for action categories */
export const ACTION_CATEGORY_ICONS: Record<ActionCategory, string> = {
  CREATE: 'plus-circle',
  NAVIGATION: 'compass',
  WORKFLOW: 'git-branch',
  REPORT: 'bar-chart',
  COMMUNICATION: 'mail',
  SETTINGS: 'settings',
  TOOLS: 'wrench',
};

/** NLP parsing configuration */
export const NLP_CONFIG = {
  minConfidenceThreshold: 0.6,    // Minimum confidence to auto-execute
  maxSuggestions: 5,              // Max autocomplete suggestions
  maxHistoryItems: 50,            // Max command history per user
  searchDebounceMs: 150,          // Debounce for search input
  maxQueryLength: 500,            // Max characters in query
} as const;

/** Common NLP query patterns (for display/help) */
export const NLP_QUERY_EXAMPLES = [
  'show me overdue orders',
  'orders for Acme Corp',
  'revenue this month vs last month',
  'top 10 customers by order count',
  'pending quotes over $5000',
  'orders at flatbed station',
  'create new quote',
  'go to order W12345',
  'export orders from last week',
] as const;

/** Default quick actions (seeded in database) */
export const DEFAULT_QUICK_ACTIONS = [
  { code: 'create_order', name: 'Create Work Order', category: 'CREATE', icon: 'file-plus', shortcut: 'alt+n' },
  { code: 'create_quote', name: 'Create Quote', category: 'CREATE', icon: 'file-text', shortcut: 'alt+q' },
  { code: 'create_customer', name: 'Create Customer', category: 'CREATE', icon: 'user-plus', shortcut: 'alt+c' },
  { code: 'go_dashboard', name: 'Go to Dashboard', category: 'NAVIGATION', icon: 'layout-dashboard' },
  { code: 'go_orders', name: 'Go to Orders', category: 'NAVIGATION', icon: 'clipboard-list' },
  { code: 'go_schedule', name: 'Go to Schedule', category: 'NAVIGATION', icon: 'calendar' },
  { code: 'run_report', name: 'Run Report', category: 'REPORT', icon: 'bar-chart' },
  { code: 'send_notification', name: 'Send Notification', category: 'COMMUNICATION', icon: 'bell' },
] as const;

// ============ SSS-015: Integration Automation Platform Constants ============

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

/** Display names for workflow categories */
export const WORKFLOW_CATEGORY_DISPLAY_NAMES: Record<WorkflowCategory, string> = {
  NOTIFICATIONS: 'Notifications',
  INTEGRATIONS: 'Integrations',
  DATA_SYNC: 'Data Sync',
  AUTOMATION: 'Automation',
  REPORTING: 'Reporting',
  MAINTENANCE: 'Maintenance',
};

/** Icons for workflow categories */
export const WORKFLOW_CATEGORY_ICONS: Record<WorkflowCategory, string> = {
  NOTIFICATIONS: 'bell',
  INTEGRATIONS: 'plug',
  DATA_SYNC: 'refresh-cw',
  AUTOMATION: 'cpu',
  REPORTING: 'bar-chart',
  MAINTENANCE: 'wrench',
};

/** Display names for workflow trigger types */
export const WORKFLOW_TRIGGER_TYPE_DISPLAY_NAMES: Record<WorkflowTriggerType, string> = {
  EVENT: 'Event',
  SCHEDULE: 'Schedule',
  WEBHOOK: 'Webhook',
  MANUAL: 'Manual',
  CONDITION: 'Condition',
};

/** Icons for workflow trigger types */
export const WORKFLOW_TRIGGER_TYPE_ICONS: Record<WorkflowTriggerType, string> = {
  EVENT: 'zap',
  SCHEDULE: 'clock',
  WEBHOOK: 'link',
  MANUAL: 'hand',
  CONDITION: 'git-branch',
};

/** Display names for workflow error actions */
export const WORKFLOW_ERROR_ACTION_DISPLAY_NAMES: Record<WorkflowErrorAction, string> = {
  STOP: 'Stop Execution',
  CONTINUE: 'Continue to Next',
  RETRY: 'Retry Step',
  FALLBACK: 'Run Fallback',
};

/** Display names for workflow step types */
export const WORKFLOW_STEP_TYPE_DISPLAY_NAMES: Record<WorkflowStepType, string> = {
  ACTION: 'Action',
  CONDITION: 'Condition',
  DELAY: 'Delay',
  LOOP: 'Loop',
  PARALLEL: 'Parallel',
  TRANSFORM: 'Transform',
  APPROVAL: 'Approval',
};

/** Icons for workflow step types */
export const WORKFLOW_STEP_TYPE_ICONS: Record<WorkflowStepType, string> = {
  ACTION: 'play',
  CONDITION: 'git-branch',
  DELAY: 'clock',
  LOOP: 'repeat',
  PARALLEL: 'git-merge',
  TRANSFORM: 'shuffle',
  APPROVAL: 'check-circle',
};

/** Display names for workflow action types */
export const WORKFLOW_ACTION_TYPE_DISPLAY_NAMES: Record<WorkflowActionType, string> = {
  SEND_EMAIL: 'Send Email',
  SEND_SMS: 'Send SMS',
  SEND_PUSH: 'Send Push Notification',
  SEND_WEBHOOK: 'Call Webhook',
  CREATE_RECORD: 'Create Record',
  UPDATE_RECORD: 'Update Record',
  DELETE_RECORD: 'Delete Record',
  QUERY_DATA: 'Query Data',
  SYNC_QUICKBOOKS: 'Sync to QuickBooks',
  SYNC_WOOCOMMERCE: 'Sync to WooCommerce',
  CALL_API: 'Call External API',
  ASSIGN_ORDER: 'Assign Order',
  UPDATE_STATUS: 'Update Status',
  GENERATE_DOCUMENT: 'Generate Document',
  RUN_REPORT: 'Run Report',
  WAIT: 'Wait',
  BRANCH: 'Branch',
  MERGE: 'Merge Branches',
};

/** Icons for workflow action types */
export const WORKFLOW_ACTION_TYPE_ICONS: Record<WorkflowActionType, string> = {
  SEND_EMAIL: 'mail',
  SEND_SMS: 'message-circle',
  SEND_PUSH: 'bell',
  SEND_WEBHOOK: 'link',
  CREATE_RECORD: 'plus',
  UPDATE_RECORD: 'edit',
  DELETE_RECORD: 'trash',
  QUERY_DATA: 'search',
  SYNC_QUICKBOOKS: 'calculator',
  SYNC_WOOCOMMERCE: 'shopping-cart',
  CALL_API: 'globe',
  ASSIGN_ORDER: 'user-check',
  UPDATE_STATUS: 'check-square',
  GENERATE_DOCUMENT: 'file-text',
  RUN_REPORT: 'bar-chart',
  WAIT: 'clock',
  BRANCH: 'git-branch',
  MERGE: 'git-merge',
};

/** Display names for workflow execution status */
export const WORKFLOW_EXECUTION_STATUS_DISPLAY_NAMES: Record<WorkflowExecutionStatus, string> = {
  PENDING: 'Pending',
  RUNNING: 'Running',
  WAITING: 'Waiting',
  PAUSED: 'Paused',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
  RETRYING: 'Retrying',
};

/** Colors for workflow execution status */
export const WORKFLOW_EXECUTION_STATUS_COLORS: Record<WorkflowExecutionStatus, string> = {
  PENDING: 'gray',
  RUNNING: 'blue',
  WAITING: 'yellow',
  PAUSED: 'orange',
  COMPLETED: 'green',
  FAILED: 'red',
  CANCELLED: 'gray',
  RETRYING: 'purple',
};

/** Display names for workflow step status */
export const WORKFLOW_STEP_STATUS_DISPLAY_NAMES: Record<WorkflowStepStatus, string> = {
  PENDING: 'Pending',
  RUNNING: 'Running',
  WAITING: 'Waiting',
  SKIPPED: 'Skipped',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  RETRYING: 'Retrying',
};

/** Display names for workflow variable types */
export const WORKFLOW_VARIABLE_TYPE_DISPLAY_NAMES: Record<WorkflowVariableType, string> = {
  STRING: 'Text',
  NUMBER: 'Number',
  BOOLEAN: 'Boolean',
  JSON: 'JSON',
  SECRET: 'Secret',
  API_KEY: 'API Key',
  CONNECTION_STRING: 'Connection String',
};

/** Common workflow events for triggers */
export const WORKFLOW_TRIGGER_EVENTS = [
  // Order events
  'ORDER_CREATED',
  'ORDER_UPDATED',
  'ORDER_STATUS_CHANGED',
  'ORDER_ASSIGNED',
  'ORDER_COMPLETED',
  'ORDER_SHIPPED',
  'ORDER_CANCELLED',
  // Quote events
  'QUOTE_CREATED',
  'QUOTE_APPROVED',
  'QUOTE_REJECTED',
  'QUOTE_EXPIRED',
  'QUOTE_CONVERTED',
  // Customer events
  'CUSTOMER_CREATED',
  'CUSTOMER_UPDATED',
  // Production events
  'STATION_COMPLETED',
  'BOTTLENECK_DETECTED',
  'DEADLINE_AT_RISK',
  // System events
  'WEBHOOK_RECEIVED',
  'SCHEDULE_TRIGGERED',
] as const;

/** Default workflow templates */
export const DEFAULT_WORKFLOW_TEMPLATES = [
  {
    code: 'new_order_notification',
    name: 'New Order Notification',
    description: 'Send email notification when a new order is created',
    category: 'NOTIFICATIONS',
    triggerType: 'EVENT',
    triggerEvent: 'ORDER_CREATED',
  },
  {
    code: 'quote_approval_workflow',
    name: 'Quote Approval Workflow',
    description: 'Route quotes over $5000 for manager approval',
    category: 'AUTOMATION',
    triggerType: 'EVENT',
    triggerEvent: 'QUOTE_CREATED',
  },
  {
    code: 'daily_production_report',
    name: 'Daily Production Report',
    description: 'Generate and email production summary every morning',
    category: 'REPORTING',
    triggerType: 'SCHEDULE',
    triggerSchedule: '0 7 * * *',
  },
  {
    code: 'quickbooks_sync',
    name: 'QuickBooks Order Sync',
    description: 'Sync completed orders to QuickBooks',
    category: 'INTEGRATIONS',
    triggerType: 'EVENT',
    triggerEvent: 'ORDER_COMPLETED',
  },
] as const;

// ============================================================================
// DATA INTEGRITY & VALIDATION CONSTANTS
// ============================================================================

import {
  ValidationSeverity,
  FieldConstraintType,
  AnomalyType,
} from './enums.js';

/** Display names for validation severity */
export const VALIDATION_SEVERITY_DISPLAY_NAMES: Record<ValidationSeverity, string> = {
  [ValidationSeverity.ERROR]: 'Error',
  [ValidationSeverity.WARNING]: 'Warning',
  [ValidationSeverity.INFO]: 'Info',
};

/** Colors for validation severity */
export const VALIDATION_SEVERITY_COLORS: Record<ValidationSeverity, string> = {
  [ValidationSeverity.ERROR]: 'red',
  [ValidationSeverity.WARNING]: 'yellow',
  [ValidationSeverity.INFO]: 'blue',
};

/** Display names for field constraint types */
export const FIELD_CONSTRAINT_TYPE_DISPLAY_NAMES: Record<FieldConstraintType, string> = {
  [FieldConstraintType.MIN_LENGTH]: 'Minimum Length',
  [FieldConstraintType.MAX_LENGTH]: 'Maximum Length',
  [FieldConstraintType.MIN_VALUE]: 'Minimum Value',
  [FieldConstraintType.MAX_VALUE]: 'Maximum Value',
  [FieldConstraintType.PATTERN]: 'Pattern Match',
  [FieldConstraintType.REQUIRED]: 'Required Field',
  [FieldConstraintType.UNIQUE]: 'Unique Value',
  [FieldConstraintType.ENUM]: 'Allowed Values',
  [FieldConstraintType.CUSTOM]: 'Custom Validation',
  [FieldConstraintType.DEPENDENCY]: 'Field Dependency',
  [FieldConstraintType.DATE_RANGE]: 'Date Range',
  [FieldConstraintType.FUTURE_DATE]: 'Future Date',
  [FieldConstraintType.PAST_DATE]: 'Past Date',
  [FieldConstraintType.FILE_TYPE]: 'File Type',
  [FieldConstraintType.FILE_SIZE]: 'File Size',
};

/** Display names for anomaly types */
export const ANOMALY_TYPE_DISPLAY_NAMES: Record<AnomalyType, string> = {
  [AnomalyType.ORPHAN_RECORD]: 'Orphan Record',
  [AnomalyType.DUPLICATE]: 'Duplicate',
  [AnomalyType.CONSTRAINT_VIOLATION]: 'Constraint Violation',
  [AnomalyType.DATA_CORRUPTION]: 'Data Corruption',
  [AnomalyType.MISSING_REQUIRED]: 'Missing Required',
  [AnomalyType.REFERENTIAL_INTEGRITY]: 'Referential Integrity',
  [AnomalyType.RANGE_VIOLATION]: 'Range Violation',
  [AnomalyType.FORMAT_ERROR]: 'Format Error',
  [AnomalyType.STALE_DATA]: 'Stale Data',
  [AnomalyType.CIRCULAR_REFERENCE]: 'Circular Reference',
};

/** Default validation rules for common entities */
export const DEFAULT_VALIDATION_RULES = [
  {
    name: 'Work Order requires customer',
    entityType: 'WorkOrder',
    triggerEvent: 'BEFORE_CREATE',
    expression: 'entity.customerName != null && entity.customerName.length > 0',
    errorMessage: 'Customer name is required',
    errorField: 'customerName',
    severity: 'ERROR',
  },
  {
    name: 'Quote total must be positive',
    entityType: 'Quote',
    triggerEvent: 'BEFORE_UPDATE',
    expression: 'entity.total >= 0',
    errorMessage: 'Quote total cannot be negative',
    errorField: 'total',
    severity: 'ERROR',
  },
  {
    name: 'Due date should be in future',
    entityType: 'WorkOrder',
    triggerEvent: 'BEFORE_CREATE',
    expression: 'entity.dueDate == null || entity.dueDate > new Date()',
    conditionExpression: 'entity.status === "PENDING"',
    errorMessage: 'Due date should be in the future for new orders',
    errorField: 'dueDate',
    severity: 'WARNING',
  },
] as const;

/** Default integrity checks */
export const DEFAULT_INTEGRITY_CHECKS = [
  {
    name: 'Orphan Line Items',
    description: 'Find line items without parent work orders',
    category: 'Referential Integrity',
    entityType: 'LineItem',
    checkQuery: 'SELECT li.id FROM "LineItem" li LEFT JOIN "WorkOrder" wo ON li."workOrderId" = wo.id WHERE wo.id IS NULL',
    frequency: 'DAILY',
    canAutoFix: true,
    autoFixQuery: 'DELETE FROM "LineItem" WHERE "workOrderId" NOT IN (SELECT id FROM "WorkOrder")',
  },
  {
    name: 'Orders without routing',
    description: 'Find in-progress orders with empty routing',
    category: 'Business Rules',
    entityType: 'WorkOrder',
    checkQuery: 'SELECT id FROM "WorkOrder" WHERE status = \'IN_PROGRESS\' AND (routing IS NULL OR array_length(routing, 1) = 0)',
    frequency: 'HOURLY',
    canAutoFix: false,
  },
  {
    name: 'Duplicate order numbers',
    description: 'Detect duplicate order numbers',
    category: 'Data Quality',
    entityType: 'WorkOrder',
    checkQuery: 'SELECT "orderNumber", COUNT(*) FROM "WorkOrder" GROUP BY "orderNumber" HAVING COUNT(*) > 1',
    frequency: 'DAILY',
    canAutoFix: false,
  },
] as const;

// ============================================================================
// AUDIT & COMPLIANCE CONSTANTS
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

/** Display names for audit event types */
export const AUDIT_EVENT_TYPE_DISPLAY_NAMES: Record<AuditEventType, string> = {
  [AuditEventType.CREATE]: 'Created',
  [AuditEventType.READ]: 'Viewed',
  [AuditEventType.UPDATE]: 'Updated',
  [AuditEventType.DELETE]: 'Deleted',
  [AuditEventType.RESTORE]: 'Restored',
  [AuditEventType.ARCHIVE]: 'Archived',
  [AuditEventType.EXPORT]: 'Exported',
  [AuditEventType.IMPORT]: 'Imported',
  [AuditEventType.LOGIN]: 'Logged In',
  [AuditEventType.LOGOUT]: 'Logged Out',
  [AuditEventType.LOGIN_FAILED]: 'Login Failed',
  [AuditEventType.PASSWORD_CHANGE]: 'Password Changed',
  [AuditEventType.PERMISSION_CHANGE]: 'Permissions Changed',
  [AuditEventType.APPROVAL]: 'Approved',
  [AuditEventType.REJECTION]: 'Rejected',
  [AuditEventType.SIGNATURE]: 'Signed',
  [AuditEventType.SUBMISSION]: 'Submitted',
  [AuditEventType.CANCELLATION]: 'Cancelled',
  [AuditEventType.STATUS_CHANGE]: 'Status Changed',
  [AuditEventType.SYSTEM_CONFIG]: 'System Config',
  [AuditEventType.INTEGRATION_SYNC]: 'Integration Sync',
  [AuditEventType.SCHEDULED_JOB]: 'Scheduled Job',
  [AuditEventType.ERROR]: 'Error',
};

/** Colors for audit event types */
export const AUDIT_EVENT_TYPE_COLORS: Record<AuditEventType, string> = {
  [AuditEventType.CREATE]: 'green',
  [AuditEventType.READ]: 'gray',
  [AuditEventType.UPDATE]: 'blue',
  [AuditEventType.DELETE]: 'red',
  [AuditEventType.RESTORE]: 'teal',
  [AuditEventType.ARCHIVE]: 'purple',
  [AuditEventType.EXPORT]: 'indigo',
  [AuditEventType.IMPORT]: 'cyan',
  [AuditEventType.LOGIN]: 'green',
  [AuditEventType.LOGOUT]: 'gray',
  [AuditEventType.LOGIN_FAILED]: 'red',
  [AuditEventType.PASSWORD_CHANGE]: 'yellow',
  [AuditEventType.PERMISSION_CHANGE]: 'orange',
  [AuditEventType.APPROVAL]: 'green',
  [AuditEventType.REJECTION]: 'red',
  [AuditEventType.SIGNATURE]: 'blue',
  [AuditEventType.SUBMISSION]: 'cyan',
  [AuditEventType.CANCELLATION]: 'red',
  [AuditEventType.STATUS_CHANGE]: 'purple',
  [AuditEventType.SYSTEM_CONFIG]: 'gray',
  [AuditEventType.INTEGRATION_SYNC]: 'indigo',
  [AuditEventType.SCHEDULED_JOB]: 'gray',
  [AuditEventType.ERROR]: 'red',
};

/** Display names for audit categories */
export const AUDIT_CATEGORY_DISPLAY_NAMES: Record<AuditCategory, string> = {
  [AuditCategory.DATA_CHANGE]: 'Data Changes',
  [AuditCategory.SECURITY]: 'Security',
  [AuditCategory.BUSINESS]: 'Business',
  [AuditCategory.COMPLIANCE]: 'Compliance',
  [AuditCategory.SYSTEM]: 'System',
  [AuditCategory.INTEGRATION]: 'Integration',
};

/** Display names for signature document types */
export const SIGNATURE_DOC_TYPE_DISPLAY_NAMES: Record<SignatureDocType, string> = {
  [SignatureDocType.QUOTE]: 'Quote',
  [SignatureDocType.PURCHASE_ORDER]: 'Purchase Order',
  [SignatureDocType.WORK_ORDER]: 'Work Order',
  [SignatureDocType.CHANGE_ORDER]: 'Change Order',
  [SignatureDocType.QUALITY_CHECK]: 'Quality Check',
  [SignatureDocType.SHIPPING]: 'Shipping',
  [SignatureDocType.INVOICE]: 'Invoice',
  [SignatureDocType.CONTRACT]: 'Contract',
  [SignatureDocType.TIME_ENTRY]: 'Time Entry',
  [SignatureDocType.EXPENSE]: 'Expense',
};

/** Display names for signature types */
export const SIGNATURE_TYPE_DISPLAY_NAMES: Record<SignatureType, string> = {
  [SignatureType.TYPED]: 'Typed Name',
  [SignatureType.DRAWN]: 'Hand Drawn',
  [SignatureType.UPLOADED]: 'Uploaded Image',
  [SignatureType.DIGITAL]: 'Digital Certificate',
  [SignatureType.BIOMETRIC]: 'Biometric',
  [SignatureType.PIN]: 'PIN Verification',
};

/** Display names for compliance categories */
export const COMPLIANCE_CATEGORY_DISPLAY_NAMES: Record<ComplianceCategory, string> = {
  [ComplianceCategory.DATA_PRIVACY]: 'Data Privacy',
  [ComplianceCategory.FINANCIAL]: 'Financial',
  [ComplianceCategory.SAFETY]: 'Safety',
  [ComplianceCategory.QUALITY]: 'Quality',
  [ComplianceCategory.SECURITY]: 'Security',
  [ComplianceCategory.INDUSTRY]: 'Industry',
  [ComplianceCategory.INTERNAL]: 'Internal Policy',
};

/** Display names for compliance severity */
export const COMPLIANCE_SEVERITY_DISPLAY_NAMES: Record<ComplianceSeverity, string> = {
  [ComplianceSeverity.LOW]: 'Low',
  [ComplianceSeverity.MEDIUM]: 'Medium',
  [ComplianceSeverity.HIGH]: 'High',
  [ComplianceSeverity.CRITICAL]: 'Critical',
};

/** Colors for compliance severity */
export const COMPLIANCE_SEVERITY_COLORS: Record<ComplianceSeverity, string> = {
  [ComplianceSeverity.LOW]: 'gray',
  [ComplianceSeverity.MEDIUM]: 'yellow',
  [ComplianceSeverity.HIGH]: 'orange',
  [ComplianceSeverity.CRITICAL]: 'red',
};

/** Display names for compliance actions */
export const COMPLIANCE_ACTION_DISPLAY_NAMES: Record<ComplianceAction, string> = {
  [ComplianceAction.LOG]: 'Log Only',
  [ComplianceAction.ALERT]: 'Send Alert',
  [ComplianceAction.BLOCK]: 'Block Action',
  [ComplianceAction.ESCALATE]: 'Escalate',
  [ComplianceAction.QUARANTINE]: 'Quarantine',
};

/** Display names for violation status */
export const VIOLATION_STATUS_DISPLAY_NAMES: Record<ViolationStatus, string> = {
  [ViolationStatus.OPEN]: 'Open',
  [ViolationStatus.ACKNOWLEDGED]: 'Acknowledged',
  [ViolationStatus.IN_REMEDIATION]: 'In Remediation',
  [ViolationStatus.RESOLVED]: 'Resolved',
  [ViolationStatus.WAIVED]: 'Waived',
  [ViolationStatus.FALSE_POSITIVE]: 'False Positive',
};

/** Display names for retention basis */
export const RETENTION_BASIS_DISPLAY_NAMES: Record<RetentionBasis, string> = {
  [RetentionBasis.LEGAL_REQUIREMENT]: 'Legal Requirement',
  [RetentionBasis.BUSINESS_NEED]: 'Business Need',
  [RetentionBasis.CONSENT]: 'User Consent',
  [RetentionBasis.CONTRACT]: 'Contractual',
  [RetentionBasis.LEGITIMATE_INTEREST]: 'Legitimate Interest',
};

/** Display names for expiry actions */
export const EXPIRY_ACTION_DISPLAY_NAMES: Record<ExpiryAction, string> = {
  [ExpiryAction.DELETE]: 'Delete',
  [ExpiryAction.ANONYMIZE]: 'Anonymize',
  [ExpiryAction.ARCHIVE]: 'Archive',
  [ExpiryAction.REVIEW]: 'Manual Review',
};

/** Display names for access types */
export const ACCESS_TYPE_DISPLAY_NAMES: Record<AccessType, string> = {
  [AccessType.VIEW]: 'View',
  [AccessType.LIST]: 'List',
  [AccessType.EXPORT]: 'Export',
  [AccessType.DOWNLOAD]: 'Download',
  [AccessType.PRINT]: 'Print',
  [AccessType.SHARE]: 'Share',
  [AccessType.API_CALL]: 'API Call',
};

/** Default retention policies */
export const DEFAULT_RETENTION_POLICIES = [
  {
    name: 'Completed Orders',
    entityType: 'WorkOrder',
    retentionPeriodDays: 2555, // 7 years
    retentionBasis: 'LEGAL_REQUIREMENT',
    legalReference: 'Tax record retention',
    triggerField: 'completedAt',
    expiryAction: 'ARCHIVE',
  },
  {
    name: 'Cancelled Quotes',
    entityType: 'Quote',
    retentionPeriodDays: 365,
    retentionBasis: 'BUSINESS_NEED',
    triggerField: 'updatedAt',
    triggerCondition: 'status = "CANCELLED"',
    expiryAction: 'ANONYMIZE',
  },
  {
    name: 'Audit Logs',
    entityType: 'AuditEvent',
    retentionPeriodDays: 1825, // 5 years
    retentionBasis: 'LEGAL_REQUIREMENT',
    legalReference: 'Audit trail requirements',
    expiryAction: 'ARCHIVE',
  },
] as const;

/** Default compliance rules */
export const DEFAULT_COMPLIANCE_RULES = [
  {
    name: 'Quote Approval Threshold',
    code: 'QUOTE_APPROVAL_THRESHOLD',
    description: 'Quotes over $10,000 require manager approval',
    category: 'FINANCIAL',
    entityType: 'Quote',
    checkExpression: 'entity.total <= 10000 || entity.approvedById != null',
    severity: 'HIGH',
    onViolation: 'BLOCK',
  },
  {
    name: 'Customer Credit Check',
    code: 'CUSTOMER_CREDIT_CHECK',
    description: 'New orders require customer credit validation',
    category: 'FINANCIAL',
    entityType: 'WorkOrder',
    checkExpression: 'entity.customer?.creditStatus === "APPROVED"',
    severity: 'MEDIUM',
    onViolation: 'ALERT',
  },
  {
    name: 'PII Data Access Logging',
    code: 'PII_ACCESS_LOGGING',
    description: 'All access to customer PII must be logged',
    category: 'DATA_PRIVACY',
    regulation: 'GDPR',
    entityType: 'Customer',
    checkExpression: 'true', // Always applies
    severity: 'HIGH',
    onViolation: 'LOG',
  },
] as const;

// ============================================================================
// MULTI-TENANCY & ORGANIZATION CONSTANTS
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
} from './enums.js';

/** Display names for organization types */
export const ORGANIZATION_TYPE_DISPLAY_NAMES: Record<OrganizationType, string> = {
  [OrganizationType.COMPANY]: 'Company',
  [OrganizationType.DIVISION]: 'Division',
  [OrganizationType.SUBSIDIARY]: 'Subsidiary',
  [OrganizationType.FRANCHISE]: 'Franchise',
  [OrganizationType.PARTNER]: 'Partner',
};

/** Display names for organization status */
export const ORG_STATUS_DISPLAY_NAMES: Record<OrgStatus, string> = {
  [OrgStatus.PENDING]: 'Pending',
  [OrgStatus.ACTIVE]: 'Active',
  [OrgStatus.SUSPENDED]: 'Suspended',
  [OrgStatus.INACTIVE]: 'Inactive',
  [OrgStatus.ARCHIVED]: 'Archived',
};

/** Colors for organization status */
export const ORG_STATUS_COLORS: Record<OrgStatus, string> = {
  [OrgStatus.PENDING]: 'yellow',
  [OrgStatus.ACTIVE]: 'green',
  [OrgStatus.SUSPENDED]: 'red',
  [OrgStatus.INACTIVE]: 'gray',
  [OrgStatus.ARCHIVED]: 'purple',
};

/** Display names for subscription tiers */
export const SUBSCRIPTION_TIER_DISPLAY_NAMES: Record<SubscriptionTier, string> = {
  [SubscriptionTier.FREE]: 'Free',
  [SubscriptionTier.BASIC]: 'Basic',
  [SubscriptionTier.PROFESSIONAL]: 'Professional',
  [SubscriptionTier.ENTERPRISE]: 'Enterprise',
  [SubscriptionTier.CUSTOM]: 'Custom',
};

/** Display names for location types */
export const LOCATION_TYPE_DISPLAY_NAMES: Record<LocationType, string> = {
  [LocationType.PRODUCTION]: 'Production',
  [LocationType.WAREHOUSE]: 'Warehouse',
  [LocationType.OFFICE]: 'Office',
  [LocationType.RETAIL]: 'Retail',
  [LocationType.HYBRID]: 'Hybrid',
};

/** Display names for department member roles */
export const DEPT_MEMBER_ROLE_DISPLAY_NAMES: Record<DeptMemberRole, string> = {
  [DeptMemberRole.MEMBER]: 'Member',
  [DeptMemberRole.LEAD]: 'Lead',
  [DeptMemberRole.MANAGER]: 'Manager',
  [DeptMemberRole.HEAD]: 'Department Head',
};

/** Display names for team types */
export const TEAM_TYPE_DISPLAY_NAMES: Record<TeamType, string> = {
  [TeamType.PRODUCTION]: 'Production',
  [TeamType.INSTALLATION]: 'Installation',
  [TeamType.SALES]: 'Sales',
  [TeamType.SUPPORT]: 'Support',
  [TeamType.ADMIN]: 'Administrative',
  [TeamType.CROSS_FUNCTIONAL]: 'Cross-Functional',
};

/** Display names for team member roles */
export const TEAM_MEMBER_ROLE_DISPLAY_NAMES: Record<TeamMemberRole, string> = {
  [TeamMemberRole.MEMBER]: 'Member',
  [TeamMemberRole.SENIOR]: 'Senior',
  [TeamMemberRole.LEAD]: 'Lead',
};

/** Display names for org user roles */
export const ORG_USER_ROLE_DISPLAY_NAMES: Record<OrgUserRole, string> = {
  [OrgUserRole.OWNER]: 'Owner',
  [OrgUserRole.ADMIN]: 'Admin',
  [OrgUserRole.MANAGER]: 'Manager',
  [OrgUserRole.MEMBER]: 'Member',
  [OrgUserRole.GUEST]: 'Guest',
};

/** Display names for setting categories */
export const SETTING_CATEGORY_DISPLAY_NAMES: Record<SettingCategory, string> = {
  [SettingCategory.GENERAL]: 'General',
  [SettingCategory.BRANDING]: 'Branding',
  [SettingCategory.WORKFLOW]: 'Workflow',
  [SettingCategory.NOTIFICATIONS]: 'Notifications',
  [SettingCategory.INTEGRATIONS]: 'Integrations',
  [SettingCategory.BILLING]: 'Billing',
  [SettingCategory.SECURITY]: 'Security',
  [SettingCategory.FEATURES]: 'Features',
};

/** Default subscription limits */
export const SUBSCRIPTION_LIMITS: Record<SubscriptionTier, { users: number; locations: number; storage: number }> = {
  [SubscriptionTier.FREE]: { users: 3, locations: 1, storage: 1024 }, // 1GB
  [SubscriptionTier.BASIC]: { users: 10, locations: 1, storage: 10240 }, // 10GB
  [SubscriptionTier.PROFESSIONAL]: { users: 50, locations: 5, storage: 51200 }, // 50GB
  [SubscriptionTier.ENTERPRISE]: { users: 500, locations: 50, storage: 512000 }, // 500GB
  [SubscriptionTier.CUSTOM]: { users: -1, locations: -1, storage: -1 }, // Unlimited
};

// ============================================================================
// FINANCIAL TRACKING & COST ACCOUNTING CONSTANTS
// ============================================================================

import {
  CostCenterType,
  BudgetPeriod,
  AllocationMethod,
  MaterialType,
  LaborActivity,
  LaborCostStatus,
  OverheadCategory,
  ProfitEntityType,
  ProfitabilityTier,
} from './enums.js';

/** Display names for cost center types */
export const COST_CENTER_TYPE_DISPLAY_NAMES: Record<CostCenterType, string> = {
  [CostCenterType.REVENUE]: 'Revenue',
  [CostCenterType.EXPENSE]: 'Expense',
  [CostCenterType.PROFIT]: 'Profit',
  [CostCenterType.SERVICE]: 'Service',
  [CostCenterType.OVERHEAD]: 'Overhead',
};

/** Display names for budget periods */
export const BUDGET_PERIOD_DISPLAY_NAMES: Record<BudgetPeriod, string> = {
  [BudgetPeriod.MONTHLY]: 'Monthly',
  [BudgetPeriod.QUARTERLY]: 'Quarterly',
  [BudgetPeriod.ANNUAL]: 'Annual',
  [BudgetPeriod.PROJECT]: 'Project-Based',
};

/** Display names for allocation methods */
export const ALLOCATION_METHOD_DISPLAY_NAMES: Record<AllocationMethod, string> = {
  [AllocationMethod.DIRECT]: 'Direct Assignment',
  [AllocationMethod.LABOR_HOURS]: 'Labor Hours',
  [AllocationMethod.MACHINE_HOURS]: 'Machine Hours',
  [AllocationMethod.SQUARE_FOOTAGE]: 'Square Footage',
  [AllocationMethod.HEADCOUNT]: 'Headcount',
  [AllocationMethod.REVENUE]: 'Revenue',
  [AllocationMethod.EQUAL]: 'Equal Distribution',
};

/** Display names for material types */
export const MATERIAL_TYPE_DISPLAY_NAMES: Record<MaterialType, string> = {
  [MaterialType.SUBSTRATE]: 'Substrate',
  [MaterialType.INK]: 'Ink',
  [MaterialType.LAMINATE]: 'Laminate',
  [MaterialType.HARDWARE]: 'Hardware',
  [MaterialType.PACKAGING]: 'Packaging',
  [MaterialType.SUPPLIES]: 'Supplies',
  [MaterialType.OTHER]: 'Other',
};

/** Display names for labor activities */
export const LABOR_ACTIVITY_DISPLAY_NAMES: Record<LaborActivity, string> = {
  [LaborActivity.SETUP]: 'Setup',
  [LaborActivity.PRODUCTION]: 'Production',
  [LaborActivity.FINISHING]: 'Finishing',
  [LaborActivity.PACKAGING]: 'Packaging',
  [LaborActivity.QUALITY_CHECK]: 'Quality Check',
  [LaborActivity.REWORK]: 'Rework',
  [LaborActivity.MAINTENANCE]: 'Maintenance',
  [LaborActivity.ADMIN]: 'Administrative',
};

/** Display names for labor cost status */
export const LABOR_COST_STATUS_DISPLAY_NAMES: Record<LaborCostStatus, string> = {
  [LaborCostStatus.PENDING]: 'Pending',
  [LaborCostStatus.APPROVED]: 'Approved',
  [LaborCostStatus.REJECTED]: 'Rejected',
  [LaborCostStatus.BILLED]: 'Billed',
};

/** Display names for overhead categories */
export const OVERHEAD_CATEGORY_DISPLAY_NAMES: Record<OverheadCategory, string> = {
  [OverheadCategory.FACILITY]: 'Facility',
  [OverheadCategory.EQUIPMENT]: 'Equipment',
  [OverheadCategory.INSURANCE]: 'Insurance',
  [OverheadCategory.ADMINISTRATIVE]: 'Administrative',
  [OverheadCategory.MANAGEMENT]: 'Management',
  [OverheadCategory.IT]: 'IT',
  [OverheadCategory.OTHER]: 'Other',
};

/** Display names for profit entity types */
export const PROFIT_ENTITY_TYPE_DISPLAY_NAMES: Record<ProfitEntityType, string> = {
  [ProfitEntityType.WORK_ORDER]: 'Work Order',
  [ProfitEntityType.QUOTE]: 'Quote',
  [ProfitEntityType.CUSTOMER]: 'Customer',
  [ProfitEntityType.PRODUCT]: 'Product',
  [ProfitEntityType.STATION]: 'Station',
  [ProfitEntityType.PERIOD]: 'Period',
};

/** Display names for profitability tiers */
export const PROFITABILITY_TIER_DISPLAY_NAMES: Record<ProfitabilityTier, string> = {
  [ProfitabilityTier.EXCELLENT]: 'Excellent',
  [ProfitabilityTier.GOOD]: 'Good',
  [ProfitabilityTier.ACCEPTABLE]: 'Acceptable',
  [ProfitabilityTier.MARGINAL]: 'Marginal',
  [ProfitabilityTier.LOSS]: 'Loss',
};

/** Profitability tier colors for UI */
export const PROFITABILITY_TIER_COLORS: Record<ProfitabilityTier, string> = {
  [ProfitabilityTier.EXCELLENT]: 'green',
  [ProfitabilityTier.GOOD]: 'emerald',
  [ProfitabilityTier.ACCEPTABLE]: 'blue',
  [ProfitabilityTier.MARGINAL]: 'yellow',
  [ProfitabilityTier.LOSS]: 'red',
};

/** Default margin thresholds for profitability tiers */
export const PROFITABILITY_THRESHOLDS = {
  EXCEPTIONAL: 0.40,     // 40%+ margin
  ABOVE_TARGET: 0.30,    // 30-40% margin
  ON_TARGET: 0.20,       // 20-30% margin
  BELOW_TARGET: 0.10,    // 10-20% margin
  UNPROFITABLE: 0,       // Below 10% margin
};

/** Default labor burden rate (benefits, taxes, etc.) */
export const DEFAULT_BURDEN_RATE = 0.30; // 30% of base wage

/** Standard billing rates by labor activity */
export const DEFAULT_BILLING_RATES: Partial<Record<LaborActivity, number>> = {
  [LaborActivity.SETUP]: 65,
  [LaborActivity.PRODUCTION]: 65,
  [LaborActivity.FINISHING]: 55,
  [LaborActivity.MAINTENANCE]: 75,
};

// ============================================================================
// SCHEDULING & CAPACITY PLANNING CONSTANTS
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

/** Display names for resource types */
export const RESOURCE_TYPE_DISPLAY_NAMES: Record<ResourceType, string> = {
  [ResourceType.EQUIPMENT]: 'Equipment',
  [ResourceType.WORKSTATION]: 'Workstation',
  [ResourceType.VEHICLE]: 'Vehicle',
  [ResourceType.OPERATOR]: 'Operator',
  [ResourceType.TOOL]: 'Tool',
};

/** Display names for calendar event types */
export const CALENDAR_EVENT_TYPE_DISPLAY_NAMES: Record<CalendarEventType, string> = {
  [CalendarEventType.AVAILABLE]: 'Available',
  [CalendarEventType.UNAVAILABLE]: 'Unavailable',
  [CalendarEventType.MAINTENANCE]: 'Maintenance',
  [CalendarEventType.HOLIDAY]: 'Holiday',
  [CalendarEventType.VACATION]: 'Vacation',
  [CalendarEventType.TRAINING]: 'Training',
  [CalendarEventType.SETUP]: 'Setup',
  [CalendarEventType.BUFFER]: 'Buffer',
};

/** Calendar event type colors */
export const CALENDAR_EVENT_TYPE_COLORS: Record<CalendarEventType, string> = {
  [CalendarEventType.AVAILABLE]: 'green',
  [CalendarEventType.UNAVAILABLE]: 'gray',
  [CalendarEventType.MAINTENANCE]: 'yellow',
  [CalendarEventType.HOLIDAY]: 'purple',
  [CalendarEventType.VACATION]: 'blue',
  [CalendarEventType.TRAINING]: 'cyan',
  [CalendarEventType.SETUP]: 'orange',
  [CalendarEventType.BUFFER]: 'gray',
};

/** Display names for recurrence patterns */
export const RECURRENCE_PATTERN_DISPLAY_NAMES: Record<RecurrencePattern, string> = {
  [RecurrencePattern.DAILY]: 'Daily',
  [RecurrencePattern.WEEKLY]: 'Weekly',
  [RecurrencePattern.BIWEEKLY]: 'Bi-Weekly',
  [RecurrencePattern.MONTHLY]: 'Monthly',
  [RecurrencePattern.QUARTERLY]: 'Quarterly',
  [RecurrencePattern.ANNUAL]: 'Annual',
  [RecurrencePattern.CUSTOM]: 'Custom',
};

/** Display names for capacity granularity */
export const CAPACITY_GRANULARITY_DISPLAY_NAMES: Record<CapacityGranularity, string> = {
  [CapacityGranularity.HOURLY]: 'Hourly',
  [CapacityGranularity.DAILY]: 'Daily',
  [CapacityGranularity.WEEKLY]: 'Weekly',
  [CapacityGranularity.MONTHLY]: 'Monthly',
};

/** Display names for capacity plan status */
export const CAPACITY_PLAN_STATUS_DISPLAY_NAMES: Record<CapacityPlanStatus, string> = {
  [CapacityPlanStatus.DRAFT]: 'Draft',
  [CapacityPlanStatus.ACTIVE]: 'Active',
  [CapacityPlanStatus.APPROVED]: 'Approved',
  [CapacityPlanStatus.ARCHIVED]: 'Archived',
};

/** Display names for skill levels */
export const SKILL_LEVEL_DISPLAY_NAMES: Record<SkillLevel, string> = {
  [SkillLevel.TRAINEE]: 'Trainee',
  [SkillLevel.BASIC]: 'Basic',
  [SkillLevel.PROFICIENT]: 'Proficient',
  [SkillLevel.ADVANCED]: 'Advanced',
  [SkillLevel.EXPERT]: 'Expert',
};

/** Skill level colors */
export const SKILL_LEVEL_COLORS: Record<SkillLevel, string> = {
  [SkillLevel.TRAINEE]: 'gray',
  [SkillLevel.BASIC]: 'blue',
  [SkillLevel.PROFICIENT]: 'green',
  [SkillLevel.ADVANCED]: 'purple',
  [SkillLevel.EXPERT]: 'gold',
};

/** Display names for schedule conflict types */
export const SCHEDULE_CONFLICT_TYPE_DISPLAY_NAMES: Record<ScheduleConflictType, string> = {
  [ScheduleConflictType.RESOURCE_DOUBLE_BOOKED]: 'Resource Double Booked',
  [ScheduleConflictType.CAPACITY_EXCEEDED]: 'Capacity Exceeded',
  [ScheduleConflictType.SKILL_UNAVAILABLE]: 'Skill Unavailable',
  [ScheduleConflictType.MATERIAL_SHORTAGE]: 'Material Shortage',
  [ScheduleConflictType.DEPENDENCY_VIOLATION]: 'Dependency Violation',
  [ScheduleConflictType.DEADLINE_IMPOSSIBLE]: 'Deadline Impossible',
  [ScheduleConflictType.MAINTENANCE_OVERLAP]: 'Maintenance Overlap',
  [ScheduleConflictType.PRIORITY_CONFLICT]: 'Priority Conflict',
};

/** Display names for conflict resolution status */
export const CONFLICT_RESOLUTION_STATUS_DISPLAY_NAMES: Record<ConflictResolutionStatus, string> = {
  [ConflictResolutionStatus.DETECTED]: 'Detected',
  [ConflictResolutionStatus.ACKNOWLEDGED]: 'Acknowledged',
  [ConflictResolutionStatus.RESOLVING]: 'Resolving',
  [ConflictResolutionStatus.RESOLVED]: 'Resolved',
  [ConflictResolutionStatus.IGNORED]: 'Ignored',
  [ConflictResolutionStatus.ESCALATED]: 'Escalated',
};

/** Conflict resolution status colors */
export const CONFLICT_RESOLUTION_STATUS_COLORS: Record<ConflictResolutionStatus, string> = {
  [ConflictResolutionStatus.DETECTED]: 'red',
  [ConflictResolutionStatus.ACKNOWLEDGED]: 'yellow',
  [ConflictResolutionStatus.RESOLVING]: 'blue',
  [ConflictResolutionStatus.RESOLVED]: 'green',
  [ConflictResolutionStatus.IGNORED]: 'gray',
  [ConflictResolutionStatus.ESCALATED]: 'purple',
};

/** Default capacity thresholds */
export const CAPACITY_THRESHOLDS = {
  UNDER_UTILIZED: 0.50,    // Below 50%
  OPTIMAL_MIN: 0.70,       // 70-90% ideal
  OPTIMAL_MAX: 0.90,
  NEAR_CAPACITY: 0.95,     // 90-95%
  OVER_CAPACITY: 1.00,     // Above 100%
};

/** Default skill efficiency factors */
export const SKILL_EFFICIENCY_FACTORS: Record<SkillLevel, number> = {
  [SkillLevel.TRAINEE]: 0.5,
  [SkillLevel.BASIC]: 0.75,
  [SkillLevel.PROFICIENT]: 1.0,
  [SkillLevel.ADVANCED]: 1.15,
  [SkillLevel.EXPERT]: 1.30,
};

// ============================================================================
// CUSTOMER RELATIONSHIP ENHANCEMENT CONSTANTS
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

/** Display names for customer relation types */
export const CUSTOMER_RELATION_TYPE_DISPLAY_NAMES: Record<CustomerRelationType, string> = {
  [CustomerRelationType.PARENT]: 'Parent Company',
  [CustomerRelationType.SUBSIDIARY]: 'Subsidiary',
  [CustomerRelationType.FRANCHISE]: 'Franchise',
  [CustomerRelationType.AFFILIATE]: 'Affiliate',
  [CustomerRelationType.PARTNER]: 'Partner',
  [CustomerRelationType.BILLING]: 'Billing',
};

/** Display names for contact roles */
export const CONTACT_ROLE_DISPLAY_NAMES: Record<ContactRole, string> = {
  [ContactRole.PRIMARY]: 'Primary Contact',
  [ContactRole.BILLING]: 'Billing',
  [ContactRole.SHIPPING]: 'Shipping',
  [ContactRole.TECHNICAL]: 'Technical',
  [ContactRole.APPROVAL]: 'Approval Authority',
  [ContactRole.EXECUTIVE]: 'Executive',
  [ContactRole.PROJECT_MANAGER]: 'Project Manager',
  [ContactRole.PURCHASING]: 'Purchasing',
  [ContactRole.OTHER]: 'Other',
};

/** Display names for preferred contact methods */
export const PREFERRED_CONTACT_METHOD_DISPLAY_NAMES: Record<PreferredContactMethod, string> = {
  [PreferredContactMethod.EMAIL]: 'Email',
  [PreferredContactMethod.PHONE]: 'Phone',
  [PreferredContactMethod.TEXT]: 'Text Message',
  [PreferredContactMethod.PORTAL]: 'Customer Portal',
};

/** Display names for customer tiers */
export const CUSTOMER_TIER_DISPLAY_NAMES: Record<CustomerTier, string> = {
  [CustomerTier.PLATINUM]: 'Platinum',
  [CustomerTier.GOLD]: 'Gold',
  [CustomerTier.SILVER]: 'Silver',
  [CustomerTier.BRONZE]: 'Bronze',
  [CustomerTier.NEW]: 'New',
  [CustomerTier.AT_RISK]: 'At Risk',
  [CustomerTier.INACTIVE]: 'Inactive',
};

/** Customer tier colors */
export const CUSTOMER_TIER_COLORS: Record<CustomerTier, string> = {
  [CustomerTier.PLATINUM]: 'purple',
  [CustomerTier.GOLD]: 'amber',
  [CustomerTier.SILVER]: 'gray',
  [CustomerTier.BRONZE]: 'orange',
  [CustomerTier.NEW]: 'blue',
  [CustomerTier.AT_RISK]: 'red',
  [CustomerTier.INACTIVE]: 'gray',
};

/** Display names for communication channels */
export const COMMUNICATION_CHANNEL_DISPLAY_NAMES: Record<CommunicationChannel, string> = {
  [CommunicationChannel.EMAIL]: 'Email',
  [CommunicationChannel.PHONE]: 'Phone',
  [CommunicationChannel.SMS]: 'SMS',
  [CommunicationChannel.PORTAL_MESSAGE]: 'Portal Message',
  [CommunicationChannel.IN_PERSON]: 'In Person',
  [CommunicationChannel.VIDEO_CALL]: 'Video Call',
  [CommunicationChannel.SOCIAL_MEDIA]: 'Social Media',
  [CommunicationChannel.MAIL]: 'Mail',
  [CommunicationChannel.FAX]: 'Fax',
  [CommunicationChannel.MEETING]: 'Meeting',
  [CommunicationChannel.TEXT]: 'Text Message',
};

/** Icons for communication channels */
export const COMMUNICATION_CHANNEL_ICONS: Record<CommunicationChannel, string> = {
  [CommunicationChannel.EMAIL]: '📧',
  [CommunicationChannel.PHONE]: '📞',
  [CommunicationChannel.SMS]: '📱',
  [CommunicationChannel.PORTAL_MESSAGE]: '💬',
  [CommunicationChannel.IN_PERSON]: '🤝',
  [CommunicationChannel.VIDEO_CALL]: '📹',
  [CommunicationChannel.SOCIAL_MEDIA]: '🌐',
  [CommunicationChannel.MAIL]: '📬',
  [CommunicationChannel.FAX]: '📠',
  [CommunicationChannel.MEETING]: '📅',
  [CommunicationChannel.TEXT]: '💬',
};

/** Display names for communication direction */
export const COMMUNICATION_DIRECTION_DISPLAY_NAMES: Record<CommunicationDirection, string> = {
  [CommunicationDirection.INBOUND]: 'Inbound',
  [CommunicationDirection.OUTBOUND]: 'Outbound',
};

/** Icons for communication direction */
export const COMMUNICATION_DIRECTION_ICONS: Record<CommunicationDirection, string> = {
  [CommunicationDirection.INBOUND]: '📥',
  [CommunicationDirection.OUTBOUND]: '📤',
};

/** Display names for communication sentiment */
export const COMMUNICATION_SENTIMENT_DISPLAY_NAMES: Record<CommunicationSentiment, string> = {
  [CommunicationSentiment.POSITIVE]: 'Positive',
  [CommunicationSentiment.NEUTRAL]: 'Neutral',
  [CommunicationSentiment.NEGATIVE]: 'Negative',
  [CommunicationSentiment.MIXED]: 'Mixed',
};

/** Communication sentiment colors */
export const COMMUNICATION_SENTIMENT_COLORS: Record<CommunicationSentiment, string> = {
  [CommunicationSentiment.POSITIVE]: 'green',
  [CommunicationSentiment.NEUTRAL]: 'gray',
  [CommunicationSentiment.NEGATIVE]: 'red',
  [CommunicationSentiment.MIXED]: 'yellow',
};

/** Customer tier score thresholds */
export const CUSTOMER_TIER_THRESHOLDS = {
  PLATINUM: 90,    // Score >= 90
  GOLD: 75,        // Score 75-89
  SILVER: 60,      // Score 60-74
  BRONZE: 40,      // Score 40-59
  NEW: 0,          // New customers
  AT_RISK: -1,     // Flagged at risk
  INACTIVE: -2,    // No activity > 365 days
};

/** Days to consider customer inactive */
export const CUSTOMER_INACTIVE_DAYS = 365;

/** Days to consider churn risk */
export const CHURN_RISK_THRESHOLDS = {
  LOW: 30,         // < 30 days since last order
  MEDIUM: 90,      // 30-90 days
  HIGH: 180,       // > 180 days
};

// ============================================================================
// INVENTORY & SUPPLY CHAIN INTELLIGENCE CONSTANTS
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

/** Display names for forecast methods */
export const FORECAST_METHOD_DISPLAY_NAMES: Record<ForecastMethod, string> = {
  [ForecastMethod.MOVING_AVERAGE]: 'Moving Average',
  [ForecastMethod.EXPONENTIAL_SMOOTHING]: 'Exponential Smoothing',
  [ForecastMethod.LINEAR_REGRESSION]: 'Linear Regression',
  [ForecastMethod.SEASONAL]: 'Seasonal',
  [ForecastMethod.ARIMA]: 'ARIMA',
  [ForecastMethod.MACHINE_LEARNING]: 'Machine Learning',
  [ForecastMethod.MANUAL]: 'Manual',
};

/** Display names for forecast status */
export const FORECAST_STATUS_DISPLAY_NAMES: Record<ForecastStatus, string> = {
  [ForecastStatus.DRAFT]: 'Draft',
  [ForecastStatus.ACTIVE]: 'Active',
  [ForecastStatus.SUPERSEDED]: 'Superseded',
  [ForecastStatus.ARCHIVED]: 'Archived',
};

/** Display names for forecast granularity */
export const FORECAST_GRANULARITY_DISPLAY_NAMES: Record<ForecastGranularity, string> = {
  [ForecastGranularity.DAILY]: 'Daily',
  [ForecastGranularity.WEEKLY]: 'Weekly',
  [ForecastGranularity.MONTHLY]: 'Monthly',
  [ForecastGranularity.QUARTERLY]: 'Quarterly',
};

/** Display names for supplier tiers */
export const SUPPLIER_TIER_DISPLAY_NAMES: Record<SupplierTier, string> = {
  [SupplierTier.PREFERRED]: 'Preferred',
  [SupplierTier.APPROVED]: 'Approved',
  [SupplierTier.CONDITIONAL]: 'Conditional',
  [SupplierTier.PROBATION]: 'Probation',
  [SupplierTier.DISQUALIFIED]: 'Disqualified',
};

/** Supplier tier colors */
export const SUPPLIER_TIER_COLORS: Record<SupplierTier, string> = {
  [SupplierTier.PREFERRED]: 'green',
  [SupplierTier.APPROVED]: 'blue',
  [SupplierTier.CONDITIONAL]: 'yellow',
  [SupplierTier.PROBATION]: 'orange',
  [SupplierTier.DISQUALIFIED]: 'red',
};

/** Display names for substitution types */
export const SUBSTITUTION_TYPE_DISPLAY_NAMES: Record<SubstitutionType, string> = {
  [SubstitutionType.EQUIVALENT]: 'Equivalent',
  [SubstitutionType.ALTERNATIVE]: 'Alternative',
  [SubstitutionType.UPGRADE]: 'Upgrade',
  [SubstitutionType.DOWNGRADE]: 'Downgrade',
  [SubstitutionType.TEMPORARY]: 'Temporary',
};

/** Display names for inventory transaction types */
export const INVENTORY_TRANSACTION_TYPE_DISPLAY_NAMES: Record<InventoryTransactionType, string> = {
  [InventoryTransactionType.RECEIPT]: 'Receipt',
  [InventoryTransactionType.ISSUE]: 'Issue',
  [InventoryTransactionType.ADJUSTMENT_IN]: 'Adjustment In',
  [InventoryTransactionType.ADJUSTMENT_OUT]: 'Adjustment Out',
  [InventoryTransactionType.TRANSFER]: 'Transfer',
  [InventoryTransactionType.RETURN_TO_VENDOR]: 'Return to Vendor',
  [InventoryTransactionType.RETURN_FROM_CUSTOMER]: 'Return from Customer',
  [InventoryTransactionType.SCRAP]: 'Scrap',
  [InventoryTransactionType.CYCLE_COUNT]: 'Cycle Count',
  [InventoryTransactionType.PHYSICAL_COUNT]: 'Physical Count',
  [InventoryTransactionType.CONSUMPTION]: 'Consumption',
  [InventoryTransactionType.RESERVE]: 'Reserve',
  [InventoryTransactionType.UNRESERVE]: 'Unreserve',
};

/** Display names for reservation status */
export const RESERVATION_STATUS_DISPLAY_NAMES: Record<ReservationStatus, string> = {
  [ReservationStatus.ACTIVE]: 'Active',
  [ReservationStatus.PARTIALLY_CONSUMED]: 'Partially Consumed',
  [ReservationStatus.FULLY_CONSUMED]: 'Fully Consumed',
  [ReservationStatus.RELEASED]: 'Released',
  [ReservationStatus.EXPIRED]: 'Expired',
};

/** Supplier tier score thresholds */
export const SUPPLIER_TIER_THRESHOLDS = {
  PREFERRED: 90,     // Score >= 90
  APPROVED: 75,      // Score 75-89
  CONDITIONAL: 60,   // Score 60-74
  PROBATION: 40,     // Score 40-59
  DISQUALIFIED: 0,   // Score < 40
};

/** Default reorder settings */
export const DEFAULT_REORDER_SETTINGS = {
  LEAD_TIME_DAYS: 7,
  SAFETY_STOCK_DAYS: 3,
  MAX_STOCK_MULTIPLIER: 3,  // Max = Reorder * 3
};

// ============================================================================
// QUALITY MANAGEMENT CONSTANTS
// ============================================================================

import {
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
} from './enums.js';

/** Display names for quality standard types */
export const QUALITY_STANDARD_TYPE_DISPLAY_NAMES: Record<QualityStandardType, string> = {
  [QualityStandardType.INCOMING_MATERIAL]: 'Incoming Material',
  [QualityStandardType.IN_PROCESS]: 'In-Process',
  [QualityStandardType.FINAL_PRODUCT]: 'Final Product',
  [QualityStandardType.PACKAGING]: 'Packaging',
  [QualityStandardType.SHIPPING]: 'Shipping',
};

/** Display names for sampling methods */
export const SAMPLING_METHOD_DISPLAY_NAMES: Record<SamplingMethod, string> = {
  [SamplingMethod.RANDOM]: 'Random',
  [SamplingMethod.SYSTEMATIC]: 'Systematic',
  [SamplingMethod.STRATIFIED]: 'Stratified',
  [SamplingMethod.ONE_HUNDRED_PERCENT]: '100% Inspection',
  [SamplingMethod.SKIP_LOT]: 'Skip Lot',
};

/** Display names for standard status */
export const STANDARD_STATUS_DISPLAY_NAMES: Record<StandardStatus, string> = {
  [StandardStatus.DRAFT]: 'Draft',
  [StandardStatus.PENDING_APPROVAL]: 'Pending Approval',
  [StandardStatus.ACTIVE]: 'Active',
  [StandardStatus.SUPERSEDED]: 'Superseded',
  [StandardStatus.RETIRED]: 'Retired',
};

/** Display names for checkpoint types */
export const CHECKPOINT_TYPE_DISPLAY_NAMES: Record<CheckpointType, string> = {
  [CheckpointType.RECEIVING]: 'Receiving',
  [CheckpointType.FIRST_ARTICLE]: 'First Article',
  [CheckpointType.IN_PROCESS]: 'In-Process',
  [CheckpointType.FINAL]: 'Final',
  [CheckpointType.SHIPPING]: 'Shipping',
  [CheckpointType.CUSTOMER_RETURN]: 'Customer Return',
};

/** Display names for inspection results */
export const INSPECTION_RESULT_DISPLAY_NAMES: Record<InspectionResult, string> = {
  [InspectionResult.PENDING]: 'Pending',
  [InspectionResult.PASSED]: 'Passed',
  [InspectionResult.FAILED]: 'Failed',
  [InspectionResult.CONDITIONAL_PASS]: 'Conditional Pass',
  [InspectionResult.NOT_APPLICABLE]: 'N/A',
};

/** Inspection result colors */
export const INSPECTION_RESULT_COLORS: Record<InspectionResult, string> = {
  [InspectionResult.PENDING]: 'gray',
  [InspectionResult.PASSED]: 'green',
  [InspectionResult.FAILED]: 'red',
  [InspectionResult.CONDITIONAL_PASS]: 'yellow',
  [InspectionResult.NOT_APPLICABLE]: 'slate',
};

/** Display names for inspection dispositions */
export const INSPECTION_DISPOSITION_DISPLAY_NAMES: Record<InspectionDisposition, string> = {
  [InspectionDisposition.ACCEPT]: 'Accept',
  [InspectionDisposition.REJECT]: 'Reject',
  [InspectionDisposition.REWORK]: 'Rework',
  [InspectionDisposition.USE_AS_IS]: 'Use As-Is',
  [InspectionDisposition.SCRAP]: 'Scrap',
  [InspectionDisposition.RETURN_TO_VENDOR]: 'Return to Vendor',
};

/** Display names for NCR categories */
export const NCR_CATEGORY_DISPLAY_NAMES: Record<NCRCategory, string> = {
  [NCRCategory.MATERIAL]: 'Material',
  [NCRCategory.PROCESS]: 'Process',
  [NCRCategory.EQUIPMENT]: 'Equipment',
  [NCRCategory.DESIGN]: 'Design',
  [NCRCategory.VENDOR]: 'Vendor',
  [NCRCategory.CUSTOMER_COMPLAINT]: 'Customer Complaint',
  [NCRCategory.SHIPPING]: 'Shipping',
  [NCRCategory.OTHER]: 'Other',
};

/** Display names for NCR severity */
export const NCR_SEVERITY_DISPLAY_NAMES: Record<NCRSeverity, string> = {
  [NCRSeverity.CRITICAL]: 'Critical',
  [NCRSeverity.MAJOR]: 'Major',
  [NCRSeverity.MINOR]: 'Minor',
  [NCRSeverity.OBSERVATION]: 'Observation',
};

/** NCR severity colors */
export const NCR_SEVERITY_COLORS: Record<NCRSeverity, string> = {
  [NCRSeverity.CRITICAL]: 'red',
  [NCRSeverity.MAJOR]: 'orange',
  [NCRSeverity.MINOR]: 'yellow',
  [NCRSeverity.OBSERVATION]: 'blue',
};

/** Display names for NCR sources */
export const NCR_SOURCE_DISPLAY_NAMES: Record<NCRSource, string> = {
  [NCRSource.INCOMING_INSPECTION]: 'Incoming Inspection',
  [NCRSource.IN_PROCESS]: 'In-Process',
  [NCRSource.FINAL_INSPECTION]: 'Final Inspection',
  [NCRSource.CUSTOMER_RETURN]: 'Customer Return',
  [NCRSource.CUSTOMER_COMPLAINT]: 'Customer Complaint',
  [NCRSource.INTERNAL_AUDIT]: 'Internal Audit',
  [NCRSource.EXTERNAL_AUDIT]: 'External Audit',
};

/** Display names for NCR status */
export const NCR_STATUS_DISPLAY_NAMES: Record<NCRStatus, string> = {
  [NCRStatus.OPEN]: 'Open',
  [NCRStatus.UNDER_INVESTIGATION]: 'Under Investigation',
  [NCRStatus.PENDING_DISPOSITION]: 'Pending Disposition',
  [NCRStatus.IN_CORRECTIVE_ACTION]: 'In Corrective Action',
  [NCRStatus.PENDING_VERIFICATION]: 'Pending Verification',
  [NCRStatus.CLOSED]: 'Closed',
  [NCRStatus.VOID]: 'Void',
};

/** Display names for NCR disposition */
export const NCR_DISPOSITION_DISPLAY_NAMES: Record<NCRDisposition, string> = {
  [NCRDisposition.USE_AS_IS]: 'Use As-Is',
  [NCRDisposition.REWORK]: 'Rework',
  [NCRDisposition.REPAIR]: 'Repair',
  [NCRDisposition.SCRAP]: 'Scrap',
  [NCRDisposition.RETURN_TO_VENDOR]: 'Return to Vendor',
  [NCRDisposition.REJECT]: 'Reject',
  [NCRDisposition.CONCESSION]: 'Concession',
};

/** Display names for corrective action types */
export const CORRECTIVE_ACTION_TYPE_DISPLAY_NAMES: Record<CorrectiveActionType, string> = {
  [CorrectiveActionType.CORRECTION]: 'Correction',
  [CorrectiveActionType.CORRECTIVE]: 'Corrective Action',
  [CorrectiveActionType.PREVENTIVE]: 'Preventive Action',
  [CorrectiveActionType.IMPROVEMENT]: 'Improvement',
};

/** Display names for corrective action priority */
export const CORRECTIVE_ACTION_PRIORITY_DISPLAY_NAMES: Record<CorrectiveActionPriority, string> = {
  [CorrectiveActionPriority.CRITICAL]: 'Critical',
  [CorrectiveActionPriority.HIGH]: 'High',
  [CorrectiveActionPriority.MEDIUM]: 'Medium',
  [CorrectiveActionPriority.LOW]: 'Low',
};

/** Corrective action priority colors */
export const CORRECTIVE_ACTION_PRIORITY_COLORS: Record<CorrectiveActionPriority, string> = {
  [CorrectiveActionPriority.CRITICAL]: 'red',
  [CorrectiveActionPriority.HIGH]: 'orange',
  [CorrectiveActionPriority.MEDIUM]: 'yellow',
  [CorrectiveActionPriority.LOW]: 'blue',
};

/** Display names for root cause methods */
export const ROOT_CAUSE_METHOD_DISPLAY_NAMES: Record<RootCauseMethod, string> = {
  [RootCauseMethod.FIVE_WHY]: '5 Why',
  [RootCauseMethod.FISHBONE]: 'Fishbone (Ishikawa)',
  [RootCauseMethod.FMEA]: 'FMEA',
  [RootCauseMethod.FAULT_TREE]: 'Fault Tree',
  [RootCauseMethod.PARETO]: 'Pareto',
  [RootCauseMethod.OTHER]: 'Other',
};

/** Display names for CA status */
export const CA_STATUS_DISPLAY_NAMES: Record<CAStatus, string> = {
  [CAStatus.OPEN]: 'Open',
  [CAStatus.ROOT_CAUSE_ANALYSIS]: 'Root Cause Analysis',
  [CAStatus.PLANNING]: 'Planning',
  [CAStatus.IMPLEMENTATION]: 'Implementation',
  [CAStatus.VERIFICATION]: 'Verification',
  [CAStatus.EFFECTIVENESS_REVIEW]: 'Effectiveness Review',
  [CAStatus.CLOSED]: 'Closed',
  [CAStatus.CANCELLED]: 'Cancelled',
};

/** Display names for effectiveness results */
export const EFFECTIVENESS_RESULT_DISPLAY_NAMES: Record<EffectivenessResult, string> = {
  [EffectivenessResult.EFFECTIVE]: 'Effective',
  [EffectivenessResult.PARTIALLY_EFFECTIVE]: 'Partially Effective',
  [EffectivenessResult.NOT_EFFECTIVE]: 'Not Effective',
  [EffectivenessResult.PENDING]: 'Pending',
};

/** Display names for quality measurement types */
export const QUALITY_MEASUREMENT_TYPE_DISPLAY_NAMES: Record<QualityMeasurementType, string> = {
  [QualityMeasurementType.CONTINUOUS]: 'Continuous',
  [QualityMeasurementType.ATTRIBUTE]: 'Attribute',
  [QualityMeasurementType.DEFECTS]: 'Defects',
  [QualityMeasurementType.PERCENTAGE]: 'Percentage',
};

/** Display names for SPC chart types */
export const SPC_CHART_TYPE_DISPLAY_NAMES: Record<SPCChartType, string> = {
  [SPCChartType.X_BAR_R]: 'X-bar R (Avg & Range)',
  [SPCChartType.X_BAR_S]: 'X-bar S (Avg & Std Dev)',
  [SPCChartType.I_MR]: 'I-MR (Individual & Moving Range)',
  [SPCChartType.P_CHART]: 'P Chart (Proportion)',
  [SPCChartType.NP_CHART]: 'NP Chart (Number Defective)',
  [SPCChartType.C_CHART]: 'C Chart (Defects per Unit)',
  [SPCChartType.U_CHART]: 'U Chart (Defects Variable Sample)',
};

/** Common root cause categories */
export const ROOT_CAUSE_CATEGORIES = [
  'Man/People',
  'Machine/Equipment',
  'Material',
  'Method/Process',
  'Measurement',
  'Environment',
  'Management',
  'Training',
] as const;

/** Common defect types for sign manufacturing */
export const SIGN_DEFECT_TYPES = [
  'Color mismatch',
  'Dimension out of spec',
  'Surface defect',
  'Lamination issue',
  'Print quality',
  'Alignment error',
  'Material damage',
  'Weeding error',
  'Application bubble',
  'Edge quality',
  'Vinyl cracking',
  'Ink adhesion',
  'Wrong material',
  'Font/text error',
  'Logo quality',
] as const;

/** Quality KPI thresholds */
export const QUALITY_KPI_THRESHOLDS = {
  FIRST_PASS_YIELD: {
    EXCELLENT: 98,
    GOOD: 95,
    ACCEPTABLE: 90,
    POOR: 85,
  },
  NCR_RATE: {
    EXCELLENT: 1,    // < 1%
    GOOD: 2,         // 1-2%
    ACCEPTABLE: 5,   // 2-5%
    POOR: 10,        // > 5%
  },
  CAR_CLOSURE_DAYS: {
    EXCELLENT: 7,    // < 7 days
    GOOD: 14,        // 7-14 days
    ACCEPTABLE: 30,  // 14-30 days
    POOR: 60,        // > 30 days
  },
};

// ============================================================================
// DOCUMENT MANAGEMENT CONSTANTS
// ============================================================================

import {
  DocumentVersionStatus,
  TemplateType,
  ApprovalType,
  ApprovalStatus,
  ApprovalDecision,
  DocumentAccessType,
  DocumentAccessAction,
} from './enums.js';

/** Display names for document version status */
export const DOCUMENT_VERSION_STATUS_DISPLAY_NAMES: Record<DocumentVersionStatus, string> = {
  [DocumentVersionStatus.DRAFT]: 'Draft',
  [DocumentVersionStatus.PENDING_REVIEW]: 'Pending Review',
  [DocumentVersionStatus.APPROVED]: 'Approved',
  [DocumentVersionStatus.REJECTED]: 'Rejected',
  [DocumentVersionStatus.SUPERSEDED]: 'Superseded',
  [DocumentVersionStatus.ARCHIVED]: 'Archived',
};

/** Document version status colors */
export const DOCUMENT_VERSION_STATUS_COLORS: Record<DocumentVersionStatus, string> = {
  [DocumentVersionStatus.DRAFT]: 'gray',
  [DocumentVersionStatus.PENDING_REVIEW]: 'yellow',
  [DocumentVersionStatus.APPROVED]: 'green',
  [DocumentVersionStatus.REJECTED]: 'red',
  [DocumentVersionStatus.SUPERSEDED]: 'slate',
  [DocumentVersionStatus.ARCHIVED]: 'slate',
};

/** Display names for template types */
export const TEMPLATE_TYPE_DISPLAY_NAMES: Record<TemplateType, string> = {
  [TemplateType.FORM]: 'Form',
  [TemplateType.REPORT]: 'Report',
  [TemplateType.LETTER]: 'Letter',
  [TemplateType.CERTIFICATE]: 'Certificate',
  [TemplateType.LABEL]: 'Label',
  [TemplateType.CHECKLIST]: 'Checklist',
  [TemplateType.CONTRACT]: 'Contract',
  [TemplateType.INVOICE]: 'Invoice',
  [TemplateType.QUOTE]: 'Quote',
  [TemplateType.WORK_INSTRUCTION]: 'Work Instruction',
  [TemplateType.OTHER]: 'Other',
};

/** Display names for approval types */
export const APPROVAL_TYPE_DISPLAY_NAMES: Record<ApprovalType, string> = {
  [ApprovalType.REVIEW]: 'General Review',
  [ApprovalType.TECHNICAL]: 'Technical Review',
  [ApprovalType.QUALITY]: 'Quality Approval',
  [ApprovalType.MANAGEMENT]: 'Management Approval',
  [ApprovalType.CUSTOMER]: 'Customer Approval',
  [ApprovalType.LEGAL]: 'Legal Review',
  [ApprovalType.FINAL]: 'Final Sign-Off',
};

/** Display names for approval status */
export const APPROVAL_STATUS_DISPLAY_NAMES: Record<ApprovalStatus, string> = {
  [ApprovalStatus.PENDING]: 'Pending',
  [ApprovalStatus.IN_REVIEW]: 'In Review',
  [ApprovalStatus.COMPLETED]: 'Completed',
  [ApprovalStatus.SKIPPED]: 'Skipped',
  [ApprovalStatus.DELEGATED]: 'Delegated',
  [ApprovalStatus.EXPIRED]: 'Expired',
};

/** Approval status colors */
export const APPROVAL_STATUS_COLORS: Record<ApprovalStatus, string> = {
  [ApprovalStatus.PENDING]: 'yellow',
  [ApprovalStatus.IN_REVIEW]: 'blue',
  [ApprovalStatus.COMPLETED]: 'green',
  [ApprovalStatus.SKIPPED]: 'gray',
  [ApprovalStatus.DELEGATED]: 'purple',
  [ApprovalStatus.EXPIRED]: 'red',
};

/** Display names for approval decisions */
export const APPROVAL_DECISION_DISPLAY_NAMES: Record<ApprovalDecision, string> = {
  [ApprovalDecision.APPROVED]: 'Approved',
  [ApprovalDecision.APPROVED_WITH_COMMENTS]: 'Approved with Comments',
  [ApprovalDecision.REJECTED]: 'Rejected',
  [ApprovalDecision.NEEDS_REVISION]: 'Needs Revision',
  [ApprovalDecision.DEFERRED]: 'Deferred',
};

/** Approval decision colors */
export const APPROVAL_DECISION_COLORS: Record<ApprovalDecision, string> = {
  [ApprovalDecision.APPROVED]: 'green',
  [ApprovalDecision.APPROVED_WITH_COMMENTS]: 'lime',
  [ApprovalDecision.REJECTED]: 'red',
  [ApprovalDecision.NEEDS_REVISION]: 'orange',
  [ApprovalDecision.DEFERRED]: 'gray',
};

/** Display names for document access types */
export const DOCUMENT_ACCESS_TYPE_DISPLAY_NAMES: Record<DocumentAccessType, string> = {
  [DocumentAccessType.USER]: 'Specific User',
  [DocumentAccessType.ROLE]: 'Role-Based',
  [DocumentAccessType.DEPARTMENT]: 'Department',
  [DocumentAccessType.PUBLIC]: 'Public',
  [DocumentAccessType.CUSTOMER]: 'Customer Portal',
};

/** Display names for document access actions */
export const DOCUMENT_ACCESS_ACTION_DISPLAY_NAMES: Record<DocumentAccessAction, string> = {
  [DocumentAccessAction.VIEW]: 'View',
  [DocumentAccessAction.DOWNLOAD]: 'Download',
  [DocumentAccessAction.PRINT]: 'Print',
  [DocumentAccessAction.SHARE]: 'Share',
  [DocumentAccessAction.EDIT]: 'Edit',
  [DocumentAccessAction.DELETE]: 'Delete',
  [DocumentAccessAction.VERSION_UPLOAD]: 'Upload Version',
};

/** Common file types for sign shops */
export const SIGN_SHOP_FILE_TYPES = {
  DESIGN: ['.ai', '.psd', '.indd', '.eps', '.svg', '.cdr'],
  IMAGE: ['.jpg', '.jpeg', '.png', '.gif', '.tiff', '.bmp', '.webp'],
  DOCUMENT: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'],
  CUT_FILE: ['.plt', '.dxf', '.dwg', '.gmt'],
  PRINT_FILE: ['.tif', '.tiff', '.pdf'],
} as const;

/** Maximum file sizes (in bytes) */
export const MAX_FILE_SIZES = {
  DOCUMENT: 50 * 1024 * 1024,      // 50 MB
  DESIGN_FILE: 500 * 1024 * 1024,  // 500 MB
  IMAGE: 25 * 1024 * 1024,         // 25 MB
  THUMBNAIL: 1 * 1024 * 1024,      // 1 MB
};

/** Approval workflow defaults */
export const APPROVAL_DEFAULTS = {
  REMINDER_DAYS: 3,           // Days before due date to send reminder
  EXPIRY_DAYS: 14,            // Days until approval expires
  ESCALATION_DAYS: 7,         // Days until escalation
};

// ============================================================================
// PERFORMANCE & ANALYTICS CONSTANTS
// ============================================================================

import {
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
} from './enums.js';

/** Display names for metric snapshot types */
export const METRIC_SNAPSHOT_TYPE_DISPLAY_NAMES: Record<MetricSnapshotType, string> = {
  [MetricSnapshotType.OVERALL]: 'Overall',
  [MetricSnapshotType.STATION]: 'Station',
  [MetricSnapshotType.USER]: 'User',
  [MetricSnapshotType.CUSTOMER]: 'Customer',
  [MetricSnapshotType.PRODUCT_LINE]: 'Product Line',
};

/** Display names for metric scope types */
export const METRIC_SCOPE_TYPE_DISPLAY_NAMES: Record<MetricScopeType, string> = {
  [MetricScopeType.GLOBAL]: 'Global',
  [MetricScopeType.STATION]: 'Station',
  [MetricScopeType.USER]: 'User',
  [MetricScopeType.CUSTOMER]: 'Customer',
  [MetricScopeType.DEPARTMENT]: 'Department',
};

/** Display names for throughput periods */
export const THROUGHPUT_PERIOD_DISPLAY_NAMES: Record<ThroughputPeriod, string> = {
  [ThroughputPeriod.HOURLY]: 'Hourly',
  [ThroughputPeriod.SHIFT]: 'Shift',
  [ThroughputPeriod.DAILY]: 'Daily',
  [ThroughputPeriod.WEEKLY]: 'Weekly',
};

/** Display names for bottleneck resources */
export const BOTTLENECK_RESOURCE_DISPLAY_NAMES: Record<BottleneckResource, string> = {
  [BottleneckResource.EQUIPMENT]: 'Equipment',
  [BottleneckResource.LABOR]: 'Labor',
  [BottleneckResource.MATERIAL]: 'Material',
  [BottleneckResource.SPACE]: 'Space',
  [BottleneckResource.TOOLING]: 'Tooling',
};

/** Display names for bottleneck types */
export const BOTTLENECK_TYPE_DISPLAY_NAMES: Record<BottleneckType, string> = {
  [BottleneckType.CAPACITY]: 'Capacity Limit',
  [BottleneckType.EQUIPMENT_DOWN]: 'Equipment Down',
  [BottleneckType.STAFF_SHORTAGE]: 'Staff Shortage',
  [BottleneckType.MATERIAL_OUT]: 'Material Shortage',
  [BottleneckType.QUALITY_HOLD]: 'Quality Hold',
  [BottleneckType.DEPENDENCY]: 'Dependency Wait',
  [BottleneckType.EXTERNAL]: 'External Factor',
};

/** Display names for bottleneck severity */
export const BOTTLENECK_SEVERITY_DISPLAY_NAMES: Record<BottleneckSeverity, string> = {
  [BottleneckSeverity.CRITICAL]: 'Critical',
  [BottleneckSeverity.HIGH]: 'High',
  [BottleneckSeverity.MEDIUM]: 'Medium',
  [BottleneckSeverity.LOW]: 'Low',
};

/** Bottleneck severity colors */
export const BOTTLENECK_SEVERITY_COLORS: Record<BottleneckSeverity, string> = {
  [BottleneckSeverity.CRITICAL]: 'red',
  [BottleneckSeverity.HIGH]: 'orange',
  [BottleneckSeverity.MEDIUM]: 'yellow',
  [BottleneckSeverity.LOW]: 'blue',
};

/** Display names for bottleneck resolution */
export const BOTTLENECK_RESOLUTION_DISPLAY_NAMES: Record<BottleneckResolution, string> = {
  [BottleneckResolution.CLEARED]: 'Cleared',
  [BottleneckResolution.OVERTIME]: 'Added Overtime',
  [BottleneckResolution.RESEQUENCED]: 'Resequenced',
  [BottleneckResolution.OUTSOURCED]: 'Outsourced',
  [BottleneckResolution.ESCALATED]: 'Escalated',
  [BottleneckResolution.EQUIPMENT_FIXED]: 'Equipment Fixed',
  [BottleneckResolution.MATERIAL_RECEIVED]: 'Material Received',
  [BottleneckResolution.OTHER]: 'Other',
};

/** Display names for productivity periods */
export const PRODUCTIVITY_PERIOD_DISPLAY_NAMES: Record<ProductivityPeriod, string> = {
  [ProductivityPeriod.DAILY]: 'Daily',
  [ProductivityPeriod.WEEKLY]: 'Weekly',
  [ProductivityPeriod.MONTHLY]: 'Monthly',
};

/** Display names for goal types */
export const GOAL_TYPE_DISPLAY_NAMES: Record<GoalType, string> = {
  [GoalType.PRODUCTIVITY]: 'Productivity',
  [GoalType.QUALITY]: 'Quality',
  [GoalType.EFFICIENCY]: 'Efficiency',
  [GoalType.REVENUE]: 'Revenue',
  [GoalType.CUSTOMER_SATISFACTION]: 'Customer Satisfaction',
  [GoalType.SAFETY]: 'Safety',
  [GoalType.DELIVERY]: 'Delivery',
};

/** Display names for goal direction */
export const GOAL_DIRECTION_DISPLAY_NAMES: Record<GoalDirection, string> = {
  [GoalDirection.HIGHER]: 'Higher is Better',
  [GoalDirection.LOWER]: 'Lower is Better',
  [GoalDirection.TARGET]: 'Target Value',
};

/** Display names for goal periods */
export const GOAL_PERIOD_DISPLAY_NAMES: Record<GoalPeriod, string> = {
  [GoalPeriod.DAILY]: 'Daily',
  [GoalPeriod.WEEKLY]: 'Weekly',
  [GoalPeriod.MONTHLY]: 'Monthly',
  [GoalPeriod.QUARTERLY]: 'Quarterly',
  [GoalPeriod.ANNUAL]: 'Annual',
};

/** Display names for goal status */
export const GOAL_STATUS_DISPLAY_NAMES: Record<GoalStatus, string> = {
  [GoalStatus.NOT_STARTED]: 'Not Started',
  [GoalStatus.ON_TRACK]: 'On Track',
  [GoalStatus.AT_RISK]: 'At Risk',
  [GoalStatus.BEHIND]: 'Behind',
  [GoalStatus.ACHIEVED]: 'Achieved',
  [GoalStatus.MISSED]: 'Missed',
};

/** Goal status colors */
export const GOAL_STATUS_COLORS: Record<GoalStatus, string> = {
  [GoalStatus.NOT_STARTED]: 'gray',
  [GoalStatus.ON_TRACK]: 'green',
  [GoalStatus.AT_RISK]: 'yellow',
  [GoalStatus.BEHIND]: 'orange',
  [GoalStatus.ACHIEVED]: 'emerald',
  [GoalStatus.MISSED]: 'red',
};

/** Bottleneck detection thresholds */
export const BOTTLENECK_THRESHOLDS = {
  QUEUE_DEPTH: {
    LOW: 3,            // Warning at 3 jobs
    MEDIUM: 6,         // Elevated at 6 jobs
    HIGH: 10,          // Critical at 10 jobs
  },
  WAIT_TIME_MINUTES: {
    LOW: 30,           // 30 min wait
    MEDIUM: 60,        // 1 hour wait
    HIGH: 120,         // 2 hour wait
  },
};

/** Productivity benchmarks */
export const PRODUCTIVITY_BENCHMARKS = {
  UTILIZATION: {
    EXCELLENT: 85,     // >= 85%
    GOOD: 75,          // 75-84%
    ACCEPTABLE: 65,    // 65-74%
    POOR: 50,          // < 65%
  },
  EFFICIENCY: {
    EXCELLENT: 100,    // >= 100% of standard
    GOOD: 90,          // 90-99%
    ACCEPTABLE: 80,    // 80-89%
    POOR: 70,          // < 80%
  },
};

/** Common KPI metric definitions */
export const KPI_DEFINITIONS = {
  THROUGHPUT_RATE: {
    name: 'Throughput Rate',
    unit: 'units/hour',
    description: 'Number of units completed per hour',
  },
  CYCLE_TIME: {
    name: 'Cycle Time',
    unit: 'minutes',
    description: 'Average time to complete one unit',
  },
  FIRST_PASS_YIELD: {
    name: 'First Pass Yield',
    unit: '%',
    description: 'Percentage of units passing first inspection',
  },
  ON_TIME_DELIVERY: {
    name: 'On-Time Delivery',
    unit: '%',
    description: 'Percentage of orders delivered by due date',
  },
  UTILIZATION: {
    name: 'Utilization',
    unit: '%',
    description: 'Percentage of available time spent productively',
  },
} as const;

// ============================================================================
// SSS-019: ADVANCED QUALITY ASSURANCE SYSTEM CONSTANTS
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

/** Display names for defect severity */
export const DEFECT_SEVERITY_DISPLAY_NAMES: Record<DefectSeverity, string> = {
  [DefectSeverity.COSMETIC]: 'Cosmetic',
  [DefectSeverity.MINOR]: 'Minor',
  [DefectSeverity.MAJOR]: 'Major',
  [DefectSeverity.CRITICAL]: 'Critical',
  [DefectSeverity.SAFETY]: 'Safety Hazard',
};

/** Severity colors for UI */
export const DEFECT_SEVERITY_COLORS: Record<DefectSeverity, string> = {
  [DefectSeverity.COSMETIC]: '#9CA3AF', // Gray
  [DefectSeverity.MINOR]: '#60A5FA',    // Blue
  [DefectSeverity.MAJOR]: '#FBBF24',    // Yellow
  [DefectSeverity.CRITICAL]: '#F87171', // Red
  [DefectSeverity.SAFETY]: '#DC2626',   // Dark Red
};

/** Display names for defect disposition */
export const DEFECT_DISPOSITION_DISPLAY_NAMES: Record<DefectDisposition, string> = {
  [DefectDisposition.PENDING]: 'Pending Decision',
  [DefectDisposition.USE_AS_IS]: 'Use As-Is',
  [DefectDisposition.REWORK]: 'Rework',
  [DefectDisposition.SCRAP]: 'Scrap',
  [DefectDisposition.RETURN_TO_VENDOR]: 'Return to Vendor',
  [DefectDisposition.DOWNGRADE]: 'Downgrade',
};

/** Display names for defect source */
export const DEFECT_SOURCE_DISPLAY_NAMES: Record<DefectSource, string> = {
  [DefectSource.INCOMING]: 'Incoming Inspection',
  [DefectSource.IN_PROCESS]: 'In-Process',
  [DefectSource.FINAL_QC]: 'Final QC',
  [DefectSource.CUSTOMER]: 'Customer Report',
  [DefectSource.INTERNAL_AUDIT]: 'Internal Audit',
  [DefectSource.EQUIPMENT]: 'Equipment',
};

/** Display names for evidence types */
export const EVIDENCE_TYPE_DISPLAY_NAMES: Record<EvidenceType, string> = {
  [EvidenceType.PHOTO]: 'Photo',
  [EvidenceType.VIDEO]: 'Video',
  [EvidenceType.DOCUMENT]: 'Document',
  [EvidenceType.MEASUREMENT]: 'Measurement',
  [EvidenceType.TEST_RESULT]: 'Test Result',
  [EvidenceType.CUSTOMER_REPORT]: 'Customer Report',
  [EvidenceType.AUDIO]: 'Audio Recording',
};

/** Evidence type icons */
export const EVIDENCE_TYPE_ICONS: Record<EvidenceType, string> = {
  [EvidenceType.PHOTO]: '📷',
  [EvidenceType.VIDEO]: '🎥',
  [EvidenceType.DOCUMENT]: '📄',
  [EvidenceType.MEASUREMENT]: '📏',
  [EvidenceType.TEST_RESULT]: '🧪',
  [EvidenceType.CUSTOMER_REPORT]: '📋',
  [EvidenceType.AUDIO]: '🎤',
};

/** Display names for root cause categories */
export const ROOT_CAUSE_CATEGORY_DISPLAY_NAMES: Record<RootCauseCategoryQC, string> = {
  [RootCauseCategoryQC.OPERATOR_ERROR]: 'Operator Error',
  [RootCauseCategoryQC.EQUIPMENT]: 'Equipment Failure',
  [RootCauseCategoryQC.MATERIAL]: 'Material Defect',
  [RootCauseCategoryQC.PROCESS]: 'Process Issue',
  [RootCauseCategoryQC.DESIGN]: 'Design Flaw',
  [RootCauseCategoryQC.ENVIRONMENTAL]: 'Environmental',
  [RootCauseCategoryQC.MAINTENANCE]: 'Maintenance',
  [RootCauseCategoryQC.TRAINING]: 'Training Gap',
  [RootCauseCategoryQC.VENDOR]: 'Vendor Issue',
  [RootCauseCategoryQC.UNKNOWN]: 'Under Investigation',
};

/** Display names for supplier quality tiers */
export const SUPPLIER_QUALITY_TIER_DISPLAY_NAMES: Record<SupplierQualityTier, string> = {
  [SupplierQualityTier.PREFERRED]: 'Preferred',
  [SupplierQualityTier.APPROVED]: 'Approved',
  [SupplierQualityTier.CONDITIONAL]: 'Conditional',
  [SupplierQualityTier.RESTRICTED]: 'Restricted',
  [SupplierQualityTier.BLOCKED]: 'Blocked',
};

/** Supplier quality tier colors */
export const SUPPLIER_QUALITY_TIER_COLORS: Record<SupplierQualityTier, string> = {
  [SupplierQualityTier.PREFERRED]: '#10B981',  // Green
  [SupplierQualityTier.APPROVED]: '#3B82F6',   // Blue
  [SupplierQualityTier.CONDITIONAL]: '#FBBF24', // Yellow
  [SupplierQualityTier.RESTRICTED]: '#F97316', // Orange
  [SupplierQualityTier.BLOCKED]: '#EF4444',    // Red
};

/** Display names for feedback types */
export const FEEDBACK_TYPE_DISPLAY_NAMES: Record<FeedbackType, string> = {
  [FeedbackType.COMPLIMENT]: 'Compliment',
  [FeedbackType.COMPLAINT]: 'Complaint',
  [FeedbackType.SUGGESTION]: 'Suggestion',
  [FeedbackType.WARRANTY_CLAIM]: 'Warranty Claim',
  [FeedbackType.RETURN]: 'Return Request',
  [FeedbackType.QUESTION]: 'Question',
};

/** Feedback type icons */
export const FEEDBACK_TYPE_ICONS: Record<FeedbackType, string> = {
  [FeedbackType.COMPLIMENT]: '😊',
  [FeedbackType.COMPLAINT]: '😟',
  [FeedbackType.SUGGESTION]: '💡',
  [FeedbackType.WARRANTY_CLAIM]: '🛠️',
  [FeedbackType.RETURN]: '↩️',
  [FeedbackType.QUESTION]: '❓',
};

/** Display names for feedback status */
export const FEEDBACK_STATUS_DISPLAY_NAMES: Record<FeedbackStatus, string> = {
  [FeedbackStatus.RECEIVED]: 'Received',
  [FeedbackStatus.ACKNOWLEDGED]: 'Acknowledged',
  [FeedbackStatus.INVESTIGATING]: 'Investigating',
  [FeedbackStatus.RESOLVED]: 'Resolved',
  [FeedbackStatus.CLOSED]: 'Closed',
  [FeedbackStatus.ESCALATED]: 'Escalated',
};

/** Display names for quality trend types */
export const QUALITY_TREND_TYPE_DISPLAY_NAMES: Record<QualityTrendType, string> = {
  [QualityTrendType.FIRST_PASS_YIELD]: 'First Pass Yield',
  [QualityTrendType.DEFECT_RATE]: 'Defect Rate',
  [QualityTrendType.CUSTOMER_RETURNS]: 'Customer Returns',
  [QualityTrendType.REWORK_RATE]: 'Rework Rate',
  [QualityTrendType.SCRAP_RATE]: 'Scrap Rate',
  [QualityTrendType.INSPECTION_TIME]: 'Inspection Time',
  [QualityTrendType.ESCAPE_RATE]: 'Escape Rate',
};

/** Quality metric targets (industry benchmarks) */
export const QUALITY_METRIC_TARGETS: Record<QualityTrendType, { target: number; unit: string; direction: 'higher' | 'lower' }> = {
  [QualityTrendType.FIRST_PASS_YIELD]: { target: 95, unit: '%', direction: 'higher' },
  [QualityTrendType.DEFECT_RATE]: { target: 2, unit: '%', direction: 'lower' },
  [QualityTrendType.CUSTOMER_RETURNS]: { target: 1, unit: '%', direction: 'lower' },
  [QualityTrendType.REWORK_RATE]: { target: 5, unit: '%', direction: 'lower' },
  [QualityTrendType.SCRAP_RATE]: { target: 2, unit: '%', direction: 'lower' },
  [QualityTrendType.INSPECTION_TIME]: { target: 15, unit: 'min', direction: 'lower' },
  [QualityTrendType.ESCAPE_RATE]: { target: 0.5, unit: '%', direction: 'lower' },
};

/** Supplier quality thresholds for automatic tier changes */
export const SUPPLIER_QUALITY_THRESHOLDS = {
  PREFERRED: {
    minQualityScore: 95,
    minDeliveryScore: 95,
    minResponseScore: 90,
    maxRejectRate: 1,      // % of lots rejected
    maxPPM: 100,           // Parts per million defective
  },
  APPROVED: {
    minQualityScore: 85,
    minDeliveryScore: 85,
    minResponseScore: 80,
    maxRejectRate: 3,
    maxPPM: 500,
  },
  CONDITIONAL: {
    minQualityScore: 70,
    minDeliveryScore: 70,
    minResponseScore: 65,
    maxRejectRate: 5,
    maxPPM: 1000,
  },
  RESTRICTED: {
    minQualityScore: 50,
    minDeliveryScore: 50,
    minResponseScore: 50,
    maxRejectRate: 10,
    maxPPM: 2500,
  },
  // Below RESTRICTED thresholds = BLOCKED
} as const;

/** Defect disposition cost impact estimates */
export const DISPOSITION_COST_MULTIPLIERS = {
  [DefectDisposition.USE_AS_IS]: 0,     // No additional cost
  [DefectDisposition.REWORK]: 0.25,     // 25% of original cost
  [DefectDisposition.SCRAP]: 1.0,       // 100% of material cost lost
  [DefectDisposition.RETURN_TO_VENDOR]: 0.1, // Handling cost
  [DefectDisposition.DOWNGRADE]: 0.15,  // Reduced sale price
  [DefectDisposition.PENDING]: 0,
} as const;

/** Statistical process control constants */
export const SPC_QUALITY_CONSTANTS = {
  SIGMA_MULTIPLIER: 3,           // 3-sigma control limits
  MINIMUM_SAMPLE_SIZE: 30,       // Minimum data points for SPC
  WARNING_SIGMA: 2,              // Warning limits at 2-sigma
  
  // Western Electric rules for out-of-control
  RULES: {
    BEYOND_3_SIGMA: 'Point beyond 3 sigma',
    TWO_OF_THREE_BEYOND_2_SIGMA: '2 of 3 points beyond 2 sigma',
    FOUR_OF_FIVE_BEYOND_1_SIGMA: '4 of 5 points beyond 1 sigma',
    EIGHT_SAME_SIDE: '8 points on same side of center',
    SIX_TRENDING: '6 points trending up or down',
  },
} as const;

/** Quality cost categories */
export const COST_OF_QUALITY = {
  PREVENTION: {
    description: 'Costs to prevent defects',
    examples: ['Training', 'Process design', 'Equipment maintenance'],
  },
  APPRAISAL: {
    description: 'Costs to detect defects',
    examples: ['Inspection', 'Testing', 'Audits'],
  },
  INTERNAL_FAILURE: {
    description: 'Costs of defects found before shipping',
    examples: ['Rework', 'Scrap', 'Reinspection'],
  },
  EXTERNAL_FAILURE: {
    description: 'Costs of defects found by customer',
    examples: ['Returns', 'Warranty', 'Customer service'],
  },
} as const;

/** Common sign shop defect categories */
export const STANDARD_DEFECT_CATEGORIES = [
  { name: 'Color/Print Quality', description: 'Color issues, banding, fading' },
  { name: 'Material Defects', description: 'Tears, bubbles, scratches' },
  { name: 'Dimensional Accuracy', description: 'Wrong size, alignment issues' },
  { name: 'Finish Quality', description: 'Lamination, mounting, edges' },
  { name: 'Artwork Issues', description: 'Design errors, wrong files used' },
  { name: 'Hardware Defects', description: 'Grommets, frames, mounting hardware' },
  { name: 'Packaging Damage', description: 'Damage during packaging/shipping' },
  { name: 'Assembly Errors', description: 'Wrong assembly, missing components' },
] as const;

// ============================================================================
// NEW-CRITICAL-01: PROJECT MANAGEMENT & JOB TEMPLATES CONSTANTS
// ============================================================================

import {
  ProjectStatus,
  ProjectPriority,
  MilestoneStatus,
  BudgetLineType,
  BudgetStatus,
  JobTemplateCategory,
} from './enums.js';

/** Display names for project status */
export const PROJECT_STATUS_DISPLAY_NAMES: Record<ProjectStatus, string> = {
  [ProjectStatus.PLANNING]: 'Planning',
  [ProjectStatus.APPROVED]: 'Approved',
  [ProjectStatus.IN_PROGRESS]: 'In Progress',
  [ProjectStatus.ON_HOLD]: 'On Hold',
  [ProjectStatus.COMPLETED]: 'Completed',
  [ProjectStatus.CANCELLED]: 'Cancelled',
  [ProjectStatus.ARCHIVED]: 'Archived',
};

/** Colors for project status */
export const PROJECT_STATUS_COLORS: Record<ProjectStatus, string> = {
  [ProjectStatus.PLANNING]: '#8b5cf6',   // purple
  [ProjectStatus.APPROVED]: '#3b82f6',   // blue
  [ProjectStatus.IN_PROGRESS]: '#f59e0b', // amber
  [ProjectStatus.ON_HOLD]: '#ef4444',    // red
  [ProjectStatus.COMPLETED]: '#22c55e',  // green
  [ProjectStatus.CANCELLED]: '#6b7280',  // gray
  [ProjectStatus.ARCHIVED]: '#9ca3af',   // light gray
};

/** Display names for project priority */
export const PROJECT_PRIORITY_DISPLAY_NAMES: Record<ProjectPriority, string> = {
  [ProjectPriority.CRITICAL]: 'Critical',
  [ProjectPriority.HIGH]: 'High',
  [ProjectPriority.MEDIUM]: 'Medium',
  [ProjectPriority.LOW]: 'Low',
};

/** Colors for project priority */
export const PROJECT_PRIORITY_COLORS: Record<ProjectPriority, string> = {
  [ProjectPriority.CRITICAL]: '#dc2626',  // red-600
  [ProjectPriority.HIGH]: '#ea580c',      // orange-600
  [ProjectPriority.MEDIUM]: '#2563eb',    // blue-600
  [ProjectPriority.LOW]: '#6b7280',       // gray-500
};

/** Icons for project priority (emoji) */
export const PROJECT_PRIORITY_ICONS: Record<ProjectPriority, string> = {
  [ProjectPriority.CRITICAL]: '🔴',
  [ProjectPriority.HIGH]: '🟠',
  [ProjectPriority.MEDIUM]: '🔵',
  [ProjectPriority.LOW]: '⚪',
};

/** Display names for milestone status */
export const MILESTONE_STATUS_DISPLAY_NAMES: Record<MilestoneStatus, string> = {
  [MilestoneStatus.NOT_STARTED]: 'Not Started',
  [MilestoneStatus.IN_PROGRESS]: 'In Progress',
  [MilestoneStatus.COMPLETED]: 'Completed',
  [MilestoneStatus.OVERDUE]: 'Overdue',
  [MilestoneStatus.SKIPPED]: 'Skipped',
};

/** Colors for milestone status */
export const MILESTONE_STATUS_COLORS: Record<MilestoneStatus, string> = {
  [MilestoneStatus.NOT_STARTED]: '#9ca3af',  // gray-400
  [MilestoneStatus.IN_PROGRESS]: '#3b82f6',  // blue-500
  [MilestoneStatus.COMPLETED]: '#22c55e',    // green-500
  [MilestoneStatus.OVERDUE]: '#ef4444',      // red-500
  [MilestoneStatus.SKIPPED]: '#6b7280',      // gray-500
};

/** Display names for budget line types */
export const BUDGET_LINE_TYPE_DISPLAY_NAMES: Record<BudgetLineType, string> = {
  [BudgetLineType.MATERIAL]: 'Material',
  [BudgetLineType.LABOR]: 'Labor',
  [BudgetLineType.EQUIPMENT]: 'Equipment',
  [BudgetLineType.SUBCONTRACT]: 'Subcontract',
  [BudgetLineType.SHIPPING]: 'Shipping',
  [BudgetLineType.OVERHEAD]: 'Overhead',
  [BudgetLineType.OTHER]: 'Other',
};

/** Colors for budget line types */
export const BUDGET_LINE_TYPE_COLORS: Record<BudgetLineType, string> = {
  [BudgetLineType.MATERIAL]: '#3b82f6',   // blue
  [BudgetLineType.LABOR]: '#22c55e',      // green
  [BudgetLineType.EQUIPMENT]: '#8b5cf6',  // purple
  [BudgetLineType.SUBCONTRACT]: '#f59e0b', // amber
  [BudgetLineType.SHIPPING]: '#06b6d4',   // cyan
  [BudgetLineType.OVERHEAD]: '#ec4899',   // pink
  [BudgetLineType.OTHER]: '#6b7280',      // gray
};

/** Icons for budget line types (emoji) */
export const BUDGET_LINE_TYPE_ICONS: Record<BudgetLineType, string> = {
  [BudgetLineType.MATERIAL]: '📦',
  [BudgetLineType.LABOR]: '👷',
  [BudgetLineType.EQUIPMENT]: '🔧',
  [BudgetLineType.SUBCONTRACT]: '🤝',
  [BudgetLineType.SHIPPING]: '🚚',
  [BudgetLineType.OVERHEAD]: '🏢',
  [BudgetLineType.OTHER]: '📋',
};

/** Display names for budget status */
export const BUDGET_STATUS_DISPLAY_NAMES: Record<BudgetStatus, string> = {
  [BudgetStatus.DRAFT]: 'Draft',
  [BudgetStatus.APPROVED]: 'Approved',
  [BudgetStatus.OVER_BUDGET]: 'Over Budget',
  [BudgetStatus.UNDER_BUDGET]: 'Under Budget',
  [BudgetStatus.CLOSED]: 'Closed',
};

/** Colors for budget status */
export const BUDGET_STATUS_COLORS: Record<BudgetStatus, string> = {
  [BudgetStatus.DRAFT]: '#9ca3af',       // gray
  [BudgetStatus.APPROVED]: '#3b82f6',    // blue
  [BudgetStatus.OVER_BUDGET]: '#ef4444', // red
  [BudgetStatus.UNDER_BUDGET]: '#22c55e', // green
  [BudgetStatus.CLOSED]: '#6b7280',      // dark gray
};

/** Display names for job template categories */
export const JOB_TEMPLATE_CATEGORY_DISPLAY_NAMES: Record<JobTemplateCategory, string> = {
  [JobTemplateCategory.SIGNAGE]: 'Signage',
  [JobTemplateCategory.VEHICLE_WRAP]: 'Vehicle Wrap',
  [JobTemplateCategory.BANNER]: 'Banner',
  [JobTemplateCategory.DISPLAY]: 'Display',
  [JobTemplateCategory.WAYFINDING]: 'Wayfinding',
  [JobTemplateCategory.CHANNEL_LETTER]: 'Channel Letters',
  [JobTemplateCategory.MONUMENT]: 'Monument Sign',
  [JobTemplateCategory.CUSTOM]: 'Custom',
};

/** Colors for job template categories */
export const JOB_TEMPLATE_CATEGORY_COLORS: Record<JobTemplateCategory, string> = {
  [JobTemplateCategory.SIGNAGE]: '#3b82f6',       // blue
  [JobTemplateCategory.VEHICLE_WRAP]: '#22c55e',  // green
  [JobTemplateCategory.BANNER]: '#f59e0b',        // amber
  [JobTemplateCategory.DISPLAY]: '#8b5cf6',       // purple
  [JobTemplateCategory.WAYFINDING]: '#06b6d4',    // cyan
  [JobTemplateCategory.CHANNEL_LETTER]: '#ec4899', // pink
  [JobTemplateCategory.MONUMENT]: '#84cc16',      // lime
  [JobTemplateCategory.CUSTOM]: '#6b7280',        // gray
};

/** Icons for job template categories */
export const JOB_TEMPLATE_CATEGORY_ICONS: Record<JobTemplateCategory, string> = {
  [JobTemplateCategory.SIGNAGE]: '🪧',
  [JobTemplateCategory.VEHICLE_WRAP]: '🚗',
  [JobTemplateCategory.BANNER]: '🏳️',
  [JobTemplateCategory.DISPLAY]: '🖼️',
  [JobTemplateCategory.WAYFINDING]: '🧭',
  [JobTemplateCategory.CHANNEL_LETTER]: '🔤',
  [JobTemplateCategory.MONUMENT]: '🏛️',
  [JobTemplateCategory.CUSTOM]: '✨',
};

/** Project number prefix */
export const PROJECT_NUMBER_PREFIX = 'PRJ-';

/** Default project settings */
export const PROJECT_DEFAULTS = {
  priority: ProjectPriority.MEDIUM,
  budgetVarianceThreshold: 10, // % over budget to trigger warning
  milestoneDueSoonDays: 7,     // Days before due to show "due soon"
  overdueNotificationDays: [1, 3, 7], // Days after overdue to notify
} as const;

/** Budget analysis thresholds */
export const BUDGET_THRESHOLDS = {
  WARNING: 80,      // % of budget consumed - show warning
  CRITICAL: 95,     // % of budget consumed - show critical
  OVERRUN_ALERT: 100, // % of budget - alert on overrun
  VARIANCE_WARNING: 10, // % variance from estimate
  VARIANCE_CRITICAL: 25, // % variance from estimate
} as const;

/** Standard project phases for sign shops */
export const STANDARD_PROJECT_PHASES = [
  { name: 'Design & Approval', order: 1, estimatedDays: 5 },
  { name: 'Permitting', order: 2, estimatedDays: 10 },
  { name: 'Fabrication', order: 3, estimatedDays: 14 },
  { name: 'Quality Check', order: 4, estimatedDays: 2 },
  { name: 'Installation', order: 5, estimatedDays: 3 },
  { name: 'Final Inspection', order: 6, estimatedDays: 1 },
] as const;

/** Common checklist items by template category */
export const TEMPLATE_CHECKLIST_ITEMS: Record<JobTemplateCategory, string[]> = {
  [JobTemplateCategory.SIGNAGE]: [
    'Verify site dimensions',
    'Confirm electrical requirements',
    'Check permit requirements',
    'Review artwork proofs',
    'Schedule installation crew',
  ],
  [JobTemplateCategory.VEHICLE_WRAP]: [
    'Get vehicle measurements',
    'Photograph vehicle condition',
    'Create wrap template',
    'Confirm vinyl material',
    'Schedule wrap appointment',
  ],
  [JobTemplateCategory.BANNER]: [
    'Confirm dimensions',
    'Verify grommet placement',
    'Check wind load requirements',
    'Review artwork resolution',
    'Package for shipping',
  ],
  [JobTemplateCategory.DISPLAY]: [
    'Verify booth dimensions',
    'Check assembly requirements',
    'Confirm graphics resolution',
    'Include assembly instructions',
    'Schedule delivery timing',
  ],
  [JobTemplateCategory.WAYFINDING]: [
    'Review site survey',
    'Confirm ADA compliance',
    'Verify mounting locations',
    'Check message content',
    'Coordinate with site contact',
  ],
  [JobTemplateCategory.CHANNEL_LETTER]: [
    'Confirm letter sizing',
    'Verify LED specifications',
    'Check electrical requirements',
    'Review raceway mounting',
    'Obtain electrical permit',
  ],
  [JobTemplateCategory.MONUMENT]: [
    'Complete site survey',
    'Obtain building permit',
    'Verify foundation requirements',
    'Check utility locations',
    'Schedule concrete work',
  ],
  [JobTemplateCategory.CUSTOM]: [
    'Define project scope',
    'Create custom specifications',
    'Review with customer',
    'Establish timeline',
    'Document special requirements',
  ],
};

// ============================================================================
// NEW-CRITICAL-02: MATERIAL NESTING & WASTE OPTIMIZATION CONSTANTS
// ============================================================================

import {
  NestingStatus,
  CutStatus,
  WasteCategory,
  SheetStatus,
  NestingAlgorithm,
} from './enums.js';

/** Display names for nesting status */
export const NESTING_STATUS_DISPLAY_NAMES: Record<NestingStatus, string> = {
  [NestingStatus.DRAFT]: 'Draft',
  [NestingStatus.PENDING]: 'Pending',
  [NestingStatus.PROCESSING]: 'Processing',
  [NestingStatus.COMPLETED]: 'Completed',
  [NestingStatus.APPROVED]: 'Approved',
  [NestingStatus.IN_PRODUCTION]: 'In Production',
  [NestingStatus.FINISHED]: 'Finished',
  [NestingStatus.CANCELLED]: 'Cancelled',
};

/** Colors for nesting status */
export const NESTING_STATUS_COLORS: Record<NestingStatus, string> = {
  [NestingStatus.DRAFT]: '#9ca3af',       // gray
  [NestingStatus.PENDING]: '#f59e0b',     // amber
  [NestingStatus.PROCESSING]: '#3b82f6',  // blue
  [NestingStatus.COMPLETED]: '#22c55e',   // green
  [NestingStatus.APPROVED]: '#8b5cf6',    // purple
  [NestingStatus.IN_PRODUCTION]: '#06b6d4', // cyan
  [NestingStatus.FINISHED]: '#059669',    // emerald
  [NestingStatus.CANCELLED]: '#6b7280',   // gray
};

/** Display names for cut status */
export const CUT_STATUS_DISPLAY_NAMES: Record<CutStatus, string> = {
  [CutStatus.PENDING]: 'Pending',
  [CutStatus.IN_PROGRESS]: 'In Progress',
  [CutStatus.COMPLETED]: 'Completed',
  [CutStatus.FAILED]: 'Failed',
  [CutStatus.SKIPPED]: 'Skipped',
};

/** Colors for cut status */
export const CUT_STATUS_COLORS: Record<CutStatus, string> = {
  [CutStatus.PENDING]: '#9ca3af',      // gray
  [CutStatus.IN_PROGRESS]: '#3b82f6',  // blue
  [CutStatus.COMPLETED]: '#22c55e',    // green
  [CutStatus.FAILED]: '#ef4444',       // red
  [CutStatus.SKIPPED]: '#6b7280',      // gray
};

/** Display names for waste category */
export const WASTE_CATEGORY_DISPLAY_NAMES: Record<WasteCategory, string> = {
  [WasteCategory.USABLE_REMNANT]: 'Usable Remnant',
  [WasteCategory.EDGE_TRIM]: 'Edge Trim',
  [WasteCategory.SCRAP]: 'Scrap',
  [WasteCategory.DEFECTIVE]: 'Defective',
  [WasteCategory.SETUP_WASTE]: 'Setup Waste',
};

/** Colors for waste category */
export const WASTE_CATEGORY_COLORS: Record<WasteCategory, string> = {
  [WasteCategory.USABLE_REMNANT]: '#22c55e',  // green - can be reused
  [WasteCategory.EDGE_TRIM]: '#f59e0b',       // amber - recyclable
  [WasteCategory.SCRAP]: '#ef4444',           // red - waste
  [WasteCategory.DEFECTIVE]: '#dc2626',       // dark red - defect
  [WasteCategory.SETUP_WASTE]: '#9ca3af',     // gray - expected
};

/** Icons for waste category */
export const WASTE_CATEGORY_ICONS: Record<WasteCategory, string> = {
  [WasteCategory.USABLE_REMNANT]: '♻️',
  [WasteCategory.EDGE_TRIM]: '✂️',
  [WasteCategory.SCRAP]: '🗑️',
  [WasteCategory.DEFECTIVE]: '❌',
  [WasteCategory.SETUP_WASTE]: '⚙️',
};

/** Display names for sheet status */
export const SHEET_STATUS_DISPLAY_NAMES: Record<SheetStatus, string> = {
  [SheetStatus.AVAILABLE]: 'Available',
  [SheetStatus.RESERVED]: 'Reserved',
  [SheetStatus.IN_USE]: 'In Use',
  [SheetStatus.DEPLETED]: 'Depleted',
  [SheetStatus.DAMAGED]: 'Damaged',
};

/** Colors for sheet status */
export const SHEET_STATUS_COLORS: Record<SheetStatus, string> = {
  [SheetStatus.AVAILABLE]: '#22c55e',   // green
  [SheetStatus.RESERVED]: '#f59e0b',    // amber
  [SheetStatus.IN_USE]: '#3b82f6',      // blue
  [SheetStatus.DEPLETED]: '#6b7280',    // gray
  [SheetStatus.DAMAGED]: '#ef4444',     // red
};

/** Display names for nesting algorithms */
export const NESTING_ALGORITHM_DISPLAY_NAMES: Record<NestingAlgorithm, string> = {
  [NestingAlgorithm.BOTTOM_LEFT]: 'Bottom-Left Fill',
  [NestingAlgorithm.BEST_FIT]: 'Best Fit Decreasing',
  [NestingAlgorithm.GENETIC]: 'Genetic Algorithm',
  [NestingAlgorithm.GUILLOTINE]: 'Guillotine Cutting',
};

/** Algorithm descriptions */
export const NESTING_ALGORITHM_DESCRIPTIONS: Record<NestingAlgorithm, string> = {
  [NestingAlgorithm.BOTTOM_LEFT]: 'Fast, simple placement from bottom-left corner. Good for quick estimates.',
  [NestingAlgorithm.BEST_FIT]: 'Sorts items by size and places largest first. Better utilization than bottom-left.',
  [NestingAlgorithm.GENETIC]: 'Evolutionary optimization for best utilization. Slower but optimal results.',
  [NestingAlgorithm.GUILLOTINE]: 'Produces only straight cuts. Best for materials that require guillotine cuts.',
};

/** Default nesting parameters */
export const NESTING_DEFAULTS = {
  itemSpacing: 0.25,          // inches between items
  edgeMargin: 0.5,            // inches from sheet edge
  minRemnantSize: 36,         // sq inches minimum to save as remnant
  maxIterations: 1000,        // algorithm iterations
  timeoutMs: 30000,           // algorithm timeout
} as const;

/** Utilization thresholds */
export const UTILIZATION_THRESHOLDS = {
  EXCELLENT: 90,    // >= 90% utilization
  GOOD: 80,         // >= 80%
  FAIR: 70,         // >= 70%
  POOR: 60,         // >= 60%
  // < 60% is considered wasteful
} as const;

/** Utilization threshold colors */
export const UTILIZATION_COLORS = {
  EXCELLENT: '#22c55e',  // green
  GOOD: '#84cc16',       // lime
  FAIR: '#f59e0b',       // amber
  POOR: '#f97316',       // orange
  WASTEFUL: '#ef4444',   // red
} as const;

/** Get utilization color based on percentage */
export const getUtilizationColor = (percent: number): string => {
  if (percent >= UTILIZATION_THRESHOLDS.EXCELLENT) return UTILIZATION_COLORS.EXCELLENT;
  if (percent >= UTILIZATION_THRESHOLDS.GOOD) return UTILIZATION_COLORS.GOOD;
  if (percent >= UTILIZATION_THRESHOLDS.FAIR) return UTILIZATION_COLORS.FAIR;
  if (percent >= UTILIZATION_THRESHOLDS.POOR) return UTILIZATION_COLORS.POOR;
  return UTILIZATION_COLORS.WASTEFUL;
};

/** Waste cost assumptions */
export const WASTE_COST_FACTORS = {
  RECYCLABLE_RECOVERY: 0.15,  // 15% of material cost recoverable for recyclables
  SCRAP_DISPOSAL_COST: 0.05,  // 5% of material cost to dispose of scrap
  DEFECT_FULL_LOSS: 1.0,      // 100% loss on defective material
} as const;

/** Common material sheet sizes (in inches) */
export const STANDARD_SHEET_SIZES = [
  { name: '4x8 Sheet', width: 48, height: 96 },
  { name: '4x10 Sheet', width: 48, height: 120 },
  { name: '5x10 Sheet', width: 60, height: 120 },
  { name: '5x12 Sheet', width: 60, height: 144 },
  { name: '54" Roll', width: 54, height: null }, // Roll material
  { name: '60" Roll', width: 60, height: null },
  { name: '72" Roll', width: 72, height: null },
] as const;

/** Grain direction options */
export const GRAIN_DIRECTIONS = [
  { value: 'horizontal', label: 'Horizontal Grain', icon: '➡️' },
  { value: 'vertical', label: 'Vertical Grain', icon: '⬆️' },
  { value: 'none', label: 'No Grain', icon: '◯' },
] as const;

// ============================================================================
// NEW-CRITICAL-03: ADVANCED NOTIFICATION & COMMUNICATION HUB CONSTANTS
// ============================================================================

import {
  NotificationChannel,
  NotificationPriorityLevel,
  NotificationDeliveryStatus,
  ThreadStatus,
  AnnouncementScope,
} from './enums.js';

/** Display names for notification channels */
export const NOTIFICATION_CHANNEL_DISPLAY_NAMES: Record<NotificationChannel, string> = {
  [NotificationChannel.IN_APP]: 'In-App',
  [NotificationChannel.EMAIL]: 'Email',
  [NotificationChannel.SMS]: 'SMS',
  [NotificationChannel.PUSH]: 'Push Notification',
  [NotificationChannel.SLACK]: 'Slack',
  [NotificationChannel.TEAMS]: 'Microsoft Teams',
  [NotificationChannel.WEBHOOK]: 'Webhook',
};

/** Icons for notification channels */
export const NOTIFICATION_CHANNEL_ICONS: Record<NotificationChannel, string> = {
  [NotificationChannel.IN_APP]: '🔔',
  [NotificationChannel.EMAIL]: '📧',
  [NotificationChannel.SMS]: '📱',
  [NotificationChannel.PUSH]: '📲',
  [NotificationChannel.SLACK]: '💬',
  [NotificationChannel.TEAMS]: '👥',
  [NotificationChannel.WEBHOOK]: '🔗',
};

/** Display names for notification priority */
export const NOTIFICATION_PRIORITY_DISPLAY_NAMES: Record<NotificationPriorityLevel, string> = {
  [NotificationPriorityLevel.LOW]: 'Low',
  [NotificationPriorityLevel.NORMAL]: 'Normal',
  [NotificationPriorityLevel.HIGH]: 'High',
  [NotificationPriorityLevel.URGENT]: 'Urgent',
};

/** Colors for notification priority */
export const NOTIFICATION_PRIORITY_COLORS: Record<NotificationPriorityLevel, string> = {
  [NotificationPriorityLevel.LOW]: '#9ca3af',    // gray
  [NotificationPriorityLevel.NORMAL]: '#3b82f6', // blue
  [NotificationPriorityLevel.HIGH]: '#f59e0b',   // amber
  [NotificationPriorityLevel.URGENT]: '#ef4444', // red
};

/** Display names for delivery status */
export const DELIVERY_STATUS_DISPLAY_NAMES: Record<NotificationDeliveryStatus, string> = {
  [NotificationDeliveryStatus.PENDING]: 'Pending',
  [NotificationDeliveryStatus.SENDING]: 'Sending',
  [NotificationDeliveryStatus.DELIVERED]: 'Delivered',
  [NotificationDeliveryStatus.FAILED]: 'Failed',
  [NotificationDeliveryStatus.BOUNCED]: 'Bounced',
  [NotificationDeliveryStatus.READ]: 'Read',
  [NotificationDeliveryStatus.DISMISSED]: 'Dismissed',
};

/** Colors for delivery status */
export const DELIVERY_STATUS_COLORS: Record<NotificationDeliveryStatus, string> = {
  [NotificationDeliveryStatus.PENDING]: '#f59e0b',   // amber
  [NotificationDeliveryStatus.SENDING]: '#3b82f6',   // blue
  [NotificationDeliveryStatus.DELIVERED]: '#22c55e', // green
  [NotificationDeliveryStatus.FAILED]: '#ef4444',    // red
  [NotificationDeliveryStatus.BOUNCED]: '#dc2626',   // dark red
  [NotificationDeliveryStatus.READ]: '#059669',      // emerald
  [NotificationDeliveryStatus.DISMISSED]: '#6b7280', // gray
};

/** Display names for thread status */
export const THREAD_STATUS_DISPLAY_NAMES: Record<ThreadStatus, string> = {
  [ThreadStatus.OPEN]: 'Open',
  [ThreadStatus.RESOLVED]: 'Resolved',
  [ThreadStatus.ARCHIVED]: 'Archived',
};

/** Colors for thread status */
export const THREAD_STATUS_COLORS: Record<ThreadStatus, string> = {
  [ThreadStatus.OPEN]: '#3b82f6',      // blue
  [ThreadStatus.RESOLVED]: '#22c55e',  // green
  [ThreadStatus.ARCHIVED]: '#6b7280',  // gray
};

/** Display names for announcement scope */
export const ANNOUNCEMENT_SCOPE_DISPLAY_NAMES: Record<AnnouncementScope, string> = {
  [AnnouncementScope.ALL]: 'All Users',
  [AnnouncementScope.ROLE]: 'By Role',
  [AnnouncementScope.DEPARTMENT]: 'By Department',
  [AnnouncementScope.USER]: 'Specific Users',
  [AnnouncementScope.CUSTOMER]: 'Customer Portal',
};

/** Standard notification template codes */
export const NOTIFICATION_TEMPLATE_CODES = {
  // Order lifecycle
  ORDER_CREATED: 'ORDER_CREATED',
  ORDER_STATUS_CHANGED: 'ORDER_STATUS_CHANGED',
  ORDER_COMPLETED: 'ORDER_COMPLETED',
  ORDER_SHIPPED: 'ORDER_SHIPPED',
  
  // Proofs
  PROOF_UPLOADED: 'PROOF_UPLOADED',
  PROOF_APPROVED: 'PROOF_APPROVED',
  PROOF_REJECTED: 'PROOF_REJECTED',
  PROOF_REMINDER: 'PROOF_REMINDER',
  
  // Quotes
  QUOTE_CREATED: 'QUOTE_CREATED',
  QUOTE_SENT: 'QUOTE_SENT',
  QUOTE_APPROVED: 'QUOTE_APPROVED',
  QUOTE_EXPIRING: 'QUOTE_EXPIRING',
  
  // Invoices
  INVOICE_CREATED: 'INVOICE_CREATED',
  INVOICE_SENT: 'INVOICE_SENT',
  PAYMENT_RECEIVED: 'PAYMENT_RECEIVED',
  PAYMENT_OVERDUE: 'PAYMENT_OVERDUE',
  
  // System
  USER_MENTIONED: 'USER_MENTIONED',
  TASK_ASSIGNED: 'TASK_ASSIGNED',
  MILESTONE_DUE: 'MILESTONE_DUE',
  SYSTEM_ALERT: 'SYSTEM_ALERT',
} as const;

/** Notification categories */
export const NOTIFICATION_CATEGORIES = [
  { value: 'orders', label: 'Orders', icon: '📦' },
  { value: 'proofs', label: 'Proofs', icon: '🖼️' },
  { value: 'quotes', label: 'Quotes', icon: '💰' },
  { value: 'invoices', label: 'Invoices', icon: '🧾' },
  { value: 'shipping', label: 'Shipping', icon: '🚚' },
  { value: 'production', label: 'Production', icon: '🏭' },
  { value: 'inventory', label: 'Inventory', icon: '📊' },
  { value: 'system', label: 'System', icon: '⚙️' },
] as const;

/** Default notification preferences */
export const DEFAULT_NOTIFICATION_PREFERENCES = {
  emailEnabled: true,
  smsEnabled: false,
  pushEnabled: true,
  inAppEnabled: true,
  digestEnabled: false,
  digestFrequency: 'daily',
  digestTime: '09:00',
  timezone: 'America/Chicago',
} as const;

/** Retry settings for failed notifications */
export const NOTIFICATION_RETRY_SETTINGS = {
  maxAttempts: 3,
  initialDelayMs: 5000,        // 5 seconds
  maxDelayMs: 3600000,         // 1 hour
  backoffMultiplier: 2,
} as const;

/** Common announcement banner colors */
export const ANNOUNCEMENT_BANNER_COLORS = [
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Gray', value: '#6b7280' },
] as const;

// ============================================================================
// NEW-CRITICAL-04: EQUIPMENT CALIBRATION & CERTIFICATION CONSTANTS
// ============================================================================

import {
  CalibrationType,
  CalibrationResult,
  CertificationType,
  CertificationStatus,
} from './enums.js';

/** Display names for calibration types */
export const CALIBRATION_TYPE_DISPLAY_NAMES: Record<CalibrationType, string> = {
  [CalibrationType.INITIAL]: 'Initial Calibration',
  [CalibrationType.PERIODIC]: 'Periodic Calibration',
  [CalibrationType.AFTER_REPAIR]: 'Post-Repair Calibration',
  [CalibrationType.AFTER_MOVE]: 'Post-Move Calibration',
  [CalibrationType.VERIFICATION]: 'Verification Check',
  [CalibrationType.ADJUSTMENT]: 'Adjustment Only',
};

/** Icons for calibration types */
export const CALIBRATION_TYPE_ICONS: Record<CalibrationType, string> = {
  [CalibrationType.INITIAL]: '🆕',
  [CalibrationType.PERIODIC]: '🔄',
  [CalibrationType.AFTER_REPAIR]: '🔧',
  [CalibrationType.AFTER_MOVE]: '🚚',
  [CalibrationType.VERIFICATION]: '✅',
  [CalibrationType.ADJUSTMENT]: '🎯',
};

/** Display names for calibration results */
export const CALIBRATION_RESULT_DISPLAY_NAMES: Record<CalibrationResult, string> = {
  [CalibrationResult.PASS]: 'Pass',
  [CalibrationResult.PASS_WITH_ADJUSTMENT]: 'Pass with Adjustment',
  [CalibrationResult.FAIL]: 'Fail',
  [CalibrationResult.CONDITIONAL]: 'Conditional Pass',
  [CalibrationResult.DEFERRED]: 'Deferred',
};

/** Colors for calibration results */
export const CALIBRATION_RESULT_COLORS: Record<CalibrationResult, string> = {
  [CalibrationResult.PASS]: '#22c55e',              // green
  [CalibrationResult.PASS_WITH_ADJUSTMENT]: '#84cc16', // lime
  [CalibrationResult.FAIL]: '#ef4444',              // red
  [CalibrationResult.CONDITIONAL]: '#f59e0b',       // amber
  [CalibrationResult.DEFERRED]: '#6b7280',          // gray
};

/** Display names for certification types */
export const CERTIFICATION_TYPE_DISPLAY_NAMES: Record<CertificationType, string> = {
  [CertificationType.SAFETY]: 'Safety Certification',
  [CertificationType.QUALITY]: 'Quality Certification',
  [CertificationType.ENVIRONMENTAL]: 'Environmental Compliance',
  [CertificationType.CALIBRATION_CERT]: 'Calibration Certificate',
  [CertificationType.OPERATOR]: 'Operator Certification',
  [CertificationType.WARRANTY]: 'Warranty Documentation',
  [CertificationType.INSURANCE]: 'Insurance Certificate',
  [CertificationType.REGULATORY]: 'Regulatory Compliance',
};

/** Icons for certification types */
export const CERTIFICATION_TYPE_ICONS: Record<CertificationType, string> = {
  [CertificationType.SAFETY]: '🛡️',
  [CertificationType.QUALITY]: '✨',
  [CertificationType.ENVIRONMENTAL]: '🌿',
  [CertificationType.CALIBRATION_CERT]: '📏',
  [CertificationType.OPERATOR]: '👤',
  [CertificationType.WARRANTY]: '📜',
  [CertificationType.INSURANCE]: '🏦',
  [CertificationType.REGULATORY]: '⚖️',
};

/** Display names for certification status */
export const CERTIFICATION_STATUS_DISPLAY_NAMES: Record<CertificationStatus, string> = {
  [CertificationStatus.VALID]: 'Valid',
  [CertificationStatus.EXPIRING_SOON]: 'Expiring Soon',
  [CertificationStatus.EXPIRED]: 'Expired',
  [CertificationStatus.SUSPENDED]: 'Suspended',
  [CertificationStatus.REVOKED]: 'Revoked',
  [CertificationStatus.PENDING_RENEWAL]: 'Pending Renewal',
};

/** Colors for certification status */
export const CERTIFICATION_STATUS_COLORS: Record<CertificationStatus, string> = {
  [CertificationStatus.VALID]: '#22c55e',           // green
  [CertificationStatus.EXPIRING_SOON]: '#f59e0b',   // amber
  [CertificationStatus.EXPIRED]: '#ef4444',         // red
  [CertificationStatus.SUSPENDED]: '#f97316',       // orange
  [CertificationStatus.REVOKED]: '#dc2626',         // dark red
  [CertificationStatus.PENDING_RENEWAL]: '#3b82f6', // blue
};

/** Calibration reminder intervals */
export const CALIBRATION_REMINDER_INTERVALS = [
  { days: 7, label: '1 Week Before' },
  { days: 14, label: '2 Weeks Before' },
  { days: 30, label: '1 Month Before' },
  { days: 60, label: '2 Months Before' },
  { days: 90, label: '3 Months Before' },
] as const;

/** Common calibration intervals */
export const STANDARD_CALIBRATION_INTERVALS = [
  { days: 30, label: 'Monthly' },
  { days: 90, label: 'Quarterly' },
  { days: 180, label: 'Semi-Annual' },
  { days: 365, label: 'Annual' },
  { days: 730, label: 'Biennial' },
] as const;

/** Equipment meter types */
export const EQUIPMENT_METER_TYPES = [
  { name: 'Runtime Hours', unit: 'hours', icon: '⏱️' },
  { name: 'Print Count', unit: 'prints', icon: '🖨️' },
  { name: 'Cut Count', unit: 'cuts', icon: '✂️' },
  { name: 'Ink Usage', unit: 'liters', icon: '🎨' },
  { name: 'Media Used', unit: 'sqft', icon: '📐' },
  { name: 'Power Cycles', unit: 'cycles', icon: '🔌' },
] as const;

/** Compliance standards */
export const COMPLIANCE_STANDARDS = [
  'ISO 9001',
  'ISO 14001',
  'OSHA',
  'EPA',
  'NFPA',
  'UL',
  'CE',
  'FCC',
  'Custom',
] as const;

// ============================================================================
// NEW-CRITICAL-05: ADVANCED USER TRAINING & COMPETENCY CONSTANTS
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

/** Display names for training categories */
export const TRAINING_CATEGORY_DISPLAY_NAMES: Record<TrainingCategory, string> = {
  [TrainingCategory.EQUIPMENT_OPERATION]: 'Equipment Operation',
  [TrainingCategory.SAFETY]: 'Safety',
  [TrainingCategory.QUALITY_CONTROL]: 'Quality Control',
  [TrainingCategory.SOFTWARE_SYSTEMS]: 'Software & Systems',
  [TrainingCategory.CUSTOMER_SERVICE]: 'Customer Service',
  [TrainingCategory.PRODUCTION_PROCESS]: 'Production Process',
  [TrainingCategory.MAINTENANCE]: 'Maintenance',
  [TrainingCategory.LEADERSHIP]: 'Leadership',
  [TrainingCategory.COMPLIANCE]: 'Compliance',
  [TrainingCategory.GENERAL]: 'General',
};

/** Icons for training categories */
export const TRAINING_CATEGORY_ICONS: Record<TrainingCategory, string> = {
  [TrainingCategory.EQUIPMENT_OPERATION]: '🖨️',
  [TrainingCategory.SAFETY]: '🛡️',
  [TrainingCategory.QUALITY_CONTROL]: '✅',
  [TrainingCategory.SOFTWARE_SYSTEMS]: '💻',
  [TrainingCategory.CUSTOMER_SERVICE]: '🤝',
  [TrainingCategory.PRODUCTION_PROCESS]: '🏭',
  [TrainingCategory.MAINTENANCE]: '🔧',
  [TrainingCategory.LEADERSHIP]: '👔',
  [TrainingCategory.COMPLIANCE]: '⚖️',
  [TrainingCategory.GENERAL]: '📚',
};

/** Display names for training levels */
export const TRAINING_LEVEL_DISPLAY_NAMES: Record<TrainingLevel, string> = {
  [TrainingLevel.BEGINNER]: 'Beginner',
  [TrainingLevel.INTERMEDIATE]: 'Intermediate',
  [TrainingLevel.ADVANCED]: 'Advanced',
  [TrainingLevel.EXPERT]: 'Expert',
  [TrainingLevel.CERTIFICATION]: 'Certification',
};

/** Colors for training levels */
export const TRAINING_LEVEL_COLORS: Record<TrainingLevel, string> = {
  [TrainingLevel.BEGINNER]: '#22c55e',      // green
  [TrainingLevel.INTERMEDIATE]: '#3b82f6',  // blue
  [TrainingLevel.ADVANCED]: '#8b5cf6',      // purple
  [TrainingLevel.EXPERT]: '#f59e0b',        // amber
  [TrainingLevel.CERTIFICATION]: '#ef4444', // red
};

/** Display names for delivery methods */
export const DELIVERY_METHOD_DISPLAY_NAMES: Record<TrainingDeliveryMethod, string> = {
  [TrainingDeliveryMethod.IN_PERSON]: 'In Person',
  [TrainingDeliveryMethod.ONLINE]: 'Online',
  [TrainingDeliveryMethod.HYBRID]: 'Hybrid',
  [TrainingDeliveryMethod.SELF_PACED]: 'Self-Paced',
  [TrainingDeliveryMethod.ON_THE_JOB]: 'On the Job',
  [TrainingDeliveryMethod.MENTORSHIP]: 'Mentorship',
};

/** Icons for delivery methods */
export const DELIVERY_METHOD_ICONS: Record<TrainingDeliveryMethod, string> = {
  [TrainingDeliveryMethod.IN_PERSON]: '🏢',
  [TrainingDeliveryMethod.ONLINE]: '💻',
  [TrainingDeliveryMethod.HYBRID]: '🔀',
  [TrainingDeliveryMethod.SELF_PACED]: '📖',
  [TrainingDeliveryMethod.ON_THE_JOB]: '🔧',
  [TrainingDeliveryMethod.MENTORSHIP]: '👥',
};

/** Display names for session status */
export const SESSION_STATUS_DISPLAY_NAMES: Record<TrainingSessionStatus, string> = {
  [TrainingSessionStatus.SCHEDULED]: 'Scheduled',
  [TrainingSessionStatus.IN_PROGRESS]: 'In Progress',
  [TrainingSessionStatus.COMPLETED]: 'Completed',
  [TrainingSessionStatus.CANCELLED]: 'Cancelled',
  [TrainingSessionStatus.POSTPONED]: 'Postponed',
};

/** Colors for session status */
export const SESSION_STATUS_COLORS: Record<TrainingSessionStatus, string> = {
  [TrainingSessionStatus.SCHEDULED]: '#3b82f6',  // blue
  [TrainingSessionStatus.IN_PROGRESS]: '#f59e0b', // amber
  [TrainingSessionStatus.COMPLETED]: '#22c55e',   // green
  [TrainingSessionStatus.CANCELLED]: '#ef4444',   // red
  [TrainingSessionStatus.POSTPONED]: '#6b7280',   // gray
};

/** Display names for enrollment status */
export const ENROLLMENT_STATUS_DISPLAY_NAMES: Record<EnrollmentStatus, string> = {
  [EnrollmentStatus.ENROLLED]: 'Enrolled',
  [EnrollmentStatus.WAITLISTED]: 'Waitlisted',
  [EnrollmentStatus.ATTENDED]: 'Attended',
  [EnrollmentStatus.COMPLETED]: 'Completed',
  [EnrollmentStatus.NO_SHOW]: 'No Show',
  [EnrollmentStatus.CANCELLED]: 'Cancelled',
  [EnrollmentStatus.FAILED]: 'Failed',
};

/** Colors for enrollment status */
export const ENROLLMENT_STATUS_COLORS: Record<EnrollmentStatus, string> = {
  [EnrollmentStatus.ENROLLED]: '#3b82f6',    // blue
  [EnrollmentStatus.WAITLISTED]: '#f59e0b',  // amber
  [EnrollmentStatus.ATTENDED]: '#8b5cf6',    // purple
  [EnrollmentStatus.COMPLETED]: '#22c55e',   // green
  [EnrollmentStatus.NO_SHOW]: '#f97316',     // orange
  [EnrollmentStatus.CANCELLED]: '#6b7280',   // gray
  [EnrollmentStatus.FAILED]: '#ef4444',      // red
};

/** Display names for competency types */
export const COMPETENCY_TYPE_DISPLAY_NAMES: Record<CompetencyType, string> = {
  [CompetencyType.EQUIPMENT_OPERATION]: 'Equipment Operation',
  [CompetencyType.STATION_CERTIFICATION]: 'Station Certification',
  [CompetencyType.SAFETY_CERTIFICATION]: 'Safety Certification',
  [CompetencyType.SOFTWARE_PROFICIENCY]: 'Software Proficiency',
  [CompetencyType.QUALITY_CERTIFICATION]: 'Quality Certification',
  [CompetencyType.SPECIALIZED_SKILL]: 'Specialized Skill',
  [CompetencyType.LICENSE]: 'License',
  [CompetencyType.GENERAL_TRAINING]: 'General Training',
};

/** Display names for competency status */
export const COMPETENCY_STATUS_DISPLAY_NAMES: Record<CompetencyStatus, string> = {
  [CompetencyStatus.ACTIVE]: 'Active',
  [CompetencyStatus.EXPIRING_SOON]: 'Expiring Soon',
  [CompetencyStatus.EXPIRED]: 'Expired',
  [CompetencyStatus.SUSPENDED]: 'Suspended',
  [CompetencyStatus.REVOKED]: 'Revoked',
};

/** Colors for competency status */
export const COMPETENCY_STATUS_COLORS: Record<CompetencyStatus, string> = {
  [CompetencyStatus.ACTIVE]: '#22c55e',       // green
  [CompetencyStatus.EXPIRING_SOON]: '#f59e0b', // amber
  [CompetencyStatus.EXPIRED]: '#ef4444',       // red
  [CompetencyStatus.SUSPENDED]: '#f97316',     // orange
  [CompetencyStatus.REVOKED]: '#dc2626',       // dark red
};

/** Display names for training target types */
export const TRAINING_TARGET_TYPE_DISPLAY_NAMES: Record<TrainingTargetType, string> = {
  [TrainingTargetType.ROLE]: 'Role',
  [TrainingTargetType.DEPARTMENT]: 'Department',
  [TrainingTargetType.ALL_USERS]: 'All Users',
  [TrainingTargetType.STATION]: 'Station',
};

/** Display names for training priority */
export const TRAINING_PRIORITY_DISPLAY_NAMES: Record<TrainingPriorityLevel, string> = {
  [TrainingPriorityLevel.REQUIRED]: 'Required',
  [TrainingPriorityLevel.RECOMMENDED]: 'Recommended',
  [TrainingPriorityLevel.OPTIONAL]: 'Optional',
};

/** Colors for training priority */
export const TRAINING_PRIORITY_COLORS: Record<TrainingPriorityLevel, string> = {
  [TrainingPriorityLevel.REQUIRED]: '#ef4444',    // red
  [TrainingPriorityLevel.RECOMMENDED]: '#f59e0b', // amber
  [TrainingPriorityLevel.OPTIONAL]: '#22c55e',    // green
};

/** Competency expiration warning days */
export const COMPETENCY_EXPIRY_WARNING_DAYS = [30, 60, 90] as const;

/** Default passing score for assessments */
export const DEFAULT_PASSING_SCORE = 70;

// ============================================================================
// NEW-CRITICAL-06: VENDOR RELATIONSHIP MANAGEMENT CONSTANTS
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

/** Display names for vendor contract types */
export const CONTRACT_TYPE_DISPLAY_NAMES: Record<VendorContractType, string> = {
  [VendorContractType.MASTER_AGREEMENT]: 'Master Agreement',
  [VendorContractType.BLANKET_PURCHASE]: 'Blanket Purchase',
  [VendorContractType.FIXED_PRICE]: 'Fixed Price',
  [VendorContractType.TIME_AND_MATERIALS]: 'Time & Materials',
  [VendorContractType.CONSIGNMENT]: 'Consignment',
  [VendorContractType.EXCLUSIVE]: 'Exclusive',
  [VendorContractType.DISTRIBUTOR]: 'Distributor',
  [VendorContractType.SERVICE_LEVEL]: 'Service Level Agreement',
  [VendorContractType.LEASE]: 'Lease',
  [VendorContractType.MAINTENANCE]: 'Maintenance',
};

/** Display names for contract status */
export const CONTRACT_STATUS_DISPLAY_NAMES: Record<ContractStatus, string> = {
  [ContractStatus.DRAFT]: 'Draft',
  [ContractStatus.PENDING_APPROVAL]: 'Pending Approval',
  [ContractStatus.ACTIVE]: 'Active',
  [ContractStatus.EXPIRING_SOON]: 'Expiring Soon',
  [ContractStatus.EXPIRED]: 'Expired',
  [ContractStatus.TERMINATED]: 'Terminated',
  [ContractStatus.SUSPENDED]: 'Suspended',
  [ContractStatus.RENEWED]: 'Renewed',
};

/** Colors for contract status */
export const CONTRACT_STATUS_COLORS: Record<ContractStatus, string> = {
  [ContractStatus.DRAFT]: '#6b7280',           // gray
  [ContractStatus.PENDING_APPROVAL]: '#f59e0b', // amber
  [ContractStatus.ACTIVE]: '#22c55e',          // green
  [ContractStatus.EXPIRING_SOON]: '#f97316',   // orange
  [ContractStatus.EXPIRED]: '#ef4444',         // red
  [ContractStatus.TERMINATED]: '#dc2626',      // dark red
  [ContractStatus.SUSPENDED]: '#8b5cf6',       // purple
  [ContractStatus.RENEWED]: '#3b82f6',         // blue
};

/** Display names for vendor pricing types */
export const PRICING_TYPE_DISPLAY_NAMES: Record<VendorPricingType, string> = {
  [VendorPricingType.LIST_PRICE]: 'List Price',
  [VendorPricingType.CONTRACT_PRICE]: 'Contract Price',
  [VendorPricingType.VOLUME_PRICE]: 'Volume Price',
  [VendorPricingType.PROMOTIONAL]: 'Promotional',
  [VendorPricingType.SPOT_PRICE]: 'Spot Price',
  [VendorPricingType.COST_PLUS]: 'Cost Plus',
};

/** Display names for vendor certification types */
export const VENDOR_CERT_TYPE_DISPLAY_NAMES: Record<VendorCertificationType, string> = {
  [VendorCertificationType.ISO_9001]: 'ISO 9001 (Quality)',
  [VendorCertificationType.ISO_14001]: 'ISO 14001 (Environmental)',
  [VendorCertificationType.ISO_27001]: 'ISO 27001 (Security)',
  [VendorCertificationType.OSHA_COMPLIANCE]: 'OSHA Compliance',
  [VendorCertificationType.MINORITY_OWNED]: 'Minority-Owned Business',
  [VendorCertificationType.WOMAN_OWNED]: 'Woman-Owned Business',
  [VendorCertificationType.VETERAN_OWNED]: 'Veteran-Owned Business',
  [VendorCertificationType.SMALL_BUSINESS]: 'Small Business',
  [VendorCertificationType.LIABILITY_INSURANCE]: 'Liability Insurance',
  [VendorCertificationType.WORKERS_COMP]: 'Workers Compensation',
  [VendorCertificationType.PROFESSIONAL_LICENSE]: 'Professional License',
  [VendorCertificationType.TRADE_CERTIFICATION]: 'Trade Certification',
  [VendorCertificationType.ENVIRONMENTAL_PERMIT]: 'Environmental Permit',
  [VendorCertificationType.CREDIT_RATING]: 'Credit Rating',
  [VendorCertificationType.BONDING]: 'Performance Bonding',
  [VendorCertificationType.OTHER]: 'Other',
};

/** Icons for vendor certification types */
export const VENDOR_CERT_TYPE_ICONS: Record<VendorCertificationType, string> = {
  [VendorCertificationType.ISO_9001]: '✅',
  [VendorCertificationType.ISO_14001]: '🌿',
  [VendorCertificationType.ISO_27001]: '🔒',
  [VendorCertificationType.OSHA_COMPLIANCE]: '🛡️',
  [VendorCertificationType.MINORITY_OWNED]: '🏢',
  [VendorCertificationType.WOMAN_OWNED]: '👩‍💼',
  [VendorCertificationType.VETERAN_OWNED]: '🎖️',
  [VendorCertificationType.SMALL_BUSINESS]: '🏪',
  [VendorCertificationType.LIABILITY_INSURANCE]: '📋',
  [VendorCertificationType.WORKERS_COMP]: '🏥',
  [VendorCertificationType.PROFESSIONAL_LICENSE]: '📜',
  [VendorCertificationType.TRADE_CERTIFICATION]: '🔧',
  [VendorCertificationType.ENVIRONMENTAL_PERMIT]: '🌍',
  [VendorCertificationType.CREDIT_RATING]: '💳',
  [VendorCertificationType.BONDING]: '🤝',
  [VendorCertificationType.OTHER]: '📄',
};

/** Display names for quote request types */
export const QUOTE_REQUEST_TYPE_DISPLAY_NAMES: Record<QuoteRequestType, string> = {
  [QuoteRequestType.RFQ]: 'Request for Quote (RFQ)',
  [QuoteRequestType.RFP]: 'Request for Proposal (RFP)',
  [QuoteRequestType.RFI]: 'Request for Information (RFI)',
  [QuoteRequestType.EMERGENCY]: 'Emergency Quote',
  [QuoteRequestType.REBID]: 'Re-bid Request',
};

/** Display names for quote request status */
export const QUOTE_REQUEST_STATUS_DISPLAY_NAMES: Record<QuoteRequestStatus, string> = {
  [QuoteRequestStatus.DRAFT]: 'Draft',
  [QuoteRequestStatus.SENT]: 'Sent',
  [QuoteRequestStatus.RESPONSES_RECEIVED]: 'Responses Received',
  [QuoteRequestStatus.UNDER_REVIEW]: 'Under Review',
  [QuoteRequestStatus.AWARDED]: 'Awarded',
  [QuoteRequestStatus.CANCELLED]: 'Cancelled',
  [QuoteRequestStatus.EXPIRED]: 'Expired',
};

/** Colors for quote request status */
export const QUOTE_REQUEST_STATUS_COLORS: Record<QuoteRequestStatus, string> = {
  [QuoteRequestStatus.DRAFT]: '#6b7280',         // gray
  [QuoteRequestStatus.SENT]: '#3b82f6',          // blue
  [QuoteRequestStatus.RESPONSES_RECEIVED]: '#8b5cf6', // purple
  [QuoteRequestStatus.UNDER_REVIEW]: '#f59e0b',  // amber
  [QuoteRequestStatus.AWARDED]: '#22c55e',       // green
  [QuoteRequestStatus.CANCELLED]: '#ef4444',     // red
  [QuoteRequestStatus.EXPIRED]: '#9ca3af',       // gray-400
};

/** Display names for quote response status */
export const QUOTE_RESPONSE_STATUS_DISPLAY_NAMES: Record<QuoteResponseStatus, string> = {
  [QuoteResponseStatus.PENDING]: 'Pending',
  [QuoteResponseStatus.SENT]: 'Sent',
  [QuoteResponseStatus.RECEIVED]: 'Received',
  [QuoteResponseStatus.NO_RESPONSE]: 'No Response',
  [QuoteResponseStatus.DECLINED]: 'Declined',
  [QuoteResponseStatus.UNDER_REVIEW]: 'Under Review',
  [QuoteResponseStatus.SELECTED]: 'Selected',
  [QuoteResponseStatus.NOT_SELECTED]: 'Not Selected',
};

/** Colors for quote response status */
export const QUOTE_RESPONSE_STATUS_COLORS: Record<QuoteResponseStatus, string> = {
  [QuoteResponseStatus.PENDING]: '#6b7280',      // gray
  [QuoteResponseStatus.SENT]: '#3b82f6',         // blue
  [QuoteResponseStatus.RECEIVED]: '#8b5cf6',     // purple
  [QuoteResponseStatus.NO_RESPONSE]: '#f97316',  // orange
  [QuoteResponseStatus.DECLINED]: '#ef4444',     // red
  [QuoteResponseStatus.UNDER_REVIEW]: '#f59e0b', // amber
  [QuoteResponseStatus.SELECTED]: '#22c55e',     // green
  [QuoteResponseStatus.NOT_SELECTED]: '#9ca3af', // gray-400
};

/** Contract expiry warning thresholds */
export const CONTRACT_EXPIRY_WARNING_DAYS = [30, 60, 90, 180] as const;

/** Standard payment terms options */
export const STANDARD_PAYMENT_TERMS = [
  'Due on Receipt',
  'Net 15',
  'Net 30',
  'Net 45',
  'Net 60',
  'Net 90',
  '2/10 Net 30',
  '1/10 Net 30',
  'COD',
] as const;

/** Vendor rating categories */
export const VENDOR_RATING_CATEGORIES = [
  { key: 'quality', label: 'Quality', description: 'Product/service quality' },
  { key: 'delivery', label: 'Delivery', description: 'On-time delivery performance' },
  { key: 'price', label: 'Price', description: 'Value for money' },
  { key: 'communication', label: 'Communication', description: 'Responsiveness and clarity' },
  { key: 'overall', label: 'Overall', description: 'Overall satisfaction' },
] as const;

// ============================================================================
// NEW-CRITICAL-07: ADVANCED SHIPPING & LOGISTICS CONSTANTS
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

/** Display names for shipping rate types */
export const SHIPPING_RATE_TYPE_DISPLAY_NAMES: Record<ShippingRateType, string> = {
  [ShippingRateType.WEIGHT_BASED]: 'Weight-Based',
  [ShippingRateType.FLAT_RATE]: 'Flat Rate',
  [ShippingRateType.DIMENSIONAL]: 'Dimensional',
  [ShippingRateType.CUSTOM]: 'Custom',
};

/** Display names for freight types */
export const FREIGHT_TYPE_DISPLAY_NAMES: Record<FreightType, string> = {
  [FreightType.LTL]: 'Less Than Truckload (LTL)',
  [FreightType.FTL]: 'Full Truckload (FTL)',
  [FreightType.PARTIAL_TL]: 'Partial Truckload',
  [FreightType.EXPEDITED]: 'Expedited',
  [FreightType.WHITE_GLOVE]: 'White Glove',
  [FreightType.FLATBED]: 'Flatbed/Specialized',
};

/** Display names for freight quote status */
export const FREIGHT_QUOTE_STATUS_DISPLAY_NAMES: Record<FreightQuoteStatus, string> = {
  [FreightQuoteStatus.DRAFT]: 'Draft',
  [FreightQuoteStatus.QUOTING]: 'Getting Quotes',
  [FreightQuoteStatus.QUOTED]: 'Quoted',
  [FreightQuoteStatus.BOOKED]: 'Booked',
  [FreightQuoteStatus.PICKED_UP]: 'Picked Up',
  [FreightQuoteStatus.IN_TRANSIT]: 'In Transit',
  [FreightQuoteStatus.DELIVERED]: 'Delivered',
  [FreightQuoteStatus.CANCELLED]: 'Cancelled',
};

/** Colors for freight quote status */
export const FREIGHT_QUOTE_STATUS_COLORS: Record<FreightQuoteStatus, string> = {
  [FreightQuoteStatus.DRAFT]: '#6b7280',        // gray
  [FreightQuoteStatus.QUOTING]: '#3b82f6',      // blue
  [FreightQuoteStatus.QUOTED]: '#8b5cf6',       // purple
  [FreightQuoteStatus.BOOKED]: '#f59e0b',       // amber
  [FreightQuoteStatus.PICKED_UP]: '#10b981',    // emerald
  [FreightQuoteStatus.IN_TRANSIT]: '#06b6d4',   // cyan
  [FreightQuoteStatus.DELIVERED]: '#22c55e',    // green
  [FreightQuoteStatus.CANCELLED]: '#ef4444',    // red
};

/** Display names for delivery route status */
export const DELIVERY_ROUTE_STATUS_DISPLAY_NAMES: Record<DeliveryRouteStatus, string> = {
  [DeliveryRouteStatus.PLANNED]: 'Planned',
  [DeliveryRouteStatus.IN_PROGRESS]: 'In Progress',
  [DeliveryRouteStatus.COMPLETED]: 'Completed',
  [DeliveryRouteStatus.CANCELLED]: 'Cancelled',
};

/** Colors for delivery route status */
export const DELIVERY_ROUTE_STATUS_COLORS: Record<DeliveryRouteStatus, string> = {
  [DeliveryRouteStatus.PLANNED]: '#3b82f6',     // blue
  [DeliveryRouteStatus.IN_PROGRESS]: '#f59e0b', // amber
  [DeliveryRouteStatus.COMPLETED]: '#22c55e',   // green
  [DeliveryRouteStatus.CANCELLED]: '#ef4444',   // red
};

/** Display names for delivery stop types */
export const DELIVERY_STOP_TYPE_DISPLAY_NAMES: Record<DeliveryStopType, string> = {
  [DeliveryStopType.DELIVERY]: 'Delivery',
  [DeliveryStopType.PICKUP]: 'Pickup',
  [DeliveryStopType.SIGNATURE_ONLY]: 'Signature Only',
  [DeliveryStopType.SERVICE_CALL]: 'Service Call',
};

/** Icons for delivery stop types */
export const DELIVERY_STOP_TYPE_ICONS: Record<DeliveryStopType, string> = {
  [DeliveryStopType.DELIVERY]: '📦',
  [DeliveryStopType.PICKUP]: '📤',
  [DeliveryStopType.SIGNATURE_ONLY]: '✍️',
  [DeliveryStopType.SERVICE_CALL]: '🔧',
};

/** Display names for delivery stop status */
export const DELIVERY_STOP_STATUS_DISPLAY_NAMES: Record<DeliveryStopStatus, string> = {
  [DeliveryStopStatus.PENDING]: 'Pending',
  [DeliveryStopStatus.EN_ROUTE]: 'En Route',
  [DeliveryStopStatus.ARRIVED]: 'Arrived',
  [DeliveryStopStatus.COMPLETED]: 'Completed',
  [DeliveryStopStatus.FAILED]: 'Failed',
  [DeliveryStopStatus.SKIPPED]: 'Skipped',
};

/** Colors for delivery stop status */
export const DELIVERY_STOP_STATUS_COLORS: Record<DeliveryStopStatus, string> = {
  [DeliveryStopStatus.PENDING]: '#6b7280',     // gray
  [DeliveryStopStatus.EN_ROUTE]: '#3b82f6',    // blue
  [DeliveryStopStatus.ARRIVED]: '#f59e0b',     // amber
  [DeliveryStopStatus.COMPLETED]: '#22c55e',   // green
  [DeliveryStopStatus.FAILED]: '#ef4444',      // red
  [DeliveryStopStatus.SKIPPED]: '#9ca3af',     // gray-400
};

/** Display names for tracking event types */
export const TRACKING_EVENT_TYPE_DISPLAY_NAMES: Record<TrackingEventType, string> = {
  [TrackingEventType.LABEL_CREATED]: 'Label Created',
  [TrackingEventType.PICKED_UP]: 'Picked Up',
  [TrackingEventType.IN_TRANSIT]: 'In Transit',
  [TrackingEventType.OUT_FOR_DELIVERY]: 'Out for Delivery',
  [TrackingEventType.DELIVERED]: 'Delivered',
  [TrackingEventType.DELIVERY_ATTEMPT]: 'Delivery Attempted',
  [TrackingEventType.EXCEPTION]: 'Exception',
  [TrackingEventType.RETURNED]: 'Returned to Sender',
  [TrackingEventType.HELD]: 'Held at Facility',
  [TrackingEventType.CUSTOMS]: 'In Customs',
};

/** Icons for tracking event types */
export const TRACKING_EVENT_TYPE_ICONS: Record<TrackingEventType, string> = {
  [TrackingEventType.LABEL_CREATED]: '🏷️',
  [TrackingEventType.PICKED_UP]: '📤',
  [TrackingEventType.IN_TRANSIT]: '🚚',
  [TrackingEventType.OUT_FOR_DELIVERY]: '📍',
  [TrackingEventType.DELIVERED]: '✅',
  [TrackingEventType.DELIVERY_ATTEMPT]: '🔔',
  [TrackingEventType.EXCEPTION]: '⚠️',
  [TrackingEventType.RETURNED]: '↩️',
  [TrackingEventType.HELD]: '🏢',
  [TrackingEventType.CUSTOMS]: '🛃',
};

/** Standard freight classes */
export const FREIGHT_CLASSES = [
  { class: '50', density: '50+', description: 'Fits on standard pallet, durable' },
  { class: '55', density: '35-50', description: 'Bricks, hardwood flooring' },
  { class: '60', density: '30-35', description: 'Car parts, iron' },
  { class: '65', density: '22.5-30', description: 'Car parts, bottled drinks' },
  { class: '70', density: '15-22.5', description: 'Automobile parts, food items' },
  { class: '77.5', density: '13.5-15', description: 'Tires, bathroom fixtures' },
  { class: '85', density: '12-13.5', description: 'Crated machinery, cast iron' },
  { class: '92.5', density: '10.5-12', description: 'Computers, monitors' },
  { class: '100', density: '9-10.5', description: 'Boat covers, car covers' },
  { class: '110', density: '8-9', description: 'Cabinets, framed artwork' },
  { class: '125', density: '7-8', description: 'Small household appliances' },
  { class: '150', density: '6-7', description: 'Auto sheet metal parts' },
  { class: '175', density: '5-6', description: 'Clothing, couches' },
  { class: '200', density: '4-5', description: 'Auto sheet metal parts, aircraft parts' },
  { class: '250', density: '3-4', description: 'Bamboo furniture, mattresses' },
  { class: '300', density: '2-3', description: 'Wood cabinets, tables' },
  { class: '400', density: '1-2', description: 'Deer antlers' },
  { class: '500', density: '<1', description: 'Bags of gold dust, ping pong balls' },
] as const;

/** Common carrier service codes */
export const CARRIER_SERVICES = {
  UPS: [
    { code: 'GND', name: 'UPS Ground', transitDays: '1-5' },
    { code: '3DS', name: 'UPS 3 Day Select', transitDays: '3' },
    { code: '2DA', name: 'UPS 2nd Day Air', transitDays: '2' },
    { code: '1DA', name: 'UPS Next Day Air', transitDays: '1' },
    { code: '1DP', name: 'UPS Next Day Air Early', transitDays: '1' },
  ],
  FEDEX: [
    { code: 'GROUND', name: 'FedEx Ground', transitDays: '1-5' },
    { code: 'EXPRESS', name: 'FedEx Express Saver', transitDays: '3' },
    { code: '2DAY', name: 'FedEx 2Day', transitDays: '2' },
    { code: 'PRIORITY', name: 'FedEx Priority Overnight', transitDays: '1' },
    { code: 'STANDARD', name: 'FedEx Standard Overnight', transitDays: '1' },
  ],
  USPS: [
    { code: 'PARCEL', name: 'USPS Parcel Select Ground', transitDays: '2-8' },
    { code: 'PRIORITY', name: 'USPS Priority Mail', transitDays: '1-3' },
    { code: 'EXPRESS', name: 'USPS Priority Mail Express', transitDays: '1-2' },
  ],
} as const;

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

/** Revision entity type display names */
export const REVISION_ENTITY_TYPE_DISPLAY_NAMES: Record<RevisionEntityType, string> = {
  [RevisionEntityType.WORK_ORDER]: 'Work Order',
  [RevisionEntityType.QUOTE]: 'Quote',
  [RevisionEntityType.LINE_ITEM]: 'Line Item',
  [RevisionEntityType.DESIGN_FILE]: 'Design File',
  [RevisionEntityType.BOM]: 'Bill of Materials',
  [RevisionEntityType.BOM_ITEM]: 'BOM Item',
  [RevisionEntityType.CUSTOMER]: 'Customer',
  [RevisionEntityType.PRODUCT]: 'Product',
  [RevisionEntityType.PRICING_RULE]: 'Pricing Rule',
  [RevisionEntityType.TEMPLATE]: 'Template',
  [RevisionEntityType.VENDOR]: 'Vendor',
  [RevisionEntityType.ITEM_MASTER]: 'Item Master',
};

/** Revision type display names */
export const REVISION_TYPE_DISPLAY_NAMES: Record<RevisionType, string> = {
  [RevisionType.INITIAL_VERSION]: 'Initial Version',
  [RevisionType.MINOR_CHANGE]: 'Minor Change',
  [RevisionType.MAJOR_CHANGE]: 'Major Change',
  [RevisionType.CORRECTION]: 'Correction',
  [RevisionType.ROLLBACK]: 'Rollback',
  [RevisionType.MERGE]: 'Merge',
  [RevisionType.BRANCH]: 'Branch',
  [RevisionType.AUTO_SAVE]: 'Auto-Save',
};

/** Revision type icons */
export const REVISION_TYPE_ICONS: Record<RevisionType, string> = {
  [RevisionType.INITIAL_VERSION]: 'plus-circle',
  [RevisionType.MINOR_CHANGE]: 'edit',
  [RevisionType.MAJOR_CHANGE]: 'edit-2',
  [RevisionType.CORRECTION]: 'check-circle',
  [RevisionType.ROLLBACK]: 'rotate-ccw',
  [RevisionType.MERGE]: 'git-merge',
  [RevisionType.BRANCH]: 'git-branch',
  [RevisionType.AUTO_SAVE]: 'save',
};

/** Change reason display names */
export const CHANGE_REASON_DISPLAY_NAMES: Record<ChangeReason, string> = {
  [ChangeReason.CUSTOMER_REQUEST]: 'Customer Request',
  [ChangeReason.DESIGN_ERROR]: 'Design Error',
  [ChangeReason.SPECIFICATION_CHANGE]: 'Specification Change',
  [ChangeReason.MATERIAL_SUBSTITUTION]: 'Material Substitution',
  [ChangeReason.PRICING_ADJUSTMENT]: 'Pricing Adjustment',
  [ChangeReason.SCHEDULE_CHANGE]: 'Schedule Change',
  [ChangeReason.QUALITY_ISSUE]: 'Quality Issue',
  [ChangeReason.REGULATORY_REQUIREMENT]: 'Regulatory Requirement',
  [ChangeReason.COST_OPTIMIZATION]: 'Cost Optimization',
  [ChangeReason.SCOPE_ADDITION]: 'Scope Addition',
  [ChangeReason.SCOPE_REDUCTION]: 'Scope Reduction',
  [ChangeReason.OTHER]: 'Other',
};

/** Revision status display names */
export const REVISION_STATUS_DISPLAY_NAMES: Record<RevisionStatus, string> = {
  [RevisionStatus.DRAFT]: 'Draft',
  [RevisionStatus.PENDING_REVIEW]: 'Pending Review',
  [RevisionStatus.PENDING_APPROVAL]: 'Pending Approval',
  [RevisionStatus.APPROVED]: 'Approved',
  [RevisionStatus.REJECTED]: 'Rejected',
  [RevisionStatus.SUPERSEDED]: 'Superseded',
  [RevisionStatus.ARCHIVED]: 'Archived',
};

/** Revision status colors */
export const REVISION_STATUS_COLORS: Record<RevisionStatus, string> = {
  [RevisionStatus.DRAFT]: 'gray',
  [RevisionStatus.PENDING_REVIEW]: 'yellow',
  [RevisionStatus.PENDING_APPROVAL]: 'orange',
  [RevisionStatus.APPROVED]: 'green',
  [RevisionStatus.REJECTED]: 'red',
  [RevisionStatus.SUPERSEDED]: 'purple',
  [RevisionStatus.ARCHIVED]: 'slate',
};

/** Approval workflow display names */
export const APPROVAL_WORKFLOW_DISPLAY_NAMES: Record<ApprovalWorkflow, string> = {
  [ApprovalWorkflow.NONE]: 'No Approval Required',
  [ApprovalWorkflow.MANAGER_ONLY]: 'Manager Approval',
  [ApprovalWorkflow.CUSTOMER_ONLY]: 'Customer Approval',
  [ApprovalWorkflow.MANAGER_THEN_CUSTOMER]: 'Manager → Customer',
  [ApprovalWorkflow.CUSTOMER_THEN_MANAGER]: 'Customer → Manager',
  [ApprovalWorkflow.PARALLEL_APPROVAL]: 'Parallel Approval',
  [ApprovalWorkflow.CUSTOM]: 'Custom Workflow',
};

/** Design version status display names */
export const DESIGN_VERSION_STATUS_DISPLAY_NAMES: Record<DesignVersionStatus, string> = {
  [DesignVersionStatus.DRAFT]: 'Draft',
  [DesignVersionStatus.REVIEW]: 'Under Review',
  [DesignVersionStatus.APPROVED]: 'Approved',
  [DesignVersionStatus.REJECTED]: 'Rejected',
  [DesignVersionStatus.SUPERSEDED]: 'Superseded',
  [DesignVersionStatus.ARCHIVED]: 'Archived',
};

/** Design version status colors */
export const DESIGN_VERSION_STATUS_COLORS: Record<DesignVersionStatus, string> = {
  [DesignVersionStatus.DRAFT]: 'gray',
  [DesignVersionStatus.REVIEW]: 'yellow',
  [DesignVersionStatus.APPROVED]: 'green',
  [DesignVersionStatus.REJECTED]: 'red',
  [DesignVersionStatus.SUPERSEDED]: 'purple',
  [DesignVersionStatus.ARCHIVED]: 'slate',
};

/** Change order type display names */
export const CHANGE_ORDER_TYPE_DISPLAY_NAMES: Record<ChangeOrderType, string> = {
  [ChangeOrderType.SCOPE_ADDITION]: 'Scope Addition',
  [ChangeOrderType.SCOPE_REDUCTION]: 'Scope Reduction',
  [ChangeOrderType.SPECIFICATION_CHANGE]: 'Specification Change',
  [ChangeOrderType.SCHEDULE_CHANGE]: 'Schedule Change',
  [ChangeOrderType.MATERIAL_CHANGE]: 'Material Change',
  [ChangeOrderType.DESIGN_REVISION]: 'Design Revision',
  [ChangeOrderType.PRICING_ADJUSTMENT]: 'Pricing Adjustment',
  [ChangeOrderType.DELIVERY_CHANGE]: 'Delivery Change',
  [ChangeOrderType.CANCELLATION]: 'Cancellation',
};

/** Change order type icons */
export const CHANGE_ORDER_TYPE_ICONS: Record<ChangeOrderType, string> = {
  [ChangeOrderType.SCOPE_ADDITION]: 'plus',
  [ChangeOrderType.SCOPE_REDUCTION]: 'minus',
  [ChangeOrderType.SPECIFICATION_CHANGE]: 'file-text',
  [ChangeOrderType.SCHEDULE_CHANGE]: 'calendar',
  [ChangeOrderType.MATERIAL_CHANGE]: 'package',
  [ChangeOrderType.DESIGN_REVISION]: 'image',
  [ChangeOrderType.PRICING_ADJUSTMENT]: 'dollar-sign',
  [ChangeOrderType.DELIVERY_CHANGE]: 'truck',
  [ChangeOrderType.CANCELLATION]: 'x-circle',
};

/** Change order priority display names */
export const CHANGE_ORDER_PRIORITY_DISPLAY_NAMES: Record<ChangeOrderPriority, string> = {
  [ChangeOrderPriority.LOW]: 'Low',
  [ChangeOrderPriority.NORMAL]: 'Normal',
  [ChangeOrderPriority.HIGH]: 'High',
  [ChangeOrderPriority.URGENT]: 'Urgent',
  [ChangeOrderPriority.CRITICAL]: 'Critical',
};

/** Change order priority colors */
export const CHANGE_ORDER_PRIORITY_COLORS: Record<ChangeOrderPriority, string> = {
  [ChangeOrderPriority.LOW]: 'slate',
  [ChangeOrderPriority.NORMAL]: 'blue',
  [ChangeOrderPriority.HIGH]: 'yellow',
  [ChangeOrderPriority.URGENT]: 'orange',
  [ChangeOrderPriority.CRITICAL]: 'red',
};

/** Change order status display names */
export const CHANGE_ORDER_STATUS_DISPLAY_NAMES: Record<ChangeOrderStatus, string> = {
  [ChangeOrderStatus.DRAFT]: 'Draft',
  [ChangeOrderStatus.SUBMITTED]: 'Submitted',
  [ChangeOrderStatus.UNDER_REVIEW]: 'Under Review',
  [ChangeOrderStatus.PENDING_CUSTOMER]: 'Pending Customer',
  [ChangeOrderStatus.APPROVED]: 'Approved',
  [ChangeOrderStatus.REJECTED]: 'Rejected',
  [ChangeOrderStatus.IMPLEMENTED]: 'Implemented',
  [ChangeOrderStatus.CANCELLED]: 'Cancelled',
};

/** Change order status colors */
export const CHANGE_ORDER_STATUS_COLORS: Record<ChangeOrderStatus, string> = {
  [ChangeOrderStatus.DRAFT]: 'gray',
  [ChangeOrderStatus.SUBMITTED]: 'blue',
  [ChangeOrderStatus.UNDER_REVIEW]: 'yellow',
  [ChangeOrderStatus.PENDING_CUSTOMER]: 'orange',
  [ChangeOrderStatus.APPROVED]: 'green',
  [ChangeOrderStatus.REJECTED]: 'red',
  [ChangeOrderStatus.IMPLEMENTED]: 'emerald',
  [ChangeOrderStatus.CANCELLED]: 'slate',
};

/** Change request source display names */
export const CHANGE_REQUEST_SOURCE_DISPLAY_NAMES: Record<ChangeRequestSource, string> = {
  [ChangeRequestSource.INTERNAL]: 'Internal',
  [ChangeRequestSource.CUSTOMER]: 'Customer',
  [ChangeRequestSource.VENDOR]: 'Vendor',
  [ChangeRequestSource.QUALITY]: 'Quality Team',
  [ChangeRequestSource.REGULATORY]: 'Regulatory',
};

/** Change approval status display names */
export const CHANGE_APPROVAL_STATUS_DISPLAY_NAMES: Record<ChangeApprovalStatus, string> = {
  [ChangeApprovalStatus.NOT_REQUIRED]: 'Not Required',
  [ChangeApprovalStatus.PENDING]: 'Pending',
  [ChangeApprovalStatus.APPROVED]: 'Approved',
  [ChangeApprovalStatus.REJECTED]: 'Rejected',
  [ChangeApprovalStatus.SKIPPED]: 'Skipped',
};

/** Change approval status colors */
export const CHANGE_APPROVAL_STATUS_COLORS: Record<ChangeApprovalStatus, string> = {
  [ChangeApprovalStatus.NOT_REQUIRED]: 'gray',
  [ChangeApprovalStatus.PENDING]: 'yellow',
  [ChangeApprovalStatus.APPROVED]: 'green',
  [ChangeApprovalStatus.REJECTED]: 'red',
  [ChangeApprovalStatus.SKIPPED]: 'slate',
};

/** Version control configuration */
export const VERSION_CONTROL_CONFIG = {
  maxAutoSaveVersions: 10,
  autoSaveIntervalSeconds: 300,
  retainArchivedVersionsDays: 365,
  maxVersionsPerEntity: 100,
  requireApprovalForMajorChanges: true,
  defaultApprovalWorkflow: ApprovalWorkflow.MANAGER_ONLY,
} as const;

/** Change order configuration */
export const CHANGE_ORDER_CONFIG = {
  numberPrefix: 'CO',
  requireJustification: true,
  requireImpactAnalysis: true,
  autoCreateRevisionOnImplement: true,
  notifyCustomerOnApproval: true,
  requireSignatureForPricingChanges: true,
} as const;

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

/** Material category display names */
export const MATERIAL_CATEGORY_DISPLAY_NAMES: Record<MaterialCategory, string> = {
  [MaterialCategory.VINYL]: 'Vinyl',
  [MaterialCategory.ALUMINUM]: 'Aluminum',
  [MaterialCategory.ACRYLIC]: 'Acrylic',
  [MaterialCategory.WOOD]: 'Wood',
  [MaterialCategory.STEEL]: 'Steel',
  [MaterialCategory.PLASTIC]: 'Plastic',
  [MaterialCategory.PAPER]: 'Paper',
  [MaterialCategory.FABRIC]: 'Fabric',
  [MaterialCategory.COMPOSITE]: 'Composite',
  [MaterialCategory.ELECTRONIC]: 'Electronic',
  [MaterialCategory.INK]: 'Ink',
  [MaterialCategory.ADHESIVE]: 'Adhesive',
  [MaterialCategory.OTHER]: 'Other',
};

/** Material category icons */
export const MATERIAL_CATEGORY_ICONS: Record<MaterialCategory, string> = {
  [MaterialCategory.VINYL]: 'layers',
  [MaterialCategory.ALUMINUM]: 'box',
  [MaterialCategory.ACRYLIC]: 'square',
  [MaterialCategory.WOOD]: 'tree-pine',
  [MaterialCategory.STEEL]: 'shield',
  [MaterialCategory.PLASTIC]: 'package',
  [MaterialCategory.PAPER]: 'file-text',
  [MaterialCategory.FABRIC]: 'shirt',
  [MaterialCategory.COMPOSITE]: 'grid-3x3',
  [MaterialCategory.ELECTRONIC]: 'cpu',
  [MaterialCategory.INK]: 'droplet',
  [MaterialCategory.ADHESIVE]: 'paperclip',
  [MaterialCategory.OTHER]: 'more-horizontal',
};

/** Recyclability rating display names */
export const RECYCLABILITY_RATING_DISPLAY_NAMES: Record<RecyclabilityRating, string> = {
  [RecyclabilityRating.FULLY_RECYCLABLE]: 'Fully Recyclable',
  [RecyclabilityRating.PARTIALLY_RECYCLABLE]: 'Partially Recyclable',
  [RecyclabilityRating.SPECIALTY_RECYCLING]: 'Specialty Recycling Required',
  [RecyclabilityRating.NOT_RECYCLABLE]: 'Not Recyclable',
  [RecyclabilityRating.COMPOSTABLE]: 'Compostable',
  [RecyclabilityRating.BIODEGRADABLE]: 'Biodegradable',
};

/** Recyclability rating colors */
export const RECYCLABILITY_RATING_COLORS: Record<RecyclabilityRating, string> = {
  [RecyclabilityRating.FULLY_RECYCLABLE]: 'green',
  [RecyclabilityRating.PARTIALLY_RECYCLABLE]: 'lime',
  [RecyclabilityRating.SPECIALTY_RECYCLING]: 'yellow',
  [RecyclabilityRating.NOT_RECYCLABLE]: 'red',
  [RecyclabilityRating.COMPOSTABLE]: 'emerald',
  [RecyclabilityRating.BIODEGRADABLE]: 'teal',
};

/** Environmental certification display names */
export const ENVIRONMENTAL_CERTIFICATION_DISPLAY_NAMES: Record<EnvironmentalCertificationType, string> = {
  [EnvironmentalCertificationType.FSC]: 'FSC Certified',
  [EnvironmentalCertificationType.GREENGUARD]: 'GREENGUARD',
  [EnvironmentalCertificationType.ENERGY_STAR]: 'ENERGY STAR',
  [EnvironmentalCertificationType.CRADLE_TO_CRADLE]: 'Cradle to Cradle',
  [EnvironmentalCertificationType.ISO_14001]: 'ISO 14001',
  [EnvironmentalCertificationType.LEED_COMPLIANT]: 'LEED Compliant',
  [EnvironmentalCertificationType.EPA_SAFER_CHOICE]: 'EPA Safer Choice',
  [EnvironmentalCertificationType.UL_ECOLOGO]: 'UL ECOLOGO',
  [EnvironmentalCertificationType.CARBON_NEUTRAL]: 'Carbon Neutral',
  [EnvironmentalCertificationType.RECYCLED_CONTENT]: 'Recycled Content',
  [EnvironmentalCertificationType.VOC_FREE]: 'VOC Free',
  [EnvironmentalCertificationType.CUSTOM]: 'Custom Certification',
};

/** Production waste category display names */
export const PRODUCTION_WASTE_CATEGORY_DISPLAY_NAMES: Record<ProductionWasteCategory, string> = {
  [ProductionWasteCategory.PRODUCTION_SCRAP]: 'Production Scrap',
  [ProductionWasteCategory.SETUP_WASTE]: 'Setup Waste',
  [ProductionWasteCategory.DEFECTIVE_OUTPUT]: 'Defective Output',
  [ProductionWasteCategory.PACKAGING]: 'Packaging',
  [ProductionWasteCategory.CHEMICAL_WASTE]: 'Chemical Waste',
  [ProductionWasteCategory.ELECTRONIC_WASTE]: 'Electronic Waste',
  [ProductionWasteCategory.HAZARDOUS]: 'Hazardous',
  [ProductionWasteCategory.GENERAL_WASTE]: 'General Waste',
  [ProductionWasteCategory.RECYCLABLE_WASTE]: 'Recyclable Waste',
};

/** Production waste category colors */
export const PRODUCTION_WASTE_CATEGORY_COLORS: Record<ProductionWasteCategory, string> = {
  [ProductionWasteCategory.PRODUCTION_SCRAP]: 'gray',
  [ProductionWasteCategory.SETUP_WASTE]: 'slate',
  [ProductionWasteCategory.DEFECTIVE_OUTPUT]: 'red',
  [ProductionWasteCategory.PACKAGING]: 'amber',
  [ProductionWasteCategory.CHEMICAL_WASTE]: 'purple',
  [ProductionWasteCategory.ELECTRONIC_WASTE]: 'violet',
  [ProductionWasteCategory.HAZARDOUS]: 'rose',
  [ProductionWasteCategory.GENERAL_WASTE]: 'zinc',
  [ProductionWasteCategory.RECYCLABLE_WASTE]: 'green',
};

/** Waste disposal method display names */
export const WASTE_DISPOSAL_METHOD_DISPLAY_NAMES: Record<WasteDisposalMethod, string> = {
  [WasteDisposalMethod.RECYCLED]: 'Recycled',
  [WasteDisposalMethod.COMPOSTED]: 'Composted',
  [WasteDisposalMethod.LANDFILL]: 'Landfill',
  [WasteDisposalMethod.INCINERATED]: 'Incinerated',
  [WasteDisposalMethod.HAZARDOUS_DISPOSAL]: 'Hazardous Disposal',
  [WasteDisposalMethod.RETURNED_TO_VENDOR]: 'Returned to Vendor',
  [WasteDisposalMethod.REPURPOSED]: 'Repurposed',
  [WasteDisposalMethod.DONATED]: 'Donated',
};

/** Waste disposal method colors */
export const WASTE_DISPOSAL_METHOD_COLORS: Record<WasteDisposalMethod, string> = {
  [WasteDisposalMethod.RECYCLED]: 'green',
  [WasteDisposalMethod.COMPOSTED]: 'lime',
  [WasteDisposalMethod.LANDFILL]: 'gray',
  [WasteDisposalMethod.INCINERATED]: 'orange',
  [WasteDisposalMethod.HAZARDOUS_DISPOSAL]: 'red',
  [WasteDisposalMethod.RETURNED_TO_VENDOR]: 'blue',
  [WasteDisposalMethod.REPURPOSED]: 'teal',
  [WasteDisposalMethod.DONATED]: 'cyan',
};

/** Energy source display names */
export const ENERGY_SOURCE_DISPLAY_NAMES: Record<EnergySource, string> = {
  [EnergySource.GRID_ELECTRICITY]: 'Grid Electricity',
  [EnergySource.SOLAR]: 'Solar',
  [EnergySource.WIND]: 'Wind',
  [EnergySource.NATURAL_GAS]: 'Natural Gas',
  [EnergySource.PROPANE]: 'Propane',
  [EnergySource.DIESEL]: 'Diesel',
  [EnergySource.HYBRID]: 'Hybrid',
  [EnergySource.RENEWABLE_CREDIT]: 'Renewable Energy Credit',
};

/** Energy source colors */
export const ENERGY_SOURCE_COLORS: Record<EnergySource, string> = {
  [EnergySource.GRID_ELECTRICITY]: 'yellow',
  [EnergySource.SOLAR]: 'amber',
  [EnergySource.WIND]: 'cyan',
  [EnergySource.NATURAL_GAS]: 'blue',
  [EnergySource.PROPANE]: 'orange',
  [EnergySource.DIESEL]: 'slate',
  [EnergySource.HYBRID]: 'lime',
  [EnergySource.RENEWABLE_CREDIT]: 'green',
};

/** Emission scope display names */
export const EMISSION_SCOPE_DISPLAY_NAMES: Record<EmissionScope, string> = {
  [EmissionScope.SCOPE_1]: 'Scope 1 (Direct)',
  [EmissionScope.SCOPE_2]: 'Scope 2 (Energy)',
  [EmissionScope.SCOPE_3]: 'Scope 3 (Indirect)',
};

/** Emission scope colors */
export const EMISSION_SCOPE_COLORS: Record<EmissionScope, string> = {
  [EmissionScope.SCOPE_1]: 'red',
  [EmissionScope.SCOPE_2]: 'orange',
  [EmissionScope.SCOPE_3]: 'yellow',
};

/** Sustainability goal type display names */
export const SUSTAINABILITY_GOAL_TYPE_DISPLAY_NAMES: Record<SustainabilityGoalType, string> = {
  [SustainabilityGoalType.WASTE_REDUCTION]: 'Waste Reduction',
  [SustainabilityGoalType.ENERGY_REDUCTION]: 'Energy Reduction',
  [SustainabilityGoalType.EMISSION_REDUCTION]: 'Emission Reduction',
  [SustainabilityGoalType.RECYCLING_RATE]: 'Recycling Rate',
  [SustainabilityGoalType.RENEWABLE_USAGE]: 'Renewable Usage',
  [SustainabilityGoalType.WATER_REDUCTION]: 'Water Reduction',
  [SustainabilityGoalType.SUSTAINABLE_SOURCING]: 'Sustainable Sourcing',
  [SustainabilityGoalType.CERTIFICATION_TARGET]: 'Certification Target',
  [SustainabilityGoalType.CUSTOM]: 'Custom Goal',
};

/** Sustainability goal type icons */
export const SUSTAINABILITY_GOAL_TYPE_ICONS: Record<SustainabilityGoalType, string> = {
  [SustainabilityGoalType.WASTE_REDUCTION]: 'trash-2',
  [SustainabilityGoalType.ENERGY_REDUCTION]: 'zap',
  [SustainabilityGoalType.EMISSION_REDUCTION]: 'cloud',
  [SustainabilityGoalType.RECYCLING_RATE]: 'recycle',
  [SustainabilityGoalType.RENEWABLE_USAGE]: 'sun',
  [SustainabilityGoalType.WATER_REDUCTION]: 'droplet',
  [SustainabilityGoalType.SUSTAINABLE_SOURCING]: 'leaf',
  [SustainabilityGoalType.CERTIFICATION_TARGET]: 'award',
  [SustainabilityGoalType.CUSTOM]: 'target',
};

/** Goal timeframe display names */
export const GOAL_TIMEFRAME_DISPLAY_NAMES: Record<GoalTimeframe, string> = {
  [GoalTimeframe.MONTHLY]: 'Monthly',
  [GoalTimeframe.QUARTERLY]: 'Quarterly',
  [GoalTimeframe.ANNUAL]: 'Annual',
  [GoalTimeframe.MULTI_YEAR]: 'Multi-Year',
};

/** Sustainability configuration */
export const SUSTAINABILITY_CONFIG = {
  defaultEmissionFactorSource: 'EPA',
  carbonCreditPricePerTon: 50,
  wasteToLandfillWarningThreshold: 0.3,  // 30%
  recyclingRateGoal: 0.75,  // 75%
  renewableEnergyGoal: 0.5,  // 50%
  trackWaterUsage: true,
  requireManifestForHazardous: true,
} as const;

/** Common emission factors (kg CO2e per unit) */
export const EMISSION_FACTORS = {
  electricityKwh: 0.42,           // kg CO2e per kWh (US average)
  naturalGasTherm: 5.3,           // kg CO2e per therm
  propaneGallon: 5.72,            // kg CO2e per gallon
  dieselGallon: 10.21,            // kg CO2e per gallon
  shippingMilePerTon: 0.25,       // kg CO2e per ton-mile (truck)
  airShippingMilePerTon: 0.62,    // kg CO2e per ton-mile (air)
} as const;

// ============================================================================
// NEW-CRITICAL-10: Advanced Pricing & Quote Intelligence
// ============================================================================

import {
  PricingStrategy,
  QuoteConfidenceLevel,
  PriceAdjustmentType,
  CompetitorPriceSource,
  QuoteOutcome,
  CustomerPriceSegment,
  CustomerLoyaltyTier,
} from './enums.js';

/** Pricing strategy display names */
export const PRICING_STRATEGY_DISPLAY_NAMES: Record<PricingStrategy, string> = {
  [PricingStrategy.COST_PLUS]: 'Cost Plus',
  [PricingStrategy.MARKET_BASED]: 'Market Based',
  [PricingStrategy.VALUE_BASED]: 'Value Based',
  [PricingStrategy.COMPETITIVE]: 'Competitive',
  [PricingStrategy.DYNAMIC]: 'Dynamic',
  [PricingStrategy.TIERED]: 'Tiered',
  [PricingStrategy.PROMOTIONAL]: 'Promotional',
  [PricingStrategy.CUSTOM]: 'Custom',
};

/** Pricing strategy descriptions */
export const PRICING_STRATEGY_DESCRIPTIONS: Record<PricingStrategy, string> = {
  [PricingStrategy.COST_PLUS]: 'Base price on cost plus a markup percentage',
  [PricingStrategy.MARKET_BASED]: 'Price based on current market rates',
  [PricingStrategy.VALUE_BASED]: 'Price based on perceived customer value',
  [PricingStrategy.COMPETITIVE]: 'Price to match or beat competitors',
  [PricingStrategy.DYNAMIC]: 'Adjust prices based on real-time demand',
  [PricingStrategy.TIERED]: 'Volume-based pricing tiers',
  [PricingStrategy.PROMOTIONAL]: 'Special promotional pricing',
  [PricingStrategy.CUSTOM]: 'Custom pricing logic',
};

/** Quote confidence level display names */
export const QUOTE_CONFIDENCE_LEVEL_DISPLAY_NAMES: Record<QuoteConfidenceLevel, string> = {
  [QuoteConfidenceLevel.LOW]: 'Low (<50%)',
  [QuoteConfidenceLevel.MEDIUM]: 'Medium (50-70%)',
  [QuoteConfidenceLevel.HIGH]: 'High (70-90%)',
  [QuoteConfidenceLevel.VERY_HIGH]: 'Very High (>90%)',
};

/** Quote confidence level colors */
export const QUOTE_CONFIDENCE_LEVEL_COLORS: Record<QuoteConfidenceLevel, string> = {
  [QuoteConfidenceLevel.LOW]: 'red',
  [QuoteConfidenceLevel.MEDIUM]: 'yellow',
  [QuoteConfidenceLevel.HIGH]: 'green',
  [QuoteConfidenceLevel.VERY_HIGH]: 'emerald',
};

/** Price adjustment type display names */
export const PRICE_ADJUSTMENT_TYPE_DISPLAY_NAMES: Record<PriceAdjustmentType, string> = {
  [PriceAdjustmentType.DISCOUNT_PERCENT]: 'Discount %',
  [PriceAdjustmentType.DISCOUNT_AMOUNT]: 'Discount $',
  [PriceAdjustmentType.MARKUP_PERCENT]: 'Markup %',
  [PriceAdjustmentType.MARKUP_AMOUNT]: 'Markup $',
  [PriceAdjustmentType.OVERRIDE]: 'Price Override',
  [PriceAdjustmentType.VOLUME_DISCOUNT]: 'Volume Discount',
  [PriceAdjustmentType.LOYALTY_DISCOUNT]: 'Loyalty Discount',
  [PriceAdjustmentType.PROMOTIONAL]: 'Promotional',
  [PriceAdjustmentType.RUSH_FEE]: 'Rush Fee',
  [PriceAdjustmentType.COMPLEXITY_FACTOR]: 'Complexity Factor',
};

/** Competitor price source display names */
export const COMPETITOR_PRICE_SOURCE_DISPLAY_NAMES: Record<CompetitorPriceSource, string> = {
  [CompetitorPriceSource.WEBSITE]: 'Website',
  [CompetitorPriceSource.RFQ_RESPONSE]: 'RFQ Response',
  [CompetitorPriceSource.CUSTOMER_FEEDBACK]: 'Customer Feedback',
  [CompetitorPriceSource.SALES_INTEL]: 'Sales Intelligence',
  [CompetitorPriceSource.PUBLIC_RECORD]: 'Public Record',
  [CompetitorPriceSource.ESTIMATE]: 'Estimate',
};

/** Quote outcome display names */
export const QUOTE_OUTCOME_DISPLAY_NAMES: Record<QuoteOutcome, string> = {
  [QuoteOutcome.WON]: 'Won',
  [QuoteOutcome.LOST]: 'Lost',
  [QuoteOutcome.NO_DECISION]: 'No Decision',
  [QuoteOutcome.PENDING]: 'Pending',
};

/** Quote outcome colors */
export const QUOTE_OUTCOME_COLORS: Record<QuoteOutcome, string> = {
  [QuoteOutcome.WON]: 'green',
  [QuoteOutcome.LOST]: 'red',
  [QuoteOutcome.NO_DECISION]: 'gray',
  [QuoteOutcome.PENDING]: 'yellow',
};

/** Customer price segment display names */
export const CUSTOMER_PRICE_SEGMENT_DISPLAY_NAMES: Record<CustomerPriceSegment, string> = {
  [CustomerPriceSegment.BUDGET]: 'Budget',
  [CustomerPriceSegment.VALUE]: 'Value',
  [CustomerPriceSegment.PREMIUM]: 'Premium',
};

/** Customer price segment colors */
export const CUSTOMER_PRICE_SEGMENT_COLORS: Record<CustomerPriceSegment, string> = {
  [CustomerPriceSegment.BUDGET]: 'slate',
  [CustomerPriceSegment.VALUE]: 'blue',
  [CustomerPriceSegment.PREMIUM]: 'purple',
};

/** Customer loyalty tier display names */
export const CUSTOMER_LOYALTY_TIER_DISPLAY_NAMES: Record<CustomerLoyaltyTier, string> = {
  [CustomerLoyaltyTier.BRONZE]: 'Bronze',
  [CustomerLoyaltyTier.SILVER]: 'Silver',
  [CustomerLoyaltyTier.GOLD]: 'Gold',
  [CustomerLoyaltyTier.PLATINUM]: 'Platinum',
};

/** Customer loyalty tier colors */
export const CUSTOMER_LOYALTY_TIER_COLORS: Record<CustomerLoyaltyTier, string> = {
  [CustomerLoyaltyTier.BRONZE]: 'amber',
  [CustomerLoyaltyTier.SILVER]: 'gray',
  [CustomerLoyaltyTier.GOLD]: 'yellow',
  [CustomerLoyaltyTier.PLATINUM]: 'slate',
};

/** Pricing configuration */
export const PRICING_CONFIG = {
  defaultMarkupPercent: 35,
  minMarginPercent: 15,
  maxDiscountPercent: 25,
  volumeDiscountThresholds: [
    { minQty: 10, discount: 5 },
    { minQty: 25, discount: 10 },
    { minQty: 50, discount: 15 },
    { minQty: 100, discount: 20 },
  ],
  loyaltyDiscounts: {
    [CustomerLoyaltyTier.BRONZE]: 0,
    [CustomerLoyaltyTier.SILVER]: 5,
    [CustomerLoyaltyTier.GOLD]: 10,
    [CustomerLoyaltyTier.PLATINUM]: 15,
  },
  rushFeePercent: 25,
  complexityFactors: {
    simple: 1.0,
    moderate: 1.15,
    complex: 1.35,
    extreme: 1.5,
  },
} as const;

/** Quote intelligence configuration */
export const QUOTE_INTELLIGENCE_CONFIG = {
  minSimilarityScore: 60,          // Minimum similarity to be considered comparable
  winProbabilityThresholds: {
    low: 50,
    medium: 70,
    high: 90,
  },
  riskFactorWeights: {
    newCustomer: 0.1,
    largeOrder: 0.15,
    tightDeadline: 0.2,
    complexRequirements: 0.15,
    priceAboveMarket: 0.2,
    noRelationship: 0.1,
    pastIssues: 0.1,
  },
  trackCompetitors: true,
  requireWinLossAnalysis: true,
} as const;

// ─── Production List Integration Constants ───────────────────────────────────
// Maps between the Excel Production List and the ERP system.
// See docs/Production List setup for full specification.

import {
  ProductionListSection,
  ProductionListStyle,
  ProductionListPrintStation,
  ProductionListSyncDirection,
  ProductionListSyncStatus,
} from './enums.js';

/** Display names for production list sections */
export const PRODUCTION_LIST_SECTION_DISPLAY_NAMES: Record<ProductionListSection, string> = {
  [ProductionListSection.CUSTOMER]: 'Shipping Today/Tomorrow',
  [ProductionListSection.MONTHLY]: 'Monthly/Recurring',
  [ProductionListSection.COMING_UP]: 'Coming Up (Approved)',
  [ProductionListSection.DESIGN_PRODUCTION]: 'Design & Production',
  [ProductionListSection.DESIGN_ONLY]: 'Design Only',
  [ProductionListSection.OUTSOURCED]: 'Outsourced',
  [ProductionListSection.INSTALL_READY]: 'Install Ready / Shipping / Invoicing',
  [ProductionListSection.ON_HOLD]: 'On Hold',
};

/** The exact marker text used in column A of the Excel sheet (for parsing) */
export const PRODUCTION_LIST_SECTION_MARKERS: Record<ProductionListSection, string> = {
  [ProductionListSection.CUSTOMER]: 'CUSTOMER',
  [ProductionListSection.MONTHLY]: 'MONTHLY',
  [ProductionListSection.COMING_UP]: 'COMING UP\u2026',  // Unicode ellipsis U+2026
  [ProductionListSection.DESIGN_PRODUCTION]: 'DESIGN; PRODUCTION/ACTUAL ORDERS',
  [ProductionListSection.DESIGN_ONLY]: 'DESIGN; DESIGN ONLY ORDERS',
  [ProductionListSection.OUTSOURCED]: 'OUTSOURCED',
  [ProductionListSection.INSTALL_READY]: 'INSTALL READY/DELIVERY/SHIPPING/INVOICING',
  [ProductionListSection.ON_HOLD]: 'ON-HOLD',
};

/** Colors for each production list section (for UI display) */
export const PRODUCTION_LIST_SECTION_COLORS: Record<ProductionListSection, string> = {
  [ProductionListSection.CUSTOMER]: '#ef4444',       // red — shipping today
  [ProductionListSection.MONTHLY]: '#8b5cf6',        // purple — recurring
  [ProductionListSection.COMING_UP]: '#3b82f6',      // blue — approved, coming up
  [ProductionListSection.DESIGN_PRODUCTION]: '#22c55e', // green — active production
  [ProductionListSection.DESIGN_ONLY]: '#a855f7',    // violet — design only
  [ProductionListSection.OUTSOURCED]: '#64748b',      // slate — outsourced
  [ProductionListSection.INSTALL_READY]: '#14b8a6',   // teal — install/ship
  [ProductionListSection.ON_HOLD]: '#9ca3af',         // gray — on hold
};

/** Maps ERP OrderStatus to the default Production List section */
export const ERP_STATUS_TO_SECTION: Record<string, ProductionListSection> = {
  'PENDING': ProductionListSection.DESIGN_PRODUCTION,
  'IN_PROGRESS': ProductionListSection.COMING_UP,
  'COMPLETED': ProductionListSection.INSTALL_READY,
  'SHIPPED': ProductionListSection.INSTALL_READY,
  'CANCELLED': ProductionListSection.ON_HOLD,
  'ON_HOLD': ProductionListSection.ON_HOLD,
};

/** Maps Production List section to the best-fit ERP OrderStatus */
export const SECTION_TO_ERP_STATUS: Record<ProductionListSection, string> = {
  [ProductionListSection.CUSTOMER]: 'IN_PROGRESS',
  [ProductionListSection.MONTHLY]: 'IN_PROGRESS',
  [ProductionListSection.COMING_UP]: 'IN_PROGRESS',
  [ProductionListSection.DESIGN_PRODUCTION]: 'PENDING',
  [ProductionListSection.DESIGN_ONLY]: 'PENDING',
  [ProductionListSection.OUTSOURCED]: 'IN_PROGRESS',
  [ProductionListSection.INSTALL_READY]: 'COMPLETED',
  [ProductionListSection.ON_HOLD]: 'ON_HOLD',
};

/** Maps Excel print station codes (col J) to ERP PrintingMethod */
export const PRINT_STATION_TO_ERP_METHOD: Record<ProductionListPrintStation, string> = {
  [ProductionListPrintStation.RR]: 'ROLL_TO_ROLL',
  [ProductionListPrintStation.FB]: 'FLATBED',
  [ProductionListPrintStation.Z]: 'PRODUCTION', // Zund = cutting/finishing
};

/** Maps ERP PrintingMethod back to production list station codes */
export const ERP_METHOD_TO_PRINT_STATION: Record<string, ProductionListPrintStation | null> = {
  'ROLL_TO_ROLL': ProductionListPrintStation.RR,
  'FLATBED': ProductionListPrintStation.FB,
  'PRODUCTION': ProductionListPrintStation.Z,
  'SCREEN_PRINT': null,
  'DESIGN': null,
  'SALES': null,
  'INSTALLATION': null,
  'ORDER_ENTRY': null,
  'SHIPPING_RECEIVING': null,
};

/** Display names for row styles */
export const PRODUCTION_LIST_STYLE_DISPLAY_NAMES: Record<ProductionListStyle, string> = {
  [ProductionListStyle.NORMAL]: 'Normal',
  [ProductionListStyle.ATTENTION]: 'Rush / Must Ship / Redo',
  [ProductionListStyle.INNER_WORKINGS]: 'HH Global / InnerWorkings',
  [ProductionListStyle.MUST_SHIP]: 'Must Ship (Yellow)',
};

/** Display names for production list sync directions */
export const PRODUCTION_LIST_SYNC_DIRECTION_DISPLAY_NAMES: Record<ProductionListSyncDirection, string> = {
  [ProductionListSyncDirection.IMPORT]: 'Import (Excel → ERP)',
  [ProductionListSyncDirection.EXPORT]: 'Export (ERP → Excel)',
  [ProductionListSyncDirection.BIDIRECTIONAL]: 'Bidirectional Merge',
};

/** Display names for production list sync status */
export const PRODUCTION_LIST_SYNC_STATUS_DISPLAY_NAMES: Record<ProductionListSyncStatus, string> = {
  [ProductionListSyncStatus.PENDING]: 'Pending',
  [ProductionListSyncStatus.IN_PROGRESS]: 'In Progress',
  [ProductionListSyncStatus.COMPLETED]: 'Completed',
  [ProductionListSyncStatus.FAILED]: 'Failed',
  [ProductionListSyncStatus.PARTIAL]: 'Partial (some errors)',
};

/** Column definitions that match the Excel sheet layout (§4) */
export const PRODUCTION_LIST_COLUMNS = [
  { key: 'customerName', label: 'Customer', excelCol: 'A', width: 180 },
  { key: 'orderNumber', label: 'WO#', excelCol: 'B', width: 80 },
  { key: 'description', label: 'Description', excelCol: 'C', width: 280 },
  { key: 'category', label: 'Category', excelCol: 'D', width: 100, hidden: true },
  { key: 'salesperson', label: 'Salesperson', excelCol: 'E', width: 120 },
  { key: 'mustShipDate', label: 'Must Ship', excelCol: 'F', width: 100 },
  { key: 'proofDate', label: 'Proof Date', excelCol: 'G', width: 100 },
  { key: 'approvalDate', label: 'Approval', excelCol: 'H', width: 100 },
  { key: 'printCutDate', label: 'Print/Cut', excelCol: 'I', width: 100 },
  { key: 'printStatus', label: 'Print Status', excelCol: 'J', width: 100 },
  { key: 'notes', label: 'Notes', excelCol: 'K', width: 200 },
  { key: 'daysRemaining', label: 'Days', excelCol: 'L', width: 60 },
  { key: 'deadlineWarning', label: 'Deadline', excelCol: 'M', width: 100 },
] as const;

/** The Production List base path on OneDrive (per §13) */
export const PRODUCTION_LIST_BASE_PATH = 'C:\\Users\\{username}\\OneDrive - Wilde Signs\\Production List';

/** File naming patterns (per §13) */
export const PRODUCTION_LIST_FILE_PATTERNS = {
  productionList: '{base}\\{MMMM yyyy}\\Production List_MM_dd_yy.xlsm',
  brendaTally: "{base}\\Brenda's Daily List\\{MMMM yyyy}\\Brenda Tally_MMMM_d_yyyy.xlsx",
  christinaTally: "{base}\\Christina's Daily List\\{MMMM yyyy}\\Christina Tally_MMMM_d_yyyy.xlsx",
  garyTally: "{base}\\Gary's Daily List\\{MMMM yyyy}\\Gary's Tally_MMMM_d_yyyy.xlsx",
  shippingTally: "{base}\\Pam's Daily List\\{MMMM yyyy}\\Shipping Tally_MMMM_dd_yy.xlsm",
  rollToRollList: '{base}\\Printing Lists\\Roll to Roll List.xlsx',
  flatbedList: '{base}\\Printing Lists\\Flatbed List.xlsx',
  zundList: '{base}\\Printing Lists\\Zund List.xlsx',
  proofIndex: '{base}\\Proof DB\\file_index.xlsx',
  printCutIndex: '{base}\\Proof DB\\PrintCut_Index.xlsx',
  archive: '{base}\\Archive\\Archive.xlsx',
} as const;