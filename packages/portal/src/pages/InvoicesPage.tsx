import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronRight,
  Calendar,
  Package,
} from 'lucide-react';
import { ordersApi } from '@/lib/api';
import { formatDate, formatCurrency, cn } from '@/lib/utils';

// Derive invoice status from order status
function getInvoiceStatus(orderStatus: string): { label: string; color: string; icon: typeof CheckCircle2 } {
  switch (orderStatus) {
    case 'SHIPPED':
    case 'COMPLETED':
      return { label: 'Invoiced', color: 'bg-green-100 text-green-700', icon: CheckCircle2 };
    case 'IN_PROGRESS':
      return { label: 'Pending', color: 'bg-amber-100 text-amber-700', icon: Clock };
    case 'ON_HOLD':
      return { label: 'On Hold', color: 'bg-orange-100 text-orange-700', icon: AlertCircle };
    default:
      return { label: 'Draft', color: 'bg-gray-100 text-gray-600', icon: FileText };
  }
}

interface Invoice {
  id: string;
  orderNumber: string;
  description: string;
  status: string;
  createdAt: string;
  dueDate?: string;
  total: number;
  lineItems: Array<{
    id: string;
    itemNumber: number;
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
}

export function InvoicesPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Fetch all orders and treat them as invoices
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['portal-invoices'],
    queryFn: () => ordersApi.list({ pageSize: 100 }).then((r) => r.data.data.orders),
  });

  // Calculate totals for each order and transform to invoice format
  const invoices: Invoice[] = orders.map((order: any) => {
    const total = order.lineItems?.reduce(
      (sum: number, li: any) => sum + Number(li.quantity) * Number(li.unitPrice),
      0
    ) || order.total || 0;

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      description: order.description,
      status: order.status,
      createdAt: order.createdAt,
      dueDate: order.dueDate,
      total,
      lineItems: order.lineItems || [],
    };
  });

  // Filter invoices
  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch =
      invoice.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      invoice.description.toLowerCase().includes(search.toLowerCase());

    const invoiceStatus = getInvoiceStatus(invoice.status);
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'invoiced' && invoiceStatus.label === 'Invoiced') ||
      (statusFilter === 'pending' && invoiceStatus.label === 'Pending') ||
      (statusFilter === 'draft' && invoiceStatus.label === 'Draft');

    return matchesSearch && matchesStatus;
  });

  // Calculate summary stats
  const totalInvoiced = invoices
    .filter((i) => getInvoiceStatus(i.status).label === 'Invoiced')
    .reduce((sum, i) => sum + i.total, 0);

  const totalPending = invoices
    .filter((i) => getInvoiceStatus(i.status).label === 'Pending')
    .reduce((sum, i) => sum + i.total, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">Loading invoices...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Invoices & Billing</h1>
        <p className="mt-1 text-gray-500">View your invoices and billing history</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl border border-gray-200 p-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Invoiced</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(totalInvoiced)}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl border border-gray-200 p-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Pending</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(totalPending)}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-xl border border-gray-200 p-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Orders</p>
              <p className="text-xl font-bold text-gray-900">{invoices.length}</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search invoices..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="all">All Invoices</option>
            <option value="invoiced">Invoiced</option>
            <option value="pending">Pending</option>
            <option value="draft">Draft</option>
          </select>
        </div>
      </div>

      {/* Invoices List */}
      {filteredInvoices.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900">No invoices found</h3>
          <p className="text-gray-500 mt-1">
            {search || statusFilter !== 'all'
              ? 'Try adjusting your filters'
              : "You don't have any invoices yet"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filteredInvoices.map((invoice, index) => {
              const invoiceStatus = getInvoiceStatus(invoice.status);
              const StatusIcon = invoiceStatus.icon;

              return (
                <motion.div
                  key={invoice.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Link
                    to={`/invoices/${invoice.id}`}
                    className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-primary-300 hover:shadow-md transition-all"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="p-2 rounded-lg bg-gray-100 shrink-0">
                          <FileText className="w-5 h-5 text-gray-600" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-gray-900">
                              Invoice #{invoice.orderNumber}
                            </h3>
                            <span className={cn('badge text-xs', invoiceStatus.color)}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {invoiceStatus.label}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 truncate">{invoice.description}</p>
                          <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formatDate(invoice.createdAt)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Package className="w-3 h-3" />
                              {invoice.lineItems.length} item(s)
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-lg font-bold text-gray-900">
                            {formatCurrency(invoice.total)}
                          </p>
                          {invoice.dueDate && (
                            <p className="text-xs text-gray-500">
                              Due: {formatDate(invoice.dueDate)}
                            </p>
                          )}
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

export default InvoicesPage;
