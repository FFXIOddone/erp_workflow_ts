import { useState } from 'react';
import { 
  Printer, 
  FolderOpen, 
  RefreshCw, 
  Settings, 
  User,
  Send,
  CheckCircle,
  Clock,
  AlertTriangle,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { invoke } from './lib/tauri-bridge';
import toast from 'react-hot-toast';
import { PrintQueue } from './components/PrintQueue';
import { HotfolderStatus } from './components/HotfolderStatus';
import { PrinterStatusPanel } from './components/PrinterStatusPanel';
import { FileExplorer } from './components/FileExplorer';
import { WorkOrderQueue } from './components/WorkOrderQueue';
import { LoginModal } from './components/LoginModal';
import { SettingsModal } from './components/SettingsModal';
import { useAuthStore } from './stores/auth';
import { useConfigStore } from './stores/config';

function App() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const { config, isConfigured } = useConfigStore();
  const [showSettings, setShowSettings] = useState(false);
  const [showLogin, setShowLogin] = useState(!isAuthenticated);
  const [activeTab, setActiveTab] = useState<'orders' | 'queue' | 'files' | 'printers'>('orders');

  const handleOpenFolder = async (path: string) => {
    try {
      await invoke('open_folder', { path });
    } catch (error) {
      toast.error('Failed to open folder');
    }
  };

  const handleSendToHotfolder = async (filePath: string, hotfolderPath: string) => {
    try {
      await invoke('send_to_hotfolder', { filePath, hotfolderPath });
      toast.success('File sent to RIP');
    } catch (error) {
      toast.error('Failed to send file');
    }
  };

  // Build subtitle from user's allowed printing stations
  const STATION_LABELS: Record<string, string> = {
    ROLL_TO_ROLL: 'Roll-to-Roll',
    FLATBED: 'Flatbed',
    SCREEN_PRINT: 'Screen Print',
  };
  const userPrintStations = (user?.allowedStations || [])
    .filter((s) => ['ROLL_TO_ROLL', 'FLATBED', 'SCREEN_PRINT'].includes(s))
    .map((s) => STATION_LABELS[s] || s);
  const stationSubtitle = userPrintStations.length > 0
    ? userPrintStations.join(' & ')
    : 'Flatbed & Roll-to-Roll';

  if (!isAuthenticated) {
    return <LoginModal onClose={() => setShowLogin(false)} />;
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100 no-select">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <Printer className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Printing Station</h1>
            <p className="text-xs text-gray-500">{stationSubtitle}</p>
          </div>
        </div>

        {/* Status indicators */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-gray-600">Connected</span>
          </div>
          
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'orders' 
                ? 'bg-primary-100 text-primary-700' 
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Work Orders
          </button>
          
          <button
            onClick={() => setActiveTab('queue')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'queue' 
                ? 'bg-primary-100 text-primary-700' 
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Print Queue
          </button>
          
          <button
            onClick={() => setActiveTab('files')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'files' 
                ? 'bg-primary-100 text-primary-700' 
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Files
          </button>
          
          <button
            onClick={() => setActiveTab('printers')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'printers' 
                ? 'bg-primary-100 text-primary-700' 
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Printers
          </button>
        </div>

        {/* User & Settings */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
          >
            <Settings className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg">
            <User className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium">{user?.displayName || 'User'}</span>
          </div>
          
          <button
            onClick={logout}
            className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Hotfolders */}
        <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
              RIP Hotfolders
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <HotfolderStatus 
              onDrop={handleSendToHotfolder}
            />
          </div>
          
          {/* Quick Stats */}
          <div className="p-4 border-t border-gray-100 bg-gray-50">
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Today's Stats</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Jobs Printed</span>
                <span className="font-semibold">24</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Sq Ft</span>
                <span className="font-semibold">1,245</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Queue</span>
                <span className="font-semibold">8</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Panel */}
        <main className="flex-1 overflow-hidden p-4">
          {activeTab === 'orders' && (
            <WorkOrderQueue />
          )}
          
          {activeTab === 'queue' && (
            <PrintQueue 
              onSendToHotfolder={handleSendToHotfolder}
              onOpenFolder={handleOpenFolder}
            />
          )}
          
          {activeTab === 'files' && (
            <FileExplorer 
              onSendToHotfolder={handleSendToHotfolder}
            />
          )}
          
          {activeTab === 'printers' && (
            <PrinterStatusPanel />
          )}
        </main>
      </div>

      {/* Footer Status Bar */}
      <footer className="bg-gray-800 text-white px-4 py-1.5 flex items-center justify-between text-xs">
        <div className="flex items-center gap-4">
          <span className="text-gray-400">
            Network: {config.networkDrivePath || 'Not configured'}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-gray-400">
            Last sync: Just now
          </span>
          <span className="text-green-400 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            All systems operational
          </span>
        </div>
      </footer>

      {/* Modals */}
      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}

export default App;
