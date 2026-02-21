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
| AI Chat | Vercel AI SDK | **Groq** | Easy |
| AI Embeddings | Vercel AI SDK | **Mistral** | Easy |
| AI Image Gen | Vercel AI SDK | **Together AI** | Easy |
| AI Audio/STT | Vercel AI SDK | **Groq** | Easy |
| Relational DB | PostgreSQL | **Neon** | Easy |
| Graph DB | Neo4j | **Neo4j Aura** | Medium |
| Object Storage | S3 API | **Cloudflare R2** | Easy |
| App Hosting | SvelteKit + Node.js | **Vercel** | Medium |
| App Hosting | SvelteKit + Bun | **Koyeb** | Easy |
| Email | SMTP/API | **Resend** | Easy |
| Error Tracking | Sentry SDK | **Sentry** | Easy |
| Analytics | Web Analytics | **Vercel Analytics** | Easy |
| Log Aggregation | JSON logs | **Vercel Logs** | Easy |
| Background Jobs | HTTP webhooks | **Inngest** | Medium |
| Notifications | Novu | **Novu Cloud** | Easy (self-host) |
| Push | Web Push | **FCM** | Medium |

**Swappability:**
- **Easy** — Standard protocol/API, drop-in replacement
- **Medium** — Some code changes, but contained
- **Hard** — Deep integration, significant refactor

---

## Cost Summary

| Provider | Free Tier | Paid Starts At | Notes |
|----------|-----------|----------------|-------|
| **Groq** | 14,400 req/day | $0.05/1M tokens | Fastest inference, Llama 3.3 70B |
| **Mistral** | 1B tokens/mo | $0.10/1M tokens | Embeddings included |
| **Together AI** | 3 months unlimited | ~$0.003/image | FLUX Schnell |
| **Neon** | 0.5 GB, 100 CU-hours/mo | $19/mo | Sleeps after 5min inactivity |
| **Vercel** | 100 GB bandwidth/mo | $20/mo | Hobby tier, 1 concurrent build |
| **Koyeb** | 1 service, 512MB RAM | $5.50/mo | Nano instance, no credit card for free |
| **Cloudflare R2** | 10 GB, 10M reads, 1M writes | $0.015/GB/mo | Zero egress fees |
| **Neo4j Aura** | 200K nodes, 400K relationships | $65/mo | Free tier is generous |
| **Resend** | 100 emails/day (3K/mo) | $20/mo | 50K emails/mo |
| **Sentry** | 5K errors/mo | $26/mo | 50K errors/mo |
| **Vercel Analytics** | Included | - | Cookieless, no extra cost |
| **Inngest** | 25K runs/mo | $50/mo | Step functions, retries |
| **Novu Cloud** | 30K events/mo | $25/mo | Self-host for free |

**Estimated total at free tier:** $0/mo
**Estimated at ~10K MAU:** $50-150/mo (depends on usage patterns)

---

## Compliance

| Provider | GDPR | DPA Available | EU Region | SOC 2 |
|----------|------|---------------|-----------|-------|
| **Groq** | Yes | Yes | No (US) | Yes |
| **Mistral** | Yes | Yes | Yes (EU-based) | Yes |
| **Together AI** | Yes | Yes | No (US) | Yes |
| **Neon** | Yes | Yes | Yes | Yes |
| **Vercel** | Yes | Yes | Edge (global) | Yes |
| **Cloudflare** | Yes | Yes | Yes | Yes |
| **Neo4j Aura** | Yes | Yes | Yes | Yes |
| **Resend** | Yes | Yes | No | In progress |
| **Sentry** | Yes | Yes | Yes | Yes |
| **Inngest** | Yes | Yes | Yes | Yes |

All providers have Data Processing Agreements (DPAs) available. See [gdpr.md](./gdpr.md) for compliance checklist.

---

## Provider Details

### AI Providers (Multi-Provider Architecture)

We use a **multi-provider architecture** with Vercel AI SDK, selecting the best provider for each AI capability while maximizing free tier usage.

```
┌─────────────────────────────────────────────────────────────┐
│                    Vercel AI SDK (unified API)              │
├──────────────┬──────────────┬──────────────┬───────────────┤
│    Chat      │  Embeddings  │    Image     │    Audio      │
│    Groq      │   Mistral    │  Together AI │  Groq Whisper │
└──────────────┴──────────────┴──────────────┴───────────────┘
```

#### Groq (Chat + Audio)

**What:** Ultra-fast LLM inference and speech-to-text
**Technology:** Vercel AI SDK (`@ai-sdk/groq`)

| Capability | Model | Free Tier |
|------------|-------|-----------|
| Chat | Llama 3.3 70B | 14,400 req/day |
| Audio/STT | Whisper Large v3 | 7,200 audio-sec/min |

| Feature | Details |
|---------|---------|
| Speed | 300+ tokens/sec (10x faster than competitors) |
| Streaming | Native support via AI SDK |
| Credit Card | Not required for free tier |

**Alternatives:**
| Provider | Trade-off |
|----------|-----------|
| Cerebras | Similar speed, different models |
| Google Gemini | Multimodal, but slower |
| OpenRouter | 30+ free models, lower limits |

#### Mistral (Embeddings)

**What:** Vector embeddings for semantic search and RAG
**Technology:** Vercel AI SDK (`@ai-sdk/mistral`)

| Capability | Model | Free Tier |
|------------|-------|-----------|
| Embeddings | mistral-embed | 1B tokens/mo |
| Chat (backup) | mistral-small | 1B tokens/mo (shared) |

| Feature | Details |
|---------|---------|
| Dimensions | 1024 |
| EU-based | Yes (GDPR-friendly) |
| Quality | Competitive with OpenAI |

