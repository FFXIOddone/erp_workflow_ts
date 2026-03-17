/**
 * Performance Utilities
 * 
 * Comprehensive performance optimization patterns for React applications.
 * Includes memoization hooks, virtualization, debounce/throttle utilities,
 * lazy loading components, and performance monitoring tools.
 * 
 * @module Performance
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  memo,
  lazy,
  Suspense,
  type ReactNode,
  type ComponentType,
  type RefObject,
  type CSSProperties,
} from 'react';
import clsx from 'clsx';

// ============================================================================
// PERF-11a: Memoization Patterns
// ============================================================================

/**
 * Deep comparison function for memoization
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  
  if (typeof a === 'object') {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);
    
    if (aKeys.length !== bKeys.length) return false;
    
    return aKeys.every(key => deepEqual(aObj[key], bObj[key]));
  }
  
  return false;
}

/**
 * useMemo with custom comparison function
 * Useful when default reference equality isn't enough
 */
export function useMemoCompare<T>(
  factory: () => T,
  compare: (prev: T | undefined, next: T) => boolean
): T {
  const previousRef = useRef<T>();
  const value = factory();
  
  const isEqual = previousRef.current !== undefined && compare(previousRef.current, value);
  
  useEffect(() => {
    if (!isEqual) {
      previousRef.current = value;
    }
  });
  
  return isEqual ? previousRef.current! : value;
}

/**
 * useMemo with deep equality comparison
 * Useful for complex objects that may have same values but different references
 */
export function useDeepMemo<T>(factory: () => T, deps: unknown[]): T {
  const ref = useRef<{ deps: unknown[]; value: T }>();
  
  if (!ref.current || !deepEqual(deps, ref.current.deps)) {
    ref.current = { deps, value: factory() };
  }
  
  return ref.current.value;
}

/**
 * Returns a stable callback that always uses the latest function
 * Avoids re-renders while keeping callback fresh
 */
export function useStableCallback<T extends (...args: unknown[]) => unknown>(
  callback: T
): T {
  const callbackRef = useRef(callback);
  
  useEffect(() => {
    callbackRef.current = callback;
  });
  
  return useCallback(
    ((...args) => callbackRef.current(...args)) as T,
    []
  );
}

/**
 * Returns a constant value that never changes
 * Useful for initial values that shouldn't trigger re-renders
 */
export function useConstant<T>(factory: () => T): T {
  const ref = useRef<{ value: T }>();
  
  if (!ref.current) {
    ref.current = { value: factory() };
  }
  
  return ref.current.value;
}

/**
 * Memoizes a value with optional dependencies
 * Returns previous value if dependencies haven't changed
 */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();
  
  useEffect(() => {
    ref.current = value;
  }, [value]);
  
  return ref.current;
}

// ============================================================================
// PERF-11b: Virtualization Hooks
// ============================================================================

export interface VirtualListOptions {
  /** Total number of items */
  itemCount: number;
  /** Height of each item (can be function for variable heights) */
  itemHeight: number | ((index: number) => number);
  /** Height of the container */
  containerHeight: number;
  /** Number of items to render outside visible area */
  overscan?: number;
}

export interface VirtualListResult {
  /** Items to render */
  virtualItems: Array<{
    index: number;
    start: number;
    size: number;
  }>;
  /** Total height of all items */
  totalHeight: number;
  /** Start index of visible items */
  startIndex: number;
  /** End index of visible items */
  endIndex: number;
  /** Scroll handler */
  onScroll: (scrollTop: number) => void;
  /** Current scroll position */
  scrollTop: number;
}

/**
 * Hook for virtualizing long lists
 * Only renders items currently visible in the viewport
 */
