---
name: perf-api
description: Velociraptor API/endpoint performance — SSE/AI-SDK streaming on Vercel (maxDuration, frame ordering, no-buffering), HTTP caching tiers, keyset vs OFFSET pagination, payload/compression, auth-endpoint cache rules. Use when writing +server.ts endpoints, streaming chat, pagination, or cache headers. Project-truth guardrail. (project)
---

# API Performance (v10r)

`+server.ts` endpoints + AI SDK v6 SSE streaming on Vercel serverless. A **guardrail and gap-map**.

**Prime directive: measure before you optimize.** TTFB, time-to-first-token (`onChunk` timestamp), the `x-vercel-cache` header, `Server-Timing`. HTTP caching is the single biggest lever for public GETs — reach for it before anything clever.

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
| `export const config = { maxDuration: N }` on **every** `+server.ts` that streams an LLM | The default kills the stream early (~10s). The #1 production streaming failure. |
| **No Cloudflare proxy** in front of Vercel SSE | CF buffers `text/event-stream` and dumps it as one blob. If unavoidable: `Content-Encoding: identity` + `Cache-Control: no-transform`. |
| **Node runtime**, not Edge, for thinking models | Edge severs the connection at 25s without a first byte. |
| AI SDK v6 frame order: open the frame **yourself**, write metadata **after** | `writer.write({type:'start', messageId})` then `toUIMessageStream({sendStart:false})`. Metadata-before-merge splits one answer into two messages (ghost bubble). v10r fixed this. |
| `Cache-Control: private, no-store` on **every authenticated** `+server.ts` | Don't rely on cookie presence to prevent caching (strip-at-proxy + back-nav JSON bleed, kit#9780). |
| SSE headers: `text/event-stream`, `Cache-Control: no-cache`, `X-Accel-Buffering: no`, + heartbeat keepalive | Prevents intermediary buffering; keeps the connection alive. v10r does this. |

## Levers (stack-specific)

- **HTTP caching (biggest lever for public GETs)** — three tiers: `Cache-Control` (browser), `CDN-Cache-Control` (Vercel + downstream), `Vercel-CDN-Cache-Control` (Vercel only). Vercel **strips `s-maxage` from `Cache-Control`** before the browser — use the tiered headers for split browser/CDN TTLs. Cacheable only if: GET/HEAD, no `Authorization`, no `Set-Cookie`, no `private/no-store`, <10MB (20MB streaming).
- **`s-maxage=1, stale-while-revalidate=59`** for near-real-time public data (zero-config on Vercel).
- **ETag + `If-None-Match`** → `304` (no body) for polling clients.
- **Keyset over OFFSET** — OFFSET scans and discards every prior row (8ms vs 8s at page 10k). Composite cursor `(created_at, id)` with the PK as tiebreaker (non-unique sort columns break single-key cursors). Ban OFFSET above ~50k rows.
- **Compression** — Brotli/gzip auto for `application/json` on Vercel; **server-to-server** callers must send `Accept-Encoding` themselves.
- **Response shaping** — return only rendered fields; compounds with compression and parse cost.

## Gotchas that bite

- **Stream cut at ~10s** without `maxDuration` (most common; works locally, fails on deploy).
- **`+server.ts` GET sharing a path with `+page.js`** → browser caches the JSON, back-nav shows raw JSON (kit#9780). Add `no-store`.
- **`stop()` + resumable streams are mutually exclusive** (vercel/ai#8390) — use a separate cancel endpoint that persists the partial + clears the stream key.
- **Whole conversation re-sent every turn** by `useChat` → token cost grows linearly. Truncate/summarize server-side. Token counts are reliable only in `onFinish` (abort skips it — vercel/ai#8088).
- **4.5MB** request/response body cap on non-streaming functions (413 otherwise).

## Already in v10r

SSE heartbeat + hard timeout + global concurrency cap (`notifications/stream`, `analytics/stream`); NDJSON ingest stream (`retrieval/ingest/stream`); cursor + offset pagination helper (`api/pagination.ts`); granular cache headers (SWR on blog media, `s-maxage` on sitemap/feed, `no-store` on admin/sensitive); AI-SDK frame-ordering fix; `429` + `Retry-After`.

**Gaps:** `maxDuration` only on some routes — audit all streaming endpoints; the pagination helper still defaults to **OFFSET** — flip the default to keyset for growth tables.

## Out of scope

MDN `Cache-Control` directive table, ETag/Last-Modified syntax, DataLoader N+1 mechanics, Server-Timing trailer limits → link out. DB-side query/index perf → [[perf-database]]. Hooks-level header application → [[perf-middleware]].

## Measure

TTFB + time-to-first-token (record `Date.now()` in the AI SDK `onChunk` first-chunk callback). `x-vercel-cache` (`HIT|MISS|STALE|BYPASS`) is the cheapest cache-effectiveness signal. `Server-Timing` for server-side attribution. `useChat`'s `experimental_throttle: 50` batches client re-renders (React-only today).

## References

- Skills: [[api-design]], [[ai-tools]], [[nrag]]
- `src/lib/server/api/pagination.ts`, `src/routes/api/**/stream/+server.ts`
