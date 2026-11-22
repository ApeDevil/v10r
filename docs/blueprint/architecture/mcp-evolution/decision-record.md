# Decision record: how v10r's MCP evolves

**Status:** accepted by ApeDevil, 2026-11-21. D1–D5 accepted and implemented (A1–A3, B2);
D6 pending a local Claude Code check (B1, kit in [claude-code-compat.md](./claude-code-compat.md));
D7–D9 accepted provisionally — reassess if the product requirements change. D10 (official SDK,
superseding D2) proposed 2026-11-21 on branch `claude/cloud/mcp-official-sdk`, awaiting
ApeDevil's ship decision.
**Inputs:** [state-of-the-art.md](./state-of-the-art.md), [audit.md](./audit.md).
**Supersedes:** the 2026-10 row "MCP 2026-07-28 … Deferred, separate change" in
[pattern-mcp.md](../pattern-mcp.md) §Considered and not adopted.

---

## 1. Context

v10r exposes one curated registry through four MCP endpoints (stdio, hosted public, private,
admin) over one tool contract, and runs a separate in-app agent over `TOOL_MANIFEST`. The
2026-07-28 revision made MCP stateless and added discovery, routing headers and caching hints.
Cloudflare's Code Mode and the official client best practices popularised progressive
discovery and programmatic tool calling. The question is which of these v10r should adopt,
when, and without growing a second registry, permission system or orchestrator.

## 2. Principles applied

Standards first · **official implementations by default** · compatibility first · one source of
truth · efficiency must be measurable · security by construction · technology independence ·
progressive complexity. Each decision below names the principle that decided it.

*Official implementations by default* means: where the protocol's maintainers ship a reference
implementation, v10r builds on it and keeps only what is genuinely its own (tools, trust
surfaces, telemetry, error hygiene). A hand-written protocol layer needs a measured reason —
a constraint the official one cannot meet — and is re-examined at every SDK release (D10).

## 3. Decisions

### D1 — Become a dual-era server; keep `initialize`

**Decision.** Add `2026-07-28` beside the existing revisions on both transports as a *dual-era*
server, which the spec explicitly permits ([lifecycle](https://modelcontextprotocol.io/specification/2026-07-28/basic/lifecycle)).
An `initialize` request keeps legacy semantics byte for byte; a request carrying
`MCP-Protocol-Version: 2026-07-28` (HTTP) or the modern `_meta` envelope (stdio) is served by
the modern path: `server/discover`, `_meta` validation, `Mcp-Method`/`Mcp-Name` agreement,
`resultType`, `ttlMs`/`cacheScope`, the reserved error codes and their HTTP statuses, 404 for
`ping` and other unknown methods on the modern path.

**Why.** Compatibility first: the reference SDK client still defaults to the legacy era, Claude
clients are "rolling out", and removal is at least twelve months away. Standards first: once the
modern path exists, the forward-compatibility guard's unblock condition is met in full (version
+ discover + `_meta`), which is the only safe way to start emitting -32022.

**How it fits.** The era decision lived in the one framework-free transport
(then `src/lib/server/mcp/transport.ts`, now the SDK — D10) and its stdio twin, and both consume the same
`QUERY_TOOLS`/`REGISTRY_QUERIES` contract — no handler changes. The only per-era difference in
a tool result is the envelope (`resultType`, `_meta`), added at the transport.

**Alternatives.**

| Option | Verdict |
|---|---|
| Stay on 2025-11-25 until clients force it | Rejected as the end state: it fails the "represent modern practice" goal and conformance would keep diverging. Acceptable as the state until Priority A lands |
| Modern-only (drop `initialize`) | Rejected: breaks every legacy-mode client, including the SDK default, for no gain |
| Adopt via SDK v2 `createMcpHandler` on the hosted side | Deferred to D2 |

### D2 — Keep the hand-rolled protocol layer for now; prove it with the official suite

> **Superseded by D10** (2026-11-21). Kept as the record of why the first implementation was
> hand-written; the files it names were removed.

**Decision.** Implement D1 in the existing ~650 lines of hand-rolled protocol code (`mcp/server.ts`, `mcp/protocol.ts`, `transport.ts`, `http.adapter.ts`) rather than
switching either transport to `@modelcontextprotocol/server`. Make the **official conformance
suite** the authority on correctness instead of the SDK.

**Why.** The stdio server's zero-dependency design is load-bearing (a bare `oven/bun` image,
no `node_modules`, instant spawn), so the SDK cannot replace it there anyway; adopting it on the
hosted side only would split one protocol implementation into two and break the byte-parity
contract. The hosted adapter also carries behaviour the SDK does not own: per-surface
allowlists, the telemetry seam, the `diag` strip, the plain-400 guard. Standards first is
satisfied by conformance, which is what the SDKs themselves are measured against.

