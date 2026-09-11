# Spreadsheet as File Type

Spreadsheets are managed through a unified `desk.file` registry table — the Explorer queries one table for all file listings. Type-specific data (cells, column metadata) lives in the `desk.spreadsheet` detail table joined by `file_id`.

## Desk File Registry

Single Table Inheritance (STI) pattern: `desk.file` is the base, `desk.spreadsheet` is the detail.

```sql
-- desk.file — unified registry
CREATE TABLE desk.file (
  id                   TEXT PRIMARY KEY,         -- fil_{12 hex}
  user_id              TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  folder_id            TEXT REFERENCES desk.folder(id) ON DELETE SET NULL,
  type                 desk.file_type NOT NULL,  -- enum: 'spreadsheet' | 'markdown'
  name                 TEXT NOT NULL DEFAULT 'Untitled',
  ai_context           BOOLEAN NOT NULL DEFAULT false,
  origin_tool_call_id  TEXT,                     -- set when created by an AI tool call
  deleted_at           TIMESTAMPTZ,              -- soft delete
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- desk.spreadsheet — detail table; file_id is part of the definition (push-only schema, no migrations)
CREATE TABLE desk.spreadsheet (
  id          TEXT PRIMARY KEY,
  file_id     TEXT NOT NULL REFERENCES desk.file(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL,
  name        TEXT NOT NULL,
  cells       JSONB NOT NULL,
  column_meta JSONB,
  version     INTEGER NOT NULL DEFAULT 0,
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Indexes on `desk.file`: `(user_id, type)` for filtered listing, `(user_id, updated_at)` for recent-first sorting, `(user_id, folder_id)`, and `(ai_context)` — all partial `WHERE deleted_at IS NULL` — plus `(origin_tool_call_id)`.

### Why STI, not a polymorphic join

Each file type has different detail columns (spreadsheets have `cells` JSONB; future diagrams might have `svg` TEXT). A single `desk.file` table with a `type` enum keeps Explorer queries simple (`SELECT * FROM desk.file WHERE user_id = ? ORDER BY updated_at DESC`) while detail tables hold type-specific data. Adding a new file type = new enum value + new detail table + new API branch.

**Markdown is the concrete second STI instance.** `type = 'markdown'` files store their body in the `desk.markdown` detail table (`createMarkdownFile` / `updateMarkdownByFileId` / `getMarkdownByFileId`). The desk-files adapter renders them with `i-lucide-file-text` and a reduced capability set (no duplicate).

## REST API

All endpoints require authentication (`guardApiUser`). File IDs use the `fil_` prefix.

### `GET /api/desk/files?type=spreadsheet`

List user's files, optionally filtered by `?type=`. Returns `{ files: FileListItem[] }`.

### `POST /api/desk/files`

Create a new file. Body is a Valibot-validated variant discriminated on `type`:

```json
{ "type": "spreadsheet", "name": "Q1 Budget" }
```

Creates both `desk.file` and `desk.spreadsheet` rows in sequence. Returns `{ file, spreadsheet }` with status 201.

### `GET /api/desk/files/:id`

Fetch file + detail data. For spreadsheets, joins `desk.spreadsheet` by `file_id`. Returns `{ file, spreadsheet }`.

### `POST /api/desk/files/:id`

Duplicate a file. Calls `duplicateSpreadsheetFile()` to copy the file + detail rows. Returns the new file with status 201.

### `PUT /api/desk/files/:id`

Update file name and/or type-specific data. Content writes require the version returned by GET:

```json
{ "name": "Renamed", "cells": { "A1": { "v": "hello" } }, "columnMeta": null, "expectedVersion": 0 }
```

- Name-only update: calls `renameFile()`
- Cell/column update: `updateSpreadsheetByFileId()` locks the owned file and sheet,
  checks `expectedVersion`, records the pre-image, increments `spreadsheet.version`,
  and touches `desk.file.updated_at` in one transaction. Success returns
  `{ data: { file, version } }`; a stale write returns HTTP 409 (`version_conflict`)
  without changing content, metadata, or revision history. AI writes use the same check.
- Move and AI-context changes must be separate requests from content writes; missing
  versions and mixed requests are rejected before any mutations.

The `version` column is part of the push-only schema. Apply the normal containerized
schema-sync workflow before running this code against an existing database; no
compatibility fallback or migration shim is provided.

### `DELETE /api/desk/files/:id`

Soft-deletes the file: `deleteFile()` sets `deleted_at` on the `desk.file` row and its matching detail row (spreadsheet or markdown) inside a transaction, then returns 204. The row is not hard-deleted, so `ON DELETE CASCADE` never fires. There is no restore endpoint — the row stays soft-deleted until the `deskRetention` job (`$lib/server/jobs/desk-retention.ts`) hard-deletes it after `DESK_SOFT_DELETE_RETENTION_DAYS`. CASCADE on `spreadsheet.file_id` is only a backstop for hard deletion (e.g. user removal), not this endpoint.

## SpreadsheetPanel

`SpreadsheetPanel.svelte` operates in two modes based on `panelId`:

| Mode | panelId pattern | Persistence | Source |
|------|----------------|-------------|--------|
| **File** | `spreadsheet-fil_xxx` | `desk.file` API | Explorer "New Spreadsheet" / "Open" |
| **Empty** | anything else | None | Activity bar toggle; offers Explorer |

File mode resolves both `spreadsheet-fil_xxx` and timestamp-suffixed duplicate panel
IDs to the same file. Panels for one user/file share a document session (including
selection/editing state) and one save queue. Sessions are created only in the browser.

### Auto-save

Committed edits synchronously capture a localStorage draft, then debounce saves for
1.5 seconds. Only one PUT per document session is in flight; later edits remain
pending and are sent with the returned version. Failures retain the draft and offer
retry; reconnecting retries mounted panels. A failed initial load never enables editing.

Uncommitted cell/formula input is backed up too, but is sent only on commit. Panel
closure, navigation, page hiding and tab exit commit input and flush the queue.
Panel teardown does not cancel the document's queue. Tab-close network delivery is
not guaranteed: recovery relies on the synchronous draft, not the final request.

Draft slots are scoped by user, file and document session so tabs cannot overwrite
or clear each other's backups. Reopening after a reload offers recoverable drafts;
recovery preserves the original version and pauses on a conflict. Recovering or
dismissing a draft retires that slot, so an adopted draft is never offered twice;
an untouched slot is retained, because another tab may still be active. Local
backups are plaintext on this browser; storage failures are visible and unsaved
tab exits prompt the user.

AI refreshes never replace pending edits. Out-of-order reads are ignored; a newer
remote version pauses saving with an explicit conflict notice. Download the local
JSON draft before choosing **Discard local edits and reload** to reconcile manually.
A failed reload retains local work. There is no automatic merge or force overwrite.

Regression tests: `spreadsheet-autosave.test.ts` covers queue/draft/state failures;
`db/desk/mutations.pglite.test.ts` covers version/revision integrity; the file API and
AI replay tests cover their conflict contracts. PGlite does not prove concurrent
multi-connection locking, and vitest never runs the panel's lifecycle wiring; both were
verified by hand in Chrome on 2026-09-11 (two tabs against Neon: 409 on the stale save,
conflict banner, draft recovery across tabs, flush on `visibilitychange`/`pagehide`/
navigation, retry after a failed save, `online` re-flush).

### Formula evaluation

A cell's stored value is an answer, not a fact: it is only correct while the cells it reads
are unchanged. The grid therefore never reuses one. `createGridResolver`
(`$lib/desk/formula.ts`) builds a getter for a single recalculation pass, and every
reference — typed, loaded from storage, or reached through a range — is resolved depth-first
through it.

Two consequences follow, and both were live defects before the resolver existed:

- **Storage order carries no dependency information.** A cell's inputs may be stored after
  it, so a single sweep that reads the previous pass's values loses one generation per link
  in the chain: entering `A1 = B1`, then `B1 = C1`, then `C1 = 1` left `A1` empty.
- **A cycle is only visible across cell boundaries.** One `visiting` stack spans the whole
  pass, so a reference that re-enters a cell still being computed reports `#CIRC!` instead
  of that cell's stale value. `#CIRC!` and `#ERROR` propagate through aggregates and `IF`
  conditions rather than being filtered out — summing around a broken input would answer a
  sheet that has no answer, and the reader would have no reason to distrust the number.

