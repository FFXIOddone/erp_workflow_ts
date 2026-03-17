import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Truck,
  Plus,
  Package,
  MapPin,
  Clock,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import { formatDate } from '../lib/date';
import { Badge } from './Badge';
import { ShipmentPhotoCapture } from './ShipmentPhotoCapture';
import {
  Carrier,
  ShipmentStatus,
  CARRIER_DISPLAY_NAMES,
  SHIPMENT_STATUS_DISPLAY_NAMES,
  SHIPMENT_STATUS_COLORS,
} from '@erp/shared';

interface Shipment {
  id: string;
  carrier: Carrier;
  trackingNumber: string | null;
  status: ShipmentStatus;
  shipDate: string | null;
  estimatedDelivery: string | null;
  actualDelivery: string | null;
  notes: string | null;
  createdBy: {
    id: string;
    displayName: string;
  };
  packages: {
    id: string;
    weight: number | null;
    dimensions: string | null;
    description: string | null;
  }[];
}

interface ShippingPanelProps {
  workOrderId: string;
  orderNumber: string;
}

const carrierOptions = Object.values(Carrier);

export function ShippingPanel({ workOrderId, orderNumber }: ShippingPanelProps) {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    carrier: Carrier.UPS as Carrier,
    trackingNumber: '',
    estimatedDelivery: '',
    notes: '',
  });

  const { data: shipments, isLoading } = useQuery<Shipment[]>({
    queryKey: ['shipments', 'order', workOrderId],
    queryFn: () =>
      api.get(`/shipments/order/${workOrderId}`).then((r) => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/shipments', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments', 'order', workOrderId] });
      queryClient.invalidateQueries({ queryKey: ['orders', workOrderId] });
      setShowCreateModal(false);
      resetForm();
      toast.success('Shipment created successfully');
    },
    onError: () => {
      toast.error('Failed to create shipment');
    },
  });

  const deliverMutation = useMutation({
    mutationFn: (shipmentId: string) =>
      api.post(`/shipments/${shipmentId}/deliver`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments', 'order', workOrderId] });
      toast.success('Marked as delivered');
    },
    onError: () => {
      toast.error('Failed to update shipment');
    },
  });

  const resetForm = () => {
    setFormData({
      carrier: Carrier.UPS,
      trackingNumber: '',
      estimatedDelivery: '',
      notes: '',
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      workOrderId,
      carrier: formData.carrier,
      trackingNumber: formData.trackingNumber || null,
      estimatedDelivery: formData.estimatedDelivery
        ? new Date(formData.estimatedDelivery).toISOString()
        : null,
      notes: formData.notes || null,
    });
  };

  const getTrackingUrl = (carrier: Carrier, trackingNumber: string): string | null => {
    const urls: Partial<Record<Carrier, string>> = {
      UPS: `https://www.ups.com/track?tracknum=${trackingNumber}`,
      FEDEX: `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`,
      USPS: `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`,
      DHL: `https://www.dhl.com/us-en/home/tracking/tracking-express.html?submit=1&tracking-id=${trackingNumber}`,
    };
    return urls[carrier] || null;
  };

  const getStatusVariant = (
    status: ShipmentStatus
  ): 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral' => {
    const colorMap: Record<
      string,
      'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'
    > = {
      gray: 'neutral',
      blue: 'info',
      yellow: 'warning',
      green: 'success',
      red: 'danger',
    };
    return colorMap[SHIPMENT_STATUS_COLORS[status]] || 'default';
  };

  const getStatusIcon = (status: ShipmentStatus) => {
    switch (status) {
      case 'DELIVERED':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'IN_TRANSIT':
        return <Truck className="h-4 w-4 text-blue-500" />;
      case 'EXCEPTION':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-soft border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Truck className="h-5 w-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-gray-900">Shipping</h2>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-primary-600 transition-colors"
          title="Create Shipment"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-4">
          <div className="animate-spin h-6 w-6 border-2 border-primary-500 border-t-transparent rounded-full mx-auto"></div>
        </div>
      ) : shipments?.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">No shipments yet</p>
      ) : (
        <div className="space-y-3">
          {shipments?.map((shipment) => {
            const trackingUrl = shipment.trackingNumber
              ? getTrackingUrl(shipment.carrier, shipment.trackingNumber)
              : null;

            return (
              <div
                key={shipment.id}
                className="p-3 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {getStatusIcon(shipment.status)}
                      <span className="font-medium text-gray-900 text-sm">
                        {CARRIER_DISPLAY_NAMES[shipment.carrier]}
                      </span>
                      <Badge variant={getStatusVariant(shipment.status)} size="sm">
                        {SHIPMENT_STATUS_DISPLAY_NAMES[shipment.status]}
                      </Badge>
                    </div>

                    {shipment.trackingNumber && (
                      <div className="flex items-center gap-1 text-sm">
                        <span className="text-gray-500">Tracking:</span>
                        {trackingUrl ? (
                          <a
                            href={trackingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary-600 hover:text-primary-800 font-mono flex items-center gap-1"
                          >
                            {shipment.trackingNumber}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="font-mono text-gray-700">
                            {shipment.trackingNumber}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                      {shipment.shipDate && (
                        <span className="flex items-center gap-1">
                          <Package className="h-3 w-3" />
                          Shipped: {formatDate(shipment.shipDate)}
                        </span>
                      )}
                      {shipment.status === 'DELIVERED' && shipment.actualDelivery && (
                        <span className="flex items-center gap-1 text-green-600">
                          <MapPin className="h-3 w-3" />
                          Delivered: {formatDate(shipment.actualDelivery)}
                        </span>
                      )}
                      {shipment.status !== 'DELIVERED' && shipment.estimatedDelivery && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Est: {formatDate(shipment.estimatedDelivery)}
                        </span>
                      )}
                    </div>

                    {shipment.packages.length > 0 && (
                      <div className="text-xs text-gray-500 mt-1">
                        {shipment.packages.length} package
                        {shipment.packages.length > 1 ? 's' : ''}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <ShipmentPhotoCapture orderId={workOrderId} />
                    {shipment.status !== 'DELIVERED' && (
                      <button
                        onClick={() => deliverMutation.mutate(shipment.id)}
                        disabled={deliverMutation.isPending}
                        className="text-xs px-2 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
                      >
                        Mark Delivered
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Shipment Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowCreateModal(false)}
          />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Create Shipment</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Carrier *
                </label>
                <select
                  value={formData.carrier}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      carrier: e.target.value as Carrier,
                    }))
                  }
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  required
                >
                  {carrierOptions.map((carrier) => (
                    <option key={carrier} value={carrier}>
                      {CARRIER_DISPLAY_NAMES[carrier]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tracking Number
                </label>
                <input
                  type="text"
                  value={formData.trackingNumber}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      trackingNumber: e.target.value,
                    }))
                  }
                  placeholder="Enter tracking number..."
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estimated Delivery
                </label>
                <input
                  type="date"
                  value={formData.estimatedDelivery}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      estimatedDelivery: e.target.value,
                    }))
                  }
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  rows={2}
                  placeholder="Optional notes..."
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-500 disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Creating...' : 'Create Shipment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
