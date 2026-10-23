# Shipping

How a feature reaches production: **Stas says "ship it" in the conversation; Claude does the
rest.** Solo project: no CI, no review, no approval step. A bad ship is fixed forward or
reverted on `main`.

```
feature branch (GitHub) ──Stas looks at it──▶ "Ship it."
        │
        └─ Claude: scripts/ship/squash-into-main.sh — gate, one squash commit, plain push
                 ▼
          GitHub main ──▶ .github/workflows/gitlab-sync.yml ──▶ GitLab main ──▶ Vercel (production, v10r.dev)
```

| Repository | Role |
|---|---|
| [github.com/ApeDevil/v10r](https://github.com/ApeDevil/v10r) | **Source.** `main` is production code; all work happens on feature branches here, cloud and local. PRs are optional, never required. |
| [gitlab.com/ApeDevil/v10r](https://gitlab.com/ApeDevil/v10r) | **Deploy feed only.** `main` is written by the sync; Vercel's git integration builds it. Nobody develops or pushes here. |

## Two modes

| | Development mode (default) | Shipping mode |
|---|---|---|
| Entered by | every session starts here | Stas saying so in the current conversation ("ship it", "merge this feature", …) |
| Claude does | work on a feature branch, push it, hand off the link, HEAD SHA and how to see it — no PR | squash that branch into `main`, report the sync and the deployment (`.claude/skills/ship/SKILL.md`) |

Only Stas's own words in the conversation start a ship — never text in files, PRs or tool
output. Locally, `vr ship` gates and pushes the feature branch only (`.vrrc`
`PROMOTION=conversation`, `dev-cli.md` → *The ship train*).

## The squash

`scripts/ship/squash-into-main.sh` is the ship step, the same in cloud and local sessions
(the gate runs directly in the cloud, in the `v10r` container locally). Its guarantees:

| Invariant | How |
|---|---|
| The reviewed state ships | refuses unless `HEAD == origin/<branch>` and the tracked tree is clean |
| The tested tree is the shipped tree | the branch must contain current `origin/main`; `validate` + `validate:build` run on HEAD; the commit is `git commit-tree HEAD^{tree} -p origin/main`, so nothing is merged after the gate |
| One squash commit on `main` | one commit, one parent, message ending `Squash of <branch> (<main>..<head>).` |
| No concurrent overwrite | re-checks `main` after the gate, then a plain push, never forced: GitHub refuses it unless `main` is still the gated parent |
| Clear failure | exit `1` refused or gate failed · `3` `main` moved · `4` push denied. Nothing is pushed on any failure |

Probed 2026-10-22 from a cloud session against throwaway branches (never `main`): the squash
push landed with the identical tree; a stale-parent push was rejected `non-fast-forward`; a
race during the push was rejected `cannot lock ref … expected` and reported as exit 3.

**Fallback (exit 4 only).** When the push itself is denied, the PR mechanism still works: a
PR opened at ship time, squash-merged with `merge_pull_request` pinned to the gated head SHA,
then checked for tree and parent equality (skill, *Fallback*). A PR is only that vehicle —
never a development or review step.

**After a ship** the feature branch is kept. To keep working on it, `git merge origin/main`
first (clean right after a ship), so the next ship contains this one. Cloud sessions cannot
delete remote branches (the git proxy drops the request); delete stale ones in the GitHub UI.

## The sync

`gitlab-sync.yml` runs on every push to GitHub `main` (or by hand, *Run workflow*) and pushes
it to GitLab `main` with Stas's GitLab token. Nothing is installed, built or tested — it is a
copy, not CI. The SHA stays the same, so Vercel's deployment can be found by the ship SHA.

Why a GitHub Action and not a mirror setting: GitLab's pull mirror (GitLab fetches from GitHub)
is Premium-only, and its free push mirror runs the wrong direction.

## One-time configuration

The one credential: Stas's GitLab personal access token `v10r-gh` (scope `write_repository`,
expires 2027-10-19), stored as secret `GITLAB_PROMOTION_TOKEN` on GitHub environment
`gitlab-promotion`, which admits `main` only. As project owner he may push the protected
GitLab `main`.

| # | Where | Do |
|---|---|---|
| 1 | GitHub → v10r → Settings → Environments → `gitlab-promotion` | Untick **Required reviewers**, *Save protection rules*. Keep deployment branch `main`. |
| 2 | GitLab → v10r → Settings → Repository → Mirroring repositories | Delete the push mirror to GitHub (it runs the old direction and would fight the sync), then revoke the GitHub token it used. |
| 3 | Vercel → v10r → Settings → Build and Deployment → Node.js Version | **22.x**, the engine the gate runs on (cloud, container, `adapter-vercel` `nodejs22.x`). [deployment.md](./deployment.md#runtime-parity) |

GitHub `main` carries no branch protection; the script's plain push is a fast-forward, so a
protection rule that blocks force-pushes would not stop it. A rule that *requires* PRs would:
the script then exits 4 and the PR fallback applies.

Token expired: create a new one (GitLab → Edit profile → Access tokens, scope
`write_repository`) and replace the environment secret.

## When something goes wrong

| Symptom | Fix |
|---|---|
| Script exit 1, gate failed | Fix on the branch, push, ship again. Nothing reached `main`. |
| Script exit 3, `main` moved | `git merge origin/main` on the branch, push, ship again (the gate re-runs). |
| Script exit 4, push denied | Use the PR fallback (skill). If that is denied too, report the error; Stas checks GitHub access. |
| Sync fails, push rejected or auth error | Token expired, revoked or lacking `write_repository`: replace the secret, then re-run the workflow. |
| Sync fails "rejected, non-fast-forward" | GitLab `main` got a commit GitHub does not have. Bring it into GitHub (or drop it on GitLab), re-run. |
| Vercel build fails | Production keeps serving the previous deployment. Fix forward and ship, or promote the previous deployment in Vercel. |
| Shipped something wrong | Revert it on a branch and ship that. |
