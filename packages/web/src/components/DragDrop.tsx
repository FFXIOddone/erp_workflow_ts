/**
 * Drag and Drop System
 * 
 * Comprehensive drag and drop utilities for React applications.
 * Includes sortable lists, file drop zones, and cross-list drag and drop.
 * 
 * @module DragDrop
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
  type DragEvent,
  type CSSProperties,
} from 'react';
import clsx from 'clsx';
import { GripVertical, Upload, X, File, Image, FileText, Package } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface DragItem<T = unknown> {
  /** Unique identifier */
  id: string;
  /** Item data */
  data: T;
  /** Source list ID */
  sourceListId?: string;
  /** Original index in source list */
  sourceIndex?: number;
  /** Type of drag item */
  type?: string;
}

export interface DropResult<T = unknown> {
  /** The dropped item */
  item: DragItem<T>;
  /** Target list ID */
  targetListId: string;
  /** Target index */
  targetIndex: number;
  /** Whether this is a copy operation */
  isCopy: boolean;
}

export interface DragDropOptions {
  /** Whether drag is enabled */
  enabled?: boolean;
  /** Accepted item types */
  acceptTypes?: string[];
  /** Whether to allow copy on Alt key */
  allowCopy?: boolean;
  /** Drag preview element */
  dragPreview?: ReactNode;
}

// ============================================================================
// Drag Drop Context
// ============================================================================

interface DragDropContextValue {
  /** Currently dragging item */
  dragItem: DragItem | null;
  /** Set the currently dragging item */
  setDragItem: (item: DragItem | null) => void;
  /** Currently hovered drop target */
  dropTarget: string | null;
  /** Set the currently hovered drop target */
  setDropTarget: (target: string | null) => void;
  /** Whether Alt key is held (copy mode) */
  isCopyMode: boolean;
}

const DragDropContext = createContext<DragDropContextValue | null>(null);

export interface DragDropProviderProps {
  children: ReactNode;
}

/**
 * Provider for drag and drop functionality
 */
export function DragDropProvider({ children }: DragDropProviderProps) {
  const [dragItem, setDragItem] = useState<DragItem | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [isCopyMode, setIsCopyMode] = useState(false);

  // Track Alt key for copy mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey) setIsCopyMode(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.altKey) setIsCopyMode(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const value = useMemo(
    () => ({
      dragItem,
      setDragItem,
      dropTarget,
      setDropTarget,
      isCopyMode,
    }),
    [dragItem, dropTarget, isCopyMode]
  );

  return (
    <DragDropContext.Provider value={value}>
      {children}
    </DragDropContext.Provider>
  );
}

/**
 * Hook to access drag drop context
 */
export function useDragDropContext(): DragDropContextValue {
  const context = useContext(DragDropContext);
  if (!context) {
    // Return a basic implementation if not in provider
    return {
      dragItem: null,
      setDragItem: () => {},
      dropTarget: null,
      setDropTarget: () => {},
      isCopyMode: false,
    };
  }
  return context;
}

// ============================================================================
// Drag Source Hook
// ============================================================================

export interface UseDragOptions<T> {
  /** Item data */
  item: DragItem<T>;
  /** Whether drag is enabled */
  enabled?: boolean;
  /** Callback when drag starts */
  onDragStart?: (item: DragItem<T>) => void;
  /** Callback when drag ends */
  onDragEnd?: (item: DragItem<T>) => void;
}

export interface UseDragResult {
  /** Props to spread on draggable element */
  dragProps: {
    draggable: boolean;
    onDragStart: (e: DragEvent) => void;
    onDragEnd: (e: DragEvent) => void;
  };
  /** Whether currently dragging this item */
  isDragging: boolean;
}

/**
 * Hook for making an element draggable
 */
