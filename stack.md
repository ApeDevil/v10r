# Velociraptor Stack

Technology decisions for the Velociraptor template.

---

## Runtime & Framework

| Layer | Choice | Why |
|-------|--------|-----|
| Runtime | **Bun** | Fastest JS runtime, built-in bundler, native TypeScript |
| Framework | **SvelteKit** | Minimal overhead, reactive, great DX |
| Adapter (dev) | **adapter-bun** | Native Bun server for local containers |
| Adapter (prod) | **adapter-vercel** | Optimized for Vercel with Bun runtime |
| Language | **TypeScript** | Type safety, better tooling |

---

## Container & Infrastructure

| Layer | Choice | Why |
|-------|--------|-----|
| Container | **Podman** | Rootless, daemonless, Docker-compatible |
| Base Image | **oven/bun:alpine** | Minimal footprint (~50MB) |
| Orchestration | **podman-compose** | Simple multi-container setup |
| Dev Workflow | Volume mounts | Live reload without rebuilds |
| Local S3 | **MinIO** | S3-compatible, same API as R2 |

---

## Data Architecture (Separation of Concerns)

```
┌─────────────────────────────────────────────────────────────┐
│                    SEPARATION OF CONCERNS                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   NEON      │  │  NEO4J AURA │  │ CLOUDFLARE  │         │
│  │  Postgres   │  │    Graph    │  │     R2      │         │
│  │             │  │             │  │             │         │
│  │ • Users     │  │ • Entities  │  │ • Images    │         │
│  │ • Sessions  │  │ • Relations │  │ • Files     │         │
│  │ • Content   │  │ • Graph RAG │  │ • Uploads   │         │
│  │ • Settings  │  │             │  │             │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│         │                │                │                 │
│         │    Drizzle     │   Neo4j Driver │   S3 SDK       │
│         │      ORM       │                │                 │
│         └────────────────┼────────────────┘                 │
│                          │                                  │
│                  ┌───────▼───────┐                          │
│                  │   SvelteKit   │                          │
│                  │   + Lucia     │                          │
│                  └───────────────┘                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

| Concern | Service | Why |
|---------|---------|-----|
| Relational Data | Neon (Postgres) | Serverless, branching, Drizzle-native |
| Auth Sessions | Lucia + Postgres | Self-hosted, no vendor lock-in |
| Graph Data | Neo4j Aura | Native graph queries, 200k nodes free |
| File Storage | Cloudflare R2 | Zero egress fees, 10GB free, S3-compatible |

---

## Database

| Layer | Choice | Why |
|-------|--------|-----|
| Primary DB | **PostgreSQL** | Production-ready, rich features, JSON support |
| Graph DB | **Neo4j** | Native graph queries, entity relationships |
| ORM | **Drizzle** | Type-safe, lightweight, Bun-compatible |
| Migrations | **Drizzle Kit** | Schema-driven, SQL-first |

### Why Drizzle over Prisma/Kysely?

| Aspect | Drizzle | Prisma | Kysely |
|--------|---------|--------|--------|
| Bundle Size | ~50 KB | 15+ MB | ~2 MB |
| Code Generation | None | Required | None |
| Serverless/Edge | ✅ Perfect | ❌ Too heavy | ✅ Good |
| Philosophy | SQL-in-TypeScript | ORM abstraction | Query builder |
| Bun Support | Native | Works but heavy | Native |

Drizzle wins for Velociraptor because:
- **Lightweight** - tiny bundle for Vercel edge functions
- **No codegen** - instant type feedback, no `prisma generate`
- **SQL-first** - if you know SQL, you know Drizzle
- **Bun-native** - first-class support, no compatibility issues

---

## File Storage

| Layer | Choice | Why |
|-------|--------|-----|
| Provider | **Cloudflare R2** | Zero egress fees, S3-compatible, global CDN |
| SDK | **@aws-sdk/client-s3** | Standard S3 API, works with R2 |
| Use Cases | Images, documents, uploads | User-generated content |

### Why R2 over alternatives?

| Provider | Free Storage | Free Egress | Notes |
|----------|--------------|-------------|-------|
| **Cloudflare R2** | 10 GB | **Unlimited** | Best overall |
| Backblaze B2 | 10 GB | Via CDN only | Needs Cloudflare pairing |
| Supabase Storage | 1 GB | 2 GB/mo | Tied to Supabase |
| AWS S3 | 5 GB (12 mo) | 100 GB (12 mo) | Free tier expires |

R2 wins because:
- **Zero egress** - serve files globally without bandwidth costs
- **S3-compatible** - use existing libraries and tools
- **Built-in CDN** - Cloudflare's edge network included
- **No credit card** required for free tier

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

### Why Lucia over Clerk/Supabase Auth?

| Aspect | Lucia | Clerk | Supabase Auth |
|--------|-------|-------|---------------|
| Cost | Free forever | Free to 10K MAU | Tied to Supabase |
| Vendor Lock-in | None | High | High |
| Data Ownership | 100% yours | Third-party | Third-party |
| Drizzle Integration | Native | N/A | N/A |
| Setup Effort | More initial work | 5-minute setup | Medium |

Lucia wins for Velociraptor because:
- **Zero cost** at any scale (self-hosted)
- **Full control** over user data and sessions
- **Native Drizzle support** - sessions stored in your Neon Postgres
- **No vendor lock-in** - switch providers anytime
- **SvelteKit-first** - designed with Svelte in mind

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

## Deployment

### Strategy: Split Local / Production

```
Local Development (Podman)              Production (Managed Services)
┌─────────────────────────┐             ┌─────────────────────────┐
│  podman-compose         │             │  Vercel (Bun runtime)   │
│  ├── app (Bun+Svelte)   │    →→→      │  └── SvelteKit app      │
│  ├── postgres           │             └─────────────────────────┘
│  ├── neo4j              │                        │
│  └── minio (S3)         │                        ▼
└─────────────────────────┘             ┌─────────────────────────┐
                                        │  Neon (Postgres)        │
                                        │  Neo4j Aura (Graph)     │
                                        │  Cloudflare R2 (Files)  │
                                        └─────────────────────────┘
