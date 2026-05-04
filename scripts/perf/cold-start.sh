#!/usr/bin/env bash
# Cold-start measurement probe.
# Drives the dev container through a clean restart, parses Vite logs for
# "ready in Xms", and measures first-request TTFB. Catches regressions when
# someone fattens the SSR module graph or warmup config.
#
# Usage (from host):
#   bash scripts/perf/cold-start.sh
#
# Exit codes:
#   0 — vite_ready_ms <= FAIL_MS
#   1 — vite_ready_ms >  FAIL_MS  (regression — investigate)
#   2 — measurement failed (container did not become ready in time)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
CONTAINER=v10r
WARN_MS=15000
FAIL_MS=25000
TIMEOUT_S=120

cd "$PROJECT_DIR"

echo "[perf] tearing down container…"
podman compose down >/dev/null 2>&1 || true

echo "[perf] starting container…"
podman compose up -d >/dev/null

START_S=$(date +%s)
echo "[perf] waiting for vite ready (timeout ${TIMEOUT_S}s)…"

while true; do
	if podman logs "$CONTAINER" 2>&1 | grep -q 'ready in'; then
		break
	fi
	if [ $(($(date +%s) - START_S)) -gt $TIMEOUT_S ]; then
		echo "[perf] FAIL: container did not become ready in ${TIMEOUT_S}s"
		podman logs --tail 30 "$CONTAINER" 2>&1
		exit 2
	fi
	sleep 1
done

WALL_S=$(($(date +%s) - START_S))
LOGS=$(podman logs "$CONTAINER" 2>&1)

# Parse: "Checked 842 installs across 991 packages (no changes) [1117.00ms]"
INSTALL_MS=$(echo "$LOGS" | grep -oE 'Checked .+\[[0-9.]+ms\]' | grep -oE '[0-9.]+ms' | head -1 | tr -d 'ms' | awk '{printf "%d", $1}')
INSTALL_MS=${INSTALL_MS:-0}

# Parse: "VITE v7.3.0  ready in 36573 ms"
READY_MS=$(echo "$LOGS" | grep -oE 'ready in [0-9]+ ?ms' | grep -oE '[0-9]+' | head -1)
READY_MS=${READY_MS:-0}

# First SSR TTFB
TTFB_MS=$(curl -sS -o /dev/null -w '%{time_starttransfer}' "http://localhost:5173/" | awk '{printf "%d", $1 * 1000}')

# Spurious page-reload count in 10s post-ready window
sleep 10
RELOAD_COUNT=$(podman logs "$CONTAINER" 2>&1 | grep -cE '\(ssr\) page reload src/lib/paraglide/' || true)

cat <<EOF

[perf] ── results ─────────────────────────────────
  install_ms          ${INSTALL_MS}
  vite_ready_ms       ${READY_MS}
  first_ssr_ttfb_ms   ${TTFB_MS}
  ssr_reload_count    ${RELOAD_COUNT}
  wall_clock_secs     ${WALL_S}

  thresholds: warn ${WARN_MS}ms / fail ${FAIL_MS}ms
EOF

if [ "$RELOAD_COUNT" -gt 0 ]; then
	echo "[perf] WARN: ${RELOAD_COUNT} spurious paraglide page-reload events post-ready"
fi

if [ "$READY_MS" -gt $FAIL_MS ]; then
	echo "[perf] FAIL: vite_ready_ms ${READY_MS} > ${FAIL_MS}"
	exit 1
fi

if [ "$READY_MS" -gt $WARN_MS ]; then
	echo "[perf] WARN: vite_ready_ms ${READY_MS} > ${WARN_MS}"
fi

echo "[perf] OK"
