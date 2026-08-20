# Vendors & Providers

All external services used by Velociraptor. This separates **what technology** we use from **who provides** it.

> **How to use this file:** Technology files (e.g., `data/postgres.md`) cover *how to use* each technology. This file covers *provider details*: pricing, free tiers, compliance, and alternatives. Technology files link here for provider info.

## Why This Matters

| Concern | Answer |
|---------|--------|
| Vendor lock-in | See "Swappability" column |
| Total cost | See "Cost Summary" |
| GDPR compliance | See "Compliance" section |
| Migration planning | See "Alternatives" per vendor |

---

## Overview

| Capability | Technology | Provider | Swappability |
|------------|------------|----------|--------------|
| AI Chat | Vercel AI SDK | **Groq** / **OpenAI** / **Google** (3-provider routing) | Easy |
| AI Embeddings | Vercel AI SDK | **Google** (`gemini-embedding-001`, 1536-dim) | Easy |
| Relational DB | PostgreSQL | **Neon** | Easy |
| Graph DB | Neo4j | **Neo4j Aura** | Medium |
| Object Storage | S3 API | **Cloudflare R2** | Easy |
| Cache | Redis | **Upstash** | Easy |
| App Hosting | SvelteKit + Node.js | **Vercel** | Medium |
| App Hosting | SvelteKit + Bun | **Koyeb** *(planned — not deployed)* | Easy |
| Email | REST API | **Resend** (raw `fetch`, no SDK) | Easy |
| Error Tracking | — | **None wired** — `handleError` logs structured JSON ([ops/logging.md](./ops/logging.md)) | — |
| Analytics | Web Analytics | **Vercel Analytics** | Easy |
| Log Aggregation | JSON logs | **Vercel Logs** | Easy |
| Background Jobs | Own registry: `setInterval` in containers, HTTP crons on Vercel | **None** (in-repo) | — |
| Notifications | Own router + outbox | **None** (in-repo) | — |
| Push | Web Push (VAPID) | **`web-push`** (library, no vendor) | Easy |

No image-generation or audio/STT provider is wired — [ai/ai-sdk.md](./ai/ai-sdk.md) is the source of truth for the AI provider set.

**Swappability:**
- **Easy** — Standard protocol/API, drop-in replacement
- **Medium** — Some code changes, but contained
- **Hard** — Deep integration, significant refactor

---

## Cost Summary

| Provider | Free Tier | Paid Starts At | Notes |
|----------|-----------|----------------|-------|
| **Groq** | 14,400 req/day | $0.05/1M tokens | Fastest inference, Llama 3.3 70B |
| **OpenAI** | None | ~$0.15/1M input tokens (gpt-4o-mini) | Pay-as-you-go only |
| **Google AI** | Per-model daily quotas (e.g. embeddings ~1,000 req/day, flash ~20 req/day) | Gemini API pricing | Quotas tracked live on `/admin/ai` |
| **Neon** | 0.5 GB, 100 CU-hours/mo | $19/mo | Sleeps after 5min inactivity |
| **Vercel** | 100 GB bandwidth/mo | $20/mo | Hobby tier, 1 concurrent build |
| **Koyeb** *(planned)* | 1 service, 512MB RAM | $5.50/mo | Nano instance, no credit card for free |
| **Cloudflare R2** | 10 GB, 10M reads, 1M writes | $0.015/GB/mo | Zero egress fees |
| **Upstash** | 500K cmd/mo, 256MB | $0.20/100K cmd | Archived after 14d inactivity |
| **Neo4j Aura** | 200K nodes, 400K relationships | $65/mo | Free tier is generous |
| **Resend** | 100 emails/day (3K/mo) | $20/mo | 50K emails/mo |
| **Vercel Analytics** | Included | - | Cookieless, no extra cost |

**Estimated total at free tier:** $0/mo
**Estimated at ~10K MAU:** $50-150/mo (depends on usage patterns)

---

## Compliance

