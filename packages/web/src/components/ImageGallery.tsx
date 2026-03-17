/**
 * ImageGallery.tsx - CRITICAL-34
 * 
 * Image gallery component with lightbox for the ERP application.
 * Displays image collections with zoom, navigation, and thumbnails.
 * 
 * Features:
 * - 34.1: Grid gallery layout
 * - 34.2: Lightbox modal with zoom
 * - 34.3: Thumbnail navigation
 * - 34.4: Keyboard navigation
 * - 34.5: Touch/swipe support
 * 
 * @module ImageGallery
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
  type KeyboardEvent,
  type MouseEvent,
  type TouchEvent,
} from 'react';
import { clsx } from 'clsx';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  Maximize2,
  Minimize2,
  Grid,
  Play,
  Pause,
} from 'lucide-react';
import { createPortal } from 'react-dom';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/** Image item */
export interface GalleryImage {
  /** Unique id */
  id: string;
  /** Image source URL */
  src: string;
  /** Thumbnail URL (optional) */
  thumbnail?: string;
  /** Alt text */
  alt?: string;
  /** Title/caption */
  title?: string;
  /** Description */
  description?: string;
  /** Width (for layout) */
  width?: number;
  /** Height (for layout) */
  height?: number;
}

/** Gallery context */
export interface GalleryContextValue {
  /** Images */
  images: GalleryImage[];
  /** Current image index */
  currentIndex: number;
  /** Is lightbox open */
  isOpen: boolean;
  /** Zoom level */
  zoom: number;
  /** Rotation */
  rotation: number;
  /** Is fullscreen */
  isFullscreen: boolean;
  /** Is slideshow playing */
  isPlaying: boolean;
  /** Open lightbox */
  openLightbox: (index: number) => void;
  /** Close lightbox */
  closeLightbox: () => void;
  /** Go to image */
  goToImage: (index: number) => void;
  /** Go to next */
  goToNext: () => void;
  /** Go to previous */
  goToPrevious: () => void;
  /** Set zoom */
  setZoom: (zoom: number) => void;
  /** Zoom in */
  zoomIn: () => void;
  /** Zoom out */
  zoomOut: () => void;
  /** Reset zoom */
  resetZoom: () => void;
  /** Rotate */
  rotate: () => void;
  /** Toggle fullscreen */
  toggleFullscreen: () => void;
  /** Toggle slideshow */
  toggleSlideshow: () => void;
}

/** Image gallery props */
export interface ImageGalleryProps {
  /** Images to display */
  images: GalleryImage[];
  /** Gallery layout */
  layout?: 'grid' | 'masonry' | 'list' | 'carousel';
  /** Columns (for grid) */
  columns?: number | { sm?: number; md?: number; lg?: number };
  /** Gap between images */
  gap?: number;
  /** Enable lightbox */
  lightbox?: boolean;
  /** Slideshow interval (ms) */
  slideshowInterval?: number;
  /** Show thumbnails in lightbox */
  showThumbnails?: boolean;
  /** Show captions */
  showCaptions?: boolean;
  /** Image fit */
  objectFit?: 'cover' | 'contain' | 'fill';
  /** Aspect ratio */
  aspectRatio?: string;
  /** On image click */
  onImageClick?: (image: GalleryImage, index: number) => void;
  /** On image load */
  onImageLoad?: (image: GalleryImage) => void;
  /** On image error */
  onImageError?: (image: GalleryImage) => void;
  /** Loading placeholder */
  loadingPlaceholder?: ReactNode;
  /** Error placeholder */
  errorPlaceholder?: ReactNode;
  /** Class name */
  className?: string;
  /** Image class */
  imageClassName?: string;
}

