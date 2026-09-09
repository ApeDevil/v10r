#!/usr/bin/env bash
#
# ship.sh — gate + promote the current branch toward main. The push is the deploy,
# unless the repo's .vrrc sets DEPLOY_MODE=prebuilt — then `--deploy` (vr sl) builds
# in the container after the gate and uploads the Build Output after the push.
#
# Branch-aware (decides what to do from where you stand):
#   feature branch  →  squash into dev, validate, fast-forward main, push, delete branch (local + remote)
#   dev             →  validate dev, fast-forward main, push (no squash)
#   main            →  refused
#
# The gate (`bun run validate`) runs inside the v10r container against the *merged*
# state, so main is always provably equal to a tested commit. Nothing is pushed
# unless the gate passes; on failure the local merge is rolled back.
#
set -euo pipefail
source "$(dirname "$(readlink -f "$0")")/lib.sh"
require_repo

DRY_RUN=0; KEEP_BRANCH=0; ASSUME_YES=0; DEPLOY_LOCAL=0; MSG=""

usage() {
	cat <<'EOF'
vr ship — gate + promote the current branch toward main (the push is the deploy).
vr sl   — the same train with --deploy: build in the container after the gate and
          upload the Build Output after the push (repos with DEPLOY_MODE=prebuilt).

Branch-aware:
  feature branch   squash into dev, validate, fast-forward main, push, delete branch (local + remote)
  dev              validate dev, fast-forward main, push (no squash)
  main             refused

Flags:
  -n, --dry-run    merge + gate, then roll back and push nothing
      --keep       keep the feature branch (local + remote) after a successful ship
  -y, --yes        skip the pre-push confirmation
      --deploy     prebuilt deploy (what `vr sl` passes); needs .vrrc DEPLOY_MODE=prebuilt + VERCEL_TOKEN
  [message]        squash commit message (default: the feature branch name)
EOF
}

while [ $# -gt 0 ]; do
	case "$1" in
		-n|--dry-run) DRY_RUN=1 ;;
		--keep)       KEEP_BRANCH=1 ;;
		-y|--yes)     ASSUME_YES=1 ;;
		--deploy)     DEPLOY_LOCAL=1 ;;
		-h|--help)    usage; exit 0 ;;
		--)           shift; break ;;
		-*)           die "unknown flag: $1 (try -h)" ;;
		*)            MSG="$1" ;;
	esac
	shift
done

# Fail before anything moves: a missing token must not be discovered after the merge.
if [ "$DEPLOY_LOCAL" -eq 1 ]; then
	require_deploy_env
fi

confirm() {
	[ "$ASSUME_YES" -eq 1 ] && return 0
	local ans
	read -r -p "$(printf '%s?%s %s [y/N] ' "$C_YEL" "$C_RST" "$1")" ans
	case "$ans" in [yY]|[yY][eE][sS]) return 0 ;; *) return 1 ;; esac
}

gate() {
	info "Gate: bun run validate"
	run_validate
}

build_local() {
	info "Build: bun run build (prebuilt output for deploy)"
	run_build_prebuilt
}

# After the push. A failure here leaves main pushed and production untouched — say so.
deploy_local() {
	info "Deploy: bun run deploy (prebuilt → production)"
	run_deploy_prebuilt \
		|| die "$MAIN_BRANCH is pushed but production was NOT updated — retry with: vr deploy"
	ok "Deployed $(git rev-parse --short HEAD) to production."
}

# What the push means for production, for the confirm prompt and the closing line.
push_consequence() {
	if [ "$DEPLOY_LOCAL" -eq 1 ]; then
		printf '%s' "then deploy the prebuilt output to production"
	elif [ "$DEPLOY_MODE" = "prebuilt" ]; then
		printf '%s' "production will NOT change — this repo deploys via vr sl / vr deploy"
	else
		printf '%s' "Vercel will deploy"
	fi
}

after_push() {
	if [ "$DEPLOY_LOCAL" -eq 1 ]; then
		deploy_local
	elif [ "$DEPLOY_MODE" = "prebuilt" ]; then
		warn "Pushed. Production NOT deployed — run 'vr deploy' (or ship with 'vr sl')."
	else
		ok "Vercel is deploying."
	fi
}

promote_main() {
	run git checkout "$MAIN_BRANCH"
	run git pull --ff-only "$REMOTE" "$MAIN_BRANCH"
	if ! git merge --ff-only "$DEV_BRANCH"; then
		run git checkout "$DEV_BRANCH"
		die "$MAIN_BRANCH can't fast-forward to $DEV_BRANCH (history diverged). Nothing pushed; $DEV_BRANCH holds the validated commit — reconcile $MAIN_BRANCH by hand."
	fi
}

