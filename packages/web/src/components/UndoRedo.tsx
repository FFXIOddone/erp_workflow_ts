/**
 * Undo/Redo System
 * 
 * Comprehensive undo/redo utilities for React applications.
 * Implements the Command pattern with history management, state snapshots,
 * and keyboard shortcuts integration.
 * 
 * @module UndoRedo
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
  createContext,
  useContext,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from 'react';
import clsx from 'clsx';
import { Undo2, Redo2, History, RotateCcw, Trash2 } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface Command<T = unknown> {
  /** Unique identifier */
  id: string;
  /** Human-readable description */
  description: string;
  /** Execute the command (do/redo) */
  execute: () => T | Promise<T>;
  /** Undo the command */
  undo: () => T | Promise<T>;
  /** Optional: Whether command can be merged with previous */
  canMerge?: (previous: Command) => boolean;
  /** Optional: Merge with previous command */
  merge?: (previous: Command) => Command<T>;
  /** Timestamp when command was executed */
  timestamp?: Date;
  /** Optional category for grouping */
  category?: string;
}

export interface HistoryEntry<T = unknown> {
  /** The command that was executed */
  command: Command<T>;
  /** State before command execution */
  stateBefore?: T;
  /** State after command execution */
  stateAfter?: T;
  /** When the command was executed */
  executedAt: Date;
}

export interface UndoRedoOptions {
  /** Maximum history size */
  maxHistory?: number;
  /** Whether to enable keyboard shortcuts */
  enableKeyboardShortcuts?: boolean;
  /** Custom key bindings */
  keyBindings?: {
    undo?: string;
    redo?: string;
  };
  /** Callback when undo is performed */
  onUndo?: (command: Command) => void;
  /** Callback when redo is performed */
  onRedo?: (command: Command) => void;
  /** Whether to merge consecutive similar commands */
  enableMerging?: boolean;
  /** Time window for merging (ms) */
  mergeWindow?: number;
}

// ============================================================================
// History Manager Context
// ============================================================================

interface HistoryManagerContextValue {
  /** Past commands (can be undone) */
  past: HistoryEntry[];
  /** Future commands (can be redone) */
  future: HistoryEntry[];
  /** Whether undo is available */
  canUndo: boolean;
  /** Whether redo is available */
  canRedo: boolean;
  /** Execute a new command */
  execute: <T>(command: Command<T>) => Promise<T>;
  /** Undo the last command */
  undo: () => Promise<void>;
  /** Redo the last undone command */
  redo: () => Promise<void>;
  /** Clear all history */
  clearHistory: () => void;
  /** Jump to a specific point in history */
  jumpTo: (index: number) => Promise<void>;
  /** Get history length */
  historyLength: number;
  /** Current position in history */
  currentPosition: number;
}

const HistoryManagerContext = createContext<HistoryManagerContextValue | null>(null);

export interface HistoryManagerProviderProps extends UndoRedoOptions {
  children: ReactNode;
}

/**
 * Provider for managing undo/redo history
 */
