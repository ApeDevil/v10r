---
title: "DB content i18n (JSONB sidecar + `tc()`)"
description: "A source-column plus JSONB-sidecar convention (e.g. name / name_i18n) for translating short database fields, resolved at read time by the tc() helper with an…"
category: "Internationalization (i18n)"
---

# DB content i18n (JSONB sidecar + `tc()`)

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Internationalization (i18n) · **Tier:** light · **Risk:** low — schema convention, no external services

A source-column plus JSONB-sidecar convention (e.g. name / name_i18n) for translating short database fields, resolved at read time by the tc() helper with an explicit locale argument.

**When to use:** Use when a database field (title, name, summary) needs per-locale translations stored alongside the English canonical value.

## Docs

- [docs/blueprint/i18n.md](/docs/blueprint/i18n) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/i18n.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/i18n.md))

## Code

- `src/lib/i18n/translate.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/i18n/translate.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/i18n/translate.ts))

---

_Machine-readable record: `i18n-db-content` in `mcp/patterns.registry.json`._
