import React, { useId, useMemo } from 'react';
import clsx from 'clsx';

/**
 * ARIA utility components and hooks for accessible ERP interfaces
 */

// ============ ARIA ID Generation ============

/**
 * Generate consistent ARIA IDs for related elements
 * @example
 * const ids = useAriaIds('user-select');
 * // ids.label = 'user-select-label-abc123'
 * // ids.input = 'user-select-input-abc123'
 * // ids.description = 'user-select-description-abc123'
 * // ids.error = 'user-select-error-abc123'
 */
export function useAriaIds(prefix: string) {
  const uniqueId = useId();
  
  return useMemo(() => ({
    label: `${prefix}-label${uniqueId}`,
    input: `${prefix}-input${uniqueId}`,
    description: `${prefix}-description${uniqueId}`,
    error: `${prefix}-error${uniqueId}`,
    listbox: `${prefix}-listbox${uniqueId}`,
    option: (index: number) => `${prefix}-option-${index}${uniqueId}`,
    panel: `${prefix}-panel${uniqueId}`,
    tab: (index: number) => `${prefix}-tab-${index}${uniqueId}`,
    tabpanel: (index: number) => `${prefix}-tabpanel-${index}${uniqueId}`,
  }), [prefix, uniqueId]);
}

// ============ Accessible Form Field Wrapper ============

interface AccessibleFieldProps {
  /** Field label text */
  label: string;
  /** Whether to visually hide the label (still accessible) */
  hideLabel?: boolean;
  /** Field ID */
  id: string;
  /** Description/help text */
  description?: string;
  /** Error message */
  error?: string;
  /** Required field indicator */
  required?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** The form input element */
  children: React.ReactNode;
  /** Additional wrapper class */
  className?: string;
}

/**
 * Wrapper that provides proper ARIA labels for form fields
 */
