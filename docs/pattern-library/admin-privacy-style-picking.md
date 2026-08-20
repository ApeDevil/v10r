---
title: "Style picking + custom palettes"
description: "A per-visitor palette, typography, and radius resolution system with a randomizer, manual picker, and optional saved custom palettes, deliberately without a…"
category: "Admin & Privacy"
---

# Style picking + custom palettes

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Admin & Privacy · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** low — cosmetic per-visitor theming, no sensitive data involved

A per-visitor palette, typography, and radius resolution system with a randomizer, manual picker, and optional saved custom palettes, deliberately without a site-wide brand lock.

**When to use:** Use when a visitor's own style preference should drive theming instead of a fixed site-wide brand.

## Docs

- [docs/blueprint/visual-identity-architecture.md](/docs/blueprint/visual-identity-architecture) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/visual-identity-architecture.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/visual-identity-architecture.md))

## Code

- `src/lib/server/branding/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/branding) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/branding))
- `src/lib/components/branding/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/components/branding) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/components/branding))

## Proof

- [`/showcases/shell/style`](/showcases/shell/style)

---

_Machine-readable record: `admin-privacy-style-picking` in `mcp/patterns.registry.json`._
