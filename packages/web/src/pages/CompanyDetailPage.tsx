import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ChevronLeft,
  Building2,
  Mail,
  Phone,
  MapPin,
  Edit,
  Trash2,
  Plus,
  User,
  FileText,
  Package,
  Clock,
  DollarSign,
  Star,
  X,
  MapPinned,
  Users,
  ExternalLink,
  CheckCircle,
  CreditCard,
  Shield,
  Briefcase,
} from 'lucide-react';
import { api } from '../lib/api';
import { OrderStatus } from '@erp/shared';
import { format, formatDistanceToNow } from 'date-fns';

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  ON_HOLD: 'bg-red-100 text-red-800',
  READY_TO_SHIP: 'bg-purple-100 text-purple-800',
  SHIPPED: 'bg-gray-100 text-gray-800',
};

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  title: string | null;
  role: string | null;
  isPrimary: boolean;
  notes: string | null;
}

interface CompanyLocation {
  id: string;
  childCompany: {
    id: string;
    name: string;
    city: string | null;
    state: string | null;
    phone: string | null;
    _count?: {
      workOrders: number;
    };
  };
}

interface Company {
  id: string;
  name: string;
  legalName: string | null;
  email: string | null;
  phone: string | null;
  fax: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  country: string;
  notes: string | null;
  taxExempt: boolean;
  taxExemptId: string | null;
  creditLimit: number | null;
  currentBalance: number | null;
  paymentTerms: string | null;
  isOnCreditHold: boolean;
  creditHoldReason: string | null;
  companyType: string | null;
  industry: string | null;
  salesRep: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  billingAddress: string | null;
  billingCity: string | null;
  billingState: string | null;
  billingZipCode: string | null;
  contacts: Contact[];
  workOrders: Array<{
    id: string;
    orderNumber: string;
    description: string;
    status: OrderStatus;
    priority: number;
    dueDate: string | null;
    createdAt: string;
  }>;
  quotes: Array<{
    id: string;
    quoteNumber: string;
    description: string | null;
    status: string;
    total: string;
    createdAt: string;
  }>;
  childRelationships: CompanyLocation[];
  parentRelationship: {
    parentCompany: {
      id: string;
      name: string;
    };
  } | null;
  _count: {
    quotes: number;
    workOrders: number;
    contacts: number;
    childRelationships: number;
  };
}

interface ContactFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  mobile: string;
  title: string;
  role: string;
  isPrimary: boolean;
  notes: string;
}

const initialContactFormData: ContactFormData = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  mobile: '',
  title: '',
  role: '',
  isPrimary: false,
  notes: '',
};

