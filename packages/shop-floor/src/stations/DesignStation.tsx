import { useState, useEffect, useCallback } from 'react';
import {
  Palette,
  FolderOpen,
  Send,
  CheckCircle,
  Clock,
  Search,
  RefreshCw,
  AlertCircle,
  Upload,
  Eye,
  ThumbsUp,
} from 'lucide-react';
import { invoke } from '../lib/tauri-bridge';
import { useConfigStore } from '../stores/config';
import { useAuthStore } from '../stores/auth';
import { useWebSocket } from '../lib/useWebSocket';
import toast from 'react-hot-toast';

interface ProofInfo {
  id: string;
  revision: number;
  status: string;
  requestedAt: string;
}

interface DesignOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  description: string;
  status: string;
  dueDate: string;
  stationProgress?: Array<{
    station: string;
    status: string;
  }>;
  proofApprovals?: ProofInfo[];
}

export function DesignStation() {
  const { config } = useConfigStore();
  const { token } = useAuthStore();
  const [orders, setOrders] = useState<DesignOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [revisions, setRevisions] = useState<Record<string, any[]>>({});

  // WebSocket for real-time alerts
  const { subscribe } = useWebSocket();

  useEffect(() => {
    const unsub = subscribe((msg) => {
      if (msg.type === 'ORDER_CREATED') {
        const p = msg.payload as any;
        toast.success(`New order: ${p.orderNumber} — ${p.customerName}`, { duration: 5000 });
        fetchOrders();
      }
      if (msg.type === 'PROOF_STATUS_CHANGED' || msg.type === 'REVISION_REQUESTED') {
        fetchOrders();
      }
    });
    return unsub;
  }, [subscribe]);

  const fetchOrders = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(
        `${config.apiUrl}/orders?status=IN_PROGRESS,PENDING&limit=100`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error(`API ${res.status}`);
      const json = await res.json();
      const items = json.data?.items ?? json.data ?? [];
      const orderList = Array.isArray(items) ? items : [];
      setOrders(orderList);
      setError(null);

      // Fetch revisions for displayed orders
      const revMap: Record<string, any[]> = {};
      for (const order of orderList.slice(0, 20)) {
        try {
          const revRes = await fetch(
            `${config.apiUrl}/orders/${order.id}/revision-requests`,
            { headers: { Authorization: `Bearer ${token}` } },
          );
          if (revRes.ok) {
            const revJson = await revRes.json();
            const pending = (revJson.data || []).filter((r: any) => r.status === 'PENDING' || r.status === 'IN_PROGRESS');
            if (pending.length > 0) revMap[order.id] = pending;
          }
        } catch {}
      }
      setRevisions(revMap);
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

  const handleOpenFolder = async (orderNumber: string, customerName: string) => {
    try {
      // Mac support: use macNetworkDrivePath if on macOS
      let basePath = config.networkDrivePath || '\\\\wildesigns-fs1\\Company Files';

      // Detect OS via Tauri and swap path for Mac
      try {
        const os = await invoke<string>('get_os');
        if (os === 'macos' && config.macNetworkDrivePath) {
          basePath = config.macNetworkDrivePath;
        }
      } catch {
        // Not in Tauri or command unavailable — use default
      }

      const folder = await invoke('find_wo_folder', {
        basePath,
        woNumber: orderNumber.replace(/^WO-/, ''),
        customerName,
      });
      if (folder) {
        await invoke('open_folder', { path: folder });
      } else {
        toast.error('Folder not found on network');
      }
    } catch {
      toast.error('Failed to open folder');
    }
  };

  const handleDrop = async (e: React.DragEvent, order: DesignOrder) => {
    e.preventDefault();
    setDragOverId(null);
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    for (const file of files) {
      const filePath = (file as any).path;
      if (!filePath) {
        toast.error('Drag & drop only works in the desktop app');
        return;
      }

      const ext = file.name.toLowerCase().split('.').pop() || '';
      const isEmail = ext === 'eml' || ext === 'msg';
      const fileType = isEmail ? 'EMAIL' : 'ARTWORK';

      try {
        const basePath = config.networkDrivePath || '\\\\wildesigns-fs1\\Company Files';
        const folder = await invoke('find_wo_folder', {
          basePath,
          woNumber: order.orderNumber.replace(/^WO-/, ''),
          customerName: order.customerName,
        });

        if (folder) {
          await invoke('send_to_hotfolder', { filePath, hotfolderPath: folder });

          try {
            await fetch(`${config.apiUrl}/uploads/order/${order.id}/register`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                fileName: file.name,
                filePath: `${folder}\\${file.name}`,
                fileType,
                fileSize: file.size,
              }),
            });
          } catch {}

          toast.success(`${file.name} ${isEmail ? 'attached' : 'copied'} to ${order.orderNumber}`);
        } else {
          toast.error('Work order folder not found');
        }
      } catch {
        toast.error(`Failed to copy ${file.name}`);
      }
    }
  };

  // ─── Proof Actions ──────────────────────────────────
  const handleProofSent = async (orderId: string, orderNumber: string) => {
    try {
      const res = await fetch(`${config.apiUrl}/orders/${orderId}/proof-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'SENT' }),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      toast.success(`Proof sent for ${orderNumber}`);
      fetchOrders();
    } catch {
      toast.error('Failed to update proof status');
    }
  };

  const handleProofApproved = async (orderId: string, orderNumber: string) => {
    try {
      const res = await fetch(`${config.apiUrl}/orders/${orderId}/proof-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'APPROVED' }),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      toast.success(`Proof approved for ${orderNumber}`);
      fetchOrders();
    } catch {
      toast.error('Failed to update proof status');
    }
  };

  const handleDesignComplete = async (orderId: string, orderNumber: string) => {
    if (!window.confirm(`Mark design complete for ${orderNumber}? This moves it to Printing.`)) return;
    try {
      const res = await fetch(`${config.apiUrl}/orders/${orderId}/proof-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'COMPLETED' }),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      toast.success(`${orderNumber} design complete — moved to Printing`);
      fetchOrders();
    } catch {
      toast.error('Failed to complete design');
    }
  };

  // Get proof status for an order
  const getProofStatus = (order: DesignOrder) => {
    const proofs = order.proofApprovals || [];
    if (proofs.length === 0) return null;
    const latest = proofs.reduce((a, b) => (a.revision > b.revision ? a : b));
    return latest;
  };

  const filtered = orders.filter(
    (o) =>
      !searchQuery ||
      o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.description || '').toLowerCase().includes(searchQuery.toLowerCase()),
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
      {/* Toolbar */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Palette className="w-5 h-5 text-purple-600" />
          <h2 className="font-semibold text-gray-900">Design Queue</h2>
        </div>
        <div className="flex-1 relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search orders, customers..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
          />
        </div>
        <button
          onClick={fetchOrders}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Order list — drop zone per order */}
      <div className="flex-1 overflow-auto p-4 space-y-2">
        {filtered.length === 0 && !error && (
          <div className="text-center py-12 text-gray-400">
            <Palette className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No orders in design</p>
          </div>
        )}

        {filtered.map((order) => {
          const proof = getProofStatus(order);
          return (
            <div
              key={order.id}
              className={`bg-white rounded-lg border p-4 transition-all cursor-pointer ${
                dragOverId === order.id
                  ? 'border-purple-500 ring-2 ring-purple-400 bg-purple-50'
                  : selectedId === order.id
                  ? 'border-purple-500 ring-2 ring-purple-200'
                  : 'border-gray-200 hover:border-purple-300'
              }`}
              onClick={() => setSelectedId(selectedId === order.id ? null : order.id)}
              onDragOver={(e) => { e.preventDefault(); setDragOverId(order.id); }}
              onDragEnter={() => setDragOverId(order.id)}
              onDragLeave={() => setDragOverId(null)}
              onDrop={(e) => handleDrop(e, order)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-gray-900">
                      {order.orderNumber}
                    </span>
                    {revisions[order.id] && (
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full animate-pulse">
                        REVISION
                      </span>
                    )}
                    {/* Proof badge */}
                    {proof && (
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        proof.status === 'APPROVED'
                          ? 'bg-green-100 text-green-700'
                          : proof.status === 'PENDING'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        Proof #{proof.revision} {proof.status === 'PENDING' ? 'Sent' : proof.status === 'APPROVED' ? 'Approved' : proof.status}
                      </span>
                    )}
                    <span className="text-sm text-gray-500">
                      {order.customerName}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">{order.description}</p>
                  {order.dueDate && (
                    <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Due: {new Date(order.dueDate).toLocaleDateString()}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleOpenFolder(order.orderNumber, order.customerName); }}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                    title="Open network folder"
                  >
                    <FolderOpen className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleProofSent(order.id, order.orderNumber); }}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
                    title="Mark proof sent to customer"
                  >
                    <Send className="w-4 h-4" />
                    Proof Sent
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleProofApproved(order.id, order.orderNumber); }}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-sm text-emerald-600 hover:bg-emerald-50 rounded-lg"
                    title="Customer approved proof"
                  >
                    <ThumbsUp className="w-4 h-4" />
                    Approved
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDesignComplete(order.id, order.orderNumber); }}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-sm text-green-600 hover:bg-green-50 rounded-lg"
                    title="Design complete — send to Printing"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Done
                  </button>
                </div>
              </div>

              {selectedId === order.id && revisions[order.id] && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm font-medium text-red-800 mb-2">Revision Requested:</p>
                  {revisions[order.id].map((rev: any) => (
                    <div key={rev.id} className="mb-2">
                      <p className="text-sm text-red-700">
                        <strong>{rev.reason.replace(/_/g, ' ')}</strong>
                        {rev.notes && <span className="text-red-600"> — {rev.notes}</span>}
                      </p>
                      <p className="text-xs text-red-500">
                        From: {rev.requestedBy?.displayName} · {new Date(rev.createdAt).toLocaleString()}
                      </p>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            const res = await fetch(
                              `${config.apiUrl}/orders/revision-requests/${rev.id}/resolve`,
                              { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } },
                            );
                            if (!res.ok) throw new Error();
                            toast.success('Revision resolved');
                            fetchOrders();
                          } catch {
                            toast.error('Failed to resolve revision');
                          }
                        }}
                        className="mt-1 px-3 py-1 text-xs font-medium text-green-700 bg-green-100 rounded hover:bg-green-200"
                      >
                        Mark Resolved
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Drop hint */}
              <div className={`mt-2 border-2 border-dashed rounded-lg p-3 text-center text-xs transition-colors ${
                dragOverId === order.id
                  ? 'border-purple-400 bg-purple-50 text-purple-600'
                  : 'border-gray-200 text-gray-400'
              }`}>
                <Upload className="w-4 h-4 mx-auto mb-1" />
                {dragOverId === order.id ? 'Drop to attach' : 'Drop files or emails (.eml/.msg) here'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
