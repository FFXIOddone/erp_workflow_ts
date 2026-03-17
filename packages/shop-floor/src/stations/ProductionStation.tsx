import { useState, useEffect, useCallback } from 'react';
import {
  Factory,
  Scissors,
  FolderOpen,
  CheckCircle,
  RefreshCw,
  AlertCircle,
  Clock,
  RotateCcw,
  Package,
  Palette,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { invoke } from '../lib/tauri-bridge';
import { useConfigStore } from '../stores/config';
import { useAuthStore } from '../stores/auth';
import { useWebSocket } from '../lib/useWebSocket';
import toast from 'react-hot-toast';

interface StationProgress {
  station: string;
  status: string;
}

interface LineItem {
  id: string;
  itemNumber: number;
  description: string;
  quantity: number;
}

interface ProductionOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  description: string;
  status: string;
  dueDate: string;
  routing: string[];
  stationProgress: StationProgress[];
  lineItems: LineItem[];
}

const PRINTING_STATIONS = ['ROLL_TO_ROLL', 'FLATBED', 'SCREEN_PRINT'];
const STATION_LABELS: Record<string, string> = {
  ROLL_TO_ROLL: 'Roll to Roll',
  FLATBED: 'Flatbed',
  SCREEN_PRINT: 'Screen Print',
  DESIGN: 'Design',
  PRODUCTION: 'Production',
  SHIPPING_RECEIVING: 'Shipping',
  INSTALLATION: 'Installation',
};

