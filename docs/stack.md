# Velociraptor Stack

Technology decisions for the Velociraptor template.

## Runtime & Framework

| Layer | Choice | Why |
|-------|--------|-----|
| Runtime | **Bun** | Fastest JS runtime, built-in bundler, native TypeScript |
| Framework | **SvelteKit** | Minimal overhead, reactive, great DX |
| Adapter (dev) | **adapter-bun** | Native Bun server for local containers |
| Adapter (prod) | **adapter-vercel** | Optimized for Vercel with Bun runtime |
| Language | **TypeScript** | Type safety, better tooling |

## Container & Infrastructure

| Layer | Choice | Why |
|-------|--------|-----|
| Container | **Podman** | Rootless, daemonless, Docker-compatible |
| Base Image | **oven/bun:alpine** | Minimal footprint (~50MB) |
| Orchestration | **podman-compose** | Simple multi-container setup |
| Dev Workflow | Volume mounts | Live reload without rebuilds |
| Local S3 | **MinIO** | S3-compatible, same API as R2 |

## Data Architecture

| Concern | Service | Why |
|---------|---------|-----|
| Relational Data | **Neon (Postgres)** | Serverless, branching, Drizzle-native |
| Auth Sessions | **Lucia + Postgres** | Self-hosted, no vendor lock-in |
| Graph Data | **Neo4j Aura** | Native graph queries, 200k nodes free |
| File Storage | **Cloudflare R2** | Zero egress fees, 10GB free, S3-compatible |

**Separation of concerns:**
- Postgres → Users, sessions, content, settings
- Neo4j → Entities, relations, graph RAG
- R2 → Images, files, uploads

## Database

| Layer | Choice | Why |
|-------|--------|-----|
| Primary DB | **PostgreSQL** | Production-ready, rich features, JSON support |
| Graph DB | **Neo4j** | Native graph queries, entity relationships |
| ORM | **Drizzle** | Type-safe, lightweight, Bun-compatible |
| Migrations | **Drizzle Kit** | Schema-driven, SQL-first |

**Why Drizzle over Prisma/Kysely:**

| Aspect | Drizzle | Prisma | Kysely |
|--------|---------|--------|--------|
| Bundle Size | ~50 KB | 15+ MB | ~2 MB |
| Code Generation | None | Required | None |
| Serverless/Edge | ✅ Perfect | ❌ Too heavy | ✅ Good |
| Philosophy | SQL-in-TypeScript | ORM abstraction | Query builder |

Drizzle wins: lightweight bundle, no codegen, SQL-first, Bun-native.

## File Storage

| Layer | Choice | Why |
|-------|--------|-----|
| Provider | **Cloudflare R2** | Zero egress fees, S3-compatible, global CDN |
| SDK | **@aws-sdk/client-s3** | Standard S3 API, works with R2 |

**Why R2 over alternatives:**

| Provider | Free Storage | Free Egress | Notes |
|----------|--------------|-------------|-------|
| **Cloudflare R2** | 10 GB | **Unlimited** | Best overall |
| Backblaze B2 | 10 GB | Via CDN only | Needs Cloudflare pairing |
| Supabase Storage | 1 GB | 2 GB/mo | Tied to Supabase |
| AWS S3 | 5 GB (12 mo) | 100 GB (12 mo) | Free tier expires |

R2 wins: zero egress, S3-compatible, built-in CDN, no credit card required.

## Image Optimization

| Layer | Choice | Why |
|-------|--------|-----|
| Static images | **@sveltejs/enhanced-img** | Official, build-time WebP/AVIF, responsive srcset |
| User uploads | **Sharp** | Process on upload, store multiple sizes in R2 |

**Strategy:** Static images optimized at build. User uploads processed once, stored at multiple sizes in R2, served via Cloudflare CDN.

## UI & Styling

| Layer | Choice | Why |
|-------|--------|-----|
| CSS Engine | **UnoCSS** | Atomic, on-demand, smaller than Tailwind |
| Components | **Bits UI** | Headless, accessible, Svelte-native |
| Icons | **Iconify** | Unified API, tree-shakeable |
| Animations | **Svelte built-in** | Native transitions, springs, tweened (0 KB) |
| Complex Animations | **Motion One** | Timelines, scroll-triggered, staggering (~3.8 KB) |

**Philosophy:** Utility-first UnoCSS, unstyled base components (Bits UI), custom design tokens, no pre-built library bloat.

**Animation:** Use Svelte built-in first. Add Motion One for timelines, scroll-triggered, or gesture-based animations.

## Authentication

| Layer | Choice | Why |
|-------|--------|-----|
| Auth | **Lucia** | Lightweight, session-based, Svelte-friendly |
| Sessions | PostgreSQL-backed | Persistent, secure |
| Middleware | SvelteKit hooks | Native request interception |

