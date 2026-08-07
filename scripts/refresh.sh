#!/usr/bin/env bash
#
# refresh.sh — refresh every derived surface of the pattern library after a
# pattern/doc change. Runs `bun run refresh` inside the repo's container:
# registry validation → generated index/pages → public-excerpt snapshot →
# RAG ingest (fail-fast order, slowest + quota-bound last). Git stays on the
# host, per vr philosophy.
#
set -euo pipefail
source "$(dirname "$(readlink -f "$0")")/lib.sh"

FORCE=0

usage() {
	cat <<'EOF'
vr refresh (ref) — refresh derived surfaces (`bun run refresh`) in the repo's container.

Chain: mcp:validate → patterns:build → mcp:excerpts:build → db:ingest-docs.
patterns:build regenerates the README Pattern Index and the docs/pattern-library/
pages from the registry; the ingest is content-hash idempotent — only changed
docs re-embed.

Flags:
  -f, --force   full re-chunk/re-embed (INGEST_FORCE=1) — use after a
                chunking-logic change; burns embed quota
  -h, --help    show this help
EOF
}

while [ $# -gt 0 ]; do
	case "$1" in
		-f|--force) FORCE=1 ;;
		-h|--help)  usage; exit 0 ;;
		*)          die "unknown argument: $1 (try -h)" ;;
	esac
	shift
done

if [ "$FORCE" -eq 1 ]; then
	container_run -e INGEST_FORCE=1 bun run refresh
else
	container_run bun run refresh
fi

# The generated surfaces are committed artifacts: Neon RAG is globally fresh
# the moment ingest finishes, but the hosted MCP, README index, and pattern
# pages only reach consumers via a commit (+ the next deploy). Nudge
# accordingly. Existence-guarded so this stays a no-op in repos without the
# v10r surfaces (vr is generic).
generated=()
[ -f "$REPO_ROOT/mcp/public-excerpts.snapshot.json" ] && generated+=("mcp/public-excerpts.snapshot.json")
[ -d "$REPO_ROOT/docs/pattern-library" ] && generated+=("README.md" "docs/pattern-library")
if [ "${#generated[@]}" -gt 0 ]; then
	if [ -n "$(git status --porcelain -- "${generated[@]}" 2>/dev/null)" ]; then
		warn "Generated surfaces changed (${generated[*]}) — commit them; hosted MCP + /showcases/mcp update on the next 'vr ship'."
	else
		ok "Generated surfaces unchanged — nothing to commit."
	fi
fi

ok "Refresh complete — registry valid, generated surfaces current, RAG index fresh."
