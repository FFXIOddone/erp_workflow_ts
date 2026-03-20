import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Wrench,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Archive,
  Clock,
  Calendar,
  Settings2,
  ClipboardCheck,
  Plus,
  MoreVertical,
  Wifi,
  WifiOff,
  Cpu,
  Activity,
  Droplets,
  Server,
  MonitorSmartphone,
  HardDrive,
  Gauge,
  Scissors,
  Timer,
  Package,
  Network,
  RefreshCw,
  Printer,
  Layers,
  BarChart3,
  Zap,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { Spinner } from '../components/Spinner';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { FileSharesModal, WinServicesModal } from '../components/ConnectionModals';
import ZundLiveDataPanel from '../components/ZundLiveDataPanel';
import ThriveLiveDataPanel from '../components/ThriveLiveDataPanel';
import { IppPrintModal } from '../components/IppPrintModal';
import { ConnectivityCard } from '../components/ConnectivityCard';
import { CollapsibleSection } from '../components/CollapsibleSection';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/Tabs';
import {
  EquipmentStatus,
  EQUIPMENT_STATUS_DISPLAY_NAMES,
  EQUIPMENT_STATUS_COLORS,
  MAINTENANCE_FREQUENCY_DISPLAY_NAMES,
  DOWNTIME_REASON_DISPLAY_NAMES,
  DOWNTIME_REASON_COLORS,
  IMPACT_LEVEL_DISPLAY_NAMES,
  IMPACT_LEVEL_COLORS,
  STATION_DISPLAY_NAMES,
  MaintenanceFrequency,
  DowntimeReason,
  ImpactLevel,
} from '@erp/shared';
import { formatDistanceToNow, format } from 'date-fns';

