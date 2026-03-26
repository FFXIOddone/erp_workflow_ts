# Wilde ERP Autonomous Repo Contract

## Mission

Run a closed loop for one smallest unblocked slice at a time:

1. Audit current state.
2. Select the next task deterministically.
3. Decompose broad work into smaller slices when needed.
4. Implement one slice.
5. Review and validate it.
6. Log blockers and wins.
7. Commit only when safe.
8. Continue to the next task until blocked or redirected.

## Task Priority Stack

1. Explicit user request in the current conversation.
2. First unchecked step from the newest file in `docs/superpowers/plans/`.
3. First available or not-started item from these checklist docs, in order:
   - `docs/COMPREHENSIVE_AUDIT.md`
   - `docs/TEST_FINDINGS.md`
   - `docs/SECURITY_NEXT_STEPS.md`
   - `docs/SECURITY_AUDIT_REPORT.md`
4. First available queue item from `docs/ERP_GAP_ANALYSIS.md`.

Use `npm run autonomy:next-task -- --json` when step 1 does not apply.

## Claiming Rules

- Claim only one independently verifiable slice at a time.
- If the selected task is broad, create or refresh a plan in `docs/superpowers/plans/` and execute only the first slice that can be validated on its own.
- Update the source doc only when the status markers are unambiguous.
- Use these status tokens for autonomous work:
  - `AGENT-AUTO | IN PROGRESS`
  - `AGENT-AUTO | COMPLETE`
  - `AGENT-AUTO | BLOCKED`

## Dirty Worktree Rules

- Check `git status --short` before changing anything.
- Never overwrite, revert, or commit unrelated user changes.
- If the selected task touches files with unrelated pre-existing edits, either choose a smaller safe slice or leave the slice uncommitted and record why.
- Do not auto-create branches, stash changes, reset files, or amend commits.

## Protected Files

Avoid editing these during parallel feature work unless the task is explicitly about integration or the user asked for it:

- `packages/server/src/index.ts`
- `packages/web/src/App.tsx`
- `packages/web/src/components/Layout.tsx`
- `packages/web/src/components/index.ts`
- `packages/shared/src/index.ts`

## Dependency Order

All multi-package implementation follows:

`packages/shared` -> `packages/server` -> `packages/web` -> `packages/shop-floor`

For portal or integration work, do not bypass upstream shared and server changes that the portal depends on.

## Model Routing

Default to `gpt-5.4-mini` for orchestration, command-running, delegation, validation coordination, and log/commit handling. Keep `gpt-5.4` in main-thread strategic-thinking mode only. Use subagents only for bounded sidecar work and final review.

| Role | Codex Agent Type | Preferred Model | Use Case |
| --- | --- | --- | --- |
| Conductor | main agent | `gpt-5.4-mini` | Task selection, orchestration, command-heavy execution flow, delegation, validation coordination |
| Explorer | `explorer` | `gpt-5.4-mini` | Fast repo discovery, queue parsing, path tracing |
| Implementer | `worker` | `gpt-5.3-codex` | Default implementation slices |
| Mechanical Fixer | `worker` | `gpt-5.1-codex-mini` | Narrow follow-up edits, lint/test fixes |
| Strategist | main agent | `gpt-5.4` | Thinking-only planning, architecture, ambiguity resolution, high-risk reasoning, and final judgment |
| Reviewer | `reviewer` | `gpt-5.4-mini` | Routine review after implementation |

- Keep at most 6 active subagents at once, and only when the work can be split into clearly bounded lanes with disjoint write scopes.

## Validation Matrix

- `packages/shared`: `npm run build -w @erp/shared`, `npm run lint -w @erp/shared`
- `packages/server`: `npm run build -w @erp/server`, `npm run lint -w @erp/server`, `npm run test -w @erp/server` when runtime logic changed
- `packages/web`: `npm run build -w @erp/web`, `npm run lint -w @erp/web`
- `packages/portal`: `npm run build -w @erp/portal`, `npm run lint -w @erp/portal`
- `packages/shop-floor`: `npm run build -w @erp/shop-floor`
- Repo scripts or docs: run the directly affected script or validator, then add focused TypeScript or syntax validation if applicable
- Cross-package changes: validate affected packages in dependency order before widening to root-level checks

## Logging Contract

- Record every claimed slice in `docs/autonomy/RUN_LOG.md`.
- Record unresolved external blockers, missing secrets, permission gaps, or environment constraints in `docs/autonomy/BLOCKERS.md`.
- Record completed slices and notable wins in `docs/autonomy/MILESTONES.md`.
- Keep the historical `docs/AGENT_0x_LOG.md` files read-only unless a user explicitly asks to update them.
- Prefer `npm run autonomy:log -- ...` to keep the log format consistent.

## Commit Contract

- Commit only when the touched files do not contain unrelated pre-existing edits.
- Use `type(auto): <task-id> <summary>`.
- If a commit is skipped, record the reason in `docs/autonomy/RUN_LOG.md`.

## Cleanup Contract

- Stop any dev servers, watchers, or background jobs you started.
- Leave ports and temporary resources clear for the next slice.
