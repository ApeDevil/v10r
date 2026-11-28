# MCP compatibility and evolution matrix

The living record of [process.md](./process.md). One row per capability; update a row when its
upstream status, v10r status or decision changes, and set its date. Roadmap ids point into
[roadmap.md](./roadmap.md); decisions into [decision-record.md](./decision-record.md).

**Upstream:** Stable · Extension · Guidance · Proposal · Vendor · Experimental
**v10r:** Supported · Partial · Missing · N/A
**Priority:** Now · Later · Monitor · Reject
**Decision:** Adopt · Adapt · Defer · Reject

Spec references are to [2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28)
unless noted. "Conf." = official conformance scenario.

## Protocol and transport

| Capability | Upstream | v10r | Relevance | Priority | Evidence | Decision | Reviewed |
|---|---|---|---|---|---|---|---|
| `initialize` negotiation (2025-11-25) | Stable (legacy era) | Supported | Every current client defaults to it | — | Conf. `server-initialize` pass; SDK v2 `legacy` | Adopt (keep) | 2026-11-21 |
| Fallback to latest supported version | Stable SHOULD | Supported (the SDK's fallback, 2025-11-25, on every transport) | Correctness, telemetry accuracy | Done — A1, SDK since D10 | `surfaces.test.ts`, `mcp/server.test.ts` | Adopt | 2026-11-21 |
| Dual-era server | Stable MAY | Supported (the SDK: `isLegacyRequest` + `createMcpHandler` on HTTP, `serveStdio` per connection) | Serve both client generations on one endpoint | Done — A3 | SDK v2 `legacy`/`auto`/`pin`; conformance both revisions | Adopt (D1) | 2026-11-21 |
| `server/discover` | Stable MUST | Supported | Required for 2026-07-28 | Done — A3 | Conf. `server-stateless` 21 pass / 4 baselined fixture checks / 3 listen checks skipped as not applicable (see §Conformance exceptions) | Adopt | 2026-11-22 |
| Per-request `_meta` envelope | Stable MUST | Supported (validated: protocolVersion, clientCapabilities required; clientInfo optional) | Required for 2026-07-28 | Done — A3 | Conf. `server-stateless`; `http.test.ts` | Adopt | 2026-11-21 |
| `Mcp-Method` / `Mcp-Name` validation | Stable MUST | Supported (OWS, Base64 sentinel; -32020) | Routing; trustworthy telemetry | Done — A3 | Conf. `http-header-validation` 14/14 | Adopt | 2026-11-21 |
| `resultType` on results | Stable MUST | Supported (modern path) | Wire-schema validity | Done — A3 | Conf. `tools-list`, `tools-call-*` wire checks pass | Adopt | 2026-11-21 |
| Caching hints `ttlMs` / `cacheScope` | Stable MUST | Supported on discover + `tools/list` (1 h; `public`/`private` per surface) | Fewer `tools/list` calls | Done — A3/B3 | Conf. `caching` 4/7 (3 = prompts/resources, not advertised) | Adopt | 2026-11-21 |
| ETags | Proposal (roadmap) | Missing | Result caching by registry digest | Monitor | roadmap | Defer | 2026-11-21 |
| Error codes -32020…-32022 + HTTP 400/404 | Stable MUST | Supported (-32020, -32022, 404 / -32601); -32021 N/A — no method needs a client capability | Modern-client recovery | Done — A3 | `http.test.ts`; conformance | Adopt | 2026-11-21 |
| Modern-client fallback to legacy | Stable SHOULD (client) | Not needed any more — modern clients stay modern | — | — | SDK v2 `auto` connects modern, no `initialize` | Superseded by A3 | 2026-11-21 |
| No protocol sessions | Stable | Supported | Serverless fit | — | `hosted-mcp.md` §E | Adopt (keep) | 2026-11-21 |
| GET → 405 | Stable | Supported | — | — | `mcpMethodNotAllowed` in `http.adapter.ts` | Adopt (keep) | 2026-11-21 |
| `ping` | Removed in 2026-07-28 | Supported (legacy); 404 / -32601 on the modern path | Legacy only | Done — A3 | Conf. `ping` pass (2025-11-25); `http.test.ts` | Adapt | 2026-11-21 |
| JSON-RPC batching | Removed since 2025-06-18 (2025-03-26 servers MUST accept) | Refused on HTTP before the SDK: 400 / -32600, nothing dispatched. The SDK would serve it, but rate limits count POSTs and telemetry records one call per POST, so a batch buys N calls for one request and hides N-1 from telemetry. Deviation from 2025-03-26 only; stdio keeps the SDK's behaviour (no limiter there) | Abuse control, telemetry integrity | — | `surfaces.test.ts`, `http.test.ts` (one observation) | Reject (deliberate, 2025-03-26 only) | 2026-11-22 |
| MRTR / `input_required` | Stable | N/A | No tool needs input mid-call | Monitor | — | Defer | 2026-11-21 |
| `subscriptions/listen` | Stable, optional — its stream only carries `*/list_changed` and `resources/updated`, which a server without `listChanged` or `resources.subscribe` never sends | Not implemented on HTTP: 404 / -32601, the spec's answer for an unimplemented method (`maxSubscriptions: 0` as a second line). Stdio keeps the SDK's listen (an empty stream) | Unsupported optional functionality, not a deviation: the ack/tag MUSTs bind a server that serves a stream. A serverless function cannot hold one, and there is nothing to deliver | Monitor — revisit if a list ever changes at runtime | Conf. 3 `sep-2575` listen checks SKIPPED: "Server advertises no subscription-delivered capability; subscriptions/listen is not applicable"; `http.test.ts` | Defer | 2026-11-22 |
| HTTP over stdio | Proposal (roadmap) | Missing | Would unify both transports | Monitor | roadmap | Defer | 2026-11-21 |
| Origin / DNS-rebinding protection | Stable | Supported | — | — | Conf. `dns-rebinding-protection` 2/2 | Adopt (keep) | 2026-11-21 |
| Unknown tool → -32602 | Stable | -32602 in both eras on every transport (the SDK's answer since D10; the legacy `isError` result is gone) | Spec compliance | — | `http.test.ts`, `mcp/server.test.ts`, `sdk-interop.test.ts` | Done | 2026-11-21 |

## Tools and results

| Capability | Upstream | v10r | Relevance | Priority | Evidence | Decision | Reviewed |
|---|---|---|---|---|---|---|---|
| Deterministic `tools/list` order | Stable SHOULD | Supported | Prompt-cache stability in clients | — | static arrays | Adopt (keep) | 2026-11-21 |
| JSON Schema 2020-12 in `inputSchema` | Stable | Supported (plain schemas) | — | — | — | Adopt (keep) | 2026-11-21 |
| Tool `title` | Stable | Missing (client bug, 2026-10) | Display names | Later — B1 | Kit: [claude-code-compat.md](./claude-code-compat.md). Cloud run 2026-11-24, Claude Code 2.1.331 (model pinned to Haiku 5.5): connected, 8/8 tools kept and called on stdio and http | Pass in the cloud run; the local host run is still ApeDevil's call before B1 ships | 2026-11-24 |
| `annotations.readOnlyHint` | Stable; Proposal to deprecate (SEP-2200) | Missing (client bug) | Client auto-approval | Later — B1 | same kit, same cloud run: pass on both transports | Pass in the cloud run; B1 stays off until accepted | 2026-11-24 |
| `outputSchema` + `structuredContent` | Stable; result shape on roadmap | Missing (client renders only structured body) | Typed consumption by client code modes | Later — C2 | `pattern-mcp.md` §Considered | Defer | 2026-11-21 |
| Bounded results, `next actions` recovery | Guidance | Supported | Token efficiency | — | `mcp:bench` | Adopt (keep) | 2026-11-21 |
| Result-level progressive disclosure | Guidance (spirit) | Supported | Measured −41…−88 % workflow tokens | — | `pattern-mcp.md` §Progressive disclosure | Adopt (keep) | 2026-11-21 |

## Discovery and execution

| Capability | Upstream | v10r | Relevance | Priority | Evidence | Decision | Reviewed |
|---|---|---|---|---|---|---|---|
| Client-side progressive tool discovery | Guidance; Vendor (Anthropic tool search) | N/A (server) | With cached definitions, discovery beats loading all tools only from 47 tools | Monitor | `mcp:bench` `catalogueScale` (B2) | Reject server-side work (D5) | 2026-11-21 |
| Server-side progressive discovery | Proposal (roadmap, experimental) | Missing | Only > ~40 tools | Monitor | roadmap | Defer (D5) | 2026-11-21 |
| Tool-definition compactness | Guidance | Partial — TypeScript declarations of the same tools are ≈ 19 % smaller than their JSON schemas | Cheaper `tools/list` without a sandbox | Monitor | `mcp:bench` `strategies` (B2) | Consider before any Code Mode work | 2026-11-21 |
| Programmatic tool calling (client) | Guidance; Vendor (Anthropic PTC excludes MCP connector tools) | N/A (server) | Helped by `outputSchema` (C2) | Monitor | client best practices | Defer | 2026-11-21 |
| Code Mode server (`code` / `search`+`execute`) | Vendor, experimental (Cloudflare) | Missing | Lower bound ≈ 2,200 tokens over 8 tasks with cached definitions; needs a sandbox | Reject (revisit triggers in D4) | `mcp:bench` `strategies` (B2) | Reject | 2026-11-21 |
| Code execution in the in-app agent | — | Missing | Would sit between model and approval gate | Reject | threat model, decision record §5 | Reject | 2026-11-21 |

## Extensions

| Capability | Upstream | v10r | Relevance | Priority | Evidence | Decision | Reviewed |
|---|---|---|---|---|---|---|---|
| Extensions negotiation | Stable | Missing | Needed only to offer an extension | Monitor | — | Defer | 2026-11-21 |
| Tasks `io.modelcontextprotocol/tasks` | Extension | N/A | No long-running tool | Monitor | latency p95 ≤ 1 ms | Defer | 2026-11-21 |
| MCP Apps `io.modelcontextprotocol/ui` | Extension | N/A | Pattern dependency explorer View on the hosted surfaces ([mcp-apps.md](../../ai/mcp-apps.md)); stdio registers none | Experiment | Built on branch `claude/cloud/mcp-app-pattern-explorer`; MCP Inspector 2.16.0 renders it | Experiment — B1 stays off; compat kit needs a `_meta.ui` case | 2026-11-24 |
| Skills (`ext-skills`) | Extension (experimental attach) | Missing | Pattern cards are skill-shaped | Later — C3 | TS SDK 2.4.0 notes | Defer | 2026-11-21 |
| ext-auth (client credentials, EMA) | Extension | N/A | Operator surfaces, if multi-holder | Monitor | — | Defer | 2026-11-21 |

## Security and identity

| Capability | Upstream | v10r | Relevance | Priority | Evidence | Decision | Reviewed |
|---|---|---|---|---|---|---|---|
| OAuth 2.1 + Protected Resource Metadata | Stable (auth optional) | N/A public; spec-external bearer on private/admin | One holder per surface | Monitor (D7) | audit §6 | Reject for now | 2026-11-21 |
| No token passthrough / audience validation | Stable MUST | Supported (tokens never forwarded) | — | — | `auth.ts` | Adopt (keep) | 2026-11-21 |
| CIMD / DCR deprecation | Stable SHOULD / deprecated | N/A | Only with OAuth | Monitor | — | Defer | 2026-11-21 |
| DPoP, workload identity | Proposal (roadmap) | N/A | — | Monitor | — | Defer | 2026-11-21 |
| OWASP MCP08 audit & telemetry | Guidance | Supported | — | — | `mcp.call_log` | Adopt (keep) | 2026-11-21 |
| OWASP MCP03/06 tool poisoning, injection | Guidance | Supported (own registry text only; untrusted-content wrapping in-app) | — | — | `untrusted-content.ts` | Adopt (keep) | 2026-11-21 |

## Tooling

| Capability | Upstream | v10r | Relevance | Priority | Evidence | Decision | Reviewed |
|---|---|---|---|---|---|---|---|
| Official conformance suite | Official tooling (0.1.16 stable; 0.2.0-alpha for 2026-07-28) | Supported (`bun run mcp:conformance`, pinned per revision, per-check baselines) | Regression authority | Done — A2 | both revisions pass their baselines (2026-11-22, SDK branch); every entry is listed with its reason in §Conformance exceptions | Adopt | 2026-11-22 |
| SDK v2 client interop test | Official SDK 2.4.0 | Supported (`legacy`, `auto`, `pin`; HTTP and stdio) | Guards both eras | Done — A2/A3 | `sdk-interop.test.ts` in `validate` | Adopt | 2026-11-21 |
| SDK v1 support window | Official, ≥ 2027-01-27 | In use (dev only) | Interop client | Monitor | SDK README | Adopt until window ends | 2026-11-21 |
| SDK as runtime dependency | Official | `@modelcontextprotocol/server` 2.4.0 (exact pin) on every endpoint; stdio runs it bundled | The protocol layer | Monitor (bump check every monthly review) | D10; conformance both revisions; `sdk-interop.test.ts`; `mcp:bundle:check` | Adopt | 2026-11-21 |

## Conformance exceptions

Every baseline entry in `scripts/mcp/conformance/*.baseline.yml`, grouped, with why it is not a
protocol regression and what covers the behaviour instead. Approved by ApeDevil on 2026-11-22
for the SDK migration (D10); the rule for new entries is in [process.md](./process.md) §3.
"Not advertised" means `initialize` / `server/discover` declare only `tools: { listChanged: false }`,
so -32601 for that method family is the conformant answer.

| Lane | Entries | Kind | Reason | Covered instead by |
|---|---|---|---|---|
| 2025-11-25 | `tools-call-simple-text`, `tools-call-error` | Fixture tool | Call `test_simple_text` / `test_error_handling`, which no production server exposes. Passed falsely before D10 (the legacy path answered an unknown tool with an `isError` result the runner mistook for the fixture); the SDK now answers -32602 | `sdk-interop.test.ts` "conformance fixture equivalents on real tools": the scenarios' own assertions on five real tools (text content), four domain errors and a throwing tool (`isError` + message, no exception text), through a real SDK client on the 2025 handshake |
| 2026-07-28 | `tools-call-simple-text:…`, `tools-call-error:…` | Fixture tool | Same fixtures | Same tests, plus the modern-era results in `http.test.ts` and `mcp/server.test.ts` |
| both | `tools-call-image`, `-audio`, `-embedded-resource`, `-mixed-content` | Fixture tool | v10r results are text only, by design ([pattern-mcp.md](../pattern-mcp.md) §Client design constraints) | — |
| both | `tools-call-with-progress`; 2025: `tools-call-with-logging` | Fixture tool | No tool emits progress or log notifications; answers are single JSON bodies | — |
| 2025-11-25 | `tools-call-sampling`, `tools-call-elicitation`, `elicitation-sep1034-defaults`, `elicitation-sep1330-enums` | Fixture tool | No tool asks the client for sampling or elicitation | — |
| 2026-07-28 | `input-required-result-*` (12 checks) | Fixture tool | Multi-round-trip results: no tool needs input mid-call. The scenarios' wire checks pass | — |
| 2026-07-28 | `server-stateless:sep-2575-server-rejects-undeclared-capability`, `…-missing-capability-http-400` | Fixture tool | Need `test_missing_capability`; no v10r method requires a client capability, so -32021 can never arise | — |
| 2026-07-28 | `server-stateless:sep-2575-http-server-no-independent-requests-on-stream`, `…-server-no-log-without-loglevel` | Fixture tool | Need `test_streaming_elicitation` / `test_logging_tool`; nothing streams or logs (runner: "not testable") | — |
| 2026-07-28 | `json-schema-2020-12:…`, `http-custom-header-server-validation:…` (5) | Fixture tool / pending scenario | No v10r tool uses the fixture schema or declares `x-mcp-header` parameters | — |
| both | `logging-set-level` (2025), `completion-complete` | Not advertised | No logging or completions capability | — |
| both | `resources-*`, `prompts-*`, `sep-2164-resource-not-found:…`, `caching:sep-2549-{prompts,resources,resources-templates}-list-caching-hints` | Not advertised | No resources or prompts; the caching hints on `tools/list` and `server/discover` pass | — |
| 2026-07-28 | `tasks-*` (Tasks extension) | Extension not negotiated | No long-running tool (p95 ≤ 1 ms); unscored for 2026-07-28 | — |
| 2025-11-25 | `server-sse-multiple-streams` | WARNING counted by the runner | Stateless, no `Mcp-Session-Id`, GET is 405 — both optional | `http.test.ts` (405) |

**Not in any baseline:** the three `sep-2575` listen checks (`server-sends-subscription-ack`,
`server-tags-subscription-id`, `server-honors-notification-filter`) report **SKIPPED** — the runner's
own verdict for a server that advertises no subscription-delivered capability and answers
`subscriptions/listen` with -32601. Before 2026-11-22 the branch refused listen with -32603
"Subscription limit reached", which reads as a temporary refusal of a supported method; that was
the deviation, and it is fixed.

