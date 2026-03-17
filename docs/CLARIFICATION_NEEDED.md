# Clarification Needed

Items discovered during implementation that need input from Jake.

---

## 1. Nesting Data Storage Approach

**Context**: Added `nestingEnabled` (boolean) and `nestingFileName` (string) directly to the `WorkOrder` model in Prisma. There is also an existing `NestingJob` model with full nesting tracking (NestItems, NestPlacements, WasteRecords) and `RipJob` has its own `nestingEnabled` field.

**Question**: Is the lightweight approach on WorkOrder sufficient for the shop floor use case? Or should the checkbox create/link a `NestingJob` record instead for more structured nesting tracking? The current approach is simple — operator toggles checkbox, enters a nesting file name, it saves to the work order. If you want the full NestingJob flow later, the WorkOrder fields can serve as the trigger.

---

## 2. File Trace — What to Do When RIP Match is Found

**Context**: The Network Files tab now shows a trace button (magnifying glass) next to print files (.pdf, .ai, .eps, etc.). When clicked, it hits `GET /equipment/thrive/trace-file?fileName=X` which searches Thrive RIP queues, pending Zund cut jobs, completed Zund jobs (180 days), and RipJob DB records.

**Question**: When a match IS found in the RIP/Zund logs, should the system automatically link/associate that RIP job to the work order? Currently it just displays the results (status badge: Not Printed / Printed Not Cut / Printed & Cut, plus matching job details). There's no auto-linking. Should it create a `RipJob` record linking the file to the order?

---

## 3. Design Station — What Should Operators See?

**Context**: DESIGN routing has been backfilled to all 9,121+ orders. The Design station on the shop floor currently shows orders and lets operators "Complete" their station. 

**Question**: Does the Design station need any special features beyond viewing orders and marking them complete? For example:
- File upload capability at the Design station?
- Proof approval workflow integration?
- Design-specific notes or checklist?
- Or is the current basic view (order details, files tab, complete button) sufficient?

---

## 4. Flatbed vs Roll-to-Roll — Auto-Assignment

**Context**: Many orders have `FLATBED` in routing, some have `ROLL_TO_ROLL`, and some have neither (they go directly to PRODUCTION). When a new order is created, the routing defaults system handles the printing station assignment.

**Question**: Should there be a way for operators on the Design station to *reassign* an order from Flatbed to Roll-to-Roll (or vice versa) when they determine the best print method during design? Currently routing can be modified via Order Entry but not from within the Design station view.

---

## 5. Nesting — Group Identification

**Context**: When an operator marks a job as "part of a nesting," they enter a nesting ID/file name. This is a free-text field.

**Question**: Should there be an auto-suggest for existing nesting file names so operators can easily group multiple orders under the same nesting? Currently there's no dropdown of existing nesting names — it's pure free text. A query to find other orders with the same `nestingFileName` could be added to show grouped orders.

---

## 6. Pre-existing Items Noted During Verification

- **Kanban Board**: Shows 0 orders despite 9,000+ in database. May need filters/refresh. Pre-existing.
- **Equipment page**: Still loading at snapshot time — may have slow API. Pre-existing.
- **`/customers` route**: Returns blank page. Customers are at `/sales/customers`. Pre-existing.

---

*Generated during session on $(Get-Date) — Agent verification pass.*
