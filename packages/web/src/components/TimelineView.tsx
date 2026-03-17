import { ReactNode } from 'react';
import clsx from 'clsx';
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Info,
  User,
  Package,
  Truck,
  FileText,
  Settings,
  Mail,
  Phone,
  MessageSquare,
  Edit,
  Trash2,
  Plus,
  ArrowRight,
  LucideIcon,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export type TimelineEventType =
  | 'create'
  | 'update'
  | 'delete'
  | 'status_change'
  | 'assign'
  | 'complete'
  | 'error'
  | 'warning'
  | 'info'
  | 'email'
  | 'call'
  | 'message'
  | 'shipment'
  | 'delivery'
  | 'document'
  | 'settings'
  | 'user'
  | 'custom';

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  title: string;
  description?: string;
  timestamp: string | Date;
  user?: {
    id?: string;
    name: string;
    avatar?: string;
  };
  metadata?: Record<string, unknown>;
  icon?: LucideIcon;
  iconColor?: string;
  dotColor?: string;
}

export interface TimelineGroup {
  label: string;
  date: Date;
  events: TimelineEvent[];
}

// ============================================================================
// Icon and Color Mappings
// ============================================================================

const typeIcons: Record<TimelineEventType, LucideIcon> = {
  create: Plus,
  update: Edit,
  delete: Trash2,
  status_change: ArrowRight,
  assign: User,
  complete: CheckCircle2,
  error: XCircle,
  warning: AlertCircle,
  info: Info,
  email: Mail,
  call: Phone,
  message: MessageSquare,
  shipment: Package,
  delivery: Truck,
  document: FileText,
  settings: Settings,
  user: User,
  custom: Clock,
};

const typeIconColors: Record<TimelineEventType, string> = {
  create: 'text-green-500',
  update: 'text-blue-500',
  delete: 'text-red-500',
  status_change: 'text-purple-500',
  assign: 'text-indigo-500',
  complete: 'text-green-600',
  error: 'text-red-600',
  warning: 'text-amber-500',
  info: 'text-blue-400',
  email: 'text-cyan-500',
  call: 'text-teal-500',
  message: 'text-violet-500',
  shipment: 'text-orange-500',
  delivery: 'text-emerald-500',
  document: 'text-slate-500',
  settings: 'text-gray-500',
  user: 'text-indigo-500',
  custom: 'text-gray-400',
};

const typeDotColors: Record<TimelineEventType, string> = {
  create: 'bg-green-500',
  update: 'bg-blue-500',
  delete: 'bg-red-500',
  status_change: 'bg-purple-500',
  assign: 'bg-indigo-500',
  complete: 'bg-green-600',
  error: 'bg-red-600',
  warning: 'bg-amber-500',
  info: 'bg-blue-400',
  email: 'bg-cyan-500',
  call: 'bg-teal-500',
  message: 'bg-violet-500',
  shipment: 'bg-orange-500',
  delivery: 'bg-emerald-500',
  document: 'bg-slate-500',
  settings: 'bg-gray-500',
  user: 'bg-indigo-500',
  custom: 'bg-gray-400',
};

// ============================================================================
// Helper Functions
// ============================================================================

function formatEventDate(date: Date): string {
  if (isToday(date)) {
    return `Today at ${format(date, 'h:mm a')}`;
  }
  if (isYesterday(date)) {
    return `Yesterday at ${format(date, 'h:mm a')}`;
  }
  return format(date, 'MMM d, yyyy h:mm a');
}

function formatGroupLabel(date: Date): string {
  if (isToday(date)) {
    return 'Today';
  }
  if (isYesterday(date)) {
    return 'Yesterday';
  }
  return format(date, 'EEEE, MMMM d, yyyy');
}

function groupEventsByDate(events: TimelineEvent[]): TimelineGroup[] {
  const groups: Map<string, TimelineGroup> = new Map();

  events.forEach((event) => {
    const date = new Date(event.timestamp);
    const dateKey = format(date, 'yyyy-MM-dd');

    if (!groups.has(dateKey)) {
      groups.set(dateKey, {
        label: formatGroupLabel(date),
        date: new Date(dateKey),
        events: [],
      });
    }

    groups.get(dateKey)!.events.push(event);
  });

  // Sort groups by date descending
  return Array.from(groups.values()).sort(
    (a, b) => b.date.getTime() - a.date.getTime()
  );
}

// ============================================================================
// Timeline Item Component
// ============================================================================

interface TimelineItemProps {
  event: TimelineEvent;
  isLast?: boolean;
  showConnector?: boolean;
  variant?: 'default' | 'compact';
}

