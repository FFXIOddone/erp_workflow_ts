# AI-Optimized Dynamic Routing Engine

> For agentic workers: use this plan for `SSS-API-001`. Keep orchestration in the main thread, respect `packages/shared` -> `packages/server` -> `packages/web` -> `packages/shop-floor`, and do not widen beyond one independently verifiable slice at a time.

**Task ID:** `SSS-API-001`

**Goal:** Replace static work-order routing with a dynamic routing engine that scores and recommends station sequences from job attributes, queue depth, operator skills, equipment availability, and business rules, while preserving manual overrides, auditability, and downstream station visibility.

**Current Repo Anchors:**
- `docs/ERP_GAP_ANALYSIS.md` defines `SSS-001` and `SSS-API-001`.
- `packages/server/prisma/schema.prisma` already contains `RoutingPrediction`, `OptimizationRule`, `StationIntelligence`, and `RoutingDecision`.
- `packages/shared/src/types.ts` and `packages/shared/src/schemas.ts` already expose routing-intelligence DTOs and optimization request schemas.
- `packages/server/src/lib/routing-defaults.ts` and `packages/server/src/routes/orders.ts` represent the current static/default routing entry points.
- `packages/web/src/pages/ProductionCalendarPage.tsx` and multiple `packages/shop-floor/src/stations/*.tsx` screens consume routing arrays today.

**Constraints:**
- The worktree already contains unrelated edits across server, web, shop-floor, and root files.
- Protected integration files must stay untouched until a dedicated slice requires them.
- This request is too broad for one safe implementation pass, so the first slice stays in planning/logging scope.

**Architecture Direction:**
1. Discovery and contract lock: map current routing producers/consumers, define scoring inputs/outputs, and pin acceptance criteria.
2. Shared package hardening: confirm `@erp/shared` exposes the exact request/response contracts for prediction, recommendation, override, and explanation payloads.
3. Server engine slice: implement a deterministic scoring service that can rank routes from live station intelligence, rules, and current work-order context.
4. API integration slice: expose prediction/recommendation endpoints and manual-override recording without touching protected bootstrap files until needed.
5. UI consumption slices: surface recommended routes, reasoning, and override affordances in web and shop-floor flows only after the server contract is stable.
6. Feedback loop slice: persist decisions, capture acceptance/rejection outcomes, and wire targeted broadcasts/activity logging.

**Validation Rule:** Validate each future slice in dependency order. For docs-only slices, validate discoverability and log integrity before moving on. For package work, use the repo validation matrix from `docs/autonomy/repo-contract.md`.

---

## Candidate File Map

| File | Action | Responsibility |
| --- | --- | --- |
| `docs/superpowers/plans/2026-03-23-ai-optimized-dynamic-routing-engine.md` | Create | Execution plan and slice boundaries for `SSS-API-001` |
| `packages/shared/src/types.ts` | Future inspect/modify | Shared routing recommendation and explanation contracts |
| `packages/shared/src/schemas.ts` | Future inspect/modify | Validation schemas for optimize/predict/override flows |
| `packages/server/src/lib/routing-defaults.ts` | Future inspect/modify | Current static routing adapter to replace or wrap |
| `packages/server/src/routes/orders.ts` | Future inspect/modify | Existing order-routing mutation path and override integration |
| `packages/server/prisma/schema.prisma` | Future inspect only unless gaps remain | Persistence already present for predictions, rules, intelligence, and decisions |
| `packages/web/src/pages/ProductionCalendarPage.tsx` | Future inspect/modify | Existing web consumer of routing arrays |
| `packages/shop-floor/src/stations/*.tsx` | Future inspect/modify | Existing station views that will need recommended-route awareness |

---

## Task 1: Safe Broad-Task Decomposition

- [x] Create or refresh the execution plan for `SSS-API-001`, scoped to independently verifiable slices, and record the slice in centralized autonomy logs.
- [ ] Inventory the current routing producers and consumers, then add a docs-only contract note to this plan covering engine inputs, outputs, ranking factors, override rules, and explicit non-goals.

## Task 2: Shared Contract Hardening

- [ ] Verify whether existing `@erp/shared` routing-intelligence types and schemas already cover recommended route, alternative routes, explanation factors, confidence, and override payloads; patch only shared-package gaps.
- [ ] Validate `@erp/shared` after any contract changes with package-local build/lint commands before opening server work.

## Task 3: Server Routing Engine

- [ ] Implement a server-only routing optimization service that transforms work-order context, station intelligence, equipment status, operator availability, and optimization rules into a ranked route recommendation.
- [ ] Persist predictions and decisions using the existing routing-intelligence Prisma models, keeping manual-override support as a first-class path.
- [ ] Add targeted server tests for deterministic scoring, fallback behavior, and override recording.

## Task 4: API and Event Integration

- [ ] Add focused API surface for requesting optimization, previewing alternatives, and accepting or rejecting recommendations.
- [ ] Wire activity logging and targeted broadcasts only after the server contract and tests are stable.

## Task 5: Web and Shop-Floor Adoption

- [ ] Add web UI surfaces that show recommended routes, confidence, reasoning, and manual-override controls.
- [ ] Update shop-floor station views only after web/API flows prove the payload shape and routing transitions are stable.

## Task 6: Feedback and Rollout

- [ ] Capture accepted vs rejected recommendations and actual route outcomes for future learning loops.
- [ ] Add rollout notes, validation evidence, and follow-up slices for predictive completion times and what-if simulations from the `SSS+` direction.
