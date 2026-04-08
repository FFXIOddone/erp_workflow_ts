import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  ExternalLink,
  MapPin,
  Package,
  RefreshCw,
  Truck,
} from 'lucide-react';
import {
  Carrier,
  ShipmentStatus,
  CARRIER_DISPLAY_NAMES,
  SHIPMENT_STATUS_COLORS,
  SHIPMENT_STATUS_DISPLAY_NAMES,
} from '@erp/shared';
import { api } from '../lib/api';
import { formatDate, formatDateTime } from '../lib/date';
import { Badge } from './Badge';
import { FullscreenPanel } from './FullscreenPanel';

interface ShipmentTrackingEvent {
  id: string;
  eventType: string;
  eventDate: string;
  eventTime?: string | null;
  city?: string | null;
  state?: string | null;
  description?: string | null;
  sourceSystem?: string | null;
}

interface ShipmentPackage {
  id: string;
  trackingNumber?: string | null;
  weight?: number | null;
  dimensions?: string | null;
  description?: string | null;
}

interface FedExStatusSummary {
  status?: string | null;
  eventType?: string | null;
  description?: string | null;
  eventTimestamp?: string | null;
  sourceFileName?: string | null;
  sourceFileDate?: string | null;
  location?: string | null;
  trackingNumber?: string | null;
  stale?: boolean | null;
  issue?: string | null;
}

interface ShipmentDetail {
  id: string;
  carrier: Carrier;
  trackingNumber: string | null;
  status: ShipmentStatus;
  shipDate: string | null;
  estimatedDelivery: string | null;
  actualDelivery: string | null;
  notes: string | null;
  createdBy?: {
    id: string;
    displayName: string;
  } | null;
  packages: ShipmentPackage[];
  trackingEvents?: ShipmentTrackingEvent[] | null;
  fedExStatusSummary?: FedExStatusSummary | null;
  fedexStatusSummary?: FedExStatusSummary | null;
  latestFedExStatus?: FedExStatusSummary | null;
  latestFedexStatus?: FedExStatusSummary | null;
}

interface ShipmentDetailPanelProps {
  open: boolean;
  shipmentId: string | null;
  orderNumber: string;
  onClose: () => void;
}

function getTrackingUrl(carrier: Carrier, trackingNumber: string): string | null {
  const urls: Partial<Record<Carrier, string>> = {
    UPS: `https://www.ups.com/track?tracknum=${trackingNumber}`,
    FEDEX: `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`,
    USPS: `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`,
    DHL: `https://www.dhl.com/us-en/home/tracking/tracking-express.html?submit=1&tracking-id=${trackingNumber}`,
  };
  return urls[carrier] ?? null;
}

function getStatusVariant(
  status: ShipmentStatus | string | null | undefined
): 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  if (!status || !(status in SHIPMENT_STATUS_COLORS)) {
    return 'neutral';
  }

  const colorMap: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
    gray: 'neutral',
    blue: 'info',
    yellow: 'warning',
    green: 'success',
    red: 'danger',
  };

  return colorMap[SHIPMENT_STATUS_COLORS[status as ShipmentStatus]] ?? 'default';
}

function getStatusIcon(status: ShipmentStatus | string): JSX.Element {
  if (status === 'DELIVERED') {
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  }
  if (status === 'IN_TRANSIT') {
    return <Truck className="h-4 w-4 text-blue-500" />;
  }
  if (status === 'EXCEPTION') {
    return <AlertTriangle className="h-4 w-4 text-red-500" />;
  }
  return <Clock className="h-4 w-4 text-gray-500" />;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function pickString(value: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
}

function pickBoolean(value: Record<string, unknown>, keys: string[]): boolean | null {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === 'boolean') {
      return candidate;
    }
  }
  return null;
}

