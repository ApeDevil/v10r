#!/usr/bin/env bash
# lib.sh — shared helpers for the `vr` toolkit. Source this; don't execute it.
#
# Provides: REPO_ROOT, branch/remote/container config, colored log helpers,
# `run` (echo-then-exec), and `run_validate` (container-aware gate).

# Resolve the repo root from this file's real location (survives symlinks).
__lib_self="$(readlink -f "${BASH_SOURCE[0]}")"
REPO_ROOT="$(cd "$(dirname "$__lib_self")/.." && pwd)"

# Tunables — override via env if your setup differs.
REMOTE="${V10R_REMOTE:-origin}"
DEV_BRANCH="${V10R_DEV_BRANCH:-dev}"
MAIN_BRANCH="${V10R_MAIN_BRANCH:-main}"
COMPOSE_SERVICE="${V10R_COMPOSE_SERVICE:-app}"
CONTAINER_NAME="${V10R_CONTAINER:-v10r}"

# Colors — only when stdout is a TTY and NO_COLOR is unset.
if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
	C_DIM=$'\033[2m'; C_RED=$'\033[31m'; C_GRN=$'\033[32m'
	C_YEL=$'\033[33m'; C_BLU=$'\033[34m'; C_RST=$'\033[0m'
else
	C_DIM=''; C_RED=''; C_GRN=''; C_YEL=''; C_BLU=''; C_RST=''
fi

info() { printf '%s▸%s %s\n' "$C_BLU" "$C_RST" "$*"; }
ok()   { printf '%s✓%s %s\n' "$C_GRN" "$C_RST" "$*"; }
warn() { printf '%s!%s %s\n' "$C_YEL" "$C_RST" "$*"; }
err()  { printf '%s✗%s %s\n' "$C_RED" "$C_RST" "$*" >&2; }
die()  { err "$*"; exit 1; }

# Echo a command (dimmed) then run it.
run() { printf '%s  $ %s%s\n' "$C_DIM" "$*" "$C_RST"; "$@"; }

# Run the full gate (`bun run validate`) inside the container.
# - Container up   → exec into it (leave it running; it's yours).
# - Container down → ephemeral one-shot via compose (auto-removed, never started long-lived).
run_validate() {
	command -v podman >/dev/null 2>&1 || die "podman not found on host."
	if podman ps --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
		info "Container '$CONTAINER_NAME' is up → validating inside it"
		run podman exec "$CONTAINER_NAME" bun run validate
	else
		info "Container '$CONTAINER_NAME' is down → ephemeral one-shot (auto-removed)"
		( cd "$REPO_ROOT" && run podman compose run --rm -T "$COMPOSE_SERVICE" bun run validate )
	fi
}
