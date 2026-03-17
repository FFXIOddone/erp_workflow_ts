/**
 * Bulk Actions System
 * 
 * Comprehensive bulk operations system with:
 * - Multi-select with shift-click range selection
 * - Floating action bar with contextual actions
 * - Progress tracking for bulk operations
 * - Undo/redo support
 * - Batch API calls with error handling
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
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  CheckSquare,
  Square,
  Minus,
  Trash2,
  Edit3,
  Copy,
  Archive,
  Download,
  Mail,
  MoreHorizontal,
  ChevronDown,
  AlertCircle,
  CheckCircle,
  Loader2,
  Undo2,
  RotateCcw,
} from 'lucide-react';
import { clsx } from 'clsx';

// ============================================================================
// Types
// ============================================================================

export interface SelectableItem {
  id: string;
  [key: string]: unknown;
}

export interface BulkAction<T extends SelectableItem = SelectableItem> {
  /** Unique action identifier */
  id: string;
  
  /** Display label */
  label: string;
  
  /** Icon component */
  icon?: React.ElementType;
  
  /** Action handler - receives selected items */
  handler: (items: T[]) => Promise<BulkActionResult>;
  
  /** Whether action is destructive (shows confirmation) */
  destructive?: boolean;
  
  /** Confirmation message for destructive actions */
  confirmMessage?: string | ((count: number) => string);
  
  /** Whether this action is currently available */
  available?: (items: T[]) => boolean;
  
  /** Keyboard shortcut */
  shortcut?: string;
  
  /** Category for grouping in menu */
  category?: string;
}

export interface BulkActionResult {
  success: boolean;
  message?: string;
  failedIds?: string[];
  successIds?: string[];
  undoAction?: () => Promise<void>;
}

export interface BulkSelectionState<T extends SelectableItem = SelectableItem> {
  /** Currently selected item IDs */
  selectedIds: Set<string>;
  
  /** All available items */
  items: T[];
  
  /** Last clicked item (for shift-click range) */
  lastClickedId: string | null;
  
  /** Selection mode */
  mode: 'none' | 'some' | 'all';
}

export interface BulkContextValue<T extends SelectableItem = SelectableItem> {
  // Selection state
  selectedIds: Set<string>;
  selectedItems: T[];
  selectionMode: 'none' | 'some' | 'all';
  
  // Selection actions
  select: (id: string, shiftKey?: boolean) => void;
  deselect: (id: string) => void;
  toggle: (id: string, shiftKey?: boolean) => void;
  selectAll: () => void;
  deselectAll: () => void;
  selectRange: (startId: string, endId: string) => void;
  isSelected: (id: string) => boolean;
  
  // Items
  setItems: (items: T[]) => void;
  
  // Actions
  actions: BulkAction<T>[];
  registerAction: (action: BulkAction<T>) => void;
  unregisterAction: (id: string) => void;
  executeAction: (actionId: string) => Promise<void>;
  
  // Progress
  isExecuting: boolean;
  progress: BulkProgress | null;
  
  // Undo
  undoStack: UndoEntry[];
  undo: () => Promise<void>;
  canUndo: boolean;
}

export interface BulkProgress {
  total: number;
  completed: number;
  failed: number;
  currentItem?: string;
  actionLabel: string;
}

export interface UndoEntry {
  actionId: string;
  actionLabel: string;
  itemCount: number;
  undoFn: () => Promise<void>;
  timestamp: number;
}

// ============================================================================
// Context
// ============================================================================

const BulkContext = createContext<BulkContextValue<SelectableItem> | null>(null);

export function useBulkActions<T extends SelectableItem = SelectableItem>() {
  const context = useContext(BulkContext);
  if (!context) {
    throw new Error('useBulkActions must be used within BulkActionsProvider');
  }
  return context as unknown as BulkContextValue<T>;
}

// ============================================================================
// Provider
// ============================================================================

interface BulkActionsProviderProps<T extends SelectableItem> {
  children: ReactNode;
  items?: T[];
  actions?: BulkAction<T>[];
  onSelectionChange?: (selectedIds: Set<string>) => void;
  maxUndo?: number;
}

