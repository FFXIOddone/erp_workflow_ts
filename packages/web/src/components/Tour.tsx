/**
 * Tour.tsx
 * CRITICAL-48: Guided tour and onboarding system
 *
 * Step-by-step product tours, feature highlights, and onboarding flows.
 * Includes spotlight effects, tooltips, and progress tracking.
 *
 * @module Tour
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  type ReactNode,
  type CSSProperties,
} from 'react';
import clsx from 'clsx';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Check,
  Circle,
  SkipForward,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export type TourPlacement =
  | 'top'
  | 'top-start'
  | 'top-end'
  | 'bottom'
  | 'bottom-start'
  | 'bottom-end'
  | 'left'
  | 'left-start'
  | 'left-end'
  | 'right'
  | 'right-start'
  | 'right-end';

export interface TourStep {
  id: string;
  target: string | HTMLElement | null; // CSS selector or element
  title: string;
  content: ReactNode;
  placement?: TourPlacement;
  spotlightPadding?: number;
  spotlightRadius?: number;
  disableInteraction?: boolean;
  waitForElement?: boolean;
  beforeShow?: () => void | Promise<void>;
  afterShow?: () => void | Promise<void>;
  beforeHide?: () => void | Promise<void>;
  action?: ReactNode;
  image?: string;
  video?: string;
  hideNext?: boolean;
  hidePrev?: boolean;
  nextLabel?: string;
  prevLabel?: string;
}

export interface TourConfig {
  steps: TourStep[];
  onComplete?: () => void;
  onSkip?: () => void;
  onStepChange?: (step: number, stepId: string) => void;
  showProgress?: boolean;
  showSkip?: boolean;
  showClose?: boolean;
  keyboardNavigation?: boolean;
  overlayColor?: string;
  overlayOpacity?: number;
  scrollBehavior?: ScrollBehavior;
  scrollMargin?: number;
  persistProgress?: boolean;
  storageKey?: string;
}

export interface TourState {
  isActive: boolean;
  currentStep: number;
  totalSteps: number;
  currentStepData: TourStep | null;
}

// ============================================================================
// Context
// ============================================================================

interface TourContextValue {
  state: TourState;
  start: (stepIndex?: number) => void;
  stop: () => void;
  next: () => void;
  prev: () => void;
  goTo: (step: number) => void;
  skip: () => void;
  complete: () => void;
}

const TourContext = createContext<TourContextValue | null>(null);

export function useTour(): TourContextValue {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return context;
}

// ============================================================================
// Utilities
// ============================================================================

function getElementFromTarget(target: string | HTMLElement | null): HTMLElement | null {
  if (!target) return null;
  if (typeof target === 'string') {
    return document.querySelector(target);
  }
  return target;
}

function getElementRect(element: HTMLElement | null): DOMRect | null {
  if (!element) return null;
  return element.getBoundingClientRect();
}

function scrollToElement(
  element: HTMLElement,
  behavior: ScrollBehavior = 'smooth',
  margin: number = 100
): void {
  const rect = element.getBoundingClientRect();
  const scrollY = window.scrollY + rect.top - margin;
  window.scrollTo({ top: scrollY, behavior });
}

function calculateTooltipPosition(
  targetRect: DOMRect,
  tooltipRect: DOMRect,
  placement: TourPlacement,
  gap: number = 12
): CSSProperties {
  const { innerWidth, innerHeight } = window;
  let top: number;
  let left: number;

  // Base positions
  switch (placement) {
    case 'top':
    case 'top-start':
    case 'top-end':
      top = targetRect.top - tooltipRect.height - gap;
      break;
    case 'bottom':
    case 'bottom-start':
    case 'bottom-end':
      top = targetRect.bottom + gap;
      break;
    case 'left':
    case 'left-start':
    case 'left-end':
      top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
      left = targetRect.left - tooltipRect.width - gap;
      break;
    case 'right':
    case 'right-start':
    case 'right-end':
      top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
      left = targetRect.right + gap;
      break;
    default:
      top = targetRect.bottom + gap;
      left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
  }

  // Horizontal alignment for top/bottom
  if (placement.startsWith('top') || placement.startsWith('bottom')) {
    if (placement.endsWith('-start')) {
      left = targetRect.left;
    } else if (placement.endsWith('-end')) {
      left = targetRect.right - tooltipRect.width;
    } else {
      left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
    }
  }

  // Vertical alignment for left/right
  if (placement.startsWith('left') || placement.startsWith('right')) {
    if (placement.endsWith('-start')) {
      top = targetRect.top;
    } else if (placement.endsWith('-end')) {
      top = targetRect.bottom - tooltipRect.height;
    }
  }

  // Boundary checks
  left = Math.max(gap, Math.min(left!, innerWidth - tooltipRect.width - gap));
  top = Math.max(gap, Math.min(top!, innerHeight - tooltipRect.height - gap));

  return {
    position: 'fixed',
    top: `${top}px`,
    left: `${left!}px`,
    zIndex: 10001,
  };
}

// ============================================================================
// TourProvider Component
// ============================================================================

export interface TourProviderProps extends TourConfig {
  children: ReactNode;
}

export function TourProvider({
  children,
  steps,
  onComplete,
  onSkip,
  onStepChange,
  showProgress = true,
  showSkip = true,
  showClose = true,
  keyboardNavigation = true,
  overlayColor = 'rgba(0, 0, 0, 0.5)',
  overlayOpacity = 0.5,
  scrollBehavior = 'smooth',
  scrollMargin = 100,
  persistProgress = false,
  storageKey = 'tour-progress',
}: TourProviderProps) {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  // Load persisted progress
  useEffect(() => {
    if (persistProgress) {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const { completed, step } = JSON.parse(saved);
        if (!completed && step < steps.length) {
          setCurrentStep(step);
        }
      }
    }
  }, [persistProgress, storageKey, steps.length]);

  // Save progress
  useEffect(() => {
    if (persistProgress && isActive) {
      localStorage.setItem(storageKey, JSON.stringify({ completed: false, step: currentStep }));
    }
  }, [persistProgress, storageKey, currentStep, isActive]);

  // Current step data
  const currentStepData = steps[currentStep] || null;

  // State object
  const state: TourState = useMemo(
    () => ({
      isActive,
      currentStep,
      totalSteps: steps.length,
      currentStepData,
    }),
    [isActive, currentStep, steps.length, currentStepData]
  );

  // Start tour
  const start = useCallback(
    async (stepIndex: number = 0) => {
      const step = steps[stepIndex];
      if (step?.beforeShow) {
        await step.beforeShow();
      }
      setCurrentStep(stepIndex);
      setIsActive(true);

      // Scroll to element
      const element = getElementFromTarget(step?.target || null);
      if (element) {
        scrollToElement(element, scrollBehavior, scrollMargin);
      }

      if (step?.afterShow) {
        await step.afterShow();
      }
      onStepChange?.(stepIndex, step?.id || '');
    },
    [steps, scrollBehavior, scrollMargin, onStepChange]
  );

  // Stop tour
  const stop = useCallback(() => {
    setIsActive(false);
  }, []);

  // Go to next step
  const next = useCallback(async () => {
    const step = steps[currentStep];
    if (step?.beforeHide) {
      await step.beforeHide();
    }

    if (currentStep < steps.length - 1) {
      const nextStep = currentStep + 1;
      const nextStepData = steps[nextStep];

      if (nextStepData?.beforeShow) {
        await nextStepData.beforeShow();
      }

      setCurrentStep(nextStep);

      // Scroll to element
      const element = getElementFromTarget(nextStepData?.target || null);
      if (element) {
        scrollToElement(element, scrollBehavior, scrollMargin);
      }

      if (nextStepData?.afterShow) {
        await nextStepData.afterShow();
      }
      onStepChange?.(nextStep, nextStepData?.id || '');
    } else {
      // Tour complete
      setIsActive(false);
      if (persistProgress) {
        localStorage.setItem(storageKey, JSON.stringify({ completed: true, step: 0 }));
      }
      onComplete?.();
    }
  }, [currentStep, steps, scrollBehavior, scrollMargin, onStepChange, onComplete, persistProgress, storageKey]);

  // Go to previous step
  const prev = useCallback(async () => {
    if (currentStep > 0) {
      const step = steps[currentStep];
      if (step?.beforeHide) {
        await step.beforeHide();
      }

      const prevStep = currentStep - 1;
      const prevStepData = steps[prevStep];

      if (prevStepData?.beforeShow) {
        await prevStepData.beforeShow();
      }

      setCurrentStep(prevStep);

      // Scroll to element
      const element = getElementFromTarget(prevStepData?.target || null);
      if (element) {
        scrollToElement(element, scrollBehavior, scrollMargin);
      }

      if (prevStepData?.afterShow) {
        await prevStepData.afterShow();
      }
      onStepChange?.(prevStep, prevStepData?.id || '');
    }
  }, [currentStep, steps, scrollBehavior, scrollMargin, onStepChange]);

  // Go to specific step
  const goTo = useCallback(
    async (step: number) => {
      if (step >= 0 && step < steps.length) {
        const currentStepObj = steps[currentStep];
        if (currentStepObj?.beforeHide) {
          await currentStepObj.beforeHide();
        }

        const targetStep = steps[step];
        if (targetStep?.beforeShow) {
          await targetStep.beforeShow();
        }

        setCurrentStep(step);

        // Scroll to element
        const element = getElementFromTarget(targetStep?.target || null);
        if (element) {
          scrollToElement(element, scrollBehavior, scrollMargin);
        }

        if (targetStep?.afterShow) {
          await targetStep.afterShow();
        }
        onStepChange?.(step, targetStep?.id || '');
      }
    },
    [currentStep, steps, scrollBehavior, scrollMargin, onStepChange]
  );

  // Skip tour
  const skip = useCallback(() => {
    setIsActive(false);
    onSkip?.();
  }, [onSkip]);

  // Complete tour
  const complete = useCallback(() => {
    setIsActive(false);
    if (persistProgress) {
      localStorage.setItem(storageKey, JSON.stringify({ completed: true, step: 0 }));
    }
    onComplete?.();
  }, [onComplete, persistProgress, storageKey]);

  // Keyboard navigation
  useEffect(() => {
    if (!isActive || !keyboardNavigation) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case 'Enter':
          e.preventDefault();
          next();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          prev();
          break;
        case 'Escape':
          e.preventDefault();
          stop();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isActive, keyboardNavigation, next, prev, stop]);

  // Context value
  const contextValue = useMemo<TourContextValue>(
    () => ({
      state,
      start,
      stop,
      next,
      prev,
      goTo,
      skip,
      complete,
    }),
    [state, start, stop, next, prev, goTo, skip, complete]
  );

  return (
    <TourContext.Provider value={contextValue}>
      {children}
      {isActive && currentStepData && (
        <TourOverlay
          step={currentStepData}
          currentStep={currentStep}
          totalSteps={steps.length}
          onNext={next}
          onPrev={prev}
          onSkip={skip}
          onClose={stop}
          showProgress={showProgress}
          showSkip={showSkip}
          showClose={showClose}
          overlayColor={overlayColor}
          overlayOpacity={overlayOpacity}
        />
      )}
    </TourContext.Provider>
  );
}

// ============================================================================
// TourOverlay Component
// ============================================================================

interface TourOverlayProps {
  step: TourStep;
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onClose: () => void;
  showProgress: boolean;
  showSkip: boolean;
  showClose: boolean;
  overlayColor: string;
  overlayOpacity: number;
}

function TourOverlay({
  step,
  currentStep,
  totalSteps,
  onNext,
  onPrev,
  onSkip,
  onClose,
  showProgress,
  showSkip,
  showClose,
  overlayColor,
  overlayOpacity,
}: TourOverlayProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [tooltipStyle, setTooltipStyle] = useState<CSSProperties>({});

  // Find target element
  useEffect(() => {
    const updatePosition = () => {
      const element = getElementFromTarget(step.target);
      const rect = getElementRect(element);
      setTargetRect(rect);

      if (rect && tooltipRef.current) {
        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        const style = calculateTooltipPosition(
          rect,
          tooltipRect,
          step.placement || 'bottom'
        );
        setTooltipStyle(style);
      }
    };

    updatePosition();

    // Update on resize/scroll
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
    };
  }, [step.target, step.placement]);

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  const spotlightPadding = step.spotlightPadding ?? 8;
  const spotlightRadius = step.spotlightRadius ?? 8;

  return (
    <>
      {/* Overlay with spotlight cutout */}
      <div
        className="fixed inset-0 z-[10000] pointer-events-none"
        style={{
          backgroundColor: overlayColor,
          opacity: overlayOpacity,
        }}
      >
        {targetRect && (
          <svg className="absolute inset-0 w-full h-full">
            <defs>
              <mask id="spotlight-mask">
                <rect width="100%" height="100%" fill="white" />
                <rect
                  x={targetRect.left - spotlightPadding}
                  y={targetRect.top - spotlightPadding}
                  width={targetRect.width + spotlightPadding * 2}
                  height={targetRect.height + spotlightPadding * 2}
                  rx={spotlightRadius}
                  fill="black"
                />
              </mask>
            </defs>
            <rect
              width="100%"
              height="100%"
              fill="black"
              mask="url(#spotlight-mask)"
            />
          </svg>
        )}
      </div>

      {/* Click blocker for non-target areas */}
      <div
        className="fixed inset-0 z-[10000]"
        onClick={(e) => {
          if (step.disableInteraction) {
            e.stopPropagation();
          }
        }}
      />

      {/* Spotlight highlight */}
      {targetRect && (
        <div
          className="fixed z-[10000] pointer-events-none ring-4 ring-blue-500 ring-opacity-50"
          style={{
            left: targetRect.left - spotlightPadding,
            top: targetRect.top - spotlightPadding,
            width: targetRect.width + spotlightPadding * 2,
            height: targetRect.height + spotlightPadding * 2,
            borderRadius: spotlightRadius,
          }}
        />
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="bg-white rounded-lg shadow-2xl border border-gray-200 max-w-sm animate-in fade-in zoom-in-95 duration-200"
        style={tooltipStyle}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">{step.title}</h3>
          {showClose && (
            <button
              type="button"
              className="text-gray-400 hover:text-gray-600 p-1"
              onClick={onClose}
              aria-label="Close tour"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="px-4 py-3">
          {/* Image/Video */}
          {step.image && (
            <img
              src={step.image}
              alt=""
              className="w-full h-32 object-cover rounded-lg mb-3"
            />
          )}
          {step.video && (
            <video
              src={step.video}
              className="w-full h-32 object-cover rounded-lg mb-3"
              autoPlay
              muted
              loop
            />
          )}

          {/* Text content */}
          <div className="text-sm text-gray-600">{step.content}</div>

          {/* Custom action */}
          {step.action && <div className="mt-3">{step.action}</div>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50 rounded-b-lg">
          {/* Progress */}
          <div className="flex items-center gap-2">
            {showProgress && (
              <div className="flex items-center gap-1">
                {Array.from({ length: totalSteps }, (_, i) => (
                  <div
                    key={i}
                    className={clsx(
                      'w-2 h-2 rounded-full transition-colors',
                      i === currentStep
                        ? 'bg-blue-600'
                        : i < currentStep
                        ? 'bg-blue-300'
                        : 'bg-gray-300'
                    )}
                  />
                ))}
              </div>
            )}
            {showSkip && !isLastStep && (
              <button
                type="button"
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 ml-2"
                onClick={onSkip}
              >
                <SkipForward className="w-4 h-4" />
                Skip
              </button>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-2">
            {!step.hidePrev && !isFirstStep && (
              <button
                type="button"
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                onClick={onPrev}
              >
                <ChevronLeft className="w-4 h-4" />
                {step.prevLabel || 'Back'}
              </button>
            )}
            {!step.hideNext && (
              <button
                type="button"
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                onClick={onNext}
              >
                {isLastStep ? (
                  <>
                    <Check className="w-4 h-4" />
                    {step.nextLabel || 'Finish'}
                  </>
                ) : (
                  <>
                    {step.nextLabel || 'Next'}
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ============================================================================
// TourTrigger Component
// ============================================================================

export interface TourTriggerProps {
  children: ReactNode;
  startStep?: number;
}

export function TourTrigger({ children, startStep = 0 }: TourTriggerProps) {
  const { start } = useTour();

  return (
    <span onClick={() => start(startStep)} role="button" tabIndex={0}>
      {children}
    </span>
  );
}

// ============================================================================
// Hotspot Component
// ============================================================================

export interface HotspotProps {
  id: string;
  title: string;
  content: ReactNode;
  placement?: TourPlacement;
  pulse?: boolean;
  children?: ReactNode;
  className?: string;
}

export function Hotspot({
  id,
  title,
  content,
  placement = 'right',
  pulse = true,
  children,
  className,
}: HotspotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const hotspotRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipStyle, setTooltipStyle] = useState<CSSProperties>({});

  useEffect(() => {
    if (isOpen && hotspotRef.current && tooltipRef.current) {
      const hotspotRect = hotspotRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const style = calculateTooltipPosition(hotspotRect, tooltipRect, placement);
      setTooltipStyle(style);
    }
  }, [isOpen, placement]);

  return (
    <div className={clsx('relative inline-flex', className)}>
      {children}
      <div
        ref={hotspotRef}
        className={clsx(
          'absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-500 cursor-pointer',
          pulse && 'animate-pulse'
        )}
        onClick={() => setIsOpen(!isOpen)}
        role="button"
        tabIndex={0}
        aria-label={`Show help for ${title}`}
        data-hotspot-id={id}
      >
        <Circle className="w-4 h-4 text-white" fill="currentColor" />
      </div>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-[9999]"
            onClick={() => setIsOpen(false)}
          />
          <div
            ref={tooltipRef}
            className="bg-white rounded-lg shadow-xl border border-gray-200 p-4 max-w-xs z-[10000]"
            style={tooltipStyle}
          >
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-900">{title}</h4>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-600"
                onClick={() => setIsOpen(false)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-sm text-gray-600">{content}</div>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// FeatureHighlight Component
// ============================================================================

export interface FeatureHighlightProps {
  id: string;
  title: string;
  description: string;
  placement?: TourPlacement;
  dismissible?: boolean;
  onDismiss?: () => void;
  storageKey?: string;
  children: ReactNode;
}

export function FeatureHighlight({
  id,
  title,
  description,
  placement = 'bottom',
  dismissible = true,
  onDismiss,
  storageKey,
  children,
}: FeatureHighlightProps) {
  const [isDismissed, setIsDismissed] = useState(() => {
    if (storageKey) {
      return localStorage.getItem(storageKey) === 'true';
    }
    return false;
  });
  const [isVisible, setIsVisible] = useState(true);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipStyle, setTooltipStyle] = useState<CSSProperties>({});

  useEffect(() => {
    if (!isDismissed && isVisible && wrapperRef.current && tooltipRef.current) {
      const wrapperRect = wrapperRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const style = calculateTooltipPosition(wrapperRect, tooltipRect, placement);
      setTooltipStyle(style);
    }
  }, [isDismissed, isVisible, placement]);

  const handleDismiss = useCallback(() => {
    setIsDismissed(true);
    if (storageKey) {
      localStorage.setItem(storageKey, 'true');
    }
    onDismiss?.();
  }, [storageKey, onDismiss]);

  if (isDismissed) {
    return <>{children}</>;
  }

  return (
    <div ref={wrapperRef} className="relative inline-flex" data-feature-id={id}>
      {children}

      {isVisible && (
        <div
          ref={tooltipRef}
          className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg shadow-xl p-4 max-w-xs z-50"
          style={tooltipStyle}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="font-semibold text-sm mb-1">{title}</h4>
              <p className="text-xs text-blue-100">{description}</p>
            </div>
            {dismissible && (
              <button
                type="button"
                className="text-white/70 hover:text-white shrink-0"
                onClick={handleDismiss}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            type="button"
            className="mt-2 text-xs font-medium text-white/90 hover:text-white"
            onClick={handleDismiss}
          >
            Got it!
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// OnboardingChecklist Component
// ============================================================================

export interface OnboardingTask {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  action?: () => void;
  href?: string;
}

export interface OnboardingChecklistProps {
  tasks: OnboardingTask[];
  title?: string;
  onComplete?: () => void;
  showProgress?: boolean;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  className?: string;
}

export function OnboardingChecklist({
  tasks,
  title = 'Getting Started',
  onComplete,
  showProgress = true,
  collapsible = true,
  defaultCollapsed = false,
  className,
}: OnboardingChecklistProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  const completedCount = tasks.filter((t) => t.completed).length;
  const progress = Math.round((completedCount / tasks.length) * 100);
  const isComplete = completedCount === tasks.length;

  useEffect(() => {
    if (isComplete) {
      onComplete?.();
    }
  }, [isComplete, onComplete]);

  return (
    <div
      className={clsx(
        'bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <div
        className={clsx(
          'flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200',
          collapsible && 'cursor-pointer'
        )}
        onClick={() => collapsible && setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
            {isComplete ? (
              <Check className="w-4 h-4 text-blue-600" />
            ) : (
              <span className="text-sm font-semibold text-blue-600">
                {completedCount}/{tasks.length}
              </span>
            )}
          </div>
          <div>
            <h3 className="font-medium text-gray-900">{title}</h3>
            {showProgress && (
              <div className="flex items-center gap-2 mt-1">
                <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500">{progress}%</span>
              </div>
            )}
          </div>
        </div>
        {collapsible && (
          <ChevronRight
            className={clsx(
              'w-5 h-5 text-gray-400 transition-transform',
              !isCollapsed && 'rotate-90'
            )}
          />
        )}
      </div>

      {/* Tasks */}
      {!isCollapsed && (
        <div className="divide-y divide-gray-100">
          {tasks.map((task) => (
            <div
              key={task.id}
              className={clsx(
                'flex items-start gap-3 px-4 py-3',
                task.action || task.href ? 'cursor-pointer hover:bg-gray-50' : ''
              )}
              onClick={() => {
                if (task.href) {
                  window.location.href = task.href;
                } else {
                  task.action?.();
                }
              }}
            >
              <div
                className={clsx(
                  'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5',
                  task.completed
                    ? 'bg-green-500 border-green-500'
                    : 'border-gray-300'
                )}
              >
                {task.completed && <Check className="w-3 h-3 text-white" />}
              </div>
              <div>
                <p
                  className={clsx(
                    'text-sm font-medium',
                    task.completed ? 'text-gray-500 line-through' : 'text-gray-900'
                  )}
                >
                  {task.title}
                </p>
                {task.description && (
                  <p className="text-xs text-gray-500 mt-0.5">{task.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Exports
// ============================================================================

export default TourProvider;
