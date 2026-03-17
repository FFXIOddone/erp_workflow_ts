import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Building2,
  Plus,
  Search,
  Mail,
  Phone,
  MapPin,
  Edit,
  Trash2,
  FileText,
  X,
  Users,
  MapPinned,
  Filter,
} from 'lucide-react';
import { api } from '../lib/api';
import { Pagination } from '../components/Pagination';
import { useDebounce } from '../hooks/useDebounce';

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
}

interface Company {
  id: string;
  name: string;
  legalName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  notes: string | null;
  taxExempt: boolean;
  paymentTerms: string | null;
  salesRep: string | null;
  companyType: string | null;
  isActive: boolean;
  contacts: Contact[];
  _count?: {
    quotes: number;
    workOrders: number;
    contacts: number;
    childRelationships: number;
  };
}

interface CompanyFormData {
  name: string;
  legalName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  notes: string;
  taxExempt: boolean;
  paymentTerms: string;
  companyType: string;
  salesRep: string;
}

const initialFormData: CompanyFormData = {
  name: '',
  legalName: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  zipCode: '',
  notes: '',
  taxExempt: false,
  paymentTerms: 'Net 30',
  companyType: '',
  salesRep: '',
};

const PAGE_SIZE = 24;

export function CompaniesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [formData, setFormData] = useState<CompanyFormData>(initialFormData);
  const [showParentsOnly, setShowParentsOnly] = useState(false);
  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading } = useQuery({
    queryKey: ['companies', debouncedSearch, page, showParentsOnly],
    queryFn: async () => {
      const params: Record<string, unknown> = {
        search: debouncedSearch,
        page,
        pageSize: PAGE_SIZE,
      };
      if (showParentsOnly) {
        params.hasChildren = true;
      }
      const response = await api.get('/companies', { params });
      return response.data.data;
    },
  });

  const companies = data?.items || [];

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const createMutation = useMutation({
    mutationFn: async (data: CompanyFormData) => {
      const response = await api.post('/companies', data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      toast.success('Company created successfully');
      closeModal();
    },
    onError: () => {
      toast.error('Failed to create company');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CompanyFormData> }) => {
      const response = await api.patch(`/companies/${id}`, data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      toast.success('Company updated successfully');
      closeModal();
    },
    onError: () => {
      toast.error('Failed to update company');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/companies/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      toast.success('Company deleted');
    },
    onError: (error: Error & { response?: { data?: { error?: string } } }) => {
      toast.error(error.response?.data?.error || 'Failed to delete company');
    },
  });

  const openCreateModal = () => {
    setEditingCompany(null);
    setFormData(initialFormData);
    setShowModal(true);
  };

  const openEditModal = (company: Company) => {
    setEditingCompany(company);
    setFormData({
      name: company.name,
      legalName: company.legalName || '',
      email: company.email || '',
      phone: company.phone || '',
      address: company.address || '',
      city: company.city || '',
      state: company.state || '',
      zipCode: company.zipCode || '',
      notes: company.notes || '',
      taxExempt: company.taxExempt,
      paymentTerms: company.paymentTerms || 'Net 30',
      companyType: company.companyType || '',
      salesRep: company.salesRep || '',
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCompany(null);
    setFormData(initialFormData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCompany) {
      updateMutation.mutate({ id: editingCompany.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-primary-500 to-cyan-500 rounded-2xl shadow-lg">
            <Building2 className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Companies</h1>
            <p className="text-gray-500 mt-1">Manage your business relationships</p>
          </div>
        </div>
        <button
          onClick={openCreateModal}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Company
        </button>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search companies..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          <button
            onClick={() => setShowParentsOnly(!showParentsOnly)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
              showParentsOnly
                ? 'bg-primary-50 border-primary-200 text-primary-700'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Filter className="h-4 w-4" />
            Parent Companies Only
          </button>
        </div>
      </div>

      {/* Companies Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 animate-pulse">
              <div className="h-6 w-32 bg-gray-200 rounded" />
              <div className="h-4 w-48 bg-gray-200 rounded mt-2" />
              <div className="h-4 w-40 bg-gray-200 rounded mt-4" />
            </div>
          ))}
        </div>
      ) : companies.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <Building2 className="h-16 w-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No companies yet</h3>
          <p className="text-gray-500 mb-4">Get started by adding your first company</p>
          <button onClick={openCreateModal} className="btn-primary">
            <Plus className="h-4 w-4 mr-2" />
            Add Company
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {companies.map((company: Company) => (
            <Link
              to={`/companies/${company.id}`}
              key={company.id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow block"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-cyan-500 flex items-center justify-center text-white font-semibold text-lg">
                    {company.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{company.name}</h3>
                    {company.contacts[0] && (
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {company.contacts[0].firstName} {company.contacts[0].lastName}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); openEditModal(company); }}
                    className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (confirm('Are you sure you want to delete this company?')) {
                        deleteMutation.mutate(company.id);
                      }
                    }}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-4 space-y-2 text-sm text-gray-600">
                {company.email && (
                  <p className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-gray-400" />
                    <span
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.location.href = `mailto:${company.email}`; }}
                      className="hover:text-primary-600 cursor-pointer truncate"
                    >
                      {company.email}
                    </span>
                  </p>
                )}
                {company.phone && (
                  <p className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <span
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.location.href = `tel:${company.phone}`; }}
                      className="hover:text-primary-600 cursor-pointer"
                    >
                      {company.phone}
                    </span>
                  </p>
                )}
                {(company.city || company.state) && (
                  <p className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    {[company.city, company.state].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  {company.salesRep && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 rounded">
                      {company.salesRep}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <FileText className="h-4 w-4" />
                    {company._count?.workOrders ?? 0} orders
                  </span>
                  {(company._count?.childRelationships ?? 0) > 0 && (
                    <span className="flex items-center gap-1">
                      <MapPinned className="h-4 w-4" />
                      {company._count?.childRelationships} locations
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {company.paymentTerms && (
                    <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
                      {company.paymentTerms}
                    </span>
                  )}
                  {company.taxExempt && (
                    <span className="px-2 py-1 text-xs font-medium bg-green-50 text-green-700 rounded-full">
                      Tax Exempt
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="mt-6">
          <Pagination
            currentPage={page}
            totalPages={data.totalPages}
            totalItems={data.total}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* Company Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal-content max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-50 rounded-xl">
                  <Building2 className="h-5 w-5 text-primary-600" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {editingCompany ? 'Edit Company' : 'New Company'}
                </h2>
              </div>
              <button
                onClick={closeModal}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label-text">Company Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input-field"
                    placeholder="Acme Corporation"
                  />
                </div>
                <div>
                  <label className="label-text">Legal Name</label>
                  <input
                    type="text"
                    value={formData.legalName}
                    onChange={(e) => setFormData({ ...formData, legalName: e.target.value })}
                    className="input-field"
                    placeholder="Acme Corporation, Inc."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label-text">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="input-field"
                    placeholder="info@acme.com"
                  />
                </div>
                <div>
                  <label className="label-text">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="input-field"
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>

              <div>
                <label className="label-text">Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="input-field"
                  placeholder="123 Main St"
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="col-span-2">
                  <label className="label-text">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="label-text">State</label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="label-text">ZIP Code</label>
                  <input
                    type="text"
                    value={formData.zipCode}
                    onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="label-text">Company Type</label>
                  <input
                    type="text"
                    value={formData.companyType}
                    onChange={(e) => setFormData({ ...formData, companyType: e.target.value })}
                    className="input-field"
                    placeholder="Corporate, Franchise, etc."
                  />
                </div>
                <div>
                  <label className="label-text">Sales Rep</label>
                  <input
                    type="text"
                    value={formData.salesRep}
                    onChange={(e) => setFormData({ ...formData, salesRep: e.target.value })}
                    className="input-field"
                    placeholder="JS, AE, etc."
                  />
                </div>
                <div>
                  <label className="label-text">Payment Terms</label>
                  <select
                    value={formData.paymentTerms}
                    onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                    className="select-field"
                  >
                    <option value="COD">COD</option>
                    <option value="Net 15">Net 15</option>
                    <option value="Net 30">Net 30</option>
                    <option value="Net 45">Net 45</option>
                    <option value="Net 60">Net 60</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="taxExempt"
                    checked={formData.taxExempt}
                    onChange={(e) => setFormData({ ...formData, taxExempt: e.target.checked })}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label htmlFor="taxExempt" className="text-sm text-gray-700">
                    Tax Exempt
                  </label>
                </div>
              </div>

              <div>
                <label className="label-text">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="textarea-field"
                  rows={3}
                  placeholder="Any additional notes about this company..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="btn-primary"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving...'
                    : editingCompany
                    ? 'Update Company'
                    : 'Create Company'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
