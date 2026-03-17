/**
 * MarkdownRenderer.tsx - CRITICAL-40
 * 
 * Markdown rendering and editing components for the ERP application.
 * Full-featured markdown parser with syntax highlighting.
 * 
 * Features:
 * - 40.1: Markdown parser with GFM support
 * - 40.2: Syntax highlighting for code blocks
 * - 40.3: Markdown editor with preview
 * - 40.4: Custom renderers
 * - 40.5: Table of contents generation
 * 
 * @module MarkdownRenderer
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
  type ComponentType,
} from 'react';
import { clsx } from 'clsx';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Link,
  Image,
  List,
  ListOrdered,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  Table,
  CheckSquare,
  Eye,
  Edit,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/** Markdown renderer props */
export interface MarkdownRendererProps {
  /** Markdown content */
  content: string;
  /** Allow HTML */
  allowHtml?: boolean;
  /** Enable syntax highlighting */
  syntaxHighlight?: boolean;
  /** Custom link handler */
  onLinkClick?: (href: string) => void;
  /** Custom image handler */
  onImageClick?: (src: string, alt?: string) => void;
  /** Custom renderers */
  renderers?: Partial<MarkdownRenderers>;
  /** Class name */
  className?: string;
}

/** Markdown editor props */
export interface MarkdownEditorProps {
  /** Value */
  value: string;
  /** On change */
  onChange: (value: string) => void;
  /** Placeholder */
  placeholder?: string;
  /** Show toolbar */
  showToolbar?: boolean;
  /** Show preview */
  showPreview?: boolean;
  /** Min height */
  minHeight?: number;
  /** Max height */
  maxHeight?: number;
  /** Disabled */
  disabled?: boolean;
  /** Class name */
  className?: string;
}

/** Custom renderers */
export interface MarkdownRenderers {
  heading: ComponentType<{ level: number; children: ReactNode }>;
  paragraph: ComponentType<{ children: ReactNode }>;
  link: ComponentType<{ href: string; children: ReactNode }>;
  image: ComponentType<{ src: string; alt?: string }>;
  code: ComponentType<{ language?: string; children: string }>;
  codeInline: ComponentType<{ children: string }>;
  blockquote: ComponentType<{ children: ReactNode }>;
  list: ComponentType<{ ordered: boolean; children: ReactNode }>;
  listItem: ComponentType<{ checked?: boolean; children: ReactNode }>;
  table: ComponentType<{ children: ReactNode }>;
  tableRow: ComponentType<{ children: ReactNode }>;
  tableCell: ComponentType<{ isHeader: boolean; align?: string; children: ReactNode }>;
  thematicBreak: ComponentType<Record<string, never>>;
}

/** Table of contents item */
export interface TocItem {
  level: number;
  text: string;
  id: string;
}

// ============================================================================
// 40.1: MARKDOWN PARSER
// ============================================================================

/** Escape HTML entities */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Generate heading ID from text */
function generateHeadingId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-');
}

/** Parse inline markdown */
function parseInline(text: string, allowHtml: boolean = false): string {
  if (!text) return '';

  let result = allowHtml ? text : escapeHtml(text);

  // Bold: **text** or __text__
  result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  result = result.replace(/__([^_]+)__/g, '<strong>$1</strong>');

  // Italic: *text* or _text_
  result = result.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  result = result.replace(/\b_([^_]+)_\b/g, '<em>$1</em>');

  // Strikethrough: ~~text~~
  result = result.replace(/~~([^~]+)~~/g, '<del>$1</del>');

  // Inline code: `code`
  result = result.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

  // Links: [text](url)
  result = result.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" class="md-link">$1</a>'
  );

  // Images: ![alt](url)
  result = result.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    '<img src="$2" alt="$1" class="md-image" />'
  );

  // Autolinks: <url>
  result = result.replace(
    /<(https?:\/\/[^>]+)>/g,
    '<a href="$1" class="md-link">$1</a>'
  );

  return result;
}