| Provider | GDPR | DPA Available | EU Region | SOC 2 |
|----------|------|---------------|-----------|-------|
| **Groq** | Yes | Yes | No (US) | Yes |
| **OpenAI** | Yes | Yes | No (US) | Yes |
| **Google AI** | Yes | Yes | No (US) | Yes |
| **Neon** | Yes | Yes | Yes | Yes |
| **Vercel** | Yes | Yes | Edge (global) | Yes |
| **Cloudflare** | Yes | Yes | Yes | Yes |
| **Upstash** | Yes | Yes | Yes (EU) | Yes |
| **Neo4j Aura** | Yes | Yes | Yes | Yes |
| **Resend** | Yes | Yes | No | In progress |

All providers have Data Processing Agreements (DPAs) available. See [gdpr.md](./capabilities/gdpr.md) for compliance checklist.

---

## Provider Details

### AI Providers (Multi-Provider Architecture)

We use a **multi-provider architecture** with Vercel AI SDK — chat routes across three providers (fallback + quota spreading), embeddings use one. There is no image-generation or audio provider. [ai/ai-sdk.md](./ai/ai-sdk.md) is the source of truth; live quota state renders on `/admin/ai`.

```
┌─────────────────────────────────────────────────────────────┐
│                    Vercel AI SDK (unified API)              │
├──────────────────────────────────────┬──────────────────────┤
│                 Chat                 │      Embeddings      │
│  Groq · OpenAI · Google (routing)    │   Google Gemini      │
└──────────────────────────────────────┴──────────────────────┘
```

#### Groq (Chat)

**What:** Ultra-fast LLM inference
**Technology:** Vercel AI SDK (`@ai-sdk/groq`), model `llama-3.3-70b-versatile`

| Feature | Details |
|---------|---------|
| Free tier | 14,400 req/day |
| Speed | 300+ tokens/sec |
| Streaming | Native support via AI SDK |
| Credit Card | Not required for free tier |

#### OpenAI (Chat)

**What:** Chat fallback lane
**Technology:** Vercel AI SDK (`@ai-sdk/openai`), model `gpt-4o-mini`

| Feature | Details |
|---------|---------|
| Free tier | None — pay-as-you-go |
| Role | Reliability lane when Groq/Google quotas exhaust |

#### Google Gemini (Chat + Embeddings)

**What:** Chat lane plus the embeddings provider for all RAG surfaces
**Technology:** Vercel AI SDK (`@ai-sdk/google`), models `gemini-2.5-flash` (chat) and `gemini-embedding-001` (embeddings, 1536-dim)

| Feature | Details |
|---------|---------|
| Free tier | Per-model daily quotas (flash ~20 req/day; embeddings ~1,000 req/day) |
| Quota reality | Small free quotas 503 under load — the admin quota board tracks them honestly |

**Alternatives (embeddings):**
| Provider | Trade-off |
|----------|-----------|
| Mistral | EU-based, 1024-dim, large free quota |
| Voyage AI | 50M tokens/mo, highest quality |
| Cohere | 1K req/mo (limited) |

**Migration:** Each provider is independent. Change in `src/lib/server/ai/providers.ts`. See [blueprint/ai/README.md](../blueprint/ai/README.md). Note: switching the embeddings provider/dimensions invalidates every stored vector — a full re-ingest, not a config change.

---

### Neon

**What:** Serverless PostgreSQL hosting
**Technology:** PostgreSQL 16+

| Feature | Details |
|---------|---------|
| Branching | Database branches for preview deploys |
| Autoscaling | Scale to zero, scale up on demand |
| Connection pooling | Built-in, PgBouncer-compatible |
| Extensions | Most common extensions available |

**Alternatives:**
| Provider | Trade-off |
|----------|-----------|
| Supabase | Includes auth, storage, realtime; heavier |
| Railway | Simpler, no branching |
| PlanetScale | MySQL only |
| Self-hosted | Full control, ops burden |

**Neon-specific features (not portable):**
- Database branching
- Autoscaling to zero
- Instant point-in-time recovery

**Migration:** Standard `pg_dump`/`pg_restore`. Change `NEON_DATABASE_URL_PROD`.

---

### Vercel

**What:** App hosting and edge network
**Technology:** Node.js runtime (SvelteKit)

