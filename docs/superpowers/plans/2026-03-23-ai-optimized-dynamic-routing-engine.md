# AI-Optimized Dynamic Routing Engine

> For agentic workers: use this plan for `SSS-API-001`. Keep orchestration in the main thread, respect `packages/shared` -> `packages/server` -> `packages/web` -> `packages/shop-floor`, and do not widen beyond one independently verifiable slice at a time.

**Task ID:** `SSS-API-001`

**Goal:** Replace static work-order routing with a dynamic routing engine that scores and recommends station sequences from job attributes, queue depth, operator skills, equipment availability, and business rules, while preserving manual overrides, auditability, and downstream station visibility.

**Current Repo Anchors:**
- `docs/ERP_GAP_ANALYSIS.md` defines `SSS-001` and `SSS-API-001`.
- `packages/server/prisma/schema.prisma` already contains `RoutingPrediction`, `OptimizationRule`, `StationIntelligence`, and `RoutingDecision`.
- `packages/shared/src/types.ts` and `packages/shared/src/schemas.ts` already expose routing-intelligence DTOs and optimization request schemas.
- `packages/server/src/lib/routing-defaults.ts` and `packages/server/src/routes/orders.ts` represent the current static/default routing entry points.
- `packages/server/src/services/woocommerce.ts`, `packages/server/src/routes/templates.ts`, and `packages/server/prisma/seed.ts` also seed or derive routing before the current defaults are applied.
- `packages/shared/src/routing-inference.ts` is the current text-to-routing inference helper used by both server and shop-floor flows.
- `packages/web/src/pages/ProductionCalendarPage.tsx`, `packages/web/src/components/OrderEntryStationView.tsx`, and multiple `packages/shop-floor/src/stations/*.tsx` screens consume routing arrays today.

## Routing Contract Note

The current system has a few distinct routing producers and consumers that this engine must respect instead of silently replacing:

- Producers: `packages/shared/src/routing-inference.ts`, `packages/server/src/lib/routing-defaults.ts`, `packages/server/src/routes/orders.ts`, `packages/server/src/services/woocommerce.ts`, `packages/server/src/routes/templates.ts`, and `packages/server/prisma/seed.ts`.
- Consumers: `packages/web/src/components/OrderEntryStationView.tsx`, `packages/web/src/pages/OrdersPage.tsx`, `packages/web/src/pages/OrderDetailPage.tsx`, `packages/web/src/pages/TemplatesPage.tsx`, `packages/web/src/pages/ProductionCalendarPage.tsx`, `packages/server/src/routes/portal.ts`, `packages/server/src/routes/reports.ts`, `packages/server/src/routes/qrcode.ts`, and the shop-floor station views under `packages/shop-floor/src/stations/`.
- Inputs: work-order metadata, customer/company context, description and notes text, template defaults, imported spreadsheet hints, manual routing edits, current station progress, queue depth, operator skill/access, equipment availability, and business rules.
- Outputs: a ranked route recommendation, alternative routes, score breakdown, confidence, explanation text, and a persisted decision record that can be audited later.
- Ranking factors: hard constraints first, then route eligibility, downstream station requirements, equipment readiness, operator availability, queue load, due-date urgency, and historical route success.
- Override rules: explicit user edits and accepted recommendations always win over computed suggestions; manual route changes must keep the user, reason, and timestamp; the engine must not silently rewrite routing that has already been committed.
- Non-goals for this slice: no UI/API implementation yet, no ML training loop, no historical-order migration, no removal of manual routing controls, and no change to station-completion semantics.

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
- [x] Inventory the current routing producers and consumers, then add a docs-only contract note to this plan covering engine inputs, outputs, ranking factors, override rules, and explicit non-goals.

## Task 2: Shared Contract Hardening

- [x] Verify whether existing `@erp/shared` routing-intelligence types and schemas already cover recommended route, alternative routes, explanation factors, confidence, and override payloads; patch only shared-package gaps.
- [x] Validate `@erp/shared` after any contract changes with package-local build/lint commands before opening server work.

Validation note: `npm run build -w @erp/shared` passes. `npm run lint -w @erp/shared` still reports pre-existing shared-package baseline issues in unrelated files, but the routing contract files touched in this slice are clean.

## Task 3: Server Routing Engine

- [x] Implement a server-only routing optimization service that transforms work-order context, station intelligence, equipment status, operator availability, and optimization rules into a ranked route recommendation.
- [x] Persist predictions and decisions using the existing routing-intelligence Prisma models, keeping manual-override support as a first-class path.
- [x] Add targeted server tests for deterministic scoring, fallback behavior, and override recording.

Validation note: `npx tsc --noEmit -p packages/server/tsconfig.json` passes. `npm run test -w @erp/server -- src/services/routing-optimization.test.ts` passes. `npm run build -w @erp/server` passes.

## Task 4: API and Event Integration

- [x] Add focused API surface for requesting optimization, previewing alternatives, and accepting or rejecting recommendations.
- [x] Wire activity logging and targeted broadcasts only after the server contract and tests are stable.

Validation note: `npx tsc --noEmit -p packages/server/tsconfig.json` passes. `npm run build -w @erp/server` passes. The routing router now exposes preview, optimize, and feedback endpoints under `/api/v1/routing`, and optimize/feedback now log activity plus emit user-targeted websocket events.

## Task 5: Web and Shop-Floor Adoption

- Web UI surfaces should show recommended routes, confidence, reasoning, and manual-override controls.
  - [x] Add an order-detail routing recommendation card that previews the live route, confidence, and reasoning.
  - [ ] Add manual-override controls and the route-application flow in the web UI.
  - [ ] Update shop-floor station views only after the order-detail routing card and API payload shape are stable.

Validation note: `npx tsc --noEmit -p packages/web/tsconfig.json` passes. `npm run build -w @erp/web` passes. The order detail page now renders a live routing preview card from `/api/v1/routing/preview`.

## Task 6: Feedback and Rollout

- [x] Capture accepted vs rejected recommendations and actual route outcomes for future learning loops.
- [ ] Add rollout notes, validation evidence, and follow-up slices for predictive completion times and what-if simulations from the `SSS+` direction.
