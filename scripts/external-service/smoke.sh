#!/usr/bin/env bash
# Container smoke test for services/runtime-lab: the image the hosts run, exercised the way
# a host runs it. Proves what unit tests cannot — the built image starts as non-root,
# refuses to start without a credential, answers on $PORT, enforces auth and bounds over a
# real socket, and drains on SIGTERM.
#
#   bash scripts/external-service/smoke.sh            # build, then test
#   SKIP_BUILD=1 IMAGE=… bash scripts/external-service/smoke.sh   # test a prebuilt image
#
# Engine: $CONTAINER_ENGINE, else podman, else docker. Uses host port $SMOKE_PORT (18787).
# Leaves nothing running: the container is removed on exit, the image is kept.
set -euo pipefail

cd "$(dirname "$0")/../.."

ENGINE="${CONTAINER_ENGINE:-$(command -v podman >/dev/null && echo podman || echo docker)}"
IMAGE="${IMAGE:-localhost/runtime-lab:smoke}"
PORT="${SMOKE_PORT:-18787}"
NAME="runtime-lab-smoke-$$"
TOKEN="smoke-$(head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')"
PREVIOUS_TOKEN="smoke-previous-$(head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')"
BASE="http://127.0.0.1:$PORT"

cleanup() { "$ENGINE" rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT

pass() { printf '  ok   %s\n' "$1"; }
fail() { printf '  FAIL %s\n' "$1"; exit 1; }
status_of() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

if [ -z "${SKIP_BUILD:-}" ]; then
	start=$(date +%s)
	"$ENGINE" build -t "$IMAGE" -f services/runtime-lab/Containerfile services/runtime-lab
	echo "build: $(( $(date +%s) - start ))s"
fi
echo "image: $IMAGE ($("$ENGINE" image inspect "$IMAGE" --format '{{.Size}}' | awk '{printf "%.1f MB", $1/1e6}'))"

user=$("$ENGINE" image inspect "$IMAGE" --format '{{.Config.User}}')
[ "$user" = "nonroot" ] || [ "$user" = "65532" ] && pass "runs as non-root ($user)" || fail "image user is '$user'"

set +e
"$ENGINE" run --rm "$IMAGE" >/dev/null 2>&1
code=$?
set -e
[ "$code" = 2 ] && pass "refuses to start without SERVICE_TOKEN (exit 2)" || fail "missing token exited $code, want 2"

start=$(date +%s%N)
"$ENGINE" run -d --name "$NAME" -e SERVICE_TOKEN="$TOKEN" -e SERVICE_TOKEN_PREVIOUS="$PREVIOUS_TOKEN" \
	-e PORT=9090 -p "127.0.0.1:$PORT:9090" "$IMAGE" >/dev/null
for _ in $(seq 1 500); do
	[ "$(status_of "$BASE/health/live")" = 200 ] && break
	sleep 0.01
done
echo "start: container run → first liveness answer in $(( ($(date +%s%N) - start) / 1000000 )) ms (local engine, image present)"

[ "$(curl -s "$BASE/health/live")" = '{"status":"live"}' ] && pass "liveness on \$PORT=9090, public, minimal" || fail "liveness"
[ "$(status_of "$BASE/v1/status")" = 401 ] && pass "status without credential → 401" || fail "status unauthenticated"
[ "$(status_of -H "Authorization: Bearer wrong-$TOKEN" "$BASE/v1/status")" = 401 ] && pass "status with wrong credential → 401" || fail "status wrong token"
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/v1/status" | grep -q '"service":"runtime-lab"' && pass "status with credential → identity" || fail "status authenticated"
[ "$(status_of -H "Authorization: Bearer $PREVIOUS_TOKEN" "$BASE/v1/status")" = 200 ] && pass "status with the rotating-out credential → 200" || fail "previous token"
workers=$("$ENGINE" logs "$NAME" 2>&1 | grep '"event":"listening"' | grep -o '"workers":[0-9]*' | cut -d: -f2)
[ -n "$workers" ] && pass "startup logs the Tokio worker count ($workers)" || fail "no worker count in the listening line"

evaluate() { curl -s -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' --data "$1" "$BASE/v1/evaluate"; }
evaluate '{"totalCents":100,"events":[{"type":"pay","amountCents":100},{"type":"ship"}]}' | grep -q '"outcome":"accepted"' && pass "evaluate → accepted" || fail "evaluate accepted"
evaluate '{"totalCents":100,"events":[{"type":"ship"}]}' | grep -q '"reason":"payment_incomplete"' && pass "evaluate → refused (domain answer)" || fail "evaluate refused"
[ "$(status_of -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' --data '{"totalCents":0,"events":[]}' "$BASE/v1/evaluate")" = 400 ] && pass "out-of-bounds input → 400" || fail "validation"
big=$(head -c 9000 /dev/zero | tr '\0' 'x')
[ "$(status_of -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' --data "$big" "$BASE/v1/evaluate")" = 413 ] && pass "9000-byte body → 413" || fail "body limit"
curl -s -D - -o /dev/null -H 'x-request-id: smoke-correlation-1' "$BASE/health/live" | grep -qi '^x-request-id: smoke-correlation-1' && pass "request id echoed" || fail "request id"
huge=$(head -c 20000 /dev/zero | tr '\0' 'h')
[ "$(status_of -H "x-padding: $huge" "$BASE/health/live")" = 431 ] && pass "20 KB request head → 431" || fail "header size cap"

# Slowloris: a head that never completes must be cut off by HEADER_READ_TIMEOUT (5 s).
start=$(date +%s)
exec 3<>"/dev/tcp/127.0.0.1/$PORT"
printf 'GET /health/live HTTP/1.1\r\nHo' >&3
timeout 15 cat <&3 >/dev/null || true
exec 3<&- 3>&-
slow=$(( $(date +%s) - start ))
[ "$slow" -ge 4 ] && [ "$slow" -le 7 ] && pass "unfinished request head closed after ${slow}s" || fail "slow head held ${slow}s"

"$ENGINE" logs "$NAME" 2>&1 | grep -q -e "$TOKEN" -e "$PREVIOUS_TOKEN" && fail "a credential appeared in the logs" || pass "credentials absent from logs"

start=$(date +%s%N)
"$ENGINE" stop -t 10 "$NAME" >/dev/null
stop_ms=$(( ($(date +%s%N) - start) / 1000000 ))
exit_code=$("$ENGINE" inspect "$NAME" --format '{{.State.ExitCode}}')
[ "$exit_code" = 0 ] && [ "$stop_ms" -lt 5000 ] && pass "SIGTERM → drained, exit 0 in ${stop_ms} ms" || fail "stop: exit $exit_code after ${stop_ms} ms"
"$ENGINE" logs "$NAME" 2>&1 | grep -q '"event":"stopped"' && pass "logged an orderly stop" || fail "no stop log line"

echo "smoke: all checks passed"
