---
title: "Messages (Paraglide JS, ICU, compile-time)"
description: "Compile-time translated messages via Paraglide JS v2 using ICU MessageFormat, authored as per-language JSON files that compile to typed functions."
category: "Internationalization (i18n)"
---

# Messages (Paraglide JS, ICU, compile-time)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Internationalization (i18n) · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** low — build-time compiled output, no runtime service

Compile-time translated messages via Paraglide JS v2 using ICU MessageFormat, authored as per-language JSON files that compile to typed functions.

**When to use:** Use when adding or editing any user-facing translatable string.

## Docs

- [docs/blueprint/i18n.md](/docs/blueprint/i18n) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/i18n.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/i18n.md))
- [docs/stack/i18n/paraglide.md](/docs/stack/paraglide) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/stack/i18n/paraglide.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/stack/i18n/paraglide.md))

## Code

- `messages/` — generated `src/lib/paraglide/` is gitignored ([GitHub](https://github.com/ApeDevil/v10r/tree/main/messages) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/messages))

## Proof

- [`/showcases/i18n`](/showcases/i18n)

---

_Machine-readable record: `i18n-messages` in `pattern-library/registry.json`._
