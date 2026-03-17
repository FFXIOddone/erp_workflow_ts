/**
 * Spotlight.tsx
 * CRITICAL-53: Spotlight and focus highlight components
 *
 * Visual spotlight effects for highlighting UI elements, feature callouts,
 * and attention-grabbing focus states.
 *
 * @module Spotlight
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  forwardRef,
  type ReactNode,
  type HTMLAttributes,
  type CSSProperties,
} from 'react';
import clsx from 'clsx';
import { X, ArrowRight, Info } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export type SpotlightShape = 'circle' | 'rectangle' | 'rounded' | 'ellipse';
export type SpotlightPlacement = 'top' | 'bottom' | 'left' | 'right' | 'auto';

export interface SpotlightTarget {
  id: string;
  element: HTMLElement | string; // Element or CSS selector
  title?: string;
  description?: ReactNode;
  placement?: SpotlightPlacement;
  shape?: SpotlightShape;
  padding?: number;
  borderRadius?: number;
  action?: ReactNode;
}

export interface SpotlightConfig {
  targets: SpotlightTarget[];
  overlayColor?: string;
  overlayOpacity?: number;
  spotlightColor?: string;
  pulseAnimation?: boolean;
  showClose?: boolean;
  closeOnClickOutside?: boolean;
  closeOnEscape?: boolean;
  onTargetChange?: (index: number, target: SpotlightTarget) => void;
  onClose?: () => void;
}

// ============================================================================
// Context
// ============================================================================

interface SpotlightContextValue {
  isActive: boolean;
  currentTarget: SpotlightTarget | null;
  currentIndex: number;
  totalTargets: number;
  next: () => void;
  prev: () => void;
  goTo: (index: number) => void;
  show: (targets?: SpotlightTarget[]) => void;
  hide: () => void;
  highlight: (target: SpotlightTarget | string) => void;
}

const SpotlightContext = createContext<SpotlightContextValue | null>(null);

export function useSpotlight(): SpotlightContextValue {
  const context = useContext(SpotlightContext);
  if (!context) {
    throw new Error('useSpotlight must be used within a SpotlightProvider');
  }
  return context;
}

// ============================================================================
// Utilities
// ============================================================================

function getElement(target: HTMLElement | string): HTMLElement | null {
  if (typeof target === 'string') {
    return document.querySelector(target);
  }
  return target;
}

function getElementRect(element: HTMLElement | null, padding: number = 0): DOMRect | null {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return new DOMRect(
    rect.x - padding,
    rect.y - padding,
    rect.width + padding * 2,
    rect.height + padding * 2
  );
}

function calculateTooltipPosition(
  targetRect: DOMRect,
  tooltipSize: { width: number; height: number },
  placement: SpotlightPlacement,
  gap: number = 16
): CSSProperties {
  const { innerWidth, innerHeight } = window;
  let top: number;
  let left: number;

  // Auto placement
  let actualPlacement = placement;
  if (placement === 'auto') {
    const spaceAbove = targetRect.top;
    const spaceBelow = innerHeight - targetRect.bottom;
    const spaceLeft = targetRect.left;
    const spaceRight = innerWidth - targetRect.right;

    const maxSpace = Math.max(spaceAbove, spaceBelow, spaceLeft, spaceRight);
    if (maxSpace === spaceBelow) actualPlacement = 'bottom';
    else if (maxSpace === spaceAbove) actualPlacement = 'top';
    else if (maxSpace === spaceRight) actualPlacement = 'right';
    else actualPlacement = 'left';
  }

  switch (actualPlacement) {
    case 'top':
      top = targetRect.top - tooltipSize.height - gap;
      left = targetRect.left + (targetRect.width - tooltipSize.width) / 2;
      break;
    case 'bottom':
      top = targetRect.bottom + gap;
      left = targetRect.left + (targetRect.width - tooltipSize.width) / 2;
      break;
    case 'left':
      top = targetRect.top + (targetRect.height - tooltipSize.height) / 2;
      left = targetRect.left - tooltipSize.width - gap;
      break;
    case 'right':
      top = targetRect.top + (targetRect.height - tooltipSize.height) / 2;
      left = targetRect.right + gap;
      break;
    default:
      top = targetRect.bottom + gap;
      left = targetRect.left + (targetRect.width - tooltipSize.width) / 2;
  }

  // Boundary checks
  left = Math.max(gap, Math.min(left, innerWidth - tooltipSize.width - gap));
  top = Math.max(gap, Math.min(top, innerHeight - tooltipSize.height - gap));

  return {
    position: 'fixed',
    top: `${top}px`,
    left: `${left}px`,
    zIndex: 10002,
  };
}

// ============================================================================
// SpotlightProvider Component
// ============================================================================

export interface SpotlightProviderProps extends SpotlightConfig {
  children: ReactNode;
}

export function SpotlightProvider({
  children,
  targets: initialTargets = [],
  overlayColor = 'rgba(0, 0, 0, 0.75)',
  overlayOpacity = 0.75,
  spotlightColor = 'transparent',
  pulseAnimation = true,
  showClose = true,
  closeOnClickOutside = true,
  closeOnEscape = true,
  onTargetChange,
  onClose,
}: SpotlightProviderProps) {
  const [isActive, setIsActive] = useState(false);
  const [targets, setTargets] = useState<SpotlightTarget[]>(initialTargets);
  const [currentIndex, setCurrentIndex] = useState(0);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipStyle, setTooltipStyle] = useState<CSSProperties>({});
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const currentTarget = targets[currentIndex] || null;

  // Update target rect
  useEffect(() => {
    if (!isActive || !currentTarget) {
      setTargetRect(null);
      return;
    }

    const updateRect = () => {
      const element = getElement(currentTarget.element);
      const rect = getElementRect(element, currentTarget.padding || 8);
      setTargetRect(rect);

      // Scroll element into view
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };

    updateRect();

    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect);

    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect);
    };
  }, [isActive, currentTarget]);

  // Update tooltip position
  useEffect(() => {
    if (!targetRect || !tooltipRef.current) return;

    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const style = calculateTooltipPosition(
      targetRect,
      { width: tooltipRect.width, height: tooltipRect.height },
      currentTarget?.placement || 'auto'
    );
    setTooltipStyle(style);
  }, [targetRect, currentTarget]);

  // Keyboard navigation
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          if (closeOnEscape) {
            e.preventDefault();
            hide();
          }
          break;
        case 'ArrowRight':
        case 'Enter':
          e.preventDefault();
          next();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          prev();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isActive, closeOnEscape]);

  // Navigation methods
  const next = useCallback(() => {
    if (currentIndex < targets.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      onTargetChange?.(nextIndex, targets[nextIndex]);
    } else {
      hide();
    }
  }, [currentIndex, targets, onTargetChange]);

  const prev = useCallback(() => {
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      setCurrentIndex(prevIndex);
      onTargetChange?.(prevIndex, targets[prevIndex]);
    }
  }, [currentIndex, targets, onTargetChange]);

  const goTo = useCallback(
    (index: number) => {
      if (index >= 0 && index < targets.length) {
        setCurrentIndex(index);
        onTargetChange?.(index, targets[index]);
      }
    },
    [targets, onTargetChange]
  );

  const show = useCallback(
    (newTargets?: SpotlightTarget[]) => {
      if (newTargets) {
        setTargets(newTargets);
      }
      setCurrentIndex(0);
      setIsActive(true);
      if (newTargets?.[0]) {
        onTargetChange?.(0, newTargets[0]);
      }
    },
    [onTargetChange]
  );

  const hide = useCallback(() => {
    setIsActive(false);
    setCurrentIndex(0);
    onClose?.();
  }, [onClose]);

  const highlight = useCallback(
    (target: SpotlightTarget | string) => {
      const spotlightTarget: SpotlightTarget =
        typeof target === 'string'
          ? { id: 'single', element: target }
          : target;
      setTargets([spotlightTarget]);
      setCurrentIndex(0);
      setIsActive(true);
    },
    []
  );

  // Handle overlay click
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (closeOnClickOutside && e.target === e.currentTarget) {
        hide();
      }
    },
    [closeOnClickOutside, hide]
  );

  const contextValue = useMemo<SpotlightContextValue>(
    () => ({
      isActive,
      currentTarget,
      currentIndex,
      totalTargets: targets.length,
      next,
      prev,
      goTo,
      show,
      hide,
      highlight,
    }),
    [isActive, currentTarget, currentIndex, targets.length, next, prev, goTo, show, hide, highlight]
  );

  // Generate clip path for spotlight cutout
  const getClipPath = () => {
    if (!targetRect) return 'none';

    const shape = currentTarget?.shape || 'rounded';
    const radius = currentTarget?.borderRadius ?? 8;
    const { x, y, width, height } = targetRect;

    switch (shape) {
      case 'circle':
        const circleRadius = Math.max(width, height) / 2;
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        return `polygon(
          0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
          ${centerX}px ${centerY - circleRadius}px,
          ${centerX + circleRadius}px ${centerY}px,
          ${centerX}px ${centerY + circleRadius}px,
          ${centerX - circleRadius}px ${centerY}px,
          ${centerX}px ${centerY - circleRadius}px
        )`;
      case 'ellipse':
        // Simplified polygon approximation
        return 'none';
      case 'rectangle':
      case 'rounded':
      default:
        // Use SVG mask instead for rounded rectangles
        return 'none';
    }
  };

  return (
    <SpotlightContext.Provider value={contextValue}>
      {children}

      {isActive && (
        <>
          {/* Overlay with spotlight cutout */}
          <div
            className="fixed inset-0 z-[10000] transition-opacity duration-300"
            onClick={handleOverlayClick}
          >
            <svg className="w-full h-full">
              <defs>
                <mask id="spotlight-mask">
                  <rect width="100%" height="100%" fill="white" />
                  {targetRect && (
                    <rect
                      x={targetRect.x}
                      y={targetRect.y}
                      width={targetRect.width}
                      height={targetRect.height}
                      rx={currentTarget?.borderRadius ?? 8}
                      fill="black"
                    />
                  )}
                </mask>
              </defs>
              <rect
                width="100%"
                height="100%"
                fill={overlayColor}
                fillOpacity={overlayOpacity}
                mask="url(#spotlight-mask)"
              />
            </svg>
          </div>

          {/* Spotlight border/highlight */}
          {targetRect && (
            <div
              className={clsx(
                'fixed z-[10001] pointer-events-none border-2 border-blue-400',
                pulseAnimation && 'animate-pulse'
              )}
              style={{
                left: targetRect.x,
                top: targetRect.y,
                width: targetRect.width,
                height: targetRect.height,
                borderRadius: currentTarget?.borderRadius ?? 8,
                boxShadow: '0 0 0 4px rgba(59, 130, 246, 0.3)',
              }}
            />
          )}

          {/* Tooltip */}
          {currentTarget && (currentTarget.title || currentTarget.description) && (
            <div
              ref={tooltipRef}
              className="bg-white rounded-xl shadow-2xl border border-gray-200 max-w-sm animate-in fade-in zoom-in-95 duration-200"
              style={tooltipStyle}
            >
              {/* Header */}
              {(currentTarget.title || showClose) && (
                <div className="flex items-start justify-between gap-4 px-4 py-3 border-b border-gray-100">
                  {currentTarget.title && (
                    <h3 className="font-semibold text-gray-900">{currentTarget.title}</h3>
                  )}
                  {showClose && (
                    <button
                      type="button"
                      className="text-gray-400 hover:text-gray-600 p-1"
                      onClick={hide}
                      aria-label="Close"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}

              {/* Content */}
              {currentTarget.description && (
                <div className="px-4 py-3 text-sm text-gray-600">
                  {currentTarget.description}
                </div>
              )}

              {/* Custom action */}
              {currentTarget.action && (
                <div className="px-4 py-3 border-t border-gray-100">
                  {currentTarget.action}
                </div>
              )}

              {/* Footer with navigation */}
              {targets.length > 1 && (
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-b-xl border-t border-gray-100">
                  <div className="flex items-center gap-1">
                    {targets.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        className={clsx(
                          'w-2 h-2 rounded-full transition-colors',
                          i === currentIndex ? 'bg-blue-600' : 'bg-gray-300 hover:bg-gray-400'
                        )}
                        onClick={() => goTo(i)}
                        aria-label={`Go to step ${i + 1}`}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    {currentIndex > 0 && (
                      <button
                        type="button"
                        className="text-sm text-gray-600 hover:text-gray-900"
                        onClick={prev}
                      >
                        Back
                      </button>
                    )}
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                      onClick={next}
                    >
                      {currentIndex < targets.length - 1 ? (
                        <>
                          Next
                          <ArrowRight className="w-4 h-4" />
                        </>
                      ) : (
                        'Done'
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </SpotlightContext.Provider>
  );
}

// ============================================================================
// SpotlightTrigger Component
// ============================================================================

export interface SpotlightTriggerProps {
  targets: SpotlightTarget[];
  children: ReactNode;
}

export function SpotlightTrigger({ targets, children }: SpotlightTriggerProps) {
  const { show } = useSpotlight();

  return (
    <span onClick={() => show(targets)} role="button" tabIndex={0} className="cursor-pointer">
      {children}
    </span>
  );
}

// ============================================================================
// Highlight Component
// ============================================================================

export interface HighlightProps extends HTMLAttributes<HTMLDivElement> {
  active?: boolean;
  color?: string;
  pulseColor?: string;
  shape?: 'rounded' | 'circle' | 'pill';
  children: ReactNode;
}

export const Highlight = forwardRef<HTMLDivElement, HighlightProps>(
  (
    {
      active = true,
      color = 'rgba(59, 130, 246, 0.3)',
      pulseColor = 'rgba(59, 130, 246, 0.5)',
      shape = 'rounded',
      children,
      className,
      style,
      ...props
    },
    ref
  ) => {
    const shapeClass = {
      rounded: 'rounded-lg',
      circle: 'rounded-full',
      pill: 'rounded-full',
    };

    return (
      <div
        ref={ref}
        className={clsx('relative inline-block', className)}
        style={style}
        {...props}
      >
        {active && (
          <>
            {/* Background highlight */}
            <div
              className={clsx('absolute inset-0', shapeClass[shape])}
              style={{ backgroundColor: color }}
            />
            {/* Pulse animation */}
            <div
              className={clsx('absolute inset-0 animate-ping', shapeClass[shape])}
              style={{ backgroundColor: pulseColor, opacity: 0.75 }}
            />
          </>
        )}
        <div className="relative z-10">{children}</div>
      </div>
    );
  }
);

Highlight.displayName = 'Highlight';

// ============================================================================
// Beacon Component
// ============================================================================

export interface BeaconProps extends HTMLAttributes<HTMLDivElement> {
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  tooltip?: string;
  onClick?: () => void;
}

export const Beacon = forwardRef<HTMLDivElement, BeaconProps>(
  (
    {
      color = '#3b82f6',
      size = 'md',
      position = 'top-right',
      tooltip,
      onClick,
      className,
      ...props
    },
    ref
  ) => {
    const [showTooltip, setShowTooltip] = useState(false);

    const sizeClasses = {
      sm: { outer: 'w-3 h-3', inner: 'w-2 h-2' },
      md: { outer: 'w-4 h-4', inner: 'w-2.5 h-2.5' },
      lg: { outer: 'w-5 h-5', inner: 'w-3 h-3' },
    };

    const positionClasses = {
      'top-right': '-top-1 -right-1',
      'top-left': '-top-1 -left-1',
      'bottom-right': '-bottom-1 -right-1',
      'bottom-left': '-bottom-1 -left-1',
    };

    const { outer, inner } = sizeClasses[size];

    return (
      <div
        ref={ref}
        className={clsx(
          'absolute cursor-pointer',
          positionClasses[position],
          className
        )}
        onClick={onClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        {...props}
      >
        {/* Pulse ring */}
        <div
          className={clsx('absolute rounded-full animate-ping', outer)}
          style={{ backgroundColor: color, opacity: 0.5 }}
        />
        {/* Inner dot */}
        <div
          className={clsx('relative rounded-full', inner)}
          style={{ backgroundColor: color }}
        />

        {/* Tooltip */}
        {tooltip && showTooltip && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-50">
            {tooltip}
          </div>
        )}
      </div>
    );
  }
);

Beacon.displayName = 'Beacon';

// ============================================================================
// FeatureCallout Component
// ============================================================================

export interface FeatureCalloutProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  icon?: ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  dismissible?: boolean;
  storageKey?: string;
  onDismiss?: () => void;
  children: ReactNode;
}

export const FeatureCallout = forwardRef<HTMLDivElement, FeatureCalloutProps>(
  (
    {
      title,
      description,
      icon,
      placement = 'bottom',
      dismissible = true,
      storageKey,
      onDismiss,
      children,
      className,
      ...props
    },
    ref
  ) => {
    const [isDismissed, setIsDismissed] = useState(() => {
      if (storageKey) {
        return localStorage.getItem(`callout-${storageKey}`) === 'dismissed';
      }
      return false;
    });
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState<CSSProperties>({});

    useEffect(() => {
      if (isDismissed || !wrapperRef.current) return;

      const updatePosition = () => {
        const rect = wrapperRef.current?.getBoundingClientRect();
        if (!rect) return;

        const gap = 12;
        let pos: CSSProperties = { position: 'absolute' };

        switch (placement) {
          case 'top':
            pos = { ...pos, bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: gap };
            break;
          case 'bottom':
            pos = { ...pos, top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: gap };
            break;
          case 'left':
            pos = { ...pos, right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: gap };
            break;
          case 'right':
            pos = { ...pos, left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: gap };
            break;
        }

        setPosition(pos);
      };

      updatePosition();
    }, [isDismissed, placement]);

    const handleDismiss = useCallback(() => {
      setIsDismissed(true);
      if (storageKey) {
        localStorage.setItem(`callout-${storageKey}`, 'dismissed');
      }
      onDismiss?.();
    }, [storageKey, onDismiss]);

    return (
      <div ref={wrapperRef} className={clsx('relative', className)} {...props}>
        {children}

        {!isDismissed && (
          <div
            ref={ref}
            className="bg-blue-600 text-white rounded-lg shadow-lg p-4 max-w-xs z-50"
            style={position}
          >
            {/* Arrow */}
            <div
              className={clsx(
                'absolute w-3 h-3 bg-blue-600 transform rotate-45',
                placement === 'top' && 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2',
                placement === 'bottom' && 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2',
                placement === 'left' && 'right-0 top-1/2 -translate-y-1/2 translate-x-1/2',
                placement === 'right' && 'left-0 top-1/2 -translate-y-1/2 -translate-x-1/2'
              )}
            />

            <div className="relative flex items-start gap-3">
              {icon && (
                <div className="shrink-0 p-1.5 bg-blue-500 rounded-lg">
                  {icon}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm">{title}</h4>
                {description && (
                  <p className="text-blue-100 text-xs mt-1">{description}</p>
                )}
              </div>
              {dismissible && (
                <button
                  type="button"
                  className="shrink-0 text-blue-200 hover:text-white"
                  onClick={handleDismiss}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
);

FeatureCallout.displayName = 'FeatureCallout';

// ============================================================================
// NewBadge Component
// ============================================================================

export interface NewBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'pulse' | 'glow';
  size?: 'sm' | 'md';
  text?: string;
}

export const NewBadge = forwardRef<HTMLSpanElement, NewBadgeProps>(
  ({ variant = 'default', size = 'sm', text = 'New', className, ...props }, ref) => {
    const sizeClasses = {
      sm: 'px-1.5 py-0.5 text-[10px]',
      md: 'px-2 py-0.5 text-xs',
    };

    return (
      <span
        ref={ref}
        className={clsx(
          'inline-flex items-center font-semibold uppercase tracking-wide rounded-full',
          'bg-gradient-to-r from-blue-600 to-purple-600 text-white',
          sizeClasses[size],
          variant === 'pulse' && 'animate-pulse',
          variant === 'glow' && 'shadow-lg shadow-blue-500/50',
          className
        )}
        {...props}
      >
        {text}
      </span>
    );
  }
);

NewBadge.displayName = 'NewBadge';

// ============================================================================
// useSpotlightElement Hook
// ============================================================================

export function useSpotlightElement(
  ref: React.RefObject<HTMLElement>,
  config: Omit<SpotlightTarget, 'id' | 'element'>
) {
  const { highlight } = useSpotlight();
  const [id] = useState(() => `spotlight-${Math.random().toString(36).slice(2)}`);

  const triggerSpotlight = useCallback(() => {
    if (ref.current) {
      highlight({
        id,
        element: ref.current,
        ...config,
      });
    }
  }, [ref, highlight, id, config]);

  return triggerSpotlight;
}

// ============================================================================
// Exports
// ============================================================================

export default SpotlightProvider;
