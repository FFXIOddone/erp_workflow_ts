/**
 * Advanced Table Filters
 * 
 * Comprehensive filtering system for tables:
 * - Text search with fuzzy matching
 * - Date range filters
 * - Numeric range filters
 * - Multi-select filters
 * - Filter presets/saved filters
 * - Filter chips display
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
  Search,
  Filter,
  X,
  ChevronDown,
  Calendar,
  Plus,
  Save,
  Trash2,
  Check,
  RotateCcw,
} from 'lucide-react';
import { format, isValid, parseISO, startOfDay, endOfDay, subDays, subMonths } from 'date-fns';
import { clsx } from 'clsx';
import type { ColumnDef } from './AdvancedTable';

// ============================================================================
// Types
// ============================================================================

export type FilterOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'startsWith'
  | 'endsWith'
  | 'greaterThan'
  | 'lessThan'
  | 'greaterOrEqual'
  | 'lessOrEqual'
  | 'between'
  | 'isEmpty'
  | 'isNotEmpty'
  | 'in'
  | 'notIn';

export interface ColumnFilter {
  columnId: string;
  operator: FilterOperator;
  value: unknown;
  secondValue?: unknown; // For 'between' operator
}

export interface FilterPreset {
  id: string;
  name: string;
  filters: ColumnFilter[];
  createdAt: Date;
}

export interface FilterState {
  globalSearch: string;
  columnFilters: ColumnFilter[];
  activePresetId: string | null;
}

export interface TableFiltersProps<TData> {
  columns: ColumnDef<TData>[];
  data: TData[];
  state: FilterState;
  onStateChange: (state: FilterState) => void;
  presets?: FilterPreset[];
  onSavePreset?: (name: string, filters: ColumnFilter[]) => void;
  onDeletePreset?: (presetId: string) => void;
  showGlobalSearch?: boolean;
  showColumnFilters?: boolean;
  showPresets?: boolean;
  className?: string;
}

export interface FilterBarProps<TData> {
  columns: ColumnDef<TData>[];
  state: FilterState;
  onStateChange: (state: FilterState) => void;
  className?: string;
}

// ============================================================================
// Filter Context
// ============================================================================

interface FilterContextValue<TData> {
  state: FilterState;
  columns: ColumnDef<TData>[];
  updateState: (updates: Partial<FilterState>) => void;
  addFilter: (filter: ColumnFilter) => void;
  updateFilter: (index: number, filter: ColumnFilter) => void;
  removeFilter: (index: number) => void;
  clearFilters: () => void;
  getColumnOptions: (columnId: string) => unknown[];
}

const FilterContext = createContext<FilterContextValue<unknown> | null>(null);

function useFilterContext<TData>() {
  const context = useContext(FilterContext) as FilterContextValue<TData> | null;
  if (!context) {
    throw new Error('Filter components must be used within TableFilters');
  }
  return context;
}

// ============================================================================
// Filter Functions
// ============================================================================

/**
 * Apply filters to data
 */
export function applyFilters<TData>(
  data: TData[],
  columns: ColumnDef<TData>[],
  state: FilterState
): TData[] {
  let filtered = [...data];
  
  // Apply global search
  if (state.globalSearch.trim()) {
    const searchLower = state.globalSearch.toLowerCase();
    const searchableColumns = columns.filter((c) => c.filterable !== false);
    
    filtered = filtered.filter((row) =>
      searchableColumns.some((col) => {
        const value = typeof col.accessor === 'function'
          ? col.accessor(row)
          : row[col.accessor as keyof TData];
        
        if (value == null) return false;
        return String(value).toLowerCase().includes(searchLower);
      })
    );
  }
  
  // Apply column filters
  for (const filter of state.columnFilters) {
    const column = columns.find((c) => c.id === filter.columnId);
    if (!column) continue;
    
    filtered = filtered.filter((row) => {
      const value = typeof column.accessor === 'function'
        ? column.accessor(row)
        : row[column.accessor as keyof TData];
      
      return matchesFilter(value, filter);
    });
  }
  
  return filtered;
}

/**
 * Check if a value matches a filter
 */
