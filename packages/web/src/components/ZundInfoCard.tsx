import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Scissors, Maximize2, Box, ChevronDown, ChevronUp, CheckCircle, Clock, X, Link2, FileText, Loader2, HardDrive, Link, Unlink, Search } from 'lucide-react';
import { api } from '../lib/api';
import { formatDateTime } from '../lib/date';

interface ZundInfoCardProps {
  orderNumber: string;
}

interface CutJob {
  jobName: string;
  fileName: string;
  device: string;
  printer: string;
  media: string;
  width: number;
  height: number;
  guid: string;
  sourceMachine?: string;
  customerName?: string;
  manuallyLinked?: boolean;
  linkId?: string;
}

interface ZundCompletedJob {
  jobId: number;
  jobName: string;
  productionStart: string;
  productionEnd: string;
  copyDone: number;
  matchedVia?: string;
  manuallyLinked?: boolean;
  linkId?: string;
}

interface ZundQueueFile {
  fileName: string;
  jobName: string;
  status: 'queued' | 'active' | 'completed' | 'linked';
  material: string | null;
  creationDate: string | null;
  modified: string;
  copyDone: number;
  copyTotal: number;
  cutterName: string | null;
  remainingTimeMs: number | null;
  manuallyLinked?: boolean;
  linkId?: string;
}

