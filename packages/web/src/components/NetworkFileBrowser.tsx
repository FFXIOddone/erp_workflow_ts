import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Folder, 
  File, 
  Image, 
  FileText, 
  ChevronRight, 
  Home, 
  RefreshCw, 
  ExternalLink, 
  Download,
  Eye,
  X,
  AlertCircle,
  Settings,
  FolderOpen,
  Upload,
  Plus,
  GripVertical,
  Link2,
  Unlink,
  ArrowLeft
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/auth';

interface FileInfo {
  name: string;
  path: string;
  type: 'file' | 'folder';
  extension?: string;
  size?: number;
  modifiedAt?: string;
  isImage: boolean;
  isDocument: boolean;
  isDesign: boolean;
}

interface FileBrowserData {
  configured: boolean;
  folderExists?: boolean;
  folderPath?: string | null;
  currentSubfolder?: string | null;
  message?: string;
  error?: string;
  files: FileInfo[];
  // Additional info for folder search
  woNumber?: string;
  customerName?: string;
  searchedLocations?: string[];
  folderName?: string;
  customerFolder?: string;
  hasManualOverride?: boolean;
}

interface NetworkFileBrowserProps {
  orderId: string;
  orderNumber?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getFileIcon(file: FileInfo) {
  if (file.type === 'folder') return <Folder className="w-5 h-5 text-yellow-500" />;
  if (file.isImage) return <Image className="w-5 h-5 text-blue-500" />;
  if (file.isDocument) return <FileText className="w-5 h-5 text-red-500" />;
  if (file.isDesign) return <FileText className="w-5 h-5 text-purple-500" />;
  return <File className="w-5 h-5 text-gray-500" />;
}

export function NetworkFileBrowser({ orderId, orderNumber }: NetworkFileBrowserProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const token = useAuthStore((state) => state.token);
  
  // Helper to build authenticated image URL
  const getImageUrl = (filePath: string) => {
    const baseUrl = `${api.defaults.baseURL}/file-browser/orders/${orderId}/files/content?path=${encodeURIComponent(filePath)}`;
    return token ? `${baseUrl}&token=${encodeURIComponent(token)}` : baseUrl;
  };
  
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('OTHER');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [browseCurrentPath, setBrowseCurrentPath] = useState('');

  const subfolder = currentPath.length > 0 ? currentPath.join('/') : undefined;

  // Fetch file categories
  const { data: categories } = useQuery({
    queryKey: ['file-categories'],
    queryFn: async () => {
      const response = await api.get('/file-browser/categories');
      return response.data.data as { value: string; label: string }[];
    },
    staleTime: Infinity,
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['file-browser', orderId, subfolder],
    queryFn: async () => {
      const params = subfolder ? { subfolder } : {};
      const response = await api.get(`/file-browser/orders/${orderId}/files`, { params });
      return response.data.data as FileBrowserData;
    },
  });

  const handleFolderClick = (folderName: string) => {
    setCurrentPath([...currentPath, folderName]);
  };

  const handleBreadcrumbClick = (index: number) => {
    setCurrentPath(currentPath.slice(0, index));
  };

  const handleFileClick = (file: FileInfo) => {
    if (file.type === 'folder') {
      handleFolderClick(file.name);
    } else if (file.isImage) {
      setSelectedImage(file.path);
    }
  };

  const handleOpenInExplorer = async () => {
    try {
      const response = await api.get(`/file-browser/orders/${orderId}/folder-path`);
      if (response.data.data.configured && response.data.data.folderPath) {
        const folderPath: string = response.data.data.folderPath;
        // Try to open via file:// protocol (works for UNC paths in some browsers/environments)
        const fileUrl = 'file:///' + folderPath.replace(/\\/g, '/');
        const opened = window.open(fileUrl, '_blank');
        if (!opened) {
          // Fallback: copy to clipboard with toast notification
          await navigator.clipboard.writeText(folderPath);
          toast.success(`Path copied: ${folderPath}`);
        }
      }
    } catch (err) {
      console.error('Error getting folder path:', err);
      toast.error('Could not resolve folder path');
    }
  };

  const handleDownload = async (file: FileInfo) => {
    try {
      const response = await api.get(`/file-browser/orders/${orderId}/files/content`, {
        params: { path: file.path },
        responseType: 'blob',
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', file.name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading file:', err);
    }
  };

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async ({ file, category }: { file: File; category: string }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', category);
      
      const response = await api.post(`/file-browser/orders/${orderId}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data.data;
    },
    onSuccess: (data) => {
      toast.success(`File uploaded to ${data.categoryLabel}`);
      queryClient.invalidateQueries({ queryKey: ['file-browser', orderId] });
      setShowUploadModal(false);
      setSelectedFile(null);
      setSelectedCategory('OTHER');
    },
    onError: (error: Error) => {
      toast.error(`Upload failed: ${error.message}`);
    },
  });

  // Create folder mutation
  const createFolderMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/file-browser/orders/${orderId}/create-folder`);
      return response.data.data;
    },
    onSuccess: (data) => {
      if (data.created) {
        toast.success('Folder created on network drive');
      } else {
        toast.success('Folder already exists');
      }
      queryClient.invalidateQueries({ queryKey: ['file-browser', orderId] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to create folder: ${error.message}`);
    },
  });

  // Browse folders query (for folder picker modal)
  const { data: browseFolders, isLoading: isBrowsing } = useQuery({
    queryKey: ['browse-folders', browseCurrentPath],
    queryFn: async () => {
      const params = browseCurrentPath ? { path: browseCurrentPath } : {};
      const response = await api.get('/file-browser/browse-folders', { params });
      return response.data.data as { currentPath: string; parentPath: string | null; folders: { name: string; path: string }[] };
    },
    enabled: showFolderPicker,
  });

  // Link folder mutation
  const linkFolderMutation = useMutation({
    mutationFn: async (folderPath: string) => {
      const response = await api.put(`/file-browser/orders/${orderId}/link-folder`, { folderPath });
      return response.data.data;
    },
    onSuccess: () => {
      toast.success('Folder linked to work order');
      setShowFolderPicker(false);
      setBrowseCurrentPath('');
      queryClient.invalidateQueries({ queryKey: ['file-browser', orderId] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to link folder: ${error.message}`);
    },
  });

  // Unlink folder mutation
  const unlinkFolderMutation = useMutation({
    mutationFn: async () => {
      const response = await api.delete(`/file-browser/orders/${orderId}/link-folder`);
      return response.data.data;
    },
    onSuccess: () => {
      toast.success('Folder unlinked — will use auto-discovery');
      queryClient.invalidateQueries({ queryKey: ['file-browser', orderId] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to unlink folder: ${error.message}`);
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setShowUploadModal(true);
    }
  };

  const handleUpload = () => {
    if (selectedFile) {
      uploadMutation.mutate({ file: selectedFile, category: selectedCategory });
    }
  };

  const resetUploadModal = () => {
    setShowUploadModal(false);
    setSelectedFile(null);
    setSelectedCategory('OTHER');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle drag start for files - enables dragging files FROM the browser
  const handleDragStart = useCallback((e: React.DragEvent, file: FileInfo) => {
    if (file.type === 'folder') {
      e.preventDefault();
      return;
    }
    
    // Set the file download URL for external drops
    const fileUrl = getImageUrl(file.path);
    
    // Set multiple data formats for maximum compatibility
    e.dataTransfer.setData('text/uri-list', fileUrl);
    e.dataTransfer.setData('text/plain', file.name);
    e.dataTransfer.setData('application/json', JSON.stringify({
      name: file.name,
      path: file.path,
      url: fileUrl,
      orderId,
      type: file.extension || 'file'
    }));
    
    // Set a custom drag image with the file name
    e.dataTransfer.effectAllowed = 'copyLink';
  }, [orderId]);

  // Handle drag events for file upload drop zone
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only show drop zone for external files (not internal drags)
    if (e.dataTransfer.types.includes('Files')) {
      setIsDraggingOver(true);
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      setIsDraggingOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to false if we're leaving the container (not entering a child)
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDraggingOver(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      // Take the first file and open the upload modal
      setSelectedFile(files[0]);
      setShowUploadModal(true);
    }
  }, []);

  // Not configured state
  if (data && !data.configured) {
    return (
      <div className="bg-white rounded-xl shadow-soft border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-4">
          <FolderOpen className="h-5 w-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900">Network Files</h2>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
          <Settings className="w-8 h-8 text-amber-500 mx-auto mb-2" />
          <h3 className="text-md font-medium text-amber-800 mb-1">Not Configured</h3>
          <p className="text-amber-700 text-sm">
            Configure the network drive path in Settings to link work orders to file storage.
          </p>
        </div>
      </div>
    );
  }

  // Folder not found state
  if (data && data.configured && !data.folderExists) {
    return (
      <div className="bg-white rounded-xl shadow-soft border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-4">
          <FolderOpen className="h-5 w-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900">Network Files</h2>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
          <FolderOpen className="w-10 h-10 text-gray-400 mx-auto mb-2" />
          <h3 className="text-md font-medium text-gray-700 mb-1">Folder Not Found</h3>
          {data.woNumber && (
            <p className="text-gray-500 text-sm">
              No folder found for <span className="font-mono font-semibold">{data.woNumber}</span>
              {data.customerName && <span> ({data.customerName})</span>}
            </p>
          )}
          <button
            onClick={() => createFolderMutation.mutate()}
            disabled={createFolderMutation.isPending}
            className="mt-3 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
          >
            {createFolderMutation.isPending ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Create Folder
              </>
            )}
          </button>
          <button
            onClick={() => { setShowFolderPicker(true); setBrowseCurrentPath(''); }}
            className="mt-3 ml-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors inline-flex items-center gap-2"
          >
            <Link2 className="w-4 h-4" />
            Link Existing Folder
          </button>
          <p className="text-gray-400 text-xs mt-3">
            Create a new standardized folder, or link an existing folder on the network drive.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`bg-white rounded-xl shadow-soft border overflow-hidden transition-colors relative ${
        isDraggingOver 
          ? 'border-primary-400 bg-primary-50' 
          : 'border-gray-100'
      }`}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drop overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 bg-primary-100 bg-opacity-80 z-10 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <Upload className="w-12 h-12 text-primary-600 mx-auto mb-2" />
            <p className="text-primary-700 font-medium">Drop file to upload</p>
            <p className="text-primary-500 text-sm">File will be added to this work order</p>
          </div>
        </div>
      )}
      
      {/* Section Header */}
      <div className="px-6 pt-6 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">Network Files</h2>
          </div>
          {data?.folderPath && (
            <div className="flex items-center gap-2">
              {data.hasManualOverride && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs font-medium">
                  <Link2 className="w-3 h-3" />
                  Linked
                  <button
                    onClick={() => unlinkFolderMutation.mutate()}
                    disabled={unlinkFolderMutation.isPending}
                    className="ml-1 p-0.5 hover:bg-blue-100 rounded"
                    title="Unlink folder (use auto-discovery)"
                  >
                    <Unlink className="w-3 h-3" />
                  </button>
                </span>
              )}
              <span className="text-xs text-gray-400 truncate max-w-xs" title={data.folderPath}>
                {data.customerFolder && data.folderName 
                  ? `${data.customerFolder} / ${data.folderName}` 
                  : data.folderPath.split('\\').slice(-2).join(' / ')}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Header */}
      <div className="bg-gray-50 border-y border-gray-200 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={() => setCurrentPath([])}
            className="p-1 hover:bg-gray-200 rounded"
            title="Go to root"
          >
            <Home className="w-4 h-4" />
          </button>
          {currentPath.length > 0 && (
            <>
              <ChevronRight className="w-4 h-4 text-gray-400" />
              {currentPath.map((folder, index) => (
                <span key={index} className="flex items-center gap-1">
                  <button
                    onClick={() => handleBreadcrumbClick(index + 1)}
                    className="text-blue-600 hover:underline"
                  >
                    {folder}
                  </button>
                  {index < currentPath.length - 1 && <ChevronRight className="w-4 h-4 text-gray-400" />}
                </span>
              ))}
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileSelect}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 hover:bg-primary-100 rounded text-primary-600"
            title="Upload file"
          >
            <Upload className="w-4 h-4" />
          </button>
          <button
            onClick={() => refetch()}
            className="p-1.5 hover:bg-gray-200 rounded text-gray-600"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleOpenInExplorer}
            className="p-1.5 hover:bg-gray-200 rounded text-gray-600"
            title="Open in Explorer"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
          <div className="border-l border-gray-300 h-4 mx-1" />
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
            title="Grid view"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
              <path d="M1 1h6v6H1zM9 1h6v6H9zM1 9h6v6H1zM9 9h6v6H9z" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
            title="List view"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
              <path d="M1 1h14v2H1zM1 5h14v2H1zM1 9h14v2H1zM1 13h14v2H1z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="p-8 text-center text-gray-500">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
          Loading files...
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-8 text-center text-red-500">
          <AlertCircle className="w-8 h-8 mx-auto mb-2" />
          Error loading files
        </div>
      )}

      {/* File list */}
      {data && !isLoading && (
        <>
          {data.files.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Folder className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>This folder is empty</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {data.files.map((file) => (
                <div
                  key={file.path}
                  onClick={() => handleFileClick(file)}
                  draggable={file.type === 'file'}
                  onDragStart={(e) => handleDragStart(e, file)}
                  className={`group cursor-pointer p-3 rounded-lg border border-transparent hover:border-gray-200 hover:bg-gray-50 transition-all ${file.type === 'file' ? 'cursor-grab active:cursor-grabbing' : ''}`}
                >
                  <div className="flex flex-col items-center">
                    {file.isImage ? (
                      <div className="w-16 h-16 mb-2 rounded overflow-hidden bg-gray-100 flex items-center justify-center">
                        <img
                          src={getImageUrl(file.path)}
                          alt={file.name}
                          className="max-w-full max-h-full object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            (e.target as HTMLImageElement).parentElement!.innerHTML = '<svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>';
                          }}
                        />
                      </div>
                    ) : (
                      <div className="w-16 h-16 mb-2 flex items-center justify-center">
                        {file.type === 'folder' ? (
                          <Folder className="w-12 h-12 text-yellow-500" />
                        ) : (
                          getFileIcon(file)
                        )}
                      </div>
                    )}
                    <span className="text-xs text-center text-gray-700 truncate w-full" title={file.name}>
                      {file.name}
                    </span>
                    {file.size !== undefined && (
                      <span className="text-xs text-gray-400">{formatFileSize(file.size)}</span>
                    )}
                  </div>
                  {file.type === 'file' && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex justify-center gap-1 mt-2">
                      {file.isImage && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedImage(file.path); }}
                          className="p-1 bg-blue-100 rounded hover:bg-blue-200"
                          title="View"
                        >
                          <Eye className="w-3 h-3 text-blue-600" />
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDownload(file); }}
                        className="p-1 bg-gray-100 rounded hover:bg-gray-200"
                        title="Download"
                      >
                        <Download className="w-3 h-3 text-gray-600" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {data.files.map((file) => (
                <div
                  key={file.path}
                  onClick={() => handleFileClick(file)}
                  draggable={file.type === 'file'}
                  onDragStart={(e) => handleDragStart(e, file)}
                  className={`flex items-center gap-4 px-4 py-3 hover:bg-gray-50 cursor-pointer group ${file.type === 'file' ? 'cursor-grab active:cursor-grabbing' : ''}`}
                >
                  {file.type === 'file' && (
                    <GripVertical className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  )}
                  {getFileIcon(file)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                    {file.modifiedAt && (
                      <p className="text-xs text-gray-500">{formatDate(file.modifiedAt)}</p>
                    )}
                  </div>
                  {file.size !== undefined && (
                    <span className="text-sm text-gray-500">{formatFileSize(file.size)}</span>
                  )}
                  {file.type === 'file' && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      {file.isImage && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedImage(file.path); }}
                          className="p-2 bg-blue-100 rounded hover:bg-blue-200"
                          title="View"
                        >
                          <Eye className="w-4 h-4 text-blue-600" />
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDownload(file); }}
                        className="p-2 bg-gray-100 rounded hover:bg-gray-200"
                        title="Download"
                      >
                        <Download className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Image Viewer Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 p-2 bg-white bg-opacity-10 rounded-full hover:bg-opacity-20 transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
          <img
            src={getImageUrl(selectedImage)}
            alt="Preview"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDownload({ name: selectedImage.split('/').pop() || 'image', path: selectedImage } as FileInfo);
              }}
              className="px-4 py-2 bg-white bg-opacity-20 rounded-lg text-white hover:bg-opacity-30 transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && selectedFile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={resetUploadModal}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Upload File</h3>
              <button onClick={resetUploadModal} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              {/* File Info */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <File className="w-8 h-8 text-gray-400" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{selectedFile.name}</p>
                    <p className="text-sm text-gray-500">{formatFileSize(selectedFile.size)}</p>
                  </div>
                </div>
              </div>

              {/* Category Select */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  File Category
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  {categories?.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  File will be saved to: <code className="bg-gray-100 px-1 rounded">{categories?.find(c => c.value === selectedCategory)?.label || 'Other'}/</code>
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={resetUploadModal}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpload}
                  disabled={uploadMutation.isPending}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {uploadMutation.isPending ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Upload
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Folder Picker Modal */}
      {showFolderPicker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => { setShowFolderPicker(false); setBrowseCurrentPath(''); }}>
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Link Network Folder</h3>
              <button onClick={() => { setShowFolderPicker(false); setBrowseCurrentPath(''); }} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Breadcrumb */}
            <div className="px-4 py-2 bg-gray-50 border-b flex items-center gap-2 text-sm">
              {browseCurrentPath ? (
                <button
                  onClick={() => setBrowseCurrentPath(browseFolders?.parentPath || '')}
                  className="p-1 hover:bg-gray-200 rounded"
                  title="Go up"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              ) : null}
              <Folder className="w-4 h-4 text-yellow-500" />
              <span className="text-gray-600 truncate">
                {browseCurrentPath || 'Network Drive Root'}
              </span>
              {browseCurrentPath && (
                <button
                  onClick={() => linkFolderMutation.mutate(browseCurrentPath)}
                  disabled={linkFolderMutation.isPending}
                  className="ml-auto px-3 py-1 bg-primary-600 text-white text-xs rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-1"
                >
                  {linkFolderMutation.isPending ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Link2 className="w-3 h-3" />}
                  Link This Folder
                </button>
              )}
            </div>

            {/* Folder list */}
            <div className="flex-1 overflow-y-auto p-2">
              {isBrowsing ? (
                <div className="p-8 text-center text-gray-500">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                  Loading folders...
                </div>
              ) : browseFolders?.folders.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <Folder className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No subfolders</p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {browseFolders?.folders.map((folder) => (
                    <button
                      key={folder.path}
                      onClick={() => setBrowseCurrentPath(folder.path)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 text-left group"
                    >
                      <Folder className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                      <span className="text-sm text-gray-700 truncate flex-1">{folder.name}</span>
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
