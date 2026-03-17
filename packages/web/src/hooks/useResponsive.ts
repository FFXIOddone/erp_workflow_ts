import { useState, useEffect, useCallback } from 'react';

/**
 * Tailwind CSS breakpoints (in pixels)
 * These match the default Tailwind breakpoints
 */
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

/**
 * Check if a media query matches
 */
function matchQuery(query: string): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(query).matches;
}

/**
 * Get current breakpoint based on window width
 */
function getCurrentBreakpoint(): Breakpoint | null {
  if (typeof window === 'undefined') return null;
  const width = window.innerWidth;
  if (width >= BREAKPOINTS['2xl']) return '2xl';
  if (width >= BREAKPOINTS.xl) return 'xl';
  if (width >= BREAKPOINTS.lg) return 'lg';
  if (width >= BREAKPOINTS.md) return 'md';
  if (width >= BREAKPOINTS.sm) return 'sm';
  return null; // Below sm (mobile)
}

/**
 * Hook to track window dimensions
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { width, height, isMobile, isTablet, isDesktop } = useWindowSize();
 *   
 *   return isMobile ? <MobileLayout /> : <DesktopLayout />;
 * }
 * ```
 */
export function useWindowSize() {
  const [state, setState] = useState(() => {
    if (typeof window === 'undefined') {
      return {
        width: 1024,
        height: 768,
        breakpoint: 'lg' as Breakpoint | null,
      };
    }
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      breakpoint: getCurrentBreakpoint(),
    };
  });

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const handleResize = () => {
      // Debounce resize events
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setState({
          width: window.innerWidth,
          height: window.innerHeight,
          breakpoint: getCurrentBreakpoint(),
        });
      }, 100);
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Initial call

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, []);

  const isMobile = state.width < BREAKPOINTS.md;
  const isTablet = state.width >= BREAKPOINTS.md && state.width < BREAKPOINTS.lg;
  const isDesktop = state.width >= BREAKPOINTS.lg;

  return {
    ...state,
    isMobile,
    isTablet,
    isDesktop,
  };
}

/**
 * Hook to check if current viewport matches a media query
 *
 * @example
 * ```tsx
 * const isPortrait = useMediaQuery('(orientation: portrait)');
 * const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
 * ```
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => matchQuery(query));

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mediaQuery.addEventListener('change', handler);

    return () => mediaQuery.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

/**
 * Hook to check if current viewport is at or above a breakpoint
 *
 * @example
 * ```tsx
 * const isLargeOrAbove = useBreakpoint('lg');
 * // Returns true when viewport is >= 1024px
 * ```
 */
export function useBreakpoint(breakpoint: Breakpoint): boolean {
  return useMediaQuery(`(min-width: ${BREAKPOINTS[breakpoint]}px)`);
}

/**
 * Hook to check if current viewport is below a breakpoint
 *
 * @example
 * ```tsx
 * const isBelowMd = useBreakpointDown('md');
 * // Returns true when viewport is < 768px
 * ```
 */
export function useBreakpointDown(breakpoint: Breakpoint): boolean {
  return useMediaQuery(`(max-width: ${BREAKPOINTS[breakpoint] - 1}px)`);
}

/**
 * Hook to check if current viewport is between two breakpoints
 *
 * @example
 * ```tsx
 * const isTablet = useBreakpointBetween('md', 'lg');
 * // Returns true when 768px <= viewport < 1024px
 * ```
 */
export function useBreakpointBetween(min: Breakpoint, max: Breakpoint): boolean {
  return useMediaQuery(
    `(min-width: ${BREAKPOINTS[min]}px) and (max-width: ${BREAKPOINTS[max] - 1}px)`
  );
}

/**
 * Hook to get responsive value based on current breakpoint
 *
 * @example
 * ```tsx
 * const columns = useResponsiveValue({
 *   default: 1,
 *   sm: 2,
 *   md: 3,
 *   lg: 4,
 * });
 * ```
 */
