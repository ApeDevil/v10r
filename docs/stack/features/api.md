# API & Services

## What is it?

API patterns and external service integrations for the application. Combines SvelteKit's native capabilities with specialized providers for AI, email, analytics, and background jobs.

## What is it for?

- REST APIs and server actions (SvelteKit native)
- API documentation (OpenAPI/Scalar)
- Background job processing
- Email, analytics, error tracking

## Why was it chosen?

| Service | Technology | Provider | Why |
|---------|------------|----------|-----|
| API Style | REST + Server Actions | SvelteKit | Framework-native |
| API Docs | OpenAPI | Scalar | Modern UI, spec-driven |
| Analytics | Web Analytics | Vercel | Cookieless, zero config |
| Errors | Sentry SDK | Sentry | 5K errors/mo free |
| Email | SMTP/API | Resend | 100 emails/day free |

**Background jobs:**
| Complexity | Technology | Use Case |
|------------|------------|----------|
| Default | Server Actions | Fast, no deps |
| Async | QStash | Fire-and-forget (500 msg/day free) |
| Complex | Inngest | Multi-step, retries, cron (25K runs/mo) |

**Use jobs when:** Task takes 5+ seconds, needs cron, or needs retries.

## Known limitations

**Server actions:**
- Max execution time varies by platform (10s Vercel free, 60s Pro)
- No native retry mechanism
- No scheduling

**External services:**
- Each adds a vendor dependency
- Free tiers have limits
- Must handle failures gracefully

**API documentation:**
- Requires manual schema maintenance
- OpenAPI spec can drift from implementation

**Free tier limits:**
| Service | Limit |
|---------|-------|
| Analytics | Included with Vercel |
| Sentry | 5K errors/mo |
| Resend | 100 emails/day |
| QStash | 500 msg/day |
| Inngest | 25K runs/mo |

## Related

- [../ai/ai-sdk.md](../ai/ai-sdk.md) - AI integration
- [../i18n/svelte-i18n.md](../i18n/svelte-i18n.md) - Internationalization
- [../ops/logging.md](../ops/logging.md) - Error tracking
