# Provider & Model Routing

How the orchestrator selects a provider per turn — and why it matters for tool reliability.

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

`markCooldown(providerId, durationMs = 60_000)` / `isCooledDown(providerId)` in `providers.ts`. Rate-limited providers cool down for 60 seconds. The cooldown map lives in-process and resets on restart.

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
- `src/lib/server/ai/providers.ts` — resolver implementations
- `src/lib/server/ai/tool-leak-guard.ts` — leak guard implementation
- `src/lib/server/ai/chat-orchestrator.ts` — `wantsTools` logic, `deskTools` guard
