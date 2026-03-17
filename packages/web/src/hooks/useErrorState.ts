import { useState, useCallback, useEffect } from 'react';
import { useQueryClient, QueryKey } from '@tanstack/react-query';

/**
 * Error state interface for UI components
 */
export interface ErrorState {
  /** Whether there's an error */
  hasError: boolean;
  /** Error message to display */
  message: string;
  /** Error code (e.g., HTTP status) */
  code?: string | number;
  /** Original error object */
  error?: Error | unknown;
  /** Whether a retry is in progress */
  isRetrying: boolean;
  /** Number of retry attempts made */
  retryCount: number;
  /** Retry the failed operation */
  retry: () => Promise<void>;
  /** Clear the error state */
  clearError: () => void;
}

/**
 * Options for useErrorState hook
 */
export interface UseErrorStateOptions {
  /** Maximum number of automatic retries */
  maxRetries?: number;
  /** Delay between retries in ms */
  retryDelay?: number;
  /** Whether to use exponential backoff */
  exponentialBackoff?: boolean;
  /** Callback when max retries exceeded */
  onMaxRetriesExceeded?: (error: unknown) => void;
  /** Callback on successful retry */
  onRetrySuccess?: () => void;
}

/**
 * Hook for managing error states in components
 * Provides retry logic, error tracking, and clear functionality
 *
 * @example
 * ```tsx
 * function OrdersList() {
 *   const { data, error: queryError } = useQuery({ queryKey: ['orders'], queryFn: fetchOrders });
 *   const errorState = useErrorState(queryError, {
 *     onRetry: () => queryClient.refetchQueries(['orders']),
 *     maxRetries: 3,
 *   });
 *
 *   if (errorState.hasError) {
 *     return <ErrorDisplay {...errorState} />;
 *   }
 *   return <OrdersTable data={data} />;
 * }
 * ```
 */
export function useErrorState(
  error: Error | unknown | null,
  options: UseErrorStateOptions & { onRetry?: () => Promise<void> } = {}
): ErrorState {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    exponentialBackoff = true,
    onMaxRetriesExceeded,
    onRetrySuccess,
    onRetry,
  } = options;

  const [state, setState] = useState({
    isRetrying: false,
    retryCount: 0,
  });

  // Parse error message
  const getMessage = useCallback((err: unknown): string => {
    if (!err) return '';
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    if (typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message);
    return 'An unexpected error occurred';
  }, []);

  // Parse error code
  const getCode = useCallback((err: unknown): string | number | undefined => {
    if (!err) return undefined;
    if (typeof err === 'object') {
      if ('status' in err) return (err as { status: number }).status;
      if ('code' in err) return (err as { code: string | number }).code;
      if ('statusCode' in err) return (err as { statusCode: number }).statusCode;
    }
    return undefined;
  }, []);

  // Retry function with backoff
  const retry = useCallback(async () => {
    if (!onRetry || state.isRetrying) return;

    const newRetryCount = state.retryCount + 1;

    if (newRetryCount > maxRetries) {
      onMaxRetriesExceeded?.(error);
      return;
    }

    setState((prev) => ({ ...prev, isRetrying: true }));

    // Calculate delay with optional exponential backoff
    const delay = exponentialBackoff
      ? retryDelay * Math.pow(2, state.retryCount)
      : retryDelay;

    await new Promise((resolve) => setTimeout(resolve, delay));

    try {
      await onRetry();
      setState({ isRetrying: false, retryCount: 0 });
      onRetrySuccess?.();
    } catch {
      setState({ isRetrying: false, retryCount: newRetryCount });
    }
  }, [
    onRetry,
    state.isRetrying,
    state.retryCount,
    maxRetries,
    retryDelay,
    exponentialBackoff,
    error,
    onMaxRetriesExceeded,
    onRetrySuccess,
  ]);

  // Clear error state
  const clearError = useCallback(() => {
    setState({ isRetrying: false, retryCount: 0 });
  }, []);

  // Reset retry count when error changes
  useEffect(() => {
    if (!error) {
      setState((prev) => ({ ...prev, retryCount: 0 }));
    }
  }, [error]);

  return {
    hasError: !!error,
    message: getMessage(error),
    code: getCode(error),
    error,
    isRetrying: state.isRetrying,
    retryCount: state.retryCount,
    retry,
    clearError,
  };
}

/**
 * Hook for detecting online/offline status
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        // Trigger reconnection logic
        setWasOffline(false);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline]);

  return { isOnline, wasOffline };
}

/**
 * Hook for graceful degradation when offline
 */
export function useOfflineData<T>(
  queryKey: QueryKey,
  fallbackData: T
): { data: T; isStale: boolean } {
  const queryClient = useQueryClient();
  const { isOnline } = useOnlineStatus();

  const cachedData = queryClient.getQueryData<T>(queryKey);
  const queryState = queryClient.getQueryState(queryKey);

  // If online and have fresh data, use it
  if (isOnline && cachedData && !queryState?.isInvalidated) {
    return { data: cachedData, isStale: false };
  }

  // If offline or no data, use cached or fallback
  if (cachedData) {
    return { data: cachedData, isStale: true };
  }

  return { data: fallbackData, isStale: true };
}

/**
 * Categorize errors for appropriate handling
 */
export type ErrorCategory =
  | 'network'
  | 'auth'
  | 'validation'
  | 'notFound'
  | 'serverError'
  | 'timeout'
  | 'unknown';

export function categorizeError(error: unknown): ErrorCategory {
  if (!error) return 'unknown';

  // Check for network errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return 'network';
  }

  if (typeof error === 'object') {
    const err = error as { status?: number; code?: string; message?: string };

    // HTTP status codes
    if (err.status === 401 || err.status === 403) return 'auth';
    if (err.status === 404) return 'notFound';
    if (err.status === 400 || err.status === 422) return 'validation';
    if (err.status && err.status >= 500) return 'serverError';

    // Error codes
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') return 'network';
    if (err.code === 'TIMEOUT' || err.message?.includes('timeout')) return 'timeout';
  }

  return 'unknown';
}

/**
 * Get user-friendly error message based on category
 */
export function getErrorMessage(category: ErrorCategory, originalMessage?: string): string {
  const messages: Record<ErrorCategory, string> = {
    network: 'Unable to connect. Please check your internet connection.',
    auth: 'Your session has expired. Please log in again.',
    validation: originalMessage || 'Please check your input and try again.',
    notFound: 'The requested item could not be found.',
    serverError: 'Something went wrong on our end. Please try again later.',
    timeout: 'The request took too long. Please try again.',
    unknown: originalMessage || 'An unexpected error occurred. Please try again.',
  };

  return messages[category];
}

/**
 * Hook for categorized error handling
 */
export function useCategorizedError(error: unknown): {
  category: ErrorCategory;
  message: string;
  canRetry: boolean;
  shouldRedirect: boolean;
  shouldShowDetails: boolean;
  originalError: unknown;
} {
  const category = categorizeError(error);
  const message = getErrorMessage(category, error instanceof Error ? error.message : undefined);

  const canRetry = ['network', 'serverError', 'timeout', 'unknown'].includes(category);
  const shouldRedirect = category === 'auth';
  const shouldShowDetails = category === 'validation';

  return {
    category,
    message,
    canRetry,
    shouldRedirect,
    shouldShowDetails,
    originalError: error,
  };
}
