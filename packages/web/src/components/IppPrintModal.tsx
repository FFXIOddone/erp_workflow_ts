import React, { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  Printer,
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Copy,
  Trash2,
  Info,
} from 'lucide-react';
import { api } from '../lib/api';
import { Spinner } from './Spinner';
import toast from 'react-hot-toast';

interface IppPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  equipmentId: string;
  equipmentName: string;
  ipAddress: string;
}

const ACCEPTED_EXTENSIONS = '.pdf,.jpg,.jpeg,.png,.tif,.tiff,.ps,.eps';
const ACCEPTED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/tiff',
  'application/postscript',
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const PRINTER_STATE_LABELS: Record<number, { label: string; color: string }> = {
  3: { label: 'Idle', color: 'text-green-600 bg-green-50' },
  4: { label: 'Processing', color: 'text-blue-600 bg-blue-50' },
  5: { label: 'Stopped', color: 'text-red-600 bg-red-50' },
};

const JOB_STATE_LABELS: Record<number, { label: string; color: string }> = {
  3: { label: 'Pending', color: 'bg-amber-100 text-amber-700' },
  4: { label: 'Held', color: 'bg-orange-100 text-orange-700' },
  5: { label: 'Processing', color: 'bg-blue-100 text-blue-700' },
  6: { label: 'Stopped', color: 'bg-red-100 text-red-700' },
  7: { label: 'Canceled', color: 'bg-gray-100 text-gray-600' },
  8: { label: 'Aborted', color: 'bg-red-100 text-red-700' },
  9: { label: 'Completed', color: 'bg-green-100 text-green-700' },
};

