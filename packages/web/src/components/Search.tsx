/**
 * Search.tsx - CRITICAL-21
 * 
 * Search utilities and components for the ERP application.
 * Provides debounced search hooks, filter builders, text highlighting,
 * recent searches, and search suggestions.
 * 
 * Features:
 * - 21.1: useDebounce and useDebouncedSearch hooks
 * - 21.2: Filter builder utilities
 * - 21.3: Text highlighting components
 * - 21.4: Recent searches management
 * - 21.5: Search suggestions and autocomplete
 * 
 * @module Search
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
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import { clsx } from 'clsx';
import { Search, X, Clock, TrendingUp, ArrowRight, Loader2 } from 'lucide-react';
import { scoreSearchText } from '@erp/shared';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/** Search result item */
export interface SearchResult<T = unknown> {
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Optional description */
  description?: string;
  /** Optional category/type */
  category?: string;
  /** Original data */
  data: T;
  /** Search score (for ranking) */
  score?: number;
}

/** Filter operator */
export type FilterOperator =
  | 'eq' | 'neq'
  | 'gt' | 'gte' | 'lt' | 'lte'
  | 'contains' | 'notContains'
  | 'startsWith' | 'endsWith'
  | 'in' | 'notIn'
  | 'between'
  | 'isNull' | 'isNotNull';

/** Filter rule */
export interface FilterRule {
  /** Field to filter on */
  field: string;
  /** Operator to apply */
  operator: FilterOperator;
  /** Value(s) to compare */
  value: unknown;
}

/** Filter group (AND/OR) */
export interface FilterGroup {
  /** Logical operator */
  logic: 'and' | 'or';
  /** Rules in this group */
  rules: (FilterRule | FilterGroup)[];
}

/** Recent search entry */
export interface RecentSearch {
  /** Search query */
  query: string;
  /** Timestamp of search */
  timestamp: number;
  /** Optional category */
  category?: string;
  /** Number of results found */
  resultCount?: number;
}

/** Search context value */
export interface SearchContextValue {
  /** Current search query */
  query: string;
  /** Set search query */
  setQuery: (query: string) => void;
  /** Debounced query */
  debouncedQuery: string;
  /** Whether currently searching */
  isSearching: boolean;
  /** Recent searches */
  recentSearches: RecentSearch[];
  /** Add to recent searches */
  addRecentSearch: (search: RecentSearch) => void;
  /** Clear recent searches */
  clearRecentSearches: () => void;
  /** Remove a specific recent search */
  removeRecentSearch: (query: string) => void;
}

/** Search input props */
export interface SearchInputProps {
  /** Current value */
  value: string;
  /** Change handler */
  onChange: (value: string) => void;
  /** Submit handler */
  onSubmit?: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Debounce delay in ms */
  debounceMs?: number;
  /** Show loading indicator */
  loading?: boolean;
  /** Show clear button */
  showClear?: boolean;
  /** Input size */
  size?: 'sm' | 'md' | 'lg';
  /** Additional class */
  className?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Auto focus */
  autoFocus?: boolean;
}

// ============================================================================
// 21.1: DEBOUNCE HOOKS
// ============================================================================

/**
 * Debounce a value
 * 
 * @example
 * ```tsx
 * const [search, setSearch] = useState('');
 * const debouncedSearch = useDebounce(search, 300);
 * ```
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Debounce a callback function
 * 
 * @example
 * ```tsx
 * const handleSearch = useDebouncedCallback((query: string) => {
 *   fetchResults(query);
 * }, 300);
 * ```
 */
export function useDebouncedCallback<T extends (...args: never[]) => void>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const callbackRef = useRef(callback);
  const timeoutRef = useRef<NodeJS.Timeout>();

  // Update callback ref
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay]
  );
}

/** Debounced search options */
export interface UseDebouncedSearchOptions<T> {
  /** Initial query */
  initialQuery?: string;
  /** Debounce delay in ms */
  debounceMs?: number;
  /** Minimum query length to trigger search */
  minLength?: number;
  /** Search function */
  searchFn: (query: string) => Promise<T[]>;
  /** Callback on search complete */
  onSearchComplete?: (results: T[], query: string) => void;
  /** Callback on search error */
  onSearchError?: (error: Error) => void;
}