export default function EquipmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [showAddSchedule, setShowAddSchedule] = useState(false);
  const [showLogMaintenance, setShowLogMaintenance] = useState(false);
  const [showReportDowntime, setShowReportDowntime] = useState(false);
  const [showFileShares, setShowFileShares] = useState(false);
  const [showWinServices, setShowWinServices] = useState(false);
  const [showIppPrint, setShowIppPrint] = useState(false);
  const [smbModalIp, setSmbModalIp] = useState<string>('');
  const [smbModalName, setSmbModalName] = useState<string>('');

  // Equipment record from DB
  const { data: equipment, isLoading, error } = useQuery({
    queryKey: ['equipment', id],
    queryFn: async () => {
      const res = await api.get(`/equipment/${id}`);
      return res.data.data;
    },
    enabled: !!id,
  });

  // Live detail (deep SNMP, Zund stats, port scans)
  const { data: liveDetail, isLoading: liveLoading, refetch: refetchLive } = useQuery({
    queryKey: ['equipment-live-detail', id],
    queryFn: async () => {
      const res = await api.get(`/equipment/${id}/live-detail`);
      return res.data.data;
    },
    enabled: !!id,
    refetchInterval: 60000, // Live hardware detail — no WS push for SNMP
    staleTime: 30000,
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/equipment/${id}`);
    },
    onSuccess: () => {
      toast.success('Equipment deleted');
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      navigate('/equipment');
    },
    onError: () => {
      toast.error('Failed to delete equipment');
    },
  });

  const statusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      await api.put(`/equipment/${id}/status`, { status: newStatus });
    },
    onSuccess: () => {
      toast.success('Status updated');
      queryClient.invalidateQueries({ queryKey: ['equipment', id] });
      queryClient.invalidateQueries({ queryKey: ['equipment-stats'] });
    },
    onError: () => {
      toast.error('Failed to update status');
    },
  });

  // Launch remote connection (RDP/VNC) on the ERP server
  const launchConnection = async (type: 'rdp' | 'vnc', targetIp?: string) => {
    try {
      const endpoint = type === 'rdp' ? 'launch-rdp' : 'launch-vnc';
      const params = targetIp ? { targetIp } : {};
      const res = await api.post(`/equipment/${id}/${endpoint}`, {}, { params });
      if (res.data.success) {
        toast.success(
          type === 'rdp'
            ? `Remote Desktop session launched to ${targetIp || equipment?.ipAddress}`
            : `VNC display session launched to ${targetIp || equipment?.ipAddress}`
        );
      }
    } catch (err: any) {
      toast.error(
        err.response?.data?.error ||
        `Failed to launch ${type === 'rdp' ? 'Remote Desktop' : 'VNC'} session`
      );
    }
  };

  // Open file shares modal (optionally for a different IP like Fiery)
  const openFileShares = (ip?: string, name?: string) => {
    setSmbModalIp(ip || equipment?.ipAddress || '');
    setSmbModalName(name || equipment?.name || '');
    setShowFileShares(true);
  };

  // Open win services modal (optionally for a different IP like Fiery)
  const openWinServices = (ip?: string, name?: string) => {
    setSmbModalIp(ip || equipment?.ipAddress || '');
    setSmbModalName(name || equipment?.name || '');
    setShowWinServices(true);
  };

  // Open IPP print modal
  const openIppPrint = (ip?: string, name?: string) => {
    setSmbModalIp(ip || equipment?.ipAddress || '');
    setSmbModalName(name || equipment?.name || '');
    setShowIppPrint(true);
  };

  const getStatusIcon = (status: string, size = 'h-5 w-5') => {
    switch (status) {
      case EquipmentStatus.OPERATIONAL:
        return <CheckCircle className={`${size} text-green-600`} />;
      case EquipmentStatus.MAINTENANCE:
        return <Wrench className={`${size} text-amber-600`} />;
      case EquipmentStatus.DOWN:
        return <XCircle className={`${size} text-red-600`} />;
      case EquipmentStatus.RETIRED:
        return <Archive className={`${size} text-gray-600`} />;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !equipment) {
    return (
      <div className="text-center py-12">
        <Settings2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-1">Equipment not found</h3>
        <Link to="/equipment" className="text-blue-600 hover:text-blue-700">
          Back to Equipment
        </Link>
      </div>
    );
  }

  const activeDowntime = equipment.downtimeEvents?.find((d: any) => !d.resolvedAt);
  const live = liveDetail?.live;
  const deep = liveDetail?.deep;
  const zund = liveDetail?.zund;
  const ports = liveDetail?.ports;
  const smbInfo = liveDetail?.smb;
  const ews = liveDetail?.ews;
  const vutek = liveDetail?.vutek;
  const fieryJobs = liveDetail?.fieryJobs as any[] | undefined;
  const isOnline = live?.reachable ?? false;
  const connType = (equipment.connectionType || '').toUpperCase();
  const hasIp = !!equipment.ipAddress;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/equipment')}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{equipment.name}</h1>
              {getStatusIcon(equipment.status, 'h-6 w-6')}
              {hasIp && (
                <span className={`flex items-center gap-1.5 text-sm font-medium ${
                  isOnline ? 'text-green-600' : 'text-red-500'
                }`}>
                  {isOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                  {isOnline
                    ? live?.state === 'printing' ? 'Printing'
                    : live?.state === 'idle' ? 'Online'
                    : live?.state || 'Online'
                    : 'Offline'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-gray-500">
              <span>{equipment.type}</span>
              {equipment.ipAddress && (
                <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{equipment.ipAddress}</span>
              )}
              {connType && (
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                  connType === 'SNMP' ? 'bg-purple-100 text-purple-700' :
                  connType === 'SMB' ? 'bg-sky-100 text-sky-700' :
                  connType === 'SSH' ? 'bg-emerald-100 text-emerald-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {connType}
                </span>
              )}
            </div>
            {/* Quick identity line: Network Name / S/N / P/N */}
            {(live?.systemName || ews?.identity?.serialNumber || ews?.identity?.productNumber || equipment.serialNumber) && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-gray-400 mt-0.5 font-mono">
                {live?.systemName && <span>Network: <span className="text-gray-600 font-semibold">{live.systemName}</span></span>}
                {(ews?.identity?.serialNumber || equipment.serialNumber) && <span>S/N: <span className="text-gray-600 font-semibold">{ews?.identity?.serialNumber || equipment.serialNumber}</span></span>}
                {ews?.identity?.productNumber && <span>P/N: <span className="text-gray-600 font-semibold">{ews?.identity?.productNumber}</span></span>}
                {ews?.identity?.firmwareVersion && <span>FW: <span className="text-gray-600 font-semibold">{ews?.identity?.firmwareVersion}</span></span>}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetchLive()}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
            title="Refresh live data"
          >
            <RefreshCw className={`h-5 w-5 ${liveLoading ? 'animate-spin' : ''}`} />
          </button>
          <div className="relative group">
            <button className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-50">
              <MoreVertical className="h-4 w-4" />
              Change Status
            </button>
            <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              {(Object.values(EquipmentStatus) as string[]).map((status) => (
                <button
                  key={status}
                  onClick={() => statusMutation.mutate(status)}
                  disabled={equipment.status === status}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {getStatusIcon(status, 'h-4 w-4')}
                  {EQUIPMENT_STATUS_DISPLAY_NAMES[status]}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => navigate(`/equipment/${id}/edit`)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Edit className="h-4 w-4" />
            Edit
          </button>
          <button
            onClick={() => setDeleteOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Active Downtime Alert */}
      {activeDowntime && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium text-red-800">Active Downtime</h3>
              <p className="text-sm text-red-700 mt-1">
                {DOWNTIME_REASON_DISPLAY_NAMES[activeDowntime.reason]} - {activeDowntime.description}
              </p>
              <p className="text-sm text-red-600 mt-1">
                Started {formatDistanceToNow(new Date(activeDowntime.startedAt), { addSuffix: true })}
              </p>
            </div>
            <ResolveDowntimeButton downtimeId={activeDowntime.id} equipmentId={id!} />
          </div>
        </div>
      )}

      {/* Status + Station Badges */}
      <div className="flex items-center gap-4">
        <span
          className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium"
          style={{
            backgroundColor: `${EQUIPMENT_STATUS_COLORS[equipment.status]}20`,
            color: EQUIPMENT_STATUS_COLORS[equipment.status],
          }}
        >
          {EQUIPMENT_STATUS_DISPLAY_NAMES[equipment.status]}
        </span>
        {equipment.station && (
          <span className="text-sm text-gray-500">
            Station: {STATION_DISPLAY_NAMES[equipment.station] || equipment.station}
          </span>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="live">
            Live Data {hasIp && isOnline && <span className="ml-1 h-2 w-2 rounded-full bg-green-500 inline-block" />}
          </TabsTrigger>
          <TabsTrigger value="schedules">
            Maintenance ({equipment.maintenanceSchedules?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="downtime">
            Downtime ({equipment.downtimeEvents?.length || 0})
          </TabsTrigger>
        </TabsList>

        {/* ==================== OVERVIEW TAB ==================== */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Equipment Details */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-gray-400" />
                Equipment Details
              </h2>
              <dl className="space-y-3">
                {([
                  ['Name', equipment.name, false],
                  ['Type', equipment.type, false],
                  ['Manufacturer', equipment.manufacturer, false],
                  ['Model', equipment.model, false],
                  ['Serial Number', equipment.serialNumber, true],
                  ['Location', equipment.location, false],
                  ['IP Address', equipment.ipAddress, true],
                  ['Connection', equipment.connectionType, false],
                  ['Purchase Date', equipment.purchaseDate ? format(new Date(equipment.purchaseDate), 'MMM d, yyyy') : null, false],
                  ['Warranty', equipment.warrantyExpiry ? format(new Date(equipment.warrantyExpiry), 'MMM d, yyyy') : null, false],
                ] as [string, string | null, boolean][]).filter(([, value]) => value).map(([label, value, mono]) => (
                  <div key={label} className="flex justify-between">
                    <dt className="text-gray-500">{label}</dt>
                    <dd className={`text-gray-900 ${mono ? 'font-mono text-sm' : ''}`}>{value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Zap className="h-5 w-5 text-gray-400" />
                Quick Actions
              </h2>
              <div className="grid grid-cols-1 gap-3">
                <button
                  onClick={() => { setActiveTab('schedules'); setShowAddSchedule(true); }}
                  className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left"
                >
                  <Calendar className="h-5 w-5 text-blue-600" />
                  <div>
                    <div className="font-medium text-gray-900">Add Maintenance Schedule</div>
                    <div className="text-sm text-gray-500">Set up recurring maintenance</div>
                  </div>
                </button>
                <button
                  onClick={() => setShowLogMaintenance(true)}
                  className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left"
                >
                  <ClipboardCheck className="h-5 w-5 text-green-600" />
                  <div>
                    <div className="font-medium text-gray-900">Log Maintenance</div>
                    <div className="text-sm text-gray-500">Record maintenance performed</div>
                  </div>
                </button>
                <button
                  onClick={() => { setActiveTab('downtime'); setShowReportDowntime(true); }}
                  className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left"
                >
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  <div>
                    <div className="font-medium text-gray-900">Report Downtime</div>
                    <div className="text-sm text-gray-500">Log equipment issue</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Network Info */}
            {hasIp && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Network className="h-5 w-5 text-gray-400" />
                  Network
                </h2>
                <dl className="space-y-3">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Status</dt>
                    <dd className={`font-medium ${isOnline ? 'text-green-600' : 'text-red-500'}`}>
                      {isOnline ? 'Online' : 'Offline'}
                    </dd>
                  </div>
                  {live?.systemName && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Hostname</dt>
                      <dd className="text-gray-900 font-mono text-sm">{live.systemName}</dd>
                    </div>
                  )}
                  {live?.systemDescription && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">System</dt>
                      <dd className="text-gray-900 text-sm max-w-xs truncate" title={live.systemDescription}>
                        {live.systemDescription}
                      </dd>
                    </div>
                  )}
                  {deep?.uptime && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Uptime</dt>
                      <dd className="text-gray-900">{deep.uptime}</dd>
                    </div>
                  )}
                  {live?.lastPolled && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Last Polled</dt>
                      <dd className="text-gray-500 text-sm">
                        {formatDistanceToNow(new Date(live.lastPolled), { addSuffix: true })}
                      </dd>
                    </div>
                  )}
                  {ports && (
                    <div className="pt-2 border-t border-gray-100">
                      <dt className="text-gray-500 mb-2">Open Ports</dt>
                      <dd className="flex flex-wrap gap-2">
                        {Object.entries(ports as Record<string, boolean>).filter(([, open]) => open).map(([port]) => (
                          <span key={port} className="px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs font-medium uppercase">
                            {port}
                          </span>
                        ))}
                        {Object.entries(ports as Record<string, boolean>).filter(([, open]) => !open).map(([port]) => (
                          <span key={port} className="px-2 py-0.5 bg-gray-50 text-gray-400 rounded text-xs font-medium uppercase line-through">
                            {port}
                          </span>
                        ))}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            {/* Notes */}
            {equipment.notes && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Notes</h2>
                <p className="text-gray-700 whitespace-pre-wrap">{equipment.notes}</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ==================== LIVE DATA TAB ==================== */}
        <TabsContent value="live">
          {!hasIp ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
              <WifiOff className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">No IP Address Configured</h3>
              <p className="text-gray-500 mb-4">
                Set an IP address and connection type to see live data from this equipment.
              </p>
              <button
                onClick={() => navigate(`/equipment/${id}/edit`)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Edit className="h-4 w-4" />
                Configure Connectivity
              </button>
            </div>
          ) : liveLoading && !liveDetail ? (
            <div className="flex items-center justify-center h-64">
              <Spinner size="lg" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* ---- Connection Summary Banner ---- */}
              <div className={`rounded-lg border p-4 flex items-center justify-between ${
                isOnline ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-center gap-3">
                  {isOnline
                    ? <Wifi className="h-6 w-6 text-green-600" />
                    : <WifiOff className="h-6 w-6 text-red-500" />}
                  <div>
                    <div className={`font-semibold text-lg ${isOnline ? 'text-green-800' : 'text-red-800'}`}>
                      {isOnline ? 'Connected' : 'Unreachable'} — {equipment.ipAddress}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600 mt-0.5">
                      <span>Protocol: <span className="font-medium">{connType || 'PING'}</span></span>
                      {live?.systemName && <span>Host: <span className="font-mono font-medium">{live.systemName}</span></span>}
                      {live?.lastPolled && (
                        <span>Polled: <span className="font-medium">{formatDistanceToNow(new Date(live.lastPolled), { addSuffix: true })}</span></span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => refetchLive()}
                  className={`p-2.5 rounded-lg border transition-all ${
                    isOnline ? 'border-green-300 hover:bg-green-100 text-green-700' : 'border-red-300 hover:bg-red-100 text-red-600'
                  }`}
                  title="Refresh live data now"
                >
                  <RefreshCw className={`h-5 w-5 ${liveLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* SNMP Printer Data */}
              {connType === 'SNMP' && live && (
                <>
                  {/* State & Counters Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatusCard
                      icon={<Printer className="h-5 w-5" />}
                      label="Printer State"
                      value={
                        live.state === 'printing' ? 'Printing' :
                        live.state === 'idle' ? 'Idle' :
                        live.state === 'warmup' ? 'Warming Up' :
                        live.state === 'drying' ? 'Drying' :
                        live.state === 'paused' ? 'Paused' :
                        live.state === 'error' ? 'Error' :
                        live.state
                      }
                      color={
                        live.state === 'printing' ? 'blue' :
                        live.state === 'idle' ? 'green' :
                        live.state === 'error' ? 'red' :
                        live.state === 'warmup' || live.state === 'drying' ? 'amber' : 'gray'
                      }
                      sub={live.stateMessage || deep?.consoleDisplay || undefined}
                    />
                    <StatusCard
                      icon={<Clock className="h-5 w-5" />}
                      label="Uptime"
                      value={deep?.uptime || 'N/A'}
                      color="gray"
                      sub={deep?.uptimeTicks != null ? `${(deep.uptimeTicks / 100).toLocaleString()}s total` : undefined}
                    />
                    {ews?.media ? (
                      <StatusCard
                        icon={<Package className="h-5 w-5" />}
                        label="Media"
                        value={ews.media.width || 'N/A'}
                        color="blue"
                        sub={ews.media.type || undefined}
                      />
                    ) : (
                      <StatusCard
                        icon={<Layers className="h-5 w-5" />}
                        label="Total Pages"
                        value={deep?.pageCount != null ? deep.pageCount.toLocaleString() : 'N/A'}
                        color="gray"
                        sub={deep?.pageCount != null ? 'Lifetime page counter' : 'OID not supported'}
                      />
                    )}
                    <StatusCard
                      icon={<HardDrive className="h-5 w-5" />}
                      label="Cover Status"
                      value={deep?.coverStatus || 'N/A'}
                      color={deep?.coverStatus === 'Closed' ? 'green' : deep?.coverStatus === 'Open' ? 'amber' : 'gray'}
                      sub={deep?.coverStatus ? `prtCoverStatus = ${deep.coverStatus}` : 'OID not reported'}
                    />
                  </div>

                  {/* Ink/Supply Levels — Verbose */}
                  {live.supplies && live.supplies.length > 0 && (() => {
                    const lowSupplies = live.supplies.filter((s: any) => s.level >= 0 && s.level <= 20);
                    return (
                    <CollapsibleSection
                      title="Ink & Supply Levels"
                      icon={<Droplets className="h-5 w-5 text-gray-400" />}
                      badge={
                        <span className="text-xs text-gray-400 font-normal ml-1">
                          {live.supplies.length} suppl{live.supplies.length === 1 ? 'y' : 'ies'}
                          {lowSupplies.length > 0 && <span className="ml-2 text-amber-600 font-medium">{lowSupplies.length} low</span>}
                        </span>
                      }
                      subtitle="Source: prtMarkerSuppliesTable (OID 1.3.6.1.2.1.43.11)"
                      defaultOpen={false}
                      warningContent={lowSupplies.length > 0 ? (
                        <div className="space-y-2">
                          {lowSupplies.map((supply: any, i: number) => {
                            const isCritical = supply.level <= 10;
                            return (
                              <div key={i} className={`flex items-center gap-3 p-2 rounded-lg ${
                                isCritical ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'
                              }`}>
                                {(supply.colorHex || supply.color) && (
                                  <div className="h-3 w-3 rounded-full border border-gray-300" style={{ backgroundColor: supply.colorHex || supply.color }} />
                                )}
                                <span className="text-sm font-medium flex-1">{supply.name}</span>
                                <div className="w-20 bg-gray-200 rounded-full h-2 overflow-hidden">
                                  <div className="h-full rounded-full" style={{
                                    width: `${Math.max(supply.level, 2)}%`,
                                    backgroundColor: supply.colorHex || supply.color || (isCritical ? '#dc2626' : '#d97706'),
                                  }} />
                                </div>
                                <span className={`text-sm font-bold w-12 text-right ${isCritical ? 'text-red-600' : 'text-amber-600'}`}>{supply.level}%</span>
                                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${isCritical ? 'bg-red-200 text-red-700' : 'bg-amber-200 text-amber-700'}`}>
                                  {isCritical ? 'CRIT' : 'LOW'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : undefined}
                    >
                      <div className="space-y-4">
                        {live.supplies.map((supply: any, i: number) => {
                          const level = supply.level;
                          const isLow = level >= 0 && level <= 20;
                          const isCritical = level >= 0 && level <= 10;
                          return (
                            <div key={i} className={`border rounded-lg p-4 ${
                              isCritical ? 'border-red-200 bg-red-50' :
                              isLow ? 'border-amber-200 bg-amber-50' :
                              'border-gray-100'
                            }`}>
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                  {supply.colorHex || supply.color ? (
                                    <div className="h-6 w-6 rounded-full border border-gray-200" style={{ backgroundColor: supply.colorHex || supply.color }} />
                                  ) : (
                                    <Droplets className="h-5 w-5 text-gray-400" />
                                  )}
                                  <div>
                                    <span className="font-medium text-gray-900">{supply.name}</span>
                                    <span className="text-xs text-gray-400 ml-2">({supply.supplyType || supply.type || 'supply'})</span>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className={`text-2xl font-bold ${
                                    isCritical ? 'text-red-600' :
                                    isLow ? 'text-amber-600' :
                                    level >= 0 ? 'text-gray-900' : 'text-gray-400'
                                  }`}>
                                    {level >= 0 ? `${level}%` : level === -3 ? 'OK' : '—'}
                                  </span>
                                  {isCritical && <div className="text-xs text-red-600 font-medium">CRITICAL</div>}
                                  {isLow && !isCritical && <div className="text-xs text-amber-600 font-medium">LOW</div>}
                                </div>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-5 overflow-hidden mb-2">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${level >= 0 ? Math.max(level, 2) : 0}%`,
                                    backgroundColor: supply.colorHex || supply.color || (isCritical ? '#dc2626' : isLow ? '#d97706' : '#6b7280'),
                                  }}
                                />
                              </div>
                              <div className="flex justify-between text-xs text-gray-500">
                                <span>Type: {supply.supplyType || supply.type || 'N/A'}</span>
                                <span>
                                  Raw: {supply.rawLevel ?? supply.currentLevel ?? '?'} / {supply.rawMax ?? supply.maxCapacity ?? '?'} units
                                </span>
                                {supply.colorHex && <span>Color: {supply.colorHex}</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CollapsibleSection>
                    );
                  })()}

                  {/* Media / Input Trays — Verbose */}
                  {deep?.mediaTrays && deep.mediaTrays.length > 0 && (
                    <CollapsibleSection
                      title="Media / Input Trays"
                      icon={<Package className="h-5 w-5 text-gray-400" />}
                      badge={<span className="text-xs text-gray-400 font-normal ml-1">{deep.mediaTrays.length} tray{deep.mediaTrays.length === 1 ? '' : 's'}</span>}
                      subtitle="Source: prtInputTable (OID 1.3.6.1.2.1.43.8)"
                      defaultOpen={false}
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {deep.mediaTrays.map((tray: any, i: number) => {
                          const levelPct = tray.maxCapacity > 0 && tray.currentLevel >= 0
                            ? Math.round((tray.currentLevel / tray.maxCapacity) * 100)
                            : tray.currentLevel === -3 ? 100 : null; // -3 means "sufficient"
                          return (
                            <div key={i} className="border border-gray-100 rounded-lg p-4">
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-medium text-gray-900">{tray.name}</span>
                                {levelPct != null && (
                                  <span className={`text-lg font-bold ${levelPct < 20 ? 'text-amber-600' : 'text-gray-900'}`}>{levelPct}%</span>
                                )}
                              </div>
                              {levelPct != null && (
                                <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden mb-2">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      levelPct < 20 ? 'bg-amber-500' : 'bg-blue-500'
                                    }`}
                                    style={{ width: `${Math.max(levelPct, 2)}%` }}
                                  />
                                </div>
                              )}
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500">
                                <span>Current Level: <span className="font-medium text-gray-700">{tray.currentLevel}</span></span>
                                <span>Max Capacity: <span className="font-medium text-gray-700">{tray.maxCapacity}</span></span>
                                {(tray.width || tray.height) && (
                                  <span className="col-span-2">
                                    Media Dimensions: <span className="font-medium text-gray-700">
                                      {tray.width ? `${(tray.width / 10).toFixed(0)}mm` : '?'} × {tray.height ? `${(tray.height / 10).toFixed(0)}mm` : '?'}
                                    </span>
                                    {tray.width && tray.height && (
                                      <span className="text-gray-400 ml-1">
                                        ({(tray.width / 254).toFixed(1)}" × {(tray.height / 254).toFixed(1)}")
                                      </span>
                                    )}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CollapsibleSection>
                  )}

                  {/* Alerts — Collapsible */}
                  {(() => {
                    const allAlerts = deep?.alertSeverities || [];
                    const rawAlerts = (live.alerts || []).filter((a: string) =>
                      !allAlerts.some((as: any) => as.description === a)
                    );
                    const totalCount = allAlerts.length + rawAlerts.length;
                    const critCount = allAlerts.filter((a: any) => a.severity >= 4).length;
                    const warnCount = allAlerts.filter((a: any) => a.severity >= 3 && a.severity < 4).length;
                    const infoCount = totalCount - critCount - warnCount;

                    if (totalCount === 0) {
                      return (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
                          <CheckCircle className="h-5 w-5 text-green-600" />
                          <span className="text-green-800 font-medium">No active alerts — printer operating normally</span>
                        </div>
                      );
                    }

                    return (
                      <CollapsibleSection
                        title="Active Printer Alerts"
                        icon={<AlertTriangle className="h-5 w-5 text-amber-500" />}
                        badge={
                          <span className="flex items-center gap-2 text-xs font-normal ml-1">
                            {critCount > 0 && <span className="px-1.5 py-0.5 rounded bg-red-200 text-red-700 font-bold">{critCount} critical</span>}
                            {warnCount > 0 && <span className="px-1.5 py-0.5 rounded bg-amber-200 text-amber-700 font-bold">{warnCount} warning</span>}
                            {infoCount > 0 && <span className="px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 font-bold">{infoCount} info</span>}
                          </span>
                        }
                        subtitle={`Source: prtAlertTable (OID 1.3.6.1.2.1.43.18) · ${totalCount} alert${totalCount === 1 ? '' : 's'}`}
                        defaultOpen={false}
                      >
                        <div className="space-y-2">
                          {allAlerts.map((alert: any, i: number) => {
                            const sevLabel = alert.severity >= 4 ? 'CRITICAL' : alert.severity >= 3 ? 'WARNING' : alert.severity === 2 ? 'INFO' : 'OTHER';
                            return (
                              <div key={i} className={`flex items-center justify-between gap-3 p-3 rounded-lg ${
                                alert.severity >= 4 ? 'bg-red-50 text-red-800 border border-red-200' :
                                alert.severity >= 3 ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                                'bg-gray-50 text-gray-700 border border-gray-200'
                              }`}>
                                <div className="flex items-center gap-3">
                                  <AlertTriangle className={`h-4 w-4 flex-shrink-0 ${
                                    alert.severity >= 4 ? 'text-red-500' :
                                    alert.severity >= 3 ? 'text-amber-500' : 'text-gray-400'
                                  }`} />
                                  <span className="text-sm">{alert.description}</span>
                                </div>
                                <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                                  alert.severity >= 4 ? 'bg-red-200 text-red-800' :
                                  alert.severity >= 3 ? 'bg-amber-200 text-amber-800' :
                                  'bg-gray-200 text-gray-700'
                                }`}>
                                  {sevLabel} ({alert.severity})
                                </span>
                              </div>
                            );
                          })}
                          {rawAlerts.map((alert: string, i: number) => (
                            <div key={`a-${i}`} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 text-gray-700 border border-gray-200">
                              <AlertTriangle className="h-4 w-4 flex-shrink-0 text-gray-400" />
                              <span className="text-sm">{alert}</span>
                              <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded ml-auto">RAW</span>
                            </div>
                          ))}
                        </div>
                      </CollapsibleSection>
                    );
                  })()}
                </>
              )}

              {/* ==================== HP LATEX EWS DATA ==================== */}
              {ews && ews.available && (
                <EWSPanel ews={ews} />
              )}

              {/* ==================== VUTEK GS3250LX PRO DATA ==================== */}
              {vutek && vutek.available && (
                <VUTEkPanel
                  vutek={vutek}
                  fieryJobs={fieryJobs}
                  onLaunchConnection={launchConnection}
                  onOpenFileShares={openFileShares}
                  onOpenWinServices={openWinServices}
                />
              )}

              {/* Zund Cutter Data — New Live Data Panel */}
              {(() => {
                const nameLower = (equipment.name || '').toLowerCase();
                const isZund = nameLower.includes('zund') || nameLower.includes('cutter');
                if (!isZund) return null;
                const zId = nameLower.includes('2') || nameLower.includes('second')
                  ? 'zund2'
                  : 'zund1';
                return <ZundLiveDataPanel zundId={zId} />;
              })()}

              {/* Thrive RIP Station — Print Queue Data */}
              {equipment.ipAddress && ['192.168.254.53', '192.168.254.77'].includes(equipment.ipAddress) && (
                <ThriveLiveDataPanel machineIp={equipment.ipAddress} />
              )}

              {/* ==================== UNIFIED CONNECTIVITY CARD ==================== */}
              {/* Skip for VUTEk — it has its own dual-device connectivity panel */}
              {hasIp && ports && !(vutek && vutek.available) && (
                <ConnectivityCard
                  ports={ports as Record<string, boolean>}
                  ipAddress={equipment.ipAddress}
                  hostname={smbInfo?.hostname}
                  equipmentName={equipment.name}
                  isOnline={isOnline}
                  connectionType={connType || 'PING'}
                  onLaunchConnection={launchConnection}
                  onOpenFileShares={openFileShares}
                  onOpenWinServices={openWinServices}
                  onOpenIppPrint={openIppPrint}
                />
              )}

              {/* No port data yet (still loading or IP just added) */}
              {hasIp && !ports && !vutek?.available && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
                  <Network className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-lg font-medium text-gray-700">
                    {isOnline ? 'Device Online — Scanning Ports...' : 'Device Offline'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {isOnline
                      ? 'Port scan results will appear on next refresh'
                      : `No response from ${equipment.ipAddress}`}
                  </p>
                </div>
              )}

              {/* Live data error fallback */}
              {live?.errorMessage && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-red-800">
                    <XCircle className="h-5 w-5" />
                    <span className="font-medium">Connection Error</span>
                  </div>
                  <p className="text-sm text-red-700 mt-1 font-mono">{live.errorMessage}</p>
                </div>
              )}

              {/* ---- Technical Reference (moved to bottom) ---- */}
              {/* System Identity */}
              {(live?.systemName || live?.systemDescription || deep?.uptime) && (
                <CollapsibleSection
                  title="System Identity"
                  icon={<Cpu className="h-5 w-5 text-gray-400" />}
                  subtitle={live?.systemName || equipment.ipAddress || undefined}
                  defaultOpen={false}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                    <DataRow label="sysName" value={live?.systemName} mono />
                    <DataRow label="sysUpTime" value={deep?.uptime} sub={deep?.uptimeTicks != null ? `${deep.uptimeTicks.toLocaleString()} ticks (centiseconds)` : undefined} />
                    <DataRow label="sysDescr" value={live?.systemDescription} className="md:col-span-2" />
                    <DataRow label="IP Address" value={equipment.ipAddress} mono />
                    <DataRow label="Connection Type" value={connType || 'N/A'} />
                    {liveDetail?.snmpMeta && (
                      <>
                        <DataRow label="SNMP Protocol" value={liveDetail.snmpMeta.protocol} />
                        <DataRow label="Community String" value={liveDetail.snmpMeta.community} mono />
                        <DataRow label="Poll Timestamp" value={liveDetail.snmpMeta.pollTimestamp ? format(new Date(liveDetail.snmpMeta.pollTimestamp), 'MMM d, yyyy h:mm:ss a') : null} />
                      </>
                    )}
                  </div>
                </CollapsibleSection>
              )}

              {/* SNMP OID Reference */}
              {liveDetail?.snmpMeta && (
                <CollapsibleSection
                  title="SNMP Data Source Reference"
                  icon={<HardDrive className="h-5 w-5 text-gray-400" />}
                  subtitle="Raw OID values and poll metadata"
                  defaultOpen={false}
                >
                <RawDataPanel
                  title=""
                  data={{
                    'Protocol': liveDetail.snmpMeta.protocol,
                    'Community': liveDetail.snmpMeta.community,
                    'Poll Time': liveDetail.snmpMeta.pollTimestamp,
                    '': '─── OIDs Queried ───',
                    ...Object.fromEntries(
                      Object.entries(liveDetail.snmpMeta.oids || {}).map(([k, v]) => [`OID: ${k}`, v])
                    ),
                    '──': '─── Raw Values ───',
                    'sysName': live?.systemName || '(empty)',
                    'sysDescr': live?.systemDescription || '(empty)',
                    'sysUpTime (ticks)': deep?.uptimeTicks?.toString() || '(empty)',
                    'hrPrinterStatus': live?.state || '(empty)',
                    'prtCoverStatus': deep?.coverStatus || '(empty)',
                    'prtMarkerCounter': deep?.pageCount?.toString() || '(empty)',
                    'prtConsoleDisplayBufferText': deep?.consoleDisplay || '(empty)',
                    'Supply Count': live?.supplies?.length?.toString() || '0',
                    'Media Tray Count': deep?.mediaTrays?.length?.toString() || '0',
                    'Alert Count': ((deep?.alertSeverities?.length || 0) + (live?.alerts?.length || 0)).toString(),
                  }}
                />
                </CollapsibleSection>
              )}

              {/* Raw API Response */}
              {liveDetail && (
                <RawDataPanel
                  title="Full API Response (Debug)"
                  data={Object.fromEntries(
                    Object.entries(liveDetail).filter(([k]) => k !== 'snmpMeta').map(([key, val]) => [
                      key,
                      typeof val === 'object' && val !== null ? JSON.stringify(val, null, 0) : String(val ?? '(null)')
                    ])
                  )}
                />
              )}
            </div>
          )}
        </TabsContent>

        {/* ==================== MAINTENANCE TAB ==================== */}
        <TabsContent value="schedules">
          <div className="space-y-6">
            <MaintenanceSchedulesTab
              schedules={equipment.maintenanceSchedules || []}
              equipmentId={id!}
              showAdd={showAddSchedule}
              onCloseAdd={() => setShowAddSchedule(false)}
            />
            <MaintenanceLogsTab
              logs={equipment.maintenanceLogs || []}
              equipmentId={id!}
              showAdd={showLogMaintenance}
              onCloseAdd={() => setShowLogMaintenance(false)}
            />
          </div>
        </TabsContent>

        {/* ==================== DOWNTIME TAB ==================== */}
        <TabsContent value="downtime">
          <DowntimeEventsTab
            events={equipment.downtimeEvents || []}
            equipmentId={id!}
            showAdd={showReportDowntime}
            onCloseAdd={() => setShowReportDowntime(false)}
          />
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete Equipment"
        message={`Are you sure you want to delete "${equipment.name}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />

      {/* File Shares Modal */}
      <FileSharesModal
        isOpen={showFileShares}
        onClose={() => setShowFileShares(false)}
        equipmentId={equipment.id}
        equipmentName={smbModalName || equipment.name}
        ipAddress={smbModalIp || equipment.ipAddress}
      />

      {/* Windows Services Modal */}
      <WinServicesModal
        isOpen={showWinServices}
        onClose={() => setShowWinServices(false)}
        equipmentId={equipment.id}
        equipmentName={smbModalName || equipment.name}
        ipAddress={smbModalIp || equipment.ipAddress}
      />

      {/* IPP Print Modal */}
      <IppPrintModal
        isOpen={showIppPrint}
        onClose={() => setShowIppPrint(false)}
        equipmentId={equipment.id}
        equipmentName={smbModalName || equipment.name}
        ipAddress={smbModalIp || equipment.ipAddress}
      />
    </div>
  );
}

// ==================== Sub-Components ====================

function StatusCard({ icon, label, value, color, sub }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: 'green' | 'blue' | 'red' | 'amber' | 'gray';
  sub?: string;
}) {
  const colors = {
    green: 'bg-green-50 border-green-200 text-green-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    gray: 'bg-white border-gray-200 text-gray-700',
  };
  const iconColors = {
    green: 'text-green-500',
    blue: 'text-blue-500',
    red: 'text-red-500',
    amber: 'text-amber-500',
    gray: 'text-gray-400',
  };

  return (
    <div className={`rounded-lg border p-4 ${colors[color]}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={iconColors[color]}>{icon}</span>
        <span className="text-sm font-medium opacity-75">{label}</span>
      </div>
      <p className="text-xl font-bold capitalize">{value}</p>
      {sub && <p className="text-xs mt-1 opacity-70 truncate" title={sub}>{sub}</p>}
    </div>
  );
}

