/**
 * Responsive Utilities & Hooks
 * 
 * Consistent responsive design patterns for the ERP system.
 * Features:
 * - Breakpoint hooks (useBreakpoint, useMediaQuery)
 * - Responsive container components
 * - Show/Hide components based on viewport
 * - Mobile-first utilities
 */

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { clsx } from 'clsx';

// ============================================================================
// Breakpoint Constants (Matching Tailwind)
// ============================================================================

export const BREAKPOINTS = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

// ============================================================================
// useMediaQuery Hook
// ============================================================================

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });
  
  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);
    
    const handler = (event: MediaQueryListEvent) => setMatches(event.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [query]);
  
  return matches;
}

// ============================================================================
// useBreakpoint Hook
// ============================================================================

interface BreakpointState {
  breakpoint: Breakpoint;
  isXs: boolean;
  isSm: boolean;
  isMd: boolean;
  isLg: boolean;
  isXl: boolean;
  is2xl: boolean;
  // "At least" helpers
  isSmUp: boolean;
  isMdUp: boolean;
  isLgUp: boolean;
  isXlUp: boolean;
  is2xlUp: boolean;
  // "At most" helpers
  isXsDown: boolean;
  isSmDown: boolean;
  isMdDown: boolean;
  isLgDown: boolean;
  isXlDown: boolean;
  // Common helpers
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}

export function useBreakpoint(): BreakpointState {
  const [width, setWidth] = useState(() => {
    if (typeof window === 'undefined') return 1024;
    return window.innerWidth;
  });
  
  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  return useMemo(() => {
    const breakpoint: Breakpoint = 
      width >= BREAKPOINTS['2xl'] ? '2xl' :
      width >= BREAKPOINTS.xl ? 'xl' :
      width >= BREAKPOINTS.lg ? 'lg' :
      width >= BREAKPOINTS.md ? 'md' :
      width >= BREAKPOINTS.sm ? 'sm' : 'xs';
    
    return {
      breakpoint,
      // Exact breakpoint
      isXs: breakpoint === 'xs',
      isSm: breakpoint === 'sm',
      isMd: breakpoint === 'md',
      isLg: breakpoint === 'lg',
      isXl: breakpoint === 'xl',
      is2xl: breakpoint === '2xl',
      // At least (up)
      isSmUp: width >= BREAKPOINTS.sm,
      isMdUp: width >= BREAKPOINTS.md,
      isLgUp: width >= BREAKPOINTS.lg,
      isXlUp: width >= BREAKPOINTS.xl,
      is2xlUp: width >= BREAKPOINTS['2xl'],
      // At most (down)
      isXsDown: width < BREAKPOINTS.sm,
      isSmDown: width < BREAKPOINTS.md,
      isMdDown: width < BREAKPOINTS.lg,
      isLgDown: width < BREAKPOINTS.xl,
      isXlDown: width < BREAKPOINTS['2xl'],
      // Common helpers
      isMobile: width < BREAKPOINTS.md,
      isTablet: width >= BREAKPOINTS.md && width < BREAKPOINTS.lg,
      isDesktop: width >= BREAKPOINTS.lg,
    };
  }, [width]);
}

// ============================================================================
// useWindowSize Hook
// ============================================================================

interface WindowSize {
  width: number;
  height: number;
}

