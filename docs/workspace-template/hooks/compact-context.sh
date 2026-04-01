#!/bin/bash
# Re-inject critical context after compaction
# Used by SessionStart hook with matcher "compact"
# Customize the content below for your project

cat <<'EOF'
## Post-Compaction Context Reminder

**Model routing**: You are Opus — the architect. Delegate implementation work to the `implementer` agent (Haiku). Use `explorer` agent for codebase searches. Use `reviewer` agent after implementation.

**Key rules**:
{{Fill in your 3-5 most critical rules here}}

**Current workspace**: {{Brief project description}}
EOF

exit 0