export function BulkActionsProvider<T extends SelectableItem>({
  children,
  items: initialItems = [],
  actions: initialActions = [],
  onSelectionChange,
  maxUndo = 10,
}: BulkActionsProviderProps<T>) {
  const [items, setItems] = useState<T[]>(initialItems);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastClickedId, setLastClickedId] = useState<string | null>(null);
  const [actions, setActions] = useState<BulkAction<T>[]>(initialActions);
  const [isExecuting, setIsExecuting] = useState(false);
  const [progress, setProgress] = useState<BulkProgress | null>(null);
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);

  // Sync items with prop
  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  // Notify on selection change
  useEffect(() => {
    onSelectionChange?.(selectedIds);
  }, [selectedIds, onSelectionChange]);

  // Selected items helper
  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.has(item.id)),
    [items, selectedIds]
  );

  // Selection mode
  const selectionMode = useMemo<'none' | 'some' | 'all'>(() => {
    if (selectedIds.size === 0) return 'none';
    if (selectedIds.size === items.length) return 'all';
    return 'some';
  }, [selectedIds.size, items.length]);

  // Selection actions
  const select = useCallback(
    (id: string, shiftKey = false) => {
      if (shiftKey && lastClickedId) {
        // Range selection
        const startIndex = items.findIndex((i) => i.id === lastClickedId);
        const endIndex = items.findIndex((i) => i.id === id);
        
        if (startIndex !== -1 && endIndex !== -1) {
          const [from, to] = startIndex < endIndex 
            ? [startIndex, endIndex] 
            : [endIndex, startIndex];
          
          const rangeIds = items.slice(from, to + 1).map((i) => i.id);
          setSelectedIds((prev) => new Set([...prev, ...rangeIds]));
        }
      } else {
        setSelectedIds((prev) => new Set([...prev, id]));
      }
      setLastClickedId(id);
    },
    [items, lastClickedId]
  );

  const deselect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const toggle = useCallback(
    (id: string, shiftKey = false) => {
      if (selectedIds.has(id)) {
        deselect(id);
      } else {
        select(id, shiftKey);
      }
    },
    [selectedIds, select, deselect]
  );

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(items.map((i) => i.id)));
  }, [items]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
    setLastClickedId(null);
  }, []);

  const selectRange = useCallback(
    (startId: string, endId: string) => {
      const startIndex = items.findIndex((i) => i.id === startId);
      const endIndex = items.findIndex((i) => i.id === endId);
      
      if (startIndex !== -1 && endIndex !== -1) {
        const [from, to] = startIndex < endIndex 
          ? [startIndex, endIndex] 
          : [endIndex, startIndex];
        
        const rangeIds = items.slice(from, to + 1).map((i) => i.id);
        setSelectedIds(new Set(rangeIds));
      }
    },
    [items]
  );

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds]
  );

  // Action registration
  const registerAction = useCallback((action: BulkAction<T>) => {
    setActions((prev) => {
      const existing = prev.findIndex((a) => a.id === action.id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = action;
        return updated;
      }
      return [...prev, action];
    });
  }, []);

  const unregisterAction = useCallback((id: string) => {
    setActions((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // Execute action
  const executeAction = useCallback(
    async (actionId: string) => {
      const action = actions.find((a) => a.id === actionId);
      if (!action || selectedItems.length === 0) return;

      setIsExecuting(true);
      setProgress({
        total: selectedItems.length,
        completed: 0,
        failed: 0,
        actionLabel: action.label,
      });

      try {
        const result = await action.handler(selectedItems);

        if (result.success) {
          // Add to undo stack if undo action provided
          if (result.undoAction) {
            setUndoStack((prev) =>
              [
                {
                  actionId,
                  actionLabel: action.label,
                  itemCount: selectedItems.length,
                  undoFn: result.undoAction!,
                  timestamp: Date.now(),
                },
                ...prev,
              ].slice(0, maxUndo)
            );
          }

          // Clear selection after successful action
          deselectAll();
        }

        setProgress((prev) =>
          prev
            ? {
                ...prev,
                completed: result.successIds?.length ?? selectedItems.length,
                failed: result.failedIds?.length ?? 0,
              }
            : null
        );
      } catch (error) {
        console.error('Bulk action failed:', error);
        setProgress((prev) =>
          prev
            ? {
                ...prev,
                failed: selectedItems.length,
              }
            : null
        );
      } finally {
        setIsExecuting(false);
        // Clear progress after a delay
        setTimeout(() => setProgress(null), 2000);
      }
    },
    [actions, selectedItems, maxUndo, deselectAll]
  );

  // Undo
  const undo = useCallback(async () => {
    const entry = undoStack[0];
    if (!entry) return;

    setIsExecuting(true);
    try {
      await entry.undoFn();
      setUndoStack((prev) => prev.slice(1));
    } catch (error) {
      console.error('Undo failed:', error);
    } finally {
      setIsExecuting(false);
    }
  }, [undoStack]);

  const canUndo = undoStack.length > 0;

  const contextValue = useMemo<BulkContextValue<T>>(
    () => ({
      selectedIds,
      selectedItems,
      selectionMode,
      select,
      deselect,
      toggle,
      selectAll,
      deselectAll,
      selectRange,
      isSelected,
      setItems: setItems as (items: T[]) => void,
      actions,
      registerAction,
      unregisterAction,
      executeAction,
      isExecuting,
      progress,
      undoStack,
      undo,
      canUndo,
    }),
    [
      selectedIds,
      selectedItems,
      selectionMode,
      select,
      deselect,
      toggle,
      selectAll,
      deselectAll,
      selectRange,
      isSelected,
      actions,
      registerAction,
      unregisterAction,
      executeAction,
      isExecuting,
      progress,
      undoStack,
      undo,
      canUndo,
    ]
  );

  return (
    <BulkContext.Provider value={contextValue as unknown as BulkContextValue<SelectableItem>}>
      {children}
    </BulkContext.Provider>
  );
}

// ============================================================================
// Selection Checkbox Component
// ============================================================================

interface SelectionCheckboxProps {
  id: string;
  className?: string;
}

export function SelectionCheckbox({ id, className }: SelectionCheckboxProps) {
  const { isSelected, toggle } = useBulkActions();
  const selected = isSelected(id);

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        toggle(id, e.shiftKey);
      }}
      className={clsx(
        'flex items-center justify-center w-5 h-5 rounded',
        'border-2 transition-colors',
        selected
          ? 'bg-blue-600 border-blue-600 text-white'
          : 'border-gray-300 dark:border-gray-600 hover:border-blue-400',
        className
      )}
      aria-checked={selected}
      role="checkbox"
    >
      {selected && <CheckSquare className="h-3.5 w-3.5" />}
    </button>
  );
}

