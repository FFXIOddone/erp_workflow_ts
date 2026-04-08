import { useState, type ChangeEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ExternalLink, Filter, Package, Search, Truck, CalendarClock, CalendarDays, RotateCcw } from 'lucide-react';
import { api } from '../lib/api';
import { formatDate, formatDateTime } from '../lib/date';
import { Badge, EmptyState, Pagination, Spinner } from './index';

interface FedExShipmentWorkOrder {
  id: string;
  orderNumber: string;
  customerName: string;
}

interface FedExShipmentRecord {
  id: string;
  sourceFileName: string | null;
  sourceFilePath: string | null;
  sourceFileDate: string | null;
  eventTimestamp: string | null;
  trackingNumber: string | null;
  service: string | null;
  locationLabel: string | null;
  latestScanLocation: string | null;
  latestStatusCode: string | null;
  latestStatus: string | null;
  issue: string | null;
  recordCount: number | null;
  linkedWorkOrderCount: number | null;
  recipientCompanyName: string | null;
  recipientContactName: string | null;
  destinationAddressLine1: string | null;
  destinationCity: string | null;
  destinationState: string | null;
  destinationPostalCode: string | null;
  destinationCountry: string | null;
  sourceKey: string | null;
  importedAt: string | null;
  updatedAt: string | null;
  workOrder: FedExShipmentWorkOrder | null;
}

