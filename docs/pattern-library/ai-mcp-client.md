---
title: "MCP client (external tools projected into the one catalogue)"
description: "Consume external MCP servers with the official TypeScript client: an SSRF-guarded fetch with no token passthrough, bounded listing with fingerprints and drift…"
category: "AI"
---

# MCP client (external tools projected into the one catalogue)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Category:** AI · **Tier:** deep · **Maturity:** implemented · **Risk:** high if wired without review — contained by default-write risk, fingerprint pins and the egress guard

Consume external MCP servers with the official TypeScript client: an SSRF-guarded fetch with no token passthrough, bounded listing with fingerprints and drift detection, and a projection into the existing tool catalogue's vocabulary — namespaced names, reach external, user-origin results, and a risk the deployment assigns (write by default; read only for listed, fingerprint-pinned tools). Annotations are recorded as untrusted hints and never lower a risk. Wired to the deskbot through the external-operations domain: an operator-managed peer directory with fingerprint activation, every peer call approval-gated behind a disclosure card, a content screen that refuses secrets and requires a separate authorization for quoted read content, and a persistent execution claim that runs an approval at most once and settles an interrupted call as unknown, never retried.

**When to use:** Use when an assistant should call tools another party operates and you can name and review that peer.

**Requires:** third-party-api

## Avoid when

- The tools are yours — add them to the catalogue instead
- You cannot review and pin the peer's tools — everything stays approval-gated, which may make the peer pointless

## Alternatives

- **@ai-sdk/mcp createMCPClient** — prefer when you are on AI SDK v7 and accept the AI SDK's own protocol implementation instead of the official SDK

## Docs

- [docs/blueprint/ai/mcp-client.md](/docs/blueprint/ai/mcp-client) — Decision, risk policy, guard, validation ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/ai/mcp-client.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/ai/mcp-client.md))
- [docs/blueprint/ai/external-operations.md](/docs/blueprint/ai/external-operations) — Persistent claim, disclosure authorization, deskbot card, peer administration ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/ai/external-operations.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/ai/external-operations.md))

## Code

- `src/lib/server/ai/mcp-client//` — Peer config, endpoint guard (connect-time pinned), listing, catalogue projection, disclosure, approval binding, approved execution with receipts, AI SDK tool set, peer directory, operation adapter ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/ai/mcp-client/) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/ai/mcp-client/))
- `src/lib/server/external-operations//` — Protocol-neutral contract, content screen, persistent executor ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/external-operations/) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/external-operations/))
- `src/lib/server/db/ai/external-operations.ts` — Claim, dispatch marker, settlement, lease healing as conditional statements ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/db/ai/external-operations.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/db/ai/external-operations.ts))
- `src/lib/server/ai/capabilities/external-tools.ts` — Deskbot capability mounting activated peer tools as gated tools ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/capabilities/external-tools.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/capabilities/external-tools.ts))

## Tests

- `src/lib/server/ai/mcp-client/mcp-client.gate.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/mcp-client/mcp-client.gate.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/mcp-client/mcp-client.gate.test.ts))
- `src/lib/server/ai/mcp-client/peer-interop.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/mcp-client/peer-interop.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/mcp-client/peer-interop.test.ts))
- `src/lib/server/ai/mcp-client/endpoint-guard.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/mcp-client/endpoint-guard.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/mcp-client/endpoint-guard.test.ts))
- `src/lib/server/ai/mcp-client/approved-execution.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/mcp-client/approved-execution.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/mcp-client/approved-execution.test.ts))
- `src/lib/server/ai/mcp-client/projection.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/mcp-client/projection.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/mcp-client/projection.test.ts))
- `src/lib/server/external-operations/execution.pglite.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/external-operations/execution.pglite.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/external-operations/execution.pglite.test.ts))
- `src/lib/server/external-operations/content-screen.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/external-operations/content-screen.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/external-operations/content-screen.test.ts))
- `src/lib/server/ai/mcp-client/python-peer.pglite.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/mcp-client/python-peer.pglite.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/mcp-client/python-peer.pglite.test.ts))

## Proof

- [`/showcases/interop`](/showcases/interop) — Agentic Interoperability Lab — each section labels itself live, fixture or recorded

## Invariants

- Every projected external tool is reach external and resultOrigin user; its risk is write unless an admin listed it read-only and pinned its fingerprint.
- Annotations never lower a risk; destructiveHint raises it.
- A tool whose fingerprint changed, or a new tool, is withheld until an admin reviews it.
- No user session or token is forwarded; the only credential sent is the peer's own, by secret reference.
- Write-risk external tools never contact the peer from the agent loop; they only propose.

## Emulation notes

- Validate structuredContent yourself with the SDK's validator: the SDK's callTool throws on a mismatch, which would turn a bad peer into a failed turn.
- Give write-risk tools an execute that returns the approval sentinel; a tool with no execute is a client action in the AI SDK.

## Depends on

- [AI tool manifest & harness split (tool defs, risk metadata, registry)](/docs/pattern-library/ai-tool-harness)
- [Untrusted-content boundary (the lethal trifecta, one rule per leg)](/docs/pattern-library/ai-untrusted-content-boundary)
- [Deskbot approval gate (proposal → approve, plan-gated mutation)](/docs/pattern-library/deskbot-approval-gate)

---

_Machine-readable record: `ai-mcp-client` in `pattern-library/registry.json`._
