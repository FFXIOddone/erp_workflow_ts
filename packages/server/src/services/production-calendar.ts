import { inferRoutingFromOrderDetails, PrintingMethod } from '@erp/shared';

export type ProductionCalendarStation = 'DESIGN' | 'PRINTING' | 'PRODUCTION' | 'SHIPPING';
export type ProductionCalendarStatus = 'WAITING' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE';

export interface ProductionCalendarWorkOrderSummary {
  id: string;
  orderNumber: string;
  customerName: string;
  description: string | null;
  status: string;
  dueDate: Date | null;
  createdAt: Date;
  priority: number;
}

export interface ProductionCalendarEntry {
  id: string;
  workOrderId: string;
  station: ProductionCalendarStation;
  stationLabel: string;
  scheduledDate: Date;
  scheduledStartDate: Date | null;
  estimatedHours: number;
  status: ProductionCalendarStatus;
  priority: number;
  notes: string | null;
  blockedBy: ProductionCalendarStation | null;
  progressPercent: number;
  completedCount: number;
  totalCount: number;
  workOrder: ProductionCalendarWorkOrderSummary;
}

export interface ProductionCalendarView {
  stations: Array<{ key: ProductionCalendarStation; label: string }>;
  slots: ProductionCalendarEntry[];
  groupedByDate: Record<string, ProductionCalendarEntry[]>;
  summary: {
    activeOrders: number;
    totalEntries: number;
    overdueEntries: number;
    stationCounts: Record<ProductionCalendarStation, number>;
  };
}

interface WorkOrderCalendarRow {
  id: string;
  orderNumber: string;
  customerName: string;
  description: string | null;
  status: string;
  priority: number;
  dueDate: Date | null;
  createdAt: Date;
  notes: string | null;
  routing: string[];
  stationProgress: Array<{
    station: string;
    status: string;
    startedAt: Date | null;
    completedAt: Date | null;
  }>;
  shipments: Array<{
    shipDate: Date;
    actualDelivery: Date | null;
    status: string;
  }>;
}

const CALENDAR_STATIONS: Array<{ key: ProductionCalendarStation; label: string }> = [
  { key: 'DESIGN', label: 'Design' },
  { key: 'PRINTING', label: 'Printing' },
  { key: 'PRODUCTION', label: 'Production' },
  { key: 'SHIPPING', label: 'Shipping' },
];

const STAGE_ORDER: ProductionCalendarStation[] = ['DESIGN', 'PRINTING', 'PRODUCTION', 'SHIPPING'];

const STAGE_DURATIONS: Record<ProductionCalendarStation, number> = {
  DESIGN: 2,
  PRINTING: 1,
  PRODUCTION: 1,
  SHIPPING: 1,
};

const DESIGN_STATIONS = new Set<string>([
  PrintingMethod.DESIGN_ONLY,
  PrintingMethod.DESIGN,
  PrintingMethod.DESIGN_PROOF,
  PrintingMethod.DESIGN_APPROVAL,
  PrintingMethod.DESIGN_PRINT_READY,
]);

const PRINTING_STATIONS = new Set<string>([
  PrintingMethod.FLATBED,
  PrintingMethod.FLATBED_PRINTING,
  PrintingMethod.ROLL_TO_ROLL,
  PrintingMethod.ROLL_TO_ROLL_PRINTING,
  PrintingMethod.SCREEN_PRINT,
  PrintingMethod.SCREEN_PRINT_PRINTING,
  PrintingMethod.SCREEN_PRINT_ASSEMBLY,
]);

const PRODUCTION_STATIONS = new Set<string>([
  PrintingMethod.PRODUCTION,
  PrintingMethod.PRODUCTION_ZUND,
  PrintingMethod.PRODUCTION_FINISHING,
]);

const SHIPPING_STATIONS = new Set<string>([
  PrintingMethod.SHIPPING_RECEIVING,
  PrintingMethod.SHIPPING_QC,
  PrintingMethod.SHIPPING_PACKAGING,
  PrintingMethod.SHIPPING_SHIPMENT,
  PrintingMethod.SHIPPING_INSTALL_READY,
  PrintingMethod.INSTALLATION,
  PrintingMethod.INSTALLATION_REMOTE,
  PrintingMethod.INSTALLATION_INHOUSE,
]);

const ACTIVE_ORDER_STATUSES = new Set(['PENDING', 'IN_PROGRESS', 'ON_HOLD']);
const ARCHIVED_ORDER_STATUSES = new Set(['COMPLETED', 'SHIPPED', 'CANCELLED']);

function cloneDate(value: Date): Date {
  return new Date(value.getTime());
}

function normalizeDate(value: Date): Date {
  const result = cloneDate(value);
  result.setHours(0, 0, 0, 0);
  return result;
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function addBusinessDays(date: Date, days: number): Date {
  const result = normalizeDate(date);
  let remaining = Math.max(0, Math.floor(days));

  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    if (!isWeekend(result)) {
      remaining -= 1;
    }
  }

  return result;
}

