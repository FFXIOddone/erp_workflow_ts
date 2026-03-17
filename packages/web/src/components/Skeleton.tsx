/**
 * Enhanced Skeleton Loading Components
 * 
 * Provides consistent loading states across the application.
 * Features:
 * - Base skeleton with animation variants
 * - Preset shapes (circle, rectangle, text)
 * - Composite skeletons for common patterns
 * - Shimmer animation effect
 * 
 * @example
 * <Skeleton variant="text" lines={3} />
 * <Skeleton variant="circular" size={48} />
 * <ListSkeleton count={5} />
 */

import { clsx } from 'clsx';

// ============================================================================
// Types
// ============================================================================

type SkeletonVariant = 'rectangular' | 'circular' | 'text' | 'rounded';
type SkeletonAnimation = 'pulse' | 'wave' | 'none';

interface SkeletonProps {
  className?: string;
  variant?: SkeletonVariant;
  animation?: SkeletonAnimation;
  width?: string | number;
  height?: string | number;
  size?: number; // For circular variant
  lines?: number; // For text variant
}

// ============================================================================
// Base Skeleton
// ============================================================================

export function Skeleton({ 
  className = '',
  variant = 'rectangular',
  animation = 'pulse',
  width,
  height,
  size,
  lines = 1,
}: SkeletonProps) {
  const baseClasses = clsx(
    'bg-gray-200 dark:bg-gray-700',
    animation === 'pulse' && 'animate-pulse',
    animation === 'wave' && 'animate-shimmer',
    variant === 'circular' && 'rounded-full',
    variant === 'rounded' && 'rounded-lg',
    variant === 'text' && 'rounded',
    variant === 'rectangular' && 'rounded',
    className
  );
  
  const style: React.CSSProperties = {
    width: size || width,
    height: size || height,
  };
  
  // Text variant renders multiple lines
  if (variant === 'text' && lines > 1) {
    return (
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div 
            key={i}
            className={clsx(baseClasses, i === lines - 1 && 'w-3/4')}
            style={{ height: height || 16, ...style }}
          />
        ))}
      </div>
    );
  }
  
  return <div className={baseClasses} style={style} />;
}

// ============================================================================
// Preset Skeletons
// ============================================================================

export function TableRowSkeleton({ columns = 6 }: { columns?: number }) {
  return (
    <tr className="border-b border-gray-100 dark:border-gray-800">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-6 py-4">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}

export function TableSkeleton({ rows = 5, columns = 6 }: { rows?: number; columns?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="px-6 py-3">
                <Skeleton className="h-4 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {Array.from({ length: rows }).map((_, i) => (
            <TableRowSkeleton key={i} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-soft border border-gray-100 dark:border-gray-700 p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton variant="circular" size={40} />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-20 w-full" variant="rounded" />
      <div className="flex gap-2">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-soft border border-gray-100 dark:border-gray-700 p-6">
      <div className="flex items-center gap-4">
        <Skeleton variant="rounded" className="h-12 w-12" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-8 w-16" />
        </div>
      </div>
    </div>
  );
}

export function OrderDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Skeleton variant="rounded" className="h-10 w-10" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-5 w-32" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <CardSkeleton />
          <CardSkeleton />
        </div>
        
        {/* Sidebar */}
        <div className="space-y-6">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// New Enhanced Skeletons
// ============================================================================

export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="divide-y divide-gray-200 dark:divide-gray-700">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4">
          <Skeleton variant="circular" size={40} />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton variant="rounded" className="h-8 w-20" />
        </div>
      ))}
    </div>
  );
}

export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="space-y-6">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-24" /> {/* Label */}
          <Skeleton variant="rounded" className="h-10 w-full" /> {/* Input */}
        </div>
      ))}
      <div className="flex justify-end gap-3 pt-4">
        <Skeleton variant="rounded" className="h-10 w-24" />
        <Skeleton variant="rounded" className="h-10 w-32" />
      </div>
    </div>
  );
}

export function GridSkeleton({ 
  count = 6, 
  columns = 3 
}: { 
  count?: number; 
  columns?: number;
}) {
  return (
    <div 
      className="grid gap-4"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

export function AvatarSkeleton({ size = 40 }: { size?: number }) {
  return <Skeleton variant="circular" size={size} />;
}

export function ButtonSkeleton({ 
  size = 'md' 
}: { 
  size?: 'sm' | 'md' | 'lg'; 
}) {
  const sizes = {
    sm: 'h-8 w-16',
    md: 'h-10 w-24',
    lg: 'h-12 w-32',
  };
  return <Skeleton variant="rounded" className={sizes[size]} />;
}

export function TextSkeleton({ 
  lines = 3,
  spacing = 'normal',
}: { 
  lines?: number;
  spacing?: 'tight' | 'normal' | 'loose';
}) {
  const spacingClasses = {
    tight: 'space-y-1',
    normal: 'space-y-2',
    loose: 'space-y-3',
  };
  
  return (
    <div className={spacingClasses[spacing]}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton 
          key={i} 
          className={clsx('h-4', i === lines - 1 && 'w-3/4')}
        />
      ))}
    </div>
  );
}

export function HeaderSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton variant="rounded" className="h-10 w-10" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
      
      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <CardSkeleton />
        </div>
        <div>
          <ListSkeleton count={4} />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Skeleton Wrapper (for conditional loading)
// ============================================================================

interface SkeletonWrapperProps {
  isLoading: boolean;
  skeleton: React.ReactNode;
  children: React.ReactNode;
}

export function SkeletonWrapper({
  isLoading,
  skeleton,
  children,
}: SkeletonWrapperProps) {
  if (isLoading) {
    return <>{skeleton}</>;
  }
  return <>{children}</>;
}

// ============================================================================
// CSS for wave animation (add to index.css)
// ============================================================================
/*
@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.animate-shimmer {
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0) 0,
    rgba(255, 255, 255, 0.2) 20%,
    rgba(255, 255, 255, 0.5) 60%,
    rgba(255, 255, 255, 0)
  );
  background-size: 200% 100%;
  animation: shimmer 2s infinite linear;
}
*/
