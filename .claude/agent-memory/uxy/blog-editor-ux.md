---
name: Blog Editor UX Analysis
description: UX paradigm recommendation, custom syntax authoring, preview strategy, content management flows, embed insertion, mobile scope, and accessibility for a markdown-first blog system. Includes Wave 2 resolution: Carta vs CodeMirror, slash command mechanics, preview API, and progressive enhancement path.
type: project
---

Brainstorm analysis for a blog system with markdown-first content, rich embeds, and custom syntax extensions.

**Why:** Establishing UX direction before implementation begins. Intended to inform editor library choice, layout architecture, and admin area integration.

**How to apply:** Use these decisions as the design contract when building blog editor routes and components.

---

## Wave 2 Resolutions

### Editor Surface: Textarea First, CodeMirror 6 Later — Never WYSIWYG

WYSIWYG is rejected. Custom syntax (::chart[], ::scene[], etc.) requires a bespoke ProseMirror node view per embed type. Failures are silent — the editor renders fine but produces corrupted markdown. Source editors have visible, author-recoverable failures. With svelte-tiptap already fragile and Milkdown's custom nodes broken, the implementation risk is unacceptable.

**Phase 1**: Existing Textarea primitive as editing surface. Slash command palette positioned via textarea cursor-overlay technique. Split-pane layout from existing PaneGroup primitives. Client-side remark pipeline for live preview.

**Phase 2**: Drop in CodeMirror 6 (`EditorView`). Same split-pane layout, same slash command Popover, same preview pane — only the surface changes. CodeMirror's transaction API makes slash command insertion atomic and undoable. Cursor tracking upgrades from overlay technique to `coordsAtPos()`. No content migration needed — markdown is just text.

**Phase 3 (optional)**: Lezer grammar for custom syntax highlighting. ~100–300 lines per syntax type. Defer until authors express confusion about embed token boundaries.

**Skip Carta**: Carta wraps a textarea with syntax highlighting but lacks CodeMirror's transaction API, which is essential for atomic slash command insertion with undo support. Go straight to CodeMirror when escalating from Textarea.

### Slash Command Mechanics in a Source Editor

Detecting the trigger: `EditorView.updateListener` watches for `/` at line start (or after whitespace). Palette Popover opens, anchored via `coordsAtPos()` to get pixel coordinates. In Textarea phase, a hidden span overlay mirrors cursor position to get coordinates.

Insertion: CM6 transaction replaces the `/` character with the syntax template. The cursor is placed at the first parameter position using CM6 selection. For simple blocks: done. For medium-complexity blocks (need id picker): Popover transitions to second panel with Combobox — no focus jump, no second Popover. For complex blocks (3D scene): Popover closes, Drawer opens with full FormField configuration.

Ghost text for parameters: CM6 Decoration API shows placeholder text inside parameter brackets. When cursor is inside brackets and user pauses, a Popover shows the relevant Combobox (chart ids, scene ids, etc.).

Source editors are strictly easier to implement slash commands in than WYSIWYG — insertion is a string replacement, not a node insertion that must maintain bidirectional model sync.

### Preview API: Client-Side Pipeline + Honest Server Preview

**Live preview pane** (split-pane right side): client-side remark/rehype pipeline. Shared module extracted to `$lib/utils/markdown/pipeline.ts`. Embed tokens emit placeholder `<div data-embed="..." data-id="...">` HTML. The preview pane's `$effect` hydrates these via dynamic import registry — same pattern as public renderer. Low latency, no network.

**Full preview** (toolbar button): navigates to or opens a server-rendered view of the draft. Uses the same route that public readers use, behind an auth check. This is the honest preview for posts with 3D embeds or `asset://` media that require presigned URL resolution. No separate preview endpoint — that would drift from the public route over time.

The pipeline is shared: editor preview and public renderer use the same remark plugins. Drift is prevented structurally, not by convention.

### Progressive Enhancement Summary

The content (markdown text) is paradigm-agnostic — same storage, same pipeline, same public renderer across all phases. The editor surface is a swappable implementation detail. Slash command palette, preview pane, and content management routes require no changes when upgrading from Textarea to CodeMirror. Total migration cost: replace the textarea element with a CodeMirror EditorView and update cursor coordinate retrieval.

---

## Recommended Paradigm: Split-Pane

Split-pane (editor left / preview right) is the right model because markdown is the source of truth. The project already has PaneGroup + Pane + PaneResizer primitives — layout scaffolding exists. The `renderMarkdown` utility also exists.

Default: editor fills 100% width, preview hidden. Toggle to 50/50. Narrow viewports (<900px): editor-only, Preview button opens full-screen overlay (Dialog or Drawer).

Do NOT use WYSIWYG (fights markdown-first architecture — custom tags need custom node views, failures are opaque). Block-based is wrong because it makes markdown a derivative export, not the source.

Hybrid (Typora-style) is viable long-term but most complex to implement with accessibility guarantees.

---

## Custom Syntax Authoring

