# Development Environment

Two environments share one authority, GitHub `ApeDevil/v10r`: every change is a feature branch
pushed there, and `main` moves only by a ship ([shipping.md](../stack/ops/shipping.md)).
Neither environment reaches the other — a cloud session never assumes Stas's machine exists.

| | Cloud session (Claude Code on the web) — **default** | Local session (Ubuntu workstation) — secondary |
|---|---|---|
| Used for | most feature work, and all validation that needs no credential or database | local-only work: the real database, real credentials, the dev server against Neon, `refresh` |
| Detected by | `CLAUDE_CODE_REMOTE=true` | anything else |
| Runs in | an isolated VM — no container, no Podman | the `v10r` Podman container (the rest of this page) |
| Setup | automatic: SessionStart hook → `scripts/cloud/session-start.sh` (pinned Bun, frozen install, `.env` from `.env.placeholder`, `compose.yaml`'s heap cap appended to `NODE_OPTIONS`) | `podman compose up -d` |
| Commands | `bun run …` directly | `podman exec v10r bun run …`; git on the host |
| Secrets | none — fake values only | the real `.env` |
| Node / Bun | Node 22 from the cloud image (not pinned by the repo), Bun pinned by `packageManager` | Node 22 (`Containerfile.dev`), Bun from the image tag |

The cloud environment needs only the Trusted network defaults (the npm registry). Paraglide's
inlang plugins are devDependencies loaded from `node_modules`, not fetched from a CDN
([i18n.md](../blueprint/i18n.md#project-configuration)).

## What runs where

A check that could not run is reported as **not run**, never as passed.

| Command | Cloud | Local |
|---|---|---|
| `validate` (the gate), `validate:build`, `test`, `test:mcp`, `check`, `lint`, `knip` | yes | yes |
| `patterns:build`, `mcp:excerpts:build`, `content:check` (offline) | yes | yes |
| `test:browser` (Playwright; starts `bun run dev`) | unverified — Chromium is preinstalled, but the dev server runs on the fake `.env`, so database-backed routes fail | yes |
| ship (`scripts/ship/squash-into-main.sh`) — only on Stas's word | yes | yes (gate in the container) |
| `db:push`, `db:seed`, `db:setup`, `db:*` | no — no database | yes |
| `refresh` (its last step, `db:ingest-docs`, needs the database and the Gemini key) | build steps only | yes |
| `content:check:db`, `content:push`, the dev server against Neon, anything with a real credential | no | yes |
| `vr …` (Stas's host dispatcher) | no | only when Stas names the command |

## The local container

The local environment runs entirely in a Podman container. The host only needs Podman — all
other tools (Bun, Node 22, dependencies, build tools) live inside the container. Which engine
runs what: `docs/stack/core/bun.md`.

```
Host Machine          Container (v10r)
┌─────────────┐      ┌──────────────────────┐
│  Podman     │ ───► │  Bun + Node 22       │
│  (only)     │      │  node_modules        │
│             │      │  Build tools         │
└─────────────┘      └──────────────────────┘
```

The sections below describe the local container.

## Adding Dependencies

Never run `bun add` on the host. The workflow is:

1. **Add inside the container** — `podman exec v10r bun add <pkg>` (or `bun add -D`). This updates `package.json` *and* `bun.lock` on the bind mount and installs into the volume in one step.
2. **Restart the container** — `podman compose restart`. Startup runs `bun install --frozen-lockfile`, so a passing restart proves manifest and lockfile agree.

Editing `package.json` by hand without regenerating `bun.lock` fails that frozen-lockfile startup guard — the fix is reconciling the lockfile in the container, never dropping the flag.

### Why No Manual Installation?

| Benefit | Explanation |
|---------|-------------|
| **Reproducibility** | `package.json` is the single source of truth |
| **No host pollution** | `node_modules` stays in a named volume |
| **Consistent environments** | Everyone gets the same setup |
| **No version conflicts** | Host Node/Bun version doesn't matter |

## Container Commands

| Action | Command |
|--------|---------|
| Start | `podman compose up -d` |
| Stop | `podman compose down` |
| Restart | `podman compose restart app` |
| Logs | `podman compose logs -f app` |
| Shell into container | `podman exec -it v10r sh` |
| Rebuild image | `podman compose build --no-cache` |
| Measure cold-start times | `bun run perf:cold-start` |

## Ports

| Port | Purpose |
|------|---------|
| **5173** | Vite dev server (HMR multiplexed) |

## Volume Mounts

Project files are bind-mounted at `/app` for hot reload. `node_modules` uses a named volume, which means:
- Dependencies don't sync back to host
- Faster I/O (no filesystem translation)
- No conflicts with host's Node version

## Cold-start expectations

First `podman compose up` on a fresh container takes ~30-40 s to reach `ready in Xms` in the Vite logs. This is the established baseline, not a regression.

| Cost | Approx. share |
|------|--------------|
| `optimizeDeps` esbuild prebundle (991 packages, polling FS) | ~50% |
| UnoCSS source scan | ~15% |
| SvelteKit plugin init + route discovery | ~15% |
| Paraglide compile (1485 keys × 3 locales) | ~10% |
| Other plugin chain (Three.js noExternal, etc.) | ~10% |

After `ready`, HMR is fast. Subsequent restarts on the same container are similar — the cost is per-process, not cached.

### Measuring

```bash
bun run perf:cold-start
```

Drives `podman compose down && up`, parses Vite logs, and reports `install_ms`, `vite_ready_ms`, `first_ssr_ttfb_ms`, `ssr_reload_count`. The 15 s warn / 25 s fail thresholds in `budgets.json` are **targets** the current stack does not meet — the measured baseline is ~36 s, so a run "failing" the target is the expected, honest state until Vite 8 / Rolldown lands. The probe is a manual trend check, not part of `validate`.

## Running Commands Inside Container

Use `podman exec -it v10r <command>` for one-off commands (e.g., `bun run check`, `bun run build`), or open a shell with `podman exec -it v10r sh`.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Dependencies not updating | `podman compose down` then `podman compose up -d` |
| Need a fresh start | `podman compose down -v` (removes volumes) then `podman compose up -d` |
| Container won't start | Check logs with `podman compose logs app` |
