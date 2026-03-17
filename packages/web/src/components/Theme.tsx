/**
 * Theme System - Dark Mode & Consistent Theming
 * 
 * Provides:
 * - Theme provider with system preference detection
 * - useTheme hook for accessing/toggling theme
 * - Consistent color tokens for light/dark modes
 * - Theme-aware component utilities
 * 
 * @example
 * // Wrap app in provider
 * <ThemeProvider><App /></ThemeProvider>
 * 
 * // Use in components
 * const { theme, toggleTheme, isDark } = useTheme();
 */

import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  useMemo,
} from 'react';
import { clsx } from 'clsx';

// ============================================================================
// Types
// ============================================================================

export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  isDark: boolean;
  isLight: boolean;
  isSystem: boolean;
}

// ============================================================================
// Color Tokens
// ============================================================================

/**
 * Semantic color tokens that adapt to theme.
 * Use these instead of hardcoded Tailwind colors for consistency.
 */
export const colorTokens = {
  // Backgrounds
  bg: {
    primary: 'bg-white dark:bg-gray-900',
    secondary: 'bg-gray-50 dark:bg-gray-800',
    tertiary: 'bg-gray-100 dark:bg-gray-700',
    elevated: 'bg-white dark:bg-gray-800 shadow-lg dark:shadow-gray-900/50',
    overlay: 'bg-black/50 dark:bg-black/70',
    inverse: 'bg-gray-900 dark:bg-white',
  },
  
  // Text
  text: {
    primary: 'text-gray-900 dark:text-gray-100',
    secondary: 'text-gray-600 dark:text-gray-400',
    tertiary: 'text-gray-500 dark:text-gray-500',
    muted: 'text-gray-400 dark:text-gray-600',
    inverse: 'text-white dark:text-gray-900',
    link: 'text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300',
  },
  
  // Borders
  border: {
    default: 'border-gray-200 dark:border-gray-700',
    strong: 'border-gray-300 dark:border-gray-600',
    subtle: 'border-gray-100 dark:border-gray-800',
    focus: 'border-blue-500 dark:border-blue-400',
  },
  
  // Status Colors (these work in both modes)
  status: {
    success: {
      bg: 'bg-green-100 dark:bg-green-900/30',
      text: 'text-green-800 dark:text-green-300',
      border: 'border-green-200 dark:border-green-800',
    },
    warning: {
      bg: 'bg-yellow-100 dark:bg-yellow-900/30',
      text: 'text-yellow-800 dark:text-yellow-300',
      border: 'border-yellow-200 dark:border-yellow-800',
    },
    error: {
      bg: 'bg-red-100 dark:bg-red-900/30',
      text: 'text-red-800 dark:text-red-300',
      border: 'border-red-200 dark:border-red-800',
    },
    info: {
      bg: 'bg-blue-100 dark:bg-blue-900/30',
      text: 'text-blue-800 dark:text-blue-300',
      border: 'border-blue-200 dark:border-blue-800',
    },
  },
  
  // Interactive States
  interactive: {
    hover: 'hover:bg-gray-100 dark:hover:bg-gray-700',
    active: 'active:bg-gray-200 dark:active:bg-gray-600',
    selected: 'bg-blue-50 dark:bg-blue-900/30',
    disabled: 'opacity-50 cursor-not-allowed',
  },
  
  // Form Elements
  form: {
    input: 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500',
    focus: 'focus:border-blue-500 focus:ring-blue-500 dark:focus:border-blue-400 dark:focus:ring-blue-400',
    error: 'border-red-500 dark:border-red-400 focus:ring-red-500 dark:focus:ring-red-400',
  },
  
  // Buttons
  button: {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-500 dark:hover:bg-blue-600',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-100',
    ghost: 'bg-transparent hover:bg-gray-100 text-gray-700 dark:hover:bg-gray-800 dark:text-gray-300',
    danger: 'bg-red-600 hover:bg-red-700 text-white dark:bg-red-500 dark:hover:bg-red-600',
    outline: 'border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800',
  },
} as const;

// ============================================================================
// Theme Context
// ============================================================================

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'erp-theme-preference';

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  return 'system';
}

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
}

export function ThemeProvider({ 
  children, 
  defaultTheme = 'system' 
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      return getStoredTheme();
    }
    return defaultTheme;
  });
  
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme);
  
  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);
  
  // Resolve the actual theme
  const resolvedTheme: ResolvedTheme = theme === 'system' ? systemTheme : theme;
  
  // Apply theme class to document
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(resolvedTheme);
    
    // Also set color-scheme for native elements
    root.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);
  
  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
  }, []);
  
  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme, setTheme]);
  
  const value = useMemo<ThemeContextValue>(() => ({
    theme,
    resolvedTheme,
    setTheme,
    toggleTheme,
    isDark: resolvedTheme === 'dark',
    isLight: resolvedTheme === 'light',
    isSystem: theme === 'system',
  }), [theme, resolvedTheme, setTheme, toggleTheme]);
  
  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// ============================================================================
