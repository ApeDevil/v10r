---
name: Explorer Panel Final UX Specification
description: Definitive, implementation-ready UX spec for the Explorer panel — resolves all Wave 1 cross-agent disagreements on preview strategy, image insertion MVP, tree layout, upload UX, empty states, file actions, and component wireframes. Supersedes files-panel-ux.md on all topics it covers.
type: project
---

Final specification produced 2026-03-24. Synthesizes ARCHY, SVEY, DATY, RESY, and SCOUT findings.

**Why:** Wave 1 left two open disagreements (image preview location, image insertion MVP) plus needed precise
component wireframe descriptions implementers can build from directly.

**How to apply:** Reference this as the binding contract when implementing FilesPanel, FilesToolbar,
FileTree, UploadDropzone, and FilePreview in `$lib/components/files/`. Cross-reference files-panel-ux.md
for the broader context and DeskBus event definitions.

---

## 1. Panel Name and Identity

**Panel type key:** `files` (unchanged in desk-panels.ts — internal type stays `files`)
**Display label:** "Explorer" (already in the existing mockup toolbar; keep it)
**Activity bar label:** "Explorer"
**Activity bar icon:** `i-lucide-folder-tree` (already correct in desk-panels.ts)
**Tab label in DockTabBar:** "Explorer"

The existing DESK_PANELS entry for `files` updates its label from "Files" to "Explorer":
```ts
files: { id: 'files', type: 'files', label: 'Explorer', icon: 'i-lucide-folder-tree', closable: true }
```

**Rationale:** "Files" implies a system filesystem. "Explorer" matches VS Code's term, matches the
existing mockup header, and is immediately legible to any content creator. The type key staying `files`
avoids breaking all layout persistence state already stored in localStorage.

---

## 2. Tree Layout

### Virtual filesystem structure

```
blog/                            ← always expanded, never collapsible at root
  welcome-to-velociraptor.md     ● published
  my-first-post.md               ● draft

assets/                          ← always expanded, never collapsible at root
  images/                        ← collapsible sub-folder
    hero-photo.jpg
    profile.png
```

### Folder identity

| Folder | Icon | Icon color | Label style |
|--------|------|------------|-------------|
| `blog/` | `i-lucide-book-open` | `--color-primary` | bold, 11px uppercase |
| `assets/` | `i-lucide-layers` | `--color-muted` | bold, 11px uppercase |
| `images/` (sub) | `i-lucide-folder` / `i-lucide-folder-open` | `--color-warning` (warm yellow, existing) | normal weight |

Root folders (`blog/`, `assets/`) have no collapse toggle. Their expand chevron slot is empty.
Sub-folders (`images/`) have the standard `▶` / `▾` toggle.

### File row anatomy (left to right)

**Blog post row:**
```
[indent][status-dot][i-lucide-file-text icon][slug-label][secondary-meta]
```
- Indent: depth × 16px left-padding
- Status dot: 6px circle, `--color-warning` for draft, `--color-success` for published, `--color-muted` for archived
- Icon: `i-lucide-file-text` at 14px, color `--color-muted`
- Label: slug without `.md` extension as the primary label, 13px, `--color-fg`
- Below label (second line, always visible): post title in 11px, `--color-muted`, truncated with ellipsis
- Secondary meta: right-aligned, shown always: relative time ("2d ago"), 11px, `--color-muted`

Two-line display is non-negotiable. The slug alone (e.g., "my-first-post") is machine-readable but
not human-friendly. The title below it gives authors the recognition cue they need.

**Image row:**
```
[indent][16×16 thumbnail][filename][secondary-meta]
```
- Thumbnail: 16×16px, `border-radius: 2px`, object-fit cover; fallback to `i-lucide-image` icon if URL fails
- Filename: full name including extension, 13px, `--color-fg`
- Secondary meta: right-aligned, always visible: file size ("248 KB"), 11px, `--color-muted`
- alt="" on thumbnail (filename is already the accessible label)

**CSV row (future, included for completeness):**
```
[indent][i-lucide-sheet in --color-success][filename][secondary-meta]
```
- Secondary meta: row count if available, otherwise file size

### Row height and spacing

- Blog post rows (two-line): 40px height minimum
- Image rows (one-line): 28px height
- Folder rows: 28px height
- Gap between `blog/` section and `assets/` section: 4px separator line (`1px solid --color-border` at 50% opacity)

---

## 3. Interaction Map