function DataRow({ label, value, mono, sub, className }: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
  sub?: string;
  className?: string;
}) {
  if (!value) return null;
  return (
    <div className={`flex justify-between items-start py-1.5 border-b border-gray-50 ${className || ''}`}>
      <dt className="text-gray-500 text-sm shrink-0 mr-4">{label}</dt>
      <dd className="text-right">
        <span className={`text-gray-900 ${mono ? 'font-mono text-xs' : 'text-sm'}`}>{value}</span>
        {sub && <div className="text-xs text-gray-400">{sub}</div>}
      </dd>
    </div>
  );
}

function RawDataPanel({ title, data }: { title: string; data: Record<string, string | undefined | null> }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-gray-50 rounded-lg border border-gray-200">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-100 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">{title}</span>
        </div>
        <span className={`text-xs text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-gray-200">
          <table className="w-full text-xs font-mono">
            <tbody>
              {Object.entries(data).filter(([, v]) => v != null).map(([key, val], i) => (
                <tr key={i} className="border-b border-gray-100 last:border-0">
                  <td className="py-1.5 pr-4 text-gray-500 whitespace-nowrap align-top">{key}</td>
                  <td className="py-1.5 text-gray-800 break-all">{val}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ZundDashboardPanel({ zund }: { zund: any }) {
  return (
    <div className="space-y-6">
      {/* Cutter Info + Today */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Scissors className="h-5 w-5 text-gray-400" />
          Zund Cutter — {zund.cutter?.name || 'Unknown'}
          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded ml-2">
            ZCC v{zund.dbVersion}
          </span>
        </h2>

        {/* Today's Stats */}
        {zund.todayStats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-700">{zund.todayStats.jobCount}</p>
              <p className="text-xs text-blue-600">Jobs Today</p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-700">{zund.todayStats.totalCuttingTimeMinutes}m</p>
              <p className="text-xs text-green-600">Cutting Time</p>
            </div>
            <div className="text-center p-3 bg-amber-50 rounded-lg">
              <p className="text-2xl font-bold text-amber-700">{zund.todayStats.totalSetupTimeMinutes}m</p>
              <p className="text-xs text-amber-600">Setup Time</p>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <p className="text-2xl font-bold text-purple-700">{zund.todayStats.totalCopiesCut}</p>
              <p className="text-xs text-purple-600">Copies Cut</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-700">{zund.todayStats.totalLengthCutMeters}m</p>
              <p className="text-xs text-gray-600">Cut Length</p>
            </div>
          </div>
        )}

        {/* Current Job */}
        {zund.currentJob && (
          <div className={`p-4 rounded-lg border ${
            zund.currentJob.isActive ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-gray-50'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {zund.currentJob.isActive && (
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
                  </span>
                )}
                <span className="text-sm font-medium text-gray-900">
                  {zund.currentJob.isActive ? 'Currently Cutting' : 'Last Job'}
                </span>
              </div>
              <span className="text-xs text-gray-500">
                {zund.currentJob.copyDone}/{zund.currentJob.copyTotal} copies
              </span>
            </div>
            <p className="font-medium text-gray-900 truncate">{zund.currentJob.jobName}</p>
            <div className="flex gap-4 mt-2 text-xs text-gray-500">
              <span>Material: {zund.currentJob.material}</span>
              <span>Duration: {Math.round(zund.currentJob.durationSeconds / 60)}m</span>
            </div>
          </div>
        )}
      </div>

      {/* Tool Wear */}
      {zund.toolWear && zund.toolWear.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Gauge className="h-5 w-5 text-gray-400" />
            Tool Wear
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {zund.toolWear.map((tool: any, i: number) => (
              <div key={i} className="border border-gray-100 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    Insert #{tool.insertId} (Tool {tool.toolId})
                  </span>
                  <span className={`text-sm font-bold ${
                    tool.wearPercent > 80 ? 'text-red-600' :
                    tool.wearPercent > 50 ? 'text-amber-600' : 'text-green-600'
                  }`}>
                    {tool.wearPercent}% worn
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      tool.wearPercent > 80 ? 'bg-red-500' :
                      tool.wearPercent > 50 ? 'bg-amber-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.max(tool.wearPercent, 2)}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1 text-xs text-gray-400">
                  <span>{tool.runningMeters}m / {tool.maxRunningMeters}m</span>
                  <span>{tool.materialName}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Jobs */}
      {zund.recentJobs && zund.recentJobs.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-gray-400" />
            Recent Cutting Jobs
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-200">
                  <th className="pb-2 font-medium">Job Name</th>
                  <th className="pb-2 font-medium">Material</th>
                  <th className="pb-2 font-medium text-center">Copies</th>
                  <th className="pb-2 font-medium text-right">Duration</th>
                  <th className="pb-2 font-medium text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {zund.recentJobs.slice(0, 15).map((job: any) => (
                  <tr key={job.jobId} className="hover:bg-gray-50">
                    <td className="py-2 max-w-xs truncate" title={job.jobName}>{job.jobName}</td>
                    <td className="py-2 text-gray-500">{job.material}</td>
                    <td className="py-2 text-center">{job.copyDone}/{job.copyTotal}</td>
                    <td className="py-2 text-right text-gray-500">{Math.round(job.durationSeconds / 60)}m</td>
                    <td className="py-2 text-right text-gray-400 text-xs">
                      {format(new Date(job.productionStart), 'MMM d h:mm a')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ResolveDowntimeButton({ downtimeId, equipmentId }: { downtimeId: string; equipmentId: string }) {
  const queryClient = useQueryClient();
  const [resolving, setResolving] = useState(false);
  const [resolution, setResolution] = useState('');

  const resolveMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/equipment/downtime/${downtimeId}/resolve`, { resolution });
    },
    onSuccess: () => {
      toast.success('Downtime resolved');
      queryClient.invalidateQueries({ queryKey: ['equipment', equipmentId] });
      queryClient.invalidateQueries({ queryKey: ['equipment-stats'] });
      setResolving(false);
    },
    onError: () => {
      toast.error('Failed to resolve downtime');
    },
  });

  if (!resolving) {
    return (
      <button
        onClick={() => setResolving(true)}
        className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
      >
        Resolve
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        placeholder="Resolution notes..."
        value={resolution}
        onChange={(e) => setResolution(e.target.value)}
        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
      />
      <button
        onClick={() => resolveMutation.mutate()}
        disabled={resolveMutation.isPending}
        className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm disabled:opacity-50"
      >
        Save
      </button>
      <button
        onClick={() => setResolving(false)}
        className="px-3 py-1.5 text-gray-600 hover:text-gray-800 text-sm"
      >
        Cancel
      </button>
    </div>
  );
}

function MaintenanceSchedulesTab({ schedules, equipmentId, showAdd, onCloseAdd }: {
  schedules: any[];
  equipmentId: string;
  showAdd: boolean;
  onCloseAdd: () => void;
}) {
  const queryClient = useQueryClient();
  const [newSchedule, setNewSchedule] = useState({
    taskName: '',
    description: '',
    frequency: MaintenanceFrequency.MONTHLY,
    nextDue: format(new Date(), 'yyyy-MM-dd'),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/equipment/${equipmentId}/schedules`, newSchedule);
    },
    onSuccess: () => {
      toast.success('Schedule added');
      queryClient.invalidateQueries({ queryKey: ['equipment', equipmentId] });
      onCloseAdd();
      setNewSchedule({ taskName: '', description: '', frequency: MaintenanceFrequency.MONTHLY, nextDue: format(new Date(), 'yyyy-MM-dd') });
    },
    onError: () => toast.error('Failed to add schedule'),
  });

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <h3 className="font-medium text-gray-900">Maintenance Schedules</h3>
        <button
          onClick={() => showAdd ? onCloseAdd() : onCloseAdd()}
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          <Plus className="h-4 w-4" />
          Add Schedule
        </button>
      </div>

      {showAdd && (
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <h4 className="font-medium text-gray-900 mb-3">New Schedule</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Task Name</label>
              <input type="text" value={newSchedule.taskName} onChange={(e) => setNewSchedule({ ...newSchedule, taskName: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="e.g., Oil change" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
              <select value={newSchedule.frequency} onChange={(e) => setNewSchedule({ ...newSchedule, frequency: e.target.value as MaintenanceFrequency })} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                {(Object.values(MaintenanceFrequency) as string[]).map((freq) => (
                  <option key={freq} value={freq}>{MAINTENANCE_FREQUENCY_DISPLAY_NAMES[freq]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Next Due</label>
              <input type="date" value={newSchedule.nextDue} onChange={(e) => setNewSchedule({ ...newSchedule, nextDue: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input type="text" value={newSchedule.description} onChange={(e) => setNewSchedule({ ...newSchedule, description: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Optional" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => createMutation.mutate()} disabled={!newSchedule.taskName || createMutation.isPending} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">Save</button>
            <button onClick={onCloseAdd} className="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
          </div>
        </div>
      )}

      {schedules.length === 0 ? (
        <div className="p-8 text-center text-gray-500">No maintenance schedules set up yet</div>
      ) : (
        <div className="divide-y divide-gray-200">
          {schedules.map((s: any) => (
            <div key={s.id} className="p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{s.taskName}</span>
                  <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{MAINTENANCE_FREQUENCY_DISPLAY_NAMES[s.frequency]}</span>
                </div>
                {s.description && <p className="text-sm text-gray-500 mt-1">{s.description}</p>}
              </div>
              <div className="text-right">
                <div className={`text-sm font-medium ${new Date(s.nextDue) < new Date() ? 'text-red-600' : 'text-gray-900'}`}>
                  {new Date(s.nextDue) < new Date() ? 'Overdue: ' : 'Due: '}{format(new Date(s.nextDue), 'MMM d, yyyy')}
                </div>
                {s.lastCompleted && <div className="text-xs text-gray-500">Last: {format(new Date(s.lastCompleted), 'MMM d, yyyy')}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MaintenanceLogsTab({ logs, equipmentId, showAdd, onCloseAdd }: {
  logs: any[];
  equipmentId: string;
  showAdd: boolean;
  onCloseAdd: () => void;
}) {
  const queryClient = useQueryClient();
  const [newLog, setNewLog] = useState({ taskPerformed: '', notes: '', cost: '', performedAt: format(new Date(), 'yyyy-MM-dd') });

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/equipment/${equipmentId}/logs`, { ...newLog, cost: newLog.cost ? parseFloat(newLog.cost) : undefined, performedAt: new Date(newLog.performedAt).toISOString() });
    },
    onSuccess: () => {
      toast.success('Maintenance logged');
      queryClient.invalidateQueries({ queryKey: ['equipment', equipmentId] });
      onCloseAdd();
      setNewLog({ taskPerformed: '', notes: '', cost: '', performedAt: format(new Date(), 'yyyy-MM-dd') });
    },
    onError: () => toast.error('Failed to log maintenance'),
  });

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <h3 className="font-medium text-gray-900">Maintenance Logs</h3>
        <button
          onClick={() => showAdd ? onCloseAdd() : onCloseAdd()}
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          <Plus className="h-4 w-4" />
          Log Maintenance
        </button>
      </div>

      {showAdd && (
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <h4 className="font-medium text-gray-900 mb-3">Log Maintenance</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Task Performed</label>
              <input type="text" value={newLog.taskPerformed} onChange={(e) => setNewLog({ ...newLog, taskPerformed: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Describe the maintenance" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input type="date" value={newLog.performedAt} onChange={(e) => setNewLog({ ...newLog, performedAt: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cost ($)</label>
              <input type="number" step="0.01" value={newLog.cost} onChange={(e) => setNewLog({ ...newLog, cost: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="0.00" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea value={newLog.notes} onChange={(e) => setNewLog({ ...newLog, notes: e.target.value })} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Optional" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => createMutation.mutate()} disabled={!newLog.taskPerformed || createMutation.isPending} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">Save</button>
            <button onClick={onCloseAdd} className="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
          </div>
        </div>
      )}

      {logs.length === 0 ? (
        <div className="p-8 text-center text-gray-500">No maintenance logs recorded yet</div>
      ) : (
        <div className="divide-y divide-gray-200">
          {logs.map((log: any) => (
            <div key={log.id} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium text-gray-900">{log.taskPerformed}</div>
                  {log.notes && <p className="text-sm text-gray-500 mt-1">{log.notes}</p>}
                  {log.performedBy && <p className="text-xs text-gray-400 mt-1">By {log.performedBy.displayName || log.performedBy.name}</p>}
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-900">{format(new Date(log.performedAt), 'MMM d, yyyy')}</div>
                  {log.cost > 0 && <div className="text-sm text-gray-500">${log.cost.toFixed(2)}</div>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DowntimeEventsTab({ events, equipmentId, showAdd, onCloseAdd }: {
  events: any[];
  equipmentId: string;
  showAdd: boolean;
  onCloseAdd: () => void;
}) {
  const queryClient = useQueryClient();
  const [newEvent, setNewEvent] = useState({ reason: DowntimeReason.BREAKDOWN, impactLevel: ImpactLevel.MEDIUM, description: '' });

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/equipment/${equipmentId}/downtime`, newEvent);
    },
    onSuccess: () => {
      toast.success('Downtime reported');
      queryClient.invalidateQueries({ queryKey: ['equipment', equipmentId] });
      queryClient.invalidateQueries({ queryKey: ['equipment-stats'] });
      onCloseAdd();
      setNewEvent({ reason: DowntimeReason.BREAKDOWN, impactLevel: ImpactLevel.MEDIUM, description: '' });
    },
    onError: () => toast.error('Failed to report downtime'),
  });

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <h3 className="font-medium text-gray-900">Downtime History</h3>
        <button
          onClick={() => showAdd ? onCloseAdd() : onCloseAdd()}
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm"
        >
          <AlertTriangle className="h-4 w-4" />
          Report Downtime
        </button>
      </div>

      {showAdd && (
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <h4 className="font-medium text-gray-900 mb-3">Report Downtime</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
              <select value={newEvent.reason} onChange={(e) => setNewEvent({ ...newEvent, reason: e.target.value as DowntimeReason })} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                {(Object.values(DowntimeReason) as string[]).map((r) => (
                  <option key={r} value={r}>{DOWNTIME_REASON_DISPLAY_NAMES[r]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Impact</label>
              <select value={newEvent.impactLevel} onChange={(e) => setNewEvent({ ...newEvent, impactLevel: e.target.value as ImpactLevel })} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                {(Object.values(ImpactLevel) as string[]).map((l) => (
                  <option key={l} value={l}>{IMPACT_LEVEL_DISPLAY_NAMES[l]}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea value={newEvent.description} onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Describe the issue..." />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => createMutation.mutate()} disabled={!newEvent.description || createMutation.isPending} className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50">Report</button>
            <button onClick={onCloseAdd} className="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
          </div>
        </div>
      )}

      {events.length === 0 ? (
        <div className="p-8 text-center text-gray-500">No downtime events recorded</div>
      ) : (
        <div className="divide-y divide-gray-200">
          {events.map((event: any) => (
            <div key={event.id} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: `${DOWNTIME_REASON_COLORS[event.reason]}20`, color: DOWNTIME_REASON_COLORS[event.reason] }}>
                      {DOWNTIME_REASON_DISPLAY_NAMES[event.reason]}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: `${IMPACT_LEVEL_COLORS[event.impactLevel]}20`, color: IMPACT_LEVEL_COLORS[event.impactLevel] }}>
                      {IMPACT_LEVEL_DISPLAY_NAMES[event.impactLevel]}
                    </span>
                    {!event.resolvedAt && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">Active</span>}
                  </div>
                  <p className="text-gray-900 mt-1">{event.description}</p>
                  {event.resolution && <p className="text-sm text-green-700 mt-1">Resolution: {event.resolution}</p>}
                </div>
                <div className="text-right text-sm">
                  <div className="text-gray-500">Started: {format(new Date(event.startedAt), 'MMM d, yyyy h:mm a')}</div>
                  {event.resolvedAt && <div className="text-green-600">Resolved: {format(new Date(event.resolvedAt), 'MMM d, yyyy h:mm a')}</div>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
// ============ HP Latex EWS Panel ============

const INK_COLOR_MAP: Record<string, string> = {
  'cyan': '#00BCD4',
  'magenta': '#E91E63',
  'yellow': '#FFEB3B',
  'black': '#212121',
  'light-cyan': '#80DEEA',
  'light cyan': '#80DEEA',
  'light-magenta': '#F48FB1',
  'light magenta': '#F48FB1',
  'pre-treatment': '#9E9E9E',
  'optimizer': '#9E9E9E',
  'scratch-agent': '#BDBDBD',
  'overcoat': '#BDBDBD',
  'white': '#F5F5F5',
};

// ==================== VUTEk GS3250LX Pro Panel ====================
function VUTEkPanel({ vutek, fieryJobs, onLaunchConnection, onOpenFileShares, onOpenWinServices }: {
  vutek: any;
  fieryJobs?: any[];
  onLaunchConnection: (type: 'rdp' | 'vnc', targetIp?: string) => void;
  onOpenFileShares: (ip?: string, name?: string) => void;
  onOpenWinServices: (ip?: string, name?: string) => void;
}) {
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const navigate = useNavigate();

  // Navigate to an order's Zund/cut section by resolving order number → UUID
  const navigateToOrderZund = async (orderNum: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await api.get(`/orders/by-number/${encodeURIComponent(orderNum)}`);
      const orderId = res.data?.data?.id;
      if (orderId) {
        navigate(`/orders/${orderId}#zund`);
      } else {
        navigate(`/orders?search=${encodeURIComponent(orderNum)}`);
      }
    } catch {
      // Fallback to search if lookup fails
      navigate(`/orders?search=${encodeURIComponent(orderNum)}`);
    }
  };

  const identity = vutek.identity;
  const connectivity = vutek.connectivity;
  const jobs = vutek.fieryJobs || [];
  const inkConfig = vutek.inkConfiguration || [];
  const fileStats = vutek.fieryShareFiles;
  const devStatus = vutek.deviceStatus;
  const ink = vutek.ink as {
    available: boolean;
    lastPolled: string;
    error?: string;
    currentBags: Array<{
      id: number; bagId: string; installedAt: string; lastUsedAt: string;
      microlitersUsed: number; colorCode: string; colorName: string;
      hexColor: string; estimatedRemainingUl: number; estimatedPercentRemaining: number;
    }>;
    enabledColors: Array<{ colorCode: string; colorName: string; hexColor: string; enabled: boolean }>;
    couplerWeights: Array<{ index: number; fullWeight: number; emptyWeight: number }>;
    recentUsage: Array<{
      printId: number; jobName: string; printStart: string; printFinish: string;
      sqFeet: number; percentComplete: number; printResult: number;
      cyan: number; magenta: number; yellow: number; black: number;
      lightCyan: number; lightMagenta: number; lightYellow: number; lightBlack: number;
      white: number; clear: number;
    }>;
    totalUsage: {
      cyan: number; magenta: number; yellow: number; black: number;
      lightCyan: number; lightMagenta: number; white: number; totalJobs: number;
    };
    printerStatus: { deviceStatus: string; statusDetails: string; deviceId: string; serialNumber: string } | null;
    rfidStatus: { workingTags: string[]; errorTags: string[]; message: string };
  } | null;

  // Determine actual printer status: prefer direct SSH→JMF (port 8013 on printer), fallback to Fiery RIP JMF (port 8010)
  const actualPrinterStatus = ink?.printerStatus?.deviceStatus || devStatus?.deviceStatus || 'Unknown';
  const printerStatusSource = ink?.printerStatus ? 'Printer (SSH→JMF)' : devStatus ? 'Fiery XF (JMF)' : null;
  const printerStatusDetails = ink?.printerStatus?.statusDetails || devStatus?.statusDetails || '';

  // Fiery queue: real-time active job count from JMF QueueStatus
  const queueData = vutek.queue;
  const activeQueueJobs = queueData?.queueSize ?? null;
  const printingNow = queueData?.entries?.filter((e: any) => e.status === 'InProgress' || e.status === 'Running').length ?? 0;
  const waitingJobs = queueData?.entries?.filter((e: any) => e.status === 'Waiting' || e.status === 'Held').length ?? 0;

  function fmtDate(ts: string | null): string {
    if (!ts) return '—';
    try {
      return format(new Date(ts), 'MMM d, h:mm a');
    } catch {
      return ts;
    }
  }

  return (
    <>
      {/* ---- VUTEk Header ---- */}
      <div className="bg-gradient-to-r from-purple-700 to-indigo-800 rounded-lg p-4 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Printer className="h-6 w-6" />
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold">{identity?.productName || 'EFI VUTEk Printer'}</h2>
                {actualPrinterStatus !== 'Unknown' && (
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    actualPrinterStatus === 'Running'
                      ? 'bg-green-500/20 text-green-200 ring-1 ring-green-400/30'
                      : actualPrinterStatus === 'Idle'
                        ? 'bg-blue-500/20 text-blue-200 ring-1 ring-blue-400/30'
                        : actualPrinterStatus === 'Down' || actualPrinterStatus === 'Stopped'
                          ? 'bg-red-500/20 text-red-200 ring-1 ring-red-400/30'
                          : 'bg-yellow-500/20 text-yellow-200 ring-1 ring-yellow-400/30'
                  }`}>
                    <span className={`h-2 w-2 rounded-full ${
                      actualPrinterStatus === 'Running' ? 'bg-green-400 animate-pulse'
                        : actualPrinterStatus === 'Idle' ? 'bg-blue-400'
                        : actualPrinterStatus === 'Down' || actualPrinterStatus === 'Stopped' ? 'bg-red-400 animate-pulse'
                        : 'bg-yellow-400'
                    }`} />
                    {actualPrinterStatus}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 text-purple-200 text-sm mt-0.5">
                {devStatus?.deviceName && devStatus.deviceName !== 'VUTEk' ? (
                  <span className="font-medium text-purple-100">{devStatus.deviceName}</span>
                ) : (
                  <span>{identity?.manufacturer}</span>
                )}
                <span>{identity?.technology}</span>
                <span>Bed: {identity?.bedSize}</span>
                {ink?.printerStatus?.serialNumber && (
                  <span>S/N: {ink.printerStatus.serialNumber}</span>
                )}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-purple-200 uppercase tracking-wide">Source</div>
            <div className="text-sm font-medium">
              {ink?.printerStatus ? 'Printer SSH + Fiery XF' : devStatus ? 'Fiery XF (JMF)' : 'Port Scan'}
            </div>
            <div className="text-xs text-purple-200">
              {vutek.lastPolled ? formatDistanceToNow(new Date(vutek.lastPolled), { addSuffix: true }) : ''}
            </div>
          </div>
        </div>
      </div>

      {/* ---- Quick Stats Row ---- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatusCard
          icon={<Activity className="h-5 w-5" />}
          label="Printer Status"
          value={actualPrinterStatus}
          color={actualPrinterStatus === 'Running' ? 'green' : actualPrinterStatus === 'Idle' ? 'blue' : actualPrinterStatus === 'Down' || actualPrinterStatus === 'Stopped' ? 'red' : 'gray'}
          sub={printerStatusDetails || (printerStatusSource ? `via ${printerStatusSource}` : 'No connection')}
        />
        <StatusCard
          icon={<Gauge className="h-5 w-5" />}
          label="Operation Mode"
          value={devStatus?.operationMode || 'N/A'}
          color={devStatus?.operationMode === 'Productive' ? 'green' : devStatus?.operationMode === 'Maintenance' ? 'amber' : 'blue'}
          sub={devStatus ? `Fiery: ${devStatus.deviceCondition || 'OK'}${printingNow > 0 ? ` · ${printingNow} printing` : ''}` : 'Fiery XF not available'}
        />
        <StatusCard
          icon={<Droplets className="h-5 w-5" />}
          label="Ink Type"
          value={identity?.inkType || 'N/A'}
          color={ink?.available && ink.currentBags.some(b => b.estimatedPercentRemaining <= 10) ? 'red'
            : ink?.available && ink.currentBags.some(b => b.estimatedPercentRemaining <= 20) ? 'amber'
            : 'blue'}
          sub={ink?.available && ink.currentBags.length > 0
            ? `${ink.currentBags.length} bags · avg ${Math.round(ink.currentBags.reduce((s, b) => s + b.estimatedPercentRemaining, 0) / ink.currentBags.length)}%`
            : `${inkConfig.length} channels`}
        />
        <StatusCard
          icon={<FileText className="h-5 w-5" />}
          label="Fiery Queue"
          value={activeQueueJobs !== null ? String(activeQueueJobs) : 'N/A'}
          color={printingNow > 0 ? 'green' : activeQueueJobs !== null && activeQueueJobs > 0 ? 'blue' : 'gray'}
          sub={activeQueueJobs !== null
            ? (printingNow > 0 || waitingJobs > 0
              ? `${printingNow} printing · ${waitingJobs} waiting`
              : 'Queue empty')
            : fileStats ? `${fileStats.jdf} JDF files on share` : 'Fiery unavailable'}
        />
      </div>

      {/* ---- Connectivity Dashboard ---- */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
          <Network className="h-5 w-5 text-gray-400" />
          System Connectivity
        </h2>
        <p className="text-xs text-gray-400 mb-4">
          VUTEk Printer ({connectivity?.printerIp}) + Fiery RIP Controller ({connectivity?.fieryIp})
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* VUTEk Printer */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Server className="h-4 w-4 text-purple-500" />
              VUTEk Printer
              <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
                connectivity?.printerReachable ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {connectivity?.printerReachable ? 'ONLINE' : 'OFFLINE'}
              </span>
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'ssh', label: 'SSH', port: 22, desc: 'Secure Shell', icon: <Server className="h-5 w-5" />, action: null as null },
                { key: 'vnc', label: 'VNC', port: 5900, desc: 'Remote Display', icon: <MonitorSmartphone className="h-5 w-5" />, action: 'vnc' as const },
              ].map(({ key, label, port, desc, icon, action }) => {
                const isOpen = connectivity?.ports?.[key];
                const isClickable = isOpen && action !== null;
                return (
                  <button
                    key={key}
                    onClick={() => {
                      if (!isClickable) return;
                      if (action === 'vnc') onLaunchConnection('vnc', connectivity?.printerIp);
                    }}
                    disabled={!isClickable}
                    className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-all ${
                      isOpen
                        ? isClickable
                          ? 'border-green-200 bg-green-50 hover:bg-green-100 hover:border-green-300 hover:shadow-md cursor-pointer'
                          : 'border-green-200 bg-green-50'
                        : 'border-gray-200 bg-gray-50 cursor-not-allowed'
                    }`}
                  >
                    <div className={isOpen ? 'text-green-600' : 'text-gray-300'}>{icon}</div>
                    <span className={`text-sm font-bold ${isOpen ? 'text-green-700' : 'text-gray-400'}`}>
                      {label}
                    </span>
                    <span className="text-xs text-gray-400">:{port}</span>
                    <span className={`text-xs ${isOpen ? 'text-green-600' : 'text-gray-400'}`}>
                      {isOpen ? 'OPEN' : 'CLOSED'}
                    </span>
                    <span className={`text-xs ${isClickable && isOpen ? 'text-green-600 font-medium' : 'text-gray-400'}`}>
                      {isClickable && isOpen ? '▶ Connect' : desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fiery Controller */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Cpu className="h-4 w-4 text-indigo-500" />
              EFI Fiery RIP Controller
              <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
                connectivity?.fieryReachable ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {connectivity?.fieryReachable ? 'ONLINE' : 'OFFLINE'}
              </span>
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: 'smb', label: 'SMB', port: 445, desc: 'File Share', action: 'file-shares' as const },
                { key: 'rdp', label: 'RDP', port: 3389, desc: 'Remote Desktop', action: 'rdp' as const },
                { key: 'rpc', label: 'RPC', port: 135, desc: 'Win Services', action: 'services' as const },
              ].map(({ key, label, port, desc, action }) => {
                const isOpen = connectivity?.fieryPorts?.[key];
                const isClickable = isOpen;
                return (
                  <button
                    key={key}
                    onClick={() => {
                      if (!isClickable) return;
                      const fieryIp = connectivity?.fieryIp;
                      if (action === 'rdp') onLaunchConnection('rdp', fieryIp);
                      else if (action === 'file-shares') onOpenFileShares(fieryIp, 'Fiery Controller');
                      else if (action === 'services') onOpenWinServices(fieryIp, 'Fiery Controller');
                    }}
                    disabled={!isClickable}
                    className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all ${
                      isOpen
                        ? 'border-green-200 bg-green-50 hover:bg-green-100 hover:border-green-300 hover:shadow-md cursor-pointer'
                        : 'border-gray-200 bg-gray-50 cursor-not-allowed'
                    }`}
                  >
                    <span className={`text-sm font-bold ${isOpen ? 'text-green-700' : 'text-gray-400'}`}>
                      {label}
                    </span>
                    <span className="text-xs text-gray-400">:{port}</span>
                    <span className={`text-xs ${isOpen ? 'text-green-600' : 'text-gray-400'}`}>
                      {isOpen ? 'OPEN' : 'CLOSED'}
                    </span>
                    <span className={`text-xs ${isOpen ? 'text-green-600 font-medium' : 'text-gray-400'}`}>
                      {isOpen ? (action === 'rdp' ? '▶ Connect' : action === 'file-shares' ? '📂 Browse' : '⚙ View') : desc}
                    </span>
                  </button>
                );
              })}
            </div>
            {/* SMB Share Status */}
            <div className={`mt-3 p-3 rounded-lg border flex items-center gap-3 ${
              connectivity?.fieryShareAccessible ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'
            }`}>
              <HardDrive className={`h-5 w-5 ${connectivity?.fieryShareAccessible ? 'text-green-600' : 'text-amber-500'}`} />
              <div>
                <div className={`text-sm font-medium ${connectivity?.fieryShareAccessible ? 'text-green-700' : 'text-amber-700'}`}>
                  EFI Export Folder
                </div>
                <div className="text-xs text-gray-500">
                  {connectivity?.fieryShareAccessible
                    ? `Accessible — ${fileStats ? `${fileStats.jdf} JDF, ${fileStats.rtl} RTL, ${fileStats.zcc} ZCC files` : 'Connected'}`
                    : 'Share not accessible from server — check SMB credentials'
                  }
                </div>
              </div>
            </div>
          </div>
        </div>
        {connectivity?.lastChecked && (
          <div className="text-xs text-gray-400 mt-3 text-right">
            Checked {formatDistanceToNow(new Date(connectivity.lastChecked), { addSuffix: true })}
          </div>
        )}
      </div>

      {/* ---- Ink Levels (from SSH+MySQL backend) ---- */}
      {ink?.available && ink.currentBags.length > 0 ? (() => {
        const bags = ink.currentBags;
        const lowBags = bags.filter(b => b.estimatedPercentRemaining <= 20);
        const critBags = bags.filter(b => b.estimatedPercentRemaining <= 10);
        const hasWarnings = lowBags.length > 0;

        return (
          <CollapsibleSection
            title="UV Ink Bag Levels"
            icon={<Droplets className="h-5 w-5 text-purple-500" />}
            badge={
              <span className="text-xs text-gray-400 font-normal ml-1">
                {bags.length} bag{bags.length !== 1 ? 's' : ''}
                {critBags.length > 0
                  ? <span className="ml-2 text-red-600 font-medium">{critBags.length} critical</span>
                  : hasWarnings
                    ? <span className="ml-2 text-amber-600 font-medium">{lowBags.length} low</span>
                    : null}
              </span>
            }
            subtitle={`Source: VUTEk MySQL via SSH · Polled ${ink.lastPolled ? formatDistanceToNow(new Date(ink.lastPolled), { addSuffix: true }) : 'unknown'}`}
            defaultOpen={true}
            warningContent={hasWarnings ? (
              <div className="space-y-2">
                {lowBags.map((bag, i) => {
                  const pct = Math.round(bag.estimatedPercentRemaining);
                  const isCrit = pct <= 10;
                  return (
                    <div key={i} className={`flex items-center gap-3 p-2 rounded-lg ${
                      isCrit ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'
                    }`}>
                      <div className="h-4 w-4 rounded-full border border-gray-200 flex-shrink-0" style={{ backgroundColor: bag.hexColor }} />
                      <span className="text-sm font-medium capitalize flex-1">{bag.colorName}</span>
                      <div className="w-20 bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: bag.hexColor === '#FAFAFA' || bag.hexColor === '#F5F5F5' ? '#9e9e9e' : bag.hexColor }} />
                      </div>
                      <span className={`text-sm font-bold w-10 text-right ${isCrit ? 'text-red-600' : 'text-amber-600'}`}>{pct}%</span>
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${isCrit ? 'bg-red-200 text-red-700' : 'bg-amber-200 text-amber-700'}`}>
                        {isCrit ? 'CRIT' : 'LOW'}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : undefined}
          >
            <div className="space-y-3">
              {bags.map((bag, i) => {
                const pct = Math.round(bag.estimatedPercentRemaining);
                const isLow = pct <= 20;
                const isCrit = pct <= 10;
                const usedLiters = (bag.microlitersUsed / 1_000_000).toFixed(2);
                const remainLiters = (bag.estimatedRemainingUl / 1_000_000).toFixed(2);
                // White ink on white bg needs a visible bar color
                const barColor = bag.hexColor === '#FAFAFA' || bag.hexColor === '#F5F5F5' || bag.hexColor === '#FFF9C4'
                  ? '#9e9e9e' : bag.hexColor;
                return (
                  <div key={i} className={`border rounded-lg p-4 ${
                    isCrit ? 'border-red-200 bg-red-50' :
                    isLow ? 'border-amber-200 bg-amber-50' :
                    'border-gray-100'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-6 w-6 rounded-full border-2 border-gray-200"
                          style={{
                            backgroundColor: bag.hexColor,
                            boxShadow: bag.colorName.toLowerCase().includes('white') ? 'inset 0 0 0 1px rgba(0,0,0,0.1)' : undefined,
                          }}
                        />
                        <div>
                          <span className="font-medium text-gray-900">{bag.colorName}</span>
                          <span className="text-xs text-gray-400 ml-2">Ch: {bag.colorCode}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-2xl font-bold ${
                          isCrit ? 'text-red-600' :
                          isLow ? 'text-amber-600' :
                          'text-gray-900'
                        }`}>
                          {pct}%
                        </span>
                        {isCrit && <div className="text-xs text-red-600 font-medium">CRITICAL</div>}
                        {isLow && !isCrit && <div className="text-xs text-amber-600 font-medium">LOW</div>}
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden mb-2">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.max(pct, 2)}%`,
                          backgroundColor: barColor,
                        }}
                      />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-xs text-gray-500">
                      <span>Used: <span className="font-medium text-gray-700">{usedLiters}L</span></span>
                      <span>Remaining: <span className="font-medium text-gray-700">~{remainLiters}L</span></span>
                      <span>Installed: <span className="font-medium text-gray-700">{bag.installedAt ? format(new Date(bag.installedAt), 'MMM d, yyyy') : '—'}</span></span>
                      <span>Tag: <span className="font-mono text-gray-700">{bag.bagId || '—'}</span></span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* RFID Status Warning */}
            {ink.rfidStatus && ink.rfidStatus.errorTags.length > 0 && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-700">
                  <div className="font-medium mb-0.5">RFID Tags Reporting Errors</div>
                  <p>{ink.rfidStatus.message}</p>
                  <p className="mt-1 text-amber-600">
                    Error tags: {ink.rfidStatus.errorTags.join(', ')}
                    {ink.rfidStatus.workingTags.length > 0 && ` · Working: ${ink.rfidStatus.workingTags.join(', ')}`}
                  </p>
                  <p className="mt-1 text-amber-600 italic">
                    Ink levels are estimated from bag consumption history rather than live RFID readings.
                  </p>
                </div>
              </div>
            )}

            {/* Total Usage Summary */}
            {ink.totalUsage && ink.totalUsage.totalJobs > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="text-xs text-gray-400 mb-2 font-medium">All-Time Ink Usage ({ink.totalUsage.totalJobs.toLocaleString()} jobs)</div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'Cyan', drops: ink.totalUsage.cyan, hex: '#00BCD4' },
                    { label: 'Magenta', drops: ink.totalUsage.magenta, hex: '#E91E63' },
                    { label: 'Yellow', drops: ink.totalUsage.yellow, hex: '#FFEB3B' },
                    { label: 'Black', drops: ink.totalUsage.black, hex: '#212121' },
                    { label: 'Lt Cyan', drops: ink.totalUsage.lightCyan, hex: '#80DEEA' },
                    { label: 'Lt Magenta', drops: ink.totalUsage.lightMagenta, hex: '#F48FB1' },
                    { label: 'White', drops: ink.totalUsage.white, hex: '#9e9e9e' },
                  ].filter(ch => ch.drops > 0).map((ch, i) => (
                    <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-gray-200 rounded text-xs">
                      <span className="h-3 w-3 rounded-full border border-gray-200" style={{ backgroundColor: ch.hex }} />
                      <span className="text-gray-600">{ch.label}</span>
                      <span className="font-medium text-gray-800">{(ch.drops / 1_000_000).toFixed(1)}M drops</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </CollapsibleSection>
        );
      })() : inkConfig.length > 0 && (
        /* Fallback: static ink channel display when SSH data unavailable */
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <Droplets className="h-5 w-5 text-gray-400" />
            UV Ink Channels
          </h2>
          <p className="text-xs text-gray-400 mb-4">
            {identity?.inkType || 'EFI UV'} · {inkConfig.length} ink channels configured · Live levels connecting via SSH...
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {inkConfig.map((ch: any, i: number) => (
              <div key={i} className="border border-gray-100 rounded-lg p-4 flex items-center gap-3">
                <div
                  className="h-10 w-10 rounded-full border-2 border-gray-200 flex-shrink-0"
                  style={{
                    backgroundColor: ch.hexColor,
                    boxShadow: ch.channel === 'White' ? 'inset 0 0 0 1px rgba(0,0,0,0.1)' : undefined,
                  }}
                />
                <div>
                  <div className="text-sm font-semibold text-gray-900">{ch.channel}</div>
                  <div className="text-xs text-gray-400">{ch.color}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---- Print History (merged ink usage + fiery job data) ---- */}
      {ink?.available && ink.recentUsage.length > 0 && (() => {
        // Build a lookup from fiery jobs by normalized job name for ZCC + media + dimension matching
        const fieryByName = new Map<string, any>();
        for (const fj of jobs) {
          const norm = (fj.jobName || fj.fileName || '').replace(/\.rtl(_\d+)?$/i, '').replace(/\.jdf$/i, '').trim().toLowerCase();
          if (norm) fieryByName.set(norm, fj);
        }

        // Try to extract a work order number from job name (common patterns: WO-12345, 12345, WO12345)
        const extractOrderNumber = (name: string): string | null => {
          // Pattern: WO-XXXXX or WO XXXXX
          const woMatch = name.match(/\bWO[-\s]?(\d{4,})\b/i);
          if (woMatch) return woMatch[0].replace(/\s/g, '-').toUpperCase();
          return null;
        };

        // Aggregate stats
        const completedJobs = ink.recentUsage.filter(j => j.printResult === 2).length;
        const totalSqFt = ink.recentUsage.reduce((sum, j) => sum + (j.sqFeet || 0), 0);
        const totalInkDrops = ink.recentUsage.reduce((sum, j) =>
          sum + j.cyan + j.magenta + j.yellow + j.black +
          j.lightCyan + j.lightMagenta + j.lightYellow + j.lightBlack +
          j.white + (j.clear || 0), 0
        );
        const jobsWithZcc = ink.recentUsage.filter(j => {
          const norm = (j.jobName || '').replace(/\.rtl(_\d+)?$/i, '').trim().toLowerCase();
          const fj = fieryByName.get(norm);
          return fj?.hasZccCutFile;
        }).length;

        return (
          <CollapsibleSection
            title="History"
            icon={<Clock className="h-5 w-5 text-purple-500" />}
            badge={
              <span className="text-xs text-gray-400 font-normal ml-1">
                {ink.recentUsage.length} job{ink.recentUsage.length !== 1 ? 's' : ''} · last 48h
              </span>
            }
            subtitle="Source: VUTEk printdb via SSH + Fiery Export Folder"
            defaultOpen={true}
          >
            {/* Summary stats bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-green-700">{completedJobs}/{ink.recentUsage.length}</div>
                <div className="text-xs text-green-600">Completed</div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-blue-700">{totalSqFt.toFixed(0)}</div>
                <div className="text-xs text-blue-600">Total ft²</div>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-purple-700">{(totalInkDrops / 1_000_000).toFixed(1)}M</div>
                <div className="text-xs text-purple-600">Total Ink Drops</div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-amber-700">{jobsWithZcc}</div>
                <div className="text-xs text-amber-600">With Cut Files</div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wider">
                    <th className="pb-2 pr-3">Job</th>
                    <th className="pb-2 pr-3">Printed</th>
                    <th className="pb-2 pr-3">Duration</th>
                    <th className="pb-2 pr-3 text-right">Area</th>
                    <th className="pb-2 pr-3">Ink Consumption</th>
                    <th className="pb-2 pr-3">Cut File</th>
                    <th className="pb-2 pr-3 text-right">Status</th>
                    <th className="pb-2 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {ink.recentUsage.map((job, idx) => {
                    // Match fiery job for ZCC + media + dimensions
                    const normName = (job.jobName || '').replace(/\.rtl(_\d+)?$/i, '').trim().toLowerCase();
                    const fieryJob = fieryByName.get(normName);
                    const orderNum = extractOrderNumber(job.jobName || '');
                    const isExpanded = expandedJob === `hist-${idx}`;

                    const inkChannels = [
                      { label: 'Cyan', abbr: 'C', drops: job.cyan, hex: '#00BCD4' },
                      { label: 'Magenta', abbr: 'M', drops: job.magenta, hex: '#E91E63' },
                      { label: 'Yellow', abbr: 'Y', drops: job.yellow, hex: '#FFEB3B' },
                      { label: 'Black', abbr: 'K', drops: job.black, hex: '#212121' },
                      { label: 'Lt Cyan', abbr: 'c', drops: job.lightCyan, hex: '#80DEEA' },
                      { label: 'Lt Magenta', abbr: 'm', drops: job.lightMagenta, hex: '#F48FB1' },
                      { label: 'Lt Yellow', abbr: 'y', drops: job.lightYellow, hex: '#FFF9C4' },
                      { label: 'Lt Black', abbr: 'k', drops: job.lightBlack, hex: '#757575' },
                      { label: 'White', abbr: 'W', drops: job.white, hex: '#9e9e9e' },
                    ].filter(ch => ch.drops > 0);

                    // Calculate print duration
                    let durationStr = '—';
                    if (job.printStart && job.printFinish) {
                      try {
                        const ms = new Date(job.printFinish).getTime() - new Date(job.printStart).getTime();
                        if (ms > 0) {
                          const mins = Math.round(ms / 60000);
                          durationStr = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
                        }
                      } catch { /* ignore */ }
                    }

                    const totalDrops = inkChannels.reduce((s, ch) => s + ch.drops, 0);

                    return (
                      <React.Fragment key={idx}>
                        <tr
                          className="cursor-pointer hover:bg-gray-50"
                          onClick={() => setExpandedJob(isExpanded ? null : `hist-${idx}`)}
                        >
                          <td className="py-2 pr-3">
                            <div className="font-medium text-gray-900 truncate max-w-[220px]" title={job.jobName}>
                              {job.jobName}
                            </div>
                            {orderNum && (
                              <button
                                className="text-xs text-purple-600 hover:text-purple-800 hover:underline"
                                onClick={(e) => navigateToOrderZund(orderNum, e)}
                              >
                                → {orderNum}
                              </button>
                            )}
                          </td>
                          <td className="py-2 pr-3 text-xs text-gray-500">
                            {job.printFinish ? format(new Date(job.printFinish), 'MMM d, h:mm a') : '—'}
                          </td>
                          <td className="py-2 pr-3 text-xs text-gray-600 font-medium">{durationStr}</td>
                          <td className="py-2 pr-3 text-right text-gray-600">
                            {job.sqFeet ? `${job.sqFeet.toFixed(1)} ft²` : '—'}
                          </td>
                          <td className="py-2 pr-3">
                            <div className="flex items-center gap-0.5 flex-wrap">
                              {inkChannels.slice(0, 5).map((ch, ci) => (
                                <span
                                  key={ci}
                                  className="h-3.5 w-3.5 rounded-full border border-gray-200"
                                  style={{ backgroundColor: ch.hex }}
                                  title={`${ch.label}: ${(ch.drops / 1000).toFixed(0)}k drops`}
                                />
                              ))}
                              {inkChannels.length > 5 && (
                                <span className="text-xs text-gray-400 ml-0.5">+{inkChannels.length - 5}</span>
                              )}
                              <span className="text-xs text-gray-400 ml-1">{(totalDrops / 1_000_000).toFixed(2)}M</span>
                            </div>
                          </td>
                          <td className="py-2 pr-3">
                            {fieryJob?.hasZccCutFile ? (
                              orderNum ? (
                                <button
                                  onClick={(e) => navigateToOrderZund(orderNum, e)}
                                  className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded font-medium hover:bg-green-100 hover:ring-1 hover:ring-green-300 transition-all cursor-pointer"
                                  title={`View cut details for ${orderNum}`}
                                >
                                  <Scissors className="h-3 w-3" /> ZCC
                                </button>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded font-medium">
                                  <Scissors className="h-3 w-3" /> ZCC
                                </span>
                              )
                            ) : (
                              <span className="text-xs text-gray-300">—</span>
                            )}
                          </td>
                          <td className="py-2 pr-3 text-right">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              job.printResult === 2 ? 'bg-green-100 text-green-700'
                              : job.printResult === 3 ? 'bg-amber-100 text-amber-700'
                              : job.printResult === 1 ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-700'
                            }`}>
                              {job.printResult === 2 ? 'Complete' : job.printResult === 3 ? 'Partial' : job.printResult === 1 ? 'Failed' : `Result ${job.printResult}`}
                            </span>
                          </td>
                          <td className="py-2 w-8 text-gray-400">
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={8} className="px-4 py-3 bg-gray-50 border-l-4 border-purple-300">
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 text-xs mb-3">
                                <div>
                                  <span className="text-gray-400">Print Start:</span>
                                  <span className="ml-1 text-gray-700">{job.printStart ? format(new Date(job.printStart), 'MMM d, h:mm:ss a') : '—'}</span>
                                </div>
                                <div>
                                  <span className="text-gray-400">Print Finish:</span>
                                  <span className="ml-1 text-gray-700">{job.printFinish ? format(new Date(job.printFinish), 'MMM d, h:mm:ss a') : '—'}</span>
                                </div>
                                <div>
                                  <span className="text-gray-400">Duration:</span>
                                  <span className="ml-1 text-gray-700 font-medium">{durationStr}</span>
                                </div>
                                <div>
                                  <span className="text-gray-400">Print ID:</span>
                                  <span className="ml-1 text-gray-700 font-mono">{job.printId}</span>
                                </div>
                                <div>
                                  <span className="text-gray-400">Completion:</span>
                                  <span className="ml-1 text-gray-700">{job.percentComplete}%</span>
                                </div>
                                <div>
                                  <span className="text-gray-400">Area:</span>
                                  <span className="ml-1 text-gray-700">{job.sqFeet ? `${job.sqFeet.toFixed(2)} ft²` : '—'}</span>
                                </div>
                                {fieryJob?.dimensions && (
                                  <div>
                                    <span className="text-gray-400">Sheet Size:</span>
                                    <span className="ml-1 text-gray-700">{fieryJob.dimensions.widthIn.toFixed(1)}" × {fieryJob.dimensions.heightIn.toFixed(1)}"</span>
                                  </div>
                                )}
                                {fieryJob?.media?.description && (
                                  <div>
                                    <span className="text-gray-400">Media:</span>
                                    <span className="ml-1 text-gray-700">{fieryJob.media.description}</span>
                                  </div>
                                )}
                                {fieryJob?.media?.brand && (
                                  <div>
                                    <span className="text-gray-400">Media Brand:</span>
                                    <span className="ml-1 text-gray-700">{fieryJob.media.brand}</span>
                                  </div>
                                )}
                              </div>

                              {/* Per-channel ink breakdown */}
                              <div className="text-xs text-gray-400 font-medium mb-1.5">Ink Breakdown</div>
                              <div className="flex flex-wrap gap-1.5">
                                {inkChannels.map((ch, ci) => (
                                  <span key={ci} className="inline-flex items-center gap-1.5 px-2 py-1 bg-white border border-gray-200 rounded text-xs">
                                    <span className="h-3 w-3 rounded-full border border-gray-200" style={{ backgroundColor: ch.hex }} />
                                    <span className="text-gray-600">{ch.label}</span>
                                    <span className="font-medium text-gray-800">{(ch.drops / 1000).toFixed(0)}k</span>
                                  </span>
                                ))}
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 border border-purple-200 rounded text-xs">
                                  <span className="text-purple-600">Total</span>
                                  <span className="font-medium text-purple-800">{(totalDrops / 1_000_000).toFixed(2)}M drops</span>
                                </span>
                              </div>

                              {/* ZCC + Work Order info */}
                              {(fieryJob?.hasZccCutFile || orderNum) && (
                                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-200">
                                  {fieryJob?.hasZccCutFile && (
                                    orderNum ? (
                                      <button
                                        onClick={(e) => navigateToOrderZund(orderNum, e)}
                                        className="inline-flex items-center gap-1.5 text-xs text-green-700 bg-green-50 px-2.5 py-1 rounded-lg border border-green-200 hover:bg-green-100 hover:ring-1 hover:ring-green-300 transition-all cursor-pointer"
                                        title={`View cut details for ${orderNum}`}
                                      >
                                        <Scissors className="h-3.5 w-3.5" />
                                        ZCC Cut File — View Details
                                      </button>
                                    ) : (
                                      <span className="inline-flex items-center gap-1.5 text-xs text-green-700 bg-green-50 px-2.5 py-1 rounded-lg border border-green-200">
                                        <Scissors className="h-3.5 w-3.5" />
                                        ZCC Cut File Available
                                      </span>
                                    )
                                  )}
                                  {orderNum && (
                                    <button
                                      onClick={(e) => navigateToOrderZund(orderNum, e)}
                                      className="inline-flex items-center gap-1.5 text-xs text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200 hover:bg-purple-100 transition-all cursor-pointer"
                                    >
                                      <FileText className="h-3.5 w-3.5" />
                                      View Work Order {orderNum}
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CollapsibleSection>
        );
      })()}

      {/* ---- Fiery Print Logs (with WO Linking) ---- */}
      {fieryJobs && fieryJobs.length > 0 && (() => {
        const linkedJobs = fieryJobs.filter((j: any) => j.workOrder);
        const highConfidence = fieryJobs.filter((j: any) => j.linkConfidence === 'high').length;
        const withCutFiles = fieryJobs.filter((j: any) => j.hasZccCutFile).length;

        return (
          <CollapsibleSection
            title="Fiery Print Logs"
            icon={<Printer className="h-5 w-5 text-indigo-500" />}
            badge={
              <span className="text-xs text-gray-400 font-normal ml-1">
                {fieryJobs.length} job{fieryJobs.length !== 1 ? 's' : ''} · {linkedJobs.length} linked to orders
              </span>
            }
            subtitle="Source: Fiery XF Export Folder + Thrive cross-reference"
            defaultOpen={true}
          >
            {/* Summary stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-indigo-700">{fieryJobs.length}</div>
                <div className="text-xs text-indigo-600">Total Jobs</div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-green-700">{linkedJobs.length}</div>
                <div className="text-xs text-green-600">Linked to WO</div>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-purple-700">{highConfidence}</div>
                <div className="text-xs text-purple-600">High Confidence</div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-amber-700">{withCutFiles}</div>
                <div className="text-xs text-amber-600">With Cut Files</div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wider">
                    <th className="pb-2 pr-3">Job</th>
                    <th className="pb-2 pr-3">Work Order</th>
                    <th className="pb-2 pr-3">Date</th>
                    <th className="pb-2 pr-3">Media</th>
                    <th className="pb-2 pr-3">Dimensions</th>
                    <th className="pb-2 pr-3">Cut File</th>
                    <th className="pb-2 pr-3">Confidence</th>
                    <th className="pb-2 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {fieryJobs.map((job: any, idx: number) => {
                    const isExpanded = expandedJob === `fiery-${idx}`;
                    const dims = job.dimensions;
                    const widthIn = dims ? (dims.width / 72).toFixed(1) : null;
                    const heightIn = dims ? (dims.height / 72).toFixed(1) : null;

                    return (
                      <React.Fragment key={job.jobId || idx}>
                        <tr
                          className="cursor-pointer hover:bg-gray-50"
                          onClick={() => setExpandedJob(isExpanded ? null : `fiery-${idx}`)}
                        >
                          <td className="py-2 pr-3">
                            <div className="font-medium text-gray-900 truncate max-w-[220px]" title={job.jobName}>
                              {job.jobName}
                            </div>
                            {job.fileName && job.fileName !== job.jobName && (
                              <div className="text-xs text-gray-400 truncate max-w-[220px]" title={job.fileName}>
                                {job.fileName}
                              </div>
                            )}
                          </td>
                          <td className="py-2 pr-3">
                            {job.workOrder ? (
                              <button
                                className="inline-flex items-center gap-1 text-xs font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded hover:bg-purple-100 transition-colors"
                                onClick={(e) => navigateToOrderZund(job.workOrder.orderNumber, e)}
                              >
                                <FileText className="h-3 w-3" />
                                {job.workOrder.orderNumber}
                              </button>
                            ) : job.workOrderNumber ? (
                              <button
                                className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-purple-700"
                                onClick={(e) => navigateToOrderZund(job.workOrderNumber, e)}
                              >
                                {job.workOrderNumber}
                              </button>
                            ) : (
                              <span className="text-xs text-gray-300">—</span>
                            )}
                            {job.workOrder?.customerName && (
                              <div className="text-xs text-gray-400 truncate max-w-[160px]">
                                {job.workOrder.customerName}
                              </div>
                            )}
                          </td>
                          <td className="py-2 pr-3 text-xs text-gray-500">
                            {job.timestamp ? fmtDate(job.timestamp) : '—'}
                          </td>
                          <td className="py-2 pr-3">
                            {job.media?.description ? (
                              <div className="text-xs text-gray-700 truncate max-w-[140px]" title={`${job.media.brand || ''} ${job.media.description}`}>
                                {job.media.description}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-300">—</span>
                            )}
                          </td>
                          <td className="py-2 pr-3 text-xs text-gray-600">
                            {widthIn && heightIn ? `${widthIn}" × ${heightIn}"` : '—'}
                          </td>
                          <td className="py-2 pr-3">
                            {job.hasZccCutFile ? (
                              job.workOrder ? (
                                <button
                                  onClick={(e) => navigateToOrderZund(job.workOrder.orderNumber, e)}
                                  className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded font-medium hover:bg-green-100 transition-all"
                                  title={job.zccFileName || 'ZCC cut file'}
                                >
                                  <Scissors className="h-3 w-3" /> ZCC
                                </button>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded font-medium">
                                  <Scissors className="h-3 w-3" /> ZCC
                                </span>
                              )
                            ) : (
                              <span className="text-xs text-gray-300">—</span>
                            )}
                          </td>
                          <td className="py-2 pr-3">
                            {job.linkConfidence && job.linkConfidence !== 'none' && (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                job.linkConfidence === 'high' ? 'bg-green-100 text-green-700'
                                : job.linkConfidence === 'medium' ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-gray-100 text-gray-600'
                              }`}>
                                {job.linkConfidence}
                              </span>
                            )}
                          </td>
                          <td className="py-2 w-8 text-gray-400">
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={8} className="px-4 py-3 bg-gray-50 border-l-4 border-indigo-300">
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 text-xs mb-3">
                                {job.media?.brand && (
                                  <div>
                                    <span className="text-gray-400">Media Brand:</span>
                                    <span className="ml-1 text-gray-700">{job.media.brand}</span>
                                  </div>
                                )}
                                {job.media?.description && (
                                  <div>
                                    <span className="text-gray-400">Media:</span>
                                    <span className="ml-1 text-gray-700">{job.media.description}</span>
                                  </div>
                                )}
                                {job.media?.type && (
                                  <div>
                                    <span className="text-gray-400">Media Type:</span>
                                    <span className="ml-1 text-gray-700">{job.media.type}</span>
                                  </div>
                                )}
                                {widthIn && heightIn && (
                                  <div>
                                    <span className="text-gray-400">Sheet Size:</span>
                                    <span className="ml-1 text-gray-700">{widthIn}" × {heightIn}"</span>
                                  </div>
                                )}
                                {job.inks?.length > 0 && (
                                  <div>
                                    <span className="text-gray-400">Inks:</span>
                                    <span className="ml-1 text-gray-700">{job.inks.join(', ')}</span>
                                  </div>
                                )}
                                {job.zccFileName && (
                                  <div>
                                    <span className="text-gray-400">Cut File:</span>
                                    <span className="ml-1 text-gray-700 font-mono">{job.zccFileName}</span>
                                  </div>
                                )}
                                {job.thriveFilePath && (
                                  <div className="col-span-2">
                                    <span className="text-gray-400">Thrive Path:</span>
                                    <span className="ml-1 text-gray-700 font-mono text-[11px]">{job.thriveFilePath}</span>
                                  </div>
                                )}
                                {job.workOrder && (
                                  <>
                                    <div>
                                      <span className="text-gray-400">Order:</span>
                                      <button
                                        className="ml-1 text-purple-700 hover:underline font-medium"
                                        onClick={(e) => navigateToOrderZund(job.workOrder.orderNumber, e)}
                                      >
                                        {job.workOrder.orderNumber}
                                      </button>
                                    </div>
                                    <div>
                                      <span className="text-gray-400">Customer:</span>
                                      <span className="ml-1 text-gray-700">{job.workOrder.customerName}</span>
                                    </div>
                                    <div>
                                      <span className="text-gray-400">Status:</span>
                                      <span className="ml-1 text-gray-700">{job.workOrder.status}</span>
                                    </div>
                                  </>
                                )}
                              </div>

                              {/* Link reasons */}
                              {job.linkReasons?.length > 0 && (
                                <div className="text-xs">
                                  <span className="text-gray-400 font-medium">Match reasons: </span>
                                  <span className="text-gray-600">{job.linkReasons.join(' · ')}</span>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CollapsibleSection>
        );
      })()}

      {/* ---- Data Source Info ---- */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-gray-500">
            <div className="font-medium text-gray-600 mb-1">Data Sources</div>
            <p>
              <strong>History:</strong> VUTEk controller MySQL database via SSH — ink consumption, job timing, and print results.
              <strong> Cut Files:</strong> Fiery Export Folder (SMB share) — ZCC cut file matching.
              <strong> Ink Levels:</strong> SSH bag consumption tracking (RFID tags non-functional, estimates based on usage history).
              <strong> Fiery Logs:</strong> JDF metadata from Fiery Export Folder with Thrive cross-reference for WO linking.
              <strong> Connectivity:</strong> TCP port scanning.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

function EWSPanel({ ews }: { ews: any }) {
  const [showAllJobs, setShowAllJobs] = useState(false);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  // Safety helper: HP EWS API sometimes returns {Unit, Value} objects
  // instead of plain numbers/strings. Extract the Value if so.
  const sv = (v: any): string | number => {
    if (v == null) return '';
    if (typeof v === 'object' && 'Value' in v) return v.Value ?? '';
    return v;
  };

  const status = ews.status;
  const identity = ews.identity;
  const ink = ews.ink || [];
  const printheads = ews.printheads || [];
  const maintenance = ews.maintenance || [];
  const alerts = ews.alerts || [];
  const jobs = ews.jobs || [];

  const visibleJobs = showAllJobs ? jobs : jobs.slice(0, 10);

  function fmtTime(seconds: number): string {
    if (!seconds || seconds <= 0) return '';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  function fmtDate(ts: string | null): string {
    if (!ts) return '—';
    try {
      return format(new Date(ts), 'MMM d, h:mm a');
    } catch {
      return ts;
    }
  }

  function fmtSqFt(sqIn: number): string {
    if (!sqIn) return '0';
    return (sqIn / 144).toFixed(1);
  }

  return (
    <>
      {/* ---- EWS Alerts ---- */}
      {(() => {
        if (alerts.length === 0) return null;
        const severityCounts: Record<string, number> = {};
        alerts.forEach((a: any) => {
          const sev = a.severity || 'warning';
          severityCounts[sev] = (severityCounts[sev] || 0) + 1;
        });
        return (
          <CollapsibleSection
            title="EWS Alerts"
            icon={<AlertTriangle className="h-5 w-5 text-amber-500" />}
            badge={
              <span className="flex items-center gap-2 text-xs font-normal ml-1">
                {Object.entries(severityCounts).map(([sev, count]) => (
                  <span key={sev} className={`px-1.5 py-0.5 rounded font-bold ${
                    sev.toLowerCase().includes('crit') || sev.toLowerCase().includes('error')
                      ? 'bg-red-200 text-red-700'
                      : 'bg-amber-200 text-amber-700'
                  }`}>{count} {sev}</span>
                ))}
              </span>
            }
            subtitle={`${alerts.length} alert${alerts.length === 1 ? '' : 's'} from HP Embedded Web Server`}
            defaultOpen={false}
          >
            <div className="space-y-1">
              {alerts.map((alert: any, i: number) => (
                <div key={i} className="text-sm text-amber-800 flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                  {alert.description}
                  {alert.severity && (
                    <span className="text-xs bg-amber-200 px-1.5 py-0.5 rounded">{alert.severity}</span>
                  )}
                </div>
              ))}
            </div>
          </CollapsibleSection>
        );
      })()}

      {/* ---- Ink Cartridges ---- */}
      {ink.length > 0 && (() => {
        const supplyCartridges = ink.filter((c: any) => c.supplyType === 'Supply');
        const warningCartridges = supplyCartridges.filter((c: any) => {
          const level = c.levelPercent;
          return level >= 0 && level <= 20;
        });
        const hasWarnings = warningCartridges.length > 0;

        return (
        <CollapsibleSection
          title={`${ink[0]?.orderNumber || 'HP'} Ink Cartridges`}
          icon={<Droplets className="h-5 w-5 text-gray-400" />}
          badge={
            <span className="text-xs text-gray-400 font-normal ml-1">
              {supplyCartridges.length} cartridge{supplyCartridges.length !== 1 ? 's' : ''}
              {hasWarnings && <span className="ml-2 text-amber-600 font-medium">{warningCartridges.length} low</span>}
            </span>
          }
          subtitle="Source: HP Latex EWS"
          defaultOpen={false}
          warningContent={hasWarnings ? (
            <div className="space-y-2">
              {warningCartridges.map((cartridge: any, i: number) => {
                const level = cartridge.levelPercent;
                const isCritical = level >= 0 && level <= 10;
                return (
                  <div key={i} className={`flex items-center gap-3 p-2 rounded-lg ${
                    isCritical ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'
                  }`}>
                    <div className="h-4 w-4 rounded-full border border-gray-200 flex-shrink-0" style={{ backgroundColor: cartridge.colorHex }} />
                    <span className="text-sm font-medium capitalize flex-1">{cartridge.color}</span>
                    <div className="w-20 bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.max(level, 2)}%`, backgroundColor: cartridge.colorHex || '#6b7280' }} />
                    </div>
                    <span className={`text-sm font-bold w-10 text-right ${isCritical ? 'text-red-600' : 'text-amber-600'}`}>{level}%</span>
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${isCritical ? 'bg-red-200 text-red-700' : 'bg-amber-200 text-amber-700'}`}>
                      {isCritical ? 'CRIT' : 'LOW'}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : undefined}
        >
          <div className="space-y-3">
            {supplyCartridges.map((cartridge: any, i: number) => {
              const level = cartridge.levelPercent;
              const isLow = level >= 0 && level <= 20;
              const isCritical = level >= 0 && level <= 10;
              return (
                <div key={i} className={`border rounded-lg p-4 ${
                  isCritical ? 'border-red-200 bg-red-50' :
                  isLow ? 'border-amber-200 bg-amber-50' :
                  'border-gray-100'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-6 w-6 rounded-full border-2 border-gray-200"
                        style={{ backgroundColor: cartridge.colorHex }}
                      />
                      <div>
                        <span className="font-medium text-gray-900 capitalize">{cartridge.color}</span>
                        <span className="text-xs text-gray-400 ml-2">{cartridge.partNumber || cartridge.orderNumber}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-2xl font-bold ${
                        isCritical ? 'text-red-600' :
                        isLow ? 'text-amber-600' :
                        level >= 0 ? 'text-gray-900' : 'text-gray-400'
                      }`}>
                        {level >= 0 ? `${level}%` : '—'}
                      </span>
                      {isCritical && <div className="text-xs text-red-600 font-medium">CRITICAL</div>}
                      {isLow && !isCritical && <div className="text-xs text-amber-600 font-medium">LOW</div>}
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden mb-2">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${level >= 0 ? Math.max(level, 2) : 0}%`,
                        backgroundColor: cartridge.colorHex || '#6b7280',
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-xs text-gray-500">
                    <span>Level: <span className="font-medium text-gray-700">{sv(cartridge.levelCc)}cc / {sv(cartridge.capacityCc)}cc</span></span>
                    <span>Batch: <span className="font-mono text-gray-700">{sv(cartridge.batchId) || '—'}</span></span>
                    <span>Ink Used: <span className="font-medium text-gray-700">{sv(cartridge.cumulativeInkUsedCc)}cc lifetime</span></span>
                    <span>Insertions: <span className="font-medium text-gray-700">{sv(cartridge.insertionCount)}</span></span>
                    <span>S/N: <span className="font-mono text-gray-700">{sv(cartridge.serialNumber) || '—'}</span></span>
                    <span>State: <span className="font-medium text-gray-700">{sv(cartridge.state)}</span></span>
                    <span>Installed: <span className="font-medium text-gray-700">{fmtDate(cartridge.installDate)}</span></span>
                    <span>Expires: <span className="font-medium text-gray-700">{fmtDate(cartridge.expirationDate)}</span></span>
                  </div>
                </div>
              );
            })}
          </div>
        </CollapsibleSection>
        );
      })()}

      {/* ---- Printheads ---- */}
      {printheads.length > 0 && (() => {
        const warningHeads = printheads.filter((ph: any) => ph.healthGaugeLevel >= 0 && ph.healthGaugeLevel <= 30);
        const hasWarnings = warningHeads.length > 0;
        return (
        <CollapsibleSection
          title="Printheads"
          icon={<Cpu className="h-5 w-5 text-gray-400" />}
          badge={
            <span className="text-xs text-gray-400 font-normal ml-1">
              {printheads.length} head{printheads.length !== 1 ? 's' : ''}
              {hasWarnings && <span className="ml-2 text-amber-600 font-medium">{warningHeads.length} degraded</span>}
            </span>
          }
          subtitle="Source: HP Latex EWS"
          defaultOpen={false}
          warningContent={hasWarnings ? (
            <div className="space-y-2">
              {warningHeads.map((ph: any, i: number) => {
                const colorNames = (ph.colors || []).filter((c: string) => c && c !== 'void');
                return (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-amber-50 border border-amber-200">
                    <span className="text-sm font-medium flex-1">Slot {ph.slotId}</span>
                    <div className="flex items-center gap-1">
                      {colorNames.map((c: string, ci: number) => (
                        <div key={ci} className="h-3 w-3 rounded-full border border-gray-300" style={{ backgroundColor: INK_COLOR_MAP[c.toLowerCase()] || '#9e9e9e' }} title={c} />
                      ))}
                    </div>
                    <div className="w-16 bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.max(ph.healthGaugeLevel, 1)}%` }} />
                    </div>
                    <span className="text-sm font-bold text-amber-600 w-10 text-right">{ph.healthGaugeLevel}%</span>
                  </div>
                );
              })}
            </div>
          ) : undefined}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {printheads.map((ph: any, i: number) => {
              const health = ph.healthGaugeLevel;
              const isHealthLow = health >= 0 && health <= 30;
              const colorNames = (ph.colors || []).filter((c: string) => c && c !== 'void');
              return (
                <div key={i} className={`border rounded-lg p-4 ${
                  isHealthLow ? 'border-amber-200 bg-amber-50' : 'border-gray-100'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">Printhead {ph.slotId}</span>
                        {ph.orderNumber && <span className="text-xs text-gray-400">{ph.orderNumber}</span>}
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        {colorNames.length > 0 ? colorNames.map((c: string, ci: number) => (
                          <div
                            key={ci}
                            className="h-4 w-4 rounded-full border border-gray-300"
                            style={{ backgroundColor: INK_COLOR_MAP[c.toLowerCase()] || '#9e9e9e' }}
                            title={c}
                          />
                        )) : (
                          <span className="text-xs text-gray-400 italic">Empty slot</span>
                        )}
                        {colorNames.length > 0 && (
                          <span className="text-xs text-gray-500 ml-1">
                            {colorNames.map((c: string) => c.charAt(0).toUpperCase() + c.slice(1).replace(/-/g, ' ')).join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-xl font-bold ${
                        isHealthLow ? 'text-amber-600' : 'text-gray-900'
                      }`}>
                        {health >= 0 ? `${health}%` : '—'}
                      </div>
                      <div className="text-xs text-gray-500">Health</div>
                    </div>
                  </div>
                  {health >= 0 && (
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden mb-2">
                      <div
                        className={`h-full rounded-full ${isHealthLow ? 'bg-amber-500' : 'bg-green-500'}`}
                        style={{ width: `${Math.max(health, 1)}%` }}
                      />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500">
                    <span>Ink Consumed: <span className="font-medium text-gray-700">{sv(ph.inkConsumptionCc)}cc</span></span>
                    <span>Warranty: <span className={`font-medium ${ph.inWarranty ? 'text-green-600' : 'text-gray-700'}`}>{ph.inWarranty ? 'In Warranty' : 'Out of Warranty'}</span></span>
                    {ph.partNumber && <span>Part#: <span className="font-medium text-gray-700">{ph.partNumber}</span></span>}
                    {ph.serialNumber && <span>S/N: <span className="font-medium text-gray-700">{ph.serialNumber}</span></span>}
                    {ph.installDate && <span>Installed: <span className="font-medium text-gray-700">{fmtDate(ph.installDate)}</span></span>}
                    <span>Expires: <span className="font-medium text-gray-700">{fmtDate(ph.expirationDate)}</span></span>
                    <span>Status: <span className="font-medium text-gray-700">{sv(ph.statusFlag)}</span></span>
                    {ph.state && ph.state !== 'Unknown' && <span>State: <span className="font-medium text-gray-700">{ph.state}</span></span>}
                  </div>
                </div>
              );
            })}
          </div>
        </CollapsibleSection>
        );
      })()}

      {/* ---- Maintenance ---- */}
      {maintenance.length > 0 && (() => {
        const consumables = maintenance.filter((m: any) => m.type !== 'pmk');
        const pmks = maintenance.filter((m: any) => m.type === 'pmk');

        // Warning consumables
        const warningConsumables = consumables.filter((item: any) => {
          const pct = typeof item.levelPercent === 'number' ? Math.round(item.levelPercent * 100) / 100 : 0;
          const isHigh = (item.type === 'condensate' || item.type === 'waste_collector') && pct >= 80;
          const isLow = item.type === 'liquid_tank' && pct <= 20;
          return isHigh || isLow;
        });

        // Warning PMKs
        const warningPmks = pmks.filter((pmk: any) => Math.round(pmk.levelPercent) >= 80);

        return (
        <>
        {consumables.length > 0 && (
        <CollapsibleSection
          title="Maintenance Components"
          icon={<Wrench className="h-5 w-5 text-gray-400" />}
          badge={
            <span className="text-xs text-gray-400 font-normal ml-1">
              {consumables.length} item{consumables.length !== 1 ? 's' : ''}
              {warningConsumables.length > 0 && <span className="ml-2 text-amber-600 font-medium">{warningConsumables.length} attention</span>}
            </span>
          }
          subtitle="Source: HP Latex EWS PrinterMaintenance API"
          defaultOpen={false}
          warningContent={warningConsumables.length > 0 ? (
            <div className="space-y-2">
              {warningConsumables.map((item: any, i: number) => {
                const pct = typeof item.levelPercent === 'number' ? Math.round(item.levelPercent * 100) / 100 : 0;
                return (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-amber-50 border border-amber-200">
                    <span className="text-sm font-medium flex-1">{item.name}</span>
                    <div className="w-20 bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.min(Math.max(pct, 2), 100)}%` }} />
                    </div>
                    <span className="text-sm font-bold text-amber-600 w-12 text-right">{pct.toFixed(0)}%</span>
                  </div>
                );
              })}
            </div>
          ) : undefined}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {consumables.map((item: any, i: number) => {
              const pct = typeof item.levelPercent === 'number' ? Math.round(item.levelPercent * 100) / 100 : 0;
              const isHigh = (item.type === 'condensate' || item.type === 'waste_collector') && pct >= 80;
              const isLow = item.type === 'liquid_tank' && pct <= 20;
              return (
                <div key={i} className={`border rounded-lg p-4 ${
                  isHigh || isLow ? 'border-amber-200 bg-amber-50' : 'border-gray-100'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900">{item.name}</span>
                    <span className={`text-xl font-bold ${
                      isHigh || isLow ? 'text-amber-600' : 'text-gray-900'
                    }`}>{pct.toFixed(pct % 1 ? 1 : 0)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden mb-2">
                    <div
                      className={`h-full rounded-full ${
                        isHigh ? 'bg-amber-500' : isLow ? 'bg-amber-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    {(item.currentCc > 0 || item.totalCapacityCc > 0) && <span>{sv(item.currentCc)}cc / {sv(item.totalCapacityCc)}cc</span>}
                    <span>State: {sv(item.state)}</span>
                    {item.liquidType && <span>Type: {sv(item.liquidType)}</span>}
                    {item.partNumber && <span>Part#: {item.partNumber}</span>}
                  </div>
                  {isHigh && item.type === 'condensate' && <div className="text-xs text-amber-600 font-medium mt-1">Condensate collector nearly full — needs emptying soon</div>}
                  {isHigh && item.type === 'waste_collector' && <div className="text-xs text-amber-600 font-medium mt-1">Waste collector nearly full — needs replacement soon</div>}
                  {isLow && <div className="text-xs text-amber-600 font-medium mt-1">Liquid level low — refill needed</div>}
                </div>
              );
            })}
          </div>
        </CollapsibleSection>
        )}

        {/* ---- Preventive Maintenance Kits ---- */}
        {pmks.length > 0 && (
        <CollapsibleSection
          title="Preventive Maintenance Schedule"
          icon={<Wrench className="h-5 w-5 text-gray-400" />}
          badge={
            <span className="text-xs text-gray-400 font-normal ml-1">
              {pmks.length} item{pmks.length !== 1 ? 's' : ''}
              {warningPmks.length > 0 && <span className="ml-2 text-amber-600 font-medium">{warningPmks.length} due</span>}
            </span>
          }
          subtitle="Source: HP Latex EWS PreventiveMaintenanceKits"
          defaultOpen={false}
          warningContent={warningPmks.length > 0 ? (
            <div className="space-y-2">
              {warningPmks.map((pmk: any, i: number) => {
                const pct = Math.round(pmk.levelPercent);
                const isOverdue = pct >= 100;
                return (
                  <div key={i} className={`flex items-center gap-3 p-2 rounded-lg ${
                    isOverdue ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'
                  }`}>
                    <span className="text-sm font-medium flex-1">{pmk.name}</span>
                    <div className="w-20 bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div className={`h-full rounded-full ${isOverdue ? 'bg-red-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                    <span className={`text-sm font-bold w-12 text-right ${isOverdue ? 'text-red-600' : 'text-amber-600'}`}>{pct}%</span>
                    {isOverdue && <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-red-200 text-red-700">OVERDUE</span>}
                  </div>
                );
              })}
            </div>
          ) : undefined}
        >
          <div className="space-y-3">
            {pmks.map((pmk: any, i: number) => {
              const pct = Math.round(pmk.levelPercent);
              const isOverdue = pct >= 100;
              const isDue = pct >= 80;
              return (
                <div key={i} className={`border rounded-lg p-3 ${
                  isOverdue ? 'border-red-200 bg-red-50' : isDue ? 'border-amber-200 bg-amber-50' : 'border-gray-100'
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <span className="font-medium text-gray-900 text-sm">{pmk.name}</span>
                      {pmk.partNumber && <span className="text-xs text-gray-400 ml-2">{pmk.partNumber}</span>}
                    </div>
                    <div className="text-right">
                      <span className={`text-lg font-bold ${
                        isOverdue ? 'text-red-600' : isDue ? 'text-amber-600' : 'text-gray-900'
                      }`}>{pct}%</span>
                      <div className="text-xs text-gray-500">{sv(pmk.state)}</div>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        isOverdue ? 'bg-red-500' : isDue ? 'bg-amber-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  {isOverdue && <div className="text-xs text-red-600 font-medium mt-1">Overdue — maintenance needed</div>}
                </div>
              );
            })}
          </div>
        </CollapsibleSection>
        )}
        </>
        );
      })()}

      {/* ---- Job Queue / History ---- */}
      {jobs.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="h-5 w-5 text-gray-400" />
              Print Job Queue
            </h2>
            <span className="text-sm text-gray-500">{jobs.length} jobs</span>
          </div>
          <p className="text-xs text-gray-400 mb-4">
            Source: HP Latex EWS JobQueue API · Queue {ews.jobQueueStatus}
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wider">
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Job Name</th>
                  <th className="pb-2 pr-4">Copies</th>
                  <th className="pb-2 pr-4">Arrived</th>
                  <th className="pb-2 pr-4 text-right">Ink (cc)</th>
                  <th className="pb-2 pr-4 text-right">Media (ft²)</th>
                  <th className="pb-2 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visibleJobs.map((job: any) => {
                  const isActive = job.status === 'Printing';
                  const isCancelled = job.completionStatus === 'Cancelled';
                  const isExpanded = expandedJob === job.uuid;
                  return (
                    <React.Fragment key={job.uuid}>
                      <tr
                        className={`cursor-pointer hover:bg-gray-50 ${isActive ? 'bg-blue-50' : ''}`}
                        onClick={() => setExpandedJob(isExpanded ? null : job.uuid)}
                      >
                        <td className="py-2 pr-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            isActive ? 'bg-blue-100 text-blue-700' :
                            isCancelled ? 'bg-red-100 text-red-700' :
                            job.status === 'Completed' ? 'bg-green-100 text-green-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {isActive && <span className="h-1.5 w-1.5 rounded-full bg-blue-500 mr-1 animate-pulse" />}
                            {job.status}
                          </span>
                        </td>
                        <td className="py-2 pr-4">
                          <div className="font-medium text-gray-900 truncate max-w-[250px]" title={job.name}>
                            {job.name}
                          </div>
                          {isActive && job.progressPercent > 0 && (
                            <div className="w-full bg-blue-200 rounded-full h-1.5 mt-1">
                              <div className="h-full bg-blue-600 rounded-full" style={{ width: `${job.progressPercent}%` }} />
                            </div>
                          )}
                        </td>
                        <td className="py-2 pr-4 text-gray-600">
                          {isActive ? `${job.printedCopies}/${job.copies}` : job.copies}
                        </td>
                        <td className="py-2 pr-4 text-gray-500 text-xs">{fmtDate(job.arrivedAt)}</td>
                        <td className="py-2 pr-4 text-right text-gray-600">{Number(sv(job.totalInkCc)) > 0 ? sv(job.totalInkCc) : '—'}</td>
                        <td className="py-2 pr-4 text-right text-gray-600">{Number(sv(job.mediaUsageSqIn)) > 0 ? fmtSqFt(Number(sv(job.mediaUsageSqIn))) : '—'}</td>
                        <td className="py-2 w-8 text-gray-400">
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={7} className="px-4 py-3 bg-gray-50">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 text-xs">
                              <div>
                                <span className="text-gray-400">Submitted:</span>
                                <span className="ml-1 text-gray-700">{fmtDate(job.submittedAt)}</span>
                              </div>
                              <div>
                                <span className="text-gray-400">Started Printing:</span>
                                <span className="ml-1 text-gray-700">{fmtDate(job.printingAt)}</span>
                              </div>
                              <div>
                                <span className="text-gray-400">Completed:</span>
                                <span className="ml-1 text-gray-700">{fmtDate(job.completedAt)}</span>
                              </div>
                              <div>
                                <span className="text-gray-400">Application:</span>
                                <span className="ml-1 text-gray-700">{job.applicationName?.split('|')[0] || '—'}</span>
                              </div>
                              <div>
                                <span className="text-gray-400">User:</span>
                                <span className="ml-1 text-gray-700">{job.userName || '—'}</span>
                              </div>
                              <div>
                                <span className="text-gray-400">Hold Reason:</span>
                                <span className="ml-1 text-gray-700">{sv(job.holdReason)}</span>
                              </div>
                              <div>
                                <span className="text-gray-400">Completion:</span>
                                <span className="ml-1 text-gray-700">{sv(job.completionStatus) || '—'}</span>
                              </div>
                              <div>
                                <span className="text-gray-400">Pages:</span>
                                <span className="ml-1 text-gray-700">{sv(job.printedPages)}/{sv(job.totalPages)}</span>
                              </div>
                            </div>
                            {job.inkUsage && job.inkUsage.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-gray-200">
                                <div className="text-xs text-gray-400 mb-2">Ink Consumption Per Channel:</div>
                                <div className="flex flex-wrap gap-2">
                                  {job.inkUsage.map((ink: any, ii: number) => (
                                    <span key={ii} className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 rounded text-xs">
                                      <span
                                        className="h-3 w-3 rounded-full border border-gray-200"
                                        style={{ backgroundColor: INK_COLOR_MAP[ink.color] || '#9e9e9e' }}
                                      />
                                      <span className="capitalize">{String(sv(ink.color)).replace(/-/g, ' ')}</span>
                                      <span className="font-medium text-gray-700">{sv(ink.amountCc)}cc</span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {jobs.length > 10 && (
            <button
              onClick={() => setShowAllJobs(!showAllJobs)}
              className="mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              {showAllJobs ? `Show Latest 10` : `Show All ${jobs.length} Jobs`}
            </button>
          )}
        </div>
      )}
    </>
  );
}