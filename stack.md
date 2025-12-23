# Velociraptor Stack

Technology decisions for the Velociraptor template.

---

## Runtime & Framework

| Layer | Choice | Why |
|-------|--------|-----|
| Runtime | **Bun** | Fastest JS runtime, built-in bundler, native TypeScript |
| Framework | **SvelteKit** | Minimal overhead, reactive, great DX |
| Adapter | **adapter-bun** | Native Bun server, no Node.js shim |
| Language | **TypeScript** | Type safety, better tooling |

---

## Container & Infrastructure

| Layer | Choice | Why |
|-------|--------|-----|
| Container | **Podman** | Rootless, daemonless, Docker-compatible |
| Base Image | **oven/bun:alpine** | Minimal footprint (~50MB) |
| Orchestration | **podman-compose** | Simple multi-container setup |
| Dev Workflow | Volume mounts | Live reload without rebuilds |

---

## Database

| Layer | Choice | Why |
|-------|--------|-----|
| Primary DB | **PostgreSQL** | Production-ready, rich features, JSON support |
| Graph DB | **Neo4j** | Native graph queries, entity relationships |
| ORM | **Drizzle** | Type-safe, lightweight, Bun-compatible |
| Migrations | **Drizzle Kit** | Schema-driven, SQL-first |

### Database Architecture
```
┌─────────────────┐     ┌─────────────────┐
│   PostgreSQL    │     │     Neo4j       │
│                 │     │                 │
│  - Users        │     │  - Entities     │
│  - Content      │     │  - Relations    │
│  - Sessions     │     │  - Metadata     │
│  - Settings     │     │  - Graph RAG    │
└─────────────────┘     └─────────────────┘
        │                       │
        └───────────┬───────────┘
                    │
            ┌───────▼───────┐
            │  SvelteKit    │
            │  API Routes   │
            └───────────────┘
```

---

## UI & Styling

| Layer | Choice | Why |
|-------|--------|-----|
| CSS Engine | **UnoCSS** | Atomic, on-demand, smaller than Tailwind |
| Components | **Bits UI** | Headless, accessible, Svelte-native |
| Icons | **Iconify** | Unified API, tree-shakeable |
| Animations | **Motion One** | Lightweight, performant |

### Styling Philosophy
- Utility-first with UnoCSS presets
- Unstyled base components (Bits UI)
- Custom design tokens for theming
- No pre-built component library bloat

---

## Authentication & Security

| Layer | Choice | Why |
|-------|--------|-----|
| Auth | **Lucia** | Lightweight, session-based, Svelte-friendly |
| Sessions | PostgreSQL-backed | Persistent, secure |
| Middleware | SvelteKit hooks | Native request interception |

---

## Internationalization

| Layer | Choice | Why |
|-------|--------|-----|
| i18n Library | **Paraglide** | Compile-time, type-safe, tiny runtime |
| Strategy | URL-based (`/en/`, `/de/`) | SEO-friendly, cacheable |

---

## API & Data Fetching

| Layer | Choice | Why |
|-------|--------|-----|
| API Style | **REST + Server Actions** | Simple, SvelteKit-native |
| Validation | **Zod** | Runtime validation, TS inference |
| API Docs | **Scalar** | OpenAPI spec, modern UI |

---

## Development Tools

| Tool | Purpose |
|------|---------|
| **VS Code** | Primary editor |
| **Biome** | Linting + formatting (faster than ESLint + Prettier) |
| **Vitest** | Unit testing |
| **Playwright** | E2E testing |

---

## Deployment Targets

| Platform | Use Case |
|----------|----------|
| **Fly.io** | Primary (free tier, container-native) |
| **Railway** | Alternative (easy Postgres/Neo4j) |
| **Cloudflare** | Static assets / CDN |

---

## Container Services (compose.yaml)

```yaml
services:
  app:        # Bun + SvelteKit
  postgres:   # PostgreSQL 16
  neo4j:      # Neo4j Community
```

---

## Summary

```
Bun → SvelteKit → adapter-bun
         │
         ├── UnoCSS + Bits UI (styling)
         ├── Lucia (auth)
         ├── Paraglide (i18n)
         ├── Drizzle → PostgreSQL (relational data)
         └── Neo4j Driver → Neo4j (graph data)

All running in Podman containers.
```
