#!/bin/bash
# Auto-format files after Edit/Write operations
# Used by PostToolUse hook
# Adjust the file extension regex for your project

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Only format files that Prettier supports
if [ -n "$FILE_PATH" ] && echo "$FILE_PATH" | grep -qE '\.(ts|tsx|js|jsx|json|css|html|md)$'; then
  if [ -f "$FILE_PATH" ]; then
    npx prettier --write "$FILE_PATH" 2>/dev/null
  fi
fi

exit 0
