/**
 * DataGrid.tsx - CRITICAL-33
 * 
 * Advanced data grid component for the ERP application.
 * Extends DataTable with editing, grouping, and advanced features.
 * 
 * Features:
 * - 33.1: Inline cell editing
 * - 33.2: Row grouping and aggregation
 * - 33.3: Column pinning (freeze)
 * - 33.4: Row selection with checkbox
 * - 33.5: Virtual scrolling for large datasets
 * 
 * @module DataGrid
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  type ReactNode,
  type KeyboardEvent,
  type CSSProperties,
} from 'react';
import { clsx } from 'clsx';
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ArrowUp,
  ArrowDown,
  Check,
  X,
  Edit2,
  Pin,
  Filter,
  Search,
  Columns,
} from 'lucide-react';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/** Column definition */
export interface GridColumn<T = unknown> {
  /** Unique key */
  key: string;
  /** Column header */
  header: string;
  /** Width (px or percentage) */
  width?: number | string;
  /** Min width */
  minWidth?: number;
  /** Max width */
  maxWidth?: number;
  /** Is sortable */
  sortable?: boolean;
  /** Is filterable */
  filterable?: boolean;
  /** Is resizable */
  resizable?: boolean;
  /** Is editable */
  editable?: boolean;
  /** Is pinned (left/right) */
  pinned?: 'left' | 'right' | false;
  /** Cell renderer */
  render?: (value: unknown, row: T, rowIndex: number) => ReactNode;
  /** Cell editor */
  editor?: (props: CellEditorProps<T>) => ReactNode;
  /** Value accessor */
  accessor?: (row: T) => unknown;
  /** Aggregate function for grouping */
  aggregate?: 'sum' | 'avg' | 'count' | 'min' | 'max' | ((values: unknown[]) => unknown);
  /** Cell class name */
  className?: string;
  /** Header class name */
  headerClassName?: string;
  /** Align */
  align?: 'left' | 'center' | 'right';
}

/** Cell editor props */
export interface CellEditorProps<T = unknown> {
  value: unknown;
  row: T;
  rowIndex: number;
  column: GridColumn<T>;
  onSave: (value: unknown) => void;
  onCancel: () => void;
}

/** Sort state */
export interface GridSortState {
  key: string;
  direction: 'asc' | 'desc';
}

/** Filter state */
export interface GridFilterState {
  key: string;
  value: string;
  operator?: 'contains' | 'equals' | 'startsWith' | 'endsWith' | 'gt' | 'lt' | 'gte' | 'lte';
}

/** Row group */
export interface GridRowGroup<T = unknown> {
  key: string;
  value: unknown;
  rows: T[];
  aggregates: Record<string, unknown>;
}

/** Grid context */
export interface GridContextValue<T = unknown> {
  /** Columns */
  columns: GridColumn<T>[];
  /** Data */
  data: T[];
  /** Selected row keys */
  selectedKeys: Set<string>;
  /** Editing cell */
  editingCell: { rowIndex: number; columnKey: string } | null;
  /** Sort state */
  sortState: GridSortState | null;
  /** Filter states */
  filterStates: GridFilterState[];
  /** Expanded groups */
  expandedGroups: Set<string>;
  /** Row height */
  rowHeight: number;
  /** Get row key */
  getRowKey: (row: T, index: number) => string;
  /** Toggle row selection */
  toggleRowSelection: (key: string) => void;
  /** Select all */
  selectAll: () => void;
  /** Clear selection */
  clearSelection: () => void;
  /** Set editing cell */
  setEditingCell: (cell: { rowIndex: number; columnKey: string } | null) => void;
  /** Handle cell edit */
  handleCellEdit: (rowIndex: number, columnKey: string, value: unknown) => void;
  /** Toggle sort */
  toggleSort: (columnKey: string) => void;
  /** Set filter */
  setFilter: (key: string, value: string) => void;
  /** Toggle group expansion */
  toggleGroupExpansion: (groupKey: string) => void;
}

