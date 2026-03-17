import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Truck,
  Package,
  ScanBarcode,
  CheckCircle,
  RefreshCw,
  AlertCircle,
  Clock,
  Search,
  QrCode,
  Camera,
  FileUp,
  X,
  Wrench,
  RotateCcw,
  ClipboardCheck,
  MapPin,
  ShoppingBag,
} from 'lucide-react';
import { useConfigStore } from '../stores/config';
import { useAuthStore } from '../stores/auth';
import { useWebSocket } from '../lib/useWebSocket';
import toast from 'react-hot-toast';

const QC_CHECKLIST = [
  { key: 'dimensions', label: 'Dimensions measured & verified' },
  { key: 'quantity', label: 'Quantity counted & matches order' },
  { key: 'colors', label: 'Colors verified against proof' },
  { key: 'packaging', label: 'Packaging complete' },
  { key: 'labels', label: 'Labels applied' },
  { key: 'defects', label: 'No visible defects' },
];

interface ShippingOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  description: string;
  status: string;
  dueDate: string;
  routing: string[];
  stationProgress?: Array<{ station: string; status: string }>;
}

export function ShippingStation() {
  const { config } = useConfigStore();
  const { token } = useAuthStore();
  const [orders, setOrders] = useState<ShippingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scanBuffer, setScanBuffer] = useState('');
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [qrModal, setQrModal] = useState<{ orderId: string; orderNumber: string; qrDataUrl: string } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [qcChecks, setQcChecks] = useState<Record<string, Record<string, boolean>>>({});
  const scanInputRef = useRef<HTMLInputElement>(null);

  const { subscribe } = useWebSocket();

  useEffect(() => {
    const unsub = subscribe((msg) => {
      if (['STATION_COMPLETED', 'ORDER_CREATED', 'REPRINT_REQUESTED'].includes(msg.type)) {
        fetchOrders();
      }
    });
    return unsub;
  }, [subscribe]);

  const fetchOrders = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(
        `${config.apiUrl}/orders?status=IN_PROGRESS,COMPLETED&limit=100`,
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

  const handleScanSubmit = async (barcode: string) => {
    if (!barcode.trim()) return;
    setLastScanned(barcode);
    try {
      const res = await fetch(`${config.apiUrl}/shipments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ trackingNumber: barcode.trim(), source: 'BARCODE_SCAN' }),
      });
      if (res.ok) toast.success(`Scanned: ${barcode.substring(0, 20)}...`);
      else toast.error('Could not process barcode');
    } catch {
      toast.error('Scan failed — check connection');
    }
    setScanBuffer('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleScanSubmit(scanBuffer);
  };

  const isQcPassed = (orderId: string) => {
    const checks = qcChecks[orderId] || {};
    return QC_CHECKLIST.every(item => checks[item.key]);
  };

  const toggleQcCheck = (orderId: string, key: string) => {
    setQcChecks(prev => ({
      ...prev,
      [orderId]: { ...prev[orderId], [key]: !prev[orderId]?.[key] },
    }));
  };

  // ─── Delivery Actions ──────────────────────────────
  const handleShipCarrier = async (orderId: string, orderNumber: string) => {
    if (!isQcPassed(orderId)) {
      toast.error('Complete QC checklist first');
      return;
    }
    try {
      // Create shipment
      await fetch(`${config.apiUrl}/shipments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ workOrderId: orderId, carrier: 'FEDEX', status: 'PENDING' }),
      });
      // Complete shipping station
      await fetch(`${config.apiUrl}/orders/${orderId}/station-progress`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ station: 'SHIPPING_RECEIVING', status: 'COMPLETED' }),
      });
      // Save QC results
      await fetch(`${config.apiUrl}/orders/${orderId}/shipping-qc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ checks: QC_CHECKLIST.map(c => ({ label: c.label, passed: qcChecks[orderId]?.[c.key] || false })) }),
      });
      toast.success(`${orderNumber} shipped`);
      fetchOrders();
    } catch {
      toast.error('Failed to process shipment');
    }
  };

  const handleReadyForInstall = async (orderId: string, orderNumber: string) => {
    if (!isQcPassed(orderId)) {
      toast.error('Complete QC checklist first');
      return;
    }
    try {
      // Complete SHIPPING station
      await fetch(`${config.apiUrl}/orders/${orderId}/station-progress`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ station: 'SHIPPING_RECEIVING', status: 'COMPLETED' }),
      });
      // Set INSTALLATION to IN_PROGRESS
      await fetch(`${config.apiUrl}/orders/${orderId}/station-progress`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ station: 'INSTALLATION', status: 'IN_PROGRESS' }),
      });
      toast.success(`${orderNumber} ready for installation`);
      fetchOrders();
    } catch {
      toast.error('Failed to update');
    }
  };

  const handleCustomerPickup = async (orderId: string, orderNumber: string) => {
    if (!isQcPassed(orderId)) {
      toast.error('Complete QC checklist first');
      return;
    }
    try {
      await fetch(`${config.apiUrl}/shipments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ workOrderId: orderId, carrier: 'CUSTOMER_PICKUP', status: 'DELIVERED' }),
      });
      await fetch(`${config.apiUrl}/orders/${orderId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      toast.success(`${orderNumber} ready for customer pickup`);
      fetchOrders();
    } catch {
      toast.error('Failed to update');
    }
  };

  const handleSendBack = async (orderId: string, orderNumber: string) => {
    if (!window.confirm(`Send ${orderNumber} back to Production?`)) return;
    try {
      const res = await fetch(`${config.apiUrl}/orders/${orderId}/reprint-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: 'DAMAGED', description: 'Rejected at shipping QC' }),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      toast.success(`${orderNumber} sent back to Production`);
      fetchOrders();
    } catch {
      toast.error('Failed to send back');
    }
  };

  const handlePhotoQR = async (orderId: string, orderNumber: string) => {
    try {
      const res = await fetch(`${config.apiUrl}/qrcode/photo-upload/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const json = await res.json();
      setQrModal({ orderId, orderNumber, qrDataUrl: json.data.qrDataUrl });
    } catch {
      toast.error('Failed to generate QR code');
    }
  };

  const handleImportLog = async (orderId: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.pdf,.txt';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileType', 'SHIPMENT_LOG');
      try {
        const res = await fetch(`${config.apiUrl}/uploads/order/${orderId}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        if (!res.ok) throw new Error(`API ${res.status}`);
        toast.success(`Imported ${file.name}`);
      } catch {
        toast.error('Failed to import log file');
      }
    };
    input.click();
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
      {/* Toolbar */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-4">
        <Truck className="w-5 h-5 text-green-600" />
        <h2 className="font-semibold text-gray-900">Shipping</h2>
        <div className="flex-1" />
        <button onClick={fetchOrders} className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Scan bar */}
      <div className="bg-green-50 border-b border-green-200 px-4 py-3 flex items-center gap-3">
        <ScanBarcode className="w-5 h-5 text-green-600" />
        <input
          ref={scanInputRef}
          type="text"
          value={scanBuffer}
          onChange={(e) => setScanBuffer(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Scan shipping label or enter tracking number..."
          className="flex-1 px-4 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
          autoFocus
        />
        <button onClick={() => handleScanSubmit(scanBuffer)} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">Submit</button>
        {lastScanned && <span className="text-xs text-green-700">Last: {lastScanned.substring(0, 25)}</span>}
      </div>

      {error && (
        <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Search */}
      <div className="px-4 pt-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search orders..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
      </div>

      {/* Orders */}
      <div className="flex-1 overflow-auto p-4 space-y-2">
        {filtered.length === 0 && !error && (
          <div className="text-center py-12 text-gray-400">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No orders ready for shipping</p>
          </div>
        )}

        {filtered.map((order) => {
          const isExpanded = expandedId === order.id;
          const qcPassed = isQcPassed(order.id);
          const hasInstall = order.routing?.includes('INSTALLATION');

          return (
            <div key={order.id} className="bg-white rounded-lg border border-gray-200 hover:border-green-300">
              <div className="p-4 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : order.id)}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-gray-900">{order.orderNumber}</span>
                      <span className="text-sm text-gray-500">{order.customerName}</span>
                      {qcPassed && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">QC Passed</span>
                      )}
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
                    <button onClick={() => handlePhotoQR(order.id, order.orderNumber)} className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg" title="Take photo with phone">
                      <Camera className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleImportLog(order.id)} className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg" title="Import shipping log">
                      <FileUp className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Expanded: QC + Delivery */}
              {isExpanded && (
                <div className="border-t px-4 py-3 bg-gray-50 space-y-4">
                  {/* QC Checklist */}
                  <div>
                    <p className="text-xs font-semibold text-gray-600 uppercase mb-2 flex items-center gap-1">
                      <ClipboardCheck className="w-4 h-4" />
                      QC Checklist
                    </p>
                    <div className="space-y-1">
                      {QC_CHECKLIST.map((item) => (
                        <label key={item.key} className="flex items-center gap-2 py-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={qcChecks[order.id]?.[item.key] || false}
                            onChange={() => toggleQcCheck(order.id, item.key)}
                            className="w-4 h-4 text-green-600 rounded"
                          />
                          <span className={`text-sm ${qcChecks[order.id]?.[item.key] ? 'text-green-700' : 'text-gray-700'}`}>
                            {item.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Delivery Actions */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t">
                    <button
                      onClick={() => handleShipCarrier(order.id, order.orderNumber)}
                      disabled={!qcPassed}
                      className="flex items-center gap-1 px-4 py-2 text-sm text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Truck className="w-4 h-4" />
                      Ship via FedEx/UPS
                    </button>
                    {hasInstall && (
                      <button
                        onClick={() => handleReadyForInstall(order.id, order.orderNumber)}
                        disabled={!qcPassed}
                        className="flex items-center gap-1 px-4 py-2 text-sm text-white bg-amber-600 hover:bg-amber-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Wrench className="w-4 h-4" />
                        Ready for Installation
                      </button>
                    )}
                    <button
                      onClick={() => handleCustomerPickup(order.id, order.orderNumber)}
                      disabled={!qcPassed}
                      className="flex items-center gap-1 px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      Customer Pickup
                    </button>
                    <button
                      onClick={() => handleSendBack(order.id, order.orderNumber)}
                      className="flex items-center gap-1 px-4 py-2 text-sm text-red-600 bg-red-50 hover:bg-red-100 rounded-lg"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Reject / Reprint
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* QR Code Modal */}
      {qrModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setQrModal(null)}>
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Scan with Phone</h3>
              <button onClick={() => setQrModal(null)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">{qrModal.orderNumber}</p>
            <img src={qrModal.qrDataUrl} alt="QR Code" className="mx-auto w-64 h-64" />
            <p className="text-xs text-gray-400 mt-3">
              Scan this QR code with your phone camera to take a shipment photo.
              <br />Phone must be on shop WiFi.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
