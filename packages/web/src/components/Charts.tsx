/**
 * Charts.tsx - CRITICAL-25
 * 
 * Chart components and visualization utilities for the ERP application.
 * Provides chart wrappers, responsive containers, color themes, and
 * data transformation utilities.
 * 
 * Features:
 * - 25.1: Responsive chart containers
 * - 25.2: Chart color themes and palettes
 * - 25.3: Data transformation utilities
 * - 25.4: Simple SVG charts (bar, line, pie, donut)
 * - 25.5: Chart legends and tooltips
 * 
 * @module Charts
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
  type SVGProps,
  type CSSProperties,
} from 'react';
import { clsx } from 'clsx';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/** Chart data point */
export interface ChartDataPoint {
  /** Label for the data point */
  label: string;
  /** Numeric value */
  value: number;
  /** Optional color override */
  color?: string;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/** Series data for multi-series charts */
export interface ChartSeries {
  /** Series name */
  name: string;
  /** Data points */
  data: number[];
  /** Optional color */
  color?: string;
}

/** Chart dimensions */
export interface ChartDimensions {
  width: number;
  height: number;
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;
}

/** Chart theme */
export interface ChartTheme {
  /** Color palette */
  colors: string[];
  /** Background color */
  background: string;
  /** Text color */
  textColor: string;
  /** Grid color */
  gridColor: string;
  /** Axis color */
  axisColor: string;
  /** Font family */
  fontFamily: string;
  /** Font size */
  fontSize: number;
}

/** Tooltip data */
export interface TooltipData {
  /** X position */
  x: number;
  /** Y position */
  y: number;
  /** Label */
  label: string;
  /** Value */
  value: number;
  /** Formatted value */
  formattedValue: string;
  /** Color */
  color: string;
  /** Additional data */
  metadata?: Record<string, unknown>;
}

/** Legend item */
export interface LegendItem {
  /** Label */
  label: string;
  /** Color */
  color: string;
  /** Value (optional) */
  value?: number;
  /** Formatted value (optional) */
  formattedValue?: string;
  /** Whether item is active */
  isActive?: boolean;
}

// ============================================================================
// 25.2: COLOR THEMES & PALETTES
// ============================================================================

/** Default chart colors */
export const CHART_COLORS = {
  blue: '#3B82F6',
  green: '#22C55E',
  yellow: '#EAB308',
  red: '#EF4444',
  purple: '#A855F7',
  pink: '#EC4899',
  indigo: '#6366F1',
  cyan: '#06B6D4',
  orange: '#F97316',
  teal: '#14B8A6',
};

/** Color palettes */
export const COLOR_PALETTES = {
  default: [
    '#3B82F6', '#22C55E', '#EAB308', '#EF4444', '#A855F7',
    '#EC4899', '#6366F1', '#06B6D4', '#F97316', '#14B8A6',
  ],
  warm: [
    '#EF4444', '#F97316', '#EAB308', '#F59E0B', '#FBBF24',
    '#FCD34D', '#FDE68A', '#FEF3C7', '#D97706', '#B45309',
  ],
  cool: [
    '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#D946EF',
    '#0EA5E9', '#06B6D4', '#14B8A6', '#10B981', '#22C55E',
  ],
  monochrome: [
    '#1F2937', '#374151', '#4B5563', '#6B7280', '#9CA3AF',
    '#D1D5DB', '#E5E7EB', '#F3F4F6', '#F9FAFB', '#FFFFFF',
  ],
  pastel: [
    '#93C5FD', '#86EFAC', '#FDE047', '#FCA5A1', '#D8B4FE',
    '#F9A8D4', '#A5B4FC', '#67E8F9', '#FDBA74', '#5EEAD4',
  ],
  status: [
    '#22C55E', // success
    '#EAB308', // warning
    '#EF4444', // error
    '#3B82F6', // info
    '#6B7280', // neutral
  ],
};

/** Light theme */
export const LIGHT_THEME: ChartTheme = {
  colors: COLOR_PALETTES.default,
  background: '#FFFFFF',
  textColor: '#374151',
  gridColor: '#E5E7EB',
  axisColor: '#9CA3AF',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontSize: 12,
};

/** Dark theme */
export const DARK_THEME: ChartTheme = {
  colors: COLOR_PALETTES.default,
  background: '#1F2937',
  textColor: '#E5E7EB',
  gridColor: '#374151',
  axisColor: '#6B7280',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontSize: 12,
};

/**
 * Get color from palette by index
 */
export function getChartColor(index: number, palette: string[] = COLOR_PALETTES.default): string {
  return palette[index % palette.length];
}

/**
 * Generate gradient colors between two colors
 */
export function generateGradient(startColor: string, endColor: string, steps: number): string[] {
  const colors: string[] = [];
  
  const parseHex = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    } : { r: 0, g: 0, b: 0 };
  };

  const start = parseHex(startColor);
  const end = parseHex(endColor);

  for (let i = 0; i < steps; i++) {
    const ratio = i / (steps - 1);
    const r = Math.round(start.r + (end.r - start.r) * ratio);
    const g = Math.round(start.g + (end.g - start.g) * ratio);
    const b = Math.round(start.b + (end.b - start.b) * ratio);
    colors.push(`#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`);
  }

  return colors;
}

