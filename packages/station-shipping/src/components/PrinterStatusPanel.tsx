import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Printer,
  CheckCircle,
  AlertCircle,
  Clock,
  Pause,
  Activity,
  RefreshCw,
  Droplets,
  Zap,
  Monitor,
  Plus,
  X,
  ArrowRight,
  Wifi,
  WifiOff,
  Settings,
} from 'lucide-react';
import { useConfigStore } from '../stores/config';
import { useAuthStore } from '../stores/auth';

interface PrintJobItem {
  id: string;
  jobNumber: string;
  name: string;
  status: string;
  priority: number;
  materialType?: string;
  estimatedMinutes?: number;
  startedAt?: string;
  operatorNotes?: string;
  workOrder: { id: string; orderNumber: string; customerName: string };
  assignedTo?: { displayName: string };
  queue: { id: string; name: string; station: string };
}

// Live status from SNMP polling
interface SupplyLevel {
  name: string;
  color: string;
  level: number;
  maxCapacity: number;
  currentLevel: number;
  type: string;
}

interface LiveStatus {
  equipmentId: string;
  ipAddress: string;
  reachable: boolean;
  lastPolled: string;
  state: 'idle' | 'printing' | 'warmup' | 'error' | 'offline' | 'unknown' | 'drying' | 'paused';
  stateMessage?: string;
  systemName?: string;
  systemDescription?: string;
  supplies: SupplyLevel[];
  mediaLoaded?: string;
  alerts: string[];
  errorMessage?: string;
}

interface PrinterData {
  id: string;
  name: string;
  type: string;
  manufacturer?: string;
  model?: string;
  location?: string;
  station?: string;
  status: string;
  ipAddress?: string | null;
  snmpCommunity?: string;
  connectionType?: string | null;
  isPrinting: boolean;
  currentJobs: PrintJobItem[];
}

interface DashboardData {
  printers: PrinterData[];
  queues: { id: string; name: string; station: string }[];
  activeJobs: PrintJobItem[];
  recentCompleted: PrintJobItem[];
  stats: { pending: number; printing: number; completedToday: number; totalActive: number };
}

interface AvailablePrinter {
  id: string;
  name: string;
  manufacturer?: string;
  model?: string;
  status: string;
}

const STATION_LABELS: Record<string, string> = {
  ROLL_TO_ROLL: 'Roll-to-Roll',
  FLATBED: 'Flatbed',
  SCREEN_PRINT: 'Screen Print',
  PRODUCTION: 'Production',
  DESIGN: 'Design',
  SHIPPING_RECEIVING: 'Shipping',
  INSTALLATION: 'Installation',
  ORDER_ENTRY: 'Order Entry',
  SALES: 'Sales',
};

function getElapsedTime(startedAt: string): string {
  const diffMin = Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000);
  if (diffMin < 60) return `${diffMin}m`;
  return `${Math.floor(diffMin / 60)}h ${diffMin % 60}m`;
}

