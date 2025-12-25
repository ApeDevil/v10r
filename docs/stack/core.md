# Core Infrastructure

Runtime, framework, database, storage, and deployment.

## Runtime & Framework

| Layer | Choice | Why |
|-------|--------|-----|
| Runtime | **Bun** | Fastest JS runtime, built-in bundler, native TypeScript |
| Framework | **SvelteKit** | Minimal overhead, reactive, great DX |
| Adapter (dev) | **adapter-bun** | Native Bun server for local containers |
| Adapter (prod) | **adapter-vercel** | Optimized for Vercel with Bun runtime |
| Language | **TypeScript** | Type safety, better tooling |

## Container

| Layer | Choice | Why |
|-------|--------|-----|
| Container | **Podman** | Rootless, daemonless, Docker-compatible |
| Base Image | **oven/bun:alpine** | Minimal footprint (~50MB) |
| Orchestration | **podman-compose** | Multi-container setup |
| Dev Workflow | Volume mounts | Live reload without rebuilds |
| Local S3 | **MinIO** | S3-compatible, same API as R2 |

## Data Architecture

| Concern | Technology | Provider | Why |
|---------|------------|----------|-----|
| Relational | **PostgreSQL** | [Neon](./vendors.md#neon) | ACID, JSON support, Drizzle-native |
| Sessions | **Better Auth** | Self-hosted (Postgres) | Full-featured, no vendor lock-in |
| Graph | **Neo4j** | [Neo4j Aura](./vendors.md#neo4j-aura) | Native graph queries, Cypher |
| Files | **S3 API** | [Cloudflare R2](./vendors.md#cloudflare-r2) | Zero egress, S3-compatible |

**Separation:**
- Postgres: users, sessions, content, settings
- Neo4j: entities, relations, graph RAG
- R2: images, files, uploads

**Swappability:** All use standard protocols. See [vendors.md](./vendors.md) for alternatives and migration guides.

### Polyglot Freshness

Cross-database references must remain valid and current. No foreign keys across stores, so freshness is your responsibility.

| Pattern | Complexity | Use Case |
|---------|------------|----------|
| Read-time validation | Low | Check refs on read |
| Soft delete + propagation | Low-Medium | Async cascade cleanup |
| Transactional outbox | Medium | Guaranteed event delivery |
| Periodic reconciliation | Low | Batch orphan detection |

**Full implementation details:** [blueprint/db/polyglot-freshness.md](../blueprint/db/polyglot-freshness.md)

## Database

| Layer | Technology | Provider | Why |
|-------|------------|----------|-----|
| Primary DB | **PostgreSQL** | [Neon](./vendors.md#neon) | Production-ready, rich features, JSON support |
| Graph DB | **Neo4j** | [Neo4j Aura](./vendors.md#neo4j-aura) | Native graph queries, entity relationships |
| ORM | **Drizzle** | Library | Type-safe, lightweight, Bun-compatible |
| Migrations | **Drizzle Kit** | Library | Schema-driven, SQL-first |

**Why Drizzle over Prisma/Kysely:**

| Aspect | Drizzle | Prisma | Kysely |
|--------|---------|--------|--------|
| Bundle Size | ~50 KB | 15+ MB | ~2 MB |
| Code Generation | None | Required | None |
| Serverless/Edge | Perfect | Too heavy | Good |
| Philosophy | SQL-in-TypeScript | ORM abstraction | Query builder |

Drizzle wins: lightweight bundle, no codegen, SQL-first, Bun-native.

## File Storage

| Layer | Technology | Provider | Why |
|-------|------------|----------|-----|
| Protocol | **S3 API** | [Cloudflare R2](./vendors.md#cloudflare-r2) | Zero egress fees, S3-compatible, global CDN |
| SDK | **@aws-sdk/client-s3** | Library | Standard S3 API, works with any S3-compatible |

**Why R2 over alternatives:**

| Provider | Free Storage | Free Egress | Notes |
|----------|--------------|-------------|-------|
| **Cloudflare R2** | 10 GB | **Unlimited** | Best overall |
| Backblaze B2 | 10 GB | Via CDN only | Needs Cloudflare pairing |
| Supabase Storage | 1 GB | 2 GB/mo | Tied to Supabase |
| AWS S3 | 5 GB (12 mo) | 100 GB (12 mo) | Free tier expires |

R2 wins: zero egress, S3-compatible, built-in CDN, no credit card required.

## Caching

| Layer | Technology | Provider | Why |
|-------|------------|----------|-----|
| Edge | **HTTP Cache** | [Vercel](./vendors.md#vercel) | Free, built-in, zero config |
| Dynamic | **Redis** | Upstash | 500K commands/mo free, query caching |

Start with Vercel Edge. Add Redis for query caching or real-time features.

## Code Quality

| Layer | Choice | Why |
|-------|--------|-----|
| Linting + Formatting | **Biome** | 10-25x faster than ESLint + Prettier, single binary |
| Alternative | **ESLint + Prettier** | Full Svelte syntax support, mature ecosystem |

**Why Biome over ESLint + Prettier:**

| Aspect | Biome | ESLint + Prettier |
|--------|-------|-------------------|
| Speed | ~200ms (10k lines) | 3-5 seconds |
| Config files | 1 | 3-4 |
| Dependencies | 1 binary | 127+ packages |
| Svelte support | Experimental (v2.3+) | Full |

**Biome Svelte Status (v2.3.0, Oct 2025):**
- Formats/lints JS/TS in `<script>` and CSS in `<style>` tags
- Requires opt-in: `html.experimentalFullSupportEnabled`
- Limitation: Svelte control flow (`{#if}`, `{#each}`) not fully parsed

**Our Choice: Biome (experimental)**

We use Biome despite its experimental Svelte support. This is a deliberate cutting-edge tradeoff:

- Speed and DX benefits outweigh current limitations
- Svelte control flow issues are minor in practice
- Biome's Svelte support is actively improving
- Aligns with our "fast and modern" stack philosophy

Fallback to ESLint + Prettier if Biome causes issues with complex Svelte templates.

## Development Tools

| Tool | Purpose |
|------|---------|
| **VS Code** | Primary editor |
| **Vitest** | Unit testing |
| **Playwright** | E2E testing |
| **GitLab CI** | CI/CD (400 min/mo free, built-in container registry) |

## Deployment

**Strategy:** Containers locally, managed services in production.

**Local:**
- Podman Compose: app (Bun+SvelteKit), postgres, neo4j, minio
- Volume mounts for live reload

**Production:**

| Service | Technology | Provider | Free Tier |
|---------|------------|----------|-----------|
| **App** | Bun + SvelteKit | [Vercel](./vendors.md#vercel) | 100GB bandwidth/mo |
| **Postgres** | PostgreSQL | [Neon](./vendors.md#neon) | 0.5GB, 100 CU-hours/mo |
| **Graph** | Neo4j | [Neo4j Aura](./vendors.md#neo4j-aura) | 200k nodes |
| **Files** | S3 API | [Cloudflare R2](./vendors.md#cloudflare-r2) | 10GB, unlimited egress |

See [vendors.md](./vendors.md) for full cost breakdown and alternatives.
