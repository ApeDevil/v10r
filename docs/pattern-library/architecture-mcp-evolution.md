---
title: "MCP protocol evolution (dual-era serving, conformance lane, evidence-gated adoption)"
description: "One endpoint serves both MCP generations — the 2025 initialize handshake and the stateless 2026-07-28 per-request _meta protocol — routed per message by one…"
category: "Architecture & Request Pipeline"
---

# MCP protocol evolution (dual-era serving, conformance lane, evidence-gated adoption)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Category:** Architecture & Request Pipeline · **Tier:** deep · **Maturity:** proven (verified 2026-11-21 @ 5b825e0) · **Risk:** low — protocol layer only; both eras pinned by the official SDK clients and conformance suite

One endpoint serves both MCP generations — the 2025 initialize handshake and the stateless 2026-07-28 per-request _meta protocol — routed per message by one shared module over the existing tool registries, with the official conformance suite and SDK clients as the regression authority and a benchmark that prices alternatives before anything is adopted.

**When to use:** Reach for this when an MCP server must move to a new protocol revision without breaking the clients still on the old one, or when deciding whether a new MCP capability (Code Mode, tool discovery, an extension) is worth adopting.

## Avoid when

- Every caller is pinned to one revision you control — serve that revision alone
- The server is built on the official SDK — its own dual-era entry point does the routing
- Adopting a capability because a vendor ships it — the benchmark and the conformance lane decide

## Alternatives

- **Rebuild the server on @modelcontextprotocol/server v2, which ships dual-era routing** — prefer when the server can take a runtime dependency and the hand-written protocol layer has no reason to stay zero-dependency
- **Serve only the newest revision behind a separate endpoint** — prefer when the old clients can be pointed at a different URL and the two eras never need one registration

## Docs

- `docs/blueprint/architecture/mcp-evolution/README.md` — Hub: the answers, the decisions and where each file fits ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/architecture/mcp-evolution/README.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/architecture/mcp-evolution/README.md))
- [docs/blueprint/architecture/mcp-evolution/decision-record.md](/docs/blueprint/architecture/mcp-evolution/decision-record) — D1–D9: dual-era, hand-written protocol, Code Mode and server-side discovery rejected with revisit triggers ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/architecture/mcp-evolution/decision-record.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/architecture/mcp-evolution/decision-record.md))
- [docs/blueprint/architecture/mcp-evolution/matrix.md](/docs/blueprint/architecture/mcp-evolution/matrix) — The living compatibility record the monthly review updates ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/architecture/mcp-evolution/matrix.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/architecture/mcp-evolution/matrix.md))
- [docs/blueprint/architecture/mcp-evolution/process.md](/docs/blueprint/architecture/mcp-evolution/process) — Sources, monthly and event-driven reviews, the conformance lane, what counts as worth adopting ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/architecture/mcp-evolution/process.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/architecture/mcp-evolution/process.md))
- [docs/blueprint/architecture/hosted-mcp.md](/docs/blueprint/architecture/hosted-mcp) — How the hosted transport serves both eras ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/architecture/hosted-mcp.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/architecture/hosted-mcp.md))

## Code

- `mcp/protocol-era.ts` — routeMcpRequest (body-primary era routing, envelope and header checks), discover and result dressing — shared by both transports ([GitHub](https://github.com/ApeDevil/v10r/blob/main/mcp/protocol-era.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/mcp/protocol-era.ts))
- `mcp/protocol-version.ts` — The legacy and modern revision lists and the fallback, declared once ([GitHub](https://github.com/ApeDevil/v10r/blob/main/mcp/protocol-version.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/mcp/protocol-version.ts))
- `src/lib/server/mcp/transport.ts` — Hosted dispatch: answerLegacy and answerModern over the one registry ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/mcp/transport.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/mcp/transport.ts))
- `scripts/mcp/conformance.ts` — The pinned official conformance runner per revision, with per-check baselines ([GitHub](https://github.com/ApeDevil/v10r/blob/main/scripts/mcp/conformance.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/scripts/mcp/conformance.ts))
- `scripts/mcp/interface-strategies.ts` — Offline cost model of direct calls, Code Mode, discovery and a hybrid, with the catalogue-size crossover ([GitHub](https://github.com/ApeDevil/v10r/blob/main/scripts/mcp/interface-strategies.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/scripts/mcp/interface-strategies.ts))

## Tests

- `src/lib/server/mcp/sdk-interop.test.ts` — SDK v1 and v2 clients (legacy, auto, pin) against both transports; validate gate ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/mcp/sdk-interop.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/mcp/sdk-interop.test.ts))
- `src/lib/server/mcp/http.test.ts` — Modern admission: -32020/-32022/-32602, 404 for removed methods, caching hints, the legacy path byte-identical ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/mcp/http.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/mcp/http.test.ts))
- `mcp/server.test.ts` — The stdio server's modern path ([GitHub](https://github.com/ApeDevil/v10r/blob/main/mcp/server.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/mcp/server.test.ts))

## Invariants

- The era is decided per request from the body's _meta claim, never from a header alone — headers are checked against the body, so a proxy that drops one cannot change the era.
- Both eras dispatch through the same tool registry and dispatcher; the era changes admission and result dressing only, so a tool cannot exist in one era and not the other.
- The legacy path stays byte-identical: no resultType, no caching hints, no header rules; a header naming an unknown pre-2026 revision keeps its plain non-JSON-RPC 400.
- -32022 lists the modern revisions only, exactly what server/discover advertises — never a legacy revision.
- Conformance baselines list only capabilities the server does not advertise or fixture tools it has no reason to expose, per check; a genuine failure is fixed, never baselined.
- A capability is adopted only on a stable standard the conformance suite checks, a security gap, a measured gain in mcp:bench, or a client that requires it.

## Emulation notes

- Port mcp/protocol-era.ts as is: it has no imports beyond the version list, so it fits a zero-dependency server and a framework one alike.
- Keep the conformance lane out of the always-on gate (it needs a running server and the network) and keep in-process SDK interop tests in it.
- Before adding Code Mode or tool discovery, extend the benchmark with your own workflows: at v10r's eight tools, discovery only beats direct calls with cached definitions past ~47 tools.

## Depends on

- [Multi-client core (hexagonal domain modules)](/docs/pattern-library/multi-client-core)

---

_Machine-readable record: `architecture-mcp-evolution` in `pattern-library/registry.json`._
