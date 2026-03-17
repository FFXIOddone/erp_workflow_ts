import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  RefreshCw,
  CheckCircle,
  Circle,
  PlayCircle,
  AlertTriangle,
  Calendar,
  User,
  Package,
  Clock,
  ChevronDown,
  ChevronUp,
  Eye,
  Printer,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useConfigStore } from '../stores/config';
import { useAuthStore } from '../stores/auth';

// ─── Types ────────────────────────────────────────────────────────

interface StationProgress {
  id: string;
  station: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  startedAt?: string;
  completedAt?: string;
  completedById?: string;
}

interface LineItem {
  id: string;
  itemNumber: number;
  description: string;
  quantity: number;
  unitPrice: number;
  itemMaster?: { name: string };
}

interface WorkOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  description?: string;
  status: string;
  priority: number;
  dueDate: string;
  routing: string[];
  stationProgress: StationProgress[];
  lineItems: LineItem[];
  assignedTo?: { id: string; displayName: string };
  createdBy?: { id: string; displayName: string };
}

type PrintStation = 'ROLL_TO_ROLL' | 'FLATBED' | 'SCREEN_PRINT';

// ─── Constants ────────────────────────────────────────────────────

const STATION_CONFIG: Record<PrintStation, { label: string; color: string; bg: string; border: string; icon: string; ring: string }> = {
  ROLL_TO_ROLL: {
    label: 'Roll to Roll',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: 'text-blue-500',
    ring: 'ring-blue-300',
  },
  FLATBED: {
    label: 'Flatbed',
    color: 'text-purple-700',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    icon: 'text-purple-500',
    ring: 'ring-purple-300',
  },
  SCREEN_PRINT: {
    label: 'Screen Print',
    color: 'text-green-700',
    bg: 'bg-green-50',
    border: 'border-green-200',
    icon: 'text-green-500',
    ring: 'ring-green-300',
  },
};

const PRIORITY_CONFIG: Record<number, { label: string; color: string }> = {
  1: { label: 'RUSH', color: 'bg-red-500' },
  2: { label: 'HIGH', color: 'bg-orange-500' },
  3: { label: 'NORMAL', color: 'bg-gray-400' },
  4: { label: 'LOW', color: 'bg-blue-400' },
  5: { label: 'LOWEST', color: 'bg-gray-300' },
};

// ─── Helpers ──────────────────────────────────────────────────────

function isOverdue(dateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dateStr) < today;
}

