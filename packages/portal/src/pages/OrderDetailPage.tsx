import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Package,
  Clock,
  Calendar,
  DollarSign,
  FileImage,
  Truck,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  History,
} from 'lucide-react';
import { ordersApi } from '@/lib/api';
import { formatDate, formatCurrency, cn } from '@/lib/utils';
import { STATUS_DISPLAY_NAMES, STATION_DISPLAY_NAMES, ORDER_STATUS_CUSTOMER_DESCRIPTIONS } from '@erp/shared';
import { OrderTimeline } from '@/components/OrderTimeline';

const statusColors: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  ON_HOLD: 'bg-orange-100 text-orange-700',
  COMPLETED: 'bg-green-100 text-green-700',
  SHIPPED: 'bg-purple-100 text-purple-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

const stationStatusColors: Record<string, string> = {
  NOT_STARTED: 'bg-gray-100 text-gray-500',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
};

// Carrier tracking URL generators
function getTrackingUrl(carrier: string, trackingNumber: string): string | null {
  if (!trackingNumber) return null;

  const urls: { [key: string]: string | null } = {
    UPS: `https://www.ups.com/track?tracknum=${trackingNumber}`,
    FEDEX: `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`,
    USPS: `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`,
    DHL: `https://www.dhl.com/us-en/home/tracking/tracking-global-forwarding.html?submit=1&tracking-id=${trackingNumber}`,
  };

  return urls[carrier] ?? null;
}

