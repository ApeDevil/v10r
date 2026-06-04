---
name: project-provider-quota-board-docs
description: where the admin provider-quota board + Redis circuit breaker are documented (provider-routing.md), and the honest-board rationale
metadata:
  type: project
---

Admin "Provider Resources & Limits" quota board (branch `meaning`, landed 2026-06-04) is documented in `docs/blueprint/ai/provider-routing.md` — the doc that already owns provider observability. No separate admin-AI-section doc exists in live blueprint; the admin AI surfaces are only catalogued in `docs/.archive/admin-expansion.md` (out of scope).

**Why:** provider-routing.md already held the resolver split + circuit breaker, so quota/limits observability is its natural home — avoids a sprawling new doc. Honest-board rationale (quota is unknowable: no usage API, AI SDK drops `x-ratelimit-*` on streaming, Gemini RPD undocumented/unstable, real wall is RPM) lives in the "Provider quota & limits (observability)" section.

**How to apply:** Future updates to the quota board / `PROVIDER_LIMITS` / `/api/admin/ai/quota` / `buildProviderQuota()` go to `provider-routing.md`. Cross-refs: AI `README.md` topic table + circuit-breaker line; `layered-rag.md` ceilings note (embedding-shares-the-Gemini-key fact); `system-abstraction.md` line ~349 provider-resolution clause.

Circuit breaker storage changed Map→Redis (`ai:cooldown:{id}`): now async (`markCooldown`/`isCooledDown`/`getCooldownResumeAt` all async) + cross-instance. It was ALREADY wired before this change — this changed storage only, did not newly wire it. Corrected the stale "in-process, resets on restart" line in provider-routing.md and the system-abstraction.md clause.

Key facts (verify against code before relying):
- `provider-limits.ts` = hand-maintained static `PROVIDER_LIMITS` (rpd/rpm/tpm, rpdConfidence, verifiedOn, sourceUrl) — rots; editors bump verifiedOn.
- `provider-usage.ts` = Redis daily counters for 429 hits + embedding calls (the two signals `conversation_step` can't see).
- `quota.ts` `buildProviderQuota()` = single source for both SSR loader and `GET /api/admin/ai/quota`.
- Embeddings (`gemini-embedding-001`) share `GOOGLE_GENERATIVE_AI_API_KEY` with Gemini chat → same quota, invisible to conversation_step.
- system-abstraction.md uses stale fn names `getActiveProvider`/`getToolProvider` (real: `resolveActiveProvider`/`resolveToolProvider`) — predates this feature, left alone (out of scope).
