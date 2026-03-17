/**
 * Masonry.tsx
 * CRITICAL-50: Masonry grid layout component
 *
 * Pinterest-style masonry layouts with responsive columns,
 * animations, and infinite loading support.
 *
 * @module Masonry
 */

import React, {
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
import { Loader2 } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface MasonryItem {
  id: string | number;
  height?: number;
  aspectRatio?: number;
}

export interface MasonryBreakpoint {
  minWidth: number;
  columns: number;
  gap?: number;
}

export interface ColumnData {
  index: number;
  height: number;
  items: { index: number; item: unknown; top: number }[];
}

// ============================================================================
// Utilities
// ============================================================================

export function getColumnsForWidth(
  width: number,
  breakpoints: MasonryBreakpoint[],
  defaultColumns: number = 3
): { columns: number; gap: number } {
  // Sort breakpoints by minWidth descending
  const sorted = [...breakpoints].sort((a, b) => b.minWidth - a.minWidth);
  
  for (const bp of sorted) {
    if (width >= bp.minWidth) {
      return { columns: bp.columns, gap: bp.gap ?? 16 };
    }
  }
  
  return { columns: defaultColumns, gap: 16 };
}

export function distributeItems<T>(
  items: T[],
  columns: number,
  getHeight: (item: T, index: number) => number
): ColumnData[] {
  // Initialize columns
  const columnData: ColumnData[] = Array.from({ length: columns }, (_, i) => ({
    index: i,
    height: 0,
    items: [],
  }));

  // Distribute items to shortest column
  items.forEach((item, index) => {
    const height = getHeight(item, index);
    
    // Find shortest column
    let shortestColumn = columnData[0];
    for (const col of columnData) {
      if (col.height < shortestColumn.height) {
        shortestColumn = col;
      }
    }

    // Add item to shortest column
    shortestColumn.items.push({
      index,
      item,
      top: shortestColumn.height,
    });
    shortestColumn.height += height;
  });

  return columnData;
}

export function calculateMasonryPositions<T>(
  items: T[],
  columns: number,
  columnWidth: number,
  gap: number,
  getHeight: (item: T, index: number) => number
): { positions: Map<number, { left: number; top: number; width: number; height: number }>; totalHeight: number } {
  const positions = new Map<number, { left: number; top: number; width: number; height: number }>();
  const columnHeights = new Array(columns).fill(0);

  items.forEach((item, index) => {
    const height = getHeight(item, index);
    
    // Find shortest column
    let shortestColumnIndex = 0;
    let shortestHeight = columnHeights[0];
    for (let i = 1; i < columns; i++) {
      if (columnHeights[i] < shortestHeight) {
        shortestHeight = columnHeights[i];
        shortestColumnIndex = i;
      }
    }

    // Position item
    const left = shortestColumnIndex * (columnWidth + gap);
    const top = columnHeights[shortestColumnIndex];

    positions.set(index, { left, top, width: columnWidth, height });
    columnHeights[shortestColumnIndex] += height + gap;
  });

  const totalHeight = Math.max(...columnHeights) - gap;
  return { positions, totalHeight };
}

// ============================================================================
// Default Breakpoints
// ============================================================================

export const DEFAULT_BREAKPOINTS: MasonryBreakpoint[] = [
  { minWidth: 1280, columns: 5, gap: 16 },
  { minWidth: 1024, columns: 4, gap: 16 },
  { minWidth: 768, columns: 3, gap: 12 },
  { minWidth: 640, columns: 2, gap: 12 },
  { minWidth: 0, columns: 1, gap: 8 },
];

// ============================================================================
// Masonry Component
// ============================================================================

export interface MasonryProps<T> extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  keyExtractor?: (item: T, index: number) => string | number;
  columns?: number;
  gap?: number;
  breakpoints?: MasonryBreakpoint[];
  columnWidth?: number;
  getItemHeight?: (item: T, index: number) => number;
  defaultItemHeight?: number;
  animate?: boolean;
  animationDuration?: number;
  onEndReached?: () => void;
  endReachedThreshold?: number;
  isLoading?: boolean;
  loadingComponent?: ReactNode;
  emptyComponent?: ReactNode;
}