### Mouse interactions

| Target | Single click | Double click | Right click |
|--------|-------------|--------------|-------------|
| Blog post | Open in EditorPanel (editor:document event) | Same as single | Context menu |
| Image file | Preview image (files:select event, type='image') | Same as single | Context menu |
| Image thumbnail (16×16) | Same as row click | — | Same as row right-click |
| Sub-folder (images/) | Toggle expand/collapse | — | — |
| Root folders (blog/, assets/) | No action (already locked open) | — | — |
| Status dot | No action | — | — |
| Hover inline copy icon (images) | Copy markdown to clipboard | — | — |
| Hover inline 3-dot icon | Open context menu | — | — |

### Keyboard navigation

The tree container has `role="tree"`. Each clickable row has `role="treeitem"`.

| Key | Action |
|-----|--------|
| `↑` / `↓` | Move focus to previous / next visible row |
| `→` | Expand collapsed folder; if already expanded, move focus to first child |
| `←` | Collapse expanded folder; if already collapsed, move focus to parent |
| `Enter` | Activate focused item (same as single click) |
| `Space` | Same as Enter for files; toggle expand/collapse for folders |
| Context Menu key or `Shift+F10` | Open context menu for focused item |
| `F2` | Begin inline rename on focused item |
| `Escape` | Cancel rename if active; otherwise no action |

### Hover state

On row hover, reveal right-aligned inline action buttons (appear with instant show, no transition):

**Blog post on hover:**
- `i-lucide-more-horizontal` (24×24px tap target, 16px icon) — opens context menu

**Image file on hover:**
- `i-lucide-copy` (copy markdown) — copies `![filename](url)` to clipboard
- `i-lucide-more-horizontal` — opens context menu

Both icons use `--color-muted` default, `--color-fg` on their own hover.

### Drag and drop (tree rows as drag sources)

Image rows are draggable. When dragging begins:
- The row shows a drag ghost: thumbnail + filename label
- If dragged over the CodeMirror editor area, the editor shows a subtle drop-target highlight (2px dashed
  `--color-primary` border inside the editor viewport edge)
- On drop: insert `![filename-without-ext](cdn-url)` at the position nearest the drop point
- Implementation note: CodeMirror 6 `EditorView.domEventHandlers({ drop })` + `view.posAtCoords()`

**Selection capture before drag:** The editor stores its last cursor position in a local state variable
on every selection change. When the panel gains focus (file click or drag start), the editor saves
its selection to that variable. On drop, insert at the saved position if drop coords are outside the
editor viewport, otherwise use `posAtCoords`.

---

## 4. Preview Strategy — Resolved

**Decision: Option B (inline FilePreview inside FilesPanel).**

When a user clicks an image, image preview renders INSIDE the FilesPanel below the tree, not in the
separate PreviewPanel.

**Reasoning:**

The Writing layout preset is: `[Explorer 20%] | [Editor 40%] | [Preview 40%]`. A writer working on a
post has PreviewPanel showing their markdown output. If clicking an image in Explorer redirects
PreviewPanel to show the image, the markdown preview disappears. The writer then has two problems: they
can no longer see their content AND they cannot get back to it without closing the image view.

The correct mental model is that PreviewPanel = "the rendered version of what I am writing." That
association must never be broken by a side action like browsing assets.

By rendering image preview inside the Explorer panel itself, the writer sees the image without losing
the markdown preview. The Explorer panel grows taller or the user resizes it. This is also consistent
with how VS Code shows image previews in its Explorer panel when you click an image.

**FilePreview component, rendered inside FilesPanel:**

A collapsible section below the tree, revealed when an image is selected. The panel body splits into:
- Top portion: scrollable file tree (flex: 1, min-height: 0)
- Bottom portion: FilePreview section (fixed height: 180px, expandable to 300px via drag handle)

FilePreview section anatomy:
```
[drag handle — 4px resizable bar]
[header: filename | dimensions | size | close-X button]
[image: object-fit contain, max-height fills remaining space]
[footer: "Copy markdown" button | "Copy URL" button]
```

The close button collapses FilePreview (sets selectedImage = null), restoring full tree height.

**PreviewPanel stays markdown-only.** No changes needed to PreviewPanel or its DeskBus subscriptions.

**Fallback (FilePreview collapsed or panel too narrow):**
If the Explorer panel is narrower than 160px, FilePreview collapses automatically and instead a
Tooltip (Popover on click) attached to the file row shows: thumbnail, filename, dimensions, size,
and "Copy markdown" button. This Popover requires no minimum panel width to function.

