/**
 * FilePreview.tsx - CRITICAL-39
 * 
 * File preview components for the ERP application.
 * Preview images, PDFs, videos, audio, and documents.
 * 
 * Features:
 * - 39.1: Image preview with zoom/pan
 * - 39.2: PDF document viewer
 * - 39.3: Video/audio player
 * - 39.4: Generic file download fallback
 * - 39.5: File info display
 * 
 * @module FilePreview
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
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { clsx } from 'clsx';
import {
  File,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileCode,
  FileSpreadsheet,
  FileArchive,
  Download,
  ExternalLink,
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Play,
  Pause,
  Volume2,
  VolumeX,
  SkipBack,
  SkipForward,
  Loader2,
  AlertCircle,
} from 'lucide-react';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/** File type category */
export type FileCategory = 
  | 'image'
  | 'video'
  | 'audio'
  | 'pdf'
  | 'document'
  | 'spreadsheet'
  | 'code'
  | 'archive'
  | 'other';

/** File info */
export interface FileInfo {
  /** File name */
  name: string;
  /** File URL */
  url: string;
  /** MIME type */
  mimeType?: string;
  /** File size in bytes */
  size?: number;
  /** Last modified date */
  modifiedAt?: Date;
  /** Thumbnail URL */
  thumbnailUrl?: string;
}

/** File preview props */
export interface FilePreviewProps {
  /** File to preview */
  file: FileInfo;
  /** Width */
  width?: number | string;
  /** Height */
  height?: number | string;
  /** Show controls */
  showControls?: boolean;
  /** Show download button */
  showDownload?: boolean;
  /** Show file info */
  showInfo?: boolean;
  /** On close */
  onClose?: () => void;
  /** On download */
  onDownload?: (file: FileInfo) => void;
  /** On error */
  onError?: (error: Error) => void;
  /** Class name */
  className?: string;
}

/** Image preview props */
export interface ImagePreviewProps {
  /** Image URL */
  src: string;
  /** Alt text */
  alt?: string;
  /** Initial zoom level */
  initialZoom?: number;
  /** Min zoom */
  minZoom?: number;
  /** Max zoom */
  maxZoom?: number;
  /** Allow rotation */
  allowRotation?: boolean;
  /** Class name */
  className?: string;
}

/** Video preview props */
export interface VideoPreviewProps {
  /** Video URL */
  src: string;
  /** Poster image */
  poster?: string;
  /** Autoplay */
  autoplay?: boolean;
  /** Muted */
  muted?: boolean;
  /** Loop */
  loop?: boolean;
  /** Show controls */
  showControls?: boolean;
  /** Class name */
  className?: string;
}

// ============================================================================
// UTILITIES
// ============================================================================

/** Get file category from MIME type or extension */
export function getFileCategory(file: FileInfo): FileCategory {
  const mimeType = file.mimeType?.toLowerCase() || '';
  const ext = file.name.split('.').pop()?.toLowerCase() || '';

  // Check MIME type first
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType === 'application/pdf') return 'pdf';

  // Check by extension
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'];
  const videoExts = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'];
  const audioExts = ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a'];
  const docExts = ['doc', 'docx', 'odt', 'rtf', 'txt'];
  const spreadsheetExts = ['xls', 'xlsx', 'ods', 'csv'];
  const codeExts = ['js', 'ts', 'jsx', 'tsx', 'json', 'html', 'css', 'py', 'rb', 'java', 'c', 'cpp', 'go', 'rs'];
  const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'];

  if (imageExts.includes(ext)) return 'image';
  if (videoExts.includes(ext)) return 'video';
  if (audioExts.includes(ext)) return 'audio';
  if (ext === 'pdf') return 'pdf';
  if (docExts.includes(ext)) return 'document';
  if (spreadsheetExts.includes(ext)) return 'spreadsheet';
  if (codeExts.includes(ext)) return 'code';
  if (archiveExts.includes(ext)) return 'archive';

  return 'other';
}

/** Get icon for file category */
export function getFileIcon(category: FileCategory) {
  const icons: Record<FileCategory, typeof File> = {
    image: FileImage,
    video: FileVideo,
    audio: FileAudio,
    pdf: FileText,
    document: FileText,
    spreadsheet: FileSpreadsheet,
    code: FileCode,
    archive: FileArchive,
    other: File,
  };
  return icons[category];
}

/** Format file size */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/** Format duration */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ============================================================================
// 39.1: IMAGE PREVIEW
// ============================================================================

/**
 * Image preview with zoom and pan
 */