export function useVirtualList({
  itemCount,
  itemHeight,
  containerHeight,
  overscan = 3,
}: VirtualListOptions): VirtualListResult {
  const [scrollTop, setScrollTop] = useState(0);
  
  const getItemHeight = useCallback(
    (index: number) => (typeof itemHeight === 'function' ? itemHeight(index) : itemHeight),
    [itemHeight]
  );
  
  // Calculate total height
  const totalHeight = useMemo(() => {
    if (typeof itemHeight === 'number') {
      return itemCount * itemHeight;
    }
    let height = 0;
    for (let i = 0; i < itemCount; i++) {
      height += getItemHeight(i);
    }
    return height;
  }, [itemCount, itemHeight, getItemHeight]);
  
  // Calculate visible range
  const { startIndex, endIndex, virtualItems } = useMemo(() => {
    const items: VirtualListResult['virtualItems'] = [];
    let currentOffset = 0;
    let start = 0;
    let end = 0;
    
    // Find start index
    for (let i = 0; i < itemCount; i++) {
      const height = getItemHeight(i);
      if (currentOffset + height > scrollTop) {
        start = Math.max(0, i - overscan);
        break;
      }
      currentOffset += height;
    }
    
    // Build visible items
    currentOffset = 0;
    for (let i = 0; i < itemCount; i++) {
      const height = getItemHeight(i);
      
      if (i >= start) {
        items.push({
          index: i,
          start: currentOffset,
          size: height,
        });
        
        if (currentOffset > scrollTop + containerHeight) {
          end = Math.min(itemCount - 1, i + overscan);
          break;
        }
      }
      
      currentOffset += height;
      if (i === itemCount - 1) {
        end = i;
      }
    }
    
    return {
      startIndex: start,
      endIndex: end,
      virtualItems: items.slice(0, end - start + 1 + overscan * 2),
    };
  }, [itemCount, scrollTop, containerHeight, overscan, getItemHeight]);
  
  const onScroll = useCallback((newScrollTop: number) => {
    setScrollTop(newScrollTop);
  }, []);
  
  return {
    virtualItems,
    totalHeight,
    startIndex,
    endIndex,
    onScroll,
    scrollTop,
  };
}

export interface InfiniteScrollOptions {
  /** Function to load more items */
  loadMore: () => Promise<void>;
  /** Whether there are more items to load */
  hasMore: boolean;
  /** Whether currently loading */
  isLoading: boolean;
  /** Threshold in pixels before end to trigger load */
  threshold?: number;
  /** Root element for intersection observer */
  root?: RefObject<Element>;
}

export interface InfiniteScrollResult {
  /** Ref to attach to sentinel element */
  sentinelRef: RefObject<HTMLDivElement>;
  /** Whether loading is in progress */
  isLoading: boolean;
}

/**
 * Hook for infinite scrolling
 * Automatically loads more items when user scrolls near the bottom
 */
export function useInfiniteScroll({
  loadMore,
  hasMore,
  isLoading,
  threshold = 200,
  root,
}: InfiniteScrollOptions): InfiniteScrollResult {
  const sentinelRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!hasMore || isLoading) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !isLoading) {
          loadMore();
        }
      },
      {
        root: root?.current || null,
        rootMargin: `${threshold}px`,
      }
    );
    
    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }
    
    return () => observer.disconnect();
  }, [hasMore, isLoading, loadMore, threshold, root]);
  
  return { sentinelRef, isLoading };
}

// ============================================================================
// PERF-11c: Debounce/Throttle Utilities
// ============================================================================

/**
 * Debounces a value - only updates after delay with no changes
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => clearTimeout(timer);
  }, [value, delay]);
  
  return debouncedValue;
}

/**
 * Returns a debounced version of a callback
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number
): T & { cancel: () => void; flush: () => void } {
  const callbackRef = useRef(callback);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const argsRef = useRef<unknown[]>();
  
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);
  
  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
  }, []);
  
  const flush = useCallback(() => {
    if (timeoutRef.current && argsRef.current) {
      cancel();
      callbackRef.current(...argsRef.current);
    }
  }, [cancel]);
  
  const debouncedCallback = useCallback(
    ((...args: unknown[]) => {
      argsRef.current = args;
      cancel();
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    }) as T,
    [delay, cancel]
  );
  
  useEffect(() => cancel, [cancel]);
  
  return Object.assign(debouncedCallback, { cancel, flush });
}

/**
 * Throttles a value - updates at most once per interval
 */
