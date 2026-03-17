import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Scissors,
  Gauge,
  BarChart3,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  Clock,
  Package,
  AlertCircle,
  CheckCircle2,
  Loader2,
  FileText,
  RefreshCw,
  ExternalLink,
  FolderOpen,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { api } from '../lib/api';

// ─── Types ─────────────────────────────────────────────

type JobStatus = 'active' | 'queued' | 'completed';
type SortField = 'jobName' | 'status' | 'startTime' | 'endTime' | 'durationSeconds' | 'material' | 'workOrderNumber' | 'source' | 'fileModified' | 'copyDone';
type SortDir = 'asc' | 'desc';

interface ZundLiveJob {
  id: string;
  jobName: string;
  source: 'statistics' | 'thrive-cut' | 'zund-queue';
  status: JobStatus;
  startTime: string | null;
  endTime: string | null;
  durationSeconds: number | null;
  copyDone: number;
  copyTotal: number;
  material: string | null;
  materialThickness: number | null;
  device: string | null;
  widthMm: number | null;
  heightMm: number | null;
  guid: string | null;
  workOrderNumber: string | null;
  workOrderId: string | null;
  customerName: string | null;
  matchConfidence: 'exact' | 'partial' | 'possible' | 'nesting' | null;
  isNesting: boolean;
  thriveMachine: string | null;
  fileName: string | null;
  fileModified: string | null;
  fileSizeBytes: number | null;
  printer: string | null;
}

interface ZundLiveData {
  zundId: string;
  hasStatsDb: boolean;
  cutter: { cutterId: string; name: string; machineTypeId: number } | null;
  dbVersion: string | null;
  todayStats: {
    jobCount: number;
    totalCuttingTimeMinutes: number;
    totalSetupTimeMinutes: number;
    totalIdleTimeMinutes: number;
    totalCopiesCut: number;
    totalLengthCutMeters: number;
  } | null;
  toolWear: Array<{
    insertId: number;
    toolId: number;
    cutter: string;
    runningMeters: number;
    maxRunningMeters: number;
    materialName: string;
    materialThickness: number;
    lastUsed: string;
    wearPercent: number;
  }>;
  jobs: ZundLiveJob[];
  summary: {
    activeCount: number;
    queuedCount: number;
    completedCount: number;
    totalJobs: number;
    linkedCount: number;
    unlinkedCount: number;
  };
  timestamp: string;
}

// ─── Helpers ───────────────────────────────────────────

const STATUS_CONFIG: Record<JobStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  active: { label: 'Cutting', color: 'text-blue-700', bg: 'bg-blue-100', icon: Loader2 },
  queued: { label: 'Queued', color: 'text-amber-700', bg: 'bg-amber-100', icon: Clock },
  completed: { label: 'Done', color: 'text-green-700', bg: 'bg-green-100', icon: CheckCircle2 },
};

const SOURCE_LABELS: Record<string, string> = {
  'statistics': 'Stats DB',
  'thrive-cut': 'Thrive Cut',
  'zund-queue': 'Zund Queue',
};

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === 0) return '—';
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return `${hrs}h ${remainMins}m`;
}

