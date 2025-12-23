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

| Concern | Service | Why |
|---------|---------|-----|
| Relational | **Neon (Postgres)** | Serverless, branching, Drizzle-native |
| Sessions | **Lucia + Postgres** | Self-hosted, no vendor lock-in |
| Graph | **Neo4j Aura** | Native graph queries, 200k nodes free |
| Files | **Cloudflare R2** | Zero egress, 10GB free, S3-compatible |

**Separation:**
- Postgres: users, sessions, content, settings
- Neo4j: entities, relations, graph RAG
- R2: images, files, uploads

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
| Serverless/Edge | Perfect | Too heavy | Good |
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

## Caching

| Layer | Choice | Why |
|-------|--------|-----|
| Default | **Vercel Edge Cache** | Free, built-in, zero config |
| Dynamic | **Upstash Redis** | 500K commands/mo free, query caching |

Start with Vercel Edge. Add Redis for query caching or real-time features.

## Development Tools

| Tool | Purpose |
|------|---------|
| **VS Code** | Primary editor |
| **Biome** | Linting + formatting (faster than ESLint + Prettier) |
| **Vitest** | Unit testing |
| **Playwright** | E2E testing |
| **GitLab CI** | CI/CD (400 min/mo free, built-in container registry) |

## Deployment

**Strategy:** Containers locally, managed services in production.

**Local:**
- Podman Compose: app (Bun+SvelteKit), postgres, neo4j, minio
- Volume mounts for live reload

**Production:**

| Service | Provider | Free Tier | Why |
|---------|----------|-----------|-----|
| **App** | Vercel | 100GB bandwidth/mo | Native Bun, edge network, zero-config |
| **Postgres** | Neon | 0.5GB, 100 CU-hours/mo | Serverless, branching, sleeps after 5min |
| **Graph** | Neo4j Aura | 200k nodes | Managed Neo4j |
| **Files** | Cloudflare R2 | 10GB, 10M reads, 1M writes/mo | Zero egress, S3-compatible |
