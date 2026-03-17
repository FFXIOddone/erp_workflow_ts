/**
 * Mention.tsx - CRITICAL-38
 * 
 * @mention system for the ERP application.
 * Mentionable text input with user/entity suggestions.
 * 
 * Features:
 * - 38.1: Mention input with trigger character
 * - 38.2: User/entity suggestions dropdown
 * - 38.3: Mention highlighting
 * - 38.4: Mention extraction and parsing
 * - 38.5: Notification integration
 * 
 * @module Mention
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
} from 'react';
import { clsx } from 'clsx';
import {
  AtSign,
  User,
  Users,
  Hash,
  Loader2,
  X,
  Check,
} from 'lucide-react';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/** Mentionable entity */
export interface MentionableEntity {
  /** Unique id */
  id: string;
  /** Display name */
  name: string;
  /** Entity type */
  type: 'user' | 'team' | 'channel' | 'tag' | 'custom';
  /** Avatar/image URL */
  avatar?: string;
  /** Additional info (email, role, etc.) */
  subtitle?: string;
  /** Search keywords */
  keywords?: string[];
  /** Disabled */
  disabled?: boolean;
}

/** Mention in text */
export interface Mention {
  /** Entity id */
  id: string;
  /** Display text */
  display: string;
  /** Entity type */
  type: string;
  /** Start index in text */
  startIndex: number;
  /** End index in text */
  endIndex: number;
}

/** Mention trigger config */
export interface MentionTrigger {
  /** Trigger character */
  trigger: string;
  /** Entity type */
  type: string;
  /** Data source */
  data: MentionableEntity[] | ((query: string) => Promise<MentionableEntity[]>);
  /** Allow spaces in search */
  allowSpaces?: boolean;
  /** Render suggestion */
  renderSuggestion?: (entity: MentionableEntity) => ReactNode;
}

/** Mention input props */
export interface MentionInputProps {
  /** Value */
  value: string;
  /** On change */
  onChange: (value: string, mentions: Mention[]) => void;
  /** Triggers configuration */
  triggers: MentionTrigger[];
  /** Placeholder */
  placeholder?: string;
  /** Disabled */
  disabled?: boolean;
  /** Multi-line */
  multiline?: boolean;
  /** Rows (for multiline) */
  rows?: number;
  /** Max length */
  maxLength?: number;
  /** Auto focus */
  autoFocus?: boolean;
  /** On submit (Enter key) */
  onSubmit?: () => void;
  /** Class name */
  className?: string;
  /** Input class name */
  inputClassName?: string;
}

/** Mention display props */
export interface MentionDisplayProps {
  /** Text with mentions */
  text: string;
  /** Mentions in text */
  mentions: Mention[];
  /** On mention click */
  onMentionClick?: (mention: Mention) => void;
  /** Class name */
  className?: string;
  /** Mention class name */
  mentionClassName?: string;
}

// ============================================================================
// UTILITIES
// ============================================================================

/** Default mention regex pattern */
const MENTION_PATTERN = /@\[([^\]]+)\]\((\w+):([^)]+)\)/g;

/**
 * Parse mentions from formatted text
 * Format: @[Display Name](type:id)
 */
