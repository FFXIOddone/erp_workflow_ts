import { useState } from 'react';
import { 
  Folder,
  CheckCircle,
  XCircle,
  Send,
  RefreshCw,
  Plus,
  Trash2,
  Settings
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useConfigStore } from '../stores/config';

interface HotfolderStatusProps {
  onDrop: (filePath: string, hotfolderPath: string) => void;
}

export function HotfolderStatus({ onDrop }: HotfolderStatusProps) {
  const { config, setDefaultHotfolder, removeHotfolder } = useConfigStore();
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);

  const handleDragOver = (e: React.DragEvent, folderName: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolder(folderName);
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDragLeave = () => {
    setDragOverFolder(null);
  };

  const handleDrop = (e: React.DragEvent, folderPath: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolder(null);

    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      if (data.filePath) {
        onDrop(data.filePath, folderPath);
        toast.success(`Sent ${data.orderNumber || 'file'} to RIP`);
      }
    } catch {
      toast.error('Invalid file data');
    }
  };

  if (config.hotfolders.length === 0) {
    return (
      <div className="p-4 text-center">
        <Folder className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500 mb-3">No hotfolders configured</p>
        <button className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 inline-flex items-center gap-1">
          <Plus className="w-4 h-4" />
          Add Hotfolder
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {config.hotfolders.map((folder) => (
        <div
          key={folder.name}
          onDragOver={(e) => handleDragOver(e, folder.name)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, folder.path)}
          className={`group p-3 rounded-lg border-2 border-dashed transition-colors cursor-pointer ${
            dragOverFolder === folder.name
              ? 'border-primary-400 bg-primary-50'
              : config.defaultHotfolder === folder.name
                ? 'border-green-300 bg-green-50'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Folder className={`w-5 h-5 ${
                config.defaultHotfolder === folder.name ? 'text-green-600' : 'text-gray-400'
              }`} />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{folder.name}</span>
                  {config.defaultHotfolder === folder.name && (
                    <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                      Default
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">{folder.ripType}</p>
              </div>
            </div>

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
              {config.defaultHotfolder !== folder.name && (
                <button
                  onClick={() => setDefaultHotfolder(folder.name)}
                  className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-100 rounded"
                  title="Set as default"
                >
                  <CheckCircle className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => removeHotfolder(folder.name)}
                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded"
                title="Remove"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Status indicator */}
          <div className="mt-2 flex items-center gap-2 text-xs">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-gray-500">Ready • 0 files queued</span>
          </div>

          {/* Drop hint */}
          {dragOverFolder === folder.name && (
            <div className="mt-2 text-center text-sm text-primary-600 font-medium">
              Drop to send to {folder.name}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
