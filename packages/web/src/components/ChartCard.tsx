import { ReactNode, useMemo } from 'react';
import clsx from 'clsx';
import { TrendingUp, TrendingDown, Minus, LucideIcon } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
  secondaryValue?: number;
}

export interface ChartCardProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
  footer?: ReactNode;
}

// ============================================================================
// Base ChartCard Container
// ============================================================================

export function ChartCard({
  title,
  subtitle,
  icon: Icon,
  children,
  className,
  actions,
  footer,
}: ChartCardProps) {
  return (
    <div className={clsx('bg-white rounded-xl shadow-sm border border-gray-100', className)}>
      <div className="p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2">
            {actions}
            {Icon && <Icon className="h-5 w-5 text-gray-400" />}
          </div>
        </div>
        {children}
      </div>
      {footer && (
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 rounded-b-xl">
          {footer}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Bar Chart Component
// ============================================================================

export interface BarChartProps {
  data: ChartDataPoint[];
  maxValue?: number;
  height?: number;
  showValues?: boolean;
  horizontal?: boolean;
  colors?: string[];
  className?: string;
  barClassName?: string;
  formatValue?: (value: number) => string;
  animated?: boolean;
}

const defaultColors = [
  'bg-primary-500',
  'bg-blue-500',
  'bg-green-500',
  'bg-amber-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-cyan-500',
  'bg-orange-500',
];

export function BarChart({
  data,
  maxValue: customMax,
  height = 200,
  showValues = true,
  horizontal = false,
  colors = defaultColors,
  className,
  barClassName,
  formatValue = (v) => v.toLocaleString(),
  animated = true,
}: BarChartProps) {
  const maxValue = customMax ?? Math.max(...data.map((d) => d.value), 1);

  if (horizontal) {
    return (
      <div className={clsx('space-y-3', className)}>
        {data.map((item, index) => {
          const percent = (item.value / maxValue) * 100;
          const barColor = item.color || colors[index % colors.length];

          return (
            <div key={item.label} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 truncate">{item.label}</span>
                {showValues && (
                  <span className="font-medium text-gray-900 ml-2">{formatValue(item.value)}</span>
                )}
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={clsx(
                    'h-full rounded-full',
                    barColor,
                    animated && 'transition-all duration-500'
                  )}
                  style={{ width: `${Math.min(percent, 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Vertical bar chart
  return (
    <div className={clsx('flex items-end justify-between gap-2', className)} style={{ height }}>
      {data.map((item, index) => {
        const percent = (item.value / maxValue) * 100;
        const barColor = item.color || colors[index % colors.length];

        return (
          <div key={item.label} className="flex-1 flex flex-col items-center gap-2">
            <div className="w-full flex-1 flex flex-col justify-end">
              {showValues && (
                <span className="text-xs text-gray-600 text-center mb-1">
                  {formatValue(item.value)}
                </span>
              )}
              <div
                className={clsx(
                  'w-full rounded-t-md',
                  barColor,
                  barClassName,
                  animated && 'transition-all duration-500'
                )}
                style={{ height: `${Math.max(percent, 2)}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 text-center truncate w-full">
              {item.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Stacked Bar Chart Component
// ============================================================================

export interface StackedBarChartProps {
  data: Array<{
    label: string;
    segments: Array<{ value: number; color: string; label?: string }>;
  }>;
  height?: number;
  showLegend?: boolean;
  className?: string;
  formatValue?: (value: number) => string;
}

export function StackedBarChart({
  data,
  height = 200,
  showLegend = true,
  className,
  formatValue = (v) => v.toLocaleString(),
}: StackedBarChartProps) {
  const maxTotal = Math.max(...data.map((d) => d.segments.reduce((sum, s) => sum + s.value, 0)), 1);

  // Collect unique segment labels for legend
  const legendItems = useMemo(() => {
    const items = new Map<string, string>();
    data.forEach((d) => {
      d.segments.forEach((s) => {
        if (s.label && !items.has(s.label)) {
          items.set(s.label, s.color);
        }
      });
    });
    return Array.from(items.entries());
  }, [data]);

  return (
    <div className={className}>
      <div className="flex items-end justify-between gap-2" style={{ height }}>
        {data.map((item) => {
          const total = item.segments.reduce((sum, s) => sum + s.value, 0);

          return (
            <div key={item.label} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full flex-1 flex flex-col justify-end">
                <span className="text-xs text-gray-600 text-center mb-1">
                  {formatValue(total)}
                </span>
                <div
                  className="w-full rounded-t-md overflow-hidden flex flex-col-reverse"
                  style={{ height: `${(total / maxTotal) * 100}%` }}
                >
                  {item.segments.map((segment, segIndex) => (
                    <div
                      key={segIndex}
                      className={clsx(segment.color)}
                      style={{
                        height: total > 0 ? `${(segment.value / total) * 100}%` : 0,
                      }}
                    />
                  ))}
                </div>
              </div>
              <span className="text-xs text-gray-500 text-center truncate w-full">
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
      {showLegend && legendItems.length > 0 && (
        <div className="flex flex-wrap gap-4 mt-4 justify-center">
          {legendItems.map(([label, color]) => (
            <div key={label} className="flex items-center gap-2">
              <div className={clsx('w-3 h-3 rounded-sm', color)} />
              <span className="text-xs text-gray-600">{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Pie/Donut Chart Component
// ============================================================================

export interface PieChartProps {
  data: ChartDataPoint[];
  size?: number;
  donut?: boolean;
  donutWidth?: number;
  showLabels?: boolean;
  showLegend?: boolean;
  centerContent?: ReactNode;
  colors?: string[];
  className?: string;
}

// Map Tailwind colors to hex for SVG
const colorMap: Record<string, string> = {
  'bg-primary-500': '#3b82f6',
  'bg-blue-500': '#3b82f6',
  'bg-green-500': '#22c55e',
  'bg-amber-500': '#f59e0b',
  'bg-purple-500': '#a855f7',
  'bg-pink-500': '#ec4899',
  'bg-cyan-500': '#06b6d4',
  'bg-orange-500': '#f97316',
  'bg-red-500': '#ef4444',
  'bg-indigo-500': '#6366f1',
  'bg-teal-500': '#14b8a6',
  'bg-emerald-500': '#10b981',
  'bg-gray-500': '#6b7280',
};

function getHexColor(tailwindClass: string): string {
  return colorMap[tailwindClass] || tailwindClass;
}

export function PieChart({
  data,
  size = 180,
  donut = true,
  donutWidth = 24,
  showLabels = false,
  showLegend = true,
  centerContent,
  colors = defaultColors,
  className,
}: PieChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const radius = size / 2;
  const innerRadius = donut ? radius - donutWidth : 0;
  const centerX = radius;
  const centerY = radius;

  // Calculate segments
  const segments = useMemo(() => {
    let currentAngle = -90; // Start from top
    return data.map((item, index) => {
      const percent = total > 0 ? item.value / total : 0;
      const angle = percent * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      currentAngle = endAngle;

      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;

      // Large arc flag
      const largeArc = angle > 180 ? 1 : 0;

      // Outer arc points
      const x1 = centerX + radius * Math.cos(startRad);
      const y1 = centerY + radius * Math.sin(startRad);
      const x2 = centerX + radius * Math.cos(endRad);
      const y2 = centerY + radius * Math.sin(endRad);

      // Inner arc points (for donut)
      const x3 = centerX + innerRadius * Math.cos(endRad);
      const y3 = centerY + innerRadius * Math.sin(endRad);
      const x4 = centerX + innerRadius * Math.cos(startRad);
      const y4 = centerY + innerRadius * Math.sin(startRad);

      let path: string;
      if (donut) {
        path = [
          `M ${x1} ${y1}`,
          `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
          `L ${x3} ${y3}`,
          `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4}`,
          'Z',
        ].join(' ');
      } else {
        path = [
          `M ${centerX} ${centerY}`,
          `L ${x1} ${y1}`,
          `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
          'Z',
        ].join(' ');
      }

      return {
        ...item,
        path,
        color: item.color || colors[index % colors.length],
        percent,
        midAngle: (startAngle + endAngle) / 2,
      };
    });
  }, [data, total, radius, innerRadius, centerX, centerY, donut, colors]);

  return (
    <div className={clsx('flex flex-col items-center', className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {segments.map((segment, index) => (
            <path
              key={index}
              d={segment.path}
              fill={getHexColor(segment.color)}
              className="transition-opacity hover:opacity-80"
            />
          ))}
        </svg>
        {donut && centerContent && (
          <div className="absolute inset-0 flex items-center justify-center">
            {centerContent}
          </div>
        )}
      </div>
      {showLegend && (
        <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4 justify-center">
          {segments.map((segment, index) => (
            <div key={index} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: getHexColor(segment.color) }}
              />
              <span className="text-xs text-gray-600">
                {segment.label} ({Math.round(segment.percent * 100)}%)
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Gauge/Progress Ring Component
// ============================================================================

export interface GaugeChartProps {
  value: number;
  maxValue?: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  backgroundColor?: string;
  label?: string;
  sublabel?: string;
  showPercent?: boolean;
  className?: string;
  thresholds?: Array<{ value: number; color: string }>;
}

export function GaugeChart({
  value,
  maxValue = 100,
  size = 120,
  strokeWidth = 12,
  color = '#3b82f6',
  backgroundColor = '#e5e7eb',
  label,
  sublabel,
  showPercent = true,
  className,
  thresholds,
}: GaugeChartProps) {
  const percent = Math.min(Math.max(value / maxValue, 0), 1);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - percent);

  // Determine color based on thresholds
  let activeColor = color;
  if (thresholds) {
    for (const threshold of thresholds) {
      if (value >= threshold.value) {
        activeColor = threshold.color;
      }
    }
  }

  return (
    <div className={clsx('flex flex-col items-center', className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={backgroundColor}
            strokeWidth={strokeWidth}
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={activeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-500"
          />
        </svg>
        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {showPercent ? (
            <span className="text-2xl font-bold text-gray-900">
              {Math.round(percent * 100)}%
            </span>
          ) : (
            <span className="text-2xl font-bold text-gray-900">{value}</span>
          )}
          {label && <span className="text-xs text-gray-500 mt-1">{label}</span>}
        </div>
      </div>
      {sublabel && <span className="text-sm text-gray-600 mt-2">{sublabel}</span>}
    </div>
  );
}

// ============================================================================
// Line/Sparkline Chart Component
// ============================================================================

export interface LineChartProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  showArea?: boolean;
  showDots?: boolean;
  showLabels?: boolean;
  labels?: string[];
  className?: string;
}

export function LineChart({
  data,
  width = 200,
  height = 60,
  color = '#3b82f6',
  showArea = true,
  showDots = false,
  showLabels = false,
  labels,
  className,
}: LineChartProps) {
  if (data.length === 0) return null;

  const padding = showDots ? 4 : 0;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const minValue = Math.min(...data);
  const maxValue = Math.max(...data);
  const range = maxValue - minValue || 1;

  // Generate points
  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1 || 1)) * chartWidth;
    const y = padding + (1 - (value - minValue) / range) * chartHeight;
    return { x, y, value };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  const areaPath = showArea
    ? [
        linePath,
        `L ${points[points.length - 1].x} ${height - padding}`,
        `L ${padding} ${height - padding}`,
        'Z',
      ].join(' ')
    : '';

  return (
    <div className={clsx('relative', className)}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Area fill */}
        {showArea && (
          <path d={areaPath} fill={color} fillOpacity={0.1} />
        )}
        {/* Line */}
        <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
        {/* Dots */}
        {showDots &&
          points.map((point, index) => (
            <circle
              key={index}
              cx={point.x}
              cy={point.y}
              r={3}
              fill="white"
              stroke={color}
              strokeWidth={2}
            />
          ))}
      </svg>
      {showLabels && labels && (
        <div className="flex justify-between mt-1">
          {labels.map((label, index) => (
            <span key={index} className="text-xs text-gray-500">
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Stat Card with Trend
// ============================================================================

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  iconColor?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  trendLabel?: string;
  sparklineData?: number[];
  className?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = 'bg-blue-500',
  trend,
  trendValue,
  trendLabel,
  sparklineData,
  className,
}: StatCardProps) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-500';

  return (
    <div className={clsx('bg-white rounded-xl shadow-sm border border-gray-100 p-6', className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
          {trend && trendValue && (
            <div className={clsx('flex items-center gap-1 mt-2 text-sm', trendColor)}>
              <TrendIcon className="h-4 w-4" />
              <span>{trendValue}</span>
              {trendLabel && <span className="text-gray-400 ml-1">{trendLabel}</span>}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          {Icon && (
            <div className={clsx('p-3 rounded-xl', iconColor)}>
              <Icon className="h-6 w-6 text-white" />
            </div>
          )}
          {sparklineData && sparklineData.length > 0 && (
            <LineChart
              data={sparklineData}
              width={80}
              height={32}
              color={trend === 'up' ? '#22c55e' : trend === 'down' ? '#ef4444' : '#6b7280'}
              showArea={true}
              showDots={false}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Mini Charts for Inline Use
// ============================================================================

export interface MiniBarProps {
  value: number;
  maxValue?: number;
  color?: string;
  width?: number;
  height?: number;
  showLabel?: boolean;
}

export function MiniBar({
  value,
  maxValue = 100,
  color = 'bg-primary-500',
  width = 100,
  height = 8,
  showLabel = false,
}: MiniBarProps) {
  const percent = Math.min(Math.max((value / maxValue) * 100, 0), 100);

  return (
    <div className="flex items-center gap-2">
      <div
        className="bg-gray-100 rounded-full overflow-hidden"
        style={{ width, height }}
      >
        <div
          className={clsx('h-full rounded-full transition-all duration-300', color)}
          style={{ width: `${percent}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-gray-600 whitespace-nowrap">
          {Math.round(percent)}%
        </span>
      )}
    </div>
  );
}

export interface MiniDonutProps {
  value: number;
  maxValue?: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}

export function MiniDonut({
  value,
  maxValue = 100,
  size = 24,
  strokeWidth = 4,
  color = '#3b82f6',
}: MiniDonutProps) {
  const percent = Math.min(Math.max(value / maxValue, 0), 1);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - percent);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        className="transition-all duration-300"
      />
    </svg>
  );
}

export default ChartCard;
