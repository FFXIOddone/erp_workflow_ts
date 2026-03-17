/**
 * Kanban.tsx - CRITICAL-35
 * 
 * Kanban board component for the ERP application.
 * Drag-and-drop columns and cards for workflow management.
 * 
 * Features:
 * - 35.1: Kanban board with columns
 * - 35.2: Draggable cards
 * - 35.3: Column management
 * - 35.4: Card detail modal
 * - 35.5: WIP limits and swimlanes
 * 
 * @module Kanban
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  type ReactNode,
  type DragEvent,
} from 'react';
import { clsx } from 'clsx';
import {
  Plus,
  MoreVertical,
  X,
  GripVertical,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Clock,
  User,
  Tag,
  Calendar,
  CheckSquare,
  MessageSquare,
  Paperclip,
} from 'lucide-react';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/** Kanban card */
export interface KanbanCard {
  /** Unique id */
  id: string;
  /** Card title */
  title: string;
  /** Description */
  description?: string;
  /** Column id */
  columnId: string;
  /** Swimlane id (optional) */
  swimlaneId?: string;
  /** Position within column */
  position: number;
  /** Priority */
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  /** Labels/tags */
  labels?: { id: string; name: string; color: string }[];
  /** Assignee */
  assignee?: { id: string; name: string; avatar?: string };
  /** Due date */
  dueDate?: Date | string;
  /** Checklist progress */
  checklist?: { completed: number; total: number };
  /** Comment count */
  commentCount?: number;
  /** Attachment count */
  attachmentCount?: number;
  /** Cover image */
  coverImage?: string;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/** Kanban column */
export interface KanbanColumn {
  /** Unique id */
  id: string;
  /** Column title */
  title: string;
  /** Column color */
  color?: string;
  /** Position */
  position: number;
  /** WIP limit */
  wipLimit?: number;
  /** Is collapsed */
  collapsed?: boolean;
}

/** Kanban swimlane */
export interface KanbanSwimlane {
  /** Unique id */
  id: string;
  /** Swimlane title */
  title: string;
  /** Position */
  position: number;
  /** Is collapsed */
  collapsed?: boolean;
}

/** Kanban context */
export interface KanbanContextValue {
  /** Columns */
  columns: KanbanColumn[];
  /** Cards */
  cards: KanbanCard[];
  /** Swimlanes */
  swimlanes: KanbanSwimlane[];
  /** Dragging card */
  draggingCard: KanbanCard | null;
  /** Dragging column */
  draggingColumn: KanbanColumn | null;
  /** Selected card */
  selectedCard: KanbanCard | null;
  /** Move card */
  moveCard: (cardId: string, toColumnId: string, toPosition: number, swimlaneId?: string) => void;
  /** Move column */
  moveColumn: (columnId: string, toPosition: number) => void;
  /** Add card */
  addCard: (columnId: string, card: Partial<KanbanCard>) => void;
  /** Update card */
  updateCard: (cardId: string, updates: Partial<KanbanCard>) => void;
  /** Delete card */
  deleteCard: (cardId: string) => void;
  /** Add column */
  addColumn: (column: Partial<KanbanColumn>) => void;
  /** Update column */
  updateColumn: (columnId: string, updates: Partial<KanbanColumn>) => void;
  /** Delete column */
  deleteColumn: (columnId: string) => void;
  /** Set dragging card */
  setDraggingCard: (card: KanbanCard | null) => void;
  /** Set dragging column */
  setDraggingColumn: (column: KanbanColumn | null) => void;
  /** Select card */
  selectCard: (card: KanbanCard | null) => void;
  /** Toggle swimlane */
  toggleSwimlane: (swimlaneId: string) => void;
  /** Toggle column collapse */
  toggleColumnCollapse: (columnId: string) => void;
  /** Get cards for column */
  getCardsForColumn: (columnId: string, swimlaneId?: string) => KanbanCard[];
}

/** Kanban board props */
export interface KanbanBoardProps {
  /** Initial columns */
  columns: KanbanColumn[];
  /** Initial cards */
  cards: KanbanCard[];
  /** Swimlanes (optional) */
  swimlanes?: KanbanSwimlane[];
  /** On card move */
  onCardMove?: (cardId: string, toColumnId: string, toPosition: number, swimlaneId?: string) => void;
  /** On column move */
  onColumnMove?: (columnId: string, toPosition: number) => void;
  /** On card add */
  onCardAdd?: (columnId: string, card: Partial<KanbanCard>) => void;
  /** On card update */
  onCardUpdate?: (cardId: string, updates: Partial<KanbanCard>) => void;
  /** On card delete */
  onCardDelete?: (cardId: string) => void;
  /** On card click */
  onCardClick?: (card: KanbanCard) => void;
  /** On column add */
  onColumnAdd?: (column: Partial<KanbanColumn>) => void;
  /** On column update */
  onColumnUpdate?: (columnId: string, updates: Partial<KanbanColumn>) => void;
  /** On column delete */
  onColumnDelete?: (columnId: string) => void;
  /** Custom card renderer */
  renderCard?: (card: KanbanCard) => ReactNode;
  /** Custom column header renderer */
  renderColumnHeader?: (column: KanbanColumn, cardCount: number) => ReactNode;
  /** Allow add column */
  allowAddColumn?: boolean;
  /** Allow add card */
  allowAddCard?: boolean;
  /** Allow drag cards */
  allowDragCards?: boolean;
  /** Allow drag columns */
  allowDragColumns?: boolean;
  /** Column width */
  columnWidth?: number;
  /** Class name */
  className?: string;
}

// ============================================================================
// CONTEXT
// ============================================================================

const KanbanContext = createContext<KanbanContextValue | null>(null);

function useKanbanContext(): KanbanContextValue {
  const context = useContext(KanbanContext);
  if (!context) {
    throw new Error('useKanbanContext must be used within a KanbanBoard');
  }
  return context;
}

/** Hook to access kanban context */
export function useKanban(): KanbanContextValue {
  return useKanbanContext();
}

// ============================================================================
// UTILITIES
// ============================================================================

/** Priority colors */
const PRIORITY_COLORS = {
  low: 'bg-gray-400',
  medium: 'bg-blue-500',
  high: 'bg-orange-500',
  urgent: 'bg-red-500',
};

/** Format due date */
function formatDueDate(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days}d`;
}

/** Check if due date is past */
function isDuePast(date: Date | string): boolean {
  return new Date(date) < new Date();
}

// ============================================================================
// 35.1-35.5: KANBAN BOARD
// ============================================================================

/**
 * Kanban board with draggable columns and cards
 * 
 * @example
 * ```tsx
 * const columns = [
 *   { id: '1', title: 'To Do', position: 0 },
 *   { id: '2', title: 'In Progress', position: 1 },
 *   { id: '3', title: 'Done', position: 2 },
 * ];
 * 
 * const cards = [
 *   { id: '1', title: 'Task 1', columnId: '1', position: 0 },
 * ];
 * 
 * <KanbanBoard
 *   columns={columns}
 *   cards={cards}
 *   onCardMove={handleCardMove}
 * />
 * ```
 */
export function KanbanBoard({
  columns: initialColumns,
  cards: initialCards,
  swimlanes: initialSwimlanes = [],
  onCardMove,
  onColumnMove,
  onCardAdd,
  onCardUpdate,
  onCardDelete,
  onCardClick,
  onColumnAdd,
  onColumnUpdate,
  onColumnDelete,
  renderCard,
  renderColumnHeader,
  allowAddColumn = true,
  allowAddCard = true,
  allowDragCards = true,
  allowDragColumns = true,
  columnWidth = 280,
  className,
}: KanbanBoardProps) {
  // State
  const [columns, setColumns] = useState(initialColumns);
  const [cards, setCards] = useState(initialCards);
  const [swimlanes, setSwimlanes] = useState(initialSwimlanes);
  const [draggingCard, setDraggingCard] = useState<KanbanCard | null>(null);
  const [draggingColumn, setDraggingColumn] = useState<KanbanColumn | null>(null);
  const [selectedCard, setSelectedCard] = useState<KanbanCard | null>(null);

  // Update state when props change
  useEffect(() => setColumns(initialColumns), [initialColumns]);
  useEffect(() => setCards(initialCards), [initialCards]);
  useEffect(() => setSwimlanes(initialSwimlanes), [initialSwimlanes]);

  // Get cards for column
  const getCardsForColumn = useCallback((columnId: string, swimlaneId?: string) => {
    return cards
      .filter((c) => c.columnId === columnId && (!swimlaneId || c.swimlaneId === swimlaneId))
      .sort((a, b) => a.position - b.position);
  }, [cards]);

  // Move card
  const moveCard = useCallback((
    cardId: string,
    toColumnId: string,
    toPosition: number,
    swimlaneId?: string
  ) => {
    setCards((prev) => {
      const card = prev.find((c) => c.id === cardId);
      if (!card) return prev;

      const updated = prev.map((c) => {
        if (c.id === cardId) {
          return { ...c, columnId: toColumnId, position: toPosition, swimlaneId };
        }
        // Adjust positions in target column
        if (c.columnId === toColumnId && c.id !== cardId) {
          if (c.position >= toPosition) {
            return { ...c, position: c.position + 1 };
          }
        }
        return c;
      });

      return updated;
    });

    onCardMove?.(cardId, toColumnId, toPosition, swimlaneId);
  }, [onCardMove]);

  // Move column
  const moveColumn = useCallback((columnId: string, toPosition: number) => {
    setColumns((prev) => {
      const column = prev.find((c) => c.id === columnId);
      if (!column) return prev;

      const oldPosition = column.position;

      return prev.map((c) => {
        if (c.id === columnId) {
          return { ...c, position: toPosition };
        }
        if (oldPosition < toPosition) {
          if (c.position > oldPosition && c.position <= toPosition) {
            return { ...c, position: c.position - 1 };
          }
        } else {
          if (c.position >= toPosition && c.position < oldPosition) {
            return { ...c, position: c.position + 1 };
          }
        }
        return c;
      });
    });

    onColumnMove?.(columnId, toPosition);
  }, [onColumnMove]);

  // Add card
  const addCard = useCallback((columnId: string, cardData: Partial<KanbanCard>) => {
    const cardsInColumn = cards.filter((c) => c.columnId === columnId);
    const newCard: KanbanCard = {
      id: `card-${Date.now()}`,
      title: cardData.title || 'New Card',
      columnId,
      position: cardsInColumn.length,
      ...cardData,
    };

    setCards((prev) => [...prev, newCard]);
    onCardAdd?.(columnId, newCard);
  }, [cards, onCardAdd]);

  // Update card
  const updateCard = useCallback((cardId: string, updates: Partial<KanbanCard>) => {
    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, ...updates } : c))
    );
    onCardUpdate?.(cardId, updates);
  }, [onCardUpdate]);

  // Delete card
  const deleteCard = useCallback((cardId: string) => {
    setCards((prev) => prev.filter((c) => c.id !== cardId));
    onCardDelete?.(cardId);
  }, [onCardDelete]);

  // Add column
  const addColumn = useCallback((columnData: Partial<KanbanColumn>) => {
    const newColumn: KanbanColumn = {
      id: `column-${Date.now()}`,
      title: columnData.title || 'New Column',
      position: columns.length,
      ...columnData,
    };

    setColumns((prev) => [...prev, newColumn]);
    onColumnAdd?.(newColumn);
  }, [columns.length, onColumnAdd]);

  // Update column
  const updateColumn = useCallback((columnId: string, updates: Partial<KanbanColumn>) => {
    setColumns((prev) =>
      prev.map((c) => (c.id === columnId ? { ...c, ...updates } : c))
    );
    onColumnUpdate?.(columnId, updates);
  }, [onColumnUpdate]);

  // Delete column
  const deleteColumn = useCallback((columnId: string) => {
    setColumns((prev) => prev.filter((c) => c.id !== columnId));
    // Move cards to first column or delete them
    setCards((prev) => prev.filter((c) => c.columnId !== columnId));
    onColumnDelete?.(columnId);
  }, [onColumnDelete]);

  // Toggle swimlane
  const toggleSwimlane = useCallback((swimlaneId: string) => {
    setSwimlanes((prev) =>
      prev.map((s) => (s.id === swimlaneId ? { ...s, collapsed: !s.collapsed } : s))
    );
  }, []);

  // Toggle column collapse
  const toggleColumnCollapse = useCallback((columnId: string) => {
    setColumns((prev) =>
      prev.map((c) => (c.id === columnId ? { ...c, collapsed: !c.collapsed } : c))
    );
  }, []);

  // Select card
  const selectCard = useCallback((card: KanbanCard | null) => {
    setSelectedCard(card);
    if (card) onCardClick?.(card);
  }, [onCardClick]);

  // Context value
  const contextValue = useMemo<KanbanContextValue>(() => ({
    columns,
    cards,
    swimlanes,
    draggingCard,
    draggingColumn,
    selectedCard,
    moveCard,
    moveColumn,
    addCard,
    updateCard,
    deleteCard,
    addColumn,
    updateColumn,
    deleteColumn,
    setDraggingCard,
    setDraggingColumn,
    selectCard,
    toggleSwimlane,
    toggleColumnCollapse,
    getCardsForColumn,
  }), [
    columns,
    cards,
    swimlanes,
    draggingCard,
    draggingColumn,
    selectedCard,
    moveCard,
    moveColumn,
    addCard,
    updateCard,
    deleteCard,
    addColumn,
    updateColumn,
    deleteColumn,
    selectCard,
    toggleSwimlane,
    toggleColumnCollapse,
    getCardsForColumn,
  ]);

  // Sorted columns
  const sortedColumns = useMemo(() => 
    [...columns].sort((a, b) => a.position - b.position),
    [columns]
  );

  return (
    <KanbanContext.Provider value={contextValue}>
      <div className={clsx('flex gap-4 overflow-x-auto p-4 min-h-[500px]', className)}>
        {/* Columns */}
        {sortedColumns.map((column) => (
          <KanbanColumnComponent
            key={column.id}
            column={column}
            width={columnWidth}
            allowDragCards={allowDragCards}
            allowDragColumns={allowDragColumns}
            allowAddCard={allowAddCard}
            renderCard={renderCard}
            renderColumnHeader={renderColumnHeader}
          />
        ))}

        {/* Add column button */}
        {allowAddColumn && (
          <button
            type="button"
            onClick={() => addColumn({ title: 'New Column' })}
            className={clsx(
              'flex-shrink-0 flex items-center justify-center gap-2',
              'h-12 px-4 rounded-lg',
              'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700',
              'text-gray-600 dark:text-gray-300 font-medium',
              'transition-colors'
            )}
            style={{ width: columnWidth }}
          >
            <Plus className="w-5 h-5" />
            Add Column
          </button>
        )}
      </div>

      {/* Card detail modal */}
      {selectedCard && (
        <KanbanCardModal
          card={selectedCard}
          onClose={() => selectCard(null)}
        />
      )}
    </KanbanContext.Provider>
  );
}

// ============================================================================
// KANBAN COLUMN COMPONENT
// ============================================================================

interface KanbanColumnProps {
  column: KanbanColumn;
  width: number;
  allowDragCards: boolean;
  allowDragColumns: boolean;
  allowAddCard: boolean;
  renderCard?: (card: KanbanCard) => ReactNode;
  renderColumnHeader?: (column: KanbanColumn, cardCount: number) => ReactNode;
}

function KanbanColumnComponent({
  column,
  width,
  allowDragCards,
  allowDragColumns,
  allowAddCard,
  renderCard,
  renderColumnHeader,
}: KanbanColumnProps) {
  const {
    getCardsForColumn,
    setDraggingCard,
    setDraggingColumn,
    draggingCard,
    draggingColumn,
    moveCard,
    moveColumn,
    addCard,
    updateColumn,
    deleteColumn,
  } = useKanbanContext();

  const [isAddingCard, setIsAddingCard] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(column.title);
  const [showMenu, setShowMenu] = useState(false);
  const [dropPosition, setDropPosition] = useState<number | null>(null);

  const columnRef = useRef<HTMLDivElement>(null);
  const cards = getCardsForColumn(column.id);
  const isOverWipLimit = column.wipLimit ? cards.length >= column.wipLimit : false;

  // Handle drag start for column
  const handleColumnDragStart = useCallback((e: DragEvent) => {
    if (!allowDragColumns) return;
    e.dataTransfer.setData('columnId', column.id);
    setDraggingColumn(column);
  }, [allowDragColumns, column, setDraggingColumn]);

  // Handle drag end for column
  const handleColumnDragEnd = useCallback(() => {
    setDraggingColumn(null);
  }, [setDraggingColumn]);

  // Handle drag over for column
  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();

    if (draggingCard) {
      // Calculate drop position
      const rect = columnRef.current?.getBoundingClientRect();
      if (rect) {
        const y = e.clientY - rect.top;
        const cardHeight = 80;
        const position = Math.max(0, Math.floor(y / cardHeight));
        setDropPosition(Math.min(position, cards.length));
      }
    }
  }, [draggingCard, cards.length]);

  // Handle drop
  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();

    const cardId = e.dataTransfer.getData('cardId');
    const columnId = e.dataTransfer.getData('columnId');

    if (cardId && draggingCard) {
      const position = dropPosition ?? cards.length;
      moveCard(cardId, column.id, position);
    } else if (columnId && draggingColumn) {
      moveColumn(columnId, column.position);
    }

    setDropPosition(null);
  }, [draggingCard, draggingColumn, dropPosition, cards.length, column.id, column.position, moveCard, moveColumn]);

  const handleDragLeave = useCallback(() => {
    setDropPosition(null);
  }, []);

  // Handle add card
  const handleAddCard = useCallback(() => {
    if (newCardTitle.trim()) {
      addCard(column.id, { title: newCardTitle.trim() });
      setNewCardTitle('');
      setIsAddingCard(false);
    }
  }, [newCardTitle, column.id, addCard]);

  // Handle edit title
  const handleEditTitle = useCallback(() => {
    if (editTitle.trim()) {
      updateColumn(column.id, { title: editTitle.trim() });
      setIsEditing(false);
    }
  }, [editTitle, column.id, updateColumn]);

  return (
    <div
      ref={columnRef}
      className={clsx(
        'flex-shrink-0 flex flex-col rounded-lg',
        'bg-gray-100 dark:bg-gray-800',
        column.collapsed && 'w-12',
        draggingColumn?.id === column.id && 'opacity-50'
      )}
      style={{ width: column.collapsed ? 48 : width }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragLeave={handleDragLeave}
    >
      {/* Column header */}
      <div
        className={clsx(
          'flex items-center gap-2 p-3',
          allowDragColumns && 'cursor-grab'
        )}
        draggable={allowDragColumns}
        onDragStart={handleColumnDragStart}
        onDragEnd={handleColumnDragEnd}
      >
        {allowDragColumns && (
          <GripVertical className="w-4 h-4 text-gray-400" />
        )}

        {column.collapsed ? (
          <button
            type="button"
            onClick={() => updateColumn(column.id, { collapsed: false })}
            className="flex-1 flex items-center justify-center"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <>
            {/* Color indicator */}
            {column.color && (
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: column.color }}
              />
            )}

            {/* Title */}
            {isEditing ? (
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={handleEditTitle}
                onKeyDown={(e) => e.key === 'Enter' && handleEditTitle()}
                className="flex-1 px-2 py-1 text-sm font-medium bg-white dark:bg-gray-700 rounded"
                autoFocus
              />
            ) : renderColumnHeader ? (
              renderColumnHeader(column, cards.length)
            ) : (
              <div className="flex-1 flex items-center gap-2">
                <span
                  className="font-medium text-gray-700 dark:text-gray-200 cursor-pointer"
                  onDoubleClick={() => setIsEditing(true)}
                >
                  {column.title}
                </span>
                <span className="text-sm text-gray-500">{cards.length}</span>
                {isOverWipLimit && (
                  <AlertCircle className="w-4 h-4 text-orange-500" />
                )}
              </div>
            )}

            {/* Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowMenu(!showMenu)}
                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {showMenu && (
                <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-gray-700 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 z-10">
                  <button
                    type="button"
                    onClick={() => { setIsEditing(true); setShowMenu(false); }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-600"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => { updateColumn(column.id, { collapsed: true }); setShowMenu(false); }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-600"
                  >
                    Collapse
                  </button>
                  <button
                    type="button"
                    onClick={() => { deleteColumn(column.id); setShowMenu(false); }}
                    className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Cards */}
      {!column.collapsed && (
        <div className="flex-1 flex flex-col gap-2 p-2 overflow-y-auto">
          {/* Drop indicator */}
          {dropPosition === 0 && draggingCard && (
            <div className="h-1 bg-blue-500 rounded" />
          )}

          {cards.map((card, index) => (
            <React.Fragment key={card.id}>
              <KanbanCardComponent
                card={card}
                allowDrag={allowDragCards}
                renderCard={renderCard}
              />
              {dropPosition === index + 1 && draggingCard && (
                <div className="h-1 bg-blue-500 rounded" />
              )}
            </React.Fragment>
          ))}

          {/* Add card form */}
          {isAddingCard ? (
            <div className="bg-white dark:bg-gray-700 rounded-lg p-2 shadow">
              <textarea
                value={newCardTitle}
                onChange={(e) => setNewCardTitle(e.target.value)}
                placeholder="Enter card title..."
                className="w-full px-2 py-1 text-sm bg-transparent resize-none focus:outline-none"
                rows={2}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAddCard();
                  }
                  if (e.key === 'Escape') {
                    setIsAddingCard(false);
                    setNewCardTitle('');
                  }
                }}
              />
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={handleAddCard}
                  className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => { setIsAddingCard(false); setNewCardTitle(''); }}
                  className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : allowAddCard && (
            <button
              type="button"
              onClick={() => setIsAddingCard(true)}
              className="flex items-center gap-2 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm">Add card</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// KANBAN CARD COMPONENT
// ============================================================================

interface KanbanCardComponentProps {
  card: KanbanCard;
  allowDrag: boolean;
  renderCard?: (card: KanbanCard) => ReactNode;
}

function KanbanCardComponent({
  card,
  allowDrag,
  renderCard,
}: KanbanCardComponentProps) {
  const { setDraggingCard, draggingCard, selectCard } = useKanbanContext();

  // Handle drag start
  const handleDragStart = useCallback((e: DragEvent) => {
    if (!allowDrag) return;
    e.dataTransfer.setData('cardId', card.id);
    setDraggingCard(card);
  }, [allowDrag, card, setDraggingCard]);

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    setDraggingCard(null);
  }, [setDraggingCard]);

  if (renderCard) {
    return (
      <div
        draggable={allowDrag}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={() => selectCard(card)}
        className={clsx(
          draggingCard?.id === card.id && 'opacity-50'
        )}
      >
        {renderCard(card)}
      </div>
    );
  }

  return (
    <div
      draggable={allowDrag}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={() => selectCard(card)}
      className={clsx(
        'bg-white dark:bg-gray-700 rounded-lg shadow-sm',
        'border border-gray-200 dark:border-gray-600',
        'cursor-pointer hover:shadow-md transition-shadow',
        draggingCard?.id === card.id && 'opacity-50'
      )}
    >
      {/* Cover image */}
      {card.coverImage && (
        <img
          src={card.coverImage}
          alt=""
          className="w-full h-32 object-cover rounded-t-lg"
        />
      )}

      <div className="p-3">
        {/* Labels */}
        {card.labels && card.labels.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {card.labels.map((label) => (
              <span
                key={label.id}
                className="px-2 py-0.5 text-xs font-medium text-white rounded"
                style={{ backgroundColor: label.color }}
              >
                {label.name}
              </span>
            ))}
          </div>
        )}

        {/* Title */}
        <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200">
          {card.title}
        </h4>

        {/* Metadata */}
        <div className="flex items-center gap-3 mt-2 text-gray-500 text-xs">
          {/* Priority */}
          {card.priority && (
            <div className={clsx('w-2 h-2 rounded-full', PRIORITY_COLORS[card.priority])} />
          )}

          {/* Due date */}
          {card.dueDate && (
            <div className={clsx('flex items-center gap-1', isDuePast(card.dueDate) && 'text-red-500')}>
              <Clock className="w-3 h-3" />
              <span>{formatDueDate(card.dueDate)}</span>
            </div>
          )}

          {/* Checklist */}
          {card.checklist && (
            <div className="flex items-center gap-1">
              <CheckSquare className="w-3 h-3" />
              <span>{card.checklist.completed}/{card.checklist.total}</span>
            </div>
          )}

          {/* Comments */}
          {card.commentCount && card.commentCount > 0 && (
            <div className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              <span>{card.commentCount}</span>
            </div>
          )}

          {/* Attachments */}
          {card.attachmentCount && card.attachmentCount > 0 && (
            <div className="flex items-center gap-1">
              <Paperclip className="w-3 h-3" />
              <span>{card.attachmentCount}</span>
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Assignee */}
          {card.assignee && (
            card.assignee.avatar ? (
              <img
                src={card.assignee.avatar}
                alt={card.assignee.name}
                className="w-5 h-5 rounded-full"
              />
            ) : (
              <div className="w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center">
                <User className="w-3 h-3 text-gray-600" />
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// KANBAN CARD MODAL
// ============================================================================

interface KanbanCardModalProps {
  card: KanbanCard;
  onClose: () => void;
}

function KanbanCardModal({ card, onClose }: KanbanCardModalProps) {
  const { updateCard, deleteCard, columns } = useKanbanContext();
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description || '');

  const column = columns.find((c) => c.id === card.columnId);

  const handleSave = useCallback(() => {
    updateCard(card.id, { title, description });
  }, [card.id, title, description, updateCard]);

  const handleDelete = useCallback(() => {
    if (confirm('Are you sure you want to delete this card?')) {
      deleteCard(card.id);
      onClose();
    }
  }, [card.id, deleteCard, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-800 rounded-lg shadow-xl">
        {/* Header */}
        <div className="flex items-start gap-4 p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex-1">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleSave}
              className="w-full text-lg font-semibold bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1"
            />
            <p className="text-sm text-gray-500 mt-1">
              in column <strong>{column?.title}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 grid grid-cols-3 gap-6">
          {/* Main content */}
          <div className="col-span-2 space-y-4">
            {/* Labels */}
            {card.labels && card.labels.length > 0 && (
              <div>
                <h5 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Labels</h5>
                <div className="flex flex-wrap gap-1">
                  {card.labels.map((label) => (
                    <span
                      key={label.id}
                      className="px-2 py-1 text-sm text-white rounded"
                      style={{ backgroundColor: label.color }}
                    >
                      {label.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            <div>
              <h5 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Description</h5>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={handleSave}
                placeholder="Add a description..."
                className="w-full min-h-[100px] px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Checklist progress */}
            {card.checklist && (
              <div>
                <h5 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Checklist</h5>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500"
                      style={{ width: `${(card.checklist.completed / card.checklist.total) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-500">
                    {card.checklist.completed}/{card.checklist.total}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Assignee */}
            {card.assignee && (
              <div>
                <h5 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Assignee</h5>
                <div className="flex items-center gap-2">
                  {card.assignee.avatar ? (
                    <img
                      src={card.assignee.avatar}
                      alt={card.assignee.name}
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                  <span className="text-sm">{card.assignee.name}</span>
                </div>
              </div>
            )}

            {/* Due date */}
            {card.dueDate && (
              <div>
                <h5 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Due Date</h5>
                <div className={clsx('flex items-center gap-2', isDuePast(card.dueDate) && 'text-red-500')}>
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm">{formatDueDate(card.dueDate)}</span>
                </div>
              </div>
            )}

            {/* Priority */}
            {card.priority && (
              <div>
                <h5 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Priority</h5>
                <div className="flex items-center gap-2">
                  <div className={clsx('w-3 h-3 rounded-full', PRIORITY_COLORS[card.priority])} />
                  <span className="text-sm capitalize">{card.priority}</span>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={handleDelete}
                className="w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
              >
                Delete Card
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SIMPLE KANBAN (Prebuilt)
// ============================================================================

interface SimpleKanbanProps {
  items: { id: string; title: string; status: string; [key: string]: unknown }[];
  statuses: { id: string; label: string; color?: string }[];
  onItemMove?: (itemId: string, newStatus: string) => void;
  renderItem?: (item: { id: string; title: string; status: string }) => ReactNode;
  className?: string;
}

/**
 * Simplified kanban board using status field
 */
export function SimpleKanban({
  items,
  statuses,
  onItemMove,
  renderItem,
  className,
}: SimpleKanbanProps) {
  const columns: KanbanColumn[] = statuses.map((s, i) => ({
    id: s.id,
    title: s.label,
    color: s.color,
    position: i,
  }));

  const cards: KanbanCard[] = items.map((item) => ({
    id: item.id,
    title: item.title,
    columnId: item.status,
    position: 0,
  }));

  return (
    <KanbanBoard
      columns={columns}
      cards={cards}
      onCardMove={(cardId, toColumnId) => onItemMove?.(cardId, toColumnId)}
      renderCard={renderItem ? (card) => renderItem(items.find((i) => i.id === card.id)!) : undefined}
      allowAddColumn={false}
      allowAddCard={false}
      className={className}
    />
  );
}

// ============================================================================
// EXPORTS
// ============================================================================
// All types and interfaces are exported inline above
