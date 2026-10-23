#!/usr/bin/env bash
# The free-tier envelope, reproduced: the runtime-lab image under Render Free's published
# limits (0.1 CPU, 512 MB), measured through the real service client (verify.ts).
#
#   bash scripts/external-service/bench.sh                          # build, then measure
#   SKIP_BUILD=1 IMAGE=… bash scripts/external-service/bench.sh      # a prebuilt image
#   BENCH_CPUS=1 BENCH_MEMORY=1g bash scripts/external-service/bench.sh   # another envelope
#   bash scripts/external-service/bench.sh --samples 500 --concurrency 8  # args go to verify.ts
#
# A measurement, not a development setting: compose.yaml runs the service unlimited. What a
# local cgroup limit reproduces is the CPU quota and memory ceiling — not Render's proxy,
# network or scheduler — so these figures are "controlled lab", never "hosted".
# Engine: $CONTAINER_ENGINE, else podman, else docker. Host port $BENCH_PORT (18788).
set -euo pipefail

cd "$(dirname "$0")/../.."

ENGINE="${CONTAINER_ENGINE:-$(command -v podman >/dev/null && echo podman || echo docker)}"
IMAGE="${IMAGE:-localhost/runtime-lab:bench}"
PORT="${BENCH_PORT:-18788}"
CPUS="${BENCH_CPUS:-0.1}"
MEMORY="${BENCH_MEMORY:-512m}"
NAME="runtime-lab-bench-$$"
TOKEN="bench-$(head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')"
[ "$#" -gt 0 ] || set -- --samples 200 --concurrency 4

cleanup() { "$ENGINE" rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT
memory() { "$ENGINE" stats --no-stream --format '{{.MemUsage}}' "$NAME" | cut -d/ -f1 | tr -d ' '; }

if [ -z "${SKIP_BUILD:-}" ]; then
	"$ENGINE" build ${RUST_IMAGE:+--build-arg "RUST_IMAGE=$RUST_IMAGE"} -t "$IMAGE" -f services/runtime-lab/Containerfile services/runtime-lab
fi

start=$(date +%s%N)
# The credential by name only (`-e NAME` reads this environment), never on the command line.
SERVICE_TOKEN="$TOKEN" "$ENGINE" run -d --name "$NAME" --cpus "$CPUS" --memory "$MEMORY" --pids-limit 64 \
	--read-only --cap-drop=ALL --security-opt=no-new-privileges \
	-e SERVICE_TOKEN -e PORT=8080 -p "127.0.0.1:$PORT:8080" "$IMAGE" >/dev/null
for _ in $(seq 1 1000); do
	curl -sf -o /dev/null "http://127.0.0.1:$PORT/health/live" && break
	sleep 0.01
done
echo "bench: $IMAGE under --cpus $CPUS --memory $MEMORY ($ENGINE $("$ENGINE" version --format '{{.Server.Version}}' 2>/dev/null || true))"
echo "  container run → first liveness answer: $(( ($(date +%s%N) - start) / 1000000 )) ms"
echo "  $("$ENGINE" logs "$NAME" 2>&1 | grep '"event":"listening"')"
echo "  memory idle: $(memory)"

EXTERNAL_SERVICE_LOCAL_URL="http://127.0.0.1:$PORT" EXTERNAL_SERVICE_LOCAL_TOKEN="$TOKEN" \
	bun run scripts/external-service/verify.ts --target local "$@"  # a second --target is refused

echo "  memory after the run: $(memory)"
"$ENGINE" stop -t 10 "$NAME" >/dev/null
echo "  stop: exit $("$ENGINE" inspect "$NAME" --format '{{.State.ExitCode}}')"
