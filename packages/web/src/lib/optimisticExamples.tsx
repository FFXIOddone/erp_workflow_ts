/**
 * Optimistic UI Integration Examples
 * 
 * This file provides practical examples of how to integrate
 * the optimistic update system into your components.
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import {
  useOptimisticMutation,
  useOptimisticList,
  useOptimisticToggle,
  optimisticUpdate,
  isOptimistic,
  useRollbackAnimation,
  RollbackAnimated,
  AnimatedListItem,
  OptimisticContext,
} from '../hooks';
import { useToast } from '../hooks/useNotifications';
import { clsx } from 'clsx';

// ============================================================================
// Types (matching your API)
// ============================================================================

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  status: string;
  priority: string;
  starred: boolean;
  total: number;
  notes?: string;
  updatedAt: string;
  version?: number;
  [key: string]: unknown; // Index signature for Record<string, unknown> compatibility
}

interface CreateOrderInput {
  customerName: string;
  priority: string;
  notes?: string;
  [key: string]: unknown;
}

interface UpdateOrderInput {
  status?: string;
  priority?: string;
  notes?: string;
  starred?: boolean;
  [key: string]: unknown;
}

// ============================================================================
// Example 1: Simple Optimistic Update for Single Field
// ============================================================================

/**
 * Example: Toggle starred status with instant feedback
 */
export function useOrderStarToggle() {
  return useOptimisticToggle<Order>({
    queryKey: ['orders'],
    toggleFn: async (id, starred) => {
      const response = await api.patch<{ data: Order }>(`/orders/${id}`, { starred });
      return response.data.data;
    },
    field: 'starred',
  });
}

// Usage in component:
// const starToggle = useOrderStarToggle();
// <button onClick={() => starToggle.mutate({ id: order.id, value: !order.starred })}>
//   {order.starred ? '★' : '☆'}
// </button>

// ============================================================================
// Example 2: Optimistic Update for Status Change
// ============================================================================

/**
 * Example: Update order status with optimistic UI
 */
export function useUpdateOrderStatus() {
  return useOptimisticMutation<Order, Error, { id: string; status: string }, OptimisticContext<Order[]>, Order[]>({
    mutationFn: async ({ id, status }) => {
      const response = await api.patch<{ data: Order }>(`/orders/${id}`, { status });
      return response.data.data;
    },
    queryKey: ['orders'],
    optimisticUpdate: (orders, { id, status }) => {
      if (!orders) return [] as Order[];
      return orders.map((order) =>
        order.id === id 
          ? { ...order, status, _isOptimistic: true } as Order
          : order
      );
    },
    successMessage: (data) => `Order ${data.orderNumber} updated to ${data.status}`,
    errorMessage: 'Failed to update order status',
  });
}

// ============================================================================
// Example 3: Full CRUD with Optimistic List
// ============================================================================

/**
 * Example: Complete CRUD operations for orders
 */
export function useOrdersCrud() {
  return useOptimisticList<Order, CreateOrderInput, UpdateOrderInput>({
    queryKey: ['orders'],
    api: {
      create: async (data) => {
        const response = await api.post<{ data: Order }>('/orders', data);
        return response.data.data;
      },
      update: async (id, data) => {
        const response = await api.patch<{ data: Order }>(`/orders/${id}`, data);
        return response.data.data;
      },
      delete: async (id) => {
        await api.delete(`/orders/${id}`);
      },
    },
    getId: (order) => order.id,
    createTempItem: (data) => ({
      id: `temp-${Date.now()}`,
      orderNumber: 'NEW',
      customerName: data.customerName,
      status: 'PENDING',
      priority: data.priority,
      starred: false,
      total: 0,
      notes: data.notes,
      updatedAt: new Date().toISOString(),
    }),
    messages: {
      createSuccess: 'Order created successfully',
      createError: 'Failed to create order',
      updateSuccess: 'Order updated',
      updateError: 'Failed to update order',
      deleteSuccess: 'Order deleted',
      deleteError: 'Failed to delete order',
    },
  });
}

// ============================================================================
// Example 4: Optimistic Update with Related Query Invalidation
// ============================================================================

/**
 * Example: Update order and invalidate related queries
 */
export function useUpdateOrderWithRelated() {
  return useOptimisticMutation<Order, Error, { id: string; data: Partial<Order> }, OptimisticContext<Order[]>, Order[]>({
    mutationFn: async ({ id, data }) => {
      const response = await api.patch<{ data: Order }>(`/orders/${id}`, data);
      return response.data.data;
    },
    queryKey: ['orders'],
    optimisticUpdate: (orders, { id, data }) => {
      return optimisticUpdate(orders as Order[], id, data);
    },
    // Also invalidate related queries after success
    invalidateKeys: [
      ['orders', 'stats'],
      ['dashboard', 'summary'],
      ['kanban', 'columns'],
    ],
    successMessage: 'Order updated successfully',
    errorMessage: 'Failed to update order',
  });
}

