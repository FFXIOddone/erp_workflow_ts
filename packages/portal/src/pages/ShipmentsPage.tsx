import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Truck,
  Search,
  Filter,
  Package,
  ExternalLink,
  MapPin,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { ordersApi } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';

// Carrier tracking URL generators
function getTrackingUrl(carrier: string, trackingNumber: string): string | null {
  if (!trackingNumber) return null;

  const urls: Record<string, string | null> = {
    UPS: `https://www.ups.com/track?tracknum=${trackingNumber}`,
    FEDEX: `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`,
    USPS: `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`,
    DHL: `https://www.dhl.com/us-en/home/tracking/tracking-global-forwarding.html?submit=1&tracking-id=${trackingNumber}`,
    FREIGHT: null, // Freight typically uses custom tracking
    CUSTOMER_PICKUP: null,
    OWN_DELIVERY: null,
    OTHER: null,
  };

  return urls[carrier] || null;
}

// Display names for carriers
const CARRIER_DISPLAY: Record<string, string> = {
  UPS: 'UPS',
  FEDEX: 'FedEx',
  USPS: 'USPS',
  DHL: 'DHL',
  FREIGHT: 'Freight',
  CUSTOMER_PICKUP: 'Customer Pickup',
  OWN_DELIVERY: 'Our Delivery',
  OTHER: 'Other',
};

// Status display configs
function getShipmentStatusConfig(status: string): { label: string; color: string; icon: typeof CheckCircle2 } {
  switch (status) {
    case 'DELIVERED':
      return { label: 'Delivered', color: 'bg-green-100 text-green-700', icon: CheckCircle2 };
    case 'IN_TRANSIT':
      return { label: 'In Transit', color: 'bg-blue-100 text-blue-700', icon: Truck };
    case 'PICKED_UP':
      return { label: 'Picked Up', color: 'bg-amber-100 text-amber-700', icon: Package };
    case 'EXCEPTION':
      return { label: 'Exception', color: 'bg-red-100 text-red-700', icon: AlertTriangle };
    default:
      return { label: 'Pending', color: 'bg-gray-100 text-gray-600', icon: Clock };
  }
}

interface Shipment {
  id: string;
  workOrderId: string;
  carrier: string;
  trackingNumber: string | null;
  shipDate: string | null;
  estimatedDelivery: string | null;
  actualDelivery: string | null;
  status: string;
  packages: any[];
}

interface OrderWithShipments {
  id: string;
  orderNumber: string;
  customerName: string;
  description: string;
  status: string;
  shipments: Shipment[];
}

