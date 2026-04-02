import { Router, type Response } from 'express';
import {
  DecisionOutcome,
  EquipmentStatus,
  OptimizationRuleType,
  PredictionFeedbackSchema,
  PrintingMethod,
  STATION_DISPLAY_NAMES,
  RequestRoutingOptimizationSchema,
  type RoutingDecision,
  type RoutingIntelligenceDashboard,
  type PredictionFeedbackInput,
  type StationStatusSummary,
} from '@erp/shared';
import { prisma } from '../db/client.js';
import { logActivity, ActivityAction, EntityType } from '../lib/activity-logger.js';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { BadRequestError, NotFoundError } from '../middleware/error-handler.js';
import {
  optimizeRoutingRecommendation,
  persistRoutingRecommendation,
  type RoutingOptimizationContext,
  type RoutingOptimizationRule,
  type RoutingStationIntelligence,
} from '../services/routing-optimization.js';
import { broadcastToUser } from '../ws/server.js';

export const routingRouter = Router();

routingRouter.use(authenticate);

const PRINTING_METHOD_VALUES = new Set<PrintingMethod>(Object.values(PrintingMethod));
const STATION_INTELLIGENCE_BASELINE = Object.values(PrintingMethod).map((station) => ({
  station: station as PrintingMethod,
}));

let stationIntelligenceBaselinePromise: Promise<void> | null = null;

async function ensureStationIntelligenceBaseline(): Promise<void> {
  if (!stationIntelligenceBaselinePromise) {
    stationIntelligenceBaselinePromise = prisma.stationIntelligence
      .createMany({
        data: STATION_INTELLIGENCE_BASELINE,
        skipDuplicates: true,
      })
      .then(() => undefined)
      .catch((error) => {
        stationIntelligenceBaselinePromise = null;
        throw error;
      });
  }

  return stationIntelligenceBaselinePromise;
}

interface WorkOrderRow {
  id: string;
  orderNumber: string;
  description: string;
  priority: number;
  dueDate: Date | null;
  notes: string | null;
  routing: PrintingMethod[];
}

interface StationIntelligenceRow {
  station: PrintingMethod;
  currentQueueDepth: number;
  currentWaitTime: number;
  activeJobs: number;
  activeOperators: number;
  equipmentStatus: EquipmentStatus;
  utilizationPct: number;
  avgJobDuration: number | null;
  avgSetupTime: number | null;
  avgQualityScore: number | null;
  throughputPerHour: number | null;
  isBottleneck: boolean;
  bottleneckReason: string | null;
}

interface OptimizationRuleRow {
  code: string;
  name: string;
  description: string | null;
  ruleType: OptimizationRuleType;
  conditions: unknown;
  actions: unknown;
  weight: number;
  priority: number;
  isActive: boolean;
  appliesTo: string[];
}

interface RoutingPredictionMetricsRow {
  confidence: number;
  predictedRoute: PrintingMethod[];
  actualRoute: PrintingMethod[];
  wasAccepted: boolean | null;
}

interface RoutingPredictionRow {
  id: string;
  workOrderId: string | null;
  workOrder: { orderNumber: string } | null;
  predictedRoute: PrintingMethod[];
  actualRoute: PrintingMethod[];
  actualDuration: number | null;
  wasAccepted: boolean | null;
  feedbackScore: number | null;
  feedbackNotes: string | null;
}

function normalizePrintingMethods(values: readonly string[] | undefined | null, fieldName: string): PrintingMethod[] {
  const normalized: PrintingMethod[] = [];
  const seen = new Set<PrintingMethod>();

  for (const value of values ?? []) {
    if (!PRINTING_METHOD_VALUES.has(value as PrintingMethod)) {
      throw BadRequestError(`${fieldName} contains an unknown station: ${value}`);
    }

    const station = value as PrintingMethod;
    if (!seen.has(station)) {
      seen.add(station);
      normalized.push(station);
    }
  }

  return normalized;
}

function normalizePrintingMethodsOptional(
  values: readonly string[] | undefined | null,
  fieldName: string
): PrintingMethod[] | undefined {
  const normalized = normalizePrintingMethods(values, fieldName);
  return normalized.length > 0 ? normalized : undefined;
}