/** Data grid props */
export interface DataGridProps<T = unknown> {
  /** Column definitions */
  columns: GridColumn<T>[];
  /** Row data */
  data: T[];
  /** Row key accessor */
  rowKey?: string | ((row: T, index: number) => string);
  /** Enable row selection */
  selectable?: boolean;
  /** Selection mode */
  selectionMode?: 'single' | 'multiple';
  /** Selected keys (controlled) */
  selectedKeys?: string[];
  /** On selection change */
  onSelectionChange?: (keys: string[], rows: T[]) => void;
  /** Enable sorting */
  sortable?: boolean;
  /** Default sort */
  defaultSort?: GridSortState;
  /** Controlled sort */
  sortState?: GridSortState;
  /** On sort change */
  onSortChange?: (sort: GridSortState | null) => void;
  /** Enable filtering */
  filterable?: boolean;
  /** Enable inline editing */
  editable?: boolean;
  /** On cell edit */
  onCellEdit?: (rowIndex: number, columnKey: string, value: unknown, row: T) => void;
  /** Group by column key */
  groupBy?: string;
  /** Default expanded groups */
  defaultExpandedGroups?: string[];
  /** Row height */
  rowHeight?: number;
  /** Header height */
  headerHeight?: number;
  /** Enable virtual scrolling */
  virtualized?: boolean;
  /** Visible rows (for virtual) */
  visibleRows?: number;
  /** Fixed height */
  height?: number | string;
  /** Empty state content */
  emptyContent?: ReactNode;
  /** Loading state */
  loading?: boolean;
  /** On row click */
  onRowClick?: (row: T, index: number) => void;
  /** On row double click */
  onRowDoubleClick?: (row: T, index: number) => void;
  /** Stripe rows */
  striped?: boolean;
  /** Highlight on hover */
  hoverable?: boolean;
  /** Show borders */
  bordered?: boolean;
  /** Compact mode */
  compact?: boolean;
  /** Class name */
  className?: string;
  /** Table class */
  tableClassName?: string;
}

// ============================================================================
// CONTEXT
// ============================================================================

const GridContext = createContext<GridContextValue | null>(null);

function useGridContext<T = unknown>(): GridContextValue<T> {
  const context = useContext(GridContext);
  if (!context) {
    throw new Error('useGridContext must be used within a DataGrid');
  }
  return context as GridContextValue<T>;
}

/** Hook to access grid context */
export function useDataGrid<T = unknown>(): GridContextValue<T> {
  return useGridContext<T>();
}

// ============================================================================
// UTILITIES
// ============================================================================

