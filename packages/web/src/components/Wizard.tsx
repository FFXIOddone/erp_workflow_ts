/**
 * Wizard.tsx - CRITICAL-18
 * 
 * Multi-step form/wizard system for the ERP application.
 * Provides step management, validation, progress indicators,
 * and flexible navigation for complex workflows.
 * 
 * Features:
 * - 18.1: WizardProvider with step state management
 * - 18.2: Step validation with async support
 * - 18.3: Progress indicators (bar, steps, breadcrumbs)
 * - 18.4: Navigation controls with conditional logic
 * - 18.5: Wizard persistence and resume
 * 
 * @module Wizard
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  type ReactNode,
  type ComponentType,
} from 'react';
import { clsx } from 'clsx';
import { Check, ChevronRight, ChevronLeft, AlertCircle, Loader2 } from 'lucide-react';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/** Step status enumeration */
export type StepStatus = 'pending' | 'current' | 'completed' | 'error' | 'skipped';

/** Step definition */
export interface WizardStep<T = unknown> {
  /** Unique step identifier */
  id: string;
  /** Step title */
  title: string;
  /** Optional step description */
  description?: string;
  /** Optional icon component */
  icon?: ComponentType<{ className?: string }>;
  /** Whether the step is optional */
  optional?: boolean;
  /** Whether the step can be skipped */
  skippable?: boolean;
  /** Validation function - return true if valid, string for error message */
  validate?: (data: T) => boolean | string | Promise<boolean | string>;
  /** Whether to show this step (dynamic steps) */
  shouldShow?: (data: T) => boolean;
  /** Component to render for this step */
  component?: ComponentType<WizardStepProps<T>>;
}

/** Props passed to step components */
export interface WizardStepProps<T = unknown> {
  /** Current wizard data */
  data: T;
  /** Update wizard data */
  updateData: (updates: Partial<T>) => void;
  /** Go to next step */
  next: () => Promise<boolean>;
  /** Go to previous step */
  previous: () => void;
  /** Go to specific step */
  goToStep: (stepId: string) => void;
  /** Whether this is the first step */
  isFirst: boolean;
  /** Whether this is the last step */
  isLast: boolean;
  /** Current step index (0-based) */
  currentIndex: number;
  /** Total number of visible steps */
  totalSteps: number;
  /** Validation errors for current step */
  errors: string[];
}

/** Wizard context value */
export interface WizardContextValue<T = unknown> {
  /** Current step ID */
  currentStepId: string;
  /** Current step index (0-based) */
  currentIndex: number;
  /** All visible steps */
  steps: WizardStep<T>[];
  /** Total step count */
  totalSteps: number;
  /** Current wizard data */
  data: T;
  /** Step statuses */
  stepStatuses: Record<string, StepStatus>;
  /** Validation errors per step */
  stepErrors: Record<string, string[]>;
  /** Whether currently validating */
  isValidating: boolean;
  /** Whether wizard is complete */
  isComplete: boolean;
  /** Progress percentage (0-100) */
  progress: number;
  /** Update wizard data */
  updateData: (updates: Partial<T>) => void;
  /** Set entire data object */
  setData: (data: T) => void;
  /** Go to next step */
  next: () => Promise<boolean>;
  /** Go to previous step */
  previous: () => void;
  /** Go to specific step by ID */
  goToStep: (stepId: string) => Promise<boolean>;
  /** Skip current step (if allowed) */
  skipStep: () => void;
  /** Reset wizard to initial state */
  reset: () => void;
  /** Mark step as completed */
  completeStep: (stepId: string) => void;
  /** Mark step as having error */
  setStepError: (stepId: string, errors: string[]) => void;
  /** Submit the wizard (validate all and complete) */
  submit: () => Promise<boolean>;
}

/** Wizard provider props */
export interface WizardProviderProps<T> {
  children: ReactNode;
  /** Step definitions */
  steps: WizardStep<T>[];
  /** Initial data */
  initialData: T;
  /** Initial step ID */
  initialStepId?: string;
  /** Callback when wizard completes */
  onComplete?: (data: T) => void | Promise<void>;
  /** Callback on step change */
  onStepChange?: (stepId: string, data: T) => void;
  /** Callback on data change */
  onDataChange?: (data: T) => void;
  /** Persist wizard state to storage */
  persistKey?: string;
  /** Allow navigation to any step */
  allowJumpToAnyStep?: boolean;
  /** Validate step before leaving */
  validateOnLeave?: boolean;
}

