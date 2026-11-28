# MCP protocol evolution

> Generated from `pattern-library/registry.json` by `scripts/agent-skills/build.ts` — do not edit; change the registry and run `bun run skills:build`.

**Kind:** pattern — build it in the target project

**Category:** Architecture & Request Pipeline · **Tier:** deep · **Maturity:** proven (verified 2026-11-21) · **Risk:** low — protocol layer owned by the official SDK, pinned exactly; both eras pinned by the SDK clients and the conformance suite

One endpoint serves both MCP generations — the 2025 initialize handshake and the stateless 2026-07-28 per-request _meta protocol — through the official TypeScript SDK v2, composed over the existing tool registries by one bridge module, with the official conformance suite and SDK clients as the regression authority and a benchmark that prices alternatives before anything is adopted.

**When to use:** Reach for this when an MCP server must move to a new protocol revision without breaking the clients still on the old one, or when deciding whether a new MCP capability (Code Mode, tool discovery, an extension) is worth adopting.

## Avoid when

- Every caller is pinned to one revision you control — serve that revision alone
- Your runtime cannot take a dependency at all and cannot run a bundle — then a hand-written layer proven by the conformance suite is the fallback
- Adopting a capability because a vendor ships it — the benchmark and the conformance lane decide

## Alternatives

- **Hand-write the protocol layer (framing, both eras, header checks) and prove it with the conformance suite** — prefer when a measured constraint rules the SDK out — cold start, artifact size or a runtime it does not support
- **Serve only the newest revision behind a separate endpoint** — prefer when the old clients can be pointed at a different URL and the two eras never need one registration

## Docs

- `docs/blueprint/architecture/mcp-evolution/README.md` — Hub: the answers, the decisions and where each file fits ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/architecture/mcp-evolution/README.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/architecture/mcp-evolution/README.md))
- `docs/blueprint/architecture/mcp-evolution/decision-record.md` — D1–D10: dual-era, the official SDK on every endpoint (D10), Code Mode and server-side discovery rejected with revisit triggers ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/architecture/mcp-evolution/decision-record.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/architecture/mcp-evolution/decision-record.md))
- `docs/blueprint/architecture/mcp-evolution/matrix.md` — The living compatibility record the monthly review updates ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/architecture/mcp-evolution/matrix.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/architecture/mcp-evolution/matrix.md))
- `docs/blueprint/architecture/mcp-evolution/process.md` — Sources, the monthly review with its SDK bump check, event-driven reviews, the conformance lane, what counts as worth adopting ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/architecture/mcp-evolution/process.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/architecture/mcp-evolution/process.md))
- `docs/blueprint/architecture/hosted-mcp.md` — How the hosted adapter composes the SDK for both eras ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/architecture/hosted-mcp.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/architecture/hosted-mcp.md))

## Code

- `mcp/tool-server.ts` — createToolServer: one tool registry → one SDK McpServer, shared by both transports; registry-owned validation, generic error on a throw ([GitHub](https://github.com/ApeDevil/v10r/blob/main/mcp/tool-server.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/mcp/tool-server.ts))
- `src/lib/server/mcp/http.adapter.ts` — respondToMcpPost: isLegacyRequest → stateless JSON transport or createMcpHandler, one telemetry observation per POST ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/mcp/http.adapter.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/mcp/http.adapter.ts))
- `mcp/stdio-server.ts` — The stdio server: serveStdio over the same bridge, shipped as a bundle the dependency-free entry mcp/server.ts starts ([GitHub](https://github.com/ApeDevil/v10r/blob/main/mcp/stdio-server.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/mcp/stdio-server.ts))
- `scripts/mcp/build-stdio-bundle.ts` — Bundles the SDK into the zero-install stdio container's server; digest-checked staleness gate ([GitHub](https://github.com/ApeDevil/v10r/blob/main/scripts/mcp/build-stdio-bundle.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/scripts/mcp/build-stdio-bundle.ts))
- `scripts/mcp/conformance.ts` — The pinned official conformance runner per revision, with per-check baselines ([GitHub](https://github.com/ApeDevil/v10r/blob/main/scripts/mcp/conformance.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/scripts/mcp/conformance.ts))
- `scripts/mcp/interface-strategies.ts` — Offline cost model of direct calls, Code Mode, discovery and a hybrid, with the catalogue-size crossover ([GitHub](https://github.com/ApeDevil/v10r/blob/main/scripts/mcp/interface-strategies.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/scripts/mcp/interface-strategies.ts))

## Tests

- `src/lib/server/mcp/sdk-interop.test.ts` — SDK v1 and v2 clients (legacy, auto, pin) against HTTP, stdio source and the stdio bundle; validate gate ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/mcp/sdk-interop.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/mcp/sdk-interop.test.ts))
- `src/lib/server/mcp/http.test.ts` — Both eras through the production adapter: admission errors, caching hints, unknown tool -32602, Accept rule ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/mcp/http.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/mcp/http.test.ts))
- `mcp/server.test.ts` — The stdio server over SDK in-memory connections, both eras; tool list byte-identical to the registry ([GitHub](https://github.com/ApeDevil/v10r/blob/main/mcp/server.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/mcp/server.test.ts))

## Invariants

- The protocol is the official SDK's; the bridge owns only which tools a surface exposes, how a call reaches the dispatcher and the error hygiene around it — no protocol rule is re-implemented beside the SDK.
- Both eras and both transports build their server from one factory over the same registry, so a tool cannot exist in one era or transport and not the other.
- The registry stays the single argument validator: tools are advertised with their JSON Schema but registered with a pass-through validator, so recovery hints and telemetry diagnostics survive.
- A tool that throws answers a bounded generic error; the exception reaches only the server-side log, never the wire.
- The dependency-free container runs a committed bundle whose input digest the gate checks — a source or SDK change cannot ship without rebuilding it.
- Conformance baselines list only capabilities the server does not advertise or fixture tools it has no reason to expose, per check; a genuine failure is fixed, never baselined.
- A capability is adopted only on a stable standard the conformance suite checks, a security gap, a measured gain in mcp:bench, or a client that requires it.

## Emulation notes

- Start from mcp/tool-server.ts: it is the whole adaptation layer between a registry and the SDK; pick serveStdio or createMcpHandler per transport.
- On serverless, refuse subscriptions/listen (maxSubscriptions: 0) and serve legacy requests on a stateless transport with JSON responses so no answer streams.
- Pin the SDK exactly and bump it only after the conformance lane and the interop tests hold; keep the conformance lane out of the always-on gate (it needs a running server and the network).
- Before adding Code Mode or tool discovery, extend the benchmark with your own workflows: at v10r's eight tools, discovery only beats direct calls with cached definitions past ~47 tools.

## Depends on

- [Multi-client core](multi-client-core.md)

---

_Machine-readable record: `mcp-protocol-evolution` in `pattern-library/registry.json`._
