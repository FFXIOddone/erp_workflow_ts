/**
 * CronBuilder.tsx - CRITICAL-41
 * 
 * Visual cron expression builder for the ERP application.
 * Schedule tasks with a user-friendly interface.
 * 
 * Features:
 * - 41.1: Cron expression parser
 * - 41.2: Visual schedule builder
 * - 41.3: Human-readable description
 * - 41.4: Preset schedules
 * - 41.5: Next run preview
 * 
 * @module CronBuilder
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  type ReactNode,
} from 'react';
import { clsx } from 'clsx';
import {
  Clock,
  Calendar,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Play,
  RefreshCw,
  AlertCircle,
  Check,
} from 'lucide-react';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/** Cron field type */
export type CronField = 'minute' | 'hour' | 'dayOfMonth' | 'month' | 'dayOfWeek';

/** Cron expression parts */
export interface CronExpression {
  minute: string;
  hour: string;
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
}

/** Cron builder props */
export interface CronBuilderProps {
  /** Cron expression value */
  value: string;
  /** On change */
  onChange: (value: string) => void;
  /** Show preset options */
  showPresets?: boolean;
  /** Show next runs preview */
  showNextRuns?: boolean;
  /** Number of next runs to show */
  nextRunsCount?: number;
  /** Disabled */
  disabled?: boolean;
  /** Class name */
  className?: string;
}

/** Cron field config */
interface CronFieldConfig {
  label: string;
  min: number;
  max: number;
  names?: string[];
}

