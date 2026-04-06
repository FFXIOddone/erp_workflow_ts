import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Printer,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  Package,
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Scissors,
  FileText,
  FolderOpen,
} from 'lucide-react';
import { format } from 'date-fns';
import { matchesSearchFields } from '@erp/shared';
import { api } from '../lib/api';

// ─── Types ─────────────────────────────────────────────

type SortField = 'jobName' | 'status' | 'printer' | 'createTime' | 'workOrderNumber' | 'customerName' | 'printMedia';
type SortDir = 'asc' | 'desc';

interface ThrivePrintJob {
  jobGuid: string;
  jobName: string;
  fileName: string;
  workOrderNumber?: string;
  status: string;
  statusCode: number;
  createTime: string;
  createDate: string;
  processStartTime?: string;
  printer: string;
  printingMethod?: string;
  printMedia: string;
  numCopies: number;
  inkTotal?: string;
  inkCoverage?: string;
  customerName?: string;
  jobSize?: string;
  companyBrand?: string;
  jobDescription?: string;
  workOrder?: {
    id: string;
    orderNumber: string;
    title: string;
    status: string;
    customerName?: string;
  };
}

interface ThriveCutJob {
  jobName: string;
  fileName: string;
  workOrderNumber?: string;
  device: string;
  printer: string;
  media: string;
  width: number;
  height: number;
  guid: string;
  customerName?: string;
  companyBrand?: string;
}

interface ThriveMachineData {
  machine: { id: string; name: string; ip: string };
  printJobs: ThrivePrintJob[];
  cutJobs: ThriveCutJob[];
  summary: {
    totalPrintJobs: number;
    totalCutJobs: number;
    linkedToWorkOrders: number;
    printers: string[];
  };
}

// ─── Status helpers ─────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  'Pending': 'bg-yellow-50 text-yellow-700',
  'Processing': 'bg-blue-50 text-blue-700',
  'Ready to Print': 'bg-indigo-50 text-indigo-700',
  'Printing': 'bg-green-50 text-green-700',
  'Printed': 'bg-gray-50 text-gray-600',
  'Error': 'bg-red-50 text-red-700',
};

