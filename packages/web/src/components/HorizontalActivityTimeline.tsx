import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History, Info, Printer, Scissors, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { api } from '../lib/api';
import { format, startOfDay, setHours, differenceInMinutes } from 'date-fns';

// ============================================================================
// Types
// ============================================================================

interface TimelineEvent {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  source: 'erp' | 'thrive' | 'zund' | 'email' | 'network';
  user?: string;
}

interface EquipmentActivityItem {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  source: 'thrive' | 'zund' | 'email' | 'network';
  details?: Record<string, unknown>;
}

interface HorizontalActivityTimelineProps {
  orderNumber: string;
  orderEvents?: Array<{
    id: string;
    eventType: string;
    description: string;
    createdAt: string;
    user: { displayName: string };
  }>;
}

// ============================================================================
// Color Palette - Muted, cohesive colors for different action types
// ============================================================================

// Action type to color mapping - uses Tailwind color palette
// Designed to be distinguishable but not overwhelming
const ACTION_COLORS: Record<string, { bg: string; border: string; dot: string; label: string }> = {
  // Creation events - Teal (fresh/new)
  CREATE: { bg: 'bg-teal-50', border: 'border-teal-300', dot: 'bg-teal-500', label: 'Created' },
  CREATED: { bg: 'bg-teal-50', border: 'border-teal-300', dot: 'bg-teal-500', label: 'Created' },
  
  // Updates - Slate (subtle change)
  UPDATE: { bg: 'bg-slate-50', border: 'border-slate-300', dot: 'bg-slate-500', label: 'Updated' },
  UPDATED: { bg: 'bg-slate-50', border: 'border-slate-300', dot: 'bg-slate-500', label: 'Updated' },
  
  // Status changes - Indigo (milestone)
  STATUS_CHANGED: { bg: 'bg-indigo-50', border: 'border-indigo-300', dot: 'bg-indigo-500', label: 'Status Changed' },
  STATUS_CHANGE: { bg: 'bg-indigo-50', border: 'border-indigo-300', dot: 'bg-indigo-500', label: 'Status Changed' },
  
  // Station completion - Emerald (success)
  STATION_COMPLETE: { bg: 'bg-emerald-50', border: 'border-emerald-300', dot: 'bg-emerald-500', label: 'Station Complete' },
  STATION_COMPLETED: { bg: 'bg-emerald-50', border: 'border-emerald-300', dot: 'bg-emerald-500', label: 'Station Complete' },
  
  // Assignment - Violet (people)
  ASSIGN: { bg: 'bg-violet-50', border: 'border-violet-300', dot: 'bg-violet-500', label: 'Assigned' },
  ASSIGNED: { bg: 'bg-violet-50', border: 'border-violet-300', dot: 'bg-violet-500', label: 'Assigned' },
  UNASSIGN: { bg: 'bg-violet-50', border: 'border-violet-300', dot: 'bg-violet-400', label: 'Unassigned' },
  
  // Print events - Sky blue (equipment)
  PRINT_QUEUED: { bg: 'bg-sky-50', border: 'border-sky-300', dot: 'bg-sky-400', label: 'Print Queued' },
  PRINT_PROCESSING: { bg: 'bg-sky-50', border: 'border-sky-300', dot: 'bg-sky-500', label: 'Printing' },
  PRINT_READY: { bg: 'bg-sky-50', border: 'border-sky-300', dot: 'bg-sky-500', label: 'Print Ready' },
  PRINT_PRINTING: { bg: 'bg-sky-50', border: 'border-sky-300', dot: 'bg-sky-600', label: 'Printing' },
  PRINT_COMPLETED: { bg: 'bg-sky-50', border: 'border-sky-300', dot: 'bg-sky-700', label: 'Print Done' },
  
  // Cut events - Orange (equipment)
  CUT_QUEUED: { bg: 'bg-orange-50', border: 'border-orange-300', dot: 'bg-orange-500', label: 'Cut Queued' },
  CUT_PROCESSING: { bg: 'bg-orange-50', border: 'border-orange-300', dot: 'bg-orange-600', label: 'Cutting' },
  CUT_COMPLETED: { bg: 'bg-orange-50', border: 'border-orange-300', dot: 'bg-orange-700', label: 'Cut Done' },
  
  // Email - Cyan (communication)
  EMAIL_SENT: { bg: 'bg-cyan-50', border: 'border-cyan-300', dot: 'bg-cyan-500', label: 'Email Sent' },
  
  // Documents - Amber (files)
  UPLOAD: { bg: 'bg-amber-50', border: 'border-amber-300', dot: 'bg-amber-500', label: 'Uploaded' },
  DOWNLOAD: { bg: 'bg-amber-50', border: 'border-amber-300', dot: 'bg-amber-400', label: 'Downloaded' },
  DOCUMENT_ADDED: { bg: 'bg-amber-50', border: 'border-amber-300', dot: 'bg-amber-500', label: 'Document Added' },
  FILE_CREATED: { bg: 'bg-amber-50', border: 'border-amber-300', dot: 'bg-amber-500', label: 'File Created' },
  
  // Shipping - Rose (logistics)
  SHIP_ORDER: { bg: 'bg-rose-50', border: 'border-rose-300', dot: 'bg-rose-500', label: 'Shipped' },
  SHIPPED: { bg: 'bg-rose-50', border: 'border-rose-300', dot: 'bg-rose-500', label: 'Shipped' },
  MARK_DELIVERED: { bg: 'bg-rose-50', border: 'border-rose-300', dot: 'bg-rose-600', label: 'Delivered' },
  DELIVERED: { bg: 'bg-rose-50', border: 'border-rose-300', dot: 'bg-rose-600', label: 'Delivered' },
  
  // Notes/Comments - Blue-gray
  NOTE_ADDED: { bg: 'bg-blue-50', border: 'border-blue-200', dot: 'bg-blue-400', label: 'Note Added' },
  COMMENT: { bg: 'bg-blue-50', border: 'border-blue-200', dot: 'bg-blue-400', label: 'Comment' },
  
  // Line item changes - Lime (inventory/items)
  LINE_ADDED: { bg: 'bg-lime-50', border: 'border-lime-300', dot: 'bg-lime-500', label: 'Line Added' },
  LINE_REMOVED: { bg: 'bg-lime-50', border: 'border-lime-300', dot: 'bg-lime-400', label: 'Line Removed' },
  LINE_UPDATED: { bg: 'bg-lime-50', border: 'border-lime-300', dot: 'bg-lime-600', label: 'Line Updated' },
  
  // Routing changes - Fuchsia (workflow)
  ROUTING_SET: { bg: 'bg-fuchsia-50', border: 'border-fuchsia-300', dot: 'bg-fuchsia-500', label: 'Routing Set' },
  
  // Priority changes - Yellow (attention)
  PRIORITY_CHANGED: { bg: 'bg-yellow-50', border: 'border-yellow-300', dot: 'bg-yellow-500', label: 'Priority Changed' },
  
  // Session events - Gray (low priority)
  LOGIN: { bg: 'bg-gray-50', border: 'border-gray-300', dot: 'bg-gray-400', label: 'Login' },
  LOGOUT: { bg: 'bg-gray-50', border: 'border-gray-300', dot: 'bg-gray-400', label: 'Logout' },
  
  // Default - Neutral blue
  DEFAULT: { bg: 'bg-blue-50', border: 'border-blue-200', dot: 'bg-blue-500', label: 'Activity' },
};

