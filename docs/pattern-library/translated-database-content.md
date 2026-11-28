---
title: "Translated database content"
description: "A source-column plus JSONB-sidecar convention (e.g. name / name_i18n) for translating short database fields, resolved at read time by the tc() helper with an…"
category: "Internationalization (i18n)"
---

# Translated database content

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Kind:** pattern — build it in the target project

**Category:** Internationalization (i18n) · **Tier:** light · **Maturity:** implemented · **Risk:** low — schema convention, no external services

A source-column plus JSONB-sidecar convention (e.g. name / name_i18n) for translating short database fields, resolved at read time by the tc() helper with an explicit locale argument.

**When to use:** Use when a database field (title, name, summary) needs per-locale translations stored alongside the English canonical value.

**Needs:** required relational-db

## Docs

- [docs/blueprint/i18n.md](/docs/blueprint/i18n) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/i18n.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/i18n.md))

## Code

- `src/lib/i18n/translate.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/i18n/translate.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/i18n/translate.ts))

---

_Machine-readable record: `translated-database-content` in `pattern-library/registry.json`._
