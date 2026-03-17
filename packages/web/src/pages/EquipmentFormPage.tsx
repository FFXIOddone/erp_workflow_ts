import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, Loader2, Wifi, WifiOff, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { Spinner } from '../components/Spinner';
import {
  EquipmentStatus,
  PrintingMethod,
  EQUIPMENT_STATUS_DISPLAY_NAMES,
  STATION_DISPLAY_NAMES,
  EQUIPMENT_TYPES,
} from '@erp/shared';
import { format } from 'date-fns';

const CONNECTION_TYPES = [
  { value: 'PING', label: 'Ping (ICMP)' },
  { value: 'SNMP', label: 'SNMP' },
  { value: 'HTTP', label: 'HTTP/HTTPS' },
  { value: 'SMB', label: 'SMB (Windows Share)' },
  { value: 'SSH', label: 'SSH' },
  { value: 'TCP', label: 'TCP Probe' },
];

interface FormData {
  name: string;
  type: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  station: string;
  status: string;
  location: string;
  purchaseDate: string;
  warrantyExpiry: string;
  notes: string;
  ipAddress: string;
  connectionType: string;
  snmpCommunity: string;
}

const initialFormData: FormData = {
  name: '',
  type: '',
  manufacturer: '',
  model: '',
  serialNumber: '',
  station: '',
  status: EquipmentStatus.OPERATIONAL,
  location: '',
  purchaseDate: '',
  warrantyExpiry: '',
  notes: '',
  ipAddress: '',
  connectionType: 'PING',
  snmpCommunity: 'public',
};