push_refs() {
	if [ "$DRY_RUN" -eq 1 ]; then
		warn "[dry-run] would push: git push --atomic $REMOTE $DEV_BRANCH $MAIN_BRANCH ($(push_consequence))"
		return 0
	fi
	confirm "Push $DEV_BRANCH + $MAIN_BRANCH to $REMOTE? ($(push_consequence))" || {
		run git checkout "$DEV_BRANCH"
		die "Aborted before push. Local merge stands; undo with: git reset --hard $REMOTE/$DEV_BRANCH"
	}
	run git push --atomic "$REMOTE" "$DEV_BRANCH" "$MAIN_BRANCH"
}

cleanup_branch() {
	local feature="$1"
	[ "$KEEP_BRANCH" -eq 1 ] && { info "Keeping branch '$feature' (--keep)."; return 0; }
	# A squash commit is not a descendant of the feature branch, so git treats the
	# branch as "unmerged" — force-delete (-D) is the correct cleanup here.
	run git branch -D "$feature"
	# Solo-dev feature branches are usually local-only, but if this one was ever
	# pushed, drop the remote copy too so it doesn't orphan. Best-effort: the ship
	# already landed, so a failed remote delete only warns.
	if git ls-remote --exit-code --heads "$REMOTE" "$feature" >/dev/null 2>&1; then
		run git push "$REMOTE" --delete "$feature" \
			|| warn "Couldn't delete '$feature' on $REMOTE — remove it by hand."
	fi
}

full_train() {
	local feature="$1"
	local msg="${MSG:-$feature}"
	info "Train: $feature → $DEV_BRANCH → $MAIN_BRANCH   (squash message: \"$msg\")"

	run git checkout "$DEV_BRANCH"
	run git pull --ff-only "$REMOTE" "$DEV_BRANCH"
	local pre_dev; pre_dev="$(git rev-parse HEAD)"

	if ! git merge --squash "$feature"; then
		run git reset --hard "$pre_dev"
		run git checkout "$feature"
		die "Squash merge conflicts with $DEV_BRANCH. Resolve on '$feature', then retry."
	fi
	if git diff --cached --quiet; then
		run git checkout "$feature"
		info "'$feature' has nothing new vs $DEV_BRANCH — nothing to ship."
		exit 0
	fi
	run git commit -m "$msg"

	if ! gate; then
		err "Gate failed."
		run git reset --hard "$pre_dev"
		run git checkout "$feature"
		die "$DEV_BRANCH rolled back to ${pre_dev:0:9}. Nothing shipped."
	fi
	ok "Gate passed on the merged state."

	if [ "$DEPLOY_LOCAL" -eq 1 ] && ! build_local; then
		err "Build failed."
		run git reset --hard "$pre_dev"
		run git checkout "$feature"
		die "$DEV_BRANCH rolled back to ${pre_dev:0:9}. Nothing shipped."
	fi

	if [ "$DRY_RUN" -eq 1 ]; then
		run git reset --hard "$pre_dev"
		run git checkout "$feature"
		ok "[dry-run] Rolled back; nothing pushed. Re-run without --dry-run to ship."
		exit 0
	fi

	promote_main
	push_refs
	cleanup_branch "$feature"
	run git checkout "$DEV_BRANCH"
	ok "Shipped '$feature' → $MAIN_BRANCH."
	after_push
}

promote_only() {
	info "Promote: $DEV_BRANCH → $MAIN_BRANCH (you're on $DEV_BRANCH)"
	run git pull --ff-only "$REMOTE" "$DEV_BRANCH"

	if ! gate; then
		die "Gate failed on $DEV_BRANCH. Nothing promoted."
	fi
	ok "Gate passed on $DEV_BRANCH."

	if [ "$DEPLOY_LOCAL" -eq 1 ] && ! build_local; then
		die "Build failed on $DEV_BRANCH. Nothing promoted."
	fi

	if [ "$DRY_RUN" -eq 1 ]; then
		ok "[dry-run] $DEV_BRANCH is green; nothing pushed. Re-run without --dry-run to promote."
		exit 0
	fi

	promote_main
	push_refs
	run git checkout "$DEV_BRANCH"
	ok "Promoted $DEV_BRANCH → $MAIN_BRANCH."
	after_push
}

# ---- preconditions ----
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "Not inside a git repository."

if ! git diff --quiet || ! git diff --cached --quiet; then
	err "Working tree has uncommitted changes to tracked files:"
	git status --short >&2
	die "Commit or stash them first."
fi

untracked="$(git ls-files --others --exclude-standard)"
if [ -n "$untracked" ]; then
	warn "Untracked files present (these will NOT be shipped):"
	printf '%s\n' "$untracked" | sed 's/^/    /'
fi

current="$(git symbolic-ref --short HEAD 2>/dev/null)" || die "Detached HEAD — checkout a branch first."

info "Fetching $REMOTE…"
run git fetch --quiet "$REMOTE"

case "$current" in
	"$MAIN_BRANCH") die "You're on $MAIN_BRANCH. Switch to a feature branch or $DEV_BRANCH to ship." ;;
	"$DEV_BRANCH")  promote_only ;;
	*)              full_train "$current" ;;
esac
