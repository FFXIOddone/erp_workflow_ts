AGENT-AUTO | COMPLETE

# Archive Completed Orders Backfill

> AGENT-AUTO | COMPLETE

**Goal:** Use the Production List archive workbook as the source of truth for historical shipped/completed/installed orders, dedupe by WO #, and backfill terminal ERP records without disturbing unrelated live-order data.

## Slice 1
- Read `C:\Users\Jake\OneDrive - Wilde Signs\Production List\Archive\archive.xlsx`.
- Dedupe by WO # and classify each row as shipped or completed/installed using the archive columns.
- Backfill existing ERP orders first, then create the missing completed historical orders as terminal records.

## Notes
- Treat `Shipped Date` as the terminal date for shipped/completed/installed rows.
- Keep the change one-way and historical: do not disturb active work orders outside the archive workbook scope.
- After the backfill, remind the user that tracking still needs a fast cleanup and the shop-floor Design page still needs to be completed before pre-alpha testing.