export function parseMentions(text: string): Mention[] {
  const mentions: Mention[] = [];
  let match;

  while ((match = MENTION_PATTERN.exec(text)) !== null) {
    mentions.push({
      display: match[1],
      type: match[2],
      id: match[3],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  return mentions;
}

/**
 * Format mentions into text
 */
export function formatMention(entity: MentionableEntity): string {
  return `@[${entity.name}](${entity.type}:${entity.id})`;
}

/**
 * Convert mention format to plain text with @mentions
 */
export function mentionsToPlainText(text: string): string {
  return text.replace(MENTION_PATTERN, '@$1');
}

/**
 * Extract mention ids from text
 */
export function extractMentionIds(text: string): { type: string; id: string }[] {
  const mentions = parseMentions(text);
  return mentions.map((m) => ({ type: m.type, id: m.id }));
}

// ============================================================================
// 38.1-38.2: MENTION INPUT
// ============================================================================

/**
 * Text input with @mention support
 * 
 * @example
 * ```tsx
 * const [text, setText] = useState('');
 * const [mentions, setMentions] = useState<Mention[]>([]);
 * 
 * <MentionInput
 *   value={text}
 *   onChange={(value, mentions) => {
 *     setText(value);
 *     setMentions(mentions);
 *   }}
 *   triggers={[
 *     {
 *       trigger: '@',
 *       type: 'user',
 *       data: users,
 *     },
 *     {
 *       trigger: '#',
 *       type: 'tag',
 *       data: tags,
 *     },
 *   ]}
 * />
 * ```
 */
export function MentionInput({
  value,
  onChange,
  triggers,
  placeholder = 'Type @ to mention...',
  disabled = false,
  multiline = false,
  rows = 3,
  maxLength,
  autoFocus = false,
  onSubmit,
  className,
  inputClassName,
}: MentionInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<MentionableEntity[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeTrigger, setActiveTrigger] = useState<MentionTrigger | null>(null);
  const [triggerStart, setTriggerStart] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Find trigger characters
  const triggerChars = triggers.map((t) => t.trigger);

  // Check for trigger at cursor position
  const checkForTrigger = useCallback((
    text: string,
    cursorPos: number
  ): { trigger: MentionTrigger; start: number; query: string } | null => {
    // Look backwards from cursor for trigger
    for (let i = cursorPos - 1; i >= 0; i--) {
      const char = text[i];

      // Stop at whitespace or newline (unless trigger allows spaces)
      if (char === '\n') break;

      // Check if this is a trigger char
      const trigger = triggers.find((t) => t.trigger === char);
      if (trigger) {
        // Check if there's a space before trigger (or start of text)
        if (i === 0 || /\s/.test(text[i - 1])) {
          const query = text.slice(i + 1, cursorPos);
          // Check if query has spaces when not allowed
          if (!trigger.allowSpaces && /\s/.test(query)) break;
          return { trigger, start: i, query };
        }
      }

      // Stop at space if we haven't found trigger
      if (char === ' ') break;
    }

    return null;
  }, [triggers]);

  // Fetch suggestions
  const fetchSuggestions = useCallback(async (
    trigger: MentionTrigger,
    query: string
  ): Promise<MentionableEntity[]> => {
    if (typeof trigger.data === 'function') {
      return trigger.data(query);
    }

    // Filter static data
    const lowerQuery = query.toLowerCase();
    return trigger.data.filter((entity) => {
      if (entity.disabled) return false;
      if (entity.name.toLowerCase().includes(lowerQuery)) return true;
      if (entity.keywords?.some((k) => k.toLowerCase().includes(lowerQuery))) return true;
      return false;
    });
  }, []);

  // Handle input change
  const handleChange = useCallback(async (
    e: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>
  ) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart || 0;

    // Check for trigger
    const triggerMatch = checkForTrigger(newValue, cursorPos);

    if (triggerMatch) {
      setActiveTrigger(triggerMatch.trigger);
      setTriggerStart(triggerMatch.start);
      setSearchQuery(triggerMatch.query);
      setShowSuggestions(true);
      setSelectedIndex(0);

      // Fetch suggestions
      setIsLoading(true);
      try {
        const results = await fetchSuggestions(triggerMatch.trigger, triggerMatch.query);
        setSuggestions(results.slice(0, 10));
      } finally {
        setIsLoading(false);
      }
    } else {
      setShowSuggestions(false);
      setActiveTrigger(null);
      setTriggerStart(null);
    }

    // Update value and parse mentions
    const mentions = parseMentions(newValue);
    onChange(newValue, mentions);
  }, [checkForTrigger, fetchSuggestions, onChange]);

  // Insert mention
  const insertMention = useCallback((entity: MentionableEntity) => {
    if (triggerStart === null || !activeTrigger) return;

    const input = inputRef.current;
    if (!input) return;

    const cursorPos = input.selectionStart || 0;
    const beforeTrigger = value.slice(0, triggerStart);
    const afterCursor = value.slice(cursorPos);

    const mentionText = formatMention({
      ...entity,
      type: activeTrigger.type as MentionableEntity['type'],
    });

    const newValue = beforeTrigger + mentionText + ' ' + afterCursor;
    const newCursorPos = beforeTrigger.length + mentionText.length + 1;

    const mentions = parseMentions(newValue);
    onChange(newValue, mentions);

    // Reset state
    setShowSuggestions(false);
    setActiveTrigger(null);
    setTriggerStart(null);
    setSuggestions([]);

    // Set cursor position
    setTimeout(() => {
      input.setSelectionRange(newCursorPos, newCursorPos);
      input.focus();
    }, 0);
  }, [value, triggerStart, activeTrigger, onChange]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (showSuggestions && suggestions.length > 0) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % suggestions.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
          break;
        case 'Enter':
        case 'Tab':
          e.preventDefault();
          insertMention(suggestions[selectedIndex]);
          break;
        case 'Escape':
          e.preventDefault();
          setShowSuggestions(false);
          break;
      }
    } else if (e.key === 'Enter' && !e.shiftKey && !multiline) {
      e.preventDefault();
      onSubmit?.();
    }
  }, [showSuggestions, suggestions, selectedIndex, insertMention, multiline, onSubmit]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const InputComponent = multiline ? 'textarea' : 'input';

  return (
    <div className={clsx('relative', className)}>
      <InputComponent
        ref={inputRef as React.RefObject<HTMLInputElement & HTMLTextAreaElement>}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={maxLength}
        autoFocus={autoFocus}
        rows={multiline ? rows : undefined}
        className={clsx(
          'w-full px-3 py-2 border rounded-lg',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
          'disabled:bg-gray-100 disabled:cursor-not-allowed',
          'dark:bg-gray-800 dark:border-gray-700 dark:text-white',
          multiline && 'resize-none',
          inputClassName
        )}
      />

      {/* Suggestions dropdown */}
      {showSuggestions && (
        <div
          ref={suggestionsRef}
          className={clsx(
            'absolute left-0 right-0 z-50 mt-1',
            'bg-white dark:bg-gray-800 rounded-lg shadow-lg border',
            'max-h-64 overflow-y-auto'
          )}
        >
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : suggestions.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-500">
              No results found
            </div>
          ) : (
            suggestions.map((entity, index) => (
              <SuggestionItem
                key={entity.id}
                entity={entity}
                isSelected={index === selectedIndex}
                trigger={activeTrigger!}
                onClick={() => insertMention(entity)}
                onMouseEnter={() => setSelectedIndex(index)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SUGGESTION ITEM
// ============================================================================

interface SuggestionItemProps {
  entity: MentionableEntity;
  isSelected: boolean;
  trigger: MentionTrigger;
  onClick: () => void;
  onMouseEnter: () => void;
}

function SuggestionItem({
  entity,
  isSelected,
  trigger,
  onClick,
  onMouseEnter,
}: SuggestionItemProps) {
  if (trigger.renderSuggestion) {
    return (
      <div
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        className={clsx(
          'cursor-pointer',
          isSelected && 'bg-blue-50 dark:bg-blue-900/30'
        )}
      >
        {trigger.renderSuggestion(entity)}
      </div>
    );
  }

  const Icon = entity.type === 'user' ? User :
               entity.type === 'team' ? Users :
               entity.type === 'channel' || entity.type === 'tag' ? Hash :
               AtSign;

  return (
    <div
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={clsx(
        'flex items-center gap-3 px-4 py-2 cursor-pointer',
        isSelected && 'bg-blue-50 dark:bg-blue-900/30'
      )}
    >
      {entity.avatar ? (
        <img
          src={entity.avatar}
          alt={entity.name}
          className="w-8 h-8 rounded-full"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
          <Icon className="w-4 h-4 text-gray-500" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
          {entity.name}
        </p>
        {entity.subtitle && (
          <p className="text-xs text-gray-500 truncate">{entity.subtitle}</p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 38.3: MENTION DISPLAY
// ============================================================================

/**
 * Display text with highlighted mentions
 * 
 * @example
 * ```tsx
 * <MentionDisplay
 *   text={text}
 *   mentions={mentions}
 *   onMentionClick={(mention) => goToUser(mention.id)}
 * />
 * ```
 */
export function MentionDisplay({
  text,
  mentions,
  onMentionClick,
  className,
  mentionClassName,
}: MentionDisplayProps) {
  const parts = useMemo(() => {
    if (mentions.length === 0) {
      return [{ type: 'text' as const, content: mentionsToPlainText(text) }];
    }

    const result: Array<{ type: 'text' | 'mention'; content: string; mention?: Mention }> = [];
    let lastIndex = 0;

    // Sort mentions by start index
    const sortedMentions = [...mentions].sort((a, b) => a.startIndex - b.startIndex);

    sortedMentions.forEach((mention) => {
      // Add text before mention
      if (mention.startIndex > lastIndex) {
        result.push({
          type: 'text',
          content: text.slice(lastIndex, mention.startIndex),
        });
      }

      // Add mention
      result.push({
        type: 'mention',
        content: mention.display,
        mention,
      });

      lastIndex = mention.endIndex;
    });

    // Add remaining text
    if (lastIndex < text.length) {
      result.push({
        type: 'text',
        content: text.slice(lastIndex),
      });
    }

    return result;
  }, [text, mentions]);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.type === 'mention' && part.mention) {
          return (
            <span
              key={index}
              onClick={() => onMentionClick?.(part.mention!)}
              className={clsx(
                'inline-flex items-center px-1 py-0.5 rounded',
                'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
                'font-medium',
                onMentionClick && 'cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-900/70',
                mentionClassName
              )}
            >
              @{part.content}
            </span>
          );
        }
        return <span key={index}>{part.content}</span>;
      })}
    </span>
  );
}

// ============================================================================
// MENTION CHIP
// ============================================================================

interface MentionChipProps {
  entity: MentionableEntity;
  onRemove?: () => void;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Removable mention chip
 */
export function MentionChip({
  entity,
  onRemove,
  onClick,
  size = 'md',
  className,
}: MentionChipProps) {
  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  const avatarSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  return (
    <span
      onClick={onClick}
      className={clsx(
        'inline-flex items-center gap-1 rounded-full',
        'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
        sizeClasses[size],
        onClick && 'cursor-pointer hover:bg-blue-200',
        className
      )}
    >
      {entity.avatar ? (
        <img
          src={entity.avatar}
          alt={entity.name}
          className={clsx('rounded-full', avatarSizes[size])}
        />
      ) : (
        <AtSign className={avatarSizes[size]} />
      )}
      <span>{entity.name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="ml-1 p-0.5 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  );
}

// ============================================================================
// MENTION SUGGESTIONS PROVIDER
// ============================================================================

interface MentionSuggestionsProviderProps {
  users?: MentionableEntity[];
  teams?: MentionableEntity[];
  tags?: MentionableEntity[];
  fetchUsers?: (query: string) => Promise<MentionableEntity[]>;
  fetchTeams?: (query: string) => Promise<MentionableEntity[]>;
  fetchTags?: (query: string) => Promise<MentionableEntity[]>;
  children: (triggers: MentionTrigger[]) => ReactNode;
}

/**
 * Provider for common mention triggers
 */
export function MentionSuggestionsProvider({
  users = [],
  teams = [],
  tags = [],
  fetchUsers,
  fetchTeams,
  fetchTags,
  children,
}: MentionSuggestionsProviderProps) {
  const triggers = useMemo<MentionTrigger[]>(() => {
    const result: MentionTrigger[] = [];

    if (users.length > 0 || fetchUsers) {
      result.push({
        trigger: '@',
        type: 'user',
        data: fetchUsers || users,
      });
    }

    if (teams.length > 0 || fetchTeams) {
      result.push({
        trigger: '@',
        type: 'team',
        data: fetchTeams || teams,
      });
    }

    if (tags.length > 0 || fetchTags) {
      result.push({
        trigger: '#',
        type: 'tag',
        data: fetchTags || tags,
      });
    }

    return result;
  }, [users, teams, tags, fetchUsers, fetchTeams, fetchTags]);

  return <>{children(triggers)}</>;
}

// ============================================================================
// EXPORTS
// ============================================================================