export function useThrottle<T>(value: T, interval: number): T {
  const [throttledValue, setThrottledValue] = useState(value);
  const lastExecutedRef = useRef(Date.now());
  
  useEffect(() => {
    const now = Date.now();
    const elapsed = now - lastExecutedRef.current;
    
    if (elapsed >= interval) {
      setThrottledValue(value);
      lastExecutedRef.current = now;
    } else {
      const timer = setTimeout(() => {
        setThrottledValue(value);
        lastExecutedRef.current = Date.now();
      }, interval - elapsed);
      
      return () => clearTimeout(timer);
    }
  }, [value, interval]);
  
  return throttledValue;
}

/**
 * Returns a throttled version of a callback
 */
export function useThrottledCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  interval: number
): T {
  const callbackRef = useRef(callback);
  const lastExecutedRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);
  
  return useCallback(
    ((...args: unknown[]) => {
      const now = Date.now();
      const elapsed = now - lastExecutedRef.current;
      
      if (elapsed >= interval) {
        callbackRef.current(...args);
        lastExecutedRef.current = now;
      } else {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
          callbackRef.current(...args);
          lastExecutedRef.current = Date.now();
        }, interval - elapsed);
      }
    }) as T,
    [interval]
  );
}

// ============================================================================
// PERF-11d: Lazy Loading Components
// ============================================================================

export interface IntersectionOptions {
  /** Root element for intersection observer */
  root?: Element | null;
  /** Margin around root */
  rootMargin?: string;
  /** Visibility threshold (0-1) */
  threshold?: number | number[];
  /** Only trigger once */
  triggerOnce?: boolean;
}

export interface IntersectionResult {
  /** Ref to attach to observed element */
  ref: RefObject<HTMLElement>;
  /** Whether element is currently visible */
  isIntersecting: boolean;
  /** The IntersectionObserverEntry */
  entry: IntersectionObserverEntry | undefined;
}

/**
 * Hook for observing element intersection with viewport
 */
export function useIntersectionObserver({
  root = null,
  rootMargin = '0px',
  threshold = 0,
  triggerOnce = false,
}: IntersectionOptions = {}): IntersectionResult {
  const ref = useRef<HTMLElement>(null);
  const [entry, setEntry] = useState<IntersectionObserverEntry>();
  const frozen = useRef(false);
  
  useEffect(() => {
    if (!ref.current || frozen.current) return;
    
    const observer = new IntersectionObserver(
      ([e]) => {
        setEntry(e);
        
        if (triggerOnce && e?.isIntersecting) {
          frozen.current = true;
          observer.disconnect();
        }
      },
      { root, rootMargin, threshold }
    );
    
    observer.observe(ref.current);
    
    return () => observer.disconnect();
  }, [root, rootMargin, threshold, triggerOnce]);
  
  return {
    ref,
    isIntersecting: entry?.isIntersecting ?? false,
    entry,
  };
}

/**
 * Hook that delays loading until element is visible
 */
export function useLazyLoad(options?: IntersectionOptions): {
  ref: RefObject<HTMLElement>;
  shouldLoad: boolean;
} {
  const { ref, isIntersecting } = useIntersectionObserver({
    ...options,
    triggerOnce: true,
  });
  
  return { ref, shouldLoad: isIntersecting };
}

export interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /** Placeholder to show while loading */
  placeholder?: ReactNode;
  /** Root margin for intersection observer */
  rootMargin?: string;
  /** Blur placeholder data URL */
  blurDataURL?: string;
  /** Callback when image loads */
  onLoad?: () => void;
  /** Callback on error */
  onError?: () => void;
}

/**
 * Lazy-loaded image component
 * Only loads image when visible in viewport
 */
