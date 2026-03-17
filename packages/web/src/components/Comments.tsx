/**
 * Comments.tsx - CRITICAL-37
 * 
 * Comments and discussion system for the ERP application.
 * Threaded comments with replies, reactions, and editing.
 * 
 * Features:
 * - 37.1: Comment list with threading
 * - 37.2: Comment composer with formatting
 * - 37.3: Reactions and emoji picker
 * - 37.4: Edit and delete comments
 * - 37.5: Comment moderation
 * 
 * @module Comments
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
} from 'react';
import { clsx } from 'clsx';
import {
  MessageSquare,
  Reply,
  Edit2,
  Trash2,
  MoreVertical,
  ThumbsUp,
  Heart,
  Smile,
  Send,
  X,
  Check,
  AlertTriangle,
  Flag,
  Pin,
  ChevronDown,
  ChevronUp,
  User,
} from 'lucide-react';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/** Comment author */
export interface CommentAuthor {
  id: string;
  name: string;
  avatar?: string;
  role?: string;
}

/** Comment reaction */
export interface CommentReaction {
  emoji: string;
  count: number;
  users: string[];
  userReacted: boolean;
}

/** Comment data */
export interface Comment {
  id: string;
  content: string;
  htmlContent?: string;
  author: CommentAuthor;
  createdAt: Date | string;
  updatedAt?: Date | string;
  parentId?: string;
  replies?: Comment[];
  reactions?: CommentReaction[];
  isPinned?: boolean;
  isEdited?: boolean;
  isDeleted?: boolean;
  metadata?: Record<string, unknown>;
}

/** Comments context */
export interface CommentsContextValue {
  comments: Comment[];
  currentUserId?: string;
  addComment: (content: string, parentId?: string) => Promise<Comment>;
  updateComment: (id: string, content: string) => Promise<Comment>;
  deleteComment: (id: string) => Promise<void>;
  addReaction: (commentId: string, emoji: string) => Promise<void>;
  removeReaction: (commentId: string, emoji: string) => Promise<void>;
  pinComment: (id: string) => Promise<void>;
  unpinComment: (id: string) => Promise<void>;
  reportComment: (id: string, reason: string) => Promise<void>;
}

/** Comments list props */
export interface CommentsListProps {
  comments: Comment[];
  currentUserId?: string;
  onAddComment?: (content: string, parentId?: string) => Promise<Comment | void>;
  onUpdateComment?: (id: string, content: string) => Promise<Comment | void>;
  onDeleteComment?: (id: string) => Promise<void>;
  onAddReaction?: (commentId: string, emoji: string) => Promise<void>;
  onRemoveReaction?: (commentId: string, emoji: string) => Promise<void>;
  onPinComment?: (id: string) => Promise<void>;
  onReportComment?: (id: string, reason: string) => Promise<void>;
  showComposer?: boolean;
  composerPlaceholder?: string;
  allowReplies?: boolean;
  allowReactions?: boolean;
  allowEditing?: boolean;
  allowDeleting?: boolean;
  allowPinning?: boolean;
  maxDepth?: number;
  sortOrder?: 'newest' | 'oldest' | 'popular';
  emptyMessage?: string;
  className?: string;
}

/** Comment composer props */
export interface CommentComposerProps {
  onSubmit: (content: string) => Promise<void>;
  placeholder?: string;
  submitLabel?: string;
  initialValue?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  showCancel?: boolean;
  onCancel?: () => void;
  minLength?: number;
  maxLength?: number;
  className?: string;
}

// ============================================================================
// CONTEXT
// ============================================================================

const CommentsContext = createContext<CommentsContextValue | null>(null);

/** Hook to access comments context */
export function useComments(): CommentsContextValue {
  const context = useContext(CommentsContext);
  if (!context) {
    throw new Error('useComments must be used within a CommentsProvider');
  }
  return context;
}

// ============================================================================
// UTILITIES
// ============================================================================

/** Format relative time */
function formatTimeAgo(date: Date | string): string {
  const now = new Date();
  const d = new Date(date);
  const diff = now.getTime() - d.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  if (weeks < 4) return `${weeks}w ago`;
  if (months < 12) return `${months}mo ago`;
  return d.toLocaleDateString();
}

/** Default emoji reactions */
const DEFAULT_REACTIONS = ['👍', '❤️', '😄', '🎉', '😮', '😢'];

// ============================================================================
// 37.2: COMMENT COMPOSER
// ============================================================================

/**
 * Comment input component with submit button
 * 
 * @example
 * ```tsx
 * <CommentComposer
 *   onSubmit={async (content) => {
 *     await addComment(content);
 *   }}
 *   placeholder="Add a comment..."
 * />
 * ```
 */
