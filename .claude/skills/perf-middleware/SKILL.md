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
- [Known gaps — pending task force](#known-gaps--pending-task-force)
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
- **Better Auth cookie cache** only avoids the DB for the first `maxAge` window; the expired-JWE bug logs users out (#10021), and revocation lags by `maxAge`. Redis **secondary storage** sidesteps both.
- **favicon/asset paths matching dynamic routes** cause parameter pollution + wasted DB queries (kit#3748).
- **`sequence()` is serial by design** — independent async handlers each add their latency. A `parallel()` (`Promise.all`) wrapper collapses truly-independent ones; keep `sequence()` only where order matters (rate-limit must reject before session).

## Already in v10r

Cookie-token fast-path short-circuit; module-scope limiters with ephemeral cache; hoisted `transformPageChunk`; `no-store, private` on auth/`/api`; `building` guards; two-limiter (per-IP then per-account) 2FA sequence (deliberate security, not a perf bug).

## Known gaps — pending task force

> Logged for a later fix taskforce. Documented here so the knowledge is co-located with the domain.

1. **Better Auth cookie cache is OFF** → a Postgres round-trip on **every authenticated request**. Fix candidate: Upstash **secondary storage** for sessions (Redis is already in the stack) — ~1–2ms vs 5–50ms Postgres, plus instant revocation. Avoids the cookie-cache bugs entirely.
2. **`loadStyle` runs 3rd in the chain (before auth)**, issuing up to 2 DB calls (`getBrandConfig` + `getCustomPaletteById`) on **every** request including unauth and `/api`. Fix candidate: move it after `sessionPopulate` and skip for `/api` paths.

## Out of scope

Rate-limit algorithm theory, Vercel function memory/timeout limits → link out. Route-response cache header tiers → [[perf-api]] / [[perf-backend]]. Session schema → [[perf-database]].

## Measure

Wrap each handler's expensive work in `performance.now()`, accumulate on `event.locals`, emit `Server-Timing` after `await resolve(event)` (the post-resolve position of `securityHeaders` is the natural place). Compare Redis/DB call counts to request counts in the Upstash/Neon dashboards.

## References

- Skills: [[better-auth]], [[security]], [[sveltekit]]
- `src/hooks.server.ts`, `src/lib/server/api/rate-limit.ts`, `docs/blueprint/middleware.md`
