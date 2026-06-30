# Dev CLI (`vr`)

A small, host-clean toolkit for solo-dev ergonomics. `vr` is a **thin bash dispatcher**
(`bin/vr`) that routes to scripts in `scripts/`. No host runtime required — git runs on
the host, everything else (the test gate) runs in the `v10r` container.

## Install

`bin/vr` is versioned in the repo and works immediately as `bin/vr <cmd>` from the repo
root. To call it as plain `vr` from anywhere, symlink it onto your PATH (one time):

```bash
ln -s "$PWD/bin/vr" ~/.local/bin/vr   # or: bin/vr install
```

The symlink points *into* the repo, so the script stays versioned; remove it any time with
`rm ~/.local/bin/vr`. `vr` self-locates the repo via `readlink -f`, so it works from any
directory.

## Commands

| Command | Does |
|---------|------|
| `vr ship` / `vr s` | Gate + promote the current branch toward `main` (see below) |
| `vr validate` / `vr v` | Run the full gate (`bun run validate`) in the container |
| `vr dev` | Start the dev server (`podman compose up`, foreground) |
| `vr up` / `vr down` | Start / stop the `v10r` container |
| `vr shell` / `vr sh` | Shell into the running container |
| `vr install` | Symlink `vr` into `~/.local/bin` |

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

**Safety:** requires a clean tree, rolls the local merge back if the gate fails, pushes
`dev` + `main` atomically, and asks before the (irreversible) push.

**Flags:** `--dry-run` (merge + gate, then roll back and push nothing) · `--keep` (don't
delete the feature branch) · `--yes` (skip the confirm) · a positional arg overrides the
squash commit message.

## Why a bash dispatcher (not `just` / `make` / aliases)

Zero host dependencies beyond bash (matches the container-first rule), namespaced and
self-documenting (`vr` with no args lists everything), and versioned in the repo. Grow it
by adding a `case` branch in `bin/vr` plus a script in `scripts/`.
