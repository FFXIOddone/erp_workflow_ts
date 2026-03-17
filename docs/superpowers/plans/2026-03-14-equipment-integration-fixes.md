# Equipment Integration Fixes — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up the 5 remaining equipment monitoring gaps so that live data flows end-to-end, persists across restarts, and displays within milliseconds.

**Architecture:** Add an in-memory EWS data cache (`ewsDataCache`) alongside the existing `statusCache` in printer-monitor.ts. Populate it from the `live-detail` route (which already fetches EWS/LEDM data) and from a new background poll in `ensureEquipmentDataLoaded`. Hydrate all in-memory caches from the Postgres `EquipmentDataCache` on cold start so watch rules and UI always have data instantly. Broadcast `EQUIPMENT_WATCH_ALERT` over WebSocket when background watch rules fire.

**Tech Stack:** TypeScript, Express, Prisma, WebSocket, EWS/LEDM/SNMP polling (existing services)

**Key constraint from user:** Equipment detail/status pages must load within milliseconds. All live data comes from in-memory caches; network polls happen in the background. The UI never waits for a network round-trip to a printer.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `packages/server/src/services/printer-monitor.ts` | Modify | Add `ewsDataCache` Map + get/set/getAll exports |
| `packages/server/src/services/equipment-watch.ts` | Modify | Implement HP printhead/maintenance evaluators, hydrate from Postgres on cold start, broadcast WS on alert |
| `packages/server/src/routes/equipment.ts` | Modify | Cache EWS data after polling in live-detail route, persist to `EquipmentDataCache` on poll cycles |
| `packages/server/seed-equipment.ts` | Modify | Add VUTEk controller record (.60) |
| `packages/web/src/hooks/useWebSocket.ts` | Modify | Handle `EQUIPMENT_WATCH_ALERT` event |

---

## Chunk 1: EWS Data Cache + Printhead/Maintenance Evaluators

### Task 1: Add EWS data cache to printer-monitor.ts

**Files:**
- Modify: `packages/server/src/services/printer-monitor.ts` (after line ~1361, the existing cache exports)

- [ ] **Step 1: Add EWS cache storage and exports**

Add at the bottom of `printer-monitor.ts`, after the existing cache exports:

```typescript
// ─── EWS/LEDM data cache (printheads, maintenance, rich ink) ─────────────
import type { EWSData } from './hp-ews.js';

const ewsDataCache = new Map<string, { data: EWSData; cachedAt: number }>();
const EWS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes — background poll refreshes this

export function getCachedEWSData(equipmentId: string): EWSData | null {
  const entry = ewsDataCache.get(equipmentId);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > EWS_CACHE_TTL_MS) return null;
  return entry.data;
}

export function getAllCachedEWSData(): Map<string, EWSData> {
  const result = new Map<string, EWSData>();
  const now = Date.now();
  for (const [id, entry] of ewsDataCache) {
    if (now - entry.cachedAt <= EWS_CACHE_TTL_MS) {
      result.set(id, entry.data);
    }
  }
  return result;
}

export function setCachedEWSData(equipmentId: string, data: EWSData): void {
  ewsDataCache.set(equipmentId, { data, cachedAt: Date.now() });
}
```

- [ ] **Step 2: Verify server compiles**

Run: `npx tsc --noEmit --project packages/server/tsconfig.json`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/services/printer-monitor.ts
git commit -m "feat(equipment): add EWS data cache to printer-monitor"
```

---

### Task 2: Cache EWS data from live-detail route

**Files:**
- Modify: `packages/server/src/routes/equipment.ts` (lines 533-572, the EWS polling section in live-detail)

- [ ] **Step 1: Import setCachedEWSData**

In the import block from `printer-monitor.js` (line ~17), add `setCachedEWSData`:

```typescript
import {
  pollPrinterStatus,
  checkDeviceConnectivity,
  pollAllEquipment,
  getAllCachedStatuses,
  setCachedStatus,
  getLastPollTime,
  setLastPollTime,
  POLL_INTERVAL_MS,
  deepPollPrinterStatus,
  setCachedEWSData,
} from '../services/printer-monitor.js';
```

- [ ] **Step 2: Cache EWS data after successful polls**

After `result.ews = ewsData;` (line ~544), add:
```typescript
setCachedEWSData(req.params.id, ewsData);
```

After `result.ews = ledmData;` (line ~561), add:
```typescript
setCachedEWSData(req.params.id, ledmData);
```

- [ ] **Step 3: Verify server compiles**

Run: `npx tsc --noEmit --project packages/server/tsconfig.json`

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/routes/equipment.ts
git commit -m "feat(equipment): cache EWS/LEDM data from live-detail route"
```

