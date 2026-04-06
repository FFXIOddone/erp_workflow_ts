import React, { useState, useEffect, useMemo } from 'react';
import clsx from 'clsx';
import { Clock, Globe, ChevronDown } from 'lucide-react';
import { matchesSearchFields } from '@erp/shared';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface LiveClockProps {
  /** Timezone (IANA format, e.g., "America/New_York") */
  timezone?: string;
  /** Display format */
  format?: '12h' | '24h';
  /** Show seconds */
  showSeconds?: boolean;
  /** Show date */
  showDate?: boolean;
  /** Show timezone label */
  showTimezone?: boolean;
  /** Custom className */
  className?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Update interval in ms (default: 1000) */
  interval?: number;
}

export interface MultiClockProps {
  /** Array of timezones to display */
  timezones: { zone: string; label: string }[];
  /** Display format */
  format?: '12h' | '24h';
  /** Custom className */
  className?: string;
  /** Layout direction */
  direction?: 'horizontal' | 'vertical';
}

export interface TimezoneSelectorProps {
  /** Selected timezone */
  value: string;
  /** Change handler */
  onChange: (timezone: string) => void;
  /** Custom className */
  className?: string;
  /** Disabled state */
  disabled?: boolean;
}

// ============================================================================
// Timezone Data
// ============================================================================

const commonTimezones = [
  { zone: 'America/New_York', label: 'Eastern Time (ET)', abbr: 'ET' },
  { zone: 'America/Chicago', label: 'Central Time (CT)', abbr: 'CT' },
  { zone: 'America/Denver', label: 'Mountain Time (MT)', abbr: 'MT' },
  { zone: 'America/Los_Angeles', label: 'Pacific Time (PT)', abbr: 'PT' },
  { zone: 'America/Phoenix', label: 'Arizona (MST)', abbr: 'MST' },
  { zone: 'America/Anchorage', label: 'Alaska (AKT)', abbr: 'AKT' },
  { zone: 'Pacific/Honolulu', label: 'Hawaii (HST)', abbr: 'HST' },
  { zone: 'UTC', label: 'Coordinated Universal Time', abbr: 'UTC' },
  { zone: 'Europe/London', label: 'London (GMT/BST)', abbr: 'GMT' },
  { zone: 'Europe/Paris', label: 'Paris (CET)', abbr: 'CET' },
  { zone: 'Europe/Berlin', label: 'Berlin (CET)', abbr: 'CET' },
  { zone: 'Asia/Tokyo', label: 'Tokyo (JST)', abbr: 'JST' },
  { zone: 'Asia/Shanghai', label: 'Shanghai (CST)', abbr: 'CST' },
  { zone: 'Asia/Dubai', label: 'Dubai (GST)', abbr: 'GST' },
  { zone: 'Asia/Kolkata', label: 'India (IST)', abbr: 'IST' },
  { zone: 'Australia/Sydney', label: 'Sydney (AEST)', abbr: 'AEST' },
];

function getTimezoneAbbr(zone: string): string {
  const found = commonTimezones.find((tz) => tz.zone === zone);
  if (found) return found.abbr;

  // Try to extract from formatted string
  try {
    const date = new Date();
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      timeZoneName: 'short',
    }).formatToParts(date);
    const tzPart = parts.find((p) => p.type === 'timeZoneName');
    return tzPart?.value || zone;
  } catch {
    return zone;
  }
}

// ============================================================================
// Time Formatting
// ============================================================================

function formatTime(
  date: Date,
  timezone: string,
  format: '12h' | '24h',
  showSeconds: boolean,
): string {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: format === '12h',
  };

  if (showSeconds) {
    options.second = '2-digit';
  }

  return new Intl.DateTimeFormat('en-US', options).format(date);
}

