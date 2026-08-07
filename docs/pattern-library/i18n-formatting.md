---
title: "Formatting & CLDR plural correctness"
description: "Locale-explicit date, number, currency, percent, and relative-time formatting helpers built on the native Intl API, decoupled from the translation locale to…"
category: "Internationalization (i18n)"
---

# Formatting & CLDR plural correctness

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Internationalization (i18n) · **Tier:** light · **Risk:** low — presentation formatting only

Locale-explicit date, number, currency, percent, and relative-time formatting helpers built on the native Intl API, decoupled from the translation locale to avoid SSR/CSR hydration mismatches.

**When to use:** Use whenever displaying a date, number, currency, or relative-time value that should format per the visitor's locale.

## Docs

- [docs/blueprint/i18n.md](/docs/blueprint/i18n) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/i18n.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/i18n.md))

## Code

- `src/lib/i18n/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/i18n) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/i18n))

---

_Machine-readable record: `i18n-formatting` in `mcp/patterns.registry.json`._