function isDueToday(dateStr: string): boolean {
  const today = new Date();
  const due = new Date(dateStr);
  return (
    due.getFullYear() === today.getFullYear() &&
    due.getMonth() === today.getMonth() &&
    due.getDate() === today.getDate()
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Find the "active" print station for an order — the first one
 * in routing that is IN_PROGRESS, or failing that the first NOT_STARTED one.
 * Returns null if all print stations for this user are completed.
 */
function getActivePrintStation(order: WorkOrder, userStations: PrintStation[]): PrintStation | null {
  // First look for one that's in progress
  for (const st of order.routing) {
    if (!userStations.includes(st as PrintStation)) continue;
    const prog = order.stationProgress.find((sp) => sp.station === st);
    if (prog?.status === 'IN_PROGRESS') return st as PrintStation;
  }
  // Then look for one that hasn't started
  for (const st of order.routing) {
    if (!userStations.includes(st as PrintStation)) continue;
    const prog = order.stationProgress.find((sp) => sp.station === st);
    if (!prog || prog.status === 'NOT_STARTED') return st as PrintStation;
  }
  return null;
}

// ─── Component ────────────────────────────────────────────────────

export function WorkOrderQueue() {
  const { config } = useConfigStore();
  const { token, user, logout } = useAuthStore();
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStation, setSelectedStation] = useState<PrintStation | 'ALL'>('ALL');
  const [showCompleted, setShowCompleted] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null);

  // Determine which print stations the user can see
  const userStations = useMemo(() => {
    const allowed = (user?.allowedStations || []).filter(
      (s): s is PrintStation => s === 'ROLL_TO_ROLL' || s === 'FLATBED' || s === 'SCREEN_PRINT'
    );
    return allowed.length > 0 ? allowed : (['ROLL_TO_ROLL', 'FLATBED'] as PrintStation[]);
  }, [user?.allowedStations]);

  // ─── Data Fetching ──────────────────────────────────────────────

  const fetchOrders = useCallback(async () => {
    if (!token) return;
    try {
      // Use myStations=true to filter by user's allowed stations, lightweight for perf
      const params = new URLSearchParams({
        pageSize: '500',
        status: 'IN_PROGRESS,PENDING,ON_HOLD',
        lightweight: 'true',
        myStations: 'true',
      });

      const res = await fetch(`${config.apiUrl}/orders?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        toast.error('Session expired — please log in again');
        logout();
        return;
      }
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const json = await res.json();
      setOrders(json.data?.items || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch work orders');
    } finally {
      setLoading(false);
    }
  }, [config.apiUrl, token, logout]);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 15000); // Refresh every 15s
    return () => clearInterval(interval);
  }, [fetchOrders]);

  // ─── Station Actions ────────────────────────────────────────────

  const startStation = async (orderId: string, station: string) => {
    setUpdatingOrder(orderId);
    try {
      const res = await fetch(`${config.apiUrl}/orders/${orderId}/stations/${station}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { logout(); return; }
      if (!res.ok) throw new Error('Failed to start station');
      toast.success('Station started');
      fetchOrders();
    } catch {
      toast.error('Failed to start station');
    } finally {
      setUpdatingOrder(null);
    }
  };

  const completeStation = async (orderId: string, station: string) => {
    setUpdatingOrder(orderId);
    try {
      const res = await fetch(`${config.apiUrl}/orders/${orderId}/stations/${station}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { logout(); return; }
      if (!res.ok) throw new Error('Failed to complete station');
      toast.success('Station completed');
      fetchOrders();
    } catch {
      toast.error('Failed to complete station');
    } finally {
      setUpdatingOrder(null);
    }
  };

  // ─── Computed Data ──────────────────────────────────────────────

  // Station stats for the overview cards
  const stationStats = useMemo(() => {
    const stats: Record<PrintStation, { notStarted: number; inProgress: number; completed: number; total: number; overdue: number }> = {} as any;

    userStations.forEach((station) => {
      const stationOrders = orders.filter((o) => o.routing.includes(station));
      const s = { notStarted: 0, inProgress: 0, completed: 0, total: stationOrders.length, overdue: 0 };

      stationOrders.forEach((order) => {
        const progress = order.stationProgress.find((sp) => sp.station === station);
        if (!progress || progress.status === 'NOT_STARTED') s.notStarted++;
        else if (progress.status === 'IN_PROGRESS') s.inProgress++;
        else if (progress.status === 'COMPLETED') s.completed++;

        if (isOverdue(order.dueDate) && progress?.status !== 'COMPLETED') s.overdue++;
      });

      stats[station] = s;
    });

    return stats;
  }, [orders, userStations]);

  // Filtered orders for selected station
  const filteredOrders = useMemo(() => {
    let filtered = orders;

    // Filter by station routing
    if (selectedStation !== 'ALL') {
      filtered = filtered.filter((o) => o.routing.includes(selectedStation));
    } else {
      filtered = filtered.filter((o) => o.routing.some((r) => userStations.includes(r as PrintStation)));
    }

    // Filter out completed
    if (!showCompleted) {
      if (selectedStation !== 'ALL') {
        // Station-specific: hide orders where that station is completed
        filtered = filtered.filter((o) => {
          const progress = o.stationProgress.find((sp) => sp.station === selectedStation);
          return !progress || progress.status !== 'COMPLETED';
        });
      } else {
        // ALL view: hide orders where ALL user's print stations are completed
        filtered = filtered.filter((o) => {
          // Check if there's at least one print station that still needs work
          return getActivePrintStation(o, userStations) !== null;
        });
      }
    }

    // Sort: priority desc (rush first), then due date asc
    return [...filtered].sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority; // Lower number = higher priority
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
  }, [orders, selectedStation, showCompleted, userStations]);

  // Group orders by station progress status
  const groupedOrders = useMemo(() => {
    if (selectedStation === 'ALL') {
      return { all: filteredOrders };
    }

    const notStarted: WorkOrder[] = [];
    const inProgress: WorkOrder[] = [];
    const completed: WorkOrder[] = [];

    filteredOrders.forEach((order) => {
      const progress = order.stationProgress.find((sp) => sp.station === selectedStation);
      if (!progress || progress.status === 'NOT_STARTED') notStarted.push(order);
      else if (progress.status === 'IN_PROGRESS') inProgress.push(order);
      else completed.push(order);
    });

    return { notStarted, inProgress, completed };
  }, [filteredOrders, selectedStation]);

  // ─── Render Helpers ─────────────────────────────────────────────

  const renderStationBadges = (order: WorkOrder) => (
    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
      {order.routing
        .filter((r) => r in STATION_CONFIG)
        .map((station) => {
          const prog = order.stationProgress.find((sp) => sp.station === station);
          const isComplete = prog?.status === 'COMPLETED';
          const isActive = prog?.status === 'IN_PROGRESS';
          const cfg = STATION_CONFIG[station as PrintStation];
          return (
            <span
              key={station}
              className={`px-2 py-0.5 text-xs rounded-full flex items-center gap-1 ${
                isComplete
                  ? 'bg-green-100 text-green-700'
                  : isActive
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {isComplete ? (
                <CheckCircle className="h-3 w-3" />
              ) : isActive ? (
                <PlayCircle className="h-3 w-3" />
              ) : (
                <Circle className="h-3 w-3" />
              )}
              {cfg?.label || station}
            </span>
          );
        })}
    </div>
  );

  const renderOrderCard = (order: WorkOrder, station?: PrintStation) => {
    // In ALL view, auto-detect the active print station for action buttons
    const actionStation = station || getActivePrintStation(order, userStations);
    const progress = actionStation
      ? order.stationProgress.find((sp) => sp.station === actionStation)
      : null;
    const overdue = isOverdue(order.dueDate);
    const dueToday = isDueToday(order.dueDate);
    const isExpanded = expandedOrder === order.id;
    const isUpdating = updatingOrder === order.id;
    const pri = PRIORITY_CONFIG[order.priority] || PRIORITY_CONFIG[3];

    return (
      <div
        key={order.id}
        className={`bg-white rounded-lg border p-4 transition-shadow hover:shadow-md ${
          overdue && progress?.status !== 'COMPLETED' ? 'border-red-200 bg-red-50/30' : 'border-gray-200'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          {/* Left side: order info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-semibold text-gray-900 font-mono">{order.orderNumber}</span>

              {/* Priority badge */}
              <span className={`px-2 py-0.5 text-xs font-bold rounded-full text-white ${pri.color}`}>
                {pri.label}
              </span>

              {/* Due date warnings */}
              {overdue && progress?.status !== 'COMPLETED' && (
                <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">
                  <AlertTriangle className="h-3 w-3" />
                  Overdue
                </span>
              )}
              {dueToday && !overdue && (
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
                  Due Today
                </span>
              )}
            </div>

            <p className="text-sm text-gray-600 truncate">{order.customerName}</p>
            {order.description && (
              <p className="text-xs text-gray-500 truncate mt-0.5">{order.description}</p>
            )}

            {/* Meta row */}
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Due: {formatDate(order.dueDate)}
              </span>
              {order.assignedTo && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {order.assignedTo.displayName}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Package className="h-3 w-3" />
                {order.lineItems?.length || 0} items
              </span>
            </div>

            {/* Station routing badges (in ALL view) */}
            {selectedStation === 'ALL' && renderStationBadges(order)}
          </div>

          {/* Right side: actions */}
          <div className="flex flex-col items-end gap-2">
            {actionStation && progress && (
              <>
                {/* Show which station in ALL view */}
                {selectedStation === 'ALL' && (
                  <span className={`text-xs font-medium ${STATION_CONFIG[actionStation]?.color || 'text-gray-500'}`}>
                    {STATION_CONFIG[actionStation]?.label || actionStation}
                  </span>
                )}
                {progress.status === 'NOT_STARTED' && (
                  <button
                    onClick={() => startStation(order.id, actionStation)}
                    disabled={isUpdating}
                    className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <PlayCircle className="h-4 w-4" />
                    Start
                  </button>
                )}
                {progress.status === 'IN_PROGRESS' && (
                  <button
                    onClick={() => completeStation(order.id, actionStation)}
                    disabled={isUpdating}
                    className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Complete
                  </button>
                )}
                {progress.status === 'COMPLETED' && (
                  <span className="text-sm text-green-600 flex items-center gap-1">
                    <CheckCircle className="h-4 w-4" />
                    Done
                  </span>
                )}
              </>
            )}

            {/* Expand / Collapse */}
            <button
              onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Details"
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Expanded details */}
        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            {/* Full routing progress */}
            <div className="mb-3">
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Routing Progress</h4>
              <div className="flex items-center gap-1 flex-wrap">
                {order.routing.map((st, idx) => {
                  const prog = order.stationProgress.find((sp) => sp.station === st);
                  const cfg = STATION_CONFIG[st as PrintStation];
                  const label = cfg?.label || st.replace(/_/g, ' ');
                  const isComplete = prog?.status === 'COMPLETED';
                  const isActive = prog?.status === 'IN_PROGRESS';

                  return (
                    <div key={st} className="flex items-center">
                      {idx > 0 && <div className="w-4 h-0.5 bg-gray-200 mx-0.5" />}
                      <span
                        className={`px-2.5 py-1 text-xs rounded-lg font-medium flex items-center gap-1 ${
                          isComplete
                            ? 'bg-green-100 text-green-700 border border-green-200'
                            : isActive
                            ? 'bg-blue-100 text-blue-700 border border-blue-200'
                            : 'bg-gray-100 text-gray-500 border border-gray-200'
                        }`}
                      >
                        {isComplete ? (
                          <CheckCircle className="h-3 w-3" />
                        ) : isActive ? (
                          <PlayCircle className="h-3 w-3" />
                        ) : (
                          <Circle className="h-3 w-3" />
                        )}
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Line items */}
            {order.lineItems && order.lineItems.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Line Items</h4>
                <div className="space-y-1">
                  {order.lineItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 text-xs text-gray-600 py-1">
                      <span className="text-gray-400 w-4 text-right">{item.itemNumber}.</span>
                      <span className="flex-1 truncate">{item.description || item.itemMaster?.name || 'Item'}</span>
                      <span className="font-medium">Qty: {item.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderSection = (
    title: string,
    sectionOrders: WorkOrder[],
    icon: React.ReactNode,
    bgColor: string,
    station?: PrintStation
  ) => {
    if (sectionOrders.length === 0) return null;

    return (
      <div className="space-y-2">
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${bgColor}`}>
          {icon}
          <span className="font-medium text-sm">{title}</span>
          <span className="text-sm opacity-70">({sectionOrders.length})</span>
        </div>
        <div className="space-y-2">
          {sectionOrders.map((order) => renderOrderCard(order, station))}
        </div>
      </div>
    );
  };

  // ─── Main Render ────────────────────────────────────────────────

  if (loading && orders.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-white rounded-xl shadow-soft border border-gray-100">
        <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white rounded-xl shadow-soft border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Work Orders</h2>
            <p className="text-sm text-gray-500">
              {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''}
              {selectedStation !== 'ALL' && ` at ${STATION_CONFIG[selectedStation]?.label}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {(
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer mr-3">
                <input
                  type="checkbox"
                  checked={showCompleted}
                  onChange={(e) => setShowCompleted(e.target.checked)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                Show completed
              </label>
            )}
            <button
              onClick={fetchOrders}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Station Cards */}
        <div className={`grid gap-3 ${userStations.length >= 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {userStations.map((station) => {
            const stats = stationStats[station];
            const cfg = STATION_CONFIG[station];
            const isSelected = selectedStation === station;

            return (
              <button
                key={station}
                onClick={() => setSelectedStation(isSelected ? 'ALL' : station)}
                className={`p-3 rounded-xl border-2 transition-all text-left ${
                  isSelected
                    ? `${cfg.bg} ${cfg.border} ring-2 ring-offset-1 ${cfg.ring}`
                    : 'bg-white border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Printer className={`h-4 w-4 ${isSelected ? cfg.icon : 'text-gray-400'}`} />
                  <span className={`font-semibold text-sm ${isSelected ? cfg.color : 'text-gray-700'}`}>
                    {cfg.label}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1 text-gray-500">
                    <Circle className="h-3 w-3 text-gray-400" />
                    {stats?.notStarted || 0}
                  </span>
                  <span className="flex items-center gap-1 text-blue-600">
                    <PlayCircle className="h-3 w-3" />
                    {stats?.inProgress || 0}
                  </span>
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle className="h-3 w-3" />
                    {stats?.completed || 0}
                  </span>
                </div>

                {stats?.overdue > 0 && (
                  <div className="mt-1.5 flex items-center gap-1 text-xs text-red-600">
                    <AlertTriangle className="h-3 w-3" />
                    {stats.overdue} overdue
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* All Stations button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedStation('ALL')}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              selectedStation === 'ALL'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All Stations
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="px-4 py-2 bg-red-50 text-red-600 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Package className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-lg font-medium text-gray-900 mb-1">No orders in queue</p>
            <p className="text-sm text-gray-500">
              {selectedStation !== 'ALL'
                ? `No active orders at ${STATION_CONFIG[selectedStation]?.label}`
                : 'No active orders with print stations in routing'}
            </p>
          </div>
        ) : selectedStation === 'ALL' ? (
          // ALL view: flat list with station badges
          <div className="space-y-2">
            {filteredOrders.map((order) => renderOrderCard(order))}
          </div>
        ) : (
          // Station-specific view: grouped by status
          <div className="space-y-6">
            {renderSection(
              'In Progress',
              groupedOrders.inProgress || [],
              <PlayCircle className="h-5 w-5 text-blue-600" />,
              'bg-blue-50 text-blue-700',
              selectedStation
            )}
            {renderSection(
              'Waiting to Start',
              groupedOrders.notStarted || [],
              <Clock className="h-5 w-5 text-gray-600" />,
              'bg-gray-100 text-gray-700',
              selectedStation
            )}
            {showCompleted &&
              renderSection(
                'Completed',
                groupedOrders.completed || [],
                <CheckCircle className="h-5 w-5 text-green-600" />,
                'bg-green-50 text-green-700',
                selectedStation
              )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-500 flex items-center justify-between">
        <span>
          {orders.length} total work orders · Auto-refreshes every 15s
        </span>
        <span className="flex items-center gap-1">
          <Eye className="h-3 w-3" />
          {selectedStation !== 'ALL' ? STATION_CONFIG[selectedStation]?.label : 'All Stations'}
        </span>
      </div>
    </div>
  );
}
