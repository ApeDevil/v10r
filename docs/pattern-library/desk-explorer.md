---
title: "Explorer panel"
description: "One recursive tree over heterogeneous content APIs: adapters normalize every source into an ExplorerNode with a capability set, and the context menu, touch…"
category: "Desk Workspace"
---

# Explorer panel

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Kind:** pattern — build it in the target project

**Category:** Desk Workspace · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** medium — mutates posts, assets, and files through their APIs

One recursive tree over heterogeneous content APIs: adapters normalize every source into an ExplorerNode with a capability set, and the context menu, touch kebab, drag-and-drop, and inline rename/delete are all driven by capabilities — not per-type branching.

**When to use:** Use when a file-browser UI must merge several backends (posts, assets, files) and every row action should be declaratively controlled per item type.

**Needs:** required relational-db (via desk-workspace)

## Docs

- `docs/blueprint/desk/README.md` — § Explorer Panel — ExplorerNode, adapters, capability-driven menu ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/desk/README.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/desk/README.md))

## Code

- `src/lib/components/desk/panels/explorer/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/components/desk/panels/explorer) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/components/desk/panels/explorer))
- `src/lib/components/desk/panels/explorer/node.ts` — ExplorerNode + NodeCapability — the unifying interface ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/desk/panels/explorer/node.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/desk/panels/explorer/node.ts))
- `src/lib/components/desk/panels/explorer/context-menu-items.ts` — Capability-driven menu builder shared by right-click menu and touch kebab ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/desk/panels/explorer/context-menu-items.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/desk/panels/explorer/context-menu-items.ts))

## Proof

- [`/showcases/desk`](/showcases/desk)

## Relationships

**Builds on (must be available; the target’s own equivalent satisfies it)**

- [Desk workspace](/docs/pattern-library/desk-workspace) — The explorer is a panel of the workspace.

**Applies (principles to review the work against)**

- [Design philosophy & three-tier theming](/docs/pattern-library/design-philosophy) — Visual design decisions and new tokens in these records follow its content-first, accessibility-driven principles and the three-tier token layering.

**Assumes (platform conventions in scope)**

- [Component-first UI system](/docs/pattern-library/component-system) — UI records are built from the layered component system (component-first); they assume it rather than build it.


---

_Machine-readable record: `desk-explorer` in `pattern-library/registry.json`._
