# Clean a supplier's Excel sheet with an AI agent

A supplier sends a product export, and your shop expects something else: English column names,
GTIN-13 barcodes, colours from a fixed list, weights in kg. Instead of fixing thousands of cells
by hand, an AI agent writes a short **recipe** for the sheet, a small program applies it to every
row, and you review the result in Excel.

You need a folder, the supplier's file and an AI agent that can work in a folder: Claude Code,
or any agent that can run a program and save a file. Nothing gets installed, and the folder can
sit on your laptop or on a shared drive.

## What you need

- **The `pim` program.** One file, nothing to install. Ask whoever looks after your
  product-data tools for the copy that matches your computer and put it in a working folder, for
  example `Product data`. On Windows it is `pim.exe`: type `.\pim` wherever this tutorial says
  `pim`. On macOS and Linux, rename it to `pim` and type `./pim`. The prefix tells the terminal
  to run the program from the current folder.
- **The supplier's export.** An `.xlsx` or `.csv` file, exactly as you received it. Save an old
  `.xls` file as `.xlsx` first.
- **What the shop accepts.** The shop's import documentation, so you can describe the target in
  step 2.

## 1. Make a job folder

Make one folder per supplier, next to `pim`. Put the supplier's export in it (one export per
folder). `pim` finds the files by name, so there is nothing to configure.

To practise first, let `pim` write a worked example. Open a terminal in your working folder
(on Windows: right-click the folder, **Open in Terminal**) and type:

```text
pim example Bergwerk
```

```text
Product data/
  pim.exe
  Bergwerk/
    supplier-sheet.csv     the supplier's export
    target.json            what the shop accepts
```

The rest of this tutorial uses that example: a German supplier, Bergwerk, whose sheet has German
column names, colours spelled several ways and weights in grams and kilograms.

## 2. Describe what the shop accepts

The target is the definition of done, so write it before you look at the supplier's file. It
lists every column the shop imports and what a valid value looks like. `target.json` in the
example:

```json
{
	"key": "sku",
	"attributes": [
		{ "name": "sku", "kind": "text", "required": true },
		{ "name": "gtin", "kind": "gtin", "required": true },
		{ "name": "title", "kind": "text", "required": true, "maxLength": 80 },
		{ "name": "color", "kind": "enum", "values": ["Black", "Red", "Blue", "White"] },
		{ "name": "weight", "kind": "measure", "unit": "kg", "required": true },
		{ "name": "brand", "kind": "text", "required": true }
	]
}
```

| Kind | A valid value |
|---|---|
| `text` | Any text, at most `maxLength` characters if set |
| `integer`, `decimal` | A whole number, or a number with a decimal point |
| `gtin` | A barcode number whose check digit is right |
| `enum` | One of `values`, spelled exactly |
| `measure` | A number in `unit` |

`key` names the column that identifies a product, so duplicates can be found. You can ask the
agent to draft this file from the shop's import documentation, but check it yourself: everything
after this step is measured against it.

Then see how far the export is from the target:

```text
pim check Bergwerk
```

Every target column is missing, so every row fails. That is the expected starting point.

## 3. Ask the agent for a recipe

Start the agent in your working folder and give it this prompt:

> Run `pim profile Bergwerk` and read `Bergwerk/target.json`. Write `Bergwerk/recipe.json`
> using only these ops: rename, drop, trim, map_values, convert_unit, normalize_gtin, split,
> concat, fill_empty, change_case, dedupe. Run `pim run Bergwerk`, read the summary, and revise
> the recipe until the only issues left are ones no recipe can fix. Never edit the export.

`pim profile` gives the agent a summary of each column instead of the rows: how full it is, how
many different values it has and the most common ones. Here is the weight column:

```json
{ "name": "Gewicht", "filled": 10, "empty": 0, "distinct": 9, "shape": "mixed",
  "topValues": [{ "value": "1,2 kg", "count": 2 }, { "value": "0.4 kg", "count": 1 },
                { "value": "1200", "count": 1 }, { "value": "850g", "count": 1 }] }
```

That is enough to decide what to do: decimal commas, units with and without a space, and bare
numbers. A sheet with 40,000 rows gives a profile of the same size, so the agent never has to
read, or skip, any rows.

## 4. Read the recipe

