---
title: "PIM Excel workflow with AI agents (profile, proposed recipe, deterministic run, target check)"
description: "Supplier Excel/CSV product exports become a target's import sheet without the model touching a row: the agent reads a bounded column profile and proposes a…"
category: "Office Workflows"
---

# PIM Excel workflow with AI agents (profile, proposed recipe, deterministic run, target check)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Category:** Office Workflows · **Tier:** deep · **Maturity:** proven (verified 2026-10-27 @ 42c9dfe-dirty) · **Risk:** low — the engine is pure and every run is reproducible from input + recipe; the residual risk is a recipe that runs cleanly but maps a value wrongly (e.g. a colour), which the change log and a person's review are there to catch

Supplier Excel/CSV product exports become a target's import sheet without the model touching a row: the agent reads a bounded column profile and proposes a typed transform recipe, a column walk refuses imagined columns, code runs the recipe over every row (unreadable values left unchanged and listed by source line), and a target-schema check over the full output is the definition of done — in a bounded propose → run → check → revise loop, in-app, or from a terminal agent with the `pim` program over plain job folders (no git, no repo; one dated output folder per run).

**When to use:** Use when product data (supplier exports, ERP dumps, marketplace templates) arrives as spreadsheets that must be analysed and transformed into a fixed import format, the same kind of file recurs, or the sheet is too large to check by eye.

**Requires:** ai-provider

## Avoid when

- A one-off cleanup of a few hundred rows nobody will send again — editing it in Excel is faster than writing a target schema
- The transformation needs judgement per row (rewriting marketing copy, translating descriptions) — a recipe of typed ops cannot express it; that is a per-row generation job with its own review
- The data already lives in a PIM with its own import mapping and validation — configure that instead of running a second engine beside it

## Alternatives

- **Ask the model to rewrite the sheet (code interpreter, spreadsheet copilots)** — prefer when the sheet is small, the result is looked at once, and nobody needs to reproduce or audit it
- **A PIM's or ETL tool's import mapping (Akeneo, Pimcore, Talend, Power Query)** — prefer when the organisation already runs one and the mapping is maintained by people who own it
- **Hand-written transformation script per supplier** — prefer when the logic needs real code (lookups against an ERP, conditional derivations) beyond the op vocabulary

## Docs

- [docs/blueprint/pim/sheet-workflow.md#agent-proposed-transform-recipe](/docs/blueprint/pim/sheet-workflow) — The split, the column walk, why ops never guess, text all the way through, the two lanes ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/pim/sheet-workflow.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/pim/sheet-workflow.md))
- [docs/blueprint/pim/tutorial.md](/docs/blueprint/pim/tutorial) — Step by step: a German supplier export onto a shop import with a terminal agent ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/pim/tutorial.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/pim/tutorial.md))

## Code

- `src/lib/server/pim/transform-recipe.ts` — The op vocabulary (valibot), checkRecipe's column walk, applyRecipe with per-op reports and the cell change log ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/pim/transform-recipe.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/pim/transform-recipe.ts))
- `src/lib/server/pim/recipe-proposal.ts` — proposeRecipe: the bounded agent loop, prompt blocks escaped as data, graded by code each round ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/pim/recipe-proposal.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/pim/recipe-proposal.ts))
- `src/lib/server/pim/sheet-profile.ts` — The profile: bounded by columns, not rows ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/pim/sheet-profile.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/pim/sheet-profile.ts))
- `src/lib/server/pim/target-schema.ts` — TargetSchema and checkSheet: every row, every rule, source line per issue ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/pim/target-schema.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/pim/target-schema.ts))
- `src/lib/server/pim/sheet-workbook.ts` — Text-only .xlsx read/write: stored digits, never a float ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/pim/sheet-workbook.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/pim/sheet-workbook.ts))
- `src/lib/server/pim/gtin.ts` — Check digit; lost leading zeros restored only when the check digit confirms them ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/pim/gtin.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/pim/gtin.ts))
- `src/lib/server/pim/run-workbook.ts` — The review workbook: products, issues, changes, recipe ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/pim/run-workbook.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/pim/run-workbook.ts))
- `scripts/pim/sheet.ts` — pim example | profile | check | run over a job folder; dated output folders carry the recipe and target they used ([GitHub](https://github.com/ApeDevil/v10r/blob/main/scripts/pim/sheet.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/scripts/pim/sheet.ts))
- `scripts/pim/build.ts` — bun run pim:build — one self-contained program per OS for machines with no Bun, git or repo ([GitHub](https://github.com/ApeDevil/v10r/blob/main/scripts/pim/build.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/scripts/pim/build.ts))

## Tests

- `src/lib/server/pim/recipe-proposal.test.ts` — Scripted model: imagined column refused and fed back, early stop on a clean check, supplier text escaped ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/pim/recipe-proposal.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/pim/recipe-proposal.test.ts))
- `src/lib/server/pim/transform-recipe.test.ts` — Column walk; the worked example: repairs, unresolved values, removed duplicate, change log, determinism ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/pim/transform-recipe.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/pim/transform-recipe.test.ts))
- `src/lib/server/pim/target-schema.test.ts` — Every rule with its line; after the worked recipe only line 7 remains ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/pim/target-schema.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/pim/target-schema.test.ts))
- `src/lib/server/pim/sheet-workbook.test.ts` — xlsx round trip keeps 0012345678905 and 1E5 ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/pim/sheet-workbook.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/pim/sheet-workbook.test.ts))
- `src/lib/server/pim/sheet-profile.test.ts` — Profile size independent of row count ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/pim/sheet-profile.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/pim/sheet-profile.test.ts))

## Invariants

- The model never writes a cell; its only output is a recipe, and a recipe only does what its typed ops do.
- A recipe that reads a column which does not exist when its op runs is refused whole, before any row is touched.
- An op never guesses: a value it cannot read is left unchanged and reported with its source line.
- Done means the target-schema check over every row passes, not that the model says so.
- Every value stays text from file to file; nothing becomes a number unless an op says so.
- A run never overwrites an earlier one; each output folder carries the recipe and target that produced it.

## Emulation notes

- Write the target schema first, from the destination's import documentation — it is the grader, so it must not come from the supplier file or the model.
- Give the agent a profile bounded by columns (counts, top values, shape, a few clipped rows), never the rows; the prompt then costs the same for 40 rows and 40,000.
- Keep the op vocabulary small and typed, and walk the column set through it before running; that one check catches the plan built on an imagined column.
- Read .xlsx numbers as their stored digits and write every cell as text, or GTINs and article numbers are corrupted on the next save.
- Hand over a workbook with the issues and the change log beside the output, and keep the recipe per supplier — next month's export is a re-run, not a new conversation.
- Assume office users have folders and Excel, not git: one job folder per supplier found by file name, a dated output folder per run as the history, and the tool shipped as a single compiled file.

---

_Machine-readable record: `pim-sheet-transform-recipe` in `pattern-library/registry.json`._
