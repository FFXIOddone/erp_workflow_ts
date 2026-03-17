import { Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  FileText,
  Send,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Calendar,
  Clock,
  Download,
  MessageSquare,
  Package,
  Loader2,
  ThumbsUp,
  ThumbsDown,
  ExternalLink,
} from 'lucide-react';
import { quoteApi } from '@/lib/api';
import { formatDate, formatCurrency, cn } from '@/lib/utils';
import { useState } from 'react';

const statusConfig: Record<string, { icon: any; color: string; label: string }> = {
  DRAFT: { icon: FileText, color: 'text-gray-600 bg-gray-100', label: 'Draft' },
  SENT: { icon: Send, color: 'text-blue-600 bg-blue-100', label: 'Awaiting Your Approval' },
  APPROVED: { icon: CheckCircle2, color: 'text-green-600 bg-green-100', label: 'Approved' },
  REJECTED: { icon: XCircle, color: 'text-red-600 bg-red-100', label: 'Declined' },
  EXPIRED: { icon: AlertTriangle, color: 'text-amber-600 bg-amber-100', label: 'Expired' },
  CONVERTED: { icon: Package, color: 'text-purple-600 bg-purple-100', label: 'Converted to Order' },
};

export function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [approvalResult, setApprovalResult] = useState<{ orderId: string; orderNumber: string } | null>(null);

  const { data: quote, isLoading, error } = useQuery({
    queryKey: ['quote', id],
    queryFn: () => quoteApi.get(id!).then((r) => r.data.data),
    enabled: !!id,
  });

  const approveMutation = useMutation({
    mutationFn: () => quoteApi.approve(id!),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['quote', id] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      // Store approval result to show success message with order link
      if (response.data?.data?.orderId) {
        setApprovalResult({
          orderId: response.data.data.orderId,
          orderNumber: response.data.data.orderNumber,
        });
      }
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => quoteApi.reject(id!, rejectReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote', id] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      setShowRejectModal(false);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Quote not found</h2>
        <p className="text-gray-500 mb-4">This quote may have been deleted or you don't have access.</p>
        <Link to="/quotes" className="btn-primary">
          View All Quotes
        </Link>
      </div>
    );
  }

  const status = statusConfig[quote.status] || statusConfig.DRAFT;
  const StatusIcon = status.icon;
  const isActionable = quote.status === 'SENT';
  const isExpired = quote.validUntil && new Date(quote.validUntil) < new Date();
  const isExpiringSoon =
    quote.status === 'SENT' &&
    quote.validUntil &&
    new Date(quote.validUntil) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          to="/quotes"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Quotes
        </Link>
        
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{quote.quoteNumber}</h1>
              <span className={cn('px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1', status.color)}>
                <StatusIcon className="w-4 h-4" />
                {status.label}
              </span>
            </div>
            <p className="mt-1 text-gray-500">{quote.description}</p>
          </div>
          
          {/* Actions for actionable quotes */}
          {isActionable && !isExpired && (
            <div className="flex gap-3">
              <button
                onClick={() => setShowRejectModal(true)}
                className="btn-secondary text-red-600 hover:bg-red-50"
              >
                <ThumbsDown className="w-4 h-4 mr-1" />
                Decline
              </button>
              <button
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
                className="btn-primary bg-green-600 hover:bg-green-700"
              >
                {approveMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <ThumbsUp className="w-4 h-4 mr-1" />
                )}
                Approve Quote
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Approval Success Message with Order Link */}
      {approvalResult && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <div>
              <p className="font-medium text-green-800">Quote approved successfully!</p>
              <p className="text-sm text-green-700">
                Order #{approvalResult.orderNumber} has been created and is ready for production.
              </p>
            </div>
          </div>
          <Link
            to={`/orders/${approvalResult.orderId}`}
            className="btn-primary bg-green-600 hover:bg-green-700 flex items-center gap-1"
          >
            View Order
            <ExternalLink className="w-4 h-4" />
          </Link>
        </motion.div>
      )}

      {/* Expiry Warning */}
      {isActionable && isExpiringSoon && !isExpired && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3"
        >
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          <div>
            <p className="font-medium text-amber-800">This quote expires soon</p>
            <p className="text-sm text-amber-700">
              Valid until {formatDate(quote.validUntil)}. Approve now to lock in this pricing.
            </p>
          </div>
        </motion.div>
      )}

      {/* Expired Warning */}
      {isExpired && quote.status === 'SENT' && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3"
        >
          <XCircle className="w-5 h-5 text-red-600" />
          <div>
            <p className="font-medium text-red-800">This quote has expired</p>
            <p className="text-sm text-red-700">
              Please request a new quote for current pricing.
            </p>
          </div>
          <Link to="/hub/quote" className="btn-primary ml-auto">
            Request New Quote
          </Link>
        </motion.div>
      )}

      {/* Converted to Order Info */}
      {quote.status === 'APPROVED' && quote.convertedOrderId && !approvalResult && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-purple-50 border border-purple-200 rounded-lg p-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <Package className="w-5 h-5 text-purple-600" />
            <div>
              <p className="font-medium text-purple-800">This quote has been converted to an order</p>
              <p className="text-sm text-purple-700">
                View your order to track production progress.
              </p>
            </div>
          </div>
          <Link
            to={`/orders/${quote.convertedOrderId}`}
            className="btn-primary bg-purple-600 hover:bg-purple-700 flex items-center gap-1"
          >
            View Order
            <ExternalLink className="w-4 h-4" />
          </Link>
        </motion.div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Quote Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Line Items */}
          <div className="card">
            <div className="p-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Quote Items</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {quote.lineItems?.map((item: any, index: number) => (
                <div key={item.id} className="p-4 flex items-start gap-4">
                  <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 font-bold text-sm flex-shrink-0">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">{item.description}</p>
                    {item.notes && (
                      <p className="text-sm text-gray-500 mt-1">{item.notes}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm text-gray-500">
                      {item.quantity} × {formatCurrency(Number(item.unitPrice))}
                    </p>
                    <p className="font-semibold text-gray-900">
                      {formatCurrency(Number(item.totalPrice))}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="p-4 bg-gray-50 border-t border-gray-200">
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium">{formatCurrency(Number(quote.subtotal))}</span>
              </div>
              {Number(quote.discountAmount) > 0 && (
                <div className="flex justify-between mb-2 text-green-600">
                  <span>Discount ({quote.discountPercent}%)</span>
                  <span>-{formatCurrency(Number(quote.discountAmount))}</span>
                </div>
              )}
              {Number(quote.taxAmount) > 0 && (
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">Tax</span>
                  <span>{formatCurrency(Number(quote.taxAmount))}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-gray-300">
                <span className="font-semibold text-gray-900">Total</span>
                <span className="text-xl font-bold text-primary-600">
                  {formatCurrency(Number(quote.total))}
                </span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {quote.notes && (
            <div className="card p-4">
              <h3 className="font-semibold text-gray-900 mb-2">Notes</h3>
              <p className="text-gray-600 whitespace-pre-wrap">{quote.notes}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          {/* Quote Info Card */}
          <div className="card p-4">
            <h3 className="font-semibold text-gray-900 mb-4">Quote Details</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-gray-500">Created</p>
                  <p className="font-medium text-gray-900">{formatDate(quote.createdAt)}</p>
                </div>
              </div>
              {quote.validUntil && (
                <div className="flex items-center gap-3 text-sm">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-gray-500">Valid Until</p>
                    <p className={cn('font-medium', isExpired ? 'text-red-600' : 'text-gray-900')}>
                      {formatDate(quote.validUntil)}
                      {isExpired && ' (Expired)'}
                    </p>
                  </div>
                </div>
              )}
              {quote.approvedAt && (
                <div className="flex items-center gap-3 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <div>
                    <p className="text-gray-500">Approved</p>
                    <p className="font-medium text-gray-900">{formatDate(quote.approvedAt)}</p>
                  </div>
                </div>
              )}
              {quote.convertedOrderId && (
                <Link
                  to={`/orders/${quote.convertedOrderId}`}
                  className="flex items-center gap-3 text-sm text-primary-600 hover:text-primary-700"
                >
                  <Package className="w-4 h-4" />
                  <span className="font-medium">View Order →</span>
                </Link>
              )}
            </div>
          </div>

          {/* Actions Card */}
          <div className="card p-4">
            <h3 className="font-semibold text-gray-900 mb-4">Actions</h3>
            <div className="space-y-2">
              <button
                onClick={() => {
                  // Open the quote PDF in a new tab - the server will generate it
                  window.open(`${import.meta.env.VITE_API_URL || ''}/api/portal/quotes/${id}/pdf`, '_blank');
                }}
                className="btn-secondary w-full justify-center"
              >
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </button>
              <Link to="/messages" className="btn-secondary w-full justify-center">
                <MessageSquare className="w-4 h-4 mr-2" />
                Contact Us
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl p-6 max-w-md w-full mx-4"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Decline Quote</h3>
            <p className="text-gray-600 mb-4">
              Let us know why so we can better serve you in the future.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Optional: Tell us why you're declining..."
              rows={4}
              className="input mb-4"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowRejectModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => rejectMutation.mutate()}
                disabled={rejectMutation.isPending}
                className="btn-primary bg-red-600 hover:bg-red-700"
              >
                {rejectMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : null}
                Decline Quote
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
