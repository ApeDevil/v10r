# Podman

Container runtime. Rootless, daemonless, Docker-compatible.

## Why Podman

| Aspect | Podman | Docker |
|--------|--------|--------|
| Daemon | Daemonless | Requires daemon |
| Root | Rootless by default | Root by default |
| CLI | Docker-compatible | N/A |
| Compose | podman-compose | docker-compose |
| Security | Better isolation | Daemon = attack surface |

Podman wins: rootless security, no daemon overhead, drop-in Docker replacement.

## Stack Integration

| Layer | Choice | Why |
|-------|--------|-----|
| Container | **Podman** | Rootless, daemonless, Docker-compatible |
| Base Image | `oven/bun:alpine` | Minimal footprint (~50MB) |
| Orchestration | `podman-compose` | Multi-container setup |
| Dev Workflow | Volume mounts | Live reload without rebuilds |
| Local S3 | MinIO | S3-compatible, same API as R2 |

## Local Development

```yaml
# podman-compose.yml services
- app (SvelteKit + Bun)
- postgres (Neon-compatible)
- neo4j (Graph database)
- minio (S3-compatible storage)
```

Volume mounts enable live reload without container rebuilds.

## Commands

```bash
podman-compose up -d     # Start all services
podman-compose down      # Stop all services
podman-compose logs -f   # Follow logs
podman ps                # List running containers
```

## Related

- [bun.md](./bun.md) - Runtime
- [../ops/deployment.md](../ops/deployment.md) - Production deployment
- [../../blueprint/deployment.md](../../blueprint/deployment.md) - Dockerfile examples
