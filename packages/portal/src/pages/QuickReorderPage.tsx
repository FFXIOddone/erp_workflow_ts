import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  RefreshCw,
  Package,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Calendar,
  DollarSign,
  Search,
  Plus,
  Minus,
} from 'lucide-react';
import { ordersApi, selfServiceApi } from '@/lib/api';
import { formatDate, formatCurrency, cn } from '@/lib/utils';

export function QuickReorderPage() {
  const [searchParams] = useSearchParams();
  const preselectedOrderId = searchParams.get('orderId');
  const navigate = useNavigate();

  const [selectedOrderId, setSelectedOrderId] = useState<string>(preselectedOrderId || '');
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');

  const { data: ordersData } = useQuery({
    queryKey: ['orders', { pageSize: 100 }],
    queryFn: () => ordersApi.list({ pageSize: 100 }).then((r) => r.data.data),
  });

  const allOrders = ordersData?.orders || [];
  const completedOrders = allOrders.filter((o: any) =>
    ['COMPLETED', 'SHIPPED', 'DELIVERED'].includes(o.status)
  );

  const filteredOrders = completedOrders.filter((o: any) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      o.orderNumber.toLowerCase().includes(searchLower) ||
      o.description?.toLowerCase().includes(searchLower)
    );
  });

  const selectedOrder = completedOrders.find((o: any) => o.id === selectedOrderId);

  const reorderMutation = useMutation({
    mutationFn: () => selfServiceApi.reorder(selectedOrderId, { notes, quantity }),
    onSuccess: (response) => {
      const newOrderId = response.data?.data?.id;
      if (newOrderId) {
        navigate(`/orders/${newOrderId}?reorder=success`);
      } else {
        navigate('/orders?reorder=success');
      }
    },
  });

  const handleReorder = () => {
    if (!selectedOrderId) return;
    reorderMutation.mutate();
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <Link
          to="/hub"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Hub
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <RefreshCw className="w-6 h-6 text-green-500" />
          Quick Reorder
        </h1>
        <p className="mt-1 text-gray-500">
          Select a past order to reorder with the same specifications
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Order Selection */}
        <div className="lg:col-span-2 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search past orders..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Order Grid */}
          <div className="grid md:grid-cols-2 gap-4">
            {filteredOrders.map((order: any, index: number) => {
              const isSelected = order.id === selectedOrderId;
              const total = order.lineItems?.reduce(
                (sum: number, item: any) => sum + item.quantity * Number(item.unitPrice),
                0
              ) || 0;

              return (
                <motion.button
                  key={order.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => setSelectedOrderId(order.id)}
                  className={cn(
                    'p-4 rounded-xl border text-left transition-all',
                    isSelected
                      ? 'border-green-500 bg-green-50 ring-2 ring-green-500'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900">
                        #{order.orderNumber}
                      </p>
                      <p className="text-sm text-gray-500 truncate mt-1">
                        {order.description}
                      </p>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                    )}
                  </div>
                  <div className="mt-3 flex items-center gap-4 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(order.createdAt)}
                    </span>
                    {total > 0 && (
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        {formatCurrency(total)}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Package className="w-3 h-3" />
                      {order.lineItems?.length || 0} items
                    </span>
                  </div>
                </motion.button>
              );
            })}
          </div>

          {filteredOrders.length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="font-medium text-gray-900">No orders found</h3>
              <p className="text-sm text-gray-500 mt-1">
                {search
                  ? 'Try a different search term'
                  : 'Complete orders will appear here for reordering'}
              </p>
            </div>
          )}
        </div>

        {/* Reorder Panel */}
        <div className="lg:col-span-1">
          <div className="sticky top-6">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden"
            >
              <div className="p-4 border-b border-gray-100 bg-green-50">
                <h3 className="font-semibold text-gray-900">Reorder Details</h3>
              </div>

              <div className="p-4 space-y-4">
                {selectedOrder ? (
                  <>
                    {/* Selected Order */}
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="font-medium text-gray-900">
                        #{selectedOrder.orderNumber}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        {selectedOrder.description}
                      </p>
                    </div>

                    {/* Line Items Preview */}
                    {selectedOrder.lineItems?.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">
                          Items to Reorder
                        </p>
                        <div className="space-y-2">
                          {selectedOrder.lineItems.slice(0, 3).map((item: any) => (
                            <div
                              key={item.id}
                              className="flex justify-between text-sm"
                            >
                              <span className="text-gray-600 truncate flex-1">
                                {item.description}
                              </span>
                              <span className="text-gray-400 ml-2">
                                ×{item.quantity * quantity}
                              </span>
                            </div>
                          ))}
                          {selectedOrder.lineItems.length > 3 && (
                            <p className="text-xs text-gray-400">
                              +{selectedOrder.lineItems.length - 3} more items
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Quantity Multiplier */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Quantity Multiplier
                      </label>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                          className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="text-xl font-semibold w-12 text-center">
                          {quantity}×
                        </span>
                        <button
                          onClick={() => setQuantity((q) => q + 1)}
                          className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        All item quantities will be multiplied by {quantity}
                      </p>
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Additional Notes
                      </label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Any changes or special requests..."
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                      />
                    </div>

                    {/* Submit */}
                    <button
                      onClick={handleReorder}
                      disabled={reorderMutation.isPending}
                      className="w-full btn btn-primary"
                    >
                      {reorderMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Creating Order...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Place Reorder
                        </>
                      )}
                    </button>

                    {reorderMutation.isError && (
                      <div className="flex items-center gap-2 text-sm text-red-600">
                        <AlertCircle className="w-4 h-4" />
                        Failed to create reorder. Please try again.
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <RefreshCw className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                    <p>Select an order to reorder</p>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Help */}
            <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
              <h4 className="text-sm font-medium text-blue-900">
                How Quick Reorder Works
              </h4>
              <ul className="mt-2 text-sm text-blue-700 space-y-1">
                <li>• Select a completed order from your history</li>
                <li>• Adjust quantity if you need more</li>
                <li>• Add notes for any changes</li>
                <li>• We'll create a new order with the same specs</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default QuickReorderPage;
