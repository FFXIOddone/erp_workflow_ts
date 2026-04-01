import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Printer,
  Activity,
  CheckCircle,
  Pause,
  AlertCircle,
  Clock,
  Plus,
  RefreshCw,
  Layers,
  Play,
  Square,
  ChevronDown,
  ChevronUp,
  Monitor,
  Droplets,
  Zap,
  ArrowRight,
} from 'lucide-react';
import { api } from '../lib/api';
import toast from 'react-hot-toast';
import { EquipmentStatus, PrintJobStatus } from '@erp/shared';

// Types
interface PrinterWithJobs {
  id: string;
  name: string;
  type: string;
  manufacturer?: string;
  model?: string;
  location?: string;
  station?: string;
  status: EquipmentStatus;
  notes?: string;
  isPrinting: boolean;
  currentJobs: PrintJobItem[];
}

interface PrintJobItem {
  id: string;
  jobNumber: string;
  name: string;
  description?: string;
  status: PrintJobStatus;
  priority: number;
  materialType?: string;
  copies: number;
  estimatedMinutes?: number;
  actualMinutes?: number;
  startedAt?: string;
  completedAt?: string;
  operatorNotes?: string;
  errorMessage?: string;
  workOrder: {
    id: string;
    orderNumber: string;
    customerName: string;
    description?: string;
    dueDate?: string;
  };
  assignedTo?: {
    id: string;
    username: string;
    displayName: string;
  };
  queue: {
    id: string;
    name: string;
    station: string;
  };
}

interface DashboardData {
  printers: PrinterWithJobs[];
  queues: Array<{
    id: string;
    name: string;
    station: string;
    isActive: boolean;
    _count: { jobs: number };
  }>;
  activeJobs: PrintJobItem[];
  recentCompleted: PrintJobItem[];
  stats: {
    pending: number;
    printing: number;
    completedToday: number;
    totalActive: number;
  };
}

const PRINTER_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  OPERATIONAL: { label: 'Ready', color: 'text-green-600', bg: 'bg-green-100', icon: <CheckCircle className="w-4 h-4" /> },
  DEGRADED: { label: 'Degraded', color: 'text-yellow-600', bg: 'bg-yellow-100', icon: <AlertCircle className="w-4 h-4" /> },
  MAINTENANCE: { label: 'Maintenance', color: 'text-orange-600', bg: 'bg-orange-100', icon: <Clock className="w-4 h-4" /> },
  DOWN: { label: 'Down', color: 'text-red-600', bg: 'bg-red-100', icon: <AlertCircle className="w-4 h-4" /> },
  WARMING_UP: { label: 'Warming Up', color: 'text-blue-600', bg: 'bg-blue-100', icon: <Zap className="w-4 h-4" /> },
  OFFLINE: { label: 'Offline', color: 'text-gray-500', bg: 'bg-gray-100', icon: <Monitor className="w-4 h-4" /> },
};

const JOB_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: 'Pending', color: 'text-gray-600', bg: 'bg-gray-100' },
  PREPARING: { label: 'Preparing', color: 'text-blue-600', bg: 'bg-blue-100' },
  READY: { label: 'Ready', color: 'text-indigo-600', bg: 'bg-indigo-100' },
  PRINTING: { label: 'Printing', color: 'text-purple-600', bg: 'bg-purple-100' },
  DRYING: { label: 'Drying', color: 'text-amber-600', bg: 'bg-amber-100' },
  FINISHING: { label: 'Finishing', color: 'text-teal-600', bg: 'bg-teal-100' },
  QUALITY_CHECK: { label: 'QC Check', color: 'text-cyan-600', bg: 'bg-cyan-100' },
  COMPLETED: { label: 'Completed', color: 'text-green-600', bg: 'bg-green-100' },
  ON_HOLD: { label: 'On Hold', color: 'text-red-600', bg: 'bg-red-100' },
  FAILED: { label: 'Failed', color: 'text-red-600', bg: 'bg-red-100' },
  CANCELLED: { label: 'Cancelled', color: 'text-gray-500', bg: 'bg-gray-50' },
  REPRINTING: { label: 'Reprinting', color: 'text-violet-600', bg: 'bg-violet-100' },
};

function getElapsedTime(startedAt: string): string {
  const start = new Date(startedAt).getTime();
  const now = Date.now();
  const diffMin = Math.floor((now - start) / 60000);
  if (diffMin < 60) return `${diffMin}m`;
  const hours = Math.floor(diffMin / 60);
  const mins = diffMin % 60;
  return `${hours}h ${mins}m`;
}

