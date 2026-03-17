import { useCallback, useRef, useState, useEffect, RefObject } from 'react';

/**
 * Configuration for keyboard navigation behavior
 */
export interface KeyboardNavigationOptions {
  /** Enable wrapping from last to first item (and vice versa) */
  wrap?: boolean;
  /** Enable horizontal navigation (left/right arrows) */
  horizontal?: boolean;
  /** Enable vertical navigation (up/down arrows) */
  vertical?: boolean;
  /** Number of columns for grid navigation */
  columns?: number;
  /** Callback when an item is selected (Enter key) */
  onSelect?: (index: number) => void;
  /** Callback when escape is pressed */
  onEscape?: () => void;
  /** Callback when navigation occurs */
  onNavigate?: (index: number, direction: 'up' | 'down' | 'left' | 'right') => void;
  /** Enable type-ahead search */
  typeAhead?: boolean;
  /** Item labels for type-ahead search */
  itemLabels?: string[];
  /** Initial focused index */
  initialIndex?: number;
  /** Whether navigation is enabled */
  enabled?: boolean;
}

/**
 * Return type for useKeyboardNavigation hook
 */
export interface KeyboardNavigationReturn {
  /** Currently focused index */
  focusedIndex: number;
  /** Set the focused index programmatically */
  setFocusedIndex: (index: number) => void;
  /** Handler to attach to the container element */
  containerProps: {
    onKeyDown: (e: React.KeyboardEvent) => void;
    role: string;
    'aria-activedescendant': string | undefined;
    tabIndex: number;
  };
  /** Get props for each navigable item */
  getItemProps: (index: number) => {
    id: string;
    role: string;
    'aria-selected': boolean;
    tabIndex: number;
    onFocus: () => void;
    onClick: () => void;
  };
  /** Reset focus to initial index */
  resetFocus: () => void;
  /** Move focus to next item */
  focusNext: () => void;
  /** Move focus to previous item */
  focusPrevious: () => void;
  /** Move focus to first item */
  focusFirst: () => void;
  /** Move focus to last item */
  focusLast: () => void;
}

/**
 * Hook for keyboard navigation in lists, grids, and menus.
 * Implements WAI-ARIA keyboard navigation patterns.
 *
 * @example
 * ```tsx
 * function MyList({ items }) {
 *   const { focusedIndex, containerProps, getItemProps } = useKeyboardNavigation({
 *     itemCount: items.length,
 *     onSelect: (index) => handleSelect(items[index]),
 *   });
 *
 *   return (
 *     <ul {...containerProps}>
 *       {items.map((item, index) => (
 *         <li key={item.id} {...getItemProps(index)}>
 *           {item.name}
 *         </li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useKeyboardNavigation(
  itemCount: number,
  options: KeyboardNavigationOptions = {}
): KeyboardNavigationReturn {
  const {
    wrap = true,
    horizontal = false,
    vertical = true,
    columns = 1,
    onSelect,
    onEscape,
    onNavigate,
    typeAhead = false,
    itemLabels = [],
    initialIndex = 0,
    enabled = true,
  } = options;

  const [focusedIndex, setFocusedIndex] = useState(
    initialIndex >= 0 && initialIndex < itemCount ? initialIndex : 0
  );

  // Type-ahead search state
  const searchBufferRef = useRef('');
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  // Unique ID for ARIA
  const idPrefixRef = useRef(`kb-nav-${Math.random().toString(36).slice(2, 9)}`);

  // Reset focus when item count changes
  useEffect(() => {
    if (focusedIndex >= itemCount) {
      setFocusedIndex(Math.max(0, itemCount - 1));
    }
  }, [itemCount, focusedIndex]);

  const moveFocus = useCallback(
    (direction: 'up' | 'down' | 'left' | 'right') => {
      if (!enabled || itemCount === 0) return;

      let newIndex = focusedIndex;

      switch (direction) {
        case 'up':
          if (columns > 1) {
            newIndex = focusedIndex - columns;
          } else {
            newIndex = focusedIndex - 1;
          }
          break;
        case 'down':
          if (columns > 1) {
            newIndex = focusedIndex + columns;
          } else {
            newIndex = focusedIndex + 1;
          }
          break;
        case 'left':
          newIndex = focusedIndex - 1;
          break;
        case 'right':
          newIndex = focusedIndex + 1;
          break;
      }

      if (wrap) {
        if (newIndex < 0) {
          newIndex = itemCount - 1;
        } else if (newIndex >= itemCount) {
          newIndex = 0;
        }
      } else {
        newIndex = Math.max(0, Math.min(itemCount - 1, newIndex));
      }

      if (newIndex !== focusedIndex) {
        setFocusedIndex(newIndex);
        onNavigate?.(newIndex, direction);
      }
    },
    [enabled, itemCount, focusedIndex, columns, wrap, onNavigate]
  );

  const handleTypeAhead = useCallback(
    (char: string) => {
      if (!typeAhead || !enabled || itemLabels.length === 0) return false;

      // Clear previous timeout
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      // Add to search buffer
      searchBufferRef.current += char.toLowerCase();

      // Find matching item
      const searchStr = searchBufferRef.current;
      const startIndex = (focusedIndex + 1) % itemCount;

      for (let i = 0; i < itemCount; i++) {
        const index = (startIndex + i) % itemCount;
        const label = itemLabels[index]?.toLowerCase() || '';
        if (label.startsWith(searchStr)) {
          setFocusedIndex(index);
          break;
        }
      }

      // Clear buffer after delay
      searchTimeoutRef.current = setTimeout(() => {
        searchBufferRef.current = '';
      }, 500);

      return true;
    },
    [typeAhead, enabled, itemLabels, focusedIndex, itemCount]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!enabled) return;

      switch (e.key) {
        case 'ArrowUp':
          if (vertical) {
            e.preventDefault();
            moveFocus('up');
          }
          break;
        case 'ArrowDown':
          if (vertical) {
            e.preventDefault();
            moveFocus('down');
          }
          break;
        case 'ArrowLeft':
          if (horizontal) {
            e.preventDefault();
            moveFocus('left');
          }
          break;
        case 'ArrowRight':
          if (horizontal) {
            e.preventDefault();
            moveFocus('right');
          }
          break;
        case 'Home':
          e.preventDefault();
          setFocusedIndex(0);
          break;
        case 'End':
          e.preventDefault();
          setFocusedIndex(itemCount - 1);
          break;
        case 'PageUp':
          e.preventDefault();
          setFocusedIndex(Math.max(0, focusedIndex - 10));
          break;
        case 'PageDown':
          e.preventDefault();
          setFocusedIndex(Math.min(itemCount - 1, focusedIndex + 10));
          break;
        case 'Enter':
        case ' ':
          if (e.key === ' ' && typeAhead) {
            // Allow space in type-ahead mode
            break;
          }
          e.preventDefault();
          onSelect?.(focusedIndex);
          break;
        case 'Escape':
          e.preventDefault();
          onEscape?.();
          break;
        default:
          // Type-ahead search for printable characters
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            if (handleTypeAhead(e.key)) {
              e.preventDefault();
            }
          }
          break;
      }
    },
    [
      enabled,
      vertical,
      horizontal,
      moveFocus,
      itemCount,
      focusedIndex,
      typeAhead,
      onSelect,
      onEscape,
      handleTypeAhead,
    ]
  );

  const getItemProps = useCallback(
    (index: number) => ({
      id: `${idPrefixRef.current}-item-${index}`,
      role: 'option',
      'aria-selected': focusedIndex === index,
      tabIndex: focusedIndex === index ? 0 : -1,
      onFocus: () => setFocusedIndex(index),
      onClick: () => {
        setFocusedIndex(index);
        onSelect?.(index);
      },
    }),
    [focusedIndex, onSelect]
  );

  const resetFocus = useCallback(() => {
    setFocusedIndex(initialIndex >= 0 && initialIndex < itemCount ? initialIndex : 0);
  }, [initialIndex, itemCount]);

  const focusNext = useCallback(() => {
    moveFocus(horizontal && !vertical ? 'right' : 'down');
  }, [moveFocus, horizontal, vertical]);

  const focusPrevious = useCallback(() => {
    moveFocus(horizontal && !vertical ? 'left' : 'up');
  }, [moveFocus, horizontal, vertical]);

  const focusFirst = useCallback(() => {
    setFocusedIndex(0);
  }, []);

  const focusLast = useCallback(() => {
    setFocusedIndex(itemCount - 1);
  }, [itemCount]);

  return {
    focusedIndex,
    setFocusedIndex,
    containerProps: {
      onKeyDown: handleKeyDown,
      role: 'listbox',
      'aria-activedescendant':
        focusedIndex >= 0 ? `${idPrefixRef.current}-item-${focusedIndex}` : undefined,
      tabIndex: 0,
    },
    getItemProps,
    resetFocus,
    focusNext,
    focusPrevious,
    focusFirst,
    focusLast,
  };
}

/**
 * Hook for grid-based keyboard navigation (e.g., Kanban boards, calendars)
 */