export function CommentComposer({
  onSubmit,
  placeholder = 'Write a comment...',
  submitLabel = 'Send',
  initialValue = '',
  autoFocus = false,
  disabled = false,
  showCancel = false,
  onCancel,
  minLength = 1,
  maxLength = 5000,
  className,
}: CommentComposerProps) {
  const [content, setContent] = useState(initialValue);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [content]);

  const handleSubmit = async () => {
    if (content.trim().length < minLength || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit(content.trim());
      setContent('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape' && showCancel) {
      onCancel?.();
    }
  };

  const isValid = content.trim().length >= minLength && content.length <= maxLength;

  return (
    <div className={clsx('space-y-2', className)}>
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled || isSubmitting}
        autoFocus={autoFocus}
        rows={1}
        className={clsx(
          'w-full px-3 py-2 border rounded-lg resize-none',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
          'disabled:bg-gray-100 disabled:cursor-not-allowed',
          'dark:bg-gray-800 dark:border-gray-700 dark:text-white'
        )}
        maxLength={maxLength}
      />

      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">
          {content.length > 0 && (
            <>
              {content.length}/{maxLength}
              <span className="ml-2 text-gray-400">⌘+Enter to submit</span>
            </>
          )}
        </span>

        <div className="flex gap-2">
          {showCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid || disabled || isSubmitting}
            className={clsx(
              'flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded',
              'bg-blue-500 text-white hover:bg-blue-600',
              'disabled:bg-gray-300 disabled:cursor-not-allowed'
            )}
          >
            <Send className="w-4 h-4" />
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 37.1, 37.3-37.5: COMMENT ITEM
// ============================================================================

interface CommentItemProps {
  comment: Comment;
  currentUserId?: string;
  depth?: number;
  maxDepth?: number;
  allowReplies?: boolean;
  allowReactions?: boolean;
  allowEditing?: boolean;
  allowDeleting?: boolean;
  allowPinning?: boolean;
  onAddComment?: (content: string, parentId?: string) => Promise<Comment | void>;
  onUpdateComment?: (id: string, content: string) => Promise<Comment | void>;
  onDeleteComment?: (id: string) => Promise<void>;
  onAddReaction?: (commentId: string, emoji: string) => Promise<void>;
  onRemoveReaction?: (commentId: string, emoji: string) => Promise<void>;
  onPinComment?: (id: string) => Promise<void>;
  onReportComment?: (id: string, reason: string) => Promise<void>;
}

function CommentItem({
  comment,
  currentUserId,
  depth = 0,
  maxDepth = 3,
  allowReplies = true,
  allowReactions = true,
  allowEditing = true,
  allowDeleting = true,
  allowPinning = false,
  onAddComment,
  onUpdateComment,
  onDeleteComment,
  onAddReaction,
  onRemoveReaction,
  onPinComment,
  onReportComment,
}: CommentItemProps) {
  const [isReplying, setIsReplying] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [showMenu, setShowMenu] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [showReplies, setShowReplies] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  const isAuthor = currentUserId === comment.author.id;
  const canEdit = isAuthor && allowEditing && !comment.isDeleted;
  const canDelete = isAuthor && allowDeleting && !comment.isDeleted;
  const canReply = allowReplies && depth < maxDepth && !comment.isDeleted;

  const handleReply = async (content: string) => {
    await onAddComment?.(content, comment.id);
    setIsReplying(false);
  };

  const handleEdit = async () => {
    if (editContent.trim() !== comment.content) {
      await onUpdateComment?.(comment.id, editContent.trim());
    }
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this comment?')) {
      setIsDeleting(true);
      await onDeleteComment?.(comment.id);
      setIsDeleting(false);
    }
  };

  const handleReaction = async (emoji: string) => {
    const reaction = comment.reactions?.find((r) => r.emoji === emoji);
    if (reaction?.userReacted) {
      await onRemoveReaction?.(comment.id, emoji);
    } else {
      await onAddReaction?.(comment.id, emoji);
    }
    setShowReactions(false);
  };

  if (comment.isDeleted) {
    return (
      <div className="flex gap-3 py-3">
        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
          <User className="w-4 h-4 text-gray-400" />
        </div>
        <div className="flex-1">
          <p className="text-sm text-gray-500 italic">This comment has been deleted</p>
        </div>
      </div>
    );
  }

  return (
    <div className={clsx('group', depth > 0 && 'ml-8 pl-4 border-l-2 border-gray-100')}>
      <div className="flex gap-3 py-3">
        {/* Avatar */}
        {comment.author.avatar ? (
          <img
            src={comment.author.avatar}
            alt={comment.author.name}
            className="w-8 h-8 rounded-full"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
            <span className="text-sm font-medium text-blue-600">
              {comment.author.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {comment.author.name}
            </span>
            {comment.author.role && (
              <span className="px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 rounded">
                {comment.author.role}
              </span>
            )}
            {comment.isPinned && (
              <Pin className="w-3 h-3 text-blue-500" />
            )}
            <span className="text-xs text-gray-500">
              {formatTimeAgo(comment.createdAt)}
            </span>
            {comment.isEdited && (
              <span className="text-xs text-gray-400">(edited)</span>
            )}
          </div>

          {/* Content */}
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleEdit}
                  className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  <Check className="w-3 h-3" />
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => { setIsEditing(false); setEditContent(comment.content); }}
                  className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div
              className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap"
              dangerouslySetInnerHTML={comment.htmlContent ? { __html: comment.htmlContent } : undefined}
            >
              {!comment.htmlContent && comment.content}
            </div>
          )}

          {/* Reactions */}
          {!isEditing && comment.reactions && comment.reactions.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {comment.reactions.map((reaction) => (
                <button
                  key={reaction.emoji}
                  type="button"
                  onClick={() => handleReaction(reaction.emoji)}
                  className={clsx(
                    'flex items-center gap-1 px-2 py-0.5 text-sm rounded-full',
                    reaction.userReacted
                      ? 'bg-blue-100 text-blue-700 border border-blue-300'
                      : 'bg-gray-100 hover:bg-gray-200'
                  )}
                  title={reaction.users.join(', ')}
                >
                  <span>{reaction.emoji}</span>
                  <span className="text-xs">{reaction.count}</span>
                </button>
              ))}
            </div>
          )}

          {/* Actions */}
          {!isEditing && (
            <div className="flex items-center gap-3 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
              {/* Reaction picker */}
              {allowReactions && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowReactions(!showReactions)}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                  >
                    <Smile className="w-4 h-4" />
                    React
                  </button>
                  {showReactions && (
                    <div className="absolute bottom-full left-0 mb-1 p-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border flex gap-1 z-10">
                      {DEFAULT_REACTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => handleReaction(emoji)}
                          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-lg"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Reply */}
              {canReply && (
                <button
                  type="button"
                  onClick={() => setIsReplying(!isReplying)}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                >
                  <Reply className="w-4 h-4" />
                  Reply
                </button>
              )}

              {/* Edit */}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </button>
              )}

              {/* Delete */}
              {canDelete && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              )}

              {/* More menu */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
                {showMenu && (
                  <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg border z-10">
                    {allowPinning && onPinComment && (
                      <button
                        type="button"
                        onClick={() => { onPinComment(comment.id); setShowMenu(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <Pin className="w-4 h-4" />
                        {comment.isPinned ? 'Unpin' : 'Pin'}
                      </button>
                    )}
                    {onReportComment && (
                      <button
                        type="button"
                        onClick={() => { onReportComment(comment.id, 'inappropriate'); setShowMenu(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                      >
                        <Flag className="w-4 h-4" />
                        Report
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Reply composer */}
          {isReplying && (
            <div className="mt-3">
              <CommentComposer
                onSubmit={handleReply}
                placeholder={`Reply to ${comment.author.name}...`}
                submitLabel="Reply"
                autoFocus
                showCancel
                onCancel={() => setIsReplying(false)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowReplies(!showReplies)}
            className="flex items-center gap-1 ml-11 mb-2 text-xs text-blue-600 hover:text-blue-700"
          >
            {showReplies ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {showReplies ? 'Hide' : 'Show'} {comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}
          </button>
          {showReplies && (
            <div>
              {comment.replies.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  currentUserId={currentUserId}
                  depth={depth + 1}
                  maxDepth={maxDepth}
                  allowReplies={allowReplies}
                  allowReactions={allowReactions}
                  allowEditing={allowEditing}
                  allowDeleting={allowDeleting}
                  allowPinning={allowPinning}
                  onAddComment={onAddComment}
                  onUpdateComment={onUpdateComment}
                  onDeleteComment={onDeleteComment}
                  onAddReaction={onAddReaction}
                  onRemoveReaction={onRemoveReaction}
                  onPinComment={onPinComment}
                  onReportComment={onReportComment}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// COMMENTS LIST
// ============================================================================

/**
 * Complete comments system with threading
 * 
 * @example
 * ```tsx
 * <CommentsList
 *   comments={comments}
 *   currentUserId={user.id}
 *   onAddComment={async (content, parentId) => {
 *     return await api.comments.create({ content, parentId });
 *   }}
 *   onDeleteComment={async (id) => {
 *     await api.comments.delete(id);
 *   }}
 * />
 * ```
 */
export function CommentsList({
  comments,
  currentUserId,
  onAddComment,
  onUpdateComment,
  onDeleteComment,
  onAddReaction,
  onRemoveReaction,
  onPinComment,
  onReportComment,
  showComposer = true,
  composerPlaceholder = 'Write a comment...',
  allowReplies = true,
  allowReactions = true,
  allowEditing = true,
  allowDeleting = true,
  allowPinning = false,
  maxDepth = 3,
  sortOrder = 'newest',
  emptyMessage = 'No comments yet. Be the first to comment!',
  className,
}: CommentsListProps) {
  // Sort and filter top-level comments
  const sortedComments = useMemo(() => {
    const topLevel = comments.filter((c) => !c.parentId);

    switch (sortOrder) {
      case 'oldest':
        return topLevel.sort((a, b) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      case 'popular':
        return topLevel.sort((a, b) => {
          const aReactions = a.reactions?.reduce((sum, r) => sum + r.count, 0) || 0;
          const bReactions = b.reactions?.reduce((sum, r) => sum + r.count, 0) || 0;
          return bReactions - aReactions;
        });
      case 'newest':
      default:
        return topLevel.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    }
  }, [comments, sortOrder]);

  // Separate pinned comments
  const pinnedComments = sortedComments.filter((c) => c.isPinned);
  const regularComments = sortedComments.filter((c) => !c.isPinned);

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="w-5 h-5 text-gray-500" />
        <h3 className="font-medium text-gray-900 dark:text-gray-100">
          Comments ({comments.length})
        </h3>
      </div>

      {/* Composer */}
      {showComposer && onAddComment && (
        <div className="mb-6">
          <CommentComposer
            onSubmit={async (content) => {
              await onAddComment(content);
            }}
            placeholder={composerPlaceholder}
          />
        </div>
      )}

      {/* Empty state */}
      {sortedComments.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>{emptyMessage}</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {/* Pinned comments */}
          {pinnedComments.length > 0 && (
            <div className="pb-4 mb-4 bg-blue-50 dark:bg-blue-900/20 -mx-4 px-4 rounded-lg">
              <p className="flex items-center gap-1 text-xs font-medium text-blue-600 mb-2 pt-2">
                <Pin className="w-3 h-3" />
                Pinned
              </p>
              {pinnedComments.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  currentUserId={currentUserId}
                  maxDepth={maxDepth}
                  allowReplies={allowReplies}
                  allowReactions={allowReactions}
                  allowEditing={allowEditing}
                  allowDeleting={allowDeleting}
                  allowPinning={allowPinning}
                  onAddComment={onAddComment}
                  onUpdateComment={onUpdateComment}
                  onDeleteComment={onDeleteComment}
                  onAddReaction={onAddReaction}
                  onRemoveReaction={onRemoveReaction}
                  onPinComment={onPinComment}
                  onReportComment={onReportComment}
                />
              ))}
            </div>
          )}

          {/* Regular comments */}
          {regularComments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              currentUserId={currentUserId}
              maxDepth={maxDepth}
              allowReplies={allowReplies}
              allowReactions={allowReactions}
              allowEditing={allowEditing}
              allowDeleting={allowDeleting}
              allowPinning={allowPinning}
              onAddComment={onAddComment}
              onUpdateComment={onUpdateComment}
              onDeleteComment={onDeleteComment}
              onAddReaction={onAddReaction}
              onRemoveReaction={onRemoveReaction}
              onPinComment={onPinComment}
              onReportComment={onReportComment}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// COMMENT COUNT BADGE
// ============================================================================

interface CommentCountProps {
  count: number;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Comment count badge/button
 */
export function CommentCount({
  count,
  onClick,
  size = 'md',
  className,
}: CommentCountProps) {
  const sizeClasses = {
    sm: 'text-xs gap-1',
    md: 'text-sm gap-1.5',
    lg: 'text-base gap-2',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const Component = onClick ? 'button' : 'span';

  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={clsx(
        'inline-flex items-center text-gray-500',
        sizeClasses[size],
        onClick && 'hover:text-gray-700',
        className
      )}
    >
      <MessageSquare className={iconSizes[size]} />
      <span>{count}</span>
    </Component>
  );
}

// ============================================================================
// EXPORTS - Types are exported inline at their definitions
// ============================================================================