export function useDrag<T>({
  item,
  enabled = true,
  onDragStart,
  onDragEnd,
}: UseDragOptions<T>): UseDragResult {
  const { dragItem, setDragItem } = useDragDropContext();
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = useCallback(
    (e: DragEvent) => {
      if (!enabled) {
        e.preventDefault();
        return;
      }

      // Set drag data
      e.dataTransfer.setData('application/json', JSON.stringify(item));
      e.dataTransfer.effectAllowed = 'copyMove';

      setDragItem(item);
      setIsDragging(true);
      onDragStart?.(item);
    },
    [enabled, item, setDragItem, onDragStart]
  );

  const handleDragEnd = useCallback(
    (e: DragEvent) => {
      setDragItem(null);
      setIsDragging(false);
      onDragEnd?.(item);
    },
    [setDragItem, onDragEnd, item]
  );

  return {
    dragProps: {
      draggable: enabled,
      onDragStart: handleDragStart,
      onDragEnd: handleDragEnd,
    },
    isDragging: isDragging || dragItem?.id === item.id,
  };
}

// ============================================================================
// Drop Target Hook
// ============================================================================

export interface UseDropOptions<T> {
  /** Unique list ID */
  listId: string;
  /** Accepted item types */
  accept?: string[];
  /** Callback when item is dropped */
  onDrop: (result: DropResult<T>) => void;
  /** Whether drop is enabled */
  enabled?: boolean;
  /** Callback when drag enters */
  onDragEnter?: () => void;
  /** Callback when drag leaves */
  onDragLeave?: () => void;
}

export interface UseDropResult {
  /** Props to spread on drop target element */
  dropProps: {
    onDragOver: (e: DragEvent) => void;
    onDragEnter: (e: DragEvent) => void;
    onDragLeave: (e: DragEvent) => void;
    onDrop: (e: DragEvent) => void;
  };
  /** Whether currently over this drop target */
  isOver: boolean;
  /** Whether a valid item is being dragged */
  canDrop: boolean;
}

/**
 * Hook for making an element a drop target
 */
export function useDrop<T>({
  listId,
  accept,
  onDrop,
  enabled = true,
  onDragEnter,
  onDragLeave,
}: UseDropOptions<T>): UseDropResult {
  const { dragItem, dropTarget, setDropTarget, isCopyMode } = useDragDropContext();
  const [isOver, setIsOver] = useState(false);
  const enterCountRef = useRef(0);

  const canDrop = useMemo(() => {
    if (!enabled || !dragItem) return false;
    if (!accept || accept.length === 0) return true;
    return accept.includes(dragItem.type || 'default');
  }, [enabled, dragItem, accept]);

  const handleDragOver = useCallback(
    (e: DragEvent) => {
      if (!enabled || !canDrop) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = isCopyMode ? 'copy' : 'move';
    },
    [enabled, canDrop, isCopyMode]
  );

  const handleDragEnter = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      enterCountRef.current++;
      
      if (enterCountRef.current === 1) {
        setIsOver(true);
        setDropTarget(listId);
        onDragEnter?.();
      }
    },
    [listId, setDropTarget, onDragEnter]
  );

  const handleDragLeave = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      enterCountRef.current--;
      
      if (enterCountRef.current === 0) {
        setIsOver(false);
        setDropTarget(null);
        onDragLeave?.();
      }
    },
    [setDropTarget, onDragLeave]
  );

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      enterCountRef.current = 0;
      setIsOver(false);
      setDropTarget(null);

      if (!enabled || !canDrop) return;

      try {
        const data = e.dataTransfer.getData('application/json');
        const item = JSON.parse(data) as DragItem<T>;

        onDrop({
          item,
          targetListId: listId,
          targetIndex: 0, // Will be overridden by sortable list
          isCopy: isCopyMode,
        });
      } catch {
        // Invalid data
      }
    },
    [enabled, canDrop, listId, isCopyMode, setDropTarget, onDrop]
  );

  return {
    dropProps: {
      onDragOver: handleDragOver,
      onDragEnter: handleDragEnter,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop,
    },
    isOver: isOver && dropTarget === listId,
    canDrop,
  };
}

// ============================================================================
// Sortable List Hook
// ============================================================================

