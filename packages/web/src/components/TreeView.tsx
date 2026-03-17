/**
 * TreeView.tsx - CRITICAL-26
 * 
 * Hierarchical tree component for the ERP application.
 * Provides expandable nodes, selection, drag-drop, and keyboard navigation.
 * 
 * Features:
 * - 26.1: Basic tree with expand/collapse
 * - 26.2: Single and multi-select modes
 * - 26.3: Drag and drop reordering
 * - 26.4: Keyboard navigation (arrow keys, enter, space)
 * - 26.5: Search/filter functionality
 * 
 * @module TreeView
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
  type KeyboardEvent,
  type DragEvent,
} from 'react';
import { clsx } from 'clsx';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  File,
  Check,
  Minus,
  GripVertical,
} from 'lucide-react';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/** Tree node data */
export interface TreeNode<T = unknown> {
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Optional icon */
  icon?: ReactNode;
  /** Child nodes */
  children?: TreeNode<T>[];
  /** Custom data */
  data?: T;
  /** Whether node is disabled */
  disabled?: boolean;
  /** Whether node is leaf (no children) */
  isLeaf?: boolean;
  /** Whether node is loading children */
  isLoading?: boolean;
}

/** Tree selection mode */
export type TreeSelectionMode = 'none' | 'single' | 'multiple' | 'checkbox';

/** Tree context value */
export interface TreeContextValue<T = unknown> {
  /** Expanded node IDs */
  expandedIds: Set<string>;
  /** Selected node IDs */
  selectedIds: Set<string>;
  /** Focused node ID */
  focusedId: string | null;
  /** Selection mode */
  selectionMode: TreeSelectionMode;
  /** Toggle node expansion */
  toggleExpand: (id: string) => void;
  /** Toggle node selection */
  toggleSelect: (id: string, event?: React.MouseEvent) => void;
  /** Set focused node */
  setFocused: (id: string | null) => void;
  /** Expand all nodes */
  expandAll: () => void;
  /** Collapse all nodes */
  collapseAll: () => void;
  /** Select all nodes */
  selectAll: () => void;
  /** Clear selection */
  clearSelection: () => void;
  /** Get node by ID */
  getNode: (id: string) => TreeNode<T> | null;
  /** Get parent node */
  getParent: (id: string) => TreeNode<T> | null;
  /** Is node draggable */
  isDraggable: boolean;
  /** Current drag node ID */
  dragNodeId: string | null;
  /** Set drag node */
  setDragNode: (id: string | null) => void;
  /** Drop target ID */
  dropTargetId: string | null;
  /** Set drop target */
  setDropTarget: (id: string | null) => void;
  /** On drop handler */
  onDrop?: (sourceId: string, targetId: string, position: 'before' | 'after' | 'inside') => void;
  /** On load children (async) */
  onLoadChildren?: (node: TreeNode<T>) => Promise<TreeNode<T>[]>;
  /** Show lines connecting nodes */
  showLines: boolean;
  /** Indent size in pixels */
  indentSize: number;
}

/** Tree view props */
export interface TreeViewProps<T = unknown> {
  /** Tree data */
  data: TreeNode<T>[];
  /** Selection mode */
  selectionMode?: TreeSelectionMode;
  /** Initially expanded IDs */
  defaultExpandedIds?: string[];
  /** Controlled expanded IDs */
  expandedIds?: string[];
  /** On expanded change */
  onExpandedChange?: (ids: string[]) => void;
  /** Initially selected IDs */
  defaultSelectedIds?: string[];
  /** Controlled selected IDs */
  selectedIds?: string[];
  /** On selection change */
  onSelectionChange?: (ids: string[], nodes: TreeNode<T>[]) => void;
  /** On node click */
  onNodeClick?: (node: TreeNode<T>) => void;
  /** On node double click */
  onNodeDoubleClick?: (node: TreeNode<T>) => void;
  /** On node context menu */
  onNodeContextMenu?: (node: TreeNode<T>, event: React.MouseEvent) => void;
  /** Enable drag and drop */
  draggable?: boolean;
  /** On drop handler */
  onDrop?: (sourceId: string, targetId: string, position: 'before' | 'after' | 'inside') => void;
  /** Async children loader */
  onLoadChildren?: (node: TreeNode<T>) => Promise<TreeNode<T>[]>;
  /** Show connecting lines */
  showLines?: boolean;
  /** Indent size in pixels */
  indentSize?: number;
  /** Filter/search query */
  filterQuery?: string;
  /** Custom filter function */
  filterFn?: (node: TreeNode<T>, query: string) => boolean;
  /** Render custom node content */
  renderNode?: (node: TreeNode<T>, props: TreeNodeRenderProps) => ReactNode;
  /** Empty state content */
  emptyContent?: ReactNode;
  /** Additional class */
  className?: string;
  /** ARIA label */
  'aria-label'?: string;
}

