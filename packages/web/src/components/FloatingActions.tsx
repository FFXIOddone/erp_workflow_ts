/**
 * FloatingActions.tsx
 * CRITICAL-54: Floating Action Button (FAB) and Speed Dial components
 *
 * Material Design-inspired floating action buttons with expandable
 * speed dial menus, positioning options, and animations.
 *
 * @module FloatingActions
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
  forwardRef,
  type ReactNode,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
} from 'react';
import clsx from 'clsx';
import {
  Plus,
  X,
  ChevronUp,
  MessageSquare,
  HelpCircle,
  Phone,
  Mail,
  type LucideIcon,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export type FABSize = 'sm' | 'md' | 'lg' | 'xl';
export type FABPosition =
  | 'bottom-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'top-right'
  | 'top-left'
  | 'top-center';
export type FABVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info';
export type SpeedDialDirection = 'up' | 'down' | 'left' | 'right';

export interface SpeedDialAction {
  id: string;
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tooltip?: string;
  color?: FABVariant;
}

// ============================================================================
// Context
// ============================================================================

interface FABGroupContextValue {
  isOpen: boolean;
  toggle: () => void;
  open: () => void;
  close: () => void;
}

const FABGroupContext = createContext<FABGroupContextValue | null>(null);

function useFABGroup() {
  return useContext(FABGroupContext);
}

// ============================================================================
// Utility Functions
// ============================================================================

function getPositionClasses(position: FABPosition): string {
  const positions: Record<FABPosition, string> = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
    'bottom-center': 'bottom-6 left-1/2 -translate-x-1/2',
    'top-right': 'top-6 right-6',
    'top-left': 'top-6 left-6',
    'top-center': 'top-6 left-1/2 -translate-x-1/2',
  };
  return positions[position];
}

function getSizeClasses(size: FABSize): string {
  const sizes: Record<FABSize, string> = {
    sm: 'w-10 h-10',
    md: 'w-12 h-12',
    lg: 'w-14 h-14',
    xl: 'w-16 h-16',
  };
  return sizes[size];
}

function getIconSizeClasses(size: FABSize): string {
  const iconSizes: Record<FABSize, string> = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
    xl: 'w-7 h-7',
  };
  return iconSizes[size];
}

function getVariantClasses(variant: FABVariant): string {
  const variants: Record<FABVariant, string> = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/30',
    secondary: 'bg-gray-600 hover:bg-gray-700 text-white shadow-gray-500/30',
    success: 'bg-green-600 hover:bg-green-700 text-white shadow-green-500/30',
    danger: 'bg-red-600 hover:bg-red-700 text-white shadow-red-500/30',
    warning: 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/30',
    info: 'bg-cyan-600 hover:bg-cyan-700 text-white shadow-cyan-500/30',
  };
  return variants[variant];
}

// ============================================================================
// FAB (Floating Action Button) Component
// ============================================================================

export interface FABProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode;
  size?: FABSize;
  variant?: FABVariant;
  position?: FABPosition;
  fixed?: boolean;
  extended?: boolean;
  label?: string;
  tooltip?: string;
  loading?: boolean;
  pulse?: boolean;
  badge?: number | string;
}

export const FAB = forwardRef<HTMLButtonElement, FABProps>(
  (
    {
      icon = <Plus />,
      size = 'md',
      variant = 'primary',
      position = 'bottom-right',
      fixed = true,
      extended = false,
      label,
      tooltip,
      loading = false,
      pulse = false,
      badge,
      className,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const [showTooltip, setShowTooltip] = useState(false);
    const fabGroup = useFABGroup();

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (fabGroup) {
        fabGroup.toggle();
      }
      props.onClick?.(e);
    };

    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled || loading}
        className={clsx(
          'relative inline-flex items-center justify-center rounded-full shadow-lg transition-all duration-200',
          'focus:outline-none focus:ring-2 focus:ring-offset-2',
          getVariantClasses(variant),
          extended ? 'px-6 h-12' : getSizeClasses(size),
          fixed && 'fixed z-50',
          fixed && getPositionClasses(position),
          disabled && 'opacity-50 cursor-not-allowed',
          pulse && 'animate-pulse',
          fabGroup?.isOpen && 'rotate-45',
          className
        )}
        onClick={handleClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        aria-label={label || tooltip}
        {...props}
      >
        {loading ? (
          <div className={clsx('animate-spin rounded-full border-2 border-current border-t-transparent', getIconSizeClasses(size))} />
        ) : (
          <>
            <span className={clsx('transition-transform duration-200', getIconSizeClasses(size))}>
              {icon}
            </span>
            {extended && label && (
              <span className="ml-2 font-medium">{label}</span>
            )}
          </>
        )}

        {/* Badge */}
        {badge !== undefined && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 flex items-center justify-center bg-red-500 text-white text-xs font-bold rounded-full">
            {badge}
          </span>
        )}

        {/* Tooltip */}
        {tooltip && showTooltip && !extended && (
          <div className="absolute right-full mr-3 px-2 py-1 bg-gray-900 text-white text-sm rounded whitespace-nowrap z-50">
            {tooltip}
          </div>
        )}

        {children}
      </button>
    );
  }
);

