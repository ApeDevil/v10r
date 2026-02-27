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

## Ports

| Port | Purpose |
|------|---------|
| **5173** | Vite dev server |
| **24678** | HMR WebSocket |

## Volume Mounts

Project files are bind-mounted at `/app` for hot reload. `node_modules` uses a named volume, which means:
- Dependencies don't sync back to host
- Faster I/O (no filesystem translation)
- No conflicts with host's Node version

## Running Commands Inside Container

Use `podman exec -it v10r <command>` for one-off commands (e.g., `bun run check`, `bun run build`), or open a shell with `podman exec -it v10r sh`.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Dependencies not updating | `podman-compose down` then `podman-compose up -d` |
| Need a fresh start | `podman-compose down -v` (removes volumes) then `podman-compose up -d` |
| Container won't start | Check logs with `podman-compose logs app` |
