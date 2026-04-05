# Desk Workspace

The desk (`/desk`) is a full-page immersive workspace built on DockLayout — a binary split tree with resizable panes, drag-and-drop tabs, and a panel registry. Content types register as panel types; the desk orchestrates them.

## Topics

| File | Main Topics |
|------|-------------|
| **[spreadsheet.md](./spreadsheet.md)** | Spreadsheet as file type, `desk.file` registry table, REST API (`/api/desk/files`), Explorer integration, auto-save, dual-mode panel |

## Desk Infrastructure

Shared desk infrastructure (DockLayout, panel registry, activity bar, layout presets) is documented in [blog.md](../blog.md) under "Editor: Desk Integration" — it was built alongside the blog as the first content type. Key sections:

- **DockLayout** — binary split tree, resizable, persistent, drag-and-drop tabs
- **Layout presets** — opinionated starting arrangements (writing, reviewing, dashboard)
- **Panel registry** — `desk-panels.ts` maps panel type strings to Svelte components

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

### Explorer Panel

The Explorer (`ExplorerPanel.svelte`) is the unified file browser for all desk content types. Tree structure:

```
blog/                    # Blog posts (draft/published/archived)
assets/
  images/                # Uploaded images (R2-backed)
data/                    # Desk folders + spreadsheet files
  [user folders]/        # Nested desk.folder hierarchy
```

The Explorer fetches from four sources in parallel: `/api/blog/posts`, `/api/blog/assets`, `/api/desk/files`, `/api/desk/folders`. Panel commands menu (File) offers: New Post, New Spreadsheet, Import Markdown, Upload Image, Refresh.

#### Architecture

Every API item (post, asset, folder, file) is normalized into a unified **ExplorerNode** before rendering. This replaces the old hardcoded per-type rendering.

**ExplorerNode** (`node.ts`) — unified tree item interface:

| Field | Description |
|-------|-------------|
| `id`, `parentId` | Flat tree addressing |
| `source` | `blog-post`, `blog-asset`, `desk-file`, `desk-folder` |
| `label`, `icon`, `isFolder` | Display |
| `capabilities` | `Set<NodeCapability>` — drives context menu |
| `aiContext`, `sortKey`, `badge`, `subtitle` | Optional metadata |

**Adapters** (`adapters/`) normalize raw API responses into `ExplorerNode[]`:

| Adapter | Input | Capabilities |
|---------|-------|--------------|
| `blog-posts.ts` | `PostListItem[]` | open, open-new-panel, rename, ai-context, export-markdown, delete |
| `blog-assets.ts` | `AssetListItem[]` | open, open-new-panel, rename, insert-into-document, copy-url, delete |
| `desk-files.ts` | `FileListItem[]` + `FolderListItem[]` | files: open, open-new-panel, rename, duplicate, move, ai-context, delete; folders: rename, move, delete, new-folder, new-spreadsheet |

Virtual root nodes (`blog/`, `assets/`, `images/`, `data/`) are created by the adapters.

**ExplorerState** (`explorer-state.svelte.ts`) — reactive flat `Map<string, ExplorerNode>` with `$state`:

- O(1) lookups: `getChildren(parentId)`, `getRoots()`
- Mutations: `toggleExpanded()`, `moveNode()` (optimistic + rollback), `startRename/cancelRename`, `startDelete/cancelDelete`, `updateAiContext()`
- Separate `aiPins` Map for pin state (works around `svelte:self` deep-reactivity limitation)

**Context menu** (`context-menu-items.ts`) — capability-driven builder. Items only appear if `node.capabilities` includes the matching key. Groups: Open → AI Context → Edit → Type-specific → Create → Destructive.

**TreeNode.svelte** — recursive component (`svelte:self`) rendering any `ExplorerNode`. Handles: expand/collapse, context menu, inline rename (input swap), inline delete confirmation strip, AI context pin icon (hover-reveal, persistent when pinned), drag-and-drop.

**ExplorerTree.svelte** — thin root iterator. Renders `<TreeNode>` for each `state.getRoots()` item. Handles F2 keyboard shortcut and upload state.

#### AI Context Pinning

- **Desk files**: persisted server-side via `PUT /api/desk/files/:id` with `{ aiContext: boolean }`
- **Blog posts**: client-side only (pin state in ExplorerState, no DB column)
- Pin icon is hover-reveal; stays visible (primary color) when pinned
- Context menu: "Pin to AI Context" / "Unpin from AI Context"

### File Structure

```
$lib/components/composites/dock/
  desk-bus.svelte.ts                # DeskBus with DeskEvents interface
  layout-presets.ts                 # Writing, reviewing, dashboard presets

$lib/components/explorer/
  ExplorerPanel.svelte              # Orchestrator: fetch, adapt, dispatch
  ExplorerTree.svelte               # Thin root iterator + keyboard shortcuts
  ExplorerPreview.svelte            # Asset preview sidebar
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
