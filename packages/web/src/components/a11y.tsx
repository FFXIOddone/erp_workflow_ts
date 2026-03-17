/**
 * Accessibility Utilities & Hooks
 * 
 * Comprehensive a11y support for ERP components:
 * - Focus management and trapping
 * - ARIA live region announcements
 * - Keyboard navigation helpers
 * - Screen reader utilities
 * - Accessible form patterns
 * 
 * @example
 * // Focus trapping in modals
 * const trapRef = useFocusTrap(isOpen);
 * 
 * // Screen reader announcements
 * const announce = useAnnounce();
 * announce('Order saved successfully', 'polite');
 */

import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
} from 'react';
import { clsx } from 'clsx';

// ============================================================================
// Types
// ============================================================================

type AriaLive = 'off' | 'polite' | 'assertive';

interface FocusTrapOptions {
  enabled?: boolean;
  autoFocus?: boolean;
  restoreFocus?: boolean;
  initialFocusRef?: React.RefObject<HTMLElement>;
}

interface KeyboardNavOptions {
  orientation?: 'horizontal' | 'vertical' | 'both';
  loop?: boolean;
  homeEnd?: boolean;
}

interface Announcement {
  id: string;
  message: string;
  priority: AriaLive;
  timestamp: number;
}

// ============================================================================
// Focus Trap Hook
// ============================================================================

const FOCUSABLE_SELECTORS = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'a[href]',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(', ');

export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(
  options: FocusTrapOptions = {}
) {
  const {
    enabled = true,
    autoFocus = true,
    restoreFocus = true,
    initialFocusRef,
  } = options;
  
  const containerRef = useRef<T>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  
  // Store the previously focused element
  useEffect(() => {
    if (enabled && restoreFocus) {
      previousFocusRef.current = document.activeElement as HTMLElement;
    }
    
    return () => {
      if (restoreFocus && previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, [enabled, restoreFocus]);
  
  // Focus first element or initialFocusRef
  useEffect(() => {
    if (!enabled || !autoFocus) return;
    
    const container = containerRef.current;
    if (!container) return;
    
    // Use initialFocusRef if provided
    if (initialFocusRef?.current) {
      initialFocusRef.current.focus();
      return;
    }
    
    // Otherwise focus first focusable element
    const focusable = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS);
    if (focusable.length > 0) {
      focusable[0].focus();
    } else {
      // Make container focusable if no focusable elements
      container.setAttribute('tabindex', '-1');
      container.focus();
    }
  }, [enabled, autoFocus, initialFocusRef]);
  
  // Handle tab key to trap focus
  useEffect(() => {
    if (!enabled) return;
    
    const container = containerRef.current;
    if (!container) return;
    
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      
      const focusable = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS);
      if (focusable.length === 0) return;
      
      const firstElement = focusable[0];
      const lastElement = focusable[focusable.length - 1];
      
      if (event.shiftKey) {
        // Shift+Tab: go to last element if on first
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: go to first element if on last
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    };
    
    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [enabled]);
  
  return containerRef;
}

// ============================================================================
// Focus Visible Hook
// ============================================================================

export function useFocusVisible() {
  const [isFocusVisible, setIsFocusVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  
  // Track keyboard vs mouse navigation
  useEffect(() => {
    let hadKeyboardEvent = false;
    
    const handleKeyDown = () => {
      hadKeyboardEvent = true;
    };
    
    const handlePointerDown = () => {
      hadKeyboardEvent = false;
    };
    
    const handleFocus = () => {
      if (hadKeyboardEvent) {
        setIsFocusVisible(true);
      }
      setIsFocused(true);
    };
    
    const handleBlur = () => {
      setIsFocusVisible(false);
      setIsFocused(false);
    };
    
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('pointerdown', handlePointerDown, true);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('pointerdown', handlePointerDown, true);
    };
  }, []);
  
  const focusVisibleProps = useMemo(() => ({
    onFocus: () => setIsFocused(true),
    onBlur: () => {
      setIsFocused(false);
      setIsFocusVisible(false);
    },
  }), []);
  
  return { isFocusVisible, isFocused, focusVisibleProps };
}

// ============================================================================
// Keyboard Navigation Hook
// ============================================================================

export function useRovingTabIndex(
  items: React.RefObject<HTMLElement>[],
  options: KeyboardNavOptions = {}
) {
  const { orientation = 'vertical', loop = true, homeEnd = true } = options;
  const [activeIndex, setActiveIndex] = useState(0);
  
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    const { key } = event;
    const count = items.length;
    let newIndex = activeIndex;
    
    const isVertical = orientation === 'vertical' || orientation === 'both';
    const isHorizontal = orientation === 'horizontal' || orientation === 'both';
    
    if ((key === 'ArrowDown' && isVertical) || (key === 'ArrowRight' && isHorizontal)) {
      event.preventDefault();
      newIndex = loop ? (activeIndex + 1) % count : Math.min(activeIndex + 1, count - 1);
    } else if ((key === 'ArrowUp' && isVertical) || (key === 'ArrowLeft' && isHorizontal)) {
      event.preventDefault();
      newIndex = loop ? (activeIndex - 1 + count) % count : Math.max(activeIndex - 1, 0);
    } else if (key === 'Home' && homeEnd) {
      event.preventDefault();
      newIndex = 0;
    } else if (key === 'End' && homeEnd) {
      event.preventDefault();
      newIndex = count - 1;
    }
    
    if (newIndex !== activeIndex) {
      setActiveIndex(newIndex);
      items[newIndex]?.current?.focus();
    }
  }, [activeIndex, items, orientation, loop, homeEnd]);
  
  const getItemProps = useCallback((index: number) => ({
    tabIndex: index === activeIndex ? 0 : -1,
    onKeyDown: handleKeyDown,
    onClick: () => setActiveIndex(index),
  }), [activeIndex, handleKeyDown]);
  
  return { activeIndex, setActiveIndex, getItemProps };
}