/** Default cell editors */
export const CellEditors = {
  text: function TextEditor<T>({ value, onSave, onCancel }: CellEditorProps<T>) {
    const [inputValue, setInputValue] = useState(String(value ?? ''));
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, []);

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        onSave(inputValue);
      } else if (e.key === 'Escape') {
        onCancel();
      }
    };

    return (
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => onSave(inputValue)}
          className="w-full px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none"
        />
      </div>
    );
  },

  number: function NumberEditor<T>({ value, onSave, onCancel }: CellEditorProps<T>) {
    const [inputValue, setInputValue] = useState(String(value ?? 0));
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, []);

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        onSave(parseFloat(inputValue) || 0);
      } else if (e.key === 'Escape') {
        onCancel();
      }
    };

    return (
      <input
        ref={inputRef}
        type="number"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => onSave(parseFloat(inputValue) || 0)}
        className="w-full px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none"
      />
    );
  },

  select: function SelectEditor<T>({
    value,
    onSave,
    onCancel,
    column,
  }: CellEditorProps<T> & { options?: { value: unknown; label: string }[] }) {
    const options = (column as GridColumn<T> & { options?: { value: unknown; label: string }[] }).options || [];

    return (
      <select
        value={String(value)}
        onChange={(e) => onSave(e.target.value)}
        onBlur={() => onCancel()}
        className="w-full px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none"
        autoFocus
      >
        {options.map((opt) => (
          <option key={String(opt.value)} value={String(opt.value)}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  },
};

/** Calculate aggregates */
function calculateAggregate(
  values: unknown[],
  aggregate: GridColumn['aggregate']
): unknown {
  if (!aggregate || values.length === 0) return null;

  if (typeof aggregate === 'function') {
    return aggregate(values);
  }

  const numbers = values.filter((v): v is number => typeof v === 'number');

  switch (aggregate) {
    case 'sum':
      return numbers.reduce((a, b) => a + b, 0);
    case 'avg':
      return numbers.length > 0 ? numbers.reduce((a, b) => a + b, 0) / numbers.length : 0;
    case 'count':
      return values.length;
    case 'min':
      return Math.min(...numbers);
    case 'max':
      return Math.max(...numbers);
    default:
      return null;
  }
}

/** Group data by column */
function groupData<T>(
  data: T[],
  groupBy: string,
  columns: GridColumn<T>[]
): GridRowGroup<T>[] {
  const groups = new Map<string, T[]>();

  data.forEach((row) => {
    const column = columns.find((c) => c.key === groupBy);
    const value = column?.accessor ? column.accessor(row) : (row as Record<string, unknown>)[groupBy];
    const key = String(value ?? 'undefined');

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(row);
  });

  return Array.from(groups.entries()).map(([key, rows]) => {
    const aggregates: Record<string, unknown> = {};

    columns.forEach((col) => {
      if (col.aggregate) {
        const values = rows.map((row) => 
          col.accessor ? col.accessor(row) : (row as Record<string, unknown>)[col.key]
        );
        aggregates[col.key] = calculateAggregate(values, col.aggregate);
      }
    });

    return {
      key,
      value: rows[0] ? (columns.find((c) => c.key === groupBy)?.accessor
        ? columns.find((c) => c.key === groupBy)!.accessor!(rows[0])
        : (rows[0] as Record<string, unknown>)[groupBy]) : key,
      rows,
      aggregates,
    };
  });
}

// ============================================================================
// 33.1-33.5: DATA GRID COMPONENT
// ============================================================================

/**
 * Advanced data grid with editing, grouping, and more
 * 
 * @example
 * ```tsx
 * const columns = [
 *   { key: 'name', header: 'Name', editable: true },
 *   { key: 'quantity', header: 'Qty', editable: true, editor: CellEditors.number },
 *   { key: 'price', header: 'Price', aggregate: 'sum' },
 * ];
 * 
 * <DataGrid
 *   columns={columns}
 *   data={items}
 *   selectable
 *   editable
 *   groupBy="category"
 * />
 * ```
 */
export function DataGrid<T = unknown>({
  columns,
  data,
  rowKey = 'id',
  selectable = false,
  selectionMode = 'multiple',
  selectedKeys: controlledSelectedKeys,
  onSelectionChange,
  sortable = true,
  defaultSort,
  sortState: controlledSortState,
  onSortChange,
  filterable = false,
  editable = false,
  onCellEdit,
  groupBy,
  defaultExpandedGroups = [],
  rowHeight = 40,
  headerHeight = 44,
  virtualized = false,
  visibleRows = 20,
  height,
  emptyContent,
  loading = false,
  onRowClick,
  onRowDoubleClick,
  striped = true,
  hoverable = true,
  bordered = false,
  compact = false,
  className,
  tableClassName,
}: DataGridProps<T>) {
  // State
  const [internalSelectedKeys, setInternalSelectedKeys] = useState<Set<string>>(new Set());
  const [internalSortState, setInternalSortState] = useState<GridSortState | null>(defaultSort || null);
  const [filterStates, setFilterStates] = useState<GridFilterState[]>([]);
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; columnKey: string } | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(defaultExpandedGroups));
  const [scrollTop, setScrollTop] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);

  // Use controlled or internal state
  const selectedKeys = controlledSelectedKeys
    ? new Set(controlledSelectedKeys)
    : internalSelectedKeys;
  const sortState = controlledSortState !== undefined ? controlledSortState : internalSortState;

  // Get row key function
  const getRowKey = useCallback((row: T, index: number): string => {
    if (typeof rowKey === 'function') {
      return rowKey(row, index);
    }
    return String((row as Record<string, unknown>)[rowKey] ?? index);
  }, [rowKey]);

  // Toggle row selection
  const toggleRowSelection = useCallback((key: string) => {
    let newKeys: Set<string>;

    if (selectionMode === 'single') {
      newKeys = selectedKeys.has(key) ? new Set() : new Set([key]);
    } else {
      newKeys = new Set(selectedKeys);
      if (newKeys.has(key)) {
        newKeys.delete(key);
      } else {
        newKeys.add(key);
      }
    }

    if (!controlledSelectedKeys) {
      setInternalSelectedKeys(newKeys);
    }

    const selectedRows = data.filter((row, i) => newKeys.has(getRowKey(row, i)));
    onSelectionChange?.(Array.from(newKeys), selectedRows);
  }, [selectedKeys, selectionMode, controlledSelectedKeys, data, getRowKey, onSelectionChange]);

  // Select all
  const selectAll = useCallback(() => {
    const allKeys = new Set(data.map((row, i) => getRowKey(row, i)));

    if (!controlledSelectedKeys) {
      setInternalSelectedKeys(allKeys);
    }
    onSelectionChange?.(Array.from(allKeys), data);
  }, [data, getRowKey, controlledSelectedKeys, onSelectionChange]);

  // Clear selection
  const clearSelection = useCallback(() => {
    if (!controlledSelectedKeys) {
      setInternalSelectedKeys(new Set());
    }
    onSelectionChange?.([], []);
  }, [controlledSelectedKeys, onSelectionChange]);

  // Toggle sort
  const toggleSort = useCallback((columnKey: string) => {
    const column = columns.find((c) => c.key === columnKey);
    if (!column?.sortable && !sortable) return;

    let newSort: GridSortState | null;

    if (!sortState || sortState.key !== columnKey) {
      newSort = { key: columnKey, direction: 'asc' };
    } else if (sortState.direction === 'asc') {
      newSort = { key: columnKey, direction: 'desc' };
    } else {
      newSort = null;
    }

    if (controlledSortState === undefined) {
      setInternalSortState(newSort);
    }
    onSortChange?.(newSort);
  }, [columns, sortable, sortState, controlledSortState, onSortChange]);

  // Set filter
  const setFilter = useCallback((key: string, value: string) => {
    setFilterStates((prev) => {
      const existing = prev.findIndex((f) => f.key === key);
      if (!value) {
        return prev.filter((f) => f.key !== key);
      }
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing], value };
        return updated;
      }
      return [...prev, { key, value, operator: 'contains' }];
    });
  }, []);

  // Handle cell edit
  const handleCellEdit = useCallback((rowIndex: number, columnKey: string, value: unknown) => {
    const row = processedData[rowIndex];
    if (row) {
      onCellEdit?.(rowIndex, columnKey, value, row);
    }
    setEditingCell(null);
  }, [onCellEdit]);

  // Toggle group expansion
  const toggleGroupExpansion = useCallback((groupKey: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  }, []);

  // Process data (filter, sort)
  const processedData = useMemo(() => {
    let result = [...data];

    // Apply filters
    filterStates.forEach((filter) => {
      const column = columns.find((c) => c.key === filter.key);
      result = result.filter((row) => {
        const value = column?.accessor
          ? column.accessor(row)
          : (row as Record<string, unknown>)[filter.key];
        const strValue = String(value ?? '').toLowerCase();
        const filterValue = filter.value.toLowerCase();

        switch (filter.operator) {
          case 'equals':
            return strValue === filterValue;
          case 'startsWith':
            return strValue.startsWith(filterValue);
          case 'endsWith':
            return strValue.endsWith(filterValue);
          case 'contains':
          default:
            return strValue.includes(filterValue);
        }
      });
    });

    // Apply sort
    if (sortState) {
      const column = columns.find((c) => c.key === sortState.key);
      result.sort((a, b) => {
        const aVal = column?.accessor
          ? column.accessor(a)
          : (a as Record<string, unknown>)[sortState.key];
        const bVal = column?.accessor
          ? column.accessor(b)
          : (b as Record<string, unknown>)[sortState.key];

        let comparison = 0;
        if (aVal == null && bVal == null) comparison = 0;
        else if (aVal == null) comparison = 1;
        else if (bVal == null) comparison = -1;
        else if (aVal < bVal) comparison = -1;
        else if (aVal > bVal) comparison = 1;

        return sortState.direction === 'desc' ? -comparison : comparison;
      });
    }

    return result;
  }, [data, columns, filterStates, sortState]);

  // Group data if groupBy is set
  const groupedData = useMemo(() => {
    if (!groupBy) return null;
    return groupData(processedData, groupBy, columns);
  }, [processedData, groupBy, columns]);

  // Virtual scrolling calculations
  const virtualScrollInfo = useMemo(() => {
    if (!virtualized) return null;

    const totalRows = groupedData
      ? groupedData.reduce((acc, g) => acc + (expandedGroups.has(g.key) ? g.rows.length + 1 : 1), 0)
      : processedData.length;
    const totalHeight = totalRows * rowHeight;
    const startIndex = Math.floor(scrollTop / rowHeight);
    const endIndex = Math.min(startIndex + visibleRows + 2, totalRows);

    return { totalHeight, startIndex, endIndex };
  }, [virtualized, groupedData, processedData.length, rowHeight, scrollTop, visibleRows, expandedGroups]);

  // Pinned columns
  const { leftPinned, rightPinned, unpinned } = useMemo(() => {
    const left = columns.filter((c) => c.pinned === 'left');
    const right = columns.filter((c) => c.pinned === 'right');
    const center = columns.filter((c) => !c.pinned);
    return { leftPinned: left, rightPinned: right, unpinned: center };
  }, [columns]);

  // Context value
  const contextValue = useMemo<GridContextValue<T>>(() => ({
    columns,
    data: processedData,
    selectedKeys,
    editingCell,
    sortState,
    filterStates,
    expandedGroups,
    rowHeight,
    getRowKey,
    toggleRowSelection,
    selectAll,
    clearSelection,
    setEditingCell,
    handleCellEdit,
    toggleSort,
    setFilter,
    toggleGroupExpansion,
  }), [
    columns,
    processedData,
    selectedKeys,
    editingCell,
    sortState,
    filterStates,
    expandedGroups,
    rowHeight,
    getRowKey,
    toggleRowSelection,
    selectAll,
    clearSelection,
    handleCellEdit,
    toggleSort,
    setFilter,
    toggleGroupExpansion,
  ]);

  // Handle scroll for virtual scrolling
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (virtualized) {
      setScrollTop(e.currentTarget.scrollTop);
    }
  }, [virtualized]);

  // All columns in order
  const allColumns = [...leftPinned, ...unpinned, ...rightPinned];

  // Check if all selected
  const allSelected = processedData.length > 0 && processedData.every((row, i) => selectedKeys.has(getRowKey(row, i)));
  const someSelected = processedData.some((row, i) => selectedKeys.has(getRowKey(row, i)));

  return (
    <GridContext.Provider value={contextValue as GridContextValue}>
      <div
        ref={containerRef}
        className={clsx(
          'relative overflow-auto bg-white dark:bg-gray-900',
          'border border-gray-200 dark:border-gray-700 rounded-lg',
          className
        )}
        style={{ height: height || (virtualized ? visibleRows * rowHeight + headerHeight : undefined) }}
        onScroll={handleScroll}
      >
        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/70 dark:bg-gray-900/70">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        <table className={clsx('w-full border-collapse', tableClassName)}>
          {/* Header */}
          <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800">
            <tr style={{ height: headerHeight }}>
              {/* Selection checkbox */}
              {selectable && (
                <th className="w-10 px-2 border-b border-gray-200 dark:border-gray-700">
                  {selectionMode === 'multiple' && (
                    <button
                      type="button"
                      onClick={() => allSelected ? clearSelection() : selectAll()}
                      className={clsx(
                        'w-4 h-4 border rounded flex items-center justify-center',
                        allSelected || someSelected
                          ? 'bg-blue-500 border-blue-500 text-white'
                          : 'border-gray-300 dark:border-gray-600'
                      )}
                    >
                      {allSelected && <Check className="w-3 h-3" />}
                      {someSelected && !allSelected && <div className="w-2 h-0.5 bg-white" />}
                    </button>
                  )}
                </th>
              )}

              {/* Column headers */}
              {allColumns.map((column) => (
                <th
                  key={column.key}
                  className={clsx(
                    'px-3 text-left text-sm font-medium text-gray-600 dark:text-gray-300',
                    'border-b border-gray-200 dark:border-gray-700',
                    column.sortable !== false && sortable && 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700',
                    column.headerClassName
                  )}
                  style={{
                    width: column.width,
                    minWidth: column.minWidth,
                    maxWidth: column.maxWidth,
                    textAlign: column.align,
                  }}
                  onClick={() => column.sortable !== false && toggleSort(column.key)}
                >
                  <div className="flex items-center gap-1">
                    <span className="truncate">{column.header}</span>
                    {sortState?.key === column.key && (
                      sortState.direction === 'asc'
                        ? <ArrowUp className="w-3 h-3" />
                        : <ArrowDown className="w-3 h-3" />
                    )}
                    {column.pinned && (
                      <Pin className="w-3 h-3 text-gray-400" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          {/* Body */}
          <tbody>
            {virtualized && virtualScrollInfo && (
              <tr style={{ height: virtualScrollInfo.startIndex * rowHeight }}>
                <td colSpan={allColumns.length + (selectable ? 1 : 0)} />
              </tr>
            )}

            {groupedData ? (
              // Grouped rows
              groupedData.map((group) => (
                <React.Fragment key={group.key}>
                  {/* Group header row */}
                  <tr
                    className="bg-gray-100 dark:bg-gray-800 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700"
                    onClick={() => toggleGroupExpansion(group.key)}
                    style={{ height: rowHeight }}
                  >
                    <td
                      colSpan={allColumns.length + (selectable ? 1 : 0)}
                      className="px-3 font-medium"
                    >
                      <div className="flex items-center gap-2">
                        {expandedGroups.has(group.key) ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                        <span>{String(group.value)}</span>
                        <span className="text-gray-500">({group.rows.length})</span>
                        {/* Aggregates */}
                        {Object.entries(group.aggregates).map(([key, value]) => (
                          <span key={key} className="text-gray-500 text-sm">
                            {columns.find((c) => c.key === key)?.header}: {String(value)}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>

                  {/* Group rows */}
                  {expandedGroups.has(group.key) && group.rows.map((row, rowIndex) => (
                    <GridRow
                      key={getRowKey(row, rowIndex)}
                      row={row}
                      rowIndex={rowIndex}
                      columns={allColumns}
                      selectable={selectable}
                      editable={editable}
                      striped={striped}
                      hoverable={hoverable}
                      compact={compact}
                      onClick={onRowClick}
                      onDoubleClick={onRowDoubleClick}
                    />
                  ))}
                </React.Fragment>
              ))
            ) : processedData.length === 0 ? (
              // Empty state
              <tr>
                <td
                  colSpan={allColumns.length + (selectable ? 1 : 0)}
                  className="py-8 text-center text-gray-500"
                >
                  {emptyContent || 'No data'}
                </td>
              </tr>
            ) : (
              // Regular rows
              processedData.map((row, rowIndex) => (
                <GridRow
                  key={getRowKey(row, rowIndex)}
                  row={row}
                  rowIndex={rowIndex}
                  columns={allColumns}
                  selectable={selectable}
                  editable={editable}
                  striped={striped}
                  hoverable={hoverable}
                  compact={compact}
                  onClick={onRowClick}
                  onDoubleClick={onRowDoubleClick}
                />
              ))
            )}

            {virtualized && virtualScrollInfo && (
              <tr style={{ height: virtualScrollInfo.totalHeight - virtualScrollInfo.endIndex * rowHeight }}>
                <td colSpan={allColumns.length + (selectable ? 1 : 0)} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </GridContext.Provider>
  );
}

// ============================================================================
// GRID ROW COMPONENT
// ============================================================================

interface GridRowProps<T> {
  row: T;
  rowIndex: number;
  columns: GridColumn<T>[];
  selectable: boolean;
  editable: boolean;
  striped: boolean;
  hoverable: boolean;
  compact: boolean;
  onClick?: (row: T, index: number) => void;
  onDoubleClick?: (row: T, index: number) => void;
}

function GridRow<T>({
  row,
  rowIndex,
  columns,
  selectable,
  editable,
  striped,
  hoverable,
  compact,
  onClick,
  onDoubleClick,
}: GridRowProps<T>) {
  const {
    selectedKeys,
    editingCell,
    rowHeight,
    getRowKey,
    toggleRowSelection,
    setEditingCell,
    handleCellEdit,
  } = useGridContext<T>();

  const rowKey = getRowKey(row, rowIndex);
  const isSelected = selectedKeys.has(rowKey);

  return (
    <tr
      className={clsx(
        'transition-colors',
        isSelected && 'bg-blue-50 dark:bg-blue-900/30',
        striped && rowIndex % 2 === 1 && !isSelected && 'bg-gray-50/50 dark:bg-gray-800/50',
        hoverable && 'hover:bg-gray-100 dark:hover:bg-gray-800',
        onClick && 'cursor-pointer'
      )}
      style={{ height: rowHeight }}
      onClick={() => onClick?.(row, rowIndex)}
      onDoubleClick={() => onDoubleClick?.(row, rowIndex)}
    >
      {/* Selection checkbox */}
      {selectable && (
        <td className="w-10 px-2 border-b border-gray-100 dark:border-gray-800">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleRowSelection(rowKey);
            }}
            className={clsx(
              'w-4 h-4 border rounded flex items-center justify-center',
              isSelected
                ? 'bg-blue-500 border-blue-500 text-white'
                : 'border-gray-300 dark:border-gray-600'
            )}
          >
            {isSelected && <Check className="w-3 h-3" />}
          </button>
        </td>
      )}

      {/* Data cells */}
      {columns.map((column) => {
        const value = column.accessor
          ? column.accessor(row)
          : (row as Record<string, unknown>)[column.key];
        const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.columnKey === column.key;

        return (
          <td
            key={column.key}
            className={clsx(
              'border-b border-gray-100 dark:border-gray-800',
              compact ? 'px-2 py-1' : 'px-3 py-2',
              column.className
            )}
            style={{ textAlign: column.align }}
            onDoubleClick={(e) => {
              if (editable && column.editable) {
                e.stopPropagation();
                setEditingCell({ rowIndex, columnKey: column.key });
              }
            }}
          >
            {isEditing ? (
              // Editor
              column.editor ? (
                column.editor({
                  value,
                  row,
                  rowIndex,
                  column,
                  onSave: (newValue) => handleCellEdit(rowIndex, column.key, newValue),
                  onCancel: () => setEditingCell(null),
                })
              ) : (
                <CellEditors.text
                  value={value}
                  row={row}
                  rowIndex={rowIndex}
                  column={column}
                  onSave={(newValue) => handleCellEdit(rowIndex, column.key, newValue)}
                  onCancel={() => setEditingCell(null)}
                />
              )
            ) : column.render ? (
              // Custom renderer
              column.render(value, row, rowIndex)
            ) : (
              // Default display
              <span className="text-sm text-gray-700 dark:text-gray-200 truncate block">
                {value == null ? '' : String(value)}
              </span>
            )}
          </td>
        );
      })}
    </tr>
  );
}

// ============================================================================
// EXPORTS - Types are exported inline at their definitions
// ============================================================================
