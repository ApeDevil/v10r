# Dev CLI (`vr`)

A small, host-clean toolkit for solo-dev ergonomics. `vr` is a **thin bash dispatcher**
(`bin/vr`) that routes to scripts in `scripts/`. No host runtime required — git runs on
the host, everything else (the test gate) runs in a container.

`vr` acts on **the git repo you're standing in**, not on wherever it's installed. Install
it once from v10r; it then works in any repo — `cd` somewhere else and `vr` targets *that*
repo's container and git remote.

## Install

`bin/vr` is versioned in this repo and works immediately as `bin/vr <cmd>` from the repo
root. To call it as plain `vr` from anywhere, symlink it onto your PATH (one time):

```bash
bin/vr install          # symlinks bin/vr → ~/.local/bin/vr
# or by hand: ln -s "$PWD/bin/vr" ~/.local/bin/vr
```

The symlink points *into* this repo, so the toolkit stays versioned; remove it any time
with `rm ~/.local/bin/vr`.

**Two roots, kept separate.** `vr` resolves its own location via `readlink -f` (surviving
the symlink) purely to find its sibling scripts — that's `TOOLKIT_DIR`, pinned to the
install. The repo it *acts on* is resolved separately and lazily from your cwd
(`git rev-parse --show-toplevel`). So the toolkit lives in v10r but operates on whichever
repo you're in.

## Commands

| Command | Does |
|---------|------|
| `vr ship` / `vr s` | Gate + promote the current branch toward `main` (see below) |
| `vr validate` / `vr v` | Run the full gate (`bun run validate`) in the repo's container |
| `vr dev` | Start the dev server (`podman compose up`, foreground) |
| `vr up` / `vr down` | Start / stop the repo's container |
| `vr shell` / `vr sh` | Shell into the running container |
| `vr install` | Symlink `vr` into `~/.local/bin` |

Every repo-touching command resolves the current repo first; run outside a git repo and
`vr` stops with *"Not inside a git repository — cd into one first."*

## Per-repo config

The git/ship workflow is universal, but container and branch names aren't. `vr` resolves
them in this order (**later wins**):

1. **Built-in defaults** — tuned for a v10r-style repo: remote `origin`, branches
   `dev`/`main`, compose service `app`, container `v10r`.
2. **`.vrrc`** — an optional file committed at a repo's root, loaded when `vr` enters that
   repo. Sourced *as you*, so only keep one in repos you trust. Set what differs:
   ```bash
   CONTAINER_NAME=foo-app
   DEV_BRANCH=develop
   ```
3. **`V10R_*` env vars** — override per-invocation: `V10R_CONTAINER`, `V10R_DEV_BRANCH`,
   `V10R_MAIN_BRANCH`, `V10R_REMOTE`, `V10R_COMPOSE_SERVICE`.

velociraptor needs no `.vrrc` — its container (`v10r`), service (`app`), and branches
(`dev`/`main`) *are* the defaults.

## The ship train

`vr ship` is **branch-aware** — it does the right thing from where you stand:

| On… | Action |
|-----|--------|
| a feature branch | squash into `dev` → **gate** → fast-forward `main` → push both → delete the branch |
| `dev` | **gate** `dev` → fast-forward `main` → push both (no squash) |
| `main` | refused |

The gate runs `bun run validate` against the **merged** state, not the feature branch
alone — so `main` is always provably equal to a tested commit. Pushing `main` is what
triggers the Vercel production deploy (`dev` triggers a preview).

Because the target repo is your cwd, `vr s` from inside repo *foo* gates and promotes
*foo's* `dev → main`. There's no v10r safety rail — the directory you're in decides what
ships, so be deliberate about it.

**Safety:** requires a clean tree, rolls the local merge back if the gate fails, pushes
`dev` + `main` atomically, and asks before the (irreversible) push.

**Flags:** `--dry-run` (merge + gate, then roll back and push nothing) · `--keep` (don't
delete the feature branch) · `--yes` (skip the confirm) · a positional arg overrides the
squash commit message.

## The gate

`vr validate` — and the gate inside `vr ship` — runs `bun run validate` **inside the
repo's container**, never on the host:

- container **up** → `podman exec` into it (left running; it's yours)
- container **down** → an ephemeral one-shot via `podman compose run --rm` (auto-removed)

It needs a `compose.yaml` at the repo root; without one `vr` stops, because the gate is
container-only by design.

## Why a bash dispatcher (not `just` / `make` / aliases)

Zero host dependencies beyond bash (matches the container-first rule), namespaced and
self-documenting (`vr` with no args lists everything), and versioned in the repo. Grow it
by adding a `case` branch in `bin/vr` plus a script in `scripts/`.
</content>
</invoke>
