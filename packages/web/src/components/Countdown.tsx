/**
 * Countdown.tsx
 * CRITICAL-49: Countdown timer and duration display components
 *
 * Countdown timers, time displays, deadline trackers, and duration formatters.
 * Useful for sales, deadlines, auctions, and time-sensitive features.
 *
 * @module Countdown
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  forwardRef,
  type ReactNode,
  type HTMLAttributes,
} from 'react';
import clsx from 'clsx';
import {
  Clock,
  Timer,
  TimerOff,
  Play,
  Pause,
  RotateCcw,
  Bell,
  AlertTriangle,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface TimeComponents {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  milliseconds: number;
  totalSeconds: number;
  totalMilliseconds: number;
  isExpired: boolean;
}

export type CountdownSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type CountdownVariant = 'default' | 'flip' | 'circular' | 'minimal' | 'banner';

export interface CountdownCallbacks {
  onComplete?: () => void;
  onTick?: (time: TimeComponents) => void;
  onStart?: () => void;
  onPause?: () => void;
  onReset?: () => void;
  onWarning?: (time: TimeComponents) => void;
}

// ============================================================================
// Context
// ============================================================================

interface CountdownContextValue {
  time: TimeComponents;
  isRunning: boolean;
  start: () => void;
  pause: () => void;
  reset: () => void;
  restart: () => void;
}

const CountdownContext = createContext<CountdownContextValue | null>(null);

export function useCountdownContext(): CountdownContextValue {
  const context = useContext(CountdownContext);
  if (!context) {
    throw new Error('Countdown components must be used within CountdownProvider');
  }
  return context;
}

// ============================================================================
// Utilities
// ============================================================================

export function calculateTimeComponents(ms: number): TimeComponents {
  const isExpired = ms <= 0;
  const totalMilliseconds = Math.max(0, ms);
  const totalSeconds = Math.floor(totalMilliseconds / 1000);

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = totalMilliseconds % 1000;

  return {
    days,
    hours,
    minutes,
    seconds,
    milliseconds,
    totalSeconds,
    totalMilliseconds,
    isExpired,
  };
}

export function formatTime(time: TimeComponents, format: string = 'HH:mm:ss'): string {
  const pad = (n: number, len: number = 2) => String(n).padStart(len, '0');

  return format
    .replace('DD', pad(time.days))
    .replace('D', String(time.days))
    .replace('HH', pad(time.hours))
    .replace('H', String(time.hours))
    .replace('mm', pad(time.minutes))
    .replace('m', String(time.minutes))
    .replace('ss', pad(time.seconds))
    .replace('s', String(time.seconds))
    .replace('SSS', pad(time.milliseconds, 3))
    .replace('SS', pad(Math.floor(time.milliseconds / 10)));
}

export function formatDuration(seconds: number, options?: { compact?: boolean; units?: number }): string {
  const { compact = false, units = 2 } = options || {};

  const time = calculateTimeComponents(seconds * 1000);
  const parts: string[] = [];

  if (time.days > 0) {
    parts.push(compact ? `${time.days}d` : `${time.days} day${time.days !== 1 ? 's' : ''}`);
  }
  if (time.hours > 0 || parts.length > 0) {
    parts.push(compact ? `${time.hours}h` : `${time.hours} hour${time.hours !== 1 ? 's' : ''}`);
  }
  if (time.minutes > 0 || parts.length > 0) {
    parts.push(compact ? `${time.minutes}m` : `${time.minutes} minute${time.minutes !== 1 ? 's' : ''}`);
  }
  if (time.seconds > 0 || parts.length === 0) {
    parts.push(compact ? `${time.seconds}s` : `${time.seconds} second${time.seconds !== 1 ? 's' : ''}`);
  }

  return parts.slice(0, units).join(compact ? ' ' : ', ');
}

export function getTimeUntil(date: Date | string | number): number {
  const target = new Date(date).getTime();
  return target - Date.now();
}

export function parseTimeString(time: string): number {
  // Parse formats like "1h 30m", "2:30:00", "90m", "5400s", "1d 2h"
  let totalSeconds = 0;

  // Check for colon format (HH:MM:SS or MM:SS)
  if (time.includes(':')) {
    const parts = time.split(':').map(Number);
    if (parts.length === 3) {
      totalSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      totalSeconds = parts[0] * 60 + parts[1];
    }
    return totalSeconds * 1000;
  }

  // Check for unit format (1d 2h 30m 45s)
  const regex = /(\d+)\s*(d|h|m|s)/gi;
  let match;
  while ((match = regex.exec(time)) !== null) {
    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    switch (unit) {
      case 'd':
        totalSeconds += value * 86400;
        break;
      case 'h':
        totalSeconds += value * 3600;
        break;
      case 'm':
        totalSeconds += value * 60;
        break;
      case 's':
        totalSeconds += value;
        break;
    }
  }

  return totalSeconds * 1000;
}

// ============================================================================
// Size Maps
// ============================================================================

const SIZE_MAP: Record<CountdownSize, { digit: string; label: string; gap: string; container: string }> = {
  xs: { digit: 'text-lg', label: 'text-[10px]', gap: 'gap-1', container: 'gap-1' },
  sm: { digit: 'text-xl', label: 'text-xs', gap: 'gap-1', container: 'gap-2' },
  md: { digit: 'text-3xl', label: 'text-sm', gap: 'gap-1', container: 'gap-3' },
  lg: { digit: 'text-4xl', label: 'text-base', gap: 'gap-2', container: 'gap-4' },
  xl: { digit: 'text-6xl', label: 'text-lg', gap: 'gap-2', container: 'gap-6' },
};

// ============================================================================
// useCountdown Hook
// ============================================================================

export interface UseCountdownOptions extends CountdownCallbacks {
  duration?: number; // in milliseconds
  targetDate?: Date | string | number;
  autoStart?: boolean;
  interval?: number;
  warningThreshold?: number; // in milliseconds
}

export interface UseCountdownReturn extends CountdownContextValue {}

export function useCountdown(options: UseCountdownOptions = {}): UseCountdownReturn {
  const {
    duration = 0,
    targetDate,
    autoStart = true,
    interval = 1000,
    warningThreshold,
    onComplete,
    onTick,
    onStart,
    onPause,
    onReset,
    onWarning,
  } = options;

  const getInitialTime = useCallback(() => {
    if (targetDate) {
      return getTimeUntil(targetDate);
    }
    return duration;
  }, [targetDate, duration]);

  const [remainingTime, setRemainingTime] = useState(getInitialTime);
  const [isRunning, setIsRunning] = useState(autoStart);
  const intervalRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(Date.now());
  const warningTriggeredRef = useRef(false);

  const time = useMemo(() => calculateTimeComponents(remainingTime), [remainingTime]);

  // Clear interval
  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Start countdown
  const start = useCallback(() => {
    if (isRunning || remainingTime <= 0) return;
    setIsRunning(true);
    lastTickRef.current = Date.now();
    onStart?.();
  }, [isRunning, remainingTime, onStart]);

  // Pause countdown
  const pause = useCallback(() => {
    if (!isRunning) return;
    setIsRunning(false);
    clearTimer();
    onPause?.();
  }, [isRunning, clearTimer, onPause]);

  // Reset countdown
  const reset = useCallback(() => {
    clearTimer();
    setIsRunning(false);
    setRemainingTime(getInitialTime());
    warningTriggeredRef.current = false;
    onReset?.();
  }, [clearTimer, getInitialTime, onReset]);

  // Restart countdown
  const restart = useCallback(() => {
    reset();
    setIsRunning(true);
    lastTickRef.current = Date.now();
    onStart?.();
  }, [reset, onStart]);

  // Tick effect
  useEffect(() => {
    if (!isRunning) return;

    intervalRef.current = window.setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastTickRef.current;
      lastTickRef.current = now;

      setRemainingTime((prev) => {
        let next: number;

        if (targetDate) {
          next = getTimeUntil(targetDate);
        } else {
          next = Math.max(0, prev - elapsed);
        }

        const timeComponents = calculateTimeComponents(next);
        onTick?.(timeComponents);

        // Check warning threshold
        if (
          warningThreshold &&
          !warningTriggeredRef.current &&
          next <= warningThreshold &&
          next > 0
        ) {
          warningTriggeredRef.current = true;
          onWarning?.(timeComponents);
        }

        // Check completion
        if (next <= 0) {
          clearTimer();
          setIsRunning(false);
          onComplete?.();
        }

        return next;
      });
    }, interval);

    return clearTimer;
  }, [isRunning, interval, targetDate, warningThreshold, onTick, onWarning, onComplete, clearTimer]);

  return useMemo(
    () => ({
      time,
      isRunning,
      start,
      pause,
      reset,
      restart,
    }),
    [time, isRunning, start, pause, reset, restart]
  );
}

// ============================================================================
// Countdown Component
// ============================================================================

export interface CountdownProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onPause' | 'onReset'>,
    CountdownCallbacks {
  duration?: number;
  targetDate?: Date | string | number;
  autoStart?: boolean;
  size?: CountdownSize;
  variant?: CountdownVariant;
  showDays?: boolean;
  showHours?: boolean;
  showMinutes?: boolean;
  showSeconds?: boolean;
  showMilliseconds?: boolean;
  showLabels?: boolean;
  showControls?: boolean;
  separator?: ReactNode;
  expiredMessage?: ReactNode;
  warningThreshold?: number;
  warningClassName?: string;
}

export const Countdown = forwardRef<HTMLDivElement, CountdownProps>(
  (
    {
      duration,
      targetDate,
      autoStart = true,
      size = 'md',
      variant = 'default',
      showDays = true,
      showHours = true,
      showMinutes = true,
      showSeconds = true,
      showMilliseconds = false,
      showLabels = true,
      showControls = false,
      separator = ':',
      expiredMessage = 'Time expired',
      warningThreshold,
      warningClassName = 'text-red-600',
      className,
      onComplete,
      onTick,
      onStart,
      onPause,
      onReset,
      onWarning,
      ...props
    },
    ref
  ) => {
    const countdown = useCountdown({
      duration,
      targetDate,
      autoStart,
      warningThreshold,
      onComplete,
      onTick,
      onStart,
      onPause,
      onReset,
      onWarning,
    });

    const { time, isRunning, start, pause, reset } = countdown;
    const sizeStyles = SIZE_MAP[size];

    const isWarning = warningThreshold && time.totalMilliseconds <= warningThreshold && !time.isExpired;

    if (time.isExpired) {
      return (
        <div
          ref={ref}
          className={clsx('flex items-center gap-2 text-gray-500', className)}
          {...props}
        >
          <TimerOff className="w-5 h-5" />
          <span>{expiredMessage}</span>
        </div>
      );
    }

    const units: { value: number; label: string; show: boolean }[] = [
      { value: time.days, label: 'Days', show: showDays && time.days > 0 },
      { value: time.hours, label: 'Hours', show: showHours },
      { value: time.minutes, label: 'Minutes', show: showMinutes },
      { value: time.seconds, label: 'Seconds', show: showSeconds },
      { value: time.milliseconds, label: 'MS', show: showMilliseconds },
    ].filter((u) => u.show);

    if (variant === 'minimal') {
      return (
        <div
          ref={ref}
          className={clsx(
            'inline-flex items-center font-mono',
            sizeStyles.digit,
            isWarning && warningClassName,
            className
          )}
          {...props}
        >
          {formatTime(time, showDays && time.days > 0 ? 'D:HH:mm:ss' : 'HH:mm:ss')}
        </div>
      );
    }

    if (variant === 'flip') {
      return (
        <div
          ref={ref}
          className={clsx('flex items-center', sizeStyles.container, className)}
          {...props}
        >
          {units.map((unit, i) => (
            <React.Fragment key={unit.label}>
              {i > 0 && separator && (
                <span className={clsx(sizeStyles.digit, 'text-gray-400 mx-1')}>{separator}</span>
              )}
              <div className="flex flex-col items-center">
                <div
                  className={clsx(
                    'bg-gray-900 text-white rounded-lg px-3 py-2 font-mono',
                    sizeStyles.digit,
                    isWarning && 'bg-red-600'
                  )}
                >
                  {String(unit.value).padStart(unit.label === 'MS' ? 3 : 2, '0')}
                </div>
                {showLabels && (
                  <span className={clsx(sizeStyles.label, 'text-gray-500 mt-1')}>
                    {unit.label}
                  </span>
                )}
              </div>
            </React.Fragment>
          ))}
        </div>
      );
    }

    if (variant === 'circular') {
      const progress = duration ? ((duration - time.totalMilliseconds) / duration) * 100 : 0;
      const radius = size === 'xl' ? 60 : size === 'lg' ? 50 : size === 'md' ? 40 : size === 'sm' ? 30 : 24;
      const strokeWidth = size === 'xl' ? 6 : size === 'lg' ? 5 : 4;
      const circumference = 2 * Math.PI * radius;

      return (
        <div
          ref={ref}
          className={clsx('relative inline-flex items-center justify-center', className)}
          {...props}
        >
          <svg
            width={radius * 2 + strokeWidth * 2}
            height={radius * 2 + strokeWidth * 2}
            className="transform -rotate-90"
          >
            <circle
              cx={radius + strokeWidth}
              cy={radius + strokeWidth}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              className="text-gray-200"
            />
            <circle
              cx={radius + strokeWidth}
              cy={radius + strokeWidth}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (progress / 100)}
              className={clsx('text-blue-600 transition-all', isWarning && 'text-red-600')}
            />
          </svg>
          <div className={clsx('absolute inset-0 flex flex-col items-center justify-center', sizeStyles.gap)}>
            <span className={clsx('font-mono font-bold', sizeStyles.digit, isWarning && warningClassName)}>
              {formatTime(time, 'mm:ss')}
            </span>
            {showLabels && (
              <span className={clsx(sizeStyles.label, 'text-gray-500')}>remaining</span>
            )}
          </div>
        </div>
      );
    }

    if (variant === 'banner') {
      return (
        <div
          ref={ref}
          className={clsx(
            'flex items-center justify-center gap-4 py-3 px-6',
            isWarning ? 'bg-red-600 text-white' : 'bg-gray-900 text-white',
            className
          )}
          {...props}
        >
          <Clock className="w-5 h-5" />
          <div className="flex items-center gap-2">
            {units.map((unit, i) => (
              <React.Fragment key={unit.label}>
                {i > 0 && <span className="text-gray-400">:</span>}
                <div className="flex items-center gap-1">
                  <span className="font-mono font-bold text-xl">
                    {String(unit.value).padStart(2, '0')}
                  </span>
                  {showLabels && (
                    <span className="text-xs text-gray-300">{unit.label.slice(0, 1)}</span>
                  )}
                </div>
              </React.Fragment>
            ))}
          </div>
          {isWarning && <AlertTriangle className="w-5 h-5" />}
        </div>
      );
    }

    // Default variant
    return (
      <div ref={ref} className={clsx('flex flex-col gap-2', className)} {...props}>
        <div className={clsx('flex items-center', sizeStyles.container)}>
          {units.map((unit, i) => (
            <React.Fragment key={unit.label}>
              {i > 0 && separator && (
                <span className={clsx(sizeStyles.digit, 'text-gray-300 mx-1')}>{separator}</span>
              )}
              <div className={clsx('flex flex-col items-center', sizeStyles.gap)}>
                <span
                  className={clsx(
                    'font-mono font-bold',
                    sizeStyles.digit,
                    isWarning && warningClassName
                  )}
                >
                  {String(unit.value).padStart(unit.label === 'MS' ? 3 : 2, '0')}
                </span>
                {showLabels && (
                  <span className={clsx(sizeStyles.label, 'text-gray-500 uppercase tracking-wide')}>
                    {unit.label}
                  </span>
                )}
              </div>
            </React.Fragment>
          ))}
        </div>

        {showControls && (
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600"
              onClick={isRunning ? pause : start}
            >
              {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button
              type="button"
              className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600"
              onClick={reset}
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    );
  }
);

Countdown.displayName = 'Countdown';

// ============================================================================
// CountdownTimer Component (Simpler interface)
// ============================================================================

export interface CountdownTimerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onPause' | 'onReset'> {
  seconds: number;
  onComplete?: () => void;
  size?: CountdownSize;
  autoStart?: boolean;
}

export const CountdownTimer = forwardRef<HTMLDivElement, CountdownTimerProps>(
  ({ seconds, onComplete, size = 'md', autoStart = true, ...props }, ref) => {
    return (
      <Countdown
        ref={ref}
        duration={seconds * 1000}
        autoStart={autoStart}
        onComplete={onComplete}
        size={size}
        showDays={false}
        {...props}
      />
    );
  }
);

CountdownTimer.displayName = 'CountdownTimer';

// ============================================================================
// Stopwatch Component
// ============================================================================

export interface StopwatchProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  autoStart?: boolean;
  size?: CountdownSize;
  showControls?: boolean;
  showLabels?: boolean;
  showMilliseconds?: boolean;
  onLap?: (time: TimeComponents, lapNumber: number) => void;
  maxDuration?: number;
  onMaxReached?: () => void;
}

export const Stopwatch = forwardRef<HTMLDivElement, StopwatchProps>(
  (
    {
      autoStart = false,
      size = 'md',
      showControls = true,
      showLabels = false,
      showMilliseconds = true,
      onLap,
      maxDuration,
      onMaxReached,
      className,
      ...props
    },
    ref
  ) => {
    const [elapsedTime, setElapsedTime] = useState(0);
    const [isRunning, setIsRunning] = useState(autoStart);
    const [laps, setLaps] = useState<TimeComponents[]>([]);
    const intervalRef = useRef<number | null>(null);
    const startTimeRef = useRef<number>(0);
    const pausedTimeRef = useRef<number>(0);

    const time = useMemo(() => calculateTimeComponents(elapsedTime), [elapsedTime]);
    const sizeStyles = SIZE_MAP[size];

    const start = useCallback(() => {
      if (isRunning) return;
      startTimeRef.current = Date.now() - pausedTimeRef.current;
      setIsRunning(true);
    }, [isRunning]);

    const pause = useCallback(() => {
      if (!isRunning) return;
      pausedTimeRef.current = elapsedTime;
      setIsRunning(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }, [isRunning, elapsedTime]);

    const reset = useCallback(() => {
      setIsRunning(false);
      setElapsedTime(0);
      setLaps([]);
      pausedTimeRef.current = 0;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }, []);

    const lap = useCallback(() => {
      if (!isRunning) return;
      setLaps((prev) => {
        const newLaps = [...prev, time];
        onLap?.(time, newLaps.length);
        return newLaps;
      });
    }, [isRunning, time, onLap]);

    useEffect(() => {
      if (!isRunning) return;

      intervalRef.current = window.setInterval(() => {
        const now = Date.now();
        const elapsed = now - startTimeRef.current;
        setElapsedTime(elapsed);

        if (maxDuration && elapsed >= maxDuration) {
          setIsRunning(false);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }
          onMaxReached?.();
        }
      }, 10);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }, [isRunning, maxDuration, onMaxReached]);

    return (
      <div ref={ref} className={clsx('flex flex-col gap-4', className)} {...props}>
        {/* Display */}
        <div className={clsx('flex items-center justify-center', sizeStyles.container)}>
          <div className="flex flex-col items-center">
            <span className={clsx('font-mono font-bold tabular-nums', sizeStyles.digit)}>
              {String(time.hours).padStart(2, '0')}
            </span>
            {showLabels && <span className={clsx(sizeStyles.label, 'text-gray-500')}>Hours</span>}
          </div>
          <span className={clsx(sizeStyles.digit, 'text-gray-300 mx-1')}>:</span>
          <div className="flex flex-col items-center">
            <span className={clsx('font-mono font-bold tabular-nums', sizeStyles.digit)}>
              {String(time.minutes).padStart(2, '0')}
            </span>
            {showLabels && <span className={clsx(sizeStyles.label, 'text-gray-500')}>Minutes</span>}
          </div>
          <span className={clsx(sizeStyles.digit, 'text-gray-300 mx-1')}>:</span>
          <div className="flex flex-col items-center">
            <span className={clsx('font-mono font-bold tabular-nums', sizeStyles.digit)}>
              {String(time.seconds).padStart(2, '0')}
            </span>
            {showLabels && <span className={clsx(sizeStyles.label, 'text-gray-500')}>Seconds</span>}
          </div>
          {showMilliseconds && (
            <>
              <span className={clsx(sizeStyles.digit, 'text-gray-300 mx-1')}>.</span>
              <div className="flex flex-col items-center">
                <span className={clsx('font-mono font-bold tabular-nums text-gray-500', sizeStyles.digit)}>
                  {String(Math.floor(time.milliseconds / 10)).padStart(2, '0')}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Controls */}
        {showControls && (
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              className={clsx(
                'px-4 py-2 rounded-lg font-medium text-sm transition-colors',
                isRunning
                  ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              )}
              onClick={isRunning ? pause : start}
            >
              {isRunning ? (
                <span className="flex items-center gap-1">
                  <Pause className="w-4 h-4" /> Pause
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Play className="w-4 h-4" /> {elapsedTime > 0 ? 'Resume' : 'Start'}
                </span>
              )}
            </button>
            {isRunning && onLap && (
              <button
                type="button"
                className="px-4 py-2 rounded-lg font-medium text-sm bg-blue-100 text-blue-700 hover:bg-blue-200"
                onClick={lap}
              >
                Lap
              </button>
            )}
            <button
              type="button"
              className="px-4 py-2 rounded-lg font-medium text-sm bg-gray-100 text-gray-700 hover:bg-gray-200"
              onClick={reset}
            >
              <span className="flex items-center gap-1">
                <RotateCcw className="w-4 h-4" /> Reset
              </span>
            </button>
          </div>
        )}

        {/* Laps */}
        {laps.length > 0 && (
          <div className="max-h-40 overflow-auto border border-gray-200 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-gray-600">Lap</th>
                  <th className="px-3 py-2 text-right text-gray-600">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {laps.map((lapTime, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 text-gray-900">Lap {i + 1}</td>
                    <td className="px-3 py-2 text-right font-mono text-gray-700">
                      {formatTime(lapTime, 'HH:mm:ss.SS')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }
);

Stopwatch.displayName = 'Stopwatch';

// ============================================================================
// DeadlineDisplay Component
// ============================================================================

export interface DeadlineDisplayProps extends HTMLAttributes<HTMLDivElement> {
  deadline: Date | string | number;
  warningDays?: number;
  criticalDays?: number;
  format?: 'relative' | 'absolute' | 'both';
  showIcon?: boolean;
}

export const DeadlineDisplay = forwardRef<HTMLDivElement, DeadlineDisplayProps>(
  (
    {
      deadline,
      warningDays = 3,
      criticalDays = 1,
      format = 'relative',
      showIcon = true,
      className,
      ...props
    },
    ref
  ) => {
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
      const interval = setInterval(() => setNow(Date.now()), 60000);
      return () => clearInterval(interval);
    }, []);

    const deadlineDate = new Date(deadline);
    const msRemaining = deadlineDate.getTime() - now;
    const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
    const time = calculateTimeComponents(msRemaining);

    const isOverdue = msRemaining < 0;
    const isCritical = !isOverdue && daysRemaining <= criticalDays;
    const isWarning = !isOverdue && !isCritical && daysRemaining <= warningDays;

    const getStatusColor = () => {
      if (isOverdue) return 'text-red-700 bg-red-50';
      if (isCritical) return 'text-red-600 bg-red-50';
      if (isWarning) return 'text-yellow-700 bg-yellow-50';
      return 'text-gray-700 bg-gray-50';
    };

    const getRelativeText = () => {
      if (isOverdue) {
        const overdue = calculateTimeComponents(Math.abs(msRemaining));
        if (overdue.days > 0) return `${overdue.days} day${overdue.days !== 1 ? 's' : ''} overdue`;
        if (overdue.hours > 0) return `${overdue.hours} hour${overdue.hours !== 1 ? 's' : ''} overdue`;
        return 'Just overdue';
      }
      if (time.days > 0) return `${time.days} day${time.days !== 1 ? 's' : ''} left`;
      if (time.hours > 0) return `${time.hours} hour${time.hours !== 1 ? 's' : ''} left`;
      if (time.minutes > 0) return `${time.minutes} minute${time.minutes !== 1 ? 's' : ''} left`;
      return 'Less than a minute';
    };

    return (
      <div
        ref={ref}
        className={clsx(
          'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium',
          getStatusColor(),
          className
        )}
        {...props}
      >
        {showIcon && (
          isOverdue || isCritical ? (
            <AlertTriangle className="w-4 h-4" />
          ) : (
            <Clock className="w-4 h-4" />
          )
        )}
        {format === 'relative' && getRelativeText()}
        {format === 'absolute' && deadlineDate.toLocaleDateString()}
        {format === 'both' && (
          <>
            {getRelativeText()}
            <span className="text-xs opacity-70">
              ({deadlineDate.toLocaleDateString()})
            </span>
          </>
        )}
      </div>
    );
  }
);

DeadlineDisplay.displayName = 'DeadlineDisplay';

// ============================================================================
// DurationDisplay Component
// ============================================================================

export interface DurationDisplayProps extends HTMLAttributes<HTMLSpanElement> {
  seconds: number;
  format?: 'long' | 'short' | 'minimal';
  maxUnits?: number;
}

export const DurationDisplay = forwardRef<HTMLSpanElement, DurationDisplayProps>(
  ({ seconds, format = 'short', maxUnits = 2, className, ...props }, ref) => {
    const formatted = formatDuration(seconds, {
      compact: format === 'minimal' || format === 'short',
      units: maxUnits,
    });

    return (
      <span ref={ref} className={clsx('tabular-nums', className)} {...props}>
        {formatted}
      </span>
    );
  }
);

DurationDisplay.displayName = 'DurationDisplay';

// ============================================================================
// Exports
// ============================================================================

export default Countdown;
