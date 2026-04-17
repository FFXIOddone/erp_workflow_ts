import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, Printer, Scissors, FileCheck, ChevronRight, Link2, Shield, CheckCircle, X, Lock, Maximize2 } from 'lucide-react';
import { deriveFileChainLinkState } from '@erp/shared';
import { api } from '../lib/api';
import { FullscreenPanel } from './FullscreenPanel';

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
  effectiveStatus?: string;
  printStartedAt?: string;
  printedAt?: string;
  printCompletedAt?: string;
  rippedAt?: string;
  cutStartedAt?: string;
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

interface FileChainSummaryResponse {
  normalizedLinks: FileChainLink[];
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

function StepBadge({
  label,
  status,
  time,
  icon: Icon,
}: {
  label: string;
  status?: string;
  time?: string | Date | null;
  icon: any;
}) {
  const color = STATUS_COLORS[status || 'PENDING'] || STATUS_COLORS.PENDING;
  const formattedTime =
    time instanceof Date
      ? time
      : typeof time === 'string'
        ? new Date(time)
        : null;
  return (
    <div className={`flex min-w-[104px] flex-col items-center rounded-xl border px-3 py-2.5 text-center ${color}`}>
      <Icon className="mb-1 h-5 w-5" />
      <span className="text-xs font-semibold">{label}</span>
      <span className="mt-0.5 text-[10px] capitalize">{(status || 'pending').toLowerCase().replace(/_/g, ' ')}</span>
      {formattedTime && !Number.isNaN(formattedTime.getTime()) && (
        <span className="mt-0.5 text-[10px] opacity-70">
          {formattedTime.toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      )}
    </div>
  );
}

export function FileChainTimeline({ orderId, showFullscreenButton = true }: { orderId: string; showFullscreenButton?: boolean }) {
  const queryClient = useQueryClient();
  const [isFullscreen, setIsFullscreen] = useState(false);

  const { data: summary, isLoading } = useQuery<FileChainSummaryResponse>({
    queryKey: ['file-chain', orderId],
    queryFn: async () => {
      const res = await api.get(`/file-chain/orders/${orderId}/summary`);
      return res.data.data as FileChainSummaryResponse;
    },
    enabled: !!orderId,
  });

  const normalizedLinks = summary?.normalizedLinks ?? [];

  const derivedLinks = useMemo(
    () =>
      (summary?.normalizedLinks ?? []).map((link) =>
        ({
          ...link,
          status: link.status ?? 'DESIGN',
          ...deriveFileChainLinkState({
            ...link,
            status: link.status ?? 'DESIGN',
          }),
        }),
      ),
    [summary],
  );

  const confirmMutation = useMutation({
    mutationFn: (linkId: string) => api.put(`/file-chain/links/${linkId}/confirm`),
    onMutate: async (linkId) => {
      await queryClient.cancelQueries({ queryKey: ['file-chain', orderId] });
      const previous = queryClient.getQueryData<FileChainSummaryResponse>(['file-chain', orderId]);
      queryClient.setQueryData<FileChainSummaryResponse>(['file-chain', orderId], (old) =>
        old
          ? {
              ...old,
              normalizedLinks: old.normalizedLinks.map((l) => (l.id === linkId ? { ...l, confirmed: true } : l)),
            }
          : old,
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
      const previous = queryClient.getQueryData<FileChainSummaryResponse>(['file-chain', orderId]);
      queryClient.setQueryData<FileChainSummaryResponse>(['file-chain', orderId], (old) =>
        old
          ? {
              ...old,
              normalizedLinks: old.normalizedLinks.map((l) =>
                l.id === linkId ? { ...l, cutFileName: undefined, cutFilePath: undefined, linkConfidence: 'NONE' } : l,
              ),
            }
          : old,
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

  const renderRows = () => (
    <div className="space-y-4">
      {derivedLinks.map((link) => (
        <div key={link.id} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 flex-1 overflow-x-auto pb-1">
              <div className="flex min-w-max items-center gap-2">
                <StepBadge
                  label="Design"
                  status={link.printFilePath || link.printFileName ? 'COMPLETED' : 'PENDING'}
                  icon={FileCheck}
                />
                <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />

                <StepBadge
                  label="RIP"
                  status={link.ripStatus}
                  time={link.rippedAt}
                  icon={Printer}
                />
                <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />

                <StepBadge
                  label="Print"
                  status={link.printStatus}
                  time={link.printCompletedAt || link.printedAt || link.printStartedAt}
                  icon={Printer}
                />
                <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />

                <StepBadge
                  label="Cut"
                  status={link.cutStatus}
                  time={link.cutCompletedAt || link.cutAt || link.cutStartedAt}
                  icon={Scissors}
                />
              </div>
            </div>

            <div className="min-w-0 space-y-1 text-xs text-gray-500 xl:w-72 xl:shrink-0">
              {link.printFileName && (
                <div className="truncate font-medium text-gray-700" title={link.printFileName}>
                  {link.printFileName}
                </div>
              )}
              {link.cutFileName && (
                <div className="flex items-center gap-1 truncate text-blue-600" title={link.cutFileName}>
                  <Link2 className="h-3 w-3 shrink-0" />
                  <span className="truncate">{link.cutFileName}</span>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-1.5">
                {link.cutId && (
                  <span className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-600" title="CutID">
                    {link.cutId}
                  </span>
                )}
                <ConfidenceBadge confidence={link.linkConfidence} confirmed={link.confirmed} />
                {link.cutFileName && !link.confirmed && link.linkConfidence !== 'MANUAL' && (
                  <span className="inline-flex items-center gap-1">
                    <button
                      onClick={() => confirmMutation.mutate(link.id)}
                      disabled={confirmMutation.isPending}
                      className="rounded p-0.5 text-gray-400 transition-colors hover:bg-green-100 hover:text-green-600"
                      title="Confirm this link"
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => dismissMutation.mutate(link.id)}
                      disabled={dismissMutation.isPending}
                      className="rounded p-0.5 text-gray-400 transition-colors hover:bg-red-100 hover:text-red-600"
                      title="Dismiss this link"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                )}
                {link.cutFileSource && <span className="text-[10px] text-gray-400">{link.cutFileSource}</span>}
                {link.printerName && <span className="text-[10px] text-gray-400">{link.printerName}</span>}
                {link.cutterName && <span className="text-[10px] text-gray-400">{link.cutterName}</span>}
              </div>
              {(link.width && link.height) || link.quantity ? (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500">
                  {link.width && link.height && <span>{link.width}" x {link.height}"</span>}
                  {link.quantity && <span>Qty: {link.quantity}</span>}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-soft border border-gray-100 p-6 animate-pulse">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="h-5 bg-gray-200 rounded w-32" />
          <div className="h-8 bg-gray-200 rounded w-8" />
        </div>
        <div className="h-24 bg-gray-100 rounded-lg" />
      </div>
    );
  }

  if (normalizedLinks.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-soft border border-gray-100 p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <FileCheck className="h-5 w-5 text-primary-600" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">File Chain</h3>
              <p className="text-xs text-gray-500">Print, RIP, and cut chain for this order</p>
            </div>
          </div>
          {showFullscreenButton && (
            <button
              type="button"
              onClick={() => setIsFullscreen(true)}
              className="self-start rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 sm:self-auto"
              title="Open full screen"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-6 text-center text-sm text-gray-400">
          No file chain data yet
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-xl shadow-soft border border-gray-100 p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <FileCheck className="h-5 w-5 text-primary-600" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">File Chain</h3>
              <p className="text-xs text-gray-500">Print, RIP, and cut chain for this order</p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              {normalizedLinks.length} link{normalizedLinks.length === 1 ? '' : 's'}
            </span>
            {showFullscreenButton && (
              <button
                type="button"
                onClick={() => setIsFullscreen(true)}
                className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
                title="Open full screen"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        {renderRows()}
      </div>

      <FullscreenPanel
        open={isFullscreen}
        title="File Chain"
        subtitle={`Order #${orderId}`}
        onClose={() => setIsFullscreen(false)}
        maxWidthClassName="max-w-[1800px]"
      >
        <div className="p-4 sm:p-6">
          <div className="bg-white rounded-xl shadow-soft border border-gray-100 p-6">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-center gap-2">
                <FileCheck className="h-5 w-5 text-primary-600" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">File Chain</h3>
                  <p className="text-xs text-gray-500">Print, RIP, and cut chain for this order</p>
                </div>
              </div>
              <div className="self-start sm:self-auto">
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                  {normalizedLinks.length} link{normalizedLinks.length === 1 ? '' : 's'}
                </span>
              </div>
            </div>
            {renderRows()}
          </div>
        </div>
      </FullscreenPanel>
    </>
  );
}