/** Tree node render props */
export interface TreeNodeRenderProps {
  isExpanded: boolean;
  isSelected: boolean;
  isFocused: boolean;
  isDisabled: boolean;
  level: number;
  hasChildren: boolean;
}

/** Tree node item props */
export interface TreeNodeItemProps<T = unknown> {
  /** Node data */
  node: TreeNode<T>;
  /** Nesting level (0-based) */
  level: number;
  /** Parent node IDs for line drawing */
  parentIds: string[];
  /** Custom renderer */
  renderNode?: TreeViewProps<T>['renderNode'];
  /** On click */
  onClick?: (node: TreeNode<T>) => void;
  /** On double click */
  onDoubleClick?: (node: TreeNode<T>) => void;
  /** On context menu */
  onContextMenu?: (node: TreeNode<T>, event: React.MouseEvent) => void;
}

// ============================================================================
// CONTEXT
// ============================================================================

const TreeContext = createContext<TreeContextValue | null>(null);

function useTreeContext<T = unknown>(): TreeContextValue<T> {
  const context = useContext(TreeContext);
  if (!context) {
    throw new Error('useTreeContext must be used within a TreeView');
  }
  return context as TreeContextValue<T>;
}

// ============================================================================
// UTILITIES
// ============================================================================

/** Get all node IDs from tree */
function getAllNodeIds<T>(nodes: TreeNode<T>[]): string[] {
  const ids: string[] = [];
  
  const traverse = (node: TreeNode<T>) => {
    ids.push(node.id);
    node.children?.forEach(traverse);
  };
  
  nodes.forEach(traverse);
  return ids;
}

