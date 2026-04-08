import { getStationColorTheme } from '@erp/shared';

export interface ActivityTimelineEventLike {
  type: string;
  description?: string;
  source?: string;
  details?: Record<string, unknown>;
}

export interface ActivityTimelinePresentation {
  key: string;
  label: string;
  bg: string;
  border: string;
  dot: string;
  bgColor: string;
  borderColor: string;
  dotColor: string;
  textColor: string;
}

function buildStationPresentation(
  key: string,
  label: string,
  station: string,
): ActivityTimelinePresentation {
  const theme = getStationColorTheme(station);
  const isSubStation = theme.subStationLevel > 0;
  return {
    key,
    label,
    bg: isSubStation ? theme.gradientColor : theme.softColor,
    border: isSubStation ? theme.gradientBorderColor : theme.softBorderColor,
    dot: theme.dotColor,
    bgColor: isSubStation ? theme.gradientColor : theme.softColor,
    borderColor: isSubStation ? theme.gradientBorderColor : theme.softBorderColor,
    dotColor: theme.dotColor,
    textColor: isSubStation ? theme.gradientTextColor : theme.softTextColor,
  };
}

const DEFAULT_PRESENTATION: ActivityTimelinePresentation = buildStationPresentation(
  'DEFAULT',
  'Activity',
  'SALES',
);

