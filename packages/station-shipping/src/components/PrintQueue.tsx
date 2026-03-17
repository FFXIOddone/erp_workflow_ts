import { useState, useEffect, useCallback } from 'react';
import { 
  Send, 
  FolderOpen, 
  Clock,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Printer,
  GripVertical,
  RefreshCw,
  Play,
  Droplets,
  Pause,
} from 'lucide-react';
import { invoke } from '../lib/tauri-bridge';
import toast from 'react-hot-toast';
import { useConfigStore } from '../stores/config';
import { useAuthStore } from '../stores/auth';

interface PrintJob {
  id: string;
  jobNumber: string;
  name: string;
  status: string;
  priority: number;
  materialType?: string;
  estimatedMinutes?: number;
  startedAt?: string;
  completedAt?: string;
  operatorNotes?: string;
  workOrder: {
    id: string;
    orderNumber: string;
    customerName: string;
    description?: string;
  };
  assignedTo?: { displayName: string };
  queue: { id: string; name: string; station: string };
}

interface PrintQueueProps {
  onSendToHotfolder: (filePath: string, hotfolderPath: string) => void;
  onOpenFolder: (path: string) => void;
}

const PRIORITY_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'RUSH', color: 'bg-red-100 text-red-700 border-red-200' },
  2: { label: 'HIGH', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  3: { label: 'NORMAL', color: 'bg-gray-100 text-gray-700 border-gray-200' },
  4: { label: 'LOW', color: 'bg-blue-100 text-blue-700 border-blue-200' },
};

const STATION_LABELS: Record<string, string> = {
  ROLL_TO_ROLL: 'Roll-to-Roll',
  FLATBED: 'Flatbed',
  SCREEN_PRINT: 'Screen Print',
};

