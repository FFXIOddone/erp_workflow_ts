/**
 * DataPersistence.tsx - CRITICAL-16
 * 
 * Comprehensive data persistence utilities for the ERP system.
 * Provides type-safe hooks for localStorage, sessionStorage, IndexedDB,
 * cross-tab synchronization, and cache management.
 * 
 * Features:
 * - 16.1: useLocalStorage / useSessionStorage hooks
 * - 16.2: usePersistentState for Zustand integration
 * - 16.3: useTabSync for cross-tab state synchronization
 * - 16.4: useIndexedDB for large data storage
 * - 16.5: PersistenceProvider with cache invalidation
 * 
 * @module DataPersistence
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  type ReactNode,
} from 'react';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/** Options for storage hooks */
export interface StorageOptions<T> {
  /** Custom serializer function */
  serializer?: (value: T) => string;
  /** Custom deserializer function */
  deserializer?: (value: string) => StoredValue<T>;
  /** Whether to sync across tabs (localStorage only) */
  syncTabs?: boolean;
  /** Time-to-live in milliseconds */
  ttl?: number;
  /** Callback when storage changes from another tab */
  onExternalChange?: (newValue: T | null) => void;
}

/** Wrapper for stored values with metadata */
export interface StoredValue<T> {
  value: T;
  timestamp: number;
  ttl?: number;
}

/** IndexedDB configuration */
export interface IndexedDBConfig {
  /** Database name */
  dbName: string;
  /** Database version */
  version?: number;
  /** Store name */
  storeName: string;
  /** Key path for the store */
  keyPath?: string;
}

/** Cache entry with TTL */
export interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
  ttl?: number;
  tags?: string[];
}

/** Persistence context value */
export interface PersistenceContextValue {
  /** Get a cached value */
  get: <T>(key: string) => T | null;
  /** Set a cached value */
  set: <T>(key: string, value: T, options?: { ttl?: number; tags?: string[] }) => void;
  /** Remove a cached value */
  remove: (key: string) => void;
  /** Invalidate by key pattern */
  invalidateByPattern: (pattern: RegExp) => void;
  /** Invalidate by tag */
  invalidateByTag: (tag: string) => void;
  /** Clear all cache */
  clearAll: () => void;
  /** Get cache statistics */
  getStats: () => CacheStats;
}

/** Cache statistics */
export interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitCount: number;
  missCount: number;
  hitRate: number;
}

