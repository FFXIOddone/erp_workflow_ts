import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * Get all focusable elements within a container
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]',
  ];

  const elements = container.querySelectorAll<HTMLElement>(focusableSelectors.join(', '));
  return Array.from(elements).filter((el) => {
    // Check if element is visible
    const style = window.getComputedStyle(el);
    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      el.offsetParent !== null
    );
  });
}

/**
 * Options for focus trap behavior
 */
export interface FocusTrapOptions {
  /** Element to focus on activation (defaults to first focusable) */
  initialFocus?: HTMLElement | null;
  /** Element to focus on deactivation */
  returnFocus?: HTMLElement | null;
  /** Whether to auto-focus on mount */
  autoFocus?: boolean;
  /** Whether the trap is active */
  active?: boolean;
  /** Callback when escape is pressed */
  onEscape?: () => void;
  /** Allow focus to leave the trap temporarily (e.g., for nested modals) */
  allowOutsideClick?: boolean;
}

/**
 * Hook to trap focus within a container element.
 * Essential for modal dialogs, dropdown menus, and other overlay components.
 *
 * @example
 * ```tsx
 * function Modal({ isOpen, onClose, children }) {
 *   const containerRef = useFocusTrap<HTMLDivElement>({
 *     active: isOpen,
 *     onEscape: onClose,
 *   });
 *
 *   return isOpen ? (
 *     <div ref={containerRef} role="dialog" aria-modal="true">
 *       {children}
 *     </div>
 *   ) : null;
 * }
 * ```
 */
export function useFocusTrap<T extends HTMLElement>(
  options: FocusTrapOptions = {}
): React.RefObject<T> {
  const {
    initialFocus,
    returnFocus,
    autoFocus = true,
    active = true,
    onEscape,
    allowOutsideClick = false,
  } = options;

  const containerRef = useRef<T>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Store the element that had focus before trap activation
  useEffect(() => {
    if (active) {
      previousFocusRef.current = document.activeElement as HTMLElement;
    }
  }, [active]);

  // Handle initial focus
  useEffect(() => {
    if (!active || !autoFocus) return;

    const container = containerRef.current;
    if (!container) return;

    // Small delay to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      if (initialFocus && container.contains(initialFocus)) {
        initialFocus.focus();
      } else {
        const focusableElements = getFocusableElements(container);
        if (focusableElements.length > 0) {
          focusableElements[0].focus();
        } else {
          // If no focusable elements, make container focusable
          container.setAttribute('tabindex', '-1');
          container.focus();
        }
      }
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [active, autoFocus, initialFocus]);

  // Handle return focus on deactivation
  useEffect(() => {
    if (active) return;

    const focusTarget = returnFocus || previousFocusRef.current;
    if (focusTarget && typeof focusTarget.focus === 'function') {
      focusTarget.focus();
    }
  }, [active, returnFocus]);

  // Handle keyboard events
  useEffect(() => {
    if (!active) return;

    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onEscape?.();
        return;
      }

      if (e.key !== 'Tab') return;

      const focusableElements = getFocusableElements(container);
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      // Shift + Tab on first element -> go to last
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
      // Tab on last element -> go to first
      else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [active, onEscape]);

  // Handle clicks outside the container
  useEffect(() => {
    if (!active || allowOutsideClick) return;

    const container = containerRef.current;
    if (!container) return;

    const handleFocusIn = (e: FocusEvent) => {
      if (!container.contains(e.target as Node)) {
        e.stopPropagation();
        const focusableElements = getFocusableElements(container);
        if (focusableElements.length > 0) {
          focusableElements[0].focus();
        }
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (!container.contains(e.target as Node)) {
        e.preventDefault();
      }
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [active, allowOutsideClick]);

  return containerRef;
}

/**
 * Component wrapper for focus trapping
 */
interface FocusTrapProps {
  /** Whether the trap is active */
  active?: boolean;
  /** Callback when escape is pressed */
  onEscape?: () => void;
  /** Children to render */
  children: React.ReactNode;
  /** Additional class name */
  className?: string;
  /** Auto-focus on activation */
  autoFocus?: boolean;
  /** HTML element to render as */
  as?: keyof JSX.IntrinsicElements;
}

export function FocusTrap({
  active = true,
  onEscape,
  children,
  className,
  autoFocus = true,
  as: Component = 'div',
}: FocusTrapProps) {
  const ref = useFocusTrap<HTMLDivElement>({ active, onEscape, autoFocus });

  return (
    // @ts-ignore - Dynamic component type
    <Component ref={ref} className={className}>
      {children}
    </Component>
  );
}

/**
 * Hook to manage focus when navigating between sections
 * Useful for SPA route changes
 */
export function useFocusOnMount<T extends HTMLElement>(): React.RefObject<T> {
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;
    if (element) {
      // Make it focusable if not already
      if (!element.getAttribute('tabindex')) {
        element.setAttribute('tabindex', '-1');
      }
      element.focus();

      // Announce to screen readers
      element.setAttribute('aria-live', 'polite');
    }
  }, []);

  return ref;
}

/**
 * Hook to restore focus when a component unmounts
 */
export function useRestoreFocus() {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;

    return () => {
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus();
      }
    };
  }, []);
}

/**
 * Hook to detect when focus leaves an element
 */
export function useFocusLeave(
  onFocusLeave: () => void
): React.RefObject<HTMLDivElement> {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleFocusOut = (e: FocusEvent) => {
      // Check if the new focus target is outside the container
      if (!container.contains(e.relatedTarget as Node)) {
        onFocusLeave();
      }
    };

    container.addEventListener('focusout', handleFocusOut);
    return () => container.removeEventListener('focusout', handleFocusOut);
  }, [onFocusLeave]);

  return containerRef;
}

/**
 * Hook for managing focus within a dialog or modal
 */
export function useDialogFocus(
  isOpen: boolean,
  options: {
    onClose?: () => void;
    initialFocusRef?: React.RefObject<HTMLElement>;
    finalFocusRef?: React.RefObject<HTMLElement>;
  } = {}
) {
  const { onClose, initialFocusRef, finalFocusRef } = options;
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;

      // Focus initial element or first focusable
      setTimeout(() => {
        if (initialFocusRef?.current) {
          initialFocusRef.current.focus();
        } else if (dialogRef.current) {
          const focusable = getFocusableElements(dialogRef.current);
          if (focusable.length > 0) {
            focusable[0].focus();
          } else {
            dialogRef.current.focus();
          }
        }
      }, 0);
    } else {
      // Restore focus
      const target = finalFocusRef?.current || previousFocusRef.current;
      if (target) {
        target.focus();
      }
    }
  }, [isOpen, initialFocusRef, finalFocusRef]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
        return;
      }

      if (e.key !== 'Tab' || !dialogRef.current) return;

      const focusable = getFocusableElements(dialogRef.current);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose]
  );

  return {
    dialogRef,
    handleKeyDown,
    dialogProps: {
      ref: dialogRef,
      onKeyDown: handleKeyDown,
      role: 'dialog' as const,
      'aria-modal': true as const,
      tabIndex: -1,
    },
  };
}
