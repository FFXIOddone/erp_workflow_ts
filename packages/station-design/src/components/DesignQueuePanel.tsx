import { useState } from 'react';
import { 
  FileImage, 
  FolderOpen, 
  Eye, 
  Send,
  CheckCircle,
  Clock,
  MessageSquare,
  Download,
  Upload,
  Search,
  Filter
} from 'lucide-react';
import { invoke } from '../lib/tauri-bridge';
import toast from 'react-hot-toast';

interface DesignJob {
  id: string;
  orderNumber: string;
  customerName: string;
  description: string;
  status: 'new' | 'in_design' | 'awaiting_approval' | 'approved' | 'revision_needed';
  dueDate: string;
  proofCount: number;
  lastActivity: string;
  assignedTo?: string;
}

// Mock data
const mockJobs: DesignJob[] = [
  {
    id: '1',
    orderNumber: 'WO-2026-0156',
    customerName: 'Aldea Coffee',
    description: 'Menu boards - 3 sizes, interior wall mount',
    status: 'in_design',
    dueDate: '2026-02-08',
    proofCount: 1,
    lastActivity: '10 min ago',
    assignedTo: 'Sarah',
  },
  {
    id: '2',
    orderNumber: 'WO-2026-0155',
    customerName: 'Metro Fitness',
    description: 'Window graphics - full wrap, frosted vinyl',
    status: 'awaiting_approval',
    dueDate: '2026-02-07',
    proofCount: 2,
    lastActivity: '2 hours ago',
  },
  {
    id: '3',
    orderNumber: 'WO-2026-0152',
    customerName: 'Green Leaf Restaurant',
    description: 'Outdoor banner - 3x8 double-sided',
    status: 'revision_needed',
    dueDate: '2026-02-09',
    proofCount: 3,
    lastActivity: '1 day ago',
  },
  {
    id: '4',
    orderNumber: 'WO-2026-0148',
    customerName: 'Downtown Diner',
    description: 'Vehicle wrap - full design, Ford Transit',
    status: 'new',
    dueDate: '2026-02-15',
    proofCount: 0,
    lastActivity: 'Just now',
  },
];

const statusColors = {
  new: 'bg-blue-100 text-blue-700 border-blue-200',
  in_design: 'bg-purple-100 text-purple-700 border-purple-200',
  awaiting_approval: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  approved: 'bg-green-100 text-green-700 border-green-200',
  revision_needed: 'bg-red-100 text-red-700 border-red-200',
};

const statusLabels = {
  new: 'New',
  in_design: 'In Design',
  awaiting_approval: 'Awaiting Approval',
  approved: 'Approved',
  revision_needed: 'Revision Needed',
};

