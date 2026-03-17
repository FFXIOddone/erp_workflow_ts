/**
 * Polling.tsx - CRITICAL-23
 * 
 * Real-time polling and WebSocket utilities for the ERP application.
 * Provides polling hooks with backoff, visibility-aware polling,
 * WebSocket connection management, and event-based updates.
 * 
 * Features:
 * - 23.1: usePolling with interval and backoff
 * - 23.2: Visibility-aware polling (pause when hidden)
 * - 23.3: WebSocket connection hook
 * - 23.4: Subscription-based updates
 * - 23.5: Reconnection with exponential backoff
 * 
 * @module Polling
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/** Polling status */
export type PollingStatus = 'idle' | 'polling' | 'paused' | 'error' | 'stopped';

/** Polling options */
export interface PollingOptions<T> {
  /** Polling interval in ms */
  interval: number;
  /** Function to fetch data */
  fetcher: () => Promise<T>;
  /** Initial data */
  initialData?: T;
  /** Enable/disable polling */
  enabled?: boolean;
  /** Pause when document is hidden */
  pauseOnHidden?: boolean;
  /** Pause when offline */
  pauseOnOffline?: boolean;
  /** Retry on error */
  retryOnError?: boolean;
  /** Maximum retries before stopping */
  maxRetries?: number;
  /** Backoff multiplier on error */
  backoffMultiplier?: number;
  /** Maximum backoff interval */
  maxBackoffInterval?: number;
  /** Callback on success */
  onSuccess?: (data: T) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
  /** Compare function to detect changes */
  hasChanged?: (prev: T | undefined, next: T) => boolean;
  /** Callback when data changes */
  onChange?: (data: T, prevData: T | undefined) => void;
}

/** Polling result */
export interface PollingResult<T> {
  /** Current data */
  data: T | undefined;
  /** Polling status */
  status: PollingStatus;
  /** Last error */
  error: Error | null;
  /** Start polling */
  start: () => void;
  /** Stop polling */
  stop: () => void;
  /** Pause polling */
  pause: () => void;
  /** Resume polling */
  resume: () => void;
  /** Force immediate refresh */
  refresh: () => Promise<void>;
  /** Is currently polling */
  isPolling: boolean;
  /** Number of consecutive errors */
  errorCount: number;
  /** Last successful poll time */
  lastPollTime: number | null;
}

/** WebSocket status */
export type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error';

/** WebSocket message */
export interface WebSocketMessage<T = unknown> {
  /** Message type */
  type: string;
  /** Message payload */
  payload: T;
  /** Timestamp */
  timestamp?: number;
}

/** WebSocket options */
export interface WebSocketOptions {
  /** WebSocket URL */
  url: string;
  /** Protocols */
  protocols?: string | string[];
  /** Auto connect on mount */
  autoConnect?: boolean;
  /** Auto reconnect on disconnect */
  autoReconnect?: boolean;
  /** Reconnect attempts */
  reconnectAttempts?: number;
  /** Reconnect interval (or function for backoff) */
  reconnectInterval?: number | ((attempt: number) => number);
  /** Heartbeat interval (0 to disable) */
  heartbeatInterval?: number;
  /** Heartbeat message */
  heartbeatMessage?: string | object;
  /** On open callback */
  onOpen?: (event: Event) => void;
  /** On close callback */
  onClose?: (event: CloseEvent) => void;
  /** On error callback */
  onError?: (event: Event) => void;
  /** On message callback */
  onMessage?: (message: WebSocketMessage) => void;
}

/** WebSocket result */
export interface WebSocketResult {
  /** Connection status */
  status: WebSocketStatus;
  /** Send message */
  send: (message: string | object) => void;
  /** Connect */
  connect: () => void;
  /** Disconnect */
  disconnect: () => void;
  /** Last message received */
  lastMessage: WebSocketMessage | null;
  /** Subscribe to message type */
  subscribe: <T>(type: string, handler: (payload: T) => void) => () => void;
  /** Reconnect attempt count */
  reconnectCount: number;
}

/** Subscription handler */
export type SubscriptionHandler<T = unknown> = (data: T) => void;

