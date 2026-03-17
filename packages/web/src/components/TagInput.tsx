/**
 * TagInput.tsx - CRITICAL-42
 * 
 * Tag/chip input components for the ERP application.
 * Multi-value input with autocomplete and validation.
 * 
 * Features:
 * - 42.1: Chip-style tag display
 * - 42.2: Autocomplete suggestions
 * - 42.3: Custom tag creation
 * - 42.4: Tag validation
 * - 42.5: Drag and drop reordering
 * 
 * @module TagInput
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  forwardRef,
  type ReactNode,
  type KeyboardEvent,
  type ChangeEvent,
  type DragEvent,
} from 'react';
import { clsx } from 'clsx';
import {
  X,
  Plus,
  Check,
  Tag as TagIcon,
  Loader2,
  GripVertical,
  AlertCircle,
} from 'lucide-react';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/** Tag item */
export interface TagItem {
  /** Unique id */
  id: string;
  /** Display label */
  label: string;
  /** Color */
  color?: string;
  /** Icon */
  icon?: ReactNode;
  /** Disabled */
  disabled?: boolean;
  /** Custom data */
  data?: Record<string, unknown>;
}

/** Tag input props */
export interface TagInputProps {
  /** Selected tags */
  value: TagItem[];
  /** On change */
  onChange: (tags: TagItem[]) => void;
  /** Suggestions */
  suggestions?: TagItem[];
  /** Async suggestions loader */
  loadSuggestions?: (query: string) => Promise<TagItem[]>;
  /** Placeholder */
  placeholder?: string;
  /** Allow new tags */
  allowCreate?: boolean;
  /** Max tags */
  maxTags?: number;
  /** Validate new tag */
  validateTag?: (label: string) => boolean | string;
  /** Create tag from label */
  createTag?: (label: string) => TagItem;
  /** Allow duplicates */
  allowDuplicates?: boolean;
  /** Allow reordering */
  allowReorder?: boolean;
  /** Separator keys */
  separatorKeys?: string[];
  /** Disabled */
  disabled?: boolean;
  /** Error message */
  error?: string;
  /** Size */
  size?: 'sm' | 'md' | 'lg';
  /** Class name */
  className?: string;
}

/** Single tag props */
export interface TagProps {
  /** Tag item */
  tag: TagItem;
  /** On remove */
  onRemove?: () => void;
  /** Removable */
  removable?: boolean;
  /** Size */
  size?: 'sm' | 'md' | 'lg';
  /** Draggable */
  draggable?: boolean;
  /** On drag start */
  onDragStart?: () => void;
  /** On drag end */
  onDragEnd?: () => void;
  /** Class name */
  className?: string;
}

// ============================================================================
// DEFAULT TAG COLORS
// ============================================================================

