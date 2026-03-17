# Performance Optimization Plan

**Date:** 2026-03-16
**Goal:** Resolve slow page loads and API response times across the ERP app

---

## Observed Symptoms (from server logs)

| Endpoint | Response Time | Acceptable |
|----------|--------------|------------|
| `GET /equipment/:id/live-detail` | **26,143ms** | < 3s |
| `GET /equipment/zund/:id/live` | **5,454ms** | < 2s |
| `GET /equipment/thrive/workorder/:orderNumber` | **6,089ms** | < 2s |
| `GET /equipment/workorder/:num/activity` | **588ms** | < 200ms |
| `GET /production-list` | 66ms (83KB payload) | Borderline |
| Most other endpoints | < 100ms | OK |

---

## Phase 1: Parallelize Sequential Network I/O (Critical — biggest wins)

### 1.1 — Equipment Live Detail: 26s → ~5s
**File:** `packages/server/src/routes/equipment.ts` (L373–L618)

**Problem:** 7+ sequential operations to network devices and file shares:
1. DB lookup → 2. SNMP poll → 3. Deep SNMP poll (13 walks × 2s timeout) → 4. Zund stats → 5. TCP port scan → 6. NetBIOS lookup → 7. HP EWS → 8. HP LEDM → 9. VUTEk

**Fix:**
- [ ] Wrap steps 2–9 in `Promise.allSettled()` — they're fully independent
- [ ] Inside `deepPollPrinterStatus()` (`printer-monitor.ts` L890), parallelize the 13 SNMP subtree walks into 3–4 batches instead of fully sequential
- [ ] Add a short TTL cache (30s) on live-detail results so repeat visits don't re-poll

### 1.2 — Zund Live Data: 5.5s → ~2s
**File:** `packages/server/src/services/zund-live.ts` (L446–L700)

**Problem:** 4 data sources scanned sequentially (Statistics DB → Thrive Cut Center → Fiery Export → File Server Queue), each hitting different network shares.

**Fix:**
- [ ] Run all 4 source scans in `Promise.all()` — they're fully independent
- [ ] In `scanZundQueueFiles()`, add a short TTL in-memory cache (60s) so rapid refreshes don't rescan 11k files
- [ ] The WO-matching cross-reference step (L705–L770) also scans Thrive print logs — cache Thrive results from Source 2 to avoid double-fetching

### 1.3 — Thrive WO Endpoint: 6s → ~2s
**File:** `packages/server/src/routes/equipment.ts` (L1520–L1660)

**Problem:** `thriveService.getAllJobs()` reads 14 printer queue XML files from UNC paths sequentially with `for...of` + `await`. Then `scanZundQueueFiles(500)` does another network scan. Then `zundMatchService.getZundCompletedJobs(90)` reads SQLite.

