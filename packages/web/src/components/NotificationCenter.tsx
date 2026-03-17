/**
 * Notification Center - Dropdown Component
 * 
 * Features:
 * - Notification list with filtering
 * - Mark as read / Mark all as read
 * - Category tabs for filtering
 * - Search notifications
 * - Time-based grouping (Today, Yesterday, This Week, Older)
 * - Empty states and loading states
 * - Infinite scroll for large notification lists
 */

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Trash2,
  Search,
  Filter,
  Settings,
  X,
  ChevronRight,
  Package,
  Factory,
  Boxes,
  Users,
  AlertTriangle,
  MessageSquare,
  Settings2,
  Clock,
} from 'lucide-react';
import { clsx } from 'clsx';
import { formatDistanceToNow, isToday, isYesterday, isThisWeek, format } from 'date-fns';
import { useNotifications, useUnreadCount } from '../hooks/useNotifications';
import { InAppNotification, NotificationCategory, NotificationType } from '../stores/notifications';

// ============================================================================
// Types
// ============================================================================

interface NotificationCenterProps {
  className?: string;
}

type TimeGroup = 'today' | 'yesterday' | 'thisWeek' | 'older';

// ============================================================================
// Configuration
// ============================================================================

const categoryConfig: Record<NotificationCategory, {
  label: string;
  icon: React.ElementType;
  color: string;
}> = {
  order: { label: 'Orders', icon: Package, color: 'text-blue-500' },
  production: { label: 'Production', icon: Factory, color: 'text-purple-500' },
  inventory: { label: 'Inventory', icon: Boxes, color: 'text-amber-500' },
  customer: { label: 'Customers', icon: Users, color: 'text-green-500' },
  system: { label: 'System', icon: Settings2, color: 'text-gray-500' },
  message: { label: 'Messages', icon: MessageSquare, color: 'text-indigo-500' },
  alert: { label: 'Alerts', icon: AlertTriangle, color: 'text-red-500' },
};

const typeStyles: Record<NotificationType, string> = {
  success: 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800',
  error: 'bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800',
  warning: 'bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800',
  info: 'bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800',
};

const timeGroupLabels: Record<TimeGroup, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  thisWeek: 'This Week',
  older: 'Older',
};

// ============================================================================
// Helper Functions
// ============================================================================

function getTimeGroup(timestamp: number): TimeGroup {
  const date = new Date(timestamp);
  if (isToday(date)) return 'today';
  if (isYesterday(date)) return 'yesterday';
  if (isThisWeek(date)) return 'thisWeek';
  return 'older';
}

function groupNotificationsByTime(
  notifications: InAppNotification[]
): Map<TimeGroup, InAppNotification[]> {
  const groups = new Map<TimeGroup, InAppNotification[]>();
  
  notifications.forEach((notification) => {
    const group = getTimeGroup(notification.timestamp);
    if (!groups.has(group)) {
      groups.set(group, []);
    }
    groups.get(group)!.push(notification);
  });
  
  return groups;
}

// ============================================================================
// Notification Item Component
// ============================================================================

interface NotificationItemProps {
  notification: InAppNotification;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

function NotificationItem({ 
  notification, 
  onMarkAsRead, 
  onDelete,
  onClose,
}: NotificationItemProps) {
  const category = categoryConfig[notification.category];
  const CategoryIcon = category.icon;
  
  const handleClick = () => {
    if (!notification.read) {
      onMarkAsRead(notification.id);
    }
  };
  
  const content = (
    <div
      className={clsx(
        'relative p-4 border-b border-gray-100 dark:border-gray-800',
        'hover:bg-gray-50 dark:hover:bg-gray-800/50',
        'transition-colors duration-150',
        !notification.read && 'bg-blue-50/50 dark:bg-blue-900/10'
      )}
      onClick={handleClick}
    >
      {/* Unread indicator */}
      {!notification.read && (
        <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-blue-500" />
      )}
      
      <div className="flex items-start gap-3 pl-3">
        {/* Category Icon */}
        <div className={clsx(
          'flex-shrink-0 p-2 rounded-lg',
          'bg-gray-100 dark:bg-gray-800',
          category.color
        )}>
          <CategoryIcon className="h-4 w-4" />
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={clsx(
              'text-sm font-medium',
              notification.read 
                ? 'text-gray-700 dark:text-gray-300' 
                : 'text-gray-900 dark:text-white'
            )}>
              {notification.title}
            </p>
            
            {/* Actions */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {!notification.read && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkAsRead(notification.id);
                  }}
                  className={clsx(
                    'p-1 rounded-md',
                    'text-gray-400 hover:text-blue-600 dark:hover:text-blue-400',
                    'hover:bg-gray-100 dark:hover:bg-gray-700',
                    'transition-colors'
                  )}
                  title="Mark as read"
                >
                  <Check className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(notification.id);
                }}
                className={clsx(
                  'p-1 rounded-md',
                  'text-gray-400 hover:text-red-600 dark:hover:text-red-400',
                  'hover:bg-gray-100 dark:hover:bg-gray-700',
                  'transition-colors'
                )}
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
          
