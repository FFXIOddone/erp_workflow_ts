import { useState, useEffect, useRef } from 'react';
import { Warehouse, LogOut, ArrowLeft, Settings, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { useAuthStore } from './stores/auth';
import { useConfigStore, StationId } from './stores/config';
import { isTauri, invoke } from './lib/tauri-bridge';
import { LoginScreen } from './components/LoginScreen';
import { StationPicker } from './components/StationPicker';
import { UpdateChecker } from './components/UpdateChecker';
import { PrintingStation } from './stations/PrintingStation';
import { DesignStation } from './stations/DesignStation';
import { ProductionStation } from './stations/ProductionStation';
import { ShippingStation } from './stations/ShippingStation';
import { InstallationStation } from './stations/InstallationStation';
import { OrderEntryStation } from './stations/OrderEntryStation';
import toast from 'react-hot-toast';

const STATION_LABELS: Record<StationId, string> = {
  DESIGN: 'Design Studio',
  PRINTING: 'Printing',
  PRODUCTION: 'Production',
  SHIPPING: 'Shipping',
  ORDER_ENTRY: 'Order Entry',
  INSTALLATION: 'Installation',
};

const STATION_COLORS: Record<StationId, string> = {
  DESIGN: 'bg-purple-600',
  PRINTING: 'bg-blue-600',
  PRODUCTION: 'bg-orange-600',
  SHIPPING: 'bg-green-600',
  ORDER_ENTRY: 'bg-indigo-600',
  INSTALLATION: 'bg-amber-600',
};

function StationView({ station }: { station: StationId }) {
  switch (station) {
    case 'DESIGN':
      return <DesignStation />;
    case 'PRINTING':
      return <PrintingStation />;
    case 'PRODUCTION':
      return <ProductionStation />;
    case 'SHIPPING':
      return <ShippingStation />;
    case 'ORDER_ENTRY':
      return <OrderEntryStation />;
    case 'INSTALLATION':
      return <InstallationStation />;
    default:
      return (
        <div className="flex items-center justify-center h-full text-gray-400">Unknown station</div>
      );
  }
}

// Map StationId to PrintingMethod values for access control
const STATION_TO_METHODS: Record<StationId, string[]> = {
  DESIGN: ['DESIGN'],
  PRINTING: ['ROLL_TO_ROLL', 'FLATBED'],
  PRODUCTION: ['PRODUCTION', 'SCREEN_PRINT'],
  SHIPPING: ['SHIPPING_RECEIVING'],
  ORDER_ENTRY: ['ORDER_ENTRY'],
  INSTALLATION: ['INSTALLATION'],
};

function App() {
  const { isAuthenticated, user, logout } = useAuthStore();
  const { activeStation, setActiveStation } = useConfigStore();
  const [online, setOnline] = useState(navigator.onLine);
  const [version, setVersion] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const { config, setApiUrl, setNetworkDrivePath, setDevMode, setDevFrontendUrl } =
    useConfigStore();

  const userAllowedStations = user?.allowedStations;
  const isAdmin =
    user?.role === 'ADMIN' ||
    user?.role === 'MANAGER' ||
    !userAllowedStations ||
    userAllowedStations.length === 0;
  const wasAuthenticatedRef = useRef(isAuthenticated);

  const isStationAllowed = (station: StationId): boolean => {
    if (isAdmin) return true;
    return STATION_TO_METHODS[station].some((m) => userAllowedStations!.includes(m));
  };
  const blockedStation = activeStation && !isStationAllowed(activeStation) ? activeStation : null;
  const visibleStation = blockedStation ? null : activeStation;

  // Clear station on logout so the next login always shows the picker
  useEffect(() => {
    if (!isAuthenticated) {
      setActiveStation(null);
    }
  }, [isAuthenticated, setActiveStation]);

  // Admins should always choose their station — never silently restore a persisted one.
  useEffect(() => {
    if (isAuthenticated && isAdmin && activeStation) {
      setActiveStation(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally mount-only

  // If an admin logs in after the app has already mounted, clear any restored station once.
  useEffect(() => {
    const wasAuthenticated = wasAuthenticatedRef.current;
    wasAuthenticatedRef.current = isAuthenticated;

    if (!wasAuthenticated && isAuthenticated && isAdmin && activeStation) {
      setActiveStation(null);
    }
  }, [activeStation, isAdmin, isAuthenticated, setActiveStation]);

  // Block access to forbidden stations from persisted state or manual tampering.
  useEffect(() => {
    if (!blockedStation) return;
    setActiveStation(null);
    toast.error('You do not have access to this station');
  }, [blockedStation, setActiveStation]);

  // Dev mode: redirect the webview to the server-hosted frontend
  // This lets you iterate on frontend code without rebuilding the exe
  useEffect(() => {
    if (config.devMode && config.devFrontendUrl && isTauri()) {
      const currentUrl = window.location.href;
      const targetUrl = config.devFrontendUrl.replace(/\/$/, '');
      // Don't redirect if we're already on the remote URL
      if (!currentUrl.startsWith(targetUrl)) {
        console.log('[DevMode] Redirecting to:', config.devFrontendUrl);
        window.location.replace(config.devFrontendUrl);
      }
    }
  }, [config.devMode, config.devFrontendUrl]);

  // Track online status
  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Get version from Tauri
  useEffect(() => {
    if (isTauri()) {
      invoke<string>('get_app_version')
        .then((v) => {
          if (v) setVersion(v);
        })
        .catch(() => setVersion('dev'));
    } else {
      setVersion('web');
    }
  }, []);

  // Not logged in — show login screen
  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  // Logged in but no station selected — show picker
  if (!visibleStation) {
    return <StationPicker />;
  }

  // Station selected — render station with header
  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Top bar */}
      <header
        className={`${STATION_COLORS[visibleStation]} text-white flex items-center px-4 py-2 gap-3 shadow-md select-none`}
        style={{ WebkitAppRegion: 'drag' } as any}
      >
        <button
          onClick={() => setActiveStation(null)}
          className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
          style={{ WebkitAppRegion: 'no-drag' } as any}
          title="Switch station"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <Warehouse className="w-5 h-5" />
        <span className="font-bold text-lg">{STATION_LABELS[visibleStation]}</span>

        <div className="flex-1" />

        {/* Connection indicator */}
        <div className="flex items-center gap-1.5 text-sm opacity-80">
          {online ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4 text-red-300" />}
        </div>

        {/* User info */}
        <div className="text-sm opacity-90" style={{ WebkitAppRegion: 'no-drag' } as any}>
          {user?.displayName || user?.username}
        </div>

        {/* Settings button */}
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
          style={{ WebkitAppRegion: 'no-drag' } as any}
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Logout */}
        <button
          onClick={() => {
            logout();
            setActiveStation(null);
          }}
          className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
          style={{ WebkitAppRegion: 'no-drag' } as any}
          title="Logout"
        >
          <LogOut className="w-4 h-4" />
        </button>

        {/* Version badge */}
        {version && <span className="text-xs opacity-50 ml-1">v{version}</span>}
      </header>

      {/* Auto-update banner */}
      <UpdateChecker />

      {/* Connection status banner */}
      {!online && (
        <div className="bg-red-500 text-white text-center py-1.5 text-sm font-medium flex items-center justify-center gap-2">
          <WifiOff className="w-4 h-4" />
          Offline — changes will sync when reconnected
        </div>
      )}

      {/* Settings panel — slides down when toggled */}
      {showSettings && (
        <div className="bg-white border-b shadow-sm px-6 py-4 space-y-3">
          <h3 className="font-semibold text-gray-900 text-sm">Settings</h3>
          <div className="grid grid-cols-2 gap-4 max-w-2xl">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">API URL</label>
              <input
                type="text"
                value={config.apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Network Drive Path
              </label>
              <input
                type="text"
                value={config.networkDrivePath}
                onChange={(e) => setNetworkDrivePath(e.target.value)}
                placeholder="\\server\share"
                className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
              />
            </div>
          </div>

          {/* Dev Mode */}
          <div className="border-t pt-3 mt-3">
            <div className="flex items-center gap-3 mb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.devMode}
                  onChange={(e) => setDevMode(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded"
                />
                <span className="text-sm font-medium text-gray-700">Dev Mode</span>
              </label>
              {config.devMode && (
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                  Active — loads frontend from server
                </span>
              )}
            </div>
            {config.devMode && (
              <div className="max-w-2xl">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Frontend URL (server-hosted build)
                </label>
                <input
                  type="text"
                  value={config.devFrontendUrl}
                  onChange={(e) => setDevFrontendUrl(e.target.value)}
                  placeholder="http://192.168.254.75:8001/shop-floor/"
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">
                  App will load the frontend from this URL instead of the bundled files. Change code
                  → run{' '}
                  <code className="bg-gray-100 px-1 rounded">pnpm --filter shop-floor build</code> →
                  relaunch app.
                </p>
              </div>
            )}
          </div>

          <button
            onClick={() => {
              setShowSettings(false);
              toast.success('Settings saved');
            }}
            className="text-sm text-indigo-600 hover:text-indigo-700"
          >
            Close Settings
          </button>
        </div>
      )}

      {/* Station content */}
      <main className="flex-1 overflow-hidden">
        <StationView station={visibleStation} />
      </main>
    </div>
  );
}

export default App;
