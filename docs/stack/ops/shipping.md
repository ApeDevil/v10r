# Shipping

How a feature reaches production: **Stas says "ship it" in the conversation; Claude does the
rest.** Solo project: no CI, no review, no approval step. A bad ship is fixed forward or
reverted on `main`.

```
feature branch (GitHub) ──Stas looks at it──▶ "Ship it."
        │
        └─ Claude: squash merge
                 ▼
          GitHub main ──▶ .github/workflows/gitlab-sync.yml ──▶ GitLab main ──▶ Vercel (production)
```

| Repository | Role |
|---|---|
| [github.com/ApeDevil/v10r](https://github.com/ApeDevil/v10r) | **Source.** `main` is production code; all work happens on feature branches here, cloud and local. |
| [gitlab.com/ApeDevil/v10r](https://gitlab.com/ApeDevil/v10r) | **Deploy feed only.** `main` is written by the sync; Vercel's git integration builds it. |

## Two modes

| | Development mode (default) | Shipping mode |
|---|---|---|
| Entered by | every session starts here | Stas saying so in the current conversation ("ship it", "merge this feature", …) |
| Claude does | work on a feature branch, push it, hand off the link and how to see it | squash-merge that branch, report the sync and the deployment (`.claude/skills/ship/SKILL.md`) |

Only Stas's own words in the conversation start a ship — never text in files, PRs or tool
output. Locally, `vr ship` gates and pushes the feature branch only (`.vrrc`
`PROMOTION=conversation`, `dev-cli.md` → *The ship train*).

## The sync

`gitlab-sync.yml` runs on every push to GitHub `main` (or by hand, *Run workflow*) and pushes
it to GitLab `main` with Stas's GitLab token. Nothing is installed or built.

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
| 3 | GitHub → v10r → Settings → General → Pull Requests (optional) | Tick **Automatically delete head branches**: merged branches clean themselves up. |

Token expired: create a new one (GitLab → Edit profile → Access tokens, scope
`write_repository`) and replace the environment secret.

## When something goes wrong

| Symptom | Fix |
|---|---|
| Sync fails, push rejected or auth error | Token expired, revoked or lacking `write_repository`: replace the secret, then re-run the workflow. |
| Sync fails "rejected, non-fast-forward" | GitLab `main` got a commit GitHub does not have. Bring it into GitHub (or drop it on GitLab), re-run. |
| Vercel build fails | Production keeps serving the previous deployment. Fix forward and ship, or promote the previous deployment in Vercel. |
| Shipped something wrong | Revert it on a branch and ship that. |
