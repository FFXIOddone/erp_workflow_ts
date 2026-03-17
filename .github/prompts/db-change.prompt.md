---
mode: agent
description: "Database schema change: Prisma schema → shared enums → db:push → seed → routes"
---

# Database Schema Change

Safely modify the database schema with all dependent updates.

## Step 1: Plan the Change
- Read the current `packages/server/prisma/schema.prisma`
- Identify all models, relations, and enums affected
- Check if this is additive (new field/model) or breaking (rename/remove/type change)
- For breaking changes: check all server routes and frontend code that reference the affected fields

## Step 2: Update Prisma Schema
- Edit `packages/server/prisma/schema.prisma`
- Follow conventions:
  - UUIDs for IDs: `@id @default(uuid())`
  - `onDelete: Cascade` for child relations
  - `@updatedAt` on `updatedAt` fields
  - `@default(now())` on `createdAt` fields
  - Enums defined at the Prisma level must match `@erp/shared` enums

## Step 3: Sync Shared Enums
- If any Prisma enums were added/changed, update `packages/shared/src/enums.ts` to match exactly
- Update `packages/shared/src/types.ts` if interfaces reference the changed fields
- Update `packages/shared/src/schemas.ts` if Zod schemas validate the changed fields
- Re-export from `packages/shared/src/index.ts` if new exports were added

## Step 4: Push Schema
```bash
npm run db:push
```
- This applies schema changes without creating migration files (development mode)
- If there are data conflicts, Prisma will warn — handle them before proceeding

## Step 5: Update Seed Data
- If new required fields were added, update `packages/server/prisma/seed.ts` to include them
- If new enum values were added, add representative seed data

## Step 6: Update Server Routes
- Search for Prisma queries that reference the changed model: `prisma.modelName.`
- Update `select`/`include` clauses if fields were added/removed
- Update Zod validation schemas if request shapes changed
- Update response shapes if the API contract changed

## Step 7: Update Frontend
- Search for API responses that reference the changed fields
- Update TypeScript interfaces (should come from `@erp/shared`)
- Update UI components that display the changed data

## Step 8: Verify
- Run TypeScript diagnostics across all packages
- Verify `db:push` completed successfully
- Test the affected API endpoints
- Verify the frontend renders correctly with the schema changes
