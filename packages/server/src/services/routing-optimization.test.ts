import {
  DecisionMaker,
  DecisionOutcome,
  EquipmentStatus,
  OptimizationCategory,
  OptimizationRuleType,
  PrintingMethod,
  RoutingDecisionType,
  RoutingTrigger,
  type OptimizationRule,
} from '@erp/shared';
import { describe, expect, it } from 'vitest';
import {
  optimizeRoutingRecommendation,
  persistRoutingRecommendation,
  recordManualRoutingOverride,
  type RoutingOptimizationContext,
  type RoutingPersistenceClient,
  type RoutingWriteClient,
} from './routing-optimization.js';

function createRule(overrides: Partial<OptimizationRule>): OptimizationRule {
  const now = new Date('2026-04-01T12:00:00.000Z');
  return {
    id: 'rule-1',
    name: 'Prefer Roll To Roll',
    description: null,
    code: 'PREFER_ROLL_TO_ROLL',
    ruleType: OptimizationRuleType.ROUTING,
    category: OptimizationCategory.EFFICIENCY,
    conditions: {},
    actions: {
      preferStation: [PrintingMethod.ROLL_TO_ROLL],
    },
    weight: 1.5,
    appliesTo: [PrintingMethod.ROLL_TO_ROLL],
    successCount: 0,
    failureCount: 0,
    averageImprovement: null,
    isActive: true,
    priority: 10,
    createdBy: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createContext(overrides: Partial<RoutingOptimizationContext> = {}): RoutingOptimizationContext {
  const base: RoutingOptimizationContext = {
    workOrder: {
      id: 'wo-1',
      orderNumber: 'WO1001',
      description: 'General signage run',
      priority: 3,
      dueDate: new Date('2026-04-03T12:00:00.000Z'),
      notes: null,
      routing: [PrintingMethod.DESIGN],
    },
    candidateRoutes: [
      [PrintingMethod.DESIGN, PrintingMethod.FLATBED, PrintingMethod.PRODUCTION, PrintingMethod.SHIPPING_RECEIVING],
      [PrintingMethod.DESIGN, PrintingMethod.ROLL_TO_ROLL, PrintingMethod.PRODUCTION, PrintingMethod.SHIPPING_RECEIVING],
    ],
    stationIntelligence: [
      {
        station: PrintingMethod.DESIGN,
        currentQueueDepth: 1,
        currentWaitTime: 10,
        activeJobs: 2,
        activeOperators: 2,
        equipmentStatus: EquipmentStatus.OPERATIONAL,
        utilizationPct: 50,
        avgJobDuration: 10,
        avgSetupTime: 2,
        avgQualityScore: 90,
        throughputPerHour: 2,
        isBottleneck: false,
      },
      {
        station: PrintingMethod.FLATBED,
        currentQueueDepth: 10,
        currentWaitTime: 120,
        activeJobs: 5,
        activeOperators: 1,
        equipmentStatus: EquipmentStatus.DEGRADED,
        utilizationPct: 92,
        avgJobDuration: 25,
        avgSetupTime: 8,
        avgQualityScore: 80,
        throughputPerHour: 1,
        isBottleneck: true,
      },
      {
        station: PrintingMethod.ROLL_TO_ROLL,
        currentQueueDepth: 2,
        currentWaitTime: 20,
        activeJobs: 3,
        activeOperators: 3,
        equipmentStatus: EquipmentStatus.OPERATIONAL,
        utilizationPct: 58,
        avgJobDuration: 22,
        avgSetupTime: 6,
        avgQualityScore: 90,
        throughputPerHour: 4,
        isBottleneck: false,
      },
      {
        station: PrintingMethod.PRODUCTION,
        currentQueueDepth: 2,
        currentWaitTime: 25,
        activeJobs: 2,
        activeOperators: 2,
        equipmentStatus: EquipmentStatus.OPERATIONAL,
        utilizationPct: 65,
        avgJobDuration: 30,
        avgSetupTime: 5,
        avgQualityScore: 88,
        throughputPerHour: 3,
        isBottleneck: false,
      },
      {
        station: PrintingMethod.SHIPPING_RECEIVING,
        currentQueueDepth: 1,
        currentWaitTime: 15,
        activeJobs: 1,
        activeOperators: 2,
        equipmentStatus: EquipmentStatus.OPERATIONAL,
        utilizationPct: 55,
        avgJobDuration: 12,
        avgSetupTime: 2,
        avgQualityScore: 92,
        throughputPerHour: 5,
        isBottleneck: false,
      },
    ],
    optimizationRules: [createRule({})],
    now: new Date('2026-04-01T12:00:00.000Z'),
  };

  return {
    ...base,
    ...overrides,
    workOrder: {
      ...base.workOrder,
      ...(overrides.workOrder ?? {}),
    },
    stationIntelligence: overrides.stationIntelligence ?? base.stationIntelligence,
    optimizationRules: overrides.optimizationRules ?? base.optimizationRules,
    candidateRoutes: overrides.candidateRoutes ?? base.candidateRoutes,
    currentRoute: overrides.currentRoute ?? base.currentRoute,
    preferredStations: overrides.preferredStations ?? base.preferredStations,
    excludedStations: overrides.excludedStations ?? base.excludedStations,
    mustIncludeStations: overrides.mustIncludeStations ?? base.mustIncludeStations,
    now: overrides.now ?? base.now,
  };
}

function createRoutingDbMock() {
  const createdPredictions: Record<string, unknown>[] = [];
  const createdDecisions: Record<string, unknown>[] = [];
  let db!: RoutingPersistenceClient;

  db = {
    routingPrediction: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        createdPredictions.push(data as Record<string, unknown>);
        return {
          id: `prediction-${createdPredictions.length}`,
          ...data,
        };
      },
    } as unknown as RoutingWriteClient['routingPrediction'],
    routingDecision: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        createdDecisions.push(data as Record<string, unknown>);
        return {
          id: `decision-${createdDecisions.length}`,
          ...data,
        };
      },
    } as unknown as RoutingWriteClient['routingDecision'],
    $transaction: async (callback: (client: RoutingWriteClient) => Promise<unknown>) => callback(db),
  } as unknown as RoutingPersistenceClient;

  return { db, createdPredictions, createdDecisions };
}

