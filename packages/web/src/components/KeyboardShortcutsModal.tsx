import React, { useState, useEffect, useMemo } from 'react';
import clsx from 'clsx';
import { X, Command, Search } from 'lucide-react';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface KeyboardShortcut {
  /** Unique identifier */
  id: string;
  /** Shortcut keys (e.g., "Ctrl+K", "Cmd+Shift+P") */
  keys: string;
  /** Description of what it does */
  description: string;
  /** Category/group */
  category: string;
  /** Whether this is a global shortcut */
  global?: boolean;
  /** Whether the shortcut is enabled */
  enabled?: boolean;
}

export interface KeyboardShortcutsModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
  /** List of shortcuts to display */
  shortcuts: KeyboardShortcut[];
  /** Title */
  title?: string;
  /** Custom className */
  className?: string;
}

export interface ShortcutDisplayProps {
  /** Shortcut keys string */
  keys: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Custom className */
  className?: string;
}

// ============================================================================
// Platform Detection
// ============================================================================

function isMac(): boolean {
  if (typeof navigator !== 'undefined') {
    return navigator.platform.toLowerCase().includes('mac');
  }
  return false;
}

// ============================================================================
// Key Display Mapping
// ============================================================================

const keyDisplayMap: Record<string, string> = {
  Ctrl: isMac() ? '⌃' : 'Ctrl',
  Control: isMac() ? '⌃' : 'Ctrl',
  Cmd: '⌘',
  Command: '⌘',
  Meta: isMac() ? '⌘' : 'Win',
  Alt: isMac() ? '⌥' : 'Alt',
  Option: '⌥',
  Shift: isMac() ? '⇧' : 'Shift',
  Enter: isMac() ? '↵' : 'Enter',
  Return: '↵',
  Backspace: '⌫',
  Delete: '⌦',
  Escape: 'Esc',
  Esc: 'Esc',
  Tab: '⇥',
  Space: '␣',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Up: '↑',
  Down: '↓',
  Left: '←',
  Right: '→',
};

function formatKey(key: string): string {
  return keyDisplayMap[key] || key;
}

function parseShortcut(shortcut: string): string[] {
  // Handle different separators: +, -, or space
  return shortcut
    .split(/[+\-\s]+/)
    .map((k) => k.trim())
    .filter((k) => k.length > 0)
    .map(formatKey);
}

// ============================================================================
// ShortcutDisplay Component
// ============================================================================

export function ShortcutDisplay({
  keys,
  size = 'md',
  className,
}: ShortcutDisplayProps) {
  const parsedKeys = useMemo(() => parseShortcut(keys), [keys]);

  const sizeClasses = {
    sm: 'text-xs px-1 py-0.5 min-w-[18px]',
    md: 'text-xs px-1.5 py-0.5 min-w-[22px]',
    lg: 'text-sm px-2 py-1 min-w-[26px]',
  };

  return (
    <span className={clsx('inline-flex items-center gap-0.5', className)}>
      {parsedKeys.map((key, idx) => (
        <kbd
          key={idx}
          className={clsx(
            'inline-flex items-center justify-center font-mono font-medium',
            'bg-gray-100 border border-gray-300 rounded shadow-sm',
            'text-gray-700',
            sizeClasses[size],
          )}
        >
          {key}
        </kbd>
      ))}
    </span>
  );
}

// ============================================================================
// KeyboardShortcutsModal Component
// ============================================================================

