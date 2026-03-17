/**
 * Stepper.tsx - CRITICAL-29
 * 
 * Step indicator component for multi-step forms and wizards.
 * Provides visual progress tracking and navigation.
 * 
 * Features:
 * - 29.1: Horizontal and vertical orientations
 * - 29.2: Numbered, icon, and dot step indicators
 * - 29.3: Step validation states (error, warning, success)
 * - 29.4: Clickable navigation between steps
 * - 29.5: Mobile-responsive layout
 * 
 * @module Stepper
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { clsx } from 'clsx';
import {
  Check,
  X,
  AlertTriangle,
  AlertCircle,
  Circle,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/** Step status */
export type StepStatus = 'pending' | 'active' | 'completed' | 'error' | 'warning' | 'skipped';

/** Step definition */
export interface Step {
  /** Unique identifier */
  id: string;
  /** Step label */
  label: string;
  /** Optional description */
  description?: string;
  /** Optional icon */
  icon?: ReactNode;
  /** Step status (overrides computed) */
  status?: StepStatus;
  /** Whether step is disabled */
  disabled?: boolean;
  /** Whether step is optional */
  optional?: boolean;
  /** Custom content for step */
  content?: ReactNode;
}

/** Stepper orientation */
export type StepperOrientation = 'horizontal' | 'vertical';

/** Step indicator style */
export type StepIndicatorStyle = 'number' | 'icon' | 'dot' | 'none';

/** Stepper context value */
export interface StepperContextValue {
  /** Current step index */
  currentStep: number;
  /** Total steps */
  totalSteps: number;
  /** Go to step */
  goToStep: (index: number) => void;
  /** Go to next step */
  nextStep: () => void;
  /** Go to previous step */
  prevStep: () => void;
  /** Get step status */
  getStepStatus: (index: number) => StepStatus;
  /** Is step clickable */
  isStepClickable: (index: number) => boolean;
  /** Orientation */
  orientation: StepperOrientation;
  /** Indicator style */
  indicatorStyle: StepIndicatorStyle;
  /** Is linear (can only go forward) */
  isLinear: boolean;
}

/** Stepper props */
export interface StepperProps {
  /** Steps configuration */
  steps: Step[];
  /** Current step index */
  activeStep?: number;
  /** Default active step */
  defaultActiveStep?: number;
  /** On step change */
  onStepChange?: (step: number, direction: 'next' | 'prev' | 'jump') => void;
  /** On complete (after last step) */
  onComplete?: () => void;
  /** Orientation */
  orientation?: StepperOrientation;
  /** Indicator style */
  indicatorStyle?: StepIndicatorStyle;
  /** Allow clicking on any step */
  nonLinear?: boolean;
  /** Allow clicking completed steps only */
  completedOnly?: boolean;
  /** Show step numbers */
  showNumbers?: boolean;
  /** Show connector lines */
  showConnector?: boolean;
  /** Alternative label (below icon) */
  alternativeLabel?: boolean;
  /** Render step content */
  renderStepContent?: (step: Step, index: number) => ReactNode;
  /** Class name */
  className?: string;
  /** Step class name */
  stepClassName?: string;
  /** ARIA label */
  'aria-label'?: string;
}

/** Step component props */
export interface StepItemProps {
  /** Step data */
  step: Step;
  /** Step index */
  index: number;
  /** Is first step */
  isFirst: boolean;
  /** Is last step */
  isLast: boolean;
  /** Show connector */
  showConnector?: boolean;
  /** Alternative label position */
  alternativeLabel?: boolean;
  /** Custom step class */
  className?: string;
}

// ============================================================================
// CONTEXT
// ============================================================================

const StepperContext = createContext<StepperContextValue | null>(null);

function useStepperContext(): StepperContextValue {
  const context = useContext(StepperContext);
  if (!context) {
    throw new Error('useStepperContext must be used within a Stepper');
  }
  return context;
}

/** Hook to access stepper context */
export function useStepper(): StepperContextValue {
  return useStepperContext();
}

// ============================================================================
// 29.1-29.5: STEPPER COMPONENT
// ============================================================================