export function PrinterDashboardPage() {
  const queryClient = useQueryClient();
  const [expandedPrinter, setExpandedPrinter] = useState<string | null>(null);
  const [showAddJob, setShowAddJob] = useState(false);

  // Fetch dashboard data
  const { data: dashboard, isLoading, refetch } = useQuery<DashboardData>({
    queryKey: ['rip-queue', 'dashboard'],
    queryFn: () => api.get('/rip-queue/dashboard').then((r) => r.data.data),
  });

  // Fetch all pending jobs
  const { data: pendingJobs } = useQuery<PrintJobItem[]>({
    queryKey: ['rip-queue', 'jobs', 'pending'],
    queryFn: () => api.get('/rip-queue/jobs', { params: { status: 'PENDING,PREPARING,READY' } }).then((r) => r.data.data),
  });

  // Status change mutation
  const statusMutation = useMutation({
    mutationFn: ({ jobId, status, equipmentId }: { jobId: string; status: string; equipmentId?: string }) =>
      api.put(`/rip-queue/jobs/${jobId}/status`, { status, equipmentId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rip-queue'] });
      toast.success('Job status updated');
    },
    onError: () => toast.error('Failed to update status'),
  });

  const startJob = (jobId: string, equipmentId?: string) => {
    statusMutation.mutate({ jobId, status: 'PRINTING', equipmentId });
  };

  const completeJob = (jobId: string) => {
    statusMutation.mutate({ jobId, status: 'COMPLETED' });
  };

  const pauseJob = (jobId: string) => {
    statusMutation.mutate({ jobId, status: 'ON_HOLD' });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  const printers = dashboard?.printers ?? [];
  const stats = dashboard?.stats ?? { pending: 0, printing: 0, completedToday: 0, totalActive: 0 };
  const activeJobs = dashboard?.activeJobs ?? [];
  const recentCompleted = dashboard?.recentCompleted ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Printer className="w-7 h-7 text-primary-600" />
            Printer Dashboard
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Monitor all printers and active print jobs in real-time
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Activity className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Now Printing</p>
              <p className="text-2xl font-bold text-gray-900">{stats.printing}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">In Queue</p>
              <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Layers className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Active Jobs</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalActive}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Completed Today</p>
              <p className="text-2xl font-bold text-gray-900">{stats.completedToday}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Printer Cards */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Printers</h2>
        {printers.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Printer className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-600 mb-2">No Printers Configured</h3>
            <p className="text-sm text-gray-400 mb-4">
              Add printers via Equipment page (set Type to "Printer") to see them here.
            </p>
            <a
              href="/equipment/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              <Plus className="w-4 h-4" />
              Add Printer
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {printers.map((printer) => {
              const statusCfg = PRINTER_STATUS_CONFIG[printer.status] || PRINTER_STATUS_CONFIG.OFFLINE;
              const isExpanded = expandedPrinter === printer.id;
              const printingJob = printer.currentJobs.find((j) => j.status === 'PRINTING');
              const dryingJobs = printer.currentJobs.filter((j) => j.status === 'DRYING');

              return (
                <div
                  key={printer.id}
                  className={`bg-white rounded-xl border overflow-hidden transition-shadow ${
                    printer.isPrinting ? 'border-purple-300 shadow-lg shadow-purple-50' : 'border-gray-200'
                  }`}
                >
                  {/* Printer Header */}
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${printer.isPrinting ? 'bg-purple-100' : statusCfg.bg}`}>
                        <Printer className={`w-5 h-5 ${printer.isPrinting ? 'text-purple-600' : statusCfg.color}`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{printer.name}</h3>
                        <p className="text-xs text-gray-500">
                          {[printer.manufacturer, printer.model].filter(Boolean).join(' ') || printer.type}
                          {printer.location && ` \u2022 ${printer.location}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={statusCfg.color}>{statusCfg.icon}</span>
                      <span className={`text-sm font-medium ${printer.isPrinting ? 'text-purple-600' : statusCfg.color}`}>
                        {printer.isPrinting ? 'Printing' : statusCfg.label}
                      </span>
                    </div>
                  </div>

                  {/* Current Print Job */}
                  {printingJob ? (
                    <div className="px-4 py-3 bg-purple-50 border-b border-purple-100">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-medium text-purple-900">
                          #{printingJob.workOrder.orderNumber} \u2014 {printingJob.workOrder.customerName}
                        </span>
                        <span className="text-xs text-purple-600">
                          {printingJob.startedAt && getElapsedTime(printingJob.startedAt)}
                          {printingJob.estimatedMinutes && ` / ~${printingJob.estimatedMinutes}m`}
                        </span>
                      </div>
                      <p className="text-xs text-purple-700 mb-2 truncate">
                        {printingJob.name}
                        {printingJob.materialType && ` \u2022 ${printingJob.materialType}`}
                      </p>
                      {/* Animated progress bar */}
                      <div className="w-full bg-purple-200 rounded-full h-2 overflow-hidden">
                        <div className="bg-purple-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }} />
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => completeJob(printingJob.id)}
                          className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          <CheckCircle className="w-3 h-3" />
                          Complete
                        </button>
                        <button
                          onClick={() => pauseJob(printingJob.id)}
                          className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs font-medium bg-yellow-500 text-white rounded hover:bg-yellow-600"
                        >
                          <Pause className="w-3 h-3" />
                          Pause
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 text-center">
                      <p className="text-sm text-gray-400">No active print job</p>
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
                        <div key={job.id} className="flex items-center justify-between text-xs py-0.5">
                          <span className="text-gray-600">#{job.workOrder.orderNumber}</span>
                          <button
                            onClick={() => completeJob(job.id)}
                            className="text-green-600 hover:text-green-700 font-medium"
                          >
                            Done
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Expand Toggle */}
                  <button
                    onClick={() => setExpandedPrinter(isExpanded ? null : printer.id)}
                    className="w-full px-4 py-2 text-xs text-gray-500 hover:bg-gray-50 flex items-center justify-center gap-1"
                  >
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {isExpanded ? 'Less' : 'Details'}
                  </button>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-4 pb-3 border-t border-gray-100 space-y-2">
                      <div className="grid grid-cols-2 gap-2 text-xs pt-2">
                        <div>
                          <span className="text-gray-500">Station</span>
                          <p className="font-medium">{printer.station || 'N/A'}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Status</span>
                          <p className="font-medium">{statusCfg.label}</p>
                        </div>
                      </div>
                      {printer.notes && (
                        <p className="text-xs text-gray-500 italic">{printer.notes}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Active Jobs Queue */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Active & Queued Jobs
          <span className="text-sm font-normal text-gray-400 ml-2">
            ({(pendingJobs?.length ?? 0) + activeJobs.length})
          </span>
        </h2>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Job #</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Order</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Customer</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Queue</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Material</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Time</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[...activeJobs, ...(pendingJobs ?? [])].map((job) => {
                const jobCfg = JOB_STATUS_CONFIG[job.status] || JOB_STATUS_CONFIG.PENDING;
                return (
                  <tr key={job.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{job.jobNumber}</td>
                    <td className="px-4 py-3">
                      <a href={`/orders/${job.workOrder.id}`} className="text-primary-600 hover:underline">
                        #{job.workOrder.orderNumber}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{job.workOrder.customerName}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{job.queue.name}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{job.materialType || '\u2014'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${jobCfg.bg} ${jobCfg.color}`}>
                        {job.status === 'PRINTING' && <Activity className="w-3 h-3 animate-pulse" />}
                        {jobCfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {job.startedAt ? getElapsedTime(job.startedAt) : '\u2014'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {['PENDING', 'PREPARING', 'READY', 'ON_HOLD'].includes(job.status) && (
                          <button
                            onClick={() => startJob(job.id)}
                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                            title="Start Printing"
                          >
                            <Play className="w-4 h-4" />
                          </button>
                        )}
                        {job.status === 'PRINTING' && (
                          <>
                            <button
                              onClick={() => completeJob(job.id)}
                              className="p-1 text-green-600 hover:bg-green-50 rounded"
                              title="Complete"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => pauseJob(job.id)}
                              className="p-1 text-yellow-600 hover:bg-yellow-50 rounded"
                              title="Pause"
                            >
                              <Pause className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {job.status === 'DRYING' && (
                          <button
                            onClick={() => completeJob(job.id)}
                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                            title="Complete"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {activeJobs.length === 0 && (pendingJobs?.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    No active or queued print jobs
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recently Completed */}
      {recentCompleted.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Completed Today
            <span className="text-sm font-normal text-gray-400 ml-2">({recentCompleted.length})</span>
          </h2>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Job #</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Order</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Customer</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Queue</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Completed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentCompleted.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-xs">{job.jobNumber}</td>
                    <td className="px-4 py-2">#{job.workOrder.orderNumber}</td>
                    <td className="px-4 py-2 text-gray-700">{job.workOrder.customerName}</td>
                    <td className="px-4 py-2 text-gray-500 text-xs">{job.queue.name}</td>
                    <td className="px-4 py-2 text-gray-500 text-xs">
                      {job.completedAt && new Date(job.completedAt).toLocaleTimeString()}
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
