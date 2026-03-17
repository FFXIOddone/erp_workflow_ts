/**
 * Portal.tsx - CRITICAL-19
 * 
 * Portal and overlay management system for the ERP application.
 * Provides consistent rendering of modals, dropdowns, tooltips, and
 * other overlay content with proper stacking context management.
 * 
 * Features:
 * - 19.1: Portal component with container management
 * - 19.2: StackingContext for z-index management
 * - 19.3: Overlay backdrop with animations
 * - 19.4: Focus trap integration
 * - 19.5: Escape key and click-outside handling
 * 
 * @module Portal
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
  type MouseEvent,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import { X } from 'lucide-react';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/** Portal container type */
export type PortalContainer = 'modals' | 'dropdowns' | 'tooltips' | 'notifications' | 'custom';

/** Z-index levels for stacking */
export const Z_INDEX = {
  base: 0,
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  backdrop: 1040,
  modal: 1050,
  popover: 1060,
  tooltip: 1070,
  notification: 1080,
  max: 9999,
} as const;

/** Stacking context entry */
export interface StackEntry {
  id: string;
  zIndex: number;
  type: PortalContainer;
  onClose?: () => void;
}

/** Stacking context value */
export interface StackingContextValue {
  /** All active stacks */
  stacks: StackEntry[];
  /** Register a new stack entry */
  register: (id: string, type: PortalContainer, onClose?: () => void) => number;
  /** Unregister a stack entry */
  unregister: (id: string) => void;
  /** Get the topmost entry */
  getTop: () => StackEntry | undefined;
  /** Check if an entry is on top */
  isTop: (id: string) => boolean;
  /** Close the topmost entry */
  closeTop: () => void;
}

/** Portal props */
export interface PortalProps {
  children: ReactNode;
  /** Container type for the portal */
  container?: PortalContainer;
  /** Custom container ID */
  containerId?: string;
  /** Whether to create container if it doesn't exist */
  createContainer?: boolean;
  /** Disable the portal (render in place) */
  disabled?: boolean;
}

/** Overlay props */
export interface OverlayProps {
  /** Whether the overlay is open */
  open: boolean;
  /** Callback when overlay should close */
  onClose: () => void;
  /** Overlay content */
  children: ReactNode;
  /** Show backdrop */
  backdrop?: boolean | 'blur';
  /** Backdrop click closes overlay */
  closeOnBackdropClick?: boolean;
  /** Escape key closes overlay */
  closeOnEscape?: boolean;
  /** Lock body scroll when open */
  lockScroll?: boolean;
  /** Animation duration in ms */
  animationDuration?: number;
  /** Portal container type */
  container?: PortalContainer;
  /** Additional backdrop class */
  backdropClassName?: string;
  /** Additional content class */
  contentClassName?: string;
  /** z-index override */
  zIndex?: number;
  /** Center content */
  centered?: boolean;
  /** Trap focus inside overlay */
  trapFocus?: boolean;
  /** Return focus on close */
  returnFocus?: boolean;
  /** ID for accessibility */
  id?: string;
  /** Aria label */
  ariaLabel?: string;
  /** Aria labelledby */
  ariaLabelledby?: string;
  /** Aria describedby */
  ariaDescribedby?: string;
  /** Role (dialog, alertdialog, etc.) */
  role?: 'dialog' | 'alertdialog' | 'menu' | 'listbox';
}

/** Modal props (extends Overlay) */
export interface ModalProps extends Omit<OverlayProps, 'role'> {
  /** Modal size */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** Show close button */
  showCloseButton?: boolean;
  /** Modal title */
  title?: ReactNode;
  /** Modal footer */
  footer?: ReactNode;
  /** Alert dialog (prevents outside click) */
  alert?: boolean;
}

/** Drawer props */
export interface DrawerProps extends Omit<OverlayProps, 'centered'> {
  /** Side the drawer appears from */
  side?: 'left' | 'right' | 'top' | 'bottom';
  /** Drawer size */
  size?: 'sm' | 'md' | 'lg' | 'full';
  /** Show close button */
  showCloseButton?: boolean;
  /** Drawer title */
  title?: ReactNode;
}

