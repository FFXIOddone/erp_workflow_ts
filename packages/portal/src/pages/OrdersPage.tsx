import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Package,
  Search,
  ChevronRight,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Truck,
  Filter,
} from 'lucide-react';
import { ordersApi } from '@/lib/api';
import { formatDate, formatCurrency, cn } from '@/lib/utils';
import { STATUS_DISPLAY_NAMES } from '@erp/shared';

const statusIcons: Record<string, typeof CheckCircle2> = {
  PENDING: Clock,
  IN_PROGRESS: Package,
  ON_HOLD: AlertTriangle,
  COMPLETED: CheckCircle2,
  SHIPPED: Truck,
  CANCELLED: AlertTriangle,
};

const statusColors: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700 border-amber-200',
  IN_PROGRESS: 'bg-blue-100 text-blue-700 border-blue-200',
  ON_HOLD: 'bg-orange-100 text-orange-700 border-orange-200',
  COMPLETED: 'bg-green-100 text-green-700 border-green-200',
  SHIPPED: 'bg-purple-100 text-purple-700 border-purple-200',
  CANCELLED: 'bg-red-100 text-red-700 border-red-200',
};

const statusFilters = [
  { value: '', label: 'All Orders' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'SHIPPED', label: 'Shipped' },
];

export function OrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const status = searchParams.get('status') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);

  const { data, isLoading } = useQuery({
    queryKey: ['orders', { status, page }],
    queryFn: () =>
      ordersApi.list({ status: status || undefined, page, pageSize: 10 }).then((r) => r.data.data),
  });

  const orders = data?.orders || [];
  const pagination = data?.pagination;

  const filteredOrders = search
    ? orders.filter(
        (order: any) =>
          order.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
          order.description?.toLowerCase().includes(search.toLowerCase())
      )
    : orders;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Orders</h1>
        <p className="mt-1 text-gray-500">
          Track the status and progress of all your orders
        </p>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search orders..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={status}
              onChange={(e) => {
                const newParams = new URLSearchParams(searchParams);
                if (e.target.value) {
                  newParams.set('status', e.target.value);
                } else {
                  newParams.delete('status');
                }
                newParams.delete('page');
                setSearchParams(newParams);
              }}
              className="input w-auto"
            >
              {statusFilters.map((filter) => (
                <option key={filter.value} value={filter.value}>
                  {filter.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="card p-12 text-center text-gray-500">
            Loading orders...
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="card p-12 text-center">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No orders found</h3>
            <p className="mt-1 text-gray-500">
              {status
                ? `No ${STATUS_DISPLAY_NAMES[status as keyof typeof STATUS_DISPLAY_NAMES]?.toLowerCase()} orders`
                : 'You don\'t have any orders yet'}
            </p>
          </div>
        ) : (
          filteredOrders.map((order: any, index: number) => {
            const StatusIcon = statusIcons[order.status] || Clock;
            return (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Link
                  to={`/orders/${order.id}`}
                  className="card p-5 hover:shadow-md transition-all block group"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    {/* Order Info */}
                    <div className="flex items-start gap-4 flex-1">
                      <div
                        className={cn(
                          'w-12 h-12 rounded-xl flex items-center justify-center shrink-0',
                          statusColors[order.status] || 'bg-gray-100 text-gray-600'
                        )}
                      >
                        <StatusIcon className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h3 className="font-semibold text-gray-900 group-hover:text-primary-600">
                            Order #{order.orderNumber}
                          </h3>
                          <span
                            className={cn(
                              'badge border',
                              statusColors[order.status] || 'bg-gray-100 text-gray-600'
                            )}
                          >
                            {STATUS_DISPLAY_NAMES[order.status as keyof typeof STATUS_DISPLAY_NAMES] ||
                              order.status}
                          </span>
                          {order.pendingProofs > 0 && (
                            <span className="badge bg-amber-100 text-amber-700 border border-amber-200">
                              {order.pendingProofs} proof(s) pending
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mt-1 line-clamp-1">
                          {order.description}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-sm">
                          <span className="text-gray-500">
                            Due: <span className="font-medium text-gray-700">{formatDate(order.dueDate)}</span>
                          </span>
                          <span className="text-gray-500">
                            Total: <span className="font-medium text-gray-700">{formatCurrency(order.total)}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Progress */}
                    <div className="lg:w-48 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Progress</span>
                        <span className="font-medium text-gray-900">
                          {order.progress}%
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-primary-500 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${order.progress}%` }}
                          transition={{ duration: 0.5, ease: 'easeOut' }}
                        />
                      </div>
                    </div>

                    {/* Arrow */}
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-primary-600 hidden lg:block" />
                  </div>
                </Link>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => {
              const newParams = new URLSearchParams(searchParams);
              newParams.set('page', String(page - 1));
              setSearchParams(newParams);
            }}
            disabled={page <= 1}
            className="btn btn-secondary"
          >
            Previous
          </button>
          <span className="px-4 text-sm text-gray-600">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => {
              const newParams = new URLSearchParams(searchParams);
              newParams.set('page', String(page + 1));
              setSearchParams(newParams);
            }}
            disabled={page >= pagination.totalPages}
            className="btn btn-secondary"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
