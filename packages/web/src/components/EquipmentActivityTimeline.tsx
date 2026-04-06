import { useQuery } from '@tanstack/react-query';
import { Printer, Scissors, Clock, CheckCircle, Loader2, AlertCircle, History, Mail, FileText } from 'lucide-react';
import { api } from '../lib/api';
import { formatRelativeTime } from '../lib/date';
import { resolveActivityTimelinePresentation } from './activityTimelinePresentation';

interface EquipmentActivityProps {
  orderNumber: string;
  orderEvents?: Array<{
    id: string;
    eventType: string;
    description: string;
    createdAt: string;
    user: { displayName: string };
    details?: Record<string, unknown>;
  }>;
}

interface EquipmentActivityItem {
  id: string;
  type:
    | 'PRINT_QUEUED'
    | 'PRINT_PROCESSING'
    | 'PRINT_READY'
    | 'PRINT_PRINTING'
    | 'PRINT_COMPLETED'
    | 'PRINTED'
    | 'IN_RIP_QUEUE'
    | 'CUT_QUEUED'
    | 'CUT_COMPLETED'
    | 'EMAIL_SENT'
    | 'FILE_CREATED'
    | 'PROOFED'
    | 'APPROVED'
    | 'FINISHING_DONE'
    | 'QC_DONE'
    | 'INSTALLED';
  description: string;
  timestamp: string;
  source: 'thrive' | 'zund' | 'email' | 'network';
  details?: Record<string, unknown>;
}

const TYPE_CONFIG: Record<string, { icon: typeof Printer; color: string; bgColor: string }> = {
  IN_RIP_QUEUE: { icon: Clock, color: 'text-sky-500', bgColor: 'bg-sky-100' },
  PRINT_QUEUED: { icon: Clock, color: 'text-gray-500', bgColor: 'bg-gray-100' },
  PRINT_PROCESSING: { icon: Loader2, color: 'text-blue-500', bgColor: 'bg-blue-100' },
  PRINT_READY: { icon: Printer, color: 'text-cyan-500', bgColor: 'bg-cyan-100' },
  PRINT_PRINTING: { icon: Printer, color: 'text-purple-500', bgColor: 'bg-purple-100' },
  PRINT_COMPLETED: { icon: CheckCircle, color: 'text-green-500', bgColor: 'bg-green-100' },
  PRINTED: { icon: CheckCircle, color: 'text-green-500', bgColor: 'bg-green-100' },
  CUT_QUEUED: { icon: Scissors, color: 'text-orange-500', bgColor: 'bg-orange-100' },
  CUT_COMPLETED: { icon: CheckCircle, color: 'text-green-500', bgColor: 'bg-green-100' },
  EMAIL_SENT: { icon: Mail, color: 'text-cyan-500', bgColor: 'bg-cyan-100' },
  FILE_CREATED: { icon: FileText, color: 'text-amber-500', bgColor: 'bg-amber-100' },
  PROOFED: { icon: FileText, color: 'text-violet-500', bgColor: 'bg-violet-100' },
  APPROVED: { icon: CheckCircle, color: 'text-indigo-500', bgColor: 'bg-indigo-100' },
  FINISHING_DONE: { icon: CheckCircle, color: 'text-orange-500', bgColor: 'bg-orange-100' },
  QC_DONE: { icon: CheckCircle, color: 'text-cyan-500', bgColor: 'bg-cyan-100' },
  INSTALLED: { icon: CheckCircle, color: 'text-emerald-500', bgColor: 'bg-emerald-100' },
};

