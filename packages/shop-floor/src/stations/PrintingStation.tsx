import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  CheckCircle,
  Circle,
  PlayCircle,
  AlertTriangle,
  AlertCircle,
  Calendar,
  User,
  Package,
  Clock,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Printer,
  RefreshCw,
  ArrowLeft,
  Wifi,
  WifiOff,
  Undo2,
  Layers,
  List,
} from 'lucide-react';
import { useConfigStore } from '../stores/config';
import { useAuthStore } from '../stores/auth';
import { useWebSocket, type WsStatus } from '../lib/useWebSocket';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────

interface StationProgress {
  id: string;
  station: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  startedAt?: string | null;
  completedAt?: string | null;
  completedById?: string | null;
}

interface LineItem {
  id: string;
  itemNumber: number;
  description: string;
  quantity: number;
  unitPrice?: number;
  notes?: string | null;
  itemMaster?: { name: string } | null;
}

interface WorkOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  description?: string | null;
  status: string;
  priority: number;
  dueDate: string | null;
  notes?: string | null;
  routing: string[];
  stationProgress: StationProgress[];
  lineItems: LineItem[];
  assignedTo?: { id: string; displayName: string } | null;
  nestingEnabled?: boolean;
  nestingFileName?: string | null;
}

type PrintStation = 'ROLL_TO_ROLL' | 'FLATBED' | 'SCREEN_PRINT';

// ─── Constants ────────────────────────────────────────

const STATION_CONFIG: Record<
  PrintStation,
  { label: string; color: string; bg: string; border: string; icon: string; ring: string }
> = {
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

const ALL_STATION_LABELS: Record<string, string> = {
  ROLL_TO_ROLL: 'Roll to Roll',
  FLATBED: 'Flatbed',
  SCREEN_PRINT: 'Screen Print',
  PRODUCTION: 'Production',
  DESIGN: 'Design',
  SHIPPING_RECEIVING: 'Shipping',
  ORDER_ENTRY: 'Order Entry',
  INSTALLATION: 'Installation',
  SALES: 'Sales',
};

const PRIORITY_CONFIG: Record<number, { label: string; color: string; textColor: string }> = {
  1: { label: 'RUSH', color: 'bg-red-500', textColor: 'text-white' },
  2: { label: 'HIGH', color: 'bg-orange-500', textColor: 'text-white' },
  3: { label: 'NORMAL', color: 'bg-gray-400', textColor: 'text-white' },
  4: { label: 'LOW', color: 'bg-blue-400', textColor: 'text-white' },
  5: { label: 'LOWEST', color: 'bg-gray-300', textColor: 'text-gray-700' },
};

// ─── Helpers ──────────────────────────────────────────

function isPrintStation(s: string): s is PrintStation {
  return s === 'ROLL_TO_ROLL' || s === 'FLATBED' || s === 'SCREEN_PRINT';
}

function isOverdue(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dateStr) < today;
}

