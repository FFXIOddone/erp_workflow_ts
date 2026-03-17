import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Truck,
  Search,
  Filter,
  ExternalLink,
  Package,
  MapPin,
  Clock,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
} from 'lucide-react';
import { api } from '../lib/api';
import { formatDate } from '../lib/date';
import { PageHeader, Badge, Pagination, Spinner, EmptyState } from '../components';
import {
  Carrier,
  ShipmentStatus,
  CARRIER_DISPLAY_NAMES,
  SHIPMENT_STATUS_DISPLAY_NAMES,
  SHIPMENT_STATUS_COLORS,
} from '@erp/shared';

interface Shipment {
  id: string;
  workOrderId: string;
  workOrder: {
    id: string;
    orderNumber: string;
    customer: {
      companyName: string | null;
      firstName: string;
      lastName: string;
    };
  };
  carrier: Carrier;
  trackingNumber: string | null;
  status: ShipmentStatus;
  shipDate: string | null;
  estimatedDelivery: string | null;
  actualDelivery: string | null;
  createdAt: string;
  packages: { id: string }[];
}

interface ShipmentsResponse {
  data: Shipment[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const carrierOptions = Object.values(Carrier);
const statusOptions = Object.values(ShipmentStatus);

export function ShipmentsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ShipmentStatus | ''>('');
  const [carrier, setCarrier] = useState<Carrier | ''>('');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const limit = 20;

  const { data, isLoading, isError } = useQuery<ShipmentsResponse>({
    queryKey: ['shipments', { search, status, carrier, page, limit }],
    queryFn: () =>
      api
        .get('/shipments', {
          params: {
            search: search || undefined,
            status: status || undefined,
            carrier: carrier || undefined,
            page,
            limit,
          },
        })
        .then((r) => r.data),
  });

  const getStatusVariant = (
    shipmentStatus: ShipmentStatus
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
    return colorMap[SHIPMENT_STATUS_COLORS[shipmentStatus]] || 'default';
  };

  const getStatusIcon = (shipmentStatus: ShipmentStatus) => {
    switch (shipmentStatus) {
      case ShipmentStatus.DELIVERED:
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case ShipmentStatus.IN_TRANSIT:
        return <Truck className="h-4 w-4 text-blue-500" />;
      case ShipmentStatus.EXCEPTION:
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case ShipmentStatus.PICKED_UP:
        return <Package className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getTrackingUrl = (shipmentCarrier: Carrier, trackingNumber: string): string | null => {
    const urls: Partial<Record<Carrier, string>> = {
      [Carrier.UPS]: `https://www.ups.com/track?tracknum=${trackingNumber}`,
      [Carrier.FEDEX]: `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`,
      [Carrier.USPS]: `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`,
      [Carrier.DHL]: `https://www.dhl.com/us-en/home/tracking/tracking-express.html?submit=1&tracking-id=${trackingNumber}`,
    };
    return urls[shipmentCarrier] || null;
  };

  const getCustomerName = (customer: Shipment['workOrder']['customer']) => {
    return customer.companyName || `${customer.firstName} ${customer.lastName}`;
  };

  const clearFilters = () => {
    setSearch('');
    setStatus('');
    setCarrier('');
    setPage(1);
  };

  const hasActiveFilters = search || status || carrier;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shipments"
        description="Track and manage outbound shipments"
        icon={Truck}
      />

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-soft border border-gray-100 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by tracking number or order..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
              hasActiveFilters
                ? 'border-primary-500 text-primary-700 bg-primary-50'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Filter className="h-4 w-4" />
            Filters
            {hasActiveFilters && (
              <span className="px-1.5 py-0.5 text-xs bg-primary-600 text-white rounded-full">
                {[search, status, carrier].filter(Boolean).length}
              </span>
            )}
            <ChevronDown
              className={`h-4 w-4 transition-transform ${showFilters ? 'rotate-180' : ''}`}
            />
          </button>
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as ShipmentStatus | '');
                  setPage(1);
                }}
                className="w-full border border-gray-300 rounded-lg py-2 px-3 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">All Statuses</option>
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {SHIPMENT_STATUS_DISPLAY_NAMES[s]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Carrier
              </label>
              <select
                value={carrier}
                onChange={(e) => {
                  setCarrier(e.target.value as Carrier | '');
                  setPage(1);
                }}
                className="w-full border border-gray-300 rounded-lg py-2 px-3 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">All Carriers</option>
                {carrierOptions.map((c) => (
                  <option key={c} value={c}>
                    {CARRIER_DISPLAY_NAMES[c]}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={clearFilters}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Clear All Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : isError ? (
        <div className="text-center py-12 text-red-600">
          Failed to load shipments. Please try again.
        </div>
      ) : !data?.data.length ? (
        <EmptyState
          icon={<Truck className="h-12 w-12 text-gray-400" />}
          title="No shipments found"
          description={
            hasActiveFilters
              ? 'Try adjusting your filters to find what you\'re looking for.'
              : 'Shipments will appear here once created.'
          }
          action={
            hasActiveFilters
              ? { label: 'Clear filters', onClick: clearFilters }
              : undefined
          }
        />
      ) : (
        <>
          {/* Shipments Table */}
          <div className="bg-white rounded-xl shadow-soft border border-gray-100 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Shipment
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Order / Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Ship Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Delivery
                  </th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.data.map((shipment) => {
                  const trackingUrl = shipment.trackingNumber
                    ? getTrackingUrl(shipment.carrier, shipment.trackingNumber)
                    : null;

                  return (
                    <tr key={shipment.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(shipment.status)}
                          <div>
                            <div className="font-medium text-gray-900">
                              {CARRIER_DISPLAY_NAMES[shipment.carrier]}
                            </div>
                            {shipment.trackingNumber ? (
                              trackingUrl ? (
                                <a
                                  href={trackingUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-primary-600 hover:text-primary-800 font-mono flex items-center gap-1"
                                >
                                  {shipment.trackingNumber}
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              ) : (
                                <span className="text-sm text-gray-500 font-mono">
                                  {shipment.trackingNumber}
                                </span>
                              )
                            ) : (
                              <span className="text-sm text-gray-400 italic">
                                No tracking
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          to={`/orders/${shipment.workOrderId}`}
                          className="text-primary-600 hover:text-primary-800 font-medium"
                        >
                          {shipment.workOrder.orderNumber}
                        </Link>
                        <div className="text-sm text-gray-500">
                          {getCustomerName(shipment.workOrder.customer)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={getStatusVariant(shipment.status)}>
                          {SHIPMENT_STATUS_DISPLAY_NAMES[shipment.status]}
                        </Badge>
                        {shipment.packages.length > 0 && (
                          <div className="text-xs text-gray-500 mt-1">
                            {shipment.packages.length} package
                            {shipment.packages.length > 1 ? 's' : ''}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {shipment.shipDate ? (
                          <div className="text-sm text-gray-900">
                            {formatDate(shipment.shipDate)}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {shipment.status === ShipmentStatus.DELIVERED &&
                        shipment.actualDelivery ? (
                          <div className="flex items-center gap-1 text-sm text-green-600">
                            <MapPin className="h-3 w-3" />
                            {formatDate(shipment.actualDelivery)}
                          </div>
                        ) : shipment.estimatedDelivery ? (
                          <div className="flex items-center gap-1 text-sm text-gray-500">
                            <Clock className="h-3 w-3" />
                            Est: {formatDate(shipment.estimatedDelivery)}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          to={`/orders/${shipment.workOrderId}`}
                          className="text-sm text-primary-600 hover:text-primary-800 font-medium"
                        >
                          View Order →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data.pagination.totalPages > 1 && (
            <Pagination
              currentPage={data.pagination.page}
              totalPages={data.pagination.totalPages}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </div>
  );
}