Results are memoized per pass, so a shared dependency is evaluated once however many cells
read it. Error sentinels are matched by membership (`isFormulaError`), not by a leading
`#`, so a cell holding `#1 pick` stays data.

`fromJSON` restores only each cell's raw text and re-derives every value, because a stored
value may have been written by a writer whose inputs have since changed.

The cell store is a `SvelteMap`, not a `Map` under `$state`: `$state` proxies only plain
objects and arrays, so a recalculation that rewrote a dependent cell in place was invisible
to that cell's `<td>` — the model held `1`, the screen kept showing the old value until the
sheet was reloaded, which is how the chain above looked "fixed" in unit tests and broken in
the browser. With `SvelteMap` every `get` in the grid subscribes to its key.

### The write door re-derives too

The grid is not the sheet's only writer. `desk_update_cells` and `desk_create_spreadsheet`
hand the database a merged map with no grid in the loop, and before 2026-09-11 that map was
stored as given: writing an input of an existing formula left the formula's stored `v` at its
old value, and a formula the AI wrote was stored as text with no `f`. `desk_read_file` and the
retrieval copy (`spreadsheetToText`) both read stored `v`, so the assistant's next turn
reported the stale total as fact. Item 2's fix never reached this path — the browser is not
in it.

The rule therefore sits where every writer passes: `createSpreadsheetFile` and
`updateSpreadsheetByFileId` run `recalculateCells` (`$lib/desk/spreadsheet-cells.ts`) before
the row is written. It canonicalises labels (`b2` → `B2`), drops empty cells, marks a `=`
string as a formula, and re-derives every `v` through the same `createGridResolver` the grid
uses — so a stored sheet is internally consistent whoever wrote it, and the grid's own save is
a no-op through it (idempotence is tested). A label the sheet cannot address (`AA1`, `total`)
is refused rather than dropped, before any lock is taken: the AI tools validate addresses first
through `applyCellUpdates` and report the offending one; the REST body's `cells` keys are
validated by valibot. The evaluator lives in `$lib/desk/` for this reason — a value one writer
stores must be the value the other would compute.