// Display names for carriers
const CARRIER_DISPLAY: { [key: string]: string } = {
  UPS: 'UPS',
  FEDEX: 'FedEx',
  USPS: 'USPS',
  DHL: 'DHL',
  FREIGHT: 'Freight',
  CUSTOMER_PICKUP: 'Customer Pickup',
  OWN_DELIVERY: 'Our Delivery',
  OTHER: 'Other',
};

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: () => ordersApi.get(id!).then((r) => r.data.data),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">Loading order details...</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-12">
        <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900">Order not found</h2>
        <p className="mt-2 text-gray-500">This order may not exist or you don't have access.</p>
        <Link to="/orders" className="btn btn-primary mt-4">
          Back to Orders
        </Link>
      </div>
    );
  }

  const pendingProofs = order.proofApprovals?.filter((p: any) => p.status === 'PENDING') || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            to="/orders"
            className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Orders
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            Order #{order.orderNumber}
            <span className={cn('badge text-sm', statusColors[order.status])}>
              {STATUS_DISPLAY_NAMES[order.status as keyof typeof STATUS_DISPLAY_NAMES]}
            </span>
          </h1>
          <p className="mt-1 text-gray-500">{order.description}</p>
        </div>
      </div>

      {/* Status Message */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'p-4 rounded-xl border',
          order.status === 'COMPLETED' || order.status === 'SHIPPED'
            ? 'bg-green-50 border-green-200'
            : order.status === 'ON_HOLD'
            ? 'bg-orange-50 border-orange-200'
            : 'bg-blue-50 border-blue-200'
        )}
      >
        <p className="text-sm font-medium text-gray-900">
          {ORDER_STATUS_CUSTOMER_DESCRIPTIONS[order.status as keyof typeof ORDER_STATUS_CUSTOMER_DESCRIPTIONS] ||
            'Your order is being processed.'}
        </p>
      </motion.div>

      {/* Pending Proofs Alert */}
      {pendingProofs.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-amber-50 border border-amber-200"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-900">
                {pendingProofs.length} proof{pendingProofs.length > 1 ? 's' : ''} awaiting your approval
              </p>
              <p className="text-sm text-amber-700 mt-1">
                Please review and approve the proofs to keep production on schedule.
              </p>
              <Link
                to={`/proofs/${pendingProofs[0].id}`}
                className="btn btn-primary mt-3"
              >
                Review Proofs
              </Link>
            </div>
          </div>
        </motion.div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Production Progress */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card"
          >
            <div className="card-header">
              <h2 className="text-lg font-semibold text-gray-900">Production Progress</h2>
            </div>
            <div className="card-body">
              {/* Progress Bar */}
              <div className="mb-6">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-gray-500">Overall Progress</span>
                  <span className="font-semibold text-gray-900">{order.progress}%</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${order.progress}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  />
                </div>
              </div>

              {/* Station Progress */}
              <div className="space-y-3">
                {order.routing?.map((station: string, index: number) => {
                  const progress = order.stationProgress?.find((sp: any) => sp.station === station);
                  const status = progress?.status || 'NOT_STARTED';
                  return (
                    <div key={station} className="flex items-center gap-3">
                      <div
                        className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                          stationStatusColors[status]
                        )}
                      >
                        {status === 'COMPLETED' ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : (
                          index + 1
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900">
                            {STATION_DISPLAY_NAMES[station as keyof typeof STATION_DISPLAY_NAMES] || station}
                          </span>
                          <span
                            className={cn(
                              'text-xs font-medium',
                              status === 'COMPLETED'
                                ? 'text-green-600'
                                : status === 'IN_PROGRESS'
                                ? 'text-blue-600'
                                : 'text-gray-400'
                            )}
                          >
                            {status === 'COMPLETED'
                              ? `Completed ${formatDate(progress.completedAt)}`
                              : status === 'IN_PROGRESS'
                              ? 'In Progress'
                              : 'Pending'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>

          {/* Order Timeline / Activity History */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="card"
          >
            <div className="card-header">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <History className="w-5 h-5 text-gray-400" />
                Order Timeline
              </h2>
            </div>
            <div className="card-body">
              <OrderTimeline orderId={order.id} maxItems={5} />
            </div>
          </motion.div>

          {/* Line Items */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card"
          >
            <div className="card-header">
              <h2 className="text-lg font-semibold text-gray-900">Order Items</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3 text-left">Item</th>
                    <th className="px-6 py-3 text-center">Qty</th>
                    <th className="px-6 py-3 text-right">Unit Price</th>
                    <th className="px-6 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {order.lineItems?.map((item: any) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">Item {item.itemNumber}</p>
                        <p className="text-sm text-gray-500">{item.description}</p>
                      </td>
                      <td className="px-6 py-4 text-center text-gray-900">
                        {item.quantity}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-900">
                        {formatCurrency(item.unitPrice)}
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-gray-900">
                        {formatCurrency(Number(item.quantity) * Number(item.unitPrice))}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={3} className="px-6 py-4 text-right font-semibold text-gray-900">
                      Total
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-gray-900 text-lg">
                      {formatCurrency(order.total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </motion.div>

          {/* Attachments/Proofs */}
          {order.attachments?.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="card"
            >
              <div className="card-header">
                <h2 className="text-lg font-semibold text-gray-900">Files & Proofs</h2>
              </div>
              <div className="card-body grid grid-cols-2 md:grid-cols-3 gap-4">
                {order.attachments.map((file: any) => (
                  <a
                    key={file.id}
                    href={`/api/v1/uploads/${file.filePath}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-4 border rounded-lg hover:bg-gray-50 group"
                  >
                    <FileImage className="w-8 h-8 text-gray-400 group-hover:text-primary-600 mb-2" />
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {file.fileName}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {file.fileType} • {formatDate(file.uploadedAt)}
                    </p>
                  </a>
                ))}
              </div>
            </motion.div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Order Details */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card"
          >
            <div className="card-header">
              <h2 className="text-lg font-semibold text-gray-900">Order Details</h2>
            </div>
            <div className="card-body space-y-4">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Order Date</p>
                  <p className="font-medium text-gray-900">{formatDate(order.createdAt)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Due Date</p>
                  <p className="font-medium text-gray-900">{formatDate(order.dueDate)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <DollarSign className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Order Total</p>
                  <p className="font-medium text-gray-900">{formatCurrency(order.total)}</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Shipping */}
          {order.shipments?.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="card"
            >
              <div className="card-header">
                <h2 className="text-lg font-semibold text-gray-900">Shipping</h2>
              </div>
              <div className="card-body space-y-4">
                {order.shipments.map((shipment: any) => {
                  const trackingUrl = getTrackingUrl(shipment.carrier, shipment.trackingNumber);
                  return (
                    <div key={shipment.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Truck className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-gray-900">
                          {CARRIER_DISPLAY[shipment.carrier] || shipment.carrier}
                        </span>
                      </div>
                      {shipment.trackingNumber && (
                        trackingUrl ? (
                          <a
                            href={trackingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
                          >
                            {shipment.trackingNumber}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <p className="text-sm text-gray-600">{shipment.trackingNumber}</p>
                        )
                      )}
                      {shipment.shipDate && (
                        <p className="text-xs text-gray-500 mt-1">
                          Shipped: {formatDate(shipment.shipDate)}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Contact */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="card"
          >
            <div className="card-body text-center">
              <h3 className="font-semibold text-gray-900 mb-2">Need Help?</h3>
              <p className="text-sm text-gray-500 mb-4">
                Have questions about this order?
              </p>
              <Link
                to={`/messages?orderId=${order.id}`}
                className="btn btn-primary w-full"
              >
                Contact Us
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
