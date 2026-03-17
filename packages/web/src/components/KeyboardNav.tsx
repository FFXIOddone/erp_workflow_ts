/**
 * Keyboard Navigation Utilities
 * 
 * Provides consistent keyboard navigation patterns:
 * - useKeyboardNavigation: Arrow key navigation for lists
 * - useHotkey: Single hotkey handler
 * - useKeyboardShortcuts: Multiple shortcut registration
 * - KeyboardHint: Visual shortcut indicators
 * 
 * @example
 * // List navigation
 * const { activeIndex, handleKeyDown } = useKeyboardNavigation(items.length);
 * 
 * // Hotkey
 * useHotkey('ctrl+s', handleSave);
 */

import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
} from 'react';
import { clsx } from 'clsx';

// ============================================================================
// Types
// ============================================================================

interface KeyboardShortcut {
  key: string;
  modifiers?: {
    ctrl?: boolean;
    alt?: boolean;
    shift?: boolean;
    meta?: boolean;
  };
  handler: (event: KeyboardEvent) => void;
  description?: string;
  preventDefault?: boolean;
}

interface NavigationOptions {
  loop?: boolean;
  orientation?: 'vertical' | 'horizontal' | 'both';
  onSelect?: (index: number) => void;
  onEscape?: () => void;
  initialIndex?: number;
}

type Modifier = 'ctrl' | 'alt' | 'shift' | 'meta' | 'cmd';

// ============================================================================
// Key Parsing Utilities
// ============================================================================

function parseKeyCombo(combo: string): { key: string; modifiers: KeyboardShortcut['modifiers'] } {
  const parts = combo.toLowerCase().split('+');
  const key = parts.pop() || '';
  const modifiers: KeyboardShortcut['modifiers'] = {};
  
  for (const part of parts) {
    if (part === 'ctrl' || part === 'control') modifiers.ctrl = true;
    if (part === 'alt' || part === 'option') modifiers.alt = true;
    if (part === 'shift') modifiers.shift = true;
    if (part === 'meta' || part === 'cmd' || part === 'command') modifiers.meta = true;
  }
  
  return { key, modifiers };
}

function matchesShortcut(event: KeyboardEvent, shortcut: KeyboardShortcut): boolean {
  const { key, modifiers = {} } = shortcut;
  
  // Check key (case-insensitive for letters)
  const eventKey = event.key.toLowerCase();
  const shortcutKey = key.toLowerCase();
  
  // Handle special keys
  const keyMatches = eventKey === shortcutKey || 
    (shortcutKey === 'escape' && eventKey === 'escape') ||
    (shortcutKey === 'enter' && eventKey === 'enter') ||
    (shortcutKey === 'space' && (eventKey === ' ' || eventKey === 'spacebar')) ||
    (shortcutKey === 'delete' && (eventKey === 'delete' || eventKey === 'backspace'));
  
  if (!keyMatches) return false;
  
  // Check modifiers
  if (modifiers.ctrl && !event.ctrlKey) return false;
  if (modifiers.alt && !event.altKey) return false;
  if (modifiers.shift && !event.shiftKey) return false;
  if (modifiers.meta && !event.metaKey) return false;
  
  // Ensure we don't match if extra modifiers are pressed
  if (!modifiers.ctrl && event.ctrlKey) return false;
  if (!modifiers.alt && event.altKey) return false;
  if (!modifiers.shift && event.shiftKey) return false;
  if (!modifiers.meta && event.metaKey) return false;
  
  return true;
}

// ============================================================================
// useHotkey Hook
// ============================================================================

