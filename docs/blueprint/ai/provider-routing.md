# Provider & Model Routing

Where provider configuration lives, how the orchestrator selects a provider per turn — and why it matters for tool reliability.

> Entry edges are the two per-surface routes (`/api/ai/chatbot` · `/api/ai/deskbot`) behind the shared `guardAiRequest`; both reach the one `orchestrateChat`. The surface picks the *tool set*, but provider selection below is surface-agnostic — `wantsTools` is what flips chat-only vs. tool-capable. See [surfaces.md](./surfaces.md).

---

## Provider connections

Provider configuration is **administrator-managed and persisted**, not environment-based. The
admin connects each vendor under **Admin → AI → Models** (`/admin/ai/models`): enable it, set its
generation model id, enter its API key, test, save. Nothing about providers is read from `.env`
— `GROQ_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY` and `AI_PROVIDER` no longer
exist. `ENCRYPTION_KEY` stays a deployment secret: the database cannot protect its own key.

| Piece | Where | What it owns |
|---|---|---|
| Table `ai.provider_connection` | `db/schema/ai/provider-connection.ts` | One row per vendor: `enabled`, `model_id`, `api_key_ciphertext`, `is_default`, `version`, `updated_at/by`. Absent row = never configured. Constraints: at most one default (partial unique index); a default must be enabled with a key (CHECK). |
| Reads/writes | `db/ai/provider-connections.ts` | Ciphertext in, ciphertext out. Every write is a compare-and-swap on `version`; moving the default is a two-statement transaction. Takes the `Database` explicitly so bare-Bun scripts can call it. |
| Encryption | `security/aes-gcm.ts` + `security/encryption-key.ts` | AES-256-GCM with the key supplied by the caller; `encryption-key.ts` is the single `ENCRYPTION_KEY` read. Same envelope format as the Discord tokens. |
| Registry | `ai/connections.ts` → `resolveProviderRegistry(rows, key)` | Decrypts, derives capabilities from the **model id** (`model-capabilities.ts`), builds `ProviderEntry` values whose `getInstance()` closes over the key. A key that will not decrypt marks the entry `undecryptable` and the registry `degraded` — never "empty". |
| Composition | `ai/index.ts` → `loadProviderRegistry()` | The app-side door: `db` + `getEncryptionKey()`. Called at the **start of every AI operation** (the entry guard, page loads, embeddings, vision) and threaded through resolution, so a save reaches the next operation on every instance with no cache to invalidate. No registry exists at import time. |
| Admin operations | `ai/connection-settings.ts` | Save / remove key / set default / test: encrypt → guarded write → best-effort audit (`ai.provider.*`), with discriminated results the route maps to form feedback. |
| Connection test | `ai/connection-test.ts` | One `generateText` with a fixed prompt, tiny output cap, 8 s timeout, no retries. Classified into `ok / invalid_key / model_not_found / rate_limited / timeout / network / unknown`; the provider's text never leaves the server. Proves key + model; proves nothing about tools or vision. |
| Projection | `PublicProviderConnection` | The only shape that crosses to a client: `hasKey` / `keyStatus`, never a key or ciphertext. `security/load-leak-gate.test.ts` refuses `apiKeyCiphertext` in any client-facing file. |

**Capabilities belong to the model, not the vendor.** `capabilitiesFor(provider, modelId)` keeps the
known families (llama-3.x / gpt-oss on Groq: tools, no vision; gpt-4o / 4.1 / 5 and Gemini 1.5+:
both). An unrecognized id is treated as text-only — it can answer chat turns but the tool and
vision resolvers skip it — and the admin page says so. A connection test cannot prove either
capability.

**Embeddings ride the Google connection**, whatever the generation default: choosing Groq or
OpenAI for chat does not switch off search. Disabling Google, or removing its key, disables
embeddings. The registry opens that key once with everything else and exposes it as
`registry.embeddingConnection()` (a closure, never a field), which a request threads into every
embed of its turn — the chatbot's shared query vector, a page-seeded retrieve,
`search_project_docs`, the context probe — so one request reads the provider rows exactly once.
Callers without a registry (`generateEmbedding` / `retrieve` from a script, a showcase, the
ingest path) fall back to `loadEmbeddingConnection()` → `resolveEmbeddingConnection`, the same
rule read from the rows. The embedding model and dimensions
stay `retrieval-shared/embed-config.ts` constants — stored vectors belong to that model, and a
different one is a re-embedding operation, not a setting.

