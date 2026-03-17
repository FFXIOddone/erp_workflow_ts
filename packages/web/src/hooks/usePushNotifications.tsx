/**
 * Push Notification Service
 * 
 * Browser push notification support with:
 * - Permission management
 * - Service worker registration
 * - Push subscription management
 * - Notification click handling
 * - Fallback to in-app notifications when push is unavailable
 */

import { useCallback, useEffect, useState } from 'react';
import { useNotificationStore, NotificationType } from '../stores/notifications';

// ============================================================================
// Types
// ============================================================================

interface PushNotificationPayload {
  title: string;
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: {
    url?: string;
    type?: NotificationType;
    category?: string;
    entityType?: string;
    entityId?: string;
  };
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  requireInteraction?: boolean;
  silent?: boolean;
  vibrate?: number[];
  timestamp?: number;
}

interface PushSubscriptionJSON {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

// ============================================================================
// Constants
// ============================================================================

const PUSH_PUBLIC_KEY = import.meta.env.VITE_PUSH_PUBLIC_KEY || '';
const SW_PATH = '/sw.js';
const DEFAULT_ICON = '/icons/icon-192x192.png';
const DEFAULT_BADGE = '/icons/badge-72x72.png';

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert URL-safe base64 to Uint8Array for push subscription
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  
  return outputArray;
}

/**
 * Check if push notifications are supported
 */
export function isPushSupported(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Check if notification permission is granted
 */
export function isPushPermissionGranted(): boolean {
  return 'Notification' in window && Notification.permission === 'granted';
}

/**
 * Get current notification permission status
 */
export function getPushPermission(): NotificationPermission | null {
  if (!('Notification' in window)) return null;
  return Notification.permission;
}

// ============================================================================
// Service Worker Registration
// ============================================================================

let swRegistration: ServiceWorkerRegistration | null = null;

/**
 * Register or get existing service worker
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) {
    console.warn('Push notifications are not supported in this browser');
    return null;
  }
  
  try {
    // Check if already registered
    if (swRegistration) {
      return swRegistration;
    }
    
    // Get existing registration or register new
    const existingRegistration = await navigator.serviceWorker.getRegistration(SW_PATH);
    
    if (existingRegistration) {
      swRegistration = existingRegistration;
    } else {
      swRegistration = await navigator.serviceWorker.register(SW_PATH, {
        scope: '/',
      });
    }
    
    // Wait for the service worker to be ready
    await navigator.serviceWorker.ready;
    
    return swRegistration;
  } catch (error) {
    console.error('Service worker registration failed:', error);
    return null;
  }
}

// ============================================================================
// Push Subscription Management
// ============================================================================

/**
 * Subscribe to push notifications
 */
export async function subscribeToPush(): Promise<PushSubscription | null> {
  const registration = await registerServiceWorker();
  
  if (!registration) {
    return null;
  }
  
  try {
    // Check existing subscription
    let subscription = await registration.pushManager.getSubscription();
    
    if (!subscription && PUSH_PUBLIC_KEY) {
      // Create new subscription
      const applicationServerKey = urlBase64ToUint8Array(PUSH_PUBLIC_KEY);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      });
      
      // Send subscription to backend
      await sendSubscriptionToServer(subscription);
    }
    
    return subscription;
  } catch (error) {
    console.error('Failed to subscribe to push:', error);
    return null;
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  const registration = await navigator.serviceWorker.getRegistration(SW_PATH);
  
  if (!registration) {
    return false;
  }
  
  try {
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      // Notify backend before unsubscribing
      await removeSubscriptionFromServer(subscription);
      await subscription.unsubscribe();
    }
    
    return true;
  } catch (error) {
    console.error('Failed to unsubscribe from push:', error);
    return false;
  }
}

/**
 * Get current push subscription
 */
export async function getPushSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration(SW_PATH);
  
  if (!registration) {
    return null;
  }
  
  return registration.pushManager.getSubscription();
}

// ============================================================================
// Server Communication
// ============================================================================

/**
 * Send push subscription to backend
 */
async function sendSubscriptionToServer(subscription: PushSubscription): Promise<void> {
  try {
    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify(subscription.toJSON()),
    });
    
    if (!response.ok) {
      throw new Error('Failed to save subscription on server');
    }
  } catch (error) {
    console.error('Failed to send subscription to server:', error);
    throw error;
  }
}

/**
 * Remove push subscription from backend
 */
async function removeSubscriptionFromServer(subscription: PushSubscription): Promise<void> {
  try {
    await fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
  } catch (error) {
    console.error('Failed to remove subscription from server:', error);
  }
}

// ============================================================================
// Local Notification Display
// ============================================================================

/**
 * Show a local notification (when app is in foreground)
 */
export async function showLocalNotification(payload: PushNotificationPayload): Promise<Notification | null> {
  if (!isPushPermissionGranted()) {
    // Fall back to in-app toast
    useNotificationStore.getState().addToast({
      type: payload.data?.type || 'info',
      title: payload.title,
      message: payload.body,
      priority: 'normal',
    });
    return null;
  }
  
  try {
    const notification = new Notification(payload.title, {
      body: payload.body,
      icon: payload.icon || DEFAULT_ICON,
      badge: payload.badge || DEFAULT_BADGE,
      tag: payload.tag,
      data: payload.data,
      requireInteraction: payload.requireInteraction,
      silent: payload.silent,
      timestamp: payload.timestamp || Date.now(),
    } as NotificationOptions);
    
    // Handle notification click
    notification.onclick = () => {
      window.focus();
      if (payload.data?.url) {
        window.location.href = payload.data.url;
      }
      notification.close();
    };
    
    return notification;
  } catch (error) {
    console.error('Failed to show notification:', error);
    return null;
  }
}