export function subtractBusinessDays(date: Date, days: number): Date {
  const result = normalizeDate(date);
  let remaining = Math.max(0, Math.floor(days));

  while (remaining > 0) {
    result.setDate(result.getDate() - 1);
    if (!isWeekend(result)) {
      remaining -= 1;
    }
  }

  return result;
}

function toIsoDateKey(date: Date): string {
  return normalizeDate(date).toISOString().split('T')[0]!;
}

function latestDate(dates: Array<Date | null | undefined>): Date | null {
  let latest: Date | null = null;
  for (const date of dates) {
    if (!date) continue;
    if (!latest || date.getTime() > latest.getTime()) {
      latest = date;
    }
  }
  return latest;
}

function getPlanningRouting(order: WorkOrderCalendarRow): string[] {
  const explicitRouting = (order.routing ?? []).filter((station) => station && station !== PrintingMethod.ORDER_ENTRY);
  const inferredRouting = inferRoutingFromOrderDetails({
    description: order.description,
    notes: order.notes,
    routing: order.routing as readonly (PrintingMethod | string)[] | null,
  }).map((station) => String(station));

  if (explicitRouting.length > 0) {
    return explicitRouting;
  }

  return inferredRouting.length > 0 ? inferredRouting : [PrintingMethod.DESIGN_ONLY];
}

function getStageSequence(planningRouting: string[], shipmentExists: boolean): ProductionCalendarStation[] {
  const stages: ProductionCalendarStation[] = ['DESIGN'];

  if (planningRouting.some((station) => PRINTING_STATIONS.has(station))) {
    stages.push('PRINTING');
  }

  if (planningRouting.some((station) => PRODUCTION_STATIONS.has(station)) || stages.includes('PRINTING')) {
    if (!stages.includes('PRINTING') && planningRouting.some((station) => PRODUCTION_STATIONS.has(station))) {
      stages.push('PRINTING');
    }
    stages.push('PRODUCTION');
  }

  if (
    shipmentExists ||
    planningRouting.some((station) => SHIPPING_STATIONS.has(station)) ||
    stages.includes('PRINTING') ||
    stages.includes('PRODUCTION')
  ) {
    stages.push('SHIPPING');
  }

  return stages;
}

function getRelevantStations(stage: ProductionCalendarStation, planningRouting: string[]): string[] {
  const sourceStations =
    stage === 'DESIGN'
      ? Array.from(DESIGN_STATIONS)
      : stage === 'PRINTING'
        ? Array.from(PRINTING_STATIONS)
        : stage === 'PRODUCTION'
          ? Array.from(PRODUCTION_STATIONS)
          : Array.from(SHIPPING_STATIONS);

  const matching = sourceStations.filter((station) => planningRouting.includes(station));

  if (matching.length > 0) {
    return matching;
  }

  if (stage === 'DESIGN') {
    return [PrintingMethod.DESIGN];
  }

  return sourceStations;
}

function getStageStatus(params: {
  stage: ProductionCalendarStation;
  relevantStations: string[];
  order: WorkOrderCalendarRow;
  previousStageComplete: boolean;
  scheduledDate: Date;
  today: Date;
}): { status: ProductionCalendarStatus; progressPercent: number; completedCount: number; totalCount: number; completedAt: Date | null } {
  const { stage, relevantStations, order, previousStageComplete, scheduledDate, today } = params;
  const stageRows = order.stationProgress.filter((row) => relevantStations.includes(row.station));
  const totalCount = Math.max(relevantStations.length, 1);
  const completedRows = stageRows.filter((row) => row.status === 'COMPLETED');
  const inProgressRows = stageRows.filter((row) => row.status === 'IN_PROGRESS');
  const completedCount = completedRows.length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);
  const completedAt = latestDate(completedRows.map((row) => row.completedAt));

  if (completedCount >= totalCount && totalCount > 0) {
    return { status: 'COMPLETED', progressPercent: 100, completedCount, totalCount, completedAt };
  }

  if (inProgressRows.length > 0) {
    return { status: 'IN_PROGRESS', progressPercent, completedCount, totalCount, completedAt };
  }

  if (!previousStageComplete && stage !== 'DESIGN') {
    return { status: 'WAITING', progressPercent, completedCount, totalCount, completedAt };
  }

  if (scheduledDate.getTime() < today.getTime()) {
    return { status: 'OVERDUE', progressPercent, completedCount, totalCount, completedAt };
  }

  return { status: 'SCHEDULED', progressPercent, completedCount, totalCount, completedAt };
}

function countStageCounts(entries: ProductionCalendarEntry[]): Record<ProductionCalendarStation, number> {
  return entries.reduce(
    (acc, entry) => {
      acc[entry.station] += 1;
      return acc;
    },
    {
      DESIGN: 0,
      PRINTING: 0,
      PRODUCTION: 0,
      SHIPPING: 0,
    },
  );
}