function resolveFedExSummary(shipment: ShipmentDetail | null | undefined): FedExStatusSummary | null {
  if (!shipment) {
    return null;
  }

  const candidates: unknown[] = [
    shipment.fedExStatusSummary,
    shipment.fedexStatusSummary,
    shipment.latestFedExStatus,
    shipment.latestFedexStatus,
  ];

  for (const candidate of candidates) {
    const record = toRecord(candidate);
    if (Object.keys(record).length === 0) {
      continue;
    }

    return {
      status: pickString(record, ['status', 'shipmentStatus']),
      eventType: pickString(record, ['eventType', 'type']),
      description: pickString(record, ['description', 'message']),
      eventTimestamp: pickString(record, ['eventTimestamp', 'occurredAt', 'timestamp', 'lastEventAt']),
      sourceFileName: pickString(record, ['sourceFileName', 'source']),
      sourceFileDate: pickString(record, ['sourceFileDate', 'sourceDate']),
      location: pickString(record, ['location', 'cityState']),
      trackingNumber: pickString(record, ['trackingNumber']),
      stale: pickBoolean(record, ['stale', 'isStale']),
    };
  }

  return null;
}

function normalizeEventTimestamp(event: ShipmentTrackingEvent): string {
  return event.eventTime ?? event.eventDate;
}