// ============================================================================
// WIZARD CONTEXT
// ============================================================================

const WizardContext = createContext<WizardContextValue<unknown> | null>(null);

/**
 * Hook to access wizard context
 */
export function useWizard<T = unknown>(): WizardContextValue<T> {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error('useWizard must be used within a WizardProvider');
  }
  return context as WizardContextValue<T>;
}

// ============================================================================
// 18.1: WIZARD PROVIDER
// ============================================================================

/**
 * Wizard provider that manages multi-step form state
 * 
 * @example
 * ```tsx
 * const steps = [
 *   { id: 'info', title: 'Basic Info', validate: validateInfo },
 *   { id: 'details', title: 'Details', optional: true },
 *   { id: 'review', title: 'Review' },
 * ];
 * 
 * <WizardProvider steps={steps} initialData={{}} onComplete={handleSubmit}>
 *   <WizardContent />
 * </WizardProvider>
 * ```
 */
export function WizardProvider<T extends Record<string, unknown>>({
  children,
  steps: allSteps,
  initialData,
  initialStepId,
  onComplete,
  onStepChange,
  onDataChange,
  persistKey,
  allowJumpToAnyStep = false,
  validateOnLeave = true,
}: WizardProviderProps<T>) {
  // Load persisted state
  const loadPersistedState = useCallback((): { data: T; stepId: string } | null => {
    if (!persistKey || typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem(`wizard_${persistKey}`);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // Ignore
    }
    return null;
  }, [persistKey]);

  const persisted = useRef(loadPersistedState());

  const [data, setDataInternal] = useState<T>(persisted.current?.data ?? initialData);
  const [currentStepId, setCurrentStepId] = useState<string>(
    persisted.current?.stepId ?? initialStepId ?? allSteps[0]?.id ?? ''
  );
  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus>>({});
  const [stepErrors, setStepErrors] = useState<Record<string, string[]>>({});
  const [isValidating, setIsValidating] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  // Filter visible steps based on shouldShow
  const steps = useMemo(() => {
    return allSteps.filter((step) => !step.shouldShow || step.shouldShow(data));
  }, [allSteps, data]);

  // Get current step index
  const currentIndex = useMemo(() => {
    return steps.findIndex((s) => s.id === currentStepId);
  }, [steps, currentStepId]);

  // Calculate progress
  const progress = useMemo(() => {
    const completedCount = steps.filter(
      (s) => stepStatuses[s.id] === 'completed' || stepStatuses[s.id] === 'skipped'
    ).length;
    return steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0;
  }, [steps, stepStatuses]);

  // Persist state on change
  useEffect(() => {
    if (!persistKey || typeof window === 'undefined') return;
    try {
      localStorage.setItem(
        `wizard_${persistKey}`,
        JSON.stringify({ data, stepId: currentStepId })
      );
    } catch {
      // Storage full or unavailable
    }
  }, [data, currentStepId, persistKey]);

  // Update step statuses when steps or current step changes
  useEffect(() => {
    setStepStatuses((prev) => {
      const next = { ...prev };
      steps.forEach((step, i) => {
        if (!next[step.id]) {
          next[step.id] = i < currentIndex ? 'completed' : i === currentIndex ? 'current' : 'pending';
        } else if (step.id === currentStepId) {
          next[step.id] = 'current';
        }
      });
      return next;
    });
  }, [steps, currentIndex, currentStepId]);

  // Update data
  const updateData = useCallback((updates: Partial<T>) => {
    setDataInternal((prev) => {
      const next = { ...prev, ...updates };
      onDataChange?.(next);
      return next;
    });
  }, [onDataChange]);

  // Set entire data
  const setData = useCallback((newData: T) => {
    setDataInternal(newData);
    onDataChange?.(newData);
  }, [onDataChange]);

  // Validate a step
  const validateStep = useCallback(
    async (stepId: string): Promise<{ valid: boolean; errors: string[] }> => {
      const step = steps.find((s) => s.id === stepId);
      if (!step?.validate) {
        return { valid: true, errors: [] };
      }

      setIsValidating(true);
      try {
        const result = await step.validate(data);
        if (result === true) {
          setStepErrors((prev) => ({ ...prev, [stepId]: [] }));
          return { valid: true, errors: [] };
        }
        const errors = typeof result === 'string' ? [result] : ['Validation failed'];
        setStepErrors((prev) => ({ ...prev, [stepId]: errors }));
        return { valid: false, errors };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Validation error';
        setStepErrors((prev) => ({ ...prev, [stepId]: [message] }));
        return { valid: false, errors: [message] };
      } finally {
        setIsValidating(false);
      }
    },
    [steps, data]
  );

  // Go to next step
  const next = useCallback(async (): Promise<boolean> => {
    if (currentIndex >= steps.length - 1) {
      // On last step - submit
      return submit();
    }

    // Validate current step if required
    if (validateOnLeave) {
      const { valid } = await validateStep(currentStepId);
      if (!valid) {
        setStepStatuses((prev) => ({ ...prev, [currentStepId]: 'error' }));
        return false;
      }
    }

    // Mark current as completed
    setStepStatuses((prev) => ({ ...prev, [currentStepId]: 'completed' }));

    // Move to next step
    const nextStep = steps[currentIndex + 1];
    setCurrentStepId(nextStep.id);
    onStepChange?.(nextStep.id, data);

    return true;
  }, [currentIndex, steps, currentStepId, validateOnLeave, validateStep, onStepChange, data]);

  // Go to previous step
  const previous = useCallback(() => {
    if (currentIndex <= 0) return;

    const prevStep = steps[currentIndex - 1];
    setCurrentStepId(prevStep.id);
    onStepChange?.(prevStep.id, data);
  }, [currentIndex, steps, onStepChange, data]);

  // Go to specific step
  const goToStep = useCallback(
    async (stepId: string): Promise<boolean> => {
      const targetIndex = steps.findIndex((s) => s.id === stepId);
      if (targetIndex === -1) return false;

      // If moving forward, validate all steps in between
      if (targetIndex > currentIndex && !allowJumpToAnyStep) {
        return false;
      }

      // Validate current step if moving forward
      if (targetIndex > currentIndex && validateOnLeave) {
        const { valid } = await validateStep(currentStepId);
        if (!valid) {
          setStepStatuses((prev) => ({ ...prev, [currentStepId]: 'error' }));
          return false;
        }
        setStepStatuses((prev) => ({ ...prev, [currentStepId]: 'completed' }));
      }

      setCurrentStepId(stepId);
      onStepChange?.(stepId, data);
      return true;
    },
    [steps, currentIndex, allowJumpToAnyStep, validateOnLeave, currentStepId, validateStep, onStepChange, data]
  );

  // Skip current step
  const skipStep = useCallback(() => {
    const currentStep = steps[currentIndex];
    if (!currentStep?.skippable && !currentStep?.optional) return;

    setStepStatuses((prev) => ({ ...prev, [currentStepId]: 'skipped' }));

    if (currentIndex < steps.length - 1) {
      const nextStep = steps[currentIndex + 1];
      setCurrentStepId(nextStep.id);
      onStepChange?.(nextStep.id, data);
    }
  }, [steps, currentIndex, currentStepId, onStepChange, data]);

  // Reset wizard
  const reset = useCallback(() => {
    setDataInternal(initialData);
    setCurrentStepId(initialStepId ?? allSteps[0]?.id ?? '');
    setStepStatuses({});
    setStepErrors({});
    setIsComplete(false);

    if (persistKey && typeof window !== 'undefined') {
      localStorage.removeItem(`wizard_${persistKey}`);
    }
  }, [initialData, initialStepId, allSteps, persistKey]);

  // Mark step as completed
  const completeStep = useCallback((stepId: string) => {
    setStepStatuses((prev) => ({ ...prev, [stepId]: 'completed' }));
  }, []);

  // Set step error
  const setStepError = useCallback((stepId: string, errors: string[]) => {
    setStepErrors((prev) => ({ ...prev, [stepId]: errors }));
    if (errors.length > 0) {
      setStepStatuses((prev) => ({ ...prev, [stepId]: 'error' }));
    }
  }, []);

  // Submit wizard (validate all and complete)
  const submit = useCallback(async (): Promise<boolean> => {
    // Validate all required steps
    for (const step of steps) {
      if (step.optional && stepStatuses[step.id] !== 'completed') continue;

      const { valid } = await validateStep(step.id);
      if (!valid) {
        setStepStatuses((prev) => ({ ...prev, [step.id]: 'error' }));
        setCurrentStepId(step.id);
        return false;
      }
      setStepStatuses((prev) => ({ ...prev, [step.id]: 'completed' }));
    }

    // Mark as complete
    setIsComplete(true);

    // Clear persistence
    if (persistKey && typeof window !== 'undefined') {
      localStorage.removeItem(`wizard_${persistKey}`);
    }

    // Call completion handler
    await onComplete?.(data);

    return true;
  }, [steps, stepStatuses, validateStep, persistKey, onComplete, data]);

  const value = useMemo<WizardContextValue<T>>(
    () => ({
      currentStepId,
      currentIndex,
      steps,
      totalSteps: steps.length,
      data,
      stepStatuses,
      stepErrors,
      isValidating,
      isComplete,
      progress,
      updateData,
      setData,
      next,
      previous,
      goToStep,
      skipStep,
      reset,
      completeStep,
      setStepError,
      submit,
    }),
    [
      currentStepId,
      currentIndex,
      steps,
      data,
      stepStatuses,
      stepErrors,
      isValidating,
      isComplete,
      progress,
      updateData,
      setData,
      next,
      previous,
      goToStep,
      skipStep,
      reset,
      completeStep,
      setStepError,
      submit,
    ]
  );

  return (
    <WizardContext.Provider value={value as WizardContextValue<unknown>}>
      {children}
    </WizardContext.Provider>
  );
}

