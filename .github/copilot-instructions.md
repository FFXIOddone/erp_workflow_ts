# ERP Workflow - TypeScript Edition

## Architecture Overview
Monorepo ERP system for Wilde Signs sign shop with four packages:
- `packages/shared` - Types, Zod schemas, enums, constants (imported as `@erp/shared`)
- `packages/server` - Express API with Prisma ORM, WebSocket server
- `packages/web` - React SPA with TanStack Query, Zustand, TailwindCSS
- `packages/desktop` - Electron wrapper (loads web app)

## Key Development Commands
```bash
pnpm dev              # Start server (8001) + web (5173) together
pnpm dev:server       # API only - useful for backend work
pnpm dev:web          # Frontend only - needs API running
pnpm db:push          # Apply Prisma schema changes (no migrations)
pnpm db:studio        # Visual database browser
pnpm db:seed          # Seed initial data (admin/admin123)
docker-compose up -d  # Start PostgreSQL
```

## Critical Patterns

### Shared Package First
All types, enums, and Zod schemas live in `packages/shared/src/`. When adding features:
1. Add enums to `enums.ts`
2. Add interfaces to `types.ts`
3. Add Zod schemas to `schemas.ts`
4. Export from `index.ts`

### API Route Structure
Routes in `packages/server/src/routes/` follow this pattern:
```typescript
import { CreateWorkOrderSchema } from '@erp/shared';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { broadcast } from '../ws/server.js';

router.use(authenticate);  // All routes require auth

router.post('/', async (req: AuthRequest, res) => {
  const data = CreateWorkOrderSchema.parse(req.body);  // Zod validation
  const result = await prisma.workOrder.create({ ... });
  broadcast({ type: 'ORDER_CREATED', payload: result });  // Real-time update
  res.json({ success: true, data: result });
});
```

### Error Handling
Use error helpers from `packages/server/src/middleware/error-handler.ts`:
```typescript
import { NotFoundError, BadRequestError } from '../middleware/error-handler.js';
throw NotFoundError('Order not found');
throw BadRequestError('Invalid status transition', { current, requested });
```

### Activity Logging
Log significant actions using the activity logger:
```typescript
import { logActivity, ActivityAction, EntityType } from '../lib/activity-logger.js';
await logActivity({
  action: ActivityAction.CREATE,
  entityType: EntityType.ORDER,
  entityId: order.id,
  description: `Created order ${order.orderNumber}`,
  userId: req.userId,
  req,
});
```

### Frontend Data Fetching
Use TanStack Query with the `api` client from `packages/web/src/lib/api.ts`:
```typescript
const { data, isLoading } = useQuery({
  queryKey: ['orders', filters],
  queryFn: () => api.get('/orders', { params: filters }).then(r => r.data.data),
});
```

### State Management
- **Server state**: TanStack Query (queries auto-invalidate on WebSocket events)
- **Auth state**: Zustand store in `packages/web/src/stores/auth.ts`
- **UI state**: Local React state

### Real-time Updates
WebSocket broadcasts from server trigger query invalidations in `useWebSocket.ts`. Message types like `ORDER_UPDATED`, `ORDER_CREATED` auto-refresh relevant queries.

## Database Conventions
- Schema in `packages/server/prisma/schema.prisma`
- Enums must match TypeScript enums in `@erp/shared`
- All IDs are UUIDs (`@id @default(uuid())`)
- Use `onDelete: Cascade` for child relations
- Use `.js` extension in all server imports (ESM requirement)

## External Integrations
- **WooCommerce**: Sync orders from online store (`services/woocommerce.ts`)
- **Email**: SMTP-based notifications (`services/email.ts`)
- **QuickBooks**: Read-only connection to QB Desktop on CHRISTINA-NEW (`services/quickbooks.ts`)

## UI Patterns
- Pages in `packages/web/src/pages/` - one per route, named `*Page.tsx`
- Reusable components in `packages/web/src/components/`
- Use display name maps from `packages/shared/src/constants.ts`:
  ```typescript
  import { STATUS_DISPLAY_NAMES, STATION_DISPLAY_NAMES } from '@erp/shared';
  ```

## Domain Concepts
- **WorkOrder**: Main entity with status workflow (PENDING → IN_PROGRESS → COMPLETED → SHIPPED)
- **Station/PrintingMethod**: Production departments (ROLL_TO_ROLL, SCREEN_PRINT, FLATBED, etc.)
- **Routing**: Ordered array of stations an order must pass through
- **StationProgress**: Tracks completion status per station per order

## Authentication
- JWT tokens with 7-day expiry (configurable via `JWT_EXPIRES_IN`)
- Passwords hashed with bcrypt
- All API routes require `authenticate` middleware
- Use `AuthRequest` type for typed `req.user` access

---

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