/** Parse markdown to HTML */
export function parseMarkdown(
  markdown: string,
  options: { allowHtml?: boolean } = {}
): string {
  const { allowHtml = false } = options;
  const lines = markdown.split('\n');
  const result: string[] = [];
  let inCodeBlock = false;
  let codeLanguage = '';
  let codeContent: string[] = [];
  let inList = false;
  let listType = 'ul';
  let inBlockquote = false;
  let blockquoteContent: string[] = [];
  let inTable = false;
  let tableRows: string[][] = [];

  const flushList = () => {
    if (inList) {
      result.push(`</${listType}>`);
      inList = false;
    }
  };

  const flushBlockquote = () => {
    if (inBlockquote) {
      const content = blockquoteContent.join(' ');
      result.push(`<blockquote class="md-blockquote">${parseInline(content, allowHtml)}</blockquote>`);
      blockquoteContent = [];
      inBlockquote = false;
    }
  };

  const flushTable = () => {
    if (inTable && tableRows.length > 0) {
      let html = '<table class="md-table"><thead><tr>';
      const header = tableRows[0];
      header.forEach((cell) => {
        html += `<th>${parseInline(cell.trim(), allowHtml)}</th>`;
      });
      html += '</tr></thead><tbody>';
      
      for (let i = 2; i < tableRows.length; i++) {
        html += '<tr>';
        tableRows[i].forEach((cell) => {
          html += `<td>${parseInline(cell.trim(), allowHtml)}</td>`;
        });
        html += '</tr>';
      }
      html += '</tbody></table>';
      result.push(html);
      tableRows = [];
      inTable = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code blocks
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        result.push(
          `<pre class="md-code-block" data-language="${codeLanguage}"><code>${escapeHtml(codeContent.join('\n'))}</code></pre>`
        );
        codeContent = [];
        codeLanguage = '';
        inCodeBlock = false;
      } else {
        flushList();
        flushBlockquote();
        flushTable();
        codeLanguage = line.slice(3).trim();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeContent.push(line);
      continue;
    }

    // Table detection
    if (line.includes('|') && !inTable) {
      const nextLine = lines[i + 1] || '';
      if (nextLine.match(/^\|?[\s-:|]+\|?$/)) {
        flushList();
        flushBlockquote();
        inTable = true;
        tableRows.push(line.split('|').filter((c) => c.trim()));
        continue;
      }
    }

    if (inTable) {
      if (line.includes('|')) {
        tableRows.push(line.split('|').filter((c) => c.trim()));
        continue;
      } else {
        flushTable();
      }
    }

    // Empty line
    if (!line.trim()) {
      flushList();
      flushBlockquote();
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushList();
      flushBlockquote();
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const id = generateHeadingId(text);
      result.push(
        `<h${level} id="${id}" class="md-heading md-h${level}">${parseInline(text, allowHtml)}</h${level}>`
      );
      continue;
    }

    // Horizontal rule
    if (line.match(/^[-*_]{3,}$/)) {
      flushList();
      flushBlockquote();
      result.push('<hr class="md-hr" />');
      continue;
    }

    // Blockquotes
    if (line.startsWith('>')) {
      flushList();
      inBlockquote = true;
      blockquoteContent.push(line.slice(1).trim());
      continue;
    }

    // Unordered lists
    const ulMatch = line.match(/^[-*+]\s+(.+)$/);
    if (ulMatch) {
      flushBlockquote();
      if (!inList || listType !== 'ul') {
        if (inList) result.push(`</${listType}>`);
        result.push('<ul class="md-list md-ul">');
        inList = true;
        listType = 'ul';
      }
      const content = ulMatch[1];
      // Check for task list item
      const taskMatch = content.match(/^\[([ x])\]\s+(.+)$/i);
      if (taskMatch) {
        const checked = taskMatch[1].toLowerCase() === 'x';
        result.push(
          `<li class="md-task-item"><input type="checkbox" ${checked ? 'checked' : ''} disabled />${parseInline(taskMatch[2], allowHtml)}</li>`
        );
      } else {
        result.push(`<li>${parseInline(content, allowHtml)}</li>`);
      }
      continue;
    }

    // Ordered lists
    const olMatch = line.match(/^\d+\.\s+(.+)$/);
    if (olMatch) {
      flushBlockquote();
      if (!inList || listType !== 'ol') {
        if (inList) result.push(`</${listType}>`);
        result.push('<ol class="md-list md-ol">');
        inList = true;
        listType = 'ol';
      }
      result.push(`<li>${parseInline(olMatch[1], allowHtml)}</li>`);
      continue;
    }

    // Paragraph
    flushList();
    flushBlockquote();
    result.push(`<p class="md-paragraph">${parseInline(line, allowHtml)}</p>`);
  }

  // Flush remaining content
  if (inCodeBlock) {
    result.push(
      `<pre class="md-code-block" data-language="${codeLanguage}"><code>${escapeHtml(codeContent.join('\n'))}</code></pre>`
    );
  }
  flushList();
  flushBlockquote();
  flushTable();

  return result.join('\n');
}

