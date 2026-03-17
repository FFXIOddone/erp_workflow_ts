import React, { useState, useCallback, useRef, useEffect } from 'react';
import { RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';

/**
 * Props for RetryButton component
 */
export interface RetryButtonProps {
  /** Handler for retry action */
  onRetry: () => Promise<void>;
  /** Button variant */
  variant?: 'primary' | 'secondary' | 'ghost';
  /** Button size */
  size?: 'sm' | 'md' | 'lg';
  /** Custom label */
  label?: string;
  /** Maximum number of retry attempts */
  maxRetries?: number;
  /** Initial delay in ms */
  baseDelay?: number;
  /** Whether to use exponential backoff */
  exponentialBackoff?: boolean;
  /** Callback when max retries exceeded */
  onMaxRetriesExceeded?: () => void;
  /** Callback on successful retry */
  onSuccess?: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Whether button is disabled */
  disabled?: boolean;
  /** Show countdown to next retry */
  showCountdown?: boolean;
}

/**
 * Retry state
 */
type RetryState = 'idle' | 'retrying' | 'success' | 'failed' | 'cooldown';

/**
 * RetryButton - Smart retry button with exponential backoff
 * 
 * Features:
 * - Exponential backoff between retries
 * - Visual feedback during retry
 * - Countdown to next available retry
 * - Success/failure indicators
 * - Configurable max retries
 * 
 * @example
 * ```tsx
 * function FailedRequest() {
 *   const { refetch } = useQuery({...});
 *   
 *   return (
 *     <RetryButton
 *       onRetry={refetch}
 *       maxRetries={3}
 *       exponentialBackoff
 *       showCountdown
 *     />
 *   );
 * }
 * ```
 */
export function RetryButton({
  onRetry,
  variant = 'primary',
  size = 'md',
  label = 'Retry',
  maxRetries = 3,
  baseDelay = 1000,
  exponentialBackoff = true,
  onMaxRetriesExceeded,
  onSuccess,
  className = '',
  disabled = false,
  showCountdown = false,
}: RetryButtonProps) {
  const [state, setState] = useState<RetryState>('idle');
  const [retryCount, setRetryCount] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  // Calculate delay for current retry attempt
  const getDelay = useCallback(
    (attempt: number) => {
      if (!exponentialBackoff) return baseDelay;
      // Exponential: 1s, 2s, 4s, 8s, etc.
      return baseDelay * Math.pow(2, attempt);
    },
    [baseDelay, exponentialBackoff]
  );

  // Start countdown timer
  const startCountdown = useCallback((duration: number) => {
    setCountdown(Math.ceil(duration / 1000));
    setState('cooldown');

    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          setState('idle');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Handle retry click
  const handleRetry = useCallback(async () => {
    if (state === 'retrying' || state === 'cooldown' || disabled) return;

    // Check if max retries exceeded
    if (retryCount >= maxRetries) {
      setState('failed');
      onMaxRetriesExceeded?.();
      return;
    }

    setState('retrying');

    try {
      await onRetry();
      setState('success');
      setRetryCount(0);
      onSuccess?.();

      // Reset to idle after showing success
      timeoutRef.current = setTimeout(() => {
        setState('idle');
      }, 2000);
    } catch {
      const newCount = retryCount + 1;
      setRetryCount(newCount);

      if (newCount >= maxRetries) {
        setState('failed');
        onMaxRetriesExceeded?.();
      } else {
        // Start cooldown with countdown
        const delay = getDelay(newCount);
        startCountdown(delay);
      }
    }
  }, [
    state,
    disabled,
    retryCount,
    maxRetries,
    onRetry,
    onSuccess,
    onMaxRetriesExceeded,
    getDelay,
    startCountdown,
  ]);

  // Reset button
  const reset = useCallback(() => {
    setState('idle');
    setRetryCount(0);
    setCountdown(0);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  // Size classes
  const sizeClasses = {
    sm: 'px-2.5 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-5 py-2.5 text-base gap-2',
  };

  // Icon size classes
  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  // Variant classes
  const variantClasses = {
    primary: `bg-blue-600 text-white hover:bg-blue-700 
              focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
              disabled:bg-blue-400`,
    secondary: `bg-gray-100 text-gray-700 hover:bg-gray-200
                dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700
                focus:ring-2 focus:ring-gray-500 focus:ring-offset-2
                disabled:bg-gray-100 dark:disabled:bg-gray-800`,
    ghost: `bg-transparent text-gray-600 hover:bg-gray-100
            dark:text-gray-400 dark:hover:bg-gray-800
            focus:ring-2 focus:ring-gray-500
            disabled:text-gray-400`,
  };

  // State-specific styles
  const getStateStyles = () => {
    switch (state) {
      case 'success':
        return 'bg-green-600 hover:bg-green-600 text-white';
      case 'failed':
        return 'bg-red-600 hover:bg-red-600 text-white';
      default:
        return '';
    }
  };

  // Get button label based on state
  const getLabel = () => {
    switch (state) {
      case 'retrying':
        return 'Retrying...';
      case 'success':
        return 'Success!';
      case 'failed':
        return 'Max Retries';
      case 'cooldown':
        return showCountdown ? `Wait ${countdown}s` : 'Please wait...';
      default:
        return retryCount > 0 ? `${label} (${retryCount}/${maxRetries})` : label;
    }
  };

  // Get icon based on state
  const getIcon = () => {
    switch (state) {
      case 'retrying':
        return <RefreshCw className={`${iconSizes[size]} animate-spin`} aria-hidden="true" />;
      case 'success':
        return <CheckCircle className={iconSizes[size]} aria-hidden="true" />;
      case 'failed':
        return <AlertCircle className={iconSizes[size]} aria-hidden="true" />;
      default:
        return <RefreshCw className={iconSizes[size]} aria-hidden="true" />;
    }
  };

  const isDisabled = disabled || state === 'retrying' || state === 'cooldown' || state === 'failed';

  return (
    <div className="inline-flex flex-col items-center gap-1">
      <button
        onClick={handleRetry}
        disabled={isDisabled}
        className={`
          inline-flex items-center justify-center rounded-lg font-medium
          transition-all duration-200
          disabled:cursor-not-allowed disabled:opacity-60
          ${sizeClasses[size]}
          ${state === 'idle' || state === 'cooldown' ? variantClasses[variant] : ''}
          ${getStateStyles()}
          ${className}
        `}
        aria-label={getLabel()}
        aria-busy={state === 'retrying'}
        aria-disabled={isDisabled}
      >
        {getIcon()}
        <span>{getLabel()}</span>
      </button>

      {/* Reset link when failed */}
      {state === 'failed' && (
        <button
          onClick={reset}
          className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 underline"
        >
          Reset and try again
        </button>
      )}
    </div>
  );
}

/**
 * AutoRetry component - Automatically retries a failed operation
 */
export interface AutoRetryProps {
  /** Handler for retry action */
  onRetry: () => Promise<void>;
  /** Maximum number of automatic retries */
  maxRetries?: number;
  /** Base delay in ms */
  baseDelay?: number;
  /** Callback when auto-retry succeeds */
  onSuccess?: () => void;
  /** Callback when auto-retry fails after max attempts */
  onFailure?: () => void;
  /** Render prop for status display */
  children: (status: {
    isRetrying: boolean;
    attempt: number;
    maxRetries: number;
    nextRetryIn: number | null;
  }) => React.ReactNode;
}

export function AutoRetry({
  onRetry,
  maxRetries = 3,
  baseDelay = 2000,
  onSuccess,
  onFailure,
  children,
}: AutoRetryProps) {
  const [attempt, setAttempt] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [nextRetryIn, setNextRetryIn] = useState<number | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Start auto-retry on mount
  useEffect(() => {
    const doRetry = async (currentAttempt: number) => {
      if (!mountedRef.current) return;

      setIsRetrying(true);
      setNextRetryIn(null);

      try {
        await onRetry();
        if (mountedRef.current) {
          setIsRetrying(false);
          onSuccess?.();
        }
      } catch {
        if (!mountedRef.current) return;

        setIsRetrying(false);
        const nextAttempt = currentAttempt + 1;
        setAttempt(nextAttempt);

        if (nextAttempt >= maxRetries) {
          onFailure?.();
          return;
        }

        // Schedule next retry with countdown
        const delay = baseDelay * Math.pow(2, currentAttempt);
        setNextRetryIn(Math.ceil(delay / 1000));

        intervalRef.current = setInterval(() => {
          setNextRetryIn((prev) => {
            if (prev === null || prev <= 1) {
              if (intervalRef.current) clearInterval(intervalRef.current);
              return null;
            }
            return prev - 1;
          });
        }, 1000);

        timeoutRef.current = setTimeout(() => {
          doRetry(nextAttempt);
        }, delay);
      }
    };

    doRetry(0);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [onRetry, onSuccess, onFailure, maxRetries, baseDelay]);

  return <>{children({ isRetrying, attempt, maxRetries, nextRetryIn })}</>;
}