/** Schedule preset */
export interface CronPreset {
  label: string;
  value: string;
  description: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const FIELD_CONFIGS: Record<CronField, CronFieldConfig> = {
  minute: { label: 'Minute', min: 0, max: 59 },
  hour: { label: 'Hour', min: 0, max: 23 },
  dayOfMonth: { label: 'Day of Month', min: 1, max: 31 },
  month: {
    label: 'Month',
    min: 1,
    max: 12,
    names: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  },
  dayOfWeek: {
    label: 'Day of Week',
    min: 0,
    max: 6,
    names: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  },
};

const PRESETS: CronPreset[] = [
  { label: 'Every minute', value: '* * * * *', description: 'Runs every minute' },
  { label: 'Every 5 minutes', value: '*/5 * * * *', description: 'Runs every 5 minutes' },
  { label: 'Every 15 minutes', value: '*/15 * * * *', description: 'Runs every 15 minutes' },
  { label: 'Every 30 minutes', value: '*/30 * * * *', description: 'Runs every 30 minutes' },
  { label: 'Every hour', value: '0 * * * *', description: 'Runs at the start of every hour' },
  { label: 'Every day at midnight', value: '0 0 * * *', description: 'Runs at 12:00 AM every day' },
  { label: 'Every day at noon', value: '0 12 * * *', description: 'Runs at 12:00 PM every day' },
  { label: 'Every Monday', value: '0 0 * * 1', description: 'Runs at midnight every Monday' },
  { label: 'Every weekday', value: '0 9 * * 1-5', description: 'Runs at 9 AM Monday through Friday' },
  { label: 'Every weekend', value: '0 9 * * 0,6', description: 'Runs at 9 AM on Saturday and Sunday' },
  { label: 'First day of month', value: '0 0 1 * *', description: 'Runs at midnight on the 1st of each month' },
  { label: 'Last day of month', value: '0 0 L * *', description: 'Runs at midnight on the last day of each month' },
];

// ============================================================================
// 41.1: CRON PARSER
// ============================================================================

/**
 * Parse cron expression into parts
 */
export function parseCron(expression: string): CronExpression {
  const parts = expression.trim().split(/\s+/);
  
  return {
    minute: parts[0] || '*',
    hour: parts[1] || '*',
    dayOfMonth: parts[2] || '*',
    month: parts[3] || '*',
    dayOfWeek: parts[4] || '*',
  };
}

/**
 * Build cron expression from parts
 */
export function buildCron(expression: CronExpression): string {
  return `${expression.minute} ${expression.hour} ${expression.dayOfMonth} ${expression.month} ${expression.dayOfWeek}`;
}

/**
 * Validate cron expression
 */
export function validateCron(expression: string): { valid: boolean; error?: string } {
  const parts = expression.trim().split(/\s+/);
  
  if (parts.length !== 5) {
    return { valid: false, error: 'Cron expression must have 5 parts' };
  }

  const fieldOrder: CronField[] = ['minute', 'hour', 'dayOfMonth', 'month', 'dayOfWeek'];

  for (let i = 0; i < 5; i++) {
    const field = fieldOrder[i];
    const config = FIELD_CONFIGS[field];
    const part = parts[i];

    if (!validateCronField(part, config.min, config.max)) {
      return { valid: false, error: `Invalid ${config.label.toLowerCase()} field: ${part}` };
    }
  }

  return { valid: true };
}

/**
 * Validate a single cron field
 */
function validateCronField(value: string, min: number, max: number): boolean {
  if (value === '*') return true;

  // Handle special characters
  if (value === 'L') return true; // Last day

  // Handle range: 1-5
  if (value.includes('-')) {
    const [start, end] = value.split('-').map(Number);
    return !isNaN(start) && !isNaN(end) && start >= min && end <= max && start <= end;
  }

  // Handle step: */5 or 1-10/2
  if (value.includes('/')) {
    const [range, step] = value.split('/');
    if (isNaN(Number(step)) || Number(step) < 1) return false;
    if (range === '*') return true;
    return validateCronField(range, min, max);
  }

  // Handle list: 1,3,5
  if (value.includes(',')) {
    return value.split(',').every((v) => validateCronField(v.trim(), min, max));
  }

  // Single value
  const num = Number(value);
  return !isNaN(num) && num >= min && num <= max;
}

// ============================================================================
// 41.3: HUMAN-READABLE DESCRIPTION
// ============================================================================

/**
 * Convert cron expression to human-readable description
 */
export function describeCron(expression: string): string {
  const parts = parseCron(expression);
  const descriptions: string[] = [];

  // Special presets
  if (expression === '* * * * *') return 'Every minute';
  if (expression === '0 * * * *') return 'At the start of every hour';
  if (expression === '0 0 * * *') return 'Every day at midnight';
  if (expression === '0 12 * * *') return 'Every day at noon';

  // Minute
  if (parts.minute === '*') {
    descriptions.push('Every minute');
  } else if (parts.minute.startsWith('*/')) {
    descriptions.push(`Every ${parts.minute.slice(2)} minutes`);
  } else if (parts.minute.includes(',')) {
    descriptions.push(`At minutes ${parts.minute}`);
  } else if (parts.minute.includes('-')) {
    const [start, end] = parts.minute.split('-');
    descriptions.push(`Every minute from ${start} through ${end}`);
  } else {
    descriptions.push(`At minute ${parts.minute}`);
  }

  // Hour
  if (parts.hour === '*') {
    if (parts.minute !== '*' && !parts.minute.startsWith('*/')) {
      descriptions.push('of every hour');
    }
  } else if (parts.hour.startsWith('*/')) {
    descriptions.push(`every ${parts.hour.slice(2)} hours`);
  } else if (parts.hour.includes(',')) {
    descriptions.push(`at ${parts.hour.split(',').map(formatHour).join(', ')}`);
  } else {
    descriptions.push(`at ${formatHour(parts.hour)}`);
  }

  // Day of month
  if (parts.dayOfMonth !== '*') {
    if (parts.dayOfMonth === 'L') {
      descriptions.push('on the last day');
    } else if (parts.dayOfMonth.includes(',')) {
      descriptions.push(`on days ${parts.dayOfMonth}`);
    } else if (parts.dayOfMonth.includes('-')) {
      const [start, end] = parts.dayOfMonth.split('-');
      descriptions.push(`on days ${start} through ${end}`);
    } else {
      descriptions.push(`on day ${parts.dayOfMonth}`);
    }
  }

  // Month
  if (parts.month !== '*') {
    const monthNames = FIELD_CONFIGS.month.names!;
    if (parts.month.includes(',')) {
      const months = parts.month.split(',').map((m) => monthNames[Number(m) - 1] || m);
      descriptions.push(`in ${months.join(', ')}`);
    } else {
      descriptions.push(`in ${monthNames[Number(parts.month) - 1] || parts.month}`);
    }
  }

  // Day of week
  if (parts.dayOfWeek !== '*') {
    const dayNames = FIELD_CONFIGS.dayOfWeek.names!;
    if (parts.dayOfWeek.includes(',')) {
      const days = parts.dayOfWeek.split(',').map((d) => dayNames[Number(d)] || d);
      descriptions.push(`on ${days.join(', ')}`);
    } else if (parts.dayOfWeek.includes('-')) {
      const [start, end] = parts.dayOfWeek.split('-').map(Number);
      descriptions.push(`on ${dayNames[start]} through ${dayNames[end]}`);
    } else {
      descriptions.push(`on ${dayNames[Number(parts.dayOfWeek)] || parts.dayOfWeek}`);
    }
  }

  return descriptions.join(' ');
}

function formatHour(hour: string): string {
  const h = Number(hour);
  if (isNaN(h)) return hour;
  if (h === 0) return '12:00 AM';
  if (h === 12) return '12:00 PM';
  if (h < 12) return `${h}:00 AM`;
  return `${h - 12}:00 PM`;
}

// ============================================================================
// 41.5: NEXT RUN CALCULATOR
// ============================================================================

/**
 * Calculate next run times for a cron expression
 */
export function getNextRuns(expression: string, count: number = 5, from: Date = new Date()): Date[] {
  const parts = parseCron(expression);
  const runs: Date[] = [];
  const current = new Date(from);
  current.setSeconds(0);
  current.setMilliseconds(0);

  // Simple implementation - increment by minute and check
  const maxIterations = 60 * 24 * 366; // One year of minutes max
  let iterations = 0;

  while (runs.length < count && iterations < maxIterations) {
    current.setMinutes(current.getMinutes() + 1);
    
    if (matchesCron(current, parts)) {
      runs.push(new Date(current));
    }
    
    iterations++;
  }

  return runs;
}

/**
 * Check if a date matches cron expression
 */
function matchesCron(date: Date, parts: CronExpression): boolean {
  const minute = date.getMinutes();
  const hour = date.getHours();
  const dayOfMonth = date.getDate();
  const month = date.getMonth() + 1; // 0-indexed
  const dayOfWeek = date.getDay();

  return (
    matchesField(minute, parts.minute, 0, 59) &&
    matchesField(hour, parts.hour, 0, 23) &&
    matchesField(dayOfMonth, parts.dayOfMonth, 1, 31) &&
    matchesField(month, parts.month, 1, 12) &&
    matchesField(dayOfWeek, parts.dayOfWeek, 0, 6)
  );
}

function matchesField(value: number, pattern: string, min: number, max: number): boolean {
  if (pattern === '*') return true;

  // Step pattern: */5
  if (pattern.startsWith('*/')) {
    const step = Number(pattern.slice(2));
    return value % step === 0;
  }

  // Range pattern: 1-5
  if (pattern.includes('-') && !pattern.includes(',')) {
    const [start, end] = pattern.split('-').map(Number);
    return value >= start && value <= end;
  }

  // List pattern: 1,3,5
  if (pattern.includes(',')) {
    const values = pattern.split(',').map((v) => {
      if (v.includes('-')) {
        const [start, end] = v.split('-').map(Number);
        return value >= start && value <= end;
      }
      return Number(v) === value;
    });
    return values.some(Boolean);
  }

  // Exact value
  return Number(pattern) === value;
}

// ============================================================================
// 41.2: CRON BUILDER COMPONENT
// ============================================================================

/**
 * Visual cron expression builder
 * 
 * @example
 * ```tsx
 * const [cron, setCron] = useState('0 9 * * 1-5');
 * 
 * <CronBuilder
 *   value={cron}
 *   onChange={setCron}
 *   showPresets
 *   showNextRuns
 * />
 * ```
 */
export function CronBuilder({
  value,
  onChange,
  showPresets = true,
  showNextRuns = true,
  nextRunsCount = 5,
  disabled = false,
  className,
}: CronBuilderProps) {
  const [mode, setMode] = useState<'simple' | 'advanced'>('simple');
  const [showPresetsDropdown, setShowPresetsDropdown] = useState(false);
  const parts = parseCron(value);
  const validation = validateCron(value);
  const description = validation.valid ? describeCron(value) : null;
  const nextRuns = validation.valid ? getNextRuns(value, nextRunsCount) : [];

  const handleFieldChange = (field: CronField, newValue: string) => {
    const newParts = { ...parts, [field]: newValue };
    onChange(buildCron(newParts));
  };

  const handlePresetSelect = (preset: CronPreset) => {
    onChange(preset.value);
    setShowPresetsDropdown(false);
  };

  return (
    <div className={clsx('space-y-4', className)}>
      {/* Mode toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-gray-400" />
          <span className="font-medium">Schedule</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode('simple')}
            className={clsx(
              'px-3 py-1 text-sm rounded',
              mode === 'simple'
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-500 hover:bg-gray-100'
            )}
          >
            Simple
          </button>
          <button
            type="button"
            onClick={() => setMode('advanced')}
            className={clsx(
              'px-3 py-1 text-sm rounded',
              mode === 'advanced'
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-500 hover:bg-gray-100'
            )}
          >
            Advanced
          </button>
        </div>
      </div>

      {/* Presets dropdown */}
      {showPresets && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowPresetsDropdown(!showPresetsDropdown)}
            disabled={disabled}
            className={clsx(
              'w-full px-4 py-2 text-left border rounded-lg',
              'flex items-center justify-between',
              'hover:bg-gray-50 dark:hover:bg-gray-800',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            <span>Choose a preset...</span>
            {showPresetsDropdown ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {showPresetsDropdown && (
            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border rounded-lg shadow-lg max-h-64 overflow-y-auto">
              {PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => handlePresetSelect(preset)}
                  className={clsx(
                    'w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700',
                    'border-b last:border-b-0'
                  )}
                >
                  <div className="font-medium">{preset.label}</div>
                  <div className="text-sm text-gray-500">{preset.description}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Simple mode */}
      {mode === 'simple' && (
        <div className="space-y-4">
          <SimpleFieldEditor
            label="Time"
            icon={Clock}
            minute={parts.minute}
            hour={parts.hour}
            onMinuteChange={(v) => handleFieldChange('minute', v)}
            onHourChange={(v) => handleFieldChange('hour', v)}
            disabled={disabled}
          />
          <SimpleFieldEditor
            label="Day"
            icon={Calendar}
            dayOfWeek={parts.dayOfWeek}
            dayOfMonth={parts.dayOfMonth}
            onDayOfWeekChange={(v) => handleFieldChange('dayOfWeek', v)}
            onDayOfMonthChange={(v) => handleFieldChange('dayOfMonth', v)}
            disabled={disabled}
          />
        </div>
      )}

      {/* Advanced mode */}
      {mode === 'advanced' && (
        <div className="space-y-3">
          <CronFieldInput
            label="Minute"
            value={parts.minute}
            onChange={(v) => handleFieldChange('minute', v)}
            config={FIELD_CONFIGS.minute}
            disabled={disabled}
          />
          <CronFieldInput
            label="Hour"
            value={parts.hour}
            onChange={(v) => handleFieldChange('hour', v)}
            config={FIELD_CONFIGS.hour}
            disabled={disabled}
          />
          <CronFieldInput
            label="Day of Month"
            value={parts.dayOfMonth}
            onChange={(v) => handleFieldChange('dayOfMonth', v)}
            config={FIELD_CONFIGS.dayOfMonth}
            disabled={disabled}
          />
          <CronFieldInput
            label="Month"
            value={parts.month}
            onChange={(v) => handleFieldChange('month', v)}
            config={FIELD_CONFIGS.month}
            disabled={disabled}
          />
          <CronFieldInput
            label="Day of Week"
            value={parts.dayOfWeek}
            onChange={(v) => handleFieldChange('dayOfWeek', v)}
            config={FIELD_CONFIGS.dayOfWeek}
            disabled={disabled}
          />
        </div>
      )}

      {/* Raw expression */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Cron Expression
        </label>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={clsx(
            'w-full px-3 py-2 border rounded-lg font-mono text-sm',
            'focus:outline-none focus:ring-2 focus:ring-blue-500',
            !validation.valid && 'border-red-500 bg-red-50',
            disabled && 'bg-gray-100 cursor-not-allowed'
          )}
        />
        {!validation.valid && (
          <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            {validation.error}
          </p>
        )}
      </div>

      {/* Description */}
      {description && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
          <p className="text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            {description}
          </p>
        </div>
      )}

      {/* Next runs */}
      {showNextRuns && nextRuns.length > 0 && (
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
            <Play className="w-4 h-4" />
            Next {nextRunsCount} Runs
          </h4>
          <ul className="space-y-1">
            {nextRuns.map((date, index) => (
              <li key={index} className="text-sm text-gray-600 dark:text-gray-400">
                {date.toLocaleString()}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// FIELD EDITORS
// ============================================================================

interface CronFieldInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  config: CronFieldConfig;
  disabled?: boolean;
}

function CronFieldInput({
  label,
  value,
  onChange,
  config,
  disabled,
}: CronFieldInputProps) {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </label>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={clsx(
            'w-full px-3 py-2 border rounded-lg text-sm',
            'focus:outline-none focus:ring-2 focus:ring-blue-500',
            disabled && 'bg-gray-100 cursor-not-allowed'
          )}
        />
        {config.names && (
          <button
            type="button"
            onClick={() => setShowPicker(!showPicker)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        )}

        {showPicker && config.names && (
          <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border rounded-lg shadow-lg p-2">
            <div className="grid grid-cols-4 gap-1">
              {config.names.map((name, index) => {
                const num = config.min + index;
                const isSelected = value.split(',').includes(String(num));
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => {
                      const values = value === '*' ? [] : value.split(',').filter(Boolean);
                      const strNum = String(num);
                      if (values.includes(strNum)) {
                        const newValues = values.filter((v) => v !== strNum);
                        onChange(newValues.length ? newValues.join(',') : '*');
                      } else {
                        onChange([...values, strNum].sort((a, b) => Number(a) - Number(b)).join(','));
                      }
                    }}
                    className={clsx(
                      'px-2 py-1 text-xs rounded',
                      isSelected
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 hover:bg-gray-200'
                    )}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 pt-2 border-t flex justify-between">
              <button
                type="button"
                onClick={() => onChange('*')}
                className="text-xs text-blue-600 hover:underline"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() => setShowPicker(false)}
                className="text-xs text-gray-500 hover:underline"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface SimpleFieldEditorProps {
  label: string;
  icon: typeof Clock;
  minute?: string;
  hour?: string;
  dayOfWeek?: string;
  dayOfMonth?: string;
  onMinuteChange?: (value: string) => void;
  onHourChange?: (value: string) => void;
  onDayOfWeekChange?: (value: string) => void;
  onDayOfMonthChange?: (value: string) => void;
  disabled?: boolean;
}

function SimpleFieldEditor({
  label,
  icon: Icon,
  minute,
  hour,
  dayOfWeek,
  dayOfMonth,
  onMinuteChange,
  onHourChange,
  onDayOfWeekChange,
  onDayOfMonthChange,
  disabled,
}: SimpleFieldEditorProps) {
  const dayNames = FIELD_CONFIGS.dayOfWeek.names!;

  return (
    <div className="p-4 border rounded-lg">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-gray-400" />
        <span className="font-medium text-sm">{label}</span>
      </div>

      {/* Time editor */}
      {minute !== undefined && hour !== undefined && (
        <div className="flex items-center gap-2">
          <select
            value={hour === '*' ? 'every' : hour}
            onChange={(e) => {
              const val = e.target.value;
              onHourChange?.(val === 'every' ? '*' : val);
            }}
            disabled={disabled}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            <option value="every">Every hour</option>
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={String(i)}>
                {formatHour(String(i))}
              </option>
            ))}
          </select>
          <span className="text-gray-500">at minute</span>
          <select
            value={minute === '*' ? 'every' : minute}
            onChange={(e) => {
              const val = e.target.value;
              onMinuteChange?.(val === 'every' ? '*' : val);
            }}
            disabled={disabled}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            <option value="every">Every</option>
            <option value="0">:00</option>
            <option value="15">:15</option>
            <option value="30">:30</option>
            <option value="45">:45</option>
            {Array.from({ length: 60 }, (_, i) => (
              <option key={i} value={String(i)}>
                :{String(i).padStart(2, '0')}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Day editor */}
      {dayOfWeek !== undefined && (
        <div className="flex flex-wrap gap-2">
          {dayNames.map((name, index) => {
            const isSelected = dayOfWeek === '*' || 
              dayOfWeek.split(',').includes(String(index)) ||
              (dayOfWeek.includes('-') && (() => {
                const [start, end] = dayOfWeek.split('-').map(Number);
                return index >= start && index <= end;
              })());

            return (
              <button
                key={index}
                type="button"
                onClick={() => {
                  if (dayOfWeek === '*') {
                    onDayOfWeekChange?.(String(index));
                  } else {
                    const values = dayOfWeek.split(',').filter((v) => !v.includes('-'));
                    const strIdx = String(index);
                    if (values.includes(strIdx)) {
                      const newValues = values.filter((v) => v !== strIdx);
                      onDayOfWeekChange?.(newValues.length ? newValues.join(',') : '*');
                    } else {
                      onDayOfWeekChange?.([...values, strIdx].sort((a, b) => Number(a) - Number(b)).join(','));
                    }
                  }
                }}
                disabled={disabled}
                className={clsx(
                  'px-3 py-1.5 text-sm rounded-lg border',
                  isSelected
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-white hover:bg-gray-50 border-gray-300'
                )}
              >
                {name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// CRON DISPLAY
// ============================================================================

interface CronDisplayProps {
  expression: string;
  showDescription?: boolean;
  showNextRun?: boolean;
  className?: string;
}

/**
 * Display a cron expression with description
 */
export function CronDisplay({
  expression,
  showDescription = true,
  showNextRun = true,
  className,
}: CronDisplayProps) {
  const validation = validateCron(expression);
  const description = validation.valid ? describeCron(expression) : null;
  const nextRuns = validation.valid ? getNextRuns(expression, 1) : [];

  return (
    <div className={clsx('flex items-start gap-3', className)}>
      <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded">
        <Clock className="w-5 h-5 text-gray-500" />
      </div>
      <div>
        <p className="font-mono text-sm">{expression}</p>
        {showDescription && description && (
          <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
        )}
        {showNextRun && nextRuns[0] && (
          <p className="text-xs text-gray-500">
            Next: {nextRuns[0].toLocaleString()}
          </p>
        )}
        {!validation.valid && (
          <p className="text-sm text-red-600">{validation.error}</p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// EXPORTS - Types are exported inline at their definitions
// ============================================================================
