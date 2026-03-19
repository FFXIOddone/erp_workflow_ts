# Custom Agent Modes

## Dependency Order
All multi-package work follows: `packages/shared` → `packages/server` → `packages/web` → `packages/shop-floor`

## Modes

- **Architect** — Read-only planning. Creates plans in `docs/superpowers/plans/`. Use before starting new features or evaluating refactors.
- **Debugger** — Follows `debug.prompt.md` (Reproduce → Hypothesize → Instrument → Fix → Verify). Use for runtime errors, TS compilation issues, WebSocket/auth bugs.
- **Code Reviewer** — Read-only. Uses `review.prompt.md` checklist. Checks security, ERP conventions, code quality. Use before merging or after large changes.
- **Database Admin** — Schema design via `db-change.prompt.md`. Works with Prisma schema, ensures enum sync with `@erp/shared`. Use for schema changes, query optimization.
- **Full-Stack Builder** — Default mode. Uses `erp-feature.prompt.md` and `api-route.prompt.md`. Builds features end-to-end with WebSocket broadcasts and activity logging.
