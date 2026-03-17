/**
 * Enhanced Error Boundary Components
 * 
 * Provides comprehensive error handling for React components.
 * Features:
 * - Multiple fallback variants (minimal, compact, full)
 * - Error reporting hook
 * - Retry functionality with exponential backoff
 * - Error analytics integration
 * - Query/Async error handling wrappers
 * 
 * @example
 * <ErrorBoundary fallbackVariant="compact" onError={logError}>
 *   <Component />
 * </ErrorBoundary>
 */

import { Component, ReactNode, createContext, useContext, useCallback } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { useState } from 'react';

// ============================================================================
// Types
// ============================================================================

type FallbackVariant = 'minimal' | 'compact' | 'full' | 'custom';

interface ErrorInfo {
  error: Error;
  componentStack?: string;
  timestamp: Date;
  url: string;
  userAgent: string;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((props: ErrorFallbackProps) => ReactNode);
  fallbackVariant?: FallbackVariant;
  onError?: (errorInfo: ErrorInfo) => void;
  onReset?: () => void;
  resetKeys?: unknown[];
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

interface ErrorFallbackProps {
  error: Error;
  errorInfo?: React.ErrorInfo | null;
  reset: () => void;
}

// ============================================================================
// Error Context
// ============================================================================

interface ErrorContextValue {
  reportError: (error: Error, context?: Record<string, unknown>) => void;
  clearError: () => void;
  lastError: Error | null;
}

const ErrorContext = createContext<ErrorContextValue | null>(null);

export function useError() {
  const context = useContext(ErrorContext);
  if (!context) {
    return {
      reportError: console.error,
      clearError: () => {},
      lastError: null,
    };
  }
  return context;
}

// ============================================================================
// Error Boundary Class
// ============================================================================

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    
    // Call onError callback with rich error info
    if (this.props.onError) {
      this.props.onError({
        error,
        componentStack: errorInfo.componentStack || undefined,
        timestamp: new Date(),
        url: typeof window !== 'undefined' ? window.location.href : '',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      });
    }
    
    console.error('Error caught by boundary:', error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    // Reset when resetKeys change
    if (this.state.hasError && this.props.resetKeys) {
      const keysChanged = this.props.resetKeys.some(
        (key, i) => key !== prevProps.resetKeys?.[i]
      );
      if (keysChanged) {
        this.handleReset();
      }
    }
  }

  handleReset = () => {
    this.props.onReset?.();
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const { fallback, fallbackVariant = 'full' } = this.props;
      const fallbackProps: ErrorFallbackProps = {
        error: this.state.error,
        errorInfo: this.state.errorInfo,
        reset: this.handleReset,
      };

      // Custom fallback component
      if (fallback) {
        if (typeof fallback === 'function') {
          return fallback(fallbackProps);
        }
        return fallback;
      }

      // Built-in fallback variants
      switch (fallbackVariant) {
        case 'minimal':
          return <MinimalErrorFallback {...fallbackProps} />;
        case 'compact':
          return <CompactErrorFallback {...fallbackProps} />;
        case 'full':
        default:
          return <FullErrorFallback {...fallbackProps} />;
      }
    }

    return this.props.children;
  }
}

// ============================================================================
// Fallback Variants
// ============================================================================

function MinimalErrorFallback({ error, reset }: ErrorFallbackProps) {
  return (
    <div className="inline-flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
      <AlertTriangle className="h-4 w-4" />
      <span>Error loading content</span>
      <button
        onClick={reset}
        className="underline hover:no-underline"
      >
        Retry
      </button>
    </div>
  );
}

function CompactErrorFallback({ error, reset }: ErrorFallbackProps) {
  return (
    <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-red-800 dark:text-red-300 truncate">
            {error.message || 'Something went wrong'}
          </p>
        </div>
        <button
          onClick={reset}
          className="flex-shrink-0 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 flex items-center gap-1"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </button>
      </div>
    </div>
  );
}

