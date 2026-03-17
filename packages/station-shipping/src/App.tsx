import { useState } from 'react';
import { 
  Truck, 
  Package,
  Settings, 
  User,
  CheckCircle,
  Clock,
  Inbox,
  Send
} from 'lucide-react';
import { ShippingQueuePanel } from './components/ShippingQueuePanel';
import { LoginModal } from './components/LoginModal';
import { SettingsModal } from './components/SettingsModal';
import { useAuthStore } from './stores/auth';

function App() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<'outbound' | 'receiving' | 'history'>('outbound');

  if (!isAuthenticated) {
    return <LoginModal onClose={() => {}} />;
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100 no-select">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
            <Truck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Shipping Station</h1>
            <p className="text-xs text-gray-500">Packaging & Shipping</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-gray-600">Connected</span>
          </div>
          
          <button
            onClick={() => setActiveTab('outbound')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'outbound' 
                ? 'bg-green-100 text-green-700' 
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Send className="w-4 h-4" />
              Outbound
            </span>
          </button>
          
          <button
            onClick={() => setActiveTab('receiving')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'receiving' 
                ? 'bg-green-100 text-green-700' 
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Inbox className="w-4 h-4" />
              Receiving
            </span>
          </button>
          
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'history' 
                ? 'bg-green-100 text-green-700' 
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              History
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
        {activeTab === 'outbound' && <ShippingQueuePanel />}
        
        {activeTab === 'receiving' && (
          <div className="h-full flex items-center justify-center text-gray-500">
            <div className="text-center">
              <Inbox className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">Receiving</p>
              <p className="text-sm">Coming soon - log incoming materials and packages</p>
            </div>
          </div>
        )}
        
        {activeTab === 'history' && (
          <div className="h-full flex items-center justify-center text-gray-500">
            <div className="text-center">
              <Clock className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">Shipping History</p>
              <p className="text-sm">Coming soon - view past shipments and tracking</p>
            </div>
          </div>
        )}
      </main>

      {/* Footer Status Bar */}
      <footer className="bg-gray-800 text-white px-4 py-1.5 flex items-center justify-between text-xs">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <Package className="w-3 h-3" />
            Ready to ship: 8
          </span>
          <span className="text-gray-400">|</span>
          <span className="flex items-center gap-1.5">
            <Truck className="w-3 h-3" />
            Shipped today: 12
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
