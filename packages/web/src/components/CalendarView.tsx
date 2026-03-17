import { useState, useMemo, ReactNode, useCallback } from 'react';
import clsx from 'clsx';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  addWeeks,
  subMonths,
  subWeeks,
  isSameMonth,
  isSameDay,
  isToday,
  isBefore,
  isAfter,
  parseISO,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export type CalendarViewMode = 'month' | 'week' | 'day';

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date | string;
  end?: Date | string;
  allDay?: boolean;
  color?: string;
  className?: string;
  data?: Record<string, unknown>;
}

export interface CalendarDayProps {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  isPast: boolean;
  events: CalendarEvent[];
}

export interface CalendarViewProps {
  // View control
  viewMode?: CalendarViewMode;
  currentDate?: Date;
  onDateChange?: (date: Date) => void;
  onViewModeChange?: (mode: CalendarViewMode) => void;

  // Selection
  selectedDate?: Date | null;
  onSelectDate?: (date: Date) => void;
  selectable?: boolean;

  // Events
  events?: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;

  // Rendering customization
  renderDay?: (props: CalendarDayProps) => ReactNode;
  renderEvent?: (event: CalendarEvent, date: Date) => ReactNode;
  renderHeader?: (date: Date, goToPrev: () => void, goToNext: () => void, goToToday: () => void) => ReactNode;

  // Styling
  className?: string;
  dayClassName?: string | ((date: Date) => string);
  minDate?: Date;
  maxDate?: Date;
  disabledDates?: Date[];