export function ZundInfoCard({ orderNumber }: ZundInfoCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedPendingJob, setSelectedPendingJob] = useState<CutJob | null>(null);
  const [selectedCompletedJob, setSelectedCompletedJob] = useState<ZundCompletedJob | null>(null);
  const [selectedQueueFile, setSelectedQueueFile] = useState<ZundQueueFile | null>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const INITIAL_DISPLAY_COUNT = 2;
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['thrive-cuts', orderNumber],
    queryFn: async () => {
      const response = await api.get(`/equipment/thrive/workorder/${orderNumber}`);
      return response.data.data;
    },
    refetchInterval: 30000,
  });

  const { data: unlinkedData, isLoading: loadingUnlinked } = useQuery({
    queryKey: ['unlinked-cut-jobs'],
    queryFn: async () => {
      const response = await api.get('/equipment/thrive/unlinked-jobs');
      return response.data.data;
    },
    enabled: showLinkModal,
  });

  const linkMutation = useMutation({
    mutationFn: async (job: { jobType: string; jobIdentifier: string; jobName: string }) => {
      return api.post(`/equipment/thrive/workorder/${orderNumber}/link-job`, job);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thrive-cuts', orderNumber] });
      queryClient.invalidateQueries({ queryKey: ['thrive-jobs', orderNumber] });
      queryClient.invalidateQueries({ queryKey: ['unlinked-cut-jobs'] });
      setShowLinkModal(false);
      setSearchQuery('');
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: async (linkId: string) => {
      return api.delete(`/equipment/thrive/workorder/${orderNumber}/link-job/${linkId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thrive-cuts', orderNumber] });
      queryClient.invalidateQueries({ queryKey: ['thrive-jobs', orderNumber] });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async (params: { jobType: string; jobIdentifier: string }) => {
      return api.post(`/equipment/thrive/workorder/${orderNumber}/dismiss-job`, params);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thrive-cuts', orderNumber] });
      queryClient.invalidateQueries({ queryKey: ['thrive-jobs', orderNumber] });
    },
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-soft border border-gray-100 p-6 animate-pulse">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-5 h-5 bg-gray-200 rounded" />
          <div className="h-5 bg-gray-200 rounded w-24" />
        </div>
        <div className="space-y-3">
          <div className="h-16 bg-gray-100 rounded-lg" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white rounded-xl shadow-soft border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Scissors className="h-5 w-5 text-orange-600" />
          <h2 className="text-lg font-semibold text-gray-900">Zund Cut Files</h2>
        </div>
        <div className="text-center py-4 text-gray-400">
          <Scissors className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Unable to load cut data</p>
        </div>
      </div>
    );
  }

  const cutJobs: CutJob[] = data.cutJobs || [];
  const zundCompletedJobs: ZundCompletedJob[] = data.zundCompletedJobs || [];
  const zundQueueFiles: ZundQueueFile[] = data.zundQueueFiles || [];
  const totalJobs = cutJobs.length + zundCompletedJobs.length + zundQueueFiles.length;

  if (totalJobs === 0) {
    return (
      <div className="bg-white rounded-xl shadow-soft border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Scissors className="h-5 w-5 text-orange-600" />
          <h2 className="text-lg font-semibold text-gray-900">Zund Cut Files</h2>
        </div>
        <div className="text-center py-4 text-gray-400">
          <Scissors className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No cut files found for this order</p>
          <button
            onClick={() => setShowLinkModal(true)}
            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded-lg transition-colors"
          >
            <Link className="h-3.5 w-3.5" />
            Link Cut File
          </button>
        </div>
        {showLinkModal && <LinkCutModal />}
      </div>
    );
  }

  // Format dimensions (convert from mm to inches if needed)
  const formatDimension = (mm: number) => {
    if (mm <= 0) return '-';
    const inches = mm / 25.4;
    if (inches > 12) {
      return `${inches.toFixed(1)}"`;
    }
    return `${mm.toFixed(0)}mm`;
  };

  // Combine all types for display — queue files first (active/queued), then pending, then completed
  const allJobs = [
    ...zundQueueFiles.filter(f => f.status === 'active').map(job => ({ type: 'queue-active' as const, job })),
    ...zundQueueFiles.filter(f => f.status === 'queued').map(job => ({ type: 'queue-queued' as const, job })),
    ...zundQueueFiles.filter(f => f.status === 'linked').map(job => ({ type: 'queue-queued' as const, job })),
    ...cutJobs.map(job => ({ type: 'pending' as const, job })),
    ...zundQueueFiles.filter(f => f.status === 'completed').map(job => ({ type: 'queue-completed' as const, job })),
    ...zundCompletedJobs.map(job => ({ type: 'completed' as const, job })),
  ];

  return (
    <div className="bg-white rounded-xl shadow-soft border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Scissors className="h-5 w-5 text-orange-600" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Zund Cut Files</h2>
            <p className="text-xs text-gray-400">From Zund Queue, Thrive Cut Center &amp; Statistics DB</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLinkModal(true)}
            className="p-1 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
            title="Link a cut file"
          >
            <Link className="h-4 w-4" />
          </button>
          <div className="flex gap-1 flex-wrap">
          {zundQueueFiles.filter(f => f.status === 'active').length > 0 && (
            <span className="px-2 py-0.5 text-xs font-bold bg-blue-100 text-blue-700 rounded-full" title="Actively cutting on Zund">
              {zundQueueFiles.filter(f => f.status === 'active').length} cutting
            </span>
          )}
          {zundQueueFiles.filter(f => f.status === 'queued').length > 0 && (
            <span className="px-2 py-0.5 text-xs font-bold bg-purple-100 text-purple-700 rounded-full" title="In Zund job queue">
              {zundQueueFiles.filter(f => f.status === 'queued').length} queued
            </span>
          )}
          {cutJobs.length > 0 && (
            <span className="px-2 py-0.5 text-xs font-bold bg-yellow-100 text-yellow-700 rounded-full" title="Pending in Thrive queue">
              {cutJobs.length} pending
            </span>
          )}
          {(zundCompletedJobs.length > 0 || zundQueueFiles.filter(f => f.status === 'completed').length > 0) && (
            <span className="px-2 py-0.5 text-xs font-bold bg-green-100 text-green-700 rounded-full" title="Completed on Zund">
              {zundCompletedJobs.length + zundQueueFiles.filter(f => f.status === 'completed').length} done
            </span>
          )}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {(isExpanded ? allJobs : allJobs.slice(0, INITIAL_DISPLAY_COUNT)).map((item, idx) => {
          if (item.type === 'pending') {
            const job = item.job as CutJob;
            return (
              <div
                key={job.guid || `pending-${idx}`}
                onClick={() => setSelectedPendingJob(job)}
                className="p-3 rounded-lg border bg-yellow-50 border-yellow-200 cursor-pointer hover:ring-2 hover:ring-yellow-300 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-yellow-600" />
                    <span className="text-xs font-medium text-yellow-700">Pending</span>
                    {job.manuallyLinked && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 rounded-full">
                        <Link className="h-2.5 w-2.5" />
                        Linked
                      </span>
                    )}
                  </div>
                  {job.linkId && (
                    <button
                      onClick={(e) => { e.stopPropagation(); unlinkMutation.mutate(job.linkId!); }}
                      className="p-0.5 text-gray-400 hover:text-red-500 rounded transition-colors"
                      title="Unlink this job"
                    >
                      <Unlink className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {!job.manuallyLinked && !job.linkId && job.guid && (
                    <button
                      onClick={(e) => { e.stopPropagation(); dismissMutation.mutate({ jobType: 'CUT_JOB', jobIdentifier: job.guid }); }}
                      className="p-0.5 text-gray-400 hover:text-orange-500 rounded transition-colors"
                      title="Dismiss — not related to this order"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-sm font-medium text-gray-900 truncate mt-1" title={job.jobName}>
                  {job.jobName}
                </p>

                <div className="mt-2 space-y-1">
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                    {job.device && (
                      <span className="flex items-center gap-1">
                        <Box className="h-3 w-3" />
                        {job.device}
                      </span>
                    )}
                    {(job.width > 0 || job.height > 0) && (
                      <span className="flex items-center gap-1">
                        <Maximize2 className="h-3 w-3" />
                        {formatDimension(job.width)} x {formatDimension(job.height)}
                      </span>
                    )}
                    {job.guid && (
                      <span className="flex items-center gap-1 text-purple-500" title={`Cut ID: ${job.guid}`}>
                        <Link2 className="h-3 w-3" />
                        Linked via Cut ID
                      </span>
                    )}
                    {job.sourceMachine && (
                      <span className="flex items-center gap-1 text-gray-400">
                        <FileText className="h-3 w-3" />
                        {job.sourceMachine}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          } else if (item.type === 'completed') {
            const job = item.job as ZundCompletedJob;
            return (
              <div
                key={`zund-${job.jobId}`}
                onClick={() => setSelectedCompletedJob(job)}
                className="p-3 rounded-lg border bg-green-50 border-green-200 cursor-pointer hover:ring-2 hover:ring-green-300 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-xs font-medium text-green-700">Completed</span>
                    {job.manuallyLinked && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 rounded-full">
                        <Link className="h-2.5 w-2.5" />
                        Linked
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {job.linkId && (
                      <button
                        onClick={(e) => { e.stopPropagation(); unlinkMutation.mutate(job.linkId!); }}
                        className="p-0.5 text-gray-400 hover:text-red-500 rounded transition-colors"
                        title="Unlink this job"
                      >
                        <Unlink className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {!job.manuallyLinked && !job.linkId && (
                      <button
                        onClick={(e) => { e.stopPropagation(); dismissMutation.mutate({ jobType: 'ZUND_COMPLETED', jobIdentifier: String(job.jobId) }); }}
                        className="p-0.5 text-gray-400 hover:text-orange-500 rounded transition-colors"
                        title="Dismiss — not related to this order"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <span className="text-xs text-gray-500">
                      {formatDateTime(job.productionStart)}
                    </span>
                  </div>
                </div>
                <p className="text-sm font-medium text-gray-900 truncate mt-1" title={job.jobName}>
                  {job.jobName}
                </p>

                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                  <span>{job.copyDone} {job.copyDone === 1 ? 'copy' : 'copies'}</span>
                  {job.matchedVia && (
                    <span className="flex items-center gap-1 text-purple-500" title={job.matchedVia}>
                      <Link2 className="h-3 w-3" />
                      {job.matchedVia}
                    </span>
                  )}
                </div>
              </div>
            );
          } else {
            // Queue files from file server (queue-active, queue-queued, queue-completed)
            const qf = item.job as ZundQueueFile;
            const isActive = item.type === 'queue-active';
            const isQueued = item.type === 'queue-queued';
            const bgClass = isActive
              ? 'bg-blue-50 border-blue-200 hover:ring-blue-300'
              : isQueued
              ? 'bg-purple-50 border-purple-200 hover:ring-purple-300'
              : 'bg-green-50 border-green-200 hover:ring-green-300';
            const iconColor = isActive ? 'text-blue-600' : isQueued ? 'text-purple-600' : 'text-green-600';
            const labelColor = isActive ? 'text-blue-700' : isQueued ? 'text-purple-700' : 'text-green-700';
            const label = isActive ? 'Cutting' : isQueued ? 'In Queue' : 'Cut Complete';

            return (
              <div
                key={`queue-${qf.fileName}`}
                onClick={() => setSelectedQueueFile(qf)}
                className={`p-3 rounded-lg border cursor-pointer hover:ring-2 transition-all ${bgClass}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {isActive ? <Loader2 className={`h-4 w-4 ${iconColor} animate-spin`} /> :
                     isQueued ? <HardDrive className={`h-4 w-4 ${iconColor}`} /> :
                     <CheckCircle className={`h-4 w-4 ${iconColor}`} />}
                    <span className={`text-xs font-medium ${labelColor}`}>{label}</span>
                    {qf.manuallyLinked && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 rounded-full">
                        <Link className="h-2.5 w-2.5" />
                        Linked
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {qf.linkId && (
                      <button
                        onClick={(e) => { e.stopPropagation(); unlinkMutation.mutate(qf.linkId!); }}
                        className="p-0.5 text-gray-400 hover:text-red-500 rounded transition-colors"
                        title="Unlink this job"
                      >
                        <Unlink className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {!qf.manuallyLinked && !qf.linkId && (
                      <button
                        onClick={(e) => { e.stopPropagation(); dismissMutation.mutate({ jobType: 'ZUND_QUEUE', jobIdentifier: qf.fileName }); }}
                        className="p-0.5 text-gray-400 hover:text-orange-500 rounded transition-colors"
                        title="Dismiss — not related to this order"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <span className="text-xs text-gray-500">
                      {qf.modified ? new Date(qf.modified).toLocaleDateString() : ''}
                    </span>
                  </div>
                </div>
                <p className="text-sm font-medium text-gray-900 truncate mt-1" title={qf.jobName}>
                  {qf.jobName}
                </p>

                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                  {qf.material && (
                    <span className="flex items-center gap-1">
                      <Box className="h-3 w-3" />
                      {qf.material}
                    </span>
                  )}
                  {isActive && qf.copyTotal > 0 && (
                    <span>{qf.copyDone}/{qf.copyTotal} copies</span>
                  )}
                  {isActive && qf.cutterName && (
                    <span className="flex items-center gap-1">
                      <Scissors className="h-3 w-3" />
                      {qf.cutterName}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-purple-500" title="From Zund Job Queue">
                    <HardDrive className="h-3 w-3" />
                    Zund Queue
                  </span>
                </div>
              </div>
            );
          }
        })}
      </div>

      {totalJobs > INITIAL_DISPLAY_COUNT && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full mt-3 py-2 text-sm font-medium text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded-lg transition-colors flex items-center justify-center gap-1"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="h-4 w-4" />
              Show Less
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4" />
              Show {totalJobs - INITIAL_DISPLAY_COUNT} More
            </>
          )}
        </button>
      )}

      {/* Pending Cut Job Detail Modal */}
      {selectedPendingJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSelectedPendingJob(null)}>
          <div 
            className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Scissors className="h-5 w-5 text-yellow-600" />
                <h3 className="text-lg font-semibold text-gray-900">Pending Cut Job Details</h3>
              </div>
              <button
                onClick={() => setSelectedPendingJob(null)}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-4">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="py-2 text-gray-500 font-medium pr-4">Job Name</td>
                    <td className="py-2 text-gray-900 break-all">{selectedPendingJob.jobName}</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-gray-500 font-medium pr-4">File Name</td>
                    <td className="py-2 text-gray-900 break-all">{selectedPendingJob.fileName}</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-gray-500 font-medium pr-4">Status</td>
                    <td className="py-2">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                        <Clock className="h-3 w-3" />
                        Pending
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-gray-500 font-medium pr-4">Device</td>
                    <td className="py-2 text-gray-900">{selectedPendingJob.device || '-'}</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-gray-500 font-medium pr-4">Printer</td>
                    <td className="py-2 text-gray-900">{selectedPendingJob.printer || '-'}</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-gray-500 font-medium pr-4">Media</td>
                    <td className="py-2 text-gray-900">{selectedPendingJob.media || '-'}</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-gray-500 font-medium pr-4">Dimensions</td>
                    <td className="py-2 text-gray-900">
                      {selectedPendingJob.width > 0 || selectedPendingJob.height > 0 
                        ? `${formatDimension(selectedPendingJob.width)} × ${formatDimension(selectedPendingJob.height)}`
                        : '-'}
                    </td>
                  </tr>
                  {selectedPendingJob.sourceMachine && (
                    <tr>
                      <td className="py-2 text-gray-500 font-medium pr-4">Source Machine</td>
                      <td className="py-2 text-gray-900">{selectedPendingJob.sourceMachine}</td>
                    </tr>
                  )}
                  {selectedPendingJob.customerName && (
                    <tr>
                      <td className="py-2 text-gray-500 font-medium pr-4">Customer</td>
                      <td className="py-2 text-gray-900">{selectedPendingJob.customerName}</td>
                    </tr>
                  )}
                  <tr>
                    <td className="py-2 text-gray-500 font-medium pr-4">Job GUID</td>
                    <td className="py-2 text-gray-500 text-xs font-mono">{selectedPendingJob.guid}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Completed Zund Job Detail Modal */}
      {selectedCompletedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSelectedCompletedJob(null)}>
          <div 
            className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Scissors className="h-5 w-5 text-green-600" />
                <h3 className="text-lg font-semibold text-gray-900">Completed Cut Job Details</h3>
              </div>
              <button
                onClick={() => setSelectedCompletedJob(null)}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-4">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="py-2 text-gray-500 font-medium pr-4">Job Name</td>
                    <td className="py-2 text-gray-900 break-all">{selectedCompletedJob.jobName}</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-gray-500 font-medium pr-4">Status</td>
                    <td className="py-2">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        <CheckCircle className="h-3 w-3" />
                        Completed
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-gray-500 font-medium pr-4">Copies Done</td>
                    <td className="py-2 text-gray-900">{selectedCompletedJob.copyDone}</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-gray-500 font-medium pr-4">Production Start</td>
                    <td className="py-2 text-gray-900">{formatDateTime(selectedCompletedJob.productionStart)}</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-gray-500 font-medium pr-4">Production End</td>
                    <td className="py-2 text-gray-900">{formatDateTime(selectedCompletedJob.productionEnd)}</td>
                  </tr>
                  {selectedCompletedJob.matchedVia && (
                    <tr>
                      <td className="py-2 text-gray-500 font-medium pr-4">Matched Via</td>
                      <td className="py-2 text-gray-900 break-all">{selectedCompletedJob.matchedVia}</td>
                    </tr>
                  )}
                  <tr>
                    <td className="py-2 text-gray-500 font-medium pr-4">Job ID</td>
                    <td className="py-2 text-gray-500 text-xs font-mono">{selectedCompletedJob.jobId}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Zund Queue File Detail Modal */}
      {selectedQueueFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSelectedQueueFile(null)}>
          <div 
            className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <HardDrive className="h-5 w-5 text-purple-600" />
                <h3 className="text-lg font-semibold text-gray-900">Zund Queue File Details</h3>
              </div>
              <button
                onClick={() => setSelectedQueueFile(null)}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-4">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="py-2 text-gray-500 font-medium pr-4">Job Name</td>
                    <td className="py-2 text-gray-900 break-all">{selectedQueueFile.jobName}</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-gray-500 font-medium pr-4">File</td>
                    <td className="py-2 text-gray-900 break-all font-mono text-xs">{selectedQueueFile.fileName}</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-gray-500 font-medium pr-4">Status</td>
                    <td className="py-2">
                      {selectedQueueFile.status === 'active' ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Cutting
                        </span>
                      ) : selectedQueueFile.status === 'queued' ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                          <HardDrive className="h-3 w-3" />
                          In Queue
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          <CheckCircle className="h-3 w-3" />
                          Cut Complete
                        </span>
                      )}
                    </td>
                  </tr>
                  {selectedQueueFile.material && (
                    <tr>
                      <td className="py-2 text-gray-500 font-medium pr-4">Material</td>
                      <td className="py-2 text-gray-900">{selectedQueueFile.material}</td>
                    </tr>
                  )}
                  {selectedQueueFile.cutterName && (
                    <tr>
                      <td className="py-2 text-gray-500 font-medium pr-4">Cutter</td>
                      <td className="py-2 text-gray-900">{selectedQueueFile.cutterName}</td>
                    </tr>
                  )}
                  {selectedQueueFile.status === 'active' && selectedQueueFile.copyTotal > 0 && (
                    <tr>
                      <td className="py-2 text-gray-500 font-medium pr-4">Progress</td>
                      <td className="py-2 text-gray-900">{selectedQueueFile.copyDone} / {selectedQueueFile.copyTotal} copies</td>
                    </tr>
                  )}
                  {selectedQueueFile.status === 'active' && selectedQueueFile.remainingTimeMs != null && selectedQueueFile.remainingTimeMs > 0 && (
                    <tr>
                      <td className="py-2 text-gray-500 font-medium pr-4">Remaining</td>
                      <td className="py-2 text-gray-900">{Math.ceil(selectedQueueFile.remainingTimeMs / 60000)} min</td>
                    </tr>
                  )}
                  {selectedQueueFile.creationDate && (
                    <tr>
                      <td className="py-2 text-gray-500 font-medium pr-4">Created</td>
                      <td className="py-2 text-gray-900">{selectedQueueFile.creationDate}</td>
                    </tr>
                  )}
                  <tr>
                    <td className="py-2 text-gray-500 font-medium pr-4">Last Modified</td>
                    <td className="py-2 text-gray-900">{selectedQueueFile.modified ? formatDateTime(selectedQueueFile.modified) : '-'}</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-gray-500 font-medium pr-4">Source</td>
                    <td className="py-2 text-gray-500 text-xs">Zund File Server Queue</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Dismissed Jobs */}
      {data.dismissedJobs?.filter((d: any) => d.jobType === 'CUT_JOB' || d.jobType === 'ZUND_QUEUE' || d.jobType === 'ZUND_COMPLETED').length > 0 && (
        <details className="mt-3">
          <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
            {data.dismissedJobs.filter((d: any) => d.jobType === 'CUT_JOB' || d.jobType === 'ZUND_QUEUE' || d.jobType === 'ZUND_COMPLETED').length} dismissed
          </summary>
          <div className="mt-2 space-y-1">
            {data.dismissedJobs
              .filter((d: any) => d.jobType === 'CUT_JOB' || d.jobType === 'ZUND_QUEUE' || d.jobType === 'ZUND_COMPLETED')
              .map((d: any) => (
                <div key={d.id} className="flex items-center justify-between px-2 py-1 text-xs text-gray-400 bg-gray-50 rounded">
                  <span className="truncate">{d.jobIdentifier}</span>
                  <button
                    onClick={() => api.delete(`/equipment/thrive/workorder/${orderNumber}/dismiss-job/${d.id}`).then(() => {
                      queryClient.invalidateQueries({ queryKey: ['thrive-cuts', orderNumber] });
                      queryClient.invalidateQueries({ queryKey: ['thrive-jobs', orderNumber] });
                    })}
                    className="ml-2 text-gray-400 hover:text-blue-600 shrink-0"
                    title="Restore this job"
                  >
                    Restore
                  </button>
                </div>
              ))}
          </div>
        </details>
      )}

      {showLinkModal && <LinkCutModal />}
    </div>
  );

  function LinkCutModal() {
    const cutJobsAvailable = unlinkedData?.cutJobs || [];
    const queueFilesAvailable = unlinkedData?.zundQueueFiles || [];
    const allAvailable = [
      ...cutJobsAvailable.map((j: any) => ({ type: 'CUT_JOB' as const, identifier: j.guid, name: j.jobName, detail: j.device || j.printer || '', source: 'Thrive Cut' })),
      ...queueFilesAvailable.map((j: any) => ({ type: 'ZUND_QUEUE' as const, identifier: j.fileName, name: j.jobName, detail: j.material || '', source: 'Zund Queue' })),
    ];
    const filtered = searchQuery
      ? allAvailable.filter(j =>
          j.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          j.identifier.toLowerCase().includes(searchQuery.toLowerCase()) ||
          j.detail.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : allAvailable;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => { setShowLinkModal(false); setSearchQuery(''); }}>
        <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <Link className="h-5 w-5 text-orange-600" />
              <h3 className="text-lg font-semibold text-gray-900">Link Cut File</h3>
            </div>
            <button onClick={() => { setShowLinkModal(false); setSearchQuery(''); }} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-4 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by job name, file name, or material..."
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                autoFocus
              />
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4">
            {loadingUnlinked ? (
              <div className="flex items-center justify-center py-8 text-gray-400">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Loading available cut files...
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Scissors className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">{searchQuery ? 'No matching files found' : 'No unlinked cut files available'}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((item) => (
                  <button
                    key={`${item.type}-${item.identifier}`}
                    onClick={() => linkMutation.mutate({ jobType: item.type, jobIdentifier: item.identifier, jobName: item.name })}
                    disabled={linkMutation.isPending}
                    className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-orange-300 hover:bg-orange-50 transition-all"
                  >
                    <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        {item.source === 'Thrive Cut' ? <Scissors className="h-3 w-3" /> : <HardDrive className="h-3 w-3" />}
                        {item.source}
                      </span>
                      {item.detail && <span>{item.detail}</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
}