export function EquipmentActivityTimeline({ orderNumber, orderEvents = [] }: EquipmentActivityProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['equipment-activity', orderNumber],
    queryFn: async () => {
      const response = await api.get(`/equipment/workorder/${orderNumber}/activity`);
      return response.data.data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Merge order events with equipment activity
  const combinedTimeline: Array<{
    id: string;
    type: string;
    description: string;
    timestamp: string;
    source: 'erp' | 'thrive' | 'zund' | 'email' | 'network';
    user?: string;
    details?: Record<string, unknown>;
  }> = [];

  // Add order events
  for (const event of orderEvents) {
    combinedTimeline.push({
      id: event.id,
      type: event.eventType,
      description: event.description,
      timestamp: event.createdAt,
      source: 'erp',
      user: event.user.displayName,
      details: event.details,
    });
  }

  // Add equipment activity
  if (data?.activity) {
    for (const activity of data.activity as EquipmentActivityItem[]) {
      combinedTimeline.push({
        id: activity.id,
        type: activity.type,
        description: activity.description,
        timestamp: activity.timestamp,
        source: activity.source,
        details: activity.details,
      });
    }
  }

  // Sort by timestamp descending
  combinedTimeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  if (isLoading && orderEvents.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-soft border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <History className="h-5 w-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-gray-900">Activity Timeline</h2>
        </div>
        <div className="p-6 animate-pulse">
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <div className="w-8 h-8 bg-gray-200 rounded-full" />
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-gray-100 rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-soft border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
        <History className="h-5 w-5 text-primary-600" />
        <h2 className="text-lg font-semibold text-gray-900">Activity Timeline</h2>
        {data?.summary && (
          <div className="ml-auto flex items-center gap-2">
            {data.summary.printJobs > 0 && (
              <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full flex items-center gap-1">
                <Printer className="h-3 w-3" />
                {data.summary.printJobs}
              </span>
            )}
            {data.summary.cutJobs > 0 && (
              <span className="px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 rounded-full flex items-center gap-1">
                <Scissors className="h-3 w-3" />
                {data.summary.cutJobs}
              </span>
            )}
          </div>
        )}
      </div>
      
      <div className="max-h-96 overflow-y-auto px-6 py-4">
        {combinedTimeline.length === 0 ? (
          <div className="py-8 text-center text-gray-500">
            <History className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>No activity recorded yet</p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-gray-200" />
            
            <div className="space-y-4">
              {combinedTimeline.map((item, index) => {
                const presentation = resolveActivityTimelinePresentation(item);
                const config = TYPE_CONFIG[presentation.key] || { 
                  icon: AlertCircle, 
                  color: 'text-gray-500', 
                  bgColor: 'bg-gray-100' 
                };
                const Icon = config.icon;
                
                const isEquipment = item.source === 'thrive' || item.source === 'zund';
                const showBadge = item.source === 'thrive' || item.source === 'zund' || item.source === 'network';
                const badgeLabel = item.source === 'thrive'
                  ? 'PRINT'
                  : item.source === 'zund'
                    ? 'CUT'
                    : presentation.label;
                const badgeClass = item.source === 'thrive'
                  ? 'bg-blue-100 text-blue-700'
                  : item.source === 'zund'
                    ? 'bg-orange-100 text-orange-700'
                    : `${config.bgColor} ${config.color}`;
                
                return (
                  <div key={item.id} className="relative pl-10">
                    {/* Timeline dot */}
                    <div className={`absolute left-0 top-1 w-8 h-8 rounded-full flex items-center justify-center ${config.bgColor} ${
                      index === 0 ? 'ring-2 ring-offset-2 ring-primary-200' : ''
                    }`}>
                      <Icon className={`h-4 w-4 ${config.color}`} />
                    </div>
                    
                    <div className={`p-3 rounded-lg ${
                      isEquipment 
                        ? item.source === 'thrive' 
                          ? 'bg-blue-50/50 border border-blue-100' 
                          : 'bg-orange-50/50 border border-orange-100'
                        : index === 0 
                          ? 'bg-primary-50/50 border border-primary-100' 
                          : 'bg-gray-50/50 border border-gray-100'
                    }`}>
                    <div className="flex items-start justify-between gap-2">
                        <p className="text-sm text-gray-900 font-medium">{item.description}</p>
                        {showBadge && (
                          <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${badgeClass}`}>
                            {badgeLabel}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {item.user && (
                          <>
                            <p className="text-xs text-gray-500">
                              by <span className="font-medium">{item.user}</span>
                            </p>
                            <span className="text-gray-300">•</span>
                          </>
                        )}
                        <span 
                          className="text-xs text-gray-400 cursor-help"
                          title={new Date(item.timestamp).toLocaleString()}
                        >
                          {formatRelativeTime(item.timestamp)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      
      {error && (
        <div className="px-6 py-3 bg-red-50 border-t border-red-100 text-xs text-red-600">
          Equipment data unavailable
        </div>
      )}
    </div>
  );
}