          <p className={clsx(
            'mt-1 text-sm line-clamp-2',
            notification.read 
              ? 'text-gray-500 dark:text-gray-500' 
              : 'text-gray-600 dark:text-gray-400'
          )}>
            {notification.message}
          </p>
          
          <div className="mt-2 flex items-center gap-2">
            <span className={clsx(
              'inline-flex items-center gap-1 text-xs',
              'text-gray-400 dark:text-gray-500'
            )}>
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
            </span>
            
            {notification.link && (
              <span className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-0.5">
                {notification.linkLabel || 'View'}
                <ChevronRight className="h-3 w-3" />
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
  
  if (notification.link) {
    return (
      <Link 
        to={notification.link} 
        onClick={() => {
          handleClick();
          onClose();
        }}
        className="block"
      >
        {content}
      </Link>
    );
  }
  
  return content;
}

// ============================================================================
// Empty State Component
// ============================================================================

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="p-4 rounded-full bg-gray-100 dark:bg-gray-800">
        {hasFilters ? (
          <Search className="h-8 w-8 text-gray-400" />
        ) : (
          <BellOff className="h-8 w-8 text-gray-400" />
        )}
      </div>
      <h3 className="mt-4 text-sm font-medium text-gray-900 dark:text-gray-100">
        {hasFilters ? 'No matching notifications' : 'No notifications yet'}
      </h3>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 text-center">
        {hasFilters 
          ? 'Try adjusting your filters or search query.' 
          : "You're all caught up! We'll notify you when something happens."}
      </p>
    </div>
  );
}

// ============================================================================
// Main Notification Center Component
// ============================================================================