/** Tab sync message */
interface TabSyncMessage<T = unknown> {
  type: 'STATE_UPDATE' | 'STATE_REQUEST' | 'STATE_RESPONSE';
  key: string;
  value?: T;
  timestamp: number;
  tabId: string;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate a unique tab ID
 */
function generateTabId(): string {
  return `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Default serializer
 */
function defaultSerializer<T>(value: T): string {
  return JSON.stringify(value);
}

/**
 * Default deserializer - returns the parsed StoredValue wrapper
 */
function defaultDeserializer<T>(value: string): StoredValue<T> {
  return JSON.parse(value) as StoredValue<T>;
}

/**
 * Check if a stored value has expired
 */
function isExpired<T>(stored: StoredValue<T>): boolean {
  if (!stored.ttl) return false;
  return Date.now() - stored.timestamp > stored.ttl;
}

/**
 * Estimate size of a value in bytes
 */
function estimateSize(value: unknown): number {
  const str = JSON.stringify(value);
  return new Blob([str]).size;
}

/**
 * Check if code is running in browser
 */
function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

// ============================================================================
// 16.1: useLocalStorage / useSessionStorage HOOKS
// ============================================================================

/**
 * Generic hook for browser storage (localStorage or sessionStorage)
 * 
 * @param storage - The storage object to use
 * @param key - Storage key
 * @param initialValue - Default value if key doesn't exist
 * @param options - Storage options
 * @returns Tuple of [value, setValue, removeValue]
 */
function useStorage<T>(
  storage: Storage | null,
  key: string,
  initialValue: T,
  options: StorageOptions<T> = {}
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const {
    serializer = defaultSerializer,
    deserializer = defaultDeserializer,
    syncTabs = true,
    ttl,
    onExternalChange,
  } = options;

  // Refs for stable callbacks
  const onExternalChangeRef = useRef(onExternalChange);
  onExternalChangeRef.current = onExternalChange;

  // Read initial value from storage
  const readValue = useCallback((): T => {
    if (!isBrowser() || !storage) {
      return initialValue;
    }

    try {
      const item = storage.getItem(key);
      if (item === null) {
        return initialValue;
      }

      const stored: StoredValue<T> = deserializer(item);
      
      // Check if value has expired
      if (isExpired(stored)) {
        storage.removeItem(key);
        return initialValue;
      }

      return stored.value;
    } catch (error) {
      console.warn(`Error reading ${key} from storage:`, error);
      return initialValue;
    }
  }, [key, initialValue, storage, deserializer]);

  const [storedValue, setStoredValue] = useState<T>(readValue);

  // Write to storage
  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      if (!isBrowser() || !storage) return;

      try {
        const valueToStore = value instanceof Function ? value(storedValue) : value;
        
        const stored: StoredValue<T> = {
          value: valueToStore,
          timestamp: Date.now(),
          ttl,
        };

        storage.setItem(key, serializer(stored as unknown as T));
        setStoredValue(valueToStore);

        // Dispatch custom event for same-tab listeners
        window.dispatchEvent(
          new CustomEvent('local-storage-change', {
            detail: { key, value: valueToStore },
          })
        );
      } catch (error) {
        console.warn(`Error setting ${key} in storage:`, error);
      }
    },
    [key, storedValue, storage, serializer, ttl]
  );

  // Remove from storage
  const removeValue = useCallback(() => {
    if (!isBrowser() || !storage) return;

    try {
      storage.removeItem(key);
      setStoredValue(initialValue);
    } catch (error) {
      console.warn(`Error removing ${key} from storage:`, error);
    }
  }, [key, initialValue, storage]);

  // Listen for storage changes from other tabs
  useEffect(() => {
    if (!isBrowser() || !syncTabs || storage !== window.localStorage) return;

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key !== key || event.storageArea !== storage) return;

      if (event.newValue === null) {
        setStoredValue(initialValue);
        onExternalChangeRef.current?.(null);
      } else {
        try {
          const stored: StoredValue<T> = deserializer(event.newValue);
          if (!isExpired(stored)) {
            setStoredValue(stored.value);
            onExternalChangeRef.current?.(stored.value);
          }
        } catch (error) {
          console.warn(`Error parsing storage change for ${key}:`, error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key, initialValue, syncTabs, storage, deserializer]);

  return [storedValue, setValue, removeValue];
}

/**
 * Hook for type-safe localStorage access with TTL and cross-tab sync
 * 
 * @example
 * ```tsx
 * const [user, setUser, removeUser] = useLocalStorage('user', null);
 * const [settings, setSettings] = useLocalStorage('settings', defaultSettings, { ttl: 3600000 });
 * ```
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  options?: StorageOptions<T>
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const storage = isBrowser() ? window.localStorage : null;
  return useStorage(storage, key, initialValue, options);
}

/**
 * Hook for type-safe sessionStorage access
 * 
 * @example
 * ```tsx
 * const [formData, setFormData, clearFormData] = useSessionStorage('draft', {});
 * ```
 */
export function useSessionStorage<T>(
  key: string,
  initialValue: T,
  options?: Omit<StorageOptions<T>, 'syncTabs'>
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const storage = isBrowser() ? window.sessionStorage : null;
  return useStorage(storage, key, initialValue, { ...options, syncTabs: false });
}

// ============================================================================
// 16.2: usePersistentState HOOK (Zustand Integration)
// ============================================================================

/**
 * Options for persistent state
 */
export interface PersistentStateOptions<T> {
  /** Storage type */
  storage?: 'localStorage' | 'sessionStorage';
  /** Key prefix for namespacing */
  prefix?: string;
  /** Properties to persist (if T is object) */
  pick?: (keyof T)[];
  /** Properties to exclude from persistence */
  omit?: (keyof T)[];
  /** Transform before saving */
  serialize?: (state: T) => Partial<T>;
  /** Transform after loading */
  deserialize?: (persisted: Partial<T>) => Partial<T>;
  /** Debounce persistence (ms) */
  debounce?: number;
  /** Version for migrations */
  version?: number;
  /** Migration function */
  migrate?: (persisted: unknown, version: number) => T;
}

/**
 * Create a persistent state hook that syncs with storage
 * Designed for integration with Zustand or standalone use
 * 
 * @example
 * ```tsx
 * // Standalone usage
 * const [state, setState] = usePersistentState('app-state', { count: 0 });
 * 
 * // With Zustand-like API
 * const [state, setState] = usePersistentState('settings', defaultSettings, {
 *   pick: ['theme', 'language'],
 *   debounce: 300,
 * });
 * ```
 */
export function usePersistentState<T>(
  key: string,
  initialState: T,
  options: PersistentStateOptions<T> = {}
): [T, (updater: T | Partial<T> | ((state: T) => T | Partial<T>)) => void, () => void] {
  const {
    storage = 'localStorage',
    prefix = 'erp_',
    pick,
    omit,
    serialize,
    deserialize,
    debounce = 0,
    version = 1,
    migrate,
  } = options;

  const fullKey = `${prefix}${key}`;
  const storageRef = useRef(
    isBrowser()
      ? storage === 'localStorage'
        ? window.localStorage
        : window.sessionStorage
      : null
  );
  const debounceTimerRef = useRef<NodeJS.Timeout>();

  // Load initial state from storage
  const loadInitialState = useCallback((): T => {
    if (!storageRef.current) return initialState;

    try {
      const item = storageRef.current.getItem(fullKey);
      if (!item) return initialState;

      const parsed = JSON.parse(item);
      const storedVersion = parsed.__version || 1;

      let state = parsed.state;

      // Run migration if version mismatch
      if (storedVersion !== version && migrate) {
        state = migrate(state, storedVersion);
      }

      // Apply deserialize transform
      if (deserialize) {
        state = deserialize(state);
      }

      // Merge with initial state to handle new properties
      if (typeof initialState === 'object' && initialState !== null) {
        return { ...initialState, ...state };
      }

      return state;
    } catch (error) {
      console.warn(`Error loading persistent state ${fullKey}:`, error);
      return initialState;
    }
  }, [fullKey, initialState, version, migrate, deserialize]);

  const [state, setStateInternal] = useState<T>(loadInitialState);

  // Persist to storage
  const persistState = useCallback(
    (newState: T) => {
      if (!storageRef.current) return;

      try {
        let toPersist: Partial<T> = newState as Partial<T>;

        // Apply pick/omit filters
        if (typeof newState === 'object' && newState !== null) {
          if (pick) {
            toPersist = pick.reduce((acc, key) => {
              acc[key] = (newState as Record<keyof T, T[keyof T]>)[key];
              return acc;
            }, {} as Partial<T>);
          } else if (omit) {
            toPersist = { ...newState };
            omit.forEach((key) => delete toPersist[key]);
          }
        }

        // Apply serialize transform
        if (serialize) {
          toPersist = serialize(newState);
        }

        storageRef.current.setItem(
          fullKey,
          JSON.stringify({
            state: toPersist,
            __version: version,
            __timestamp: Date.now(),
          })
        );
      } catch (error) {
        console.warn(`Error persisting state ${fullKey}:`, error);
      }
    },
    [fullKey, pick, omit, serialize, version]
  );

  // Update state with optional debounced persistence
  const setState = useCallback(
    (updater: T | Partial<T> | ((state: T) => T | Partial<T>)) => {
      setStateInternal((prev) => {
        let newState: T;

        if (typeof updater === 'function') {
          const result = (updater as (state: T) => T | Partial<T>)(prev);
          if (typeof prev === 'object' && prev !== null) {
            newState = { ...prev, ...result };
          } else {
            newState = result as T;
          }
        } else if (typeof prev === 'object' && prev !== null) {
          newState = { ...prev, ...updater };
        } else {
          newState = updater as T;
        }

        // Debounced persistence
        if (debounce > 0) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = setTimeout(() => {
            persistState(newState);
          }, debounce);
        } else {
          persistState(newState);
        }

        return newState;
      });
    },
    [persistState, debounce]
  );

  // Clear persisted state
  const clearState = useCallback(() => {
    storageRef.current?.removeItem(fullKey);
    setStateInternal(initialState);
  }, [fullKey, initialState]);

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      clearTimeout(debounceTimerRef.current);
    };
  }, []);

  return [state, setState, clearState];
}

// ============================================================================
// 16.3: useTabSync HOOK (Cross-Tab Synchronization)
// ============================================================================

/**
 * Options for tab synchronization
 */
export interface TabSyncOptions<T> {
  /** Channel name for BroadcastChannel */
  channel?: string;
  /** Whether to request state from other tabs on mount */
  requestOnMount?: boolean;
  /** Callback when receiving state from another tab */
  onReceive?: (value: T, tabId: string) => void;
  /** Callback when this tab becomes leader */
  onBecomeLeader?: () => void;
}

/**
 * Hook for synchronizing state across browser tabs using BroadcastChannel
 * 
 * @example
 * ```tsx
 * const [sharedState, setSharedState, { isLeader, tabId }] = useTabSync('cart', [], {
 *   onReceive: (cart) => console.log('Cart updated from another tab:', cart),
 * });
 * ```
 */
export function useTabSync<T>(
  key: string,
  initialValue: T,
  options: TabSyncOptions<T> = {}
): [T, (value: T | ((prev: T) => T)) => void, { isLeader: boolean; tabId: string; broadcast: (value: T) => void }] {
  const { channel = 'erp_tab_sync', requestOnMount = true, onReceive, onBecomeLeader } = options;

  const [value, setValue] = useState<T>(initialValue);
  const [isLeader, setIsLeader] = useState(false);
  const tabIdRef = useRef(generateTabId());
  const channelRef = useRef<BroadcastChannel | null>(null);
  const onReceiveRef = useRef(onReceive);
  const onBecomeLeaderRef = useRef(onBecomeLeader);

  onReceiveRef.current = onReceive;
  onBecomeLeaderRef.current = onBecomeLeader;

  // Initialize BroadcastChannel
  useEffect(() => {
    if (!isBrowser() || typeof BroadcastChannel === 'undefined') return;

    const bc = new BroadcastChannel(`${channel}_${key}`);
    channelRef.current = bc;

    const handleMessage = (event: MessageEvent<TabSyncMessage<T>>) => {
      const message = event.data;

      switch (message.type) {
        case 'STATE_UPDATE':
          if (message.tabId !== tabIdRef.current && message.value !== undefined) {
            setValue(message.value);
            onReceiveRef.current?.(message.value, message.tabId);
          }
          break;

        case 'STATE_REQUEST':
          // Respond with current state
          bc.postMessage({
            type: 'STATE_RESPONSE',
            key,
            value,
            timestamp: Date.now(),
            tabId: tabIdRef.current,
          } as TabSyncMessage<T>);
          break;

        case 'STATE_RESPONSE':
          // Only accept if we're waiting for state
          if (message.tabId !== tabIdRef.current && message.value !== undefined) {
            setValue(message.value);
            onReceiveRef.current?.(message.value, message.tabId);
          }
          break;
      }
    };

    bc.addEventListener('message', handleMessage);

    // Request state from other tabs on mount
    if (requestOnMount) {
      bc.postMessage({
        type: 'STATE_REQUEST',
        key,
        timestamp: Date.now(),
        tabId: tabIdRef.current,
      } as TabSyncMessage<T>);
    }

    return () => {
      bc.removeEventListener('message', handleMessage);
      bc.close();
      channelRef.current = null;
    };
  }, [key, channel, requestOnMount]);

  // Leader election using localStorage
  useEffect(() => {
    if (!isBrowser()) return;

    const leaderKey = `${channel}_${key}_leader`;
    const heartbeatInterval = 2000;
    const leaderTimeout = 5000;

    const tryBecomeLeader = () => {
      const now = Date.now();
      const current = localStorage.getItem(leaderKey);

      if (!current) {
        localStorage.setItem(leaderKey, JSON.stringify({ tabId: tabIdRef.current, timestamp: now }));
        setIsLeader(true);
        onBecomeLeaderRef.current?.();
        return;
      }

      try {
        const { tabId, timestamp } = JSON.parse(current);
        
        // Take over if leader is stale
        if (now - timestamp > leaderTimeout) {
          localStorage.setItem(leaderKey, JSON.stringify({ tabId: tabIdRef.current, timestamp: now }));
          setIsLeader(true);
          onBecomeLeaderRef.current?.();
        } else if (tabId === tabIdRef.current) {
          // Heartbeat - we're still leader
          localStorage.setItem(leaderKey, JSON.stringify({ tabId: tabIdRef.current, timestamp: now }));
          setIsLeader(true);
        } else {
          setIsLeader(false);
        }
      } catch {
        localStorage.setItem(leaderKey, JSON.stringify({ tabId: tabIdRef.current, timestamp: now }));
        setIsLeader(true);
        onBecomeLeaderRef.current?.();
      }
    };

    tryBecomeLeader();
    const interval = setInterval(tryBecomeLeader, heartbeatInterval);

    // Cleanup on unmount
    return () => {
      clearInterval(interval);
      const current = localStorage.getItem(leaderKey);
      if (current) {
        try {
          const { tabId } = JSON.parse(current);
          if (tabId === tabIdRef.current) {
            localStorage.removeItem(leaderKey);
          }
        } catch {
          // Ignore
        }
      }
    };
  }, [key, channel]);

  // Broadcast state update
  const broadcast = useCallback((newValue: T) => {
    if (channelRef.current) {
      channelRef.current.postMessage({
        type: 'STATE_UPDATE',
        key,
        value: newValue,
        timestamp: Date.now(),
        tabId: tabIdRef.current,
      } as TabSyncMessage<T>);
    }
  }, [key]);

  // Set value and broadcast
  const setValueAndBroadcast = useCallback(
    (newValue: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const next = typeof newValue === 'function' ? (newValue as (prev: T) => T)(prev) : newValue;
        broadcast(next);
        return next;
      });
    },
    [broadcast]
  );

  return [
    value,
    setValueAndBroadcast,
    { isLeader, tabId: tabIdRef.current, broadcast },
  ];
}

// ============================================================================
// 16.4: useIndexedDB HOOK
// ============================================================================

/**
 * IndexedDB operation result
 */
export interface IDBResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

/**
 * IndexedDB hook return type
 */
export interface UseIndexedDBReturn<T> {
  /** Get a value by key */
  get: (id: string | number) => Promise<T | undefined>;
  /** Get all values */
  getAll: () => Promise<T[]>;
  /** Set a value */
  set: (value: T, key?: string | number) => Promise<void>;
  /** Update a value (merge) */
  update: (id: string | number, updates: Partial<T>) => Promise<void>;
  /** Delete a value */
  remove: (id: string | number) => Promise<void>;
  /** Clear all values */
  clear: () => Promise<void>;
  /** Count entries */
  count: () => Promise<number>;
  /** Current loading state */
  loading: boolean;
  /** Last error */
  error: Error | null;
  /** Whether the database is ready */
  ready: boolean;
}

/**
 * Hook for IndexedDB operations with async support
 * Ideal for storing large datasets that don't fit in localStorage
 * 
 * @example
 * ```tsx
 * const { get, set, getAll, remove, loading, error } = useIndexedDB<Order>({
 *   dbName: 'erp_cache',
 *   storeName: 'orders',
 *   keyPath: 'id',
 * });
 * 
 * // Store an order
 * await set(order);
 * 
 * // Get an order
 * const order = await get('order-123');
 * 
 * // Get all orders
 * const allOrders = await getAll();
 * ```
 */
export function useIndexedDB<T extends Record<string, unknown>>(
  config: IndexedDBConfig
): UseIndexedDBReturn<T> {
  const { dbName, version = 1, storeName, keyPath = 'id' } = config;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [ready, setReady] = useState(false);
  const dbRef = useRef<IDBDatabase | null>(null);

  // Open database
  useEffect(() => {
    if (!isBrowser() || !window.indexedDB) {
      setError(new Error('IndexedDB is not supported'));
      return;
    }

    const request = indexedDB.open(dbName, version);

    request.onerror = () => {
      setError(new Error(`Failed to open database: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      dbRef.current = request.result;
      setReady(true);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath });
      }
    };

    return () => {
      dbRef.current?.close();
      dbRef.current = null;
    };
  }, [dbName, version, storeName, keyPath]);

  // Get transaction
  const getTransaction = useCallback(
    (mode: IDBTransactionMode = 'readonly'): IDBObjectStore | null => {
      if (!dbRef.current) return null;
      const transaction = dbRef.current.transaction(storeName, mode);
      return transaction.objectStore(storeName);
    },
    [storeName]
  );

  // Get a value by key
  const get = useCallback(
    async (id: string | number): Promise<T | undefined> => {
      const store = getTransaction('readonly');
      if (!store) throw new Error('Database not ready');

      return new Promise((resolve, reject) => {
        setLoading(true);
        const request = store.get(id);
        
        request.onsuccess = () => {
          setLoading(false);
          resolve(request.result as T | undefined);
        };
        
        request.onerror = () => {
          setLoading(false);
          const err = new Error(`Failed to get item: ${request.error?.message}`);
          setError(err);
          reject(err);
        };
      });
    },
    [getTransaction]
  );

  // Get all values
  const getAll = useCallback(async (): Promise<T[]> => {
    const store = getTransaction('readonly');
    if (!store) throw new Error('Database not ready');

    return new Promise((resolve, reject) => {
      setLoading(true);
      const request = store.getAll();
      
      request.onsuccess = () => {
        setLoading(false);
        resolve(request.result as T[]);
      };
      
      request.onerror = () => {
        setLoading(false);
        const err = new Error(`Failed to get all items: ${request.error?.message}`);
        setError(err);
        reject(err);
      };
    });
  }, [getTransaction]);

  // Set a value
  const set = useCallback(
    async (value: T, key?: string | number): Promise<void> => {
      const store = getTransaction('readwrite');
      if (!store) throw new Error('Database not ready');

      return new Promise((resolve, reject) => {
        setLoading(true);
        const request = key !== undefined ? store.put(value, key) : store.put(value);
        
        request.onsuccess = () => {
          setLoading(false);
          resolve();
        };
        
        request.onerror = () => {
          setLoading(false);
          const err = new Error(`Failed to set item: ${request.error?.message}`);
          setError(err);
          reject(err);
        };
      });
    },
    [getTransaction]
  );

  // Update a value (merge)
  const update = useCallback(
    async (id: string | number, updates: Partial<T>): Promise<void> => {
      const existing = await get(id);
      if (!existing) {
        throw new Error(`Item with id ${id} not found`);
      }
      await set({ ...existing, ...updates });
    },
    [get, set]
  );

  // Delete a value
  const remove = useCallback(
    async (id: string | number): Promise<void> => {
      const store = getTransaction('readwrite');
      if (!store) throw new Error('Database not ready');

      return new Promise((resolve, reject) => {
        setLoading(true);
        const request = store.delete(id);
        
        request.onsuccess = () => {
          setLoading(false);
          resolve();
        };
        
        request.onerror = () => {
          setLoading(false);
          const err = new Error(`Failed to delete item: ${request.error?.message}`);
          setError(err);
          reject(err);
        };
      });
    },
    [getTransaction]
  );

  // Clear all values
  const clear = useCallback(async (): Promise<void> => {
    const store = getTransaction('readwrite');
    if (!store) throw new Error('Database not ready');

    return new Promise((resolve, reject) => {
      setLoading(true);
      const request = store.clear();
      
      request.onsuccess = () => {
        setLoading(false);
        resolve();
      };
      
      request.onerror = () => {
        setLoading(false);
        const err = new Error(`Failed to clear store: ${request.error?.message}`);
        setError(err);
        reject(err);
      };
    });
  }, [getTransaction]);

  // Count entries
  const count = useCallback(async (): Promise<number> => {
    const store = getTransaction('readonly');
    if (!store) throw new Error('Database not ready');

    return new Promise((resolve, reject) => {
      setLoading(true);
      const request = store.count();
      
      request.onsuccess = () => {
        setLoading(false);
        resolve(request.result);
      };
      
      request.onerror = () => {
        setLoading(false);
        const err = new Error(`Failed to count items: ${request.error?.message}`);
        setError(err);
        reject(err);
      };
    });
  }, [getTransaction]);

  return {
    get,
    getAll,
    set,
    update,
    remove,
    clear,
    count,
    loading,
    error,
    ready,
  };
}

