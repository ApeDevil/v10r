# Velociraptor MCP audit (2026-11-21)

> **Baseline record.** This audit describes the code at `5780ba8`, before the accepted items were
> implemented (A1–A3 on 2026-11-21, see the [status table](./README.md#status-2026-11-21)). It is
> kept unchanged as the state the implementation was measured against; for the current state read
> [matrix.md](./matrix.md).

A comparison of v10r's MCP implementation, as it is in the repository at `5780ba8`, against the
current specification and practice in [state-of-the-art.md](./state-of-the-art.md). Every row
says which of three kinds of evidence backs it:

- **Implemented** — read in the code.
- **Documented** — stated in a doc, not re-checked here.
- **Verified** — observed running, in this review (§7 lists the runs).

---

## 1. What exists

| Surface | Entry | Trust | Tools | Protocol code |
|---|---|---|---|---|
| Local stdio Pattern MCP | `mcp/server.ts` | Ephemeral container, `--network=none`, repo `:ro` | 8 pattern tools | Hand-rolled NDJSON JSON-RPC (`mcp/protocol.ts`), no SDK |
| Hosted public | `src/routes/api/mcp/public/+server.ts` | None; read-only by construction; 60 req/min/IP | Same 8 | `src/lib/server/mcp/transport.ts` + `http.adapter.ts` |
| Hosted private | `src/routes/api/mcp/private/+server.ts` | Static bearer `MCP_PRIVATE_TOKEN`; full self-telemetry | Same 8 | Same transport |
| Hosted admin | `src/routes/api/mcp/admin/+server.ts` | Static bearer `MCP_ADMIN_TOKEN` | 5 demo-state tools | Same transport |
| In-app assistant | `src/lib/server/ai/chat-orchestrator.ts` | Better Auth session, scopes, approval gate | 20 `TOOL_MANIFEST` entries (`src/lib/types/ai-tools.ts`) | **Not MCP** — Vercel AI SDK tools |

One tool contract feeds both MCP transports: `pattern-library/query.ts` (`QUERY_TOOLS`,
`REGISTRY_QUERIES`) plus `pattern-library/architecture-queries.ts`; byte parity is pinned by
`src/lib/server/mcp/patterns/parity.test.ts`. The in-app assistant reads the same registry
through its `search_pattern_library` tool but neither consumes nor exposes MCP. That separation
is correct and should stay: MCP is v10r's *external* agent interface; `TOOL_MANIFEST` is its
*internal* one ([agent-actions.md](../../ai/agent-actions.md)).

---

## 2. Protocol versions and negotiation

| Item | Finding | Evidence |
|---|---|---|
| Supported revisions | `2025-11-25`, `2025-06-18`, `2025-03-26` on both transports | Implemented: `mcp/server.ts:20`, `src/lib/server/mcp/server-info.ts:14` |
| `2026-07-28` | Not supported. No `server/discover`, no `_meta` envelope, no `resultType`, no caching hints, no `Mcp-Method`/`Mcp-Name` validation | Implemented; Verified (§7.2) |
| Fallback for an unknown requested version | **Hosted answers `2025-06-18`; stdio answers `2025-11-25`.** The spec says the fallback SHOULD be the latest supported. The two transports disagree | Verified: `initialize` with `protocolVersion: "2099-01-01"` → `"2025-06-18"`. Cause: `DEFAULT_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[1]` (`server-info.ts:15`); already flagged in `src/lib/server/db/schema/mcp/call-log.ts` |
| `MCP-Protocol-Version` header | Present-but-unsupported → 400 with a plain `{ error: { code } }` body, deliberately *not* -32022 | Implemented: `http.adapter.ts:222`; pinned by `http.test.ts:167` |
| Modern-client fallback | The plain 400 body makes modern clients fall back to `initialize`, as the spec's backward-compatibility rule intends | **Verified** with the official SDK v2 client in `auto` mode (§7.3) |
| Era telemetry | `requested_protocol_version`, `served_protocol_version` and `rc_headers` (presence of `Mcp-Method`/`Mcp-Name`) are recorded per request, so migration demand is measurable before any code changes | Implemented: `call-log.ts` |

**Assessment.** Correct and deliberately conservative for 2025-11-25, with one real defect (the
fallback version) and a well-engineered forward-compatibility guard. The guard's own comment
names the unblock condition for 2026-07-28: add the version, implement `server/discover`,
validate the `_meta` envelope — together, never partially.

## 3. Transports

| Item | Finding | Evidence |
|---|---|---|
| Hosted Streamable HTTP | Non-streaming: one POST → one JSON response; notifications → 202; GET → 405 | Implemented; Verified (conformance) |
| Sessions | None minted or read — already the 2026-07-28 model | Implemented; gate-tested per `hosted-mcp.md` §E |
| JSON-RPC batching | Rejected with -32600. Correct for ≥ 2025-06-18; strictly, `2025-03-26` allowed batches | Implemented: `transport.ts:94` |
| `ping` | Implemented. Removed in 2026-07-28, so a modern handler must answer 404/-32601 | Implemented |
| Unknown method | HTTP 200 + -32601. 2026-07-28 requires HTTP 404 | Implemented; Verified (§7.2) |
| Origin / DNS rebinding | Full-origin check; allowlist via `MCP_ALLOWED_ORIGINS` | Verified: conformance `dns-rebinding-protection` 2/2 (2025-11-25) |
| Body budget | 256 KiB, 413 on excess | Implemented: `src/lib/server/http/body.ts:34` |
| Stdio lifecycle | Exits on EOF/SIGTERM/EPIPE; stdout protocol-only | Implemented; Documented (`mcp/README.md`) |

## 4. Tools: registration, schemas, results

| Item | Finding | Evidence |
|---|---|---|
| Registration | Static arrays; dispatch hard-allowlisted per registry (`transport.ts:57`) — the public endpoint cannot reach admin tools | Implemented; Verified by `sdk-interop.test.ts` |
| `tools/list` order | Deterministic (static array) — meets the 2026-07-28 SHOULD | Implemented |
| Tool metadata | `name`, `description`, `inputSchema` only. `title`, `annotations`, `outputSchema` omitted because of a Claude Code bug recorded in 2026-10 that dropped a server's whole tool list | Documented: `pattern-mcp.md` §Client design constraints. **Not re-verified** — needs a live Claude Code session |
| Results | Markdown text only, `isError` for failures with a closed `ToolDiag` telemetry union stripped before the wire; `## Next actions` recovery blocks | Implemented; Documented (`agent-experience.md`) |
| `structuredContent` | Not used (Claude Code shows only the structured payload when both exist) | Documented |
| Result bounds | ≤ 250 lines / 36 KB excerpts, ≤ 50 search rows, ≤ 5 cards per call | Implemented; Documented |

## 5. Efficiency (measured)

`bun run mcp:bench` against the current tree (≈tokens = chars / 4, offline estimate):

| Measure | Value |
|---|---|
| `tools/list`, 8 tools | **≈ 2,360 tokens** (≈ 1.2 % of a 200k window; `explore_architecture` alone ≈ 675). The committed `results.json` still shows 1,486 — it predates the two architecture tools |
| Mean result, `search_patterns` / `get_pattern` (deep) / plan | ≈ 593 / 954 / 2,181 |
| Handler latency p95 | `search_patterns` 250 µs, `get_pattern` 10 µs, plan 1.0 ms (in-process) |
| Scripted workflows, progressive interface | 6 of 8 complete in **one call**; 275–1,904 tokens each |

The interface already applies **server-side progressive disclosure of results**: `detail`
levels, `ids` + `sections`, `section` excerpts, `query: "*"` browse, `detail: "outline"` plans.
It cut workflow cost 41–88 % against the earlier interface (`pattern-mcp.md` §Progressive
disclosure).

**Upper bound of what Code Mode could save**, computed from the same workflows: the tokens of
every intermediate result (all calls but the last), i.e. what a script could keep out of the
model's context if it threw them away.

| Workflow (progressive variant) | Calls | Result tokens | Intermediate tokens |
|---|---|---|---|
| w1 fit check | 1 | 228 | 0 |
| w2 pick between candidates | 2 | 604 | 400 |
| w3 read kernel function | 1 | 1,285 | 0 |
| w4 read doc section | 1 | 568 | 0 |
| w5 invariants of three | 1 | 898 | 0 |
| w6 browse category | 1 | 400 | 0 |
| w7 plan two capabilities | 1 | 1,854 | 0 |
| w8 emulate one | 3 | 1,383 | 1,052 |

Total ceiling across eight tasks: ≈ 1,450 tokens — and that ceiling assumes the agent does not
need to read the search result it chooses from, which in w2 and w8 it does. Against it stand
the script's own output tokens on every task and a second model turn when the script fails.
For v10r's catalogue, Code Mode's measurable benefit is approximately zero (see
[decision-record.md](./decision-record.md) §4).

## 6. Authentication and authorization

| Item | Finding | Evidence |
|---|---|---|
| Public | Unauthenticated by design; read-only by construction | Implemented |
| Private / admin | Static bearer per realm, constant-time compare over SHA-256 digests, rate limit before auth, 503 when unconfigured | Implemented; `auth.test.ts`, `bearer-surfaces.test.ts` |
| Spec conformance | **Not OAuth.** No Protected Resource Metadata, `WWW-Authenticate` carries `realm` but no `resource_metadata`, no audience-bound tokens. The spec makes authorization optional, and a static key sent with `--header` works with Claude Code; but no off-the-shelf client can *discover* how to authenticate | Implemented |
| Fit | Both bearer surfaces have exactly one holder — the operator. OAuth would add an authorization server, client registration and token lifecycle for zero additional users | Assessment |

## 7. Verification runs (this review)

All against a local dev server (`bun run dev`, placeholder `.env`, no database, no Redis) at
`http://localhost:5173/api/mcp/public`, plus the stdio server spawned with `bun mcp/server.ts`.
No repository file was changed to run them; tools were installed in a scratch directory.

### 7.1 Official conformance, 2025-11-25 (`@modelcontextprotocol/conformance@0.1.16`)

Default (active) server suite: **7 passed, 23 failed.** Passing: `server-initialize`, `ping`,
`tools-list`, `tools-call-simple-text`, `tools-call-error`, `dns-rebinding-protection` (2
checks), `server-sse-multiple-streams` (0 checks). Every failure is a fixture scenario that
expects the reference "everything" server's tools, resources, prompts, logging, completion,
sampling or elicitation — features v10r deliberately does not expose. They are not applicable,
and belong in an expected-failures baseline rather than being "fixed".

### 7.2 Official conformance, 2026-07-28 (`0.2.0-alpha.12`, pre-release)

| Scenario | Result | Why |
|---|---|---|
| `server-stateless` | 3 pass (the HTTP 400 status checks), ~25 fail | No `server/discover`, no `_meta` validation, unknown methods are 200 not 404, legacy methods still answered |
| `http-header-validation` | 0 / 5 | `Mcp-Name` not validated against the body |
| `caching` | 0 / 7 | No `ttlMs` / `cacheScope` |
| `tools-list`, `tools-call-*` | fail | Wire schema: no `resultType`, no caching hints |

Expected for a 2025-11-25 server, and the precise shopping list for the migration.

### 7.3 Official SDK v2 client (`@modelcontextprotocol/client@2.4.0`)

| Server | `legacy` mode (SDK default) | `auto` mode |
|---|---|---|
| Hosted public | Connects at 2025-11-25; `tools/list` 8; `tools/call` ok | Probes `server/discover` with `MCP-Protocol-Version: 2026-07-28` → **400 plain body** → falls back to `initialize` → works. Cost: one extra round trip per connection |
| Stdio | Works | Works |

The forward-compatibility guard in `http.adapter.ts` does exactly what its comment claims. The
repository's own interop test (`sdk-interop.test.ts`) uses the v1 client `1.29.0` only, so this
behaviour is not regression-protected today.

## 8. Observability, tests, documentation

- **Telemetry** is unusually thorough: one row per request (`mcp.call_log`), capability-gap
  reporting, era detection, keyed client pseudonyms, retention job. It already answers "how many
  callers are modern?" — the trigger for the migration.
- **Tests**: transport, HTTP adapter, auth, boundary gate, SDK interop (v1), parity, stdio smoke,
  bench. Missing: the official conformance suite, a v2-client interop case, and a test that both
  transports negotiate the same fallback version.
- **Documentation drift** found while auditing:
  - `hosted-mcp.md` and the architecture hub say "six" pattern tools in several places; there are
    eight (`sdk-interop.test.ts:71`).
  - `pattern-library/bench/results.json` reports `toolsList` 1,486 tokens; the tree measures
    ≈ 2,360.
  - `pattern-mcp.md` §Hosted trust surfaces describes two hosted surfaces; there are three
    endpoints.

## 9. Scorecard

| Area | Status vs 2025-11-25 | Status vs 2026-07-28 |
|---|---|---|
| Version negotiation | Supported, one defect (fallback version) | Missing; compatible fallback verified |
| Transport | Supported | Partial (stateless already; headers, 404s, discover missing) |
| Tool listing | Supported | Missing caching hints and `resultType` |
| Tool metadata | Partial (annotations/title/outputSchema withheld on purpose) | Same; roadmap may deprecate annotations |
| Results | Supported (text) | Supported (`structuredContent` optional) |
| Authorization | Not applicable for public; custom bearer for operator surfaces | Same |
| Security hardening | Strong | Strong; state-handle rules moot (no state) |
| Conformance testing | Missing (applicable scenarios pass when run by hand) | Missing |
| Efficiency | Strong, measured | Unchanged by the revision |
