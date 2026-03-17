import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ChevronLeft,
  Plus,
  Trash2,
  Save,
  Search,
  Package,
  User,
  Calculator,
} from 'lucide-react';
import { api } from '../lib/api';
import { ItemMasterAutocomplete, type ItemMasterOption } from '../components/ItemMasterAutocomplete';

interface Customer {
  id: string;
  name: string;
  companyName: string | null;
  email: string | null;
}

interface ItemMaster {
  id: string;
  itemNumber: string;
  description: string;
  basePrice: number;
}

interface LineItem {
  id?: string;
  itemMasterId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  notes: string;
}

interface Quote {
  id: string;
  quoteNumber: string;
  status: string;
  customerId: string;
  customerName: string;
  description: string | null;
  notes: string | null;
  taxRate: number;
  discountPercent: number;
  validUntil: string | null;
  lineItems: LineItem[];
}

export function QuoteFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditing = Boolean(id);

  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [taxRate, setTaxRate] = useState(0);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [validUntil, setValidUntil] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  // Fetch quote data if editing
  const { data: quote, isLoading: quoteLoading } = useQuery({
    queryKey: ['quote', id],
    queryFn: async () => {
      const response = await api.get(`/quotes/${id}`);
      return response.data.data as Quote;
    },
    enabled: isEditing,
  });

  // Fetch customers for search
  const { data: customers } = useQuery({
    queryKey: ['customers-search', customerSearch],
    queryFn: async () => {
      const response = await api.get('/customers', {
        params: { search: customerSearch, pageSize: 10 },
      });
      return response.data.data.items as Customer[];
    },
    enabled: showCustomerSearch && customerSearch.length > 0,
  });

  // Populate form when editing
  useEffect(() => {
    if (quote) {
      setCustomerId(quote.customerId);
      setCustomerName(quote.customerName);
      setDescription(quote.description || '');
      setNotes(quote.notes || '');
      setTaxRate(Number(quote.taxRate));
      setDiscountPercent(Number(quote.discountPercent));
      setValidUntil(quote.validUntil ? quote.validUntil.split('T')[0] ?? '' : '');
      setLineItems(quote.lineItems.map(item => {
        const lineItem: LineItem = {
          itemMasterId: item.itemMasterId ?? null,
          description: item.description,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          notes: item.notes ?? '',
        };
        if (item.id) {
          lineItem.id = item.id;
        }
        return lineItem;
      }));
    }
  }, [quote]);

  const createMutation = useMutation({
    mutationFn: async (data: unknown) => {
      const response = await api.post('/quotes', data);
      return response.data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast.success(`Quote ${data.quoteNumber} created`);
      navigate('/sales/quotes');
    },
    onError: () => {
      toast.error('Failed to create quote');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: unknown) => {
      const response = await api.patch(`/quotes/${id}`, data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['quote', id] });
      toast.success('Quote updated');
      navigate('/sales/quotes');
    },
    onError: () => {
      toast.error('Failed to update quote');
    },
  });

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      {
        itemMasterId: null,
        description: '',
        quantity: 1,
        unitPrice: 0,
        notes: '',
      },
    ]);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: string | number | null) => {
    setLineItems(lineItems.map((item, i) => {
      if (i === index) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const selectItemForLine = (index: number, selected: ItemMasterOption) => {
    setLineItems(lineItems.map((item, i) => {
      if (i === index) {
        return {
          ...item,
          itemMasterId: selected.id,
          description: selected.name,
          unitPrice: selected.unitPrice,
        };
      }
      return item;
    }));
  };

  const clearItemForLine = (index: number) => {
    setLineItems(lineItems.map((item, i) => {
      if (i === index) {
        return {
          ...item,
          itemMasterId: null,
          description: '',
          unitPrice: 0,
        };
      }
      return item;
    }));
  };

  const selectCustomer = (customer: Customer) => {
    setCustomerId(customer.id);
    setCustomerName(customer.companyName || customer.name);
    setShowCustomerSearch(false);
    setCustomerSearch('');
  };

  // Calculate totals
  const subtotal = lineItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const discountAmount = subtotal * (discountPercent / 100);
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = taxableAmount * (taxRate / 100);
  const total = taxableAmount + taxAmount;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerId) {
      toast.error('Please select a customer');
      return;
    }

    if (lineItems.length === 0) {
      toast.error('Please add at least one line item');
      return;
    }

    const data = {
      customerId,
      customerName,
      description: description || null,
      notes: notes || null,
      taxRate,
      discountPercent,
      validUntil: validUntil || null,
      lineItems: lineItems.map(item => ({
        itemMasterId: item.itemMasterId,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        notes: item.notes || null,
      })),
    };

    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  if (isEditing && quoteLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-10 bg-gray-200 rounded w-1/3" />
        <div className="bg-white rounded-xl p-6 space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4" />
          <div className="grid grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-10 bg-gray-200 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to="/sales/quotes"
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
            {isEditing ? `Edit Quote ${quote?.quoteNumber}` : 'New Quote'}
          </h1>
          <p className="text-gray-500 mt-1">
            {isEditing ? 'Update quote details' : 'Create a new quote for a customer'}
          </p>
        </div>
        <button
          type="submit"
          disabled={createMutation.isPending || updateMutation.isPending}
          className="btn-primary flex items-center gap-2"
        >
          <Save className="h-4 w-4" />
          {createMutation.isPending || updateMutation.isPending
            ? 'Saving...'
            : isEditing
            ? 'Update Quote'
            : 'Create Quote'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Selection */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="h-5 w-5 text-gray-400" />
              Customer
            </h2>
            
            <div className="relative">
              {customerId ? (
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{customerName}</p>
                    <p className="text-sm text-gray-500">Customer selected</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerId('');
                      setCustomerName('');
                      setShowCustomerSearch(true);
                    }}
                    className="text-sm text-primary-600 hover:text-primary-700"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search for a customer..."
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setShowCustomerSearch(true);
                    }}
                    onFocus={() => setShowCustomerSearch(true)}
                    className="input-field pl-10"
                  />
                  {showCustomerSearch && customers && customers.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-60 overflow-auto">
                      {customers.map((customer) => (
                        <button
                          key={customer.id}
                          type="button"
                          onClick={() => selectCustomer(customer)}
                          className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-0"
                        >
                          <p className="font-medium text-gray-900">
                            {customer.companyName || customer.name}
                          </p>
                          <p className="text-sm text-gray-500">{customer.email}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Line Items */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Package className="h-5 w-5 text-gray-400" />
                Line Items
              </h2>
              <button
                type="button"
                onClick={addLineItem}
                className="btn-secondary flex items-center gap-2 text-sm"
              >
                <Plus className="h-4 w-4" />
                Add Item
              </button>
            </div>

            {lineItems.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Package className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                <p>No items added yet</p>
                <button
                  type="button"
                  onClick={addLineItem}
                  className="mt-2 text-primary-600 hover:text-primary-700 text-sm font-medium"
                >
                  Add your first item
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {lineItems.map((item, index) => (
                  <div
                    key={index}
                    className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="md:col-span-2">
                          <label className="label">Item</label>
                          <ItemMasterAutocomplete
                            selectedItemId={item.itemMasterId}
                            displayText={item.description}
                            onSelect={(selected) => selectItemForLine(index, selected)}
                            onClear={() => clearItemForLine(index)}
                            placeholder="Search items..."
                          />
                        </div>
                        <div>
                          <label className="label">Quantity</label>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) =>
                              updateLineItem(index, 'quantity', parseInt(e.target.value) || 1)
                            }
                            className="input-field"
                          />
                        </div>
                        <div>
                          <label className="label">Unit Price</label>
                          <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700">
                            {formatCurrency(item.unitPrice)}
                          </div>
                        </div>
                        <div className="md:col-span-3">
                          <label className="label">Notes</label>
                          <input
                            type="text"
                            value={item.notes}
                            onChange={(e) =>
                              updateLineItem(index, 'notes', e.target.value)
                            }
                            placeholder="Additional notes..."
                            className="input-field"
                          />
                        </div>
                        <div className="flex items-end">
                          <div className="w-full text-right">
                            <p className="text-sm text-gray-500">Line Total</p>
                            <p className="text-lg font-semibold text-gray-900">
                              {formatCurrency(item.quantity * item.unitPrice)}
                            </p>
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeLineItem(index)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Description & Notes */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Details</h2>
            <div className="space-y-4">
              <div>
                <label className="label">Quote Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of the quote..."
                  className="input-field"
                />
              </div>
              <div>
                <label className="label">Internal Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes for internal use..."
                  rows={3}
                  className="input-field"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Pricing Summary */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Calculator className="h-5 w-5 text-gray-400" />
              Pricing
            </h2>

            <div className="space-y-4">
              <div>
                <label className="label">Tax Rate (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={taxRate}
                  onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                  className="input-field"
                />
              </div>
              <div>
                <label className="label">Discount (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)}
                  className="input-field"
                />
              </div>

              <hr className="my-4" />

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="font-medium">{formatCurrency(subtotal)}</span>
                </div>
                {discountPercent > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Discount ({discountPercent}%)</span>
                    <span>-{formatCurrency(discountAmount)}</span>
                  </div>
                )}
                {taxRate > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Tax ({taxRate}%)</span>
                    <span>+{formatCurrency(taxAmount)}</span>
                  </div>
                )}
              </div>

              <hr className="my-4" />

              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-gray-900">Total</span>
                <span className="text-2xl font-bold text-primary-600">
                  {formatCurrency(total)}
                </span>
              </div>
            </div>
          </div>

          {/* Valid Until */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Validity</h2>
            <div>
              <label className="label">Valid Until</label>
              <input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="input-field"
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave blank for no expiration
              </p>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