// ============================================================================
// 16.5: PersistenceProvider & Cache Management
// ============================================================================

const PersistenceContext = createContext<PersistenceContextValue | null>(null);

/**
 * Props for PersistenceProvider
 */
export interface PersistenceProviderProps {
  children: ReactNode;
  /** Storage backend */
  storage?: 'localStorage' | 'sessionStorage' | 'memory';
  /** Key prefix */
  prefix?: string;
  /** Default TTL for cache entries (ms) */
  defaultTTL?: number;
  /** Maximum cache entries */
  maxEntries?: number;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Provider for application-wide cache management
 * 
 * @example
 * ```tsx
 * <PersistenceProvider storage="localStorage" defaultTTL={3600000} maxEntries={100}>
 *   <App />
 * </PersistenceProvider>
 * ```
 */
export function PersistenceProvider({
  children,
  storage = 'localStorage',
  prefix = 'erp_cache_',
  defaultTTL,
  maxEntries = 1000,
  debug = false,
}: PersistenceProviderProps) {
  const cacheRef = useRef<Map<string, CacheEntry<unknown>>>(new Map());
  const statsRef = useRef({ hitCount: 0, missCount: 0 });

  // Get storage backend
  const getStorage = useCallback((): Storage | null => {
    if (!isBrowser()) return null;
    if (storage === 'memory') return null;
    return storage === 'localStorage' ? window.localStorage : window.sessionStorage;
  }, [storage]);

  // Load cache from storage on mount
  useEffect(() => {
    const storageBackend = getStorage();
    if (!storageBackend) return;

    try {
      const keys = Object.keys(storageBackend).filter((k) => k.startsWith(prefix));
      
      for (const key of keys) {
        const item = storageBackend.getItem(key);
        if (item) {
          try {
            const entry = JSON.parse(item) as CacheEntry<unknown>;
            
            // Skip expired entries
            if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
              storageBackend.removeItem(key);
              continue;
            }
            
            cacheRef.current.set(key.replace(prefix, ''), entry);
          } catch {
            // Invalid entry, remove it
            storageBackend.removeItem(key);
          }
        }
      }

      if (debug) {
        console.log(`[PersistenceProvider] Loaded ${cacheRef.current.size} entries from ${storage}`);
      }
    } catch (error) {
      console.warn('[PersistenceProvider] Failed to load cache:', error);
    }
  }, [getStorage, prefix, storage, debug]);

