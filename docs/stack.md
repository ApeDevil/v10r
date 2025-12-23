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
| Animations | **Svelte built-in** | Native transitions, springs, tweened (0 KB) |
| Complex Animations | **Motion One** | Timelines, scroll-triggered, staggering (~3.8 KB) |

### Styling Philosophy
- Utility-first with UnoCSS presets
- Unstyled base components (Bits UI)
- Custom design tokens for theming
- No pre-built component library bloat

### Animation Strategy
- **Primary**: Svelte built-in (`fade`, `fly`, `slide`, `scale`, `spring`, `tweened`)
- **When needed**: Motion One for timelines, scroll-triggered, gesture-based animations
- WAAPI-based, hardware accelerated, runs off main thread

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
| i18n Library | **sveltekit-i18n** | Per-language lazy loading, scales to 10+ languages |
| Strategy | URL-based (`/en/`, `/de/`) | SEO-friendly, cacheable |

### Why sveltekit-i18n over Paraglide?

| Aspect | sveltekit-i18n | Paraglide |
|--------|----------------|-----------|
| Language Loading | Per-language lazy | All languages bundled |
| 10+ Languages | ~1 KB/page | ~12+ KB/page |
| Type Safety | Partial | Full |
| Route Lazy Loading | Yes | Yes |
| Dependencies | None | None |
| Svelte 5 | Yes | Yes |

sveltekit-i18n wins for Densho/multi-language projects because:
- **True lazy loading** - only requested language is fetched
- **Scales infinitely** - 10, 20, 50 languages with same bundle size
- **Per-route loading** - translations loaded only for visited pages
- **No external dependencies** - minimal footprint

Note: For projects with 2-5 languages, Paraglide offers better type safety.

---

## State Management

| Layer | Choice | Why |
|-------|--------|-----|
| Local State | **Svelte Runes** | `$state`, `$derived`, `$effect` - built-in, 0 KB |
| Shared State | **Svelte Stores** | `writable`, `readable`, `derived` - built-in, 0 KB |

### Why No External State Library?

Svelte's reactivity is built into the compiler. Unlike React (needs Redux/Zustand) or Vue (needs Pinia), Svelte handles state natively:

```svelte
<!-- Svelte 5 Runes - component state -->
<script>
  let count = $state(0);
  let doubled = $derived(count * 2);
</script>

<!-- Svelte Stores - shared state -->
<script>
  import { writable } from 'svelte/store';
  export const user = writable(null);
</script>
```

**No Zustand, no Redux, no Pinia** - Svelte doesn't need them.

---

## Validation & Forms

| Layer | Choice | Why |
|-------|--------|-----|
| Schema Validation | **Valibot** | Type-safe, ~1 KB (10x smaller than Zod) |
| Form Handling | **Superforms** | SvelteKit-native, Valibot integration |

### Why Valibot over Zod?

| Aspect | Valibot | Zod |
|--------|---------|-----|
| Bundle Size | **~1 KB** | ~12 KB |
| TypeScript Inference | ✅ Full | ✅ Full |
| API Style | Similar to Zod | Industry standard |
| Tree-shaking | Fully modular | Monolithic |
| Ecosystem | Growing | Mature |

Valibot wins for Velociraptor because:
- **10x smaller** - critical for edge/serverless
- **Same DX** - if you know Zod, you know Valibot
- **Superforms support** - first-class SvelteKit integration
- **Modular** - only import what you use

### Why Superforms?

The best form library for SvelteKit:
- **Server-side validation** with Valibot schemas
- **Progressive enhancement** - works without JS
- **Auto error handling** - field-level errors out of the box
- **Nested data** - complex forms made simple

---

## API & Data Fetching

| Layer | Choice | Why |
|-------|--------|-----|
| API Style | **REST + Server Actions** | Simple, SvelteKit-native |
| API Docs | **Scalar** | OpenAPI spec, modern UI |

---

## Analytics

| Layer | Choice | Why |
|-------|--------|-----|
| Web Analytics | **Vercel Analytics** | Free with Vercel, cookieless (no GDPR banner), zero config |

---

## Error Tracking

| Layer | Choice | Why |
|-------|--------|-----|
| Error Monitoring | **Sentry** | Official SvelteKit SDK, 5K errors/mo free, source maps |

---

## Email

| Layer | Choice | Why |
|-------|--------|-----|
| Transactional | **Resend** | Simple API, 100 emails/day free, great DX |

---

## Caching

| Layer | Choice | Why |
|-------|--------|-----|
| Default | **Vercel Edge Cache** | Free, built-in, zero config |
| Dynamic data | **Upstash Redis** | 500K commands/mo free, query caching |

Start with Vercel Edge only. Add Redis when you need database query caching or real-time features.

---

## Background Jobs

| Layer | Choice | Why |
|-------|--------|-----|
| Default (90%) | **SvelteKit server actions** | Fast, simple, no extra deps |
| Simple async | **Upstash QStash** | Fire-and-forget, 500 msg/day free |
| Complex workflows | **Inngest** | Multi-step, retries, cron, 25K runs/mo free |

Use background jobs only when: task takes 5+ seconds, need cron/scheduling, or need auto-retries.

---

## CI/CD

| Layer | Choice | Why |
|-------|--------|-----|
| Platform | **GitLab CI** | Project on GitLab, 400 min/mo free, built-in container registry |

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
         ├── sveltekit-i18n                 ├── sveltekit-i18n
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