export function useGridNavigation(
  rows: number,
  columns: number,
  options: Omit<KeyboardNavigationOptions, 'columns' | 'horizontal' | 'vertical'> = {}
) {
  const itemCount = rows * columns;

  const result = useKeyboardNavigation(itemCount, {
    ...options,
    columns,
    horizontal: true,
    vertical: true,
  });

  const getRowCol = useCallback(
    (index: number) => ({
      row: Math.floor(index / columns),
      col: index % columns,
    }),
    [columns]
  );

  const getIndex = useCallback(
    (row: number, col: number) => row * columns + col,
    [columns]
  );

  return {
    ...result,
    getRowCol,
    getIndex,
    focusedRow: getRowCol(result.focusedIndex).row,
    focusedCol: getRowCol(result.focusedIndex).col,
  };
}

/**
 * Hook for roving tabindex pattern in toolbars and button groups
 */
export function useRovingTabIndex(
  itemCount: number,
  options: Omit<KeyboardNavigationOptions, 'vertical'> = {}
) {
  return useKeyboardNavigation(itemCount, {
    ...options,
    horizontal: true,
    vertical: false,
    wrap: true,
  });
}

/**
 * Hook for menu navigation with parent/child items
 */
export interface MenuNavigationOptions extends KeyboardNavigationOptions {
  /** Callback when a submenu should open */
  onOpenSubmenu?: (index: number) => void;
  /** Callback when navigating back to parent */
  onCloseSubmenu?: () => void;
  /** Whether the current menu has a parent */
  hasParent?: boolean;
}

export function useMenuNavigation(
  itemCount: number,
  options: MenuNavigationOptions = {}
) {
  const { onOpenSubmenu, onCloseSubmenu, hasParent = false, ...rest } = options;

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent) => {
      if (e.key === 'ArrowRight' && onOpenSubmenu) {
        e.preventDefault();
        onOpenSubmenu(index);
      } else if (e.key === 'ArrowLeft' && hasParent && onCloseSubmenu) {
        e.preventDefault();
        onCloseSubmenu();
      }
    },
    [onOpenSubmenu, onCloseSubmenu, hasParent]
  );

  const result = useKeyboardNavigation(itemCount, {
    ...rest,
    vertical: true,
    horizontal: false,
  });

  return {
    ...result,
    handleSubmenuKeyDown: handleKeyDown,
  };
}