  // Evict oldest entries if over limit
  const evictIfNeeded = useCallback(() => {
    if (cacheRef.current.size <= maxEntries) return;

    const entries = Array.from(cacheRef.current.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

    const toEvict = entries.slice(0, cacheRef.current.size - maxEntries);
    const storageBackend = getStorage();

    for (const [key] of toEvict) {
      cacheRef.current.delete(key);
      storageBackend?.removeItem(`${prefix}${key}`);
    }

    if (debug && toEvict.length > 0) {
      console.log(`[PersistenceProvider] Evicted ${toEvict.length} entries`);
    }
  }, [maxEntries, getStorage, prefix, debug]);

  // Get cached value
  const get = useCallback(
    <T,>(key: string): T | null => {
      const entry = cacheRef.current.get(key);

      if (!entry) {
        statsRef.current.missCount++;
        if (debug) console.log(`[PersistenceProvider] Cache MISS: ${key}`);
        return null;
      }

      // Check expiration
      if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
        cacheRef.current.delete(key);
        getStorage()?.removeItem(`${prefix}${key}`);
        statsRef.current.missCount++;
        if (debug) console.log(`[PersistenceProvider] Cache EXPIRED: ${key}`);
        return null;
      }

      statsRef.current.hitCount++;
      if (debug) console.log(`[PersistenceProvider] Cache HIT: ${key}`);
      return entry.value as T;
    },
    [getStorage, prefix, debug]
  );

