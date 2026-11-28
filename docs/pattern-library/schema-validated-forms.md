---
title: "Schema-validated forms"
description: "The default form stack: one schema per form (Valibot) validated on the server and enhanced on the client (Superforms v2), type-safe and…"
category: "Forms & Validation"
---

# Schema-validated forms

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Kind:** pattern — build it in the target project

**Category:** Forms & Validation · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** low — form validation only, no external services

The default form stack: one schema per form (Valibot) validated on the server and enhanced on the client (Superforms v2), type-safe and progressive-enhancement friendly, with the confirm-before-submit, reset-after-submit and edit-existing-data variants layered on the same flow.

**When to use:** Use as the default for any non-auth form (CRUD, settings, contact) needing server-validated, progressively-enhanced submission, including forms that confirm before submitting, clear after success or pre-populate from existing data.

## Docs

- [docs/blueprint/forms.md](/docs/blueprint/forms) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/forms.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/forms.md))
- [docs/stack/forms/superforms.md](/docs/stack/superforms) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/stack/forms/superforms.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/stack/forms/superforms.md))

## Code

- `src/lib/schemas/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/schemas) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/schemas))
- `src/lib/components/composites/form-field/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/components/composites/form-field) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/components/composites/form-field))

## Proof

- [`/showcases/forms`](/showcases/forms)
- [`/showcases/forms/basics/contact`](/showcases/forms/basics/contact) — Basic forms — Reference contact and settings forms demonstrating the standard Superforms + Valibot schema and server-action wiring for a single-step form. Reference when building a straightforward single-step form such as a contact or settings page.
- [`/showcases/forms/basics/settings`](/showcases/forms/basics/settings) — Basic forms
- [`/showcases/forms/advanced/confirm`](/showcases/forms/advanced/confirm) — Advanced form tactics — Confirmation-modal submit, reset-after-submit, and edit-with-existing-data patterns layered on top of the base Superforms flow. Use when a form needs to confirm before submitting, clear itself after a successful submit, or pre-populate from existing data.
- [`/showcases/forms/advanced/reset`](/showcases/forms/advanced/reset) — Advanced form tactics
- [`/showcases/forms/advanced/edit`](/showcases/forms/advanced/edit) — Advanced form tactics

## Relationships

**Applies (principles to review the work against)**

- [Design philosophy & three-tier theming](/docs/pattern-library/design-philosophy) — Visual design decisions and new tokens in these records follow its content-first, accessibility-driven principles and the three-tier token layering.

**Assumes (platform conventions in scope)**

- [Component-first UI system](/docs/pattern-library/component-system) — UI records are built from the layered component system (component-first); they assume it rather than build it.

**Built on by**

- [Validation timing](/docs/pattern-library/validation-timing)
- [Multi-step and dynamic forms](/docs/pattern-library/multi-step-forms)
- [Form draft recovery](/docs/pattern-library/form-draft-recovery)


---

_Machine-readable record: `schema-validated-forms` in `pattern-library/registry.json`._
