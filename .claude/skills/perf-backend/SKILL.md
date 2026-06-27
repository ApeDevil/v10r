---
name: perf-backend
description: Velociraptor backend/server performance — SvelteKit load functions, waterfalls, streaming, rendering strategy (SSR/prerender/ISR), adapter-vercel, Vercel serverless cold starts, region pinning, Bun's real role. Use when writing load functions, choosing a render strategy, or tuning serverless. Project-truth guardrail. (project)
---

# Backend Performance (v10r)

SvelteKit 2 server on Vercel serverless (`nodejs22.x`), Bun in dev/build only. A **guardrail and gap-map**.

**Prime directive: measure before you optimize.** `Server-Timing` headers + the `x-vercel-cache` header + Vercel Observability (free) are the instruments. Attribute TTFB before touching anything.

## Contents

- [Invariants (don't break)](#invariants-dont-break)
- [Levers (stack-specific)](#levers-stack-specific)
- [Gotchas that bite](#gotchas-that-bite)
- [Already in v10r](#already-in-v10r)
- [Out of scope](#out-of-scope)
- [Measure](#measure)
- [References](#references)

## Invariants (don't break)

| Rule | Why |
|------|-----|
| `await parent()` **last**, after your own fetches start | Calling it first serializes layout + page loads into a waterfall. The #1 SvelteKit perf mistake. SvelteKit team won't fix; docs warn but don't solve. |
| Read `event.locals` directly for auth — don't `await parent()` for it | Avoids the waterfall above. `locals` is populated once in hooks (see [[perf-middleware]]). |
| Don't hand-serialize independent fetches | SvelteKit auto-parallelizes sibling loads; within one load use `Promise.all`. |
| Stream non-critical data | Return **unawaited promises** from server load; `{#await}` in the template. Keep critical (LCP) data awaited. Works on Vercel. |
| `runtime: 'nodejs22.x'`; single-function adapter default | Single function = fewer cold starts. Never `split: true` **with** the `reroute` hook (404s all localized routes on Vercel) — use `[[locale]]` catch-all. |
| Keep region `iad1` | Co-located with Neon `us-east-1`. Moving regions adds DB round-trip latency to every request. |

## Levers (stack-specific)

- **ISR for semi-static** (showcase, blog, docs lists): `export const config = { isr: { expiration: N } }` → CDN TTFB + request collapsing + 31-day durable cache + atomic global purge. **Never** for personalized/auth-gated responses. Beats bare `s-maxage`.
- **`prerender = true`** for fully static content → served from CDN, no function, no cold start.
- **Fluid Compute** (default since Apr 2025) — instance reuse + pre-warming cut cold starts. Note: bytecode caching is **CommonJS-only**, so SvelteKit (ESM) does *not* yet get that TTFB slice.
- **Bundle audit** — `VERCEL_ANALYZE_BUILD_OUTPUT=1`. 250 MB function limit; one stray import (e.g. `@playwright/test`) silently blew a function past 50 MB, no tree-shake rescue (kit#10430). Keep heavy/server-only code in `.server.ts`.
- **Bun is the process-runner, not the bundler** — Vite/Rollup bundles; prod runs Node. No production-runtime perf gains from Bun. Wins are `bun install` + dev startup only.

## Gotchas that bite

- **Cold starts** 2–7s reported on plain serverless; Fluid mitigates but there are no published SvelteKit-specific numbers. `sslnegotiation=direct` shaves ~120ms off cold DB connects (see [[perf-database]]).
- **`setHeaders` cache is unreliable** for client-side `__data.json` navigations (kit#7778); `invalidate()` doesn't reliably clear cached server loads (kit#7784). Prefer ISR config or hooks-level headers.
- **Edge runtime** — dead-code elimination does **not** strip Node imports from `hooks.server.ts`; keep Node runtime unless a route is verified Node-free.
- **`no-store` on auth** is a correctness/security rule, set in hooks — see [[perf-middleware]].

## Already in v10r

Parallel loads (`dashboard`, `desk/+layout.server.ts`); `Promise.all`; `nodejs22.x`; `maxDuration: 10` on AI/admin endpoints; `prerender = true` on `search-index` + primitives showcase; in-process TTL caches (admin flags, announcements); `[[locale]]` catch-all (reroute-safe).

**Gaps:** ISR unused — semi-static showcases run full SSR every hit; no `Server-Timing` instrumentation anywhere.

## Out of scope

Generic `Cache-Control` spec, V8/heap profiling → link out. The `Promise.all` pattern itself (SvelteKit auto-parallelism already covers siblings). Hooks pipeline → [[perf-middleware]]. Streaming/SSE contract → [[perf-api]]. DB query perf → [[perf-database]].

## Measure

`setHeaders({ 'Server-Timing': 'db;dur=42;desc="pg", auth;dur=5' })` in load → DevTools Network → Timing. `x-vercel-cache` header = `HIT|MISS|STALE|BYPASS`. Vercel Observability (free, all plans): function duration, error rate, ISR hit/miss.

## References

- Skills: [[sveltekit]], [[svelte5-runes]]
- `docs/stack/core/sveltekit.md`, `docs/stack/ops/deployment.md`