  // Set cached value
  const set = useCallback(
    <T,>(key: string, value: T, options?: { ttl?: number; tags?: string[] }) => {
      const entry: CacheEntry<T> = {
        key,
        value,
        timestamp: Date.now(),
        ttl: options?.ttl ?? defaultTTL,
        tags: options?.tags,
      };

      cacheRef.current.set(key, entry as CacheEntry<unknown>);
      
      try {
        getStorage()?.setItem(`${prefix}${key}`, JSON.stringify(entry));
      } catch (error) {
        // Storage full, try to evict
        console.warn('[PersistenceProvider] Storage full, evicting entries');
        evictIfNeeded();
        try {
          getStorage()?.setItem(`${prefix}${key}`, JSON.stringify(entry));
        } catch {
          console.error('[PersistenceProvider] Failed to persist entry after eviction');
        }
      }

      evictIfNeeded();

      if (debug) console.log(`[PersistenceProvider] Cache SET: ${key}`);
    },
    [getStorage, prefix, defaultTTL, evictIfNeeded, debug]
  );

  // Remove cached value
  const remove = useCallback(
    (key: string) => {
      cacheRef.current.delete(key);
      getStorage()?.removeItem(`${prefix}${key}`);
      if (debug) console.log(`[PersistenceProvider] Cache REMOVE: ${key}`);
    },
    [getStorage, prefix, debug]
  );

