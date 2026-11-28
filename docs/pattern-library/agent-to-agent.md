---
title: "Agent to agent"
description: "Serve a specialist agent over A2A 1.0 with the official JS SDK behind a SvelteKit route (agent card, JSON-RPC, SSE) and delegate to independently implemented…"
category: "AI"
---

# Agent to agent

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Kind:** pattern — build it in the target project

**Category:** AI · **Tier:** deep · **Maturity:** implemented · **Risk:** medium — public endpoint, deterministic and stateless; delegation approval-gated and not yet wired to a route

Serve a specialist agent over A2A 1.0 with the official JS SDK behind a SvelteKit route (agent card, JSON-RPC, SSE) and delegate to independently implemented agents through an allowlisted client on the shared pinned peer egress that types every answer as a claim. Assistant-driven delegation is an approval-gated external operation: operator-listed peers, a disclosure of what is sent to whom, a binding over the agent card, budgets and depth one, cancellation of the remote task on timeout or abort. The served skills run deterministic architecture checks, so tasks cost no model quota and complete inside the request.

**When to use:** Use when an evaluation belongs to an independently operated agent (another team, language or framework), or when your own specialist should be callable by such agents.

**Needs:** required relational-db, external-api, wasm-toolchain (via wasm-compute-kernel), container-host (via external-service-runtime) · conditional key-value-store (when breaker state must be shared across instances; via resilience-policy)

## Avoid when

- The specialist lives in your own runtime — use a capability or sub-agent
- Both ends are yours with a fixed contract — call a service API

## Alternatives

- **Agent exposed as an MCP tool** — prefer when callers are coding agents that already speak MCP and the work is one short call
- **Direct service-to-service API** — prefer when you own both sides and the contract is fixed

## Docs

- [docs/blueprint/ai/agent-to-agent.md](/docs/blueprint/ai/agent-to-agent) — When A2A, server and client decisions, interop evidence ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/ai/agent-to-agent.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/ai/agent-to-agent.md))

## Code

- `src/lib/server/a2a//` — Agent card, executor, HTTP adapter, peer policy, delegation, the external-operations adapter ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/a2a/) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/a2a/))
- `src/lib/server/http/peer-egress.ts` — The secured outbound fetch shared with the MCP client (pinning, header hygiene, no redirects, byte cap) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/http/peer-egress.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/http/peer-egress.ts))
- `src/lib/server/ai/capabilities/agent-delegation.ts` — The deskbot capability that mounts delegate_architecture_review behind the external-operations approval door ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/capabilities/agent-delegation.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/capabilities/agent-delegation.ts))
- `scripts/a2a/peer/performance_agent.py` — The independently implemented Python peer ([GitHub](https://github.com/ApeDevil/v10r/blob/main/scripts/a2a/peer/performance_agent.py) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/scripts/a2a/peer/performance_agent.py))

## Tests

- `src/lib/server/a2a/http.adapter.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/a2a/http.adapter.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/a2a/http.adapter.test.ts))
- `src/lib/server/a2a/delegate.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/a2a/delegate.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/a2a/delegate.test.ts))
- `src/lib/server/a2a/external-adapter.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/a2a/external-adapter.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/a2a/external-adapter.test.ts))
- `src/lib/server/http/peer-egress.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/http/peer-egress.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/http/peer-egress.test.ts))

## Proof

- [`/showcases/interop`](/showcases/interop) — Agentic Interoperability Lab — each section labels itself live, fixture or recorded

## Invariants

- A remote answer is a claim: verified is always false, findings are rebuilt from known fields, malformed entries are dropped and counted.
- No task store is shared between requests; every served task completes inside its request.
- Every outbound URL, including the interface a card names, passes the allowlist and is connected to by its pinned, validated address; redirects are refused.
- The assistant delegates only to an operator-listed peer, only after a human approves the disclosed operation, at most once per approval, and never from a delegated turn.
- The served skill never delegates further.

## Emulation notes

- Do not use the SDK's default client factory if you guard fetch: it adds a REST transport on the global fetch.
- Pull the first stream frame before committing to SSE, as the SDK's own Express handler does, so an immediate error becomes a JSON-RPC error response.
- Stream when the card offers it: the first event names the remote task, which is what makes CancelTask possible after a timeout.

## Depends on

- [Architecture Engineering](/docs/pattern-library/architecture-engineering)

---

_Machine-readable record: `agent-to-agent` in `pattern-library/registry.json`._