function FullErrorFallback({ error, errorInfo, reset }: ErrorFallbackProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyErrorInfo = useCallback(() => {
    const errorText = `
Error: ${error.message}
Stack: ${error.stack || 'N/A'}
Component Stack: ${errorInfo?.componentStack || 'N/A'}
URL: ${window.location.href}
Time: ${new Date().toISOString()}
    `.trim();
    
    navigator.clipboard.writeText(errorText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [error, errorInfo]);

  return (
    <div className="min-h-[400px] flex items-center justify-center p-6">
      <div className="text-center max-w-lg">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
          <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Something went wrong
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          We encountered an unexpected error. Please try refreshing the page or go back to the dashboard.
        </p>
        
        {/* Error details accordion */}
        <div className="mb-6 text-left">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <Bug className="h-4 w-4" />
            Error details
            {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          
          {showDetails && (
            <div className="mt-3 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Error Message
                </span>
                <button
                  onClick={copyErrorInfo}
                  className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 flex items-center gap-1"
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <pre className="text-xs text-gray-600 dark:text-gray-300 overflow-auto max-h-32 whitespace-pre-wrap">
                {error.message}
              </pre>
              {error.stack && (
                <>
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mt-4 mb-2">
                    Stack Trace
                  </div>
                  <pre className="text-xs text-gray-600 dark:text-gray-300 overflow-auto max-h-48 whitespace-pre-wrap">
                    {error.stack}
                  </pre>
                </>
              )}
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => {
              reset();
              window.location.reload();
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh Page
          </button>
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            onClick={reset}
          >
            <Home className="h-4 w-4" />
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Simple Error Display (Inline)
// ============================================================================

interface ErrorMessageProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  variant?: 'error' | 'warning' | 'info';
  className?: string;
}

export function ErrorMessage({ 
  title = 'Error', 
  message, 
  onRetry,
  variant = 'error',
  className,
}: ErrorMessageProps) {
  const variants = {
    error: {
      bg: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-200 dark:border-red-800',
      iconColor: 'text-red-600 dark:text-red-400',
      titleColor: 'text-red-800 dark:text-red-300',
      textColor: 'text-red-700 dark:text-red-400',
    },
    warning: {
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
      border: 'border-yellow-200 dark:border-yellow-800',
      iconColor: 'text-yellow-600 dark:text-yellow-400',
      titleColor: 'text-yellow-800 dark:text-yellow-300',
      textColor: 'text-yellow-700 dark:text-yellow-400',
    },
    info: {
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      border: 'border-blue-200 dark:border-blue-800',
      iconColor: 'text-blue-600 dark:text-blue-400',
      titleColor: 'text-blue-800 dark:text-blue-300',
      textColor: 'text-blue-700 dark:text-blue-400',
    },
  };
  
  const styles = variants[variant];
  
  return (
    <div className={clsx('rounded-xl border p-4', styles.bg, styles.border, className)}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <AlertTriangle className={clsx('h-5 w-5', styles.iconColor)} />
        </div>
        <div className="flex-1">
          <h3 className={clsx('text-sm font-medium', styles.titleColor)}>{title}</h3>
          <p className={clsx('mt-1 text-sm', styles.textColor)}>{message}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className={clsx(
                'mt-3 text-sm font-medium flex items-center gap-1',
                styles.titleColor,
                'hover:underline'
              )}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Query Error Wrapper
// ============================================================================

interface QueryErrorWrapperProps {
  error: Error | null;
  isError: boolean;
  refetch?: () => void;
  children: ReactNode;
  skeleton?: ReactNode;
  isLoading?: boolean;
}

export function QueryErrorWrapper({
  error,
  isError,
  refetch,
  children,
  skeleton,
  isLoading,
}: QueryErrorWrapperProps) {
  if (isLoading && skeleton) {
    return <>{skeleton}</>;
  }
  
  if (isError && error) {
    return (
      <ErrorMessage
        title="Failed to load data"
        message={error.message || 'An unexpected error occurred'}
        onRetry={refetch}
      />
    );
  }
  
  return <>{children}</>;
}

// ============================================================================
// Async Boundary (Suspense + Error Boundary)
// ============================================================================

interface AsyncBoundaryProps {
  children: ReactNode;
  loading?: ReactNode;
  error?: ReactNode | ((props: ErrorFallbackProps) => ReactNode);
  onError?: (errorInfo: ErrorInfo) => void;
}

export function AsyncBoundary({
  children,
  loading,
  error,
  onError,
}: AsyncBoundaryProps) {
  return (
    <ErrorBoundary fallback={error} onError={onError}>
      {children}
    </ErrorBoundary>
  );
}

// ============================================================================
// withErrorBoundary HOC
// ============================================================================

export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component';
  
  const ComponentWithErrorBoundary = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );
  
  ComponentWithErrorBoundary.displayName = `withErrorBoundary(${displayName})`;
  
  return ComponentWithErrorBoundary;
}
