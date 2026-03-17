import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Activity,
  User,
  Clock,
  Filter,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Search,
  FileText,
  LogIn,
  LogOut,
  Edit,
  Trash2,
  Plus,
  ArrowRightLeft,
  UserPlus,
  Upload,
  Download,
  AlertCircle,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { api } from '../lib/api';
import { format } from 'date-fns';

interface ActivityLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  entityName: string | null;
  description: string;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  userId: string | null;
  user: {
    id: string;
    displayName: string;
    username: string;
    profilePhoto: string | null;
  } | null;
  createdAt: string;
}

interface ActivityStats {
  totalCount: number;
  byAction: { action: string; count: number }[];
  byEntity: { entityType: string; count: number }[];
  byUser: { userId: string; count: number; user: { id: string; displayName: string } | null }[];
  byDay: { date: string; count: number }[];
}

const ACTION_ICONS: Record<string, React.ElementType> = {
  LOGIN: LogIn,
  LOGOUT: LogOut,
  LOGIN_FAILED: AlertCircle,
  CREATE: Plus,
  UPDATE: Edit,
  DELETE: Trash2,
  STATUS_CHANGE: ArrowRightLeft,
  ASSIGN: UserPlus,
  UPLOAD: Upload,
  DOWNLOAD: Download,
};

const ACTION_COLORS: Record<string, string> = {
  LOGIN: 'bg-green-100 text-green-700',
  LOGOUT: 'bg-gray-100 text-gray-700',
  LOGIN_FAILED: 'bg-red-100 text-red-700',
  CREATE: 'bg-blue-100 text-blue-700',
  UPDATE: 'bg-amber-100 text-amber-700',
  DELETE: 'bg-red-100 text-red-700',
  STATUS_CHANGE: 'bg-purple-100 text-purple-700',
  ASSIGN: 'bg-cyan-100 text-cyan-700',
  UPLOAD: 'bg-indigo-100 text-indigo-700',
  DOWNLOAD: 'bg-teal-100 text-teal-700',
};

const ENTITY_COLORS: Record<string, string> = {
  WorkOrder: 'bg-primary-100 text-primary-700',
  Customer: 'bg-emerald-100 text-emerald-700',
  Quote: 'bg-amber-100 text-amber-700',
  User: 'bg-violet-100 text-violet-700',
  InventoryItem: 'bg-orange-100 text-orange-700',
  Template: 'bg-cyan-100 text-cyan-700',
  Settings: 'bg-gray-100 text-gray-700',
};

