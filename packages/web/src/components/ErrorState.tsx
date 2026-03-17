import React from 'react';
import { AlertTriangle, WifiOff, Lock, Search, ServerCrash, Clock, RefreshCw, Home, ArrowLeft } from 'lucide-react';
import { ErrorCategory, useCategorizedError } from '../hooks/useErrorState';

/**
 * Props for the ErrorState component
 */
export interface ErrorStateProps {
  /** The error to display */
  error: unknown;
  /** Custom title override */
  title?: string;
  /** Custom message override */
  message?: string;
  /** Handler for retry action */
  onRetry?: () => void;
  /** Whether a retry is in progress */
  isRetrying?: boolean;
  /** Handler for go back action */
  onGoBack?: () => void;
  /** Handler for go home action */
  onGoHome?: () => void;
  /** Additional actions to render */
  children?: React.ReactNode;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show detailed error info (dev mode) */
  showDetails?: boolean;
}

/**
 * Icon mapping for error categories
 */
const errorIcons: Record<ErrorCategory, React.ComponentType<{ className?: string }>> = {
  network: WifiOff,
  auth: Lock,
  validation: AlertTriangle,
  notFound: Search,
  serverError: ServerCrash,
  timeout: Clock,
  unknown: AlertTriangle,
};

/**
 * Default titles for error categories
 */
const errorTitles: Record<ErrorCategory, string> = {
  network: 'Connection Problem',
  auth: 'Authentication Required',
  validation: 'Invalid Input',
  notFound: 'Not Found',
  serverError: 'Server Error',
  timeout: 'Request Timeout',
  unknown: 'Something Went Wrong',
};

/**
 * Size styles
 */
interface SizeStyle {
  container: string;
  icon: string;
  title: string;
  message: string;
  button: string;
}

const sizeStyles: Record<'sm' | 'md' | 'lg', SizeStyle> = {
  sm: {
    container: 'p-4',
    icon: 'w-8 h-8',
    title: 'text-base font-medium',
    message: 'text-sm',
    button: 'px-3 py-1.5 text-sm',
  },
  md: {
    container: 'p-6',
    icon: 'w-12 h-12',
    title: 'text-lg font-semibold',
    message: 'text-base',
    button: 'px-4 py-2 text-sm',
  },
  lg: {
    container: 'p-8',
    icon: 'w-16 h-16',
    title: 'text-xl font-bold',
    message: 'text-base',
    button: 'px-5 py-2.5 text-base',
  },
};

/**
 * ErrorState - A comprehensive error display component
 *
 * Displays user-friendly error messages with appropriate icons,
 * retry buttons, and navigation options based on error category.
 *
 * @example
 * ```tsx
 * function OrdersList() {
 *   const { data, error, refetch, isRefetching } = useQuery({...});
 *   
 *   if (error) {
 *     return (
 *       <ErrorState
 *         error={error}
 *         onRetry={refetch}
 *         isRetrying={isRefetching}
 *       />
 *     );
 *   }
 *   
 *   return <OrdersTable data={data} />;
 * }
 * ```
 */
