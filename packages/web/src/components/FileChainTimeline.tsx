import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, Printer, Scissors, FileCheck, ChevronRight, Link2, Shield, CheckCircle, X, Lock } from 'lucide-react';
import { api } from '../lib/api';

interface FileChainLink {
  id: string;
  orderId: string;
  printFilePath?: string;
  printFileName?: string;
  cutFilePath?: string;
  cutFileName?: string;
  cutFileSource?: string;
  linkConfidence?: string;
  cutId?: string;
  ripStatus?: string;
  printStatus?: string;
  cutStatus?: string;
  status?: string;
  printedAt?: string;
  printCompletedAt?: string;
  rippedAt?: string;
  cutAt?: string;
  cutCompletedAt?: string;
  printerName?: string;
  cutterName?: string;
  width?: number;
  height?: number;
  quantity?: number;
  confirmed?: boolean;
  confirmedAt?: string;
  confirmedById?: string;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: 'bg-green-100 text-green-800 border-green-300',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  PENDING: 'bg-gray-100 text-gray-600 border-gray-300',
  FAILED: 'bg-red-100 text-red-800 border-red-300',
};

const CONFIDENCE_STYLES: Record<string, string> = {
  EXACT: 'bg-green-100 text-green-700',
  HIGH: 'bg-blue-100 text-blue-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  PARTIAL: 'bg-orange-100 text-orange-700',
  NESTING: 'bg-purple-100 text-purple-700',
  MANUAL: 'bg-amber-100 text-amber-700',
  NONE: 'bg-gray-100 text-gray-500',
};