function formatSize(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Component ─────────────────────────────────────────

export default function ZundLiveDataPanel({ zundId }: { zundId: string }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<JobStatus | 'all'>('all');
  const [linkedFilter, setLinkedFilter] = useState<'all' | 'linked' | 'unlinked'>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('startTime');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

  const { data: liveData, isLoading, error, refetch, isFetching } = useQuery<ZundLiveData>({
    queryKey: ['zund-live', zundId],
    queryFn: () => api.get(`/equipment/zund/${zundId}/live`).then(r => r.data.data),
    refetchInterval: 30_000, // 30s polling
    staleTime: 15_000,
  });

  // ─── Sort & Filter ──

  const filteredJobs = useMemo(() => {
    if (!liveData?.jobs) return [];

    let jobs = [...liveData.jobs];

    // Status filter
    if (statusFilter !== 'all') {
      jobs = jobs.filter(j => j.status === statusFilter);
    }

    // Linked filter
    if (linkedFilter === 'linked') {
      jobs = jobs.filter(j => j.workOrderNumber);
    } else if (linkedFilter === 'unlinked') {
      jobs = jobs.filter(j => !j.workOrderNumber);
    }

    // Source filter
    if (sourceFilter !== 'all') {
      jobs = jobs.filter(j => j.source === sourceFilter);
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      jobs = jobs.filter(j =>
        j.jobName?.toLowerCase().includes(q) ||
        j.workOrderNumber?.toLowerCase().includes(q) ||
        j.customerName?.toLowerCase().includes(q) ||
        j.material?.toLowerCase().includes(q) ||
        j.device?.toLowerCase().includes(q) ||
        j.fileName?.toLowerCase().includes(q)
      );
    }

    // Sort
    jobs.sort((a, b) => {
      let cmp = 0;
      const av = a[sortField];
      const bv = b[sortField];

      if (av === null && bv === null) cmp = 0;
      else if (av === null) cmp = 1;
      else if (bv === null) cmp = -1;
      else if (typeof av === 'string' && typeof bv === 'string') cmp = av.localeCompare(bv);
      else if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv));

      // Active jobs always first regardless of sort
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (b.status === 'active' && a.status !== 'active') return 1;

      return sortDir === 'asc' ? cmp : -cmp;
    });

    return jobs;
  }, [liveData?.jobs, statusFilter, linkedFilter, sourceFilter, search, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 text-gray-300" />;
    return sortDir === 'asc'
      ? <ArrowUp className="h-3 w-3 text-blue-500" />
      : <ArrowDown className="h-3 w-3 text-blue-500" />;
  };

  // ─── Loading / Error states ──

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-3" />
        <p className="text-sm text-gray-500">Loading Zund live data...</p>
      </div>
    );
  }

  if (error || !liveData) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center gap-2 text-red-700">
          <AlertCircle className="h-5 w-5" />
          <span className="font-medium">Failed to load Zund live data</span>
        </div>
        <p className="text-sm text-red-600 mt-1">{(error as Error)?.message || 'Unknown error'}</p>
        <button
          onClick={() => refetch()}
          className="mt-3 px-4 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm hover:bg-red-200"
        >
          Retry
        </button>
      </div>
    );
  }

  const { summary, todayStats, toolWear, cutter, hasStatsDb, dbVersion } = liveData;

  return (
    <div className="space-y-6">
      {/* ── Header + Today's Stats ── */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Scissors className="h-5 w-5 text-gray-400" />
            Zund Live Data — {cutter?.name || zundId.toUpperCase()}
            {dbVersion && (
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded ml-2">
                ZCC v{dbVersion}
              </span>
            )}
            {!hasStatsDb && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded ml-2">
                No Stats DB
              </span>
            )}
          </h2>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Summary Badges */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-4">
          <button
            onClick={() => setStatusFilter(f => f === 'active' ? 'all' : 'active')}
            className={`text-center p-3 rounded-lg transition-all cursor-pointer ${
              statusFilter === 'active' ? 'ring-2 ring-blue-400' : ''
            } bg-blue-50`}
          >
            <p className="text-2xl font-bold text-blue-700">{summary.activeCount}</p>
            <p className="text-xs text-blue-600">Active</p>
          </button>
          <button
            onClick={() => setStatusFilter(f => f === 'queued' ? 'all' : 'queued')}
            className={`text-center p-3 rounded-lg transition-all cursor-pointer ${
              statusFilter === 'queued' ? 'ring-2 ring-amber-400' : ''
            } bg-amber-50`}
          >
            <p className="text-2xl font-bold text-amber-700">{summary.queuedCount}</p>
            <p className="text-xs text-amber-600">Queued</p>
          </button>
          <button
            onClick={() => setStatusFilter(f => f === 'completed' ? 'all' : 'completed')}
            className={`text-center p-3 rounded-lg transition-all cursor-pointer ${
              statusFilter === 'completed' ? 'ring-2 ring-green-400' : ''
            } bg-green-50`}
          >
            <p className="text-2xl font-bold text-green-700">{summary.completedCount}</p>
            <p className="text-xs text-green-600">Completed</p>
          </button>

          {/* Linked / Unlinked */}
          <button
            onClick={() => setLinkedFilter(f => f === 'linked' ? 'all' : 'linked')}
            className={`text-center p-3 rounded-lg transition-all cursor-pointer ${
              linkedFilter === 'linked' ? 'ring-2 ring-purple-400' : ''
            } bg-purple-50`}
          >
            <p className="text-2xl font-bold text-purple-700">{summary.linkedCount}</p>
            <p className="text-xs text-purple-600">Linked</p>
          </button>
          <button
            onClick={() => setLinkedFilter(f => f === 'unlinked' ? 'all' : 'unlinked')}
            className={`text-center p-3 rounded-lg transition-all cursor-pointer ${
              linkedFilter === 'unlinked' ? 'ring-2 ring-gray-400' : ''
            } bg-gray-50`}
          >
            <p className="text-2xl font-bold text-gray-700">{summary.unlinkedCount}</p>
            <p className="text-xs text-gray-600">Unlinked</p>
          </button>

          {/* Total */}
          <div className="text-center p-3 bg-slate-50 rounded-lg">
            <p className="text-2xl font-bold text-slate-700">{summary.totalJobs}</p>
            <p className="text-xs text-slate-600">Total</p>
          </div>
        </div>

        {/* Today's Stats (only if Stats DB available) */}
        {todayStats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="text-center p-2 bg-blue-50/50 rounded-lg border border-blue-100">
              <p className="text-lg font-bold text-blue-700">{todayStats.jobCount}</p>
              <p className="text-xs text-blue-600">Jobs Today</p>
            </div>
            <div className="text-center p-2 bg-green-50/50 rounded-lg border border-green-100">
              <p className="text-lg font-bold text-green-700">{todayStats.totalCuttingTimeMinutes}m</p>
              <p className="text-xs text-green-600">Cutting Time</p>
            </div>
            <div className="text-center p-2 bg-amber-50/50 rounded-lg border border-amber-100">
              <p className="text-lg font-bold text-amber-700">{todayStats.totalSetupTimeMinutes}m</p>
              <p className="text-xs text-amber-600">Setup Time</p>
            </div>
            <div className="text-center p-2 bg-purple-50/50 rounded-lg border border-purple-100">
              <p className="text-lg font-bold text-purple-700">{todayStats.totalCopiesCut}</p>
              <p className="text-xs text-purple-600">Copies Cut</p>
            </div>
            <div className="text-center p-2 bg-gray-50/50 rounded-lg border border-gray-100">
              <p className="text-lg font-bold text-gray-700">{todayStats.totalLengthCutMeters}m</p>
              <p className="text-xs text-gray-600">Cut Length</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Tool Wear (if available) ── */}
      {toolWear && toolWear.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-md font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Gauge className="h-4 w-4 text-gray-400" />
            Tool Wear
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {toolWear.map((tool, i) => (
              <div key={i} className="border border-gray-100 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">
                    Insert #{tool.insertId} (Tool {tool.toolId})
                  </span>
                  <span className={`text-sm font-bold ${
                    tool.wearPercent > 80 ? 'text-red-600' :
                    tool.wearPercent > 50 ? 'text-amber-600' : 'text-green-600'
                  }`}>
                    {tool.wearPercent}%
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
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

      {/* ── Jobs Table ── */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-md font-semibold text-gray-900 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-gray-400" />
              All Jobs
              <span className="text-xs text-gray-400 font-normal">
                ({filteredJobs.length} of {liveData.jobs.length})
              </span>
            </h3>

            {/* Source filter */}
            <div className="flex items-center gap-2">
              <select
                value={sourceFilter}
                onChange={e => setSourceFilter(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 bg-white"
              >
                <option value="all">All Sources</option>
                <option value="statistics">Stats DB</option>
                <option value="thrive-cut">Thrive Cut</option>
                <option value="zund-queue">Zund Queue</option>
              </select>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search jobs, orders, customers, materials..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Active filters display */}
          {(statusFilter !== 'all' || linkedFilter !== 'all' || sourceFilter !== 'all') && (
            <div className="flex flex-wrap gap-2 mt-2">
              {statusFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                  <Filter className="h-3 w-3" />
                  Status: {statusFilter}
                  <button onClick={() => setStatusFilter('all')} className="ml-1 hover:text-blue-900">&times;</button>
                </span>
              )}
              {linkedFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                  <Filter className="h-3 w-3" />
                  {linkedFilter}
                  <button onClick={() => setLinkedFilter('all')} className="ml-1 hover:text-purple-900">&times;</button>
                </span>
              )}
              {sourceFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
                  <Filter className="h-3 w-3" />
                  Source: {SOURCE_LABELS[sourceFilter] || sourceFilter}
                  <button onClick={() => setSourceFilter('all')} className="ml-1 hover:text-gray-900">&times;</button>
                </span>
              )}
              <button
                onClick={() => { setStatusFilter('all'); setLinkedFilter('all'); setSourceFilter('all'); setSearch(''); }}
                className="text-xs text-gray-500 hover:text-gray-700 underline"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 z-10">
              <tr className="text-left text-gray-500 border-b border-gray-200">
                <th className="py-2 px-3 font-medium">
                  <button onClick={() => handleSort('status')} className="flex items-center gap-1 hover:text-gray-700">
                    Status <SortIcon field="status" />
                  </button>
                </th>
                <th className="py-2 px-3 font-medium min-w-[200px]">
                  <button onClick={() => handleSort('jobName')} className="flex items-center gap-1 hover:text-gray-700">
                    Job Name <SortIcon field="jobName" />
                  </button>
                </th>
                <th className="py-2 px-3 font-medium">
                  <button onClick={() => handleSort('workOrderNumber')} className="flex items-center gap-1 hover:text-gray-700">
                    Work Order <SortIcon field="workOrderNumber" />
                  </button>
                </th>
                <th className="py-2 px-3 font-medium">
                  <button onClick={() => handleSort('material')} className="flex items-center gap-1 hover:text-gray-700">
                    Material <SortIcon field="material" />
                  </button>
                </th>
                <th className="py-2 px-3 font-medium text-center">
                  <button onClick={() => handleSort('copyDone')} className="flex items-center gap-1 hover:text-gray-700">
                    Copies <SortIcon field="copyDone" />
                  </button>
                </th>
                <th className="py-2 px-3 font-medium text-right">
                  <button onClick={() => handleSort('durationSeconds')} className="flex items-center gap-1 hover:text-gray-700 ml-auto">
                    Duration <SortIcon field="durationSeconds" />
                  </button>
                </th>
                <th className="py-2 px-3 font-medium text-right">
                  <button onClick={() => handleSort('startTime')} className="flex items-center gap-1 hover:text-gray-700 ml-auto">
                    Time <SortIcon field="startTime" />
                  </button>
                </th>
                <th className="py-2 px-3 font-medium">
                  <button onClick={() => handleSort('source')} className="flex items-center gap-1 hover:text-gray-700">
                    Source <SortIcon field="source" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-400">
                    {search || statusFilter !== 'all' || linkedFilter !== 'all'
                      ? 'No jobs match your filters'
                      : 'No jobs found'}
                  </td>
                </tr>
              ) : (
                filteredJobs.map(job => {
                  const statusCfg = STATUS_CONFIG[job.status];
                  const StatusIcon = statusCfg.icon;
                  const isExpanded = expandedJobId === job.id;

                  return (
                    <React.Fragment key={job.id}>
                      <tr
                        className={`hover:bg-gray-50 cursor-pointer transition-colors ${
                          job.status === 'active' ? 'bg-blue-50/30' : ''
                        } ${isExpanded ? 'bg-gray-50' : ''}`}
                        onClick={() => setExpandedJobId(isExpanded ? null : job.id)}
                      >
                        {/* Status */}
                        <td className="py-2 px-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.bg} ${statusCfg.color}`}>
                            <StatusIcon className={`h-3 w-3 ${job.status === 'active' ? 'animate-spin' : ''}`} />
                            {statusCfg.label}
                          </span>
                        </td>

                        {/* Job Name */}
                        <td className="py-2 px-3 max-w-[280px]">
                          <p className="truncate font-medium text-gray-900" title={job.jobName}>
                            {job.jobName}
                          </p>
                          {job.isNesting && (
                            <span className="inline-block text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded mt-0.5">
                              Nesting
                            </span>
                          )}
                        </td>

                        {/* Work Order */}
                        <td className="py-2 px-3">
                          {job.workOrderNumber ? (
                            <div>
                              <div className="flex items-center gap-1">
                                {job.workOrderId ? (
                                  <Link
                                    to={`/orders/${job.workOrderId}`}
                                    className="text-blue-600 hover:text-blue-800 hover:underline font-medium text-xs"
                                    onClick={e => e.stopPropagation()}
                                  >
                                    {job.workOrderNumber}
                                  </Link>
                                ) : (
                                  <span className="text-gray-700 text-xs">{job.workOrderNumber}</span>
                                )}
                                {job.workOrderId && (
                                  <Link
                                    to={`/orders/${job.workOrderId}#files`}
                                    className="p-0.5 text-gray-400 hover:text-primary-600 rounded"
                                    title="Open network files"
                                    onClick={e => e.stopPropagation()}
                                  >
                                    <FolderOpen className="w-3.5 h-3.5" />
                                  </Link>
                                )}
                              </div>
                              {job.customerName && (
                                <p className="text-xs text-gray-400 truncate max-w-[140px]" title={job.customerName}>
                                  {job.customerName}
                                </p>
                              )}
                              {job.matchConfidence && job.matchConfidence !== 'exact' && (
                                <span className={`inline-block text-xs px-1 rounded mt-0.5 ${
                                  job.matchConfidence === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                                  job.matchConfidence === 'nesting' ? 'bg-indigo-100 text-indigo-700' :
                                  'bg-gray-100 text-gray-500'
                                }`}>
                                  {job.matchConfidence}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>

                        {/* Material */}
                        <td className="py-2 px-3 text-gray-500 text-xs max-w-[120px] truncate" title={job.material || ''}>
                          {job.material || '—'}
                        </td>

                        {/* Copies */}
                        <td className="py-2 px-3 text-center text-xs">
                          {job.copyTotal > 0 ? `${job.copyDone}/${job.copyTotal}` : '—'}
                        </td>

                        {/* Duration */}
                        <td className="py-2 px-3 text-right text-xs text-gray-500">
                          {formatDuration(job.durationSeconds)}
                        </td>

                        {/* Time */}
                        <td className="py-2 px-3 text-right text-xs text-gray-400 whitespace-nowrap">
                          {job.startTime ? (
                            <span title={format(new Date(job.startTime), 'PPpp')}>
                              {format(new Date(job.startTime), 'MMM d h:mm a')}
                            </span>
                          ) : job.fileModified ? (
                            <span title={format(new Date(job.fileModified), 'PPpp')}>
                              {formatDistanceToNow(new Date(job.fileModified), { addSuffix: true })}
                            </span>
                          ) : '—'}
                        </td>

                        {/* Source */}
                        <td className="py-2 px-3">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            job.source === 'statistics' ? 'bg-blue-50 text-blue-600' :
                            job.source === 'thrive-cut' ? 'bg-green-50 text-green-600' :
                            job.source === 'zund-queue' ? 'bg-purple-50 text-purple-600' :
                            'bg-orange-50 text-orange-600'
                          }`}>
                            {SOURCE_LABELS[job.source]}
                          </span>
                        </td>
                      </tr>

                      {/* Expanded Detail Row */}
                      {isExpanded && (
                        <tr className="bg-gray-50">
                          <td colSpan={8} className="px-4 py-3">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                              {job.device && (
                                <div>
                                  <span className="text-gray-400">Device:</span>
                                  <p className="text-gray-700 font-medium">{job.device}</p>
                                </div>
                              )}
                              {job.printer && (
                                <div>
                                  <span className="text-gray-400">Printer:</span>
                                  <p className="text-gray-700 font-medium">{job.printer}</p>
                                </div>
                              )}
                              {job.thriveMachine && (
                                <div>
                                  <span className="text-gray-400">Thrive Machine:</span>
                                  <p className="text-gray-700 font-medium">{job.thriveMachine}</p>
                                </div>
                              )}
                              {(job.widthMm || job.heightMm) && (
                                <div>
                                  <span className="text-gray-400">Dimensions:</span>
                                  <p className="text-gray-700 font-medium">
                                    {job.widthMm?.toFixed(1)} × {job.heightMm?.toFixed(1)} mm
                                  </p>
                                </div>
                              )}
                              {job.materialThickness !== null && job.materialThickness !== undefined && (
                                <div>
                                  <span className="text-gray-400">Thickness:</span>
                                  <p className="text-gray-700 font-medium">{job.materialThickness} mm</p>
                                </div>
                              )}
                              {job.guid && (
                                <div>
                                  <span className="text-gray-400">GUID:</span>
                                  <p className="text-gray-700 font-mono text-xs truncate" title={job.guid}>{job.guid}</p>
                                </div>
                              )}
                              {job.fileName && (
                                <div>
                                  <span className="text-gray-400">File:</span>
                                  <p className="text-gray-700 font-medium truncate" title={job.fileName}>{job.fileName}</p>
                                </div>
                              )}
                              {job.fileSizeBytes && (
                                <div>
                                  <span className="text-gray-400">File Size:</span>
                                  <p className="text-gray-700 font-medium">{formatSize(job.fileSizeBytes)}</p>
                                </div>
                              )}
                              {job.startTime && (
                                <div>
                                  <span className="text-gray-400">Start:</span>
                                  <p className="text-gray-700 font-medium">{format(new Date(job.startTime), 'PPpp')}</p>
                                </div>
                              )}
                              {job.endTime && (
                                <div>
                                  <span className="text-gray-400">End:</span>
                                  <p className="text-gray-700 font-medium">{format(new Date(job.endTime), 'PPpp')}</p>
                                </div>
                              )}
                              {job.fileModified && (
                                <div>
                                  <span className="text-gray-400">File Modified:</span>
                                  <p className="text-gray-700 font-medium">{format(new Date(job.fileModified), 'PPpp')}</p>
                                </div>
                              )}
                              {job.workOrderId && (
                                <div>
                                  <Link
                                    to={`/orders/${job.workOrderId}`}
                                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline font-medium"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                    View Order
                                  </Link>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-400 flex justify-between">
          <span>
            Last updated: {format(new Date(liveData.timestamp), 'h:mm:ss a')}
          </span>
          <span>
            Data sources: {hasStatsDb ? 'Stats DB + ' : ''}Thrive Cut Center + Fiery EFI Export
          </span>
        </div>
      </div>
    </div>
  );
}
