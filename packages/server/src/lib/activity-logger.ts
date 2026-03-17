import { Request } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/client.js';

export interface ActivityLogParams {
  action: string;
  entityType: string;
  entityId?: string;
  entityName?: string;
  description: string;
  details?: Record<string, unknown>;
  userId?: string;
  req?: Request;
}

/**
 * Log an activity to the database
 */
export async function logActivity(params: ActivityLogParams): Promise<void> {
  try {
    const { action, entityType, entityId, entityName, description, details, userId, req } = params;

    await prisma.activityLog.create({
      data: {
        action,
        entityType,
        entityId,
        entityName,
        description,
        details: details ? (details as Prisma.InputJsonValue) : undefined,
        userId,
        ipAddress: req ? getClientIp(req) : undefined,
        userAgent: req ? req.headers['user-agent'] : undefined,
      },
    });
  } catch (error) {
    // Log error but don't throw - activity logging should never break the main flow
    console.error('Failed to log activity:', error);
  }
}

/**
 * Get client IP address from request
 */
function getClientIp(req: Request): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded)) {
    return forwarded[0];
  }
  return req.socket?.remoteAddress;
}

/**
 * Common activity action types
 */
export const ActivityAction = {
  // Auth
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  LOGIN_FAILED: 'LOGIN_FAILED',
  PASSWORD_CHANGE: 'PASSWORD_CHANGE',

  // CRUD
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  VIEW: 'VIEW',

  // Orders
  STATUS_CHANGE: 'STATUS_CHANGE',
  STATION_COMPLETE: 'STATION_COMPLETE',
  ASSIGN: 'ASSIGN',
  UNASSIGN: 'UNASSIGN',

  // Bulk operations
  BULK_UPDATE: 'BULK_UPDATE',
  BULK_DELETE: 'BULK_DELETE',
  BULK_ASSIGN: 'BULK_ASSIGN',

  // File operations
  UPLOAD: 'UPLOAD',
  DOWNLOAD: 'DOWNLOAD',

  // Schedule
  SCHEDULE: 'SCHEDULE',
  RESCHEDULE: 'RESCHEDULE',

  // Quotes
  CONVERT_TO_ORDER: 'CONVERT_TO_ORDER',
  SEND_QUOTE: 'SEND_QUOTE',

  // Procurement
  RECEIVE_PO: 'RECEIVE_PO',
  SUBMIT_PO: 'SUBMIT_PO',

  // Shipping
  MARK_DELIVERED: 'MARK_DELIVERED',
  SHIP_ORDER: 'SHIP_ORDER',

  // Job Costing
  RECORD_MATERIAL: 'RECORD_MATERIAL',
  CALCULATE_COST: 'CALCULATE_COST',

  // Settings
  SETTINGS_CHANGE: 'SETTINGS_CHANGE',
  EXPORT_DATA: 'EXPORT_DATA',

  // Other
  EMAIL_SENT: 'EMAIL_SENT',
  NOTIFICATION_SENT: 'NOTIFICATION_SENT',
} as const;

/**
 * Common entity types
 */
export const EntityType = {
  USER: 'User',
  WORK_ORDER: 'WorkOrder',
  CUSTOMER: 'Customer',
  QUOTE: 'Quote',
  INVENTORY_ITEM: 'InventoryItem',
  TEMPLATE: 'Template',
  SETTINGS: 'Settings',
  ATTACHMENT: 'Attachment',
  NOTIFICATION: 'Notification',
  SCHEDULE: 'Schedule',
  PRODUCTION_SLOT: 'ProductionSlot',
  VENDOR: 'Vendor',
  PURCHASE_ORDER: 'PurchaseOrder',
  SHIPMENT: 'Shipment',
  BOM: 'BillOfMaterials',
  MATERIAL_USAGE: 'MaterialUsage',
  JOB_COST: 'JobCost',
  QC_CHECKLIST: 'QCChecklist',
  QC_INSPECTION: 'QCInspection',
  EQUIPMENT: 'Equipment',
  MAINTENANCE_LOG: 'MaintenanceLog',
  DOWNTIME_EVENT: 'DowntimeEvent',
  SYSTEM: 'System',
  INTERACTION: 'CustomerInteraction',
  INTEGRATION: 'Integration',
  ALERT: 'Alert',
  OTHER: 'Other',
} as const;
