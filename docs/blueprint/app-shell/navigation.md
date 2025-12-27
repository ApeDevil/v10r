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

```svelte
<!-- Sidebar nav structure -->
<nav>
  <NavItem href="/dashboard" icon={Home}>
    Dashboard
  </NavItem>

  <NavItem href="/projects" icon={Folder} hasChildren>
    Projects
    {#snippet children()}
      <NavDropdown>
        <NavLink href="/projects/active">Active</NavLink>
        <NavLink href="/projects/archived">Archived</NavLink>
      </NavDropdown>
    {/snippet}
  </NavItem>

  <NavItem href="/settings" icon={Settings} hasChildren>
    Settings
    {#snippet children()}
      <NavDropdown>
        <NavLink href="/settings#profile">Profile</NavLink>
        <NavLink href="/settings#billing">Billing</NavLink>
        <NavLink href="/settings#team">Team</NavLink>
      </NavDropdown>
    {/snippet}
  </NavItem>
</nav>
```
