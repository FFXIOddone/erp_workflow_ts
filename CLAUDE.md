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

## Superpowers — Agent Behavioral Directives

### Context Management
- At the start of every conversation, check `/memories/` for relevant notes from previous sessions.
- After completing complex multi-step tasks, store key insights and decisions in repo memory (`/memories/repo/`).
- Use session memory (`/memories/session/`) to track in-progress plans and working state during long tasks.
- When encountering a recurring pattern or mistake, record it in user memory (`/memories/`) so it's never repeated.

### Proactive Tool Use
- Never guess when you can look. Search the codebase before making assumptions about how something works.
- Always read a file before editing it. Understand the full context — don't just pattern-match on a snippet.
- After making changes, check for TypeScript errors immediately. Fix them before moving on.
- When the user reports a bug, search for the exact error string in the codebase first.
- Use subagents (Explore) for broad codebase discovery instead of chaining many sequential reads.

### Plan-Then-Execute
- For multi-step tasks, create a plan with the todo list before writing any code.
- For large features, write a detailed plan in `docs/superpowers/plans/` with a date-prefixed filename.
- Plans should include: goal, affected files, implementation steps with checkboxes, verification criteria.
- Execute steps in dependency order: `packages/shared` → `packages/server` → `packages/web` → `packages/shop-floor`.
- Mark each step complete immediately after finishing it — don't batch.

### Self-Healing
- When a command or tool call fails, read the error output carefully before retrying.
- Don't retry the same failing approach more than once. Investigate the root cause first.
- Check for port conflicts, missing dependencies, or stale processes when dev servers fail to start.
- If a TypeScript error cascades across files, fix the source (usually in `@erp/shared`) rather than patching each consumer.

### Real-Time Awareness
- Every data mutation in a server route should `broadcast()` a WebSocket message.
- WebSocket message types follow the pattern: `ENTITY_ACTION` (e.g., `ORDER_CREATED`, `EQUIPMENT_STATUS_CHANGED`).
- After adding a new broadcast type, ensure `useWebSocket.ts` handles it with the correct query key invalidation.
- Consider cascade effects: changing an order status may affect station progress, routing, and dashboard counts.

### Security-First
- Validate all user input at the API boundary using Zod schemas from `@erp/shared`.
- Never trust client-side data — always re-validate on the server.
- Use parameterized Prisma queries (never raw SQL with string interpolation).
- Never log passwords, JWT tokens, or API keys — even in debug mode.
- All routes must use `authenticate` middleware — no exceptions except health checks.
- Check authorization (does this user own/have access to this resource?) not just authentication.

### MCP Server Usage Guide
When these servers are available, use them proactively:
- **Context7**: Fetch up-to-date documentation for any library (React, Prisma, Zod, Express, TanStack Query). Use this instead of guessing API signatures.
- **Sequential Thinking**: For complex multi-step reasoning — schema design, refactoring strategy, debugging complex data flows.
- **GitHub**: PR creation, issue management, branch operations. Use when the user mentions PRs, issues, or deployment.
- **PostgreSQL**: Direct database queries for debugging data issues, checking schema state, verifying seed data.
- **Playwright**: Browser automation for testing UI flows end-to-end.
- **Filesystem**: Bulk file operations, directory tree inspection.
- **Memory**: Persistent knowledge graph for tracking long-term project context.
- **Brave Search**: Web search for documentation, Stack Overflow solutions, or library comparisons.

### Skill Files Available
Reference these via `#file:` in chat or invoke directly:
- `debug.prompt.md` — Systematic 5-step debugging workflow
- `review.prompt.md` — Code review with security/convention/quality checklist
- `batch.prompt.md` — Multi-file batch change with verification
- `simplify.prompt.md` — Code simplification without behavior change
- `deploy.prompt.md` — Build and deploy workflow
- `erp-feature.prompt.md` — Full-stack ERP feature implementation guide
- `db-change.prompt.md` — Safe database schema change workflow
- `api-route.prompt.md` — API route scaffolding template