FAB.displayName = 'FAB';

// ============================================================================
// SpeedDial Component
// ============================================================================

export interface SpeedDialProps extends HTMLAttributes<HTMLDivElement> {
  actions: SpeedDialAction[];
  icon?: ReactNode;
  openIcon?: ReactNode;
  direction?: SpeedDialDirection;
  position?: FABPosition;
  variant?: FABVariant;
  size?: FABSize;
  openOnHover?: boolean;
  hidden?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
}

export const SpeedDial = forwardRef<HTMLDivElement, SpeedDialProps>(
  (
    {
      actions,
      icon = <Plus className="w-6 h-6" />,
      openIcon = <X className="w-6 h-6" />,
      direction = 'up',
      position = 'bottom-right',
      variant = 'primary',
      size = 'lg',
      openOnHover = false,
      hidden = false,
      onOpen,
      onClose,
      className,
      ...props
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const toggle = useCallback(() => {
      setIsOpen((prev) => {
        const newState = !prev;
        if (newState) {
          onOpen?.();
        } else {
          onClose?.();
        }
        return newState;
      });
    }, [onOpen, onClose]);

    const open = useCallback(() => {
      setIsOpen(true);
      onOpen?.();
    }, [onOpen]);

    const close = useCallback(() => {
      setIsOpen(false);
      onClose?.();
    }, [onClose]);

    // Close on click outside
    useEffect(() => {
      if (!isOpen) return;

      const handleClickOutside = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          close();
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, close]);

    // Close on escape
    useEffect(() => {
      if (!isOpen) return;

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          close();
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, close]);

    const directionClasses: Record<SpeedDialDirection, string> = {
      up: 'flex-col-reverse mb-3',
      down: 'flex-col mt-3',
      left: 'flex-row-reverse mr-3',
      right: 'flex-row ml-3',
    };

    const actionTransformClasses: Record<SpeedDialDirection, string> = {
      up: 'translate-y-4',
      down: '-translate-y-4',
      left: 'translate-x-4',
      right: '-translate-x-4',
    };

    const contextValue = useMemo<FABGroupContextValue>(
      () => ({ isOpen, toggle, open, close }),
      [isOpen, toggle, open, close]
    );

    if (hidden) return null;

    return (
      <FABGroupContext.Provider value={contextValue}>
        <div
          ref={containerRef}
          className={clsx(
            'fixed z-50',
            getPositionClasses(position),
            className
          )}
          onMouseEnter={openOnHover ? open : undefined}
          onMouseLeave={openOnHover ? close : undefined}
          {...props}
        >
          {/* Actions */}
          <div
            className={clsx(
              'flex items-center gap-3',
              directionClasses[direction],
              !isOpen && 'pointer-events-none'
            )}
          >
            {actions.map((action, index) => (
              <div
                key={action.id}
                className={clsx(
                  'flex items-center gap-2 transition-all duration-200',
                  direction === 'up' || direction === 'down'
                    ? 'flex-row'
                    : 'flex-col',
                  isOpen
                    ? 'opacity-100 transform-none'
                    : `opacity-0 ${actionTransformClasses[direction]}`
                )}
                style={{
                  transitionDelay: isOpen ? `${index * 50}ms` : `${(actions.length - index - 1) * 30}ms`,
                }}
              >
                {/* Label */}
                {(direction === 'up' || direction === 'down') && action.label && (
                  <span className="px-2 py-1 bg-gray-900 text-white text-sm rounded shadow whitespace-nowrap">
                    {action.label}
                  </span>
                )}

                {/* Action button */}
                <button
                  type="button"
                  disabled={action.disabled}
                  className={clsx(
                    'w-10 h-10 flex items-center justify-center rounded-full shadow-lg transition-all',
                    'focus:outline-none focus:ring-2 focus:ring-offset-2',
                    action.color ? getVariantClasses(action.color) : 'bg-white text-gray-700 hover:bg-gray-50',
                    action.disabled && 'opacity-50 cursor-not-allowed'
                  )}
                  onClick={() => {
                    action.onClick?.();
                    close();
                  }}
                  title={action.tooltip || action.label}
                >
                  {action.icon}
                </button>
              </div>
            ))}
          </div>

          {/* Main FAB */}
          <div ref={ref}>
            <FAB
              icon={isOpen ? openIcon : icon}
              size={size}
              variant={variant}
              fixed={false}
              className={clsx(isOpen && 'rotate-0')}
            />
          </div>
        </div>
      </FABGroupContext.Provider>
    );
  }
);

SpeedDial.displayName = 'SpeedDial';

// ============================================================================
// ScrollToTop Component
// ============================================================================

export interface ScrollToTopProps extends Omit<FABProps, 'icon' | 'onClick'> {
  threshold?: number;
  smooth?: boolean;
  targetElement?: HTMLElement | null;
}

export const ScrollToTop = forwardRef<HTMLButtonElement, ScrollToTopProps>(
  (
    {
      threshold = 300,
      smooth = true,
      targetElement,
      position = 'bottom-right',
      variant = 'secondary',
      size = 'md',
      ...props
    },
    ref
  ) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
      const element = targetElement || window;
      
      const handleScroll = () => {
        const scrollTop = targetElement
          ? targetElement.scrollTop
          : window.pageYOffset || document.documentElement.scrollTop;
        setIsVisible(scrollTop > threshold);
      };

      element.addEventListener('scroll', handleScroll, { passive: true });
      handleScroll();

      return () => element.removeEventListener('scroll', handleScroll);
    }, [threshold, targetElement]);

    const scrollToTop = useCallback(() => {
      if (targetElement) {
        targetElement.scrollTo({
          top: 0,
          behavior: smooth ? 'smooth' : 'auto',
        });
      } else {
        window.scrollTo({
          top: 0,
          behavior: smooth ? 'smooth' : 'auto',
        });
      }
    }, [smooth, targetElement]);

    if (!isVisible) return null;

    return (
      <FAB
        ref={ref}
        icon={<ChevronUp className="w-5 h-5" />}
        position={position}
        variant={variant}
        size={size}
        tooltip="Scroll to top"
        onClick={scrollToTop}
        aria-label="Scroll to top"
        {...props}
      />
    );
  }
);