function mapStationIntelligence(rows: StationIntelligenceRow[]): RoutingStationIntelligence[] {
  return rows.map((row) => ({
    station: row.station as PrintingMethod,
    currentQueueDepth: row.currentQueueDepth,
    currentWaitTime: row.currentWaitTime,
    activeJobs: row.activeJobs,
    activeOperators: row.activeOperators,
    equipmentStatus: row.equipmentStatus as RoutingStationIntelligence['equipmentStatus'],
    utilizationPct: row.utilizationPct,
    avgJobDuration: row.avgJobDuration,
    avgSetupTime: row.avgSetupTime,
    avgQualityScore: row.avgQualityScore,
    throughputPerHour: row.throughputPerHour,
    isBottleneck: row.isBottleneck,
    bottleneckReason: row.bottleneckReason,
  } as RoutingStationIntelligence));
}

function mapOptimizationRules(rows: OptimizationRuleRow[]): RoutingOptimizationRule[] {
  return rows.map((rule) => ({
    code: rule.code,
    name: rule.name,
    description: rule.description,
    ruleType: rule.ruleType as RoutingOptimizationRule['ruleType'],
    conditions: rule.conditions as RoutingOptimizationRule['conditions'],
    actions: rule.actions as RoutingOptimizationRule['actions'],
    weight: rule.weight,
    priority: rule.priority,
    isActive: rule.isActive,
    appliesTo: rule.appliesTo as RoutingOptimizationRule['appliesTo'],
  } as RoutingOptimizationRule));
}

function mapStationSummaries(rows: StationIntelligenceRow[]): StationStatusSummary[] {
  return rows.map((row) => ({
    station: row.station,
    displayName: STATION_DISPLAY_NAMES[row.station as PrintingMethod] ?? row.station,
    status: row.equipmentStatus as StationStatusSummary['status'],
    queueDepth: row.currentQueueDepth,
    waitTimeMinutes: row.currentWaitTime,
    utilizationPct: row.utilizationPct,
    isBottleneck: row.isBottleneck,
    activeOperators: row.activeOperators,
  }));
}

function routesMatch(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((station, index) => station === right[index]);
}

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

async function recordRoutingActivity(params: {
  userId: string;
  workOrderId: string;
  orderNumber: string;
  description: string;
  details: Record<string, unknown>;
  broadcastType: string;
  broadcastPayload: Record<string, unknown>;
}): Promise<void> {
  await logActivity({
    action: ActivityAction.UPDATE,
    entityType: EntityType.WORK_ORDER,
    entityId: params.workOrderId,
    entityName: params.orderNumber,
    description: params.description,
    details: params.details,
    userId: params.userId,
  });

  broadcastToUser(params.userId, {
    type: params.broadcastType,
    payload: params.broadcastPayload,
    timestamp: new Date(),
  });
}

async function loadRoutingIntelligenceDashboard(): Promise<RoutingIntelligenceDashboard> {
  await ensureStationIntelligenceBaseline();

  const [stationRows, predictionRows, decisionRows] = await Promise.all([
    prisma.stationIntelligence.findMany({
      orderBy: { station: 'asc' },
      select: {
        station: true,
        currentQueueDepth: true,
        currentWaitTime: true,
        activeJobs: true,
        activeOperators: true,
        equipmentStatus: true,
        utilizationPct: true,
        avgJobDuration: true,
        avgSetupTime: true,
        avgQualityScore: true,
        throughputPerHour: true,
        isBottleneck: true,
        bottleneckReason: true,
      },
    }),
    prisma.routingPrediction.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        confidence: true,
        predictedRoute: true,
        actualRoute: true,
        wasAccepted: true,
      },
    }),
    prisma.routingDecision.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  const predictions = predictionRows as RoutingPredictionMetricsRow[];
  const totalPredictions = predictions.length;
  const acceptedPredictions = predictions.filter((prediction) => prediction.wasAccepted === true).length;
  const avgConfidence = totalPredictions > 0
    ? roundToTwoDecimals(
        predictions.reduce((sum, prediction) => sum + prediction.confidence, 0) / totalPredictions
      )
    : 0;
  const completedPredictions = predictions.filter((prediction) => prediction.actualRoute.length > 0);
  const exactMatches = completedPredictions.filter((prediction) => routesMatch(prediction.predictedRoute, prediction.actualRoute)).length;
  const avgAccuracy = completedPredictions.length > 0
    ? roundToTwoDecimals(exactMatches / completedPredictions.length)
    : 0;

  const stationSummaries = mapStationSummaries(stationRows as unknown as StationIntelligenceRow[]);

  return {
    stations: stationSummaries,
    bottlenecks: stationSummaries.filter((station) => station.isBottleneck),
    predictions: {
      total: totalPredictions,
      accepted: acceptedPredictions,
      avgConfidence,
      avgAccuracy,
    },
    recentDecisions: decisionRows as unknown as RoutingDecision[],
  };
}