**Failure is reported, never papered over.** An unreadable table is `AiError('unavailable', …, 'SETTINGS_UNREADABLE')`
→ 503 `ai_unavailable`; a degraded registry → 503 with a configuration message; there is no
environment fallback. The admin page itself renders without a working provider or table so an
operator can always reach the form.

**Bare-Bun scripts** (`scripts/db/ingest-docs.ts`, `seed-llmwiki.ts`, `seed-silly.ts`) read the
same saved Google connection through `db/ai/provider-connections.ts` + `ai/connections.ts` by
relative path (both are alias-free; `ai/connections.test.ts` walks the closure), decrypting with
`process.env.ENCRYPTION_KEY`. Missing or unusable configuration prints a secret-free reason and
exits 1 before any corpus write.

---

## Three resolvers

The orchestrator calls the resolver functions from `src/lib/server/ai/providers.ts`, each over
the registry the operation loaded:

| Resolver | When used | Order |
|----------|-----------|-------|
| `resolveActiveProvider` | Chat-only turns | user pref → project default → first connected |
| `resolveToolProvider` | Tool-calling turns | user pref → project default → OpenAI → Google → others |
| `resolveVisionProvider` | Image input | user pref → project default → Google → OpenAI |

Precedence at the facade (`getActiveProvider(registry, userId, override)`): explicit request
override → the user's stored preference → the administrator's **project default** (or Automatic)
→ the capability order. A preference or override is honoured only if it names a provider that is
enabled, decrypts, and has the capability the turn needs; otherwise it falls through.

`resolveToolProvider` filters to `capabilities.tools` and then prefers OpenAI over Google because those providers reliably emit structured `tool_calls` fields. Groq/llama carries the flag but can drift (see below).

---

## `wantsTools` — what triggers the tool provider

```typescript
const wantsTools = !!toolScopes?.length || !!useLlmwiki || !!useRetrieval;
```

Previously only desk `toolScopes` triggered the tool provider. The llmwiki and retrieval retrieval branches now also set `wantsTools` because they attach their own retrieval tools (`get_llmwiki_pages`, `get_source_chunks`, `search_catalog`). Without the tool provider, those tool calls silently fail to fire.

Separately, `deskTools` is only built when there are actual desk scopes — retrieval branches claim the tool model but bring their own tools and pass no desk scopes.

---

## Circuit breaker

`markCooldown(providerId, durationMs = 60_000)` / `isCooledDown(providerId)` / `getCooldownResumeAt(providerId)` in `providers.ts`. Rate-limited providers cool down for 60 seconds. Tripped through one door per branch in the orchestrator (`coolProvider`): the chatbot branch cools from the streaming helper's `onAttemptFailure`, which fires exactly once per failed attempt with the provider's own error (retry or final); the desk branch and the pre-stream `catch` cool from their classified error. The kind comes from `classifyAiError`, which reads an `APICallError`'s **status** (429 → `rate_limit`, 401/403 → `authentication`, 404 → `model`, 408 → `timeout`, 5xx → `unavailable`) and classifies the SDK's generic `NoOutputGeneratedError` as `unknown` — never by substring, so a model 404 or a bad tool schema no longer cools the provider as a rate limit.

**What a model call carries.** Every `streamText` of a turn (primary, rotated fallback, pre-stream fallback, desk) is given `modelCallSignal(cancellation)`: the turn's cancellation — the client stopped listening (`http/cancellation.ts`: the response body's `cancel()` joined with `request.signal`) — plus its own 30 s `AbortSignal.timeout`, minted per call because a timeout signal is single-use. The SDK answers a fired signal with an `abort` part; the streaming helper reads it as one of two things. The turn's cancellation: no rotation, no error frame, no cooldown — what streamed is persisted, `onCancellation` logs it. Any other abort is the call's own deadline: a `timeout` failure, rotated before content, `turnError` after it. A Stop is therefore never mistaken for a provider fault, and a provider that needs 30 s for a first token still rotates. A stream that closes cleanly with **no content at all** (Gemini 2.5 Flash answers some tool-mounted turns with `finishReason: stop` and nothing in it) is the third shape: an `EMPTY_ANSWER` failure of kind `unavailable`, rotated like any content-less failure — never a silent empty message.

