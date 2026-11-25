#!/usr/bin/env bash
# The agentic architecture's verification, one command per environment tier, plus the strict
# ship verdict.
#
#   scripts/agentic/verify.sh offline     # no keys, no database, no server: gates, interop, bench, scenario
#   scripts/agentic/verify.sh server      # + a running dev server: MCP conformance, browser specs
#   scripts/agentic/verify.sh providers   # + a provider key and a signed-in cookie: live eval turns
#   scripts/agentic/verify.sh claude      # + Claude Code signed in on this machine: the compat kit
#   scripts/agentic/verify.sh all         # every tier above, in order (development: a SKIP is not a failure)
#   scripts/agentic/verify.sh strict      # every tier + the manual attestations: the ship verdict
#
# Local runs go through the container: `podman exec v10r scripts/agentic/verify.sh offline`
# (the claude tier runs on the host, where Claude Code is). Each step is Mandatory (for shipping)
# or Optional, and ends Passed, Failed, Skipped (an optional step whose prerequisite is missing)
# or Externally blocked (a mandatory step whose prerequisite is missing — never a pass).
#
# The development tiers exit non-zero only when a step failed. `strict` is ship-ready only when
# every mandatory step passed on a clean tree and every mandatory manual check is attested in
# V10R_MANUAL; exit 0 ready, 1 failed, 3 blocked. Every run writes a JSON record of the commit,
# tree state, environment, provider and model — no cookie, key or secret is ever written
# (scripts/agentic/verification-record.ts). What each tier needs, and the manual checks:
# docs/blueprint/architecture/agentic-architecture/verification.md.
#
# Environment:
#   V10R_BASE_URL     dev server for `server` and `providers` (default http://localhost:5173)
#   V10R_COOKIE       signed-in session cookie for `providers` (better-auth.session_token=…); read, never recorded
#   V10R_COMPAT_MODEL model for the Claude Code compat kit (optional; default: your Claude Code config)
#   V10R_MANUAL       manual attestation file for `strict` (template: scripts/agentic/manual-checks.template)
#   V10R_RECORD_DIR   where records go (default test-results/agentic, git-ignored)
set -uo pipefail

cd "$(dirname "$0")/../.."
TIER="${1:-offline}"
BASE="${V10R_BASE_URL:-http://localhost:5173}"
export NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=8192"
RECORD_DIR="${V10R_RECORD_DIR:-test-results/agentic}"
mkdir -p "$RECORD_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
STEPS="$(mktemp)"
EVALS=()
trap 'rm -f "$STEPS"' EXIT

# step <id> <mandatory|optional> <title> <command…>
step() {
	local id="$1" requirement="$2" title="$3"
	shift 3
	echo "── ${title}"
	local started=$SECONDS status=passed
	"$@" || status=failed
	printf '%s\t%s\t%s\t%s\t%s\t\n' "$id" "$requirement" "$status" "$((SECONDS - started))" "$title" >>"$STEPS"
}
# missing <id> <mandatory|optional> <title> <what is missing>
missing() {
	local status=skipped
	[ "$2" = mandatory ] && status=blocked
	printf '%s\t%s\t%s\t0\t%s\t%s\n' "$1" "$2" "$status" "$3" "$4" >>"$STEPS"
}
have() { command -v "$1" >/dev/null 2>&1; }
up() { curl -fsS -o /dev/null --max-time 10 "${BASE}/" 2>/dev/null; }

offline() {
	step validate mandatory "validate (typecheck, lint, tests incl. the cross-protocol scenario, registry, skills, i18n)" bun run validate
	step validate-build mandatory "validate:build (production build + perf ratchet)" bun run validate:build
	if have uv; then
		step a2a-interop mandatory "A2A interop vs Python a2a-sdk (incl. delegation, timeout, cancel)" bun run a2a:interop
		step mcp-client-interop mandatory "MCP client interop vs Python FastMCP + v10r server" bun run mcp:client:interop
	else
		missing a2a-interop mandatory "A2A interop vs Python a2a-sdk" "uv not installed"
		missing mcp-client-interop mandatory "MCP client interop vs Python FastMCP" "uv not installed"
	fi
	step genui-bench mandatory "generative UI bench report current" bun run genui:bench --check
	step mcp-apps mandatory "MCP App View document current" bun run mcp:apps:check
	step skills mandatory "Agent Skills in sync and spec-valid" bun run skills:check
}

server() {
	if ! up; then
		missing mcp-conformance mandatory "MCP conformance (official suite)" "no dev server at ${BASE} (bun run dev)"
		missing browser-specs mandatory "browser specs (Interop Lab, showcases)" "no dev server at ${BASE}"
		return
	fi
	step mcp-conformance mandatory "MCP conformance (official suite) against ${BASE}/api/mcp/public" bun run mcp:conformance --url "${BASE}/api/mcp/public"
	step browser-specs mandatory "browser specs (Interop Lab, showcases)" env PLAYWRIGHT_BASE_URL="${BASE}" bunx playwright test --trace off
}

providers() {
	local why=""
	if ! up; then
		why="no dev server at ${BASE}"
	elif [ -z "${V10R_COOKIE:-}" ]; then
		why="V10R_COOKIE not set (sign in, copy better-auth.session_token)"
	fi
	if [ -n "$why" ]; then
		missing eval-genui mandatory "AI eval: generative UI cases" "$why"
		missing eval-golden mandatory "AI eval: full golden set" "$why"
		return
	fi
	local genui="genui-text-by-default,genui-comparison-surface,genui-requirements-form,genui-form-submit-follow-up,genui-chart-recalculate,genui-multi-step,genui-architecture-flow,genui-text-follow-up"
	local genui_record="${RECORD_DIR}/eval-genui-${STAMP}.json" golden_record="${RECORD_DIR}/eval-golden-${STAMP}.json"
	step eval-genui mandatory "AI eval: generative UI cases (single and multi-turn)" bun run ai:eval -- --base "${BASE}" --only "${genui}" --check --record "$genui_record"
	step eval-golden mandatory "AI eval: full golden set (v7 chatbot + deskbot turns)" bun run ai:eval -- --base "${BASE}" --check --record "$golden_record"
	EVALS+=("$genui_record" "$golden_record")
}

claude() {
	# B1 (title / readOnlyHint on the public tools) is not a ship blocker: the kit is optional.
	if ! have claude; then
		missing claude-compat optional "Claude Code compat kit" "claude CLI not on PATH (run on the host)"
		return
	fi
	step claude-compat optional "Claude Code compat kit (title, readOnlyHint, _meta.ui; stdio + http; with a call)" scripts/mcp/claude-code-compat/check.sh --call
}

case "$TIER" in
offline) offline ;;
server) server ;;
providers) providers ;;
claude) claude ;;
all | strict)
	offline
	server
	providers
	claude
	;;
*)
	echo "usage: $0 offline|server|providers|claude|all|strict" >&2
	exit 2
	;;
esac

evals_arg=""
[ "${#EVALS[@]}" -gt 0 ] && evals_arg="$(
	IFS=,
	echo "${EVALS[*]}"
)"
bun scripts/agentic/verification-record.ts --tier "$TIER" --steps "$STEPS" \
	--out "${RECORD_DIR}/verify-${TIER}-${STAMP}.json" --evals "$evals_arg" \
	${V10R_MANUAL:+--manual "$V10R_MANUAL"}
