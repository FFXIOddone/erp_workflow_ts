/**
 * Confetti.tsx
 * CRITICAL-52: Celebration and confetti animation components
 *
 * Confetti explosions, particle effects, and celebration animations
 * for success states, achievements, and special moments.
 *
 * @module Confetti
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  forwardRef,
  type ReactNode,
  type HTMLAttributes,
  type CSSProperties,
} from 'react';
import clsx from 'clsx';
import { Sparkles, PartyPopper, Star, Heart, Gift } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  color: string;
  size: number;
  shape: 'square' | 'circle' | 'triangle' | 'star' | 'heart';
  opacity: number;
  gravity: number;
  friction: number;
}

export interface ConfettiConfig {
  particleCount?: number;
  spread?: number;
  startVelocity?: number;
  decay?: number;
  gravity?: number;
  drift?: number;
  ticks?: number;
  origin?: { x: number; y: number };
  colors?: string[];
  shapes?: Particle['shape'][];
  scalar?: number;
  zIndex?: number;
  disableForReducedMotion?: boolean;
}

export type ConfettiPreset = 'celebration' | 'fireworks' | 'snow' | 'hearts' | 'stars' | 'money';

// ============================================================================
// Default Colors
// ============================================================================

export const DEFAULT_COLORS = [
  '#ff577f', // Pink
  '#ff884d', // Orange
  '#ffde59', // Yellow
  '#7eff6b', // Green
  '#6bc5ff', // Blue
  '#c56bff', // Purple
  '#ff6b6b', // Red
];

export const PRESET_COLORS: Record<ConfettiPreset, string[]> = {
  celebration: DEFAULT_COLORS,
  fireworks: ['#ff0000', '#ffa500', '#ffff00', '#00ff00', '#0000ff', '#9400d3'],
  snow: ['#ffffff', '#f0f0f0', '#e0e0e0', '#d0d0d0'],
  hearts: ['#ff1744', '#ff4081', '#f50057', '#c51162', '#ff6090'],
  stars: ['#ffd700', '#ffed4a', '#fff59d', '#ffff8d', '#ffea00'],
  money: ['#4caf50', '#81c784', '#a5d6a7', '#c8e6c9', '#66bb6a'],
};

// ============================================================================
// Context
// ============================================================================

interface ConfettiContextValue {
  fire: (config?: ConfettiConfig) => void;
  firePreset: (preset: ConfettiPreset) => void;
  stop: () => void;
  isActive: boolean;
}

const ConfettiContext = createContext<ConfettiContextValue | null>(null);

export function useConfetti(): ConfettiContextValue {
  const context = useContext(ConfettiContext);
  if (!context) {
    throw new Error('useConfetti must be used within a ConfettiProvider');
  }
  return context;
}

// ============================================================================
// Utilities
// ============================================================================

function randomInRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function createParticle(
  id: number,
  origin: { x: number; y: number },
  config: ConfettiConfig
): Particle {
  const {
    spread = 50,
    startVelocity = 30,
    colors = DEFAULT_COLORS,
    shapes = ['square', 'circle'],
    scalar = 1,
    gravity = 1,
    drift = 0,
  } = config;

  const angle = (90 + randomInRange(-spread, spread)) * (Math.PI / 180);
  const velocity = startVelocity * randomInRange(0.4, 1);

  return {
    id,
    x: origin.x * window.innerWidth,
    y: origin.y * window.innerHeight,
    vx: Math.cos(angle) * velocity + drift * randomInRange(-1, 1),
    vy: -Math.sin(angle) * velocity,
    rotation: randomInRange(0, 360),
    rotationSpeed: randomInRange(-10, 10),
    color: colors[Math.floor(Math.random() * colors.length)],
    size: randomInRange(8, 16) * scalar,
    shape: shapes[Math.floor(Math.random() * shapes.length)],
    opacity: 1,
    gravity: gravity * 0.5,
    friction: 0.99,
  };
}

// ============================================================================
// ConfettiProvider Component
// ============================================================================

export interface ConfettiProviderProps {
  children: ReactNode;
  zIndex?: number;
}

export function ConfettiProvider({ children, zIndex = 9999 }: ConfettiProviderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number | null>(null);
  const [isActive, setIsActive] = useState(false);

  // Animation loop
  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const particles = particlesRef.current;
    let activeCount = 0;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];

      // Update physics
      p.vy += p.gravity;
      p.vx *= p.friction;
      p.vy *= p.friction;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.rotationSpeed;
      p.opacity -= 0.005;

      // Skip if off screen or faded
      if (p.opacity <= 0 || p.y > canvas.height + p.size) {
        continue;
      }

      activeCount++;

      // Draw particle
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color;

      const halfSize = p.size / 2;

      switch (p.shape) {
        case 'circle':
          ctx.beginPath();
          ctx.arc(0, 0, halfSize, 0, Math.PI * 2);
          ctx.fill();
          break;

        case 'triangle':
          ctx.beginPath();
          ctx.moveTo(0, -halfSize);
          ctx.lineTo(halfSize, halfSize);
          ctx.lineTo(-halfSize, halfSize);
          ctx.closePath();
          ctx.fill();
          break;

        case 'star':
          ctx.beginPath();
          for (let j = 0; j < 5; j++) {
            const angle = (j * 4 * Math.PI) / 5 - Math.PI / 2;
            const x = Math.cos(angle) * halfSize;
            const y = Math.sin(angle) * halfSize;
            if (j === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.fill();
          break;

        case 'heart':
          ctx.beginPath();
          ctx.moveTo(0, halfSize * 0.3);
          ctx.bezierCurveTo(halfSize, -halfSize * 0.5, halfSize, halfSize * 0.3, 0, halfSize);
          ctx.bezierCurveTo(-halfSize, halfSize * 0.3, -halfSize, -halfSize * 0.5, 0, halfSize * 0.3);
          ctx.fill();
          break;

        case 'square':
        default:
          ctx.fillRect(-halfSize, -halfSize, p.size, p.size);
          break;
      }

      ctx.restore();
    }

    if (activeCount > 0) {
      animationRef.current = requestAnimationFrame(animate);
    } else {
      setIsActive(false);
      particlesRef.current = [];
    }
  }, []);

  // Fire confetti
  const fire = useCallback(
    (config: ConfettiConfig = {}) => {
      const {
        particleCount = 50,
        origin = { x: 0.5, y: 0.5 },
        disableForReducedMotion = true,
      } = config;

      // Check for reduced motion preference
      if (
        disableForReducedMotion &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        return;
      }

      // Create particles
      const newParticles: Particle[] = [];
      const startId = particlesRef.current.length;

      for (let i = 0; i < particleCount; i++) {
        newParticles.push(createParticle(startId + i, origin, config));
      }

      particlesRef.current = [...particlesRef.current, ...newParticles];

      if (!isActive) {
        setIsActive(true);
        animationRef.current = requestAnimationFrame(animate);
      }
    },
    [isActive, animate]
  );

  // Fire preset
  const firePreset = useCallback(
    (preset: ConfettiPreset) => {
      const presetConfigs: Record<ConfettiPreset, ConfettiConfig> = {
        celebration: {
          particleCount: 100,
          spread: 70,
          startVelocity: 35,
          colors: PRESET_COLORS.celebration,
        },
        fireworks: {
          particleCount: 150,
          spread: 360,
          startVelocity: 45,
          gravity: 0.5,
          colors: PRESET_COLORS.fireworks,
          origin: { x: 0.5, y: 0.3 },
        },
        snow: {
          particleCount: 200,
          spread: 180,
          startVelocity: 5,
          gravity: 0.2,
          colors: PRESET_COLORS.snow,
          shapes: ['circle'],
          scalar: 0.5,
          origin: { x: 0.5, y: 0 },
        },
        hearts: {
          particleCount: 50,
          spread: 60,
          startVelocity: 25,
          colors: PRESET_COLORS.hearts,
          shapes: ['heart'],
          scalar: 1.5,
        },
        stars: {
          particleCount: 80,
          spread: 100,
          startVelocity: 30,
          colors: PRESET_COLORS.stars,
          shapes: ['star'],
        },
        money: {
          particleCount: 60,
          spread: 50,
          startVelocity: 20,
          colors: PRESET_COLORS.money,
          shapes: ['square'],
        },
      };

      fire(presetConfigs[preset]);
    },
    [fire]
  );

  // Stop confetti
  const stop = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    particlesRef.current = [];
    setIsActive(false);

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, []);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const contextValue = useMemo<ConfettiContextValue>(
    () => ({
      fire,
      firePreset,
      stop,
      isActive,
    }),
    [fire, firePreset, stop, isActive]
  );

  return (
    <ConfettiContext.Provider value={contextValue}>
      {children}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none"
        style={{ zIndex }}
      />
    </ConfettiContext.Provider>
  );
}

// ============================================================================
// ConfettiButton Component
// ============================================================================

export interface ConfettiButtonProps extends HTMLAttributes<HTMLButtonElement> {
  preset?: ConfettiPreset;
  config?: ConfettiConfig;
  children?: ReactNode;
  disabled?: boolean;
}

export const ConfettiButton = forwardRef<HTMLButtonElement, ConfettiButtonProps>(
  (
    {
      preset = 'celebration',
      config,
      children,
      disabled = false,
      className,
      onClick,
      ...props
    },
    ref
  ) => {
    const { fire, firePreset } = useConfetti();

    const handleClick = useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        if (config) {
          fire(config);
        } else {
          firePreset(preset);
        }
        onClick?.(e);
      },
      [config, fire, firePreset, preset, onClick]
    );

    return (
      <button
        ref={ref}
        type="button"
        className={clsx(
          'inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
          'bg-gradient-to-r from-pink-500 to-purple-500 text-white',
          'hover:from-pink-600 hover:to-purple-600',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          className
        )}
        onClick={handleClick}
        disabled={disabled}
        {...props}
      >
        <PartyPopper className="w-5 h-5" />
        {children || 'Celebrate!'}
      </button>
    );
  }
);

ConfettiButton.displayName = 'ConfettiButton';

// ============================================================================
// Sparkle Component
// ============================================================================

export interface SparkleProps extends HTMLAttributes<HTMLSpanElement> {
  color?: string;
  size?: number;
  minDelay?: number;
  maxDelay?: number;
  children: ReactNode;
}

interface SparkleInstance {
  id: number;
  createdAt: number;
  size: number;
  style: CSSProperties;
}

export const Sparkle = forwardRef<HTMLSpanElement, SparkleProps>(
  (
    {
      color = '#ffc107',
      size = 20,
      minDelay = 100,
      maxDelay = 500,
      children,
      className,
      ...props
    },
    ref
  ) => {
    const [sparkles, setSparkles] = useState<SparkleInstance[]>([]);
    const prefersReducedMotion = useRef(
      typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );

    useEffect(() => {
      if (prefersReducedMotion.current) return;

      const generateSparkle = (): SparkleInstance => ({
        id: Date.now() + Math.random(),
        createdAt: Date.now(),
        size: randomInRange(size * 0.5, size),
        style: {
          top: `${randomInRange(0, 100)}%`,
          left: `${randomInRange(0, 100)}%`,
          zIndex: 2,
        },
      });

      const addSparkle = () => {
        const sparkle = generateSparkle();
        const now = Date.now();

        setSparkles((s) => {
          // Remove old sparkles
          const next = s.filter((sp) => now - sp.createdAt < 750);
          return [...next, sparkle];
        });
      };

      let timeoutId: number;

      const scheduleSparkle = () => {
        const delay = randomInRange(minDelay, maxDelay);
        timeoutId = window.setTimeout(() => {
          addSparkle();
          scheduleSparkle();
        }, delay);
      };

      scheduleSparkle();

      return () => clearTimeout(timeoutId);
    }, [size, minDelay, maxDelay]);

    return (
      <span ref={ref} className={clsx('relative inline-block', className)} {...props}>
        {sparkles.map((sparkle) => (
          <span
            key={sparkle.id}
            className="absolute pointer-events-none animate-ping"
            style={{
              ...sparkle.style,
              width: sparkle.size,
              height: sparkle.size,
            }}
          >
            <svg
              width={sparkle.size}
              height={sparkle.size}
              viewBox="0 0 160 160"
              fill="none"
            >
              <path
                d="M80 0C80 0 84.2846 41.2925 101.496 58.504C118.707 75.7154 160 80 160 80C160 80 118.707 84.2846 101.496 101.496C84.2846 118.707 80 160 80 160C80 160 75.7154 118.707 58.504 101.496C41.2925 84.2846 0 80 0 80C0 80 41.2925 75.7154 58.504 58.504C75.7154 41.2925 80 0 80 0Z"
                fill={color}
              />
            </svg>
          </span>
        ))}
        <span className="relative z-[1]">{children}</span>
      </span>
    );
  }
);

Sparkle.displayName = 'Sparkle';

// ============================================================================
// CelebrationBanner Component
// ============================================================================

export interface CelebrationBannerProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  message?: string;
  icon?: ReactNode;
  variant?: 'success' | 'achievement' | 'special';
  confettiOnMount?: boolean;
  dismissible?: boolean;
  onDismiss?: () => void;
}

export const CelebrationBanner = forwardRef<HTMLDivElement, CelebrationBannerProps>(
  (
    {
      title,
      message,
      icon,
      variant = 'success',
      confettiOnMount = true,
      dismissible = true,
      onDismiss,
      className,
      ...props
    },
    ref
  ) => {
    const { firePreset } = useConfetti();
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
      if (confettiOnMount) {
        firePreset('celebration');
      }
    }, [confettiOnMount, firePreset]);

    if (!isVisible) return null;

    const variantStyles = {
      success: {
        bg: 'bg-gradient-to-r from-green-500 to-emerald-500',
        icon: <Star className="w-8 h-8" />,
      },
      achievement: {
        bg: 'bg-gradient-to-r from-yellow-500 to-orange-500',
        icon: <Gift className="w-8 h-8" />,
      },
      special: {
        bg: 'bg-gradient-to-r from-purple-500 to-pink-500',
        icon: <Heart className="w-8 h-8" />,
      },
    };

    const { bg, icon: defaultIcon } = variantStyles[variant];

    return (
      <div
        ref={ref}
        className={clsx(
          'relative overflow-hidden rounded-xl p-6 text-white',
          bg,
          className
        )}
        {...props}
      >
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-1/2 -right-1/4 w-96 h-96 rounded-full bg-white/10" />
          <div className="absolute -bottom-1/2 -left-1/4 w-96 h-96 rounded-full bg-white/10" />
        </div>

        {/* Content */}
        <div className="relative flex items-center gap-4">
          <div className="shrink-0 p-3 bg-white/20 rounded-full">
            {icon || defaultIcon}
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold">{title}</h3>
            {message && <p className="text-white/90 mt-1">{message}</p>}
          </div>
          {dismissible && (
            <button
              type="button"
              className="shrink-0 p-2 rounded-full hover:bg-white/20 transition-colors"
              onClick={() => {
                setIsVisible(false);
                onDismiss?.();
              }}
            >
              <span className="sr-only">Dismiss</span>
              ×
            </button>
          )}
        </div>
      </div>
    );
  }
);