**Revisit when** a 2026-07-28 feature v10r needs (MRTR, subscriptions, Tasks) would cost more
to hand-roll than to adopt, or when conformance failures cluster in protocol code rather than
in v10r's choices.

**SDK as a dependency.** Keep `@modelcontextprotocol/sdk` (v1) as the dev-only interop client
while v1 is maintained (≥ 2027-01-27); add `@modelcontextprotocol/client` (v2) as a second
dev-only interop client. Both are test dependencies, never runtime ones.

### D3 — Fix the fallback version now

**Decision.** Unknown requested version → answer the **latest** supported (`2025-11-25`) on the
hosted transport, matching stdio and the spec's SHOULD. Pin both transports to one constant.

**Why.** Correctness; one source of truth (two transports, two answers today).

### D4 — No Code Mode server, no in-app code execution

**Decision.** Do not wrap v10r's MCP tools into a `code` / `search`+`execute` tool, do not add a
sandbox, and do not add programmatic execution to the in-app agent. Record it as *rejected for
the current workload* with a measurable revisit trigger.

**Why — efficiency must be measurable.** The audit (§5) bounds Code Mode's possible saving at
≈ 1,450 tokens across eight representative tasks, six of which already finish in one call; the
tool list is ≈ 2,360 tokens, ≈ 1.2 % of a 200k window, below the 1–5 % threshold where even
client-side discovery is recommended. Cloudflare's 99.9 % figure comes from a 2,500-endpoint
API; v10r has 8 tools. Results are markdown, so generated code would have to parse prose — the
client guidance itself says typed results need `outputSchema` first.

**Why — security by construction.** Generated code is arbitrary code. On Vercel Node functions
there is no Worker Loader; a sandbox means a new native or Wasm dependency (isolated-vm, Deno,
QuickJS) and a new attack surface on an *unauthenticated* endpoint. In the in-app agent it would
put a script between the model and an approval gate that today sees every call
(`requiresApproval(risk)`), which the threat model (§5) shows is the hardest boundary to keep.

**Why — technology independence.** Cloudflare's safety properties come from its infrastructure;
the portable part is an idea and an interface.

**Revisit triggers.** (a) A v10r MCP surface exceeds ~40 tools or 10k definition tokens; or
(b) a benchmarked workflow shows ≥ 3 chained calls with ≥ 5k intermediate tokens the agent does
not need to read; or (c) the in-app agent gains a read-only bulk-processing need (e.g. summarise
hundreds of desk files) that ordinary tools cannot bound. Each trigger reopens D4 with the
benchmark in [roadmap.md](./roadmap.md) §B2, not with this text.

