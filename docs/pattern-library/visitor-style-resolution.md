---
title: "Visitor style resolution"
description: "Per-visitor palette, typography and radius resolution: a randomizer over pre-validated, WCAG-compliant sets, a manual picker and optional saved custom…"
category: "App Shell & Navigation"
---

# Visitor style resolution

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Kind:** pattern — build it in the target project

**Category:** App Shell & Navigation · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** low — cosmetic per-visitor theming, no sensitive data involved

Per-visitor palette, typography and radius resolution: a randomizer over pre-validated, WCAG-compliant sets, a manual picker and optional saved custom palettes, kept orthogonal to the dark/light theme and deliberately without a site-wide brand lock.

**When to use:** Use when a visitor's own style preference should drive theming instead of a fixed site-wide brand, or when playground surfaces benefit from memorable visual variation without harming accessibility.

**Needs:** v10r's implementation uses relational-db

## Docs

- [docs/blueprint/visual-identity-architecture.md](/docs/blueprint/visual-identity-architecture) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/visual-identity-architecture.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/visual-identity-architecture.md))
- [docs/blueprint/app-shell/settings.md](/docs/blueprint/app-shell/settings) — Settings page — A settings hub page covering appearance (theme cookie), language, privacy toggles, and accessibility preferences, backed by a load/save form action. Reach for it when adding a new user-configurable preference or feature toggle to the account settings hub. ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/app-shell/settings.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/app-shell/settings.md))
- [docs/foundation/style.md](/docs/foundation/style) — Style randomizer — Randomizes decorative styling (typography pairing and color palette) on each visit from pre-validated, WCAG-compliant sets, kept orthogonal to the user's dark/light theme choice. Reach for it when building playground or showcase surfaces that benefit from memorable visual variation without harming accessibility. ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/foundation/style.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/foundation/style.md))

## Code

- `src/lib/server/style/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/style) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/style))
- `src/lib/components/style/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/components/style) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/components/style))
- `src/lib/state/theme.svelte.ts` — Settings page ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/state/theme.svelte.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/state/theme.svelte.ts))
- `src/lib/styles/random/` — Style randomizer ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/styles/random) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/styles/random))
- `src/lib/components/primitives/decorative/` — Decorative ornaments and backgrounds — Decorative primitive components (ornaments, backgrounds) used by the style-randomization system to vary visual flourish without affecting core UI predictability. Use when adding non-functional visual flourish (ornaments, decorative backgrounds) that should stay orthogonal to theme and layout choices. ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/components/primitives/decorative) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/components/primitives/decorative))

## Proof

- [`/showcases/shell/style`](/showcases/shell/style)
- [`/account/settings`](/account/settings) (app route, no showcase) — Settings page
- [`/showcases/ui/decorative`](/showcases/ui/decorative) — Decorative ornaments and backgrounds

---

_Machine-readable record: `visitor-style-resolution` in `pattern-library/registry.json`._
