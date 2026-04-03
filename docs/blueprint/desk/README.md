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
data/                    # Spreadsheet files (desk.file-backed)
```

The Explorer fetches from three sources in parallel: `/api/blog/posts`, `/api/blog/assets`, `/api/desk/files?type=spreadsheet`. Panel commands menu (File) offers: New Post, New Spreadsheet, Import Markdown, Upload Image, Refresh.

### File Structure

```
$lib/components/composites/dock/
  desk-bus.svelte.ts                # DeskBus with DeskEvents interface
  layout-presets.ts                 # Writing, reviewing, dashboard presets

$lib/components/explorer/
  ExplorerPanel.svelte              # File browser: posts, assets, spreadsheets
  ExplorerTree.svelte               # Tree view with folders, context menus
  ExplorerPreview.svelte            # Asset preview sidebar
  types.ts                          # PostListItem, AssetListItem, FileListItem, UploadingItem

$lib/config/desk-panels.ts         # Panel type -> component registry
```
