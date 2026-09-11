# `$lib/desk`

What the Desk *is*, independent of how it is drawn: the layout tree that gets persisted
(`layout.types.ts`), the panel catalogue (`panels.ts`), the help text (`help.ts`), and the
spreadsheet's meaning — the formula evaluator (`formula.ts`) and the persisted cell contract
with its recalculation pass (`spreadsheet-cells.ts`).

It sits below the component layer because unrelated places need it and none of them should
depend on the Desk's UI: `components/desk/` renders it, `components/shell/` builds the
command-palette entries from it, `server/db/schema/desk/workspace.ts` persists the layout
shape, and `server/db/desk/mutations.ts` re-derives every spreadsheet value it stores — the
sheet has two writers, the grid and the AI tools, and a value one stores must be the value
the other would compute.

`panels.ts` lists the panel types; the directories under `components/desk/panels/` are
named to match, one per entry.