ScrollToTop.displayName = 'ScrollToTop';

// ============================================================================
// SupportFAB Component
// ============================================================================

export interface SupportFABProps extends HTMLAttributes<HTMLDivElement> {
  position?: FABPosition;
  variant?: FABVariant;
  size?: FABSize;
  channels?: {
    chat?: { onClick: () => void; label?: string };
    phone?: { href: string; label?: string };
    email?: { href: string; label?: string };
    help?: { onClick: () => void; label?: string };
  };
  customActions?: SpeedDialAction[];
}

export const SupportFAB = forwardRef<HTMLDivElement, SupportFABProps>(
  (
    {
      position = 'bottom-right',
      variant = 'primary',
      size = 'lg',
      channels = {},
      customActions = [],
      className,
      ...props
    },
    ref
  ) => {
    const actions: SpeedDialAction[] = useMemo(() => {
      const result: SpeedDialAction[] = [];

      if (channels.chat) {
        result.push({
          id: 'chat',
          label: channels.chat.label || 'Chat with us',
          icon: <MessageSquare className="w-5 h-5" />,
          onClick: channels.chat.onClick,
          color: 'info',
        });
      }

      if (channels.phone) {
        result.push({
          id: 'phone',
          label: channels.phone.label || 'Call us',
          icon: <Phone className="w-5 h-5" />,
          onClick: () => window.open(channels.phone?.href, '_self'),
          color: 'success',
        });
      }

      if (channels.email) {
        result.push({
          id: 'email',
          label: channels.email.label || 'Email us',
          icon: <Mail className="w-5 h-5" />,
          onClick: () => window.open(channels.email?.href, '_self'),
          color: 'warning',
        });
      }

      if (channels.help) {
        result.push({
          id: 'help',
          label: channels.help.label || 'Help center',
          icon: <HelpCircle className="w-5 h-5" />,
          onClick: channels.help.onClick,
          color: 'secondary',
        });
      }

      return [...result, ...customActions];
    }, [channels, customActions]);

    return (
      <SpeedDial
        ref={ref}
        actions={actions}
        icon={<HelpCircle className="w-6 h-6" />}
        position={position}
        variant={variant}
        size={size}
        direction="up"
        className={className}
        {...props}
      />
    );
  }
);

