import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import clsx from 'clsx';
import {
  Search,
  X,
  ArrowRight,
  FileText,
  Users,
  Package,
  Settings,
  LayoutDashboard,
  Calendar,
  BarChart3,
  Truck,
  Clock,
  DollarSign,
  Bell,
  User,
  LogOut,
  Plus,
  History,
  Star,
  Command,
  CornerDownLeft,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface CommandItem {
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Optional description */
  description?: string;
  /** Category/group */
  category: string;
  /** Icon component */
  icon?: React.ReactNode;
  /** Keywords for search matching */
  keywords?: string[];
  /** Action to execute */
  action: () => void;
  /** Keyboard shortcut hint */
  shortcut?: string;
  /** Whether this is a recent item */
  isRecent?: boolean;
  /** Whether this is a favorite */
  isFavorite?: boolean;
  /** Disabled state */
  disabled?: boolean;
}

export interface CommandPaletteProps {
  /** Whether the palette is open */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
  /** Available commands */
  commands: CommandItem[];
  /** Placeholder text */
  placeholder?: string;
  /** Recent commands to show first */
  recentIds?: string[];
  /** Max recent items to show */
  maxRecent?: number;
  /** Custom className */
  className?: string;
}

export interface CommandPaletteProviderProps {
  children: React.ReactNode;
  commands: CommandItem[];
  /** Keyboard shortcut to open (default: Cmd/Ctrl+K) */
  shortcut?: string;
}

// ============================================================================
// Category Icons
// ============================================================================

const categoryIcons: Record<string, React.ReactNode> = {
  Navigation: <LayoutDashboard className="h-4 w-4" />,
  Orders: <FileText className="h-4 w-4" />,
  Customers: <Users className="h-4 w-4" />,
  Inventory: <Package className="h-4 w-4" />,
  Production: <Clock className="h-4 w-4" />,
  Reports: <BarChart3 className="h-4 w-4" />,
  Settings: <Settings className="h-4 w-4" />,
  Actions: <Plus className="h-4 w-4" />,
  User: <User className="h-4 w-4" />,
};

// ============================================================================
// Fuzzy Search Algorithm
// ============================================================================

interface FuzzyMatch {
  score: number;
  matches: [number, number][]; // Start and end indices of matched characters
}

/**
 * Fuzzy match algorithm that scores how well a query matches a target string.
 * Returns null if no match, or a FuzzyMatch with score and match positions.
 * Higher scores are better matches.
 */
function fuzzyMatch(query: string, target: string): FuzzyMatch | null {
  const queryLower = query.toLowerCase();
  const targetLower = target.toLowerCase();
  
  if (queryLower.length === 0) return { score: 0, matches: [] };
  if (queryLower.length > targetLower.length) return null;

  // Check if all query characters exist in target (in order)
  let queryIdx = 0;
  let targetIdx = 0;
  const matches: [number, number][] = [];
  let consecutiveBonus = 0;
  let score = 0;

  while (queryIdx < queryLower.length && targetIdx < targetLower.length) {
    if (queryLower[queryIdx] === targetLower[targetIdx]) {
      const matchStart = targetIdx;
      
      // Count consecutive matches
      let consecutiveCount = 0;
      while (
        queryIdx < queryLower.length &&
        targetIdx < targetLower.length &&
        queryLower[queryIdx] === targetLower[targetIdx]
      ) {
        consecutiveCount++;
        queryIdx++;
        targetIdx++;
      }
      
      matches.push([matchStart, matchStart + consecutiveCount]);
      
      // Score bonuses
      score += consecutiveCount * 10; // Base points per matched character
      score += (consecutiveCount - 1) * 5; // Consecutive bonus
      
      // Bonus for matching at start of word
      if (matchStart === 0 || /\s/.test(target[matchStart - 1])) {
        score += 15;
      }
      
      // Bonus for matching after separator (camelCase, snake_case, etc.)
      if (matchStart > 0 && /[_\-.]/.test(target[matchStart - 1])) {
        score += 10;
      }
      
      // Bonus for matching uppercase in camelCase
      if (matchStart > 0 && /[A-Z]/.test(target[matchStart])) {
        score += 10;
      }
    } else {
      targetIdx++;
      score -= 1; // Small penalty for gaps
    }
  }

  // Did we match all query characters?
  if (queryIdx < queryLower.length) return null;

  // Normalize score by target length (prefer shorter matches)
  score = score / Math.sqrt(targetLower.length);

  // Exact match bonus
  if (queryLower === targetLower) {
    score += 100;
  }

  return { score, matches };
}

/**
 * Parse natural language query patterns
 * Examples: "overdue orders", "orders for Acme", "create quote"
 */
interface ParsedQuery {
  action?: string;
  entity?: string;
  filter?: string;
  raw: string;
}

function parseNaturalLanguage(query: string): ParsedQuery {
  const raw = query.trim();
  const lower = raw.toLowerCase();
  
  // Action patterns
  const actionPatterns: Record<string, RegExp> = {
    create: /^(create|new|add)\s+/i,
    view: /^(view|show|open|go to|goto)\s+/i,
    edit: /^(edit|update|modify)\s+/i,
    delete: /^(delete|remove)\s+/i,
    search: /^(search|find|look for)\s+/i,
    export: /^(export|download)\s+/i,
  };

  // Entity patterns  
  const entityPatterns: Record<string, RegExp> = {
    orders: /(orders?|work orders?)/i,
    customers: /(customers?|clients?)/i,
    quotes: /(quotes?|estimates?)/i,
    inventory: /(inventory|materials?|stock)/i,
    reports: /(reports?|analytics)/i,
    settings: /(settings?|preferences?|config)/i,
  };

  // Filter patterns
  const filterPatterns: Record<string, RegExp> = {
    overdue: /\b(overdue|late|past due)\b/i,
    pending: /\b(pending|waiting|queued)\b/i,
    completed: /\b(completed?|finished|done)\b/i,
    today: /\b(today|today's)\b/i,
    forCustomer: /\bfor\s+(\w+)\b/i,
  };

  let action: string | undefined;
  let entity: string | undefined;
  let filter: string | undefined;

  // Extract action
  for (const [name, pattern] of Object.entries(actionPatterns)) {
    if (pattern.test(lower)) {
      action = name;
      break;
    }
  }

  // Extract entity
  for (const [name, pattern] of Object.entries(entityPatterns)) {
    if (pattern.test(lower)) {
      entity = name;
      break;
    }
  }

  // Extract filter
  for (const [name, pattern] of Object.entries(filterPatterns)) {
    if (pattern.test(lower)) {
      filter = name;
      break;
    }
  }

  return { action, entity, filter, raw };
}

// ============================================================================
// CommandPalette Component
// ============================================================================

export function CommandPalette({
  isOpen,
  onClose,
  commands,
  placeholder = 'Type a command or search...',
  recentIds = [],
  maxRecent = 5,
  className,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter commands based on query with fuzzy matching
  const filteredCommands = useMemo(() => {
    if (!query.trim()) {
      // Show recent items first, then all others
      const recent = recentIds
        .slice(0, maxRecent)
        .map((id) => commands.find((c) => c.id === id))
        .filter((c): c is CommandItem => !!c)
        .map((c) => ({ ...c, isRecent: true }));

      const recentIdSet = new Set(recentIds);
      const others = commands.filter((c) => !recentIdSet.has(c.id));

      return [...recent, ...others];
    }

    // Parse for natural language patterns
    const parsed = parseNaturalLanguage(query);
    
    // Score each command using fuzzy matching
    const scored = commands
      .map((cmd) => {
        // Fuzzy match against label
        const labelMatch = fuzzyMatch(query, cmd.label);
        let score = labelMatch?.score ?? 0;

        // Also check description
        if (cmd.description) {
          const descMatch = fuzzyMatch(query, cmd.description);
          if (descMatch && descMatch.score > score * 0.5) {
            score = Math.max(score, descMatch.score * 0.8);
          }
        }

        // Check keywords
        if (cmd.keywords) {
          for (const keyword of cmd.keywords) {
            const keywordMatch = fuzzyMatch(query, keyword);
            if (keywordMatch && keywordMatch.score > score) {
              score = keywordMatch.score;
            }
          }
        }

        // Boost based on NLP parsing
        if (parsed.entity && cmd.category.toLowerCase().includes(parsed.entity)) {
          score += 20;
        }
        if (parsed.action === 'create' && cmd.label.toLowerCase().includes('new')) {
          score += 15;
        }
        if (parsed.action === 'view' && cmd.category === 'Navigation') {
          score += 10;
        }

        return { cmd, score, matches: labelMatch?.matches };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    return scored.map((item) => ({
      ...item.cmd,
      _matches: item.matches,
    }));
  }, [commands, query, recentIds, maxRecent]);

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};

    // If we have recent items and no query, show them first
    const recentItems = filteredCommands.filter((c) => c.isRecent);
    if (recentItems.length > 0 && !query.trim()) {
      groups['Recent'] = recentItems;
    }

    filteredCommands
      .filter((c) => !c.isRecent)
      .forEach((cmd) => {
        const category = cmd.category || 'Other';
        if (!groups[category]) groups[category] = [];
        groups[category].push(cmd);
      });

    return groups;
  }, [filteredCommands, query]);

  // Flat list for keyboard navigation
  const flatList = useMemo(() => {
    return Object.values(groupedCommands).flat();
  }, [groupedCommands]);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setSelectedIndex((prev) =>
            prev < flatList.length - 1 ? prev + 1 : 0,
          );
          break;
        case 'ArrowUp':
          event.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : flatList.length - 1,
          );
          break;
        case 'Enter':
          event.preventDefault();
          if (flatList[selectedIndex] && !flatList[selectedIndex].disabled) {
            flatList[selectedIndex].action();
            onClose();
          }
          break;
        case 'Escape':
          event.preventDefault();
          onClose();
          break;
      }
    },
    [flatList, selectedIndex, onClose],
  );

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedEl = listRef.current.querySelector(
        `[data-index="${selectedIndex}"]`,
      );
      selectedEl?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Close on backdrop click
  const handleBackdropClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  let itemIndex = 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/50"
      onClick={handleBackdropClick}
    >
      <div
        className={clsx(
          'w-full max-w-xl bg-white rounded-xl shadow-2xl overflow-hidden',
          className,
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
          <Search className="h-5 w-5 text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 text-base outline-none placeholder:text-gray-400"
          />
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X className="h-4 w-4 text-gray-400" />
          </button>
        </div>

        {/* Command List */}
        <div
          ref={listRef}
          className="max-h-[60vh] overflow-y-auto py-2"
        >
          {flatList.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500">
              No commands found for "{query}"
            </div>
          ) : (
            Object.entries(groupedCommands).map(([category, items]) => (
              <div key={category}>
                {/* Category Header */}
                <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
                  {category === 'Recent' ? (
                    <History className="h-3 w-3" />
                  ) : (
                    categoryIcons[category]
                  )}
                  {category}
                </div>

                {/* Items */}
                {items.map((cmd) => {
                  const currentIndex = itemIndex++;
                  const isSelected = currentIndex === selectedIndex;

                  return (
                    <button
                      key={cmd.id}
                      data-index={currentIndex}
                      onClick={() => {
                        if (!cmd.disabled) {
                          cmd.action();
                          onClose();
                        }
                      }}
                      onMouseEnter={() => setSelectedIndex(currentIndex)}
                      disabled={cmd.disabled}
                      className={clsx(
                        'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                        isSelected && 'bg-blue-50',
                        cmd.disabled && 'opacity-50 cursor-not-allowed',
                      )}
                    >
                      {/* Icon */}
                      <span
                        className={clsx(
                          'flex-shrink-0 p-1.5 rounded-md',
                          isSelected
                            ? 'bg-blue-100 text-blue-600'
                            : 'bg-gray-100 text-gray-500',
                        )}
                      >
                        {cmd.icon || <ArrowRight className="h-4 w-4" />}
                      </span>

                      {/* Label & Description */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 truncate">
                            {cmd.label}
                          </span>
                          {cmd.isFavorite && (
                            <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                          )}
                        </div>
                        {cmd.description && (
                          <p className="text-sm text-gray-500 truncate">
                            {cmd.description}
                          </p>
                        )}
                      </div>

                      {/* Shortcut */}
                      {cmd.shortcut && (
                        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-1 text-xs font-mono bg-gray-100 text-gray-500 rounded">
                          {cmd.shortcut}
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 bg-gray-50 text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-xs">
                <ArrowUp className="h-3 w-3 inline" />
              </kbd>
              <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-xs">
                <ArrowDown className="h-3 w-3 inline" />
              </kbd>
              to navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-xs">
                <CornerDownLeft className="h-3 w-3 inline" />
              </kbd>
              to select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-xs">esc</kbd>
              to close
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Command className="h-3 w-3" />
            <span>K to open</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// useCommandPalette Hook
// ============================================================================

interface CommandPaletteContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const CommandPaletteContext = React.createContext<CommandPaletteContextValue | null>(
  null,
);

export function useCommandPalette() {
  const context = React.useContext(CommandPaletteContext);
  if (!context) {
    throw new Error(
      'useCommandPalette must be used within a CommandPaletteProvider',
    );
  }
  return context;
}

// ============================================================================
// CommandPaletteProvider Component
// ============================================================================

export function CommandPaletteProvider({
  children,
  commands,
  shortcut = 'k',
}: CommandPaletteProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [recentIds, setRecentIds] = useState<string[]>([]);

  // Handle global keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toLowerCase().includes('mac');
      const modifier = isMac ? event.metaKey : event.ctrlKey;

      if (modifier && event.key.toLowerCase() === shortcut) {
        event.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [shortcut]);

  // Track recent commands
  const wrappedCommands = useMemo(() => {
    return commands.map((cmd) => ({
      ...cmd,
      action: () => {
        // Add to recent
        setRecentIds((prev) => {
          const filtered = prev.filter((id) => id !== cmd.id);
          return [cmd.id, ...filtered].slice(0, 10);
        });
        cmd.action();
      },
    }));
  }, [commands]);

  const value = useMemo(
    () => ({
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      toggle: () => setIsOpen((prev) => !prev),
    }),
    [isOpen],
  );

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      <CommandPalette
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        commands={wrappedCommands}
        recentIds={recentIds}
      />
    </CommandPaletteContext.Provider>
  );
}

// ============================================================================
// Default Commands Builder
// ============================================================================

export interface NavigationItem {
  path: string;
  label: string;
  icon?: React.ReactNode;
  category?: string;
  keywords?: string[];
}

export function buildNavigationCommands(
  items: NavigationItem[],
  navigate: (path: string) => void,
): CommandItem[] {
  return items.map((item) => ({
    id: `nav-${item.path}`,
    label: item.label,
    description: `Go to ${item.label}`,
    category: item.category || 'Navigation',
    icon: item.icon,
    keywords: item.keywords,
    action: () => navigate(item.path),
  }));
}

// ============================================================================
// Quick Actions Panel
// ============================================================================

export interface QuickActionsPanelProps {
  actions: CommandItem[];
  className?: string;
}

export function QuickActionsPanel({ actions, className }: QuickActionsPanelProps) {
  return (
    <div className={clsx('grid grid-cols-2 sm:grid-cols-4 gap-3', className)}>
      {actions.slice(0, 8).map((action) => (
        <button
          key={action.id}
          onClick={action.action}
          disabled={action.disabled}
          className={clsx(
            'flex flex-col items-center gap-2 p-4 bg-white rounded-lg border border-gray-200',
            'hover:border-blue-300 hover:bg-blue-50 transition-colors',
            action.disabled && 'opacity-50 cursor-not-allowed',
          )}
        >
          <span className="p-2 bg-gray-100 rounded-lg text-gray-600">
            {action.icon || <ArrowRight className="h-5 w-5" />}
          </span>
          <span className="text-sm font-medium text-gray-700 text-center">
            {action.label}
          </span>
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// Command Palette Trigger Button
// ============================================================================

export interface CommandPaletteTriggerProps {
  className?: string;
}

export function CommandPaletteTrigger({ className }: CommandPaletteTriggerProps) {
  const { open } = useCommandPalette();

  return (
    <button
      onClick={open}
      className={clsx(
        'flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500',
        'bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors',
        className,
      )}
    >
      <Search className="h-4 w-4" />
      <span className="hidden sm:inline">Search...</span>
      <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs bg-gray-200 rounded">
        <Command className="h-3 w-3" />K
      </kbd>
    </button>
  );
}
