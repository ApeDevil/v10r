# Logging

Structured logging for debugging, monitoring, and observability.

## Stack

| Layer | Technology | Provider | Why |
|-------|------------|----------|-----|
| Logger | **Pino** | Library | Fastest Node.js logger, structured JSON, low overhead |
| Error Tracking | **Sentry SDK** | [Sentry](./vendors.md#sentry) | Already in stack, integrates with Pino |
| Log Aggregation | **JSON stdout** | [Vercel Logs](./vendors.md#vercel) | Free with Vercel, zero config |

See [vendors.md](./vendors.md) for alternatives and costs.

## Why Pino

| Logger | Performance | Bundle | Structured | Notes |
|--------|-------------|--------|------------|-------|
| **Pino** | Fastest | ~100 KB | JSON native | Best for production |
| Winston | Slower | ~200 KB | Plugin-based | Heavier |
| Bunyan | Medium | ~150 KB | JSON native | Less maintained |
| Adze | Fast | ~15 KB | Yes | Universal (SSR/browser/Bun) |
| console.log | N/A | 0 KB | No | No levels |

Pino wins: 5x faster than Winston, native JSON, minimal overhead, Sentry integration.

**Alternative:** If Pino causes Bun bundling issues, use **Adze**.

## Setup

Install `pino` and `pino-pretty`. Configure in `src/lib/server/logger.ts` with environment-based levels. Use `pino-pretty` in dev for readable output.

Create child loggers with context for organized logging.

## Log Levels

| Level | When to Use |
|-------|-------------|
| `fatal` | App crash, unrecoverable error |
| `error` | Failed operation, needs attention |
| `warn` | Degraded state, potential issue |
| `info` | Significant events (login, purchase, deploy) |
| `debug` | Detailed flow for debugging |
| `trace` | Very verbose, rarely used |

**Production:** Set `LOG_LEVEL=info` (skip debug/trace)
**Development:** Set `LOG_LEVEL=debug`

## Structured Logging

Log objects, not string concatenation. Makes logs queryable.

### Standard Fields

| Field | Purpose | Example |
|-------|---------|---------|
| `context` | Source | `'auth'`, `'api'`, `'db'` |
| `userId` | User ID | `'usr_123'` |
| `requestId` | Request trace | `'req_abc'` |
| `duration` | Operation time (ms) | `145` |
| `err` | Error object | `{ message, stack }` |

## SvelteKit Integration

Add request logging in `hooks.server.ts`. Generate request ID, attach child logger to `event.locals`, log completion with method, path, status, duration.

Access via `locals.log` in routes for contextual logging.

## Sentry Integration

Pipe error and fatal logs to Sentry via Pino hooks or use Sentry's `pinoIntegration`.

## Production

Pino (JSON to stdout) → Vercel Runtime → Vercel Logs (1 hour). Add Axiom or Better Stack for longer retention. Send errors to Sentry.

### Aggregation Options

| Service | Technology | Free Tier | Retention |
|---------|------------|-----------|-----------|
| **Vercel Logs** | JSON ingestion | Included | 1 hour |
| **Axiom** | JSON ingestion | 500 GB/mo | 30 days |
| **Better Stack** | JSON ingestion | 1 GB/mo | 3 days |
| **Datadog** | JSON ingestion | Limited | 15 days |

Start with Vercel Logs. Add Axiom for longer retention.

All options use the same technology (structured JSON to stdout). Swappable by changing log drain destination.

## What to Log

### Always Log

- Authentication events (login, logout, failed attempts)
- Authorization failures (403s)
- Payment/transaction events
- External API calls (with duration)
- Database errors
- Background job start/complete/fail

### Never Log

- Passwords or secrets
- Full credit card numbers
- Personal health information
- Session tokens
- API keys

### Sanitization

Redact sensitive fields (password, token, secret, apiKey, creditCard) before logging.

## Environment Variables

| Variable | Values | Default |
|----------|--------|---------|
| `LOG_LEVEL` | `fatal`, `error`, `warn`, `info`, `debug`, `trace` | `info` (prod), `debug` (dev) |
| `NODE_ENV` | `development`, `production` | - |

## Checklist

- [ ] Pino installed and configured
- [ ] Logger in `src/lib/server/` (server-only)
- [ ] Request logging in `hooks.server.ts`
- [ ] Child loggers with context
- [ ] Sensitive data sanitization
- [ ] Sentry integration for errors
- [ ] Log level configured per environment
