---
title: "Navigation structure & progressive disclosure"
description: "Structures nav items as compound split buttons — a primary click zone that navigates and a dropdown zone that progressively reveals subpages or section anchors."
category: "App Shell & Navigation"
---

# Navigation structure & progressive disclosure

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Kind:** pattern — build it in the target project

**Category:** App Shell & Navigation · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** low — structural pattern, no external services

Structures nav items as compound split buttons — a primary click zone that navigates and a dropdown zone that progressively reveals subpages or section anchors.

**When to use:** Reach for it when adding a new top-level navigation item or deciding how its children should be disclosed.

## Docs

- [docs/blueprint/app-shell/navigation.md](/docs/blueprint/app-shell/navigation) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/app-shell/navigation.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/app-shell/navigation.md))

## Code

- `src/lib/nav/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/nav) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/nav))

## Proof

- [`/showcases/shell/sidebar`](/showcases/shell/sidebar)

## Relationships

**Applies (principles to review the work against)**

- [Explosive Discovery — nested depth for dense menus and pages](/docs/pattern-library/explosive-discovery) — Menus, toolbars and command surfaces that offer many actions are reviewed against it (directions that narrow intent, an expert path beside every discovery path); latent cards apply it at the scale of one card.

**Part of**

- [Shell layout](/docs/pattern-library/app-shell-layout) (optional)


---

_Machine-readable record: `navigation-structure` in `pattern-library/registry.json`._
