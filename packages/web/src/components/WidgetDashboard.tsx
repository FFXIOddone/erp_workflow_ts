/**
 * Widget Dashboard System
 * 
 * Customizable dashboard with:
 * - Drag-and-drop widget arrangement
 * - Resizable widgets
 * - Widget library with presets
 * - Layout persistence
 * - Responsive grid system
 */

import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  createContext,
  useContext,
  ReactNode,
  useRef,
} from 'react';
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion';
import {
  GripVertical,
  X,
  Maximize2,
  Minimize2,
  Settings,
  Plus,
  LayoutGrid,
  RefreshCw,
  Lock,
  Unlock,
  ChevronDown,
  Move,
} from 'lucide-react';
import { clsx } from 'clsx';

// ============================================================================
// Types
// ============================================================================

export interface WidgetSize {
  width: number; // Grid units (1-12)
  height: number; // Grid units
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
}

export interface WidgetPosition {
  x: number; // Grid column (0-11)
  y: number; // Grid row
}

export interface WidgetConfig {
  id: string;
  type: string;
  title: string;
  size: WidgetSize;
  position: WidgetPosition;
  settings?: Record<string, unknown>;
  refreshInterval?: number; // Milliseconds
  isVisible?: boolean;
  isLocked?: boolean;
  isCollapsed?: boolean;
}

export interface WidgetDefinition {
  type: string;
  title: string;
  description?: string;
  icon?: React.ElementType;
  defaultSize: WidgetSize;
  component: React.ComponentType<WidgetComponentProps>;
  settingsComponent?: React.ComponentType<WidgetSettingsProps>;
  category?: string;
}

export interface WidgetComponentProps {
  config: WidgetConfig;
  isEditing?: boolean;
  onSettingsChange?: (settings: Record<string, unknown>) => void;
}

export interface WidgetSettingsProps {
  config: WidgetConfig;
  onSave: (settings: Record<string, unknown>) => void;
  onCancel: () => void;
}

export interface DashboardLayout {
  id: string;
  name: string;
  widgets: WidgetConfig[];
  gridColumns?: number;
  gap?: number;
}

export interface DashboardContextValue {
  // Layout
  layout: DashboardLayout;
  widgets: WidgetConfig[];
  
  // Widget registry
  widgetDefinitions: Map<string, WidgetDefinition>;
  registerWidget: (definition: WidgetDefinition) => void;
  unregisterWidget: (type: string) => void;
  
  // Layout actions
  addWidget: (type: string, position?: WidgetPosition) => void;
  removeWidget: (id: string) => void;
  updateWidget: (id: string, updates: Partial<WidgetConfig>) => void;
  moveWidget: (id: string, position: WidgetPosition) => void;
  resizeWidget: (id: string, size: WidgetSize) => void;
  reorderWidgets: (widgets: WidgetConfig[]) => void;
  
  // Edit mode
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;
  
  // Persistence
  saveLayout: () => void;
  loadLayout: (layoutId: string) => void;
  resetLayout: () => void;
  
  // Config
  gridColumns: number;
  gap: number;
}

// ============================================================================
// Storage Keys
// ============================================================================

const LAYOUT_STORAGE_KEY = 'erp-dashboard-layout';

// ============================================================================
// Context
// ============================================================================

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within DashboardProvider');
  }
  return context;
}

// ============================================================================
// Provider
// ============================================================================

interface DashboardProviderProps {
  children: ReactNode;
  defaultLayout?: DashboardLayout;
  widgetDefinitions?: WidgetDefinition[];
  gridColumns?: number;
  gap?: number;
  storageKey?: string;
  onLayoutChange?: (layout: DashboardLayout) => void;
}