export function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'contacts' | 'locations' | 'orders' | 'quotes'>('overview');
  const [showContactModal, setShowContactModal] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [contactFormData, setContactFormData] = useState<ContactFormData>(initialContactFormData);

  const { data: company, isLoading, error } = useQuery({
    queryKey: ['company', id],
    queryFn: async () => {
      const response = await api.get(`/companies/${id}`);
      return response.data.data as Company;
    },
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/companies/${id}`);
    },
    onSuccess: () => {
      toast.success('Company deleted');
      navigate('/companies');
    },
    onError: (error: Error & { response?: { data?: { error?: string } } }) => {
      toast.error(error.response?.data?.error || 'Failed to delete company');
    },
  });

  const createContactMutation = useMutation({
    mutationFn: async (data: ContactFormData) => {
      const response = await api.post(`/companies/${id}/contacts`, data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company', id] });
      toast.success('Contact added');
      closeContactModal();
    },
    onError: () => {
      toast.error('Failed to add contact');
    },
  });

  const updateContactMutation = useMutation({
    mutationFn: async ({ contactId, data }: { contactId: string; data: Partial<ContactFormData> }) => {
      const response = await api.patch(`/companies/${id}/contacts/${contactId}`, data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company', id] });
      toast.success('Contact updated');
      closeContactModal();
    },
    onError: () => {
      toast.error('Failed to update contact');
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: async (contactId: string) => {
      await api.delete(`/companies/${id}/contacts/${contactId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company', id] });
      toast.success('Contact removed');
    },
    onError: () => {
      toast.error('Failed to remove contact');
    },
  });

  const openCreateContactModal = () => {
    setEditingContact(null);
    setContactFormData(initialContactFormData);
    setShowContactModal(true);
  };

  const openEditContactModal = (contact: Contact) => {
    setEditingContact(contact);
    setContactFormData({
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email || '',
      phone: contact.phone || '',
      mobile: contact.mobile || '',
      title: contact.title || '',
      role: contact.role || '',
      isPrimary: contact.isPrimary,
      notes: contact.notes || '',
    });
    setShowContactModal(true);
  };

  const closeContactModal = () => {
    setShowContactModal(false);
    setEditingContact(null);
    setContactFormData(initialContactFormData);
  };

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingContact) {
      updateContactMutation.mutate({ contactId: editingContact.id, data: contactFormData });
    } else {
      createContactMutation.mutate(contactFormData);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto" />
          <p className="mt-4 text-gray-500">Loading company...</p>
        </div>
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Building2 className="h-16 w-16 mx-auto text-gray-300 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Company not found</h2>
          <p className="text-gray-500 mb-4">The company you're looking for doesn't exist or has been deleted.</p>
          <Link to="/companies" className="btn-primary">
            Back to Companies
          </Link>
        </div>
      </div>
    );
  }

  const primaryContact = company.contacts.find((c) => c.isPrimary);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/companies"
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-cyan-500 flex items-center justify-center text-white font-bold text-2xl shadow-lg">
              {company.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{company.name}</h1>
              {company.legalName && company.legalName !== company.name && (
                <p className="text-gray-500">{company.legalName}</p>
              )}
              <div className="flex items-center gap-2 mt-1">
                {company.parentRelationship && (
                  <Link
                    to={`/companies/${company.parentRelationship.parentCompany.id}`}
                    className="text-sm text-primary-600 hover:underline flex items-center gap-1"
                  >
                    <Building2 className="h-3 w-3" />
                    {company.parentRelationship.parentCompany.name}
                  </Link>
                )}
                {company.companyType && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 rounded">
                    {company.companyType}
                  </span>
                )}
                {company.salesRep && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded">
                    Rep: {company.salesRep}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (confirm('Are you sure you want to delete this company?')) {
                deleteMutation.mutate();
              }
            }}
            className="btn-secondary text-red-600 hover:bg-red-50 border-red-200"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Package className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{company._count.workOrders}</p>
              <p className="text-sm text-gray-500">Orders</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 rounded-lg">
              <FileText className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{company._count.quotes}</p>
              <p className="text-sm text-gray-500">Quotes</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-50 rounded-lg">
              <Users className="h-5 w-5 text-cyan-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{company._count.contacts}</p>
              <p className="text-sm text-gray-500">Contacts</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-50 rounded-lg">
              <MapPinned className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{company._count.childRelationships}</p>
              <p className="text-sm text-gray-500">Locations</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                ${(company.currentBalance ?? 0).toLocaleString()}
              </p>
              <p className="text-sm text-gray-500">Balance</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="border-b border-gray-100">
          <nav className="flex gap-4 px-6">
            {[
              { id: 'overview', label: 'Overview', icon: Building2 },
              { id: 'contacts', label: 'Contacts', icon: Users },
              { id: 'locations', label: 'Locations', icon: MapPinned },
              { id: 'orders', label: 'Orders', icon: Package },
              { id: 'quotes', label: 'Quotes', icon: FileText },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 px-4 py-4 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Contact Info */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
                  <div className="space-y-3">
                    {primaryContact && (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <User className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="font-medium text-gray-900">
                            {primaryContact.firstName} {primaryContact.lastName}
                            <span className="ml-2 text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">
                              Primary
                            </span>
                          </p>
                          {primaryContact.title && (
                            <p className="text-sm text-gray-500">{primaryContact.title}</p>
                          )}
                        </div>
                      </div>
                    )}
                    {company.email && (
                      <a
                        href={`mailto:${company.email}`}
                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <Mail className="h-5 w-5 text-gray-400" />
                        <span className="text-gray-700">{company.email}</span>
                      </a>
                    )}
                    {company.phone && (
                      <a
                        href={`tel:${company.phone}`}
                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <Phone className="h-5 w-5 text-gray-400" />
                        <span className="text-gray-700">{company.phone}</span>
                      </a>
                    )}
                    {company.website && (
                      <a
                        href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <ExternalLink className="h-5 w-5 text-gray-400" />
                        <span className="text-gray-700">{company.website}</span>
                      </a>
                    )}
                    {company.address && (
                      <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                        <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                        <div className="text-gray-700">
                          <p>{company.address}</p>
                          <p>{[company.city, company.state, company.zipCode].filter(Boolean).join(', ')}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Financial Info */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Financial Details</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <CreditCard className="h-5 w-5 text-gray-400" />
                        <span className="text-gray-600">Payment Terms</span>
                      </div>
                      <span className="font-medium text-gray-900">{company.paymentTerms || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <DollarSign className="h-5 w-5 text-gray-400" />
                        <span className="text-gray-600">Credit Limit</span>
                      </div>
                      <span className="font-medium text-gray-900">
                        {company.creditLimit ? `$${company.creditLimit.toLocaleString()}` : 'N/A'}
                      </span>
                    </div>
                    {company.taxExempt && (
                      <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Shield className="h-5 w-5 text-green-600" />
                          <span className="text-green-700">Tax Exempt</span>
                        </div>
                        <span className="font-medium text-green-700">{company.taxExemptId || 'Yes'}</span>
                      </div>
                    )}
                    {company.isOnCreditHold && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-center gap-2 text-red-700 font-medium">
                          <X className="h-4 w-4" />
                          Credit Hold
                        </div>
                        {company.creditHoldReason && (
                          <p className="text-sm text-red-600 mt-1">{company.creditHoldReason}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Notes & Activity */}
              <div className="space-y-6">
                {company.notes && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Notes</h3>
                    <div className="p-4 bg-gray-50 rounded-lg text-gray-700 whitespace-pre-wrap">
                      {company.notes}
                    </div>
                  </div>
                )}

                {/* Recent Activity */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Orders</h3>
                  {company.workOrders.length > 0 ? (
                    <div className="space-y-2">
                      {company.workOrders.slice(0, 5).map((order) => (
                        <Link
                          key={order.id}
                          to={`/orders/${order.id}`}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <div>
                            <p className="font-medium text-gray-900">{order.orderNumber}</p>
                            <p className="text-sm text-gray-500 truncate max-w-xs">
                              {order.description}
                            </p>
                          </div>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-800'}`}>
                            {order.status.replace(/_/g, ' ')}
                          </span>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-8">No orders yet</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Contacts Tab */}
          {activeTab === 'contacts' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Contacts ({company.contacts.length})
                </h3>
                <button onClick={openCreateContactModal} className="btn-primary">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Contact
                </button>
              </div>
              {company.contacts.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {company.contacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="bg-gray-50 rounded-xl p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-primary-500 flex items-center justify-center text-white font-semibold">
                            {contact.firstName.charAt(0)}
                            {contact.lastName.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {contact.firstName} {contact.lastName}
                              {contact.isPrimary && (
                                <span className="ml-2 text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">
                                  Primary
                                </span>
                              )}
                            </p>
                            {contact.title && (
                              <p className="text-sm text-gray-500">{contact.title}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => openEditContactModal(contact)}
                            className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('Remove this contact?')) {
                                deleteContactMutation.mutate(contact.id);
                              }
                            }}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-3 space-y-1 text-sm text-gray-600">
                        {contact.email && (
                          <a href={`mailto:${contact.email}`} className="flex items-center gap-2 hover:text-primary-600">
                            <Mail className="h-4 w-4" />
                            {contact.email}
                          </a>
                        )}
                        {contact.phone && (
                          <a href={`tel:${contact.phone}`} className="flex items-center gap-2 hover:text-primary-600">
                            <Phone className="h-4 w-4" />
                            {contact.phone}
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No contacts yet</p>
                  <button onClick={openCreateContactModal} className="btn-secondary mt-4">
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Contact
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Locations Tab */}
          {activeTab === 'locations' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Locations ({company.childRelationships.length})
                </h3>
              </div>
              {company.childRelationships.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {company.childRelationships.map((rel) => (
                    <Link
                      key={rel.id}
                      to={`/companies/${rel.childCompany.id}`}
                      className="bg-gray-50 rounded-xl p-4 hover:shadow-md transition-shadow block"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <MapPinned className="h-5 w-5 text-orange-500" />
                        <span className="font-medium text-gray-900">{rel.childCompany.name}</span>
                      </div>
                      {(rel.childCompany.city || rel.childCompany.state) && (
                        <p className="text-sm text-gray-500 ml-8">
                          {[rel.childCompany.city, rel.childCompany.state].filter(Boolean).join(', ')}
                        </p>
                      )}
                      {rel.childCompany._count && (
                        <p className="text-sm text-gray-500 ml-8 mt-1">
                          {rel.childCompany._count.workOrders} orders
                        </p>
                      )}
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <MapPinned className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No linked locations</p>
                  <p className="text-sm mt-2">This company has no child locations or franchises</p>
                </div>
              )}
            </div>
          )}

          {/* Orders Tab */}
          {activeTab === 'orders' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Orders ({company._count.workOrders})
                </h3>
                <Link
                  to={`/orders/new?companyId=${company.id}`}
                  className="btn-primary"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Order
                </Link>
              </div>
              {company.workOrders.length > 0 ? (
                <div className="space-y-2">
                  {company.workOrders.map((order) => (
                    <Link
                      key={order.id}
                      to={`/orders/${order.id}`}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                          <Package className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{order.orderNumber}</p>
                          <p className="text-sm text-gray-500 truncate max-w-md">
                            {order.description}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {order.dueDate && (
                          <span className="text-sm text-gray-500">
                            Due: {format(new Date(order.dueDate), 'MMM d, yyyy')}
                          </span>
                        )}
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-800'}`}>
                          {order.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No orders yet</p>
                  <Link to={`/orders/new?companyId=${company.id}`} className="btn-secondary mt-4">
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Order
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Quotes Tab */}
          {activeTab === 'quotes' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Quotes ({company._count.quotes})
                </h3>
                <Link
                  to={`/sales/quotes/new?companyId=${company.id}`}
                  className="btn-primary"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Quote
                </Link>
              </div>
              {company.quotes.length > 0 ? (
                <div className="space-y-2">
                  {company.quotes.map((quote) => (
                    <Link
                      key={quote.id}
                      to={`/sales/quotes/${quote.id}`}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                          <FileText className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{quote.quoteNumber}</p>
                          <p className="text-sm text-gray-500 truncate max-w-md">
                            {quote.description || 'No description'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-medium text-gray-900">
                          ${parseFloat(quote.total).toLocaleString()}
                        </span>
                        <span className="text-sm text-gray-500">
                          {formatDistanceToNow(new Date(quote.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No quotes yet</p>
                  <Link to={`/sales/quotes/new?companyId=${company.id}`} className="btn-secondary mt-4">
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Quote
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Contact Modal */}
      {showContactModal && (
        <div className="modal-backdrop" onClick={closeContactModal}>
          <div className="modal-content max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-cyan-50 rounded-xl">
                  <User className="h-5 w-5 text-cyan-600" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {editingContact ? 'Edit Contact' : 'Add Contact'}
                </h2>
              </div>
              <button
                onClick={closeContactModal}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleContactSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-text">First Name *</label>
                  <input
                    type="text"
                    required
                    value={contactFormData.firstName}
                    onChange={(e) => setContactFormData({ ...contactFormData, firstName: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="label-text">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={contactFormData.lastName}
                    onChange={(e) => setContactFormData({ ...contactFormData, lastName: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-text">Email</label>
                  <input
                    type="email"
                    value={contactFormData.email}
                    onChange={(e) => setContactFormData({ ...contactFormData, email: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="label-text">Phone</label>
                  <input
                    type="tel"
                    value={contactFormData.phone}
                    onChange={(e) => setContactFormData({ ...contactFormData, phone: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-text">Title</label>
                  <input
                    type="text"
                    value={contactFormData.title}
                    onChange={(e) => setContactFormData({ ...contactFormData, title: e.target.value })}
                    className="input-field"
                    placeholder="e.g. Marketing Manager"
                  />
                </div>
                <div>
                  <label className="label-text">Role</label>
                  <input
                    type="text"
                    value={contactFormData.role}
                    onChange={(e) => setContactFormData({ ...contactFormData, role: e.target.value })}
                    className="input-field"
                    placeholder="e.g. Decision Maker"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isPrimary"
                  checked={contactFormData.isPrimary}
                  onChange={(e) => setContactFormData({ ...contactFormData, isPrimary: e.target.checked })}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="isPrimary" className="text-sm text-gray-700">
                  Primary Contact
                </label>
              </div>

              <div>
                <label className="label-text">Notes</label>
                <textarea
                  value={contactFormData.notes}
                  onChange={(e) => setContactFormData({ ...contactFormData, notes: e.target.value })}
                  className="textarea-field"
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={closeContactModal} className="btn-secondary">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createContactMutation.isPending || updateContactMutation.isPending}
                  className="btn-primary"
                >
                  {createContactMutation.isPending || updateContactMutation.isPending
                    ? 'Saving...'
                    : editingContact
                    ? 'Update Contact'
                    : 'Add Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
