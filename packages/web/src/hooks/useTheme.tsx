import { useState, useEffect, useCallback, createContext, useContext, useMemo } from 'react';

// ============================================================================
// Types
// ============================================================================

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeContextValue {
  /** Current theme mode setting */
  mode: ThemeMode;
  /** Actual resolved theme (light or dark) */
  resolvedTheme: 'light' | 'dark';
  /** Whether dark mode is active */
  isDark: boolean;
  /** Set theme mode */
  setMode: (mode: ThemeMode) => void;
  /** Toggle between light and dark */
  toggle: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = 'erp-theme-mode';
const DARK_CLASS = 'dark';
const LIGHT_CLASS = 'light';

// ============================================================================
// Utilities
// ============================================================================

/**
 * Get the system color scheme preference
 */
function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Get stored theme from localStorage
 */
function getStoredTheme(): ThemeMode | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Store theme in localStorage
 */
function storeTheme(mode: ThemeMode): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Apply theme to document
 */
function applyTheme(theme: 'light' | 'dark'): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;

  // Remove both classes first
  root.classList.remove(DARK_CLASS, LIGHT_CLASS);

  // Add the appropriate class
  root.classList.add(theme);

  // Set color-scheme for native elements
  root.style.colorScheme = theme;

  // Update meta theme-color for mobile browsers
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute(
      'content',
      theme === 'dark' ? '#111827' : '#ffffff'
    );
  }
}

// ============================================================================
// Hook: useTheme
// ============================================================================

/**
 * Hook for managing theme state
 *
 * @example
 * ```tsx
 * function ThemeToggle() {
 *   const { isDark, toggle, mode, setMode } = useTheme();
 *
 *   return (
 *     <button onClick={toggle}>
 *       {isDark ? '☀️ Light' : '🌙 Dark'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

/**
 * Standalone hook for theme management (without context)
 */
export function useThemeState(): ThemeContextValue {
  // Initialize mode from storage or default to system
  const [mode, setModeState] = useState<ThemeMode>(() => {
    return getStoredTheme() || 'system';
  });

  // Track system preference
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(getSystemTheme);

  // Calculate resolved theme
  const resolvedTheme = mode === 'system' ? systemTheme : mode;
  const isDark = resolvedTheme === 'dark';

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handler = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Apply theme when it changes
  useEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme]);

  // Set mode and persist
  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    storeTheme(newMode);
  }, []);

  // Toggle between light and dark (not system)
  const toggle = useCallback(() => {
    const newMode = resolvedTheme === 'dark' ? 'light' : 'dark';
    setMode(newMode);
  }, [resolvedTheme, setMode]);

  return useMemo(
    () => ({
      mode,
      resolvedTheme,
      isDark,
      setMode,
      toggle,
    }),
    [mode, resolvedTheme, isDark, setMode, toggle]
  );
}

// ============================================================================
// Context
// ============================================================================

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  children: React.ReactNode;
  /** Default theme mode */
  defaultMode?: ThemeMode;
  /** Force a specific theme (disables user preference) */
  forcedTheme?: 'light' | 'dark';
  /** Storage key for persistence */
  storageKey?: string;
}

/**
 * Theme provider component
 *
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <ThemeProvider defaultMode="system">
 *       <MyApp />
 *     </ThemeProvider>
 *   );
 * }
 * ```
 */