// ============================================================================
// ARIA Live Region Context
// ============================================================================

interface LiveRegionContextValue {
  announce: (message: string, priority?: AriaLive) => void;
  clearAnnouncements: () => void;
}

const LiveRegionContext = createContext<LiveRegionContextValue | null>(null);

export function useLiveRegion() {
  const context = useContext(LiveRegionContext);
  if (!context) {
    throw new Error('useLiveRegion must be used within LiveRegionProvider');
  }
  return context;
}

// Alias for convenience
export const useAnnounce = useLiveRegion;

interface LiveRegionProviderProps {
  children: React.ReactNode;
}

export function LiveRegionProvider({ children }: LiveRegionProviderProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  
  const announce = useCallback((message: string, priority: AriaLive = 'polite') => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setAnnouncements(prev => [...prev, { id, message, priority, timestamp: Date.now() }]);
    
    // Clear announcement after 5 seconds
    setTimeout(() => {
      setAnnouncements(prev => prev.filter(a => a.id !== id));
    }, 5000);
  }, []);
  
  const clearAnnouncements = useCallback(() => {
    setAnnouncements([]);
  }, []);
  
  const politeMessages = announcements
    .filter(a => a.priority === 'polite')
    .map(a => a.message)
    .join('. ');
    
  const assertiveMessages = announcements
    .filter(a => a.priority === 'assertive')
    .map(a => a.message)
    .join('. ');
  
  return (
    <LiveRegionContext.Provider value={{ announce, clearAnnouncements }}>
      {children}
      
      {/* Polite announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {politeMessages}
      </div>
      
      {/* Assertive announcements */}
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      >
        {assertiveMessages}
      </div>
    </LiveRegionContext.Provider>
  );
}

// ============================================================================
// Skip Link Component
// ============================================================================

interface SkipLinkProps {
  href?: string;
  children?: React.ReactNode;
  className?: string;
}

export function SkipLink({
  href = '#main-content',
  children = 'Skip to main content',
  className,
}: SkipLinkProps) {
  return (
    <a
      href={href}
      className={clsx(
        'absolute left-0 top-0 z-[100]',
        'bg-blue-600 text-white px-4 py-2 font-medium',
        'transform -translate-y-full focus:translate-y-0',
        'transition-transform duration-200',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
        className
      )}
    >
      {children}
    </a>
  );
}

// ============================================================================
// Accessible Form Field Wrapper
// ============================================================================

interface FormFieldProps {
  id: string;
  label: string;
  children: React.ReactNode;
  error?: string;
  description?: string;
  required?: boolean;
  className?: string;
}

