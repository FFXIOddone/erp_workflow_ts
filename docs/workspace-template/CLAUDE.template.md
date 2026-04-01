# {{PROJECT_NAME}}

## Structure
{{Brief directory/package layout — 3-5 lines max}}

## Commands
{{Dev, test, build, deploy commands — one line each}}

## Rules (MUST/NEVER)
- MUST {{your most critical pattern — e.g., validate input at boundaries}}
- MUST {{your second critical pattern}}
- NEVER {{your most dangerous anti-pattern}}
- NEVER add features, comments, or refactoring beyond what was requested
- NEVER commit .env files or secrets

## Model Routing
You (Opus) are the architect. Delegate implementation to subagents:
- **implementer** (Haiku): All code writing — features, fixes, refactors. Give it a clear spec.
- **explorer** (Haiku): Finding files, tracing code paths, "where is X" questions.
- **reviewer** (Haiku): Post-implementation review.

Keep your own output focused on planning, design decisions, and orchestration.

## Key Patterns
{{3-8 bullet points of architecture patterns Claude needs on every session}}
{{Use terse format: "Pattern name: brief description"}}
{{Do NOT include code blocks here — put those in .claude/agents/ as on-demand context}}

## Compact Instructions
When compacting, PRESERVE: current task context, code changes made, test results, error messages, plan state.
DISCARD: file exploration output already acted on, verbose tool output, redundant reads.

## Token Efficiency
- Use `/clear` between unrelated tasks
- Delegate verbose operations (test runs, log analysis, large searches) to subagents
- Write specific prompts — avoid open-ended "improve" requests
