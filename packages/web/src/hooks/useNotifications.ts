/**
 * useNotifications Hook
 * 
 * Comprehensive hook for notification management with:
 * - Real-time WebSocket integration
 * - API synchronization
 * - Toast shortcuts
 * - Notification filtering and search
 * - Subscription patterns for category-specific updates
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useWebSocket } from './useWebSocket';
import {
  useNotificationStore,
  NotificationCategory,
  NotificationType,
  NotificationAction,
  InAppNotification,
  selectVisibleToasts,
  selectUnreadNotifications,
  selectRecentNotifications,
} from '../stores/notifications';

// ============================================================================
// Types
// ============================================================================

interface UseNotificationsOptions {
  /** Auto-fetch notifications on mount */
  autoFetch?: boolean;
  /** Categories to filter */
  categories?: NotificationCategory[];
  /** Enable real-time updates */
  realtime?: boolean;
  /** Refetch interval in ms (0 = disabled) */
  refetchInterval?: number;
}

interface ToastOptions {
  duration?: number;
  actions?: NotificationAction[];
  dismissible?: boolean;
  sound?: boolean;
  vibrate?: boolean;
  groupId?: string;
}

interface NotificationFilters {
  categories?: NotificationCategory[];
  types?: NotificationType[];
  read?: boolean;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

// ============================================================================
// API Types
// ============================================================================

interface NotificationApiResponse {
  success: boolean;
  data: {
    notifications: InAppNotification[];
    total: number;
    unreadCount: number;
  };
}

// ============================================================================
// Main Hook
// ============================================================================

export function useNotifications(options: UseNotificationsOptions = {}) {
  const {
    autoFetch = true,
    categories,
    realtime = true,
    refetchInterval = 0, // WebSocket handles real-time updates; no polling needed
  } = options;
  
  const queryClient = useQueryClient();
  const { lastMessage } = useWebSocket();
  const lastProcessedMessageRef = useRef<string | null>(null);
  
  // Store access
  const store = useNotificationStore();
  const toasts = useNotificationStore(selectVisibleToasts);
  const unreadNotifications = useNotificationStore(selectUnreadNotifications);
  const recentNotifications = useNotificationStore(selectRecentNotifications(20));
  
  // ============================================================================
  // API Queries
  // ============================================================================
  
  const notificationsQuery = useQuery<NotificationApiResponse>({
    queryKey: ['notifications', { categories }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (categories?.length) {
        params.set('categories', categories.join(','));
      }
      const response = await api.get<NotificationApiResponse>(`/notifications?${params}`);
      return response.data;
    },
    enabled: autoFetch,
    refetchInterval: refetchInterval > 0 ? refetchInterval : undefined,
    staleTime: 30000, // 30 seconds
  });
  
  // Sync API data to store
  useEffect(() => {
    if (notificationsQuery.data?.data) {
      store.setNotifications(notificationsQuery.data.data.notifications);
    }
  }, [notificationsQuery.data, store]);
  
  // ============================================================================
  // Mutations
  // ============================================================================
  
  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/notifications/${id}/read`);
      return id;
    },
    onMutate: async (id) => {
      // Optimistic update
      store.markAsRead(id);
    },
    onError: (_error, id) => {
      // Rollback - refetch notifications
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
  
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      await api.patch('/notifications/read-all');
    },
    onMutate: () => {
      store.markAllAsRead();
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
  
  const deleteNotificationMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/notifications/${id}`);
      return id;
    },
    onMutate: async (id) => {
      store.removeNotification(id);
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
  
  // ============================================================================
  // Real-time Updates
  // ============================================================================
  
  useEffect(() => {
    if (!realtime || !lastMessage) return;
    
    // Avoid processing same message twice
    const messageId = JSON.stringify(lastMessage);
    if (lastProcessedMessageRef.current === messageId) return;
    lastProcessedMessageRef.current = messageId;
    
    // Handle notification-related WebSocket messages
    const { type, payload } = lastMessage as { type: string; payload?: Record<string, unknown> };
    
    switch (type) {
      case 'NOTIFICATION_NEW':
        if (payload) {
          store.addNotification(payload as Omit<InAppNotification, 'id' | 'timestamp' | 'read'>);
        }
        break;
        
      case 'ORDER_CREATED':
        store.addNotification({
          type: 'info',
          category: 'order',
          title: 'New Order Created',
          message: `Order ${(payload as { orderNumber?: string })?.orderNumber || ''} has been created`,
          entityType: 'order',
          entityId: (payload as { id?: string })?.id,
          link: `/orders/${(payload as { id?: string })?.id}`,
        });
        break;
        
      case 'ORDER_UPDATED':
        store.addNotification({
          type: 'info',
          category: 'order',
          title: 'Order Updated',
          message: `Order ${(payload as { orderNumber?: string })?.orderNumber || ''} has been updated`,
          entityType: 'order',
          entityId: (payload as { id?: string })?.id,
          link: `/orders/${(payload as { id?: string })?.id}`,
        });
        break;
        
      case 'STATION_COMPLETE':
        store.addNotification({
          type: 'success',
          category: 'production',
          title: 'Station Completed',
          message: `${(payload as { station?: string })?.station || 'Station'} completed for order ${(payload as { orderNumber?: string })?.orderNumber || ''}`,
          entityType: 'order',
          entityId: (payload as { orderId?: string })?.orderId,
          link: `/orders/${(payload as { orderId?: string })?.orderId}`,
        });
        break;
        
      case 'INVENTORY_LOW':
        store.addNotification({
          type: 'warning',
          category: 'inventory',
          title: 'Low Inventory Alert',
          message: `${(payload as { itemName?: string })?.itemName || 'Item'} is running low`,
          entityType: 'inventory',
          entityId: (payload as { itemId?: string })?.itemId,
          link: `/inventory/${(payload as { itemId?: string })?.itemId}`,
        });
        break;
        
      case 'SYSTEM_ALERT':
        store.addNotification({
          type: (payload as { severity?: NotificationType })?.severity || 'warning',
          category: 'alert',
          title: (payload as { title?: string })?.title || 'System Alert',
          message: (payload as { message?: string })?.message || '',
        });
        break;
    }
  }, [lastMessage, realtime, store]);
  
  // ============================================================================
  // Toast Helpers
  // ============================================================================
  
  const toast = useMemo(() => ({
    success: (title: string, message?: string, opts?: ToastOptions) => 
      store.success(title, message, opts),
    error: (title: string, message?: string, opts?: ToastOptions) => 
      store.error(title, message, opts),
    warning: (title: string, message?: string, opts?: ToastOptions) => 
      store.warning(title, message, opts),
    info: (title: string, message?: string, opts?: ToastOptions) => 
      store.info(title, message, opts),
    dismiss: (id: string) => store.removeToast(id),
    dismissAll: () => store.clearToasts(),
    updateProgress: store.updateToastProgress,
  }), [store]);
  
  // ============================================================================
  // Filtering
  // ============================================================================
  
  const filterNotifications = useCallback((filters: NotificationFilters) => {
    return store.notifications.filter(notification => {
      // Category filter
      if (filters.categories?.length && !filters.categories.includes(notification.category)) {
        return false;
      }
      
      // Type filter
      if (filters.types?.length && !filters.types.includes(notification.type)) {
        return false;
      }
      
      // Read status filter
      if (filters.read !== undefined && notification.read !== filters.read) {
        return false;
      }
      
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesTitle = notification.title.toLowerCase().includes(searchLower);
        const matchesMessage = notification.message.toLowerCase().includes(searchLower);
        if (!matchesTitle && !matchesMessage) {
          return false;
        }
      }
      
      // Date range filter
      if (filters.dateFrom && notification.timestamp < filters.dateFrom.getTime()) {
        return false;
      }
      if (filters.dateTo && notification.timestamp > filters.dateTo.getTime()) {
        return false;
      }
      
      return true;
    });
  }, [store.notifications]);
  
  // ============================================================================
  // Category Subscription
  // ============================================================================
  
  const subscribeToCategory = useCallback((
    category: NotificationCategory,
    callback: (notification: InAppNotification) => void
  ) => {
    // Use zustand's subscribe with selector
    return useNotificationStore.subscribe(
      (state) => state.notifications,
      (notifications, prevNotifications) => {
        // Find new notifications in this category
        const newNotifications = notifications.filter(
          n => n.category === category && 
               !prevNotifications.some(prev => prev.id === n.id)
        );
        newNotifications.forEach(callback);
      }
    );
  }, []);
  
  // ============================================================================
  // Return Value
  // ============================================================================
  
  return {
    // State
    toasts,
    notifications: store.notifications,
    unreadCount: store.unreadCount,
    unreadNotifications,
    recentNotifications,
    isLoading: notificationsQuery.isLoading || store.isLoadingNotifications,
    isError: notificationsQuery.isError,
    error: notificationsQuery.error,
    
    // Preferences
    preferences: store.preferences,
    updatePreferences: store.updatePreferences,
    toggleCategoryEnabled: store.toggleCategoryEnabled,
    
    // Toast shortcuts
    toast,
    
    // Actions
    markAsRead: markAsReadMutation.mutate,
    markAllAsRead: markAllAsReadMutation.mutate,
    deleteNotification: deleteNotificationMutation.mutate,
    clearAll: store.clearNotifications,
    
    // Filtering
    filterNotifications,
    
    // Subscriptions
    subscribeToCategory,
    
    // Push notifications
    pushPermission: store.pushPermission,
    requestPushPermission: store.requestPushPermission,
    
    // Refetch
    refetch: notificationsQuery.refetch,
  };
}

