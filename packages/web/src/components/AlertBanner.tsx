import React, { useState, useEffect, ReactNode } from 'react';
import clsx from 'clsx';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Info,
  X,
  Bell,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';

// ============================================================================
// Types & Interfaces
// ============================================================================

export type AlertType = 'info' | 'success' | 'warning' | 'error';
export type AlertPosition = 'top' | 'bottom' | 'inline';

export interface AlertBannerProps {
  /** Alert type determines styling */
  type?: AlertType;
  /** Title of the alert */
  title?: string;
  /** Main message content */
  message: string | ReactNode;
  /** Whether the alert can be dismissed */
  dismissible?: boolean;
  /** Callback when dismissed */
  onDismiss?: () => void;
  /** Auto-dismiss after duration (ms) */
  autoDismiss?: number;
  /** Custom icon */
  icon?: ReactNode;
  /** Action button */
  action?: {
    label: string;
    onClick: () => void;
    href?: string;
  };
  /** Position of the banner */
  position?: AlertPosition;
  /** Custom className */
  className?: string;
  /** Whether to show the icon */
  showIcon?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Unique ID for tracking dismissed state */
  id?: string;
}

export interface AlertStackProps {
  alerts: AlertBannerProps[];
  position?: 'top' | 'bottom';
  className?: string;
  maxVisible?: number;
}

export interface SystemAlertProps {
  id: string;
  type: AlertType;
  title: string;
  message: string;
  link?: string;
  createdAt: Date;
  read?: boolean;
  onMarkRead?: (id: string) => void;
  onDismiss?: (id: string) => void;
}

// ============================================================================
// Styling Configuration
// ============================================================================

const typeConfig: Record<AlertType, {
  icon: typeof AlertCircle;
  bgColor: string;
  borderColor: string;
  textColor: string;
  iconColor: string;
}> = {
  info: {
    icon: Info,
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-800',
    iconColor: 'text-blue-500',
  },
  success: {
    icon: CheckCircle,
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-800',
    iconColor: 'text-green-500',
  },
  warning: {
    icon: AlertTriangle,
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    textColor: 'text-amber-800',
    iconColor: 'text-amber-500',
  },
  error: {
    icon: AlertCircle,
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-800',
    iconColor: 'text-red-500',
  },
};

const sizeConfig = {
  sm: {
    padding: 'px-3 py-2',
    iconSize: 'h-4 w-4',
    textSize: 'text-xs',
    titleSize: 'text-sm',
  },
  md: {
    padding: 'px-4 py-3',
    iconSize: 'h-5 w-5',
    textSize: 'text-sm',
    titleSize: 'text-base',
  },
  lg: {
    padding: 'px-5 py-4',
    iconSize: 'h-6 w-6',
    textSize: 'text-base',
    titleSize: 'text-lg',
  },
};

// ============================================================================
// AlertBanner Component
// ============================================================================

