---
name: admin-nav-dual-registry
description: Admin nav lives in TWO places — inline groups array (AdminSidebar) + nav.ts adminNavItem (SidebarNav dropdown); they're separate surfaces, not pure duplication
metadata:
  type: project
---

The admin section has TWO nav registries that both list the same `/admin/*` routes but feed DIFFERENT surfaces:

1. **Inline `const groups` array** in `src/routes/[[locale=locale]]/admin/+layout.svelte` — grouped (Observe/Manage/Content/System), hardcoded English labels + per-item icons, passed straight to `AdminSidebar.svelte` (the 200px sticky desktop rail + mobile dropdown INSIDE the admin section).
2. **`adminNavItem` in `src/lib/nav/nav.ts`** — flat, i18n Paraglide message-fn labels (`m.nav_admin_ai` etc.), NO grouping, consumed ONLY by `src/lib/components/shell/SidebarNav.svelte` (the APP-WIDE sidebar's admin dropdown for the whole site shell, `[...navItems, adminNavItem]` when isAdmin).

**Why:** They're not strictly "duplicated truth" — different components, different render contexts (admin-internal rail vs global app shell). But they DO drift: both must be edited when an admin route is added/moved/removed.

**How to apply:** Any admin nav change (promoting AI to a top-level group, folding /admin/rag) must touch BOTH files. The inline `groups` array is the one that controls the admin-internal section layout; nav.ts only controls the global dropdown. The access section (`admin/access/+layout.svelte`) is the canonical precedent for an in-section secondary tab bar: plain `<a class:active>` + `page.url.pathname.startsWith()`, h1 header, `+layout.server.ts` with `requireAdmin` once + a shared count for a tab badge. Admin index redirect pattern: `redirect(303, localizeHref('/admin/db'))` — always wrap in `localizeHref`. `requireAdmin(locals)` calls `error(404)` (not 403) for non-admins.