---

## 5. Upload UX

### Entry points

**Primary — toolbar button:** `i-lucide-upload` icon button in FilesToolbar, `title="Upload image"`,
`aria-label="Upload image"`. Clicking opens a native file picker filtered to `image/*`.

**Secondary — drag onto assets/images/ folder row:** Visual cues:
- When dragging over the entire FilesPanel: subtle full-panel drop overlay (semi-transparent
  `--color-primary` border, 2px inset, with centered "Drop to upload" label)
- When dragging over the `assets/images/` row specifically: left border `3px solid --color-primary`,
  folder icon switches to open variant, row background `color-mix(in srgb, var(--color-primary) 8%, transparent)`
- Dragging over `blog/` folder: no drop target (posts are created, not uploaded)

**File validation (client-side, before presigned URL request):**
- Accept: `image/*` only (jpg, png, webp, gif, avif)
- Max size: 10 MB — if exceeded, show inline toast: "File too large. Maximum 10 MB." (non-blocking,
  auto-dismiss 4s). Never a modal for this.
- Invalid type: "Only image files can be uploaded here." toast, same treatment.

### Upload flow (from validation pass to tree entry)

1. **Optimistic entry appears immediately** in the `assets/images/` list, at the top of the list
   (above existing files, not alphabetically sorted — new uploads are most relevant):
   - Spinner icon replaces the thumbnail slot
   - Filename label shows the original filename
   - No size shown yet (unknown until upload completes)
   - Row is not interactive (no click, no hover actions) — `aria-busy="true"`

2. **Client requests presigned URL** from `POST /api/blog/assets` with filename and content-type.
   Important: content-type must match the request header sent to R2 (Content-Type gotcha confirmed
   by SCOUT — presigned URL must be requested WITH the content-type, then the PUT must match it exactly).

3. **Client PUTs directly to R2** using the presigned URL. The UploadDropzone component manages
   this flow internally and emits `onUploadComplete({ key, url, width, height, size })` when done.

4. **On success:** spinner → actual thumbnail (loaded from CDN URL). Row becomes fully interactive.
   Size appears in secondary meta. A brief toast: "Uploaded successfully" (auto-dismiss 2s).

5. **On failure:** spinner → `i-lucide-alert-triangle` in `--color-error` color. Row shows inline
   text: "Upload failed · [Retry]" where [Retry] is a button-link. Retry re-attempts step 2–4.
   The failed entry stays in the tree — never silently disappears. `aria-live="polite"` announces
   "Upload failed for [filename]".

6. **Multiple simultaneous uploads** each get their own optimistic row. They upload in parallel.

### Status bar counts during upload

"Uploading 2 files..." replaces the normal count during active uploads.

---

## 6. Image Insertion into Markdown — MVP and Deferred

### MVP (implement now)

**Mechanism A: Drag from tree into CodeMirror editor (primary)**

This is the MVP mechanism because:
- It requires no extra UI beyond the draggable rows that already need to exist
- It is the most spatially natural: the image is visually between Explorer and Editor, user drags left-to-right
- SCOUT confirms the CodeMirror 6 technical path is clear (`domEventHandlers`, `posAtCoords`)

**Implementation contract:**
- Image rows have `draggable="true"`
- Drag data: `text/plain` = `![{name-without-ext}]({cdn-url})` and `application/vnd.explorer-image` = JSON `{ key, url, alt }`
- EditorPanel registers `drop` handler via `EditorView.domEventHandlers`
- On drop: call `view.posAtCoords({ x: event.clientX, y: event.clientY })`, insert markdown string
- Edge case: if `posAtCoords` returns null (drop outside text bounds), insert at end of document

**Mechanism B: "Copy markdown" inline icon button + copy-in-footer (secondary)**

The hover-reveal `i-lucide-copy` icon on image rows and the "Copy markdown" button in FilePreview footer
both copy `![filename-without-ext](cdn-url)` to clipboard. On success, the icon shows a brief checkmark
(`i-lucide-check`, 1.5 seconds) before reverting. This is the paste-into-editor fallback.

### Deferred (not MVP)

**Mechanism C: Editor toolbar image button with insert-mode**

