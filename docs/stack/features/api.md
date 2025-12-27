# API & Services

API patterns, external services, background jobs, and i18n.

## Services

| Layer | Technology | Provider | Why |
|-------|------------|----------|-----|
| API Style | **REST + Server Actions** | SvelteKit | Framework-native |
| API Docs | **OpenAPI** | Scalar | Modern UI, spec-driven |
| AI / LLM | **Vercel AI SDK** | [Anthropic](./vendors.md#anthropic) | Streaming, provider-agnostic |
| Analytics | **Web Analytics** | [Vercel](./vendors.md#vercel) | Cookieless, zero config |
| Error Tracking | **Sentry SDK** | [Sentry](./vendors.md#sentry) | 5K errors/mo free |
| Email | **SMTP/API** | [Resend](./vendors.md#resend) | 100 emails/day free |

See [vendors.md](./vendors.md) for alternatives and migration guides.

**AI:** Streaming chat via `/api/chat`. Provider-agnostic with AI SDK. See [blueprint/ai/README.md](../blueprint/ai/README.md).

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
| Library | **svelte-i18n** | Active maintenance, FormatJS/ICU, lazy loading |
| Format | **ICU MessageFormat** | Industry standard, CLDR plural rules |
| Strategy | URL-based (`/en/`, `/de/`) | SEO-friendly, cacheable |

**Why svelte-i18n over alternatives:**

| Aspect | svelte-i18n | sveltekit-i18n | Paraglide |
|--------|-------------|----------------|-----------|
| Maintenance | Active (Oct 2024) | **Unmaintained** | Active |
| Loading | Per-language lazy | Per-language lazy | All bundled |
| Type Safety | Partial | Partial | Full |
| Pluralization | ICU (standard) | Custom syntax | ICU |

sveltekit-i18n is smaller (~4.6 KB vs ~14 KB) but unmaintained since July 2023. Building on abandoned software is technical debt.

**Note:** For 2-5 languages, Paraglide offers better type safety. For 10+, svelte-i18n's lazy loading is essential.

**Full details:** [core.md](./core.md#internationalization) (decision) and [blueprint/i18n.md](../blueprint/i18n.md) (implementation).

## Free Tiers

| Service | Provider | Limit |
|---------|----------|-------|
| Analytics | Vercel Analytics | Included |
| Errors | Sentry | 5K/mo |
| Email | Resend | 100/day |
| Jobs | QStash | 500 msg/day |
| Workflows | Inngest | 25K runs/mo |

See [vendors.md](./vendors.md) for complete cost breakdown across all services.
