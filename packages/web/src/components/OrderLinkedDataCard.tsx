import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Clock, FileText, Link2, Paperclip, Truck } from 'lucide-react';
import {
  CARRIER_DISPLAY_NAMES,
  SHIPMENT_STATUS_COLORS,
  SHIPMENT_STATUS_DISPLAY_NAMES,
} from '@erp/shared';
import { api } from '../lib/api';
import { formatDate } from '../lib/date';
import { Badge } from './Badge';

type LinkedShipmentSummary = {
  id: string;
  carrier: string;
  trackingNumber: string | null;
  status: string;
  shipDate: string | null;
  estimatedDelivery: string | null;
  actualDelivery: string | null;
  packageCount: number;
  createdByDisplayName: string | null;
};

type LinkedAttachmentSummary = {
  id: string;
  fileName: string;
  fileType: string;
  uploadedAt: string;
  uploadedByDisplayName: string | null;
};

type LinkedFileChainSummary = {
  totalFiles: number;
  printCutFiles: number;
  linked: number;
  unlinked: number;
  printComplete: number;
  cutComplete: number;
  chainStatus: string;
};

type LinkedFileChainLinkSummary = {
  id: string;
  printFileName: string;
  cutFileName: string | null;
  status: string;
  printStatus: string;
  cutStatus: string;
  printedAt: string | null;
  cutCompletedAt: string | null;
};

type NormalizedLinkedRecordKind = 'SHIPMENT' | 'ATTACHMENT' | 'PROOF' | 'PRINT' | 'CUT';

type NormalizedLinkedRecord = {
  id: string;
  kind: NormalizedLinkedRecordKind;
  label: string;
  status: string;
  timestamp: string | null;
  sourceId: string;
  provenance: string;
  note: string | null;
  cutId: string | null;
};

type OrderLinkedDataSummary = {
  orderId: string;
  orderNumber: string;
  routingCount: number;
  stationProgressCount: number;
  completedStationCount: number;
  shipmentCount: number;
  trackedShipmentCount: number;
  attachmentCount: number;
  reprintRequestCount: number;
  timeEntryCount: number;
  proofApprovalCount: number;
  latestShipments: LinkedShipmentSummary[];
  latestAttachments: LinkedAttachmentSummary[];
  normalizedLinks: NormalizedLinkedRecord[];
  fileChainSummary: LinkedFileChainSummary | null;
  latestFileChainLinks: LinkedFileChainLinkSummary[];
  warnings: string[];
};

interface OrderLinkedDataCardProps {
  orderId: string;
  orderNumber: string;
}

function buildOrderLinkedDataCardModel(data: OrderLinkedDataSummary) {
  return {
    shipments: data.latestShipments,
    attachments: data.latestAttachments,
    proofApprovalCount: data.proofApprovalCount,
    fileChainSummary: data.fileChainSummary,
    linkedRecords: data.normalizedLinks,
    warnings: data.warnings,
    counts: {
      shipments: data.shipmentCount,
      attachments: data.attachmentCount,
      reprints: data.reprintRequestCount,
      timeEntries: data.timeEntryCount,
      completedStations: data.completedStationCount,
      routingCount: data.routingCount,
    },
  };
}

function getChainBadgeVariant(
  chainStatus: string,
): 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  switch (chainStatus) {
    case 'FINISHED':
    case 'CUT_COMPLETE':
      return 'success';
    case 'FAILED':
      return 'danger';
    case 'RIPPING':
    case 'CUTTING':
    case 'PRINTING':
      return 'warning';
    case 'SENT_TO_RIP':
    case 'READY_TO_PRINT':
    case 'PRINTED':
    case 'CUT_PENDING':
      return 'info';
    default:
      return 'neutral';
  }
}

function getShipmentBadgeVariant(
  status: string,
): 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  const color = SHIPMENT_STATUS_COLORS[status as keyof typeof SHIPMENT_STATUS_COLORS];
  switch (color) {
    case 'green':
      return 'success';
    case 'yellow':
      return 'warning';
    case 'red':
      return 'danger';
    case 'blue':
      return 'info';
    default:
      return 'neutral';
  }
}

