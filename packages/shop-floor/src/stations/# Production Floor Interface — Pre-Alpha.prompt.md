# Production Floor Interface — Pre-Alpha Plan

**Target**: 1-week build (5 working days)  
**Goal**: Clean browser-based production interface at `/production` for shop floor workers to find and complete jobs with all supporting data.

## Overview

Convert `packages/station-production/` from a Tauri mock-data shell into a real web SPA served by the ERP Express server at `/production`. Workers open a browser on any shop floor device and get: job list, line items, quantities, proof images, linked emails, Zund/cut data, and print records.

---

## MAJOR TASKS — Foundation (Days 1–3)

Each must be working and verified before moving to the next.

### MAJOR 1: App Shell + Auth Pipeline (Day 1)

Convert station-production from Tauri mock to a real web SPA with working auth and API connectivity.

- Strip Tauri and Electron deps from `packages/station-production/package.json` — remove `@tauri-apps/*`, `electron`
- Add `@erp/shared` dependency for shared types/enums
- Create `src/lib/api.ts` — copy the proven pattern from `packages/shop-floor/src/lib/api.ts` (~72 lines, fetch-based, reads token from auth store)
- Wire the existing auth store (`src/stores/auth.ts`) and config store (`src/stores/config.ts`) to the new API client
- Verify: log in via the existing `LoginModal`, hit `GET /api/v1/orders?limit=1`, confirm a real order comes back in the console

**Done when**: A user can open the app, log in, and the app successfully fetches real data from the ERP API.

---

### MAJOR 2: Live Order Data + WebSocket (Day 2)

Get real work orders flowing into the app with real-time updates.

- Copy the WebSocket hook from `packages/shop-floor/src/lib/useWebSocket.ts` (~97 lines, generic with `onMessage` callback)
- Create a message handler that invalidates TanStack Query keys on `ORDER_UPDATED`, `ORDER_CREATED`, `STATION_PROGRESS` events
- Build `useOrders()` query hook — calls `GET /api/v1/orders` with `status=IN_PROGRESS` filter, `lightweight=true`
- Build `useOrderDetail(id)` query hook — calls `GET /api/v1/orders/:id` which returns `lineItems`, `stationProgress`, `attachments`, `events`, `emailQueue`
- Replace mock data in `StationProgressPanel.tsx` with the real `useOrders()` hook
- Verify: change an order's status in the main ERP web app → confirm the production app updates within seconds without a page refresh

**Done when**: The app shows real IN_PROGRESS orders from the database and auto-updates when orders change.

---

### MAJOR 3: Equipment Data Integration (Day 3)

Get Thrive print records and Zund cut data displaying for real orders.

- Port `PrinterInfoCard.tsx` (~283 lines) from `packages/web/src/components/` — swap 2 imports: replace `api` with station app's fetch client, recreate `formatDateTime` utility (~10 lines)
- Port `ZundInfoCard.tsx` (~376 lines) — same 2 import swaps
- Both call `GET /api/v1/equipment/thrive/workorder/:orderNumber` which returns `{ printJobs, cutJobs, zundCompletedJobs }`
- Test with a real WO# that has print/cut history — verify print jobs show with status, Zund completed jobs show cutting time and material
- Handle the empty state gracefully (orders with no print/cut data yet)

**Done when**: Tapping a real order in the app shows its actual print jobs from Thrive and cut data from the Zund.

---

## NORMAL TASKS — UI Build-Out (Days 4–5)

Foundation is solid. Now build the views using the working data layer.

### NORMAL 1: Job List View (Day 4, AM)

| # | Minor Task |
|---|-----------|
| 1 | Order card component — WO#, customer, description, due date, priority badge |
| 2 | Search/scan input bar — text input that filters by WO# or customer name, doubles as barcode scanner input (keyboard wedge) |
| 3 | Status filter tabs — IN_PROGRESS (default), PENDING, ALL |
| 4 | Sort control — due date (default), priority, WO# |
| 5 | Scroll/pagination — virtual scroll or load-more for large lists |

---

### NORMAL 2: Job Detail — Order Info Sections (Day 4, PM)