// ============================================================================
// 25.1: RESPONSIVE CHART CONTAINER
// ============================================================================

/** Responsive container props */
export interface ResponsiveChartContainerProps {
  /** Minimum width */
  minWidth?: number;
  /** Minimum height */
  minHeight?: number;
  /** Aspect ratio (width/height) */
  aspectRatio?: number;
  /** Fixed height (overrides aspect ratio) */
  height?: number;
  /** Debounce delay for resize */
  debounceDelay?: number;
  /** Children render function */
  children: (dimensions: { width: number; height: number }) => ReactNode;
  /** Additional class */
  className?: string;
  /** Additional style */
  style?: CSSProperties;
}

/**
 * Responsive container that provides dimensions to children
 * 
 * @example
 * ```tsx
 * <ResponsiveChartContainer aspectRatio={16/9}>
 *   {({ width, height }) => (
 *     <BarChart width={width} height={height} data={data} />
 *   )}
 * </ResponsiveChartContainer>
 * ```
 */
export function ResponsiveChartContainer({
  minWidth = 100,
  minHeight = 100,
  aspectRatio,
  height: fixedHeight,
  debounceDelay = 100,
  children,
  className,
  style,
}: ResponsiveChartContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const timeoutRef = useRef<NodeJS.Timeout>();

  const updateDimensions = useCallback(() => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const width = Math.max(rect.width, minWidth);
    let height: number;

    if (fixedHeight) {
      height = fixedHeight;
    } else if (aspectRatio) {
      height = Math.max(width / aspectRatio, minHeight);
    } else {
      height = Math.max(rect.height, minHeight);
    }

    setDimensions({ width, height });
  }, [minWidth, minHeight, aspectRatio, fixedHeight]);

  useEffect(() => {
    updateDimensions();

    const handleResize = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(updateDimensions, debounceDelay);
    };

    window.addEventListener('resize', handleResize);
    
    // Use ResizeObserver if available
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      observer = new ResizeObserver(handleResize);
      observer.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (observer) observer.disconnect();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [updateDimensions, debounceDelay]);

  return (
    <div
      ref={containerRef}
      className={clsx('relative', className)}
      style={{
        ...style,
        minWidth,
        minHeight: fixedHeight ?? minHeight,
        height: fixedHeight,
      }}
    >
      {dimensions.width > 0 && dimensions.height > 0 && children(dimensions)}
    </div>
  );
}

// ============================================================================
// 25.3: DATA TRANSFORMATION UTILITIES
// ============================================================================

/**
 * Normalize values to 0-100 range
 */
export function normalizeData(data: number[]): number[] {
  const max = Math.max(...data);
  if (max === 0) return data.map(() => 0);
  return data.map((v) => (v / max) * 100);
}

/**
 * Calculate percentage of total for each value
 */
export function toPercentages(data: number[]): number[] {
  const total = data.reduce((sum, v) => sum + v, 0);
  if (total === 0) return data.map(() => 0);
  return data.map((v) => (v / total) * 100);
}

/**
 * Format number for display
 */