/**
 * Show notification via service worker (works when app is in background)
 */
export async function showServiceWorkerNotification(payload: PushNotificationPayload): Promise<void> {
  const registration = await registerServiceWorker();
  
  if (!registration) {
    // Fall back to local notification
    await showLocalNotification(payload);
    return;
  }
  
  await registration.showNotification(payload.title, {
    body: payload.body,
    icon: payload.icon || DEFAULT_ICON,
    badge: payload.badge || DEFAULT_BADGE,
    tag: payload.tag,
    data: payload.data,
    requireInteraction: payload.requireInteraction,
    silent: payload.silent,
    timestamp: payload.timestamp || Date.now(),
    // actions and vibrate are Web Push API specific, included via type assertion
    ...(payload.actions ? { actions: payload.actions } : {}),
    ...(payload.vibrate ? { vibrate: payload.vibrate } : {}),
  } as NotificationOptions);
}

// ============================================================================
// React Hook for Push Notifications
// ============================================================================

interface UsePushNotificationsReturn {
  isSupported: boolean;
  permission: NotificationPermission | null;
  isSubscribed: boolean;
  isLoading: boolean;
  error: Error | null;
  requestPermission: () => Promise<boolean>;
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
  showNotification: (payload: PushNotificationPayload) => Promise<void>;
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const [permission, setPermission] = useState<NotificationPermission | null>(getPushPermission());
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const store = useNotificationStore();
  const isSupported = isPushSupported();
  
  // Check initial subscription status
  useEffect(() => {
    if (!isSupported) return;
    
    async function checkSubscription() {
      const subscription = await getPushSubscription();
      setIsSubscribed(!!subscription);
      store.setPushSubscription(subscription);
    }
    
    checkSubscription();
  }, [isSupported, store]);
  
  // Request notification permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      setError(new Error('Notifications not supported'));
      return false;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result === 'granted') {
        store.updatePreferences({ browserPushEnabled: true });
        return true;
      }
      
      return false;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Permission request failed'));
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [store]);
  
  // Subscribe to push notifications
  const subscribe = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Ensure permission is granted
      if (permission !== 'granted') {
        const granted = await requestPermission();
        if (!granted) {
          return false;
        }
      }
      
      const subscription = await subscribeToPush();
      
      if (subscription) {
        setIsSubscribed(true);
        store.setPushSubscription(subscription);
        store.updatePreferences({ browserPushEnabled: true });
        
        store.success('Push notifications enabled', 'You will receive notifications even when the app is closed.');
        return true;
      }
      
      return false;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Subscription failed');
      setError(error);
      store.error('Failed to enable push notifications', error.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [permission, requestPermission, store]);
  
  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const success = await unsubscribeFromPush();
      
      if (success) {
        setIsSubscribed(false);
        store.setPushSubscription(null);
        store.updatePreferences({ browserPushEnabled: false });
        store.info('Push notifications disabled');
      }
      
      return success;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unsubscribe failed');
      setError(error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [store]);
  
  // Show notification helper
  const showNotification = useCallback(async (payload: PushNotificationPayload): Promise<void> => {
    if (document.hidden) {
      // App is in background, use service worker
      await showServiceWorkerNotification(payload);
    } else {
      // App is in foreground, use local notification or toast
      await showLocalNotification(payload);
    }
  }, []);
  
  return {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    error,
    requestPermission,
    subscribe,
    unsubscribe,
    showNotification,
  };
}

// ============================================================================
// Push Notification Toggle Component
// ============================================================================

interface PushNotificationToggleProps {
  className?: string;
  showLabel?: boolean;
}

export function PushNotificationToggle({ 
  className,
  showLabel = true,
}: PushNotificationToggleProps) {
  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
  } = usePushNotifications();
  
  if (!isSupported) {
    return null;
  }
  
  const handleToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };
  
  return (
    <div className={className}>
      <label className="flex items-center gap-3 cursor-pointer">
        <div className="relative">
          <input
            type="checkbox"
            checked={isSubscribed}
            onChange={handleToggle}
            disabled={isLoading || permission === 'denied'}
            className="sr-only peer"
          />
          <div className={`
            w-11 h-6 rounded-full
            bg-gray-200 dark:bg-gray-700
            peer-checked:bg-blue-600
            peer-disabled:opacity-50 peer-disabled:cursor-not-allowed
            peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 peer-focus-visible:ring-offset-2
            transition-colors
          `} />
          <div className={`
            absolute left-1 top-1 w-4 h-4 rounded-full
            bg-white shadow-sm
            peer-checked:translate-x-5
            transition-transform
          `} />
        </div>
        {showLabel && (
          <div>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              Push Notifications
            </span>
            {permission === 'denied' && (
              <p className="text-xs text-red-500">
                Notifications are blocked. Please enable in browser settings.
              </p>
            )}
          </div>
        )}
      </label>
    </div>
  );
}

export default usePushNotifications;
