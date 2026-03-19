import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Settings,
  Building2,
  Mail,
  Bell,
  Clock,
  Sliders,
  Database,
  Server,
  Download,
  RefreshCw,
  Save,
  CheckCircle,
  AlertTriangle,
  Info,
  Shield,
  Tag,
} from 'lucide-react';
import { api } from '../lib/api';
import { PRIORITY_LABELS, STATION_DISPLAY_NAMES } from '@erp/shared';
import ValidateExcelListsCard from '../components/ValidateExcelListsCard';

type TabId = 'company' | 'branding' | 'defaults' | 'email' | 'notifications' | 'features' | 'system';

interface SystemSettings {
  id: string;
  companyName: string;
  companyLogo: string | null;
  companyAddress: string | null;
  companyCity: string | null;
  companyState: string | null;
  companyZip: string | null;
  companyPhone: string | null;
  companyEmail: string | null;
  companyWebsite: string | null;
  defaultPriority: number;
  defaultPaymentTerms: string;
  orderNumberPrefix: string;
  quoteNumberPrefix: string;
  autoAssignOrders: boolean;
  emailFromName: string;
  emailFromAddress: string | null;
  emailSignature: string | null;
  sendOrderCreatedEmail: boolean;
  sendOrderStatusEmail: boolean;
  sendOrderAssignedEmail: boolean;
  sendQuoteEmail: boolean;
  notifyOnNewOrder: boolean;
  notifyOnOrderDueSoon: boolean;
  dueSoonDays: number;
  notifyOnOverdue: boolean;
  businessHoursStart: string;
  businessHoursEnd: string;
  workDays: number[];
  enableTimeTracking: boolean;
  enableInventory: boolean;
  enableQuotes: boolean;
  enableCustomers: boolean;
  enableReprints: boolean;
  enableScheduling: boolean;
  // Brand Display Names
  brandDisplayNames: Record<string, string> | null;
  // Production List
  productionListPath: string | null;
  enableProductionListSync: boolean;
  // Network Drive
  networkDriveBasePath: string | null;
  networkDriveSafariPath: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SystemInfo {
  system: {
    version: string;
    nodeVersion: string;
    platform: string;
    arch: string;
    hostname: string;
    uptime: number;
    memoryUsage: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
    };
  };
  database: {
    users: number;
    orders: number;
    customers: number;
    quotes: number;
    inventoryItems: number;
    templates: number;
    ordersByStatus: Record<string, number>;
  };
  timestamp: string;
}

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'company', label: 'Company', icon: Building2 },
  { id: 'branding', label: 'Branding', icon: Tag },
  { id: 'defaults', label: 'Defaults', icon: Sliders },
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'features', label: 'Features', icon: Shield },
  { id: 'system', label: 'System', icon: Server },
];

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