/** Debounced search result */
export interface UseDebouncedSearchResult<T> {
  /** Current query */
  query: string;
  /** Set query */
  setQuery: (query: string) => void;
  /** Debounced query */
  debouncedQuery: string;
  /** Search results */
  results: T[];
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Clear results */
  clear: () => void;
  /** Trigger search immediately */
  search: (query?: string) => Promise<void>;
}

/**
 * Hook for debounced searching with loading states
 * 
 * @example
 * ```tsx
 * const { query, setQuery, results, isLoading } = useDebouncedSearch({
 *   searchFn: async (q) => api.searchOrders(q),
 *   debounceMs: 300,
 *   minLength: 2,
 * });
 * ```
 */
export function useDebouncedSearch<T>(
  options: UseDebouncedSearchOptions<T>
): UseDebouncedSearchResult<T> {
  const {
    initialQuery = '',
    debounceMs = 300,
    minLength = 1,
    searchFn,
    onSearchComplete,
    onSearchError,
  } = options;

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const debouncedQuery = useDebounce(query, debounceMs);
  const searchFnRef = useRef(searchFn);
  searchFnRef.current = searchFn;

  // Perform search when debounced query changes
  useEffect(() => {
    if (debouncedQuery.length < minLength) {
      setResults([]);
      return;
    }

    let cancelled = false;

    const performSearch = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const searchResults = await searchFnRef.current(debouncedQuery);
        if (!cancelled) {
          setResults(searchResults);
          onSearchComplete?.(searchResults, debouncedQuery);
        }
      } catch (err) {
        if (!cancelled) {
          const error = err instanceof Error ? err : new Error(String(err));
          setError(error);
          onSearchError?.(error);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    performSearch();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, minLength, onSearchComplete, onSearchError]);

  const clear = useCallback(() => {
    setQuery('');
    setResults([]);
    setError(null);
  }, []);

  const search = useCallback(
    async (q?: string) => {
      const searchQuery = q ?? query;
      if (searchQuery.length < minLength) return;

      setIsLoading(true);
      setError(null);

      try {
        const searchResults = await searchFnRef.current(searchQuery);
        setResults(searchResults);
        onSearchComplete?.(searchResults, searchQuery);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onSearchError?.(error);
      } finally {
        setIsLoading(false);
      }
    },
    [query, minLength, onSearchComplete, onSearchError]
  );

  return {
    query,
    setQuery,
    debouncedQuery,
    results,
    isLoading,
    error,
    clear,
    search,
  };
}

// ============================================================================
// 21.2: FILTER BUILDER UTILITIES
// ============================================================================

/**
 * Create a filter rule
 */
export function createFilterRule(
  field: string,
  operator: FilterOperator,
  value: unknown
): FilterRule {
  return { field, operator, value };
}

/**
 * Create a filter group
 */
export function createFilterGroup(
  logic: 'and' | 'or',
  rules: (FilterRule | FilterGroup)[]
): FilterGroup {
  return { logic, rules };
}

/**
 * Check if a value matches a filter rule
 */
export function matchesFilterRule<T extends Record<string, unknown>>(
  item: T,
  rule: FilterRule
): boolean {
  const fieldValue = item[rule.field];
  const { operator, value } = rule;

  switch (operator) {
    case 'eq':
      return fieldValue === value;
    case 'neq':
      return fieldValue !== value;
    case 'gt':
      return typeof fieldValue === 'number' && typeof value === 'number' && fieldValue > value;
    case 'gte':
      return typeof fieldValue === 'number' && typeof value === 'number' && fieldValue >= value;
    case 'lt':
      return typeof fieldValue === 'number' && typeof value === 'number' && fieldValue < value;
    case 'lte':
      return typeof fieldValue === 'number' && typeof value === 'number' && fieldValue <= value;
    case 'contains':
      return typeof fieldValue === 'string' && typeof value === 'string' &&
        fieldValue.toLowerCase().includes(value.toLowerCase());
    case 'notContains':
      return typeof fieldValue === 'string' && typeof value === 'string' &&
        !fieldValue.toLowerCase().includes(value.toLowerCase());
    case 'startsWith':
      return typeof fieldValue === 'string' && typeof value === 'string' &&
        fieldValue.toLowerCase().startsWith(value.toLowerCase());
    case 'endsWith':
      return typeof fieldValue === 'string' && typeof value === 'string' &&
        fieldValue.toLowerCase().endsWith(value.toLowerCase());
    case 'in':
      return Array.isArray(value) && value.includes(fieldValue);
    case 'notIn':
      return Array.isArray(value) && !value.includes(fieldValue);
    case 'between':
      if (Array.isArray(value) && value.length === 2) {
        const [min, max] = value;
        return typeof fieldValue === 'number' &&
          typeof min === 'number' &&
          typeof max === 'number' &&
          fieldValue >= min &&
          fieldValue <= max;
      }
      return false;
    case 'isNull':
      return fieldValue === null || fieldValue === undefined;
    case 'isNotNull':
      return fieldValue !== null && fieldValue !== undefined;
    default:
      return true;
  }
}

/**
 * Check if a value matches a filter group
 */
export function matchesFilterGroup<T extends Record<string, unknown>>(
  item: T,
  group: FilterGroup
): boolean {
  const { logic, rules } = group;

  if (logic === 'and') {
    return rules.every((rule) => {
      if ('logic' in rule) {
        return matchesFilterGroup(item, rule);
      }
      return matchesFilterRule(item, rule);
    });
  } else {
    return rules.some((rule) => {
      if ('logic' in rule) {
        return matchesFilterGroup(item, rule);
      }
      return matchesFilterRule(item, rule);
    });
  }
}

/**
 * Filter an array using filter rules or groups
 */
export function filterArray<T extends Record<string, unknown>>(
  items: T[],
  filter: FilterRule | FilterGroup
): T[] {
  return items.filter((item) => {
    if ('logic' in filter) {
      return matchesFilterGroup(item, filter);
    }
    return matchesFilterRule(item, filter);
  });
}

/**
 * Convert filter rules to URL query params
 */
export function filterToQueryParams(filter: FilterRule | FilterGroup): URLSearchParams {
  const params = new URLSearchParams();

  const addRule = (rule: FilterRule, prefix: string = '') => {
    const key = prefix ? `${prefix}[${rule.field}]` : rule.field;
    const opKey = `${key}[${rule.operator}]`;
    
    if (Array.isArray(rule.value)) {
      params.set(opKey, rule.value.join(','));
    } else if (rule.value !== null && rule.value !== undefined) {
      params.set(opKey, String(rule.value));
    } else {
      params.set(opKey, '');
    }
  };

  const processFilter = (f: FilterRule | FilterGroup, prefix: string = '') => {
    if ('logic' in f) {
      f.rules.forEach((rule, i) => {
        processFilter(rule, `${prefix}${f.logic}[${i}]`);
      });
    } else {
      addRule(f, prefix);
    }
  };

  processFilter(filter);
  return params;
}

// ============================================================================
// 21.3: TEXT HIGHLIGHTING
// ============================================================================

/** Highlight match props */
export interface HighlightMatchProps {
  /** Text to search in */
  text: string;
  /** Query to highlight */
  query: string;
  /** Case sensitive matching */
  caseSensitive?: boolean;
  /** Highlight all matches or just first */
  highlightAll?: boolean;
  /** Custom highlight class */
  highlightClassName?: string;
  /** Custom text class */
  textClassName?: string;
}

/**
 * Highlight matching text in a string
 * 
 * @example
 * ```tsx
 * <HighlightMatch text="Hello World" query="wor" />
 * // Renders: Hello <mark>Wor</mark>ld
 * ```
 */
export function HighlightMatch({
  text,
  query,
  caseSensitive = false,
  highlightAll = true,
  highlightClassName = 'bg-yellow-200 dark:bg-yellow-800',
  textClassName,
}: HighlightMatchProps) {
  if (!query.trim()) {
    return <span className={textClassName}>{text}</span>;
  }

  const flags = caseSensitive ? 'g' : 'gi';
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, highlightAll ? flags : flags.replace('g', ''));

  const parts = text.split(regex);

  return (
    <span className={textClassName}>
      {parts.map((part, i) => {
        const isMatch = caseSensitive
          ? part === query
          : part.toLowerCase() === query.toLowerCase();

        if (isMatch) {
          return (
            <mark key={i} className={clsx('px-0.5 rounded', highlightClassName)}>
              {part}
            </mark>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

/**
 * Get highlighted segments for custom rendering
 */
export function getHighlightSegments(
  text: string,
  query: string,
  caseSensitive = false
): Array<{ text: string; isMatch: boolean }> {
  if (!query.trim()) {
    return [{ text, isMatch: false }];
  }

  const flags = caseSensitive ? 'g' : 'gi';
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, flags);

  const parts = text.split(regex);

  return parts.filter(Boolean).map((part) => ({
    text: part,
    isMatch: caseSensitive
      ? part === query
      : part.toLowerCase() === query.toLowerCase(),
  }));
}

// ============================================================================
// 21.4: RECENT SEARCHES
// ============================================================================

const RECENT_SEARCHES_KEY = 'erp_recent_searches';
const MAX_RECENT_SEARCHES = 10;

/**
 * Hook for managing recent searches
 * 
 * @example
 * ```tsx
 * const { recentSearches, addSearch, removeSearch, clearAll } = useRecentSearches();
 * ```
 */
export function useRecentSearches(options: {
  storageKey?: string;
  maxItems?: number;
  category?: string;
} = {}) {
  const {
    storageKey = RECENT_SEARCHES_KEY,
    maxItems = MAX_RECENT_SEARCHES,
    category,
  } = options;

  const [searches, setSearches] = useState<RecentSearch[]>([]);

  // Load from storage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed: RecentSearch[] = JSON.parse(stored);
        const filtered = category
          ? parsed.filter((s) => s.category === category)
          : parsed;
        setSearches(filtered);
      }
    } catch {
      // Ignore errors
    }
  }, [storageKey, category]);

  // Save to storage
  const saveSearches = useCallback(
    (newSearches: RecentSearch[]) => {
      if (typeof window === 'undefined') return;

      try {
        // Merge with existing searches from other categories
        const stored = localStorage.getItem(storageKey);
        let allSearches: RecentSearch[] = stored ? JSON.parse(stored) : [];

        if (category) {
          // Remove old searches from this category
          allSearches = allSearches.filter((s) => s.category !== category);
        } else {
          allSearches = [];
        }

        allSearches = [...newSearches, ...allSearches].slice(0, maxItems * 2);
        localStorage.setItem(storageKey, JSON.stringify(allSearches));
      } catch {
        // Storage full or unavailable
      }
    },
    [storageKey, category, maxItems]
  );

  const addSearch = useCallback(
    (search: Omit<RecentSearch, 'timestamp'> | string) => {
      const newSearch: RecentSearch =
        typeof search === 'string'
          ? { query: search, timestamp: Date.now(), category }
          : { ...search, timestamp: Date.now(), category: search.category ?? category };

      setSearches((prev) => {
        // Remove duplicate if exists
        const filtered = prev.filter(
          (s) => s.query.toLowerCase() !== newSearch.query.toLowerCase()
        );
        const updated = [newSearch, ...filtered].slice(0, maxItems);
        saveSearches(updated);
        return updated;
      });
    },
    [category, maxItems, saveSearches]
  );

  const removeSearch = useCallback(
    (query: string) => {
      setSearches((prev) => {
        const updated = prev.filter(
          (s) => s.query.toLowerCase() !== query.toLowerCase()
        );
        saveSearches(updated);
        return updated;
      });
    },
    [saveSearches]
  );

  const clearAll = useCallback(() => {
    setSearches([]);
    saveSearches([]);
  }, [saveSearches]);

  return {
    recentSearches: searches,
    addSearch,
    removeSearch,
    clearAll,
  };
}

// ============================================================================
// SEARCH CONTEXT
// ============================================================================

const SearchContext = createContext<SearchContextValue | null>(null);

/**
 * Hook to access search context
 */
export function useSearchContext(): SearchContextValue {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearchContext must be used within a SearchProvider');
  }
  return context;
}

/** Search provider props */
export interface SearchProviderProps {
  children: ReactNode;
  /** Debounce delay in ms */
  debounceMs?: number;
  /** Storage key for recent searches */
  storageKey?: string;
  /** Maximum recent searches */
  maxRecentSearches?: number;
}

/**
 * Provider for global search state
 */
export function SearchProvider({
  children,
  debounceMs = 300,
  storageKey = RECENT_SEARCHES_KEY,
  maxRecentSearches = MAX_RECENT_SEARCHES,
}: SearchProviderProps) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const debouncedQuery = useDebounce(query, debounceMs);

  const {
    recentSearches,
    addSearch,
    removeSearch,
    clearAll: clearRecentSearches,
  } = useRecentSearches({
    storageKey,
    maxItems: maxRecentSearches,
  });

  // Track searching state
  useEffect(() => {
    if (query !== debouncedQuery) {
      setIsSearching(true);
    } else {
      setIsSearching(false);
    }
  }, [query, debouncedQuery]);

  const value = useMemo<SearchContextValue>(
    () => ({
      query,
      setQuery,
      debouncedQuery,
      isSearching,
      recentSearches,
      addRecentSearch: addSearch,
      clearRecentSearches,
      removeRecentSearch: removeSearch,
    }),
    [
      query,
      debouncedQuery,
      isSearching,
      recentSearches,
      addSearch,
      clearRecentSearches,
      removeSearch,
    ]
  );

  return (
    <SearchContext.Provider value={value}>
      {children}
    </SearchContext.Provider>
  );
}

