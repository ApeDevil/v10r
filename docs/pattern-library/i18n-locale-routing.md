---
title: "Locale routing (optional catch-all, matcher, 308 canonical)"
description: "URL-based locale routing using an optional [[locale=locale]] catch-all segment and a param matcher, with the unprefixed default locale (en) 308-redirected…"
category: "Internationalization (i18n)"
---

# Locale routing (optional catch-all, matcher, 308 canonical)

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Internationalization (i18n) · **Tier:** light · **Risk:** low — routing/redirect logic only

URL-based locale routing using an optional [[locale=locale]] catch-all segment and a param matcher, with the unprefixed default locale (en) 308-redirected from /en/* to keep canonical URLs.

**When to use:** Use when adding or reasoning about localized routes so URLs stay canonical and SEO-safe across locales.

## Docs

- [docs/blueprint/i18n.md](/docs/blueprint/i18n) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/i18n.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/i18n.md))

## Code

- `src/params/locale.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/params/locale.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/params/locale.ts))

## Proof

- [`/showcases/i18n`](/showcases/i18n)

---

_Machine-readable record: `i18n-locale-routing` in `mcp/patterns.registry.json`._
