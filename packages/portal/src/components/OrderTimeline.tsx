import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Info,
  Package,
  Truck,
  FileText,
  Edit,
  Plus,
  ArrowRight,
  Loader2,
  LucideIcon,
} from 'lucide-react';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

// ============================================================================
// Types
// ============================================================================

type TimelineEventType =
  | 'create'
  | 'update'
  | 'delete'
  | 'status_change'
  | 'complete'
  | 'error'
  | 'warning'
  | 'info'
  | 'shipment'
  | 'delivery'
  | 'document';

interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  title: string;
  description?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Icon and Color Mappings
// ============================================================================

const typeIcons: Record<TimelineEventType, LucideIcon> = {
  create: Plus,
  update: Edit,
  delete: XCircle,
  status_change: ArrowRight,
  complete: CheckCircle2,
  error: XCircle,
  warning: AlertCircle,
  info: Info,
  shipment: Package,
  delivery: Truck,
  document: FileText,
};

const typeColors: Record<TimelineEventType, { bg: string; text: string; border: string }> = {
  create: { bg: 'bg-green-100', text: 'text-green-600', border: 'border-green-300' },
  update: { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-300' },
  delete: { bg: 'bg-red-100', text: 'text-red-600', border: 'border-red-300' },
  status_change: { bg: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-300' },
  complete: { bg: 'bg-green-100', text: 'text-green-600', border: 'border-green-300' },
  error: { bg: 'bg-red-100', text: 'text-red-600', border: 'border-red-300' },
  warning: { bg: 'bg-amber-100', text: 'text-amber-600', border: 'border-amber-300' },
  info: { bg: 'bg-blue-100', text: 'text-blue-500', border: 'border-blue-300' },
  shipment: { bg: 'bg-orange-100', text: 'text-orange-600', border: 'border-orange-300' },
  delivery: { bg: 'bg-emerald-100', text: 'text-emerald-600', border: 'border-emerald-300' },
  document: { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-300' },
};

// ============================================================================
// Helper Functions
// ============================================================================

function formatEventDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) {
    return `Today at ${format(date, 'h:mm a')}`;
  }
  if (isYesterday(date)) {
    return `Yesterday at ${format(date, 'h:mm a')}`;
  }
  return format(date, 'MMM d, yyyy h:mm a');
}

function getRelativeTime(dateStr: string): string {
  return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
}

// ============================================================================
// Timeline Item Component
// ============================================================================

interface TimelineItemProps {
  event: TimelineEvent;
  isLast?: boolean;
  index: number;
}

function TimelineItem({ event, isLast = false, index }: TimelineItemProps) {
  const Icon = typeIcons[event.type] || Clock;
  const colors = typeColors[event.type] || typeColors.info;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="relative flex gap-4"
    >
      {/* Connector line */}
      {!isLast && (
        <div className="absolute left-5 top-10 bottom-0 w-px bg-gray-200" />
      )}

      {/* Icon */}
      <div
        className={cn(
          'relative z-10 flex items-center justify-center w-10 h-10 rounded-full border-2 flex-shrink-0',
          colors.bg,
          colors.border
        )}
      >
        <Icon className={cn('w-5 h-5', colors.text)} />
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
          <time 
            className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0"
            title={formatEventDate(event.timestamp)}
          >
            {getRelativeTime(event.timestamp)}
          </time>
        </div>

        {/* Metadata badges */}
        {event.metadata && Object.keys(event.metadata).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(event.metadata).map(([key, value]) => {
              if (!value) return null;
              return (
                <span
                  key={key}
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600"
                >
                  <span className="font-medium capitalize">{key}:</span>
                  <span className="ml-1">{String(value)}</span>
                </span>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ============================================================================
// Main OrderTimeline Component
// ============================================================================

interface OrderTimelineProps {
  orderId: string;
  maxItems?: number;
}

export function OrderTimeline({ orderId, maxItems = 10 }: OrderTimelineProps) {
  const [showAll, setShowAll] = React.useState(false);

  const { data: events = [], isLoading, error } = useQuery({
    queryKey: ['order-timeline', orderId],
    queryFn: () => api.get(`/orders/${orderId}/timeline`).then((r) => r.data.data),
    enabled: !!orderId,
    staleTime: 30000, // 30 seconds
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
        <p className="text-sm text-gray-500">Failed to load timeline</p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-8">
        <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">No activity yet</p>
      </div>
    );
  }

  const displayEvents = showAll ? events : events.slice(0, maxItems);
  const hasMore = events.length > maxItems;

  return (
    <div>
      <AnimatePresence mode="wait">
        {displayEvents.map((event: TimelineEvent, index: number) => (
          <TimelineItem
            key={event.id}
            event={event}
            isLast={index === displayEvents.length - 1 && !hasMore}
            index={index}
          />
        ))}
      </AnimatePresence>

      {hasMore && !showAll && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => setShowAll(true)}
          className="w-full mt-2 py-2 text-sm text-primary-600 hover:text-primary-800 font-medium hover:bg-primary-50 rounded-lg transition-colors"
        >
          Show {events.length - maxItems} more events
        </motion.button>
      )}

      {showAll && events.length > maxItems && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => setShowAll(false)}
          className="w-full mt-2 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium hover:bg-gray-50 rounded-lg transition-colors"
        >
          Show less
        </motion.button>
      )}
    </div>
  );
}

// Need React for useState
import React from 'react';

export default OrderTimeline;