export default function EquipmentFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditing = Boolean(id);

  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  // Fetch existing equipment if editing
  const { data: equipment, isLoading } = useQuery({
    queryKey: ['equipment', id],
    queryFn: async () => {
      const res = await api.get(`/equipment/${id}`);
      return res.data.data;
    },
    enabled: isEditing,
  });

  // Populate form when equipment is loaded
  useEffect(() => {
    if (equipment) {
      setFormData({
        name: equipment.name || '',
        type: equipment.type || '',
        manufacturer: equipment.manufacturer || '',
        model: equipment.model || '',
        serialNumber: equipment.serialNumber || '',
        station: equipment.station || '',
        status: equipment.status || EquipmentStatus.OPERATIONAL,
        location: equipment.location || '',
        purchaseDate: equipment.purchaseDate 
          ? format(new Date(equipment.purchaseDate), 'yyyy-MM-dd') 
          : '',
        warrantyExpiry: equipment.warrantyExpiry 
          ? format(new Date(equipment.warrantyExpiry), 'yyyy-MM-dd') 
          : '',
        notes: equipment.notes || '',
        ipAddress: equipment.ipAddress || '',
        connectionType: equipment.connectionType || 'PING',
        snmpCommunity: equipment.snmpCommunity || 'public',
      });
    }
  }, [equipment]);

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        ...data,
        station: data.station || null,
        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate).toISOString() : null,
        warrantyExpiry: data.warrantyExpiry ? new Date(data.warrantyExpiry).toISOString() : null,
        ipAddress: data.ipAddress || null,
        connectionType: data.connectionType || null,
        snmpCommunity: data.snmpCommunity || null,
      };
      const res = await api.post('/equipment', payload);
      return res.data.data;
    },
    onSuccess: (data) => {
      toast.success('Equipment created');
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      navigate(`/equipment/${data.id}`);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to create equipment');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        ...data,
        station: data.station || null,
        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate).toISOString() : null,
        warrantyExpiry: data.warrantyExpiry ? new Date(data.warrantyExpiry).toISOString() : null,
        ipAddress: data.ipAddress || null,
        connectionType: data.connectionType || null,
        snmpCommunity: data.snmpCommunity || null,
      };
      const res = await api.put(`/equipment/${id}`, payload);
      return res.data.data;
    },
    onSuccess: () => {
      toast.success('Equipment updated');
      queryClient.invalidateQueries({ queryKey: ['equipment', id] });
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      navigate(`/equipment/${id}`);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update equipment');
    },
  });

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    if (!formData.type.trim()) {
      newErrors.type = 'Type is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    if (isEditing) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormData]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const [testResult, setTestResult] = useState<{
    reachable: boolean;
    state?: string;
    systemName?: string;
    systemDescription?: string;
  } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const handleTestConnection = async () => {
    if (!formData.ipAddress.trim()) {
      toast.error('Enter an IP address first');
      return;
    }

    // If editing existing equipment, use the connectivity endpoint
    if (isEditing && id) {
      setIsTesting(true);
      setTestResult(null);
      try {
        const res = await api.put(`/equipment/${id}/connectivity`, {
          ipAddress: formData.ipAddress,
          connectionType: formData.connectionType || 'PING',
          snmpCommunity: formData.snmpCommunity || 'public',
        });
        if (res.data.liveStatus) {
          setTestResult(res.data.liveStatus);
          if (res.data.liveStatus.reachable) {
            toast.success(`Device reachable${res.data.liveStatus.systemName ? ` — ${res.data.liveStatus.systemName}` : ''}`);
          } else {
            toast.error('Device not reachable');
          }
        } else {
          toast.success('Connection saved (no live status returned)');
          setTestResult({ reachable: false, state: 'unknown' });
        }
      } catch (err: any) {
        toast.error(err.response?.data?.message || 'Connection test failed');
        setTestResult({ reachable: false, state: 'error' });
      } finally {
        setIsTesting(false);
      }
    } else {
      // For new equipment, just do a quick connectivity check without saving
      toast('Save the equipment first, then test the connection', { icon: '💡' });
    }
  };

  if (isEditing && isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate(isEditing ? `/equipment/${id}` : '/equipment')}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditing ? 'Edit Equipment' : 'Add Equipment'}
          </h1>
          <p className="text-gray-500">
            {isEditing ? 'Update equipment information' : 'Add new equipment to track'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Equipment Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.name ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="e.g., Roland VG2-540"
              />
              {errors.name && (
                <p className="text-sm text-red-500 mt-1">{errors.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type <span className="text-red-500">*</span>
              </label>
              <select
                name="type"
                value={formData.type}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.type ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">Select type...</option>
                {EQUIPMENT_TYPES.map((type: string) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
                <option value="Other">Other</option>
              </select>
              {errors.type && (
                <p className="text-sm text-red-500 mt-1">{errors.type}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {(Object.values(EquipmentStatus) as string[]).map((status) => (
                  <option key={status} value={status}>
                    {EQUIPMENT_STATUS_DISPLAY_NAMES[status]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Station
              </label>
              <select
                name="station"
                value={formData.station}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">No station</option>
                {(Object.values(PrintingMethod) as string[]).map((method) => (
                  <option key={method} value={method}>
                    {STATION_DISPLAY_NAMES[method] || method}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location
              </label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Production Floor, Bay 2"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Equipment Details</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Manufacturer
              </label>
              <input
                type="text"
                name="manufacturer"
                value={formData.manufacturer}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Roland, HP, Epson"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Model
              </label>
              <input
                type="text"
                name="model"
                value={formData.model}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Model number"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Serial Number
              </label>
              <input
                type="text"
                name="serialNumber"
                value={formData.serialNumber}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
                placeholder="Serial number"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Purchase Date
              </label>
              <input
                type="date"
                name="purchaseDate"
                value={formData.purchaseDate}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Warranty Expiry
              </label>
              <input
                type="date"
                name="warrantyExpiry"
                value={formData.warrantyExpiry}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Network & Connection</h2>
            {testResult && (
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                testResult.reachable 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-red-100 text-red-700'
              }`}>
                {testResult.reachable ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                {testResult.reachable ? 'Reachable' : 'Unreachable'}
                {testResult.systemName && ` — ${testResult.systemName}`}
              </span>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                IP Address
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  name="ipAddress"
                  value={formData.ipAddress}
                  onChange={handleChange}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
                  placeholder="e.g., 192.168.254.42"
                />
                {isEditing && (
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={isTesting || !formData.ipAddress.trim()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm whitespace-nowrap"
                  >
                    {isTesting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4" />
                    )}
                    Test
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Connection Type
              </label>
              <select
                name="connectionType"
                value={formData.connectionType}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {CONNECTION_TYPES.map((ct) => (
                  <option key={ct.value} value={ct.value}>
                    {ct.label}
                  </option>
                ))}
              </select>
            </div>

            {formData.connectionType === 'SNMP' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SNMP Community String
                </label>
                <input
                  type="text"
                  name="snmpCommunity"
                  value={formData.snmpCommunity}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
                  placeholder="public"
                />
              </div>
            )}
          </div>

          {testResult && testResult.reachable && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm">
              <div className="font-medium text-green-800 mb-1">Connection Successful</div>
              <div className="text-green-700 space-y-0.5">
                {testResult.systemName && <div>Host: <span className="font-mono">{testResult.systemName}</span></div>}
                {testResult.state && testResult.state !== 'idle' && <div>State: {testResult.state}</div>}
              </div>
            </div>
          )}

          {testResult && !testResult.reachable && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm">
              <div className="font-medium text-red-800">Device Unreachable</div>
              <div className="text-red-600">Check the IP address and ensure the device is powered on and connected to the network.</div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Notes</h2>
          
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="Any additional notes about this equipment..."
          />
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate(isEditing ? `/equipment/${id}` : '/equipment')}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                {isEditing ? 'Save Changes' : 'Create Equipment'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
