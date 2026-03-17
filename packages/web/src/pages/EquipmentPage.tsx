import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  Plus, 
  Search,
  Wrench,
  CheckCircle,
  XCircle,
  Archive,
  Settings2,
  Filter,
  X,
  Wifi,
  Network,
} from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { Spinner } from '../components/Spinner';
import { Pagination } from '../components/Pagination';
import { 
  EquipmentStatus, 
  EQUIPMENT_STATUS_DISPLAY_NAMES, 
  EQUIPMENT_STATUS_COLORS,
  STATION_DISPLAY_NAMES,
  PrintingMethod
} from '@erp/shared';

interface Equipment {
  id: string;
  name: string;
  type: string;
  manufacturer: string | null;
  model: string | null;
  station: string | null;
  status: string;
  location: string | null;
  ipAddress: string | null;
  connectionType: string | null;
  _count: {
    maintenanceSchedules: number;
    maintenanceLogs: number;
    downtimeEvents: number;
  };
}

interface LiveStatus {
  equipmentId: string;
  name: string;
  type: string;
  ipAddress: string;
  connectionType: string;
  station: string | null;
  reachable: boolean;
  state: string;
  stateMessage: string | null;
  systemName: string | null;
  systemDescription: string | null;
  lastPolled: string | null;
  supplies: Array<{ name: string; level: number; colorHex?: string }>;
  alerts: string[];
  errorMessage: string | null;
}