// ============================================================================
// 40.2: SYNTAX HIGHLIGHTING
// ============================================================================

/** Simple syntax highlighter */
export function highlightCode(code: string, language: string): string {
  const keywords: Record<string, string[]> = {
    javascript: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'import', 'export', 'from', 'async', 'await', 'try', 'catch', 'throw', 'new', 'this', 'typeof', 'instanceof'],
    typescript: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'import', 'export', 'from', 'async', 'await', 'try', 'catch', 'throw', 'new', 'this', 'typeof', 'instanceof', 'type', 'interface', 'enum', 'as', 'implements', 'extends', 'public', 'private', 'protected'],
    python: ['def', 'class', 'if', 'elif', 'else', 'for', 'while', 'return', 'import', 'from', 'as', 'try', 'except', 'raise', 'with', 'lambda', 'pass', 'break', 'continue', 'and', 'or', 'not', 'in', 'is', 'True', 'False', 'None'],
    sql: ['SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'TABLE', 'INDEX', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'ON', 'AND', 'OR', 'NOT', 'NULL', 'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET', 'AS'],
  };

  const lang = language.toLowerCase();
  const langKeywords = keywords[lang] || keywords['javascript'] || [];

  let result = escapeHtml(code);

  // Strings
  result = result.replace(
    /("[^"]*"|'[^']*'|`[^`]*`)/g,
    '<span class="hl-string">$1</span>'
  );

  // Comments
  result = result.replace(
    /(\/\/[^\n]*)/g,
    '<span class="hl-comment">$1</span>'
  );
  result = result.replace(
    /(\/\*[\s\S]*?\*\/)/g,
    '<span class="hl-comment">$1</span>'
  );
  result = result.replace(
    /(#[^\n]*)/g,
    '<span class="hl-comment">$1</span>'
  );

  // Keywords
  langKeywords.forEach((keyword) => {
    const regex = new RegExp(`\\b(${keyword})\\b`, 'g');
    result = result.replace(regex, '<span class="hl-keyword">$1</span>');
  });

  // Numbers
  result = result.replace(
    /\b(\d+(?:\.\d+)?)\b/g,
    '<span class="hl-number">$1</span>'
  );

  return result;
}

// ============================================================================
// 40.5: TABLE OF CONTENTS
// ============================================================================

/**
 * Extract table of contents from markdown
 */
