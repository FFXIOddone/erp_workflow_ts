/**
 * Order Entry Station View — Brenda's spreadsheet-style order entry interface.
 *
 * Features:
 * - Change order status inline (click status badge)
 * - Edit routing on existing orders (click pencil next to stations)
 * - Click station badges to toggle complete/uncomplete
 * - Customer autocomplete from DB
 * - Description autocomplete from recent orders
 * - Routing auto-guess from description keywords
 * - Due date quick-pick (frequency-based + common dates)
 * - Connection status indicator (WebSocket)
 * - Enter = save, Tab = move fields — optimized for speed
 */
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Edit3,
  ClipboardList,
  ExternalLink,
  Wifi,
  WifiOff,
  Circle,
  CheckCircle2,
  PlayCircle,
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import {
  PrintingMethod,
  OrderStatus,
  STATION_DISPLAY_NAMES,
  STATUS_DISPLAY_NAMES,
  STATUS_COLORS,
  inferRoutingFromOrderDetails,
  isDesignOnlyOrder,
  stripOrderCategoryTags,
} from '@erp/shared';
import { api } from '../lib/api';
import { buildDesignFollowOnPayload, fetchOrderRecreationSource, isDesignOnlySource } from '../lib/order-recreation';
import { useWebSocket } from '../hooks/useWebSocket';

// ─── Types ──────────────────────────────────────────

interface OrderRow {
  id: string;
  orderNumber: string;
  customerName: string;
  description: string;
  status: string;
  priority: number;
  dueDate: string | null;
  routing: string[];
  notes: string | null;
  companyBrand: string;
  createdAt: string;
  customerId: string | null;
  stationProgress: { id: string; station: string; status: string; completedAt: string | null }[];
}

interface NewOrderDraft {
  orderNumber: string;
  customerName: string;
  description: string;
  priority: number;
  dueDate: string;
  notes: string;
  companyBrand: string;
  routing: string[];
  category: string;
}

const CATEGORIES = [
  { value: '', label: 'Standard' },
  { value: '(OUTSOURCED)', label: 'Outsourced' },
  { value: '(DESIGN ONLY)', label: 'Design Only' },
  { value: '(INSTALL)', label: 'Install' },
  { value: '(INV)', label: 'Inventory' },
  { value: '(COM)', label: 'Commercial' },
] as const;

const ROUTING_PRESETS = [
  { label: 'FB  (Flatbed)', stations: [PrintingMethod.FLATBED] },
  { label: 'MM  (Mimaki / Roll-to-Roll)', stations: [PrintingMethod.ROLL_TO_ROLL] },
  { label: 'SP  (Screen Print)', stations: [PrintingMethod.SCREEN_PRINT] },
  { label: 'Prod + Ship Only', stations: [PrintingMethod.PRODUCTION, PrintingMethod.SHIPPING_RECEIVING] },
  { label: 'Ship Only', stations: [PrintingMethod.SHIPPING_RECEIVING] },
  { label: 'Design + FB', stations: [PrintingMethod.DESIGN, PrintingMethod.FLATBED] },
  { label: 'Design + MM', stations: [PrintingMethod.DESIGN, PrintingMethod.ROLL_TO_ROLL] },
] as const;

const ORDER_STATUSES = [
  OrderStatus.PENDING,
  OrderStatus.IN_PROGRESS,
  OrderStatus.ON_HOLD,
  OrderStatus.COMPLETED,
  OrderStatus.SHIPPED,
  OrderStatus.CANCELLED,
];

const STATION_ABBREVS: Record<string, string> = {
  ORDER_ENTRY: 'OE',
  DESIGN: 'Des',
  FLATBED: 'FB',
  ROLL_TO_ROLL: 'MM',
  SCREEN_PRINT: 'SP',
  PRODUCTION: 'Prod',
  PRODUCTION_ZUND: 'Zund',
  INSTALLATION: 'Inst',
  SHIPPING_RECEIVING: 'Ship',
  SALES: 'Sales',
};

function generateTempOrderNumber(): string {
  const random = Math.floor(Math.random() * 900000) + 100000;
  return 'TEMPWO-' + random;
}

function emptyDraft(): NewOrderDraft {
  return {
    orderNumber: generateTempOrderNumber(),
    customerName: '',
    description: '',
    priority: 3,
    dueDate: '',
    notes: '',
    companyBrand: 'WILDE_SIGNS',
    routing: [],
    category: '',
  };
}

function buildDraftDescription(description: string, category: string): string {
  return category ? `${description} ${category}`.trim() : description.trim();
}

// ─── Main Component ─────────────────────────────────