export const LazyImage = memo(function LazyImage({
  src,
  alt,
  placeholder,
  rootMargin = '200px',
  blurDataURL,
  onLoad,
  onError,
  className,
  style,
  ...props
}: LazyImageProps) {
  const { ref, shouldLoad } = useLazyLoad({ rootMargin });
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  
  const handleLoad = useCallback(() => {
    setIsLoaded(true);
    onLoad?.();
  }, [onLoad]);
  
  const handleError = useCallback(() => {
    setHasError(true);
    onError?.();
  }, [onError]);
  
  const combinedStyle: CSSProperties = {
    ...style,
    ...(blurDataURL && !isLoaded
      ? {
          backgroundImage: `url(${blurDataURL})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(20px)',
        }
      : {}),
  };
  
  return (
    <div
      ref={ref as RefObject<HTMLDivElement>}
      className={clsx('relative overflow-hidden', className)}
      style={combinedStyle}
    >
      {!shouldLoad && placeholder}
      {shouldLoad && !hasError && (
        <img
          src={src}
          alt={alt}
          onLoad={handleLoad}
          onError={handleError}
          className={clsx(
            'transition-opacity duration-300',
            isLoaded ? 'opacity-100' : 'opacity-0'
          )}
          {...props}
        />
      )}
      {hasError && (
        <div className="flex items-center justify-center w-full h-full bg-gray-100 text-gray-400">
          <span>Failed to load</span>
        </div>
      )}
    </div>
  );
});

export interface LazyComponentProps<P extends object> {
  /** Import function for the component */
  loader: () => Promise<{ default: ComponentType<P> }>;
  /** Props to pass to the component */
  props: P;
  /** Fallback to show while loading */
  fallback?: ReactNode;
  /** Root margin for intersection observer */
  rootMargin?: string;
}

/**
 * Lazy-loaded component wrapper
 * Only loads component code when visible in viewport
 */
export function LazyComponent<P extends object>({
  loader,
  props,
  fallback = null,
  rootMargin = '200px',
}: LazyComponentProps<P>) {
  const { ref, shouldLoad } = useLazyLoad({ rootMargin });
  const [Component, setComponent] = useState<ComponentType<P> | null>(null);
  
  useEffect(() => {
    if (shouldLoad && !Component) {
      loader().then((module) => {
        setComponent(() => module.default);
      });
    }
  }, [shouldLoad, loader, Component]);
  
  return (
    <div ref={ref as RefObject<HTMLDivElement>}>
      {Component ? <Component {...props} /> : fallback}
    </div>
  );
}

// ============================================================================
// PERF-11e: Performance Monitoring
// ============================================================================

/**
 * Hook that counts component renders
 * Useful for debugging performance issues
 */
export function useRenderCount(componentName?: string): number {
  const renderCount = useRef(0);
  renderCount.current += 1;
  
  if (process.env.NODE_ENV === 'development' && componentName) {
    console.log(`[Render Count] ${componentName}: ${renderCount.current}`);
  }
  
  return renderCount.current;
}

/**
 * Hook that logs what props changed causing a re-render
 * Useful for debugging unnecessary re-renders
 */
export function useWhyDidYouUpdate<T extends Record<string, unknown>>(
  componentName: string,
  props: T
): void {
  const previousProps = useRef<T>();
  
  useEffect(() => {
    if (previousProps.current) {
      const allKeys = Object.keys({ ...previousProps.current, ...props });
      const changedProps: Record<string, { from: unknown; to: unknown }> = {};
      
      allKeys.forEach((key) => {
        if (previousProps.current![key] !== props[key]) {
          changedProps[key] = {
            from: previousProps.current![key],
            to: props[key],
          };
        }
      });
      
      if (Object.keys(changedProps).length > 0) {
        console.log(`[Why Did You Update] ${componentName}:`, changedProps);
      }
    }
    
    previousProps.current = props;
  });
}

/**
 * Hook that measures time between renders
 */
export function useRenderTime(componentName: string): void {
  const lastRenderRef = useRef(performance.now());
  
  useEffect(() => {
    const now = performance.now();
    const timeSinceLastRender = now - lastRenderRef.current;
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Render Time] ${componentName}: ${timeSinceLastRender.toFixed(2)}ms since last render`);
    }
    
    lastRenderRef.current = now;
  });
}

export interface PerformanceMetrics {
  renderCount: number;
  lastRenderTime: number;
  averageRenderTime: number;
  totalTime: number;
}

