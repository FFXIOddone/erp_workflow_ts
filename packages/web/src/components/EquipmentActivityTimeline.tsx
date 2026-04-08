import { useQuery } from '@tanstack/react-query';
import { Printer, Scissors, Clock, CheckCircle, Loader2, AlertCircle, History, Mail, FileText } from 'lucide-react';
import { getStationColorTheme } from '@erp/shared';
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
  source: 'thrive' | 'zund' | 'email' | 'network' | 'erp';
  details?: Record<string, unknown>;
}

const TYPE_CONFIG: Record<string, { icon: typeof Printer }> = {
  IN_RIP_QUEUE: { icon: Clock },
  PRINT_QUEUED: { icon: Clock },
  PRINT_PROCESSING: { icon: Loader2 },
  PRINT_READY: { icon: Printer },
  PRINT_PRINTING: { icon: Printer },
  PRINT_COMPLETED: { icon: CheckCircle },
  PRINTED: { icon: CheckCircle },
  CUT_QUEUED: { icon: Scissors },
  CUT_COMPLETED: { icon: CheckCircle },
  EMAIL_SENT: { icon: Mail },
  FILE_CREATED: { icon: FileText },
  PROOFED: { icon: FileText },
  APPROVED: { icon: CheckCircle },
  FINISHING_DONE: { icon: CheckCircle },
  QC_DONE: { icon: CheckCircle },
  INSTALLED: { icon: CheckCircle },
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
  const printingTheme = getStationColorTheme('ROLL_TO_ROLL');
  const productionTheme = getStationColorTheme('PRODUCTION');

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
              <span
                className="px-2 py-0.5 text-xs font-medium rounded-full flex items-center gap-1 border"
                style={{
                  background: printingTheme.softColor,
                  color: printingTheme.softTextColor,
                  borderColor: printingTheme.softBorderColor,
                }}
              >
                <Printer className="h-3 w-3" />
                {data.summary.printJobs}
              </span>
            )}
            {data.summary.cutJobs > 0 && (
              <span
                className="px-2 py-0.5 text-xs font-medium rounded-full flex items-center gap-1 border"
                style={{
                  background: productionTheme.softColor,
                  color: productionTheme.softTextColor,
                  borderColor: productionTheme.softBorderColor,
                }}
              >
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
              {combinedTimeline.map((item) => {
                const presentation = resolveActivityTimelinePresentation(item);
                const config = TYPE_CONFIG[presentation.key] || { icon: AlertCircle };
                const Icon = config.icon;
                
                const isEquipment = item.source === 'thrive' || item.source === 'zund';
                const showBadge = item.source === 'thrive' || item.source === 'zund' || item.source === 'network';
                const badgeLabel = item.source === 'thrive'
                  ? 'PRINT'
                  : item.source === 'zund'
                    ? 'CUT'
                    : presentation.label;
                const sourceTheme = item.source === 'thrive'
                  ? printingTheme
                  : item.source === 'zund'
                    ? productionTheme
                    : null;
                const badgeStyle = sourceTheme
                  ? {
                      background: sourceTheme.softColor,
                      color: sourceTheme.softTextColor,
                      borderColor: sourceTheme.softBorderColor,
                    }
                  : {
                      background: presentation.bgColor,
                      color: presentation.textColor,
                      borderColor: presentation.borderColor,
                    };
                
                return (
                  <div key={item.id} className="relative pl-10">
                    {/* Timeline dot */}
                    <div
                      className="absolute left-0 top-1 w-8 h-8 rounded-full flex items-center justify-center border"
                      style={{
                        background: presentation.bgColor,
                        borderColor: presentation.borderColor,
                      }}
                    >
                      <Icon
                        className={`h-4 w-4 ${item.source === 'thrive' || item.source === 'zund' ? '' : 'text-gray-500'}`}
                        style={{ color: presentation.dotColor }}
                      />
                    </div>
                    <div
                      className="p-3 rounded-lg border"
                      style={{
                        background: isEquipment && sourceTheme ? sourceTheme.softColor : presentation.bgColor,
                        borderColor: isEquipment && sourceTheme ? sourceTheme.softBorderColor : presentation.borderColor,
                      }}
                    >
                    <div className="flex items-start justify-between gap-2">
                        <p className="text-sm text-gray-900 font-medium">{item.description}</p>
                        {showBadge && (
                          <span
                            className="px-1.5 py-0.5 text-[10px] font-medium rounded border"
                            style={badgeStyle}
                          >
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
                            <span className="text-gray-300">|</span>
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
