/**
 * Context Menu System
 * 
 * Comprehensive right-click context menu utilities for React applications.
 * Includes nested menus, keyboard navigation, and customizable items.
 * 
 * @module ContextMenu
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
  createContext,
  useContext,
  type ReactNode,
  type MouseEvent,
  type KeyboardEvent,
} from 'react';
import clsx from 'clsx';
import {
  ChevronRight,
  Check,
  Circle,
  type LucideIcon,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface ContextMenuItem {
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Icon component */
  icon?: LucideIcon;
  /** Keyboard shortcut display text */
  shortcut?: string;
  /** Whether item is disabled */
  disabled?: boolean;
  /** Whether item is destructive (red text) */
  destructive?: boolean;
  /** Whether item is hidden */
  hidden?: boolean;
  /** Nested submenu items */
  submenu?: ContextMenuItem[];
  /** Item type */
  type?: 'item' | 'separator' | 'checkbox' | 'radio';
  /** For checkbox/radio: whether checked */
  checked?: boolean;
  /** For radio: group name */
  radioGroup?: string;
  /** Click handler */
  onClick?: () => void;
}

export interface ContextMenuPosition {
  x: number;
  y: number;
}

export interface ContextMenuState {
  isOpen: boolean;
  position: ContextMenuPosition;
  items: ContextMenuItem[];
  targetElement?: HTMLElement;
}

// ============================================================================
// Context Menu Context
// ============================================================================

interface ContextMenuContextValue {
  state: ContextMenuState;
  open: (items: ContextMenuItem[], position: ContextMenuPosition, target?: HTMLElement) => void;
  close: () => void;
  isOpen: boolean;
}

const ContextMenuContext = createContext<ContextMenuContextValue | null>(null);

export interface ContextMenuProviderProps {
  children: ReactNode;
}

/**
 * Provider for context menu functionality
 */
export function ContextMenuProvider({ children }: ContextMenuProviderProps) {
  const [state, setState] = useState<ContextMenuState>({
    isOpen: false,
    position: { x: 0, y: 0 },
    items: [],
  });

  const open = useCallback(
    (items: ContextMenuItem[], position: ContextMenuPosition, target?: HTMLElement) => {
      // Adjust position to stay within viewport
      const menuWidth = 200; // Approximate menu width
      const menuHeight = items.length * 36; // Approximate height

      let x = position.x;
      let y = position.y;

      if (x + menuWidth > window.innerWidth) {
        x = window.innerWidth - menuWidth - 10;
      }
      if (y + menuHeight > window.innerHeight) {
        y = window.innerHeight - menuHeight - 10;
      }

      setState({
        isOpen: true,
        position: { x, y },
        items,
        targetElement: target,
      });
    },
    []
  );

  const close = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const value = useMemo(
    () => ({
      state,
      open,
      close,
      isOpen: state.isOpen,
    }),
    [state, open, close]
  );

  return (
    <ContextMenuContext.Provider value={value}>
      {children}
      {state.isOpen && <ContextMenuPortal />}
    </ContextMenuContext.Provider>
  );
}

/**
 * Hook to access context menu
 */
export function useContextMenu(): ContextMenuContextValue {
  const context = useContext(ContextMenuContext);
  if (!context) {
    throw new Error('useContextMenu must be used within ContextMenuProvider');
  }
  return context;
}

// ============================================================================
// Context Menu Trigger Hook
// ============================================================================

export interface UseContextMenuTriggerOptions {
  /** Menu items */
  items: ContextMenuItem[];
  /** Whether context menu is disabled */
  disabled?: boolean;
  /** Custom handler before opening */
  onBeforeOpen?: (e: MouseEvent) => boolean | void;
}

export interface UseContextMenuTriggerResult {
  /** Props to spread on trigger element */
  triggerProps: {
    onContextMenu: (e: MouseEvent<HTMLElement>) => void;
  };
  /** Open the context menu programmatically */
  openMenu: (position: ContextMenuPosition) => void;
  /** Close the context menu */
  closeMenu: () => void;
  /** Whether menu is currently open */
  isOpen: boolean;
}

/**
 * Hook for triggering context menu on an element
 */
export function useContextMenuTrigger({
  items,
  disabled = false,
  onBeforeOpen,
}: UseContextMenuTriggerOptions): UseContextMenuTriggerResult {
  const { open, close, isOpen } = useContextMenu();

  const handleContextMenu = useCallback(
    (e: MouseEvent<HTMLElement>) => {
      if (disabled) return;

      const shouldOpen = onBeforeOpen?.(e);
      if (shouldOpen === false) return;

      e.preventDefault();
      open(items, { x: e.clientX, y: e.clientY }, e.currentTarget);
    },
    [disabled, items, open, onBeforeOpen]
  );

  const openMenu = useCallback(
    (position: ContextMenuPosition) => {
      if (disabled) return;
      open(items, position);
    },
    [disabled, items, open]
  );

  return {
    triggerProps: {
      onContextMenu: handleContextMenu,
    },
    openMenu,
    closeMenu: close,
    isOpen,
  };
}