export function useWindowSize(): WindowSize {
  const [size, setSize] = useState<WindowSize>(() => {
    if (typeof window === 'undefined') return { width: 1024, height: 768 };
    return { width: window.innerWidth, height: window.innerHeight };
  });
  
  useEffect(() => {
    const handleResize = () => {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  return size;
}

// ============================================================================
// Responsive Context (for SSR-safe breakpoint access)
// ============================================================================

interface ResponsiveContextValue {
  breakpoint: BreakpointState;
  windowSize: WindowSize;
}

const ResponsiveContext = createContext<ResponsiveContextValue | null>(null);

export function ResponsiveProvider({ children }: { children: React.ReactNode }) {
  const breakpoint = useBreakpoint();
  const windowSize = useWindowSize();
  
  const value = useMemo(() => ({ breakpoint, windowSize }), [breakpoint, windowSize]);
  
  return (
    <ResponsiveContext.Provider value={value}>
      {children}
    </ResponsiveContext.Provider>
  );
}

export function useResponsive(): ResponsiveContextValue {
  const context = useContext(ResponsiveContext);
  if (!context) {
    // Fallback for when not wrapped in provider
    const breakpoint = useBreakpoint();
    const windowSize = useWindowSize();
    return { breakpoint, windowSize };
  }
  return context;
}

// ============================================================================
// Show/Hide Components
// ============================================================================

interface ShowProps {
  children: React.ReactNode;
  above?: Breakpoint;
  below?: Breakpoint;
  at?: Breakpoint | Breakpoint[];
  className?: string;
}

export function Show({ children, above, below, at, className }: ShowProps) {
  const { breakpoint } = useResponsive();
  const currentWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
  
  let shouldShow = true;
  
  if (above) {
    shouldShow = shouldShow && currentWidth >= BREAKPOINTS[above];
  }
  
  if (below) {
    shouldShow = shouldShow && currentWidth < BREAKPOINTS[below];
  }
  
  if (at) {
    const atArray = Array.isArray(at) ? at : [at];
    shouldShow = shouldShow && atArray.includes(breakpoint.breakpoint);
  }
  
  if (!shouldShow) return null;
  
  return <div className={className}>{children}</div>;
}

export function Hide({ children, above, below, at, className }: ShowProps) {
  const { breakpoint } = useResponsive();
  const currentWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
  
  let shouldHide = false;
  
  if (above) {
    shouldHide = shouldHide || currentWidth >= BREAKPOINTS[above];
  }
  
  if (below) {
    shouldHide = shouldHide || currentWidth < BREAKPOINTS[below];
  }
  
  if (at) {
    const atArray = Array.isArray(at) ? at : [at];
    shouldHide = shouldHide || atArray.includes(breakpoint.breakpoint);
  }
  
  if (shouldHide) return null;
  
  return <div className={className}>{children}</div>;
}

// Convenience components
export function MobileOnly({ children, className }: { children: React.ReactNode; className?: string }) {
  return <Show below="md" className={className}>{children}</Show>;
}

export function TabletOnly({ children, className }: { children: React.ReactNode; className?: string }) {
  return <Show above="md" below="lg" className={className}>{children}</Show>;
}

export function DesktopOnly({ children, className }: { children: React.ReactNode; className?: string }) {
  return <Show above="lg" className={className}>{children}</Show>;
}

export function TabletUp({ children, className }: { children: React.ReactNode; className?: string }) {
  return <Show above="md" className={className}>{children}</Show>;
}

export function MobileDown({ children, className }: { children: React.ReactNode; className?: string }) {
  return <Show below="md" className={className}>{children}</Show>;
}

// ============================================================================
// Responsive Container
// ============================================================================

interface ResponsiveContainerProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function ResponsiveContainer({
  children,
  className,
  maxWidth = 'xl',
  padding = 'md',
}: ResponsiveContainerProps) {
  const maxWidthClasses = {
    sm: 'max-w-screen-sm',
    md: 'max-w-screen-md',
    lg: 'max-w-screen-lg',
    xl: 'max-w-screen-xl',
    '2xl': 'max-w-screen-2xl',
    full: 'max-w-full',
  };
  
  const paddingClasses = {
    none: '',
    sm: 'px-4 sm:px-6',
    md: 'px-4 sm:px-6 lg:px-8',
    lg: 'px-6 sm:px-8 lg:px-12',
  };
  
  return (
    <div
      className={clsx(
        'mx-auto w-full',
        maxWidthClasses[maxWidth],
        paddingClasses[padding],
        className
      )}
    >
      {children}
    </div>
  );
}

// ============================================================================
// Responsive Grid
// ============================================================================

interface ResponsiveGridProps {
  children: React.ReactNode;
  className?: string;
  cols?: {
    xs?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  gap?: 'none' | 'sm' | 'md' | 'lg';
}

export function ResponsiveGrid({
  children,
  className,
  cols = { xs: 1, sm: 2, md: 3, lg: 4 },
  gap = 'md',
}: ResponsiveGridProps) {
  const gapClasses = {
    none: '',
    sm: 'gap-2 sm:gap-3',
    md: 'gap-4 sm:gap-6',
    lg: 'gap-6 sm:gap-8',
  };
  
  // Build grid-cols classes
  const colClasses = [
    cols.xs && `grid-cols-${cols.xs}`,
    cols.sm && `sm:grid-cols-${cols.sm}`,
    cols.md && `md:grid-cols-${cols.md}`,
    cols.lg && `lg:grid-cols-${cols.lg}`,
    cols.xl && `xl:grid-cols-${cols.xl}`,
  ].filter(Boolean).join(' ');
  
  return (
    <div className={clsx('grid', colClasses, gapClasses[gap], className)}>
      {children}
    </div>
  );
}

// ============================================================================
// Responsive Stack
// ============================================================================

interface ResponsiveStackProps {
  children: React.ReactNode;
  className?: string;
  direction?: {
    xs?: 'row' | 'col';
    sm?: 'row' | 'col';
    md?: 'row' | 'col';
    lg?: 'row' | 'col';
  };
  gap?: 'none' | 'sm' | 'md' | 'lg';
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around';
}

export function ResponsiveStack({
  children,
  className,
  direction = { xs: 'col', md: 'row' },
  gap = 'md',
  align = 'stretch',
  justify = 'start',
}: ResponsiveStackProps) {
  const gapClasses = {
    none: '',
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6',
  };
  
  const alignClasses = {
    start: 'items-start',
    center: 'items-center',
    end: 'items-end',
    stretch: 'items-stretch',
  };
  
  const justifyClasses = {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end',
    between: 'justify-between',
    around: 'justify-around',
  };
  
  const directionClasses = [
    direction.xs === 'row' ? 'flex-row' : 'flex-col',
    direction.sm && (direction.sm === 'row' ? 'sm:flex-row' : 'sm:flex-col'),
    direction.md && (direction.md === 'row' ? 'md:flex-row' : 'md:flex-col'),
    direction.lg && (direction.lg === 'row' ? 'lg:flex-row' : 'lg:flex-col'),
  ].filter(Boolean).join(' ');
  
  return (
    <div
      className={clsx(
        'flex',
        directionClasses,
        gapClasses[gap],
        alignClasses[align],
        justifyClasses[justify],
        className
      )}
    >
      {children}
    </div>
  );
}

// ============================================================================
// useIsMounted Hook (for hydration-safe responsive rendering)
// ============================================================================

export function useIsMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  return mounted;
}

// ============================================================================
// useDebounce Hook (useful for resize handlers)
// ============================================================================

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  
  return debouncedValue;
}

// ============================================================================
// Export Default
// ============================================================================

export default {
  // Constants
  BREAKPOINTS,
  // Hooks
  useMediaQuery,
  useBreakpoint,
  useWindowSize,
  useResponsive,
  useIsMounted,
  useDebounce,
  // Providers
  ResponsiveProvider,
  // Show/Hide
  Show,
  Hide,
  MobileOnly,
  TabletOnly,
  DesktopOnly,
  TabletUp,
  MobileDown,
  // Layout
  ResponsiveContainer,
  ResponsiveGrid,
  ResponsiveStack,
};