export interface UseSortableOptions<T> {
  /** List ID */
  listId: string;
  /** List items */
  items: T[];
  /** Get item ID */
  getItemId: (item: T) => string;
  /** Callback when order changes */
  onReorder: (items: T[]) => void;
  /** Whether sorting is enabled */
  enabled?: boolean;
  /** Accepted item types from other lists */
  accept?: string[];
  /** Callback when item is added from another list */
  onItemAdded?: (item: T, index: number) => void;
  /** Callback when item is removed */
  onItemRemoved?: (item: T, index: number) => void;
}

export interface SortableItemData<T> {
  /** Item data */
  item: T;
  /** Item index */
  index: number;
  /** Drag props */
  dragProps: UseDragResult['dragProps'];
  /** Whether this item is being dragged */
  isDragging: boolean;
  /** Handle element ref */
  handleRef: React.RefObject<HTMLElement>;
}

export interface UseSortableResult<T> {
  /** Sortable items with drag props */
  items: SortableItemData<T>[];
  /** Drop props for the container */
  dropProps: UseDropResult['dropProps'];
  /** Whether an item is being dragged over */
  isOver: boolean;
  /** Currently dragging item index */
  draggingIndex: number | null;
  /** Placeholder index for visual feedback */
  placeholderIndex: number | null;
}

/**
 * Hook for sortable list functionality
 */
export function useSortable<T>({
  listId,
  items: originalItems,
  getItemId,
  onReorder,
  enabled = true,
  accept,
  onItemAdded,
  onItemRemoved,
}: UseSortableOptions<T>): UseSortableResult<T> {
  const { dragItem, isCopyMode } = useDragDropContext();
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [placeholderIndex, setPlaceholderIndex] = useState<number | null>(null);
  const itemRefs = useRef<Map<string, React.RefObject<HTMLElement>>>(new Map());

  // Get or create ref for item
  const getItemRef = useCallback((id: string) => {
    if (!itemRefs.current.has(id)) {
      itemRefs.current.set(id, React.createRef());
    }
    return itemRefs.current.get(id)!;
  }, []);

  const handleDrop = useCallback(
    (result: DropResult<unknown>) => {
      const { item, targetIndex } = result;
      const fromIndex = originalItems.findIndex((i) => getItemId(i) === item.id);

      if (fromIndex !== -1) {
        // Reordering within same list
        const newItems = [...originalItems];
        const [removed] = newItems.splice(fromIndex, 1);
        const adjustedIndex = targetIndex > fromIndex ? targetIndex - 1 : targetIndex;
        newItems.splice(adjustedIndex, 0, removed!);
        onReorder(newItems);
      } else if (onItemAdded) {
        // Adding from another list
        onItemAdded(item.data as T, targetIndex);
      }

      setDraggingIndex(null);
      setPlaceholderIndex(null);
    },
    [originalItems, getItemId, onReorder, onItemAdded]
  );

  const { dropProps, isOver } = useDrop<T>({
    listId,
    accept,
    onDrop: handleDrop,
    enabled,
  });

  // Calculate placeholder position on drag over items
  const handleItemDragOver = useCallback(
    (e: DragEvent, index: number) => {
      if (!enabled || !dragItem) return;

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const newIndex = e.clientY < midY ? index : index + 1;

      setPlaceholderIndex(newIndex);
    },
    [enabled, dragItem]
  );

  const sortableItems: SortableItemData<T>[] = originalItems.map((item, index) => {
    const id = getItemId(item);
    const handleRef = getItemRef(id);

    const dragItem: DragItem<T> = {
      id,
      data: item,
      sourceListId: listId,
      sourceIndex: index,
    };

    return {
      item,
      index,
      dragProps: {
        draggable: enabled,
        onDragStart: (e: DragEvent) => {
          e.dataTransfer.setData('application/json', JSON.stringify(dragItem));
          e.dataTransfer.effectAllowed = 'copyMove';
          setDraggingIndex(index);
        },
        onDragEnd: () => {
          setDraggingIndex(null);
          setPlaceholderIndex(null);
        },
      },
      isDragging: draggingIndex === index,
      handleRef,
    };
  });

  return {
    items: sortableItems,
    dropProps: {
      ...dropProps,
      onDragOver: (e) => {
        dropProps.onDragOver(e);
        // Additional logic for calculating placeholder
      },
    },
    isOver,
    draggingIndex,
    placeholderIndex,
  };
}