  // Invalidate by pattern
  const invalidateByPattern = useCallback(
    (pattern: RegExp) => {
      const storageBackend = getStorage();
      let count = 0;

      for (const key of cacheRef.current.keys()) {
        if (pattern.test(key)) {
          cacheRef.current.delete(key);
          storageBackend?.removeItem(`${prefix}${key}`);
          count++;
        }
      }

      if (debug) console.log(`[PersistenceProvider] Invalidated ${count} entries by pattern: ${pattern}`);
    },
    [getStorage, prefix, debug]
  );

  // Invalidate by tag
  const invalidateByTag = useCallback(
    (tag: string) => {
      const storageBackend = getStorage();
      let count = 0;

      for (const [key, entry] of cacheRef.current.entries()) {
        if (entry.tags?.includes(tag)) {
          cacheRef.current.delete(key);
          storageBackend?.removeItem(`${prefix}${key}`);
          count++;
        }
      }

      if (debug) console.log(`[PersistenceProvider] Invalidated ${count} entries by tag: ${tag}`);
    },
    [getStorage, prefix, debug]
  );

  // Clear all cache
  const clearAll = useCallback(() => {
    const storageBackend = getStorage();

    for (const key of cacheRef.current.keys()) {
      storageBackend?.removeItem(`${prefix}${key}`);
    }

    cacheRef.current.clear();
    statsRef.current = { hitCount: 0, missCount: 0 };

    if (debug) console.log('[PersistenceProvider] Cache CLEARED');
  }, [getStorage, prefix, debug]);

