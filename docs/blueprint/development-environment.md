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

When documentation shows:

```bash
bun add package-name
```

The actual workflow is:

1. **Edit `package.json`** - add the package to `dependencies` or `devDependencies`
2. **Restart the container** - `podman-compose restart app`

The container runs `bun install` automatically on startup, picking up any new packages.

### Example

To add `better-auth`:

```json
// package.json
{
  "dependencies": {
    "better-auth": "^1.2.0"
  }
}
```

Then restart:

```bash
podman-compose restart app
```

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

```yaml
volumes:
  - .:/app                        # Project files (hot reload)
  - node_modules:/app/node_modules  # Named volume (isolated)
```

The named volume for `node_modules` means:
- Dependencies don't sync back to host
- Faster I/O (no filesystem translation)
- No conflicts with host's Node version

## Running Commands Inside Container

If you need to run a one-off command:

```bash
podman exec -it v10r bun run check
podman exec -it v10r bun run build
```

Or open a shell:

```bash
podman exec -it v10r sh
```

## Troubleshooting

### Dependencies not updating?

```bash
podman-compose down
podman-compose up -d
```

### Need a fresh start?

```bash
podman-compose down -v  # removes volumes too
podman-compose up -d
```

### Container won't start?

Check logs:

```bash
podman-compose logs app
```
