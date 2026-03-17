import { useState, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FileSpreadsheet,
  Upload,
  Download,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
  ArrowLeftRight,
  ExternalLink,
  Filter,
  BarChart3,
  History,
  Printer,
  FolderOpen,
  Settings,
  ShieldOff,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/auth';
import { Link } from 'react-router-dom';

// ─── Types ─────────────────────────────────────────────────────

interface ProductionListRow {
  customerName: string;
  orderNumber: string;
  description: string;
  category: string | null;
  salesperson: string | null;
  mustShipDate: string | null;
  proofDate: string | null;
  approvalDate: string | null;
  printCutDate: string | null;
  printStatus: string | null;
  notes: string | null;
  daysRemaining: number | null;
  deadlineWarning: string | null;
  section: string;
  style: string;
  isPriority: boolean;
  isStrikethrough: boolean;
  rowNumber: number;
}

interface ProductionListSummary {
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  sectionCounts: Record<string, number>;
  totalActiveOrders: number;
  dueToday: number;
  dueTomorrow: number;
  overdue: number;
  awaitingApproval: number;
  printingComplete: number;
  printingPending: number;
  erpMatchedCount: number;
  unmatchedCount: number;
}

interface SyncResult {
  syncId: string;
  totalRows: number;
  matched: number;
  spreadsheetOnly: number;
  erpOnly: number;
  imported: number;
  updated: number;
  skipped: number;
  errors: number;
  status: string;
  details: Array<{
    orderNumber: string;
    customerName: string;
    action: string;
    reason?: string;
  }>;
}

interface SyncHistoryItem {
  id: string;
  direction: string;
  status: string;
  fileName: string | null;
  startedAt: string;
  completedAt: string | null;
  imported: number;
  updated: number;
  skipped: number;
  errors: number;
  totalRows: number;
  user: { displayName: string };
}

interface CurrentFileInfo {
  configured: boolean;
  basePath?: string;
  message: string;
  file: {
    filePath: string;
    fileName: string;
    fileDate: string;
    fileSize: number;
  } | null;
}

interface SettingsInfo {
  enableProductionListSync: boolean;
  productionListPath: string | null;
}

// ─── Constants ─────────────────────────────────────────────────

const SECTION_DISPLAY: Record<string, { label: string; color: string; bg: string }> = {
  CUSTOMER: { label: 'Shipping Today/Tomorrow', color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
  MONTHLY: { label: 'Monthly/Recurring', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  COMING_UP: { label: 'Coming Up (Approved)', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  DESIGN_PRODUCTION: { label: 'Design & Production', color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
  DESIGN_ONLY: { label: 'Design Only', color: 'text-violet-700', bg: 'bg-violet-50 border-violet-200' },
  OUTSOURCED: { label: 'Outsourced', color: 'text-slate-700', bg: 'bg-slate-50 border-slate-200' },
  INSTALL_READY: { label: 'Install Ready / Shipping', color: 'text-teal-700', bg: 'bg-teal-50 border-teal-200' },
  ON_HOLD: { label: 'On Hold', color: 'text-gray-500', bg: 'bg-gray-50 border-gray-200' },
};

const SECTION_ORDER = [
  'CUSTOMER', 'MONTHLY', 'COMING_UP',
  'DESIGN_PRODUCTION', 'DESIGN_ONLY', 'OUTSOURCED',
  'INSTALL_READY', 'ON_HOLD',
];

type TabView = 'list' | 'sync' | 'history';

// ─── Component ─────────────────────────────────────────────────

export function ProductionListPage() {
  const [activeTab, setActiveTab] = useState<TabView>('list');
  const [search, setSearch] = useState('');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(SECTION_ORDER.filter(s => s !== 'ON_HOLD' && s !== 'INSTALL_READY'))
  );
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [syncFile, setSyncFile] = useState<File | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const queryClient = useQueryClient();

  // ─── Queries ───────────────────────────────────────────────

  const { data: settingsData } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await api.get('/settings');
      return res.data.data as SettingsInfo;
    },
  });

  const syncEnabled = settingsData?.enableProductionListSync ?? false;

  const { data: currentFile, isLoading: currentFileLoading } = useQuery({
    queryKey: ['production-list', 'current-file'],
    queryFn: async () => {
      const res = await api.get('/production-list/current-file');
      return res.data.data as CurrentFileInfo;
    },
    enabled: activeTab === 'sync',
  });

  const { data: listData, isLoading: listLoading } = useQuery({
    queryKey: ['production-list', search, includeCompleted],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (includeCompleted) params.includeCompleted = 'true';
      const res = await api.get('/production-list', { params });
      return res.data.data as {
        rows: ProductionListRow[];
        grouped: Record<string, ProductionListRow[]>;
        totalRows: number;
      };
    },
  });

  const { data: summary } = useQuery({
    queryKey: ['production-list', 'summary'],
    queryFn: async () => {
      const res = await api.get('/production-list/summary');
      return res.data.data as ProductionListSummary;
    },
  });

  const { data: historyData } = useQuery({
    queryKey: ['production-list', 'history'],
    queryFn: async () => {
      const res = await api.get('/production-list/history');
      return res.data.data as { items: SyncHistoryItem[]; total: number };
    },
    enabled: activeTab === 'history',
  });

  // ─── Actions ───────────────────────────────────────────────

  const handleExport = useCallback(async (format: 'xlsx' | 'json' = 'xlsx') => {
    setIsExporting(true);
    try {
      if (format === 'xlsx') {
        const res = await api.get('/production-list/export', {
          responseType: 'blob',
          params: { includeCompleted: includeCompleted ? 'true' : 'false' },
        });
        const blob = new Blob([res.data], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = res.headers['content-disposition']?.split('filename=')[1]?.replace(/"/g, '')
          || 'Production_List.xlsx';
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setIsExporting(false);
    }
  }, [includeCompleted]);

  const handleExportPrintList = useCallback(async (station: string) => {
    try {
      const res = await api.get('/production-list/export/print', {
        responseType: 'blob',
        params: { station },
      });
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.headers['content-disposition']?.split('filename=')[1]?.replace(/"/g, '')
        || `${station}_List.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
  }, []);

  const handleSync = useCallback(async (dryRun: boolean, useConfigured: boolean = false) => {
    if (!syncFile && !useConfigured) return;
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const endpoint = dryRun ? '/production-list/sync/preview' : '/production-list/sync';
      let res;

      if (useConfigured) {
        // Read directly from the configured server path (no file upload)
        res = await api.post(endpoint, { useConfigured: true });
      } else {
        const formData = new FormData();
        formData.append('file', syncFile!);
        res = await api.post(endpoint, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      setSyncResult(res.data.data);
      if (!dryRun) {
        queryClient.invalidateQueries({ queryKey: ['production-list'] });
        queryClient.invalidateQueries({ queryKey: ['orders'] });
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err.message || 'Sync failed';
      setSyncResult({
        syncId: 'error',
        totalRows: 0,
        matched: 0,
        spreadsheetOnly: 0,
        erpOnly: 0,
        imported: 0,
        updated: 0,
        skipped: 0,
        errors: 1,
        status: 'FAILED',
        details: [{ orderNumber: '-', customerName: '-', action: 'error', reason: msg }],
      });
    } finally {
      setIsSyncing(false);
    }
  }, [syncFile, queryClient]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  // ─── Render Helpers ────────────────────────────────────────

  const formatDate = (dateStr: string | null) => {
    if (!dateStr || dateStr === 'N/A') return dateStr || '—';
    try {
      const d = new Date(dateStr);
      return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(-2)}`;
    } catch {
      return dateStr;
    }
  };

  const getRowClass = (row: ProductionListRow) => {
    if (row.isStrikethrough) return 'line-through text-gray-400';
    if (row.isPriority) return 'bg-yellow-50';
    if (row.style === 'ATTENTION') return 'bg-red-50';
    if (row.style === 'INNER_WORKINGS') return 'bg-blue-50';
    if (row.style === 'MUST_SHIP') return 'bg-yellow-100';
    return '';
  };

  const getDaysColor = (days: number | null) => {
    if (days === null) return 'text-gray-400';
    if (days < 0) return 'text-red-600 font-bold';
    if (days <= 3) return 'text-red-500 font-semibold';
    if (days <= 7) return 'text-orange-500';
    return 'text-green-600';
  };

  const getPrintStatusBadge = (status: string | null) => {
    if (!status) return null;
    // If it looks like a date, it's complete
    if (/^\d/.test(status) || status === 'Complete') {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircle2 className="w-3 h-3 mr-1" />{status}</span>;
    }
    // Station flags
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800"><Clock className="w-3 h-3 mr-1" />{status}</span>;
  };

  // ─── Main Render ───────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileSpreadsheet className="w-7 h-7 text-green-600" />
            Production List
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            ERP view of the daily production list — operates alongside the Excel workbook
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport('xlsx')}
            disabled={isExporting}
            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Export Excel
          </button>
          <div className="relative group">
            <button className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
              <Printer className="w-4 h-4 mr-2" />
              Print Lists
              <ChevronDown className="w-3 h-3 ml-1" />
            </button>
            <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10 hidden group-hover:block">
              <button onClick={() => handleExportPrintList('RR')} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Roll to Roll List</button>
              <button onClick={() => handleExportPrintList('FB')} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Flatbed List</button>
              <button onClick={() => handleExportPrintList('Z')} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Zund List</button>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <SummaryCard label="Active Orders" value={summary.totalActiveOrders} icon={<BarChart3 className="w-5 h-5" />} color="blue" />
          <SummaryCard label="Due Today" value={summary.dueToday} icon={<AlertTriangle className="w-5 h-5" />} color={summary.dueToday > 0 ? 'red' : 'green'} />
          <SummaryCard label="Due Tomorrow" value={summary.dueTomorrow} icon={<Clock className="w-5 h-5" />} color="orange" />
          <SummaryCard label="Overdue" value={summary.overdue} icon={<XCircle className="w-5 h-5" />} color={summary.overdue > 0 ? 'red' : 'green'} />
          <SummaryCard label="Printing Done" value={summary.printingComplete} icon={<CheckCircle2 className="w-5 h-5" />} color="green" />
          <SummaryCard label="Printing Pending" value={summary.printingPending} icon={<Printer className="w-5 h-5" />} color="orange" />
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {([
            { key: 'list' as TabView, label: 'Production List', icon: <FileSpreadsheet className="w-4 h-4" /> },
            { key: 'sync' as TabView, label: 'Sync with Excel', icon: <ArrowLeftRight className="w-4 h-4" /> },
            { key: 'history' as TabView, label: 'Sync History', icon: <History className="w-4 h-4" /> },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'list' && (
        <ListView
          data={listData}
          isLoading={listLoading}
          search={search}
          onSearchChange={setSearch}
          expandedSections={expandedSections}
          onToggleSection={toggleSection}
          includeCompleted={includeCompleted}
          onIncludeCompletedChange={setIncludeCompleted}
          formatDate={formatDate}
          getRowClass={getRowClass}
          getDaysColor={getDaysColor}
          getPrintStatusBadge={getPrintStatusBadge}
        />
      )}

      {activeTab === 'sync' && (
        <SyncView
          file={syncFile}
          onFileChange={setSyncFile}
          result={syncResult}
          isSyncing={isSyncing}
          onSync={handleSync}
          formatDate={formatDate}
          syncEnabled={syncEnabled}
          currentFile={currentFile ?? null}
          currentFileLoading={currentFileLoading}
        />
      )}

      {activeTab === 'history' && (
        <HistoryView data={historyData} formatDate={formatDate} />
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────

function SummaryCard({ label, value, icon, color }: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    red: 'bg-red-50 text-red-600 border-red-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    orange: 'bg-orange-50 text-orange-600 border-orange-200',
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color] || colors.blue}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium opacity-80">{label}</span>
        {icon}
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

function ListView({
  data,
  isLoading,
  search,
  onSearchChange,
  expandedSections,
  onToggleSection,
  includeCompleted,
  onIncludeCompletedChange,
  formatDate,
  getRowClass,
  getDaysColor,
  getPrintStatusBadge,
}: {
  data: { rows: ProductionListRow[]; grouped: Record<string, ProductionListRow[]>; totalRows: number } | undefined;
  isLoading: boolean;
  search: string;
  onSearchChange: (s: string) => void;
  expandedSections: Set<string>;
  onToggleSection: (s: string) => void;
  includeCompleted: boolean;
  onIncludeCompletedChange: (v: boolean) => void;
  formatDate: (d: string | null) => string;
  getRowClass: (r: ProductionListRow) => string;
  getDaysColor: (d: number | null) => string;
  getPrintStatusBadge: (s: string | null) => React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      {/* Search & Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by WO#, customer, or description..."
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={includeCompleted}
            onChange={e => onIncludeCompletedChange(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          Show completed/shipped
        </label>
        {data && (
          <span className="text-sm text-gray-500">{data.totalRows} orders</span>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <span className="ml-3 text-gray-500">Loading production list...</span>
        </div>
      )}

      {/* Sections */}
      {data && !isLoading && (
        <div className="space-y-3">
          {SECTION_ORDER.map(sectionKey => {
            const sectionRows = data.grouped[sectionKey] || [];
            if (sectionRows.length === 0 && !expandedSections.has(sectionKey)) return null;
            const disp = SECTION_DISPLAY[sectionKey] || { label: sectionKey, color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200' };
            const isExpanded = expandedSections.has(sectionKey);

            return (
              <div key={sectionKey} className={`border rounded-xl overflow-hidden ${disp.bg}`}>
                {/* Section Header */}
                <button
                  onClick={() => onToggleSection(sectionKey)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded
                      ? <ChevronDown className={`w-5 h-5 ${disp.color}`} />
                      : <ChevronRight className={`w-5 h-5 ${disp.color}`} />}
                    <span className={`font-semibold text-sm ${disp.color}`}>{disp.label}</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-white/60 text-gray-700">
                      {sectionRows.length}
                    </span>
                  </div>
                </button>

                {/* Section Body — Spreadsheet Table */}
                {isExpanded && sectionRows.length > 0 && (
                  <div className="overflow-x-auto bg-white border-t">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                          <th className="px-3 py-2 text-left font-medium">Customer</th>
                          <th className="px-3 py-2 text-left font-medium w-20">WO#</th>
                          <th className="px-3 py-2 text-left font-medium">Description</th>
                          <th className="px-3 py-2 text-left font-medium w-24">Salesperson</th>
                          <th className="px-3 py-2 text-left font-medium w-24">Must Ship</th>
                          <th className="px-3 py-2 text-left font-medium w-24">Print Status</th>
                          <th className="px-3 py-2 text-left font-medium">Notes</th>
                          <th className="px-3 py-2 text-center font-medium w-16">Days</th>
                          <th className="px-3 py-2 text-center font-medium w-12"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {sectionRows.map(row => (
                          <tr key={row.orderNumber} className={`hover:bg-gray-50 transition-colors ${getRowClass(row)}`}>
                            <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap max-w-[180px] truncate" title={row.customerName}>
                              {row.customerName}
                            </td>
                            <td className="px-3 py-2 text-blue-600 font-mono">
                              <Link to={`/orders?search=${row.orderNumber}`} className="hover:underline">
                                {row.orderNumber}
                              </Link>
                            </td>
                            <td className="px-3 py-2 text-gray-700 max-w-[280px] truncate" title={row.description}>
                              {row.description}
                            </td>
                            <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{row.salesperson || '—'}</td>
                            <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{formatDate(row.mustShipDate)}</td>
                            <td className="px-3 py-2">{getPrintStatusBadge(row.printStatus)}</td>
                            <td className="px-3 py-2 text-gray-500 max-w-[200px] truncate" title={row.notes || ''}>
                              {row.notes || '—'}
                            </td>
                            <td className={`px-3 py-2 text-center font-mono ${getDaysColor(row.daysRemaining)}`}>
                              {row.daysRemaining ?? '—'}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <Link
                                to={`/orders?search=${row.orderNumber}`}
                                className="text-gray-400 hover:text-blue-600 transition-colors"
                                title="View in ERP"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {isExpanded && sectionRows.length === 0 && (
                  <div className="bg-white border-t px-4 py-6 text-center text-gray-400 text-sm">
                    No orders in this section
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SyncView({
  file,
  onFileChange,
  result,
  isSyncing,
  onSync,
  formatDate,
  syncEnabled,
  currentFile,
  currentFileLoading,
}: {
  file: File | null;
  onFileChange: (f: File | null) => void;
  result: SyncResult | null;
  isSyncing: boolean;
  onSync: (dryRun: boolean, useConfigured?: boolean) => void;
  formatDate: (d: string | null) => string;
  syncEnabled: boolean;
  currentFile: CurrentFileInfo | null;
  currentFileLoading: boolean;
}) {
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!syncEnabled) return;
    const f = e.dataTransfer.files[0];
    if (f && /\.(xlsx|xlsm|xls)$/i.test(f.name)) {
      onFileChange(f);
    }
  }, [onFileChange, syncEnabled]);

  return (
    <div className="space-y-6">
      {/* Sync Disabled Banner */}
      {!syncEnabled && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <ShieldOff className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-amber-900">Sync is Disabled</h3>
              <p className="text-sm text-amber-700 mt-1">
                Production List sync is currently turned off. You can view the production list and export data,
                but importing from Excel is disabled. An admin can enable it in{' '}
                <Link to="/settings" className="underline font-medium">Settings &gt; Features</Link>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Info Banner */}
      {syncEnabled && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <ArrowLeftRight className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-blue-900">Read from Excel Production List</h3>
              <p className="text-sm text-blue-700 mt-1">
                The ERP reads the Excel Production List to fill in missing data and discover new orders.
                <strong className="block mt-1">The ERP never modifies the Excel file.</strong>
                Data flows one way: Excel &rarr; ERP only.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Auto-discovered File from Server */}
      {syncEnabled && (
        <div className="bg-white border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <FolderOpen className="w-5 h-5 text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-900">Configured Production List</h3>
          </div>

          {currentFileLoading && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Looking for today's file...
            </div>
          )}

          {!currentFileLoading && currentFile && !currentFile.configured && (
            <div className="text-sm text-gray-500">
              <p>Production List directory not set.</p>
              <Link to="/settings" className="text-blue-600 hover:underline text-sm">
                Configure in Settings &gt; Features
              </Link>
            </div>
          )}

          {!currentFileLoading && currentFile && currentFile.configured && !currentFile.file && (
            <div className="text-sm text-amber-600">
              <p>{currentFile.message}</p>
              <p className="text-xs text-gray-400 mt-1">Path: {currentFile.basePath}</p>
            </div>
          )}

          {!currentFileLoading && currentFile?.file && (
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <FileSpreadsheet className="w-10 h-10 text-green-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{currentFile.file.fileName}</p>
                  <p className="text-xs text-gray-500">
                    {(currentFile.file.fileSize / 1024).toFixed(1)} KB
                    {currentFile.file.fileDate && ` — ${new Date(currentFile.file.fileDate).toLocaleDateString()}`}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 truncate" title={currentFile.file.filePath}>
                    {currentFile.file.filePath}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onSync(true, true)}
                    disabled={isSyncing}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    {isSyncing ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Search className="w-4 h-4 mr-1.5" />}
                    Preview
                  </button>
                  <button
                    onClick={() => onSync(false, true)}
                    disabled={isSyncing}
                    className="inline-flex items-center px-3 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isSyncing ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1.5" />}
                    Sync Now
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manual Upload Area (secondary option) */}
      {syncEnabled && (
        <div className="border-t pt-4">
          <p className="text-xs text-gray-500 mb-3">Or upload a file manually:</p>
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
              file ? 'border-green-300 bg-green-50' : 'border-gray-300 bg-gray-50 hover:border-blue-300 hover:bg-blue-50'
            }`}
          >
            {file ? (
              <div className="space-y-3">
                <FileSpreadsheet className="w-10 h-10 text-green-600 mx-auto" />
                <p className="text-sm font-medium text-gray-900">{file.name}</p>
                <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => onSync(true)}
                    disabled={isSyncing}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    {isSyncing ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Search className="w-4 h-4 mr-1.5" />}
                    Preview
                  </button>
                  <button
                    onClick={() => onSync(false)}
                    disabled={isSyncing}
                    className="inline-flex items-center px-3 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isSyncing ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1.5" />}
                    Sync Now
                  </button>
                  <button
                    onClick={() => onFileChange(null)}
                    className="text-sm text-gray-500 hover:text-red-500 ml-2"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="w-8 h-8 text-gray-400 mx-auto" />
                <p className="text-sm text-gray-600">
                  Drag & drop a Production List file here, or
                </p>
                <label className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer">
                  <Upload className="w-4 h-4 mr-1.5" />
                  Browse Files
                  <input
                    type="file"
                    accept=".xlsx,.xlsm,.xls"
                    className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) onFileChange(f);
                    }}
                  />
                </label>
                <p className="text-xs text-gray-400">
                  Accepts .xlsx, .xlsm, .xls
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sync Result */}
      {result && (
        <div className="bg-white border rounded-xl overflow-hidden">
          <div className={`px-4 py-3 flex items-center justify-between ${
            result.status === 'COMPLETED' ? 'bg-green-50 border-b border-green-200' :
            result.status === 'FAILED' ? 'bg-red-50 border-b border-red-200' :
            'bg-yellow-50 border-b border-yellow-200'
          }`}>
            <div className="flex items-center gap-2">
              {result.status === 'COMPLETED' && <CheckCircle2 className="w-5 h-5 text-green-600" />}
              {result.status === 'FAILED' && <XCircle className="w-5 h-5 text-red-600" />}
              {result.status === 'PARTIAL' && <AlertTriangle className="w-5 h-5 text-yellow-600" />}
              <span className="font-semibold text-sm">
                {result.syncId === 'dry-run' ? 'Preview' : 'Sync'} Result — {result.status}
              </span>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4 p-4 bg-gray-50">
            <StatMini label="Total Rows" value={result.totalRows} />
            <StatMini label="Matched" value={result.matched} color="blue" />
            <StatMini label="Sheet Only" value={result.spreadsheetOnly} color="orange" />
            <StatMini label="ERP Only" value={result.erpOnly} color="purple" />
            <StatMini label="Imported" value={result.imported} color="green" />
            <StatMini label="Updated" value={result.updated} color="blue" />
            <StatMini label="Errors" value={result.errors} color="red" />
          </div>

          {/* Detail Table */}
          {result.details.length > 0 && (
            <div className="max-h-80 overflow-y-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">WO#</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {result.details.map((d, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-mono text-blue-600">{d.orderNumber}</td>
                      <td className="px-3 py-2 text-gray-900">{d.customerName}</td>
                      <td className="px-3 py-2">
                        <ActionBadge action={d.action} />
                      </td>
                      <td className="px-3 py-2 text-gray-500 text-xs">{d.reason || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function HistoryView({
  data,
  formatDate,
}: {
  data: { items: SyncHistoryItem[]; total: number } | undefined;
  formatDate: (d: string | null) => string;
}) {
  if (!data || data.items.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="text-sm">No sync history yet</p>
        <p className="text-xs mt-1">Upload a Production List to get started</p>
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-xl overflow-hidden">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">File</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Direction</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Rows</th>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Imported</th>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Updated</th>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Errors</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.items.map(sync => (
            <tr key={sync.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-900 whitespace-nowrap">
                {new Date(sync.startedAt).toLocaleString()}
              </td>
              <td className="px-4 py-3 text-gray-700 font-mono text-xs">{sync.fileName || '—'}</td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                  {sync.direction === 'IMPORT' ? '← Import' : sync.direction === 'EXPORT' ? '→ Export' : '↔ Both'}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                  sync.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                  sync.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                  sync.status === 'PARTIAL' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {sync.status}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-600 text-xs">{sync.user.displayName}</td>
              <td className="px-4 py-3 text-center text-gray-700">{sync.totalRows}</td>
              <td className="px-4 py-3 text-center text-green-600 font-medium">{sync.imported}</td>
              <td className="px-4 py-3 text-center text-blue-600 font-medium">{sync.updated}</td>
              <td className="px-4 py-3 text-center text-red-600 font-medium">{sync.errors || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatMini({ label, value, color = 'gray' }: { label: string; value: number; color?: string }) {
  const colors: Record<string, string> = {
    gray: 'text-gray-900',
    blue: 'text-blue-600',
    green: 'text-green-600',
    red: 'text-red-600',
    orange: 'text-orange-600',
    purple: 'text-purple-600',
  };
  return (
    <div className="text-center">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-lg font-bold ${colors[color] || colors.gray}`}>{value}</p>
    </div>
  );
}

function ActionBadge({ action }: { action: string }) {
  const styles: Record<string, string> = {
    imported: 'bg-green-100 text-green-800',
    updated: 'bg-blue-100 text-blue-800',
    exported: 'bg-purple-100 text-purple-800',
    skipped: 'bg-gray-100 text-gray-600',
    error: 'bg-red-100 text-red-800',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[action] || styles.skipped}`}>
      {action}
    </span>
  );
}
