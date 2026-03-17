/**
 * Animation & Transition Utilities
 * 
 * Consistent animation patterns for the ERP system.
 * Features:
 * - Transition presets (fade, slide, scale, etc.)
 * - Motion variants for Framer Motion compatibility
 * - CSS keyframe animations
 * - Timing function constants
 * - Animated wrapper components
 * 
 * Usage: FadeIn, SlideIn, ScaleIn, Collapse, Stagger, etc.
 */

import React, { useState, useEffect, useRef } from 'react';
import { clsx } from 'clsx';

// ============================================================================
// Animation Constants
// ============================================================================

export const DURATIONS = {
  instant: 0,
  fast: 150,
  normal: 200,
  slow: 300,
  slower: 500,
} as const;

export const EASINGS = {
  linear: 'linear',
  ease: 'ease',
  easeIn: 'ease-in',
  easeOut: 'ease-out',
  easeInOut: 'ease-in-out',
  // Custom cubic-bezier
  spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
  bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
  snappy: 'cubic-bezier(0.2, 0, 0, 1)',
} as const;

// ============================================================================
// Transition Classes (Tailwind)
// ============================================================================

export const transitions = {
  // Duration classes
  duration: {
    instant: 'duration-0',
    fast: 'duration-150',
    normal: 'duration-200',
    slow: 'duration-300',
    slower: 'duration-500',
  },
  
  // Easing classes
  easing: {
    linear: 'ease-linear',
    ease: 'ease-in-out',
    easeIn: 'ease-in',
    easeOut: 'ease-out',
  },
  
  // Common transitions
  all: 'transition-all',
  colors: 'transition-colors',
  opacity: 'transition-opacity',
  transform: 'transition-transform',
  shadow: 'transition-shadow',
  
  // Preset combinations
  default: 'transition-all duration-200 ease-in-out',
  fast: 'transition-all duration-150 ease-out',
  smooth: 'transition-all duration-300 ease-in-out',
  snappy: 'transition-all duration-200 cubic-bezier(0.2,0,0,1)',
} as const;

// ============================================================================
// Animation Keyframes (CSS-in-JS)
// ============================================================================

export const keyframes = {
  fadeIn: {
    from: { opacity: 0 },
    to: { opacity: 1 },
  },
  fadeOut: {
    from: { opacity: 1 },
    to: { opacity: 0 },
  },
  slideInFromTop: {
    from: { transform: 'translateY(-100%)', opacity: 0 },
    to: { transform: 'translateY(0)', opacity: 1 },
  },
  slideInFromBottom: {
    from: { transform: 'translateY(100%)', opacity: 0 },
    to: { transform: 'translateY(0)', opacity: 1 },
  },
  slideInFromLeft: {
    from: { transform: 'translateX(-100%)', opacity: 0 },
    to: { transform: 'translateX(0)', opacity: 1 },
  },
  slideInFromRight: {
    from: { transform: 'translateX(100%)', opacity: 0 },
    to: { transform: 'translateX(0)', opacity: 1 },
  },
  scaleIn: {
    from: { transform: 'scale(0.95)', opacity: 0 },
    to: { transform: 'scale(1)', opacity: 1 },
  },
  scaleOut: {
    from: { transform: 'scale(1)', opacity: 1 },
    to: { transform: 'scale(0.95)', opacity: 0 },
  },
  spin: {
    from: { transform: 'rotate(0deg)' },
    to: { transform: 'rotate(360deg)' },
  },
  pulse: {
    '0%, 100%': { opacity: 1 },
    '50%': { opacity: 0.5 },
  },
  bounce: {
    '0%, 100%': { transform: 'translateY(0)' },
    '50%': { transform: 'translateY(-10px)' },
  },
  shake: {
    '0%, 100%': { transform: 'translateX(0)' },
    '25%': { transform: 'translateX(-5px)' },
    '75%': { transform: 'translateX(5px)' },
  },
  ping: {
    '75%, 100%': { transform: 'scale(2)', opacity: 0 },
  },
} as const;

// ============================================================================
// Animated Wrapper Components
// ============================================================================

