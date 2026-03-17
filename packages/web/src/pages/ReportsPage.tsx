import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  BarChart3, TrendingUp, Clock, Users, CheckCircle, AlertTriangle,
  Calendar, PieChart, Activity, Timer, ChevronDown, ArrowRight
} from 'lucide-react';
import { api } from '../lib/api';
import { 
  STATUS_DISPLAY_NAMES, STATUS_COLORS, PRIORITY_LABELS, PRIORITY_COLORS,
  STATION_DISPLAY_NAMES 
} from '@erp/shared';

type Period = 'today' | 'week' | 'month' | 'quarter' | 'year';

interface OverviewData {
  period: string;
  dateRange: { start: string; end: string };
  orders: {
    total: number;
    completed: number;
    pending: number;
    inProgress: number;
    cancelled: number;
    overdue: number;
    completionRate: number;
  };
  time: {
    totalHoursLogged: number;
    avgHoursToComplete: number;
  };
}

interface StatusData {
  status: string;
  count: number;
}

interface StationData {
  station: string;
  count: number;
}

interface PriorityData {
  priority: number;
  count: number;
}

interface TrendData {
  date: string;
  count: number;
}

interface ProductivityData {
  userId: string;
  userName: string;
  totalHours: number;
  entriesCount: number;
}

interface StationPerformanceData {
  station: string;
  totalHours: number;
  entriesCount: number;
}

