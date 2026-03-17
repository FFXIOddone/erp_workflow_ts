import React, { useMemo } from 'react';
import clsx from 'clsx';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface ProgressRingProps {
  /** Progress value from 0 to 100 */
  value: number;
  /** Size of the ring in pixels */
  size?: number;
  /** Stroke width of the ring */
  strokeWidth?: number;
  /** Color of the progress arc */
  color?: string;
  /** Background track color */
  trackColor?: string;
  /** Whether to show the percentage label */
  showLabel?: boolean;
  /** Custom label content */
  label?: React.ReactNode;
  /** Custom className */
  className?: string;
  /** Whether to animate the progress */
  animate?: boolean;
  /** Rotation start position in degrees (0 = top, 90 = right, etc.) */
  rotation?: number;
  /** Whether to show a gradient */
  gradient?: boolean;
  /** Gradient colors */
  gradientColors?: [string, string];
}

export interface ProgressRingWithIconProps extends ProgressRingProps {
  icon: React.ReactNode;
  iconColor?: string;
}

export interface MultiProgressRingProps {
  /** Multiple progress segments */
  segments: {
    value: number;
    color: string;
    label?: string;
  }[];
  size?: number;
  strokeWidth?: number;
  trackColor?: string;
  showLabel?: boolean;
  className?: string;
}

// ============================================================================
// Color Utilities
// ============================================================================

const colorMap: Record<string, string> = {
  blue: '#3B82F6',
  green: '#10B981',
  red: '#EF4444',
  amber: '#F59E0B',
  purple: '#8B5CF6',
  pink: '#EC4899',
  cyan: '#06B6D4',
  gray: '#6B7280',
  emerald: '#059669',
  indigo: '#6366F1',
};

function getColor(color?: string): string {
  if (!color) return colorMap.blue;
  if (color.startsWith('#') || color.startsWith('rgb')) return color;
  return colorMap[color] || colorMap.blue;
}

// ============================================================================
// ProgressRing Component
// ============================================================================

export function ProgressRing({
  value,
  size = 120,
  strokeWidth = 10,
  color = 'blue',
  trackColor = '#e5e7eb',
  showLabel = true,
  label,
  className,
  animate = true,
  rotation = -90,
  gradient = false,
  gradientColors = ['#3B82F6', '#8B5CF6'],
}: ProgressRingProps) {
  const normalizedValue = Math.min(100, Math.max(0, value));
  
  const { radius, circumference, strokeDashoffset } = useMemo(() => {
    const r = (size - strokeWidth) / 2;
    const c = 2 * Math.PI * r;
    const offset = c - (normalizedValue / 100) * c;
    return { radius: r, circumference: c, strokeDashoffset: offset };
  }, [size, strokeWidth, normalizedValue]);

  const center = size / 2;
  const progressColor = getColor(color);
  const gradientId = `progress-gradient-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className={clsx('relative inline-flex items-center justify-center', className)}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="transform"
        style={{ transform: `rotate(${rotation}deg)` }}
      >
        {/* Gradient definition */}
        {gradient && (
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={gradientColors[0]} />
              <stop offset="100%" stopColor={gradientColors[1]} />
            </linearGradient>
          </defs>
        )}

        {/* Background track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />

        {/* Progress arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={gradient ? `url(#${gradientId})` : progressColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className={animate ? 'transition-all duration-500 ease-out' : ''}
        />
      </svg>

      {/* Center label */}
      {showLabel && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ transform: `rotate(${-rotation}deg)` }}
        >
          {label !== undefined ? (
            label
          ) : (
            <span className="text-xl font-bold text-gray-900">
              {Math.round(normalizedValue)}%
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ProgressRingWithIcon Component
// ============================================================================

export function ProgressRingWithIcon({
  icon,
  iconColor = 'blue',
  ...props
}: ProgressRingWithIconProps) {
  const iconColorClass = getColor(iconColor);

  return (
    <ProgressRing
      {...props}
      showLabel
      label={
        <div style={{ color: iconColorClass }}>
          {icon}
        </div>
      }
    />
  );
}

// ============================================================================
// MultiProgressRing Component - Multiple segments
// ============================================================================

export function MultiProgressRing({
  segments,
  size = 120,
  strokeWidth = 10,
  trackColor = '#e5e7eb',
  showLabel = true,
  className,
}: MultiProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  // Calculate total and individual segment offsets
  const totalValue = segments.reduce((sum, seg) => sum + seg.value, 0);
  
  const segmentData = useMemo(() => {
    let currentOffset = 0;
    return segments.map((segment) => {
      const segmentLength = (segment.value / 100) * circumference;
      const dashOffset = circumference - currentOffset - segmentLength;
      const result = {
        ...segment,
        dashArray: `${segmentLength} ${circumference - segmentLength}`,
        dashOffset: currentOffset,
        rotation: (currentOffset / circumference) * 360 - 90,
      };
      currentOffset += segmentLength;
      return result;
    });
  }, [segments, circumference]);

  return (
    <div className={clsx('relative inline-flex items-center justify-center', className)}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        {/* Background track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />

        {/* Segments */}
        {segmentData.map((segment, index) => (
          <circle
            key={index}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={getColor(segment.color)}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={segment.dashArray}
            style={{
              transformOrigin: 'center',
              transform: `rotate(${segment.rotation}deg)`,
            }}
            className="transition-all duration-500"
          />
        ))}
      </svg>

      {/* Center label */}
      {showLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-gray-900">
            {Math.round(totalValue)}%
          </span>
          <span className="text-xs text-gray-500">Total</span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MiniProgressRing - Compact inline version
// ============================================================================

export interface MiniProgressRingProps {
  value: number;
  size?: number;
  color?: string;
  className?: string;
}

export function MiniProgressRing({
  value,
  size = 24,
  color = 'blue',
  className,
}: MiniProgressRingProps) {
  return (
    <ProgressRing
      value={value}
      size={size}
      strokeWidth={3}
      color={color}
      showLabel={false}
      className={className}
    />
  );
}

// ============================================================================
// ProgressRingCard - Card wrapper with progress ring
// ============================================================================

export interface ProgressRingCardProps {
  title: string;
  value: number;
  subtitle?: string;
  color?: string;
  size?: number;
  className?: string;
}

export function ProgressRingCard({
  title,
  value,
  subtitle,
  color = 'blue',
  size = 80,
  className,
}: ProgressRingCardProps) {
  return (
    <div className={clsx(
      'bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-4',
      className,
    )}>
      <ProgressRing
        value={value}
        size={size}
        strokeWidth={8}
        color={color}
      />
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-gray-900 truncate">{title}</h4>
        {subtitle && (
          <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
        )}
        <p className="text-lg font-bold text-gray-900 mt-1">
          {Math.round(value)}%
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// ProgressRingLegend - Legend for multi-segment rings
// ============================================================================

export interface ProgressRingLegendProps {
  segments: {
    label: string;
    value: number;
    color: string;
  }[];
  className?: string;
  orientation?: 'horizontal' | 'vertical';
}

export function ProgressRingLegend({
  segments,
  className,
  orientation = 'vertical',
}: ProgressRingLegendProps) {
  return (
    <div
      className={clsx(
        'flex gap-3',
        orientation === 'vertical' ? 'flex-col' : 'flex-row flex-wrap',
        className,
      )}
    >
      {segments.map((segment, index) => (
        <div key={index} className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: getColor(segment.color) }}
          />
          <span className="text-sm text-gray-600">{segment.label}</span>
          <span className="text-sm font-medium text-gray-900">
            {segment.value}%
          </span>
        </div>
      ))}
    </div>
  );
}
