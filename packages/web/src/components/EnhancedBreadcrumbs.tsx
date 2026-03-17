/**
 * Enhanced Breadcrumb Navigation System
 * 
 * Advanced breadcrumb navigation with:
 * - Dynamic breadcrumb generation from routes
 * - Collapsible breadcrumbs for deep nesting
 * - Interactive dropdown menus for sibling navigation
 * - Keyboard navigation support
 * - History integration for back/forward
 * - Custom renderers for special breadcrumb types
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
  ChevronRight,
  ChevronDown,
  Home,
  MoreHorizontal,
  ArrowLeft,
  ArrowRight,
  Folder,
  File,
  Settings,
  Package,
  Users,
  ShoppingCart,
  Calendar,
  BarChart2,
  ExternalLink,
} from 'lucide-react';
import { clsx } from 'clsx';

// ============================================================================
// Types
// ============================================================================

export interface BreadcrumbItem {
  /** Unique identifier */
  id: string;
  
  /** Display label */
  label: string;
  
  /** Navigation path/href */
  path: string;
  
  /** Icon component */
  icon?: React.ElementType;
  
  /** Whether this is the current/active item */
  active?: boolean;
  
  /** Sibling items for dropdown navigation */
  siblings?: BreadcrumbItem[];
  
  /** Custom data associated with this breadcrumb */
  data?: Record<string, unknown>;
  
  /** Custom renderer */
  render?: (item: BreadcrumbItem) => ReactNode;
}

export interface BreadcrumbConfig {
  /** Maximum visible items before collapsing */
  maxVisible?: number;
  
  /** Show home icon for first item */
  showHomeIcon?: boolean;
  
  /** Custom separator */
  separator?: ReactNode;
  
  /** Enable keyboard navigation */
  keyboardNavigation?: boolean;
  
  /** Show back/forward buttons */
  showHistoryButtons?: boolean;
  
  /** Custom icons for entity types */
  entityIcons?: Record<string, React.ElementType>;
}

export interface BreadcrumbContextValue {
  items: BreadcrumbItem[];
  setItems: (items: BreadcrumbItem[]) => void;
  pushItem: (item: BreadcrumbItem) => void;
  popItem: () => void;
  replaceItem: (id: string, item: BreadcrumbItem) => void;
  config: BreadcrumbConfig;
  navigate: (path: string) => void;
}

// ============================================================================
// Context
// ============================================================================

const BreadcrumbContext = createContext<BreadcrumbContextValue | null>(null);

export function useBreadcrumbs() {
  const context = useContext(BreadcrumbContext);
  if (!context) {
    throw new Error('useBreadcrumbs must be used within BreadcrumbProvider');
  }
  return context;
}

// ============================================================================
// Default Icons by Entity Type
// ============================================================================

const DEFAULT_ENTITY_ICONS: Record<string, React.ElementType> = {
  home: Home,
  orders: ShoppingCart,
  order: File,
  inventory: Package,
  item: File,
  users: Users,
  user: Users,
  settings: Settings,
  reports: BarChart2,
  schedule: Calendar,
  folder: Folder,
  file: File,
};

// ============================================================================
// Provider
// ============================================================================

interface BreadcrumbProviderProps {
  children: ReactNode;
  initialItems?: BreadcrumbItem[];
  config?: BreadcrumbConfig;
  onNavigate?: (path: string) => void;
}