export function useHotkey(
  keyCombo: string,
  handler: () => void,
  options: { enabled?: boolean; preventDefault?: boolean } = {}
) {
  const { enabled = true, preventDefault = true } = options;
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  
  useEffect(() => {
    if (!enabled) return;
    
    const { key, modifiers } = parseKeyCombo(keyCombo);
    
    const handleKeyDown = (event: KeyboardEvent) => {
      if (matchesShortcut(event, { key, modifiers, handler: () => {} })) {
        if (preventDefault) {
          event.preventDefault();
        }
        handlerRef.current();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [keyCombo, enabled, preventDefault]);
}

// ============================================================================
// useKeyboardShortcuts Hook
// ============================================================================

export function useKeyboardShortcuts(
  shortcuts: Array<{
    combo: string;
    handler: () => void;
    description?: string;
    when?: boolean;
  }>,
  options: { enabled?: boolean } = {}
) {
  const { enabled = true } = options;
  const handlersRef = useRef(shortcuts);
  handlersRef.current = shortcuts;
  
  useEffect(() => {
    if (!enabled) return;
    
    const handleKeyDown = (event: KeyboardEvent) => {
      for (const shortcut of handlersRef.current) {
        if (shortcut.when === false) continue;
        
        const { key, modifiers } = parseKeyCombo(shortcut.combo);
        if (matchesShortcut(event, { key, modifiers, handler: () => {} })) {
          event.preventDefault();
          shortcut.handler();
          return;
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled]);
  
  // Return descriptions for help display
  return shortcuts.map(s => ({
    combo: s.combo,
    description: s.description,
  }));
}

// ============================================================================
// useKeyboardNavigation Hook
// ============================================================================

export function useKeyboardNavigation(
  itemCount: number,
  options: NavigationOptions = {}
) {
  const {
    loop = true,
    orientation = 'vertical',
    onSelect,
    onEscape,
    initialIndex = 0,
  } = options;
  
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const containerRef = useRef<HTMLElement>(null);
  
  // Clamp index when itemCount changes
  useEffect(() => {
    if (activeIndex >= itemCount) {
      setActiveIndex(Math.max(0, itemCount - 1));
    }
  }, [itemCount, activeIndex]);
  
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    const isVertical = orientation === 'vertical' || orientation === 'both';
    const isHorizontal = orientation === 'horizontal' || orientation === 'both';
    
    let newIndex = activeIndex;
    let handled = false;
    
    switch (event.key) {
      case 'ArrowUp':
        if (isVertical) {
          newIndex = loop
            ? (activeIndex - 1 + itemCount) % itemCount
            : Math.max(0, activeIndex - 1);
          handled = true;
        }
        break;
      case 'ArrowDown':
        if (isVertical) {
          newIndex = loop
            ? (activeIndex + 1) % itemCount
            : Math.min(itemCount - 1, activeIndex + 1);
          handled = true;
        }
        break;
      case 'ArrowLeft':
        if (isHorizontal) {
          newIndex = loop
            ? (activeIndex - 1 + itemCount) % itemCount
            : Math.max(0, activeIndex - 1);
          handled = true;
        }
        break;
      case 'ArrowRight':
        if (isHorizontal) {
          newIndex = loop
            ? (activeIndex + 1) % itemCount
            : Math.min(itemCount - 1, activeIndex + 1);
          handled = true;
        }
        break;
      case 'Home':
        newIndex = 0;
        handled = true;
        break;
      case 'End':
        newIndex = itemCount - 1;
        handled = true;
        break;
      case 'Enter':
      case ' ':
        if (onSelect) {
          event.preventDefault();
          onSelect(activeIndex);
        }
        return;
      case 'Escape':
        if (onEscape) {
          event.preventDefault();
          onEscape();
        }
        return;
    }
    
    if (handled) {
      event.preventDefault();
      setActiveIndex(newIndex);
    }
  }, [activeIndex, itemCount, loop, orientation, onSelect, onEscape]);
  
  const getItemProps = useCallback((index: number) => ({
    tabIndex: index === activeIndex ? 0 : -1,
    'aria-selected': index === activeIndex,
    onFocus: () => setActiveIndex(index),
    onClick: () => {
      setActiveIndex(index);
      onSelect?.(index);
    },
  }), [activeIndex, onSelect]);
  
  return {
    activeIndex,
    setActiveIndex,
    handleKeyDown,
    getItemProps,
    containerRef,
  };
}

// ============================================================================
// useTypeahead Hook
// ============================================================================

export function useTypeahead<T extends { label: string }>(
  items: T[],
  options: {
    timeout?: number;
    onMatch?: (index: number) => void;
  } = {}
) {
  const { timeout = 500, onMatch } = options;
  const [search, setSearch] = useState('');
  const timeoutRef = useRef<NodeJS.Timeout>();
  
  useEffect(() => {
    if (!search) return;
    
    const lowerSearch = search.toLowerCase();
    const matchIndex = items.findIndex(item =>
      item.label.toLowerCase().startsWith(lowerSearch)
    );
    
    if (matchIndex !== -1) {
      onMatch?.(matchIndex);
    }
  }, [search, items, onMatch]);
  
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    // Only handle single character keys
    if (event.key.length !== 1) return;
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    
    event.preventDefault();
    
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Append to search string
    setSearch(prev => prev + event.key);
    
    // Set timeout to clear search
    timeoutRef.current = setTimeout(() => {
      setSearch('');
    }, timeout);
  }, [timeout]);
  
  return {
    search,
    handleKeyDown,
    clearSearch: () => setSearch(''),
  };
}

// ============================================================================
// Keyboard Hint Component
// ============================================================================

interface KeyboardHintProps {
  keys: string | string[];
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'compact' | 'ghost';
}

export function KeyboardHint({
  keys,
  className,
  size = 'sm',
  variant = 'default',
}: KeyboardHintProps) {
  const keyList = Array.isArray(keys) ? keys : keys.split('+');
  
  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5 min-w-[20px]',
    md: 'text-sm px-2 py-1 min-w-[24px]',
    lg: 'text-base px-2.5 py-1.5 min-w-[28px]',
  };
  
  const variantClasses = {
    default: 'bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 shadow-sm',
    compact: 'bg-gray-100/50 dark:bg-gray-700/50 border border-gray-200/50 dark:border-gray-600/50',
    ghost: 'bg-transparent text-gray-400 dark:text-gray-500',
  };
  
  // Format special keys for display
  const formatKey = (key: string): string => {
    const isMac = typeof navigator !== 'undefined' && navigator.platform.includes('Mac');
    
    const keyMap: Record<string, string> = {
      ctrl: isMac ? '⌃' : 'Ctrl',
      alt: isMac ? '⌥' : 'Alt',
      shift: '⇧',
      meta: isMac ? '⌘' : '⊞',
      cmd: '⌘',
      enter: '↵',
      escape: 'Esc',
      space: '␣',
      backspace: '⌫',
      delete: '⌦',
      tab: '⇥',
      arrowup: '↑',
      arrowdown: '↓',
      arrowleft: '←',
      arrowright: '→',
    };
    
    return keyMap[key.toLowerCase()] || key.toUpperCase();
  };
  
  return (
    <span className={clsx('inline-flex items-center gap-0.5', className)}>
      {keyList.map((key, i) => (
        <span key={i} className="flex items-center gap-0.5">
          <kbd
            className={clsx(
              'inline-flex items-center justify-center rounded font-mono font-medium',
              'text-gray-600 dark:text-gray-300',
              sizeClasses[size],
              variantClasses[variant]
            )}
          >
            {formatKey(key.trim())}
          </kbd>
          {i < keyList.length - 1 && variant !== 'ghost' && (
            <span className="text-gray-400 dark:text-gray-500 text-xs mx-0.5">+</span>
          )}
        </span>
      ))}
    </span>
  );
}

// ============================================================================
// Shortcut Registry Context
// ============================================================================

interface ShortcutRegistryContextValue {
  register: (id: string, shortcut: { combo: string; description: string }) => void;
  unregister: (id: string) => void;
  shortcuts: Map<string, { combo: string; description: string }>;
}

const ShortcutRegistryContext = createContext<ShortcutRegistryContextValue | null>(null);

export function ShortcutRegistryProvider({ children }: { children: React.ReactNode }) {
  const [shortcuts, setShortcuts] = useState<Map<string, { combo: string; description: string }>>(new Map());
  
  const register = useCallback((id: string, shortcut: { combo: string; description: string }) => {
    setShortcuts(prev => new Map(prev).set(id, shortcut));
  }, []);
  
  const unregister = useCallback((id: string) => {
    setShortcuts(prev => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);
  
  const value = useMemo(() => ({ register, unregister, shortcuts }), [register, unregister, shortcuts]);
  
  return (
    <ShortcutRegistryContext.Provider value={value}>
      {children}
    </ShortcutRegistryContext.Provider>
  );
}

export function useShortcutRegistry() {
  return useContext(ShortcutRegistryContext);
}

// ============================================================================
// useRegisteredShortcut Hook
// ============================================================================

export function useRegisteredShortcut(
  id: string,
  combo: string,
  handler: () => void,
  description: string
) {
  const registry = useShortcutRegistry();
  
  // Register with registry
  useEffect(() => {
    registry?.register(id, { combo, description });
    return () => registry?.unregister(id);
  }, [id, combo, description, registry]);
  
  // Handle the shortcut
  useHotkey(combo, handler);
}

// ============================================================================
// Shortcut List Component
// ============================================================================

interface ShortcutListProps {
  shortcuts: Array<{ combo: string; description: string }>;
  className?: string;
}

export function ShortcutList({ shortcuts, className }: ShortcutListProps) {
  return (
    <div className={clsx('space-y-2', className)}>
      {shortcuts.map((shortcut, i) => (
        <div key={i} className="flex items-center justify-between py-1.5">
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {shortcut.description}
          </span>
          <KeyboardHint keys={shortcut.combo} />
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Export Default
// ============================================================================

export default {
  useHotkey,
  useKeyboardShortcuts,
  useKeyboardNavigation,
  useTypeahead,
  KeyboardHint,
  ShortcutRegistryProvider,
  useShortcutRegistry,
  useRegisteredShortcut,
  ShortcutList,
};
