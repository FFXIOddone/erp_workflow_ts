import React, { useMemo } from 'react';
import clsx from 'clsx';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface SparklineProps {
  /** Array of numeric values to display */
  data: number[];
  /** Width of the sparkline in pixels */
  width?: number;
  /** Height of the sparkline in pixels */
  height?: number;
  /** Line color (Tailwind class or CSS color) */
  color?: string;
  /** Whether to show fill under the line */
  showFill?: boolean;
  /** Fill color/opacity */
  fillColor?: string;
  /** Line stroke width */
  strokeWidth?: number;
  /** Whether to show dots at data points */
  showDots?: boolean;
  /** Whether to show the last point highlighted */
  showLastPoint?: boolean;
  /** Custom className for the container */
  className?: string;
  /** Whether to animate the sparkline */
  animate?: boolean;
  /** Variant for different sparkline styles */
  variant?: 'line' | 'bar' | 'area';
  /** Minimum value for y-axis (auto-calculated if not provided) */
  minValue?: number;
  /** Maximum value for y-axis (auto-calculated if not provided) */
  maxValue?: number;
}

export interface SparklineBarProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
  barGap?: number;
  showValues?: boolean;
}

export interface TrendIndicatorProps {
  value: number;
  previousValue: number;
  format?: 'percent' | 'absolute';
  className?: string;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
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
// Sparkline Component (Line/Area)
// ============================================================================

export function Sparkline({
  data,
  width = 100,
  height = 30,
  color = 'blue',
  showFill = false,
  fillColor,
  strokeWidth = 2,
  showDots = false,
  showLastPoint = true,
  className,
  animate = true,
  variant = 'line',
  minValue,
  maxValue,
}: SparklineProps) {
  const { path, fillPath, points, viewBox } = useMemo(() => {
    if (data.length === 0) {
      return { path: '', fillPath: '', points: [], viewBox: `0 0 ${width} ${height}` };
    }

    // Calculate bounds
    const min = minValue ?? Math.min(...data);
    const max = maxValue ?? Math.max(...data);
    const range = max - min || 1;

    // Padding
    const paddingX = strokeWidth;
    const paddingY = strokeWidth + (showDots || showLastPoint ? 4 : 0);
    const innerWidth = width - paddingX * 2;
    const innerHeight = height - paddingY * 2;

    // Calculate points
    const points = data.map((value, index) => ({
      x: paddingX + (index / Math.max(data.length - 1, 1)) * innerWidth,
      y: paddingY + innerHeight - ((value - min) / range) * innerHeight,
      value,
    }));

    // Build SVG path
    const pathParts = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`);
    const path = pathParts.join(' ');

    // Build fill path (closes the area under the line)
    const fillPath = variant === 'area' || showFill
      ? `${path} L ${points[points.length - 1].x.toFixed(2)} ${height} L ${points[0].x.toFixed(2)} ${height} Z`
      : '';

    return {
      path,
      fillPath,
      points,
      viewBox: `0 0 ${width} ${height}`,
    };
  }, [data, width, height, minValue, maxValue, strokeWidth, showDots, showLastPoint, variant, showFill]);

  if (data.length === 0) {
    return (
      <div 
        className={clsx('flex items-center justify-center text-gray-400 text-xs', className)}
        style={{ width, height }}
      >
        No data
      </div>
    );
  }

  const lineColor = getColor(color);
  const fillColorFinal = fillColor || `${lineColor}20`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={viewBox}
      className={clsx('overflow-visible', className)}
      aria-label={`Sparkline chart with ${data.length} data points`}
    >
      {/* Gradient definition for fill */}
      <defs>
        <linearGradient id={`sparkline-gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lineColor} stopOpacity="0.3" />
          <stop offset="100%" stopColor={lineColor} stopOpacity="0.05" />
        </linearGradient>
      </defs>

      {/* Area fill */}
      {(variant === 'area' || showFill) && fillPath && (
        <path
          d={fillPath}
          fill={variant === 'area' ? `url(#sparkline-gradient-${color})` : fillColorFinal}
          className={animate ? 'transition-all duration-500' : ''}
        />
      )}

      {/* Line */}
      <path
        d={path}
        fill="none"
        stroke={lineColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={animate ? 'transition-all duration-500' : ''}
      />

      {/* Dots at each data point */}
      {showDots && points.map((point, index) => (
        <circle
          key={index}
          cx={point.x}
          cy={point.y}
          r={3}
          fill="white"
          stroke={lineColor}
          strokeWidth={1.5}
          className={animate ? 'transition-all duration-500' : ''}
        />
      ))}

      {/* Highlight last point */}
      {showLastPoint && points.length > 0 && (
        <circle
          cx={points[points.length - 1].x}
          cy={points[points.length - 1].y}
          r={4}
          fill={lineColor}
          className={animate ? 'transition-all duration-500' : ''}
        >
          {animate && (
            <animate
              attributeName="r"
              values="4;5;4"
              dur="2s"
              repeatCount="indefinite"
            />
          )}
        </circle>
      )}
    </svg>
  );
}

// ============================================================================
// SparklineBar Component
// ============================================================================

export function SparklineBar({
  data,
  width = 100,
  height = 30,
  color = 'blue',
  className,
  barGap = 2,
  showValues = false,
}: SparklineBarProps) {
  const bars = useMemo(() => {
    if (data.length === 0) return [];

    const min = Math.min(...data, 0);
    const max = Math.max(...data);
    const range = max - min || 1;

    const barWidth = (width - barGap * (data.length - 1)) / data.length;
    const zeroY = height - ((0 - min) / range) * height;

    return data.map((value, index) => {
      const barHeight = Math.abs(((value - 0) / range) * height);
      const y = value >= 0 ? zeroY - barHeight : zeroY;

      return {
        x: index * (barWidth + barGap),
        y: Math.max(0, y),
        width: barWidth,
        height: Math.min(barHeight, height),
        value,
        isNegative: value < 0,
      };
    });
  }, [data, width, height, barGap]);

  if (data.length === 0) {
    return (
      <div 
        className={clsx('flex items-center justify-center text-gray-400 text-xs', className)}
        style={{ width, height }}
      >
        No data
      </div>
    );
  }

  const barColor = getColor(color);

  return (
    <svg
      width={width}
      height={height}
      className={clsx('overflow-visible', className)}
      aria-label={`Sparkline bar chart with ${data.length} data points`}
    >
      {bars.map((bar, index) => (
        <rect
          key={index}
          x={bar.x}
          y={bar.y}
          width={bar.width}
          height={bar.height}
          rx={1}
          fill={bar.isNegative ? '#EF4444' : barColor}
          className="transition-all duration-300"
          opacity={0.8}
        >
          <title>{bar.value}</title>
        </rect>
      ))}
    </svg>
  );
}

// ============================================================================
// TrendIndicator Component
// ============================================================================

export function TrendIndicator({
  value,
  previousValue,
  format = 'percent',
  className,
  showIcon = true,
  size = 'md',
}: TrendIndicatorProps) {
  const change = value - previousValue;
  const percentChange = previousValue !== 0 
    ? ((change / Math.abs(previousValue)) * 100) 
    : 0;

  const isPositive = change > 0;
  const isNegative = change < 0;
  const isNeutral = change === 0;

  const displayValue = format === 'percent' 
    ? `${isPositive ? '+' : ''}${percentChange.toFixed(1)}%`
    : `${isPositive ? '+' : ''}${change.toFixed(0)}`;

  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-0.5 font-medium',
        sizeClasses[size],
        isPositive && 'text-green-600',
        isNegative && 'text-red-600',
        isNeutral && 'text-gray-500',
        className,
      )}
    >
      {showIcon && (
        <svg
          className={clsx(
            iconSizes[size],
            isNeutral && 'opacity-50',
          )}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          {isPositive && (
            <path
              fillRule="evenodd"
              d="M10 17a.75.75 0 01-.75-.75V5.56l-2.72 2.72a.75.75 0 11-1.06-1.06l4-4a.75.75 0 011.06 0l4 4a.75.75 0 11-1.06 1.06L10.75 5.56v10.69A.75.75 0 0110 17z"
              clipRule="evenodd"
            />
          )}
          {isNegative && (
            <path
              fillRule="evenodd"
              d="M10 3a.75.75 0 01.75.75v10.69l2.72-2.72a.75.75 0 111.06 1.06l-4 4a.75.75 0 01-1.06 0l-4-4a.75.75 0 111.06-1.06l2.72 2.72V3.75A.75.75 0 0110 3z"
              clipRule="evenodd"
            />
          )}
          {isNeutral && (
            <path
              fillRule="evenodd"
              d="M4 10a.75.75 0 01.75-.75h10.5a.75.75 0 010 1.5H4.75A.75.75 0 014 10z"
              clipRule="evenodd"
            />
          )}
        </svg>
      )}
      {displayValue}
    </span>
  );
}

// ============================================================================
// MiniSparkline - Extra compact version
// ============================================================================

export interface MiniSparklineProps {
  data: number[];
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}

export function MiniSparkline({ data, trend, className }: MiniSparklineProps) {
  const color = trend === 'up' ? 'green' : trend === 'down' ? 'red' : 'gray';
  
  return (
    <Sparkline
      data={data}
      width={60}
      height={20}
      color={color}
      strokeWidth={1.5}
      showLastPoint={false}
      showFill={false}
      className={className}
    />
  );
}