| Feature | Details |
|---------|---------|
| Edge Network | Global CDN, automatic |
| Runtime | Node.js 22 (`nodejs22.x` in `svelte.config.js`; Bun runtime doesn't support SvelteKit) |
| Preview Deploys | Per-PR deployments |
| Analytics | Built-in, cookieless |

**Alternatives:**
| Provider | Trade-off |
|----------|-----------|
| Koyeb | Native Bun, container-based |
| Netlify | Similar, different edge functions |
| Railway | Container-based, more control |
| Cloudflare Pages | Cheaper, Workers runtime |

**Vercel-specific features (not portable):**
- `adapter-vercel` optimizations
- Vercel Analytics integration
- Preview deploy comments

**Migration:** Change adapter, update CI/CD, migrate env vars.

---

### Koyeb (planned — no deployment exists yet)

**What:** Container hosting with native Bun support, evaluated as the container target
**Technology:** Docker containers

| Feature | Details |
|---------|---------|
| Bun Runtime | Native, not Node.js compatibility |
| Free Tier | 1 service, 512MB RAM, 0.1 vCPU |
| Credit Card | Not required for free tier |
| Regions | Frankfurt, Washington D.C. (free) |

**Free Tier Limits:**
| Resource | Limit |
|----------|-------|
| Services | 1 web service |
| RAM | 512 MB |
| CPU | 0.1 vCPU |
| Storage | 2 GB SSD |
| Bandwidth | 100 GB/mo (not currently charged) |

**Alternatives:**
| Provider | Trade-off |
|----------|-----------|
| Vercel | Better DX, no native Bun |
| Railway | $5/mo minimum, better resources |
| Render | 750 hours/mo, sleeps after 15min |
| Fly.io | No free tier anymore |

**Koyeb-specific features (not portable):**
- Koyeb dashboard and CLI
- Auto-deploy from Git

**Migration:** Dockerfile is portable. Change registry and deploy target.

---

### Cloudflare R2

**What:** S3-compatible object storage
**Technology:** S3 API

| Feature | Details |
|---------|---------|
| Egress | Zero cost (unique) |
| CDN | Built-in, global |
| S3 Compatible | Drop-in replacement |
| Workers | Edge compute integration |

**Alternatives:**
| Provider | Trade-off |
|----------|-----------|
| AWS S3 | Industry standard, egress fees |
| Backblaze B2 | Cheap, needs CDN pairing |
| Supabase Storage | Integrated with Supabase |
| MinIO | Self-hosted S3 |

**R2-specific features (not portable):**
- Zero egress pricing
- Cloudflare CDN integration

**Migration:** Change endpoint URL and credentials. Same S3 SDK.

---

### Upstash

**What:** Serverless Redis over HTTP REST
**Technology:** Redis (`@upstash/redis`, `@upstash/ratelimit`)

| Feature | Details |
|---------|---------|
| Transport | HTTP/REST — works in all serverless and edge runtimes |
| Auto-pipelining | Batches concurrent commands into one HTTP request |
| Rate limiting | `@upstash/ratelimit` built-in (sliding window, fixed window) |
| Free tier | 500K commands/month, 256MB storage, 10K req/sec |

**Alternatives:**
| Provider | Trade-off |
|----------|-----------|
| Vercel KV | Upstash under the hood, vendor-locked API, deprecated for new projects (2024) |
| Redis Cloud | TCP only — not serverless-compatible |
| Self-hosted Redis | No persistent state in serverless |
| Dragonfly | Redis-compatible, self-hosted only |

**Upstash-specific features (not portable):**
- HTTP REST transport
- Built-in rate limiting SDK
- Database archiving after 14d inactivity (free tier)

**Migration:** Standard Redis commands. Change client to `ioredis` or `redis` if moving to TCP.

---

### Neo4j Aura

**What:** Managed Neo4j graph database
**Technology:** Neo4j (Cypher queries)

| Feature | Details |
|---------|---------|
| Free Tier | 200K nodes, generous |
| Managed | Automatic backups, updates |
| Cypher | Standard query language |

**Alternatives:**
| Provider | Trade-off |
|----------|-----------|
| Self-hosted Neo4j | Full control, ops burden |
| Amazon Neptune | AWS integrated, different query language |
| Dgraph | GraphQL native, different model |
| EdgeDB | Postgres-based graph, newer |

**Aura-specific features (not portable):**
- Managed backups
- Web console

**Migration:** Export with `neo4j-admin dump`, import to new instance.

---

### Resend

**What:** Transactional email API
**Technology:** SMTP / REST API

| Feature | Details |
|---------|---------|
| API | Simple REST, good DX |
| React Email | JSX email templates |
| Deliverability | Good reputation |

**Alternatives:**
| Provider | Trade-off |
|----------|-----------|
| SendGrid | Larger, more features |
| Postmark | Best deliverability |
| AWS SES | Cheapest at scale, more setup |
| Mailgun | Good API, owned by Sinch |

**Resend-specific features (not portable):**
- React Email integration
- Resend-specific SDK methods

**Migration:** Change SDK, update API key. Email templates are portable.

---

### Capabilities served without a vendor

| Capability | How it works instead | Where |
|------------|----------------------|-------|
| Error tracking | `handleError` mints an errorId and logs structured JSON to the console (Vercel Logs aggregates) — no Sentry/SDK | [ops/logging.md](./ops/logging.md) |
| Background jobs | Own job registry — `setInterval` schedulers in containers, authenticated HTTP crons on Vercel; no Inngest | [../blueprint/deployment.md](../blueprint/deployment.md) |
| Notifications | Own router + outbox over email (Resend REST) and Web Push; no Novu | [notifications/README.md](./notifications/README.md) |
| Web Push | `web-push` library with self-generated VAPID keys — no FCM account | [capabilities/pwa.md](./capabilities/pwa.md) |

Managed alternatives for these (Sentry, Inngest, Novu, Trigger.dev, …) were considered and remain viable swap-ins; the decision records live in the linked blueprint docs.

---

## Local Development

There are **no local service containers** — dev runs against the same remote services as production, by construction (one database per stack; see [../foundation/development-environment.md](../foundation/development-environment.md)). Mute-gates (`ANALYTICS_DEV_TRACKING`, `JOBS_DEV_ENABLED`) keep a dev process from polluting production data lanes, and tests run fully hermetic (PGlite in-memory Postgres, mocked Neo4j/R2, injected Redis fakes — credentials are scrubbed in the vitest setup).

| Production | In dev | In tests |
|------------|--------|----------|
| Neon | Same remote DB | PGlite (WASM, in-memory) |
| Neo4j Aura | Same remote instance | `vi.mock` |
| Cloudflare R2 | Same remote bucket | `vi.mock` |
| Upstash Redis | Same remote instance | Injected fakes |
| Vercel | `vite dev` in the container | n/a |
| Resend | Same API (real sends) | `vi.mock` |

---

## Environment Variables

| Variable | Provider | Purpose |
|----------|----------|---------|
| `GROQ_API_KEY` | Groq | Chat API key |
| `OPENAI_API_KEY` | OpenAI | Chat fallback API key |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google AI | Chat + embeddings API key |
| `NEON_DATABASE_URL_PROD` | Neon | Postgres connection (app's own var, not the ecosystem-standard `DATABASE_URL`) |
| `NEO4J_URI` | Neo4j Aura | Graph connection |
| `NEO4J_USERNAME` | Neo4j Aura | Graph auth |
| `NEO4J_PASSWORD` | Neo4j Aura | Graph auth |
| `R2_ACCOUNT_ID` | Cloudflare | Account ID (endpoint derived: `https://{id}.r2.cloudflarestorage.com`) |
| `R2_ACCESS_KEY_ID` | Cloudflare | S3 auth |
| `R2_SECRET_ACCESS_KEY` | Cloudflare | S3 auth |
| `R2_BUCKET_NAME` | Cloudflare | Bucket name |
| `UPSTASH_REDIS_REST_URL` | Upstash | Redis REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash | Redis REST auth token |
| `RESEND_API_KEY` | Resend | Email auth |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | — (self-generated) | Web Push signing |
| `CRON_SECRET` | — (self-generated) | Vercel cron endpoint auth |

---

## Adding New Vendors

Before adding a new vendor:

1. [ ] Check GDPR compliance page
2. [ ] Verify DPA availability
3. [ ] Evaluate free tier limits
4. [ ] Assess swappability (prefer standard protocols)
5. [ ] Add to this document
6. [ ] Update [gdpr.md](./capabilities/gdpr.md) compliance table
7. [ ] Document in relevant capability file

**Prefer vendors that:**
- Use standard protocols (S3, SMTP, PostgreSQL)
- Offer generous free tiers
- Have self-hosted alternatives
- Provide EU data residency