// ============================================================================
// Select All Checkbox
// ============================================================================

interface SelectAllCheckboxProps {
  className?: string;
}

export function SelectAllCheckbox({ className }: SelectAllCheckboxProps) {
  const { selectionMode, selectAll, deselectAll } = useBulkActions();

  const Icon = selectionMode === 'all' 
    ? CheckSquare 
    : selectionMode === 'some' 
    ? Minus 
    : Square;

  return (
    <button
      onClick={() => {
        if (selectionMode === 'all') {
          deselectAll();
        } else {
          selectAll();
        }
      }}
      className={clsx(
        'flex items-center justify-center w-5 h-5 rounded',
        'border-2 transition-colors',
        selectionMode !== 'none'
          ? 'bg-blue-600 border-blue-600 text-white'
          : 'border-gray-300 dark:border-gray-600 hover:border-blue-400',
        className
      )}
      aria-checked={selectionMode === 'all' ? true : selectionMode === 'some' ? 'mixed' : false}
      role="checkbox"
      title={selectionMode === 'all' ? 'Deselect all' : 'Select all'}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

// ============================================================================
// Floating Action Bar
// ============================================================================

interface FloatingActionBarProps {
  className?: string;
  position?: 'top' | 'bottom';
}

export function FloatingActionBar({ 
  className,
  position = 'bottom',
}: FloatingActionBarProps) {
  const {
    selectedIds,
    selectedItems,
    deselectAll,
    actions,
    executeAction,
    isExecuting,
    progress,
    canUndo,
    undo,
  } = useBulkActions();

  const [confirmAction, setConfirmAction] = useState<BulkAction | null>(null);
  const [showMore, setShowMore] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  // Close more menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setShowMore(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter available actions
  const availableActions = useMemo(
    () =>
      actions.filter(
        (action) => !action.available || action.available(selectedItems)
      ),
    [actions, selectedItems]
  );

  const primaryActions = availableActions.slice(0, 4);
  const moreActions = availableActions.slice(4);

  const handleActionClick = async (action: BulkAction) => {
    if (action.destructive) {
      setConfirmAction(action);
    } else {
      await executeAction(action.id);
    }
  };

  const handleConfirm = async () => {
    if (confirmAction) {
      await executeAction(confirmAction.id);
      setConfirmAction(null);
    }
  };

  if (selectedIds.size === 0) return null;

  return (
    <>
      {/* Floating bar */}
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: position === 'bottom' ? 20 : -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: position === 'bottom' ? 20 : -20 }}
          className={clsx(
            'fixed left-1/2 -translate-x-1/2 z-50',
            position === 'bottom' ? 'bottom-6' : 'top-20',
            'flex items-center gap-2 px-4 py-3',
            'bg-gray-900 dark:bg-gray-800',
            'rounded-xl shadow-2xl',
            'border border-gray-700',
            className
          )}
        >
          {/* Selection count */}
          <div className="flex items-center gap-2 pr-3 border-r border-gray-700">
            <span className="text-white font-medium">
              {selectedIds.size} selected
            </span>
            <button
              onClick={deselectAll}
              className="p-1 text-gray-400 hover:text-white rounded"
              title="Clear selection"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Progress indicator */}
          {progress && (
            <div className="flex items-center gap-2 px-3 border-r border-gray-700">
              {isExecuting ? (
                <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />
              ) : progress.failed > 0 ? (
                <AlertCircle className="h-4 w-4 text-red-400" />
              ) : (
                <CheckCircle className="h-4 w-4 text-green-400" />
              )}
              <span className="text-sm text-gray-300">
                {isExecuting
                  ? `${progress.actionLabel}... ${progress.completed}/${progress.total}`
                  : progress.failed > 0
                  ? `${progress.failed} failed`
                  : 'Complete!'}
              </span>
            </div>
          )}

          {/* Primary actions */}
          {!isExecuting && (
            <div className="flex items-center gap-1">
              {primaryActions.map((action) => {
                const Icon = action.icon ?? Edit3;
                return (
                  <button
                    key={action.id}
                    onClick={() => handleActionClick(action)}
                    className={clsx(
                      'flex items-center gap-2 px-3 py-1.5 rounded-lg',
                      'text-sm font-medium transition-colors',
                      action.destructive
                        ? 'text-red-400 hover:bg-red-900/30'
                        : 'text-gray-200 hover:bg-gray-700'
                    )}
                    title={action.shortcut ? `${action.label} (${action.shortcut})` : action.label}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{action.label}</span>
                  </button>
                );
              })}

              {/* More actions dropdown */}
              {moreActions.length > 0 && (
                <div ref={moreRef} className="relative">
                  <button
                    onClick={() => setShowMore(!showMore)}
                    className={clsx(
                      'flex items-center gap-1 px-2 py-1.5 rounded-lg',
                      'text-sm text-gray-200 hover:bg-gray-700'
                    )}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                    <ChevronDown className="h-3 w-3" />
                  </button>

                  <AnimatePresence>
                    {showMore && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        className={clsx(
                          'absolute right-0 mt-2 w-48',
                          position === 'bottom' ? 'bottom-full mb-2' : 'top-full',
                          'bg-gray-800 rounded-lg shadow-xl',
                          'border border-gray-700',
                          'py-1 overflow-hidden'
                        )}
                      >
                        {moreActions.map((action) => {
                          const Icon = action.icon ?? Edit3;
                          return (
                            <button
                              key={action.id}
                              onClick={() => {
                                setShowMore(false);
                                handleActionClick(action);
                              }}
                              className={clsx(
                                'w-full flex items-center gap-2 px-3 py-2',
                                'text-sm text-left',
                                action.destructive
                                  ? 'text-red-400 hover:bg-red-900/30'
                                  : 'text-gray-200 hover:bg-gray-700'
                              )}
                            >
                              <Icon className="h-4 w-4" />
                              {action.label}
                            </button>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Undo button */}
              {canUndo && (
                <button
                  onClick={undo}
                  className="flex items-center gap-2 px-3 py-1.5 ml-2 rounded-lg text-sm text-gray-200 hover:bg-gray-700 border-l border-gray-700 pl-3"
                  title="Undo last action"
                >
                  <Undo2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Undo</span>
                </button>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Confirmation dialog */}
      <AnimatePresence>
        {confirmAction && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
            onClick={() => setConfirmAction(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={clsx(
                'w-full max-w-md p-6',
                'bg-white dark:bg-gray-800',
                'rounded-xl shadow-2xl'
              )}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
                  <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Confirm {confirmAction.label}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    This action cannot be undone.
                  </p>
                </div>
              </div>

              <p className="text-gray-700 dark:text-gray-300 mb-6">
                {typeof confirmAction.confirmMessage === 'function'
                  ? confirmAction.confirmMessage(selectedIds.size)
                  : confirmAction.confirmMessage ??
                    `Are you sure you want to ${confirmAction.label.toLowerCase()} ${selectedIds.size} item${selectedIds.size === 1 ? '' : 's'}?`}
              </p>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setConfirmAction(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg"
                >
                  {confirmAction.label}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ============================================================================
// Common Bulk Actions
// ============================================================================

export function createDeleteAction<T extends SelectableItem>(
  onDelete: (ids: string[]) => Promise<{ success: boolean; failedIds?: string[] }>
): BulkAction<T> {
  return {
    id: 'delete',
    label: 'Delete',
    icon: Trash2,
    destructive: true,
    confirmMessage: (count) =>
      `Are you sure you want to delete ${count} item${count === 1 ? '' : 's'}? This action cannot be undone.`,
    handler: async (items) => {
      const ids = items.map((i) => i.id);
      const result = await onDelete(ids);
      return {
        success: result.success,
        failedIds: result.failedIds,
        successIds: ids.filter((id) => !result.failedIds?.includes(id)),
      };
    },
  };
}

export function createArchiveAction<T extends SelectableItem>(
  onArchive: (ids: string[]) => Promise<{ success: boolean; failedIds?: string[] }>,
  onUnarchive?: (ids: string[]) => Promise<void>
): BulkAction<T> {
  return {
    id: 'archive',
    label: 'Archive',
    icon: Archive,
    handler: async (items) => {
      const ids = items.map((i) => i.id);
      const result = await onArchive(ids);
      return {
        success: result.success,
        failedIds: result.failedIds,
        successIds: ids.filter((id) => !result.failedIds?.includes(id)),
        undoAction: onUnarchive ? () => onUnarchive(ids) : undefined,
      };
    },
  };
}

export function createExportAction<T extends SelectableItem>(
  onExport: (items: T[]) => Promise<void>
): BulkAction<T> {
  return {
    id: 'export',
    label: 'Export',
    icon: Download,
    handler: async (items) => {
      await onExport(items);
      return { success: true };
    },
  };
}

export function createDuplicateAction<T extends SelectableItem>(
  onDuplicate: (items: T[]) => Promise<{ success: boolean; newIds?: string[] }>
): BulkAction<T> {
  return {
    id: 'duplicate',
    label: 'Duplicate',
    icon: Copy,
    handler: async (items) => {
      const result = await onDuplicate(items);
      return {
        success: result.success,
        successIds: result.newIds,
      };
    },
  };
}

export function createEmailAction<T extends SelectableItem>(
  onEmail: (items: T[]) => Promise<void>
): BulkAction<T> {
  return {
    id: 'email',
    label: 'Send Email',
    icon: Mail,
    handler: async (items) => {
      await onEmail(items);
      return { success: true };
    },
  };
}

// ============================================================================
// Keyboard Shortcuts Hook
// ============================================================================

export function useBulkKeyboardShortcuts() {
  const { selectAll, deselectAll, executeAction, actions, undo, canUndo } = useBulkActions();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if in input field
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Ctrl/Cmd + A: Select all
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault();
        selectAll();
        return;
      }

      // Escape: Deselect all
      if (e.key === 'Escape') {
        deselectAll();
        return;
      }

      // Ctrl/Cmd + Z: Undo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && canUndo) {
        e.preventDefault();
        undo();
        return;
      }

      // Action shortcuts
      for (const action of actions) {
        if (action.shortcut) {
          const shortcut = action.shortcut.toLowerCase();
          const key = e.key.toLowerCase();
          
          // Simple key match (e.g., "Delete" or "d")
          if (shortcut === key) {
            e.preventDefault();
            executeAction(action.id);
            return;
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectAll, deselectAll, executeAction, actions, undo, canUndo]);
}

export default BulkActionsProvider;
