import { Router, type Response } from 'express';
import {
  DecisionOutcome,
  EquipmentStatus,
  OptimizationRuleType,
  PredictionFeedbackSchema,
  PrintingMethod,
  RequestRoutingOptimizationSchema,
  type PredictionFeedbackInput,
} from '@erp/shared';
import { prisma } from '../db/client.js';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { BadRequestError, NotFoundError } from '../middleware/error-handler.js';
import {
  optimizeRoutingRecommendation,
  persistRoutingRecommendation,
  type RoutingOptimizationContext,
  type RoutingOptimizationRule,
  type RoutingStationIntelligence,
} from '../services/routing-optimization.js';

export const routingRouter = Router();

routingRouter.use(authenticate);

const PRINTING_METHOD_VALUES = new Set<PrintingMethod>(Object.values(PrintingMethod));

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

interface RoutingPredictionRow {
  id: string;
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

async function loadRoutingOptimizationContext(
  input: ReturnType<typeof RequestRoutingOptimizationSchema.parse>
): Promise<RoutingOptimizationContext> {
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

  res.json({
    success: true,
    data: result,
  });
});
