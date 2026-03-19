# Wilde Signs ERP Workflow

## Project Structure
TypeScript monorepo using npm workspaces:
- `packages/server` - Express API server + WebSocket (port 8001)
- `packages/web` - React admin dashboard (Vite + TanStack Query)
- `packages/shop-floor` - Tauri desktop app for shop floor stations
- `packages/shared` - Shared types, enums, Zod schemas (`@erp/shared`)
- `packages/station-*` - Legacy standalone station apps (being consolidated into shop-floor)
- `packages/portal` - Customer portal

## Dev Commands
- `npm run dev` - Start server + web
- `npm run dev:all` - Start all packages
- `npm run dev:server` - Server only
- `npm run dev:web` - Web dashboard only
- `npm run dev:shop-floor` - Shop floor Tauri app

## Database
- PostgreSQL with Prisma ORM
- `npm run db:push` - Push schema changes
- `npm run db:migrate` - Run migrations
- `npm run db:studio` - Open Prisma Studio
- Schema: `packages/server/prisma/schema.prisma`

## Key Patterns
- **API**: All routes under `/api/v1/` (exported as `API_BASE_PATH` from `@erp/shared`)
- **Auth**: JWT Bearer tokens via `authenticate` middleware
- **Real-time**: WebSocket `broadcast()` from `packages/server/src/ws/server.ts`
- **Validation**: Zod schemas in `packages/shared/src/schemas.ts`
- **Enums**: Shared enums in `packages/shared/src/enums.ts`
- **Error handling**: `NotFoundError`, `BadRequestError` from error-handler middleware
- **Activity logging**: `logActivity()` for audit trail

## Shop Floor (Tauri App)
- 6 stations: Design, Printing, Production, Shipping, Installation, Order Entry
- Station files: `packages/shop-floor/src/stations/*.tsx`
- Uses `invoke()` for Tauri native commands, `fetch()` for API calls
- Config store: `packages/shop-floor/src/stores/config.ts`
- Auth store: `packages/shop-floor/src/stores/auth.ts`
- WebSocket hook: `packages/shop-floor/src/lib/useWebSocket.ts`

## Server Route Pattern
```typescript
import { Router } from 'express';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db/client.js';
import { broadcast } from '../ws/server.js';

export const myRouter = Router();
myRouter.use(authenticate);
```

## Important Notes
- Company field (`companyId`) on WorkOrder is required for new orders
- `companyBrand` distinguishes Wilde Signs vs Port City Signs
- Stations use `PrintingMethod` enum (DESIGN, ROLL_TO_ROLL, FLATBED, etc.)
- Station progress tracked via `StationProgress` model (NOT_STARTED → IN_PROGRESS → COMPLETED)
- WebSocket broadcasts use: `broadcast({ type: 'EVENT_TYPE', payload: {...}, timestamp: new Date() })`

## Guidelines
- **Dependency order**: Always implement shared → server → web → shop-floor
- **WebSocket**: Every data mutation in a route must `broadcast()` a message (type pattern: `ENTITY_ACTION`)
- **Validation**: Validate all input at API boundary using Zod schemas from `@erp/shared`
- **Activity logging**: Log significant actions via `logActivity()` for audit trail
- **Token efficiency**: Only use Context7/Sequential Thinking MCP servers when genuinely uncertain about an API. Do not call them by default on every conversation.
