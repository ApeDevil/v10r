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
| `vr validate` / `vr v` | Run the full gate (`bun run validate`) in the repo's container; `--build` adds `bun run validate:build` |
| `vr refresh` / `vr ref` | Refresh derived pattern-library surfaces (`bun run refresh`) in the container |
| `vr dev` | Start the dev server (`podman compose up`, foreground) |
| `vr up` / `vr u` | Start the repo's container (background) |
| `vr down` / `vr d` | Stop the repo's container |
| `vr shell` / `vr sh` | Shell into the running container |
| `vr install` | Symlink `vr` into `~/.local/bin` |

Every repo-touching command resolves the current repo first; run outside a git repo and
`vr` stops with *"Not inside a git repository — cd into one first."*

## Per-repo config

`vr` reads what it can from the repo itself, so most repos need **no config at all**:

- **Container & service** — taken from the repo's `compose.yaml`. `vr` derives the service
  via `podman compose config --services` (preferring `app`) and finds the running
  container through the compose project, so it never needs the container's *name*. A repo
  whose service is `app` (the v10r/densho shape) needs nothing.
- **Git facts** — remote and branch names aren't in `compose.yaml`, so those fall back to
  defaults: remote `origin`, branches `dev`/`main`.

Override the git facts (and, rarely, a non-`app` service) only when they differ, via
(**later wins**):

1. **`.vrrc`** — an optional file committed at a repo's root, loaded when `vr` enters it.
   Sourced *as you*, so only keep one in repos you trust:
   ```bash
   DEV_BRANCH=develop      # a repo that ships from `develop`
   COMPOSE_SERVICE=web     # only if the service isn't `app`
   ```
2. **`V10R_*` env vars** — per-invocation: `V10R_REMOTE`, `V10R_DEV_BRANCH`,
   `V10R_MAIN_BRANCH`, `V10R_COMPOSE_SERVICE`.

Both velociraptor and densho need no `.vrrc` — same `app` service, same `dev`/`main`, same
`origin`.

## The ship train

`vr ship` is **branch-aware** — it does the right thing from where you stand:

| On… | Action |
|-----|--------|
| a feature branch | squash into `dev` → **gate** → fast-forward `main` → push both → delete the branch (local + remote) |
| `dev` | **gate** `dev` → fast-forward `main` → push both (no squash) |
| `main` | refused |

The gate runs `bun run validate` against the **merged** state, not the feature branch
alone — so `main` is always provably equal to a tested commit. Pushing `main` is what
triggers the Vercel production deploy (`dev` triggers a preview).

Because the target repo is your cwd, `vr s` from inside repo *foo* gates and promotes
*foo's* `dev → main`. There's no v10r safety rail — the directory you're in decides what
ships, so be deliberate about it.

**Linear `main` required.** Promotion is **fast-forward only** — `main` must never carry
commits `dev` lacks. If they've diverged, `vr ship` refuses at the promote step (nothing
pushed; `dev` still holds the gated commit) and tells you to reconcile `main` by hand. In
practice: **never commit directly to `main`** — let `vr ship` move it, and it stays
ff-able. Because the pushes are fast-forwards, not force-pushes, this also works against a
**protected `main`** (which typically blocks history rewrites but allows ff pushes).

**Safety:** requires a clean tree, rolls the local merge back if the gate fails, pushes
`dev` + `main` atomically, and asks before the (irreversible) push.

**Flags:** `--dry-run` (merge + gate, then roll back and push nothing) · `--keep` (don't
delete the feature branch, local **or** remote) · `--yes` (skip the confirm) · a positional
arg overrides the squash commit message.

## The gate

`vr validate` — and the gate inside `vr ship` — runs `bun run validate` **inside the
repo's container**, never on the host. It drives the compose project rather than a
hard-coded container name:

- a **running** container → `podman compose exec` into the service (reuses your warm
  container)
- **anything else** → an ephemeral `podman compose run --rm` one-shot (auto-removed)

