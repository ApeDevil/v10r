#!/usr/bin/env bash
set -euo pipefail

# Quality gate: blocks agent completion on test failure.
# Reads JSON from stdin, runs vitest, returns JSON decision.
# Deliberately vitest-only: svelte-check adds ~35s per agent stop, so type and
# lint enforcement stays in `bun run validate` (both are error-free there).

input="$(cat)"

# Prevent infinite loops — if this hook already triggered, skip
if echo "$input" | grep -q '"stop_hook_active"'; then
  echo '{"decision": "approve"}'
  exit 0
fi

output=$(podman exec v10r bash -c 'set -o pipefail; bun vitest run 2>&1 | tail -40' 2>&1) || {
  # Escape the output for JSON
  escaped=$(echo "$output" | tail -80 | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))')
  echo "{\"decision\": \"block\", \"reason\": $escaped}"
  exit 0
}

echo '{"decision": "approve"}'
