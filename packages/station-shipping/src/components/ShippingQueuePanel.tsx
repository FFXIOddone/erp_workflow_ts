import { useState } from 'react';
import { 
  Package, 
  Truck, 
  CheckCircle, 
  Camera,
  QrCode,
  MapPin,
  Clock,
  AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ShipmentItem {
  id: string;
  orderNumber: string;
  customerName: string;
  itemCount: number;
  carrier: 'fedex' | 'ups' | 'local' | 'pickup';
  status: 'pending' | 'packed' | 'labeled' | 'shipped';
  trackingNumber?: string;
  estimatedWeight: number;
}

// Mock data
const mockShipments: ShipmentItem[] = [
  {
    id: '1',
    orderNumber: 'WO-2026-0156',
    customerName: 'Aldea Coffee',
    itemCount: 3,
    carrier: 'fedex',
    status: 'pending',
    estimatedWeight: 15,
  },
  {
    id: '2',
    orderNumber: 'WO-2026-0148',
    customerName: 'Downtown Diner',
    itemCount: 1,
    carrier: 'local',
    status: 'packed',
    estimatedWeight: 8,
  },
  {
    id: '3',
    orderNumber: 'WO-2026-0142',
    customerName: 'Real Estate Pro',
    itemCount: 50,
    carrier: 'pickup',
    status: 'labeled',
    estimatedWeight: 45,
  },
];

const carrierColors = {
  fedex: 'bg-purple-100 text-purple-700 border-purple-200',
  ups: 'bg-amber-100 text-amber-700 border-amber-200',
  local: 'bg-blue-100 text-blue-700 border-blue-200',
  pickup: 'bg-gray-100 text-gray-700 border-gray-200',
};

const carrierLabels = {
  fedex: 'FedEx',
  ups: 'UPS',
  local: 'Local Delivery',
  pickup: 'Customer Pickup',
};

const statusSteps = ['pending', 'packed', 'labeled', 'shipped'] as const;

export function ShippingQueuePanel() {
  const [shipments, setShipments] = useState<ShipmentItem[]>(mockShipments);
  const [selectedShipment, setSelectedShipment] = useState<ShipmentItem | null>(null);
  const [scanInput, setScanInput] = useState('');

  const handleScan = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && scanInput.trim()) {
      // Simulate finding order by scan
      const found = shipments.find(s => 
        s.orderNumber.toLowerCase().includes(scanInput.toLowerCase())
      );
      if (found) {
        setSelectedShipment(found);
        toast.success(`Found order ${found.orderNumber}`);
      } else {
        toast.error('Order not found');
      }
      setScanInput('');
    }
  };

  const handleAdvanceStatus = (shipmentId: string) => {
    setShipments(prev => prev.map(s => {
      if (s.id === shipmentId) {
        const currentIdx = statusSteps.indexOf(s.status);
        if (currentIdx < statusSteps.length - 1) {
          const newStatus = statusSteps[currentIdx + 1];
          const updated = { ...s, status: newStatus };
          toast.success(`Status updated to ${newStatus}`);
          // Keep selectedShipment in sync
          setSelectedShipment(prev => prev?.id === shipmentId ? updated : prev);
          return updated;
        }
      }
      return s;
    }));
  };

  const handlePrintLabel = (shipment: ShipmentItem) => {
    toast.success(`Printing ${carrierLabels[shipment.carrier]} label for ${shipment.orderNumber}`);
  };

  const pendingShipments = shipments.filter(s => s.status !== 'shipped');
  const shippedToday = shipments.filter(s => s.status === 'shipped');

  return (
    <div className="flex flex-col h-full">
      {/* Scan Bar */}
      <div className="bg-green-50 border-b border-green-200 p-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-green-700">
            <QrCode className="w-5 h-5" />
            <span className="font-medium">Scan Order</span>
          </div>
          <input
            type="text"
            value={scanInput}
            onChange={(e) => setScanInput(e.target.value)}
            onKeyDown={handleScan}
            placeholder="Scan barcode or enter order number..."
            className="flex-1 px-4 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            autoFocus
          />
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Shipment Queue */}
        <div className="flex-1 overflow-auto p-4">
          <h3 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
            <Package className="w-4 h-4" />
            Ready to Ship ({pendingShipments.length})
          </h3>
          
          <div className="space-y-2">
            {pendingShipments.map((shipment) => (
              <div
                key={shipment.id}
                className={`bg-white rounded-lg border p-4 cursor-pointer transition-all ${
                  selectedShipment?.id === shipment.id 
                    ? 'border-green-500 ring-2 ring-green-200' 
                    : 'border-gray-200 hover:border-green-300'
                }`}
                onClick={() => setSelectedShipment(shipment)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900">{shipment.orderNumber}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${carrierColors[shipment.carrier]}`}>
                      {carrierLabels[shipment.carrier]}
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">{shipment.itemCount} items</span>
                </div>
                <p className="text-gray-600">{shipment.customerName}</p>
                
                {/* Status Progress */}
                <div className="mt-3 flex items-center gap-1">
                  {statusSteps.map((step, idx) => {
                    const currentIdx = statusSteps.indexOf(shipment.status);
                    const isComplete = idx <= currentIdx;
                    const isCurrent = idx === currentIdx;
                    return (
                      <div key={step} className="flex items-center">
                        <div className={`w-2 h-2 rounded-full ${
                          isComplete ? 'bg-green-500' : 'bg-gray-300'
                        } ${isCurrent ? 'ring-2 ring-green-200' : ''}`} />
                        {idx < statusSteps.length - 1 && (
                          <div className={`w-8 h-0.5 ${
                            idx < currentIdx ? 'bg-green-500' : 'bg-gray-300'
                          }`} />
                        )}
                      </div>
                    );
                  })}
                  <span className="ml-2 text-xs text-gray-500 capitalize">{shipment.status}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Shipped Today */}
          {shippedToday.length > 0 && (
            <>
              <h3 className="font-medium text-gray-700 mt-6 mb-3 flex items-center gap-2">
                <Truck className="w-4 h-4 text-green-500" />
                Shipped Today ({shippedToday.length})
              </h3>
              <div className="space-y-2">
                {shippedToday.map((shipment) => (
                  <div
                    key={shipment.id}
                    className="bg-green-50 rounded-lg border border-green-200 p-4 opacity-75"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-gray-900">{shipment.orderNumber}</span>
                        <span className="text-gray-500 ml-2">{shipment.customerName}</span>
                      </div>
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-sm">{shipment.trackingNumber || 'Shipped'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Selected Shipment Detail */}
        {selectedShipment && (
          <div className="w-80 bg-white border-l border-gray-200 p-4 overflow-auto">
            <h3 className="font-bold text-lg mb-4">{selectedShipment.orderNumber}</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 uppercase">Customer</label>
                <p className="font-medium">{selectedShipment.customerName}</p>
              </div>
              
              <div>
                <label className="text-xs text-gray-500 uppercase">Carrier</label>
                <p className="font-medium">{carrierLabels[selectedShipment.carrier]}</p>
              </div>
              
              <div>
                <label className="text-xs text-gray-500 uppercase">Items</label>
                <p className="font-medium">{selectedShipment.itemCount} pieces</p>
              </div>
              
              <div>
                <label className="text-xs text-gray-500 uppercase">Est. Weight</label>
                <p className="font-medium">{selectedShipment.estimatedWeight} lbs</p>
              </div>
              
              <div className="border-t pt-4 space-y-2">
                {selectedShipment.carrier !== 'pickup' && (
                  <button
                    onClick={() => handlePrintLabel(selectedShipment)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium"
                  >
                    <Package className="w-4 h-4" />
                    Print Shipping Label
                  </button>
                )}
                
                {selectedShipment.status !== 'shipped' && (
                  <button
                    onClick={() => handleAdvanceStatus(selectedShipment.id)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Mark as {statusSteps[statusSteps.indexOf(selectedShipment.status) + 1]}
                  </button>
                )}
                
                <button
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg"
                >
                  <Camera className="w-4 h-4" />
                  Take Photo
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
