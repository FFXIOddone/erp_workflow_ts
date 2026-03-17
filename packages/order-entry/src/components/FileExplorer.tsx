import { useState, useEffect } from 'react';
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
  Send,
  Search,
  ArrowUp
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import toast from 'react-hot-toast';
import { useConfigStore } from '../stores/config';

interface FileInfo {
  name: string;
  path: string;
  is_directory: boolean;
  size?: number;
  modified?: string;
}

interface FileExplorerProps {
  onSendToHotfolder: (filePath: string, hotfolderPath: string) => void;
}

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.tiff', '.tif'];
const PRINT_EXTENSIONS = ['.pdf', '.ai', '.eps', '.psd', '.tif', '.tiff'];

export function FileExplorer({ onSendToHotfolder }: FileExplorerProps) {
  const { config } = useConfigStore();
  const [currentPath, setCurrentPath] = useState<string>(config.networkDrivePath || '');
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const loadFiles = async (path: string) => {
    if (!path) return;
    
    setLoading(true);
    try {
      const result = await invoke<FileInfo[]>('list_files', { path });
      setFiles(result);
      setCurrentPath(path);
    } catch (error) {
      toast.error('Failed to load files');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (config.networkDrivePath) {
      loadFiles(config.networkDrivePath);
    }
  }, [config.networkDrivePath]);

  const handleNavigate = (path: string) => {
    loadFiles(path);
  };

  const handleFileClick = async (file: FileInfo) => {
    if (file.is_directory) {
      handleNavigate(file.path);
    } else {
      setSelectedFile(file.path);
    }
  };

  const handleOpenFile = async (path: string) => {
    try {
      await invoke('open_file', { path });
    } catch (error) {
      toast.error('Failed to open file');
    }
  };

  const handleOpenFolder = async () => {
    try {
      await invoke('open_folder', { path: currentPath });
    } catch (error) {
      toast.error('Failed to open folder');
    }
  };

  const goUp = () => {
    const parts = currentPath.split('\\').filter(Boolean);
    if (parts.length > 1) {
      parts.pop();
      const newPath = parts.join('\\');
      handleNavigate(newPath.startsWith('\\\\') ? newPath : '\\\\' + newPath);
    }
  };

  const getFileIcon = (file: FileInfo) => {
    if (file.is_directory) {
      return <Folder className="w-5 h-5 text-yellow-500" />;
    }
    const ext = file.name.toLowerCase().split('.').pop() || '';
    if (IMAGE_EXTENSIONS.some(e => file.name.toLowerCase().endsWith(e))) {
      return <Image className="w-5 h-5 text-blue-500" />;
    }
    if (PRINT_EXTENSIONS.some(e => file.name.toLowerCase().endsWith(e))) {
      return <FileText className="w-5 h-5 text-red-500" />;
    }
    return <File className="w-5 h-5 text-gray-500" />;
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const pathParts = currentPath.split('\\').filter(Boolean);
  const filteredFiles = files.filter(f => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isPrintFile = (name: string) => 
    PRINT_EXTENSIONS.some(e => name.toLowerCase().endsWith(e));

  return (
    <div className="h-full flex flex-col bg-white rounded-xl shadow-soft border border-gray-100 overflow-hidden">
      {/* Navigation */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={goUp}
            className="p-1.5 hover:bg-gray-100 rounded-lg"
            title="Go up"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleNavigate(config.networkDrivePath)}
            className="p-1.5 hover:bg-gray-100 rounded-lg"
            title="Go to root"
          >
            <Home className="w-4 h-4" />
          </button>
          
          <div className="flex-1 flex items-center gap-1 text-sm overflow-x-auto bg-gray-50 px-2 py-1 rounded-lg">
            {pathParts.map((part, index) => (
              <span key={index} className="flex items-center gap-1 flex-shrink-0">
                {index > 0 && <ChevronRight className="w-3 h-3 text-gray-400" />}
                <button
                  onClick={() => {
                    const newPath = pathParts.slice(0, index + 1).join('\\');
                    handleNavigate(newPath.startsWith('\\\\') ? newPath : '\\\\' + newPath);
                  }}
                  className="text-blue-600 hover:underline"
                >
                  {part}
                </button>
              </span>
            ))}
          </div>

          <button
            onClick={() => loadFiles(currentPath)}
            className="p-1.5 hover:bg-gray-100 rounded-lg"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleOpenFolder}
            className="p-1.5 hover:bg-gray-100 rounded-lg"
            title="Open in Explorer"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* File List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <Folder className="w-12 h-12 text-gray-300 mb-2" />
            <p>No files found</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2 text-right">Size</th>
                <th className="px-4 py-2 w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredFiles.map((file) => (
                <tr
                  key={file.path}
                  className={`group hover:bg-gray-50 cursor-pointer ${
                    selectedFile === file.path ? 'bg-primary-50' : ''
                  }`}
                  onClick={() => handleFileClick(file)}
                  draggable={!file.is_directory}
                  onDragStart={(e) => {
                    if (!file.is_directory) {
                      e.dataTransfer.setData('application/json', JSON.stringify({
                        filePath: file.path,
                        fileName: file.name,
                      }));
                      e.dataTransfer.effectAllowed = 'copy';
                    }
                  }}
                >
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      {getFileIcon(file)}
                      <span className="text-gray-900">{file.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right text-sm text-gray-500">
                    {file.is_directory ? '-' : formatSize(file.size)}
                  </td>
                  <td className="px-4 py-2">
                    {!file.is_directory && (
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenFile(file.path);
                          }}
                          className="p-1 text-gray-500 hover:bg-gray-200 rounded"
                          title="Open"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                        {isPrintFile(file.name) && config.defaultHotfolder && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const hotfolder = config.hotfolders.find(
                                h => h.name === config.defaultHotfolder
                              );
                              if (hotfolder) {
                                onSendToHotfolder(file.path, hotfolder.path);
                                toast.success('Sent to RIP');
                              }
                            }}
                            className="p-1 text-primary-600 hover:bg-primary-100 rounded"
                            title="Send to RIP"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Status bar */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-500">
        {filteredFiles.length} items • Drag print files to hotfolder panel
      </div>
    </div>
  );
}
