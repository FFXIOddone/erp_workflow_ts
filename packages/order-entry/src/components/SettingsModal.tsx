import { useState } from 'react';
import { 
  X, 
  Settings, 
  Folder, 
  Plus, 
  Trash2,
  Save,
  Server,
  Printer,
  HardDrive
} from 'lucide-react';
import { useConfigStore } from '../stores/config';

interface SettingsModalProps {
  onClose: () => void;
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const { config, setApiUrl, setNetworkDrivePath, addHotfolder, removeHotfolder } = useConfigStore();
  const [activeTab, setActiveTab] = useState<'general' | 'hotfolders' | 'printers'>('general');
  
  const [apiUrl, setApiUrlLocal] = useState(config.apiUrl);
  const [networkPath, setNetworkPath] = useState(config.networkDrivePath);
  
  const [newHotfolder, setNewHotfolder] = useState({
    name: '',
    path: '',
    ripType: 'Onyx' as const,
    autoCleanup: true,
    cleanupMinutes: 30,
  });

  const handleSaveGeneral = () => {
    setApiUrl(apiUrl);
    setNetworkDrivePath(networkPath);
    onClose();
  };

  const handleAddHotfolder = () => {
    if (newHotfolder.name && newHotfolder.path) {
      addHotfolder(newHotfolder);
      setNewHotfolder({
        name: '',
        path: '',
        ripType: 'Onyx',
        autoCleanup: true,
        cleanupMinutes: 30,
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('general')}
            className={`px-4 py-3 text-sm font-medium border-b-2 ${
              activeTab === 'general'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Server className="w-4 h-4 inline mr-2" />
            General
          </button>
          <button
            onClick={() => setActiveTab('hotfolders')}
            className={`px-4 py-3 text-sm font-medium border-b-2 ${
              activeTab === 'hotfolders'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Folder className="w-4 h-4 inline mr-2" />
            Hotfolders
          </button>
          <button
            onClick={() => setActiveTab('printers')}
            className={`px-4 py-3 text-sm font-medium border-b-2 ${
              activeTab === 'printers'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Printer className="w-4 h-4 inline mr-2" />
            Printers
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[50vh]">
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API Server URL
                </label>
                <input
                  type="text"
                  value={apiUrl}
                  onChange={(e) => setApiUrlLocal(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="http://localhost:8001/api"
                />
                <p className="text-xs text-gray-500 mt-1">
                  The URL of the ERP API server
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <HardDrive className="w-4 h-4 inline mr-1" />
                  Network Drive Path
                </label>
                <input
                  type="text"
                  value={networkPath}
                  onChange={(e) => setNetworkPath(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="\\server\share\path"
                />
                <p className="text-xs text-gray-500 mt-1">
                  The base path where customer files are stored
                </p>
              </div>
            </div>
          )}

          {activeTab === 'hotfolders' && (
            <div className="space-y-6">
              {/* Existing hotfolders */}
              {config.hotfolders.length > 0 && (
                <div className="space-y-2">
                  {config.hotfolders.map((folder) => (
                    <div
                      key={folder.name}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{folder.name}</p>
                        <p className="text-sm text-gray-500">{folder.path}</p>
                        <p className="text-xs text-gray-400">
                          {folder.ripType} • {folder.autoCleanup ? `Auto-cleanup: ${folder.cleanupMinutes}min` : 'No cleanup'}
                        </p>
                      </div>
                      <button
                        onClick={() => removeHotfolder(folder.name)}
                        className="p-2 text-red-500 hover:bg-red-100 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add new hotfolder */}
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Add Hotfolder</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Name</label>
                    <input
                      type="text"
                      value={newHotfolder.name}
                      onChange={(e) => setNewHotfolder({ ...newHotfolder, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="Onyx Main"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">RIP Type</label>
                    <select
                      value={newHotfolder.ripType}
                      onChange={(e) => setNewHotfolder({ ...newHotfolder, ripType: e.target.value as typeof newHotfolder.ripType })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="Onyx">Onyx</option>
                      <option value="Flexi">Flexi</option>
                      <option value="Caldera">Caldera</option>
                      <option value="VersaWorks">VersaWorks</option>
                      <option value="Wasatch">Wasatch</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">Path</label>
                    <input
                      type="text"
                      value={newHotfolder.path}
                      onChange={(e) => setNewHotfolder({ ...newHotfolder, path: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="C:\Onyx\Hotfolder or \\server\share\hotfolder"
                    />
                  </div>
                  <div className="col-span-2 flex items-center justify-between">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={newHotfolder.autoCleanup}
                        onChange={(e) => setNewHotfolder({ ...newHotfolder, autoCleanup: e.target.checked })}
                        className="rounded border-gray-300 text-primary-600"
                      />
                      <span className="text-sm text-gray-700">Auto-cleanup after</span>
                      <input
                        type="number"
                        value={newHotfolder.cleanupMinutes}
                        onChange={(e) => setNewHotfolder({ ...newHotfolder, cleanupMinutes: parseInt(e.target.value) || 30 })}
                        className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                        disabled={!newHotfolder.autoCleanup}
                      />
                      <span className="text-sm text-gray-700">minutes</span>
                    </label>
                    <button
                      onClick={handleAddHotfolder}
                      disabled={!newHotfolder.name || !newHotfolder.path}
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      Add
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'printers' && (
            <div className="text-center py-8 text-gray-500">
              <Printer className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p>Printer configuration coming soon</p>
              <p className="text-sm text-gray-400 mt-1">
                Will support HP, Roland, Mimaki, and other wide-format printers
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveGeneral}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 flex items-center gap-1"
          >
            <Save className="w-4 h-4" />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
