import React, { useState, useRef, useCallback } from 'react';
import clsx from 'clsx';
import {
  Upload,
  X,
  File,
  FileText,
  FileImage,
  FileSpreadsheet,
  FileVideo,
  FileAudio,
  FileArchive,
  FileCode,
  CheckCircle,
  AlertCircle,
  Loader2,
  Trash2,
  Eye,
  Download,
} from 'lucide-react';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface UploadedFile {
  /** Unique ID for this file */
  id: string;
  /** Original file object */
  file: File;
  /** File name */
  name: string;
  /** File size in bytes */
  size: number;
  /** MIME type */
  type: string;
  /** Upload progress (0-100) */
  progress: number;
  /** Upload status */
  status: 'pending' | 'uploading' | 'success' | 'error';
  /** Error message if failed */
  error?: string;
  /** Preview URL for images */
  previewUrl?: string;
  /** Server response after upload */
  response?: unknown;
}

export interface FileUploaderProps {
  /** Handler when files are selected */
  onFilesSelected: (files: File[]) => void;
  /** Handler when upload completes */
  onUploadComplete?: (file: UploadedFile) => void;
  /** Handler when file is removed */
  onFileRemove?: (file: UploadedFile) => void;
  /** Accepted file types (e.g., "image/*,.pdf") */
  accept?: string;
  /** Maximum file size in bytes */
  maxSize?: number;
  /** Maximum number of files */
  maxFiles?: number;
  /** Allow multiple files */
  multiple?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Custom upload function */
  uploadFn?: (file: File, onProgress: (progress: number) => void) => Promise<unknown>;
  /** Custom className */
  className?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Show file list */
  showFileList?: boolean;
}

export interface FileDropZoneProps {
  /** Drop zone content */
  children?: React.ReactNode;
  /** Handler when files are dropped */
  onDrop: (files: File[]) => void;
  /** Accepted file types */
  accept?: string;
  /** Allow multiple files */
  multiple?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Custom className */
  className?: string;
  /** Custom drag-over className */
  dragActiveClassName?: string;
}

// ============================================================================
// File Type Icons
// ============================================================================

function getFileIcon(mimeType: string): React.ReactNode {
  if (mimeType.startsWith('image/')) return <FileImage className="h-5 w-5" />;
  if (mimeType.startsWith('video/')) return <FileVideo className="h-5 w-5" />;
  if (mimeType.startsWith('audio/')) return <FileAudio className="h-5 w-5" />;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) {
    return <FileSpreadsheet className="h-5 w-5" />;
  }
  if (mimeType.includes('zip') || mimeType.includes('archive') || mimeType.includes('compressed')) {
    return <FileArchive className="h-5 w-5" />;
  }
  if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text')) {
    return <FileText className="h-5 w-5" />;
  }
  if (mimeType.includes('javascript') || mimeType.includes('json') || mimeType.includes('xml')) {
    return <FileCode className="h-5 w-5" />;
  }
  if (mimeType.includes('message/rfc822') || mimeType.includes('application/vnd.ms-outlook')) {
    return <FileText className="h-5 w-5" />;
  }
  return <File className="h-5 w-5" />;
}

// ============================================================================
// File Size Formatting
// ============================================================================

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// ============================================================================
// Generate unique ID
// ============================================================================