/** Lightbox props */
export interface LightboxProps {
  /** Images */
  images: GalleryImage[];
  /** Initial index */
  initialIndex?: number;
  /** Is open */
  isOpen: boolean;
  /** On close */
  onClose: () => void;
  /** Show thumbnails */
  showThumbnails?: boolean;
  /** Show controls */
  showControls?: boolean;
  /** Slideshow interval */
  slideshowInterval?: number;
  /** Enable zoom */
  enableZoom?: boolean;
  /** Enable rotation */
  enableRotation?: boolean;
  /** Enable download */
  enableDownload?: boolean;
  /** On change */
  onChange?: (index: number) => void;
}

// ============================================================================
// CONTEXT
// ============================================================================

const GalleryContext = createContext<GalleryContextValue | null>(null);

function useGalleryContext(): GalleryContextValue {
  const context = useContext(GalleryContext);
  if (!context) {
    throw new Error('useGalleryContext must be used within an ImageGallery');
  }
  return context;
}

/** Hook to access gallery context */
export function useImageGallery(): GalleryContextValue {
  return useGalleryContext();
}

// ============================================================================
// UTILITIES
// ============================================================================

/** Get responsive columns */
function getResponsiveColumns(
  columns: number | { sm?: number; md?: number; lg?: number }
): string {
  if (typeof columns === 'number') {
    return `repeat(${columns}, minmax(0, 1fr))`;
  }

  // Return base columns, CSS media queries handle responsive
  return `repeat(${columns.sm || 2}, minmax(0, 1fr))`;
}

// ============================================================================
// 34.1: GRID GALLERY
// ============================================================================

/**
 * Image gallery with grid layout
 * 
 * @example
 * ```tsx
 * const images = [
 *   { id: '1', src: '/image1.jpg', alt: 'Image 1' },
 *   { id: '2', src: '/image2.jpg', alt: 'Image 2' },
 * ];
 * 
 * <ImageGallery images={images} columns={3} lightbox />
 * ```
 */
