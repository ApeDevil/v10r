# Desk Workspace

The desk (`/desk`) is a full-page immersive workspace built on DockLayout — a binary split tree with resizable panes, drag-and-drop tabs, and a panel registry. Content types register as panel types; the desk orchestrates them.

## Topics

| File | Main Topics |
|------|-------------|
| **[spreadsheet.md](./spreadsheet.md)** | Spreadsheet as file type, `desk.file` registry table, REST API (`/api/desk/files`), Explorer integration, auto-save, dual-mode panel |

## Desk Infrastructure

The origin design for the shared infrastructure (DockLayout, panel registry, activity bar, layout presets) lives in [blog.md](../blog.md) under "Editor: Desk Integration" — the desk was built alongside the blog as the first content type. That section is a design record; the current authoritative structure is this file. Key concepts:

- **DockLayout** — binary split tree, resizable, persistent, drag-and-drop tabs
- **Layout presets** — opinionated starting arrangements (writing, reviewing, dashboard)
- **Panel registry** — `desk-panels.ts` maps panel type strings to Svelte components

### Focus Architecture

Exactly one focused panel per dock instance, on every surface. Menus, Vely's page context, and the mobile visible panel all derive from it — none of them holds its own copy.

- **Total derivation** (`dock.state.svelte.ts`): the stored `focusedLeafId` resolves to a leaf if it still exists and holds tabs; otherwise focus falls back to the first non-empty leaf. `focusedPanelId` is always the focused leaf's `activeTab`. There is no "nothing focused" state while any panel is open.
- **Single writer**: all activation paths go through `focusPanel(dock, panelId)` (`panel-actions.ts`) — tab clicks, mobile tab strip, drawer rows, AI effects, `?open=`/`?panel=` deep links. It activates the tab *and* focuses the leaf, idempotently.
- **`focusSeq`** — a monotonic counter bumped on every `setFocusedLeaf` call, repeats included. Overlays (panels drawer, commands sheet) auto-close by watching it, so "AI focused the already-visible panel" still dismisses the drawer.
- **Persistence**: `focusedLeafId` is an optional field of `DockLayoutState`, saved to localStorage and the workspace DB lane. **Invariant: every `DockLayoutState` field must exist in `DockLayoutStateSchema` (`$lib/server/desk/schemas.ts`) in the same commit** — valibot strips unknown keys silently, and `schemas.parity.test.ts` gates this.
- **Registries are followers**: the panel-menus registry (`panel-menus.svelte.ts`, context-scoped per DockLayout — never module-level) and Vely's desk context both receive focus via follower effects in `DockLayout`; panels register under their **instance id** (`panelId` prop), not their type.

### Desk Effect Contract

AI-driven effects (`dispatch-desk-effect.ts`) receive an `EffectActions` facade (`focusPanel`, `addPanel`, `updatePanel`, `publish`, `findFilePanel`) and return `boolean` — applied or failed. Failures are surfaced in the I/O Log, never swallowed. A desk effect that surfaces a panel leaves it visible without further interaction: `desk:open_panel` focuses the OPEN instance showing the file (found through `file-panel.ts` — `filePanelId` / `fileIdOfPanel` / `findFilePanel`, the one reader of the `<type>-<fileId>[-<suffix>]` id shape the Explorer mints) or adds one, `desk:scroll_to` pre-focuses before publishing, and overlay auto-close (via `focusSeq`) is part of the effect.

A published `ai:refresh_file` is a request, not a result. The panel showing the file reloads and answers `ai:file_refreshed { fileId, version, ok }` (the spreadsheet after `autosave.refresh()`, the markdown viewer after its load); the bot's session waits for that answer and writes what the panel now shows to the I/O Log — or that no panel answered.

### Desk Bot session

