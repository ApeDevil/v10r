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

**No global header.** The sidebar handles all navigation. This maximizes vertical content space. Individual pages use a `PageHeader` component inside the main content area for page-specific titles and actions (see [PageHeader](#pageheader)).

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
  56px                        240px
```

Dimensions from [design/tokens.md](./design/tokens.md#sidebar):
- **Rail width:** `--sidebar-rail-width` = 56px (icons only)
- **Expanded width:** `--sidebar-expanded-width` = 240px (icons + labels)
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
- **Drawer width:** `--sidebar-mobile-width` = min(320px, 85vw) — see [tokens.md](./design/tokens.md#sidebar)

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

## QuickSearch

Global navigation and search via keyboard shortcut or sidebar trigger.

### Why "QuickSearch"?

"Command palette" comes from code editors where you execute commands ("Format Document"). Our use case is primarily **navigation and search**, so we use the simpler, more descriptive name "QuickSearch".

### Trigger Locations

| Location | Element | Behavior |
|----------|---------|----------|
| **Sidebar header** | Search input (visual) | Click opens QuickSearch |
| **Keyboard** | `⌘K` / `Ctrl+K` | Opens QuickSearch from anywhere |
| **Mobile FAB** | Optional 🔍 button | Opens QuickSearch |

### Sidebar Search Trigger

The sidebar header contains a search trigger that adapts to sidebar state:

```
Rail (56px):              Expanded (240px):
┌────┐                    ┌──────────────────────┐
│ 🦖 │                    │  🦖 Velociraptor     │
│ 🔍 │ ← icon only        │  🔍 Search...    ⌘K  │ ← styled as input
├────┤                    ├──────────────────────┤
```

- **Rail mode**: Search icon button, click opens QuickSearch
- **Expanded mode**: Fake input (styled like Input but not editable), shows `⌘K` hint
- **Both**: Clicking opens the QuickSearch modal

### QuickSearch Modal

```
┌─────────────────────────────────────────────┐
│  🔍 [Search pages, actions...]              │  ← Actual input
├─────────────────────────────────────────────┤
│  Recent                                     │
│  ├── 📊 Dashboard                           │
│  ├── ⚙️ Settings                            │
│  └── 📁 Project Alpha                       │
├─────────────────────────────────────────────┤
│  Pages                                      │
│  ├── 🏠 Home                                │
│  ├── 📊 Dashboard                           │
│  └── 📁 Projects                            │
├─────────────────────────────────────────────┤
│  Actions                                    │
│  ├── ➕ Create new project                  │
│  ├── 🚪 Sign out                            │
│  └── 🎨 Toggle theme                        │
└─────────────────────────────────────────────┘
```

### Search Categories

| Category | Content | Example |
|----------|---------|---------|
| **Recent** | Recently visited pages | Dashboard, Settings |
| **Pages** | All navigable routes | /projects, /settings |
| **Actions** | Quick actions | Create project, Sign out, Toggle theme |

### Keyboard Navigation

| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate results |
| `Enter` | Select highlighted item |
| `Escape` | Close QuickSearch |
| `⌘K` / `Ctrl+K` | Open QuickSearch (global) |

### Component Location

QuickSearch is a **composite component** (see [design/components.md](./design/components.md#quicksearch)):

```
src/lib/components/
├── composites/
│   └── quick-search/
│       ├── QuickSearch.svelte         # Modal + search logic
│       ├── QuickSearchTrigger.svelte  # Sidebar trigger (fake input)
│       ├── QuickSearchItem.svelte     # Result item
│       └── index.ts
```

---

## Sidebar Anatomy

The sidebar is divided into three zones:

```
┌──────────────────────┐
│  🦖 Logo             │  ← Header: Branding
│  🔍 Search...    ⌘K  │  ← Search trigger (opens Spotlight)
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

Z-index values are defined in [design/tokens.md](./design/tokens.md#z-index). Key layers for the app shell:

| Layer | Component |
|-------|-----------|
| `sidebar` | Desktop sidebar rail |
| `fab` | Mobile trigger button |
| `overlay` | Drawer backdrop |
| `drawer` | Mobile sidebar drawer |
| `dropdown` | Nav dropdown menus |

See [design/tokens.md](./design/tokens.md) for the complete stacking context with all layer values.

---

## PageHeader

Per-page header inside the main content area. **Not a global header** — each page optionally includes this component for its title and actions.

### Why No Global Header?

| Global Header | PageHeader (per-page) |
|---------------|----------------------|
| Wastes vertical space | Only where needed |
| One-size-fits-all | Page-specific actions |
| Competes with sidebar | Clean separation |

### Structure

```
┌──────┬─────────────────────────────────────────┐
│      │  ┌───────────────────────────────────┐  │
│      │  │ Breadcrumbs (optional)            │  │
│      │  │ Page Title          [Actions]     │  │ ← PageHeader
│      │  ├───────────────────────────────────┤  │
│ Side │  │                                   │  │
│ bar  │  │  Page content...                  │  │
│      │  │                                   │  │
│      │  └───────────────────────────────────┘  │
│      │  Footer                                 │
└──────┴─────────────────────────────────────────┘
```

### PageHeader Anatomy

```
┌─────────────────────────────────────────────────┐
│  Projects › Project Alpha                       │  ← Breadcrumbs (optional)
│  Project Alpha                    [Edit] [⋮]   │  ← Title + Actions
└─────────────────────────────────────────────────┘
```

| Element | Description |
|---------|-------------|
| **Breadcrumbs** | Optional navigation trail |
| **Title** | Page or resource name |
| **Actions** | Primary actions (buttons, dropdown) |

### Component

```svelte
<!-- src/lib/components/composites/page-header/PageHeader.svelte -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';

  interface Breadcrumb {
    label: string;
    href?: string;
  }

  interface Props {
    title: string;
    breadcrumbs?: Breadcrumb[];
    actions?: Snippet;
    class?: string;
  }

  let { title, breadcrumbs, actions, class: className }: Props = $props();
</script>

<header class={cn('mb-6', className)}>
  {#if breadcrumbs?.length}
    <nav class="mb-2 text-sm text-muted" aria-label="Breadcrumb">
      <ol class="flex items-center gap-1">
        {#each breadcrumbs as crumb, i}
          {#if i > 0}
            <li class="text-muted/50">/</li>
          {/if}
          <li>
            {#if crumb.href}
              <a href={crumb.href} class="hover:text-fg">{crumb.label}</a>
            {:else}
              <span>{crumb.label}</span>
            {/if}
          </li>
        {/each}
      </ol>
    </nav>
  {/if}

  <div class="flex items-center justify-between gap-4">
    <h1 class="text-2xl font-semibold text-fg">{title}</h1>

    {#if actions}
      <div class="flex items-center gap-2">
        {@render actions()}
      </div>
    {/if}
  </div>
</header>
```

### Usage

```svelte
<!-- src/routes/app/projects/[id]/+page.svelte -->
<script>
  import { PageHeader } from '$lib/components/composites';
  import { Button, DropdownMenu } from '$lib/components/primitives';

  let { data } = $props();
</script>

<PageHeader
  title={data.project.name}
  breadcrumbs={[
    { label: 'Projects', href: '/app/projects' },
    { label: data.project.name }
  ]}
>
  {#snippet actions()}
    <Button intent="secondary">Edit</Button>
    <DropdownMenu>
      <DropdownItem>Duplicate</DropdownItem>
      <DropdownItem>Archive</DropdownItem>
      <DropdownItem destructive>Delete</DropdownItem>
    </DropdownMenu>
  {/snippet}
</PageHeader>

<!-- Page content below -->
```

### Sticky Option

For long pages, PageHeader can stick to top on scroll:

```svelte
<PageHeader title="Dashboard" class="sticky top-0 bg-bg z-10" />
```

---

## Related

- [design/tokens.md](./design/tokens.md) - Z-index values and sidebar dimensions defined here
- [state.md](./state.md) - Sidebar state management (open, pinned, toggle)
- [design/styling.md](./design/styling.md) - Responsive breakpoints and fluid spacing