// ============================================================================
// 18.3: PROGRESS INDICATORS
// ============================================================================

/** Props for WizardProgress */
export interface WizardProgressProps {
  /** Visual style */
  variant?: 'bar' | 'steps' | 'breadcrumbs' | 'dots';
  /** Show step labels */
  showLabels?: boolean;
  /** Show step numbers */
  showNumbers?: boolean;
  /** Allow clicking on steps to navigate */
  clickable?: boolean;
  /** Additional CSS class */
  className?: string;
}

/**
 * Progress indicator for wizard
 * 
 * @example
 * ```tsx
 * <WizardProgress variant="steps" clickable showLabels />
 * ```
 */
export function WizardProgress({
  variant = 'steps',
  showLabels = true,
  showNumbers = true,
  clickable = false,
  className,
}: WizardProgressProps) {
  const { steps, currentIndex, stepStatuses, goToStep, progress } = useWizard();

  if (variant === 'bar') {
    return (
      <div className={clsx('space-y-2', className)}>
        <div className="flex justify-between text-sm text-gray-600">
          <span>Step {currentIndex + 1} of {steps.length}</span>
          <span>{progress}% complete</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  }

  if (variant === 'dots') {
    return (
      <div className={clsx('flex items-center justify-center gap-2', className)}>
        {steps.map((step, index) => {
          const status = stepStatuses[step.id] || 'pending';
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => clickable && goToStep(step.id)}
              disabled={!clickable}
              className={clsx(
                'w-3 h-3 rounded-full transition-all duration-200',
                {
                  'bg-blue-600 scale-125': status === 'current',
                  'bg-green-500': status === 'completed',
                  'bg-red-500': status === 'error',
                  'bg-gray-300': status === 'pending' || status === 'skipped',
                  'cursor-pointer hover:scale-110': clickable,
                  'cursor-default': !clickable,
                }
              )}
              aria-label={`Step ${index + 1}: ${step.title}`}
              aria-current={status === 'current' ? 'step' : undefined}
            />
          );
        })}
      </div>
    );
  }

  if (variant === 'breadcrumbs') {
    return (
      <nav className={clsx('flex items-center gap-2', className)} aria-label="Wizard progress">
        {steps.map((step, index) => {
          const status = stepStatuses[step.id] || 'pending';
          const isLast = index === steps.length - 1;

          return (
            <React.Fragment key={step.id}>
              <button
                type="button"
                onClick={() => clickable && goToStep(step.id)}
                disabled={!clickable}
                className={clsx(
                  'text-sm font-medium transition-colors',
                  {
                    'text-blue-600': status === 'current',
                    'text-green-600': status === 'completed',
                    'text-red-600': status === 'error',
                    'text-gray-400': status === 'pending' || status === 'skipped',
                    'hover:text-blue-700': clickable && status !== 'current',
                    'cursor-pointer': clickable,
                  }
                )}
                aria-current={status === 'current' ? 'step' : undefined}
              >
                {step.title}
              </button>
              {!isLast && (
                <ChevronRight className="w-4 h-4 text-gray-400" aria-hidden="true" />
              )}
            </React.Fragment>
          );
        })}
      </nav>
    );
  }

  // Default: steps variant
  return (
    <nav className={clsx('flex items-center', className)} aria-label="Wizard progress">
      {steps.map((step, index) => {
        const status = stepStatuses[step.id] || 'pending';
        const isLast = index === steps.length - 1;
        const Icon = step.icon;

        return (
          <React.Fragment key={step.id}>
            <button
              type="button"
              onClick={() => clickable && goToStep(step.id)}
              disabled={!clickable}
              className={clsx(
                'flex items-center group',
                clickable && 'cursor-pointer'
              )}
              aria-current={status === 'current' ? 'step' : undefined}
            >
              {/* Step indicator */}
              <div
                className={clsx(
                  'flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-200',
                  {
                    'border-blue-600 bg-blue-600 text-white': status === 'current',
                    'border-green-500 bg-green-500 text-white': status === 'completed',
                    'border-red-500 bg-red-50 text-red-600': status === 'error',
                    'border-gray-300 bg-white text-gray-500': status === 'pending',
                    'border-gray-300 bg-gray-100 text-gray-400': status === 'skipped',
                    'group-hover:border-blue-400': clickable && status === 'pending',
                  }
                )}
              >
                {status === 'completed' ? (
                  <Check className="w-5 h-5" />
                ) : status === 'error' ? (
                  <AlertCircle className="w-5 h-5" />
                ) : Icon ? (
                  <Icon className="w-5 h-5" />
                ) : showNumbers ? (
                  <span className="text-sm font-medium">{index + 1}</span>
                ) : null}
              </div>

              {/* Step label */}
              {showLabels && (
                <div className="ml-3 text-left hidden sm:block">
                  <p
                    className={clsx('text-sm font-medium', {
                      'text-blue-600': status === 'current',
                      'text-green-600': status === 'completed',
                      'text-red-600': status === 'error',
                      'text-gray-500': status === 'pending' || status === 'skipped',
                    })}
                  >
                    {step.title}
                  </p>
                  {step.description && (
                    <p className="text-xs text-gray-400">{step.description}</p>
                  )}
                </div>
              )}
            </button>

            {/* Connector line */}
            {!isLast && (
              <div
                className={clsx(
                  'flex-1 h-0.5 mx-4',
                  status === 'completed' ? 'bg-green-500' : 'bg-gray-200'
                )}
                aria-hidden="true"
              />
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

// ============================================================================
// 18.4: NAVIGATION CONTROLS
// ============================================================================

/** Props for WizardNavigation */
export interface WizardNavigationProps {
  /** Show skip button */
  showSkip?: boolean;
  /** Previous button text */
  prevText?: string;
  /** Next button text */
  nextText?: string;
  /** Final step button text */
  submitText?: string;
  /** Skip button text */
  skipText?: string;
  /** Position of buttons */
  align?: 'left' | 'center' | 'right' | 'between';
  /** Additional CSS class */
  className?: string;
}

/**
 * Navigation buttons for wizard
 * 
 * @example
 * ```tsx
 * <WizardNavigation showSkip submitText="Complete Order" />
 * ```
 */
export function WizardNavigation({
  showSkip = false,
  prevText = 'Previous',
  nextText = 'Next',
  submitText = 'Submit',
  skipText = 'Skip',
  align = 'between',
  className,
}: WizardNavigationProps) {
  const { 
    currentIndex, 
    steps, 
    next, 
    previous, 
    skipStep, 
    isValidating 
  } = useWizard();

  const currentStep = steps[currentIndex];
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === steps.length - 1;
  const canSkip = showSkip && (currentStep?.skippable || currentStep?.optional);

  const alignClasses = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
    between: 'justify-between',
  };

  return (
    <div className={clsx('flex items-center gap-4', alignClasses[align], className)}>
      {/* Previous button */}
      <button
        type="button"
        onClick={previous}
        disabled={isFirst}
        className={clsx(
          'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
          isFirst
            ? 'text-gray-400 cursor-not-allowed'
            : 'text-gray-700 hover:bg-gray-100'
        )}
      >
        <ChevronLeft className="w-4 h-4" />
        {prevText}
      </button>

      <div className="flex items-center gap-2">
        {/* Skip button */}
        {canSkip && (
          <button
            type="button"
            onClick={skipStep}
            className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
          >
            {skipText}
          </button>
        )}

        {/* Next/Submit button */}
        <button
          type="button"
          onClick={next}
          disabled={isValidating}
          className={clsx(
            'flex items-center gap-2 px-6 py-2 text-sm font-medium rounded-lg transition-colors',
            'bg-blue-600 text-white hover:bg-blue-700',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {isValidating && <Loader2 className="w-4 h-4 animate-spin" />}
          {isLast ? submitText : nextText}
          {!isLast && <ChevronRight className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// STEP CONTENT COMPONENTS
// ============================================================================

/** Props for WizardStep component */
export interface WizardStepContentProps {
  /** Step ID to render */
  stepId?: string;
  /** Children to render (alternative to step component) */
  children?: ReactNode;
  /** Additional CSS class */
  className?: string;
}

/**
 * Render the current wizard step content
 * 
 * @example
 * ```tsx
 * <WizardStepContent className="p-6" />
 * ```
 */
export function WizardStepContent({ stepId, children, className }: WizardStepContentProps) {
  const { 
    currentStepId, 
    currentIndex, 
    steps, 
    data, 
    updateData, 
    next, 
    previous, 
    goToStep,
    stepErrors,
  } = useWizard();

  const targetStepId = stepId ?? currentStepId;
  const step = steps.find((s) => s.id === targetStepId);

  if (!step) return null;

  const StepComponent = step.component;
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === steps.length - 1;
  const errors = stepErrors[step.id] || [];

  if (StepComponent) {
    return (
      <div className={className}>
        <StepComponent
          data={data}
          updateData={updateData}
          next={next}
          previous={previous}
          goToStep={goToStep}
          isFirst={isFirst}
          isLast={isLast}
          currentIndex={currentIndex}
          totalSteps={steps.length}
          errors={errors}
        />
      </div>
    );
  }

  return <div className={className}>{children}</div>;
}

/** Props for WizardErrors */
export interface WizardErrorsProps {
  /** Show errors for specific step (defaults to current) */
  stepId?: string;
  /** Additional CSS class */
  className?: string;
}

/**
 * Display validation errors for current step
 */
export function WizardErrors({ stepId, className }: WizardErrorsProps) {
  const { currentStepId, stepErrors } = useWizard();
  const errors = stepErrors[stepId ?? currentStepId] || [];

  if (errors.length === 0) return null;

  return (
    <div className={clsx('bg-red-50 border border-red-200 rounded-lg p-4', className)}>
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-red-800">
            Please fix the following errors:
          </p>
          <ul className="mt-2 text-sm text-red-700 list-disc list-inside">
            {errors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 18.5: WIZARD PERSISTENCE HOOK
// ============================================================================

/**
 * Hook for wizard with automatic persistence
 * 
 * @example
 * ```tsx
 * const { canResume, resume, discard } = useWizardPersistence('order-wizard');
 * 
 * if (canResume) {
 *   return <ResumePrompt onResume={resume} onDiscard={discard} />;
 * }
 * ```
 */
export function useWizardPersistence(persistKey: string) {
  const [hasPersistedData, setHasPersistedData] = useState(false);
  const [persistedData, setPersistedData] = useState<unknown>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      const stored = localStorage.getItem(`wizard_${persistKey}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        setPersistedData(parsed);
        setHasPersistedData(true);
      }
    } catch {
      // Ignore
    }
  }, [persistKey]);

  const discard = useCallback(() => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(`wizard_${persistKey}`);
    setHasPersistedData(false);
    setPersistedData(null);
  }, [persistKey]);

  return {
    canResume: hasPersistedData,
    persistedData,
    discard,
  };
}

// ============================================================================
// COMPLETE WIZARD COMPONENT
// ============================================================================

/** Props for Wizard component */
export interface WizardProps<T extends Record<string, unknown>> extends Omit<WizardProviderProps<T>, 'children'> {
  /** Render prop for header */
  renderHeader?: () => ReactNode;
  /** Render prop for progress */
  renderProgress?: () => ReactNode;
  /** Render prop for content */
  renderContent?: (props: WizardStepProps<T>) => ReactNode;
  /** Render prop for navigation */
  renderNavigation?: () => ReactNode;
  /** Render prop for footer */
  renderFooter?: () => ReactNode;
  /** Progress variant */
  progressVariant?: WizardProgressProps['variant'];
  /** Navigation alignment */
  navigationAlign?: WizardNavigationProps['align'];
  /** Additional CSS class */
  className?: string;
}

/**
 * Complete wizard component with sensible defaults
 * 
 * @example
 * ```tsx
 * <Wizard
 *   steps={[
 *     { id: 'info', title: 'Basic Info', component: InfoStep },
 *     { id: 'details', title: 'Details', component: DetailsStep },
 *     { id: 'review', title: 'Review', component: ReviewStep },
 *   ]}
 *   initialData={{ name: '', email: '' }}
 *   onComplete={handleSubmit}
 *   progressVariant="steps"
 * />
 * ```
 */
export function Wizard<T extends Record<string, unknown>>({
  renderHeader,
  renderProgress,
  renderContent,
  renderNavigation,
  renderFooter,
  progressVariant = 'steps',
  navigationAlign = 'between',
  className,
  ...providerProps
}: WizardProps<T>) {
  return (
    <WizardProvider {...providerProps}>
      <div className={clsx('flex flex-col', className)}>
        {/* Header */}
        {renderHeader?.()}

        {/* Progress */}
        {renderProgress ? (
          renderProgress()
        ) : (
          <WizardProgress variant={progressVariant} showLabels className="mb-8" />
        )}

        {/* Errors */}
        <WizardErrors className="mb-4" />

        {/* Content */}
        {renderContent ? (
          <WizardStepContentWithRender render={renderContent} />
        ) : (
          <WizardStepContent className="flex-1 min-h-0" />
        )}

        {/* Navigation */}
        {renderNavigation ? (
          renderNavigation()
        ) : (
          <WizardNavigation align={navigationAlign} className="mt-8 pt-4 border-t" />
        )}

        {/* Footer */}
        {renderFooter?.()}
      </div>
    </WizardProvider>
  );
}

// Helper component for render prop
function WizardStepContentWithRender<T>({
  render,
}: {
  render: (props: WizardStepProps<T>) => ReactNode;
}) {
  const context = useWizard<T>();
  const currentStep = context.steps[context.currentIndex];

  return (
    <>
      {render({
        data: context.data,
        updateData: context.updateData,
        next: context.next,
        previous: context.previous,
        goToStep: context.goToStep,
        isFirst: context.currentIndex === 0,
        isLast: context.currentIndex === context.steps.length - 1,
        currentIndex: context.currentIndex,
        totalSteps: context.totalSteps,
        errors: context.stepErrors[currentStep?.id] || [],
      })}
    </>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

// Types are exported inline at their definitions
