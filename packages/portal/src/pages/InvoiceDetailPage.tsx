import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  FileText,
  Printer,
  Package,
  CheckCircle2,
  Clock,
  AlertCircle,
  MapPin,
  Phone,
  Mail,
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

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: order, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => ordersApi.get(id!).then((r) => r.data.data),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">Loading invoice...</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-12">
        <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900">Invoice not found</h2>
        <p className="mt-2 text-gray-500">This invoice may not exist or you don't have access.</p>
        <Link to="/invoices" className="btn btn-primary mt-4">
          Back to Invoices
        </Link>
      </div>
    );
  }

  const invoiceStatus = getInvoiceStatus(order.status);
  const StatusIcon = invoiceStatus.icon;

  // Calculate totals
  const subtotal = order.lineItems?.reduce(
    (sum: number, li: any) => sum + Number(li.quantity) * Number(li.unitPrice),
    0
  ) || 0;
  
  // Tax rate could come from settings, using 0 for now as a placeholder
  const taxRate = 0;
  const taxAmount = subtotal * taxRate;
  const total = subtotal + taxAmount;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 print:hidden">
        <div>
          <Link
            to="/invoices"
            className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Invoices
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            Invoice #{order.orderNumber}
            <span className={cn('badge text-sm', invoiceStatus.color)}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {invoiceStatus.label}
            </span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="btn btn-outline flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
        </div>
      </div>

      {/* Invoice Document */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden print:shadow-none print:border-none"
      >
        {/* Invoice Header */}
        <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-primary-50 to-white print:bg-white">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-primary-600 text-white rounded-xl flex items-center justify-center font-bold text-xl">
                  W
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Wilde Signs</h2>
                  <p className="text-sm text-gray-500">Custom Signs & Graphics</p>
                </div>
              </div>
              <div className="text-sm text-gray-500 space-y-1">
                <p className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  123 Sign Street, Signville, ST 12345
                </p>
                <p className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  (555) 123-4567
                </p>
                <p className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  info@wildesigns.com
                </p>
              </div>
            </div>
            <div className="text-right">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">INVOICE</h1>
              <p className="text-lg font-semibold text-primary-600">#{order.orderNumber}</p>
              <div className="mt-4 space-y-1 text-sm text-gray-600">
                <p>
                  <span className="text-gray-400">Date:</span>{' '}
                  {formatDate(order.createdAt)}
                </p>
                {order.dueDate && (
                  <p>
                    <span className="text-gray-400">Due Date:</span>{' '}
                    {formatDate(order.dueDate)}
                  </p>
                )}
                <p>
                  <span className="text-gray-400">Status:</span>{' '}
                  <span className={cn('font-medium', invoiceStatus.color.replace('bg-', 'text-').replace('-100', '-700'))}>
                    {invoiceStatus.label}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bill To */}
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Bill To
          </h3>
          <p className="font-semibold text-gray-900">{order.customerName}</p>
          <p className="text-sm text-gray-600">{order.description}</p>
        </div>

        {/* Line Items */}
        <div className="p-6">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left pb-3 text-sm font-semibold text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="text-center pb-3 text-sm font-semibold text-gray-500 uppercase tracking-wider w-20">
                  Qty
                </th>
                <th className="text-right pb-3 text-sm font-semibold text-gray-500 uppercase tracking-wider w-28">
                  Unit Price
                </th>
                <th className="text-right pb-3 text-sm font-semibold text-gray-500 uppercase tracking-wider w-28">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {order.lineItems?.map((item: any) => (
                <tr key={item.id} className="border-b border-gray-100">
                  <td className="py-4">
                    <p className="font-medium text-gray-900">{item.description}</p>
                    {item.notes && (
                      <p className="text-sm text-gray-500 mt-1">{item.notes}</p>
                    )}
                  </td>
                  <td className="py-4 text-center text-gray-600">{item.quantity}</td>
                  <td className="py-4 text-right text-gray-600">
                    {formatCurrency(Number(item.unitPrice))}
                  </td>
                  <td className="py-4 text-right font-medium text-gray-900">
                    {formatCurrency(Number(item.quantity) * Number(item.unitPrice))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="mt-6 border-t border-gray-200 pt-4">
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="text-gray-900">{formatCurrency(subtotal)}</span>
                </div>
                {taxRate > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Tax ({(taxRate * 100).toFixed(2)}%)</span>
                    <span className="text-gray-900">{formatCurrency(taxAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2">
                  <span className="text-gray-900">Total</span>
                  <span className="text-primary-600">{formatCurrency(total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-gray-50 border-t border-gray-100 print:bg-white">
          <div className="text-center text-sm text-gray-500">
            <p className="font-medium text-gray-700 mb-1">Thank you for your business!</p>
            <p>Payment is due within 30 days of invoice date.</p>
            <p className="mt-2">
              Questions? Contact us at{' '}
              <a href="mailto:billing@wildesigns.com" className="text-primary-600 hover:underline">
                billing@wildesigns.com
              </a>
            </p>
          </div>
        </div>
      </motion.div>

      {/* Order Reference */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 print:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Package className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm text-gray-500">Related Order</p>
              <p className="font-medium text-gray-900">#{order.orderNumber}</p>
            </div>
          </div>
          <Link
            to={`/orders/${order.id}`}
            className="btn btn-outline text-sm"
          >
            View Order
          </Link>
        </div>
      </div>
    </div>
  );
}

export default InvoiceDetailPage;
