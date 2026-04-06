import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Printer, Clock, CheckCircle, AlertCircle, Layers, ChevronDown, ChevronUp, X, Link, Unlink, Search, Loader2 } from 'lucide-react';
import { filterBySearchFields } from '@erp/shared';
import { api } from '../lib/api';
import { formatDateTime } from '../lib/date';

interface PrinterInfoCardProps {
  orderNumber: string;
}

interface PrintJob {
  jobGuid: string;
  jobName: string;
  fileName: string;
  status: string;
  statusCode: number;
  createTime: string;
  createDate: string;
  printer: string;
  printMedia: string;
  numCopies: number;
  inkTotal?: string;
  inkCoverage?: string;
  jobSize?: string;
  customerName?: string;
  jobDescription?: string;
  manuallyLinked?: boolean;
  linkId?: string;
}

interface FieryJobData {
  jobId: string;
  jobName: string;
  fileName: string;
  timestamp: string | null;
  hasZccCutFile: boolean;
  zccFileName: string | null;
  dimensions: { width: number; height: number; depth: number } | null;
  media:
    | {
        brand: string | null;
        description: string | null;
        type: string | null;
        vutekMedia?: string | null;
      }
    | null;
  inks: string[];
  workOrderNumber: string | null;
  customerName: string | null;
  thriveFilePath: string | null;
  thriveJobMatch: boolean;
  matchedVia?: string;
  manuallyLinked?: boolean;
  linkId?: string;
}

