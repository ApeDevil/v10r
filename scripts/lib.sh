#!/usr/bin/env bash
# lib.sh — shared helpers for the `vr` toolkit. Source this; don't execute it.
#
# Provides: TOOLKIT_DIR + require_repo (cwd-aware REPO_ROOT/COMPOSE), branch/
# remote/container config, colored log helpers, `run` (echo-then-exec), and
# `run_validate` (container-aware gate).

# Where the toolkit itself lives (survives the ~/.local/bin symlink). Used only
# to locate sibling scripts — NOT the repo we act on.
__lib_self="$(readlink -f "${BASH_SOURCE[0]}")"
TOOLKIT_DIR="$(cd "$(dirname "$__lib_self")" && pwd)"

# The repo we act on is the git repo you're standing in — resolved lazily from
# your cwd by require_repo(), not pinned to wherever the toolkit is installed.
REPO_ROOT=""
COMPOSE=()

# Tunables — defaults suit a v10r-style repo. Override per-invocation with V10R_*
# env vars, or per-repo with a committed .vrrc (loaded by require_repo). Env wins.
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

# Resolve the repo we act on = the git repo you're standing in (cwd-aware).
# Lazy + idempotent: the first call finds the repo root, cds into it, loads that
# repo's optional .vrrc, and builds COMPOSE for it. Every command that touches a
# repo (ship, validate, dev/up/down, shell) calls this first.
require_repo() {
	[ -n "$REPO_ROOT" ] && return 0
	REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" \
		|| die "Not inside a git repository — cd into one first."
	cd "$REPO_ROOT"
	# Per-repo settings (container name, branches, service) without exporting
	# V10R_* every time. Solo-dev convenience; the file is sourced as you, so
	# only keep a .vrrc in repos you trust.
	# shellcheck disable=SC1091
	[ -f "$REPO_ROOT/.vrrc" ] && source "$REPO_ROOT/.vrrc"
	# Env still wins over .vrrc.
	REMOTE="${V10R_REMOTE:-$REMOTE}"
	DEV_BRANCH="${V10R_DEV_BRANCH:-$DEV_BRANCH}"
	MAIN_BRANCH="${V10R_MAIN_BRANCH:-$MAIN_BRANCH}"
	COMPOSE_SERVICE="${V10R_COMPOSE_SERVICE:-$COMPOSE_SERVICE}"
	CONTAINER_NAME="${V10R_CONTAINER:-$CONTAINER_NAME}"
	COMPOSE=(podman compose -f "$REPO_ROOT/compose.yaml")
}

# Run the full gate (`bun run validate`) inside the current repo's container.
# - Container up   → exec into it (leave it running; it's yours).
# - Container down → ephemeral one-shot via compose (auto-removed, never started long-lived).
run_validate() {
	require_repo
	command -v podman >/dev/null 2>&1 || die "podman not found on host."
	[ -f "$REPO_ROOT/compose.yaml" ] || die "No compose.yaml in $REPO_ROOT — vr's gate runs inside a container."
	if podman ps --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
		info "Container '$CONTAINER_NAME' is up → validating inside it"
		run podman exec "$CONTAINER_NAME" bun run validate
	else
		info "Container '$CONTAINER_NAME' is down → ephemeral one-shot (auto-removed)"
		run "${COMPOSE[@]}" run --rm -T "$COMPOSE_SERVICE" bun run validate
	fi
}
