---
title: "Deskbot (AI in the desk workspace)"
description: "An agentic AI surface embedded in the desk workspace calls desk-mutating tools, with writes routed through the harness's proposal-and-approval gate."
category: "AI"
---

# Deskbot (AI in the desk workspace)

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** AI · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** medium — external LLM providers with quota limits

An agentic AI surface embedded in the desk workspace calls desk-mutating tools, with writes routed through the harness's proposal-and-approval gate.

**When to use:** Use when an AI assistant needs to act on a workspace's files and panels, not just answer read-only questions.

## Docs

- [docs/blueprint/ai/desk-integration.md](/docs/blueprint/ai/desk-integration) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/ai/desk-integration.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/ai/desk-integration.md))

## Code

- `src/lib/server/ai/deskbot-rag.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/deskbot-rag.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/deskbot-rag.ts))
- `src/lib/server/agents/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/agents) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/agents))

## Proof

- [`/desk`](/desk) (app route, no showcase)

---

_Machine-readable record: `ai-deskbot` in `mcp/patterns.registry.json`._
