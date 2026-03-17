/**
 * Table Keyboard Navigation
 * 
 * Provides keyboard navigation support for tables:
 * - Arrow key navigation between cells
 * - Enter to edit cells
 * - Tab to move between editable cells
 * - Ctrl+A to select all
 * - Escape to cancel edit
 * - Delete to clear cell
 * - Copy/paste support
 */

import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  createContext,
  useContext,
  KeyboardEvent,
  ClipboardEvent,
} from 'react';
import { clsx } from 'clsx';

// ============================================================================
// Types
// ============================================================================

export interface CellPosition {
  rowIndex: number;
  columnIndex: number;
}

export interface CellRange {
  start: CellPosition;
  end: CellPosition;
}

export interface KeyboardNavigationState {
  focusedCell: CellPosition | null;
  selectedRange: CellRange | null;
  isEditing: boolean;
}

export interface KeyboardNavigationOptions {
  rowCount: number;
  columnCount: number;
  onCellFocus?: (position: CellPosition) => void;
  onCellEdit?: (position: CellPosition) => void;
  onCellSelect?: (range: CellRange) => void;
  onCellCopy?: (range: CellRange) => string;
  onCellPaste?: (position: CellPosition, data: string) => void;
  onCellClear?: (range: CellRange) => void;
  isEditable?: (position: CellPosition) => boolean;
  wrapNavigation?: boolean;
}

// ============================================================================
// Context
// ============================================================================

interface KeyboardNavigationContextValue {
  state: KeyboardNavigationState;
  focusCell: (position: CellPosition) => void;
  startEdit: () => void;
  stopEdit: () => void;
  getCellTabIndex: (position: CellPosition) => number;
  isCellFocused: (position: CellPosition) => boolean;
  isCellSelected: (position: CellPosition) => boolean;
  isCellEditing: (position: CellPosition) => boolean;
  handleKeyDown: (e: KeyboardEvent) => void;
  handleCopy: (e: ClipboardEvent) => void;
  handlePaste: (e: ClipboardEvent) => void;
}

const KeyboardNavigationContext = createContext<KeyboardNavigationContextValue | null>(null);

export function useKeyboardNavigation() {
  const context = useContext(KeyboardNavigationContext);
  if (!context) {
    throw new Error('useKeyboardNavigation must be used within KeyboardNavigationProvider');
  }
  return context;
}

// ============================================================================
// Provider
// ============================================================================

interface KeyboardNavigationProviderProps {
  children: React.ReactNode;
  options: KeyboardNavigationOptions;
}

