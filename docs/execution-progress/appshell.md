# Blueprint App Shell Implementation

Complete documentation of the production-grade app shell implemented in 7 phases.

## Overview

The blueprint app shell provides a reference implementation of:
- **Responsive shell** - Desktop sidebar rail, tablet hover/click, mobile drawer + FAB
- **Session lifecycle** - Auto-countdown, warning banner, OTP re-auth modal
- **Keyboard navigation** - Global shortcuts, dropdown navigation, help modal
- **SSR-safe state** - Context-based stores, no client-only assumptions
- **Accessibility** - Focus traps, ARIA labels, keyboard-first design

## File Structure

```
src/lib/
├── components/
│   ├── shell/              # Phase 2-4: Core shell components
│   │   ├── AppShell.svelte
│   │   ├── Sidebar.svelte
│   │   ├── SidebarRail.svelte
│   │   ├── SidebarDrawer.svelte
│   │   ├── SidebarFab.svelte
│   │   ├── SidebarLogo.svelte
│   │   ├── SidebarNav.svelte
│   │   ├── SidebarTriggers.svelte
│   │   ├── Footer.svelte
│   │   ├── ToastContainer.svelte
│   │   ├── NavigationProgress.svelte
│   │   ├── NavItem.svelte
│   │   ├── NavDropdown.svelte
│   │   ├── UserMenu.svelte
│   │   ├── ShortcutsModal.svelte
│   │   ├── SessionMonitor.svelte
│   │   ├── SessionWarningBanner.svelte
│   │   ├── SessionExpiryModal.svelte
│   │   └── index.ts
│   ├── composites/         # Phase 7: Composite components
│   │   ├── PageHeader.svelte
│   │   └── index.ts
│   └── ui/                 # Phase 7: UI primitives
│       ├── Skeleton.svelte
│       ├── SkeletonText.svelte
│       ├── SkeletonCard.svelte
│       ├── SkeletonAvatar.svelte
│       ├── EmptyState.svelte
│       └── index.ts
├── stores/                 # Phase 1: State management
│   ├── sidebar.svelte.ts
│   ├── theme.svelte.ts
│   ├── modals.svelte.ts
│   ├── toast.svelte.ts
│   └── session.svelte.ts   # Phase 6
├── shortcuts/              # Phase 5: Keyboard system
│   ├── platform.ts
│   ├── registry.ts
│   └── handler.ts
└── utils/                  # Phase 0: Foundation
    ├── cn.ts
    └── focus-trap.ts

src/routes/
└── showcases/
    └── blueprint/
        ├── +page.svelte    # Demo page
        └── +page.server.ts # Mock API endpoints
```

## Phase Breakdown

### Phase 0: Foundation

**Files:**
- `src/lib/utils/cn.ts` - Class name utility (clsx + tailwind-merge)
- `src/lib/utils/focus-trap.ts` - Focus trap for modals/drawers
- Component index files for barrel exports

**Purpose:** Utilities required by all subsequent phases.

### Phase 1: State Management

**Files:**
- `src/lib/stores/sidebar.svelte.ts`
- `src/lib/stores/theme.svelte.ts`
- `src/lib/stores/modals.svelte.ts`
- `src/lib/stores/toast.svelte.ts`

**Pattern:** SSR-safe context-based stores using Svelte 5 runes.

**Key states:**
- **Sidebar:** `expanded`, `pinned`, `mobileOpen`
- **Theme:** `mode`, `accent`, `resolvedMode` (handles system preference)
- **Modals:** `activeModal`, `modalData` (generic modal system)
- **Toast:** Notifications using `SvelteMap` for reactivity

**Why context-based:** Avoids hydration mismatches, supports multiple instances per page.

### Phase 2: Core Shell Structure

**Files:**
- `AppShell.svelte` - Root wrapper with skip link
- `Sidebar.svelte` - Orchestrates rail vs drawer based on breakpoint
- `SidebarRail.svelte` - Desktop sidebar (hover-to-expand on desktop, click on tablet)
- `SidebarDrawer.svelte` - Mobile drawer (right-side overlay)
- `SidebarFab.svelte` - Mobile FAB trigger (bottom-right)
- `Footer.svelte` - Page footer

**Breakpoints:**
- **Mobile:** <768px - Drawer + FAB
- **Tablet:** 768-1023px - Rail (click to toggle)
- **Desktop:** 1024px+ - Rail (hover to expand)

**Behavior:**
- Rail collapses to icons, expands on hover/click
- Drawer slides in from right on mobile
- FAB positioned bottom-right with menu icon

### Phase 3: Shell Internals

