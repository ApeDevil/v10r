#!/usr/bin/env bash
#
# deploy.sh — build in the repo's container and upload the Build Output for the
# commit that is already on main (DEPLOY_MODE=prebuilt repos). Standalone twin of
# the deploy leg inside `vr sl`: the retry path when an upload fails after a push,
# and the way to redeploy main without a new commit.
#
# Production must equal a pushed main commit, so HEAD has to match origin/main.
# Nothing here switches branches or starts the project; the build and the upload
# are two one-shot container runs.
#
set -euo pipefail
source "$(dirname "$(readlink -f "$0")")/lib.sh"
require_deploy_env

DRY_RUN=0; ASSUME_YES=0

usage() {
	cat <<'EOF'
vr deploy — build in the container and upload the prebuilt output for the pushed main HEAD.

Requires: .vrrc with DEPLOY_MODE=prebuilt + VERCEL_ORG_ID + VERCEL_PROJECT_ID,
          VERCEL_TOKEN in the launching shell, a clean tree, HEAD == origin/main.

Flags:
  -n, --dry-run    build only; upload nothing
  -y, --yes        skip the pre-upload confirmation
EOF
}

while [ $# -gt 0 ]; do
	case "$1" in
		-n|--dry-run) DRY_RUN=1 ;;
		-y|--yes)     ASSUME_YES=1 ;;
		-h|--help)    usage; exit 0 ;;
		*)            die "unknown flag: $1 (try -h)" ;;
	esac
	shift
done

confirm() {
	[ "$ASSUME_YES" -eq 1 ] && return 0
	local ans
	read -r -p "$(printf '%s?%s %s [y/N] ' "$C_YEL" "$C_RST" "$1")" ans
	case "$ans" in [yY]|[yY][eE][sS]) return 0 ;; *) return 1 ;; esac
}

# ---- preconditions ----
if ! git diff --quiet || ! git diff --cached --quiet; then
	err "Working tree has uncommitted changes to tracked files:"
	git status --short >&2
	die "Commit or stash them first — production must equal a commit."
fi

info "Fetching $REMOTE…"
run git fetch --quiet "$REMOTE"
head_sha="$(git rev-parse HEAD)"
main_sha="$(git rev-parse "$REMOTE/$MAIN_BRANCH")"
[ "$head_sha" = "$main_sha" ] \
	|| die "HEAD (${head_sha:0:9}) is not $REMOTE/$MAIN_BRANCH (${main_sha:0:9}) — ship first (vr sl), or check out $MAIN_BRANCH."

if project_running; then
	warn "Dev container is running — the build rewrites .svelte-kit and .vercel/output on the shared mount."
fi

info "Build: bun run build (prebuilt output for deploy)"
run_build_prebuilt
ok "Built ${head_sha:0:9}."

if [ "$DRY_RUN" -eq 1 ]; then
	ok "[dry-run] Build output is in place; nothing uploaded."
	exit 0
fi

confirm "Deploy ${head_sha:0:9} to production?" || die "Aborted before upload. Nothing changed."

info "Deploy: bun run deploy (prebuilt → production)"
run_deploy_prebuilt || die "Upload failed — production unchanged. Fix and re-run: vr deploy"
ok "Deployed ${head_sha:0:9} to production."
