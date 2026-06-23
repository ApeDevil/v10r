# Podman

Daemonless, rootless container engine — the only tool installed on the host. The v10r container holds Bun, SvelteKit, and all dependencies; the host stays clean. See CLAUDE.md "Local Development" for the container-first rule.

## Why was it chosen?

- Rootless and daemonless — no privileged socket, no single daemon whose crash kills every container.
- Drop-in Docker CLI replacement (`alias docker=podman`).

## Known limitations

- Rootless ports must be >= 1024.
- Linux-native; macOS/Windows need Podman Machine (a VM).

## Related

- [bun.md](./bun.md) - Runtime
- [../ops/deployment.md](../ops/deployment.md) - Production deployment
