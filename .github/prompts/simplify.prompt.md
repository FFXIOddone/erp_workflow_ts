---
mode: agent
description: "Simplify code: reduce complexity, remove dead code, flatten abstractions"
---

# Code Simplification

Simplify the specified code while preserving all behavior.

## What to Simplify
- **Dead code**: Unused imports, unreachable branches, commented-out blocks, unused variables
- **Over-abstraction**: Wrappers that add no value, single-use utility functions, unnecessary indirection layers
- **Redundant logic**: Conditions that are always true/false, duplicate null checks, re-validation of already-validated data
- **Complex conditionals**: Nested ternaries, deeply nested if/else chains — flatten with early returns or switch statements
- **Verbose patterns**: Manual loops that could be `.map()`/`.filter()`, repeated object spreading that could use a helper

## What NOT to Simplify
- Error handling that protects against real edge cases
- Type annotations that aid readability
- Zod validation on API boundaries (even if "redundant" with TypeScript types)
- WebSocket broadcast calls (they enable real-time updates)
- Activity logging (audit trail requirement)

## Process
1. Read the target file(s) completely
2. Identify each simplification opportunity
3. Make changes one at a time, verifying no behavior change after each
4. Run TypeScript diagnostics to verify no type errors introduced
5. Verify the simplified code handles the same edge cases as the original
