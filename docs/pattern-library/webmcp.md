---
title: "WebMCP publication of client actions"
description: "Publishes existing client-action contracts to the browser's own agent through document.modelContext when it exists: same schema, runner, timeouts and bounded…"
category: "AI"
---

# WebMCP publication of client actions

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Kind:** pattern — build it in the target project

**Category:** AI · **Tier:** light · **Maturity:** implemented · **Risk:** low — feature-detected, view-risk only

Publishes existing client-action contracts to the browser's own agent through document.modelContext when it exists: same schema, runner, timeouts and bounded results; only read and view actions; a per-minute budget; withdrawn on dispose. Progressive enhancement only.

**When to use:** Use when bounded client actions exist and external browser agents should operate the view without screen-scraping.

**Needs:** required llm-provider (via agent-actions), relational-db (via deskbot-approval-gate)

## Avoid when

- The action changes stored data
- A page would depend on it — the API is in an origin trial

## Docs

- [docs/blueprint/ai/webmcp.md](/docs/blueprint/ai/webmcp) — Decision, rules, upstream status ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/ai/webmcp.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/ai/webmcp.md))

## Code

- `src/lib/client-actions/webmcp.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/client-actions/webmcp.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/client-actions/webmcp.ts))

## Tests

- `src/lib/client-actions/webmcp.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/client-actions/webmcp.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/client-actions/webmcp.test.ts))

## Proof

- [`/showcases/interop`](/showcases/interop) — Agentic Interoperability Lab — each section labels itself live, fixture or recorded

## Depends on

- [Agent actions](/docs/pattern-library/agent-actions)

---

_Machine-readable record: `webmcp` in `pattern-library/registry.json`._
