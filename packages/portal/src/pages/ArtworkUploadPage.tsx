import { useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Upload,
  File,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { ordersApi, selfServiceApi } from '@/lib/api';
import { formatFileSize, cn } from '@/lib/utils';

interface UploadFile {
  id: string;
  file: File;
  preview?: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

export function ArtworkUploadPage() {
  const [searchParams] = useSearchParams();
  const preselectedOrderId = searchParams.get('orderId');
  
  const [selectedOrderId, setSelectedOrderId] = useState<string>(preselectedOrderId || '');
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [notes, setNotes] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const queryClient = useQueryClient();

  const { data: ordersData } = useQuery({
    queryKey: ['orders', { pageSize: 50 }],
    queryFn: () => ordersApi.list({ pageSize: 50 }).then((r) => r.data.data),
  });

  const orders = ordersData?.orders?.filter((o: any) => 
    ['PENDING', 'IN_PROGRESS', 'ON_HOLD'].includes(o.status)
  ) || [];

  const uploadMutation = useMutation({
    mutationFn: async (file: UploadFile) => {
      // Use the new multipart file upload endpoint
      return selfServiceApi.uploadArtworkFile(
        selectedOrderId, 
        file.file, 
        notes || undefined
      );
    },
    onSuccess: (_, file) => {
      setFiles((prev) =>
        prev.map((f) => (f.id === file.id ? { ...f, status: 'success' } : f))
      );
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (error: any, file) => {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === file.id
            ? { ...f, status: 'error', error: error.message || 'Upload failed' }
            : f
        )
      );
    },
  });

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    addFiles(selectedFiles);
  };

  const addFiles = (newFiles: File[]) => {
    const uploadFiles: UploadFile[] = newFiles.map((file) => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      status: 'pending',
    }));
    setFiles((prev) => [...prev, ...uploadFiles]);
  };

  const removeFile = (id: string) => {
    setFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file?.preview) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter((f) => f.id !== id);
    });
  };

  const handleUpload = async () => {
    if (!selectedOrderId || files.length === 0) return;

    for (const file of files.filter((f) => f.status === 'pending')) {
      setFiles((prev) =>
        prev.map((f) => (f.id === file.id ? { ...f, status: 'uploading' } : f))
      );
      await uploadMutation.mutateAsync(file);
    }
  };

  const allUploaded = files.length > 0 && files.every((f) => f.status === 'success');
  const isUploading = files.some((f) => f.status === 'uploading');

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <Link
          to="/hub"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Hub
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Upload className="w-6 h-6 text-blue-500" />
          Upload Artwork
        </h1>
        <p className="mt-1 text-gray-500">
          Submit design files for your orders. We accept PDF, AI, EPS, PNG, JPG, and more.
        </p>
      </div>

      {/* Order Selection */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl border border-gray-200 p-6"
      >
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Order
        </label>
        <select
          value={selectedOrderId}
          onChange={(e) => setSelectedOrderId(e.target.value)}
          className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        >
          <option value="">Choose an order...</option>
          {orders.map((order: any) => (
            <option key={order.id} value={order.id}>
              #{order.orderNumber} - {order.description}
            </option>
          ))}
        </select>
        {orders.length === 0 && (
          <p className="text-sm text-gray-500 mt-2">
            No active orders found. Only pending or in-progress orders can receive artwork.
          </p>
        )}
      </motion.div>

      {/* Drop Zone */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className={cn(
          'relative border-2 border-dashed rounded-xl p-8 text-center transition-colors',
          isDragging
            ? 'border-primary-400 bg-primary-50'
            : 'border-gray-300 bg-white hover:border-gray-400'
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <input
          type="file"
          multiple
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          accept=".pdf,.ai,.eps,.svg,.png,.jpg,.jpeg,.gif,.tiff,.psd,.bmp"
        />
        <Upload className={cn('w-12 h-12 mx-auto mb-4', isDragging ? 'text-primary-500' : 'text-gray-400')} />
        <p className="text-lg font-medium text-gray-700">
          {isDragging ? 'Drop files here' : 'Drag & drop files here'}
        </p>
        <p className="text-sm text-gray-500 mt-1">
          or click to browse • Max 50MB per file
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs text-gray-400">
          <span className="px-2 py-1 bg-gray-100 rounded">PDF</span>
          <span className="px-2 py-1 bg-gray-100 rounded">AI</span>
          <span className="px-2 py-1 bg-gray-100 rounded">EPS</span>
          <span className="px-2 py-1 bg-gray-100 rounded">SVG</span>
          <span className="px-2 py-1 bg-gray-100 rounded">PNG</span>
          <span className="px-2 py-1 bg-gray-100 rounded">JPG</span>
          <span className="px-2 py-1 bg-gray-100 rounded">PSD</span>
        </div>
      </motion.div>

      {/* File List */}
      <AnimatePresence mode="popLayout">
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white rounded-xl border border-gray-200 overflow-hidden"
          >
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-medium text-gray-900">
                Files ({files.length})
              </h3>
            </div>
            <div className="divide-y divide-gray-100">
              {files.map((file) => (
                <motion.div
                  key={file.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex items-center gap-4 p-4"
                >
                  {/* Preview */}
                  <div className="w-12 h-12 flex-shrink-0 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                    {file.preview ? (
                      <img
                        src={file.preview}
                        alt={file.file.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <File className="w-6 h-6 text-gray-400" />
                    )}
                  </div>

                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{file.file.name}</p>
                    <p className="text-sm text-gray-500">
                      {formatFileSize(file.file.size)}
                    </p>
                  </div>

                  {/* Status */}
                  <div className="flex-shrink-0">
                    {file.status === 'pending' && (
                      <span className="text-sm text-gray-400">Ready</span>
                    )}
                    {file.status === 'uploading' && (
                      <Loader2 className="w-5 h-5 text-primary-500 animate-spin" />
                    )}
                    {file.status === 'success' && (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    )}
                    {file.status === 'error' && (
                      <div className="flex items-center gap-1 text-red-500">
                        <AlertCircle className="w-5 h-5" />
                        <span className="text-xs">{file.error}</span>
                      </div>
                    )}
                  </div>

                  {/* Remove */}
                  {file.status !== 'uploading' && (
                    <button
                      onClick={() => removeFile(file.id)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notes */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-xl border border-gray-200 p-6"
      >
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Notes (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any special instructions or notes about the artwork..."
          rows={3}
          className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
        />
      </motion.div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Link to="/hub" className="btn btn-outline">
          Cancel
        </Link>
        <button
          onClick={handleUpload}
          disabled={!selectedOrderId || files.length === 0 || isUploading || allUploaded}
          className="btn btn-primary"
        >
          {isUploading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Uploading...
            </>
          ) : allUploaded ? (
            <>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              All Uploaded!
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Upload {files.length} {files.length === 1 ? 'File' : 'Files'}
            </>
          )}
        </button>
      </div>

      {/* Success Message */}
      <AnimatePresence>
        {allUploaded && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-green-50 border border-green-200 rounded-xl p-6 text-center"
          >
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-green-800">
              Artwork Uploaded Successfully!
            </h3>
            <p className="text-green-600 mt-1">
              Our team has been notified and will review your files.
            </p>
            <div className="mt-4 flex justify-center gap-3">
              <Link to={`/orders/${selectedOrderId}`} className="btn btn-primary">
                View Order
              </Link>
              <button
                onClick={() => {
                  setFiles([]);
                  setNotes('');
                }}
                className="btn btn-outline"
              >
                Upload More
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ArtworkUploadPage;
