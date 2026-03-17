/**
 * Enhanced Search with History & Suggestions
 * 
 * Comprehensive search experience with:
 * - Search history persistence
 * - Smart autocomplete suggestions
 * - Recent searches display
 * - Popular/trending searches
 * - Search scoping and filters
 * - Keyboard navigation
 */

import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  createContext,
  useContext,
  ReactNode,
  forwardRef,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  X,
  Clock,
  TrendingUp,
  Hash,
  ArrowRight,
  Command,
  Filter,
  ChevronDown,
  Trash2,
  Star,
} from 'lucide-react';
import { clsx } from 'clsx';

// ============================================================================
// Types
// ============================================================================

export interface SearchHistoryEntry {
  query: string;
  timestamp: number;
  scope?: string;
  resultCount?: number;
}

export interface SearchSuggestion {
  id: string;
  text: string;
  type: 'history' | 'suggestion' | 'trending' | 'entity';
  icon?: React.ElementType;
  category?: string;
  data?: Record<string, unknown>;
  description?: string;
}

export interface SearchScope {
  id: string;
  label: string;
  icon?: React.ElementType;
  placeholder?: string;
}

export interface SearchConfig {
  /** Maximum history entries to store */
  maxHistoryEntries?: number;
  
  /** Minimum query length to show suggestions */
  minQueryLength?: number;
  
  /** Debounce delay for suggestions (ms) */
  debounceDelay?: number;
  
  /** Show trending searches */
  showTrending?: boolean;
  
  /** Show recent history */
  showHistory?: boolean;
  
  /** Available search scopes */
  scopes?: SearchScope[];
  
  /** Default scope */
  defaultScope?: string;
}

export interface SearchContextValue {
  // State
  query: string;
  scope: string | null;
  isOpen: boolean;
  suggestions: SearchSuggestion[];
  history: SearchHistoryEntry[];
  isLoading: boolean;
  
  // Actions
  setQuery: (query: string) => void;
  setScope: (scope: string | null) => void;
  search: (query?: string) => void;
  selectSuggestion: (suggestion: SearchSuggestion) => void;
  clearHistory: () => void;
  removeHistoryEntry: (query: string) => void;
  open: () => void;
  close: () => void;
  
  // Config
  config: SearchConfig;
  scopes: SearchScope[];
}

// ============================================================================
// Storage Keys
// ============================================================================

const HISTORY_STORAGE_KEY = 'erp-search-history';
const MAX_HISTORY_ENTRIES = 50;

// ============================================================================
// Context
// ============================================================================

const SearchContext = createContext<SearchContextValue | null>(null);

export function useEnhancedSearch() {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useEnhancedSearch must be used within EnhancedSearchProvider');
  }
  return context;
}

// ============================================================================
// Provider
// ============================================================================

interface EnhancedSearchProviderProps {
  children: ReactNode;
  config?: SearchConfig;
  onSearch?: (query: string, scope: string | null) => void;
  onSuggestionsFetch?: (
    query: string,
    scope: string | null
  ) => Promise<SearchSuggestion[]>;
  trendingSearches?: SearchSuggestion[];
}

