---
name: Spreadsheet Integration into Explorer — UX Specification
description: Full UX spec for adding spreadsheets as a first-class file type in the Explorer panel — tree position, file row anatomy, click/open model, multi-sheet tabs, context menus, creation flow, preview panel, drag-and-drop, and DeskBus additions. Supersedes any earlier spreadsheet-in-explorer notes.
type: project
---

# Spreadsheet Integration into Explorer — UX Specification

Produced 2026-04-03. Refined 2026-04-03 (Round 2 cross-pollination from ARCHY, DATY, SVEY, SCOUT, RESY). Extends explorer-final-spec.md (the binding contract for blog/assets Explorer UX) to add spreadsheet file type support.

**How to apply:** Reference alongside explorer-final-spec.md. Where this spec conflicts with the earlier one, this spec wins on spreadsheet-specific decisions. Everything else inherits from the earlier spec.

---

## Round 2 Decisions (Cross-Pollination)

### Folder hierarchy
Keep the three permanent sections (`blog/`, `assets/`, `data/`) as fixed structural anchors — users orient by type, not recency. User-created sub-folders are allowed only inside `data/`, not at the section level. Add "New folder" to the `data/` context menu when a user accumulates more than ~12 spreadsheets (a growth signal). Blog and assets remain flat until a parallel signal. DATY's nested folder model (parentId + materialized path) is available but only surfaces when user complexity demands it.

### Unified listing
Type grouping is the default and stays. A future "Recent" strip (last 3 modified files across all types) can sit above the three sections as a quick-access layer — this satisfies recency without collapsing the type hierarchy. File for Phase 2.

### Spreadsheets as documents vs. views
Spreadsheets appear as documents in the Explorer (file with name, dates, icon). The "views over data" architecture (AppFlowy/Notion) is an internal concern; the user sees a file that opens in a panel. Reserve the multi-view abstraction for when the spreadsheet gains named views (pivot, chart, filter). Until then, document presentation is accurate and consistent.

### Rename flow — click-away behavior
Clicking away (or pressing Escape) without typing commits "Untitled spreadsheet" as the name. This is valid — not an error state. If a user ends up with multiple "Untitled spreadsheet" files, that is their choice and they can rename anytime. Naming conflicts are silently resolved server-side by appending ` (2)`, ` (3)`, etc. An `aria-live="polite"` announcement fires if the name was changed ("Renamed to budget-2026 (2)"). No blocking inline error for a name conflict.

### Delete confirmation — consistent pattern, type-specific copy
The inline confirmation strip is universal across ALL file types. The interaction never changes; only the message text reflects the stakes:
- Post: "Delete this draft permanently? [Delete] [Cancel]"
- Asset: "Delete this image? It may still be used in posts. [Delete] [Cancel]"
- Spreadsheet (closed): "Delete this spreadsheet permanently? [Delete] [Cancel]"
- Spreadsheet (open in panel): "Delete this spreadsheet? The open panel will close. [Delete] [Cancel]"

---

---

## 1. Fundamental Architecture Decision: Multi-Sheet vs One-Per-Panel

The current SpreadsheetPanel loads one spreadsheet per panel (panelId-bound, ID in localStorage). Users can open multiple panels for multiple spreadsheets, but there is no browsing interface.

This spec does NOT replace the existing per-panel persistence model. Instead it adds a layer above it: the Explorer shows all of a user's spreadsheets as files. When a user opens a spreadsheet from Explorer, it opens in a SpreadsheetPanel. The panel-bound ID transitions from a localStorage implicit lookup to an explicit spreadsheet ID passed in via props.

This requires a small change to SpreadsheetPanel: accept an optional `spreadsheetId` prop. If provided, load that spreadsheet. If not provided, fall back to the current creation flow. This is the minimum change to integrate Explorer without rewriting persistence.

---

## 2. Tree Layout — Spreadsheets Section

### Virtual filesystem structure (updated)

