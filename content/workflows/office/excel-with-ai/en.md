# Analyse and transform an Excel sheet with AI

Asking an AI to "clean up this sheet" usually gets you a confident answer about the first few
dozen rows, a column it misread, and a total nobody can check. The sheet is not the problem. The
AI was never told what the sheet means, and it was left to read thousands of rows by eye.

This tutorial works through one real job in the [AI project folder](/workflows/ai-project-folder):
a supplier, Bergwerk, sends a German product export every month, and the shop needs it in its own
import format. Along the way it shows the three things that make any Excel job with AI reliable:
**describe the sheet**, **let a script touch the rows**, and **check the result by numbers**.

**[Download the example folder](/workflows/excel-with-ai/starter-en.zip)** to follow along: the
Bergwerk export in `input/`, the README from step 2 ready to use, and the prompts from this page
in `prompts.md`. Unpack it (right-click, **Extract All**) and point your AI tool at it.

## What you need

- The folder from [Set up a folder for AI work](/workflows/ai-project-folder), with the
  supplier's file in `input/`.
- Whatever AI tool your company provides. The prompts below work in a chat with file upload or an
  agent in the folder. With an assistant inside Excel, paste the README text into the chat pane
  and keep the sheet open.
- A description of what the result should look like: the shop's import documentation, a sample of
  a correct import file, or simply what you know.

## 1. Make the sheet readable

An AI reads a sheet the way a program does, not the way you see it on screen. Before anything
else, look at the source for the things that confuse it:

| On screen | What the AI sees | What to do |
|---|---|---|
| Two tables side by side on one sheet | One wide table with empty columns | Say in the README which range is which, or ask for one sheet per table |
| Merged cells and multi-row headers | Empty cells and headers named `Unnamed: 3` | Say which row holds the real headers |
| Colour means something ("red = discontinued") | Nothing at all; colour is usually lost | Add a column in your description, or say "red rows are discontinued" so a script can read the fill |
| A totals row at the bottom | A product called "Total" | Say "the last row is a total, skip it" |
| `4.01235E+12` in a barcode column | A rounded number: the digits are gone | Mention it; the script must flag it, not "fix" it |

Do not tidy the supplier's file by hand to get rid of these. Describe them, so the script handles
them the same way next month.

## 2. Describe the sheet in the README

This is the step people skip, and it is the one that matters most. The AI knows Excel; it does not
know your business. Add a **Columns** section to `README.md`: one line per column, what it means
and anything odd about it.

```markdown
## Sources (input/)
- `bergwerk-products.xlsx`, sheet `Export`, headers in row 1, one row per product.
  `Artikelnr` is the supplier's unique product number.

### Columns
| Column | Meaning | Notes |
|---|---|---|
| Artikelnr | Supplier article number | Unique; becomes our `sku` |
| EAN | Barcode (GTIN-13) | Excel sometimes shows it as 4.01235E+12 |
| Bezeichnung | Product name, German | Can be longer than 80 characters |
| Farbe | Colour, German, free text | "schwarz", "Schwarz", "sw" all mean black |
| Gewicht | Weight | Mixed: "1,2 kg", "850g", "1200" (no unit) |
| Maße cm (BxHxT) | Width x height x depth in cm | One text value, e.g. "30 x 45 x 15" |
| Hersteller | Brand | Sometimes empty |
| Kategorie | Product category, German | Not imported |
```

Then describe the **target** the same way. It is the definition of done, so be exact:

```markdown
## Target (output/<date>/shop-import.xlsx, sheet `products`)
| Column | Format | Required |
|---|---|---|
| sku | Text, from Artikelnr | yes |
| gtin | 13 digits, valid check digit, stored as text | yes |
| title | Text, at most 80 characters | yes |
| color | One of: Black, Red, Blue, White | no |
| weight_kg | Number in kg, decimal point | yes |
| width_cm, height_cm, depth_cm | Numbers | no |
| brand | Text, from Hersteller | yes |
```

You do not have to write this alone. Ask the AI: "Look at input/bergwerk-products.xlsx and draft
the Columns table for README.md. Mark anything you are unsure about with a question mark." Then
correct its draft. Fixing a draft is much faster than starting from nothing, and the question marks
show you exactly where it would have guessed.

## 3. Look before changing anything

The first real prompt asks the AI to **profile** the sheet, not to change it:

> Read README.md. Write a Python script tools/profile.py that reads every row of
> input/bergwerk-products.xlsx and reports, for each column: how many cells are filled, how many
> different values there are, the ten most common values, and anything that does not fit the
> description in README.md. Run it and show me the report. Don't change anything.

