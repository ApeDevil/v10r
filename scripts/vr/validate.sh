#!/usr/bin/env bash
#
# validate.sh — run the full gate (`bun run validate`) inside the v10r container.
# Standalone equivalent of the gate that `ship.sh` runs.
# --build additionally runs `bun run validate:build`: a production build plus the
# perf-ratchet check against fresh numbers (the committed snapshot.json is not
# rewritten, so the tree stays clean for ship).
#
set -euo pipefail
source "$(dirname "$(readlink -f "$0")")/lib.sh"

with_build=false
for arg in "$@"; do
	case "$arg" in
		--build) with_build=true ;;
		*) die "validate.sh: unknown flag: $arg (only --build)" ;;
	esac
done

run_validate
ok "Validation passed."

if $with_build; then
	run_validate_build
	ok "Build check passed."
fi