**Fix:**
- [ ] In `thriveService.getAllJobs()` (`thrive.ts` L398), change from sequential `for...of` to `Promise.allSettled()` — each machine/queue is independent
- [ ] Run Thrive job fetch, Zund queue scan, and Zund stats fetch in parallel with `Promise.all()`
- [ ] Add a 30s TTL cache on `getAllJobs()` results (Thrive queues don't change sub-second)

---

## Phase 2: Frontend Code Splitting (High — reduces initial load)

### 2.1 — Lazy Load All Route Pages
**File:** `packages/web/src/App.tsx` (L1–33)

**Problem:** All 30 page components are statically imported — the entire app ships in one massive JS bundle on first load. Every user downloads code for Equipment, Reports, Quotes, Admin, etc. even when just viewing the Dashboard.

**Fix:**
- [ ] Convert all page imports to `React.lazy()`:
  ```tsx
  const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));
  const OrderDetailPage = React.lazy(() => import('./pages/OrderDetailPage'));
  // ... etc for all 30 pages
  ```
- [ ] Wrap `<Routes>` in `<Suspense fallback={<LoadingSpinner />}>` 
- [ ] Keep `LoginPage` as static import (needed immediately)

### 2.2 — Vite Manual Chunk Splitting
**File:** `packages/web/vite.config.ts` (L55–58)

**Problem:** No `manualChunks` config — Vite bundles everything into one or two files.

**Fix:**
- [ ] Add manual chunks for heavy vendor libraries:
  ```ts
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-ui': ['framer-motion', 'lucide-react', 'react-hot-toast'],
          'vendor-charts': ['recharts'],
          'vendor-utils': ['date-fns', 'zod', 'zustand', 'axios'],
        }
      }
    }
  }
  ```

---

## Phase 3: Server-Side Data Optimizations (Medium)

### 3.1 — Dashboard Stats Endpoint
**File:** `packages/web/src/pages/DashboardPage.tsx` (L46–72)

**Problem:** Fetches 100 full order objects (with lineItems, stationProgress, attachments, users) just to compute 7 counters client-side. Massive over-fetch.

**Fix:**
- [ ] Add `GET /api/v1/orders/stats` server endpoint that returns only aggregated counts:
  ```json
  { "total": 150, "pending": 12, "inProgress": 45, "completed": 80, "overdue": 3, ... }
  ```
- [ ] Use Prisma `groupBy` or raw `COUNT` queries — single DB roundtrip
- [ ] Update DashboardPage to call the new endpoint instead of fetching orders

### 3.2 — Fix N+1 in Thrive WO Matching
**File:** `packages/server/src/services/thrive.ts` (L452–475)

**Problem:** `linkJobsToWorkOrders()` does one `prisma.workOrder.findFirst()` per job — N sequential DB queries. The `woCache` helps on repeat calls but first load is slow.

**Fix:**
- [ ] Collect all unique WO numbers, batch-fetch with `prisma.workOrder.findMany({ where: { orderNumber: { in: [...] } } })`
- [ ] Build a lookup map, then map over jobs — single DB roundtrip instead of N

### 3.3 — Add Caching Layer for Network Scans
**Problem:** Every page load that touches equipment/Zund data re-scans network file shares. These shares change infrequently (minutes, not seconds).

**Fix:**
- [ ] Create a simple in-memory cache utility: `cache.get(key, ttlMs, fetchFn)`
- [ ] Apply to: Thrive queue reads (30s TTL), Zund file scans (60s TTL), SNMP polls (30s TTL)
- [ ] Allow manual invalidation via WebSocket broadcast (`CACHE_INVALIDATE`)

### 3.4 — Add Missing Database Index
**File:** `packages/server/prisma/schema.prisma`

- [ ] Add `@@index([companyBrand])` to WorkOrder model (used in filtering)

---

## Phase 4: Optional / Future Enhancements

### 4.1 — Production List Pagination
The `/production-list` returns 83KB in one response. If the order count grows, consider server-side pagination with cursor-based fetching.

### 4.2 — WebSocket Debounced Invalidation
`STATION_UPDATED` events invalidate 5 query keys. In a busy shop, this could cause redundant fetches. Add a 500ms debounce window to batch invalidations.

### 4.3 — Equipment Polling Background Worker
Instead of polling printers on-demand per page view, run a background interval (every 60s) that caches all printer statuses. Page loads would read from cache instantly.

---

## Execution Priority

| Priority | Task | Expected Impact |
|----------|------|-----------------|
| **P0** | 1.1 Parallelize live-detail | 26s → 5s |
| **P0** | 1.2 Parallelize Zund live | 5.5s → 2s |
| **P0** | 1.3 Parallelize Thrive reads | 6s → 2s |
| **P1** | 2.1 Lazy load pages | Faster initial page render |
| **P1** | 1.3 Add TTL cache for network scans | Instant repeat-load for Zund/Thrive |
| **P2** | 2.2 Vite chunk splitting | Smaller JS downloads |
| **P2** | 3.1 Dashboard stats endpoint | Eliminate 83KB over-fetch |
| **P2** | 3.2 Batch WO lookups | Reduce DB roundtrips |
| **P3** | 3.4 Missing index | Minor query speedup |
| **P3** | 4.x Future items | Scaling prep |

---

## Verification Criteria

After implementing each phase, verify:
- [ ] `live-detail` response < 6 seconds
- [ ] `zund/live` response < 2.5 seconds
- [ ] `thrive/workorder` response < 3 seconds
- [ ] Initial page load (Lighthouse) improves by 30%+
- [ ] No TypeScript errors
- [ ] No regressions in data accuracy
