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
| Fallback to latest supported version | Stable SHOULD | Supported (both answer 2025-11-25; one list in `mcp/protocol-version.ts`) | Correctness, telemetry accuracy | Done — A1 | `transport.test.ts`, `mcp/server.test.ts` | Adopt | 2026-11-21 |
| Dual-era server | Stable MAY | Supported (both transports, `mcp/protocol-era.ts`) | Serve both client generations on one endpoint | Done — A3 | SDK v2 `legacy`/`auto`/`pin`; conformance both revisions | Adopt (D1) | 2026-11-21 |
| `server/discover` | Stable MUST | Supported | Required for 2026-07-28 | Done — A3 | Conf. `server-stateless` 21/25 (4 = fixture-only checks: -32021 ×2, streaming elicitation, logging) | Adopt | 2026-11-21 |
| Per-request `_meta` envelope | Stable MUST | Supported (validated: protocolVersion, clientCapabilities required; clientInfo optional) | Required for 2026-07-28 | Done — A3 | Conf. `server-stateless`; `http.test.ts` | Adopt | 2026-11-21 |
| `Mcp-Method` / `Mcp-Name` validation | Stable MUST | Supported (OWS, Base64 sentinel; -32020) | Routing; trustworthy telemetry | Done — A3 | Conf. `http-header-validation` 14/14 | Adopt | 2026-11-21 |
| `resultType` on results | Stable MUST | Supported (modern path) | Wire-schema validity | Done — A3 | Conf. `tools-list`, `tools-call-*` wire checks pass | Adopt | 2026-11-21 |
| Caching hints `ttlMs` / `cacheScope` | Stable MUST | Supported on discover + `tools/list` (1 h; `public`/`private` per surface) | Fewer `tools/list` calls | Done — A3/B3 | Conf. `caching` 4/7 (3 = prompts/resources, not advertised) | Adopt | 2026-11-21 |
| ETags | Proposal (roadmap) | Missing | Result caching by registry version | Monitor | roadmap | Defer | 2026-11-21 |
| Error codes -32020…-32022 + HTTP 400/404 | Stable MUST | Supported (-32020, -32022, 404 / -32601); -32021 N/A — no method needs a client capability | Modern-client recovery | Done — A3 | `http.test.ts`; conformance | Adopt | 2026-11-21 |
| Modern-client fallback to legacy | Stable SHOULD (client) | Not needed any more — modern clients stay modern | — | — | SDK v2 `auto` connects modern, no `initialize` | Superseded by A3 | 2026-11-21 |
| No protocol sessions | Stable | Supported | Serverless fit | — | `hosted-mcp.md` §E | Adopt (keep) | 2026-11-21 |
| GET → 405 | Stable | Supported | — | — | `http.adapter.ts:33` | Adopt (keep) | 2026-11-21 |
| `ping` | Removed in 2026-07-28 | Supported (legacy); 404 / -32601 on the modern path | Legacy only | Done — A3 | Conf. `ping` pass (2025-11-25); `http.test.ts` | Adapt | 2026-11-21 |
| JSON-RPC batching | Removed since 2025-06-18 | N/A (rejected) | — | — | `transport.ts:94` | Reject | 2026-11-21 |
| MRTR / `input_required` | Stable | N/A | No tool needs input mid-call | Monitor | — | Defer | 2026-11-21 |
| `subscriptions/listen` | Stable | N/A | `listChanged: false`; static registry per deploy | Monitor | — | Defer | 2026-11-21 |
| HTTP over stdio | Proposal (roadmap) | Missing | Would unify both transports | Monitor | roadmap | Defer | 2026-11-21 |
| Origin / DNS-rebinding protection | Stable | Supported | — | — | Conf. `dns-rebinding-protection` 2/2 | Adopt (keep) | 2026-11-21 |
| Unknown tool → -32602 | Stable | Modern era: -32602 `data: { name }` on both transports; legacy era keeps the `isError` result with recovery text | Spec compliance where the spec requires it, legacy answers unchanged | — | `http.test.ts`, `mcp/server.test.ts`, `sdk-interop.test.ts` | Done | 2026-11-21 |

## Tools and results

| Capability | Upstream | v10r | Relevance | Priority | Evidence | Decision | Reviewed |
|---|---|---|---|---|---|---|---|
| Deterministic `tools/list` order | Stable SHOULD | Supported | Prompt-cache stability in clients | — | static arrays | Adopt (keep) | 2026-11-21 |
| JSON Schema 2020-12 in `inputSchema` | Stable | Supported (plain schemas) | — | — | — | Adopt (keep) | 2026-11-21 |
| Tool `title` | Stable | Missing (client bug, 2026-10) | Display names | Later — B1 | Kit: [claude-code-compat.md](./claude-code-compat.md); not yet run | Defer until live check | 2026-11-21 |
| `annotations.readOnlyHint` | Stable; Proposal to deprecate (SEP-2200) | Missing (client bug) | Client auto-approval | Later — B1 | same kit; not yet run | Defer until live check | 2026-11-21 |
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
| MCP Apps `io.modelcontextprotocol/ui` | Extension | N/A | Possible Studio views | Monitor | — | Defer | 2026-11-21 |
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
| Official conformance suite | Official tooling (0.1.16 stable; 0.2.0-alpha for 2026-07-28) | Supported (`bun run mcp:conformance`, pinned per revision, per-check baselines) | Regression authority | Done — A2 | both revisions pass their baselines; since unknown tool = -32602 the fixture-tool scenarios (`tools-call-simple-text`, `tools-call-error`, …) fail honestly instead of passing falsely, and are baselined as fixtures | Adopt | 2026-11-21 |
| SDK v2 client interop test | Official SDK 2.4.0 | Supported (`legacy`, `auto`, `pin`; HTTP and stdio) | Guards both eras | Done — A2/A3 | `sdk-interop.test.ts` in `validate` | Adopt | 2026-11-21 |
| SDK v1 support window | Official, ≥ 2027-01-27 | In use (dev only) | Interop client | Monitor | SDK README | Adopt until window ends | 2026-11-21 |
| SDK as runtime dependency | Official | Not used (hand-rolled) | Zero-dependency stdio | Monitor | D2 | Reject for now | 2026-11-21 |
