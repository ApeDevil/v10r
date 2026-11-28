---
title: "Spreadsheet panel"
description: "A spreadsheet file type managed through the desk's unified file registry, editable in a dual-mode (grid/panel) UI, with one formula evaluator shared by the…"
category: "Desk Workspace"
---

# Spreadsheet panel

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Kind:** pattern — build it in the target project

**Category:** Desk Workspace · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** medium — persists spreadsheet data via desk file registry

A spreadsheet file type managed through the desk's unified file registry, editable in a dual-mode (grid/panel) UI, with one formula evaluator shared by the grid and the AI write path so a stored sheet never disagrees with itself.

**When to use:** Use when a desk-based workspace needs to support tabular/spreadsheet data alongside markdown documents.

**Needs:** required relational-db (via desk-workspace)

## Docs

- `docs/blueprint/desk/spreadsheet.md` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/desk/spreadsheet.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/desk/spreadsheet.md))

## Code

- `src/lib/components/desk/panels/spreadsheet/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/components/desk/panels/spreadsheet) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/components/desk/panels/spreadsheet))
- `src/lib/desk/formula.ts` — Expression evaluator + grid resolver (dependency order, per-pass memoization, cycle detection) — below the component layer because the sheet has two writers ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/desk/formula.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/desk/formula.ts))
- `src/lib/desk/spreadsheet-cells.ts` — The persisted cell contract and recalculateCells(): every stored value re-derived at the write door, whoever wrote it ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/desk/spreadsheet-cells.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/desk/spreadsheet-cells.ts))

## Tests

- `src/lib/desk/spreadsheet-cells.test.ts` — Re-derivation, canonical labels, idempotence, refused addresses ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/desk/spreadsheet-cells.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/desk/spreadsheet-cells.test.ts))
- `src/lib/server/ai/tools/desk-execute.pglite.test.ts` — AI writes an input of a stored formula → desk_read_file reads the recomputed total ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/tools/desk-execute.pglite.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/tools/desk-execute.pglite.test.ts))

## Proof

- [`/showcases/desk`](/showcases/desk)

## Relationships

**Builds on (must be available; the target’s own equivalent satisfies it)**

- [Desk workspace](/docs/pattern-library/desk-workspace) — A panel type registered in the workspace’s panel-type registry.

**Applies (principles to review the work against)**

- [Design philosophy & three-tier theming](/docs/pattern-library/design-philosophy) — Visual design decisions and new tokens in these records follow its content-first, accessibility-driven principles and the three-tier token layering.

**Assumes (platform conventions in scope)**

- [Component-first UI system](/docs/pattern-library/component-system) — UI records are built from the layered component system (component-first); they assume it rather than build it.


---

_Machine-readable record: `desk-spreadsheet-panel` in `pattern-library/registry.json`._
