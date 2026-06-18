---
name: project-vision-provider-router-gap
description: AI provider router has supportsTools but NO supportsVision flag; Groq(llama-3.3) has no vision yet is the default — any vision flow must filter or it routes to a model that cannot see
metadata:
  type: project
---

The AI provider registry (`src/lib/server/ai/providers.ts`) routes by `supportsTools` only. There is NO vision capability flag.

**Why:** Groq (llama-3.3-70b) is provider index 0 and the default from `resolveActiveProvider`/`resolveToolProvider` fallback, but Groq has no vision. OpenAI (gpt-4o-mini) and Google (gemini-2.5-flash) are vision-capable. A naive image flow that reuses `resolveActiveProvider` or `resolveToolProvider` will hand an image part to a model that cannot process it.

**How to apply:** Any image/vision feature MUST add `supportsVision: boolean` to `ProviderEntry` + `PROVIDER_CONFIGS` and a `resolveVisionProvider(registry, preference)` that filters `p.configured && p.supportsVision` (preferred order: openai > google; never groq). Cooldown/budget/telemetry plumbing (`isCooledDown`, `markCooldown`+`incrProvider429` on rate_limit, `chargeTokens` on finish, `saveConversationStep` with providerId/modelId/durationMs) is already the established pattern and should be reused unchanged. Vision fallback rotation = same `getFallbackProviders` loop but filtered to vision-capable. Related: [[project_provider_quota_runtime]].
