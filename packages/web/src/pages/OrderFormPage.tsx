import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2, Save, FileText, MapPin, Package, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import {
  STATION_DISPLAY_NAMES,
  PRIORITY_LABELS,
  COMPANY_BRAND_DISPLAY_NAMES,
  CompanyBrand,
  PrintingMethod,
  inferRoutingFromOrderDetails,
  isDesignOnlyOrder,
} from '@erp/shared';
import { ItemMasterAutocomplete, type ItemMasterOption } from '../components/ItemMasterAutocomplete';

interface LineItemForm {
  id?: string;
  itemMasterId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  notes: string;
}

interface CompanySearchResult {
  id: string;
  name: string;
  legalName?: string | null;
  email?: string | null;
}

const STATIONS = ['ROLL_TO_ROLL', 'SCREEN_PRINT', 'PRODUCTION', 'FLATBED', 'DESIGN', 'SALES', 'INSTALLATION', 'ORDER_ENTRY', 'SHIPPING_RECEIVING'] as const;

// Generate a temporary order number (TEMPWO-XXXXXX format)
// These are unvalidated orders that need to be linked to real QuickBooks orders later
function generateOrderNumber(): string {
  // Generate a random 6-digit number for temp work orders
  const random = Math.floor(Math.random() * 900000) + 100000; // 100000-999999
  return `TEMPWO-${random}`;
}