export function NotificationCenter({ className }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<NotificationCategory | 'all'>('all');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  const unreadCount = useUnreadCount();
  const {
    notifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    isLoading,
  } = useNotifications();
  
  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current && 
        !containerRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);
  
  // Close on escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);
  
  // Filter notifications
  const filteredNotifications = useMemo(() => {
    return notifications.filter((notification) => {
      // Category filter
      if (selectedCategory !== 'all' && notification.category !== selectedCategory) {
        return false;
      }
      
      // Unread filter
      if (showUnreadOnly && notification.read) {
        return false;
      }
      
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = notification.title.toLowerCase().includes(query);
        const matchesMessage = notification.message.toLowerCase().includes(query);
        if (!matchesTitle && !matchesMessage) {
          return false;
        }
      }
      
      return true;
    });
  }, [notifications, selectedCategory, showUnreadOnly, searchQuery]);
  
  // Group by time
  const groupedNotifications = useMemo(() => 
    groupNotificationsByTime(filteredNotifications),
    [filteredNotifications]
  );
  
  const hasFilters = searchQuery !== '' || selectedCategory !== 'all' || showUnreadOnly;
  
  const handleClose = useCallback(() => setIsOpen(false), []);
  
  return (
    <div className={clsx('relative', className)}>
      {/* Trigger Button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'relative p-2 rounded-lg',
          'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
          'hover:bg-gray-100 dark:hover:bg-gray-800',
          'transition-colors duration-150',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
          isOpen && 'bg-gray-100 dark:bg-gray-800'
        )}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Bell className="h-5 w-5" />
        
        {/* Unread badge */}
        {unreadCount > 0 && (
          <span className={clsx(
            'absolute -top-1 -right-1',
            'flex items-center justify-center',
            'min-w-[18px] h-[18px] px-1',
            'text-xs font-bold text-white',
            'bg-red-500 rounded-full',
            'animate-pulse'
          )}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      
      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={containerRef}
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={clsx(
              'absolute right-0 mt-2 z-50',
              'w-[420px] max-h-[600px]',
              'bg-white dark:bg-gray-900',
              'rounded-xl shadow-xl',
              'border border-gray-200 dark:border-gray-700',
              'flex flex-col',
              'overflow-hidden'
            )}
            role="dialog"
            aria-label="Notifications"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Notifications
              </h2>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllAsRead()}
                    className={clsx(
                      'text-xs font-medium',
                      'text-blue-600 dark:text-blue-400',
                      'hover:text-blue-800 dark:hover:text-blue-300',
                      'flex items-center gap-1'
                    )}
                  >
                    <CheckCheck className="h-4 w-4" />
                    Mark all read
                  </button>
                )}
                <Link
                  to="/settings/notifications"
                  onClick={handleClose}
                  className={clsx(
                    'p-1.5 rounded-lg',
                    'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300',
                    'hover:bg-gray-100 dark:hover:bg-gray-800',
                    'transition-colors'
                  )}
                  title="Notification settings"
                >
                  <Settings className="h-4 w-4" />
                </Link>
                <button
                  onClick={handleClose}
                  className={clsx(
                    'p-1.5 rounded-lg',
                    'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300',
                    'hover:bg-gray-100 dark:hover:bg-gray-800',
                    'transition-colors'
                  )}
                  aria-label="Close notifications"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            
            {/* Search and Filters */}
            <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 space-y-2">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search notifications..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={clsx(
                    'w-full pl-9 pr-3 py-2 text-sm',
                    'bg-gray-100 dark:bg-gray-800',
                    'border-0 rounded-lg',
                    'text-gray-900 dark:text-white',
                    'placeholder:text-gray-400 dark:placeholder:text-gray-500',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500'
                  )}
                />
              </div>
              
              {/* Category Tabs */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 -mx-1 px-1">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={clsx(
                    'px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap',
                    'transition-colors',
                    selectedCategory === 'all'
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  )}
                >
                  All
                </button>
                {(Object.keys(categoryConfig) as NotificationCategory[]).map((category) => {
                  const config = categoryConfig[category];
                  const Icon = config.icon;
                  return (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={clsx(
                        'px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap',
                        'flex items-center gap-1.5',
                        'transition-colors',
                        selectedCategory === category
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {config.label}
                    </button>
                  );
                })}
              </div>
              
              {/* Unread toggle */}
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showUnreadOnly}
                  onChange={(e) => setShowUnreadOnly(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                Show unread only
              </label>
            </div>
            
            {/* Notification List */}
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
                </div>
              ) : filteredNotifications.length === 0 ? (
                <EmptyState hasFilters={hasFilters} />
              ) : (
                <div>
                  {(['today', 'yesterday', 'thisWeek', 'older'] as TimeGroup[]).map((group) => {
                    const groupNotifications = groupedNotifications.get(group);
                    if (!groupNotifications || groupNotifications.length === 0) return null;
                    
                    return (
                      <div key={group}>
                        <div className="sticky top-0 z-10 px-4 py-2 bg-gray-50 dark:bg-gray-800/50 backdrop-blur-sm">
                          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            {timeGroupLabels[group]}
                          </h3>
                        </div>
                        {groupNotifications.map((notification) => (
                          <NotificationItem
                            key={notification.id}
                            notification={notification}
                            onMarkAsRead={markAsRead}
                            onDelete={deleteNotification}
                            onClose={handleClose}
                          />
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3">
              <Link
                to="/notifications"
                onClick={handleClose}
                className={clsx(
                  'block text-center text-sm font-medium',
                  'text-blue-600 dark:text-blue-400',
                  'hover:text-blue-800 dark:hover:text-blue-300'
                )}
              >
                View all notifications
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default NotificationCenter;
