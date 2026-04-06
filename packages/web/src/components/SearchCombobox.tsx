import React, { useState, useRef, useEffect, useCallback } from 'react';
import clsx from 'clsx';
import { Search, X, ChevronDown, Check, Loader2 } from 'lucide-react';
import { matchesSearchFields } from '@erp/shared';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface ComboboxOption<T = string> {
  /** Unique value for the option */
  value: T;
  /** Display label */
  label: string;
  /** Optional description/subtitle */
  description?: string;
  /** Optional icon component */
  icon?: React.ReactNode;
  /** Disabled state */
  disabled?: boolean;
  /** Group label */
  group?: string;
}

export interface SearchComboboxProps<T = string> {
  /** Array of options */
  options: ComboboxOption<T>[];
  /** Selected value(s) */
  value: T | T[] | null;
  /** Change handler */
  onChange: (value: T | T[] | null) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Whether to allow multiple selection */
  multiple?: boolean;
  /** Whether to enable search filtering */
  searchable?: boolean;
  /** Whether the combobox is disabled */
  disabled?: boolean;
  /** Whether the combobox is loading */
  loading?: boolean;
  /** Whether to allow clearing the selection */
  clearable?: boolean;
  /** Custom filter function */
  filterFn?: (option: ComboboxOption<T>, query: string) => boolean;
  /** Async search function (debounced) */
  onSearch?: (query: string) => Promise<void>;
  /** Debounce delay for async search (ms) */
  debounceMs?: number;
  /** Empty state message */
  emptyMessage?: string;
  /** Loading message */
  loadingMessage?: string;
  /** Custom className */
  className?: string;
  /** Error state */
  error?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Maximum height of dropdown */
  maxHeight?: number;
}

export interface AsyncSearchComboboxProps<T = string> extends Omit<SearchComboboxProps<T>, 'options'> {
  /** Async function to load options */
  loadOptions: (query: string) => Promise<ComboboxOption<T>[]>;
  /** Minimum characters before search triggers */
  minChars?: number;
  /** Initial options to show before search */
  initialOptions?: ComboboxOption<T>[];
}

// ============================================================================
// Hooks
// ============================================================================

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

function useClickOutside(
  ref: React.RefObject<HTMLElement>,
  handler: () => void,
) {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) {
        return;
      }
      handler();
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);

    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
}

// ============================================================================
// SearchCombobox Component
// ============================================================================