The recipe is the agent's whole answer. It does not touch the export; it lists steps, in order,
that `pim` applies to every row. A few of them from the example:

```json
{ "op": "rename", "from": "Farbe", "to": "color" },
{ "op": "map_values", "column": "color",
  "mapping": { "schwarz": "Black", "rot": "Red", "dunkelblau": "Blue", "weiß": "White" } },
{ "op": "convert_unit", "column": "weight", "to": "kg" },
{ "op": "split", "column": "Maße cm (BxHxT)", "separator": "x", "into": ["width_cm", "height_cm", "depth_cm"] }
```

| Op | What it does |
|---|---|
| `rename` | Gives a column a new name |
| `drop` | Removes columns the shop does not take |
| `trim` | Removes extra spaces |
| `map_values` | Replaces listed values, ignoring upper and lower case |
| `convert_unit` | Converts mm, cm, m, g, kg, ml and l |
| `normalize_gtin` | Cleans barcodes and restores leading zeros Excel removed |
| `split`, `concat` | Splits one column into several, or joins several into one |
| `fill_empty` | Fills empty cells with a value |
| `change_case` | Upper case, lower case or title case |
| `dedupe` | Removes repeated products, keeping the first or the last |

A recipe is about twenty lines you can read, where the result is thousands of rows nobody can.
If the recipe names a column that does not exist, `pim` refuses to run it at all, so a half-done
sheet cannot happen.

## 5. Run it and read the summary

The agent runs:

```text
pim run Bergwerk
```

Each run writes a new folder named after the date and time, so earlier runs are never
overwritten:

```text
Bergwerk/output/2026-10-27-1655/
  supplier-sheet-review.xlsx   the result and the review sheets
  recipe.json                  the recipe this run used
  target.json                  the target it was checked against
```

The summary lists each step with how many cells it changed and which values it could not
handle. In the example, the weight conversion left three values alone:

```json
{ "op": 11, "description": "Convert \"weight\" to kg", "changed": 5, "unresolved": 3,
  "examples": [{ "line": 5, "value": "450" }, { "line": 7, "value": "ca. 2kg" }, { "line": 8, "value": "1200" }] }
```

`pim` never guesses. `450` and `1200` have no unit, so they stay as they are until someone
decides. Every other weight in the sheet is between a few hundred grams and two kilograms, so the
agent decides bare numbers are grams and changes one line:

```json
{ "op": "convert_unit", "column": "weight", "to": "kg", "assume": "g" }
```

It runs again. What is left is all on line 7 of the export:

```json
"issues": [
  { "column": "gtin",   "rule": "kind",     "count": 1, "examples": ["4.01235E+12"] },
  { "column": "weight", "rule": "kind",     "count": 1, "examples": ["ca. 2kg"] },
  { "column": "brand",  "rule": "required", "count": 1, "examples": [""] }
]
```

No recipe should fix these. The barcode lost its digits when the supplier's Excel showed it as
`4.01235E+12`, the weight is an estimate, and the brand is missing. Those are questions for the
supplier, and the agent stops here.

## 6. Review in Excel

Open `supplier-sheet-review.xlsx` from the newest output folder. It has four sheets:

| Sheet | For |
|---|---|
| `products` | The import file. Every cell is text, so barcodes keep their leading zeros |
| `issues` | The cells that need a person, with the line they came from in the export |
| `changes` | Every cell the recipe changed, before and after. Filter a column to spot-check it |
| `recipe` | The recipe in plain sentences, with what each step changed and could not handle |

Fix or ask about the rows on the `issues` sheet, then import the `products` sheet into the shop.

## Next month

The job folder is the whole record: the export, the target, the current recipe, and one dated
output folder per run with the exact recipe it used. Zip it, keep it on the shared drive, or
mail it to a colleague.

When the next export arrives, replace the file in the folder and run:

```text
pim run Bergwerk
```

If the supplier added a column or a new colour spelling, `pim check` and the summary show it,
and the agent changes one line of the recipe instead of starting over.

## When to do it by hand instead

A one-off cleanup of a few hundred rows that nobody will send again is faster directly in Excel.
The recipe pays off when the same kind of file comes back (next month's export, the next supplier
with the same template) or when the sheet is too large to check by eye.
