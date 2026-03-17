/**
 * Timeline.tsx - CRITICAL-30
 * 
 * Timeline component for displaying chronological events.
 * Ideal for activity feeds, history logs, and event sequences.
 * 
 * Features:
 * - 30.1: Vertical and horizontal layouts
 * - 30.2: Alternating sides for visual interest
 * - 30.3: Customizable markers and connectors
 * - 30.4: Grouping by date/time periods
 * - 30.5: Expandable/collapsible items
 * 
 * @module Timeline
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { clsx } from 'clsx';
import {
  Circle,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Calendar,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/** Timeline item status */
export type TimelineStatus = 'default' | 'success' | 'error' | 'warning' | 'info' | 'pending';

/** Timeline layout */
export type TimelineLayout = 'left' | 'right' | 'alternate' | 'center';

/** Timeline item */
export interface TimelineItem<T = unknown> {
  /** Unique identifier */
  id: string;
  /** Title/heading */
  title: string;
  /** Description/content */
  description?: ReactNode;
  /** Timestamp */
  timestamp?: Date | string;
  /** Custom marker icon */
  icon?: ReactNode;
  /** Item status */
  status?: TimelineStatus;
  /** Whether item is expandable */
  expandable?: boolean;
  /** Expanded content */
  expandedContent?: ReactNode;
  /** Custom data */
  data?: T;
  /** Actions/buttons */
  actions?: ReactNode;
}

/** Timeline group */
export interface TimelineGroup<T = unknown> {
  /** Group label */
  label: string;
  /** Group items */
  items: TimelineItem<T>[];
}

/** Timeline context */
export interface TimelineContextValue {
  /** Layout mode */
  layout: TimelineLayout;
  /** Show timestamps */
  showTimestamps: boolean;
  /** Compact mode */
  compact: boolean;
  /** Expanded item IDs */
  expandedIds: Set<string>;
  /** Toggle item expansion */
  toggleExpand: (id: string) => void;
}

/** Timeline props */
export interface TimelineProps<T = unknown> {
  /** Timeline items */
  items?: TimelineItem<T>[];
  /** Grouped items (alternative to items) */
  groups?: TimelineGroup<T>[];
  /** Layout mode */
  layout?: TimelineLayout;
  /** Show timestamps */
  showTimestamps?: boolean;
  /** Compact mode (reduced spacing) */
  compact?: boolean;
  /** Show connector line */
  showConnector?: boolean;
  /** Default expanded item IDs */
  defaultExpanded?: string[];
  /** On item click */
  onItemClick?: (item: TimelineItem<T>) => void;
  /** Custom item renderer */
  renderItem?: (item: TimelineItem<T>, index: number) => ReactNode;
  /** Custom marker renderer */
  renderMarker?: (item: TimelineItem<T>) => ReactNode;
  /** Class name */
  className?: string;
  /** Item class name */
  itemClassName?: string;
}

/** Timeline item component props */
export interface TimelineItemProps<T = unknown> {
  /** Item data */
  item: TimelineItem<T>;
  /** Item index */
  index: number;
  /** Is first item */
  isFirst: boolean;
  /** Is last item */
  isLast: boolean;
  /** Show connector */
  showConnector: boolean;
  /** Side (for alternate layout) */
  side: 'left' | 'right';
  /** On click */
  onClick?: (item: TimelineItem<T>) => void;
  /** Custom renderer */
  renderItem?: TimelineProps<T>['renderItem'];
  /** Custom marker renderer */
  renderMarker?: TimelineProps<T>['renderMarker'];
  /** Custom class */
  className?: string;
}

// ============================================================================
// CONTEXT
// ============================================================================

const TimelineContext = createContext<TimelineContextValue | null>(null);

function useTimelineContext(): TimelineContextValue {
  const context = useContext(TimelineContext);
  if (!context) {
    throw new Error('useTimelineContext must be used within a Timeline');
  }
  return context;
}

/** Hook to access timeline context */
export function useTimeline(): TimelineContextValue {
  return useTimelineContext();
}

// ============================================================================
// UTILITIES
// ============================================================================

