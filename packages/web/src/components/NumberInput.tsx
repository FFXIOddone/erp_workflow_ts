/**
 * NumberInput.tsx - CRITICAL-43
 * 
 * Numeric input components for the ERP application.
 * Enhanced number inputs with formatting and validation.
 * 
 * Features:
 * - 43.1: Numeric input with stepper
 * - 43.2: Currency input with formatting
 * - 43.3: Percentage input
 * - 43.4: Range/slider input
 * - 43.5: Quantity input with units
 * 
 * @module NumberInput
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  forwardRef,
  type ReactNode,
  type KeyboardEvent,
  type ChangeEvent,
  type FocusEvent,
} from 'react';
import { clsx } from 'clsx';
import {
  Plus,
  Minus,
  ChevronUp,
  ChevronDown,
  DollarSign,
  Percent,
  AlertCircle,
  Info,
} from 'lucide-react';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/** Number input base props */
export interface NumberInputBaseProps {
  /** Value */
  value: number | null;
  /** On change */
  onChange: (value: number | null) => void;
  /** Minimum value */
  min?: number;
  /** Maximum value */
  max?: number;
  /** Step */
  step?: number;
  /** Precision (decimal places) */
  precision?: number;
  /** Placeholder */
  placeholder?: string;
  /** Disabled */
  disabled?: boolean;
  /** Read only */
  readOnly?: boolean;
  /** Error message */
  error?: string;
  /** Size */
  size?: 'sm' | 'md' | 'lg';
  /** Class name */
  className?: string;
}

/** Number input props */
export interface NumberInputProps extends NumberInputBaseProps {
  /** Show stepper buttons */
  showStepper?: boolean;
  /** Stepper position */
  stepperPosition?: 'right' | 'sides';
  /** Prefix */
  prefix?: ReactNode;
  /** Suffix */
  suffix?: ReactNode;
  /** Allow negative */
  allowNegative?: boolean;
  /** On blur */
  onBlur?: (e: FocusEvent<HTMLInputElement>) => void;
}

/** Currency input props */
export interface CurrencyInputProps extends Omit<NumberInputBaseProps, 'precision'> {
  /** Currency code */
  currency?: string;
  /** Currency symbol */
  symbol?: string;
  /** Locale */
  locale?: string;
  /** Precision (decimal places) */
  precision?: number;
}

/** Percentage input props */
export interface PercentageInputProps extends Omit<NumberInputBaseProps, 'min' | 'max'> {
  /** Allow values over 100 */
  allowOver100?: boolean;
  /** Allow negative */
  allowNegative?: boolean;
}

/** Quantity input props */
export interface QuantityInputProps extends NumberInputBaseProps {
  /** Unit label */
  unit?: string;
  /** Unit options */
  units?: { value: string; label: string }[];
  /** Selected unit */
  selectedUnit?: string;
  /** On unit change */
  onUnitChange?: (unit: string) => void;
}

// ============================================================================
// UTILITIES
// ============================================================================