---

### Task 3: Implement HP Printhead and Maintenance evaluators

**Files:**
- Modify: `packages/server/src/services/equipment-watch.ts` (lines 176-197)

- [ ] **Step 1: Import EWS cache functions**

Add to the imports (after line 19):
```typescript
import { getCachedEWSData, getAllCachedEWSData } from './printer-monitor.js';
```

(Update existing import line to include these.)

- [ ] **Step 2: Replace evaluateHPPrinthead stub**

Replace lines 176-187 with:
```typescript
function evaluateHPPrinthead(
  metricField: string,
  operator: WatchRuleOperator,
  threshold: number,
  equipmentId: string | null,
): TriggeredItem[] {
  const items: TriggeredItem[] = [];

  if (equipmentId) {
    const ews = getCachedEWSData(equipmentId);
    if (ews?.printheads?.length) {
      for (const ph of ews.printheads) {
        const value = metricField === 'healthGaugeLevel'
          ? ph.healthGaugeLevel
          : (ph as any)[metricField];
        if (typeof value !== 'number' || value < 0) continue;
        if (compare(value, operator, threshold)) {
          items.push({
            label: `Printhead ${ph.slotId} (${ph.colors?.join('/') || 'Unknown'})`,
            currentValue: Math.round(value * 100) / 100,
            threshold,
            equipmentName: ews.identity?.productName || `Equipment`,
          });
        }
      }
    }
  } else {
    // Evaluate across all cached HP equipment
    const allEws = getAllCachedEWSData();
    for (const [_eqId, ews] of allEws) {
      if (!ews?.printheads?.length) continue;
      for (const ph of ews.printheads) {
        const value = metricField === 'healthGaugeLevel'
          ? ph.healthGaugeLevel
          : (ph as any)[metricField];
        if (typeof value !== 'number' || value < 0) continue;
        if (compare(value, operator, threshold)) {
          items.push({
            label: `Printhead ${ph.slotId} (${ph.colors?.join('/') || 'Unknown'})`,
            currentValue: Math.round(value * 100) / 100,
            threshold,
            equipmentName: ews.identity?.productName || `Equipment`,
          });
        }
      }
    }
  }

  return items;
}
```

- [ ] **Step 3: Replace evaluateHPMaintenance stub**

Replace lines 189-197 with:
```typescript
function evaluateHPMaintenance(
  metricField: string,
  operator: WatchRuleOperator,
  threshold: number,
  equipmentId: string | null,
): TriggeredItem[] {
  const items: TriggeredItem[] = [];

  const evalEws = (ews: import('./hp-ews.js').EWSData, eqName: string) => {
    if (!ews?.maintenance?.length) return;
    for (const mi of ews.maintenance) {
      const value = metricField === 'levelPercent'
        ? mi.levelPercent
        : (mi as any)[metricField];
      if (typeof value !== 'number' || value < 0) continue;
      if (compare(value, operator, threshold)) {
        items.push({
          label: mi.name || mi.type || 'Maintenance Item',
          currentValue: Math.round(value * 100) / 100,
          threshold,
          equipmentName: eqName,
        });
      }
    }
  };

  if (equipmentId) {
    const ews = getCachedEWSData(equipmentId);
    if (ews) evalEws(ews, ews.identity?.productName || 'Equipment');
  } else {
    const allEws = getAllCachedEWSData();
    for (const [_eqId, ews] of allEws) {
      evalEws(ews, ews.identity?.productName || 'Equipment');
    }
  }

  return items;
}
```

- [ ] **Step 4: Verify server compiles**