// ============================================================================
// Convenience Hooks
// ============================================================================

/**
 * Simple toast-only hook for components that just need to show toasts
 */
export function useToast() {
  const store = useNotificationStore();
  const toasts = useNotificationStore(selectVisibleToasts);
  
  return {
    toasts,
    success: store.success,
    error: store.error,
    warning: store.warning,
    info: store.info,
    dismiss: store.removeToast,
    dismissAll: store.clearToasts,
    updateProgress: store.updateToastProgress,
  };
}

/**
 * Hook for notification preferences management
 */
export function useNotificationPreferences() {
  const preferences = useNotificationStore((state) => state.preferences);
  const updatePreferences = useNotificationStore((state) => state.updatePreferences);
  const toggleCategoryEnabled = useNotificationStore((state) => state.toggleCategoryEnabled);
  const requestPushPermission = useNotificationStore((state) => state.requestPushPermission);
  const pushPermission = useNotificationStore((state) => state.pushPermission);
  
  return {
    preferences,
    updatePreferences,
    toggleCategoryEnabled,
    requestPushPermission,
    pushPermission,
  };
}

/**
 * Hook for unread notification count (useful for badges)
 */
export function useUnreadCount() {
  return useNotificationStore((state) => state.unreadCount);
}

/**
 * Hook to subscribe to specific notification categories
 */
export function useCategoryNotifications(category: NotificationCategory) {
  const notifications = useNotificationStore(
    (state) => state.notifications.filter(n => n.category === category)
  );
  
  return {
    notifications,
    unreadCount: notifications.filter(n => !n.read).length,
  };
}
