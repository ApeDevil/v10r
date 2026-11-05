---
title: "Dynamic attributes (self-describing records the user defines at runtime)"
description: "A record that starts almost empty and grows labelled, typed attributes its user names, with the definitions stored inline beside the values: stable attribute…"
category: "Forms & Validation"
---

# Dynamic attributes (self-describing records the user defines at runtime)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Category:** Forms & Validation · **Tier:** deep · **Maturity:** proven (verified 2026-11-05 @ e3023614) · **Risk:** medium — user-authored data reaches the database; the codec's bounds and refusals are the security boundary and must run on the server

A record that starts almost empty and grows labelled, typed attributes its user names, with the definitions stored inline beside the values: stable attribute ids make renames free, lossy type changes keep the old value, removals are restorable, unknown kinds survive opaquely, and a fail-closed codec plus a version check guard every save, with conflicts merged by attribute id.

**When to use:** Use when the facts on a record differ from one record to the next and belong to the person writing them — an asset panel, a character sheet, a sample log — and the record loads and saves as one unit.

## Avoid when

- Every record has the same fields — a Valibot schema and a fixed form are simpler and queryable
- An attribute must be a foreign key, unique across records or indexed for search — promote it to a real column
- Two people type into the same value at once — that is the CRDT case
- The attributes carry behaviour (formulas, conditions, validation scripts) — that is a rule engine, and this pattern refuses code as data

## Alternatives

- **Real columns via runtime DDL (Baserow, Directus)** — prefer when many records share one user-defined schema and must be filtered and sorted across records
- **Entity-attribute-value rows** — prefer when individual attribute values need foreign keys or per-value audit rows
- **A JSON Schema form renderer (@sjsf/form)** — prefer when the schema is fixed or comes from outside, and the user fills it in rather than defines it

## Docs

- [docs/blueprint/dynamic-attributes/pattern.md](/docs/blueprint/dynamic-attributes/pattern) — Model, contracts, extension interfaces, security invariants, performance, limitations ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/dynamic-attributes/pattern.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/dynamic-attributes/pattern.md))
- [docs/blueprint/dynamic-attributes/research.md](/docs/blueprint/dynamic-attributes/research) — Prior art and why no form or schema library is adopted ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/dynamic-attributes/research.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/dynamic-attributes/research.md))

## Code

- `src/lib/dynamic-attributes/` — Framework-free core: record, kinds, codec, operations, merge, diagnostics, stores ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/dynamic-attributes) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/dynamic-attributes))
- `src/lib/dynamic-attributes/codec.ts` — Fail-closed parse: bounded copy, reserved keys, strict frames, upcasters, size ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/dynamic-attributes/codec.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/dynamic-attributes/codec.ts))
- `src/lib/dynamic-attributes/kinds.ts` — The AttributeKind contract and the core kinds; conversion through text ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/dynamic-attributes/kinds.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/dynamic-attributes/kinds.ts))
- `src/lib/dynamic-attributes/merge.ts` — Three-way merge by attribute id; label and value merge separately ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/dynamic-attributes/merge.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/dynamic-attributes/merge.ts))
- `src/lib/components/composites/attributes/` — Svelte 5 editor, per-kind controls, record session, save status ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/components/composites/attributes) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/components/composites/attributes))
- `src/lib/state/document-autosave.ts` — Generic save queue with conflict state and rebase ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/state/document-autosave.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/state/document-autosave.ts))
- `src/lib/server/db/desk/mutations.ts` — updateRecordByFileId: parse before lock, version check, pre-image revision ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/db/desk/mutations.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/db/desk/mutations.ts))
- `src/lib/components/desk/panels/record/RecordPanel.svelte` — Desk adapter: menus, AI context, bus refresh, flush on leave ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/desk/panels/record/RecordPanel.svelte) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/desk/panels/record/RecordPanel.svelte))

## Tests

- `src/lib/dynamic-attributes/codec.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/dynamic-attributes/codec.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/dynamic-attributes/codec.test.ts))
- `src/lib/dynamic-attributes/operations.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/dynamic-attributes/operations.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/dynamic-attributes/operations.test.ts))
- `src/lib/dynamic-attributes/merge.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/dynamic-attributes/merge.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/dynamic-attributes/merge.test.ts))
- `src/lib/dynamic-attributes/stores.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/dynamic-attributes/stores.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/dynamic-attributes/stores.test.ts))
- `src/lib/components/composites/attributes/attribute-editor.svelte.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/composites/attributes/attribute-editor.svelte.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/composites/attributes/attribute-editor.svelte.test.ts))
- `src/lib/server/db/desk/record-mutations.pglite.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/db/desk/record-mutations.pglite.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/db/desk/record-mutations.pglite.test.ts))
- `src/routes/api/desk/files/[id]/server.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/routes/api/desk/files/[id]/server.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/routes/api/desk/files/[id]/server.test.ts))

## Proof

- [`/showcases/dynamic-attributes`](/showcases/dynamic-attributes)

## Invariants

- An attribute's identity is its id, never its label; a rename never moves or loses a value.
- Nothing is lost silently: a lossy type change keeps the previous value, a removal is restorable, an unknown kind is kept opaque, a newer format is refused.
- No code in data: a kind id selects a control from a map the application built; nothing stored is evaluated, imported or used as a regex.
- The same codec parses on the client and before every server write; a record it refuses is never stored and a stored record it cannot parse is never overwritten.
- Every save names the version it was based on, and a stale save changes nothing.

## Emulation notes

- Store attributes as an array: jsonb drops object-key order and keeps only the last duplicate key, so neither may carry meaning.
- Copy untrusted JSON into fresh plain objects and refuse __proto__, constructor and prototype as keys before any spread or merge; check the byte length before JSON.parse.
- Convert between kinds through each kind's text form and call a conversion exact only when it reads back as the same text — that one rule decides when to keep the old value.
- Give select options their own ids; the stored value is the id, so renaming an option orphans nothing.
- Keep unchanged attributes' object identity in every operation and hold the record as $state.raw: a keystroke re-renders one row, not two hundred.

## Depends on

- [Versioned document session (save queue, drafts, CAS, explicit conflict)](/docs/pattern-library/versioned-document-session)

---

_Machine-readable record: `dynamic-attributes` in `pattern-library/registry.json`._
