# Database Audit: Missing Printing Station Assignments

**Date:** 2026-03-26  
**Status:** CRITICAL

## Executive Summary

**118 out of 192 orders (61.5%) are missing printing station assignments in their routing field.**

All 118 affected orders:
- Have an **empty routing array** `[]`
- Have **NO station progress records at all**
- Cannot be found by batch-RIP queries that search for `routing: { has: FLATBED }`
- Will fail to appear in station dashboards that filter by routing

## Root Cause

The schema default in `packages/shared/src/schemas.ts` line 152:

```typescript
routing: z.array(z.nativeEnum(PrintingMethod)).default([])
```

When clients submit orders without specifying a routing array, Zod fills it with `[]`. Then the server-side `applyRoutingDefaults()` function (line 1140-1142 in `packages/server/src/routes/orders.ts`) **only adds defaults if there are existing printing stations in the input**:

```typescript
const hasPrinting = routing.some((station) => PRINTING_STATIONS.has(station));
if (hasPrinting) {
  // Add PRODUCTION, SHIPPING_RECEIVING, etc.
}
```

**If the client sends `routing: []`, then `hasPrinting` is always false, and no defaults are applied.**

## Impact Analysis

### Affected Orders (Sample)
- Order 64329 (created 2026-03-16)
- Order 64334 (created 2026-03-16)
- Order 63707 (created 2026-03-19)
- Order 64466 (created 2026-03-23)
- Order 64459 (created 2026-03-23)
- ...and 113 more

### Database State
- **Total orders:** 192
- **Missing routing:** 118 (61.5%)
- **With routing:** 74 (38.5%)
  - Example values in use: `FLATBED`, `PRODUCTION`, `SHIPPING_RECEIVING`, `ROLL_TO_ROLL`, `DESIGN`

### System Impact

1. **Batch RIP for HH Global is broken**
   - `getHHGlobalBatches()` in `packages/server/src/services/batch-rip-hh-global.ts` line 71 queries:
     ```typescript
     routing: { has: station }
     ```
   - None of the 118 orders will match this filter, so they won't be batched

2. **Station dashboards won't show orders**
   - Any query filtering by `routing: { hasSome: [stations] }` (line 414 in orders.ts) will miss these orders

3. **Station progress can't be created**
   - Even though line 1207-1211 tries to create station progress records:
     ```typescript
     stationProgress: {
       create: routing.map((station) => ({...}))
     }
     ```
   - With empty routing, this creates **zero** station progress records

4. **Order flow is broken**
   - Orders have no assigned stations, so they're orphaned
   - Users can't see which station should process them

## Recommended Fix Approach

### Option A: Fix at Order Creation (PREFERRED)

**Location:** `packages/server/src/routes/orders.ts` lines 1140-1142

Apply routing defaults **even for empty routing arrays:**

```typescript
const routing = applyRoutingDefaults(data.routing || [], {
  description: data.description,
});
```

**Why this works:**
- If description is "Widget with (INSTALL)", `applyRoutingDefaults` will detect this and add INSTALLATION, PRODUCTION, etc.
- If description is generic, we can infer from description: "3M adhesive vinyl" → suggests printing station
- Uses existing `inferRoutingFromDescription()` logic (line 100 in routing-defaults.ts)

**Pros:**
- Prevents the problem going forward
- Client-side doesn't need to change
- Uses existing inference logic

**Cons:**
- Existing 118 orders still need manual cleanup

### Option B: Infer from Description (SAFER)

Modify `applyRoutingDefaults()` in `packages/server/src/lib/routing-defaults.ts` to:

1. If routing is empty AND description exists, call `inferRoutingFromDescription()`
2. Fall back to a sensible default (e.g., `[PRODUCTION, SHIPPING_RECEIVING]`)

```typescript
export function applyRoutingDefaults(
  routing: PrintingMethod[],
  options?: {
    description?: string;
    needsProof?: boolean;
  },
): PrintingMethod[] {
  const routingSet = new Set(routing);
  const description = options?.description ?? '';
  
  // If routing is empty, infer from description first
  if (routingSet.size === 0 && description) {
    inferRoutingFromDescription(description).forEach((s) => routingSet.add(s));
  }
  
  // Apply other rules...
  const hasPrinting = routing.some((station) => PRINTING_STATIONS.has(station));
  // ...
}
```

**Pros:**
- More intelligent default assignment
- Works for design-only, installation, outsourced orders

**Cons:**
- Might misclassify some orders

### Option C: Bulk Update Script (CLEANUP)

For the existing 118 orders, create a migration script:

```typescript
// Quick fix: Assign generic routing to all empty orders
const missing = await prisma.workOrder.findMany({
  where: { routing: { equals: [] } }
});

for (const order of missing) {
  const inferred = inferRoutingFromDescription(order.description || '');
  const defaultRouting = inferred.length > 0 
    ? inferred 
    : [PrintingMethod.PRODUCTION, PrintingMethod.SHIPPING_RECEIVING];
  
  await prisma.workOrder.update({
    where: { id: order.id },
    data: { 
      routing: defaultRouting,
      stationProgress: {
        create: defaultRouting.map((station) => ({
          station,
          status: 'NOT_STARTED'
        }))
      }
    }
  });
}
```

## Verification Checks

### Pre-Fix
```bash
npm run db:studio
# Query: SELECT COUNT(*) FROM WorkOrder WHERE routing = '[]'
# Expected: 118
```

### Post-Fix
```typescript
const emptyRouting = await prisma.workOrder.count({
  where: { routing: { equals: [] } }
});
console.assert(emptyRouting === 0, 'All orders should have routing assigned');

// All orders should have station progress records
const withoutProgress = await prisma.workOrder.findMany({
  where: {
    stationProgress: {
      none: {}
    }
  },
  select: { orderNumber: true }
});
console.assert(withoutProgress.length === 0, 'All orders should have station progress');
```

## Recommended Action

1. **Immediate:** Fix `applyRoutingDefaults()` to handle empty arrays (Option A)
2. **Short-term:** Run bulk update script to fix 118 existing orders (Option C)
3. **Verification:** Run checks above to confirm routing is populated
4. **Test:** Verify HH Global batch-RIP can now find orders with `routing: { has: FLATBED }`

## Files to Modify

- `packages/shared/src/schemas.ts` (optional: change default to `null` or required field)
- `packages/server/src/lib/routing-defaults.ts` (add inference for empty arrays)
- `packages/server/src/routes/orders.ts` (ensure routing is never empty on create)

## Related Code References

- Schema default: `packages/shared/src/schemas.ts:152`
- Order creation: `packages/server/src/routes/orders.ts:1107-1225`
- Routing defaults: `packages/server/src/lib/routing-defaults.ts:48-93`
- Batch RIP query: `packages/server/src/services/batch-rip-hh-global.ts:68-91`
- Station dashboard filter: `packages/server/src/routes/orders.ts:410-415`