Run: `npx tsc --noEmit --project packages/server/tsconfig.json`

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/services/equipment-watch.ts
git commit -m "feat(equipment): implement HP printhead and maintenance evaluators"
```

---

## Chunk 2: Postgres Persistence + Cold-Start Hydration

### Task 4: Persist poll data to EquipmentDataCache

**Files:**
- Modify: `packages/server/src/routes/equipment.ts` (live-status handler, lines 156-197)

- [ ] **Step 1: Add Postgres cache write after bulk poll**

In the `live-status` GET handler, after the `for` loop that calls `setCachedStatus()` (around line 188), add a fire-and-forget Postgres upsert:

```typescript
// Persist to EquipmentDataCache for cold-start hydration (fire-and-forget)
Promise.allSettled(
  Array.from(results.entries()).map(([eqId, status]) =>
    prisma.equipmentDataCache.upsert({
      where: { sourceType_sourceKey: { sourceType: 'PRINTER_STATUS', sourceKey: eqId } },
      update: { data: status as any, capturedAt: new Date(), cachedAt: new Date() },
      create: {
        equipmentId: eqId,
        sourceType: 'PRINTER_STATUS',
        sourceKey: eqId,
        data: status as any,
        capturedAt: new Date(),
      },
    })
  )
).catch(() => {});
```

- [ ] **Step 2: Also persist EWS data from live-detail route**

After each `setCachedEWSData()` call added in Task 2, add:

After the EWS cache line:
```typescript
// Persist EWS data to Postgres (fire-and-forget)
prisma.equipmentDataCache.upsert({
  where: { sourceType_sourceKey: { sourceType: 'HP_EWS', sourceKey: req.params.id } },
  update: { data: ewsData as any, capturedAt: new Date(), cachedAt: new Date() },
  create: {
    equipmentId: req.params.id,
    sourceType: 'HP_EWS',
    sourceKey: req.params.id,
    data: ewsData as any,
    capturedAt: new Date(),
  },
}).catch(() => {});
```

Same pattern after the LEDM cache line, using `ledmData`.

- [ ] **Step 3: Verify server compiles**

Run: `npx tsc --noEmit --project packages/server/tsconfig.json`

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/routes/equipment.ts
git commit -m "feat(equipment): persist poll data to EquipmentDataCache in Postgres"
```

---

### Task 5: Hydrate in-memory caches from Postgres on cold start

**Files:**
- Modify: `packages/server/src/services/equipment-watch.ts` (ensureEquipmentDataLoaded, lines 36-83)

- [ ] **Step 1: Import setCachedEWSData**

Update the import from printer-monitor to include `setCachedEWSData`:
```typescript
import { getAllCachedStatuses, setCachedStatus, pollAllEquipment, getCachedEWSData, getAllCachedEWSData, setCachedEWSData } from './printer-monitor.js';
```

- [ ] **Step 2: Add Postgres hydration to ensureEquipmentDataLoaded**

Replace the `ensureEquipmentDataLoaded` function with:

```typescript
async function ensureEquipmentDataLoaded(): Promise<void> {
  const now = Date.now();
  if (now - lastAutoLoadTime < AUTO_LOAD_INTERVAL_MS) return;

  const promises: Promise<unknown>[] = [];

  // Check if printer/equipment cache is empty
  const cachedStatuses = getAllCachedStatuses();
  if (cachedStatuses.size === 0) {
    console.log('⚡ [Equipment Watch] Printer cache empty — hydrating from Postgres...');
    promises.push(
      prisma.equipmentDataCache
        .findMany({
          where: {
            sourceType: { in: ['PRINTER_STATUS', 'HP_EWS'] },
            cachedAt: { gte: new Date(now - 30 * 60 * 1000) }, // Last 30 minutes only
          },
        })
        .then(async (rows: any[]) => {
          let hydratedStatus = 0;
          let hydratedEws = 0;
          for (const row of rows) {
            if (row.sourceType === 'PRINTER_STATUS' && row.equipmentId) {
              setCachedStatus(row.equipmentId, row.data as any);
              hydratedStatus++;
            } else if (row.sourceType === 'HP_EWS' && row.equipmentId) {
              setCachedEWSData(row.equipmentId, row.data as any);
              hydratedEws++;
            }
          }
          if (hydratedStatus > 0 || hydratedEws > 0) {
            console.log(`⚡ [Equipment Watch] Hydrated from Postgres: ${hydratedStatus} statuses, ${hydratedEws} EWS records`);
          }

          // If Postgres had nothing, fall back to live poll
          if (hydratedStatus === 0) {
            console.log('⚡ [Equipment Watch] No Postgres cache — polling all equipment...');
            const equipList = await prisma.equipment.findMany({ where: { ipAddress: { not: null } } });
            if (equipList.length) {
              const toPoll = equipList.map((e: any) => ({
                id: e.id,
                ipAddress: e.ipAddress!,
                connectionType: e.connectionType || 'PING',
                snmpCommunity: e.snmpCommunity || 'public',
              }));
              const results = await pollAllEquipment(toPoll);
              for (const [eqId, status] of results) {
                setCachedStatus(eqId, status);
              }
              console.log(`⚡ [Equipment Watch] Polled ${results.size} devices`);
            }
          }
        })
        .catch((err: unknown) => console.error('⚡ [Equipment Watch] Hydration failed:', err))
    );
  }

  // Check if VUTEk ink cache is empty
  const inkData = getCachedVUTEkInkData();
  if (!inkData) {
    console.log('⚡ [Equipment Watch] VUTEk ink cache empty — polling...');
    promises.push(
      pollVUTEkInk()
        .then(d => console.log(`⚡ [Equipment Watch] VUTEk ink loaded: ${d.currentBags?.length ?? 0} bags`))
        .catch((err: unknown) => console.error('⚡ [Equipment Watch] VUTEk poll failed:', err))
    );
  }

  // Check if EWS cache is empty (even if status cache was hydrated, EWS may not have been)
  const ewsCache = getAllCachedEWSData();
  if (ewsCache.size === 0) {
    // Already handled above in the Postgres hydration path
  }

  if (promises.length > 0) {
    await Promise.allSettled(promises);
  }

  lastAutoLoadTime = now;
}
```