// ============================================================================
// 21.5: SEARCH COMPONENTS
// ============================================================================

/**
 * Search input component with debouncing
 * 
 * @example
 * ```tsx
 * <SearchInput
 *   value={query}
 *   onChange={setQuery}
 *   placeholder="Search orders..."
 *   loading={isLoading}
 * />
 * ```
 */
export function SearchInput({
  value,
  onChange,
  onSubmit,
  placeholder = 'Search...',
  debounceMs,
  loading = false,
  showClear = true,
  size = 'md',
  className,
  disabled = false,
  autoFocus = false,
}: SearchInputProps) {
  const [internalValue, setInternalValue] = useState(value);
  const debouncedOnChange = useDebouncedCallback(onChange, debounceMs ?? 0);

  // Sync internal value with external
  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInternalValue(newValue);

    if (debounceMs) {
      debouncedOnChange(newValue);
    } else {
      onChange(newValue);
    }
  };

  const handleClear = () => {
    setInternalValue('');
    onChange('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onSubmit) {
      onSubmit(internalValue);
    }
    if (e.key === 'Escape') {
      handleClear();
    }
  };

  const sizeClasses = {
    sm: 'h-8 text-sm pl-8 pr-8',
    md: 'h-10 text-sm pl-10 pr-10',
    lg: 'h-12 text-base pl-12 pr-12',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const iconPositions = {
    sm: 'left-2',
    md: 'left-3',
    lg: 'left-4',
  };

  return (
    <div className={clsx('relative', className)}>
      {/* Search icon */}
      <Search
        className={clsx(
          'absolute top-1/2 -translate-y-1/2 text-gray-400',
          iconSizes[size],
          iconPositions[size]
        )}
      />

      {/* Input */}
      <input
        type="text"
        value={internalValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        className={clsx(
          'w-full rounded-lg border border-gray-300 bg-white',
          'focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20',
          'disabled:bg-gray-100 disabled:cursor-not-allowed',
          'dark:bg-gray-800 dark:border-gray-600 dark:focus:border-blue-500',
          'placeholder:text-gray-400',
          sizeClasses[size]
        )}
      />

      {/* Clear button or loading indicator */}
      <div
        className={clsx(
          'absolute top-1/2 -translate-y-1/2 right-2 flex items-center gap-1'
        )}
      >
        {loading && (
          <Loader2
            className={clsx('animate-spin text-gray-400', iconSizes[size])}
          />
        )}
        {showClear && internalValue && !loading && (
          <button
            type="button"
            onClick={handleClear}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className={iconSizes[size]} />
          </button>
        )}
      </div>
    </div>
  );
}

/** Recent searches dropdown props */
export interface RecentSearchesDropdownProps {
  /** Recent searches to display */
  searches: RecentSearch[];
  /** Click handler */
  onSelect: (query: string) => void;
  /** Remove handler */
  onRemove?: (query: string) => void;
  /** Clear all handler */
  onClearAll?: () => void;
  /** Maximum items to show */
  maxItems?: number;
  /** Additional class */
  className?: string;
}

/**
 * Dropdown showing recent searches
 */
export function RecentSearchesDropdown({
  searches,
  onSelect,
  onRemove,
  onClearAll,
  maxItems = 5,
  className,
}: RecentSearchesDropdownProps) {
  const displaySearches = searches.slice(0, maxItems);

  if (displaySearches.length === 0) {
    return null;
  }

  return (
    <div
      className={clsx(
        'bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700',
        'overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Clock className="w-4 h-4" />
          Recent Searches
        </div>
        {onClearAll && (
          <button
            type="button"
            onClick={onClearAll}
            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Search list */}
      <ul className="py-1">
        {displaySearches.map((search) => (
          <li
            key={`${search.query}-${search.timestamp}`}
            className="flex items-center justify-between px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 group"
          >
            <button
              type="button"
              onClick={() => onSelect(search.query)}
              className="flex items-center gap-2 flex-1 text-left"
            >
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-700 dark:text-gray-200">
                {search.query}
              </span>
              {search.resultCount !== undefined && (
                <span className="text-xs text-gray-400">
                  ({search.resultCount} results)
                </span>
              )}
            </button>
            {onRemove && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(search.query);
                }}
                className="p-1 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Search suggestions props */
export interface SearchSuggestionsProps<T> {
  /** Suggestions to display */
  suggestions: SearchResult<T>[];
  /** Query for highlighting */
  query: string;
  /** Select handler */
  onSelect: (result: SearchResult<T>) => void;
  /** Loading state */
  loading?: boolean;
  /** Empty state message */
  emptyMessage?: string;
  /** Additional class */
  className?: string;
  /** Render custom item */
  renderItem?: (result: SearchResult<T>, query: string) => ReactNode;
}

/**
 * Search suggestions dropdown
 */
export function SearchSuggestions<T>({
  suggestions,
  query,
  onSelect,
  loading = false,
  emptyMessage = 'No results found',
  className,
  renderItem,
}: SearchSuggestionsProps<T>) {
  if (loading) {
    return (
      <div
        className={clsx(
          'bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700',
          'p-4 flex items-center justify-center gap-2 text-gray-500',
          className
        )}
      >
        <Loader2 className="w-4 h-4 animate-spin" />
        Searching...
      </div>
    );
  }

  if (suggestions.length === 0 && query) {
    return (
      <div
        className={clsx(
          'bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700',
          'p-4 text-center text-gray-500',
          className
        )}
      >
        {emptyMessage}
      </div>
    );
  }

  if (suggestions.length === 0) {
    return null;
  }

  // Group by category
  const grouped = suggestions.reduce(
    (acc, result) => {
      const cat = result.category || 'Results';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(result);
      return acc;
    },
    {} as Record<string, SearchResult<T>[]>
  );

  return (
    <div
      className={clsx(
        'bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700',
        'overflow-hidden max-h-80 overflow-y-auto',
        className
      )}
    >
      {Object.entries(grouped).map(([category, results]) => (
        <div key={category}>
          {Object.keys(grouped).length > 1 && (
            <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 text-xs font-medium text-gray-500 uppercase tracking-wide">
              {category}
            </div>
          )}
          <ul>
            {results.map((result) => (
              <li key={result.id}>
                <button
                  type="button"
                  onClick={() => onSelect(result)}
                  className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
                >
                  {renderItem ? (
                    renderItem(result, query)
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <HighlightMatch
                          text={result.label}
                          query={query}
                          textClassName="text-sm font-medium text-gray-900 dark:text-white block truncate"
                        />
                        {result.description && (
                          <HighlightMatch
                            text={result.description}
                            query={query}
                            textClassName="text-xs text-gray-500 block truncate"
                          />
                        )}
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    </>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// SEARCH UTILITIES
// ============================================================================

/**
 * Simple fuzzy search scoring
 */
export function fuzzyScore(query: string, target: string): number {
  return scoreSearchText(target, query);
}

/**
 * Search and rank results
 */
export function searchAndRank<T>(
  items: T[],
  query: string,
  getSearchableText: (item: T) => string | string[],
  minScore: number = 10
): Array<T & { _searchScore: number }> {
  if (!query.trim()) {
    return items.map((item) => ({ ...item, _searchScore: 0 }));
  }

  return items
    .map((item) => {
      const texts = getSearchableText(item);
      const textArray = Array.isArray(texts) ? texts : [texts];

      const maxScore = Math.max(
        ...textArray.map((text) => fuzzyScore(query, text))
      );

      return { ...item, _searchScore: maxScore };
    })
    .filter((item) => item._searchScore >= minScore)
    .sort((a, b) => b._searchScore - a._searchScore);
}

// ============================================================================
// EXPORTS
// ============================================================================

// Types are exported inline at their definitions
