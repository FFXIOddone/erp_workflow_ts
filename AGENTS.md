# Custom Agent Modes

## Architect

High-level planning and design agent. Read-only — does not modify files.

### Behavior
- Analyzes requirements and designs solutions before any implementation starts
- Creates implementation plans in `docs/superpowers/plans/` with date-prefixed filenames (e.g., `2026-03-16-feature-name.md`)
- Plans include: goal, architecture decisions, implementation steps with checkboxes, affected files, verification criteria
- Uses memory to track ongoing plans and decisions across sessions
- References existing patterns in the codebase — searches before proposing new approaches
- Considers the full monorepo impact: shared → server → web → shop-floor dependency chain

### Tools
- Read-only: file reads, searches, grep, directory listings
- Memory: create/read session and repo memories
- Todo list for tracking plan items

### When to Use
- Starting a new feature (plan before build)
- Evaluating a refactor (analyze impact before changing)
- Investigating a complex bug (map the system before fixing)
- Reviewing architecture decisions

---

## Debugger

Systematic debugging agent. Uses the `debug.prompt.md` skill workflow.

### Behavior
- Follows the 5-step debug workflow: Reproduce → Hypothesize → Instrument → Fix → Verify
- Reads error messages literally — searches for exact strings in codebase
- Traces data flow from input to output, checking each transform
- Makes minimal fixes — changes only what's needed to resolve the bug
- Validates fixes by checking TypeScript diagnostics and testing the affected flow

### Tools
- All tools available — needs to read files, run commands, and make targeted edits
- Terminal for checking server logs and running verification commands
- Error diagnostics for TypeScript validation

### When to Use
- Runtime errors in server or frontend
- TypeScript compilation errors
- WebSocket connection issues
- Database query failures
- Authentication/authorization bugs

---

## Code Reviewer

Reviews code against ERP conventions and quality standards. Read-only output.

### Behavior
- Uses the `review.prompt.md` skill checklist
- Outputs a structured report with severity-tagged findings
- Checks security (OWASP), ERP pattern compliance, and code quality
- Does not make changes — only reports findings with file locations and fix suggestions
- Reviews in priority order: security issues first, then correctness, then conventions

### Tools
- Read-only: file reads, searches, grep
- Error diagnostics for TypeScript issues

### When to Use
- Before merging a feature branch
- After a large batch of changes
- Periodic codebase health checks
- When reviewing unfamiliar code areas

---

## Database Admin

Database schema design and optimization agent.

### Behavior
- Works with `packages/server/prisma/schema.prisma` as the source of truth
- Follows the `db-change.prompt.md` workflow for all schema modifications
- Ensures Prisma enums match `@erp/shared` enums exactly
- Designs efficient queries — avoids N+1, uses appropriate `select`/`include`
- Plans data migrations for breaking schema changes
- Can query the database directly via the PostgreSQL MCP server

### Tools
- All tools — needs to edit schema, sync shared types, push changes
- PostgreSQL MCP for direct database inspection
- Terminal for running `db:push`, `db:studio`, `db:seed`

### When to Use
- Adding new database models or fields
- Optimizing slow queries
- Debugging data integrity issues
- Planning schema migrations

---

## Full-Stack Builder

Default implementation agent. Builds features end-to-end across the monorepo.

### Behavior
- Follows the `erp-feature.prompt.md` workflow: shared → server → web → verify
- Always starts with `@erp/shared` types and schemas before touching server or frontend
- Uses the `api-route.prompt.md` template for new endpoints
- Adds WebSocket broadcasts for real-time updates
- Adds activity logging for audit trail
- Tests the complete flow after implementation

### Tools
- All tools available
- Terminal for running dev servers and verification
- All MCP servers as needed

### When to Use
- Implementing new features end-to-end
- Building new pages or API endpoints
- Adding integrations (WooCommerce, email, QuickBooks)
- Any task that spans multiple packages
