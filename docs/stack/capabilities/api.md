# API & Services

API patterns and service integrations — SvelteKit-native REST + server actions, plus an in-app analytics collector, console-based error handling, Resend email, and a custom cron-driven job runner. See the `api-design` skill for contract patterns.

## Stack

| Concern | Technology | Provider |
|---------|------------|----------|
| API style | REST + server actions | SvelteKit (framework-native) |
| Analytics | In-app collector | `$lib/server/analytics/` + `/api/analytics/*` (server-side, consent-gated) |
| Errors | `handleError` hook | Console-only (`src/hooks.server.ts`); no external provider wired |
| Email | SMTP/API | Resend |

**Background jobs** — use when a task takes 5+ seconds, needs cron, or needs retries:

| Complexity | Technology | Use case |
|------------|------------|----------|
| Default | Server actions | Fast, no deps |
| Scheduled / async | Custom job runner | `$lib/server/jobs` (`runJob`) via the daily Vercel-cron sweep `/api/cron/due` (+ `/api/cron/[job]` by slug) |

## Known limitations

- **Server actions:** platform-bound max execution (10s Vercel free, 60s Pro); no native retry or scheduling.
- **Errors:** no external error provider (Sentry, etc.) wired — `handleError` only logs structured JSON to the console.

## Related

- [../ai/ai-sdk.md](../ai/ai-sdk.md) - AI integration
- [../i18n/paraglide.md](../i18n/paraglide.md) - Internationalization
- [../ops/logging.md](../ops/logging.md) - Error tracking