export function PrintQueue({ onSendToHotfolder, onOpenFolder }: PrintQueueProps) {
  const { config } = useConfigStore();
  const { token, user } = useAuthStore();
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [draggedJob, setDraggedJob] = useState<string | null>(null);
  const [activeStation, setActiveStation] = useState<string | null>(null);

  // Get user's print-related stations
  const userStations = (user?.allowedStations || []).filter(
    (s) => ['ROLL_TO_ROLL', 'FLATBED', 'SCREEN_PRINT'].includes(s)
  );
  const stationsToShow = userStations.length > 0
    ? userStations
    : ['FLATBED', 'ROLL_TO_ROLL'];

  const stationParam = activeStation || stationsToShow.join(',');

  const fetchJobs = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${config.apiUrl}/print-queue/jobs?status=PENDING,READY,PREPARING,PRINTING,DRYING&station=${stationParam}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const json = await res.json();
      setJobs(json.data || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch print jobs');
    } finally {
      setLoading(false);
    }
  }, [config.apiUrl, token, stationParam]);

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 10000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  const updateJobStatus = async (jobId: string, status: string) => {
    try {
      await fetch(`${config.apiUrl}/print-queue/jobs/${jobId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      toast.success(`Job ${status.toLowerCase()}`);
      fetchJobs();
    } catch (err) {
      toast.error('Failed to update job status');
    }
  };

  const handleDragStart = (e: React.DragEvent, job: PrintJob) => {
    setDraggedJob(job.id);
    e.dataTransfer.setData('application/json', JSON.stringify({
      filePath: '', // Jobs don't have file paths from the API
      orderNumber: job.workOrder.orderNumber,
    }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDragEnd = () => {
    setDraggedJob(null);
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedJobs);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedJobs(newSelected);
  };

  const handleOpenFile = async (path: string) => {
    try {
      await invoke('open_file', { path });
    } catch {
      toast.error('Failed to open file');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'PRINTING': return <Printer className="w-4 h-4 text-purple-500 animate-pulse" />;
      case 'DRYING': return <Droplets className="w-4 h-4 text-amber-500" />;
      case 'READY': return <Play className="w-4 h-4 text-blue-500" />;
      case 'PREPARING': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'ON_HOLD': return <Pause className="w-4 h-4 text-orange-500" />;
      case 'PENDING': return <AlertCircle className="w-4 h-4 text-gray-400" />;
      default: return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      PENDING: 'Pending', PREPARING: 'Preparing', READY: 'Ready',
      PRINTING: 'Printing', DRYING: 'Drying', COMPLETED: 'Complete',
      ON_HOLD: 'On Hold', FAILED: 'Failed', CANCELLED: 'Cancelled',
    };
    return map[status] || status;
  };

  if (loading && jobs.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-white rounded-xl shadow-soft border border-gray-100">
        <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white rounded-xl shadow-soft border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Print Queue</h2>
            <p className="text-sm text-gray-500">{jobs.length} active jobs{activeStation ? ` — ${STATION_LABELS[activeStation] || activeStation}` : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchJobs} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg" title="Refresh">
              <RefreshCw className="w-4 h-4" />
            </button>
          {selectedJobs.size > 0 && config.defaultHotfolder && (
            <button
              onClick={() => {
                const hotfolder = config.hotfolders.find(h => h.name === config.defaultHotfolder);
                if (hotfolder) {
                  selectedJobs.forEach(id => {
                    const job = jobs.find(j => j.id === id);
                    if (job) {
                      // For now, use operatorNotes as file path hint or empty
                      onSendToHotfolder(job.operatorNotes || '', hotfolder.path);
                    }
                  });
                  setSelectedJobs(new Set());
                }
              }}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              Send {selectedJobs.size} to RIP
            </button>
          )}
          </div>
        </div>
        {/* Station Filter Tabs */}
        {stationsToShow.length > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveStation(null)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                activeStation === null
                  ? 'bg-primary-100 text-primary-700 border border-primary-200'
                  : 'text-gray-600 hover:bg-gray-100 border border-transparent'
              }`}
            >
              All Queues
            </button>
            {stationsToShow.map((station) => (
              <button
                key={station}
                onClick={() => setActiveStation(station)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  activeStation === station
                    ? 'bg-primary-100 text-primary-700 border border-primary-200'
                    : 'text-gray-600 hover:bg-gray-100 border border-transparent'
                }`}
              >
                {STATION_LABELS[station] || station}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="px-4 py-2 bg-red-50 text-red-600 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Queue List */}
      <div className="flex-1 overflow-y-auto">
        {jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Printer className="w-10 h-10 text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No Active Jobs</p>
            <p className="text-sm text-gray-400">Create print jobs from the ERP work orders</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="w-8 px-4 py-3"></th>
                <th className="px-4 py-3">Job / Order</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Queue</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Material</th>
                <th className="px-4 py-3 w-32">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {jobs.map((job) => {
                const pri = PRIORITY_LABELS[job.priority] || PRIORITY_LABELS[3];
                return (
                  <tr
                    key={job.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, job)}
                    onDragEnd={handleDragEnd}
                    className={`group hover:bg-gray-50 cursor-grab active:cursor-grabbing ${
                      draggedJob === job.id ? 'opacity-50' : ''
                    } ${selectedJobs.has(job.id) ? 'bg-primary-50' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <GripVertical className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100" />
                        <input
                          type="checkbox"
                          checked={selectedJobs.has(job.id)}
                          onChange={() => toggleSelect(job.id)}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(job.status)}
                        <div>
                          <span className="font-mono font-medium text-gray-900 block">{job.jobNumber}</span>
                          <span className="text-xs text-gray-500">WO #{job.workOrder.orderNumber}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{job.workOrder.customerName}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                        {STATION_LABELS[job.queue.station] || job.queue.name}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${
                        job.status === 'PRINTING' ? 'text-purple-600' :
                        job.status === 'DRYING' ? 'text-amber-600' :
                        job.status === 'READY' ? 'text-blue-600' :
                        job.status === 'COMPLETED' ? 'text-green-600' :
                        'text-gray-600'
                      }`}>
                        {getStatusLabel(job.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full border ${pri.color}`}>
                        {pri.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{job.materialType || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {job.status === 'PENDING' && (
                          <button onClick={() => updateJobStatus(job.id, 'READY')}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Mark Ready">
                            <Play className="w-4 h-4" />
                          </button>
                        )}
                        {job.status === 'READY' && (
                          <button onClick={() => updateJobStatus(job.id, 'PRINTING')}
                            className="p-1.5 text-purple-600 hover:bg-purple-50 rounded" title="Start Printing">
                            <Printer className="w-4 h-4" />
                          </button>
                        )}
                        {job.status === 'PRINTING' && (
                          <>
                            <button onClick={() => updateJobStatus(job.id, 'DRYING')}
                              className="p-1.5 text-amber-600 hover:bg-amber-50 rounded" title="Move to Drying">
                              <Droplets className="w-4 h-4" />
                            </button>
                            <button onClick={() => updateJobStatus(job.id, 'COMPLETED')}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Complete">
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {job.status === 'DRYING' && (
                          <button onClick={() => updateJobStatus(job.id, 'COMPLETED')}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Complete">
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        {job.status === 'ON_HOLD' && (
                          <button onClick={() => updateJobStatus(job.id, 'READY')}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Resume">
                            <Play className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-500 text-center">
        Drag jobs to hotfolder panel to send to RIP · Auto-refreshes every 10s
      </div>
    </div>
  );
}
