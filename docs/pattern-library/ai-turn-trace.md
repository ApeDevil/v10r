---
title: "Turn trace (recorded account of every AI turn) + turn graph"
description: "Every chatbot and deskbot turn records what was available, considered, included per model call, executed and cited — from the actual execution, never a second…"
category: "AI"
---

# Turn trace (recorded account of every AI turn) + turn graph

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** AI · **Tier:** light · **Maturity:** proven (verified 2026-09-12 @ 511776fa) · **Risk:** medium — stores prompt bodies and tool I/O per turn; retention and ownership guard them

Every chatbot and deskbot turn records what was available, considered, included per model call, executed and cited — from the actual execution, never a second run — streams it while the turn runs, persists it once, and lets the turn’s owner open it as a three-column turn graph (sources → context and model calls → tools, recorded relations only), a tree and a timeline on the showcase pages.

**When to use:** Use when an AI feature must be explainable after the fact: what the prompt contained block by block, what retrieval considered versus what the prompt took, which tools ran with what result, how provider attempts rotated, and what the answer actually cited.

## Docs

- [docs/blueprint/ai/turn-trace.md](/docs/blueprint/ai/turn-trace) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/ai/turn-trace.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/ai/turn-trace.md))

## Code

- `src/lib/types/turn-trace.ts` — The contract: one shape recorded, streamed and persisted ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/types/turn-trace.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/types/turn-trace.ts))
- `src/lib/server/ai/trace/recorder.ts` — The one author of a turn’s trace ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/trace/recorder.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/trace/recorder.ts))
- `src/lib/showcases/ai/inspector.ts` — Pure projection of a persisted turn into the inspector tree, timeline and spine ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/showcases/ai/inspector.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/showcases/ai/inspector.ts))
- `src/lib/showcases/ai/turn-graph.ts` — Pure projection into the three-column turn graph — nodes, recorded-relation edges, folding, what a selection lights up ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/showcases/ai/turn-graph.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/showcases/ai/turn-graph.ts))
- `src/lib/showcases/ai/turn-graph-layout.ts` — Its geometry, pure too — groups for nested records, edges routed through gutters, a rail and a detour so none crosses a card ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/showcases/ai/turn-graph-layout.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/showcases/ai/turn-graph-layout.ts))

## Tests

- `src/lib/server/ai/trace/recorder.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/trace/recorder.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/trace/recorder.test.ts))
- `src/lib/showcases/ai/inspector.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/showcases/ai/inspector.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/showcases/ai/inspector.test.ts))
- `src/lib/showcases/ai/turn-graph.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/showcases/ai/turn-graph.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/showcases/ai/turn-graph.test.ts))
- `src/lib/showcases/ai/turn-graph-layout.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/showcases/ai/turn-graph-layout.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/showcases/ai/turn-graph-layout.test.ts))

## Proof

- [`/showcases/ai/chatbot`](/showcases/ai/chatbot) — #orchestration — the turn graph over the authored turn or the viewer’s own, following the embedded Vely thread above it
- [`/showcases/ai/deskbot`](/showcases/ai/deskbot) — #orchestration — the same graph and tree with the proposal and its receipts as nodes

## Depends on

- [AI surfaces (chatbot vs deskbot split over one guard)](/docs/pattern-library/ai-surfaces)

---

_Machine-readable record: `ai-turn-trace` in `pattern-library/registry.json`._
