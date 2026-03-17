import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Network status info
 */
export interface NetworkStatus {
  /** Whether browser reports online status */
  isOnline: boolean;
  /** Whether we can actually reach the server */
  isServerReachable: boolean;
  /** Whether we recently came back online */
  wasOffline: boolean;
  /** When we last confirmed connectivity */
  lastCheckedAt: Date | null;
  /** Connection quality (if available) */
  connectionType: ConnectionType | null;
  /** Effective bandwidth estimate in Mbps */
  effectiveBandwidth: number | null;
  /** Whether to save data (user preference) */
  saveData: boolean;
}

/**
 * Connection types from Network Information API
 */
export type ConnectionType =
  | 'slow-2g'
  | '2g'
  | '3g'
  | '4g'
  | 'wifi'
  | 'ethernet'
  | 'unknown';

/**
 * Options for useNetworkStatus hook
 */
export interface UseNetworkStatusOptions {
  /** URL to ping for server reachability (defaults to /api/health) */
  pingUrl?: string;
  /** How often to check server reachability in ms */
  pingInterval?: number;
  /** Enable periodic ping checks */
  enablePing?: boolean;
  /** Callback when going offline */
  onOffline?: () => void;
  /** Callback when coming back online */
  onOnline?: () => void;
  /** Callback when server becomes unreachable */
  onServerUnreachable?: () => void;
  /** Callback when server becomes reachable again */
  onServerReachable?: () => void;
}

// Extend Navigator for Network Information API
interface NetworkInformation {
  effectiveType?: '2g' | '3g' | '4g' | 'slow-2g';
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
  type?: 'bluetooth' | 'cellular' | 'ethernet' | 'wifi' | 'wimax' | 'none' | 'other' | 'unknown';
  addEventListener: (type: string, listener: EventListener) => void;
  removeEventListener: (type: string, listener: EventListener) => void;
}

interface NavigatorWithConnection extends Navigator {
  connection?: NetworkInformation;
  mozConnection?: NetworkInformation;
  webkitConnection?: NetworkInformation;
}

/**
 * Get Network Information API connection
 */
function getConnection(): NetworkInformation | undefined {
  const nav = navigator as NavigatorWithConnection;
  return nav.connection || nav.mozConnection || nav.webkitConnection;
}

/**
 * useNetworkStatus - Comprehensive network status detection
 *
 * Provides detailed information about network connectivity including:
 * - Browser online/offline status
 * - Server reachability via ping
 * - Connection type and quality (when available)
 * - Automatic reconnection handling
 *
 * @example
 * ```tsx
 * function App() {
 *   const { isOnline, isServerReachable, wasOffline } = useNetworkStatus({
 *     enablePing: true,
 *     onOnline: () => toast.success('Back online!'),
 *     onOffline: () => toast.warning('You are offline'),
 *   });
 *
 *   if (!isOnline) return <OfflineBanner />;
 *   if (!isServerReachable) return <ServerDownBanner />;
 *
 *   return <App />;
 * }
 * ```
 */