export function ThemeProvider({
  children,
  defaultMode = 'system',
  forcedTheme,
}: ThemeProviderProps) {
  const themeState = useThemeState();

  // Handle forced theme
  const value = useMemo(() => {
    if (forcedTheme) {
      return {
        ...themeState,
        resolvedTheme: forcedTheme,
        isDark: forcedTheme === 'dark',
      };
    }
    return themeState;
  }, [themeState, forcedTheme]);

  // Apply forced theme
  useEffect(() => {
    if (forcedTheme) {
      applyTheme(forcedTheme);
    }
  }, [forcedTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// ============================================================================
// CSS Variables for Theme Colors
// ============================================================================

/**
 * CSS variables that should be added to your index.css
 * These provide semantic color tokens that switch based on theme
 */
export const themeVariables = `
  :root {
    /* Background colors */
    --color-bg-primary: 255 255 255;      /* white */
    --color-bg-secondary: 249 250 251;    /* gray-50 */
    --color-bg-tertiary: 243 244 246;     /* gray-100 */
    --color-bg-inverse: 17 24 39;         /* gray-900 */
    
    /* Text colors */
    --color-text-primary: 17 24 39;       /* gray-900 */
    --color-text-secondary: 107 114 128;  /* gray-500 */
    --color-text-tertiary: 156 163 175;   /* gray-400 */
    --color-text-inverse: 255 255 255;    /* white */
    
    /* Border colors */
    --color-border-primary: 229 231 235;  /* gray-200 */
    --color-border-secondary: 209 213 219; /* gray-300 */
    
    /* Accent colors */
    --color-accent-primary: 37 99 235;    /* blue-600 */
    --color-accent-hover: 29 78 216;      /* blue-700 */
    
    /* Status colors */
    --color-success: 34 197 94;           /* green-500 */
    --color-warning: 234 179 8;           /* yellow-500 */
    --color-error: 239 68 68;             /* red-500 */
    --color-info: 59 130 246;             /* blue-500 */
  }

  .dark {
    /* Background colors */
    --color-bg-primary: 17 24 39;         /* gray-900 */
    --color-bg-secondary: 31 41 55;       /* gray-800 */
    --color-bg-tertiary: 55 65 81;        /* gray-700 */
    --color-bg-inverse: 255 255 255;      /* white */
    
    /* Text colors */
    --color-text-primary: 249 250 251;    /* gray-50 */
    --color-text-secondary: 156 163 175;  /* gray-400 */
    --color-text-tertiary: 107 114 128;   /* gray-500 */
    --color-text-inverse: 17 24 39;       /* gray-900 */
    
    /* Border colors */
    --color-border-primary: 55 65 81;     /* gray-700 */
    --color-border-secondary: 75 85 99;   /* gray-600 */
    
    /* Accent colors */
    --color-accent-primary: 59 130 246;   /* blue-500 */
    --color-accent-hover: 96 165 250;     /* blue-400 */
  }
`;

// ============================================================================
// Tailwind Config Extension
// ============================================================================

/**
 * Add these colors to your tailwind.config.js extend section:
 *
 * theme: {
 *   extend: {
 *     colors: {
 *       bg: {
 *         primary: 'rgb(var(--color-bg-primary) / <alpha-value>)',
 *         secondary: 'rgb(var(--color-bg-secondary) / <alpha-value>)',
 *         tertiary: 'rgb(var(--color-bg-tertiary) / <alpha-value>)',
 *         inverse: 'rgb(var(--color-bg-inverse) / <alpha-value>)',
 *       },
 *       text: {
 *         primary: 'rgb(var(--color-text-primary) / <alpha-value>)',
 *         secondary: 'rgb(var(--color-text-secondary) / <alpha-value>)',
 *         tertiary: 'rgb(var(--color-text-tertiary) / <alpha-value>)',
 *         inverse: 'rgb(var(--color-text-inverse) / <alpha-value>)',
 *       },
 *       border: {
 *         primary: 'rgb(var(--color-border-primary) / <alpha-value>)',
 *         secondary: 'rgb(var(--color-border-secondary) / <alpha-value>)',
 *       },
 *       accent: {
 *         primary: 'rgb(var(--color-accent-primary) / <alpha-value>)',
 *         hover: 'rgb(var(--color-accent-hover) / <alpha-value>)',
 *       },
 *     },
 *   },
 * }
 */

// ============================================================================
// Theme Toggle Component
// ============================================================================

export interface ThemeToggleProps {
  /** Show labels */
  showLabel?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Additional class names */
  className?: string;
}

/**
 * Theme toggle button component
 */
export function ThemeToggle({
  showLabel = false,
  size = 'md',
  className = '',
}: ThemeToggleProps) {
  const { isDark, toggle, mode, setMode } = useTheme();

  const sizeClasses = {
    sm: 'p-1.5 text-sm',
    md: 'p-2 text-base',
    lg: 'p-2.5 text-lg',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  return (
    <button
      onClick={toggle}
      className={`
        inline-flex items-center gap-2 rounded-lg
        text-gray-500 dark:text-gray-400
        hover:bg-gray-100 dark:hover:bg-gray-800
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
        transition-colors
        ${sizeClasses[size]}
        ${className}
      `}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? (
        <svg
          className={iconSizes[size]}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      ) : (
        <svg
          className={iconSizes[size]}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
          />
        </svg>
      )}
      {showLabel && (
        <span>{isDark ? 'Light' : 'Dark'}</span>
      )}
    </button>
  );
}

/**
 * Theme selector with all three options
 */
export function ThemeSelector({ className = '' }: { className?: string }) {
  const { mode, setMode } = useTheme();

  const options: { value: ThemeMode; label: string; icon: React.ReactNode }[] = [
    {
      value: 'light',
      label: 'Light',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
    },
    {
      value: 'dark',
      label: 'Dark',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      ),
    },
    {
      value: 'system',
      label: 'System',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
  ];

  return (
    <div className={`flex rounded-lg bg-gray-100 dark:bg-gray-800 p-1 ${className}`}>
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => setMode(option.value)}
          className={`
            flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium
            transition-colors
            ${mode === option.value
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }
          `}
          aria-pressed={mode === option.value}
        >
          {option.icon}
          <span className="hidden sm:inline">{option.label}</span>
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// Script for Flash Prevention
// ============================================================================

/**
 * Add this script to your index.html <head> BEFORE other scripts
 * to prevent flash of incorrect theme on page load
 */
export const themeScript = `
  (function() {
    try {
      var mode = localStorage.getItem('${STORAGE_KEY}');
      var dark = mode === 'dark' || 
        (mode !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.classList.toggle('dark', dark);
      document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    } catch (e) {}
  })();
`;