export function formatChartValue(
  value: number,
  options: {
    decimals?: number;
    prefix?: string;
    suffix?: string;
    compact?: boolean;
  } = {}
): string {
  const { decimals = 0, prefix = '', suffix = '', compact = false } = options;

  let formatted: string;

  if (compact) {
    if (value >= 1000000) {
      formatted = (value / 1000000).toFixed(1) + 'M';
    } else if (value >= 1000) {
      formatted = (value / 1000).toFixed(1) + 'K';
    } else {
      formatted = value.toFixed(decimals);
    }
  } else {
    formatted = value.toFixed(decimals);
  }

  return `${prefix}${formatted}${suffix}`;
}

/**
 * Calculate nice axis ticks
 */
export function calculateTicks(min: number, max: number, tickCount: number = 5): number[] {
  const range = max - min;
  const roughStep = range / (tickCount - 1);
  
  // Find nice step value
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const residual = roughStep / magnitude;
  let niceStep: number;
  
  if (residual <= 1.5) niceStep = 1 * magnitude;
  else if (residual <= 3) niceStep = 2 * magnitude;
  else if (residual <= 7) niceStep = 5 * magnitude;
  else niceStep = 10 * magnitude;

  const niceMin = Math.floor(min / niceStep) * niceStep;
  const niceMax = Math.ceil(max / niceStep) * niceStep;

  const ticks: number[] = [];
  for (let v = niceMin; v <= niceMax; v += niceStep) {
    ticks.push(v);
  }

  return ticks;
}

/**
 * Aggregate data by key
 */
export function aggregateData<T extends Record<string, unknown>>(
  data: T[],
  keyField: keyof T,
  valueField: keyof T,
  aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max' = 'sum'
): ChartDataPoint[] {
  const groups = new Map<string, number[]>();

  data.forEach((item) => {
    const key = String(item[keyField]);
    const value = Number(item[valueField]) || 0;

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(value);
  });

  const result: ChartDataPoint[] = [];

  groups.forEach((values, key) => {
    let aggregatedValue: number;

    switch (aggregation) {
      case 'sum':
        aggregatedValue = values.reduce((a, b) => a + b, 0);
        break;
      case 'avg':
        aggregatedValue = values.reduce((a, b) => a + b, 0) / values.length;
        break;
      case 'count':
        aggregatedValue = values.length;
        break;
      case 'min':
        aggregatedValue = Math.min(...values);
        break;
      case 'max':
        aggregatedValue = Math.max(...values);
        break;
    }

    result.push({ label: key, value: aggregatedValue });
  });

  return result;
}

// ============================================================================
// 25.4: SIMPLE SVG CHARTS
// ============================================================================

/** Base chart props */
export interface BaseChartProps {
  /** Chart data */
  data: ChartDataPoint[];
  /** Width */
  width: number;
  /** Height */
  height: number;
  /** Color palette */
  colors?: string[];
  /** Show labels */
  showLabels?: boolean;
  /** Format value for display */
  formatValue?: (value: number) => string;
  /** Click handler */
  onClick?: (point: ChartDataPoint, index: number) => void;
  /** Hover handler */
  onHover?: (point: ChartDataPoint | null, index: number) => void;
  /** Additional class */
  className?: string;
  /** Animation duration in ms */
  animate?: number;
}

// --------------------------------------------------------
// BAR CHART
// --------------------------------------------------------

/** Bar chart props */
export interface BarChartProps extends BaseChartProps {
  /** Bar orientation */
  orientation?: 'vertical' | 'horizontal';
  /** Bar border radius */
  borderRadius?: number;
  /** Gap between bars (0-1) */
  barGap?: number;
  /** Show grid lines */
  showGrid?: boolean;
  /** Show values on bars */
  showValues?: boolean;
}

/**
 * Simple bar chart component
 * 
 * @example
 * ```tsx
 * <BarChart
 *   data={[
 *     { label: 'Jan', value: 100 },
 *     { label: 'Feb', value: 150 },
 *     { label: 'Mar', value: 120 },
 *   ]}
 *   width={400}
 *   height={300}
 * />
 * ```
 */
