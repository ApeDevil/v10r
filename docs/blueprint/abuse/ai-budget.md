# AI Daily Token Budget

Per-user daily token cap that prevents cost-amplification abuse. A single authenticated user cannot exhaust the AI quota for all other users by running many expensive requests.

---

## Config (`$lib/server/config.ts`)

| Constant | Value | Note |
|----------|-------|------|
| `AI_DAILY_TOKEN_CAP` | `100_000` | Input + output tokens combined |

At current model prices this caps spend at roughly $1–2 per user per day on premium models.

---

## Redis Key Shape

```
ai:budget:{userId}:{YYYY-MM-DD}
```

TTL: **25 hours** (`TTL_SECONDS = 25 * 60 * 60`). The extra hour past midnight ensures the key is still readable in the final minutes of a UTC day regardless of clock skew between app instances.

The `{YYYY-MM-DD}` segment is derived from `new Date().toISOString().slice(0, 10)` — always UTC.

---

## API (`$lib/server/ai/budget.ts`)

### `checkUserBudget(userId)`

Call at request entry — before any expensive model invocation:

```typescript
import { checkUserBudget } from '$lib/server/ai/budget';

const budget = await checkUserBudget(userId);
if (!budget.allowed) return decisionResponse(budget);
```

Returns a `Decision`. On denial, `retryAfterMs` is set to milliseconds until UTC midnight so the client can show an accurate reset time.

**Redis-unavailable behavior:**

| Environment | Redis missing |
|-------------|---------------|
| Dev | Passthrough (always allowed) |
| Production | Denied — budget check unavailable is treated as over-limit |

### `chargeTokens(userId, tokens)`

Call in `streamText.onFinish` after the response completes:

```typescript
import { chargeTokens } from '$lib/server/ai/budget';

// Inside streamText.onFinish:
await chargeTokens(userId, usage.totalTokens);
```

Uses Redis `INCRBY` followed by `EXPIRE` to set the TTL on first write of the day.

---

## Check-Then-Charge Caveat (v1)

The gate and charge are not atomic. A burst of N parallel requests can each pass `checkUserBudget` before any has called `chargeTokens`. The daily total can overshoot by up to `N × AI_MAX_TOKENS` before the cap engages.

At current rates the worst-case overshoot is $0.20–0.50 — acceptable for v1. Upgrade to atomic pre-charge (reserve tokens before generation, reconcile after) if abuse data warrants it.

---

## `BOT_DETECTION_MODE` Interaction

The token budget does not read `BOT_DETECTION_MODE` — it is always enforced when Redis is available. The mode flag is scoped to the captcha layer only.

---

## Where Enforced

- **Shared AI entry guard** (`src/lib/server/ai/guard.ts`, `guardAiRequest`): `checkUserBudget` runs in the auth → `aiConfigured` → rate-limit → budget preamble shared by all three AI routes (`/api/ai/chatbot`, `/api/ai/deskbot`, `/api/ai/showcase/rag`), before `orchestrateChat`. On denial, returns `decisionResponse(budget)` (429).
- **Chat orchestrator** (`$lib/server/ai/chat-orchestrator.ts`): `chargeTokens(userId, inputTokens + outputTokens)` in `streamText.onFinish`.

The gate sits in the entry guard because the floating chatbot grounds every turn (forced tool-provider routing + per-turn retrieval), so the cost floor per request is higher — the budget is checked before any model work begins, and the single guard keeps the rejection identical across every AI route.

---

## Related

- [Live showcase](/showcases/abuse/ai-budget)