export function DashboardProvider({
  children,
  defaultLayout,
  widgetDefinitions: initialDefinitions = [],
  gridColumns = 12,
  gap = 4,
  storageKey = LAYOUT_STORAGE_KEY,
  onLayoutChange,
}: DashboardProviderProps) {
  const [layout, setLayout] = useState<DashboardLayout>(
    defaultLayout ?? {
      id: 'default',
      name: 'Default',
      widgets: [],
      gridColumns,
      gap,
    }
  );
  const [widgetDefinitions, setWidgetDefinitions] = useState<Map<string, WidgetDefinition>>(
    new Map(initialDefinitions.map((d) => [d.type, d]))
  );
  const [isEditing, setIsEditing] = useState(false);

  // Load saved layout
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsedLayout = JSON.parse(saved);
        setLayout(parsedLayout);
      }
    } catch (e) {
      console.error('Failed to load dashboard layout:', e);
    }
  }, [storageKey]);

  // Widget definition management
  const registerWidget = useCallback((definition: WidgetDefinition) => {
    setWidgetDefinitions((prev) => {
      const next = new Map(prev);
      next.set(definition.type, definition);
      return next;
    });
  }, []);

  const unregisterWidget = useCallback((type: string) => {
    setWidgetDefinitions((prev) => {
      const next = new Map(prev);
      next.delete(type);
      return next;
    });
  }, []);

  // Widget actions
  const addWidget = useCallback(
    (type: string, position?: WidgetPosition) => {
      const definition = widgetDefinitions.get(type);
      if (!definition) return;

      const newWidget: WidgetConfig = {
        id: `${type}-${Date.now()}`,
        type,
        title: definition.title,
        size: { ...definition.defaultSize },
        position: position ?? { x: 0, y: 0 },
        isVisible: true,
      };

      setLayout((prev) => {
        const updated = {
          ...prev,
          widgets: [...prev.widgets, newWidget],
        };
        onLayoutChange?.(updated);
        return updated;
      });
    },
    [widgetDefinitions, onLayoutChange]
  );

  const removeWidget = useCallback(
    (id: string) => {
      setLayout((prev) => {
        const updated = {
          ...prev,
          widgets: prev.widgets.filter((w) => w.id !== id),
        };
        onLayoutChange?.(updated);
        return updated;
      });
    },
    [onLayoutChange]
  );

  const updateWidget = useCallback(
    (id: string, updates: Partial<WidgetConfig>) => {
      setLayout((prev) => {
        const updated = {
          ...prev,
          widgets: prev.widgets.map((w) =>
            w.id === id ? { ...w, ...updates } : w
          ),
        };
        onLayoutChange?.(updated);
        return updated;
      });
    },
    [onLayoutChange]
  );

  const moveWidget = useCallback(
    (id: string, position: WidgetPosition) => {
      updateWidget(id, { position });
    },
    [updateWidget]
  );

  const resizeWidget = useCallback(
    (id: string, size: WidgetSize) => {
      updateWidget(id, { size });
    },
    [updateWidget]
  );

  const reorderWidgets = useCallback(
    (widgets: WidgetConfig[]) => {
      setLayout((prev) => {
        const updated = { ...prev, widgets };
        onLayoutChange?.(updated);
        return updated;
      });
    },
    [onLayoutChange]
  );

  // Persistence
  const saveLayout = useCallback(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(layout));
    } catch (e) {
      console.error('Failed to save dashboard layout:', e);
    }
  }, [layout, storageKey]);

  const loadLayout = useCallback(
    (layoutId: string) => {
      try {
        const saved = localStorage.getItem(`${storageKey}-${layoutId}`);
        if (saved) {
          setLayout(JSON.parse(saved));
        }
      } catch (e) {
        console.error('Failed to load dashboard layout:', e);
      }
    },
    [storageKey]
  );

  const resetLayout = useCallback(() => {
    setLayout(
      defaultLayout ?? {
        id: 'default',
        name: 'Default',
        widgets: [],
        gridColumns,
        gap,
      }
    );
    localStorage.removeItem(storageKey);
  }, [defaultLayout, gridColumns, gap, storageKey]);

  // Auto-save on layout change
  useEffect(() => {
    const timeout = setTimeout(saveLayout, 1000);
    return () => clearTimeout(timeout);
  }, [layout, saveLayout]);

  const contextValue = useMemo<DashboardContextValue>(
    () => ({
      layout,
      widgets: layout.widgets,
      widgetDefinitions,
      registerWidget,
      unregisterWidget,
      addWidget,
      removeWidget,
      updateWidget,
      moveWidget,
      resizeWidget,
      reorderWidgets,
      isEditing,
      setIsEditing,
      saveLayout,
      loadLayout,
      resetLayout,
      gridColumns: layout.gridColumns ?? gridColumns,
      gap: layout.gap ?? gap,
    }),
    [
      layout,
      widgetDefinitions,
      registerWidget,
      unregisterWidget,
      addWidget,
      removeWidget,
      updateWidget,
      moveWidget,
      resizeWidget,
      reorderWidgets,
      isEditing,
      saveLayout,
      loadLayout,
      resetLayout,
      gridColumns,
      gap,
    ]
  );

  return (
    <DashboardContext.Provider value={contextValue}>
      {children}
    </DashboardContext.Provider>
  );
}

