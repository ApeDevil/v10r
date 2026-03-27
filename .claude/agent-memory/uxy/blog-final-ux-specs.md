---
name: Blog Editor Final UX Specifications
description: Binding design contract for blog editor Phase 2+3 — toolbar layout, save/publish flow with inline confirmation, document browser panel spec, preview optimistic rendering strategy, MetadataDrawer fields and auto-behaviors, keyboard shortcut ownership policy, and multi-author soft-lock pattern.
type: project
---

Final UX specifications produced in Round 2, synthesizing all 6 Round 1 agent findings. These resolve all Critical, Major, and Minor concerns from blog-system-review.md.

**Why:** Pre-implementation design contract so all Phase 2 (Desk Editor) and Phase 3 (AI Integration) work shares consistent interaction model.

**How to apply:** Reference this when building EditorPanel, PreviewPanel, DocumentsPanel, MetadataDrawer, and DeskBus. Cross-reference blog-system-review.md for the concerns these decisions resolve.

---

## 1. Editor Toolbar

Three zones: left (doc controls), center (formatting), right (view controls).

**Left zone:**
- "Docs" button (i-lucide-panel-left) — opens Documents panel
- "Save" button — explicit server save; muted when clean, error state on failure
- Save state indicator (3 states): amber dot "Unsaved changes" | neutral dot "Saved [relative time]" | spinner "Saving..."

**Center zone:**
- Bold (Cmd+B), Italic (Cmd+I), Inline code (Cmd+E)
- Slash command button (opens palette at cursor)
- Image button (opens file picker)

**Right zone:**
- Preview toggle — "Show preview" / "Hide preview" with active state bg-primary/10
- Publish button — status-aware: "Publish" (draft/review) → inline confirm → done; "Unpublish" (published); hidden when archived

---

## 2. Save/Publish Flow

**Save:** Cmd+S (owned by CM6 keymap, not global listener). On failure: non-blocking toast + amber dot restored. Never modal.

**Publish inline confirmation:** Clicking Publish splits button into "Confirm publish" + "Cancel" with 5-second countdown ring. No action after 5s reverts to single button. Same pattern for Unpublish. Same pattern if status changed via MetadataDrawer segmented control.

**Multi-locale publish:** Button becomes locale-aware when multiple locales exist. Shows "Publishing [locale] version."

---

## 3. Documents Panel (renamed from Files)

**Label:** "Documents" | **Icon:** i-lucide-file-text

**Header:** "Documents" + "New" icon button (i-lucide-plus). New creates DB stub immediately, opens writing layout preset, focuses title field in MetadataDrawer. This is the definitive New Post entry point — not the activity bar.

**List item:** status dot (amber=draft, green=published, neutral=archived, blue=review) + title + "Draft · 2 days ago · [author avatar]"

**Right-click menu:** Open, Duplicate, Archive, Delete (only Delete gets a confirmation modal).

**Presence indicator:** "being edited by Sara" replaces timestamp when active lock exists.

---

## 4. Preview Panel

**Two-tier optimistic rendering:**
- Tier 1 (immediate, 300ms): client-side remark pipeline, prose only, embed tokens become placeholder divs
- Tier 2 (~500ms): server POST /api/blog/preview replaces Tier 1 with accurate Shiki+directive output, opacity transition 150ms

**Loading indicator:** "Updating..." text label in header, appears when debounce timer fires (before POST starts).

**Three embed states:**
- Rendering: pulsing skeleton card "Chart loading..."
- Placeholder: dashed border + bg-muted/5, "Chart | sales-2024 | Preview in full mode →"
- Error: border-error-fg + specific message "Chart ID not found"

**Error state:** On API failure, show last render with "Preview unavailable — showing last render." + Retry link. Never clear the pane.

**DeskBus replay:** PreviewPanel subscribes with replayLast: true so re-opening a closed panel shows current content immediately.

---

## 5. MetadataDrawer

**Opener:** i-lucide-sliders-horizontal toolbar button (separate from Publish).

**Fields:**
- Title: required, autosave on blur (to post row, not revision), auto-generates slug
- Slug: auto-managed (wand icon) until manually edited (lock-open icon). "Reset to auto" available. URL preview below. Uniqueness validated on blur with suggested variant.
- Summary: 2-row textarea, 200 char limit with count
- Tags: multi-select Combobox with chip display. "Create '[value]'" option when no match.
- Locale: select (hidden until i18n active)
- Status: segmented control (Draft | Review | Published). Archived via document browser only. "Review" grayed as "(coming soon)". Status change to Published triggers same inline confirmation pattern.

**Validation:** Publish blocked if title or slug missing — fields highlighted, Drawer auto-opens.

**Revision history:** Collapsible section, collapsed by default. Shows "Revision N — date [Restore]". Restore loads content as unsaved (author must save to create revision from it).

**Autosave:** Title, slug, summary, tags autosave on blur to post row. Does not create new revision.

---

## 6. Keyboard Shortcut Policy

**CM6 owns:**
- Cmd+S → save (CM6 keymap binding calls save handler before CM6 default)
- Cmd+B/I/E → formatting
- / at line start → slash palette
- Escape → close palette (priority) OR CM6 default if palette not open

**Slash palette undo:** / character is not committed to undo stack when palette opens. Escape removes / via CM6 transaction (not undo). Selecting a command = single atomic transaction. Cmd+Z never reveals a dangling /.

**Desk-panel owns:** Cmd+Shift+P (command palette), Cmd+\ (toggle preview)

**Focus trap protocol:** CM6 shortcuts suspended while Drawer/Dialog open. DeskBus emits editor:focus-state on focus change.

---

## 7. Multi-Author Indicators

**Soft lock:** PUT /api/blog/[id]/editing-lock on open, refreshed every 60s, expires after 90s.

**When another author has lock:** Banner below toolbar — "Sara is editing. Last activity: 3m ago. [ Continue anyway ] [ Open copy ]"

**When current author's own lock (another tab):** "You have this open in another tab. [ View unsaved changes ] [ Use this tab only ]"

**Panel visibility by role:**
- admin: all panels
- author: Editor, Preview, Documents, AI Chat only (Terminal, Dashboard, Sheets hidden)
- Gate: panels config has roles[] array, activity bar renders only role-accessible panels

---

## Cross-Cutting Resolutions

- Citation tooltip: title + source type badge only. Raw score (0.73) never shown to users.
- RSS: <link rel="alternate"> in blog +layout.svelte head + feed icon on blog index. Phase 1, not Phase 2.
- Blog empty state: "No posts published yet. Check back soon, or subscribe to the feed." with /blog/feed.xml link.
- DeskBus: subscribe({ replayLast: true }) for PreviewPanel and any panel that needs current state on open.
