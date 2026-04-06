/**
 * Shortcuts.tsx - CRITICAL-24
 * 
 * Keyboard shortcut system for the ERP application.
 * Provides global shortcuts, command palette, and shortcut registration.
 * 
 * Features:
 * - 24.1: useKeyboardShortcut hook
 * - 24.2: Global shortcut registration
 * - 24.3: Shortcut scope management
 * - 24.4: Command palette component
 * - 24.5: Shortcut display helpers
 * 
 * @module Shortcuts
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { clsx } from 'clsx';
import { Command, Search, ArrowUp, ArrowDown, CornerDownLeft } from 'lucide-react';
import { scoreSearchText } from '@erp/shared';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/** Modifier keys */
export type ModifierKey = 'ctrl' | 'alt' | 'shift' | 'meta' | 'mod';

/** Key combination */
export interface KeyCombo {
  /** Main key (e.g., 'k', 'Enter', 'ArrowUp') */
  key: string;
  /** Modifier keys */
  modifiers?: ModifierKey[];
}

/** Shortcut definition */
export interface ShortcutDefinition {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Description */
  description?: string;
  /** Key combination(s) */
  keys: KeyCombo | KeyCombo[];
  /** Handler function */
  handler: (event: KeyboardEvent) => void;
  /** Category for grouping */
  category?: string;
  /** Whether shortcut is enabled */
  enabled?: boolean;
  /** Scope (global or specific element) */
  scope?: string;
  /** Prevent default browser behavior */
  preventDefault?: boolean;
  /** Stop propagation */
  stopPropagation?: boolean;
  /** Allow in input elements */
  allowInInput?: boolean;
}

/** Registered shortcut */
export interface RegisteredShortcut extends ShortcutDefinition {
  /** Registration order */
  order: number;
}

/** Shortcut context value */
export interface ShortcutContextValue {
  /** Register a shortcut */
  register: (shortcut: ShortcutDefinition) => () => void;
  /** Unregister a shortcut */
  unregister: (id: string) => void;
  /** Get all shortcuts */
  getShortcuts: () => RegisteredShortcut[];
  /** Get shortcuts by category */
  getShortcutsByCategory: () => Record<string, RegisteredShortcut[]>;
  /** Check if command palette is open */
  isPaletteOpen: boolean;
  /** Open command palette */
  openPalette: () => void;
  /** Close command palette */
  closePalette: () => void;
  /** Toggle command palette */
  togglePalette: () => void;
  /** Current scope */
  currentScope: string;
  /** Set current scope */
  setScope: (scope: string) => void;
}

/** Command palette props */
export interface CommandPaletteProps {
  /** Whether palette is open */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
  /** Placeholder text */
  placeholder?: string;
  /** Maximum height */
  maxHeight?: number;
  /** Custom filter function */
  filter?: (shortcuts: RegisteredShortcut[], query: string) => RegisteredShortcut[];
  /** Empty state message */
  emptyMessage?: string;
  /** Additional class */
  className?: string;
}

// ============================================================================
// UTILITIES
// ============================================================================

/** Detect if user is on Mac */
const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

/** Map 'mod' to platform-specific key */
export function resolveMod(modifier: ModifierKey): 'ctrl' | 'meta' {
  return modifier === 'mod' ? (isMac ? 'meta' : 'ctrl') : modifier as 'ctrl' | 'meta';
}

/** Check if event matches key combo */
export function matchesKeyCombo(event: KeyboardEvent, combo: KeyCombo): boolean {
  const { key, modifiers = [] } = combo;

  // Check main key (case-insensitive for letters)
  const eventKey = event.key.toLowerCase();
  const comboKey = key.toLowerCase();
  if (eventKey !== comboKey && event.code.toLowerCase() !== comboKey) {
    return false;
  }

  // Resolve modifiers
  const requiredCtrl = modifiers.some((m) => resolveMod(m) === 'ctrl');
  const requiredAlt = modifiers.includes('alt');
  const requiredShift = modifiers.includes('shift');
  const requiredMeta = modifiers.some((m) => resolveMod(m) === 'meta');

  // Check modifiers
  if (event.ctrlKey !== requiredCtrl) return false;
  if (event.altKey !== requiredAlt) return false;
  if (event.shiftKey !== requiredShift) return false;
  if (event.metaKey !== requiredMeta) return false;

  return true;
}