```
blog/                            ← always expanded, never collapsible
  welcome-to-velociraptor.md     ● published
  my-first-post.md               ● draft

assets/                          ← always expanded, never collapsible
  images/
    hero-photo.jpg

data/                            ← always expanded, never collapsible (NEW)
  budget-2026.sheet              ← spreadsheet files
  q1-analysis.sheet
```

The `data/` root folder is the third permanent section. Like `blog/` and `assets/`, it is locked open at the root level — no collapse toggle. Sub-folders inside `data/` are collapsible (future, not in MVP).

### Folder identity — data/ section

| Folder | Icon | Icon color | Label style |
|--------|------|------------|-------------|
| `data/` | `i-lucide-database` | `--color-secondary` | bold, 11px uppercase |

### Spreadsheet file row anatomy

```
[indent][i-lucide-sheet icon][name][secondary-meta]
```

- Indent: depth × 16px left-padding
- Icon: `i-lucide-sheet` at 14px, color `--color-success` (matches the green convention for data/tables established in explorer-final-spec.md CSV row note)
- Label: spreadsheet name without `.sheet` extension, 13px, `--color-fg`
- Below label (second line, always visible): last-modified relative time + cell count ("2d ago · 47 cells"), 11px, `--color-muted`, truncated with ellipsis

Two-line display matches blog post rows. The name alone ("budget-2026") lacks any sense of activity or size — the second line gives users the signal they need to orient.

**Row height:** 40px minimum (same as blog post rows, two-line).

**What to show for cell count:** Only populated cell count from the JSONB sparse map (count of keys). Show "empty" if zero cells. Keep computation server-side — never compute this client-side on every render.

---

## 3. Selection and Opening Flow

### Single-click behavior

Single-click on a spreadsheet row: select the row (visual highlight) AND open the spreadsheet in a SpreadsheetPanel. This matches blog post single-click behavior.

**Rationale for single-click open (not double-click):** Spreadsheets are large work surfaces. The user's intent in clicking a spreadsheet file is almost always "open this and work in it." Double-click would mean the first click is always a meaningless intermediate state. This is consistent with how the blog post open works in the existing Explorer spec, and consistent with VS Code's behavior for most file types.

**What "open" means mechanically:**

1. Check if a SpreadsheetPanel is already open with this spreadsheet's ID (search all panels in DockState)
2. If yes: focus that panel. Do not open a second one.
3. If no: publish `spreadsheet:open` DeskBus event with the spreadsheet ID. The desk layout system handles panel creation.

