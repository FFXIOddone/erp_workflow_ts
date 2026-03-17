/**
 * RichText.tsx - CRITICAL-32
 * 
 * Rich text editing utilities and components for the ERP application.
 * Provides formatting toolbar, text manipulation, and content display.
 * 
 * Features:
 * - 32.1: Formatting toolbar (bold, italic, underline, etc.)
 * - 32.2: Text manipulation utilities
 * - 32.3: Markdown-like syntax support
 * - 32.4: Content sanitization
 * - 32.5: Rich text display component
 * 
 * @module RichText
 */

import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  forwardRef,
  type ReactNode,
  type KeyboardEvent,
} from 'react';
import { clsx } from 'clsx';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo,
  Redo,
  Image,
  Minus,
  Type,
  RemoveFormatting,
} from 'lucide-react';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/** Text format types */
export type TextFormat = 
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strikethrough'
  | 'code'
  | 'link'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'bulletList'
  | 'orderedList'
  | 'blockquote'
  | 'alignLeft'
  | 'alignCenter'
  | 'alignRight'
  | 'horizontalRule';

/** Toolbar button config */
export interface ToolbarButton {
  format: TextFormat;
  icon: ReactNode;
  label: string;
  shortcut?: string;
}

/** Formatting toolbar props */
export interface FormattingToolbarProps {
  /** On format command */
  onFormat: (format: TextFormat, value?: string) => void;
  /** Active formats */
  activeFormats?: TextFormat[];
  /** Disabled formats */
  disabledFormats?: TextFormat[];
  /** Custom buttons */
  customButtons?: ToolbarButton[];
  /** Show only specified formats */
  showFormats?: TextFormat[];
  /** Compact mode */
  compact?: boolean;
  /** Class name */
  className?: string;
}

/** Rich text editor props */
export interface RichTextEditorProps {
  /** Initial content (HTML) */
  value?: string;
  /** On change */
  onChange?: (html: string) => void;
  /** Placeholder */
  placeholder?: string;
  /** Min height */
  minHeight?: number;
  /** Max height */
  maxHeight?: number;
  /** Show toolbar */
  showToolbar?: boolean;
  /** Toolbar position */
  toolbarPosition?: 'top' | 'bottom';
  /** Allowed formats */
  allowedFormats?: TextFormat[];
  /** Read only */
  readOnly?: boolean;
  /** Disabled */
  disabled?: boolean;
  /** Class name */
  className?: string;
  /** Editor class name */
  editorClassName?: string;
  /** On focus */
  onFocus?: () => void;
  /** On blur */
  onBlur?: () => void;
}

/** Rich text display props */
export interface RichTextDisplayProps {
  /** HTML content */
  content: string;
  /** Sanitize content */
  sanitize?: boolean;
  /** Max lines (truncate) */
  maxLines?: number;
  /** Allow links */
  allowLinks?: boolean;
  /** Class name */
  className?: string;
}

