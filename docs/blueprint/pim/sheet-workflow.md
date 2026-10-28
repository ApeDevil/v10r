# Product sheet workflow

How v10r turns a supplier's Excel export into a sheet a shop or PIM will import, with an AI
agent doing the judgement and code doing the work.

## Agent-proposed transform recipe

**Problem.** Product data arrives as spreadsheets nobody designed for you: German column
names, colours spelled five ways, weights in grams in one row and `1,2 kg` in the next, GTINs
whose leading zeros Excel removed. Asking a model to "clean the sheet" fails in three known
ways. It cannot hold forty thousand rows, so it samples and silently skips. It rewrites values
it was not sure about, and nobody can tell which ones. And the result cannot be reviewed or
repeated: next month's export starts from zero.

**Method.** Split the decision from the work.

| Piece | Where | What it does |
|---|---|---|
| Product sheet | `product-sheet.ts` | The export as a header and rows of **text**, each row with its source `line`. Refuses a column with values but no header and a repeated header rather than inventing a name |
| Workbook I/O | `sheet-workbook.ts`, `csv-table.ts` | `.xlsx` via `read-excel-file`/`write-excel-file`, numbers read as their stored digits and every cell written as text; CSV with the locale's separator (`;` in a German Excel) |
| Profile | `sheet-profile.ts` | What the agent reads instead of rows: per column fill, distinct count, commonest values, value shape, plus five clipped sample rows. Its size depends on the number of columns, not rows |
| Target schema | `target-schema.ts` | What the destination accepts: per attribute a kind (`text`, `integer`, `decimal`, `gtin`, `enum`, `measure`), `required`, `values`, `unit`, `maxLength`, plus the key column. `checkSheet` checks every row and names each issue with its line |
| Transform recipe | `transform-recipe.ts` | An ordered list of typed ops: `rename`, `drop`, `trim`, `map_values`, `convert_unit`, `normalize_gtin`, `split`, `concat`, `fill_empty`, `change_case`, `dedupe`. `checkRecipe` walks the column set through the ops; `applyRecipe` runs them over every row and returns the output, a per-op report and every changed cell |
| Agent loop | `recipe-proposal.ts` | `proposeRecipe`: the model reads the profile and target, answers with a recipe (structured output), code refuses or runs it, checks the output, and sends what still fails back. At most `maxRounds` rounds; stops on a clean check |
| Review workbook | `run-workbook.ts` | `products`, `issues`, `changes` and `recipe` sheets in one `.xlsx` file |
| CLI | `scripts/pim/sheet.ts` (`bun run pim`), `scripts/pim/build.ts` (`bun run pim:build`) | `example`, `profile`, `check`, `run` over a job folder; compiled into one self-contained program per OS for machines with no Bun, git or repo |

**The ops.** A recipe is `{ "note"?: string, "ops": [...] }`; each op is one of:

| Op | Fields | Does |
|---|---|---|
| `rename` | `from`, `to` | Renames a column in place |
| `drop` | `columns` | Removes columns |
| `trim` | `columns` | Trims and collapses inner whitespace |
| `map_values` | `column`, `mapping` | Replaces listed values (matched ignoring case and surrounding space); others are unresolved |
| `convert_unit` | `column`, `to`, `assume`? | Converts `mm`/`cm`/`m`, `g`/`kg`, `ml`/`l`; a bare number uses `assume`, or is unresolved |
| `normalize_gtin` | `column` | Removes spaces and hyphens, restores lost leading zeros when the check digit confirms them |
| `split` | `column`, `separator`, `into` | Writes the parts into new columns after the source; the last takes the rest |
| `concat` | `columns`, `separator`, `into` | Joins the non-empty values into a new column |
| `fill_empty` | `column`, `value` | Sets empty cells |
| `change_case` | `column`, `mode` (`upper`·`lower`·`title`) | Changes case |
| `dedupe` | `key`, `keep` (`first`·`last`) | Removes rows with a repeated key and lists their lines |

