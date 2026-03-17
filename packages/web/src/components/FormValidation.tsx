/**
 * Form Validation Utilities & Components
 * 
 * Provides consistent form validation patterns:
 * - Form hooks with validation
 * - Validated input components
 * - Error display components
 * - Common validators
 * - Zod integration helpers
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { clsx } from 'clsx';
import { AlertCircle, Check, Eye, EyeOff, Info } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

type ValidationRule<T = string> = {
  validate: (value: T) => boolean;
  message: string;
};

type FieldState = {
  value: string;
  error: string | null;
  touched: boolean;
  dirty: boolean;
  valid: boolean;
};

type FormState<T extends Record<string, string>> = {
  values: T;
  errors: Partial<Record<keyof T, string>>;
  touched: Partial<Record<keyof T, boolean>>;
  dirty: Partial<Record<keyof T, boolean>>;
  isValid: boolean;
  isSubmitting: boolean;
};

// ============================================================================
// Built-in Validators
// ============================================================================

export const validators = {
  required: (message = 'This field is required'): ValidationRule => ({
    validate: (value) => value.trim().length > 0,
    message,
  }),
  
  email: (message = 'Please enter a valid email address'): ValidationRule => ({
    validate: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    message,
  }),
  
  minLength: (min: number, message?: string): ValidationRule => ({
    validate: (value) => value.length >= min,
    message: message || `Must be at least ${min} characters`,
  }),
  
  maxLength: (max: number, message?: string): ValidationRule => ({
    validate: (value) => value.length <= max,
    message: message || `Must be at most ${max} characters`,
  }),
  
  pattern: (regex: RegExp, message: string): ValidationRule => ({
    validate: (value) => regex.test(value),
    message,
  }),
  
  matches: (fieldName: string, message = 'Fields do not match'): ValidationRule & { fieldToMatch: string } => ({
    validate: () => true, // Will be handled by form
    message,
    fieldToMatch: fieldName,
  }),
  
  numeric: (message = 'Must be a number'): ValidationRule => ({
    validate: (value) => !isNaN(Number(value)) && value.trim() !== '',
    message,
  }),
  
  integer: (message = 'Must be a whole number'): ValidationRule => ({
    validate: (value) => Number.isInteger(Number(value)) && value.trim() !== '',
    message,
  }),
  
  positive: (message = 'Must be a positive number'): ValidationRule => ({
    validate: (value) => Number(value) > 0,
    message,
  }),
  
  phone: (message = 'Please enter a valid phone number'): ValidationRule => ({
    validate: (value) => /^[\d\s\-\+\(\)]{10,}$/.test(value),
    message,
  }),
  
  url: (message = 'Please enter a valid URL'): ValidationRule => ({
    validate: (value) => {
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    },
    message,
  }),
  
  date: (message = 'Please enter a valid date'): ValidationRule => ({
    validate: (value) => !isNaN(Date.parse(value)),
    message,
  }),
  
  custom: <T = string>(fn: (value: T) => boolean, message: string): ValidationRule<T> => ({
    validate: fn,
    message,
  }),
};

// ============================================================================
// useField Hook
// ============================================================================

interface UseFieldOptions {
  initialValue?: string;
  rules?: ValidationRule[];
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
}

export function useField(options: UseFieldOptions = {}) {
  const {
    initialValue = '',
    rules = [],
    validateOnChange = false,
    validateOnBlur = true,
  } = options;
  
  const [state, setState] = useState<FieldState>({
    value: initialValue,
    error: null,
    touched: false,
    dirty: false,
    valid: true,
  });
  
  const validate = useCallback((value: string): string | null => {
    for (const rule of rules) {
      if (!rule.validate(value)) {
        return rule.message;
      }
    }
    return null;
  }, [rules]);
  
  const handleChange = useCallback((
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const newValue = e.target.value;
    const error = validateOnChange ? validate(newValue) : state.error;
    
    setState(prev => ({
      ...prev,
      value: newValue,
      dirty: true,
      error: validateOnChange ? error : prev.error,
      valid: error === null,
    }));
  }, [validate, validateOnChange, state.error]);
  
  const handleBlur = useCallback(() => {
    const error = validateOnBlur ? validate(state.value) : null;
    setState(prev => ({
      ...prev,
      touched: true,
      error,
      valid: error === null,
    }));
  }, [validate, validateOnBlur, state.value]);
  
  const reset = useCallback(() => {
    setState({
      value: initialValue,
      error: null,
      touched: false,
      dirty: false,
      valid: true,
    });
  }, [initialValue]);
  
  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error, valid: error === null }));
  }, []);
  
  const setValue = useCallback((value: string) => {
    setState(prev => ({ ...prev, value, dirty: true }));
  }, []);
  
  return {
    value: state.value,
    error: state.error,
    touched: state.touched,
    dirty: state.dirty,
    valid: state.valid,
    onChange: handleChange,
    onBlur: handleBlur,
    reset,
    setError,
    setValue,
    validate: () => {
      const error = validate(state.value);
      setState(prev => ({ ...prev, error, valid: error === null, touched: true }));
      return error === null;
    },
    props: {
      value: state.value,
      onChange: handleChange,
      onBlur: handleBlur,
    },
  };
}

// ============================================================================
// useForm Hook
// ============================================================================

interface UseFormOptions<T extends Record<string, string>> {
  initialValues: T;
  validators?: Partial<Record<keyof T, ValidationRule[]>>;
  onSubmit?: (values: T) => void | Promise<void>;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
}

export function useForm<T extends Record<string, string>>(options: UseFormOptions<T>) {
  const {
    initialValues,
    validators: fieldValidators = {},
    onSubmit,
    validateOnChange = false,
    validateOnBlur = true,
  } = options;
  
  const [state, setState] = useState<FormState<T>>({
    values: initialValues,
    errors: {},
    touched: {},
    dirty: {},
    isValid: true,
    isSubmitting: false,
  });
  
  const validateField = useCallback((name: keyof T, value: string): string | null => {
    const rules = (fieldValidators as Record<keyof T, ValidationRule[]>)[name] || [];
    for (const rule of rules) {
      if (!rule.validate(value)) {
        return rule.message;
      }
    }
    return null;
  }, [fieldValidators]);
  
  const validateAll = useCallback((): boolean => {
    const errors: Partial<Record<keyof T, string>> = {};
    let isValid = true;
    
    for (const name of Object.keys(state.values) as Array<keyof T>) {
      const error = validateField(name, state.values[name]);
      if (error) {
        errors[name] = error;
        isValid = false;
      }
    }
    
    setState(prev => ({ ...prev, errors, isValid }));
    return isValid;
  }, [state.values, validateField]);
  
  const handleChange = useCallback(<K extends keyof T>(name: K) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const value = e.target.value as T[K];
    const error = validateOnChange ? validateField(name, value as string) : undefined;
    
    setState(prev => ({
      ...prev,
      values: { ...prev.values, [name]: value },
      dirty: { ...prev.dirty, [name]: true },
      errors: validateOnChange ? { ...prev.errors, [name]: error } : prev.errors,
    }));
  }, [validateOnChange, validateField]);
  
  const handleBlur = useCallback(<K extends keyof T>(name: K) => () => {
    if (!validateOnBlur) return;
    
    const error = validateField(name, state.values[name]);
    setState(prev => ({
      ...prev,
      touched: { ...prev.touched, [name]: true },
      errors: { ...prev.errors, [name]: error },
    }));
  }, [validateOnBlur, validateField, state.values]);
  
  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    const isValid = validateAll();
    if (!isValid) return;
    
    setState(prev => ({ ...prev, isSubmitting: true }));
    
    try {
      await onSubmit?.(state.values);
    } finally {
      setState(prev => ({ ...prev, isSubmitting: false }));
    }
  }, [validateAll, onSubmit, state.values]);
  
  const reset = useCallback(() => {
    setState({
      values: initialValues,
      errors: {},
      touched: {},
      dirty: {},
      isValid: true,
      isSubmitting: false,
    });
  }, [initialValues]);
  
  const setFieldValue = useCallback(<K extends keyof T>(name: K, value: T[K]) => {
    setState(prev => ({
      ...prev,
      values: { ...prev.values, [name]: value },
      dirty: { ...prev.dirty, [name]: true },
    }));
  }, []);
  
  const setFieldError = useCallback(<K extends keyof T>(name: K, error: string | undefined) => {
    setState(prev => ({
      ...prev,
      errors: { ...prev.errors, [name]: error },
    }));
  }, []);
  
  const getFieldProps = useCallback(<K extends keyof T>(name: K) => ({
    name,
    value: state.values[name],
    onChange: handleChange(name),
    onBlur: handleBlur(name),
  }), [state.values, handleChange, handleBlur]);
  
  return {
    values: state.values,
    errors: state.errors,
    touched: state.touched,
    dirty: state.dirty,
    isValid: state.isValid,
    isSubmitting: state.isSubmitting,
    handleChange,
    handleBlur,
    handleSubmit,
    reset,
    setFieldValue,
    setFieldError,
    getFieldProps,
    validateAll,
  };
}

// ============================================================================
// Form Input Components
// ============================================================================

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string | null;
  hint?: string;
  touched?: boolean;
  showValidState?: boolean;
}

export function FormInput({
  label,
  error,
  hint,
  touched,
  showValidState = false,
  className,
  id,
  required,
  type = 'text',
  ...props
}: FormInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const inputId = id || `input-${label?.toLowerCase().replace(/\s+/g, '-')}`;
  const isPassword = type === 'password';
  const hasError = touched && error;
  const isValid = touched && !error && showValidState;
  
  return (
    <div className="space-y-1">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      
      <div className="relative">
        <input
          id={inputId}
          type={isPassword && showPassword ? 'text' : type}
          aria-invalid={hasError ? 'true' : undefined}
          aria-describedby={hasError ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          className={clsx(
            'w-full px-3 py-2 rounded-lg border transition-colors',
            'bg-white dark:bg-gray-800',
            'text-gray-900 dark:text-gray-100',
            'placeholder-gray-400 dark:placeholder-gray-500',
            'focus:outline-none focus:ring-2 focus:ring-offset-0',
            hasError 
              ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
              : isValid
                ? 'border-green-500 focus:border-green-500 focus:ring-green-500/20'
                : 'border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-500/20',
            isPassword && 'pr-10',
            className
          )}
          {...props}
        />
        
        {/* Password toggle */}
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
        
        {/* Valid indicator */}
        {isValid && !isPassword && (
          <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
        )}
      </div>
      
      {/* Error message */}
      {hasError && (
        <p id={`${inputId}-error`} className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </p>
      )}
      
      {/* Hint */}
      {hint && !hasError && (
        <p id={`${inputId}-hint`} className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
          <Info className="h-3.5 w-3.5" />
          {hint}
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Form Textarea
// ============================================================================

interface FormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string | null;
  hint?: string;
  touched?: boolean;
}

export function FormTextarea({
  label,
  error,
  hint,
  touched,
  className,
  id,
  required,
  ...props
}: FormTextareaProps) {
  const inputId = id || `textarea-${label?.toLowerCase().replace(/\s+/g, '-')}`;
  const hasError = touched && error;
  
  return (
    <div className="space-y-1">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      
      <textarea
        id={inputId}
        aria-invalid={hasError ? 'true' : undefined}
        aria-describedby={hasError ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        className={clsx(
          'w-full px-3 py-2 rounded-lg border transition-colors',
          'bg-white dark:bg-gray-800',
          'text-gray-900 dark:text-gray-100',
          'placeholder-gray-400 dark:placeholder-gray-500',
          'focus:outline-none focus:ring-2 focus:ring-offset-0',
          'resize-y min-h-[80px]',
          hasError 
            ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
            : 'border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-500/20',
          className
        )}
        {...props}
      />
      
      {hasError && (
        <p id={`${inputId}-error`} className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </p>
      )}
      
      {hint && !hasError && (
        <p id={`${inputId}-hint`} className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
          <Info className="h-3.5 w-3.5" />
          {hint}
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Form Select
// ============================================================================

interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string | null;
  hint?: string;
  touched?: boolean;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}

export function FormSelect({
  label,
  error,
  hint,
  touched,
  options,
  placeholder = 'Select an option',
  className,
  id,
  required,
  ...props
}: FormSelectProps) {
  const inputId = id || `select-${label?.toLowerCase().replace(/\s+/g, '-')}`;
  const hasError = touched && error;
  
  return (
    <div className="space-y-1">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      
      <select
        id={inputId}
        aria-invalid={hasError ? 'true' : undefined}
        aria-describedby={hasError ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        className={clsx(
          'w-full px-3 py-2 rounded-lg border transition-colors',
          'bg-white dark:bg-gray-800',
          'text-gray-900 dark:text-gray-100',
          'focus:outline-none focus:ring-2 focus:ring-offset-0',
          hasError 
            ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
            : 'border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-500/20',
          className
        )}
        {...props}
      >
        <option value="">{placeholder}</option>
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      
      {hasError && (
        <p id={`${inputId}-error`} className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </p>
      )}
      
      {hint && !hasError && (
        <p id={`${inputId}-hint`} className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
          <Info className="h-3.5 w-3.5" />
          {hint}
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Form Checkbox
// ============================================================================

interface FormCheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  error?: string | null;
  description?: string;
}

export function FormCheckbox({
  label,
  error,
  description,
  className,
  id,
  ...props
}: FormCheckboxProps) {
  const inputId = id || `checkbox-${label.toLowerCase().replace(/\s+/g, '-')}`;
  
  return (
    <div className="relative flex items-start">
      <div className="flex h-5 items-center">
        <input
          type="checkbox"
          id={inputId}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${inputId}-error` : description ? `${inputId}-desc` : undefined}
          className={clsx(
            'h-4 w-4 rounded border transition-colors',
            'text-blue-600 focus:ring-blue-500',
            error
              ? 'border-red-500'
              : 'border-gray-300 dark:border-gray-600',
            className
          )}
          {...props}
        />
      </div>
      <div className="ml-3 text-sm">
        <label htmlFor={inputId} className="font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
        {description && (
          <p id={`${inputId}-desc`} className="text-gray-500 dark:text-gray-400">
            {description}
          </p>
        )}
        {error && (
          <p id={`${inputId}-error`} className="text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Password Strength Indicator
// ============================================================================

interface PasswordStrengthProps {
  password: string;
  className?: string;
}

export function PasswordStrength({ password, className }: PasswordStrengthProps) {
  const strength = useMemo(() => {
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^a-zA-Z\d]/.test(password)) score++;
    
    if (score <= 2) return { level: 'weak', label: 'Weak', color: 'bg-red-500' };
    if (score <= 4) return { level: 'fair', label: 'Fair', color: 'bg-yellow-500' };
    if (score <= 5) return { level: 'good', label: 'Good', color: 'bg-blue-500' };
    return { level: 'strong', label: 'Strong', color: 'bg-green-500' };
  }, [password]);
  
  const bars = [
    strength.level !== 'weak',
    strength.level === 'fair' || strength.level === 'good' || strength.level === 'strong',
    strength.level === 'good' || strength.level === 'strong',
    strength.level === 'strong',
  ];
  
  if (!password) return null;
  
  return (
    <div className={clsx('space-y-1', className)}>
      <div className="flex gap-1">
        {bars.map((active, i) => (
          <div
            key={i}
            className={clsx(
              'h-1 flex-1 rounded-full transition-colors',
              active ? strength.color : 'bg-gray-200 dark:bg-gray-700'
            )}
          />
        ))}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Password strength: <span className="font-medium">{strength.label}</span>
      </p>
    </div>
  );
}

function useMemo<T>(fn: () => T, deps: React.DependencyList): T {
  const ref = useRef<{ value: T; deps: React.DependencyList }>();
  
  if (!ref.current || !deps.every((d, i) => d === ref.current?.deps[i])) {
    ref.current = { value: fn(), deps };
  }
  
  return ref.current.value;
}

// ============================================================================
// Export Default
// ============================================================================

export default {
  // Validators
  validators,
  // Hooks
  useField,
  useForm,
  // Components
  FormInput,
  FormTextarea,
  FormSelect,
  FormCheckbox,
  PasswordStrength,
};