// ============================================================================
// UI Components
// ============================================================================

export interface DragHandleProps {
  /** Additional class names */
  className?: string;
  /** Size of the handle */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Drag handle icon component
 */
export function DragHandle({ className, size = 'md' }: DragHandleProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  return (
    <GripVertical
      className={clsx(
        'text-gray-400 cursor-grab active:cursor-grabbing',
        sizeClasses[size],
        className
      )}
    />
  );
}

export interface SortableItemProps {
  /** Children to render */
  children: ReactNode;
  /** Drag props from useSortable */
  dragProps: UseDragResult['dragProps'];
  /** Whether this item is being dragged */
  isDragging?: boolean;
  /** Whether to show drag handle */
  showHandle?: boolean;
  /** Additional class names */
  className?: string;
}

/**
 * Wrapper component for sortable list items
 */
export function SortableItem({
  children,
  dragProps,
  isDragging,
  showHandle = true,
  className,
}: SortableItemProps) {
  return (
    <div
      {...dragProps}
      className={clsx(
        'flex items-center gap-2 p-3 bg-white border border-gray-200 rounded-lg transition-all',
        isDragging && 'opacity-50 shadow-lg border-primary-300',
        !isDragging && 'hover:border-gray-300',
        className
      )}
    >
      {showHandle && <DragHandle />}
      <div className="flex-1">{children}</div>
    </div>
  );
}

export interface SortableListProps<T> {
  /** List ID */
  listId: string;
  /** List items */
  items: T[];
  /** Get item ID */
  getItemId: (item: T) => string;
  /** Render item content */
  renderItem: (item: T, index: number, isDragging: boolean) => ReactNode;
  /** Callback when order changes */
  onReorder: (items: T[]) => void;
  /** Whether sorting is enabled */
  enabled?: boolean;
  /** Additional class names */
  className?: string;
  /** Class names for item wrapper */
  itemClassName?: string;
  /** Whether to show drag handles */
  showHandles?: boolean;
  /** Empty state content */
  emptyState?: ReactNode;
  /** Gap between items */
  gap?: 'sm' | 'md' | 'lg';
}

/**
 * Complete sortable list component
 */
export function SortableList<T>({
  listId,
  items: originalItems,
  getItemId,
  renderItem,
  onReorder,
  enabled = true,
  className,
  itemClassName,
  showHandles = true,
  emptyState,
  gap = 'md',
}: SortableListProps<T>) {
  const { items, dropProps, isOver, draggingIndex, placeholderIndex } = useSortable({
    listId,
    items: originalItems,
    getItemId,
    onReorder,
    enabled,
  });

  const gapClasses = {
    sm: 'space-y-1',
    md: 'space-y-2',
    lg: 'space-y-3',
  };

  if (originalItems.length === 0) {
    return (
      <div
        {...dropProps}
        className={clsx(
          'p-6 border-2 border-dashed rounded-lg transition-colors',
          isOver ? 'border-primary-400 bg-primary-50' : 'border-gray-300',
          className
        )}
      >
        {emptyState || (
          <div className="text-center text-gray-500">
            <p>No items</p>
            <p className="text-sm">Drag items here</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      {...dropProps}
      className={clsx(
        'transition-colors rounded-lg',
        isOver && 'bg-primary-50',
        gapClasses[gap],
        className
      )}
    >
      {items.map(({ item, index, dragProps, isDragging }, idx) => (
        <React.Fragment key={getItemId(item)}>
          {placeholderIndex === idx && (
            <div className="h-12 border-2 border-dashed border-primary-400 rounded-lg bg-primary-50" />
          )}
          <SortableItem
            dragProps={dragProps}
            isDragging={isDragging}
            showHandle={showHandles}
            className={itemClassName}
          >
            {renderItem(item, index, isDragging)}
          </SortableItem>
        </React.Fragment>
      ))}
      {placeholderIndex === items.length && (
        <div className="h-12 border-2 border-dashed border-primary-400 rounded-lg bg-primary-50" />
      )}
    </div>
  );
}

// ============================================================================
// File Drop Zone
// ============================================================================

export interface FileDropZoneProps {
  /** Callback when files are dropped */
  onDrop: (files: File[]) => void;
  /** Accepted file types (e.g., ['image/*', '.pdf']) */
  accept?: string[];
  /** Maximum file size in bytes */
  maxSize?: number;
  /** Maximum number of files */
  maxFiles?: number;
  /** Whether multiple files are allowed */
  multiple?: boolean;
  /** Whether drop zone is disabled */
  disabled?: boolean;
  /** Children or render function */
  children?: ReactNode | ((props: { isOver: boolean; isDragActive: boolean }) => ReactNode);
  /** Additional class names */
  className?: string;
  /** Callback on error */
  onError?: (error: string) => void;
}

/**
 * File drop zone component
 */
export function FileDropZone({
  onDrop,
  accept,
  maxSize,
  maxFiles = Infinity,
  multiple = true,
  disabled = false,
  children,
  className,
  onError,
}: FileDropZoneProps) {
  const [isOver, setIsOver] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const enterCountRef = useRef(0);

  const validateFile = useCallback(
    (file: File): string | null => {
      if (accept && accept.length > 0) {
        const isAccepted = accept.some((type) => {
          if (type.startsWith('.')) {
            return file.name.toLowerCase().endsWith(type.toLowerCase());
          }
          if (type.endsWith('/*')) {
            return file.type.startsWith(type.slice(0, -1));
          }
          return file.type === type;
        });
        if (!isAccepted) {
          return `File type "${file.type}" is not accepted`;
        }
      }

      if (maxSize && file.size > maxSize) {
        return `File "${file.name}" exceeds maximum size`;
      }

      return null;
    },
    [accept, maxSize]
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const fileArray = Array.from(files);
      const validFiles: File[] = [];
      const errors: string[] = [];

      for (const file of fileArray.slice(0, maxFiles)) {
        const error = validateFile(file);
        if (error) {
          errors.push(error);
        } else {
          validFiles.push(file);
        }
      }

      if (fileArray.length > maxFiles) {
        errors.push(`Maximum ${maxFiles} files allowed`);
      }

      if (errors.length > 0) {
        onError?.(errors.join('. '));
      }

      if (validFiles.length > 0) {
        onDrop(validFiles);
      }
    },
    [maxFiles, validateFile, onDrop, onError]
  );

  const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    enterCountRef.current++;
    if (enterCountRef.current === 1) {
      setIsOver(true);
      setIsDragActive(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    enterCountRef.current--;
    if (enterCountRef.current === 0) {
      setIsOver(false);
      setIsDragActive(false);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      enterCountRef.current = 0;
      setIsOver(false);
      setIsDragActive(false);

      if (disabled) return;
      handleFiles(e.dataTransfer.files);
    },
    [disabled, handleFiles]
  );

  const handleClick = useCallback(() => {
    if (!disabled) {
      inputRef.current?.click();
    }
  }, [disabled]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files);
      e.target.value = ''; // Reset input
    },
    [handleFiles]
  );

  const acceptString = accept?.join(',');

  const content = typeof children === 'function'
    ? children({ isOver, isDragActive })
    : children;

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleClick}
      className={clsx(
        'relative border-2 border-dashed rounded-lg p-6 transition-all cursor-pointer',
        isOver && !disabled
          ? 'border-primary-400 bg-primary-50'
          : 'border-gray-300 hover:border-gray-400',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={acceptString}
        multiple={multiple}
        onChange={handleInputChange}
        className="hidden"
        disabled={disabled}
      />

      {content || (
        <div className="text-center">
          <Upload className="h-10 w-10 mx-auto mb-3 text-gray-400" />
          <p className="text-gray-600 font-medium">
            {isOver ? 'Drop files here' : 'Drag & drop files here'}
          </p>
          <p className="text-gray-500 text-sm mt-1">or click to browse</p>
          {accept && (
            <p className="text-gray-400 text-xs mt-2">
              Accepted: {accept.join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// File Preview Component
// ============================================================================

export interface FilePreviewProps {
  /** File to preview */
  file: File;
  /** Callback to remove file */
  onRemove?: () => void;
  /** Whether to show remove button */
  showRemove?: boolean;
  /** Additional class names */
  className?: string;
}

/**
 * File preview component
 */
export function FilePreview({
  file,
  onRemove,
  showRemove = true,
  className,
}: FilePreviewProps) {
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file]);

  const getFileIcon = () => {
    if (file.type.startsWith('image/')) return Image;
    if (file.type.includes('pdf')) return FileText;
    if (file.type.includes('zip') || file.type.includes('compressed')) return Package;
    return File;
  };

  const Icon = getFileIcon();
  const sizeStr = file.size < 1024
    ? `${file.size} B`
    : file.size < 1024 * 1024
    ? `${(file.size / 1024).toFixed(1)} KB`
    : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;

  return (
    <div
      className={clsx(
        'flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200',
        className
      )}
    >
      {preview ? (
        <img
          src={preview}
          alt={file.name}
          className="h-12 w-12 object-cover rounded"
        />
      ) : (
        <div className="h-12 w-12 bg-gray-200 rounded flex items-center justify-center">
          <Icon className="h-6 w-6 text-gray-500" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
        <p className="text-xs text-gray-500">{sizeStr}</p>
      </div>

      {showRemove && onRemove && (
        <button
          onClick={onRemove}
          className="p-1 text-gray-400 hover:text-red-500 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Multi-file Upload Component
// ============================================================================

export interface FileUploadAreaProps {
  /** Currently selected files */
  files: File[];
  /** Callback when files change */
  onChange: (files: File[]) => void;
  /** Accepted file types */
  accept?: string[];
  /** Maximum file size */
  maxSize?: number;
  /** Maximum number of files */
  maxFiles?: number;
  /** Whether multiple files are allowed */
  multiple?: boolean;
  /** Whether upload is disabled */
  disabled?: boolean;
  /** Additional class names */
  className?: string;
  /** Callback on error */
  onError?: (error: string) => void;
}

/**
 * Complete file upload area with previews
 */
export function FileUploadArea({
  files,
  onChange,
  accept,
  maxSize,
  maxFiles = 10,
  multiple = true,
  disabled = false,
  className,
  onError,
}: FileUploadAreaProps) {
  const handleDrop = useCallback(
    (newFiles: File[]) => {
      const combined = [...files, ...newFiles].slice(0, maxFiles);
      onChange(combined);
    },
    [files, maxFiles, onChange]
  );

  const handleRemove = useCallback(
    (index: number) => {
      const newFiles = files.filter((_, i) => i !== index);
      onChange(newFiles);
    },
    [files, onChange]
  );

  return (
    <div className={clsx('space-y-4', className)}>
      <FileDropZone
        onDrop={handleDrop}
        accept={accept}
        maxSize={maxSize}
        maxFiles={maxFiles - files.length}
        multiple={multiple}
        disabled={disabled || files.length >= maxFiles}
        onError={onError}
      />

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, index) => (
            <FilePreview
              key={`${file.name}-${index}`}
              file={file}
              onRemove={() => handleRemove(index)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Reorder an array by moving an item from one index to another
 */
export function reorderArray<T>(array: T[], fromIndex: number, toIndex: number): T[] {
  const result = [...array];
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed!);
  return result;
}

/**
 * Move an item from one array to another
 */
export function moveItemBetweenArrays<T>(
  source: T[],
  destination: T[],
  sourceIndex: number,
  destinationIndex: number
): { source: T[]; destination: T[] } {
  const newSource = [...source];
  const newDestination = [...destination];

  const [removed] = newSource.splice(sourceIndex, 1);
  newDestination.splice(destinationIndex, 0, removed!);

  return {
    source: newSource,
    destination: newDestination,
  };
}

/**
 * Format file size to human readable string
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
