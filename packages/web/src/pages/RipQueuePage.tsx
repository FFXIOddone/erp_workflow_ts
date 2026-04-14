import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import {
  Monitor,
  Send,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Cpu,
  Printer,
  Loader2,
  BarChart3,
  FolderOpen,
  FileText,
  Settings2,
  ChevronDown,
  ChevronRight,
  Timer,
  ArrowRight,
  Search,
  Filter,
  Package,
} from 'lucide-react';
import {
  RIP_JOB_STATUS_DISPLAY_NAMES,
  RIP_JOB_STATUS_COLORS,
  RIP_TYPE_DISPLAY_NAMES,
  WHITE_INK_OPTIONS,
  PRINT_MODE_OPTIONS,
  PRINT_RESOLUTION_OPTIONS,
} from '@erp/shared';
import type { RipJobStatus } from '@erp/shared';

// ─── Types ────────────────────────────────────────────────────

interface HotfolderTarget {
  id: string;
  name: string;
  path: string;
  ripType: string;
  station: string;
  machineId: string;
  machineName: string;
  equipmentId?: string;
}

interface RipJobRecord {
  id: string;
  workOrderId: string;
  workOrder: {
    id: string;
    orderNumber: string;
    customerName: string;
    description?: string;
    dueDate?: string;
    status?: string;
  };
  sourceFilePath: string;
  sourceFileName: string;
  sourceFileSize: number | null;
  hotfolderPath: string;
  hotfolderName: string;
  ripType: string;
  status: string;
  colorProfile: string | null;
  printResolution: string | null;
  printMode: string | null;
  mediaProfile: string | null;
  mediaType: string | null;
  copies: number;
  whiteInk: string | null;
  mirror: boolean;
  nestingEnabled: boolean;
  queuedAt: string;
  rippedAt: string | null;
  sentToPrinterAt: string | null;
  printStartedAt: string | null;
  printCompletedAt: string | null;
  cancelledAt: string | null;
  ripJobGuid: string | null;
  ripInkUsage: string | null;
  ripInkCoverage: string | null;
  errorMessage: string | null;
  notes: string | null;
  priority: number;
  equipment?: { id: string; name: string; station: string | null } | null;
  createdBy?: { id: string; username: string; displayName: string | null };
  operator?: { id: string; username: string; displayName: string | null } | null;
  timing?: {
    queueToRipMinutes?: number;
    ripToPrintMinutes?: number;
    printMinutes?: number;
    totalMinutes?: number;
  };
  createdAt: string;
}

interface KPIs {
  totalJobs: number;
  inQueue: number;
  processing: number;
  printing: number;
  completedToday: number;
  failedToday: number;
  avgQueueToRipMinutes: number | null;
  avgRipToPrintMinutes: number | null;
  avgPrintMinutes: number | null;
  avgTotalMinutes: number | null;
}

interface DashboardData {
  hotfolders: HotfolderTarget[];
  activeJobs: RipJobRecord[];
  recentCompleted: RipJobRecord[];
  kpis: KPIs;
}

const EMPTY_KPIS: KPIs = {
  totalJobs: 0,
  inQueue: 0,
  processing: 0,
  printing: 0,
  completedToday: 0,
  failedToday: 0,
  avgQueueToRipMinutes: null,
  avgRipToPrintMinutes: null,
  avgPrintMinutes: null,
  avgTotalMinutes: null,
};

// ─── Helpers ──────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const color = RIP_JOB_STATUS_COLORS[status] || '#6b7280';
  const label = RIP_JOB_STATUS_DISPLAY_NAMES[status] || status;
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: `${color}20`, color, border: `1px solid ${color}40` }}
    >
      {label}
    </span>
  );
}

function StatusIcon({ status }: { status: string }) {
  const iconMap: Record<string, React.ReactNode> = {
    QUEUED: <Clock className="w-4 h-4 text-gray-500" />,
    PROCESSING: <Cpu className="w-4 h-4 text-cyan-500 animate-pulse" />,
    READY: <CheckCircle className="w-4 h-4 text-blue-500" />,
    SENDING: <Send className="w-4 h-4 text-amber-500 animate-pulse" />,
    PRINTING: <Printer className="w-4 h-4 text-purple-500 animate-pulse" />,
    PRINTED: <CheckCircle className="w-4 h-4 text-green-500" />,
    COMPLETED: <CheckCircle className="w-4 h-4 text-emerald-500" />,
    FAILED: <XCircle className="w-4 h-4 text-red-500" />,
    CANCELLED: <XCircle className="w-4 h-4 text-gray-400" />,
  };
  return <>{iconMap[status] || <Clock className="w-4 h-4 text-gray-400" />}</>;
}

