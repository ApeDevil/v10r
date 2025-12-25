# Deployment

Hosting strategy for Velociraptor: tri-target deployment to test runtime portability.

## Strategy

**Write once, deploy anywhere.** The same codebase deploys to three targets:

| Target | Runtime | Platform | Status | Use Case |
|--------|---------|----------|--------|----------|
| **Serverless** | Node.js | Vercel | Stable | Zero-config, preview deploys |
| **Serverless** | Bun | Vercel | Experimental | Bun speed + Vercel DX |
| **Container** | Bun | Koyeb | Stable | Native Bun, container experience |

This proves the stack is portable and gives users deployment flexibility.

## Why Three Targets?

| Concern | Answer |
|---------|--------|
| Why Vercel + Node.js? | Battle-tested, zero config, best DX |
| Why Vercel + Bun? | Test experimental Bun runtime (28% faster) |
| Why Koyeb? | Guaranteed native Bun, container experience |
| Which is primary? | Your choice—all three are documented |

## Platform Comparison

| Aspect | Vercel (Node.js) | Vercel (Bun) | Koyeb (Bun) |
|--------|------------------|--------------|-------------|
| Runtime | Node.js 20 | Bun (experimental) | Native Bun |
| Deployment | Git push | Git push | Dockerfile |
| Cold starts | Fast | Fast | Slower (sleep) |
| Preview deploys | Automatic | Automatic | Manual |
| Free tier | 100 GB bandwidth | 100 GB bandwidth | 512 MB RAM |
| Complexity | Zero config | One config line | Container knowledge |
| Risk level | None | Medium (undocumented) | Low |

## Adapter Selection

SvelteKit uses adapters to target different platforms:

| Adapter | Target | Package |
|---------|--------|---------|
| `adapter-vercel` | Vercel (Node.js or Bun) | `@sveltejs/adapter-vercel` |
| `svelte-adapter-bun` | Bun container (Koyeb) | `svelte-adapter-bun` |

**Note:** Vercel's Bun runtime uses the same `adapter-vercel`—you just add `"bunVersion": "1.x"` to `vercel.json`.

## Trade-offs

### Vercel (Node.js) — Stable

| Pro | Con |
|-----|-----|
| Zero configuration | Not native Bun |
| Preview deploys per PR | Vendor-specific features |
| Edge functions | Cold starts on free tier |
| Built-in analytics | 100 GB bandwidth limit |

### Vercel (Bun) — Experimental

| Pro | Con |
|-----|-----|
| Bun runtime (28% faster) | SvelteKit not officially supported |
| Same Vercel DX | May break without warning |
| Preview deploys | Undocumented for SvelteKit |
| One config change | Experimental status |

> **Warning:** Vercel's Bun runtime officially supports Next.js, Express, Hono, and Nitro. SvelteKit is not listed but may work. Test thoroughly before production.

### Koyeb (Bun) — Stable

| Pro | Con |
|-----|-----|
| Native Bun runtime | Container sleep (cold starts) |
| True free tier | 0.1 vCPU is limited |
| No credit card required | No preview deploys |
| Container experience | Manual Dockerfile |

## Local Development

Local development uses containers for parity:

| Service | Image | Purpose |
|---------|-------|---------|
| App | `oven/bun:alpine` | SvelteKit dev server |
| PostgreSQL | `postgres:16-alpine` | Relational database |
| Neo4j | `neo4j:5-community` | Graph database |
| MinIO | `minio/minio` | S3-compatible storage |

**Container runtime:** Podman (rootless, daemonless, Docker-compatible)

## Environment Parity

| Concern | Local | Vercel (Node) | Vercel (Bun) | Koyeb |
|---------|-------|---------------|--------------|-------|
| Runtime | Bun | Node.js | Bun | Bun |
| Database | Postgres container | Neon | Neon | Neon |
| Files | MinIO | R2 | R2 | R2 |
| Env vars | `.env` | Dashboard | Dashboard | Dashboard |

Application code behaves identically. Only adapter and runtime differ.

## Recommendations

| Scenario | Recommendation |
|----------|----------------|
| Getting started | Vercel + Node.js (stable, zero config) |
| Want Bun + best DX | Vercel + Bun (experimental, test first) |
| Learning containers | Koyeb (Dockerfile experience) |
| Production app | Vercel + Node.js or Railway ($5/mo) |
| Bun-native features | Koyeb or self-hosted |
| Maximum free tier | Koyeb (no credit card) |
| Testing portability | Deploy to all three! |

## Implementation

See [blueprint/deployment.md](../blueprint/deployment.md) for:
- Dockerfile configuration
- Adapter setup
- Environment variables
- CI/CD pipelines
- Step-by-step deployment guides

## Related

- [vendors.md](./vendors.md) - Vercel and Koyeb provider details
- [core.md](./core.md) - Runtime and framework choices
