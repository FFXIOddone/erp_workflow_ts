/**
 * Table Export Utilities
 * 
 * Export table data to various formats:
 * - CSV (Comma-separated values)
 * - Excel (XLSX via xlsx library)
 * - PDF (via jspdf and jspdf-autotable)
 * - JSON
 * - Clipboard
 */

import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download,
  FileSpreadsheet,
  FileText,
  FileJson,
  Copy,
  Check,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { clsx } from 'clsx';
import type { ColumnDef } from './AdvancedTable';

// ============================================================================
// Types
// ============================================================================

export type ExportFormat = 'csv' | 'excel' | 'pdf' | 'json' | 'clipboard';

export interface ExportOptions<TData> {
  /** Data to export */
  data: TData[];
  
  /** Columns defining what to export */
  columns: ColumnDef<TData>[];
  
  /** File name (without extension) */
  filename?: string;
  
  /** Export format */
  format: ExportFormat;
  
  /** Only export selected rows */
  selectedOnly?: boolean;
  
  /** Selected row IDs */
  selectedIds?: Set<string>;
  
  /** Get row ID function */
  getRowId?: (row: TData) => string;
  
  /** Include headers in export */
  includeHeaders?: boolean;
  
  /** Custom title for PDF */
  title?: string;
  
  /** Sheet name for Excel */
  sheetName?: string;
}

export interface ExportButtonProps<TData> {
  data: TData[];
  columns: ColumnDef<TData>[];
  filename?: string;
  selectedIds?: Set<string>;
  getRowId?: (row: TData) => string;
  formats?: ExportFormat[];
  className?: string;
  title?: string;
}

// ============================================================================
// Export Functions
// ============================================================================

/**
 * Get cell value for export
 */
