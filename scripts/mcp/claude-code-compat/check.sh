#!/usr/bin/env bash
# Claude Code compatibility check for tool `title` and `annotations.readOnlyHint` (roadmap B1).
#
# Runs on the HOST, where Claude Code is installed and signed in. For each transport (stdio, http)
# and each field set (none = control, title, readOnlyHint, both) it starts the annotated fixture
# server, runs ONE headless Claude Code turn against it in isolation, and reads the session's
# `system/init` event: did the server connect, and how many of its eight tools did the client keep?
#
#   scripts/mcp/claude-code-compat/check.sh            # list check (one tiny turn per case)
#   scripts/mcp/claude-code-compat/check.sh --call     # also have the model call one tool per case
#
# Isolation: --strict-mcp-config ignores every MCP server the user has configured, the turn runs in
# a throwaway directory (no project .mcp.json or CLAUDE.md), no tool other than the fixture's is
# allowed, and nothing is written to the user's Claude Code configuration.
#
# Server runtime: `bun` when it is on PATH, otherwise the repo's documented podman image. The
# fixture is dependency-free (it runs the committed stdio bundle as a child), so the podman path
# needs no node_modules — the same read-only, network-less container as the real server.
# Results: one JSONL transcript per case plus summary.txt under $V10R_COMPAT_OUT (default: a new
# temp directory, printed at the end). Exit 0 when the control case passes on both transports —
# the kit itself works — whatever the verdict on the fields; exit 1 when it does not.
#
# Runbook and how to record the verdict: docs/blueprint/architecture/mcp-evolution/claude-code-compat.md
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
OUT="${V10R_COMPAT_OUT:-$(mktemp -d -t v10r-claude-code-compat.XXXXXX)}"
WORK="$(mktemp -d -t v10r-claude-code-compat-cwd.XXXXXX)"
PORT="${V10R_COMPAT_PORT:-8790}"
IMAGE="docker.io/oven/bun:1.3.12"
CALL=0
[[ "${1:-}" == "--call" ]] && CALL=1
mkdir -p "$OUT"

command -v claude >/dev/null || { echo "claude (Claude Code) is not on PATH" >&2; exit 2; }
if command -v bun >/dev/null; then RUNTIME=bun; elif command -v podman >/dev/null; then RUNTIME=podman; else
	echo "need bun or podman to run the fixture server" >&2; exit 2
fi

# The stdio server command as a JSON array, for one field set.
stdio_command() {
	local fields="$1"
	if [[ "$RUNTIME" == bun ]]; then
		printf '{"command":"bun","args":["%s/scripts/mcp/claude-code-compat/annotated-server.ts"],"env":{"V10R_COMPAT_FIELDS":"%s"}}' "$REPO" "$fields"
	else
		printf '{"command":"podman","args":["run","-i","--rm","--network=none","-e","V10R_COMPAT_FIELDS=%s","-v","%s:/v10r:ro","%s","bun","/v10r/scripts/mcp/claude-code-compat/annotated-server.ts"]}' "$fields" "$REPO" "$IMAGE"
	fi
}

HTTP_PID=""
start_http() {
	local fields="$1"
	if [[ "$RUNTIME" == bun ]]; then
		V10R_COMPAT_FIELDS="$fields" bun "$REPO/scripts/mcp/claude-code-compat/annotated-server.ts" --http "$PORT" 2>>"$OUT/http-server.log" &
		HTTP_PID=$!
	else
		podman run --rm -d --name v10r-claude-code-compat -p "127.0.0.1:$PORT:$PORT" -e "V10R_COMPAT_FIELDS=$fields" \
			-e V10R_COMPAT_HOST=0.0.0.0 -v "$REPO:/v10r:ro" "$IMAGE" \
			bun /v10r/scripts/mcp/claude-code-compat/annotated-server.ts --http "$PORT" >/dev/null
	fi
	for _ in $(seq 1 50); do
		curl -s -o /dev/null -X POST "http://127.0.0.1:$PORT/mcp" -d '{"jsonrpc":"2.0","method":"notifications/initialized"}' && return 0
		sleep 0.2
	done
	echo "fixture HTTP server did not start" >&2
	return 1
}
stop_http() {
	if [[ "$RUNTIME" == bun ]]; then [[ -n "$HTTP_PID" ]] && kill "$HTTP_PID" 2>/dev/null || true; HTTP_PID=""
	else podman rm -f v10r-claude-code-compat >/dev/null 2>&1 || true; fi
}
trap stop_http EXIT

run_case() {
	local transport="$1" fields="$2" config="$WORK/$1-$2.mcp.json" transcript="$OUT/$1-$2.jsonl"
	if [[ "$transport" == stdio ]]; then
		printf '{"mcpServers":{"v10r-compat":%s}}' "$(stdio_command "$fields")" >"$config"
	else
		start_http "$fields"
		printf '{"mcpServers":{"v10r-compat":{"type":"http","url":"http://127.0.0.1:%s/mcp"}}}' "$PORT" >"$config"
	fi
	local prompt="Reply with the single word: ok" allowed="" turns=1
	if [[ "$CALL" == 1 ]]; then
		prompt="Call mcp__v10r-compat__search_patterns with query \"cache stampede\" and reply with the first pattern id it returns."
		allowed="mcp__v10r-compat__search_patterns"
		turns=3
	fi
	(cd "$WORK" && claude -p "$prompt" --output-format stream-json --verbose --strict-mcp-config \
		--mcp-config "$config" --allowedTools "$allowed" --max-turns "$turns" >"$transcript" 2>"$transcript.stderr") || true
	[[ "$transport" == http ]] && stop_http

	local init status tools
	init="$(grep -m1 '"subtype":"init"' "$transcript" || true)"
	status="$(grep -o '"name":"v10r-compat","status":"[a-z_-]*"' <<<"$init" | sed 's/.*"status":"//;s/"$//' || true)"
	tools="$(grep -o 'mcp__v10r-compat__[a-z_]*' <<<"$init" | sort -u | wc -l | tr -d ' ')"
	local called="-"
	if [[ "$CALL" == 1 ]]; then
		grep -q '"name":"mcp__v10r-compat__search_patterns"' "$transcript" && called=yes || called=no
	fi
	printf '%-6s %-13s status=%-10s tools=%-2s called=%s\n' "$transport" "$fields" "${status:-none}" "$tools" "$called" | tee -a "$OUT/summary.txt"
	[[ "$fields" != none || ( "$status" == connected && "$tools" == 8 ) ]]
}

{
	echo "Claude Code: $(claude --version 2>/dev/null || echo unknown)"
	echo "Fixture runtime: $RUNTIME   Date: $(date -u +%Y-%m-%dT%H:%MZ)   Repo HEAD: $(git -C "$REPO" rev-parse --short HEAD 2>/dev/null || echo unknown)"
	echo "Pass = status connected and tools 8. 'none' is the control."
} | tee "$OUT/summary.txt"

control_ok=1
for transport in stdio http; do
	for fields in none title readOnlyHint both; do
		run_case "$transport" "$fields" || control_ok=0
	done
done

echo "Transcripts and summary: $OUT"
rm -rf "$WORK"
[[ "$control_ok" == 1 ]] || { echo "CONTROL FAILED — the kit, not the fields, is broken; see the transcripts." >&2; exit 1; }