export function AlertBanner({
  type = 'info',
  title,
  message,
  dismissible = true,
  onDismiss,
  autoDismiss,
  icon,
  action,
  position = 'inline',
  className,
  showIcon = true,
  size = 'md',
  id,
}: AlertBannerProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

  // Auto-dismiss logic
  useEffect(() => {
    if (autoDismiss && autoDismiss > 0) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, autoDismiss);
      return () => clearTimeout(timer);
    }
  }, [autoDismiss]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      onDismiss?.();
    }, 200);
  };

  if (!isVisible) return null;

  const config = typeConfig[type];
  const sizes = sizeConfig[size];
  const Icon = config.icon;

  const positionClasses = {
    top: 'fixed top-0 left-0 right-0 z-50 rounded-none border-b',
    bottom: 'fixed bottom-0 left-0 right-0 z-50 rounded-none border-t',
    inline: 'rounded-lg border',
  };

  return (
    <div
      role="alert"
      className={clsx(
        'flex items-start gap-3 transition-all duration-200',
        config.bgColor,
        config.borderColor,
        positionClasses[position],
        sizes.padding,
        isExiting && 'opacity-0 transform -translate-y-2',
        className,
      )}
    >
      {/* Icon */}
      {showIcon && (
        <div className="flex-shrink-0 mt-0.5">
          {icon || <Icon className={clsx(sizes.iconSize, config.iconColor)} />}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        {title && (
          <h4 className={clsx('font-semibold', config.textColor, sizes.titleSize)}>
            {title}
          </h4>
        )}
        <div className={clsx(config.textColor, sizes.textSize, title && 'mt-0.5')}>
          {message}
        </div>
      </div>

      {/* Action */}
      {action && (
        action.href ? (
          <a
            href={action.href}
            target="_blank"
            rel="noopener noreferrer"
            className={clsx(
              'flex-shrink-0 flex items-center gap-1 font-medium transition-colors',
              sizes.textSize,
              config.textColor,
              'hover:underline',
            )}
          >
            {action.label}
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          <button
            onClick={action.onClick}
            className={clsx(
              'flex-shrink-0 flex items-center gap-1 font-medium transition-colors',
              sizes.textSize,
              config.textColor,
              'hover:underline',
            )}
          >
            {action.label}
            <ChevronRight className="h-3 w-3" />
          </button>
        )
      )}

      {/* Dismiss button */}
      {dismissible && (
        <button
          onClick={handleDismiss}
          className={clsx(
            'flex-shrink-0 p-1 rounded-md transition-colors',
            config.textColor,
            'hover:bg-black/5',
          )}
          aria-label="Dismiss"
        >
          <X className={sizes.iconSize} />
        </button>
      )}
    </div>
  );
}

// ============================================================================
// AlertStack Component - Multiple stacked alerts
// ============================================================================

export function AlertStack({
  alerts,
  position = 'top',
  className,
  maxVisible = 3,
}: AlertStackProps) {
  const visibleAlerts = alerts.slice(0, maxVisible);
  const hiddenCount = alerts.length - maxVisible;

  if (alerts.length === 0) return null;

  return (
    <div
      className={clsx(
        'fixed left-0 right-0 z-50 space-y-2 px-4 py-2',
        position === 'top' && 'top-0',
        position === 'bottom' && 'bottom-0',
        className,
      )}
    >
      {visibleAlerts.map((alert, index) => (
        <AlertBanner
          key={alert.id || index}
          {...alert}
          position="inline"
          className="shadow-lg"
        />
      ))}
      {hiddenCount > 0 && (
        <div className="text-center text-sm text-gray-500">
          +{hiddenCount} more alert{hiddenCount > 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SystemAlert Component - For persistent system notifications
// ============================================================================

export function SystemAlert({
  id,
  type,
  title,
  message,
  link,
  createdAt,
  read = false,
  onMarkRead,
  onDismiss,
}: SystemAlertProps) {
  const config = typeConfig[type];
  const Icon = config.icon;

  const timeAgo = getTimeAgo(createdAt);

  return (
    <div
      className={clsx(
        'flex items-start gap-3 p-3 rounded-lg border transition-colors',
        read ? 'bg-white border-gray-200' : `${config.bgColor} ${config.borderColor}`,
      )}
    >
      <div className={clsx(
        'p-1.5 rounded-full',
        read ? 'bg-gray-100' : config.bgColor,
      )}>
        <Icon className={clsx('h-4 w-4', read ? 'text-gray-400' : config.iconColor)} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className={clsx(
            'text-sm font-medium',
            read ? 'text-gray-700' : config.textColor,
          )}>
            {title}
          </h4>
          {!read && (
            <span className="h-2 w-2 rounded-full bg-blue-500" />
          )}
        </div>
        <p className={clsx(
          'text-sm mt-0.5',
          read ? 'text-gray-500' : config.textColor,
        )}>
          {message}
        </p>
        <div className="flex items-center gap-3 mt-2">
          <span className="text-xs text-gray-400">{timeAgo}</span>
          {link && (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
            >
              View details
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {!read && onMarkRead && (
            <button
              onClick={() => onMarkRead(id)}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Mark as read
            </button>
          )}
        </div>
      </div>

      {onDismiss && (
        <button
          onClick={() => onDismiss(id)}
          className="p-1 text-gray-400 hover:text-gray-600 rounded"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

// ============================================================================
// AlertBadge - Compact notification indicator
// ============================================================================

export interface AlertBadgeProps {
  count: number;
  type?: AlertType;
  onClick?: () => void;
  className?: string;
  showZero?: boolean;
  max?: number;
}

export function AlertBadge({
  count,
  type = 'error',
  onClick,
  className,
  showZero = false,
  max = 99,
}: AlertBadgeProps) {
  if (count === 0 && !showZero) return null;

  const displayCount = count > max ? `${max}+` : count;

  const colorClasses = {
    info: 'bg-blue-500',
    success: 'bg-green-500',
    warning: 'bg-amber-500',
    error: 'bg-red-500',
  };

  const Wrapper = onClick ? 'button' : 'span';

  return (
    <Wrapper
      onClick={onClick}
      className={clsx(
        'inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-xs font-bold text-white',
        colorClasses[type],
        onClick && 'cursor-pointer hover:opacity-90 transition-opacity',
        className,
      )}
    >
      {displayCount}
    </Wrapper>
  );
}

// ============================================================================
// NotificationBell - Bell icon with alert count
// ============================================================================

export interface NotificationBellProps {
  count: number;
  onClick?: () => void;
  className?: string;
}

export function NotificationBell({ count, onClick, className }: NotificationBellProps) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'relative p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors',
        className,
      )}
    >
      <Bell className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 h-5 min-w-5 flex items-center justify-center px-1 text-xs font-bold text-white bg-red-500 rounded-full">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
