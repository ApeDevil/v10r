# MCP state of the art (reviewed 2026-11-21)

An evidence-based review of where the Model Context Protocol stands, what Code Mode and
progressive discovery actually are, and which developments matter for v10r. Every claim names
its source. Status words follow one vocabulary, used again in the [matrix](./matrix.md):

| Status | Meaning |
|---|---|
| **Stable standard** | Normative text in a released specification revision |
| **Official extension** | An `io.modelcontextprotocol/*` extension in an official `ext-*` repository, negotiated per request, off by default |
| **Official guidance** | Non-normative documentation on modelcontextprotocol.io (best practices) |
| **Roadmap / proposal** | Listed on the roadmap or an open SEP. Not adopted |
| **Vendor-specific** | One vendor's product or API |
| **Experimental** | Early-stage tools or concepts with no stability promise |

A roadmap item is never described here as adopted.

---

## 1. The specification

### 1.1 Revisions

| Revision | State | Notes |
|---|---|---|
| `2026-07-28` | **Current** ([versioning](https://modelcontextprotocol.io/specification/versioning)) | Released 2026-07-28 ([announcement](https://blog.modelcontextprotocol.io/posts/2026-07-28/)); RC locked 2026-05-21 ([RC post](https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/)) |
| `2025-11-25` | Final | The revision v10r implements today |
| `2025-06-18`, `2025-03-26` | Final | Still negotiable by v10r |
| `draft` | Empty | "Changes since the most recent release will accumulate here" ([draft changelog](https://modelcontextprotocol.io/specification/draft/changelog)) |

A **feature lifecycle policy** (SEP-2596) now guarantees at least twelve months between a
deprecation and the earliest removal ([RC post](https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/)).
That is the planning horizon for every migration below.

### 1.2 What 2026-07-28 changed (stable standard)

Source: [2026-07-28 changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog)
unless another link is given.

| Change | Normative content | SEP |
|---|---|---|
| **Stateless core** | `initialize` / `notifications/initialized` removed; protocol sessions and `Mcp-Session-Id` removed. Every request carries `_meta["io.modelcontextprotocol/protocolVersion"]` and `…/clientCapabilities`; `…/clientInfo` SHOULD. Cross-call state uses server-minted handles passed as tool arguments | 2575, 2567 |
| **`server/discover`** | Servers MUST implement it; clients MAY call it. Result: `supportedVersions`, `capabilities`, `_meta[…/serverInfo]` (SHOULD), optional `instructions`, plus caching hints ([discover](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)) | 2575 |
| **Routing headers** | `Mcp-Method` on every Streamable HTTP POST; `Mcp-Name` for `tools/call`, `resources/read`, `prompts/get`; `MCP-Protocol-Version` MUST match the `_meta` value. Disagreement or absence → HTTP 400 + `HeaderMismatch` (-32020). Unknown method → HTTP 404 + -32601 ([streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)) | 2243 |
| **Cacheable lists** | `ttlMs` (integer ≥ 0, `max-age`-like) and `cacheScope` (`public` \| `private`) MUST be on complete results of `server/discover`, `tools/list`, `prompts/list`, `resources/list`, `resources/templates/list`, `resources/read`. ETags are *not* in this revision ([caching](https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/caching)) | 2549 |
| **Multi Round-Trip Requests (MRTR)** | A server answers `resultType: "input_required"` with `inputRequests`; the client retries with `inputResponses` and the echoed `requestState`. Replaces server-initiated `elicitation/create`, `sampling/createMessage`, `roots/list` | 2322 |
| **`resultType`** | Required on all results (`complete` \| `input_required`); clients treat its absence from older servers as `complete` | 2322 |
| **`subscriptions/listen`** | Replaces the HTTP GET stream and `resources/subscribe`/`unsubscribe`; clients opt in per notification type | 2575 |
| **Removed** | `ping`, `logging/setLevel` (log level per request via `_meta`), SSE resumability (`Last-Event-ID`) | 2575 |
| **Error codes** | -32000…-32019 implementation-defined; -32020…-32099 reserved. `HeaderMismatch` -32020, `MissingRequiredClientCapability` -32021, `UnsupportedProtocolVersion` -32022. Resource-not-found -32002 → -32602 | 2164 |
| **Schemas** | `inputSchema`/`outputSchema` accept any JSON Schema 2020-12 keyword; `structuredContent` accepts any JSON value; `tools/list` SHOULD be deterministic in order | 2106 |
| **Tracing** | `traceparent`, `tracestate`, `baggage` documented as `_meta` keys | 414 |
| **Extensions framework** | `extensions` map in client and server capabilities; reverse-DNS ids; independently versioned `ext-*` repositories ([extensions](https://modelcontextprotocol.io/extensions/overview)) | 2133 |

**Deprecated, not removed** (≥ 12 months): Roots, Sampling, Logging (SEP-2577); the HTTP+SSE
transport; `includeContext` `thisServer`/`allServers`; OAuth Dynamic Client Registration in
favour of Client ID Metadata Documents.

### 1.3 Backward compatibility — the part that decides migration order

Source: [lifecycle](https://modelcontextprotocol.io/specification/2026-07-28/basic/lifecycle) and
[streamable HTTP §Backward Compatibility](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http).

- **A modern client probes, then falls back.** On HTTP 400 it "SHOULD inspect the response body
  before falling back": a recognised modern JSON-RPC error (-32022, -32021, header errors) means
  *this server is modern, correct the request*; an empty or unrecognised body means *fall back to
  `initialize`*. Clients cache the era per origin.
- **Dual-era servers are explicitly allowed.** "A server that wishes to support both legacy
  clients … and modern clients … MAY implement both behaviors", "on the same endpoint or
  process"; an `initialize` request selects legacy semantics.
- **Modern-only servers** answer GET/DELETE with 405, ignore `Mcp-Session-Id` and
  `Last-Event-ID`, and never mint session ids.

Consequence: **adopting 2026-07-28 is additive.** Nothing in the spec forces a server to drop
`initialize`; a dual-era endpoint serves both client generations.

### 1.4 Authorization (stable standard)

Source: [2026-07-28 authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization).

- "Authorization is **OPTIONAL** for MCP implementations." HTTP transports that use it SHOULD
  conform; stdio SHOULD NOT and takes credentials from the environment.
- Conforming servers MUST publish OAuth 2.0 Protected Resource Metadata (RFC 9728), MUST validate
  that tokens were issued for them (audience), MUST NOT pass tokens through, and SHOULD send
  `scope` in `WWW-Authenticate`; insufficient scope → 403 `insufficient_scope` for step-up.
- Clients MUST send RFC 8707 `resource`, MUST validate RFC 9207 `iss`, SHOULD support Client ID
  Metadata Documents; DCR is MAY and deprecated.
- Static API keys are not described by the spec at all: they are outside it, not forbidden.

### 1.5 Security guidance

- **Official** ([security best practices](https://modelcontextprotocol.io/specification/2026-07-28/basic/security_best_practices)):
  confused deputy, token passthrough ("MUST NOT accept any tokens that were not explicitly issued
  for the MCP server"), SSRF on metadata discovery, *state-handle hijacking* (replaces session
  hijacking: "MUST NOT treat possession of a state handle as authentication"), local server
  compromise, scope minimisation.
- **OWASP MCP Top 10** (beta v0.1, [owasp.org](https://owasp.org/www-project-mcp-top-10/)):
  MCP01 token mismanagement · MCP02 scope creep · MCP03 tool poisoning · MCP04 supply chain ·
  MCP05 command injection · MCP06 intent-flow subversion / prompt injection · MCP07 insufficient
  authN/authZ · MCP08 lack of audit and telemetry · MCP09 shadow MCP servers · MCP10 context
  over-sharing.

---

## 2. Official extensions

| Extension | Id | What it is | Relevance to v10r |
|---|---|---|---|
| Tasks | `io.modelcontextprotocol/tasks` (SEP-2663) | Long-running work as task handles: `tasks/get` polling, `tasks/update`, `tasks/cancel`; `tasks/list` removed. Roadmap aims at eventual core inclusion | None today: every v10r tool answers in under 2 ms (`results.json` latency) |
| MCP Apps | `io.modelcontextprotocol/ui` (SEP-1865) | Server-declared UI rendered by hosts in a sandboxed iframe | Possible later for `/studio/architecture` results; not a need |
| Skills | `ext-skills` (SEP-2640) | Agent Skills read through MCP resources; SDK support "experimental `attach`" in TS SDK 2.4.0 | Interesting overlap with pattern cards; monitor |
| Auth | `ext-auth` | OAuth client credentials, Enterprise-Managed Authorization | Machine-to-machine auth for the operator surfaces, if ever needed |

## 3. Roadmap (not adopted)

Source: [roadmap](https://modelcontextprotocol.io/development/roadmap) (last updated 2026-08-22;
"current thinking rather than firm commitments").

- **Improved primitives:** *tool result shape* redesign (`content` vs `structuredContent`);
  *progressive discovery* as experimental **server-side** discovery; *primitive annotations*
  possibly deprecated if unused (SEP-2200).
- **Transport:** HTTP over stdio as the single binding; ETags for results (building on SEP-2549).
- **Identity:** DPoP, workload identity federation (SEP-1933), ID-JAG, token exchange.
- **Messaging:** server-initiated events and triggers composed with Tasks.
- **SDK:** an extension contract; spec-generated SDKs validated by conformance.

Two of these bear directly on decisions v10r has already made: the result-shape redesign
(v10r returns text only) and the possible deprecation of annotations (v10r omits them).

---

## 4. SDKs, conformance and clients

| Item | State (verified 2026-11-21) | Source |
|---|---|---|
| TypeScript SDK v2 | Stable line since 2026-07-27, split into `@modelcontextprotocol/server`, `/client`, `/core`, plus `/node`, `/express`, `/hono`, `/fastify` adapters, `/server-legacy`, `/codemod`. Latest `2.4.0`. Web-standard APIs (runs on Bun, Deno, Workers). Standard Schema: Zod v4, **Valibot**, ArkType | [README](https://github.com/modelcontextprotocol/typescript-sdk), npm |
| TypeScript SDK v1 | `@modelcontextprotocol/sdk` on the `v1.x` branch, latest `1.32.2`; bug and security fixes "for at least six months after the v2 release" — i.e. until at least ~2027-01-27 | [README](https://github.com/modelcontextprotocol/typescript-sdk) |
| SDK v2 client default | `versionNegotiation.mode` defaults to **`'legacy'`**; `LATEST_PROTOCOL_VERSION` export is `2025-11-25`. `'auto'` probes `server/discover` first and falls back; `{ pin }` refuses legacy servers | `@modelcontextprotocol/client@2.4.0` type declarations, run locally |
| Conformance suite | `@modelcontextprotocol/conformance` — `0.1.16` (latest tag) covers 2025-06-18 / 2025-11-25; `0.2.0-alpha.12` adds the 2026-07-28 scenarios (`server-stateless`, `http-header-validation`, `caching`, `input-required-result-*`, …). Supports an expected-failures baseline file and a GitHub Action | [repo](https://github.com/modelcontextprotocol/conformance), npm |
| Claude clients | "Support is being rolled out across Claude products" (2026-07-28); no per-surface status published | [Claude blog](https://claude.com/blog/bringing-mcp-2026-07-28-to-claude) |

The default of the reference client is the strongest signal about urgency: four months after
the release, the official SDK still connects in the legacy era unless told otherwise.

---

## 5. Tool efficiency

Three separate ideas are often merged under "Code Mode". They have different owners.

### 5.1 Progressive tool discovery — client-side, official guidance

[Client best practices](https://modelcontextprotocol.io/docs/2026-07-28/develop/clients/client-best-practices)
(§Progressive Tool Discovery):

- "The host fetches tool definitions via `tools/list` as normal, but defers injecting them into
  the model's context", exposing a `search_tools` meta-tool; three layers catalog → inspect →
  execute.
- For a small set "loading all tools is fine"; switch when definitions take a significant share
  of the window, "for example, 1%–5%".
- Prefer the platform's own tool search where it exists. Anthropic's tool search tool
  ([docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool),
  **vendor-specific**) recommends it at "10 or more tools", "more than 10k tokens" of
  definitions, or "200+ tools" across MCP servers, and works with MCP connector tools via
  `defer_loading` on the toolset.
- Prompt-cache warning: changing tool definitions mid-conversation invalidates the cache, "and
  the resulting miss can cost more tokens than the definitions you removed".
- **Server-side** progressive discovery exists only as a roadmap item (§3).

So discovery of *tools* is a client responsibility. What a server controls is how big its tool
list is and how much each *result* costs — which is a different, server-side kind of progressive
disclosure (v10r already does this; see the [audit](./audit.md) §5).

### 5.2 Programmatic tool calling — client-side, official guidance plus vendor APIs

Same page, §Programmatic Tool Calling / Code Mode:

- "Instead of calling tools directly, the model writes code that calls tools. The code executes
  in a sandboxed environment, and only the final result returns to the model." It "requires
  clients to implement a sandbox environment."
- Typed APIs are generated from `inputSchema` **and `outputSchema`**; without `outputSchema`,
  "the real fix is for server authors to provide `outputSchema`".
- Security: "Approving the script does not grant blanket approval for every tool call it makes
  at runtime" — the broker evaluates each call; tool results from one server are untrusted input
  to another; network isolation; host-held credentials; resource limits; filter console output.
- Sandboxes named as examples, not endorsements: Deno, isolated-vm, Wasmtime; pctx and Monty as
  early-stage.
- Anthropic's **programmatic tool calling** ([docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/programmatic-tool-calling),
  vendor-specific) runs in Anthropic's code-execution container, uses `allowed_callers`, and
  states that "Tools provided by an MCP connector" **cannot** be called programmatically, and
  that `allowed_callers` is not a security boundary.

### 5.3 Cloudflare Code Mode — vendor-specific, experimental

Sources: [Code Mode (2025)](https://blog.cloudflare.com/code-mode/),
[Code Mode MCP server (2026)](https://blog.cloudflare.com/code-mode-mcp/),
[build guide](https://developers.cloudflare.com/agents/model-context-protocol/guides/build-codemode-mcp-server/),
[API reference](https://developers.cloudflare.com/agents/tools/codemode/api-reference/),
[how it works](https://developers.cloudflare.com/agents/tools/codemode/how-it-works/).

| Aspect | Fact |
|---|---|
| Idea | Convert tools to a TypeScript API and let the model write code against it; run it in a fresh V8 isolate |
| Server shapes | `codeMcpServer({ server, executor })` wraps an MCP server into one `code` tool whose description carries the generated declarations; `openApiMcpServer({ spec, executor, request })` exposes `search` + `execute` over an OpenAPI document that stays inside the sandbox |
| Packages | `@cloudflare/codemode` (core, connectors), `/mcp`, `/ai`, `/tanstack-ai`, `/browser`, `/vite`; built on the MCP TypeScript SDK |
| Executor | `interface Executor { execute(code, fns, options?) }` is public and pluggable. Implementations: `DynamicWorkerExecutor` (Workers Dynamic Worker Loader, `globalOutbound: null` by default, 60 s timeout) and `IframeSandboxExecutor` (browser, 30 s, cannot pre-empt a synchronous loop). No Node or Bun executor is documented |
| Claimed benefit | Cloudflare API: 2,500+ endpoints, "over 2 million tokens" as tools → "roughly 1,000 tokens" with two tools; measured with tiktoken, no task-level methodology published |
| Security stance | "Code execution does not replace authorization"; the token "never enters the sandbox"; `codeMcpServer()`/`openApiMcpServer()` provide no per-operation approval — the durable runtime's `requiresApproval` pauses and replays |
| Limits | Marked "experimental and may have breaking changes"; replay requires identical call order (`Promise.all` can diverge); rejecting an action does not undo earlier ones; final responses capped near 6,000 estimated tokens |

**Standard vs vendor:** the tools Code Mode calls are ordinary MCP tools and the outer `code`
tool is an ordinary MCP tool. Everything that makes it safe — Worker Loader isolates, outbound
control, Durable Object replay — is Cloudflare infrastructure. The portable part is the *idea*
and the `Executor` interface.

**Where it wins, by its own numbers:** a very large catalogue (thousands of endpoints) or
chained calls whose intermediate results are large and machine-processable. Both conditions
are absent in v10r (see [audit](./audit.md) §5 and [decision record](./decision-record.md) §4).

### 5.4 Combining them

The client best-practice page closes with "Combining Both Patterns": discovery decides *which*
tools are in context, programmatic calling decides *how* they are composed. They are independent
— a client can do either without the other — and both live in the host, not the server.

---

## 6. What this means for a server like v10r

1. The protocol modernization that applies to a **server** is the 2026-07-28 dual-era adoption
   (discover, `_meta`, headers, caching hints, `resultType`, error codes). It is additive.
2. Progressive discovery and programmatic calling are **client** features. A server helps them by
   keeping its catalogue small and well-described, results bounded, and — when clients handle it
   — `outputSchema` + `structuredContent` so generated code can consume results.
3. Code Mode as a *server* shape (wrap your tools into one `code` tool) pays off only above a
   catalogue size v10r is two orders of magnitude below, and needs a sandbox v10r's runtime
   (Vercel Node functions, a bare Bun stdio container) does not provide.