interface FedExShipmentsPageData {
  items: FedExShipmentRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function getTodayInputValue(): string {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

function toStartOfDayIso(value: string): string {
  const [year, month, day] = value.split('-').map((part) => Number(part));
  const date = new Date(year, month - 1, day, 0, 0, 0, 0);
  return date.toISOString();
}

function toEndOfDayIso(value: string): string {
  const [year, month, day] = value.split('-').map((part) => Number(part));
  const date = new Date(year, month - 1, day, 23, 59, 59, 999);
  return date.toISOString();
}

function formatServiceLabel(service: string | null): string {
  if (!service) return 'Service not recorded';
  return service.replace(/_/g, ' ');
}

function getTrackingUrl(trackingNumber: string): string {
  return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(trackingNumber)}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function asIsoTimestamp(value: unknown): string | null {
  const raw = asString(value);
  if (!raw) {
    return null;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function resolveWorkOrder(value: unknown): FedExShipmentWorkOrder | null {
  const source = asRecord(value);
  const id = asString(source.id);
  const orderNumber = asString(source.orderNumber);
  const customerName = asString(source.customerName);

  if (!id || !orderNumber) {
    return null;
  }

  return {
    id,
    orderNumber,
    customerName: customerName ?? 'Customer not recorded',
  };
}

function resolveTimestampScore(value: string | null): number {
  if (!value) {
    return 0;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function normalizeFedExShipmentRecord(raw: unknown, index: number): FedExShipmentRecord {
  const source = asRecord(raw);
  const latestRecord = asRecord(source.latestRecord);
  const trackingNumber =
    asString(source.trackingNumber) ??
    asString(latestRecord.trackingNumber);
  const sourceKey =
    asString(source.sourceKey) ??
    asString(latestRecord.sourceKey);
  const id = asString(source.id) ?? sourceKey ?? trackingNumber ?? `fedex-record-${index + 1}`;

  return {
    id,
    sourceFileName:
      asString(source.sourceFileName) ??
      asString(source.latestSourceFileName) ??
      asString(latestRecord.sourceFileName),
    sourceFilePath: asString(source.sourceFilePath) ?? asString(latestRecord.sourceFilePath),
    sourceFileDate:
      asIsoTimestamp(source.sourceFileDate) ??
      asIsoTimestamp(source.latestSourceFileDate) ??
      asIsoTimestamp(latestRecord.sourceFileDate),
    eventTimestamp:
      asIsoTimestamp(source.latestEventTimestamp) ??
      asIsoTimestamp(source.eventTimestamp) ??
      asIsoTimestamp(latestRecord.eventTimestamp),
    trackingNumber,
    service:
      asString(source.service) ??
      asString(source.latestService) ??
      asString(latestRecord.service),
    locationLabel:
      asString(source.locationLabel) ??
      asString(latestRecord.locationLabel),
    latestScanLocation:
      asString(source.latestScanLocation) ??
      asString(source.latestLocationLabel) ??
      asString(source.scanLocation) ??
      asString(source.locationLabel) ??
      asString(latestRecord.latestScanLocation) ??
      asString(latestRecord.latestLocationLabel) ??
      asString(latestRecord.scanLocation) ??
      asString(latestRecord.locationLabel),
    latestStatusCode:
      asString(source.latestStatusCode) ??
      asString(source.statusCode) ??
      asString(latestRecord.latestStatusCode) ??
      asString(latestRecord.statusCode),
    latestStatus:
      asString(source.latestStatus) ??
      asString(source.status) ??
      asString(latestRecord.latestStatus) ??
      asString(latestRecord.status),
    issue:
      asString(source.issue) ??
      asString(source.latestIssue) ??
      asString(latestRecord.issue),
    recordCount:
      asNumber(source.recordCount) ??
      asNumber(source.rawRecordCount) ??
      asNumber(source.linkedRecordCount) ??
      asNumber(latestRecord.recordCount),
    linkedWorkOrderCount:
      asNumber(source.linkedWorkOrderCount) ??
      asNumber(source.orderCount) ??
      asNumber(latestRecord.linkedWorkOrderCount),
    recipientCompanyName:
      asString(source.recipientCompanyName) ??
      asString(source.latestRecipientCompanyName) ??
      asString(latestRecord.recipientCompanyName),
    recipientContactName:
      asString(source.recipientContactName) ??
      asString(source.latestRecipientContactName) ??
      asString(latestRecord.recipientContactName),
    destinationAddressLine1:
      asString(source.destinationAddressLine1) ??
      asString(latestRecord.destinationAddressLine1),
    destinationCity:
      asString(source.destinationCity) ??
      asString(latestRecord.destinationCity),
    destinationState:
      asString(source.destinationState) ??
      asString(latestRecord.destinationState),
    destinationPostalCode:
      asString(source.destinationPostalCode) ??
      asString(latestRecord.destinationPostalCode),
    destinationCountry:
      asString(source.destinationCountry) ??
      asString(latestRecord.destinationCountry),
    sourceKey,
    importedAt:
      asIsoTimestamp(source.importedAt) ??
      asIsoTimestamp(latestRecord.importedAt),
    updatedAt:
      asIsoTimestamp(source.updatedAt) ??
      asIsoTimestamp(latestRecord.updatedAt),
    workOrder: resolveWorkOrder(source.workOrder) ?? resolveWorkOrder(latestRecord.workOrder),
  };
}

function dedupeGroupedRows(records: FedExShipmentRecord[]): FedExShipmentRecord[] {
  const looksGrouped = records.some(
    (record) =>
      record.recordCount !== null ||
      record.linkedWorkOrderCount !== null ||
      record.latestStatus !== null ||
      record.latestStatusCode !== null ||
      record.latestScanLocation !== null
  );
  if (!looksGrouped) {
    return records;
  }

  const byTracking = new Map<string, FedExShipmentRecord>();
  const passthrough: FedExShipmentRecord[] = [];

  for (const record of records) {
    if (!record.trackingNumber) {
      passthrough.push(record);
      continue;
    }

    const existing = byTracking.get(record.trackingNumber);
    if (!existing) {
      byTracking.set(record.trackingNumber, record);
      continue;
    }

    const existingCount = existing.recordCount ?? 1;
    const nextCount = record.recordCount ?? 1;
    const existingScore = resolveTimestampScore(existing.eventTimestamp ?? existing.sourceFileDate);
    const nextScore = resolveTimestampScore(record.eventTimestamp ?? record.sourceFileDate);

    if (nextCount > existingCount || (nextCount === existingCount && nextScore >= existingScore)) {
      byTracking.set(record.trackingNumber, record);
    }
  }

  return [...byTracking.values(), ...passthrough];
}

export function FedExShipmentsPanel(): JSX.Element {
  const today = getTodayInputValue();
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data, isLoading, isError } = useQuery<FedExShipmentsPageData>({
    queryKey: ['fedex-shipments', { search, fromDate, toDate, page, pageSize }],
    queryFn: async (): Promise<FedExShipmentsPageData> => {
      const response = await api.get<{ success: boolean; data: Record<string, unknown> }>('/fedex/shipments', {
        params: {
          search: search || undefined,
          fromDate: fromDate ? toStartOfDayIso(fromDate) : undefined,
          toDate: toDate ? toEndOfDayIso(toDate) : undefined,
          page,
          pageSize,
        },
      });

      const payload = asRecord(response.data.data);
      const rawItems = Array.isArray(payload.items) ? payload.items : [];
      const normalizedItems = rawItems.map((item, index) => normalizeFedExShipmentRecord(item, index));
      const dedupedItems = dedupeGroupedRows(normalizedItems);

      return {
        items: dedupedItems,
        total: asNumber(payload.total) ?? dedupedItems.length,
        page: asNumber(payload.page) ?? page,
        pageSize: asNumber(payload.pageSize) ?? pageSize,
        totalPages: asNumber(payload.totalPages) ?? 1,
      };
    },
  });

  const records = data?.items ?? [];
  const pagination = data
    ? data
    : {
        items: records,
        total: records.length,
        page,
        pageSize,
        totalPages: 1,
      };

  const clearFilters = (): void => {
    setSearch('');
    setFromDate(today);
    setToDate(today);
    setPage(1);
  };

  const hasArchiveFilters = fromDate !== today || toDate !== today;
  const hasActiveFilters = search.length > 0 || hasArchiveFilters;

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary-600" />
            <h2 className="text-xl font-semibold text-gray-900">FedEx Shipments</h2>
          </div>
          <p className="text-sm text-gray-500">
            Shipment-level FedEx tracking records. Defaults to today, but you can search archives by date.
          </p>
        </div>
        <button
          type="button"
          onClick={clearFilters}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50"
        >
          <RotateCcw className="h-4 w-4" />
          Today
        </button>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-soft">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                setSearch((event.currentTarget as HTMLInputElement).value);
                setPage(1);
              }}
              placeholder="Search tracking number, recipient, city, or address..."
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                <CalendarDays className="h-3.5 w-3.5" />
                From
              </span>
              <input
                type="date"
                value={fromDate}
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  setFromDate((event.currentTarget as HTMLInputElement).value || today);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
              />
            </label>

            <label className="block">
              <span className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                <CalendarClock className="h-3.5 w-3.5" />
                To
              </span>
              <input
                type="date"
                value={toDate}
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  setToDate((event.currentTarget as HTMLInputElement).value || today);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
              />
            </label>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 font-medium text-gray-700">
            <Filter className="h-3.5 w-3.5" />
            {hasArchiveFilters ? 'Archive search' : 'Today'}
          </span>
          <span>
            Showing {fromDate === toDate ? formatDate(fromDate) : `${formatDate(fromDate)} - ${formatDate(toDate)}`}
          </span>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-primary-600 hover:text-primary-800"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load FedEx shipments. Please try again.
        </div>
      ) : records.length === 0 ? (
        <EmptyState
          icon={<Package className="h-12 w-12 text-gray-400" />}
          title="No FedEx shipments found"
          description={
            hasArchiveFilters || search
              ? 'Try changing the date range or search terms.'
              : 'No live FedEx shipments were logged today.'
          }
          action={
            hasActiveFilters
              ? { label: 'Reset to today', onClick: clearFilters }
              : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-soft">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Tracking
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Recipient / Scan Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Order
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Service
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Log Time
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {records.map((record) => {
                const recipient =
                  record.recipientCompanyName ??
                  record.recipientContactName ??
                  record.workOrder?.customerName ??
                  'Recipient not available';
                const scanLocation = record.latestScanLocation?.trim() || null;
                const issue = record.issue?.trim() || null;
                const statusLabel = record.latestStatus?.trim() || null;
                const logDateLabel = record.sourceFileDate ? formatDate(record.sourceFileDate) : 'Not recorded';
                const hasCounts = record.recordCount !== null || record.linkedWorkOrderCount !== null;
                const countsLabel = [
                  record.recordCount !== null ? `raw records: ${record.recordCount}` : null,
                  record.linkedWorkOrderCount !== null ? `linked orders: ${record.linkedWorkOrderCount}` : null,
                ]
                  .filter((part): part is string => Boolean(part))
                  .join(' | ');

                return (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 align-top">
                      <div className="space-y-1">
                        {record.trackingNumber ? (
                          <a
                            href={getTrackingUrl(record.trackingNumber)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 font-mono text-sm font-medium text-primary-600 hover:text-primary-800"
                          >
                            {record.trackingNumber}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <div className="text-sm text-gray-400">Tracking not recorded</div>
                        )}
                        <div className="text-xs text-gray-500">{record.sourceFileName ?? 'Source not recorded'}</div>
                        {hasCounts ? <div className="text-xs text-gray-500">{countsLabel}</div> : null}
                      </div>
                    </td>
                    <td className="px-6 py-4 align-top">
                      <div className="space-y-1">
                        <div className="font-medium text-gray-900">{recipient}</div>
                        {scanLocation ? (
                          <div className="text-sm text-gray-900">Last scan: {scanLocation}</div>
                        ) : issue ? (
                          <div className="text-sm text-amber-700">No Address Found</div>
                        ) : (
                          <div className="text-sm text-gray-400">Location not recorded</div>
                        )}
                        {issue ? <div className="text-xs text-amber-700">Issue: {issue}</div> : null}
                      </div>
                    </td>
                    <td className="px-6 py-4 align-top">
                      {record.workOrder ? (
                        <div className="space-y-1">
                          <Link
                            to={`/orders/${record.workOrder.id}`}
                            className="font-medium text-primary-600 hover:text-primary-800"
                          >
                            #{record.workOrder.orderNumber}
                          </Link>
                          <div className="text-xs text-gray-500">{record.workOrder.customerName}</div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <Badge variant="neutral">Awaiting order match</Badge>
                          <div className="text-xs text-gray-500">Not linked to a work order yet</div>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 align-top">
                      <div className="space-y-1">
                        <Badge variant="neutral">{formatServiceLabel(record.service)}</Badge>
                        {statusLabel ? (
                          <div className="text-xs text-gray-700">
                            Status: {statusLabel}
                            {record.latestStatusCode ? ` (${record.latestStatusCode})` : ''}
                          </div>
                        ) : issue ? (
                          <div className="text-xs text-amber-700">Status not available</div>
                        ) : (
                          <div className="text-xs text-gray-400">Status not available</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 align-top">
                      <div className="space-y-1 text-sm text-gray-700">
                        <div>{logDateLabel}</div>
                        {record.eventTimestamp && (
                          <div className="text-xs text-gray-500">{formatDateTime(record.eventTimestamp)}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 align-top text-right">
                      {record.trackingNumber ? (
                        <a
                          href={getTrackingUrl(record.trackingNumber)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-medium text-primary-600 hover:text-primary-800"
                        >
                          Open FedEx tracking
                        </a>
                      ) : (
                        <span className="text-sm text-gray-400">Tracking unavailable</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pagination.totalPages > 1 && (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={setPage}
        />
      )}
    </section>
  );
}
