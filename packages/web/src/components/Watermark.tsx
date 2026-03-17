/**
 * Watermark.tsx
 * CRITICAL-55: Watermark and branding overlay components
 *
 * Document watermarks, image protection, branding overlays,
 * and anti-screenshot patterns for content protection.
 *
 * @module Watermark
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
import { Shield, Lock, Eye, EyeOff } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export type WatermarkType = 'text' | 'image' | 'pattern';
export type WatermarkPosition =
  | 'center'
  | 'tile'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'diagonal';

export interface WatermarkConfig {
  type?: WatermarkType;
  text?: string;
  image?: string;
  opacity?: number;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  color?: string;
  rotate?: number;
  gap?: number;
  position?: WatermarkPosition;
  zIndex?: number;
}

// ============================================================================
// Context
// ============================================================================

interface WatermarkContextValue {
  config: WatermarkConfig;
  updateConfig: (config: Partial<WatermarkConfig>) => void;
  isEnabled: boolean;
  toggle: () => void;
  enable: () => void;
  disable: () => void;
}

const WatermarkContext = createContext<WatermarkContextValue | null>(null);

export function useWatermark(): WatermarkContextValue {
  const context = useContext(WatermarkContext);
  if (!context) {
    throw new Error('useWatermark must be used within a WatermarkProvider');
  }
  return context;
}

// ============================================================================
// Utility Functions
// ============================================================================

function generateWatermarkPattern(config: WatermarkConfig): string {
  const {
    text = 'CONFIDENTIAL',
    fontSize = 16,
    fontFamily = 'Arial, sans-serif',
    fontWeight = 'bold',
    color = 'rgba(0, 0, 0, 0.1)',
    rotate = -30,
    gap = 100,
  } = config;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Calculate text dimensions
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;
  const textHeight = fontSize;

  // Calculate canvas size with rotation
  const angle = (rotate * Math.PI) / 180;
  const rotatedWidth = Math.abs(textWidth * Math.cos(angle)) + Math.abs(textHeight * Math.sin(angle));
  const rotatedHeight = Math.abs(textWidth * Math.sin(angle)) + Math.abs(textHeight * Math.cos(angle));

  canvas.width = rotatedWidth + gap;
  canvas.height = rotatedHeight + gap;

  // Draw watermark
  ctx.fillStyle = color;
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(angle);
  ctx.fillText(text, 0, 0);

  return canvas.toDataURL();
}

function generateImagePattern(
  imageSrc: string,
  config: WatermarkConfig
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      const gap = config.gap || 50;
      const rotate = config.rotate || 0;
      const angle = (rotate * Math.PI) / 180;

      // Calculate rotated dimensions
      const rotatedWidth = Math.abs(img.width * Math.cos(angle)) + Math.abs(img.height * Math.sin(angle));
      const rotatedHeight = Math.abs(img.width * Math.sin(angle)) + Math.abs(img.height * Math.cos(angle));

      canvas.width = rotatedWidth + gap;
      canvas.height = rotatedHeight + gap;

      ctx.globalAlpha = config.opacity || 0.1;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(angle);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      resolve(canvas.toDataURL());
    };
    img.onerror = reject;
    img.src = imageSrc;
  });
}

// ============================================================================
// WatermarkProvider Component
// ============================================================================

export interface WatermarkProviderProps {
  defaultConfig?: WatermarkConfig;
  defaultEnabled?: boolean;
  children: ReactNode;
}

export function WatermarkProvider({
  defaultConfig = {},
  defaultEnabled = true,
  children,
}: WatermarkProviderProps) {
  const [config, setConfig] = useState<WatermarkConfig>({
    type: 'text',
    text: 'CONFIDENTIAL',
    opacity: 0.1,
    fontSize: 16,
    fontFamily: 'Arial, sans-serif',
    fontWeight: 'bold',
    color: 'rgba(0, 0, 0, 0.15)',
    rotate: -30,
    gap: 100,
    position: 'tile',
    zIndex: 9999,
    ...defaultConfig,
  });

  const [isEnabled, setIsEnabled] = useState(defaultEnabled);

  const updateConfig = useCallback((newConfig: Partial<WatermarkConfig>) => {
    setConfig((prev) => ({ ...prev, ...newConfig }));
  }, []);

  const toggle = useCallback(() => setIsEnabled((prev) => !prev), []);
  const enable = useCallback(() => setIsEnabled(true), []);
  const disable = useCallback(() => setIsEnabled(false), []);

  const contextValue = useMemo<WatermarkContextValue>(
    () => ({
      config,
      updateConfig,
      isEnabled,
      toggle,
      enable,
      disable,
    }),
    [config, updateConfig, isEnabled, toggle, enable, disable]
  );

  return (
    <WatermarkContext.Provider value={contextValue}>
      {children}
    </WatermarkContext.Provider>
  );
}

// ============================================================================
// Watermark Component
// ============================================================================

export interface WatermarkProps extends HTMLAttributes<HTMLDivElement> {
  text?: string;
  image?: string;
  type?: WatermarkType;
  opacity?: number;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  color?: string;
  rotate?: number;
  gap?: number;
  position?: WatermarkPosition;
  zIndex?: number;
  fullscreen?: boolean;
  children?: ReactNode;
}

export const Watermark = forwardRef<HTMLDivElement, WatermarkProps>(
  (
    {
      text = 'CONFIDENTIAL',
      image,
      type = 'text',
      opacity = 0.1,
      fontSize = 16,
      fontFamily = 'Arial, sans-serif',
      fontWeight = 'bold',
      color = 'rgba(0, 0, 0, 0.15)',
      rotate = -30,
      gap = 100,
      position = 'tile',
      zIndex = 9999,
      fullscreen = false,
      children,
      className,
      style,
      ...props
    },
    ref
  ) => {
    const [patternUrl, setPatternUrl] = useState<string>('');

    useEffect(() => {
      const config: WatermarkConfig = {
        type,
        text,
        image,
        opacity,
        fontSize,
        fontFamily,
        fontWeight,
        color,
        rotate,
        gap,
      };

      if (type === 'text') {
        setPatternUrl(generateWatermarkPattern(config));
      } else if (type === 'image' && image) {
        generateImagePattern(image, config)
          .then(setPatternUrl)
          .catch(console.error);
      }
    }, [type, text, image, opacity, fontSize, fontFamily, fontWeight, color, rotate, gap]);

    const getPositionStyle = (): CSSProperties => {
      const baseStyle: CSSProperties = {
        position: 'absolute',
        pointerEvents: 'none',
        zIndex,
      };

      if (position === 'tile') {
        return {
          ...baseStyle,
          inset: 0,
          backgroundImage: `url(${patternUrl})`,
          backgroundRepeat: 'repeat',
        };
      }

      if (position === 'center') {
        return {
          ...baseStyle,
          inset: 0,
          backgroundImage: `url(${patternUrl})`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
        };
      }

      if (position === 'diagonal') {
        return {
          ...baseStyle,
          inset: 0,
          backgroundImage: `url(${patternUrl})`,
          backgroundRepeat: 'repeat',
        };
      }

      const positionMap: Record<string, CSSProperties> = {
        'top-left': { top: 20, left: 20 },
        'top-right': { top: 20, right: 20 },
        'bottom-left': { bottom: 20, left: 20 },
        'bottom-right': { bottom: 20, right: 20 },
      };

      return {
        ...baseStyle,
        ...positionMap[position],
        backgroundImage: `url(${patternUrl})`,
        backgroundRepeat: 'no-repeat',
        width: 'auto',
        height: 'auto',
      };
    };

    if (fullscreen) {
      return (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            zIndex,
            backgroundImage: `url(${patternUrl})`,
            backgroundRepeat: 'repeat',
          }}
        />
      );
    }

    return (
      <div
        ref={ref}
        className={clsx('relative', className)}
        style={style}
        {...props}
      >
        {children}
        {patternUrl && <div style={getPositionStyle()} aria-hidden="true" />}
      </div>
    );
  }
);

Watermark.displayName = 'Watermark';

// ============================================================================
// UserWatermark Component
// ============================================================================

export interface UserWatermarkProps extends Omit<WatermarkProps, 'text'> {
  username?: string;
  userId?: string;
  timestamp?: boolean;
  format?: 'simple' | 'detailed';
}

export const UserWatermark = forwardRef<HTMLDivElement, UserWatermarkProps>(
  (
    {
      username,
      userId,
      timestamp = false,
      format = 'simple',
      ...props
    },
    ref
  ) => {
    const watermarkText = useMemo(() => {
      const parts: string[] = [];

      if (username) parts.push(username);
      if (userId) parts.push(format === 'detailed' ? `ID: ${userId}` : userId);
      if (timestamp) {
        const date = new Date().toLocaleString();
        parts.push(format === 'detailed' ? `Date: ${date}` : date);
      }

      return parts.join(' | ');
    }, [username, userId, timestamp, format]);

    return <Watermark ref={ref} text={watermarkText} {...props} />;
  }
);

UserWatermark.displayName = 'UserWatermark';

// ============================================================================
// ProtectedImage Component
// ============================================================================

export interface ProtectedImageProps extends HTMLAttributes<HTMLDivElement> {
  src: string;
  alt: string;
  watermark?: string | WatermarkConfig;
  preventContextMenu?: boolean;
  preventDrag?: boolean;
  preventSelection?: boolean;
  blur?: boolean;
  blurAmount?: number;
  overlay?: boolean;
  width?: number | string;
  height?: number | string;
}

export const ProtectedImage = forwardRef<HTMLDivElement, ProtectedImageProps>(
  (
    {
      src,
      alt,
      watermark,
      preventContextMenu = true,
      preventDrag = true,
      preventSelection = true,
      blur = false,
      blurAmount = 5,
      overlay = true,
      width,
      height,
      className,
      style,
      ...props
    },
    ref
  ) => {
    const handleContextMenu = useCallback(
      (e: React.MouseEvent) => {
        if (preventContextMenu) {
          e.preventDefault();
        }
      },
      [preventContextMenu]
    );

    const handleDragStart = useCallback(
      (e: React.DragEvent) => {
        if (preventDrag) {
          e.preventDefault();
        }
      },
      [preventDrag]
    );

    const watermarkConfig: WatermarkConfig | null = useMemo(() => {
      if (!watermark) return null;
      if (typeof watermark === 'string') {
        return { text: watermark, type: 'text' as WatermarkType };
      }
      return watermark;
    }, [watermark]);

    return (
      <div
        ref={ref}
        className={clsx('relative overflow-hidden', className)}
        style={{ width, height, ...style }}
        onContextMenu={handleContextMenu}
        {...props}
      >
        {/* Image */}
        <img
          src={src}
          alt={alt}
          className={clsx(
            'w-full h-full object-cover',
            preventSelection && 'select-none',
            blur && 'transition-all duration-300'
          )}
          style={blur ? { filter: `blur(${blurAmount}px)` } : undefined}
          draggable={!preventDrag}
          onDragStart={handleDragStart}
        />

        {/* Transparent overlay to block interactions */}
        {overlay && (
          <div className="absolute inset-0 bg-transparent" aria-hidden="true" />
        )}

        {/* Watermark */}
        {watermarkConfig && (
          <div className="absolute inset-0 pointer-events-none">
            <Watermark
              {...watermarkConfig}
              className="w-full h-full"
              fullscreen={false}
            />
          </div>
        )}
      </div>
    );
  }
);

