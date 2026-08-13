#!/usr/bin/env bash
# TTFB matrix — first-byte latency across representative routes.
#
# Measure against a LOCAL PROD BUILD, not the dev server:
#   podman compose run --rm --service-ports --entrypoint sh app -c "bun run build && bun run preview --host --port 4173" &
#   BASE=http://localhost:4173 bash scripts/perf/ttfb.sh
# Or point at the live deployment: BASE=https://<prod> bash scripts/perf/ttfb.sh
#
# Budgets: src/lib/server/perf/budgets.json (ttfb_ms). Exit 1 if any route exceeds fail.
# Read from the SSOT rather than hardcoded here — the two drifted before, and a
# probe scoring against thresholds nobody else uses is worse than no probe.

set -uo pipefail
BASE="${BASE:-http://localhost:4173}"
BUDGETS="$(dirname "$0")/../../src/lib/server/perf/budgets.json"

read_budget() { # $1 = warn|fail; falls back if jq or the file is unavailable
	if command -v jq >/dev/null 2>&1 && [ -f "$BUDGETS" ]; then
		jq -r ".budgets.ttfb_ms.$1" "$BUDGETS" 2>/dev/null && return
	fi
	[ "$1" = "warn" ] && echo 200 || echo 600
}

WARN_MS=$(read_budget warn)
FAIL_MS=$(read_budget fail)
RUNS="${RUNS:-3}"   # take the best of N to approximate warm

ROUTES=(
	"/"
	"/showcases"
	"/showcases/ui/components/primitives"
	"/blog"
	"/docs"
	"/api/search?q=button&locale=en"
	"/api/search-index/en"
)

printf "%-44s %10s %8s\n" "ROUTE" "TTFB(ms)" "STATUS"
printf '%.0s-' {1..64}; printf '\n'

fail=0
for route in "${ROUTES[@]}"; do
	best=999999
	for _ in $(seq 1 "$RUNS"); do
		ms=$(curl -sS -o /dev/null -w '%{time_starttransfer}' "${BASE}${route}" 2>/dev/null \
			| awk '{printf "%d", $1 * 1000}')
		[ -n "$ms" ] && [ "$ms" -lt "$best" ] && best=$ms
	done
	status="ok"
	if   [ "$best" -gt "$FAIL_MS" ]; then status="FAIL"; fail=1
	elif [ "$best" -gt "$WARN_MS" ]; then status="warn"; fi
	printf "%-44s %10s %8s\n" "$route" "$best" "$status"
done

exit $fail
