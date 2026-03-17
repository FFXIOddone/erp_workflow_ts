/**
 * Clipboard Utilities
 * 
 * Comprehensive clipboard utilities for React applications.
 * Includes copy/paste hooks, clipboard history, and UI components.
 * 
 * @module Clipboard
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
} from 'react';
import clsx from 'clsx';
import { Check, Copy, Clipboard, ClipboardCheck, ClipboardX, X, Trash2 } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface ClipboardItem {
  /** Unique identifier */
  id: string;
  /** The copied content */
  content: string;
  /** MIME type of the content */
  type: 'text/plain' | 'text/html' | 'application/json' | string;
  /** Timestamp when copied */
  timestamp: Date;
  /** Optional label/description */
  label?: string;
  /** Source of the copy (component/feature name) */
  source?: string;
}

export interface ClipboardHistoryOptions {
  /** Maximum number of items to keep */
  maxItems?: number;
  /** Whether to persist to localStorage */
  persist?: boolean;
  /** Storage key for persistence */
  storageKey?: string;
  /** Whether to deduplicate identical items */
  deduplicate?: boolean;
}

export interface UseClipboardOptions {
  /** Timeout for copied state (ms) */
  timeout?: number;
  /** Callback on successful copy */
  onSuccess?: (text: string) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
  /** Whether to add to history */
  addToHistory?: boolean;
}

export interface UseClipboardResult {
  /** Whether the last copy was successful */
  copied: boolean;
  /** Error from last operation */
  error: Error | null;
  /** Copy text to clipboard */
  copy: (text: string) => Promise<boolean>;
  /** Read text from clipboard */
  paste: () => Promise<string | null>;
  /** Whether clipboard API is supported */
  isSupported: boolean;
}

// ============================================================================
// Clipboard History Context
// ============================================================================

interface ClipboardHistoryContextValue {
  history: ClipboardItem[];
  addToHistory: (content: string, type?: string, label?: string, source?: string) => void;
  removeFromHistory: (id: string) => void;
  clearHistory: () => void;
  copyFromHistory: (id: string) => Promise<boolean>;
}

const ClipboardHistoryContext = createContext<ClipboardHistoryContextValue | null>(null);

export interface ClipboardHistoryProviderProps extends ClipboardHistoryOptions {
  children: ReactNode;
}

/**
 * Provider for clipboard history management
 */
