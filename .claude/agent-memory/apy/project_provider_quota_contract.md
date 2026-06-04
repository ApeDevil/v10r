---
name: provider-quota-contract
description: Contract decision for the admin AI provider-quota capability — new endpoint, honesty flags, one shared serializer
metadata:
  type: project
---

Provider quota / available-resources capability for the admin AI section. Contract chosen (not built yet) 2026-06-04.

**Decision: new `GET /api/admin/ai/quota`, NOT an extension of `/health`.**
**Why:** cost class differs — `/health` is pure in-memory/config (can't fail, ticks cooldown cheaply/frequently); quota needs a DB aggregate over `conversation_step`. Folding a costed DB scan into the free cooldown poll would couple them and let a DB hiccup blank out the cooldown signal `/health` was built to never lose. Separation also gives independent poll cadence (health ~15s, quota ~60s) and cache semantics. Both additive → no consumer breaks, no versioning decision.
**How to apply:**
- Response shape `ProviderQuota[]` + `serverTime` + `usageDegraded`. Each usage number is a `QuotaMetric { used: number|null, limit, remaining, source }` where `source: 'exact'|'estimated'|'unknown'`. HARD RULE: `used:null` ⟺ `source:'unknown'`; NEVER `used:0` for missing data (Gemini has no usage signal → unknown; our counter is a lower bound → estimated). UI keys rendering off the flag, never off value shape. `remaining` is server-computed, null if either operand null — client never does `limit-used` itself. Plus `limitsVerifiedAt` (ISO) + `limitsStale` (server policy, ~90d threshold).
- Countdowns ship as ABSOLUTE ISO (`resetAt` UTC-midnight, `cooldownUntil`), never relative seconds — client ticks locally vs `serverTime` (clock-skew safe). Same pattern `/health` already uses. `cooledDown`/`cooldownUntil` duplicated from /health on purpose (free in-memory reads, self-contained row).
- Headers: `no-store`, `runtime:'nodejs22.x'` (DB driver needs Node), `maxDuration:10`. SEPARATE rate-limit bucket `rl:admin:ai:quota` at 30/60s (lower than health's 60/60s) so a hammered quota poll can't exhaust the health budget and blind cooldown.
- ONE serializer `buildProviderQuota()` in `$lib/server/ai/quota.ts` (framework-free) feeds BOTH the page `load()` first-paint and the `+server.ts` poll → contract physically can't drift SSR vs endpoint. NB: the drift already exists today — `/health/+server.ts` and `models/+page.server.ts` hand-duplicate the provider mapping; worth collapsing into a shared helper.
- Per-provider DB aggregate `getProviderUsageToday()` (group `conversation_step` by `provider_id`, today-window) is DATY/SYS's to own — mirrors existing `getModelUsage` in db/ai/admin-queries.ts. `conversation_step.provider_id` exists (nullable on pre-capture rows), indexed via `conv_step_model_idx`.

Open for RESY/SCOUT: do Groq/OpenAI expose authoritative remaining-quota headers (→ could be 'exact', but read-only, never probe); home + ownership of static `PROVIDER_LIMITS` const; Redis counter vs SQL aggregate as usage source; dollar-cost mapping deferred.

See [[admin-json-endpoint-conventions]], [[ai-budget-not-wired]].