The existing blog-final-ux-specs.md §1 calls for an image button in the center zone of EditorToolbar.
That button's "opens file picker" behavior — which would activate an Explorer insert-mode — is deferred
to Phase 2. The button can still exist as a stub that opens the native file picker (standard HTML
`<input type="file">` trigger) as a temporary implementation. Insert-mode requires DeskBus coordination
that is more complex than drag-and-drop.

**Why drag is sufficient for MVP:** The desk layout places Explorer to the LEFT of the Editor. The
natural gesture is drag-right. This is the same motion muscle-memory as VS Code's drag-from-Explorer.
Copy-markdown covers users who prefer keyboard or who dislike drag.

### Markdown format invariant

All three mechanisms produce: `![{filename-without-extension}]({https://cdn-domain/r2-key})`

Never `<img>` tags. Never relative paths. Always absolute CDN URL.

---

## 7. Empty States

Each empty state must be actionable — never just a decorative placeholder.

### Scenario 1: Both blog/ and assets/ empty (brand new workspace)

Full tree area replaced with centered empty state:
- Icon: `i-lucide-folder-open` at 32px, `--color-muted`, opacity 0.4
- Primary text: "Your workspace is empty", 13px, `--color-muted`
- Two buttons below in a row (gap-2):
  - "New post" — uses Button component, variant="outline", clicks create a new draft
  - "Upload image" — uses Button component, variant="ghost", clicks open file picker

### Scenario 2: blog/ empty, assets/ has files

Inside the blog/ section only, a subdued empty state at depth-1 indentation:
- Icon: `i-lucide-pen-line` at 20px, `--color-muted`, opacity 0.5
- Text: "No posts yet" + inline link "Create your first post"

### Scenario 3: assets/ empty, blog/ has posts

Inside the assets/ section, below the images/ folder header:
- Icon: `i-lucide-upload` at 20px, `--color-muted`, opacity 0.5
- Text: "No images yet" + inline link "Upload your first image"

### Scenario 4: Loading (initial mount, both API calls in flight)

The tree body shows a centered Spinner component + "Loading..." label, 13px, `--color-muted`.
This matches DocumentsPanel's existing loading pattern — do not deviate into skeleton loaders.
Duration: until BOTH parallel API calls resolve (Promise.all). Show loading the entire time both
are in flight to avoid a flicker where blog/ loads but assets/ is still loading.

### Scenario 5: Fetch error

If either API call fails, show in the corresponding folder section:
- Icon: `i-lucide-alert-triangle` at 20px, `--color-error`
- Text: "Could not load [posts/files]" + "Retry" button-link
- The other section renders normally if its call succeeded

---

## 8. File Actions

### Action model

Two complementary access points:
1. **Hover-reveal inline icons** — maximum 2 icons, covering the most common actions
2. **Right-click context menu** — full action list, also keyboard-accessible via context menu key

### Blog post actions

**Hover-reveal (right side of row):**
- `i-lucide-more-horizontal` — opens context menu (the single most important icon)

**Context menu items (in order):**
1. Open in editor
2. Duplicate (creates a new draft copy with slug appended "-copy")
3. Rename slug (triggers inline rename — see below)
4. Archive
5. Delete ← requires inline confirmation (not modal)

**Delete confirmation for blog posts:**
The row expands in-place to show: "Delete this post permanently? [Delete] [Cancel]"
This is NOT a modal. It is an inline confirmation strip that replaces the row content.
[Delete] is a Button component with variant="destructive", [Cancel] is Button variant="ghost".
Focus moves to [Cancel] on reveal (default to safe action). On confirm, row disappears with a
100ms opacity transition. On cancel, row reverts instantly.

### Image file actions

**Hover-reveal (right side of row):**
- `i-lucide-copy` — copies markdown to clipboard (primary quick-action for images)
- `i-lucide-more-horizontal` — opens context menu

**Context menu items:**
1. Preview (same as single click — scrolls/expands FilePreview)
2. Copy markdown
3. Copy URL (copies raw CDN URL, not markdown)
4. Rename
5. Delete ← inline confirmation, same pattern as blog posts

### Inline rename behavior

Triggered by: F2 key, double-click label, or "Rename" from context menu.

The label text transforms in-place into an Input component (full component, not raw `<input>`):
- Same width as the label was
- Same font size (13px)
- Pre-selected text (full filename selected, ready to replace)
- For blog posts: the slug text is editable (`.md` extension shown but not editable — end of field)
- For images: full filename including extension is editable