The bot panel (`panels/bot/ChatPanel.svelte`) is the view over a `DeskBotSession` (`panels/bot/desk-bot-session.svelte.ts`, registered in `$lib/state/desk-bot-session-registry.ts`) keyed by user, workspace and panel — the same outlive-the-panel pattern as the spreadsheet session, so a layout move loses neither the live stream nor the record of which tool effects were already dispatched. Approval is a **proposal run** on the session (`approving` → the server's status, `unknown` until `GET /api/ai/proposals/[id]` settles a lost response); the server's execution receipt message joins the thread, and no model turn follows an approval. `SessionMonitor` tears every session down on logout.

### Markdown viewer

`panels/markdown/MarkdownPanel.svelte` is the read-only panel for a desk markdown file: it loads `GET /api/desk/files/[id]` (which answers `{ file, markdown: { content, version } }` for a markdown file), renders with `renderMarkdown`, registers the document as AI context, reloads on `ai:refresh_file` and answers `ai:file_refreshed`. The Explorer opens a desk file in the panel for its TYPE (`openFilePanel`) — before this panel existed every desk file opened as a spreadsheet and a bot-created document had nowhere to be seen. Editing desk markdown stays the bot's job (approved proposals); an editor here is a separate, later decision.

### Mobile Chrome

The persisted `DockLayoutState` is always the desktop tree; mobile is a projection over it — mobile paths only ever `focusPanel` / `ensurePanelType` / `closePanel`, never split or resize. `DockLayout`'s `mobileChrome` prop selects the renderer:

| `mobileChrome` | Renders | Used by |
|----------------|---------|---------|
| `'floating'` (default) | Tab strip + controls pill + drawers | `/desk` |
| `'bar'` | Legacy bottom type-switcher bar | Workbench showcase (dock inside a Card) |

Floating chrome is **viewport chrome**: the controls pill (like the shell FAB and the drawers) is `position: fixed`, so every occupant of the `--fab-*` slot ladder measures from the same origin and stays aligned regardless of mobile browser-chrome state. `'bar'` is the contained variant for docks embedded in a page. One control per surface:

| Control | Component | Surface |
|---------|-----------|---------|
| Open-panel tab strip (top, 44px, scrollable) | `DockMobileTabs` | tap → `focusPanel` |
| Commands region of the pill (`⋮`) | `DockMobileControls` | bottom sheet with the focused panel's composed menus (`DockMobileCommandsSheet`) |
| Panels region of the pill (icon + count) | `DockMobileControls` | left drawer, `min(85vw, 320px)`: panel types + open instances, then workspaces (switch, create) — the mobile projection of the desktop activity bar (`DockMobilePanelsDrawer`) |
| App menu | shell `SidebarFab` | untouched — the pill sits left of it via the `--fab-*` slot tokens in `app.css` |

Desktop kebab, mobile commands sheet and the keyboard matcher (`DeskShortcuts`) consume the same `composePanelMenus()` array (registered menus → dock-supplied Panel floor menu → View menu, separators normalised once there) — a difference between the three is a bug. View's toggle rows are derived from the activity-bar items that declare a `shortcut` (`DESK_ACTIVITY_BAR_ITEMS` in `$lib/desk/panels.ts`; the bar's tooltip prints the same chord), so a toggle chord has one declaration. The matcher has no "not while editing" guard: the editor's text is a textarea and that is where Ctrl+S, Ctrl+, and Ctrl+Shift+X matter — every desk chord is a modifier chord and the array is composed per focused panel, so a plain key can never be taken from a field; the constraint this leaves is never to declare a chord the browser owns in a text field. The tab's right-click menu is leaf-scoped (Close Others / Close All) and prints the shared chords it mirrors (`CLOSE_PANEL_SHORTCUT`, `PREFERENCES_SHORTCUT`); its Split and View's Split both mint through `duplicatePanel()`, which keeps a file panel's file. Every command door — kebab, sheet, chord, palette, context menus, the activity bar and its drawer — records `command_invoked` (`trackCommand`), which lands in the authenticated analytics lane and is read on `/admin/analytics/human`. The floor menu is the panel's own home: switch instance, `Close Panel` (Ctrl+W), `About <panel>`; the host lends only the About dialog, whose shortcut table is derived from the same array (`shortcutTableMarkdown`) — `$lib/desk/help.ts` holds prose only. The View menu is dock-level and desktop-only: the mobile sheet and, below the breakpoint, the keyboard matcher pass `viewMenu: null`, because the panels drawer already projects every View command on touch (show-or-open per type, Preferences) and the structural toggle/split verbs must never reach a touch surface — not from a hardware keyboard either. Desk Preferences hides its activity-bar row on that projection for the same reason. Every close route on both projections asks the dock's unsaved-close guard first (`dock.requestClose` / `requestClosePanels`, one confirm per batch); `closePanel` is the raw operation. While the desk is mounted its chords are also listed, display-only, under "Desk" in the shell's `shift+/` dialog. The pill hides while the soft keyboard is open (`data-keyboard='open'` on `<html>`, published by `$lib/state/visual-viewport.svelte.ts`).

