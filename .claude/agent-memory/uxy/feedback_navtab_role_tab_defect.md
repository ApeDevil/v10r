---
name: navtab-role-tab-defect
description: NavTab composite puts role=tab/tablist/aria-selected on navigating anchors — a WCAG 4.1.2 violation; use link-nav semantics instead
metadata:
  type: feedback
---

The `NavTab` composite (`src/lib/components/composites/nav-tab/NavTab.svelte`) renders `<a href>` elements with `role="tab"`, `role="tablist"`, and `aria-selected` — but these anchors perform full page navigation, not in-place tab-panel switching. This is a WCAG 4.1.2 (Name, Role, Value) violation: a screen reader announces "tab, selected" and implies arrow-key activation with no page change, while the control actually navigates.

**Why:** ARIA role must match behavior. `role=tab` is for tabpanel widgets where activation swaps content in place without navigation. Link-based section nav (each tab is a distinct route, bookmarkable, back-button-safe) must use plain `<nav>` + `<ul>` of `<a>` with `aria-current="page"` on the active link.

**How to apply:** When building route-based sub-navigation (e.g. the new `/admin/ai/*` section), do NOT reuse NavTab as-is. The CORRECT in-repo pattern is `AdminSidebar.svelte` (uses `aria-current="page"`, line 42) and `admin/access/+layout.svelte` (hand-rolled `<nav>` of plain `<a>`, no role=tab). Either fix NavTab globally (drop role=tab/tablist/aria-selected, add `aria-current="page"`) or add a link-safe `nav` variant prop. Escalate the global-fix-vs-variant choice to archy since NavTab is shared. Related: [[ai-control-room-a11y-floor]].
