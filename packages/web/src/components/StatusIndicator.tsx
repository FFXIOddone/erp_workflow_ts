interface StatusDotProps {
  status: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'pending';
  pulse?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const statusColors = {
  success: 'bg-green-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  info: 'bg-blue-500',
  neutral: 'bg-gray-400',
  pending: 'bg-gray-400',
};

const sizeClasses = {
  sm: 'w-1.5 h-1.5',
  md: 'w-2 h-2',
  lg: 'w-2.5 h-2.5',
};

export function StatusDot({ 
  status, 
  pulse = false, 
  size = 'md',
  className = '' 
}: StatusDotProps) {
  return (
    <span className={`relative flex ${sizeClasses[size]} ${className}`}>
      {pulse && (
        <span 
          className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${statusColors[status]}`}
        />
      )}
      <span 
        className={`relative inline-flex rounded-full ${sizeClasses[size]} ${statusColors[status]}`}
      />
    </span>
  );
}

// Connection status with label
interface ConnectionStatusProps {
  isConnected: boolean;
  label?: string;
}

export function ConnectionStatus({ isConnected, label }: ConnectionStatusProps) {
  return (
    <div className="flex items-center gap-2">
      <StatusDot 
        status={isConnected ? 'success' : 'danger'} 
        pulse={!isConnected}
      />
      {label && (
        <span className="text-xs text-gray-500">
          {label}
        </span>
      )}
    </div>
  );
}

// Order status badge with color from theme
interface OrderStatusIndicatorProps {
  status: string;
  color: string;
  label: string;
  size?: 'sm' | 'md' | 'lg';
}

export function OrderStatusIndicator({ 
  status, 
  color, 
  label,
  size = 'md' 
}: OrderStatusIndicatorProps) {
  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full ${sizeStyles[size]}`}
      style={{
        backgroundColor: `${color}15`,
        color: color,
      }}
    >
      <span 
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}
