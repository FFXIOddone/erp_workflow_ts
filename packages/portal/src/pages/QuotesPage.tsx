import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  FileText,
  Search,
  ChevronRight,
  Clock,
  Send,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Filter,
  Plus,
  Calendar,
  DollarSign,
} from 'lucide-react';
import { quoteApi } from '@/lib/api';
import { formatDate, formatCurrency, cn } from '@/lib/utils';

const statusIcons: Record<string, typeof CheckCircle2> = {
  DRAFT: FileText,
  SENT: Send,
  APPROVED: CheckCircle2,
  REJECTED: XCircle,
  EXPIRED: AlertTriangle,
  CONVERTED: CheckCircle2,
};

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 border-gray-200',
  SENT: 'bg-blue-100 text-blue-700 border-blue-200',
  APPROVED: 'bg-green-100 text-green-700 border-green-200',
  REJECTED: 'bg-red-100 text-red-700 border-red-200',
  EXPIRED: 'bg-amber-100 text-amber-700 border-amber-200',
  CONVERTED: 'bg-purple-100 text-purple-700 border-purple-200',
};

const statusLabels: Record<string, string> = {
  DRAFT: 'Draft',
  SENT: 'Awaiting Approval',
  APPROVED: 'Approved',
  REJECTED: 'Declined',
  EXPIRED: 'Expired',
  CONVERTED: 'Converted to Order',
};

const statusFilters = [
  { value: '', label: 'All Quotes' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SENT', label: 'Awaiting Approval' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Declined' },
  { value: 'EXPIRED', label: 'Expired' },
];

export function QuotesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const status = searchParams.get('status') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);

  const { data, isLoading } = useQuery({
    queryKey: ['quotes', { status, page }],
    queryFn: () =>
      quoteApi.list({ status: status || undefined, page, pageSize: 10 }).then((r) => r.data.data),
  });

  const quotes = data?.quotes || [];
  const pagination = data?.pagination;

  const filteredQuotes = search
    ? quotes.filter(
        (quote: any) =>
          quote.quoteNumber.toLowerCase().includes(search.toLowerCase()) ||
          quote.description?.toLowerCase().includes(search.toLowerCase())
      )
    : quotes;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Quotes</h1>
          <p className="mt-1 text-gray-500">
            View and manage your quote requests
          </p>
        </div>
        <Link to="/hub/quote" className="btn-primary">
          <Plus className="w-4 h-4 mr-1" />
          New Quote
        </Link>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search quotes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={status}
              onChange={(e) => {
                const newParams = new URLSearchParams(searchParams);
                if (e.target.value) {
                  newParams.set('status', e.target.value);
                } else {
                  newParams.delete('status');
                }
                newParams.set('page', '1');
                setSearchParams(newParams);
              }}
              className="input py-2"
            >
              {statusFilters.map((filter) => (
                <option key={filter.value} value={filter.value}>
                  {filter.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Quotes List */}
      {isLoading ? (
        <div className="card p-8 text-center">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-gray-100 rounded-lg" />
            ))}
          </div>
        </div>
      ) : filteredQuotes.length === 0 ? (
        <div className="card p-12 text-center">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No quotes found</h3>
          <p className="text-gray-500 mb-4">
            {status ? 'Try a different filter or create a new quote' : "You haven't requested any quotes yet"}
          </p>
          <Link to="/hub/quote" className="btn-primary inline-flex">
            <Plus className="w-4 h-4 mr-1" />
            Request a Quote
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredQuotes.map((quote: any) => {
            const StatusIcon = statusIcons[quote.status] || FileText;
            const isActionable = quote.status === 'SENT';
            const isExpiringSoon =
              quote.status === 'SENT' &&
              quote.validUntil &&
              new Date(quote.validUntil) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

            return (
              <motion.div
                key={quote.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Link
                  to={`/quotes/${quote.id}`}
                  className={cn(
                    'card p-4 flex items-center gap-4 hover:shadow-md transition-shadow',
                    isActionable && 'ring-2 ring-primary-500 ring-offset-2'
                  )}
                >
                  {/* Status Icon */}
                  <div
                    className={cn(
                      'w-12 h-12 rounded-lg flex items-center justify-center',
                      statusColors[quote.status]?.replace('border-', 'bg-').split(' ')[0] || 'bg-gray-100'
                    )}
                  >
                    <StatusIcon className="w-6 h-6" />
                  </div>

                  {/* Quote Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{quote.quoteNumber}</h3>
                      <span
                        className={cn(
                          'px-2 py-0.5 text-xs font-medium rounded-full border',
                          statusColors[quote.status]
                        )}
                      >
                        {statusLabels[quote.status] || quote.status}
                      </span>
                      {isExpiringSoon && (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                          Expiring Soon
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 truncate mt-1">
                      {quote.description || `${quote.lineItems?.length || 0} item(s)`}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(quote.createdAt)}
                      </span>
                      {quote.validUntil && quote.status === 'SENT' && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Valid until {formatDate(quote.validUntil)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Price & Arrow */}
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-lg font-bold text-gray-900">
                      <DollarSign className="w-5 h-5 text-gray-400" />
                      {formatCurrency(Number(quote.total)).replace('$', '')}
                    </div>
                    <p className="text-xs text-gray-500">
                      {quote.lineItems?.length || 0} item(s)
                    </p>
                  </div>

                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            onClick={() => {
              const newParams = new URLSearchParams(searchParams);
              newParams.set('page', String(Math.max(1, page - 1)));
              setSearchParams(newParams);
            }}
            disabled={page === 1}
            className="btn-secondary disabled:opacity-50"
          >
            Previous
          </button>
          <span className="flex items-center px-4 text-sm text-gray-600">
            Page {page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => {
              const newParams = new URLSearchParams(searchParams);
              newParams.set('page', String(Math.min(pagination.totalPages, page + 1)));
              setSearchParams(newParams);
            }}
            disabled={page === pagination.totalPages}
            className="btn-secondary disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