function matchesFilter(value: unknown, filter: ColumnFilter): boolean {
  const { operator, value: filterValue, secondValue } = filter;
  
  // Handle null/undefined
  if (operator === 'isEmpty') {
    return value == null || value === '';
  }
  if (operator === 'isNotEmpty') {
    return value != null && value !== '';
  }
  
  if (value == null) return false;
  
  // String operations
  const strValue = String(value).toLowerCase();
  const strFilter = String(filterValue ?? '').toLowerCase();
  
  switch (operator) {
    case 'equals':
      if (typeof value === 'number') return value === Number(filterValue);
      if (value instanceof Date) return value.getTime() === new Date(filterValue as string).getTime();
      return strValue === strFilter;
    
    case 'notEquals':
      if (typeof value === 'number') return value !== Number(filterValue);
      return strValue !== strFilter;
    
    case 'contains':
      return strValue.includes(strFilter);
    
    case 'notContains':
      return !strValue.includes(strFilter);
    
    case 'startsWith':
      return strValue.startsWith(strFilter);
    
    case 'endsWith':
      return strValue.endsWith(strFilter);
    
    case 'greaterThan':
      if (typeof value === 'number') return value > Number(filterValue);
      if (value instanceof Date) return value > new Date(filterValue as string);
      return strValue > strFilter;
    
    case 'lessThan':
      if (typeof value === 'number') return value < Number(filterValue);
      if (value instanceof Date) return value < new Date(filterValue as string);
      return strValue < strFilter;
    
    case 'greaterOrEqual':
      if (typeof value === 'number') return value >= Number(filterValue);
      return strValue >= strFilter;
    
    case 'lessOrEqual':
      if (typeof value === 'number') return value <= Number(filterValue);
      return strValue <= strFilter;
    
    case 'between':
      if (typeof value === 'number') {
        return value >= Number(filterValue) && value <= Number(secondValue);
      }
      if (value instanceof Date) {
        const start = new Date(filterValue as string);
        const end = new Date(secondValue as string);
        return value >= start && value <= end;
      }
      return strValue >= strFilter && strValue <= String(secondValue ?? '').toLowerCase();
    
    case 'in':
      if (Array.isArray(filterValue)) {
        return filterValue.some((v) => String(v).toLowerCase() === strValue);
      }
      return false;
    
    case 'notIn':
      if (Array.isArray(filterValue)) {
        return !filterValue.some((v) => String(v).toLowerCase() === strValue);
      }
      return true;
    
    default:
      return true;
  }
}

/**
 * Get unique values for a column (for multi-select filters)
 */
function getUniqueValues<TData>(data: TData[], column: ColumnDef<TData>): unknown[] {
  const values = new Set<unknown>();
  
  data.forEach((row) => {
    const value = typeof column.accessor === 'function'
      ? column.accessor(row)
      : row[column.accessor as keyof TData];
    
    if (value != null && value !== '') {
      values.add(value);
    }
  });
  
  return Array.from(values).sort((a, b) => {
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    return String(a).localeCompare(String(b));
  });
}

// ============================================================================
// Operator Labels
// ============================================================================

const operatorLabels: Record<FilterOperator, string> = {
  equals: 'equals',
  notEquals: 'does not equal',
  contains: 'contains',
  notContains: 'does not contain',
  startsWith: 'starts with',
  endsWith: 'ends with',
  greaterThan: 'greater than',
  lessThan: 'less than',
  greaterOrEqual: 'greater or equal',
  lessOrEqual: 'less or equal',
  between: 'between',
  isEmpty: 'is empty',
  isNotEmpty: 'is not empty',
  in: 'is one of',
  notIn: 'is not one of',
};

const textOperators: FilterOperator[] = [
  'contains', 'notContains', 'equals', 'notEquals',
  'startsWith', 'endsWith', 'isEmpty', 'isNotEmpty',
];

const numberOperators: FilterOperator[] = [
  'equals', 'notEquals', 'greaterThan', 'lessThan',
  'greaterOrEqual', 'lessOrEqual', 'between', 'isEmpty', 'isNotEmpty',
];

const dateOperators: FilterOperator[] = [
  'equals', 'greaterThan', 'lessThan', 'between', 'isEmpty', 'isNotEmpty',
];

const selectOperators: FilterOperator[] = [
  'equals', 'notEquals', 'in', 'notIn', 'isEmpty', 'isNotEmpty',
];

// ============================================================================
// Main TableFilters Component
// ============================================================================

