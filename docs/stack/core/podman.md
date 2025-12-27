# Podman

## What is it?

Daemonless, rootless container engine that manages OCI-compliant containers and images. Uses libpod library and OCI runtimes (runc, crun). Each container runs as a child process of the user session—no background daemon required.

## What is it for?

- Building, running, and managing OCI containers
- Local development with podman-compose (multi-container apps)
- CI/CD container builds (GitLab Runner native support)
- Cross-platform development via Podman Machine (macOS, Windows)

## Why was it chosen?

| Aspect | Podman | Docker |
|--------|--------|--------|
| Architecture | Daemonless | Requires daemon |
| Security | Rootless by default | Root by default |
| CLI | Docker-compatible | N/A |
| Startup | Up to 50% faster | Baseline |
| Attack surface | No privileged socket | Daemon = target |

**Key advantages:**
- No daemon = no single point of failure (if Docker daemon crashes, all containers die)
- Rootless containers get 11 capabilities vs Docker's 14
- Drop-in Docker CLI replacement (`alias docker=podman`)
- No licensing restrictions
- Seamless SELinux/AppArmor integration
- CNCF Sandbox Project (accepted January 2025)

## Known limitations

**Ecosystem:**
- Docker has 20+ million developers, larger ecosystem
- Cloud providers offer Docker-first container services
- Fewer third-party integrations and documentation

**Networking:**
- Rootless networking: 2-4 Gbps vs Docker's 8-10 Gbps
- Complex routing/load balancing requires more manual setup

**Compatibility caveats:**
- Rootless ports must be >= 1024
- Some Docker commands behave differently
- Legacy `--link` not supported (deprecated in Docker too)

**Platform:**
- Linux-native; macOS/Windows require Podman Machine (VM)
- Not as seamless as Docker Desktop on non-Linux

## Related

- [bun.md](./bun.md) - Runtime
- [../ops/deployment.md](../ops/deployment.md) - Production deployment
