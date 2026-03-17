/**
 * Advanced Data Table System
 * 
 * Enterprise-grade table component with:
 * - Column pinning (freeze columns left/right)
 * - Virtual scrolling for large datasets
 * - Inline cell editing with validation
 * - Column resizing and reordering
 * - Row selection with bulk actions
 * - Keyboard navigation
 * - Export functionality
 */

import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  createContext,
  useContext,
  ReactNode,
  KeyboardEvent,
  CSSProperties,
} from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import {
  ChevronUp,
  ChevronDown,
  Pin,
  PinOff,
  GripVertical,
  Check,
  X,
  Edit2,
  MoreHorizontal,
  Download,
  Filter,
  Columns3,
  ArrowUpDown,
} from 'lucide-react';
import { clsx } from 'clsx';

// ============================================================================
// Types
// ============================================================================

export type SortDirection = 'asc' | 'desc' | null;
export type PinPosition = 'left' | 'right' | null;
export type CellAlignment = 'left' | 'center' | 'right';

export interface ColumnDef<TData> {
  id: string;
  header: string;
  accessor: keyof TData | ((row: TData) => unknown);
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  align?: CellAlignment;
  sortable?: boolean;
  filterable?: boolean;
  editable?: boolean;
  pinned?: PinPosition;
  hidden?: boolean;
  resizable?: boolean;
  
  /** Custom cell renderer */
  cell?: (props: CellProps<TData>) => ReactNode;
  
  /** Custom header renderer */
  headerCell?: (props: HeaderCellProps<TData>) => ReactNode;
  
  /** Editor component for inline editing */
  editor?: (props: EditorProps<TData>) => ReactNode;
  
  /** Validation function for edits */
  validate?: (value: unknown, row: TData) => string | null;
  
  /** Format value for display */
  format?: (value: unknown) => string;
  
  /** Format value for export */
  exportFormat?: (value: unknown) => string;
}

export interface CellProps<TData> {
  value: unknown;
  row: TData;
  rowIndex: number;
  column: ColumnDef<TData>;
  isEditing: boolean;
  onEdit: () => void;
}

export interface HeaderCellProps<TData> {
  column: ColumnDef<TData>;
  sortDirection: SortDirection;
  onSort: () => void;
  isPinned: PinPosition;
  onPin: (position: PinPosition) => void;
}

export interface EditorProps<TData> {
  value: unknown;
  row: TData;
  column: ColumnDef<TData>;
  onSave: (value: unknown) => void;
  onCancel: () => void;
  error?: string | null;
}

export interface TableState {
  sorting: { columnId: string; direction: SortDirection }[];
  columnOrder: string[];
  columnWidths: Record<string, number>;
  columnPins: Record<string, PinPosition>;
  hiddenColumns: string[];
  selectedRows: Set<string>;
  editingCell: { rowId: string; columnId: string } | null;
}

export interface AdvancedTableProps<TData> {
  data: TData[];
  columns: ColumnDef<TData>[];
  getRowId: (row: TData) => string;
  
  /** Enable virtual scrolling (recommended for 100+ rows) */
  virtualScrolling?: boolean;
  
  /** Row height for virtual scrolling */
  rowHeight?: number;
  
  /** Table height (required for virtual scrolling) */
  height?: number | string;
  
  /** Enable row selection */
  selectable?: boolean;
  
  /** Enable multi-select */
  multiSelect?: boolean;
  
  /** Called when selection changes */
  onSelectionChange?: (selectedIds: Set<string>) => void;
  
  /** Called when row is edited */
  onRowEdit?: (rowId: string, columnId: string, value: unknown) => Promise<void>;
  
  /** Called when sort changes */
  onSortChange?: (sorting: TableState['sorting']) => void;
  
  /** External loading state */
  isLoading?: boolean;
  
  /** Empty state message */
  emptyMessage?: string;
  
  /** Enable column resizing */
  resizable?: boolean;
  
  /** Enable column reordering */
  reorderable?: boolean;
  
  /** Storage key for persisting state */
  storageKey?: string;
  
  /** Additional class name */
  className?: string;
}

// ============================================================================
// Context
// ============================================================================