/**
 * Step indicator component for multi-step workflows
 * 
 * @example
 * ```tsx
 * const steps = [
 *   { id: 'info', label: 'Basic Info' },
 *   { id: 'details', label: 'Details', optional: true },
 *   { id: 'review', label: 'Review' },
 * ];
 * 
 * <Stepper
 *   steps={steps}
 *   activeStep={currentStep}
 *   onStepChange={(step) => setCurrentStep(step)}
 * />
 * ```
 */
export function Stepper({
  steps,
  activeStep: controlledActiveStep,
  defaultActiveStep = 0,
  onStepChange,
  onComplete,
  orientation = 'horizontal',
  indicatorStyle = 'number',
  nonLinear = false,
  completedOnly = false,
  showNumbers = true,
  showConnector = true,
  alternativeLabel = false,
  renderStepContent,
  className,
  stepClassName,
  'aria-label': ariaLabel = 'Progress steps',
}: StepperProps) {
  const [internalStep, setInternalStep] = useState(defaultActiveStep);

  const currentStep = controlledActiveStep ?? internalStep;
  const totalSteps = steps.length;
  const isLinear = !nonLinear;

  // Get step status
  const getStepStatus = useCallback((index: number): StepStatus => {
    const step = steps[index];
    if (step.status) return step.status;
    if (index === currentStep) return 'active';
    if (index < currentStep) return 'completed';
    return 'pending';
  }, [steps, currentStep]);

  // Check if step is clickable
  const isStepClickable = useCallback((index: number): boolean => {
    const step = steps[index];
    if (step.disabled) return false;
    if (nonLinear) return true;
    if (completedOnly) return index < currentStep;
    return index <= currentStep;
  }, [steps, currentStep, nonLinear, completedOnly]);

  // Go to specific step
  const goToStep = useCallback((index: number) => {
    if (index < 0 || index >= totalSteps) return;
    if (!isStepClickable(index)) return;

    const direction = index > currentStep ? 'next' : index < currentStep ? 'prev' : 'jump';
    
    if (controlledActiveStep === undefined) {
      setInternalStep(index);
    }
    onStepChange?.(index, direction);
  }, [totalSteps, currentStep, controlledActiveStep, onStepChange, isStepClickable]);

  // Next step
  const nextStep = useCallback(() => {
    if (currentStep >= totalSteps - 1) {
      onComplete?.();
      return;
    }
    goToStep(currentStep + 1);
  }, [currentStep, totalSteps, goToStep, onComplete]);

  // Previous step
  const prevStep = useCallback(() => {
    if (currentStep <= 0) return;
    goToStep(currentStep - 1);
  }, [currentStep, goToStep]);

  // Context value
  const contextValue = useMemo<StepperContextValue>(() => ({
    currentStep,
    totalSteps,
    goToStep,
    nextStep,
    prevStep,
    getStepStatus,
    isStepClickable,
    orientation,
    indicatorStyle,
    isLinear,
  }), [
    currentStep,
    totalSteps,
    goToStep,
    nextStep,
    prevStep,
    getStepStatus,
    isStepClickable,
    orientation,
    indicatorStyle,
    isLinear,
  ]);

  return (
    <StepperContext.Provider value={contextValue}>
      <nav
        aria-label={ariaLabel}
        className={clsx(
          orientation === 'horizontal'
            ? 'flex items-start'
            : 'flex flex-col',
          alternativeLabel && orientation === 'horizontal' && 'text-center',
          className
        )}
      >
        {steps.map((step, index) => (
          <StepItem
            key={step.id}
            step={step}
            index={index}
            isFirst={index === 0}
            isLast={index === totalSteps - 1}
            showConnector={showConnector}
            alternativeLabel={alternativeLabel}
            className={stepClassName}
          />
        ))}
      </nav>
      
      {/* Step content */}
      {renderStepContent && (
        <div className="mt-4">
          {renderStepContent(steps[currentStep], currentStep)}
        </div>
      )}
    </StepperContext.Provider>
  );
}

