# AI SDK 6 → 7 — migration record

**Maturity: built** on branch `claude/cloud/ai-sdk-v7` (validate + build green in the cloud
session, no provider key). Not `proven` until the live turns at the end of this page are
recorded. Decision: [AA13](../architecture/agentic-architecture/decision-record.md#aa13--ai-sdk-v7-is-a-prerequisite-on-its-own-branch);
plan: wave A′ in [plan.md](../architecture/agentic-architecture/plan.md).

## Versions

| Package | Before | After | Note |
|---|---|---|---|
| `ai` | 6.0.146 (`^6.0.0`) | **7.0.179** (exact) | 7.0.180/181 were younger than the 24 h `minimumReleaseAge` |
| `@ai-sdk/svelte` | **3.0.167** (`^3.0.0`) — the *v5* line, with its own nested `ai@5.0.167` | **5.0.179** | the browser chat client ran AI SDK 5 against a v6 server; now one `ai` copy for both |
| `@ai-sdk/google` | 3.0.62 | 4.0.124 | |
| `@ai-sdk/groq` | 3.0.35 | 4.0.86 | |
| `@ai-sdk/openai` | 3.0.52 | 4.0.122 | |
| `@ai-sdk/provider` | 3.0.8 (transitive) | 4.0.39 (explicit devDependency) | a test imports its types; it was never declared |
| `@ai-sdk/provider-utils` / `gateway` | 4.0.23 / 3.0.88 | 5.0.83 / 4.0.152 | transitive |

Not installed, read only: `@ai-sdk/otel` 1.0.179, `@ai-sdk/mcp` 2.0.103, `@ai-sdk/workflow` 2.x.
The migration guide read is the one the package ships:
`node_modules/ai/docs/08-migration-guides/23-migration-guide-7-0.mdx`, with the `7.0.0`
changelog entries.

## What broke, and how it was handled

41 type errors in 6 files (the throwaway probe counted 40 in 5 on 7.0.170; 7.0.179 adds one
in `generative-ui/compile-surface.test.ts`) and 1 failing test. Every deprecated name was
moved too — the repo keeps no compat layer.

| Change in v7 | Where it bit | Handling |
|---|---|---|
| The tool-execution-end event is `{ toolCall, toolExecutionMs, toolOutput: { type: 'tool-result', output } \| { type: 'tool-error', error } }` (was `durationMs`, `success`, `output`, `error`); renamed `onToolExecutionEnd` | `chat-orchestrator.ts`, both branches (11 errors) | Mapped to the same `recorder.tool()` record: `durationMs ← toolExecutionMs`, status from `toolOutput.type` |
| The provider spec is **V4**; `wrapLanguageModel` takes v2/v3/v4 and returns v4 (adapting older ones, which re-pipes their stream) | `trace/model-call-middleware.ts` only wrapped `specificationVersion === 'v3'` — every v7 provider would have gone unrecorded | Middleware declares `'v4'`; any model object of a spec the SDK adapts is wrapped; the test uses a v4 model (stream returned untouched) and proves a v3 model is recorded too |
| A tool `description` may be a function of the tool's `context` | `profile/manifest.ts` (1 error) | Resolved against an empty context, as `streamText` does for a tool with no `contextSchema` |
| `ToolExecutionOptions` requires `context` | 4 test files (29 errors) | `context: {}` in the test call options |
| `streamText` result `toUIMessageStream()` deprecated → stateless `toUIMessageStream({ stream })` | `_shared/streaming-turn.ts` | `pumpableTextResult(result, tools)` adapts a result to the helper's structural seam; `redactToolErrors: true` is pinned (v6's behaviour: the helper's `onError` keeps producing the classified text for a failed tool call). Its `text` / `usage` are getters: an aborted attempt that never asks must not leave a rejected promise unhandled |
| `usage` on the result is now the **sum of all steps** (`totalUsage` deprecated) | the budget charge and the trace's token rows | See *Usage semantics* |
| A model stream that ends with **no output and no `finish` part** rejects with `NoOutputGeneratedError` (v6 recorded an empty step) | `classifyAiError` puts that error in `unknown`, which never rotates | The helper maps it, when nothing was pumped, to the same `EMPTY_ANSWER` (`unavailable`) a clean empty stop gets — so it still rotates to the next provider. Test: *a stream that ends with no output and no finish rotates* |
| Renames: `system` → `instructions`, `stepCountIs` → `isStepCount`, `onStepFinish` → `onStepEnd`, `experimental_onStepStart` → `onStepStart`, `totalUsage` → `usage`, `result.providerMetadata` → `result.finalStep.providerMetadata`, `createGoogleGenerativeAI` → `createGoogle`, `GoogleGenerativeAIProviderOptions` → `GoogleLanguageModelOptions`, `MockLanguageModelV3` → `MockLanguageModelV4` | orchestrator, `imagemeta/extract.ts`, `image-kit/vision.ts`, `pim/recipe-proposal.ts`, `cycle/ai-handlers.ts`, `connections.ts`, `config.ts`, embed modules, ingest scripts, tests, two showcase labels | Renamed |
| `@ai-sdk/svelte` 5 and `ai` 7 share one `UIMessage` type | `chatbot-session.svelte.ts`, `desk-bot-session.svelte.ts` cast the transport and `addToolOutput` across the two copies | Casts removed |

Checked and unchanged for v10r:

- **System messages in `messages` are rejected by default.** The route schema already admits
  only `user` / `assistant` (`validation.ts`); the profile prompt goes in `instructions`.
- **`prepareStep` overrides carry forward** (messages, instructions). `answerOnLastStep` returns
  only `activeTools`, which does not carry; the step-budget tests pass unchanged. The
  execute-time compaction (`loop/compact.ts`) existed because v6 dropped `prepareStep` message
  edits; v7 keeps them, so that reason is gone — the pattern stays because it bounds a result
  once for the model, the stream and the trace.
- **`onChunk` now receives every part.** The first-token hook already filters by type.
- **Tool execution starts after the model call finishes** (changelog b9cf502). Tool durations
  are execution-only (876fd3e); the approval boundary still ends the loop on the step that asked.
- **Step `response.messages` holds only that step's messages.** v10r never reads it.
- **Telemetry is opt-out once an integration is registered.** v10r registers none, so no
  spans are emitted; see `@ai-sdk/otel` below.
- **Structured output** (`Output.object(jsonSchema(…))` in imagemeta, image-kit, PIM) and
  `result.output` are unchanged; the single-step calls' `usage` equals the step's.
- **Client tools** (execute-less, streamed to the browser, `addToolOutput`,
  `sendAutomaticallyWhen` continuation) keep their v5-era API in `ChatInit`; the desk session
  tests pass unchanged.
- **Groq tool-leak guard** stays an `experimental_transform` (not renamed in v7) over
  `TextStreamPart` text deltas (`text`, unchanged).

Known and not changed: a tool whose `execute` *throws* still reaches the helper's `onError`
(as in v6 — confirmed against `ai@6.0.168`'s `toUIMessageStream`), so the attempt is recorded as
failed and the message closes with a `turnError`, even when the model recovers in the next
step. v10r's tools return `{ error }` instead of throwing, so this does not fire today; making a
thrown tool error a tool outcome rather than an attempt failure is a separate change.

## Usage semantics

| Value | AI SDK 6 | AI SDK 7 | v10r reads it as |
|---|---|---|---|
| `onStepEnd` `step.usage` | one step | **one step** (one model call) | `recorder.callEnd()` → one `ai.model_call` row's tokens |
| result `usage` | the **final step** | **the sum of all steps** | — (v10r never read v6's `usage` in a multi-step call) |
| result `totalUsage` | the sum | deprecated alias of `usage` | was the helper's charge; now `usage` |

So the trace's token rows keep meaning **per model call**, the conversation totals are still
summed from those rows, and the budget charge is still the attempt's sum. Pinned by
`_shared/streaming-turn.test.ts` → *step usage is per model call; the usage afterText charges
is the sum of the steps* (real `streamText`, two steps with different usage: 100/7 and 130/4
per step, 230/11 charged).

## v7 features evaluated

| Feature | What it is | Decision | Why |
|---|---|---|---|
| `toolApproval` (+ `experimental_toolApprovalSecret`, `@ai-sdk/policy-opa`) | Per-call policy returning `not-applicable` · `approved` · `denied` · `user-approval`; a `user-approval` emits a `tool-approval-request`, the client answers with `addToolApprovalResponse`, the next request executes the call. HMAC signing binds an approval to tool name, call id and input | **Not adopted** | It approves *one tool call* whose approval lives in the client-sent history (hence the signing). v10r's gate approves a *plan*: the proposal row freezes the grant, the approve route replays the steps server-side, writes receipts and offers revert ([agent-actions.md](./agent-actions.md)). Mapping `requiresApproval(risk)` to `toolApproval` would add a second approval channel with weaker state. Worth copying: the signed-approval idea, if a proposal id ever travels through an untrusted channel |
| External MCP tool approval | — | **v10r gate** | An MCP peer tool gets a v10r `risk` (AA2) and goes through the same proposal gate; `toolApproval` adds nothing the gate lacks |
| MCP Apps helpers (`@ai-sdk/mcp`: `mcpAppClientCapabilities`, `splitMCPAppTools`, `readMCPAppResource`; React-only `MCPAppRenderer`) | Host side of MCP Apps: advertise support, keep app-only tools away from the model, fetch and normalize the `ui://` HTML | **Not adopted** | Bound to `@ai-sdk/mcp`'s own client, which 2.0.103 still implements itself (no `@modelcontextprotocol/*` dependency) — D10 keeps the official client. No Svelte renderer. The visibility split (`_meta.ui.visibility`: model vs app) is a ten-line rule to reproduce on the official client when v10r renders MCP Apps |
| `render_surface` tool streaming | — | **Nothing new needed** | v7 streams tool input (`tool-input-start/delta`) as v6 did; the A2UI tool is an ordinary catalogue tool |
| Harness skills (`HarnessAgent` `skills`), `uploadSkill` | Instruction bundles for *harness* agents (Claude Code-style runtimes) and provider-side skill uploads | **Not adopted** | v10r's agent skills are a generated documentation surface ([agent-skills.md](./agent-skills.md)), not runtime instructions for the chat loop |
| `WorkflowAgent` (`@ai-sdk/workflow`) | Durable, resumable tool loop on the Workflow SDK; approvals suspend and resume | **Deferred** (AA11) | Every v10r turn finishes inside its request and the proposal row already outlives it. Revisit with a run that must outlive a request |
| `@ai-sdk/otel` (`registerTelemetry(new OpenTelemetry())`) | SDK-emitted spans for every call; records inputs and outputs by default | **Not adopted** | AA12: the turn trace is projected to content-free GenAI spans. Registering `@ai-sdk/otel` would add a second span tree that records prompts unless `recordInputs` / `recordOutputs` are off. If an exporter lands (plan wave E), export the projection; add `@ai-sdk/otel` only with both recording switches off and a reason the projection lacks |

## Not verified without a live provider

The cloud session has no database and no provider key, so the following is proven only
against `MockLanguageModelV4` and mocked routes: the real V4 providers' stream shapes (Gemini's
empty-stop, Groq's textual tool call, OpenAI's Responses API), the browser `Chat` on v7 against a
real stream, and the approve → receipt → revert round trip.

**The live verification step** — locally (`podman exec v10r bun run dev`), with Google, Groq
and OpenAI connected under Admin → AI → Models, once per provider (set it as the default
there, or pick it in the chat's provider menu):

1. **Chatbot turn.** Open Vely (the chatbot) on any public page and ask *"Where does v10r keep
   the approval gate?"* Expect a streamed answer with citation chips, one bubble, no error
   frame. Open *Inspect this turn* (or `/showcases/ai/chatbot#orchestration` signed in): at least one `search_*` tool execution with a duration, one model-call
   row per step, each with its own input/output tokens, and the turn's total equal to their sum.
2. **Deskbot write with approval.** In the desk, with a markdown file open, ask the bot to
   *"rename this file to v7-check"* (`desk_rename_file`, risk `write`, so gated; `create` is
   not). Expect a proposal card and no rename before it; Approve it, then a receipt and the
   new name; Revert restores the old name. Inspect the turn: the tool shows
   `requires_approval`, the outcome `awaiting_decision`, then the approved run's receipt.
3. Record each run (provider, model, pass/fail, the inspector's token rows) in this page and
   flip AA13 and the matrix row to *proven*.