export function FormField({
  id,
  label,
  children,
  error,
  description,
  required,
  className,
}: FormFieldProps) {
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined;
  
  return (
    <div className={clsx('space-y-1.5', className)}>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        {label}
        {required && (
          <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>
        )}
        {required && <span className="sr-only">(required)</span>}
      </label>
      
      {description && (
        <p
          id={descriptionId}
          className="text-sm text-gray-500 dark:text-gray-400"
        >
          {description}
        </p>
      )}
      
      {/* Clone child to add aria attributes */}
      {React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<any>, {
            id,
            'aria-describedby': describedBy,
            'aria-invalid': error ? 'true' : undefined,
            'aria-required': required,
          });
        }
        return child;
      })}
      
      {error && (
        <p
          id={errorId}
          role="alert"
          className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1"
        >
          <span aria-hidden="true">⚠</span>
          {error}
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Screen Reader Only Component
// ============================================================================

interface ScreenReaderOnlyProps {
  children: React.ReactNode;
  as?: keyof JSX.IntrinsicElements;
}

export function ScreenReaderOnly({
  children,
  as: Component = 'span',
}: ScreenReaderOnlyProps) {
  return (
    <Component className="sr-only">
      {children}
    </Component>
  );
}

// ============================================================================
// Focus Ring Utility
// ============================================================================

export function focusRing(options: { color?: string; offset?: number } = {}) {
  const { color = 'blue', offset = 2 } = options;
  return clsx(
    'focus:outline-none',
    `focus-visible:ring-2 focus-visible:ring-${color}-500`,
    `focus-visible:ring-offset-${offset}`
  );
}

// Standard focus ring classes
export const FOCUS_RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2';
export const FOCUS_RING_INSET = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset';

// ============================================================================
// Accessible Icon Button
// ============================================================================

interface AccessibleIconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon: React.ReactNode;
  tooltipPosition?: 'top' | 'bottom' | 'left' | 'right';
}

export function AccessibleIconButton({
  label,
  icon,
  tooltipPosition = 'top',
  className,
  ...props
}: AccessibleIconButtonProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  
  const tooltipPositionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };
  
  return (
    <button
      {...props}
      aria-label={label}
      className={clsx(
        'relative inline-flex items-center justify-center',
        FOCUS_RING,
        className
      )}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onFocus={() => setShowTooltip(true)}
      onBlur={() => setShowTooltip(false)}
    >
      {icon}
      
      {/* Tooltip */}
      {showTooltip && (
        <span
          role="tooltip"
          className={clsx(
            'absolute px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded shadow-lg whitespace-nowrap z-50',
            tooltipPositionClasses[tooltipPosition]
          )}
        >
          {label}
        </span>
      )}
    </button>
  );
}

// ============================================================================
// Accessible Dialog Wrapper
// ============================================================================

interface AccessibleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function AccessibleDialog({
  isOpen,
  onClose,
  title,
  description,
  children,
  className,
}: AccessibleDialogProps) {
  const trapRef = useFocusTrap<HTMLDivElement>({ enabled: isOpen });
  const titleId = `dialog-title-${title.replace(/\s+/g, '-').toLowerCase()}`;
  const descriptionId = description ? `${titleId}-description` : undefined;
  
  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;
    
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);
  
  // Prevent body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);
  
  if (!isOpen) return null;
  
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="presentation"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Dialog */}
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className={clsx(
          'relative bg-white dark:bg-gray-800 rounded-lg shadow-xl',
          'max-w-lg w-full mx-4 max-h-[90vh] overflow-auto',
          className
        )}
      >
        <h2 id={titleId} className="sr-only">
          {title}
        </h2>
        {description && (
          <p id={descriptionId} className="sr-only">
            {description}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}

// ============================================================================
// Loading Announcer
// ============================================================================

interface LoadingAnnouncerProps {
  isLoading: boolean;
  loadingMessage?: string;
  completedMessage?: string;
}

export function LoadingAnnouncer({
  isLoading,
  loadingMessage = 'Loading...',
  completedMessage = 'Content loaded',
}: LoadingAnnouncerProps) {
  const { announce } = useLiveRegion();
  const wasLoadingRef = useRef(isLoading);
  
  useEffect(() => {
    if (isLoading && !wasLoadingRef.current) {
      announce(loadingMessage, 'polite');
    } else if (!isLoading && wasLoadingRef.current) {
      announce(completedMessage, 'polite');
    }
    wasLoadingRef.current = isLoading;
  }, [isLoading, loadingMessage, completedMessage, announce]);
  
  return null;
}

// ============================================================================
// Export Defaults
// ============================================================================

export default {
  useFocusTrap,
  useFocusVisible,
  useRovingTabIndex,
  useLiveRegion,
  useAnnounce,
  LiveRegionProvider,
  SkipLink,
  FormField,
  ScreenReaderOnly,
  AccessibleIconButton,
  AccessibleDialog,
  LoadingAnnouncer,
  FOCUS_RING,
  FOCUS_RING_INSET,
};