const PRESENTATIONS: Record<string, ActivityTimelinePresentation> = {
  CREATE: buildStationPresentation('CREATE', 'Created', 'ORDER_ENTRY'),
  CREATED: buildStationPresentation('CREATED', 'Created', 'ORDER_ENTRY'),
  UPDATE: buildStationPresentation('UPDATE', 'Updated', 'SALES'),
  UPDATED: buildStationPresentation('UPDATED', 'Updated', 'SALES'),
  STATUS_CHANGED: buildStationPresentation('STATUS_CHANGED', 'Status Changed', 'SALES'),
  STATUS_CHANGE: buildStationPresentation('STATUS_CHANGE', 'Status Changed', 'SALES'),
  STATION_COMPLETE: buildStationPresentation('STATION_COMPLETE', 'Station Complete', 'COMPLETE'),
  STATION_COMPLETED: buildStationPresentation('STATION_COMPLETED', 'Station Complete', 'COMPLETE'),
  ASSIGN: buildStationPresentation('ASSIGN', 'Assigned', 'ORDER_ENTRY'),
  ASSIGNED: buildStationPresentation('ASSIGNED', 'Assigned', 'ORDER_ENTRY'),
  UNASSIGN: buildStationPresentation('UNASSIGN', 'Unassigned', 'ORDER_ENTRY'),
  IN_RIP_QUEUE: buildStationPresentation('IN_RIP_QUEUE', 'In RIP Queue', 'ROLL_TO_ROLL_PRINTING'),
  PRINT_QUEUED: buildStationPresentation('PRINT_QUEUED', 'Print Queued', 'ROLL_TO_ROLL_PRINTING'),
  PRINT_PROCESSING: buildStationPresentation('PRINT_PROCESSING', 'Printing', 'ROLL_TO_ROLL_PRINTING'),
  PRINT_READY: buildStationPresentation('PRINT_READY', 'Print Ready', 'ROLL_TO_ROLL_PRINTING'),
  PRINT_PRINTING: buildStationPresentation('PRINT_PRINTING', 'Printing', 'ROLL_TO_ROLL_PRINTING'),
  PRINTED: buildStationPresentation('PRINTED', 'Printed', 'ROLL_TO_ROLL'),
  PRINT_COMPLETED: buildStationPresentation('PRINT_COMPLETED', 'Printed', 'ROLL_TO_ROLL'),
  CUT_QUEUED: buildStationPresentation('CUT_QUEUED', 'Cut Queued', 'PRODUCTION_ZUND'),
  CUT_PROCESSING: buildStationPresentation('CUT_PROCESSING', 'Cutting', 'PRODUCTION_ZUND'),
  CUT_COMPLETED: buildStationPresentation('CUT_COMPLETED', 'Cut Done', 'PRODUCTION_FINISHING'),
  EMAIL_SENT: buildStationPresentation('EMAIL_SENT', 'Email Sent', 'ORDER_ENTRY'),
  UPLOAD: buildStationPresentation('UPLOAD', 'Uploaded', 'ORDER_ENTRY'),
  DOWNLOAD: buildStationPresentation('DOWNLOAD', 'Downloaded', 'ORDER_ENTRY'),
  DOCUMENT_ADDED: buildStationPresentation('DOCUMENT_ADDED', 'Document Added', 'ORDER_ENTRY'),
  FILE_CREATED: buildStationPresentation('FILE_CREATED', 'File Created', 'ORDER_ENTRY'),
  PROOFED: buildStationPresentation('PROOFED', 'Proofed', 'DESIGN_PROOF'),
  APPROVED: buildStationPresentation('APPROVED', 'Approved', 'DESIGN_APPROVAL'),
  FINISHING_DONE: buildStationPresentation('FINISHING_DONE', 'Finishing Done', 'PRODUCTION_FINISHING'),
  QC_DONE: buildStationPresentation('QC_DONE', 'QC Done', 'SHIPPING_QC'),
  INSTALLED: buildStationPresentation('INSTALLED', 'Installed', 'INSTALLATION'),
  SHIP_ORDER: buildStationPresentation('SHIP_ORDER', 'Shipped', 'SHIPPING_SHIPMENT'),
  SHIPPED: buildStationPresentation('SHIPPED', 'Shipped', 'SHIPPING_SHIPMENT'),
  MARK_DELIVERED: buildStationPresentation('MARK_DELIVERED', 'Delivered', 'SHIPPING_SHIPMENT'),
  DELIVERED: buildStationPresentation('DELIVERED', 'Delivered', 'SHIPPING_SHIPMENT'),
  NOTE_ADDED: buildStationPresentation('NOTE_ADDED', 'Note Added', 'ORDER_ENTRY'),
  COMMENT: buildStationPresentation('COMMENT', 'Comment', 'ORDER_ENTRY'),
  LINE_ADDED: buildStationPresentation('LINE_ADDED', 'Line Added', 'ORDER_ENTRY'),
  LINE_REMOVED: buildStationPresentation('LINE_REMOVED', 'Line Removed', 'ORDER_ENTRY'),
  LINE_UPDATED: buildStationPresentation('LINE_UPDATED', 'Line Updated', 'ORDER_ENTRY'),
  ROUTING_SET: buildStationPresentation('ROUTING_SET', 'Routing Set', 'ORDER_ENTRY'),
  PRIORITY_CHANGED: buildStationPresentation('PRIORITY_CHANGED', 'Priority Changed', 'ORDER_ENTRY'),
  LOGIN: buildStationPresentation('LOGIN', 'Login', 'ORDER_ENTRY'),
  LOGOUT: buildStationPresentation('LOGOUT', 'Logout', 'ORDER_ENTRY'),
  DEFAULT: DEFAULT_PRESENTATION,
};

function getDetailString(details: Record<string, unknown> | undefined, key: string): string {
  const value = details?.[key];
  return typeof value === 'string' ? value : '';
}

function getNormalizedFolder(details: Record<string, unknown> | undefined): string {
  return getDetailString(details, 'folder').trim().toLowerCase();
}

function getStyle(key: string): ActivityTimelinePresentation {
  return PRESENTATIONS[key] || DEFAULT_PRESENTATION;
}

