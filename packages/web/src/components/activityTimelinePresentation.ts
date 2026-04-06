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
}

const DEFAULT_PRESENTATION: ActivityTimelinePresentation = {
  key: 'DEFAULT',
  label: 'Activity',
  bg: 'bg-blue-50',
  border: 'border-blue-200',
  dot: 'bg-blue-500',
};

const PRESENTATIONS: Record<string, ActivityTimelinePresentation> = {
  CREATE: { key: 'CREATE', label: 'Created', bg: 'bg-teal-50', border: 'border-teal-300', dot: 'bg-teal-500' },
  CREATED: { key: 'CREATED', label: 'Created', bg: 'bg-teal-50', border: 'border-teal-300', dot: 'bg-teal-500' },
  UPDATE: { key: 'UPDATE', label: 'Updated', bg: 'bg-slate-50', border: 'border-slate-300', dot: 'bg-slate-500' },
  UPDATED: { key: 'UPDATED', label: 'Updated', bg: 'bg-slate-50', border: 'border-slate-300', dot: 'bg-slate-500' },
  STATUS_CHANGED: { key: 'STATUS_CHANGED', label: 'Status Changed', bg: 'bg-indigo-50', border: 'border-indigo-300', dot: 'bg-indigo-500' },
  STATUS_CHANGE: { key: 'STATUS_CHANGE', label: 'Status Changed', bg: 'bg-indigo-50', border: 'border-indigo-300', dot: 'bg-indigo-500' },
  STATION_COMPLETE: { key: 'STATION_COMPLETE', label: 'Station Complete', bg: 'bg-emerald-50', border: 'border-emerald-300', dot: 'bg-emerald-500' },
  STATION_COMPLETED: { key: 'STATION_COMPLETED', label: 'Station Complete', bg: 'bg-emerald-50', border: 'border-emerald-300', dot: 'bg-emerald-500' },
  ASSIGN: { key: 'ASSIGN', label: 'Assigned', bg: 'bg-violet-50', border: 'border-violet-300', dot: 'bg-violet-500' },
  ASSIGNED: { key: 'ASSIGNED', label: 'Assigned', bg: 'bg-violet-50', border: 'border-violet-300', dot: 'bg-violet-500' },
  UNASSIGN: { key: 'UNASSIGN', label: 'Unassigned', bg: 'bg-violet-50', border: 'border-violet-300', dot: 'bg-violet-400' },
  IN_RIP_QUEUE: { key: 'IN_RIP_QUEUE', label: 'In RIP Queue', bg: 'bg-sky-50', border: 'border-sky-300', dot: 'bg-sky-500' },
  PRINT_QUEUED: { key: 'PRINT_QUEUED', label: 'Print Queued', bg: 'bg-sky-50', border: 'border-sky-300', dot: 'bg-sky-400' },
  PRINT_PROCESSING: { key: 'PRINT_PROCESSING', label: 'Printing', bg: 'bg-sky-50', border: 'border-sky-300', dot: 'bg-sky-500' },
  PRINT_READY: { key: 'PRINT_READY', label: 'Print Ready', bg: 'bg-sky-50', border: 'border-sky-300', dot: 'bg-sky-500' },
  PRINT_PRINTING: { key: 'PRINT_PRINTING', label: 'Printing', bg: 'bg-sky-50', border: 'border-sky-300', dot: 'bg-sky-600' },
  PRINTED: { key: 'PRINTED', label: 'Printed', bg: 'bg-emerald-50', border: 'border-emerald-300', dot: 'bg-emerald-500' },
  PRINT_COMPLETED: { key: 'PRINT_COMPLETED', label: 'Printed', bg: 'bg-emerald-50', border: 'border-emerald-300', dot: 'bg-emerald-500' },
  CUT_QUEUED: { key: 'CUT_QUEUED', label: 'Cut Queued', bg: 'bg-orange-50', border: 'border-orange-300', dot: 'bg-orange-500' },
  CUT_PROCESSING: { key: 'CUT_PROCESSING', label: 'Cutting', bg: 'bg-orange-50', border: 'border-orange-300', dot: 'bg-orange-600' },
  CUT_COMPLETED: { key: 'CUT_COMPLETED', label: 'Cut Done', bg: 'bg-orange-50', border: 'border-orange-300', dot: 'bg-orange-700' },
  EMAIL_SENT: { key: 'EMAIL_SENT', label: 'Email Sent', bg: 'bg-cyan-50', border: 'border-cyan-300', dot: 'bg-cyan-500' },
  UPLOAD: { key: 'UPLOAD', label: 'Uploaded', bg: 'bg-amber-50', border: 'border-amber-300', dot: 'bg-amber-500' },
  DOWNLOAD: { key: 'DOWNLOAD', label: 'Downloaded', bg: 'bg-amber-50', border: 'border-amber-300', dot: 'bg-amber-400' },
  DOCUMENT_ADDED: { key: 'DOCUMENT_ADDED', label: 'Document Added', bg: 'bg-amber-50', border: 'border-amber-300', dot: 'bg-amber-500' },
  FILE_CREATED: { key: 'FILE_CREATED', label: 'File Created', bg: 'bg-amber-50', border: 'border-amber-300', dot: 'bg-amber-500' },
  PROOFED: { key: 'PROOFED', label: 'Proofed', bg: 'bg-violet-50', border: 'border-violet-300', dot: 'bg-violet-500' },
  APPROVED: { key: 'APPROVED', label: 'Approved', bg: 'bg-indigo-50', border: 'border-indigo-300', dot: 'bg-indigo-500' },
  FINISHING_DONE: { key: 'FINISHING_DONE', label: 'Finishing Done', bg: 'bg-orange-50', border: 'border-orange-300', dot: 'bg-orange-500' },
  QC_DONE: { key: 'QC_DONE', label: 'QC Done', bg: 'bg-cyan-50', border: 'border-cyan-300', dot: 'bg-cyan-500' },
  INSTALLED: { key: 'INSTALLED', label: 'Installed', bg: 'bg-emerald-50', border: 'border-emerald-300', dot: 'bg-emerald-500' },
  SHIP_ORDER: { key: 'SHIP_ORDER', label: 'Shipped', bg: 'bg-rose-50', border: 'border-rose-300', dot: 'bg-rose-500' },
  SHIPPED: { key: 'SHIPPED', label: 'Shipped', bg: 'bg-rose-50', border: 'border-rose-300', dot: 'bg-rose-500' },
  MARK_DELIVERED: { key: 'MARK_DELIVERED', label: 'Delivered', bg: 'bg-rose-50', border: 'border-rose-300', dot: 'bg-rose-600' },
  DELIVERED: { key: 'DELIVERED', label: 'Delivered', bg: 'bg-rose-50', border: 'border-rose-300', dot: 'bg-rose-600' },
  NOTE_ADDED: { key: 'NOTE_ADDED', label: 'Note Added', bg: 'bg-blue-50', border: 'border-blue-200', dot: 'bg-blue-400' },
  COMMENT: { key: 'COMMENT', label: 'Comment', bg: 'bg-blue-50', border: 'border-blue-200', dot: 'bg-blue-400' },
  LINE_ADDED: { key: 'LINE_ADDED', label: 'Line Added', bg: 'bg-lime-50', border: 'border-lime-300', dot: 'bg-lime-500' },
  LINE_REMOVED: { key: 'LINE_REMOVED', label: 'Line Removed', bg: 'bg-lime-50', border: 'border-lime-300', dot: 'bg-lime-400' },
  LINE_UPDATED: { key: 'LINE_UPDATED', label: 'Line Updated', bg: 'bg-lime-50', border: 'border-lime-300', dot: 'bg-lime-600' },
  ROUTING_SET: { key: 'ROUTING_SET', label: 'Routing Set', bg: 'bg-fuchsia-50', border: 'border-fuchsia-300', dot: 'bg-fuchsia-500' },
  PRIORITY_CHANGED: { key: 'PRIORITY_CHANGED', label: 'Priority Changed', bg: 'bg-yellow-50', border: 'border-yellow-300', dot: 'bg-yellow-500' },
  LOGIN: { key: 'LOGIN', label: 'Login', bg: 'bg-gray-50', border: 'border-gray-300', dot: 'bg-gray-400' },
  LOGOUT: { key: 'LOGOUT', label: 'Logout', bg: 'bg-gray-50', border: 'border-gray-300', dot: 'bg-gray-400' },
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

  // Allow explicit timeline keys on future events without a schema change.
  if (timelineKey in PRESENTATIONS) {
    return getStyle(timelineKey);
  }

  // Keep source around for future route-level heuristics, but the display should
  // always remain stable even if the source is unknown.
  void source;

  return DEFAULT_PRESENTATION;
}
