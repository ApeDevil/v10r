#!/usr/bin/env bash
# lib.sh — shared helpers for the `vr` toolkit. Source this; don't execute it.
#
# Provides: TOOLKIT_DIR + require_repo (cwd-aware REPO_ROOT/COMPOSE), branch/
# remote config, compose_service (auto-derived), colored log helpers, `run`
# (echo-then-exec), `container_run` (compose-aware in-container runner), and
# `run_validate` (the gate, a thin wrapper over container_run).

# Where the toolkit itself lives (survives the ~/.local/bin symlink). Used only
# to locate sibling scripts — NOT the repo we act on.
__lib_self="$(readlink -f "${BASH_SOURCE[0]}")"
TOOLKIT_DIR="$(cd "$(dirname "$__lib_self")" && pwd)"

# The repo we act on is the git repo you're standing in — resolved lazily from
# your cwd by require_repo(), not pinned to wherever the toolkit is installed.
REPO_ROOT=""
COMPOSE=()
__compose_service=""

# Tunables — defaults suit a v10r-style repo. Override per-invocation with V10R_*
# env vars, or per-repo with a committed .vrrc (loaded by require_repo). Env wins.
# The container name and service are NOT tunables here — they're read from the
# repo's own compose.yaml (see compose_service + container_run), so most repos
# need no .vrrc at all.
REMOTE="${V10R_REMOTE:-origin}"
DEV_BRANCH="${V10R_DEV_BRANCH:-dev}"
MAIN_BRANCH="${V10R_MAIN_BRANCH:-main}"
# Empty ⇒ auto-derive from compose.yaml (config --services); override to pin.
COMPOSE_SERVICE="${V10R_COMPOSE_SERVICE:-}"

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
	COMPOSE=(podman compose -f "$REPO_ROOT/compose.yaml")
}

# The compose service to target. An explicit override (V10R_COMPOSE_SERVICE / a
# .vrrc COMPOSE_SERVICE) wins; otherwise it's derived from the repo's compose.yaml
# — prefer `app`, else the sole service. Memoized per process. This is what lets
# most repos work with no .vrrc: the service (and, via compose, the container)
# come from the file that already declares them.
compose_service() {
	[ -n "$__compose_service" ] && { printf '%s' "$__compose_service"; return 0; }
	if [ -n "$COMPOSE_SERVICE" ]; then
		__compose_service="$COMPOSE_SERVICE"
	else
		local services
		services="$("${COMPOSE[@]}" config --services 2>/dev/null)"
		if printf '%s\n' "$services" | grep -qx app; then
			__compose_service=app
		else
			__compose_service="$(printf '%s\n' "$services" | sed '/^$/d' | head -n1)"
		fi
		[ -n "$__compose_service" ] \
			|| die "Couldn't find a service in $REPO_ROOT/compose.yaml — set COMPOSE_SERVICE in .vrrc."
	fi
	printf '%s' "$__compose_service"
}

# True when at least one of this project's containers is actually RUNNING.
#
# `compose ps -q` lists project containers in ANY state, so a *stopped* container is
# still listed. Testing only that the list is non-empty therefore reports "up" for a
# project whose container exited, and the `exec` that follows fails with
# "can only create exec sessions on running containers: container state improper".
# Stopped and removed are different states and only one of them used to be handled.
#
# podman-compose rejects a service argument to `ps -q` (it is a usage error, not an
# empty result), so the state filter cannot live at the compose layer — ask podman
# about each id instead. A line that is not a container id simply inspects to empty
# and is skipped, which also absorbs any provider chatter that reaches stdout.
project_running() {
	local ids id
	ids="$("${COMPOSE[@]}" ps -q 2>/dev/null)" || return 1
	[ -n "$ids" ] || return 1
	while IFS= read -r id; do
		[ -n "$id" ] || continue
		[ "$(podman inspect --format '{{.State.Running}}' "$id" 2>/dev/null)" = "true" ] && return 0
	done <<<"$ids"
	return 1
}

# Run a command inside the current repo's container. The container name is never
# hard-coded — we drive the repo's compose project:
# - project running → `compose exec` into the service (reuse the warm container)
# - anything else   → `compose run --rm` one-shot (auto-removed, never long-lived)
# Leading `-e KEY=VAL` pairs become container env vars (exec and run both take -e).
#
# The one-shot deliberately does NOT start the project first. It needs no cleanup,
# so a caller cannot leave a container behind on a path that exits early — and every
# ship path does (rollback on gate failure, abort at the push confirmation, --dry-run).
# It also cannot stop a container you were already using: a `vr s` in one terminal
# never touches the dev server in another.
container_run() {
	require_repo
	command -v podman >/dev/null 2>&1 || die "podman not found on host."
	[ -f "$REPO_ROOT/compose.yaml" ] || die "No compose.yaml in $REPO_ROOT — vr runs commands inside a container."
	local env_flags=()
	while [ $# -gt 1 ] && [ "$1" = "-e" ]; do
		env_flags+=(-e "$2"); shift 2
	done
	local svc; svc="$(compose_service)"
	if project_running; then
		info "Container up → running via 'compose exec $svc'"
		run "${COMPOSE[@]}" exec -T "${env_flags[@]}" "$svc" "$@"
	else
		info "Container not running → ephemeral one-shot (auto-removed)"
		run "${COMPOSE[@]}" run --rm -T "${env_flags[@]}" "$svc" "$@"
	fi
}

# Run the full gate (`bun run validate`) inside the current repo's container.
run_validate() { container_run bun run validate; }

# Production build + perf-ratchet check against fresh numbers. NODE_ENV lives
# inside the npm script itself so every entry point gets it right.
run_validate_build() { container_run bun run validate:build; }