export function ClipboardHistoryProvider({
  children,
  maxItems = 50,
  persist = true,
  storageKey = 'erp-clipboard-history',
  deduplicate = true,
}: ClipboardHistoryProviderProps) {
  const [history, setHistory] = useState<ClipboardItem[]>(() => {
    if (persist && typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          return parsed.map((item: ClipboardItem) => ({
            ...item,
            timestamp: new Date(item.timestamp),
          }));
        }
      } catch {
        // Ignore parse errors
      }
    }
    return [];
  });

  // Persist to localStorage
  useEffect(() => {
    if (persist && typeof window !== 'undefined') {
      try {
        localStorage.setItem(storageKey, JSON.stringify(history));
      } catch {
        // Ignore storage errors
      }
    }
  }, [history, persist, storageKey]);

  const addToHistory = useCallback(
    (content: string, type = 'text/plain', label?: string, source?: string) => {
      setHistory((prev) => {
        // Remove duplicate if deduplication is enabled
        let filtered = prev;
        if (deduplicate) {
          filtered = prev.filter((item) => item.content !== content);
        }

        const newItem: ClipboardItem = {
          id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          content,
          type,
          timestamp: new Date(),
          label,
          source,
        };

        const newHistory = [newItem, ...filtered].slice(0, maxItems);
        return newHistory;
      });
    },
    [maxItems, deduplicate]
  );

  const removeFromHistory = useCallback((id: string) => {
    setHistory((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  const copyFromHistory = useCallback(async (id: string): Promise<boolean> => {
    const item = history.find((h) => h.id === id);
    if (!item) return false;

    try {
      await navigator.clipboard.writeText(item.content);
      // Move item to top of history
      setHistory((prev) => {
        const filtered = prev.filter((h) => h.id !== id);
        return [{ ...item, timestamp: new Date() }, ...filtered];
      });
      return true;
    } catch {
      return false;
    }
  }, [history]);

  const value = useMemo(
    () => ({
      history,
      addToHistory,
      removeFromHistory,
      clearHistory,
      copyFromHistory,
    }),
    [history, addToHistory, removeFromHistory, clearHistory, copyFromHistory]
  );

  return (
    <ClipboardHistoryContext.Provider value={value}>
      {children}
    </ClipboardHistoryContext.Provider>
  );
}

/**
 * Hook to access clipboard history
 */
export function useClipboardHistory(): ClipboardHistoryContextValue {
  const context = useContext(ClipboardHistoryContext);
  if (!context) {
    // Return a no-op implementation if not in provider
    return {
      history: [],
      addToHistory: () => {},
      removeFromHistory: () => {},
      clearHistory: () => {},
      copyFromHistory: async () => false,
    };
  }
  return context;
}

// ============================================================================
// Core Clipboard Hooks
// ============================================================================

/**
 * Check if Clipboard API is supported
 */
export function isClipboardSupported(): boolean {
  return typeof navigator !== 'undefined' && 'clipboard' in navigator;
}

/**
 * Hook for clipboard operations
 */
export function useClipboard(options: UseClipboardOptions = {}): UseClipboardResult {
  const {
    timeout = 2000,
    onSuccess,
    onError,
    addToHistory: shouldAddToHistory = true,
  } = options;

  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const { addToHistory } = useClipboardHistory();

  const isSupported = useMemo(() => isClipboardSupported(), []);

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      if (!isSupported) {
        const err = new Error('Clipboard API not supported');
        setError(err);
        onError?.(err);
        return false;
      }

      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setError(null);
        onSuccess?.(text);

        if (shouldAddToHistory) {
          addToHistory(text);
        }

        // Clear copied state after timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
          setCopied(false);
        }, timeout);

        return true;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Copy failed');
        setError(error);
        onError?.(error);
        return false;
      }
    },
    [isSupported, timeout, onSuccess, onError, shouldAddToHistory, addToHistory]
  );

  const paste = useCallback(async (): Promise<string | null> => {
    if (!isSupported) {
      const err = new Error('Clipboard API not supported');
      setError(err);
      onError?.(err);
      return null;
    }

    try {
      const text = await navigator.clipboard.readText();
      setError(null);
      return text;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Paste failed');
      setError(error);
      onError?.(error);
      return null;
    }
  }, [isSupported, onError]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    copied,
    error,
    copy,
    paste,
    isSupported,
  };
}

/**
 * Hook for copying a specific value
 */
export function useCopyToClipboard(
  value: string,
  options?: UseClipboardOptions
): [boolean, () => void] {
  const { copied, copy } = useClipboard(options);

  const handleCopy = useCallback(() => {
    copy(value);
  }, [copy, value]);

  return [copied, handleCopy];
}

/**
 * Hook for paste events
 */
export function usePasteEvent(
  callback: (text: string, event: ClipboardEvent) => void,
  element?: RefObject<HTMLElement>
): void {
  useEffect(() => {
    const target = element?.current || document;

    const handlePaste = (e: Event) => {
      const clipboardEvent = e as ClipboardEvent;
      const text = clipboardEvent.clipboardData?.getData('text/plain');
      if (text) {
        callback(text, clipboardEvent);
      }
    };

    target.addEventListener('paste', handlePaste);
    return () => target.removeEventListener('paste', handlePaste);
  }, [callback, element]);
}

type RefObject<T> = React.RefObject<T>;

// ============================================================================
// UI Components
// ============================================================================

export interface CopyButtonProps {
  /** Text to copy */
  text: string;
  /** Button label (shown when not copied) */
  label?: string;
  /** Label shown after successful copy */
  copiedLabel?: string;
  /** Button size */
  size?: 'sm' | 'md' | 'lg';
  /** Button variant */
  variant?: 'default' | 'ghost' | 'outline';
  /** Additional class names */
  className?: string;
  /** Callback on successful copy */
  onCopy?: () => void;
  /** Whether to show only icon */
  iconOnly?: boolean;
  /** Custom timeout for copied state */
  timeout?: number;
}

/**
 * Button component for copying text to clipboard
 */