export function ImagePreview({
  src,
  alt = '',
  initialZoom = 1,
  minZoom = 0.5,
  maxZoom = 5,
  allowRotation = true,
  className,
}: ImagePreviewProps) {
  const [zoom, setZoom] = useState(initialZoom);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((prev) => Math.min(maxZoom, Math.max(minZoom, prev + delta)));
  }, [minZoom, maxZoom]);

  const handleMouseDown = useCallback((e: ReactMouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  }, [zoom, position]);

  const handleMouseMove = useCallback((e: ReactMouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const zoomIn = () => setZoom((prev) => Math.min(maxZoom, prev + 0.25));
  const zoomOut = () => setZoom((prev) => Math.max(minZoom, prev - 0.25));
  const resetZoom = () => { setZoom(1); setPosition({ x: 0, y: 0 }); };
  const rotate = () => setRotation((prev) => (prev + 90) % 360);

  return (
    <div className={clsx('relative flex flex-col', className)}>
      {/* Controls */}
      <div className="flex items-center justify-center gap-2 p-2 bg-black/50 rounded-t-lg">
        <button
          onClick={zoomOut}
          disabled={zoom <= minZoom}
          className="p-1.5 rounded text-white hover:bg-white/20 disabled:opacity-50"
          title="Zoom out"
        >
          <ZoomOut className="w-5 h-5" />
        </button>
        <span className="text-white text-sm min-w-[4rem] text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={zoomIn}
          disabled={zoom >= maxZoom}
          className="p-1.5 rounded text-white hover:bg-white/20 disabled:opacity-50"
          title="Zoom in"
        >
          <ZoomIn className="w-5 h-5" />
        </button>
        <div className="w-px h-6 bg-white/30 mx-1" />
        <button
          onClick={resetZoom}
          className="p-1.5 rounded text-white hover:bg-white/20"
          title="Reset zoom"
        >
          <Maximize2 className="w-5 h-5" />
        </button>
        {allowRotation && (
          <button
            onClick={rotate}
            className="p-1.5 rounded text-white hover:bg-white/20"
            title="Rotate"
          >
            <RotateCw className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Image container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden bg-gray-900 cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-white" />
          </div>
        )}
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
            <AlertCircle className="w-12 h-12 mb-2 text-red-400" />
            <p>{error}</p>
          </div>
        ) : (
          <img
            src={src}
            alt={alt}
            onLoad={() => setIsLoading(false)}
            onError={() => { setIsLoading(false); setError('Failed to load image'); }}
            className="max-w-none transition-transform duration-150"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotation}deg)`,
              opacity: isLoading ? 0 : 1,
            }}
            draggable={false}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 39.3: VIDEO PREVIEW
// ============================================================================

/**
 * Video player with custom controls
 */
export function VideoPreview({
  src,
  poster,
  autoplay = false,
  muted = false,
  loop = false,
  showControls = true,
  className,
}: VideoPreviewProps) {
  const [isPlaying, setIsPlaying] = useState(autoplay);
  const [isMuted, setIsMuted] = useState(muted);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const seek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const skip = (seconds: number) => {
    if (videoRef.current) {
      const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
      seek(newTime);
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      setIsLoading(false);
    };
    const handleEnded = () => setIsPlaying(false);
    const handleError = () => {
      setIsLoading(false);
      setError('Failed to load video');
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', handleError);
    };
  }, []);

  return (
    <div className={clsx('relative bg-black rounded-lg overflow-hidden', className)}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-white" />
        </div>
      )}

      {error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
          <AlertCircle className="w-12 h-12 mb-2 text-red-400" />
          <p>{error}</p>
        </div>
      ) : (
        <>
          <video
            ref={videoRef}
            src={src}
            poster={poster}
            autoPlay={autoplay}
            muted={muted}
            loop={loop}
            className="w-full h-full object-contain"
            onClick={togglePlay}
          />

          {showControls && !isLoading && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 p-4">
              {/* Progress bar */}
              <div
                className="h-1 bg-white/30 rounded-full mb-3 cursor-pointer"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const percent = (e.clientX - rect.left) / rect.width;
                  seek(percent * duration);
                }}
              >
                <div
                  className="h-full bg-white rounded-full"
                  style={{ width: `${(currentTime / duration) * 100}%` }}
                />
              </div>

              {/* Controls */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => skip(-10)}
                  className="p-1 text-white hover:text-gray-300"
                >
                  <SkipBack className="w-5 h-5" />
                </button>
                <button
                  onClick={togglePlay}
                  className="p-2 bg-white/20 rounded-full text-white hover:bg-white/30"
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5" />
                  ) : (
                    <Play className="w-5 h-5" />
                  )}
                </button>
                <button
                  onClick={() => skip(10)}
                  className="p-1 text-white hover:text-gray-300"
                >
                  <SkipForward className="w-5 h-5" />
                </button>

                <span className="text-white text-sm">
                  {formatDuration(currentTime)} / {formatDuration(duration)}
                </span>

                <div className="flex-1" />

                <button
                  onClick={toggleMute}
                  className="p-1 text-white hover:text-gray-300"
                >
                  {isMuted ? (
                    <VolumeX className="w-5 h-5" />
                  ) : (
                    <Volume2 className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================================
// 39.3: AUDIO PREVIEW
// ============================================================================

interface AudioPreviewProps {
  src: string;
  title?: string;
  artist?: string;
  cover?: string;
  autoplay?: boolean;
  className?: string;
}

/**
 * Audio player component
 */
export function AudioPreview({
  src,
  title,
  artist,
  cover,
  autoplay = false,
  className,
}: AudioPreviewProps) {
  const [isPlaying, setIsPlaying] = useState(autoplay);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const audioRef = useRef<HTMLAudioElement>(null);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoading(false);
    };
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  return (
    <div className={clsx(
      'flex items-center gap-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg',
      className
    )}>
      <audio ref={audioRef} src={src} autoPlay={autoplay} />

      {/* Cover or icon */}
      <div className="flex-shrink-0">
        {cover ? (
          <img src={cover} alt={title} className="w-16 h-16 rounded-lg object-cover" />
        ) : (
          <div className="w-16 h-16 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
            <FileAudio className="w-8 h-8 text-gray-400" />
          </div>
        )}
      </div>

      {/* Info and controls */}
      <div className="flex-1 min-w-0">
        {title && (
          <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
            {title}
          </p>
        )}
        {artist && (
          <p className="text-sm text-gray-500 truncate">{artist}</p>
        )}

        {/* Progress */}
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={togglePlay}
            disabled={isLoading}
            className="p-1 text-gray-600 dark:text-gray-300 hover:text-gray-900"
          >
            {isPlaying ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5" />
            )}
          </button>

          <div
            className="flex-1 h-1 bg-gray-300 dark:bg-gray-600 rounded-full cursor-pointer"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const percent = (e.clientX - rect.left) / rect.width;
              if (audioRef.current) {
                audioRef.current.currentTime = percent * duration;
              }
            }}
          >
            <div
              className="h-full bg-blue-500 rounded-full"
              style={{ width: `${(currentTime / duration) * 100}%` }}
            />
          </div>

          <span className="text-xs text-gray-500 min-w-[4rem] text-right">
            {formatDuration(currentTime)} / {formatDuration(duration)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 39.2: PDF PREVIEW
// ============================================================================

interface PdfPreviewProps {
  src: string;
  className?: string;
}

/**
 * PDF viewer using iframe
 */
export function PdfPreview({ src, className }: PdfPreviewProps) {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <div className={clsx('relative', className)}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      )}
      <iframe
        src={src}
        onLoad={() => setIsLoading(false)}
        className="w-full h-full border-0"
        title="PDF Preview"
      />
    </div>
  );
}

// ============================================================================
// 39.4-39.5: FILE PREVIEW (MAIN)
// ============================================================================

/**
 * Universal file preview component
 */
export function FilePreview({
  file,
  width = '100%',
  height = 400,
  showControls = true,
  showDownload = true,
  showInfo = true,
  onClose,
  onDownload,
  onError,
  className,
}: FilePreviewProps) {
  const category = getFileCategory(file);
  const Icon = getFileIcon(category);

  const handleDownload = () => {
    if (onDownload) {
      onDownload(file);
    } else {
      // Default download behavior
      const link = document.createElement('a');
      link.href = file.url;
      link.download = file.name;
      link.click();
    }
  };

  const renderPreview = () => {
    switch (category) {
      case 'image':
        return (
          <ImagePreview
            src={file.url}
            alt={file.name}
            className="w-full h-full"
          />
        );

      case 'video':
        return (
          <VideoPreview
            src={file.url}
            showControls={showControls}
            className="w-full h-full"
          />
        );

      case 'audio':
        return (
          <AudioPreview
            src={file.url}
            title={file.name}
            className="w-full"
          />
        );

      case 'pdf':
        return (
          <PdfPreview
            src={file.url}
            className="w-full h-full"
          />
        );

      default:
        // Generic file display
        return (
          <div className="flex flex-col items-center justify-center h-full p-8 bg-gray-50 dark:bg-gray-800">
            <Icon className="w-16 h-16 text-gray-400 mb-4" />
            <p className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              {file.name}
            </p>
            {file.size && (
              <p className="text-sm text-gray-500 mb-4">
                {formatFileSize(file.size)}
              </p>
            )}
            <p className="text-sm text-gray-500 mb-4">
              This file type cannot be previewed
            </p>
            {showDownload && (
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
            )}
          </div>
        );
    }
  };

  return (
    <div
      className={clsx('relative overflow-hidden rounded-lg border', className)}
      style={{ width, height }}
    >
      {/* Header */}
      {(showInfo || showDownload || onClose) && (
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center gap-2 p-2 bg-black/50">
          <Icon className="w-4 h-4 text-white" />
          <span className="flex-1 text-sm text-white truncate">{file.name}</span>
          {file.size && showInfo && (
            <span className="text-xs text-white/70">{formatFileSize(file.size)}</span>
          )}
          {showDownload && (
            <button
              onClick={handleDownload}
              className="p-1 text-white hover:bg-white/20 rounded"
              title="Download"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-white hover:bg-white/20 rounded"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Preview content */}
      <div className={clsx(
        'w-full h-full',
        (showInfo || showDownload || onClose) && 'pt-10'
      )}>
        {renderPreview()}
      </div>
    </div>
  );
}

// ============================================================================
// FILE THUMBNAIL
// ============================================================================

interface FileThumbnailProps {
  file: FileInfo;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  className?: string;
}

/**
 * File thumbnail with icon or preview image
 */
export function FileThumbnail({
  file,
  size = 'md',
  onClick,
  className,
}: FileThumbnailProps) {
  const category = getFileCategory(file);
  const Icon = getFileIcon(category);
  const hasPreview = file.thumbnailUrl || category === 'image';

  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-20 h-20',
    lg: 'w-32 h-32',
  };

  const iconSizes = {
    sm: 'w-5 h-5',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div
      onClick={onClick}
      className={clsx(
        'relative rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800',
        sizeClasses[size],
        onClick && 'cursor-pointer hover:ring-2 hover:ring-blue-500',
        className
      )}
    >
      {hasPreview ? (
        <img
          src={file.thumbnailUrl || file.url}
          alt={file.name}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Icon className={clsx('text-gray-400', iconSizes[size])} />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// FILE LIST ITEM
// ============================================================================

interface FileListItemProps {
  file: FileInfo;
  onPreview?: () => void;
  onDownload?: () => void;
  onRemove?: () => void;
  className?: string;
}

/**
 * File list item with actions
 */
export function FileListItem({
  file,
  onPreview,
  onDownload,
  onRemove,
  className,
}: FileListItemProps) {
  const category = getFileCategory(file);
  const Icon = getFileIcon(category);

  return (
    <div className={clsx(
      'flex items-center gap-3 p-3 rounded-lg',
      'bg-white dark:bg-gray-800 border',
      className
    )}>
      <FileThumbnail file={file} size="sm" />
      
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
          {file.name}
        </p>
        <p className="text-xs text-gray-500">
          {file.size && formatFileSize(file.size)}
          {file.modifiedAt && ` • ${file.modifiedAt.toLocaleDateString()}`}
        </p>
      </div>

      <div className="flex items-center gap-1">
        {onPreview && (
          <button
            onClick={onPreview}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
            title="Preview"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        )}
        {onDownload && (
          <button
            onClick={onDownload}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
            title="Download"
          >
            <Download className="w-4 h-4" />
          </button>
        )}
        {onRemove && (
          <button
            onClick={onRemove}
            className="p-1.5 text-gray-400 hover:text-red-600 rounded"
            title="Remove"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// FILE PREVIEW MODAL
// ============================================================================

interface FilePreviewModalProps {
  file: FileInfo | null;
  isOpen: boolean;
  onClose: () => void;
  onDownload?: (file: FileInfo) => void;
}

/**
 * Modal for file preview
 */
export function FilePreviewModal({
  file,
  isOpen,
  onClose,
  onDownload,
}: FilePreviewModalProps) {
  if (!isOpen || !file) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80"
        onClick={onClose}
      />

      {/* Content */}
      <div className="relative z-10 w-full max-w-4xl max-h-[90vh] m-4">
        <FilePreview
          file={file}
          height="80vh"
          onClose={onClose}
          onDownload={onDownload}
          className="bg-white dark:bg-gray-900"
        />
      </div>
    </div>
  );
}

// ============================================================================
// EXPORTS - Types are exported inline at their definitions
// ============================================================================