function ConfidenceBadge({ confidence, confirmed }: { confidence?: string; confirmed?: boolean }) {
  if (confirmed || confidence === 'MANUAL') {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-green-100 text-green-700">
        <Lock className="h-2.5 w-2.5" />
        Confirmed
      </span>
    );
  }
  if (!confidence || confidence === 'NONE') return null;
  const style = CONFIDENCE_STYLES[confidence] || CONFIDENCE_STYLES.NONE;
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded-full ${style}`}>
      <Shield className="h-2.5 w-2.5" />
      Suggested &middot; {confidence}
    </span>
  );
}

function StepBadge({ label, status, time, icon: Icon }: { label: string; status?: string; time?: string; icon: any }) {
  const color = STATUS_COLORS[status || 'PENDING'] || STATUS_COLORS.PENDING;
  return (
    <div className={`flex flex-col items-center px-4 py-3 rounded-xl border ${color} min-w-[120px]`}>
      <Icon className="w-5 h-5 mb-1" />
      <span className="text-xs font-semibold">{label}</span>
      <span className="text-[10px] mt-0.5 capitalize">{(status || 'pending').toLowerCase().replace(/_/g, ' ')}</span>
      {time && (
        <span className="text-[10px] opacity-70 mt-0.5">
          {new Date(time).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
    </div>
  );
}

export function FileChainTimeline({ orderId }: { orderId: string }) {
  const queryClient = useQueryClient();

  const { data: links, isLoading } = useQuery({
    queryKey: ['file-chain', orderId],
    queryFn: async () => {
      const res = await api.get(`/file-chain/orders/${orderId}`);
      return (res.data.data || []) as FileChainLink[];
    },
    enabled: !!orderId,
  });

  const confirmMutation = useMutation({
    mutationFn: (linkId: string) => api.put(`/file-chain/links/${linkId}/confirm`),
    onMutate: async (linkId) => {
      await queryClient.cancelQueries({ queryKey: ['file-chain', orderId] });
      const previous = queryClient.getQueryData<FileChainLink[]>(['file-chain', orderId]);
      queryClient.setQueryData<FileChainLink[]>(['file-chain', orderId], (old) =>
        old?.map((l) => l.id === linkId ? { ...l, confirmed: true } : l)
      );
      return { previous };
    },
    onError: (_err, _linkId, context) => {
      if (context?.previous) queryClient.setQueryData(['file-chain', orderId], context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['file-chain', orderId] });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: (linkId: string) => api.put(`/file-chain/links/${linkId}/dismiss`),
    onMutate: async (linkId) => {
      await queryClient.cancelQueries({ queryKey: ['file-chain', orderId] });
      const previous = queryClient.getQueryData<FileChainLink[]>(['file-chain', orderId]);
      queryClient.setQueryData<FileChainLink[]>(['file-chain', orderId], (old) =>
        old?.map((l) => l.id === linkId ? { ...l, cutFileName: undefined, cutFilePath: undefined, linkConfidence: 'NONE' } : l)
      );
      return { previous };
    },
    onError: (_err, _linkId, context) => {
      if (context?.previous) queryClient.setQueryData(['file-chain', orderId], context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['file-chain', orderId] });
    },
  });

  if (isLoading) {
    return (
      <div className="animate-pulse h-24 bg-gray-100 rounded-xl" />
    );
  }

  if (!links || links.length === 0) {
    return (
      <div className="text-sm text-gray-400 text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">
        No file chain data yet
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {links.map((link) => (
        <div key={link.id} className="flex items-center gap-2 overflow-x-auto pb-2">
          {/* Design step */}
          <StepBadge
            label="Design"
            status={link.printFilePath ? 'COMPLETED' : 'PENDING'}
            icon={FileCheck}
          />
          <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />

          {/* RIP step */}
          <StepBadge
            label="RIP"
            status={link.ripStatus || (link.rippedAt ? 'COMPLETED' : 'PENDING')}
            time={link.rippedAt}
            icon={Printer}
          />
          <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />

          {/* Print step */}
          <StepBadge
            label="Print"
            status={link.printStatus || (link.printedAt ? 'COMPLETED' : 'PENDING')}
            time={link.printedAt}
            icon={Printer}
          />
          <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />

          {/* Cut step */}
          <StepBadge
            label="Cut"
            status={link.cutStatus || (link.cutCompletedAt || link.cutAt ? 'COMPLETED' : link.cutFilePath ? 'IN_PROGRESS' : 'PENDING')}
            time={link.cutCompletedAt || link.cutAt}
            icon={Scissors}
          />

          {/* Metadata */}
          <div className="ml-3 text-xs text-gray-500 shrink-0 space-y-0.5">
            {link.printFileName && <div className="truncate max-w-[200px]" title={link.printFileName}>{link.printFileName}</div>}
            {link.cutFileName && (
              <div className="flex items-center gap-1 text-blue-600 truncate max-w-[200px]" title={link.cutFileName}>
                <Link2 className="h-3 w-3 shrink-0" />
                {link.cutFileName}
              </div>
            )}
            <div className="flex items-center gap-1.5 flex-wrap">
              {link.cutId && (
                <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono bg-gray-100 text-gray-600 rounded" title="CutID">
                  {link.cutId}
                </span>
              )}
              <ConfidenceBadge confidence={link.linkConfidence} confirmed={link.confirmed} />
              {/* Confirm/Dismiss buttons for unconfirmed auto-linked suggestions */}
              {link.cutFileName && !link.confirmed && link.linkConfidence !== 'MANUAL' && (
                <span className="inline-flex items-center gap-1 ml-1">
                  <button
                    onClick={() => confirmMutation.mutate(link.id)}
                    disabled={confirmMutation.isPending}
                    className="p-0.5 rounded hover:bg-green-100 text-gray-400 hover:text-green-600 transition-colors"
                    title="Confirm this link"
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => dismissMutation.mutate(link.id)}
                    disabled={dismissMutation.isPending}
                    className="p-0.5 rounded hover:bg-red-100 text-gray-400 hover:text-red-600 transition-colors"
                    title="Dismiss this link"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              )}
              {link.cutFileSource && (
                <span className="text-[10px] text-gray-400">{link.cutFileSource}</span>
              )}
              {link.printerName && (
                <span className="text-[10px] text-gray-400">{link.printerName}</span>
              )}
              {link.cutterName && (
                <span className="text-[10px] text-gray-400">{link.cutterName}</span>
              )}
            </div>
            {link.width && link.height && <div>{link.width}" x {link.height}"</div>}
            {link.quantity && <div>Qty: {link.quantity}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
