# Blockers

## Open

| Timestamp | Task ID | Source | Blocker | Needs | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-03-25T20:12:18.169Z | PRINT-STATION-ROUTING-001 | validation | Vitest cannot execute targeted server tests because the local install is missing the std-env package. | Restore the missing Vitest dependency or refresh workspace installs before relying on package tests. | open | Attempted: npm.cmd run test -w @erp/server -- src/lib/routing-defaults.test.ts. Server TypeScript build still passed, so this did not block the code fix itself. |
<!-- BLOCKER_OPEN_ROWS -->

## Resolved

| Timestamp | Task ID | Source | Blocker | Resolution | Notes |
| --- | --- | --- | --- | --- | --- |
| 2026-03-25T19:39:48.076Z | INFRA-DISK-LOW-008 | runtime-audit | C drive ran out of free space during autonomous validation, causing file writes and log updates to fail. | Recovered disk headroom, restored the damaged materials route from HEAD, recreated the autonomy log templates, and resumed the normal loop. | The immediate incident is resolved; continue watching generated build output so the workspace stays stable. |
<!-- BLOCKER_RESOLVED_ROWS -->