// ============================================================================
// Dashboard Grid Component
// ============================================================================

interface DashboardGridProps {
  className?: string;
}

export function DashboardGrid({ className }: DashboardGridProps) {
  const { widgets, widgetDefinitions, isEditing, reorderWidgets, gridColumns, gap } =
    useDashboard();

  const visibleWidgets = widgets.filter((w) => w.isVisible !== false);

  return (
    <div
      className={clsx('relative', className)}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`,
        gap: `${gap * 4}px`,
      }}
    >
      {isEditing ? (
        <Reorder.Group
          axis="y"
          values={visibleWidgets}
          onReorder={reorderWidgets}
          className="contents"
        >
          {visibleWidgets.map((widget) => (
            <WidgetWrapper
              key={widget.id}
              config={widget}
              definition={widgetDefinitions.get(widget.type)}
              isEditing={isEditing}
            />
          ))}
        </Reorder.Group>
      ) : (
        visibleWidgets.map((widget) => (
          <WidgetWrapper
            key={widget.id}
            config={widget}
            definition={widgetDefinitions.get(widget.type)}
            isEditing={false}
          />
        ))
      )}

      {widgets.length === 0 && (
        <div
          className="col-span-full flex flex-col items-center justify-center py-16 text-gray-500"
          style={{ gridColumn: `span ${gridColumns}` }}
        >
          <LayoutGrid className="h-12 w-12 mb-4 opacity-50" />
          <p className="text-lg font-medium">No widgets added</p>
          <p className="text-sm">Click "Edit Dashboard" to add widgets</p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Widget Wrapper
// ============================================================================

interface WidgetWrapperProps {
  config: WidgetConfig;
  definition?: WidgetDefinition;
  isEditing: boolean;
}

function WidgetWrapper({ config, definition, isEditing }: WidgetWrapperProps) {
  const { updateWidget, removeWidget } = useDashboard();
  const [showSettings, setShowSettings] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const dragControls = useDragControls();

  const handleToggleCollapse = () => {
    updateWidget(config.id, { isCollapsed: !config.isCollapsed });
  };

  const handleToggleLock = () => {
    updateWidget(config.id, { isLocked: !config.isLocked });
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Widget-specific refresh would be handled by the component
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const Component = definition?.component;

  const widgetContent = (
    <motion.div
      layout
      className={clsx(
        'bg-white dark:bg-gray-800',
        'rounded-xl shadow-sm',
        'border border-gray-200 dark:border-gray-700',
        'overflow-hidden',
        isEditing && !config.isLocked && 'ring-2 ring-blue-500/50 ring-dashed',
        config.isLocked && 'opacity-75'
      )}
      style={{
        gridColumn: `span ${config.size.width}`,
        gridRow: config.isCollapsed ? 'span 1' : `span ${config.size.height}`,
      }}
    >
      {/* Header */}
      <div
        className={clsx(
          'flex items-center gap-2 px-4 py-3',
          'border-b border-gray-200 dark:border-gray-700',
          'bg-gray-50 dark:bg-gray-800/50'
        )}
      >
        {/* Drag handle (edit mode only) */}
        {isEditing && !config.isLocked && (
          <button
            onPointerDown={(e) => dragControls.start(e)}
            className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}

        {/* Title */}
        <h3 className="flex-1 font-medium text-gray-900 dark:text-white truncate">
          {config.title}
        </h3>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {/* Refresh */}
          <button
            onClick={handleRefresh}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
            title="Refresh"
          >
            <RefreshCw
              className={clsx('h-4 w-4', isRefreshing && 'animate-spin')}
            />
          </button>

          {/* Collapse/Expand */}
          <button
            onClick={handleToggleCollapse}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
            title={config.isCollapsed ? 'Expand' : 'Collapse'}
          >
            {config.isCollapsed ? (
              <Maximize2 className="h-4 w-4" />
            ) : (
              <Minimize2 className="h-4 w-4" />
            )}
          </button>

          {/* Settings */}
          {definition?.settingsComponent && (
            <button
              onClick={() => setShowSettings(true)}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
              title="Settings"
            >
              <Settings className="h-4 w-4" />
            </button>
          )}

          {isEditing && (
            <>
              {/* Lock toggle */}
              <button
                onClick={handleToggleLock}
                className={clsx(
                  'p-1.5 rounded',
                  config.isLocked
                    ? 'text-amber-500'
                    : 'text-gray-400 hover:text-gray-600'
                )}
                title={config.isLocked ? 'Unlock' : 'Lock'}
              >
                {config.isLocked ? (
                  <Lock className="h-4 w-4" />
                ) : (
                  <Unlock className="h-4 w-4" />
                )}
              </button>

              {/* Remove */}
              <button
                onClick={() => removeWidget(config.id)}
                className="p-1.5 text-gray-400 hover:text-red-500 rounded"
                title="Remove widget"
              >
                <X className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <AnimatePresence>
        {!config.isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4">
              {Component ? (
                <Component config={config} isEditing={isEditing} />
              ) : (
                <div className="text-center text-gray-500 py-8">
                  Widget component not found
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && definition?.settingsComponent && (
          <WidgetSettingsModal
            config={config}
            SettingsComponent={definition.settingsComponent}
            onClose={() => setShowSettings(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );

  if (isEditing && !config.isLocked) {
    return (
      <Reorder.Item
        value={config}
        dragListener={false}
        dragControls={dragControls}
      >
        {widgetContent}
      </Reorder.Item>
    );
  }

  return widgetContent;
}

// ============================================================================
// Widget Settings Modal
// ============================================================================

interface WidgetSettingsModalProps {
  config: WidgetConfig;
  SettingsComponent: React.ComponentType<WidgetSettingsProps>;
  onClose: () => void;
}

function WidgetSettingsModal({
  config,
  SettingsComponent,
  onClose,
}: WidgetSettingsModalProps) {
  const { updateWidget } = useDashboard();

  const handleSave = (settings: Record<string, unknown>) => {
    updateWidget(config.id, { settings });
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className={clsx(
          'w-full max-w-md',
          'bg-white dark:bg-gray-800',
          'rounded-xl shadow-2xl',
          'overflow-hidden'
        )}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-medium text-gray-900 dark:text-white">
            {config.title} Settings
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4">
          <SettingsComponent
            config={config}
            onSave={handleSave}
            onCancel={onClose}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

// ============================================================================
// Widget Library Component
// ============================================================================

interface WidgetLibraryProps {
  className?: string;
}

export function WidgetLibrary({ className }: WidgetLibraryProps) {
  const { widgetDefinitions, addWidget } = useDashboard();
  const [isOpen, setIsOpen] = useState(false);

  const categories = useMemo(() => {
    const cats = new Map<string, WidgetDefinition[]>();
    for (const def of widgetDefinitions.values()) {
      const category = def.category ?? 'Other';
      const existing = cats.get(category) ?? [];
      existing.push(def);
      cats.set(category, existing);
    }
    return cats;
  }, [widgetDefinitions]);

  return (
    <div className={clsx('relative', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'flex items-center gap-2 px-4 py-2',
          'bg-blue-600 text-white',
          'rounded-lg hover:bg-blue-700',
          'transition-colors'
        )}
      >
        <Plus className="h-4 w-4" />
        Add Widget
        <ChevronDown
          className={clsx('h-4 w-4 transition-transform', isOpen && 'rotate-180')}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={clsx(
              'absolute left-0 top-full mt-2 z-50',
              'w-80 max-h-96 overflow-auto',
              'bg-white dark:bg-gray-800',
              'rounded-xl shadow-xl',
              'border border-gray-200 dark:border-gray-700'
            )}
          >
            {Array.from(categories.entries()).map(([category, definitions]) => (
              <div key={category}>
                <div className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 dark:bg-gray-800/50">
                  {category}
                </div>
                {definitions.map((def) => {
                  const Icon = def.icon ?? LayoutGrid;
                  return (
                    <button
                      key={def.type}
                      onClick={() => {
                        addWidget(def.type);
                        setIsOpen(false);
                      }}
                      className={clsx(
                        'w-full flex items-start gap-3 px-4 py-3',
                        'text-left hover:bg-gray-50 dark:hover:bg-gray-700',
                        'transition-colors'
                      )}
                    >
                      <Icon className="h-5 w-5 text-blue-500 mt-0.5" />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {def.title}
                        </div>
                        {def.description && (
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {def.description}
                          </div>
                        )}
                        <div className="text-xs text-gray-400 mt-1">
                          {def.defaultSize.width}×{def.defaultSize.height} grid
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}

            {widgetDefinitions.size === 0 && (
              <div className="px-4 py-8 text-center text-gray-500">
                No widgets available
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Dashboard Toolbar
// ============================================================================

interface DashboardToolbarProps {
  className?: string;
}

export function DashboardToolbar({ className }: DashboardToolbarProps) {
  const { isEditing, setIsEditing, saveLayout, resetLayout } = useDashboard();

  return (
    <div
      className={clsx(
        'flex items-center justify-between gap-4',
        'px-4 py-3',
        'bg-white dark:bg-gray-800',
        'border-b border-gray-200 dark:border-gray-700',
        className
      )}
    >
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
        Dashboard
      </h2>

      <div className="flex items-center gap-2">
        {isEditing && <WidgetLibrary />}

        {isEditing && (
          <button
            onClick={resetLayout}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            <RefreshCw className="h-4 w-4" />
            Reset
          </button>
        )}

        <button
          onClick={() => {
            if (isEditing) {
              saveLayout();
            }
            setIsEditing(!isEditing);
          }}
          className={clsx(
            'flex items-center gap-2 px-4 py-2 rounded-lg',
            'text-sm font-medium transition-colors',
            isEditing
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          )}
        >
          {isEditing ? (
            <>
              <Move className="h-4 w-4" />
              Done Editing
            </>
          ) : (
            <>
              <Settings className="h-4 w-4" />
              Edit Dashboard
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Sample Widget: Stats Card
// ============================================================================

export interface StatsWidgetSettings {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
}

export function StatsWidget({ config }: WidgetComponentProps) {
  const settings = config.settings as StatsWidgetSettings | undefined;

  return (
    <div className="text-center">
      <div className="text-3xl font-bold text-gray-900 dark:text-white">
        {settings?.value ?? '—'}
      </div>
      <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
        {settings?.label ?? 'Statistic'}
      </div>
      {settings?.change !== undefined && (
        <div
          className={clsx(
            'text-sm mt-2',
            settings.change >= 0 ? 'text-green-600' : 'text-red-600'
          )}
        >
          {settings.change >= 0 ? '+' : ''}{settings.change}%{' '}
          {settings.changeLabel}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Sample Widget: Chart Placeholder
// ============================================================================

export function ChartWidget({ config }: WidgetComponentProps) {
  return (
    <div className="h-48 flex items-center justify-center bg-gray-50 dark:bg-gray-700/50 rounded-lg">
      <span className="text-gray-400">Chart: {config.title}</span>
    </div>
  );
}

// ============================================================================
// Sample Widget: List
// ============================================================================

export function ListWidget({ config }: WidgetComponentProps) {
  const items = (config.settings?.items as string[]) ?? [
    'Item 1',
    'Item 2',
    'Item 3',
  ];

  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li
          key={index}
          className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
        >
          <span className="w-6 h-6 flex items-center justify-center bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs rounded-full">
            {index + 1}
          </span>
          <span className="text-gray-700 dark:text-gray-300">{item}</span>
        </li>
      ))}
    </ul>
  );
}

// ============================================================================
// Default Widget Definitions
// ============================================================================

export const defaultWidgetDefinitions: WidgetDefinition[] = [
  {
    type: 'stats',
    title: 'Statistics',
    description: 'Display a key metric with optional change indicator',
    category: 'Data',
    defaultSize: { width: 3, height: 2 },
    component: StatsWidget,
  },
  {
    type: 'chart',
    title: 'Chart',
    description: 'Display data in a chart format',
    category: 'Data',
    defaultSize: { width: 6, height: 4 },
    component: ChartWidget,
  },
  {
    type: 'list',
    title: 'List',
    description: 'Display a list of items',
    category: 'Content',
    defaultSize: { width: 4, height: 4 },
    component: ListWidget,
  },
];

export default DashboardGrid;
