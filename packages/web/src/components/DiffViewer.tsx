import React, { useMemo } from 'react';
import clsx from 'clsx';
import {
  Plus,
  Minus,
  ArrowRight,
  RefreshCw,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged' | 'modified';
  content: string;
  lineNumberOld?: number;
  lineNumberNew?: number;
}

export interface DiffViewerProps {
  /** Old/before content */
  oldValue: string;
  /** New/after content */
  newValue: string;
  /** Old value label */
  oldLabel?: string;
  /** New value label */
  newLabel?: string;
  /** View mode */
  mode?: 'split' | 'unified' | 'inline';
  /** Show line numbers */
  showLineNumbers?: boolean;
  /** Syntax highlighting language */
  language?: string;
  /** Custom className */
  className?: string;
  /** Collapse unchanged sections */
  collapseUnchanged?: boolean;
  /** Number of context lines around changes */
  contextLines?: number;
}

export interface FieldDiff {
  field: string;
  label?: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface ObjectDiffViewerProps {
  /** Field changes */
  changes: FieldDiff[];
  /** Title */
  title?: string;
  /** Custom className */
  className?: string;
  /** Show unchanged fields */
  showUnchanged?: boolean;
}

export interface JsonDiffViewerProps {
  /** Old JSON object */
  oldValue: Record<string, unknown>;
  /** New JSON object */
  newValue: Record<string, unknown>;
  /** Title */
  title?: string;
  /** Custom className */
  className?: string;
}

// ============================================================================
// Diff Algorithm (Simple LCS-based)
// ============================================================================

function computeDiff(oldLines: string[], newLines: string[]): DiffLine[] {
  const result: DiffLine[] = [];
  
  // Simple diff using longest common subsequence approach
  const lcs = computeLCS(oldLines, newLines);
  
  let oldIdx = 0;
  let newIdx = 0;
  let lcsIdx = 0;
  let oldLineNum = 1;
  let newLineNum = 1;

  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    if (lcsIdx < lcs.length && oldIdx < oldLines.length && oldLines[oldIdx] === lcs[lcsIdx]) {
      if (newIdx < newLines.length && newLines[newIdx] === lcs[lcsIdx]) {
        // Unchanged line
        result.push({
          type: 'unchanged',
          content: oldLines[oldIdx],
          lineNumberOld: oldLineNum++,
          lineNumberNew: newLineNum++,
        });
        oldIdx++;
        newIdx++;
        lcsIdx++;
      } else {
        // Added in new
        result.push({
          type: 'added',
          content: newLines[newIdx],
          lineNumberNew: newLineNum++,
        });
        newIdx++;
      }
    } else if (lcsIdx < lcs.length && newIdx < newLines.length && newLines[newIdx] === lcs[lcsIdx]) {
      // Removed from old
      result.push({
        type: 'removed',
        content: oldLines[oldIdx],
        lineNumberOld: oldLineNum++,
      });
      oldIdx++;
    } else if (oldIdx < oldLines.length && newIdx < newLines.length) {
      // Both different from LCS - treat as modification
      result.push({
        type: 'removed',
        content: oldLines[oldIdx],
        lineNumberOld: oldLineNum++,
      });
      result.push({
        type: 'added',
        content: newLines[newIdx],
        lineNumberNew: newLineNum++,
      });
      oldIdx++;
      newIdx++;
    } else if (oldIdx < oldLines.length) {
      // Remaining old lines are removed
      result.push({
        type: 'removed',
        content: oldLines[oldIdx],
        lineNumberOld: oldLineNum++,
      });
      oldIdx++;
    } else if (newIdx < newLines.length) {
      // Remaining new lines are added
      result.push({
        type: 'added',
        content: newLines[newIdx],
        lineNumberNew: newLineNum++,
      });
      newIdx++;
    }
  }

  return result;
}

function computeLCS(a: string[], b: string[]): string[] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find LCS
  const result: string[] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.unshift(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return result;
}

// ============================================================================
// DiffViewer Component (Text)
// ============================================================================

