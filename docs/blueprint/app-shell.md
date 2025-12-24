# App Shell Architecture

The app shell is the persistent UI skeleton that wraps all pages. It loads instantly and remains consistent across navigation.

## Shell Structure

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│   Sidebar        Main Content                            │
│   (Nav)          (+page.svelte)                          │
│                                                          │
│                                                          │
│                  ┌────────────────────────────────────┐  │
│                  │            Footer                  │  │
│                  └────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

**No main header.** The sidebar handles all navigation. This maximizes vertical content space.

### Components

| Component | Description |
|-----------|-------------|
| **Sidebar** | Primary navigation, collapsible |
| **Main** | Page content area (`{@render children()}`) |
| **Footer** | Persistent footer inside main content area |

---

## Responsive Sidebar

The sidebar adapts asymmetrically for ergonomics:

| Viewport | Position | Behavior |
|----------|----------|----------|
| **Desktop** | Left | Persistent rail, expands on hover |
| **Mobile** | Right | Off-canvas drawer, thumb-accessible |

### Desktop: Rail + Expand

```
Collapsed (Rail):          Expanded (Hover):
┌────┬─────────────┐       ┌──────────┬─────────────┐
│ 🏠 │             │       │ 🏠 Home  │             │
│ 📊 │   Content   │  →    │ 📊 Stats │   Content   │
│ ⚙️ │             │       │ ⚙️ Settings            │
└────┴─────────────┘       └──────────┴─────────────┘
  48px                        240px
```

- **Rail width:** 48-64px (icons only)
- **Expanded width:** 220-260px (icons + labels)
- **Trigger:** Hover or click to pin open
- **Position:** Left side (LTR reading flow)

### Mobile: Right-Side Drawer

```
Closed:                    Open:
┌─────────────────┐        ┌─────────────┬─────┐
│                 │        │             │     │
│     Content     │   →    │   Overlay   │ Nav │
│                 │        │   (dimmed)  │     │
│             [⚙] │        │             │     │
└─────────────────┘        └─────────────┴─────┘
           FAB                          Drawer
```

- **Position:** Right side (thumb-friendly for right-handed users)
- **Trigger:** Floating Action Button (FAB) in bottom-right corner
- **Animation:** Slides in from right
- **Overlay:** Dimmed backdrop, tap to close
- **Drawer width:** 280-320px or 80vw (whichever is smaller)

### FAB Trigger Specification

```
┌─────────────────────────┐
│                         │
│                         │
│                         │
│                     ┌──┐│
│                     │☰ ││  ← 56x56px, 16px from edges
│                     └──┘│
└─────────────────────────┘
```

- **Size:** 56x56px (Material Design standard)
- **Position:** Fixed, bottom-right, 16px margin
- **Icon:** Hamburger (☰) when closed, X when open
- **Z-index:** Above content, below drawer

---

## Sidebar Anatomy

The sidebar is divided into three zones:

```
┌──────────────────────┐
│  🦖 Logo             │  ← Header: Branding
├──────────────────────┤
│  🏠 Dashboard        │
│  📁 Projects      ▼  │  ← Body: Navigation
│  📊 Analytics        │
│  ⚙️ Settings      ▼  │
│                      │
│                      │
│      (flexible)      │
│                      │
├──────────────────────┤
│  ┌────┐              │
│  │ JD │ John Doe     │  ← Footer: User menu
│  └────┘ john@ex.com  │
└──────────────────────┘
```

### Zones

| Zone | Content | Behavior |
|------|---------|----------|
| **Header** | Logo/branding | Fixed, always visible |
| **Body** | Navigation items | Scrollable if overflow |
| **Footer** | User avatar + menu | Fixed, always visible |

### User Menu (Footer)

The user menu sits at the bottom of the sidebar, anchored to the viewport:

```
┌────────────────────────────┐
│  ┌────┐                    │
│  │ AV │  Display Name    ▼ │  ← Dropdown trigger
│  └────┘  email@example     │
└────────────────────────────┘
```

- **Avatar:** 32-40px, initials or image
- **Name:** Truncated if too long
- **Email:** Muted, smaller text
- **Dropdown:** Account, preferences, logout

#### User Menu Dropdown

```
┌────────────────────────┐
│  👤 Profile            │
│  🎨 Theme: Dark    ▸   │  ← Submenu for theme
│  ───────────────────   │
│  🚪 Sign out           │
└────────────────────────┘
```

---

## Navigation Pattern

**Progressive Disclosure** with hierarchical navigation. Users land on pages with a single click; subpages/sections are revealed via dropdown.

### Compound Nav Button

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

### Navigation Hierarchy

```
Level 0: Nav Item (top-level page)
└── Level 1: Dropdown Menu
    ├── Subpage link
    ├── Subpage link
    └── Section anchor (#section)
```

### Nav Item States

| State | Visual |
|-------|--------|
| **Default** | Muted text, no background |
| **Hover** | Subtle background highlight |
| **Active (current page)** | Accent background, bold text |
| **Expanded (dropdown open)** | Chevron rotated, menu visible |

### Example Nav Structure

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

---

## Component Structure

### File Organization

```
src/lib/components/
├── shell/
│   ├── AppShell.svelte       # Main shell wrapper
│   ├── Sidebar.svelte        # Sidebar container
│   ├── SidebarRail.svelte    # Desktop collapsed state
│   ├── SidebarDrawer.svelte  # Mobile drawer
│   ├── SidebarFab.svelte     # Mobile trigger button
│   ├── SidebarLogo.svelte    # Logo/branding (top)
│   ├── SidebarNav.svelte     # Navigation container (middle)
│   ├── NavItem.svelte        # Compound nav button
│   ├── NavDropdown.svelte    # Dropdown menu
│   ├── UserMenu.svelte       # User avatar + dropdown (bottom)
│   └── Footer.svelte         # Page footer component
```

### AppShell Component

```svelte
<!-- AppShell.svelte -->
<script lang="ts">
  import { Sidebar, Footer } from '$lib/components/shell';

  let { children } = $props();
</script>

<div class="app-shell">
  <Sidebar />

  <main class="main-content">
    {@render children()}

    <Footer />
  </main>
</div>

<style>
  .app-shell {
    display: flex;
    min-height: 100dvh;
  }

  .main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
</style>
```

### Root Layout Usage

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import { AppShell } from '$lib/components/shell';

  let { children } = $props();
</script>

<AppShell>
  {@render children()}
</AppShell>
```

---

## Breakpoints

| Name | Width | Sidebar Behavior |
|------|-------|------------------|
| **Mobile** | < 768px | Right drawer + FAB |
| **Tablet** | 768px - 1024px | Left rail, click to expand |
| **Desktop** | > 1024px | Left rail, hover to expand |

---

## Accessibility

| Requirement | Implementation |
|-------------|----------------|
| **Keyboard nav** | Arrow keys navigate items, Enter activates |
| **Focus trap** | Mobile drawer traps focus when open |
| **Escape to close** | Drawer closes on Escape key |
| **ARIA labels** | `aria-expanded`, `aria-haspopup` on dropdowns |
| **Skip link** | "Skip to main content" link before sidebar |
| **Reduced motion** | Respect `prefers-reduced-motion` for animations |

---

## Z-Index Layers

| Layer | Z-Index | Component |
|-------|---------|-----------|
| **Base** | 0 | Main content |
| **Sidebar** | 10 | Desktop sidebar rail |
| **FAB** | 20 | Mobile trigger button |
| **Overlay** | 30 | Drawer backdrop |
| **Drawer** | 40 | Mobile sidebar drawer |
| **Dropdown** | 50 | Nav dropdown menus |
