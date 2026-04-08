/**
 * Unified Notification System - State Management
 * 
 * Centralized store for all notification types:
 * - Toast notifications (transient)
 * - In-app notifications (persistent, from API)
 * - Browser push notifications
 * 
 * Features:
 * - Notification queue with priorities
 * - Persistence for important notifications
 * - Action handlers for interactive notifications
 * - Sound/vibration options
 * - Notification grouping
 */

import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// ============================================================================
// Types
// ============================================================================

export type NotificationType = 'info' | 'success' | 'warning' | 'error';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';
export type NotificationCategory = 
  | 'order' 
  | 'production' 
  | 'inventory' 
  | 'customer' 
  | 'system' 
  | 'message'
  | 'alert';

export interface NotificationAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  closeOnClick?: boolean;
}

export interface NotificationProgress {
  current: number;
  total: number;
  label?: string;
}

export interface ToastNotification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number; // ms, 0 = permanent
  priority: NotificationPriority;
  actions?: NotificationAction[];
  progress?: NotificationProgress;
  dismissible?: boolean;
  icon?: React.ReactNode;
  timestamp: number;
  sound?: boolean;
  vibrate?: boolean;
  groupId?: string; // For grouping similar notifications
}

export interface InAppNotification {
  id: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  link?: string;
  linkLabel?: string;
  entityType?: string;
  entityId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationPreferences {
  soundEnabled: boolean;
  vibrateEnabled: boolean;
  browserPushEnabled: boolean;
  showToasts: boolean;
  groupSimilar: boolean;
  defaultDuration: number;
  maxVisibleToasts: number;
  categories: Record<NotificationCategory, {
    enabled: boolean;
    sound: boolean;
    push: boolean;
  }>;
}

interface NotificationState {
  // Toast notifications (transient UI)
  toasts: ToastNotification[];
  
  // In-app notifications (persistent, from API)
  notifications: InAppNotification[];
  unreadCount: number;
  
  // Loading states
  isLoadingNotifications: boolean;
  
  // Preferences
  preferences: NotificationPreferences;
  
  // Push notification state
  pushPermission: NotificationPermission | null;
  pushSubscription: PushSubscription | null;
}

interface NotificationActions {
  // Toast actions
  addToast: (toast: Omit<ToastNotification, 'id' | 'timestamp'>) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
  updateToastProgress: (id: string, progress: NotificationProgress) => void;
  
  // Shorthand toast methods
  success: (title: string, message?: string, options?: Partial<ToastNotification>) => string;
  error: (title: string, message?: string, options?: Partial<ToastNotification>) => string;
  warning: (title: string, message?: string, options?: Partial<ToastNotification>) => string;
  info: (title: string, message?: string, options?: Partial<ToastNotification>) => string;
  