// ============================================================================
// 23.1: POLLING HOOK
// ============================================================================

/**
 * Hook for polling data at intervals
 * 
 * @example
 * ```tsx
 * const { data, status, refresh } = usePolling({
 *   interval: 5000,
 *   fetcher: () => api.getOrders(),
 *   pauseOnHidden: true,
 * });
 * ```
 */
export function usePolling<T>(options: PollingOptions<T>): PollingResult<T> {
  const {
    interval,
    fetcher,
    initialData,
    enabled = true,
    pauseOnHidden = true,
    pauseOnOffline = true,
    retryOnError = true,
    maxRetries = 5,
    backoffMultiplier = 2,
    maxBackoffInterval = 60000,
    onSuccess,
    onError,
    hasChanged,
    onChange,
  } = options;

  const [data, setData] = useState<T | undefined>(initialData);
  const [status, setStatus] = useState<PollingStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [errorCount, setErrorCount] = useState(0);
  const [lastPollTime, setLastPollTime] = useState<number | null>(null);

  const fetcherRef = useRef(fetcher);
  const intervalRef = useRef<NodeJS.Timeout>();
  const isManuallyPausedRef = useRef(false);
  const prevDataRef = useRef<T | undefined>(initialData);

  // Update fetcher ref
  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  // Poll function
  const poll = useCallback(async () => {
    if (status === 'stopped') return;

    try {
      setStatus('polling');
      const result = await fetcherRef.current();

      setData(result);
      setError(null);
      setErrorCount(0);
      setLastPollTime(Date.now());
      setStatus('idle');

      onSuccess?.(result);

      // Check for changes
      if (hasChanged && onChange) {
        if (hasChanged(prevDataRef.current, result)) {
          onChange(result, prevDataRef.current);
        }
      }
      prevDataRef.current = result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setErrorCount((c) => c + 1);
      setStatus('error');
      onError?.(error);

      // Stop if max retries reached
      if (!retryOnError || errorCount + 1 >= maxRetries) {
        setStatus('stopped');
      }
    }
  }, [status, onSuccess, onError, hasChanged, onChange, retryOnError, maxRetries, errorCount]);

  // Calculate current interval with backoff
  const getCurrentInterval = useCallback(() => {
    if (errorCount === 0) return interval;

    const backoffInterval = interval * Math.pow(backoffMultiplier, errorCount);
    return Math.min(backoffInterval, maxBackoffInterval);
  }, [interval, errorCount, backoffMultiplier, maxBackoffInterval]);

  // Start polling
  const start = useCallback(() => {
    isManuallyPausedRef.current = false;
    setStatus('idle');
    setErrorCount(0);

    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Initial poll
    poll();

    // Set up interval
    intervalRef.current = setInterval(poll, getCurrentInterval());
  }, [poll, getCurrentInterval]);

  // Stop polling
  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = undefined;
    }
    setStatus('stopped');
  }, []);

  // Pause polling
  const pause = useCallback(() => {
    isManuallyPausedRef.current = true;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = undefined;
    }
    setStatus('paused');
  }, []);

  // Resume polling
  const resume = useCallback(() => {
    if (status === 'stopped') return;
    isManuallyPausedRef.current = false;
    setStatus('idle');
    start();
  }, [status, start]);

  // Force refresh
  const refresh = useCallback(async () => {
    await poll();
  }, [poll]);

  // Handle visibility change
  useEffect(() => {
    if (!pauseOnHidden) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (status !== 'stopped' && status !== 'paused') {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = undefined;
          }
          setStatus('paused');
        }
      } else {
        if (!isManuallyPausedRef.current && status !== 'stopped') {
          start();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [pauseOnHidden, status, start]);

  // Handle online/offline
  useEffect(() => {
    if (!pauseOnOffline) return;

    const handleOnline = () => {
      if (!isManuallyPausedRef.current && status !== 'stopped') {
        start();
      }
    };

    const handleOffline = () => {
      if (status !== 'stopped' && status !== 'paused') {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = undefined;
        }
        setStatus('paused');
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [pauseOnOffline, status, start]);

  // Auto-start when enabled
  useEffect(() => {
    if (enabled) {
      start();
    } else {
      stop();
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update interval when error count changes (for backoff)
  useEffect(() => {
    if (status !== 'idle' && status !== 'polling') return;
    if (!intervalRef.current) return;

    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(poll, getCurrentInterval());
  }, [errorCount, getCurrentInterval, poll, status]);

  return {
    data,
    status,
    error,
    start,
    stop,
    pause,
    resume,
    refresh,
    isPolling: status === 'polling',
    errorCount,
    lastPollTime,
  };
}

// ============================================================================
// 23.2: VISIBILITY-AWARE INTERVAL
// ============================================================================

/**
 * Hook for visibility-aware intervals
 * 
 * @example
 * ```tsx
 * useVisibilityInterval(() => {
 *   console.log('Tick!');
 * }, 1000);
 * ```
 */
export function useVisibilityInterval(
  callback: () => void,
  delay: number | null,
  options: { pauseOnHidden?: boolean } = {}
): void {
  const { pauseOnHidden = true } = options;
  const savedCallback = useRef(callback);
  const intervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) return;

    const tick = () => savedCallback.current();

    const startInterval = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(tick, delay);
    };

    const stopInterval = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
    };

    const handleVisibilityChange = () => {
      if (pauseOnHidden) {
        if (document.hidden) {
          stopInterval();
        } else {
          startInterval();
        }
      }
    };

    startInterval();

    if (pauseOnHidden) {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      stopInterval();
      if (pauseOnHidden) {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [delay, pauseOnHidden]);
}

// ============================================================================
// 23.3: WEBSOCKET HOOK
// ============================================================================

/**
 * Hook for WebSocket connections
 * 
 * @example
 * ```tsx
 * const { status, send, subscribe } = useWebSocket({
 *   url: 'ws://localhost:8001',
 *   autoConnect: true,
 *   autoReconnect: true,
 * });
 * 
 * // Subscribe to message types
 * useEffect(() => {
 *   return subscribe('ORDER_UPDATED', (order) => {
 *     console.log('Order updated:', order);
 *   });
 * }, [subscribe]);
 * ```
 */
export function useWebSocket(options: WebSocketOptions): WebSocketResult {
  const {
    url,
    protocols,
    autoConnect = true,
    autoReconnect = true,
    reconnectAttempts = 5,
    reconnectInterval = 1000,
    heartbeatInterval = 30000,
    heartbeatMessage = 'ping',
    onOpen,
    onClose,
    onError,
    onMessage,
  } = options;

  const [status, setStatus] = useState<WebSocketStatus>('disconnected');
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [reconnectCount, setReconnectCount] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout>();
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const subscribersRef = useRef<Map<string, Set<SubscriptionHandler>>>(new Map());

  // Get reconnect delay
  const getReconnectDelay = useCallback(
    (attempt: number): number => {
      if (typeof reconnectInterval === 'function') {
        return reconnectInterval(attempt);
      }
      // Exponential backoff
      return Math.min(reconnectInterval * Math.pow(2, attempt), 30000);
    },
    [reconnectInterval]
  );

  // Connect
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      setStatus('connecting');
      wsRef.current = new WebSocket(url, protocols);

      wsRef.current.onopen = (event) => {
        setStatus('connected');
        setReconnectCount(0);
        onOpen?.(event);

        // Start heartbeat
        if (heartbeatInterval > 0) {
          heartbeatRef.current = setInterval(() => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              const msg =
                typeof heartbeatMessage === 'string'
                  ? heartbeatMessage
                  : JSON.stringify(heartbeatMessage);
              wsRef.current.send(msg);
            }
          }, heartbeatInterval);
        }
      };

      wsRef.current.onclose = (event) => {
        setStatus('disconnected');
        onClose?.(event);

        // Clear heartbeat
        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current);
        }

        // Attempt reconnect
        if (autoReconnect && reconnectCount < reconnectAttempts) {
          setStatus('reconnecting');
          const delay = getReconnectDelay(reconnectCount);
          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectCount((c) => c + 1);
            connect();
          }, delay);
        }
      };

      wsRef.current.onerror = (event) => {
        setStatus('error');
        onError?.(event);
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(message);
          onMessage?.(message);

          // Notify subscribers
          const handlers = subscribersRef.current.get(message.type);
          if (handlers) {
            handlers.forEach((handler) => handler(message.payload));
          }

          // Notify wildcard subscribers
          const wildcardHandlers = subscribersRef.current.get('*');
          if (wildcardHandlers) {
            wildcardHandlers.forEach((handler) => handler(message));
          }
        } catch {
          // Not JSON, handle as string
          const message: WebSocketMessage = {
            type: 'message',
            payload: event.data,
            timestamp: Date.now(),
          };
          setLastMessage(message);
          onMessage?.(message);
        }
      };
    } catch (err) {
      setStatus('error');
      console.error('WebSocket connection error:', err);
    }
  }, [
    url,
    protocols,
    autoReconnect,
    reconnectAttempts,
    reconnectCount,
    heartbeatInterval,
    heartbeatMessage,
    getReconnectDelay,
    onOpen,
    onClose,
    onError,
    onMessage,
  ]);

  // Disconnect
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus('disconnected');
    setReconnectCount(0);
  }, []);

  // Send message
  const send = useCallback((message: string | object) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket is not connected');
      return;
    }

    const msg = typeof message === 'string' ? message : JSON.stringify(message);
    wsRef.current.send(msg);
  }, []);

  // Subscribe to message type
  const subscribe = useCallback(<T,>(type: string, handler: (payload: T) => void): (() => void) => {
    if (!subscribersRef.current.has(type)) {
      subscribersRef.current.set(type, new Set());
    }

    const handlers = subscribersRef.current.get(type)!;
    handlers.add(handler as SubscriptionHandler);

    return () => {
      handlers.delete(handler as SubscriptionHandler);
      if (handlers.size === 0) {
        subscribersRef.current.delete(type);
      }
    };
  }, []);

  // Auto-connect
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    status,
    send,
    connect,
    disconnect,
    lastMessage,
    subscribe,
    reconnectCount,
  };
}