```

### Production Services

| Service | Provider | Tier | Why |
|---------|----------|------|-----|
| **App Hosting** | Vercel | Free | Native Bun runtime, edge network, zero-config |
| **PostgreSQL** | Neon | Free | Serverless Postgres, 0.5GB storage, branching |
| **Graph DB** | Neo4j Aura | Free | Managed Neo4j, 200k nodes free |
| **File Storage** | Cloudflare R2 | Free | 10GB storage, zero egress, S3-compatible |

---

## Summary

```
        LOCAL                           PRODUCTION
        ─────                           ──────────
Bun → SvelteKit → adapter-bun    →    adapter-vercel → Vercel (Bun)
         │                                   │
         ├── UnoCSS + Bits UI               ├── UnoCSS + Bits UI
         ├── Lucia (auth)                   ├── Lucia (auth)
         ├── Paraglide (i18n)               ├── Paraglide (i18n)
         ├── Drizzle → PostgreSQL ───────── ├── Drizzle → Neon
         ├── Neo4j Driver → Neo4j ───────── ├── Neo4j Driver → Aura
         └── S3 SDK → MinIO ─────────────── └── S3 SDK → Cloudflare R2

     Podman containers                   Managed services
```

### Free Tier Limits (Production)

| Service | Storage | Compute/Requests | Notes |
|---------|---------|------------------|-------|
| Vercel | - | 100GB bandwidth/mo | Serverless functions |
| Neon | 0.5 GB | 100 CU-hours/mo | Sleeps after 5min idle |
| Neo4j Aura | 200k nodes | - | Always on |
| Cloudflare R2 | 10 GB | 10M reads, 1M writes/mo | Zero egress |
