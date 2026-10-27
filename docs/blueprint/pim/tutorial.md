# Tutorial: a supplier export onto a shop import, with an AI agent

You receive a product export from a German supplier and need to import it into a shop that
expects English attribute names, GTIN-13s, colours from a fixed list and weights in kg. This
tutorial follows the terminal lane of the [sheet workflow](./sheet-workflow.md): an AI agent
(Claude Code, or any agent that can run a program and write a file) analyses the sheet and
writes a recipe, the `pim` program does the transformation, and you review the result in Excel.

**No git, no repo, no installation.** Everything happens in an ordinary folder, on a laptop or a
shared drive. `pim` is a single program file (`pim.exe` on Windows); someone with this repo
builds it once with `bun run pim:build` and hands it out. Inside the repo, `bun run pim` is the
same program.

## 0. Set up a job folder

One folder per supplier. To follow along, let `pim` write the worked example into one:

```text
pim example Bergwerk
```

```text
Bergwerk/
  supplier-sheet.csv     the supplier's export (an .xlsx works the same way)
  target.json            what the shop accepts
```

For real work, put the supplier's `.xlsx` or `.csv` (one per folder) and your `target.json`
in the folder yourself. `pim` finds the files by name, so there is nothing to configure.

## 1. Describe the destination: the target schema

The target schema is the definition of done, so write it first. It comes from the shop's import
documentation, not from the supplier file. `target.json`:

```json
{
	"key": "sku",
	"attributes": [
		{ "name": "sku", "kind": "text", "required": true },
		{ "name": "gtin", "kind": "gtin", "required": true },
		{ "name": "title", "kind": "text", "required": true, "maxLength": 80 },
		{ "name": "color", "kind": "enum", "values": ["Black", "Red", "Blue", "White"] },
		{ "name": "weight", "kind": "measure", "unit": "kg", "required": true },
		{ "name": "width_cm", "kind": "decimal" },
		…
		{ "name": "brand", "kind": "text", "required": true }
	]
}
```

Check the export against it to see how far apart they are:

```text
pim check Bergwerk
```

Every target column is missing, so every row fails. That is the expected starting point.

## 2. Let the agent read the profile, not the sheet

```text
pim profile Bergwerk
```

The profile lists each column with its fill, distinct count, commonest values and shape. Here
is the weight column:

```json
{ "name": "Gewicht", "filled": 10, "empty": 0, "distinct": 9, "shape": "mixed",
  "topValues": [{ "value": "1,2 kg", "count": 2 }, { "value": "0.4 kg", "count": 1 },
                { "value": "1200", "count": 1 }, { "value": "850g", "count": 1 }, …] }
```

This is everything the agent needs to decide: decimal commas, units with and without a space,
and bare numbers. A 40,000-row export produces a profile of the same size, because the size
depends on the columns, not the rows.

A prompt that works well for the agent, run in the folder that holds `pim` and `Bergwerk`:

> Run `pim profile Bergwerk` and read `Bergwerk/target.json`. Write `Bergwerk/recipe.json`
> using only these ops: rename, drop, trim, map_values, convert_unit, normalize_gtin, split,
> concat, fill_empty, change_case, dedupe. Run `pim run Bergwerk`, read the summary, and revise
> the recipe until the only issues left are ones no recipe can fix. Never edit the export.

The op list with every field is in [sheet-workflow.md](./sheet-workflow.md); give it to an
agent that has not seen it.

## 3. The first recipe

The agent renames the columns, trims text, removes duplicates, normalizes GTINs, maps colours,
converts weights to kg, splits the dimensions and drops what the shop does not take:

```json
{ "op": "map_values", "column": "color",
  "mapping": { "schwarz": "Black", "black": "Black", "rot": "Red", "dunkelblau": "Blue", "weiß": "White" } },
{ "op": "convert_unit", "column": "weight", "to": "kg" },
{ "op": "split", "column": "Maße cm (BxHxT)", "separator": "x", "into": ["width_cm", "height_cm", "depth_cm"] }
```

Matching ignores case and surrounding whitespace, so `Schwarz ` and `ROT` need no entries of
their own.

## 4. Run it and read the summary

```text
pim run Bergwerk
```

Each run writes a new dated folder, so earlier runs are never overwritten:

```text
Bergwerk/output/2026-10-27-1655/
  supplier-sheet-review.xlsx   the result and the review sheets
  recipe.json                  the recipe this run used
  target.json                  the target it was checked against
```

The summary lists each op with its counts. Two ops could not handle every value:

```json
{ "op": 11, "description": "Convert \"weight\" to kg", "changed": 5, "unresolved": 3,
  "examples": [{ "line": 5, "value": "450" }, { "line": 7, "value": "ca. 2kg" }, { "line": 8, "value": "1200" }] }
```

`450` and `1200` have no unit, so the op left them unchanged instead of guessing one. That is
a decision for the agent (or you) to make. Every other value in the column is a few hundred
grams to two kilograms, so bare numbers are grams.

If the recipe had used a column that does not exist (`Beschreibung` instead of `Bezeichnung`,
say), the run would have stopped before touching any row and named the op. The same applies
to the old name used after a rename.

## 5. Revise

One field changes:

```json
{ "op": "convert_unit", "column": "weight", "to": "kg", "assume": "g" }
```

Run it again. Every issue left is on line 7:

```json
"issues": [
  { "column": "gtin",   "rule": "kind",     "count": 1, "examples": ["4.01235E+12"] },
  { "column": "weight", "rule": "kind",     "count": 1, "examples": ["ca. 2kg"] },
  { "column": "brand",  "rule": "required", "count": 1, "examples": [""] }
]
```

No recipe should fix these. The GTIN lost its digits when the supplier's Excel showed it in
scientific notation, the weight is an estimate, and the brand is missing. Ask the supplier, and
the agent stops here.

## 6. Hand over

The review workbook has four sheets:

| Sheet | For |
|---|---|
| `products` | The import file: nine rows (the duplicate `A-1002` on line 9 is gone), every cell text, so `0012345678905` keeps its zeros |
| `issues` | The three cells on line 7 that need a person, by source line |
| `changes` | Every cell the recipe changed, with before, after and op number. Filter it to spot-check a column |
| `recipe` | The recipe as plain sentences, with each op's counts and its unresolved values |

The job folder is the record: the export, the target, the current `recipe.json`, and one dated
output folder per run with the exact recipe it used. Zip it, put it on the shared drive, or
mail it. When next month's export arrives, replace the export file and run `pim run Bergwerk`
again. If the supplier added a column or a new colour spelling, `check` and the unresolved
list show it, and the agent revises one line instead of starting over.

## The same loop inside the app

`proposeRecipe({ model, sheet, target })` runs steps 2–5 itself: the model proposes, code runs
and checks, and the remaining issues go back to the model, for up to three rounds. The result is
the recipe, the run, the check and each round's feedback, and a person approves it. See
[sheet-workflow.md](./sheet-workflow.md#agent-proposed-transform-recipe).