export function ActivityPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    userId: '',
    entityType: '',
    action: '',
    search: '',
    startDate: '',
    endDate: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const pageSize = 25;

  // Build query params
  const queryParams = new URLSearchParams();
  queryParams.set('page', page.toString());
  queryParams.set('pageSize', pageSize.toString());
  if (filters.userId) queryParams.set('userId', filters.userId);
  if (filters.entityType) queryParams.set('entityType', filters.entityType);
  if (filters.action) queryParams.set('action', filters.action);
  if (filters.search) queryParams.set('search', filters.search);
  if (filters.startDate) queryParams.set('startDate', filters.startDate);
  if (filters.endDate) queryParams.set('endDate', filters.endDate);

  // Fetch activity logs
  const { data: activityData, isLoading } = useQuery({
    queryKey: ['activity', page, filters],
    queryFn: async () => {
      const response = await api.get(`/activity?${queryParams.toString()}`);
      return response.data.data as {
        items: ActivityLog[];
        pagination: { page: number; pageSize: number; total: number; totalPages: number };
      };
    },
  });

  // Fetch activity stats
  const { data: statsData } = useQuery({
    queryKey: ['activity', 'stats'],
    queryFn: async () => {
      const response = await api.get('/activity/stats');
      return response.data.data as ActivityStats;
    },
  });

  // Fetch users for filter dropdown
  const { data: usersData } = useQuery({
    queryKey: ['users', 'list'],
    queryFn: async () => {
      const response = await api.get('/users?pageSize=100');
      return response.data.data.items as { id: string; displayName: string }[];
    },
  });

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({
      userId: '',
      entityType: '',
      action: '',
      search: '',
      startDate: '',
      endDate: '',
    });
    setPage(1);
  };

  const hasActiveFilters = Object.values(filters).some((v) => v !== '');

  const getEntityLink = (log: ActivityLog) => {
    if (!log.entityId) return null;
    switch (log.entityType) {
      case 'WorkOrder':
        return `/orders/${log.entityId}`;
      case 'Customer':
        return `/sales/customers/${log.entityId}`;
      case 'Quote':
        return `/sales/quotes/${log.entityId}`;
      case 'User':
        return `/users`;
      case 'InventoryItem':
        return `/inventory/items/${log.entityId}`;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-violet-500 to-purple-500 rounded-xl text-white">
            <Activity className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Activity Log</h1>
            <p className="text-gray-500 mt-1">
              {statsData?.totalCount.toLocaleString() ?? '—'} total activities
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`btn-secondary flex items-center gap-2 ${hasActiveFilters ? 'ring-2 ring-primary-500' : ''}`}
        >
          <Filter className="h-4 w-4" />
          Filters
          {hasActiveFilters && (
            <span className="bg-primary-500 text-white text-xs px-1.5 rounded-full">
              {Object.values(filters).filter((v) => v !== '').length}
            </span>
          )}
        </button>
      </div>

      {/* Stats Cards */}
      {statsData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Activity className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Activities</p>
                <p className="text-xl font-bold text-gray-900">
                  {statsData.totalCount.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <LogIn className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Logins (7d)</p>
                <p className="text-xl font-bold text-gray-900">
                  {statsData.byAction.find((a) => a.action === 'LOGIN')?.count ?? 0}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <ArrowRightLeft className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Status Changes</p>
                <p className="text-xl font-bold text-gray-900">
                  {statsData.byAction.find((a) => a.action === 'STATUS_CHANGE')?.count ?? 0}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Failed Logins</p>
                <p className="text-xl font-bold text-gray-900">
                  {statsData.byAction.find((a) => a.action === 'LOGIN_FAILED')?.count ?? 0}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="input-field pl-10"
                  placeholder="Search..."
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">User</label>
              <select
                value={filters.userId}
                onChange={(e) => handleFilterChange('userId', e.target.value)}
                className="input-field"
              >
                <option value="">All Users</option>
                {usersData?.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.displayName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Entity Type</label>
              <select
                value={filters.entityType}
                onChange={(e) => handleFilterChange('entityType', e.target.value)}
                className="input-field"
              >
                <option value="">All Types</option>
                <option value="WorkOrder">Work Orders</option>
                <option value="Customer">Customers</option>
                <option value="Quote">Quotes</option>
                <option value="User">Users</option>
                <option value="InventoryItem">Inventory</option>
                <option value="Settings">Settings</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
              <select
                value={filters.action}
                onChange={(e) => handleFilterChange('action', e.target.value)}
                className="input-field"
              >
                <option value="">All Actions</option>
                <option value="LOGIN">Login</option>
                <option value="LOGIN_FAILED">Failed Login</option>
                <option value="CREATE">Create</option>
                <option value="UPDATE">Update</option>
                <option value="DELETE">Delete</option>
                <option value="STATUS_CHANGE">Status Change</option>
                <option value="ASSIGN">Assign</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                className="input-field"
              />
            </div>
          </div>
          {hasActiveFilters && (
            <div className="mt-4 flex justify-end">
              <button onClick={clearFilters} className="text-sm text-gray-500 hover:text-gray-700">
                Clear all filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Activity List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : activityData?.items.length === 0 ? (
          <div className="text-center py-12">
            <Activity className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No activity found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {activityData?.items.map((log) => {
              const ActionIcon = ACTION_ICONS[log.action] || FileText;
              const actionColor = ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-700';
              const entityColor = ENTITY_COLORS[log.entityType] || 'bg-gray-100 text-gray-700';
              const entityLink = getEntityLink(log);

              return (
                <div key={log.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg ${actionColor}`}>
                      <ActionIcon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-gray-900">{log.description}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${entityColor}`}>
                          {log.entityType}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                        {log.user && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {log.user.displayName}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(log.createdAt), 'MMM d, yyyy h:mm a')}
                        </span>
                        {log.ipAddress && (
                          <span className="text-gray-400">IP: {log.ipAddress}</span>
                        )}
                      </div>
                      {entityLink && log.entityName && (
                        <Link
                          to={entityLink}
                          className="inline-block mt-2 text-sm text-primary-600 hover:underline"
                        >
                          View {log.entityName} →
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {activityData && activityData.pagination.totalPages > 1 && (
          <div className="border-t border-gray-100 px-4 py-3 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Showing {(page - 1) * pageSize + 1} to{' '}
              {Math.min(page * pageSize, activityData.pagination.total)} of{' '}
              {activityData.pagination.total} activities
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm text-gray-600">
                Page {page} of {activityData.pagination.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(activityData.pagination.totalPages, p + 1))}
                disabled={page === activityData.pagination.totalPages}
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
