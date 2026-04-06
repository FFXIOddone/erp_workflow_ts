import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
} from 'lucide-react';
import { api } from '../lib/api';

type CalendarLane = 'DESIGN' | 'PRINTING' | 'PRODUCTION' | 'SHIPPING';
type CalendarStatus = 'WAITING' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE';

interface CalendarWorkOrderSummary {
  id: string;
  orderNumber: string;
  customerName: string;
  description: string | null;
  status: string;
  dueDate: string | null;
  createdAt: string;
  priority: number;
}

interface CalendarEntry {
  id: string;
  workOrderId: string;
  station: CalendarLane;
  stationLabel: string;
  scheduledDate: string;
  scheduledStartDate: string | null;
  estimatedHours: number;
  status: CalendarStatus;
  priority: number;
  notes: string | null;
  blockedBy: CalendarLane | null;
  progressPercent: number;
  completedCount: number;
  totalCount: number;
  workOrder: CalendarWorkOrderSummary;
}

interface CalendarView {
  stations: Array<{ key: CalendarLane; label: string }>;
  slots: CalendarEntry[];
  groupedByDate: Record<string, CalendarEntry[]>;
  summary: {
    activeOrders: number;
    totalEntries: number;
    overdueEntries: number;
    stationCounts: Record<CalendarLane, number>;
  };
}

type ViewMode = 'week' | 'day';

const LANE_ORDER: CalendarLane[] = ['DESIGN', 'PRINTING', 'PRODUCTION', 'SHIPPING'];

const LANE_META: Record<
  CalendarLane,
  {
    label: string;
    description: string;
    accent: string;
    dot: string;
    card: string;
  }
> = {
  DESIGN: {
    label: 'Design',
    description: 'Two-business-day planning window from the order ship date.',
    accent: 'text-sky-700',
    dot: 'bg-sky-500',
    card: 'border-sky-200 bg-sky-50/40',
  },
  PRINTING: {
    label: 'Printing',
    description: 'Starts after design is complete and print-ready.',
    accent: 'text-orange-700',
    dot: 'bg-orange-500',
    card: 'border-orange-200 bg-orange-50/40',
  },
  PRODUCTION: {
    label: 'Production',
    description: 'Runs after printing and precedes shipping.',
    accent: 'text-violet-700',
    dot: 'bg-violet-500',
    card: 'border-violet-200 bg-violet-50/40',
  },
  SHIPPING: {
    label: 'Shipping',
    description: 'Final lane. Orders drop off once shipped or complete.',
    accent: 'text-emerald-700',
    dot: 'bg-emerald-500',
    card: 'border-emerald-200 bg-emerald-50/40',
  },
};

const STATUS_META: Record<
  CalendarStatus,
  {
    label: string;
    className: string;
    icon: typeof CheckCircle2 | typeof AlertTriangle | typeof Clock;
  }
> = {
  WAITING: {
    label: 'Waiting',
    className: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: Clock,
  },
  SCHEDULED: {
    label: 'Scheduled',
    className: 'bg-sky-100 text-sky-700 border-sky-200',
    icon: Calendar,
  },
  IN_PROGRESS: {
    label: 'In Progress',
    className: 'bg-amber-100 text-amber-700 border-amber-200',
    icon: Clock,
  },
  COMPLETED: {
    label: 'Completed',
    className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    icon: CheckCircle2,
  },
  OVERDUE: {
    label: 'Overdue',
    className: 'bg-rose-100 text-rose-700 border-rose-200',
    icon: AlertTriangle,
  },
};

const EMPTY_VIEW: CalendarView = {
  stations: LANE_ORDER.map((key) => ({ key, label: LANE_META[key].label })),
  slots: [],
  groupedByDate: {},
  summary: {
    activeOrders: 0,
    totalEntries: 0,
    overdueEntries: 0,
    stationCounts: {
      DESIGN: 0,
      PRINTING: 0,
      PRODUCTION: 0,
      SHIPPING: 0,
    },
  },
};

function formatDateKey(date: Date): string {
  return date.toISOString().split('T')[0] ?? '';
}

function formatHeaderDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatTimeLabel(value: string): string {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function formatRangeLabel(start: Date, end: Date): string {
  if (start.toDateString() === end.toDateString()) {
    return start.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }

  return `${start.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })} - ${end.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`;
}

function sortEntries(entries: CalendarEntry[]): CalendarEntry[] {
  const statusRank: Record<CalendarStatus, number> = {
    OVERDUE: 0,
    IN_PROGRESS: 1,
    SCHEDULED: 2,
    WAITING: 3,
    COMPLETED: 4,
  };

  return [...entries].sort((left, right) => {
    const statusCmp = statusRank[left.status] - statusRank[right.status];
    if (statusCmp !== 0) return statusCmp;
    if (left.priority !== right.priority) return right.priority - left.priority;
    return left.workOrder.orderNumber.localeCompare(right.workOrder.orderNumber);
  });
}

export function ProductionCalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('week');

  const dateRange = useMemo(() => {
    const start = new Date(currentDate);
    const end = new Date(currentDate);

    if (viewMode === 'week') {
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1);
      start.setDate(diff);
      start.setHours(0, 0, 0, 0);

      end.setTime(start.getTime());
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    }

    return { start, end };
  }, [currentDate, viewMode]);

  const calendarQuery = useQuery({
    queryKey: ['scheduling', 'calendar', dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: async () => {
      const response = await api.get('/scheduling/calendar', {
        params: {
          startDate: dateRange.start.toISOString(),
          endDate: dateRange.end.toISOString(),
        },
      });

      const payload = response.data?.data as CalendarView | undefined;
      return payload ?? EMPTY_VIEW;
    },
  });

  const calendar = calendarQuery.data ?? EMPTY_VIEW;

  const days = useMemo(() => {
    const result: Date[] = [];
    const current = new Date(dateRange.start);

    while (current <= dateRange.end) {
      result.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return result;
  }, [dateRange]);

  const entriesByLaneAndDate = useMemo(() => {
    const grouped = Object.fromEntries(
      LANE_ORDER.map((lane) => [lane, {} as Record<string, CalendarEntry[]>]),
    ) as Record<CalendarLane, Record<string, CalendarEntry[]>>;

    for (const entry of calendar.slots) {
      if (!grouped[entry.station]) continue;
      const dateKey = entry.scheduledDate.slice(0, 10);
      grouped[entry.station][dateKey] ??= [];
      grouped[entry.station][dateKey].push(entry);
    }

    for (const lane of LANE_ORDER) {
      for (const dateKey of Object.keys(grouped[lane])) {
        grouped[lane][dateKey] = sortEntries(grouped[lane][dateKey] ?? []);
      }
    }

    return grouped;
  }, [calendar.slots]);

  const navigatePrev = () => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() - (viewMode === 'week' ? 7 : 1));
    setCurrentDate(next);
  };

  const navigateNext = () => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + (viewMode === 'week' ? 7 : 1));
    setCurrentDate(next);
  };

  const goToToday = () => setCurrentDate(new Date());

  const isToday = (date: Date) => date.toDateString() === new Date().toDateString();
  const isPast = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const renderEntryCard = (entry: CalendarEntry) => {
    const statusMeta = STATUS_META[entry.status];
    const StatusIcon = statusMeta.icon;

    return (
      <Link
        key={entry.id}
        to={`/orders/${entry.workOrderId}`}
        className={`block rounded-lg border p-3 shadow-sm transition-colors hover:shadow-md ${LANE_META[entry.station].card}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-gray-900">{entry.workOrder.orderNumber}</div>
            <div className="truncate text-[11px] text-gray-600">{entry.workOrder.customerName}</div>
          </div>
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusMeta.className}`}>
            <StatusIcon className="h-3 w-3" />
            {statusMeta.label}
          </span>
        </div>

        {entry.workOrder.description && (
          <div className="mt-2 line-clamp-2 text-[11px] leading-snug text-gray-600">
            {entry.workOrder.description}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between gap-2 text-[10px] text-gray-500">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatTimeLabel(entry.scheduledDate)}
          </span>
          <span>{entry.progressPercent}% complete</span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-gray-500">
          <span>{entry.estimatedHours}h planned</span>
          {entry.blockedBy && entry.status === 'WAITING' && (
            <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] text-gray-600">
              Waiting on {LANE_META[entry.blockedBy].label}
            </span>
          )}
        </div>
      </Link>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary-600" />
            <h1 className="text-2xl font-bold text-gray-900 lg:text-3xl">Production Calendar</h1>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">
            Auto-planned from order ship dates, station progress, and completed prerequisites. Completed or shipped orders are removed from the calendar automatically.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white px-3 py-2">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">Active Orders</div>
            <div className="mt-1 text-xl font-semibold text-gray-900">{calendar.summary.activeOrders}</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-3 py-2">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">Scheduled Entries</div>
            <div className="mt-1 text-xl font-semibold text-gray-900">{calendar.summary.totalEntries}</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-3 py-2">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">Overdue</div>
            <div className="mt-1 text-xl font-semibold text-rose-700">{calendar.summary.overdueEntries}</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-3 py-2">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">Range</div>
            <div className="mt-1 text-sm font-semibold text-gray-900">{formatRangeLabel(dateRange.start, dateRange.end)}</div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <button onClick={navigatePrev} className="rounded-lg border border-gray-200 p-2 transition-colors hover:bg-gray-50" type="button">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button onClick={goToToday} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium transition-colors hover:bg-gray-50" type="button">
            Today
          </button>
          <button onClick={navigateNext} className="rounded-lg border border-gray-200 p-2 transition-colors hover:bg-gray-50" type="button">
            <ChevronRight className="h-5 w-5" />
          </button>
          <span className="ml-2 text-lg font-semibold text-gray-900">{formatRangeLabel(dateRange.start, dateRange.end)}</span>
        </div>

        <div className="inline-flex rounded-lg bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => setViewMode('day')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              viewMode === 'day' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Day
          </button>
          <button
            type="button"
            onClick={() => setViewMode('week')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              viewMode === 'week' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Week
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {calendarQuery.isLoading ? (
          <div className="space-y-4 p-6">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="animate-pulse rounded-xl border border-gray-100 bg-gray-50 p-4">
                <div className="h-5 w-32 rounded bg-gray-200" />
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
                  {Array.from({ length: Math.min(days.length || 4, 4) }).map((__, cellIndex) => (
                    <div key={cellIndex} className="h-28 rounded-lg bg-white" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 w-64 border-b border-gray-200 bg-gray-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Station
                  </th>
                  {days.map((day) => (
                    <th
                      key={day.toISOString()}
                      className={`min-w-[220px] border-b border-gray-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide ${
                        isToday(day) ? 'bg-sky-50 text-sky-700' : 'bg-gray-50 text-gray-500'
                      }`}
                    >
                      {formatHeaderDate(day)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {LANE_ORDER.map((lane) => {
                  const meta = LANE_META[lane];
                  const laneCount = calendar.summary.stationCounts[lane] ?? 0;
                  const overdueLaneCount = calendar.slots.filter((entry) => entry.station === lane && entry.status === 'OVERDUE').length;

                  return (
                    <tr key={lane} className="align-top">
                      <td className="sticky left-0 z-10 border-b border-gray-100 bg-white px-4 py-4">
                        <div className={`rounded-xl border p-4 ${meta.card}`}>
                          <div className="flex items-center gap-3">
                            <span className={`h-3 w-3 rounded-full ${meta.dot}`} />
                            <div>
                              <div className={`text-sm font-semibold ${meta.accent}`}>{meta.label}</div>
                              <div className="text-xs text-gray-500">{meta.description}</div>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-gray-600">
                            <span className="rounded-full bg-white px-2 py-0.5 shadow-sm">{laneCount} entries</span>
                            <span className="rounded-full bg-white px-2 py-0.5 shadow-sm">{overdueLaneCount} overdue</span>
                          </div>
                        </div>
                      </td>

                      {days.map((day) => {
                        const dateKey = formatDateKey(day);
                        const entries = entriesByLaneAndDate[lane][dateKey] ?? [];

                        return (
                          <td
                            key={dateKey}
                            className={`border-b border-gray-100 px-3 py-3 align-top ${isToday(day) ? 'bg-sky-50/30' : isPast(day) ? 'bg-gray-50/40' : 'bg-white'}`}
                          >
                            {entries.length === 0 ? (
                              <div className="flex min-h-36 items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white/70 px-3 py-6 text-center text-xs text-gray-400">
                                No scheduled orders
                              </div>
                            ) : (
                              <div className="space-y-3">{entries.map(renderEntryCard)}</div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {LANE_ORDER.map((lane) => {
          const meta = LANE_META[lane];
          const laneEntries = calendar.slots.filter((entry) => entry.station === lane);
          const completedCount = laneEntries.filter((entry) => entry.status === 'COMPLETED').length;
          const overdueCount = laneEntries.filter((entry) => entry.status === 'OVERDUE').length;

          return (
            <div key={lane} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className={`text-sm font-semibold ${meta.accent}`}>{meta.label}</div>
                  <div className="text-xs text-gray-500">Derived from order ship dates and station progress</div>
                </div>
                <span className={`h-3 w-3 rounded-full ${meta.dot}`} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-gray-50 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-gray-500">Total</div>
                  <div className="mt-1 text-lg font-semibold text-gray-900">{laneEntries.length}</div>
                </div>
                <div className="rounded-xl bg-gray-50 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-gray-500">Done</div>
                  <div className="mt-1 text-lg font-semibold text-emerald-700">{completedCount}</div>
                </div>
                <div className="rounded-xl bg-gray-50 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-gray-500">Overdue</div>
                  <div className="mt-1 text-lg font-semibold text-rose-700">{overdueCount}</div>
                </div>
                <div className="rounded-xl bg-gray-50 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-gray-500">Next</div>
                  <div className="mt-1 text-sm font-semibold text-gray-900">
                    {laneEntries[0] ? formatTimeLabel(laneEntries[0].scheduledDate) : 'None'}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