/** Markdown text props */
export interface MarkdownTextProps {
  /** Markdown content */
  content: string;
  /** Class name */
  className?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Default toolbar buttons */
const DEFAULT_TOOLBAR_BUTTONS: ToolbarButton[] = [
  { format: 'bold', icon: <Bold className="w-4 h-4" />, label: 'Bold', shortcut: '⌘B' },
  { format: 'italic', icon: <Italic className="w-4 h-4" />, label: 'Italic', shortcut: '⌘I' },
  { format: 'underline', icon: <Underline className="w-4 h-4" />, label: 'Underline', shortcut: '⌘U' },
  { format: 'strikethrough', icon: <Strikethrough className="w-4 h-4" />, label: 'Strikethrough' },
  { format: 'code', icon: <Code className="w-4 h-4" />, label: 'Code' },
  { format: 'link', icon: <LinkIcon className="w-4 h-4" />, label: 'Link', shortcut: '⌘K' },
  { format: 'heading1', icon: <Heading1 className="w-4 h-4" />, label: 'Heading 1' },
  { format: 'heading2', icon: <Heading2 className="w-4 h-4" />, label: 'Heading 2' },
  { format: 'heading3', icon: <Heading3 className="w-4 h-4" />, label: 'Heading 3' },
  { format: 'bulletList', icon: <List className="w-4 h-4" />, label: 'Bullet List' },
  { format: 'orderedList', icon: <ListOrdered className="w-4 h-4" />, label: 'Numbered List' },
  { format: 'blockquote', icon: <Quote className="w-4 h-4" />, label: 'Quote' },
  { format: 'alignLeft', icon: <AlignLeft className="w-4 h-4" />, label: 'Align Left' },
  { format: 'alignCenter', icon: <AlignCenter className="w-4 h-4" />, label: 'Align Center' },
  { format: 'alignRight', icon: <AlignRight className="w-4 h-4" />, label: 'Align Right' },
  { format: 'horizontalRule', icon: <Minus className="w-4 h-4" />, label: 'Horizontal Rule' },
];

/** Button groups for toolbar */
const BUTTON_GROUPS: TextFormat[][] = [
  ['bold', 'italic', 'underline', 'strikethrough'],
  ['heading1', 'heading2', 'heading3'],
  ['bulletList', 'orderedList', 'blockquote'],
  ['alignLeft', 'alignCenter', 'alignRight'],
  ['link', 'code', 'horizontalRule'],
];

// ============================================================================
// TEXT MANIPULATION UTILITIES
// ============================================================================

/**
 * Wrap text with formatting tags
 */
export function wrapText(text: string, before: string, after: string): string {
  return `${before}${text}${after}`;
}

/**
 * Remove formatting from text
 */
export function stripFormatting(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

/**
 * Convert HTML to plain text with line breaks
 */
export function htmlToText(html: string): string {
  let text = html;
  
  // Replace block elements with line breaks
  text = text.replace(/<\/(p|div|h[1-6]|li|br)>/gi, '\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<li>/gi, '• ');
  
  // Remove remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');
  
  // Decode HTML entities
  const div = document.createElement('div');
  div.innerHTML = text;
  text = div.textContent || '';
  
  // Clean up whitespace
  text = text.replace(/\n\s*\n/g, '\n\n');
  text = text.trim();
  
  return text;
}

/**
 * Convert plain text to HTML
 */
export function textToHtml(text: string): string {
  return text
    .split('\n')
    .map((line) => `<p>${line || '<br>'}</p>`)
    .join('');
}

/**
 * Sanitize HTML content (basic XSS prevention)
 */
export function sanitizeHtml(html: string): string {
  const allowedTags = [
    'p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'strike',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'blockquote', 'pre', 'code',
    'a', 'span', 'div',
    'hr',
  ];
  
  const allowedAttributes: Record<string, string[]> = {
    a: ['href', 'target', 'rel'],
    span: ['class', 'style'],
    div: ['class', 'style'],
  };
  
  const div = document.createElement('div');
  div.innerHTML = html;
  
  const sanitizeNode = (node: Element) => {
    const tagName = node.tagName.toLowerCase();
    
    if (!allowedTags.includes(tagName)) {
      // Replace with text content
      const text = document.createTextNode(node.textContent || '');
      node.parentNode?.replaceChild(text, node);
      return;
    }
    
    // Remove disallowed attributes
    const allowed = allowedAttributes[tagName] || [];
    const attrs = Array.from(node.attributes);
    attrs.forEach((attr) => {
      if (!allowed.includes(attr.name)) {
        node.removeAttribute(attr.name);
      }
    });
    
    // Sanitize href to prevent javascript:
    if (tagName === 'a') {
      const href = node.getAttribute('href');
      if (href && (href.startsWith('javascript:') || href.startsWith('data:'))) {
        node.removeAttribute('href');
      }
      // Add security attributes for external links
      if (href && href.startsWith('http')) {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      }
    }
    
    // Recursively sanitize children
    Array.from(node.children).forEach(sanitizeNode);
  };
  
  Array.from(div.children).forEach(sanitizeNode);
  
  return div.innerHTML;
}

/**
 * Truncate HTML to specified length
 */
export function truncateHtml(html: string, maxLength: number): string {
  const text = stripFormatting(html);
  if (text.length <= maxLength) return html;
  
  return text.slice(0, maxLength).trim() + '...';
}

// ============================================================================
// MARKDOWN UTILITIES
// ============================================================================

/**
 * Convert simple markdown to HTML
 */
export function markdownToHtml(markdown: string): string {
  let html = markdown;
  
  // Escape HTML entities first
  html = html.replace(/&/g, '&amp;');
  html = html.replace(/</g, '&lt;');
  html = html.replace(/>/g, '&gt;');
  
  // Bold: **text** or __text__
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
  
  // Italic: *text* or _text_
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');
  
  // Strikethrough: ~~text~~
  html = html.replace(/~~(.+?)~~/g, '<s>$1</s>');
  
  // Inline code: `code`
  html = html.replace(/`(.+?)`/g, '<code>$1</code>');
  
  // Headers: # ## ###
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  
  // Links: [text](url)
  html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  
  // Unordered lists: - item or * item
  html = html.replace(/^[\-\*] (.+)$/gm, '<li>$1</li>');
  
  // Ordered lists: 1. item
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  
  // Blockquote: > text
  html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
  
  // Horizontal rule: ---
  html = html.replace(/^---$/gm, '<hr>');
  
  // Paragraphs
  html = html.split('\n\n').map((para) => {
    if (para.match(/^<(h[1-6]|ul|ol|blockquote|hr)/)) return para;
    return `<p>${para}</p>`;
  }).join('');
  
  // Wrap consecutive <li> in <ul>
  html = html.replace(/(<li>.+?<\/li>\s*)+/g, (match) => `<ul>${match}</ul>`);
  
  return html;
}

/**
 * Convert HTML back to simple markdown
 */
export function htmlToMarkdown(html: string): string {
  let md = html;
  
  // Headers
  md = md.replace(/<h1>(.+?)<\/h1>/gi, '# $1\n');
  md = md.replace(/<h2>(.+?)<\/h2>/gi, '## $1\n');
  md = md.replace(/<h3>(.+?)<\/h3>/gi, '### $1\n');
  
  // Bold
  md = md.replace(/<(strong|b)>(.+?)<\/(strong|b)>/gi, '**$2**');
  
  // Italic
  md = md.replace(/<(em|i)>(.+?)<\/(em|i)>/gi, '*$2*');
  
  // Strikethrough
  md = md.replace(/<(s|strike|del)>(.+?)<\/(s|strike|del)>/gi, '~~$2~~');
  
  // Code
  md = md.replace(/<code>(.+?)<\/code>/gi, '`$1`');
  
  // Links
  md = md.replace(/<a[^>]+href="([^"]+)"[^>]*>(.+?)<\/a>/gi, '[$2]($1)');
  
  // Lists
  md = md.replace(/<li>(.+?)<\/li>/gi, '- $1\n');
  md = md.replace(/<\/?[uo]l>/gi, '');
  
  // Blockquote
  md = md.replace(/<blockquote>(.+?)<\/blockquote>/gi, '> $1\n');
  
  // Horizontal rule
  md = md.replace(/<hr\s*\/?>/gi, '\n---\n');
  
  // Line breaks and paragraphs
  md = md.replace(/<br\s*\/?>/gi, '\n');
  md = md.replace(/<\/?p>/gi, '\n');
  
  // Remove remaining tags
  md = md.replace(/<[^>]+>/g, '');
  
  // Decode entities
  md = md.replace(/&lt;/g, '<');
  md = md.replace(/&gt;/g, '>');
  md = md.replace(/&amp;/g, '&');
  
  // Clean up whitespace
  md = md.replace(/\n\s*\n\s*\n/g, '\n\n');
  md = md.trim();
  
  return md;
}

// ============================================================================
// 32.1: FORMATTING TOOLBAR
// ============================================================================

/**
 * Formatting toolbar component
 * 
 * @example
 * ```tsx
 * <FormattingToolbar
 *   onFormat={(format) => document.execCommand(format)}
 *   activeFormats={['bold', 'italic']}
 * />
 * ```
 */
export function FormattingToolbar({
  onFormat,
  activeFormats = [],
  disabledFormats = [],
  customButtons,
  showFormats,
  compact = false,
  className,
}: FormattingToolbarProps) {
  const buttons = customButtons || DEFAULT_TOOLBAR_BUTTONS;
  const filteredButtons = showFormats
    ? buttons.filter((btn) => showFormats.includes(btn.format))
    : buttons;

  // Group buttons
  const groupedButtons = BUTTON_GROUPS.map((group) =>
    group
      .map((format) => filteredButtons.find((btn) => btn.format === format))
      .filter((btn): btn is ToolbarButton => btn !== undefined)
  ).filter((group) => group.length > 0);

  return (
    <div
      className={clsx(
        'flex items-center flex-wrap gap-1',
        'p-1 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700',
        className
      )}
    >
      {groupedButtons.map((group, groupIndex) => (
        <React.Fragment key={groupIndex}>
          {groupIndex > 0 && (
            <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />
          )}
          {group.map((button) => {
            const isActive = activeFormats.includes(button.format);
            const isDisabled = disabledFormats.includes(button.format);

            return (
              <button
                key={button.format}
                type="button"
                onClick={() => onFormat(button.format)}
                disabled={isDisabled}
                title={`${button.label}${button.shortcut ? ` (${button.shortcut})` : ''}`}
                className={clsx(
                  'p-1.5 rounded transition-colors',
                  compact ? 'p-1' : 'p-1.5',
                  isActive
                    ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700',
                  isDisabled && 'opacity-50 cursor-not-allowed'
                )}
                aria-pressed={isActive}
              >
                {button.icon}
              </button>
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );
}

// ============================================================================
// 32.2-32.3: RICH TEXT EDITOR
// ============================================================================

/**
 * ContentEditable-based rich text editor
 * 
 * @example
 * ```tsx
 * const [content, setContent] = useState('<p>Hello world</p>');
 * 
 * <RichTextEditor
 *   value={content}
 *   onChange={setContent}
 *   placeholder="Start typing..."
 * />
 * ```
 */
export const RichTextEditor = forwardRef<HTMLDivElement, RichTextEditorProps>(({
  value = '',
  onChange,
  placeholder = 'Start typing...',
  minHeight = 150,
  maxHeight = 400,
  showToolbar = true,
  toolbarPosition = 'top',
  allowedFormats,
  readOnly = false,
  disabled = false,
  className,
  editorClassName,
  onFocus,
  onBlur,
}, ref) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [activeFormats, setActiveFormats] = useState<TextFormat[]>([]);
  const [isEmpty, setIsEmpty] = useState(!value || value === '<p><br></p>');

  // Update content
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  // Check active formats
  const checkActiveFormats = useCallback(() => {
    const formats: TextFormat[] = [];
    
    if (document.queryCommandState('bold')) formats.push('bold');
    if (document.queryCommandState('italic')) formats.push('italic');
    if (document.queryCommandState('underline')) formats.push('underline');
    if (document.queryCommandState('strikeThrough')) formats.push('strikethrough');
    if (document.queryCommandState('insertUnorderedList')) formats.push('bulletList');
    if (document.queryCommandState('insertOrderedList')) formats.push('orderedList');
    
    setActiveFormats(formats);
  }, []);

  // Handle format command
  const handleFormat = useCallback((format: TextFormat, formatValue?: string) => {
    if (readOnly || disabled) return;

    editorRef.current?.focus();

    const commands: Record<TextFormat, { command: string; value?: string }> = {
      bold: { command: 'bold' },
      italic: { command: 'italic' },
      underline: { command: 'underline' },
      strikethrough: { command: 'strikeThrough' },
      code: { command: 'formatBlock', value: 'pre' },
      link: { command: 'createLink', value: formatValue || prompt('Enter URL:') || '' },
      heading1: { command: 'formatBlock', value: 'h1' },
      heading2: { command: 'formatBlock', value: 'h2' },
      heading3: { command: 'formatBlock', value: 'h3' },
      bulletList: { command: 'insertUnorderedList' },
      orderedList: { command: 'insertOrderedList' },
      blockquote: { command: 'formatBlock', value: 'blockquote' },
      alignLeft: { command: 'justifyLeft' },
      alignCenter: { command: 'justifyCenter' },
      alignRight: { command: 'justifyRight' },
      horizontalRule: { command: 'insertHorizontalRule' },
    };

    const cmd = commands[format];
    if (cmd) {
      document.execCommand(cmd.command, false, cmd.value);
      checkActiveFormats();
    }
  }, [readOnly, disabled, checkActiveFormats]);

  // Handle input
  const handleInput = useCallback(() => {
    if (!editorRef.current) return;

    const html = editorRef.current.innerHTML;
    const text = editorRef.current.textContent || '';
    
    setIsEmpty(!text.trim());
    onChange?.(html);
    checkActiveFormats();
  }, [onChange, checkActiveFormats]);

  // Handle key shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.metaKey || e.ctrlKey) {
      switch (e.key.toLowerCase()) {
        case 'b':
          e.preventDefault();
          handleFormat('bold');
          break;
        case 'i':
          e.preventDefault();
          handleFormat('italic');
          break;
        case 'u':
          e.preventDefault();
          handleFormat('underline');
          break;
        case 'k':
          e.preventDefault();
          handleFormat('link');
          break;
      }
    }
  }, [handleFormat]);

  // Handle paste (strip formatting if needed)
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  }, []);

  const toolbar = showToolbar && (
    <FormattingToolbar
      onFormat={handleFormat}
      activeFormats={activeFormats}
      showFormats={allowedFormats}
      disabledFormats={disabled ? DEFAULT_TOOLBAR_BUTTONS.map((b) => b.format) : []}
    />
  );

  return (
    <div
      className={clsx(
        'rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden',
        'focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent',
        disabled && 'opacity-50',
        className
      )}
    >
      {toolbarPosition === 'top' && toolbar}

      <div className="relative">
        {/* Placeholder */}
        {isEmpty && !readOnly && (
          <div
            className="absolute inset-0 p-3 text-gray-400 dark:text-gray-500 pointer-events-none"
            aria-hidden
          >
            {placeholder}
          </div>
        )}

        {/* Editor */}
        <div
          ref={editorRef}
          contentEditable={!readOnly && !disabled}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onFocus={onFocus}
          onBlur={onBlur}
          onSelect={checkActiveFormats}
          className={clsx(
            'p-3 outline-none',
            'prose prose-sm dark:prose-invert max-w-none',
            '[&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
            editorClassName
          )}
          style={{
            minHeight,
            maxHeight,
            overflowY: 'auto',
          }}
          dangerouslySetInnerHTML={{ __html: value }}
        />
      </div>

      {toolbarPosition === 'bottom' && toolbar}
    </div>
  );
});

RichTextEditor.displayName = 'RichTextEditor';

// ============================================================================
// 32.4-32.5: RICH TEXT DISPLAY
// ============================================================================

/**
 * Display sanitized rich text content
 * 
 * @example
 * ```tsx
 * <RichTextDisplay
 *   content={htmlContent}
 *   sanitize
 *   maxLines={3}
 * />
 * ```
 */
export function RichTextDisplay({
  content,
  sanitize = true,
  maxLines,
  allowLinks = true,
  className,
}: RichTextDisplayProps) {
  const processedContent = sanitize ? sanitizeHtml(content) : content;

  return (
    <div
      className={clsx(
        'prose prose-sm dark:prose-invert max-w-none',
        !allowLinks && '[&_a]:pointer-events-none [&_a]:no-underline [&_a]:text-inherit',
        maxLines && 'overflow-hidden',
        className
      )}
      style={maxLines ? {
        display: '-webkit-box',
        WebkitLineClamp: maxLines,
        WebkitBoxOrient: 'vertical',
      } : undefined}
      dangerouslySetInnerHTML={{ __html: processedContent }}
    />
  );
}

// ============================================================================
// MARKDOWN TEXT DISPLAY
// ============================================================================

/**
 * Display markdown content as HTML
 * 
 * @example
 * ```tsx
 * <MarkdownText content="**Bold** and *italic*" />
 * ```
 */
export function MarkdownText({ content, className }: MarkdownTextProps) {
  const html = markdownToHtml(content);
  
  return (
    <RichTextDisplay
      content={html}
      sanitize
      className={className}
    />
  );
}

// ============================================================================
// SIMPLE TEXT AREA (with markdown preview)
// ============================================================================

export interface MarkdownEditorProps {
  /** Markdown content */
  value?: string;
  /** On change */
  onChange?: (markdown: string) => void;
  /** Placeholder */
  placeholder?: string;
  /** Show preview toggle */
  showPreview?: boolean;
  /** Min height */
  minHeight?: number;
  /** Disabled */
  disabled?: boolean;
  /** Class name */
  className?: string;
}

/**
 * Simple markdown editor with preview
 */
export function MarkdownEditor({
  value = '',
  onChange,
  placeholder = 'Write markdown...',
  showPreview = true,
  minHeight = 150,
  disabled = false,
  className,
}: MarkdownEditorProps) {
  const [isPreview, setIsPreview] = useState(false);

  return (
    <div className={clsx('rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden', className)}>
      {/* Tabs */}
      {showPreview && (
        <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <button
            type="button"
            onClick={() => setIsPreview(false)}
            className={clsx(
              'px-4 py-2 text-sm font-medium transition-colors',
              !isPreview
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 -mb-px'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            )}
          >
            Write
          </button>
          <button
            type="button"
            onClick={() => setIsPreview(true)}
            className={clsx(
              'px-4 py-2 text-sm font-medium transition-colors',
              isPreview
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 -mb-px'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            )}
          >
            Preview
          </button>
        </div>
      )}

      {/* Editor or Preview */}
      {isPreview ? (
        <div
          className="p-3 bg-white dark:bg-gray-900"
          style={{ minHeight }}
        >
          <MarkdownText content={value} />
        </div>
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={clsx(
            'w-full p-3 resize-none outline-none',
            'bg-white dark:bg-gray-900',
            'font-mono text-sm',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
          style={{ minHeight }}
        />
      )}
    </div>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  DEFAULT_TOOLBAR_BUTTONS,
  BUTTON_GROUPS,
};

// Types are exported inline at their definitions
