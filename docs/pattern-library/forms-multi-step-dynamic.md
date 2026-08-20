---
title: "Multi-step & dynamic (wizard · dynamic · dependent)"
description: "Wizard (per-step schema validation), dynamic array fields, and dependent/cascading field patterns built on top of Superforms."
category: "Forms & Validation"
---

# Multi-step & dynamic (wizard · dynamic · dependent)

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Forms & Validation · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** low — client-side wizard/form state only

Wizard (per-step schema validation), dynamic array fields, and dependent/cascading field patterns built on top of Superforms.

**When to use:** Use when a form spans multiple steps, has user-added repeating fields, or has fields whose options depend on another field's value.

## Docs

- [docs/blueprint/forms.md](/docs/blueprint/forms) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/forms.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/forms.md))

## Code

- `src/lib/schemas/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/schemas) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/schemas))

## Proof

- [`/showcases/forms/patterns/wizard`](/showcases/forms/patterns/wizard)
- [`/showcases/forms/patterns/dynamic`](/showcases/forms/patterns/dynamic)
- [`/showcases/forms/patterns/dependent`](/showcases/forms/patterns/dependent)

---

_Machine-readable record: `forms-multi-step-dynamic` in `mcp/patterns.registry.json`._