ProtectedImage.displayName = 'ProtectedImage';

// ============================================================================
// ConfidentialBadge Component
// ============================================================================

export interface ConfidentialBadgeProps extends HTMLAttributes<HTMLDivElement> {
  level?: 'public' | 'internal' | 'confidential' | 'secret' | 'top-secret';
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const ConfidentialBadge = forwardRef<HTMLDivElement, ConfidentialBadgeProps>(
  (
    {
      level = 'confidential',
      showIcon = true,
      size = 'md',
      className,
      ...props
    },
    ref
  ) => {
    const levelConfig = {
      public: {
        label: 'Public',
        icon: Eye,
        bgColor: 'bg-green-100',
        textColor: 'text-green-800',
        borderColor: 'border-green-300',
      },
      internal: {
        label: 'Internal',
        icon: EyeOff,
        bgColor: 'bg-blue-100',
        textColor: 'text-blue-800',
        borderColor: 'border-blue-300',
      },
      confidential: {
        label: 'Confidential',
        icon: Shield,
        bgColor: 'bg-yellow-100',
        textColor: 'text-yellow-800',
        borderColor: 'border-yellow-300',
      },
      secret: {
        label: 'Secret',
        icon: Lock,
        bgColor: 'bg-orange-100',
        textColor: 'text-orange-800',
        borderColor: 'border-orange-300',
      },
      'top-secret': {
        label: 'Top Secret',
        icon: Lock,
        bgColor: 'bg-red-100',
        textColor: 'text-red-800',
        borderColor: 'border-red-300',
      },
    };

    const config = levelConfig[level];
    const Icon = config.icon;

    const sizeClasses = {
      sm: 'px-2 py-0.5 text-xs',
      md: 'px-3 py-1 text-sm',
      lg: 'px-4 py-1.5 text-base',
    };

    const iconSizes = {
      sm: 'w-3 h-3',
      md: 'w-4 h-4',
      lg: 'w-5 h-5',
    };

    return (
      <div
        ref={ref}
        className={clsx(
          'inline-flex items-center gap-1.5 font-semibold uppercase tracking-wide rounded border',
          config.bgColor,
          config.textColor,
          config.borderColor,
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {showIcon && <Icon className={iconSizes[size]} />}
        <span>{config.label}</span>
      </div>
    );
  }
);

ConfidentialBadge.displayName = 'ConfidentialBadge';

// ============================================================================
// AntiScreenshot Component
// ============================================================================

export interface AntiScreenshotProps extends HTMLAttributes<HTMLDivElement> {
  pattern?: 'grid' | 'lines' | 'dots';
  intensity?: 'low' | 'medium' | 'high';
  children: ReactNode;
}

export const AntiScreenshot = forwardRef<HTMLDivElement, AntiScreenshotProps>(
  (
    {
      pattern = 'grid',
      intensity = 'low',
      children,
      className,
      ...props
    },
    ref
  ) => {
    const intensityMap = {
      low: 0.02,
      medium: 0.05,
      high: 0.1,
    };

    const patternStyles: Record<string, CSSProperties> = {
      grid: {
        backgroundImage: `
          linear-gradient(rgba(255,255,255,${intensityMap[intensity]}) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,${intensityMap[intensity]}) 1px, transparent 1px)
        `,
        backgroundSize: '20px 20px',
      },
      lines: {
        backgroundImage: `
          repeating-linear-gradient(
            45deg,
            rgba(255,255,255,${intensityMap[intensity]}),
            rgba(255,255,255,${intensityMap[intensity]}) 1px,
            transparent 1px,
            transparent 10px
          )
        `,
      },
      dots: {
        backgroundImage: `
          radial-gradient(
            circle,
            rgba(255,255,255,${intensityMap[intensity]}) 1px,
            transparent 1px
          )
        `,
        backgroundSize: '10px 10px',
      },
    };

    return (
      <div
        ref={ref}
        className={clsx('relative', className)}
        {...props}
      >
        {children}
        <div
          className="absolute inset-0 pointer-events-none z-50"
          style={patternStyles[pattern]}
          aria-hidden="true"
        />
      </div>
    );
  }
);

AntiScreenshot.displayName = 'AntiScreenshot';

// ============================================================================
// CopyProtection Component
// ============================================================================

export interface CopyProtectionProps extends HTMLAttributes<HTMLDivElement> {
  preventCopy?: boolean;
  preventPaste?: boolean;
  preventCut?: boolean;
  preventPrint?: boolean;
  preventScreenshot?: boolean;
  onAttempt?: (action: 'copy' | 'paste' | 'cut' | 'print' | 'screenshot') => void;
  message?: string;
  children: ReactNode;
}

export const CopyProtection = forwardRef<HTMLDivElement, CopyProtectionProps>(
  (
    {
      preventCopy = true,
      preventPaste = false,
      preventCut = true,
      preventPrint = false,
      preventScreenshot = false,
      onAttempt,
      message = 'This content is protected.',
      children,
      className,
      ...props
    },
    ref
  ) => {
    useEffect(() => {
      const handleCopy = (e: ClipboardEvent) => {
        if (preventCopy) {
          e.preventDefault();
          onAttempt?.('copy');
        }
      };

      const handlePaste = (e: ClipboardEvent) => {
        if (preventPaste) {
          e.preventDefault();
          onAttempt?.('paste');
        }
      };

      const handleCut = (e: ClipboardEvent) => {
        if (preventCut) {
          e.preventDefault();
          onAttempt?.('cut');
        }
      };

      const handleKeyDown = (e: KeyboardEvent) => {
        // Prevent Ctrl+P (print)
        if (preventPrint && e.ctrlKey && e.key === 'p') {
          e.preventDefault();
          onAttempt?.('print');
        }

        // Prevent Print Screen
        if (preventScreenshot && e.key === 'PrintScreen') {
          e.preventDefault();
          onAttempt?.('screenshot');
        }
      };

      const handleBeforePrint = (e: Event) => {
        if (preventPrint) {
          e.preventDefault();
          onAttempt?.('print');
        }
      };

      document.addEventListener('copy', handleCopy);
      document.addEventListener('paste', handlePaste);
      document.addEventListener('cut', handleCut);
      document.addEventListener('keydown', handleKeyDown);
      window.addEventListener('beforeprint', handleBeforePrint);

      return () => {
        document.removeEventListener('copy', handleCopy);
        document.removeEventListener('paste', handlePaste);
        document.removeEventListener('cut', handleCut);
        document.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('beforeprint', handleBeforePrint);
      };
    }, [preventCopy, preventPaste, preventCut, preventPrint, preventScreenshot, onAttempt]);

    return (
      <div
        ref={ref}
        className={clsx('select-none', className)}
        onContextMenu={(e) => {
          if (preventCopy) {
            e.preventDefault();
          }
        }}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CopyProtection.displayName = 'CopyProtection';

// ============================================================================
// Branded Watermark Component
// ============================================================================

export interface BrandedWatermarkProps extends HTMLAttributes<HTMLDivElement> {
  logo?: string;
  companyName?: string;
  tagline?: string;
  position?: WatermarkPosition;
  opacity?: number;
  children: ReactNode;
}

export const BrandedWatermark = forwardRef<HTMLDivElement, BrandedWatermarkProps>(
  (
    {
      logo,
      companyName,
      tagline,
      position = 'bottom-right',
      opacity = 0.3,
      children,
      className,
      ...props
    },
    ref
  ) => {
    const positionClasses: Record<WatermarkPosition, string> = {
      center: 'inset-0 flex items-center justify-center',
      tile: 'inset-0',
      'top-left': 'top-4 left-4',
      'top-right': 'top-4 right-4',
      'bottom-left': 'bottom-4 left-4',
      'bottom-right': 'bottom-4 right-4',
      diagonal: 'inset-0 flex items-center justify-center',
    };

    return (
      <div
        ref={ref}
        className={clsx('relative', className)}
        {...props}
      >
        {children}
        <div
          className={clsx(
            'absolute pointer-events-none',
            positionClasses[position]
          )}
          style={{ opacity }}
        >
          <div
            className={clsx(
              'flex items-center gap-2',
              position === 'diagonal' && 'transform -rotate-30'
            )}
          >
            {logo && (
              <img
                src={logo}
                alt={companyName || 'Brand logo'}
                className="w-8 h-8 object-contain"
              />
            )}
            {(companyName || tagline) && (
              <div className="text-gray-500">
                {companyName && (
                  <div className="font-semibold text-sm">{companyName}</div>
                )}
                {tagline && (
                  <div className="text-xs">{tagline}</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
);

BrandedWatermark.displayName = 'BrandedWatermark';

// ============================================================================
// useWatermarkGenerator Hook
// ============================================================================

export function useWatermarkGenerator(config: WatermarkConfig) {
  const [patternUrl, setPatternUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const generatePattern = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (config.type === 'text') {
        const url = generateWatermarkPattern(config);
        setPatternUrl(url);
      } else if (config.type === 'image' && config.image) {
        const url = await generateImagePattern(config.image, config);
        setPatternUrl(url);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to generate watermark'));
    } finally {
      setIsLoading(false);
    }
  }, [config]);

  useEffect(() => {
    generatePattern();
  }, [generatePattern]);

  return {
    patternUrl,
    isLoading,
    error,
    regenerate: generatePattern,
  };
}

// ============================================================================
// Exports
// ============================================================================

export default Watermark;
