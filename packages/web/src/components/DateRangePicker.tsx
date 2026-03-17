import React, { useState, useRef, useEffect, useMemo } from 'react';
import clsx from 'clsx';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
} from 'lucide-react';
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  subDays,
  subWeeks,
  subMonths,
  subQuarters,
  subYears,
  addMonths,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  isBefore,
  isAfter,
  eachDayOfInterval,
  getDay,
} from 'date-fns';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface DateRange {
  start: Date | null;
  end: Date | null;
}

export interface DateRangePreset {
  label: string;
  getValue: () => DateRange;
}

export interface DateRangePickerProps {
  /** Currently selected date range */
  value: DateRange;
  /** Callback when date range changes */
  onChange: (range: DateRange) => void;
  /** Minimum selectable date */
  minDate?: Date;
  /** Maximum selectable date */
  maxDate?: Date;
  /** Custom className */
  className?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Whether to show preset options */
  showPresets?: boolean;
  /** Custom presets */
  presets?: DateRangePreset[];
  /** Whether to show time selection */
  showTime?: boolean;
  /** Date format for display */
  dateFormat?: string;
  /** Label for the picker */
  label?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Whether the input is required */
  required?: boolean;
  /** Error message */
  error?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to allow single date selection (start = end) */
  allowSingleDate?: boolean;
}

// ============================================================================
// Default Presets
// ============================================================================

const defaultPresets: DateRangePreset[] = [
  {
    label: 'Today',
    getValue: () => {
      const today = new Date();
      return { start: today, end: today };
    },
  },
  {
    label: 'Yesterday',
    getValue: () => {
      const yesterday = subDays(new Date(), 1);
      return { start: yesterday, end: yesterday };
    },
  },
  {
    label: 'Last 7 Days',
    getValue: () => ({
      start: subDays(new Date(), 6),
      end: new Date(),
    }),
  },
  {
    label: 'Last 30 Days',
    getValue: () => ({
      start: subDays(new Date(), 29),
      end: new Date(),
    }),
  },
  {
    label: 'This Week',
    getValue: () => ({
      start: startOfWeek(new Date(), { weekStartsOn: 0 }),
      end: endOfWeek(new Date(), { weekStartsOn: 0 }),
    }),
  },
  {
    label: 'Last Week',
    getValue: () => {
      const lastWeek = subWeeks(new Date(), 1);
      return {
        start: startOfWeek(lastWeek, { weekStartsOn: 0 }),
        end: endOfWeek(lastWeek, { weekStartsOn: 0 }),
      };
    },
  },
  {
    label: 'This Month',
    getValue: () => ({
      start: startOfMonth(new Date()),
      end: endOfMonth(new Date()),
    }),
  },
  {
    label: 'Last Month',
    getValue: () => {
      const lastMonth = subMonths(new Date(), 1);
      return {
        start: startOfMonth(lastMonth),
        end: endOfMonth(lastMonth),
      };
    },
  },
  {
    label: 'This Quarter',
    getValue: () => ({
      start: startOfQuarter(new Date()),
      end: endOfQuarter(new Date()),
    }),
  },
  {
    label: 'Last Quarter',
    getValue: () => {
      const lastQuarter = subQuarters(new Date(), 1);
      return {
        start: startOfQuarter(lastQuarter),
        end: endOfQuarter(lastQuarter),
      };
    },
  },
  {
    label: 'This Year',
    getValue: () => ({
      start: startOfYear(new Date()),
      end: endOfYear(new Date()),
    }),
  },
  {
    label: 'Last Year',
    getValue: () => {
      const lastYear = subYears(new Date(), 1);
      return {
        start: startOfYear(lastYear),
        end: endOfYear(lastYear),
      };
    },
  },
];

// ============================================================================
// Calendar Month Component
// ============================================================================

interface CalendarMonthProps {
  month: Date;
  selectedRange: DateRange;
  hoverDate: Date | null;
  onDateClick: (date: Date) => void;
  onDateHover: (date: Date | null) => void;
  minDate?: Date;
  maxDate?: Date;
  isSelectingEnd: boolean;
}