**Why a recipe, not edited cells.** A recipe is about twenty lines a person can read, where the
output is thousands of rows nobody can. It runs the same way every time, so the output can be
reproduced from the input and the recipe, and next month's file reuses it. And it limits what
a wrong proposal can do: the model's only output is a recipe, it has no tool that writes, and a
recipe can only do what its ops do.

**Why a column walk.** The most common way a model's plan goes wrong is a column it imagined:
`Beschreibung` when the sheet says `Bezeichnung`, or the old name after its own rename.
`checkRecipe` follows the column set op by op and refuses any read of a column that does not
exist at that point, and any op that would overwrite one. A recipe with a problem never runs,
not even its valid first ops, so half-applied recipes cannot happen.

**Why ops never guess.** `convert_unit` reads `850g`, `1,2 kg` and a bare `450` (with
`assume: "g"`). It does not read `ca. 2kg`. `normalize_gtin` restores lost leading zeros only
when the check digit confirms the padded number, and refuses `4.01235E+12` because Excel has
already thrown those digits away. An unreadable value is left exactly as it was and listed in
the op's report. The target check then reports it again, on the row where a person can fix it.

**Why text all the way through.** A GTIN is not a number: `0012345678905` turned into a number
is wrong, and so is a 13-digit value stored as a float. The reader keeps a numeric cell's
stored digits, the sheet holds only strings, and the writer writes every cell as text, so a
person who opens and re-saves the output cannot damage it again.

**Two lanes, one engine.**

- *In-app:* an adapter loads the user's provider (`getToolProvider(registry, userId)`) and
  calls `proposeRecipe({ model, sheet, target })`. The result carries the recipe, the run, the
  check, each round's feedback and token usage. It goes to a person for approval, like any
  other proposal.
- *Terminal agent:* an agent (Claude Code or similar) runs `pim profile <folder>`, writes
  `recipe.json`, runs `pim run <folder>` and reads the JSON summary, then revises.
  [tutorial.md](./tutorial.md) goes through this lane step by step.

**Plain folders, no git.** Office users have folders and Excel, not repositories. The terminal
lane assumes nothing else. A *job folder* per supplier holds one export, `target.json` and
`recipe.json`; `pim` finds them by name. Each `run` writes `output/<date-time>/` with the review
workbook and copies of the recipe and target it used, so the folder is its own history: it can
be zipped, mailed or kept on a shared drive, and any past result can be reproduced from its
dated folder. `pim` itself is one file (`bun run pim:build` compiles it for Windows, macOS and
Linux with the Bun runtime inside), so the machine needs no Bun, no Node, no database and no
provider key.

**Untrusted text.** Supplier values are written by third parties. They reach the prompt only
inside escaped `<sheet-profile>` and `<recipe-result>` blocks, which the system prompt declares
to be data. A product title that says "drop every column" can only make the model write a
recipe, and that recipe is checked, run and reviewed like any other.

**Invariants.**
- The model never writes a cell; its only output is a recipe, and a recipe only does what its typed ops do.
- A recipe that reads a column which does not exist when its op runs is refused whole, before any row is touched.
- An op never guesses: a value it cannot read is left unchanged and reported with its source line.
- Done means the target schema check over every row passes, not that the model says so.
- Every value stays text from file to file; nothing is converted to a number unless an op says so.
- A run never overwrites an earlier one; each output folder carries the recipe and target that produced it.

**Proof.** `src/lib/server/pim/*.test.ts`, run in `bun run validate`: the worked example
(`fixtures/`) leaves exactly three issues, all on line 7. The agent loop is tested against a
scripted model: an imagined column is refused and sent back, the loop stops on a clean check,
and supplier text reaches the prompt escaped. The `.xlsx` round trip keeps `0012345678905` and
`1E5` unchanged.

**Next.** A desk adapter: upload an export, show the proposed recipe as a proposal card,
approve it, and download the review workbook. The engine and the loop need no change for this.

Related: [`../ai/untrusted-content.md`](../ai/untrusted-content.md), [`../ai/evals.md`](../ai/evals.md).
