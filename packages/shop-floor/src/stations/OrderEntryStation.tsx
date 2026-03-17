import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ClipboardList,
  Plus,
  Search,
  RefreshCw,
  AlertCircle,
  Clock,
  Building2,
  User as UserIcon,
  Package,
  Save,
  Trash2,
  ChevronDown,
  X,
  Edit3,
  CheckCircle,
  ShoppingBag,
} from 'lucide-react';
import { useConfigStore } from '../stores/config';
import { useAuthStore } from '../stores/auth';
import toast from 'react-hot-toast';

interface OrderLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice?: number;
  itemNumber?: number;
  itemMasterId?: string;
  itemMaster?: { name: string };
}

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  description: string;
  status: string;
  priority?: string;
  dueDate: string;
  createdAt: string;
  poNumber?: string;
  notes?: string;
  companyId?: string;
  contactId?: string;
  lineItems?: OrderLineItem[];
}

interface Company {
  id: string;
  name: string;
  companyType?: string;
  phone?: string;
  email?: string;
  contacts?: CompanyContact[];
}

interface CompanyContact {
  id: string;
  firstName: string;
  lastName: string;
  title?: string;
  role: string;
  isPrimary: boolean;
  email?: string;
  phone?: string;
  mobile?: string;
}

interface ItemMasterResult {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  unitPrice: number;
  category: string | null;
}

interface LineItem {
  id: string;
  itemMasterId: string | null;
  itemName: string;          // The item name (searchable)
  description: string;       // The item description (searchable)
  quantity: number;
  unitPrice: number;
  // Search state for name field
  nameSearchQuery: string;
  showNameResults: boolean;
  nameSearchResults: ItemMasterResult[];
  // Search state for description field
  descSearchQuery: string;
  showDescResults: boolean;
  descSearchResults: ItemMasterResult[];
}

type View = 'list' | 'create' | 'detail' | 'edit';