export function AccessibleField({
  label,
  hideLabel = false,
  id,
  description,
  error,
  required = false,
  disabled = false,
  children,
  className,
}: AccessibleFieldProps) {
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={clsx('space-y-1', className)}>
      <label
        htmlFor={id}
        className={clsx(
          'block text-sm font-medium text-gray-700',
          hideLabel && 'sr-only',
          disabled && 'opacity-50'
        )}
      >
        {label}
        {required && (
          <span className="text-red-500 ml-1" aria-hidden="true">
            *
          </span>
        )}
        {required && <span className="sr-only">(required)</span>}
      </label>

      {React.isValidElement(children) &&
        React.cloneElement(children as React.ReactElement<{ 'aria-describedby'?: string; 'aria-invalid'?: boolean }>, {
          'aria-describedby': describedBy,
          'aria-invalid': !!error,
        })}

      {description && !error && (
        <p id={descriptionId} className="text-sm text-gray-500">
          {description}
        </p>
      )}

      {error && (
        <p id={errorId} className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// ============ Accessible Button Patterns ============

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible label for the button (required for icon-only buttons) */
  label: string;
  /** Icon element */
  icon: React.ReactNode;
  /** Show label visually alongside icon */
  showLabel?: boolean;
  /** Button variant */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  /** Button size */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Accessible icon button with proper labeling
 */
export function IconButton({
  label,
  icon,
  showLabel = false,
  variant = 'ghost',
  size = 'md',
  className,
  disabled,
  ...props
}: IconButtonProps) {
  const sizeClasses = {
    sm: 'p-1',
    md: 'p-2',
    lg: 'p-3',
  };

  const variantClasses = {
    primary: 'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-500',
    ghost: 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:ring-gray-500',
    danger: 'text-red-600 hover:text-red-700 hover:bg-red-50 focus:ring-red-500',
  };

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-lg',
        'focus:outline-none focus:ring-2 focus:ring-offset-2',
        'transition-colors duration-150',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {icon}
      {showLabel && <span>{label}</span>}
      {!showLabel && <span className="sr-only">{label}</span>}
    </button>
  );
}

// ============ Accessible Disclosure/Accordion ============

interface DisclosureProps {
  /** Unique ID for the disclosure */
  id: string;
  /** Button/trigger content */
  trigger: React.ReactNode;
  /** Panel content */
  children: React.ReactNode;
  /** Controlled open state */
  isOpen?: boolean;
  /** Callback when open state changes */
  onToggle?: (isOpen: boolean) => void;
  /** Default open state (uncontrolled) */
  defaultOpen?: boolean;
  /** Trigger class name */
  triggerClassName?: string;
  /** Panel class name */
  panelClassName?: string;
}

/**
 * Accessible disclosure/accordion component following WAI-ARIA patterns
 */
export function Disclosure({
  id,
  trigger,
  children,
  isOpen: controlledOpen,
  onToggle,
  defaultOpen = false,
  triggerClassName,
  panelClassName,
}: DisclosureProps) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const isOpen = controlledOpen ?? internalOpen;

  const handleToggle = () => {
    const newState = !isOpen;
    setInternalOpen(newState);
    onToggle?.(newState);
  };

  const panelId = `${id}-panel`;
  const triggerId = `${id}-trigger`;

  return (
    <div>
      <button
        id={triggerId}
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={handleToggle}
        className={clsx(
          'flex items-center justify-between w-full text-left',
          'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
          triggerClassName
        )}
      >
        {trigger}
      </button>
      <div
        id={panelId}
        role="region"
        aria-labelledby={triggerId}
        hidden={!isOpen}
        className={clsx(
          'transition-all duration-200',
          isOpen ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden',
          panelClassName
        )}
      >
        {children}
      </div>
    </div>
  );
}

// ============ Accessible Tabs ============

interface TabsProps {
  /** Unique ID for the tabs */
  id: string;
  /** Tab labels */
  tabs: string[];
  /** Active tab index */
  activeIndex: number;
  /** Callback when tab changes */
  onChange: (index: number) => void;
  /** Tab panel content (array matching tabs) */
  children: React.ReactNode[];
  /** Orientation */
  orientation?: 'horizontal' | 'vertical';
  /** Tab list class name */
  tabListClassName?: string;
  /** Tab button class name */
  tabClassName?: string;
  /** Tab panel class name */
  panelClassName?: string;
}

/**
 * Accessible tabs component following WAI-ARIA tabs pattern
 */
export function AccessibleTabs({
  id,
  tabs,
  activeIndex,
  onChange,
  children,
  orientation = 'horizontal',
  tabListClassName,
  tabClassName,
  panelClassName,
}: TabsProps) {
  const handleKeyDown = (e: React.KeyboardEvent, currentIndex: number) => {
    const isHorizontal = orientation === 'horizontal';
    const prevKey = isHorizontal ? 'ArrowLeft' : 'ArrowUp';
    const nextKey = isHorizontal ? 'ArrowRight' : 'ArrowDown';

    let newIndex = currentIndex;

    switch (e.key) {
      case prevKey:
        e.preventDefault();
        newIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
        break;
      case nextKey:
        e.preventDefault();
        newIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
        break;
      case 'Home':
        e.preventDefault();
        newIndex = 0;
        break;
      case 'End':
        e.preventDefault();
        newIndex = tabs.length - 1;
        break;
      default:
        return;
    }

    onChange(newIndex);
    // Focus the new tab
    const tabButton = document.getElementById(`${id}-tab-${newIndex}`);
    tabButton?.focus();
  };

  return (
    <div>
      <div
        role="tablist"
        aria-orientation={orientation}
        className={tabListClassName}
      >
        {tabs.map((label, index) => (
          <button
            key={index}
            id={`${id}-tab-${index}`}
            role="tab"
            type="button"
            aria-selected={activeIndex === index}
            aria-controls={`${id}-panel-${index}`}
            tabIndex={activeIndex === index ? 0 : -1}
            onClick={() => onChange(index)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={clsx(
              'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-inset',
              tabClassName
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {React.Children.map(children, (child, index) => (
        <div
          key={index}
          id={`${id}-panel-${index}`}
          role="tabpanel"
          aria-labelledby={`${id}-tab-${index}`}
          hidden={activeIndex !== index}
          tabIndex={0}
          className={panelClassName}
        >
          {child}
        </div>
      ))}
    </div>
  );
}

// ============ Accessible Alert ============

interface AlertProps {
  /** Alert variant */
  variant: 'info' | 'success' | 'warning' | 'error';
  /** Alert title */
  title?: string;
  /** Alert message */
  children: React.ReactNode;
  /** Dismissible */
  dismissible?: boolean;
  /** Dismiss callback */
  onDismiss?: () => void;
  /** Additional class name */
  className?: string;
}

/**
 * Accessible alert component with proper ARIA roles
 */
export function AccessibleAlert({
  variant,
  title,
  children,
  dismissible = false,
  onDismiss,
  className,
}: AlertProps) {
  const variantConfig = {
    info: {
      role: 'status' as const,
      bg: 'bg-blue-50 border-blue-200',
      text: 'text-blue-800',
    },
    success: {
      role: 'status' as const,
      bg: 'bg-green-50 border-green-200',
      text: 'text-green-800',
    },
    warning: {
      role: 'alert' as const,
      bg: 'bg-yellow-50 border-yellow-200',
      text: 'text-yellow-800',
    },
    error: {
      role: 'alert' as const,
      bg: 'bg-red-50 border-red-200',
      text: 'text-red-800',
    },
  };

  const config = variantConfig[variant];

  return (
    <div
      role={config.role}
      aria-live={variant === 'error' || variant === 'warning' ? 'assertive' : 'polite'}
      className={clsx(
        'p-4 rounded-lg border',
        config.bg,
        config.text,
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          {title && <p className="font-medium mb-1">{title}</p>}
          <div className="text-sm">{children}</div>
        </div>
        {dismissible && onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss alert"
            className={clsx(
              'p-1 rounded hover:bg-black/10',
              'focus:outline-none focus:ring-2 focus:ring-offset-2'
            )}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

// ============ Progress with ARIA ============

interface AccessibleProgressProps {
  /** Current value */
  value: number;
  /** Maximum value */
  max?: number;
  /** Label for the progress bar */
  label: string;
  /** Show label visually */
  showLabel?: boolean;
  /** Show value */
  showValue?: boolean;
  /** Size */
  size?: 'sm' | 'md' | 'lg';
  /** Color variant */
  variant?: 'primary' | 'success' | 'warning' | 'danger';
  /** Additional class name */
  className?: string;
}

/**
 * Accessible progress bar with proper ARIA attributes
 */
export function AccessibleProgress({
  value,
  max = 100,
  label,
  showLabel = false,
  showValue = false,
  size = 'md',
  variant = 'primary',
  className,
}: AccessibleProgressProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  const sizeClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  const variantClasses = {
    primary: 'bg-primary-600',
    success: 'bg-green-600',
    warning: 'bg-yellow-500',
    danger: 'bg-red-600',
  };

  return (
    <div className={clsx('space-y-1', className)}>
      {(showLabel || showValue) && (
        <div className="flex justify-between text-sm">
          {showLabel && <span className="text-gray-700">{label}</span>}
          {showValue && <span className="text-gray-500">{Math.round(percentage)}%</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
        aria-valuetext={`${Math.round(percentage)}%`}
        className={clsx('w-full bg-gray-200 rounded-full overflow-hidden', sizeClasses[size])}
      >
        <div
          className={clsx('h-full transition-all duration-300', variantClasses[variant])}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {!showLabel && <span className="sr-only">{label}</span>}
    </div>
  );
}
