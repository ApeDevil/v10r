# Provider & Model Routing

How the orchestrator selects a provider per turn — and why it matters for tool reliability.

> Entry edges are the three per-surface routes (`/api/ai/chatbot` · `/api/ai/deskbot` · `/api/ai/showcase/rag`) behind the shared `guardAiRequest`; all reach the one `orchestrateChat`. The surface picks the *tool set*, but provider selection below is surface-agnostic — `wantsTools` is what flips chat-only vs. tool-capable. See [surfaces.md](./surfaces.md).

---

## Two resolvers

The orchestrator calls two separate resolver functions from `src/lib/server/ai/providers.ts`:

| Resolver | When used | Default order |
|----------|-----------|---------------|
| `resolveActiveProvider` | Chat-only turns | user pref → `AI_PROVIDER` env → first configured |
| `resolveToolProvider` | Tool-calling turns | user pref → `AI_PROVIDER` env → OpenAI → Google → others |

`resolveToolProvider` filters to `ProviderEntry.supportsTools === true` and then prefers OpenAI over Google because those providers reliably emit structured `tool_calls` fields. All three configured providers carry `supportsTools: true`, but Groq/llama can drift (see below).

---

## `wantsTools` — what triggers the tool provider

```typescript
const wantsTools = !!toolScopes?.length || !!useLlmwiki || !!useRetrieval;
```

Previously only desk `toolScopes` triggered the tool provider. The llmwiki and rawrag retrieval branches now also set `wantsTools` because they attach their own retrieval tools (`get_llmwiki_pages`, `get_rawrag_chunks`, `search_catalog`). Without the tool provider, those tool calls silently fail to fire.

Separately, `deskTools` is only built when there are actual desk scopes — retrieval branches claim the tool model but bring their own tools and pass no desk scopes.

---

## Circuit breaker

`markCooldown(providerId, durationMs = 60_000)` / `isCooledDown(providerId)` / `getCooldownResumeAt(providerId)` in `providers.ts`. Rate-limited providers cool down for 60 seconds. Tripped at the 429 stream-error sites in the orchestrator.

Storage is Redis (`ai:cooldown:{id}`), so the three functions are **async** and the breaker is **cross-instance** — a cooldown set by one serverless instance is honored by all, and survives cold starts. (It was previously an in-process `Map`, per-instance, reset on restart.)

**Symmetric in-memory fallback.** Redis is the source of truth, but an in-memory map mirrors it so the breaker still works when Redis is unreachable:

- `markCooldown` **always** writes the in-memory map (not only when Redis is null), so a cooldown is recorded even if the Redis write later fails.
- `cooldownResumeMs` consults the in-memory map on a Redis **read** error — it fails toward "cooled" rather than treating an unreachable Redis as "available". A provider that just rate-limited us is not retried just because the breaker's backing store hiccupped.

Fallback rotation in `tryFallback()` skips any cooled-down provider and skips non-tool-capable providers when `wantsTools` is true.

---

## Groq/llama textual tool-call drift

`llama-3.3-70b-versatile` probabilistically emits a tool call as plain assistant text instead of a structured `tool_calls` field:

```
<function=search_catalog>{"query": "Button component"}</function>
```

The AI SDK never sees a `tool_calls` field, so `execute()` never runs and the raw markup would appear to the user as the "answer".

### `tool-leak-guard.ts`

`src/lib/server/ai/tool-leak-guard.ts` provides two safeguards:

- **`createToolLeakGuard(onLeak?)`** — a `streamText` `experimental_transform`. Buffers the leading text of each step, detects known leak markers (`<function=`, `<function(`, `<tool_call>`, `<|python_tag|>`, etc.), and drops the rest of the step's text if a leak is confirmed. Normal turns incur at most a few characters of buffering.

- **`stripTextualToolCall(text)`** — sibling for `onFinish`. Blanks the full text if it starts with a leak marker, so the leak isn't persisted as the assistant message.

Per-step state resets on `start-step` / `finish-step`, so a leak in step N never gags step N+1.

**What the guard does NOT do:** it does not make the model call tools correctly. A suppressed leak turn degrades to empty (the model can be re-prompted) instead of leaking syntax. Reliable grounding requires a tool-reliable provider.

---

## Provider quota & limits (observability)

Per-provider quota is **unknowable** for our key types: no usage API, the AI SDK drops `x-ratelimit-*` headers on streaming, and Gemini's free-tier daily limit is undocumented and unstable (silently cut ~250→~20 RPD in Dec 2025; the real wall is ~10 RPM, not RPD). So the admin board is a **reference + availability board**, not a precise gauge. It never shows a fake `0` or exact remaining count.

