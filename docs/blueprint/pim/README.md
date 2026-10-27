# Product data (PIM)

Office workflows over product information: the supplier exports, ERP dumps and marketplace
templates that arrive as Excel files and have to become one clean, importable product sheet.
The code lives in `src/lib/server/pim/`. The `pim` program (`bun run pim`, or a standalone file
built with `bun run pim:build`) works on plain folders, so office users need no git and no repo.

> The agent decides what should happen to the sheet. Code does it to every row. A person
> reviews the recipe and the rows the code could not read.

## Files

| File | Topics |
|------|--------|
| **[sheet-workflow.md](./sheet-workflow.md)** | • Agent-proposed transform recipe: profile instead of rows, a typed op list instead of edited cells, a column walk that refuses imagined columns, ops that leave unreadable values unresolved, a target-schema check as the definition of done<br>• The agent loop (propose → run → check → revise, bounded rounds) and its two lanes: an in-app model through `proposeRecipe`, or an agent at a terminal through the `pim` program over plain job folders (no git, no repo; a dated output folder per run is the history)<br>• Text-only reading and writing of `.xlsx`/CSV (leading zeros, GTINs, `1E5`), GTIN recovery by check digit, the review workbook |
| **[tutorial.md](./tutorial.md)** | Step by step, in a plain folder with the standalone `pim` program: a German supplier export onto a shop import with an AI agent — profile, target schema, first recipe, reading the run summary, revising, handing the review workbook to a person |

## When not to use this

A one-off cleanup of a few hundred rows that nobody will receive again is faster by hand in
Excel. The recipe pays off when the same kind of file arrives again (next month's export, the
next supplier with the same template) or when the sheet is too large to check by eye.

## Related

- [`../ai/untrusted-content.md`](../ai/untrusted-content.md): why supplier text reaches the prompt only escaped, as data.
- [`../desk/spreadsheet.md`](../desk/spreadsheet.md): the in-app spreadsheet, a different tool — a small sheet a person and the assistant edit together.
- [`../ai/evals.md`](../ai/evals.md): the same "grade by code, not by a model" rule applied to chat turns.