/** Parse number from string */
function parseNumber(value: string, precision: number = 2): number | null {
  const cleaned = value.replace(/[^0-9.-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.') return null;

  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;

  return Math.round(num * Math.pow(10, precision)) / Math.pow(10, precision);
}

/** Format number with locale */
function formatNumber(
  value: number | null,
  options: {
    precision?: number;
    locale?: string;
    style?: 'decimal' | 'currency' | 'percent';
    currency?: string;
  } = {}
): string {
  if (value === null) return '';

  const {
    precision = 2,
    locale = 'en-US',
    style = 'decimal',
    currency = 'USD',
  } = options;

  try {
    const formatter = new Intl.NumberFormat(locale, {
      style,
      currency: style === 'currency' ? currency : undefined,
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    });

    return formatter.format(style === 'percent' ? value / 100 : value);
  } catch {
    return value.toFixed(precision);
  }
}

/** Clamp value between min and max */
function clamp(value: number, min?: number, max?: number): number {
  let result = value;
  if (min !== undefined && result < min) result = min;
  if (max !== undefined && result > max) result = max;
  return result;
}

// ============================================================================
// 43.1: NUMBER INPUT WITH STEPPER
// ============================================================================

/**
 * Numeric input with increment/decrement buttons
 * 
 * @example
 * ```tsx
 * const [count, setCount] = useState<number | null>(0);
 * 
 * <NumberInput
 *   value={count}
 *   onChange={setCount}
 *   min={0}
 *   max={100}
 *   step={5}
 *   showStepper
 * />
 * ```
 */
export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(({
  value,
  onChange,
  min,
  max,
  step = 1,
  precision = 0,
  placeholder = '0',
  disabled = false,
  readOnly = false,
  error,
  size = 'md',
  showStepper = true,
  stepperPosition = 'right',
  prefix,
  suffix,
  allowNegative = true,
  onBlur,
  className,
}, ref) => {
  const [inputValue, setInputValue] = useState<string>(
    value !== null ? value.toString() : ''
  );
  const [isFocused, setIsFocused] = useState(false);

  // Sync with external value
  useEffect(() => {
    if (!isFocused) {
      setInputValue(value !== null ? value.toString() : '');
    }
  }, [value, isFocused]);

  const increment = useCallback(() => {
    const current = value ?? 0;
    const newValue = clamp(current + step, min, max);
    onChange(newValue);
  }, [value, step, min, max, onChange]);

  const decrement = useCallback(() => {
    const current = value ?? 0;
    const newValue = clamp(current - step, min, max);
    onChange(newValue);
  }, [value, step, min, max, onChange]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    let rawValue = e.target.value;

    // Filter invalid characters
    if (!allowNegative) {
      rawValue = rawValue.replace(/-/g, '');
    }

    // Only allow numbers, decimal, and minus
    if (!/^-?\d*\.?\d*$/.test(rawValue)) {
      return;
    }

    setInputValue(rawValue);

    const parsed = parseNumber(rawValue, precision);
    if (parsed !== null) {
      onChange(clamp(parsed, min, max));
    } else if (rawValue === '' || rawValue === '-') {
      onChange(null);
    }
  };

  const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    if (value !== null) {
      setInputValue(value.toString());
    }
    onBlur?.(e);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      increment();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      decrement();
    }
  };

  const sizeClasses = {
    sm: 'h-8 text-sm',
    md: 'h-10 text-base',
    lg: 'h-12 text-lg',
  };

  const buttonSizes = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };

  const canIncrement = max === undefined || (value ?? 0) < max;
  const canDecrement = min === undefined || (value ?? 0) > min;

  return (
    <div className={className}>
      <div className={clsx(
        'relative flex items-center border rounded-lg overflow-hidden',
        'focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500',
        error && 'border-red-500',
        disabled && 'bg-gray-100 cursor-not-allowed',
        sizeClasses[size]
      )}>
        {/* Left stepper */}
        {showStepper && stepperPosition === 'sides' && (
          <button
            type="button"
            onClick={decrement}
            disabled={disabled || readOnly || !canDecrement}
            className={clsx(
              'flex items-center justify-center border-r',
              'hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed',
              buttonSizes[size]
            )}
          >
            <Minus className="w-4 h-4" />
          </button>
        )}

        {/* Prefix */}
        {prefix && (
          <span className="pl-3 text-gray-500">{prefix}</span>
        )}

        {/* Input */}
        <input
          ref={ref}
          type="text"
          inputMode="decimal"
          value={inputValue}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          className={clsx(
            'flex-1 px-3 h-full outline-none bg-transparent',
            'text-center',
            disabled && 'cursor-not-allowed'
          )}
        />

        {/* Suffix */}
        {suffix && (
          <span className="pr-3 text-gray-500">{suffix}</span>
        )}

        {/* Right stepper */}
        {showStepper && stepperPosition === 'right' && (
          <div className="flex flex-col border-l">
            <button
              type="button"
              onClick={increment}
              disabled={disabled || readOnly || !canIncrement}
              className={clsx(
                'flex items-center justify-center flex-1 px-1',
                'hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed',
                'border-b'
              )}
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={decrement}
              disabled={disabled || readOnly || !canDecrement}
              className={clsx(
                'flex items-center justify-center flex-1 px-1',
                'hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Side stepper - right button */}
        {showStepper && stepperPosition === 'sides' && (
          <button
            type="button"
            onClick={increment}
            disabled={disabled || readOnly || !canIncrement}
            className={clsx(
              'flex items-center justify-center border-l',
              'hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed',
              buttonSizes[size]
            )}
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      {error && (
        <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
          <AlertCircle className="w-4 h-4" />
          {error}
        </p>
      )}
    </div>
  );
});

NumberInput.displayName = 'NumberInput';

// ============================================================================
// 43.2: CURRENCY INPUT
// ============================================================================

/**
 * Currency input with formatting
 * 
 * @example
 * ```tsx
 * const [amount, setAmount] = useState<number | null>(0);
 * 
 * <CurrencyInput
 *   value={amount}
 *   onChange={setAmount}
 *   currency="USD"
 * />
 * ```
 */
export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(({
  value,
  onChange,
  min = 0,
  max,
  step = 0.01,
  placeholder = '0.00',
  disabled = false,
  readOnly = false,
  error,
  size = 'md',
  currency = 'USD',
  symbol = '$',
  locale = 'en-US',
  precision = 2,
  className,
}, ref) => {
  const [inputValue, setInputValue] = useState<string>(
    value !== null ? formatNumber(value, { precision, locale }) : ''
  );
  const [isFocused, setIsFocused] = useState(false);

  // Sync with external value
  useEffect(() => {
    if (!isFocused && value !== null) {
      setInputValue(formatNumber(value, { precision, locale }));
    } else if (!isFocused && value === null) {
      setInputValue('');
    }
  }, [value, isFocused, precision, locale]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    let rawValue = e.target.value;

    // Remove currency formatting
    rawValue = rawValue.replace(/[^0-9.-]/g, '');

    setInputValue(rawValue);

    const parsed = parseNumber(rawValue, precision);
    if (parsed !== null) {
      onChange(clamp(parsed, min, max));
    } else if (rawValue === '') {
      onChange(null);
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
    // Show raw number on focus
    if (value !== null) {
      setInputValue(value.toFixed(precision));
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (value !== null) {
      setInputValue(formatNumber(value, { precision, locale }));
    }
  };

  const sizeClasses = {
    sm: 'h-8 text-sm',
    md: 'h-10 text-base',
    lg: 'h-12 text-lg',
  };

  return (
    <div className={className}>
      <div className={clsx(
        'relative flex items-center border rounded-lg overflow-hidden',
        'focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500',
        error && 'border-red-500',
        disabled && 'bg-gray-100 cursor-not-allowed',
        sizeClasses[size]
      )}>
        <span className="pl-3 text-gray-500 flex items-center">
          {symbol || <DollarSign className="w-4 h-4" />}
        </span>
        <input
          ref={ref}
          type="text"
          inputMode="decimal"
          value={inputValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          className={clsx(
            'flex-1 px-2 h-full outline-none bg-transparent',
            'text-right',
            disabled && 'cursor-not-allowed'
          )}
        />
        <span className="pr-3 text-gray-500 text-sm">{currency}</span>
      </div>

      {error && (
        <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
          <AlertCircle className="w-4 h-4" />
          {error}
        </p>
      )}
    </div>
  );
});

CurrencyInput.displayName = 'CurrencyInput';

// ============================================================================
// 43.3: PERCENTAGE INPUT
// ============================================================================

/**
 * Percentage input with formatting
 * 
 * @example
 * ```tsx
 * const [discount, setDiscount] = useState<number | null>(10);
 * 
 * <PercentageInput
 *   value={discount}
 *   onChange={setDiscount}
 * />
 * ```
 */
export const PercentageInput = forwardRef<HTMLInputElement, PercentageInputProps>(({
  value,
  onChange,
  step = 1,
  precision = 0,
  placeholder = '0',
  disabled = false,
  readOnly = false,
  error,
  size = 'md',
  allowOver100 = false,
  allowNegative = false,
  className,
}, ref) => {
  return (
    <NumberInput
      ref={ref}
      value={value}
      onChange={onChange}
      min={allowNegative ? undefined : 0}
      max={allowOver100 ? undefined : 100}
      step={step}
      precision={precision}
      placeholder={placeholder}
      disabled={disabled}
      readOnly={readOnly}
      error={error}
      size={size}
      showStepper={false}
      suffix={<Percent className="w-4 h-4" />}
      allowNegative={allowNegative}
      className={className}
    />
  );
});

PercentageInput.displayName = 'PercentageInput';

// ============================================================================
// 43.4: RANGE/SLIDER INPUT
// ============================================================================

interface RangeInputProps extends Omit<NumberInputBaseProps, 'placeholder' | 'size'> {
  /** Show value label */
  showValue?: boolean;
  /** Format value for display */
  formatValue?: (value: number) => string;
  /** Show min/max labels */
  showLabels?: boolean;
  /** Track color */
  trackColor?: string;
}

/**
 * Range slider input
 * 
 * @example
 * ```tsx
 * const [volume, setVolume] = useState<number | null>(50);
 * 
 * <RangeInput
 *   value={volume}
 *   onChange={setVolume}
 *   min={0}
 *   max={100}
 *   showValue
 * />
 * ```
 */
export function RangeInput({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  readOnly = false,
  error,
  showValue = true,
  formatValue = (v) => v.toString(),
  showLabels = true,
  trackColor = 'blue',
  className,
}: RangeInputProps) {
  const currentValue = value ?? min;
  const percentage = ((currentValue - min) / (max - min)) * 100;

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(parseFloat(e.target.value));
  };

  return (
    <div className={className}>
      {showValue && (
        <div className="flex justify-between mb-2">
          <span className="text-sm font-medium">{formatValue(currentValue)}</span>
        </div>
      )}

      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={currentValue}
          onChange={handleChange}
          disabled={disabled || readOnly}
          className={clsx(
            'w-full h-2 rounded-lg appearance-none cursor-pointer',
            'bg-gray-200 dark:bg-gray-700',
            disabled && 'opacity-50 cursor-not-allowed',
            '[&::-webkit-slider-thumb]:appearance-none',
            '[&::-webkit-slider-thumb]:w-4',
            '[&::-webkit-slider-thumb]:h-4',
            '[&::-webkit-slider-thumb]:rounded-full',
            `[&::-webkit-slider-thumb]:bg-${trackColor}-500`,
            '[&::-webkit-slider-thumb]:cursor-pointer',
            '[&::-webkit-slider-thumb]:shadow-md'
          )}
          style={{
            background: `linear-gradient(to right, var(--tw-${trackColor}-500, #3b82f6) 0%, var(--tw-${trackColor}-500, #3b82f6) ${percentage}%, #e5e7eb ${percentage}%, #e5e7eb 100%)`,
          }}
        />
      </div>

      {showLabels && (
        <div className="flex justify-between mt-1">
          <span className="text-xs text-gray-500">{formatValue(min)}</span>
          <span className="text-xs text-gray-500">{formatValue(max)}</span>
        </div>
      )}

      {error && (
        <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
          <AlertCircle className="w-4 h-4" />
          {error}
        </p>
      )}
    </div>
  );
}

// ============================================================================
// 43.5: QUANTITY INPUT
// ============================================================================

/**
 * Quantity input with unit selector
 * 
 * @example
 * ```tsx
 * const [quantity, setQuantity] = useState<number | null>(1);
 * const [unit, setUnit] = useState('pcs');
 * 
 * <QuantityInput
 *   value={quantity}
 *   onChange={setQuantity}
 *   min={1}
 *   units={[
 *     { value: 'pcs', label: 'Pieces' },
 *     { value: 'box', label: 'Boxes' },
 *   ]}
 *   selectedUnit={unit}
 *   onUnitChange={setUnit}
 * />
 * ```
 */
export function QuantityInput({
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  precision = 0,
  placeholder = '0',
  disabled = false,
  readOnly = false,
  error,
  size = 'md',
  unit,
  units,
  selectedUnit,
  onUnitChange,
  className,
}: QuantityInputProps) {
  const sizeClasses = {
    sm: 'h-8 text-sm',
    md: 'h-10 text-base',
    lg: 'h-12 text-lg',
  };

  return (
    <div className={className}>
      <div className={clsx(
        'flex border rounded-lg overflow-hidden',
        'focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500',
        error && 'border-red-500',
        disabled && 'bg-gray-100'
      )}>
        <NumberInput
          value={value}
          onChange={onChange}
          min={min}
          max={max}
          step={step}
          precision={precision}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          size={size}
          showStepper
          stepperPosition="sides"
          className="flex-1"
        />

        {/* Unit selector */}
        {units && units.length > 0 ? (
          <select
            value={selectedUnit}
            onChange={(e) => onUnitChange?.(e.target.value)}
            disabled={disabled}
            className={clsx(
              'border-l px-3 bg-gray-50 dark:bg-gray-800 outline-none',
              'cursor-pointer',
              disabled && 'cursor-not-allowed',
              sizeClasses[size]
            )}
          >
            {units.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </select>
        ) : unit ? (
          <span className={clsx(
            'border-l px-3 bg-gray-50 dark:bg-gray-800 flex items-center text-gray-600',
            sizeClasses[size]
          )}>
            {unit}
          </span>
        ) : null}
      </div>

      {error && (
        <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
          <AlertCircle className="w-4 h-4" />
          {error}
        </p>
      )}
    </div>
  );
}

// ============================================================================
// NUMBER DISPLAY
// ============================================================================

interface NumberDisplayProps {
  value: number | null;
  precision?: number;
  locale?: string;
  style?: 'decimal' | 'currency' | 'percent';
  currency?: string;
  fallback?: string;
  className?: string;
}

/**
 * Formatted number display
 */
export function NumberDisplay({
  value,
  precision = 2,
  locale = 'en-US',
  style = 'decimal',
  currency = 'USD',
  fallback = '-',
  className,
}: NumberDisplayProps) {
  if (value === null) {
    return <span className={clsx('text-gray-400', className)}>{fallback}</span>;
  }

  return (
    <span className={className}>
      {formatNumber(value, { precision, locale, style, currency })}
    </span>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export { formatNumber, parseNumber, clamp };