export function KeyboardShortcutsModal({
  isOpen,
  onClose,
  shortcuts,
  title = 'Keyboard Shortcuts',
  className,
}: KeyboardShortcutsModalProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Filter shortcuts
  const filteredShortcuts = useMemo(() => {
    if (!searchQuery.trim()) return shortcuts;
    const query = searchQuery.toLowerCase();
    return shortcuts.filter(
      (s) =>
        s.description.toLowerCase().includes(query) ||
        s.keys.toLowerCase().includes(query) ||
        s.category.toLowerCase().includes(query),
    );
  }, [shortcuts, searchQuery]);

  // Group by category
  const groupedShortcuts = useMemo(() => {
    const groups: Record<string, KeyboardShortcut[]> = {};
    filteredShortcuts.forEach((shortcut) => {
      const category = shortcut.category || 'General';
      if (!groups[category]) groups[category] = [];
      groups[category].push(shortcut);
    });
    return groups;
  }, [filteredShortcuts]);

  // Reset search on close
  useEffect(() => {
    if (!isOpen) setSearchQuery('');
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={clsx(
          'w-full max-w-2xl max-h-[80vh] bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col',
          className,
        )}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search shortcuts..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Shortcuts List */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {Object.keys(groupedShortcuts).length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No shortcuts found for "{searchQuery}"
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
                <div key={category}>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    {category}
                  </h3>
                  <div className="space-y-2">
                    {categoryShortcuts.map((shortcut) => (
                      <div
                        key={shortcut.id}
                        className={clsx(
                          'flex items-center justify-between py-2 px-3 rounded-lg',
                          shortcut.enabled === false
                            ? 'opacity-50 bg-gray-50'
                            : 'hover:bg-gray-50',
                        )}
                      >
                        <span className="text-sm text-gray-700">
                          {shortcut.description}
                          {shortcut.global && (
                            <span className="ml-2 text-xs text-blue-600 font-medium">
                              Global
                            </span>
                          )}
                        </span>
                        <ShortcutDisplay keys={shortcut.keys} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
          Press{' '}
          <ShortcutDisplay keys="?" size="sm" className="mx-1" />
          to open this dialog anytime
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// useKeyboardShortcuts Hook
// ============================================================================

export interface UseKeyboardShortcutsOptions {
  /** Whether shortcuts are enabled */
  enabled?: boolean;
  /** Handler for ? key to show shortcuts modal */
  onShowShortcuts?: () => void;
}

export function useKeyboardShortcuts(
  shortcuts: { keys: string; action: () => void; enabled?: boolean }[],
  options: UseKeyboardShortcutsOptions = {},
) {
  const { enabled = true, onShowShortcuts } = options;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for ? to show shortcuts
      if (e.key === '?' && onShowShortcuts && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Don't trigger if typing in an input
        if (
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement
        ) {
          return;
        }
        e.preventDefault();
        onShowShortcuts();
        return;
      }

      // Check each shortcut
      for (const shortcut of shortcuts) {
        if (shortcut.enabled === false) continue;

        const parts = shortcut.keys.toLowerCase().split(/[+\-\s]+/);
        const key = parts[parts.length - 1];
        const needsCtrl = parts.includes('ctrl') || parts.includes('control');
        const needsCmd = parts.includes('cmd') || parts.includes('command') || parts.includes('meta');
        const needsAlt = parts.includes('alt') || parts.includes('option');
        const needsShift = parts.includes('shift');

        const hasCtrl = e.ctrlKey;
        const hasCmd = e.metaKey;
        const hasAlt = e.altKey;
        const hasShift = e.shiftKey;

        // Check modifier requirements
        const isMacPlatform = isMac();
        const modifierMatch =
          (needsCtrl ? (isMacPlatform ? hasCmd : hasCtrl) : true) &&
          (needsCmd ? hasCmd : !needsCtrl || !hasCmd) &&
          (needsAlt === hasAlt) &&
          (needsShift === hasShift);

        if (modifierMatch && e.key.toLowerCase() === key) {
          e.preventDefault();
          shortcut.action();
          return;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled, shortcuts, onShowShortcuts]);
}

// ============================================================================
// Default Shortcuts
// ============================================================================

export const defaultShortcuts: KeyboardShortcut[] = [
  // Navigation
  { id: 'nav-home', keys: 'G H', description: 'Go to Home/Dashboard', category: 'Navigation' },
  { id: 'nav-orders', keys: 'G O', description: 'Go to Orders', category: 'Navigation' },
  { id: 'nav-customers', keys: 'G C', description: 'Go to Customers', category: 'Navigation' },
  { id: 'nav-inventory', keys: 'G I', description: 'Go to Inventory', category: 'Navigation' },
  { id: 'nav-quotes', keys: 'G Q', description: 'Go to Quotes', category: 'Navigation' },
  { id: 'nav-reports', keys: 'G R', description: 'Go to Reports', category: 'Navigation' },
  { id: 'nav-settings', keys: 'G S', description: 'Go to Settings', category: 'Navigation' },

  // Actions
  { id: 'cmd-palette', keys: 'Ctrl+K', description: 'Open command palette', category: 'Actions', global: true },
  { id: 'search', keys: '/', description: 'Focus search', category: 'Actions' },
  { id: 'new-order', keys: 'N O', description: 'Create new order', category: 'Actions' },
  { id: 'new-quote', keys: 'N Q', description: 'Create new quote', category: 'Actions' },
  { id: 'new-customer', keys: 'N C', description: 'Create new customer', category: 'Actions' },
  { id: 'save', keys: 'Ctrl+S', description: 'Save current form', category: 'Actions' },
  { id: 'cancel', keys: 'Escape', description: 'Cancel/Close dialog', category: 'Actions' },

  // Table/List
  { id: 'select-all', keys: 'Ctrl+A', description: 'Select all items', category: 'Table' },
  { id: 'next-row', keys: 'J', description: 'Next row', category: 'Table' },
  { id: 'prev-row', keys: 'K', description: 'Previous row', category: 'Table' },
  { id: 'open-row', keys: 'Enter', description: 'Open selected item', category: 'Table' },
  { id: 'delete-row', keys: 'Delete', description: 'Delete selected items', category: 'Table' },
  { id: 'refresh', keys: 'R', description: 'Refresh list', category: 'Table' },

  // General
  { id: 'help', keys: '?', description: 'Show keyboard shortcuts', category: 'General' },
  { id: 'notifications', keys: 'Alt+N', description: 'Toggle notifications', category: 'General' },
  { id: 'dark-mode', keys: 'Ctrl+Shift+D', description: 'Toggle dark mode', category: 'General' },
];

// ============================================================================
// ShortcutHint Component (Inline hint)
// ============================================================================

export interface ShortcutHintProps {
  keys: string;
  className?: string;
}

export function ShortcutHint({ keys, className }: ShortcutHintProps) {
  return (
    <span className={clsx('text-gray-400 text-xs ml-2', className)}>
      <ShortcutDisplay keys={keys} size="sm" />
    </span>
  );
}

// ============================================================================
// KeyboardShortcutsProvider
// ============================================================================

interface KeyboardShortcutsContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  shortcuts: KeyboardShortcut[];
}

const KeyboardShortcutsContext = React.createContext<KeyboardShortcutsContextValue | null>(null);

export function useKeyboardShortcutsModal() {
  const context = React.useContext(KeyboardShortcutsContext);
  if (!context) {
    throw new Error('useKeyboardShortcutsModal must be used within KeyboardShortcutsProvider');
  }
  return context;
}

export interface KeyboardShortcutsProviderProps {
  children: React.ReactNode;
  shortcuts?: KeyboardShortcut[];
}

export function KeyboardShortcutsProvider({
  children,
  shortcuts = defaultShortcuts,
}: KeyboardShortcutsProviderProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Listen for ? key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '?' &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const value = useMemo(
    () => ({
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      shortcuts,
    }),
    [isOpen, shortcuts],
  );

  return (
    <KeyboardShortcutsContext.Provider value={value}>
      {children}
      <KeyboardShortcutsModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        shortcuts={shortcuts}
      />
    </KeyboardShortcutsContext.Provider>
  );
}