Three inputs, served by `buildProviderQuota()` in `quota.ts` (single source for both the page loader and the poll endpoint):

| Input | Source | Meaning |
|-------|--------|---------|
| Documented ceilings | `provider-limits.ts` (`PROVIDER_LIMITS`) | Hand-maintained static rpd/rpm/tpm per provider, each with `rpdConfidence`, `verifiedOn`, and `sourceUrl`. Rots — editors bump `verifiedOn` on re-check. |
| Estimated usage | `getProviderUsageToday()` (`conversation_step` `COUNT(*)` for the UTC day) + Redis daily counters | A **lower bound**, not exact. Counters track the two quota signals `conversation_step` can't see: 429 hits and embedding calls. |
| Live signals | Circuit-breaker cooldown state | Truthful "rate-limited now" flag. |

**Embeddings share the Gemini key.** `gemini-embedding-001` (`rawrag/embed.ts`) uses the same `GOOGLE_GENERATIVE_AI_API_KEY` as Gemini chat, so it consumes the same provider quota but is invisible to `conversation_step`. Counted separately in Redis so the board reflects it.

Served at `GET /api/admin/ai/quota` (admin-guarded, `no-store`, own rate-limit bucket; never makes a real generation call). Surfaced as `QuotaPanel.svelte` on the admin Models tab plus a headroom strip on Overview.

---

## UI-message stream frame ordering

A `createUIMessageStream` branch that writes `message-metadata` (live pipeline-viz events) **before** `writer.merge(textResult.toUIMessageStream())` splits one assistant turn into **two** messages on the client: the pre-`start` metadata is attached to a provisional message, then the merged stream's own `start` carries a different `messageId`, so the client appends a second message and orphans the first (empty) one. The symptom is a visible empty duplicate bubble on every answer.

**The rule:** there must be exactly one `start` per turn, written before any metadata.

Pattern used in the `useLlmwiki` and `useRetrieval` branches:

```typescript
execute: async ({ writer }) => {
  const assistantMsgId = crypto.randomUUID();        // hoist to the top
  writer.write({ type: 'start', messageId: assistantMsgId }); // open the frame FIRST
  // ...emit({ type: 'message-metadata', ... }) freely after this...
  writer.merge(textResult.toUIMessageStream({ sendStart: false })); // suppress the merge's own start
}
```

Bonus: reusing `assistantMsgId` for the merged stream makes the client message id equal the persisted DB `assistantMsgId`.

| Where metadata is written | Result |
|---------------------------|--------|
| Before the merge, no leading `start` | Split — empty duplicate bubble |
| After an explicit leading `start` | One message (the `useLlmwiki` / `useRetrieval` fix) |
| Inside `onStepFinish` (after the stream's own `start`) | One message (the desk branch — always correct) |

`tryFallback` (merge-only, no metadata) and the desk/non-retrieval branches were always correct — they write no metadata before the merge, or write it after `start` via `onStepFinish`.

---

## Practical consequences

| Scenario | Provider used | Grounding reliability |
|----------|--------------|----------------------|
| Chat-only (no tools) | Chat model (any configured) | N/A |
| Desk tools only | Tool provider (OpenAI → Google → others) | Reliable |
| `useLlmwiki` / `useRetrieval` (catalog + RAG tools) | Tool provider (OpenAI → Google → others) | Reliable |
| Only Groq configured, tool turn | Groq (only option) | `tool-leak-guard` suppresses drift; no reliable grounding |
| Groq on cooldown, OpenAI available | OpenAI | Reliable |

Configure at least one of `OPENAI_API_KEY` or `GOOGLE_GENERATIVE_AI_API_KEY` for reliable tool-calling. `GROQ_API_KEY`-only deployments get guarded degradation (no leak, no reliable grounding).

---

## Related

- [layered-rag.md](./layered-rag.md) — `search_catalog` tool, catalog grounding, citation chips
- `src/lib/server/ai/providers.ts` — resolver + Redis cooldown implementations
- `src/lib/server/ai/quota.ts`, `provider-limits.ts`, `provider-usage.ts` — quota board serializer, documented ceilings, Redis counters
- `src/lib/server/ai/tool-leak-guard.ts` — leak guard implementation
- `src/lib/server/ai/chat-orchestrator.ts` — `wantsTools` logic, `deskTools` guard
