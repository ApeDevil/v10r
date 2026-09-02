# `$lib/desk`

What the Desk *is*, independent of how it is drawn: the layout tree that gets persisted
(`layout.types.ts`), the panel catalogue (`panels.ts`), and the help text (`help.ts`).

It sits below the component layer because three unrelated places need it and none of them
should depend on the Desk's UI: `components/desk/` renders it, `components/shell/` builds
the command-palette entries from it, and `server/db/schema/desk/workspace.ts` persists the
layout shape.

`panels.ts` lists the panel types; the directories under `components/desk/panels/` are
named to match, one per entry.
