# Shop Floor Plan - Mar 23

## Summary

- Rework Shop Floor into consistent station workspaces built around three things: a live order list, station-specific tools, and real offline capability.
- Turn Printing into a Roll-to-Roll + Flatbed workspace only, and bring the ERP RIP Queue workflow into that page by reusing the existing RIP APIs and file-chain data.
- Move Screen Printing out of Printing and into Production, and treat Fabrication as Production-side work anywhere it appears in order progress or reporting.
- Build offline support as shared infrastructure for all Shop Floor stations rather than one-off per-page logic.

## Current Findings

- `packages/shop-floor/src/stations/PrintingStation.tsx` hardcodes `ROLL_TO_ROLL | FLATBED | SCREEN_PRINT` and is built around station progress, not the ERP RIP queue workflow.
- `packages/shop-floor/src/stations/ProductionStation.tsx` is a generic production list with cut-folder tools, reprint/material/revision actions, and no screen-print ownership.
- `packages/web/src/pages/RipQueuePage.tsx` already has the operator workflow needed for RIP Dashboard, Jobs, and Send to RIP, backed by `/rip-queue/*`.
- `packages/shop-floor/src/App.tsx` and `packages/shop-floor/src/components/StationPicker.tsx` still classify Screen Print as part of Printing.
- Shop Floor currently has only partial offline behavior: persisted auth/config, online/offline banners, and at least one explicit offline TODO in Installation. There is no shared cached-order layer or replay queue.
- Backend behavior already treats screen print and fabrication as production-adjacent in key places:
  - material deduction on station completion includes `SCREEN_PRINT` and `FABRICATION`
  - order auto-advance includes `SCREEN_PRINT`
  - production/reporting logic already recognizes fabrication as production-side work

## Target UX

### Shared station pattern

- Every station screen uses the same shell:
  - station header with connection state, last sync time, pending offline action count, and manual sync
  - searchable order list
  - detail/tool pane for the selected order
  - consistent loading, empty, error, and offline-cached states
- Cached data stays visible when offline.
- Mutations can be drafted/queued locally when appropriate and replayed when the app reconnects.

### Printing workspace

- Printing becomes RR/FB only. Screen Print is removed from:
  - station access mapping
  - station filters
  - station badges
  - detail actions
  - default allowed-station fallbacks
- Printing page layout becomes a single workspace with four tabs:
  - `Orders`
  - `RIP Dashboard`
  - `RIP Jobs`
  - `Send to RIP`
- `Orders` keeps the current station-progress workflow for RR/FB orders, including line-item completion/material grouping.
- `RIP Dashboard`, `RIP Jobs`, and `Send to RIP` reuse the existing RIP backend and status model instead of inventing a second queue system.
- `Send to RIP` is order-centric inside Shop Floor:
  - selected order pre-fills the work order
  - file-chain data is used to surface known print files first
  - Tauri file/folder helpers are used to pick/open files when available
  - manual UNC path entry remains as browser/dev fallback

### Production workspace

- Production becomes the home for:
  - `PRODUCTION`
  - `SCREEN_PRINT`
  - production-side labels such as `FABRICATION`, `CUT`, `PRODUCTION_ZUND`, `PRODUCTION_FINISHING`
- Production page keeps its existing tools:
  - open cut file
  - open work-order folder
  - material request
  - reprint request
  - revision request
  - mark order complete
- Production page also inherits the screen-print-specific workflow currently living in Printing:
  - screen-print queue visibility
  - screen-print station start/complete/uncomplete actions
  - screen-print line-item completion when the active substation is `SCREEN_PRINT`
- Production filters are fixed as:
  - `All`
  - `Production`
  - `Screen Print`
  - `Fabrication`
- Fabrication is treated as a Production display classification in this phase. No new top-level Shop Floor station is introduced.

## Implementation Order

Follow the repo dependency order: `packages/shared` -> `packages/server` -> `packages/web` -> `packages/shop-floor`.

### 1. Shared

- Add shared station-group helpers/constants for Shop Floor:
  - `PRINTING_WORKSPACE_METHODS = [ROLL_TO_ROLL, FLATBED]`
  - `PRODUCTION_WORKSPACE_METHODS = [PRODUCTION, SCREEN_PRINT]`
  - production-side progress recognition for `FABRICATION`, `CUT`, `PRODUCTION_ZUND`, and `PRODUCTION_FINISHING`
- Keep `SCREEN_PRINT` as a valid enum/routing value. Do not remove or rename schema values in this phase.
- Export RIP queue display/status constants needed by both ERP web and Shop Floor so Shop Floor uses the same labels, colors, and status names.

### 2. Server

- Reuse the existing `RipJob`, `PrintCutLink`, `/rip-queue/*`, and `/file-chain/orders/:orderId` flow. Do not replace the current RIP backend.
- Add idempotent replay support for offline Shop Floor mutations:
  - add a small server-side receipt table keyed by `clientRequestId + userId`
  - store the final response for successful mutations
  - return the stored result on replay instead of creating duplicates
