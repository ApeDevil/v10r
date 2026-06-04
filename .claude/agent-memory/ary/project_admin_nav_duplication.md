---
name: admin-nav-duplication
description: Admin sidebar structure is duplicated — inline grouped array in admin/+layout.svelte vs flat adminNavItem in $lib/nav/nav.ts
metadata:
  type: project
---

The admin sidebar navigation has TWO sources of truth that drift independently:

1. `src/routes/[[locale=locale]]/admin/+layout.svelte` — inline `const groups` array: 4 groups (Observe/Manage/Content/System), each item `{label, href, icon}`. Has grouping + icons, English-only hardcoded labels. Consumed by `AdminSidebar.svelte` ($lib/components/shell/) which renders groups → items.
2. `src/lib/nav/nav.ts` — `adminNavItem.children`: FLAT list, `{href, label}` where label is a Paraglide message fn (i18n), no grouping, no per-item icons. This is the "single source of truth for sidebar nav" per its own header comment, but the admin layout ignores it.

Both list AI (`/admin/ai`) and RAG (`/admin/rag`) as flat siblings. `$lib/nav/types.ts` defines `NavItem`/`NavChild` (no group concept).

**Why:** Two registries were built at different times; admin layout never adopted the nav registry. The nav registry has i18n labels the inline array lacks; the inline array has grouping + icons the registry lacks.
**How to apply:** Any admin-sidebar restructure (e.g. promoting AI to its own group) should consolidate to ONE registry — extend `$lib/nav/` with a grouped admin shape (add `group`/`icon` to the admin children, or a new `adminNavGroups` export + `NavGroup` type) so labels stay i18n and grouping/icons live in one place. Do not edit only the inline array; that deepens the duplication. Related: [[chat-grounding-wiring]].