/** Format timestamp */
function formatTimestamp(timestamp: Date | string): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  
  if (isToday) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();
  
  if (isYesterday) {
    return `Yesterday, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  }
  
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Get relative time */
function getRelativeTime(timestamp: Date | string): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatTimestamp(date);
}

/** Group items by date */
function groupByDate<T>(items: TimelineItem<T>[]): TimelineGroup<T>[] {
  const groups = new Map<string, TimelineItem<T>[]>();
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  items.forEach((item) => {
    if (!item.timestamp) {
      const key = 'No Date';
      groups.set(key, [...(groups.get(key) || []), item]);
      return;
    }

    const date = typeof item.timestamp === 'string' ? new Date(item.timestamp) : item.timestamp;
    const dateStr = date.toDateString();
    let label: string;

    if (dateStr === today) {
      label = 'Today';
    } else if (dateStr === yesterday) {
      label = 'Yesterday';
    } else {
      label = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    }

    groups.set(label, [...(groups.get(label) || []), item]);
  });

  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}

// ============================================================================
// STATUS STYLES
// ============================================================================

const STATUS_STYLES: Record<TimelineStatus, { bg: string; text: string; border: string }> = {
  default: {
    bg: 'bg-gray-100 dark:bg-gray-800',
    text: 'text-gray-600 dark:text-gray-400',
    border: 'border-gray-300 dark:border-gray-600',
  },
  success: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-600 dark:text-green-400',
    border: 'border-green-500',
  },
  error: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-600 dark:text-red-400',
    border: 'border-red-500',
  },
  warning: {
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-500',
  },
  info: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-500',
  },
  pending: {
    bg: 'bg-gray-50 dark:bg-gray-800/50',
    text: 'text-gray-400 dark:text-gray-500',
    border: 'border-gray-300 dark:border-gray-600 border-dashed',
  },
};

const STATUS_ICONS: Record<TimelineStatus, ReactNode> = {
  default: <Circle className="w-3 h-3" />,
  success: <CheckCircle2 className="w-4 h-4" />,
  error: <XCircle className="w-4 h-4" />,
  warning: <AlertCircle className="w-4 h-4" />,
  info: <Circle className="w-3 h-3" />,
  pending: <Clock className="w-3 h-3" />,
};

// ============================================================================
// 30.1-30.5: TIMELINE COMPONENT
// ============================================================================

/**
 * Timeline component for chronological events
 * 
 * @example
 * ```tsx
 * const events = [
 *   { id: '1', title: 'Order placed', timestamp: new Date(), status: 'success' },
 *   { id: '2', title: 'Processing', timestamp: new Date(), status: 'info' },
 * ];
 * 
 * <Timeline items={events} layout="left" />
 * ```
 */
export function Timeline<T = unknown>({
  items = [],
  groups,
  layout = 'left',
  showTimestamps = true,
  compact = false,
  showConnector = true,
  defaultExpanded = [],
  onItemClick,
  renderItem,
  renderMarker,
  className,
  itemClassName,
}: TimelineProps<T>) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(defaultExpanded));

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Use groups or create single group from items
  const timelineGroups = groups || (items.length > 0 ? [{ label: '', items }] : []);

  // Context value
  const contextValue = useMemo<TimelineContextValue>(() => ({
    layout,
    showTimestamps,
    compact,
    expandedIds,
    toggleExpand,
  }), [layout, showTimestamps, compact, expandedIds, toggleExpand]);

  if (timelineGroups.length === 0 || timelineGroups.every((g) => g.items.length === 0)) {
    return (
      <div className={clsx('p-4 text-center text-gray-500', className)}>
        No events
      </div>
    );
  }

  return (
    <TimelineContext.Provider value={contextValue}>
      <div className={clsx('relative', className)}>
        {timelineGroups.map((group, groupIndex) => (
          <div key={group.label || groupIndex}>
            {/* Group label */}
            {group.label && (
              <div className="flex items-center gap-2 mb-4 mt-6 first:mt-0">
                <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-2">
                  {group.label}
                </span>
                <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
              </div>
            )}

            {/* Items */}
            <div className={clsx(layout === 'center' && 'relative')}>
              {/* Center line for center layout */}
              {layout === 'center' && showConnector && (
                <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700 -translate-x-1/2" />
              )}

              {group.items.map((item, index) => (
                <TimelineItemComponent
                  key={item.id}
                  item={item}
                  index={index}
                  isFirst={index === 0}
                  isLast={index === group.items.length - 1}
                  showConnector={showConnector}
                  side={layout === 'alternate' ? (index % 2 === 0 ? 'left' : 'right') : 'left'}
                  onClick={onItemClick}
                  renderItem={renderItem}
                  renderMarker={renderMarker}
                  className={itemClassName}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </TimelineContext.Provider>
  );
}

// ============================================================================
// TIMELINE ITEM COMPONENT
// ============================================================================

function TimelineItemComponent<T = unknown>({
  item,
  index,
  isFirst,
  isLast,
  showConnector,
  side,
  onClick,
  renderItem,
  renderMarker,
  className,
}: TimelineItemProps<T>) {
  const { layout, showTimestamps, compact, expandedIds, toggleExpand } = useTimelineContext();

  const status = item.status || 'default';
  const styles = STATUS_STYLES[status];
  const isExpanded = expandedIds.has(item.id);
  const isAlternate = layout === 'alternate';
  const isCenter = layout === 'center';
  const isRight = layout === 'right' || (isAlternate && side === 'right');

  const handleClick = () => {
    onClick?.(item);
  };

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleExpand(item.id);
  };

  // Custom render
  if (renderItem) {
    return (
      <div className={clsx('relative', className)}>
        {renderItem(item, index)}
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'relative flex',
        compact ? 'pb-4' : 'pb-6',
        isLast && 'pb-0',
        isCenter && 'justify-center',
        isRight && !isCenter && 'flex-row-reverse',
        isAlternate && side === 'right' && 'flex-row-reverse',
        className
      )}
    >
      {/* Connector line */}
      {showConnector && !isLast && !isCenter && (
        <div
          className={clsx(
            'absolute w-0.5 bg-gray-200 dark:bg-gray-700',
            isRight ? 'right-[11px]' : 'left-[11px]',
            'top-6 bottom-0'
          )}
        />
      )}

      {/* Marker */}
      <div
        className={clsx(
          'relative z-10 flex-shrink-0',
          isCenter ? 'mx-4' : isRight ? 'ml-4' : 'mr-4'
        )}
      >
        {renderMarker ? (
          renderMarker(item)
        ) : (
          <div
            className={clsx(
              'w-6 h-6 rounded-full flex items-center justify-center',
              'border-2 bg-white dark:bg-gray-900',
              styles.border,
              styles.text
            )}
          >
            {item.icon || STATUS_ICONS[status]}
          </div>
        )}
      </div>

      {/* Content */}
      <div
        className={clsx(
          'flex-1 min-w-0',
          isCenter && 'max-w-md',
          onClick && 'cursor-pointer'
        )}
        onClick={handleClick}
      >
        {/* Card */}
        <div
          className={clsx(
            'rounded-lg border p-3',
            'bg-white dark:bg-gray-800',
            'border-gray-200 dark:border-gray-700',
            onClick && 'hover:border-blue-300 dark:hover:border-blue-700 transition-colors'
          )}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                {item.title}
              </h4>
              {showTimestamps && item.timestamp && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {getRelativeTime(item.timestamp)}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {item.actions}
              {item.expandable && (
                <button
                  type="button"
                  onClick={handleToggleExpand}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
                  aria-expanded={isExpanded}
                  aria-label={isExpanded ? 'Collapse' : 'Expand'}
                >
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Description */}
          {item.description && (
            <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              {item.description}
            </div>
          )}

          {/* Expanded content */}
          {item.expandable && isExpanded && item.expandedContent && (
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
              {item.expandedContent}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ACTIVITY FEED (specialized timeline)
// ============================================================================

export interface ActivityItem {
  id: string;
  user: {
    name: string;
    avatar?: string;
  };
  action: string;
  target?: string;
  timestamp: Date | string;
  metadata?: Record<string, unknown>;
}

export interface ActivityFeedProps {
  /** Activities */
  activities: ActivityItem[];
  /** Show avatars */
  showAvatars?: boolean;
  /** Max items to show */
  maxItems?: number;
  /** On load more */
  onLoadMore?: () => void;
  /** Loading state */
  loading?: boolean;
  /** Class name */
  className?: string;
}

/**
 * Activity feed component
 * 
 * @example
 * ```tsx
 * <ActivityFeed
 *   activities={[
 *     { id: '1', user: { name: 'John' }, action: 'created', target: 'Order #123', timestamp: new Date() },
 *   ]}
 * />
 * ```
 */
export function ActivityFeed({
  activities,
  showAvatars = true,
  maxItems,
  onLoadMore,
  loading = false,
  className,
}: ActivityFeedProps) {
  const displayedActivities = maxItems ? activities.slice(0, maxItems) : activities;
  const hasMore = maxItems ? activities.length > maxItems : false;

  return (
    <div className={clsx('space-y-4', className)}>
      {displayedActivities.map((activity) => (
        <div key={activity.id} className="flex items-start gap-3">
          {/* Avatar */}
          {showAvatars && (
            <div className="flex-shrink-0">
              {activity.user.avatar ? (
                <img
                  src={activity.user.avatar}
                  alt={activity.user.name}
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-sm font-medium text-gray-600 dark:text-gray-300">
                  {activity.user.name.charAt(0)}
                </div>
              )}
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {activity.user.name}
              </span>
              {' '}
              {activity.action}
              {activity.target && (
                <>
                  {' '}
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {activity.target}
                  </span>
                </>
              )}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {getRelativeTime(activity.timestamp)}
            </p>
          </div>
        </div>
      ))}

      {/* Load more */}
      {(hasMore || onLoadMore) && (
        <div className="text-center pt-2">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loading}
            className={clsx(
              'text-sm text-blue-500 hover:text-blue-600',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {loading ? 'Loading...' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// HISTORY LOG (compact timeline)
// ============================================================================

export interface HistoryEntry {
  id: string;
  message: string;
  timestamp: Date | string;
  type?: 'create' | 'update' | 'delete' | 'info';
  user?: string;
}

export interface HistoryLogProps {
  /** History entries */
  entries: HistoryEntry[];
  /** Show dates */
  showDates?: boolean;
  /** Max entries */
  maxEntries?: number;
  /** Class name */
  className?: string;
}

const HISTORY_TYPE_COLORS = {
  create: 'text-green-500',
  update: 'text-blue-500',
  delete: 'text-red-500',
  info: 'text-gray-400',
};

/**
 * Compact history log
 * 
 * @example
 * ```tsx
 * <HistoryLog
 *   entries={[
 *     { id: '1', message: 'Status changed to In Progress', type: 'update', timestamp: new Date() },
 *   ]}
 * />
 * ```
 */
export function HistoryLog({
  entries,
  showDates = true,
  maxEntries,
  className,
}: HistoryLogProps) {
  const displayedEntries = maxEntries ? entries.slice(0, maxEntries) : entries;

  return (
    <div className={clsx('space-y-2', className)}>
      {displayedEntries.map((entry) => (
        <div key={entry.id} className="flex items-start gap-2 text-sm">
          {/* Dot */}
          <div
            className={clsx(
              'w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0',
              entry.type ? HISTORY_TYPE_COLORS[entry.type].replace('text-', 'bg-') : 'bg-gray-400'
            )}
          />

          {/* Content */}
          <div className="flex-1 min-w-0">
            <span className="text-gray-700 dark:text-gray-300">
              {entry.message}
            </span>
            {entry.user && (
              <span className="text-gray-500 dark:text-gray-400">
                {' '}by {entry.user}
              </span>
            )}
          </div>

          {/* Timestamp */}
          {showDates && (
            <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
              {getRelativeTime(entry.timestamp)}
            </span>
          )}
        </div>
      ))}

      {maxEntries && entries.length > maxEntries && (
        <div className="text-xs text-gray-400 dark:text-gray-500 pl-3.5">
          +{entries.length - maxEntries} more entries
        </div>
      )}
    </div>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  formatTimestamp,
  getRelativeTime,
  groupByDate,
  STATUS_STYLES,
  STATUS_ICONS,
};

// Types are exported inline at their definitions