function isDueToday(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  const today = new Date();
  const due = new Date(dateStr);
  return (
    due.getFullYear() === today.getFullYear() &&
    due.getMonth() === today.getMonth() &&
    due.getDate() === today.getDate()
  );
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'No date';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Find the "active" print station for an order — the first one
 * in routing that is IN_PROGRESS, or failing that the first NOT_STARTED one.
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

function getStationStatus(order: WorkOrder, station: string): 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' {
  const prog = order.stationProgress.find((sp) => sp.station === station);
  return (prog?.status as 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED') || 'NOT_STARTED';
}

// ─── Component ────────────────────────────────────────

export function PrintingStation() {
  const { config } = useConfigStore();
  const { token, user, logout } = useAuthStore();
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStation, setSelectedStation] = useState<PrintStation | 'ALL'>('ALL');
  const [showCompleted, setShowCompleted] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [detailOrder, setDetailOrder] = useState<WorkOrder | null>(null);
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null);
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionOrderId, setRevisionOrderId] = useState<string | null>(null);
  const [revisionOrderNumber, setRevisionOrderNumber] = useState('');
  const [revisionReason, setRevisionReason] = useState('');
  const [revisionNotes, setRevisionNotes] = useState('');
  const [viewMode, setViewMode] = useState<'orders' | 'material'>('orders');
  const [completions, setCompletions] = useState<Record<string, Record<string, boolean>>>({});
  const fetchRef = useRef<() => void>();

  // Determine user's print stations
  const userStations = useMemo(() => {
    const allowed = (user?.allowedStations || []).filter(isPrintStation);
    return allowed.length > 0 ? allowed : (['ROLL_TO_ROLL', 'FLATBED'] as PrintStation[]);
  }, [user?.allowedStations]);

  // ─── WebSocket (live updates) ───────────────────────

  const { status: wsStatus } = useWebSocket(
    useCallback((msg: { type: string; payload?: unknown }) => {
      const t = msg.type;
      if (
        t === 'STATION_UPDATED' ||
        t === 'ORDER_UPDATED' ||
        t === 'ORDER_CREATED' ||
        t === 'ORDER_DELETED'
      ) {
        fetchRef.current?.();
      }
    }, []),
  );

  // ─── Data Fetching ──────────────────────────────────

  const fetchOrders = useCallback(async () => {
    if (!token) return;
    try {
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
      const items: WorkOrder[] = json.data?.items || json.data || [];
      setOrders(items);
      setError(null);

      // Fetch line item completions for all orders
      const compMap: Record<string, Record<string, boolean>> = {};
      for (const order of items) {
        try {
          const compRes = await fetch(
            `${config.apiUrl}/orders/${order.id}/line-items/completion`,
            { headers: { Authorization: `Bearer ${token}` } },
          );
          if (compRes.ok) {
            const compJson = await compRes.json();
            for (const c of compJson.data || []) {
              if (!compMap[c.lineItemId]) compMap[c.lineItemId] = {};
              compMap[c.lineItemId][c.station] = c.completed;
            }
          }
        } catch {
          // Silently skip — completions are optional enhancement
        }
      }
      setCompletions(compMap);

      // Keep detail view in sync
      setDetailOrder((prev) => {
        if (!prev) return null;
        return items.find((o) => o.id === prev.id) || null;
      });
    } catch (err: any) {
      setError(err.message || 'Failed to fetch work orders');
    } finally {
      setLoading(false);
    }
  }, [config.apiUrl, token, logout]);

  fetchRef.current = fetchOrders;

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 15000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  // ─── Station Actions ────────────────────────────────

  const startStation = async (orderId: string, station: string) => {
    setUpdatingOrder(orderId);
    try {
      const res = await fetch(`${config.apiUrl}/orders/${orderId}/stations/${station}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { logout(); return; }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || body.message || `Failed (${res.status})`);
      }
      toast.success(`Started ${ALL_STATION_LABELS[station] || station}`);
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || 'Failed to start station');
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
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || body.message || `Failed (${res.status})`);
      }
      toast.success(`Completed ${ALL_STATION_LABELS[station] || station}`);
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete station');
    } finally {
      setUpdatingOrder(null);
    }
  };

  const uncompleteStation = async (orderId: string, station: string) => {
    setUpdatingOrder(orderId);
    try {
      const res = await fetch(`${config.apiUrl}/orders/${orderId}/stations/${station}/uncomplete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { logout(); return; }
      if (!res.ok) throw new Error('Failed');
      toast.success(`Re-opened ${ALL_STATION_LABELS[station] || station}`);
      fetchOrders();
    } catch {
      toast.error('Failed to uncomplete station');
    } finally {
      setUpdatingOrder(null);
    }
  };

  const handleMarkComplete = async (orderId: string, orderNumber: string) => {
    if (!window.confirm(`Mark ${orderNumber} as complete?`)) return;
    try {
      const res = await fetch(`${config.apiUrl}/orders/${orderId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      toast.success(`${orderNumber} marked complete`);
      fetchOrders();
    } catch {
      toast.error('Failed to complete order');
    }
  };

  // ─── Line Item Completion Toggle ────────────────────

  const toggleLineItemComplete = async (orderId: string, lineItemId: string, station: string) => {
    const current = completions[lineItemId]?.[station] || false;
    try {
      await fetch(`${config.apiUrl}/orders/${orderId}/line-items/${lineItemId}/station-complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ station, completed: !current }),
      });
      setCompletions(prev => ({
        ...prev,
        [lineItemId]: { ...prev[lineItemId], [station]: !current },
      }));
    } catch {
      toast.error('Failed to update line item');
    }
  };

  // ─── Computed Data ──────────────────────────────────

  const stationStats = useMemo(() => {
    const stats: Record<
      PrintStation,
      { notStarted: number; inProgress: number; completed: number; total: number; overdue: number }
    > = {} as any;

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

  const filteredOrders = useMemo(() => {
    let filtered = orders;

    if (selectedStation !== 'ALL') {
      filtered = filtered.filter((o) => o.routing.includes(selectedStation));
    } else {
      filtered = filtered.filter((o) =>
        o.routing.some((r) => userStations.includes(r as PrintStation)),
      );
    }

    if (!showCompleted) {
      if (selectedStation !== 'ALL') {
        filtered = filtered.filter((o) => {
          const progress = o.stationProgress.find((sp) => sp.station === selectedStation);
          return !progress || progress.status !== 'COMPLETED';
        });
      } else {
        // In ALL view, hide orders where every print station is completed
        filtered = filtered.filter((o) => {
          const printStations = o.routing.filter((r) => userStations.includes(r as PrintStation));
          if (printStations.length === 0) return true;
          return !printStations.every((st) => {
            const prog = o.stationProgress.find((sp) => sp.station === st);
            return prog?.status === 'COMPLETED';
          });
        });
      }
    }

    return [...filtered].sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return aDate - bDate;
    });
  }, [orders, selectedStation, showCompleted, userStations]);

  const groupedOrders = useMemo(() => {
    if (selectedStation === 'ALL') return { all: filteredOrders };
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

  // ─── Material View Grouping ─────────────────────────

  const materialGroups = useMemo(() => {
    if (viewMode !== 'material') return {};
    const groups: Record<string, Array<{ lineItem: LineItem; order: WorkOrder }>> = {};
    for (const order of filteredOrders) {
      for (const li of order.lineItems) {
        const material = li.notes || li.itemMaster?.name || 'Uncategorized';
        if (!groups[material]) groups[material] = [];
        groups[material].push({ lineItem: li, order });
      }
    }
    return groups;
  }, [viewMode, filteredOrders]);

  // The active station key for line-item completions
  const activeStation = selectedStation !== 'ALL' ? selectedStation : (userStations[0] || 'ROLL_TO_ROLL');

  // ─── Detail View ────────────────────────────────────

  if (detailOrder) {
    return (
      <OrderDetailPanel
        order={detailOrder}
        userStations={userStations}
        selectedStation={selectedStation === 'ALL' ? null : selectedStation}
        isUpdating={updatingOrder === detailOrder.id}
        wsStatus={wsStatus}
        onStart={startStation}
        onComplete={completeStation}
        onUncomplete={uncompleteStation}
        onBack={() => setDetailOrder(null)}
      />
    );
  }

  // ─── Render Helpers ─────────────────────────────────

  const renderOrderCard = (order: WorkOrder, station?: PrintStation) => {
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
        className={`bg-white rounded-lg border transition-shadow hover:shadow-md ${
          overdue && progress?.status !== 'COMPLETED'
            ? 'border-red-200 bg-red-50/30'
            : 'border-gray-200'
        }`}
      >
        {/* Clickable main area — opens detail */}
        <button
          className="w-full text-left p-4 focus:outline-none focus:ring-2 focus:ring-blue-300 rounded-t-lg"
          onClick={() => setDetailOrder(order)}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-semibold text-gray-900 font-mono">{order.orderNumber}</span>
                <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${pri.color} ${pri.textColor}`}>
                  {pri.label}
                </span>
                {overdue && progress?.status !== 'COMPLETED' && (
                  <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">
                    <AlertTriangle className="h-3 w-3" /> Overdue
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
              <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Due: {formatDate(order.dueDate)}
                </span>
                {order.assignedTo && (
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" /> {order.assignedTo.displayName}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Package className="h-3 w-3" /> {order.lineItems?.length || 0} items
                </span>
              </div>
              {/* Routing station badges in ALL view */}
              {selectedStation === 'ALL' && (
                <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                  {order.routing.filter(isPrintStation).map((st) => {
                    const stStatus = getStationStatus(order, st);
                    const cfg = STATION_CONFIG[st as PrintStation];
                    return (
                      <span
                        key={st}
                        className={`px-2 py-0.5 text-xs rounded-full flex items-center gap-1 ${
                          stStatus === 'COMPLETED'
                            ? 'bg-green-100 text-green-700'
                            : stStatus === 'IN_PROGRESS'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {stStatus === 'COMPLETED' ? (
                          <CheckCircle className="h-3 w-3" />
                        ) : stStatus === 'IN_PROGRESS' ? (
                          <PlayCircle className="h-3 w-3" />
                        ) : (
                          <Circle className="h-3 w-3" />
                        )}
                        {cfg?.label || st}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
            <ChevronRight className="h-5 w-5 text-gray-300 flex-shrink-0 mt-1" />
          </div>
        </button>

        {/* Action bar: Start / Complete buttons always visible */}
        {actionStation && progress && (
          <div className="px-4 pb-3 flex items-center justify-between border-t border-gray-100 pt-2">
            <span className="text-xs text-gray-500">
              {STATION_CONFIG[actionStation as PrintStation]?.label || actionStation}
              {progress.status === 'IN_PROGRESS' && progress.startedAt && ` — started ${formatDate(progress.startedAt)}`}
            </span>
            <div className="flex items-center gap-2">
              {progress.status === 'NOT_STARTED' && (
                <button
                  onClick={(e) => { e.stopPropagation(); startStation(order.id, actionStation); }}
                  disabled={isUpdating}
                  className="px-4 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  <PlayCircle className="h-4 w-4" /> Start
                </button>
              )}
              {progress.status === 'IN_PROGRESS' && (
                <button
                  onClick={(e) => { e.stopPropagation(); completeStation(order.id, actionStation); }}
                  disabled={isUpdating}
                  className="px-4 py-1.5 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  <CheckCircle className="h-4 w-4" /> Complete
                </button>
              )}
              {progress.status === 'COMPLETED' && (
                <span className="text-sm text-green-600 flex items-center gap-1">
                  <CheckCircle className="h-4 w-4" /> Done
                </span>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleMarkComplete(order.id, order.orderNumber);
                }}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-green-600 hover:bg-green-50 rounded-lg"
                title="Mark order complete"
              >
                <CheckCircle className="w-4 h-4" />
                Done
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setRevisionOrderId(order.id);
                  setRevisionOrderNumber(order.orderNumber);
                  setShowRevisionModal(true);
                }}
                className="flex items-center gap-1 px-2 py-1 text-sm text-orange-600 hover:bg-orange-50 rounded"
                title="Send back to Design"
              >
                <Undo2 className="w-3.5 h-3.5" />
                Revision
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedOrder(isExpanded ? null : order.id);
                }}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Quick peek"
              >
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>
          </div>
        )}

        {/* Expanded inline details */}
        {isExpanded && (
          <div className="px-4 pb-4 border-t border-gray-100">
            <div className="pt-3">
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Routing Progress</h4>
              <div className="flex items-center gap-1 flex-wrap mb-3">
                {order.routing.map((st, idx) => {
                  const stStatus = getStationStatus(order, st);
                  const label = ALL_STATION_LABELS[st] || st.replace(/_/g, ' ');
                  return (
                    <div key={st} className="flex items-center">
                      {idx > 0 && <div className="w-4 h-0.5 bg-gray-200 mx-0.5" />}
                      <span
                        className={`px-2.5 py-1 text-xs rounded-lg font-medium flex items-center gap-1 ${
                          stStatus === 'COMPLETED'
                            ? 'bg-green-100 text-green-700 border border-green-200'
                            : stStatus === 'IN_PROGRESS'
                            ? 'bg-blue-100 text-blue-700 border border-blue-200'
                            : 'bg-gray-100 text-gray-500 border border-gray-200'
                        }`}
                      >
                        {stStatus === 'COMPLETED' ? (
                          <CheckCircle className="h-3 w-3" />
                        ) : stStatus === 'IN_PROGRESS' ? (
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
              {order.notes && (
                <div className="flex items-start gap-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 mb-3">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-500" />
                  <span>{order.notes}</span>
                </div>
              )}
              {order.lineItems && order.lineItems.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Line Items</h4>
                  <div className="space-y-1">
                    {order.lineItems.map((item) => {
                      const stationKey = (station || getActivePrintStation(order, userStations)) as string;
                      return (
                        <label key={item.id} className="flex items-center gap-2 py-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={completions[item.id]?.[stationKey] || false}
                            onChange={(e) => { e.stopPropagation(); toggleLineItemComplete(order.id, item.id, stationKey); }}
                            className="w-4 h-4 text-blue-600 rounded"
                          />
                          <span className={`text-xs flex-1 truncate ${completions[item.id]?.[stationKey] ? 'line-through text-gray-400' : 'text-gray-600'}`}>
                            {item.description || item.itemMaster?.name || 'Item'}
                          </span>
                          <span className="text-xs font-medium">Qty: {item.quantity}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
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
    station?: PrintStation,
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

  // ─── Main Render ────────────────────────────────────

  if (loading && orders.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="bg-white border-b px-4 py-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Printer className="w-5 h-5 text-blue-600" />
            <h2 className="font-semibold text-gray-900">Print Queue</h2>
            <span className="text-sm text-gray-500">
              {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''}
              {selectedStation !== 'ALL' && ` at ${STATION_CONFIG[selectedStation]?.label}`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`p-1 rounded-full ${wsStatus === 'connected' ? 'text-green-500' : 'text-gray-300'}`}
              title={wsStatus === 'connected' ? 'Live updates active' : 'Reconnecting...'}
            >
              {wsStatus === 'connected' ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            </div>
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5 mr-2">
              <button
                onClick={() => setViewMode('orders')}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  viewMode === 'orders'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <List className="w-3.5 h-3.5" /> Orders
              </button>
              <button
                onClick={() => setViewMode('material')}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  viewMode === 'material'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Layers className="w-3.5 h-3.5" /> Material
              </button>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer mr-2">
              <input
                type="checkbox"
                checked={showCompleted}
                onChange={(e) => setShowCompleted(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Show completed
            </label>
            <button onClick={fetchOrders} className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        </div>

        {/* Station selector cards */}
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
                    <Circle className="h-3 w-3 text-gray-400" /> {stats?.notStarted || 0}
                  </span>
                  <span className="flex items-center gap-1 text-blue-600">
                    <PlayCircle className="h-3 w-3" /> {stats?.inProgress || 0}
                  </span>
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle className="h-3 w-3" /> {stats?.completed || 0}
                  </span>
                </div>
                {(stats?.overdue || 0) > 0 && (
                  <div className="mt-1.5 flex items-center gap-1 text-xs text-red-600">
                    <AlertTriangle className="h-3 w-3" /> {stats.overdue} overdue
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* All stations button */}
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

      {/* Error banner */}
      {error && (
        <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
          <button onClick={fetchOrders} className="ml-auto text-xs underline hover:no-underline">
            Retry
          </button>
        </div>
      )}

      {/* Content */}
      {viewMode === 'material' ? (
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {Object.entries(materialGroups).map(([material, items]) => (
            <div key={material} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="bg-blue-50 px-4 py-2 border-b flex items-center justify-between">
                <span className="font-semibold text-blue-900">{material}</span>
                <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                  {items.length} item{items.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="divide-y">
                {items.map(({ lineItem: li, order }) => (
                  <label key={li.id} className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={completions[li.id]?.[activeStation] || false}
                      onChange={() => toggleLineItemComplete(order.id, li.id, activeStation)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className={completions[li.id]?.[activeStation] ? 'line-through text-gray-400 text-sm' : 'text-sm'}>
                      {li.description || li.itemMaster?.name || 'Item'}
                    </span>
                    <span className="text-xs text-gray-400 ml-auto">
                      {order.orderNumber} · Qty: {li.quantity}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
          {Object.keys(materialGroups).length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <Layers className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-lg font-medium text-gray-900 mb-1">No line items to group</p>
              <p className="text-sm text-gray-500">
                {filteredOrders.length === 0
                  ? 'No orders in queue'
                  : 'No line items found in the current orders'}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-4">
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-lg font-medium text-gray-900 mb-1">No orders in queue</p>
              <p className="text-sm text-gray-500">
                {selectedStation !== 'ALL'
                  ? `No active orders at ${STATION_CONFIG[selectedStation]?.label}`
                  : 'No active orders with print stations in routing'}
              </p>
            </div>
          ) : selectedStation === 'ALL' ? (
            <div className="space-y-2">
              {filteredOrders.map((order) => renderOrderCard(order))}
            </div>
          ) : (
            <div className="space-y-6">
              {renderSection(
                'In Progress',
                groupedOrders.inProgress || [],
                <PlayCircle className="h-5 w-5 text-blue-600" />,
                'bg-blue-50 text-blue-700',
                selectedStation,
              )}
              {renderSection(
                'Waiting to Start',
                groupedOrders.notStarted || [],
                <Clock className="h-5 w-5 text-gray-600" />,
                'bg-gray-100 text-gray-700',
                selectedStation,
              )}
              {showCompleted &&
                renderSection(
                  'Completed',
                  groupedOrders.completed || [],
                  <CheckCircle className="h-5 w-5 text-green-600" />,
                  'bg-green-50 text-green-700',
                  selectedStation,
                )}
            </div>
          )}
        </div>
      )}

      {showRevisionModal && revisionOrderId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowRevisionModal(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Send Back to Design</h3>
            <p className="text-sm text-gray-500 mb-4">{revisionOrderNumber}</p>

            <p className="text-sm font-medium text-gray-700 mb-2">Reason:</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {[
                { value: 'WRONG_SIZE', label: 'Wrong Size' },
                { value: 'COLORS_OFF', label: 'Colors Off' },
                { value: 'WRONG_MATERIAL', label: 'Wrong Material' },
                { value: 'LAYOUT_ISSUE', label: 'Layout Issue' },
                { value: 'TEXT_ERROR', label: 'Text Error' },
                { value: 'FILE_CORRUPT', label: 'File Corrupt' },
                { value: 'OTHER', label: 'Other' },
              ].map((r) => (
                <button
                  key={r.value}
                  onClick={() => setRevisionReason(r.value)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    revisionReason === r.value
                      ? 'bg-orange-100 text-orange-800 ring-2 ring-orange-400'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <textarea
              value={revisionNotes}
              onChange={(e) => setRevisionNotes(e.target.value)}
              placeholder="Additional notes (optional)..."
              className="w-full border border-gray-300 rounded-lg p-3 text-sm resize-none h-20 mb-4"
            />

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRevisionModal(false);
                  setRevisionReason('');
                  setRevisionNotes('');
                }}
                className="flex-1 px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!revisionReason) {
                    toast.error('Please select a reason');
                    return;
                  }
                  try {
                    const res = await fetch(`${config.apiUrl}/orders/${revisionOrderId}/revision-request`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ reason: revisionReason, notes: revisionNotes || undefined }),
                    });
                    if (!res.ok) throw new Error(`API ${res.status}`);
                    toast.success('Sent back to Design');
                    setShowRevisionModal(false);
                    setRevisionReason('');
                    setRevisionNotes('');
                    fetchOrders();
                  } catch {
                    toast.error('Failed to send revision request');
                  }
                }}
                disabled={!revisionReason}
                className="flex-1 px-4 py-2 text-sm text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50"
              >
                Send to Design
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────
// Order Detail Panel — full-screen view for a single order
// ────────────────────────────────────────────────────────

function OrderDetailPanel({
  order,
  userStations,
  selectedStation,
  isUpdating,
  wsStatus,
  onStart,
  onComplete,
  onUncomplete,
  onBack,
}: {
  order: WorkOrder;
  userStations: PrintStation[];
  selectedStation: PrintStation | null;
  isUpdating: boolean;
  wsStatus: WsStatus;
  onStart: (orderId: string, station: string) => void;
  onComplete: (orderId: string, station: string) => void;
  onUncomplete: (orderId: string, station: string) => void;
  onBack: () => void;
}) {
  const dueDate = order.dueDate ? new Date(order.dueDate) : null;
  const overdue = dueDate ? dueDate < new Date() : false;
  const pri = PRIORITY_CONFIG[order.priority] || PRIORITY_CONFIG[3];
  const orderPrintStations = order.routing.filter(isPrintStation) as PrintStation[];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-blue-600 text-white">
        <div className="flex items-center gap-3 px-4 pt-3 pb-2">
          <button onClick={onBack} className="p-1.5 -ml-1 rounded-full hover:bg-white/20 active:bg-white/30">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold">{order.orderNumber}</h2>
              {order.priority <= 2 && (
                <span className="px-1.5 py-0.5 bg-red-500/90 text-white text-[10px] font-bold rounded uppercase">
                  {pri.label}
                </span>
              )}
            </div>
            <p className="text-white/80 text-sm truncate">{order.customerName}</p>
          </div>
          {dueDate && (
            <div className={`text-right text-xs px-2 py-1 rounded-lg ${overdue ? 'bg-red-600/50 text-red-100 font-bold' : 'bg-white/10 text-white/80'}`}>
              <Clock className="w-3 h-3 inline mr-1" />
              {overdue ? 'OVERDUE' : dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
          )}
          {!dueDate && <span className="text-xs text-white/50">No due date</span>}
        </div>
        {/* Routing breadcrumb */}
        <div className="px-4 pb-2.5 flex items-center gap-0.5 overflow-x-auto">
          {order.routing.map((rt, i) => {
            const stStatus = getStationStatus(order, rt);
            return (
              <div key={rt} className="flex items-center gap-0.5 flex-shrink-0">
                {i > 0 && <ChevronRight className="w-3 h-3 text-white/30" />}
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${
                    stStatus === 'COMPLETED'
                      ? 'bg-white/25 text-white'
                      : stStatus === 'IN_PROGRESS'
                      ? 'bg-white text-gray-900 font-bold'
                      : 'text-white/40'
                  }`}
                >
                  {stStatus === 'COMPLETED' && <CheckCircle className="w-2.5 h-2.5 inline mr-0.5" />}
                  {ALL_STATION_LABELS[rt] || rt}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        {/* Description + Notes */}
        <div className="px-4 pt-3 pb-2">
          {order.description && <p className="text-sm text-gray-800 leading-snug">{order.description}</p>}
          {order.notes && (
            <div className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-500" />
              <span>{order.notes}</span>
            </div>
          )}
        </div>

        {/* Print Station Actions — the main purpose of this view */}
        <div className="px-4 py-3">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Print Stations</h3>
          <div className="space-y-3">
            {orderPrintStations.map((ps) => {
              const stStatus = getStationStatus(order, ps);
              const cfg = STATION_CONFIG[ps];
              const prog = order.stationProgress.find((sp) => sp.station === ps);
              return (
                <div
                  key={ps}
                  className={`rounded-xl border-2 p-4 ${
                    stStatus === 'IN_PROGRESS'
                      ? `${cfg.bg} ${cfg.border}`
                      : stStatus === 'COMPLETED'
                      ? 'bg-green-50 border-green-200'
                      : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Printer className={`h-5 w-5 ${stStatus === 'COMPLETED' ? 'text-green-500' : cfg.icon}`} />
                      <div>
                        <span className={`font-semibold text-sm ${stStatus === 'COMPLETED' ? 'text-green-700' : cfg.color}`}>
                          {cfg.label}
                        </span>
                        <div className="text-xs text-gray-500">
                          {stStatus === 'COMPLETED' && prog?.completedAt
                            ? `Completed ${formatDate(prog.completedAt)}`
                            : stStatus === 'IN_PROGRESS' && prog?.startedAt
                            ? `Started ${formatDate(prog.startedAt)}`
                            : 'Waiting'}
                        </div>
                      </div>
                    </div>

                    {stStatus === 'NOT_STARTED' && (
                      <button
                        onClick={() => onStart(order.id, ps)}
                        disabled={isUpdating}
                        className="px-5 py-2.5 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
                      >
                        <PlayCircle className="h-5 w-5" /> Start
                      </button>
                    )}
                    {stStatus === 'IN_PROGRESS' && (
                      <button
                        onClick={() => onComplete(order.id, ps)}
                        disabled={isUpdating}
                        className="px-5 py-2.5 text-sm font-semibold bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
                      >
                        <CheckCircle className="h-5 w-5" /> Complete
                      </button>
                    )}
                    {stStatus === 'COMPLETED' && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-green-600 flex items-center gap-1">
                          <CheckCircle className="h-5 w-5" /> Done
                        </span>
                        <button
                          onClick={() => onUncomplete(order.id, ps)}
                          disabled={isUpdating}
                          className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                          title="Undo completion"
                        >
                          <Undo2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {orderPrintStations.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">
                No print stations in this order's routing
              </p>
            )}
          </div>
        </div>

        {/* Line Items */}
        {order.lineItems && order.lineItems.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-200">
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">
              Line Items ({order.lineItems.length})
            </h3>
            <div className="space-y-2">
              {order.lineItems.map((item) => (
                <div key={item.id} className="flex items-center gap-3 bg-white rounded-lg border border-gray-100 px-3 py-2">
                  <span className="text-xs text-gray-400 w-5 text-right font-mono">{item.itemNumber}.</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 truncate">{item.description || item.itemMaster?.name || 'Item'}</p>
                  </div>
                  <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Qty: {item.quantity}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Order Info */}
        <div className="px-4 py-3 border-t border-gray-200">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Order Info</h3>
          <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
            <div>
              <span className="text-gray-500">Status</span>
              <p className="font-medium text-gray-800">{order.status.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <span className="text-gray-500">Priority</span>
              <p className="font-medium">
                <span className={`px-2 py-0.5 text-xs rounded-full ${pri.color} ${pri.textColor}`}>{pri.label}</span>
              </p>
            </div>
            {order.assignedTo && (
              <div>
                <span className="text-gray-500">Assigned To</span>
                <p className="font-medium text-gray-800">{order.assignedTo.displayName}</p>
              </div>
            )}
            <div>
              <span className="text-gray-500">Due Date</span>
              <p className={`font-medium ${overdue ? 'text-red-600' : 'text-gray-800'}`}>
                {order.dueDate
                  ? new Date(order.dueDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                  : 'Not set'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