export function BreadcrumbProvider({
  children,
  initialItems = [],
  config: userConfig = {},
  onNavigate,
}: BreadcrumbProviderProps) {
  const [items, setItems] = useState<BreadcrumbItem[]>(initialItems);

  const config = useMemo<BreadcrumbConfig>(
    () => ({
      maxVisible: 4,
      showHomeIcon: true,
      keyboardNavigation: true,
      showHistoryButtons: false,
      entityIcons: { ...DEFAULT_ENTITY_ICONS, ...userConfig.entityIcons },
      ...userConfig,
    }),
    [userConfig]
  );

  const pushItem = useCallback((item: BreadcrumbItem) => {
    setItems((prev) => [...prev, item]);
  }, []);

  const popItem = useCallback(() => {
    setItems((prev) => prev.slice(0, -1));
  }, []);

  const replaceItem = useCallback((id: string, item: BreadcrumbItem) => {
    setItems((prev) => prev.map((i) => (i.id === id ? item : i)));
  }, []);

  const navigate = useCallback(
    (path: string) => {
      if (onNavigate) {
        onNavigate(path);
      } else {
        // Default to window navigation
        window.location.href = path;
      }
    },
    [onNavigate]
  );

  const contextValue = useMemo<BreadcrumbContextValue>(
    () => ({
      items,
      setItems,
      pushItem,
      popItem,
      replaceItem,
      config,
      navigate,
    }),
    [items, pushItem, popItem, replaceItem, config, navigate]
  );

  return (
    <BreadcrumbContext.Provider value={contextValue}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

// ============================================================================
// Main Breadcrumb Component
// ============================================================================

interface EnhancedBreadcrumbsProps {
  items?: BreadcrumbItem[];
  className?: string;
  onNavigate?: (path: string) => void;
  maxVisible?: number;
  showHomeIcon?: boolean;
  showHistoryButtons?: boolean;
}

export function EnhancedBreadcrumbs({
  items: propItems,
  className,
  onNavigate,
  maxVisible = 4,
  showHomeIcon = true,
  showHistoryButtons = false,
}: EnhancedBreadcrumbsProps) {
  const context = useContext(BreadcrumbContext);
  const items = propItems ?? context?.items ?? [];
  const navigate = onNavigate ?? context?.navigate ?? ((path: string) => { window.location.href = path; });

  const [expandedDropdown, setExpandedDropdown] = useState<string | null>(null);
  const containerRef = useRef<HTMLElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setExpandedDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Calculate visible items
  const { visibleItems, collapsedItems, hasCollapsed } = useMemo(() => {
    if (items.length <= maxVisible) {
      return { visibleItems: items, collapsedItems: [], hasCollapsed: false };
    }

    // Always show first and last items, collapse middle
    const first = items[0];
    const last = items.slice(-1);
    const middle = items.slice(1, -1);
    const visibleMiddle = middle.slice(-Math.max(0, maxVisible - 2));
    const collapsed = middle.slice(0, -Math.max(0, maxVisible - 2));

    return {
      visibleItems: [first, ...visibleMiddle, ...last],
      collapsedItems: collapsed,
      hasCollapsed: collapsed.length > 0,
    };
  }, [items, maxVisible]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, item: BreadcrumbItem, index: number) => {
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          if (index > 0) {
            const prev = containerRef.current?.querySelector(
              `[data-breadcrumb-index="${index - 1}"]`
            ) as HTMLElement;
            prev?.focus();
          }
          break;

        case 'ArrowRight':
          e.preventDefault();
          const next = containerRef.current?.querySelector(
            `[data-breadcrumb-index="${index + 1}"]`
          ) as HTMLElement;
          next?.focus();
          break;

        case 'ArrowDown':
          if (item.siblings && item.siblings.length > 0) {
            e.preventDefault();
            setExpandedDropdown(item.id);
          }
          break;

        case 'Enter':
        case ' ':
          if (!item.active) {
            e.preventDefault();
            navigate(item.path);
          }
          break;

        case 'Escape':
          setExpandedDropdown(null);
          break;
      }
    },
    [navigate]
  );

  return (
    <nav
      ref={containerRef}
      aria-label="Breadcrumb"
      className={clsx('flex items-center', className)}
    >
      {/* History buttons */}
      {showHistoryButtons && (
        <div className="flex items-center mr-3 gap-1">
          <button
            onClick={() => window.history.back()}
            className={clsx(
              'p-1.5 rounded-md',
              'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300',
              'hover:bg-gray-100 dark:hover:bg-gray-700',
              'transition-colors'
            )}
            title="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => window.history.forward()}
            className={clsx(
              'p-1.5 rounded-md',
              'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300',
              'hover:bg-gray-100 dark:hover:bg-gray-700',
              'transition-colors'
            )}
            title="Go forward"
          >
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Breadcrumb items */}
      <ol className="flex items-center space-x-1">
        {visibleItems.map((item, index) => {
          const isFirst = index === 0;
          const isLast = index === visibleItems.length - 1;
          const showCollapsedAfter = isFirst && hasCollapsed;
          const Icon = item.icon ?? DEFAULT_ENTITY_ICONS[item.id] ?? File;

          return (
            <React.Fragment key={item.id}>
              {/* Separator before (except first) */}
              {!isFirst && (
                <li className="flex items-center" aria-hidden>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </li>
              )}

              {/* Breadcrumb item */}
              <li className="flex items-center">
                {item.render ? (
                  item.render(item)
                ) : (
                  <BreadcrumbItemButton
                    item={item}
                    index={index}
                    isFirst={isFirst}
                    isLast={isLast}
                    showHomeIcon={showHomeIcon}
                    Icon={Icon}
                    isDropdownOpen={expandedDropdown === item.id}
                    onToggleDropdown={() =>
                      setExpandedDropdown(expandedDropdown === item.id ? null : item.id)
                    }
                    onNavigate={navigate}
                    onKeyDown={(e) => handleKeyDown(e, item, index)}
                  />
                )}
              </li>

              {/* Collapsed items indicator */}
              {showCollapsedAfter && (
                <>
                  <li className="flex items-center" aria-hidden>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </li>
                  <li className="flex items-center">
                    <CollapsedDropdown
                      items={collapsedItems}
                      onNavigate={navigate}
                    />
                  </li>
                </>
              )}
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

// ============================================================================
// Breadcrumb Item Button
// ============================================================================

interface BreadcrumbItemButtonProps {
  item: BreadcrumbItem;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  showHomeIcon: boolean;
  Icon: React.ElementType;
  isDropdownOpen: boolean;
  onToggleDropdown: () => void;
  onNavigate: (path: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

function BreadcrumbItemButton({
  item,
  index,
  isFirst,
  isLast,
  showHomeIcon,
  Icon,
  isDropdownOpen,
  onToggleDropdown,
  onNavigate,
  onKeyDown,
}: BreadcrumbItemButtonProps) {
  const hasSiblings = item.siblings && item.siblings.length > 0;
  const dropdownRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative">
      <div className="flex items-center">
        {/* Main button */}
        <button
          data-breadcrumb-index={index}
          onClick={() => !isLast && onNavigate(item.path)}
          onKeyDown={onKeyDown}
          className={clsx(
            'flex items-center gap-1.5 px-2 py-1 rounded-md text-sm',
            'transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500',
            isLast
              ? 'font-medium text-gray-900 dark:text-white cursor-default'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
          )}
          aria-current={isLast ? 'page' : undefined}
        >
          {(isFirst && showHomeIcon) || Icon !== File ? (
            <Icon className="h-4 w-4" />
          ) : null}
          <span className="max-w-[200px] truncate">{item.label}</span>
        </button>

        {/* Dropdown toggle for siblings */}
        {hasSiblings && (
          <button
            onClick={onToggleDropdown}
            className={clsx(
              'ml-0.5 p-1 rounded-md',
              'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300',
              'hover:bg-gray-100 dark:hover:bg-gray-700',
              'transition-colors'
            )}
            aria-expanded={isDropdownOpen}
            aria-haspopup="listbox"
          >
            <ChevronDown
              className={clsx(
                'h-3.5 w-3.5 transition-transform',
                isDropdownOpen && 'rotate-180'
              )}
            />
          </button>
        )}
      </div>

      {/* Siblings dropdown */}
      <AnimatePresence>
        {isDropdownOpen && hasSiblings && (
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className={clsx(
              'absolute left-0 top-full mt-1 z-50',
              'w-56 max-h-64 overflow-auto',
              'bg-white dark:bg-gray-800',
              'rounded-lg shadow-xl',
              'border border-gray-200 dark:border-gray-700',
              'py-1'
            )}
            role="listbox"
          >
            {item.siblings!.map((sibling) => (
              <button
                key={sibling.id}
                onClick={() => onNavigate(sibling.path)}
                className={clsx(
                  'w-full flex items-center gap-2 px-3 py-2 text-sm text-left',
                  'text-gray-700 dark:text-gray-300',
                  'hover:bg-gray-100 dark:hover:bg-gray-700',
                  sibling.id === item.id && 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                )}
                role="option"
                aria-selected={sibling.id === item.id}
              >
                {sibling.icon && <sibling.icon className="h-4 w-4" />}
                <span className="truncate">{sibling.label}</span>
                {sibling.path.startsWith('http') && (
                  <ExternalLink className="h-3 w-3 ml-auto opacity-50" />
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Collapsed Items Dropdown
// ============================================================================

interface CollapsedDropdownProps {
  items: BreadcrumbItem[];
  onNavigate: (path: string) => void;
}

function CollapsedDropdown({ items, onNavigate }: CollapsedDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'flex items-center justify-center w-7 h-7 rounded-md',
          'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300',
          'hover:bg-gray-100 dark:hover:bg-gray-700',
          'transition-colors'
        )}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        title={`${items.length} collapsed items`}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className={clsx(
                'absolute left-0 top-full mt-1 z-50',
                'w-48 max-h-64 overflow-auto',
                'bg-white dark:bg-gray-800',
                'rounded-lg shadow-xl',
                'border border-gray-200 dark:border-gray-700',
                'py-1'
              )}
              role="menu"
            >
              {items.map((item) => {
                const Icon = item.icon ?? DEFAULT_ENTITY_ICONS[item.id] ?? File;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onNavigate(item.path);
                      setIsOpen(false);
                    }}
                    className={clsx(
                      'w-full flex items-center gap-2 px-3 py-2 text-sm text-left',
                      'text-gray-700 dark:text-gray-300',
                      'hover:bg-gray-100 dark:hover:bg-gray-700'
                    )}
                    role="menuitem"
                  >
                    <Icon className="h-4 w-4" />
                    <span className="truncate">{item.label}</span>
                  </button>
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
// Route-Based Breadcrumb Generator Hook
// ============================================================================

interface RouteConfig {
  path: string;
  label: string | ((params: Record<string, string>) => string);
  icon?: React.ElementType;
  parent?: string;
  loadSiblings?: (params: Record<string, string>) => Promise<BreadcrumbItem[]>;
}

export function useRouteBreadcrumbs(
  currentPath: string,
  routes: RouteConfig[],
  params: Record<string, string> = {}
): BreadcrumbItem[] {
  return useMemo(() => {
    const items: BreadcrumbItem[] = [];
    let path = currentPath;

    // Find matching route
    const matchRoute = (routePath: string, checkPath: string): boolean => {
      const routeParts = routePath.split('/').filter(Boolean);
      const pathParts = checkPath.split('/').filter(Boolean);

      if (routeParts.length !== pathParts.length) return false;

      return routeParts.every((part, i) => {
        if (part.startsWith(':')) return true;
        return part === pathParts[i];
      });
    };

    const buildBreadcrumb = (route: RouteConfig): BreadcrumbItem => {
      const label = typeof route.label === 'function'
        ? route.label(params)
        : route.label;

      return {
        id: route.path,
        label,
        path: route.path.replace(/:([^/]+)/g, (_, key) => params[key] || ''),
        icon: route.icon,
      };
    };

    // Build path from current route to root
    while (path && path !== '/') {
      const route = routes.find((r) => matchRoute(r.path, path));
      if (route) {
        items.unshift(buildBreadcrumb(route));
        path = route.parent ?? '';
      } else {
        break;
      }
    }

    // Mark last item as active
    if (items.length > 0) {
      items[items.length - 1].active = true;
    }

    return items;
  }, [currentPath, routes, params]);
}

// ============================================================================
// Dynamic Breadcrumb Hook (for entities)
// ============================================================================

interface EntityBreadcrumbConfig {
  entityType: string;
  entityId: string;
  entityLabel?: string;
  parentPath: string;
  parentLabel: string;
  basePath?: string;
  loadEntity?: (id: string) => Promise<{ label: string; data?: Record<string, unknown> }>;
  loadSiblings?: (entityId: string) => Promise<BreadcrumbItem[]>;
}

export function useEntityBreadcrumbs(config: EntityBreadcrumbConfig): BreadcrumbItem[] {
  const [items, setItems] = useState<BreadcrumbItem[]>([]);
  const [entityLabel, setEntityLabel] = useState(config.entityLabel ?? config.entityId);
  const [siblings, setSiblings] = useState<BreadcrumbItem[]>([]);

  // Load entity label if not provided
  useEffect(() => {
    if (!config.entityLabel && config.loadEntity) {
      config.loadEntity(config.entityId).then((result) => {
        setEntityLabel(result.label);
      });
    }
  }, [config.entityId, config.entityLabel, config.loadEntity]);

  // Load siblings if available
  useEffect(() => {
    if (config.loadSiblings) {
      config.loadSiblings(config.entityId).then((result) => {
        setSiblings(result);
      });
    }
  }, [config.entityId, config.loadSiblings]);

  // Build breadcrumbs
  useEffect(() => {
    const basePath = config.basePath ?? '';
    const newItems: BreadcrumbItem[] = [];

    // Add home
    if (basePath) {
      newItems.push({
        id: 'home',
        label: 'Home',
        path: basePath,
        icon: Home,
      });
    }

    // Add parent
    newItems.push({
      id: config.entityType + '-list',
      label: config.parentLabel,
      path: config.parentPath,
      icon: DEFAULT_ENTITY_ICONS[config.entityType + 's'] ?? Folder,
    });

    // Add current entity
    newItems.push({
      id: config.entityId,
      label: entityLabel,
      path: `${config.parentPath}/${config.entityId}`,
      icon: DEFAULT_ENTITY_ICONS[config.entityType] ?? File,
      active: true,
      siblings: siblings.length > 0 ? siblings : undefined,
    });

    setItems(newItems);
  }, [config, entityLabel, siblings]);

  return items;
}

export default EnhancedBreadcrumbs;
