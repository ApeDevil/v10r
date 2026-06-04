---
name: admin-json-endpoint-conventions
description: Canonical contract pattern for /api/admin/* JSON endpoints (envelope, auth guard, rate limit, cache headers)
metadata:
  type: project
---

The `/api/admin/*` surface has an established, consistent JSON-endpoint contract. New admin endpoints MUST follow it rather than inventing a new style.

**Why:** Velociraptor's multi-client-core philosophy — one error format per surface, stable shapes. `/api/admin/analytics/recent` and `/api/admin/grant-requests` already set the precedent; divergence is a contract bug.

**How to apply:**
- Envelope: `apiOk(data)` → `{ data: T }`; `apiError(status, code, message, fields?)` → `{ error: { code, message, fields? } }`. Both from `$lib/server/api/response.ts`. NEVER use SvelteKit `error()` in `+server.ts` (wrong shape).
- Auth: `guardApiAdmin(locals)` (returns `{ error: Response }` — check `if ('error' in guard) return guard.error`) OR `requireAdmin(locals)` (throws). Admin gate returns 404 not 403 on the page route; API guard returns 403.
- Rate limit: `createLimiter(prefix, max, window)` + `rateLimitResponse(reset)` from `$lib/server/api/rate-limit.ts`. 429 carries `Retry-After`. Fail-closed in prod if Redis down, passthrough in dev.
- Cache: live/polling endpoints set `setHeaders({ 'Cache-Control': 'no-store' })`.
- Config: `export const config = { runtime: 'nodejs22.x', maxDuration: 10 };`
- Polling response convention (analytics/recent): includes `serverTime: new Date().toISOString()` and a cursor/since field for delta polling.

Reusable AI domain fns for an AI admin surface: `getProviderStatuses()` (ai/showcase/queries), `getActiveProviderInfo()` / `providerRegistry` / `getActiveProvider` (ai/index), `getCooldownResumeAt(id)` / `isCooledDown(id)` / `getUserPreference(id)` (ai/providers), `verifyAIConnection()` (live latency probe — makes a real model call, keep OFF the fast poll path). Tool topology: `deskToolMeta` map ({risk, scope}) + `createDeskTools`/`buildRetrievalTools` branch logic in ai/tools/index.ts. See [[chat-surface-contract]].