export function useResponsiveValue<T>(values: {
  default: T;
  sm?: T;
  md?: T;
  lg?: T;
  xl?: T;
  '2xl'?: T;
}): T {
  const { breakpoint } = useWindowSize();

  // Find the largest matching breakpoint
  const orderedBreakpoints: Breakpoint[] = ['2xl', 'xl', 'lg', 'md', 'sm'];

  for (const bp of orderedBreakpoints) {
    if (breakpoint === bp || (breakpoint && BREAKPOINTS[breakpoint] >= BREAKPOINTS[bp])) {
      if (values[bp] !== undefined) {
        return values[bp]!;
      }
    }
  }

  return values.default;
}

/**
 * Hook to detect touch capability
 *
 * @example
 * ```tsx
 * const { hasTouch, hasMouse, hasFinePointer } = useTouchDetection();
 * ```
 */
export function useTouchDetection() {
  const hasTouch = useMediaQuery('(pointer: coarse)');
  const hasFinePointer = useMediaQuery('(pointer: fine)');
  const hasMouse = useMediaQuery('(hover: hover)');

  return {
    hasTouch,
    hasFinePointer,
    hasMouse,
    // Touch-only device (no mouse)
    isTouchOnly: hasTouch && !hasMouse,
    // Desktop with touch (Surface, etc.)
    isHybrid: hasTouch && hasMouse,
  };
}

/**
 * Hook to detect device orientation
 */
export function useOrientation() {
  const isPortrait = useMediaQuery('(orientation: portrait)');
  const isLandscape = useMediaQuery('(orientation: landscape)');

  return { isPortrait, isLandscape };
}

/**
 * Hook to detect if device prefers reduced motion
 */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

/**
 * Hook to detect if device prefers dark color scheme
 */
export function usePrefersDarkMode(): boolean {
  return useMediaQuery('(prefers-color-scheme: dark)');
}

/**
 * Hook for managing mobile sidebar/drawer state
 */
export function useMobileSidebar(defaultOpen = false) {
  const { isMobile } = useWindowSize();
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // Close sidebar when switching to desktop
  useEffect(() => {
    if (!isMobile) {
      setIsOpen(false);
    }
  }, [isMobile]);

  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return {
    isOpen: isMobile && isOpen,
    toggle,
    open,
    close,
    isMobile,
  };
}

/**
 * Hook to manage viewport height (fixes 100vh issue on mobile browsers)
 * Returns a CSS variable that can be used instead of 100vh
 *
 * @example
 * ```tsx
 * function App() {
 *   useViewportHeight();
 *   return <div style={{ height: 'var(--vh, 100vh)' }}>...</div>;
 * }
 * ```
 */
export function useViewportHeight() {
  useEffect(() => {
    const setVH = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    setVH();
    window.addEventListener('resize', setVH);
    window.addEventListener('orientationchange', setVH);

    return () => {
      window.removeEventListener('resize', setVH);
      window.removeEventListener('orientationchange', setVH);
    };
  }, []);
}

/**
 * Hook to disable body scroll (for modals on mobile)
 */
export function useDisableBodyScroll(disable: boolean) {
  useEffect(() => {
    if (!disable) return;

    const scrollY = window.scrollY;
    const body = document.body;
    const originalStyle = body.style.cssText;

    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.overflow = 'hidden';

    return () => {
      body.style.cssText = originalStyle;
      window.scrollTo(0, scrollY);
    };
  }, [disable]);
}

/**
 * Hook to detect safe area insets (for notched devices)
 */
export function useSafeAreaInsets() {
  const [insets, setInsets] = useState({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  });

  useEffect(() => {
    const computedStyle = getComputedStyle(document.documentElement);

    const getInset = (property: string) => {
      const value = computedStyle.getPropertyValue(property);
      return parseInt(value, 10) || 0;
    };

    // Use CSS environment variables for safe area
    const style = document.createElement('style');
    style.textContent = `
      :root {
        --safe-area-inset-top: env(safe-area-inset-top, 0px);
        --safe-area-inset-right: env(safe-area-inset-right, 0px);
        --safe-area-inset-bottom: env(safe-area-inset-bottom, 0px);
        --safe-area-inset-left: env(safe-area-inset-left, 0px);
      }
    `;
    document.head.appendChild(style);

    // Read the values after applying styles
    requestAnimationFrame(() => {
      setInsets({
        top: getInset('--safe-area-inset-top'),
        right: getInset('--safe-area-inset-right'),
        bottom: getInset('--safe-area-inset-bottom'),
        left: getInset('--safe-area-inset-left'),
      });
    });

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return insets;
}
