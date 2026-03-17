import { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  size?: 'sm' | 'md' | 'lg';
  dot?: boolean;
  dotColor?: string;
}

const variantStyles = {
  default: 'bg-gray-100 text-gray-700',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-blue-100 text-blue-700',
  neutral: 'bg-gray-50 text-gray-600 border border-gray-200',
};

const sizeStyles = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
  lg: 'px-3 py-1.5 text-sm',
};

export function Badge({ 
  children, 
  variant = 'default', 
  size = 'sm',
  dot = false,
  dotColor,
}: BadgeProps) {
  return (
    <span 
      className={`inline-flex items-center gap-1.5 font-medium rounded-full ${variantStyles[variant]} ${sizeStyles[size]}`}
    >
      {dot && (
        <span 
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: dotColor || 'currentColor' }}
        />
      )}
      {children}
    </span>
  );
}

// Status-specific badge for orders
interface StatusBadgeProps {
  status: string;
  statusColors: Record<string, string>;
  statusLabels: Record<string, string>;
}

export function StatusBadge({ status, statusColors, statusLabels }: StatusBadgeProps) {
  const color = statusColors[status] || '#6B7280';
  const label = statusLabels[status] || status;
  
  return (
    <span
      className="px-2.5 py-1 text-sm font-medium rounded-full"
      style={{
        backgroundColor: `${color}15`,
        color: color,
      }}
    >
      {label}
    </span>
  );
}
