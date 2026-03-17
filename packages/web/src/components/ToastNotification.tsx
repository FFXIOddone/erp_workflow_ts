/**
 * Enhanced Toast Notification System
 * 
 * Features:
 * - Multiple toast types with distinct styling
 * - Action buttons with callbacks
 * - Progress indicators for async operations
 * - Stacked presentation with animations
 * - Swipe-to-dismiss on mobile
 * - Keyboard accessible
 * - Screen reader announcements
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, PanInfo, useReducedMotion } from 'framer-motion';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  X,
  Loader2,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useNotificationStore, selectVisibleToasts, ToastNotification, NotificationAction } from '../stores/notifications';

// ============================================================================
// Types
// ============================================================================

interface ToastProps {
  toast: ToastNotification;
  onDismiss: () => void;
  index: number;
  total: number;
}

// ============================================================================
// Styles Configuration
// ============================================================================

const toastStyles = {
  success: {
    container: 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800',
    icon: 'text-emerald-600 dark:text-emerald-400',
    title: 'text-emerald-900 dark:text-emerald-100',
    message: 'text-emerald-700 dark:text-emerald-300',
    progress: 'bg-emerald-500',
    IconComponent: CheckCircle2,
  },
  error: {
    container: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800',
    icon: 'text-red-600 dark:text-red-400',
    title: 'text-red-900 dark:text-red-100',
    message: 'text-red-700 dark:text-red-300',
    progress: 'bg-red-500',
    IconComponent: XCircle,
  },
  warning: {
    container: 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800',
    icon: 'text-amber-600 dark:text-amber-400',
    title: 'text-amber-900 dark:text-amber-100',
    message: 'text-amber-700 dark:text-amber-300',
    progress: 'bg-amber-500',
    IconComponent: AlertTriangle,
  },
  info: {
    container: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800',
    icon: 'text-blue-600 dark:text-blue-400',
    title: 'text-blue-900 dark:text-blue-100',
    message: 'text-blue-700 dark:text-blue-300',
    progress: 'bg-blue-500',
    IconComponent: Info,
  },
};

const actionButtonStyles = {
  primary: 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100',
  secondary: 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700',
  danger: 'bg-red-600 text-white hover:bg-red-700',
};

// ============================================================================
// Single Toast Component
// ============================================================================

function Toast({ toast, onDismiss, index, total }: ToastProps) {
  const prefersReducedMotion = useReducedMotion();
  const [timeRemaining, setTimeRemaining] = useState(toast.duration || 0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const remainingTimeRef = useRef<number>(toast.duration || 0);
  
  const style = toastStyles[toast.type];
  const IconComponent = toast.icon ? () => <>{toast.icon}</> : style.IconComponent;
  
  // Timer management
  useEffect(() => {
    if (!toast.duration || toast.duration === 0 || toast.progress) return;
    
    const startTimer = () => {
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        const remaining = remainingTimeRef.current - elapsed;
        
        if (remaining <= 0) {
          onDismiss();
        } else {
          setTimeRemaining(remaining);
        }
      }, 100);
    };
    
    if (!isPaused) {
      startTimer();
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [toast.duration, toast.progress, isPaused, onDismiss]);
  
  // Pause timer on hover/focus
  const handlePause = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      remainingTimeRef.current = timeRemaining;
    }
    setIsPaused(true);
  }, [timeRemaining]);
  
  const handleResume = useCallback(() => {
    setIsPaused(false);
  }, []);
  
  // Swipe to dismiss
  const handleDragEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    const swipeThreshold = 100;
    if (Math.abs(info.offset.x) > swipeThreshold) {
      onDismiss();
    }
  };
  
  // Handle action click
  const handleActionClick = (action: NotificationAction) => {
    action.onClick();
    if (action.closeOnClick !== false) {
      onDismiss();
    }
  };
  
  // Calculate progress percentage
  const progressPercentage = toast.progress
    ? (toast.progress.current / toast.progress.total) * 100
    : toast.duration && toast.duration > 0
    ? (timeRemaining / toast.duration) * 100
    : 0;
  
  // Stack offset for visual depth
  const stackOffset = Math.min(index, 2) * 8;
  const stackScale = 1 - Math.min(index, 2) * 0.05;
  const stackOpacity = 1 - Math.min(index, 2) * 0.15;
  
  return (
    <motion.div
      layout={!prefersReducedMotion}
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{
        opacity: stackOpacity,
        y: stackOffset,
        scale: stackScale,
        zIndex: total - index,
      }}
      exit={{ opacity: 0, x: 100, transition: { duration: 0.2 } }}
      drag={toast.dismissible ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.5}
      onDragEnd={handleDragEnd}
      onMouseEnter={handlePause}
      onMouseLeave={handleResume}
      onFocus={handlePause}
      onBlur={handleResume}
      role="alert"
      aria-live={toast.priority === 'urgent' ? 'assertive' : 'polite'}
      aria-atomic="true"
      className={clsx(
        'relative w-full max-w-sm overflow-hidden rounded-xl border shadow-lg',
        'backdrop-blur-sm',
        style.container
      )}
      style={{ transformOrigin: 'top center' }}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={clsx('flex-shrink-0', style.icon)}>
            {toast.progress && !toast.progress.label ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <IconComponent className="h-5 w-5" />
            )}
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className={clsx('text-sm font-semibold', style.title)}>
              {toast.title}
            </p>
            
            {toast.message && (
              <p className={clsx('mt-1 text-sm', style.message)}>
                {toast.message}
              </p>
            )}
            
            {/* Progress bar with label */}
            {toast.progress && (
              <div className="mt-2">
                {toast.progress.label && (
                  <p className={clsx('text-xs mb-1', style.message)}>
                    {toast.progress.label}
                  </p>
                )}
                <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <motion.div
                    className={clsx('h-full rounded-full', style.progress)}
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercentage}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <p className={clsx('text-xs mt-1', style.message)}>
                  {toast.progress.current} / {toast.progress.total}
                </p>
              </div>
            )}
            
            {/* Action buttons */}
            {toast.actions && toast.actions.length > 0 && (
              <div className="mt-3 flex gap-2">
                {toast.actions.map((action, actionIndex) => (
                  <button
                    key={actionIndex}
                    onClick={() => handleActionClick(action)}
                    className={clsx(
                      'px-3 py-1.5 text-xs font-medium rounded-lg',
                      'transition-colors duration-150',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                      actionButtonStyles[action.variant || 'secondary']
                    )}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {/* Dismiss button */}
          {toast.dismissible && (
            <button
              onClick={onDismiss}
              className={clsx(
                'flex-shrink-0 p-1 rounded-lg',
                'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300',
                'hover:bg-gray-100 dark:hover:bg-gray-700',
                'transition-colors duration-150',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2'
              )}
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      
      {/* Auto-dismiss progress bar */}
      {toast.duration && toast.duration > 0 && !toast.progress && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200/50 dark:bg-gray-700/50">
          <motion.div
            className={clsx('h-full', style.progress)}
            initial={{ width: '100%' }}
            animate={{ width: `${progressPercentage}%` }}
            transition={{ duration: 0.1 }}
          />
        </div>
      )}
    </motion.div>
  );
}

// ============================================================================
// Toast Container Component
// ============================================================================

interface ToastContainerProps {
  position?: 'top-right' | 'top-left' | 'top-center' | 'bottom-right' | 'bottom-left' | 'bottom-center';
  className?: string;
}

export function ToastContainer({ 
  position = 'top-right',
  className,
}: ToastContainerProps) {
  const toasts = useNotificationStore(selectVisibleToasts);
  const removeToast = useNotificationStore((state) => state.removeToast);
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  if (!mounted) return null;
  
  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'top-center': 'top-4 left-1/2 -translate-x-1/2',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
  };
  
  const container = (
    <div
      className={clsx(
        'fixed z-[9999] flex flex-col gap-2 pointer-events-none',
        'w-full max-w-sm px-4 sm:px-0',
        positionClasses[position],
        className
      )}
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      <AnimatePresence mode="sync">
        {toasts.map((toast, index) => (
          <div key={toast.id} className="pointer-events-auto">
            <Toast
              toast={toast}
              onDismiss={() => removeToast(toast.id)}
              index={index}
              total={toasts.length}
            />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
  
  // Portal to body to avoid z-index issues
  return createPortal(container, document.body);
}

// ============================================================================
// Programmatic Toast API
// ============================================================================

/**
 * Imperative toast API for use outside of React components
 * 
 * @example
 * import { toast } from './ToastNotification';
 * 
 * toast.success('Saved!', 'Your changes have been saved.');
 * toast.error('Error', 'Something went wrong.');
 * 
 * // With actions
 * toast.info('Update available', 'A new version is ready.', {
 *   actions: [
 *     { label: 'Update Now', onClick: () => updateApp(), variant: 'primary' },
 *     { label: 'Later', onClick: () => {}, variant: 'secondary' },
 *   ],
 * });
 * 
 * // With progress
 * const id = toast.info('Uploading...', 'Preparing files');
 * // Update progress
 * toast.updateProgress(id, { current: 50, total: 100, label: 'Uploading files...' });
 */
export const toast = {
  success: (title: string, message?: string, options?: Partial<ToastNotification>) => {
    return useNotificationStore.getState().success(title, message, options);
  },
  
  error: (title: string, message?: string, options?: Partial<ToastNotification>) => {
    return useNotificationStore.getState().error(title, message, options);
  },
  
  warning: (title: string, message?: string, options?: Partial<ToastNotification>) => {
    return useNotificationStore.getState().warning(title, message, options);
  },
  
  info: (title: string, message?: string, options?: Partial<ToastNotification>) => {
    return useNotificationStore.getState().info(title, message, options);
  },
  
  dismiss: (id: string) => {
    useNotificationStore.getState().removeToast(id);
  },
  
  dismissAll: () => {
    useNotificationStore.getState().clearToasts();
  },
  
  updateProgress: (id: string, progress: { current: number; total: number; label?: string }) => {
    useNotificationStore.getState().updateToastProgress(id, progress);
  },
  
  /**
   * Promise-based toast for async operations
   * 
   * @example
   * toast.promise(
   *   saveData(),
   *   {
   *     loading: 'Saving...',
   *     success: 'Saved successfully!',
   *     error: 'Failed to save',
   *   }
   * );
   */
  promise<T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((err: Error) => string);
    }
  ): Promise<T> {
    const id = useNotificationStore.getState().info(messages.loading, undefined, {
      duration: 0,
      dismissible: false,
    });
    
    return promise
      .then((result) => {
        useNotificationStore.getState().removeToast(id);
        const successMessage = typeof messages.success === 'function' 
          ? messages.success(result) 
          : messages.success;
        useNotificationStore.getState().success(successMessage);
        return result;
      })
      .catch((err) => {
        useNotificationStore.getState().removeToast(id);
        const errorMessage = typeof messages.error === 'function'
          ? messages.error(err as Error)
          : messages.error;
        useNotificationStore.getState().error(errorMessage);
        throw err;
      });
  },
};

// ============================================================================
// Default Export
// ============================================================================

export default ToastContainer;
