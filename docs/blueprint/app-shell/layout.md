# Layout

The app shell layout, breakpoints, z-index layers, and accessibility requirements.

---

## Shell Structure

| Component | Description |
|-----------|-------------|
| **Sidebar** | Primary navigation, collapsible |
| **Main** | Page content area (`{@render children()}`) |
| **Footer** | Persistent footer inside main content area |

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

Semantic breakpoints map to design token values (see [../design/tokens.md](../design/tokens.md#breakpoints)):

| Semantic | Token Range | Pixel Range | Sidebar Behavior |
|----------|-------------|-------------|------------------|
| **Mobile** | `< md` | 0 - 767px | Right drawer + FAB |
| **Tablet** | `md` to `< lg` | 768px - 1023px | Left rail, click to expand |
| **Desktop** | `≥ lg` | 1024px+ | Left rail, hover to expand |

> **Mobile-first**: Base styles target mobile. Use `md:` and `lg:` UnoCSS prefixes to progressively enhance.

---

## Z-Index Layers

Z-index values are defined in [../design/tokens.md](../design/tokens.md#z-index). Key layers for the app shell:

| Layer | Component |
|-------|-----------|
| `sidebar` | Desktop sidebar rail |
| `fab` | Mobile trigger button |
| `overlay` | Drawer backdrop |
| `drawer` | Mobile sidebar drawer |
| `dropdown` | Nav dropdown menus |

See [../design/tokens.md](../design/tokens.md) for the complete stacking context with all layer values.

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

## Tablet-Specific Patterns

Tablets (768px - 1024px) require hybrid treatment: touchable like mobile, but with desktop-like layout.

### Sidebar Behavior

| Aspect | Mobile | Tablet | Desktop |
|--------|--------|--------|---------|
| **Sidebar type** | Drawer (overlay) | Rail (persistent) | Rail (persistent) |
| **Expansion** | Full screen drawer | Click to expand | Hover to expand |
| **Touch targets** | 44px minimum | 44px minimum | 36px minimum |
| **Trigger** | FAB button | Rail icons | Rail icons |

### Why Click-to-Expand on Tablet?

- Touch devices don't have hover
- Prevents accidental expansion while scrolling
- More predictable behavior

```svelte
<script lang="ts">
  import { MediaQuery } from 'svelte/reactivity';

  const isTouch = new MediaQuery('(hover: none)');
  const isTablet = new MediaQuery('(min-width: 768px) and (max-width: 1024px)');

  function handleMouseEnter() {
    // Only hover-expand on non-touch desktop devices
    if (!isTouch.matches && !isTablet.matches) {
      sidebar.expand();
    }
  }

  function handleClick() {
    // Click-to-toggle on tablet and touch devices
    if (isTouch.matches || isTablet.matches) {
      sidebar.expanded ? sidebar.collapse() : sidebar.expand();
    }
  }
</script>
```

### Content Grid Adjustments

```css
/* Mobile: single column */
@media (max-width: 767px) {
  .content-grid { grid-template-columns: 1fr; }
}

/* Tablet: 2 columns, account for rail */
@media (min-width: 768px) and (max-width: 1024px) {
  .content-grid {
    grid-template-columns: repeat(2, 1fr);
    padding-left: calc(var(--sidebar-rail-width) + 1rem);
  }
}

/* Desktop: 3+ columns */
@media (min-width: 1025px) {
  .content-grid {
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    padding-left: calc(var(--sidebar-rail-width) + 1rem);
  }
}
```

---

## Breakpoint Transitions

What happens when viewport resizes across breakpoints:

### Mobile → Tablet

| State | Behavior |
|-------|----------|
| Drawer was open | Close drawer, show rail |
| Drawer was closed | Show rail |

### Tablet → Desktop

| State | Behavior |
|-------|----------|
| Sidebar pinned | Keep expanded |
| Sidebar collapsed | Stay as rail, hover-expand now works |

### Desktop → Tablet/Mobile

| State | Behavior |
|-------|----------|
| Sidebar expanded | Collapse to rail (tablet) or hide (mobile) |
| Sidebar pinned | Unpin, collapse |

```svelte
<script lang="ts">
  import { MediaQuery } from 'svelte/reactivity';
  import { sidebar } from '$lib/stores/sidebar.svelte';

  const isMobile = new MediaQuery('(max-width: 767px)');
  const isDesktop = new MediaQuery('(min-width: 1025px)');

  // Handle breakpoint transitions
  $effect(() => {
    if (isMobile.matches) {
      // Mobile: close drawer if was open, reset sidebar state
      sidebar.closeMobile();
      sidebar.collapse();
    }
  });

  $effect(() => {
    if (!isDesktop.matches && sidebar.pinned) {
      // Leaving desktop: unpin to prevent stuck expanded state
      sidebar.unpin();
      sidebar.collapse();
    }
  });
</script>
```

---

## Focus Management

Proper focus handling across shell components.

### Modal Focus Flow

When modals open/close, focus must be managed:

```
[Trigger] → click → [Modal opens] → focus first focusable
                                          ↓
                                    [Modal closes]
                                          ↓
                                    [Return focus to trigger]
```

### Implementation

```svelte
<script lang="ts">
  let triggerRef: HTMLElement;
  let previousFocus: HTMLElement | null = null;

  function openModal() {
    previousFocus = document.activeElement as HTMLElement;
    isOpen = true;
  }

  function closeModal() {
    isOpen = false;
    // Restore focus after DOM update
    tick().then(() => {
      previousFocus?.focus();
      previousFocus = null;
    });
  }
</script>
```

### Focus Trap for Modals/Drawers

```svelte
<script lang="ts">
  import { trapFocus } from '$lib/utils/focus-trap';

  let modalRef: HTMLElement;

  $effect(() => {
    if (isOpen && modalRef) {
      const cleanup = trapFocus(modalRef);
      return cleanup;
    }
  });
</script>

<div bind:this={modalRef} class="modal">
  <!-- Modal content -->
</div>
```

```typescript
// src/lib/utils/focus-trap.ts
export function trapFocus(container: HTMLElement): () => void {
  const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  const focusableElements = container.querySelectorAll<HTMLElement>(focusableSelector);
  const first = focusableElements[0];
  const last = focusableElements[focusableElements.length - 1];

  // Focus first element
  first?.focus();

  function handleKeydown(e: KeyboardEvent) {
    if (e.key !== 'Tab') return;

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  }

  container.addEventListener('keydown', handleKeydown);
  return () => container.removeEventListener('keydown', handleKeydown);
}
```

### Skip Link

First focusable element should be a skip link:

```svelte
<!-- AppShell.svelte -->
<a href="#main-content" class="skip-link">
  Skip to main content
</a>

<Sidebar />

<main id="main-content" tabindex="-1">
  {@render children()}
</main>

<style>
  .skip-link {
    position: absolute;
    top: -100%;
    left: 0;
    padding: 0.5rem 1rem;
    background: var(--color-primary);
    color: white;
    z-index: 9999;
  }

  .skip-link:focus {
    top: 0;
  }
</style>
```

### Route Change Announcements

Announce page changes for screen readers:

```svelte
<script lang="ts">
  import { page } from '$app/state';
  import { afterNavigate } from '$app/navigation';

  let announcement = $state('');

  afterNavigate(({ to }) => {
    // Announce new page
    const title = document.title || to?.url.pathname;
    announcement = `Navigated to ${title}`;

    // Focus main content
    document.getElementById('main-content')?.focus();
  });
</script>

<div role="status" aria-live="polite" class="sr-only">
  {announcement}
</div>
```

---

## Related

- [./sidebar.md](./sidebar.md) - Detailed sidebar behavior
- [./shell-state.md](./shell-state.md) - State management
- [../design/tokens.md](../design/tokens.md) - Breakpoint and z-index values
