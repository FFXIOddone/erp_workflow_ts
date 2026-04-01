# Wilde Signs ERP Workflow

## Structure
TypeScript monorepo (npm workspaces):
- `packages/server` - Express API + WebSocket (port 8001)
- `packages/web` - React dashboard (Vite + TanStack Query)
- `packages/shop-floor` - Tauri desktop app (6 stations)
- `packages/shared` - Types, enums, Zod schemas (`@erp/shared`)
- `packages/portal` - Customer portal

## Commands
- `npm run dev` / `dev:server` / `dev:web` / `dev:shop-floor` / `dev:all`
- `npm run db:push` / `db:migrate` / `db:studio`
- `npm run autonomy:next-task`
- `npm run autonomy:log`
- Schema: `packages/server/prisma/schema.prisma`

## Rules (MUST/NEVER)
- MUST implement in order: shared -> server -> web -> shop-floor
- MUST `broadcast()` after every data mutation in server routes
- MUST validate all input at API boundary using Zod schemas from `@erp/shared`
- MUST call `logActivity()` for significant actions
- MUST use JWT Bearer tokens via `authenticate` middleware on all routes
- NEVER import from server in web or vice versa
- NEVER add features, comments, or refactoring beyond what was requested
- NEVER commit `.env` files or secrets
- NEVER overwrite unrelated user changes in dirty files

## Autonomous Loop
- Read `docs/autonomy/repo-contract.md` before claiming backlog work.
- Prioritize the explicit user request. If there is no active user task, run `npm run autonomy:next-task -- --json` and take the next smallest unblocked slice.
- If the selected task is broad, create or refresh a plan in `docs/superpowers/plans/` and execute only the first independently verifiable slice.
- Before editing, check `git status --short`, protected files, and dependency order.
- After each slice, review, validate, log to `docs/autonomy/*.md`, and commit only if the touched files are free of unrelated pre-existing edits.
- Continue to the next task until blocked, unsafe, or redirected by the user.

## Model Routing
Use `gpt-5.4-mini` as the default conductor for orchestration, command-running, delegation, validation coordination, and log/commit handling. Keep `gpt-5.4` in strategic-thinking mode only for planning, hard tradeoffs, and high-risk reasoning. Delegate only bounded sidecar work:

- **conductor**: `gpt-5.4-mini` for task selection, orchestration, command-heavy execution flow, and delegation
- **explorer**: `gpt-5.4-mini` for fast repo discovery, queue parsing, and tracing
- **implementer**: `gpt-5.3-codex` for default implementation slices
- **mechanical-fixer**: `gpt-5.1-codex-mini` for narrow follow-up edits and test-fix loops
- **strategist**: `gpt-5.4` for planning, architecture, ambiguity resolution, and high-risk reasoning only; do not use it for routine command-running or implementation
- **reviewer**: `gpt-5.4-mini` for routine review, routing final high-risk judgment back to main-thread `gpt-5.4`

Keep subagent write scopes disjoint, never ask a subagent to own the immediate blocking decision-making step, and keep at most 6 active subagents only when the work splits into clearly bounded lanes.

## Task Intake
- Explicit user request wins.
- Otherwise take the first unchecked step from the newest file in `docs/superpowers/plans/`.
- Then scan checklist docs in this order: `docs/COMPREHENSIVE_AUDIT.md`, `docs/TEST_FINDINGS.md`, `docs/SECURITY_NEXT_STEPS.md`, `docs/SECURITY_AUDIT_REPORT.md`.
- Then fall back to `docs/ERP_GAP_ANALYSIS.md`.
- Use `AGENT-AUTO | IN PROGRESS`, `AGENT-AUTO | COMPLETE`, and `AGENT-AUTO | BLOCKED` only when the source doc has an unambiguous status field.

## Key Patterns
- API routes: `/api/v1/`, `Router()` + `authenticate` middleware
- Real-time: `broadcast({ type: 'ENTITY_ACTION', payload, timestamp })` from `ws/server.ts`
- Validation: Zod schemas in `packages/shared/src/schemas.ts`
- Enums: `packages/shared/src/enums.ts` (`PrintingMethod`, `StationProgress`, etc.)
- Errors: `NotFoundError`, `BadRequestError` from error-handler middleware
- Company: `companyId` required on WorkOrder, `companyBrand` for Wilde vs Port City

## Compact Instructions
When compacting, PRESERVE: current task context, code changes made, test results, error messages, plan state.
DISCARD: file exploration output already acted on, verbose tool output, redundant reads.
After compaction, re-read the compact-context hook output and `docs/autonomy/repo-contract.md`.

## Token Efficiency
- Only use Context7/Sequential Thinking MCP servers when genuinely uncertain about an API
- Use `/clear` between unrelated tasks
- Delegate verbose operations (test runs, log analysis, large searches) to subagents
- Write specific prompts - avoid open-ended "improve" requests