**Measured (B2, `bun run mcp:bench`, 2026-11-21).** Over the eight workflows on the real
catalogue, in the *lower-bound* model (an oracle script that never reads an intermediate result,
a free sandbox): direct calls with the progressive parameters cost ≈ 25,900 tokens, Code Mode
≈ 20,500 (−21 %). With the tool definitions read from a prompt cache — how clients actually hold
them — it is ≈ 8,900 vs ≈ 6,700: ≈ 2,200 tokens across all eight tasks, of which ≈ 1,900 are the
intermediate results a script could keep out (the audit's hand estimate was ≈ 1,450). Most of
the uncached gap is declaration format (TypeScript ≈ 19 % smaller than JSON Schema), which a
server can also get by tightening its schemas, without a sandbox. None of it pays for generated
code that can fail or for a new attack surface; the decision stands.

### D5 — Progressive discovery stays where it already is

**Decision.** Keep v10r's **result-level** progressive disclosure (detail levels, sections,
browse, outline) as the server's contribution. Do not add a server-side `search_tools`
meta-tool. Let clients do tool discovery (Claude's tool search already defers MCP tool schemas).

**Why.** Progressive complexity: with eight tools there is nothing to discover. The official
guidance places tool discovery in the host; server-side discovery is a roadmap experiment.
Answering the brief's question directly: **progressive discovery and programmatic calling are
independent concerns** — different problems (what is in context vs how calls compose), different
owners (both client-side) — and v10r should support each only through the server-side levers
that help clients: a small, well-described catalogue and bounded, eventually typed, results.

**Measured (B2).** Loading one search meta-tool and three definitions per distinct tool beats
loading all eight only while definitions are paid in full (≈ 18,600 vs ≈ 25,900 tokens over the
eight workflows). With cached definitions it costs twice as much (≈ 18,000 vs ≈ 8,900) and
first wins at **47 tools** — the measured basis of D4's ~40-tool trigger, and a client concern
either way.

### D6 — Tool metadata: re-verify, then adopt `title` and `readOnlyHint` behind an interop test

**Decision.** The 2026-10 omission of `title`/`annotations`/`outputSchema` rests on a client bug
that has not been re-checked. Re-run the live Claude Code check; if fixed, add `title` and
`annotations.readOnlyHint: true` (every public tool is read-only) with a regression test.
Keep `outputSchema`/`structuredContent` deferred until the roadmap's tool-result-shape work
settles *and* Claude Code shows both bodies.

**Why.** Standards first, but compatibility first wins while the dominant client misbehaves.
Annotations may be deprecated (SEP-2200), so they get the cheapest possible adoption.

### D7 — Authorization: keep static bearers for single-holder surfaces

**Decision.** Keep the static-bearer realms for `/api/mcp/private` and `/api/mcp/admin`, and
document them as a deliberate, spec-external choice. Improve what costs nothing: no change to
the token model, but a clearer `WWW-Authenticate` and docs that state the deviation.

**Why.** Both surfaces have exactly one holder. OAuth 2.1 + Protected Resource Metadata + CIMD
would mean running an authorization server for zero additional users. **Revisit when** a
surface gets a second holder or v10r offers per-user MCP access — then OAuth via Better Auth is
the standards path, and it is a product decision (see [README](./README.md) decisions).

### D8 — Extensions: none now

Tasks, MCP Apps, Skills and ext-auth are classified in the [matrix](./matrix.md) and monitored.
None has a v10r use case today: no long-running tool (Tasks), no interactive result that a
text card does not already serve (Apps). Skills over MCP overlaps with pattern cards and is the
one worth an experiment once the extension contract (roadmap) settles.

### D9 — The in-app agent stays off MCP

`TOOL_MANIFEST` + `composeTurn` + the approval gate remain the internal action architecture;
MCP remains the external interface. Neither consumes the other. Bridging them (an MCP client in
the orchestrator, or exposing desk tools over MCP) would create a second permission path for the
same actions. Because the Desk is being refactored, no recommendation here depends on its current
shape.

### D10 — Serve both transports on the official TypeScript SDK v2

**Decision.** Replace the hand-written protocol layer on every endpoint with
`@modelcontextprotocol/server` 2.4.0 (exact pin, runtime dependency). One module,
`mcp/tool-server.ts`, turns a v10r tool registry into an SDK `McpServer`; the stdio server runs
it through `serveStdio`, the hosted adapter through `createMcpHandler` (2026-07-28, `legacy:
'reject'`, `maxSubscriptions: 0`) behind `isLegacyRequest`, with legacy requests on a stateless
`WebStandardStreamableHTTPServerTransport` in JSON mode — the SDK's documented composition. The
stdio container keeps its contract (bare `oven/bun`, `--network=none`, `:ro`, no
`node_modules`) by running a committed, digest-checked bundle (`mcp/server.bundle.js`), started by the unchanged entry `mcp/server.ts` so existing registrations keep working.

**Why — official implementations by default.** D2's premise was that the SDK could not run in
the zero-dependency container; bundling removes that premise, so the measured case decides.
The SDK owns framing, both eras, negotiation, header validation, error codes and cache hints
— ~1,000 lines v10r no longer maintains, and future revisions arrive as a version bump checked
by the conformance lane rather than as a hand port. On the 2026-07-28 suite the SDK passes
more `server-stateless` checks than the hand-written code did.

**What stays v10r's.** The per-surface registries and their hard allowlist (the SDK serves
only registered names), the registry as the single argument validator (pass-through validator,
so next actions and `diag` survive), the generic error on a thrown tool (the SDK's fallback
would put the raw exception on the wire), the `diag` strip, the build `_meta`, Origin checks,
bounded bodies, rate limits, bearer auth and the one-observation-per-POST telemetry.