CelebrationBanner.displayName = 'CelebrationBanner';

// ============================================================================
// SuccessAnimation Component
// ============================================================================

export interface SuccessAnimationProps extends HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'checkmark' | 'stars' | 'confetti';
  message?: string;
  autoHide?: boolean;
  hideDelay?: number;
  onComplete?: () => void;
}

export const SuccessAnimation = forwardRef<HTMLDivElement, SuccessAnimationProps>(
  (
    {
      size = 'md',
      variant = 'checkmark',
      message,
      autoHide = false,
      hideDelay = 3000,
      onComplete,
      className,
      ...props
    },
    ref
  ) => {
    const [isVisible, setIsVisible] = useState(true);
    const { firePreset } = useConfetti();

    useEffect(() => {
      if (variant === 'confetti') {
        firePreset('celebration');
      }
    }, [variant, firePreset]);

    useEffect(() => {
      if (autoHide) {
        const timer = setTimeout(() => {
          setIsVisible(false);
          onComplete?.();
        }, hideDelay);
        return () => clearTimeout(timer);
      }
    }, [autoHide, hideDelay, onComplete]);

    if (!isVisible) return null;

    const sizeClasses = {
      sm: 'w-16 h-16',
      md: 'w-24 h-24',
      lg: 'w-32 h-32',
    };

    const iconSizes = {
      sm: 'w-8 h-8',
      md: 'w-12 h-12',
      lg: 'w-16 h-16',
    };

    return (
      <div
        ref={ref}
        className={clsx('flex flex-col items-center gap-4', className)}
        {...props}
      >
        <div
          className={clsx(
            'flex items-center justify-center rounded-full bg-green-100 animate-bounce',
            sizeClasses[size]
          )}
        >
          {variant === 'stars' ? (
            <Sparkles className={clsx(iconSizes[size], 'text-green-600')} />
          ) : (
            <svg
              className={clsx(iconSizes[size], 'text-green-600')}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
                className="animate-[draw_0.5s_ease-in-out_forwards]"
                style={{
                  strokeDasharray: 50,
                  strokeDashoffset: 50,
                  animation: 'draw 0.5s ease-in-out 0.3s forwards',
                }}
              />
            </svg>
          )}
        </div>
        {message && (
          <p className="text-lg font-medium text-gray-900 animate-fade-in">
            {message}
          </p>
        )}
      </div>
    );
  }
);

SuccessAnimation.displayName = 'SuccessAnimation';

// ============================================================================
// useConfettiOnMount Hook
// ============================================================================

export function useConfettiOnMount(preset: ConfettiPreset = 'celebration') {
  const { firePreset, isActive } = useConfetti();

  useEffect(() => {
    firePreset(preset);
  }, [firePreset, preset]);

  return isActive;
}

// ============================================================================
// useConfettiOnSuccess Hook
// ============================================================================

export function useConfettiOnSuccess(condition: boolean, preset: ConfettiPreset = 'celebration') {
  const { firePreset } = useConfetti();
  const hasFired = useRef(false);

  useEffect(() => {
    if (condition && !hasFired.current) {
      hasFired.current = true;
      firePreset(preset);
    }
  }, [condition, firePreset, preset]);
}

// ============================================================================
// Exports
// ============================================================================

export default ConfettiProvider;