SupportFAB.displayName = 'SupportFAB';

// ============================================================================
// BottomBar Component
// ============================================================================

export interface BottomBarAction {
  id: string;
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  active?: boolean;
  badge?: number | string;
  disabled?: boolean;
}

export interface BottomBarProps extends HTMLAttributes<HTMLDivElement> {
  actions: BottomBarAction[];
  primaryAction?: {
    icon: ReactNode;
    onClick: () => void;
    variant?: FABVariant;
  };
  elevated?: boolean;
}

export const BottomBar = forwardRef<HTMLDivElement, BottomBarProps>(
  (
    {
      actions,
      primaryAction,
      elevated = true,
      className,
      ...props
    },
    ref
  ) => {
    const leftActions = primaryAction ? actions.slice(0, Math.ceil(actions.length / 2)) : actions.slice(0, Math.floor(actions.length / 2));
    const rightActions = primaryAction ? actions.slice(Math.ceil(actions.length / 2)) : actions.slice(Math.floor(actions.length / 2));

    const renderAction = (action: BottomBarAction) => (
      <button
        key={action.id}
        type="button"
        disabled={action.disabled}
        className={clsx(
          'relative flex flex-col items-center justify-center px-3 py-2 min-w-[64px]',
          'transition-colors',
          action.active
            ? 'text-blue-600'
            : 'text-gray-500 hover:text-gray-700',
          action.disabled && 'opacity-50 cursor-not-allowed'
        )}
        onClick={action.onClick}
      >
        <span className="relative">
          {action.icon}
          {action.badge !== undefined && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full">
              {action.badge}
            </span>
          )}
        </span>
        <span className="mt-1 text-xs font-medium">{action.label}</span>
      </button>
    );

    return (
      <div
        ref={ref}
        className={clsx(
          'fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200',
          elevated && 'shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]',
          'safe-area-inset-bottom',
          className
        )}
        {...props}
      >
        <div className="flex items-center justify-around max-w-lg mx-auto">
          {/* Left actions */}
          {leftActions.map(renderAction)}

          {/* Primary FAB */}
          {primaryAction && (
            <div className="relative -mt-6">
              <FAB
                icon={primaryAction.icon}
                variant={primaryAction.variant || 'primary'}
                size="lg"
                fixed={false}
                onClick={primaryAction.onClick}
              />
            </div>
          )}

          {/* Right actions */}
          {rightActions.map(renderAction)}
        </div>
      </div>
    );
  }
);