export function TableFilters<TData>({
  columns,
  data,
  state,
  onStateChange,
  presets = [],
  onSavePreset,
  onDeletePreset,
  showGlobalSearch = true,
  showColumnFilters = true,
  showPresets = false,
  className,
}: TableFiltersProps<TData>) {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [showSavePreset, setShowSavePreset] = useState(false);
  
  const filterableColumns = useMemo(
    () => columns.filter((c) => c.filterable !== false),
    [columns]
  );
  
  // Context helpers
  const updateState = useCallback((updates: Partial<FilterState>) => {
    onStateChange({ ...state, ...updates });
  }, [state, onStateChange]);
  
  const addFilter = useCallback((filter: ColumnFilter) => {
    onStateChange({
      ...state,
      columnFilters: [...state.columnFilters, filter],
      activePresetId: null,
    });
  }, [state, onStateChange]);
  
  const updateFilter = useCallback((index: number, filter: ColumnFilter) => {
    const newFilters = [...state.columnFilters];
    newFilters[index] = filter;
    onStateChange({
      ...state,
      columnFilters: newFilters,
      activePresetId: null,
    });
  }, [state, onStateChange]);
  
  const removeFilter = useCallback((index: number) => {
    onStateChange({
      ...state,
      columnFilters: state.columnFilters.filter((_, i) => i !== index),
      activePresetId: null,
    });
  }, [state, onStateChange]);
  
  const clearFilters = useCallback(() => {
    onStateChange({
      globalSearch: '',
      columnFilters: [],
      activePresetId: null,
    });
  }, [onStateChange]);
  
  const getColumnOptions = useCallback((columnId: string) => {
    const column = columns.find((c) => c.id === columnId);
    if (!column) return [];
    return getUniqueValues(data, column);
  }, [columns, data]);
  
  const applyPreset = useCallback((preset: FilterPreset) => {
    onStateChange({
      ...state,
      columnFilters: preset.filters,
      activePresetId: preset.id,
    });
  }, [state, onStateChange]);
  
  const handleSavePreset = useCallback(() => {
    if (presetName.trim() && onSavePreset) {
      onSavePreset(presetName.trim(), state.columnFilters);
      setPresetName('');
      setShowSavePreset(false);
    }
  }, [presetName, state.columnFilters, onSavePreset]);
  
  const contextValue: FilterContextValue<TData> = {
    state,
    columns: filterableColumns,
    updateState,
    addFilter,
    updateFilter,
    removeFilter,
    clearFilters,
    getColumnOptions,
  };
  
  const hasActiveFilters = state.globalSearch || state.columnFilters.length > 0;
  
  return (
    <FilterContext.Provider value={contextValue as FilterContextValue<unknown>}>
      <div className={clsx('space-y-3', className)}>
        {/* Main filter bar */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Global search */}
          {showGlobalSearch && (
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search all columns..."
                value={state.globalSearch}
                onChange={(e) => updateState({ globalSearch: e.target.value })}
                className={clsx(
                  'w-full pl-10 pr-4 py-2 text-sm',
                  'border border-gray-200 dark:border-gray-700 rounded-lg',
                  'bg-white dark:bg-gray-800',
                  'text-gray-900 dark:text-gray-100',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500',
                  'placeholder:text-gray-400'
                )}
              />
              {state.globalSearch && (
                <button
                  onClick={() => updateState({ globalSearch: '' })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
          
          {/* Column filters toggle */}
          {showColumnFilters && (
            <button
              onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
              className={clsx(
                'flex items-center gap-2 px-3 py-2 text-sm',
                'border rounded-lg transition-colors',
                isAdvancedOpen || state.columnFilters.length > 0
                  ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300'
                  : 'border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300',
                'hover:bg-gray-50 dark:hover:bg-gray-700'
              )}
            >
              <Filter className="h-4 w-4" />
              Filters
              {state.columnFilters.length > 0 && (
                <span className="px-1.5 py-0.5 text-xs bg-blue-200 dark:bg-blue-800 rounded-full">
                  {state.columnFilters.length}
                </span>
              )}
              <ChevronDown
                className={clsx('h-4 w-4 transition-transform', isAdvancedOpen && 'rotate-180')}
              />
            </button>
          )}
          
          {/* Presets dropdown */}
          {showPresets && presets.length > 0 && (
            <PresetDropdown
              presets={presets}
              activePresetId={state.activePresetId}
              onApply={applyPreset}
              onDelete={onDeletePreset}
            />
          )}
          
          {/* Clear all */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-2 text-sm',
                'text-gray-600 dark:text-gray-400',
                'hover:text-red-600 dark:hover:text-red-400',
                'transition-colors'
              )}
            >
              <RotateCcw className="h-4 w-4" />
              Clear
            </button>
          )}
        </div>
        
        {/* Advanced filter panel */}
        <AnimatePresence>
          {isAdvancedOpen && showColumnFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div
                className={clsx(
                  'p-4 rounded-lg',
                  'bg-gray-50 dark:bg-gray-800/50',
                  'border border-gray-200 dark:border-gray-700'
                )}
              >
                {/* Active filters */}
                <div className="space-y-2">
                  {state.columnFilters.map((filter, index) => (
                    <FilterRow
                      key={index}
                      filter={filter}
                      index={index}
                      columns={filterableColumns}
                      getOptions={getColumnOptions}
                      onUpdate={(f) => updateFilter(index, f)}
                      onRemove={() => removeFilter(index)}
                    />
                  ))}
                </div>
                
                {/* Add filter button */}
                <button
                  onClick={() => addFilter({
                    columnId: filterableColumns[0]?.id ?? '',
                    operator: 'contains',
                    value: '',
                  })}
                  className={clsx(
                    'flex items-center gap-2 px-3 py-2 mt-3 text-sm',
                    'text-blue-600 dark:text-blue-400',
                    'hover:bg-blue-50 dark:hover:bg-blue-900/20',
                    'rounded-lg transition-colors'
                  )}
                >
                  <Plus className="h-4 w-4" />
                  Add filter
                </button>
                
                {/* Save preset */}
                {showPresets && onSavePreset && state.columnFilters.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    {showSavePreset ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Preset name..."
                          value={presetName}
                          onChange={(e) => setPresetName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSavePreset()}
                          className={clsx(
                            'flex-1 px-3 py-1.5 text-sm rounded-lg',
                            'border border-gray-200 dark:border-gray-600',
                            'bg-white dark:bg-gray-700',
                            'focus:outline-none focus:ring-2 focus:ring-blue-500'
                          )}
                          autoFocus
                        />
                        <button
                          onClick={handleSavePreset}
                          disabled={!presetName.trim()}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded disabled:opacity-50"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            setShowSavePreset(false);
                            setPresetName('');
                          }}
                          className="p-1.5 text-gray-400 hover:bg-gray-100 rounded"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowSavePreset(true)}
                        className={clsx(
                          'flex items-center gap-2 text-sm',
                          'text-gray-600 dark:text-gray-400',
                          'hover:text-gray-900 dark:hover:text-gray-200'
                        )}
                      >
                        <Save className="h-4 w-4" />
                        Save as preset
                      </button>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Filter chips */}
        {state.columnFilters.length > 0 && !isAdvancedOpen && (
          <div className="flex flex-wrap gap-2">
            {state.columnFilters.map((filter, index) => {
              const column = filterableColumns.find((c) => c.id === filter.columnId);
              if (!column) return null;
              
              return (
                <motion.span
                  key={index}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className={clsx(
                    'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs',
                    'bg-blue-100 dark:bg-blue-900/30',
                    'text-blue-800 dark:text-blue-200',
                    'rounded-full'
                  )}
                >
                  <span className="font-medium">{column.header}</span>
                  <span className="text-blue-600 dark:text-blue-400">
                    {operatorLabels[filter.operator]}
                  </span>
                  {filter.operator !== 'isEmpty' && filter.operator !== 'isNotEmpty' && (
                    <span>
                      {Array.isArray(filter.value)
                        ? `(${filter.value.length})`
                        : String(filter.value ?? '')}
                    </span>
                  )}
                  <button
                    onClick={() => removeFilter(index)}
                    className="ml-1 p-0.5 hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </motion.span>
              );
            })}
          </div>
        )}
      </div>
    </FilterContext.Provider>
  );
}

// ============================================================================
// Filter Row Component
// ============================================================================

interface FilterRowProps<TData> {
  filter: ColumnFilter;
  index: number;
  columns: ColumnDef<TData>[];
  getOptions: (columnId: string) => unknown[];
  onUpdate: (filter: ColumnFilter) => void;
  onRemove: () => void;
}

function FilterRow<TData>({
  filter,
  columns,
  getOptions,
  onUpdate,
  onRemove,
}: FilterRowProps<TData>) {
  const column = columns.find((c) => c.id === filter.columnId);
  const columnOptions = useMemo(
    () => getOptions(filter.columnId),
    [filter.columnId, getOptions]
  );
  
  // Determine available operators based on column type
  const availableOperators = useMemo(() => {
    if (columnOptions.length > 0 && columnOptions.length <= 20) {
      return selectOperators;
    }
    
    const sampleValue = columnOptions[0];
    if (typeof sampleValue === 'number') return numberOperators;
    if (sampleValue instanceof Date) return dateOperators;
    return textOperators;
  }, [columnOptions]);
  
  const needsSecondValue = filter.operator === 'between';
  const needsMultiValue = filter.operator === 'in' || filter.operator === 'notIn';
  const noValueNeeded = filter.operator === 'isEmpty' || filter.operator === 'isNotEmpty';
  
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Column select */}
      <select
        value={filter.columnId}
        onChange={(e) => onUpdate({ ...filter, columnId: e.target.value })}
        className={clsx(
          'px-3 py-1.5 text-sm rounded-lg',
          'border border-gray-200 dark:border-gray-600',
          'bg-white dark:bg-gray-700',
          'text-gray-900 dark:text-gray-100',
          'focus:outline-none focus:ring-2 focus:ring-blue-500'
        )}
      >
        {columns.map((col) => (
          <option key={col.id} value={col.id}>
            {col.header}
          </option>
        ))}
      </select>
      
      {/* Operator select */}
      <select
        value={filter.operator}
        onChange={(e) => onUpdate({ ...filter, operator: e.target.value as FilterOperator })}
        className={clsx(
          'px-3 py-1.5 text-sm rounded-lg',
          'border border-gray-200 dark:border-gray-600',
          'bg-white dark:bg-gray-700',
          'text-gray-900 dark:text-gray-100',
          'focus:outline-none focus:ring-2 focus:ring-blue-500'
        )}
      >
        {availableOperators.map((op) => (
          <option key={op} value={op}>
            {operatorLabels[op]}
          </option>
        ))}
      </select>
      
      {/* Value input */}
      {!noValueNeeded && (
        needsMultiValue ? (
          <MultiSelectInput
            options={columnOptions}
            value={(filter.value as unknown[]) ?? []}
            onChange={(value) => onUpdate({ ...filter, value })}
          />
        ) : (
          <>
            <input
              type="text"
              placeholder="Value..."
              value={String(filter.value ?? '')}
              onChange={(e) => onUpdate({ ...filter, value: e.target.value })}
              className={clsx(
                'px-3 py-1.5 text-sm rounded-lg min-w-[150px]',
                'border border-gray-200 dark:border-gray-600',
                'bg-white dark:bg-gray-700',
                'text-gray-900 dark:text-gray-100',
                'focus:outline-none focus:ring-2 focus:ring-blue-500'
              )}
            />
            
            {needsSecondValue && (
              <>
                <span className="text-sm text-gray-500">and</span>
                <input
                  type="text"
                  placeholder="Value..."
                  value={String(filter.secondValue ?? '')}
                  onChange={(e) => onUpdate({ ...filter, secondValue: e.target.value })}
                  className={clsx(
                    'px-3 py-1.5 text-sm rounded-lg min-w-[150px]',
                    'border border-gray-200 dark:border-gray-600',
                    'bg-white dark:bg-gray-700',
                    'text-gray-900 dark:text-gray-100',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500'
                  )}
                />
              </>
            )}
          </>
        )
      )}
      
      {/* Remove button */}
      <button
        onClick={onRemove}
        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// ============================================================================
// Multi-Select Input
// ============================================================================

interface MultiSelectInputProps {
  options: unknown[];
  value: unknown[];
  onChange: (value: unknown[]) => void;
}

function MultiSelectInput({ options, value, onChange }: MultiSelectInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const toggleValue = (v: unknown) => {
    const strV = String(v);
    const current = value.map(String);
    
    if (current.includes(strV)) {
      onChange(value.filter((x) => String(x) !== strV));
    } else {
      onChange([...value, v]);
    }
  };
  
  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg min-w-[150px]',
          'border border-gray-200 dark:border-gray-600',
          'bg-white dark:bg-gray-700',
          'text-gray-900 dark:text-gray-100',
          'hover:bg-gray-50 dark:hover:bg-gray-600'
        )}
      >
        <span className="flex-1 text-left truncate">
          {value.length > 0 ? `${value.length} selected` : 'Select...'}
        </span>
        <ChevronDown className="h-4 w-4" />
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className={clsx(
                'absolute left-0 mt-1 z-50',
                'w-48 max-h-60 overflow-auto',
                'bg-white dark:bg-gray-800',
                'border border-gray-200 dark:border-gray-700',
                'rounded-lg shadow-lg'
              )}
            >
              {options.map((option, idx) => {
                const strOption = String(option);
                const isSelected = value.map(String).includes(strOption);
                
                return (
                  <label
                    key={idx}
                    className={clsx(
                      'flex items-center gap-2 px-3 py-2 text-sm cursor-pointer',
                      'hover:bg-gray-50 dark:hover:bg-gray-700'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleValue(option)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="truncate">{strOption}</span>
                  </label>
                );
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Preset Dropdown
// ============================================================================

interface PresetDropdownProps {
  presets: FilterPreset[];
  activePresetId: string | null;
  onApply: (preset: FilterPreset) => void;
  onDelete?: (presetId: string) => void;
}

function PresetDropdown({ presets, activePresetId, onApply, onDelete }: PresetDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const activePreset = presets.find((p) => p.id === activePresetId);
  
  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'flex items-center gap-2 px-3 py-2 text-sm',
          'border rounded-lg transition-colors',
          activePreset
            ? 'border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-900/20 dark:text-purple-300'
            : 'border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'
        )}
      >
        <Save className="h-4 w-4" />
        {activePreset?.name ?? 'Presets'}
        <ChevronDown className={clsx('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className={clsx(
                'absolute right-0 mt-1 z-50',
                'w-56 py-1',
                'bg-white dark:bg-gray-800',
                'border border-gray-200 dark:border-gray-700',
                'rounded-lg shadow-lg'
              )}
            >
              {presets.map((preset) => (
                <div
                  key={preset.id}
                  className={clsx(
                    'flex items-center gap-2 px-3 py-2 text-sm',
                    'hover:bg-gray-50 dark:hover:bg-gray-700',
                    preset.id === activePresetId && 'bg-purple-50 dark:bg-purple-900/20'
                  )}
                >
                  <button
                    onClick={() => {
                      onApply(preset);
                      setIsOpen(false);
                    }}
                    className="flex-1 text-left truncate"
                  >
                    {preset.name}
                  </button>
                  {preset.id === activePresetId && (
                    <Check className="h-4 w-4 text-purple-600" />
                  )}
                  {onDelete && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(preset.id);
                      }}
                      className="p-1 text-gray-400 hover:text-red-500 rounded"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
              
              {presets.length === 0 && (
                <div className="px-3 py-2 text-sm text-gray-500">
                  No saved presets
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Quick Filter Presets
// ============================================================================

export const datePresets = {
  today: {
    label: 'Today',
    getRange: () => ({
      start: startOfDay(new Date()),
      end: endOfDay(new Date()),
    }),
  },
  yesterday: {
    label: 'Yesterday',
    getRange: () => ({
      start: startOfDay(subDays(new Date(), 1)),
      end: endOfDay(subDays(new Date(), 1)),
    }),
  },
  last7Days: {
    label: 'Last 7 days',
    getRange: () => ({
      start: startOfDay(subDays(new Date(), 7)),
      end: endOfDay(new Date()),
    }),
  },
  last30Days: {
    label: 'Last 30 days',
    getRange: () => ({
      start: startOfDay(subDays(new Date(), 30)),
      end: endOfDay(new Date()),
    }),
  },
  lastMonth: {
    label: 'Last month',
    getRange: () => ({
      start: startOfDay(subMonths(new Date(), 1)),
      end: endOfDay(new Date()),
    }),
  },
  last3Months: {
    label: 'Last 3 months',
    getRange: () => ({
      start: startOfDay(subMonths(new Date(), 3)),
      end: endOfDay(new Date()),
    }),
  },
};

// ============================================================================
// Hook for Filter State
// ============================================================================

export function useTableFilters<TData>(
  data: TData[],
  columns: ColumnDef<TData>[],
  storageKey?: string
) {
  const [state, setState] = useState<FilterState>(() => {
    if (storageKey) {
      try {
        const stored = localStorage.getItem(`filter-state-${storageKey}`);
        if (stored) return JSON.parse(stored);
      } catch { /* ignore */ }
    }
    return {
      globalSearch: '',
      columnFilters: [],
      activePresetId: null,
    };
  });
  
  // Persist state
  useEffect(() => {
    if (storageKey) {
      localStorage.setItem(`filter-state-${storageKey}`, JSON.stringify(state));
    }
  }, [state, storageKey]);
  
  // Filter data
  const filteredData = useMemo(
    () => applyFilters(data, columns, state),
    [data, columns, state]
  );
  
  return {
    state,
    setState,
    filteredData,
    hasActiveFilters: state.globalSearch || state.columnFilters.length > 0,
    clearFilters: () => setState({
      globalSearch: '',
      columnFilters: [],
      activePresetId: null,
    }),
  };
}

export default TableFilters;
