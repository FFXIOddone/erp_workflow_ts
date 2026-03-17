/**
 * Page Transition Animations
 * 
 * Smooth page transitions with:
 * - Configurable animation presets
 * - Route-based transitions
 * - Shared element transitions
 * - Loading state animations
 * - Exit animations
 */

import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  createContext,
  useContext,
  ReactNode,
  useRef,
} from 'react';
import { motion, AnimatePresence, Variants, Transition } from 'framer-motion';
import { clsx } from 'clsx';

// ============================================================================
// Types
// ============================================================================

export type TransitionType = 
  | 'fade'
  | 'slide-left'
  | 'slide-right'
  | 'slide-up'
  | 'slide-down'
  | 'scale'
  | 'scale-fade'
  | 'flip'
  | 'none';

export type TransitionSpeed = 'fast' | 'normal' | 'slow';

export interface TransitionConfig {
  type: TransitionType;
  speed?: TransitionSpeed;
  delay?: number;
}

export interface PageTransitionContextValue {
  /** Current transition type */
  transitionType: TransitionType;
  
  /** Set transition for next navigation */
  setTransition: (type: TransitionType) => void;
  
  /** Global transition speed */
  speed: TransitionSpeed;
  setSpeed: (speed: TransitionSpeed) => void;
  
  /** Whether transitions are enabled */
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  
  /** Is currently transitioning */
  isTransitioning: boolean;
  
  /** Loading state */
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

// ============================================================================
// Speed Durations
// ============================================================================

const SPEED_DURATIONS: Record<TransitionSpeed, number> = {
  fast: 0.15,
  normal: 0.3,
  slow: 0.5,
};

// ============================================================================
// Transition Variants
// ============================================================================

const createVariants = (duration: number): Record<TransitionType, Variants> => ({
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration } },
    exit: { opacity: 0, transition: { duration: duration * 0.8 } },
  },

  'slide-left': {
    initial: { x: '100%', opacity: 0 },
    animate: { x: 0, opacity: 1, transition: { duration, ease: 'easeOut' } },
    exit: { x: '-100%', opacity: 0, transition: { duration: duration * 0.8, ease: 'easeIn' } },
  },

  'slide-right': {
    initial: { x: '-100%', opacity: 0 },
    animate: { x: 0, opacity: 1, transition: { duration, ease: 'easeOut' } },
    exit: { x: '100%', opacity: 0, transition: { duration: duration * 0.8, ease: 'easeIn' } },
  },

  'slide-up': {
    initial: { y: '100%', opacity: 0 },
    animate: { y: 0, opacity: 1, transition: { duration, ease: 'easeOut' } },
    exit: { y: '-50%', opacity: 0, transition: { duration: duration * 0.8, ease: 'easeIn' } },
  },

  'slide-down': {
    initial: { y: '-100%', opacity: 0 },
    animate: { y: 0, opacity: 1, transition: { duration, ease: 'easeOut' } },
    exit: { y: '100%', opacity: 0, transition: { duration: duration * 0.8, ease: 'easeIn' } },
  },

  scale: {
    initial: { scale: 0.8, opacity: 0 },
    animate: { scale: 1, opacity: 1, transition: { duration, ease: 'easeOut' } },
    exit: { scale: 1.1, opacity: 0, transition: { duration: duration * 0.8, ease: 'easeIn' } },
  },

  'scale-fade': {
    initial: { scale: 0.95, opacity: 0 },
    animate: { scale: 1, opacity: 1, transition: { duration, ease: 'easeOut' } },
    exit: { scale: 0.95, opacity: 0, transition: { duration: duration * 0.8 } },
  },

  flip: {
    initial: { rotateY: -90, opacity: 0 },
    animate: { rotateY: 0, opacity: 1, transition: { duration, ease: 'easeOut' } },
    exit: { rotateY: 90, opacity: 0, transition: { duration: duration * 0.8, ease: 'easeIn' } },
  },

  none: {
    initial: {},
    animate: {},
    exit: {},
  },
});

// ============================================================================
// Context
// ============================================================================

const PageTransitionContext = createContext<PageTransitionContextValue | null>(null);

export function usePageTransition() {
  const context = useContext(PageTransitionContext);
  if (!context) {
    throw new Error('usePageTransition must be used within PageTransitionProvider');
  }
  return context;
}

// ============================================================================
// Provider
// ============================================================================

interface PageTransitionProviderProps {
  children: ReactNode;
  defaultType?: TransitionType;
  defaultSpeed?: TransitionSpeed;
  defaultEnabled?: boolean;
}