**Measured cost** (2026-11-21, Bun 1.4.4, medians). Stdio cold start to the `initialize` answer
29 → 79 ms (bundle), idle RSS 36 → 47 MB, 0.24 → 0.32 ms per call: module initialisation of
the SDK and zod, paid once per spawned container. Hosted in-process handling ~30 → ~200 µs per
request, under 1 % of a network round trip. Wire bytes and the token benchmark are unchanged.

**Behaviour that changed**, all toward the spec or the SDK reference: an unknown tool is a
JSON-RPC -32602 error in both eras (was an `isError` result on the legacy path); a legacy POST
without `Accept: application/json, text/event-stream` gets 406; an unknown
`MCP-Protocol-Version` gets the SDK's 400 -32000 naming the supported list; stdio pins one era
per connection; a stdio parse error is dropped rather than answered; build `_meta` rides on
`tools/call` results only; `tools/call` arguments that are not an object are a -32602 protocol
error (the registry still judges every object, missing arguments arrive as `{}`).

**Two things the adapter keeps in front of the SDK** (release hardening, 2026-11-22), each a
trust-boundary policy rather than protocol code:
- *JSON-RPC batches are refused* (400 / -32600) on HTTP. The SDK serves them on the legacy leg,
  but rate limits count POSTs and telemetry records one call per POST: a batch ran N tool calls
  for one request and recorded none of them by name. Only 2025-03-26 required accepting batches.
- *`subscriptions/listen` is not implemented* on HTTP (404 / -32601). The method is optional in
  effect: its stream only carries list-changed and resource-update notifications, and v10r
  declares neither. The SDK serves it unconditionally — first answered here with its in-band
  -32603 "Subscription limit reached" (`maxSubscriptions: 0`), which misstates a supported but
  full method — so the adapter answers before it. Conformance reports the three listen checks as
  not applicable. Worth raising upstream: the SDK could decline listen itself when no
  subscription-delivered capability is declared.

**Revisit when** an SDK release regresses conformance or the cold-start budget, or v10r needs a
behaviour the SDK cannot express — then the hand-written layer in git history (`76ce97e`) is
the fallback, not a fork of the SDK.

**Alternatives.**

| Option | Verdict |
|---|---|
| A — bundle the SDK into the stdio server | **Chosen**: keeps the container contract; one 556 KB file, no install, no network |
| B — minimal runtime (install `node_modules` into the image, or a custom image) | Rejected: a second image to maintain and a writable layer or network at first run |
| C — keep the hand-written stdio server, SDK on HTTP only | Rejected: two protocol implementations for one contract, the split D2 itself warned about |
| Bun bytecode bundle | Rejected: 55 ms cold start, but a 1.6 MB Bun-version-specific artifact that breaks on any image bump |

## 4. Rejected or unnecessary — the attractive ideas

