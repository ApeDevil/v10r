---
title: "Design philosophy & three-tier theming"
description: "Five content-first, accessibility-driven design principles paired with a three-tier token system (primitives → semantic tokens → component usage) flowing from…"
category: "UI Components & Design System"
---

# Design philosophy & three-tier theming

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** UI Components & Design System · **Tier:** light · **Risk:** low — documentation/convention only

Five content-first, accessibility-driven design principles paired with a three-tier token system (primitives → semantic tokens → component usage) flowing from src/app.css through tokens.ts into UnoCSS.

**When to use:** Read before making a visual design decision or introducing a new design token, to keep it aligned with the system's principles and token layering.

## Docs

- `docs/blueprint/design/README.md` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/design/README.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/design/README.md))

## Code

- `src/app.css` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/app.css) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/app.css))
- `src/lib/styles/tokens.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/styles/tokens.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/styles/tokens.ts))

---

_Machine-readable record: `ui-design-philosophy` in `mcp/patterns.registry.json`._