**Alternatives:**
| Provider | Trade-off |
|----------|-----------|
| Google Gemini | 768 dimensions, included in chat tier |
| Cohere | 1K req/mo (limited) |
| Voyage AI | 50M tokens/mo, highest quality |
| Jina AI | 1M tokens/mo, no AI SDK support |

#### Together AI (Image Generation)

**What:** AI image generation with FLUX models
**Technology:** Vercel AI SDK (`@ai-sdk/togetherai`)

| Capability | Model | Free Tier |
|------------|-------|-----------|
| Image Gen | FLUX.1 Schnell | 3 months unlimited |
| Image Gen | FLUX.1 Dev | Pay-as-you-go |

| Feature | Details |
|---------|---------|
| Speed | ~1-2 sec per image |
| Quality | State-of-the-art (FLUX) |
| Resolution | Up to 1024x1024 |

**Alternatives:**
| Provider | Trade-off |
|----------|-----------|
| Replicate | 50 gen/mo free, more models |
| fal.ai | Fast, has free tier |
| Stability AI | Free for <$1M revenue orgs |

#### Provider Comparison Summary

| Capability | Provider | Free Tier | Why Chosen |
|------------|----------|-----------|------------|
| **Chat** | Groq | 14,400 req/day | Fastest, generous |
| **Embeddings** | Mistral | 1B tokens/mo | EU-based, massive quota |
| **Image** | Together AI | 3mo unlimited | Best free offer |
| **Audio** | Groq | 7,200 sec/min | Already using Groq |

**Migration:** Each provider is independent. Change in `src/lib/server/ai/providers.ts`. See [blueprint/ai/README.md](../blueprint/ai/README.md).

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

**Migration:** Standard `pg_dump`/`pg_restore`. Change `DATABASE_URL`.

---

### Vercel

**What:** App hosting and edge network
**Technology:** Node.js runtime (SvelteKit)

| Feature | Details |
|---------|---------|
| Edge Network | Global CDN, automatic |
| Runtime | Node.js 20 (Bun runtime doesn't support SvelteKit) |
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

### Koyeb

**What:** Container hosting with native Bun support
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

### Sentry

**What:** Error tracking and performance monitoring
**Technology:** Sentry SDK

| Feature | Details |
|---------|---------|
| Error Tracking | Stack traces, context |
| Performance | Transaction tracing |
| Releases | Deploy tracking |
| Alerts | Slack, email, webhooks |

**Alternatives:**
| Provider | Trade-off |
|----------|-----------|
| Bugsnag | Similar, different pricing |
| Rollbar | Similar features |
| LogRocket | Session replay focus |
| Self-hosted Sentry | Free, ops burden |

**Migration:** Change SDK initialization, update DSN.

---

### Inngest

**What:** Background jobs and workflows
**Technology:** HTTP webhooks + step functions

| Feature | Details |
|---------|---------|
| Step Functions | Multi-step workflows |
| Retries | Automatic with backoff |
| Cron | Scheduled jobs |
| Fan-out | Parallel execution |

**Alternatives:**
| Provider | Trade-off |
|----------|-----------|
| Trigger.dev | Similar, open-source |
| QStash (Upstash) | Simpler, fire-and-forget |
| BullMQ + Redis | Self-hosted, more control |
| Temporal | Enterprise, complex |

**Migration:** Rewrite workflow definitions. Core logic is portable.

---

## Local Development

All production services have local equivalents:

| Production | Local | Notes |
|------------|-------|-------|
| Neon | PostgreSQL (Docker) | `postgres:16-alpine` |
| Neo4j Aura | Neo4j (Docker) | `neo4j:5-community` |
| Cloudflare R2 | MinIO | S3-compatible |
| Vercel | `vite dev` | SvelteKit dev server |
| Resend | Mailpit | Local SMTP capture |
| Sentry | Console logging | Or self-hosted Sentry |

See [../blueprint/db/README.md](../blueprint/db/README.md) for container setup.

---

## Environment Variables

| Variable | Provider | Purpose |
|----------|----------|---------|
| `GROQ_API_KEY` | Groq | Chat + Audio API key |
| `MISTRAL_API_KEY` | Mistral | Embeddings API key |
| `TOGETHER_API_KEY` | Together AI | Image generation API key |
| `DATABASE_URL` | Neon | Postgres connection |
| `NEO4J_URI` | Neo4j Aura | Graph connection |
| `NEO4J_USERNAME` | Neo4j Aura | Graph auth |
| `NEO4J_PASSWORD` | Neo4j Aura | Graph auth |
| `R2_ACCOUNT_ID` | Cloudflare | Account ID (endpoint derived: `https://{id}.r2.cloudflarestorage.com`) |
| `R2_ACCESS_KEY_ID` | Cloudflare | S3 auth |
| `R2_SECRET_ACCESS_KEY` | Cloudflare | S3 auth |
| `R2_BUCKET_NAME` | Cloudflare | Bucket name |
| `RESEND_API_KEY` | Resend | Email auth |
| `SENTRY_DSN` | Sentry | Error tracking |
| `INNGEST_SIGNING_KEY` | Inngest | Webhook auth |

---

## Adding New Vendors

Before adding a new vendor:

1. [ ] Check GDPR compliance page
2. [ ] Verify DPA availability
3. [ ] Evaluate free tier limits
4. [ ] Assess swappability (prefer standard protocols)
5. [ ] Add to this document
6. [ ] Update [gdpr.md](./gdpr.md) compliance table
7. [ ] Document in relevant capability file

**Prefer vendors that:**
- Use standard protocols (S3, SMTP, PostgreSQL)
- Offer generous free tiers
- Have self-hosted alternatives
- Provide EU data residency