interface AnimatedProps {
  children: React.ReactNode;
  duration?: number;
  delay?: number;
  easing?: keyof typeof EASINGS;
  className?: string;
  onAnimationEnd?: () => void;
}

// FadeIn Component
interface FadeInProps extends AnimatedProps {
  show?: boolean;
}

export function FadeIn({
  children,
  duration = DURATIONS.normal,
  delay = 0,
  easing = 'smooth',
  className,
  show = true,
  onAnimationEnd,
}: FadeInProps) {
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => setIsVisible(true), delay);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [show, delay]);
  
  return (
    <div
      className={clsx(
        'transition-opacity',
        isVisible ? 'opacity-100' : 'opacity-0',
        className
      )}
      style={{
        transitionDuration: `${duration}ms`,
        transitionTimingFunction: EASINGS[easing],
      }}
      onTransitionEnd={onAnimationEnd}
    >
      {children}
    </div>
  );
}

// SlideIn Component
type SlideDirection = 'top' | 'bottom' | 'left' | 'right';

interface SlideInProps extends AnimatedProps {
  from?: SlideDirection;
  distance?: number;
  show?: boolean;
}

export function SlideIn({
  children,
  from = 'bottom',
  distance = 20,
  duration = DURATIONS.normal,
  delay = 0,
  easing = 'smooth',
  className,
  show = true,
  onAnimationEnd,
}: SlideInProps) {
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => setIsVisible(true), delay);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [show, delay]);
  
  const getTransform = () => {
    if (isVisible) return 'translate(0, 0)';
    
    switch (from) {
      case 'top': return `translateY(-${distance}px)`;
      case 'bottom': return `translateY(${distance}px)`;
      case 'left': return `translateX(-${distance}px)`;
      case 'right': return `translateX(${distance}px)`;
    }
  };
  
  return (
    <div
      className={clsx('transition-all', className)}
      style={{
        transform: getTransform(),
        opacity: isVisible ? 1 : 0,
        transitionDuration: `${duration}ms`,
        transitionTimingFunction: EASINGS[easing],
      }}
      onTransitionEnd={onAnimationEnd}
    >
      {children}
    </div>
  );
}

// ScaleIn Component
interface ScaleInProps extends AnimatedProps {
  from?: number;
  show?: boolean;
}

export function ScaleIn({
  children,
  from = 0.95,
  duration = DURATIONS.normal,
  delay = 0,
  easing = 'smooth',
  className,
  show = true,
  onAnimationEnd,
}: ScaleInProps) {
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => setIsVisible(true), delay);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [show, delay]);
  
  return (
    <div
      className={clsx('transition-all', className)}
      style={{
        transform: isVisible ? 'scale(1)' : `scale(${from})`,
        opacity: isVisible ? 1 : 0,
        transitionDuration: `${duration}ms`,
        transitionTimingFunction: EASINGS[easing],
      }}
      onTransitionEnd={onAnimationEnd}
    >
      {children}
    </div>
  );
}

// ============================================================================
// Stagger Animation Container
// ============================================================================

interface StaggerProps {
  children: React.ReactNode;
  staggerDelay?: number;
  initialDelay?: number;
  className?: string;
}

export function Stagger({
  children,
  staggerDelay = 50,
  initialDelay = 0,
  className,
}: StaggerProps) {
  const childArray = React.Children.toArray(children);
  
  return (
    <div className={className}>
      {childArray.map((child, i) => (
        <FadeIn
          key={i}
          delay={initialDelay + i * staggerDelay}
          duration={DURATIONS.normal}
        >
          <SlideIn from="bottom" distance={10} delay={initialDelay + i * staggerDelay}>
            {child}
          </SlideIn>
        </FadeIn>
      ))}
    </div>
  );
}

// ============================================================================
// Collapse Animation
// ============================================================================

interface CollapseProps {
  isOpen: boolean;
  children: React.ReactNode;
  duration?: number;
  className?: string;
}