export default function EquipmentPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [stationFilter, setStationFilter] = useState('');
  const [includeRetired, setIncludeRetired] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['equipment', { search, status: statusFilter, station: stationFilter, includeRetired, page }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);
      if (stationFilter) params.append('station', stationFilter);
      if (includeRetired) params.append('includeRetired', 'true');
      params.append('page', page.toString());
      params.append('pageSize', '20');
      const res = await api.get(`/equipment?${params.toString()}`);
      return res.data.data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['equipment-stats'],
    queryFn: async () => {
      const res = await api.get('/equipment/stats');
      return res.data.data;
    },
  });

  // Live connectivity status - polls every 15 seconds
  const { data: liveStatuses } = useQuery<LiveStatus[]>({
    queryKey: ['equipment-live-status'],
    queryFn: async () => {
      const res = await api.get('/equipment/live-status');
      return res.data.data;
    },
    refetchInterval: 30000, // Live hardware status — no WS push for SNMP polls
  });

  // Build a map for O(1) lookup by equipment ID
  const liveStatusMap = useMemo(() => {
    const map = new Map<string, LiveStatus>();
    if (liveStatuses) {
      for (const s of liveStatuses) {
        map.set(s.equipmentId, s);
      }
    }
    return map;
  }, [liveStatuses]);

  // Network stats derived from live status
  const networkStats = useMemo(() => {
    if (!liveStatuses) return null;
    const total = liveStatuses.length;
    const online = liveStatuses.filter(s => s.reachable).length;
    const offline = total - online;
    const printing = liveStatuses.filter(s => s.state === 'printing').length;
    return { total, online, offline, printing };
  }, [liveStatuses]);

  const equipment = data?.items || [];
  const totalPages = data?.pages || 1;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case EquipmentStatus.OPERATIONAL:
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case EquipmentStatus.MAINTENANCE:
        return <Wrench className="h-5 w-5 text-amber-600" />;
      case EquipmentStatus.DOWN:
        return <XCircle className="h-5 w-5 text-red-600" />;
      case EquipmentStatus.RETIRED:
        return <Archive className="h-5 w-5 text-gray-600" />;
      default:
        return null;
    }
  };

  const hasActiveFilters = search || statusFilter || stationFilter;

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setStationFilter('');
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Equipment"
        description="Manage shop equipment, maintenance schedules, and downtime"
        actions={
          <button
            onClick={() => navigate('/equipment/new')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Add Equipment
          </button>
        }
      />

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-gray-400" />
              <p className="text-2xl font-semibold text-gray-900">{stats.totalEquipment}</p>
            </div>
            <p className="text-sm text-gray-500">Total</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-green-200 p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <p className="text-2xl font-semibold text-green-600">{stats.operational}</p>
            </div>
            <p className="text-sm text-green-600 font-medium">Operational</p>
          </div>
          <div className={`bg-white rounded-lg shadow-sm border p-4 ${stats.maintenance > 0 ? 'border-amber-200' : 'border-gray-200'}`}>
            <div className="flex items-center gap-2">
              <Wrench className={`h-5 w-5 ${stats.maintenance > 0 ? 'text-amber-500' : 'text-gray-300'}`} />
              <p className={`text-2xl font-semibold ${stats.maintenance > 0 ? 'text-amber-600' : 'text-gray-300'}`}>{stats.maintenance}</p>
            </div>
            <p className={`text-sm font-medium ${stats.maintenance > 0 ? 'text-amber-600' : 'text-gray-400'}`}>Maintenance</p>
          </div>
          <div className={`bg-white rounded-lg shadow-sm border p-4 ${stats.down > 0 ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}>
            <div className="flex items-center gap-2">
              <XCircle className={`h-5 w-5 ${stats.down > 0 ? 'text-red-500' : 'text-gray-300'}`} />
              <p className={`text-2xl font-semibold ${stats.down > 0 ? 'text-red-600' : 'text-gray-300'}`}>{stats.down}</p>
            </div>
            <p className={`text-sm font-medium ${stats.down > 0 ? 'text-red-600' : 'text-gray-400'}`}>Down</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-2">
              <Archive className={`h-5 w-5 ${stats.retired > 0 ? 'text-gray-500' : 'text-gray-300'}`} />
              <p className={`text-2xl font-semibold ${stats.retired > 0 ? 'text-gray-600' : 'text-gray-300'}`}>{stats.retired}</p>
            </div>
            <p className="text-sm text-gray-500">Retired</p>
          </div>
          <div className={`bg-white rounded-lg shadow-sm border p-4 ${stats.activeDowntime > 0 ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}>
            <div className="flex items-center gap-2">
              <XCircle className={`h-5 w-5 ${stats.activeDowntime > 0 ? 'text-red-500 animate-pulse' : 'text-gray-300'}`} />
              <p className={`text-2xl font-semibold ${stats.activeDowntime > 0 ? 'text-red-600' : 'text-gray-300'}`}>{stats.activeDowntime}</p>
            </div>
            <p className={`text-sm font-medium ${stats.activeDowntime > 0 ? 'text-red-600' : 'text-gray-400'}`}>Active Issues</p>
          </div>
          <div className={`bg-white rounded-lg shadow-sm border p-4 ${stats.overdueSchedules > 0 ? 'border-amber-200 bg-amber-50' : 'border-gray-200'}`}>
            <div className="flex items-center gap-2">
              <Wrench className={`h-5 w-5 ${stats.overdueSchedules > 0 ? 'text-amber-500' : 'text-gray-300'}`} />
              <p className={`text-2xl font-semibold ${stats.overdueSchedules > 0 ? 'text-amber-600' : 'text-gray-300'}`}>{stats.overdueSchedules}</p>
            </div>
            <p className={`text-sm font-medium ${stats.overdueSchedules > 0 ? 'text-amber-600' : 'text-gray-400'}`}>Overdue Tasks</p>
          </div>
          {/* Network connectivity stats */}
          {networkStats && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-2">
                <Wifi className="h-5 w-5 text-green-500" />
                <p className="text-2xl font-semibold text-green-600">{networkStats.online}</p>
                <span className="text-lg text-gray-400">/</span>
                <p className="text-2xl font-semibold text-gray-400">{networkStats.total}</p>
              </div>
              <p className="text-sm text-green-600 font-medium">Online</p>
            </div>
          )}
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-64">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search equipment..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-2 px-4 py-2 border rounded-lg ${
              hasActiveFilters
                ? 'border-blue-500 text-blue-600 bg-blue-50'
                : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
            }`}
          >
            <Filter className="h-4 w-4" />
            Filters
            {hasActiveFilters && (
              <span className="bg-blue-600 text-white text-xs rounded-full px-1.5 py-0.5">
                {[search, statusFilter, stationFilter].filter(Boolean).length}
              </span>
            )}
          </button>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex flex-wrap gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Statuses</option>
                  {(Object.values(EquipmentStatus) as string[]).map((status) => (
                    <option key={status} value={status}>
                      {EQUIPMENT_STATUS_DISPLAY_NAMES[status]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Station</label>
                <select
                  value={stationFilter}
                  onChange={(e) => { setStationFilter(e.target.value); setPage(1); }}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Stations</option>
                  {(Object.values(PrintingMethod) as string[]).map((method) => (
                    <option key={method} value={method}>
                      {STATION_DISPLAY_NAMES[method] || method}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeRetired}
                    onChange={(e) => { setIncludeRetired(e.target.checked); setPage(1); }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  Include retired
                </label>
              </div>

              {hasActiveFilters && (
                <div className="flex items-end">
                  <button
                    onClick={clearFilters}
                    className="inline-flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
                  >
                    <X className="h-4 w-4" />
                    Clear filters
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Equipment Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      ) : equipment.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <Settings2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No equipment found</h3>
          <p className="text-gray-500 mb-4">
            {hasActiveFilters ? 'Try adjusting your filters' : 'Get started by adding your first piece of equipment'}
          </p>
          {!hasActiveFilters && (
            <button
              onClick={() => navigate('/equipment/new')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Add Equipment
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {equipment.map((item: Equipment) => {
            const live = liveStatusMap.get(item.id);
            const hasIp = !!item.ipAddress;
            const isOnline = live?.reachable ?? false;
            const liveState = live?.state ?? 'unknown';

            return (
            <div
              key={item.id}
              onClick={() => navigate(`/equipment/${item.id}`)}
              className={`bg-white rounded-lg shadow-sm border p-4 hover:shadow-md transition-shadow cursor-pointer ${
                hasIp && isOnline && liveState === 'printing'
                  ? 'border-blue-300 ring-1 ring-blue-200'
                  : hasIp && !isOnline
                  ? 'border-red-200'
                  : 'border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {/* Live connectivity dot */}
                  {hasIp && (
                    <div className="relative flex-shrink-0">
                      <div
                        className={`h-3 w-3 rounded-full ${
                          isOnline
                            ? liveState === 'printing'
                              ? 'bg-blue-500'
                              : 'bg-green-500'
                            : 'bg-red-500'
                        }`}
                      />
                      {isOnline && liveState === 'printing' && (
                        <div className="absolute inset-0 h-3 w-3 rounded-full bg-blue-500 animate-ping opacity-40" />
                      )}
                    </div>
                  )}
                  <div>
                    <h3 className="font-medium text-gray-900">{item.name}</h3>
                    <p className="text-sm text-gray-500">{item.type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Connection type badge */}
                  {item.connectionType && (
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      item.connectionType === 'SNMP' ? 'bg-purple-100 text-purple-700' :
                      item.connectionType === 'SMB' ? 'bg-sky-100 text-sky-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      <Network className="h-2.5 w-2.5" />
                      {item.connectionType}
                    </span>
                  )}
                  {getStatusIcon(item.status)}
                </div>
              </div>

              {/* Network info row */}
              {hasIp && (
                <div className="mb-3 flex items-center gap-3 text-xs">
                  <span className="font-mono text-gray-500 bg-gray-50 px-2 py-0.5 rounded">
                    {item.ipAddress}
                  </span>
                  {isOnline && (
                    <span className={`font-medium ${
                      liveState === 'printing' ? 'text-blue-600' :
                      liveState === 'idle' ? 'text-green-600' :
                      liveState === 'error' ? 'text-red-600' :
                      'text-gray-500'
                    }`}>
                      {liveState === 'printing' ? '● Printing' :
                       liveState === 'idle' ? '● Idle' :
                       liveState === 'error' ? '● Error' :
                       `● ${liveState.charAt(0).toUpperCase() + liveState.slice(1)}`}
                    </span>
                  )}
                  {!isOnline && (
                    <span className="text-red-500 font-medium">● Offline</span>
                  )}
                  {live?.systemName && (
                    <span className="text-gray-400 truncate" title={live.systemName}>
                      {live.systemName}
                    </span>
                  )}
                </div>
              )}

              {/* Ink/Supply levels for SNMP printers */}
              {live?.supplies && live.supplies.length > 0 && (
                <div className="mb-3 space-y-1">
                  {live.supplies.map((supply, i) => {
                    const isLow = supply.level >= 0 && supply.level <= 20;
                    return (
                      <div key={i} className="flex items-center gap-2" title={`${supply.name}: ${supply.level}%`}>
                        <div
                          className="h-3 w-3 rounded-full border border-gray-200 flex-shrink-0"
                          style={{ backgroundColor: supply.colorHex || '#6b7280' }}
                        />
                        <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.max(supply.level >= 0 ? supply.level : 0, 2)}%`,
                              backgroundColor: supply.colorHex || '#6b7280',
                            }}
                          />
                        </div>
                        <span className={`text-[10px] font-bold w-8 text-right ${
                          isLow ? 'text-amber-600' : 'text-gray-500'
                        }`}>
                          {supply.level >= 0 ? `${supply.level}%` : 'OK'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="space-y-2 text-sm">
                {item.manufacturer && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Make/Model</span>
                    <span className="text-gray-900">
                      {item.manufacturer}{item.model ? ` ${item.model}` : ''}
                    </span>
                  </div>
                )}
                {item.station && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Station</span>
                    <span className="text-gray-900">
                      {STATION_DISPLAY_NAMES[item.station] || item.station}
                    </span>
                  </div>
                )}
                {item.location && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Location</span>
                    <span className="text-gray-900">{item.location}</span>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between text-xs text-gray-500">
                <span>{item._count.maintenanceSchedules} schedules</span>
                <span>{item._count.maintenanceLogs} logs</span>
                <span
                  className={
                    item._count.downtimeEvents > 0 ? 'text-amber-600' : ''
                  }
                >
                  {item._count.downtimeEvents} downtime
                </span>
              </div>

              <div className="mt-3">
                <span 
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: `${EQUIPMENT_STATUS_COLORS[item.status]}20`,
                    color: EQUIPMENT_STATUS_COLORS[item.status],
                  }}
                >
                  {EQUIPMENT_STATUS_DISPLAY_NAMES[item.status]}
                </span>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