export function PrinterInfoCard({ orderNumber }: PrinterInfoCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedJob, setSelectedJob] = useState<PrintJob | null>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const INITIAL_DISPLAY_COUNT = 2;
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['thrive-jobs', orderNumber],
    queryFn: async () => {
      const response = await api.get(`/equipment/thrive/workorder/${orderNumber}`);
      return response.data.data;
    },
    refetchInterval: 30000,
  });

  const { data: unlinkedData, isLoading: loadingUnlinked } = useQuery({
    queryKey: ['unlinked-print-jobs'],
    queryFn: async () => {
      const [printRes, fieryRes] = await Promise.all([
        api.get('/equipment/thrive/unlinked-jobs', { params: { type: 'PRINT_JOB' } }),
        api.get('/equipment/thrive/unlinked-jobs', { params: { type: 'FIERY_JOB' } }),
      ]);
      return {
        printJobs: printRes.data.data.printJobs || [],
        fieryJobs: fieryRes.data.data.fieryJobs || [],
      };
    },
    enabled: showLinkModal,
  });

  const linkMutation = useMutation({
    mutationFn: async (job: { jobGuid: string; jobName: string; jobType?: string }) => {
      return api.post(`/equipment/thrive/workorder/${orderNumber}/link-job`, {
        jobType: job.jobType || 'PRINT_JOB',
        jobIdentifier: job.jobGuid,
        jobName: job.jobName,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thrive-jobs', orderNumber] });
      queryClient.invalidateQueries({ queryKey: ['unlinked-print-jobs'] });
      setShowLinkModal(false);
      setSearchQuery('');
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: async (linkId: string) => {
      return api.delete(`/equipment/thrive/workorder/${orderNumber}/link-job/${linkId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thrive-jobs', orderNumber] });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async (params: { jobType: string; jobIdentifier: string }) => {
      return api.post(`/equipment/thrive/workorder/${orderNumber}/dismiss-job`, params);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thrive-jobs', orderNumber] });
    },
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-soft border border-gray-100 p-6 animate-pulse">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-5 h-5 bg-gray-200 rounded" />
          <div className="h-5 bg-gray-200 rounded w-28" />
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
          <Printer className="h-5 w-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-gray-900">Print Jobs</h2>
        </div>
        <div className="text-center py-4 text-gray-400">
          <Printer className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Unable to load print data</p>
        </div>
      </div>
    );
  }

  const printJobs: PrintJob[] = data.printJobs || [];
  const fieryJobs: FieryJobData[] = data.fieryJobs || [];
  const totalJobs = printJobs.length + fieryJobs.length;

  if (totalJobs === 0) {
    return (
      <div className="bg-white rounded-xl shadow-soft border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Printer className="h-5 w-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-gray-900">Print Jobs</h2>
        </div>
        <div className="text-center py-4 text-gray-400">
          <Printer className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No print jobs in queue</p>
          <button
            onClick={() => setShowLinkModal(true)}
            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
          >
            <Link className="h-3.5 w-3.5" />
            Link Print Job
          </button>
        </div>
        {showLinkModal && <LinkJobModal />}
      </div>
    );
  }

  const getStatusIcon = (statusCode: number) => {
    if (statusCode >= 32) return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (statusCode >= 8) return <Clock className="h-4 w-4 text-blue-500" />;
    if (statusCode === 64) return <AlertCircle className="h-4 w-4 text-red-500" />;
    return <Clock className="h-4 w-4 text-gray-400" />;
  };

  const getStatusColor = (statusCode: number) => {
    if (statusCode >= 32) return 'bg-green-50 border-green-200 text-green-700';
    if (statusCode >= 16) return 'bg-blue-50 border-blue-200 text-blue-700';
    if (statusCode >= 8) return 'bg-cyan-50 border-cyan-200 text-cyan-700';
    if (statusCode === 64) return 'bg-red-50 border-red-200 text-red-700';
    return 'bg-gray-50 border-gray-200 text-gray-700';
  };

  return (
    <div className="bg-white rounded-xl shadow-soft border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Printer className="h-5 w-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-gray-900">Print Jobs</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLinkModal(true)}
            className="p-1 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
            title="Link a print job"
          >
            <Link className="h-4 w-4" />
          </button>
          <span className="px-2 py-0.5 text-xs font-bold bg-primary-100 text-primary-700 rounded-full">
            {totalJobs}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {(isExpanded ? printJobs : printJobs.slice(0, INITIAL_DISPLAY_COUNT)).map((job) => (
          <div
            key={job.jobGuid}
            onClick={() => setSelectedJob(job)}
            className={`p-3 rounded-lg border cursor-pointer hover:ring-2 hover:ring-primary-300 transition-all ${getStatusColor(job.statusCode)}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                {getStatusIcon(job.statusCode)}
                <span className="font-medium text-sm">{job.status}</span>
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
                    onClick={(e) => { e.stopPropagation(); dismissMutation.mutate({ jobType: 'PRINT_JOB', jobIdentifier: job.jobGuid }); }}
                    className="p-0.5 text-gray-400 hover:text-orange-500 rounded transition-colors"
                    title="Dismiss — not related to this order"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
                <span className="text-xs text-gray-500">
                  {job.createDate && job.createTime ? formatDateTime(`${job.createDate} ${job.createTime}`) : `${job.createTime} ${job.createDate}`}
                </span>
              </div>
            </div>

            <div className="mt-2 space-y-1">
              <p className="text-sm font-medium text-gray-900 truncate" title={job.jobName}>
                {job.jobName}
              </p>
              
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                <span className="flex items-center gap-1">
                  <Printer className="h-3 w-3" />
                  {job.printer}
                </span>
                {job.numCopies > 1 && (
                  <span className="flex items-center gap-1">
                    <Layers className="h-3 w-3" />
                    {job.numCopies} copies
                  </span>
                )}
                {job.printMedia && (
                  <span title="Media">{job.printMedia}</span>
                )}
              </div>

              {job.jobSize && (
                <p className="text-xs text-gray-500">Size: {job.jobSize}</p>
              )}
              
              {job.inkCoverage && (
                <p className="text-xs text-gray-500">Ink Coverage: {job.inkCoverage}%</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {printJobs.length > INITIAL_DISPLAY_COUNT && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full mt-3 py-2 text-sm font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors flex items-center justify-center gap-1"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="h-4 w-4" />
              Show Less
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4" />
              Show {printJobs.length - INITIAL_DISPLAY_COUNT} More
            </>
          )}
        </button>
      )}

      {/* Fiery RIP Jobs (VUTEk) */}
      {fieryJobs.length > 0 && (
        <>
          {printJobs.length > 0 && (
            <div className="flex items-center gap-2 mt-4 mb-3">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Fiery RIP</span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>
          )}
          <div className="space-y-3">
            {fieryJobs.map((fj) => (
              <div
                key={fj.jobId}
                className="p-3 rounded-lg border bg-orange-50 border-orange-200 text-orange-700"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Printer className="h-4 w-4 text-orange-500" />
                    <span className="font-medium text-sm">VUTEk Flatbed</span>
                    {fj.manuallyLinked && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 rounded-full">
                        <Link className="h-2.5 w-2.5" />
                        Linked
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {fj.linkId && (
                      <button
                        onClick={() => unlinkMutation.mutate(fj.linkId!)}
                        className="p-0.5 text-gray-400 hover:text-red-500 rounded transition-colors"
                        title="Unlink this job"
                      >
                        <Unlink className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {!fj.manuallyLinked && !fj.linkId && (
                      <button
                        onClick={() => dismissMutation.mutate({ jobType: 'FIERY_JOB', jobIdentifier: fj.jobId })}
                        className="p-0.5 text-gray-400 hover:text-orange-500 rounded transition-colors"
                        title="Dismiss — not related to this order"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {fj.timestamp && (
                      <span className="text-xs text-gray-500">
                        {formatDateTime(fj.timestamp)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-2 space-y-1">
                  <p className="text-sm font-medium text-gray-900 truncate" title={fj.jobName}>
                    {fj.jobName}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                    {fj.matchedVia && (
                      <span className="text-orange-600">{fj.matchedVia}</span>
                    )}
                    {fj.dimensions && (
                      <span>
                        {Math.round(fj.dimensions.width / 72)}" x {Math.round(fj.dimensions.height / 72)}"
                      </span>
                    )}
                    {(fj.media?.vutekMedia || fj.media?.description) && (
                      <span>{fj.media.vutekMedia || fj.media.description}</span>
                    )}
                    {fj.inks.length > 0 && (
                      <span>{fj.inks.join(', ')}</span>
                    )}
                  </div>
                  {fj.hasZccCutFile && (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Has Zund cut file{fj.zccFileName ? `: ${fj.zccFileName}` : ''}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Dismissed Jobs */}
      {data.dismissedJobs?.filter((d: any) => d.jobType === 'PRINT_JOB' || d.jobType === 'FIERY_JOB').length > 0 && (
        <details className="mt-3">
          <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
            {data.dismissedJobs.filter((d: any) => d.jobType === 'PRINT_JOB' || d.jobType === 'FIERY_JOB').length} dismissed
          </summary>
          <div className="mt-2 space-y-1">
            {data.dismissedJobs
              .filter((d: any) => d.jobType === 'PRINT_JOB' || d.jobType === 'FIERY_JOB')
              .map((d: any) => (
                <div key={d.id} className="flex items-center justify-between px-2 py-1 text-xs text-gray-400 bg-gray-50 rounded">
                  <span className="truncate">{d.jobIdentifier}</span>
                  <button
                    onClick={() => api.delete(`/equipment/thrive/workorder/${orderNumber}/dismiss-job/${d.id}`).then(() => queryClient.invalidateQueries({ queryKey: ['thrive-jobs', orderNumber] }))}
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

      {/* Print Job Detail Modal */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSelectedJob(null)}>
          <div 
            className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Printer className="h-5 w-5 text-primary-600" />
                <h3 className="text-lg font-semibold text-gray-900">Print Job Details</h3>
              </div>
              <button
                onClick={() => setSelectedJob(null)}
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
                    <td className="py-2 text-gray-900 break-all">{selectedJob.jobName}</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-gray-500 font-medium pr-4">File Name</td>
                    <td className="py-2 text-gray-900 break-all">{selectedJob.fileName}</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-gray-500 font-medium pr-4">Status</td>
                    <td className="py-2">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedJob.statusCode)}`}>
                        {getStatusIcon(selectedJob.statusCode)}
                        {selectedJob.status}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-gray-500 font-medium pr-4">Printer</td>
                    <td className="py-2 text-gray-900">{selectedJob.printer}</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-gray-500 font-medium pr-4">Media</td>
                    <td className="py-2 text-gray-900">{selectedJob.printMedia || '-'}</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-gray-500 font-medium pr-4">Copies</td>
                    <td className="py-2 text-gray-900">{selectedJob.numCopies}</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-gray-500 font-medium pr-4">Size</td>
                    <td className="py-2 text-gray-900">{selectedJob.jobSize || '-'}</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-gray-500 font-medium pr-4">Ink Coverage</td>
                    <td className="py-2 text-gray-900">{selectedJob.inkCoverage ? `${selectedJob.inkCoverage}%` : '-'}</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-gray-500 font-medium pr-4">Ink Total</td>
                    <td className="py-2 text-gray-900">{selectedJob.inkTotal || '-'}</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-gray-500 font-medium pr-4">Created</td>
                    <td className="py-2 text-gray-900">
                      {selectedJob.createDate && selectedJob.createTime 
                        ? formatDateTime(`${selectedJob.createDate} ${selectedJob.createTime}`)
                        : `${selectedJob.createDate} ${selectedJob.createTime}`}
                    </td>
                  </tr>
                  {selectedJob.customerName && (
                    <tr>
                      <td className="py-2 text-gray-500 font-medium pr-4">Customer</td>
                      <td className="py-2 text-gray-900">{selectedJob.customerName}</td>
                    </tr>
                  )}
                  {selectedJob.jobDescription && (
                    <tr>
                      <td className="py-2 text-gray-500 font-medium pr-4">Description</td>
                      <td className="py-2 text-gray-900">{selectedJob.jobDescription}</td>
                    </tr>
                  )}
                  <tr>
                    <td className="py-2 text-gray-500 font-medium pr-4">Job GUID</td>
                    <td className="py-2 text-gray-500 text-xs font-mono">{selectedJob.jobGuid}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showLinkModal && <LinkJobModal />}
    </div>
  );

  function LinkJobModal() {
    const availablePrintJobs: PrintJob[] = unlinkedData?.printJobs || [];
    const availableFieryJobs: FieryJobData[] = unlinkedData?.fieryJobs || [];
    
    const filteredPrint = searchQuery
      ? filterBySearchFields(
          availablePrintJobs,
          searchQuery,
          (job) => [job.jobName, job.fileName, job.printer],
        )
      : availablePrintJobs;
    
    const filteredFiery = searchQuery
      ? filterBySearchFields(
          availableFieryJobs,
          searchQuery,
          (job) => [job.jobName, job.fileName],
        )
      : availableFieryJobs;
    
    const totalFiltered = filteredPrint.length + filteredFiery.length;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => { setShowLinkModal(false); setSearchQuery(''); }}>
        <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <Link className="h-5 w-5 text-primary-600" />
              <h3 className="text-lg font-semibold text-gray-900">Link Print Job</h3>
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
                placeholder="Search by job name, file name, or printer..."
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                autoFocus
              />
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4">
            {loadingUnlinked ? (
              <div className="flex items-center justify-center py-8 text-gray-400">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Loading available print jobs...
              </div>
            ) : totalFiltered === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Printer className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">{searchQuery ? 'No matching jobs found' : 'No unlinked print jobs available'}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredPrint.map((job) => (
                  <button
                    key={job.jobGuid}
                    onClick={() => linkMutation.mutate({ jobGuid: job.jobGuid, jobName: job.jobName })}
                    disabled={linkMutation.isPending}
                    className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-all"
                  >
                    <p className="text-sm font-medium text-gray-900 truncate">{job.jobName}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-500">
                      <span className="px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded text-[10px] font-medium">Thrive</span>
                      {job.printer && <span className="flex items-center gap-1"><Printer className="h-3 w-3" />{job.printer}</span>}
                      {job.status && <span>{job.status}</span>}
                      {job.printMedia && <span>{job.printMedia}</span>}
                    </div>
                  </button>
                ))}
                {filteredFiery.map((fj) => (
                  <button
                    key={fj.jobId}
                    onClick={() => linkMutation.mutate({ jobGuid: fj.jobId, jobName: fj.jobName, jobType: 'FIERY_JOB' })}
                    disabled={linkMutation.isPending}
                    className="w-full text-left p-3 rounded-lg border border-orange-200 hover:border-orange-300 hover:bg-orange-50 transition-all"
                  >
                    <p className="text-sm font-medium text-gray-900 truncate">{fj.jobName}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-500">
                      <span className="px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded text-[10px] font-medium">Fiery RIP</span>
                      {fj.hasZccCutFile && <span className="text-green-600">Has cut file</span>}
                    {(fj.media?.vutekMedia || fj.media?.description) && (
                      <span>{fj.media.vutekMedia || fj.media.description}</span>
                    )}
                      {fj.timestamp && <span>{formatDateTime(fj.timestamp)}</span>}
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
