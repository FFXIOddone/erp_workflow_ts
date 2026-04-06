# AI-Optimized Dynamic Routing Engine

> Active plan for `SSS-API-001`. Keep this doc small: the server, web order-detail, and feedback slices are done; the only remaining work is shop-floor adoption.

**Goal:** Replace static work-order routing with a deterministic routing engine that ranks station sequences from job attributes, station intelligence, and business rules while preserving manual overrides and auditability.

## Current Status
- Shared routing contracts are in place.
- Server routing optimization, preview, and feedback endpoints are in place.
- The order-detail routing card and apply flow are in place.
- Feedback capture and routing outcome logging are in place.
- The only open slice is updating shop-floor station views to consume the same routing payloads and presentation rules.

## Remaining Slice
- Update shop-floor station views to render the recommended route, confidence, reasoning, and override state from the shared routing contract.
- Reuse the shared routing presentation and keep the shop-floor UI aligned with the order-detail card instead of introducing a second route renderer.
- Validate the affected shop-floor package and then stop; do not widen this plan into new routing engine work.

## Assumptions
- All earlier slices are complete and the remaining work is limited to shop-floor adoption.
- Dependency order still applies: `packages/shared` -> `packages/server` -> `packages/web` -> `packages/shop-floor`.