// ============================================================================
// Context Menu Portal Component
// ============================================================================

function ContextMenuPortal() {
  const { state, close } = useContextMenu();
  const menuRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  // Filter visible items
  const visibleItems = useMemo(
    () => state.items.filter((item) => !item.hidden),
    [state.items]
  );

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: globalThis.MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        close();
      }
    };

    const handleEscape = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
      }
    };

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [close]);

  // Focus management
  useEffect(() => {
    if (state.isOpen && menuRef.current) {
      menuRef.current.focus();
    }
  }, [state.isOpen]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const selectableItems = visibleItems.filter(
        (item) => item.type !== 'separator' && !item.disabled
      );
      const currentSelectableIndex = selectableItems.findIndex(
        (_, i) =>
          visibleItems.indexOf(selectableItems[i]!) === focusedIndex
      );

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (currentSelectableIndex < selectableItems.length - 1) {
            const nextItem = selectableItems[currentSelectableIndex + 1];
            setFocusedIndex(visibleItems.indexOf(nextItem!));
          } else if (currentSelectableIndex === -1 && selectableItems.length > 0) {
            setFocusedIndex(visibleItems.indexOf(selectableItems[0]!));
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (currentSelectableIndex > 0) {
            const prevItem = selectableItems[currentSelectableIndex - 1];
            setFocusedIndex(visibleItems.indexOf(prevItem!));
          }
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (focusedIndex >= 0) {
            const item = visibleItems[focusedIndex];
            if (item && !item.disabled && item.type !== 'separator') {
              item.onClick?.();
              close();
            }
          }
          break;
      }
    },
    [visibleItems, focusedIndex, close]
  );

  return (
    <div
      ref={menuRef}
      role="menu"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className="fixed z-[9999] min-w-[180px] py-1 bg-white rounded-lg shadow-xl border border-gray-200 outline-none"
      style={{
        left: state.position.x,
        top: state.position.y,
      }}
    >
      {visibleItems.map((item, index) => (
        <ContextMenuItemComponent
          key={item.id}
          item={item}
          isFocused={index === focusedIndex}
          onClose={close}
          onHover={() => setFocusedIndex(index)}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Context Menu Item Component
// ============================================================================

interface ContextMenuItemComponentProps {
  item: ContextMenuItem;
  isFocused: boolean;
  onClose: () => void;
  onHover: () => void;
}

function ContextMenuItemComponent({
  item,
  isFocused,
  onClose,
  onHover,
}: ContextMenuItemComponentProps) {
  const [submenuOpen, setSubmenuOpen] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);

  // Handle separator
  if (item.type === 'separator') {
    return <div className="my-1 border-t border-gray-200" role="separator" />;
  }

  const handleClick = () => {
    if (item.disabled) return;
    if (item.submenu) return; // Don't close on submenu items

    item.onClick?.();
    onClose();
  };

  const handleMouseEnter = () => {
    onHover();
    if (item.submenu) {
      setSubmenuOpen(true);
    }
  };

  const handleMouseLeave = () => {
    if (item.submenu) {
      setSubmenuOpen(false);
    }
  };

  const Icon = item.icon;

  return (
    <div
      ref={itemRef}
      role="menuitem"
      aria-disabled={item.disabled}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={clsx(
        'relative flex items-center gap-2 px-3 py-2 text-sm cursor-pointer transition-colors',
        isFocused && !item.disabled && 'bg-gray-100',
        item.disabled && 'opacity-50 cursor-not-allowed',
        item.destructive && !item.disabled && 'text-red-600 hover:bg-red-50'
      )}
    >
      {/* Checkbox/Radio indicator */}
      {item.type === 'checkbox' && (
        <div className="w-4 h-4 flex items-center justify-center">
          {item.checked && <Check className="w-3 h-3" />}
        </div>
      )}
      {item.type === 'radio' && (
        <div className="w-4 h-4 flex items-center justify-center">
          {item.checked && <Circle className="w-2 h-2 fill-current" />}
        </div>
      )}

      {/* Icon */}
      {Icon && <Icon className="w-4 h-4 text-gray-500" />}

      {/* Label */}
      <span className="flex-1">{item.label}</span>

      {/* Shortcut */}
      {item.shortcut && (
        <span className="text-xs text-gray-400 ml-4">{item.shortcut}</span>
      )}

      {/* Submenu indicator */}
      {item.submenu && <ChevronRight className="w-4 h-4 text-gray-400" />}

      {/* Submenu */}
      {item.submenu && submenuOpen && (
        <ContextMenuSubmenu
          items={item.submenu}
          onClose={onClose}
          parentRef={itemRef}
        />
      )}
    </div>
  );
}

// ============================================================================
// Context Menu Submenu Component
// ============================================================================

interface ContextMenuSubmenuProps {
  items: ContextMenuItem[];
  onClose: () => void;
  parentRef: React.RefObject<HTMLElement>;
}

function ContextMenuSubmenu({
  items,
  onClose,
  parentRef,
}: ContextMenuSubmenuProps) {
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const menuRef = useRef<HTMLDivElement>(null);

  // Calculate position
  const [position, setPosition] = useState({ left: '100%', top: '0px' });

  useEffect(() => {
    if (!parentRef.current || !menuRef.current) return;

    const parentRect = parentRef.current.getBoundingClientRect();
    const menuRect = menuRef.current.getBoundingClientRect();

    // Check if submenu would overflow right side
    if (parentRect.right + menuRect.width > window.innerWidth) {
      setPosition({ left: 'auto', top: '0px' });
    }
  }, [parentRef]);

  const visibleItems = items.filter((item) => !item.hidden);

  return (
    <div
      ref={menuRef}
      role="menu"
      className="absolute min-w-[180px] py-1 bg-white rounded-lg shadow-xl border border-gray-200"
      style={{
        left: position.left === 'auto' ? undefined : position.left,
        right: position.left === 'auto' ? '100%' : undefined,
        top: position.top,
      }}
    >
      {visibleItems.map((item, index) => (
        <ContextMenuItemComponent
          key={item.id}
          item={item}
          isFocused={index === focusedIndex}
          onClose={onClose}
          onHover={() => setFocusedIndex(index)}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Context Menu Trigger Component
// ============================================================================

export interface ContextMenuTriggerProps {
  /** Menu items */
  items: ContextMenuItem[];
  /** Children to wrap */
  children: ReactNode;
  /** Whether context menu is disabled */
  disabled?: boolean;
  /** Additional class names */
  className?: string;
  /** Custom handler before opening */
  onBeforeOpen?: (e: MouseEvent) => boolean | void;
}

/**
 * Component wrapper that adds context menu to its children
 */
export function ContextMenuTrigger({
  items,
  children,
  disabled = false,
  className,
  onBeforeOpen,
}: ContextMenuTriggerProps) {
  const { triggerProps } = useContextMenuTrigger({
    items,
    disabled,
    onBeforeOpen,
  });

  return (
    <div {...triggerProps} className={className}>
      {children}
    </div>
  );
}

// ============================================================================
// Dropdown Menu Component
// ============================================================================

export interface DropdownMenuProps {
  /** Menu items */
  items: ContextMenuItem[];
  /** Trigger element */
  trigger: ReactNode;
  /** Alignment of menu */
  align?: 'start' | 'center' | 'end';
  /** Side of trigger to show menu */
  side?: 'top' | 'bottom' | 'left' | 'right';
  /** Whether menu is disabled */
  disabled?: boolean;
  /** Additional class names */
  className?: string;
}

/**
 * Click-triggered dropdown menu component
 */
export function DropdownMenu({
  items,
  trigger,
  align = 'start',
  side = 'bottom',
  disabled = false,
  className,
}: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const visibleItems = useMemo(
    () => items.filter((item) => !item.hidden),
    [items]
  );

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClick = (e: globalThis.MouseEvent) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node) &&
        menuRef.current &&
        !menuRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleEscape = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleToggle = () => {
    if (disabled) return;
    setIsOpen((prev) => !prev);
    setFocusedIndex(-1);
  };

  const handleClose = () => {
    setIsOpen(false);
    setFocusedIndex(-1);
  };

  // Keyboard navigation
  const handleKeyDown = (e: KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    const selectableItems = visibleItems.filter(
      (item) => item.type !== 'separator' && !item.disabled
    );

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex((prev) => {
          const currentItem = visibleItems[prev];
          const currentSelectableIndex = currentItem
            ? selectableItems.indexOf(currentItem)
            : -1;
          if (currentSelectableIndex < selectableItems.length - 1) {
            const nextItem = selectableItems[currentSelectableIndex + 1];
            return visibleItems.indexOf(nextItem!);
          }
          return prev;
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((prev) => {
          const currentItem = visibleItems[prev];
          const currentSelectableIndex = currentItem
            ? selectableItems.indexOf(currentItem)
            : selectableItems.length;
          if (currentSelectableIndex > 0) {
            const prevItem = selectableItems[currentSelectableIndex - 1];
            return visibleItems.indexOf(prevItem!);
          }
          return prev;
        });
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (focusedIndex >= 0) {
          const item = visibleItems[focusedIndex];
          if (item && !item.disabled && item.type !== 'separator') {
            item.onClick?.();
            handleClose();
          }
        }
        break;
    }
  };

  const alignClasses = {
    start: 'left-0',
    center: 'left-1/2 -translate-x-1/2',
    end: 'right-0',
  };

  const sideClasses = {
    top: 'bottom-full mb-1',
    bottom: 'top-full mt-1',
    left: 'right-full mr-1 top-0',
    right: 'left-full ml-1 top-0',
  };

  return (
    <div className={clsx('relative inline-block', className)}>
      <div
        ref={triggerRef}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        {trigger}
      </div>

      {isOpen && (
        <div
          ref={menuRef}
          role="menu"
          className={clsx(
            'absolute z-50 min-w-[180px] py-1 bg-white rounded-lg shadow-xl border border-gray-200',
            alignClasses[align],
            sideClasses[side]
          )}
        >
          {visibleItems.map((item, index) => (
            <ContextMenuItemComponent
              key={item.id}
              item={item}
              isFocused={index === focusedIndex}
              onClose={handleClose}
              onHover={() => setFocusedIndex(index)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Menu Builder Utility
// ============================================================================

/**
 * Builder for creating menu items easily
 */
export class MenuBuilder {
  private items: ContextMenuItem[] = [];

  item(
    id: string,
    label: string,
    onClick?: () => void,
    options?: Partial<ContextMenuItem>
  ): MenuBuilder {
    this.items.push({
      id,
      label,
      onClick,
      type: 'item',
      ...options,
    });
    return this;
  }

  separator(): MenuBuilder {
    this.items.push({
      id: `separator-${this.items.length}`,
      label: '',
      type: 'separator',
    });
    return this;
  }

  checkbox(
    id: string,
    label: string,
    checked: boolean,
    onClick?: () => void,
    options?: Partial<ContextMenuItem>
  ): MenuBuilder {
    this.items.push({
      id,
      label,
      onClick,
      type: 'checkbox',
      checked,
      ...options,
    });
    return this;
  }

  radio(
    id: string,
    label: string,
    radioGroup: string,
    checked: boolean,
    onClick?: () => void,
    options?: Partial<ContextMenuItem>
  ): MenuBuilder {
    this.items.push({
      id,
      label,
      onClick,
      type: 'radio',
      radioGroup,
      checked,
      ...options,
    });
    return this;
  }

  submenu(
    id: string,
    label: string,
    submenuItems: ContextMenuItem[],
    options?: Partial<ContextMenuItem>
  ): MenuBuilder {
    this.items.push({
      id,
      label,
      type: 'item',
      submenu: submenuItems,
      ...options,
    });
    return this;
  }

  build(): ContextMenuItem[] {
    return this.items;
  }
}

/**
 * Create a new menu builder
 */
export function createMenu(): MenuBuilder {
  return new MenuBuilder();
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a simple menu item
 */
export function menuItem(
  id: string,
  label: string,
  onClick?: () => void,
  icon?: LucideIcon,
  shortcut?: string
): ContextMenuItem {
  return {
    id,
    label,
    onClick,
    icon,
    shortcut,
    type: 'item',
  };
}

/**
 * Create a separator
 */
export function menuSeparator(): ContextMenuItem {
  return {
    id: `separator-${Date.now()}`,
    label: '',
    type: 'separator',
  };
}

/**
 * Create a submenu item
 */
export function menuSubmenu(
  id: string,
  label: string,
  items: ContextMenuItem[],
  icon?: LucideIcon
): ContextMenuItem {
  return {
    id,
    label,
    icon,
    submenu: items,
    type: 'item',
  };
}

/**
 * Create a checkbox menu item
 */
export function menuCheckbox(
  id: string,
  label: string,
  checked: boolean,
  onChange: (checked: boolean) => void
): ContextMenuItem {
  return {
    id,
    label,
    type: 'checkbox',
    checked,
    onClick: () => onChange(!checked),
  };
}

/**
 * Create radio menu items from options
 */
export function menuRadioGroup<T extends string>(
  groupId: string,
  options: Array<{ id: string; label: string; value: T }>,
  currentValue: T,
  onChange: (value: T) => void
): ContextMenuItem[] {
  return options.map((option) => ({
    id: option.id,
    label: option.label,
    type: 'radio' as const,
    radioGroup: groupId,
    checked: option.value === currentValue,
    onClick: () => onChange(option.value),
  }));
}
