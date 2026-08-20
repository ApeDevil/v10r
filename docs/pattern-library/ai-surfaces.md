---
title: "AI surfaces (chatbot vs deskbot split over one guard)"
description: "Two AI surfaces over one shared guard: a read-only, citation-faithful chatbot (Vely) vs an agentic, mutating, approval-gated deskbot — with a showcase-only…"
category: "AI"
---

# AI surfaces (chatbot vs deskbot split over one guard)

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Category:** AI · **Tier:** deep · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** high — user-facing LLM behavior and permissions

Two AI surfaces over one shared guard: a read-only, citation-faithful chatbot (Vely) vs an agentic, mutating, approval-gated deskbot — with a showcase-only rag-demo value kept out of production paths.

**When to use:** Use when one product needs both a safe answer-bot and an acting agent: splitting the surface (not forking the stack) keeps permissions and prompts honest per surface.

## Docs

- [docs/blueprint/ai/surfaces.md](/docs/blueprint/ai/surfaces) — The surface split and per-surface rules ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/ai/surfaces.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/ai/surfaces.md))
- `docs/blueprint/ai/README.md` — AI subsystem hub ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/ai/README.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/ai/README.md))
- [docs/blueprint/ai/desk-integration.md](/docs/blueprint/ai/desk-integration) — How the deskbot integrates with the desk ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/ai/desk-integration.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/ai/desk-integration.md))

## Code

- `src/lib/server/ai/guard.ts` — guardAiRequest() — the one shared gate ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/guard.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/guard.ts))
- `src/lib/server/ai/chat-orchestrator.ts` — Chatbot orchestration ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/chat-orchestrator.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/chat-orchestrator.ts))
- `src/lib/server/ai/deskbot-rag.ts` — Deskbot retrieval side ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/deskbot-rag.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/deskbot-rag.ts))
- `src/routes/api/ai/chatbot/+server.ts` — Chatbot route adapter ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/routes/api/ai/chatbot/+server.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/routes/api/ai/chatbot/+server.ts))
- `src/routes/api/ai/deskbot/+server.ts` — Deskbot route adapter ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/routes/api/ai/deskbot/+server.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/routes/api/ai/deskbot/+server.ts))
- `src/lib/components/composites/chatbot/` — Chatbot UI ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/components/composites/chatbot) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/components/composites/chatbot))

## Tests

- `src/lib/server/ai/chat-orchestrator.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/chat-orchestrator.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/chat-orchestrator.test.ts))
- `src/lib/server/ai/tool-leak-guard.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/tool-leak-guard.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/tool-leak-guard.test.ts))

## Proof

- [`/showcases/ai/chatbot`](/showcases/ai/chatbot) — Chatbot architecture page; the sibling deskbot page mirrors its anchor set
- [`/showcases/ai/deskbot`](/showcases/ai/deskbot) — Deskbot architecture page; the live deskbot runs at app route /desk

## Invariants

- The chatbot never emits a DeskEffect and never creates a proposal.
- A chatbot tool never carries a desk scope; a deskbot tool always does — topology derives from manifest membership, not a scope artifact.
- rag-demo is not a product surface and must not dilute the chatbot.

## Emulation notes

- Start with the read-only surface; add the mutating surface only with the approval gate (see deskbot-approval-gate).
- Route adapters stay thin — both surfaces call the same guard then their orchestrator.

## Depends on

- [AI tool manifest & harness split (tool defs, risk metadata, registry)](/docs/pattern-library/ai-tool-harness)

---

_Machine-readable record: `ai-surfaces` in `mcp/patterns.registry.json`._
