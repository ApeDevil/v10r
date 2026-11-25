# Agentic architecture — evolution process

The [MCP evolution process](../mcp-evolution/process.md) — one living record, a monthly
review, event-driven reviews, no automation — applied to every row of [matrix.md](./matrix.md).
Nothing here adds a bot, a scheduled job or a service.

## Sources

Primary sources only; the MCP rows keep their own list in the MCP process.

| Technology | Watch |
|---|---|
| A2A | `a2a-protocol.org` spec changelog; `@a2a-js/sdk` and `a2a-sdk` (PyPI) releases; a2a-itk dashboard |
| A2UI | `a2ui-project/a2ui` releases; `@a2ui/web_core` and `@a2ui/agent` versions (0.x — read every release's breaking list) |
| AG-UI | `ag-ui-protocol/ag-ui` releases; `@ag-ui/core` version; any official AI SDK or Svelte client |
| WebMCP | Chrome status entry and blink-dev intents; `webmachinelearning/webmcp` explainer |
| Agent Skills | `agentskills.io/specification`; MCP SEP-2640 SDK support |
| MCP Apps | `modelcontextprotocol/ext-apps` releases and host support table |
| ACP | `agentclientprotocol.com` RFDs (remote transport) |
| OTel GenAI | `open-telemetry/semantic-conventions-genai` releases (status changes from Development) |
| AI SDK | `ai` dist-tags, migration guides |
| Durable execution | `workflow` and `@workflow/sveltekit` releases |
| AGNTCY / ANP / registries | Foundation announcements only |

## Monthly review additions

1. For each row, compare the matrix's version with the source; update *Upstream*, *SDK*,
   *Evidence*, date. A stale date is a fact, not a failure.
2. Re-run the cheap proofs: `bun run a2a:interop`, `bun run mcp:client:interop`,
   `bun run genui:bench`, and the unit lanes (`bunx vitest run src/lib/server/a2a
   src/lib/server/ai/mcp-client src/lib/generative-ui src/lib/client-actions
   src/lib/server/ai/ag-ui src/lib/server/ai/trace`).
3. Check every *Reassess when* trigger; a fired trigger becomes a decision-record entry.
4. Bump an exact pin only when its release notes are read and the lanes above pass.

## Event-driven review

Within a week of: a new major/stable revision of any adopted or adapted standard; a
security advisory against an adopted SDK; a fired trigger; a breaking 0.x release of
`@a2ui/web_core` (it broke ~20 APIs in 0.16).