export function DesignQueuePanel() {
  const [jobs, setJobs] = useState<DesignJob[]>(mockJobs);
  const [selectedJob, setSelectedJob] = useState<DesignJob | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  const handleOpenFolder = async (orderNumber: string) => {
    try {
      // In real app, would look up the actual folder path
      const path = `\\\\server\\jobs\\${orderNumber}`;
      await invoke('open_folder', { path });
    } catch (error) {
      toast.error('Failed to open folder');
    }
  };

  const handleSendProof = (job: DesignJob) => {
    toast.success(`Proof email sent to ${job.customerName}`);
    setJobs(prev => prev.map(j => 
      j.id === job.id ? { ...j, status: 'awaiting_approval' as const, proofCount: j.proofCount + 1 } : j
    ));
    setSelectedJob(prev => prev?.id === job.id ? { ...job, status: 'awaiting_approval' as const, proofCount: job.proofCount + 1 } : prev);
  };

  const handleMarkApproved = (job: DesignJob) => {
    toast.success(`${job.orderNumber} marked as approved!`);
    setJobs(prev => prev.map(j => 
      j.id === job.id ? { ...j, status: 'approved' as const } : j
    ));
    setSelectedJob(prev => prev?.id === job.id ? { ...job, status: 'approved' as const } : prev);
  };

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = !searchQuery || 
      job.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = !filterStatus || job.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const activeJobs = filteredJobs.filter(j => j.status !== 'approved');
  const completedJobs = filteredJobs.filter(j => j.status === 'approved');

  return (
    <div className="flex h-full">
      {/* Job List */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Search & Filter Bar */}
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search orders, customers..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <select
              value={filterStatus || ''}
              onChange={(e) => setFilterStatus(e.target.value || null)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="">All Status</option>
              <option value="new">New</option>
              <option value="in_design">In Design</option>
              <option value="awaiting_approval">Awaiting Approval</option>
              <option value="revision_needed">Revision Needed</option>
              <option value="approved">Approved</option>
            </select>
          </div>
        </div>

        {/* Job Queue */}
        <div className="flex-1 overflow-auto p-4">
          <h3 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
            <FileImage className="w-4 h-4" />
            Active Jobs ({activeJobs.length})
          </h3>
          
          <div className="space-y-2">
            {activeJobs.map((job) => (
              <div
                key={job.id}
                className={`bg-white rounded-lg border p-4 cursor-pointer transition-all ${
                  selectedJob?.id === job.id 
                    ? 'border-purple-500 ring-2 ring-purple-200' 
                    : 'border-gray-200 hover:border-purple-300'
                }`}
                onClick={() => setSelectedJob(job)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900">{job.orderNumber}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusColors[job.status]}`}>
                        {statusLabels[job.status]}
                      </span>
                    </div>
                    <p className="text-gray-600 font-medium">{job.customerName}</p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="text-gray-500">Due: {new Date(job.dueDate).toLocaleDateString()}</p>
                    <p className="text-gray-400 text-xs">{job.lastActivity}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-500">{job.description}</p>
                
                {job.proofCount > 0 && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-gray-400">
                    <Eye className="w-3 h-3" />
                    {job.proofCount} proof{job.proofCount > 1 ? 's' : ''} sent
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Completed Section */}
          {completedJobs.length > 0 && (
            <>
              <h3 className="font-medium text-gray-700 mt-6 mb-3 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Approved ({completedJobs.length})
              </h3>
              <div className="space-y-2">
                {completedJobs.map((job) => (
                  <div
                    key={job.id}
                    className="bg-green-50 rounded-lg border border-green-200 p-4 opacity-75"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-gray-900">{job.orderNumber}</span>
                        <span className="text-gray-500 ml-2">{job.customerName}</span>
                      </div>
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Selected Job Detail */}
      {selectedJob && (
        <div className="w-96 bg-white border-l border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-lg">{selectedJob.orderNumber}</h3>
              <span className={`px-2 py-1 rounded-full text-xs font-medium border ${statusColors[selectedJob.status]}`}>
                {statusLabels[selectedJob.status]}
              </span>
            </div>
            <p className="text-gray-600 font-medium">{selectedJob.customerName}</p>
          </div>
          
          <div className="flex-1 overflow-auto p-4 space-y-4">
            <div>
              <label className="text-xs text-gray-500 uppercase">Description</label>
              <p className="text-sm">{selectedJob.description}</p>
            </div>
            
            <div>
              <label className="text-xs text-gray-500 uppercase">Due Date</label>
              <p className="font-medium">{new Date(selectedJob.dueDate).toLocaleDateString()}</p>
            </div>
            
            <div>
              <label className="text-xs text-gray-500 uppercase">Proofs Sent</label>
              <p className="font-medium">{selectedJob.proofCount}</p>
            </div>
            
            {selectedJob.assignedTo && (
              <div>
                <label className="text-xs text-gray-500 uppercase">Assigned To</label>
                <p className="font-medium">{selectedJob.assignedTo}</p>
              </div>
            )}
          </div>
          
          <div className="p-4 border-t border-gray-200 space-y-2">
            <button
              onClick={() => handleOpenFolder(selectedJob.orderNumber)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium"
            >
              <FolderOpen className="w-4 h-4" />
              Open Job Folder
            </button>
            
            {selectedJob.status !== 'approved' && (
              <button
                onClick={() => handleSendProof(selectedJob)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
              >
                <Send className="w-4 h-4" />
                Send Proof to Customer
              </button>
            )}
            
            {selectedJob.status === 'awaiting_approval' && (
              <button
                onClick={() => handleMarkApproved(selectedJob)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium"
              >
                <CheckCircle className="w-4 h-4" />
                Mark as Approved
              </button>
            )}
            
            <button
              className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg"
            >
              <MessageSquare className="w-4 h-4" />
              Add Note
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
