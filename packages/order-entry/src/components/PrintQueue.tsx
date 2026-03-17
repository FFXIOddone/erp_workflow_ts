import { useState } from 'react';
import { 
  Send, 
  FolderOpen, 
  MoreVertical,
  Clock,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Printer,
  GripVertical
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import toast from 'react-hot-toast';
import { useConfigStore } from '../stores/config';

interface PrintJob {
  id: string;
  orderNumber: string;
  customerName: string;
  description: string;
  filePath: string;
  status: 'pending' | 'ready' | 'printing' | 'complete';
  priority: 'low' | 'normal' | 'high' | 'rush';
  dueDate?: string;
  sqft?: number;
}

interface PrintQueueProps {
  onSendToHotfolder: (filePath: string, hotfolderPath: string) => void;
  onOpenFolder: (path: string) => void;
}

// Mock data - will be replaced with API calls
const mockJobs: PrintJob[] = [
  {
    id: '1',
    orderNumber: 'WO-12345',
    customerName: 'ABC Corporation',
    description: 'Banner 4x8 with grommets',
    filePath: '\\\\wildesigns-fs1\\Company Files\\ABC Corp\\WO12345\\print-file.pdf',
    status: 'ready',
    priority: 'high',
    dueDate: '2026-02-07',
    sqft: 32,
  },
  {
    id: '2',
    orderNumber: 'WO-12346',
    customerName: 'XYZ Inc',
    description: 'Vehicle wrap - Ford Transit',
    filePath: '\\\\wildesigns-fs1\\Company Files\\XYZ\\WO12346\\wrap.pdf',
    status: 'pending',
    priority: 'normal',
    dueDate: '2026-02-08',
    sqft: 145,
  },
  {
    id: '3',
    orderNumber: 'WO-12347',
    customerName: 'Quick Signs Co',
    description: 'Window graphics set (3)',
    filePath: '\\\\wildesigns-fs1\\Company Files\\Quick Signs\\WO12347\\windows.ai',
    status: 'ready',
    priority: 'rush',
    dueDate: '2026-02-06',
    sqft: 24,
  },
];

export function PrintQueue({ onSendToHotfolder, onOpenFolder }: PrintQueueProps) {
  const { config } = useConfigStore();
  const [jobs] = useState<PrintJob[]>(mockJobs);
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [draggedJob, setDraggedJob] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, job: PrintJob) => {
    setDraggedJob(job.id);
    e.dataTransfer.setData('application/json', JSON.stringify({
      filePath: job.filePath,
      orderNumber: job.orderNumber,
    }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDragEnd = () => {
    setDraggedJob(null);
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedJobs);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedJobs(newSelected);
  };

  const handleOpenFile = async (path: string) => {
    try {
      await invoke('open_file', { path });
    } catch (error) {
      toast.error('Failed to open file');
    }
  };

  const getPriorityColor = (priority: PrintJob['priority']) => {
    switch (priority) {
      case 'rush': return 'bg-red-100 text-red-700 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'normal': return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'low': return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  const getStatusIcon = (status: PrintJob['status']) => {
    switch (status) {
      case 'complete': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'printing': return <Printer className="w-4 h-4 text-blue-500 animate-pulse" />;
      case 'ready': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'pending': return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="h-full flex flex-col bg-white rounded-xl shadow-soft border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Print Queue</h2>
          <p className="text-sm text-gray-500">{jobs.length} jobs ready to print</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedJobs.size > 0 && config.defaultHotfolder && (
            <button
              onClick={() => {
                // Send selected to default hotfolder
                const hotfolder = config.hotfolders.find(h => h.name === config.defaultHotfolder);
                if (hotfolder) {
                  selectedJobs.forEach(id => {
                    const job = jobs.find(j => j.id === id);
                    if (job) {
                      onSendToHotfolder(job.filePath, hotfolder.path);
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

      {/* Queue List */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full">
          <thead className="bg-gray-50 sticky top-0">
            <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <th className="w-8 px-4 py-3"></th>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Due</th>
              <th className="px-4 py-3 text-right">Sq Ft</th>
              <th className="px-4 py-3 w-24"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {jobs.map((job) => (
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
                    <span className="font-mono font-medium text-gray-900">{job.orderNumber}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-700">{job.customerName}</td>
                <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{job.description}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getPriorityColor(job.priority)}`}>
                    {job.priority.toUpperCase()}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {job.dueDate ? new Date(job.dueDate).toLocaleDateString() : '-'}
                </td>
                <td className="px-4 py-3 text-right font-medium">{job.sqft || '-'}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100">
                    <button
                      onClick={() => handleOpenFile(job.filePath)}
                      className="p-1.5 text-gray-500 hover:bg-gray-200 rounded"
                      title="Open file"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        const folder = job.filePath.split('\\').slice(0, -1).join('\\');
                        onOpenFolder(folder);
                      }}
                      className="p-1.5 text-gray-500 hover:bg-gray-200 rounded"
                      title="Open folder"
                    >
                      <FolderOpen className="w-4 h-4" />
                    </button>
                    {config.defaultHotfolder && (
                      <button
                        onClick={() => {
                          const hotfolder = config.hotfolders.find(h => h.name === config.defaultHotfolder);
                          if (hotfolder) {
                            onSendToHotfolder(job.filePath, hotfolder.path);
                          }
                        }}
                        className="p-1.5 text-primary-600 hover:bg-primary-100 rounded"
                        title="Send to RIP"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Drag hint */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-500 text-center">
        Drag jobs to hotfolder panel to send to RIP
      </div>
    </div>
  );
}
