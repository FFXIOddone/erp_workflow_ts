import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Package,
  FileCheck,
  MessageSquare,
  Clock,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Truck,
} from 'lucide-react';
import { dashboardApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { formatDate, cn } from '@/lib/utils';
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
  PENDING: 'bg-amber-100 text-amber-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  ON_HOLD: 'bg-orange-100 text-orange-700',
  COMPLETED: 'bg-green-100 text-green-700',
  SHIPPED: 'bg-purple-100 text-purple-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

export function DashboardPage() {
  const user = useAuthStore((state) => state.user);

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardApi.get().then((r) => r.data.data),
  });

  const stats = [
    {
      label: 'Active Orders',
      value: data?.stats.activeOrders || 0,
      icon: Package,
      color: 'bg-blue-500',
      href: '/orders?status=IN_PROGRESS',
    },
    {
      label: 'Pending Proofs',
      value: data?.stats.pendingProofs || 0,
      icon: FileCheck,
      color: 'bg-amber-500',
      href: '/proofs',
      urgent: (data?.stats.pendingProofs || 0) > 0,
    },
    {
      label: 'Unread Messages',
      value: data?.stats.unreadMessages || 0,
      icon: MessageSquare,
      color: 'bg-green-500',
      href: '/messages',
    },
    {
      label: 'Completed Orders',
      value: data?.stats.completedOrders || 0,
      icon: CheckCircle2,
      color: 'bg-purple-500',
      href: '/orders?status=COMPLETED',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-2xl p-6 md:p-8 text-white"
      >
        <h1 className="text-2xl md:text-3xl font-bold">
          Welcome back, {user?.firstName}!
        </h1>
        <p className="mt-2 text-primary-100 max-w-2xl">
          Track your orders, review and approve proofs, and communicate with our
          team all from this portal.
        </p>
        
        {(data?.stats.pendingProofs || 0) > 0 && (
          <Link
            to="/proofs"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
          >
            <AlertTriangle className="w-4 h-4" />
            You have {data?.stats.pendingProofs} proof(s) awaiting approval
            <ArrowRight className="w-4 h-4" />
          </Link>
        )}
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Link
              to={stat.href}
              className={cn(
                'card p-5 hover:shadow-md transition-shadow block relative',
                stat.urgent && 'ring-2 ring-amber-400 ring-offset-2'
              )}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-500">{stat.label}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {isLoading ? '-' : stat.value}
                  </p>
                </div>
                <div className={cn('p-2 rounded-lg text-white', stat.color)}>
                  <stat.icon className="w-5 h-5" />
                </div>
              </div>
              {stat.urgent && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full animate-pulse" />
              )}
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Recent Orders */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="card"
      >
        <div className="card-header flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Recent Orders</h2>
          <Link
            to="/orders"
            className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
          >
            View all
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="divide-y divide-gray-100">
          {isLoading ? (
            <div className="p-6 text-center text-gray-500">Loading...</div>
          ) : data?.recentOrders?.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No orders yet. Check back soon!
            </div>
          ) : (
            data?.recentOrders?.map((order: any) => {
              const StatusIcon = statusIcons[order.status] || Clock;
              return (
                <Link
                  key={order.id}
                  to={`/orders/${order.id}`}
                  className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center',
                        statusColors[order.status] || 'bg-gray-100 text-gray-600'
                      )}
                    >
                      <StatusIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        Order #{order.orderNumber}
                      </p>
                      <p className="text-sm text-gray-500 line-clamp-1">
                        {order.description}
                      </p>
                    </div>
                  </div>
                  <div className="text-right hidden sm:block">
                    <span
                      className={cn(
                        'badge',
                        statusColors[order.status] || 'bg-gray-100 text-gray-600'
                      )}
                    >
                      {STATUS_DISPLAY_NAMES[order.status as keyof typeof STATUS_DISPLAY_NAMES] ||
                        order.status}
                    </span>
                    <p className="text-xs text-gray-500 mt-1">
                      Due: {formatDate(order.dueDate)}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400 ml-4" />
                </Link>
              );
            })
          )}
        </div>
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="grid md:grid-cols-3 gap-4"
      >
        <Link
          to="/proofs"
          className="card p-5 hover:shadow-md transition-shadow group"
        >
          <FileCheck className="w-8 h-8 text-amber-500 mb-3" />
          <h3 className="font-semibold text-gray-900 group-hover:text-primary-600">
            Review Proofs
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Approve or request changes to your design proofs
          </p>
        </Link>
        
        <Link
          to="/messages"
          className="card p-5 hover:shadow-md transition-shadow group"
        >
          <MessageSquare className="w-8 h-8 text-green-500 mb-3" />
          <h3 className="font-semibold text-gray-900 group-hover:text-primary-600">
            Send Message
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Communicate directly with our production team
          </p>
        </Link>
        
        <Link
          to="/orders"
          className="card p-5 hover:shadow-md transition-shadow group"
        >
          <Package className="w-8 h-8 text-blue-500 mb-3" />
          <h3 className="font-semibold text-gray-900 group-hover:text-primary-600">
            Track Orders
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            View real-time status updates on your orders
          </p>
        </Link>
      </motion.div>
    </div>
  );
}
