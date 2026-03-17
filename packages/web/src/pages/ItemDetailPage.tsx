import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  Package,
  ChevronLeft,
  ClipboardList,
  MapPin,
  Boxes,
  Calendar,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { api } from '../lib/api';
import { STATUS_COLORS, STATUS_DISPLAY_NAMES } from '@erp/shared';

interface ItemMaster {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  category: string | null;
  unit: string | null;
  unitPrice: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface OrderHistoryItem {
  lineItemId: string;
  quantity: number;
  order: {
    id: string;
    orderNumber: string;
    customerName: string;
    status: string;
    dueDate: string | null;
    createdAt: string;
  };
  createdAt: string;
}

interface InventoryItem {
  id: string;
  quantity: number;
  status: string;
  location: string | null;
  linkedOrder: {
    id: string;
    orderNumber: string;
    customerName: string;
  } | null;
}

interface ItemHistoryData {
  item: ItemMaster;
  orderHistory: OrderHistoryItem[];
  inventoryItems: InventoryItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const STATUS_STYLES: Record<string, string> = {
  AVAILABLE: 'bg-green-100 text-green-700',
  RESERVED: 'bg-amber-100 text-amber-700',
  IN_USE: 'bg-blue-100 text-blue-700',
  DEPLETED: 'bg-gray-100 text-gray-600',
};

export function ItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<'orders' | 'inventory'>('orders');

  const { data, isLoading, error } = useQuery<ItemHistoryData>({
    queryKey: ['item-history', id],
    queryFn: async () => {
      const response = await api.get(`/items/${id}/history`);
      return response.data.data;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto" />
          <p className="mt-4 text-gray-500">Loading item details...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Package className="h-16 w-16 text-gray-300 mx-auto" />
          <h2 className="mt-4 text-xl font-semibold text-gray-900">Item Not Found</h2>
          <p className="mt-2 text-gray-500">The item you're looking for doesn't exist or was deleted.</p>
          <Link to="/inventory" className="mt-4 inline-flex items-center text-primary-600 hover:underline">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Inventory
          </Link>
        </div>
      </div>
    );
  }

  const { item, orderHistory, inventoryItems } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to="/inventory"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="h-5 w-5 text-gray-600" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 text-white">
              <Package className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{item.name}</h1>
              <p className="text-gray-500 flex items-center gap-3">
                <span className="font-mono text-sm bg-gray-100 px-2 py-0.5 rounded">{item.sku}</span>
                {item.category && <span>• {item.category}</span>}
                {item.unit && <span>• {item.unit}</span>}
              </p>
            </div>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${item.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
          {item.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50">
              <ClipboardList className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{data.total}</p>
              <p className="text-sm text-gray-500">Total Orders</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-50">
              <Boxes className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{inventoryItems.length}</p>
              <p className="text-sm text-gray-500">Inventory Items</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-50">
              <TrendingUp className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {orderHistory.reduce((sum, oh) => sum + oh.quantity, 0)}
              </p>
              <p className="text-sm text-gray-500">Total Qty Ordered</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-50">
              <Calendar className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {item.unitPrice ? `$${item.unitPrice.toFixed(2)}` : '-'}
              </p>
              <p className="text-sm text-gray-500">Unit Price</p>
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      {item.description && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-sm font-medium text-gray-500 mb-2">Description</h2>
          <p className="text-gray-900">{item.description}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="border-b border-gray-100">
          <div className="flex">
            <button
              onClick={() => setActiveTab('orders')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === 'orders'
                  ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <ClipboardList className="h-4 w-4 inline mr-2" />
              Order History ({orderHistory.length})
            </button>
            <button
              onClick={() => setActiveTab('inventory')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === 'inventory'
                  ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Boxes className="h-4 w-4 inline mr-2" />
              Inventory ({inventoryItems.length})
            </button>
          </div>
        </div>

        {activeTab === 'orders' && (
          <div className="divide-y divide-gray-100">
            {orderHistory.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <ClipboardList className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                <p>No orders found for this item</p>
              </div>
            ) : (
              orderHistory.map((oh) => (
                <Link
                  key={oh.lineItemId}
                  to={`/orders/${oh.order.id}`}
                  className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-gray-200 transition-colors">
                      <ClipboardList className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">#{oh.order.orderNumber}</p>
                      <p className="text-sm text-gray-500">{oh.order.customerName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">Qty: {oh.quantity}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(oh.order.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span
                      className="px-2.5 py-1 text-xs font-medium rounded-full"
                      style={{
                        backgroundColor: `${STATUS_COLORS[oh.order.status as keyof typeof STATUS_COLORS]}20`,
                        color: STATUS_COLORS[oh.order.status as keyof typeof STATUS_COLORS],
                      }}
                    >
                      {STATUS_DISPLAY_NAMES[oh.order.status as keyof typeof STATUS_DISPLAY_NAMES]}
                    </span>
                    <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600" />
                  </div>
                </Link>
              ))
            )}
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="divide-y divide-gray-100">
            {inventoryItems.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Boxes className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                <p>No inventory items found</p>
              </div>
            ) : (
              inventoryItems.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <Boxes className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Qty: {inv.quantity}</p>
                      {inv.location && (
                        <p className="text-sm text-gray-500 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {inv.location}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {inv.linkedOrder ? (
                      <Link
                        to={`/orders/${inv.linkedOrder.id}`}
                        className="text-sm text-primary-600 hover:underline"
                      >
                        #{inv.linkedOrder.orderNumber}
                      </Link>
                    ) : (
                      <span className="text-sm text-gray-400">Unlinked</span>
                    )}
                    <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${STATUS_STYLES[inv.status] || STATUS_STYLES.DEPLETED}`}>
                      {inv.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