export function OrderFormPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditing = !!id;
  const customerInputRef = useRef<HTMLInputElement>(null);

  const [orderNumber, setOrderNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companySearch, setCompanySearch] = useState('');
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState(3);
  const [companyBrand, setCompanyBrand] = useState<CompanyBrand>(CompanyBrand.WILDE_SIGNS);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [routing, setRouting] = useState<string[]>([]);
  const [lineItems, setLineItems] = useState<LineItemForm[]>([
    { itemMasterId: null, description: '', quantity: 1, unitPrice: 0, notes: '' },
  ]);

  // Fetch companies for autocomplete
  const { data: companiesData } = useQuery({
    queryKey: ['companies-search', companySearch],
    queryFn: async () => {
      const response = await api.get('/companies', {
        params: { search: companySearch, pageSize: 10, isActive: true },
      });
      return response.data.data.items as CompanySearchResult[];
    },
    enabled: companySearch.trim().length > 0 && showCompanyDropdown,
  });

  // Load company from URL param
  useEffect(() => {
    const companyIdParam = searchParams.get('companyId');
    if (companyIdParam && !isEditing) {
      api.get(`/companies/${companyIdParam}`).then((response) => {
        const company = response.data.data as CompanySearchResult;
        setCompanyId(company.id);
        setCustomerName(company.name);
        setCompanySearch(company.name);
      }).catch(() => {
        // Ignore if company not found
      });
    }
  }, [searchParams, isEditing]);

  // Check for template data on mount (for new orders only)
  useEffect(() => {
    if (!isEditing) {
      setOrderNumber(generateOrderNumber());
      
      const templateData = sessionStorage.getItem('orderTemplate');
      if (templateData) {
        try {
          const template = JSON.parse(templateData);
          if (template.customerName) setCustomerName(template.customerName);
          if (template.routing) setRouting(template.routing);
          if (template.lineItems && template.lineItems.length > 0) {
            setLineItems(
              template.lineItems.map((item: { description: string; quantity: number; unitPrice: number; itemMasterId?: string }) => ({
                itemMasterId: item.itemMasterId || null,
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                notes: '',
              }))
            );
          }
          sessionStorage.removeItem('orderTemplate');
          toast.success('Template applied!');
        } catch {
          // Ignore invalid template data
        }
      }
    }
  }, [isEditing]);

  // Load existing order if editing
  const { data: existingOrder, isLoading: isLoadingOrder } = useQuery({
    queryKey: ['orders', id],
    queryFn: async () => {
      const response = await api.get(`/orders/${id}`);
      return response.data.data;
    },
    enabled: isEditing,
    staleTime: 0, // Always refetch when editing
  });

  // Populate form when existing order data is loaded
  useEffect(() => {
    if (existingOrder && isEditing) {
      setOrderNumber(existingOrder.orderNumber);
      setCustomerName(existingOrder.customerName);
      setCompanyId(existingOrder.companyId || null);
      setCompanySearch(existingOrder.customerName || '');
      setDescription(existingOrder.description || '');
      setPriority(existingOrder.priority);
      setCompanyBrand(existingOrder.companyBrand || CompanyBrand.WILDE_SIGNS);
      setDueDate(existingOrder.dueDate ? existingOrder.dueDate.split('T')[0] : '');
      setNotes(existingOrder.notes || '');
      setRouting(existingOrder.routing || []);
      setLineItems(
        existingOrder.lineItems && existingOrder.lineItems.length > 0
          ? existingOrder.lineItems.map((item: LineItemForm & { id: string; itemMasterId?: string }) => ({
              id: item.id,
              itemMasterId: item.itemMasterId || null,
              description: item.description,
              quantity: item.quantity,
              unitPrice: Number(item.unitPrice),
              notes: item.notes || '',
            }))
          : [{ itemMasterId: null, description: '', quantity: 1, unitPrice: 0, notes: '' }]
      );
    }
  }, [existingOrder, isEditing]);

  const createMutation = useMutation({
    mutationFn: async (data: object) => {
      return api.post('/orders', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Order created successfully');
      navigate('/orders');
    },
    onError: () => {
      toast.error('Failed to create order');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: object) => {
      return api.patch(`/orders/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Order updated successfully');
      navigate(`/orders/${id}`);
    },
    onError: () => {
      toast.error('Failed to update order');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedCustomerName = customerName.trim();
    const trimmedDescription = description.trim();
    const normalizedRouting = isDesignOnlyOrder({ description: trimmedDescription, routing })
      ? [PrintingMethod.DESIGN]
      : routing.length > 0
        ? routing
        : inferRoutingFromOrderDetails({ description: trimmedDescription });

    if (!trimmedCustomerName) {
      toast.error('Please select a company');
      return;
    }

    if (!companyId && !isEditing) {
      toast.error('Please select a company from the list');
      return;
    }

    if (normalizedRouting.length === 0) {
      toast.error('Please select at least one station for routing');
      return;
    }

    const data = {
      orderNumber,
      customerName: trimmedCustomerName,
      companyId: companyId || undefined,
      description: trimmedDescription,
      priority,
      companyBrand,
      dueDate: dueDate || null,
      notes: notes || null,
      routing: normalizedRouting,
      lineItems: lineItems
        .filter((item) => item.description.trim())
        .map((item) => ({
          id: item.id,
          itemMasterId: item.itemMasterId,
          description: item.description.trim(),
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          notes: item.notes.trim() || null,
        })),
    };

    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { itemMasterId: null, description: '', quantity: 1, unitPrice: 0, notes: '' }]);
  };

  const selectItemMaster = (index: number, item: ItemMasterOption) => {
    setLineItems((prev) =>
      prev.map((li, i) =>
        i === index
          ? {
              ...li,
              itemMasterId: item.id,
              description: item.name,
              unitPrice: item.unitPrice,
            }
          : li
      )
    );
  };

  const clearItemMaster = (index: number) => {
    setLineItems((prev) =>
      prev.map((li, i) =>
        i === index
          ? { ...li, itemMasterId: null, description: '', unitPrice: 0 }
          : li
      )
    );
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  const updateLineItem = (index: number, field: keyof LineItemForm, value: string | number) => {
    setLineItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    );
  };

  const toggleStation = (station: string) => {
    setRouting((currentRouting) =>
      currentRouting.includes(station)
        ? currentRouting.filter((currentStation) => currentStation !== station)
        : [...currentRouting, station]
    );
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  if (isEditing && isLoadingOrder) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Header skeleton */}
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-gray-200 rounded-lg" />
          <div>
            <div className="h-7 bg-gray-200 rounded w-40 mb-2" />
            <div className="h-4 bg-gray-100 rounded w-32" />
          </div>
        </div>
        
        {/* Form skeleton */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="h-6 bg-gray-200 rounded w-40 mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i}>
                <div className="h-4 bg-gray-100 rounded w-24 mb-2" />
                <div className="h-11 bg-gray-200 rounded-xl" />
              </div>
            ))}
          </div>
        </div>
        
        {/* Routing skeleton */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="h-6 bg-gray-200 rounded w-36 mb-4" />
          <div className="flex gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-200 rounded-xl w-24" />
            ))}
          </div>
        </div>
        
        {/* Line items skeleton */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="h-6 bg-gray-200 rounded w-28 mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-24 bg-gray-100 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-lg">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isEditing ? 'Edit Order' : 'New Order'}
            </h1>
            <p className="text-gray-500">
              {isEditing ? 'Update order details' : 'Create a new work order'}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in">
        {/* Basic Info */}
        <div className="bg-white rounded-xl shadow-soft border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label-text">
                Order Number *
              </label>
              <input
                type="text"
                required
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="62453"
                className="input-field disabled:bg-gray-50 disabled:text-gray-500"
                disabled={isEditing}
              />
            </div>
            <div className="relative">
              <label className="label-text">
                Company *
              </label>
              <div className="relative">
                <input
                  ref={customerInputRef}
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => {
                    setCustomerName(e.target.value);
                    setCompanySearch(e.target.value);
                    setCompanyId(null);
                    setShowCompanyDropdown(true);
                  }}
                  onFocus={() => setShowCompanyDropdown(true)}
                  onBlur={() => setTimeout(() => setShowCompanyDropdown(false), 200)}
                  placeholder="Search for a company"
                  className="input-field pr-10"
                />
                {companyId && (
                  <button
                    type="button"
                    onClick={() => {
                      setCompanyId(null);
                      setCustomerName('');
                      setCompanySearch('');
                      customerInputRef.current?.focus();
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {showCompanyDropdown && companiesData && companiesData.length > 0 && !companyId && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                  {companiesData.map((company) => (
                    <button
                      key={company.id}
                      type="button"
                      onClick={() => {
                        setCompanyId(company.id);
                        setCustomerName(company.name);
                        setCompanySearch(company.name);
                        setShowCompanyDropdown(false);
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50 flex flex-col"
                    >
                      <span className="font-medium text-gray-900">{company.name}</span>
                      {(company.legalName || company.email) && (
                        <span className="text-sm text-gray-500">{company.legalName || company.email}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {companyId && (
                <p className="mt-1 text-xs text-green-600">Linked to company record</p>
              )}
            </div>
            <div className="md:col-span-2">
              <label className="label-text">
                Description *
              </label>
              <textarea
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Order description"
                rows={3}
                className="input-field"
              />
            </div>
            <div>
              <label className="label-text">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                className="select-field"
              >
                {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-text">
                Company
              </label>
              <select
                value={companyBrand}
                onChange={(e) => setCompanyBrand(e.target.value as CompanyBrand)}
                className="select-field"
              >
                {Object.entries(COMPANY_BRAND_DISPLAY_NAMES).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-text">
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="input-field"
              />
            </div>
            <div className="md:col-span-2">
              <label className="label-text">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes"
                rows={2}
                className="input-field"
              />
            </div>
          </div>
        </div>

        {/* Routing */}
        <div className="bg-white rounded-xl shadow-soft border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="h-5 w-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">Station Routing</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Select the stations this order needs to go through.
            <span className="text-primary-500"> Production & Shipping are auto-added when a printing station is selected.</span>
          </p>
          <div className="flex flex-wrap gap-3">
            {STATIONS.map((station) => (
              <button
                key={station}
                type="button"
                onClick={() => toggleStation(station)}
                className={`px-4 py-2 rounded-xl font-medium transition-all ${
                  routing.includes(station)
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {STATION_DISPLAY_NAMES[station]}
              </button>
            ))}
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-white rounded-xl shadow-soft border border-gray-100 p-6">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary-600" />
              <h2 className="text-lg font-semibold text-gray-900">Line Items</h2>
            </div>
            <button
              type="button"
              onClick={addLineItem}
              className="inline-flex items-center px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-colors"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Item
            </button>
          </div>

          <div className="space-y-4">
            {lineItems.map((item, index) => (
              <div
                key={index}
                className="grid grid-cols-12 gap-3 items-start p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors"
              >
                <div className="col-span-12 md:col-span-5">
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">
                    Item
                  </label>
                  <ItemMasterAutocomplete
                    selectedItemId={item.itemMasterId}
                    displayText={item.description}
                    onSelect={(selected) => selectItemMaster(index, selected)}
                    onClear={() => clearItemMaster(index)}
                    placeholder="Search items..."
                    compact
                  />
                </div>
                <div className="col-span-4 md:col-span-2">
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">
                    Qty
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateLineItem(index, 'quantity', parseInt(e.target.value) || 1)}
                    className="input-field text-sm"
                  />
                </div>
                <div className="col-span-4 md:col-span-2">
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">
                    Unit Price
                  </label>
                  <div className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700">
                    ${item.unitPrice.toFixed(2)}
                  </div>
                </div>
                <div className="col-span-3 md:col-span-2">
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">
                    Total
                  </label>
                  <div className="px-4 py-2.5 bg-gradient-to-r from-gray-100 to-gray-50 rounded-xl text-sm font-semibold text-gray-900">
                    ${(item.quantity * item.unitPrice).toFixed(2)}
                  </div>
                </div>
                <div className="col-span-1 flex items-end">
                  <button
                    type="button"
                    onClick={() => removeLineItem(index)}
                    disabled={lineItems.length === 1}
                    className="p-2.5 text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="mt-6 pt-6 border-t border-gray-100 flex justify-end">
            <div className="text-right bg-gradient-to-r from-primary-50 to-primary-100/50 px-6 py-4 rounded-xl">
              <p className="text-sm text-primary-700 font-medium">Order Total</p>
              <p className="text-3xl font-bold text-primary-900">
                $
                {lineItems
                  .reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
                  .toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn-secondary px-5"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary px-5 gap-2 shadow-lg shadow-primary-200"
          >
            <Save className="h-4 w-4" />
            {isSubmitting ? 'Saving...' : isEditing ? 'Update Order' : 'Create Order'}
          </button>
        </div>
      </form>
    </div>
  );
}