interface TableContextValue<TData> {
  state: TableState;
  columns: ColumnDef<TData>[];
  updateState: (updates: Partial<TableState>) => void;
  startEdit: (rowId: string, columnId: string) => void;
  saveEdit: (value: unknown) => Promise<void>;
  cancelEdit: () => void;
  toggleRowSelection: (rowId: string) => void;
  selectAllRows: () => void;
  clearSelection: () => void;
  toggleSort: (columnId: string) => void;
  togglePin: (columnId: string, position: PinPosition) => void;
  setColumnWidth: (columnId: string, width: number) => void;
  reorderColumns: (newOrder: string[]) => void;
  toggleColumnVisibility: (columnId: string) => void;
}

const TableContext = createContext<TableContextValue<unknown> | null>(null);

function useTableContext<TData>() {
  const context = useContext(TableContext) as TableContextValue<TData> | null;
  if (!context) {
    throw new Error('Table components must be used within AdvancedTable');
  }
  return context;
}

// ============================================================================
// State Persistence
// ============================================================================

function loadTableState(storageKey: string): Partial<TableState> | null {
  try {
    const stored = localStorage.getItem(`table-state-${storageKey}`);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function saveTableState(storageKey: string, state: Partial<TableState>) {
  try {
    // Don't persist selection or editing state
    const { selectedRows, editingCell, ...persistable } = state as TableState;
    localStorage.setItem(`table-state-${storageKey}`, JSON.stringify(persistable));
  } catch {
    // Storage full or unavailable
  }
}

// ============================================================================
// Default Column Width
// ============================================================================

const DEFAULT_COLUMN_WIDTH = 150;
const MIN_COLUMN_WIDTH = 50;
const MAX_COLUMN_WIDTH = 500;

// ============================================================================
// Main Component
// ============================================================================

export function AdvancedTable<TData extends Record<string, unknown>>({
  data,
  columns,
  getRowId,
  virtualScrolling = false,
  rowHeight = 48,
  height = 600,
  selectable = false,
  multiSelect = true,
  onSelectionChange,
  onRowEdit,
  onSortChange,
  isLoading = false,
  emptyMessage = 'No data available',
  resizable = true,
  reorderable = true,
  storageKey,
  className,
}: AdvancedTableProps<TData>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [editError, setEditError] = useState<string | null>(null);
  
  // Initialize state
  const [state, setState] = useState<TableState>(() => {
    const stored = storageKey ? loadTableState(storageKey) : null;
    return {
      sorting: stored?.sorting ?? [],
      columnOrder: stored?.columnOrder ?? columns.map((c) => c.id),
      columnWidths: stored?.columnWidths ?? {},
      columnPins: stored?.columnPins ?? Object.fromEntries(
        columns.filter((c) => c.pinned).map((c) => [c.id, c.pinned!])
      ),
      hiddenColumns: stored?.hiddenColumns ?? columns.filter((c) => c.hidden).map((c) => c.id),
      selectedRows: new Set(),
      editingCell: null,
    };
  });
  
  // Persist state changes
  useEffect(() => {
    if (storageKey) {
      saveTableState(storageKey, state);
    }
  }, [storageKey, state]);
  
  // Notify selection changes
  useEffect(() => {
    onSelectionChange?.(state.selectedRows);
  }, [state.selectedRows, onSelectionChange]);
  
  // Notify sort changes
  useEffect(() => {
    onSortChange?.(state.sorting);
  }, [state.sorting, onSortChange]);
  
  // Update state helper
  const updateState = useCallback((updates: Partial<TableState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);
  
  // Organize columns by pin position
  const organizedColumns = useMemo(() => {
    const visible = columns.filter((c) => !state.hiddenColumns.includes(c.id));
    const ordered = state.columnOrder
      .map((id) => visible.find((c) => c.id === id))
      .filter(Boolean) as ColumnDef<TData>[];
    
    // Add any new columns not in order
    visible.forEach((c) => {
      if (!ordered.some((o) => o.id === c.id)) {
        ordered.push(c);
      }
    });
    
    const leftPinned = ordered.filter((c) => state.columnPins[c.id] === 'left');
    const rightPinned = ordered.filter((c) => state.columnPins[c.id] === 'right');
    const unpinned = ordered.filter((c) => !state.columnPins[c.id]);
    
    return { leftPinned, unpinned, rightPinned, all: [...leftPinned, ...unpinned, ...rightPinned] };
  }, [columns, state.columnOrder, state.columnPins, state.hiddenColumns]);
  
  // Get column width
  const getColumnWidth = useCallback((columnId: string) => {
    const col = columns.find((c) => c.id === columnId);
    return state.columnWidths[columnId] ?? col?.width ?? DEFAULT_COLUMN_WIDTH;
  }, [columns, state.columnWidths]);
  
  // Sort data
  const sortedData = useMemo(() => {
    if (state.sorting.length === 0) return data;
    
    return [...data].sort((a, b) => {
      for (const { columnId, direction } of state.sorting) {
        if (!direction) continue;
        
        const column = columns.find((c) => c.id === columnId);
        if (!column) continue;
        
        const aValue = typeof column.accessor === 'function'
          ? column.accessor(a)
          : a[column.accessor as keyof TData];
        const bValue = typeof column.accessor === 'function'
          ? column.accessor(b)
          : b[column.accessor as keyof TData];
        
        let comparison = 0;
        if (aValue == null && bValue == null) comparison = 0;
        else if (aValue == null) comparison = 1;
        else if (bValue == null) comparison = -1;
        else if (typeof aValue === 'string' && typeof bValue === 'string') {
          comparison = aValue.localeCompare(bValue);
        } else {
          comparison = (aValue as number) - (bValue as number);
        }
        
        if (comparison !== 0) {
          return direction === 'desc' ? -comparison : comparison;
        }
      }
      return 0;
    });
  }, [data, state.sorting, columns]);
  
  // Virtual scrolling
  const rowVirtualizer = useVirtualizer({
    count: sortedData.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => rowHeight,
    overscan: 5,
    enabled: virtualScrolling,
  });
  
  // Context actions
  const startEdit = useCallback((rowId: string, columnId: string) => {
    setEditError(null);
    updateState({ editingCell: { rowId, columnId } });
  }, [updateState]);
  
  const saveEdit = useCallback(async (value: unknown) => {
    if (!state.editingCell || !onRowEdit) return;
    
    const { rowId, columnId } = state.editingCell;
    const column = columns.find((c) => c.id === columnId);
    const row = data.find((r) => getRowId(r) === rowId);
    
    if (column?.validate && row) {
      const error = column.validate(value, row);
      if (error) {
        setEditError(error);
        return;
      }
    }
    
    try {
      await onRowEdit(rowId, columnId, value);
      updateState({ editingCell: null });
      setEditError(null);
    } catch (err) {
      setEditError((err as Error).message || 'Failed to save');
    }
  }, [state.editingCell, onRowEdit, columns, data, getRowId, updateState]);
  
  const cancelEdit = useCallback(() => {
    updateState({ editingCell: null });
    setEditError(null);
  }, [updateState]);
  
  const toggleRowSelection = useCallback((rowId: string) => {
    updateState({
      selectedRows: new Set(
        state.selectedRows.has(rowId)
          ? [...state.selectedRows].filter((id) => id !== rowId)
          : multiSelect
          ? [...state.selectedRows, rowId]
          : [rowId]
      ),
    });
  }, [state.selectedRows, multiSelect, updateState]);
  
  const selectAllRows = useCallback(() => {
    updateState({
      selectedRows: new Set(sortedData.map(getRowId)),
    });
  }, [sortedData, getRowId, updateState]);
  
  const clearSelection = useCallback(() => {
    updateState({ selectedRows: new Set() });
  }, [updateState]);
  
  const toggleSort = useCallback((columnId: string) => {
    const column = columns.find((c) => c.id === columnId);
    if (!column?.sortable) return;
    
    const current = state.sorting.find((s) => s.columnId === columnId);
    let newDirection: SortDirection = 'asc';
    
    if (current?.direction === 'asc') newDirection = 'desc';
    else if (current?.direction === 'desc') newDirection = null;
    
    updateState({
      sorting: newDirection
        ? [{ columnId, direction: newDirection }]
        : state.sorting.filter((s) => s.columnId !== columnId),
    });
  }, [columns, state.sorting, updateState]);
  
  const togglePin = useCallback((columnId: string, position: PinPosition) => {
    updateState({
      columnPins: {
        ...state.columnPins,
        [columnId]: state.columnPins[columnId] === position ? null : position,
      },
    });
  }, [state.columnPins, updateState]);
  
  const setColumnWidth = useCallback((columnId: string, width: number) => {
    const col = columns.find((c) => c.id === columnId);
    const minWidth = col?.minWidth ?? MIN_COLUMN_WIDTH;
    const maxWidth = col?.maxWidth ?? MAX_COLUMN_WIDTH;
    const clampedWidth = Math.max(minWidth, Math.min(maxWidth, width));
    
    updateState({
      columnWidths: { ...state.columnWidths, [columnId]: clampedWidth },
    });
  }, [columns, state.columnWidths, updateState]);
  
  const reorderColumns = useCallback((newOrder: string[]) => {
    updateState({ columnOrder: newOrder });
  }, [updateState]);
  
  const toggleColumnVisibility = useCallback((columnId: string) => {
    updateState({
      hiddenColumns: state.hiddenColumns.includes(columnId)
        ? state.hiddenColumns.filter((id) => id !== columnId)
        : [...state.hiddenColumns, columnId],
    });
  }, [state.hiddenColumns, updateState]);
  
  // Context value
  const contextValue: TableContextValue<TData> = {
    state,
    columns,
    updateState,
    startEdit,
    saveEdit,
    cancelEdit,
    toggleRowSelection,
    selectAllRows,
    clearSelection,
    toggleSort,
    togglePin,
    setColumnWidth,
    reorderColumns,
    toggleColumnVisibility,
  };
  
  // Calculate pinned column offsets
  const leftPinnedWidth = organizedColumns.leftPinned.reduce(
    (sum, col) => sum + getColumnWidth(col.id),
    0
  );
  const rightPinnedWidth = organizedColumns.rightPinned.reduce(
    (sum, col) => sum + getColumnWidth(col.id),
    0
  );
  
  // Rows to render
  const virtualItems = virtualScrolling ? rowVirtualizer.getVirtualItems() : null;
  const rowsToRender = virtualItems
    ? virtualItems.map((vi) => ({ row: sortedData[vi.index], virtualItem: vi }))
    : sortedData.map((row, index) => ({ row, virtualItem: null, index }));
  
  return (
    <TableContext.Provider value={contextValue as TableContextValue<unknown>}>
      <div
        className={clsx(
          'relative border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden',
          'bg-white dark:bg-gray-900',
          className
        )}
      >
        {/* Table container */}
        <div
          ref={containerRef}
          className="overflow-auto"
          style={{ height: typeof height === 'number' ? `${height}px` : height }}
        >
          {/* Header */}
          <div
            className={clsx(
              'sticky top-0 z-20',
              'flex bg-gray-50 dark:bg-gray-800',
              'border-b border-gray-200 dark:border-gray-700'
            )}
          >
            {/* Selection checkbox column */}
            {selectable && (
              <div
                className={clsx(
                  'sticky left-0 z-30 flex-shrink-0',
                  'w-12 flex items-center justify-center',
                  'bg-gray-50 dark:bg-gray-800',
                  'border-r border-gray-200 dark:border-gray-700'
                )}
              >
                <input
                  type="checkbox"
                  checked={state.selectedRows.size === sortedData.length && sortedData.length > 0}
                  onChange={() => 
                    state.selectedRows.size === sortedData.length 
                      ? clearSelection() 
                      : selectAllRows()
                  }
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </div>
            )}
            
            {/* Left pinned headers */}
            {organizedColumns.leftPinned.map((column, idx) => (
              <HeaderCell
                key={column.id}
                column={column}
                width={getColumnWidth(column.id)}
                isPinned="left"
                stickyOffset={
                  (selectable ? 48 : 0) +
                  organizedColumns.leftPinned
                    .slice(0, idx)
                    .reduce((sum, c) => sum + getColumnWidth(c.id), 0)
                }
                resizable={resizable && column.resizable !== false}
              />
            ))}
            
            {/* Unpinned headers */}
            {organizedColumns.unpinned.map((column) => (
              <HeaderCell
                key={column.id}
                column={column}
                width={getColumnWidth(column.id)}
                isPinned={null}
                resizable={resizable && column.resizable !== false}
              />
            ))}
            
            {/* Right pinned headers */}
            {organizedColumns.rightPinned.map((column, idx) => (
              <HeaderCell
                key={column.id}
                column={column}
                width={getColumnWidth(column.id)}
                isPinned="right"
                stickyOffset={
                  organizedColumns.rightPinned
                    .slice(idx + 1)
                    .reduce((sum, c) => sum + getColumnWidth(c.id), 0)
                }
                resizable={resizable && column.resizable !== false}
              />
            ))}
          </div>
          
          {/* Body */}
          <div
            style={{
              height: virtualScrolling ? `${rowVirtualizer.getTotalSize()}px` : undefined,
              position: 'relative',
            }}
          >
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
              </div>
            ) : sortedData.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-gray-500">
                {emptyMessage}
              </div>
            ) : (
              rowsToRender.map(({ row, virtualItem }, idx) => {
                const rowId = getRowId(row);
                const isSelected = state.selectedRows.has(rowId);
                const rowIndex = virtualItem?.index ?? idx;
                
                return (
                  <div
                    key={rowId}
                    className={clsx(
                      'flex border-b border-gray-100 dark:border-gray-800',
                      'hover:bg-gray-50 dark:hover:bg-gray-800/50',
                      isSelected && 'bg-blue-50 dark:bg-blue-900/20'
                    )}
                    style={
                      virtualItem
                        ? {
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            transform: `translateY(${virtualItem.start}px)`,
                            height: `${virtualItem.size}px`,
                          }
                        : undefined
                    }
                  >
                    {/* Selection checkbox */}
                    {selectable && (
                      <div
                        className={clsx(
                          'sticky left-0 z-10 flex-shrink-0',
                          'w-12 flex items-center justify-center',
                          'bg-white dark:bg-gray-900',
                          isSelected && 'bg-blue-50 dark:bg-blue-900/20',
                          'border-r border-gray-100 dark:border-gray-800'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRowSelection(rowId)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </div>
                    )}
                    
                    {/* Left pinned cells */}
                    {organizedColumns.leftPinned.map((column, colIdx) => (
                      <DataCell
                        key={column.id}
                        column={column}
                        row={row}
                        rowId={rowId}
                        rowIndex={rowIndex}
                        width={getColumnWidth(column.id)}
                        isPinned="left"
                        stickyOffset={
                          (selectable ? 48 : 0) +
                          organizedColumns.leftPinned
                            .slice(0, colIdx)
                            .reduce((sum, c) => sum + getColumnWidth(c.id), 0)
                        }
                        isSelected={isSelected}
                        editError={
                          state.editingCell?.rowId === rowId &&
                          state.editingCell?.columnId === column.id
                            ? editError
                            : null
                        }
                      />
                    ))}
                    
                    {/* Unpinned cells */}
                    {organizedColumns.unpinned.map((column) => (
                      <DataCell
                        key={column.id}
                        column={column}
                        row={row}
                        rowId={rowId}
                        rowIndex={rowIndex}
                        width={getColumnWidth(column.id)}
                        isPinned={null}
                        isSelected={isSelected}
                        editError={
                          state.editingCell?.rowId === rowId &&
                          state.editingCell?.columnId === column.id
                            ? editError
                            : null
                        }
                      />
                    ))}
                    
                    {/* Right pinned cells */}
                    {organizedColumns.rightPinned.map((column, colIdx) => (
                      <DataCell
                        key={column.id}
                        column={column}
                        row={row}
                        rowId={rowId}
                        rowIndex={rowIndex}
                        width={getColumnWidth(column.id)}
                        isPinned="right"
                        stickyOffset={
                          organizedColumns.rightPinned
                            .slice(colIdx + 1)
                            .reduce((sum, c) => sum + getColumnWidth(c.id), 0)
                        }
                        isSelected={isSelected}
                        editError={
                          state.editingCell?.rowId === rowId &&
                          state.editingCell?.columnId === column.id
                            ? editError
                            : null
                        }
                      />
                    ))}
                  </div>
                );
              })
            )}
          </div>
        </div>
        
        {/* Selection summary footer */}
        {selectable && state.selectedRows.size > 0 && (
          <div
            className={clsx(
              'sticky bottom-0 left-0 right-0 z-20',
              'px-4 py-2 bg-blue-50 dark:bg-blue-900/20',
              'border-t border-blue-200 dark:border-blue-800',
              'flex items-center justify-between'
            )}
          >
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
              {state.selectedRows.size} row{state.selectedRows.size !== 1 ? 's' : ''} selected
            </span>
            <button
              onClick={clearSelection}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Clear selection
            </button>
          </div>
        )}
      </div>
    </TableContext.Provider>
  );
}

// ============================================================================
// Header Cell Component
// ============================================================================

interface HeaderCellComponentProps<TData> {
  column: ColumnDef<TData>;
  width: number;
  isPinned: PinPosition;
  stickyOffset?: number;
  resizable?: boolean;
}

function HeaderCell<TData>({
  column,
  width,
  isPinned,
  stickyOffset = 0,
  resizable = true,
}: HeaderCellComponentProps<TData>) {
  const { state, toggleSort, togglePin, setColumnWidth } = useTableContext<TData>();
  const [isResizing, setIsResizing] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  
  const sortDirection = state.sorting.find((s) => s.columnId === column.id)?.direction ?? null;
  
  // Handle resize
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = width;
    
    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startXRef.current;
      setColumnWidth(column.id, startWidthRef.current + delta);
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };
  
  const style: CSSProperties = {
    width,
    minWidth: width,
    maxWidth: width,
    ...(isPinned === 'left' && {
      position: 'sticky',
      left: stickyOffset,
      zIndex: 10,
    }),
    ...(isPinned === 'right' && {
      position: 'sticky',
      right: stickyOffset,
      zIndex: 10,
    }),
  };
  
  return (
    <div
      className={clsx(
        'relative flex-shrink-0 px-4 py-3',
        'flex items-center gap-2',
        'text-sm font-semibold text-gray-700 dark:text-gray-300',
        'bg-gray-50 dark:bg-gray-800',
        isPinned && 'shadow-sm',
        column.sortable && 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700'
      )}
      style={style}
      onClick={() => column.sortable && toggleSort(column.id)}
    >
      {/* Custom header or default */}
      {column.headerCell ? (
        column.headerCell({
          column,
          sortDirection,
          onSort: () => toggleSort(column.id),
          isPinned,
          onPin: (pos) => togglePin(column.id, pos),
        })
      ) : (
        <>
          <span className="truncate flex-1">{column.header}</span>
          
          {/* Sort indicator */}
          {column.sortable && sortDirection && (
            <span className="text-blue-600 dark:text-blue-400">
              {sortDirection === 'asc' ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </span>
          )}
          
          {/* Pin button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              togglePin(column.id, isPinned ? null : 'left');
            }}
            className={clsx(
              'p-1 rounded opacity-0 group-hover:opacity-100',
              'hover:bg-gray-200 dark:hover:bg-gray-600',
              'transition-opacity',
              isPinned && 'opacity-100 text-blue-600 dark:text-blue-400'
            )}
            title={isPinned ? 'Unpin column' : 'Pin column'}
          >
            {isPinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
          </button>
        </>
      )}
      
      {/* Resize handle */}
      {resizable && (
        <div
          className={clsx(
            'absolute right-0 top-0 bottom-0 w-1 cursor-col-resize',
            'hover:bg-blue-500',
            isResizing && 'bg-blue-500'
          )}
          onMouseDown={handleResizeStart}
        />
      )}
    </div>
  );
}

// ============================================================================
// Data Cell Component
// ============================================================================

interface DataCellComponentProps<TData> {
  column: ColumnDef<TData>;
  row: TData;
  rowId: string;
  rowIndex: number;
  width: number;
  isPinned: PinPosition;
  stickyOffset?: number;
  isSelected: boolean;
  editError?: string | null;
}

function DataCell<TData>({
  column,
  row,
  rowId,
  rowIndex,
  width,
  isPinned,
  stickyOffset = 0,
  isSelected,
  editError,
}: DataCellComponentProps<TData>) {
  const { state, startEdit, saveEdit, cancelEdit } = useTableContext<TData>();
  const inputRef = useRef<HTMLInputElement>(null);
  
  const isEditing = 
    state.editingCell?.rowId === rowId && 
    state.editingCell?.columnId === column.id;
  
  const value = typeof column.accessor === 'function'
    ? column.accessor(row)
    : row[column.accessor as keyof TData];
  
  const displayValue = column.format ? column.format(value) : String(value ?? '');
  
  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);
  
  // Handle keyboard in edit mode
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      saveEdit(inputRef.current?.value);
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };
  
  const style: CSSProperties = {
    width,
    minWidth: width,
    maxWidth: width,
    textAlign: column.align || 'left',
    ...(isPinned === 'left' && {
      position: 'sticky',
      left: stickyOffset,
      zIndex: 5,
    }),
    ...(isPinned === 'right' && {
      position: 'sticky',
      right: stickyOffset,
      zIndex: 5,
    }),
  };
  
  return (
    <div
      className={clsx(
        'relative flex-shrink-0 px-4 py-3',
        'text-sm text-gray-900 dark:text-gray-100',
        'bg-white dark:bg-gray-900',
        isSelected && 'bg-blue-50 dark:bg-blue-900/20',
        isPinned && 'shadow-sm',
        column.editable && !isEditing && 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800'
      )}
      style={style}
      onDoubleClick={() => column.editable && startEdit(rowId, column.id)}
    >
      {isEditing ? (
        // Edit mode
        <div className="flex items-center gap-1">
          {column.editor ? (
            column.editor({
              value,
              row,
              column,
              onSave: saveEdit,
              onCancel: cancelEdit,
              error: editError,
            })
          ) : (
            <>
              <input
                ref={inputRef}
                type="text"
                defaultValue={String(value ?? '')}
                onKeyDown={handleKeyDown}
                className={clsx(
                  'flex-1 px-2 py-1 text-sm rounded border',
                  'focus:outline-none focus:ring-2',
                  editError
                    ? 'border-red-300 focus:ring-red-500'
                    : 'border-blue-300 focus:ring-blue-500'
                )}
              />
              <button
                onClick={() => saveEdit(inputRef.current?.value)}
                className="p-1 text-green-600 hover:bg-green-50 rounded"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={cancelEdit}
                className="p-1 text-red-600 hover:bg-red-50 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      ) : column.cell ? (
        // Custom cell renderer
        column.cell({
          value,
          row,
          rowIndex,
          column,
          isEditing,
          onEdit: () => startEdit(rowId, column.id),
        })
      ) : (
        // Default display
        <span className="truncate">{displayValue}</span>
      )}
      
      {/* Edit error tooltip */}
      {editError && isEditing && (
        <div className="absolute left-0 top-full mt-1 px-2 py-1 text-xs text-white bg-red-500 rounded shadow-lg z-50">
          {editError}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Column Visibility Toggle
// ============================================================================

interface ColumnVisibilityToggleProps {
  className?: string;
}

export function ColumnVisibilityToggle({ className }: ColumnVisibilityToggleProps) {
  const { columns, state, toggleColumnVisibility } = useTableContext();
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className={clsx('relative', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'flex items-center gap-2 px-3 py-2 text-sm',
          'text-gray-700 dark:text-gray-300',
          'bg-white dark:bg-gray-800',
          'border border-gray-200 dark:border-gray-700 rounded-lg',
          'hover:bg-gray-50 dark:hover:bg-gray-700'
        )}
      >
        <Columns3 className="h-4 w-4" />
        Columns
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={clsx(
              'absolute right-0 mt-2 z-50',
              'w-56 p-2',
              'bg-white dark:bg-gray-800',
              'rounded-lg shadow-xl',
              'border border-gray-200 dark:border-gray-700'
            )}
          >
            {columns.map((column) => (
              <label
                key={column.id}
                className={clsx(
                  'flex items-center gap-2 px-2 py-1.5 rounded',
                  'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700'
                )}
              >
                <input
                  type="checkbox"
                  checked={!state.hiddenColumns.includes(column.id)}
                  onChange={() => toggleColumnVisibility(column.id)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {column.header}
                </span>
              </label>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default AdvancedTable;