function getFileChainBadgeVariant(
  status: string,
): 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  switch (status) {
    case 'FINISHED':
    case 'CUT_COMPLETE':
      return 'success';
    case 'FAILED':
      return 'danger';
    case 'CUTTING':
    case 'PRINTING':
      return 'warning';
    case 'READY_TO_PRINT':
    case 'SENT_TO_RIP':
    case 'PRINTED':
    case 'CUT_PENDING':
      return 'info';
    default:
      return 'neutral';
  }
}

function getLinkedRecordBadgeVariant(
  kind: NormalizedLinkedRecordKind,
  status: string,
): 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  switch (kind) {
    case 'SHIPMENT':
      return getShipmentBadgeVariant(status);
    case 'ATTACHMENT':
      return 'neutral';
    case 'PROOF':
      switch (status) {
        case 'APPROVED':
          return 'success';
        case 'REJECTED':
          return 'danger';
        case 'PENDING':
        default:
          return 'warning';
      }
    case 'PRINT':
    case 'CUT':
      return getFileChainBadgeVariant(status);
    default:
      return 'neutral';
  }
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="h-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
      <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-lg font-semibold leading-tight text-gray-900">{value}</div>
    </div>
  );
}

export function OrderLinkedDataCard({ orderId, orderNumber }: OrderLinkedDataCardProps) {
  const { data, isLoading, isError } = useQuery<OrderLinkedDataSummary>({
    queryKey: ['orders', orderId, 'linked-data'],
    queryFn: async () => {
      const response = await api.get(`/orders/${orderId}/linked-data`);
      return response.data.data;
    },
    enabled: !!orderId,
  });

  if (isLoading) {
    return <div className="h-56 animate-pulse rounded-xl border border-gray-100 bg-white" />;
  }

  if (isError || !data) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
          <div>
            <h2 className="text-lg font-semibold text-amber-900">Linked Data</h2>
            <p className="text-sm text-amber-800">
              Could not load linked order data for #{orderNumber}.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const model = buildOrderLinkedDataCardModel(data);
  const chainSummary = model.fileChainSummary;

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-soft">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          <Link2 className="mt-0.5 h-5 w-5 text-primary-600" />
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900">Linked Data</h2>
            <p className="text-xs text-gray-500">ERP records tied to order #{orderNumber}</p>
          </div>
        </div>
        <div className="self-start sm:self-auto">
          {chainSummary ? (
            <Badge variant={getChainBadgeVariant(chainSummary.chainStatus)} size="sm">
              {chainSummary.chainStatus}
            </Badge>
          ) : (
            <Badge variant="neutral" size="sm">
              No file chain
            </Badge>
          )}
        </div>
      </div>

      {model.warnings.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
            <div className="space-y-1 text-sm text-amber-800">
              <p className="font-medium">Linked data warnings</p>
              <ul className="list-disc space-y-0.5 pl-5">
                {model.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
        <StatCard label="Shipments" value={model.counts.shipments} />
        <StatCard label="Attachments" value={model.counts.attachments} />
        <StatCard label="Reprints" value={model.counts.reprints} />
        <StatCard label="Time Entries" value={model.counts.timeEntries} />
        <StatCard label="Proofs" value={model.proofApprovalCount} />
        <StatCard
          label="Completed Stations"
          value={`${model.counts.completedStations}/${model.counts.routingCount}`}
        />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <section className="min-w-0 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Truck className="h-4 w-4 text-primary-600" />
            Latest Shipments
          </div>
          {model.shipments.length > 0 ? (
            <div className="space-y-2">
              {model.shipments.map((shipment) => (
                <div
                  key={shipment.id}
                  className="rounded-lg border border-white bg-white px-3 py-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {CARRIER_DISPLAY_NAMES[
                          shipment.carrier as keyof typeof CARRIER_DISPLAY_NAMES
                        ] ?? shipment.carrier}
                      </span>
                      <Badge variant={getShipmentBadgeVariant(shipment.status)} size="sm">
                        {SHIPMENT_STATUS_DISPLAY_NAMES[
                          shipment.status as keyof typeof SHIPMENT_STATUS_DISPLAY_NAMES
                        ] ?? shipment.status}
                      </Badge>
                    </div>
                    <span className="text-xs text-gray-500">
                      {shipment.packageCount} package{shipment.packageCount === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
                    <span className="font-mono text-gray-700">
                      {shipment.trackingNumber || 'Tracking not recorded'}
                    </span>
                    {shipment.shipDate && <span>Shipped {formatDate(shipment.shipDate)}</span>}
                    {shipment.actualDelivery && (
                      <span>Delivered {formatDate(shipment.actualDelivery)}</span>
                    )}
                    {!shipment.actualDelivery && shipment.estimatedDelivery && (
                      <span>ETA {formatDate(shipment.estimatedDelivery)}</span>
                    )}
                    {shipment.createdByDisplayName && (
                      <span>Created by {shipment.createdByDisplayName}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-gray-200 bg-white px-3 py-4 text-sm text-gray-500">
              No shipment records are linked yet.
            </p>
          )}
        </section>

        <section className="min-w-0 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Paperclip className="h-4 w-4 text-primary-600" />
            Latest Attachments
          </div>
          {model.attachments.length > 0 ? (
            <div className="space-y-2">
              {model.attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="rounded-lg border border-white bg-white px-3 py-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-gray-900" title={attachment.fileName}>
                        {attachment.fileName}
                      </div>
                      <div className="text-xs text-gray-500">
                        {attachment.fileType}
                        {attachment.uploadedByDisplayName ? ` | ${attachment.uploadedByDisplayName}` : ''}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 text-xs text-gray-500">
                      <Clock className="h-3.5 w-3.5" />
                      {formatDate(attachment.uploadedAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-gray-200 bg-white px-3 py-4 text-sm text-gray-500">
              No attachment records are linked yet.
            </p>
          )}
        </section>

        <section className="min-w-0 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900">
            <FileText className="h-4 w-4 text-primary-600" />
            File Chain
          </div>
          {chainSummary ? (
            <div className="rounded-lg border border-white bg-white px-3 py-3 text-sm text-gray-700">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={getChainBadgeVariant(chainSummary.chainStatus)} size="sm">
                  {chainSummary.chainStatus}
                </Badge>
                <span>
                  {chainSummary.totalFiles} total link{chainSummary.totalFiles === 1 ? '' : 's'}
                </span>
                <span>{chainSummary.linked} linked</span>
                <span>{chainSummary.unlinked} unlinked</span>
              </div>
              <div className="mt-2 text-xs text-gray-500">
                Print complete: {chainSummary.printComplete} | Cut complete: {chainSummary.cutComplete}
                {' | '}Print-cut files: {chainSummary.printCutFiles}
              </div>
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-gray-200 bg-white px-3 py-4 text-sm text-gray-500">
              File chain data is not available yet.
            </p>
          )}
        </section>
      </div>

      {model.linkedRecords.length > 0 && (
        <section className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900">
            <FileText className="h-4 w-4 text-primary-600" />
            Latest Normalized Linked Records
          </div>
          <div className="space-y-2">
            {model.linkedRecords.map((record) => (
              <div key={record.id} className="rounded-lg border border-white bg-white px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={getLinkedRecordBadgeVariant(record.kind, record.status)} size="sm">
                    {record.kind}
                  </Badge>
                  <Badge variant="neutral" size="sm">
                    {record.provenance}
                  </Badge>
                  <span className="font-medium text-gray-900">{record.label}</span>
                  {record.cutId && (
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-600">
                      {record.cutId}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
                  <span>Status: {record.status}</span>
                  {record.timestamp && <span>{formatDate(record.timestamp)}</span>}
                  {record.note && <span>{record.note}</span>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