export function KeyboardNavigationProvider({
  children,
  options,
}: KeyboardNavigationProviderProps) {
  const {
    rowCount,
    columnCount,
    onCellFocus,
    onCellEdit,
    onCellSelect,
    onCellCopy,
    onCellPaste,
    onCellClear,
    isEditable,
    wrapNavigation = false,
  } = options;

  const [state, setState] = useState<KeyboardNavigationState>({
    focusedCell: null,
    selectedRange: null,
    isEditing: false,
  });

  const shiftStartRef = useRef<CellPosition | null>(null);

  // Focus a specific cell
  const focusCell = useCallback((position: CellPosition) => {
    setState((prev) => ({
      ...prev,
      focusedCell: position,
      selectedRange: null,
      isEditing: false,
    }));
    onCellFocus?.(position);
  }, [onCellFocus]);

  // Start editing the focused cell
  const startEdit = useCallback(() => {
    if (!state.focusedCell) return;
    if (isEditable && !isEditable(state.focusedCell)) return;
    
    setState((prev) => ({ ...prev, isEditing: true }));
    onCellEdit?.(state.focusedCell);
  }, [state.focusedCell, isEditable, onCellEdit]);

  // Stop editing
  const stopEdit = useCallback(() => {
    setState((prev) => ({ ...prev, isEditing: false }));
  }, []);

  // Navigate to adjacent cell
  const navigateToCell = useCallback((
    direction: 'up' | 'down' | 'left' | 'right',
    withShift: boolean
  ) => {
    if (!state.focusedCell) {
      focusCell({ rowIndex: 0, columnIndex: 0 });
      return;
    }

    let { rowIndex, columnIndex } = state.focusedCell;

    switch (direction) {
      case 'up':
        rowIndex = wrapNavigation
          ? (rowIndex - 1 + rowCount) % rowCount
          : Math.max(0, rowIndex - 1);
        break;
      case 'down':
        rowIndex = wrapNavigation
          ? (rowIndex + 1) % rowCount
          : Math.min(rowCount - 1, rowIndex + 1);
        break;
      case 'left':
        columnIndex = wrapNavigation
          ? (columnIndex - 1 + columnCount) % columnCount
          : Math.max(0, columnIndex - 1);
        break;
      case 'right':
        columnIndex = wrapNavigation
          ? (columnIndex + 1) % columnCount
          : Math.min(columnCount - 1, columnIndex + 1);
        break;
    }

    const newPosition = { rowIndex, columnIndex };

    if (withShift) {
      // Extend selection
      if (!shiftStartRef.current) {
        shiftStartRef.current = state.focusedCell;
      }
      
      const range: CellRange = {
        start: shiftStartRef.current,
        end: newPosition,
      };
      
      setState((prev) => ({
        ...prev,
        focusedCell: newPosition,
        selectedRange: range,
      }));
      onCellSelect?.(range);
    } else {
      shiftStartRef.current = null;
      focusCell(newPosition);
    }
  }, [state.focusedCell, rowCount, columnCount, wrapNavigation, focusCell, onCellSelect]);

  // Navigate to next editable cell
  const navigateToNextEditable = useCallback((reverse: boolean) => {
    if (!state.focusedCell || !isEditable) return;

    let { rowIndex, columnIndex } = state.focusedCell;
    const totalCells = rowCount * columnCount;
    let checked = 0;

    while (checked < totalCells) {
      if (reverse) {
        columnIndex--;
        if (columnIndex < 0) {
          columnIndex = columnCount - 1;
          rowIndex--;
          if (rowIndex < 0) rowIndex = rowCount - 1;
        }
      } else {
        columnIndex++;
        if (columnIndex >= columnCount) {
          columnIndex = 0;
          rowIndex++;
          if (rowIndex >= rowCount) rowIndex = 0;
        }
      }

      const pos = { rowIndex, columnIndex };
      if (isEditable(pos)) {
        focusCell(pos);
        return;
      }
      checked++;
    }
  }, [state.focusedCell, rowCount, columnCount, isEditable, focusCell]);

  // Select all cells
  const selectAll = useCallback(() => {
    const range: CellRange = {
      start: { rowIndex: 0, columnIndex: 0 },
      end: { rowIndex: rowCount - 1, columnIndex: columnCount - 1 },
    };
    setState((prev) => ({
      ...prev,
      selectedRange: range,
    }));
    onCellSelect?.(range);
  }, [rowCount, columnCount, onCellSelect]);

  // Handle keyboard events
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't handle if editing (let the input handle it)
    if (state.isEditing && e.key !== 'Escape' && e.key !== 'Tab') {
      return;
    }

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        navigateToCell('up', e.shiftKey);
        break;

      case 'ArrowDown':
        e.preventDefault();
        navigateToCell('down', e.shiftKey);
        break;

      case 'ArrowLeft':
        e.preventDefault();
        navigateToCell('left', e.shiftKey);
        break;

      case 'ArrowRight':
        e.preventDefault();
        navigateToCell('right', e.shiftKey);
        break;

      case 'Enter':
        e.preventDefault();
        if (state.isEditing) {
          stopEdit();
          navigateToCell('down', false);
        } else {
          startEdit();
        }
        break;

      case 'Tab':
        e.preventDefault();
        if (state.isEditing) {
          stopEdit();
        }
        navigateToNextEditable(e.shiftKey);
        break;

      case 'Escape':
        e.preventDefault();
        if (state.isEditing) {
          stopEdit();
        } else {
          setState((prev) => ({
            ...prev,
            selectedRange: null,
          }));
        }
        break;

      case 'F2':
        e.preventDefault();
        startEdit();
        break;

      case 'Delete':
      case 'Backspace':
        if (!state.isEditing) {
          e.preventDefault();
          const range = state.selectedRange ?? (state.focusedCell ? {
            start: state.focusedCell,
            end: state.focusedCell,
          } : null);
          if (range) {
            onCellClear?.(range);
          }
        }
        break;

      case 'a':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          selectAll();
        }
        break;

      case 'Home':
        e.preventDefault();
        if (e.ctrlKey) {
          focusCell({ rowIndex: 0, columnIndex: 0 });
        } else {
          focusCell({ rowIndex: state.focusedCell?.rowIndex ?? 0, columnIndex: 0 });
        }
        break;

      case 'End':
        e.preventDefault();
        if (e.ctrlKey) {
          focusCell({ rowIndex: rowCount - 1, columnIndex: columnCount - 1 });
        } else {
          focusCell({
            rowIndex: state.focusedCell?.rowIndex ?? rowCount - 1,
            columnIndex: columnCount - 1,
          });
        }
        break;

      case 'PageUp':
        e.preventDefault();
        focusCell({
          rowIndex: Math.max(0, (state.focusedCell?.rowIndex ?? 0) - 10),
          columnIndex: state.focusedCell?.columnIndex ?? 0,
        });
        break;

      case 'PageDown':
        e.preventDefault();
        focusCell({
          rowIndex: Math.min(rowCount - 1, (state.focusedCell?.rowIndex ?? 0) + 10),
          columnIndex: state.focusedCell?.columnIndex ?? 0,
        });
        break;

      default:
        // Start editing on printable character
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          startEdit();
        }
        break;
    }
  }, [
    state.focusedCell,
    state.isEditing,
    state.selectedRange,
    navigateToCell,
    navigateToNextEditable,
    startEdit,
    stopEdit,
    focusCell,
    selectAll,
    rowCount,
    columnCount,
    onCellClear,
  ]);

  // Handle copy
  const handleCopy = useCallback((e: ClipboardEvent) => {
    if (state.isEditing) return;

    const range = state.selectedRange ?? (state.focusedCell ? {
      start: state.focusedCell,
      end: state.focusedCell,
    } : null);

    if (range && onCellCopy) {
      e.preventDefault();
      const data = onCellCopy(range);
      e.clipboardData?.setData('text/plain', data);
    }
  }, [state.isEditing, state.selectedRange, state.focusedCell, onCellCopy]);

  // Handle paste
  const handlePaste = useCallback((e: ClipboardEvent) => {
    if (state.isEditing) return;
    if (!state.focusedCell || !onCellPaste) return;

    e.preventDefault();
    const data = e.clipboardData?.getData('text/plain') ?? '';
    onCellPaste(state.focusedCell, data);
  }, [state.isEditing, state.focusedCell, onCellPaste]);

  // Get cell tab index
  const getCellTabIndex = useCallback((position: CellPosition): number => {
    if (!state.focusedCell) {
      return position.rowIndex === 0 && position.columnIndex === 0 ? 0 : -1;
    }
    return (
      position.rowIndex === state.focusedCell.rowIndex &&
      position.columnIndex === state.focusedCell.columnIndex
    ) ? 0 : -1;
  }, [state.focusedCell]);

  // Check if cell is focused
  const isCellFocused = useCallback((position: CellPosition): boolean => {
    return (
      state.focusedCell !== null &&
      position.rowIndex === state.focusedCell.rowIndex &&
      position.columnIndex === state.focusedCell.columnIndex
    );
  }, [state.focusedCell]);

  // Check if cell is in selection range
  const isCellSelected = useCallback((position: CellPosition): boolean => {
    if (!state.selectedRange) return false;

    const minRow = Math.min(state.selectedRange.start.rowIndex, state.selectedRange.end.rowIndex);
    const maxRow = Math.max(state.selectedRange.start.rowIndex, state.selectedRange.end.rowIndex);
    const minCol = Math.min(state.selectedRange.start.columnIndex, state.selectedRange.end.columnIndex);
    const maxCol = Math.max(state.selectedRange.start.columnIndex, state.selectedRange.end.columnIndex);

    return (
      position.rowIndex >= minRow &&
      position.rowIndex <= maxRow &&
      position.columnIndex >= minCol &&
      position.columnIndex <= maxCol
    );
  }, [state.selectedRange]);

  // Check if cell is being edited
  const isCellEditing = useCallback((position: CellPosition): boolean => {
    return state.isEditing && isCellFocused(position);
  }, [state.isEditing, isCellFocused]);

  const contextValue: KeyboardNavigationContextValue = {
    state,
    focusCell,
    startEdit,
    stopEdit,
    getCellTabIndex,
    isCellFocused,
    isCellSelected,
    isCellEditing,
    handleKeyDown,
    handleCopy,
    handlePaste,
  };

  return (
    <KeyboardNavigationContext.Provider value={contextValue}>
      {children}
    </KeyboardNavigationContext.Provider>
  );
}