export function CopyButton({
  text,
  label = 'Copy',
  copiedLabel = 'Copied!',
  size = 'md',
  variant = 'default',
  className,
  onCopy,
  iconOnly = false,
  timeout = 2000,
}: CopyButtonProps) {
  const { copied, copy } = useClipboard({ timeout });

  const handleClick = useCallback(async () => {
    const success = await copy(text);
    if (success) {
      onCopy?.();
    }
  }, [copy, text, onCopy]);

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  const iconSizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  const variantClasses = {
    default: 'bg-primary-500 text-white hover:bg-primary-600',
    ghost: 'bg-transparent hover:bg-gray-100 text-gray-700',
    outline: 'border border-gray-300 bg-white hover:bg-gray-50 text-gray-700',
  };

  const Icon = copied ? Check : Copy;

  return (
    <button
      type="button"
      onClick={handleClick}
      className={clsx(
        'inline-flex items-center gap-1.5 rounded font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
        sizeClasses[size],
        variantClasses[variant],
        copied && variant === 'default' && 'bg-green-500 hover:bg-green-600',
        copied && variant !== 'default' && 'text-green-600',
        className
      )}
      title={copied ? copiedLabel : label}
    >
      <Icon className={iconSizeClasses[size]} />
      {!iconOnly && <span>{copied ? copiedLabel : label}</span>}
    </button>
  );
}

export interface CopyToClipboardProps {
  /** Text to copy */
  text: string;
  /** Children to render (receives copy function and copied state) */
  children: (props: { copy: () => void; copied: boolean }) => ReactNode;
  /** Callback on successful copy */
  onCopy?: () => void;
  /** Timeout for copied state */
  timeout?: number;
}

/**
 * Render prop component for clipboard copy
 */
export function CopyToClipboard({
  text,
  children,
  onCopy,
  timeout = 2000,
}: CopyToClipboardProps) {
  const { copied, copy } = useClipboard({ timeout });

  const handleCopy = useCallback(async () => {
    const success = await copy(text);
    if (success) {
      onCopy?.();
    }
  }, [copy, text, onCopy]);

  return <>{children({ copy: handleCopy, copied })}</>;
}

export interface ClipboardHistoryListProps {
  /** Maximum items to show */
  maxItems?: number;
  /** Whether to show timestamps */
  showTimestamps?: boolean;
  /** Whether to show sources */
  showSources?: boolean;
  /** Callback when item is copied */
  onCopy?: (item: ClipboardItem) => void;
  /** Additional class names */
  className?: string;
  /** Empty state content */
  emptyState?: ReactNode;
}

/**
 * Component to display clipboard history
 */