"Anything else" covers *stopped* as well as *removed*, and the distinction is load-bearing:
`compose ps -q` lists a project's containers in **any** state, so a stopped container is
still listed. Testing only that the list is non-empty reports "up" for a project that
exited, and the `exec` then fails with `container state improper`. `container_run` (in
`scripts/lib.sh` — the one in-container runner the gate and the refresh chain both ride)
therefore asks podman for each id's actual state (`project_running`) rather than
filtering at the compose layer — podman-compose rejects a service argument to `ps -q`.

The one-shot deliberately does **not** start the project first. It needs no cleanup, so no
early-exit path can leave a container behind — and every ship path exits early somewhere
(gate failure rollback, aborting at the push confirmation, `--dry-run`). It also can't stop
a container you were already using: `vr ship` in one terminal never disturbs `vr dev` in
another.

It needs a `compose.yaml` at the repo root **and** a `validate` script in that project's
`package.json`; without either, `vr` stops — the gate is container-only, and `bun run
validate` is the contract every repo's gate must provide.

`vr validate --build` additionally runs `bun run validate:build`: a production build
(`NODE_ENV=production` is baked into the npm script — the compose file pins
`development`, which inflates client JS ~9%) followed by the perf-ratchet check scored
against the fresh build. The committed `src/lib/server/perf/snapshot.json` is not
rewritten, so the tree stays clean for ship. `validate` itself stays build-free and fast;
run `--build` before shipping — two past deploy failures were build-only breakages the
plain gate structurally cannot catch.

## The refresh chain

`vr refresh` (alias `ref`) re-syncs every derived surface of the pattern library after a
pattern/doc edit. It runs `bun run refresh` in the container via the same `container_run`
mechanics as the gate (warm `exec` or ephemeral one-shot); in v10r that script chains

```
mcp:validate  →  patterns:build  →  mcp:excerpts:build  →  db:ingest-docs
```

The ordering is deliberate: fail fast on the cheap registry validation, regenerate the
pattern-library surfaces (README Pattern Index region + the `docs/pattern-library/`
section pages) so the ingest sees them, build the deterministic local excerpt snapshot next,
and leave the slow, quota-bound Neon/Gemini RAG ingest last. The ingest is content-hash
idempotent — only changed docs re-embed, so casual re-runs cost a handful of embed
calls — and interruption-safe: a Ctrl-C (or the daily embed-cap running out) mid-ingest
just resumes on the next run. `--force` / `-f` sets `INGEST_FORCE=1` for a full
re-chunk after a chunking-**logic** change; that one burns real embed quota, so it
stays an explicit flag.

One refresh, two freshness horizons — and the script says which you got:

- **Neon RAG corpus** — globally fresh the moment ingest finishes (one shared DB; dev
  and prod chatbots both read it).
- **The committed artifacts** — `README.md` (generated index region),
  `docs/pattern-library/`, and `mcp/public-excerpts.snapshot.json`; the hosted MCP
  and `/showcases/mcp` only pick up registry/snapshot changes on the next `vr ship`.
  After the chain, `refresh.sh` checks their git status on the host and nudges you to
  commit if anything changed. (The gate's `patterns:check` + `mcp:excerpts:check` block
  shipping stale surfaces regardless.)

Like the gate, refresh is contract-based so `vr` stays generic: `bun run refresh` is the
contract, and each repo defines what refreshing means. A repo without the script stops
in-container with bun's `Script not found "refresh"`.

## Why a bash dispatcher (not `just` / `make` / aliases)

Zero host dependencies beyond bash (matches the container-first rule), namespaced and
self-documenting (`vr` with no args lists everything), and versioned in the repo. Grow it
by adding a `case` branch in `bin/vr` plus a script in `scripts/`. Short aliases follow the
same convention as the commands they shorten — `s`/`v`/`ref`/`sh`/`u`/`d` are just extra
patterns on the existing `case` branch, so they're versioned and appear in `vr help` for free.
</content>
</invoke>