  // Get cache statistics
  const getStats = useCallback((): CacheStats => {
    let totalSize = 0;
    for (const entry of cacheRef.current.values()) {
      totalSize += estimateSize(entry);
    }

    const { hitCount, missCount } = statsRef.current;
    const total = hitCount + missCount;

    return {
      totalEntries: cacheRef.current.size,
      totalSize,
      hitCount,
      missCount,
      hitRate: total > 0 ? hitCount / total : 0,
    };
  }, []);

  const value = useMemo<PersistenceContextValue>(
    () => ({
      get,
      set,
      remove,
      invalidateByPattern,
      invalidateByTag,
      clearAll,
      getStats,
    }),
    [get, set, remove, invalidateByPattern, invalidateByTag, clearAll, getStats]
  );

  return (
    <PersistenceContext.Provider value={value}>
      {children}
    </PersistenceContext.Provider>
  );
}

/**
 * Hook to access the persistence context
 */
export function usePersistence(): PersistenceContextValue {
  const context = useContext(PersistenceContext);
  if (!context) {
    throw new Error('usePersistence must be used within a PersistenceProvider');
  }
  return context;
}

/**
 * Hook for cache-aware data fetching with SWR-like behavior
 * 
 * @example
 * ```tsx
 * const { data, loading, error, refresh } = useCachedData(
 *   'orders-list',
 *   () => api.get('/orders'),
 *   { ttl: 60000, tags: ['orders'] }
 * );
 * ```
 */