export function BarChart({
  data,
  width,
  height,
  colors = COLOR_PALETTES.default,
  orientation = 'vertical',
  borderRadius = 4,
  barGap = 0.2,
  showGrid = true,
  showLabels = true,
  showValues = false,
  formatValue = (v) => String(v),
  onClick,
  onHover,
  className,
  animate = 0,
}: BarChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const maxValue = Math.max(...data.map((d) => d.value), 0);
  const ticks = calculateTicks(0, maxValue);

  const isVertical = orientation === 'vertical';
  const barCount = data.length;
  const barWidth = isVertical
    ? (innerWidth / barCount) * (1 - barGap)
    : undefined;
  const barHeight = !isVertical
    ? (innerHeight / barCount) * (1 - barGap)
    : undefined;

  const handleHover = (point: ChartDataPoint | null, index: number) => {
    setHoveredIndex(point ? index : null);
    onHover?.(point, index);
  };

  return (
    <svg
      width={width}
      height={height}
      className={clsx('overflow-visible', className)}
    >
      <g transform={`translate(${padding.left}, ${padding.top})`}>
        {/* Grid lines */}
        {showGrid && ticks.map((tick, i) => {
          const y = isVertical
            ? innerHeight - (tick / maxValue) * innerHeight
            : (tick / maxValue) * innerWidth;

          return (
            <line
              key={i}
              x1={isVertical ? 0 : y}
              y1={isVertical ? y : 0}
              x2={isVertical ? innerWidth : y}
              y2={isVertical ? y : innerHeight}
              stroke="#E5E7EB"
              strokeDasharray="4,4"
            />
          );
        })}

        {/* Bars */}
        {data.map((point, i) => {
          const color = point.color || getChartColor(i, colors);
          const isHovered = hoveredIndex === i;

          if (isVertical) {
            const x = (i / barCount) * innerWidth + (innerWidth / barCount) * (barGap / 2);
            const barH = (point.value / maxValue) * innerHeight;
            const y = innerHeight - barH;

            return (
              <g key={i}>
                <rect
                  x={x}
                  y={animate ? innerHeight : y}
                  width={barWidth}
                  height={animate ? 0 : barH}
                  rx={borderRadius}
                  fill={color}
                  opacity={isHovered ? 1 : 0.85}
                  style={{
                    transition: animate ? `all ${animate}ms ease-out` : undefined,
                    cursor: onClick ? 'pointer' : undefined,
                  }}
                  onClick={() => onClick?.(point, i)}
                  onMouseEnter={() => handleHover(point, i)}
                  onMouseLeave={() => handleHover(null, -1)}
                >
                  {animate && (
                    <animate
                      attributeName="y"
                      from={innerHeight}
                      to={y}
                      dur={`${animate}ms`}
                      fill="freeze"
                    />
                  )}
                  {animate && (
                    <animate
                      attributeName="height"
                      from="0"
                      to={barH}
                      dur={`${animate}ms`}
                      fill="freeze"
                    />
                  )}
                </rect>
                {showValues && (
                  <text
                    x={x + barWidth! / 2}
                    y={y - 5}
                    textAnchor="middle"
                    fontSize="11"
                    fill="#374151"
                  >
                    {formatValue(point.value)}
                  </text>
                )}
              </g>
            );
          } else {
            const y = (i / barCount) * innerHeight + (innerHeight / barCount) * (barGap / 2);
            const barW = (point.value / maxValue) * innerWidth;

            return (
              <g key={i}>
                <rect
                  x={0}
                  y={y}
                  width={animate ? 0 : barW}
                  height={barHeight}
                  rx={borderRadius}
                  fill={color}
                  opacity={isHovered ? 1 : 0.85}
                  style={{
                    transition: animate ? `all ${animate}ms ease-out` : undefined,
                    cursor: onClick ? 'pointer' : undefined,
                  }}
                  onClick={() => onClick?.(point, i)}
                  onMouseEnter={() => handleHover(point, i)}
                  onMouseLeave={() => handleHover(null, -1)}
                >
                  {animate && (
                    <animate
                      attributeName="width"
                      from="0"
                      to={barW}
                      dur={`${animate}ms`}
                      fill="freeze"
                    />
                  )}
                </rect>
                {showValues && (
                  <text
                    x={barW + 5}
                    y={y + barHeight! / 2 + 4}
                    fontSize="11"
                    fill="#374151"
                  >
                    {formatValue(point.value)}
                  </text>
                )}
              </g>
            );
          }
        })}

        {/* X-axis labels */}
        {showLabels && isVertical && data.map((point, i) => {
          const x = (i / barCount) * innerWidth + (innerWidth / barCount) / 2;

          return (
            <text
              key={i}
              x={x}
              y={innerHeight + 20}
              textAnchor="middle"
              fontSize="11"
              fill="#6B7280"
            >
              {point.label}
            </text>
          );
        })}

        {/* Y-axis labels */}
        {showLabels && !isVertical && data.map((point, i) => {
          const y = (i / barCount) * innerHeight + (innerHeight / barCount) / 2;

          return (
            <text
              key={i}
              x={-10}
              y={y + 4}
              textAnchor="end"
              fontSize="11"
              fill="#6B7280"
            >
              {point.label}
            </text>
          );
        })}

        {/* Value axis labels */}
        {ticks.map((tick, i) => {
          if (isVertical) {
            const y = innerHeight - (tick / maxValue) * innerHeight;
            return (
              <text
                key={i}
                x={-10}
                y={y + 4}
                textAnchor="end"
                fontSize="10"
                fill="#9CA3AF"
              >
                {formatValue(tick)}
              </text>
            );
          } else {
            const x = (tick / maxValue) * innerWidth;
            return (
              <text
                key={i}
                x={x}
                y={innerHeight + 20}
                textAnchor="middle"
                fontSize="10"
                fill="#9CA3AF"
              >
                {formatValue(tick)}
              </text>
            );
          }
        })}
      </g>
    </svg>
  );
}