/**
 * Hook for comprehensive performance monitoring
 */
export function usePerformanceMetrics(componentName: string): PerformanceMetrics {
  const metricsRef = useRef({
    renderCount: 0,
    renderTimes: [] as number[],
    startTime: performance.now(),
    lastRenderStart: performance.now(),
  });
  
  useEffect(() => {
    const now = performance.now();
    const renderTime = now - metricsRef.current.lastRenderStart;
    metricsRef.current.renderCount += 1;
    metricsRef.current.renderTimes.push(renderTime);
    
    // Keep only last 100 render times
    if (metricsRef.current.renderTimes.length > 100) {
      metricsRef.current.renderTimes.shift();
    }
    
    metricsRef.current.lastRenderStart = now;
  });
  
  const { renderCount, renderTimes, startTime, lastRenderStart } = metricsRef.current;
  const averageRenderTime = renderTimes.length > 0
    ? renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length
    : 0;
  
  return {
    renderCount,
    lastRenderTime: renderTimes[renderTimes.length - 1] ?? 0,
    averageRenderTime,
    totalTime: performance.now() - startTime,
  };
}

export interface PerformanceMonitorProps {
  /** Name of the component being monitored */
  componentName: string;
  /** Whether to show the monitor overlay */
  show?: boolean;
  /** Position of the overlay */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  /** Children to render */
  children: ReactNode;
}

/**
 * Performance monitor overlay component
 * Shows real-time metrics for wrapped components
 */
export function PerformanceMonitor({
  componentName,
  show = process.env.NODE_ENV === 'development',
  position = 'bottom-right',
  children,
}: PerformanceMonitorProps) {
  const metrics = usePerformanceMetrics(componentName);
  
  if (!show) {
    return <>{children}</>;
  }
  
  const positionClasses = {
    'top-left': 'top-2 left-2',
    'top-right': 'top-2 right-2',
    'bottom-left': 'bottom-2 left-2',
    'bottom-right': 'bottom-2 right-2',
  };
  
  return (
    <div className="relative">
      {children}
      <div
        className={clsx(
          'absolute z-50 bg-black/80 text-white text-xs p-2 rounded font-mono',
          positionClasses[position]
        )}
      >
        <div className="font-semibold mb-1">{componentName}</div>
        <div>Renders: {metrics.renderCount}</div>
        <div>Last: {metrics.lastRenderTime.toFixed(2)}ms</div>
        <div>Avg: {metrics.averageRenderTime.toFixed(2)}ms</div>
        <div>Total: {(metrics.totalTime / 1000).toFixed(1)}s</div>
      </div>
    </div>
  );
}

// ============================================================================
// Virtual List Component
// ============================================================================

export interface VirtualListProps<T> {
  /** Items to render */
  items: T[];
  /** Height of each item (or function for variable heights) */
  itemHeight: number | ((item: T, index: number) => number);
  /** Height of the container */
  containerHeight: number;
  /** Render function for each item */
  renderItem: (item: T, index: number) => ReactNode;
  /** Number of items to overscan */
  overscan?: number;
  /** Class name for the container */
  className?: string;
  /** Key extractor */
  getItemKey?: (item: T, index: number) => string | number;
}

/**
 * Virtualized list component for rendering large lists efficiently
 */