Storage is Redis via `resilience/breaker.ts` (key `breaker:ai-provider:{id}`), so the three functions are **async** and the breaker is **cross-instance** — a cooldown set by one serverless instance is honored by all, and survives cold starts. (It was previously an in-process `Map`, per-instance, reset on restart.)

**Symmetric in-memory fallback.** Redis is the source of truth, but an in-memory map mirrors it so the breaker still works when Redis is unreachable:

- `markCooldown` **always** writes the in-memory map (not only when Redis is null), so a cooldown is recorded even if the Redis write later fails.
- `cooldownResumeMs` consults the in-memory map on a Redis **read** error — it fails toward "cooled" rather than treating an unreachable Redis as "available". A provider that just rate-limited us is not retried just because the breaker's backing store hiccupped.

A turn's fallback pool is every configured connection minus the one the turn is already on — not "everything but the chat provider": a tool-routed turn starts on Google while the chat provider is the registry's first connection (Groq), and excluding it left Google + Groq with no rotation at all. Rotation (`streamTextIntoOpenMessage` for the chatbot, `tryFallback()` for the desk) skips any cooled-down provider and skips non-tool-capable providers when the turn mounts tools.

---

## Groq/llama textual tool-call drift

`llama-3.3-70b-versatile` (Groq's default until its 2026-09 retirement; the bound below stays for any llama-family connection) probabilistically emits a tool call as plain assistant text instead of a structured `tool_calls` field:

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

Three inputs, served by `buildProviderQuota(registry)` in `quota.ts` (single source for both the page loader and the poll endpoint):

| Input | Source | Meaning |
|-------|--------|---------|
| Documented ceilings | `provider-limits.ts` (`PROVIDER_LIMITS`) | Hand-maintained static rpd/rpm/tpm per provider, each with `rpdConfidence`, `verifiedOn`, and `sourceUrl`. Rots — editors bump `verifiedOn` on re-check. |
| Estimated usage | `getProviderUsageToday()` (`conversation_step` `COUNT(*)` for the UTC day) + Redis daily counters | A **lower bound**, not exact. Counters track the two quota signals `conversation_step` can't see: 429 hits and embedding calls. |
| Live signals | Circuit-breaker cooldown state | Truthful "rate-limited now" flag. |

**Embeddings share the Google connection.** `gemini-embedding-001` (`retrieval/embed.ts`) uses the same saved Google key as Gemini chat, so it consumes the same provider quota but is invisible to `conversation_step`. Counted separately in Redis so the board reflects it.

**Ceilings are per model.** `PROVIDER_LIMITS` records which model ids its numbers were read for (`verifiedModels`); when the administrator points a connection at another model the board withholds the ceilings (`limitsVerified: false`) rather than letting a new model inherit an old one's quota as if checked. Unknown models likewise show unknown pricing in the cost views.

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

Connect OpenAI or Google Gemini (Admin → AI → Models) for reliable tool-calling. Groq-only deployments get guarded degradation (no leak, no reliable grounding).

---

## Related

- [layered-rag.md](./layered-rag.md) — `search_catalog` tool, catalog grounding, citation chips
- `src/lib/server/ai/connections.ts`, `connection-settings.ts`, `connection-test.ts`, `model-capabilities.ts` — saved connections → registry, admin operations, the probe, model capabilities
- `src/lib/server/ai/providers.ts` — resolvers + Redis cooldown implementations
- `src/lib/server/ai/quota.ts`, `provider-limits.ts`, `provider-usage.ts` — quota board serializer, documented ceilings, Redis counters
- `src/lib/server/ai/tool-leak-guard.ts` — leak guard implementation
- `src/lib/server/ai/chat-orchestrator.ts` — `wantsTools` logic, `deskTools` guard