/** Find node by ID */
function findNode<T>(nodes: TreeNode<T>[], id: string): TreeNode<T> | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNode(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

/** Find parent of node */
function findParent<T>(
  nodes: TreeNode<T>[],
  id: string,
  parent: TreeNode<T> | null = null
): TreeNode<T> | null {
  for (const node of nodes) {
    if (node.id === id) return parent;
    if (node.children) {
      const found = findParent(node.children, id, node);
      if (found) return found;
    }
  }
  return null;
}

/** Get visible nodes (respecting expansion) */
function getVisibleNodes<T>(
  nodes: TreeNode<T>[],
  expandedIds: Set<string>
): TreeNode<T>[] {
  const visible: TreeNode<T>[] = [];
  
  const traverse = (node: TreeNode<T>) => {
    visible.push(node);
    if (node.children && expandedIds.has(node.id)) {
      node.children.forEach(traverse);
    }
  };
  
  nodes.forEach(traverse);
  return visible;
}

/** Filter nodes by query */
function filterNodes<T>(
  nodes: TreeNode<T>[],
  query: string,
  filterFn?: (node: TreeNode<T>, query: string) => boolean
): TreeNode<T>[] {
  if (!query.trim()) return nodes;

  const matchesQuery = filterFn ?? ((node: TreeNode<T>, q: string) =>
    node.label.toLowerCase().includes(q.toLowerCase())
  );

  const filterRecursive = (node: TreeNode<T>): TreeNode<T> | null => {
    const childMatches = node.children
      ?.map(filterRecursive)
      .filter((n): n is TreeNode<T> => n !== null);

    const nodeMatches = matchesQuery(node, query);
    const hasMatchingChildren = childMatches && childMatches.length > 0;

    if (nodeMatches || hasMatchingChildren) {
      return {
        ...node,
        children: childMatches,
      };
    }

    return null;
  };

  return nodes
    .map(filterRecursive)
    .filter((n): n is TreeNode<T> => n !== null);
}

// ============================================================================
// 26.1-26.5: TREE VIEW COMPONENT
// ============================================================================

/**
 * Hierarchical tree view component
 * 
 * @example
 * ```tsx
 * const treeData = [
 *   {
 *     id: '1',
 *     label: 'Documents',
 *     children: [
 *       { id: '1-1', label: 'Report.pdf' },
 *       { id: '1-2', label: 'Invoice.pdf' },
 *     ],
 *   },
 * ];
 * 
 * <TreeView
 *   data={treeData}
 *   selectionMode="multiple"
 *   onSelectionChange={(ids) => console.log('Selected:', ids)}
 * />
 * ```
 */
export function TreeView<T = unknown>({
  data,
  selectionMode = 'single',
  defaultExpandedIds = [],
  expandedIds: controlledExpandedIds,
  onExpandedChange,
  defaultSelectedIds = [],
  selectedIds: controlledSelectedIds,
  onSelectionChange,
  onNodeClick,
  onNodeDoubleClick,
  onNodeContextMenu,
  draggable = false,
  onDrop,
  onLoadChildren,
  showLines = false,
  indentSize = 24,
  filterQuery = '',
  filterFn,
  renderNode,
  emptyContent,
  className,
  'aria-label': ariaLabel = 'Tree view',
}: TreeViewProps<T>) {
  // Internal state
  const [internalExpandedIds, setInternalExpandedIds] = useState<Set<string>>(
    new Set(defaultExpandedIds)
  );
  const [internalSelectedIds, setInternalSelectedIds] = useState<Set<string>>(
    new Set(defaultSelectedIds)
  );
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [dragNodeId, setDragNodeId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const treeRef = useRef<HTMLDivElement>(null);

  // Use controlled or internal state
  const expandedIds = controlledExpandedIds
    ? new Set(controlledExpandedIds)
    : internalExpandedIds;
  const selectedIds = controlledSelectedIds
    ? new Set(controlledSelectedIds)
    : internalSelectedIds;

  // Filter data
  const filteredData = useMemo(
    () => filterNodes(data, filterQuery, filterFn),
    [data, filterQuery, filterFn]
  );

  // Get visible nodes for keyboard navigation
  const visibleNodes = useMemo(
    () => getVisibleNodes(filteredData, expandedIds),
    [filteredData, expandedIds]
  );

  // Toggle expansion
  const toggleExpand = useCallback((id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }

    if (!controlledExpandedIds) {
      setInternalExpandedIds(newExpanded);
    }
    onExpandedChange?.(Array.from(newExpanded));
  }, [expandedIds, controlledExpandedIds, onExpandedChange]);

  // Toggle selection
  const toggleSelect = useCallback((id: string, event?: React.MouseEvent) => {
    if (selectionMode === 'none') return;

    const node = findNode(filteredData, id);
    if (!node || node.disabled) return;

    let newSelected = new Set(selectedIds);

    if (selectionMode === 'single') {
      newSelected = new Set([id]);
    } else if (selectionMode === 'multiple') {
      if (event?.shiftKey && focusedId) {
        // Range select
        const focusIdx = visibleNodes.findIndex((n) => n.id === focusedId);
        const clickIdx = visibleNodes.findIndex((n) => n.id === id);
        const [start, end] = [Math.min(focusIdx, clickIdx), Math.max(focusIdx, clickIdx)];
        
        for (let i = start; i <= end; i++) {
          if (!visibleNodes[i].disabled) {
            newSelected.add(visibleNodes[i].id);
          }
        }
      } else if (event?.ctrlKey || event?.metaKey) {
        // Toggle individual
        if (newSelected.has(id)) {
          newSelected.delete(id);
        } else {
          newSelected.add(id);
        }
      } else {
        // Single select
        newSelected = new Set([id]);
      }
    } else if (selectionMode === 'checkbox') {
      if (newSelected.has(id)) {
        newSelected.delete(id);
      } else {
        newSelected.add(id);
      }
    }

    if (!controlledSelectedIds) {
      setInternalSelectedIds(newSelected);
    }

    const selectedNodes = Array.from(newSelected)
      .map((nid) => findNode(filteredData, nid))
      .filter((n): n is TreeNode<T> => n !== null);

    onSelectionChange?.(Array.from(newSelected), selectedNodes);
  }, [
    selectionMode,
    selectedIds,
    focusedId,
    visibleNodes,
    filteredData,
    controlledSelectedIds,
    onSelectionChange,
  ]);

  // Expand all
  const expandAll = useCallback(() => {
    const allIds = getAllNodeIds(filteredData);
    const newExpanded = new Set(allIds);

    if (!controlledExpandedIds) {
      setInternalExpandedIds(newExpanded);
    }
    onExpandedChange?.(Array.from(newExpanded));
  }, [filteredData, controlledExpandedIds, onExpandedChange]);

  // Collapse all
  const collapseAll = useCallback(() => {
    const newExpanded = new Set<string>();

    if (!controlledExpandedIds) {
      setInternalExpandedIds(newExpanded);
    }
    onExpandedChange?.([]);
  }, [controlledExpandedIds, onExpandedChange]);

  // Select all
  const selectAll = useCallback(() => {
    if (selectionMode === 'none' || selectionMode === 'single') return;

    const allIds = getAllNodeIds(filteredData).filter((id) => {
      const node = findNode(filteredData, id);
      return node && !node.disabled;
    });

    const newSelected = new Set(allIds);

    if (!controlledSelectedIds) {
      setInternalSelectedIds(newSelected);
    }

    const selectedNodes = allIds
      .map((id) => findNode(filteredData, id))
      .filter((n): n is TreeNode<T> => n !== null);

    onSelectionChange?.(allIds, selectedNodes);
  }, [selectionMode, filteredData, controlledSelectedIds, onSelectionChange]);

  // Clear selection
  const clearSelection = useCallback(() => {
    const newSelected = new Set<string>();

    if (!controlledSelectedIds) {
      setInternalSelectedIds(newSelected);
    }
    onSelectionChange?.([], []);
  }, [controlledSelectedIds, onSelectionChange]);

  // Get node helpers
  const getNode = useCallback((id: string) => findNode(filteredData, id), [filteredData]);
  const getParent = useCallback((id: string) => findParent(filteredData, id), [filteredData]);

  // Keyboard navigation
  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (!focusedId) {
      if (visibleNodes.length > 0) {
        setFocusedId(visibleNodes[0].id);
      }
      return;
    }

    const currentIndex = visibleNodes.findIndex((n) => n.id === focusedId);
    if (currentIndex === -1) return;

    const currentNode = visibleNodes[currentIndex];

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (currentIndex < visibleNodes.length - 1) {
          setFocusedId(visibleNodes[currentIndex + 1].id);
        }
        break;

      case 'ArrowUp':
        event.preventDefault();
        if (currentIndex > 0) {
          setFocusedId(visibleNodes[currentIndex - 1].id);
        }
        break;

      case 'ArrowRight':
        event.preventDefault();
        if (currentNode.children?.length) {
          if (!expandedIds.has(focusedId)) {
            toggleExpand(focusedId);
          } else {
            // Move to first child
            setFocusedId(currentNode.children[0].id);
          }
        }
        break;

      case 'ArrowLeft':
        event.preventDefault();
        if (expandedIds.has(focusedId) && currentNode.children?.length) {
          toggleExpand(focusedId);
        } else {
          // Move to parent
          const parent = getParent(focusedId);
          if (parent) {
            setFocusedId(parent.id);
          }
        }
        break;

      case 'Enter':
      case ' ':
        event.preventDefault();
        toggleSelect(focusedId);
        if (event.key === 'Enter') {
          onNodeClick?.(currentNode);
        }
        break;

      case 'Home':
        event.preventDefault();
        if (visibleNodes.length > 0) {
          setFocusedId(visibleNodes[0].id);
        }
        break;

      case 'End':
        event.preventDefault();
        if (visibleNodes.length > 0) {
          setFocusedId(visibleNodes[visibleNodes.length - 1].id);
        }
        break;

      case '*':
        event.preventDefault();
        expandAll();
        break;
    }
  }, [
    focusedId,
    visibleNodes,
    expandedIds,
    toggleExpand,
    toggleSelect,
    getParent,
    expandAll,
    onNodeClick,
  ]);

  // Context value
  const contextValue = useMemo<TreeContextValue<T>>(
    () => ({
      expandedIds,
      selectedIds,
      focusedId,
      selectionMode,
      toggleExpand,
      toggleSelect,
      setFocused: setFocusedId,
      expandAll,
      collapseAll,
      selectAll,
      clearSelection,
      getNode,
      getParent,
      isDraggable: draggable,
      dragNodeId,
      setDragNode: setDragNodeId,
      dropTargetId,
      setDropTarget: setDropTargetId,
      onDrop,
      onLoadChildren,
      showLines,
      indentSize,
    }),
    [
      expandedIds,
      selectedIds,
      focusedId,
      selectionMode,
      toggleExpand,
      toggleSelect,
      expandAll,
      collapseAll,
      selectAll,
      clearSelection,
      getNode,
      getParent,
      draggable,
      dragNodeId,
      dropTargetId,
      onDrop,
      onLoadChildren,
      showLines,
      indentSize,
    ]
  );

  if (filteredData.length === 0) {
    return (
      <div className={clsx('p-4 text-center text-gray-500', className)}>
        {emptyContent ?? 'No items'}
      </div>
    );
  }

  return (
    <TreeContext.Provider value={contextValue as TreeContextValue}>
      <div
        ref={treeRef}
        role="tree"
        aria-label={ariaLabel}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className={clsx('outline-none', className)}
      >
        {filteredData.map((node) => (
          <TreeNodeItem
            key={node.id}
            node={node}
            level={0}
            parentIds={[]}
            renderNode={renderNode}
            onClick={onNodeClick}
            onDoubleClick={onNodeDoubleClick}
            onContextMenu={onNodeContextMenu}
          />
        ))}
      </div>
    </TreeContext.Provider>
  );
}