BottomBar.displayName = 'BottomBar';

// ============================================================================
// FloatingPanel Component
// ============================================================================

export interface FloatingPanelProps extends HTMLAttributes<HTMLDivElement> {
  position?: FABPosition;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  closeOnClickOutside?: boolean;
  width?: number | string;
  maxHeight?: number | string;
  children: ReactNode;
}

export const FloatingPanel = forwardRef<HTMLDivElement, FloatingPanelProps>(
  (
    {
      position = 'bottom-right',
      trigger,
      open: controlledOpen,
      onOpenChange,
      closeOnClickOutside = true,
      width = 320,
      maxHeight = 480,
      children,
      className,
      ...props
    },
    ref
  ) => {
    const [internalOpen, setInternalOpen] = useState(false);
    const isOpen = controlledOpen ?? internalOpen;
    const panelRef = useRef<HTMLDivElement>(null);

    const setOpen = useCallback(
      (value: boolean) => {
        setInternalOpen(value);
        onOpenChange?.(value);
      },
      [onOpenChange]
    );

    // Close on click outside
    useEffect(() => {
      if (!isOpen || !closeOnClickOutside) return;

      const handleClickOutside = (e: MouseEvent) => {
        if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
          setOpen(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, closeOnClickOutside, setOpen]);

    const panelPositionClasses: Record<FABPosition, string> = {
      'bottom-right': 'bottom-20 right-6',
      'bottom-left': 'bottom-20 left-6',
      'bottom-center': 'bottom-20 left-1/2 -translate-x-1/2',
      'top-right': 'top-20 right-6',
      'top-left': 'top-20 left-6',
      'top-center': 'top-20 left-1/2 -translate-x-1/2',
    };

    return (
      <>
        {/* Trigger */}
        {trigger && (
          <div
            className={clsx('fixed z-50', getPositionClasses(position))}
            onClick={() => setOpen(!isOpen)}
          >
            {trigger}
          </div>
        )}

        {/* Panel */}
        {isOpen && (
          <div
            ref={panelRef}
            className={clsx(
              'fixed z-50 bg-white rounded-xl shadow-2xl border border-gray-200',
              'animate-in fade-in slide-in-from-bottom-4 duration-200',
              panelPositionClasses[position],
              className
            )}
            style={{ width, maxHeight }}
            {...props}
          >
            <div ref={ref} className="h-full overflow-auto">
              {children}
            </div>
          </div>
        )}
      </>
    );
  }
);

FloatingPanel.displayName = 'FloatingPanel';

// ============================================================================
// useFABVisibility Hook
// ============================================================================

export interface FABVisibilityOptions {
  scrollThreshold?: number;
  hideOnScrollDown?: boolean;
  showDelay?: number;
  hideDelay?: number;
}

export function useFABVisibility(options: FABVisibilityOptions = {}) {
  const {
    scrollThreshold = 100,
    hideOnScrollDown = true,
    showDelay = 0,
    hideDelay = 0,
  } = options;

  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);
  const showTimeout = useRef<NodeJS.Timeout>();
  const hideTimeout = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const isScrollingDown = currentScrollY > lastScrollY.current;

      clearTimeout(showTimeout.current);
      clearTimeout(hideTimeout.current);

      if (hideOnScrollDown) {
        if (isScrollingDown && currentScrollY > scrollThreshold) {
          hideTimeout.current = setTimeout(() => setIsVisible(false), hideDelay);
        } else {
          showTimeout.current = setTimeout(() => setIsVisible(true), showDelay);
        }
      } else {
        setIsVisible(currentScrollY > scrollThreshold);
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(showTimeout.current);
      clearTimeout(hideTimeout.current);
    };
  }, [scrollThreshold, hideOnScrollDown, showDelay, hideDelay]);

  return isVisible;
}

// ============================================================================
// Exports
// ============================================================================

export default FAB;