  // In-app notification actions
  setNotifications: (notifications: InAppNotification[]) => void;
  addNotification: (notification: Omit<InAppNotification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  
  // Preferences
  updatePreferences: (prefs: Partial<NotificationPreferences>) => void;
  toggleCategoryEnabled: (category: NotificationCategory, enabled: boolean) => void;
  
  // Push notifications
  requestPushPermission: () => Promise<boolean>;
  setPushSubscription: (subscription: PushSubscription | null) => void;
  
  // Utility
  setLoading: (loading: boolean) => void;
}

// ============================================================================
// Default Preferences
// ============================================================================

const defaultPreferences: NotificationPreferences = {
  soundEnabled: true,
  vibrateEnabled: true,
  browserPushEnabled: false,
  showToasts: true,
  groupSimilar: true,
  defaultDuration: 5000,
  maxVisibleToasts: 5,
  categories: {
    order: { enabled: true, sound: true, push: true },
    production: { enabled: true, sound: true, push: true },
    inventory: { enabled: true, sound: false, push: false },
    customer: { enabled: true, sound: true, push: true },
    system: { enabled: true, sound: false, push: true },
    message: { enabled: true, sound: true, push: true },
    alert: { enabled: true, sound: true, push: true },
  },
};

// ============================================================================
// ID Generation
// ============================================================================

let notificationIdCounter = 0;
const generateId = () => `notification-${Date.now()}-${++notificationIdCounter}`;

// ============================================================================
// Sound Effects
// ============================================================================

const playNotificationSound = (type: NotificationType) => {
  // Use Web Audio API for notification sounds
  try {
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Different frequencies for different notification types
    const frequencies: Record<NotificationType, number> = {
      success: 880,
      error: 220,
      warning: 440,
      info: 660,
    };
    
    oscillator.frequency.value = frequencies[type];
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch {
    // Audio not supported
  }
};

const triggerVibration = (type: NotificationType) => {
  if ('vibrate' in navigator) {
    const patterns: Record<NotificationType, number[]> = {
      success: [100],
      error: [100, 50, 100],
      warning: [200],
      info: [50],
    };
    navigator.vibrate(patterns[type]);
  }
};

// ============================================================================
// Store
// ============================================================================

export const useNotificationStore = create<NotificationState & NotificationActions>()(
  subscribeWithSelector(
    persist(
      immer((set, get) => ({
        // Initial state
        toasts: [],
        notifications: [],
        unreadCount: 0,
        isLoadingNotifications: false,
        preferences: defaultPreferences,
        pushPermission: typeof Notification !== 'undefined' ? Notification.permission : null,
        pushSubscription: null,
        
        // Toast actions
        addToast: (toast) => {
          const id = generateId();
          const newToast: ToastNotification = {
            ...toast,
            id,
            timestamp: Date.now(),
            dismissible: toast.dismissible ?? true,
            duration: toast.duration ?? get().preferences.defaultDuration,
          };
          
          set((state) => {
            // Check for grouping
            if (state.preferences.groupSimilar && toast.groupId) {
              const existingIndex = state.toasts.findIndex((t: ToastNotification) => t.groupId === toast.groupId);
              if (existingIndex !== -1) {
                // Update existing grouped toast
                state.toasts[existingIndex] = {
                  ...state.toasts[existingIndex],
                  ...newToast,
                  timestamp: Date.now(),
                };
                return;
              }
            }
            
            // Add new toast, respecting max visible
            state.toasts.unshift(newToast);
            if (state.toasts.length > state.preferences.maxVisibleToasts * 2) {
              state.toasts = state.toasts.slice(0, state.preferences.maxVisibleToasts * 2);
            }
          });
          
          // Play sound if enabled
          if ((toast.sound ?? get().preferences.soundEnabled)) {
            playNotificationSound(toast.type);
          }
          
          // Trigger vibration if enabled
          if ((toast.vibrate ?? get().preferences.vibrateEnabled)) {
            triggerVibration(toast.type);
          }
          
          // Auto-dismiss after duration
          if (newToast.duration && newToast.duration > 0) {
            setTimeout(() => {
              get().removeToast(id);
            }, newToast.duration);
          }
          
          return id;
        },
        
        removeToast: (id) => {
          set((state) => {
            state.toasts = state.toasts.filter((t: ToastNotification) => t.id !== id);
          });
        },
        
        clearToasts: () => {
          set((state) => {
            state.toasts = [];
          });
        },
        
        updateToastProgress: (id, progress) => {
          set((state) => {
            const toast = state.toasts.find((t: ToastNotification) => t.id === id);
            if (toast) {
              toast.progress = progress;
            }
          });
        },
        
        // Shorthand toast methods
        success: (title, message, options) => {
          return get().addToast({ type: 'success', title, message, priority: 'normal', ...options });
        },
        
        error: (title, message, options) => {
          return get().addToast({ 
            type: 'error', 
            title, 
            message, 
            priority: 'high',
            duration: 8000, // Errors stay longer
            ...options 
          });
        },
        
        warning: (title, message, options) => {
          return get().addToast({ type: 'warning', title, message, priority: 'normal', ...options });
        },
        
        info: (title, message, options) => {
          return get().addToast({ type: 'info', title, message, priority: 'low', ...options });
        },
        
        // In-app notification actions
        setNotifications: (notifications) => {
          set((state) => {
            state.notifications = notifications;
            state.unreadCount = notifications.filter(n => !n.read).length;
          });
        },
        
        addNotification: (notification) => {
          const newNotification: InAppNotification = {
            ...notification,
            id: generateId(),
            timestamp: Date.now(),
            read: false,
          };
          
          set((state) => {
            state.notifications.unshift(newNotification);
            state.unreadCount += 1;
          });
          
          // Show toast for new notifications
          const prefs = get().preferences;
          const categoryPrefs = prefs.categories[notification.category];
          
          if (categoryPrefs?.enabled && prefs.showToasts) {
            get().addToast({
              type: notification.type,
              title: notification.title,
              message: notification.message,
              priority: 'normal',
              sound: categoryPrefs.sound,
              actions: notification.link ? [
                {
                  label: notification.linkLabel || 'View',
                  onClick: () => {
                    window.location.href = notification.link!;
                  },
                  closeOnClick: true,
                },
              ] : undefined,
            });
          }
          
          // Show browser push notification
          if (categoryPrefs?.push && prefs.browserPushEnabled && get().pushPermission === 'granted') {
            new Notification(notification.title, {
              body: notification.message,
              icon: '/icons/icon-192x192.svg',
              tag: newNotification.id,
            });
          }
        },
        
        markAsRead: (id) => {
          set((state) => {
            const notification = state.notifications.find((n: InAppNotification) => n.id === id);
            if (notification && !notification.read) {
              notification.read = true;
              state.unreadCount = Math.max(0, state.unreadCount - 1);
            }
          });
        },
        
        markAllAsRead: () => {
          set((state) => {
            state.notifications.forEach((n: InAppNotification) => {
              n.read = true;
            });
            state.unreadCount = 0;
          });
        },
        
        removeNotification: (id) => {
          set((state) => {
            const notification = state.notifications.find((n: InAppNotification) => n.id === id);
            if (notification && !notification.read) {
              state.unreadCount = Math.max(0, state.unreadCount - 1);
            }
            state.notifications = state.notifications.filter((n: InAppNotification) => n.id !== id);
          });
        },
        
        clearNotifications: () => {
          set((state) => {
            state.notifications = [];
            state.unreadCount = 0;
          });
        },
        
        // Preferences
        updatePreferences: (prefs) => {
          set((state) => {
            state.preferences = { ...state.preferences, ...prefs };
          });
        },
        
        toggleCategoryEnabled: (category, enabled) => {
          set((state) => {
            state.preferences.categories[category].enabled = enabled;
          });
        },
        
        // Push notifications
        requestPushPermission: async () => {
          if (typeof Notification === 'undefined') {
            return false;
          }
          
          const permission = await Notification.requestPermission();
          set((state) => {
            state.pushPermission = permission;
            if (permission === 'granted') {
              state.preferences.browserPushEnabled = true;
            }
          });
          
          return permission === 'granted';
        },
        
        setPushSubscription: (subscription) => {
          set((state) => {
            state.pushSubscription = subscription;
          });
        },
        
        // Utility
        setLoading: (loading) => {
          set((state) => {
            state.isLoadingNotifications = loading;
          });
        },
      })),
      {
        name: 'erp-notifications',
        partialize: (state) => ({
          preferences: state.preferences,
          notifications: state.notifications.slice(0, 100), // Keep last 100
        }),
      }
    )
  )
);

// ============================================================================
// Selectors
// ============================================================================

export const selectVisibleToasts = (state: NotificationState) => 
  state.toasts.slice(0, state.preferences.maxVisibleToasts);

export const selectUnreadNotifications = (state: NotificationState) =>
  state.notifications.filter(n => !n.read);

export const selectNotificationsByCategory = (category: NotificationCategory) => (state: NotificationState) =>
  state.notifications.filter(n => n.category === category);

export const selectRecentNotifications = (limit = 10) => (state: NotificationState) =>
  state.notifications.slice(0, limit);
