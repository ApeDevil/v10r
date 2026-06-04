---
name: project-ai-budget-not-wired
description: checkUserBudget exists in budget.ts but is NOT called from POST /api/ai/chat — only the per-user rate limiter gates the endpoint
metadata:
  type: project
---

`checkUserBudget(userId)` (src/lib/server/ai/budget.ts:28) implements a per-user daily token cap (AI_DAILY_TOKEN_CAP, check-then-charge). `chargeTokens` IS called in streamText.onFinish, but `checkUserBudget` is NOT invoked anywhere in `src/routes/api/ai/**` — verified by grep (zero matches).

So `POST /api/ai/chat` is gated ONLY by the per-user rate limiter (createLimiter(RATE_LIMIT_PREFIX, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW), +server.ts:11,:20). The daily token budget is recorded but never enforced at request entry.

**Why it matters:** Enabling retrieval/llmwiki grounding on the floating Chatbot + desk ChatPanel multiplies cost per turn (embeddings + tool-capable provider routing). With budget unenforced, an authenticated user can drive cost past the daily cap. The budget.ts docstring already calls this out as a "v1 caveat" for the overshoot window, but here it's not wired at all.

**How to apply:** When expanding grounding to more surfaces, recommend wiring `checkUserBudget` into the chat route before orchestrateChat (it returns a Decision with a 429 + retryAfter already). Related: [[project-chat-surface-contract]].