function generateId(): string {
  return `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// FileDropZone Component
// ============================================================================

export function FileDropZone({
  children,
  onDrop,
  accept,
  multiple = true,
  disabled = false,
  className,
  dragActiveClassName = 'border-blue-500 bg-blue-50',
}: FileDropZoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragActive(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(false);

      if (disabled) return;

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        onDrop(multiple ? files : [files[0]]);
      }
    },
    [disabled, multiple, onDrop],
  );

  const handleClick = () => {
    if (!disabled) inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      onDrop(multiple ? files : [files[0]]);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  return (
    <div
      onClick={handleClick}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={clsx(
        'relative cursor-pointer transition-colors',
        isDragActive && dragActiveClassName,
        disabled && 'opacity-50 cursor-not-allowed',
        className,
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={handleChange}
        className="hidden"
      />
      {children}
    </div>
  );
}

// ============================================================================
// FileUploader Component
// ============================================================================

export function FileUploader({
  onFilesSelected,
  onUploadComplete,
  onFileRemove,
  accept,
  maxSize,
  maxFiles,
  multiple = true,
  disabled = false,
  uploadFn,
  className,
  placeholder = 'Drag and drop files here, or click to browse',
  showFileList = true,
}: FileUploaderProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);

  const validateFile = useCallback(
    (file: File): string | null => {
      if (maxSize && file.size > maxSize) {
        return `File exceeds maximum size of ${formatFileSize(maxSize)}`;
      }
      if (maxFiles && files.length >= maxFiles) {
        return `Maximum ${maxFiles} files allowed`;
      }
      return null;
    },
    [maxSize, maxFiles, files.length],
  );

  const handleDrop = useCallback(
    async (droppedFiles: File[]) => {
      const newFiles: UploadedFile[] = [];

      for (const file of droppedFiles) {
        const error = validateFile(file);
        const uploadedFile: UploadedFile = {
          id: generateId(),
          file,
          name: file.name,
          size: file.size,
          type: file.type,
          progress: 0,
          status: error ? 'error' : 'pending',
          error: error || undefined,
          previewUrl: file.type.startsWith('image/')
            ? URL.createObjectURL(file)
            : undefined,
        };
        newFiles.push(uploadedFile);
      }

      setFiles((prev) => [...prev, ...newFiles]);
      onFilesSelected(droppedFiles);

      // Auto-upload if uploadFn provided
      if (uploadFn) {
        for (const uploadedFile of newFiles) {
          if (uploadedFile.status === 'pending') {
            uploadFile(uploadedFile);
          }
        }
      }
    },
    [validateFile, onFilesSelected, uploadFn],
  );

  const uploadFile = async (uploadedFile: UploadedFile) => {
    if (!uploadFn) return;

    setFiles((prev) =>
      prev.map((f) =>
        f.id === uploadedFile.id ? { ...f, status: 'uploading' as const } : f,
      ),
    );

    try {
      const response = await uploadFn(uploadedFile.file, (progress) => {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === uploadedFile.id ? { ...f, progress } : f,
          ),
        );
      });

      const completedFile: UploadedFile = {
        ...uploadedFile,
        status: 'success',
        progress: 100,
        response,
      };

      setFiles((prev) =>
        prev.map((f) => (f.id === uploadedFile.id ? completedFile : f)),
      );

      onUploadComplete?.(completedFile);
    } catch (err) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadedFile.id
            ? {
                ...f,
                status: 'error' as const,
                error: err instanceof Error ? err.message : 'Upload failed',
              }
            : f,
        ),
      );
    }
  };

  const removeFile = (file: UploadedFile) => {
    if (file.previewUrl) {
      URL.revokeObjectURL(file.previewUrl);
    }
    setFiles((prev) => prev.filter((f) => f.id !== file.id));
    onFileRemove?.(file);
  };

  const clearAll = () => {
    files.forEach((f) => {
      if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
    });
    setFiles([]);
  };

  return (
    <div className={clsx('space-y-4', className)}>
      {/* Drop Zone */}
      <FileDropZone
        onDrop={handleDrop}
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className={clsx(
          'flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-lg',
          'hover:border-blue-400 hover:bg-blue-50/50',
        )}
      >
        <Upload className="h-10 w-10 text-gray-400 mb-3" />
        <p className="text-sm text-gray-600 text-center">{placeholder}</p>
        <p className="text-xs text-gray-400 mt-1">
          {accept && `Accepted: ${accept}`}
          {maxSize && ` • Max size: ${formatFileSize(maxSize)}`}
          {maxFiles && ` • Max files: ${maxFiles}`}
        </p>
      </FileDropZone>

      {/* File List */}
      {showFileList && files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              {files.length} file{files.length !== 1 ? 's' : ''} selected
            </span>
            <button
              onClick={clearAll}
              className="text-xs text-red-600 hover:text-red-700"
            >
              Clear all
            </button>
          </div>

          <ul className="space-y-2">
            {files.map((file) => (
              <FileListItem
                key={file.id}
                file={file}
                onRemove={() => removeFile(file)}
                onRetry={() => uploadFile(file)}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// FileListItem Component
// ============================================================================

interface FileListItemProps {
  file: UploadedFile;
  onRemove: () => void;
  onRetry?: () => void;
}

function FileListItem({ file, onRemove, onRetry }: FileListItemProps) {
  return (
    <li
      className={clsx(
        'flex items-center gap-3 p-3 bg-gray-50 rounded-lg border',
        file.status === 'error' && 'border-red-200 bg-red-50',
        file.status === 'success' && 'border-green-200',
      )}
    >
      {/* Preview or Icon */}
      {file.previewUrl ? (
        <img
          src={file.previewUrl}
          alt={file.name}
          className="h-10 w-10 object-cover rounded"
        />
      ) : (
        <div className="h-10 w-10 flex items-center justify-center bg-gray-200 rounded text-gray-500">
          {getFileIcon(file.type)}
        </div>
      )}

      {/* File Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-700 truncate">{file.name}</p>
        <p className="text-xs text-gray-500">
          {formatFileSize(file.size)}
          {file.error && (
            <span className="text-red-600 ml-2">• {file.error}</span>
          )}
        </p>

        {/* Progress Bar */}
        {file.status === 'uploading' && (
          <div className="mt-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all"
              style={{ width: `${file.progress}%` }}
            />
          </div>
        )}
      </div>

      {/* Status Icon */}
      <div className="flex items-center gap-2">
        {file.status === 'uploading' && (
          <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
        )}
        {file.status === 'success' && (
          <CheckCircle className="h-4 w-4 text-green-500" />
        )}
        {file.status === 'error' && (
          <>
            <AlertCircle className="h-4 w-4 text-red-500" />
            {onRetry && (
              <button
                onClick={onRetry}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                Retry
              </button>
            )}
          </>
        )}

        {/* Remove Button */}
        <button
          onClick={onRemove}
          className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}

// ============================================================================
// ImageUploader Component (Specialized for images)
// ============================================================================

export interface ImageUploaderProps {
  /** Current image URL */
  value?: string;
  /** Handler when image changes */
  onChange: (file: File | null, previewUrl: string | null) => void;
  /** Accepted image types */
  accept?: string;
  /** Maximum file size */
  maxSize?: number;
  /** Aspect ratio hint */
  aspectRatio?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Custom className */
  className?: string;
}

export function ImageUploader({
  value,
  onChange,
  accept = 'image/*',
  maxSize = 5 * 1024 * 1024, // 5MB
  aspectRatio,
  disabled = false,
  className,
}: ImageUploaderProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(value || null);
  const [error, setError] = useState<string | null>(null);

  const handleDrop = useCallback(
    (files: File[]) => {
      const file = files[0];
      if (!file) return;

      setError(null);

      if (maxSize && file.size > maxSize) {
        setError(`Image must be smaller than ${formatFileSize(maxSize)}`);
        return;
      }

      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }

      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      onChange(file, url);
    },
    [maxSize, onChange],
  );

  const handleRemove = () => {
    if (previewUrl && !value) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    onChange(null, null);
  };

  return (
    <div className={clsx('relative', className)}>
      {previewUrl ? (
        <div className="relative group">
          <img
            src={previewUrl}
            alt="Preview"
            className={clsx(
              'w-full rounded-lg object-cover',
              aspectRatio === '1:1' && 'aspect-square',
              aspectRatio === '16:9' && 'aspect-video',
            )}
          />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
            <button
              onClick={handleRemove}
              disabled={disabled}
              className="p-2 bg-white rounded-full text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </div>
        </div>
      ) : (
        <FileDropZone
          onDrop={handleDrop}
          accept={accept}
          multiple={false}
          disabled={disabled}
          className={clsx(
            'flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-lg',
            'hover:border-blue-400 hover:bg-blue-50/50',
            aspectRatio === '1:1' && 'aspect-square',
            aspectRatio === '16:9' && 'aspect-video',
          )}
        >
          <FileImage className="h-10 w-10 text-gray-400 mb-2" />
          <p className="text-sm text-gray-600">Drop image here or click to upload</p>
          {maxSize && (
            <p className="text-xs text-gray-400 mt-1">
              Max size: {formatFileSize(maxSize)}
            </p>
          )}
        </FileDropZone>
      )}

      {error && (
        <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
          <AlertCircle className="h-4 w-4" />
          {error}
        </p>
      )}
    </div>
  );
}

// ============================================================================
// CSVUploader Component (Specialized for CSV imports)
// ============================================================================

export interface CSVUploaderProps {
  /** Handler when CSV is parsed */
  onData: (data: Record<string, string>[], headers: string[]) => void;
  /** Handler for parse errors */
  onError?: (error: string) => void;
  /** Expected column headers (for validation) */
  expectedHeaders?: string[];
  /** Skip first row as header */
  hasHeader?: boolean;
  /** Custom className */
  className?: string;
}

export function CSVUploader({
  onData,
  onError,
  expectedHeaders,
  hasHeader = true,
  className,
}: CSVUploaderProps) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [rowCount, setRowCount] = useState<number>(0);
  const [headers, setHeaders] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const parseCSV = (text: string): { data: Record<string, string>[]; headers: string[] } => {
    const lines = text.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length === 0) throw new Error('File is empty');

    const headerRow = hasHeader ? lines[0] : null;
    const dataLines = hasHeader ? lines.slice(1) : lines;

    const csvHeaders = headerRow
      ? headerRow.split(',').map((h) => h.trim().replace(/^"|"$/g, ''))
      : dataLines[0].split(',').map((_, i) => `Column ${i + 1}`);

    const data = dataLines.map((line) => {
      const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
      const row: Record<string, string> = {};
      csvHeaders.forEach((header, i) => {
        row[header] = values[i] || '';
      });
      return row;
    });

    return { data, headers: csvHeaders };
  };

  const handleDrop = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file) return;

      setError(null);
      setFileName(file.name);

      if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
        const err = 'Please upload a CSV file';
        setError(err);
        onError?.(err);
        return;
      }

      try {
        const text = await file.text();
        const { data, headers: parsedHeaders } = parseCSV(text);

        // Validate expected headers
        if (expectedHeaders) {
          const missing = expectedHeaders.filter((h) => !parsedHeaders.includes(h));
          if (missing.length > 0) {
            throw new Error(`Missing required columns: ${missing.join(', ')}`);
          }
        }

        setHeaders(parsedHeaders);
        setRowCount(data.length);
        onData(data, parsedHeaders);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to parse CSV';
        setError(message);
        onError?.(message);
      }
    },
    [onData, onError, expectedHeaders, hasHeader],
  );

  return (
    <div className={clsx('space-y-4', className)}>
      <FileDropZone
        onDrop={handleDrop}
        accept=".csv,text/csv"
        multiple={false}
        className={clsx(
          'flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-lg',
          'hover:border-blue-400 hover:bg-blue-50/50',
          error && 'border-red-300 bg-red-50/50',
        )}
      >
        <FileSpreadsheet className="h-10 w-10 text-gray-400 mb-3" />
        <p className="text-sm text-gray-600">
          {fileName ? fileName : 'Drop CSV file here or click to browse'}
        </p>
        {expectedHeaders && (
          <p className="text-xs text-gray-400 mt-1">
            Required columns: {expectedHeaders.join(', ')}
          </p>
        )}
      </FileDropZone>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {!error && fileName && rowCount > 0 && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
          <div className="text-sm text-green-700">
            <p className="font-medium">File loaded successfully</p>
            <p>
              {rowCount} rows, {headers.length} columns
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