describe('optimizeRoutingRecommendation', () => {
  it('deterministically prefers the lower-queue and healthier-equipment route', () => {
    const result = optimizeRoutingRecommendation(createContext());

    expect(result.suggestion.suggestedRoute).toContain(PrintingMethod.ROLL_TO_ROLL);
    expect(result.suggestion.suggestedRoute).not.toContain(PrintingMethod.FLATBED);
    expect(result.rankedRoutes[0].route).toEqual(result.suggestion.suggestedRoute);
    expect(result.rankedRoutes[0].route).not.toEqual(result.rankedRoutes[1].route);
    expect(result.rankedRoutes[0].appliedRuleCodes).toContain('PREFER_ROLL_TO_ROLL');
    expect(result.suggestion.explanationFactors.some((factor) => factor.key === 'station:ROLL_TO_ROLL:equipment')).toBe(true);
  });

  it('falls back deterministically when station intelligence is sparse', () => {
    const sparseContext = createContext({
      workOrder: {
        id: 'wo-2',
        orderNumber: 'WO1002',
        description: 'Banner reorder with install note',
        notes: '(INSTALL)',
        priority: 2,
        dueDate: null,
        routing: [PrintingMethod.DESIGN],
      },
      stationIntelligence: [
        {
          station: PrintingMethod.DESIGN,
          currentQueueDepth: 1,
          currentWaitTime: 8,
          activeJobs: 1,
          activeOperators: 2,
          equipmentStatus: EquipmentStatus.OPERATIONAL,
          utilizationPct: 48,
          avgJobDuration: 12,
          avgSetupTime: 3,
          avgQualityScore: 92,
          throughputPerHour: 4,
          isBottleneck: false,
        },
      ],
      candidateRoutes: [],
      optimizationRules: [],
    });

    const first = optimizeRoutingRecommendation(sparseContext);
    const second = optimizeRoutingRecommendation(sparseContext);

    expect(first.suggestion.suggestedRoute).toEqual(second.suggestion.suggestedRoute);
    expect(first.rankedRoutes.map((route) => route.route)).toEqual(second.rankedRoutes.map((route) => route.route));
    expect(first.suggestion.suggestedRoute.length).toBeGreaterThan(0);
    expect(first.suggestion.explanationFactors.length).toBeGreaterThan(0);
    expect(first.suggestion.confidence).toBeGreaterThan(0);
    expect(first.suggestion.confidence).toBeLessThanOrEqual(1);
  });

  it('persists predictions and records manual overrides with preserved stations', async () => {
    const context = createContext({
      workOrder: {
        id: 'wo-3',
        orderNumber: 'WO1003',
        description: 'Customer signage with post-print finishing',
        priority: 4,
        dueDate: new Date('2026-04-02T12:00:00.000Z'),
        notes: 'Rush job',
        routing: [PrintingMethod.DESIGN, PrintingMethod.PRODUCTION, PrintingMethod.SHIPPING_RECEIVING],
      },
      candidateRoutes: [
        [PrintingMethod.DESIGN, PrintingMethod.PRODUCTION, PrintingMethod.SHIPPING_RECEIVING],
        [PrintingMethod.DESIGN, PrintingMethod.ROLL_TO_ROLL, PrintingMethod.PRODUCTION, PrintingMethod.SHIPPING_RECEIVING],
      ],
      optimizationRules: [],
    });

    const { db, createdPredictions, createdDecisions } = createRoutingDbMock();
    const persisted = await persistRoutingRecommendation(db, context);

    expect(createdPredictions).toHaveLength(1);
    expect(createdDecisions).toHaveLength(1);
    expect(createdPredictions[0].predictedRoute).toEqual(persisted.recommendation.suggestion.suggestedRoute);
    expect(createdPredictions[0].modelVersion).toBe('routing-optimization-v1');
    expect(createdDecisions[0].predictionId).toBe('prediction-1');
    expect(createdDecisions[0].decisionType).toBe(RoutingDecisionType.OPTIMIZATION);
    expect(createdDecisions[0].decisionMaker).toBe(DecisionMaker.SYSTEM);

    const manualDecision = await recordManualRoutingOverride(
      db,
      context,
      {
        workOrderId: context.workOrder.id,
        predictionId: 'prediction-1',
        newRoute: [PrintingMethod.ROLL_TO_ROLL, PrintingMethod.PRODUCTION, PrintingMethod.SHIPPING_RECEIVING],
        reason: 'Customer requested reroute',
        notes: 'Keep completed design station',
        preserveCompletedStations: true,
      },
      {
        userId: 'user-1',
        currentRoute: [PrintingMethod.DESIGN, PrintingMethod.PRODUCTION, PrintingMethod.SHIPPING_RECEIVING],
        completedStations: [PrintingMethod.DESIGN],
        trigger: RoutingTrigger.USER_REQUEST,
        outcomeStatus: DecisionOutcome.PARTIAL,
      }
    );

    expect(createdDecisions).toHaveLength(2);
    expect(manualDecision.decisionType).toBe(RoutingDecisionType.MANUAL_OVERRIDE);
    expect(manualDecision.decisionMaker).toBe(DecisionMaker.USER);
    expect(manualDecision.trigger).toBe(RoutingTrigger.USER_REQUEST);
    expect(manualDecision.newRoute[0]).toBe(PrintingMethod.DESIGN);
    expect(manualDecision.predictionId).toBe('prediction-1');
    expect(manualDecision.outcomeStatus).toBe(DecisionOutcome.PARTIAL);
  });
});