function formatDate(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

// ============================================================================
// LiveClock Component
// ============================================================================

export function LiveClock({
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone,
  format = '12h',
  showSeconds = false,
  showDate = false,
  showTimezone = false,
  className,
  size = 'md',
  interval = 1000,
}: LiveClockProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, interval);

    return () => clearInterval(timer);
  }, [interval]);

  const timeString = useMemo(
    () => formatTime(now, timezone, format, showSeconds),
    [now, timezone, format, showSeconds],
  );

  const dateString = useMemo(
    () => (showDate ? formatDate(now, timezone) : ''),
    [now, timezone, showDate],
  );

  const tzAbbr = useMemo(() => getTimezoneAbbr(timezone), [timezone]);

  const sizeClasses = {
    sm: { time: 'text-sm', date: 'text-xs', tz: 'text-xs' },
    md: { time: 'text-base', date: 'text-xs', tz: 'text-xs' },
    lg: { time: 'text-2xl font-light', date: 'text-sm', tz: 'text-sm' },
  };

  const styles = sizeClasses[size];

  return (
    <div className={clsx('flex items-center gap-2', className)}>
      <Clock className={clsx('text-gray-400', size === 'lg' ? 'h-5 w-5' : 'h-4 w-4')} />
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <span className={clsx('font-mono tabular-nums', styles.time)}>
            {timeString}
          </span>
          {showTimezone && (
            <span className={clsx('text-gray-500', styles.tz)}>
              {tzAbbr}
            </span>
          )}
        </div>
        {showDate && (
          <span className={clsx('text-gray-500', styles.date)}>
            {dateString}
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MultiClock Component (Multiple timezones)
// ============================================================================

export function MultiClock({
  timezones,
  format = '12h',
  className,
  direction = 'horizontal',
}: MultiClockProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div
      className={clsx(
        'flex gap-4',
        direction === 'vertical' ? 'flex-col' : 'flex-row flex-wrap',
        className,
      )}
    >
      {timezones.map(({ zone, label }) => (
        <div
          key={zone}
          className={clsx(
            'flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg',
            direction === 'horizontal' && 'min-w-[140px]',
          )}
        >
          <Globe className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <div>
            <p className="text-xs text-gray-500 font-medium">{label}</p>
            <p className="text-sm font-mono tabular-nums">
              {formatTime(now, zone, format, false)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// CompactClock Component (For header/navbar)
// ============================================================================

export interface CompactClockProps {
  timezone?: string;
  format?: '12h' | '24h';
  className?: string;
}

export function CompactClock({
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone,
  format = '12h',
  className,
}: CompactClockProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const timeString = formatTime(now, timezone, format, false);
  const tzAbbr = getTimezoneAbbr(timezone);

  return (
    <div className={clsx('flex items-center gap-1 text-sm text-gray-600', className)}>
      <span className="font-mono tabular-nums">{timeString}</span>
      <span className="text-gray-400 text-xs">{tzAbbr}</span>
    </div>
  );
}

// ============================================================================
// DigitalClock Component (Large display)
// ============================================================================

export interface DigitalClockProps {
  timezone?: string;
  format?: '12h' | '24h';
  showSeconds?: boolean;
  showDate?: boolean;
  className?: string;
}

export function DigitalClock({
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone,
  format = '12h',
  showSeconds = true,
  showDate = true,
  className,
}: DigitalClockProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const timeString = formatTime(now, timezone, format, showSeconds);
  const dateString = formatDate(now, timezone);
  const tzAbbr = getTimezoneAbbr(timezone);

  return (
    <div className={clsx('text-center', className)}>
      <p className="text-4xl font-light font-mono tabular-nums tracking-tight">
        {timeString}
      </p>
      {showDate && (
        <p className="text-sm text-gray-500 mt-1">
          {dateString}
          <span className="mx-2">•</span>
          {tzAbbr}
        </p>
      )}
    </div>
  );
}

// ============================================================================
// TimezoneSelector Component
// ============================================================================

export function TimezoneSelector({
  value,
  onChange,
  className,
  disabled = false,
}: TimezoneSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredTimezones = useMemo(() => {
    if (!search.trim()) return commonTimezones;
    return commonTimezones.filter((tz) => matchesSearchFields([tz.label, tz.zone, tz.abbr], search));
  }, [search]);

  const selectedTz = commonTimezones.find((tz) => tz.zone === value);

  return (
    <div className={clsx('relative', className)}>
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={clsx(
          'flex items-center justify-between gap-2 w-full px-3 py-2 text-left',
          'border border-gray-300 rounded-lg bg-white',
          'hover:border-gray-400 transition-colors',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      >
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-gray-400" />
          <span className="text-sm">
            {selectedTz?.label || value}
          </span>
        </div>
        <ChevronDown
          className={clsx(
            'h-4 w-4 text-gray-400 transition-transform',
            isOpen && 'rotate-180',
          )}
        />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
            {/* Search */}
            <div className="p-2 border-b border-gray-200">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search timezones..."
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Options */}
            <ul className="max-h-60 overflow-y-auto py-1">
              {filteredTimezones.map((tz) => (
                <li key={tz.zone}>
                  <button
                    onClick={() => {
                      onChange(tz.zone);
                      setIsOpen(false);
                      setSearch('');
                    }}
                    className={clsx(
                      'w-full px-3 py-2 text-left text-sm hover:bg-gray-100',
                      value === tz.zone && 'bg-blue-50 text-blue-700',
                    )}
                  >
                    <span className="font-medium">{tz.label}</span>
                    <span className="text-gray-400 ml-2">({tz.abbr})</span>
                  </button>
                </li>
              ))}
              {filteredTimezones.length === 0 && (
                <li className="px-3 py-2 text-sm text-gray-500 text-center">
                  No timezones found
                </li>
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// Relative Time Display
// ============================================================================

export interface RelativeTimeProps {
  /** Date to display relative to now */
  date: Date | string | number;
  /** Update interval in ms */
  interval?: number;
  /** Custom className */
  className?: string;
}

export function RelativeTime({
  date,
  interval = 60000,
  className,
}: RelativeTimeProps) {
  const targetDate = useMemo(() => new Date(date), [date]);
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, interval);

    return () => clearInterval(timer);
  }, [interval]);

  const relativeString = useMemo(() => {
    const now = new Date();
    const diffMs = now.getTime() - targetDate.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;

    return targetDate.toLocaleDateString();
  }, [targetDate]);

  return (
    <span className={className} title={targetDate.toLocaleString()}>
      {relativeString}
    </span>
  );
}

// ============================================================================
// Countdown Timer
// ============================================================================

export interface CountdownProps {
  /** Target date to countdown to */
  targetDate: Date | string | number;
  /** Handler when countdown reaches zero */
  onComplete?: () => void;
  /** Custom className */
  className?: string;
  /** Show days */
  showDays?: boolean;
}

export function Countdown({
  targetDate,
  onComplete,
  className,
  showDays = true,
}: CountdownProps) {
  const target = useMemo(() => new Date(targetDate), [targetDate]);
  const [timeLeft, setTimeLeft] = useState(() => calculateTimeLeft(target));

  function calculateTimeLeft(targetDate: Date) {
    const diff = targetDate.getTime() - new Date().getTime();
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };

    return {
      days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((diff / (1000 * 60)) % 60),
      seconds: Math.floor((diff / 1000) % 60),
    };
  }

  useEffect(() => {
    const timer = setInterval(() => {
      const newTimeLeft = calculateTimeLeft(target);
      setTimeLeft(newTimeLeft);

      if (
        newTimeLeft.days === 0 &&
        newTimeLeft.hours === 0 &&
        newTimeLeft.minutes === 0 &&
        newTimeLeft.seconds === 0
      ) {
        clearInterval(timer);
        onComplete?.();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [target, onComplete]);

  const pad = (n: number) => n.toString().padStart(2, '0');

  return (
    <div className={clsx('flex items-center gap-2 font-mono tabular-nums', className)}>
      {showDays && timeLeft.days > 0 && (
        <>
          <span className="text-lg">{timeLeft.days}d</span>
          <span className="text-gray-400">:</span>
        </>
      )}
      <span className="text-lg">{pad(timeLeft.hours)}</span>
      <span className="text-gray-400">:</span>
      <span className="text-lg">{pad(timeLeft.minutes)}</span>
      <span className="text-gray-400">:</span>
      <span className="text-lg">{pad(timeLeft.seconds)}</span>
    </div>
  );
}
