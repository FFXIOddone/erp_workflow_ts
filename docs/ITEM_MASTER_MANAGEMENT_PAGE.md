# Item Master Management Page (TODO)

## Overview
A dedicated page for managing the Item Master catalog — adding new items, editing existing items, deactivating items, and importing/exporting bulk data. Currently, item data lives in the `ItemMaster` table (3,266+ records imported from QuickBooks), but there is no UI for managing it.

## Why This Is Needed
- Every line item on a work order, quote, purchase order, recurring order, or template **must** come from the Item Master catalog (enforced by schema validation as of Feb 2026)
- When a new product or service needs to be added, there must be a way to do it without direct DB access
- Items imported from QuickBooks may need price updates, description corrections, or deactivation

## Route
`/settings/items` or `/items` — accessible from the Settings page or main navigation

## Features

### 1. Item List View
- Paginated table of all items (active and inactive toggle)
- Search by SKU, name, description, or category
- Filter by category
- Sort by name, SKU, price, created date
- Bulk actions: Activate/Deactivate selected items

### 2. Create Item Form
- **SKU** (required, unique) — auto-generate option or manual entry
- **Name** (required) — display name used in autocomplete
- **Description** (optional) — longer description
- **Category** (optional) — dropdown of existing categories + "New" option
- **Unit Price** (required) — default sell price, auto-filled on order line items
- **Cost Price** (optional) — vendor cost, used on purchase orders
- **Active** (boolean) — inactive items hidden from autocomplete

### 3. Edit Item
- Same form as create, with SKU read-only (or editable by admin with warning)
- Show usage history: which orders, quotes, POs reference this item
- Price change log (audit trail)

### 4. Bulk Import/Export
- CSV/Excel export of all items
- CSV/Excel import for bulk price updates or new items
- Preview before applying imports
- Duplicate SKU detection

### 5. Category Management
- List unique categories
- Rename category (updates all items in that category)
- Merge categories

## API Endpoints (Already Exist)
The server already has full CRUD at `/api/items`:
- `GET /items` — List with pagination, search, category filter
- `GET /items/categories` — Distinct category list
- `GET /items/:id` — Single item
- `GET /items/:id/history` — Order history for item
- `POST /items` — Create (admin/manager only)
- `PATCH /items/:id` — Update (admin/manager only)
- `DELETE /items/:id` — Delete (admin only)

## Data Model
```prisma
model ItemMaster {
  id          String   @id @default(uuid())
  sku         String   @unique
  name        String
  description String?
  category    String?
  unitPrice   Decimal  @db.Decimal(10, 2)
  costPrice   Decimal? @db.Decimal(10, 2)
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

## UI Design Notes
- Use the same table pattern as CustomersPage (search + filter bar, paginated table)
- Price fields should format as currency with 2 decimal places
- Category filter as a sidebar or chip-based filter
- Active/Inactive toggle as a pill or badge (green/gray)
- Quick edit inline for price changes (no need to open full form)
- Keyboard shortcut: `n` to create new item when on the page

## Related Files
- **Component:** `packages/web/src/components/ItemMasterAutocomplete.tsx` — Reusable autocomplete that queries all active items
- **API Routes:** `packages/server/src/routes/items.ts` — Full CRUD
- **Schema:** `packages/shared/src/schemas.ts` — `CreateItemMasterSchema`, `UpdateItemMasterSchema`
- **Prisma Model:** `packages/server/prisma/schema.prisma` — `ItemMaster`

## Priority
Medium — Currently items can be managed via Prisma Studio (`pnpm db:studio`) or SQL, but a proper UI is needed for non-technical users.