function MasonryInner<T>(
  {
    items,
    renderItem,
    keyExtractor = (_, i) => i,
    columns: fixedColumns,
    gap: fixedGap = 16,
    breakpoints = DEFAULT_BREAKPOINTS,
    columnWidth: fixedColumnWidth,
    getItemHeight,
    defaultItemHeight = 200,
    animate = true,
    animationDuration = 300,
    onEndReached,
    endReachedThreshold = 0.8,
    isLoading = false,
    loadingComponent,
    emptyComponent,
    className,
    style,
    ...props
  }: MasonryProps<T>,
  ref: React.ForwardedRef<HTMLDivElement>
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [measuredHeights, setMeasuredHeights] = useState<Map<string | number, number>>(new Map());
  const endReachedRef = useRef(false);
  const itemRefs = useRef<Map<string | number, HTMLDivElement>>(new Map());

  // Get columns and gap based on container width
  const { columns, gap } = useMemo(() => {
    if (fixedColumns !== undefined) {
      return { columns: fixedColumns, gap: fixedGap };
    }
    if (containerWidth === 0) {
      return { columns: 1, gap: fixedGap };
    }
    return getColumnsForWidth(containerWidth, breakpoints, 3);
  }, [fixedColumns, fixedGap, containerWidth, breakpoints]);

  // Calculate column width
  const columnWidth = useMemo(() => {
    if (fixedColumnWidth) return fixedColumnWidth;
    if (containerWidth === 0) return 0;
    return (containerWidth - gap * (columns - 1)) / columns;
  }, [fixedColumnWidth, containerWidth, gap, columns]);

  // Get item height
  const getHeight = useCallback(
    (item: T, index: number): number => {
      if (getItemHeight) {
        return getItemHeight(item, index);
      }
      const key = keyExtractor(item, index);
      return measuredHeights.get(key) ?? defaultItemHeight;
    },
    [getItemHeight, keyExtractor, measuredHeights, defaultItemHeight]
  );

  // Calculate positions
  const { positions, totalHeight } = useMemo(() => {
    if (columnWidth === 0) {
      return { positions: new Map(), totalHeight: 0 };
    }
    return calculateMasonryPositions(items, columns, columnWidth, gap, getHeight);
  }, [items, columns, columnWidth, gap, getHeight]);

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

  // Measure item heights
  useEffect(() => {
    if (getItemHeight) return; // Skip if custom height function provided

    const newHeights = new Map(measuredHeights);
    let changed = false;

    itemRefs.current.forEach((el, key) => {
      if (el && !newHeights.has(key)) {
        const height = el.getBoundingClientRect().height;
        newHeights.set(key, height);
        changed = true;
      }
    });

    if (changed) {
      setMeasuredHeights(newHeights);
    }
  }, [items, getItemHeight, measuredHeights]);

  // Scroll handler for infinite loading
  useEffect(() => {
    if (!onEndReached) return;

    const handleScroll = () => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const scrollBottom = window.scrollY + window.innerHeight;
      const containerBottom = rect.top + window.scrollY + totalHeight;

      const scrollPercentage = scrollBottom / containerBottom;

      if (
        scrollPercentage >= endReachedThreshold &&
        !endReachedRef.current &&
        !isLoading
      ) {
        endReachedRef.current = true;
        onEndReached();
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [onEndReached, totalHeight, endReachedThreshold, isLoading]);

  // Reset end reached flag when items change
  useEffect(() => {
    endReachedRef.current = false;
  }, [items.length]);

  // Empty state
  if (items.length === 0 && !isLoading) {
    return (
      <div
        ref={ref}
        className={clsx('flex items-center justify-center py-12', className)}
        {...props}
      >
        {emptyComponent || (
          <p className="text-gray-500 text-sm">No items to display</p>
        )}
      </div>
    );
  }

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
      style={{ ...style, minHeight: totalHeight }}
      {...props}
    >
      {items.map((item, index) => {
        const key = keyExtractor(item, index);
        const position = positions.get(index);

        if (!position) return null;

        const itemStyle: CSSProperties = {
          position: 'absolute',
          top: position.top,
          left: position.left,
          width: position.width,
          ...(animate && {
            transition: `all ${animationDuration}ms ease-out`,
          }),
        };

        return (
          <div
            key={key}
            ref={(el) => {
              if (el) {
                itemRefs.current.set(key, el);
              } else {
                itemRefs.current.delete(key);
              }
            }}
            style={itemStyle}
          >
            {renderItem(item, index)}
          </div>
        );
      })}

      {/* Loading indicator */}
      {isLoading && (
        <div
          className="absolute bottom-0 left-0 right-0 flex items-center justify-center py-4"
          style={{ top: totalHeight }}
        >
          {loadingComponent || (
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          )}
        </div>
      )}
    </div>
  );
}

export const Masonry = forwardRef(MasonryInner) as <T>(
  props: MasonryProps<T> & { ref?: React.ForwardedRef<HTMLDivElement> }
) => ReturnType<typeof MasonryInner>;

// ============================================================================
// MasonryGrid Component (CSS Grid-based)
// ============================================================================

export interface MasonryGridProps extends HTMLAttributes<HTMLDivElement> {
  columns?: number;
  gap?: number;
  children: ReactNode;
}

export const MasonryGrid = forwardRef<HTMLDivElement, MasonryGridProps>(
  ({ columns = 3, gap = 16, children, className, style, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={clsx('grid', className)}
        style={{
          ...style,
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap,
        }}
        {...props}
      >
        {React.Children.map(children, (child, index) => (
          <div
            key={index}
            style={{
              breakInside: 'avoid',
            }}
          >
            {child}
          </div>
        ))}
      </div>
    );
  }
);

MasonryGrid.displayName = 'MasonryGrid';

// ============================================================================
// MasonryColumn Component (Column-based layout)
// ============================================================================

export interface MasonryColumnsProps extends HTMLAttributes<HTMLDivElement> {
  columns?: number;
  gap?: number;
  children: ReactNode;
}

export const MasonryColumns = forwardRef<HTMLDivElement, MasonryColumnsProps>(
  ({ columns = 3, gap = 16, children, className, style, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={clsx(className)}
        style={{
          ...style,
          columnCount: columns,
          columnGap: gap,
        }}
        {...props}
      >
        {React.Children.map(children, (child, index) => (
          <div
            key={index}
            style={{
              breakInside: 'avoid',
              marginBottom: gap,
            }}
          >
            {child}
          </div>
        ))}
      </div>
    );
  }
);

MasonryColumns.displayName = 'MasonryColumns';

// ============================================================================
// ResponsiveMasonry Component
// ============================================================================

export interface ResponsiveMasonryProps<T> extends Omit<MasonryProps<T>, 'columns'> {
  minColumnWidth?: number;
  maxColumns?: number;
}

function ResponsiveMasonryInner<T>(
  {
    minColumnWidth = 280,
    maxColumns = 6,
    gap = 16,
    ...props
  }: ResponsiveMasonryProps<T>,
  ref: React.ForwardedRef<HTMLDivElement>
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(1);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const width = entry.contentRect.width;
        const cols = Math.min(maxColumns, Math.max(1, Math.floor((width + gap) / (minColumnWidth + gap))));
        setColumns(cols);
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [minColumnWidth, maxColumns, gap]);

  return (
    <div ref={containerRef}>
      <Masonry ref={ref} columns={columns} gap={gap} {...props} />
    </div>
  );
}

