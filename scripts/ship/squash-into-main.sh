#!/usr/bin/env bash
#
# squash-into-main.sh — the ship step without a pull request: put the current feature
# branch onto GitHub `main` as one squash commit (docs/stack/ops/shipping.md). Claude runs
# it after Stas says "ship it" (.claude/skills/ship/SKILL.md); nothing else may.
#
# What lands on `main` is exactly what the gate tested. The commit is built with
# `git commit-tree` from the feature HEAD's own tree onto the `main` it was gated against,
# so no merge happens after the gate, and the plain (never forced) push is refused by
# GitHub if `main` moved meanwhile. One commit, no history rewrite, nothing pushed on any
# failure. GitHub's push to `main` then drives the GitLab sync and the Vercel deployment.
#
# Exit codes, so the caller can choose a recovery:
#   0  shipped (or --dry-run complete)    3  main moved — bring it in, re-gate, retry
#   1  refused or gate failed             4  push denied (permission/proxy) — report it
#
set -euo pipefail
source "$(dirname "$(readlink -f "$0")")/../vr/lib.sh"
require_repo

# The one repository a ship may write to. Read from git config, not `git remote get-url`,
# so a url.insteadOf rewrite (the sandbox test) cannot change what is being checked.
AUTHORITY_URL_RE='^(https://github\.com/|git@github\.com:)ApeDevil/v10r(\.git)?$'

DRY_RUN=0; GATE=1; ONTO="$MAIN_BRANCH"; MSG_FILE=""; BRANCH_ARG=""

usage() {
	cat <<'EOF'
squash-into-main.sh — ship the current feature branch onto GitHub main as one squash commit.

  squash-into-main.sh [branch] [--message-file F] [--dry-run]

  branch            optional; must equal the checked-out branch (a guard against shipping
                    the wrong one)
  --message-file F  commit message (subject, blank line, body); default subject = branch name
  --dry-run         every check and the gate, then print the commit that would land; no push
  --onto B --no-gate
                    probe only: target branch B instead of main, without the gate. The gate
                    can never be skipped toward main.
EOF
}

while [ $# -gt 0 ]; do
	case "$1" in
		--message-file) MSG_FILE="${2:?--message-file needs a path}"; shift ;;
		--dry-run)      DRY_RUN=1 ;;
		--onto)         ONTO="${2:?--onto needs a branch}"; shift ;;
		--no-gate)      GATE=0 ;;
		-h|--help)      usage; exit 0 ;;
		-*)             die "unknown flag: $1 (try -h)" ;;
		*)              BRANCH_ARG="$1" ;;
	esac
	shift
done

[ "$GATE" -eq 1 ] || [ "$ONTO" != "$MAIN_BRANCH" ] \
	|| die "--no-gate is for probes onto another branch; $MAIN_BRANCH only takes a gated tree."
[ -z "$MSG_FILE" ] || [ -f "$MSG_FILE" ] || die "No message file at $MSG_FILE."

# ---- 1. where we stand ----
url="$(git config --get "remote.$REMOTE.url" || true)"
[[ "$url" =~ $AUTHORITY_URL_RE ]] || die "$REMOTE is '$url'. A ship writes to GitHub ApeDevil/v10r only."

branch="$(git symbolic-ref --short HEAD 2>/dev/null)" || die "Detached HEAD — check out the feature branch."
[ -z "$BRANCH_ARG" ] || [ "$BRANCH_ARG" = "$branch" ] \
	|| die "Asked to ship '$BRANCH_ARG' but '$branch' is checked out."
[ "$branch" != "$MAIN_BRANCH" ] && [ "$branch" != "$ONTO" ] \
	|| die "You're on $branch. Ship from the feature branch."
git diff --quiet && git diff --cached --quiet \
	|| die "Tracked files have uncommitted changes. The ship takes HEAD only — commit and push first."

# ---- 2. the branch is what Stas saw ----
info "Fetching $REMOTE/$ONTO and $REMOTE/$branch…"
run git fetch --quiet "$REMOTE" "$ONTO" "$branch" \
	|| die "Fetch failed. Is '$branch' pushed to $REMOTE?"
