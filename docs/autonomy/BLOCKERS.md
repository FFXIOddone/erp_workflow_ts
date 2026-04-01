# Blockers

## Open

| Timestamp | Task ID | Source | Blocker | Needs | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-03-25T20:12:18.169Z | PRINT-STATION-ROUTING-001 | validation | Vitest cannot execute targeted server tests because the local install is missing the std-env package. | Restore the missing Vitest dependency or refresh workspace installs before relying on package tests. | open | Attempted: npm.cmd run test -w @erp/server -- src/lib/routing-defaults.test.ts. Server TypeScript build still passed, so this did not block the code fix itself. |
| 2026-04-01T15:50:08.524Z | PLAN:2026-03-23-ai-optimized-dynamic-routing-engine | validation | Shared package lint baseline fails on pre-existing unused imports and type debt in unrelated files | Repo-wide shared lint cleanup before npm run lint -w @erp/shared can pass cleanly | open | The routing contract slice itself builds cleanly and targeted lint on the touched files shows only baseline debt outside this patch. |
| 2026-04-01T17:43:40.591Z | SSS-API-001 | server-validation | Server TypeScript build fails on pre-existing Prisma typing drift and implicit-any debt in unrelated files | Repo-wide server typing cleanup before the full build can pass cleanly | open | The new routing feedback helper and its regression test are clean; the failure is baseline repo debt, not this slice. |
<!-- BLOCKER_OPEN_ROWS -->

## Resolved

| Timestamp | Task ID | Source | Blocker | Resolution | Notes |
| --- | --- | --- | --- | --- | --- |
| 2026-03-25T19:39:48.076Z | INFRA-DISK-LOW-008 | runtime-audit | C drive ran out of free space during autonomous validation, causing file writes and log updates to fail. | Recovered disk headroom, restored the damaged materials route from HEAD, recreated the autonomy log templates, and resumed the normal loop. | The immediate incident is resolved; continue watching generated build output so the workspace stays stable. |
<!-- BLOCKER_RESOLVED_ROWS -->