// ─── Microsoft Email OAuth Connection Component ────────────────────────────
function MicrosoftEmailConnection() {
  const queryClient = useQueryClient();
  
  const { data: status, isLoading } = useQuery({
    queryKey: ['microsoft-oauth-status'],
    queryFn: async () => {
      const response = await api.get('/microsoft-oauth/status');
      return response.data.data as {
        connected: boolean;
        configured: boolean;
        email?: string;
        expiresAt?: string;
        connectedBy?: string;
      };
    },
    refetchInterval: 120000, // Only check OAuth status every 2 min
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const response = await api.get('/microsoft-oauth/auth-url');
      const { url } = response.data.data;
      
      // Open Microsoft login in a popup window
      const popup = window.open(
        url,
        'microsoft-oauth',
        'width=600,height=700,scrollbars=yes,resizable=yes'
      );

      // Listen for the callback message from the popup
      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Authentication timed out. Please try again.'));
        }, 120000); // 2 minute timeout

        const handler = (event: MessageEvent) => {
          if (event.data?.type === 'MS_OAUTH_SUCCESS') {
            clearTimeout(timeout);
            window.removeEventListener('message', handler);
            resolve();
          } else if (event.data?.type === 'MS_OAUTH_ERROR') {
            clearTimeout(timeout);
            window.removeEventListener('message', handler);
            reject(new Error(event.data.error || 'Authentication failed'));
          }
        };
        window.addEventListener('message', handler);

        // Also check if popup was closed without completing
        const checkClosed = setInterval(() => {
          if (popup && popup.closed) {
            clearInterval(checkClosed);
            clearTimeout(timeout);
            window.removeEventListener('message', handler);
            // Don't reject — user may have completed auth and popup auto-closed
            setTimeout(() => {
              queryClient.invalidateQueries({ queryKey: ['microsoft-oauth-status'] });
              resolve();
            }, 1000);
          }
        }, 500);
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['microsoft-oauth-status'] });
      toast.success('Microsoft Email connected successfully!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to connect Microsoft Email');
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      await api.post('/microsoft-oauth/disconnect');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['microsoft-oauth-status'] });
      toast.success('Microsoft Email disconnected');
    },
    onError: () => {
      toast.error('Failed to disconnect');
    },
  });

  if (isLoading) {
    return (
      <div className="border border-gray-200 rounded-lg p-4 animate-pulse">
        <div className="h-5 bg-gray-200 rounded w-48 mb-2" />
        <div className="h-4 bg-gray-200 rounded w-64" />
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg p-5 bg-gradient-to-r from-blue-50 to-white">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          {/* Microsoft Logo */}
          <div className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 21 21" className="w-6 h-6">
              <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
              <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
              <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
              <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
            </svg>
          </div>
          <div>
            <h3 className="text-md font-semibold text-gray-900">Microsoft 365 Email</h3>
            {status?.connected ? (
              <div className="mt-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-sm text-green-700 bg-green-100 px-2 py-0.5 rounded-full font-medium">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    Connected
                  </span>
                  <span className="text-sm text-gray-600">{status.email}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Sending emails via OAuth2 (XOAUTH2) — tokens auto-refresh
                </p>
              </div>
            ) : status?.configured ? (
              <p className="text-sm text-gray-600 mt-1">
                Azure app is configured. Click Connect to sign in with your Microsoft account.
                <br />
                <span className="text-xs text-amber-600">Note: An IT admin must grant admin consent for SMTP.Send permission before this will work.</span>
              </p>
            ) : (
              <p className="text-sm text-amber-700 mt-1">
                Not configured. Set <code className="bg-amber-100 px-1 rounded text-xs">MS_CLIENT_ID</code>,{' '}
                <code className="bg-amber-100 px-1 rounded text-xs">MS_CLIENT_SECRET</code>, and{' '}
                <code className="bg-amber-100 px-1 rounded text-xs">MS_TENANT_ID</code> in the server <code className="bg-amber-100 px-1 rounded text-xs">.env</code> file.
              </p>
            )}
          </div>
        </div>

        <div>
          {status?.connected ? (
            <button
              onClick={() => {
                if (confirm('Disconnect Microsoft Email? Emails will stop sending until reconnected.')) {
                  disconnectMutation.mutate();
                }
              }}
              disabled={disconnectMutation.isPending}
              className="px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              {disconnectMutation.isPending ? 'Disconnecting...' : 'Disconnect'}
            </button>
          ) : (
            <button
              onClick={() => connectMutation.mutate()}
              disabled={connectMutation.isPending || !status?.configured}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {connectMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Waiting for sign-in...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4" />
                  Connect Microsoft Email
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>('company');
  const [formData, setFormData] = useState<Partial<SystemSettings>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const response = await api.get('/settings');
      return response.data.data as SystemSettings;
    },
  });

  // Fetch system info
  const { data: systemInfo } = useQuery({
    queryKey: ['settings', 'system-info'],
    queryFn: async () => {
      const response = await api.get('/settings/system-info');
      return response.data.data as SystemInfo;
    },
    enabled: activeTab === 'system',
  });

  // Update form when settings load
  useEffect(() => {
    if (settings) {
      setFormData(settings);
      setHasChanges(false);
    }
  }, [settings]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: Partial<SystemSettings>) => {
      const response = await api.patch('/settings', data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Settings saved successfully');
      setHasChanges(false);
    },
    onError: () => {
      toast.error('Failed to save settings');
    },
  });

  // Reset mutation
  const resetMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/settings/reset');
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Settings reset to defaults');
    },
    onError: () => {
      toast.error('Failed to reset settings');
    },
  });

  const handleChange = (field: keyof SystemSettings, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    saveMutation.mutate(formData);
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
      resetMutation.mutate();
    }
  };

  const handleExport = async () => {
    try {
      const response = await api.get('/settings/export', { responseType: 'blob' });
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `erp-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Data exported successfully');
    } catch {
      toast.error('Failed to export data');
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-primary-500 to-cyan-500 rounded-xl text-white">
            <Settings className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Settings</h1>
            <p className="text-gray-500 mt-1">Configure your ERP system</p>
          </div>
        </div>
        <div className="flex gap-2">
          {hasChanges && (
            <button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="btn-primary flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>
      </div>

      {/* Unsaved changes banner */}
      {hasChanges && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
          <span className="text-amber-700">You have unsaved changes</span>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <div className="lg:w-64 flex-shrink-0">
          <nav className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                    activeTab === tab.id
                      ? 'bg-primary-50 text-primary-700 border-r-2 border-primary-500'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          {/* Company Tab */}
          {activeTab === 'company' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Company Information</h2>
                <p className="text-sm text-gray-500 mb-6">
                  This information appears on quotes, invoices, and email communications.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={formData.companyName ?? ''}
                    onChange={(e) => handleChange('companyName', e.target.value)}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={formData.companyPhone ?? ''}
                    onChange={(e) => handleChange('companyPhone', e.target.value)}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formData.companyEmail ?? ''}
                    onChange={(e) => handleChange('companyEmail', e.target.value)}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Website
                  </label>
                  <input
                    type="url"
                    value={formData.companyWebsite ?? ''}
                    onChange={(e) => handleChange('companyWebsite', e.target.value)}
                    className="input-field"
                    placeholder="https://"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Street Address
                  </label>
                  <input
                    type="text"
                    value={formData.companyAddress ?? ''}
                    onChange={(e) => handleChange('companyAddress', e.target.value)}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={formData.companyCity ?? ''}
                    onChange={(e) => handleChange('companyCity', e.target.value)}
                    className="input-field"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      State
                    </label>
                    <input
                      type="text"
                      value={formData.companyState ?? ''}
                      onChange={(e) => handleChange('companyState', e.target.value)}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ZIP Code
                    </label>
                    <input
                      type="text"
                      value={formData.companyZip ?? ''}
                      onChange={(e) => handleChange('companyZip', e.target.value)}
                      className="input-field"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-6 mt-6">
                <h3 className="text-md font-medium text-gray-900 mb-4">Business Hours</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={formData.businessHoursStart ?? '08:00'}
                      onChange={(e) => handleChange('businessHoursStart', e.target.value)}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      End Time
                    </label>
                    <input
                      type="time"
                      value={formData.businessHoursEnd ?? '17:00'}
                      onChange={(e) => handleChange('businessHoursEnd', e.target.value)}
                      className="input-field"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Work Days
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS_OF_WEEK.map((day) => (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => {
                          const current = formData.workDays ?? [1, 2, 3, 4, 5];
                          const updated = current.includes(day.value)
                            ? current.filter((d) => d !== day.value)
                            : [...current, day.value].sort();
                          handleChange('workDays', updated);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          (formData.workDays ?? [1, 2, 3, 4, 5]).includes(day.value)
                            ? 'bg-primary-100 text-primary-700'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {day.label.slice(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Branding Tab */}
          {activeTab === 'branding' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Brand Display Names</h2>
                <p className="text-sm text-gray-500 mb-6">
                  Customize how brand names appear throughout the application. Changes will apply to all users.
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-700">
                  <p className="font-medium">About Brand Names</p>
                  <p className="mt-1">
                    These display names are used throughout the app to identify orders from different company brands.
                    The internal codes remain unchanged for compatibility.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Wilde Signs Brand Name
                  </label>
                  <input
                    type="text"
                    value={(formData.brandDisplayNames as Record<string, string>)?.WILDE_SIGNS ?? 'Wilde Signs'}
                    onChange={(e) => {
                      const current = (formData.brandDisplayNames as Record<string, string>) ?? {
                        WILDE_SIGNS: 'Wilde Signs',
                        PORT_CITY_SIGNS: 'Port City Signs',
                      };
                      handleChange('brandDisplayNames', {
                        ...current,
                        WILDE_SIGNS: e.target.value,
                      });
                    }}
                    className="input-field"
                    placeholder="Wilde Signs"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Port City Signs Brand Name
                  </label>
                  <input
                    type="text"
                    value={(formData.brandDisplayNames as Record<string, string>)?.PORT_CITY_SIGNS ?? 'Port City Signs'}
                    onChange={(e) => {
                      const current = (formData.brandDisplayNames as Record<string, string>) ?? {
                        WILDE_SIGNS: 'Wilde Signs',
                        PORT_CITY_SIGNS: 'Port City Signs',
                      };
                      handleChange('brandDisplayNames', {
                        ...current,
                        PORT_CITY_SIGNS: e.target.value,
                      });
                    }}
                    className="input-field"
                    placeholder="Port City Signs"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Defaults Tab */}
          {activeTab === 'defaults' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Default Values</h2>
                <p className="text-sm text-gray-500 mb-6">
                  Set default values for new orders and quotes.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Default Priority
                  </label>
                  <select
                    value={formData.defaultPriority ?? 3}
                    onChange={(e) => handleChange('defaultPriority', parseInt(e.target.value))}
                    className="input-field"
                  >
                    {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Default Payment Terms
                  </label>
                  <select
                    value={formData.defaultPaymentTerms ?? 'Net 30'}
                    onChange={(e) => handleChange('defaultPaymentTerms', e.target.value)}
                    className="input-field"
                  >
                    <option value="Due on Receipt">Due on Receipt</option>
                    <option value="Net 15">Net 15</option>
                    <option value="Net 30">Net 30</option>
                    <option value="Net 45">Net 45</option>
                    <option value="Net 60">Net 60</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Order Number Prefix
                  </label>
                  <input
                    type="text"
                    value={formData.orderNumberPrefix ?? ''}
                    onChange={(e) => handleChange('orderNumberPrefix', e.target.value)}
                    className="input-field"
                    placeholder="e.g., WO-"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quote Number Prefix
                  </label>
                  <input
                    type="text"
                    value={formData.quoteNumberPrefix ?? 'Q-'}
                    onChange={(e) => handleChange('quoteNumberPrefix', e.target.value)}
                    className="input-field"
                    placeholder="e.g., Q-"
                  />
                </div>
              </div>

              <div className="border-t pt-6 mt-6">
                <h3 className="text-md font-medium text-gray-900 mb-4">Automation</h3>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.autoAssignOrders ?? false}
                    onChange={(e) => handleChange('autoAssignOrders', e.target.checked)}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700">
                      Auto-assign orders to creator
                    </span>
                    <p className="text-xs text-gray-500">
                      Automatically assign new orders to the user who creates them
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Email Tab */}
          {activeTab === 'email' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Email Settings</h2>
                <p className="text-sm text-gray-500 mb-6">
                  Configure email notifications and templates.
                </p>
              </div>

              {/* Microsoft Email Connection */}
              <MicrosoftEmailConnection />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    From Name
                  </label>
                  <input
                    type="text"
                    value={formData.emailFromName ?? ''}
                    onChange={(e) => handleChange('emailFromName', e.target.value)}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    From Email Address
                  </label>
                  <input
                    type="email"
                    value={formData.emailFromAddress ?? ''}
                    onChange={(e) => handleChange('emailFromAddress', e.target.value)}
                    className="input-field"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Signature
                  </label>
                  <textarea
                    value={formData.emailSignature ?? ''}
                    onChange={(e) => handleChange('emailSignature', e.target.value)}
                    className="input-field"
                    rows={3}
                    placeholder="Signature text that appears at the bottom of emails"
                  />
                </div>
              </div>

              <div className="border-t pt-6 mt-6">
                <h3 className="text-md font-medium text-gray-900 mb-4">Email Notifications</h3>
                <div className="space-y-4">
                  {[
                    { key: 'sendOrderCreatedEmail', label: 'Send email when order is created' },
                    { key: 'sendOrderStatusEmail', label: 'Send email when order status changes' },
                    { key: 'sendOrderAssignedEmail', label: 'Send email when order is assigned' },
                    { key: 'sendQuoteEmail', label: 'Send email for quote updates' },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(formData as Record<string, boolean>)[key] ?? true}
                        onChange={(e) => handleChange(key as keyof SystemSettings, e.target.checked)}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-700">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Notification Settings</h2>
                <p className="text-sm text-gray-500 mb-6">
                  Configure in-app notifications and alerts.
                </p>
              </div>

              <div className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.notifyOnNewOrder ?? true}
                    onChange={(e) => handleChange('notifyOnNewOrder', e.target.checked)}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700">
                      Notify on new orders
                    </span>
                    <p className="text-xs text-gray-500">
                      Send notifications when new orders are created
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.notifyOnOrderDueSoon ?? true}
                    onChange={(e) => handleChange('notifyOnOrderDueSoon', e.target.checked)}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700">
                      Notify when orders are due soon
                    </span>
                    <p className="text-xs text-gray-500">
                      Send reminders before order due dates
                    </p>
                  </div>
                </label>

                {formData.notifyOnOrderDueSoon && (
                  <div className="ml-8">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Days before due date
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={formData.dueSoonDays ?? 3}
                      onChange={(e) => handleChange('dueSoonDays', parseInt(e.target.value))}
                      className="input-field w-24"
                    />
                  </div>
                )}

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.notifyOnOverdue ?? true}
                    onChange={(e) => handleChange('notifyOnOverdue', e.target.checked)}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700">
                      Notify on overdue orders
                    </span>
                    <p className="text-xs text-gray-500">
                      Alert when orders pass their due date
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Features Tab */}
          {activeTab === 'features' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Feature Settings</h2>
                <p className="text-sm text-gray-500 mb-6">
                  Enable or disable system features.
                </p>
              </div>

              <div className="space-y-4">
                {[
                  { key: 'enableTimeTracking', label: 'Time Tracking', desc: 'Track time spent at each station' },
                  { key: 'enableInventory', label: 'Inventory Management', desc: 'Manage materials and supplies' },
                  { key: 'enableQuotes', label: 'Quotes/Estimates', desc: 'Create and manage quotes' },
                  { key: 'enableCustomers', label: 'Customer Database', desc: 'Maintain customer records' },
                  { key: 'enableReprints', label: 'Reprint Requests', desc: 'Track reprint requests and reasons' },
                  { key: 'enableScheduling', label: 'Production Scheduling', desc: 'Schedule orders on calendar' },
                  { key: 'enableProductionListSync', label: 'Production List Sync', desc: 'Allow importing data from the Excel Production List into the ERP. The ERP never modifies the Excel file.' },
                ].map(({ key, label, desc }) => (
                  <label key={key} className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={(formData as Record<string, boolean>)[key] ?? true}
                      onChange={(e) => handleChange(key as keyof SystemSettings, e.target.checked)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-gray-700">{label}</span>
                      <p className="text-xs text-gray-500">{desc}</p>
                    </div>
                    {(formData as Record<string, boolean>)[key] ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
                    )}
                  </label>
                ))}
              </div>

              {/* Production List Path */}
              <div className="mt-8 pt-6 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">Production List Directory</h3>
                <p className="text-xs text-gray-500 mb-3">
                  The server-side path to the folder containing Production List workbooks (e.g., <code className="bg-gray-100 px-1 rounded">C:\Users\Jake\OneDrive - Wilde Signs\Production List</code>). The ERP will automatically look for the next workday's file here.
                </p>
                <input
                  type="text"
                  value={(formData as Record<string, string>).productionListPath || ''}
                  onChange={(e) => handleChange('productionListPath' as keyof SystemSettings, e.target.value || null)}
                  placeholder="C:\Users\...\OneDrive - Wilde Signs\Production List"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              {/* Network Drive Base Path */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">Network Drive Base Path</h3>
                <p className="text-xs text-gray-500 mb-3">
                  UNC path or mapped drive to the customer files share (e.g., <code className="bg-gray-100 px-1 rounded">S:\</code> or <code className="bg-gray-100 px-1 rounded">\\SERVER\Share</code>). Used by Network Files to locate work order folders.
                </p>
                <input
                  type="text"
                  value={(formData as Record<string, string>).networkDriveBasePath || ''}
                  onChange={(e) => handleChange('networkDriveBasePath' as keyof SystemSettings, e.target.value || null)}
                  placeholder="S:\ or \\SERVER\Share"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              {/* Safari / Port City Signs Path */}
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">Safari / Port City Signs Path</h3>
                <p className="text-xs text-gray-500 mb-3">
                  Base path for Safari (Port City Signs) orders — used for 4-digit work order numbers. Defaults to <code className="bg-gray-100 px-1 rounded">BasePath\Safari</code> if left blank.
                </p>
                <input
                  type="text"
                  value={(formData as Record<string, string>).networkDriveSafariPath || ''}
                  onChange={(e) => handleChange('networkDriveSafariPath' as keyof SystemSettings, e.target.value || null)}
                  placeholder="S:\Safari (leave blank to auto-detect)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              {/* Validate Excel Lists */}
              <ValidateExcelListsCard />
            </div>
          )}

          {/* System Tab */}
          {activeTab === 'system' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">System Information</h2>
                <p className="text-sm text-gray-500 mb-6">
                  View system status and database statistics.
                </p>
              </div>

              {systemInfo && (
                <>
                  {/* Server Info */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                      <Server className="h-4 w-4" />
                      Server Information
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Version</p>
                        <p className="font-medium">{systemInfo.system.version}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Node.js</p>
                        <p className="font-medium">{systemInfo.system.nodeVersion}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Platform</p>
                        <p className="font-medium">{systemInfo.system.platform} ({systemInfo.system.arch})</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Uptime</p>
                        <p className="font-medium">{formatUptime(systemInfo.system.uptime)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Memory Usage */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                      <Info className="h-4 w-4" />
                      Memory Usage
                    </h3>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">RSS</p>
                        <p className="font-medium">{formatBytes(systemInfo.system.memoryUsage.rss)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Heap Total</p>
                        <p className="font-medium">{formatBytes(systemInfo.system.memoryUsage.heapTotal)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Heap Used</p>
                        <p className="font-medium">{formatBytes(systemInfo.system.memoryUsage.heapUsed)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Database Stats */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      Database Statistics
                    </h3>
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Users</p>
                        <p className="font-medium text-lg">{systemInfo.database.users}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Orders</p>
                        <p className="font-medium text-lg">{systemInfo.database.orders}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Customers</p>
                        <p className="font-medium text-lg">{systemInfo.database.customers}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Quotes</p>
                        <p className="font-medium text-lg">{systemInfo.database.quotes}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Inventory</p>
                        <p className="font-medium text-lg">{systemInfo.database.inventoryItems}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Templates</p>
                        <p className="font-medium text-lg">{systemInfo.database.templates}</p>
                      </div>
                    </div>
                  </div>

                  {/* Orders by Status */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-gray-900 mb-3">Orders by Status</h3>
                    <div className="flex flex-wrap gap-3">
                      {Object.entries(systemInfo.database.ordersByStatus).map(([status, count]) => (
                        <div key={status} className="bg-white rounded-lg px-3 py-2 shadow-sm">
                          <span className="text-xs text-gray-500">{status.replace('_', ' ')}</span>
                          <p className="font-semibold">{count}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Actions */}
              <div className="border-t pt-6 mt-6">
                <h3 className="text-md font-medium text-gray-900 mb-4">Data Management</h3>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleExport}
                    className="btn-secondary flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Export All Data
                  </button>
                  <button
                    onClick={handleReset}
                    className="btn-secondary text-red-600 hover:bg-red-50 flex items-center gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Reset to Defaults
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