### Cross-Panel Communication (DeskBus)

Typed pub/sub for panels to communicate without direct coupling. Factory + Svelte context pattern in `$lib/components/desk/desk-bus.svelte.ts`.

Current channels:

| Channel | Payload | Publisher |
|---------|---------|-----------|
| `editor:content` | `{ content, type, metadata }` | Editor (debounced on change) |
| `editor:document` | `{ documentId, type } \| null` | Editor (on document switch) |
| `editor:save` | `{ documentId, revisionId }` | Editor (after server save) |
| `files:select` | `{ type: 'post' \| 'asset' \| 'spreadsheet', id, data } \| null` | Explorer (on item select/deselect) |
| `spreadsheet:open` | `{ fileId, name }` | Explorer (on spreadsheet open) |
| `files:insert-image` | `{ assetId, fileName, altText, downloadUrl, _nonce }` | Explorer (image insert into editor) |
| `ai:open_panel`, `ai:refresh_file`, `ai:highlight`, `ai:notify`, `ai:scroll_to` | AI-driven desk actions | AI tool calls (open/refresh/highlight/notify/scroll a panel) |

### Explorer Panel

The Explorer (`ExplorerPanel.svelte`) is the unified file browser for all desk content types. Tree structure:

```
blog/                    # Blog posts (draft/published/archived)
assets/
  images/                # Uploaded images (R2-backed)
data/                    # Desk folders + spreadsheet and markdown files
  [user folders]/        # Nested desk.folder hierarchy
```

The Explorer fetches from six sources in parallel: `/api/blog/posts`, `/api/blog/post-folders`, `/api/blog/assets`, `/api/blog/asset-folders`, `/api/desk/files`, `/api/desk/folders`. Panel commands menu (File) offers: New Post, New Spreadsheet, Import Markdown, Upload Image, Refresh.

#### Architecture

Every API item (post, asset, folder, file) is normalized into a unified **ExplorerNode** before rendering. This replaces the old hardcoded per-type rendering.

**ExplorerNode** (`node.ts`) — unified tree item interface:

| Field | Description |
|-------|-------------|
| `id`, `parentId` | Flat tree addressing |
| `source` | `desk-file`, `desk-folder`, `blog-post`, `blog-folder`, `blog-asset`, `asset-folder`, `virtual` |
| `label`, `icon`, `isFolder` | Display |
| `capabilities` | `Set<NodeCapability>` — drives context menu |
| `aiContext`, `sortKey`, `badge`, `subtitle` | Optional metadata |

**Adapters** (`adapters/`) normalize raw API responses into `ExplorerNode[]`:

| Adapter | Input | Capabilities |
|---------|-------|--------------|
| `blog-posts.ts` | `PostListItem[]` | open, open-new-panel, rename, move, ai-context, export-markdown, delete |
| `blog-assets.ts` | `AssetListItem[]` | open, open-new-panel, rename, insert-into-document, copy-url, delete |
| `desk-files.ts` | `FileListItem[]` + `FolderListItem[]` | spreadsheet files: open, open-new-panel, rename, duplicate, move, ai-context, delete; markdown files: same minus duplicate; folders: rename, move, delete, new-folder, new-spreadsheet |

Virtual root nodes (`blog/`, `assets/`, `images/`, `data/`) are created by the adapters.

**ExplorerState** (`explorer-state.svelte.ts`) — reactive flat `Map<string, ExplorerNode>` with `$state`:

- O(1) lookups: `getChildren(parentId)`, `getRoots()`
- Mutations: `toggleExpanded()`, `moveNode()` (optimistic + rollback), `startRename/cancelRename`, `startDelete/cancelDelete`, `updateAiContext()`
- Separate `aiPins` Map for pin state (works around `svelte:self` deep-reactivity limitation)

**Context menu** (`context-menu-items.ts`) — capability-driven builder. Items only appear if `node.capabilities` includes the matching key. Groups: Open → AI Context → Edit → Type-specific → Create → Destructive.

