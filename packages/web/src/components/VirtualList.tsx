/**
 * VirtualList.tsx
 * CRITICAL-47: Virtual scrolling list for large datasets
 *
 * High-performance virtualized list that only renders visible items.
 * Supports fixed and variable height items, infinite loading, and more.
 *
 * @module VirtualList
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
  type CSSProperties,
} from 'react';
import clsx from 'clsx';
import { Loader2, ChevronUp } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface VirtualItem<T = unknown> {
  index: number;
  start: number;
  end: number;
  size: number;
  data: T;
}

export interface VirtualRange {
  startIndex: number;
  endIndex: number;
  overscan: number;
}

export interface VirtualListState {
  scrollOffset: number;
  scrollDirection: 'forward' | 'backward';
  isScrolling: boolean;
}

export interface ItemSizeCache {
  [index: number]: number;
}

// ============================================================================
// Context
// ============================================================================

interface VirtualListContextValue {
  scrollToIndex: (index: number, align?: 'start' | 'center' | 'end' | 'auto') => void;
  scrollToOffset: (offset: number) => void;
  scrollToTop: () => void;
  scrollToBottom: () => void;
  getTotalSize: () => number;
  getVisibleRange: () => VirtualRange;
}

const VirtualListContext = createContext<VirtualListContextValue | null>(null);

export function useVirtualListContext(): VirtualListContextValue {
  const context = useContext(VirtualListContext);
  if (!context) {
    throw new Error('Virtual list components must be used within VirtualList');
  }
  return context;
}

// ============================================================================
// Utilities
// ============================================================================

export function binarySearch(
  cache: ItemSizeCache,
  low: number,
  high: number,
  offset: number,
  defaultSize: number
): number {
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const midOffset = getOffsetForIndex(cache, mid, defaultSize);

    if (midOffset === offset) {
      return mid;
    } else if (midOffset < offset) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return low > 0 ? low - 1 : 0;
}

export function getOffsetForIndex(
  cache: ItemSizeCache,
  index: number,
  defaultSize: number
): number {
  let offset = 0;
  for (let i = 0; i < index; i++) {
    offset += cache[i] ?? defaultSize;
  }
  return offset;
}

export function getSizeForIndex(
  cache: ItemSizeCache,
  index: number,
  defaultSize: number
): number {
  return cache[index] ?? defaultSize;
}

export function calculateRange(
  scrollOffset: number,
  containerSize: number,
  itemCount: number,
  cache: ItemSizeCache,
  defaultSize: number,
  overscan: number
): VirtualRange {
  const startIndex = binarySearch(cache, 0, itemCount - 1, scrollOffset, defaultSize);
  
  let endIndex = startIndex;
  let currentOffset = getOffsetForIndex(cache, startIndex, defaultSize);
  
  while (currentOffset < scrollOffset + containerSize && endIndex < itemCount - 1) {
    currentOffset += getSizeForIndex(cache, endIndex, defaultSize);
    endIndex++;
  }

  return {
    startIndex: Math.max(0, startIndex - overscan),
    endIndex: Math.min(itemCount - 1, endIndex + overscan),
    overscan,
  };
}

// ============================================================================
// VirtualList Component
// ============================================================================

export interface VirtualListProps<T> extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onScroll'> {
  items: T[];
  itemHeight: number | ((item: T, index: number) => number);
  overscan?: number;
  containerHeight: number;
  renderItem: (item: T, index: number, style: CSSProperties) => ReactNode;
  keyExtractor?: (item: T, index: number) => string | number;
  onScroll?: (state: VirtualListState) => void;
  onEndReached?: () => void;
  endReachedThreshold?: number;
  isLoading?: boolean;
  loadingComponent?: ReactNode;
  emptyComponent?: ReactNode;
  headerComponent?: ReactNode;
  footerComponent?: ReactNode;
  scrollToTopThreshold?: number;
  showScrollToTop?: boolean;
  gap?: number;
}

function VirtualListInner<T>(
  {
    items,
    itemHeight,
    overscan = 3,
    containerHeight,
    renderItem,
    keyExtractor = (_, i) => i,
    onScroll,
    onEndReached,
    endReachedThreshold = 0.8,
    isLoading = false,
    loadingComponent,
    emptyComponent,
    headerComponent,
    footerComponent,
    scrollToTopThreshold = 500,
    showScrollToTop = true,
    gap = 0,
    className,
    style,
    ...props
  }: VirtualListProps<T>,
  ref: React.ForwardedRef<HTMLDivElement>
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollDirectionRef = useRef<'forward' | 'backward'>('forward');
  const scrollTimeoutRef = useRef<number>();
  const sizeCache = useRef<ItemSizeCache>({});
  const endReachedRef = useRef(false);

  // Calculate default item height
  const defaultHeight = typeof itemHeight === 'number' ? itemHeight : 50;

  // Populate size cache for variable heights
  useEffect(() => {
    if (typeof itemHeight === 'function') {
      items.forEach((item, index) => {
        sizeCache.current[index] = itemHeight(item, index);
      });
    }
  }, [items, itemHeight]);

  // Calculate total size
  const totalSize = useMemo(() => {
    if (typeof itemHeight === 'number') {
      return items.length * itemHeight + (items.length - 1) * gap;
    }
    return items.reduce((acc, item, i) => {
      return acc + (sizeCache.current[i] ?? itemHeight(item, i)) + (i > 0 ? gap : 0);
    }, 0);
  }, [items, itemHeight, gap]);

  // Calculate visible range
  const visibleRange = useMemo(() => {
    return calculateRange(
      scrollOffset,
      containerHeight,
      items.length,
      sizeCache.current,
      defaultHeight + gap,
      overscan
    );
  }, [scrollOffset, containerHeight, items.length, defaultHeight, overscan, gap]);

  // Generate virtual items
  const virtualItems = useMemo(() => {
    const result: VirtualItem<T>[] = [];
    let currentOffset = 0;

    for (let i = 0; i <= visibleRange.endIndex && i < items.length; i++) {
      const size = getSizeForIndex(sizeCache.current, i, defaultHeight);
      
      if (i >= visibleRange.startIndex) {
        result.push({
          index: i,
          start: currentOffset,
          end: currentOffset + size,
          size,
          data: items[i],
        });
      }
      
      currentOffset += size + gap;
    }

    return result;
  }, [visibleRange, items, defaultHeight, gap]);

  // Handle scroll
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.currentTarget;
      const newOffset = target.scrollTop;
      
      scrollDirectionRef.current = newOffset > scrollOffset ? 'forward' : 'backward';
      setScrollOffset(newOffset);
      setIsScrolling(true);

      // Clear existing timeout
      if (scrollTimeoutRef.current) {
        window.clearTimeout(scrollTimeoutRef.current);
      }

      // Set scrolling to false after scroll ends
      scrollTimeoutRef.current = window.setTimeout(() => {
        setIsScrolling(false);
      }, 150);

      // Call onScroll callback
      onScroll?.({
        scrollOffset: newOffset,
        scrollDirection: scrollDirectionRef.current,
        isScrolling: true,
      });

      // Check for end reached
      const scrollPercentage = (newOffset + containerHeight) / totalSize;
      if (
        scrollPercentage >= endReachedThreshold &&
        !endReachedRef.current &&
        !isLoading
      ) {
        endReachedRef.current = true;
        onEndReached?.();
      }
    },
    [scrollOffset, containerHeight, totalSize, endReachedThreshold, isLoading, onScroll, onEndReached]
  );

  // Reset end reached flag when items change
  useEffect(() => {
    endReachedRef.current = false;
  }, [items.length]);

  // Scroll methods
  const scrollToOffset = useCallback((offset: number) => {
    if (containerRef.current) {
      containerRef.current.scrollTop = offset;
    }
  }, []);

  const scrollToIndex = useCallback(
    (index: number, align: 'start' | 'center' | 'end' | 'auto' = 'auto') => {
      const offset = getOffsetForIndex(sizeCache.current, index, defaultHeight + gap);
      const size = getSizeForIndex(sizeCache.current, index, defaultHeight);

      let targetOffset: number;

      switch (align) {
        case 'start':
          targetOffset = offset;
          break;
        case 'center':
          targetOffset = offset - containerHeight / 2 + size / 2;
          break;
        case 'end':
          targetOffset = offset - containerHeight + size;
          break;
        case 'auto':
        default:
          if (offset < scrollOffset) {
            targetOffset = offset;
          } else if (offset + size > scrollOffset + containerHeight) {
            targetOffset = offset - containerHeight + size;
          } else {
            return; // Already visible
          }
      }

      scrollToOffset(Math.max(0, targetOffset));
    },
    [scrollOffset, containerHeight, defaultHeight, gap, scrollToOffset]
  );

  const scrollToTop = useCallback(() => {
    scrollToOffset(0);
  }, [scrollToOffset]);

  const scrollToBottom = useCallback(() => {
    scrollToOffset(totalSize - containerHeight);
  }, [scrollToOffset, totalSize, containerHeight]);

  const getTotalSize = useCallback(() => totalSize, [totalSize]);

  const getVisibleRange = useCallback(() => visibleRange, [visibleRange]);

  // Context value
  const contextValue = useMemo<VirtualListContextValue>(
    () => ({
      scrollToIndex,
      scrollToOffset,
      scrollToTop,
      scrollToBottom,
      getTotalSize,
      getVisibleRange,
    }),
    [scrollToIndex, scrollToOffset, scrollToTop, scrollToBottom, getTotalSize, getVisibleRange]
  );

  // Show scroll to top button
  const shouldShowScrollToTop = showScrollToTop && scrollOffset > scrollToTopThreshold;

  // Empty state
  if (items.length === 0 && !isLoading) {
    return (
      <div
        ref={ref}
        className={clsx('flex items-center justify-center', className)}
        style={{ ...style, height: containerHeight }}
        {...props}
      >
        {emptyComponent || (
          <p className="text-gray-500 text-sm">No items to display</p>
        )}
      </div>
    );
  }

  return (
    <VirtualListContext.Provider value={contextValue}>
      <div className="relative">
        <div
          ref={(node) => {
            (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
            if (typeof ref === 'function') {
              ref(node);
            } else if (ref) {
              ref.current = node;
            }
          }}
          className={clsx('overflow-auto', className)}
          style={{ ...style, height: containerHeight }}
          onScroll={handleScroll}
          {...props}
        >
          {/* Header */}
          {headerComponent && <div className="sticky top-0 z-10">{headerComponent}</div>}

          {/* Virtual content container */}
          <div style={{ height: totalSize, position: 'relative' }}>
            {virtualItems.map((virtualItem) => (
              <div
                key={keyExtractor(virtualItem.data, virtualItem.index)}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: virtualItem.size,
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                {renderItem(virtualItem.data, virtualItem.index, {
                  height: virtualItem.size,
                })}
              </div>
            ))}
          </div>

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex items-center justify-center py-4">
              {loadingComponent || (
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              )}
            </div>
          )}

          {/* Footer */}
          {footerComponent && <div>{footerComponent}</div>}
        </div>

        {/* Scroll to top button */}
        {shouldShowScrollToTop && (
          <button
            type="button"
            className="absolute bottom-4 right-4 p-2 bg-white rounded-full shadow-lg border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-all z-20"
            onClick={scrollToTop}
            aria-label="Scroll to top"
          >
            <ChevronUp className="w-5 h-5" />
          </button>
        )}
      </div>
    </VirtualListContext.Provider>
  );
}