// --------------------------------------------------------
// PIE/DONUT CHART
// --------------------------------------------------------

/** Pie chart props */
export interface PieChartProps extends BaseChartProps {
  /** Inner radius for donut (0 for pie) */
  innerRadius?: number;
  /** Outer radius */
  outerRadius?: number;
  /** Start angle in degrees */
  startAngle?: number;
  /** Padding between slices */
  padAngle?: number;
  /** Show percentage labels */
  showPercentage?: boolean;
}

/**
 * Simple pie/donut chart component
 */
export function PieChart({
  data,
  width,
  height,
  colors = COLOR_PALETTES.default,
  innerRadius = 0,
  outerRadius: customOuterRadius,
  startAngle = -90,
  padAngle = 0.02,
  showLabels = true,
  showPercentage = false,
  formatValue = (v) => String(v),
  onClick,
  onHover,
  className,
  animate = 0,
}: PieChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const centerX = width / 2;
  const centerY = height / 2;
  const outerRadius = customOuterRadius ?? Math.min(width, height) / 2 - 20;

  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return null;

  // Calculate arc paths
  let currentAngle = (startAngle * Math.PI) / 180;
  const arcs = data.map((point, i) => {
    const angle = (point.value / total) * 2 * Math.PI;
    const startArc = currentAngle + padAngle / 2;
    const endArc = currentAngle + angle - padAngle / 2;
    currentAngle += angle;

    const x1 = centerX + outerRadius * Math.cos(startArc);
    const y1 = centerY + outerRadius * Math.sin(startArc);
    const x2 = centerX + outerRadius * Math.cos(endArc);
    const y2 = centerY + outerRadius * Math.sin(endArc);

    const x1Inner = centerX + innerRadius * Math.cos(endArc);
    const y1Inner = centerY + innerRadius * Math.sin(endArc);
    const x2Inner = centerX + innerRadius * Math.cos(startArc);
    const y2Inner = centerY + innerRadius * Math.sin(startArc);

    const largeArc = angle > Math.PI ? 1 : 0;

    const path = innerRadius > 0
      ? `M ${x1} ${y1} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2} ${y2} L ${x1Inner} ${y1Inner} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x2Inner} ${y2Inner} Z`
      : `M ${centerX} ${centerY} L ${x1} ${y1} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2} ${y2} Z`;

    const labelAngle = startArc + (endArc - startArc) / 2;
    const labelRadius = innerRadius + (outerRadius - innerRadius) / 2;
    const labelX = centerX + labelRadius * Math.cos(labelAngle);
    const labelY = centerY + labelRadius * Math.sin(labelAngle);

    return {
      path,
      color: point.color || getChartColor(i, colors),
      labelX,
      labelY,
      percentage: (point.value / total) * 100,
      point,
      index: i,
    };
  });

  const handleHover = (point: ChartDataPoint | null, index: number) => {
    setHoveredIndex(point ? index : null);
    onHover?.(point, index);
  };

  return (
    <svg width={width} height={height} className={clsx('overflow-visible', className)}>
      {arcs.map((arc) => {
        const isHovered = hoveredIndex === arc.index;
        const scale = isHovered ? 1.05 : 1;

        return (
          <g key={arc.index}>
            <path
              d={arc.path}
              fill={arc.color}
              opacity={isHovered ? 1 : 0.9}
              style={{
                transform: `scale(${scale})`,
                transformOrigin: `${centerX}px ${centerY}px`,
                transition: 'transform 0.2s ease-out, opacity 0.2s',
                cursor: onClick ? 'pointer' : undefined,
              }}
              onClick={() => onClick?.(arc.point, arc.index)}
              onMouseEnter={() => handleHover(arc.point, arc.index)}
              onMouseLeave={() => handleHover(null, -1)}
            />
            {showLabels && arc.percentage > 5 && (
              <text
                x={arc.labelX}
                y={arc.labelY}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="11"
                fontWeight="500"
                fill="white"
                style={{ pointerEvents: 'none' }}
              >
                {showPercentage
                  ? `${arc.percentage.toFixed(0)}%`
                  : formatValue(arc.point.value)}
              </text>
            )}
          </g>
        );
      })}

      {/* Center text for donut */}
      {innerRadius > 0 && (
        <text
          x={centerX}
          y={centerY}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="14"
          fontWeight="600"
          fill="#374151"
        >
          {formatValue(total)}
        </text>
      )}
    </svg>
  );
}

