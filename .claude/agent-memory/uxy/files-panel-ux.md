---
name: Files Panel UX Recommendations
description: Comprehensive UX analysis and design recommendations for the unified Files panel — tree interaction model, upload UX, image insertion, file actions, visual hierarchy, empty states, and naming. Based on codebase audit of DocumentsPanel, EditorPanel, DeskBus, and R2 store patterns.
type: project
---

Full UX design research completed 2026-03-24.

**Why:** Replace the VS Code-like mockup (showing src/lib/...) and the DocumentsPanel (flat blog list) with a unified Files panel that mirrors the real virtual filesystem: blog/ (DB-backed), assets/images/ (R2-backed), and data/ (future).

**How to apply:** Reference when building the real FilesPanel component and the DeskBus events it requires.

---

## Existing Pattern Summary (what we inherit)

- **DocumentsPanel** follows: header strip (title + icon actions) → scrollable list → each item is a full-width button with title + badge + time. No nesting.
- **DeskBus** currently has three channels: `editor:content`, `editor:document`, `editor:save`. Any new panel communication needs new channels added here.
- **Files mockup** already establishes the tree chrome: toolbar strip (title + icon actions), tree body with depth-indented rows, status bar at bottom. This is the right structural foundation — it just shows the wrong content (VS Code source files instead of user content).
- **R2 store layer** (`src/lib/server/store/`) has `ObjectInfo` with key, size, lastModified, contentType. Keys are prefixed paths like `assets/images/photo.jpg`. This is the data model the tree should mirror.
- **Dock system** supports adding panels dynamically (dock.addPanel) and broadcasting via DeskBus. The files panel can open a new editor or image-viewer panel this way, exactly like DocumentsPanel does today.

---

## 1. Panel Name

**Use "Explorer"** — not Files, not Assets, not Objects.

Rationale:
- "Files" implies a system filesystem. This panel is a virtual content tree, not `/home/user`.
- "Assets" is too narrow — it excludes blog posts, which are the primary content type here.
- "Objects" is a cloud-storage term. It is accurate but foreign to content creators.
- "Explorer" is what VS Code calls their equivalent panel. The existing mockup already uses "Explorer" as its header label. Content creators who have ever used Notion, Bear, or any IDE will recognize it immediately.
- The icon `i-lucide-folder-tree` already in `desk-panels.ts` works well with "Explorer".

---

## 2. Tree Structure

Two root folders, always visible, never collapsible at the root level:

```
blog/
  my-first-post.md           [draft]
  welcome-to-velociraptor.md [published]

assets/
  images/
    hero-photo.jpg
    profile.png
```

**Design decisions:**

- Root folders (`blog/`, `assets/`) are always expanded by default. They are the navigational anchors — collapsing them hides all user content.
- Sub-folders within `assets/` (like `images/`) can be collapsed/expanded.
- `blog/` has no sub-folders — posts are flat files under the one folder. This matches how the DB works (posts have slugs, not paths).
- File names for blog posts show `{slug}.md`. This makes the file tree legible and scannable without requiring users to read the full metadata.

---

## 3. Tree Interaction (click behaviors)

### Clicking a blog post (.md file)
Open in EditorPanel — exactly how DocumentsPanel.openPost() works today. The panel calls `dock.addPanel({ type: 'editor', ... })` and publishes `editor:document` on DeskBus. No change to existing editor contract.

### Clicking an image file
Open an image inspector in the Preview panel. Do NOT open a separate panel by default — the Preview panel is already there, already showing content. Publishing `files:select` on DeskBus is enough; PreviewPanel subscribes and switches to image-viewer mode. This keeps the layout stable. A lightbox modal is the wrong interaction: it interrupts the user's workflow and is harder to close accidentally with keyboard.

If the Preview panel is not open (user closed it), fall back to a small popover inspector anchored to the file row itself. The popover shows: thumbnail, filename, dimensions, size, upload date, and the copy-to-markdown button.

### Clicking a .csv file
Publish `files:select` on DeskBus with the file's R2 key, type: 'csv'. The Spreadsheet panel subscribes and loads the file. Same pattern as editor:document — the dock target reacts, not the tree.

### Keyboard navigation
Arrow keys navigate the tree. Enter activates the focused item (same as click). This is standard tree behavior and costs nothing if the tree rows are keyboard-focusable from the start.

---

## 4. Upload UX

**Primary:** Upload button in the toolbar (the toolbar already has a pattern: icon-only buttons with title attributes for tooltips). Use `i-lucide-upload` as the icon, `title="Upload files"`, placed after the refresh button.

**Secondary:** Drag-and-drop onto the `assets/images/` folder row. This is the power-user path. When dragging files over the panel, the entire tree area shows a subtle drop overlay ("Drop to upload" centered text, dashed border inset). When dragging over a specific folder row, that row highlights with a primary color left-border and the folder icon switches to open-state.

**Why both:** Upload button is discoverable — it's always visible, so first-time users find it. Drag-and-drop is faster for experienced users uploading multiple images while writing. Neither replaces the other.

