import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCw,
  Search,
  Filter,
  Calendar,
  Pause,
  Play,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  DollarSign,
} from 'lucide-react';
import { recurringOrdersApi } from '@/lib/api';
import { formatDate, formatCurrency, cn } from '@/lib/utils';

// Frequency display names
const FREQUENCY_DISPLAY: Record<string, string> = {
  WEEKLY: 'Weekly',
  BIWEEKLY: 'Every 2 Weeks',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  SEMIANNUALLY: 'Every 6 Months',
  YEARLY: 'Yearly',
  CUSTOM: 'Custom',
};

// Status config
function getSubscriptionStatus(sub: any): { label: string; color: string; icon: typeof CheckCircle2 } {
  if (!sub.isActive) {
    return { label: 'Inactive', color: 'bg-gray-100 text-gray-600', icon: AlertTriangle };
  }
  if (sub.isPaused) {
    return { label: 'Paused', color: 'bg-amber-100 text-amber-700', icon: Pause };
  }
  return { label: 'Active', color: 'bg-green-100 text-green-700', icon: CheckCircle2 };
}

interface RecurringOrder {
  id: string;
  name: string;
  description: string | null;
  frequency: string;
  customDays: number | null;
  startDate: string;
  endDate: string | null;
  nextGenerateDate: string;
  lastGeneratedAt: string | null;
  isActive: boolean;
  isPaused: boolean;
  pausedReason: string | null;
  discountPercent: number | null;
  lineItems: {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
  }[];
  generatedOrders: {
    id: string;
    orderNumber: string;
    status: string;
    createdAt: string;
  }[];
}