export function SearchCombobox<T = string>({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  multiple = false,
  searchable = true,
  disabled = false,
  loading = false,
  clearable = true,
  filterFn,
  onSearch,
  debounceMs = 300,
  emptyMessage = 'No options found',
  loadingMessage = 'Loading...',
  className,
  error = false,
  size = 'md',
  maxHeight = 300,
}: SearchComboboxProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const debouncedQuery = useDebounce(query, debounceMs);

  useClickOutside(containerRef, () => setIsOpen(false));

  // Default filter function
  const defaultFilter = useCallback(
    (option: ComboboxOption<T>, q: string) =>
      matchesSearchFields([option.label, option.description, option.group], q),
    [],
  );

  const activeFilter = filterFn || defaultFilter;

  // Filter options
  const filteredOptions = query
    ? options.filter((opt) => activeFilter(opt, query))
    : options;

  // Group options if any have groups
  const groupedOptions = filteredOptions.reduce((acc, opt) => {
    const group = opt.group || '';
    if (!acc[group]) acc[group] = [];
    acc[group].push(opt);
    return acc;
  }, {} as Record<string, ComboboxOption<T>[]>);

  // Async search effect
  useEffect(() => {
    if (onSearch && debouncedQuery) {
      setIsSearching(true);
      onSearch(debouncedQuery).finally(() => setIsSearching(false));
    }
  }, [debouncedQuery, onSearch]);

  // Handle keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!isOpen && event.key !== 'Escape') {
      setIsOpen(true);
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : 0,
        );
        break;
      case 'ArrowUp':
        event.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredOptions.length - 1,
        );
        break;
      case 'Enter':
        event.preventDefault();
        if (filteredOptions[highlightedIndex]) {
          handleSelect(filteredOptions[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  // Handle selection
  const handleSelect = (option: ComboboxOption<T>) => {
    if (option.disabled) return;

    if (multiple) {
      const currentValues = (value as T[]) || [];
      const isSelected = currentValues.includes(option.value);
      if (isSelected) {
        onChange(currentValues.filter((v) => v !== option.value));
      } else {
        onChange([...currentValues, option.value]);
      }
    } else {
      onChange(option.value);
      setIsOpen(false);
    }
    setQuery('');
  };

  // Clear selection
  const handleClear = (event: React.MouseEvent) => {
    event.stopPropagation();
    onChange(multiple ? [] : null);
    setQuery('');
  };

  // Check if value is selected
  const isSelected = (optionValue: T) => {
    if (multiple) {
      return ((value as T[]) || []).includes(optionValue);
    }
    return value === optionValue;
  };

  // Get display label
  const getDisplayLabel = () => {
    if (multiple) {
      const selectedOptions = options.filter((opt) =>
        ((value as T[]) || []).includes(opt.value),
      );
      if (selectedOptions.length === 0) return null;
      if (selectedOptions.length === 1) return selectedOptions[0].label;
      return `${selectedOptions.length} selected`;
    }
    const selected = options.find((opt) => opt.value === value);
    return selected?.label || null;
  };

  // Size classes
  const sizeClasses = {
    sm: {
      container: 'text-sm',
      input: 'py-1.5 px-2.5',
      icon: 'h-4 w-4',
      option: 'py-1.5 px-2.5',
    },
    md: {
      container: 'text-sm',
      input: 'py-2 px-3',
      icon: 'h-4 w-4',
      option: 'py-2 px-3',
    },
    lg: {
      container: 'text-base',
      input: 'py-2.5 px-3.5',
      icon: 'h-5 w-5',
      option: 'py-2.5 px-3.5',
    },
  };

  const styles = sizeClasses[size];
  const displayLabel = getDisplayLabel();
  const hasValue = multiple ? ((value as T[]) || []).length > 0 : value != null;
  const showLoader = loading || isSearching;

  return (
    <div
      ref={containerRef}
      className={clsx('relative', styles.container, className)}
    >
      {/* Trigger / Input */}
      <div
        onClick={() => !disabled && setIsOpen(true)}
        className={clsx(
          'relative flex items-center w-full bg-white border rounded-lg transition-colors',
          isOpen && 'ring-2 ring-blue-500 border-blue-500',
          error && !isOpen && 'border-red-300',
          !isOpen && !error && 'border-gray-300 hover:border-gray-400',
          disabled && 'bg-gray-100 cursor-not-allowed',
          !disabled && 'cursor-pointer',
        )}
      >
        {searchable && isOpen ? (
          <div className="flex items-center w-full">
            <Search className={clsx('ml-3 text-gray-400', styles.icon)} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={displayLabel || placeholder}
              autoFocus
              className={clsx(
                'flex-1 outline-none bg-transparent',
                styles.input,
              )}
            />
          </div>
        ) : (
          <div className={clsx('flex-1 truncate text-left', styles.input)}>
            {displayLabel || (
              <span className="text-gray-400">{placeholder}</span>
            )}
          </div>
        )}

        <div className="flex items-center gap-1 pr-2">
          {showLoader && (
            <Loader2 className={clsx('animate-spin text-gray-400', styles.icon)} />
          )}
          {clearable && hasValue && !disabled && (
            <button
              onClick={handleClear}
              className="p-0.5 hover:bg-gray-100 rounded"
            >
              <X className={clsx('text-gray-400', styles.icon)} />
            </button>
          )}
          <ChevronDown
            className={clsx(
              'text-gray-400 transition-transform',
              styles.icon,
              isOpen && 'rotate-180',
            )}
          />
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <ul
          ref={listRef}
          role="listbox"
          className={clsx(
            'absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-auto',
          )}
          style={{ maxHeight }}
        >
          {showLoader && filteredOptions.length === 0 ? (
            <li className={clsx('text-gray-500 text-center', styles.option)}>
              {loadingMessage}
            </li>
          ) : filteredOptions.length === 0 ? (
            <li className={clsx('text-gray-500 text-center', styles.option)}>
              {emptyMessage}
            </li>
          ) : (
            Object.entries(groupedOptions).map(([group, groupOptions]) => (
              <React.Fragment key={group || 'default'}>
                {group && (
                  <li className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50">
                    {group}
                  </li>
                )}
                {groupOptions.map((option) => {
                  const index = filteredOptions.indexOf(option);
                  const selected = isSelected(option.value);

                  return (
                    <li
                      key={String(option.value)}
                      role="option"
                      aria-selected={selected}
                      onClick={() => handleSelect(option)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      className={clsx(
                        'flex items-center gap-2 cursor-pointer transition-colors',
                        styles.option,
                        highlightedIndex === index && 'bg-gray-100',
                        selected && 'bg-blue-50',
                        option.disabled && 'opacity-50 cursor-not-allowed',
                      )}
                    >
                      {option.icon && (
                        <span className="flex-shrink-0">{option.icon}</span>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="truncate">{option.label}</div>
                        {option.description && (
                          <div className="text-xs text-gray-500 truncate">
                            {option.description}
                          </div>
                        )}
                      </div>
                      {selected && (
                        <Check className={clsx('text-blue-600', styles.icon)} />
                      )}
                    </li>
                  );
                })}
              </React.Fragment>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

// ============================================================================
// AsyncSearchCombobox - With async option loading
// ============================================================================

export function AsyncSearchCombobox<T = string>({
  loadOptions,
  minChars = 1,
  initialOptions = [],
  ...props
}: AsyncSearchComboboxProps<T>) {
  const [options, setOptions] = useState<ComboboxOption<T>[]>(initialOptions);
  const [loading, setLoading] = useState(false);

  const handleSearch = useCallback(
    async (query: string) => {
      if (query.length < minChars) {
        setOptions(initialOptions);
        return;
      }

      setLoading(true);
      try {
        const results = await loadOptions(query);
        setOptions(results);
      } catch (error) {
        console.error('Failed to load options:', error);
        setOptions([]);
      } finally {
        setLoading(false);
      }
    },
    [loadOptions, minChars, initialOptions],
  );

  return (
    <SearchCombobox
      {...props}
      options={options}
      loading={loading}
      onSearch={handleSearch}
    />
  );
}

// ============================================================================
// SimpleSelect - Non-searchable select
// ============================================================================

export interface SimpleSelectProps<T = string> {
  options: ComboboxOption<T>[];
  value: T | null;
  onChange: (value: T | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function SimpleSelect<T = string>({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  disabled = false,
  className,
  size = 'md',
}: SimpleSelectProps<T>) {
  return (
    <SearchCombobox
      options={options}
      value={value}
      onChange={(v) => onChange(v as T | null)}
      placeholder={placeholder}
      disabled={disabled}
      searchable={false}
      clearable={false}
      className={className}
      size={size}
    />
  );
}

// ============================================================================
// MultiSelect - Multi-select variant
// ============================================================================

export interface MultiSelectProps<T = string> {
  options: ComboboxOption<T>[];
  value: T[];
  onChange: (value: T[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  maxDisplay?: number;
}

export function MultiSelect<T = string>({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  disabled = false,
  className,
  size = 'md',
  maxDisplay = 3,
}: MultiSelectProps<T>) {
  const selectedOptions = options.filter((opt) => value.includes(opt.value));

  return (
    <div className={className}>
      <SearchCombobox
        options={options}
        value={value}
        onChange={(v) => onChange(v as T[])}
        placeholder={placeholder}
        disabled={disabled}
        multiple
        size={size}
      />
      {/* Selected tags */}
      {selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {selectedOptions.slice(0, maxDisplay).map((opt) => (
            <span
              key={String(opt.value)}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full"
            >
              {opt.label}
              <button
                onClick={() => onChange(value.filter((v) => v !== opt.value))}
                className="hover:bg-blue-200 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {selectedOptions.length > maxDisplay && (
            <span className="inline-flex items-center px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
              +{selectedOptions.length - maxDisplay} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// TagInput - For entering tags/keywords
// ============================================================================

export interface TagInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  maxTags?: number;
  suggestions?: string[];
}

export function TagInput({
  value,
  onChange,
  placeholder = 'Add tag...',
  disabled = false,
  className,
  maxTags,
  suggestions = [],
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredSuggestions = suggestions.filter(
    (s) =>
      s.toLowerCase().includes(inputValue.toLowerCase()) &&
      !value.includes(s),
  );

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed || value.includes(trimmed)) return;
    if (maxTags && value.length >= maxTags) return;

    onChange([...value, trimmed]);
    setInputValue('');
    setShowSuggestions(false);
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((t) => t !== tag));
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && inputValue) {
      event.preventDefault();
      addTag(inputValue);
    } else if (event.key === 'Backspace' && !inputValue && value.length > 0) {
      removeTag(value[value.length - 1]);
    }
  };

  return (
    <div className={clsx('relative', className)}>
      <div
        onClick={() => inputRef.current?.focus()}
        className={clsx(
          'flex flex-wrap items-center gap-1 p-2 border border-gray-300 rounded-lg bg-white min-h-[42px]',
          disabled && 'bg-gray-100 cursor-not-allowed',
        )}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-1 text-sm bg-blue-100 text-blue-700 rounded-full"
          >
            {tag}
            {!disabled && (
              <button
                onClick={() => removeTag(tag)}
                className="hover:bg-blue-200 rounded-full"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
        {(!maxTags || value.length < maxTags) && (
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            onKeyDown={handleKeyDown}
            placeholder={value.length === 0 ? placeholder : ''}
            disabled={disabled}
            className="flex-1 min-w-[100px] outline-none text-sm bg-transparent"
          />
        )}
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && filteredSuggestions.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-auto">
          {filteredSuggestions.map((suggestion) => (
            <li
              key={suggestion}
              onClick={() => addTag(suggestion)}
              className="px-3 py-2 text-sm hover:bg-gray-100 cursor-pointer"
            >
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