Why a script and not "look at the sheet": the AI can only read so much text at once. On a large
sheet it silently looks at the first rows and assumes the rest look the same. A profile covers
every row, whatever the size, and comes back as one short report. For the example sheet's weight
column:

```text
Gewicht   filled 24 / 24   distinct 23
  top: "1,2 kg" (2)  "850g" (1)  "0.4 kg" (1)  "450" (1)  "ca. 2kg" (1)
  note: decimal commas and points; units with and without a space; 2 values without a unit
```

On a sheet with forty thousand rows the report is the same length. Read it against your Columns
table. Every surprise is either a mistake in your description (fix the README) or a decision to make (write it under Decisions):

```markdown
## Decisions
- 2026-10-29: weights without a unit are grams; every weight with a unit is under 2 kg.
- 2026-10-29: "ca." values are estimates; leave them for the supplier, don't convert.
```

## 4. Agree on the plan

> Write the plan as a table: each target column, the source column it comes from, and the rule
> that turns one into the other. List the values you could not map. Wait for my OK.

The plan is short enough to read in a minute, and it is where you catch the real mistakes: a
colour mapped to the wrong value, two columns swapped, a unit assumed the wrong way round. Correct
it in plain words. When it is right, say OK.

## 5. Let the script do the work

> Write tools/transform.py that follows the plan. It reads input/bergwerk-products.xlsx and writes
> output/2026-10-29/shop-import.xlsx with three sheets: `products` (the import), `issues` (every
> value it could not convert, with the source row number and the reason) and `changes` (every cell
> it changed, before and after). Store every cell as text so barcodes keep their leading zeros.
> Never guess: a value that does not fit the rules stays unchanged and goes on issues. Run it and
> give me the counts.

Three details in that prompt do most of the work:

- **"Never guess."** Without it, an AI fills gaps with plausible values. With it, the gaps end up
  on a list you can work through.
- **The `issues` sheet with source row numbers.** A problem you can find in the original file is a
  problem you can ask the supplier about.
- **The `changes` sheet.** Every change is visible, so you can filter one column and see at a
  glance whether the colour mapping did what you meant.

If your tool runs Python inside Excel instead, ask for the same thing as `=PY()` cells on a new
sheet: the formulas stay in the workbook and recalculate when the data changes.

## 6. Check the result by numbers

"Looks good" is not a check. Ask the AI for numbers you can verify, then verify a few yourself:

| Check | Ask or do | It catches |
|---|---|---|
| Row count | "How many product rows in the source, in products, in issues?" | Lost or duplicated rows |
| Totals | "Sum of weight in kg, before and after" (convert the source by hand for three rows) | Wrong unit factor |
| Value list | Filter `color` in the result: only the allowed values plus empties? | Unmapped spellings |
| Spot check | Pick five random source rows and find them in the result | Shifted or swapped columns |
| Issues | Read the `issues` sheet: is every entry really unfixable? | Rules that are too strict |
| Assumptions | "Which assumptions did you make that are not in README.md?" | Silent guesses |

Anything the last question turns up goes under Decisions, or becomes a rule.

## Analysis instead of transformation

The same folder answers questions about a sheet. The pattern is the same: describe, compute by
script, check. What changes is the prompt. Say **which columns**, **how to compute** and **what
form the answer should take**:

| Vague | Precise |
|---|---|
| "Analyse the sales." | "Total `Revenue` per `Region` and month, from sheet `2026`, as a pivot table on a new sheet." |
| "Any problems in the data?" | "List rows where `Weight` is empty or `GTIN` fails the check digit, with row numbers." |
| "Which suppliers are best?" | "Rank suppliers by on-time rate (`Delivered` on or before `Promised`), at least 20 orders each." |
| "Make a chart." | "Line chart of monthly revenue per region, one line per region, saved as a sheet in the result." |

And ask for the answer **in the workbook**, as formulas, a pivot table or a script, not only as a
sentence in the chat. A number in the chat cannot be checked; a formula can.

## Next month

When the next export arrives, put it in `input/` (keep last month's file under a dated name or
move it into its output folder), then:

> New export in input/. Run tools/profile.py and tell me what is different from last time. If
> nothing new, run tools/transform.py into output/2026-11-28/.

A new column or a new colour spelling shows up in the profile, the AI changes one line of the
script, and you add one line to Decisions. The month after that is a single message.

## When to do it by hand instead

A one-off fix of a few hundred rows that nobody will send again is faster directly in Excel. The
folder pays off when the same kind of file comes back, when the sheet is too large to check by eye,
or when someone else has to understand later what was done.
