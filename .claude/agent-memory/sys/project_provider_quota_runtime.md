---
name: provider-quota-runtime
description: Runtime design for provider quota/rate-limit capability — circuit-breaker-to-Redis, A/B/hybrid data source, write/read sites
metadata:
  type: project
---

Runtime-shape decisions for a NEW "provider quota / rate-limit" capability (consult 2026-06-04, not yet built).

**Why:** The in-memory circuit breaker (`cooldowns = Map` in `providers.ts`) is per-instance and resets on Vercel cold start — a dead provider gets retried by every fresh lambda until each independently trips. Quota visibility was also missing. Provider rate-limit headers are unreliable for us (Groq omits RPD, Gemini gives none, streaming drops headers), so header-scraping is NOT a runtime signal.

**How to apply (the recommended runtime shape):**
- **Circuit breaker → Redis (highest-value change).** Move cooldown to `SET ai:provider:{id}:cooldown <resumeISO> EX 60`. Race-free by construction (blind SET, last-writer-wins, all writers set ~same resumeAt — no read-modify-write, unlike the budget counter's check-then-charge overshoot). One 503 cools the provider fleet-wide. Read cost = 1-2 Redis GETs per chat request, acceptable (budget check already hits Redis; LLM stream takes seconds). Keep the in-memory Map as a per-request L1 cache. Batch health-poll reads with MGET.
- **Data source = HYBRID, not A-or-B.** They answer different questions. A = Redis daily counter (counts attempts incl. failures, real-time, cheap read). B = SQL COUNT over `conversation_step` (counts SUCCESSFUL steps only — never failures, miscounts multi-step turns; but TTL-free, cross-instance for free, survives Redis loss). `getModelUsage` in `db/ai/admin-queries.ts` ALREADY implements B's shape — extend, don't rebuild. Surface both: A="requests sent (lower bound)", B="steps succeeded". A−B gap = failure/retry rate (free observability). Never collapse into one number.
- **Write site = provider resolution (getInstance → streamText), NOT onStepFinish/onFinish.** Provider RPD counts HTTP requests received incl. failures; only resolution-time increment sees failures. Increment per-provider per-attempt (fallback rotation groq→openai legitimately bumps two counters — correct, not a bug). Accept multi-step undercount; label A "turn-level lower bound."
- **Read path = rides the existing `/api/admin/ai/health` poll** (already the live cooldown poll). Seed first-paint from `load()`. B's reconciliation goes in page load (navigation-refresh), NOT the 60s poll (don't GROUP BY every poll). NEVER call verifyAIConnection / real generateText on this path (burns gemini ~20/day free tier, 503s live chat) — already prohibited.
- **Failure modes:** Redis-down → counter A no-ops, fall back to B for display, NEVER gate chat on counter (it's observability not a spend gate, unlike budget.ts which denies). Breaker Redis-down → fail OPEN (dead breaker shouldn't kill chat). Day-key TZ: budget.ts is UTC but gemini resets PT — gauge approximate near boundary (RESY to confirm per-provider reset TZ). Shared API key (other tooling) → A is a lower bound on provider-side consumption; label "requests WE sent."

Related: budget.ts is the cross-instance primitive to copy (UTC day-key + incrby + 25h TTL). See also [[project_ai_telemetry_asymmetry]] for the conversation_step persistence that makes B possible.