export function TimelineItem({
  event,
  isLast = false,
  showConnector = true,
  variant = 'default',
}: TimelineItemProps) {
  const Icon = event.icon || typeIcons[event.type];
  const iconColor = event.iconColor || typeIconColors[event.type];
  const dotColor = event.dotColor || typeDotColors[event.type];
  const timestamp = new Date(event.timestamp);

  if (variant === 'compact') {
    return (
      <div className="flex items-start gap-3 py-2">
        <div className={clsx('w-2 h-2 rounded-full mt-2 flex-shrink-0', dotColor)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium text-gray-900 truncate">{event.title}</span>
            <span className="text-gray-400">·</span>
            <span className="text-gray-500 text-xs flex-shrink-0">
              {formatDistanceToNow(timestamp, { addSuffix: true })}
            </span>
          </div>
          {event.description && (
            <p className="text-xs text-gray-500 mt-0.5 truncate">{event.description}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex gap-4">
      {/* Connector line */}
      {showConnector && !isLast && (
        <div className="absolute left-5 top-10 bottom-0 w-px bg-gray-200" />
      )}

      {/* Icon */}
      <div
        className={clsx(
          'relative z-10 flex items-center justify-center w-10 h-10 rounded-full bg-white border-2 flex-shrink-0',
          dotColor.replace('bg-', 'border-')
        )}
      >
        <Icon className={clsx('w-5 h-5', iconColor)} />
      </div>

      {/* Content */}
      <div className="flex-1 pb-6 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">{event.title}</p>
            {event.description && (
              <p className="text-sm text-gray-600 mt-0.5">{event.description}</p>
            )}
          </div>
          <time className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0">
            {formatEventDate(timestamp)}
          </time>
        </div>

        {/* User info */}
        {event.user && (
          <div className="flex items-center gap-2 mt-2">
            {event.user.avatar ? (
              <img
                src={event.user.avatar}
                alt={event.user.name}
                className="w-5 h-5 rounded-full"
              />
            ) : (
              <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center">
                <User className="w-3 h-3 text-gray-500" />
              </div>
            )}
            <span className="text-xs text-gray-500">{event.user.name}</span>
          </div>
        )}

        {/* Metadata */}
        {event.metadata && Object.keys(event.metadata).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(event.metadata).map(([key, value]) => (
              <span
                key={key}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600"
              >
                <span className="font-medium capitalize">{key}:</span>
                <span className="ml-1">{String(value)}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Timeline Group Component
// ============================================================================

interface TimelineGroupHeaderProps {
  label: string;
}

function TimelineGroupHeader({ label }: TimelineGroupHeaderProps) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="h-px flex-1 bg-gray-200" />
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
        {label}
      </span>
      <div className="h-px flex-1 bg-gray-200" />
    </div>
  );
}

// ============================================================================
// Main TimelineView Component
// ============================================================================

export interface TimelineViewProps {
  events: TimelineEvent[];
  variant?: 'default' | 'compact';
  groupByDate?: boolean;
  showConnectors?: boolean;
  emptyMessage?: string;
  emptyIcon?: ReactNode;
  maxItems?: number;
  showMore?: () => void;
  showMoreLabel?: string;
  className?: string;
}

export function TimelineView({
  events,
  variant = 'default',
  groupByDate = false,
  showConnectors = true,
  emptyMessage = 'No activity yet',
  emptyIcon,
  maxItems,
  showMore,
  showMoreLabel = 'Show more',
  className,
}: TimelineViewProps) {
  if (events.length === 0) {
    return (
      <div className={clsx('flex flex-col items-center justify-center py-12 text-center', className)}>
        {emptyIcon || <Clock className="w-12 h-12 text-gray-300 mb-4" />}
        <p className="text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  // Limit events if maxItems is specified
  const displayEvents = maxItems ? events.slice(0, maxItems) : events;
  const hasMore = maxItems && events.length > maxItems;

  // Group by date if requested
  if (groupByDate && variant === 'default') {
    const groups = groupEventsByDate(displayEvents);

    return (
      <div className={className}>
        {groups.map((group, groupIndex) => (
          <div key={group.label}>
            <TimelineGroupHeader label={group.label} />
            <div className="pl-1">
              {group.events.map((event, eventIndex) => (
                <TimelineItem
                  key={event.id}
                  event={event}
                  isLast={
                    groupIndex === groups.length - 1 &&
                    eventIndex === group.events.length - 1
                  }
                  showConnector={showConnectors}
                  variant={variant}
                />
              ))}
            </div>
          </div>
        ))}
        {hasMore && showMore && (
          <button
            onClick={showMore}
            className="w-full mt-4 py-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            {showMoreLabel}
          </button>
        )}
      </div>
    );
  }

  // Simple list without grouping
  return (
    <div className={className}>
      {variant === 'compact' ? (
        <div className="divide-y divide-gray-100">
          {displayEvents.map((event) => (
            <TimelineItem key={event.id} event={event} variant={variant} />
          ))}
        </div>
      ) : (
        displayEvents.map((event, index) => (
          <TimelineItem
            key={event.id}
            event={event}
            isLast={index === displayEvents.length - 1}
            showConnector={showConnectors}
            variant={variant}
          />
        ))
      )}
      {hasMore && showMore && (
        <button
          onClick={showMore}
          className="w-full mt-4 py-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          {showMoreLabel}
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Activity Timeline Component (Pre-configured for Activity Logs)
// ============================================================================

export interface ActivityTimelineProps {
  activities: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId?: string;
    entityName?: string;
    description: string;
    createdAt: string | Date;
    user?: {
      id: string;
      displayName: string;
      profilePhoto?: string;
    };
    details?: Record<string, unknown>;
  }>;
  variant?: 'default' | 'compact';
  groupByDate?: boolean;
  maxItems?: number;
  showMore?: () => void;
  className?: string;
}

const actionTypeMap: Record<string, TimelineEventType> = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  STATUS_CHANGE: 'status_change',
  ASSIGN: 'assign',
  UNASSIGN: 'assign',
  STATION_COMPLETE: 'complete',
  LOGIN: 'user',
  LOGOUT: 'user',
  EMAIL_SENT: 'email',
  UPLOAD: 'document',
  DOWNLOAD: 'document',
  SHIP_ORDER: 'shipment',
  MARK_DELIVERED: 'delivery',
  SETTINGS_CHANGE: 'settings',
};

export function ActivityTimeline({
  activities,
  variant = 'default',
  groupByDate = true,
  maxItems,
  showMore,
  className,
}: ActivityTimelineProps) {
  const events: TimelineEvent[] = activities.map((activity) => ({
    id: activity.id,
    type: actionTypeMap[activity.action] || 'info',
    title: activity.description,
    description: activity.entityName
      ? `${activity.entityType}: ${activity.entityName}`
      : undefined,
    timestamp: activity.createdAt,
    user: activity.user
      ? {
          id: activity.user.id,
          name: activity.user.displayName,
          avatar: activity.user.profilePhoto,
        }
      : undefined,
    metadata: activity.details as Record<string, unknown>,
  }));

  return (
    <TimelineView
      events={events}
      variant={variant}
      groupByDate={groupByDate}
      maxItems={maxItems}
      showMore={showMore}
      emptyMessage="No activity recorded"
      className={className}
    />
  );
}

// ============================================================================
// Order History Timeline (Pre-configured for Order Status Changes)
// ============================================================================

export interface OrderHistoryEvent {
  id: string;
  type: 'status' | 'station' | 'assignment' | 'note' | 'attachment' | 'shipment';
  title: string;
  description?: string;
  timestamp: string | Date;
  user?: {
    name: string;
    avatar?: string;
  };
  fromStatus?: string;
  toStatus?: string;
  station?: string;
}

export interface OrderHistoryTimelineProps {
  events: OrderHistoryEvent[];
  variant?: 'default' | 'compact';
  className?: string;
}

const orderEventTypeMap: Record<string, TimelineEventType> = {
  status: 'status_change',
  station: 'complete',
  assignment: 'assign',
  note: 'message',
  attachment: 'document',
  shipment: 'shipment',
};

export function OrderHistoryTimeline({
  events,
  variant = 'default',
  className,
}: OrderHistoryTimelineProps) {
  const timelineEvents: TimelineEvent[] = events.map((event) => ({
    id: event.id,
    type: orderEventTypeMap[event.type] || 'info',
    title: event.title,
    description: event.description,
    timestamp: event.timestamp,
    user: event.user,
    metadata:
      event.fromStatus && event.toStatus
        ? { from: event.fromStatus, to: event.toStatus }
        : event.station
        ? { station: event.station }
        : undefined,
  }));

  return (
    <TimelineView
      events={timelineEvents}
      variant={variant}
      groupByDate={variant === 'default'}
      emptyMessage="No order history"
      className={className}
    />
  );
}

export default TimelineView;
