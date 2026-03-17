import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Search,
  Filter,
  Download,
  FileImage,
  File,
  Palette,
  Package,
  Calendar,
  FolderOpen,
} from 'lucide-react';
import { ordersApi } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';

// File type display configs
const FILE_TYPE_CONFIG: Record<string, { label: string; icon: typeof FileText; color: string }> = {
  PROOF: { label: 'Proof', icon: FileImage, color: 'bg-blue-100 text-blue-700' },
  ARTWORK: { label: 'Artwork', icon: Palette, color: 'bg-purple-100 text-purple-700' },
  INVOICE: { label: 'Invoice', icon: FileText, color: 'bg-green-100 text-green-700' },
  PACKING_SLIP: { label: 'Packing Slip', icon: Package, color: 'bg-amber-100 text-amber-700' },
  EMAIL: { label: 'Email', icon: File, color: 'bg-gray-100 text-gray-700' },
  OTHER: { label: 'Document', icon: File, color: 'bg-gray-100 text-gray-700' },
};

// Get file extension for display
function getFileExtension(fileName: string): string {
  const parts = fileName.split('.');
  return parts.length > 1 ? parts.pop()?.toUpperCase() || 'FILE' : 'FILE';
}

// Format file size
function formatFileSize(bytes: number | null): string {
  if (!bytes) return 'Unknown size';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Attachment {
  id: string;
  fileName: string;
  filePath: string;
  fileType: string;
  fileSize: number | null;
  description: string | null;
  uploadedAt: string;
}

interface OrderWithAttachments {
  id: string;
  orderNumber: string;
  description: string;
  attachments: Attachment[];
}

export function DocumentsPage() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['portal-orders-documents'],
    queryFn: () => ordersApi.list().then((r) => r.data.data),
  });

  const orders: OrderWithAttachments[] = data?.orders || [];

  // Flatten all documents from all orders
  const allDocuments: (Attachment & { order: OrderWithAttachments })[] = [];
  orders.forEach((order) => {
    if (order.attachments && order.attachments.length > 0) {
      order.attachments.forEach((attachment) => {
        allDocuments.push({
          ...attachment,
          order,
        });
      });
    }
  });

  // Filter documents
  const filteredDocuments = allDocuments.filter((doc) => {
    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      const matchesName = doc.fileName.toLowerCase().includes(searchLower);
      const matchesOrder = doc.order.orderNumber.toLowerCase().includes(searchLower);
      const matchesDesc = doc.description?.toLowerCase().includes(searchLower);
      if (!matchesName && !matchesOrder && !matchesDesc) {
        return false;
      }
    }

    // Type filter
    if (typeFilter !== 'all' && doc.fileType !== typeFilter) {
      return false;
    }

    return true;
  });

  // Sort by most recent first
  filteredDocuments.sort((a, b) => {
    const dateA = new Date(a.uploadedAt).getTime();
    const dateB = new Date(b.uploadedAt).getTime();
    return dateB - dateA;
  });

  // Calculate stats by type
  const stats = {
    proofs: allDocuments.filter((d) => d.fileType === 'PROOF').length,
    artwork: allDocuments.filter((d) => d.fileType === 'ARTWORK').length,
    other: allDocuments.filter((d) => !['PROOF', 'ARTWORK'].includes(d.fileType)).length,
    total: allDocuments.length,
  };

  // Group by order for better organization
  const documentsByOrder = new Map<string, (Attachment & { order: OrderWithAttachments })[]>();
  filteredDocuments.forEach((doc) => {
    const key = doc.order.id;
    if (!documentsByOrder.has(key)) {
      documentsByOrder.set(key, []);
    }
    documentsByOrder.get(key)!.push(doc);
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">Loading documents...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
        <p className="mt-1 text-gray-500">Download proofs, artwork, and other files</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl border border-gray-200 p-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <FileImage className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Proofs</p>
              <p className="text-xl font-bold text-gray-900">{stats.proofs}</p>
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
            <div className="p-2 bg-purple-50 rounded-lg">
              <Palette className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Artwork</p>
              <p className="text-xl font-bold text-gray-900">{stats.artwork}</p>
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
            <div className="p-2 bg-gray-50 rounded-lg">
              <File className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Other</p>
              <p className="text-xl font-bold text-gray-900">{stats.other}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-xl border border-gray-200 p-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-50 rounded-lg">
              <FolderOpen className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Files</p>
              <p className="text-xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by file name or order number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-400" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="all">All Types</option>
            <option value="PROOF">Proofs</option>
            <option value="ARTWORK">Artwork</option>
            <option value="INVOICE">Invoices</option>
            <option value="PACKING_SLIP">Packing Slips</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
      </div>

      {/* Documents List */}
      <div className="space-y-6">
        <AnimatePresence mode="popLayout">
          {filteredDocuments.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-12"
            >
              <FolderOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900">No documents found</h3>
              <p className="text-gray-500 mt-1">
                {allDocuments.length === 0
                  ? 'Documents from your orders will appear here.'
                  : 'Try adjusting your search or filter.'}
              </p>
            </motion.div>
          ) : (
            Array.from(documentsByOrder.entries()).map(([orderId, docs], groupIndex) => {
              const order = docs[0].order;
              return (
                <motion.div
                  key={orderId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: groupIndex * 0.05 }}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden"
                >
                  {/* Order Header */}
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                    <Link
                      to={`/orders/${orderId}`}
                      className="font-medium text-gray-900 hover:text-primary-600 flex items-center gap-2"
                    >
                      <Package className="w-4 h-4 text-gray-400" />
                      Order #{order.orderNumber}
                    </Link>
                    <span className="text-sm text-gray-500">{docs.length} file(s)</span>
                  </div>

                  {/* Documents */}
                  <div className="divide-y divide-gray-100">
                    {docs.map((doc) => {
                      const typeConfig = FILE_TYPE_CONFIG[doc.fileType] || FILE_TYPE_CONFIG.OTHER;
                      const TypeIcon = typeConfig.icon;
                      const ext = getFileExtension(doc.fileName);

                      return (
                        <div
                          key={doc.id}
                          className="p-4 hover:bg-gray-50 transition-colors flex items-center gap-4"
                        >
                          {/* File Icon */}
                          <div className={cn('p-3 rounded-xl', typeConfig.color.replace('text-', 'bg-').replace('-700', '-50'))}>
                            <TypeIcon className={cn('w-6 h-6', typeConfig.color.split(' ')[1])} />
                          </div>

                          {/* File Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium text-gray-900 truncate">{doc.fileName}</h4>
                              <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded font-medium">
                                {ext}
                              </span>
                            </div>
                            <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
                              <span className={cn('badge text-xs', typeConfig.color)}>
                                {typeConfig.label}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDate(doc.uploadedAt)}
                              </span>
                              {doc.fileSize && (
                                <span>{formatFileSize(doc.fileSize)}</span>
                              )}
                            </div>
                            {doc.description && (
                              <p className="mt-1 text-sm text-gray-600 truncate">{doc.description}</p>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2">
                            <a
                              href={`/api/v1/portal/documents/${doc.id}/download`}
                              download
                              className="btn btn-outline text-sm flex items-center gap-1"
                            >
                              <Download className="w-4 h-4" />
                              Download
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {/* Quick Links */}
      {allDocuments.length > 0 && (
        <div className="bg-blue-50 rounded-xl p-6 border border-blue-100">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">Need Help?</h3>
          <p className="text-blue-700 text-sm mb-4">
            Looking for a specific file? Contact our team for assistance.
          </p>
          <Link to="/messages" className="btn btn-primary text-sm">
            Contact Support
          </Link>
        </div>
      )}
    </div>
  );
}

export default DocumentsPage;