export function useCachedData<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: {
    ttl?: number;
    tags?: string[];
    enabled?: boolean;
    onSuccess?: (data: T) => void;
    onError?: (error: Error) => void;
    refetchOnMount?: boolean;
    refetchInterval?: number;
  } = {}
): {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
} {
  const {
    ttl,
    tags,
    enabled = true,
    onSuccess,
    onError,
    refetchOnMount = false,
    refetchInterval,
  } = options;

  const { get, set } = usePersistence();
  const [data, setData] = useState<T | null>(() => get<T>(key));
  const [loading, setLoading] = useState(!data && enabled);
  const [error, setError] = useState<Error | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const fetch = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    setError(null);

    try {
      const result = await fetcherRef.current();
      setData(result);
      set(key, result, { ttl, tags });
      onSuccess?.(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
    } finally {
      setLoading(false);
    }
  }, [key, enabled, ttl, tags, set, onSuccess, onError]);

  // Initial fetch
  useEffect(() => {
    if (!enabled) return;

    const cached = get<T>(key);
    if (cached && !refetchOnMount) {
      setData(cached);
      return;
    }

    fetch();
  }, [key, enabled, refetchOnMount, get, fetch]);

  // Refetch interval
  useEffect(() => {
    if (!refetchInterval || !enabled) return;

    const interval = setInterval(fetch, refetchInterval);
    return () => clearInterval(interval);
  }, [refetchInterval, enabled, fetch]);

  return {
    data,
    loading,
    error,
    refresh: fetch,
  };
}

// ============================================================================
// CACHE INVALIDATION UTILITIES
// ============================================================================

/**
 * Create a cache key with segments
 * 
 * @example
 * ```tsx
 * const key = createCacheKey('orders', 'list', { status: 'active' });
 * // Returns: 'orders:list:{"status":"active"}'
 * ```
 */
export function createCacheKey(...segments: (string | number | object)[]): string {
  return segments
    .map((s) => (typeof s === 'object' ? JSON.stringify(s) : String(s)))
    .join(':');
}

/**
 * Parse a cache key into segments
 */
export function parseCacheKey(key: string): string[] {
  return key.split(':');
}

/**
 * Create a pattern for cache invalidation
 * 
 * @example
 * ```tsx
 * const pattern = createInvalidationPattern('orders', '*');
 * // Returns: /^orders:.*$/
 * ```
 */
export function createInvalidationPattern(...segments: string[]): RegExp {
  const pattern = segments
    .map((s) => (s === '*' ? '.*' : s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join(':');
  return new RegExp(`^${pattern}$`);
}

// ============================================================================
// STORAGE QUOTA UTILITIES
// ============================================================================

/**
 * Get storage usage information
 */
export async function getStorageQuota(): Promise<{
  usage: number;
  quota: number;
  percentUsed: number;
} | null> {
  if (!isBrowser() || !navigator.storage?.estimate) {
    return null;
  }

  try {
    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage || 0;
    const quota = estimate.quota || 0;
    
    return {
      usage,
      quota,
      percentUsed: quota > 0 ? (usage / quota) * 100 : 0,
    };
  } catch {
    return null;
  }
}

/**
 * Get localStorage usage
 */
export function getLocalStorageUsage(): { used: number; available: number } {
  if (!isBrowser()) return { used: 0, available: 0 };

  let used = 0;
  for (const key of Object.keys(localStorage)) {
    used += (localStorage.getItem(key)?.length || 0) * 2; // UTF-16
  }

  // localStorage typically has 5MB limit
  const available = 5 * 1024 * 1024 - used;

  return { used, available: Math.max(0, available) };
}

// ============================================================================
// EXPORTS - Only non-inline exports
// ============================================================================

export type {
  TabSyncMessage,
};
