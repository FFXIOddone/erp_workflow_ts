import React, { ReactNode } from 'react';
import clsx from 'clsx';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowUp,
  ArrowDown,
  LucideIcon,
} from 'lucide-react';
import { Sparkline, SparklineBar, TrendIndicator } from './Sparkline';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface MetricCardProps {
  /** Title/label for the metric */
  title: string;
  /** Main value to display */
  value: string | number;
  /** Optional subtitle or description */
  subtitle?: string;
  /** Previous value for comparison */
  previousValue?: number;
  /** Current numeric value (for trend calculation) */
  currentValue?: number;
  /** Change value to display */
  change?: number;
  /** Change format */
  changeFormat?: 'percent' | 'absolute';
  /** Whether positive change is good (green) or bad (red) */
  positiveIsGood?: boolean;
  /** Icon to display */
  icon?: LucideIcon;
  /** Icon background color */
  iconColor?: 'blue' | 'green' | 'red' | 'amber' | 'purple' | 'pink' | 'cyan' | 'gray';
  /** Sparkline data */
  sparklineData?: number[];
  /** Sparkline type */
  sparklineType?: 'line' | 'bar' | 'area';
  /** Card size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Custom className */
  className?: string;
  /** Click handler */
  onClick?: () => void;
  /** Loading state */
  loading?: boolean;
  /** Footer content */
  footer?: ReactNode;
  /** Whether to show border */
  bordered?: boolean;
}

export interface MetricGridProps {
  children: ReactNode;
  columns?: 2 | 3 | 4 | 5 | 6;
  className?: string;
}

export interface KPICardProps {
  title: string;
  value: string | number;
  target?: number;
  current?: number;
  unit?: string;
  icon?: LucideIcon;
  sparklineData?: number[];
  className?: string;
}

// ============================================================================
// Color Utilities
// ============================================================================

const iconColorClasses: Record<string, { bg: string; text: string }> = {
  blue: { bg: 'bg-blue-100', text: 'text-blue-600' },
  green: { bg: 'bg-green-100', text: 'text-green-600' },
  red: { bg: 'bg-red-100', text: 'text-red-600' },
  amber: { bg: 'bg-amber-100', text: 'text-amber-600' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-600' },
  pink: { bg: 'bg-pink-100', text: 'text-pink-600' },
  cyan: { bg: 'bg-cyan-100', text: 'text-cyan-600' },
  gray: { bg: 'bg-gray-100', text: 'text-gray-600' },
};

// ============================================================================
// Loading Skeleton
// ============================================================================

function MetricSkeleton({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const heights = { sm: 'h-4', md: 'h-6', lg: 'h-8' };
  
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-3 bg-gray-200 rounded w-24" />
      <div className={clsx('bg-gray-200 rounded w-20', heights[size])} />
      <div className="h-3 bg-gray-200 rounded w-16" />
    </div>
  );
}

// ============================================================================
// MetricCard Component
// ============================================================================

export function MetricCard({
  title,
  value,
  subtitle,
  previousValue,
  currentValue,
  change,
  changeFormat = 'percent',
  positiveIsGood = true,
  icon: Icon,
  iconColor = 'blue',
  sparklineData,
  sparklineType = 'line',
  size = 'md',
  className,
  onClick,
  loading = false,
  footer,
  bordered = true,
}: MetricCardProps) {
  // Calculate change if current and previous values provided
  const calculatedChange = change ?? (
    currentValue !== undefined && previousValue !== undefined
      ? currentValue - previousValue
      : undefined
  );

  const isPositive = calculatedChange !== undefined && calculatedChange > 0;
  const isNegative = calculatedChange !== undefined && calculatedChange < 0;
  
  // Determine trend color based on positiveIsGood setting
  const trendIsGood = positiveIsGood ? isPositive : isNegative;
  const trendIsBad = positiveIsGood ? isNegative : isPositive;

  const sizeClasses = {
    sm: {
      padding: 'p-3',
      title: 'text-xs',
      value: 'text-lg font-semibold',
      icon: 'h-8 w-8',
      iconInner: 'h-4 w-4',
    },
    md: {
      padding: 'p-4',
      title: 'text-sm',
      value: 'text-2xl font-bold',
      icon: 'h-10 w-10',
      iconInner: 'h-5 w-5',
    },
    lg: {
      padding: 'p-5',
      title: 'text-base',
      value: 'text-3xl font-bold',
      icon: 'h-12 w-12',
      iconInner: 'h-6 w-6',
    },
  };

  const styles = sizeClasses[size];
  const colors = iconColorClasses[iconColor];

  const CardWrapper = onClick ? 'button' : 'div';

  return (
    <CardWrapper
      className={clsx(
        'bg-white rounded-lg text-left w-full',
        bordered && 'border border-gray-200',
        onClick && 'hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer',
        styles.padding,
        className,
      )}
      onClick={onClick}
    >
      {loading ? (
        <MetricSkeleton size={size} />
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              {/* Title */}
              <p className={clsx('text-gray-500 font-medium truncate', styles.title)}>
                {title}
              </p>

              {/* Value */}
              <p className={clsx('text-gray-900 mt-1', styles.value)}>
                {value}
              </p>

              {/* Change indicator */}
              {calculatedChange !== undefined && (
                <div className="flex items-center gap-2 mt-2">
                  <span
                    className={clsx(
                      'inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded',
                      trendIsGood && 'bg-green-100 text-green-700',
                      trendIsBad && 'bg-red-100 text-red-700',
                      !trendIsGood && !trendIsBad && 'bg-gray-100 text-gray-600',
                    )}
                  >
                    {isPositive && <ArrowUp className="h-3 w-3" />}
                    {isNegative && <ArrowDown className="h-3 w-3" />}
                    {!isPositive && !isNegative && <Minus className="h-3 w-3" />}
                    {changeFormat === 'percent' && previousValue
                      ? `${Math.abs((calculatedChange / previousValue) * 100).toFixed(1)}%`
                      : Math.abs(calculatedChange).toFixed(0)}
                  </span>
                  {subtitle && (
                    <span className="text-xs text-gray-500">{subtitle}</span>
                  )}
                </div>
              )}

              {/* Subtitle without change */}
              {!calculatedChange && subtitle && (
                <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
              )}
            </div>

            {/* Icon */}
            {Icon && (
              <div
                className={clsx(
                  'rounded-lg flex items-center justify-center flex-shrink-0',
                  colors.bg,
                  styles.icon,
                )}
              >
                <Icon className={clsx(colors.text, styles.iconInner)} />
              </div>
            )}
          </div>

          {/* Sparkline */}
          {sparklineData && sparklineData.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              {sparklineType === 'bar' ? (
                <SparklineBar
                  data={sparklineData}
                  width={size === 'sm' ? 80 : size === 'lg' ? 140 : 120}
                  height={size === 'sm' ? 24 : size === 'lg' ? 40 : 32}
                  color={trendIsGood ? 'green' : trendIsBad ? 'red' : 'blue'}
                />
              ) : (
                <Sparkline
                  data={sparklineData}
                  width={size === 'sm' ? 80 : size === 'lg' ? 140 : 120}
                  height={size === 'sm' ? 24 : size === 'lg' ? 40 : 32}
                  color={trendIsGood ? 'green' : trendIsBad ? 'red' : 'blue'}
                  variant={sparklineType}
                  showFill={sparklineType === 'area'}
                />
              )}
            </div>
          )}

          {/* Footer */}
          {footer && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              {footer}
            </div>
          )}
        </>
      )}
    </CardWrapper>
  );
}