async function loadRoutingOptimizationContext(
  input: ReturnType<typeof RequestRoutingOptimizationSchema.parse>
): Promise<RoutingOptimizationContext> {
  await ensureStationIntelligenceBaseline();

  const workOrder = (await prisma.workOrder.findUnique({
    where: { id: input.workOrderId },
    select: {
      id: true,
      orderNumber: true,
      description: true,
      priority: true,
      dueDate: true,
      notes: true,
      routing: true,
    },
  })) as WorkOrderRow | null;

  if (!workOrder) {
    throw NotFoundError(`Work order ${input.workOrderId} not found`);
  }

  const [stationIntelligenceRows, optimizationRuleRows] = await Promise.all([
    prisma.stationIntelligence.findMany({
      orderBy: { station: 'asc' },
      select: {
        station: true,
        currentQueueDepth: true,
        currentWaitTime: true,
        activeJobs: true,
        activeOperators: true,
        equipmentStatus: true,
        utilizationPct: true,
        avgJobDuration: true,
        avgSetupTime: true,
        avgQualityScore: true,
        throughputPerHour: true,
        isBottleneck: true,
        bottleneckReason: true,
      },
    }),
    prisma.optimizationRule.findMany({
      where: {
        isActive: true,
        ruleType: OptimizationRuleType.ROUTING,
        ...(input.constraints?.length ? { code: { in: input.constraints } } : {}),
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      select: {
        code: true,
        name: true,
        description: true,
        ruleType: true,
        conditions: true,
        actions: true,
        weight: true,
        priority: true,
        isActive: true,
        appliesTo: true,
      },
    }),
  ]);

  return {
    workOrder: {
      id: workOrder.id,
      orderNumber: workOrder.orderNumber,
      description: workOrder.description,
      priority: workOrder.priority,
      dueDate: workOrder.dueDate,
      notes: workOrder.notes,
      routing: workOrder.routing as PrintingMethod[],
    },
    stationIntelligence: mapStationIntelligence(stationIntelligenceRows as unknown as StationIntelligenceRow[]),
    optimizationRules: mapOptimizationRules(optimizationRuleRows as unknown as OptimizationRuleRow[]),
    currentRoute: normalizePrintingMethodsOptional(input.currentRoute, 'currentRoute'),
    preferredStations: normalizePrintingMethodsOptional(input.preferStations, 'preferStations'),
    excludedStations: normalizePrintingMethodsOptional(input.excludeStations, 'excludeStations'),
    mustIncludeStations: normalizePrintingMethodsOptional(input.mustIncludeStations, 'mustIncludeStations'),
    now: new Date(),
  };
}

async function updateRoutingPredictionFeedback(input: PredictionFeedbackInput): Promise<{
  prediction: NonNullable<RoutingPredictionRow>;
  decision: { id: string; outcomeStatus: DecisionOutcome | null } | null;
}> {
  const prediction = await prisma.routingPrediction.findUnique({
    where: { id: input.predictionId },
    select: {
      id: true,
      workOrderId: true,
      workOrder: {
        select: {
          orderNumber: true,
        },
      },
      predictedRoute: true,
      actualRoute: true,
      actualDuration: true,
      wasAccepted: true,
      feedbackScore: true,
      feedbackNotes: true,
    },
  });

  if (!prediction) {
    throw NotFoundError(`Routing prediction ${input.predictionId} not found`);
  }

  const actualRoute = input.actualRoute?.length
    ? input.actualRoute
    : input.wasAccepted
      ? prediction.predictedRoute
      : prediction.actualRoute;

  const updatedPrediction = await prisma.routingPrediction.update({
    where: { id: prediction.id },
    select: {
      id: true,
      workOrderId: true,
      workOrder: {
        select: {
          orderNumber: true,
        },
      },
      predictedRoute: true,
      actualRoute: true,
      actualDuration: true,
      wasAccepted: true,
      feedbackScore: true,
      feedbackNotes: true,
    },
    data: {
      actualRoute,
      actualDuration: input.actualDuration ?? prediction.actualDuration,
      wasAccepted: input.wasAccepted,
      feedbackScore: input.feedbackScore ?? prediction.feedbackScore,
      feedbackNotes: input.feedbackNotes ?? prediction.feedbackNotes,
    },
  });

  const decision = await prisma.routingDecision.findFirst({
    where: { predictionId: prediction.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, outcomeStatus: true },
  });

  if (decision) {
    const updatedDecision = await prisma.routingDecision.update({
      where: { id: decision.id },
      data: {
        outcomeStatus: input.wasAccepted ? DecisionOutcome.SUCCESS : DecisionOutcome.REVERTED,
        outcomeNotes:
          input.feedbackNotes ??
          (input.wasAccepted ? 'Routing recommendation accepted' : 'Routing recommendation rejected'),
        actualDuration: input.actualDuration ?? undefined,
      },
      select: { id: true, outcomeStatus: true },
    });

    return {
      prediction: updatedPrediction as unknown as RoutingPredictionRow,
      decision: {
        id: updatedDecision.id,
        outcomeStatus: updatedDecision.outcomeStatus as DecisionOutcome | null,
      },
    };
  }

  return { prediction: updatedPrediction as unknown as RoutingPredictionRow, decision: null };
}

// POST /routing/preview - Preview the ranked options without persisting a recommendation
routingRouter.post('/preview', async (req: AuthRequest, res: Response) => {
  const input = RequestRoutingOptimizationSchema.parse(req.body);
  const context = await loadRoutingOptimizationContext(input);
  const recommendation = optimizeRoutingRecommendation(context);

  res.json({
    success: true,
    data: recommendation,
  });
});

// POST /routing/optimize - Persist an optimization recommendation and its decision record
routingRouter.post('/optimize', async (req: AuthRequest, res: Response) => {
  const input = RequestRoutingOptimizationSchema.parse(req.body);
  const context = await loadRoutingOptimizationContext(input);
  const persisted = await persistRoutingRecommendation(prisma, context);

  await recordRoutingActivity({
    userId: req.userId!,
    workOrderId: context.workOrder.id,
    orderNumber: context.workOrder.orderNumber,
    description: `Generated routing recommendation for order #${context.workOrder.orderNumber}`,
    details: {
      predictionId: persisted.prediction.id,
      decisionId: persisted.decision.id,
      confidence: persisted.recommendation.suggestion.confidence,
      suggestedRoute: persisted.recommendation.suggestion.suggestedRoute,
      trigger: persisted.decision.trigger,
    },
    broadcastType: 'ROUTING_RECOMMENDATION_CREATED',
    broadcastPayload: {
      workOrderId: context.workOrder.id,
      orderNumber: context.workOrder.orderNumber,
      predictionId: persisted.prediction.id,
      decisionId: persisted.decision.id,
      confidence: persisted.recommendation.suggestion.confidence,
      suggestedRoute: persisted.recommendation.suggestion.suggestedRoute,
    },
  });

  res.json({
    success: true,
    data: persisted,
  });
});

// POST /routing/predictions/:predictionId/feedback - Mark a recommendation accepted or rejected
routingRouter.post('/predictions/:predictionId/feedback', async (req: AuthRequest, res: Response) => {
  const feedback = PredictionFeedbackSchema.parse(req.body);

  if (feedback.predictionId !== req.params.predictionId) {
    throw BadRequestError('predictionId in the path must match the request body');
  }

  const result = await updateRoutingPredictionFeedback(feedback);

  if (result.prediction.workOrderId) {
    const orderNumber = result.prediction.workOrder?.orderNumber ?? result.prediction.workOrderId;

    await recordRoutingActivity({
      userId: req.userId!,
      workOrderId: result.prediction.workOrderId,
      orderNumber,
      description: `Recorded routing feedback for order #${orderNumber}`,
      details: {
        predictionId: result.prediction.id,
        decisionId: result.decision?.id ?? null,
        wasAccepted: result.prediction.wasAccepted,
        actualRoute: result.prediction.actualRoute,
        actualDuration: result.prediction.actualDuration,
        feedbackScore: result.prediction.feedbackScore,
      },
      broadcastType: 'ROUTING_FEEDBACK_RECORDED',
      broadcastPayload: {
        workOrderId: result.prediction.workOrderId,
        orderNumber,
        predictionId: result.prediction.id,
        decisionId: result.decision?.id ?? null,
        wasAccepted: result.prediction.wasAccepted,
        actualRoute: result.prediction.actualRoute,
        actualDuration: result.prediction.actualDuration,
        feedbackScore: result.prediction.feedbackScore,
      },
    });
  }

  res.json({
    success: true,
    data: result,
  });
});

// GET /routing/dashboard - Summaries for routing outcome capture and learning loops
routingRouter.get('/dashboard', async (_req: AuthRequest, res: Response) => {
  const dashboard = await loadRoutingIntelligenceDashboard();

  res.json({
    success: true,
    data: dashboard,
  });
});