| Idea | Why not |
|---|---|
| Cloudflare Code Mode server for the pattern tools | D4: ≈ 0 measurable benefit at 8 tools; needs a sandbox Vercel does not provide; vendor-specific safety |
| Generic `eval`/`vm` "lightweight" code mode | `node:vm` is not a security boundary; never acceptable on an unauthenticated endpoint |
| Server-side `search_tools` / `get_tool_details` meta-tools | D5: nothing to discover; adds a round trip to every task |
| A second MCP registry for 2026-07-28 tools | One contract already feeds both eras; the era is an envelope, not a catalogue |
| Running the SDK from `node_modules` in the stdio container | Breaks the no-install container invariant; D10 bundles it instead |
| `Mcp-Session-Id` or any server session | Removed from the spec; v10r never had one; telemetry is per request by design |
| Tasks extension for "async" tools | Every tool answers in < 2 ms |
| OAuth for the operator surfaces | D7: an authorization server for one user |
| Dependency bot for MCP packages, nightly conformance runs | Process §Noise: monthly review covers it; v10r has no CI to attach a bot to |
| MCP client inside the in-app agent | D9: second permission path |

## 5. Threat model for programmatic execution

Required by the brief before any recommendation to adopt programmatic execution. The verdict is
the reason D4 rejects it *now*; the controls are the bar a future proposal must clear.

| Threat | Exposure if v10r added Code Mode | Required control (all MUST) | Existing v10r asset |
|---|---|---|---|
| Arbitrary code execution / sandbox escape | Model-written code runs on a Vercel function next to secrets and the DB pool | Separate isolate with no ambient authority: no `fs`, `process`, `require`, env, network; CPU and memory caps; never `node:vm`/`eval` | None on Vercel; the stdio container's `--network=none :ro` model is the right shape |
| Unauthorized tool invocation | Code calls any function it can name | The sandbox receives only the per-surface registry's allowlist; dispatch still goes through the per-surface registry's hard allowlist | Per-registry allowlist (`createToolServer` registers only the registry's tools) |
| Nested calls bypass approval | One approved script performs many writes | Each nested call is authorized individually against the grant; write/destructive calls pause the script (no batch approval) | `requiresApproval(risk)`, proposals, receipts — but a pausing script is replay machinery v10r does not have |
| Credential exposure | Tokens or keys reachable from code or results | Credentials stay host-side in the call broker; results scrubbed before entering the sandbox | `telemetry/scrub.ts`, bearer never echoed |
| Prompt injection via descriptions/results | Injected text steers generated code, which then acts at machine speed | User-origin results stay `<untrusted-content>`; no tool with `reach: 'external'` callable from code | `untrusted-content.ts`, `resultOrigin`/`reach` gates |
| Network access / exfiltration | `fetch` from the sandbox | `globalOutbound: null` equivalent; no outbound at all | Public tools have no reach; stdio has `--network=none` |
| Resource exhaustion / DoS | Infinite loops, huge allocations on an unauthenticated endpoint | Hard wall-clock, CPU and memory limits; per-IP rate limit counts executions, not requests | 60 req/min limiter, 10 s `maxDuration` |
| Cross-user isolation | Warm isolates or module state reused across callers | Fresh isolate per execution; no module-level mutable state | Observer built per request (public `+server.ts`) |
| Auditability / provenance | Which code made which call | Persist script hash + every nested call with its parent id | `mcp.call_log` (one row per request, `trace_id`), turn traces |
| Client compatibility | Clients without code support see one opaque `code` tool | Keep the typed tools; code mode only as an additional surface | Typed tools today |

**Verdict.** Five of ten controls have no implementation in v10r's runtime, and the benefit is
≈ 0 at this catalogue size. Rejected now; the table is the acceptance checklist if a revisit
trigger fires.

## 6. Consequences

- v10r stays compatible with every current client while gaining a verified 2026-07-28 path.
- D10 adds one runtime dependency, `@modelcontextprotocol/server` (exact pin), inlined into the
  stdio bundle; two dev-only clients and a pinned conformance runner remain.
- The forward-compatibility guard was retired only together with the modern path, as its own
  comment required (2026-11-21, `5b825e0`); a plain 400 remains only for unknown pre-2026 headers.
- The one recurring cost is the monthly review (≈ 30 min) in [process.md](./process.md).