export function ImageGallery({
  images,
  layout = 'grid',
  columns = 3,
  gap = 4,
  lightbox = true,
  slideshowInterval = 3000,
  showThumbnails = true,
  showCaptions = false,
  objectFit = 'cover',
  aspectRatio = '1/1',
  onImageClick,
  onImageLoad,
  onImageError,
  loadingPlaceholder,
  errorPlaceholder,
  className,
  imageClassName,
}: ImageGalleryProps) {
  // State
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // Lightbox handlers
  const openLightbox = useCallback((index: number) => {
    if (lightbox) {
      setCurrentIndex(index);
      setIsOpen(true);
    }
  }, [lightbox]);

  const closeLightbox = useCallback(() => {
    setIsOpen(false);
    setZoom(1);
    setRotation(0);
    setIsPlaying(false);
  }, []);

  const goToImage = useCallback((index: number) => {
    const newIndex = Math.max(0, Math.min(images.length - 1, index));
    setCurrentIndex(newIndex);
    setZoom(1);
    setRotation(0);
  }, [images.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
    setZoom(1);
    setRotation(0);
  }, [images.length]);

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    setZoom(1);
    setRotation(0);
  }, [images.length]);

  const zoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + 0.25, 4));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - 0.25, 0.25));
  }, []);

  const resetZoom = useCallback(() => {
    setZoom(1);
  }, []);

  const rotate = useCallback(() => {
    setRotation((prev) => (prev + 90) % 360);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  const toggleSlideshow = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  // Context value
  const contextValue = useMemo<GalleryContextValue>(() => ({
    images,
    currentIndex,
    isOpen,
    zoom,
    rotation,
    isFullscreen,
    isPlaying,
    openLightbox,
    closeLightbox,
    goToImage,
    goToNext,
    goToPrevious,
    setZoom,
    zoomIn,
    zoomOut,
    resetZoom,
    rotate,
    toggleFullscreen,
    toggleSlideshow,
  }), [
    images,
    currentIndex,
    isOpen,
    zoom,
    rotation,
    isFullscreen,
    isPlaying,
    openLightbox,
    closeLightbox,
    goToImage,
    goToNext,
    goToPrevious,
    zoomIn,
    zoomOut,
    resetZoom,
    rotate,
    toggleFullscreen,
    toggleSlideshow,
  ]);

  // Click handler
  const handleImageClick = useCallback((image: GalleryImage, index: number) => {
    onImageClick?.(image, index);
    openLightbox(index);
  }, [onImageClick, openLightbox]);

  // Layout styles
  const gridStyle = useMemo(() => {
    if (layout === 'grid') {
      return {
        display: 'grid',
        gridTemplateColumns: getResponsiveColumns(columns),
        gap: `${gap * 4}px`,
      };
    }
    return {};
  }, [layout, columns, gap]);

  return (
    <GalleryContext.Provider value={contextValue}>
      {/* Gallery grid */}
      <div className={clsx('relative', className)} style={gridStyle}>
        {layout === 'masonry' ? (
          // Masonry layout using CSS columns
          <div
            className="w-full"
            style={{
              columnCount: typeof columns === 'number' ? columns : 3,
              columnGap: `${gap * 4}px`,
            }}
          >
            {images.map((image, index) => (
              <GalleryImageItem
                key={image.id}
                image={image}
                index={index}
                objectFit={objectFit}
                showCaption={showCaptions}
                onClick={handleImageClick}
                onLoad={onImageLoad}
                onError={onImageError}
                loadingPlaceholder={loadingPlaceholder}
                errorPlaceholder={errorPlaceholder}
                className={clsx(imageClassName, 'mb-4 break-inside-avoid')}
              />
            ))}
          </div>
        ) : layout === 'list' ? (
          // List layout
          <div className="flex flex-col" style={{ gap: `${gap * 4}px` }}>
            {images.map((image, index) => (
              <GalleryImageItem
                key={image.id}
                image={image}
                index={index}
                objectFit={objectFit}
                aspectRatio="16/9"
                showCaption={showCaptions}
                onClick={handleImageClick}
                onLoad={onImageLoad}
                onError={onImageError}
                loadingPlaceholder={loadingPlaceholder}
                errorPlaceholder={errorPlaceholder}
                className={imageClassName}
              />
            ))}
          </div>
        ) : layout === 'carousel' ? (
          // Carousel layout
          <GalleryCarousel
            images={images}
            objectFit={objectFit}
            showCaption={showCaptions}
            onClick={handleImageClick}
            className={imageClassName}
          />
        ) : (
          // Grid layout (default)
          images.map((image, index) => (
            <GalleryImageItem
              key={image.id}
              image={image}
              index={index}
              objectFit={objectFit}
              aspectRatio={aspectRatio}
              showCaption={showCaptions}
              onClick={handleImageClick}
              onLoad={onImageLoad}
              onError={onImageError}
              loadingPlaceholder={loadingPlaceholder}
              errorPlaceholder={errorPlaceholder}
              className={imageClassName}
            />
          ))
        )}
      </div>

      {/* Lightbox */}
      {lightbox && isOpen && (
        <Lightbox
          images={images}
          initialIndex={currentIndex}
          isOpen={isOpen}
          onClose={closeLightbox}
          showThumbnails={showThumbnails}
          slideshowInterval={slideshowInterval}
        />
      )}
    </GalleryContext.Provider>
  );
}

// ============================================================================
// GALLERY IMAGE ITEM
// ============================================================================

interface GalleryImageItemProps {
  image: GalleryImage;
  index: number;
  objectFit?: 'cover' | 'contain' | 'fill';
  aspectRatio?: string;
  showCaption?: boolean;
  onClick?: (image: GalleryImage, index: number) => void;
  onLoad?: (image: GalleryImage) => void;
  onError?: (image: GalleryImage) => void;
  loadingPlaceholder?: ReactNode;
  errorPlaceholder?: ReactNode;
  className?: string;
}

function GalleryImageItem({
  image,
  index,
  objectFit = 'cover',
  aspectRatio,
  showCaption,
  onClick,
  onLoad,
  onError,
  loadingPlaceholder,
  errorPlaceholder,
  className,
}: GalleryImageItemProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
    onLoad?.(image);
  }, [image, onLoad]);

  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
    onError?.(image);
  }, [image, onError]);

  return (
    <div
      className={clsx(
        'relative group overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800',
        'cursor-pointer transition-transform hover:scale-[1.02]',
        className
      )}
      style={{ aspectRatio }}
      onClick={() => onClick?.(image, index)}
    >
      {/* Loading state */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          {loadingPlaceholder || (
            <div className="w-8 h-8 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
          )}
        </div>
      )}

      {/* Error state */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center">
          {errorPlaceholder || (
            <div className="text-gray-400 text-sm">Failed to load</div>
          )}
        </div>
      )}

      {/* Image */}
      <img
        src={image.thumbnail || image.src}
        alt={image.alt || ''}
        className={clsx(
          'w-full h-full transition-opacity',
          isLoading && 'opacity-0',
          !isLoading && 'opacity-100',
          objectFit === 'cover' && 'object-cover',
          objectFit === 'contain' && 'object-contain',
          objectFit === 'fill' && 'object-fill'
        )}
        loading="lazy"
        onLoad={handleLoad}
        onError={handleError}
      />

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors">
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <ZoomIn className="w-8 h-8 text-white" />
        </div>
      </div>

      {/* Caption */}
      {showCaption && image.title && (
        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent">
          <p className="text-white text-sm font-medium truncate">{image.title}</p>
          {image.description && (
            <p className="text-white/80 text-xs truncate">{image.description}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// GALLERY CAROUSEL
// ============================================================================

interface GalleryCarouselProps {
  images: GalleryImage[];
  objectFit?: 'cover' | 'contain' | 'fill';
  showCaption?: boolean;
  onClick?: (image: GalleryImage, index: number) => void;
  className?: string;
}

function GalleryCarousel({
  images,
  objectFit,
  showCaption,
  onClick,
  className,
}: GalleryCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  }, [images.length]);

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  return (
    <div className="relative">
      {/* Main image */}
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-lg"
        style={{ aspectRatio: '16/9' }}
      >
        <div
          className="flex transition-transform duration-300"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {images.map((image, index) => (
            <div
              key={image.id}
              className="w-full flex-shrink-0"
              onClick={() => onClick?.(image, index)}
            >
              <GalleryImageItem
                image={image}
                index={index}
                objectFit={objectFit}
                aspectRatio="16/9"
                showCaption={showCaption}
                className={className}
              />
            </div>
          ))}
        </div>

        {/* Navigation arrows */}
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); goToPrevious(); }}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/80 hover:bg-white shadow-lg"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); goToNext(); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/80 hover:bg-white shadow-lg"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2 mt-2 justify-center">
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setCurrentIndex(index)}
              className={clsx(
                'w-12 h-12 rounded overflow-hidden ring-2 ring-offset-2 transition-all',
                index === currentIndex
                  ? 'ring-blue-500'
                  : 'ring-transparent opacity-60 hover:opacity-100'
              )}
            >
              <img
                src={image.thumbnail || image.src}
                alt=""
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 34.2-34.5: LIGHTBOX
// ============================================================================