// ============================================================================
// STACKING CONTEXT
// ============================================================================

const StackingContext = createContext<StackingContextValue | null>(null);

/**
 * Hook to access stacking context
 */
export function useStackingContext(): StackingContextValue {
  const context = useContext(StackingContext);
  if (!context) {
    throw new Error('useStackingContext must be used within StackingProvider');
  }
  return context;
}

/**
 * Provider for managing overlay stacking
 * 
 * @example
 * ```tsx
 * <StackingProvider>
 *   <App />
 * </StackingProvider>
 * ```
 */
export function StackingProvider({ children }: { children: ReactNode }) {
  const [stacks, setStacks] = useState<StackEntry[]>([]);

  const getBaseZIndex = useCallback((type: PortalContainer): number => {
    switch (type) {
      case 'tooltips':
        return Z_INDEX.tooltip;
      case 'dropdowns':
        return Z_INDEX.popover;
      case 'modals':
        return Z_INDEX.modal;
      case 'notifications':
        return Z_INDEX.notification;
      default:
        return Z_INDEX.modal;
    }
  }, []);

  const register = useCallback(
    (id: string, type: PortalContainer, onClose?: () => void): number => {
      const baseZ = getBaseZIndex(type);
      
      // Find existing entries of the same type and calculate offset
      let newZIndex = baseZ;
      setStacks((prev) => {
        const sameType = prev.filter((s) => s.type === type);
        const maxZ = sameType.reduce((max, s) => Math.max(max, s.zIndex), baseZ - 1);
        newZIndex = maxZ + 1;

        return [...prev, { id, zIndex: newZIndex, type, onClose }];
      });

      return newZIndex;
    },
    [getBaseZIndex]
  );

  const unregister = useCallback((id: string) => {
    setStacks((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const getTop = useCallback((): StackEntry | undefined => {
    if (stacks.length === 0) return undefined;
    return stacks.reduce((top, entry) => (entry.zIndex > top.zIndex ? entry : top));
  }, [stacks]);

  const isTop = useCallback(
    (id: string): boolean => {
      const top = getTop();
      return top?.id === id;
    },
    [getTop]
  );

  const closeTop = useCallback(() => {
    const top = getTop();
    top?.onClose?.();
  }, [getTop]);

  // Global escape key handler
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && stacks.length > 0) {
        const top = getTop();
        if (top?.onClose) {
          e.preventDefault();
          e.stopPropagation();
          top.onClose();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [stacks, getTop]);

  const value = useMemo<StackingContextValue>(
    () => ({
      stacks,
      register,
      unregister,
      getTop,
      isTop,
      closeTop,
    }),
    [stacks, register, unregister, getTop, isTop, closeTop]
  );

  return (
    <StackingContext.Provider value={value}>
      {children}
    </StackingContext.Provider>
  );
}

// ============================================================================
// 19.1: PORTAL COMPONENT
// ============================================================================

/** Generate a unique ID */
function generateId(): string {
  return `portal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/** Get or create a container element */
function getOrCreateContainer(containerId: string, create: boolean): HTMLElement | null {
  if (typeof document === 'undefined') return null;

  let container = document.getElementById(containerId);
  
  if (!container && create) {
    container = document.createElement('div');
    container.id = containerId;
    container.setAttribute('data-portal-container', 'true');
    document.body.appendChild(container);
  }

  return container;
}

/**
 * Portal component for rendering content outside the DOM hierarchy
 * 
 * @example
 * ```tsx
 * <Portal container="modals">
 *   <div className="modal">Modal content</div>
 * </Portal>
 * ```
 */
export function Portal({
  children,
  container = 'custom',
  containerId,
  createContainer = true,
  disabled = false,
}: PortalProps) {
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
    
    const id = containerId || `portal-${container}`;
    containerRef.current = getOrCreateContainer(id, createContainer);

    return () => {
      // Clean up empty containers
      if (containerRef.current && containerRef.current.childNodes.length === 0) {
        const parent = containerRef.current.parentElement;
        if (parent && containerRef.current.hasAttribute('data-portal-container')) {
          // Only remove auto-created containers
          // parent.removeChild(containerRef.current);
        }
      }
    };
  }, [container, containerId, createContainer]);

  if (disabled || !mounted || !containerRef.current) {
    return <>{children}</>;
  }

  return createPortal(children, containerRef.current);
}

// ============================================================================
// 19.3: OVERLAY COMPONENT
// ============================================================================

/**
 * Overlay component with backdrop, animations, and accessibility
 * 
 * @example
 * ```tsx
 * <Overlay
 *   open={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   backdrop="blur"
 *   centered
 * >
 *   <div className="bg-white p-6 rounded-lg">Content</div>
 * </Overlay>
 * ```
 */
export function Overlay({
  open,
  onClose,
  children,
  backdrop = true,
  closeOnBackdropClick = true,
  closeOnEscape = true,
  lockScroll = true,
  animationDuration = 200,
  container = 'modals',
  backdropClassName,
  contentClassName,
  zIndex: zIndexProp,
  centered = true,
  trapFocus = true,
  returnFocus = true,
  id,
  ariaLabel,
  ariaLabelledby,
  ariaDescribedby,
  role = 'dialog',
}: OverlayProps) {
  const overlayId = useRef(id || generateId());
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Try to use stacking context, fallback to prop or default
  let stackingContext: StackingContextValue | null = null;
  try {
    stackingContext = useStackingContext();
  } catch {
    // Not in a StackingProvider, use fallback
  }

  const [zIndex, setZIndex] = useState(zIndexProp || Z_INDEX.modal);

  // Register with stacking context
  useEffect(() => {
    if (!open || !stackingContext) return;

    const newZIndex = stackingContext.register(
      overlayId.current,
      container,
      closeOnEscape ? onClose : undefined
    );
    setZIndex(newZIndex);

    return () => {
      stackingContext.unregister(overlayId.current);
    };
  }, [open, stackingContext, container, closeOnEscape, onClose]);

  // Handle open/close animations
  useEffect(() => {
    if (open) {
      setIsAnimating(true);
      // Small delay to ensure portal is mounted
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    } else {
      setIsVisible(false);
      const timeout = setTimeout(() => {
        setIsAnimating(false);
      }, animationDuration);
      return () => clearTimeout(timeout);
    }
  }, [open, animationDuration]);

  // Lock body scroll
  useEffect(() => {
    if (!lockScroll || !open) return;

    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    
    // Calculate scrollbar width
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, [open, lockScroll]);

  // Focus management
  useEffect(() => {
    if (!open || !trapFocus) return;

    previousActiveElement.current = document.activeElement as HTMLElement;

    // Focus first focusable element
    const focusFirst = () => {
      const focusable = contentRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable && focusable.length > 0) {
        focusable[0].focus();
      } else {
        contentRef.current?.focus();
      }
    };

    // Small delay to ensure content is rendered
    requestAnimationFrame(focusFirst);

    return () => {
      if (returnFocus && previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [open, trapFocus, returnFocus]);

  // Focus trap
  useEffect(() => {
    if (!open || !trapFocus) return;

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusable = contentRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      if (!focusable || focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, trapFocus]);

  // Escape key handling (when not using stacking context)
  useEffect(() => {
    if (!open || !closeOnEscape || stackingContext) return;

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, closeOnEscape, onClose, stackingContext]);

  const handleBackdropClick = useCallback(
    (e: MouseEvent) => {
      if (closeOnBackdropClick && e.target === e.currentTarget) {
        onClose();
      }
    },
    [closeOnBackdropClick, onClose]
  );

  if (!open && !isAnimating) {
    return null;
  }

  return (
    <Portal container={container}>
      {/* Backdrop */}
      {backdrop && (
        <div
          className={clsx(
            'fixed inset-0 transition-opacity',
            backdrop === 'blur' ? 'backdrop-blur-sm bg-black/30' : 'bg-black/50',
            isVisible ? 'opacity-100' : 'opacity-0',
            backdropClassName
          )}
          style={{ 
            zIndex: zIndex - 1,
            transitionDuration: `${animationDuration}ms`,
          }}
          onClick={handleBackdropClick}
          aria-hidden="true"
        />
      )}

      {/* Content wrapper */}
      <div
        className={clsx(
          'fixed inset-0 overflow-y-auto',
          centered && 'flex items-center justify-center',
          !centered && 'p-4'
        )}
        style={{ zIndex }}
        onClick={backdrop ? handleBackdropClick : undefined}
      >
        {/* Content */}
        <div
          ref={contentRef}
          id={overlayId.current}
          role={role}
          aria-modal="true"
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledby}
          aria-describedby={ariaDescribedby}
          tabIndex={-1}
          className={clsx(
            'transition-all',
            isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95',
            contentClassName
          )}
          style={{ transitionDuration: `${animationDuration}ms` }}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </Portal>
  );
}

// ============================================================================
// MODAL COMPONENT
// ============================================================================

/**
 * Modal dialog component
 * 
 * @example
 * ```tsx
 * <Modal
 *   open={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   title="Confirm Action"
 *   size="md"
 * >
 *   <p>Are you sure you want to proceed?</p>
 * </Modal>
 * ```
 */
export function Modal({
  children,
  size = 'md',
  showCloseButton = true,
  title,
  footer,
  alert = false,
  closeOnBackdropClick = true,
  ...props
}: ModalProps) {
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-full mx-4',
  };

  const titleId = title ? `${props.id || 'modal'}-title` : undefined;

  return (
    <Overlay
      {...props}
      role={alert ? 'alertdialog' : 'dialog'}
      closeOnBackdropClick={alert ? false : closeOnBackdropClick}
      ariaLabelledby={props.ariaLabelledby || titleId}
    >
      <div
        className={clsx(
          'bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full',
          sizeClasses[size]
        )}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            {title && (
              <h2
                id={titleId}
                className="text-lg font-semibold text-gray-900 dark:text-white"
              >
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                type="button"
                onClick={props.onClose}
                className={clsx(
                  'p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100',
                  'dark:hover:text-gray-200 dark:hover:bg-gray-700',
                  'transition-colors',
                  !title && 'ml-auto'
                )}
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div className="px-6 py-4">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-b-lg">
            {footer}
          </div>
        )}
      </div>
    </Overlay>
  );
}

// ============================================================================
// DRAWER COMPONENT
// ============================================================================

/**
 * Drawer component for side panels
 * 
 * @example
 * ```tsx
 * <Drawer
 *   open={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   side="right"
 *   title="Settings"
 * >
 *   <SettingsForm />
 * </Drawer>
 * ```
 */
export function Drawer({
  children,
  side = 'right',
  size = 'md',
  showCloseButton = true,
  title,
  open,
  onClose,
  ...props
}: DrawerProps) {
  const sizeClasses = {
    left: { sm: 'w-64', md: 'w-80', lg: 'w-96', full: 'w-screen' },
    right: { sm: 'w-64', md: 'w-80', lg: 'w-96', full: 'w-screen' },
    top: { sm: 'h-32', md: 'h-48', lg: 'h-64', full: 'h-screen' },
    bottom: { sm: 'h-32', md: 'h-48', lg: 'h-64', full: 'h-screen' },
  };

  const positionClasses = {
    left: 'left-0 top-0 bottom-0',
    right: 'right-0 top-0 bottom-0',
    top: 'top-0 left-0 right-0',
    bottom: 'bottom-0 left-0 right-0',
  };

  const translateClasses = {
    left: open ? 'translate-x-0' : '-translate-x-full',
    right: open ? 'translate-x-0' : 'translate-x-full',
    top: open ? 'translate-y-0' : '-translate-y-full',
    bottom: open ? 'translate-y-0' : 'translate-y-full',
  };

  const titleId = title ? `${props.id || 'drawer'}-title` : undefined;

  return (
    <Overlay
      {...props}
      open={open}
      onClose={onClose}
      centered={false}
      ariaLabelledby={props.ariaLabelledby || titleId}
      contentClassName={clsx(
        'fixed bg-white dark:bg-gray-800 shadow-xl transition-transform',
        positionClasses[side],
        sizeClasses[side][size],
        translateClasses[side]
      )}
    >
      {/* Header */}
      {(title || showCloseButton) && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          {title && (
            <h2
              id={titleId}
              className="text-lg font-semibold text-gray-900 dark:text-white"
            >
              {title}
            </h2>
          )}
          {showCloseButton && (
            <button
              type="button"
              onClick={onClose}
              className={clsx(
                'p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100',
                'dark:hover:text-gray-200 dark:hover:bg-gray-700',
                'transition-colors',
                !title && 'ml-auto'
              )}
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">{children}</div>
    </Overlay>
  );
}

// ============================================================================
// POPOVER COMPONENT
// ============================================================================

/** Popover placement */
export type PopoverPlacement = 
  | 'top' | 'top-start' | 'top-end'
  | 'bottom' | 'bottom-start' | 'bottom-end'
  | 'left' | 'left-start' | 'left-end'
  | 'right' | 'right-start' | 'right-end';

/** Popover props */
export interface PopoverProps {
  /** Trigger element */
  trigger: ReactNode;
  /** Popover content */
  children: ReactNode;
  /** Whether popover is open (controlled) */
  open?: boolean;
  /** Default open state (uncontrolled) */
  defaultOpen?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Placement relative to trigger */
  placement?: PopoverPlacement;
  /** Offset from trigger (px) */
  offset?: number;
  /** Close on outside click */
  closeOnOutsideClick?: boolean;
  /** Close on escape */
  closeOnEscape?: boolean;
  /** Additional content class */
  contentClassName?: string;
  /** Disable the popover */
  disabled?: boolean;
  /** Trigger type */
  triggerType?: 'click' | 'hover';
  /** Hover delay (ms) */
  hoverDelay?: number;
}

/**
 * Popover component for floating content
 * 
 * @example
 * ```tsx
 * <Popover
 *   trigger={<button>Show Menu</button>}
 *   placement="bottom-start"
 * >
 *   <div className="p-4">Popover content</div>
 * </Popover>
 * ```
 */
export function Popover({
  trigger,
  children,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  placement = 'bottom',
  offset = 8,
  closeOnOutsideClick = true,
  closeOnEscape = true,
  contentClassName,
  disabled = false,
  triggerType = 'click',
  hoverDelay = 200,
}: PopoverProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = controlledOpen ?? internalOpen;
  
  const triggerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout>();

  const setOpen = useCallback(
    (value: boolean) => {
      setInternalOpen(value);
      onOpenChange?.(value);
    },
    [onOpenChange]
  );

  // Calculate position
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open || !triggerRef.current) return;

    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const contentWidth = contentRef.current?.offsetWidth || 200;
      const contentHeight = contentRef.current?.offsetHeight || 100;

      let top = 0;
      let left = 0;

      // Base positions
      const positions = {
        top: { top: rect.top - contentHeight - offset, left: rect.left + rect.width / 2 - contentWidth / 2 },
        'top-start': { top: rect.top - contentHeight - offset, left: rect.left },
        'top-end': { top: rect.top - contentHeight - offset, left: rect.right - contentWidth },
        bottom: { top: rect.bottom + offset, left: rect.left + rect.width / 2 - contentWidth / 2 },
        'bottom-start': { top: rect.bottom + offset, left: rect.left },
        'bottom-end': { top: rect.bottom + offset, left: rect.right - contentWidth },
        left: { top: rect.top + rect.height / 2 - contentHeight / 2, left: rect.left - contentWidth - offset },
        'left-start': { top: rect.top, left: rect.left - contentWidth - offset },
        'left-end': { top: rect.bottom - contentHeight, left: rect.left - contentWidth - offset },
        right: { top: rect.top + rect.height / 2 - contentHeight / 2, left: rect.right + offset },
        'right-start': { top: rect.top, left: rect.right + offset },
        'right-end': { top: rect.bottom - contentHeight, left: rect.right + offset },
      };

      const pos = positions[placement];
      top = pos.top + window.scrollY;
      left = pos.left + window.scrollX;

      // Keep within viewport
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      if (left < 8) left = 8;
      if (left + contentWidth > viewportWidth - 8) left = viewportWidth - contentWidth - 8;
      if (top < 8) top = 8;
      if (top + contentHeight > viewportHeight + window.scrollY - 8) {
        top = viewportHeight + window.scrollY - contentHeight - 8;
      }

      setPosition({ top, left });
    };

    updatePosition();

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
    };
  }, [open, placement, offset]);

  // Outside click
  useEffect(() => {
    if (!open || !closeOnOutsideClick) return;

    const handleClick = (e: globalThis.MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        contentRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      setOpen(false);
    };

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, closeOnOutsideClick, setOpen]);

  // Escape key
  useEffect(() => {
    if (!open || !closeOnEscape) return;

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, closeOnEscape, setOpen]);

  const handleTriggerClick = () => {
    if (disabled || triggerType !== 'click') return;
    setOpen(!open);
  };

  const handleMouseEnter = () => {
    if (disabled || triggerType !== 'hover') return;
    clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => setOpen(true), hoverDelay);
  };

  const handleMouseLeave = () => {
    if (disabled || triggerType !== 'hover') return;
    clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => setOpen(false), hoverDelay);
  };

  return (
    <>
      <div
        ref={triggerRef}
        onClick={handleTriggerClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="inline-block"
      >
        {trigger}
      </div>

      {open && (
        <Portal container="dropdowns">
          <div
            ref={contentRef}
            className={clsx(
              'absolute bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700',
              'animate-in fade-in-0 zoom-in-95',
              contentClassName
            )}
            style={{
              top: position.top,
              left: position.left,
              zIndex: Z_INDEX.popover,
            }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {children}
          </div>
        </Portal>
      )}
    </>
  );
}

// ============================================================================
// TOOLTIP COMPONENT
// ============================================================================

/** Tooltip props */
export interface TooltipProps {
  /** Content to show in tooltip */
  content: ReactNode;
  /** Element that triggers the tooltip */
  children: ReactNode;
  /** Placement relative to trigger */
  placement?: PopoverPlacement;
  /** Delay before showing (ms) */
  delay?: number;
  /** Additional tooltip class */
  className?: string;
  /** Disable the tooltip */
  disabled?: boolean;
}

/**
 * Simple tooltip component
 * 
 * @example
 * ```tsx
 * <Tooltip content="This is a tooltip">
 *   <button>Hover me</button>
 * </Tooltip>
 * ```
 */
export function Tooltip({
  content,
  children,
  placement = 'top',
  delay = 400,
  className,
  disabled = false,
}: TooltipProps) {
  return (
    <Popover
      trigger={children}
      placement={placement}
      triggerType="hover"
      hoverDelay={delay}
      closeOnEscape={false}
      closeOnOutsideClick={false}
      disabled={disabled}
      contentClassName={clsx(
        'px-2 py-1 text-sm bg-gray-900 text-white rounded shadow-lg',
        'dark:bg-gray-700',
        className
      )}
    >
      {content}
    </Popover>
  );
}

// ============================================================================
// CLICK OUTSIDE HOOK
// ============================================================================

/**
 * Hook to detect clicks outside an element
 * 
 * @example
 * ```tsx
 * const ref = useClickOutside(() => setOpen(false));
 * return <div ref={ref}>Content</div>;
 * ```
 */
export function useClickOutside<T extends HTMLElement = HTMLElement>(
  callback: () => void,
  enabled: boolean = true
): React.RefObject<T> {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!enabled) return;

    const handleClick = (e: globalThis.MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        callback();
      }
    };

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [callback, enabled]);

  return ref;
}

/**
 * Hook to detect escape key press
 * 
 * @example
 * ```tsx
 * useEscapeKey(() => setOpen(false), isOpen);
 * ```
 */
export function useEscapeKey(callback: () => void, enabled: boolean = true): void {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        callback();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [callback, enabled]);
}

// ============================================================================
// EXPORTS
// ============================================================================

// Types are exported inline at their definitions