// --------------------------------------------------------
// LINE CHART
// --------------------------------------------------------

/** Line chart props */
export interface LineChartProps {
  /** Series data */
  series: ChartSeries[];
  /** Labels for X-axis */
  labels: string[];
  /** Width */
  width: number;
  /** Height */
  height: number;
  /** Color palette */
  colors?: string[];
  /** Show grid */
  showGrid?: boolean;
  /** Show dots on data points */
  showDots?: boolean;
  /** Dot radius */
  dotRadius?: number;
  /** Line stroke width */
  strokeWidth?: number;
  /** Show area fill */
  showArea?: boolean;
  /** Area opacity */
  areaOpacity?: number;
  /** Curved lines */
  curved?: boolean;
  /** Format value */
  formatValue?: (value: number) => string;
  /** Additional class */
  className?: string;
}

/**
 * Simple line chart component
 */
export function LineChart({
  series,
  labels,
  width,
  height,
  colors = COLOR_PALETTES.default,
  showGrid = true,
  showDots = true,
  dotRadius = 4,
  strokeWidth = 2,
  showArea = false,
  areaOpacity = 0.2,
  curved = true,
  formatValue = (v) => String(v),
  className,
}: LineChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<{
    seriesIndex: number;
    pointIndex: number;
  } | null>(null);

  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const allValues = series.flatMap((s) => s.data);
  const maxValue = Math.max(...allValues, 0);
  const ticks = calculateTicks(0, maxValue);

  const getX = (i: number) => (i / (labels.length - 1)) * innerWidth;
  const getY = (v: number) => innerHeight - (v / maxValue) * innerHeight;

  const createPath = (data: number[]): string => {
    if (data.length === 0) return '';

    if (curved) {
      // Catmull-Rom spline
      const points = data.map((v, i) => ({ x: getX(i), y: getY(v) }));
      let path = `M ${points[0].x} ${points[0].y}`;

      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[Math.max(0, i - 1)];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[Math.min(points.length - 1, i + 2)];

        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;

        path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
      }

      return path;
    } else {
      return data.map((v, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(v)}`).join(' ');
    }
  };

  return (
    <svg width={width} height={height} className={clsx('overflow-visible', className)}>
      <g transform={`translate(${padding.left}, ${padding.top})`}>
        {/* Grid */}
        {showGrid && ticks.map((tick, i) => {
          const y = getY(tick);
          return (
            <line
              key={i}
              x1={0}
              y1={y}
              x2={innerWidth}
              y2={y}
              stroke="#E5E7EB"
              strokeDasharray="4,4"
            />
          );
        })}

        {/* Areas */}
        {showArea && series.map((s, si) => {
          const path = createPath(s.data);
          const areaPath = `${path} L ${getX(s.data.length - 1)} ${innerHeight} L ${getX(0)} ${innerHeight} Z`;
          const color = s.color || getChartColor(si, colors);

          return (
            <path
              key={`area-${si}`}
              d={areaPath}
              fill={color}
              opacity={areaOpacity}
            />
          );
        })}

        {/* Lines */}
        {series.map((s, si) => {
          const path = createPath(s.data);
          const color = s.color || getChartColor(si, colors);

          return (
            <path
              key={`line-${si}`}
              d={path}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}

        {/* Dots */}
        {showDots && series.map((s, si) => {
          const color = s.color || getChartColor(si, colors);

          return s.data.map((v, pi) => {
            const isHovered = hoveredPoint?.seriesIndex === si && hoveredPoint?.pointIndex === pi;

            return (
              <circle
                key={`dot-${si}-${pi}`}
                cx={getX(pi)}
                cy={getY(v)}
                r={isHovered ? dotRadius * 1.5 : dotRadius}
                fill={color}
                stroke="white"
                strokeWidth={2}
                style={{ cursor: 'pointer', transition: 'r 0.2s' }}
                onMouseEnter={() => setHoveredPoint({ seriesIndex: si, pointIndex: pi })}
                onMouseLeave={() => setHoveredPoint(null)}
              />
            );
          });
        })}

        {/* X-axis labels */}
        {labels.map((label, i) => (
          <text
            key={i}
            x={getX(i)}
            y={innerHeight + 20}
            textAnchor="middle"
            fontSize="11"
            fill="#6B7280"
          >
            {label}
          </text>
        ))}

        {/* Y-axis labels */}
        {ticks.map((tick, i) => (
          <text
            key={i}
            x={-10}
            y={getY(tick) + 4}
            textAnchor="end"
            fontSize="10"
            fill="#9CA3AF"
          >
            {formatValue(tick)}
          </text>
        ))}
      </g>
    </svg>
  );
}

// ============================================================================
// 25.5: LEGENDS & TOOLTIPS
// ============================================================================

/** Chart legend props */
export interface ChartLegendProps {
  /** Legend items */
  items: LegendItem[];
  /** Layout direction */
  direction?: 'horizontal' | 'vertical';
  /** Item click handler */
  onItemClick?: (item: LegendItem, index: number) => void;
  /** Additional class */
  className?: string;
}

/**
 * Chart legend component
 */
export function ChartLegend({
  items,
  direction = 'horizontal',
  onItemClick,
  className,
}: ChartLegendProps) {
  return (
    <div
      className={clsx(
        'flex flex-wrap gap-4',
        direction === 'vertical' && 'flex-col gap-2',
        className
      )}
    >
      {items.map((item, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onItemClick?.(item, i)}
          className={clsx(
            'flex items-center gap-2 text-sm',
            onItemClick && 'cursor-pointer hover:opacity-80',
            item.isActive === false && 'opacity-50'
          )}
          disabled={!onItemClick}
        >
          <span
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-gray-700 dark:text-gray-300">{item.label}</span>
          {item.formattedValue && (
            <span className="text-gray-500 dark:text-gray-400">
              ({item.formattedValue})
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/** Chart tooltip props */
export interface ChartTooltipProps {
  /** Tooltip data */
  data: TooltipData | null;
  /** Additional class */
  className?: string;
}

/**
 * Chart tooltip component
 */
export function ChartTooltip({ data, className }: ChartTooltipProps) {
  if (!data) return null;

  return (
    <div
      className={clsx(
        'absolute z-50 pointer-events-none',
        'bg-white dark:bg-gray-800 rounded-lg shadow-lg',
        'border border-gray-200 dark:border-gray-700',
        'px-3 py-2 text-sm',
        className
      )}
      style={{
        left: data.x,
        top: data.y,
        transform: 'translate(-50%, -100%) translateY(-8px)',
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: data.color }}
        />
        <span className="font-medium text-gray-900 dark:text-white">
          {data.label}
        </span>
      </div>
      <div className="text-gray-600 dark:text-gray-400">
        {data.formattedValue}
      </div>
    </div>
  );
}

// ============================================================================
// EXPORTS - Types and components are already exported inline
// ============================================================================