export const VirtualList = forwardRef(VirtualListInner) as <T>(
  props: VirtualListProps<T> & { ref?: React.ForwardedRef<HTMLDivElement> }
) => ReturnType<typeof VirtualListInner>;

// ============================================================================
// VirtualGrid Component
// ============================================================================

export interface VirtualGridProps<T> extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onScroll'> {
  items: T[];
  columns: number;
  itemHeight: number;
  itemWidth?: number;
  overscan?: number;
  containerHeight: number;
  renderItem: (item: T, index: number, style: CSSProperties) => ReactNode;
  keyExtractor?: (item: T, index: number) => string | number;
  onScroll?: (state: VirtualListState) => void;
  gap?: number;
}

function VirtualGridInner<T>(
  {
    items,
    columns,
    itemHeight,
    itemWidth,
    overscan = 2,
    containerHeight,
    renderItem,
    keyExtractor = (_, i) => i,
    onScroll,
    gap = 0,
    className,
    style,
    ...props
  }: VirtualGridProps<T>,
  ref: React.ForwardedRef<HTMLDivElement>
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  // Calculate row count
  const rowCount = Math.ceil(items.length / columns);
  const rowHeight = itemHeight + gap;
  const totalHeight = rowCount * rowHeight - gap;

  // Calculate visible rows
  const startRow = Math.floor(scrollOffset / rowHeight);
  const endRow = Math.min(
    Math.ceil((scrollOffset + containerHeight) / rowHeight),
    rowCount - 1
  );
  const overscanStartRow = Math.max(0, startRow - overscan);
  const overscanEndRow = Math.min(rowCount - 1, endRow + overscan);

  // Calculate item width
  const calculatedItemWidth = useMemo(() => {
    if (itemWidth) return itemWidth;
    if (containerWidth === 0) return 0;
    return (containerWidth - gap * (columns - 1)) / columns;
  }, [itemWidth, containerWidth, columns, gap]);

  // Handle scroll
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const newOffset = e.currentTarget.scrollTop;
      setScrollOffset(newOffset);
      onScroll?.({
        scrollOffset: newOffset,
        scrollDirection: newOffset > scrollOffset ? 'forward' : 'backward',
        isScrolling: true,
      });
    },
    [scrollOffset, onScroll]
  );

  // Observe container width
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Generate virtual items
  const virtualItems = useMemo(() => {
    const result: { row: number; col: number; index: number; item: T }[] = [];

    for (let row = overscanStartRow; row <= overscanEndRow; row++) {
      for (let col = 0; col < columns; col++) {
        const index = row * columns + col;
        if (index >= items.length) break;
        result.push({ row, col, index, item: items[index] });
      }
    }

    return result;
  }, [overscanStartRow, overscanEndRow, columns, items]);

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
      className={clsx('overflow-auto', className)}
      style={{ ...style, height: containerHeight }}
      onScroll={handleScroll}
      {...props}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {virtualItems.map(({ row, col, index, item }) => (
          <div
            key={keyExtractor(item, index)}
            style={{
              position: 'absolute',
              top: row * rowHeight,
              left: col * (calculatedItemWidth + gap),
              width: calculatedItemWidth,
              height: itemHeight,
            }}
          >
            {renderItem(item, index, {
              width: calculatedItemWidth,
              height: itemHeight,
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export const VirtualGrid = forwardRef(VirtualGridInner) as <T>(
  props: VirtualGridProps<T> & { ref?: React.ForwardedRef<HTMLDivElement> }
) => ReturnType<typeof VirtualGridInner>;

// ============================================================================
// VirtualTable Component
// ============================================================================

export interface VirtualTableColumn<T> {
  key: string;
  header: ReactNode;
  width: number | string;
  render: (item: T, index: number) => ReactNode;
  align?: 'left' | 'center' | 'right';
  sticky?: boolean;
}

export interface VirtualTableProps<T> extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  items: T[];
  columns: VirtualTableColumn<T>[];
  rowHeight?: number;
  headerHeight?: number;
  overscan?: number;
  containerHeight: number;
  keyExtractor?: (item: T, index: number) => string | number;
  onRowClick?: (item: T, index: number) => void;
  selectedIndex?: number;
  stickyHeader?: boolean;
}

function VirtualTableInner<T>(
  {
    items,
    columns,
    rowHeight = 48,
    headerHeight = 48,
    overscan = 5,
    containerHeight,
    keyExtractor = (_, i) => i,
    onRowClick,
    selectedIndex,
    stickyHeader = true,
    className,
    style,
    ...props
  }: VirtualTableProps<T>,
  ref: React.ForwardedRef<HTMLDivElement>
) {
  const [scrollOffset, setScrollOffset] = useState(0);

  // Calculate visible rows
  const effectiveContainerHeight = containerHeight - headerHeight;
  const totalHeight = items.length * rowHeight;
  const startIndex = Math.floor(scrollOffset / rowHeight);
  const endIndex = Math.min(
    Math.ceil((scrollOffset + effectiveContainerHeight) / rowHeight),
    items.length - 1
  );
  const overscanStart = Math.max(0, startIndex - overscan);
  const overscanEnd = Math.min(items.length - 1, endIndex + overscan);

  // Handle scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollOffset(e.currentTarget.scrollTop);
  }, []);

  // Generate virtual rows
  const virtualRows = useMemo(() => {
    const rows: { index: number; item: T; top: number }[] = [];
    for (let i = overscanStart; i <= overscanEnd; i++) {
      rows.push({
        index: i,
        item: items[i],
        top: i * rowHeight,
      });
    }
    return rows;
  }, [overscanStart, overscanEnd, items, rowHeight]);

  return (
    <div
      ref={ref}
      className={clsx('overflow-auto border border-gray-200 rounded-lg', className)}
      style={{ ...style, height: containerHeight }}
      onScroll={handleScroll}
      {...props}
    >
      {/* Header */}
      <div
        className={clsx(
          'flex bg-gray-50 border-b border-gray-200',
          stickyHeader && 'sticky top-0 z-10'
        )}
        style={{ height: headerHeight }}
      >
        {columns.map((column) => (
          <div
            key={column.key}
            className={clsx(
              'flex items-center px-4 font-medium text-gray-700 text-sm',
              column.align === 'center' && 'justify-center',
              column.align === 'right' && 'justify-end',
              column.sticky && 'sticky left-0 bg-gray-50 z-10'
            )}
            style={{ width: column.width, minWidth: column.width }}
          >
            {column.header}
          </div>
        ))}
      </div>

      {/* Body */}
      <div style={{ height: totalHeight, position: 'relative' }}>
        {virtualRows.map(({ index, item, top }) => (
          <div
            key={keyExtractor(item, index)}
            className={clsx(
              'flex absolute left-0 right-0 border-b border-gray-100',
              onRowClick && 'cursor-pointer hover:bg-gray-50',
              selectedIndex === index && 'bg-blue-50'
            )}
            style={{ top, height: rowHeight }}
            onClick={() => onRowClick?.(item, index)}
            role={onRowClick ? 'button' : undefined}
          >
            {columns.map((column) => (
              <div
                key={column.key}
                className={clsx(
                  'flex items-center px-4 text-sm text-gray-900',
                  column.align === 'center' && 'justify-center',
                  column.align === 'right' && 'justify-end',
                  column.sticky && 'sticky left-0 bg-white z-10'
                )}
                style={{ width: column.width, minWidth: column.width }}
              >
                {column.render(item, index)}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export const VirtualTable = forwardRef(VirtualTableInner) as <T>(
  props: VirtualTableProps<T> & { ref?: React.ForwardedRef<HTMLDivElement> }
) => ReturnType<typeof VirtualTableInner>;

// ============================================================================
// useVirtualList Hook
// ============================================================================

export interface UseVirtualListOptions<T> {
  items: T[];
  itemHeight: number | ((item: T, index: number) => number);
  containerHeight: number;
  overscan?: number;
  gap?: number;
}

export interface UseVirtualListReturn<T> {
  virtualItems: VirtualItem<T>[];
  totalSize: number;
  visibleRange: VirtualRange;
  scrollOffset: number;
  setScrollOffset: (offset: number) => void;
  scrollToIndex: (index: number) => void;
  scrollToTop: () => void;
  scrollToBottom: () => void;
  containerProps: {
    style: CSSProperties;
    onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  };
  contentProps: {
    style: CSSProperties;
  };
}

export function useVirtualList<T>(options: UseVirtualListOptions<T>): UseVirtualListReturn<T> {
  const { items, itemHeight, containerHeight, overscan = 3, gap = 0 } = options;
  const [scrollOffset, setScrollOffset] = useState(0);
  const sizeCache = useRef<ItemSizeCache>({});

  const defaultHeight = typeof itemHeight === 'number' ? itemHeight : 50;

  // Populate cache
  useEffect(() => {
    if (typeof itemHeight === 'function') {
      items.forEach((item, index) => {
        sizeCache.current[index] = itemHeight(item, index);
      });
    }
  }, [items, itemHeight]);

  // Calculate total size
  const totalSize = useMemo(() => {
    if (typeof itemHeight === 'number') {
      return items.length * itemHeight + (items.length - 1) * gap;
    }
    return items.reduce((acc, item, i) => {
      return acc + (sizeCache.current[i] ?? itemHeight(item, i)) + (i > 0 ? gap : 0);
    }, 0);
  }, [items, itemHeight, gap]);

  // Calculate visible range
  const visibleRange = useMemo(() => {
    return calculateRange(
      scrollOffset,
      containerHeight,
      items.length,
      sizeCache.current,
      defaultHeight + gap,
      overscan
    );
  }, [scrollOffset, containerHeight, items.length, defaultHeight, overscan, gap]);

  // Generate virtual items
  const virtualItems = useMemo(() => {
    const result: VirtualItem<T>[] = [];
    let currentOffset = 0;

    for (let i = 0; i <= visibleRange.endIndex && i < items.length; i++) {
      const size = getSizeForIndex(sizeCache.current, i, defaultHeight);

      if (i >= visibleRange.startIndex) {
        result.push({
          index: i,
          start: currentOffset,
          end: currentOffset + size,
          size,
          data: items[i],
        });
      }

      currentOffset += size + gap;
    }

    return result;
  }, [visibleRange, items, defaultHeight, gap]);

  // Scroll handlers
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollOffset(e.currentTarget.scrollTop);
  }, []);

  const scrollToIndex = useCallback(
    (index: number) => {
      const offset = getOffsetForIndex(sizeCache.current, index, defaultHeight + gap);
      setScrollOffset(Math.max(0, offset));
    },
    [defaultHeight, gap]
  );

  const scrollToTop = useCallback(() => {
    setScrollOffset(0);
  }, []);

  const scrollToBottom = useCallback(() => {
    setScrollOffset(totalSize - containerHeight);
  }, [totalSize, containerHeight]);

  return useMemo(
    () => ({
      virtualItems,
      totalSize,
      visibleRange,
      scrollOffset,
      setScrollOffset,
      scrollToIndex,
      scrollToTop,
      scrollToBottom,
      containerProps: {
        style: { height: containerHeight, overflow: 'auto' } as CSSProperties,
        onScroll: handleScroll,
      },
      contentProps: {
        style: { height: totalSize, position: 'relative' } as CSSProperties,
      },
    }),
    [
      virtualItems,
      totalSize,
      visibleRange,
      scrollOffset,
      scrollToIndex,
      scrollToTop,
      scrollToBottom,
      containerHeight,
      handleScroll,
    ]
  );
}

// ============================================================================
// WindowedList Component (Window scroller)
// ============================================================================

export interface WindowedListProps<T> extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  items: T[];
  itemHeight: number;
  renderItem: (item: T, index: number, style: CSSProperties) => ReactNode;
  keyExtractor?: (item: T, index: number) => string | number;
  overscan?: number;
  offsetTop?: number;
}

function WindowedListInner<T>(
  {
    items,
    itemHeight,
    renderItem,
    keyExtractor = (_, i) => i,
    overscan = 5,
    offsetTop = 0,
    className,
    ...props
  }: WindowedListProps<T>,
  ref: React.ForwardedRef<HTMLDivElement>
) {
  const [scrollTop, setScrollTop] = useState(0);
  const [windowHeight, setWindowHeight] = useState(
    typeof window !== 'undefined' ? window.innerHeight : 800
  );

  useEffect(() => {
    const handleScroll = () => {
      setScrollTop(window.scrollY - offsetTop);
    };

    const handleResize = () => {
      setWindowHeight(window.innerHeight);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);

    handleScroll();
    handleResize();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [offsetTop]);

  // Calculate visible range
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + windowHeight) / itemHeight) + overscan
  );

  const totalHeight = items.length * itemHeight;

  // Generate virtual items
  const virtualItems = useMemo(() => {
    const result: { index: number; item: T; top: number }[] = [];
    for (let i = startIndex; i <= endIndex; i++) {
      result.push({
        index: i,
        item: items[i],
        top: i * itemHeight,
      });
    }
    return result;
  }, [startIndex, endIndex, items, itemHeight]);

  return (
    <div
      ref={ref}
      className={clsx('relative', className)}
      style={{ height: totalHeight }}
      {...props}
    >
      {virtualItems.map(({ index, item, top }) => (
        <div
          key={keyExtractor(item, index)}
          style={{
            position: 'absolute',
            top,
            left: 0,
            right: 0,
            height: itemHeight,
          }}
        >
          {renderItem(item, index, { height: itemHeight })}
        </div>
      ))}
    </div>
  );
}

export const WindowedList = forwardRef(WindowedListInner) as <T>(
  props: WindowedListProps<T> & { ref?: React.ForwardedRef<HTMLDivElement> }
) => ReturnType<typeof WindowedListInner>;

// ============================================================================
// Exports
// ============================================================================

export default VirtualList;
