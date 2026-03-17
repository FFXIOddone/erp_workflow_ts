/**
 * InfiniteScroll.tsx
 * CRITICAL-51: Infinite scroll and pagination components
 *
 * Load more content as user scrolls, with various loading strategies,
 * pagination controls, and scroll restoration.
 *
 * @module InfiniteScroll
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  forwardRef,
  type ReactNode,
  type HTMLAttributes,
} from 'react';
import clsx from 'clsx';
import {
  Loader2,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MoreHorizontal,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface InfiniteScrollState {
  isLoading: boolean;
  hasMore: boolean;
  error: Error | null;
  page: number;
  totalPages?: number;
  totalItems?: number;
}

export interface PaginationState {
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
}

export type LoadMoreTrigger = 'scroll' | 'button' | 'intersection';

// ============================================================================
// Context
// ============================================================================

interface InfiniteScrollContextValue {
  state: InfiniteScrollState;
  loadMore: () => void;
  reset: () => void;
  setHasMore: (hasMore: boolean) => void;
}

const InfiniteScrollContext = createContext<InfiniteScrollContextValue | null>(null);

export function useInfiniteScrollContext(): InfiniteScrollContextValue {
  const context = useContext(InfiniteScrollContext);
  if (!context) {
    throw new Error('InfiniteScroll components must be used within InfiniteScrollProvider');
  }
  return context;
}

// ============================================================================
// InfiniteScroll Component
// ============================================================================

export interface InfiniteScrollProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  children: ReactNode;
  onLoadMore: () => void | Promise<void>;
  hasMore: boolean;
  isLoading?: boolean;
  error?: Error | null;
  threshold?: number;
  trigger?: LoadMoreTrigger;
  loader?: ReactNode;
  endMessage?: ReactNode;
  errorMessage?: ReactNode;
  loadMoreButton?: ReactNode;
  scrollableParent?: HTMLElement | null;
  inverse?: boolean;
  initialLoad?: boolean;
  scrollToTopThreshold?: number;
  showScrollToTop?: boolean;
}

export const InfiniteScroll = forwardRef<HTMLDivElement, InfiniteScrollProps>(
  (
    {
      children,
      onLoadMore,
      hasMore,
      isLoading = false,
      error = null,
      threshold = 0.8,
      trigger = 'scroll',
      loader,
      endMessage,
      errorMessage,
      loadMoreButton,
      scrollableParent,
      inverse = false,
      initialLoad = false,
      scrollToTopThreshold = 500,
      showScrollToTop = true,
      className,
      ...props
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const sentinelRef = useRef<HTMLDivElement>(null);
    const [showScrollTop, setShowScrollTop] = useState(false);
    const loadingRef = useRef(false);

    // Handle load more
    const handleLoadMore = useCallback(async () => {
      if (loadingRef.current || !hasMore || isLoading) return;
      loadingRef.current = true;
      try {
        await onLoadMore();
      } finally {
        loadingRef.current = false;
      }
    }, [onLoadMore, hasMore, isLoading]);

    // Scroll-based loading
    useEffect(() => {
      if (trigger !== 'scroll') return;

      const scrollParent = scrollableParent || window;

      const handleScroll = () => {
        if (!hasMore || isLoading || loadingRef.current) return;

        let scrollPercentage: number;

        if (scrollParent === window) {
          const scrollTop = window.scrollY;
          const docHeight = document.documentElement.scrollHeight;
          const viewHeight = window.innerHeight;
          scrollPercentage = (scrollTop + viewHeight) / docHeight;
          setShowScrollTop(scrollTop > scrollToTopThreshold);
        } else {
          const element = scrollParent as HTMLElement;
          const scrollTop = inverse ? element.scrollHeight - element.scrollTop - element.clientHeight : element.scrollTop;
          const scrollHeight = element.scrollHeight - element.clientHeight;
          scrollPercentage = scrollTop / scrollHeight;
          setShowScrollTop(scrollTop > scrollToTopThreshold);
        }

        if (scrollPercentage >= threshold) {
          handleLoadMore();
        }
      };

      scrollParent.addEventListener('scroll', handleScroll, { passive: true });
      return () => scrollParent.removeEventListener('scroll', handleScroll);
    }, [trigger, scrollableParent, hasMore, isLoading, threshold, inverse, scrollToTopThreshold, handleLoadMore]);

    // Intersection Observer-based loading
    useEffect(() => {
      if (trigger !== 'intersection' || !sentinelRef.current) return;

      const observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (entry.isIntersecting && hasMore && !isLoading && !loadingRef.current) {
            handleLoadMore();
          }
        },
        { threshold: 0, rootMargin: '100px' }
      );

      observer.observe(sentinelRef.current);
      return () => observer.disconnect();
    }, [trigger, hasMore, isLoading, handleLoadMore]);

    // Initial load
    useEffect(() => {
      if (initialLoad && hasMore && !isLoading) {
        handleLoadMore();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Scroll to top
    const scrollToTop = useCallback(() => {
      const scrollParent = scrollableParent || window;
      if (scrollParent === window) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        (scrollParent as HTMLElement).scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, [scrollableParent]);

    // Default loader
    const defaultLoader = (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );

    // Default end message
    const defaultEndMessage = (
      <div className="text-center py-4 text-sm text-gray-500">
        No more items to load
      </div>
    );

    // Default error message
    const defaultErrorMessage = (
      <div className="text-center py-4">
        <p className="text-sm text-red-600 mb-2">Failed to load more items</p>
        <button
          type="button"
          className="text-sm text-blue-600 hover:text-blue-700"
          onClick={handleLoadMore}
        >
          Try again
        </button>
      </div>
    );

    // Default load more button
    const defaultLoadMoreButton = (
      <button
        type="button"
        className="w-full py-3 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
        onClick={handleLoadMore}
        disabled={isLoading}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading...
          </span>
        ) : (
          'Load more'
        )}
      </button>
    );

    const content = inverse ? (
      <>
        {/* Top sentinel for inverse scroll */}
        {trigger === 'intersection' && <div ref={sentinelRef} className="h-1" />}
        
        {/* Loading indicator */}
        {isLoading && (loader || defaultLoader)}
        
        {/* Error state */}
        {error && (errorMessage || defaultErrorMessage)}
        
        {/* End message */}
        {!hasMore && !isLoading && !error && (endMessage || defaultEndMessage)}
        
        {children}
      </>
    ) : (
      <>
        {children}
        
        {/* Bottom sentinel */}
        {trigger === 'intersection' && <div ref={sentinelRef} className="h-1" />}
        
        {/* Loading indicator */}
        {isLoading && (loader || defaultLoader)}
        
        {/* Load more button */}
        {trigger === 'button' && hasMore && !isLoading && (loadMoreButton || defaultLoadMoreButton)}
        
        {/* Error state */}
        {error && (errorMessage || defaultErrorMessage)}
        
        {/* End message */}
        {!hasMore && !isLoading && !error && (endMessage || defaultEndMessage)}
      </>
    );

    return (
      <div
        ref={(node) => {
          (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
          if (typeof ref === 'function') {
            ref(node);
          } else if (ref) {
            ref.current = node;
          }
        }}
        className={clsx('relative', className)}
        {...props}
      >
        {content}

        {/* Scroll to top button */}
        {showScrollToTop && showScrollTop && (
          <button
            type="button"
            className="fixed bottom-6 right-6 p-3 bg-white rounded-full shadow-lg border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-all z-50"
            onClick={scrollToTop}
            aria-label="Scroll to top"
          >
            <ChevronUp className="w-5 h-5" />
          </button>
        )}
      </div>
    );
  }
);

