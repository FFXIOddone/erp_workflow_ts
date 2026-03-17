---
mode: agent
description: "Apply a repeating change across multiple files with verification"
---

# Batch Operations

Apply the same type of change across multiple files systematically.

## Workflow

1. **Discover**: Search the codebase to find ALL files that need the change. List them using the todo list.
2. **Plan**: For each file, determine the exact edit needed. Group similar edits.
3. **Execute**: Apply changes using multi-file edit operations where possible. Process files in dependency order:
   - `packages/shared` first (types, schemas, enums)
   - `packages/server` second (routes, services, middleware)
   - `packages/web` third (pages, components, hooks)
   - `packages/shop-floor` last (station UIs)
4. **Verify**: After all edits, check for TypeScript errors across the workspace. Fix any cascade issues.

## Rules
- Never skip a file — incomplete batch changes cause type errors and runtime bugs.
- If a file needs a different variation of the change, note it and handle it explicitly.
- After batch completion, run a final grep to confirm no instances were missed.
- Update the todo list as each file is completed.
