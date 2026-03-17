import { useState } from 'react';
import { 
  Package, 
  Clock, 
  Settings, 
  User,
  CheckCircle,
  BarChart3,
  Layers
} from 'lucide-react';
import toast from 'react-hot-toast';
import { StationProgressPanel } from './components/StationProgressPanel';
import { LoginModal } from './components/LoginModal';
import { SettingsModal } from './components/SettingsModal';
import { useAuthStore } from './stores/auth';
import { useConfigStore } from './stores/config';

function App() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const { config } = useConfigStore();
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<'jobs' | 'materials' | 'stats'>('jobs');

  if (!isAuthenticated) {
    return <LoginModal onClose={() => {}} />;
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100 no-select">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center">
            <Package className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Production Station</h1>
            <p className="text-xs text-gray-500">Screen Print & Production</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-gray-600">Connected</span>
          </div>
          
          <button
            onClick={() => setActiveTab('jobs')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'jobs' 
                ? 'bg-orange-100 text-orange-700' 
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Layers className="w-4 h-4" />
              My Jobs
            </span>
          </button>
          
          <button
            onClick={() => setActiveTab('materials')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'materials' 
                ? 'bg-orange-100 text-orange-700' 
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Package className="w-4 h-4" />
              Materials
            </span>
          </button>
          
          <button
            onClick={() => setActiveTab('stats')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'stats' 
                ? 'bg-orange-100 text-orange-700' 
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4" />
              Stats
            </span>
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
      <main className="flex-1 overflow-hidden">
        {activeTab === 'jobs' && <StationProgressPanel />}
        
        {activeTab === 'materials' && (
          <div className="h-full flex items-center justify-center text-gray-500">
            <div className="text-center">
              <Package className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">Materials Tracking</p>
              <p className="text-sm">Coming soon - track vinyl, ink, and substrate usage</p>
            </div>
          </div>
        )}
        
        {activeTab === 'stats' && (
          <div className="h-full flex items-center justify-center text-gray-500">
            <div className="text-center">
              <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">Production Stats</p>
              <p className="text-sm">Coming soon - daily/weekly production metrics</p>
            </div>
          </div>
        )}
      </main>

      {/* Footer Status Bar */}
      <footer className="bg-gray-800 text-white px-4 py-1.5 flex items-center justify-between text-xs">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            Shift: 8:00 AM - 5:00 PM
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-gray-400">Last sync: Just now</span>
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
