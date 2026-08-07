---
title: "Desk workspace (panels, DeskBus, file registry)"
description: "A full-page DockLayout workspace with resizable panel panes, drag-and-drop tabs, a panel-type registry, and a typed pub/sub DeskBus for cross-panel…"
category: "Content, Blog & Desk"
---

# Desk workspace (panels, DeskBus, file registry)

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Content, Blog & Desk · **Tier:** light · **Risk:** medium — persists file registry, cross-panel state

A full-page DockLayout workspace with resizable panel panes, drag-and-drop tabs, a panel-type registry, and a typed pub/sub DeskBus for cross-panel communication.

**When to use:** Use when building a multi-panel authoring workspace where different content types (editor, spreadsheet, explorer) need to coexist and communicate.

## Docs

- `docs/blueprint/desk/README.md` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/desk/README.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/desk/README.md))

## Code

- `src/lib/server/desk/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/desk) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/desk))
- `src/lib/components/explorer/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/components/explorer) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/components/explorer))

## Proof

- [`/desk`](/desk) (app route, no showcase)

---

_Machine-readable record: `content-desk-workspace` in `mcp/patterns.registry.json`._
