import React, { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';
import {
  Download,
  FileSpreadsheet,
  FileText,
  File,
  ChevronDown,
  Loader2,
  Check,
  AlertCircle,
} from 'lucide-react';

// ============================================================================
// Types & Interfaces
// ============================================================================

export type ExportFormat = 'csv' | 'xlsx' | 'pdf' | 'json';

export interface ExportOption {
  format: ExportFormat;
  label: string;
  icon: typeof FileSpreadsheet;
  description?: string;
  disabled?: boolean;
  disabledReason?: string;
}

export interface ExportButtonProps {
  /** Callback when export is triggered */
  onExport: (format: ExportFormat) => Promise<void>;
  /** Available export formats */
  formats?: ExportFormat[];
  /** Custom export options */
  options?: ExportOption[];
  /** Button label */
  label?: string;
  /** Custom className */
  className?: string;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Button variant */
  variant?: 'primary' | 'secondary' | 'ghost';
  /** Whether to show format icons */
  showIcons?: boolean;
  /** Loading state (controlled externally) */
  loading?: boolean;
  /** Success message duration in ms */
  successDuration?: number;
  /** Error message duration in ms */
  errorDuration?: number;
}

export interface ExportProgressProps {
  progress: number;
  label?: string;
  className?: string;
}

// ============================================================================
// Default Export Options
// ============================================================================

const defaultExportOptions: Record<ExportFormat, ExportOption> = {
  csv: {
    format: 'csv',
    label: 'CSV',
    icon: FileSpreadsheet,
    description: 'Comma-separated values',
  },
  xlsx: {
    format: 'xlsx',
    label: 'Excel',
    icon: FileSpreadsheet,
    description: 'Microsoft Excel spreadsheet',
  },
  pdf: {
    format: 'pdf',
    label: 'PDF',
    icon: FileText,
    description: 'Portable Document Format',
  },
  json: {
    format: 'json',
    label: 'JSON',
    icon: File,
    description: 'JavaScript Object Notation',
  },
};

// ============================================================================
// ExportButton Component
// ============================================================================

export function ExportButton({
  onExport,
  formats = ['csv', 'xlsx', 'pdf'],
  options,
  label = 'Export',
  className,
  disabled = false,
  size = 'md',
  variant = 'secondary',
  showIcons = true,
  loading: externalLoading,
  successDuration = 2000,
  errorDuration = 3000,
}: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [internalLoading, setInternalLoading] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loading = externalLoading || internalLoading;

  // Build options list
  const exportOptions = options || formats.map((format) => defaultExportOptions[format]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Reset status after duration
  useEffect(() => {
    if (status === 'success') {
      const timer = setTimeout(() => setStatus('idle'), successDuration);
      return () => clearTimeout(timer);
    }
    if (status === 'error') {
      const timer = setTimeout(() => {
        setStatus('idle');
        setErrorMessage(null);
      }, errorDuration);
      return () => clearTimeout(timer);
    }
  }, [status, successDuration, errorDuration]);

  const handleExport = async (format: ExportFormat) => {
    setIsOpen(false);
    setExportingFormat(format);
    setInternalLoading(true);
    setStatus('idle');
    setErrorMessage(null);

    try {
      await onExport(format);
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setInternalLoading(false);
      setExportingFormat(null);
    }
  };

  const sizeClasses = {
    sm: {
      button: 'px-2.5 py-1.5 text-xs gap-1.5',
      icon: 'h-3.5 w-3.5',
      dropdown: 'min-w-40',
    },
    md: {
      button: 'px-3 py-2 text-sm gap-2',
      icon: 'h-4 w-4',
      dropdown: 'min-w-48',
    },
    lg: {
      button: 'px-4 py-2.5 text-base gap-2',
      icon: 'h-5 w-5',
      dropdown: 'min-w-52',
    },
  };

  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 border-blue-600',
    secondary: 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300',
    ghost: 'bg-transparent text-gray-600 hover:bg-gray-100 border-transparent',
  };

  const styles = sizeClasses[size];

  // If only one format, just a simple button
  if (exportOptions.length === 1) {
    const option = exportOptions[0];
    const Icon = option.icon;

    return (
      <button
        onClick={() => handleExport(option.format)}
        disabled={disabled || loading || option.disabled}
        className={clsx(
          'inline-flex items-center font-medium rounded-lg border transition-colors',
          styles.button,
          variantClasses[variant],
          (disabled || loading || option.disabled) && 'opacity-60 cursor-not-allowed',
          className,
        )}
      >
        {loading ? (
          <Loader2 className={clsx(styles.icon, 'animate-spin')} />
        ) : status === 'success' ? (
          <Check className={clsx(styles.icon, 'text-green-500')} />
        ) : status === 'error' ? (
          <AlertCircle className={clsx(styles.icon, 'text-red-500')} />
        ) : showIcons ? (
          <Icon className={styles.icon} />
        ) : (
          <Download className={styles.icon} />
        )}
        <span>{label}</span>
      </button>
    );
  }

  return (
    <div className={clsx('relative inline-block', className)} ref={dropdownRef}>
      {/* Main Button */}
      <button
        onClick={() => !disabled && !loading && setIsOpen(!isOpen)}
        disabled={disabled || loading}
        className={clsx(
          'inline-flex items-center font-medium rounded-lg border transition-colors',
          styles.button,
          variantClasses[variant],
          (disabled || loading) && 'opacity-60 cursor-not-allowed',
        )}
      >
        {loading ? (
          <Loader2 className={clsx(styles.icon, 'animate-spin')} />
        ) : status === 'success' ? (
          <Check className={clsx(styles.icon, 'text-green-500')} />
        ) : status === 'error' ? (
          <AlertCircle className={clsx(styles.icon, 'text-red-500')} />
        ) : (
          <Download className={styles.icon} />
        )}
        <span>{loading ? `Exporting ${exportingFormat?.toUpperCase()}...` : label}</span>
        <ChevronDown className={clsx(
          styles.icon,
          'transition-transform',
          isOpen && 'rotate-180',
        )} />
      </button>

      {/* Error tooltip */}
      {status === 'error' && errorMessage && (
        <div className="absolute top-full left-0 mt-1 px-2 py-1 bg-red-50 text-red-700 text-xs rounded border border-red-200 whitespace-nowrap">
          {errorMessage}
        </div>
      )}

      {/* Dropdown Menu */}
      {isOpen && (
        <div className={clsx(
          'absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20',
          styles.dropdown,
        )}>
          {exportOptions.map((option) => {
            const Icon = option.icon;
            
            return (
              <button
                key={option.format}
                onClick={() => !option.disabled && handleExport(option.format)}
                disabled={option.disabled}
                className={clsx(
                  'w-full flex items-center gap-3 px-3 py-2 text-left transition-colors',
                  option.disabled
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:bg-gray-50',
                )}
                title={option.disabled ? option.disabledReason : undefined}
              >
                {showIcons && (
                  <Icon className={clsx(
                    'h-4 w-4 flex-shrink-0',
                    option.format === 'csv' && 'text-green-600',
                    option.format === 'xlsx' && 'text-emerald-600',
                    option.format === 'pdf' && 'text-red-600',
                    option.format === 'json' && 'text-blue-600',
                  )} />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900">
                    {option.label}
                  </div>
                  {option.description && (
                    <div className="text-xs text-gray-500 truncate">
                      {option.description}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ExportProgress Component
// ============================================================================

export function ExportProgress({ progress, label = 'Exporting...', className }: ExportProgressProps) {
  return (
    <div className={clsx('space-y-2', className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium text-gray-900">{Math.round(progress)}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-600 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Quick Export Buttons - Pre-configured single-format buttons
// ============================================================================

export interface QuickExportButtonProps {
  onClick: () => Promise<void>;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function ExportCSVButton({ onClick, disabled, loading, className, size = 'md' }: QuickExportButtonProps) {
  return (
    <ExportButton
      onExport={async () => { await onClick(); }}
      formats={['csv']}
      label="Export CSV"
      disabled={disabled}
      loading={loading}
      className={className}
      size={size}
    />
  );
}

export function ExportExcelButton({ onClick, disabled, loading, className, size = 'md' }: QuickExportButtonProps) {
  return (
    <ExportButton
      onExport={async () => { await onClick(); }}
      formats={['xlsx']}
      label="Export Excel"
      disabled={disabled}
      loading={loading}
      className={className}
      size={size}
    />
  );
}

export function ExportPDFButton({ onClick, disabled, loading, className, size = 'md' }: QuickExportButtonProps) {
  return (
    <ExportButton
      onExport={async () => { await onClick(); }}
      formats={['pdf']}
      label="Export PDF"
      disabled={disabled}
      loading={loading}
      className={className}
      size={size}
    />
  );
}

// ============================================================================
// Utility Functions for Export
// ============================================================================

/**
 * Convert data to CSV string
 */
export function toCSV<T extends Record<string, unknown>>(
  data: T[],
  columns?: { key: keyof T; label: string }[]
): string {
  if (data.length === 0) return '';

  const cols = columns || Object.keys(data[0]).map((key) => ({ 
    key: key as keyof T, 
    label: key as string,
  }));

  const header = cols.map((c) => `"${c.label}"`).join(',');
  const rows = data.map((row) =>
    cols.map((c) => {
      const value = row[c.key];
      if (value === null || value === undefined) return '';
      if (typeof value === 'string') return `"${value.replace(/"/g, '""')}"`;
      return String(value);
    }).join(',')
  );

  return [header, ...rows].join('\n');
}

/**
 * Download a file from a blob or string
 */
export function downloadFile(
  content: string | Blob,
  filename: string,
  mimeType: string = 'text/plain'
): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Get MIME type for export format
 */
export function getMimeType(format: ExportFormat): string {
  const mimeTypes: Record<ExportFormat, string> = {
    csv: 'text/csv',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pdf: 'application/pdf',
    json: 'application/json',
  };
  return mimeTypes[format];
}

/**
 * Get file extension for export format
 */
export function getFileExtension(format: ExportFormat): string {
  return `.${format}`;
}