export function PrinterStatusPanel() {
  const { config } = useConfigStore();
  const { token, user } = useAuthStore();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddPrinter, setShowAddPrinter] = useState(false);
  const [availablePrinters, setAvailablePrinters] = useState<AvailablePrinter[]>([]);
  const [addingStation, setAddingStation] = useState<string | null>(null);
  const [liveStatuses, setLiveStatuses] = useState<Record<string, LiveStatus>>({});
  const [editingIp, setEditingIp] = useState<string | null>(null);
  const [ipInput, setIpInput] = useState('');
  const livePollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Get the user's allowed stations that are print-related
  const userStations = (user?.allowedStations || []).filter(
    (s) => ['ROLL_TO_ROLL', 'FLATBED', 'SCREEN_PRINT'].includes(s)
  );
  // Admins/managers see all printing stations by default
  const stationsToShow = userStations.length > 0
    ? userStations
    : ['FLATBED', 'ROLL_TO_ROLL'];

  const stationParam = stationsToShow.join(',');

  const fetchDashboard = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${config.apiUrl}/print-queue/dashboard?stations=${stationParam}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const json = await res.json();
      setDashboard(json.data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch printer data');
    } finally {
      setLoading(false);
    }
  }, [config.apiUrl, token, stationParam]);

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 8000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  // Fetch live SNMP status for printers with IP addresses
  const fetchLiveStatus = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${config.apiUrl}/print-queue/live-status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const json = await res.json();
      if (json.data) {
        const statuses = Array.isArray(json.data) ? json.data : (json.data.statuses || []);
        const statusMap: Record<string, LiveStatus> = {};
        for (const s of statuses) {
          statusMap[s.equipmentId] = s;
        }
        setLiveStatuses(statusMap);
      }
    } catch {
      // Live status is best-effort
    }
  }, [config.apiUrl, token]);

  // Poll live status every 15 seconds
  useEffect(() => {
    fetchLiveStatus();
    livePollingRef.current = setInterval(fetchLiveStatus, 15000);
    return () => {
      if (livePollingRef.current) clearInterval(livePollingRef.current);
    };
  }, [fetchLiveStatus]);

  // Set IP address for a printer
  const setIpAddress = async (printerId: string, ip: string) => {
    try {
      await fetch(`${config.apiUrl}/print-queue/printers/${printerId}/ip`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ipAddress: ip, connectionType: 'SNMP' }),
      });
      setEditingIp(null);
      setIpInput('');
      fetchDashboard();
      fetchLiveStatus();
    } catch (err) {
      console.error('Failed to set IP:', err);
    }
  };

  // Ensure default queues exist for the user's stations on first load
  useEffect(() => {
    if (!token || stationsToShow.length === 0) return;
    fetch(`${config.apiUrl}/print-queue/ensure-queues`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ stations: stationsToShow }),
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.apiUrl, token]);

  const fetchAvailablePrinters = async () => {
    try {
      const res = await fetch(`${config.apiUrl}/print-queue/available-printers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load');
      const json = await res.json();
      setAvailablePrinters(json.data || []);
    } catch {
      setAvailablePrinters([]);
    }
  };

  const assignPrinterToStation = async (printerId: string, station: string) => {
    try {
      await fetch(`${config.apiUrl}/print-queue/printers/${printerId}/station`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ station }),
      });
      setShowAddPrinter(false);
      setAddingStation(null);
      fetchDashboard();
    } catch (err) {
      console.error('Failed to assign printer:', err);
    }
  };

  const removePrinterFromStation = async (printerId: string) => {
    try {
      await fetch(`${config.apiUrl}/print-queue/printers/${printerId}/station`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ station: null }),
      });
      fetchDashboard();
    } catch (err) {
      console.error('Failed to remove printer:', err);
    }
  };

  const updateJobStatus = async (jobId: string, status: string) => {
    try {
      await fetch(`${config.apiUrl}/print-queue/jobs/${jobId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      fetchDashboard();
    } catch (err) {
      console.error('Failed to update job status:', err);
    }
  };

  const getStatusIcon = (status: string, isPrinting: boolean, live?: LiveStatus) => {
    // Use live SNMP state if available and reachable
    if (live?.reachable) {
      switch (live.state) {
        case 'printing': return <Activity className="w-5 h-5 text-purple-500 animate-pulse" />;
        case 'idle': return <CheckCircle className="w-5 h-5 text-green-500" />;
        case 'warmup': return <Zap className="w-5 h-5 text-blue-500 animate-pulse" />;
        case 'drying': return <Droplets className="w-5 h-5 text-amber-500" />;
        case 'error': return <AlertCircle className="w-5 h-5 text-red-500" />;
        case 'paused': return <Pause className="w-5 h-5 text-yellow-500" />;
        default: return <CheckCircle className="w-5 h-5 text-green-500" />;
      }
    }
    if (isPrinting) return <Activity className="w-5 h-5 text-purple-500 animate-pulse" />;
    switch (status) {
      case 'OPERATIONAL': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'DEGRADED': return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'MAINTENANCE': return <Clock className="w-5 h-5 text-orange-500" />;
      case 'DOWN': return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'WARMING_UP': return <Zap className="w-5 h-5 text-blue-500" />;
      case 'OFFLINE': return <Monitor className="w-5 h-5 text-gray-400" />;
      default: return <Monitor className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusLabel = (status: string, isPrinting: boolean, live?: LiveStatus) => {
    if (live?.reachable) {
      const map: Record<string, string> = {
        idle: 'Idle', printing: 'Printing', warmup: 'Warming Up',
        error: 'Error', offline: 'Offline', unknown: 'Connected',
        drying: 'Drying', paused: 'Paused',
      };
      return map[live.state] || 'Connected';
    }
    if (isPrinting) return 'Printing';
    const map: Record<string, string> = {
      OPERATIONAL: 'Ready', DEGRADED: 'Degraded', MAINTENANCE: 'Maintenance',
      DOWN: 'Down', WARMING_UP: 'Warming Up', OFFLINE: 'Offline',
    };
    return map[status] || 'Unknown';
  };

  const getStatusColor = (status: string, isPrinting: boolean, live?: LiveStatus) => {
    if (live?.reachable) {
      switch (live.state) {
        case 'printing': return 'text-purple-600';
        case 'idle': return 'text-green-600';
        case 'warmup': return 'text-blue-600';
        case 'drying': return 'text-amber-600';
        case 'error': return 'text-red-600';
        case 'paused': return 'text-yellow-600';
        default: return 'text-green-600';
      }
    }
    if (isPrinting) return 'text-purple-600';
    if (status === 'OPERATIONAL') return 'text-green-600';
    if (status === 'DOWN') return 'text-red-600';
    return 'text-gray-600';
  };

  // Get color for ink supply bar
  const getInkColor = (name: string, color: string): string => {
    const lower = name.toLowerCase();
    if (lower.includes('cyan') && lower.includes('light')) return '#87CEEB';
    if (lower.includes('magenta') && lower.includes('light')) return '#FFB6C1';
    if (lower.includes('cyan')) return '#00BFFF';
    if (lower.includes('magenta')) return '#FF00FF';
    if (lower.includes('yellow')) return '#FFD700';
    if (lower.includes('black') || lower.includes('matte')) return '#333333';
    if (lower.includes('white')) return '#F0F0F0';
    if (lower.includes('optimizer') || lower.includes('overcoat')) return '#E0E0E0';
    if (lower.includes('primer')) return '#D4D4D4';
    if (color && color.startsWith('#')) return color;
    return '#999999';
  };

  // Get short label for ink (C, M, Y, K, LC, LM, W, etc.)
  const getInkLabel = (name: string): string => {
    const lower = name.toLowerCase();
    if (lower.includes('light cyan') || lower.includes('lt cyan')) return 'LC';
    if (lower.includes('light magenta') || lower.includes('lt magenta')) return 'LM';
    if (lower.includes('cyan')) return 'C';
    if (lower.includes('magenta')) return 'M';
    if (lower.includes('yellow')) return 'Y';
    if (lower.includes('black') || lower.includes('matte black')) return 'K';
    if (lower.includes('white')) return 'W';
    if (lower.includes('optimizer')) return 'OP';
    if (lower.includes('overcoat')) return 'OC';
    if (lower.includes('primer')) return 'PR';
    return name.substring(0, 2).toUpperCase();
  };

  if (loading && !dashboard) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (error && !dashboard) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
        <p className="text-red-600 font-medium">Failed to load printer data</p>
        <p className="text-sm text-gray-500 mt-1">{error}</p>
        <button onClick={fetchDashboard} className="mt-4 px-4 py-2 text-sm bg-primary-600 text-white rounded-lg">Retry</button>
      </div>
    );
  }

  const printers = dashboard?.printers ?? [];
  const stats = dashboard?.stats;

  // Group printers by station
  const printersByStation: Record<string, PrinterData[]> = {};
  for (const station of stationsToShow) {
    printersByStation[station] = printers.filter((p) => p.station === station);
  }

  return (
    <div className="h-full overflow-y-auto">
      {/* Stats Bar */}
      {stats && (
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="bg-purple-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-purple-700">{stats.printing}</p>
            <p className="text-xs text-purple-600">Printing</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-blue-700">{stats.pending}</p>
            <p className="text-xs text-blue-600">In Queue</p>
          </div>
          <div className="bg-amber-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-amber-700">{stats.totalActive}</p>
            <p className="text-xs text-amber-600">Active</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-green-700">{stats.completedToday}</p>
            <p className="text-xs text-green-600">Done Today</p>
          </div>
        </div>
      )}

      {/* Station Sections */}
      {stationsToShow.map((station) => {
        const stationPrinters = printersByStation[station] || [];
        const stationLabel = STATION_LABELS[station] || station;

        return (
          <div key={station} className="mb-6">
            {/* Station Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900">{stationLabel}</h2>
                <span className="text-sm text-gray-500">
                  {stationPrinters.length} printer{stationPrinters.length !== 1 ? 's' : ''}
                </span>
              </div>
              <button
                onClick={() => {
                  setAddingStation(station);
                  setShowAddPrinter(true);
                  fetchAvailablePrinters();
                }}
                className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100 border border-primary-200"
              >
                <Plus className="w-4 h-4" />
                Add Printer
              </button>
            </div>

            {stationPrinters.length === 0 ? (
              <div className="bg-white rounded-xl shadow-soft border border-gray-100 p-6 text-center">
                <Printer className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No printers assigned to {stationLabel}</p>
                <p className="text-xs text-gray-400 mt-1">Click "Add Printer" to assign one from Equipment</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {stationPrinters.map((printer) => {
                  const printingJob = printer.currentJobs.find((j) => j.status === 'PRINTING');
                  const dryingJobs = printer.currentJobs.filter((j) => j.status === 'DRYING');
                  const live = liveStatuses[printer.id];
                  const hasIp = !!printer.ipAddress;
                  const isLivePrinting = live?.reachable && live.state === 'printing';
                  const effectivePrinting = printer.isPrinting || isLivePrinting;

                  // Determine border color based on live state
                  const borderClass = isLivePrinting ? 'border-purple-300 ring-1 ring-purple-200' :
                    live?.reachable && live.state === 'error' ? 'border-red-300 ring-1 ring-red-200' :
                    effectivePrinting ? 'border-purple-300 ring-1 ring-purple-200' : 'border-gray-100';

                  // Determine icon background
                  const iconBgClass = isLivePrinting ? 'bg-purple-100' :
                    live?.reachable && live.state === 'idle' ? 'bg-green-100' :
                    live?.reachable && live.state === 'warmup' ? 'bg-blue-100' :
                    live?.reachable && live.state === 'error' ? 'bg-red-100' :
                    printer.isPrinting ? 'bg-purple-100' :
                    printer.status === 'OPERATIONAL' ? 'bg-green-100' :
                    printer.status === 'DOWN' ? 'bg-red-100' : 'bg-gray-100';

                  const iconTextClass = isLivePrinting ? 'text-purple-600' :
                    live?.reachable && live.state === 'idle' ? 'text-green-600' :
                    live?.reachable && live.state === 'warmup' ? 'text-blue-600' :
                    live?.reachable && live.state === 'error' ? 'text-red-600' :
                    printer.isPrinting ? 'text-purple-600' :
                    printer.status === 'OPERATIONAL' ? 'text-green-600' :
                    printer.status === 'DOWN' ? 'text-red-600' : 'text-gray-600';

                  return (
                    <div
                      key={printer.id}
                      className={`bg-white rounded-xl shadow-soft border overflow-hidden ${borderClass}`}
                    >
                      {/* Header */}
                      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg relative ${iconBgClass}`}>
                            <Printer className={`w-5 h-5 ${iconTextClass}`} />
                            {/* Network connectivity dot */}
                            {hasIp && (
                              <div className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
                                live?.reachable ? 'bg-green-500' : 'bg-red-500'
                              }`} title={live?.reachable ? `Connected (${printer.ipAddress})` : `Offline (${printer.ipAddress})`} />
                            )}
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">{printer.name}</h3>
                            <p className="text-xs text-gray-500">
                              {[printer.manufacturer, printer.model].filter(Boolean).join(' ') || printer.type}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(printer.status, printer.isPrinting, live)}
                          <span className={`text-sm font-medium ${getStatusColor(printer.status, printer.isPrinting, live)}`}>
                            {getStatusLabel(printer.status, printer.isPrinting, live)}
                          </span>
                          <button
                            onClick={() => removePrinterFromStation(printer.id)}
                            className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                            title="Remove from station"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Live Status Bar - shows when printer has IP and live data */}
                      {hasIp && live && (
                        <div className={`px-4 py-2 border-b ${
                          live.reachable ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'
                        }`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs">
                              {live.reachable ? (
                                <>
                                  <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                                  <span className="text-emerald-700 font-medium">
                                    {live.state === 'printing' ? 'Actively Printing' :
                                     live.state === 'idle' ? 'Online — Idle' :
                                     live.state === 'warmup' ? 'Warming Up...' :
                                     live.state === 'error' ? 'Error Detected' :
                                     'Connected'}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <WifiOff className="w-3.5 h-3.5 text-red-500" />
                                  <span className="text-red-600 font-medium">No Response</span>
                                </>
                              )}
                            </div>
                            <span className="text-[10px] text-gray-400">
                              {printer.ipAddress}
                            </span>
                          </div>
                          {/* Display message from printer */}
                          {live.stateMessage && (
                            <p className="text-[11px] text-gray-600 mt-1 truncate" title={live.stateMessage}>
                              {live.stateMessage}
                            </p>
                          )}
                          {/* Alerts */}
                          {live.alerts.length > 0 && (
                            <div className="mt-1 flex items-center gap-1 text-[11px] text-amber-700">
                              <AlertCircle className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{live.alerts[0]}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Ink/Supply Levels */}
                      {live?.supplies && live.supplies.length > 0 && (
                        <div className="px-4 py-2 border-b border-gray-100 bg-gray-50">
                          <div className="flex items-center gap-1.5 text-[10px] text-gray-500 mb-1.5">
                            <Droplets className="w-3 h-3" />
                            <span className="font-medium">Ink Levels</span>
                          </div>
                          <div className="flex gap-1.5">
                            {live.supplies.map((supply, i) => {
                              const inkColor = getInkColor(supply.name, supply.color);
                              const label = getInkLabel(supply.name);
                              const pct = supply.level >= 0 ? supply.level : 0;
                              const isLow = pct > 0 && pct <= 15;
                              const isEmpty = pct === 0 && supply.level >= 0;

                              return (
                                <div key={i} className="flex flex-col items-center flex-1 min-w-0" title={`${supply.name}: ${pct}%`}>
                                  <div className="w-full h-8 bg-gray-200 rounded-sm overflow-hidden relative">
                                    <div
                                      className={`absolute bottom-0 w-full rounded-sm transition-all ${isEmpty ? 'animate-pulse' : ''}`}
                                      style={{
                                        height: `${Math.max(pct, 2)}%`,
                                        backgroundColor: inkColor,
                                        opacity: isEmpty ? 0.3 : 0.85,
                                        border: supply.name.toLowerCase().includes('white') ? '1px solid #ccc' : 'none',
                                      }}
                                    />
                                    {isLow && (
                                      <div className="absolute inset-0 flex items-center justify-center">
                                        <AlertCircle className="w-3 h-3 text-red-500" />
                                      </div>
                                    )}
                                  </div>
                                  <span className="text-[9px] font-bold text-gray-600 mt-0.5 leading-none">{label}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* IP Configuration - show when no IP set */}
                      {!hasIp && (
                        <div className="px-4 py-2 border-b border-gray-100 bg-gray-50">
                          {editingIp === printer.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={ipInput}
                                onChange={(e) => setIpInput(e.target.value)}
                                placeholder="192.168.254.x"
                                className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && ipInput.trim()) setIpAddress(printer.id, ipInput.trim());
                                  if (e.key === 'Escape') { setEditingIp(null); setIpInput(''); }
                                }}
                              />
                              <button
                                onClick={() => { if (ipInput.trim()) setIpAddress(printer.id, ipInput.trim()); }}
                                className="px-2 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => { setEditingIp(null); setIpInput(''); }}
                                className="p-1 text-gray-400 hover:text-gray-600"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setEditingIp(printer.id); setIpInput(''); }}
                              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-primary-600"
                            >
                              <Settings className="w-3 h-3" />
                              <span>Set IP address for live monitoring</span>
                            </button>
                          )}
                        </div>
                      )}

                      {/* Current Job */}
                      {printingJob ? (
                        <div className="px-4 py-3 bg-purple-50 border-b border-purple-100">
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="font-medium text-purple-900">
                              #{printingJob.workOrder.orderNumber} — {printingJob.workOrder.customerName}
                            </span>
                          </div>
                          <p className="text-xs text-purple-700 mb-2 truncate">{printingJob.name}</p>
                          <div className="flex items-center justify-between text-xs text-purple-600 mb-2">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {printingJob.startedAt ? getElapsedTime(printingJob.startedAt) : 'Starting...'}
                              {printingJob.estimatedMinutes && ` / ~${printingJob.estimatedMinutes}m`}
                            </span>
                            {printingJob.materialType && <span>{printingJob.materialType}</span>}
                          </div>
                          <div className="w-full bg-purple-200 rounded-full h-2 mb-2 overflow-hidden">
                            <div className="bg-purple-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }} />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => updateJobStatus(printingJob.id, 'COMPLETED')}
                              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700">
                              <CheckCircle className="w-3 h-3" /> Complete
                            </button>
                            <button onClick={() => updateJobStatus(printingJob.id, 'DRYING')}
                              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium bg-amber-500 text-white rounded hover:bg-amber-600">
                              <Droplets className="w-3 h-3" /> Drying
                            </button>
                            <button onClick={() => updateJobStatus(printingJob.id, 'ON_HOLD')}
                              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium bg-yellow-500 text-white rounded hover:bg-yellow-600">
                              <Pause className="w-3 h-3" /> Pause
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className={`px-4 py-4 border-b border-gray-100 text-center ${
                          isLivePrinting ? 'bg-purple-50 border-purple-100' : 'bg-gray-50'
                        }`}>
                          {isLivePrinting ? (
                            <div>
                              <p className="text-sm text-purple-600 font-medium flex items-center justify-center gap-2">
                                <span className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
                                Printer is running (untracked job)
                              </p>
                              <p className="text-xs text-purple-400 mt-1">Drag a queued job here to track it</p>
                            </div>
                          ) : (
                            <p className="text-sm text-gray-400">No active print job</p>
                          )}
                        </div>
                      )}

                      {/* Drying Jobs */}
                      {dryingJobs.length > 0 && (
                        <div className="px-4 py-2 border-b border-gray-100">
                          <div className="flex items-center gap-2 text-xs text-amber-600 mb-1">
                            <Droplets className="w-3 h-3" />
                            <span className="font-medium">Drying ({dryingJobs.length})</span>
                          </div>
                          {dryingJobs.map((job) => (
                            <div key={job.id} className="flex items-center justify-between text-xs py-1">
                              <span className="text-gray-600">#{job.workOrder.orderNumber} — {job.workOrder.customerName}</span>
                              <button onClick={() => updateJobStatus(job.id, 'COMPLETED')} className="text-green-600 hover:text-green-700 font-medium">Done</button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Footer */}
                      <div className="px-4 py-2 flex items-center justify-between text-xs text-gray-400">
                        <div className="flex items-center gap-2">
                          {printer.location && <span>{printer.location}</span>}
                          {printer.ipAddress && (
                            <>
                              {printer.location && <span className="text-gray-300">·</span>}
                              <span className="font-mono text-[11px]">{printer.ipAddress}</span>
                            </>
                          )}
                        </div>
                        {live?.lastPolled && (
                          <span className="text-[10px]" title={`Last checked: ${new Date(live.lastPolled).toLocaleTimeString()}`}>
                            {live.reachable ? '● ' : '○ '}
                            {new Date(live.lastPolled).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Add Printer Modal */}
      {showAddPrinter && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { setShowAddPrinter(false); setAddingStation(null); }}>
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Add Printer to {STATION_LABELS[addingStation!] || addingStation}</h3>
                <p className="text-sm text-gray-500">Select a printer from Equipment</p>
              </div>
              <button onClick={() => { setShowAddPrinter(false); setAddingStation(null); }} className="p-1 text-gray-400 hover:text-gray-600 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 max-h-80 overflow-y-auto">
              {availablePrinters.length === 0 ? (
                <div className="text-center py-6">
                  <Printer className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">No unassigned printers available</p>
                  <p className="text-xs text-gray-400 mt-1">Add printers in the ERP Equipment page first (Type = "Printer")</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {availablePrinters.map((printer) => (
                    <button
                      key={printer.id}
                      onClick={() => assignPrinterToStation(printer.id, addingStation!)}
                      className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-100 rounded-lg">
                          <Printer className="w-4 h-4 text-gray-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{printer.name}</p>
                          <p className="text-xs text-gray-500">
                            {[printer.manufacturer, printer.model].filter(Boolean).join(' ') || 'Printer'}
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-400" />
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
