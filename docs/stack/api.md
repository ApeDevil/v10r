# API & Services

API patterns, external services, background jobs, and i18n.

## Services

| Layer | Technology | Provider | Why |
|-------|------------|----------|-----|
| API Style | **REST + Server Actions** | SvelteKit | Framework-native |
| API Docs | **OpenAPI** | Scalar | Modern UI, spec-driven |
| Analytics | **Web Analytics** | [Vercel](./vendors.md#vercel) | Cookieless, zero config |
| Error Tracking | **Sentry SDK** | [Sentry](./vendors.md#sentry) | 5K errors/mo free |
| Email | **SMTP/API** | [Resend](./vendors.md#resend) | 100 emails/day free |

See [vendors.md](./vendors.md) for alternatives and migration guides.

## Background Jobs

| Layer | Technology | Provider | Why |
|-------|------------|----------|-----|
| Default | **Server Actions** | SvelteKit | Fast, simple, no deps |
| Simple async | **HTTP Webhooks** | Upstash QStash | Fire-and-forget, 500 msg/day free |
| Complex | **Step Functions** | [Inngest](./vendors.md#inngest) | Multi-step, retries, cron, 25K runs/mo free |

**Use jobs when:** task takes 5+ seconds, need cron, or need retries.

## i18n

| Layer | Choice | Why |
|-------|--------|-----|
| Library | **sveltekit-i18n** | Per-language lazy loading, scales to 10+ languages |
| Strategy | URL-based (`/en/`, `/de/`) | SEO-friendly, cacheable |

**Why sveltekit-i18n over Paraglide:**

| Aspect | sveltekit-i18n | Paraglide |
|--------|----------------|-----------|
| Loading | Per-language lazy | All bundled |
| 10+ Languages | ~1 KB/page | ~12+ KB/page |
| Type Safety | Partial | Full |

sveltekit-i18n wins for multi-language: true lazy loading, scales infinitely, no deps.

**Note:** For 2-5 languages, Paraglide offers better type safety.

## Free Tiers

| Service | Provider | Limit |
|---------|----------|-------|
| Analytics | Vercel Analytics | Included |
| Errors | Sentry | 5K/mo |
| Email | Resend | 100/day |
| Jobs | QStash | 500 msg/day |
| Workflows | Inngest | 25K runs/mo |

See [vendors.md](./vendors.md) for complete cost breakdown across all services.