**Slash commands** (`/` at line start): the canonical discovery mechanism. Opens a Popover-based palette (built on existing Popover primitive) with block types grouped as Text, Embeds, Content References. Keyboard-navigable, search-filtered client-side. Inserts the syntax with cursor positioned at the parameter location.

**Inline ghost text**: after slash command inserts a block, show ghost text inside parameter brackets indicating what goes there. When cursor is inside brackets, show a popover with valid options fetched from the relevant registry (chart ids, scene ids, user list).

**Reference autocomplete**: `@username` triggers user list autocomplete. `#tag` triggers tag autocomplete. Consistent with existing content graph.

**Floating inline toolbar** for selection-based formatting (bold, italic, code, link). Appears near selection, not in a fixed bar.

---

## Preview Strategy

Three categories:

- **Prose** (headings, paragraphs, code blocks): live preview feasible. Update as the author types.
- **Chart embeds**: show a static placeholder card (type, id, thumbnail if available). Update only when the token is complete (cursor leaves block or explicit refresh). Do not re-render on every keystroke.
- **3D scenes / heavy interactive components**: no live preview. Show a labeled placeholder card. Full render only available via explicit "Preview" mode (full server render) or "Preview this block" action opening a Dialog.

Two explicit modes:
1. **Edit mode** (default): embeds show placeholder cards. Fast text preview optionally visible on the side.
2. **Preview mode**: triggered by toolbar button. Full server render in a separate view or full-pane Drawer. This is the honest preview for posts with 3D embeds.

---

## Embed Insertion UX

**Simple embeds** (callout, code block, hr): slash command inserts, ghost text guides parameter entry.

**Medium-complexity embeds** (chart, code block with language picker): slash command inserts, Popover opens immediately for configuration (Combobox to select the chart/language, thumbnail preview, confirm button). Author never types the id by hand.

**Complex embeds** (3D scene, interactive demo): slash command inserts, Sheet/Drawer (right panel) opens with full form-based configuration UI built from FormField composites. Source updated only on confirm.

**Images**: dedicated toolbar button + drag-and-drop. Inline progress placeholder at cursor position. Upload to R2. On completion, placeholder replaced with markdown image syntax. Mandatory alt text prompt immediately after insertion (not optional, required for publish).

---

## Content Management

Admin layout: add a "Content" group alongside Observe/Manage/System.
```
Content:  Posts | Tags | Media Library
```

Posts list: canonical data table pattern (URL-as-state, GET search form, sort headers, Pagination composite). Identical to the pattern used by Users and Audit Log.

Post editor: full-page route (`/admin/content/[id]/edit`), not a modal or drawer.

Status field: `'draft' | 'review' | 'published' | 'archived'`. Build all four into schema from day one. Expose only Draft/Published/Archived in UI at launch. "Review" state activates when multi-author roles are introduced.

Multi-author: `author` role via Better Auth admin plugin role field. Gate `/admin/content/*` on `role === 'admin' || role === 'author'` when needed. The existing `requireAdmin(locals, capability?)` signature supports this. Do not build admin-only and retrofit.

---

## Mobile Scope

Full authoring on mobile: explicitly NOT supported at launch. Show: "Full editing is best on a larger screen."

What DOES work on mobile:
- Preview mode (full server render = same stack as public blog, no extra work)
- Metadata-only editing (title, status, tags) via a simplified form view on mobile

This constraint removes mobile compatibility from editor library choice criteria.

---

## Accessibility

Highest-risk surfaces and their patterns:

**Slash command palette**: ARIA combobox pattern. `role="combobox"` on input, `aria-expanded`, `aria-autocomplete="list"`, `aria-controls` pointing to listbox. Each option: `role="option"`, `aria-selected`. Matches the existing Combobox primitive — build on or alongside it.

**Embed placeholder cards**: descriptive `aria-label` for screen readers: `aria-label="Chart embed: sales-2024"` not just a visual card.

**Preview pane**: `role="region"` with `aria-label="Post preview"` and `aria-live="polite"`.

**Focus management at transitions**:
- Palette opens: focus moves into palette filter input
- Palette closes: focus returns to cursor position in editor
- Sheet/Drawer opens: focus trap active (Bits UI Drawer handles this)
- Preview mode toggle: announce state change with `aria-live` on mode indicator

**Editor surface baseline**: plain Textarea (existing Textarea primitive) is the most accessible option — native form element, unambiguous tab order, standard screen reader behavior. Start there. Only escalate to CodeMirror 6 if document size or syntax highlighting are actual blockers — and only if CodeMirror's custom editing surface can be verified against the ARIA `textbox` / `aria-multiline="true"` requirements.

---

## Key Primitives Already Available

- PaneGroup + Pane + PaneResizer — split-pane layout
- Textarea — accessible editor baseline
- Popover — slash command palette, inline parameter picker
- Drawer — Sheet panel for complex embed configuration, mobile preview overlay
- Dialog — "Preview this block" for heavy components
- Combobox — content reference autocomplete, embed id picker
- FormField — embed configuration forms in Drawer
- Pagination — posts list
- Table primitives — posts list table
- renderMarkdown utility — already exists in `$lib/utils/markdown`

No new primitive components are needed for the editor architecture itself.