// ============================================================================
// MetricGrid Component
// ============================================================================

export function MetricGrid({ children, columns = 4, className }: MetricGridProps) {
  const gridCols = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
    6: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6',
  };

  return (
    <div className={clsx('grid gap-4', gridCols[columns], className)}>
      {children}
    </div>
  );
}

// ============================================================================
// KPICard Component - Specialized for KPIs with targets
// ============================================================================

export function KPICard({
  title,
  value,
  target,
  current,
  unit = '',
  icon: Icon,
  sparklineData,
  className,
}: KPICardProps) {
  const progress = target && current !== undefined 
    ? Math.min((current / target) * 100, 100) 
    : undefined;

  const isOnTrack = progress !== undefined && progress >= 80;
  const isWarning = progress !== undefined && progress >= 50 && progress < 80;
  const isCritical = progress !== undefined && progress < 50;

  return (
    <div className={clsx('bg-white rounded-lg border border-gray-200 p-4', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {value}
            {unit && <span className="text-sm font-normal text-gray-500 ml-1">{unit}</span>}
          </p>
        </div>
        {Icon && (
          <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
            <Icon className="h-5 w-5 text-blue-600" />
          </div>
        )}
      </div>

      {/* Progress bar toward target */}
      {progress !== undefined && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-500">Progress</span>
            <span className={clsx(
              'font-medium',
              isOnTrack && 'text-green-600',
              isWarning && 'text-amber-600',
              isCritical && 'text-red-600',
            )}>
              {progress.toFixed(0)}%
            </span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={clsx(
                'h-full rounded-full transition-all duration-500',
                isOnTrack && 'bg-green-500',
                isWarning && 'bg-amber-500',
                isCritical && 'bg-red-500',
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
          {target && (
            <p className="text-xs text-gray-500 mt-1">
              Target: {target.toLocaleString()}{unit}
            </p>
          )}
        </div>
      )}

      {/* Sparkline */}
      {sparklineData && sparklineData.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <Sparkline
            data={sparklineData}
            width={120}
            height={32}
            color={isOnTrack ? 'green' : isWarning ? 'amber' : isCritical ? 'red' : 'blue'}
            variant="area"
          />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// CompactMetric - Ultra-minimal metric display
// ============================================================================

export interface CompactMetricProps {
  label: string;
  value: string | number;
  change?: number;
  className?: string;
}

export function CompactMetric({ label, value, change, className }: CompactMetricProps) {
  return (
    <div className={clsx('flex items-center justify-between py-2', className)}>
      <span className="text-sm text-gray-600">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-900">{value}</span>
        {change !== undefined && (
          <TrendIndicator
            value={change}
            previousValue={0}
            format="absolute"
            size="sm"
          />
        )}
      </div>
    </div>
  );
}