function CalendarMonth({
  month,
  selectedRange,
  hoverDate,
  onDateClick,
  onDateHover,
  minDate,
  maxDate,
  isSelectingEnd,
}: CalendarMonthProps) {
  const days = useMemo(() => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [month]);

  const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const isInRange = (date: Date) => {
    const start = selectedRange.start;
    const end = selectedRange.end || (isSelectingEnd ? hoverDate : null);
    
    if (!start || !end) return false;
    
    const rangeStart = isBefore(start, end) ? start : end;
    const rangeEnd = isBefore(start, end) ? end : start;
    
    return isWithinInterval(date, { start: rangeStart, end: rangeEnd });
  };

  const isRangeStart = (date: Date) => {
    return selectedRange.start && isSameDay(date, selectedRange.start);
  };

  const isRangeEnd = (date: Date) => {
    return selectedRange.end && isSameDay(date, selectedRange.end);
  };

  const isDisabled = (date: Date) => {
    if (minDate && isBefore(date, minDate)) return true;
    if (maxDate && isAfter(date, maxDate)) return true;
    return false;
  };

  return (
    <div className="p-3">
      {/* Month header */}
      <div className="text-center text-sm font-semibold text-gray-900 mb-3">
        {format(month, 'MMMM yyyy')}
      </div>

      {/* Week day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {weekDays.map((day) => (
          <div
            key={day}
            className="h-8 flex items-center justify-center text-xs font-medium text-gray-500"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((date, index) => {
          const isCurrentMonth = isSameMonth(date, month);
          const isToday = isSameDay(date, new Date());
          const inRange = isInRange(date);
          const isStart = isRangeStart(date);
          const isEnd = isRangeEnd(date);
          const disabled = isDisabled(date);

          return (
            <button
              key={index}
              onClick={() => !disabled && onDateClick(date)}
              onMouseEnter={() => onDateHover(date)}
              onMouseLeave={() => onDateHover(null)}
              disabled={disabled}
              className={clsx(
                'h-8 w-8 flex items-center justify-center text-sm rounded-full transition-colors',
                !isCurrentMonth && 'text-gray-300',
                isCurrentMonth && !inRange && !isStart && !isEnd && 'text-gray-700 hover:bg-gray-100',
                isToday && !inRange && !isStart && !isEnd && 'ring-1 ring-blue-500',
                inRange && !isStart && !isEnd && 'bg-blue-50 text-blue-700',
                (isStart || isEnd) && 'bg-blue-600 text-white hover:bg-blue-700',
                disabled && 'opacity-40 cursor-not-allowed hover:bg-transparent',
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

// ============================================================================
// DateRangePicker Component
// ============================================================================

export function DateRangePicker({
  value,
  onChange,
  minDate,
  maxDate,
  className,
  placeholder = 'Select date range',
  showPresets = true,
  presets = defaultPresets,
  dateFormat = 'MMM d, yyyy',
  label,
  disabled = false,
  required = false,
  error,
  size = 'md',
  allowSingleDate = true,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(value.start || new Date());
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  const [isSelectingEnd, setIsSelectingEnd] = useState(false);
  const [tempRange, setTempRange] = useState<DateRange>(value);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setTempRange(value);
        setIsSelectingEnd(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, value]);

  // Reset temp range when value changes externally
  useEffect(() => {
    setTempRange(value);
  }, [value]);

  const handleDateClick = (date: Date) => {
    if (!isSelectingEnd) {
      // Start selection
      setTempRange({ start: date, end: null });
      setIsSelectingEnd(true);
    } else {
      // End selection
      const start = tempRange.start!;
      const newRange = isBefore(date, start)
        ? { start: date, end: start }
        : { start, end: date };
      
      onChange(newRange);
      setTempRange(newRange);
      setIsSelectingEnd(false);
      setIsOpen(false);
    }
  };

  const handlePresetClick = (preset: DateRangePreset) => {
    const range = preset.getValue();
    onChange(range);
    setTempRange(range);
    setIsOpen(false);
    setIsSelectingEnd(false);
  };

  const handleClear = () => {
    onChange({ start: null, end: null });
    setTempRange({ start: null, end: null });
    setIsSelectingEnd(false);
  };

  const displayValue = useMemo(() => {
    if (!value.start) return '';
    if (!value.end || isSameDay(value.start, value.end)) {
      return format(value.start, dateFormat);
    }
    return `${format(value.start, dateFormat)} – ${format(value.end, dateFormat)}`;
  }, [value, dateFormat]);

  const sizeClasses = {
    sm: 'px-2.5 py-1.5 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-2.5 text-base',
  };

  return (
    <div className={clsx('relative', className)} ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {/* Trigger Button */}
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={clsx(
          'w-full flex items-center gap-2 border rounded-lg text-left transition-colors',
          sizeClasses[size],
          isOpen
            ? 'border-blue-500 ring-2 ring-blue-500/20'
            : 'border-gray-300 hover:border-gray-400',
          error && 'border-red-500',
          disabled && 'bg-gray-50 cursor-not-allowed opacity-60',
        )}
      >
        <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
        <span className={clsx('flex-1 truncate', !displayValue && 'text-gray-400')}>
          {displayValue || placeholder}
        </span>
        {displayValue && !disabled && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            className="p-0.5 text-gray-400 hover:text-gray-600 rounded"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <ChevronDown className={clsx(
          'h-4 w-4 text-gray-400 transition-transform flex-shrink-0',
          isOpen && 'rotate-180',
        )} />
      </button>

      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1 bg-white rounded-lg shadow-xl border border-gray-200 z-50 flex">
          {/* Presets */}
          {showPresets && (
            <div className="border-r border-gray-200 py-2 w-36">
              <div className="px-3 py-1.5 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Presets
              </div>
              {presets.map((preset, index) => (
                <button
                  key={index}
                  onClick={() => handlePresetClick(preset)}
                  className="w-full px-3 py-1.5 text-sm text-left text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          )}

          {/* Calendars */}
          <div className="flex">
            {/* Navigation */}
            <div className="flex flex-col">
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
                <button
                  onClick={() => setViewMonth(addMonths(viewMonth, -1))}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <ChevronLeft className="h-4 w-4 text-gray-600" />
                </button>
                <button
                  onClick={() => setViewMonth(addMonths(viewMonth, 1))}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <ChevronRight className="h-4 w-4 text-gray-600" />
                </button>
              </div>

              <div className="flex">
                <CalendarMonth
                  month={viewMonth}
                  selectedRange={tempRange}
                  hoverDate={hoverDate}
                  onDateClick={handleDateClick}
                  onDateHover={setHoverDate}
                  minDate={minDate}
                  maxDate={maxDate}
                  isSelectingEnd={isSelectingEnd}
                />
                <CalendarMonth
                  month={addMonths(viewMonth, 1)}
                  selectedRange={tempRange}
                  hoverDate={hoverDate}
                  onDateClick={handleDateClick}
                  onDateHover={setHoverDate}
                  minDate={minDate}
                  maxDate={maxDate}
                  isSelectingEnd={isSelectingEnd}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SimpleDatePicker - Single date picker (not range)
// ============================================================================

export interface SimpleDatePickerProps {
  value: Date | null;
  onChange: (date: Date | null) => void;
  minDate?: Date;
  maxDate?: Date;
  className?: string;
  placeholder?: string;
  dateFormat?: string;
  label?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function SimpleDatePicker({
  value,
  onChange,
  minDate,
  maxDate,
  className,
  placeholder = 'Select date',
  dateFormat = 'MMM d, yyyy',
  label,
  disabled = false,
  required = false,
  error,
  size = 'md',
}: SimpleDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(value || new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleDateClick = (date: Date) => {
    onChange(date);
    setIsOpen(false);
  };

  const sizeClasses = {
    sm: 'px-2.5 py-1.5 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-2.5 text-base',
  };

  return (
    <div className={clsx('relative', className)} ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={clsx(
          'w-full flex items-center gap-2 border rounded-lg text-left transition-colors',
          sizeClasses[size],
          isOpen
            ? 'border-blue-500 ring-2 ring-blue-500/20'
            : 'border-gray-300 hover:border-gray-400',
          error && 'border-red-500',
          disabled && 'bg-gray-50 cursor-not-allowed opacity-60',
        )}
      >
        <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
        <span className={clsx('flex-1 truncate', !value && 'text-gray-400')}>
          {value ? format(value, dateFormat) : placeholder}
        </span>
        {value && !disabled && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            className="p-0.5 text-gray-400 hover:text-gray-600 rounded"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <ChevronDown className={clsx(
          'h-4 w-4 text-gray-400 transition-transform flex-shrink-0',
          isOpen && 'rotate-180',
        )} />
      </button>

      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
            <button
              onClick={() => setViewMonth(addMonths(viewMonth, -1))}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <ChevronLeft className="h-4 w-4 text-gray-600" />
            </button>
            <span className="text-sm font-medium text-gray-900">
              {format(viewMonth, 'MMMM yyyy')}
            </span>
            <button
              onClick={() => setViewMonth(addMonths(viewMonth, 1))}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <ChevronRight className="h-4 w-4 text-gray-600" />
            </button>
          </div>
          <CalendarMonth
            month={viewMonth}
            selectedRange={{ start: value, end: value }}
            hoverDate={null}
            onDateClick={handleDateClick}
            onDateHover={() => {}}
            minDate={minDate}
            maxDate={maxDate}
            isSelectingEnd={false}
          />
        </div>
      )}
    </div>
  );
}
