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

AI-driven effects (`dispatch-desk-effect.ts`) receive an `EffectActions` facade (`focusPanel`, `addPanel`, `updatePanel`, `publish`) and return `boolean` — applied or failed. Failures are surfaced in the I/O Log, never swallowed. A desk effect that surfaces a panel leaves it visible without further interaction: `desk:open_panel` focuses an existing instance or adds one, `desk:scroll_to` pre-focuses before publishing, and overlay auto-close (via `focusSeq`) is part of the effect.

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
| Panels region of the pill (icon + count) | `DockMobileControls` | left drawer, `min(85vw, 320px)`: panel types + open instances (`DockMobilePanelsDrawer`) |
| App menu | shell `SidebarFab` | untouched — the pill sits left of it via the `--fab-*` slot tokens in `app.css` |

Desktop kebab and mobile commands sheet render the same `composePanelMenus()` array (registered menus → dock-supplied Panel floor menu → View menu) — a difference between the two is a bug. The mobile View menu strips structural commands (Split Right/Down). The pill hides while the soft keyboard is open (`data-keyboard='open'` on `<html>`, published by `$lib/state/visual-viewport.svelte.ts`).

### Cross-Panel Communication (DeskBus)

Typed pub/sub for panels to communicate without direct coupling. Factory + Svelte context pattern in `$lib/components/composites/dock/desk-bus.svelte.ts`.

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
$lib/components/composites/dock/
  DockLayout.svelte                 # Root: tree render, focus followers, mobile branch (mobileChrome prop)
  DockNode.svelte / DockLeaf.svelte # Recursive split render / leaf with tab bar + kebab
  DockTabBar.svelte, DockLeafMenu.svelte, DockResizeHandle.svelte, DockDropOverlay.svelte
  DockActivityBar.svelte            # Desktop panel-type rail
  DockMobileView.svelte             # Keep-alive panel stack + empty-state recovery grid
  DockMobileTabs.svelte             # Mobile: top tab strip of open instances
  DockMobileControls.svelte         # Mobile: bottom-right pill (commands | panels+count)
  DockMobilePanelsDrawer.svelte     # Mobile: left drawer — panel types + open instances
  DockMobileCommandsSheet.svelte    # Mobile: bottom sheet rendering composePanelMenus()
  DockMobileBar.svelte              # Legacy bottom bar (mobileChrome="bar", workbench showcase)
  dock.state.svelte.ts              # Split-tree state, total focus derivation, focusSeq
  dock.operations.ts                # Pure tree math (split/remove/move) — purity-tested
  dock.persistence.ts               # localStorage lane for DockLayoutState
  dock.types.ts                     # DockNode/DockLayoutState types
  panel-actions.ts                  # focusPanel/openOrCycle/closeCurrent — the single focus writer
  panel-menus.svelte.ts             # Context-scoped per-instance menu registry
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

$lib/config/desk-panels.ts         # Panel type -> component registry
```
