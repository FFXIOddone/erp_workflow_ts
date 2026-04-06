import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Package, Plus, X, Boxes, MapPin, Search, Link as LinkIcon, ClipboardList, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { filterBySearchFields } from '@erp/shared';
import { api } from '../lib/api';

const INVENTORY_STATUSES = ['AVAILABLE', 'RESERVED', 'IN_USE', 'DEPLETED'] as const;

const STATUS_STYLES: Record<string, string> = {
  AVAILABLE: 'bg-green-100 text-green-700 border border-green-200',
  RESERVED: 'bg-amber-100 text-amber-700 border border-amber-200',
  IN_USE: 'bg-blue-100 text-blue-700 border border-blue-200',
  DEPLETED: 'bg-gray-100 text-gray-600 border border-gray-200',
};

interface ItemMaster {
  id: string;
  sku: string;
  name: string;
}

interface WorkOrderOption {
  id: string;
  orderNumber: string;
  customerName: string;
}

export function InventoryPage() {
  const [showModal, setShowModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkItemId, setLinkItemId] = useState('');
  const [linkOrderId, setLinkOrderId] = useState('');
  const [itemMasterId, setItemMasterId] = useState('');
  const [location, setLocation] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState<string>('AVAILABLE');
  const [notes, setNotes] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['inventory'],
    queryFn: async () => {
      const response = await api.get('/inventory', { params: { pageSize: 100 } });
      return response.data.data;
    },
  });

  const { data: itemMastersData } = useQuery({
    queryKey: ['items'],
    queryFn: async () => {
      const response = await api.get('/items', { params: { pageSize: 100 } });
      return response.data.data;
    },
  });

  const { data: ordersData } = useQuery({
    queryKey: ['orders', 'active'],
    queryFn: async () => {
      const response = await api.get('/orders', { params: { pageSize: 100 } });
      return response.data.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: object) => {
      return api.post('/inventory', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success('Inventory item added');
      resetForm();
    },
    onError: () => {
      toast.error('Failed to add inventory item');
    },
  });

  const linkOrderMutation = useMutation({
    mutationFn: async ({ itemId, orderId }: { itemId: string; orderId: string }) => {
      return api.patch(`/inventory/${itemId}`, { linkedOrderId: orderId, status: 'RESERVED' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success('Material linked to order');
      setShowLinkModal(false);
      setLinkItemId('');
      setLinkOrderId('');
    },
    onError: () => {
      toast.error('Failed to link material');
    },
  });

  const resetForm = () => {
    setShowModal(false);
    setItemMasterId('');
    setLocation('');
    setQuantity(1);
    setStatus('AVAILABLE');
    setNotes('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      itemMasterId,
      location: location || null,
      quantity,
      status,
      notes: notes || null,
    });
  };

  const handleLinkToOrder = (itemId: string) => {
    setLinkItemId(itemId);
    setShowLinkModal(true);
  };

  const handleLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (linkItemId && linkOrderId) {
      linkOrderMutation.mutate({ itemId: linkItemId, orderId: linkOrderId });
    }
  };

  const items = Array.isArray(data?.items) ? data.items : [];
  const totalItems = typeof data?.total === 'number' ? data.total : items.length;
  const itemMasters: ItemMaster[] = Array.isArray(itemMastersData?.items) ? itemMastersData.items : [];
  const activeOrdersSource = Array.isArray(ordersData?.items) ? ordersData.items : [];
  const activeOrders: WorkOrderOption[] = activeOrdersSource
    .filter((o: { status: string }) => !['COMPLETED', 'SHIPPED', 'CANCELLED'].includes(o.status));
  
  // Filter items by search term
  const filteredItems = searchTerm
    ? filterBySearchFields(
        items,
        searchTerm,
        (item: { itemMaster: { id: string; sku: string; name: string }; location: string | null }) => [
          item.itemMaster.name,
          item.itemMaster.sku,
          item.location,
        ],
      )
    : items;

  return (
    <>
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg">
              <Boxes className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
              <p className="text-gray-500">{totalItems} items in stock</p>
            </div>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center px-4 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl hover:from-primary-700 hover:to-primary-800 shadow-lg shadow-primary-200 transition-all font-medium"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Item
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md group">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-primary-500 transition-colors" />
        <input
          type="text"
          placeholder="Search by name, SKU, or location..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input-field pl-10"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            ×
          </button>
        )}
      </div>

      {/* Link to Order Modal */}
      {showLinkModal && (
        <div className="modal-backdrop">
          <div className="modal-content max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                    <ClipboardList className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Request Material for Order</h3>
                </div>
                <button onClick={() => setShowLinkModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
              <form onSubmit={handleLinkSubmit} className="space-y-4">
                <div>
                  <label className="label-text">Select Work Order *</label>
                  <select
                    required
                    value={linkOrderId}
                    onChange={(e) => setLinkOrderId(e.target.value)}
                    className="select-field"
                  >
                    <option value="">Select an order...</option>
                    {activeOrders.map((o: WorkOrderOption) => (
                      <option key={o.id} value={o.id}>
                        #{o.orderNumber} - {o.customerName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowLinkModal(false)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={linkOrderMutation.isPending || !linkOrderId}
                    className="btn-primary"
                  >
                    {linkOrderMutation.isPending ? 'Linking...' : 'Link to Order'}
                  </button>
                </div>
              </form>
            </div>
        </div>
      )}

      {/* Add Item Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={resetForm}>
          <div className="modal-content max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 text-white">
                    <Package className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Add Inventory Item</h3>
                </div>
                <button onClick={resetForm} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label-text">Item Master *</label>
                  <select
                    required
                    value={itemMasterId}
                    onChange={(e) => setItemMasterId(e.target.value)}
                    className="select-field"
                  >
                    <option value="">Select an item...</option>
                    {itemMasters.map((im) => (
                      <option key={im.id} value={im.id}>
                        {im.sku} - {im.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label-text">Location</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g., Shelf A-1"
                      className="input-field pl-10"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label-text">Quantity *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={quantity}
                      onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="label-text">Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="select-field"
                    >
                      {INVENTORY_STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label-text">Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="input-field"
                    placeholder="Additional notes..."
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isPending}
                    className="btn-primary"
                  >
                    {createMutation.isPending ? 'Adding...' : 'Add Item'}
                  </button>
                </div>
              </form>
            </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-soft border border-gray-100 overflow-hidden animate-fade-in">
        <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gradient-to-r from-gray-50 to-white">
            <tr>
              <th className="table-header cursor-default">
                Item
              </th>
              <th className="table-header cursor-default">
                SKU
              </th>
              <th className="table-header cursor-default">
                Location
              </th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Quantity
              </th>
              <th className="table-header cursor-default">
                Status
              </th>
              <th className="table-header cursor-default">
                Linked Order
              </th>
              <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              // Skeleton loading rows
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-32" /></td>
                  <td className="px-6 py-4"><div className="h-6 bg-gray-200 rounded w-20" /></td>
                  <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-24" /></td>
                  <td className="px-6 py-4 text-right"><div className="h-4 bg-gray-200 rounded w-8 ml-auto" /></td>
                  <td className="px-6 py-4"><div className="h-6 bg-gray-200 rounded-full w-20" /></td>
                  <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-16" /></td>
                  <td className="px-6 py-4 text-center"><div className="h-6 bg-gray-200 rounded w-16 mx-auto" /></td>
                </tr>
              ))
            ) : filteredItems.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center">
                      <Package className="h-6 w-6 text-emerald-500" />
                    </div>
                    <span className="text-gray-500">{searchTerm ? 'No items match your search' : 'No inventory items'}</span>
                  </div>
                </td>
              </tr>
            ) : (
              filteredItems.map((item: {
                id: string;
                itemMaster: { id: string; sku: string; name: string };
                location: string | null;
                quantity: number;
                status: string;
                linkedOrder: { orderNumber: string } | null;
              }, index: number) => (
                <tr key={item.id} className="table-row" style={{ animationDelay: `${index * 20}ms` }}>
                  <td className="px-6 py-4 font-semibold text-gray-900">
                    <Link 
                      to={`/inventory/items/${item.itemMaster.id}`}
                      className="hover:text-primary-600 hover:underline inline-flex items-center gap-1 group"
                    >
                      {item.itemMaster.name}
                      <ExternalLink className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 text-sm font-mono rounded">
                      {item.itemMaster.sku}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {item.location ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {item.location}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`font-semibold ${item.quantity <= 5 ? 'text-red-600' : 'text-gray-900'}`}>
                      {item.quantity}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${STATUS_STYLES[item.status] || STATUS_STYLES.DEPLETED}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {item.linkedOrder ? (
                      <span className="text-primary-600 font-medium">#{item.linkedOrder.orderNumber}</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {!item.linkedOrder && item.status === 'AVAILABLE' && (
                      <button
                        onClick={() => handleLinkToOrder(item.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                      >
                        <LinkIcon className="h-3.5 w-3.5" />
                        Request
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
    </>
  );
}