function getCellValue<TData>(row: TData, column: ColumnDef<TData>): string {
  const value = typeof column.accessor === 'function'
    ? column.accessor(row)
    : row[column.accessor as keyof TData];
  
  if (column.exportFormat) {
    return column.exportFormat(value);
  }
  
  if (column.format) {
    return column.format(value);
  }
  
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * Export to CSV
 */
export function exportToCSV<TData>(options: ExportOptions<TData>): void {
  const { data, columns, filename = 'export', includeHeaders = true } = options;
  
  const visibleColumns = columns.filter((c) => !c.hidden);
  
  const rows: string[][] = [];
  
  // Add headers
  if (includeHeaders) {
    rows.push(visibleColumns.map((c) => c.header));
  }
  
  // Add data rows
  data.forEach((row) => {
    rows.push(visibleColumns.map((col) => getCellValue(row, col)));
  });
  
  // Convert to CSV
  const csvContent = rows
    .map((row) =>
      row
        .map((cell) => {
          // Escape quotes and wrap in quotes if needed
          if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
            return `"${cell.replace(/"/g, '""')}"`;
          }
          return cell;
        })
        .join(',')
    )
    .join('\n');
  
  // Create and download file
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${filename}.csv`);
}

/**
 * Export to Excel (XLSX)
 */
export async function exportToExcel<TData>(options: ExportOptions<TData>): Promise<void> {
  const { data, columns, filename = 'export', sheetName = 'Sheet1', includeHeaders = true } = options;
  
  // Dynamically import xlsx library
  const XLSX = await import('xlsx').catch(() => null);
  if (!XLSX) {
    throw new Error('xlsx library is not installed. Run: npm install xlsx');
  }
  
  const visibleColumns = columns.filter((c) => !c.hidden);
  
  const worksheetData: unknown[][] = [];
  
  // Add headers
  if (includeHeaders) {
    worksheetData.push(visibleColumns.map((c) => c.header));
  }
  
  // Add data rows
  data.forEach((row) => {
    worksheetData.push(visibleColumns.map((col) => {
      const value = typeof col.accessor === 'function'
        ? col.accessor(row)
        : row[col.accessor as keyof TData];
      
      // Keep native types for Excel
      if (value instanceof Date) return value;
      if (typeof value === 'number') return value;
      if (typeof value === 'boolean') return value;
      return getCellValue(row, col);
    }));
  });
  
  // Create worksheet
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
  
  // Auto-size columns
  const colWidths = visibleColumns.map((col, idx) => {
    const maxWidth = worksheetData.reduce((max, row) => {
      const cell = String(row[idx] ?? '');
      return Math.max(max, cell.length);
    }, col.header.length);
    return { wch: Math.min(maxWidth + 2, 50) };
  });
  worksheet['!cols'] = colWidths;
  
  // Create workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  
  // Export
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  downloadBlob(blob, `${filename}.xlsx`);
}

/**
 * Export to PDF
 */
export async function exportToPDF<TData>(options: ExportOptions<TData>): Promise<void> {
  const { data, columns, filename = 'export', title, includeHeaders = true } = options;
  
  // Dynamically import jspdf and autotable
  const jspdfModule = await import('jspdf').catch(() => null);
  const autotableModule = await import('jspdf-autotable').catch(() => null);
  
  if (!jspdfModule || !autotableModule) {
    throw new Error('jspdf and jspdf-autotable libraries are required. Run: npm install jspdf jspdf-autotable');
  }
  
  const jsPDF = jspdfModule.default;
  const autoTable = autotableModule.default;
  
  const visibleColumns = columns.filter((c) => !c.hidden);
  
  // Create PDF
  const doc = new jsPDF({
    orientation: visibleColumns.length > 5 ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });
  
  // Add title
  if (title) {
    doc.setFontSize(18);
    doc.text(title, 14, 22);
  }
  
  // Prepare table data
  const headers = includeHeaders ? [visibleColumns.map((c) => c.header)] : [];
  const body = data.map((row) => visibleColumns.map((col) => getCellValue(row, col)));
  
  // Add table
  autoTable(doc, {
    head: headers,
    body,
    startY: title ? 30 : 14,
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: 255,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
    margin: { top: 14, right: 14, bottom: 14, left: 14 },
  });
  
  // Add footer with date
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128);
    doc.text(
      `Generated on ${new Date().toLocaleString()} | Page ${i} of ${pageCount}`,
      14,
      doc.internal.pageSize.height - 10
    );
  }
  
  // Save
  doc.save(`${filename}.pdf`);
}

/**
 * Export to JSON
 */
export function exportToJSON<TData>(options: ExportOptions<TData>): void {
  const { data, columns, filename = 'export' } = options;
  
  const visibleColumns = columns.filter((c) => !c.hidden);
  
  // Convert to objects with column headers as keys
  const jsonData = data.map((row) => {
    const obj: Record<string, unknown> = {};
    visibleColumns.forEach((col) => {
      const value = typeof col.accessor === 'function'
        ? col.accessor(row)
        : row[col.accessor as keyof TData];
      obj[col.header] = value;
    });
    return obj;
  });
  
  const jsonContent = JSON.stringify(jsonData, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json' });
  downloadBlob(blob, `${filename}.json`);
}

/**
 * Copy to clipboard
 */
export async function copyToClipboard<TData>(options: ExportOptions<TData>): Promise<void> {
  const { data, columns, includeHeaders = true } = options;
  
  const visibleColumns = columns.filter((c) => !c.hidden);
  
  const rows: string[][] = [];
  
  // Add headers
  if (includeHeaders) {
    rows.push(visibleColumns.map((c) => c.header));
  }
  
  // Add data rows
  data.forEach((row) => {
    rows.push(visibleColumns.map((col) => getCellValue(row, col)));
  });
  
  // Convert to tab-separated values (for pasting into spreadsheets)
  const tsvContent = rows.map((row) => row.join('\t')).join('\n');
  
  await navigator.clipboard.writeText(tsvContent);
}

/**
 * Helper to download blob
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ============================================================================
// Export Button Component
// ============================================================================

const formatConfig: Record<ExportFormat, { icon: React.ElementType; label: string }> = {
  csv: { icon: FileText, label: 'CSV' },
  excel: { icon: FileSpreadsheet, label: 'Excel' },
  pdf: { icon: FileText, label: 'PDF' },
  json: { icon: FileJson, label: 'JSON' },
  clipboard: { icon: Copy, label: 'Copy' },
};

export function ExportButton<TData>({
  data,
  columns,
  filename = 'export',
  selectedIds,
  getRowId,
  formats = ['csv', 'excel', 'pdf', 'json', 'clipboard'],
  className,
  title,
}: ExportButtonProps<TData>) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState<ExportFormat | null>(null);
  const [copied, setCopied] = useState(false);
  
  // Get data to export (all or selected)
  const exportData = useMemo(() => {
    if (selectedIds && selectedIds.size > 0 && getRowId) {
      return data.filter((row) => selectedIds.has(getRowId(row)));
    }
    return data;
  }, [data, selectedIds, getRowId]);
  
  const handleExport = useCallback(async (format: ExportFormat) => {
    setIsExporting(format);
    
    const options: ExportOptions<TData> = {
      data: exportData,
      columns,
      filename,
      format,
      title,
      includeHeaders: true,
    };
    
    try {
      switch (format) {
        case 'csv':
          exportToCSV(options);
          break;
        case 'excel':
          await exportToExcel(options);
          break;
        case 'pdf':
          await exportToPDF(options);
          break;
        case 'json':
          exportToJSON(options);
          break;
        case 'clipboard':
          await copyToClipboard(options);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
          break;
      }
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(null);
      if (format !== 'clipboard') {
        setIsOpen(false);
      }
    }
  }, [exportData, columns, filename, title]);
  
  return (
    <div className={clsx('relative', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'flex items-center gap-2 px-3 py-2 text-sm',
          'text-gray-700 dark:text-gray-300',
          'bg-white dark:bg-gray-800',
          'border border-gray-200 dark:border-gray-700 rounded-lg',
          'hover:bg-gray-50 dark:hover:bg-gray-700',
          'transition-colors'
        )}
      >
        <Download className="h-4 w-4" />
        Export
        {selectedIds && selectedIds.size > 0 && (
          <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
            {selectedIds.size}
          </span>
        )}
        <ChevronDown className={clsx('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            
            {/* Dropdown */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={clsx(
                'absolute right-0 mt-2 z-50',
                'w-48 py-1',
                'bg-white dark:bg-gray-800',
                'rounded-lg shadow-xl',
                'border border-gray-200 dark:border-gray-700'
              )}
            >
              {formats.map((format) => {
                const { icon: Icon, label } = formatConfig[format];
                const isLoading = isExporting === format;
                const isCopied = format === 'clipboard' && copied;
                
                return (
                  <button
                    key={format}
                    onClick={() => handleExport(format)}
                    disabled={isLoading}
                    className={clsx(
                      'w-full flex items-center gap-3 px-4 py-2 text-sm',
                      'text-gray-700 dark:text-gray-300',
                      'hover:bg-gray-50 dark:hover:bg-gray-700',
                      'transition-colors',
                      isLoading && 'opacity-50 cursor-wait'
                    )}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isCopied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                    <span>{isCopied ? 'Copied!' : label}</span>
                  </button>
                );
              })}
              
              {selectedIds && selectedIds.size > 0 && (
                <div className="mx-2 my-1 pt-1 border-t border-gray-200 dark:border-gray-700">
                  <p className="px-2 py-1 text-xs text-gray-500">
                    Exporting {selectedIds.size} selected row{selectedIds.size !== 1 ? 's' : ''}
                  </p>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Quick Export Hooks
// ============================================================================

export interface UseExportOptions<TData> {
  data: TData[];
  columns: ColumnDef<TData>[];
  filename?: string;
  title?: string;
}

export function useTableExport<TData>(options: UseExportOptions<TData>) {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const exportData = useCallback(async (format: ExportFormat) => {
    setIsExporting(true);
    setError(null);
    
    try {
      const exportOptions: ExportOptions<TData> = {
        ...options,
        format,
        includeHeaders: true,
      };
      
      switch (format) {
        case 'csv':
          exportToCSV(exportOptions);
          break;
        case 'excel':
          await exportToExcel(exportOptions);
          break;
        case 'pdf':
          await exportToPDF(exportOptions);
          break;
        case 'json':
          exportToJSON(exportOptions);
          break;
        case 'clipboard':
          await copyToClipboard(exportOptions);
          break;
      }
    } catch (err) {
      setError((err as Error).message || 'Export failed');
      throw err;
    } finally {
      setIsExporting(false);
    }
  }, [options]);
  
  return {
    exportData,
    isExporting,
    error,
    exportCSV: () => exportData('csv'),
    exportExcel: () => exportData('excel'),
    exportPDF: () => exportData('pdf'),
    exportJSON: () => exportData('json'),
    copyToClipboard: () => exportData('clipboard'),
  };
}

export default ExportButton;
