# Development Environment

## Container-First Development

This project runs entirely in a Podman container. The host machine only needs Podman installed - all other tools (Bun, dependencies, build tools) live inside the container.

```
Host Machine          Container (v10r)
┌─────────────┐      ┌──────────────────────┐
│  Podman     │ ───► │  Bun runtime         │
│  (only)     │      │  node_modules        │
│             │      │  Build tools         │
└─────────────┘      └──────────────────────┘
```

## Adding Dependencies

Never run `bun add` on the host. The workflow is:

1. **Edit `package.json`** — add the package to `dependencies` or `devDependencies`
2. **Restart the container** — the container runs `bun install` automatically on startup

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
| Start | `podman-compose up -d` |
| Stop | `podman-compose down` |
| Restart | `podman-compose restart app` |
| Logs | `podman-compose logs -f app` |
| Shell into container | `podman exec -it v10r sh` |
| Rebuild image | `podman-compose build --no-cache` |
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

Drives `podman compose down && up`, parses Vite logs, and reports `install_ms`, `vite_ready_ms`, `first_ssr_ttfb_ms`, `ssr_reload_count`. Thresholds: warn `> 15 s`, fail `> 25 s` (current baseline ~36 s is set as the working ceiling for this stack until Vite 8 / Rolldown lands).

## Running Commands Inside Container

Use `podman exec -it v10r <command>` for one-off commands (e.g., `bun run check`, `bun run build`), or open a shell with `podman exec -it v10r sh`.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Dependencies not updating | `podman-compose down` then `podman-compose up -d` |
| Need a fresh start | `podman-compose down -v` (removes volumes) then `podman-compose up -d` |
| Container won't start | Check logs with `podman-compose logs app` |