**Files:**
- `SidebarLogo.svelte` - Logo (icon-only when collapsed, icon+text when expanded)
- `SidebarNav.svelte` - Navigation container with active state highlighting
- `SidebarTriggers.svelte` - Quick actions (⌘K search, ⌘J AI assistant)
- `ToastContainer.svelte` - Toast notifications (top-right, max 5, auto-dismiss 5s)
- `NavigationProgress.svelte` - Progress bar during page transitions

**Features:**
- Logo adapts to sidebar width
- Active route highlighting in nav
- Toast queue management with auto-dismiss
- Progress bar shows during SvelteKit navigation

### Phase 4: Navigation Components

**Files:**
- `NavItem.svelte` - Compound button (main area navigates, chevron toggles dropdown)
- `NavDropdown.svelte` - Submenu with keyboard navigation (↑↓ arrows, Enter, Esc)
- `UserMenu.svelte` - Avatar dropdown (Profile, Settings, Theme switcher, Sign out)

**Navigation structure:**
- Home
- Showcases (dropdown)
  - Blueprint
  - Auth Flow
  - [other showcases]
- Docs (dropdown)
  - Getting Started
  - Architecture
  - [other docs]

**Compound button pattern:**
- Clicking main area navigates immediately
- Clicking chevron opens/closes dropdown
- Dropdown stays open while hovering/focused

### Phase 5: Keyboard & Accessibility

**Files:**
- `src/lib/shortcuts/platform.ts` - Platform detection (⌘ on Mac, Ctrl on others)
- `src/lib/shortcuts/registry.ts` - Shortcut registration system
- `src/lib/shortcuts/handler.ts` - Global keyboard event handler
- `ShortcutsModal.svelte` - Help modal showing all shortcuts

**Default shortcuts:**
- `⌘K` - Open quick search
- `⌘J` - Open AI assistant
- `?` - Show shortcuts help
- `Esc` - Close active modal/drawer
- `g h` - Go to home (sequence)
- `g s` - Go to showcases
- `g d` - Go to docs

**Features:**
- Platform-aware display (⌘ vs Ctrl)
- Sequence support (press keys in order)
- Visual help modal with grouped shortcuts
- Focus management for modals/drawers

### Phase 6: Session Lifecycle

**Files:**
- `src/lib/stores/session.svelte.ts` - Session state with auto-countdown
- `SessionMonitor.svelte` - Orchestrates lifecycle components
- `SessionWarningBanner.svelte` - Warning banner when <5 minutes remaining
- `SessionExpiryModal.svelte` - OTP re-auth modal (preserves form state)

**Mock API endpoints (showcases/blueprint):**
- `POST /api/session/extend` - Extend session
- `POST /api/session/send-code` - Send OTP
- `POST /api/session/verify` - Verify OTP and refresh session

**Session states:**
1. **Valid** - Normal operation
2. **Warning** - <5 minutes remaining, banner shown
3. **Expired** - Modal shown, OTP re-auth required
4. **Revoked** - Server-side revocation, redirect to login

**Features:**
- Auto-countdown from `expiresAt` timestamp
- Warning banner with "Extend Session" button
- OTP re-auth modal to refresh without losing form state
- State preservation during re-auth

### Phase 7: Composites & UI Primitives

**Composites (`src/lib/components/composites/`):**
- `PageHeader.svelte` - Per-page header with breadcrumbs, title, actions slot

**UI Primitives (`src/lib/components/ui/`):**
- `Skeleton.svelte` - Base skeleton with CSS shimmer animation
- `SkeletonText.svelte` - Multi-line text placeholder
- `SkeletonCard.svelte` - Card-shaped placeholder
- `SkeletonAvatar.svelte` - Circular avatar (sizes: sm, md, lg)
- `EmptyState.svelte` - Empty state with icon, title, description, action slot

**Usage:**
- PageHeader provides consistent page structure
- Skeletons for loading states
- EmptyState for zero-data scenarios

## Key Patterns

### SSR-Safe Context Stores

All stores use context-based initialization to avoid hydration mismatches:

```svelte
// In root layout or AppShell
<script>
  import { initSidebarStore } from '$lib/stores/sidebar.svelte';
  initSidebarStore();
</script>

// In any component
<script>
  import { getSidebarStore } from '$lib/stores/sidebar.svelte';
  const sidebar = getSidebarStore();
</script>
```

**Benefits:**
- No client-only assumptions
- Supports multiple instances
- Avoids hydration errors

### Responsive Breakpoint Handling

Media queries detect breakpoint changes, store updates trigger re-renders:

```typescript
$effect(() => {
  const desktop = window.matchMedia('(min-width: 1024px)');
  const tablet = window.matchMedia('(min-width: 768px) and (max-width: 1023px)');

  const updateBreakpoint = () => {
    if (desktop.matches) state.breakpoint = 'desktop';
    else if (tablet.matches) state.breakpoint = 'tablet';
    else state.breakpoint = 'mobile';
  };

  updateBreakpoint();
  desktop.addEventListener('change', updateBreakpoint);
  // cleanup
});
```

### Compound Button Pattern

NavItem uses a compound button for dropdown navigation:

```svelte
<button onclick={navigate}>
  <Icon />
  <span>Label</span>
</button>

{#if hasDropdown}
  <button onclick={toggleDropdown} aria-label="Toggle dropdown">
    <ChevronIcon />
  </button>
{/if}
```

**UX:**
- Click main area → navigate immediately
- Click chevron → toggle dropdown
- Keyboard: Tab focuses, Enter activates, ↑↓ navigates dropdown

### Toast Queue Management

Toast store uses `SvelteMap` for reactive queue:

```typescript
const toasts = new SvelteMap<string, Toast>();

function add(toast: Toast) {
  const id = crypto.randomUUID();
  toasts.set(id, { ...toast, id });

  if (toast.duration !== Infinity) {
    setTimeout(() => toasts.delete(id), toast.duration);
  }
}
```

**Features:**
- Max 5 visible toasts
- Auto-dismiss after 5 seconds (configurable)
- Manual dismiss via close button

### Session Countdown

Session store calculates `timeRemaining` reactively:

```typescript
let state = $state({
  expiresAt: Date.now() + 30 * 60 * 1000, // 30 min
  status: 'valid'
});

const timeRemaining = $derived(
  state.expiresAt - Date.now()
);

const isWarning = $derived(
  timeRemaining < 5 * 60 * 1000 && state.status === 'valid'
);

// In SessionMonitor, $effect updates every second
$effect(() => {
  const interval = setInterval(() => {
    if (timeRemaining < 0 && session.status === 'valid') {
      session.status = 'expired';
    }
  }, 1000);

  return () => clearInterval(interval);
});
```

## Demo Page

**Location:** `/showcases/blueprint`

**Features:**
- Interactive demo of all shell components
- Toggle sidebar modes (pinned/unpinned)
- Trigger toasts with different types
- Test keyboard shortcuts
- Simulate session warning/expiry
- View all skeleton variants
- Test empty states

**Mock API:** Server endpoints in `+page.server.ts` simulate session extension and OTP verification.

## Integration

To use the app shell in a project:

1. **Wrap your app:**
   ```svelte
   <!-- src/routes/+layout.svelte -->
   <script>
     import { AppShell } from '$lib/components/shell';
   </script>

   <AppShell>
     <slot />
   </AppShell>
   ```

2. **Use stores in components:**
   ```svelte
   <script>
     import { getToastStore } from '$lib/stores/toast.svelte';
     const toast = getToastStore();

     function notify() {
       toast.add({ type: 'success', message: 'Saved!' });
     }
   </script>
   ```

3. **Register shortcuts:**
   ```typescript
   import { registerShortcut } from '$lib/shortcuts/registry';

   registerShortcut({
     key: 's',
     meta: true,
     handler: () => { /* save */ },
     description: 'Save changes'
   });
   ```

## File Paths

All implementation files:

- `/home/ad/dev/velociraptor/src/lib/utils/cn.ts`
- `/home/ad/dev/velociraptor/src/lib/utils/focus-trap.ts`
- `/home/ad/dev/velociraptor/src/lib/stores/sidebar.svelte.ts`
- `/home/ad/dev/velociraptor/src/lib/stores/theme.svelte.ts`
- `/home/ad/dev/velociraptor/src/lib/stores/modals.svelte.ts`
- `/home/ad/dev/velociraptor/src/lib/stores/toast.svelte.ts`
- `/home/ad/dev/velociraptor/src/lib/stores/session.svelte.ts`
- `/home/ad/dev/velociraptor/src/lib/shortcuts/platform.ts`
- `/home/ad/dev/velociraptor/src/lib/shortcuts/registry.ts`
- `/home/ad/dev/velociraptor/src/lib/shortcuts/handler.ts`
- `/home/ad/dev/velociraptor/src/lib/components/shell/*.svelte` (18 components)
- `/home/ad/dev/velociraptor/src/lib/components/composites/PageHeader.svelte`
- `/home/ad/dev/velociraptor/src/lib/components/ui/Skeleton*.svelte` (4 variants)
- `/home/ad/dev/velociraptor/src/lib/components/ui/EmptyState.svelte`
- `/home/ad/dev/velociraptor/src/routes/showcases/blueprint/+page.svelte`
- `/home/ad/dev/velociraptor/src/routes/showcases/blueprint/+page.server.ts`