export function OrderEntryStationView() {
  const queryClient = useQueryClient();
  const { status: wsStatus } = useWebSocket();
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewRow, setShowNewRow] = useState(false);
  const [draft, setDraft] = useState<NewOrderDraft>(emptyDraft());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<OrderRow>>({});
  const [sortField, setSortField] = useState<'dueDate' | 'orderNumber' | 'customerName' | 'createdAt'>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showRoutingPicker, setShowRoutingPicker] = useState(false);
  const [editRoutingId, setEditRoutingId] = useState<string | null>(null);
  const [editRoutingStations, setEditRoutingStations] = useState<string[]>([]);
  const [statusDropdownId, setStatusDropdownId] = useState<string | null>(null);

  // Autocomplete state
  const [customerSuggestions, setCustomerSuggestions] = useState<{ id: string; name: string; companyName: string | null }[]>([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [descSuggestions, setDescSuggestions] = useState<string[]>([]);
  const [showDescDropdown, setShowDescDropdown] = useState(false);
  const [showDueDateDropdown, setShowDueDateDropdown] = useState(false);

  // Track due dates entered this session for frequency-based suggestion
  const [sessionDueDates, setSessionDueDates] = useState<string[]>([]);

  const newRowRef = useRef<HTMLInputElement | null>(null);

  // ─── Data Fetching ──────────────────────────────────

  const { data: orders = [], isLoading, refetch } = useQuery<OrderRow[]>({
    queryKey: ['order-entry-orders'],
    queryFn: async () => {
      const res = await api.get('/orders', {
        params: {
          pageSize: 200,
          sortBy: 'createdAt',
          sortOrder: 'desc',
          status: 'PENDING,IN_PROGRESS,ON_HOLD',
          lightweight: true,
        },
      });
      const items = res.data.data.items ?? res.data.data ?? [];
      return Array.isArray(items) ? items : [];
    },
    refetchInterval: 15000,
    staleTime: 5000,
  });

  const recentDescriptions = useMemo(() => {
    const descs = orders.map((order) => order.description).filter(Boolean);
    const cleaned = descs.map((description) => stripOrderCategoryTags(description));
    return [...new Set(cleaned)].slice(0, 50);
  }, [orders]);

  // ─── Customer Autocomplete ──────────────────────────

  const searchCustomers = useCallback(async (query: string) => {
    if (query.length < 1) { setCustomerSuggestions([]); return; }
    try {
      const res = await api.get('/customers', { params: { search: query, pageSize: 8, isActive: true } });
      setCustomerSuggestions(res.data.data.items || []);
    } catch { setCustomerSuggestions([]); }
  }, []);

  // ─── Description Autocomplete ───────────────────────

  const filterDescriptions = useCallback((query: string) => {
    if (query.length < 2) { setDescSuggestions([]); return; }
    const q = query.toLowerCase();
    setDescSuggestions(recentDescriptions.filter(d => d.toLowerCase().includes(q)).slice(0, 6));
  }, [recentDescriptions]);

  // ─── Routing Auto-guess from Description ────────────

  const guessRoutingFromDescription = useCallback((desc: string): PrintingMethod[] => {
    return inferRoutingFromOrderDetails({ description: desc });
  }, []);

  // ─── Due Date Suggestions ───────────────────────────

  const dueDateSuggestions = useMemo(() => {
    const freq: Record<string, number> = {};
    for (const d of sessionDueDates) freq[d] = (freq[d] || 0) + 1;
    orders.forEach(o => {
      if (o.dueDate) {
        const d = o.dueDate.split('T')[0];
        freq[d] = (freq[d] || 0) + 0.5;
      }
    });
    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).map(([d]) => d).slice(0, 4);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tStr = tomorrow.toISOString().split('T')[0];
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nwStr = nextWeek.toISOString().split('T')[0];
    if (!sorted.includes(tStr)) sorted.push(tStr);
    if (!sorted.includes(nwStr)) sorted.push(nwStr);
    return sorted.slice(0, 5);
  }, [sessionDueDates, orders]);

  // ─── Mutations ──────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: async (data: object) => api.post('/orders', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-entry-orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Order created!');
      if (draft.dueDate) setSessionDueDates(prev => [...prev, draft.dueDate]);
      setDraft(emptyDraft());
      setShowNewRow(true);
      setTimeout(() => newRowRef.current?.focus(), 100);
    },
    onError: () => toast.error('Failed to create order'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: object }) => api.patch('/orders/' + id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-entry-orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Updated!');
      setEditingId(null);
      setEditDraft({});
    },
    onError: () => toast.error('Failed to update'),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => api.patch('/orders/' + id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-entry-orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setStatusDropdownId(null);
    },
    onError: () => toast.error('Failed to change status'),
  });

  const stationMutation = useMutation({
    mutationFn: async ({ orderId, station, action }: { orderId: string; station: string; action: 'complete' | 'uncomplete' }) =>
      action === 'complete'
        ? api.post('/orders/' + orderId + '/stations/' + station + '/complete')
        : api.post('/orders/' + orderId + '/stations/' + station + '/uncomplete'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-entry-orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: () => toast.error('Failed to update station'),
  });

  const routingMutation = useMutation({
    mutationFn: async ({ id, routing }: { id: string; routing: string[] }) =>
      api.post('/orders/' + id + '/routing', { routing }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-entry-orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setEditRoutingId(null);
      toast.success('Routing updated!');
    },
    onError: () => toast.error('Failed to update routing'),
  });

  // ─── Filter & Sort ──────────────────────────────────

  const filteredOrders = useMemo(() => {
    let result = orders;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(o =>
        o.orderNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        (o.description || '').toLowerCase().includes(q) ||
        (o.notes || '').toLowerCase().includes(q),
      );
    }
    return [...result].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'dueDate') {
        const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        cmp = da - db;
      } else if (sortField === 'orderNumber') {
        cmp = a.orderNumber.localeCompare(b.orderNumber);
      } else if (sortField === 'customerName') {
        cmp = a.customerName.localeCompare(b.customerName);
      } else {
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [orders, searchQuery, sortField, sortDir]);

  // ─── Handlers ───────────────────────────────────────

  const handleCreateOrder = () => {
    if (!draft.customerName.trim()) { toast.error('Customer name required'); return; }
    if (!draft.description.trim()) { toast.error('Description required'); return; }
    const fullDesc = buildDraftDescription(draft.description, draft.category);
    const inferredRouting = guessRoutingFromDescription(fullDesc);
    const routing = isDesignOnlyOrder({ description: fullDesc, routing: draft.routing })
      ? [PrintingMethod.DESIGN]
      : draft.routing.length > 0
        ? draft.routing
        : inferredRouting;
    createMutation.mutate({
      orderNumber: draft.orderNumber,
      customerName: draft.customerName,
      description: fullDesc,
      priority: draft.priority,
      dueDate: draft.dueDate || null,
      notes: draft.notes || null,
      companyBrand: draft.companyBrand,
      routing,
      lineItems: [],
    });
  };

  const handleDescriptionChange = (value: string) => {
    const fullDesc = buildDraftDescription(value, draft.category);
    const guessed = guessRoutingFromDescription(fullDesc);
    const shouldReplaceRouting =
      draft.routing.length === 0 || isDesignOnlyOrder({ description: fullDesc, routing: draft.routing });

    setDraft((currentDraft) => ({
      ...currentDraft,
      description: value,
      routing: shouldReplaceRouting ? guessed : currentDraft.routing,
    }));
    filterDescriptions(value);
    setShowDescDropdown(true);
  };

  const handleToggleStation = async (order: OrderRow, station: string, isDone: boolean) => {
    if (isDone) {
      stationMutation.mutate({ orderId: order.id, station, action: 'uncomplete' });
      return;
    }

    const isDesignOnlyDesignStation =
      station === PrintingMethod.DESIGN && isDesignOnlySource(order);

    if (isDesignOnlyDesignStation) {
      const confirmed = window.confirm(
        `Mark design complete for ${order.orderNumber}? This will close the design-only order.`,
      );
      if (!confirmed) return;
    }

    try {
      await stationMutation.mutateAsync({ orderId: order.id, station, action: 'complete' });
    } catch {
      return;
    }

    if (!isDesignOnlyDesignStation) {
      return;
    }

    const shouldCreateFollowOn = window.confirm(
      `Create a new work order from ${order.orderNumber} now?`,
    );
    if (!shouldCreateFollowOn) {
      return;
    }

    try {
      const source = await fetchOrderRecreationSource(order.id);
      const response = await api.post('/orders', buildDesignFollowOnPayload(source));
      const newOrder = response.data.data;
      queryClient.invalidateQueries({ queryKey: ['order-entry-orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success(`Created ${newOrder.orderNumber} from ${order.orderNumber}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || 'Failed to create follow-on order');
    }
  };

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3 inline ml-0.5" /> : <ChevronDown className="w-3 h-3 inline ml-0.5" />;
  };

  useEffect(() => {
    if (showNewRow && newRowRef.current) newRowRef.current.focus();
  }, [showNewRow]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = () => { setStatusDropdownId(null); };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const fmtDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const fmtDateLong = (dateStr: string) => {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* ── Toolbar ── */}
      <div className="bg-white border-b px-3 py-2">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Connection Status */}
          <div className={clsx(
            'flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium',
            wsStatus === 'connected' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
          )}>
            {wsStatus === 'connected' ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {wsStatus === 'connected' ? 'Live' : 'Offline'}
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search orders..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
            />
          </div>

          <button
            onClick={() => { setShowNewRow(true); setDraft(emptyDraft()); }}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg shadow-sm transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            New Order
          </button>

          <button onClick={() => refetch()} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg" title="Refresh">
            <RefreshCw className={clsx('w-4 h-4', isLoading && 'animate-spin')} />
          </button>

          <span className="text-xs text-gray-400">{filteredOrders.length} orders</span>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-100 border-b-2 border-gray-300 text-xs">
              <th className="text-left px-2 py-2 font-bold text-gray-700 cursor-pointer hover:bg-gray-200 select-none whitespace-nowrap" onClick={() => toggleSort('orderNumber')} style={{ width: '100px' }}>
                WO# <SortIcon field="orderNumber" />
              </th>
              <th className="text-left px-2 py-2 font-bold text-gray-700 cursor-pointer hover:bg-gray-200 select-none whitespace-nowrap" onClick={() => toggleSort('customerName')} style={{ width: '160px' }}>
                Customer <SortIcon field="customerName" />
              </th>
              <th className="text-left px-2 py-2 font-bold text-gray-700" style={{ minWidth: '180px' }}>Description</th>
              <th className="text-left px-2 py-2 font-bold text-gray-700 whitespace-nowrap" style={{ minWidth: '220px' }}>Routing</th>
              <th className="text-left px-2 py-2 font-bold text-gray-700 cursor-pointer hover:bg-gray-200 select-none whitespace-nowrap" onClick={() => toggleSort('dueDate')} style={{ width: '90px' }}>
                Due <SortIcon field="dueDate" />
              </th>
              <th className="text-left px-2 py-2 font-bold text-gray-700" style={{ width: '90px' }}>Status</th>
              <th className="text-left px-2 py-2 font-bold text-gray-700" style={{ width: '140px' }}>Notes</th>
              <th className="text-center px-2 py-2 font-bold text-gray-700" style={{ width: '60px' }}>Act</th>
            </tr>
          </thead>
          <tbody>
            {/* ── New Order Row ── */}
            {showNewRow && (
              <NewOrderRow
                draft={draft}
                setDraft={setDraft}
                onSave={handleCreateOrder}
                onCancel={() => setShowNewRow(false)}
                onDescriptionChange={handleDescriptionChange}
                isSaving={createMutation.isPending}
                showRoutingPicker={showRoutingPicker}
                setShowRoutingPicker={setShowRoutingPicker}
                customerSuggestions={customerSuggestions}
                showCustomerDropdown={showCustomerDropdown}
                setShowCustomerDropdown={setShowCustomerDropdown}
                searchCustomers={searchCustomers}
                descSuggestions={descSuggestions}
                showDescDropdown={showDescDropdown}
                setShowDescDropdown={setShowDescDropdown}
                dueDateSuggestions={dueDateSuggestions}
                showDueDateDropdown={showDueDateDropdown}
                setShowDueDateDropdown={setShowDueDateDropdown}
                fmtDateLong={fmtDateLong}
                guessRoutingFromDescription={guessRoutingFromDescription}
                newRowRef={newRowRef}
              />
            )}

            {/* ── Existing Orders ── */}
            {isLoading ? (
              <tr><td colSpan={8} className="text-center py-12"><RefreshCw className="w-6 h-6 text-gray-300 animate-spin mx-auto mb-2" /><p className="text-gray-400">Loading...</p></td></tr>
            ) : filteredOrders.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12"><ClipboardList className="w-8 h-8 text-gray-300 mx-auto mb-2" /><p className="text-gray-400">No orders found</p></td></tr>
            ) : (
              filteredOrders.map((order, idx) => (
                <OrderTableRow
                  key={order.id}
                  order={order}
                  idx={idx}
                  isEditing={editingId === order.id}
                  editDraft={editDraft}
                  setEditDraft={setEditDraft}
                  onStartEdit={() => {
                    setEditingId(order.id);
                    setEditDraft({ customerName: order.customerName, description: order.description, priority: order.priority, dueDate: order.dueDate, notes: order.notes });
                  }}
                  onCancelEdit={() => { setEditingId(null); setEditDraft({}); }}
                  onSaveEdit={() => updateMutation.mutate({ id: order.id, data: editDraft })}
                  isSaving={updateMutation.isPending}
                  isEditingRouting={editRoutingId === order.id}
                  editRoutingStations={editRoutingStations}
                  setEditRoutingStations={setEditRoutingStations}
                  onStartEditRouting={() => { setEditRoutingId(order.id); setEditRoutingStations([...order.routing]); }}
                  onCancelEditRouting={() => { setEditRoutingId(null); setEditRoutingStations([]); }}
                  onSaveRouting={() => routingMutation.mutate({ id: order.id, routing: editRoutingStations })}
                  showStatusDropdown={statusDropdownId === order.id}
                  onToggleStatusDropdown={(e: React.MouseEvent) => { e.stopPropagation(); setStatusDropdownId(statusDropdownId === order.id ? null : order.id); }}
                  onChangeStatus={(status: string) => statusMutation.mutate({ id: order.id, status })}
                  onToggleStation={(station: string, isDone: boolean) => handleToggleStation(order, station, isDone)}
                  stationMutationPending={stationMutation.isPending}
                  fmtDate={fmtDate}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Bottom Bar ── */}
      <div className="px-3 py-2 bg-gray-100 border-t flex items-center justify-between text-xs text-gray-500">
        <span>Order Entry &middot; {filteredOrders.length} active &middot; 15s refresh</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400">Enter = save &middot; Click station = toggle</span>
          <span className="flex items-center gap-1 text-amber-600 font-medium">
            <ClipboardList className="w-3 h-3" />
            Order Entry
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── New Order Row Sub-component ────────────────────

interface NewOrderRowProps {
  draft: NewOrderDraft;
  setDraft: React.Dispatch<React.SetStateAction<NewOrderDraft>>;
  onSave: () => void;
  onCancel: () => void;
  onDescriptionChange: (v: string) => void;
  isSaving: boolean;
  showRoutingPicker: boolean;
  setShowRoutingPicker: (v: boolean) => void;
  customerSuggestions: { id: string; name: string; companyName: string | null }[];
  showCustomerDropdown: boolean;
  setShowCustomerDropdown: (v: boolean) => void;
  searchCustomers: (q: string) => void;
  descSuggestions: string[];
  showDescDropdown: boolean;
  setShowDescDropdown: (v: boolean) => void;
  dueDateSuggestions: string[];
  showDueDateDropdown: boolean;
  setShowDueDateDropdown: (v: boolean) => void;
  fmtDateLong: (d: string) => string;
  guessRoutingFromDescription: (d: string) => PrintingMethod[];
  newRowRef: React.RefObject<HTMLInputElement | null>;
}

function NewOrderRow({
  draft, setDraft, onSave, onCancel, onDescriptionChange, isSaving,
  showRoutingPicker, setShowRoutingPicker,
  customerSuggestions, showCustomerDropdown, setShowCustomerDropdown, searchCustomers,
  descSuggestions, showDescDropdown, setShowDescDropdown,
  dueDateSuggestions, showDueDateDropdown, setShowDueDateDropdown, fmtDateLong,
  guessRoutingFromDescription, newRowRef,
}: NewOrderRowProps) {
  return (
    <tr className="bg-amber-50 border-b-2 border-amber-300">
      {/* WO# */}
      <td className="px-2 py-1.5">
        <input type="text" value={draft.orderNumber} onChange={e => setDraft(d => ({ ...d, orderNumber: e.target.value }))}
          className="w-full px-1.5 py-1.5 border border-amber-300 rounded text-sm font-mono bg-white focus:ring-2 focus:ring-amber-400" placeholder="WO#" />
      </td>
      {/* Customer */}
      <td className="px-2 py-1.5 relative">
        <input ref={newRowRef as React.RefObject<HTMLInputElement>} type="text" value={draft.customerName}
          onChange={e => { setDraft(d => ({ ...d, customerName: e.target.value })); searchCustomers(e.target.value); setShowCustomerDropdown(true); }}
          onFocus={() => { if (draft.customerName.length >= 1) { searchCustomers(draft.customerName); setShowCustomerDropdown(true); } }}
          onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
          className="w-full px-1.5 py-1.5 border border-amber-300 rounded text-sm bg-white focus:ring-2 focus:ring-amber-400" placeholder="Customer" />
        {showCustomerDropdown && customerSuggestions.length > 0 && (
          <div className="absolute z-30 left-2 right-2 mt-0.5 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-auto">
            {customerSuggestions.map(c => (
              <button key={c.id} type="button" onMouseDown={() => { setDraft(d => ({ ...d, customerName: c.companyName || c.name })); setShowCustomerDropdown(false); }}
                className="w-full px-2 py-1.5 text-left hover:bg-amber-50 text-sm">
                <span className="font-medium">{c.companyName || c.name}</span>
                {c.companyName && c.name !== c.companyName && <span className="text-gray-400 ml-1 text-xs">({c.name})</span>}
              </button>
            ))}
          </div>
        )}
      </td>
      {/* Description + Category */}
      <td className="px-2 py-1.5 relative">
        <div className="flex gap-1">
          <div className="flex-1 relative">
            <input type="text" value={draft.description}
              onChange={e => onDescriptionChange(e.target.value)}
              onFocus={() => { if (draft.description.length >= 2) { setShowDescDropdown(true); } }}
              onBlur={() => setTimeout(() => setShowDescDropdown(false), 200)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSave(); } }}
              className="w-full px-1.5 py-1.5 border border-amber-300 rounded text-sm bg-white focus:ring-2 focus:ring-amber-400" placeholder="Description" />
            {showDescDropdown && descSuggestions.length > 0 && (
              <div className="absolute z-30 left-0 right-0 mt-0.5 bg-white border border-gray-200 rounded-lg shadow-lg max-h-36 overflow-auto">
                {descSuggestions.map((d, i) => (
                  <button key={i} type="button" onMouseDown={() => {
                    const fullDesc = buildDraftDescription(d, draft.category);
                    const guessed = guessRoutingFromDescription(fullDesc);
                    const shouldReplaceRouting =
                      draft.routing.length === 0 || isDesignOnlyOrder({ description: fullDesc, routing: draft.routing });

                    setDraft((prev) => ({
                      ...prev,
                      description: d,
                      routing: shouldReplaceRouting ? guessed : prev.routing,
                    }));
                    setShowDescDropdown(false);
                  }} className="w-full px-2 py-1.5 text-left hover:bg-amber-50 text-sm truncate">{d}</button>
                ))}
              </div>
            )}
          </div>
          <select
            value={draft.category}
            onChange={(e) => {
              const category = e.target.value;
              const fullDesc = buildDraftDescription(draft.description, category);
              const guessed = guessRoutingFromDescription(fullDesc);
              const shouldReplaceRouting =
                draft.routing.length === 0 || isDesignOnlyOrder({ description: fullDesc, routing: draft.routing });

              setDraft((currentDraft) => ({
                ...currentDraft,
                category,
                routing: shouldReplaceRouting ? guessed : currentDraft.routing,
              }));
            }}
            className="px-1 py-1.5 border border-amber-300 rounded text-xs bg-white w-20" title="Category">
            {CATEGORIES.map(c => (<option key={c.value} value={c.value}>{c.label}</option>))}
          </select>
        </div>
      </td>
      {/* Routing Picker */}
      <td className="px-2 py-1.5">
        <div className="relative">
          <button type="button" onClick={() => setShowRoutingPicker(!showRoutingPicker)}
            className="w-full px-1.5 py-1.5 border border-amber-300 rounded text-xs bg-white text-left flex items-center justify-between hover:bg-amber-50">
            <span className={draft.routing.length ? 'text-gray-900' : 'text-gray-400'}>
              {draft.routing.length ? draft.routing.map(s => STATION_ABBREVS[s] || s).join(' \u2192 ') : 'Select routing...'}
            </span>
            <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" />
          </button>
          {showRoutingPicker && (
            <div className="absolute z-30 left-0 mt-0.5 bg-white border border-gray-200 rounded-lg shadow-lg p-2 w-52">
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Presets</p>
              {ROUTING_PRESETS.map(preset => (
                <button key={preset.label} type="button"
                  onMouseDown={() => { setDraft(d => ({ ...d, routing: [...preset.stations] })); setShowRoutingPicker(false); }}
                  className="w-full text-left px-2 py-1 rounded hover:bg-amber-50 text-xs">{preset.label}</button>
              ))}
              <hr className="my-1" />
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">All</p>
              {Object.values(PrintingMethod).map(s => (
                <label key={s} className="flex items-center gap-1.5 px-1.5 py-0.5 hover:bg-gray-50 rounded cursor-pointer text-xs">
                  <input type="checkbox" checked={draft.routing.includes(s)}
                    onChange={e => { if (e.target.checked) setDraft(d => ({ ...d, routing: [...d.routing, s] })); else setDraft(d => ({ ...d, routing: d.routing.filter(r => r !== s) })); }}
                    className="rounded border-gray-300 text-amber-500 focus:ring-amber-400 w-3 h-3" />
                  {STATION_DISPLAY_NAMES[s]}
                </label>
              ))}
              <button type="button" onMouseDown={() => setShowRoutingPicker(false)}
                className="w-full mt-1 py-1 text-xs text-gray-500 hover:text-gray-700 border-t">Done</button>
            </div>
          )}
        </div>
      </td>
      {/* Due Date */}
      <td className="px-2 py-1.5 relative">
        <input type="date" value={draft.dueDate} onChange={e => setDraft(d => ({ ...d, dueDate: e.target.value }))}
          onFocus={() => setShowDueDateDropdown(true)} onBlur={() => setTimeout(() => setShowDueDateDropdown(false), 200)}
          className="w-full px-1 py-1.5 border border-amber-300 rounded text-xs bg-white focus:ring-2 focus:ring-amber-400" />
        {showDueDateDropdown && dueDateSuggestions.length > 0 && (
          <div className="absolute z-30 left-2 right-2 mt-0.5 bg-white border border-gray-200 rounded-lg shadow-lg">
            <p className="text-[10px] text-gray-400 px-2 pt-1">Quick dates</p>
            {dueDateSuggestions.map(d => (
              <button key={d} type="button" onMouseDown={() => { setDraft(prev => ({ ...prev, dueDate: d })); setShowDueDateDropdown(false); }}
                className="w-full px-2 py-1 text-left hover:bg-amber-50 text-xs">{fmtDateLong(d)}</button>
            ))}
          </div>
        )}
      </td>
      {/* Status */}
      <td className="px-2 py-1.5">
        <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">NEW</span>
      </td>
      {/* Notes */}
      <td className="px-2 py-1.5">
        <input type="text" value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
          className="w-full px-1.5 py-1.5 border border-amber-300 rounded text-xs bg-white focus:ring-2 focus:ring-amber-400" placeholder="Notes"
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSave(); } }} />
      </td>
      {/* Actions */}
      <td className="px-2 py-1.5">
        <div className="flex items-center gap-0.5 justify-center">
          <button type="button" onClick={onSave} disabled={isSaving}
            className="p-1.5 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50" title="Save (Enter)">
            <Check className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={onCancel}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100" title="Cancel">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Order Row Sub-component ────────────────────────

interface OrderTableRowProps {
  order: OrderRow;
  idx: number;
  isEditing: boolean;
  editDraft: Partial<OrderRow>;
  setEditDraft: React.Dispatch<React.SetStateAction<Partial<OrderRow>>>;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  isSaving: boolean;
  isEditingRouting: boolean;
  editRoutingStations: string[];
  setEditRoutingStations: React.Dispatch<React.SetStateAction<string[]>>;
  onStartEditRouting: () => void;
  onCancelEditRouting: () => void;
  onSaveRouting: () => void;
  showStatusDropdown: boolean;
  onToggleStatusDropdown: (e: React.MouseEvent) => void;
  onChangeStatus: (status: string) => void;
  onToggleStation: (station: string, isDone: boolean) => void;
  stationMutationPending: boolean;
  fmtDate: (d: string | null) => string;
}

function OrderTableRow({
  order, idx, isEditing, editDraft, setEditDraft,
  onStartEdit, onCancelEdit, onSaveEdit, isSaving,
  isEditingRouting, editRoutingStations, setEditRoutingStations,
  onStartEditRouting, onCancelEditRouting, onSaveRouting,
  showStatusDropdown, onToggleStatusDropdown, onChangeStatus,
  onToggleStation, stationMutationPending, fmtDate,
}: OrderTableRowProps) {
  const statusColor = STATUS_COLORS[order.status] || '#6b7280';
  const isOverdue = order.dueDate && new Date(order.dueDate) < new Date() && !['COMPLETED', 'SHIPPED', 'CANCELLED'].includes(order.status);

  return (
    <tr className={clsx(
      'border-b border-gray-200 transition-colors text-sm',
      idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50',
      isEditing && 'bg-blue-50 border-blue-200',
      isOverdue && !isEditing && 'bg-red-50/40',
    )}>
      {/* WO# */}
      <td className="px-2 py-1.5">
        <span className="font-mono text-sm font-semibold text-gray-900">{order.orderNumber}</span>
      </td>

      {/* Customer */}
      <td className="px-2 py-1.5">
        {isEditing ? (
          <input type="text" value={editDraft.customerName || ''} onChange={e => setEditDraft(d => ({ ...d, customerName: e.target.value }))}
            className="w-full px-1.5 py-1 border border-blue-300 rounded text-sm bg-white" />
        ) : (
          <span className="text-sm text-gray-900 font-medium truncate block max-w-[160px]" title={order.customerName}>{order.customerName}</span>
        )}
      </td>

      {/* Description */}
      <td className="px-2 py-1.5">
        {isEditing ? (
          <input type="text" value={editDraft.description || ''} onChange={e => setEditDraft(d => ({ ...d, description: e.target.value }))}
            className="w-full px-1.5 py-1 border border-blue-300 rounded text-sm bg-white" />
        ) : (
          <span className="text-sm text-gray-800 line-clamp-1" title={order.description}>{order.description}</span>
        )}
      </td>

      {/* Routing — station badges (clickable to toggle) */}
      <td className="px-2 py-1.5">
        {isEditingRouting ? (
          <div className="flex flex-wrap gap-0.5 items-center">
            {Object.values(PrintingMethod).map(s => {
              const isIn = editRoutingStations.includes(s);
              return (
                <button key={s} type="button"
                  onClick={() => setEditRoutingStations(prev => isIn ? prev.filter(r => r !== s) : [...prev, s])}
                  className={clsx(
                    'px-1 py-0.5 rounded text-[10px] font-medium border transition-colors',
                    isIn ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100',
                  )}>
                  {STATION_ABBREVS[s] || s}
                </button>
              );
            })}
            <button onClick={onSaveRouting} className="p-0.5 bg-green-500 text-white rounded ml-1" title="Save routing"><Check className="w-3 h-3" /></button>
            <button onClick={onCancelEditRouting} className="p-0.5 text-gray-400 hover:text-gray-600 rounded" title="Cancel"><X className="w-3 h-3" /></button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-0.5 items-center">
            {order.routing.map(s => {
              const sp = order.stationProgress.find(p => p.station === s);
              const stStatus = sp?.status || 'NOT_STARTED';
              const isDone = stStatus === 'COMPLETED';
              const isInProg = stStatus === 'IN_PROGRESS';
              return (
                <button key={s} type="button"
                  onClick={() => onToggleStation(s, isDone)}
                  disabled={stationMutationPending}
                  className={clsx(
                    'inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-medium cursor-pointer transition-colors whitespace-nowrap',
                    isDone ? 'bg-green-100 text-green-700' :
                    isInProg ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-600 hover:bg-gray-200',
                  )}
                  title={STATION_DISPLAY_NAMES[s] + ': ' + stStatus + ' \u2014 Click to toggle'}>
                  {isDone ? <CheckCircle2 className="w-2.5 h-2.5" /> : isInProg ? <PlayCircle className="w-2.5 h-2.5" /> : <Circle className="w-2.5 h-2.5" />}
                  {STATION_ABBREVS[s] || s}
                </button>
              );
            })}
            <button onClick={onStartEditRouting} className="p-0.5 text-gray-300 hover:text-amber-500 rounded" title="Edit routing">
              <Edit3 className="w-2.5 h-2.5" />
            </button>
          </div>
        )}
      </td>

      {/* Due Date */}
      <td className="px-2 py-1.5">
        {isEditing ? (
          <input type="date" value={editDraft.dueDate ? String(editDraft.dueDate).split('T')[0] : ''}
            onChange={e => setEditDraft(d => ({ ...d, dueDate: e.target.value || null }))}
            className="w-full px-1 py-1 border border-blue-300 rounded text-xs bg-white" />
        ) : (
          <span className={clsx('text-xs font-medium', isOverdue ? 'text-red-600 font-bold' : 'text-gray-700')}>
            {order.dueDate ? fmtDate(order.dueDate) : <span className="text-gray-300">&mdash;</span>}
          </span>
        )}
      </td>

      {/* Status — clickable dropdown */}
      <td className="px-2 py-1.5 relative">
        <button type="button" onClick={onToggleStatusDropdown}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold cursor-pointer hover:opacity-80 transition-opacity whitespace-nowrap"
          style={{ backgroundColor: statusColor + '20', color: statusColor }}>
          {STATUS_DISPLAY_NAMES[order.status] || order.status}
          <ChevronDown className="w-2.5 h-2.5" />
        </button>
        {showStatusDropdown && (
          <div className="absolute z-30 left-2 mt-0.5 bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-32">
            {ORDER_STATUSES.map(s => {
              const c = STATUS_COLORS[s] || '#6b7280';
              return (
                <button key={s} type="button"
                  onMouseDown={() => onChangeStatus(s)}
                  className={clsx('w-full px-2 py-1 text-left text-xs hover:bg-gray-50 flex items-center gap-1.5', order.status === s && 'font-bold')}>
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c }} />
                  {STATUS_DISPLAY_NAMES[s]}
                </button>
              );
            })}
          </div>
        )}
      </td>

      {/* Notes */}
      <td className="px-2 py-1.5">
        {isEditing ? (
          <input type="text" value={editDraft.notes || ''} onChange={e => setEditDraft(d => ({ ...d, notes: e.target.value }))}
            className="w-full px-1.5 py-1 border border-blue-300 rounded text-xs bg-white" />
        ) : (
          <span className="text-xs text-gray-500 line-clamp-1" title={order.notes || ''}>{order.notes || ''}</span>
        )}
      </td>

      {/* Actions */}
      <td className="px-2 py-1.5">
        <div className="flex items-center gap-0.5 justify-center">
          {isEditing ? (
            <>
              <button onClick={onSaveEdit} disabled={isSaving}
                className="p-1 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50" title="Save"><Check className="w-3 h-3" /></button>
              <button onClick={onCancelEdit}
                className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100" title="Cancel"><X className="w-3 h-3" /></button>
            </>
          ) : (
            <>
              <button onClick={onStartEdit} className="p-1 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50" title="Edit"><Edit3 className="w-3 h-3" /></button>
              <a href={'/orders/' + order.id} className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100" title="Details">
                <ExternalLink className="w-3 h-3" /></a>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

export default OrderEntryStationView;