// ============================================================================
// STEP ITEM
// ============================================================================

function StepItem({
  step,
  index,
  isFirst,
  isLast,
  showConnector,
  alternativeLabel,
  className,
}: StepItemProps) {
  const {
    goToStep,
    getStepStatus,
    isStepClickable,
    orientation,
    indicatorStyle,
  } = useStepperContext();

  const status = getStepStatus(index);
  const clickable = isStepClickable(index);
  const isHorizontal = orientation === 'horizontal';

  const handleClick = () => {
    if (clickable) {
      goToStep(index);
    }
  };

  return (
    <div
      className={clsx(
        isHorizontal
          ? alternativeLabel
            ? 'flex flex-col items-center flex-1'
            : 'flex items-center flex-1'
          : 'flex',
        className
      )}
    >
      {/* Step button/indicator */}
      <button
        type="button"
        onClick={handleClick}
        disabled={!clickable}
        className={clsx(
          'flex items-center gap-3',
          isHorizontal && alternativeLabel && 'flex-col',
          clickable && 'cursor-pointer',
          !clickable && step.disabled && 'opacity-50 cursor-not-allowed',
          !clickable && !step.disabled && 'cursor-default'
        )}
        aria-current={status === 'active' ? 'step' : undefined}
      >
        {/* Indicator */}
        <StepIndicator
          index={index}
          status={status}
          icon={step.icon}
          style={indicatorStyle}
        />

        {/* Label */}
        <div
          className={clsx(
            isHorizontal && alternativeLabel ? 'mt-2' : ''
          )}
        >
          <div
            className={clsx(
              'text-sm font-medium',
              status === 'active' && 'text-blue-600 dark:text-blue-400',
              status === 'completed' && 'text-green-600 dark:text-green-400',
              status === 'error' && 'text-red-600 dark:text-red-400',
              status === 'warning' && 'text-amber-600 dark:text-amber-400',
              (status === 'pending' || status === 'skipped') && 'text-gray-500 dark:text-gray-400'
            )}
          >
            {step.label}
          </div>
          {step.description && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {step.description}
            </div>
          )}
          {step.optional && (
            <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              Optional
            </div>
          )}
        </div>
      </button>

      {/* Connector */}
      {showConnector && !isLast && (
        <StepConnector
          status={status}
          orientation={orientation}
          alternativeLabel={alternativeLabel}
        />
      )}
    </div>
  );
}

// ============================================================================
// STEP INDICATOR
// ============================================================================

interface StepIndicatorProps {
  index: number;
  status: StepStatus;
  icon?: ReactNode;
  style: StepIndicatorStyle;
}

function StepIndicator({ index, status, icon, style }: StepIndicatorProps) {
  const baseClasses = clsx(
    'flex items-center justify-center rounded-full transition-colors',
    style === 'dot' ? 'w-3 h-3' : 'w-8 h-8'
  );

  const statusClasses = clsx(
    status === 'active' && 'bg-blue-500 text-white ring-4 ring-blue-100 dark:ring-blue-900',
    status === 'completed' && 'bg-green-500 text-white',
    status === 'error' && 'bg-red-500 text-white',
    status === 'warning' && 'bg-amber-500 text-white',
    (status === 'pending' || status === 'skipped') && 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
  );

  if (style === 'dot') {
    return (
      <div className={clsx(baseClasses, statusClasses)} />
    );
  }

  if (style === 'none') {
    return null;
  }

  // Get icon based on status
  const getStatusIcon = () => {
    if (icon && status === 'active') return icon;
    
    switch (status) {
      case 'completed':
        return <Check className="w-4 h-4" />;
      case 'error':
        return <X className="w-4 h-4" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4" />;
      case 'skipped':
        return <Circle className="w-4 h-4" />;
      default:
        return icon || (
          <span className="text-sm font-medium">{index + 1}</span>
        );
    }
  };

  return (
    <div className={clsx(baseClasses, statusClasses)}>
      {style === 'icon' ? (icon || getStatusIcon()) : getStatusIcon()}
    </div>
  );
}