// useTheme Hook
// ============================================================================

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// ============================================================================
// Theme Toggle Component
// ============================================================================

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function ThemeToggle({ 
  className, 
  showLabel = false,
  size = 'md',
}: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
  };
  
  const iconSizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };
  
  return (
    <div className={clsx('inline-flex items-center gap-2', className)}>
      <button
        type="button"
        onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
        className={clsx(
          'inline-flex items-center justify-center rounded-md',
          'bg-gray-100 dark:bg-gray-800',
          'hover:bg-gray-200 dark:hover:bg-gray-700',
          'transition-colors duration-200',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
          sizeClasses[size]
        )}
        aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
      >
        {/* Sun icon (shown in dark mode) */}
        <svg
          className={clsx(
            iconSizeClasses[size],
            'transition-transform duration-300',
            resolvedTheme === 'dark' ? 'rotate-0 scale-100' : 'rotate-90 scale-0 absolute'
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
        
        {/* Moon icon (shown in light mode) */}
        <svg
          className={clsx(
            iconSizeClasses[size],
            'transition-transform duration-300',
            resolvedTheme === 'light' ? 'rotate-0 scale-100' : '-rotate-90 scale-0 absolute'
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
          />
        </svg>
      </button>
      
      {showLabel && (
        <span className={colorTokens.text.secondary}>
          {resolvedTheme === 'dark' ? 'Dark' : 'Light'} Mode
        </span>
      )}
    </div>
  );
}

// ============================================================================
// Theme Selector Component (Light/Dark/System)
// ============================================================================

interface ThemeSelectorProps {
  className?: string;
}

export function ThemeSelector({ className }: ThemeSelectorProps) {
  const { theme, setTheme } = useTheme();
  
  const options: { value: Theme; label: string; icon: React.ReactNode }[] = [
    {
      value: 'light',
      label: 'Light',
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
    },
    {
      value: 'dark',
      label: 'Dark',
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      ),
    },
    {
      value: 'system',
      label: 'System',
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
  ];
  
  return (
    <div 
      className={clsx(
        'inline-flex rounded-lg p-1',
        colorTokens.bg.secondary,
        className
      )}
      role="radiogroup"
      aria-label="Theme selection"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={theme === option.value}
          onClick={() => setTheme(option.value)}
          className={clsx(
            'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md',
            'transition-colors duration-200',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
            theme === option.value
              ? clsx(colorTokens.bg.primary, colorTokens.text.primary, 'shadow-sm')
              : clsx('transparent', colorTokens.text.secondary, 'hover:text-gray-900 dark:hover:text-gray-100')
          )}
        >
          {option.icon}
          <span className="hidden sm:inline">{option.label}</span>
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// Theme-Aware Utility Classes
// ============================================================================

/**
 * Apply consistent themed classes to common patterns.
 */
export const themed = {
  // Cards and containers
  card: clsx(
    colorTokens.bg.primary,
    colorTokens.border.default,
    'border rounded-lg shadow-sm'
  ),
  
  cardHover: clsx(
    colorTokens.bg.primary,
    colorTokens.border.default,
    'border rounded-lg shadow-sm',
    'transition-shadow duration-200',
    'hover:shadow-md dark:hover:shadow-gray-900/50'
  ),
  
  // Panels and sections
  panel: clsx(
    colorTokens.bg.secondary,
    colorTokens.border.default,
    'border rounded-lg'
  ),
  
  // Lists
  listItem: clsx(
    colorTokens.interactive.hover,
    'px-4 py-2',
    'transition-colors duration-150'
  ),
  
  listItemSelected: clsx(
    colorTokens.interactive.selected,
    colorTokens.text.primary,
    'px-4 py-2'
  ),
  
  // Tables
  tableHeader: clsx(
    colorTokens.bg.secondary,
    colorTokens.text.secondary,
    'text-left text-xs font-medium uppercase tracking-wider'
  ),
  
  tableRow: clsx(
    colorTokens.border.default,
    'border-t',
    colorTokens.interactive.hover,
    'transition-colors duration-150'
  ),
  
  tableCell: clsx(
    colorTokens.text.primary,
    'px-6 py-4 whitespace-nowrap'
  ),
  
  // Inputs
  input: clsx(
    colorTokens.form.input,
    colorTokens.form.focus,
    'border rounded-md px-3 py-2',
    'focus:outline-none focus:ring-2 focus:ring-offset-0'
  ),
  
  // Modals
  modalOverlay: clsx(
    colorTokens.bg.overlay,
    'fixed inset-0 z-40'
  ),
  
  modalContent: clsx(
    colorTokens.bg.elevated,
    'rounded-lg',
    'max-w-lg w-full'
  ),
  
  // Dropdowns
  dropdown: clsx(
    colorTokens.bg.elevated,
    colorTokens.border.default,
    'border rounded-md shadow-lg',
    'z-50'
  ),
  
  dropdownItem: clsx(
    colorTokens.text.primary,
    colorTokens.interactive.hover,
    'px-4 py-2 text-sm',
    'cursor-pointer'
  ),
  
  // Tooltips
  tooltip: clsx(
    'bg-gray-900 dark:bg-gray-700',
    'text-white text-sm',
    'px-2 py-1 rounded shadow-lg'
  ),
  
  // Badges
  badge: clsx(
    colorTokens.bg.secondary,
    colorTokens.text.secondary,
    'px-2 py-0.5 rounded-full text-xs font-medium'
  ),
} as const;

// ============================================================================
// CSS Variable Helpers
// ============================================================================

/**
 * Get CSS custom property value with fallback.
 */
export function getCSSVar(name: string, fallback?: string): string {
  if (typeof window === 'undefined') return fallback || '';
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback || '';
}

/**
 * Set CSS custom property.
 */
export function setCSSVar(name: string, value: string): void {
  if (typeof window === 'undefined') return;
  document.documentElement.style.setProperty(name, value);
}

// ============================================================================
// Export Defaults
// ============================================================================

export default {
  ThemeProvider,
  useTheme,
  ThemeToggle,
  ThemeSelector,
  colorTokens,
  themed,
  getCSSVar,
  setCSSVar,
};