- Apply idempotency to:
  - station start/complete/uncomplete and generic station-progress updates
  - order complete
  - reprint, revision, and material requests
  - installation session create
  - shipping/QC mutations
  - RIP send
  - RIP status updates
- Keep ERP/web RIP endpoints intact; only add a new aggregated Shop Floor endpoint if performance proves the current multi-call approach too heavy after the first implementation pass.
- Align any production-side filtering helpers used by Shop Floor so `SCREEN_PRINT` and `FABRICATION` consistently resolve to Production-side UI grouping.

### 3. Web ERP

- Leave `packages/web/src/pages/RipQueuePage.tsx` as the ERP/admin reference implementation.
- Extract only non-UI helpers/constants into shared if Shop Floor needs them.
- Do not make Shop Floor depend on `packages/web` components directly.
- Update admin/user-management copy so Screen Printing is described as production-side work. New staffing should assign Production access for screen-print operators even if legacy `SCREEN_PRINT` values still exist on users/orders.

### 4. Shop Floor shell + Printing

- Create a reusable workspace shell in Shop Floor for:
  - header
  - search/filter bar
  - order list
  - detail pane
  - sync/offline indicators
  - cached/offline/pending states
- Refactor `PrintingStation` to consume only RR/FB orders.
- Replace the current bespoke printing-only layout with:
  - `Orders` tab using current RR/FB station actions
  - `RIP Dashboard` tab using `/rip-queue/dashboard`
  - `RIP Jobs` tab using `/rip-queue/jobs` and `/rip-queue/jobs/:id/status`
  - `Send to RIP` tab using `/rip-queue/hotfolders`, `/rip-queue/validate-file`, `/rip-queue/jobs`, and `/file-chain/orders/:orderId`
- Keep printing line-item completion/material grouping, but scope it to RR/FB only.
- Show a per-order RIP summary in the detail pane when the selected order already has print-cut links or RIP jobs.

### 5. Shop Floor Production

- Refactor `ProductionStation` into the owner of Production + Screen Print + Fabrication-like work.
- Move all screen-print-specific logic out of `PrintingStation` and into Production:
  - station access rules
  - queue filtering
  - progress badges
  - station actions
  - line-item completion UI for screen-print work
- Preserve existing production tools and place them in the same detail pane so the operator sees both order info and action tools together.
- Add production filter chips with fixed behavior:
  - `All`: any order containing production-side work
  - `Production`: orders with `PRODUCTION` or production sub-stations
  - `Screen Print`: orders with `SCREEN_PRINT`
  - `Fabrication`: any order exposing `FABRICATION` in progress or related status data

### 6. Remaining stations + offline

- Standardize Design, Shipping, Installation, and Order Entry onto the shared shell pattern without changing their core workflows first.
- Implement a shared offline store in Shop Floor using IndexedDB:
  - cached order lists and station snapshots per station
  - cached RIP dashboard/job data for Printing
  - pending action queue with payload, user, timestamp, station, and retry state
- Replay rules:
  - station actions, QC/checklists, install sessions, reprint/revision/material requests, and file registration can queue and replay automatically on reconnect
  - RIP submissions are stored as local drafts while offline and are only sent after reconnect
  - Shop Floor must not directly copy files to hotfolders from the client while offline in this phase
- Add a shared sync engine:
  - retries on reconnect
  - manual retry from the header
  - surfaces failed queued actions so operators can fix or discard them

## Acceptance Criteria

- Printing no longer exposes Screen Print anywhere in Shop Floor UI or fallback access logic.
- Production shows screen-print work and tools without losing existing production functionality.
- A user who only has `SCREEN_PRINT` access can enter Production and cannot enter Printing.
- RIP operations performed in Shop Floor create and update the same RIP jobs used by the ERP web app.
- File-chain links remain attached when a file is sent to RIP from Shop Floor.
- Offline behavior works across the app:
  - last synced station lists remain visible with no network
  - pending actions survive app restart
  - reconnect replays actions idempotently
  - offline RIP submissions stay as drafts until reconnect instead of creating duplicate queue entries
- Design, Shipping, Installation, and Order Entry still work after the shell/offline refactor and gain cached-order visibility when offline.

## Assumptions

- This phase changes Shop Floor grouping and workflow ownership, not the underlying `PrintingMethod` enum or historical order routing values.
- `SCREEN_PRINT` remains a valid route and progress value; it is simply surfaced under Production in Shop Floor.
- `FABRICATION` remains a production-side classification unless a later phase promotes it to a first-class routing enum and UI station.
- Shop Floor reuses the server APIs and shared domain helpers; it does not embed the ERP web page or import `packages/web` UI directly.
