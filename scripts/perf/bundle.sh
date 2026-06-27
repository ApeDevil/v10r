#!/usr/bin/env bash
# Bundle weight probe — runs AFTER `vite build`, reads the adapter-vercel output.
#
#   podman compose run --rm --entrypoint bun app run build
#   bash scripts/perf/bundle.sh
#
# Reports: largest client JS chunks (raw + gzip), total client JS, and any
# prerendered HTML document weight (catches inline-SVG/{@html} bloat in the doc).

set -uo pipefail
OUT=".vercel/output/static/_app/immutable"
ROUTE_JS_FAIL_KB=250

if [ ! -d "$OUT" ]; then
	echo "No build output at $OUT — run: podman compose run --rm --entrypoint bun app run build"
	exit 2
fi

echo "=== Top 15 client JS chunks (raw / gzip) ==="
printf "%12s %12s  %s\n" "RAW(KB)" "GZIP(KB)" "FILE"
find "$OUT" -name '*.js' -printf '%s %p\n' | sort -rn | head -15 | while read -r bytes path; do
	raw_kb=$(awk "BEGIN{printf \"%.1f\", $bytes/1024}")
	gz_kb=$(gzip -c "$path" | wc -c | awk '{printf "%.1f", $1/1024}')
	printf "%12s %12s  %s\n" "$raw_kb" "$gz_kb" "${path#$OUT/}"
done

total_raw=$(find "$OUT" -name '*.js' -printf '%s\n' | awk '{s+=$1} END{printf "%.0f", s/1024}')
echo ""
echo "Total client JS (raw): ${total_raw} KB across $(find "$OUT" -name '*.js' | wc -l) files"

echo ""
echo "=== Prerendered HTML documents (transfer weight matters) ==="
PRE=".vercel/output/static"
find "$PRE" -name '*.html' -printf '%s %p\n' 2>/dev/null | sort -rn | head -10 | while read -r bytes path; do
	kb=$(awk "BEGIN{printf \"%.1f\", $bytes/1024}")
	flag=""
	[ "$bytes" -gt 102400 ] && flag="  <-- >100KB (inline asset bloat?)"
	printf "%10s KB  %s%s\n" "$kb" "${path#$PRE/}" "$flag"
done
[ -z "$(find "$PRE" -name '*.html' 2>/dev/null)" ] && echo "  (no prerendered HTML — nothing is prerender=true)"
