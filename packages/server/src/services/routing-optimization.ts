import {
  DecisionMaker,
  DecisionOutcome,
  EquipmentStatus,
  PredictionModelType,
  PrintingMethod,
  RoutingDecisionType,
  RoutingTrigger,
  inferRoutingFromOrderDetails,
  type AlternativeRoute,
  type OptimizationRule,
  type PredictionFactorWeights,
  type RoutingFactorsConsidered,
  type RoutingExplanationFactor,
  type RoutingOverrideInput,
  type RoutingSuggestion,
  type WorkOrder,
} from '@erp/shared';
import type { Prisma, PrismaClient } from '@prisma/client';
import { applyRoutingDefaults, inferRoutingSource, type RoutingSource } from '../lib/routing-defaults.js';

export type RoutingStationIntelligence = {
  station: PrintingMethod;
  currentQueueDepth: number;
  currentWaitTime: number;
  activeJobs: number;
  activeOperators: number;
  equipmentStatus: EquipmentStatus;
  utilizationPct: number;
  operatorAvailability?: number | null;
  avgJobDuration?: number | null;
  avgSetupTime?: number | null;
  avgQualityScore?: number | null;
  throughputPerHour?: number | null;
  isBottleneck?: boolean;
  bottleneckReason?: string | null;
};

export type RoutingOptimizationRule = Pick<
  OptimizationRule,
  | 'code'
  | 'name'
  | 'description'
  | 'ruleType'
  | 'conditions'
  | 'actions'
  | 'weight'
  | 'priority'
  | 'isActive'
  | 'appliesTo'
>;

export interface RoutingOptimizationContext {
  workOrder: Pick<WorkOrder, 'id' | 'orderNumber' | 'description' | 'priority' | 'dueDate' | 'notes' | 'routing'>;
  stationIntelligence?: readonly RoutingStationIntelligence[];
  optimizationRules?: readonly RoutingOptimizationRule[];
  currentRoute?: readonly PrintingMethod[];
  candidateRoutes?: readonly (readonly PrintingMethod[])[];
  preferredStations?: readonly PrintingMethod[];
  excludedStations?: readonly PrintingMethod[];
  mustIncludeStations?: readonly PrintingMethod[];
  source?: RoutingSource;
  now?: Date;
}

interface ScoredRoute {
  route: PrintingMethod[];
  score: number;
  estimatedDuration: number;
  reasoning: string[];
  warnings: string[];
  explanationFactors: RoutingExplanationFactor[];
  appliedRuleCodes: string[];
}

export interface RoutingOptimizationResult {
  suggestion: RoutingSuggestion;
  rankedRoutes: ScoredRoute[];
}

export interface RoutingPredictionData {
  workOrderId: string | null;
  jobType: string | null;
  customerSegment: string | null;
  priorityLevel: number;
  estimatedArea: number | null;
  predictedRoute: string[];
  confidence: number;
  alternativeRoutes: AlternativeRoute[] | null;
  factorWeights: PredictionFactorWeights | null;
  estimatedDuration: number | null;
  estimatedPerStation: Record<string, number> | null;
  actualRoute: string[];
  actualDuration: number | null;
  wasAccepted: boolean | null;
  feedbackScore: number | null;
  feedbackNotes: string | null;
  modelVersion: string;
  modelType: PredictionModelType;
}

export interface RoutingDecisionData {
  workOrderId: string;
  decisionType: RoutingDecisionType;
  previousRoute: string[];
  newRoute: string[];
  trigger: RoutingTrigger;
  triggerReason: string | null;
  factorsConsidered: RoutingFactorsConsidered | null;
  rulesApplied: string[];
  predictionId: string | null;
  predictionScore: number | null;
  decisionMaker: DecisionMaker;
  userId: string | null;
  outcomeStatus: DecisionOutcome | null;
  outcomeNotes: string | null;
  actualDuration: number | null;
}

export type RoutingWriteClient = Pick<PrismaClient, 'routingPrediction' | 'routingDecision'>;

export interface RoutingPersistenceClient extends RoutingWriteClient {
  $transaction?: PrismaClient['$transaction'];
}

export interface RoutingOverrideRecordOptions {
  predictionId?: string | null;
  userId?: string | null;
  currentRoute?: readonly PrintingMethod[] | null;
  completedStations?: readonly PrintingMethod[] | null;
  trigger?: RoutingTrigger;
  outcomeStatus?: DecisionOutcome | null;
}

export interface RoutingOutcomeRecordOptions {
  actualDuration?: number | null;
  feedbackScore?: number | null;
  feedbackNotes?: string | null;
}

const ROUTING_MODEL_VERSION = 'routing-optimization-v1';

const DEFAULT_PREDICTION_FACTOR_WEIGHTS: PredictionFactorWeights = {
  queueDepth: 0.25,
  operatorSkill: 0.15,
  equipmentStatus: 0.2,
  materialMatch: 0.1,
  deadline: 0.2,
  qualityHistory: 0.05,
  setupTime: 0.05,
};

const BASE_SCORE = 70;
const DEFAULT_ROUTE_STATION = PrintingMethod.ORDER_ENTRY;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const EQUIPMENT_STATUS_SCORE_PENALTY: Record<EquipmentStatus, number> = {
  [EquipmentStatus.OPERATIONAL]: 0,
  [EquipmentStatus.DEGRADED]: 6,
  [EquipmentStatus.MAINTENANCE]: 14,
  [EquipmentStatus.DOWN]: 32,
  [EquipmentStatus.WARMING_UP]: 10,
  [EquipmentStatus.OFFLINE]: 40,
  [EquipmentStatus.RETIRED]: 50,
};