// ============================================================================
// Example 5: Complete Order List Component with Optimistic UI
// ============================================================================

interface OptimisticOrderListProps {
  className?: string;
}

/**
 * Example component showing full optimistic UI integration
 */
export function OptimisticOrderList({ className }: OptimisticOrderListProps) {
  const toast = useToast();
  const { triggerRollback } = useRollbackAnimation();
  
  // Fetch orders
  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ['orders'],
    queryFn: async () => {
      const response = await api.get<{ data: Order[] }>('/orders');
      return response.data.data;
    },
  });
  
  // CRUD operations
  const { add, update, remove, isPending, pendingIds } = useOrdersCrud();
  
  // Star toggle
  const starToggle = useOrderStarToggle();
  
  // Handle delete with undo
  const handleDelete = async (order: Order) => {
    remove.mutate(order.id, {
      onError: () => {
        // Trigger shake animation on error
        triggerRollback({
          targetId: order.id,
          type: 'fadeRestore',
          message: `Failed to delete ${order.orderNumber}`,
          showUndo: false,
        });
      },
    });
  };
  
  // Handle status change
  const statusMutation = useUpdateOrderStatus();
  
  const handleStatusChange = (order: Order, newStatus: string) => {
    statusMutation.mutate(
      { id: order.id, status: newStatus },
      {
        onError: () => {
          triggerRollback({
            targetId: order.id,
            type: 'shake',
            message: 'Failed to update status',
            showUndo: true,
            undoAction: () => {
              // Could retry or do something else
              toast.info('Undo clicked');
            },
          });
        },
      }
    );
  };
  
  if (isLoading) {
    return <div>Loading orders...</div>;
  }
  
  return (
    <div className={className}>
      {/* Add new order button */}
      <button
        onClick={() => add.mutate({
          customerName: 'New Customer',
          priority: 'NORMAL',
        })}
        disabled={add.isPending}
        className="mb-4 px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
      >
        {add.isPending ? 'Creating...' : 'Add Order'}
      </button>
      
      {/* Order list */}
      <div className="space-y-2">
        {orders.map((order) => {
          const isItemPending = pendingIds.has(order.id);
          const isItemOptimistic = isOptimistic(order);
          
          return (
            <AnimatedListItem
              key={order.id}
              id={order.id}
              isOptimistic={isItemOptimistic}
              className="transition-all duration-200"
            >
              <div
                className={clsx(
                  'p-4 bg-white rounded-lg border',
                  'flex items-center justify-between',
                  isItemOptimistic && 'border-dashed border-blue-300 bg-blue-50',
                  isItemPending && 'opacity-70'
                )}
              >
                <div className="flex items-center gap-4">
                  {/* Star button */}
                  <button
                    onClick={() => starToggle.mutate({
                      id: order.id,
                      value: !order.starred,
                    })}
                    className={clsx(
                      'text-2xl transition-colors',
                      order.starred ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-400'
                    )}
                  >
                    {order.starred ? '★' : '☆'}
                  </button>
                  
                  {/* Order info */}
                  <div>
                    <h3 className="font-medium">
                      {order.orderNumber}
                      {isItemOptimistic && (
                        <span className="ml-2 text-xs text-blue-500">(saving...)</span>
                      )}
                    </h3>
                    <p className="text-sm text-gray-500">{order.customerName}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {/* Status dropdown */}
                  <select
                    value={order.status}
                    onChange={(e) => handleStatusChange(order, e.target.value)}
                    disabled={isItemPending}
                    className="px-3 py-1 border rounded-lg text-sm"
                  >
                    <option value="PENDING">Pending</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="SHIPPED">Shipped</option>
                  </select>
                  
                  {/* Delete button */}
                  <button
                    onClick={() => handleDelete(order)}
                    disabled={isItemPending}
                    className={clsx(
                      'px-3 py-1 text-sm rounded-lg',
                      'text-red-600 hover:bg-red-50',
                      'disabled:opacity-50'
                    )}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </AnimatedListItem>
          );
        })}
      </div>
      
      {/* Global pending indicator */}
      {isPending && (
        <div className="fixed bottom-4 right-4 px-4 py-2 bg-blue-600 text-white rounded-lg shadow-lg">
          Saving changes...
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Example 6: Provider Setup in App.tsx
// ============================================================================

/**
 * Example: How to set up providers in your App.tsx
 * 
 * import { RollbackProvider, ConflictProvider } from './hooks';
 * 
 * function App() {
 *   return (
 *     <QueryClientProvider client={queryClient}>
 *       <ConflictProvider defaultStrategy="manual">
 *         <RollbackProvider defaultUndoTimeout={5000}>
 *           <Routes>
 *             ...
 *           </Routes>
 *         </RollbackProvider>
 *       </ConflictProvider>
 *     </QueryClientProvider>
 *   );
 * }
 */

export default OptimisticOrderList;