export function PageTransitionProvider({
  children,
  defaultType = 'fade',
  defaultSpeed = 'normal',
  defaultEnabled = true,
}: PageTransitionProviderProps) {
  const [transitionType, setTransitionType] = useState<TransitionType>(defaultType);
  const [speed, setSpeed] = useState<TransitionSpeed>(defaultSpeed);
  const [enabled, setEnabled] = useState(defaultEnabled);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const setTransition = useCallback((type: TransitionType) => {
    setTransitionType(type);
  }, []);

  const contextValue = useMemo<PageTransitionContextValue>(
    () => ({
      transitionType,
      setTransition,
      speed,
      setSpeed,
      enabled,
      setEnabled,
      isTransitioning,
      isLoading,
      setIsLoading,
    }),
    [transitionType, setTransition, speed, enabled, isTransitioning, isLoading]
  );

  return (
    <PageTransitionContext.Provider value={contextValue}>
      {children}
    </PageTransitionContext.Provider>
  );
}

// ============================================================================
// Page Transition Wrapper
// ============================================================================

interface PageTransitionProps {
  children: ReactNode;
  pageKey: string;
  className?: string;
  type?: TransitionType;
  speed?: TransitionSpeed;
  onAnimationStart?: () => void;
  onAnimationComplete?: () => void;
}

export function PageTransition({
  children,
  pageKey,
  className,
  type: overrideType,
  speed: overrideSpeed,
  onAnimationStart,
  onAnimationComplete,
}: PageTransitionProps) {
  const context = useContext(PageTransitionContext);
  
  const type = overrideType ?? context?.transitionType ?? 'fade';
  const speed = overrideSpeed ?? context?.speed ?? 'normal';
  const enabled = context?.enabled ?? true;

  const duration = SPEED_DURATIONS[speed];
  const variants = useMemo(() => createVariants(duration), [duration]);

  if (!enabled) {
    return <div className={className}>{children}</div>;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pageKey}
        variants={variants[type]}
        initial="initial"
        animate="animate"
        exit="exit"
        onAnimationStart={onAnimationStart}
        onAnimationComplete={onAnimationComplete}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// ============================================================================
// Route Transition Component
// ============================================================================

interface RouteTransitionProps {
  children: ReactNode;
  location: string;
  className?: string;
}

export function RouteTransition({ children, location, className }: RouteTransitionProps) {
  const prevLocationRef = useRef(location);
  const { setTransition, speed } = usePageTransition();

  // Determine direction based on route change
  useEffect(() => {
    const prev = prevLocationRef.current;
    if (prev !== location) {
      // Simple heuristic: deeper routes slide left, shallower slide right
      const prevDepth = prev.split('/').filter(Boolean).length;
      const currentDepth = location.split('/').filter(Boolean).length;

      if (currentDepth > prevDepth) {
        setTransition('slide-left');
      } else if (currentDepth < prevDepth) {
        setTransition('slide-right');
      } else {
        setTransition('fade');
      }

      prevLocationRef.current = location;
    }
  }, [location, setTransition]);

  return (
    <PageTransition pageKey={location} className={className} speed={speed}>
      {children}
    </PageTransition>
  );
}

// ============================================================================
// Staggered Children Animation
// ============================================================================

interface StaggeredAnimationProps {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
  initialDelay?: number;
}

export function StaggeredAnimation({
  children,
  className,
  staggerDelay = 0.05,
  initialDelay = 0,
}: StaggeredAnimationProps) {
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        delayChildren: initialDelay,
        staggerChildren: staggerDelay,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.3,
        ease: 'easeOut',
      },
    },
  };

  return (
    <motion.div
      className={className}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {React.Children.map(children, (child, index) => (
        <motion.div key={index} variants={itemVariants}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}

// ============================================================================
// Animate On Scroll
// ============================================================================

interface AnimateOnScrollProps {
  children: ReactNode;
  className?: string;
  animation?: 'fade' | 'slide-up' | 'slide-left' | 'scale';
  threshold?: number;
  once?: boolean;
}

export function AnimateOnScroll({
  children,
  className,
  animation = 'fade',
  threshold = 0.1,
  once = true,
}: AnimateOnScrollProps) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (once) {
            observer.unobserve(element);
          }
        } else if (!once) {
          setIsVisible(false);
        }
      },
      { threshold }
    );

    observer.observe(element);
    return () => observer.unobserve(element);
  }, [threshold, once]);

  const variants: Record<string, Variants> = {
    fade: {
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: { duration: 0.5 } },
    },
    'slide-up': {
      hidden: { opacity: 0, y: 50 },
      visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
    },
    'slide-left': {
      hidden: { opacity: 0, x: 50 },
      visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease: 'easeOut' } },
    },
    scale: {
      hidden: { opacity: 0, scale: 0.8 },
      visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: 'easeOut' } },
    },
  };

  return (
    <motion.div
      ref={ref}
      className={className}
      variants={variants[animation]}
      initial="hidden"
      animate={isVisible ? 'visible' : 'hidden'}
    >
      {children}
    </motion.div>
  );
}

