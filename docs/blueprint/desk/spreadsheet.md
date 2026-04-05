# Spreadsheet as File Type

Spreadsheets are managed through a unified `desk.file` registry table — the Explorer queries one table for all file listings. Type-specific data (cells, column metadata) lives in the `desk.spreadsheet` detail table joined by `file_id`.

## Desk File Registry

Single Table Inheritance (STI) pattern: `desk.file` is the base, `desk.spreadsheet` is the detail.

```sql
-- desk.file — unified registry
CREATE TABLE desk.file (
  id          TEXT PRIMARY KEY,         -- fil_{12 hex}
  user_id     TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  type        desk.file_type NOT NULL,  -- enum: 'spreadsheet' (extensible)
  name        TEXT NOT NULL DEFAULT 'Untitled',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- desk.spreadsheet — adds file_id FK alongside existing columns
ALTER TABLE desk.spreadsheet ADD COLUMN file_id TEXT REFERENCES desk.file(id) ON DELETE CASCADE;
```

Indexes: `(user_id, type)` for filtered listing, `(user_id, updated_at)` for recent-first sorting.

### Why STI, not a polymorphic join

Each file type has different detail columns (spreadsheets have `cells` JSONB; future diagrams might have `svg` TEXT). A single `desk.file` table with a `type` enum keeps Explorer queries simple (`SELECT * FROM desk.file WHERE user_id = ? ORDER BY updated_at DESC`) while detail tables hold type-specific data. Adding a new file type = new enum value + new detail table + new API branch.

## REST API

All endpoints require authentication (`requireApiUser`). File IDs use the `fil_` prefix.

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

### `PUT /api/desk/files/:id`

Update file name and/or type-specific data. Accepts any combination:

```json
{ "name": "Renamed", "cells": { "A1": { "v": "hello" } }, "columnMeta": null }
```

- Name-only update: calls `renameFile()`
- Cell data update: calls `updateSpreadsheetByFileId()` (updates `desk.spreadsheet` + touches `desk.file.updated_at`)

### `DELETE /api/desk/files/:id`

Deletes the file row. `ON DELETE CASCADE` on `spreadsheet.file_id` handles cleanup.

## SpreadsheetPanel: Dual-Mode

`SpreadsheetPanel.svelte` operates in two modes based on `panelId`:

| Mode | panelId pattern | Persistence | Source |
|------|----------------|-------------|--------|
| **File** | `spreadsheet-fil_xxx` | `desk.file` API | Explorer "New Spreadsheet" / "Open" |
| **Legacy** | anything else | localStorage + `/api/desk/spreadsheets/` | Activity bar toggle |

File mode extracts `fileId` from the panelId (`panelId.replace('spreadsheet-', '')`) and loads/saves via `/api/desk/files/:id`. Legacy mode uses localStorage to track a `spreadsheetId` and hits the old `/api/desk/spreadsheets/` endpoints.

### Auto-save

A `$effect` watches `sheet.dirty` (a counter incremented on every cell change). After 1.5s of no changes, it PUTs the full cell state to the server. Save indicator shows: Saving... -> Saved -> (idle after 2s).

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
  file.ts                            # desk.file table + file_type enum
  folder.ts                          # desk.folder table
  spreadsheet.ts                     # desk.spreadsheet (added fileId FK)
  index.ts                           # Re-exports all desk schema objects

$lib/server/db/desk/
  queries.ts                         # listFiles, getFile, getSpreadsheetByFileId, listFolders, getFolder, countFolderContents
  mutations.ts                       # createSpreadsheetFile, renameFile, deleteFile, updateSpreadsheetByFileId, folder mutations, moveFile, duplicateSpreadsheetFile, toggleFileAiContext

src/routes/(shell)/api/desk/files/
  +server.ts                         # GET (list) + POST (create)
  [id]/+server.ts                    # GET + PUT + DELETE

src/routes/(shell)/api/desk/folders/
  +server.ts                         # GET (list) + POST (create)
  [id]/+server.ts                    # GET + PUT + DELETE

$lib/components/spreadsheet/
  SpreadsheetPanel.svelte            # Dual-mode panel (file vs legacy)

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