export function EnhancedSearchProvider({
  children,
  config: userConfig = {},
  onSearch,
  onSuggestionsFetch,
  trendingSearches = [],
}: EnhancedSearchProviderProps) {
  const [query, setQueryState] = useState('');
  const [scope, setScope] = useState<string | null>(userConfig.defaultScope ?? null);
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [history, setHistory] = useState<SearchHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const debounceTimeoutRef = useRef<NodeJS.Timeout>();

  const config = useMemo<SearchConfig>(
    () => ({
      maxHistoryEntries: MAX_HISTORY_ENTRIES,
      minQueryLength: 2,
      debounceDelay: 300,
      showTrending: true,
      showHistory: true,
      scopes: [],
      ...userConfig,
    }),
    [userConfig]
  );

  const scopes = config.scopes ?? [];

  // Load history from storage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load search history:', e);
    }
  }, []);

  // Save history to storage
  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
    } catch (e) {
      console.error('Failed to save search history:', e);
    }
  }, [history]);

  // Fetch suggestions with debounce
  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    if (query.length < (config.minQueryLength ?? 2)) {
      setSuggestions([]);
      return;
    }

    debounceTimeoutRef.current = setTimeout(async () => {
      if (onSuggestionsFetch) {
        setIsLoading(true);
        try {
          const results = await onSuggestionsFetch(query, scope);
          setSuggestions(results);
        } catch (e) {
          console.error('Failed to fetch suggestions:', e);
          setSuggestions([]);
        } finally {
          setIsLoading(false);
        }
      }
    }, config.debounceDelay);

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [query, scope, config.debounceDelay, config.minQueryLength, onSuggestionsFetch]);

  // Set query
  const setQuery = useCallback((newQuery: string) => {
    setQueryState(newQuery);
  }, []);

  // Execute search
  const search = useCallback(
    (overrideQuery?: string) => {
      const searchQuery = overrideQuery ?? query;
      if (!searchQuery.trim()) return;

      // Add to history
      setHistory((prev) => {
        const filtered = prev.filter((h) => h.query !== searchQuery);
        return [
          {
            query: searchQuery,
            timestamp: Date.now(),
            scope: scope ?? undefined,
          },
          ...filtered,
        ].slice(0, config.maxHistoryEntries);
      });

      // Execute search callback
      onSearch?.(searchQuery, scope);
      setIsOpen(false);
    },
    [query, scope, config.maxHistoryEntries, onSearch]
  );

  // Select suggestion
  const selectSuggestion = useCallback(
    (suggestion: SearchSuggestion) => {
      setQueryState(suggestion.text);
      search(suggestion.text);
    },
    [search]
  );

  // Clear history
  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  // Remove single history entry
  const removeHistoryEntry = useCallback((entryQuery: string) => {
    setHistory((prev) => prev.filter((h) => h.query !== entryQuery));
  }, []);

  // Open/close
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const contextValue = useMemo<SearchContextValue>(
    () => ({
      query,
      scope,
      isOpen,
      suggestions,
      history,
      isLoading,
      setQuery,
      setScope,
      search,
      selectSuggestion,
      clearHistory,
      removeHistoryEntry,
      open,
      close,
      config,
      scopes,
    }),
    [
      query,
      scope,
      isOpen,
      suggestions,
      history,
      isLoading,
      setQuery,
      setScope,
      search,
      selectSuggestion,
      clearHistory,
      removeHistoryEntry,
      open,
      close,
      config,
      scopes,
    ]
  );

  return (
    <SearchContext.Provider value={contextValue}>
      {children}
    </SearchContext.Provider>
  );
}

// ============================================================================
// Enhanced Search Input Component
// ============================================================================

interface EnhancedSearchInputProps {
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
  showShortcut?: boolean;
  showScopeSelector?: boolean;
}