export async function buildProductionCalendarView(
  orders: WorkOrderCalendarRow[],
  range: { startDate: Date; endDate: Date },
  station?: ProductionCalendarStation,
): Promise<ProductionCalendarView> {
  const today = normalizeDate(new Date());
  const startDate = normalizeDate(range.startDate);
  const endDate = normalizeDate(range.endDate);

  const slots: ProductionCalendarEntry[] = [];

  for (const order of orders) {
    if (ARCHIVED_ORDER_STATUSES.has(order.status) || !ACTIVE_ORDER_STATUSES.has(order.status)) {
      continue;
    }

    const shipment = [...order.shipments].sort((a, b) => b.shipDate.getTime() - a.shipDate.getTime())[0] ?? null;
    if (shipment?.actualDelivery) {
      continue;
    }

    const planningRouting = getPlanningRouting(order);
    const shipmentExists = Boolean(shipment);
    const stageSequence = getStageSequence(planningRouting, shipmentExists);
    const totalDuration = stageSequence.reduce((sum, stage) => sum + STAGE_DURATIONS[stage], 0);
    const fallbackFinalDate =
      stageSequence.length === 1 && stageSequence[0] === 'DESIGN'
        ? addBusinessDays(order.createdAt, 2)
        : addBusinessDays(order.createdAt, totalDuration);
    const finalAnchor = normalizeDate(shipment?.shipDate ?? order.dueDate ?? fallbackFinalDate);

    const stageDates = new Map<ProductionCalendarStation, { startDate: Date; endDate: Date }>();
    let currentEnd = cloneDate(finalAnchor);

    for (const stage of [...stageSequence].reverse()) {
      const duration = STAGE_DURATIONS[stage];
      const stageEnd = cloneDate(currentEnd);
      const stageStart = subtractBusinessDays(stageEnd, Math.max(0, duration - 1));
      stageDates.set(stage, { startDate: stageStart, endDate: stageEnd });
      currentEnd = subtractBusinessDays(stageStart, 1);
    }

    const stagesToRender = stageSequence.filter((stage) => {
      if (stage === 'DESIGN') return true;
      if (stage === 'PRINTING') return planningRouting.some((station) => PRINTING_STATIONS.has(station));
      if (stage === 'PRODUCTION') return planningRouting.some((station) => PRODUCTION_STATIONS.has(station)) || stageSequence.includes('PRINTING');
      return shipmentExists || planningRouting.some((station) => SHIPPING_STATIONS.has(station)) || stageSequence.includes('PRINTING') || stageSequence.includes('PRODUCTION');
    });

    let previousStageComplete = true;

    for (const stage of stagesToRender) {
      const stageWindow = stageDates.get(stage);
      if (!stageWindow) continue;

      const relevantStations = getRelevantStations(stage, planningRouting);
      const stageProgress = getStageStatus({
        stage,
        relevantStations,
        order,
        previousStageComplete,
        scheduledDate: stageWindow.endDate,
        today,
      });

      const entry: ProductionCalendarEntry = {
        id: `${order.id}:${stage}`,
        workOrderId: order.id,
        station: stage,
        stationLabel:
          stage === 'DESIGN'
            ? 'Design'
            : stage === 'PRINTING'
              ? 'Printing'
              : stage === 'PRODUCTION'
                ? 'Production'
                : 'Shipping',
        scheduledDate: stageWindow.endDate,
        scheduledStartDate: stageWindow.startDate,
        estimatedHours: STAGE_DURATIONS[stage] * 8,
        status: stageProgress.status,
        priority: order.priority,
        notes: order.notes,
        blockedBy: previousStageComplete ? null : STAGE_ORDER[STAGE_ORDER.indexOf(stage) - 1] ?? null,
        progressPercent: stageProgress.progressPercent,
        completedCount: stageProgress.completedCount,
        totalCount: stageProgress.totalCount,
        workOrder: {
          id: order.id,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          description: order.description || null,
          status: order.status,
          dueDate: order.dueDate,
          createdAt: order.createdAt,
          priority: order.priority,
        },
      };

      if (entry.scheduledDate < startDate || entry.scheduledDate > endDate) {
        previousStageComplete = stageProgress.status === 'COMPLETED';
        continue;
      }

      if (station && station !== stage) {
        previousStageComplete = stageProgress.status === 'COMPLETED';
        continue;
      }

      slots.push(entry);
      previousStageComplete = stageProgress.status === 'COMPLETED';
    }
  }

  slots.sort((a, b) => {
    const dateCmp = a.scheduledDate.getTime() - b.scheduledDate.getTime();
    if (dateCmp !== 0) return dateCmp;
    if (a.priority !== b.priority) return b.priority - a.priority;
    return a.workOrder.orderNumber.localeCompare(b.workOrder.orderNumber);
  });

  const groupedByDate: Record<string, ProductionCalendarEntry[]> = {};
  for (const entry of slots) {
    const key = toIsoDateKey(entry.scheduledDate);
    groupedByDate[key] ??= [];
    groupedByDate[key].push(entry);
  }

  return {
    stations: CALENDAR_STATIONS,
    slots,
    groupedByDate,
    summary: {
      activeOrders: new Set(slots.map((entry) => entry.workOrderId)).size,
      totalEntries: slots.length,
      overdueEntries: slots.filter((entry) => entry.status === 'OVERDUE').length,
      stationCounts: countStageCounts(slots),
    },
  };
}

export type { WorkOrderCalendarRow };
