---
title: "Versioned document session (save queue, drafts, CAS, explicit conflict)"
description: "A browser-edited document stays server-authoritative: debounced serialised saves carrying their base version, compare-and-swap rejection as an explicit…"
category: "Durable Execution"
---

# Versioned document session (save queue, drafts, CAS, explicit conflict)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Category:** Durable Execution · **Tier:** deep · **Maturity:** proven (verified 2026-10-10 @ 91f61a76-dirty) · **Risk:** low — the failure mode is a silent overwrite, which the version check turns into a visible conflict

A browser-edited document stays server-authoritative: debounced serialised saves carrying their base version, compare-and-swap rejection as an explicit conflict state, per-writer local drafts no other tab can erase, and reloads that fetch before they replace.

**When to use:** Use for documents a user edits over time while the server, another tab or an AI write can change them — sheets, notes, settings pages with autosave.

**Requires:** postgres

## Avoid when

- The input is append-only (a message, a form submission) — one request with an idempotency key suffices
- Two people must type into the same paragraph at once — that is the CRDT case

## Alternatives

- **A CRDT (Yjs, Automerge) or sync engine** — prefer when concurrent rich-text co-editing is the product, and per-document authorisation can be scoped
- **Pessimistic save (button, no autosave)** — prefer when edits are rare and a lost tab costs nothing

## Docs

- [docs/blueprint/integrity/execution.md#versioned-document-session](/docs/blueprint/integrity/execution) — The state machine, and why not a CRDT ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/integrity/execution.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/integrity/execution.md))

## Code

- `src/lib/components/desk/panels/spreadsheet/spreadsheet-autosave.ts` — Framework-free save queue owned by the document ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/desk/panels/spreadsheet/spreadsheet-autosave.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/desk/panels/spreadsheet/spreadsheet-autosave.ts))
- `src/lib/components/desk/panels/spreadsheet/spreadsheet-drafts.ts` — One localStorage slot per writer; siblings offered, never applied ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/desk/panels/spreadsheet/spreadsheet-drafts.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/desk/panels/spreadsheet/spreadsheet-drafts.ts))
- `src/lib/components/desk/panels/spreadsheet/spreadsheet-session.svelte.ts` — PUT with expectedVersion ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/desk/panels/spreadsheet/spreadsheet-session.svelte.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/desk/panels/spreadsheet/spreadsheet-session.svelte.ts))
- `src/routes/api/desk/files/[id]/+server.ts` — 409 version_conflict on a stale base ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/routes/api/desk/files/[id]/+server.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/routes/api/desk/files/[id]/+server.ts))

## Tests

- `src/lib/components/desk/panels/spreadsheet/spreadsheet-autosave.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/desk/panels/spreadsheet/spreadsheet-autosave.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/desk/panels/spreadsheet/spreadsheet-autosave.test.ts))
- `src/routes/api/desk/files/[id]/server.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/routes/api/desk/files/[id]/server.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/routes/api/desk/files/[id]/server.test.ts))

## Invariants

- Every save carries its base version, and the server rejects a stale one.
- Unsaved work lives in exactly one place per writer and survives until a save of it succeeds or the user discards it.
- A conflict is a state the user resolves — never last-write-wins.
- The session lives as long as the document, not a component; closing a panel flushes, never drops.

## Emulation notes

- Keep the queue framework-free and test it with fake timers; the UI only subscribes, so a remounting component cannot cancel a save.
- Name draft slots by user, document and writer: one shared slot per document lets tab B silently erase tab A's only copy.
- Make reload fetch-then-replace: a reload that clears first turns an offline moment into data loss.

---

_Machine-readable record: `versioned-document-session` in `pattern-library/registry.json`._