export const EnhancedSearchInput = forwardRef<HTMLInputElement, EnhancedSearchInputProps>(
  function EnhancedSearchInput(
    {
      className,
      placeholder = 'Search...',
      autoFocus = false,
      showShortcut = true,
      showScopeSelector = true,
    },
    ref
  ) {
    const {
      query,
      scope,
      isOpen,
      suggestions,
      history,
      isLoading,
      setQuery,
      setScope,
      search,
      selectSuggestion,
      removeHistoryEntry,
      clearHistory,
      open,
      close,
      config,
      scopes,
    } = useEnhancedSearch();

    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [showScopeDropdown, setShowScopeDropdown] = useState(false);

    // Combine ref
    useEffect(() => {
      if (ref && typeof ref !== 'function' && inputRef.current) {
        (ref as React.MutableRefObject<HTMLInputElement | null>).current = inputRef.current;
      }
    }, [ref]);

    // Close on outside click
    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          close();
          setShowScopeDropdown(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [close]);

    // Keyboard shortcut (Ctrl/Cmd + /)
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === '/') {
          e.preventDefault();
          inputRef.current?.focus();
          open();
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }, [open]);

    // All items to display
    const displayItems = useMemo<SearchSuggestion[]>(() => {
      if (query.length >= (config.minQueryLength ?? 2)) {
        return suggestions;
      }

      // Show history when no query
      const items: SearchSuggestion[] = [];

      if (config.showHistory && history.length > 0) {
        items.push(
          ...history.slice(0, 5).map((h) => ({
            id: `history-${h.query}`,
            text: h.query,
            type: 'history' as const,
            icon: Clock,
          }))
        );
      }

      return items;
    }, [query, suggestions, history, config]);

    // Keyboard navigation
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault();
            setSelectedIndex((prev) =>
              prev < displayItems.length - 1 ? prev + 1 : prev
            );
            break;

          case 'ArrowUp':
            e.preventDefault();
            setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
            break;

          case 'Enter':
            e.preventDefault();
            if (selectedIndex >= 0 && displayItems[selectedIndex]) {
              selectSuggestion(displayItems[selectedIndex]);
            } else if (query) {
              search();
            }
            break;

          case 'Escape':
            close();
            inputRef.current?.blur();
            break;

          case 'Tab':
            if (scopes.length > 0) {
              e.preventDefault();
              const currentIndex = scope ? scopes.findIndex((s) => s.id === scope) : -1;
              const nextIndex = (currentIndex + 1) % scopes.length;
              setScope(scopes[nextIndex].id);
            }
            break;
        }
      },
      [displayItems, selectedIndex, query, scope, scopes, selectSuggestion, search, close, setScope]
    );

    // Reset selection when items change
    useEffect(() => {
      setSelectedIndex(-1);
    }, [displayItems]);

    const currentScope = scopes.find((s) => s.id === scope);

    return (
      <div ref={containerRef} className={clsx('relative', className)}>
        {/* Input wrapper */}
        <div
          className={clsx(
            'flex items-center',
            'bg-white dark:bg-gray-800',
            'border border-gray-200 dark:border-gray-700',
            'rounded-lg shadow-sm',
            'transition-shadow',
            isOpen && 'ring-2 ring-blue-500 border-transparent'
          )}
        >
          {/* Scope selector */}
          {showScopeSelector && scopes.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowScopeDropdown(!showScopeDropdown)}
                className={clsx(
                  'flex items-center gap-1 px-3 py-2',
                  'text-sm text-gray-600 dark:text-gray-400',
                  'border-r border-gray-200 dark:border-gray-700',
                  'hover:bg-gray-50 dark:hover:bg-gray-700',
                  'rounded-l-lg'
                )}
              >
                {currentScope?.icon && <currentScope.icon className="h-4 w-4" />}
                <span>{currentScope?.label ?? 'All'}</span>
                <ChevronDown className="h-3 w-3" />
              </button>

              <AnimatePresence>
                {showScopeDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className={clsx(
                      'absolute left-0 top-full mt-1 z-50',
                      'w-40 py-1',
                      'bg-white dark:bg-gray-800',
                      'rounded-lg shadow-xl',
                      'border border-gray-200 dark:border-gray-700'
                    )}
                  >
                    <button
                      onClick={() => {
                        setScope(null);
                        setShowScopeDropdown(false);
                      }}
                      className={clsx(
                        'w-full flex items-center gap-2 px-3 py-2 text-sm text-left',
                        'hover:bg-gray-100 dark:hover:bg-gray-700',
                        !scope && 'bg-blue-50 dark:bg-blue-900/20 text-blue-600'
                      )}
                    >
                      All
                    </button>
                    {scopes.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          setScope(s.id);
                          setShowScopeDropdown(false);
                        }}
                        className={clsx(
                          'w-full flex items-center gap-2 px-3 py-2 text-sm text-left',
                          'hover:bg-gray-100 dark:hover:bg-gray-700',
                          scope === s.id && 'bg-blue-50 dark:bg-blue-900/20 text-blue-600'
                        )}
                      >
                        {s.icon && <s.icon className="h-4 w-4" />}
                        {s.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Search icon */}
          <div className="pl-3 flex items-center">
            <Search className="h-4 w-4 text-gray-400" />
          </div>

          {/* Input */}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={open}
            onKeyDown={handleKeyDown}
            placeholder={currentScope?.placeholder ?? placeholder}
            autoFocus={autoFocus}
            className={clsx(
              'flex-1 px-3 py-2',
              'text-gray-900 dark:text-white',
              'placeholder-gray-500 dark:placeholder-gray-400',
              'bg-transparent border-none outline-none',
              'text-sm'
            )}
          />

          {/* Loading spinner */}
          {isLoading && (
            <div className="pr-2">
              <div className="h-4 w-4 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
            </div>
          )}

          {/* Clear button */}
          {query && (
            <button
              onClick={() => setQuery('')}
              className="pr-2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          {/* Shortcut hint */}
          {showShortcut && !query && (
            <div className="pr-3 hidden sm:flex items-center">
              <kbd className="flex items-center gap-0.5 px-1.5 py-0.5 text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 rounded">
                <Command className="h-3 w-3" />/
              </kbd>
            </div>
          )}
        </div>

        {/* Dropdown */}
        <AnimatePresence>
          {isOpen && displayItems.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className={clsx(
                'absolute left-0 right-0 top-full mt-1 z-50',
                'bg-white dark:bg-gray-800',
                'rounded-lg shadow-xl',
                'border border-gray-200 dark:border-gray-700',
                'max-h-80 overflow-auto'
              )}
            >
              {/* History header */}
              {displayItems.some((i) => i.type === 'history') && (
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Recent Searches
                  </span>
                  <button
                    onClick={clearHistory}
                    className="text-xs text-gray-400 hover:text-red-500"
                  >
                    Clear all
                  </button>
                </div>
              )}

              {/* Items */}
              <div className="py-1">
                {displayItems.map((item, index) => {
                  const Icon = item.icon ?? Hash;
                  const isSelected = index === selectedIndex;

                  return (
                    <div
                      key={item.id}
                      className={clsx(
                        'flex items-center gap-3 px-3 py-2',
                        'cursor-pointer group',
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-900/20'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                      )}
                      onClick={() => selectSuggestion(item)}
                      onMouseEnter={() => setSelectedIndex(index)}
                    >
                      <Icon
                        className={clsx(
                          'h-4 w-4',
                          item.type === 'history'
                            ? 'text-gray-400'
                            : item.type === 'trending'
                            ? 'text-orange-500'
                            : 'text-blue-500'
                        )}
                      />

                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-900 dark:text-white truncate">
                          {item.text}
                        </div>
                        {item.description && (
                          <div className="text-xs text-gray-500 truncate">
                            {item.description}
                          </div>
                        )}
                      </div>

                      {item.category && (
                        <span className="text-xs text-gray-400 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">
                          {item.category}
                        </span>
                      )}

                      {item.type === 'history' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeHistoryEntry(item.text);
                          }}
                          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 p-1"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}

                      {isSelected && (
                        <ArrowRight className="h-4 w-4 text-blue-500" />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="flex items-center gap-4 px-3 py-2 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <kbd className="px-1 bg-gray-100 dark:bg-gray-700 rounded">↑↓</kbd>
                  Navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1 bg-gray-100 dark:bg-gray-700 rounded">↵</kbd>
                  Search
                </span>
                {scopes.length > 0 && (
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 bg-gray-100 dark:bg-gray-700 rounded">Tab</kbd>
                    Change scope
                  </span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
);

// ============================================================================
// Search History Hook
// ============================================================================

export function useSearchHistory(key: string = 'default') {
  const [history, setHistory] = useState<SearchHistoryEntry[]>([]);

  const storageKey = `${HISTORY_STORAGE_KEY}-${key}`;

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load search history:', e);
    }
  }, [storageKey]);

  const addEntry = useCallback(
    (query: string, scope?: string) => {
      setHistory((prev) => {
        const filtered = prev.filter((h) => h.query !== query);
        const updated = [
          {
            query,
            timestamp: Date.now(),
            scope,
          },
          ...filtered,
        ].slice(0, MAX_HISTORY_ENTRIES);

        localStorage.setItem(storageKey, JSON.stringify(updated));
        return updated;
      });
    },
    [storageKey]
  );

  const removeEntry = useCallback(
    (query: string) => {
      setHistory((prev) => {
        const updated = prev.filter((h) => h.query !== query);
        localStorage.setItem(storageKey, JSON.stringify(updated));
        return updated;
      });
    },
    [storageKey]
  );

  const clearAll = useCallback(() => {
    setHistory([]);
    localStorage.removeItem(storageKey);
  }, [storageKey]);

  return {
    history,
    addEntry,
    removeEntry,
    clearAll,
    recentQueries: history.slice(0, 5).map((h) => h.query),
  };
}

// ============================================================================
// Fuzzy Search Utility
// ============================================================================

export function fuzzyMatch(text: string, query: string): { match: boolean; score: number } {
  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();

  // Exact match
  if (textLower === queryLower) {
    return { match: true, score: 100 };
  }

  // Starts with
  if (textLower.startsWith(queryLower)) {
    return { match: true, score: 80 };
  }

  // Contains
  if (textLower.includes(queryLower)) {
    return { match: true, score: 60 };
  }

  // Fuzzy match (all characters in order)
  let queryIndex = 0;
  for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
    if (textLower[i] === queryLower[queryIndex]) {
      queryIndex++;
    }
  }

  if (queryIndex === queryLower.length) {
    return { match: true, score: 40 };
  }

  return { match: false, score: 0 };
}

export function fuzzySearch<T>(
  items: T[],
  query: string,
  getSearchText: (item: T) => string
): T[] {
  if (!query) return items;

  return items
    .map((item) => ({
      item,
      ...fuzzyMatch(getSearchText(item), query),
    }))
    .filter((r) => r.match)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.item);
}

export default EnhancedSearchInput;