function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null) return '—';
  if (minutes < 1) return '< 1 min';
  if (minutes < 60) return `${minutes} min`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hrs}h ${mins}m`;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Main Page ────────────────────────────────────────────────

type Tab = 'dashboard' | 'jobs' | 'send';

export function RipQueuePage() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'jobs', label: 'All Jobs', icon: <FileText className="w-4 h-4" /> },
    { id: 'send', label: 'Send to RIP', icon: <Send className="w-4 h-4" /> },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Monitor className="w-7 h-7 text-purple-600" />
            RIP Queue
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Send files to RIP hotfolders, track processing, and monitor print jobs
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-2 border-b-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'dashboard' && <DashboardView />}
      {activeTab === 'jobs' && <JobsListView />}
      {activeTab === 'send' && <SendToRipView />}
    </div>
  );
}

// ─── Dashboard View ───────────────────────────────────────────

function DashboardView() {
  const queryClient = useQueryClient();

  const { data: dashboard, isLoading } = useQuery<DashboardData>({
    queryKey: ['rip-queue', 'dashboard'],
    queryFn: () =>
      api.get('/rip-queue/dashboard').then((r) => {
        const raw = r.data?.data ?? {};
        return {
          hotfolders: Array.isArray(raw.hotfolders) ? raw.hotfolders : [],
          activeJobs: Array.isArray(raw.activeJobs) ? raw.activeJobs : [],
          recentCompleted: Array.isArray(raw.recentCompleted) ? raw.recentCompleted : [],
          kpis: raw.kpis && typeof raw.kpis === 'object' ? raw.kpis : EMPTY_KPIS,
        };
      }),
  });

  const syncMutation = useMutation({
    mutationFn: () => api.post('/rip-queue/sync'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rip-queue'] }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  const kpis = dashboard?.kpis ?? EMPTY_KPIS;
  const activeJobs = Array.isArray(dashboard?.activeJobs) ? dashboard.activeJobs : [];
  const hotfolders = Array.isArray(dashboard?.hotfolders) ? dashboard.hotfolders : [];
  const recentCompleted = Array.isArray(dashboard?.recentCompleted)
    ? dashboard.recentCompleted
    : [];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <KPICard
          label="In Queue"
          value={kpis?.inQueue ?? 0}
          icon={<Clock className="w-5 h-5 text-gray-500" />}
        />
        <KPICard
          label="Processing"
          value={kpis?.processing ?? 0}
          icon={<Cpu className="w-5 h-5 text-cyan-500" />}
        />
        <KPICard
          label="Printing"
          value={kpis?.printing ?? 0}
          icon={<Printer className="w-5 h-5 text-purple-500" />}
        />
        <KPICard
          label="Completed Today"
          value={kpis?.completedToday ?? 0}
          icon={<CheckCircle className="w-5 h-5 text-green-500" />}
        />
        <KPICard
          label="Failed Today"
          value={kpis?.failedToday ?? 0}
          icon={<XCircle className="w-5 h-5 text-red-500" />}
          alert={!!kpis?.failedToday}
        />
      </div>

      {/* Timing KPIs */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Timer className="w-4 h-4" />
            Average Timings (30-day)
          </h3>
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-purple-50 text-purple-700 rounded-md hover:bg-purple-100 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            Sync RIP Status
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <TimingCard label="Queue → RIP" value={kpis?.avgQueueToRipMinutes} />
          <TimingCard label="RIP → Print" value={kpis?.avgRipToPrintMinutes} />
          <TimingCard label="Print Time" value={kpis?.avgPrintMinutes} />
          <TimingCard label="Total Flow" value={kpis?.avgTotalMinutes} />
        </div>
      </div>

      {/* Active Jobs */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">Active Jobs ({activeJobs.length})</h3>
        </div>
        {activeJobs.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {activeJobs.map((job) => (
              <JobRow key={job.id} job={job} compact />
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-400 text-sm">
            No active RIP jobs. Send a file to get started.
          </div>
        )}
      </div>

      {/* Hotfolder Targets */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">
            Available Hotfolders ({hotfolders.length})
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
          {hotfolders.map((hf) => (
            <div
              key={hf.id}
              className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100"
            >
              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                <Printer className="w-4 h-4 text-purple-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{hf.name}</p>
                <p className="text-xs text-gray-500 truncate">
                  {RIP_TYPE_DISPLAY_NAMES[hf.ripType] || hf.ripType} &middot; {hf.station}
                </p>
              </div>
              {hf.equipmentId && (
                <span className="ml-auto text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                  Linked
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Recently Completed */}
      {recentCompleted.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700">
              Completed Today ({recentCompleted.length})
            </h3>
          </div>
          <div className="divide-y divide-gray-100">
            {recentCompleted.slice(0, 10).map((job) => (
              <JobRow key={job.id} job={job} compact />
            ))}
          </div>
        </div>
      )}

      {/* Fiery / VUTEk Diagnostics */}
      <FieryDiagnosticsPanel />
    </div>
  );
}

// ─── Fiery Diagnostics Panel ──────────────────────────────────

interface FieryDiagnosticsData {
  share: { path: string; accessible: boolean; writable: boolean; error: string | null };
  jmf: {
    host: string;
    port: number;
    discoveredUrl: string;
    autoDiscovered: boolean;
    discoveryRaw: string | null;
  };
  workflow?: {
    outputChannelName: string | null;
    discoveredWorkflows: string[];
    discoverySource: string;
    discoveryError: string | null;
    hint: string;
  };
  queue: { status: string; queueSize: number; raw: string | null };
  media?: {
    media: string | null;
    mediaType: string | null;
    mapping: string | null;
    mediaUnit: string | null;
    mediaDimension: string | null;
    resolution: string | null;
    whiteInkEnabled: boolean;
  };
  latestJob?: {
    jobId: string;
    workOrderId: string;
    orderNumber: string;
    customerName: string;
    sourceFileName: string;
    status: string;
    stages: {
      key: string;
      label: string;
      time: string | null;
      durationMinutes: number | null;
      complete: boolean;
    }[];
  } | null;
  health?: {
    issue: boolean;
    stageKey: string | null;
    stageLabel: string;
    message: string;
  } | null;
}

function FieryDiagnosticsPanel() {
  const [expanded, setExpanded] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, isFetching, refetch } = useQuery<FieryDiagnosticsData>({
    queryKey: ['rip-queue', 'fiery-diagnostics'],
    queryFn: () => api.get('/rip-queue/fiery/diagnostics').then((r) => r.data?.data),
    enabled: expanded,
    refetchInterval: expanded ? 30_000 : false,
    staleTime: 15_000,
  });

  const currentWorkflow = data?.workflow?.outputChannelName?.trim() || 'Zund G7';

  useEffect(() => {
    if (selectedWorkflow == null) {
      setSelectedWorkflow(currentWorkflow);
    }
  }, [currentWorkflow, selectedWorkflow]);

  const workflowChoices = useMemo(() => {
    const values = new Set<string>(['Zund G7']);
    if (data?.workflow?.outputChannelName?.trim()) {
      values.add(data.workflow.outputChannelName.trim());
    }
    for (const wf of data?.workflow?.discoveredWorkflows ?? []) {
      if (wf?.trim()) values.add(wf.trim());
    }
    if (selectedWorkflow?.trim()) values.add(selectedWorkflow.trim());
    return Array.from(values);
  }, [data?.workflow?.discoveredWorkflows, data?.workflow?.outputChannelName, selectedWorkflow]);

  const workflowValue = (selectedWorkflow ?? currentWorkflow).trim() || 'Zund G7';

  const saveWorkflowMutation = useMutation({
    mutationFn: async (workflow: string) => api.patch('/settings', { fieryWorkflowName: workflow }),
    onSuccess: async (_response, workflow) => {
      setSelectedWorkflow(workflow);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['rip-queue', 'fiery-diagnostics'] }),
        queryClient.invalidateQueries({ queryKey: ['settings'] }),
      ]);
      toast.success(`Saved Fiery workflow: ${workflow}`);
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.error || error?.message || 'Failed to save Fiery workflow';
      toast.error(message);
    },
  });

  const allGood = data ? !data.health?.issue : false;
  const hasIssue = data ? Boolean(data.health?.issue) : false;

  return (
    <div
      className={`bg-white rounded-lg border ${hasIssue ? 'border-red-200' : allGood ? 'border-green-200' : 'border-gray-200'}`}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Cpu className="w-4 h-4 text-purple-600" />
          VUTEk / Fiery Connectivity
          {data && (
            <span
              className={`ml-2 text-xs px-2 py-0.5 rounded-full ${allGood ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
            >
              {allGood ? 'Connected' : 'Issue Detected'}
            </span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          {isFetching && <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />}
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 p-4 space-y-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Running diagnostics…
            </div>
          ) : data ? (
            <>
              {/* Share Status */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
                {data.share.writable ? (
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                ) : data.share.accessible ? (
                  <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                )}
                <div>
                  <p className="text-sm font-medium text-gray-800">File Share (PDF drop)</p>
                  <p className="text-xs text-gray-500 font-mono">{data.share.path}</p>
                  {data.share.error && (
                    <p className="text-xs text-red-600 mt-0.5">{data.share.error}</p>
                  )}
                  {data.share.writable && (
                    <p className="text-xs text-green-600 mt-0.5">Accessible and writable</p>
                  )}
                </div>
              </div>

              {/* Controller endpoint */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
                {data.jmf.autoDiscovered ? (
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
                )}
                <div>
                  <p className="text-sm font-medium text-gray-800">Controller endpoint (port {data.jmf.port})</p>
                  <p className="text-xs text-gray-500 font-mono">{data.jmf.discoveredUrl}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {data.jmf.autoDiscovered
                      ? 'Device URL auto-discovered'
                      : 'Using fallback URL — port 8010 did not return a device GUID'}
                  </p>
                </div>
              </div>

              {/* Queue Status */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
                {data.queue.status === 'Unreachable' ? (
                  <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                ) : (
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                )}
                <div>
                  <p className="text-sm font-medium text-gray-800">VUTEk Queue</p>
                  <p className="text-xs text-gray-500">
                    Status: <span className="font-semibold">{data.queue.status}</span>
                    {data.queue.queueSize > 0 && (
                      <>
                        {' '}
                        &middot; {data.queue.queueSize} job
                        {data.queue.queueSize !== 1 ? 's' : ''} queued
                      </>
                    )}
                  </p>
                </div>
              </div>

              {data.health && (
                <div
                  className={`flex items-start gap-3 p-3 rounded-lg border ${data.health.issue ? 'bg-amber-50 border-amber-100' : 'bg-sky-50 border-sky-100'}`}
                >
                  {data.health.issue ? (
                    <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  ) : (
                    <CheckCircle className="w-4 h-4 text-sky-500 mt-0.5 shrink-0" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-800">Fiery health</p>
                    <p className="text-xs text-gray-500">
                      Stage: <span className="font-semibold">{data.health.stageLabel}</span>
                    </p>
                    <p className="text-xs text-gray-400">{data.health.message}</p>
                  </div>
                </div>
              )}

              {data.latestJob && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <Timer className="w-4 h-4 text-violet-500 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <p className="text-sm font-medium text-gray-800">Latest Fiery job timeline</p>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 border border-violet-200">
                        {data.latestJob.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      WO #{data.latestJob.orderNumber} · {data.latestJob.customerName} ·{' '}
                      {data.latestJob.sourceFileName}
                    </p>
                    <div className="mt-3 grid gap-2 md:grid-cols-4">
                      {data.latestJob.stages.map((stage) => (
                        <div
                          key={stage.key}
                          className={`rounded-md border p-3 text-xs ${
                            stage.complete
                              ? 'bg-white border-gray-200'
                              : 'bg-gray-100 border-dashed border-gray-200'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold text-gray-700 uppercase tracking-wide">
                              {stage.label}
                            </p>
                            {stage.complete ? (
                              <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                            ) : (
                              <Clock className="w-3.5 h-3.5 text-gray-400" />
                            )}
                          </div>
                          <p className={`mt-1 ${stage.complete ? 'text-gray-900' : 'text-gray-500'}`}>
                            {stage.time ? timeAgo(stage.time) : 'Pending'}
                          </p>
                          <p className="text-[11px] text-gray-400">
                            {stage.time ? new Date(stage.time).toLocaleString() : 'Waiting for stage'}
                          </p>
                          {stage.durationMinutes != null && (
                            <p className="text-[11px] text-violet-600 mt-1">
                              Stage time: {formatDuration(stage.durationMinutes)}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Workflow Status */}
              <div
                className={`flex items-start gap-3 p-3 rounded-lg ${data.workflow?.outputChannelName ? 'bg-green-50 border border-green-100' : 'bg-yellow-50 border border-yellow-100'}`}
              >
                {data.workflow?.outputChannelName ? (
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-sm font-medium text-gray-800">Workflow</p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => saveWorkflowMutation.mutate(workflowValue)}
                        disabled={saveWorkflowMutation.isPending || workflowValue === currentWorkflow}
                        className="px-2.5 py-1 text-xs font-medium rounded-md bg-violet-50 text-violet-700 hover:bg-violet-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {saveWorkflowMutation.isPending ? 'Saving…' : 'Save Default'}
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 grid gap-2">
                    <label className="text-xs font-medium text-gray-500">Controller workflow</label>
                    <select
                      value={workflowValue}
                      onChange={(e) => setSelectedWorkflow(e.target.value)}
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-violet-500 focus:ring-violet-500"
                    >
                      {workflowChoices.map((wf) => (
                        <option key={wf} value={wf}>
                          {wf}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500">
                      This default is used for Fiery controller/JMF submissions. Media stays unchanged.
                    </p>
                  </div>
                  {/* Auto-discovered workflows from ProgramData share */}
                  {data.workflow?.discoveredWorkflows &&
                    data.workflow.discoveredWorkflows.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-medium text-gray-700 mb-1">
                          Discovered workflows from Fiery ({data.workflow.discoverySource}):
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {data.workflow.discoveredWorkflows.map((wf) => (
                            <span
                              key={wf}
                              className="font-mono text-xs bg-white border border-gray-300 rounded px-2 py-0.5 text-gray-800"
                            >
                              {wf}
                            </span>
                          ))}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Add <span className="font-mono">VUTEK_OUTPUT_CHANNEL=&lt;name&gt;</span>{' '}
                          only if you want the server-side fallback to change.
                        </p>
                      </div>
                    )}
                  {data.workflow?.discoveryError && !data.workflow.discoveredWorkflows?.length && (
                    <p className="text-xs text-gray-500 mt-1">{data.workflow.discoveryError}</p>
                  )}
                </div>
              </div>

              {/* Media Status */}
              {data.media && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-sky-50 border border-sky-100">
                  <Package className="w-4 h-4 text-sky-500 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <p className="text-sm font-medium text-gray-800">Media Mapping</p>
                      <span className="text-xs text-sky-700 font-medium">
                        {data.media.mapping ?? 'Not mapped'}
                      </span>
                    </div>
                    <div className="mt-2 grid gap-1 text-xs text-gray-600 sm:grid-cols-2">
                      <DetailField label="Media" value={data.media.media} />
                      <DetailField label="Media Type" value={data.media.mediaType} />
                      <DetailField label="Media Unit" value={data.media.mediaUnit} />
                      <DetailField label="Resolution" value={data.media.resolution} />
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      This is the RIP-side mapping used for Fiery JMF submissions.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  onClick={() => refetch()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-purple-50 text-purple-700 rounded-md hover:bg-purple-100"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Re-run Diagnostics
                </button>
                {data.queue.raw && (
                  <button
                    onClick={() => setShowRaw((v) => !v)}
                    className="text-xs text-gray-400 hover:text-gray-600 underline"
                  >
                    {showRaw ? 'Hide' : 'Show'} raw controller response
                  </button>
                )}
              </div>

              {showRaw && data.queue.raw && (
                <pre className="text-xs bg-gray-900 text-green-400 p-3 rounded overflow-auto max-h-48 whitespace-pre-wrap">
                  {data.queue.raw}
                </pre>
              )}
            </>
          ) : (
            <button onClick={() => refetch()} className="text-sm text-purple-600 hover:underline">
              Run diagnostics
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function KPICard({
  label,
  value,
  icon,
  alert,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  alert?: boolean;
}) {
  return (
    <div
      className={`bg-white rounded-lg border p-4 ${alert ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-500">{label}</span>
        {icon}
      </div>
      <p className={`text-2xl font-bold ${alert ? 'text-red-600' : 'text-gray-900'}`}>{value}</p>
    </div>
  );
}

function TimingCard({ label, value }: { label: string; value: number | null | undefined }) {
  return (
    <div className="text-center p-3 bg-gray-50 rounded-lg">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-lg font-semibold text-gray-900">{formatDuration(value)}</p>
    </div>
  );
}

// ─── Jobs List View ───────────────────────────────────────────

function JobsListView() {
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ data: RipJobRecord[]; total: number }>({
    queryKey: ['rip-queue', 'jobs', statusFilter, searchQuery],
    queryFn: () => {
      const params: Record<string, string> = { limit: '100' };
      if (statusFilter) params.status = statusFilter;
      if (searchQuery) params.search = searchQuery;
      return api.get('/rip-queue/jobs', { params }).then((r) => {
        const jobs = Array.isArray(r.data?.data) ? r.data.data : [];
        const total = typeof r.data?.total === 'number' ? r.data.total : jobs.length;
        return { data: jobs, total };
      });
    },
  });

  const jobs = Array.isArray(data?.data) ? data.data : [];

  const statusMutation = useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: string; notes?: string }) =>
      api.put(`/rip-queue/jobs/${id}/status`, { status, notes }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rip-queue'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/rip-queue/jobs/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rip-queue'] }),
  });

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'QUEUED', label: 'In Queue' },
    { value: 'PROCESSING', label: 'Processing' },
    { value: 'READY', label: 'Ready' },
    { value: 'PRINTING', label: 'Printing' },
    { value: 'PRINTED,COMPLETED', label: 'Completed' },
    { value: 'FAILED', label: 'Failed' },
    { value: 'CANCELLED', label: 'Cancelled' },
  ];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search files, WOs, customers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-purple-500 focus:border-purple-500"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="pl-9 pr-8 py-2 border border-gray-300 rounded-md text-sm focus:ring-purple-500 focus:border-purple-500 appearance-none bg-white"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <span className="text-sm text-gray-500 ml-auto">{data?.total ?? 0} jobs</span>
      </div>

      {/* Job list */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
        </div>
      ) : jobs.length > 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {jobs.map((job) => (
            <div key={job.id}>
              <JobRow
                job={job}
                expanded={expandedJob === job.id}
                onToggle={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
                onStatusChange={(status) => statusMutation.mutate({ id: job.id, status })}
                onDelete={() => {
                  if (confirm('Cancel this RIP job?')) deleteMutation.mutate(job.id);
                }}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-400">
          No RIP jobs found matching your filters.
        </div>
      )}
    </div>
  );
}

// ─── Job Row Component ────────────────────────────────────────

function JobRow({
  job,
  compact,
  expanded,
  onToggle,
  onStatusChange,
  onDelete,
}: {
  job: RipJobRecord;
  compact?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  onStatusChange?: (status: string) => void;
  onDelete?: () => void;
}) {
  const isActive = ['QUEUED', 'PROCESSING', 'READY', 'SENDING', 'PRINTING'].includes(job.status);

  return (
    <div className={`${expanded ? 'bg-purple-50/30' : ''}`}>
      <div
        className={`flex items-center gap-3 px-4 py-3 ${onToggle ? 'cursor-pointer hover:bg-gray-50' : ''}`}
        onClick={onToggle}
      >
        <StatusIcon status={job.status} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900 truncate">{job.sourceFileName}</span>
            <StatusBadge status={job.status} />
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-gray-500">WO {job.workOrder.orderNumber}</span>
            <span className="text-xs text-gray-300">&middot;</span>
            <span className="text-xs text-gray-500">{job.workOrder.customerName}</span>
            <span className="text-xs text-gray-300">&middot;</span>
            <span className="text-xs text-gray-500">{job.hotfolderName}</span>
            {job.sourceFileSize && (
              <>
                <span className="text-xs text-gray-300">&middot;</span>
                <span className="text-xs text-gray-400">{formatFileSize(job.sourceFileSize)}</span>
              </>
            )}
          </div>
        </div>

        {/* Timing flow */}
        {!compact && job.timing && (
          <div className="hidden lg:flex items-center gap-1 text-xs text-gray-400">
            {job.timing.queueToRipMinutes != null && (
              <>
                <span>{formatDuration(job.timing.queueToRipMinutes)}</span>
                <ArrowRight className="w-3 h-3" />
              </>
            )}
            {job.timing.printMinutes != null && (
              <span>{formatDuration(job.timing.printMinutes)}</span>
            )}
          </div>
        )}

        <span className="text-xs text-gray-400 flex-shrink-0">{timeAgo(job.queuedAt)}</span>

        {onToggle &&
          (expanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          ))}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Print settings */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-white rounded-lg border border-gray-100 p-3">
            <DetailField label="Color Profile" value={job.colorProfile} />
            <DetailField label="Resolution" value={job.printResolution} />
            <DetailField label="Print Mode" value={job.printMode} />
            <DetailField label="Media Type" value={job.mediaType} />
            <DetailField label="White Ink" value={job.whiteInk} />
            <DetailField label="Copies" value={String(job.copies)} />
            <DetailField label="Mirror" value={job.mirror ? 'Yes' : 'No'} />
            <DetailField label="Nesting" value={job.nestingEnabled ? 'Yes' : 'No'} />
          </div>

          {/* Timing */}
          {job.timing && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-500">Timeline:</span>
              <TimelineStep label="Queued" time={job.queuedAt} />
              <ArrowRight className="w-3 h-3 text-gray-300" />
              <TimelineStep
                label="RIP Done"
                time={job.rippedAt}
                duration={job.timing?.queueToRipMinutes}
              />
              <ArrowRight className="w-3 h-3 text-gray-300" />
              <TimelineStep
                label="Print Start"
                time={job.printStartedAt}
                duration={job.timing?.ripToPrintMinutes}
              />
              <ArrowRight className="w-3 h-3 text-gray-300" />
              <TimelineStep
                label="Print Done"
                time={job.printCompletedAt}
                duration={job.timing?.printMinutes}
              />
            </div>
          )}

          {/* RIP data */}
          {(job.ripInkUsage || job.ripInkCoverage || job.ripJobGuid) && (
            <div className="flex items-center gap-4 text-xs text-gray-500">
              {job.ripInkUsage && <span>Ink: {job.ripInkUsage}</span>}
              {job.ripInkCoverage && <span>Coverage: {job.ripInkCoverage}%</span>}
              {job.ripJobGuid && (
                <span className="text-gray-400">GUID: {job.ripJobGuid.slice(0, 8)}...</span>
              )}
            </div>
          )}

          {/* Errors */}
          {job.errorMessage && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-2 rounded">
              <AlertTriangle className="w-4 h-4" />
              {job.errorMessage}
            </div>
          )}

          {/* Actions */}
          {(onStatusChange || onDelete) && (
            <div className="flex items-center gap-2">
              {isActive && onStatusChange && (
                <>
                  {job.status === 'QUEUED' && (
                    <ActionButton
                      label="Mark Processing"
                      onClick={() => onStatusChange('PROCESSING')}
                      color="cyan"
                    />
                  )}
                  {job.status === 'PROCESSING' && (
                    <ActionButton
                      label="Mark Ready"
                      onClick={() => onStatusChange('READY')}
                      color="blue"
                    />
                  )}
                  {['READY', 'SENDING'].includes(job.status) && (
                    <ActionButton
                      label="Mark Printing"
                      onClick={() => onStatusChange('PRINTING')}
                      color="purple"
                    />
                  )}
                  {job.status === 'PRINTING' && (
                    <ActionButton
                      label="Mark Printed"
                      onClick={() => onStatusChange('PRINTED')}
                      color="green"
                    />
                  )}
                  {job.status === 'PRINTED' && (
                    <ActionButton
                      label="Complete"
                      onClick={() => onStatusChange('COMPLETED')}
                      color="emerald"
                    />
                  )}
                  <ActionButton
                    label="Mark Failed"
                    onClick={() => onStatusChange('FAILED')}
                    color="red"
                  />
                </>
              )}
              {isActive && onDelete && (
                <ActionButton label="Cancel" onClick={onDelete} color="gray" />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DetailField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm text-gray-700">{value || '—'}</p>
    </div>
  );
}

function TimelineStep({
  label,
  time,
  duration,
}: {
  label: string;
  time?: string | null;
  duration?: number | null;
}) {
  return (
    <span className={time ? 'text-gray-700' : 'text-gray-300'}>
      {label}
      {time && <span className="text-gray-400 ml-1">({timeAgo(time)})</span>}
      {duration != null && (
        <span className="text-purple-500 ml-1">[{formatDuration(duration)}]</span>
      )}
    </span>
  );
}

function ActionButton({
  label,
  onClick,
  color,
}: {
  label: string;
  onClick: () => void;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    cyan: 'bg-cyan-50 text-cyan-700 hover:bg-cyan-100',
    blue: 'bg-blue-50 text-blue-700 hover:bg-blue-100',
    purple: 'bg-purple-50 text-purple-700 hover:bg-purple-100',
    green: 'bg-green-50 text-green-700 hover:bg-green-100',
    emerald: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
    red: 'bg-red-50 text-red-700 hover:bg-red-100',
    gray: 'bg-gray-50 text-gray-700 hover:bg-gray-100',
  };
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`px-3 py-1.5 text-xs font-medium rounded-md ${colorMap[color] || colorMap.gray}`}
    >
      {label}
    </button>
  );
}

// ─── Send to RIP View ─────────────────────────────────────────

function SendToRipView() {
  const queryClient = useQueryClient();

  // Form state
  const [workOrderId, setWorkOrderId] = useState('');
  const [woSearch, setWoSearch] = useState('');
  const [sourceFilePath, setSourceFilePath] = useState('');
  const [selectedHotfolder, setSelectedHotfolder] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  // Print settings
  const [colorProfile, setColorProfile] = useState('');
  const [printResolution, setPrintResolution] = useState('');
  const [printMode, setPrintMode] = useState('');
  const [mediaType, setMediaType] = useState('');
  const [copies, setCopies] = useState(1);
  const [whiteInk, setWhiteInk] = useState('None');
  const [mirror, setMirror] = useState(false);
  const [nestingEnabled, setNestingEnabled] = useState(false);
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState(3);

  // Queries
  const { data: hotfolders } = useQuery<HotfolderTarget[]>({
    queryKey: ['rip-queue', 'hotfolders'],
    queryFn: () =>
      api
        .get('/rip-queue/hotfolders')
        .then((r) => (Array.isArray(r.data?.data) ? r.data.data : [])),
  });

  // Work order search
  const { data: woResults } = useQuery({
    queryKey: ['orders', 'search', woSearch],
    queryFn: () =>
      api
        .get('/orders', { params: { search: woSearch, pageSize: 10 } })
        .then((r) => (Array.isArray(r.data?.data?.items) ? r.data.data.items : [])),
    enabled: woSearch.length >= 2,
  });

  // File validation
  const { data: fileValidation } = useQuery({
    queryKey: ['rip-queue', 'validate-file', sourceFilePath],
    queryFn: () =>
      api.post('/rip-queue/validate-file', { filePath: sourceFilePath }).then((r) => r.data.data),
    enabled: sourceFilePath.length > 5,
  });

  // Submit
  const sendMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/rip-queue/jobs', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rip-queue'] });
      // Reset form
      setSourceFilePath('');
      setSelectedHotfolder('');
      setNotes('');
      alert('File submitted to RIP successfully!');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to send file to RIP');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!workOrderId || !sourceFilePath || !selectedHotfolder) return;

    sendMutation.mutate({
      workOrderId,
      sourceFilePath,
      hotfolderId: selectedHotfolder,
      colorProfile: colorProfile || undefined,
      printResolution: printResolution || undefined,
      printMode: printMode || undefined,
      mediaType: mediaType || undefined,
      copies,
      whiteInk: whiteInk !== 'None' ? whiteInk : undefined,
      mirror,
      nestingEnabled,
      notes: notes || undefined,
      priority,
    });
  };

  const selectedWO = woResults?.find((wo: any) => wo.id === workOrderId);

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      {/* Work Order Selection */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          1. Select Work Order
        </h3>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by WO#, customer, or description..."
            value={woSearch}
            onChange={(e) => {
              setWoSearch(e.target.value);
              setWorkOrderId('');
            }}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-purple-500 focus:border-purple-500"
          />
        </div>
        {woResults && woResults.length > 0 && !workOrderId && (
          <div className="border border-gray-200 rounded-md divide-y divide-gray-100 max-h-40 overflow-y-auto">
            {woResults.map((wo: any) => (
              <button
                key={wo.id}
                type="button"
                onClick={() => {
                  setWorkOrderId(wo.id);
                  setWoSearch(wo.orderNumber);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-purple-50 text-sm"
              >
                <span className="font-medium text-gray-900">{wo.orderNumber}</span>
                <span className="text-gray-500 truncate">{wo.customerName}</span>
                <span className="text-gray-400 truncate text-xs">{wo.description}</span>
              </button>
            ))}
          </div>
        )}
        {selectedWO && (
          <div className="flex items-center gap-2 bg-purple-50 p-2 rounded text-sm">
            <CheckCircle className="w-4 h-4 text-purple-600" />
            <span className="font-medium">{selectedWO.orderNumber}</span>
            <span className="text-gray-600">{selectedWO.customerName}</span>
          </div>
        )}
      </div>

      {/* Source File Path */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <FolderOpen className="w-4 h-4" />
          2. Source Print File
        </h3>
        <input
          type="text"
          placeholder="\\\\wildesigns-fs1\\Company Files\\Customer\\WO#####\\PRINT\\file.tif"
          value={sourceFilePath}
          onChange={(e) => setSourceFilePath(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:ring-purple-500 focus:border-purple-500"
        />
        {fileValidation && (
          <div
            className={`flex items-center gap-2 text-sm ${fileValidation.valid ? 'text-green-600' : 'text-red-600'}`}
          >
            {fileValidation.valid ? (
              <>
                <CheckCircle className="w-4 h-4" />
                File accessible ({formatFileSize(fileValidation.size)})
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4" />
                {fileValidation.error}
              </>
            )}
          </div>
        )}
        <p className="text-xs text-gray-400">
          Full UNC path to the print file on the network drive. The file will be COPIED (not moved)
          to the hotfolder.
        </p>
      </div>

      {/* Hotfolder Target */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Printer className="w-4 h-4" />
          3. Select Printer / Hotfolder
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {hotfolders?.map((hf) => (
            <button
              key={hf.id}
              type="button"
              onClick={() => setSelectedHotfolder(hf.id)}
              className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                selectedHotfolder === hf.id
                  ? 'border-purple-500 bg-purple-50 ring-1 ring-purple-500'
                  : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50/50'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  selectedHotfolder === hf.id
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                <Printer className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">{hf.name}</p>
                <p className="text-xs text-gray-500">
                  {RIP_TYPE_DISPLAY_NAMES[hf.ripType] || hf.ripType} &middot; {hf.station}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Print Settings (expandable) */}
      <div className="bg-white rounded-lg border border-gray-200">
        <button
          type="button"
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center justify-between w-full px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          <span className="flex items-center gap-2">
            <Settings2 className="w-4 h-4" />
            4. Print Settings (Optional)
          </span>
          {showSettings ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
        {showSettings && (
          <div className="px-4 pb-4 space-y-4 border-t border-gray-100 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Color Profile</label>
                <input
                  type="text"
                  placeholder="e.g., sRGB, AdobeRGB"
                  value={colorProfile}
                  onChange={(e) => setColorProfile(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Resolution</label>
                <select
                  value={printResolution}
                  onChange={(e) => setPrintResolution(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm"
                >
                  <option value="">Auto</option>
                  {PRINT_RESOLUTION_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r} DPI
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Print Mode</label>
                <select
                  value={printMode}
                  onChange={(e) => setPrintMode(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm"
                >
                  <option value="">Default</option>
                  {PRINT_MODE_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Media Type</label>
                <input
                  type="text"
                  placeholder="e.g., 3M 8518, ORAFOL 451"
                  value={mediaType}
                  onChange={(e) => setMediaType(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">White Ink</label>
                <select
                  value={whiteInk}
                  onChange={(e) => setWhiteInk(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm"
                >
                  {WHITE_INK_OPTIONS.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Copies</label>
                <input
                  type="number"
                  min={1}
                  value={copies}
                  onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(parseInt(e.target.value))}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm"
                >
                  <option value={1}>1 — Urgent</option>
                  <option value={2}>2 — High</option>
                  <option value={3}>3 — Normal</option>
                  <option value={4}>4 — Low</option>
                  <option value={5}>5 — Background</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={mirror}
                  onChange={(e) => setMirror(e.target.checked)}
                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                Mirror
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={nestingEnabled}
                  onChange={(e) => setNestingEnabled(e.target.checked)}
                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                Enable Nesting
              </label>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Special instructions for the operator..."
                rows={2}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm"
              />
            </div>
          </div>
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={!workOrderId || !sourceFilePath || !selectedHotfolder || sendMutation.isPending}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {sendMutation.isPending ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Send className="w-5 h-5" />
        )}
        Send to RIP
      </button>
    </form>
  );
}