  // Layout
  showHeader?: boolean;
  showWeekNumbers?: boolean;
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  fixedWeeks?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getEventsForDate(events: CalendarEvent[], date: Date): CalendarEvent[] {
  return events.filter((event) => {
    const eventStart = typeof event.start === 'string' ? parseISO(event.start) : event.start;
    return isSameDay(eventStart, date);
  });
}

function isDateDisabled(
  date: Date,
  minDate?: Date,
  maxDate?: Date,
  disabledDates?: Date[]
): boolean {
  if (minDate && isBefore(date, minDate)) return true;
  if (maxDate && isAfter(date, maxDate)) return true;
  if (disabledDates?.some((d) => isSameDay(d, date))) return true;
  return false;
}

// ============================================================================
// Default Event Component
// ============================================================================

interface DefaultEventProps {
  event: CalendarEvent;
  compact?: boolean;
}

function DefaultEvent({ event, compact }: DefaultEventProps) {
  const colorClass = event.color || 'bg-primary-500';

  if (compact) {
    return (
      <div
        className={clsx(
          'w-2 h-2 rounded-full flex-shrink-0',
          colorClass
        )}
        title={event.title}
      />
    );
  }

  return (
    <div
      className={clsx(
        'text-xs px-1.5 py-0.5 rounded truncate text-white',
        colorClass,
        event.className
      )}
      title={event.title}
    >
      {event.title}
    </div>
  );
}

// ============================================================================
// Calendar Header
// ============================================================================

interface CalendarHeaderProps {
  date: Date;
  viewMode: CalendarViewMode;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onViewModeChange?: (mode: CalendarViewMode) => void;
  showViewModeSelector?: boolean;
}

function CalendarHeader({
  date,
  viewMode,
  onPrev,
  onNext,
  onToday,
  onViewModeChange,
  showViewModeSelector = true,
}: CalendarHeaderProps) {
  const getTitle = () => {
    switch (viewMode) {
      case 'month':
        return format(date, 'MMMM yyyy');
      case 'week': {
        const weekStart = startOfWeek(date, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
        if (weekStart.getMonth() === weekEnd.getMonth()) {
          return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'd, yyyy')}`;
        }
        return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
      }
      case 'day':
        return format(date, 'EEEE, MMMM d, yyyy');
      default:
        return format(date, 'MMMM yyyy');
    }
  };

  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <button
          onClick={onPrev}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Previous"
        >
          <ChevronLeft className="h-5 w-5 text-gray-600" />
        </button>
        <button
          onClick={onNext}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Next"
        >
          <ChevronRight className="h-5 w-5 text-gray-600" />
        </button>
        <h2 className="text-lg font-semibold text-gray-900 ml-2">{getTitle()}</h2>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onToday}
          className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          Today
        </button>
        {showViewModeSelector && onViewModeChange && (
          <div className="flex bg-gray-100 rounded-lg p-1">
            {(['month', 'week', 'day'] as CalendarViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => onViewModeChange(mode)}
                className={clsx(
                  'px-3 py-1 text-sm font-medium rounded-md transition-colors capitalize',
                  viewMode === mode
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                )}
              >
                {mode}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Month View
// ============================================================================

interface MonthViewProps {
  currentDate: Date;
  selectedDate: Date | null;
  events: CalendarEvent[];
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  fixedWeeks: boolean;
  showWeekNumbers: boolean;
  minDate?: Date;
  maxDate?: Date;
  disabledDates?: Date[];
  selectable: boolean;
  dayClassName?: string | ((date: Date) => string);
  onSelectDate?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
  renderDay?: (props: CalendarDayProps) => ReactNode;
  renderEvent?: (event: CalendarEvent, date: Date) => ReactNode;
}

function MonthView({
  currentDate,
  selectedDate,
  events,
  weekStartsOn,
  fixedWeeks,
  showWeekNumbers,
  minDate,
  maxDate,
  disabledDates,
  selectable,
  dayClassName,
  onSelectDate,
  onEventClick,
  renderDay,
  renderEvent,
}: MonthViewProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn });
  let calendarEnd = endOfWeek(monthEnd, { weekStartsOn });

  // Fixed 6 weeks for consistent height
  if (fixedWeeks) {
    const weeks = Math.ceil(
      (calendarEnd.getTime() - calendarStart.getTime()) / (7 * 24 * 60 * 60 * 1000)
    );
    if (weeks < 6) {
      calendarEnd = addDays(calendarEnd, (6 - weeks) * 7);
    }
  }

  // Generate all days
  const days: Date[] = [];
  let day = calendarStart;
  while (day <= calendarEnd) {
    days.push(day);
    day = addDays(day, 1);
  }

  // Week day headers
  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    weekDays.push(format(addDays(calendarStart, i), 'EEE'));
  }

  return (
    <div className="select-none">
      {/* Week day headers */}
      <div className={clsx('grid gap-px bg-gray-200', showWeekNumbers ? 'grid-cols-8' : 'grid-cols-7')}>
        {showWeekNumbers && <div className="bg-gray-50 p-2" />}
        {weekDays.map((dayName) => (
          <div
            key={dayName}
            className="bg-gray-50 px-2 py-3 text-center text-xs font-semibold text-gray-500 uppercase"
          >
            {dayName}
          </div>
        ))}
      </div>

      {/* Calendar days */}
      <div className={clsx('grid gap-px bg-gray-200', showWeekNumbers ? 'grid-cols-8' : 'grid-cols-7')}>
        {days.map((date, index) => {
          const isCurrentMonth = isSameMonth(date, currentDate);
          const isTodayDate = isToday(date);
          const isSelected = selectedDate ? isSameDay(date, selectedDate) : false;
          const isPast = isBefore(date, new Date()) && !isTodayDate;
          const isDisabled = isDateDisabled(date, minDate, maxDate, disabledDates);
          const dayEvents = getEventsForDate(events, date);

          // Week number for first day of each week
          const showWeekNumber = showWeekNumbers && index % 7 === 0;
          const weekNumber = showWeekNumber ? format(date, 'w') : null;

          const dayClassNameValue =
            typeof dayClassName === 'function' ? dayClassName(date) : dayClassName;

          // Custom render
          if (renderDay) {
            return (
              <div key={date.toISOString()}>
                {showWeekNumbers && index % 7 === 0 && (
                  <div className="bg-gray-50 p-2 text-xs text-gray-400 text-center">
                    W{weekNumber}
                  </div>
                )}
                {renderDay({
                  date,
                  isCurrentMonth,
                  isToday: isTodayDate,
                  isSelected,
                  isPast,
                  events: dayEvents,
                })}
              </div>
            );
          }

          return (
            <>
              {showWeekNumbers && index % 7 === 0 && (
                <div
                  key={`week-${weekNumber}`}
                  className="bg-gray-50 p-2 text-xs text-gray-400 text-center flex items-start justify-center"
                >
                  W{weekNumber}
                </div>
              )}
              <div
                key={date.toISOString()}
                onClick={() => !isDisabled && selectable && onSelectDate?.(date)}
                className={clsx(
                  'bg-white min-h-[100px] p-2 transition-colors',
                  !isCurrentMonth && 'bg-gray-50',
                  isDisabled && 'opacity-50 cursor-not-allowed',
                  selectable && !isDisabled && 'cursor-pointer hover:bg-gray-50',
                  isSelected && 'ring-2 ring-inset ring-primary-500',
                  dayClassNameValue
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={clsx(
                      'text-sm font-medium',
                      !isCurrentMonth && 'text-gray-400',
                      isCurrentMonth && !isTodayDate && 'text-gray-900',
                      isTodayDate &&
                        'bg-primary-500 text-white w-7 h-7 rounded-full flex items-center justify-center'
                    )}
                  >
                    {format(date, 'd')}
                  </span>
                </div>
                {/* Events */}
                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map((event) => (
                    <div
                      key={event.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick?.(event);
                      }}
                      className="cursor-pointer"
                    >
                      {renderEvent ? (
                        renderEvent(event, date)
                      ) : (
                        <DefaultEvent event={event} />
                      )}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-xs text-gray-500 font-medium">
                      +{dayEvents.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            </>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Week View
// ============================================================================

interface WeekViewProps {
  currentDate: Date;
  selectedDate: Date | null;
  events: CalendarEvent[];
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  minDate?: Date;
  maxDate?: Date;
  disabledDates?: Date[];
  selectable: boolean;
  dayClassName?: string | ((date: Date) => string);
  onSelectDate?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
  renderDay?: (props: CalendarDayProps) => ReactNode;
  renderEvent?: (event: CalendarEvent, date: Date) => ReactNode;
}

function WeekView({
  currentDate,
  selectedDate,
  events,
  weekStartsOn,
  minDate,
  maxDate,
  disabledDates,
  selectable,
  dayClassName,
  onSelectDate,
  onEventClick,
  renderDay,
  renderEvent,
}: WeekViewProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn });
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    days.push(addDays(weekStart, i));
  }

  return (
    <div className="grid grid-cols-7 gap-px bg-gray-200">
      {days.map((date) => {
        const isTodayDate = isToday(date);
        const isSelected = selectedDate ? isSameDay(date, selectedDate) : false;
        const isPast = isBefore(date, new Date()) && !isTodayDate;
        const isDisabled = isDateDisabled(date, minDate, maxDate, disabledDates);
        const dayEvents = getEventsForDate(events, date);

        const dayClassNameValue =
          typeof dayClassName === 'function' ? dayClassName(date) : dayClassName;

        if (renderDay) {
          return (
            <div key={date.toISOString()}>
              {renderDay({
                date,
                isCurrentMonth: true,
                isToday: isTodayDate,
                isSelected,
                isPast,
                events: dayEvents,
              })}
            </div>
          );
        }

        return (
          <div
            key={date.toISOString()}
            onClick={() => !isDisabled && selectable && onSelectDate?.(date)}
            className={clsx(
              'bg-white min-h-[200px] p-3 transition-colors',
              isDisabled && 'opacity-50 cursor-not-allowed',
              selectable && !isDisabled && 'cursor-pointer hover:bg-gray-50',
              isSelected && 'ring-2 ring-inset ring-primary-500',
              dayClassNameValue
            )}
          >
            {/* Date header */}
            <div className="text-center mb-3">
              <div className="text-xs text-gray-500 uppercase mb-1">
                {format(date, 'EEE')}
              </div>
              <div
                className={clsx(
                  'text-lg font-semibold mx-auto',
                  isTodayDate
                    ? 'bg-primary-500 text-white w-9 h-9 rounded-full flex items-center justify-center'
                    : 'text-gray-900'
                )}
              >
                {format(date, 'd')}
              </div>
            </div>
            {/* Events */}
            <div className="space-y-1.5">
              {dayEvents.map((event) => (
                <div
                  key={event.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEventClick?.(event);
                  }}
                  className="cursor-pointer"
                >
                  {renderEvent ? renderEvent(event, date) : <DefaultEvent event={event} />}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Day View
// ============================================================================

interface DayViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  renderEvent?: (event: CalendarEvent, date: Date) => ReactNode;
}

function DayView({ currentDate, events, onEventClick, renderEvent }: DayViewProps) {
  const dayEvents = getEventsForDate(events, currentDate);
  const isTodayDate = isToday(currentDate);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="text-center mb-6">
        <div className="text-sm text-gray-500 uppercase mb-1">
          {format(currentDate, 'EEEE')}
        </div>
        <div
          className={clsx(
            'text-4xl font-bold mx-auto inline-flex items-center justify-center',
            isTodayDate
              ? 'bg-primary-500 text-white w-16 h-16 rounded-full'
              : 'text-gray-900'
          )}
        >
          {format(currentDate, 'd')}
        </div>
        <div className="text-sm text-gray-500 mt-1">
          {format(currentDate, 'MMMM yyyy')}
        </div>
      </div>

      {dayEvents.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Calendar className="h-12 w-12 mx-auto text-gray-300 mb-3" />
          <p>No events scheduled</p>
        </div>
      ) : (
        <div className="space-y-3">
          {dayEvents.map((event) => (
            <div
              key={event.id}
              onClick={() => onEventClick?.(event)}
              className="cursor-pointer"
            >
              {renderEvent ? (
                renderEvent(event, currentDate)
              ) : (
                <div
                  className={clsx(
                    'p-3 rounded-lg text-white',
                    event.color || 'bg-primary-500',
                    event.className
                  )}
                >
                  <div className="font-medium">{event.title}</div>
                  {event.start && (
                    <div className="text-sm opacity-90 mt-1">
                      {format(
                        typeof event.start === 'string' ? parseISO(event.start) : event.start,
                        'h:mm a'
                      )}
                      {event.end && (
                        <>
                          {' - '}
                          {format(
                            typeof event.end === 'string' ? parseISO(event.end) : event.end,
                            'h:mm a'
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main CalendarView Component
// ============================================================================

export function CalendarView({
  viewMode: controlledViewMode,
  currentDate: controlledDate,
  onDateChange,
  onViewModeChange,
  selectedDate = null,
  onSelectDate,
  selectable = true,
  events = [],
  onEventClick,
  renderDay,
  renderEvent,
  renderHeader,
  className,
  dayClassName,
  minDate,
  maxDate,
  disabledDates,
  showHeader = true,
  showWeekNumbers = false,
  weekStartsOn = 1,
  fixedWeeks = true,
}: CalendarViewProps) {
  // Internal state for uncontrolled mode
  const [internalDate, setInternalDate] = useState(new Date());
  const [internalViewMode, setInternalViewMode] = useState<CalendarViewMode>('month');

  // Use controlled or internal values
  const currentDate = controlledDate ?? internalDate;
  const viewMode = controlledViewMode ?? internalViewMode;

  const handleDateChange = useCallback(
    (date: Date) => {
      if (onDateChange) {
        onDateChange(date);
      } else {
        setInternalDate(date);
      }
    },
    [onDateChange]
  );

  const handleViewModeChange = useCallback(
    (mode: CalendarViewMode) => {
      if (onViewModeChange) {
        onViewModeChange(mode);
      } else {
        setInternalViewMode(mode);
      }
    },
    [onViewModeChange]
  );

  // Navigation handlers
  const goToPrev = useCallback(() => {
    switch (viewMode) {
      case 'month':
        handleDateChange(subMonths(currentDate, 1));
        break;
      case 'week':
        handleDateChange(subWeeks(currentDate, 1));
        break;
      case 'day':
        handleDateChange(addDays(currentDate, -1));
        break;
    }
  }, [currentDate, viewMode, handleDateChange]);

  const goToNext = useCallback(() => {
    switch (viewMode) {
      case 'month':
        handleDateChange(addMonths(currentDate, 1));
        break;
      case 'week':
        handleDateChange(addWeeks(currentDate, 1));
        break;
      case 'day':
        handleDateChange(addDays(currentDate, 1));
        break;
    }
  }, [currentDate, viewMode, handleDateChange]);

  const goToToday = useCallback(() => {
    handleDateChange(new Date());
  }, [handleDateChange]);

  return (
    <div className={className}>
      {/* Header */}
      {showHeader && (
        renderHeader ? (
          renderHeader(currentDate, goToPrev, goToNext, goToToday)
        ) : (
          <CalendarHeader
            date={currentDate}
            viewMode={viewMode}
            onPrev={goToPrev}
            onNext={goToNext}
            onToday={goToToday}
            onViewModeChange={handleViewModeChange}
            showViewModeSelector={!!onViewModeChange || !controlledViewMode}
          />
        )
      )}

      {/* Calendar View */}
      {viewMode === 'month' && (
        <MonthView
          currentDate={currentDate}
          selectedDate={selectedDate}
          events={events}
          weekStartsOn={weekStartsOn}
          fixedWeeks={fixedWeeks}
          showWeekNumbers={showWeekNumbers}
          minDate={minDate}
          maxDate={maxDate}
          disabledDates={disabledDates}
          selectable={selectable}
          dayClassName={dayClassName}
          onSelectDate={onSelectDate}
          onEventClick={onEventClick}
          renderDay={renderDay}
          renderEvent={renderEvent}
        />
      )}
      {viewMode === 'week' && (
        <WeekView
          currentDate={currentDate}
          selectedDate={selectedDate}
          events={events}
          weekStartsOn={weekStartsOn}
          minDate={minDate}
          maxDate={maxDate}
          disabledDates={disabledDates}
          selectable={selectable}
          dayClassName={dayClassName}
          onSelectDate={onSelectDate}
          onEventClick={onEventClick}
          renderDay={renderDay}
          renderEvent={renderEvent}
        />
      )}
      {viewMode === 'day' && (
        <DayView
          currentDate={currentDate}
          events={events}
          onEventClick={onEventClick}
          renderEvent={renderEvent}
        />
      )}
    </div>
  );
}

// ============================================================================
// Mini Calendar (Date Picker Style)
// ============================================================================

export interface MiniCalendarProps {
  value?: Date | null;
  onChange?: (date: Date) => void;
  minDate?: Date;
  maxDate?: Date;
  disabledDates?: Date[];
  className?: string;
}

export function MiniCalendar({
  value,
  onChange,
  minDate,
  maxDate,
  disabledDates,
  className,
}: MiniCalendarProps) {
  const [viewDate, setViewDate] = useState(value || new Date());

  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(viewDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days: Date[] = [];
  let day = calendarStart;
  while (day <= calendarEnd) {
    days.push(day);
    day = addDays(day, 1);
  }

  const weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  return (
    <div className={clsx('bg-white rounded-lg border border-gray-200 p-3 w-64', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setViewDate(subMonths(viewDate, 1))}
          className="p-1 hover:bg-gray-100 rounded"
        >
          <ChevronLeft className="h-4 w-4 text-gray-600" />
        </button>
        <span className="text-sm font-medium text-gray-900">
          {format(viewDate, 'MMMM yyyy')}
        </span>
        <button
          onClick={() => setViewDate(addMonths(viewDate, 1))}
          className="p-1 hover:bg-gray-100 rounded"
        >
          <ChevronRight className="h-4 w-4 text-gray-600" />
        </button>
      </div>

      {/* Week day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {weekDays.map((d, i) => (
          <div key={i} className="text-center text-xs text-gray-400 font-medium py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((date) => {
          const isCurrentMonth = isSameMonth(date, viewDate);
          const isTodayDate = isToday(date);
          const isSelected = value ? isSameDay(date, value) : false;
          const isDisabled = isDateDisabled(date, minDate, maxDate, disabledDates);

          return (
            <button
              key={date.toISOString()}
              onClick={() => !isDisabled && onChange?.(date)}
              disabled={isDisabled}
              className={clsx(
                'w-8 h-8 text-sm rounded-full flex items-center justify-center transition-colors',
                !isCurrentMonth && 'text-gray-300',
                isCurrentMonth && !isSelected && !isTodayDate && 'text-gray-700 hover:bg-gray-100',
                isTodayDate && !isSelected && 'text-primary-600 font-semibold',
                isSelected && 'bg-primary-500 text-white',
                isDisabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              {format(date, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default CalendarView;