export function ClipboardHistoryList({
  maxItems = 10,
  showTimestamps = true,
  showSources = false,
  onCopy,
  className,
  emptyState,
}: ClipboardHistoryListProps) {
  const { history, copyFromHistory, removeFromHistory, clearHistory } = useClipboardHistory();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const displayItems = useMemo(
    () => history.slice(0, maxItems),
    [history, maxItems]
  );

  const handleCopy = useCallback(
    async (item: ClipboardItem) => {
      const success = await copyFromHistory(item.id);
      if (success) {
        setCopiedId(item.id);
        setTimeout(() => setCopiedId(null), 2000);
        onCopy?.(item);
      }
    },
    [copyFromHistory, onCopy]
  );

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  if (displayItems.length === 0) {
    return (
      <div className={clsx('text-center py-8 text-gray-500', className)}>
        {emptyState || (
          <>
            <Clipboard className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No clipboard history</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className={clsx('space-y-2', className)}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-gray-900">Clipboard History</h4>
        <button
          onClick={clearHistory}
          className="text-xs text-gray-500 hover:text-red-500 flex items-center gap-1"
        >
          <Trash2 className="h-3 w-3" />
          Clear all
        </button>
      </div>

      {displayItems.map((item) => (
        <div
          key={item.id}
          className="group flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:border-gray-300 bg-white"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-900 truncate font-mono">
              {item.label || item.content.slice(0, 100)}
            </p>
            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
              {showTimestamps && <span>{formatTime(item.timestamp)}</span>}
              {showSources && item.source && (
                <>
                  <span>•</span>
                  <span>{item.source}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => handleCopy(item)}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
              title="Copy"
            >
              {copiedId === item.id ? (
                <ClipboardCheck className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
            <button
              onClick={() => removeFromHistory(item.id)}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-red-500"
              title="Remove"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}

      {history.length > maxItems && (
        <p className="text-xs text-center text-gray-500">
          +{history.length - maxItems} more items
        </p>
      )}
    </div>
  );
}

export interface ClipboardIndicatorProps {
  /** Position of the indicator */
  position?: 'top-right' | 'bottom-right' | 'top-left' | 'bottom-left';
  /** Additional class names */
  className?: string;
}

/**
 * Floating indicator showing clipboard activity
 */
export function ClipboardIndicator({
  position = 'bottom-right',
  className,
}: ClipboardIndicatorProps) {
  const { history } = useClipboardHistory();
  const [showPopup, setShowPopup] = useState(false);
  const [recentCopy, setRecentCopy] = useState<ClipboardItem | null>(null);

  // Track recent copies
  useEffect(() => {
    if (history.length > 0) {
      const latest = history[0];
      const isRecent = Date.now() - latest!.timestamp.getTime() < 3000;
      if (isRecent) {
        setRecentCopy(latest!);
        const timer = setTimeout(() => setRecentCopy(null), 3000);
        return () => clearTimeout(timer);
      }
    }
  }, [history]);

  const positionClasses = {
    'top-right': 'top-4 right-4',
    'bottom-right': 'bottom-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-left': 'bottom-4 left-4',
  };

  return (
    <div className={clsx('fixed z-50', positionClasses[position], className)}>
      {/* Recent copy notification */}
      {recentCopy && (
        <div className="mb-2 bg-green-500 text-white px-3 py-2 rounded-lg shadow-lg text-sm flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <ClipboardCheck className="h-4 w-4" />
          <span className="truncate max-w-xs">Copied!</span>
        </div>
      )}

      {/* History button */}
      <button
        onClick={() => setShowPopup(!showPopup)}
        className={clsx(
          'p-3 rounded-full bg-white shadow-lg border border-gray-200 hover:border-gray-300 transition-colors',
          history.length > 0 && 'ring-2 ring-primary-100'
        )}
        title="Clipboard History"
      >
        <Clipboard className="h-5 w-5 text-gray-600" />
        {history.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-primary-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
            {Math.min(history.length, 99)}
          </span>
        )}
      </button>

      {/* History popup */}
      {showPopup && (
        <>
          <div
            className="fixed inset-0 bg-black/20"
            onClick={() => setShowPopup(false)}
          />
          <div className="absolute bottom-full mb-2 right-0 w-80 max-h-96 overflow-auto bg-white rounded-lg shadow-xl border border-gray-200">
            <div className="p-3">
              <ClipboardHistoryList maxItems={5} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// Code Block Copy Component
// ============================================================================

export interface CodeBlockCopyProps {
  /** Code content */
  code: string;
  /** Language for syntax highlighting label */
  language?: string;
  /** Whether to show line numbers */
  showLineNumbers?: boolean;
  /** Additional class names */
  className?: string;
}

/**
 * Code block with copy button
 */
export function CodeBlockCopy({
  code,
  language,
  showLineNumbers = false,
  className,
}: CodeBlockCopyProps) {
  const { copied, copy } = useClipboard();

  const lines = code.split('\n');

  return (
    <div className={clsx('relative group', className)}>
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => copy(code)}
          className={clsx(
            'p-2 rounded bg-gray-700 hover:bg-gray-600 text-white transition-colors',
            copied && 'bg-green-600 hover:bg-green-600'
          )}
          title={copied ? 'Copied!' : 'Copy code'}
        >
          {copied ? (
            <Check className="h-4 w-4" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
      </div>

      <div className="bg-gray-900 rounded-lg overflow-hidden">
        {language && (
          <div className="px-4 py-2 bg-gray-800 text-gray-400 text-xs font-mono">
            {language}
          </div>
        )}
        <pre className="p-4 overflow-x-auto">
          <code className="text-gray-100 text-sm font-mono">
            {showLineNumbers
              ? lines.map((line, i) => (
                  <div key={i} className="flex">
                    <span className="text-gray-600 select-none w-8 flex-shrink-0 text-right mr-4">
                      {i + 1}
                    </span>
                    <span>{line}</span>
                  </div>
                ))
              : code}
          </code>
        </pre>
      </div>
    </div>
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Copy text to clipboard (standalone function)
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!isClipboardSupported()) {
    // Fallback for older browsers
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textArea);
      return success;
    } catch {
      return false;
    }
  }

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read text from clipboard (standalone function)
 */
export async function readFromClipboard(): Promise<string | null> {
  if (!isClipboardSupported()) {
    return null;
  }

  try {
    return await navigator.clipboard.readText();
  } catch {
    return null;
  }
}

/**
 * Check if clipboard contains text
 */
export async function hasClipboardText(): Promise<boolean> {
  const text = await readFromClipboard();
  return text !== null && text.length > 0;
}
