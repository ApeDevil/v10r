# Logging

## What is it?

Structured logging strategy for debugging, monitoring, and observability. JSON-formatted logs with request tracing and error aggregation.

## What is it for?

- Request tracing with correlation IDs
- Error tracking and alerting
- Performance monitoring (request duration)
- AI usage tracking (tokens, costs)
- Audit logging (auth events, transactions)

## Why was it chosen?

| Component | Technology | Why |
|-----------|------------|-----|
| Logger | **Pino** | Fastest Node.js logger, JSON native |
| Error tracking | **Sentry** | Alerting, stack traces |
| Aggregation | **Vercel Logs** | Free, zero config |

**Pino comparison:**
| Logger | Performance | Bundle |
|--------|-------------|--------|
| Pino | Fastest (5x Winston) | ~100 KB |
| Winston | Slower | ~200 KB |
| Adze | Fast | ~15 KB |

**Alternative:** If Pino causes Bun bundling issues, use Adze (universal: SSR/browser/Bun).

**Log levels:**
| Level | Use Case |
|-------|----------|
| `fatal` | App crash, unrecoverable |
| `error` | Failed operation |
| `warn` | Degraded state |
| `info` | Significant events |
| `debug` | Detailed debugging |

## Known limitations

**Vercel Logs:**
- 1 hour retention only
- No search or filtering on free tier
- Consider external aggregators (Axiom, Better Stack) for longer retention

**Security requirements:**
- Never log: passwords, API keys, session tokens, credit cards
- Never log: full AI prompts/responses (PII risk, storage costs)
- Sanitize sensitive fields before logging
- AI logging: log tokens/costs, not message content

**Serverless challenges:**
- Logs may be lost if function crashes before flush
- Request IDs must be generated per-invocation
- No persistent log file access

## Related

- [deployment.md](./deployment.md) - Platform configuration
- [../ai/ai-sdk.md](../ai/ai-sdk.md) - AI request logging
