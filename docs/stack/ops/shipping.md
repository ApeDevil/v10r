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
it to GitLab `main` with a GitLab token. Nothing is installed or built.

Why a GitHub Action and not a mirror setting: GitLab's pull mirror (GitLab fetches from GitHub)
is Premium-only, and its free push mirror runs the wrong direction.

## One-time configuration

| # | Where | Do |
|---|---|---|
| 1 | GitLab → avatar → Edit profile → Access tokens → Add new token | Name `v10r-sync`, scope **`write_repository`**, expiry up to a year. Copy the value. |
| 2 | GitHub → v10r → Settings → Secrets and variables → Actions → New repository secret | Name `GITLAB_TOKEN`, value = the token |
| 3 | GitLab → v10r → Settings → Repository → Mirroring repositories | Delete the push mirror to GitHub (it runs the old direction and would fight the sync). Then revoke the GitHub token it used. |
| 4 | GitHub → v10r → Settings → General → Pull Requests (optional) | Tick **Automatically delete head branches** — merged branches clean themselves up |

Leftovers from the retired Pattern Incubator, safe to delete: GitHub environment
`gitlab-promotion` with its secret, the GitLab token behind it, GitLab branch `dev`.

## When something goes wrong

| Symptom | Fix |
|---|---|
| Sync fails, push rejected or auth error | Token expired or missing — redo steps 1–2, then re-run the workflow. |
| Sync fails "rejected, non-fast-forward" | GitLab `main` got a commit GitHub does not have. Bring it into GitHub (or drop it on GitLab), re-run. |
| Vercel build fails | Production keeps serving the previous deployment. Fix forward and ship, or promote the previous deployment in Vercel. |
| Shipped something wrong | Revert it on a branch and ship that. |
