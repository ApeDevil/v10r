# Dynamic Attributes — plan and progress record

The durable plan for [pattern.md](./pattern.md): the phases as planned, what each delivered,
the second-pass audit and what it changed. Branch `claude/cloud/dynamic-attributes`;
development mode, so nothing here is merged or deployed.

## Phases

| Phase | Scope | Status |
|---|---|---|
| Research | Internal inventory and external survey → [research.md](./research.md) | Done 2026-11-05 |
| A — core contract | `#lib/dynamic-attributes/`: JSON bounds, limits, kind registry and seven core kinds, codec with upcasters, engine operations, diagnostics, three-way merge, store contract, text projection | Done |
| B — renderer | `#lib/components/composites/attributes/`: editor state (undo, coalescing, refusals), `AttributeEditor`, `AttributeRow`, one control per kind, lazy-control support, keyboard reorder, mobile layout, `attributes_*` i18n (en, de, ru) | Done |
| C — persistence | Spreadsheet autosave lifted into `#lib/state/document-*` (generic, plus `rebase`); `desk.record` detail table; `createRecordFile` / `updateRecordByFileId` (parse → lock → version → revision); API GET/PUT/POST with 409/413/422 | Done |
| D — desk integration | `RecordPanel` (menus, AI context, bus refresh, flush on leave), panel registry, About help, Explorer *New Record*, open by file type, unsaved work at sign-out, assistant read path and retrieval projection | Done |
| E — showcase | `/showcases/dynamic-attributes`: two writers over one browser store, offline switch, reset, stored-JSON view, import box with hostile samples, an application kind (`app.rating`) | Done |
| F — library and docs | This directory, `pattern-library/registry.json` entry `dynamic-attributes`, naming vocabulary, desk/spreadsheet/execution docs, rebuilt pattern pages and MCP excerpts | Done |
| Tests and gates | Unit (core, editor state, autosave, drafts), PGlite (record mutations), HTTP contract, browser drive of the showcase, benchmark | Done — see *Verification* |

## Verification

- Unit and contract tests: `codec.test.ts`, `operations.test.ts`, `merge.test.ts`,
  `stores.test.ts`, `attribute-editor.svelte.test.ts`, `document-autosave.test.ts` (with
  three rebase cases), `spreadsheet-drafts.test.ts`, `record-mutations.pglite.test.ts`,
  `api/desk/files/[id]/server.test.ts` (record cases).
- Browser (cloud dev server, Playwright, 2026-11-05): a fresh record opens with one empty
  `Name` row; text, number, rating and a text→number change with the kept previous value;
  writer A saves, writer B edits without reloading → conflict → *Merge both* → saved with both
  edits; reload restores the stored record and offers the unsaved draft for recovery; the
  import box refuses the prototype-pollution sample (`invalid_shape`, reserved key) and accepts
  the valid one, whose unknown kind renders read-only. No console errors.
- `bun run attributes:bench` — figures in [pattern.md](./pattern.md#performance).
- Not run in the cloud: `db:push` against Neon (the `desk.record` table and the
  `file_revision.document` column exist only after a push), the RAG ingest of these docs, and
  the desk panel against a real signed-in session (the API and the mutations are covered by
  the contract and PGlite tests).

## Second-pass architecture audit

Done after E, reading the branch as a reviewer would. Findings and outcomes:

| Finding | Outcome |
|---|---|
| The pattern-library record `versioned-document-session` and three docs still named the moved `spreadsheet-autosave.ts`. | Repointed to `#lib/state/document-autosave.ts` / `document-drafts.ts`; pages and excerpts rebuilt. |
| `canonicalJson` was declared twice (here and in asset production), caught by the naming gate. | One implementation in `#lib/utils/canonical-json.ts`, imported by both. |
| The editor lived in a feature-rank component directory, so the desk panel and the showcase importing it broke component layering (architecture gate). | Moved to `#lib/components/composites/attributes/`: it imports only primitives, which is what a composite is. |
| The bot's desk layout listed spreadsheet and markdown panels' file type but not records'. | Record panels report `fileType: 'record'`. |
| Sessions were held in deep `$state`, which proxies the session object and its engine. | `$state.raw` in the panel and the showcase; snapshots are replaced, never mutated. |
| Type selects had no accessible name (the `Select` primitive took no `aria-label`). | `Select` takes `id` and `aria-label`; every type select is named; the add bar puts the type before *Add*. |
| The proposal undo path has no record branch. | Left as is on purpose: `StepRecoveryPoint` types revision points as spreadsheet or markdown only, because the assistant has no tool that writes a record. Adding a write tool must add the undo branch with it. |
| Every operation re-serializes the record to check the byte cap (O(n) per keystroke). | Kept: 0.35 ms at the 200-attribute limit. An incremental size count would add state that can drift from the truth. |

## Decisions that need ApeDevil

None block the branch. Two are worth a look when reviewing: whether the assistant should get
a record write tool (it would need the proposal-undo branch above), and whether `record` is
the name the desk's Explorer should show for this file type.
