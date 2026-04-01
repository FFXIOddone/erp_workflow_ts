import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  FileText,
  Plus,
  Search,
  Filter,
  ChevronLeft,
  MoreHorizontal,
  Send,
  CheckCircle,
  XCircle,
  ArrowRight,
  Eye,
  Edit,
  Trash2,
  Calendar,
  User,
} from 'lucide-react';
import { api } from '../lib/api';
import { QUOTE_STATUS_COLORS, QUOTE_STATUS_DISPLAY_NAMES } from '@erp/shared';

interface Quote {
  id: string;
  quoteNumber: string;
  status: string;
  customerName: string;
  description: string | null;
  total: number;
  validUntil: string | null;
  createdAt: string;
  createdBy?: { displayName: string };
  assignedTo?: { displayName: string };
  lineItems: Array<{ id: string }>;
}

export function QuotesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  
  // Read initial status from URL params
  const initialStatus = searchParams.get('status') || '';
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);

  // Sync URL params with state
  useEffect(() => {
    const urlStatus = searchParams.get('status') || '';
    if (urlStatus !== statusFilter) {
      setStatusFilter(urlStatus);
    }
  }, [searchParams]);

  // Update URL when status filter changes
  const handleStatusChange = (newStatus: string) => {
    setStatusFilter(newStatus);
    if (newStatus) {
      setSearchParams({ status: newStatus });
    } else {
      setSearchParams({});
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ['quotes', search, statusFilter],
    queryFn: async () => {
      const params: Record<string, unknown> = { pageSize: 100 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const response = await api.get('/quotes', { params });
      return response.data.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/quotes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast.success('Quote deleted');
    },
    onError: () => {
      toast.error('Failed to delete quote');
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await api.patch(`/quotes/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast.success('Quote status updated');
    },
    onError: () => {
      toast.error('Failed to update status');
    },
  });

  const convertMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post(`/quotes/${id}/convert`);
      return response.data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success(`Created work order ${data.orderNumber}`);
      navigate(`/orders/${data.id}`);
    },
    onError: () => {
      toast.error('Failed to convert quote');
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString();
  };

  const quotes = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            to="/sales"
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Quotes</h1>
            <p className="text-gray-500 mt-1">Create and manage customer quotes</p>
          </div>
        </div>
        <Link
          to="/sales/quotes/new"
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          New Quote
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search quotes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="select-field w-auto"
          >
            <option value="">All Statuses</option>
            {Object.entries(QUOTE_STATUS_DISPLAY_NAMES).map(([value, label]) => (
              <option key={value} value={value}>{label as string}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Quotes Table */}
      {isLoading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="animate-pulse p-6 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded" />
            ))}
          </div>
        </div>
      ) : quotes.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <FileText className="h-16 w-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No quotes yet</h3>
          <p className="text-gray-500 mb-4">Get started by creating your first quote</p>
          <Link to="/sales/quotes/new" className="btn-primary inline-flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create Quote
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quote
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {quotes.map((quote: Quote) => (
                <tr key={quote.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link
                      to={`/sales/quotes/${quote.id}`}
                      className="font-medium text-primary-600 hover:text-primary-700"
                    >
                      {quote.quoteNumber}
                    </Link>
                    {quote.description && (
                      <p className="text-sm text-gray-500 truncate max-w-xs">
                        {quote.description}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <p className="font-medium text-gray-900">{quote.customerName}</p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className="inline-flex px-2.5 py-1 text-xs font-medium rounded-full"
                      style={{
                        backgroundColor: `${QUOTE_STATUS_COLORS[quote.status]}20`,
                        color: QUOTE_STATUS_COLORS[quote.status],
                      }}
                    >
                      {QUOTE_STATUS_DISPLAY_NAMES[quote.status]}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                    {formatCurrency(Number(quote.total))}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {formatDate(quote.createdAt)}
                    </div>
                    {quote.createdBy && (
                      <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                        <User className="h-3 w-3" />
                        {quote.createdBy.displayName}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        to={`/sales/quotes/${quote.id}`}
                        className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                        title="View"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                      {quote.status === 'DRAFT' && (
                        <>
                          <Link
                            to={`/sales/quotes/${quote.id}/edit`}
                            className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </Link>
                          <button
                            onClick={() => updateStatusMutation.mutate({ id: quote.id, status: 'SENT' })}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Mark as Sent"
                          >
                            <Send className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('Delete this quote?')) {
                                deleteMutation.mutate(quote.id);
                              }
                            }}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      {quote.status === 'SENT' && (
                        <>
                          <button
                            onClick={() => updateStatusMutation.mutate({ id: quote.id, status: 'APPROVED' })}
                            className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Approve"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => updateStatusMutation.mutate({ id: quote.id, status: 'REJECTED' })}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Reject"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      {quote.status === 'APPROVED' && (
                        <button
                          onClick={() => {
                            if (confirm('Convert this quote to a work order?')) {
                              convertMutation.mutate(quote.id);
                            }
                          }}
                          disabled={convertMutation.isPending}
                          className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                          title="Convert to Work Order"
                        >
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