const EQUIPMENT_STATUS_DURATION_PENALTY: Record<EquipmentStatus, number> = {
  [EquipmentStatus.OPERATIONAL]: 0,
  [EquipmentStatus.DEGRADED]: 4,
  [EquipmentStatus.MAINTENANCE]: 12,
  [EquipmentStatus.DOWN]: 24,
  [EquipmentStatus.WARMING_UP]: 8,
  [EquipmentStatus.OFFLINE]: 28,
  [EquipmentStatus.RETIRED]: 30,
};

const DEFAULT_STATION_DURATIONS: Partial<Record<PrintingMethod, number>> = {
  [PrintingMethod.SALES]: 10,
  [PrintingMethod.DESIGN_ONLY]: 8,
  [PrintingMethod.ORDER_ENTRY]: 18,
  [PrintingMethod.DESIGN]: 42,
  [PrintingMethod.DESIGN_PROOF]: 12,
  [PrintingMethod.DESIGN_APPROVAL]: 8,
  [PrintingMethod.DESIGN_PRINT_READY]: 15,
  [PrintingMethod.FLATBED]: 55,
  [PrintingMethod.FLATBED_PRINTING]: 85,
  [PrintingMethod.ROLL_TO_ROLL]: 50,
  [PrintingMethod.ROLL_TO_ROLL_PRINTING]: 80,
  [PrintingMethod.SCREEN_PRINT]: 60,
  [PrintingMethod.SCREEN_PRINT_PRINTING]: 75,
  [PrintingMethod.SCREEN_PRINT_ASSEMBLY]: 30,
  [PrintingMethod.PRODUCTION]: 40,
  [PrintingMethod.PRODUCTION_ZUND]: 45,
  [PrintingMethod.PRODUCTION_FINISHING]: 28,
  [PrintingMethod.SHIPPING_RECEIVING]: 18,
  [PrintingMethod.SHIPPING_QC]: 14,
  [PrintingMethod.SHIPPING_PACKAGING]: 20,
  [PrintingMethod.SHIPPING_SHIPMENT]: 12,
  [PrintingMethod.SHIPPING_INSTALL_READY]: 15,
  [PrintingMethod.INSTALLATION]: 110,
  [PrintingMethod.INSTALLATION_REMOTE]: 85,
  [PrintingMethod.INSTALLATION_INHOUSE]: 130,
  [PrintingMethod.COMPLETE]: 6,
  [PrintingMethod.COMPLETE_INSTALLED]: 6,
  [PrintingMethod.COMPLETE_SHIPPED]: 6,
  [PrintingMethod.COMPLETE_DESIGN_ONLY]: 6,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeRoute(route: readonly PrintingMethod[] | undefined | null): PrintingMethod[] {
  const normalized: PrintingMethod[] = [];
  const seen = new Set<PrintingMethod>();

  for (const station of route ?? []) {
    if (!station || seen.has(station)) {
      continue;
    }
    seen.add(station);
    normalized.push(station);
  }

  return normalized;
}

function coercePrintingMethodRoute(
  route: readonly (PrintingMethod | string)[] | undefined | null
): PrintingMethod[] {
  return normalizeRoute((route ?? []) as readonly PrintingMethod[]);
}

function fingerprintRoute(route: readonly PrintingMethod[]): string {
  return route.join('>');
}

function routesMatch(left: readonly PrintingMethod[], right: readonly PrintingMethod[]): boolean {
  return left.length === right.length && left.every((station, index) => station === right[index]);
}

function applyRouteDefaults(
  route: readonly PrintingMethod[],
  description: string,
  source?: RoutingSource
): PrintingMethod[] {
  const baseRoute = route.length > 0 ? route : [DEFAULT_ROUTE_STATION];
  return applyRoutingDefaults([...baseRoute], { description, source });
}

function ensureRoute(
  route: readonly PrintingMethod[] | undefined | null,
  description: string,
  source?: RoutingSource
): PrintingMethod[] {
  const normalized = normalizeRoute(route);
  return applyRouteDefaults(normalized, description, source);
}

function prioritizeStations(
  route: readonly PrintingMethod[],
  preferredStations: readonly PrintingMethod[]
): PrintingMethod[] {
  if (preferredStations.length === 0) {
    return normalizeRoute(route);
  }

  const preferred = preferredStations.filter((station) => route.includes(station));
  if (preferred.length === 0) {
    return normalizeRoute(route);
  }

  const preferredSet = new Set(preferred);
  const remainder = route.filter((station) => !preferredSet.has(station));
  return normalizeRoute([...preferred, ...remainder]);
}

function removeStations(
  route: readonly PrintingMethod[],
  excludedStations: readonly PrintingMethod[]
): PrintingMethod[] {
  if (excludedStations.length === 0) {
    return normalizeRoute(route);
  }

  const excludedSet = new Set(excludedStations);
  return normalizeRoute(route.filter((station) => !excludedSet.has(station)));
}

function addStations(
  route: readonly PrintingMethod[],
  mustIncludeStations: readonly PrintingMethod[]
): PrintingMethod[] {
  if (mustIncludeStations.length === 0) {
    return normalizeRoute(route);
  }

  const next = [...route];
  for (const station of mustIncludeStations) {
    if (!next.includes(station)) {
      next.push(station);
    }
  }

  return normalizeRoute(next);
}

function getStationIntelligenceMap(
  stationIntelligence: readonly RoutingStationIntelligence[] | undefined
): Map<PrintingMethod, RoutingStationIntelligence> {
  const map = new Map<PrintingMethod, RoutingStationIntelligence>();
  for (const entry of stationIntelligence ?? []) {
    map.set(entry.station, entry);
  }
  return map;
}

function getDefaultStationDuration(station: PrintingMethod): number {
  return DEFAULT_STATION_DURATIONS[station] ?? 30;
}

function formatScoreImpact(impact: number): string {
  const sign = impact > 0 ? '+' : '';
  return `${sign}${roundToTwoDecimals(impact)}`;
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function buildReasoning(explanationFactors: RoutingExplanationFactor[]): string[] {
  return explanationFactors
    .filter((factor) => factor.scoreImpact !== 0)
    .sort((left, right) => Math.abs(right.scoreImpact) - Math.abs(left.scoreImpact))
    .slice(0, 4)
    .map((factor) => `${factor.label}: ${factor.description ?? formatScoreImpact(factor.scoreImpact)}`);
}

function formatStationList(stations: readonly PrintingMethod[]): string {
  return stations.join(', ');
}

function estimateUrgencyMultiplier(workOrder: RoutingOptimizationContext['workOrder'], now: Date): number {
  const priority = clamp(workOrder.priority, 1, 5);
  const basePriorityMultiplier = 0.012 * priority;

  if (!workOrder.dueDate) {
    return 0.02 + basePriorityMultiplier;
  }

  const daysUntilDue = (workOrder.dueDate.getTime() - now.getTime()) / MS_PER_DAY;
  if (daysUntilDue <= 0) {
    return 0.14 + basePriorityMultiplier;
  }
  if (daysUntilDue <= 1) {
    return 0.1 + basePriorityMultiplier;
  }
  if (daysUntilDue <= 3) {
    return 0.065 + basePriorityMultiplier;
  }
  if (daysUntilDue <= 7) {
    return 0.03 + basePriorityMultiplier;
  }

  return 0.015 + basePriorityMultiplier;
}

function buildDeadlineRisk(workOrder: RoutingOptimizationContext['workOrder'], now: Date): number {
  const priorityRisk = clamp(workOrder.priority, 1, 5) * 8;

  if (!workOrder.dueDate) {
    return roundToTwoDecimals(clamp(20 + priorityRisk * 0.5, 0, 100));
  }

  const daysUntilDue = (workOrder.dueDate.getTime() - now.getTime()) / MS_PER_DAY;

  if (daysUntilDue <= 0) {
    return 100;
  }
  if (daysUntilDue <= 1) {
    return roundToTwoDecimals(clamp(88 + priorityRisk, 0, 100));
  }
  if (daysUntilDue <= 3) {
    return roundToTwoDecimals(clamp(70 + priorityRisk, 0, 100));
  }
  if (daysUntilDue <= 7) {
    return roundToTwoDecimals(clamp(45 + priorityRisk * 0.75, 0, 100));
  }

  return roundToTwoDecimals(clamp(18 + priorityRisk * 0.5, 0, 100));
}

function buildRoutingFactorsConsidered(
  context: RoutingOptimizationContext,
  stationMap: Map<PrintingMethod, RoutingStationIntelligence>,
  now: Date
): RoutingFactorsConsidered {
  const queueDepths: Record<string, number> = {};
  const waitTimes: Record<string, number> = {};
  const operatorAvailability: Record<string, number> = {};
  const equipmentStatus: Record<string, EquipmentStatus> = {};
  const qualityScores: Record<string, number> = {};

  for (const [station, intel] of stationMap.entries()) {
    queueDepths[station] = intel.currentQueueDepth;
    waitTimes[station] = intel.currentWaitTime;
    operatorAvailability[station] = intel.operatorAvailability != null ? intel.operatorAvailability : intel.activeOperators;
    equipmentStatus[station] = intel.equipmentStatus;
    if (intel.avgQualityScore != null) {
      qualityScores[station] = intel.avgQualityScore;
    }
  }

  return {
    queueDepths,
    waitTimes,
    operatorAvailability,
    equipmentStatus,
    deadlineRisk: buildDeadlineRisk(context.workOrder, now),
    qualityScores,
  };
}

function inferRoutingTrigger(context: RoutingOptimizationContext, stationMap: Map<PrintingMethod, RoutingStationIntelligence>): RoutingTrigger {
  const stationIntelligence = [...stationMap.values()];

  if (stationIntelligence.some((station) => station.isBottleneck || station.currentQueueDepth >= 8)) {
    return RoutingTrigger.QUEUE_IMBALANCE;
  }

  if (stationIntelligence.some((station) => station.equipmentStatus !== EquipmentStatus.OPERATIONAL)) {
    return RoutingTrigger.EQUIPMENT_CHANGE;
  }

  const now = context.now ?? new Date();
  if (context.workOrder.dueDate) {
    const daysUntilDue = (context.workOrder.dueDate.getTime() - now.getTime()) / MS_PER_DAY;
    if (daysUntilDue <= 3) {
      return RoutingTrigger.DEADLINE_RISK;
    }
  }

  return RoutingTrigger.NEW_ORDER;
}

function resolveManualOverrideRoute(
  context: RoutingOptimizationContext,
  override: RoutingOverrideInput,
  completedStations?: readonly PrintingMethod[] | null,
  baseRoute?: readonly PrintingMethod[] | null
): PrintingMethod[] {
  const route = coercePrintingMethodRoute(override.newRoute);
  const preservedStations = override.preserveCompletedStations
    ? normalizeRoute(completedStations ?? [])
    : [];
  const merged = [...preservedStations.filter((station) => !route.includes(station)), ...route];
  const description = context.workOrder.description ?? '';
  const resolved = merged.length > 0 ? merged : normalizeRoute(baseRoute ?? []);
  return applyRouteDefaults(resolved, description);
}

function buildRoutingPredictionData(
  context: RoutingOptimizationContext,
  recommendation: RoutingOptimizationResult,
  overrides: Partial<RoutingPredictionData> = {}
): RoutingPredictionData {
  return {
    workOrderId: context.workOrder.id,
    jobType: overrides.jobType ?? null,
    customerSegment: overrides.customerSegment ?? null,
    priorityLevel: context.workOrder.priority,
    estimatedArea: overrides.estimatedArea ?? null,
    predictedRoute: recommendation.suggestion.suggestedRoute,
    confidence: recommendation.suggestion.confidence,
    alternativeRoutes: recommendation.suggestion.alternatives.length > 0 ? recommendation.suggestion.alternatives : null,
    factorWeights: overrides.factorWeights ?? DEFAULT_PREDICTION_FACTOR_WEIGHTS,
    estimatedDuration: recommendation.suggestion.estimatedDuration,
    estimatedPerStation: overrides.estimatedPerStation ?? null,
    actualRoute: overrides.actualRoute ? [...overrides.actualRoute] : [],
    actualDuration: overrides.actualDuration ?? null,
    wasAccepted: overrides.wasAccepted ?? null,
    feedbackScore: overrides.feedbackScore ?? null,
    feedbackNotes: overrides.feedbackNotes ?? null,
    modelVersion: overrides.modelVersion ?? ROUTING_MODEL_VERSION,
    modelType: overrides.modelType ?? PredictionModelType.RULE_BASED,
  };
}

export interface RoutingDecisionBuildOptions {
  decisionType?: RoutingDecisionType;
  trigger?: RoutingTrigger;
  triggerReason?: string | null;
  predictionId?: string | null;
  predictionScore?: number | null;
  decisionMaker?: DecisionMaker;
  userId?: string | null;
  outcomeStatus?: DecisionOutcome | null;
  outcomeNotes?: string | null;
  actualDuration?: number | null;
  rulesApplied?: string[];
  factorsConsidered?: RoutingFactorsConsidered | null;
  previousRoute?: readonly PrintingMethod[] | null;
  newRoute?: readonly PrintingMethod[] | null;
}

function buildRoutingDecisionData(
  context: RoutingOptimizationContext,
  options: RoutingDecisionBuildOptions
): RoutingDecisionData {
  const stationMap = getStationIntelligenceMap(context.stationIntelligence);
  const now = context.now ?? new Date();
  const previousRoute = coercePrintingMethodRoute(options.previousRoute ?? context.currentRoute ?? context.workOrder.routing);
  const newRoute = coercePrintingMethodRoute(options.newRoute ?? previousRoute);

  return {
    workOrderId: context.workOrder.id,
    decisionType: options.decisionType ?? RoutingDecisionType.OPTIMIZATION,
    previousRoute,
    newRoute,
    trigger: options.trigger ?? inferRoutingTrigger(context, stationMap),
    triggerReason: options.triggerReason ?? null,
    factorsConsidered: options.factorsConsidered ?? buildRoutingFactorsConsidered(context, stationMap, now),
    rulesApplied: options.rulesApplied ?? [],
    predictionId: options.predictionId ?? null,
    predictionScore: options.predictionScore ?? null,
    decisionMaker: options.decisionMaker ?? DecisionMaker.SYSTEM,
    userId: options.userId ?? null,
    outcomeStatus: options.outcomeStatus ?? DecisionOutcome.PENDING,
    outcomeNotes: options.outcomeNotes ?? null,
    actualDuration: options.actualDuration ?? null,
  };
}

function createRoutingPredictionRecord(db: RoutingWriteClient, data: RoutingPredictionData) {
  return db.routingPrediction.create({
    data: {
      workOrderId: data.workOrderId,
      jobType: data.jobType,
      customerSegment: data.customerSegment,
      priorityLevel: data.priorityLevel,
      estimatedArea: data.estimatedArea,
      predictedRoute: data.predictedRoute,
      confidence: data.confidence,
      alternativeRoutes: data.alternativeRoutes ? toJsonValue(data.alternativeRoutes) : undefined,
      factorWeights: data.factorWeights ? toJsonValue(data.factorWeights) : undefined,
      estimatedDuration: data.estimatedDuration,
      estimatedPerStation: data.estimatedPerStation ? toJsonValue(data.estimatedPerStation) : undefined,
      actualRoute: data.actualRoute,
      actualDuration: data.actualDuration,
      wasAccepted: data.wasAccepted,
      feedbackScore: data.feedbackScore,
      feedbackNotes: data.feedbackNotes,
      modelVersion: data.modelVersion,
      modelType: data.modelType,
    },
  });
}

function createRoutingDecisionRecord(db: RoutingWriteClient, data: RoutingDecisionData) {
  return db.routingDecision.create({
    data: {
      workOrderId: data.workOrderId,
      decisionType: data.decisionType,
      previousRoute: data.previousRoute,
      newRoute: data.newRoute,
      trigger: data.trigger,
      triggerReason: data.triggerReason,
      factorsConsidered: data.factorsConsidered ? toJsonValue(data.factorsConsidered) : undefined,
      rulesApplied: data.rulesApplied,
      predictionId: data.predictionId,
      predictionScore: data.predictionScore,
      decisionMaker: data.decisionMaker,
      userId: data.userId,
      outcomeStatus: data.outcomeStatus,
      outcomeNotes: data.outcomeNotes,
      actualDuration: data.actualDuration,
    },
  });
}

export async function persistRoutingRecommendation(
  db: RoutingPersistenceClient,
  context: RoutingOptimizationContext,
  overrides: Partial<RoutingPredictionData> = {}
): Promise<{
  recommendation: RoutingOptimizationResult;
  prediction: Awaited<ReturnType<typeof createRoutingPredictionRecord>>;
  decision: Awaited<ReturnType<typeof createRoutingDecisionRecord>>;
}> {
  const recommendation = optimizeRoutingRecommendation(context);
  const predictionData = buildRoutingPredictionData(context, recommendation, overrides);
  const run = async (client: RoutingWriteClient) => {
    const prediction = await createRoutingPredictionRecord(client, predictionData);
    const bestRoute = recommendation.rankedRoutes[0] ?? scoreRouteCandidate(
      coercePrintingMethodRoute(recommendation.suggestion.suggestedRoute),
      context
    );
    const decisionData = buildRoutingDecisionData(context, {
      decisionType: RoutingDecisionType.OPTIMIZATION,
      trigger: inferRoutingTrigger(context, getStationIntelligenceMap(context.stationIntelligence)),
      triggerReason: 'Automated routing optimization',
      predictionId: prediction.id,
      predictionScore: recommendation.suggestion.confidence,
      decisionMaker: DecisionMaker.SYSTEM,
      outcomeStatus: DecisionOutcome.PENDING,
      rulesApplied: bestRoute.appliedRuleCodes,
      previousRoute: context.currentRoute ?? context.workOrder.routing,
      newRoute: coercePrintingMethodRoute(recommendation.suggestion.suggestedRoute),
    });
    const decision = await createRoutingDecisionRecord(client, decisionData);
    return { recommendation, prediction, decision };
  };

  if (typeof db.$transaction === 'function') {
    return db.$transaction(async (transaction: any) => run(transaction as RoutingWriteClient));
  }

  return run(db);
}

export async function recordManualRoutingOverride(
  db: RoutingWriteClient,
  context: RoutingOptimizationContext,
  override: RoutingOverrideInput,
  options: RoutingOverrideRecordOptions = {}
): Promise<Awaited<ReturnType<typeof createRoutingDecisionRecord>>> {
  const previousRoute = normalizeRoute(options.currentRoute ?? context.currentRoute ?? context.workOrder.routing);
  const resolvedRoute = resolveManualOverrideRoute(
    context,
    override,
    options.completedStations ?? null,
    previousRoute
  );
  const decisionData = buildRoutingDecisionData(context, {
    decisionType: RoutingDecisionType.MANUAL_OVERRIDE,
    trigger: options.trigger ?? RoutingTrigger.USER_REQUEST,
    triggerReason: override.reason,
    predictionId: options.predictionId ?? override.predictionId ?? null,
    predictionScore: null,
    decisionMaker: DecisionMaker.USER,
    userId: options.userId ?? null,
    outcomeStatus: options.outcomeStatus ?? DecisionOutcome.PENDING,
    outcomeNotes: override.notes ?? null,
    previousRoute,
    newRoute: resolvedRoute,
    rulesApplied: [],
  });

  return createRoutingDecisionRecord(db, decisionData);
}

export async function recordRoutingOutcome(
  db: RoutingPersistenceClient,
  context: RoutingOptimizationContext,
  actualRoute: readonly PrintingMethod[],
  options: RoutingOutcomeRecordOptions = {}
): Promise<{
  recommendation: RoutingOptimizationResult;
  prediction: Awaited<ReturnType<typeof createRoutingPredictionRecord>>;
  decision: Awaited<ReturnType<typeof createRoutingDecisionRecord>>;
  wasAccepted: boolean;
}> {
  const persisted = await persistRoutingRecommendation(db, context);
  const resolvedActualRoute = normalizeRoute(actualRoute);
  const suggestedRoute = coercePrintingMethodRoute(persisted.recommendation.suggestion.suggestedRoute);
  const wasAccepted = routesMatch(suggestedRoute, resolvedActualRoute);
  const feedbackNotes = options.feedbackNotes ?? (wasAccepted ? 'Routing recommendation accepted' : 'Routing recommendation rejected');

  const prediction = await db.routingPrediction.update({
    where: { id: persisted.prediction.id },
    data: {
      actualRoute: resolvedActualRoute,
      actualDuration: options.actualDuration ?? persisted.prediction.actualDuration,
      wasAccepted,
      feedbackScore: options.feedbackScore ?? persisted.prediction.feedbackScore,
      feedbackNotes,
    },
  });

  const decision = await db.routingDecision.update({
    where: { id: persisted.decision.id },
    data: {
      outcomeStatus: wasAccepted ? DecisionOutcome.SUCCESS : DecisionOutcome.REVERTED,
      outcomeNotes: feedbackNotes,
      actualDuration: options.actualDuration ?? undefined,
    },
  });

  return {
    recommendation: persisted.recommendation,
    prediction,
    decision,
    wasAccepted,
  };
}

function matchesTextTerm(source: string, term: string): boolean {
  const normalizedSource = source.toLowerCase();
  const normalizedTerm = term.toLowerCase();
  return normalizedSource.includes(normalizedTerm);
}

function ruleMatches(
  rule: RoutingOptimizationRule,
  context: RoutingOptimizationContext,
  route: readonly PrintingMethod[],
  stationMap: Map<PrintingMethod, RoutingStationIntelligence>,
  now: Date
): boolean {
  if (!rule.isActive) {
    return false;
  }

  const text = `${context.workOrder.description ?? ''} ${context.workOrder.notes ?? ''}`.trim();

  if (rule.appliesTo.length > 0 && !rule.appliesTo.some((station) => route.includes(station as PrintingMethod))) {
    return false;
  }

  if (rule.conditions.priorityRange) {
    const [minPriority, maxPriority] = rule.conditions.priorityRange;
    if (context.workOrder.priority < minPriority || context.workOrder.priority > maxPriority) {
      return false;
    }
  }

  if (rule.conditions.jobTypeMatch?.length) {
    const matchesJobType = rule.conditions.jobTypeMatch.some((term) => matchesTextTerm(text, term));
    if (!matchesJobType) {
      return false;
    }
  }

  if (rule.conditions.materialMatch?.length) {
    const matchesMaterial = rule.conditions.materialMatch.some((term) => matchesTextTerm(text, term));
    if (!matchesMaterial) {
      return false;
    }
  }

  if (rule.conditions.queueDepthThreshold != null) {
    const highestQueue = [...stationMap.values()].reduce(
      (highest, station) => Math.max(highest, station.currentQueueDepth),
      0
    );
    if (highestQueue < rule.conditions.queueDepthThreshold) {
      return false;
    }
  }

  if (rule.conditions.dayOfWeek?.length && !rule.conditions.dayOfWeek.includes(now.getDay())) {
    return false;
  }

  if (rule.conditions.timeOfDay) {
    const [startHour, startMinute] = rule.conditions.timeOfDay.start.split(':').map(Number);
    const [endHour, endMinute] = rule.conditions.timeOfDay.end.split(':').map(Number);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;
    const inWindow =
      startMinutes <= endMinutes
        ? currentMinutes >= startMinutes && currentMinutes <= endMinutes
        : currentMinutes >= startMinutes || currentMinutes <= endMinutes;

    if (!inWindow) {
      return false;
    }
  }

  return route.length > 0;
}

function scoreRouteCandidate(
  route: readonly PrintingMethod[],
  context: RoutingOptimizationContext
): ScoredRoute {
  const stationMap = getStationIntelligenceMap(context.stationIntelligence);
  const now = context.now ?? new Date();
  const normalizedRoute = applyRouteDefaults(route, context.workOrder.description ?? '', context.source);
  const explanationFactors: RoutingExplanationFactor[] = [];
  const warnings = new Set<string>();
  const appliedRuleCodes: string[] = [];
  let score = BASE_SCORE;
  let estimatedDuration = 0;

  const requiredStations = [...new Set(context.mustIncludeStations ?? [])];
  const excludedStations = [...new Set(context.excludedStations ?? [])];
  const preferredStations = [...new Set(context.preferredStations ?? [])];

  if (requiredStations.length > 0) {
    const missing = requiredStations.filter((station) => !normalizedRoute.includes(station));
    if (missing.length > 0) {
      const impact = -40 * missing.length;
      score += impact;
      explanationFactors.push({
        key: `must-include:${missing.join('|')}`,
        label: 'Required station coverage',
        direction: 'negative',
        scoreImpact: impact,
        value: missing.join(', '),
        description: `Missing required station(s): ${formatStationList(missing)}`,
      });
      warnings.add(`Missing required station(s): ${formatStationList(missing)}`);
    } else {
      const impact = 5 * requiredStations.length;
      score += impact;
      explanationFactors.push({
        key: `must-include:present:${requiredStations.join('|')}`,
        label: 'Required station coverage',
        direction: 'positive',
        scoreImpact: impact,
        value: requiredStations.join(', '),
        description: `Included required station(s): ${formatStationList(requiredStations)}`,
      });
    }
  }

  if (excludedStations.length > 0) {
    const present = excludedStations.filter((station) => normalizedRoute.includes(station));
    if (present.length > 0) {
      const impact = -55 * present.length;
      score += impact;
      explanationFactors.push({
        key: `excluded:${present.join('|')}`,
        label: 'Excluded station penalty',
        direction: 'negative',
        scoreImpact: impact,
        value: present.join(', '),
        description: `Route still includes excluded station(s): ${formatStationList(present)}`,
      });
      warnings.add(`Excluded station(s) present: ${formatStationList(present)}`);
    }
  }

  score -= normalizedRoute.length * 1.25;
  explanationFactors.push({
    key: 'route-length',
    label: 'Route length',
    direction: 'negative',
    scoreImpact: -normalizedRoute.length * 1.25,
    value: normalizedRoute.length,
    description: `Route has ${normalizedRoute.length} station${normalizedRoute.length === 1 ? '' : 's'}`,
  });

  for (const station of normalizedRoute) {
    const intel = stationMap.get(station);
    const baseDuration = getDefaultStationDuration(station);
    let stationDuration = baseDuration;
    let stationScoreImpact = 0;

    if (!intel) {
      const impact = -2;
      stationScoreImpact += impact;
      stationDuration += 8;
      warnings.add(`No station intelligence available for ${station}`);
      explanationFactors.push({
        key: `station:${station}:missing-intel`,
        label: `${station} intelligence`,
        direction: 'negative',
        scoreImpact: impact,
        value: null,
        description: `No live intelligence available for ${station}`,
      });
      score += impact;
      estimatedDuration += stationDuration;
      continue;
    }

    const queueImpact = -(intel.currentQueueDepth * 4);
    const waitImpact = -(intel.currentWaitTime * 0.35);
    const utilizationImpact = -(intel.utilizationPct * 0.12);
    const activeJobsImpact = -(intel.activeJobs * 1.5);
    const activeOperatorsImpact = intel.activeOperators * 2.5;
    const operatorAvailability =
      intel.operatorAvailability != null
        ? intel.operatorAvailability > 1
          ? intel.operatorAvailability / 100
          : intel.operatorAvailability
        : null;
    const availabilityImpact = operatorAvailability != null ? operatorAvailability * 8 : 0;
    const equipmentPenalty = EQUIPMENT_STATUS_SCORE_PENALTY[intel.equipmentStatus] ?? 0;
    const equipmentDurationPenalty = EQUIPMENT_STATUS_DURATION_PENALTY[intel.equipmentStatus] ?? 0;
    const throughputBonus = intel.throughputPerHour != null ? intel.throughputPerHour * 0.6 : 0;
    const bottleneckPenalty = intel.isBottleneck ? -8 : 0;

    stationScoreImpact += queueImpact + waitImpact + utilizationImpact + activeJobsImpact;
    stationScoreImpact += activeOperatorsImpact + availabilityImpact + throughputBonus;
    stationScoreImpact += bottleneckPenalty - equipmentPenalty;
    stationDuration += intel.currentQueueDepth * 4 + intel.currentWaitTime * 0.5 + equipmentDurationPenalty;

    if (intel.avgJobDuration != null) {
      stationDuration = Math.max(stationDuration, intel.avgJobDuration);
    }
    if (intel.avgSetupTime != null) {
      stationDuration += intel.avgSetupTime * 0.2;
    }
    if (intel.avgQualityScore != null) {
      stationScoreImpact += (intel.avgQualityScore - 50) * 0.08;
    }

    score += stationScoreImpact;
    estimatedDuration += stationDuration;

    explanationFactors.push(
      {
        key: `station:${station}:queue`,
        label: `${station} queue depth`,
        direction: queueImpact < 0 ? 'negative' : 'positive',
        scoreImpact: queueImpact,
        value: intel.currentQueueDepth,
        description: intel.currentQueueDepth > 0
          ? `${intel.currentQueueDepth} job(s) waiting at ${station}`
          : `${station} queue is clear`,
      },
      {
        key: `station:${station}:wait`,
        label: `${station} wait time`,
        direction: waitImpact < 0 ? 'negative' : 'positive',
        scoreImpact: waitImpact,
        value: intel.currentWaitTime,
        description: `${intel.currentWaitTime} minute wait at ${station}`,
      },
      {
        key: `station:${station}:operators`,
        label: `${station} operator availability`,
        direction: activeOperatorsImpact >= 0 ? 'positive' : 'negative',
        scoreImpact: activeOperatorsImpact + availabilityImpact,
        value: operatorAvailability ?? intel.activeOperators,
        description:
          operatorAvailability != null
            ? `${Math.round(operatorAvailability * 100)}% operator availability at ${station}`
            : `${intel.activeOperators} active operator(s) at ${station}`,
      },
      {
        key: `station:${station}:equipment`,
        label: `${station} equipment status`,
        direction: equipmentPenalty === 0 ? 'positive' : 'negative',
        scoreImpact: -equipmentPenalty,
        value: intel.equipmentStatus,
        description: `${station} equipment status is ${intel.equipmentStatus}`,
      }
    );

    if (intel.isBottleneck) {
      warnings.add(intel.bottleneckReason ? `${station} bottleneck: ${intel.bottleneckReason}` : `${station} is a bottleneck`);
      explanationFactors.push({
        key: `station:${station}:bottleneck`,
        label: `${station} bottleneck`,
        direction: 'negative',
        scoreImpact: bottleneckPenalty,
        value: true,
        description: intel.bottleneckReason ?? `${station} is currently bottlenecked`,
      });
    }
  }

  if (preferredStations.length > 0) {
    const present = preferredStations.filter((station) => normalizedRoute.includes(station));
    if (present.length > 0) {
      const impact = present.length * 6;
      score += impact;
      explanationFactors.push({
        key: `preferred:${present.join('|')}`,
        label: 'Preferred station bonus',
        direction: 'positive',
        scoreImpact: impact,
        value: present.join(', '),
        description: `Route includes preferred station(s): ${formatStationList(present)}`,
      });
    }
  }

  const urgencyMultiplier = estimateUrgencyMultiplier(context.workOrder, now);
  const urgencyImpact = -(estimatedDuration * urgencyMultiplier);
  score += urgencyImpact;
  explanationFactors.push({
    key: 'due-date-urgency',
    label: 'Due date urgency',
    direction: urgencyImpact < 0 ? 'negative' : 'positive',
    scoreImpact: urgencyImpact,
    value: context.workOrder.dueDate?.toISOString() ?? null,
    description: context.workOrder.dueDate
      ? `Due date pressure adjusted with a ${roundToTwoDecimals(urgencyMultiplier)} multiplier`
      : `No due date; applied a light priority-based urgency multiplier of ${roundToTwoDecimals(urgencyMultiplier)}`,
  });

  for (const rule of context.optimizationRules ?? []) {
    if (!ruleMatches(rule, context, normalizedRoute, stationMap, now)) {
      continue;
    }

    appliedRuleCodes.push(rule.code);
    const matchedStations = new Set<string>();
    let ruleImpact = roundToTwoDecimals((rule.weight ?? 1) * 4);

    if (rule.actions.preferStation?.length) {
      const matches = rule.actions.preferStation.filter((station) => normalizedRoute.includes(station as PrintingMethod));
      if (matches.length > 0) {
        matchedStations.add(matches.join('|'));
        ruleImpact += matches.length * (rule.weight ?? 1) * 3;
      }
    }

    if (rule.actions.avoidStation?.length) {
      const matches = rule.actions.avoidStation.filter((station) => normalizedRoute.includes(station as PrintingMethod));
      if (matches.length > 0) {
        matchedStations.add(matches.join('|'));
        ruleImpact -= matches.length * (rule.weight ?? 1) * 8;
      }
    }

    if (rule.actions.batchWith?.length) {
      const matches = rule.actions.batchWith.filter((station) => normalizedRoute.includes(station as PrintingMethod));
      if (matches.length > 0) {
        matchedStations.add(matches.join('|'));
        ruleImpact += matches.length * (rule.weight ?? 1) * 2;
      }
    }

    if (rule.actions.adjustPriority != null) {
      ruleImpact += (rule.weight ?? 1) * rule.actions.adjustPriority * 2;
    }

    if (rule.actions.requireApproval) {
      ruleImpact -= (rule.weight ?? 1) * 3;
      warnings.add(`Rule ${rule.code} requires approval`);
    }

    if (rule.actions.addWarning) {
      warnings.add(rule.actions.addWarning);
    }

    score += ruleImpact;
    explanationFactors.push({
      key: `rule:${rule.code}`,
      label: `Rule ${rule.code}`,
      direction: ruleImpact >= 0 ? 'positive' : 'negative',
      scoreImpact: ruleImpact,
      value: Array.from(matchedStations).join(', ') || rule.ruleType,
      description: rule.description ?? rule.name,
    });
  }

  if (stationMap.size === 0) {
    warnings.add('No station intelligence available; using routing defaults');
  }

  score = clamp(score, 0, 100);
  estimatedDuration = Math.max(1, roundToTwoDecimals(estimatedDuration));

  return {
    route: normalizedRoute,
    score: roundToTwoDecimals(score),
    estimatedDuration,
    reasoning: buildReasoning(explanationFactors),
    warnings: Array.from(warnings),
    explanationFactors,
    appliedRuleCodes,
  };
}

function deriveCandidateRoutes(context: RoutingOptimizationContext): PrintingMethod[][] {
  const candidates = new Map<string, PrintingMethod[]>();
  const description = context.workOrder.description ?? '';
  const baseRoute = normalizeRoute(context.currentRoute?.length ? context.currentRoute : context.workOrder.routing);

  const add = (route: readonly PrintingMethod[] | undefined | null): void => {
    const normalized = ensureRoute(route, description, context.source);
    if (normalized.length === 0) {
      return;
    }
    candidates.set(fingerprintRoute(normalized), normalized);
  };

  if (context.candidateRoutes?.length) {
    for (const route of context.candidateRoutes) {
      add(route);
    }
  } else {
    const inferred = inferRoutingFromOrderDetails({
      description,
      notes: context.workOrder.notes ?? '',
      routing: baseRoute,
    });

    add(baseRoute);
    add(inferred);
    add(prioritizeStations(baseRoute, context.preferredStations ?? []));
    add(removeStations(baseRoute, context.excludedStations ?? []));
    add(addStations(baseRoute, context.mustIncludeStations ?? []));
  }

  if (candidates.size === 0) {
    add([DEFAULT_ROUTE_STATION]);
  }

  return Array.from(candidates.values());
}

function sortCandidates(left: ScoredRoute, right: ScoredRoute): number {
  if (right.score !== left.score) {
    return right.score - left.score;
  }

  if (left.estimatedDuration !== right.estimatedDuration) {
    return left.estimatedDuration - right.estimatedDuration;
  }

  return fingerprintRoute(left.route).localeCompare(fingerprintRoute(right.route));
}

export function optimizeRoutingRecommendation(context: RoutingOptimizationContext): RoutingOptimizationResult {
  const scored = deriveCandidateRoutes(context).map((route) => scoreRouteCandidate(route, context)).sort(sortCandidates);
  const best = scored[0] ?? scoreRouteCandidate([DEFAULT_ROUTE_STATION], context);
  const alternatives: AlternativeRoute[] = scored.slice(1).map((candidate) => ({
    route: candidate.route,
    score: candidate.score,
    reason: candidate.reasoning[0] ?? 'Alternative routing option',
    estimatedDuration: candidate.estimatedDuration,
  }));

  const suggestion: RoutingSuggestion = {
    suggestedRoute: best.route,
    confidence: roundToTwoDecimals(clamp(best.score / 100, 0, 1)),
    estimatedDuration: best.estimatedDuration,
    reasoning: best.reasoning,
    alternatives,
    warnings: best.warnings,
    explanationFactors: best.explanationFactors,
  };

  return {
    suggestion,
    rankedRoutes: scored,
  };
}

export const recommendRouting = optimizeRoutingRecommendation;

export { deriveCandidateRoutes, scoreRouteCandidate };
