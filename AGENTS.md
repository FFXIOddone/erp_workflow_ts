# Custom Agent Modes

## Dependency Order
All multi-package work follows: `packages/shared` -> `packages/server` -> `packages/web` -> `packages/shop-floor`

## Autonomous Conductor

- Start with the explicit user request. If none is active, follow the repo priority stack in [`docs/autonomy/repo-contract.md`](/c:/Users/Jake/OneDrive%20-%20Wilde%20Signs/Desktop/Scripts/erp_workflow_ts/docs/autonomy/repo-contract.md).
- Take one smallest unblocked slice at a time. If a candidate task is broad, create or refresh a plan in `docs/superpowers/plans/` and complete only the first independently verifiable slice.
- Before claiming work, inspect `git status --short`, protected files, and existing dirty edits. Never overwrite or commit unrelated user changes.
- Use `AGENT-AUTO | IN PROGRESS`, `AGENT-AUTO | COMPLETE`, and `AGENT-AUTO | BLOCKED` only when the source doc has an unambiguous status field.
- Log every claimed slice to `docs/autonomy/RUN_LOG.md`, unresolved blockers to `docs/autonomy/BLOCKERS.md`, and completed wins to `docs/autonomy/MILESTONES.md`.
- Validate each slice with targeted package-local checks before widening to broader build, lint, or test coverage.
- Auto-commit only safe slices with `type(auto): <task-id> <summary>`. If unrelated edits are present in touched files, leave the work uncommitted and log the reason.

## Modes

- **Architect** - Read-only planning. Creates plans in `docs/superpowers/plans/`. Use before starting new features or evaluating refactors.
- **Debugger** - Follows `debug.prompt.md` (Reproduce -> Hypothesize -> Instrument -> Fix -> Verify). Use for runtime errors, TS compilation issues, WebSocket/auth bugs.
- **Code Reviewer** - Read-only. Uses `review.prompt.md` checklist. Checks security, ERP conventions, code quality. Use before merging or after large changes.
- **Database Admin** - Schema design via `db-change.prompt.md`. Works with Prisma schema, ensures enum sync with `@erp/shared`. Use for schema changes, query optimization.
- **Full-Stack Builder** - Default mode. Uses `erp-feature.prompt.md` and `api-route.prompt.md`. Builds features end-to-end with WebSocket broadcasts and activity logging.

## Subagent Routing

- **Conductor** - Default orchestration path. In Codex/OpenAI flows, prefer `gpt-5.4-mini` for task selection, delegation, command-running, validation orchestration, and log/commit coordination. Keep the main `gpt-5.4` agent in strategic-thinking mode only.
- **Explorer** - Fast repo discovery and queue parsing. In Codex/OpenAI flows, prefer `explorer` + `gpt-5.4-mini`.
- **Implementer** - Default execution worker. In Codex/OpenAI flows, prefer `worker` + `gpt-5.3-codex`.
- **Mechanical Fixer** - Narrow follow-up edits and test-fix loops. In Codex/OpenAI flows, prefer `worker` + `gpt-5.1-codex-mini`.
- **Strategist** - Planning, architecture, ambiguity resolution, and high-risk reasoning. In Codex/OpenAI flows, prefer `gpt-5.4` for thinking-only guidance, then hand execution back to `gpt-5.3-codex` or `gpt-5.1-codex-mini`.
- **Reviewer** - Post-implementation review. In Codex/OpenAI flows, prefer `reviewer` + `gpt-5.4-mini`, and route final high-risk judgment back to main-thread `gpt-5.4`.
- Keep at most 6 active subagents at once, and only when parallel work is clearly decomposed with disjoint write scopes.