const TAG_COLORS = [
  { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-700 dark:text-gray-300', border: 'border-gray-300' },
  { bg: 'bg-blue-100 dark:bg-blue-900/50', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-300' },
  { bg: 'bg-green-100 dark:bg-green-900/50', text: 'text-green-700 dark:text-green-300', border: 'border-green-300' },
  { bg: 'bg-yellow-100 dark:bg-yellow-900/50', text: 'text-yellow-700 dark:text-yellow-300', border: 'border-yellow-300' },
  { bg: 'bg-red-100 dark:bg-red-900/50', text: 'text-red-700 dark:text-red-300', border: 'border-red-300' },
  { bg: 'bg-purple-100 dark:bg-purple-900/50', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-300' },
  { bg: 'bg-pink-100 dark:bg-pink-900/50', text: 'text-pink-700 dark:text-pink-300', border: 'border-pink-300' },
  { bg: 'bg-indigo-100 dark:bg-indigo-900/50', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-300' },
  { bg: 'bg-cyan-100 dark:bg-cyan-900/50', text: 'text-cyan-700 dark:text-cyan-300', border: 'border-cyan-300' },
  { bg: 'bg-orange-100 dark:bg-orange-900/50', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-300' },
];

function getTagColor(color?: string) {
  if (!color) return TAG_COLORS[0];
  
  const colorIndex = color.charCodeAt(0) % TAG_COLORS.length;
  return TAG_COLORS[colorIndex];
}

// ============================================================================
// 42.1: TAG COMPONENT
// ============================================================================

/**
 * Single tag chip
 */
export function Tag({
  tag,
  onRemove,
  removable = true,
  size = 'md',
  draggable = false,
  onDragStart,
  onDragEnd,
  className,
}: TagProps) {
  const colors = getTagColor(tag.color);

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <span
      draggable={draggable && !tag.disabled}
      onDragStart={() => onDragStart?.()}
      onDragEnd={() => onDragEnd?.()}
      className={clsx(
        'inline-flex items-center gap-1 rounded-full border',
        colors.bg,
        colors.text,
        colors.border,
        sizeClasses[size],
        tag.disabled && 'opacity-50',
        draggable && 'cursor-grab active:cursor-grabbing',
        className
      )}
    >
      {draggable && (
        <GripVertical className={clsx('text-current opacity-50', iconSizes[size])} />
      )}
      {tag.icon && <span className={iconSizes[size]}>{tag.icon}</span>}
      <span className="truncate max-w-[150px]">{tag.label}</span>
      {removable && !tag.disabled && onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className={clsx(
            'rounded-full hover:bg-black/10 dark:hover:bg-white/10 p-0.5',
            iconSizes[size]
          )}
        >
          <X className="w-full h-full" />
        </button>
      )}
    </span>
  );
}

// ============================================================================
// 42.2-42.5: TAG INPUT COMPONENT
// ============================================================================

/**
 * Multi-tag input with autocomplete
 * 
 * @example
 * ```tsx
 * const [tags, setTags] = useState<TagItem[]>([]);
 * 
 * <TagInput
 *   value={tags}
 *   onChange={setTags}
 *   suggestions={availableTags}
 *   allowCreate
 *   placeholder="Add tags..."
 * />
 * ```
 */
export function TagInput({
  value,
  onChange,
  suggestions = [],
  loadSuggestions,
  placeholder = 'Add tag...',
  allowCreate = true,
  maxTags,
  validateTag,
  createTag,
  allowDuplicates = false,
  allowReorder = false,
  separatorKeys = ['Enter', ','],
  disabled = false,
  error,
  size = 'md',
  className,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<TagItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const isMaxed = maxTags !== undefined && value.length >= maxTags;

  // Filter suggestions
  useEffect(() => {
    const filterSuggestions = async () => {
      const query = inputValue.toLowerCase().trim();

      if (!query) {
        setFilteredSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      setIsLoading(true);

      try {
        let results: TagItem[];

        if (loadSuggestions) {
          results = await loadSuggestions(query);
        } else {
          results = suggestions.filter((s) =>
            s.label.toLowerCase().includes(query)
          );
        }

        // Filter out already selected tags
        if (!allowDuplicates) {
          const selectedIds = new Set(value.map((t) => t.id));
          results = results.filter((s) => !selectedIds.has(s.id));
        }

        setFilteredSuggestions(results);
        setShowSuggestions(results.length > 0 || (allowCreate && !!query));
        setSelectedIndex(0);
      } finally {
        setIsLoading(false);
      }
    };

    const timeout = setTimeout(filterSuggestions, 150);
    return () => clearTimeout(timeout);
  }, [inputValue, suggestions, loadSuggestions, value, allowDuplicates, allowCreate]);

  // Add tag
  const addTag = useCallback((tag: TagItem) => {
    if (isMaxed) return;

    // Check duplicates
    if (!allowDuplicates && value.some((t) => t.id === tag.id)) {
      return;
    }

    onChange([...value, tag]);
    setInputValue('');
    setShowSuggestions(false);
    setValidationError(null);
  }, [value, onChange, isMaxed, allowDuplicates]);

  // Create new tag from input
  const createNewTag = useCallback(() => {
    const label = inputValue.trim();
    if (!label || !allowCreate || isMaxed) return;

    // Validate
    if (validateTag) {
      const result = validateTag(label);
      if (result !== true) {
        setValidationError(typeof result === 'string' ? result : 'Invalid tag');
        return;
      }
    }

    // Check duplicates
    if (!allowDuplicates && value.some((t) => t.label.toLowerCase() === label.toLowerCase())) {
      setValidationError('Tag already exists');
      return;
    }

    // Create tag
    const newTag = createTag ? createTag(label) : {
      id: `tag-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      label,
    };

    addTag(newTag);
  }, [inputValue, allowCreate, isMaxed, validateTag, value, allowDuplicates, createTag, addTag]);

  // Remove tag
  const removeTag = useCallback((index: number) => {
    const newTags = [...value];
    newTags.splice(index, 1);
    onChange(newTags);
  }, [value, onChange]);

  // Handle keyboard
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (separatorKeys.includes(e.key)) {
      e.preventDefault();

      if (showSuggestions && filteredSuggestions[selectedIndex]) {
        addTag(filteredSuggestions[selectedIndex]);
      } else if (inputValue.trim()) {
        createNewTag();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => 
          Math.min(prev + 1, filteredSuggestions.length - 1)
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case 'Escape':
        setShowSuggestions(false);
        break;
      case 'Backspace':
        if (!inputValue && value.length > 0) {
          removeTag(value.length - 1);
        }
        break;
    }
  }, [separatorKeys, showSuggestions, filteredSuggestions, selectedIndex, inputValue, value, addTag, createNewTag, removeTag]);

  // Handle input change
  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setValidationError(null);
  };

  // Handle drag and drop
  const handleDragOver = (e: DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newTags = [...value];
    const [dragged] = newTags.splice(draggedIndex, 1);
    newTags.splice(index, 0, dragged);
    onChange(newTags);
    setDraggedIndex(index);
  };

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const sizeClasses = {
    sm: 'min-h-[32px] text-sm',
    md: 'min-h-[40px] text-base',
    lg: 'min-h-[48px] text-lg',
  };

  return (
    <div className={className}>
      <div
        ref={containerRef}
        className={clsx(
          'relative flex flex-wrap gap-1.5 p-2 border rounded-lg',
          'focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500',
          error || validationError ? 'border-red-500' : '',
          disabled && 'bg-gray-100 cursor-not-allowed',
          sizeClasses[size]
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {/* Tags */}
        {value.map((tag, index) => (
          <div
            key={tag.id}
            onDragOver={(e) => allowReorder && handleDragOver(e, index)}
          >
            <Tag
              tag={tag}
              size={size}
              removable={!disabled}
              draggable={allowReorder && !disabled}
              onRemove={() => removeTag(index)}
              onDragStart={() => setDraggedIndex(index)}
              onDragEnd={() => setDraggedIndex(null)}
            />
          </div>
        ))}

        {/* Input */}
        {!isMaxed && (
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => inputValue && setShowSuggestions(true)}
            placeholder={value.length === 0 ? placeholder : ''}
            disabled={disabled}
            className={clsx(
              'flex-1 min-w-[100px] outline-none bg-transparent',
              disabled && 'cursor-not-allowed'
            )}
          />
        )}

        {/* Loading indicator */}
        {isLoading && (
          <Loader2 className="w-4 h-4 animate-spin text-gray-400 self-center" />
        )}

        {/* Suggestions dropdown */}
        {showSuggestions && !disabled && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 bg-white dark:bg-gray-800 border rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {filteredSuggestions.length > 0 ? (
              filteredSuggestions.map((suggestion, index) => (
                <button
                  key={suggestion.id}
                  type="button"
                  onClick={() => addTag(suggestion)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={clsx(
                    'w-full px-3 py-2 text-left flex items-center gap-2',
                    index === selectedIndex && 'bg-blue-50 dark:bg-blue-900/30'
                  )}
                >
                  <TagIcon className="w-4 h-4 text-gray-400" />
                  <span>{suggestion.label}</span>
                  {index === selectedIndex && (
                    <Check className="w-4 h-4 text-blue-500 ml-auto" />
                  )}
                </button>
              ))
            ) : allowCreate && inputValue.trim() ? (
              <button
                type="button"
                onClick={createNewTag}
                className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <Plus className="w-4 h-4 text-blue-500" />
                <span>Create "{inputValue.trim()}"</span>
              </button>
            ) : null}
          </div>
        )}
      </div>

      {/* Error message */}
      {(error || validationError) && (
        <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
          <AlertCircle className="w-4 h-4" />
          {error || validationError}
        </p>
      )}

      {/* Max tags hint */}
      {maxTags && (
        <p className="mt-1 text-xs text-gray-500">
          {value.length} / {maxTags} tags
        </p>
      )}
    </div>
  );
}

// ============================================================================
// TAG GROUP
// ============================================================================

interface TagGroupProps {
  tags: TagItem[];
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  onTagClick?: (tag: TagItem) => void;
  className?: string;
}

/**
 * Display a group of tags with overflow handling
 */
export function TagGroup({
  tags,
  max = 5,
  size = 'sm',
  onTagClick,
  className,
}: TagGroupProps) {
  const visibleTags = tags.slice(0, max);
  const hiddenCount = tags.length - max;

  return (
    <div className={clsx('flex flex-wrap gap-1', className)}>
      {visibleTags.map((tag) => (
        <Tag
          key={tag.id}
          tag={tag}
          size={size}
          removable={false}
          className={onTagClick ? 'cursor-pointer' : undefined}
        />
      ))}
      {hiddenCount > 0 && (
        <span className={clsx(
          'inline-flex items-center px-2 py-0.5 rounded-full',
          'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
          size === 'sm' && 'text-xs',
          size === 'md' && 'text-sm',
          size === 'lg' && 'text-base'
        )}>
          +{hiddenCount} more
        </span>
      )}
    </div>
  );
}

// ============================================================================
// TAG SELECTOR
// ============================================================================

interface TagSelectorProps {
  value: string[];
  onChange: (value: string[]) => void;
  options: TagItem[];
  multiple?: boolean;
  className?: string;
}

/**
 * Tag selector for predefined options
 */
export function TagSelector({
  value,
  onChange,
  options,
  multiple = true,
  className,
}: TagSelectorProps) {
  const handleTagClick = (tagId: string) => {
    if (multiple) {
      if (value.includes(tagId)) {
        onChange(value.filter((id) => id !== tagId));
      } else {
        onChange([...value, tagId]);
      }
    } else {
      onChange(value[0] === tagId ? [] : [tagId]);
    }
  };

  return (
    <div className={clsx('flex flex-wrap gap-2', className)}>
      {options.map((option) => {
        const isSelected = value.includes(option.id);
        const colors = getTagColor(option.color);

        return (
          <button
            key={option.id}
            type="button"
            onClick={() => handleTagClick(option.id)}
            disabled={option.disabled}
            className={clsx(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-colors',
              isSelected
                ? `${colors.bg} ${colors.text} ${colors.border}`
                : 'bg-white dark:bg-gray-800 border-gray-300 hover:border-gray-400',
              option.disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            {isSelected && <Check className="w-4 h-4" />}
            {option.icon}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// COLORED TAG INPUT
// ============================================================================

interface ColoredTagInputProps extends Omit<TagInputProps, 'createTag'> {
  colors?: string[];
}

/**
 * Tag input with automatic color assignment
 */
export function ColoredTagInput({
  colors = ['blue', 'green', 'yellow', 'red', 'purple', 'pink', 'indigo', 'cyan', 'orange'],
  ...props
}: ColoredTagInputProps) {
  const colorIndex = useRef(0);

  const createTag = useCallback((label: string): TagItem => {
    const color = colors[colorIndex.current % colors.length];
    colorIndex.current++;

    return {
      id: `tag-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      label,
      color,
    };
  }, [colors]);

  return <TagInput {...props} createTag={createTag} />;
}

// ============================================================================
// EXPORTS
// ============================================================================