**Commit:** Enter key or blur (clicking away). On commit:
- Validate: no empty name, no name with `/`, for slugs no spaces (replace with hyphens)
- If valid: show spinner briefly, PATCH the record, revert to label on success
- If invalid: show error tooltip on the input "Slugs can't contain spaces", do not commit

**Cancel:** Escape key. Restores original value, returns focus to the row. No API call.

---

## 9. Component Wireframe Descriptions

All components live in `$lib/components/files/`.

### FilesPanel (top-level, panel container)

Flex column, full height of dock leaf.

```
┌─────────────────────────────────────┐
│ FilesToolbar                        │  ← fixed height: ~36px
├─────────────────────────────────────┤
│                                     │
│ FileTree                            │  ← flex:1, min-height:0, overflow-y:auto
│                                     │
│                                     │
├─────────────────────────────────────┤  ← 4px drag-resize handle (only when FilePreview visible)
│ FilePreview                         │  ← collapsible, height: 180–300px
└─────────────────────────────────────┘
  status bar: "N posts · N images"       ← 24px, surface-1 bg
```

Props:
```ts
// No external props. Self-contained. Reads from DeskBus context.
```

State:
```ts
let posts = $state<BlogPost[]>([]);
let assets = $state<AssetFile[]>([]);
let loading = $state<'idle' | 'loading' | 'error'>('idle');
let selectedImage = $state<AssetFile | null>(null);
let previewHeight = $state(180);  // px, user-draggable
let uploadQueue = $state<UploadItem[]>([]);
```

On mount: `Promise.all([fetchPosts(), fetchAssets()])`. Both use existing `/api/blog/posts` and
new `/api/blog/assets` routes.

### FilesToolbar

Horizontal strip, `background: var(--surface-1)`, `border-bottom: 1px solid var(--color-border)`.

Left zone: "EXPLORER" label (11px, uppercase, `--color-muted`, letter-spacing: 0.05em), with
`i-lucide-folder-tree` icon before it.

Right zone (gap-1): icon-only buttons using `files-action` pattern from existing mockup:
- `i-lucide-file-plus` — New post (triggers new draft creation)
- `i-lucide-upload` — Upload image (opens file picker)
- `i-lucide-refresh-cw` — Refresh (re-fetches both API calls)

All three buttons use `title` attribute for tooltip. No visible label text.

### FileTree

Scrollable tree container. `role="tree"`, `aria-label="Content files"`.

Renders two sections in sequence:

**Section 1 — blog/**
Root folder row (no toggle, no click handler):
```
[i-lucide-book-open in --color-primary] [blog/] [N posts — right-aligned, 11px, --color-muted]
```
Below it: each post row at depth-1, or the "No posts yet" empty state.

**Section 2 — assets/**
Root folder row (no toggle, no click handler):
```
[i-lucide-layers in --color-muted] [assets/]
```
Below it: `images/` sub-folder row at depth-1, then image rows at depth-2. Or empty state.

Each tree item is a `<button>` element (NOT raw HTML unless component equivalent found) or a
`<div role="treeitem" tabindex="0">`. Keyboard focus via `tabindex`. Arrow key navigation managed
by a `$state` focusedIndex value that maps to item position.

`aria-level` = folder depth + 1 on each treeitem.
`aria-expanded` on folder rows.
`aria-selected` on active/selected row.

### UploadDropzone

Does not render visible UI on its own. It is a behavior wrapper that:
- Attaches `dragover`, `dragenter`, `dragleave`, `drop` handlers to the FilesPanel container
- Manages the drop overlay visibility via a prop callback
- Validates file types and sizes
- Calls `POST /api/blog/assets` for presigned URL
- PUTs to R2 with correct Content-Type header (MUST match what was requested in presigned URL)
- Emits: `onUploadComplete(result)`, `onUploadError(error)`, `onUploadStart(file)`

Also renders the hidden `<input type="file" accept="image/*" multiple>` triggered by the toolbar
Upload button.

Props:
```ts
interface UploadDropzoneProps {
  onUploadStart: (file: File) => void;
  onUploadComplete: (result: UploadResult) => void;
  onUploadError: (file: File, error: string) => void;
  onDragActive: (active: boolean) => void;  // drives overlay visibility
}
```

### FilePreview

Shown when `selectedImage !== null`. Collapsed (height: 0, invisible) otherwise.

Layout (flex column):
```
[drag-handle: 4px vertical resize bar, --color-border]
[header: filename — left | dimensions + size — right | × close button — far right]
[image: <img> with object-fit:contain, max-height fills remaining space, alt=filename]
[footer: [Copy markdown button] [Copy URL button] — right-aligned]
```

The header uses `overflow: hidden; text-overflow: ellipsis` on filename.
The close button uses Button component `variant="ghost"` with `size="icon"` or equivalent.
Footer buttons use Button component `variant="outline"` at small size.

Props:
```ts
interface FilePreviewProps {
  image: AssetFile;
  onClose: () => void;
  height: number;
  onHeightChange: (h: number) => void;
}
```

### ContextMenu integration

Use the existing `ContextMenu` composite component (`$lib/components/composites/context-menu/ContextMenu.svelte`).
Trigger: right-click on a tree row, or context menu key when row is focused.
Each context menu item maps to a handler function. The "Delete" item is styled destructive (red text).

---

## 10. DeskBus Contract (additions to desk-bus.svelte.ts)

Add to the `DeskEvents` interface:

```ts
// Published by FilesPanel when an image is selected
'files:select': {
  key: string;          // R2 key
  type: 'blog-post' | 'image';
  metadata: {
    name: string;
    size?: number;
    contentType?: string;
    url?: string;       // CDN URL, only for images
    width?: number;     // from asset DB column
    height?: number;    // from asset DB column
  };
};

// Published by FilesPanel or FilePreview when user copies markdown / drag-drop completes
// EditorPanel subscribes to this to insert at cursor
'files:insert-image': {
  key: string;
  url: string;
  alt: string;          // filename without extension
};
```

Note: `files:insert-image` is published by the Explorer panel when the copy-markdown button is used
AND the editor is currently open (EditorPanel subscribes). For drag-and-drop, the CodeMirror drop
handler inserts directly — no DeskBus event needed because the Editor handles it without panel
coordination.

---

## 11. layout-presets.ts Update

The Writing preset should be updated to include `files` instead of `documents`:

```ts
// writing preset panels:
files:   { id: 'files',  type: 'files',  label: 'Explorer', icon: 'i-lucide-folder-tree', closable: true },
[editorId]: { ... },
preview: { ... },
```

Tree layout: `[files 22%] | [editor 40%] | [preview 38%]`

The Documents panel type remains registered in DESK_PANEL_TYPES and DESK_PANELS for backward
compatibility with saved layouts. It renders as a stub "Documents panel moved to Explorer" message
pointing users to the files panel.

---

## 12. Accessibility Checklist

- [ ] `role="tree"` on FileTree container
- [ ] `role="treeitem"` on every clickable row
- [ ] `aria-level` reflecting depth on every treeitem
- [ ] `aria-expanded` on folder rows
- [ ] `aria-selected` on active row
- [ ] Arrow keys navigate the tree (no scroll hijacking when focus is inside tree)
- [ ] Enter/Space activate focused item
- [ ] Context menu key and Shift+F10 open context menu for focused row
- [ ] F2 triggers rename for focused row
- [ ] Status dots have visually hidden text: `<span class="sr-only">draft</span>`
- [ ] Image thumbnails in tree rows: `alt=""`
- [ ] Upload button: `aria-label="Upload image"`
- [ ] UploadDropzone announces upload result: `role="status"` element with `aria-live="polite"`
- [ ] Rename input: auto-focus on trigger, visible focus ring, Escape cancels and returns focus to row
- [ ] Drag-and-drop upload has keyboard-accessible alternative (Upload button) — never lock behind drag-only
- [ ] FilePreview close button: `aria-label="Close preview"`
- [ ] Minimum 44×44px touch targets on all interactive elements (use padding to achieve this)
- [ ] Color is never the only indicator (status dots always have sr-only text)

---

## 13. Resolved Disagreements Summary

### Image preview: OPTION B — FilePreview inside FilesPanel

PreviewPanel remains exclusively markdown preview. Disrupting the writer's markdown preview to show
an image is a context switch they didn't ask for. FilePreview below the tree keeps assets browsing
contained to the Explorer panel where it belongs.

### Image insertion MVP: DRAG FROM TREE + COPY MARKDOWN BUTTON

Drag is the primary (most natural for the desk layout, no extra UI). Copy markdown is the secondary
(clipboard-based, covers keyboard users). Toolbar "insert mode" is deferred to Phase 2. Both MVP
mechanisms produce identical markdown syntax.