// ============================================================================
// Navigable Cell Wrapper
// ============================================================================

interface NavigableCellProps {
  rowIndex: number;
  columnIndex: number;
  children: React.ReactNode;
  className?: string;
  onFocus?: () => void;
  onDoubleClick?: () => void;
}

export function NavigableCell({
  rowIndex,
  columnIndex,
  children,
  className,
  onFocus,
  onDoubleClick,
}: NavigableCellProps) {
  const {
    focusCell,
    startEdit,
    getCellTabIndex,
    isCellFocused,
    isCellSelected,
  } = useKeyboardNavigation();

  const position = { rowIndex, columnIndex };
  const isFocused = isCellFocused(position);
  const isSelected = isCellSelected(position);
  const tabIndex = getCellTabIndex(position);

  const handleFocus = useCallback(() => {
    focusCell(position);
    onFocus?.();
  }, [focusCell, position, onFocus]);

  const handleDoubleClick = useCallback(() => {
    startEdit();
    onDoubleClick?.();
  }, [startEdit, onDoubleClick]);

  return (
    <div
      role="gridcell"
      tabIndex={tabIndex}
      onFocus={handleFocus}
      onDoubleClick={handleDoubleClick}
      className={clsx(
        'outline-none transition-colors',
        isFocused && 'ring-2 ring-blue-500 ring-inset',
        isSelected && !isFocused && 'bg-blue-50 dark:bg-blue-900/20',
        className
      )}
    >
      {children}
    </div>
  );
}