export function HistoryManagerProvider({
  children,
  maxHistory = 100,
  enableKeyboardShortcuts = true,
  keyBindings = { undo: 'ctrl+z', redo: 'ctrl+shift+z' },
  onUndo,
  onRedo,
  enableMerging = true,
  mergeWindow = 1000,
}: HistoryManagerProviderProps) {
  const [past, setPast] = useState<HistoryEntry[]>([]);
  const [future, setFuture] = useState<HistoryEntry[]>([]);
  const lastExecutionRef = useRef<Date | null>(null);

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  const execute = useCallback(
    async <T,>(command: Command<T>): Promise<T> => {
      const now = new Date();

      // Check if we should merge with the previous command
      if (
        enableMerging &&
        past.length > 0 &&
        lastExecutionRef.current &&
        now.getTime() - lastExecutionRef.current.getTime() < mergeWindow
      ) {
        const lastEntry = past[past.length - 1]!;
        if (command.canMerge?.(lastEntry.command as Command<T>) && command.merge) {
          const mergedCommand = command.merge(lastEntry.command as Command<T>);
          const result = await mergedCommand.execute();

          setPast((prev) => {
            const newPast = [...prev.slice(0, -1)];
            newPast.push({
              command: mergedCommand,
              stateAfter: result,
              executedAt: now,
            });
            return newPast.slice(-maxHistory);
          });

          lastExecutionRef.current = now;
          setFuture([]);
          return result as T;
        }
      }

      // Execute normally
      const result = await command.execute();

      const entry: HistoryEntry<T> = {
        command: { ...command, timestamp: now },
        stateAfter: result,
        executedAt: now,
      };

      setPast((prev) => [...prev, entry].slice(-maxHistory));
      setFuture([]);
      lastExecutionRef.current = now;

      return result;
    },
    [past, maxHistory, enableMerging, mergeWindow]
  );

  const undo = useCallback(async () => {
    if (!canUndo) return;

    const lastEntry = past[past.length - 1]!;
    await lastEntry.command.undo();

    setPast((prev) => prev.slice(0, -1));
    setFuture((prev) => [lastEntry, ...prev]);

    onUndo?.(lastEntry.command);
  }, [canUndo, past, onUndo]);

  const redo = useCallback(async () => {
    if (!canRedo) return;

    const nextEntry = future[0]!;
    await nextEntry.command.execute();

    setFuture((prev) => prev.slice(1));
    setPast((prev) => [...prev, nextEntry]);

    onRedo?.(nextEntry.command);
  }, [canRedo, future, onRedo]);

  const clearHistory = useCallback(() => {
    setPast([]);
    setFuture([]);
  }, []);

  const jumpTo = useCallback(
    async (index: number) => {
      const allEntries = [...past, ...future.slice().reverse()];
      const targetPosition = index;
      const currentPosition = past.length - 1;

      if (targetPosition === currentPosition) return;

      if (targetPosition < currentPosition) {
        // Need to undo
        const undoCount = currentPosition - targetPosition;
        for (let i = 0; i < undoCount; i++) {
          await undo();
        }
      } else {
        // Need to redo
        const redoCount = targetPosition - currentPosition;
        for (let i = 0; i < redoCount; i++) {
          await redo();
        }
      }
    },
    [past, future, undo, redo]
  );

  // Keyboard shortcuts
  useEffect(() => {
    if (!enableKeyboardShortcuts) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isUndo =
        (e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey;
      const isRedo =
        (e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey;

      if (isUndo) {
        e.preventDefault();
        undo();
      } else if (isRedo) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enableKeyboardShortcuts, undo, redo]);

  const value = useMemo(
    () => ({
      past,
      future,
      canUndo,
      canRedo,
      execute,
      undo,
      redo,
      clearHistory,
      jumpTo,
      historyLength: past.length + future.length,
      currentPosition: past.length - 1,
    }),
    [past, future, canUndo, canRedo, execute, undo, redo, clearHistory, jumpTo]
  );

  return (
    <HistoryManagerContext.Provider value={value}>
      {children}
    </HistoryManagerContext.Provider>
  );
}

/**
 * Hook to access the history manager
 */
export function useHistoryManager(): HistoryManagerContextValue {
  const context = useContext(HistoryManagerContext);
  if (!context) {
    throw new Error('useHistoryManager must be used within a HistoryManagerProvider');
  }
  return context;
}

// ============================================================================
// State-Based Undo/Redo Hook
// ============================================================================

export interface UseUndoRedoStateOptions<T> {
  /** Maximum history size */
  maxHistory?: number;
  /** Whether to enable keyboard shortcuts */
  enableKeyboardShortcuts?: boolean;
}

export interface UseUndoRedoStateResult<T> {
  /** Current state */
  state: T;
  /** Set state (adds to history) */
  setState: Dispatch<SetStateAction<T>>;
  /** Undo to previous state */
  undo: () => void;
  /** Redo to next state */
  redo: () => void;
  /** Whether undo is available */
  canUndo: boolean;
  /** Whether redo is available */
  canRedo: boolean;
  /** Reset to initial state and clear history */
  reset: (initialState?: T) => void;
  /** History of past states */
  past: T[];
  /** History of future states */
  future: T[];
}

/**
 * Hook for state with undo/redo capability
 * Simple alternative to the command-based approach
 */
export function useUndoRedoState<T>(
  initialState: T,
  options: UseUndoRedoStateOptions<T> = {}
): UseUndoRedoStateResult<T> {
  const { maxHistory = 50, enableKeyboardShortcuts = true } = options;

  const [past, setPast] = useState<T[]>([]);
  const [present, setPresent] = useState<T>(initialState);
  const [future, setFuture] = useState<T[]>([]);

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  const setState: Dispatch<SetStateAction<T>> = useCallback(
    (action) => {
      setPresent((prev) => {
        const next = typeof action === 'function'
          ? (action as (prev: T) => T)(prev)
          : action;

        if (next === prev) return prev;

        setPast((p) => [...p, prev].slice(-maxHistory));
        setFuture([]);

        return next;
      });
    },
    [maxHistory]
  );

  const undo = useCallback(() => {
    if (!canUndo) return;

    setPast((prev) => {
      const newPast = [...prev];
      const previous = newPast.pop()!;

      setFuture((f) => [present, ...f]);
      setPresent(previous);

      return newPast;
    });
  }, [canUndo, present]);

  const redo = useCallback(() => {
    if (!canRedo) return;

    setFuture((prev) => {
      const newFuture = [...prev];
      const next = newFuture.shift()!;

      setPast((p) => [...p, present]);
      setPresent(next);

      return newFuture;
    });
  }, [canRedo, present]);

  const reset = useCallback(
    (newInitialState?: T) => {
      setPast([]);
      setPresent(newInitialState ?? initialState);
      setFuture([]);
    },
    [initialState]
  );

  // Keyboard shortcuts
  useEffect(() => {
    if (!enableKeyboardShortcuts) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isUndo = (e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey;
      const isRedo = (e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey;

      if (isUndo && canUndo) {
        e.preventDefault();
        undo();
      } else if (isRedo && canRedo) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enableKeyboardShortcuts, undo, redo, canUndo, canRedo]);

  return {
    state: present,
    setState,
    undo,
    redo,
    canUndo,
    canRedo,
    reset,
    past,
    future,
  };
}

// ============================================================================
// Reducer-Based Undo/Redo Hook
// ============================================================================

type Reducer<S, A> = (state: S, action: A) => S;

export interface UseUndoRedoReducerResult<S, A> {
  state: S;
  dispatch: (action: A) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  reset: () => void;
}

/**
 * Hook for reducer with undo/redo capability
 */
export function useUndoRedoReducer<S, A>(
  reducer: Reducer<S, A>,
  initialState: S,
  maxHistory = 50
): UseUndoRedoReducerResult<S, A> {
  const [past, setPast] = useState<S[]>([]);
  const [present, setPresent] = useState<S>(initialState);
  const [future, setFuture] = useState<S[]>([]);

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  const dispatch = useCallback(
    (action: A) => {
      setPresent((prev) => {
        const next = reducer(prev, action);
        if (next === prev) return prev;

        setPast((p) => [...p, prev].slice(-maxHistory));
        setFuture([]);

        return next;
      });
    },
    [reducer, maxHistory]
  );

  const undo = useCallback(() => {
    if (!canUndo) return;

    setPast((prev) => {
      const newPast = [...prev];
      const previous = newPast.pop()!;

      setFuture((f) => [present, ...f]);
      setPresent(previous);

      return newPast;
    });
  }, [canUndo, present]);

  const redo = useCallback(() => {
    if (!canRedo) return;

    setFuture((prev) => {
      const newFuture = [...prev];
      const next = newFuture.shift()!;

      setPast((p) => [...p, present]);
      setPresent(next);

      return newFuture;
    });
  }, [canRedo, present]);

  const reset = useCallback(() => {
    setPast([]);
    setPresent(initialState);
    setFuture([]);
  }, [initialState]);

  return {
    state: present,
    dispatch,
    undo,
    redo,
    canUndo,
    canRedo,
    reset,
  };
}

// ============================================================================
// UI Components
// ============================================================================

export interface UndoRedoButtonsProps {
  /** Size of buttons */
  size?: 'sm' | 'md' | 'lg';
  /** Variant style */
  variant?: 'default' | 'outline' | 'ghost';
  /** Whether to show labels */
  showLabels?: boolean;
  /** Additional class names */
  className?: string;
  /** Custom undo handler (uses context if not provided) */
  onUndo?: () => void;
  /** Custom redo handler */
  onRedo?: () => void;
  /** Custom canUndo state */
  canUndo?: boolean;
  /** Custom canRedo state */
  canRedo?: boolean;
}

/**
 * Undo/Redo button pair component
 */
export function UndoRedoButtons({
  size = 'md',
  variant = 'default',
  showLabels = false,
  className,
  onUndo: customUndo,
  onRedo: customRedo,
  canUndo: customCanUndo,
  canRedo: customCanRedo,
}: UndoRedoButtonsProps) {
  const context = useContext(HistoryManagerContext);

  const handleUndo = customUndo || context?.undo;
  const handleRedo = customRedo || context?.redo;
  const canUndo = customCanUndo ?? context?.canUndo ?? false;
  const canRedo = customCanRedo ?? context?.canRedo ?? false;

  const sizeClasses = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-2.5',
  };

  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  const variantClasses = {
    default: 'bg-white border border-gray-300 hover:bg-gray-50',
    outline: 'border border-gray-300 hover:bg-gray-50',
    ghost: 'hover:bg-gray-100',
  };

  return (
    <div className={clsx('inline-flex items-center gap-1', className)}>
      <button
        type="button"
        onClick={handleUndo}
        disabled={!canUndo}
        className={clsx(
          'rounded transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1',
          sizeClasses[size],
          variantClasses[variant],
          !canUndo && 'opacity-50 cursor-not-allowed'
        )}
        title="Undo (Ctrl+Z)"
      >
        <Undo2 className={iconSizes[size]} />
        {showLabels && <span className="ml-1.5">Undo</span>}
      </button>

      <button
        type="button"
        onClick={handleRedo}
        disabled={!canRedo}
        className={clsx(
          'rounded transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1',
          sizeClasses[size],
          variantClasses[variant],
          !canRedo && 'opacity-50 cursor-not-allowed'
        )}
        title="Redo (Ctrl+Shift+Z)"
      >
        <Redo2 className={iconSizes[size]} />
        {showLabels && <span className="ml-1.5">Redo</span>}
      </button>
    </div>
  );
}

export interface HistoryListProps {
  /** Maximum items to show */
  maxItems?: number;
  /** Additional class names */
  className?: string;
  /** Whether to show timestamps */
  showTimestamps?: boolean;
}

/**
 * Component to display command history
 */
export function HistoryList({
  maxItems = 10,
  className,
  showTimestamps = true,
}: HistoryListProps) {
  const { past, future, currentPosition, jumpTo, clearHistory } = useHistoryManager();

  const allEntries = useMemo(() => {
    const entries: Array<{ entry: HistoryEntry; index: number; isCurrent: boolean }> = [];

    past.forEach((entry, i) => {
      entries.push({ entry, index: i, isCurrent: i === past.length - 1 });
    });

    future.forEach((entry, i) => {
      entries.push({ entry, index: past.length + i, isCurrent: false });
    });

    return entries.slice(-maxItems);
  }, [past, future, maxItems]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (allEntries.length === 0) {
    return (
      <div className={clsx('text-center py-8 text-gray-500', className)}>
        <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No history yet</p>
      </div>
    );
  }

  return (
    <div className={clsx('space-y-2', className)}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-gray-900">History</h4>
        <button
          onClick={clearHistory}
          className="text-xs text-gray-500 hover:text-red-500 flex items-center gap-1"
        >
          <Trash2 className="h-3 w-3" />
          Clear
        </button>
      </div>

      {allEntries.map(({ entry, index, isCurrent }) => (
        <button
          key={entry.command.id}
          onClick={() => jumpTo(index)}
          className={clsx(
            'w-full text-left p-3 rounded-lg border transition-colors',
            isCurrent
              ? 'border-primary-500 bg-primary-50'
              : 'border-gray-200 hover:border-gray-300 bg-white'
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-900 truncate">
              {entry.command.description}
            </span>
            {isCurrent && (
              <span className="text-xs bg-primary-500 text-white px-1.5 py-0.5 rounded">
                Current
              </span>
            )}
          </div>
          {showTimestamps && (
            <span className="text-xs text-gray-500">
              {formatTime(entry.executedAt)}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export interface UndoRedoToolbarProps {
  /** Whether to show history panel */
  showHistory?: boolean;
  /** Position of the toolbar */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'inline';
  /** Additional class names */
  className?: string;
}

/**
 * Full undo/redo toolbar with history panel
 */
export function UndoRedoToolbar({
  showHistory = false,
  position = 'inline',
  className,
}: UndoRedoToolbarProps) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const { canUndo, canRedo, undo, redo, past, future } = useHistoryManager();

  const positionClasses = {
    'top-left': 'fixed top-4 left-4',
    'top-right': 'fixed top-4 right-4',
    'bottom-left': 'fixed bottom-4 left-4',
    'bottom-right': 'fixed bottom-4 right-4',
    inline: '',
  };

  return (
    <div
      className={clsx(
        'inline-flex items-center gap-2 bg-white rounded-lg shadow-sm border border-gray-200 p-2',
        position !== 'inline' && 'z-50',
        positionClasses[position],
        className
      )}
    >
      <UndoRedoButtons
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        variant="ghost"
      />

      {showHistory && (
        <div className="relative">
          <button
            onClick={() => setHistoryOpen(!historyOpen)}
            className={clsx(
              'p-2 rounded hover:bg-gray-100 transition-colors relative',
              historyOpen && 'bg-gray-100'
            )}
            title="History"
          >
            <History className="h-5 w-5" />
            {(past.length + future.length) > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">
                {past.length + future.length}
              </span>
            )}
          </button>

          {historyOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setHistoryOpen(false)}
              />
              <div className="absolute top-full mt-2 right-0 w-72 max-h-80 overflow-auto bg-white rounded-lg shadow-xl border border-gray-200 z-20 p-3">
                <HistoryList />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Command Helpers
// ============================================================================

/**
 * Create a simple command from execute/undo functions
 */
export function createCommand<T>(
  description: string,
  execute: () => T | Promise<T>,
  undo: () => T | Promise<T>,
  options?: Partial<Command<T>>
): Command<T> {
  return {
    id: `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    description,
    execute,
    undo,
    ...options,
  };
}

/**
 * Create a state mutation command
 */
export function createStateCommand<T>(
  description: string,
  setState: Dispatch<SetStateAction<T>>,
  oldState: T,
  newState: T
): Command<T> {
  return createCommand(
    description,
    () => {
      setState(newState);
      return newState;
    },
    () => {
      setState(oldState);
      return oldState;
    }
  );
}

/**
 * Create a batch command that executes multiple commands
 */
export function batchCommands<T>(
  description: string,
  commands: Command<T>[]
): Command<T[]> {
  return createCommand(
    description,
    async () => {
      const results: T[] = [];
      for (const cmd of commands) {
        results.push(await cmd.execute());
      }
      return results;
    },
    async () => {
      const results: T[] = [];
      for (const cmd of commands.reverse()) {
        results.push(await cmd.undo());
      }
      return results.reverse();
    }
  );
}

// ============================================================================
// Snapshot-Based Undo/Redo
// ============================================================================

export interface UseSnapshotUndoOptions<T> {
  /** Function to create a snapshot of current state */
  createSnapshot: () => T;
  /** Function to restore a snapshot */
  restoreSnapshot: (snapshot: T) => void;
  /** Maximum snapshots to keep */
  maxSnapshots?: number;
}

export interface UseSnapshotUndoResult<T> {
  /** Take a snapshot of current state */
  takeSnapshot: (description?: string) => void;
  /** Undo to previous snapshot */
  undo: () => void;
  /** Redo to next snapshot */
  redo: () => void;
  /** Whether undo is available */
  canUndo: boolean;
  /** Whether redo is available */
  canRedo: boolean;
  /** Clear all snapshots */
  clear: () => void;
  /** Number of past snapshots */
  snapshotCount: number;
}

/**
 * Hook for snapshot-based undo/redo
 * Useful for complex state that's hard to reverse incrementally
 */
export function useSnapshotUndo<T>(
  options: UseSnapshotUndoOptions<T>
): UseSnapshotUndoResult<T> {
  const { createSnapshot, restoreSnapshot, maxSnapshots = 20 } = options;

  const [past, setPast] = useState<Array<{ snapshot: T; description?: string }>>([]);
  const [future, setFuture] = useState<Array<{ snapshot: T; description?: string }>>([]);

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  const takeSnapshot = useCallback(
    (description?: string) => {
      const snapshot = createSnapshot();
      setPast((prev) => [...prev, { snapshot, description }].slice(-maxSnapshots));
      setFuture([]);
    },
    [createSnapshot, maxSnapshots]
  );

  const undo = useCallback(() => {
    if (!canUndo) return;

    const currentSnapshot = createSnapshot();

    setPast((prev) => {
      const newPast = [...prev];
      const lastSnapshot = newPast.pop()!;

      restoreSnapshot(lastSnapshot.snapshot);
      setFuture((f) => [{ snapshot: currentSnapshot }, ...f]);

      return newPast;
    });
  }, [canUndo, createSnapshot, restoreSnapshot]);

  const redo = useCallback(() => {
    if (!canRedo) return;

    const currentSnapshot = createSnapshot();

    setFuture((prev) => {
      const newFuture = [...prev];
      const nextSnapshot = newFuture.shift()!;

      restoreSnapshot(nextSnapshot.snapshot);
      setPast((p) => [...p, { snapshot: currentSnapshot }]);

      return newFuture;
    });
  }, [canRedo, createSnapshot, restoreSnapshot]);

  const clear = useCallback(() => {
    setPast([]);
    setFuture([]);
  }, []);

  return {
    takeSnapshot,
    undo,
    redo,
    canUndo,
    canRedo,
    clear,
    snapshotCount: past.length,
  };
}