**What happens on upload:**
1. File validation client-side: accept image/* and text/csv only. Reject immediately with inline message in the drop zone or a non-blocking toast for button upload. Never a modal for this.
2. Optimistic tree entry appears immediately with a progress indicator (small spinner replacing the file icon). This is critical — users need to see "something is happening" without waiting for S3.
3. On success: spinner → file icon, entry is now fully interactive.
4. On failure: spinner → error icon (i-lucide-alert-triangle in error color), row shows "Upload failed · Retry" inline. The failed entry stays in the tree — never silently disappears. Retry re-attempts the same upload.

**File size limit:** Show the limit (e.g., "Max 10 MB") in the upload button's tooltip or as a note in the drag overlay. Users should know before they try.

---

## 5. Image Insertion into Markdown

This is the highest-friction workflow. A user writes a post, uploads an image, and then needs to reference it. The current gap would require them to manually know the CDN URL — that is a dead-end.

**Three mechanisms, in priority order:**

### A. Drag from tree into the editor (primary, most natural)
The user drags an image file from the Explorer tree into the MarkdownSource CodeMirror editor. On drop, insert `![filename](https://cdn.../key)` at the cursor position. This mirrors VS Code's drag-from-explorer behavior and requires no extra UI.

Implementation note: CodeMirror 6 supports custom drop handlers via its `EditorView.domEventHandlers`. The image node key can be resolved to a CDN URL client-side since the URL pattern is deterministic (`R2_PUBLIC_URL + '/' + key`).

### B. Copy-markdown button in the image inspector (secondary)
When viewing an image in the inspector (click on tree), a "Copy markdown" button copies `![filename](url)` to clipboard. A brief "Copied" toast appears inline on the button (replacing the label for 1.5s, then reverting — same style as the publish confirm pattern already in EditorToolbar). The user then pastes into the editor.

### C. Image toolbar button in EditorToolbar (tertiary)
The spec (blog-final-ux-specs.md §1 center zone) already calls for an image button that "opens file picker." This should open the Explorer panel and auto-navigate to assets/images/, with a "click to insert" mode active. When active, clicking an image in the tree inserts the markdown and deactivates the mode. The toolbar image button shows an active state (bg-primary/10) while insert-mode is on.

**All three mechanisms should produce identical markdown syntax.** Never use HTML `<img>` tags — the post is markdown, the output is prose.

---

## 6. File Actions

### The right model: hover-reveal inline actions + right-click context menu
Both are needed. Here is why:

- **Hover-reveal inline actions** (1-2 max) serve the 90% case without adding visual noise when not needed. DocumentsPanel already uses the chevron-right as a hover cue. File rows can show 1-2 icon buttons on hover, right-aligned, just like VS Code does.
- **Right-click context menu** serves the full action set. Keyboard users can use Shift+F10 or the context menu key to trigger it on focused items.

### Per file type actions:

**Blog post (.md):**
- Primary action (single click): Open in editor
- Hover inline (right side): i-lucide-more-horizontal (3-dot, opens context menu)
- Context menu items: Open | Duplicate | Rename slug | Archive | Delete
- "Delete" requires a confirmation: a small inline confirm strip that replaces the row ("Delete permanently? [Yes] [No]"), not a modal. Modal for delete is too heavy for a sidebar panel.

**Image file:**
- Primary action (single click): Preview in Preview panel / inspector
- Hover inline: i-lucide-copy (copies markdown to clipboard) | i-lucide-more-horizontal
- Context menu items: Preview | Copy markdown | Copy URL | Rename | Delete

**CSV file:**
- Primary action (single click): Open in Spreadsheet panel
- Hover inline: i-lucide-more-horizontal
- Context menu items: Open in Spreadsheet | Download | Rename | Delete

### Rename behavior
Clicking rename transforms the label into an inline editable text field (same width, same position). Enter confirms, Escape cancels. This is the standard tree-rename pattern (Finder, VS Code, VS Code Explorer). No modal.

---

## 7. Visual Hierarchy: DB-backed vs R2-backed

These two storage layers have different properties:
- Blog posts have statuses (draft, published, archived), titles, and last-edited times.
- Images and CSVs have sizes and upload dates.

**Differentiate at the folder level, not the file level.** The folder icon and label carry the distinction:

- `blog/` folder uses `i-lucide-book-open` (editorial metaphor) rather than a generic folder icon. Color: primary (blue or accent) to signal "this is your main work."
- `assets/` folder uses `i-lucide-layers` or `i-lucide-image` (storage metaphor). Color: muted/neutral — it's supporting material.
- Sub-folders under `assets/` use the standard folder icon (warm yellow, matching the current mockup pattern).

**At the file level:**

- Blog post rows: show a status dot (amber=draft, green=published, neutral=archived) to the left of the filename — exactly the same dot system the Documents panel spec uses. This preserves semantic consistency between the two views if Documents panel remains.
- Image rows: show a tiny image thumbnail (16×16px, border-radius-sm) as the leading icon, replacing the generic file icon. If the image can't load (network), fall back to `i-lucide-image`. This makes the asset list scannable at a glance.
- CSV rows: `i-lucide-sheet` icon in success color (green) to mirror Spreadsheet panel visual language.

**Secondary metadata (on hover or always):**
- Blog post: "2d ago" relative time
- Image: file size (e.g., "248 KB") — content creators need to know before they insert large images
- CSV: row count if available, otherwise file size

---

## 8. Empty States

The Explorer panel has multiple empty-state scenarios. Each needs a distinct, actionable message:

### Both folders empty (brand new workspace)
Show a single centered empty state spanning the full tree area:
- Icon: `i-lucide-folder-open` at ~32px, muted, opacity 0.4
- Primary text: "Your workspace is empty" (13px, muted)
- Action: Two buttons side by side — "New post" (primary-outline) and "Upload image" (ghost). These are the two entry points.

### blog/ folder empty, assets/ has files
Show the empty state inside the `blog/` section only, below the folder header:
- Icon: `i-lucide-pen-line` at 24px, indented to depth-1
- Text: "No posts yet"
- Inline link: "Create your first post" — clicking it creates a new draft and opens editor

### assets/ empty, blog/ has posts
Show below the assets/ folder:
- Icon: `i-lucide-upload` at 24px
- Text: "No files uploaded"
- Inline link: "Upload an image" — clicking it opens the file picker

### Loading state
The current DocumentsPanel pattern (centered Spinner + "Loading posts..." label) is correct. Apply the same to the tree: overlay the tree body with a spinner + "Loading files..." label during the initial fetch. Do not show the tree skeleton before data is ready — skeleton loaders for trees are harder to implement correctly than the spinner pattern already established.

---

## 9. The DocumentsPanel Question: Replace or Coexist?

This deserves a direct answer. There are two viable approaches:

### Option A: Replace DocumentsPanel with Explorer (preferred)
Remove the `documents` panel type entirely. The Explorer's `blog/` section provides everything DocumentsPanel does today, plus the `assets/` section. The "New post" creation flow lives as a toolbar button in Explorer.

**Pros:** Single source of truth for file navigation, no cognitive split between "Documents" and "Explorer," less code, less surface area.

**Cons:** The DocumentsPanel has richer metadata per item (title, status badge, relative time) than a tree can show naturally. The Explorer tree shows filenames — blog posts are identified by slug, not title.

**Resolution to the con:** Show the title as a tooltip on the filename, and show the status dot inline. The slug is actually a good identifier for authors — it is the URL-visible name. If authors want the title view, they can drag the leaf split to give Explorer more horizontal width. This is the panel system's superpower: resizable panels mean the user controls information density.

### Option B: Keep DocumentsPanel, add Explorer as a companion
Both coexist. DocumentsPanel remains for blog-post-centric work (rich list with titles). Explorer adds assets and CSV browsing.

**Pros:** No breaking change, DocumentsPanel's title-first view is better for many authors.
**Cons:** Two panels that overlap in purpose for blog posts. Users must choose which to open.

**Recommendation:** Option A. The Explorer is strictly more capable. DocumentsPanel's richer metadata row can be replicated by giving Explorer's blog file rows a two-line display (slug on top, title below in muted smaller text). This preserves the information density. The Documents/Explorer split is a short-term artifact of building features incrementally — unifying them now prevents permanent UX debt.

If Option A is chosen, the `documents` panel type should be removed from `DESK_PANELS` and `DESK_PANEL_TYPES`, and the Writing layout preset updated to use `files` instead.

---

## 10. New DeskBus Events Required

```typescript
// Add to DeskEvents in desk-bus.svelte.ts:
'files:select': {
  key: string;          // R2 key or blog post ID
  type: 'blog-post' | 'image' | 'csv';
  metadata: {
    name: string;
    size?: number;
    contentType?: string;
    url?: string;        // CDN URL for images
  };
};

'files:insert-image': {
  key: string;
  url: string;
  alt: string;           // Defaults to filename without extension
};
// EditorPanel subscribes to this and inserts ![alt](url) at cursor
```

The existing `editor:document` event remains — FilesPanel publishes it for blog posts, same as DocumentsPanel does today.

---

## 11. Accessibility Checklist

- Tree rows must be keyboard-navigable. Use `role="tree"` on the tree container, `role="treeitem"` on each row, `aria-expanded` on folders, `aria-level` for depth.
- Right-click context menu must be triggerable via keyboard (context menu key or Shift+F10).
- Upload button needs `aria-label="Upload files"` if no visible label text.
- Drag-and-drop upload must have a keyboard-accessible alternative (the Upload button). Never lock image insertion behind drag-only.
- Status dots on blog post rows need text equivalents: `aria-label="Draft"` or a visually hidden `<span class="sr-only">draft</span>` alongside the colored dot.
- Image thumbnails in tree rows are decorative when the filename already identifies the file: use `alt=""`.
- Progress indicators during upload: `role="status"` with `aria-live="polite"`.
- Rename inline input must auto-focus and show a visible focus ring. On Escape: restore original name and return focus to the file row.