export function ReportsPage() {
  const [period, setPeriod] = useState<Period>('month');

  // Fetch overview stats
  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['reports', 'overview', period],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: OverviewData }>(`/reports/overview?period=${period}`);
      return res.data.data;
    },
  });

  // Fetch orders by status
  const { data: statusData } = useQuery({
    queryKey: ['reports', 'orders-by-status', period],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: StatusData[] }>(`/reports/orders-by-status?period=${period}`);
      return res.data.data;
    },
  });

  // Fetch orders by station
  const { data: stationData } = useQuery({
    queryKey: ['reports', 'orders-by-station', period],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: StationData[] }>(`/reports/orders-by-station?period=${period}`);
      return res.data.data;
    },
  });

  // Fetch orders by priority
  const { data: priorityData } = useQuery({
    queryKey: ['reports', 'orders-by-priority', period],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: PriorityData[] }>(`/reports/orders-by-priority?period=${period}`);
      return res.data.data;
    },
  });

  // Fetch order trend
  const { data: trendData } = useQuery({
    queryKey: ['reports', 'orders-trend', period],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: TrendData[] }>(`/reports/orders-trend?period=${period}`);
      return res.data.data;
    },
  });

  // Fetch user productivity
  const { data: productivityData } = useQuery({
    queryKey: ['reports', 'user-productivity', period],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: ProductivityData[] }>(`/reports/user-productivity?period=${period}`);
      return res.data.data;
    },
  });

  // Fetch station performance
  const { data: stationPerfData } = useQuery({
    queryKey: ['reports', 'station-performance', period],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: StationPerformanceData[] }>(`/reports/station-performance?period=${period}`);
      return res.data.data;
    },
  });

  const periodLabels: Record<Period, string> = {
    today: 'Today',
    week: 'Last 7 Days',
    month: 'Last 30 Days',
    quarter: 'Last 3 Months',
    year: 'Last 12 Months',
  };

  // Calculate max for bar chart scaling
  const maxTrend = Math.max(...(trendData?.map(t => t.count) || [1]));
  const maxStation = Math.max(...(stationData?.map(s => s.count) || [1]));
  const maxProductivity = Math.max(...(productivityData?.map(p => p.totalHours) || [1]));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-gray-500 mt-1">Production performance insights</p>
        </div>
        
        {/* Period Selector */}
        <div className="flex items-center gap-3">
          <Link
            to="/reports/advanced"
            className="btn-primary text-sm flex items-center gap-2"
          >
            <PieChart className="h-4 w-4" />
            Business Intelligence
            <ArrowRight className="h-4 w-4" />
          </Link>
          <div className="relative">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as Period)}
              className="appearance-none bg-white border border-gray-200 rounded-lg px-4 py-2 pr-10 text-sm font-medium text-gray-700 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
            >
              {Object.entries(periodLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Overview Stats */}
      {overviewLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-4 shadow-sm animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
              <div className="h-8 bg-gray-200 rounded w-16" />
            </div>
          ))}
        </div>
      ) : overview && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Orders"
            value={overview.orders.total}
            icon={BarChart3}
            color="bg-blue-500"
          />
          <StatCard
            title="Completed"
            value={overview.orders.completed}
            icon={CheckCircle}
            color="bg-green-500"
            subtitle={`${overview.orders.completionRate}% rate`}
          />
          <StatCard
            title="In Progress"
            value={overview.orders.inProgress}
            icon={Activity}
            color="bg-amber-500"
          />
          <StatCard
            title="Pending"
            value={overview.orders.pending}
            icon={Clock}
            color="bg-gray-500"
          />
          <StatCard
            title="Overdue"
            value={overview.orders.overdue}
            icon={AlertTriangle}
            color="bg-red-500"
            highlight={overview.orders.overdue > 0}
          />
          <StatCard
            title="Cancelled"
            value={overview.orders.cancelled}
            icon={Calendar}
            color="bg-gray-400"
          />
          <StatCard
            title="Hours Logged"
            value={overview.time.totalHoursLogged}
            icon={Timer}
            color="bg-purple-500"
            suffix="hrs"
          />
          <StatCard
            title="Avg. Completion"
            value={overview.time.avgHoursToComplete}
            icon={TrendingUp}
            color="bg-indigo-500"
            suffix="hrs"
          />
        </div>
      )}

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Orders Trend */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary-500" />
            Orders Over Time
          </h3>
          {trendData && trendData.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-end gap-1 h-40">
                {trendData.map((item, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-primary-500 rounded-t hover:bg-primary-600 transition-colors group relative"
                    style={{ height: `${(item.count / maxTrend) * 100}%`, minHeight: item.count > 0 ? '8px' : '2px' }}
                  >
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                      {item.count} orders
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>{trendData[0]?.date}</span>
                <span>{trendData[trendData.length - 1]?.date}</span>
              </div>
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-gray-400">
              No data for this period
            </div>
          )}
        </div>

        {/* Orders by Status */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <PieChart className="h-5 w-5 text-primary-500" />
            Orders by Status
          </h3>
          {statusData && statusData.length > 0 ? (
            <div className="space-y-3">
              {statusData.map((item) => (
                <div key={item.status} className="flex items-center gap-3">
                  <div 
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: STATUS_COLORS[item.status] }}
                  />
                  <span className="text-sm text-gray-600 flex-1">
                    {STATUS_DISPLAY_NAMES[item.status] || item.status}
                  </span>
                  <span className="text-sm font-semibold text-gray-900">{item.count}</span>
                  <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all"
                      style={{ 
                        width: `${(item.count / (overview?.orders.total || 1)) * 100}%`,
                        backgroundColor: STATUS_COLORS[item.status],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-gray-400">
              No data for this period
            </div>
          )}
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Orders by Station */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary-500" />
            Orders by Station
          </h3>
          {stationData && stationData.length > 0 ? (
            <div className="space-y-3">
              {stationData.map((item) => (
                <div key={item.station} className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 w-28 flex-shrink-0 truncate">
                    {STATION_DISPLAY_NAMES[item.station] || item.station}
                  </span>
                  <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-primary-500 to-primary-400 rounded transition-all flex items-center justify-end pr-2"
                      style={{ width: `${(item.count / maxStation) * 100}%`, minWidth: '40px' }}
                    >
                      <span className="text-xs font-semibold text-white">{item.count}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-gray-400">
              No data for this period
            </div>
          )}
        </div>

        {/* Orders by Priority */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-primary-500" />
            Orders by Priority
          </h3>
          {priorityData && priorityData.length > 0 ? (
            <div className="space-y-3">
              {priorityData.map((item) => (
                <div key={item.priority} className="flex items-center gap-3">
                  <div 
                    className="w-3 h-3 rounded flex-shrink-0"
                    style={{ backgroundColor: PRIORITY_COLORS[item.priority] }}
                  />
                  <span className="text-sm text-gray-600 w-20">
                    {PRIORITY_LABELS[item.priority]}
                  </span>
                  <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden">
                    <div 
                      className="h-full rounded transition-all flex items-center justify-end pr-2"
                      style={{ 
                        width: `${(item.count / (overview?.orders.total || 1)) * 100}%`, 
                        minWidth: '40px',
                        backgroundColor: PRIORITY_COLORS[item.priority],
                      }}
                    >
                      <span className="text-xs font-semibold text-white">{item.count}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-gray-400">
              No data for this period
            </div>
          )}
        </div>
      </div>

      {/* Charts Row 3 - Productivity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Productivity */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-primary-500" />
            Time Logged by User
          </h3>
          {productivityData && productivityData.length > 0 ? (
            <div className="space-y-3">
              {productivityData.slice(0, 8).map((item) => (
                <div key={item.userId} className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 w-28 flex-shrink-0 truncate">
                    {item.userName}
                  </span>
                  <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-purple-500 to-purple-400 rounded transition-all flex items-center justify-end pr-2"
                      style={{ width: `${(item.totalHours / maxProductivity) * 100}%`, minWidth: '50px' }}
                    >
                      <span className="text-xs font-semibold text-white">{item.totalHours}h</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-gray-400">
              No time entries for this period
            </div>
          )}
        </div>

        {/* Station Time */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Timer className="h-5 w-5 text-primary-500" />
            Time by Station
          </h3>
          {stationPerfData && stationPerfData.length > 0 ? (
            <div className="space-y-3">
              {stationPerfData.map((item) => (
                <div key={item.station} className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 w-28 flex-shrink-0 truncate">
                    {STATION_DISPLAY_NAMES[item.station] || item.station}
                  </span>
                  <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded transition-all flex items-center justify-end pr-2"
                      style={{ 
                        width: `${(item.totalHours / Math.max(...stationPerfData.map(s => s.totalHours))) * 100}%`, 
                        minWidth: '50px' 
                      }}
                    >
                      <span className="text-xs font-semibold text-white">{item.totalHours}h</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-gray-400">
              No time entries for this period
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  color, 
  subtitle,
  suffix,
  highlight 
}: { 
  title: string;
  value: number;
  icon: React.ElementType;
  color: string;
  subtitle?: string;
  suffix?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`bg-white rounded-xl p-4 shadow-sm border ${highlight ? 'border-red-200 bg-red-50' : 'border-gray-100'}`}>
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${color} bg-opacity-10`}>
          <Icon className={`h-5 w-5 ${color.replace('bg-', 'text-')}`} />
        </div>
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className={`text-2xl font-bold ${highlight ? 'text-red-600' : 'text-gray-900'}`}>
            {value.toLocaleString()}{suffix && <span className="text-sm font-normal text-gray-500 ml-1">{suffix}</span>}
          </p>
          {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}
