import { useState } from 'react';
import { 
  FileText, 
  Plus,
  Settings, 
  User,
  CheckCircle,
  Clock,
  List,
  Users
} from 'lucide-react';
import { OrderForm } from './components/OrderForm';
import { LoginModal } from './components/LoginModal';
import { SettingsModal } from './components/SettingsModal';
import { useAuthStore } from './stores/auth';

function App() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<'new' | 'orders' | 'customers'>('new');

  if (!isAuthenticated) {
    return <LoginModal onClose={() => {}} />;
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100 no-select">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Order Entry</h1>
            <p className="text-xs text-gray-500">Create & Manage Orders</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-gray-600">Connected</span>
          </div>
          
          <button
            onClick={() => setActiveTab('new')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'new' 
                ? 'bg-indigo-100 text-indigo-700' 
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Plus className="w-4 h-4" />
              New Order
            </span>
          </button>
          
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'orders' 
                ? 'bg-indigo-100 text-indigo-700' 
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <List className="w-4 h-4" />
              Orders
            </span>
          </button>
          
          <button
            onClick={() => setActiveTab('customers')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'customers' 
                ? 'bg-indigo-100 text-indigo-700' 
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Users className="w-4 h-4" />
              Customers
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
        {activeTab === 'new' && <OrderForm />}
        
        {activeTab === 'orders' && (
          <div className="h-full flex items-center justify-center text-gray-500">
            <div className="text-center">
              <List className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">Order List</p>
              <p className="text-sm">Coming soon - search and manage existing orders</p>
            </div>
          </div>
        )}
        
        {activeTab === 'customers' && (
          <div className="h-full flex items-center justify-center text-gray-500">
            <div className="text-center">
              <Users className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">Customer Management</p>
              <p className="text-sm">Coming soon - add, edit, and manage customers</p>
            </div>
          </div>
        )}
      </main>

      {/* Footer Status Bar */}
      <footer className="bg-gray-800 text-white px-4 py-1.5 flex items-center justify-between text-xs">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <FileText className="w-3 h-3" />
            Orders today: 8
          </span>
          <span className="text-gray-400">|</span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            Quotes pending: 3
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