export function ErrorState({
  error,
  title,
  message,
  onRetry,
  isRetrying = false,
  onGoBack,
  onGoHome,
  children,
  size = 'md',
  showDetails = false,
}: ErrorStateProps) {
  const { category, message: defaultMessage, canRetry } = useCategorizedError(error);

  const Icon = errorIcons[category];
  const displayTitle: string = title || errorTitles[category];
  const displayMessage: string = message || defaultMessage;
  const styles: SizeStyle = sizeStyles[size];

  // Get color based on category
  const getColorClasses = () => {
    switch (category) {
      case 'auth':
        return 'text-amber-500 bg-amber-50 dark:bg-amber-900/20';
      case 'notFound':
        return 'text-blue-500 bg-blue-50 dark:bg-blue-900/20';
      case 'validation':
        return 'text-orange-500 bg-orange-50 dark:bg-orange-900/20';
      case 'serverError':
      case 'network':
      case 'timeout':
        return 'text-red-500 bg-red-50 dark:bg-red-900/20';
      default:
        return 'text-gray-500 bg-gray-50 dark:bg-gray-900/20';
    }
  };

  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${styles.container}`}
      role="alert"
      aria-live="polite"
    >
      {/* Icon */}
      <div className={`rounded-full p-4 mb-4 ${getColorClasses()}`}>
        <Icon className={styles.icon} aria-hidden="true" />
      </div>

      {/* Title */}
      <h2 className={`text-gray-900 dark:text-gray-100 ${styles.title}`}>
        {displayTitle}
      </h2>

      {/* Message */}
      <p className={`text-gray-600 dark:text-gray-400 mt-2 max-w-md ${styles.message}`}>
        {displayMessage}
      </p>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
        {onRetry && canRetry && (
          <button
            onClick={onRetry}
            disabled={isRetrying}
            className={`inline-flex items-center gap-2 bg-blue-600 text-white rounded-lg 
                       hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors ${styles.button}`}
            aria-label={isRetrying ? 'Retrying...' : 'Retry'}
          >
            <RefreshCw
              className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            {isRetrying ? 'Retrying...' : 'Try Again'}
          </button>
        )}

        {onGoBack && (
          <button
            onClick={onGoBack}
            className={`inline-flex items-center gap-2 bg-gray-100 text-gray-700
                       dark:bg-gray-800 dark:text-gray-300
                       rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700
                       focus:ring-2 focus:ring-gray-500 focus:ring-offset-2
                       transition-colors ${styles.button}`}
            aria-label="Go back"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Go Back
          </button>
        )}

        {onGoHome && (
          <button
            onClick={onGoHome}
            className={`inline-flex items-center gap-2 bg-gray-100 text-gray-700
                       dark:bg-gray-800 dark:text-gray-300
                       rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700
                       focus:ring-2 focus:ring-gray-500 focus:ring-offset-2
                       transition-colors ${styles.button}`}
            aria-label="Go to home page"
          >
            <Home className="w-4 h-4" aria-hidden="true" />
            Go Home
          </button>
        )}
      </div>

      {/* Custom Actions */}
      {children && <div className="mt-4">{children}</div>}

      {/* Debug Details */}
      {showDetails && !!error && (
        <details className="mt-6 text-left w-full max-w-lg">
          <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            Technical Details
          </summary>
          <pre className="mt-2 p-3 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-auto">
            {error instanceof Error
              ? `${error.name}: ${error.message}\n\n${error.stack}`
              : JSON.stringify(error, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}

/**
 * Inline error message for form fields and smaller contexts
 */
export interface InlineErrorProps {
  message: string;
  className?: string;
}

export function InlineError({ message, className = '' }: InlineErrorProps) {
  return (
    <p
      className={`flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400 ${className}`}
      role="alert"
    >
      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}

/**
 * Error banner for page-level errors that don't block content
 */
export interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
  onRetry?: () => void;
  isRetrying?: boolean;
}

export function ErrorBanner({ message, onDismiss, onRetry, isRetrying }: ErrorBannerProps) {
  return (
    <div
      className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 
                 rounded-lg p-4 flex items-center gap-4"
      role="alert"
    >
      <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" aria-hidden="true" />
      <p className="flex-1 text-sm text-red-700 dark:text-red-300">{message}</p>
      <div className="flex items-center gap-2">
        {onRetry && (
          <button
            onClick={onRetry}
            disabled={isRetrying}
            className="text-sm font-medium text-red-600 dark:text-red-400 
                       hover:text-red-800 dark:hover:text-red-200
                       disabled:opacity-50"
          >
            {isRetrying ? 'Retrying...' : 'Retry'}
          </button>
        )}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            aria-label="Dismiss error"
          >
            <span aria-hidden="true">&times;</span>
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Offline indicator banner
 */
export interface OfflineBannerProps {
  onRetry?: () => void;
}

export function OfflineBanner({ onRetry }: OfflineBannerProps) {
  return (
    <div
      className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800
                 rounded-lg p-4 flex items-center gap-4"
      role="status"
      aria-live="polite"
    >
      <WifiOff className="w-5 h-5 text-yellow-600 flex-shrink-0" aria-hidden="true" />
      <div className="flex-1">
        <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
          You're offline
        </p>
        <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-0.5">
          Some features may be unavailable. Data shown may be outdated.
        </p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-sm font-medium text-yellow-700 dark:text-yellow-300
                     hover:text-yellow-900 dark:hover:text-yellow-100"
        >
          Retry
        </button>
      )}
    </div>
  );
}

/**
 * Empty state with optional error context
 */
export interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon: Icon = Search, title, message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8">
      <div className="rounded-full p-4 bg-gray-100 dark:bg-gray-800 mb-4">
        <Icon className="w-8 h-8 text-gray-400" aria-hidden="true" />
      </div>
      <h3 className="text-base font-medium text-gray-900 dark:text-gray-100">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-sm">{message}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg
                     hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                     text-sm font-medium transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

/**
 * 404 Not Found page component
 */
export function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <ErrorState
        error={{ status: 404 }}
        title="Page Not Found"
        message="The page you're looking for doesn't exist or has been moved."
        onGoHome={() => (window.location.href = '/')}
        onGoBack={() => window.history.back()}
        size="lg"
      />
    </div>
  );
}