**Why Lucia over Clerk/Supabase Auth:**

| Aspect | Lucia | Clerk | Supabase Auth |
|--------|-------|-------|---------------|
| Cost | Free forever | Free to 10K MAU | Tied to Supabase |
| Vendor Lock-in | None | High | High |
| Data Ownership | 100% yours | Third-party | Third-party |
| Drizzle Integration | Native | N/A | N/A |

Lucia wins: zero cost at scale, full data control, native Drizzle, no vendor lock-in, SvelteKit-first.

## Internationalization

| Layer | Choice | Why |
|-------|--------|-----|
| i18n Library | **sveltekit-i18n** | Per-language lazy loading, scales to 10+ languages |
| Strategy | URL-based (`/en/`, `/de/`) | SEO-friendly, cacheable |

**Why sveltekit-i18n over Paraglide:**

| Aspect | sveltekit-i18n | Paraglide |
|--------|----------------|-----------|
| Language Loading | Per-language lazy | All languages bundled |
| 10+ Languages | ~1 KB/page | ~12+ KB/page |
| Type Safety | Partial | Full |

sveltekit-i18n wins for multi-language projects: true lazy loading, scales infinitely, per-route loading, no dependencies.

**Note:** For 2-5 languages, Paraglide offers better type safety.

## State Management

| Layer | Choice | Why |
|-------|--------|-----|
| Local State | **Svelte Runes** | `$state`, `$derived`, `$effect` - built-in, 0 KB |
| Shared State | **Svelte Stores** | `writable`, `readable`, `derived` - built-in, 0 KB |

Svelte's reactivity is built into the compiler. No external state library needed. No Zustand, no Redux, no Pinia.

## Validation & Forms

| Layer | Choice | Why |
|-------|--------|-----|
| Schema Validation | **Valibot** | Type-safe, ~1 KB (10x smaller than Zod) |
| Form Handling | **Superforms** | SvelteKit-native, Valibot integration |

**Why Valibot over Zod:**

| Aspect | Valibot | Zod |
|--------|---------|-----|
| Bundle Size | **~1 KB** | ~12 KB |
| TypeScript Inference | ✅ Full | ✅ Full |
| Tree-shaking | Fully modular | Monolithic |

Valibot wins: 10x smaller, critical for edge/serverless, same DX as Zod, Superforms support.

**Why Superforms:** Server-side validation, progressive enhancement, auto error handling, nested data support.

## API & Services

| Layer | Choice | Why |
|-------|--------|-----|
| API Style | **REST + Server Actions** | Simple, SvelteKit-native |
| API Docs | **Scalar** | OpenAPI spec, modern UI |
| Analytics | **Vercel Analytics** | Free with Vercel, cookieless, zero config |
| Error Tracking | **Sentry** | Official SvelteKit SDK, 5K errors/mo free |
| Email | **Resend** | Simple API, 100 emails/day free |

## Caching

| Layer | Choice | Why |
|-------|--------|-----|
| Default | **Vercel Edge Cache** | Free, built-in, zero config |
| Dynamic data | **Upstash Redis** | 500K commands/mo free, query caching |

**Start with Vercel Edge only.** Add Redis for database query caching or real-time features.

## Background Jobs

| Layer | Choice | Why |
|-------|--------|-----|
| Default (90%) | **SvelteKit server actions** | Fast, simple, no extra deps |
| Simple async | **Upstash QStash** | Fire-and-forget, 500 msg/day free |
| Complex workflows | **Inngest** | Multi-step, retries, cron, 25K runs/mo free |

**Use background jobs only when:** task takes 5+ seconds, need cron/scheduling, or need auto-retries.

## Development Tools

| Tool | Purpose |
|------|---------|
| **VS Code** | Primary editor |
| **Biome** | Linting + formatting (faster than ESLint + Prettier) |
| **Vitest** | Unit testing |
| **Playwright** | E2E testing |
| **GitLab CI** | CI/CD (400 min/mo free, built-in container registry) |

## Deployment

**Strategy:** Split local/production. Containers locally. Managed services in production.

**Local (Podman):**
- `podman-compose` with app (Bun+SvelteKit), postgres, neo4j, minio (S3)
- Volume mounts for live reload

**Production (Managed Services):**

| Service | Provider | Free Tier | Why |
|---------|----------|-----------|-----|
| **App Hosting** | Vercel | 100GB bandwidth/mo | Native Bun runtime, edge network, zero-config |
| **PostgreSQL** | Neon | 0.5GB storage, 100 CU-hours/mo | Serverless Postgres, branching, sleeps after 5min idle |
| **Graph DB** | Neo4j Aura | 200k nodes | Managed Neo4j, always on |
| **File Storage** | Cloudflare R2 | 10GB, 10M reads, 1M writes/mo | Zero egress, S3-compatible |
