# Logging

Console-based logging with a structured error envelope. No logging library and no external error tracker are installed — what exists is deliberate, small, and honest.

## What actually exists

| Surface | Where | Shape |
|---------|-------|-------|
| Error envelope | `handleError` in `src/hooks.server.ts` | Mints a `crypto.randomUUID()` errorId and emits one structured JSON line (`errorId`, `status`, `path`, `route`, `message`, `stack`); the client gets `{ message, errorId }` only |
| Everything else | ~160 direct `console.error/warn/log` calls across server modules | Plain console lines, aggregated by Vercel Logs |
| Aggregation | **Vercel Logs** | Free, zero config |

There is no Pino, no Sentry, and no shared logger module — `handleError` is the only structured emission. If error volume ever justifies a tracker, wiring one starts at that single choke point.

What v10r has instead of log-based observability: vendor health panels (`src/lib/server/monitoring/{neon,neo4j,r2,upstash}.ts` → `/admin/db`), the perf observatory (`src/lib/server/perf/` → `/admin/perf`), MCP usage telemetry (`src/lib/server/mcp/telemetry/`), and AI cost accounting (`src/lib/server/ai/provider-usage.ts`).

## Known limitations

- **Vercel Logs:** 1-hour retention, no search/filter on free tier. Use Axiom or Better Stack for longer retention.

**Security requirements (load-bearing):**
- Never log passwords, API keys, session tokens, or full AI prompts/responses (PII risk, storage cost).
- AI logging: record tokens/costs, never message content.

## Related

- [deployment.md](./deployment.md) - Platform configuration
- [../ai/ai-sdk.md](../ai/ai-sdk.md) - AI request logging
- [../capabilities/api.md](../capabilities/api.md) - the error envelope contract
