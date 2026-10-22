#!/usr/bin/env bash
#
# session-start.sh — prepare a Claude Code cloud session (the SessionStart hook in
# .claude/settings.json). A cloud VM has no v10r container, so this does what the
# container's startup does: the pinned Bun, a frozen-lockfile install, and an .env — here
# the fake one, because a cloud session holds no secrets.
#
# Local sessions exit at once: there the container is the environment
# (docs/foundation/development-environment.md). Idempotent and offline-safe to re-run;
# it never touches a database, a remote, or a deploy.
#
set -euo pipefail

[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0

cd "$(dirname "$(readlink -f "$0")")/../.."

# package.json `packageManager` is the one Bun pin; the lockfile is only frozen-compatible
# with that version.
want="$(sed -n 's/.*"packageManager": *"bun@\([^"]*\)".*/\1/p' package.json)"
have="$(bun --version 2>/dev/null || true)"
if [ "$have" != "$want" ]; then
	echo "session-start: bun ${have:-missing} → installing bun@$want from npm"
	npm install --global --silent "bun@$want"
	hash -r
fi

bun install --frozen-lockfile

# The container's heap cap (compose.yaml NODE_OPTIONS): without it svelte-check and vite build
# die at V8's default old-space limit. Appended, not replaced — the cloud's own NODE_OPTIONS
# (--use-openssl-ca, the proxy CA) must survive. CLAUDE_ENV_FILE is sourced before every
# later Bash command of the session.
heap="$(sed -n 's/.*NODE_OPTIONS=\(--max-old-space-size=[0-9]*\).*/\1/p' compose.yaml)"
if [ -z "$heap" ]; then
	echo "session-start: no --max-old-space-size in compose.yaml; heap cap not set" >&2
elif [ -z "${CLAUDE_ENV_FILE:-}" ]; then
	echo "session-start: CLAUDE_ENV_FILE unset; run with NODE_OPTIONS=\"\$NODE_OPTIONS $heap\"" >&2
elif ! grep -qs -- "$heap" "$CLAUDE_ENV_FILE"; then
	echo "export NODE_OPTIONS=\"\${NODE_OPTIONS:+\$NODE_OPTIONS }$heap\"" >>"$CLAUDE_ENV_FILE"
	echo "session-start: NODE_OPTIONS += $heap (compose.yaml parity)"
fi

if [ ! -f .env ]; then
	cp .env.placeholder .env
	echo "session-start: wrote .env from .env.placeholder (fake values)"
fi

cat <<'NOTE'
session-start: cloud session ready — `bun run validate` and `bun run validate:build` run here.
Not available in the cloud (local container only): db:push, db:seed, refresh (its RAG ingest
needs the database), the dev server against Neon, anything needing a real credential.
Report those as not run; never as passed.
NOTE