/** Check if event matches any key combo */
export function matchesShortcut(event: KeyboardEvent, shortcut: ShortcutDefinition): boolean {
  const combos = Array.isArray(shortcut.keys) ? shortcut.keys : [shortcut.keys];
  return combos.some((combo) => matchesKeyCombo(event, combo));
}

/** Format key combo for display */
export function formatKeyCombo(combo: KeyCombo): string {
  const { key, modifiers = [] } = combo;
  const parts: string[] = [];

  // Sort modifiers for consistent display
  const sortOrder: ModifierKey[] = ['ctrl', 'alt', 'shift', 'meta', 'mod'];
  const sortedModifiers = [...modifiers].sort(
    (a, b) => sortOrder.indexOf(a) - sortOrder.indexOf(b)
  );

  for (const mod of sortedModifiers) {
    if (mod === 'mod') {
      parts.push(isMac ? '⌘' : 'Ctrl');
    } else if (mod === 'ctrl') {
      parts.push(isMac ? '⌃' : 'Ctrl');
    } else if (mod === 'alt') {
      parts.push(isMac ? '⌥' : 'Alt');
    } else if (mod === 'shift') {
      parts.push(isMac ? '⇧' : 'Shift');
    } else if (mod === 'meta') {
      parts.push(isMac ? '⌘' : 'Win');
    }
  }

  // Format key name
  const keyDisplay = formatKeyName(key);
  parts.push(keyDisplay);

  return parts.join(isMac ? '' : '+');
}

/** Format key name for display */
export function formatKeyName(key: string): string {
  const keyMap: Record<string, string> = {
    ' ': 'Space',
    'ArrowUp': '↑',
    'ArrowDown': '↓',
    'ArrowLeft': '←',
    'ArrowRight': '→',
    'Enter': isMac ? '↵' : 'Enter',
    'Escape': isMac ? 'Esc' : 'Esc',
    'Backspace': isMac ? '⌫' : 'Backspace',
    'Delete': isMac ? '⌦' : 'Del',
    'Tab': isMac ? '⇥' : 'Tab',
  };

  if (keyMap[key]) return keyMap[key];
  if (key.length === 1) return key.toUpperCase();
  return key;
}

/** Check if focus is in an input element */
export function isInputElement(element: Element | null): boolean {
  if (!element) return false;

  const tagName = element.tagName.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
    return true;
  }

  if (element.getAttribute('contenteditable') === 'true') {
    return true;
  }

  return false;
}

// ============================================================================
// 24.1: KEYBOARD SHORTCUT HOOK
// ============================================================================

/** UseKeyboardShortcut options */
export interface UseKeyboardShortcutOptions {
  /** Key combination */
  keys: KeyCombo | KeyCombo[];
  /** Handler function */
  handler: (event: KeyboardEvent) => void;
  /** Whether shortcut is enabled */
  enabled?: boolean;
  /** Prevent default */
  preventDefault?: boolean;
  /** Stop propagation */
  stopPropagation?: boolean;
  /** Allow in input elements */
  allowInInput?: boolean;
  /** Event type (keydown or keyup) */
  eventType?: 'keydown' | 'keyup';
  /** Target element (defaults to window) */
  target?: React.RefObject<HTMLElement> | HTMLElement | null;
}

/**
 * Hook for handling keyboard shortcuts
 * 
 * @example
 * ```tsx
 * useKeyboardShortcut({
 *   keys: { key: 'k', modifiers: ['mod'] },
 *   handler: () => openSearch(),
 * });
 * 
 * // Multiple key combos
 * useKeyboardShortcut({
 *   keys: [
 *     { key: 's', modifiers: ['mod'] },
 *     { key: 's', modifiers: ['mod', 'shift'] },
 *   ],
 *   handler: () => save(),
 * });
 * ```
 */
export function useKeyboardShortcut(options: UseKeyboardShortcutOptions): void {
  const {
    keys,
    handler,
    enabled = true,
    preventDefault = true,
    stopPropagation = false,
    allowInInput = false,
    eventType = 'keydown',
    target,
  } = options;

  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyboard = (event: KeyboardEvent) => {
      // Check if we should ignore (focus in input)
      if (!allowInInput && isInputElement(document.activeElement)) {
        return;
      }

      const combos = Array.isArray(keys) ? keys : [keys];
      const matched = combos.some((combo) => matchesKeyCombo(event, combo));

      if (matched) {
        if (preventDefault) event.preventDefault();
        if (stopPropagation) event.stopPropagation();
        handlerRef.current(event);
      }
    };

    const targetElement = target
      ? 'current' in target
        ? target.current
        : target
      : window;

    if (targetElement) {
      targetElement.addEventListener(eventType, handleKeyboard as EventListener);

      return () => {
        targetElement.removeEventListener(eventType, handleKeyboard as EventListener);
      };
    }
  }, [keys, enabled, preventDefault, stopPropagation, allowInInput, eventType, target]);
}