- [ ] **Step 3: Verify server compiles**

Run: `npx tsc --noEmit --project packages/server/tsconfig.json`

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/services/equipment-watch.ts
git commit -m "feat(equipment): hydrate caches from Postgres on cold start"
```

---

## Chunk 3: VUTEk Seed Fix + WebSocket Broadcast

### Task 6: Add VUTEk Controller to seed

**Files:**
- Modify: `packages/server/seed-equipment.ts` (line 49, after the existing EFI VUTEk entry)

- [ ] **Step 1: Add VUTEk controller record**

After the existing EFI VUTEk entry (line 49), add:
```typescript
  {
    name: 'VUTEk GS3250LX Pro (Controller)',
    type: 'Printer',
    manufacturer: 'EFI',
    model: 'GS3250LX Pro',
    station: PrintingMethod.FLATBED,
    status: EquipmentStatus.OPERATIONAL,
    ipAddress: '192.168.254.60',
    connectionType: 'SSH',
    location: 'Production Floor',
    notes: 'VUTEk printer controller (Ubuntu 10.04). SSH for ink levels, JMF for status. Fiery DFE is at .57.',
  },
```

- [ ] **Step 2: Update the existing EFI VUTEk notes to clarify it is the Fiery DFE**

Change the existing entry's notes (line 48) to:
```typescript
    notes: 'VUTEk Fiery DFE workstation (.57). JDF metadata on EFI Export Folder share. Printer controller is at .60.',
```

- [ ] **Step 3: Commit**

```bash
git add packages/server/seed-equipment.ts
git commit -m "feat(equipment): add VUTEk controller (.60) to seed, clarify Fiery DFE (.57)"
```

---

### Task 7: Broadcast EQUIPMENT_WATCH_ALERT from scheduler

**Files:**
- Modify: `packages/server/src/services/equipment-watch.ts` (processEquipmentWatchRules, after successful email send ~line 481)
- Modify: `packages/web/src/hooks/useWebSocket.ts` (equipment case block, line ~344)

- [ ] **Step 1: Import broadcast in equipment-watch service**

Add to imports:
```typescript
import { broadcast } from '../ws/server.js';
```

- [ ] **Step 2: Broadcast after successful scheduled send**

After `if (success) sent++;` (line ~481), add:
```typescript
      // Notify connected clients that a watch rule fired
      broadcast({
        type: 'EQUIPMENT_WATCH_ALERT' as any,
        payload: {
          ruleId: rule.id,
          ruleName: rule.name,
          itemCount: items.length,
          sentAt: now.toISOString(),
        },
        timestamp: new Date(),
      });
```

- [ ] **Step 3: Handle in useWebSocket.ts**

After the equipment events case block (after line ~344), add a new case:
```typescript
        // Equipment watch alert events
        case 'EQUIPMENT_WATCH_ALERT' as WsMessageType:
          queryClient.invalidateQueries({ queryKey: ['equipment-watch-rules'] });
          break;
```

- [ ] **Step 4: Verify both server and web compile**

Run: `npx tsc --noEmit --project packages/server/tsconfig.json`
Run: `npx tsc --noEmit --project packages/web/tsconfig.json`

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/services/equipment-watch.ts packages/web/src/hooks/useWebSocket.ts
git commit -m "feat(equipment): broadcast EQUIPMENT_WATCH_ALERT over WebSocket"
```

---

## Performance Note

The user requires millisecond-level display times. This plan ensures that:
- **All UI reads come from in-memory caches** — never blocking on network polls to printers.
- **Background polls** (15s for live-status, 10s TTL for EWS, 60s for VUTEk) keep caches fresh without blocking requests.
- **Cold start** hydrates from Postgres (fast DB read) before falling back to slow network polls.
- **Postgres writes are fire-and-forget** — `Promise.allSettled().catch(() => {})` so they never block the response.