// ============================================================================
// STEP CONNECTOR
// ============================================================================

interface StepConnectorProps {
  status: StepStatus;
  orientation: StepperOrientation;
  alternativeLabel?: boolean;
}

function StepConnector({ status, orientation, alternativeLabel }: StepConnectorProps) {
  const isCompleted = status === 'completed';
  const isHorizontal = orientation === 'horizontal';

  if (isHorizontal) {
    return (
      <div
        className={clsx(
          'flex-1 mx-2',
          alternativeLabel && 'absolute left-1/2 right-0 top-4'
        )}
      >
        <div
          className={clsx(
            'h-0.5 transition-colors',
            isCompleted ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'
          )}
        />
      </div>
    );
  }

  return (
    <div className="ml-4 pl-4 border-l-2 border-gray-200 dark:border-gray-700 min-h-[24px]" />
  );
}

// ============================================================================
// STEP NAVIGATION BUTTONS
// ============================================================================

export interface StepNavigationProps {
  /** Previous button label */
  prevLabel?: string;
  /** Next button label */
  nextLabel?: string;
  /** Complete button label (last step) */
  completeLabel?: string;
  /** Show previous on first step */
  showPrevOnFirst?: boolean;
  /** Disable next (e.g., validation failed) */
  disableNext?: boolean;
  /** Custom buttons */
  children?: ReactNode;
  /** Class name */
  className?: string;
}

/**
 * Navigation buttons for stepper
 * 
 * @example
 * ```tsx
 * <StepNavigation
 *   disableNext={!isValid}
 *   completeLabel="Submit"
 * />
 * ```
 */