/**
 * Lightbox modal for viewing images
 * 
 * @example
 * ```tsx
 * <Lightbox
 *   images={images}
 *   isOpen={isOpen}
 *   onClose={handleClose}
 *   showThumbnails
 * />
 * ```
 */
export function Lightbox({
  images,
  initialIndex = 0,
  isOpen,
  onClose,
  showThumbnails = true,
  showControls = true,
  slideshowInterval = 3000,
  enableZoom = true,
  enableRotation = true,
  enableDownload = true,
  onChange,
}: LightboxProps) {
  // State
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      setZoom(1);
      setRotation(0);
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen, initialIndex]);

  // Slideshow
  useEffect(() => {
    if (!isPlaying || !isOpen) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
      setZoom(1);
      setRotation(0);
      setPosition({ x: 0, y: 0 });
    }, slideshowInterval);

    return () => clearInterval(timer);
  }, [isPlaying, isOpen, images.length, slideshowInterval]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          goToPrevious();
          break;
        case 'ArrowRight':
          goToNext();
          break;
        case '+':
        case '=':
          zoomIn();
          break;
        case '-':
          zoomOut();
          break;
        case 'r':
          rotate();
          break;
        case ' ':
          e.preventDefault();
          setIsPlaying((prev) => !prev);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Navigation
  const goToNext = useCallback(() => {
    const newIndex = (currentIndex + 1) % images.length;
    setCurrentIndex(newIndex);
    setZoom(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
    onChange?.(newIndex);
  }, [currentIndex, images.length, onChange]);

  const goToPrevious = useCallback(() => {
    const newIndex = (currentIndex - 1 + images.length) % images.length;
    setCurrentIndex(newIndex);
    setZoom(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
    onChange?.(newIndex);
  }, [currentIndex, images.length, onChange]);

  const goToImage = useCallback((index: number) => {
    setCurrentIndex(index);
    setZoom(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
    onChange?.(index);
  }, [onChange]);

  // Zoom
  const zoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + 0.5, 4));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((prev) => {
      const newZoom = Math.max(prev - 0.5, 1);
      if (newZoom === 1) setPosition({ x: 0, y: 0 });
      return newZoom;
    });
  }, []);

  const resetZoom = useCallback(() => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const rotate = useCallback(() => {
    setRotation((prev) => (prev + 90) % 360);
  }, []);

  // Download
  const download = useCallback(async () => {
    const image = images[currentIndex];
    if (!image) return;

    try {
      const response = await fetch(image.src);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = image.title || `image-${currentIndex + 1}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
    }
  }, [images, currentIndex]);

  // Pan handlers for zoomed image
  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  }, [zoom, position]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging && zoom > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  }, [isDragging, zoom, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Touch handlers for swipe
  const handleTouchStart = useCallback((e: TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  }, []);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (!touchStartRef.current || zoom > 1) return;

    const touchEnd = {
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY,
    };

    const diff = touchEnd.x - touchStartRef.current.x;
    const threshold = 50;

    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        goToPrevious();
      } else {
        goToNext();
      }
    }

    touchStartRef.current = null;
  }, [zoom, goToPrevious, goToNext]);

  // Current image
  const currentImage = images[currentIndex];

  if (!isOpen || !currentImage) return null;

  return createPortal(
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-black/95 flex flex-col"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <div className="text-white">
          <span className="font-medium">{currentIndex + 1}</span>
          <span className="text-white/60"> / {images.length}</span>
          {currentImage.title && (
            <span className="ml-4">{currentImage.title}</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {showControls && (
            <>
              {/* Slideshow toggle */}
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-2 text-white/80 hover:text-white rounded-lg hover:bg-white/10"
                title={isPlaying ? 'Pause slideshow' : 'Start slideshow'}
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </button>

              {/* Zoom controls */}
              {enableZoom && (
                <>
                  <button
                    type="button"
                    onClick={zoomOut}
                    disabled={zoom <= 1}
                    className="p-2 text-white/80 hover:text-white disabled:opacity-30 rounded-lg hover:bg-white/10"
                    title="Zoom out"
                  >
                    <ZoomOut className="w-5 h-5" />
                  </button>
                  <span className="text-white/60 text-sm w-12 text-center">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={zoomIn}
                    disabled={zoom >= 4}
                    className="p-2 text-white/80 hover:text-white disabled:opacity-30 rounded-lg hover:bg-white/10"
                    title="Zoom in"
                  >
                    <ZoomIn className="w-5 h-5" />
                  </button>
                </>
              )}

              {/* Rotate */}
              {enableRotation && (
                <button
                  type="button"
                  onClick={rotate}
                  className="p-2 text-white/80 hover:text-white rounded-lg hover:bg-white/10"
                  title="Rotate"
                >
                  <RotateCw className="w-5 h-5" />
                </button>
              )}

              {/* Download */}
              {enableDownload && (
                <button
                  type="button"
                  onClick={download}
                  className="p-2 text-white/80 hover:text-white rounded-lg hover:bg-white/10"
                  title="Download"
                >
                  <Download className="w-5 h-5" />
                </button>
              )}

              <div className="w-px h-6 bg-white/20 mx-2" />
            </>
          )}

          {/* Close */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white rounded-lg hover:bg-white/10"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main image area */}
      <div className="flex-1 relative overflow-hidden">
        {/* Navigation arrows */}
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={goToPrevious}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white z-10"
            >
              <ChevronLeft className="w-8 h-8" />
            </button>
            <button
              type="button"
              onClick={goToNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white z-10"
            >
              <ChevronRight className="w-8 h-8" />
            </button>
          </>
        )}

        {/* Image */}
        <div
          className={clsx(
            'w-full h-full flex items-center justify-center',
            zoom > 1 ? 'cursor-grab' : 'cursor-default',
            isDragging && 'cursor-grabbing'
          )}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onDoubleClick={() => zoom > 1 ? resetZoom() : zoomIn()}
        >
          <img
            src={currentImage.src}
            alt={currentImage.alt || ''}
            className="max-w-full max-h-full object-contain transition-transform select-none"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotation}deg)`,
            }}
            draggable={false}
          />
        </div>

        {/* Caption */}
        {currentImage.description && (
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent text-center">
            <p className="text-white">{currentImage.description}</p>
          </div>
        )}
      </div>

      {/* Thumbnails */}
      {showThumbnails && images.length > 1 && (
        <div className="p-4 bg-black/50">
          <div className="flex gap-2 justify-center overflow-x-auto">
            {images.map((image, index) => (
              <button
                key={image.id}
                type="button"
                onClick={() => goToImage(index)}
                className={clsx(
                  'flex-shrink-0 w-16 h-16 rounded overflow-hidden transition-all',
                  index === currentIndex
                    ? 'ring-2 ring-white ring-offset-2 ring-offset-black'
                    : 'opacity-50 hover:opacity-100'
                )}
              >
                <img
                  src={image.thumbnail || image.src}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}

// ============================================================================
// THUMBNAIL STRIP
// ============================================================================

interface ThumbnailStripProps {
  images: GalleryImage[];
  currentIndex?: number;
  onSelect?: (index: number) => void;
  size?: 'sm' | 'md' | 'lg';
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

/**
 * Thumbnail strip for navigation
 */
export function ThumbnailStrip({
  images,
  currentIndex = 0,
  onSelect,
  size = 'md',
  orientation = 'horizontal',
  className,
}: ThumbnailStripProps) {
  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-16 h-16',
    lg: 'w-24 h-24',
  };

  return (
    <div
      className={clsx(
        'flex gap-2 overflow-auto',
        orientation === 'vertical' && 'flex-col',
        className
      )}
    >
      {images.map((image, index) => (
        <button
          key={image.id}
          type="button"
          onClick={() => onSelect?.(index)}
          className={clsx(
            'flex-shrink-0 rounded overflow-hidden transition-all',
            sizeClasses[size],
            index === currentIndex
              ? 'ring-2 ring-blue-500 ring-offset-2'
              : 'opacity-60 hover:opacity-100'
          )}
        >
          <img
            src={image.thumbnail || image.src}
            alt={image.alt || ''}
            className="w-full h-full object-cover"
          />
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// EXPORTS - Types are exported inline at their definitions
// ============================================================================
