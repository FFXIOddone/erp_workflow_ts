/**
 * Optimistic UI Updates System
 * 
 * Provides hooks and utilities for implementing optimistic updates
 * that give users instant feedback while mutations are in flight.
 * 
 * Features:
 * - Automatic rollback on failure
 * - Conflict detection and resolution
 * - Visual feedback for pending states
 * - Integration with TanStack Query
 * - Type-safe optimistic data transformations
 */

import { useCallback, useRef, useState, useMemo } from 'react';
import {
  useMutation,
  useQueryClient,
  UseMutationOptions,
  UseMutationResult,
  QueryKey,
  MutationFunction,
} from '@tanstack/react-query';
import { useToast } from './useNotifications';

// ============================================================================
// Types
// ============================================================================

export type OptimisticUpdateFn<TData, TVariables> = (
  oldData: TData | undefined,
  variables: TVariables
) => TData;

export type RollbackFn<TData> = (
  currentData: TData | undefined,
  previousData: TData | undefined
) => TData | undefined;

export interface OptimisticMutationOptions<
  TData = unknown,
  TError = Error,
  TVariables = void,
  TContext = unknown,
  TQueryData = unknown
> extends Omit<UseMutationOptions<TData, TError, TVariables, TContext>, 'onMutate' | 'onError' | 'onSettled'> {
  /** Query key(s) to update optimistically */
  queryKey: QueryKey | QueryKey[];
  
  /** Function to transform query data optimistically */
  optimisticUpdate: OptimisticUpdateFn<TQueryData, TVariables>;
  
  /** Custom rollback function (defaults to restoring previous data) */
  rollback?: RollbackFn<TQueryData>;
  
  /** Show toast on success */
  successMessage?: string | ((data: TData, variables: TVariables) => string);
  
  /** Show toast on error */
  errorMessage?: string | ((error: TError, variables: TVariables) => string);
  
  /** Delay before showing pending indicator (ms) */
  pendingDelay?: number;
  
  /** Additional query keys to invalidate on success */
  invalidateKeys?: QueryKey[];
  
  /** Whether to refetch affected queries on success (default: true) */
  refetchOnSuccess?: boolean;
  
  /** Custom onMutate callback (runs after optimistic update) */
  onOptimisticMutate?: (variables: TVariables) => void | Promise<void>;
  
  /** Custom onError callback (runs after rollback) */
  onOptimisticError?: (error: TError, variables: TVariables, context: TContext | undefined) => void;
  
  /** Custom onSuccess callback */
  onOptimisticSuccess?: (data: TData, variables: TVariables) => void;
  
  /** Custom onSettled callback */
  onOptimisticSettled?: (data: TData | undefined, error: TError | null, variables: TVariables) => void;
}

export type OptimisticMutationResult<TData, TError, TVariables, TContext> = 
  UseMutationResult<TData, TError, TVariables, TContext> & {
  /** Whether the mutation is in the pending delay period */
  isPendingDelayed: boolean;
  
  /** Number of times this mutation has been retried */
  retryCount: number;
  
  /** Manually trigger rollback */
  rollback: () => void;
};

export interface OptimisticContext<TQueryData> {
  previousData: Map<string, TQueryData | undefined>;
  queryKeys: QueryKey[];
}

// ============================================================================
// Hook: useOptimisticMutation
// ============================================================================

/**
 * Enhanced mutation hook with built-in optimistic update support
 * 
 * @example
 * const updateOrder = useOptimisticMutation({
 *   mutationFn: (data) => api.patch(`/orders/${data.id}`, data),
 *   queryKey: ['orders'],
 *   optimisticUpdate: (orders, newData) => 
 *     orders?.map(o => o.id === newData.id ? { ...o, ...newData } : o),
 *   successMessage: 'Order updated successfully',
 *   errorMessage: 'Failed to update order',
 * });
 */
export function useOptimisticMutation<
  TData = unknown,
  TError = Error,
  TVariables = void,
  TContext = OptimisticContext<unknown>,
  TQueryData = unknown
