/**
 * Carousel.tsx - CRITICAL-28
 * 
 * Image/content carousel component for the ERP application.
 * Provides smooth sliding transitions with navigation controls.
 * 
 * Features:
 * - 28.1: Basic carousel with prev/next navigation
 * - 28.2: Dot indicators and thumbnails
 * - 28.3: Autoplay with pause on hover
 * - 28.4: Touch/swipe support
 * - 28.5: Keyboard navigation and accessibility
 * 
 * @module Carousel
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
  type KeyboardEvent,
} from 'react';
import { clsx } from 'clsx';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/** Carousel item */
export interface CarouselItem {
  /** Unique identifier */
  id: string;
  /** Content to render */
  content: ReactNode;
  /** Optional thumbnail for navigation */
  thumbnail?: string;
  /** Alt text for accessibility */
  alt?: string;
}

/** Carousel context value */
export interface CarouselContextValue {
  /** Current slide index */
  currentIndex: number;
  /** Total slides */
  totalSlides: number;
  /** Go to specific slide */
  goTo: (index: number) => void;
  /** Go to next slide */
  next: () => void;
  /** Go to previous slide */
  prev: () => void;
  /** Is autoplay active */
  isPlaying: boolean;
  /** Toggle autoplay */
  togglePlay: () => void;
  /** Is transitioning */
  isTransitioning: boolean;
}

/** Carousel props */
export interface CarouselProps {
  /** Slides content */
  items?: CarouselItem[];
  /** Or use children */
  children?: ReactNode;
  /** Initial slide index */
  defaultIndex?: number;
  /** Controlled index */
  index?: number;
  /** On index change */
  onIndexChange?: (index: number) => void;
  /** Enable autoplay */
  autoplay?: boolean;
  /** Autoplay interval (ms) */
  autoplayInterval?: number;
  /** Pause on hover */
  pauseOnHover?: boolean;
  /** Show navigation arrows */
  showArrows?: boolean;
  /** Show dot indicators */
  showDots?: boolean;
  /** Show thumbnails */
  showThumbnails?: boolean;
  /** Enable infinite loop */
  infinite?: boolean;
  /** Enable touch/swipe */
  enableTouch?: boolean;
  /** Swipe threshold (px) */
  swipeThreshold?: number;
  /** Transition duration (ms) */
  transitionDuration?: number;
  /** Slides to show at once */
  slidesToShow?: number;
  /** Slides to scroll */
  slidesToScroll?: number;
  /** Center mode (show partial slides) */
  centerMode?: boolean;
  /** Class name */
  className?: string;
  /** Slide class name */
  slideClassName?: string;
  /** ARIA label */
  'aria-label'?: string;
}

/** Carousel slide props */
export interface CarouselSlideProps {
  /** Slide content */
  children: ReactNode;
  /** Class name */
  className?: string;
}

// ============================================================================
// CONTEXT
// ============================================================================

const CarouselContext = createContext<CarouselContextValue | null>(null);

function useCarouselContext(): CarouselContextValue {
  const context = useContext(CarouselContext);
  if (!context) {
    throw new Error('useCarouselContext must be used within a Carousel');
  }
  return context;
}

/** Hook to access carousel context */
export function useCarousel(): CarouselContextValue {
  return useCarouselContext();
}

// ============================================================================
// 28.1-28.5: CAROUSEL COMPONENT
// ============================================================================

/**
 * Carousel component with smooth transitions
 * 
 * @example
 * ```tsx
 * const slides = [
 *   { id: '1', content: <img src="/image1.jpg" alt="Slide 1" /> },
 *   { id: '2', content: <img src="/image2.jpg" alt="Slide 2" /> },
 * ];
 * 
 * <Carousel
 *   items={slides}
 *   autoplay
 *   showDots
 *   infinite
 * />
 * ```
 */