export function ShipmentDetailPanel({
  open,
  shipmentId,
  orderNumber,
  onClose,
}: ShipmentDetailPanelProps): JSX.Element {
  const detailQuery = useQuery<ShipmentDetail>({
    queryKey: ['shipments', 'detail', shipmentId],
    enabled: open && Boolean(shipmentId),
    staleTime: 30_000,
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: ShipmentDetail }>(
        `/shipments/${shipmentId}`,
      );
      return response.data.data;
    },
  });

  const shipment = detailQuery.data;
  const trackingUrl = shipment?.trackingNumber
    ? getTrackingUrl(shipment.carrier, shipment.trackingNumber)
    : null;
  const fedExSummary = useMemo(() => resolveFedExSummary(shipment), [shipment]);
  const fedExStatusText =
    fedExSummary?.issue && !fedExSummary.status
      ? 'Tracking reference unresolved'
      : fedExSummary?.status ?? fedExSummary?.eventType ?? 'Available';
  const fedExLocationText = fedExSummary?.location ?? 'No Address Found';
  const trackingEvents = useMemo(
    () =>
      [...(shipment?.trackingEvents ?? [])].sort((a, b) =>
        normalizeEventTimestamp(b).localeCompare(normalizeEventTimestamp(a)),
      ),
    [shipment?.trackingEvents],
  );

  return (
    <FullscreenPanel
      open={open}
      onClose={onClose}
      title={`Shipment Details`}
      subtitle={`Order #${orderNumber}`}
      maxWidthClassName="max-w-4xl"
    >
      <div className="p-5 sm:p-6">
        {detailQuery.isLoading ? (
          <div className="flex min-h-[220px] items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
              Loading shipment details...
            </div>
          </div>
        ) : detailQuery.isError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-700">Failed to load shipment details.</p>
            <button
              type="button"
              onClick={() => void detailQuery.refetch()}
              className="mt-3 inline-flex items-center gap-1 rounded-md bg-white px-3 py-1.5 text-sm text-red-700 ring-1 ring-red-200 hover:bg-red-100"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        ) : !shipment ? (
          <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500">
            Shipment details are unavailable.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                {getStatusIcon(shipment.status)}
                <span className="text-base font-semibold text-gray-900">
                  {CARRIER_DISPLAY_NAMES[shipment.carrier]}
                </span>
                <Badge variant={getStatusVariant(shipment.status)} size="sm">
                  {SHIPMENT_STATUS_DISPLAY_NAMES[shipment.status] ?? shipment.status}
                </Badge>
                {fedExSummary?.status && (
                  <Badge variant="info" size="sm">
                    FedEx: {fedExSummary.status}
                  </Badge>
                )}
              </div>

              <div className="mt-3 space-y-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-gray-500">Tracking:</span>
                  {shipment.trackingNumber ? (
                    trackingUrl ? (
                      <a
                        href={trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-primary-600 hover:text-primary-800"
                      >
                        {shipment.trackingNumber}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      <span className="font-mono text-gray-800">{shipment.trackingNumber}</span>
                    )
                  ) : (
                    <span className="text-gray-500">Not recorded</span>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-2 text-xs text-gray-600 sm:grid-cols-3">
                  <span className="flex items-center gap-1">
                    <Package className="h-3.5 w-3.5" />
                    Shipped: {shipment.shipDate ? formatDate(shipment.shipDate) : 'Unknown'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    Est Delivery:{' '}
                    {shipment.estimatedDelivery ? formatDate(shipment.estimatedDelivery) : 'Not set'}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    Delivered:{' '}
                    {shipment.actualDelivery ? formatDate(shipment.actualDelivery) : 'Not delivered'}
                  </span>
                </div>
              </div>
            </div>

            {fedExSummary && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <h3 className="text-sm font-semibold text-blue-900">FedEx Status Summary</h3>
                <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-blue-900 sm:grid-cols-2">
                  <div>
                    <span className="font-medium">Status:</span>{' '}
                    {fedExStatusText}
                  </div>
                  {fedExSummary.eventTimestamp && (
                    <div>
                      <span className="font-medium">Event Time:</span>{' '}
                      {formatDateTime(fedExSummary.eventTimestamp)}
                    </div>
                  )}
                  {fedExSummary.description && (
                    <div className="sm:col-span-2">
                      <span className="font-medium">Details:</span> {fedExSummary.description}
                    </div>
                  )}
                  <div className="sm:col-span-2">
                    <span className="font-medium">Last scan location:</span> {fedExLocationText}
                  </div>
                  {fedExSummary.issue && (
                    <div className="sm:col-span-2">
                      <span className="font-medium">Issue:</span> {fedExSummary.issue}
                    </div>
                  )}
                  {(fedExSummary.sourceFileName || fedExSummary.sourceFileDate) && (
                    <div className="sm:col-span-2">
                      <span className="font-medium">Source:</span>{' '}
                      {[fedExSummary.sourceFileName, fedExSummary.sourceFileDate]
                        .filter(Boolean)
                        .join(' - ')}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-gray-900">Notes</h3>
              <p className="mt-2 text-sm text-gray-600">
                {shipment.notes?.trim() ? shipment.notes : 'No shipment notes yet.'}
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-gray-900">Packages</h3>
              {shipment.packages.length === 0 ? (
                <p className="mt-2 text-sm text-gray-500">No package rows recorded.</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {shipment.packages.map((pkg) => (
                    <div key={pkg.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                      <div className="text-sm font-medium text-gray-900">
                        {pkg.description || 'Package'}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-600">
                        <span>Weight: {pkg.weight ?? 'N/A'}</span>
                        <span>Dimensions: {pkg.dimensions ?? 'N/A'}</span>
                        {pkg.trackingNumber && <span>Tracking: {pkg.trackingNumber}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {trackingEvents.length > 0 && (
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-gray-900">Tracking Events</h3>
                <div className="mt-2 space-y-2">
                  {trackingEvents.slice(0, 8).map((event) => (
                    <div key={event.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                        <Badge variant="neutral" size="sm">
                          {event.eventType}
                        </Badge>
                        <span>{formatDateTime(normalizeEventTimestamp(event))}</span>
                        {(event.city || event.state) && (
                          <span>
                            {event.city}
                            {event.city && event.state ? ', ' : ''}
                            {event.state}
                          </span>
                        )}
                        {event.sourceSystem && <span>Source: {event.sourceSystem}</span>}
                      </div>
                      {event.description && (
                        <p className="mt-1 text-xs text-gray-700">{event.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </FullscreenPanel>
  );
}
