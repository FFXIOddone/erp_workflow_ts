import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  CreditCard,
  Calendar,
  FileText,
  AlertCircle,
  CheckCircle2,
  Clock,
  TrendingUp,
  Filter,
  ChevronLeft,
  ChevronRight,
  WalletCards,
  Ban,
} from 'lucide-react';
import { paymentApi } from '@/lib/api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';

interface Payment {
  id: string;
  refNumber: string | null;
  date: string;
  amount: number;
  paymentMethod: string | null;
  memo: string | null;
  appliedTo: Array<{
    invoiceRef: string | null;
    appliedAmount: number;
  }>;
}

interface PaymentSummary {
  qbConnected: boolean;
  totalPaid: number;
  totalOutstanding: number;
  invoiceCount: number;
  paidInvoices: number;
  unpaidInvoices: number;
}

export function PaymentsPage() {
  const [page, setPage] = useState(1);
  const [dateFilter, setDateFilter] = useState<'all' | '30' | '90' | '365'>('all');

  // Calculate date range based on filter
  const getDateRange = () => {
    if (dateFilter === 'all') return {};
    const toDate = new Date().toISOString().split('T')[0];
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - parseInt(dateFilter, 10));
    return { fromDate: fromDate.toISOString().split('T')[0], toDate };
  };

  const { data: paymentsData, isLoading: loadingPayments } = useQuery({
    queryKey: ['payments', page, dateFilter],
    queryFn: () => paymentApi.list({ page, pageSize: 10, ...getDateRange() }).then(r => r.data.data),
  });

  const { data: summaryData, isLoading: loadingSummary } = useQuery({
    queryKey: ['payments-summary'],
    queryFn: () => paymentApi.getSummary().then(r => r.data.data),
  });

  const payments: Payment[] = paymentsData?.payments || [];
  const pagination = paymentsData?.pagination;
  const qbConnected = paymentsData?.qbConnected ?? false;
  const summary: PaymentSummary | undefined = summaryData;

  const filterOptions = [
    { value: 'all', label: 'All Time' },
    { value: '30', label: 'Last 30 Days' },
    { value: '90', label: 'Last 90 Days' },
    { value: '365', label: 'Last Year' },
  ];

  if (!qbConnected && !loadingPayments) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payment History</h1>
          <p className="mt-1 text-gray-500">View your payment history and outstanding balances</p>
        </div>

        {/* Not Connected Message */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-8 text-center"
        >
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Ban className="w-8 h-8 text-amber-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Payment History Unavailable
          </h2>
          <p className="text-gray-600 max-w-md mx-auto">
            {paymentsData?.message || 'Payment history from QuickBooks is not currently available. Please contact us if you have questions about your account.'}
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Payment History</h1>
        <p className="mt-1 text-gray-500">View your payment history and outstanding balances</p>
      </div>

      {/* Summary Cards */}
      {loadingSummary ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
              <div className="h-8 bg-gray-200 rounded w-32" />
            </div>
          ))}
        </div>
      ) : summary?.qbConnected ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card p-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Paid</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(summary.totalPaid)}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card p-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Outstanding</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(summary.totalOutstanding)}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="card p-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Paid Invoices</p>
                <p className="text-xl font-bold text-gray-900">{summary.paidInvoices}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="card p-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Open Invoices</p>
                <p className="text-xl font-bold text-gray-900">{summary.unpaidInvoices}</p>
              </div>
            </div>
          </motion.div>
        </div>
      ) : null}

      {/* Filters */}
      <div className="card p-4">
        <div className="flex items-center gap-4">
          <Filter className="w-5 h-5 text-gray-400" />
          <span className="text-sm text-gray-600">Filter by:</span>
          <div className="flex gap-2">
            {filterOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  setDateFilter(option.value as typeof dateFilter);
                  setPage(1);
                }}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  dateFilter === option.value
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Payments List */}
      {loadingPayments ? (
        <div className="card divide-y divide-gray-100">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="p-4 animate-pulse">
              <div className="flex justify-between">
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-32" />
                  <div className="h-3 bg-gray-200 rounded w-24" />
                </div>
                <div className="h-6 bg-gray-200 rounded w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : payments.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-8 text-center"
        >
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <WalletCards className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Payments Found</h3>
          <p className="text-gray-500">
            {dateFilter === 'all'
              ? 'No payment records found for your account.'
              : `No payments found in the selected time period.`}
          </p>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card divide-y divide-gray-100"
        >
          {payments.map((payment, index) => (
            <motion.div
              key={payment.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {payment.refNumber || `Payment #${payment.id.slice(-6)}`}
                      </span>
                      {payment.paymentMethod && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                          {payment.paymentMethod}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(payment.date)}
                      </span>
                      {payment.appliedTo.length > 0 && (
                        <span className="flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5" />
                          Applied to {payment.appliedTo.length} invoice{payment.appliedTo.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    {payment.memo && (
                      <p className="text-sm text-gray-500 mt-1 italic">{payment.memo}</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-lg font-semibold text-green-600">
                    {formatCurrency(payment.amount)}
                  </span>
                </div>
              </div>

              {/* Applied to invoices */}
              {payment.appliedTo.length > 0 && (
                <div className="mt-3 ml-14 flex flex-wrap gap-2">
                  {payment.appliedTo.map((inv, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 bg-gray-50 border border-gray-200 rounded text-xs text-gray-600"
                    >
                      {inv.invoiceRef || 'Invoice'}: {formatCurrency(inv.appliedAmount)}
                    </span>
                  ))}
                </div>
              )}
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {(page - 1) * 10 + 1} to {Math.min(page * 10, pagination.total)} of{' '}
            {pagination.total} payments
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-secondary disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page === pagination.totalPages}
              className="btn-secondary disabled:opacity-50"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* QuickBooks Notice */}
      <div className="flex items-center gap-2 text-xs text-gray-400 justify-center">
        <AlertCircle className="w-3.5 h-3.5" />
        <span>Payment data synced from QuickBooks</span>
      </div>
    </div>
  );
}