>(
  options: OptimisticMutationOptions<TData, TError, TVariables, TContext, TQueryData> & {
    mutationFn: MutationFunction<TData, TVariables>;
  }
): OptimisticMutationResult<TData, TError, TVariables, TContext> {
  const {
    queryKey,
    optimisticUpdate,
    rollback: customRollback,
    successMessage,
    errorMessage,
    pendingDelay = 200,
    invalidateKeys = [],
    refetchOnSuccess = true,
    onOptimisticMutate,
    onOptimisticError,
    onOptimisticSuccess,
    onOptimisticSettled,
    ...mutationOptions
  } = options;
  
  const queryClient = useQueryClient();
  const toast = useToast();
  const [isPendingDelayed, setIsPendingDelayed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const pendingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const contextRef = useRef<TContext | null>(null);
  
  // Normalize queryKey to array of keys
  const queryKeys = useMemo(() => {
    if (Array.isArray(queryKey) && queryKey.length > 0 && Array.isArray(queryKey[0])) {
      return queryKey as QueryKey[];
    }
    return [queryKey] as QueryKey[];
  }, [queryKey]);
  
  const mutation = useMutation<TData, TError, TVariables, TContext>({
    ...mutationOptions,
    
    onMutate: async (variables) => {
      // Start pending delay timer
      pendingTimeoutRef.current = setTimeout(() => {
        setIsPendingDelayed(true);
      }, pendingDelay);
      
      // Cancel outgoing refetches
      await Promise.all(
        queryKeys.map((key) => queryClient.cancelQueries({ queryKey: key }))
      );
      
      // Snapshot previous data for all affected queries
      const previousData = new Map<string, TQueryData | undefined>();
      
      for (const key of queryKeys) {
        const keyStr = JSON.stringify(key);
        const data = queryClient.getQueryData<TQueryData>(key);
        previousData.set(keyStr, data);
        
        // Apply optimistic update
        if (data !== undefined) {
          const optimisticData = optimisticUpdate(data, variables);
          queryClient.setQueryData<TQueryData>(key, optimisticData);
        }
      }
      
      // Run custom onMutate
      if (onOptimisticMutate) {
        await onOptimisticMutate(variables);
      }
      
      const context = { previousData, queryKeys } as TContext;
      contextRef.current = context;
      
      return context;
    },
    
    onError: (error, variables, context) => {
      // Clear pending timer
      if (pendingTimeoutRef.current) {
        clearTimeout(pendingTimeoutRef.current);
        pendingTimeoutRef.current = null;
      }
      setIsPendingDelayed(false);
      
      // Rollback all affected queries
      const ctx = context as OptimisticContext<TQueryData> | undefined;
      if (ctx?.previousData) {
        for (const key of ctx.queryKeys) {
          const keyStr = JSON.stringify(key);
          const previousValue = ctx.previousData.get(keyStr);
          
          if (customRollback) {
            const currentData = queryClient.getQueryData<TQueryData>(key);
            const rolledBackData = customRollback(currentData, previousValue);
            queryClient.setQueryData<TQueryData>(key, rolledBackData);
          } else {
            queryClient.setQueryData<TQueryData>(key, previousValue);
          }
        }
      }
      
      // Increment retry count
      setRetryCount((prev) => prev + 1);
      
      // Show error toast
      if (errorMessage) {
        const message = typeof errorMessage === 'function'
          ? errorMessage(error, variables)
          : errorMessage;
        toast.error('Error', message);
      }
      
      // Run custom onError
      if (onOptimisticError) {
        onOptimisticError(error, variables, context);
      }
    },
    
    onSuccess: (data, variables) => {
      // Clear pending timer
      if (pendingTimeoutRef.current) {
        clearTimeout(pendingTimeoutRef.current);
        pendingTimeoutRef.current = null;
      }
      setIsPendingDelayed(false);
      
      // Reset retry count on success
      setRetryCount(0);
      
      // Show success toast
      if (successMessage) {
        const message = typeof successMessage === 'function'
          ? successMessage(data, variables)
          : successMessage;
        toast.success('Success', message);
      }
      
      // Run custom onSuccess
      if (onOptimisticSuccess) {
        onOptimisticSuccess(data, variables);
      }
    },
    
    onSettled: async (data, error, variables) => {
      // Clear pending timer
      if (pendingTimeoutRef.current) {
        clearTimeout(pendingTimeoutRef.current);
        pendingTimeoutRef.current = null;
      }
      setIsPendingDelayed(false);
      
      // Refetch affected queries to ensure consistency
      if (refetchOnSuccess && !error) {
        await Promise.all(
          queryKeys.map((key) => queryClient.invalidateQueries({ queryKey: key }))
        );
      }
      
      // Invalidate additional keys
      if (invalidateKeys.length > 0) {
        await Promise.all(
          invalidateKeys.map((key) => queryClient.invalidateQueries({ queryKey: key }))
        );
      }
      
      // Run custom onSettled
      if (onOptimisticSettled) {
        onOptimisticSettled(data, error, variables);
      }
    },
  });
  
  // Manual rollback function
  const manualRollback = useCallback(() => {
    const ctx = contextRef.current as OptimisticContext<TQueryData> | undefined;
    if (ctx?.previousData) {
      for (const key of ctx.queryKeys) {
        const keyStr = JSON.stringify(key);
        const previousValue = ctx.previousData.get(keyStr);
        queryClient.setQueryData<TQueryData>(key, previousValue);
      }
    }
  }, [queryClient]);
  
  return {
    ...mutation,
    isPendingDelayed,
    retryCount,
    rollback: manualRollback,
  };
}

// ============================================================================
// Hook: useOptimisticList
// ============================================================================

export interface UseOptimisticListOptions<TItem, TCreateData, TUpdateData> {
  /** Query key for the list */
  queryKey: QueryKey;
  
  /** API functions */
  api: {
    create: (data: TCreateData) => Promise<TItem>;
    update: (id: string, data: TUpdateData) => Promise<TItem>;
    delete: (id: string) => Promise<void>;
  };
  
  /** Get ID from item */
  getId: (item: TItem) => string;
  
  /** Create temporary item for optimistic add */
  createTempItem?: (data: TCreateData) => TItem;
  
  /** Messages */
  messages?: {
    createSuccess?: string;
    createError?: string;
    updateSuccess?: string;
    updateError?: string;
    deleteSuccess?: string;
    deleteError?: string;
  };
}

export interface UseOptimisticListResult<TItem, TCreateData, TUpdateData> {
  /** Add item optimistically */
  add: UseMutationResult<TItem, Error, TCreateData, OptimisticContext<TItem[]>>;
  
  /** Update item optimistically */
  update: UseMutationResult<TItem, Error, { id: string; data: TUpdateData }, OptimisticContext<TItem[]>>;
  
  /** Delete item optimistically */
  remove: UseMutationResult<void, Error, string, OptimisticContext<TItem[]>>;
  
  /** Whether any mutation is pending */
  isPending: boolean;
  
  /** IDs of items currently being mutated */
  pendingIds: Set<string>;
}

/**
 * Hook for optimistic CRUD operations on a list
 * 
 * @example
 * const { add, update, remove, isPending } = useOptimisticList({
 *   queryKey: ['orders'],
 *   api: {
 *     create: (data) => api.post('/orders', data),
 *     update: (id, data) => api.patch(`/orders/${id}`, data),
 *     delete: (id) => api.delete(`/orders/${id}`),
 *   },
 *   getId: (order) => order.id,
 * });
 */
export function useOptimisticList<
  TItem extends Record<string, unknown>,
  TCreateData = Partial<TItem>,
  TUpdateData = Partial<TItem>
>(
  options: UseOptimisticListOptions<TItem, TCreateData, TUpdateData>
): UseOptimisticListResult<TItem, TCreateData, TUpdateData> {
  const { queryKey, api, getId, createTempItem, messages = {} } = options;
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  
  // Generate temporary ID for optimistic adds
  const generateTempId = () => `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  
  // Add mutation
  const add = useOptimisticMutation<TItem, Error, TCreateData, OptimisticContext<TItem[]>, TItem[]>({
    mutationFn: api.create,
    queryKey,
    optimisticUpdate: (items, data) => {
      if (!items) return items as unknown as TItem[];
      
      const tempItem = createTempItem
        ? createTempItem(data)
        : { ...data, id: generateTempId(), _isOptimistic: true } as unknown as TItem;
      
      return [...items, tempItem];
    },
    successMessage: messages.createSuccess || 'Item created successfully',
    errorMessage: messages.createError || 'Failed to create item',
    onOptimisticMutate: () => {
      const tempId = generateTempId();
      setPendingIds((prev) => new Set(prev).add(tempId));
    },
  });
  
  // Update mutation
  const update = useOptimisticMutation<
    TItem,
    Error,
    { id: string; data: TUpdateData },
    OptimisticContext<TItem[]>,
    TItem[]
  >({
    mutationFn: ({ id, data }) => api.update(id, data),
    queryKey,
    optimisticUpdate: (items, { id, data }) => {
      if (!items) return items as unknown as TItem[];
      
      return items.map((item) =>
        getId(item) === id ? { ...item, ...data, _isOptimistic: true } : item
      ) as TItem[];
    },
    successMessage: messages.updateSuccess || 'Item updated successfully',
    errorMessage: messages.updateError || 'Failed to update item',
    onOptimisticMutate: ({ id }) => {
      setPendingIds((prev) => new Set(prev).add(id));
    },
    onOptimisticSettled: (_, __, { id }) => {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    },
  });
  
  // Delete mutation
  const remove = useOptimisticMutation<void, Error, string, OptimisticContext<TItem[]>, TItem[]>({
    mutationFn: api.delete,
    queryKey,
    optimisticUpdate: (items, id) => {
      if (!items) return items as unknown as TItem[];
      return items.filter((item) => getId(item) !== id);
    },
    successMessage: messages.deleteSuccess || 'Item deleted successfully',
    errorMessage: messages.deleteError || 'Failed to delete item',
    onOptimisticMutate: (id) => {
      setPendingIds((prev) => new Set(prev).add(id));
    },
    onOptimisticSettled: (_, __, id) => {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    },
  });
  
  const isPending = (add as UseMutationResult<TItem, Error, TCreateData, OptimisticContext<TItem[]>>).isPending || 
    (update as UseMutationResult<TItem, Error, { id: string; data: TUpdateData }, OptimisticContext<TItem[]>>).isPending || 
    (remove as UseMutationResult<void, Error, string, OptimisticContext<TItem[]>>).isPending;
  
  return {
    add: add as unknown as UseMutationResult<TItem, Error, TCreateData, OptimisticContext<TItem[]>>,
    update: update as unknown as UseMutationResult<TItem, Error, { id: string; data: TUpdateData }, OptimisticContext<TItem[]>>,
    remove: remove as unknown as UseMutationResult<void, Error, string, OptimisticContext<TItem[]>>,
    isPending,
    pendingIds,
  };
}

// ============================================================================
// Hook: useOptimisticToggle
// ============================================================================

export interface UseOptimisticToggleOptions<TItem> {
  /** Query key for the item or list */
  queryKey: QueryKey;
  
  /** API function to toggle */
  toggleFn: (id: string, value: boolean) => Promise<TItem>;
  
  /** Field to toggle */
  field: keyof TItem;
  
  /** Get item from query data (for list queries) */
  getItem?: (data: unknown, id: string) => TItem | undefined;
  
  /** Update item in query data */
  updateItem?: (data: unknown, id: string, update: Partial<TItem>) => unknown;
}

/**
 * Hook for optimistic toggle operations (like/unlike, star/unstar, etc.)
 * 
 * @example
 * const toggleStar = useOptimisticToggle({
 *   queryKey: ['orders'],
 *   toggleFn: (id, starred) => api.patch(`/orders/${id}`, { starred }),
 *   field: 'starred',
 * });
 * 
 * // In component
 * <button onClick={() => toggleStar.mutate({ id: order.id, value: !order.starred })}>
 *   {order.starred ? '★' : '☆'}
 * </button>
 */
export function useOptimisticToggle<TItem extends Record<string, unknown>>(
  options: UseOptimisticToggleOptions<TItem>
) {
  const { queryKey, toggleFn, field, getItem, updateItem } = options;
  
  return useOptimisticMutation<TItem, Error, { id: string; value: boolean }, OptimisticContext<unknown>, unknown>({
    mutationFn: ({ id, value }) => toggleFn(id, value),
    queryKey,
    optimisticUpdate: (data, { id, value }) => {
      if (!data) return data;
      
      // Handle list data
      if (Array.isArray(data)) {
        return data.map((item: TItem) =>
          (item as Record<string, unknown>).id === id
            ? { ...item, [field]: value, _isOptimistic: true }
            : item
        );
      }
      
      // Handle single item
      if (updateItem) {
        return updateItem(data, id, { [field]: value } as Partial<TItem>);
      }
      
      // Default: assume data is the item itself
      if ((data as Record<string, unknown>).id === id) {
        return { ...data, [field]: value, _isOptimistic: true };
      }
      
      return data;
    },
  });
}

// ============================================================================
// Utility: Optimistic Update Helpers
// ============================================================================

/**
 * Helper to create an optimistic add operation
 */
export function optimisticAdd<TItem>(
  items: TItem[] | undefined,
  newItem: TItem,
  position: 'start' | 'end' = 'end'
): TItem[] {
  if (!items) return [newItem];
  return position === 'start' ? [newItem, ...items] : [...items, newItem];
}

/**
 * Helper to create an optimistic update operation
 */
export function optimisticUpdate<TItem extends { id: string }>(
  items: TItem[] | undefined,
  id: string,
  updates: Partial<TItem>
): TItem[] {
  if (!items) return [];
  return items.map((item) =>
    item.id === id ? { ...item, ...updates } : item
  );
}

/**
 * Helper to create an optimistic delete operation
 */
export function optimisticDelete<TItem extends { id: string }>(
  items: TItem[] | undefined,
  id: string
): TItem[] {
  if (!items) return [];
  return items.filter((item) => item.id !== id);
}

/**
 * Helper to create an optimistic reorder operation
 */
export function optimisticReorder<TItem>(
  items: TItem[] | undefined,
  fromIndex: number,
  toIndex: number
): TItem[] {
  if (!items) return [];
  const result = [...items];
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);
  return result;
}

/**
 * Mark item as optimistically updated (for visual styling)
 */
export function markOptimistic<TItem extends Record<string, unknown>>(
  item: TItem
): TItem & { _isOptimistic: true } {
  return { ...item, _isOptimistic: true as const };
}

/**
 * Check if item was optimistically updated
 */
export function isOptimistic(item: Record<string, unknown>): boolean {
  return item._isOptimistic === true;
}
