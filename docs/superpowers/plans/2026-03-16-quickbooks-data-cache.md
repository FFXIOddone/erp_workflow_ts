# QuickBooks Data Cache / Dump Plan

**Date**: 2026-03-16  
**Status**: Planned  
**Goal**: Decouple ERP line-item linkage from a live QuickBooks ODBC connection by caching QB data locally.

---

## Problem

The ERP links work orders to QuickBooks invoices/sales orders to pull in line items. Currently this requires:
- CHRISTINA-NEW (or wildesigns3cx) to be powered on
- QuickBooks Desktop to be open on that machine  
- ODBC driver connectivity over the LAN

If any of these fails, line items can't be loaded. The ODBC connection has a 60-second cooldown and 8-second per-attempt timeout.

## Proposed Solution: QB Snapshot Cache

### Architecture

```
[QB Desktop] --(ODBC when available)--> [Snapshot Service] --> [QBCachedOrder table]
                                                                       |
[CSV/IIF Upload] --> [Import Endpoint] ----> [QBCachedOrder table]     |
                                                                       |
[ERP Work Order] <------ line items pulled from cache first <----------+
                             |
                             +--> fallback to live ODBC if cache miss
```

### New Prisma Models

```prisma
model QBCachedOrder {
  id            String   @id @default(uuid())
  refNumber     String   // Invoice/SO/Estimate number (QB RefNumber)
  txnId         String?  // QB TxnID (null for CSV imports)
  type          String   // 'invoice' | 'salesOrder' | 'estimate'
  customerName  String
  totalAmount   Float    @default(0)
  poNumber      String?
  txnDate       DateTime?
  memo          String?
  snapshotDate  DateTime @default(now()) // When this was cached
  source        String   @default("odbc") // 'odbc' | 'csv' | 'iif' | 'manual'
  lineItems     QBCachedLineItem[]

  @@unique([refNumber, type])
  @@index([customerName])
  @@index([txnDate])
}

model QBCachedLineItem {
  id          String @id @default(uuid())
  orderId     String
  order       QBCachedOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)
  lineNumber  Int
  itemName    String?
  description String?
  quantity    Float?
  rate        Float?
  amount      Float   @default(0)
  unit        String?
}
```

### New Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/quickbooks/snapshot` | Pull all recent orders from QB via ODBC and cache locally |
| POST | `/quickbooks/import-csv` | Upload QB transaction CSV/IIF for import into cache |
| GET | `/quickbooks/cache/search` | Search cached orders by ref number, customer, date |
| GET | `/quickbooks/cache/:refNumber` | Get cached order with line items |
| DELETE | `/quickbooks/cache` | Clear the cache (admin only) |
| GET | `/quickbooks/cache/stats` | Cache statistics (total orders, last snapshot date) |

### Snapshot Flow

1. `POST /quickbooks/snapshot` (admin only, manual trigger)
2. Connect to QB via ODBC (existing `getOdbcConnection()`)
3. Query invoices from last 6 months (configurable) with line items
4. Query sales orders from last 6 months with line items
5. Query estimates from last 6 months with line items
6. Upsert each into `QBCachedOrder` + `QBCachedLineItem`
7. Return stats: `{ invoices: 150, salesOrders: 80, estimates: 40, totalLineItems: 1200, duration: '12s' }`

### CSV Import Flow

QB Desktop can export reports to CSV:
- Reports → Sales → Sales by Item Detail → Export to CSV
- Reports → Sales → Open Invoices → Export to CSV  
- Or use IIF export: File → Utilities → Export → IIF Files

The import endpoint parses the CSV/IIF and inserts into the cache.

### Modified Line Item Resolution

Update `findMatchingQBOrder()` and `getLineItemsForQBOrder()` to:

```typescript
async function getLineItemsForQBOrder(refNumber: string) {
  // 1. Check local cache FIRST (always fast, always available)
  const cached = await prisma.qBCachedOrder.findFirst({
    where: { refNumber },
    include: { lineItems: { orderBy: { lineNumber: 'asc' } } },
  });
  
  if (cached) {
    return {
      type: cached.type,
      txnId: cached.txnId,
      lineItems: cached.lineItems.map(li => ({
        txnLineId: li.id,
        itemRef: li.itemName ? { listId: '', fullName: li.itemName } : null,
        description: li.description,
        quantity: li.quantity,
        rate: li.rate,
        amount: li.amount,
        unitOfMeasure: li.unit,
      })),
      customerName: cached.customerName,
      totalAmount: cached.totalAmount,
      poNumber: cached.poNumber,
      source: 'cache',
    };
  }
  
  // 2. Try live ODBC only if already connected (don't block)
  if (connectionStatus.connected && odbcPool) {
    // ... existing ODBC query logic ...
    // Also cache the result for next time
  }
  
  return null;
}
```

---

## Implementation Steps

- [ ] 1. Add `QBCachedOrder` and `QBCachedLineItem` models to schema.prisma
- [ ] 2. Run `pnpm db:push` to apply
- [ ] 3. Create `packages/server/src/services/quickbooks-cache.ts` with snapshot + import logic
- [ ] 4. Add snapshot and import endpoints to `quickbooks.ts` route
- [ ] 5. Modify `findMatchingQBOrder()` and `getLineItemsForQBOrder()` to check cache first
- [ ] 6. Add WebSocket broadcast `QB_SNAPSHOT_COMPLETED`
- [ ] 7. Add cache status card to QuickBooks page in web app
- [ ] 8. (Optional) Add CSV/IIF parser for manual import

## Verification

- Snapshot endpoint pulls data when QB is online
- Cached data is available when QB is offline
- `findMatchingQBOrder` returns cached results instantly
- CSV import works as fallback when ODBC isn't available

## Notes

- The existing `findMatchingQBOrder()` and `getLineItemsForQBOrder()` already do the ODBC queries — we just need to add a cache layer in front.
- QB Desktop also supports IIF export (File → Utilities → Export → IIF Files). IIF is a tab-delimited format with `TRNS`, `SPL`, and `ENDTRNS` delimiters. It's the most reliable QB export format.
- The snapshot can be scheduled (e.g., daily at 6am when QB is typically open) or triggered manually from the UI.