// ============================================================================
// Loading Skeleton Animation
// ============================================================================

interface SkeletonPulseProps {
  className?: string;
  children?: ReactNode;
}

export function SkeletonPulse({ className, children }: SkeletonPulseProps) {
  return (
    <div
      className={clsx(
        'animate-pulse bg-gray-200 dark:bg-gray-700 rounded',
        className
      )}
    >
      {children}
    </div>
  );
}

// ============================================================================
// Page Loading Animation
// ============================================================================

interface PageLoadingProps {
  className?: string;
}

export function PageLoading({ className }: PageLoadingProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={clsx(
        'flex items-center justify-center min-h-[400px]',
        className
      )}
    >
      <div className="flex flex-col items-center gap-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full"
        />
        <motion.p
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="text-gray-500 dark:text-gray-400"
        >
          Loading...
        </motion.p>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Shared Layout Animation Wrapper
// ============================================================================

interface SharedLayoutProps {
  children: ReactNode;
  layoutId: string;
  className?: string;
}

export function SharedLayout({ children, layoutId, className }: SharedLayoutProps) {
  return (
    <motion.div layoutId={layoutId} className={className}>
      {children}
    </motion.div>
  );
}

// ============================================================================
// Expandable Card Animation
// ============================================================================

interface ExpandableCardProps {
  children: ReactNode;
  expandedContent?: ReactNode;
  layoutId: string;
  className?: string;
  expandedClassName?: string;
  isExpanded: boolean;
  onToggle: () => void;
}

export function ExpandableCard({
  children,
  expandedContent,
  layoutId,
  className,
  expandedClassName,
  isExpanded,
  onToggle,
}: ExpandableCardProps) {
  return (
    <>
      <motion.div
        layoutId={layoutId}
        onClick={onToggle}
        className={clsx(
          'cursor-pointer',
          isExpanded ? expandedClassName : className
        )}
      >
        <motion.div layout="position">{children}</motion.div>
        
        <AnimatePresence>
          {isExpanded && expandedContent && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {expandedContent}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Backdrop when expanded */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onToggle}
            className="fixed inset-0 bg-black/20 z-40"
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ============================================================================
// Entrance Animation Component
// ============================================================================

interface EntranceProps {
  children: ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
  type?: 'fade' | 'slide-up' | 'slide-down' | 'slide-left' | 'slide-right' | 'scale';
}

export function Entrance({
  children,
  delay = 0,
  duration = 0.3,
  className,
  type = 'fade',
}: EntranceProps) {
  const variants: Record<string, Variants> = {
    fade: {
      hidden: { opacity: 0 },
      visible: { opacity: 1 },
    },
    'slide-up': {
      hidden: { opacity: 0, y: 20 },
      visible: { opacity: 1, y: 0 },
    },
    'slide-down': {
      hidden: { opacity: 0, y: -20 },
      visible: { opacity: 1, y: 0 },
    },
    'slide-left': {
      hidden: { opacity: 0, x: 20 },
      visible: { opacity: 1, x: 0 },
    },
    'slide-right': {
      hidden: { opacity: 0, x: -20 },
      visible: { opacity: 1, x: 0 },
    },
    scale: {
      hidden: { opacity: 0, scale: 0.9 },
      visible: { opacity: 1, scale: 1 },
    },
  };

  return (
    <motion.div
      className={className}
      variants={variants[type]}
      initial="hidden"
      animate="visible"
      transition={{ delay, duration, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

// ============================================================================
// List Item Animation
// ============================================================================

interface AnimatedListItemProps {
  children: ReactNode;
  index: number;
  className?: string;
}

export function AnimatedListItem({
  children,
  index,
  className,
}: AnimatedListItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{
        delay: index * 0.05,
        duration: 0.2,
        ease: 'easeOut',
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ============================================================================
// Transition Preset Hook
// ============================================================================

export function useTransitionPreset(routePattern: string): TransitionType {
  // Determine appropriate transition based on route pattern
  const { setTransition } = usePageTransition();

  useEffect(() => {
    if (routePattern.includes('/new')) {
      setTransition('slide-up');
    } else if (routePattern.includes('/edit')) {
      setTransition('slide-left');
    } else if (routePattern.includes('/details')) {
      setTransition('scale-fade');
    } else {
      setTransition('fade');
    }
  }, [routePattern, setTransition]);

  return 'fade';
}

export default PageTransition;
