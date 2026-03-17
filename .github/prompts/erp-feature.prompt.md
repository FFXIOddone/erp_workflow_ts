---
mode: agent
description: "Full-stack ERP feature: shared types → server route → WebSocket → web UI → activity log"
---

# Full-Stack ERP Feature Implementation

Implement a new feature end-to-end across the monorepo. Follow this exact order:

## Step 1: Shared Package (`packages/shared/src/`)
1. Add any new enums to `enums.ts`
2. Add TypeScript interfaces to `types.ts`
3. Add Zod validation schemas to `schemas.ts` (e.g., `CreateXxxSchema`, `UpdateXxxSchema`)
4. Add display name maps to `constants.ts` if needed
5. Export everything from `index.ts`

## Step 2: Database Schema (`packages/server/prisma/schema.prisma`)
1. Add/modify Prisma models
2. Ensure Prisma enums match shared enums exactly
3. Add appropriate relations with `onDelete: Cascade` for children
4. All IDs are UUIDs: `@id @default(uuid())`
5. Run `npm run db:push` to apply

## Step 3: Server Route (`packages/server/src/routes/`)
1. Create route file following the standard pattern:
   ```typescript
   import { Router } from 'express';
   import { authenticate, type AuthRequest } from '../middleware/auth.js';
   import { prisma } from '../db/client.js';
   import { broadcast } from '../ws/server.js';
   import { XxxSchema } from '@erp/shared';
   ```
2. Add `router.use(authenticate)` — all routes require auth
3. Validate request bodies with Zod: `Schema.parse(req.body)`
4. Use `NotFoundError`/`BadRequestError` for error cases
5. Broadcast state changes: `broadcast({ type: 'XXX_CREATED', payload: result })`
6. Log significant actions with `logActivity()`
7. Register the router in `packages/server/src/index.ts`

## Step 4: Frontend (`packages/web/src/`)
1. Create page component in `pages/XxxPage.tsx`
2. Use TanStack Query for data fetching:
   ```typescript
   const { data } = useQuery({
     queryKey: ['xxx', filters],
     queryFn: () => api.get('/xxx', { params: filters }).then(r => r.data.data),
   });
   ```
3. Use TanStack Mutation for writes with `onSuccess` invalidation
4. Add route to the router configuration
5. Add navigation link to sidebar/menu

## Step 5: Real-Time Updates
1. Add WebSocket message type handling in `useWebSocket.ts`
2. Broadcast type should match server broadcast (e.g., `XXX_CREATED`, `XXX_UPDATED`)
3. Query invalidation should refresh the relevant query keys

## Step 6: Verify
1. Check TypeScript diagnostics for all packages
2. Test the API endpoint manually or via the UI
3. Verify real-time updates work (create something, see it appear without refresh)
4. Verify activity log entries are created