export function Carousel({
  items = [],
  children,
  defaultIndex = 0,
  index: controlledIndex,
  onIndexChange,
  autoplay = false,
  autoplayInterval = 5000,
  pauseOnHover = true,
  showArrows = true,
  showDots = true,
  showThumbnails = false,
  infinite = true,
  enableTouch = true,
  swipeThreshold = 50,
  transitionDuration = 300,
  slidesToShow = 1,
  slidesToScroll = 1,
  centerMode = false,
  className,
  slideClassName,
  'aria-label': ariaLabel = 'Image carousel',
}: CarouselProps) {
  // Get slides from items or children
  const slides: CarouselItem[] = items.length > 0
    ? items
    : React.Children.toArray(children).map((child, i) => ({
        id: `slide-${i}`,
        content: child,
        thumbnail: undefined,
        alt: undefined,
      }));

  const totalSlides = slides.length;

  // State
  const [internalIndex, setInternalIndex] = useState(defaultIndex);
  const [isPlaying, setIsPlaying] = useState(autoplay);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const autoplayRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // Use controlled or internal index
  const currentIndex = controlledIndex ?? internalIndex;

  // Set index
  const setIndex = useCallback((newIndex: number) => {
    if (controlledIndex === undefined) {
      setInternalIndex(newIndex);
    }
    onIndexChange?.(newIndex);
  }, [controlledIndex, onIndexChange]);

  // Go to specific slide
  const goTo = useCallback((index: number) => {
    if (isTransitioning) return;

    let newIndex = index;
    if (infinite) {
      if (index < 0) {
        newIndex = totalSlides - 1;
      } else if (index >= totalSlides) {
        newIndex = 0;
      }
    } else {
      newIndex = Math.max(0, Math.min(index, totalSlides - 1));
    }

    if (newIndex !== currentIndex) {
      setIsTransitioning(true);
      setIndex(newIndex);
      setTimeout(() => setIsTransitioning(false), transitionDuration);
    }
  }, [currentIndex, totalSlides, infinite, isTransitioning, transitionDuration, setIndex]);

  // Navigation
  const next = useCallback(() => {
    goTo(currentIndex + slidesToScroll);
  }, [currentIndex, slidesToScroll, goTo]);

  const prev = useCallback(() => {
    goTo(currentIndex - slidesToScroll);
  }, [currentIndex, slidesToScroll, goTo]);

  // Toggle autoplay
  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  // Autoplay effect
  useEffect(() => {
    if (isPlaying && !isPaused && totalSlides > 1) {
      autoplayRef.current = setInterval(next, autoplayInterval);
    }
    return () => {
      if (autoplayRef.current) {
        clearInterval(autoplayRef.current);
      }
    };
  }, [isPlaying, isPaused, totalSlides, autoplayInterval, next]);

  // Hover pause
  const handleMouseEnter = useCallback(() => {
    if (pauseOnHover) {
      setIsPaused(true);
    }
  }, [pauseOnHover]);

  const handleMouseLeave = useCallback(() => {
    if (pauseOnHover) {
      setIsPaused(false);
    }
  }, [pauseOnHover]);

  // Touch handlers
  const handleTouchStart = useCallback((e: ReactTouchEvent) => {
    if (!enableTouch) return;
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  }, [enableTouch]);

  const handleTouchEnd = useCallback((e: ReactTouchEvent) => {
    if (!enableTouch || !touchStartRef.current) return;

    const touchEnd = {
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY,
    };

    const diffX = touchStartRef.current.x - touchEnd.x;
    const diffY = touchStartRef.current.y - touchEnd.y;

    // Only trigger if horizontal swipe is dominant
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > swipeThreshold) {
      if (diffX > 0) {
        next();
      } else {
        prev();
      }
    }

    touchStartRef.current = null;
  }, [enableTouch, swipeThreshold, next, prev]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        prev();
        break;
      case 'ArrowRight':
        e.preventDefault();
        next();
        break;
      case 'Home':
        e.preventDefault();
        goTo(0);
        break;
      case 'End':
        e.preventDefault();
        goTo(totalSlides - 1);
        break;
      case ' ':
        e.preventDefault();
        togglePlay();
        break;
    }
  }, [prev, next, goTo, totalSlides, togglePlay]);

  // Calculate slide width
  const slideWidth = 100 / slidesToShow;

  // Context value
  const contextValue: CarouselContextValue = {
    currentIndex,
    totalSlides,
    goTo,
    next,
    prev,
    isPlaying,
    togglePlay,
    isTransitioning,
  };

  if (totalSlides === 0) {
    return (
      <div className={clsx('p-4 text-center text-gray-500', className)}>
        No slides
      </div>
    );
  }

  return (
    <CarouselContext.Provider value={contextValue}>
      <div
        ref={containerRef}
        className={clsx('relative group', className)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="region"
        aria-label={ariaLabel}
        aria-roledescription="carousel"
      >
        {/* Slides container */}
        <div className="overflow-hidden rounded-lg">
          <div
            className="flex transition-transform"
            style={{
              transform: `translateX(-${currentIndex * slideWidth}%)`,
              transitionDuration: `${transitionDuration}ms`,
            }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {slides.map((slide, index) => (
              <div
                key={slide.id}
                className={clsx(
                  'flex-shrink-0',
                  slideClassName
                )}
                style={{ width: `${slideWidth}%` }}
                role="group"
                aria-roledescription="slide"
                aria-label={`Slide ${index + 1} of ${totalSlides}`}
                aria-hidden={index !== currentIndex}
              >
                {centerMode ? (
                  <div className="px-2">{slide.content}</div>
                ) : (
                  slide.content
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Navigation arrows */}
        {showArrows && totalSlides > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              disabled={!infinite && currentIndex === 0}
              className={clsx(
                'absolute left-2 top-1/2 -translate-y-1/2 z-10',
                'p-2 rounded-full bg-white/80 dark:bg-gray-800/80 shadow-lg',
                'opacity-0 group-hover:opacity-100 transition-opacity',
                'hover:bg-white dark:hover:bg-gray-700',
                'disabled:opacity-30 disabled:cursor-not-allowed',
                'focus:outline-none focus:ring-2 focus:ring-blue-500'
              )}
              aria-label="Previous slide"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={next}
              disabled={!infinite && currentIndex === totalSlides - 1}
              className={clsx(
                'absolute right-2 top-1/2 -translate-y-1/2 z-10',
                'p-2 rounded-full bg-white/80 dark:bg-gray-800/80 shadow-lg',
                'opacity-0 group-hover:opacity-100 transition-opacity',
                'hover:bg-white dark:hover:bg-gray-700',
                'disabled:opacity-30 disabled:cursor-not-allowed',
                'focus:outline-none focus:ring-2 focus:ring-blue-500'
              )}
              aria-label="Next slide"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        {/* Dot indicators */}
        {showDots && totalSlides > 1 && (
          <div
            className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2"
            role="tablist"
            aria-label="Slide navigation"
          >
            {autoplay && (
              <button
                type="button"
                onClick={togglePlay}
                className={clsx(
                  'p-1 rounded-full bg-white/80 dark:bg-gray-800/80',
                  'hover:bg-white dark:hover:bg-gray-700',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500'
                )}
                aria-label={isPlaying ? 'Pause autoplay' : 'Start autoplay'}
              >
                {isPlaying ? (
                  <Pause className="w-3 h-3" />
                ) : (
                  <Play className="w-3 h-3" />
                )}
              </button>
            )}
            {slides.map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => goTo(index)}
                role="tab"
                aria-selected={index === currentIndex}
                aria-label={`Go to slide ${index + 1}`}
                className={clsx(
                  'w-2 h-2 rounded-full transition-all',
                  index === currentIndex
                    ? 'bg-white w-4'
                    : 'bg-white/50 hover:bg-white/75'
                )}
              />
            ))}
          </div>
        )}

        {/* Thumbnails */}
        {showThumbnails && totalSlides > 1 && (
          <div className="flex gap-2 mt-2 overflow-x-auto py-1 px-1">
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => goTo(index)}
                className={clsx(
                  'flex-shrink-0 w-16 h-12 rounded overflow-hidden transition-all',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500',
                  index === currentIndex
                    ? 'ring-2 ring-blue-500'
                    : 'opacity-60 hover:opacity-100'
                )}
                aria-label={`Go to slide ${index + 1}`}
              >
                {slide.thumbnail ? (
                  <img
                    src={slide.thumbnail}
                    alt={slide.alt || `Thumbnail ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs text-gray-500">
                    {index + 1}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </CarouselContext.Provider>
  );
}

// ============================================================================
// CAROUSEL SLIDE (for children pattern)
// ============================================================================

/**
 * Individual carousel slide component
 * 
 * @example
 * ```tsx
 * <Carousel>
 *   <CarouselSlide>Slide 1</CarouselSlide>
 *   <CarouselSlide>Slide 2</CarouselSlide>
 * </Carousel>
 * ```
 */
export function CarouselSlide({ children, className }: CarouselSlideProps) {
  return (
    <div className={clsx('w-full h-full', className)}>
      {children}
    </div>
  );
}

// ============================================================================
// IMAGE CAROUSEL (specialized)
// ============================================================================

export interface ImageCarouselProps extends Omit<CarouselProps, 'items' | 'children'> {
  /** Image URLs */
  images: Array<{
    src: string;
    alt?: string;
    thumbnail?: string;
  }>;
  /** Image fit mode */
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
  /** Container height */
  height?: string | number;
}

/**
 * Specialized carousel for images
 * 
 * @example
 * ```tsx
 * <ImageCarousel
 *   images={[
 *     { src: '/photo1.jpg', alt: 'Photo 1' },
 *     { src: '/photo2.jpg', alt: 'Photo 2' },
 *   ]}
 *   height={400}
 *   showThumbnails
 * />
 * ```
 */
export function ImageCarousel({
  images,
  objectFit = 'cover',
  height = 400,
  ...carouselProps
}: ImageCarouselProps) {
  const items: CarouselItem[] = images.map((img, index) => ({
    id: `image-${index}`,
    content: (
      <img
        src={img.src}
        alt={img.alt || `Image ${index + 1}`}
        className="w-full h-full"
        style={{ objectFit }}
        loading="lazy"
      />
    ),
    thumbnail: img.thumbnail || img.src,
    alt: img.alt,
  }));

  return (
    <Carousel
      items={items}
      {...carouselProps}
      slideClassName={clsx(
        carouselProps.slideClassName,
        typeof height === 'number' ? '' : height
      )}
      className={clsx(carouselProps.className)}
      style-height={typeof height === 'number' ? `${height}px` : undefined}
    />
  );
}

// ============================================================================
// CONTENT CAROUSEL
// ============================================================================

export interface ContentCarouselProps extends Omit<CarouselProps, 'items'> {
  /** Content cards */
  cards: ReactNode[];
}

/**
 * Carousel for content cards (products, features, etc.)
 * 
 * @example
 * ```tsx
 * <ContentCarousel
 *   cards={[
 *     <ProductCard key="1" product={product1} />,
 *     <ProductCard key="2" product={product2} />,
 *   ]}
 *   slidesToShow={3}
 *   centerMode
 * />
 * ```
 */
export function ContentCarousel({
  cards,
  slidesToShow = 3,
  ...carouselProps
}: ContentCarouselProps) {
  const items: CarouselItem[] = cards.map((card, index) => ({
    id: `card-${index}`,
    content: <div className="p-2">{card}</div>,
  }));

  return (
    <Carousel
      items={items}
      slidesToShow={slidesToShow}
      showDots={false}
      {...carouselProps}
    />
  );
}

// ============================================================================
// CAROUSEL CONTROLS (standalone)
// ============================================================================

export interface CarouselControlsProps {
  /** Show prev/next arrows */
  showArrows?: boolean;
  /** Show dots */
  showDots?: boolean;
  /** Show play/pause */
  showPlayPause?: boolean;
  /** Class name */
  className?: string;
}

/**
 * Standalone carousel controls
 */
export function CarouselControls({
  showArrows = true,
  showDots = true,
  showPlayPause = false,
  className,
}: CarouselControlsProps) {
  const { currentIndex, totalSlides, prev, next, goTo, isPlaying, togglePlay } = useCarousel();

  return (
    <div className={clsx('flex items-center justify-center gap-4', className)}>
      {showArrows && (
        <button
          type="button"
          onClick={prev}
          className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label="Previous"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}

      {showDots && (
        <div className="flex items-center gap-2">
          {Array.from({ length: totalSlides }).map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => goTo(index)}
              className={clsx(
                'w-2.5 h-2.5 rounded-full transition-all',
                index === currentIndex
                  ? 'bg-blue-500 w-4'
                  : 'bg-gray-300 dark:bg-gray-600 hover:bg-gray-400'
              )}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}

      {showPlayPause && (
        <button
          type="button"
          onClick={togglePlay}
          className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="w-5 h-5" />
          ) : (
            <Play className="w-5 h-5" />
          )}
        </button>
      )}

      {showArrows && (
        <button
          type="button"
          onClick={next}
          className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label="Next"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}

// ============================================================================
// CAROUSEL PROGRESS
// ============================================================================

export interface CarouselProgressProps {
  /** Show percentage */
  showPercentage?: boolean;
  /** Bar height */
  height?: number;
  /** Class name */
  className?: string;
}

/**
 * Progress bar for carousel
 */
export function CarouselProgress({
  showPercentage = false,
  height = 4,
  className,
}: CarouselProgressProps) {
  const { currentIndex, totalSlides } = useCarousel();

  const progress = ((currentIndex + 1) / totalSlides) * 100;

  return (
    <div className={clsx('flex items-center gap-2', className)}>
      <div
        className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"
        style={{ height }}
      >
        <div
          className="h-full bg-blue-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      {showPercentage && (
        <span className="text-xs text-gray-500 dark:text-gray-400 min-w-[3ch]">
          {Math.round(progress)}%
        </span>
      )}
    </div>
  );
}

// ============================================================================
// CAROUSEL COUNTER
// ============================================================================

export interface CarouselCounterProps {
  /** Separator between current and total */
  separator?: string;
  /** Class name */
  className?: string;
}

/**
 * Slide counter display
 */
export function CarouselCounter({
  separator = '/',
  className,
}: CarouselCounterProps) {
  const { currentIndex, totalSlides } = useCarousel();

  return (
    <div className={clsx('text-sm text-gray-600 dark:text-gray-400', className)}>
      <span className="font-medium">{currentIndex + 1}</span>
      <span className="mx-1">{separator}</span>
      <span>{totalSlides}</span>
    </div>
  );
}

// ============================================================================
// EXPORTS - Components and hooks are already exported inline
// ============================================================================