// ============================================================================
// 24.2-24.3: SHORTCUT CONTEXT & PROVIDER
// ============================================================================

const ShortcutContext = createContext<ShortcutContextValue | null>(null);

/**
 * Hook to access shortcut context
 */
export function useShortcuts(): ShortcutContextValue {
  const context = useContext(ShortcutContext);
  if (!context) {
    throw new Error('useShortcuts must be used within a ShortcutProvider');
  }
  return context;
}

/** Shortcut provider props */
export interface ShortcutProviderProps {
  children: ReactNode;
  /** Default scope */
  defaultScope?: string;
  /** Command palette shortcut */
  paletteShortcut?: KeyCombo;
}

let shortcutOrder = 0;

/**
 * Provider for global keyboard shortcuts
 * 
 * @example
 * ```tsx
 * <ShortcutProvider>
 *   <App />
 * </ShortcutProvider>
 * ```
 */
export function ShortcutProvider({
  children,
  defaultScope = 'global',
  paletteShortcut = { key: 'k', modifiers: ['mod'] },
}: ShortcutProviderProps) {
  const [shortcuts, setShortcuts] = useState<Map<string, RegisteredShortcut>>(new Map());
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [currentScope, setCurrentScope] = useState(defaultScope);

  // Register shortcut
  const register = useCallback((shortcut: ShortcutDefinition): (() => void) => {
    const registered: RegisteredShortcut = {
      ...shortcut,
      order: shortcutOrder++,
    };

    setShortcuts((prev) => {
      const next = new Map(prev);
      next.set(shortcut.id, registered);
      return next;
    });

    return () => {
      setShortcuts((prev) => {
        const next = new Map(prev);
        next.delete(shortcut.id);
        return next;
      });
    };
  }, []);

  // Unregister shortcut
  const unregister = useCallback((id: string) => {
    setShortcuts((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // Get all shortcuts
  const getShortcuts = useCallback((): RegisteredShortcut[] => {
    return Array.from(shortcuts.values()).sort((a, b) => a.order - b.order);
  }, [shortcuts]);

  // Get shortcuts by category
  const getShortcutsByCategory = useCallback((): Record<string, RegisteredShortcut[]> => {
    const result: Record<string, RegisteredShortcut[]> = {};

    shortcuts.forEach((shortcut) => {
      const category = shortcut.category || 'General';
      if (!result[category]) result[category] = [];
      result[category].push(shortcut);
    });

    // Sort within categories
    Object.values(result).forEach((arr) => {
      arr.sort((a, b) => a.order - b.order);
    });

    return result;
  }, [shortcuts]);

  // Palette controls
  const openPalette = useCallback(() => setIsPaletteOpen(true), []);
  const closePalette = useCallback(() => setIsPaletteOpen(false), []);
  const togglePalette = useCallback(() => setIsPaletteOpen((prev) => !prev), []);

  // Global keyboard handler
  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      // Check palette shortcut
      if (matchesKeyCombo(event, paletteShortcut)) {
        event.preventDefault();
        togglePalette();
        return;
      }

      // Check registered shortcuts
      for (const shortcut of shortcuts.values()) {
        // Check if enabled
        if (shortcut.enabled === false) continue;

        // Check scope
        if (shortcut.scope && shortcut.scope !== currentScope && shortcut.scope !== 'global') {
          continue;
        }

        // Check if in input
        if (!shortcut.allowInInput && isInputElement(document.activeElement)) {
          continue;
        }

        // Check if matches
        if (matchesShortcut(event, shortcut)) {
          if (shortcut.preventDefault !== false) event.preventDefault();
          if (shortcut.stopPropagation) event.stopPropagation();
          shortcut.handler(event);
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [shortcuts, currentScope, paletteShortcut, togglePalette]);

  const value = useMemo<ShortcutContextValue>(
    () => ({
      register,
      unregister,
      getShortcuts,
      getShortcutsByCategory,
      isPaletteOpen,
      openPalette,
      closePalette,
      togglePalette,
      currentScope,
      setScope: setCurrentScope,
    }),
    [
      register,
      unregister,
      getShortcuts,
      getShortcutsByCategory,
      isPaletteOpen,
      openPalette,
      closePalette,
      togglePalette,
      currentScope,
    ]
  );

  return (
    <ShortcutContext.Provider value={value}>
      {children}
      {isPaletteOpen && (
        <CommandPalette isOpen={isPaletteOpen} onClose={closePalette} />
      )}
    </ShortcutContext.Provider>
  );
}

// ============================================================================
// 24.4: COMMAND PALETTE
// ============================================================================

/**
 * Command palette component
 * 
 * @example
 * ```tsx
 * <CommandPalette
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 * />
 * ```
 */
export function CommandPalette({
  isOpen,
  onClose,
  placeholder = 'Type a command or search...',
  maxHeight = 400,
  filter: customFilter,
  emptyMessage = 'No commands found',
  className,
}: CommandPaletteProps) {
  const { getShortcutsByCategory, getShortcuts } = useShortcuts();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Get filtered shortcuts
  const filteredShortcuts = useMemo(() => {
    const all = getShortcuts().filter((s) => s.enabled !== false);

    if (!query.trim()) return all;

    if (customFilter) {
      return customFilter(all, query);
    }

    return all.filter(
      (shortcut) =>
        scoreSearchText(
          `${shortcut.name} ${shortcut.description ?? ''} ${shortcut.category ?? ''}`,
          query,
        ) > 0,
    );
  }, [getShortcuts, query, customFilter]);

  // Group by category
  const groupedShortcuts = useMemo(() => {
    const result: Record<string, RegisteredShortcut[]> = {};

    filteredShortcuts.forEach((shortcut) => {
      const category = shortcut.category || 'General';
      if (!result[category]) result[category] = [];
      result[category].push(shortcut);
    });

    return result;
  }, [filteredShortcuts]);

  // Flatten for navigation
  const flatShortcuts = useMemo(() => filteredShortcuts, [filteredShortcuts]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;

    const selectedItem = listRef.current.querySelector('[data-selected="true"]');
    if (selectedItem) {
      selectedItem.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Handle keyboard navigation
  const handleKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, flatShortcuts.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (flatShortcuts[selectedIndex]) {
          flatShortcuts[selectedIndex].handler(e.nativeEvent as unknown as KeyboardEvent);
          onClose();
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  };

  // Execute shortcut
  const executeShortcut = (shortcut: RegisteredShortcut) => {
    shortcut.handler(new KeyboardEvent('keydown'));
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-[9998]"
        onClick={onClose}
      />

      {/* Palette */}
      <div
        className={clsx(
          'fixed top-1/4 left-1/2 -translate-x-1/2 w-full max-w-lg z-[9999]',
          'bg-white dark:bg-gray-800 rounded-xl shadow-2xl',
          'border border-gray-200 dark:border-gray-700',
          'overflow-hidden',
          className
        )}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 bg-transparent border-none outline-none text-gray-900 dark:text-white placeholder:text-gray-400"
          />
          <kbd className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded text-gray-500">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          className="overflow-y-auto"
          style={{ maxHeight }}
        >
          {flatShortcuts.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500">
              {emptyMessage}
            </div>
          ) : (
            Object.entries(groupedShortcuts).map(([category, shortcuts]) => (
              <div key={category}>
                <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50 dark:bg-gray-900">
                  {category}
                </div>
                {shortcuts.map((shortcut) => {
                  const globalIndex = flatShortcuts.indexOf(shortcut);
                  const isSelected = globalIndex === selectedIndex;

                  return (
                    <button
                      key={shortcut.id}
                      type="button"
                      data-selected={isSelected}
                      onClick={() => executeShortcut(shortcut)}
                      onMouseEnter={() => setSelectedIndex(globalIndex)}
                      className={clsx(
                        'w-full flex items-center justify-between px-4 py-3 text-left',
                        'transition-colors',
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-900/30'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {shortcut.name}
                        </div>
                        {shortcut.description && (
                          <div className="text-xs text-gray-500 truncate">
                            {shortcut.description}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 ml-4">
                        <ShortcutKeys
                          keys={Array.isArray(shortcut.keys) ? shortcut.keys[0] : shortcut.keys}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <ArrowUp className="w-3 h-3" />
              <ArrowDown className="w-3 h-3" />
              to navigate
            </span>
            <span className="flex items-center gap-1">
              <CornerDownLeft className="w-3 h-3" />
              to select
            </span>
          </div>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">Esc</kbd>
            to close
          </span>
        </div>
      </div>
    </>
  );
}

// ============================================================================
// 24.5: SHORTCUT DISPLAY COMPONENTS
// ============================================================================

/** Shortcut keys display props */
export interface ShortcutKeysProps {
  /** Key combination */
  keys: KeyCombo;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Additional class */
  className?: string;
}

/**
 * Display keyboard shortcut keys
 * 
 * @example
 * ```tsx
 * <ShortcutKeys keys={{ key: 'k', modifiers: ['mod'] }} />
 * // Renders: ⌘K (Mac) or Ctrl+K (Windows)
 * ```
 */
export function ShortcutKeys({ keys, size = 'sm', className }: ShortcutKeysProps) {
  const { key, modifiers = [] } = keys;

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5 gap-0.5',
    md: 'text-sm px-2 py-1 gap-1',
    lg: 'text-base px-2.5 py-1.5 gap-1.5',
  };

  const parts: string[] = [];

  // Add modifiers
  const sortOrder: ModifierKey[] = ['ctrl', 'alt', 'shift', 'meta', 'mod'];
  const sortedModifiers = [...modifiers].sort(
    (a, b) => sortOrder.indexOf(a) - sortOrder.indexOf(b)
  );

  for (const mod of sortedModifiers) {
    if (mod === 'mod') {
      parts.push(isMac ? '⌘' : 'Ctrl');
    } else if (mod === 'ctrl') {
      parts.push(isMac ? '⌃' : 'Ctrl');
    } else if (mod === 'alt') {
      parts.push(isMac ? '⌥' : 'Alt');
    } else if (mod === 'shift') {
      parts.push(isMac ? '⇧' : 'Shift');
    } else if (mod === 'meta') {
      parts.push(isMac ? '⌘' : 'Win');
    }
  }

  parts.push(formatKeyName(key));

  if (isMac) {
    // Mac style: all in one box
    return (
      <kbd
        className={clsx(
          'inline-flex items-center font-mono rounded',
          'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
          'border border-gray-200 dark:border-gray-600',
          sizeClasses[size],
          className
        )}
      >
        {parts.join('')}
      </kbd>
    );
  }

  // Windows/Linux style: separate boxes
  return (
    <span className={clsx('inline-flex items-center', sizeClasses[size], className)}>
      {parts.map((part, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="text-gray-400 mx-0.5">+</span>}
          <kbd
            className={clsx(
              'font-mono rounded',
              'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
              'border border-gray-200 dark:border-gray-600',
              'px-1.5 py-0.5'
            )}
          >
            {part}
          </kbd>
        </React.Fragment>
      ))}
    </span>
  );
}

/** Shortcut hint props */
export interface ShortcutHintProps {
  /** Key combination */
  keys: KeyCombo;
  /** Additional class */
  className?: string;
}

/**
 * Inline shortcut hint (for tooltips, buttons, etc.)
 */
export function ShortcutHint({ keys, className }: ShortcutHintProps) {
  return (
    <span className={clsx('text-gray-400 text-xs ml-2', className)}>
      {formatKeyCombo(keys)}
    </span>
  );
}

// ============================================================================
// HELPER HOOKS
// ============================================================================

/**
 * Hook to register a shortcut in the global registry
 * 
 * @example
 * ```tsx
 * useRegisterShortcut({
 *   id: 'save',
 *   name: 'Save',
 *   keys: { key: 's', modifiers: ['mod'] },
 *   handler: () => save(),
 *   category: 'File',
 * });
 * ```
 */
export function useRegisterShortcut(shortcut: ShortcutDefinition): void {
  const { register } = useShortcuts();

  useEffect(() => {
    return register(shortcut);
  }, [register, shortcut.id]); // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * Hook for common shortcuts (Escape to close, etc.)
 */
export function useEscapeKey(
  handler: () => void,
  enabled: boolean = true
): void {
  useKeyboardShortcut({
    keys: { key: 'Escape' },
    handler,
    enabled,
    allowInInput: true,
  });
}

/**
 * Hook for Enter key handling
 */
export function useEnterKey(
  handler: () => void,
  enabled: boolean = true,
  allowInInput: boolean = false
): void {
  useKeyboardShortcut({
    keys: { key: 'Enter' },
    handler,
    enabled,
    allowInInput,
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

// Types are exported inline at their definitions
