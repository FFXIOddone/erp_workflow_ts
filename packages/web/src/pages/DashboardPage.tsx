import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  ClipboardList,
  Clock,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  ArrowRight,
  CalendarDays,
  Filter,
  CalendarClock,
  AlertTriangle,
  Search,
  DollarSign,
  FileText,
  Wrench,
  Columns3,
  Calendar,
  BarChart3,
  Package,
  Truck,
  Users,
} from 'lucide-react';
import { api } from '../lib/api';
import { STATUS_DISPLAY_NAMES, STATUS_COLORS, PRIORITY_LABELS, UserRole, PrintingMethod, STATION_DISPLAY_NAMES } from '@erp/shared';
import { useAuthStore } from '../stores/auth';
import { RoutingIntelligenceCard } from '../components/RoutingIntelligenceCard';

interface DashboardStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  onHold: number;
  dueToday: number;
  overdue: number;
}

export function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const [quickSearch, setQuickSearch] = useState('');
  
  // Operators only see orders for their stations, admins/managers see all
  const isOperator = user?.role === UserRole.OPERATOR;
  
  // Check if user can create orders (Order Entry station, Managers, or Admins)
  const canCreateOrder = user?.role === UserRole.ADMIN || 
    user?.role === UserRole.MANAGER || 
    user?.allowedStations?.includes(PrintingMethod.ORDER_ENTRY);
  
  // Fetch stats from lightweight server endpoint (counts only, no full orders)
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['orders', 'stats'],
    queryFn: () => api.get('/orders/stats').then(r => r.data.data as DashboardStats & { shipped: number; cancelled: number }),
  });

  // Fetch only urgent and due-today orders (small set)
  const { data: urgentData } = useQuery({
    queryKey: ['orders', 'urgent-dashboard', isOperator ? 'myStations' : 'all'],
    queryFn: async () => {
      const params: Record<string, unknown> = {
        pageSize: 10,
        sortBy: 'priority',
        sortOrder: 'desc',
        lightweight: true,
        ...(isOperator ? { myStations: true } : {}),
      };
      const response = await api.get('/orders', { params });
      const orders = response.data.data.items;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const urgentOrders = orders
        .filter(
          (o: { priority: number; status: string }) =>
            o.priority >= 4 && !['COMPLETED', 'SHIPPED', 'CANCELLED'].includes(o.status)
        )
        .sort((a: { priority: number }, b: { priority: number }) => b.priority - a.priority)
        .slice(0, 5);

      const dueTodayOrders = orders.filter((o: { dueDate: string | null; status: string }) => {
        if (!o.dueDate || ['COMPLETED', 'SHIPPED', 'CANCELLED'].includes(o.status)) return false;
        const due = new Date(o.dueDate);
        due.setHours(0, 0, 0, 0);
        return due.getTime() === today.getTime();
      });

      return { urgentOrders, dueTodayOrders };
    },
  });

  const isLoading = statsLoading;
  const safeStats = stats ?? { total: 0, pending: 0, inProgress: 0, completed: 0, onHold: 0, dueToday: 0, overdue: 0 };
  const dueTodayOrders = urgentData?.dueTodayOrders ?? [];
  const urgentOrders = urgentData?.urgentOrders ?? [];

  const statCards = [
    { name: 'Total Orders', value: safeStats.total, icon: ClipboardList, color: 'bg-gradient-to-br from-blue-500 to-blue-600', bgColor: 'bg-blue-50', link: '/orders' },
    { name: 'Due Today', value: safeStats.dueToday, icon: CalendarClock, color: 'bg-gradient-to-br from-purple-500 to-purple-600', bgColor: 'bg-purple-50', link: '/orders?filter=dueToday' },
    { name: 'Overdue', value: safeStats.overdue, icon: AlertTriangle, color: 'bg-gradient-to-br from-red-500 to-red-600', bgColor: 'bg-red-50', link: '/orders?filter=overdue' },
    { name: 'In Progress', value: safeStats.inProgress, icon: TrendingUp, color: 'bg-gradient-to-br from-cyan-500 to-cyan-600', bgColor: 'bg-cyan-50', link: '/orders?status=IN_PROGRESS' },
    { name: 'Pending', value: safeStats.pending, icon: Clock, color: 'bg-gradient-to-br from-amber-500 to-amber-600', bgColor: 'bg-amber-50', link: '/orders?status=PENDING' },
  ];

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
            {getGreeting()}, {user?.displayName?.split(' ')[0] ?? 'there'}!
          </h1>
          <p className="text-gray-500 mt-1">
            {isOperator && user?.allowedStations?.length ? (
              <span className="flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5" />
                Showing orders for: {user.allowedStations.map(s => STATION_DISPLAY_NAMES[s]).join(', ')}
              </span>
            ) : (
              "Here's what's happening with your orders today."
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Quick Search */}
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              if (quickSearch.trim()) {
                navigate(`/orders?search=${encodeURIComponent(quickSearch.trim())}`);
              }
            }}
            className="relative"
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={quickSearch}
              onChange={(e) => setQuickSearch(e.target.value)}
              placeholder="Quick search orders..."
              className="w-48 lg:w-64 pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-sm"
            />
          </form>
          {canCreateOrder && (
            <Link
              to="/orders/new"
              className="inline-flex items-center justify-center px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium shadow-sm"
            >
              <ClipboardList className="h-4 w-4 mr-2" />
              New Order
            </Link>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        {isLoading ? (
          // Skeleton loading state
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-4 lg:p-5 border border-gray-100 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-200 rounded-lg" />
                <div className="flex-1">
                  <div className="h-3 bg-gray-200 rounded w-16 mb-2" />
                  <div className="h-6 bg-gray-200 rounded w-12" />
                </div>
              </div>
            </div>
          ))
        ) : (
          statCards.map((stat, index) => (
            <Link
              key={stat.name}
              to={stat.link}
              className={`stat-card ${stat.bgColor} rounded-xl p-4 lg:p-5 transition-all hover:shadow-lg hover:-translate-y-0.5 cursor-pointer`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-center gap-3">
                <div className={`${stat.color} p-2.5 rounded-lg shadow-sm`}>
                  <stat.icon className="h-5 w-5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-gray-500 truncate">{stat.name}</p>
                  <p className="text-xl lg:text-2xl font-bold text-gray-900">
                    {stat.value.toLocaleString()}
                  </p>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>

      {/* Quick Navigation */}
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
        {[
          { name: 'Kanban', icon: Columns3, to: '/kanban', color: 'text-blue-600 bg-blue-50' },
          { name: 'Sales', icon: DollarSign, to: '/sales', color: 'text-green-600 bg-green-50' },
          { name: 'Quotes', icon: FileText, to: '/sales/quotes', color: 'text-indigo-600 bg-indigo-50' },
          { name: 'Equipment', icon: Wrench, to: '/equipment', color: 'text-orange-600 bg-orange-50' },
          { name: 'Schedule', icon: Calendar, to: '/schedule', color: 'text-purple-600 bg-purple-50' },
          { name: 'Reports', icon: BarChart3, to: '/reports', color: 'text-cyan-600 bg-cyan-50' },
          { name: 'Inventory', icon: Package, to: '/inventory', color: 'text-amber-600 bg-amber-50' },
          { name: 'Shipping', icon: Truck, to: '/shipments', color: 'text-teal-600 bg-teal-50' },
        ].map((item) => (
          <Link
            key={item.name}
            to={item.to}
            className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all group"
          >
            <div className={`p-2 rounded-lg ${item.color} group-hover:scale-110 transition-transform`}>
              <item.icon className="h-4 w-4" />
            </div>
            <span className="text-xs font-medium text-gray-600 group-hover:text-gray-900 transition-colors">{item.name}</span>
          </Link>
        ))}
      </div>

      <RoutingIntelligenceCard />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Due Today Orders */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b flex justify-between items-center bg-gradient-to-r from-purple-50 to-white">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-purple-500" />
              Due Today
              {dueTodayOrders.length > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs font-bold bg-purple-100 text-purple-700 rounded-full">
                  {dueTodayOrders.length}
                </span>
              )}
            </h2>
            <Link
              to="/orders?filter=dueToday"
              className="text-sm text-primary-600 hover:text-primary-700 font-medium inline-flex items-center gap-1 group"
            >
              View all <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {isLoading ? (
              // Skeleton loading for orders
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-5 py-3.5 animate-pulse">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
                      <div className="h-3 bg-gray-100 rounded w-32" />
                    </div>
                    <div className="h-6 bg-gray-200 rounded-full w-20" />
                  </div>
                </div>
              ))
            ) : dueTodayOrders.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-3" />
                <p className="text-gray-500">No orders due today!</p>
                <Link to="/orders" className="text-primary-600 hover:text-primary-700 text-sm font-medium mt-2 inline-block">
                  View all orders →
                </Link>
              </div>
            ) : (
              dueTodayOrders.slice(0, 8).map((order: { id: string; orderNumber: string; customerName: string; companyId?: string | null; customerId?: string | null; description: string; status: string; priority: number; dueDate: string | null }) => (
                <Link
                  key={order.id}
                  to={`/orders/${order.id}`}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900">#{order.orderNumber}</p>
                      {order.priority >= 4 && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-red-100 text-red-700 rounded">
                          {order.priority === 5 ? 'URGENT' : 'HIGH'}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 truncate">
                      {order.companyId ? (
                        <Link to={`/companies/${order.companyId}`} className="hover:text-primary-600 hover:underline transition-colors" onClick={(e) => e.stopPropagation()}>
                          {order.customerName}
                        </Link>
                      ) : order.customerId ? (
                        <Link to={`/sales/customers/${order.customerId}`} className="hover:text-primary-600 hover:underline transition-colors" onClick={(e) => e.stopPropagation()}>
                          {order.customerName}
                        </Link>
                      ) : (
                        order.customerName
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className="px-2.5 py-1 text-xs font-medium rounded-full whitespace-nowrap"
                      style={{
                        backgroundColor: `${STATUS_COLORS[order.status]}15`,
                        color: STATUS_COLORS[order.status],
                      }}
                    >
                      {STATUS_DISPLAY_NAMES[order.status]}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Urgent Orders Sidebar */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b bg-gradient-to-r from-red-50 to-white">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Needs Attention
              {urgentOrders.length > 0 && (
                <span className="ml-auto px-2 py-0.5 text-xs font-bold bg-red-100 text-red-700 rounded-full">
                  {urgentOrders.length}
                </span>
              )}
            </h2>
          </div>
          <div className="divide-y divide-gray-50">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="px-5 py-3.5 animate-pulse">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="h-4 bg-gray-200 rounded w-20 mb-2" />
                      <div className="h-3 bg-gray-100 rounded w-28" />
                    </div>
                    <div className="h-5 bg-red-100 rounded w-16" />
                  </div>
                </div>
              ))
            ) : urgentOrders.length === 0 ? (
              <div className="p-6 text-center">
                <CheckCircle className="h-10 w-10 text-green-400 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No urgent orders!</p>
              </div>
            ) : (
              urgentOrders.map((order: { id: string; orderNumber: string; customerName: string; companyId?: string | null; customerId?: string | null; priority: number; dueDate: string | null }) => (
                <Link
                  key={order.id}
                  to={`/orders/${order.id}`}
                  className="block px-5 py-3.5 hover:bg-red-50/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">#{order.orderNumber}</p>
                      <p className="text-sm text-gray-500">
                        {order.companyId ? (
                          <Link to={`/companies/${order.companyId}`} className="hover:text-primary-600 hover:underline transition-colors" onClick={(e) => e.stopPropagation()}>
                            {order.customerName}
                          </Link>
                        ) : order.customerId ? (
                          <Link to={`/sales/customers/${order.customerId}`} className="hover:text-primary-600 hover:underline transition-colors" onClick={(e) => e.stopPropagation()}>
                            {order.customerName}
                          </Link>
                        ) : (
                          order.customerName
                        )}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                      order.priority === 5 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {PRIORITY_LABELS[order.priority]}
                    </span>
                  </div>
                  {order.dueDate && (
                    <p className="text-xs text-gray-400 mt-1">
                      Due: {new Date(order.dueDate).toLocaleDateString()}
                    </p>
                  )}
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
