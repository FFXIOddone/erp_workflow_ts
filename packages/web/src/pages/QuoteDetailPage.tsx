import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ChevronLeft,
  Edit,
  Send,
  CheckCircle,
  XCircle,
  ArrowRight,
  FileText,
  User,
  Calendar,
  Package,
  DollarSign,
  Clock,
  Printer,
} from 'lucide-react';
import { api } from '../lib/api';
import { QUOTE_STATUS_COLORS, QUOTE_STATUS_DISPLAY_NAMES } from '@erp/shared';

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  notes: string | null;
  itemMaster?: {
    itemNumber: string;
    description: string;
  };
}

interface Quote {
  id: string;
  quoteNumber: string;
  status: string;
  customerId: string;
  customerName: string;
  description: string | null;
  notes: string | null;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discountPercent: number;
  discountAmount: number;
  total: number;
  validUntil: string | null;
  sentAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  convertedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: { displayName: string };
  assignedTo?: { displayName: string };
  lineItems: LineItem[];
  customer?: {
    id: string;
    name: string;
    companyName: string | null;
    email: string | null;
    phone: string | null;
  };
}

export function QuoteDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: quote, isLoading } = useQuery({
    queryKey: ['quote', id],
    queryFn: async () => {
      const response = await api.get(`/quotes/${id}`);
      return response.data.data as Quote;
    },
    enabled: Boolean(id),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      await api.patch(`/quotes/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote', id] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast.success('Quote status updated');
    },
    onError: () => {
      toast.error('Failed to update status');
    },
  });

  const convertMutation = useMutation({
    mutationFn: async () => {
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
    }).format(Number(value));
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString();
  };

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-10 bg-gray-200 rounded w-1/3 mb-6" />
          <div className="bg-white rounded-xl p-6 space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4" />
            <div className="grid grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-10 bg-gray-200 rounded" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="text-center py-12">
        <FileText className="h-16 w-16 mx-auto text-gray-300 mb-4" />
        <h2 className="text-xl font-medium text-gray-900 mb-2">Quote not found</h2>
        <Link to="/sales/quotes" className="text-primary-600 hover:text-primary-700">
          Back to quotes
        </Link>
      </div>
    );
  }

  const canEdit = quote.status === 'DRAFT';
  const canSend = quote.status === 'DRAFT';
  const canApprove = quote.status === 'SENT';
  const canReject = quote.status === 'SENT';
  const canConvert = quote.status === 'APPROVED';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            to="/sales/quotes"
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
                {quote.quoteNumber}
              </h1>
              <span
                className="inline-flex px-3 py-1 text-sm font-medium rounded-full"
                style={{
                  backgroundColor: `${QUOTE_STATUS_COLORS[quote.status]}20`,
                  color: QUOTE_STATUS_COLORS[quote.status],
                }}
              >
                {QUOTE_STATUS_DISPLAY_NAMES[quote.status]}
              </span>
            </div>
            <p className="text-gray-500 mt-1">{quote.description || 'No description'}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="btn-secondary flex items-center gap-2"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
          
          {canEdit && (
            <Link
              to={`/sales/quotes/${id}/edit`}
              className="btn-secondary flex items-center gap-2"
            >
              <Edit className="h-4 w-4" />
              Edit
            </Link>
          )}
          
          {canSend && (
            <button
              onClick={() => updateStatusMutation.mutate('SENT')}
              disabled={updateStatusMutation.isPending}
              className="btn-primary flex items-center gap-2"
            >
              <Send className="h-4 w-4" />
              Mark as Sent
            </button>
          )}
          
          {canApprove && (
            <button
              onClick={() => updateStatusMutation.mutate('APPROVED')}
              disabled={updateStatusMutation.isPending}
              className="btn-primary flex items-center gap-2 bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="h-4 w-4" />
              Approve
            </button>
          )}
          
          {canReject && (
            <button
              onClick={() => updateStatusMutation.mutate('REJECTED')}
              disabled={updateStatusMutation.isPending}
              className="btn-secondary flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <XCircle className="h-4 w-4" />
              Reject
            </button>
          )}
          
          {canConvert && (
            <button
              onClick={() => {
                if (confirm('Convert this quote to a work order?')) {
                  convertMutation.mutate();
                }
              }}
              disabled={convertMutation.isPending}
              className="btn-primary flex items-center gap-2 bg-purple-600 hover:bg-purple-700"
            >
              <ArrowRight className="h-4 w-4" />
              Convert to Order
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Line Items */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Package className="h-5 w-5 text-gray-400" />
                Line Items ({quote.lineItems.length})
              </h2>
            </div>
            
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Item
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Qty
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unit Price
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {quote.lineItems.map((item) => (
                  <tr key={item.id}>
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{item.description}</p>
                      {item.itemMaster && (
                        <p className="text-sm text-gray-500">
                          {item.itemMaster.itemNumber}
                        </p>
                      )}
                      {item.notes && (
                        <p className="text-sm text-gray-400 italic mt-1">{item.notes}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-900">
                      {Number(item.quantity)}
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
                  <td colSpan={3} className="px-6 py-3 text-right text-sm text-gray-500">
                    Subtotal
                  </td>
                  <td className="px-6 py-3 text-right font-medium text-gray-900">
                    {formatCurrency(quote.subtotal)}
                  </td>
                </tr>
                {Number(quote.discountPercent) > 0 && (
                  <tr>
                    <td colSpan={3} className="px-6 py-2 text-right text-sm text-red-600">
                      Discount ({Number(quote.discountPercent)}%)
                    </td>
                    <td className="px-6 py-2 text-right text-red-600">
                      -{formatCurrency(quote.discountAmount)}
                    </td>
                  </tr>
                )}
                {Number(quote.taxRate) > 0 && (
                  <tr>
                    <td colSpan={3} className="px-6 py-2 text-right text-sm text-gray-500">
                      Tax ({Number(quote.taxRate)}%)
                    </td>
                    <td className="px-6 py-2 text-right text-gray-700">
                      {formatCurrency(quote.taxAmount)}
                    </td>
                  </tr>
                )}
                <tr className="border-t border-gray-200">
                  <td colSpan={3} className="px-6 py-4 text-right text-lg font-semibold text-gray-900">
                    Total
                  </td>
                  <td className="px-6 py-4 text-right text-xl font-bold text-primary-600">
                    {formatCurrency(quote.total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Notes */}
          {quote.notes && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Notes</h2>
              <p className="text-gray-600 whitespace-pre-wrap">{quote.notes}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Customer Info */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="h-5 w-5 text-gray-400" />
              Customer
            </h2>
            <div className="space-y-3">
              <p className="font-medium text-gray-900">{quote.customerName}</p>
              {quote.customer?.email && (
                <a
                  href={`mailto:${quote.customer.email}`}
                  className="block text-sm text-primary-600 hover:text-primary-700"
                >
                  {quote.customer.email}
                </a>
              )}
              {quote.customer?.phone && (
                <a
                  href={`tel:${quote.customer.phone}`}
                  className="block text-sm text-gray-600"
                >
                  {quote.customer.phone}
                </a>
              )}
              <Link
                to={`/sales/customers?selected=${quote.customerId}`}
                className="inline-flex text-sm text-primary-600 hover:text-primary-700"
              >
                View customer →
              </Link>
            </div>
          </div>

          {/* Quote Info */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5 text-gray-400" />
              Quote Details
            </h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Created</dt>
                <dd className="text-gray-900">{formatDate(quote.createdAt)}</dd>
              </div>
              {quote.createdBy && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Created By</dt>
                  <dd className="text-gray-900">{quote.createdBy.displayName}</dd>
                </div>
              )}
              {quote.assignedTo && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Assigned To</dt>
                  <dd className="text-gray-900">{quote.assignedTo.displayName}</dd>
                </div>
              )}
              {quote.validUntil && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Valid Until</dt>
                  <dd className="text-gray-900">{formatDate(quote.validUntil)}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-gray-400" />
              Timeline
            </h2>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 mt-2 rounded-full bg-blue-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Created</p>
                  <p className="text-xs text-gray-500">{formatDateTime(quote.createdAt)}</p>
                </div>
              </div>
              {quote.sentAt && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 mt-2 rounded-full bg-yellow-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Sent to Customer</p>
                    <p className="text-xs text-gray-500">{formatDateTime(quote.sentAt)}</p>
                  </div>
                </div>
              )}
              {quote.approvedAt && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 mt-2 rounded-full bg-green-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Approved</p>
                    <p className="text-xs text-gray-500">{formatDateTime(quote.approvedAt)}</p>
                  </div>
                </div>
              )}
              {quote.rejectedAt && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 mt-2 rounded-full bg-red-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Rejected</p>
                    <p className="text-xs text-gray-500">{formatDateTime(quote.rejectedAt)}</p>
                  </div>
                </div>
              )}
              {quote.convertedAt && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 mt-2 rounded-full bg-purple-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Converted to Order</p>
                    <p className="text-xs text-gray-500">{formatDateTime(quote.convertedAt)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Totals Summary */}
          <div className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl shadow-sm p-6 text-white">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="h-5 w-5 opacity-80" />
              <h2 className="text-lg font-semibold">Total</h2>
            </div>
            <p className="text-3xl font-bold">{formatCurrency(quote.total)}</p>
            <p className="text-sm opacity-80 mt-1">
              {quote.lineItems.length} item{quote.lineItems.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