The stored sheet being right is not the same as the open panel showing it. `desk_update_cells`
is approval-gated: in the loop it returns `requiresApproval` and touches nothing, and the
write happens in `POST /api/ai/proposals/[id]/approve` through `executeDeskToolCall`. That
replay is the only moment the mutation exists, so it is also the only place the desk can be
told about it: each executed step returns `DeskEffect[]` (`desk:refresh_file` and a
`modified` tab indicator for a cell write), the endpoint returns them beside the execution
result, and `ChatPanel` dispatches them before resuming the conversation. Before 2026-09-11
nothing sent `ai:refresh_file`, so an approved AI write left the panel on the pre-AI sheet
at a stale version, and the user's next keystroke was refused as a conflict with a change
made on their behalf.

### AI Context

The panel registers with the dock's AI context system via `registerPanelContext()`. An 800ms debounced `$effect` updates context on selection/cell changes, providing the AI assistant with current spreadsheet state.

## Explorer Integration

The Explorer's `data/` section shows desk folders and spreadsheet files. Folders come from `GET /api/desk/folders`; files from `GET /api/desk/files`.

- **Open**: click or context menu "Open" → `dock.addPanel()` with deduplication (reuses existing tab if already open)
- **Open in New Panel**: context menu → creates second panel with timestamp-suffixed ID
- **Create**: File menu "New Spreadsheet" or folder context menu → `POST /api/desk/files` → opens panel
- **Rename**: inline input via context menu or F2 → `PUT /api/desk/files/:id` with `{ name }`
- **Duplicate**: context menu → `POST` creates copy with "X copy" naming → auto-enters rename
- **Move**: drag-and-drop between folders → optimistic `state.moveNode()` + API
- **AI Context**: pin icon toggle → `PUT /api/desk/files/:id` with `{ aiContext }` → persisted server-side
- **Delete**: inline confirmation strip (replaces `window.confirm`) → `DELETE /api/desk/files/:id`
- **Icon**: `i-lucide-sheet` (green) for files, `i-lucide-folder` (amber) for folders

## File Structure

```
$lib/server/db/schema/desk/
  schema.ts                          # deskSchema = pgSchema('desk')
  file.ts                            # desk.file table + file_type enum ('spreadsheet' | 'markdown')
  folder.ts                          # desk.folder table
  spreadsheet.ts                     # desk.spreadsheet detail table (file_id FK NOT NULL)
  markdown.ts                        # desk.markdown detail table (file_id FK NOT NULL)
  index.ts                           # Re-exports all desk schema objects

$lib/server/db/desk/
  queries.ts                         # listFiles, getFile, getSpreadsheetByFileId, getMarkdownByFileId, getAiContextFiles, listFolders, getFolder, countFolderContents
  mutations.ts                       # createSpreadsheetFile, createMarkdownFile, renameFile, deleteFile, updateSpreadsheetByFileId, updateMarkdownByFileId, folder mutations, moveFile, duplicateSpreadsheetFile, toggleFileAiContext

src/routes/api/desk/files/
  +server.ts                         # GET (list) + POST (create)
  [id]/+server.ts                    # GET + POST (duplicate) + PUT + DELETE

src/routes/api/desk/folders/
  +server.ts                         # GET (list) + POST (create)
  [id]/+server.ts                    # GET + PUT + DELETE

$lib/desk/
  formula.ts                         # Expression evaluator + grid resolver (dependency order, cycles)
  spreadsheet-cells.ts               # PersistedCell contract + recalculateCells (the write door's pass)

$lib/components/desk/panels/spreadsheet/
  SpreadsheetPanel.svelte            # Lifecycle, recovery and conflict UI
  spreadsheet-session.svelte.ts      # Per-user/file shared browser document
  spreadsheet-autosave.ts            # Serialized queue and refresh/conflict state machine
  spreadsheet-drafts.ts              # Isolated localStorage draft slots
  spreadsheet.state.svelte.ts        # Sparse SvelteMap of cells, selection, recalculation pass

$lib/server/ai/tools/
  cell-updates.ts                    # {cell, value}[] → map; canonical addresses, refused ones named

$lib/components/explorer/
  ExplorerPanel.svelte               # Orchestrator: fetch, adapt, dispatch
  ExplorerTree.svelte                # Thin root iterator + keyboard shortcuts
  TreeNode.svelte                    # Recursive node: context menu, rename, delete, DnD
  explorer-state.svelte.ts           # Flat Map state with $state reactivity
  context-menu-items.ts              # Capability-driven menu builder
  node.ts                            # ExplorerNode interface, NodeCapability, NodeSource
  types.ts                           # FileListItem, FolderListItem interfaces
  adapters/desk-files.ts             # FileListItem + FolderListItem → ExplorerNode
```
