import React, { ReactNode } from 'react';
import clsx from 'clsx';
import {
  LucideIcon,
  ArrowUp,
  ArrowDown,
  Minus,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { Sparkline, MiniSparkline } from './Sparkline';
import { MiniProgressRing } from './ProgressRing';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface StatsTileProps {
  /** Title/label for the statistic */
  title: string;
  /** Main value to display */
  value: string | number;
  /** Optional description or subtitle */
  description?: string;
  /** Icon to display */
  icon?: LucideIcon;
  /** Icon color/variant */
  iconColor?: 'blue' | 'green' | 'red' | 'amber' | 'purple' | 'pink' | 'cyan' | 'gray';
  /** Change from previous period */
  change?: number;
  /** Change format */
  changeFormat?: 'percent' | 'absolute';
  /** Whether positive change is good */
  positiveIsGood?: boolean;
  /** Sparkline data */
  sparklineData?: number[];
  /** Progress percentage (0-100) */
  progress?: number;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Visual variant */
  variant?: 'default' | 'filled' | 'outline' | 'gradient';
  /** Gradient colors (for gradient variant) */
  gradientFrom?: string;
  gradientTo?: string;
  /** Custom className */
  className?: string;
  /** Click handler */
  onClick?: () => void;
  /** Additional content in footer */
  footer?: ReactNode;
  /** Loading state */
  loading?: boolean;
}

export interface StatsTileGridProps {
  children: ReactNode;
  columns?: 2 | 3 | 4 | 5 | 6;
  className?: string;
}

export interface QuickStatProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}

// ============================================================================
// Color Configuration
// ============================================================================