export function DiffViewer({
  oldValue,
  newValue,
  oldLabel = 'Before',
  newLabel = 'After',
  mode = 'unified',
  showLineNumbers = true,
  className,
  collapseUnchanged = false,
  contextLines = 3,
}: DiffViewerProps) {
  const diffLines = useMemo(() => {
    const oldLines = oldValue.split('\n');
    const newLines = newValue.split('\n');
    return computeDiff(oldLines, newLines);
  }, [oldValue, newValue]);

  // Group lines for collapsed view
  const displayLines = useMemo(() => {
    if (!collapseUnchanged) return diffLines;

    const result: (DiffLine | { type: 'collapsed'; count: number })[] = [];
    let unchangedBuffer: DiffLine[] = [];

    const flushBuffer = () => {
      if (unchangedBuffer.length <= contextLines * 2) {
        result.push(...unchangedBuffer);
      } else {
        result.push(...unchangedBuffer.slice(0, contextLines));
        result.push({
          type: 'collapsed',
          count: unchangedBuffer.length - contextLines * 2,
        });
        result.push(...unchangedBuffer.slice(-contextLines));
      }
      unchangedBuffer = [];
    };

    diffLines.forEach((line) => {
      if (line.type === 'unchanged') {
        unchangedBuffer.push(line);
      } else {
        flushBuffer();
        result.push(line);
      }
    });

    flushBuffer();
    return result;
  }, [diffLines, collapseUnchanged, contextLines]);

  const hasChanges = diffLines.some((l) => l.type !== 'unchanged');

  if (!hasChanges) {
    return (
      <div className={clsx('p-4 text-center text-gray-500 bg-gray-50 rounded-lg', className)}>
        No changes detected
      </div>
    );
  }

  if (mode === 'split') {
    return (
      <SplitDiffView
        diffLines={diffLines}
        oldLabel={oldLabel}
        newLabel={newLabel}
        showLineNumbers={showLineNumbers}
        className={className}
      />
    );
  }

  return (
    <div className={clsx('border border-gray-200 rounded-lg overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
        <span className="text-sm font-medium text-gray-700">
          {oldLabel} → {newLabel}
        </span>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="flex items-center gap-1 text-green-600">
            <Plus className="h-3 w-3" />
            {diffLines.filter((l) => l.type === 'added').length} additions
          </span>
          <span className="flex items-center gap-1 text-red-600">
            <Minus className="h-3 w-3" />
            {diffLines.filter((l) => l.type === 'removed').length} deletions
          </span>
        </div>
      </div>

      {/* Diff Lines */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm font-mono">
          <tbody>
            {displayLines.map((line, idx) => {
              if ('count' in line) {
                return (
                  <tr key={idx} className="bg-gray-50">
                    <td
                      colSpan={showLineNumbers ? 3 : 1}
                      className="px-4 py-1 text-center text-gray-400 text-xs"
                    >
                      <ChevronDown className="inline h-3 w-3 mr-1" />
                      {line.count} unchanged lines hidden
                    </td>
                  </tr>
                );
              }

              return (
                <tr
                  key={idx}
                  className={clsx(
                    line.type === 'added' && 'bg-green-50',
                    line.type === 'removed' && 'bg-red-50',
                    line.type === 'unchanged' && 'bg-white',
                  )}
                >
                  {showLineNumbers && (
                    <>
                      <td className="w-12 px-2 py-0.5 text-right text-gray-400 text-xs border-r border-gray-200 select-none">
                        {line.lineNumberOld || ''}
                      </td>
                      <td className="w-12 px-2 py-0.5 text-right text-gray-400 text-xs border-r border-gray-200 select-none">
                        {line.lineNumberNew || ''}
                      </td>
                    </>
                  )}
                  <td className="px-4 py-0.5 whitespace-pre">
                    <span
                      className={clsx(
                        'mr-2',
                        line.type === 'added' && 'text-green-600',
                        line.type === 'removed' && 'text-red-600',
                        line.type === 'unchanged' && 'text-gray-400',
                      )}
                    >
                      {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                    </span>
                    <span
                      className={clsx(
                        line.type === 'added' && 'text-green-800',
                        line.type === 'removed' && 'text-red-800',
                      )}
                    >
                      {line.content}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// Split Diff View
// ============================================================================

interface SplitDiffViewProps {
  diffLines: DiffLine[];
  oldLabel: string;
  newLabel: string;
  showLineNumbers: boolean;
  className?: string;
}

function SplitDiffView({
  diffLines,
  oldLabel,
  newLabel,
  showLineNumbers,
  className,
}: SplitDiffViewProps) {
  // Create paired lines for side-by-side view
  const pairs = useMemo(() => {
    const result: { old?: DiffLine; new?: DiffLine }[] = [];
    let i = 0;

    while (i < diffLines.length) {
      const line = diffLines[i];

      if (line.type === 'unchanged') {
        result.push({ old: line, new: line });
        i++;
      } else if (line.type === 'removed') {
        const next = diffLines[i + 1];
        if (next?.type === 'added') {
          result.push({ old: line, new: next });
          i += 2;
        } else {
          result.push({ old: line });
          i++;
        }
      } else if (line.type === 'added') {
        result.push({ new: line });
        i++;
      } else {
        i++;
      }
    }

    return result;
  }, [diffLines]);

  return (
    <div className={clsx('border border-gray-200 rounded-lg overflow-hidden', className)}>
      <div className="grid grid-cols-2 divide-x divide-gray-200 bg-gray-50 border-b border-gray-200">
        <div className="px-4 py-2 text-sm font-medium text-gray-700">{oldLabel}</div>
        <div className="px-4 py-2 text-sm font-medium text-gray-700">{newLabel}</div>
      </div>

      <div className="overflow-x-auto">
        <div className="grid grid-cols-2 divide-x divide-gray-200 text-sm font-mono">
          {/* Old Column */}
          <div>
            {pairs.map((pair, idx) => (
              <div
                key={idx}
                className={clsx(
                  'px-4 py-0.5 whitespace-pre',
                  pair.old?.type === 'removed' && 'bg-red-50',
                  !pair.old && 'bg-gray-50',
                )}
              >
                {showLineNumbers && pair.old?.lineNumberOld && (
                  <span className="inline-block w-8 text-right text-gray-400 text-xs mr-2">
                    {pair.old.lineNumberOld}
                  </span>
                )}
                {pair.old ? (
                  <span className={pair.old.type === 'removed' ? 'text-red-800' : ''}>
                    {pair.old.content}
                  </span>
                ) : (
                  <span className="text-gray-300">&nbsp;</span>
                )}
              </div>
            ))}
          </div>

          {/* New Column */}
          <div>
            {pairs.map((pair, idx) => (
              <div
                key={idx}
                className={clsx(
                  'px-4 py-0.5 whitespace-pre',
                  pair.new?.type === 'added' && 'bg-green-50',
                  !pair.new && 'bg-gray-50',
                )}
              >
                {showLineNumbers && pair.new?.lineNumberNew && (
                  <span className="inline-block w-8 text-right text-gray-400 text-xs mr-2">
                    {pair.new.lineNumberNew}
                  </span>
                )}
                {pair.new ? (
                  <span className={pair.new.type === 'added' ? 'text-green-800' : ''}>
                    {pair.new.content}
                  </span>
                ) : (
                  <span className="text-gray-300">&nbsp;</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ObjectDiffViewer Component (For comparing objects field by field)
// ============================================================================

export function ObjectDiffViewer({
  changes,
  title,
  className,
  showUnchanged = false,
}: ObjectDiffViewerProps) {
  const filteredChanges = showUnchanged
    ? changes
    : changes.filter((c) => JSON.stringify(c.oldValue) !== JSON.stringify(c.newValue));

  if (filteredChanges.length === 0) {
    return (
      <div className={clsx('p-4 text-center text-gray-500 bg-gray-50 rounded-lg', className)}>
        No changes detected
      </div>
    );
  }

  return (
    <div className={clsx('border border-gray-200 rounded-lg overflow-hidden', className)}>
      {title && (
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-700">{title}</h3>
        </div>
      )}

      <div className="divide-y divide-gray-200">
        {filteredChanges.map((change, idx) => {
          const isChanged =
            JSON.stringify(change.oldValue) !== JSON.stringify(change.newValue);

          return (
            <div key={idx} className="grid grid-cols-3 gap-4 p-4">
              {/* Field name */}
              <div className="font-medium text-gray-700">
                {change.label || change.field}
              </div>

              {/* Old value */}
              <div
                className={clsx(
                  'text-sm',
                  isChanged ? 'bg-red-50 px-2 py-1 rounded text-red-800' : 'text-gray-600',
                )}
              >
                {formatValue(change.oldValue)}
              </div>

              {/* New value */}
              <div
                className={clsx(
                  'text-sm flex items-center gap-2',
                  isChanged ? 'bg-green-50 px-2 py-1 rounded text-green-800' : 'text-gray-600',
                )}
              >
                {isChanged && <ArrowRight className="h-3 w-3 text-gray-400 flex-shrink-0" />}
                {formatValue(change.newValue)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '(empty)';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

// ============================================================================
// JsonDiffViewer Component (For comparing JSON objects)
// ============================================================================

export function JsonDiffViewer({
  oldValue,
  newValue,
  title,
  className,
}: JsonDiffViewerProps) {
  const oldJson = JSON.stringify(oldValue, null, 2);
  const newJson = JSON.stringify(newValue, null, 2);

  return (
    <DiffViewer
      oldValue={oldJson}
      newValue={newJson}
      oldLabel="Before"
      newLabel="After"
      mode="unified"
      className={className}
    />
  );
}

// ============================================================================
// InlineDiff Component (For single value changes)
// ============================================================================

export interface InlineDiffProps {
  oldValue: string;
  newValue: string;
  className?: string;
}

export function InlineDiff({ oldValue, newValue, className }: InlineDiffProps) {
  if (oldValue === newValue) {
    return <span className={className}>{newValue}</span>;
  }

  return (
    <span className={clsx('inline-flex items-center gap-1', className)}>
      <span className="bg-red-100 text-red-800 px-1 rounded line-through">
        {oldValue || '(empty)'}
      </span>
      <ArrowRight className="h-3 w-3 text-gray-400" />
      <span className="bg-green-100 text-green-800 px-1 rounded">
        {newValue || '(empty)'}
      </span>
    </span>
  );
}

// ============================================================================
// DiffBadge Component (Shows change type)
// ============================================================================

export interface DiffBadgeProps {
  type: 'added' | 'removed' | 'modified' | 'unchanged';
  className?: string;
}

export function DiffBadge({ type, className }: DiffBadgeProps) {
  const config = {
    added: { icon: Plus, label: 'Added', color: 'bg-green-100 text-green-700' },
    removed: { icon: Minus, label: 'Removed', color: 'bg-red-100 text-red-700' },
    modified: { icon: RefreshCw, label: 'Modified', color: 'bg-amber-100 text-amber-700' },
    unchanged: { icon: ChevronRight, label: 'Unchanged', color: 'bg-gray-100 text-gray-600' },
  };

  const { icon: Icon, label, color } = config[type];

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full',
        color,
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}