export function resolveActivityTimelinePresentation({
  type,
  description,
  source,
  details,
}: ActivityTimelineEventLike): ActivityTimelinePresentation {
  const normalizedType = type.toUpperCase();
  const normalizedDescription = (description || '').toLowerCase();
  const normalizedFolder = getNormalizedFolder(details);
  const station = getDetailString(details, 'station').toUpperCase();
  const status = getDetailString(details, 'status').toUpperCase();
  const proofStatus = getDetailString(details, 'proofStatus').toUpperCase();
  const timelineKey = getDetailString(details, 'timelineKey').toUpperCase();

  if (normalizedType === 'FILE_CREATED') {
    if (normalizedFolder === 'proofs' || normalizedDescription.includes('proof')) {
      return getStyle('PROOFED');
    }

    if (
      normalizedFolder === 'print files' ||
      normalizedFolder === 'printfiles' ||
      normalizedFolder === 'printcut' ||
      normalizedDescription.includes('print file')
    ) {
      return getStyle('IN_RIP_QUEUE');
    }
  }

  if (normalizedType === 'PRINT_QUEUED' || normalizedType === 'PRINT_PROCESSING' || normalizedType === 'PRINT_READY') {
    return getStyle('IN_RIP_QUEUE');
  }

  if (normalizedType === 'PRINT_COMPLETED' || normalizedType === 'PRINTED') {
    return getStyle('PRINTED');
  }

  if (normalizedType === 'STATION_COMPLETED' || normalizedType === 'STATION_COMPLETE') {
    if (station === 'PRODUCTION_FINISHING' || normalizedDescription.includes('finishing')) {
      return getStyle('FINISHING_DONE');
    }

    if (station === 'SHIPPING_QC' || normalizedDescription.includes('qc')) {
      return getStyle('QC_DONE');
    }

    if (
      station === 'INSTALLATION' ||
      station === 'INSTALLATION_REMOTE' ||
      station === 'INSTALLATION_INHOUSE' ||
      normalizedDescription.includes('installed')
    ) {
      return getStyle('INSTALLED');
    }
  }

  if (
    normalizedType === 'STATUS_CHANGED' ||
    normalizedType === 'PROOF_STATUS_CHANGED' ||
    normalizedType === 'APPROVED'
  ) {
    if (proofStatus === 'APPROVED' || status === 'APPROVED' || timelineKey === 'APPROVED' || normalizedDescription.includes('approved')) {
      return getStyle('APPROVED');
    }
  }

  if (normalizedType === 'QC_CHECK') {
    return getStyle('QC_DONE');
  }

  if (normalizedType === 'PRINT_PRINTING') {
    return getStyle('PRINT_PRINTING');
  }

  if (normalizedType === 'CUT_QUEUED' || normalizedType === 'CUT_PROCESSING' || normalizedType === 'CUT_COMPLETED') {
    return getStyle(normalizedType);
  }

  if (normalizedType === 'EMAIL_SENT' || normalizedType === 'UPLOAD' || normalizedType === 'DOWNLOAD' || normalizedType === 'DOCUMENT_ADDED') {
    return getStyle(normalizedType);
  }

  if (normalizedType === 'SHIP_ORDER' || normalizedType === 'SHIPPED' || normalizedType === 'MARK_DELIVERED' || normalizedType === 'DELIVERED') {
    return getStyle(normalizedType);
  }

  if (normalizedType === 'NOTE_ADDED' || normalizedType === 'COMMENT' || normalizedType === 'LINE_ADDED' || normalizedType === 'LINE_REMOVED' || normalizedType === 'LINE_UPDATED' || normalizedType === 'ROUTING_SET' || normalizedType === 'PRIORITY_CHANGED' || normalizedType === 'LOGIN' || normalizedType === 'LOGOUT') {
    return getStyle(normalizedType);
  }

  if (normalizedType in PRESENTATIONS) {
    return getStyle(normalizedType);
  }

  if (timelineKey in PRESENTATIONS) {
    return getStyle(timelineKey);
  }

  void source;

  return DEFAULT_PRESENTATION;
}