export const ResponsiveMasonry = forwardRef(ResponsiveMasonryInner) as <T>(
  props: ResponsiveMasonryProps<T> & { ref?: React.ForwardedRef<HTMLDivElement> }
) => ReturnType<typeof ResponsiveMasonryInner>;

// ============================================================================
// ImageMasonry Component
// ============================================================================

export interface ImageItem {
  id: string | number;
  src: string;
  alt?: string;
  width: number;
  height: number;
  title?: string;
  description?: string;
}

export interface ImageMasonryProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  images: ImageItem[];
  columns?: number;
  gap?: number;
  breakpoints?: MasonryBreakpoint[];
  onImageClick?: (image: ImageItem, index: number) => void;
  showOverlay?: boolean;
  animate?: boolean;
}

export const ImageMasonry = forwardRef<HTMLDivElement, ImageMasonryProps>(
  (
    {
      images,
      columns,
      gap = 8,
      breakpoints = DEFAULT_BREAKPOINTS,
      onImageClick,
      showOverlay = true,
      animate = true,
      className,
      ...props
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(0);
    const [loadedImages, setLoadedImages] = useState<Set<string | number>>(new Set());

    // Get columns based on width
    const { columns: calculatedColumns, gap: calculatedGap } = useMemo(() => {
      if (columns !== undefined) {
        return { columns, gap };
      }
      if (containerWidth === 0) {
        return { columns: 1, gap };
      }
      return getColumnsForWidth(containerWidth, breakpoints, 3);
    }, [columns, gap, containerWidth, breakpoints]);

    // Calculate column width
    const columnWidth = useMemo(() => {
      if (containerWidth === 0) return 0;
      return (containerWidth - calculatedGap * (calculatedColumns - 1)) / calculatedColumns;
    }, [containerWidth, calculatedGap, calculatedColumns]);

    // Get height for image based on aspect ratio
    const getImageHeight = useCallback(
      (image: ImageItem): number => {
        if (columnWidth === 0) return 200;
        const aspectRatio = image.width / image.height;
        return columnWidth / aspectRatio;
      },
      [columnWidth]
    );

    // Calculate positions
    const { positions, totalHeight } = useMemo(() => {
      if (columnWidth === 0) {
        return { positions: new Map(), totalHeight: 0 };
      }
      return calculateMasonryPositions(
        images,
        calculatedColumns,
        columnWidth,
        calculatedGap,
        getImageHeight
      );
    }, [images, calculatedColumns, columnWidth, calculatedGap, getImageHeight]);

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
        style={{ minHeight: totalHeight }}
        {...props}
      >
        {images.map((image, index) => {
          const position = positions.get(index);
          if (!position) return null;

          const isLoaded = loadedImages.has(image.id);

          return (
            <div
              key={image.id}
              className={clsx(
                'absolute overflow-hidden rounded-lg',
                onImageClick && 'cursor-pointer',
                animate && 'transition-all duration-300 ease-out'
              )}
              style={{
                top: position.top,
                left: position.left,
                width: position.width,
                height: position.height,
              }}
              onClick={() => onImageClick?.(image, index)}
            >
              {/* Skeleton */}
              {!isLoaded && (
                <div className="absolute inset-0 bg-gray-200 animate-pulse" />
              )}

              {/* Image */}
              <img
                src={image.src}
                alt={image.alt || ''}
                className={clsx(
                  'w-full h-full object-cover transition-opacity duration-300',
                  isLoaded ? 'opacity-100' : 'opacity-0'
                )}
                onLoad={() => {
                  setLoadedImages((prev) => new Set(prev).add(image.id));
                }}
              />

              {/* Overlay */}
              {showOverlay && (image.title || image.description) && (
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity duration-200">
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    {image.title && (
                      <h3 className="text-white font-medium text-sm truncate">
                        {image.title}
                      </h3>
                    )}
                    {image.description && (
                      <p className="text-white/80 text-xs mt-1 line-clamp-2">
                        {image.description}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }
);

ImageMasonry.displayName = 'ImageMasonry';

// ============================================================================
// useMasonry Hook
// ============================================================================

export interface UseMasonryOptions<T> {
  items: T[];
  columns: number;
  gap: number;
  getItemHeight: (item: T, index: number) => number;
  containerWidth: number;
}

export interface UseMasonryReturn<T> {
  positions: Map<number, { left: number; top: number; width: number; height: number }>;
  totalHeight: number;
  columnWidth: number;
  columnData: ColumnData[];
}

export function useMasonry<T>(options: UseMasonryOptions<T>): UseMasonryReturn<T> {
  const { items, columns, gap, getItemHeight, containerWidth } = options;

  const columnWidth = useMemo(() => {
    if (containerWidth === 0) return 0;
    return (containerWidth - gap * (columns - 1)) / columns;
  }, [containerWidth, gap, columns]);

  const columnData = useMemo(
    () => distributeItems(items, columns, getItemHeight),
    [items, columns, getItemHeight]
  );

  const { positions, totalHeight } = useMemo(() => {
    if (columnWidth === 0) {
      return { positions: new Map(), totalHeight: 0 };
    }
    return calculateMasonryPositions(items, columns, columnWidth, gap, getItemHeight);
  }, [items, columns, columnWidth, gap, getItemHeight]);

  return useMemo(
    () => ({
      positions,
      totalHeight,
      columnWidth,
      columnData,
    }),
    [positions, totalHeight, columnWidth, columnData]
  );
}

// ============================================================================
// Exports
// ============================================================================

export default Masonry;
