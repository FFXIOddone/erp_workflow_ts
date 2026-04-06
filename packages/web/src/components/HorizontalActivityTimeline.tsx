import { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History, Printer, Scissors, ZoomIn, ZoomOut, RotateCcw, Maximize2 } from 'lucide-react';
import { api } from '../lib/api';
import { format, startOfDay, setHours, differenceInMinutes } from 'date-fns';
import { FullscreenPanel } from './FullscreenPanel';
import { resolveActivityTimelinePresentation, type ActivityTimelinePresentation } from './activityTimelinePresentation';

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
  details?: Record<string, unknown>;
}

interface TimelineEventWithPresentation extends TimelineEvent {
  position: number;
  presentation: ActivityTimelinePresentation;
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
    details?: Record<string, unknown>;
  }>;
  showFullscreenButton?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function HorizontalActivityTimeline({
  orderNumber,
  orderEvents = [],
  showFullscreenButton = true,
}: HorizontalActivityTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredEvent, setHoveredEvent] = useState<TimelineEventWithPresentation | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [startX, setStartX] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

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
        details: event.details,
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
          details: activity.details,
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
  const eventsWithPositions = useMemo<TimelineEventWithPresentation[]>(() => {
    return timelineEvents.map(event => {
      const presentation = resolveActivityTimelinePresentation(event);
      const eventTime = new Date(event.timestamp);
      const minutesFromStart = differenceInMinutes(eventTime, startTime);
      const position = Math.max(0, Math.min(100, (minutesFromStart / totalMinutes) * 100));
      return { ...event, position, presentation };
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
  const handleMouseEnter = (event: TimelineEventWithPresentation, e: React.MouseEvent) => {
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
    const types = new Map<string, ActivityTimelinePresentation>();
    for (const event of eventsWithPositions) {
      if (!types.has(event.presentation.key)) {
        types.set(event.presentation.key, event.presentation);
      }
    }
    return Array.from(types.values());
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
      <div className="flex flex-col gap-3 border-b border-gray-100 px-6 py-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <History className="h-5 w-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-gray-900">Activity Timeline</h2>
          <span className="text-sm text-gray-500">({timelineEvents.length} events)</span>
        </div>
        
        {/* Zoom controls */}
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {data?.summary && (
            <div className="flex flex-wrap items-center gap-2 lg:mr-2">
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
          {showFullscreenButton && (
            <button
              type="button"
              onClick={() => setIsFullscreen(true)}
              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
              title="Open full screen"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          )}
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
          className="relative px-5 py-6 sm:px-8"
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
                      ${event.presentation.dot}
                      ${isHovered ? 'scale-150 ring-4 ring-opacity-50' : 'hover:scale-125'}
                    `}
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
            ${hoveredEvent.presentation.border}
          `}>
            {/* Action type badge */}
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`
                w-2.5 h-2.5 rounded-full
                ${hoveredEvent.presentation.dot}
              `} />
              <span className="text-xs font-semibold text-gray-700">
                {hoveredEvent.presentation.label}
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
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mr-2">Legend:</span>
            {actionTypes.map(({ key, dot, label }) => (
              <div key={key} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-gray-100">
                <span className={`w-2 h-2 rounded-full ${dot}`} />
                <span className="text-[10px] text-gray-600">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <FullscreenPanel
        open={isFullscreen}
        title="Activity Timeline"
        subtitle={`Order #${orderNumber}`}
        onClose={() => setIsFullscreen(false)}
        maxWidthClassName="max-w-[1800px]"
      >
        <div className="p-4 sm:p-6">
          <HorizontalActivityTimeline
            orderNumber={orderNumber}
            orderEvents={orderEvents}
            showFullscreenButton={false}
          />
        </div>
      </FullscreenPanel>
    </div>
  );
}

export default HorizontalActivityTimeline;