head="$(git rev-parse HEAD)"
[ "$head" = "$(git rev-parse "$REMOTE/$branch")" ] \
	|| die "HEAD ${head:0:9} is not $REMOTE/$branch. Push the branch (or pull it) so the shipped state is the reviewed one."

# ---- 3. the branch contains the target, and adds something ----
base="$(git rev-parse "$REMOTE/$ONTO")"
git merge-base --is-ancestor "$base" "$head" \
	|| die "'$branch' does not contain $REMOTE/$ONTO (${base:0:9}). Merge it in (git merge $REMOTE/$ONTO), push, then ship."
tree="$(git rev-parse "$head^{tree}")"
[ "$tree" != "$(git rev-parse "$base^{tree}")" ] \
	|| die "'$branch' changes nothing against $REMOTE/$ONTO — nothing to ship."

# ---- 4. the gate, on exactly this tree ----
# Cloud sessions have no container: the gate runs here, as every cloud command does.
# Locally it runs in the v10r container through lib.sh's container_run.
gate() {
	if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ]; then
		run bun run validate || return 1
		run bun run validate:build || return 1
	else
		run_validate || return 1
		run_validate_build || return 1
	fi
}
if [ "$GATE" -eq 1 ]; then
	info "Gate on '$branch' at ${head:0:9}: bun run validate, then bun run validate:build"
	gate || die "Gate failed. Nothing shipped."
	ok "Gate passed."
	[ "$(git rev-parse HEAD)" = "$head" ] && git diff --quiet && git diff --cached --quiet \
		|| die "The gate changed tracked files or HEAD — the tested tree is not the committed one. Nothing shipped."
else
	warn "--no-gate: probe onto '$ONTO', untested by design."
fi

# ---- 5. one commit: the gated tree on the gated base ----
msg="$(mktemp)"
trap 'rm -f "$msg"' EXIT
if [ -n "$MSG_FILE" ]; then cat "$MSG_FILE" >"$msg"; else printf '%s\n' "$branch" >"$msg"; fi
printf '\nSquash of %s (%s..%s).\n' "$branch" "${base:0:9}" "${head:0:9}" >>"$msg"
commit="$(git commit-tree "$tree" -p "$base" -F "$msg")"
info "Squash commit ${commit:0:9}: tree ${tree:0:9} (= ${head:0:9}), parent ${base:0:9}"

# ---- 6. the target did not move while the gate ran ----
run git fetch --quiet "$REMOTE" "$ONTO"
[ "$(git rev-parse "$REMOTE/$ONTO")" = "$base" ] \
	|| { err "$REMOTE/$ONTO moved during the gate (was ${base:0:9}). Nothing shipped."; exit 3; }

if [ "$DRY_RUN" -eq 1 ]; then
	ok "[dry-run] Would push ${commit:0:9} to $REMOTE/$ONTO. Nothing pushed."
	echo "SHIP_COMMIT=$commit"
	exit 0
fi

# ---- 7. a plain push: GitHub refuses it unless $ONTO is still $base ----
# A failure is classified by what the remote now holds, not by the error text: a race shows
# up as "non-fast-forward", "fetch first" or "failed to update ref" depending on timing.
if ! run git push "$REMOTE" "$commit:refs/heads/$ONTO"; then
	now="$(git ls-remote "$REMOTE" "refs/heads/$ONTO" | cut -f1)"
	if [ -n "$now" ] && [ "$now" != "$base" ]; then
		err "$REMOTE/$ONTO moved to ${now:0:9} before the push landed. Nothing shipped."
		exit 3
	fi
	err "Push to $REMOTE/$ONTO was denied ($REMOTE/$ONTO still ${base:0:9}). Nothing shipped."
	exit 4
fi

# ---- 8. confirm what GitHub now holds ----
landed="$(git ls-remote "$REMOTE" "refs/heads/$ONTO" | cut -f1)"
[ "$landed" = "$commit" ] \
	|| die "Pushed ${commit:0:9}, but $REMOTE/$ONTO reads ${landed:0:9}. Check by hand."
ok "Shipped '$branch' → $REMOTE/$ONTO as ${commit:0:9}."
echo "SHIP_COMMIT=$commit"