// ============================================================================
// Keyboard Navigation Hook
// ============================================================================

export interface UseTableKeyboardOptions<TData> {
  data: TData[];
  columns: { id: string; editable?: boolean }[];
  getRowId: (row: TData) => string;
  onCellEdit?: (rowId: string, columnId: string, value: unknown) => void;
  onCellClear?: (rowIds: string[], columnIds: string[]) => void;
  getCellValue?: (rowId: string, columnId: string) => unknown;
}

export function useTableKeyboard<TData>(options: UseTableKeyboardOptions<TData>) {
  const { data, columns, getRowId, onCellEdit, onCellClear, getCellValue } = options;

  const isEditable = useCallback((position: CellPosition): boolean => {
    const column = columns[position.columnIndex];
    return column?.editable ?? false;
  }, [columns]);

  const onCellCopy = useCallback((range: CellRange): string => {
    if (!getCellValue) return '';

    const rows: string[] = [];
    const minRow = Math.min(range.start.rowIndex, range.end.rowIndex);
    const maxRow = Math.max(range.start.rowIndex, range.end.rowIndex);
    const minCol = Math.min(range.start.columnIndex, range.end.columnIndex);
    const maxCol = Math.max(range.start.columnIndex, range.end.columnIndex);

    for (let row = minRow; row <= maxRow; row++) {
      const cells: string[] = [];
      const rowId = getRowId(data[row]);
      
      for (let col = minCol; col <= maxCol; col++) {
        const columnId = columns[col].id;
        const value = getCellValue(rowId, columnId);
        cells.push(String(value ?? ''));
      }
      
      rows.push(cells.join('\t'));
    }

    return rows.join('\n');
  }, [data, columns, getRowId, getCellValue]);

  const onCellPaste = useCallback((position: CellPosition, clipboardData: string) => {
    if (!onCellEdit) return;

    const rows = clipboardData.split('\n');
    rows.forEach((row, rowOffset) => {
      const cells = row.split('\t');
      cells.forEach((value, colOffset) => {
        const targetRow = position.rowIndex + rowOffset;
        const targetCol = position.columnIndex + colOffset;

        if (targetRow < data.length && targetCol < columns.length) {
          const column = columns[targetCol];
          if (column.editable) {
            const rowId = getRowId(data[targetRow]);
            onCellEdit(rowId, column.id, value);
          }
        }
      });
    });
  }, [data, columns, getRowId, onCellEdit]);

  const onCellClearHandler = useCallback((range: CellRange) => {
    if (!onCellClear) return;

    const minRow = Math.min(range.start.rowIndex, range.end.rowIndex);
    const maxRow = Math.max(range.start.rowIndex, range.end.rowIndex);
    const minCol = Math.min(range.start.columnIndex, range.end.columnIndex);
    const maxCol = Math.max(range.start.columnIndex, range.end.columnIndex);

    const rowIds: string[] = [];
    const columnIds: string[] = [];

    for (let row = minRow; row <= maxRow; row++) {
      rowIds.push(getRowId(data[row]));
    }

    for (let col = minCol; col <= maxCol; col++) {
      if (columns[col].editable) {
        columnIds.push(columns[col].id);
      }
    }

    onCellClear(rowIds, columnIds);
  }, [data, columns, getRowId, onCellClear]);

  return {
    rowCount: data.length,
    columnCount: columns.length,
    isEditable,
    onCellCopy,
    onCellPaste,
    onCellClear: onCellClearHandler,
  };
}

export default KeyboardNavigationProvider;
