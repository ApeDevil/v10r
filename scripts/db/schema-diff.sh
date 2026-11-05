#!/usr/bin/env bash
# schema-diff.sh — the SQL that takes a database from one commit's Drizzle schema to another's,
# computed offline (no database connection). The cloud has no DATABASE_URL, so `db:push` cannot
# run there; this prints the statements a cloud session then applies through the Neon connector
# (docs/blueprint/data/drizzle-workflow.md → "Schema changes from a cloud session").
#
#   bash scripts/db/schema-diff.sh <from-ref> [<to-ref>]     # to-ref defaults to the working tree
#
# How: `drizzle-kit generate` at <from-ref> writes a baseline snapshot into a scratch folder, then
# `generate` at <to-ref> diffs against it — the second migration file is the change. Nothing in
# the repo is written; the scratch worktree is removed on exit.
set -euo pipefail

FROM=${1:?usage: schema-diff.sh <from-ref> [<to-ref>]}
TO=${2:-}
ROOT=$(git rev-parse --show-toplevel)
WORK=$(mktemp -d)
trap 'git -C "$ROOT" worktree remove --force "$WORK/from" >/dev/null 2>&1 || true; [ -n "$TO" ] && git -C "$ROOT" worktree remove --force "$WORK/to" >/dev/null 2>&1 || true; rm -rf "$WORK"' EXIT

generate() { # <checkout> <name>
	local dir=$1
	# drizzle-kit prefixes --out with "./", so it must be relative to the checkout.
	(cd "$dir" && bunx drizzle-kit generate --dialect postgresql --schema ./src/lib/server/db/schema \
		--out "$(realpath --relative-to="$dir" "$WORK/out")" --name "$2" >/dev/null)
}

git -C "$ROOT" worktree add --quiet --detach "$WORK/from" "$FROM"
ln -s "$ROOT/node_modules" "$WORK/from/node_modules"
generate "$WORK/from" baseline

if [ -n "$TO" ]; then
	git -C "$ROOT" worktree add --quiet --detach "$WORK/to" "$TO"
	ln -s "$ROOT/node_modules" "$WORK/to/node_modules"
	generate "$WORK/to" change
else
	generate "$ROOT" change
fi

change=$(ls "$WORK/out"/0001_*.sql 2>/dev/null || true)
if [ -z "$change" ]; then
	echo "-- No schema change between $FROM and ${TO:-the working tree}."
	exit 0
fi
sed 's/--> statement-breakpoint//' "$change"