export function ProductionStation() {
  const { config } = useConfigStore();
  const { token } = useAuthStore();
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reprintModal, setReprintModal] = useState<{ orderId: string; orderNumber: string } | null>(null);
  const [reprintReason, setReprintReason] = useState('PRINT_DEFECT');
  const [reprintDesc, setReprintDesc] = useState('');
  const [revisionModal, setRevisionModal] = useState<{ orderId: string; orderNumber: string } | null>(null);
  const [revisionReason, setRevisionReason] = useState('WRONG_SIZE');
  const [revisionNotes, setRevisionNotes] = useState('');

  const { subscribe } = useWebSocket();

  useEffect(() => {
    const unsub = subscribe((msg) => {
      if (['STATION_COMPLETED', 'REPRINT_REQUESTED', 'ORDER_CREATED', 'REVISION_REQUESTED'].includes(msg.type)) {
        fetchOrders();
      }
    });
    return unsub;
  }, [subscribe]);

  const fetchOrders = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(
        `${config.apiUrl}/orders?status=IN_PROGRESS&limit=100`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error(`API ${res.status}`);
      const json = await res.json();
      const items = json.data?.items ?? json.data ?? [];
      setOrders(Array.isArray(items) ? items : []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [config.apiUrl, token]);

  useEffect(() => {
    fetchOrders();
    const t = setInterval(fetchOrders, 15000);
    return () => clearInterval(t);
  }, [fetchOrders]);

  const handleOpenCutFile = async (order: ProductionOrder) => {
    if (!token) return;
    try {
      const res = await fetch(
        `${config.apiUrl}/file-chain/orders/${order.id}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error(`API ${res.status}`);
      const json = await res.json();
      const links = json.data || [];
      const withCut = links.filter((l: any) => l.cutFilePath);
      if (withCut.length === 0) {
        toast.error('No cut files linked to this order yet');
        return;
      }
      await invoke('open_file', { path: withCut[0].cutFilePath });
      toast.success('Cut file opened');
    } catch (err: any) {
      toast.error(err.message || 'Failed to open cut file');
    }
  };

  const handleOpenFolder = async (order: ProductionOrder) => {
    try {
      const basePath = config.networkDrivePath || '\\\\wildesigns-fs1\\Company Files';
      const folder = await invoke('find_wo_folder', {
        basePath,
        woNumber: order.orderNumber.replace(/^WO-/, ''),
        customerName: order.customerName,
      });
      if (folder) {
        await invoke('open_folder', { path: folder });
      } else {
        toast.error('Folder not found');
      }
    } catch {
      toast.error('Failed to open folder');
    }
  };

  const handleMarkComplete = async (orderId: string, orderNumber: string) => {
    if (!window.confirm(`Mark ${orderNumber} as complete?`)) return;
    try {
      const res = await fetch(`${config.apiUrl}/orders/${orderId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      toast.success(`${orderNumber} marked complete`);
      fetchOrders();
    } catch {
      toast.error('Failed to complete order');
    }
  };

  const handleReprintRequest = async () => {
    if (!reprintModal || !reprintDesc.trim()) return;
    try {
      const res = await fetch(`${config.apiUrl}/orders/${reprintModal.orderId}/reprint-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: reprintReason, description: reprintDesc }),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      toast.success('Reprint requested');
      setReprintModal(null);
      setReprintDesc('');
      fetchOrders();
    } catch {
      toast.error('Failed to request reprint');
    }
  };

  const handleRevisionRequest = async () => {
    if (!revisionModal) return;
    try {
      const res = await fetch(`${config.apiUrl}/orders/${revisionModal.orderId}/revision-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: revisionReason, notes: revisionNotes }),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      toast.success('Revision requested — sent back to Design');
      setRevisionModal(null);
      setRevisionNotes('');
      fetchOrders();
    } catch {
      toast.error('Failed to request revision');
    }
  };

  const handleMaterialRequest = async (orderId: string, orderNumber: string) => {
    const desc = window.prompt(`Material needed for ${orderNumber}:`);
    if (!desc) return;
    try {
      const res = await fetch(`${config.apiUrl}/orders/${orderId}/material-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ description: desc }),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      toast.success('Material request sent');
    } catch {
      toast.error('Failed to request material');
    }
  };

  const getStationBadge = (sp: StationProgress) => {
    const label = STATION_LABELS[sp.station] || sp.station.replace(/_/g, ' ');
    const colors = sp.status === 'COMPLETED'
      ? 'bg-green-100 text-green-700'
      : sp.status === 'IN_PROGRESS'
      ? 'bg-yellow-100 text-yellow-700'
      : 'bg-gray-100 text-gray-500';
    return (
      <span key={sp.station} className={`px-2 py-0.5 rounded text-xs font-medium ${colors}`}>
        {label}
      </span>
    );
  };

  const filtered = orders.filter(
    (o) =>
      !searchQuery ||
      o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customerName.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b px-4 py-3 flex items-center gap-4">
        <Factory className="w-5 h-5 text-orange-600" />
        <h2 className="font-semibold text-gray-900">Production</h2>
        <div className="flex-1 relative max-w-md">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search orders..."
            className="w-full pl-4 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <button
          onClick={fetchOrders}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      <div className="flex-1 overflow-auto p-4 space-y-2">
        {filtered.length === 0 && !error && (
          <div className="text-center py-12 text-gray-400">
            <Factory className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No orders in production</p>
          </div>
        )}

        {filtered.map((order) => {
          const printingProgress = order.stationProgress?.filter(sp => PRINTING_STATIONS.includes(sp.station)) || [];
          const isExpanded = expandedId === order.id;

          return (
            <div
              key={order.id}
              className="bg-white rounded-lg border border-gray-200 hover:border-orange-300"
            >
              <div
                className="p-4 cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : order.id)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-gray-900">{order.orderNumber}</span>
                      <span className="text-sm text-gray-500">{order.customerName}</span>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>
                    <p className="text-sm text-gray-500">{order.description}</p>
                    {order.dueDate && (
                      <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Due: {new Date(order.dueDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleOpenCutFile(order)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700"
                    >
                      <Scissors className="w-4 h-4" />
                      Zund / Cut
                    </button>
                    <button
                      onClick={() => handleOpenFolder(order)}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                      <FolderOpen className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleMarkComplete(order.id, order.orderNumber)}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm text-green-600 hover:bg-green-50 rounded-lg"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Done
                    </button>
                  </div>
                </div>

                {/* Printing station badges */}
                {printingProgress.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {order.stationProgress.map(sp => getStationBadge(sp))}
                  </div>
                )}
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="border-t px-4 py-3 bg-gray-50 space-y-3">
                  {/* Line items */}
                  {order.lineItems && order.lineItems.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Line Items</p>
                      <div className="space-y-1">
                        {order.lineItems.map((li) => (
                          <div key={li.id} className="text-sm text-gray-700 flex items-center gap-2">
                            <Package className="w-3 h-3 text-gray-400" />
                            {li.description} — Qty: {li.quantity}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t">
                    <button
                      onClick={() => { setReprintModal({ orderId: order.id, orderNumber: order.orderNumber }); setReprintDesc(''); }}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 bg-red-50 hover:bg-red-100 rounded-lg"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Request Reprint
                    </button>
                    <button
                      onClick={() => handleMaterialRequest(order.id, order.orderNumber)}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg"
                    >
                      <Package className="w-4 h-4" />
                      Request Material
                    </button>
                    <button
                      onClick={() => { setRevisionModal({ orderId: order.id, orderNumber: order.orderNumber }); setRevisionNotes(''); }}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg"
                    >
                      <Palette className="w-4 h-4" />
                      Flag Revision
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Reprint Request Modal */}
      {reprintModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setReprintModal(null)}>
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-4">Request Reprint — {reprintModal.orderNumber}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <select
                  value={reprintReason}
                  onChange={(e) => setReprintReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="PRINT_DEFECT">Print Defect</option>
                  <option value="CUSTOMER_CHANGE">Customer Change</option>
                  <option value="MATERIAL_DEFECT">Material Defect</option>
                  <option value="WRONG_SIZE">Wrong Size</option>
                  <option value="DAMAGED">Damaged</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={reprintDesc}
                  onChange={(e) => setReprintDesc(e.target.value)}
                  placeholder="Describe what needs reprinting..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm h-24 resize-none"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setReprintModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button onClick={handleReprintRequest} disabled={!reprintDesc.trim()} className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50">Submit</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Revision Request Modal */}
      {revisionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setRevisionModal(null)}>
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-4">Flag Revision — {revisionModal.orderNumber}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <select
                  value={revisionReason}
                  onChange={(e) => setRevisionReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="WRONG_SIZE">Wrong Size</option>
                  <option value="COLORS_OFF">Colors Off</option>
                  <option value="WRONG_MATERIAL">Wrong Material</option>
                  <option value="LAYOUT_ISSUE">Layout Issue</option>
                  <option value="TEXT_ERROR">Text Error</option>
                  <option value="FILE_CORRUPT">File Corrupt</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={revisionNotes}
                  onChange={(e) => setRevisionNotes(e.target.value)}
                  placeholder="Describe the issue..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm h-24 resize-none"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setRevisionModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button onClick={handleRevisionRequest} className="px-4 py-2 text-sm text-white bg-purple-600 hover:bg-purple-700 rounded-lg">Submit</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