const iconColorClasses: Record<string, { bg: string; text: string; gradient: string }> = {
  blue: { bg: 'bg-blue-100', text: 'text-blue-600', gradient: 'from-blue-500 to-blue-600' },
  green: { bg: 'bg-green-100', text: 'text-green-600', gradient: 'from-green-500 to-green-600' },
  red: { bg: 'bg-red-100', text: 'text-red-600', gradient: 'from-red-500 to-red-600' },
  amber: { bg: 'bg-amber-100', text: 'text-amber-600', gradient: 'from-amber-500 to-amber-600' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-600', gradient: 'from-purple-500 to-purple-600' },
  pink: { bg: 'bg-pink-100', text: 'text-pink-600', gradient: 'from-pink-500 to-pink-600' },
  cyan: { bg: 'bg-cyan-100', text: 'text-cyan-600', gradient: 'from-cyan-500 to-cyan-600' },
  gray: { bg: 'bg-gray-100', text: 'text-gray-600', gradient: 'from-gray-500 to-gray-600' },
};

// ============================================================================
// Loading Skeleton
// ============================================================================

function StatsSkeleton({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const heights = { sm: 'h-4', md: 'h-6', lg: 'h-8' };
  
  return (
    <div className="animate-pulse space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 bg-gray-200 rounded-lg" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-gray-200 rounded w-24" />
          <div className={clsx('bg-gray-200 rounded w-16', heights[size])} />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// StatsTile Component
// ============================================================================

export function StatsTile({
  title,
  value,
  description,
  icon: Icon,
  iconColor = 'blue',
  change,
  changeFormat = 'percent',
  positiveIsGood = true,
  sparklineData,
  progress,
  size = 'md',
  variant = 'default',
  gradientFrom = 'from-blue-500',
  gradientTo = 'to-purple-500',
  className,
  onClick,
  footer,
  loading = false,
}: StatsTileProps) {
  const colors = iconColorClasses[iconColor];

  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;
  const trendIsGood = positiveIsGood ? isPositive : isNegative;
  const trendIsBad = positiveIsGood ? isNegative : isPositive;

  const sizeClasses = {
    sm: {
      padding: 'p-3',
      iconContainer: 'h-8 w-8',
      icon: 'h-4 w-4',
      title: 'text-xs',
      value: 'text-lg font-bold',
      change: 'text-xs',
    },
    md: {
      padding: 'p-4',
      iconContainer: 'h-10 w-10',
      icon: 'h-5 w-5',
      title: 'text-sm',
      value: 'text-2xl font-bold',
      change: 'text-sm',
    },
    lg: {
      padding: 'p-5',
      iconContainer: 'h-12 w-12',
      icon: 'h-6 w-6',
      title: 'text-base',
      value: 'text-3xl font-bold',
      change: 'text-sm',
    },
  };

  const styles = sizeClasses[size];

  const variantClasses = {
    default: 'bg-white border border-gray-200',
    filled: `${colors.bg} border border-transparent`,
    outline: `bg-white border-2 ${colors.text.replace('text-', 'border-')}`,
    gradient: `bg-gradient-to-br ${gradientFrom} ${gradientTo} text-white border border-transparent`,
  };

  const isGradient = variant === 'gradient';
  const CardWrapper = onClick ? 'button' : 'div';

  return (
    <CardWrapper
      onClick={onClick}
      className={clsx(
        'rounded-lg text-left w-full transition-all',
        variantClasses[variant],
        styles.padding,
        onClick && 'hover:shadow-md cursor-pointer',
        className,
      )}
    >
      {loading ? (
        <StatsSkeleton size={size} />
      ) : (
        <>
          <div className="flex items-start gap-3">
            {/* Icon */}
            {Icon && (
              <div
                className={clsx(
                  'rounded-lg flex items-center justify-center flex-shrink-0',
                  styles.iconContainer,
                  isGradient ? 'bg-white/20' : colors.bg,
                )}
              >
                <Icon className={clsx(styles.icon, isGradient ? 'text-white' : colors.text)} />
              </div>
            )}

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className={clsx(
                'font-medium truncate',
                styles.title,
                isGradient ? 'text-white/80' : 'text-gray-500',
              )}>
                {title}
              </p>
              <p className={clsx(
                styles.value,
                isGradient ? 'text-white' : 'text-gray-900',
              )}>
                {value}
              </p>

              {/* Change indicator */}
              {change !== undefined && (
                <div className={clsx('flex items-center gap-1 mt-1', styles.change)}>
                  {isPositive && <ArrowUp className="h-3.5 w-3.5" />}
                  {isNegative && <ArrowDown className="h-3.5 w-3.5" />}
                  {!isPositive && !isNegative && <Minus className="h-3.5 w-3.5" />}
                  <span className={clsx(
                    'font-medium',
                    isGradient 
                      ? 'text-white/90' 
                      : trendIsGood 
                        ? 'text-green-600' 
                        : trendIsBad 
                          ? 'text-red-600' 
                          : 'text-gray-500',
                  )}>
                    {changeFormat === 'percent' 
                      ? `${Math.abs(change).toFixed(1)}%`
                      : Math.abs(change).toFixed(0)}
                  </span>
                  {description && (
                    <span className={clsx(
                      isGradient ? 'text-white/70' : 'text-gray-400',
                    )}>
                      {description}
                    </span>
                  )}
                </div>
              )}

              {/* Description without change */}
              {!change && description && (
                <p className={clsx(
                  'mt-1',
                  styles.change,
                  isGradient ? 'text-white/70' : 'text-gray-500',
                )}>
                  {description}
                </p>
              )}
            </div>

            {/* Progress ring */}
            {progress !== undefined && (
              <MiniProgressRing
                value={progress}
                size={size === 'sm' ? 32 : size === 'lg' ? 48 : 40}
                color={isGradient ? 'white' : iconColor}
              />
            )}
          </div>

          {/* Sparkline */}
          {sparklineData && sparklineData.length > 0 && (
            <div className={clsx('mt-3 pt-3', isGradient ? 'border-t border-white/20' : 'border-t border-gray-100')}>
              <Sparkline
                data={sparklineData}
                width={size === 'sm' ? 100 : size === 'lg' ? 160 : 130}
                height={size === 'sm' ? 24 : size === 'lg' ? 36 : 30}
                color={isGradient ? 'white' : trendIsGood ? 'green' : trendIsBad ? 'red' : iconColor}
                strokeWidth={1.5}
              />
            </div>
          )}

          {/* Footer */}
          {footer && (
            <div className={clsx('mt-3 pt-3', isGradient ? 'border-t border-white/20' : 'border-t border-gray-100')}>
              {footer}
            </div>
          )}
        </>
      )}
    </CardWrapper>
  );
}

// ============================================================================
// StatsTileGrid Component
// ============================================================================

export function StatsTileGrid({ children, columns = 4, className }: StatsTileGridProps) {
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
// QuickStat Component - Compact inline stat
// ============================================================================

export function QuickStat({
  label,
  value,
  icon: Icon,
  trend,
  className,
}: QuickStatProps) {
  return (
    <div className={clsx('flex items-center gap-2', className)}>
      {Icon && (
        <div className="h-8 w-8 rounded-lg bg-gray-100 flex items-center justify-center">
          <Icon className="h-4 w-4 text-gray-600" />
        </div>
      )}
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <div className="flex items-center gap-1">
          <span className="text-sm font-semibold text-gray-900">{value}</span>
          {trend && (
            trend === 'up' ? (
              <TrendingUp className="h-3.5 w-3.5 text-green-500" />
            ) : trend === 'down' ? (
              <TrendingDown className="h-3.5 w-3.5 text-red-500" />
            ) : (
              <Minus className="h-3.5 w-3.5 text-gray-400" />
            )
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// StatsRow Component - Horizontal stats display
// ============================================================================

export interface StatsRowProps {
  stats: {
    label: string;
    value: string | number;
    change?: number;
  }[];
  className?: string;
}

export function StatsRow({ stats, className }: StatsRowProps) {
  return (
    <div className={clsx(
      'flex items-center divide-x divide-gray-200',
      className,
    )}>
      {stats.map((stat, index) => (
        <div
          key={index}
          className={clsx(
            'flex-1 text-center py-2',
            index === 0 ? 'pl-0 pr-4' : index === stats.length - 1 ? 'pl-4 pr-0' : 'px-4',
          )}
        >
          <p className="text-xs text-gray-500">{stat.label}</p>
          <p className="text-lg font-bold text-gray-900">{stat.value}</p>
          {stat.change !== undefined && (
            <p className={clsx(
              'text-xs font-medium',
              stat.change > 0 ? 'text-green-600' : stat.change < 0 ? 'text-red-600' : 'text-gray-500',
            )}>
              {stat.change > 0 ? '+' : ''}{stat.change}%
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// ComparisonStat Component - Before/After comparison
// ============================================================================

export interface ComparisonStatProps {
  title: string;
  before: { label: string; value: string | number };
  after: { label: string; value: string | number };
  change?: number;
  className?: string;
}

export function ComparisonStat({
  title,
  before,
  after,
  change,
  className,
}: ComparisonStatProps) {
  return (
    <div className={clsx('bg-white rounded-lg border border-gray-200 p-4', className)}>
      <h4 className="text-sm font-medium text-gray-500 mb-3">{title}</h4>
      <div className="flex items-center justify-between gap-4">
        <div className="text-center flex-1">
          <p className="text-xs text-gray-400">{before.label}</p>
          <p className="text-xl font-bold text-gray-400">{before.value}</p>
        </div>
        <div className="flex items-center gap-2">
          <ArrowDown className="h-4 w-4 text-gray-300 rotate-[-90deg]" />
          {change !== undefined && (
            <span className={clsx(
              'text-sm font-bold px-2 py-0.5 rounded',
              change > 0 ? 'bg-green-100 text-green-700' : change < 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600',
            )}>
              {change > 0 ? '+' : ''}{change}%
            </span>
          )}
        </div>
        <div className="text-center flex-1">
          <p className="text-xs text-gray-400">{after.label}</p>
          <p className="text-xl font-bold text-gray-900">{after.value}</p>
        </div>
      </div>
    </div>
  );
}