function getActionColor(type: string) {
  return ACTION_COLORS[type.toUpperCase()] || ACTION_COLORS.DEFAULT;
}

// ============================================================================
// Component
// ============================================================================

export function HorizontalActivityTimeline({ orderNumber, orderEvents = [] }: HorizontalActivityTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredEvent, setHoveredEvent] = useState<TimelineEvent | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [startX, setStartX] = useState(0);

  // Fetch equipment activity
  const { data, isLoading } = useQuery({
    queryKey: ['equipment-activity', orderNumber],
    queryFn: async () => {
      const response = await api.get(`/equipment/workorder/${orderNumber}/activity`);
      return response.data.data;
    },
    refetchInterval: 30000,
  });

  // Combine and sort all timeline events
  const timelineEvents = useMemo(() => {
    const combined: TimelineEvent[] = [];

    // Add order events
    for (const event of orderEvents) {
      combined.push({
        id: event.id,
        type: event.eventType,
        description: event.description,
        timestamp: event.createdAt,
        source: 'erp',
        user: event.user.displayName,
      });
    }

    // Add equipment activity
    if (data?.activity) {
      for (const activity of data.activity as EquipmentActivityItem[]) {
        combined.push({
          id: activity.id,
          type: activity.type,
          description: activity.description,
          timestamp: activity.timestamp,
          source: activity.source,
        });
      }
    }

    // Sort by timestamp ascending (oldest first for timeline)
    return combined.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [orderEvents, data?.activity]);

  // Calculate timeline boundaries (8am first day to 5pm last day)
  const { startTime, endTime, totalMinutes } = useMemo(() => {
    if (timelineEvents.length === 0) {
      const now = new Date();
      const todayStart = setHours(startOfDay(now), 8);
      const todayEnd = setHours(startOfDay(now), 17);
      return { startTime: todayStart, endTime: todayEnd, totalMinutes: 9 * 60 };
    }

    const firstEvent = new Date(timelineEvents[0].timestamp);
    const lastEvent = new Date(timelineEvents[timelineEvents.length - 1].timestamp);

    // 8am on the day of first event
    const start = setHours(startOfDay(firstEvent), 8);
    // 5pm on the day of last event
    const end = setHours(startOfDay(lastEvent), 17);

    const minutes = differenceInMinutes(end, start);
    return { startTime: start, endTime: end, totalMinutes: Math.max(minutes, 60) };
  }, [timelineEvents]);

  // Calculate position for each event (0-100%)
  const eventsWithPositions = useMemo(() => {
    return timelineEvents.map(event => {
      const eventTime = new Date(event.timestamp);
      const minutesFromStart = differenceInMinutes(eventTime, startTime);
      const position = Math.max(0, Math.min(100, (minutesFromStart / totalMinutes) * 100));
      return { ...event, position };
    });
  }, [timelineEvents, startTime, totalMinutes]);

  // Generate day markers for multi-day timelines
  const dayMarkers = useMemo(() => {
    const markers: { date: Date; position: number; label: string }[] = [];
    const start = startOfDay(startTime);
    const end = startOfDay(endTime);
    
    let current = start;
    while (current <= end) {
      const dayStart = setHours(current, 8);
      const minutesFromStart = differenceInMinutes(dayStart, startTime);
      const position = (minutesFromStart / totalMinutes) * 100;
      
      if (position >= 0 && position <= 100) {
        markers.push({
          date: current,
          position,
          label: format(current, 'EEE, MMM d'),
        });
      }
      
      current = new Date(current);
      current.setDate(current.getDate() + 1);
    }
    
    return markers;
  }, [startTime, endTime, totalMinutes]);

  // Handle mouse events for tooltip
  const handleMouseEnter = (event: TimelineEvent, e: React.MouseEvent) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
    });
    setHoveredEvent(event);
  };

  // Handle drag to scroll
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - containerRef.current.offsetLeft);
    setScrollLeft(containerRef.current.scrollLeft);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    e.preventDefault();
    const x = e.pageX - containerRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    containerRef.current.scrollLeft = scrollLeft - walk;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Get unique action types for legend
  const actionTypes = useMemo(() => {
    const types = new Set(eventsWithPositions.map(e => e.type.toUpperCase()));
    return Array.from(types).map(type => ({
      type,
      ...getActionColor(type),
    }));
  }, [eventsWithPositions]);

  if (isLoading && orderEvents.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-soft border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <History className="h-5 w-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-gray-900">Activity Timeline</h2>
        </div>
        <div className="p-6 animate-pulse">
          <div className="h-20 bg-gray-100 rounded-lg" />
        </div>
      </div>
    );
  }

  if (timelineEvents.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-soft border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <History className="h-5 w-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-gray-900">Activity Timeline</h2>
        </div>
        <div className="p-8 text-center text-gray-500">
          <History className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p>No activity recorded yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-soft border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-gray-900">Activity Timeline</h2>
          <span className="text-sm text-gray-500">({timelineEvents.length} events)</span>
        </div>
        
        {/* Zoom controls */}
        <div className="flex items-center gap-2">
          {data?.summary && (
            <div className="flex items-center gap-2 mr-4">
              {data.summary.printJobs > 0 && (
                <span className="px-2 py-0.5 text-xs font-medium bg-sky-100 text-sky-700 rounded-full flex items-center gap-1">
                  <Printer className="h-3 w-3" />
                  {data.summary.printJobs}
                </span>
              )}
              {data.summary.cutJobs > 0 && (
                <span className="px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 rounded-full flex items-center gap-1">
                  <Scissors className="h-3 w-3" />
                  {data.summary.cutJobs}
                </span>
              )}
            </div>
          )}
          <button
            onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            onClick={() => setZoom(1)}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
            title="Reset zoom"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            onClick={() => setZoom(z => Math.min(3, z + 0.25))}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Timeline Container */}
      <div
        ref={containerRef}
        className="overflow-x-auto cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          setHoveredEvent(null);
          handleMouseUp();
        }}
      >
        <div 
          className="relative py-6 px-8"
          style={{ width: `${Math.max(100, zoom * 100)}%`, minWidth: '600px' }}
        >
          {/* Day markers */}
          {dayMarkers.length > 1 && dayMarkers.map((marker, idx) => (
            <div
              key={idx}
              className="absolute top-0 bottom-0 border-l border-gray-200 border-dashed"
              style={{ left: `${marker.position}%` }}
            >
              <span className="absolute -top-0.5 left-1 text-[10px] font-medium text-gray-400 whitespace-nowrap">
                {marker.label}
              </span>
            </div>
          ))}

          {/* Timeline track */}
          <div className="relative h-16 flex items-center">
            {/* Main line */}
            <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 rounded-full" />
            
            {/* Time labels */}
            <div className="absolute left-0 -bottom-5 text-[10px] text-gray-400 font-medium">
              {format(startTime, 'h:mm a')}
            </div>
            <div className="absolute right-0 -bottom-5 text-[10px] text-gray-400 font-medium">
              {format(endTime, 'h:mm a')}
            </div>

            {/* Event dots */}
            {eventsWithPositions.map((event, idx) => {
              const colors = getActionColor(event.type);
              const isHovered = hoveredEvent?.id === event.id;
              
              return (
                <div
                  key={event.id}
                  className="absolute transform -translate-x-1/2 group"
                  style={{ 
                    left: `${event.position}%`,
                    zIndex: isHovered ? 50 : idx,
                  }}
                  onMouseEnter={(e) => handleMouseEnter(event, e)}
                  onMouseLeave={() => setHoveredEvent(null)}
                >
                  {/* Dot */}
                  <div
                    className={`
                      w-4 h-4 rounded-full cursor-pointer
                      transition-all duration-200 ease-out
                      ring-2 ring-white shadow-sm
                      ${colors.dot}
                      ${isHovered ? 'scale-150 ring-4 ring-opacity-50' : 'hover:scale-125'}
                    `}
                    style={{
                      boxShadow: isHovered ? `0 0 0 4px ${colors.dot.replace('bg-', 'rgba(').replace('-500', ', 0.2)')}` : undefined,
                    }}
                  />
                  
                  {/* Connecting line to tooltip area */}
                  {isHovered && (
                    <div className="absolute left-1/2 -translate-x-1/2 -top-2 w-0.5 h-2 bg-gray-300" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tooltip (portal-style, fixed position) */}
      {hoveredEvent && (
        <div
          className="fixed z-[100] pointer-events-none"
          style={{
            left: tooltipPosition.x,
            top: tooltipPosition.y,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className={`
            bg-white rounded-lg shadow-lg border px-3 py-2 min-w-[200px] max-w-[300px]
            ${getActionColor(hoveredEvent.type).border}
          `}>
            {/* Action type badge */}
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`
                w-2.5 h-2.5 rounded-full
                ${getActionColor(hoveredEvent.type).dot}
              `} />
              <span className="text-xs font-semibold text-gray-700">
                {getActionColor(hoveredEvent.type).label}
              </span>
              {hoveredEvent.source !== 'erp' && (
                <span className={`
                  ml-auto px-1.5 py-0.5 text-[10px] font-medium rounded
                  ${hoveredEvent.source === 'thrive' ? 'bg-sky-100 text-sky-700' : 'bg-orange-100 text-orange-700'}
                `}>
                  {hoveredEvent.source === 'thrive' ? 'PRINT' : 'CUT'}
                </span>
              )}
            </div>
            
            {/* Description */}
            <p className="text-sm text-gray-900 mb-1.5">
              {hoveredEvent.description}
            </p>
            
            {/* Timestamp and user */}
            <div className="flex items-center gap-2 text-[11px] text-gray-500">
              <span>{format(new Date(hoveredEvent.timestamp), 'MMM d, h:mm:ss a')}</span>
              {hoveredEvent.user && (
                <>
                  <span className="text-gray-300">•</span>
                  <span className="font-medium">{hoveredEvent.user}</span>
                </>
              )}
            </div>
            
            {/* Arrow pointing down */}
            <div className="absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-3 h-3 bg-white border-r border-b border-gray-200 rotate-45" />
          </div>
        </div>
      )}

      {/* Legend */}
      {actionTypes.length > 1 && (
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mr-2">Legend:</span>
            {actionTypes.map(({ type, dot, label }) => (
              <div key={type} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-gray-100">
                <span className={`w-2 h-2 rounded-full ${dot}`} />
                <span className="text-[10px] text-gray-600">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default HorizontalActivityTimeline;