export function Collapse({
  isOpen,
  children,
  duration = DURATIONS.normal,
  className,
}: CollapseProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | 'auto'>(isOpen ? 'auto' : 0);
  
  useEffect(() => {
    if (!contentRef.current) return;
    
    if (isOpen) {
      const contentHeight = contentRef.current.scrollHeight;
      setHeight(contentHeight);
      
      // After animation, set to auto for dynamic content
      const timer = setTimeout(() => setHeight('auto'), duration);
      return () => clearTimeout(timer);
    } else {
      // Get current height first
      const contentHeight = contentRef.current.scrollHeight;
      setHeight(contentHeight);
      
      // Then animate to 0
      requestAnimationFrame(() => {
        setHeight(0);
      });
    }
  }, [isOpen, duration]);
  
  return (
    <div
      ref={contentRef}
      className={clsx('overflow-hidden transition-all', className)}
      style={{
        height: typeof height === 'number' ? `${height}px` : height,
        transitionDuration: `${duration}ms`,
        transitionTimingFunction: EASINGS.smooth,
      }}
    >
      {children}
    </div>
  );
}

// ============================================================================
// Presence Animation (Mount/Unmount)
// ============================================================================

interface AnimatePresenceProps {
  show: boolean;
  children: React.ReactNode;
  animation?: 'fade' | 'scale' | 'slide';
  duration?: number;
}

export function AnimatePresence({
  show,
  children,
  animation = 'fade',
  duration = DURATIONS.normal,
}: AnimatePresenceProps) {
  const [shouldRender, setShouldRender] = useState(show);
  const [isAnimating, setIsAnimating] = useState(false);
  
  useEffect(() => {
    if (show) {
      setShouldRender(true);
      requestAnimationFrame(() => setIsAnimating(true));
    } else {
      setIsAnimating(false);
      const timer = setTimeout(() => setShouldRender(false), duration);
      return () => clearTimeout(timer);
    }
  }, [show, duration]);
  
  if (!shouldRender) return null;
  
  const AnimationComponent = {
    fade: FadeIn,
    scale: ScaleIn,
    slide: SlideIn,
  }[animation];
  
  return (
    <AnimationComponent show={isAnimating} duration={duration}>
      {children}
    </AnimationComponent>
  );
}

// ============================================================================
// Loading Spinner Animation
// ============================================================================

interface AnimatedSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  className?: string;
}

export function AnimatedSpinner({
  size = 'md',
  color = 'currentColor',
  className,
}: AnimatedSpinnerProps) {
  const sizes = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };
  
  return (
    <svg
      className={clsx('animate-spin', sizes[size], className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke={color}
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill={color}
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

// ============================================================================
// Pulse Animation Wrapper
// ============================================================================

interface PulseProps {
  children: React.ReactNode;
  active?: boolean;
  className?: string;
}

export function Pulse({ children, active = true, className }: PulseProps) {
  return (
    <div className={clsx(active && 'animate-pulse', className)}>
      {children}
    </div>
  );
}

// ============================================================================
// Shake Animation (for errors)
// ============================================================================

interface ShakeProps {
  children: React.ReactNode;
  trigger?: boolean;
  className?: string;
}

export function Shake({ children, trigger = false, className }: ShakeProps) {
  const [isShaking, setIsShaking] = useState(false);
  
  useEffect(() => {
    if (trigger) {
      setIsShaking(true);
      const timer = setTimeout(() => setIsShaking(false), 500);
      return () => clearTimeout(timer);
    }
  }, [trigger]);
  
  return (
    <div
      className={clsx(
        isShaking && 'animate-shake',
        className
      )}
    >
      {children}
    </div>
  );
}

// ============================================================================
// useReducedMotion Hook
// ============================================================================

export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);
  
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);
    
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);
  
  return reducedMotion;
}

// ============================================================================
// Export Default
// ============================================================================

export default {
  // Constants
  DURATIONS,
  EASINGS,
  transitions,
  keyframes,
  // Components
  FadeIn,
  SlideIn,
  ScaleIn,
  Stagger,
  Collapse,
  AnimatePresence,
  AnimatedSpinner,
  Pulse,
  Shake,
  // Hooks
  useReducedMotion,
};
