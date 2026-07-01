#!/usr/bin/env bash
#
# validate.sh — run the full gate (`bun run validate`) inside the v10r container.
# Standalone equivalent of the gate that `ship.sh` runs.
#
set -euo pipefail
source "$(dirname "$(readlink -f "$0")")/lib.sh"

run_validate
ok "Validation passed."
