# Navigation

**Progressive Disclosure** with hierarchical navigation. Users land on pages with a single click; subpages/sections are revealed via dropdown.

---

## Compound Nav Button

Each nav item is a split button with two click zones:

```
┌───────────────────────┬─────┐
│   📊 Dashboard        │  ▼  │
└───────────────────────┴─────┘
     ↑ Main action        ↑ Dropdown trigger
     (navigates)          (shows children)
```

| Zone | Action |
|------|--------|
| **Main button** | Navigate to page (single click) |
| **Dropdown trigger** | Reveal subpages or page sections |

---

## Navigation Hierarchy

```
Level 0: Nav Item (top-level page)
└── Level 1: Dropdown Menu
    ├── Subpage link
    ├── Subpage link
    └── Section anchor (#section)
```

---

## Nav Item States

| State | Visual |
|-------|--------|
| **Default** | Muted text, no background |
| **Hover** | Subtle background highlight |
| **Active (current page)** | Accent background, bold text |
| **Expanded (dropdown open)** | Chevron rotated, menu visible |

---

## Example Nav Structure

`NavItem` takes a `children` array of `{ href, label }` entries. It renders the submenu through `NavFlyout` (hover-triggered portal, the default) or `NavAccordion` (inline expand, used in the mobile drawer when `useFlyout={false}`).

```svelte
<!-- Sidebar nav structure -->
<nav>
  <NavItem href="/dashboard" icon="i-lucide-home" label={m.nav_dashboard} />

  <NavItem
    href="/projects"
    icon="i-lucide-folder"
    label={m.nav_projects}
    children={[
      { href: '/projects/active', label: m.nav_projects_active },
      { href: '/projects/archived', label: m.nav_projects_archived },
    ]}
  />

  <NavItem
    href="/settings"
    icon="i-lucide-settings"
    label={m.nav_settings}
    useFlyout={false}
    children={[
      { href: '/settings#profile', label: m.nav_settings_profile },
      { href: '/settings#billing', label: m.nav_settings_billing },
    ]}
  />
</nav>
```