export function SubscriptionsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [pauseModalOpen, setPauseModalOpen] = useState<string | null>(null);
  const [pauseReason, setPauseReason] = useState('');
  const queryClient = useQueryClient();

  const { data: subscriptions = [], isLoading } = useQuery({
    queryKey: ['recurring-orders'],
    queryFn: () => recurringOrdersApi.list().then((r) => r.data.data),
  });

  const pauseMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      recurringOrdersApi.pause(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-orders'] });
      setPauseModalOpen(null);
      setPauseReason('');
    },
  });

  const resumeMutation = useMutation({
    mutationFn: (id: string) => recurringOrdersApi.resume(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-orders'] });
    },
  });

  // Filter subscriptions
  const filteredSubscriptions = (subscriptions as RecurringOrder[]).filter((sub) => {
    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      const matchesName = sub.name.toLowerCase().includes(searchLower);
      const matchesDesc = sub.description?.toLowerCase().includes(searchLower);
      if (!matchesName && !matchesDesc) {
        return false;
      }
    }

    // Status filter
    if (statusFilter === 'active' && (sub.isPaused || !sub.isActive)) return false;
    if (statusFilter === 'paused' && !sub.isPaused) return false;
    if (statusFilter === 'inactive' && sub.isActive) return false;

    return true;
  });

  // Calculate stats
  const stats = {
    active: subscriptions.filter((s: RecurringOrder) => s.isActive && !s.isPaused).length,
    paused: subscriptions.filter((s: RecurringOrder) => s.isPaused).length,
    total: subscriptions.length,
  };

  // Calculate total monthly value (approximate)
  const calculateMonthlyValue = (sub: RecurringOrder): number => {
    const total = sub.lineItems.reduce((sum, li) => sum + li.quantity * Number(li.unitPrice), 0);
    const multipliers: Record<string, number> = {
      WEEKLY: 4.33,
      BIWEEKLY: 2.17,
      MONTHLY: 1,
      QUARTERLY: 0.33,
      SEMIANNUALLY: 0.17,
      YEARLY: 0.083,
    };
    return total * (multipliers[sub.frequency] || 1);
  };

  const totalMonthlyValue = subscriptions
    .filter((s: RecurringOrder) => s.isActive && !s.isPaused)
    .reduce((sum: number, s: RecurringOrder) => sum + calculateMonthlyValue(s), 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">Loading subscriptions...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Recurring Orders</h1>
        <p className="mt-1 text-gray-500">Manage your subscriptions and recurring order schedules</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl border border-gray-200 p-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Active</p>
              <p className="text-xl font-bold text-gray-900">{stats.active}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl border border-gray-200 p-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-50 rounded-lg">
              <Pause className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Paused</p>
              <p className="text-xl font-bold text-gray-900">{stats.paused}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-xl border border-gray-200 p-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-50 rounded-lg">
              <RefreshCw className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total</p>
              <p className="text-xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-xl border border-gray-200 p-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Monthly Value</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(totalMonthlyValue)}</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search subscriptions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="all">All Subscriptions</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Subscriptions List */}
      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {filteredSubscriptions.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-12"
            >
              <RefreshCw className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900">No subscriptions found</h3>
              <p className="text-gray-500 mt-1">
                {subscriptions.length === 0
                  ? 'You don\'t have any recurring orders set up yet.'
                  : 'Try adjusting your search or filter.'}
              </p>
              <p className="text-sm text-gray-400 mt-4">
                Contact us to set up a recurring order for your regular needs.
              </p>
              <Link to="/messages" className="btn btn-primary mt-4">
                Contact Us
              </Link>
            </motion.div>
          ) : (
            filteredSubscriptions.map((sub, index) => {
              const statusConfig = getSubscriptionStatus(sub);
              const StatusIcon = statusConfig.icon;
              const orderTotal = sub.lineItems.reduce(
                (sum, li) => sum + li.quantity * Number(li.unitPrice),
                0
              );

              return (
                <motion.div
                  key={sub.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1">
                        <div className="p-3 bg-primary-50 rounded-xl">
                          <RefreshCw className="w-6 h-6 text-primary-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-gray-900">{sub.name}</h3>
                            <span className={cn('badge text-xs', statusConfig.color)}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {statusConfig.label}
                            </span>
                          </div>
                          {sub.description && (
                            <p className="text-sm text-gray-500 mt-1">{sub.description}</p>
                          )}

                          {/* Schedule Info */}
                          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-gray-500">
                            <div className="flex items-center gap-1">
                              <RefreshCw className="w-4 h-4" />
                              <span>{FREQUENCY_DISPLAY[sub.frequency] || sub.frequency}</span>
                              {sub.frequency === 'CUSTOM' && sub.customDays && (
                                <span className="text-gray-400">({sub.customDays} days)</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              <span>Next: {formatDate(sub.nextGenerateDate)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <DollarSign className="w-4 h-4" />
                              <span>{formatCurrency(orderTotal)} per order</span>
                            </div>
                          </div>

                          {/* Paused reason */}
                          {sub.isPaused && sub.pausedReason && (
                            <div className="mt-2 text-sm text-amber-600 bg-amber-50 px-3 py-1 rounded-lg inline-block">
                              Reason: {sub.pausedReason}
                            </div>
                          )}

                          {/* Line Items Preview */}
                          <div className="mt-3">
                            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">
                              Items ({sub.lineItems.length})
                            </p>
                            <div className="space-y-1">
                              {sub.lineItems.slice(0, 2).map((item) => (
                                <div key={item.id} className="text-sm text-gray-600 flex justify-between">
                                  <span>{item.description}</span>
                                  <span className="text-gray-400">
                                    {item.quantity} × {formatCurrency(Number(item.unitPrice))}
                                  </span>
                                </div>
                              ))}
                              {sub.lineItems.length > 2 && (
                                <p className="text-xs text-gray-400">
                                  +{sub.lineItems.length - 2} more items
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Recent Orders */}
                          {sub.generatedOrders.length > 0 && (
                            <div className="mt-3">
                              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">
                                Recent Orders
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {sub.generatedOrders.slice(0, 3).map((order) => (
                                  <Link
                                    key={order.id}
                                    to={`/orders/${order.id}`}
                                    className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-600 transition-colors"
                                  >
                                    #{order.orderNumber}
                                  </Link>
                                ))}
                                {sub.generatedOrders.length > 3 && (
                                  <span className="text-xs text-gray-400">
                                    +{sub.generatedOrders.length - 3} more
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col items-end gap-2">
                        {sub.isActive && !sub.isPaused && (
                          <button
                            onClick={() => setPauseModalOpen(sub.id)}
                            disabled={pauseMutation.isPending}
                            className="btn btn-outline text-sm text-amber-600 hover:bg-amber-50 border-amber-200"
                          >
                            <Pause className="w-4 h-4 mr-1" />
                            Pause
                          </button>
                        )}
                        {sub.isPaused && (
                          <button
                            onClick={() => resumeMutation.mutate(sub.id)}
                            disabled={resumeMutation.isPending}
                            className="btn btn-primary text-sm"
                          >
                            <Play className="w-4 h-4 mr-1" />
                            Resume
                          </button>
                        )}
                        <Link
                          to={`/subscriptions/${sub.id}`}
                          className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
                        >
                          View Details
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {/* Pause Modal */}
      <AnimatePresence>
        {pauseModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setPauseModalOpen(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-xl max-w-md w-full p-6"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Pause Subscription</h3>
              <p className="text-gray-500 text-sm mb-4">
                Are you sure you want to pause this recurring order? You can resume it at any time.
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason (optional)
                </label>
                <input
                  type="text"
                  value={pauseReason}
                  onChange={(e) => setPauseReason(e.target.value)}
                  placeholder="e.g., Temporary office closure"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setPauseModalOpen(null);
                    setPauseReason('');
                  }}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
                <button
                  onClick={() => pauseMutation.mutate({ id: pauseModalOpen, reason: pauseReason })}
                  disabled={pauseMutation.isPending}
                  className="btn bg-amber-500 hover:bg-amber-600 text-white"
                >
                  {pauseMutation.isPending ? 'Pausing...' : 'Pause Subscription'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Info Banner */}
      {subscriptions.length > 0 && (
        <div className="bg-blue-50 rounded-xl p-6 border border-blue-100">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">About Recurring Orders</h3>
          <p className="text-blue-700 text-sm mb-2">
            Recurring orders are automatically generated based on your schedule. You'll receive an
            email notification before each order is created.
          </p>
          <p className="text-blue-600 text-sm">
            Need to modify your subscription? Contact us and we'll help you adjust your order.
          </p>
          <Link to="/messages" className="btn btn-primary text-sm mt-4">
            Contact Support
          </Link>
        </div>
      )}
    </div>
  );
}

export default SubscriptionsPage;
