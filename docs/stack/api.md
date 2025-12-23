# API & Services

API patterns, external services, background jobs, and i18n.

## Services

| Layer | Choice | Why |
|-------|--------|-----|
| API Style | **REST + Server Actions** | SvelteKit-native |
| API Docs | **Scalar** | OpenAPI spec, modern UI |
| Analytics | **Vercel Analytics** | Cookieless, zero config |
| Error Tracking | **Sentry** | 5K errors/mo free |
| Email | **Resend** | 100 emails/day free |

## Background Jobs

| Layer | Choice | Why |
|-------|--------|-----|
| Default | **SvelteKit server actions** | Fast, simple, no deps |
| Simple async | **Upstash QStash** | Fire-and-forget, 500 msg/day free |
| Complex | **Inngest** | Multi-step, retries, cron, 25K runs/mo free |

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
