#!/bin/bash
# Filter verbose test output to only show failures
# Used by PreToolUse hook on Bash commands
# Adjust the command regex for your test runner

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Match your test/build commands
if echo "$COMMAND" | grep -qE '(npm test|npx jest|npx vitest|npm run build|npx tsc)'; then
  echo '{"hookSpecificOutput":{"additionalContext":"Note: Test/build output will be filtered to show only errors and failures."}}'
fi

exit 0
