/**
 * VirtualizedDataTable Component
 * 
 * High-performance data table using @tanstack/react-virtual for rendering
 * only visible rows. Supports infinite scroll, keyboard navigation, and
 * optimized cell rendering for large datasets (1000+ rows).
 * 
 * @module components/VirtualizedDataTable
 */

import React, { useRef, useCallback, useMemo, memo, useState, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowUp, ArrowDown, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../lib/utils';

// ============================================================================
// TYPES
// ============================================================================

export interface VirtualColumn<T> {
  /** Unique key for the column */
  key: string;
  /** Column header text */
  header: string;
  /** Width of the column (px, %, or 'auto') */
  width?: string | number;
  /** Minimum width in pixels */
  minWidth?: number;
  /** Maximum width in pixels */
  maxWidth?: number;
  /** Whether column is sortable */
  sortable?: boolean;
  /** Custom cell renderer */
  render?: (item: T, index: number) => React.ReactNode;
  /** Accessor function to get cell value */
  accessor?: (item: T) => React.ReactNode;
  /** Text alignment */
  align?: 'left' | 'center' | 'right';
  /** Whether to truncate text with ellipsis */
  truncate?: boolean;
  /** Custom header renderer */
  headerRender?: () => React.ReactNode;
  /** Sticky column (left or right) */
  sticky?: 'left' | 'right';
  /** Hide on smaller screens */
  hideOnMobile?: boolean;
}

export interface VirtualizedDataTableProps<T> {
  /** Data to display */
  data: T[];
  /** Column definitions */
  columns: VirtualColumn<T>[];
  /** Unique key accessor for each row */
  getRowKey: (item: T, index: number) => string;
  /** Estimated row height in pixels */
  estimatedRowHeight?: number;
  /** Maximum height of the table container */
  maxHeight?: string | number;
  /** Whether data is loading */
  isLoading?: boolean;
  /** Whether more data is being fetched */
  isFetchingMore?: boolean;
  /** Callback when user scrolls near bottom */
  onLoadMore?: () => void;
  /** Threshold for triggering load more (px from bottom) */
  loadMoreThreshold?: number;
  /** Whether there is more data to load */
  hasMore?: boolean;
  /** Current sort column key */
  sortBy?: string;
  /** Current sort direction */
  sortOrder?: 'asc' | 'desc';
  /** Callback when sort changes */
  onSortChange?: (key: string, order: 'asc' | 'desc') => void;
  /** Row click handler */
  onRowClick?: (item: T, index: number) => void;
  /** Selected row keys */
  selectedKeys?: Set<string>;
  /** Row selection handler */
  onSelectionChange?: (keys: Set<string>) => void;
  /** Enable row selection */
  selectable?: boolean;
  /** Enable multi-select */
  multiSelect?: boolean;
  /** Empty state message */
  emptyMessage?: string;
  /** Custom empty state component */
  emptyComponent?: React.ReactNode;
  /** Loading skeleton count */
  skeletonCount?: number;
  /** Enable keyboard navigation */
  enableKeyboardNav?: boolean;
  /** Row hover callback */
  onRowHover?: (item: T | null, index: number) => void;
  /** Custom row className */
  rowClassName?: (item: T, index: number) => string;
  /** Header className */
  headerClassName?: string;
  /** Container className */
  className?: string;
  /** Overscan count (rows to render above/below visible area) */
  overscan?: number;
  /** Enable sticky header */
  stickyHeader?: boolean;
  /** Stripe odd/even rows */
  striped?: boolean;
  /** Compact row padding */
  compact?: boolean;
  /** Show row borders */
  bordered?: boolean;
}

// ============================================================================
// SKELETON ROW
// ============================================================================

const SkeletonRow = memo(function SkeletonRow({ 
  columns, 
  compact 
}: { 
  columns: VirtualColumn<unknown>[]; 
  compact?: boolean;
}) {
  return (
    <div 
      className={cn(
        "flex items-center gap-2 animate-pulse",
        compact ? "py-2 px-3" : "py-3 px-4"
      )}
    >
      {columns.map((col) => (
        <div 
          key={col.key}
          style={{ 
            width: col.width ?? 'auto',
            minWidth: col.minWidth,
            maxWidth: col.maxWidth,
            flex: col.width ? 'none' : 1,
          }}
          className="flex items-center"
        >
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
        </div>
      ))}
    </div>
  );
});

// ============================================================================
// TABLE HEADER
// ============================================================================

interface TableHeaderProps<T> {
  columns: VirtualColumn<T>[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSortChange?: (key: string, order: 'asc' | 'desc') => void;
  selectable?: boolean;
  allSelected?: boolean;
  onSelectAll?: () => void;
  className?: string;
  compact?: boolean;
}

const TableHeader = memo(function TableHeader<T>({
  columns,
  sortBy,
  sortOrder,
  onSortChange,
  selectable,
  allSelected,
  onSelectAll,
  className,
  compact,
}: TableHeaderProps<T>) {
  const handleSort = (key: string) => {
    if (!onSortChange) return;
    const newOrder = sortBy === key && sortOrder === 'asc' ? 'desc' : 'asc';
    onSortChange(key, newOrder);
  };

  return (
    <div 
      className={cn(
        "flex items-center bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700",
        compact ? "py-2 px-3" : "py-3 px-4",
        className
      )}
      role="row"
    >
      {selectable && (
        <div className="w-10 flex-shrink-0">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={onSelectAll}
            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            aria-label="Select all"
          />
        </div>
      )}
      
      {columns.map((col) => {
        const isSorted = sortBy === col.key;
        const SortIcon = isSorted && sortOrder === 'asc' ? ChevronUp : ChevronDown;
        
        return (
          <div
            key={col.key}
            style={{
              width: col.width ?? 'auto',
              minWidth: col.minWidth,
              maxWidth: col.maxWidth,
              flex: col.width ? 'none' : 1,
            }}
            className={cn(
              "flex items-center gap-1",
              col.align === 'center' && 'justify-center',
              col.align === 'right' && 'justify-end',
              col.sortable && 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-1',
              col.hideOnMobile && 'hidden md:flex'
            )}
            role="columnheader"
            aria-sort={isSorted ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
            onClick={col.sortable ? () => handleSort(col.key) : undefined}
          >
            {col.headerRender ? (
              col.headerRender()
            ) : (
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
                {col.header}
              </span>
            )}
            
            {col.sortable && (
              <SortIcon 
                className={cn(
                  "h-4 w-4 transition-colors",
                  isSorted 
                    ? "text-primary-600 dark:text-primary-400" 
                    : "text-gray-400 opacity-0 group-hover:opacity-100"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}) as <T>(props: TableHeaderProps<T>) => React.ReactElement;

// ============================================================================
// TABLE ROW
// ============================================================================

interface TableRowProps<T> {
  item: T;
  index: number;
  columns: VirtualColumn<T>[];
  isSelected?: boolean;
  onSelect?: () => void;
  onClick?: () => void;
  onHover?: (entering: boolean) => void;
  selectable?: boolean;
  className?: string;
  compact?: boolean;
  striped?: boolean;
  bordered?: boolean;
  style?: React.CSSProperties;
}

const TableRow = memo(function TableRow<T>({
  item,
  index,
  columns,
  isSelected,
  onSelect,
  onClick,
  onHover,
  selectable,
  className,
  compact,
  striped,
  bordered,
  style,
}: TableRowProps<T>) {
  return (
    <div
      style={style}
      className={cn(
        "flex items-center transition-colors",
        compact ? "py-2 px-3" : "py-3 px-4",
        striped && index % 2 === 1 && "bg-gray-50/50 dark:bg-gray-800/50",
        bordered && "border-b border-gray-100 dark:border-gray-800",
        onClick && "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800",
        isSelected && "bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100",
        className
      )}
      role="row"
      aria-selected={isSelected}
      onClick={onClick}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
    >
      {selectable && (
        <div className="w-10 flex-shrink-0">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onSelect}
            onClick={(e) => e.stopPropagation()}
            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            aria-label={`Select row ${index + 1}`}
          />
        </div>
      )}
      
      {columns.map((col) => {
        let content: React.ReactNode;
        
        if (col.render) {
          content = col.render(item, index);
        } else if (col.accessor) {
          content = col.accessor(item);
        } else {
          content = String((item as Record<string, unknown>)[col.key] ?? '');
        }
        
        return (
          <div
            key={col.key}
            style={{
              width: col.width ?? 'auto',
              minWidth: col.minWidth,
              maxWidth: col.maxWidth,
              flex: col.width ? 'none' : 1,
            }}
            className={cn(
              "flex items-center",
              col.align === 'center' && 'justify-center',
              col.align === 'right' && 'justify-end',
              col.truncate && 'overflow-hidden',
              col.hideOnMobile && 'hidden md:flex'
            )}
            role="cell"
          >
            {col.truncate ? (
              <span className="truncate">{content}</span>
            ) : (
              content
            )}
          </div>
        );
      })}
    </div>
  );
}) as <T>(props: TableRowProps<T>) => React.ReactElement;

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function VirtualizedDataTable<T>({
  data,
  columns,
  getRowKey,
  estimatedRowHeight = 48,
  maxHeight = 600,
  isLoading = false,
  isFetchingMore = false,
  onLoadMore,
  loadMoreThreshold = 200,
  hasMore = false,
  sortBy,
  sortOrder,
  onSortChange,
  onRowClick,
  selectedKeys,
  onSelectionChange,
  selectable = false,
  multiSelect = false,
  emptyMessage = 'No data to display',
  emptyComponent,
  skeletonCount = 10,
  enableKeyboardNav = true,
  onRowHover,
  rowClassName,
  headerClassName,
  className,
  overscan = 5,
  stickyHeader = true,
  striped = false,
  compact = false,
  bordered = true,
}: VirtualizedDataTableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // Calculate if all items are selected
  const allSelected = useMemo(() => {
    if (!selectedKeys || data.length === 0) return false;
    return data.every((item, i) => selectedKeys.has(getRowKey(item, i)));
  }, [selectedKeys, data, getRowKey]);

  // Virtual row virtualizer
  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimatedRowHeight,
    overscan,
  });

  const virtualRows = virtualizer.getVirtualItems();

  // Handle infinite scroll
  const handleScroll = useCallback(() => {
    if (!onLoadMore || !hasMore || isFetchingMore) return;
    
    const container = parentRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    if (distanceFromBottom < loadMoreThreshold) {
      onLoadMore();
    }
  }, [onLoadMore, hasMore, isFetchingMore, loadMoreThreshold]);

  // Attach scroll listener
  useEffect(() => {
    const container = parentRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!enableKeyboardNav || data.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex((prev) => Math.min(prev + 1, data.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case 'Enter':
      case ' ':
        if (focusedIndex >= 0 && focusedIndex < data.length) {
          e.preventDefault();
          if (selectable && onSelectionChange) {
            handleRowSelect(focusedIndex);
          } else if (onRowClick) {
            onRowClick(data[focusedIndex], focusedIndex);
          }
        }
        break;
      case 'Home':
        e.preventDefault();
        setFocusedIndex(0);
        virtualizer.scrollToIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setFocusedIndex(data.length - 1);
        virtualizer.scrollToIndex(data.length - 1);
        break;
    }
  }, [enableKeyboardNav, data, focusedIndex, selectable, onSelectionChange, onRowClick, virtualizer]);

  // Scroll focused row into view
  useEffect(() => {
    if (focusedIndex >= 0) {
      virtualizer.scrollToIndex(focusedIndex, { align: 'auto' });
    }
  }, [focusedIndex, virtualizer]);

  // Row selection handler
  const handleRowSelect = useCallback((index: number) => {
    if (!onSelectionChange) return;
    
    const key = getRowKey(data[index], index);
    const newKeys = new Set(selectedKeys);
    
    if (multiSelect) {
      if (newKeys.has(key)) {
        newKeys.delete(key);
      } else {
        newKeys.add(key);
      }
    } else {
      if (newKeys.has(key)) {
        newKeys.clear();
      } else {
        newKeys.clear();
        newKeys.add(key);
      }
    }
    
    onSelectionChange(newKeys);
  }, [data, getRowKey, selectedKeys, multiSelect, onSelectionChange]);

  // Select all handler
  const handleSelectAll = useCallback(() => {
    if (!onSelectionChange) return;
    
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      const allKeys = new Set(data.map((item, i) => getRowKey(item, i)));
      onSelectionChange(allKeys);
    }
  }, [data, getRowKey, allSelected, onSelectionChange]);

  // Loading state
  if (isLoading) {
    return (
      <div className={cn("border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden", className)}>
        <TableHeader
          columns={columns as VirtualColumn<unknown>[]}
          selectable={selectable}
          compact={compact}
          className={headerClassName}
        />
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <SkeletonRow key={i} columns={columns as VirtualColumn<unknown>[]} compact={compact} />
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (data.length === 0) {
    return (
      <div className={cn("border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden", className)}>
        <TableHeader
          columns={columns as VirtualColumn<unknown>[]}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={onSortChange}
          selectable={selectable}
          compact={compact}
          className={headerClassName}
        />
        <div className="flex items-center justify-center py-12">
          {emptyComponent || (
            <p className="text-gray-500 dark:text-gray-400">{emptyMessage}</p>
          )}
        </div>
      </div>
    );
  }

  const totalHeight = virtualizer.getTotalSize();

  return (
    <div 
      className={cn(
        "border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden",
        className
      )}
    >
      {/* Sticky Header */}
      {stickyHeader && (
        <TableHeader
          columns={columns}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={onSortChange}
          selectable={selectable}
          allSelected={allSelected}
          onSelectAll={handleSelectAll}
          compact={compact}
          className={headerClassName}
        />
      )}

      {/* Virtualized Rows */}
      <div
        ref={parentRef}
        style={{ 
          maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight,
          overflowY: 'auto',
        }}
        className="relative"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        role="grid"
        aria-rowcount={data.length}
      >
        <div
          style={{
            height: `${totalHeight}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualRows.map((virtualRow) => {
            const item = data[virtualRow.index];
            const key = getRowKey(item, virtualRow.index);
            const isSelected = selectedKeys?.has(key);
            const isFocused = focusedIndex === virtualRow.index;

            return (
              <TableRow
                key={key}
                item={item}
                index={virtualRow.index}
                columns={columns}
                isSelected={isSelected}
                onSelect={() => handleRowSelect(virtualRow.index)}
                onClick={onRowClick ? () => onRowClick(item, virtualRow.index) : undefined}
                onHover={(entering) => onRowHover?.(entering ? item : null, virtualRow.index)}
                selectable={selectable}
                className={cn(
                  rowClassName?.(item, virtualRow.index),
                  isFocused && "ring-2 ring-inset ring-primary-500"
                )}
                compact={compact}
                striped={striped}
                bordered={bordered}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              />
            );
          })}
        </div>

        {/* Loading more indicator */}
        {isFetchingMore && (
          <div className="flex items-center justify-center py-4 bg-gray-50 dark:bg-gray-800">
            <Loader2 className="h-5 w-5 animate-spin text-primary-600" />
            <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
              Loading more...
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// HOOK: useInfiniteVirtualTable
// ============================================================================

export interface UseInfiniteVirtualTableOptions<T> {
  fetchData: (cursor?: string) => Promise<{
    items: T[];
    nextCursor?: string;
    hasMore: boolean;
  }>;
  getRowKey: (item: T) => string;
}

export function useInfiniteVirtualTable<T>({
  fetchData,
  getRowKey,
}: UseInfiniteVirtualTableOptions<T>) {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const cursorRef = useRef<string | undefined>();

  const loadInitial = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchData();
      setData(result.items);
      cursorRef.current = result.nextCursor;
      setHasMore(result.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load data'));
    } finally {
      setIsLoading(false);
    }
  }, [fetchData]);

  const loadMore = useCallback(async () => {
    if (!hasMore || isFetchingMore) return;
    
    setIsFetchingMore(true);
    try {
      const result = await fetchData(cursorRef.current);
      setData((prev) => {
        // Dedupe by key
        const existingKeys = new Set(prev.map(getRowKey));
        const newItems = result.items.filter((item) => !existingKeys.has(getRowKey(item)));
        return [...prev, ...newItems];
      });
      cursorRef.current = result.nextCursor;
      setHasMore(result.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load more'));
    } finally {
      setIsFetchingMore(false);
    }
  }, [fetchData, getRowKey, hasMore, isFetchingMore]);

  const refresh = useCallback(() => {
    cursorRef.current = undefined;
    loadInitial();
  }, [loadInitial]);

  // Load initial data on mount
  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  return {
    data,
    isLoading,
    isFetchingMore,
    hasMore,
    error,
    loadMore,
    refresh,
  };
}

export default VirtualizedDataTable;
