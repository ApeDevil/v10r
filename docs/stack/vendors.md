# Vendors & Providers

All external services used by Velociraptor. This separates **what technology** we use from **who provides** it.

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
| Relational DB | PostgreSQL | **Neon** | Easy |
| Graph DB | Neo4j | **Neo4j Aura** | Medium |
| Object Storage | S3 API | **Cloudflare R2** | Easy |
| App Hosting | Bun + SvelteKit | **Vercel** | Medium |
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
| **Neon** | 0.5 GB, 100 CU-hours/mo | $19/mo | Sleeps after 5min inactivity |
| **Vercel** | 100 GB bandwidth/mo | $20/mo | Hobby tier, 1 concurrent build |
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
**Technology:** Node.js / Bun runtime

| Feature | Details |
|---------|---------|
| Edge Network | Global CDN, automatic |
| Bun Runtime | Native support via adapter |
| Preview Deploys | Per-PR deployments |
| Analytics | Built-in, cookieless |

**Alternatives:**
| Provider | Trade-off |
|----------|-----------|
| Netlify | Similar, different edge functions |
| Railway | Container-based, more control |
| Fly.io | Global containers, more ops |
| Cloudflare Pages | Cheaper, Workers runtime |
| Self-hosted | Docker + reverse proxy |

**Vercel-specific features (not portable):**
- `adapter-vercel` optimizations
- Vercel Analytics integration
- Preview deploy comments

**Migration:** Change adapter, update CI/CD, migrate env vars.

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
| `DATABASE_URL` | Neon | Postgres connection |
| `NEO4J_URI` | Neo4j Aura | Graph connection |
| `NEO4J_USER` | Neo4j Aura | Graph auth |
| `NEO4J_PASSWORD` | Neo4j Aura | Graph auth |
| `R2_ENDPOINT` | Cloudflare | S3 endpoint |
| `R2_ACCESS_KEY_ID` | Cloudflare | S3 auth |
| `R2_SECRET_ACCESS_KEY` | Cloudflare | S3 auth |
| `R2_BUCKET` | Cloudflare | Bucket name |
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
