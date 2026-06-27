---
name: perf-middleware
description: Velociraptor middleware/request-pipeline performance — hooks.server.ts handle + sequence(), per-request session validation (Better Auth), Upstash Redis in the hot path, rate limiter placement, chain ordering, transformPageChunk cost. Use when editing the handle chain, session/auth middleware, or rate limiting. Project-truth guardrail. (project)
---

# Middleware Performance (v10r)

The per-request pipeline: `hooks.server.ts` `handle` + `sequence()`, session resolution, Upstash rate limiting, locale/style injection, security headers. Runs on **every dynamic request**. A **guardrail and gap-map**.

**Prime directive: measure before you optimize.** The tell is dashboard math — if Redis/DB call counts exceed request counts, middleware is doing unconditional work. Instrument each handler with `Server-Timing`.

## Contents

- [Invariants (don't break)](#invariants-dont-break)
- [Levers (stack-specific)](#levers-stack-specific)
- [Gotchas that bite](#gotchas-that-bite)
- [Already in v10r](#already-in-v10r)
- [Resolved (2026-06-27)](#resolved-2026-06-27)
- [Out of scope](#out-of-scope)
- [Measure](#measure)
- [References](#references)

## Invariants (don't break)

| Rule | Why |
|------|-----|
| `handle` skips static/prerendered assets but runs on **internal subrequests** | Use `event.isSubRequest` to skip double auth/tracing work on `load`-issued same-origin fetches. |
| **Cheap rejects first**: clientIp → rate-limit (IP) → … → session | If rate-limit rejects, the expensive session DB query never runs. |
| Session in `event.locals` **once**, gated behind a route check | Never call `getSession()` again in load functions (2–4 DB hits/page otherwise). |
| Cookie-token **fast path** before `getSession()` | Check raw `better-auth.session_token` presence; short-circuit unauth requests with `user: null` and **zero DB hit**. Already in `sessionPopulate` — load-bearing, do not remove. |
| Rate limiter at **module scope**, not inside `handle` | That is what makes the in-memory ephemeral cache persist across warm invocations → **0 Redis calls** for known-blocked IPs. v10r does this. |
| `transformPageChunk` callback must be **cheap** | It runs per HTML chunk. Hoist all computation (accent/CSS derivation) outside it. v10r does this. |
| `Cache-Control: no-store, private` on authed + all `/api` responses, set in hooks | Prevents CDN/browser caching user data (the SvelteSpill class). v10r does this. |

## Levers (stack-specific)

- **Fixed window** for global rate limiting (2 Redis cmds/call) vs **sliding window** for sensitive endpoints (4–5 cmds). v10r uses sliding window on `/api/auth/*` — correct, those are sensitive.
- **Region co-locate Upstash with `iad1`** — cross-region REST adds ~60–100ms to *every* gated request vs ~1–5ms same-region. Biggest single middleware lever, and it's a config check.
- **Don't enable rate-limit analytics globally** — +1 `ZINCRBY` per `limit()` call.
- **`building` guard** on every handler that touches external services (v10r does) — skips work during SSG/prerender.

## Gotchas that bite

- **Unconditional `getSession()`** on every route (incl. public/health/favicon) = a DB hit per request. Gate it on route.
- **Better Auth cookie cache is ON** (`maxAge=300`) — `getSession()` is DB-free for the 5-min window, so it is **not** the per-authed cost. Its trade-offs are accepted, not bugs to route around: revocation lags by up to `maxAge`, and the expired-JWE logout (#10021) is a known upstream edge. The real per-authed DB hit was the `listActiveGrantKinds` query — now path-gated (see Resolved).
- **favicon/asset paths matching dynamic routes** cause parameter pollution + wasted DB queries (kit#3748).
- **`sequence()` is serial by design** — independent async handlers each add their latency. A `parallel()` (`Promise.all`) wrapper collapses truly-independent ones; keep `sequence()` only where order matters (rate-limit must reject before session).

## Already in v10r

Cookie-token fast-path short-circuit; module-scope limiters with ephemeral cache; hoisted `transformPageChunk`; `no-store, private` on auth/`/api`; `building` guards; two-limiter (per-IP then per-account) 2FA sequence (deliberate security, not a perf bug).

## Resolved (2026-06-27)

> The per-request DB debt logged here is now fixed in-tree. Kept as a record of what changed.

1. **Per-authed session round-trip — DONE / never the real cost.** Better Auth's cookie cache **is enabled** (`session.cookieCache.enabled=true, maxAge=300` in `auth/index.ts`), so `getSession()` is DB-free for 5 min — the Redis-secondary-storage "fix candidate" was moot. The actual per-authed hit was the `listActiveGrantKinds` query in `sessionPopulate`; it is now **path-gated** — grants are only queried when the path includes `/blog` or `/desk`, else `event.locals.grants = []` (admins bypass via `isAdmin`, so `[]` is safe). See `hooks.server.ts` (`sessionPopulate`).
2. **`loadStyle` DB calls — DONE.** `getBrandConfig` is module-cached and `getCustomPaletteById` has a 60 s TTL (warm = 0 DB), and `style/brand.ts` now caches the **null** result (a `resolved` flag) so "no brand row" no longer re-queries Neon every request. `loadStyle` also early-returns on `/api/` paths and `event.isSubRequest` (`hooks.server.ts`), so it never runs for routes that don't render HTML.

## Out of scope

Rate-limit algorithm theory, Vercel function memory/timeout limits → link out. Route-response cache header tiers → [[perf-api]] / [[perf-backend]]. Session schema → [[perf-database]].

## Measure

Wrap each handler's expensive work in `performance.now()`, accumulate on `event.locals`, emit `Server-Timing` after `await resolve(event)` (the post-resolve position of `securityHeaders` is the natural place). Compare Redis/DB call counts to request counts in the Upstash/Neon dashboards.

## References

- Skills: [[better-auth]], [[security]], [[sveltekit]]
- `src/hooks.server.ts`, `src/lib/server/api/rate-limit.ts`, `docs/blueprint/middleware.md`