InfiniteScroll.displayName = 'InfiniteScroll';

// ============================================================================
// Pagination Component
// ============================================================================

export interface PaginationProps extends HTMLAttributes<HTMLDivElement> {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  totalItems?: number;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  showFirstLast?: boolean;
  showPageNumbers?: boolean;
  showPageSize?: boolean;
  showItemCount?: boolean;
  siblingCount?: number;
  boundaryCount?: number;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'simple' | 'compact';
  disabled?: boolean;
}

export const Pagination = forwardRef<HTMLDivElement, PaginationProps>(
  (
    {
      page,
      totalPages,
      onPageChange,
      pageSize = 10,
      totalItems,
      onPageSizeChange,
      pageSizeOptions = [10, 25, 50, 100],
      showFirstLast = true,
      showPageNumbers = true,
      showPageSize = false,
      showItemCount = false,
      siblingCount = 1,
      boundaryCount = 1,
      size = 'md',
      variant = 'default',
      disabled = false,
      className,
      ...props
    },
    ref
  ) => {
    // Generate page numbers to display
    const pageNumbers = useMemo(() => {
      const range = (start: number, end: number) =>
        Array.from({ length: end - start + 1 }, (_, i) => start + i);

      const totalNumbers = siblingCount * 2 + 3 + boundaryCount * 2;

      if (totalNumbers >= totalPages) {
        return range(1, totalPages);
      }

      const leftSiblingIndex = Math.max(page - siblingCount, boundaryCount + 1);
      const rightSiblingIndex = Math.min(page + siblingCount, totalPages - boundaryCount);

      const showLeftDots = leftSiblingIndex > boundaryCount + 2;
      const showRightDots = rightSiblingIndex < totalPages - boundaryCount - 1;

      const items: (number | 'dots')[] = [];

      // Left boundary
      for (let i = 1; i <= boundaryCount; i++) {
        items.push(i);
      }

      // Left dots
      if (showLeftDots) {
        items.push('dots');
      } else {
        for (let i = boundaryCount + 1; i < leftSiblingIndex; i++) {
          items.push(i);
        }
      }

      // Siblings and current page
      for (let i = leftSiblingIndex; i <= rightSiblingIndex; i++) {
        items.push(i);
      }

      // Right dots
      if (showRightDots) {
        items.push('dots');
      } else {
        for (let i = rightSiblingIndex + 1; i <= totalPages - boundaryCount; i++) {
          items.push(i);
        }
      }

      // Right boundary
      for (let i = totalPages - boundaryCount + 1; i <= totalPages; i++) {
        if (!items.includes(i)) {
          items.push(i);
        }
      }

      return items;
    }, [page, totalPages, siblingCount, boundaryCount]);

    // Size classes
    const sizeClasses = {
      sm: { button: 'px-2 py-1 text-xs', icon: 'w-3 h-3' },
      md: { button: 'px-3 py-1.5 text-sm', icon: 'w-4 h-4' },
      lg: { button: 'px-4 py-2 text-base', icon: 'w-5 h-5' },
    };

    const { button: buttonClass, icon: iconClass } = sizeClasses[size];

    // Item range
    const itemStart = totalItems ? (page - 1) * pageSize + 1 : 0;
    const itemEnd = totalItems ? Math.min(page * pageSize, totalItems) : 0;

    // Simple variant
    if (variant === 'simple') {
      return (
        <div
          ref={ref}
          className={clsx('flex items-center justify-between gap-4', className)}
          {...props}
        >
          <button
            type="button"
            className={clsx(
              buttonClass,
              'inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            onClick={() => onPageChange(page - 1)}
            disabled={disabled || page <= 1}
          >
            <ChevronLeft className={iconClass} />
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            className={clsx(
              buttonClass,
              'inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            onClick={() => onPageChange(page + 1)}
            disabled={disabled || page >= totalPages}
          >
            Next
            <ChevronRight className={iconClass} />
          </button>
        </div>
      );
    }

    // Compact variant
    if (variant === 'compact') {
      return (
        <div
          ref={ref}
          className={clsx('inline-flex items-center gap-1', className)}
          {...props}
        >
          <button
            type="button"
            className={clsx(
              buttonClass,
              'rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            onClick={() => onPageChange(page - 1)}
            disabled={disabled || page <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft className={iconClass} />
          </button>
          <span className={clsx(buttonClass, 'text-gray-600')}>
            {page} / {totalPages}
          </span>
          <button
            type="button"
            className={clsx(
              buttonClass,
              'rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            onClick={() => onPageChange(page + 1)}
            disabled={disabled || page >= totalPages}
            aria-label="Next page"
          >
            <ChevronRight className={iconClass} />
          </button>
        </div>
      );
    }

    // Default variant
    return (
      <div
        ref={ref}
        className={clsx('flex items-center justify-between gap-4 flex-wrap', className)}
        {...props}
      >
        {/* Item count */}
        {showItemCount && totalItems !== undefined && (
          <div className="text-sm text-gray-600">
            Showing {itemStart}-{itemEnd} of {totalItems.toLocaleString()}
          </div>
        )}

        {/* Page navigation */}
        <div className="inline-flex items-center gap-1">
          {/* First page */}
          {showFirstLast && (
            <button
              type="button"
              className={clsx(
                buttonClass,
                'rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
              )}
              onClick={() => onPageChange(1)}
              disabled={disabled || page <= 1}
              aria-label="First page"
            >
              <ChevronsLeft className={iconClass} />
            </button>
          )}

          {/* Previous page */}
          <button
            type="button"
            className={clsx(
              buttonClass,
              'rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            onClick={() => onPageChange(page - 1)}
            disabled={disabled || page <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft className={iconClass} />
          </button>

          {/* Page numbers */}
          {showPageNumbers &&
            pageNumbers.map((pageNum, index) =>
              pageNum === 'dots' ? (
                <span
                  key={`dots-${index}`}
                  className={clsx(buttonClass, 'text-gray-400')}
                >
                  <MoreHorizontal className={iconClass} />
                </span>
              ) : (
                <button
                  key={pageNum}
                  type="button"
                  className={clsx(
                    buttonClass,
                    'min-w-[2.5rem] rounded-lg border transition-colors',
                    pageNum === page
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
                    disabled && 'opacity-50 cursor-not-allowed'
                  )}
                  onClick={() => onPageChange(pageNum)}
                  disabled={disabled}
                  aria-label={`Page ${pageNum}`}
                  aria-current={pageNum === page ? 'page' : undefined}
                >
                  {pageNum}
                </button>
              )
            )}

          {/* Next page */}
          <button
            type="button"
            className={clsx(
              buttonClass,
              'rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            onClick={() => onPageChange(page + 1)}
            disabled={disabled || page >= totalPages}
            aria-label="Next page"
          >
            <ChevronRight className={iconClass} />
          </button>

          {/* Last page */}
          {showFirstLast && (
            <button
              type="button"
              className={clsx(
                buttonClass,
                'rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
              )}
              onClick={() => onPageChange(totalPages)}
              disabled={disabled || page >= totalPages}
              aria-label="Last page"
            >
              <ChevronsRight className={iconClass} />
            </button>
          )}
        </div>

        {/* Page size selector */}
        {showPageSize && onPageSizeChange && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Show</label>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              disabled={disabled}
              className={clsx(
                buttonClass,
                'rounded-lg border border-gray-300 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500'
              )}
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <span className="text-sm text-gray-600">per page</span>
          </div>
        )}
      </div>
    );
  }
);

Pagination.displayName = 'Pagination';

// ============================================================================
// LoadMoreButton Component
// ============================================================================

export interface LoadMoreButtonProps extends HTMLAttributes<HTMLButtonElement> {
  onLoadMore: () => void;
  isLoading?: boolean;
  hasMore?: boolean;
  loadingText?: string;
  loadMoreText?: string;
  endText?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

export const LoadMoreButton = forwardRef<HTMLButtonElement, LoadMoreButtonProps>(
  (
    {
      onLoadMore,
      isLoading = false,
      hasMore = true,
      loadingText = 'Loading...',
      loadMoreText = 'Load more',
      endText = 'No more items',
      variant = 'default',
      size = 'md',
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const sizeClasses = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg',
    };

    const variantClasses = {
      default: 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300',
      outline: 'border-2 border-blue-600 text-blue-600 hover:bg-blue-50 disabled:border-gray-300 disabled:text-gray-400',
      ghost: 'text-blue-600 hover:bg-blue-50 disabled:text-gray-400',
    };

    if (!hasMore && !isLoading) {
      return (
        <div className="text-center py-2">
          <span className="text-sm text-gray-500">{endText}</span>
        </div>
      );
    }

    return (
      <button
        ref={ref}
        type="button"
        className={clsx(
          'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors',
          sizeClasses[size],
          variantClasses[variant],
          className
        )}
        onClick={onLoadMore}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {loadingText}
          </>
        ) : (
          loadMoreText
        )}
      </button>
    );
  }
);

LoadMoreButton.displayName = 'LoadMoreButton';

// ============================================================================
// useInfiniteScroll Hook
// ============================================================================

export interface UseInfiniteScrollOptions<T> {
  fetchFn: (page: number) => Promise<{ items: T[]; hasMore: boolean }>;
  initialPage?: number;
  threshold?: number;
  enabled?: boolean;
}

export interface UseInfiniteScrollReturn<T> {
  items: T[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: Error | null;
  page: number;
  loadMore: () => Promise<void>;
  reset: () => void;
  refresh: () => Promise<void>;
  sentinelRef: React.RefObject<HTMLDivElement | null>;
}

export function useInfiniteScroll<T>(
  options: UseInfiniteScrollOptions<T>
): UseInfiniteScrollReturn<T> {
  const { fetchFn, initialPage = 1, threshold = 0.8, enabled = true } = options;

  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(initialPage);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  // Initial load
  useEffect(() => {
    if (!enabled) return;

    const loadInitial = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await fetchFn(initialPage);
        setItems(result.items);
        setHasMore(result.hasMore);
        setPage(initialPage + 1);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load'));
      } finally {
        setIsLoading(false);
      }
    };

    loadInitial();
  }, [fetchFn, initialPage, enabled]);

  // Load more
  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setIsLoadingMore(true);
    setError(null);

    try {
      const result = await fetchFn(page);
      setItems((prev) => [...prev, ...result.items]);
      setHasMore(result.hasMore);
      setPage((prev) => prev + 1);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load more'));
    } finally {
      setIsLoadingMore(false);
      loadingRef.current = false;
    }
  }, [fetchFn, page, hasMore]);

  // Reset
  const reset = useCallback(() => {
    setItems([]);
    setPage(initialPage);
    setHasMore(true);
    setError(null);
    setIsLoading(false);
    setIsLoadingMore(false);
  }, [initialPage]);

  // Refresh
  const refresh = useCallback(async () => {
    reset();
    setIsLoading(true);

    try {
      const result = await fetchFn(initialPage);
      setItems(result.items);
      setHasMore(result.hasMore);
      setPage(initialPage + 1);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to refresh'));
    } finally {
      setIsLoading(false);
    }
  }, [fetchFn, initialPage, reset]);

  // Intersection observer
  useEffect(() => {
    if (!enabled || !sentinelRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && hasMore && !loadingRef.current) {
          loadMore();
        }
      },
      { threshold, rootMargin: '100px' }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [enabled, hasMore, loadMore, threshold]);

  return useMemo(
    () => ({
      items,
      isLoading,
      isLoadingMore,
      hasMore,
      error,
      page,
      loadMore,
      reset,
      refresh,
      sentinelRef,
    }),
    [items, isLoading, isLoadingMore, hasMore, error, page, loadMore, reset, refresh]
  );
}

// ============================================================================
// usePagination Hook
// ============================================================================

export interface UsePaginationOptions {
  totalItems: number;
  pageSize?: number;
  initialPage?: number;
  onChange?: (page: number, pageSize: number) => void;
}

export interface UsePaginationReturn {
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
  startIndex: number;
  endIndex: number;
  canPrevious: boolean;
  canNext: boolean;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  firstPage: () => void;
  lastPage: () => void;
}

export function usePagination(options: UsePaginationOptions): UsePaginationReturn {
  const { totalItems, pageSize: initialPageSize = 10, initialPage = 1, onChange } = options;

  const [page, setPageState] = useState(initialPage);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  const totalPages = Math.ceil(totalItems / pageSize);

  const setPage = useCallback(
    (newPage: number) => {
      const validPage = Math.max(1, Math.min(newPage, totalPages));
      setPageState(validPage);
      onChange?.(validPage, pageSize);
    },
    [totalPages, pageSize, onChange]
  );

  const setPageSize = useCallback(
    (newPageSize: number) => {
      setPageSizeState(newPageSize);
      // Reset to first page when page size changes
      setPageState(1);
      onChange?.(1, newPageSize);
    },
    [onChange]
  );

  const nextPage = useCallback(() => setPage(page + 1), [page, setPage]);
  const previousPage = useCallback(() => setPage(page - 1), [page, setPage]);
  const firstPage = useCallback(() => setPage(1), [setPage]);
  const lastPage = useCallback(() => setPage(totalPages), [setPage, totalPages]);

  const startIndex = (page - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  return useMemo(
    () => ({
      page,
      pageSize,
      totalPages,
      totalItems,
      startIndex,
      endIndex,
      canPrevious: page > 1,
      canNext: page < totalPages,
      setPage,
      setPageSize,
      nextPage,
      previousPage,
      firstPage,
      lastPage,
    }),
    [page, pageSize, totalPages, totalItems, startIndex, endIndex, setPage, setPageSize, nextPage, previousPage, firstPage, lastPage]
  );
}

// ============================================================================
// Exports
// ============================================================================

export default InfiniteScroll;
