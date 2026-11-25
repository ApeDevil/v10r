# Agent observability — the turn trace as OpenTelemetry GenAI spans

**Maturity: built** (pure projection with tests; no exporter is installed).

## Problem

v10r records every turn once, from the actual execution ([turn-trace.md](./turn-trace.md)).
An operator with an OpenTelemetry backend wants the same facts in the GenAI semantic
conventions — without a second tracer that could disagree with the first.

## Decision

`projectTurnTraceToGenAiSpans(trace)` (`src/lib/server/ai/trace/gen-ai-spans.ts`) returns
exporter-neutral spans:

| Span | Name | Key attributes |
|---|---|---|
| Turn | `invoke_agent Vely` / `invoke_agent Workspace operator` | `gen_ai.operation.name`, `gen_ai.agent.name`, `gen_ai.conversation.id`, summed `gen_ai.usage.*`, `error.type` |
| Provider request | `chat {model}` | `gen_ai.provider.name` (`google` → `gcp.gemini`), `gen_ai.request.model`, `gen_ai.response.*`, `gen_ai.usage.input_tokens`/`output_tokens`/`cache_read.input_tokens` |
| Tool execution | `execute_tool {tool}` | `gen_ai.tool.name`, `gen_ai.tool.call.id`, `gen_ai.tool.type`; `v10r.tool.risk`, `v10r.tool.executor` |

Rules: **no content** (prompt, completion, tool input/output never enter a span — there is no
switch); conventional names where they exist, `v10r.*` otherwise; pinned to
`GEN_AI_SEMCONV_REVISION = '0.1.0'` because the conventions are still *Development*.

Three records stay distinct: the **turn trace** (owner-readable diagnostics, bodies, 30/180-day
retention), **telemetry** (these spans — lossy, content-free), and **audit** (proposal
receipts — not projected).

## Cross-protocol correlation

One turn's trace is the root; every protocol hop joins it through an id it already has, so no
second tracer and no new id is minted:

| Hop | Joins the turn by | Where the id lives |
|---|---|---|
| Model calls, tool executions | the turn (message id, request id) | `ai.turn`, `ai.model_call`, `ai.tool_call` |
| Generative surface render, surface action | `renderId` = the `render_surface` tool call id; a surface action's user row id `sa_<sha256(conversation, submission key)>` | the assistant / user message parts |
| Approval of an external call (MCP peer, A2A) | proposal id on the tool execution (`remoteTask.operationId`); `agent_proposal.message_id` points back at the turn | `ai.tool_call` trace, `ai.agent_proposal` |
| Execution of that call | `agent_external_operation.proposal_id`, with claim / dispatch / settle times | `ai.agent_external_operation` |
| A2A remote task | the peer's task and context ids, kept only when id-shaped | the operation row's `result.remoteTask`, the receipt message |
| AG-UI run | `threadId` = conversation id, `runId` = the assistant message id; `CUSTOM v10r.proposal` carries the proposal id | the AG-UI event stream |
| MCP App, WebMCP | no turn: a hosted MCP call or a browser-agent call is its own request; MCP telemetry and the client-action budget record them | `mcp` telemetry, the browser |

The GenAI span projection carries the external ids on the `execute_tool` span
(`v10r.external.protocol`, `v10r.external.peer`, `v10r.external.operation_id`,
`v10r.a2a.task_id`, `v10r.a2a.context_id`) — ids, never what was sent. The Lab's
cross-protocol scenario (`src/lib/showcases/interop/cross-protocol-scenario.test.ts`, report
beside it) runs one request through every hop in-process and shows the keys per step.

No exporter is shipped. Exporting needs an OTel SDK (`@vercel/otel` or `@ai-sdk/otel`, see
Next step); the projection is content-free by construction, so either exporter emits no
prompt, tool input or tool output unless someone adds a capture path on purpose.

## When to use / when not

Use when an OTel backend is in place. Do not add an OTel SDK just to have one; the admin
pages already read the trace.

## Next step

`instrumentation.server.ts` with `@vercel/otel` (works with `adapter-vercel` 7) exporting these
spans after a turn persists; or `@ai-sdk/otel` after the AI SDK v7 upgrade, reconciling its
`gen_ai.*` output with this projection (it emits `cache_creation` where the spec says
`cache_write`, and no `gen_ai.conversation.id`).

## Validation

`gen-ai-spans.test.ts` over the committed showcase fixtures: span shape and parenting, names,
usage sums, no body text in any span, namespace discipline, the external correlation ids.
`cross-protocol-scenario.test.ts`: eight steps pass and the committed report is current.
