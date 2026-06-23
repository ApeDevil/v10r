# Logging

Structured JSON logging with request tracing and error aggregation.

## Stack

| Component | Technology | Role |
|-----------|------------|------|
| Logger | **Pino** | JSON-native, fastest Node.js logger |
| Error tracking | **Sentry** | Alerting, stack traces |
| Aggregation | **Vercel Logs** | Free, zero config |

**Fallback:** if Pino causes Bun bundling issues, use Adze (universal: SSR/browser/Bun).

## Known limitations

- **Vercel Logs:** 1-hour retention, no search/filter on free tier. Use Axiom or Better Stack for longer retention.

**Security requirements (load-bearing):**
- Never log passwords, API keys, session tokens, or full AI prompts/responses (PII risk, storage cost).
- AI logging: record tokens/costs, never message content.

## Related

- [deployment.md](./deployment.md) - Platform configuration
- [../ai/ai-sdk.md](../ai/ai-sdk.md) - AI request logging