| # | Minor Task |
|---|-----------|
| 1 | Detail header — WO#, customer, description, status badge, due date, priority |
| 2 | Station progress bar with complete/uncomplete buttons — calls `POST /api/v1/orders/:id/stations/:station/complete\|uncomplete` |
| 3 | Line items table — item number, description, quantity, unit price, notes (from order detail `lineItems[]`) |
| 4 | Proof image gallery — filter attachments where `fileType === 'PROOF'`, show thumbnails, tap to enlarge, show approval status |
| 5 | Linked emails list — show `emailQueue` records: subject, recipient, sent date, delivery status |

---

### NORMAL 3: Job Detail — Equipment Sections (Day 5, AM — first half)

| # | Minor Task |
|---|-----------|
| 1 | Mount ported `PrinterInfoCard` in detail view, passing `orderNumber` prop |
| 2 | Mount ported `ZundInfoCard` in detail view, passing `orderNumber` prop |
| 3 | Barcode/QR code display — call `GET /api/v1/qrcode/order/:id` and render the QR image |
| 4 | `formatDateTime` + `formatDuration` utility functions for timestamps throughout |
| 5 | Empty states for each section — "No print jobs yet", "No cut data", "No proofs uploaded" |

---

### NORMAL 4: Production Floor UX (Day 5, AM — second half)

| # | Minor Task |
|---|-----------|
| 1 | Touch targets — minimum 48px tap areas on all buttons, cards, tabs |
| 2 | Font sizes — 16px minimum body, 20px+ for WO# and headers |
| 3 | High-contrast color scheme — dark header, clear status colors, readable on shop floor |
| 4 | Responsive layout — works on 1080p monitors and 10"+ tablets |
| 5 | Loading skeletons and error boundaries — no blank screens during data fetch |

---

### NORMAL 5: Build, Serve, Deploy (Day 5, PM)

| # | Minor Task |
|---|-----------|
| 1 | Add `"build:production"` script to root `package.json` |
| 2 | Run build — verify `vite.config.ts` outputs to `dist/` with `base: '/production/'` |
| 3 | Verify Express serves the built app at `http://localhost:8001/production` |
| 4 | Deploy built `dist/` to WS-RACHEL and restart PM2 |
| 5 | Smoke test from a shop floor device — login, browse jobs, open detail, verify all data loads |

---

## Verification Checkpoints

- **Day 3 checkpoint**: App loads at `/production`, login works, real orders display, WebSocket updates flow, print/Zund data shows for orders that have it
- **Day 5 final**: A floor worker can open a browser, log in, find their job (by scrolling or scanning a barcode), see line items + quantities + proofs + emails + print record + Zund data, and mark a station complete — all with real data on a real shop floor device

## Key Decisions

- **Reuse `station-production` package** — Express already serves it at `/production`, just strip Tauri and wire real data
- **Copy shop-floor's API/WebSocket pattern** (fetch-based, ~170 lines) instead of the web app's (axios, 474-line monolith)
- **Port `PrinterInfoCard` + `ZundInfoCard` directly** — 660 lines of tested UI, 2 import swaps each
- **Linked emails = outbound `EmailQueue` records** for pre-alpha — inbound email ingestion is future
- **No admin features** — this interface is strictly for finding and completing jobs

## Key Files

| File | Role |
|------|------|
| `packages/station-production/src/App.tsx` | App shell (keep, modify) |
| `packages/station-production/src/stores/auth.ts` | Auth store (keep) |
| `packages/station-production/src/stores/config.ts` | Config store (keep) |
| `packages/station-production/src/lib/api.ts` | API client (create — copy from shop-floor) |
| `packages/station-production/src/lib/useWebSocket.ts` | WebSocket hook (create — copy from shop-floor) |
| `packages/station-production/src/components/StationProgressPanel.tsx` | Job list (rewrite — replace mock data) |
| `packages/station-production/vite.config.ts` | Build config (keep — already has `/production/` base) |
| `packages/web/src/components/PrinterInfoCard.tsx` | Print records (port) |
| `packages/web/src/components/ZundInfoCard.tsx` | Zund/cut data (port) |
| `packages/shop-floor/src/lib/api.ts` | API client template (copy from) |
| `packages/shop-floor/src/lib/useWebSocket.ts` | WebSocket template (copy from) |
| `packages/server/src/routes/equipment.ts` | Thrive/Zund API (existing, no changes) |
| `packages/server/src/index.ts` | Serves `/production` static files (existing, no changes) |
