import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Palette,
  Upload,
  File,
  Download,
  Search,
  Grid,
  List,
  X,
  Loader2,
  CheckCircle2,
  Image,
  FileText,
  Type,
  Shapes,
} from 'lucide-react';
import { selfServiceApi } from '@/lib/api';
import { formatDate, formatFileSize, cn } from '@/lib/utils';

type AssetType = 'all' | 'logo' | 'color' | 'font' | 'guide' | 'other';
type ViewMode = 'grid' | 'list';

const ASSET_TYPES = [
  { id: 'all', label: 'All Assets', icon: Palette },
  { id: 'logo', label: 'Logos', icon: Image },
  { id: 'color', label: 'Colors', icon: Shapes },
  { id: 'font', label: 'Fonts', icon: Type },
  { id: 'guide', label: 'Brand Guides', icon: FileText },
  { id: 'other', label: 'Other', icon: File },
];

interface UploadingFile {
  id: string;
  file: File;
  preview?: string;
  status: 'uploading' | 'success' | 'error';
  assetType: string;
}

export function BrandAssetsPage() {
  const [search, setSearch] = useState('');
  const [assetType, setAssetType] = useState<AssetType>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [selectedAssetType, setSelectedAssetType] = useState('logo');
  const [description, setDescription] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['brand-assets'],
    queryFn: () => selfServiceApi.getBrandAssets().then((r) => r.data.data),
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: UploadingFile) => {
      // Use the new multipart file upload endpoint
      return selfServiceApi.uploadBrandAssetFile(
        file.file,
        file.assetType,
        description || undefined
      );
    },
    onSuccess: (_, file) => {
      setUploadingFiles((prev) =>
        prev.map((f) => (f.id === file.id ? { ...f, status: 'success' } : f))
      );
      queryClient.invalidateQueries({ queryKey: ['brand-assets'] });
    },
    onError: (_, file) => {
      setUploadingFiles((prev) =>
        prev.map((f) => (f.id === file.id ? { ...f, status: 'error' } : f))
      );
    },
  });

  // Combine assets and documents
  const allAssets = [
    ...(data?.assets || []).map((a: any) => ({ ...a, source: 'asset' })),
    ...(data?.documents || []).map((d: any) => ({ ...d, source: 'document', fileName: d.name })),
  ];

  // Filter assets
  const filteredAssets = allAssets.filter((asset) => {
    if (search) {
      const searchLower = search.toLowerCase();
      if (
        !asset.fileName?.toLowerCase().includes(searchLower) &&
        !asset.name?.toLowerCase().includes(searchLower) &&
        !asset.description?.toLowerCase().includes(searchLower)
      ) {
        return false;
      }
    }

    if (assetType !== 'all') {
      const tags = asset.tags || [];
      if (!tags.includes(assetType)) {
        return false;
      }
    }

    return true;
  });

  const handleFileDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files);
      const newFiles: UploadingFile[] = files.map((file) => ({
        id: `${Date.now()}-${Math.random()}`,
        file,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
        status: 'uploading',
        assetType: selectedAssetType,
      }));
      setUploadingFiles((prev) => [...prev, ...newFiles]);
      newFiles.forEach((file) => uploadMutation.mutate(file));
    },
    [selectedAssetType, uploadMutation]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newFiles: UploadingFile[] = files.map((file) => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      status: 'uploading',
      assetType: selectedAssetType,
    }));
    setUploadingFiles((prev) => [...prev, ...newFiles]);
    newFiles.forEach((file) => uploadMutation.mutate(file));
  };

  const getAssetIcon = (asset: any) => {
    const fileName = asset.fileName || asset.name || '';
    const ext = fileName.split('.').pop()?.toLowerCase();
    
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) {
      return Image;
    }
    if (['pdf'].includes(ext)) {
      return FileText;
    }
    if (['ttf', 'otf', 'woff', 'woff2'].includes(ext)) {
      return Type;
    }
    return File;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">Loading brand assets...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            to="/hub"
            className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Hub
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Palette className="w-6 h-6 text-amber-500" />
            Brand Library
          </h1>
          <p className="mt-1 text-gray-500">
            Store and manage your logos, brand guides, and style assets
          </p>
        </div>
        <button
          onClick={() => setIsUploadModalOpen(true)}
          className="btn btn-primary"
        >
          <Upload className="w-4 h-4 mr-2" />
          Upload Asset
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search assets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        {/* Type Filter */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
          {ASSET_TYPES.map((type) => {
            const Icon = type.icon;
            return (
              <button
                key={type.id}
                onClick={() => setAssetType(type.id as AssetType)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors',
                  assetType === type.id
                    ? 'bg-amber-100 text-amber-700 font-medium'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                )}
              >
                <Icon className="w-4 h-4" />
                {type.label}
              </button>
            );
          })}
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1">
          <button
            onClick={() => setViewMode('grid')}
            className={cn(
              'p-2 rounded',
              viewMode === 'grid' ? 'bg-gray-100' : 'hover:bg-gray-50'
            )}
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={cn(
              'p-2 rounded',
              viewMode === 'list' ? 'bg-gray-100' : 'hover:bg-gray-50'
            )}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Assets Grid/List */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredAssets.map((asset: any, index: number) => {
              const Icon = getAssetIcon(asset);
              const isImage = asset.filePath?.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i);

              return (
                <motion.div
                  key={asset.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: index * 0.03 }}
                  className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow"
                >
                  {/* Preview */}
                  <div className="aspect-square bg-gray-100 relative">
                    {isImage ? (
                      <img
                        src={`/api/v1/uploads/${asset.filePath}`}
                        alt={asset.fileName || asset.name}
                        className="w-full h-full object-contain p-2"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Icon className="w-12 h-12 text-gray-300" />
                      </div>
                    )}

                    {/* Hover Actions */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <a
                        href={`/api/v1/uploads/${asset.filePath}`}
                        download
                        className="p-2 bg-white rounded-lg hover:bg-gray-100"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-3">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {asset.fileName || asset.name}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {formatDate(asset.createdAt)}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                  Name
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                  Type
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                  Date
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredAssets.map((asset: any) => {
                const Icon = getAssetIcon(asset);
                return (
                  <tr key={asset.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                          {asset.filePath?.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i) ? (
                            <img
                              src={`/api/v1/uploads/${asset.filePath}`}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Icon className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                        <span className="font-medium text-gray-900">
                          {asset.fileName || asset.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {asset.tags?.join(', ') || 'Asset'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatDate(asset.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <a
                        href={`/api/v1/uploads/${asset.filePath}`}
                        download
                        className="text-primary-600 hover:text-primary-700"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty State */}
      {filteredAssets.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <Palette className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900">No assets found</h3>
          <p className="text-gray-500 mt-1">
            {search || assetType !== 'all'
              ? 'Try adjusting your filters'
              : 'Upload your logos, brand guides, and style files'}
          </p>
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="btn btn-primary mt-4"
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload First Asset
          </button>
        </div>
      )}

      {/* Upload Modal */}
      <AnimatePresence>
        {isUploadModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setIsUploadModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-xl max-w-lg w-full overflow-hidden"
            >
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Upload Brand Asset
                </h3>
                <button
                  onClick={() => setIsUploadModalOpen(false)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* Asset Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Asset Type
                  </label>
                  <select
                    value={selectedAssetType}
                    onChange={(e) => setSelectedAssetType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="logo">Logo</option>
                    <option value="color">Color Palette</option>
                    <option value="font">Font</option>
                    <option value="guide">Brand Guide</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description (optional)
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g., Primary logo on white background"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                {/* Drop Zone */}
                <div
                  className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-gray-400 transition-colors relative"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleFileDrop}
                >
                  <input
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    accept="image/*,.pdf,.ai,.eps,.svg,.ttf,.otf,.woff,.woff2"
                  />
                  <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600">Drag & drop files or click to browse</p>
                  <p className="text-sm text-gray-400 mt-1">
                    PNG, JPG, SVG, PDF, AI, EPS, Fonts
                  </p>
                </div>

                {/* Uploading Files */}
                {uploadingFiles.length > 0 && (
                  <div className="space-y-2">
                    {uploadingFiles.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                      >
                        {file.preview ? (
                          <img
                            src={file.preview}
                            alt=""
                            className="w-10 h-10 rounded object-cover"
                          />
                        ) : (
                          <File className="w-10 h-10 text-gray-400" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {file.file.name}
                          </p>
                          <p className="text-xs text-gray-400">
                            {formatFileSize(file.file.size)}
                          </p>
                        </div>
                        {file.status === 'uploading' && (
                          <Loader2 className="w-5 h-5 text-primary-500 animate-spin" />
                        )}
                        {file.status === 'success' && (
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-gray-100 flex justify-end">
                <button
                  onClick={() => {
                    setIsUploadModalOpen(false);
                    setUploadingFiles([]);
                    setDescription('');
                  }}
                  className="btn btn-outline"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default BrandAssetsPage;
