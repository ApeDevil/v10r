---
title: "AI desk effects (tool results drive the workspace)"
description: "AI tool results dispatch typed desk effects (open/focus/refresh/highlight/notify/scroll) through an EffectActions facade; the dispatcher returns…"
category: "Desk Workspace"
---

# AI desk effects (tool results drive the workspace)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Desk Workspace · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** low — effects are client-side; mutations sit behind the deskbot approval gate

AI tool results dispatch typed desk effects (open/focus/refresh/highlight/notify/scroll) through an EffectActions facade; the dispatcher returns applied/failed per effect and failures surface in the I/O Log panel instead of being swallowed.

**When to use:** Use when an AI assistant should manipulate a live UI workspace: effects go through the same single-writer actions as user input, so AI behavior stays consistent with direct manipulation.

## Docs

- `docs/blueprint/desk/README.md` — § Desk Effect Contract + DeskBus ai:* channels ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/desk/README.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/desk/README.md))

## Code

- `src/lib/components/desk/dispatch-desk-effect.ts` — Effect dispatcher over the EffectActions facade; boolean result per effect ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/desk/dispatch-desk-effect.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/desk/dispatch-desk-effect.ts))
- `src/lib/components/desk/io-log.state.svelte.ts` — I/O Log state — where failed effects surface ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/desk/io-log.state.svelte.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/desk/io-log.state.svelte.ts))

## Tests

- `src/lib/components/desk/dispatch-desk-effect.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/desk/dispatch-desk-effect.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/desk/dispatch-desk-effect.test.ts))

## Proof

- [`/desk`](/desk) (app route, no showcase)

## Depends on

- [Desk workspace (dock layout, focus architecture, mobile projection)](/docs/pattern-library/desk-workspace)
- [Deskbot (AI in the desk workspace)](/docs/pattern-library/ai-deskbot)

---

_Machine-readable record: `desk-ai-effects` in `pattern-library/registry.json`._
