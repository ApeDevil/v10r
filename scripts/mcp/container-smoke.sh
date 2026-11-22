#!/usr/bin/env bash
# Container smoke test for the stdio Pattern MCP: runs the server exactly as MCP clients register
# it — an ephemeral `oven/bun` container, repo mounted read-only, no network, no node_modules —
# and checks what only the container can prove.
#
#   scripts/mcp/container-smoke.sh                 # podman if installed, else docker
#   V10R_CONTAINER_RUNTIME=docker scripts/mcp/container-smoke.sh
#
# Runs on a host with bun (it drives mcp/smoke.ts from outside the container) and a container
# runtime. The mount is a clean export of the working tree (tracked + new files, .gitignore
# honoured) so the host's node_modules can never leak in and mask a missing bundle.
#
# Checks:
#   1. the export has no node_modules
#   2. mcp/smoke.ts through `<runtime> run -i --rm --network=none -v …:/v10r:ro … bun /v10r/mcp/server.ts`:
#      both protocol eras, every tool, security negatives, clean exit 0 on stdin EOF
#   3. the mount is read-only from inside the container
#   4. the container has no network
#   5. SIGTERM ends a running server promptly with exit 0, and no container is left behind
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
IMAGE="${V10R_CONTAINER_IMAGE:-docker.io/oven/bun:1.3.12}"
RUNTIME="${V10R_CONTAINER_RUNTIME:-}"
if [[ -z "$RUNTIME" ]]; then
	if command -v podman >/dev/null; then RUNTIME=podman; elif command -v docker >/dev/null; then RUNTIME=docker; else
		echo "need podman or docker" >&2
		exit 2
	fi
fi
command -v bun >/dev/null || { echo "need bun on the host to drive mcp/smoke.ts" >&2; exit 2; }

EXPORT="$(mktemp -d)"
NAME="v10r-mcp-smoke-$$"
cleanup() {
	"$RUNTIME" rm -f "$NAME" >/dev/null 2>&1 || true
	rm -rf "$EXPORT"
}
trap cleanup EXIT

failures=0
pass() { echo "PASS $1"; }
fail() { echo "FAIL $1${2:+ — $2}"; failures=$((failures + 1)); }

(cd "$REPO" && git ls-files -co --exclude-standard -z | xargs -0 -I{} cp --parents {} "$EXPORT/" 2>/dev/null) || true
echo "runtime: $RUNTIME ($("$RUNTIME" --version | head -1)), image: $IMAGE, export: $(du -sh "$EXPORT" | cut -f1)"

# 1. no node_modules anywhere in what the container sees
if [[ -z "$(find "$EXPORT" -name node_modules -print -quit)" ]]; then pass "mount has no node_modules"; else fail "mount has no node_modules"; fi

RUN=("$RUNTIME" run -i --rm --network=none -v "$EXPORT:/v10r:ro" "$IMAGE")

# 2. the real client path: the protocol over the container's stdio
if V10R_SMOKE_SPAWN="${RUN[*]} bun /v10r/mcp/server.ts" bun "$REPO/mcp/smoke.ts" >"$EXPORT.smoke.log" 2>&1; then
	pass "mcp/smoke.ts through the container ($(grep -c '^PASS' "$EXPORT.smoke.log") assertions)"
else
	fail "mcp/smoke.ts through the container" "$(grep '^FAIL\|SMOKE' "$EXPORT.smoke.log" | head -5 | tr '\n' ' ')"
fi
rm -f "$EXPORT.smoke.log"

# 3. read-only mount
if "${RUN[@]}" sh -c 'touch /v10r/mcp/.write-probe' >/dev/null 2>&1; then fail "mount is read-only"; else pass "mount is read-only"; fi

# 4. no network: resolution and connection both fail inside the container
if "${RUN[@]}" bun -e 'await fetch("https://registry.npmjs.org/", { signal: AbortSignal.timeout(5000) }); process.exit(0)' >/dev/null 2>&1; then
	fail "container has no network"
else
	pass "container has no network"
fi

# 5. SIGTERM on a live server: prompt exit 0, container removed
"$RUNTIME" run -i -d --name "$NAME" --network=none -v "$EXPORT:/v10r:ro" "$IMAGE" bun /v10r/mcp/server.ts >/dev/null
sleep 2
if [[ "$("$RUNTIME" inspect -f '{{.State.Running}}' "$NAME")" == "true" ]]; then pass "server stays up while stdin is open"; else fail "server stays up while stdin is open"; fi
started=$(date +%s)
"$RUNTIME" stop -t 10 "$NAME" >/dev/null
elapsed=$(($(date +%s) - started))
code="$("$RUNTIME" inspect -f '{{.State.ExitCode}}' "$NAME")"
if [[ "$code" == "0" && "$elapsed" -lt 5 ]]; then pass "SIGTERM exits 0 in ${elapsed}s"; else fail "SIGTERM exits 0 promptly" "exit $code after ${elapsed}s"; fi
"$RUNTIME" rm -f "$NAME" >/dev/null
if [[ -z "$("$RUNTIME" ps -aq --filter "name=v10r-mcp-smoke")" ]]; then pass "no container left behind"; else fail "no container left behind"; fi

if [[ "$failures" -eq 0 ]]; then echo "CONTAINER SMOKE OK"; else echo "CONTAINER SMOKE FAILED: $failures"; exit 1; fi
