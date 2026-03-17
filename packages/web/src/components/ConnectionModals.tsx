import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  X,
  HardDrive,
  FolderOpen,
  Folder,
  FileText,
  Server,
  Activity,
  Search,
  Filter,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  MonitorSmartphone,
  Lock,
} from 'lucide-react';
import { api } from '../lib/api';
import { Spinner } from './Spinner';

// ─── File Shares Modal ─────────────────────────────────────────

interface FileSharesModalProps {
  isOpen: boolean;
  onClose: () => void;
  equipmentId: string;
  equipmentName: string;
  ipAddress: string;
}

interface ShareItem {
  name: string;
  size: number | null;
  modified: string;
  isDirectory: boolean;
}

interface Share {
  name: string;
  type: string;
  remark: string;
  accessible: boolean | null;
  items: ShareItem[];
  itemCount: number;
}

export function FileSharesModal({ isOpen, onClose, equipmentId, equipmentName, ipAddress }: FileSharesModalProps) {
  const [expandedShare, setExpandedShare] = useState<string | null>(null);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['equipment-smb-shares', equipmentId, ipAddress],
    queryFn: async () => {
      const res = await api.get(`/equipment/${equipmentId}/smb-shares`, { params: { targetIp: ipAddress } });
      return res.data.data;
    },
    enabled: isOpen,
    staleTime: 30000,
  });

  if (!isOpen) return null;

  const shares: Share[] = data?.shares || [];
  const errorMsg = data?.error;

  function formatFileSize(bytes: number | null): string {
    if (bytes === null || bytes === undefined) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  function formatDate(dateStr: string): string {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch { return dateStr; }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[80vh] flex flex-col animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-100 rounded-lg">
              <HardDrive className="h-5 w-5 text-sky-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">File Shares</h2>
              <p className="text-sm text-gray-500">
                {equipmentName} — {ipAddress}
                <span className="ml-2 inline-flex items-center gap-1 text-xs text-amber-600">
                  <Lock className="h-3 w-3" />
                  Read-only
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Spinner size="lg" />
              <p className="text-sm text-gray-500">Scanning file shares on {ipAddress}...</p>
            </div>
          ) : errorMsg ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <AlertTriangle className="h-10 w-10 text-amber-400" />
              <p className="text-sm text-gray-700 font-medium">Could not enumerate shares</p>
              <p className="text-xs text-gray-500 max-w-md text-center">{errorMsg}</p>
            </div>
          ) : shares.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <HardDrive className="h-10 w-10 text-gray-300" />
              <p className="text-sm text-gray-500">No shares found on this device</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-gray-400 mb-2">
                {shares.length} share{shares.length !== 1 ? 's' : ''} found · Scanned {data?.scannedAt ? formatDate(data.scannedAt) : 'just now'}
              </p>
              {shares.map((share) => (
                <div key={share.name} className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* Share header */}
                  <button
                    onClick={() => setExpandedShare(expandedShare === share.name ? null : share.name)}
                    className={`w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors ${
                      expandedShare === share.name ? 'bg-gray-50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        share.type.toLowerCase() === 'disk'
                          ? share.accessible ? 'bg-green-100' : 'bg-red-50'
                          : 'bg-gray-100'
                      }`}>
                        {share.type.toLowerCase() === 'disk' ? (
                          <FolderOpen className={`h-5 w-5 ${share.accessible ? 'text-green-600' : 'text-red-400'}`} />
                        ) : share.type.toLowerCase() === 'print' ? (
                          <Server className="h-5 w-5 text-gray-400" />
                        ) : (
                          <HardDrive className="h-5 w-5 text-gray-400" />
                        )}
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-medium text-gray-900 font-mono">
                          \\{ipAddress}\{share.name}
                        </div>
                        <div className="text-xs text-gray-500 flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${
                            share.type.toLowerCase() === 'disk' ? 'bg-blue-50 text-blue-700'
                              : share.type.toLowerCase() === 'print' ? 'bg-purple-50 text-purple-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {share.type}
                          </span>
                          {share.remark && <span>{share.remark}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {share.accessible === true && (
                        <span className="text-xs text-green-600 flex items-center gap-1">
                          <CheckCircle className="h-3.5 w-3.5" />
                          {share.itemCount} item{share.itemCount !== 1 ? 's' : ''}
                        </span>
                      )}
                      {share.accessible === false && (
                        <span className="text-xs text-red-500 flex items-center gap-1">
                          <XCircle className="h-3.5 w-3.5" />
                          Access denied
                        </span>
                      )}
                      <svg className={`h-4 w-4 text-gray-400 transition-transform ${expandedShare === share.name ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {/* Share contents (expanded) */}
                  {expandedShare === share.name && share.items.length > 0 && (
                    <div className="border-t border-gray-100 bg-gray-50">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs text-gray-500 border-b border-gray-200">
                            <th className="text-left py-2 px-4 font-medium">Name</th>
                            <th className="text-right py-2 px-4 font-medium">Size</th>
                            <th className="text-right py-2 px-4 font-medium">Modified</th>
                          </tr>
                        </thead>
                        <tbody>
                          {share.items
                            .sort((a, b) => {
                              // Directories first, then by name
                              if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
                              return a.name.localeCompare(b.name);
                            })
                            .map((item, i) => (
                            <tr key={i} className="border-b border-gray-100 last:border-0 hover:bg-white transition-colors">
                              <td className="py-2 px-4 flex items-center gap-2">
                                {item.isDirectory ? (
                                  <Folder className="h-4 w-4 text-amber-500 flex-shrink-0" />
                                ) : (
                                  <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                )}
                                <span className="font-mono text-gray-800 truncate">{item.name}</span>
                              </td>
                              <td className="py-2 px-4 text-right text-gray-500 whitespace-nowrap">
                                {item.isDirectory ? '—' : formatFileSize(item.size)}
                              </td>
                              <td className="py-2 px-4 text-right text-gray-500 whitespace-nowrap text-xs">
                                {formatDate(item.modified)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {expandedShare === share.name && share.items.length === 0 && share.accessible !== false && (
                    <div className="border-t border-gray-100 bg-gray-50 p-4 text-center text-sm text-gray-400">
                      Share is empty or contents not available
                    </div>
                  )}
                  {expandedShare === share.name && share.accessible === false && (
                    <div className="border-t border-gray-100 bg-red-50 p-4 text-center text-sm text-red-500">
                      Cannot access this share — permission denied
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Lock className="h-3 w-3" />
            All file access is read-only — no modifications allowed
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}


// ─── Windows Services Modal ────────────────────────────────────

interface WinServicesModalProps {
  isOpen: boolean;
  onClose: () => void;
  equipmentId: string;
  equipmentName: string;
  ipAddress: string;
}

interface ServiceInfo {
  name: string;
  displayName: string;
  state: string;
  startMode: string;
  pid: number | null;
  description: string | null;
  category: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  'Printing': 'bg-purple-100 text-purple-700',
  'EFI/Fiery': 'bg-indigo-100 text-indigo-700',
  'Networking': 'bg-blue-100 text-blue-700',
  'Remote Access': 'bg-teal-100 text-teal-700',
  'Database': 'bg-orange-100 text-orange-700',
  'Web Server': 'bg-cyan-100 text-cyan-700',
  'Updates': 'bg-amber-100 text-amber-700',
  'Security': 'bg-red-100 text-red-700',
  'Audio': 'bg-pink-100 text-pink-700',
  'Bluetooth': 'bg-sky-100 text-sky-700',
  'System': 'bg-gray-100 text-gray-600',
};

export function WinServicesModal({ isOpen, onClose, equipmentId, equipmentName, ipAddress }: WinServicesModalProps) {
  const [filter, setFilter] = useState<'running' | 'stopped' | 'all'>('running');
  const [search, setSearch] = useState('');
  const [groupByCategory, setGroupByCategory] = useState(true);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['equipment-win-services', equipmentId, ipAddress, filter],
    queryFn: async () => {
      const res = await api.get(`/equipment/${equipmentId}/win-services`, { params: { filter, targetIp: ipAddress } });
      return res.data.data;
    },
    enabled: isOpen,
    staleTime: 30000,
  });

  if (!isOpen) return null;

  const services: ServiceInfo[] = data?.services || [];
  const errorMsg = data?.error;
  const summary = data?.summary;

  // Apply local search filter
  const filtered = search
    ? services.filter(s =>
        s.displayName.toLowerCase().includes(search.toLowerCase()) ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        (s.description || '').toLowerCase().includes(search.toLowerCase())
      )
    : services;

  // Group by category
  const grouped = groupByCategory
    ? filtered.reduce<Record<string, ServiceInfo[]>>((acc, svc) => {
        (acc[svc.category] = acc[svc.category] || []).push(svc);
        return acc;
      }, {})
    : { 'All Services': filtered };

  // Sort categories: important ones first
  const categoryOrder = ['Printing', 'EFI/Fiery', 'Remote Access', 'Database', 'Web Server', 'Networking', 'Security'];
  const sortedCategories = Object.keys(grouped).sort((a, b) => {
    const ai = categoryOrder.indexOf(a);
    const bi = categoryOrder.indexOf(b);
    if (ai >= 0 && bi >= 0) return ai - bi;
    if (ai >= 0) return -1;
    if (bi >= 0) return 1;
    return a.localeCompare(b);
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Server className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Windows Services</h2>
              <p className="text-sm text-gray-500">
                {equipmentName} — {ipAddress}
                <span className="ml-2 inline-flex items-center gap-1 text-xs text-amber-600">
                  <Lock className="h-3 w-3" />
                  Read-only
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 bg-gray-50">
          {/* Filter tabs */}
          <div className="flex items-center bg-white border border-gray-200 rounded-lg overflow-hidden">
            {(['running', 'stopped', 'all'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  filter === f
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {f === 'running' ? `Running${summary ? ` (${summary.running})` : ''}` :
                 f === 'stopped' ? `Stopped${summary ? ` (${summary.stopped})` : ''}` :
                 `All${summary ? ` (${summary.total})` : ''}`}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search services..."
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          {/* Group toggle */}
          <button
            onClick={() => setGroupByCategory(!groupByCategory)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors ${
              groupByCategory
                ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Filter className="h-3.5 w-3.5" />
            Group
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Spinner size="lg" />
              <p className="text-sm text-gray-500">Querying services on {ipAddress}...</p>
            </div>
          ) : errorMsg ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <AlertTriangle className="h-10 w-10 text-amber-400" />
              <p className="text-sm text-gray-700 font-medium">Could not query services</p>
              <p className="text-xs text-gray-500 max-w-md text-center">{errorMsg}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Server className="h-10 w-10 text-gray-300" />
              <p className="text-sm text-gray-500">
                {search ? 'No services match your search' : 'No services found'}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {sortedCategories.map((category) => (
                <div key={category}>
                  {groupByCategory && (
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_COLORS[category] || 'bg-gray-100 text-gray-600'}`}>
                        {category}
                      </span>
                      <span className="text-xs text-gray-400">{grouped[category].length} service{grouped[category].length !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-gray-500 bg-gray-50 border-b border-gray-200">
                          <th className="text-left py-2 px-3 font-medium w-8"></th>
                          <th className="text-left py-2 px-3 font-medium">Service</th>
                          <th className="text-left py-2 px-3 font-medium">Start Mode</th>
                          <th className="text-right py-2 px-3 font-medium">PID</th>
                        </tr>
                      </thead>
                      <tbody>
                        {grouped[category].map((svc) => (
                          <tr key={svc.name} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors group">
                            <td className="py-2 px-3">
                              {svc.state === 'Running' ? (
                                <Activity className="h-4 w-4 text-green-500" />
                              ) : (
                                <XCircle className="h-4 w-4 text-gray-300" />
                              )}
                            </td>
                            <td className="py-2 px-3">
                              <div className="font-medium text-gray-900">{svc.displayName}</div>
                              <div className="text-xs text-gray-400 font-mono">{svc.name}</div>
                              {svc.description && (
                                <div className="text-xs text-gray-400 mt-0.5 max-w-md truncate group-hover:whitespace-normal">
                                  {svc.description}
                                </div>
                              )}
                            </td>
                            <td className="py-2 px-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                svc.startMode === 'Auto' ? 'bg-green-50 text-green-700'
                                  : svc.startMode === 'Manual' ? 'bg-amber-50 text-amber-700'
                                  : 'bg-gray-100 text-gray-600'
                              }`}>
                                {svc.startMode}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-gray-500">
                              {svc.pid || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Lock className="h-3 w-3" />
            Read-only view — no service modifications allowed
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