// ============================================================================
// TREE NODE ITEM
// ============================================================================

function TreeNodeItem<T = unknown>({
  node,
  level,
  parentIds,
  renderNode,
  onClick,
  onDoubleClick,
  onContextMenu,
}: TreeNodeItemProps<T>) {
  const {
    expandedIds,
    selectedIds,
    focusedId,
    selectionMode,
    toggleExpand,
    toggleSelect,
    setFocused,
    isDraggable,
    dragNodeId,
    setDragNode,
    dropTargetId,
    setDropTarget,
    onDrop,
    onLoadChildren,
    showLines,
    indentSize,
  } = useTreeContext<T>();

  const [isLoading, setIsLoading] = useState(false);
  const [dropPosition, setDropPosition] = useState<'before' | 'after' | 'inside' | null>(null);

  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedIds.has(node.id);
  const isFocused = focusedId === node.id;
  const hasChildren = !node.isLeaf && (node.children?.length ?? 0) > 0;
  const canHaveChildren = !node.isLeaf;
  const isDragging = dragNodeId === node.id;
  const isDropTarget = dropTargetId === node.id;

  // Handle click on expand icon
  const handleExpandClick = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (onLoadChildren && !node.children?.length && !node.isLeaf) {
      setIsLoading(true);
      try {
        const children = await onLoadChildren(node);
        node.children = children;
      } catch (err) {
        console.error('Failed to load children:', err);
      } finally {
        setIsLoading(false);
      }
    }

    toggleExpand(node.id);
  };

  // Handle node click
  const handleClick = (e: React.MouseEvent) => {
    setFocused(node.id);
    toggleSelect(node.id, e);
    onClick?.(node);
  };

  // Handle double click
  const handleDoubleClick = () => {
    if (hasChildren || canHaveChildren) {
      toggleExpand(node.id);
    }
    onDoubleClick?.(node);
  };

  // Handle context menu
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setFocused(node.id);
    onContextMenu?.(node, e);
  };

  // Drag handlers
  const handleDragStart = (e: DragEvent) => {
    if (!isDraggable) return;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', node.id);
    setDragNode(node.id);
  };

  const handleDragEnd = () => {
    setDragNode(null);
    setDropTarget(null);
    setDropPosition(null);
  };

  const handleDragOver = (e: DragEvent) => {
    if (!isDraggable || !dragNodeId || dragNodeId === node.id) return;
    e.preventDefault();

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;

    let position: 'before' | 'after' | 'inside';
    if (y < height * 0.25) {
      position = 'before';
    } else if (y > height * 0.75) {
      position = 'after';
    } else {
      position = canHaveChildren ? 'inside' : 'after';
    }

    setDropTarget(node.id);
    setDropPosition(position);
  };

  const handleDragLeave = () => {
    setDropTarget(null);
    setDropPosition(null);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    if (!dragNodeId || !dropPosition) return;

    onDrop?.(dragNodeId, node.id, dropPosition);
    setDragNode(null);
    setDropTarget(null);
    setDropPosition(null);
  };

  // Render props for custom renderer
  const renderProps: TreeNodeRenderProps = {
    isExpanded,
    isSelected,
    isFocused,
    isDisabled: !!node.disabled,
    level,
    hasChildren,
  };

  // Default icon
  const defaultIcon = hasChildren
    ? isExpanded
      ? <FolderOpen className="w-4 h-4 text-amber-500" />
      : <Folder className="w-4 h-4 text-amber-500" />
    : <File className="w-4 h-4 text-gray-400" />;

  return (
    <div role="treeitem" aria-expanded={hasChildren ? isExpanded : undefined} aria-selected={isSelected}>
      {/* Node row */}
      <div
        className={clsx(
          'flex items-center gap-1 py-1 px-2 cursor-pointer rounded',
          'transition-colors duration-100',
          isSelected && 'bg-blue-100 dark:bg-blue-900/30',
          isFocused && 'ring-2 ring-blue-500 ring-inset',
          node.disabled && 'opacity-50 cursor-not-allowed',
          isDragging && 'opacity-50',
          isDropTarget && dropPosition === 'before' && 'border-t-2 border-blue-500',
          isDropTarget && dropPosition === 'after' && 'border-b-2 border-blue-500',
          isDropTarget && dropPosition === 'inside' && 'bg-blue-50 dark:bg-blue-900/50',
          !isSelected && !isFocused && 'hover:bg-gray-100 dark:hover:bg-gray-800'
        )}
        style={{ paddingLeft: level * indentSize + 8 }}
        onClick={node.disabled ? undefined : handleClick}
        onDoubleClick={node.disabled ? undefined : handleDoubleClick}
        onContextMenu={handleContextMenu}
        draggable={isDraggable && !node.disabled}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag handle */}
        {isDraggable && (
          <GripVertical className="w-3 h-3 text-gray-400 cursor-grab flex-shrink-0" />
        )}

        {/* Expand/collapse icon */}
        {(hasChildren || canHaveChildren) ? (
          <button
            type="button"
            onClick={handleExpandClick}
            className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded flex-shrink-0"
            tabIndex={-1}
          >
            {isLoading || node.isLoading ? (
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            ) : isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-500" />
            )}
          </button>
        ) : (
          <span className="w-5" />
        )}

        {/* Checkbox (for checkbox mode) */}
        {selectionMode === 'checkbox' && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleSelect(node.id);
            }}
            className={clsx(
              'w-4 h-4 border rounded flex-shrink-0 flex items-center justify-center',
              isSelected
                ? 'bg-blue-500 border-blue-500 text-white'
                : 'border-gray-300 dark:border-gray-600'
            )}
            tabIndex={-1}
          >
            {isSelected && <Check className="w-3 h-3" />}
          </button>
        )}

        {/* Custom render or default */}
        {renderNode ? (
          renderNode(node, renderProps)
        ) : (
          <>
            {/* Icon */}
            <span className="flex-shrink-0">{node.icon ?? defaultIcon}</span>

            {/* Label */}
            <span
              className={clsx(
                'text-sm truncate',
                isSelected ? 'text-blue-900 dark:text-blue-100' : 'text-gray-700 dark:text-gray-200'
              )}
            >
              {node.label}
            </span>
          </>
        )}
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div role="group">
          {node.children?.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              level={level + 1}
              parentIds={[...parentIds, node.id]}
              renderNode={renderNode}
              onClick={onClick}
              onDoubleClick={onDoubleClick}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// HOOK: useTreeView
// ============================================================================

/**
 * Hook for programmatic tree control
 */
export function useTreeView<T = unknown>() {
  const context = useTreeContext<T>();
  return {
    expandAll: context.expandAll,
    collapseAll: context.collapseAll,
    selectAll: context.selectAll,
    clearSelection: context.clearSelection,
    getNode: context.getNode,
    getParent: context.getParent,
    expandedIds: Array.from(context.expandedIds),
    selectedIds: Array.from(context.selectedIds),
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

// Types are exported inline at their definitions