If no SpreadsheetPanel exists at all (user hasn't opened one yet), the desk needs to create one. This matches the pattern for opening a blog post that triggers EditorPanel creation.

### Preview pane on spreadsheet selection

A spreadsheet has no thumbnail. Do not attempt one. Instead, when a spreadsheet row is selected in Explorer, show a lightweight data preview inside the FilesPanel (in the same FilePreview slot used for images), using a different layout:

```
[drag-handle: 4px resizable bar]
[header: spreadsheet name | last modified | × close button]
[data preview: table of first 4 rows × first 4 cols, read-only, 11px font]
[footer: row count · col count · cell count | [Open] button — right-aligned]
```

The data preview is purely informational. It is not interactive — no clicking cells, no editing. Its purpose is to help users confirm they have the right spreadsheet before opening it, and to show something meaningful in the space where image thumbnails appear for images.

**Data preview fetching:** The preview fetches from `GET /api/desk/spreadsheets/{id}?preview=1`, which returns only the first 4 rows × 4 cols. This endpoint variant avoids sending the full JSONB blob for a preview.

**If the spreadsheet is empty (no cells):** Show the data preview slot with just the header and an empty state message: "No data yet" in 11px `--color-muted`. Still show the [Open] button.

**If FilePreview is too narrow (panel width < 160px):** Collapse the preview, same as for images.

### Focus behavior after opening

When a spreadsheet opens, focus passes to the SpreadsheetPanel grid. The Explorer panel remains visible (it does not close). This matches the blog post open behavior where the Editor opens but the Explorer stays.

---

## 4. Context Menu Actions

### Hover-reveal (right side of row)

- `i-lucide-more-horizontal` — opens context menu (single icon, same as blog post rows)

Do not show a second inline action for spreadsheets on hover. Images have "copy markdown" as the second icon because that action is extremely frequent. Spreadsheets have no equivalent instant action that warrants a permanent hover target.

### Context menu items (in order)

1. **Open** — same as single-click (opens in panel, focuses if already open)
2. **Rename** — triggers inline rename (same behavior as blog post rename)
3. **Duplicate** — creates a copy with name appended " (copy)"; new sheet pre-populated with original cells
4. **Export as CSV** — downloads client-side CSV from the sparse cell map; no round-trip needed
5. **Export as JSON** — downloads the raw JSONB cell map for developer use
6. **Delete** ← requires inline confirmation strip, same pattern as blog post delete

### Why these items, not others

- **No "Export as Excel (.xlsx)"**: Binary format requires a library. Out of scope for MVP. Add when there is user demand.
- **No "Import CSV"**: Import into an existing sheet raises questions about merging vs overwriting. Defer to a dedicated import flow.
- **No "Share"**: No sharing model exists yet. Never show unimplemented actions.
- **Duplicate is safe to include**: Duplicating a spreadsheet is low-risk and high-value for users who want to reuse a template structure.
- **Delete is present but gated**: The inline confirmation strip (not a modal) is the correct pattern — matches blog posts.

### Delete confirmation (inline strip)

Identical pattern to blog post delete:
Row expands in-place to show: "Delete this spreadsheet permanently? [Delete] [Cancel]"
[Delete] = Button variant="destructive", [Cancel] = Button variant="ghost"
Focus moves to [Cancel] on reveal. On confirm, row disappears with 100ms opacity transition.

---

## 5. New Spreadsheet Creation

### Entry points (two, not one)

**Primary — FilesToolbar:** Add a third icon button to the right zone of FilesToolbar: `i-lucide-table-2` with `title="New spreadsheet"`, `aria-label="New spreadsheet"`. It sits after the existing `i-lucide-file-plus` (new post) and `i-lucide-upload` (upload image) buttons.

**Secondary — context menu on data/ folder row:** Right-clicking the `data/` root folder row shows a context menu with one item: "New spreadsheet". This mirrors VS Code's right-click-on-folder to create a file in that folder.

Do NOT put "New spreadsheet" in a top-level toolbar that already has "New post" — the user would need to know which button creates which type. The icons plus tooltips distinguish them without a text label. The `i-lucide-table-2` icon is visually distinct from `i-lucide-file-plus`.

### Naming flow — auto-name, not a prompt

**Do not prompt for a name before creation.** A name prompt before creation adds a step to the happy path and forces a decision before the user has any context.

Instead:
1. Create the spreadsheet immediately in the DB with the name "Untitled spreadsheet"
2. Add an optimistic entry to the `data/` section in the tree, with the name already in inline-rename mode (the Input component is active, pre-selected with "Untitled spreadsheet" text)
3. The user types their name and presses Enter (or Escape to keep "Untitled spreadsheet")
4. On Enter: PATCH the name, commit rename, open the spreadsheet in a panel

If the API call to create fails: show inline error on the new row "Could not create — [Retry]". Do not show a toast for creation failure — keep the error co-located with the row where the action was initiated.

**Rationale for auto-name-then-rename:** This is the VS Code and macOS Finder pattern. The user can always rename later. The immediate creation means the spreadsheet exists in the DB before the user types the name, which avoids a second round-trip and means no data is lost if the user navigates away mid-naming.

---

## 6. Multi-Spreadsheet Management

### Can users have multiple spreadsheets open?

Yes. Multiple SpreadsheetPanels can be open simultaneously in the dock, each showing a different spreadsheet. The desk layout system already supports multiple panels of the same type (existing `panelId` uniqueness contract).

There are no forced constraints. Users who want three spreadsheets side-by-side can have them.

### How does the Explorer show open spreadsheets?

A row in the `data/` section gets a visual open-indicator when its spreadsheet is currently open in a panel. Reuse the same pattern used for blog posts (though blog posts use a status dot for publish state — spreadsheets don't have publish state, so use a different visual).

**Open indicator for spreadsheets:** A small `▸` glyph (right-pointing triangle, not a status dot) appears at the far left of the row, in `--color-primary`, when the spreadsheet is open. This is a recognized VS Code pattern: a right-facing arrow on the file row in Explorer shows "this is open in an editor."

When the panel is closed, the glyph disappears. No animation — instant.

### Switching between open spreadsheets

The user can click any row in the `data/` section:
- If the spreadsheet is already open: the existing SpreadsheetPanel receives focus
- If not: a new SpreadsheetPanel opens

There is no tab bar inside the Explorer for spreadsheets. The dock's own tab bar (DockTabBar) handles multi-panel switching at the panel level. The Explorer is a file browser, not a tab manager.

### Unsaved changes when switching

The existing SpreadsheetPanel already auto-saves with a 1.5s debounce. When a user opens a different spreadsheet:
- The debounce for the previous spreadsheet fires immediately (flush pending saves before losing focus)
- Save status shows "Saving..." briefly, then "Saved"
- The user is never blocked from opening a second spreadsheet because the first hasn't saved

**Never show a "Do you want to save?" modal.** Auto-save handles this. A modal here would be lying to the user — there's nothing to decide. If auto-save fails, the save-error indicator on the panel already communicates that.

The one exception: if the user initiates DELETE on a spreadsheet that is currently open in a panel, the inline confirmation strip text changes to: "Delete this spreadsheet? The open panel will close. [Delete] [Cancel]"

---

## 7. Drag-and-Drop Considerations

### Dragging spreadsheets out of Explorer

Spreadsheet rows are NOT draggable by default. There is no obvious drop target for a spreadsheet file in this workspace. (You can't drag a spreadsheet into a CodeMirror editor meaningfully.) Dragging spreadsheets produces confusion, not utility.

If a future use case emerges (e.g., drag spreadsheet into Dashboard panel to create a chart), add draggability then with a defined drop contract. Do not add drag-without-a-destination.

### Dragging data INTO a spreadsheet

This is not an Explorer-level feature. If a user wants to get data from one panel into a spreadsheet, the AI Chat panel (via the AI context model from ai-context-ux.md) is the right mechanism — select data in one panel, ask AI to put it in the spreadsheet. That is already specced.

The one exception worth noting for future work: CSV drag-and-drop onto the `data/` folder row to import. This would reuse the UploadDropzone pattern with a CSV parser. Not in MVP.

### Drag-and-drop upload for the data/ section

In MVP: do NOT add drag-to-upload for `.csv` or `.sheet` files onto the Explorer. The existing UploadDropzone is image-only. Extending to CSV/sheet imports opens questions about format validation and merge behavior. Defer.

**Drag-to-folder should silently do nothing** (not show a drop target indicator) for the `data/` folder in MVP. Add a visual rejection cue ("Not supported yet") only if user testing shows the absence of a drop target causes confusion.

---

## 8. Empty State for data/ Section

### data/ section empty (no spreadsheets yet)

Inside the `data/` section, at depth-1 indentation:
- Icon: `i-lucide-table-2` at 20px, `--color-muted`, opacity 0.5
- Text: "No spreadsheets yet" + inline link "Create your first spreadsheet"

Clicking the inline link triggers the same creation flow as the FilesToolbar button.

### All three sections empty (brand new workspace)

The existing whole-panel empty state (explorer-final-spec.md §7, Scenario 1) gains a third button in the row:
- "New post" — Button variant="outline"
- "Upload image" — Button variant="ghost"
- "New spreadsheet" — Button variant="ghost"

Three buttons is the limit. If more panel types get file representation in Explorer, consolidate into a split-button or dropdown before adding a fourth button here.

---

## 9. Panel Menu Addition (MenuBar "File" menu)

Per the desk-menu-final-spec.md, the "File" menu in the global MenuBar has items guarded by `{#if}` based on focused panel. Add:

**File > New Spreadsheet** — `[always]` — keyboard: `Ctrl+Shift+N` (differentiated from `Ctrl+N` for new post)

This always appears in File, regardless of focused panel, because creating a spreadsheet is a top-level creation action that should be accessible from anywhere.

---

## 10. DeskBus Additions

Add to the `DeskEvents` interface in `desk-bus.svelte.ts`:

```ts
// Published by Explorer when user opens a spreadsheet
// SpreadsheetPanel and DockLayout subscribe to create/focus the panel
'spreadsheet:open': {
  spreadsheetId: string;
  name: string;
};

// Published by SpreadsheetPanel when it closes (for Explorer to clear open-indicator)
'spreadsheet:closed': {
  spreadsheetId: string;
  panelId: string;
};

// Published by Explorer when a spreadsheet is renamed
// SpreadsheetPanel subscribes to update its displayed name
'spreadsheet:renamed': {
  spreadsheetId: string;
  name: string;
};

// Published by Explorer after a spreadsheet is deleted
// SpreadsheetPanel subscribes to close itself if it has this spreadsheetId
'spreadsheet:deleted': {
  spreadsheetId: string;
};
```

---

## 11. SpreadsheetPanel Props Change

To support Explorer-driven opening, SpreadsheetPanel needs:

```ts
interface Props {
  panelId: string;
  spreadsheetId?: string;  // NEW: if provided, load this specific spreadsheet
}
```

When `spreadsheetId` is provided:
- Skip the localStorage lookup for a stored ID
- Directly fetch `GET /api/desk/spreadsheets/{spreadsheetId}`
- The localStorage key `desk-spreadsheet-{panelId}` still stores the ID after load (for panel persistence across sessions)

When `spreadsheetId` is not provided:
- Current behavior unchanged (check localStorage, create if not found)

The panel also needs to subscribe to `spreadsheet:renamed` and `spreadsheet:deleted` DeskBus events to keep its displayed name in sync and self-close on deletion.

---

## 12. API Additions Required

### List spreadsheets for Explorer

`GET /api/desk/spreadsheets` — returns all spreadsheets for the authenticated user, sorted by `updatedAt` DESC:

```json
{
  "spreadsheets": [
    {
      "id": "abc123",
      "name": "budget-2026",
      "cellCount": 47,
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

Cell count is computed server-side as `jsonb_object_keys(cells)` count (Postgres). Never computed client-side.

### Preview endpoint

`GET /api/desk/spreadsheets/{id}?preview=1` — returns the same shape as the full endpoint but with `cells` truncated to only the first 4 rows × 4 columns (keys matching `A1` through `D4`).

### Duplicate

`POST /api/desk/spreadsheets/{id}/duplicate` — server creates a copy with name "{original} (copy)", returns the new spreadsheet's ID and name. Client adds the optimistic row immediately with the new name in rename mode, updates the ID when the response arrives.

---

## 13. Accessibility Checklist (spreadsheet additions)

- [ ] `data/` folder row: `role="treeitem"`, `aria-level="1"`, `aria-expanded` (locked true, but still present)
- [ ] Spreadsheet rows: `role="treeitem"`, `aria-level="2"`, `aria-selected` on open/focused row
- [ ] Open indicator glyph `▸`: visually hidden text `<span class="sr-only">open in panel</span>`
- [ ] Context menu "Export as CSV" action: after download completes, `aria-live="polite"` announces "Exported budget-2026.csv"
- [ ] FilesToolbar "New spreadsheet" button: `aria-label="New spreadsheet"`, `title="New spreadsheet"`
- [ ] Inline rename on new spreadsheet: auto-focus, pre-selected text, Escape cancels (same pattern as existing inline rename)
- [ ] Data preview table in FilePreview: `role="table"`, `aria-label="{name} preview"`, header cells `scope="col"`, `aria-readonly="true"` on all cells
- [ ] SpreadsheetPanel: subscribes to `spreadsheet:deleted` event and calls a panel-close action (do not leave orphan panels after deletion)
- [ ] "Open" button in FilePreview footer: `aria-label="Open {name} in spreadsheet panel"`