export function IppPrintModal({ isOpen, onClose, equipmentId, equipmentName, ipAddress }: IppPrintModalProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [copies, setCopies] = useState(1);
  const [jobName, setJobName] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  // Fetch printer capabilities
  const { data: printerInfo, isLoading: infoLoading } = useQuery({
    queryKey: ['ipp-printer-info', equipmentId, ipAddress],
    queryFn: async () => {
      const res = await api.get(`/equipment/${equipmentId}/ipp-printer-info`, {
        params: { targetIp: ipAddress },
      });
      return res.data.data;
    },
    enabled: isOpen,
    staleTime: 30000,
  });

  // Fetch current jobs
  const { data: jobsData, isLoading: jobsLoading, refetch: refetchJobs } = useQuery({
    queryKey: ['ipp-jobs', equipmentId, ipAddress],
    queryFn: async () => {
      const res = await api.get(`/equipment/${equipmentId}/ipp-jobs`, {
        params: { targetIp: ipAddress },
      });
      return res.data.data;
    },
    enabled: isOpen,
    refetchInterval: isOpen ? 5000 : false,
  });

  // Submit print job
  const printMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error('No file selected');

      const formData = new FormData();
      formData.append('file', selectedFile);

      const params: any = { targetIp: ipAddress, copies };
      if (jobName.trim()) params.jobName = jobName.trim();

      const res = await api.post(`/equipment/${equipmentId}/ipp-print`, formData, {
        params,
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000, // 2 min timeout for large files
      });
      return res.data.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Print job submitted!');
      setSelectedFile(null);
      setCopies(1);
      setJobName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      queryClient.invalidateQueries({ queryKey: ['ipp-jobs', equipmentId] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || err.message || 'Failed to submit print job');
    },
  });

  // File selection
  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file);
    if (!jobName) setJobName(file.name);
  }, [jobName]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  if (!isOpen) return null;

  const printerState = printerInfo?.printerState;
  const stateInfo = printerState ? PRINTER_STATE_LABELS[printerState] : null;
  const supportedFormats = printerInfo?.documentFormats || [];
  const queuedCount = printerInfo?.queued ?? jobsData?.total ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Printer className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">IPP Print — {equipmentName}</h2>
              <p className="text-xs text-gray-500">
                ipp://{ipAddress}:631 · Send files directly to printer
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Printer Info */}
          {infoLoading ? (
            <div className="flex items-center justify-center py-6">
              <Spinner /> <span className="ml-2 text-gray-500">Querying printer capabilities...</span>
            </div>
          ) : printerInfo?.available === false ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-2 text-amber-700">
                <AlertTriangle className="h-5 w-5" />
                <span className="font-medium">IPP service unreachable</span>
              </div>
              <p className="text-sm text-amber-600 mt-1">{printerInfo.error}</p>
              <p className="text-xs text-amber-500 mt-2">
                The device has port 631 open but the IPP service may not be fully configured.
                You can still attempt to submit a print job.
              </p>
            </div>
          ) : printerInfo ? (
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">Printer</span>
                  <p className="font-medium text-gray-900">{printerInfo.printerMakeModel || printerInfo.printerName}</p>
                </div>
                <div>
                  <span className="text-gray-500">Status</span>
                  <p>
                    {stateInfo ? (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${stateInfo.color}`}>
                        {stateInfo.label}
                      </span>
                    ) : (
                      <span className="text-gray-600">Unknown</span>
                    )}
                    {printerInfo.printerStateReasons && printerInfo.printerStateReasons !== 'none' && (
                      <span className="ml-2 text-xs text-gray-400">
                        ({Array.isArray(printerInfo.printerStateReasons)
                          ? printerInfo.printerStateReasons.join(', ')
                          : printerInfo.printerStateReasons})
                      </span>
                    )}
                  </p>
                </div>
                {printerInfo.queued !== null && printerInfo.queued !== undefined && (
                  <div>
                    <span className="text-gray-500">Queued Jobs</span>
                    <p className="font-medium">{printerInfo.queued}</p>
                  </div>
                )}
                {supportedFormats.length > 0 && (
                  <div className="col-span-2">
                    <span className="text-gray-500">Accepted Formats</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {supportedFormats.slice(0, 12).map((fmt: string) => (
                        <span key={fmt} className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-xs text-gray-600">
                          {fmt.replace('application/', '').replace('image/', '')}
                        </span>
                      ))}
                      {supportedFormats.length > 12 && (
                        <span className="px-1.5 py-0.5 text-xs text-gray-400">+{supportedFormats.length - 12} more</span>
                      )}
                    </div>
                  </div>
                )}
                {printerInfo.mediaReady && (
                  <div className="col-span-2">
                    <span className="text-gray-500">Loaded Media</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(Array.isArray(printerInfo.mediaReady) ? printerInfo.mediaReady : [printerInfo.mediaReady]).map((m: string) => (
                        <span key={m} className="px-1.5 py-0.5 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {/* File Upload Zone */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <Upload className="h-4 w-4 text-blue-500" />
              Select File to Print
            </h3>

            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-blue-400 bg-blue-50'
                  : selectedFile
                    ? 'border-green-300 bg-green-50'
                    : 'border-gray-300 bg-gray-50 hover:border-blue-300 hover:bg-blue-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_EXTENSIONS}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                }}
              />

              {selectedFile ? (
                <div className="flex items-center justify-center gap-3">
                  <FileText className="h-8 w-8 text-green-500" />
                  <div className="text-left">
                    <p className="font-medium text-gray-900">{selectedFile.name}</p>
                    <p className="text-xs text-gray-500">{formatBytes(selectedFile.size)} · {selectedFile.type || 'unknown type'}</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                      setJobName('');
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div>
                  <Upload className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-600 font-medium">
                    Drop file here or click to browse
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    PDF, JPEG, PNG, TIFF, PostScript — up to 500 MB
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Job Settings */}
          {selectedFile && (
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Print Settings</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Job Name</label>
                  <input
                    type="text"
                    value={jobName}
                    onChange={(e) => setJobName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
                    placeholder={selectedFile.name}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
                    <Copy className="h-3 w-3" /> Copies
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={copies}
                    onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Print Queue */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Info className="h-4 w-4 text-gray-400" />
                Print Queue {queuedCount > 0 && <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full">{queuedCount}</span>}
              </h3>
              <button
                onClick={() => refetchJobs()}
                className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
                title="Refresh queue"
              >
                <RefreshCw className={`h-4 w-4 ${jobsLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {jobsLoading && !jobsData ? (
              <div className="text-center py-4 text-gray-400 text-sm">Loading queue...</div>
            ) : jobsData?.jobs?.length > 0 ? (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="text-left px-3 py-2">Job</th>
                      <th className="text-left px-3 py-2">Name</th>
                      <th className="text-left px-3 py-2">State</th>
                      <th className="text-left px-3 py-2">User</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {jobsData.jobs.map((job: any) => {
                      const stateLabel = JOB_STATE_LABELS[job.state] || { label: `State ${job.state}`, color: 'bg-gray-100 text-gray-600' };
                      return (
                        <tr key={job.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-mono text-gray-600">#{job.id}</td>
                          <td className="px-3 py-2 text-gray-900">{job.name || '—'}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${stateLabel.color}`}>
                              {stateLabel.label}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-gray-500">{job.user || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-4 text-gray-400 text-sm border border-dashed border-gray-200 rounded-lg">
                No active print jobs
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <div className="text-xs text-gray-400 flex items-center gap-1">
            <Printer className="h-3 w-3" />
            IPP/CUPS · Sends directly to printer — bypasses RIP
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => printMutation.mutate()}
              disabled={!selectedFile || printMutation.isPending}
              className={`px-5 py-2 text-sm font-bold text-white rounded-lg transition-colors flex items-center gap-2 ${
                selectedFile && !printMutation.isPending
                  ? 'bg-blue-600 hover:bg-blue-700 shadow-sm'
                  : 'bg-gray-300 cursor-not-allowed'
              }`}
            >
              {printMutation.isPending ? (
                <>
                  <Spinner /> Sending...
                </>
              ) : (
                <>
                  <Printer className="h-4 w-4" />
                  Print {copies > 1 ? `(${copies} copies)` : ''}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