export function ShipmentsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['portal-orders'],
    queryFn: () => ordersApi.list().then((r) => r.data.data),
  });

  const orders: OrderWithShipments[] = data?.orders || [];

  // Flatten all shipments from all orders
  const allShipments: (Shipment & { order: OrderWithShipments })[] = [];
  orders.forEach((order: OrderWithShipments) => {
    if (order.shipments && order.shipments.length > 0) {
      order.shipments.forEach((shipment) => {
        allShipments.push({
          ...shipment,
          order,
        });
      });
    }
  });

  // Filter shipments
  const filteredShipments = allShipments.filter((shipment) => {
    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      const matchesOrder = shipment.order.orderNumber.toLowerCase().includes(searchLower);
      const matchesTracking = shipment.trackingNumber?.toLowerCase().includes(searchLower);
      const matchesCarrier = CARRIER_DISPLAY[shipment.carrier]?.toLowerCase().includes(searchLower);
      if (!matchesOrder && !matchesTracking && !matchesCarrier) {
        return false;
      }
    }

    // Status filter
    if (statusFilter !== 'all' && shipment.status !== statusFilter) {
      return false;
    }

    return true;
  });

  // Sort by most recent first
  filteredShipments.sort((a, b) => {
    const dateA = a.shipDate ? new Date(a.shipDate).getTime() : 0;
    const dateB = b.shipDate ? new Date(b.shipDate).getTime() : 0;
    return dateB - dateA;
  });

  // Calculate stats
  const stats = {
    total: allShipments.length,
    inTransit: allShipments.filter((s) => s.status === 'IN_TRANSIT' || s.status === 'PICKED_UP').length,
    delivered: allShipments.filter((s) => s.status === 'DELIVERED').length,
    pending: allShipments.filter((s) => s.status === 'PENDING').length,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">Loading shipments...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Shipment Tracking</h1>
        <p className="mt-1 text-gray-500">Track your orders and view delivery status</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl border border-gray-200 p-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Truck className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">In Transit</p>
              <p className="text-xl font-bold text-gray-900">{stats.inTransit}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl border border-gray-200 p-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Delivered</p>
              <p className="text-xl font-bold text-gray-900">{stats.delivered}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-xl border border-gray-200 p-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-50 rounded-lg">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Pending</p>
              <p className="text-xl font-bold text-gray-900">{stats.pending}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-xl border border-gray-200 p-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-50 rounded-lg">
              <Package className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Shipments</p>
              <p className="text-xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by order number, tracking number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="all">All Shipments</option>
            <option value="PENDING">Pending</option>
            <option value="PICKED_UP">Picked Up</option>
            <option value="IN_TRANSIT">In Transit</option>
            <option value="DELIVERED">Delivered</option>
            <option value="EXCEPTION">Exception</option>
          </select>
        </div>
      </div>

      {/* Shipments List */}
      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {filteredShipments.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-12"
            >
              <Truck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900">No shipments found</h3>
              <p className="text-gray-500 mt-1">
                {allShipments.length === 0
                  ? 'Your orders will appear here once they ship.'
                  : 'Try adjusting your search or filter.'}
              </p>
            </motion.div>
          ) : (
            filteredShipments.map((shipment, index) => {
              const statusConfig = getShipmentStatusConfig(shipment.status);
              const StatusIcon = statusConfig.icon;
              const trackingUrl = getTrackingUrl(shipment.carrier, shipment.trackingNumber || '');

              return (
                <motion.div
                  key={shipment.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1">
                        <div className="p-3 bg-primary-50 rounded-xl">
                          <Truck className="w-6 h-6 text-primary-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-gray-900">
                              {CARRIER_DISPLAY[shipment.carrier] || shipment.carrier}
                            </h3>
                            <span className={cn('badge text-xs', statusConfig.color)}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {statusConfig.label}
                            </span>
                          </div>
                          <Link
                            to={`/orders/${shipment.order.id}`}
                            className="text-sm text-gray-500 hover:text-primary-600 transition-colors"
                          >
                            Order #{shipment.order.orderNumber}
                          </Link>
                          
                          {/* Tracking Number */}
                          {shipment.trackingNumber && (
                            <div className="mt-2">
                              {trackingUrl ? (
                                <a
                                  href={trackingUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700 font-medium"
                                >
                                  <span className="font-mono text-sm">{shipment.trackingNumber}</span>
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              ) : (
                                <span className="font-mono text-sm text-gray-600">{shipment.trackingNumber}</span>
                              )}
                            </div>
                          )}

                          {/* Dates */}
                          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-gray-500">
                            {shipment.shipDate && (
                              <div className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                <span>Shipped: {formatDate(shipment.shipDate)}</span>
                              </div>
                            )}
                            {shipment.estimatedDelivery && shipment.status !== 'DELIVERED' && (
                              <div className="flex items-center gap-1">
                                <MapPin className="w-4 h-4" />
                                <span>Est. Delivery: {formatDate(shipment.estimatedDelivery)}</span>
                              </div>
                            )}
                            {shipment.actualDelivery && (
                              <div className="flex items-center gap-1 text-green-600">
                                <CheckCircle2 className="w-4 h-4" />
                                <span>Delivered: {formatDate(shipment.actualDelivery)}</span>
                              </div>
                            )}
                          </div>

                          {/* Packages count */}
                          {shipment.packages && shipment.packages.length > 1 && (
                            <div className="mt-2 text-sm text-gray-500">
                              <Package className="w-4 h-4 inline mr-1" />
                              {shipment.packages.length} packages
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col items-end gap-2">
                        {trackingUrl && (
                          <a
                            href={trackingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-outline text-sm"
                          >
                            Track Package
                            <ExternalLink className="w-4 h-4 ml-1" />
                          </a>
                        )}
                        <Link
                          to={`/orders/${shipment.order.id}`}
                          className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
                        >
                          View Order
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default ShipmentsPage;