function StatusBadge({ status }: { status: string }) {
  const colors = STATUS_COLORS[status] || 'bg-gray-50 text-gray-600';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${colors}`}>
      {status === 'Printing' && <Loader2 className="h-3 w-3 animate-spin" />}
      {status === 'Printed' && <CheckCircle2 className="h-3 w-3" />}
      {status === 'Error' && <AlertCircle className="h-3 w-3" />}
      {status}
    </span>
  );
}

// ─── Component ─────────────────────────────────────────

interface Props {
  machineIp: string;
}

export default function ThriveLiveDataPanel({ machineIp }: Props) {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('createTime');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [printerFilter, setPrinterFilter] = useState<string>('all');
  const [tab, setTab] = useState<'print' | 'cut'>('print');

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['thrive-machine', machineIp],
    queryFn: () => api.get(`/equipment/thrive/machine/${machineIp}`).then(r => r.data.data as ThriveMachineData),
    refetchInterval: 30_000,
  });

  // Unique statuses and printers for filter dropdowns
  const statuses = useMemo(() => {
    if (!data?.printJobs) return [];
    return [...new Set(data.printJobs.map(j => j.status))].sort();
  }, [data?.printJobs]);

  const printers = useMemo(() => {
    if (!data?.printJobs) return [];
    return [...new Set(data.printJobs.map(j => j.printer))].sort();
  }, [data?.printJobs]);

  // Filter + sort print jobs
  const filteredPrintJobs = useMemo(() => {
    if (!data?.printJobs) return [];
    let jobs = [...data.printJobs];

    if (search) {
      jobs = jobs.filter((job) =>
        matchesSearchFields(
          [job.jobName, job.workOrderNumber, job.customerName, job.printer, job.fileName],
          search,
        ),
      );
    }
    if (statusFilter !== 'all') {
      jobs = jobs.filter(j => j.status === statusFilter);
    }
    if (printerFilter !== 'all') {
      jobs = jobs.filter(j => j.printer === printerFilter);
    }

    jobs.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'jobName': cmp = (a.jobName || '').localeCompare(b.jobName || ''); break;
        case 'status': cmp = (a.status || '').localeCompare(b.status || ''); break;
        case 'printer': cmp = (a.printer || '').localeCompare(b.printer || ''); break;
        case 'createTime': cmp = (a.createTime || '').localeCompare(b.createTime || ''); break;
        case 'workOrderNumber': cmp = (a.workOrderNumber || '').localeCompare(b.workOrderNumber || ''); break;
        case 'customerName': cmp = (a.customerName || '').localeCompare(b.customerName || ''); break;
        case 'printMedia': cmp = (a.printMedia || '').localeCompare(b.printMedia || ''); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return jobs;
  }, [data?.printJobs, search, statusFilter, printerFilter, sortField, sortDir]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  }

  // ─── Loading / Error ─────────────────────────────────
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
        <Loader2 className="h-8 w-8 text-blue-500 animate-spin mx-auto mb-2" />
        <p className="text-gray-500">Loading Thrive print data...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
        <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
        <p className="text-gray-700 font-medium">Failed to load Thrive data</p>
        <p className="text-sm text-gray-500 mt-1">{(error as any)?.message || 'Unknown error'}</p>
        <button onClick={() => refetch()} className="mt-3 px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">
          Retry
        </button>
      </div>
    );
  }

  const { summary, cutJobs, printJobs } = data;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <Printer className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Thrive Print Queue</h3>
            <p className="text-xs text-gray-500">{data.machine.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Summary badges */}
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full font-medium">
              {summary.totalPrintJobs} print jobs
            </span>
            {summary.totalCutJobs > 0 && (
              <span className="px-2 py-1 bg-orange-50 text-orange-700 rounded-full font-medium">
                {summary.totalCutJobs} cut jobs
              </span>
            )}
            <span className="px-2 py-1 bg-green-50 text-green-700 rounded-full font-medium">
              {summary.linkedToWorkOrders} linked
            </span>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tab bar */}
      {cutJobs.length > 0 && (
        <div className="flex border-b border-gray-200 px-4">
          <button
            onClick={() => setTab('print')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === 'print' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Printer className="h-4 w-4 inline mr-1" /> Print Jobs ({printJobs.length})
          </button>
          <button
            onClick={() => setTab('cut')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === 'cut' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Scissors className="h-4 w-4 inline mr-1" /> Cut Jobs ({cutJobs.length})
          </button>
        </div>
      )}

      {/* Print Jobs Tab */}
      {tab === 'print' && (
        <>
          {/* Filters */}
          <div className="px-4 py-2 border-b border-gray-100 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search jobs, WO#, customer..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-1">
              <Filter className="h-4 w-4 text-gray-400" />
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">All Statuses</option>
                {statuses.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select
                value={printerFilter}
                onChange={e => setPrinterFilter(e.target.value)}
                className="text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">All Printers</option>
                {printers.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* Table */}
          {filteredPrintJobs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <FileText className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p>{printJobs.length === 0 ? 'No print jobs in queue' : 'No jobs match filters'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
                    <th className="px-3 py-2 cursor-pointer" onClick={() => toggleSort('status')}>
                      <span className="flex items-center gap-1">Status <SortIcon field="status" /></span>
                    </th>
                    <th className="px-3 py-2 cursor-pointer" onClick={() => toggleSort('jobName')}>
                      <span className="flex items-center gap-1">Job <SortIcon field="jobName" /></span>
                    </th>
                    <th className="px-3 py-2 cursor-pointer" onClick={() => toggleSort('workOrderNumber')}>
                      <span className="flex items-center gap-1">Work Order <SortIcon field="workOrderNumber" /></span>
                    </th>
                    <th className="px-3 py-2 cursor-pointer" onClick={() => toggleSort('customerName')}>
                      <span className="flex items-center gap-1">Customer <SortIcon field="customerName" /></span>
                    </th>
                    <th className="px-3 py-2 cursor-pointer" onClick={() => toggleSort('printer')}>
                      <span className="flex items-center gap-1">Printer <SortIcon field="printer" /></span>
                    </th>
                    <th className="px-3 py-2 cursor-pointer" onClick={() => toggleSort('printMedia')}>
                      <span className="flex items-center gap-1">Media <SortIcon field="printMedia" /></span>
                    </th>
                    <th className="px-3 py-2 cursor-pointer" onClick={() => toggleSort('createTime')}>
                      <span className="flex items-center gap-1">Created <SortIcon field="createTime" /></span>
                    </th>
                    <th className="px-3 py-2">Copies</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredPrintJobs.map((job) => (
                    <tr key={job.jobGuid} className="hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <StatusBadge status={job.status} />
                      </td>
                      <td className="px-3 py-2 max-w-[250px]">
                        <div className="truncate font-medium text-gray-900" title={job.jobName}>
                          {job.jobName}
                        </div>
                        {job.jobSize && (
                          <div className="text-xs text-gray-400">{job.jobSize}</div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {job.workOrder ? (
                          <div className="flex items-center gap-1">
                            <Link
                              to={`/orders/${job.workOrder.id}`}
                              className="text-blue-600 hover:text-blue-800 font-medium"
                            >
                              WO#{job.workOrder.orderNumber}
                            </Link>
                            <Link
                              to={`/orders/${job.workOrder.id}#files`}
                              className="p-0.5 text-gray-400 hover:text-primary-600 rounded"
                              title="Open network files"
                            >
                              <FolderOpen className="w-3.5 h-3.5" />
                            </Link>
                          </div>
                        ) : job.workOrderNumber ? (
                          <span className="text-gray-500 font-mono text-xs">WO#{job.workOrderNumber}</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-600 max-w-[150px] truncate" title={job.customerName || ''}>
                        {job.customerName || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-xs text-gray-600">{job.printer}</span>
                      </td>
                      <td className="px-3 py-2 text-gray-600 max-w-[120px] truncate" title={job.printMedia || ''}>
                        {job.printMedia || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                        {job.createTime && !isNaN(new Date(job.createTime).getTime()) ? format(new Date(job.createTime), 'MM/dd HH:mm') : '—'}
                      </td>
                      <td className="px-3 py-2 text-center text-gray-600">
                        {job.numCopies}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Cut Jobs Tab */}
      {tab === 'cut' && (
        <div className="overflow-x-auto">
          {cutJobs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Scissors className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p>No cut jobs pending</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
                  <th className="px-3 py-2">Job</th>
                  <th className="px-3 py-2">Work Order</th>
                  <th className="px-3 py-2">Device</th>
                  <th className="px-3 py-2">Printer</th>
                  <th className="px-3 py-2">Media</th>
                  <th className="px-3 py-2">Size</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cutJobs.map((cut, i) => (
                  <tr key={cut.guid || i} className="hover:bg-gray-50">
                    <td className="px-3 py-2 max-w-[200px]">
                      <div className="truncate font-medium text-gray-900" title={cut.jobName}>
                        {cut.jobName}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {cut.workOrderNumber ? (
                        <span className="font-mono text-xs text-gray-600">WO#{cut.workOrderNumber}</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">{cut.device}</td>
                    <td className="px-3 py-2 text-xs text-gray-600">{cut.printer}</td>
                    <td className="px-3 py-2 text-gray-600 max-w-[100px] truncate">{cut.media || '—'}</td>
                    <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                      {cut.width && cut.height ? `${Math.round(cut.width)}×${Math.round(cut.height)}mm` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-400 flex items-center justify-between">
        <span>
          Showing {tab === 'print' ? filteredPrintJobs.length : cutJobs.length} of{' '}
          {tab === 'print' ? printJobs.length : cutJobs.length} {tab} jobs
        </span>
        <span>Auto-refreshes every 30s</span>
      </div>
    </div>
  );
}