/** Calculate a date N business days from today (skips Sat/Sun) */
function getDefaultBusinessDueDate(businessDays: number = 7): string {
  const date = new Date();
  let added = 0;
  while (added < businessDays) {
    date.setDate(date.getDate() + 1);
    const dow = date.getDay();
    if (dow !== 0 && dow !== 6) {
      added++;
    }
  }
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function emptyLineItem(): LineItem {
  return {
    id: String(Date.now()),
    itemMasterId: null,
    itemName: '',
    description: '',
    quantity: 1,
    unitPrice: 0,
    nameSearchQuery: '',
    showNameResults: false,
    nameSearchResults: [],
    descSearchQuery: '',
    showDescResults: false,
    descSearchResults: [],
  };
}

export function OrderEntryStation() {
  const { config } = useConfigStore();
  const { token } = useAuthStore();
  const [view, setView] = useState<View>('list');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [pickupOrders, setPickupOrders] = useState<Order[]>([]);

  // Create form state — Company + Contact (replaces legacy Customer)
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companySearch, setCompanySearch] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [companyLoading, setCompanyLoading] = useState(false);
  const [contacts, setContacts] = useState<CompanyContact[]>([]);
  const [selectedContact, setSelectedContact] = useState<CompanyContact | null>(null);
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const companyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nameSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const descSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dueDate, setDueDate] = useState(getDefaultBusinessDueDate());
  const [poNumber, setPoNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([emptyLineItem()]);
  const [submitting, setSubmitting] = useState(false);
  const [pendingEmails, setPendingEmails] = useState<File[]>([]);

  const fetchOrders = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${config.apiUrl}/orders?limit=100&lightweight=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const json = await res.json();
      const items = json.data?.items ?? json.data ?? [];
      setOrders(Array.isArray(items) ? items : []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [config.apiUrl, token]);

  const fetchPickupOrders = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${config.apiUrl}/orders?status=COMPLETED&carrier=CUSTOMER_PICKUP&limit=50&lightweight=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const json = await res.json();
      const items = json.data?.items ?? json.data ?? [];
      setPickupOrders(Array.isArray(items) ? items : []);
    } catch {
      // Non-critical
    }
  }, [config.apiUrl, token]);

  useEffect(() => {
    fetchPickupOrders();
  }, [fetchPickupOrders]);

  const handleMarkComplete = async (orderId: string, orderNumber: string) => {
    if (!window.confirm(`Mark ${orderNumber} as complete?`)) return;
    try {
      const res = await fetch(`${config.apiUrl}/orders/${orderId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      toast.success(`${orderNumber} marked complete`);
      fetchOrders();
    } catch {
      toast.error('Failed to complete order');
    }
  };

  // ——— Company Search ———
  const searchCompanies = useCallback(async (query: string) => {
    if (!token || !query || query.length < 2) {
      setCompanies([]);
      return;
    }
    setCompanyLoading(true);
    try {
      const res = await fetch(
        `${config.apiUrl}/companies?search=${encodeURIComponent(query)}&pageSize=20`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) return;
      const json = await res.json();
      const items = json.data?.items ?? json.data ?? [];
      setCompanies(Array.isArray(items) ? items : []);
    } catch {
      // Non-critical
    } finally {
      setCompanyLoading(false);
    }
  }, [config.apiUrl, token]);

  const handleCompanySearchChange = useCallback((value: string) => {
    setCompanySearch(value);
    setShowCompanyDropdown(true);
    setSelectedCompany(null);
    setSelectedContact(null);
    setContacts([]);
    if (companyTimerRef.current) clearTimeout(companyTimerRef.current);
    companyTimerRef.current = setTimeout(() => {
      searchCompanies(value);
    }, 300);
  }, [searchCompanies]);

  // When a company is selected, fetch its contacts
  const selectCompany = useCallback(async (company: Company) => {
    setSelectedCompany(company);
    setCompanySearch(company.name);
    setShowCompanyDropdown(false);
    setSelectedContact(null);
    setContacts([]);

    // Fetch full company with contacts
    if (!token) return;
    try {
      const res = await fetch(`${config.apiUrl}/companies/${company.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const json = await res.json();
      const companyData = json.data;
      const contactList: CompanyContact[] = companyData?.contacts ?? [];
      setContacts(contactList);
      // Auto-select primary contact
      const primary = contactList.find((c: CompanyContact) => c.isPrimary);
      if (primary) setSelectedContact(primary);
    } catch {
      // Non-critical
    }
  }, [config.apiUrl, token]);

  // ——— Item Search (for name OR description field) ———
  const searchItemsByField = useCallback(async (
    query: string,
    lineItemId: string,
    field: 'name' | 'desc',
  ) => {
    // When a company is selected, no minimum chars needed for name field (shows company items).
    // Otherwise require 2 chars.
    const minChars = (selectedCompany && field === 'name') ? 0 : 2;
    if (!token || (query.length < minChars && !(selectedCompany && field === 'name' && query.length === 0))) {
      if (!token || query.length < minChars) {
        setLineItems((prev) =>
          prev.map((item) =>
            item.id === lineItemId
              ? field === 'name'
                ? { ...item, nameSearchResults: [], showNameResults: false }
                : { ...item, descSearchResults: [], showDescResults: false }
              : item,
          ),
        );
        return;
      }
    }
    try {
      let url = `${config.apiUrl}/items?search=${encodeURIComponent(query)}&pageSize=50&activeOnly=true`;
      // When company is selected and searching name field, filter by company
      if (selectedCompany && field === 'name') {
        url += `&companyId=${encodeURIComponent(selectedCompany.id)}`;
      }
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return;
      const json = await res.json();
      const results = json.data?.items ?? json.data ?? [];
      setLineItems((prev) =>
        prev.map((item) =>
          item.id === lineItemId
            ? field === 'name'
              ? { ...item, nameSearchResults: Array.isArray(results) ? results : [], showNameResults: true }
              : { ...item, descSearchResults: Array.isArray(results) ? results : [], showDescResults: true }
            : item,
        ),
      );
    } catch {
      // Non-critical
    }
  }, [config.apiUrl, token, selectedCompany]);

  // Handle typing in the NAME field
  const handleNameSearchChange = useCallback((lineItemId: string, value: string) => {
    setLineItems((prev) =>
      prev.map((item) =>
        item.id === lineItemId
          ? { ...item, nameSearchQuery: value, itemMasterId: null, itemName: '', description: '', unitPrice: 0, showNameResults: true }
          : item,
      ),
    );
    if (nameSearchTimerRef.current) clearTimeout(nameSearchTimerRef.current);
    // When company is selected, search immediately (even empty query shows company items)
    const delay = selectedCompany ? 150 : 300;
    nameSearchTimerRef.current = setTimeout(() => {
      searchItemsByField(value, lineItemId, 'name');
    }, delay);
  }, [searchItemsByField, selectedCompany]);

  // Handle typing in the DESCRIPTION field
  const handleDescSearchChange = useCallback((lineItemId: string, value: string) => {
    setLineItems((prev) =>
      prev.map((item) =>
        item.id === lineItemId
          ? { ...item, descSearchQuery: value, itemMasterId: null, itemName: '', description: '', unitPrice: 0, showDescResults: true }
          : item,
      ),
    );
    if (descSearchTimerRef.current) clearTimeout(descSearchTimerRef.current);
    descSearchTimerRef.current = setTimeout(() => {
      searchItemsByField(value, lineItemId, 'desc');
    }, 300);
  }, [searchItemsByField]);

  // Select an item — auto-fills BOTH name and description regardless of which field was searched
  const selectItemForLineItem = useCallback((lineItemId: string, item: ItemMasterResult, fromField: 'name' | 'desc') => {
    setLineItems((prev) =>
      prev.map((li) =>
        li.id === lineItemId
          ? {
              ...li,
              itemMasterId: item.id,
              itemName: item.name,
              description: item.description || item.name,
              unitPrice: Number(item.unitPrice) || 0,
              nameSearchQuery: item.name,
              descSearchQuery: item.description || item.name,
              showNameResults: false,
              showDescResults: false,
              nameSearchResults: [],
              descSearchResults: [],
            }
          : li,
      ),
    );
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Cleanup debounce timers
  useEffect(() => {
    return () => {
      if (companyTimerRef.current) clearTimeout(companyTimerRef.current);
      if (nameSearchTimerRef.current) clearTimeout(nameSearchTimerRef.current);
      if (descSearchTimerRef.current) clearTimeout(descSearchTimerRef.current);
    };
  }, []);

  const filteredOrders = orders.filter(
    (o) =>
      !searchQuery ||
      o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customerName.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const addLineItem = () => {
    setLineItems((prev) => [...prev, emptyLineItem()]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems((prev) => prev.filter((i) => i.id !== id));
    }
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: any) => {
    setLineItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  };

  const subtotal = lineItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );

  const handleSubmit = async () => {
    if (!selectedCompany) {
      toast.error('Select a company');
      return;
    }
    if (!lineItems.some((i) => i.itemMasterId)) {
      toast.error('Add at least one item from the item catalog');
      return;
    }

    setSubmitting(true);
    try {
      const validItems = lineItems.filter((i) => i.itemMasterId);
      const res = await fetch(`${config.apiUrl}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          companyId: selectedCompany.id,
          contactId: selectedContact?.id || undefined,
          customerName: selectedCompany.name,
          dueDate: dueDate || undefined,
          poNumber: poNumber || undefined,
          notes: notes || undefined,
          description: validItems
            .map((i) => `${i.quantity}x ${i.description}`)
            .join('; '),
          lineItems: validItems.map((i) => ({
            description: i.description,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            itemMasterId: i.itemMasterId,
          })),
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || `API ${res.status}`);
      }
      const json = await res.json();
      const newOrderId = json.data?.id;
      toast.success(`Order ${json.data?.orderNumber || ''} created`);

      // Upload queued email attachments
      if (newOrderId && pendingEmails.length > 0) {
        for (const emailFile of pendingEmails) {
          try {
            const formData = new FormData();
            formData.append('file', emailFile);
            formData.append('fileType', 'EMAIL');
            await fetch(`${config.apiUrl}/uploads/order/${newOrderId}`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` },
              body: formData,
            });
          } catch {
            // Non-blocking
          }
        }
        toast.success(`${pendingEmails.length} email(s) attached`);
      }

      setView('list');
      fetchOrders();
      // Reset form
      setSelectedCompany(null);
      setSelectedContact(null);
      setCompanySearch('');
      setContacts([]);
      setDueDate(getDefaultBusinessDueDate());
      setPoNumber('');
      setNotes('');
      setLineItems([emptyLineItem()]);
      setPendingEmails([]);
    } catch (err: any) {
      toast.error(`Failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // ——— List View ———
  if (view === 'list') {
    return (
      <div className="flex flex-col h-full">
        <div className="bg-white border-b px-4 py-3 flex items-center gap-4">
          <ClipboardList className="w-5 h-5 text-indigo-600" />
          <h2 className="font-semibold text-gray-900">Order Entry</h2>
          <div className="flex-1" />
          <button
            onClick={() => setView('create')}
            className="flex items-center gap-1 px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4" />
            New Order
          </button>
          <button
            onClick={fetchOrders}
            className="px-3 py-1.5 text-gray-500 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 pt-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search orders..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>

        {error && (
          <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <div className="flex-1 overflow-auto p-4 space-y-2">
          {loading && (
            <div className="flex justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-gray-300" />
            </div>
          )}
          {!loading && filteredOrders.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No orders found</p>
            </div>
          )}
          {filteredOrders.map((order) => (
            <div
              key={order.id}
              onClick={() => { setSelectedOrder(order); setView('detail'); }}
              className="bg-white rounded-lg border border-gray-200 p-4 hover:border-indigo-300 cursor-pointer transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <span className="font-bold text-gray-900">
                    {order.orderNumber}
                  </span>
                  <span className="ml-2 text-sm text-gray-600">
                    {order.customerName}
                  </span>
                  {(() => {
                    const firstItem = order.lineItems?.[0];
                    const name = firstItem?.itemMaster?.name || firstItem?.description?.split('..')?.[0] || '';
                    return name ? (
                      <span className="ml-2 text-sm text-gray-400 truncate">
                        — {name}
                      </span>
                    ) : null;
                  })()}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMarkComplete(order.id, order.orderNumber);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-green-600 hover:bg-green-50 rounded-lg flex-shrink-0 ml-2"
                  title="Mark order complete"
                >
                  <CheckCircle className="w-4 h-4" />
                  Done
                </button>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ml-2 ${
                    order.status === 'COMPLETED'
                      ? 'bg-green-100 text-green-700'
                      : order.status === 'IN_PROGRESS'
                        ? 'bg-blue-100 text-blue-700'
                        : order.status === 'PENDING'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {order.status}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(order.createdAt).toLocaleDateString()}
                </span>
                {order.dueDate && (
                  <span>
                    Due: {new Date(order.dueDate).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          ))}

          {/* Customer Pickup Section */}
          <div className="mt-4 border-t pt-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-indigo-600" />
              Customer Pickups
            </h3>
            {pickupOrders.length === 0 ? (
              <p className="text-sm text-gray-400">No orders waiting for pickup</p>
            ) : (
              <div className="space-y-2">
                {pickupOrders.map((order) => (
                  <div key={order.id} className="bg-indigo-50 rounded-lg border border-indigo-200 p-3 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-gray-900">{order.orderNumber}</span>
                      <span className="text-sm text-gray-500 ml-2">{order.customerName}</span>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          await fetch(`${config.apiUrl}/orders/${order.id}/complete`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                          });
                          toast.success(`${order.orderNumber} picked up`);
                          fetchPickupOrders();
                        } catch {
                          toast.error('Failed to update');
                        }
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Customer Picked Up
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ——— Detail View ———
  if (view === 'detail' && selectedOrder) {
    const order = selectedOrder;
    return (
      <div className="flex flex-col h-full">
        <div className="bg-white border-b px-4 py-3 flex items-center gap-4">
          <ClipboardList className="w-5 h-5 text-indigo-600" />
          <h2 className="font-semibold text-gray-900">{order.orderNumber}</h2>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              order.status === 'COMPLETED'
                ? 'bg-green-100 text-green-700'
                : order.status === 'IN_PROGRESS'
                  ? 'bg-blue-100 text-blue-700'
                  : order.status === 'PENDING'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-gray-100 text-gray-700'
            }`}
          >
            {order.status}
          </span>
          <div className="flex-1" />
          <button
            onClick={() => {
              // Pre-populate form for editing
              setCompanySearch(order.customerName || '');
              setSelectedCompany(order.companyId ? { id: order.companyId, name: order.customerName } as Company : null);
              setDueDate(order.dueDate ? new Date(order.dueDate).toISOString().slice(0, 10) : '');
              setPoNumber(order.poNumber || '');
              setNotes(order.notes || '');
              if (order.lineItems && order.lineItems.length > 0) {
                setLineItems(
                  order.lineItems.map((li) => ({
                    id: li.id,
                    itemMasterId: li.itemMasterId || null,
                    itemName: li.itemMaster?.name || '',
                    description: li.description,
                    quantity: li.quantity,
                    unitPrice: Number(li.unitPrice) || 0,
                    nameSearchQuery: li.itemMaster?.name || '',
                    descSearchQuery: li.description,
                    showNameResults: false,
                    showDescResults: false,
                    nameSearchResults: [],
                    descSearchResults: [],
                  })),
                );
              } else {
                setLineItems([emptyLineItem()]);
              }
              // Fetch contacts for the company
              if (order.companyId && token) {
                fetch(`${config.apiUrl}/companies/${order.companyId}`, {
                  headers: { Authorization: `Bearer ${token}` },
                })
                  .then((r) => r.json())
                  .then((json) => {
                    const contactList: CompanyContact[] = json.data?.contacts ?? [];
                    setContacts(contactList);
                    if (order.contactId) {
                      const match = contactList.find((c) => c.id === order.contactId);
                      if (match) setSelectedContact(match);
                    } else {
                      const primary = contactList.find((c) => c.isPrimary);
                      if (primary) setSelectedContact(primary);
                    }
                  })
                  .catch(() => {});
              }
              setView('edit');
            }}
            className="flex items-center gap-1 px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
          >
            <Edit3 className="w-4 h-4" />
            Edit
          </button>
          <button
            onClick={() => { setView('list'); setSelectedOrder(null); }}
            className="flex items-center gap-1 px-4 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg text-sm"
          >
            <X className="w-4 h-4" />
            Close
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6 max-w-3xl space-y-6">
          {/* Header Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Company</p>
              <p className="font-medium text-gray-900">{order.customerName || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">PO Number</p>
              <p className="font-medium text-gray-900">{order.poNumber || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Created</p>
              <p className="font-medium text-gray-900">{new Date(order.createdAt).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Due Date</p>
              <p className="font-medium text-gray-900">
                {order.dueDate ? new Date(order.dueDate).toLocaleDateString() : '—'}
              </p>
            </div>
          </div>

          {/* Notes */}
          {order.notes && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Notes</p>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{order.notes}</p>
            </div>
          )}

          {/* Line Items */}
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">
              Line Items ({order.lineItems?.length ?? 0})
            </p>
            <div className="space-y-2">
              {order.lineItems?.map((li, idx) => (
                <div key={li.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-gray-400 mr-2">{idx + 1}.</span>
                      {li.itemMaster?.name && (
                        <span className="font-medium text-gray-900">{li.itemMaster.name}</span>
                      )}
                      <p className="text-sm text-gray-600 mt-0.5 break-words">{li.description}</p>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <span className="text-sm font-medium text-gray-900">Qty: {li.quantity}</span>
                      {li.unitPrice != null && (
                        <p className="text-xs text-gray-500">
                          ${Number(li.unitPrice).toFixed(2)} ea
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {(!order.lineItems || order.lineItems.length === 0) && (
                <p className="text-sm text-gray-400 italic">No line items</p>
              )}
            </div>
          </div>

          {/* Description (legacy fallback) */}
          {order.description && (!order.lineItems || order.lineItems.length === 0) && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Description</p>
              <p className="text-sm text-gray-700">{order.description}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ——— Edit View: handle update submit ———
  const handleUpdate = async () => {
    if (!selectedOrder) return;
    if (!selectedCompany) {
      toast.error('Select a company');
      return;
    }

    setSubmitting(true);
    try {
      const validItems = lineItems.filter((i) => i.itemMasterId || i.description);
      const res = await fetch(`${config.apiUrl}/orders/${selectedOrder.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          companyId: selectedCompany.id,
          contactId: selectedContact?.id || undefined,
          customerName: selectedCompany.name,
          dueDate: dueDate || undefined,
          poNumber: poNumber || undefined,
          notes: notes || undefined,
          description: validItems
            .map((i) => `${i.quantity}x ${i.description}`)
            .join('; '),
          lineItems: validItems.map((i) => ({
            description: i.description,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            itemMasterId: i.itemMasterId || undefined,
          })),
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || `API ${res.status}`);
      }
      toast.success(`Order ${selectedOrder.orderNumber} updated`);
      setView('list');
      setSelectedOrder(null);
      fetchOrders();
      // Reset form
      setSelectedCompany(null);
      setSelectedContact(null);
      setCompanySearch('');
      setContacts([]);
      setDueDate(getDefaultBusinessDueDate());
      setPoNumber('');
      setNotes('');
      setLineItems([emptyLineItem()]);
    } catch (err: any) {
      toast.error(`Failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // ——— Create/Edit Form View ———
  const isEditing = view === 'edit';

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b px-4 py-3 flex items-center gap-4">
        <ClipboardList className="w-5 h-5 text-indigo-600" />
        <h2 className="font-semibold text-gray-900">
          {isEditing ? `Edit ${selectedOrder?.orderNumber || 'Order'}` : 'New Work Order'}
        </h2>
        <div className="flex-1" />
        <button
          onClick={() => {
            if (isEditing) {
              setView('detail');
            } else {
              setView('list');
            }
            // Reset form state
            setSelectedCompany(null);
            setSelectedContact(null);
            setCompanySearch('');
            setContacts([]);
            setDueDate(getDefaultBusinessDueDate());
            setPoNumber('');
            setNotes('');
            setLineItems([emptyLineItem()]);
          }}
          className="px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          Cancel
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6 max-w-3xl space-y-6">
        {/* Company (who to bill) */}
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <Building2 className="w-4 h-4 inline mr-1" />
            Company <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={companySearch}
            onChange={(e) => handleCompanySearchChange(e.target.value)}
            onFocus={() => { if (companies.length > 0) setShowCompanyDropdown(true); }}
            onBlur={() => setTimeout(() => setShowCompanyDropdown(false), 200)}
            placeholder="Type 2+ characters to search companies..."
            className={`w-full px-4 py-2 border rounded-lg text-sm ${
              !selectedCompany && companySearch.length > 0
                ? 'border-red-400 ring-2 ring-red-200'
                : selectedCompany
                ? 'border-green-400 ring-1 ring-green-200'
                : 'border-gray-300'
            }`}
          />
          {companyLoading && (
            <p className="text-xs text-gray-400 mt-1">Searching...</p>
          )}
          {showCompanyDropdown && companies.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-auto">
              {companies.slice(0, 15).map((c) => (
                <button
                  key={c.id}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectCompany(c)}
                  className="w-full text-left px-4 py-2 hover:bg-indigo-50 text-sm"
                >
                  <span className="font-medium">{c.name}</span>
                  {c.companyType && (
                    <span className="ml-2 text-xs text-gray-400">{c.companyType}</span>
                  )}
                </button>
              ))}
            </div>
          )}
          {selectedCompany && (
            <p className="text-xs text-green-600 mt-1">
              ✓ {selectedCompany.name}
            </p>
          )}
        </div>

        {/* Contact (PoC at company) — shows after company selected */}
        {selectedCompany && (
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <UserIcon className="w-4 h-4 inline mr-1" />
              Contact (Point of Contact)
            </label>
            {contacts.length > 0 ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowContactDropdown(!showContactDropdown)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm text-left flex items-center justify-between"
                >
                  {selectedContact
                    ? `${selectedContact.firstName} ${selectedContact.lastName}${selectedContact.title ? ` — ${selectedContact.title}` : ''}`
                    : 'Select a contact...'}
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </button>
                {showContactDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-auto">
                    {contacts.map((c) => (
                      <button
                        key={c.id}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setSelectedContact(c);
                          setShowContactDropdown(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-indigo-50 text-sm flex items-center justify-between"
                      >
                        <div>
                          <span className="font-medium">{c.firstName} {c.lastName}</span>
                          {c.title && <span className="ml-2 text-xs text-gray-400">{c.title}</span>}
                        </div>
                        {c.isPrimary && (
                          <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">Primary</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-400 mt-1">No contacts found for this company</p>
            )}
            {selectedContact && (
              <div className="text-xs text-gray-500 mt-1 flex gap-4">
                {selectedContact.email && <span>✉ {selectedContact.email}</span>}
                {selectedContact.phone && <span>☎ {selectedContact.phone}</span>}
                {selectedContact.mobile && <span>📱 {selectedContact.mobile}</span>}
              </div>
            )}
          </div>
        )}

        {/* Due Date + PO Number */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Clock className="w-4 h-4 inline mr-1" />
              Due Date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">Default: 7 business days from today</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              PO Number
            </label>
            <input
              type="text"
              value={poNumber}
              onChange={(e) => setPoNumber(e.target.value)}
              placeholder="Optional"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>

        {/* Line Items — Redesigned with Name + Description dual search */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Package className="w-4 h-4 inline mr-1" />
            Line Items
          </label>
          <div className="space-y-3">
            {lineItems.map((item, i) => (
              <div key={item.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <div className="flex items-start gap-2">
                  <span className="text-xs text-gray-400 w-6 pt-2.5">{i + 1}.</span>
                  <div className="flex-1 space-y-2">
                    {/* Name + Description side by side */}
                    <div className="grid grid-cols-2 gap-2">
                      {/* Name field (left) */}
                      <div className="relative">
                        <label className="block text-xs text-gray-500 mb-0.5">Name</label>
                        <input
                          type="text"
                          value={item.itemMasterId ? item.itemName : item.nameSearchQuery}
                          onChange={(e) => handleNameSearchChange(item.id, e.target.value)}
                          onFocus={() => {
                            if (item.nameSearchResults.length > 0) {
                              setLineItems((prev) =>
                                prev.map((li) => li.id === item.id ? { ...li, showNameResults: true } : li),
                              );
                            } else if (selectedCompany && !item.itemMasterId) {
                              // Company selected: immediately load company items on focus
                              searchItemsByField(item.nameSearchQuery || '', item.id, 'name');
                            }
                          }}
                          onBlur={() => {
                            setTimeout(() => {
                              setLineItems((prev) =>
                                prev.map((li) => li.id === item.id ? { ...li, showNameResults: false } : li),
                              );
                            }, 200);
                          }}
                          placeholder={selectedCompany ? "Click to see company items..." : "Search by item name..."}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                        {/* Name search dropdown — clean text only */}
                        {item.showNameResults && item.nameSearchResults.length > 0 && (
                          <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-auto">
                            {item.nameSearchResults.map((result) => (
                              <button
                                key={result.id}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => selectItemForLineItem(item.id, result, 'name')}
                                className="w-full text-left px-3 py-1.5 hover:bg-indigo-50 text-sm border-b border-gray-100 last:border-0"
                              >
                                {result.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Description field (right) */}
                      <div className="relative">
                        <label className="block text-xs text-gray-500 mb-0.5">Description</label>
                        <input
                          type="text"
                          value={item.itemMasterId ? item.description : item.descSearchQuery}
                          onChange={(e) => handleDescSearchChange(item.id, e.target.value)}
                          onFocus={() => {
                            if (item.descSearchResults.length > 0) {
                              setLineItems((prev) =>
                                prev.map((li) => li.id === item.id ? { ...li, showDescResults: true } : li),
                              );
                            }
                          }}
                          onBlur={() => {
                            setTimeout(() => {
                              setLineItems((prev) =>
                                prev.map((li) => li.id === item.id ? { ...li, showDescResults: false } : li),
                              );
                            }, 200);
                          }}
                          placeholder="Search by description..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                        {/* Description search dropdown — clean text only */}
                        {item.showDescResults && item.descSearchResults.length > 0 && (
                          <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-auto">
                            {item.descSearchResults.map((result) => (
                              <button
                                key={result.id}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => selectItemForLineItem(item.id, result, 'desc')}
                                className="w-full text-left px-3 py-1.5 hover:bg-indigo-50 text-sm border-b border-gray-100 last:border-0"
                              >
                                {result.description || result.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Quantity + Price row (appears after item selected) */}
                    {item.itemMasterId && (
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-2 shrink-0">
                          <label className="text-xs text-gray-400">Qty:</label>
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) =>
                              updateLineItem(item.id, 'quantity', parseInt(e.target.value) || 1)
                            }
                            min="1"
                            className="w-20 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-center"
                          />
                        </div>
                        <span className="text-gray-500">
                          × ${item.unitPrice.toFixed(2)}
                        </span>
                        <div className="flex-1" />
                        <span className="font-semibold text-gray-900">
                          ${(item.quantity * item.unitPrice).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => removeLineItem(item.id)}
                    className="text-gray-400 hover:text-red-500 pt-2"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={addLineItem}
            className="mt-2 text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Add Line Item
          </button>
          <div className="text-right mt-3 text-lg font-semibold text-gray-900">
            Total: ${subtotal.toFixed(2)}
          </div>
        </div>

        {/* Email Attachments */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email Attachments
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.eml,.msg';
                input.multiple = true;
                input.onchange = (e) => {
                  const files = Array.from((e.target as HTMLInputElement).files || []);
                  if (files.length > 0) setPendingEmails((prev) => [...prev, ...files]);
                };
                input.click();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-indigo-600 border border-indigo-300 rounded-lg hover:bg-indigo-50"
            >
              <ClipboardList className="w-4 h-4" />
              Attach Email (.eml/.msg)
            </button>
            {pendingEmails.length > 0 && (
              <span className="text-xs text-gray-500">{pendingEmails.length} file(s) queued</span>
            )}
          </div>
          {pendingEmails.map((file, i) => (
            <div key={i} className="flex items-center gap-2 mt-1 text-sm text-gray-600">
              <span className="truncate">{file.name}</span>
              <button
                onClick={() => setPendingEmails((prev) => prev.filter((_, idx) => idx !== i))}
                className="text-red-400 hover:text-red-600 text-xs"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Order notes, special instructions..."
            className="w-full h-24 px-4 py-2 border border-gray-300 rounded-lg text-sm resize-none"
          />
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={isEditing ? handleUpdate : handleSubmit}
            disabled={submitting || (!isEditing && !selectedCompany)}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {submitting
              ? (isEditing ? 'Updating...' : 'Creating...')
              : (isEditing ? 'Update Order' : 'Create Order')}
          </button>
        </div>
      </div>
    </div>
  );
}