export function VirtualList<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 3,
  className,
  getItemKey,
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const getHeight = useCallback(
    (index: number) =>
      typeof itemHeight === 'function'
        ? itemHeight(items[index]!, index)
        : itemHeight,
    [itemHeight, items]
  );
  
  const { virtualItems, totalHeight, onScroll } = useVirtualList({
    itemCount: items.length,
    itemHeight: getHeight,
    containerHeight,
    overscan,
  });
  
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      onScroll(e.currentTarget.scrollTop);
    },
    [onScroll]
  );
  
  return (
    <div
      ref={containerRef}
      className={clsx('overflow-auto', className)}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {virtualItems.map((virtualItem) => {
          const item = items[virtualItem.index]!;
          const key = getItemKey
            ? getItemKey(item, virtualItem.index)
            : virtualItem.index;
          
          return (
            <div
              key={key}
              style={{
                position: 'absolute',
                top: virtualItem.start,
                height: virtualItem.size,
                width: '100%',
              }}
            >
              {renderItem(item, virtualItem.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Infinite Scroll List Component
// ============================================================================

export interface InfiniteScrollListProps<T> {
  /** Items to render */
  items: T[];
  /** Render function for each item */
  renderItem: (item: T, index: number) => ReactNode;
  /** Function to load more items */
  loadMore: () => Promise<void>;
  /** Whether there are more items to load */
  hasMore: boolean;
  /** Whether currently loading */
  isLoading: boolean;
  /** Loading indicator */
  loadingIndicator?: ReactNode;
  /** End of list indicator */
  endIndicator?: ReactNode;
  /** Class name for the container */
  className?: string;
  /** Key extractor */
  getItemKey?: (item: T, index: number) => string | number;
}

/**
 * Infinite scrolling list component
 */
export function InfiniteScrollList<T>({
  items,
  renderItem,
  loadMore,
  hasMore,
  isLoading,
  loadingIndicator,
  endIndicator,
  className,
  getItemKey,
}: InfiniteScrollListProps<T>) {
  const { sentinelRef } = useInfiniteScroll({
    loadMore,
    hasMore,
    isLoading,
  });
  
  return (
    <div className={className}>
      {items.map((item, index) => (
        <div key={getItemKey ? getItemKey(item, index) : index}>
          {renderItem(item, index)}
        </div>
      ))}
      
      <div ref={sentinelRef} />
      
      {isLoading && (
        loadingIndicator || (
          <div className="flex justify-center py-4">
            <div className="animate-spin h-6 w-6 border-2 border-primary-500 border-t-transparent rounded-full" />
          </div>
        )
      )}
      
      {!hasMore && !isLoading && items.length > 0 && (
        endIndicator || (
          <div className="text-center text-gray-500 py-4 text-sm">
            No more items to load
          </div>
        )
      )}
    </div>
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Creates a memoized selector that only recomputes when dependencies change
 */
export function createSelector<S, D extends unknown[], R>(
  getDeps: (state: S) => D,
  compute: (...deps: D) => R
): (state: S) => R {
  let cachedDeps: D | undefined;
  let cachedResult: R;
  
  return (state: S): R => {
    const deps = getDeps(state);
    
    if (!cachedDeps || !deps.every((dep, i) => dep === cachedDeps![i])) {
      cachedDeps = deps;
      cachedResult = compute(...deps);
    }
    
    return cachedResult;
  };
}

/**
 * Batch multiple state updates together
 */
export function batchUpdates(callback: () => void): void {
  // React 18+ automatically batches updates
  // This is a no-op wrapper for compatibility
  callback();
}

/**
 * Creates a debounced promise that resolves after delay
 */
export function debouncePromise<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): T {
  let timeoutId: ReturnType<typeof setTimeout>;
  let pendingResolve: ((value: unknown) => void) | null = null;
  
  return ((...args: unknown[]) => {
    clearTimeout(timeoutId);
    
    return new Promise((resolve) => {
      if (pendingResolve) {
        pendingResolve(undefined);
      }
      pendingResolve = resolve;
      
      timeoutId = setTimeout(async () => {
        const result = await fn(...args);
        resolve(result);
        pendingResolve = null;
      }, delay);
    });
  }) as T;
}

/**
 * Measures the execution time of a function
 */
export function measureTime<T extends (...args: unknown[]) => unknown>(
  fn: T,
  label?: string
): T {
  return ((...args: unknown[]) => {
    const start = performance.now();
    const result = fn(...args);
    
    if (result instanceof Promise) {
      return result.finally(() => {
        const time = performance.now() - start;
        console.log(`[Performance] ${label || fn.name}: ${time.toFixed(2)}ms`);
      });
    }
    
    const time = performance.now() - start;
    console.log(`[Performance] ${label || fn.name}: ${time.toFixed(2)}ms`);
    return result;
  }) as T;
}