export function useNetworkStatus(options: UseNetworkStatusOptions = {}): NetworkStatus {
  const {
    pingUrl = '/api/health',
    pingInterval = 30000,
    enablePing = false,
    onOffline,
    onOnline,
    onServerUnreachable,
    onServerReachable,
  } = options;

  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isServerReachable: true,
    wasOffline: false,
    lastCheckedAt: null,
    connectionType: null,
    effectiveBandwidth: null,
    saveData: false,
  });

  const wasOnlineRef = useRef(status.isOnline);
  const wasServerReachableRef = useRef(status.isServerReachable);

  // Ping server to check reachability
  const pingServer = useCallback(async (): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(pingUrl, {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }, [pingUrl]);

  // Update connection info from Network Information API
  const updateConnectionInfo = useCallback(() => {
    const connection = getConnection();
    if (!connection) return;

    let connectionType: ConnectionType = 'unknown';
    if (connection.type === 'wifi') connectionType = 'wifi';
    else if (connection.type === 'ethernet') connectionType = 'ethernet';
    else if (connection.effectiveType) connectionType = connection.effectiveType;

    setStatus((prev) => ({
      ...prev,
      connectionType,
      effectiveBandwidth: connection.downlink ?? null,
      saveData: connection.saveData ?? false,
    }));
  }, []);

  // Handle online event
  const handleOnline = useCallback(async () => {
    setStatus((prev) => ({
      ...prev,
      isOnline: true,
      wasOffline: !wasOnlineRef.current,
    }));

    if (!wasOnlineRef.current) {
      onOnline?.();

      // Check server reachability after coming online
      if (enablePing) {
        const reachable = await pingServer();
        setStatus((prev) => ({
          ...prev,
          isServerReachable: reachable,
          lastCheckedAt: new Date(),
        }));

        if (reachable && !wasServerReachableRef.current) {
          onServerReachable?.();
        }

        wasServerReachableRef.current = reachable;
      }
    }

    wasOnlineRef.current = true;
  }, [enablePing, onOnline, onServerReachable, pingServer]);

  // Handle offline event
  const handleOffline = useCallback(() => {
    wasOnlineRef.current = false;
    setStatus((prev) => ({
      ...prev,
      isOnline: false,
      isServerReachable: false,
    }));
    onOffline?.();
  }, [onOffline]);

  // Set up event listeners
  useEffect(() => {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen for connection changes
    const connection = getConnection();
    if (connection) {
      updateConnectionInfo();
      connection.addEventListener('change', updateConnectionInfo);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);

      if (connection) {
        connection.removeEventListener('change', updateConnectionInfo);
      }
    };
  }, [handleOnline, handleOffline, updateConnectionInfo]);

  // Periodic server ping
  useEffect(() => {
    if (!enablePing || !status.isOnline) return;

    const checkServer = async () => {
      const reachable = await pingServer();

      setStatus((prev) => ({
        ...prev,
        isServerReachable: reachable,
        lastCheckedAt: new Date(),
      }));

      // Fire callbacks on status change
      if (reachable !== wasServerReachableRef.current) {
        if (reachable) {
          onServerReachable?.();
        } else {
          onServerUnreachable?.();
        }
        wasServerReachableRef.current = reachable;
      }
    };

    // Initial check
    checkServer();

    // Set up interval
    const intervalId = setInterval(checkServer, pingInterval);

    return () => clearInterval(intervalId);
  }, [enablePing, status.isOnline, pingInterval, pingServer, onServerReachable, onServerUnreachable]);

  return status;
}

/**
 * Hook to automatically refetch queries when coming back online
 */
export function useRefetchOnReconnect() {
  const queryClient = useQueryClient();

  useNetworkStatus({
    onOnline: () => {
      // Invalidate all queries to trigger refetch
      queryClient.invalidateQueries();
    },
  });
}

/**
 * Hook for detecting slow network conditions
 */
export function useSlowNetwork() {
  const { connectionType, effectiveBandwidth } = useNetworkStatus();

  const isSlow =
    connectionType === 'slow-2g' ||
    connectionType === '2g' ||
    (effectiveBandwidth !== null && effectiveBandwidth < 1);

  const isModerate =
    connectionType === '3g' ||
    (effectiveBandwidth !== null && effectiveBandwidth < 5);

  return { isSlow, isModerate, connectionType, effectiveBandwidth };
}

/**
 * Hook for graceful degradation based on network quality
 */
export interface AdaptiveOptions<T> {
  /** Default value for good connections */
  default: T;
  /** Value for slow connections */
  slow?: T;
  /** Value for moderate connections */
  moderate?: T;
  /** Value when offline */
  offline?: T;
}

export function useAdaptiveValue<T>(options: AdaptiveOptions<T>): T {
  const { isOnline } = useNetworkStatus();
  const { isSlow, isModerate } = useSlowNetwork();

  if (!isOnline && options.offline !== undefined) {
    return options.offline;
  }

  if (isSlow && options.slow !== undefined) {
    return options.slow;
  }

  if (isModerate && options.moderate !== undefined) {
    return options.moderate;
  }

  return options.default;
}

/**
 * Hook for queueing actions when offline
 */
export interface QueuedAction {
  id: string;
  action: () => Promise<void>;
  createdAt: Date;
  description: string;
}

export function useOfflineQueue() {
  const [queue, setQueue] = useState<QueuedAction[]>([]);
  const { isOnline } = useNetworkStatus();
  const processingRef = useRef(false);

  // Add action to queue
  const enqueue = useCallback((action: () => Promise<void>, description: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setQueue((prev) => [
      ...prev,
      { id, action, createdAt: new Date(), description },
    ]);
    return id;
  }, []);

  // Remove action from queue
  const dequeue = useCallback((id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // Process queue when online
  useEffect(() => {
    if (!isOnline || queue.length === 0 || processingRef.current) return;

    const processQueue = async () => {
      processingRef.current = true;

      for (const item of [...queue]) {
        try {
          await item.action();
          setQueue((prev) => prev.filter((q) => q.id !== item.id));
        } catch {
          // Leave failed items in queue for retry
          break;
        }
      }

      processingRef.current = false;
    };

    processQueue();
  }, [isOnline, queue]);

  return {
    queue,
    enqueue,
    dequeue,
    queueLength: queue.length,
    hasQueuedActions: queue.length > 0,
  };
}