// ============================================================================
// 23.4: SUBSCRIPTION MANAGER
// ============================================================================

/** Subscription context value */
export interface SubscriptionContextValue {
  /** Subscribe to an event */
  subscribe: <T>(event: string, handler: SubscriptionHandler<T>) => () => void;
  /** Publish an event */
  publish: <T>(event: string, data: T) => void;
  /** Get subscriber count for an event */
  getSubscriberCount: (event: string) => number;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

/**
 * Hook to access subscription context
 */
export function useSubscription(): SubscriptionContextValue {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}

/** Subscription provider props */
export interface SubscriptionProviderProps {
  children: ReactNode;
}

/**
 * Provider for pub/sub event system
 * 
 * @example
 * ```tsx
 * <SubscriptionProvider>
 *   <App />
 * </SubscriptionProvider>
 * 
 * // In a component
 * const { subscribe, publish } = useSubscription();
 * 
 * useEffect(() => {
 *   return subscribe('orderUpdate', (order) => {
 *     console.log('Order updated:', order);
 *   });
 * }, [subscribe]);
 * 
 * // Publish from anywhere
 * publish('orderUpdate', { id: '123', status: 'complete' });
 * ```
 */
export function SubscriptionProvider({ children }: SubscriptionProviderProps) {
  const subscribersRef = useRef<Map<string, Set<SubscriptionHandler>>>(new Map());

  const subscribe = useCallback(<T,>(event: string, handler: SubscriptionHandler<T>): (() => void) => {
    if (!subscribersRef.current.has(event)) {
      subscribersRef.current.set(event, new Set());
    }

    const handlers = subscribersRef.current.get(event)!;
    handlers.add(handler as SubscriptionHandler);

    return () => {
      handlers.delete(handler as SubscriptionHandler);
      if (handlers.size === 0) {
        subscribersRef.current.delete(event);
      }
    };
  }, []);

  const publish = useCallback(<T,>(event: string, data: T) => {
    const handlers = subscribersRef.current.get(event);
    if (handlers) {
      handlers.forEach((handler) => handler(data));
    }
  }, []);

  const getSubscriberCount = useCallback((event: string): number => {
    return subscribersRef.current.get(event)?.size ?? 0;
  }, []);

  const value = useMemo<SubscriptionContextValue>(
    () => ({
      subscribe,
      publish,
      getSubscriberCount,
    }),
    [subscribe, publish, getSubscriberCount]
  );

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

// ============================================================================
// 23.5: REAL-TIME SYNC HOOK
// ============================================================================

/** Real-time sync options */
export interface UseRealtimeSyncOptions<T> {
  /** Initial data */
  initialData?: T;
  /** Fetch latest data */
  fetcher: () => Promise<T>;
  /** WebSocket event types to listen for */
  events: string[];
  /** Whether changes should trigger fetch */
  refetchOnEvent?: boolean;
  /** Transform event data to update local state */
  onEvent?: (eventType: string, eventData: unknown, currentData: T | undefined) => T | undefined;
}

/** Real-time sync result */
export interface UseRealtimeSyncResult<T> {
  /** Current data */
  data: T | undefined;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Refetch data */
  refetch: () => Promise<void>;
  /** Last update time */
  lastUpdated: number | null;
}

/**
 * Hook for real-time data synchronization
 * Combines initial fetch with WebSocket updates
 * 
 * @example
 * ```tsx
 * const { data, isLoading } = useRealtimeSync({
 *   fetcher: () => api.getOrders(),
 *   events: ['ORDER_CREATED', 'ORDER_UPDATED', 'ORDER_DELETED'],
 *   refetchOnEvent: true,
 * });
 * ```
 */
export function useRealtimeSync<T>(
  options: UseRealtimeSyncOptions<T>,
  ws: WebSocketResult
): UseRealtimeSyncResult<T> {
  const {
    initialData,
    fetcher,
    events,
    refetchOnEvent = true,
    onEvent,
  } = options;

  const [data, setData] = useState<T | undefined>(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  // Fetch data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await fetcherRef.current();
      setData(result);
      setLastUpdated(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Subscribe to WebSocket events
  useEffect(() => {
    const unsubscribes = events.map((event) =>
      ws.subscribe(event, (eventData: unknown) => {
        if (refetchOnEvent) {
          fetchData();
        } else if (onEvent) {
          setData((current) => onEvent(event, eventData, current));
          setLastUpdated(Date.now());
        }
      })
    );

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [ws, events, refetchOnEvent, onEvent, fetchData]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchData,
    lastUpdated,
  };
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Create exponential backoff function
 */
export function createExponentialBackoff(
  baseInterval: number,
  maxInterval: number = 30000,
  multiplier: number = 2
): (attempt: number) => number {
  return (attempt: number): number => {
    const interval = baseInterval * Math.pow(multiplier, attempt);
    return Math.min(interval, maxInterval);
  };
}

/**
 * Create jittered backoff function (adds randomness to prevent thundering herd)
 */
export function createJitteredBackoff(
  baseInterval: number,
  maxInterval: number = 30000,
  jitterFactor: number = 0.3
): (attempt: number) => number {
  return (attempt: number): number => {
    const exponential = baseInterval * Math.pow(2, attempt);
    const capped = Math.min(exponential, maxInterval);
    const jitter = capped * jitterFactor * Math.random();
    return capped + jitter;
  };
}

/**
 * Check if browser is online
 */
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

/**
 * Check if document is visible
 */
export function isDocumentVisible(): boolean {
  return typeof document !== 'undefined' ? !document.hidden : true;
}

/**
 * Hook to track online status
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(isOnline());

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return online;
}

/**
 * Hook to track document visibility
 */
export function useDocumentVisibility(): boolean {
  const [visible, setVisible] = useState(isDocumentVisible());

  useEffect(() => {
    const handleVisibilityChange = () => {
      setVisible(!document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return visible;
}

// ============================================================================
// EXPORTS
// ============================================================================

// Types are exported inline at their definitions
