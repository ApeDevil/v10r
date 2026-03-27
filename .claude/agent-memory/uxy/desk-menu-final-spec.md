---
name: Desk Menu System — Final UX Specification (Round 2)
description: Binding design contract for the global MenuBar, context menus, save/publish UX, focusedLeafId, and StatusStrip decision. Supersedes Round 1.
type: project
---

# Desk Menu System — Final UX Specification

## Decisions Locked by Research

| Finding | Decision |
|---|---|
| No production tool uses panel-conditional top-level labels | Fixed label set always rendered |
| Bits UI `disabled` prop has reactivity bug (#537) | Use `{#if}` to conditionally render items, not `disabled` |
| SCOUT: no Svelte 5 + Bits UI MenuBar dynamic-content examples | Static labels, dynamic item lists — proven pattern |
| ARCHY: multi-leaf ambiguity for "File > Save" | Add `focusedLeafId` to DockState; all menu actions target focused leaf |
| DATY: canonical `MenuItem` type with `id` field | Extend existing `MenuBarItem` in `types.ts`, add `id?: string` |

---

## 1. Menu Structure — Three Fixed Labels

**Final set: `File | View | Post`**

Three labels, not four. Rationale below.

### Why not four ("File | Edit | View | Panel")?

- **Edit** is vestigial here. Undo/Redo and Find/Replace don't exist yet, and adding a menu that renders almost entirely greyed-out items signals incompleteness to users. Add Edit when the content exists.
- **Panel** as a label is confusing. Users don't think "I want to do something to my Panel" — they think "I want to do something to my post." Panel-management actions belong in View (layout) or Post (document-level).
- **Post** is better than "Panel" because it names the domain, not the chrome. Explorer-specific actions are creation/import (which belong in File). Editor-specific actions are publish/metadata (which name the post, not the editor).

Three labels is the minimum expressive set. If a fourth label becomes load-bearing later (Find/Replace, multi-document operations), it gets added then.

### Menu Contents

Items marked `[E]` = only visible when Editor panel is focused/has an active document.
Items marked `[X]` = only visible when Explorer panel is focused.
Items marked `[always]` = always rendered.

**Implementation note:** Use `{#if}` blocks inside `Menubar.Content` rather than `disabled` on items. If there's no active document, the item doesn't exist in the DOM. This sidesteps the Bits UI `disabled` reactivity bug and produces a cleaner, less confusing menu — users see only what they can do.

---

#### File

```
New Post                    Ctrl+N        [always, triggers Explorer new-post flow]
---
Import from Markdown...     —             [always, triggers Explorer import flow]
Export as Markdown          Ctrl+Shift+E  [E, only when editor has active document]
---
Save                        Ctrl+S        [E, only when editor has unsaved changes]
```

**Notes:**
- "New Post" always appears because it's a creation action — it doesn't require an active document.
- "Import from Markdown..." ellipsis signals a file picker opens. No dialog needed in the menu itself.
- "Export as Markdown" is [E] only — exporting requires knowing which post's content to serialize.
- "Save" only appears when there are unsaved changes. When the document is already saved, the item is absent — the menu accurately reflects what's possible. This is a stronger signal than a greyed-out Save.
- No "Close" here. Panel closing lives in the tab bar (× button) and `View > Close Panel`, not File. "Close" in application menus means close the document, which in a dock metaphor means close the tab. That lives closer to the tab.

---

#### View

```
Toggle Preview              Ctrl+Shift+P  [always]
Toggle Explorer             Ctrl+Shift+E  [always]
---
Split Editor Right          —             [always]
Split Editor Down           —             [always]
---
Close Active Panel          Ctrl+W        [always, closes focused leaf's active tab]
```

**Notes:**
- "Toggle Preview" and "Toggle Explorer" are affordances for users who've accidentally closed a panel and don't know how the activity bar works yet.
- The two split actions call `dock.movePanel` / `dock.splitLeaf` against the focused leaf. They are always available so users can discover the dock's splitting capability without needing to drag.
- "Close Active Panel" targets the focused leaf's active tab. The keyboard shortcut `Ctrl+W` is the universal browser/IDE tab-close shortcut — users already know it. This is the keyboard path for what the × button does on mouse.
- No layout preset switcher here in Phase 1. If presets become a real feature, add "Load Layout >" as a submenu.

---

#### Post

This menu is absent entirely when the focused leaf does not contain an Editor panel with an active document. This is implemented as `{#if focusedPanelType === 'editor' && activeDocumentId}` wrapping the entire `Menubar.Menu` for Post — or equivalently, rendering it but rendering zero items inside, which causes Bits UI to show an empty dropdown (bad). So: conditionally render the Post menu trigger itself.

Wait — research finding: "fixed top-level labels." But "Post" disappearing contradicts that. Resolution:

The research finding is about avoiding panel-conditional *label names* (e.g., the label itself changing from "File" to "Explorer File" depending on panel). It does not require every menu to always be present. VS Code has a "Terminal" top-level menu that is not present in older versions, and JetBrains conditionally shows tool-specific menus. The rule is: *stable, predictable labels when present.* A label that appears when an editor is active and disappears when it's not is acceptable — it tracks the object the user is working on.

However, to be safe and match user expectations of a fixed bar: **Post is always rendered but items are conditionally present inside.** When no editor is focused, the Post menu trigger is visible but clicking it shows zero items (which Bits UI renders as an empty popover — we prevent this by showing a single disabled informational item):

```
[when no editor active]
  (No document open)    — disabled, no action, serves as explanation
```

```
[when editor active with document]
  Metadata...           Ctrl+,        opens MetadataDrawer
  ---
  Publish...            —             initiates publish confirm flow (see §5)
  Unpublish             —             [only if status === 'published']
  Archive               —             [only if status !== 'archived']
```

**Notes:**
- Metadata always comes first. It's the most frequently accessed editorial action.
- "Publish..." ellipsis signals that clicking it does not immediately publish — a confirmation step follows.
- "Unpublish" / "Archive" appear based on current post status. These are destructive enough that discovering them via a menu (not a button) is appropriate friction.
- No "Delete Post" in the menu. Delete is in the Explorer context menu, next to the item. Deleting from a global menu that applies to the "active document" is dangerously divorced from the item's visual location.

---

## 2. StatusStrip vs Tab Dots — Final Call

**Decision: Tab dot only. No StatusStrip.**

Reasoning:

The StatusStrip adds 22px of permanent vertical real estate to every leaf that renders it — that means every editor panel, even when it is one of three side-by-side panes in a compact layout. This vertical cost is always paid, even when the editor is idle and the save state is "saved" (the most common state).

VS Code uses both tab dot and status bar, but VS Code's status bar carries six to twelve distinct pieces of information simultaneously (line/column, encoding, EOL, language mode, Git branch, errors/warnings, Live Share). In this system, the status bar would show one thing: save state. That's a poor trade for 22px.

Tab dot advantages:
- Zero additional height. The tab bar already exists.
- Visible from any layout, even when Editor is in a minimized or background pane. The user can see "Editor has unsaved changes" without focusing it.
- Universally understood. GitHub, Figma, VS Code, JetBrains — all use the dot-on-tab pattern.
- The existing EditorToolbar already has an inline save indicator (dot + text). This serves as the *verbose* version when the editor is active. The tab dot is the ambient version.

**Implementation:**

`DockTabBar.svelte` receives a new optional `getTabStatus?: (panelId: string) => 'unsaved' | 'error' | null` prop. The Desk page passes a function that checks: if the panelId starts with "editor-", look up that document's save state from a shared store. If unsaved, return `'unsaved'`.

The dot renders as a 5px circle, positioned absolute top-right corner of the tab label, using `--color-warning` for unsaved. It replaces nothing — the × close button remains. The dot sits inside the tab's label span, inline after the title text, to avoid layout interference with the close button.

```
[tab-icon] [label-text] [●] [×]
```

The dot is `aria-hidden="true"`. The tab's `aria-label` includes "(unsaved changes)" when the dot is active, so screen readers announce the state.

---

## 3. Context Menus — Exact Item Lists

All items are real, implemented actions. No placeholder items.

### Post row in Explorer tree (right-click)

```
Open                    — opens in editor panel (same as click)
Open to the Side        — opens in a new split to the right
---
Export as Markdown      — downloads .md file
---
Delete                  — confirm dialog, then DELETE /api/blog/posts/:id
```

Four items, one separator. "Open" duplicates the click action but satisfies the right-click expectation. "Open to the Side" is the power-user path — it calls `dock.addPanel` + `movePanel` targeting the right zone of the current leaf. Export and Delete are destructive-adjacent, grouped below the separator.

No "Rename" here: slug renaming has domain implications (URL changes, redirect needed). It belongs in the MetadataDrawer where the user sees the full context, not in a quick context menu.

### Asset row in Explorer tree (right-click)

```
Insert into Document    — publishes files:insert-image to DeskBus [only if editor has active document]
Copy Markdown Link      — copies ![fileName](downloadUrl) to clipboard
---
Copy URL                — copies raw downloadUrl to clipboard
---
Delete                  — confirm dialog, then DELETE /api/blog/assets/:id
```

Four items, two separators. The `{#if}` guard on "Insert into Document" prevents it from appearing when no editor is active — the item simply doesn't render, reducing confusion.

"Copy Markdown Link" is always available because it's a read operation on the asset record — no editor required. It serves users who write Markdown outside this editor.

### Tab in DockTabBar (right-click)

```
Close                   — closes this tab (same as × button)
Close Others            — closes all tabs in this leaf except this one
Close All               — closes all tabs in this leaf
---
Split Right             — moves this tab into a new split to the right
Split Down              — moves this tab into a new split below
```

Five items, one separator. These are the standard tab context menu actions from VS Code/JetBrains. "Close Others" and "Close All" are power-user shortcuts that become valuable when a leaf has accumulated many tabs. The split actions are the keyboard-free path to splitting.

No "Rename" (panels have fixed types/labels). No "Move to..." submenu (dragging handles this; a submenu would be complex for unclear gain).

---

## 4. Post Menu Necessity — Verdict

Yes, the Post menu is needed, and it should not be dissolved into File and View.

The alternative — putting Publish into File and Metadata into View — is wrong for two reasons:

1. **Mental model mismatch.** File = file system operations (new, open, save, export, close). Metadata and Publish are *editorial* operations on content, not file system operations. Publish especially: it is a content lifecycle action, not a file action.

2. **Discoverability of editorial flow.** A dedicated Post menu telegraphs "there are editorial actions here" to someone approaching the desk for the first time. File > Publish buries the most important writer action inside the generic file menu.

The VS Code argument (panel-specific items go into global menus) works because VS Code has 8+ top-level menus and enough content in each to absorb panel-specific items invisibly. With three labels, each menu needs to feel purposeful. Post achieves that.

---

## 5. Publish Confirmation in a Menu

**Pattern: Open a confirmation popover/drawer, not a submenu, not an in-menu second click.**

**Why not a submenu "Publish > Confirm Publish":**
Submenus have two usability problems. First, hover-to-reveal submenus are notoriously difficult on touchpads and trackpads — the user's pointer must travel in a precise diagonal to avoid the submenu dismissing. Second, "Confirm Publish" as a submenu item reads as if Publish has variants (Publish to Staging / Publish to Production). It doesn't; there's one action.

**Why not inline second-click in the menu:**
The existing EditorToolbar's two-click confirm pattern (`confirmingPublish = true` on first click, second click fires) works in a toolbar because the two clicks happen on the same button in the same place. In a menu, the menu dismisses after first click by default — the second click would need to reopen the menu, which is disorienting.

**The right pattern: "Publish..." → menu closes → inline confirmation banner appears above the editor content**

1. User clicks Post > Publish...
2. Menu closes (Bits UI default behavior on item select).
3. A confirmation strip appears between the EditorToolbar and the MarkdownSource. It reads:

```
[!] Publish this post? It will be publicly accessible.    [Publish]  [Cancel]
```

Styled with `--color-warning` background at ~5% opacity, `--color-warning` left border. The [Publish] button is filled `--color-primary`. [Cancel] is ghost.

4. The strip auto-dismisses after 10 seconds if neither button is clicked.
5. If [Publish] is clicked: save first if unsaved, then fire publish API, strip disappears, toast confirms.
6. If [Cancel] is clicked: strip disappears immediately.

**Keyboard path:** When the confirmation strip appears, focus moves to the [Publish] button. Tab reaches [Cancel]. Escape cancels (strip disappears). Enter confirms.

This pattern:
- Requires zero menu redesign
- Gives the user a clear in-context confirmation with full explanation text
- Is interruptible (auto-dismiss, Escape)
- Does not require a modal (which would block the editor content)
- Works with the existing `confirmingPublish` state in `EditorPanel.svelte`

---

## 6. `focusedLeafId` in DockState

ARCHY's recommendation. Required for unambiguous targeting when multiple editor panels are open.

**Where it lives:** `dock.state.svelte.ts`, new field `let focusedLeafId = $state<string | null>(null)`.

**What sets it:** `DockLeaf.svelte` fires `dock.setFocusedLeaf(leaf.id)` on `onfocusin` of the leaf container. This means any click, keyboard interaction, or programmatic focus within a leaf marks it as focused. The MenuBar reads `dock.focusedLeafId` to determine which leaf's active tab is the "active panel."

**What reads it:** The MenuBar's item visibility logic. `focusedPanelType` is derived from `dock.focusedLeafId → activeTab → panel.type`. Items guarded by `[E]` check `focusedPanelType === 'editor'` and that the editor has an `activeDocumentId`.

**Persistence:** Not persisted. On page load, `focusedLeafId` is null. All File and Post menu items requiring a document are absent until the user clicks into a leaf.

---

## 7. Type System Changes Required

### `MenuBarItem` in `types.ts`

Add `id?: string` for tracking (DATY requirement):

```typescript
export interface MenuBarItem {
  id?: string;           // NEW — stable identifier for tests/analytics
  type?: 'item' | 'separator' | 'checkbox' | 'radio';
  label?: string;
  shortcut?: string;
  icon?: string;
  checked?: boolean;
  onSelect?: () => void;
  // Remove: disabled — use {#if} instead per Bits UI bug #537
}
```

### `DockState` additions

```typescript
// In createDockState():
let focusedLeafId = $state<string | null>(null);

// Exposed:
get focusedLeafId() { return focusedLeafId; },
setFocusedLeaf(id: string | null) { focusedLeafId = id; },
```

### New `DeskMenuBar.svelte` component

The MenuBar is not embedded in any panel — it sits above the DockLayout in the Desk page, as a peer element. The Desk page becomes:

```
<div class="desk-page">
  <DeskMenuBar />            ← new, reads dock + bus context
  <DockLayout ... />
</div>
```

`DeskMenuBar.svelte` uses `getDockContext()` and `getDeskBus()` to derive item lists reactively. It constructs three `MenuBarMenu` objects: File, View, Post. Each menu's `items` array is `$derived` from `dock.focusedLeafId`, the active panel type, and the editor's document state (communicated via DeskBus `editor:document` channel).

---

## 8. Keyboard Shortcut Ownership Policy

Shortcuts in this menu system must not conflict with browser defaults or Bits UI internals.

| Shortcut | Action | Owner |
|---|---|---|
| Ctrl+S | Save | MenuBar File > Save (also MarkdownSource keydown handler, kept) |
| Ctrl+N | New Post | MenuBar File > New Post |
| Ctrl+W | Close Active Panel | MenuBar View > Close Active Panel |
| Ctrl+, | Metadata | MenuBar Post > Metadata |
| Ctrl+Shift+P | Toggle Preview | MenuBar View (not Cmd+P — that's browser print) |
| Ctrl+Shift+E | Toggle Explorer | MenuBar View |

No shortcuts in the context menus — context menus are pointer-driven interactions. Shortcuts belong on the menubar where they're visible.

Ctrl+Shift+E conflicts with Export as Markdown (also in File). Resolution: Export gets no shortcut in Phase 1. It's an occasional action, not a workflow staple.

---

## 9. Visual Anatomy of the MenuBar

The MenuBar renders in a dedicated bar between the shell header and the DockLayout. It does not live inside any panel.

Height: 28px (condensed — smaller than the EditorToolbar's 36px, closer to VS Code's 25px menubar).
Background: `--color-bg` (same as page, no surface elevation — the bar is flat, not raised).
Border bottom: 1px `--color-border`.
Font size: 12px, same as dock tabs.
Trigger padding: 6px 8px.

The bar spans the full width of the Desk layout, above all panels. This means even when the Explorer is in focus, File/View/Post are reachable without moving focus to the editor — users can trigger "File > Save" while the Explorer is focused if an editor document exists.

---

## 10. Accessibility Checklist

- [ ] MenuBar root has `role="menubar"` (Bits UI provides this)
- [ ] Each trigger has visible focus ring (`outline: 2px solid var(--color-primary)`)
- [ ] Arrow keys navigate between top-level triggers (Bits UI handles this)
- [ ] Down arrow from trigger opens menu (Bits UI handles this)
- [ ] Escape closes open menu and returns focus to trigger
- [ ] Tab dot on unsaved tab: `aria-label` on `<button role="tab">` includes "(unsaved)" suffix
- [ ] Publish confirm strip: focus moves to [Publish] button on strip appear
- [ ] Publish confirm strip: Escape key cancels
- [ ] Context menu targets all have `role="menuitem"` (Bits UI ContextMenu provides)
- [ ] "No document open" placeholder in Post menu has `aria-disabled="true"`
- [ ] All icon-only elements have `aria-label` or `title`

---

## Why:
Round 1 had panel-conditional top-level labels (Explorer gets "File/View", Editor gets "File/Edit/Publish"). RESY found no production tool does this. SCOUT found no Svelte 5 + Bits UI dynamic MenuBar examples exist. ARCHY raised multi-leaf ambiguity. This spec converges on the universal pattern: static labels, dynamic item lists, focusedLeafId for targeting.

## How to apply:
This is the implementation contract. Deviations require explicit discussion and spec update before code is written.