**TreeNode.svelte** — recursive component (`svelte:self`) rendering any `ExplorerNode`. Handles: expand/collapse, context menu, inline rename (input swap), inline delete confirmation strip, AI context pin icon (hover-reveal, persistent when pinned), drag-and-drop. On coarse pointers a permanent 44px kebab per row opens the same capability-driven menu (hover and right-click don't exist on touch).

**ExplorerTree.svelte** — thin root iterator. Renders `<TreeNode>` for each `state.getRoots()` item. Handles F2 keyboard shortcut and upload state.

#### AI Context Pinning

- **Desk files**: persisted server-side via `PUT /api/desk/files/:id` with `{ aiContext: boolean }`
- **Blog posts**: client-side only (pin state in ExplorerState, no DB column)
- Pin icon is hover-reveal; stays visible (primary color) when pinned
- Context menu: "Pin to AI Context" / "Unpin from AI Context"

### File Structure

```
$lib/components/desk/
  DockLayout.svelte                 # Root: tree render, focus followers, mobile branch (mobileChrome prop)
  DockNode.svelte / DockLeaf.svelte # Recursive split render / leaf with tab bar + kebab
  DockTabBar.svelte, DockLeafMenu.svelte, DockResizeHandle.svelte, DockDropOverlay.svelte
  DockActivityBar.svelte            # Desktop panel-type rail
  DockMobileView.svelte             # Keep-alive panel stack + empty-state recovery grid
  DockMobileTabs.svelte             # Mobile: top tab strip of open instances
  DockMobileControls.svelte         # Mobile: bottom-right pill (commands | panels+count)
  DockMobilePanelsDrawer.svelte     # Mobile: left drawer — panel types + open instances + workspaces
  DockMobileCommandsDrawer.svelte   # Mobile: bottom sheet rendering composePanelMenus()
  DockMobileBar.svelte              # Legacy bottom bar (mobileChrome="bar", dock showcase)
  dock.state.svelte.ts              # Split-tree state, total focus derivation, focusSeq
  dock.operations.ts                # Pure tree math (split/remove/move) — purity-tested
  dock.persistence.ts               # localStorage lane for DockLayoutState
  dock.types.ts                     # DockNode/DockLayoutState types
  panel-actions.ts                  # focusPanel/openOrCycle/togglePanelType — the single focus writer
  panel-menus.state.svelte.ts       # Context-scoped per-instance menu registry
  compose-menus.ts / view-menu.ts   # composePanelMenus() + buildViewMenu() shared desktop/mobile
  dock-mobile.state.svelte.ts       # Mobile surface discriminator ('panels'|'commands'|null)
  desk-bus.svelte.ts                # DeskBus with DeskEvents interface
  desk-context.svelte.ts            # Vely page-context bridge (+ .pure.ts testable half)
  dispatch-desk-effect.ts           # AI effect dispatcher over the EffectActions facade
  io-log.svelte.ts                  # I/O Log panel state (AI effect audit trail)
  workspace.state.svelte.ts         # Named workspaces (DB lane) + capture/switch
  desk-settings.svelte.ts           # Desk preferences (+ persistence/types)
  layout-presets.ts                 # Writing, reviewing, dashboard presets

$lib/state/visual-viewport.svelte.ts # Soft-keyboard watcher → --keyboard-inset + data-keyboard on <html>

$lib/server/desk/                  # File registry domain + DockLayoutState schemas (+ parity test)

$lib/components/explorer/
  ExplorerPanel.svelte              # Orchestrator: fetch, adapt, dispatch
  ExplorerTree.svelte               # Thin root iterator + keyboard shortcuts
  ExplorerPreview.svelte            # Asset preview: inline pane (desktop) / bottom sheet (mobile)
  TreeNode.svelte                   # Recursive node: context menu, rename, delete, DnD
  explorer-state.svelte.ts          # Flat Map state with $state reactivity
  context-menu-items.ts             # Capability-driven menu builder
  node.ts                           # ExplorerNode interface, NodeCapability, NodeSource
  types.ts                          # PostListItem, AssetListItem, FileListItem, FolderListItem, UploadingItem
  adapters/
    index.ts                        # Barrel export
    blog-posts.ts                   # PostListItem → ExplorerNode
    blog-assets.ts                  # AssetListItem → ExplorerNode
    desk-files.ts                   # FileListItem + FolderListItem → ExplorerNode

$lib/3d/desk-panels.ts         # Panel type -> component registry
```