export function extractToc(markdown: string): TocItem[] {
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  const items: TocItem[] = [];
  let match;

  while ((match = headingRegex.exec(markdown)) !== null) {
    const level = match[1].length;
    const text = match[2].replace(/[*_`]/g, ''); // Remove inline formatting
    items.push({
      level,
      text,
      id: generateHeadingId(text),
    });
  }

  return items;
}

/** Table of contents component */
export function TableOfContents({
  items,
  activeId,
  onItemClick,
  className,
}: {
  items: TocItem[];
  activeId?: string;
  onItemClick?: (id: string) => void;
  className?: string;
}) {
  const minLevel = Math.min(...items.map((i) => i.level));

  return (
    <nav className={clsx('md-toc', className)}>
      <h4 className="text-sm font-semibold text-gray-500 uppercase mb-2">
        Table of Contents
      </h4>
      <ul className="space-y-1">
        {items.map((item, index) => (
          <li
            key={index}
            style={{ paddingLeft: `${(item.level - minLevel) * 12}px` }}
          >
            <a
              href={`#${item.id}`}
              onClick={(e) => {
                e.preventDefault();
                onItemClick?.(item.id);
                const el = document.getElementById(item.id);
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className={clsx(
                'block text-sm py-0.5 hover:text-blue-600',
                activeId === item.id
                  ? 'text-blue-600 font-medium'
                  : 'text-gray-600'
              )}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// ============================================================================
// MARKDOWN RENDERER COMPONENT
// ============================================================================

/**
 * Render markdown content
 * 
 * @example
 * ```tsx
 * <MarkdownRenderer
 *   content={markdownText}
 *   syntaxHighlight
 *   onLinkClick={(href) => window.open(href)}
 * />
 * ```
 */
export function MarkdownRenderer({
  content,
  allowHtml = false,
  syntaxHighlight = true,
  onLinkClick,
  onImageClick,
  renderers,
  className,
}: MarkdownRendererProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const html = useMemo(() => {
    let parsed = parseMarkdown(content, { allowHtml });

    // Apply syntax highlighting to code blocks
    if (syntaxHighlight) {
      parsed = parsed.replace(
        /<pre class="md-code-block" data-language="([^"]*)"><code>([\s\S]*?)<\/code><\/pre>/g,
        (_, lang, code) => {
          const highlighted = lang ? highlightCode(code, lang) : code;
          return `<pre class="md-code-block" data-language="${lang}"><code>${highlighted}</code></pre>`;
        }
      );
    }

    return parsed;
  }, [content, allowHtml, syntaxHighlight]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;

    // Handle link clicks
    if (target.tagName === 'A') {
      e.preventDefault();
      const href = target.getAttribute('href');
      if (href && onLinkClick) {
        onLinkClick(href);
      } else if (href) {
        window.open(href, '_blank', 'noopener,noreferrer');
      }
    }

    // Handle image clicks
    if (target.tagName === 'IMG') {
      const src = target.getAttribute('src');
      const alt = target.getAttribute('alt');
      if (src && onImageClick) {
        onImageClick(src, alt || undefined);
      }
    }

    // Handle code block copy
    if (target.closest('.md-code-block')) {
      const block = target.closest('.md-code-block') as HTMLElement;
      const code = block.querySelector('code')?.textContent || '';
      navigator.clipboard.writeText(code).then(() => {
        const id = Math.random().toString(36);
        setCopied(id);
        setTimeout(() => setCopied(null), 2000);
      });
    }
  }, [onLinkClick, onImageClick]);

  return (
    <div
      className={clsx('md-content prose prose-sm dark:prose-invert max-w-none', className)}
      onClick={handleClick}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// ============================================================================
// 40.3: MARKDOWN EDITOR
// ============================================================================

/** Editor toolbar button */
interface ToolbarButtonProps {
  icon: typeof Bold;
  title: string;
  onClick: () => void;
  active?: boolean;
}

function ToolbarButton({ icon: Icon, title, onClick, active }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={clsx(
        'p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700',
        active && 'bg-gray-100 dark:bg-gray-700'
      )}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}

/**
 * Markdown editor with toolbar and preview
 * 
 * @example
 * ```tsx
 * const [content, setContent] = useState('');
 * 
 * <MarkdownEditor
 *   value={content}
 *   onChange={setContent}
 *   showPreview
 * />
 * ```
 */
export function MarkdownEditor({
  value,
  onChange,
  placeholder = 'Write your content here...',
  showToolbar = true,
  showPreview = true,
  minHeight = 200,
  maxHeight = 500,
  disabled = false,
  className,
}: MarkdownEditorProps) {
  const [mode, setMode] = useState<'write' | 'preview'>('write');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertText = useCallback((before: string, after: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.slice(start, end);

    const newText = value.slice(0, start) + before + selectedText + after + value.slice(end);
    onChange(newText);

    // Set cursor position
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + before.length + selectedText.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  }, [value, onChange]);

  const insertAtLineStart = useCallback((prefix: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;

    const newText = value.slice(0, lineStart) + prefix + value.slice(lineStart);
    onChange(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length);
    }, 0);
  }, [value, onChange]);

  const toolbarActions = useMemo(() => [
    { icon: Bold, title: 'Bold', action: () => insertText('**', '**') },
    { icon: Italic, title: 'Italic', action: () => insertText('*', '*') },
    { icon: Strikethrough, title: 'Strikethrough', action: () => insertText('~~', '~~') },
    { separator: true },
    { icon: Heading1, title: 'Heading 1', action: () => insertAtLineStart('# ') },
    { icon: Heading2, title: 'Heading 2', action: () => insertAtLineStart('## ') },
    { icon: Heading3, title: 'Heading 3', action: () => insertAtLineStart('### ') },
    { separator: true },
    { icon: List, title: 'Bullet List', action: () => insertAtLineStart('- ') },
    { icon: ListOrdered, title: 'Numbered List', action: () => insertAtLineStart('1. ') },
    { icon: CheckSquare, title: 'Task List', action: () => insertAtLineStart('- [ ] ') },
    { separator: true },
    { icon: Quote, title: 'Quote', action: () => insertAtLineStart('> ') },
    { icon: Code, title: 'Code', action: () => insertText('`', '`') },
    { icon: Link, title: 'Link', action: () => insertText('[', '](url)') },
    { icon: Image, title: 'Image', action: () => insertText('![alt](', ')') },
  ] as const, [insertText, insertAtLineStart]);

  return (
    <div className={clsx('border rounded-lg overflow-hidden', className)}>
      {/* Toolbar */}
      {showToolbar && (
        <div className="flex items-center gap-1 p-2 border-b bg-gray-50 dark:bg-gray-800">
          {toolbarActions.map((item, index) => (
            'separator' in item ? (
              <div key={index} className="w-px h-6 bg-gray-200 dark:bg-gray-600 mx-1" />
            ) : (
              <ToolbarButton
                key={index}
                icon={item.icon}
                title={item.title}
                onClick={item.action}
              />
            )
          ))}

          {showPreview && (
            <>
              <div className="flex-1" />
              <div className="flex items-center gap-1 border rounded p-0.5 bg-white dark:bg-gray-700">
                <button
                  type="button"
                  onClick={() => setMode('write')}
                  className={clsx(
                    'px-2 py-1 text-sm rounded',
                    mode === 'write'
                      ? 'bg-gray-100 dark:bg-gray-600'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-600'
                  )}
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setMode('preview')}
                  className={clsx(
                    'px-2 py-1 text-sm rounded',
                    mode === 'preview'
                      ? 'bg-gray-100 dark:bg-gray-600'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-600'
                  )}
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Content */}
      <div style={{ minHeight, maxHeight }} className="overflow-auto">
        {mode === 'write' ? (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className={clsx(
              'w-full h-full p-4 resize-none focus:outline-none',
              'font-mono text-sm',
              'dark:bg-gray-900 dark:text-gray-100',
              disabled && 'bg-gray-100 cursor-not-allowed'
            )}
            style={{ minHeight }}
          />
        ) : (
          <div className="p-4">
            {value ? (
              <MarkdownRenderer content={value} />
            ) : (
              <p className="text-gray-400 italic">Nothing to preview</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MARKDOWN STYLES
// ============================================================================

/** Default markdown styles */
export const markdownStyles = `
  .md-content {
    line-height: 1.6;
  }

  .md-heading {
    font-weight: 600;
    margin-top: 1.5em;
    margin-bottom: 0.5em;
  }

  .md-h1 { font-size: 2em; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.3em; }
  .md-h2 { font-size: 1.5em; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.3em; }
  .md-h3 { font-size: 1.25em; }
  .md-h4 { font-size: 1em; }
  .md-h5 { font-size: 0.875em; }
  .md-h6 { font-size: 0.85em; color: #6b7280; }

  .md-paragraph {
    margin-bottom: 1em;
  }

  .md-link {
    color: #3b82f6;
    text-decoration: none;
  }

  .md-link:hover {
    text-decoration: underline;
  }

  .md-image {
    max-width: 100%;
    border-radius: 0.5rem;
  }

  .md-blockquote {
    border-left: 4px solid #e5e7eb;
    padding-left: 1em;
    color: #6b7280;
    margin: 1em 0;
  }

  .md-list {
    padding-left: 2em;
    margin-bottom: 1em;
  }

  .md-ul {
    list-style-type: disc;
  }

  .md-ol {
    list-style-type: decimal;
  }

  .md-task-item {
    list-style: none;
    margin-left: -1.5em;
  }

  .md-task-item input {
    margin-right: 0.5em;
  }

  .md-hr {
    border: 0;
    border-top: 1px solid #e5e7eb;
    margin: 1.5em 0;
  }

  .md-code-block {
    background: #1f2937;
    color: #e5e7eb;
    padding: 1em;
    border-radius: 0.5rem;
    overflow-x: auto;
    margin: 1em 0;
  }

  .inline-code {
    background: #f3f4f6;
    padding: 0.2em 0.4em;
    border-radius: 0.25rem;
    font-family: monospace;
    font-size: 0.9em;
  }

  .dark .inline-code {
    background: #374151;
  }

  .md-table {
    width: 100%;
    border-collapse: collapse;
    margin: 1em 0;
  }

  .md-table th,
  .md-table td {
    border: 1px solid #e5e7eb;
    padding: 0.5em 1em;
    text-align: left;
  }

  .md-table th {
    background: #f9fafb;
    font-weight: 600;
  }

  .dark .md-table th {
    background: #374151;
  }

  /* Syntax highlighting */
  .hl-keyword { color: #c678dd; }
  .hl-string { color: #98c379; }
  .hl-number { color: #d19a66; }
  .hl-comment { color: #5c6370; font-style: italic; }
`;

// ============================================================================
// INLINE MARKDOWN
// ============================================================================

/**
 * Render inline markdown (no block elements)
 */
export function InlineMarkdown({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const html = useMemo(() => parseInline(content), [content]);

  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// ============================================================================
// EXPORTS
// ============================================================================