export function StepNavigation({
  prevLabel = 'Previous',
  nextLabel = 'Next',
  completeLabel = 'Complete',
  showPrevOnFirst = false,
  disableNext = false,
  children,
  className,
}: StepNavigationProps) {
  const { currentStep, totalSteps, prevStep, nextStep } = useStepper();

  const isFirst = currentStep === 0;
  const isLast = currentStep === totalSteps - 1;

  return (
    <div className={clsx('flex items-center justify-between', className)}>
      <div>
        {(showPrevOnFirst || !isFirst) && (
          <button
            type="button"
            onClick={prevStep}
            disabled={isFirst}
            className={clsx(
              'px-4 py-2 text-sm font-medium rounded-md transition-colors',
              'text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800',
              'border border-gray-300 dark:border-gray-600',
              'hover:bg-gray-50 dark:hover:bg-gray-700',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {prevLabel}
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        {children}
        <button
          type="button"
          onClick={nextStep}
          disabled={disableNext}
          className={clsx(
            'px-4 py-2 text-sm font-medium rounded-md transition-colors',
            'bg-blue-500 text-white hover:bg-blue-600',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {isLast ? completeLabel : nextLabel}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// STEP PROGRESS
// ============================================================================

export interface StepProgressProps {
  /** Show percentage */
  showPercentage?: boolean;
  /** Show step count */
  showCount?: boolean;
  /** Bar height */
  height?: number;
  /** Class name */
  className?: string;
}

/**
 * Progress bar for stepper
 */
export function StepProgress({
  showPercentage = false,
  showCount = false,
  height = 4,
  className,
}: StepProgressProps) {
  const { currentStep, totalSteps } = useStepper();

  const progress = (currentStep / (totalSteps - 1)) * 100;

  return (
    <div className={clsx('w-full', className)}>
      <div className="flex items-center gap-2 mb-1">
        {showCount && (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Step {currentStep + 1} of {totalSteps}
          </span>
        )}
        {showPercentage && (
          <span className="text-sm text-gray-500 dark:text-gray-400 ml-auto">
            {Math.round(progress)}%
          </span>
        )}
      </div>
      <div
        className="w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"
        style={{ height }}
      >
        <div
          className="h-full bg-blue-500 transition-all duration-300 rounded-full"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// ============================================================================
// SIMPLE STEPPER (minimal variant)
// ============================================================================

export interface SimpleStepperProps {
  /** Total steps */
  steps: number;
  /** Current step (1-indexed) */
  currentStep: number;
  /** On step click */
  onStepClick?: (step: number) => void;
  /** Size */
  size?: 'sm' | 'md' | 'lg';
  /** Class name */
  className?: string;
}

/**
 * Minimal step indicator (just dots/numbers)
 * 
 * @example
 * ```tsx
 * <SimpleStepper steps={5} currentStep={2} />
 * ```
 */
export function SimpleStepper({
  steps,
  currentStep,
  onStepClick,
  size = 'md',
  className,
}: SimpleStepperProps) {
  const sizeClasses = {
    sm: 'w-2 h-2 gap-1.5',
    md: 'w-3 h-3 gap-2',
    lg: 'w-4 h-4 gap-3',
  };

  return (
    <div className={clsx('flex items-center', sizeClasses[size], className)}>
      {Array.from({ length: steps }).map((_, index) => {
        const stepNum = index + 1;
        const isActive = stepNum === currentStep;
        const isCompleted = stepNum < currentStep;

        return (
          <button
            key={index}
            type="button"
            onClick={() => onStepClick?.(stepNum)}
            disabled={!onStepClick}
            className={clsx(
              'rounded-full transition-all',
              sizeClasses[size].split(' ')[0],
              sizeClasses[size].split(' ')[1],
              isActive && 'bg-blue-500 ring-2 ring-blue-200 dark:ring-blue-800',
              isCompleted && 'bg-green-500',
              !isActive && !isCompleted && 'bg-gray-300 dark:bg-gray-600',
              onStepClick && 'cursor-pointer hover:opacity-80',
              !onStepClick && 'cursor-default'
            )}
            aria-label={`Step ${stepNum}`}
            aria-current={isActive ? 'step' : undefined}
          />
        );
      })}
    </div>
  );
}

// ============================================================================
// VERTICAL TIMELINE STEPPER
// ============================================================================

export interface TimelineStepperProps {
  /** Steps */
  steps: Array<{
    id: string;
    label: string;
    description?: string;
    timestamp?: string;
    icon?: ReactNode;
    status?: StepStatus;
  }>;
  /** Class name */
  className?: string;
}

/**
 * Vertical timeline-style stepper
 * 
 * @example
 * ```tsx
 * <TimelineStepper
 *   steps={[
 *     { id: '1', label: 'Order placed', timestamp: '10:30 AM', status: 'completed' },
 *     { id: '2', label: 'Processing', timestamp: '11:00 AM', status: 'active' },
 *   ]}
 * />
 * ```
 */
export function TimelineStepper({ steps, className }: TimelineStepperProps) {
  return (
    <div className={clsx('space-y-0', className)}>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const status = step.status || (index === 0 ? 'active' : 'pending');

        return (
          <div key={step.id} className="flex">
            {/* Timeline */}
            <div className="flex flex-col items-center mr-4">
              {/* Dot */}
              <div
                className={clsx(
                  'w-3 h-3 rounded-full border-2',
                  status === 'completed' && 'bg-green-500 border-green-500',
                  status === 'active' && 'bg-blue-500 border-blue-500',
                  status === 'error' && 'bg-red-500 border-red-500',
                  (status === 'pending' || status === 'skipped') && 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600'
                )}
              />
              {/* Line */}
              {!isLast && (
                <div
                  className={clsx(
                    'w-0.5 flex-1 min-h-[24px]',
                    status === 'completed' ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'
                  )}
                />
              )}
            </div>

            {/* Content */}
            <div className={clsx('pb-6', isLast && 'pb-0')}>
              <div className="flex items-center gap-2">
                {step.icon}
                <span
                  className={clsx(
                    'font-medium',
                    status === 'active' && 'text-blue-600 dark:text-blue-400',
                    status === 'completed' && 'text-gray-900 dark:text-gray-100',
                    status === 'pending' && 'text-gray-500 dark:text-gray-400'
                  )}
                >
                  {step.label}
                </span>
                {step.timestamp && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {step.timestamp}
                  </span>
                )}
              </div>
              {step.description && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {step.description}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

// Types are exported inline at their definitions
