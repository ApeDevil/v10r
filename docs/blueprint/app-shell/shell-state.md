# Shell State

Orchestration of state across app shell components: sidebar, modals, theme, notifications, and user session.

---

## State Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Shell State                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐            │
│  │   Sidebar    │   │    Theme     │   │   Session    │            │
│  │              │   │              │   │              │            │
│  │ • expanded   │   │ • mode       │   │ • user       │            │
│  │ • pinned     │   │ • accent     │   │ • expiresAt  │            │
│  │ • activeNav  │   │              │   │              │            │
│  └──────────────┘   └──────────────┘   └──────────────┘            │
│         │                  │                  │                     │
│         │                  │                  │                     │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐            │
│  │    Modals    │   │ Notifications│   │  Preferences │            │
│  │              │   │              │   │              │            │
│  │ • quickSearch│   │ • unreadCount│   │ • locale     │            │
│  │ • aiAssistant│   │ • lastFetched│   │ • timezone   │            │
│  │ • shortcuts  │   │              │   │ • a11y       │            │
│  └──────────────┘   └──────────────┘   └──────────────┘            │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## State Categories

| Category | Scope | Persistence | Source |
|----------|-------|-------------|--------|
| **Sidebar** | Client | localStorage | User interaction |
| **Theme** | Client + Cookie | Cookie + DB | User preference |
| **Session** | Server → Client | Cookie | Better Auth |
| **Modals** | Client | None (ephemeral) | User interaction |
| **Notifications** | Server → Client | None | Polling/SSE |
| **Preferences** | Server → Client | DB | User settings |

---

## Sidebar State

### State Definition

```typescript
// src/lib/stores/sidebar.svelte.ts
import { browser } from '$app/environment';

interface SidebarState {
  expanded: boolean;     // Rail vs full sidebar (desktop)
  pinned: boolean;       // Stay expanded vs collapse on blur
  mobileOpen: boolean;   // Drawer open (mobile)
}

const STORAGE_KEY = 'sidebar-state';

function createSidebarState() {
  // Load from localStorage
  const stored = browser ? localStorage.getItem(STORAGE_KEY) : null;
  const initial: SidebarState = stored
    ? JSON.parse(stored)
    : { expanded: false, pinned: false, mobileOpen: false };

  let state = $state<SidebarState>(initial);

  // Persist on change
  $effect(() => {
    if (browser) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        expanded: state.expanded,
        pinned: state.pinned,
        // Don't persist mobileOpen
      }));
    }
  });

  return {
    get expanded() { return state.expanded; },
    get pinned() { return state.pinned; },
    get mobileOpen() { return state.mobileOpen; },

    expand() { state.expanded = true; },
    collapse() { if (!state.pinned) state.expanded = false; },
    togglePin() { state.pinned = !state.pinned; },

    openMobile() { state.mobileOpen = true; },
    closeMobile() { state.mobileOpen = false; },
    toggleMobile() { state.mobileOpen = !state.mobileOpen; },
  };
}

export const sidebar = createSidebarState();
```

### Integration with Breakpoints

```svelte
<script lang="ts">
  import { sidebar } from '$lib/stores/sidebar.svelte';
  import { MediaQuery } from 'svelte/reactivity';

  const isDesktop = new MediaQuery('(min-width: 1024px)');

  // Auto-close mobile drawer on resize to desktop
  $effect(() => {
    if (isDesktop.matches && sidebar.mobileOpen) {
      sidebar.closeMobile();
    }
  });
</script>
```

---

## Theme State

### State Definition

```typescript
// src/lib/stores/theme.svelte.ts
import { browser } from '$app/environment';

type ThemeMode = 'light' | 'dark' | 'system';
type AccentColor = 'blue' | 'purple' | 'green' | 'orange';

interface ThemeState {
  mode: ThemeMode;
  accent: AccentColor;
  resolvedMode: 'light' | 'dark'; // Computed from mode + system preference
}

function createThemeState(initial: { mode: ThemeMode; accent: AccentColor }) {
  let state = $state<ThemeState>({
    mode: initial.mode,
    accent: initial.accent,
    resolvedMode: 'light',
  });

  // Resolve system preference
  $effect(() => {
    if (!browser) return;

    if (state.mode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      state.resolvedMode = mediaQuery.matches ? 'dark' : 'light';

      const handler = (e: MediaQueryListEvent) => {
        state.resolvedMode = e.matches ? 'dark' : 'light';
      };
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    } else {
      state.resolvedMode = state.mode;
    }
  });

  // Apply to DOM
  $effect(() => {
    if (!browser) return;
    document.documentElement.classList.toggle('dark', state.resolvedMode === 'dark');
    document.documentElement.dataset.accent = state.accent;
  });

  return {
    get mode() { return state.mode; },
    get accent() { return state.accent; },
    get resolvedMode() { return state.resolvedMode; },
    get isDark() { return state.resolvedMode === 'dark'; },

    setMode(mode: ThemeMode) {
      state.mode = mode;
      // Persist to cookie (for SSR)
      document.cookie = `theme=${mode};path=/;max-age=31536000;SameSite=Lax`;
      // Persist to DB (async)
      fetch('/api/user/preferences', {
        method: 'PATCH',
        body: JSON.stringify({ theme: mode }),
      });
    },

    setAccent(accent: AccentColor) {
      state.accent = accent;
      fetch('/api/user/preferences', {
        method: 'PATCH',
        body: JSON.stringify({ accentColor: accent }),
      });
    },
  };
}

// Initialized from server data in +layout.svelte
export let theme: ReturnType<typeof createThemeState>;

export function initTheme(initial: { mode: ThemeMode; accent: AccentColor }) {
  theme = createThemeState(initial);
  return theme;
}
```

### SSR Hydration (No Flash)

```html
<!-- app.html - Inline script runs before body renders -->
<script>
  (function() {
    const theme = document.cookie.match(/theme=(\w+)/)?.[1] ?? 'system';
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = theme === 'dark' || (theme === 'system' && prefersDark);
    if (isDark) document.documentElement.classList.add('dark');
  })();
</script>
```

---

## Modal State

### Mutual Exclusion

Only one modal can be open at a time. Opening one closes others.

```typescript
// src/lib/stores/modals.svelte.ts
type ModalId = 'quickSearch' | 'aiAssistant' | 'shortcuts' | 'sessionExpiry' | null;

function createModalState() {
  let activeModal = $state<ModalId>(null);
  let modalData = $state<Record<string, unknown>>({});

  return {
    get active() { return activeModal; },

    isOpen(id: ModalId) {
      return activeModal === id;
    },

    open(id: ModalId, data?: Record<string, unknown>) {
      activeModal = id;
      if (data) modalData = data;
    },

    close() {
      activeModal = null;
      modalData = {};
    },

    getData<T>(key: string): T | undefined {
      return modalData[key] as T;
    },
  };
}

export const modals = createModalState();
```

### Focus Restoration

```svelte
<script lang="ts">
  import { modals } from '$lib/stores/modals.svelte';

  let triggerRef: HTMLButtonElement;
  let previousFocus: HTMLElement | null = null;

  function openQuickSearch() {
    previousFocus = document.activeElement as HTMLElement;
    modals.open('quickSearch');
  }

  $effect(() => {
    if (!modals.isOpen('quickSearch') && previousFocus) {
      // Restore focus when modal closes
      previousFocus.focus();
      previousFocus = null;
    }
  });
</script>

<button bind:this={triggerRef} onclick={openQuickSearch}>
  Search
</button>
```

---

## Notification Badge State

### Polling Pattern

```typescript
// src/lib/stores/notifications.svelte.ts
import { browser } from '$app/environment';

function createNotificationState(initialCount: number) {
  let unreadCount = $state(initialCount);
  let lastFetched = $state(Date.now());

  // Poll every 30 seconds
  $effect(() => {
    if (!browser) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/notifications/unread-count');
        const { count } = await res.json();
        unreadCount = count;
        lastFetched = Date.now();
      } catch (error) {
        console.error('Failed to fetch notification count');
      }
    }, 30_000);

    return () => clearInterval(interval);
  });

  return {
    get count() { return unreadCount; },
    get lastFetched() { return lastFetched; },

    // Optimistic update when marking as read
    decrement() {
      unreadCount = Math.max(0, unreadCount - 1);
    },

    // Force refresh
    async refresh() {
      const res = await fetch('/api/notifications/unread-count');
      const { count } = await res.json();
      unreadCount = count;
      lastFetched = Date.now();
    },
  };
}

export let notifications: ReturnType<typeof createNotificationState>;

export function initNotifications(count: number) {
  notifications = createNotificationState(count);
  return notifications;
}
```

---

## Session State

Session is **server-authoritative**. Client receives session data from load functions.

```typescript
// src/routes/(app)/+layout.server.ts
export const load = async ({ locals }) => {
  return {
    user: locals.user,
    session: locals.session,
  };
};
```

```svelte
<!-- src/routes/(app)/+layout.svelte -->
<script lang="ts">
  import { setContext } from 'svelte';

  let { data, children } = $props();

  // Make session available to all child components
  setContext('user', () => data.user);
  setContext('session', () => data.session);
</script>
```

**Important:** Never store session in module-level state. Always use `event.locals` on server and context/props on client.

---

## State Initialization Order

Shell initialization happens in a specific order to prevent flashes and ensure dependencies:

```typescript
// src/routes/(app)/+layout.svelte
<script lang="ts">
  import { initTheme } from '$lib/stores/theme.svelte';
  import { initNotifications } from '$lib/stores/notifications.svelte';
  import { initKeyboardHandler } from '$lib/shortcuts';

  let { data, children } = $props();

  // 1. Theme (already applied in app.html, just sync state)
  const theme = initTheme({
    mode: data.settings?.theme ?? 'system',
    accent: data.settings?.accentColor ?? 'blue',
  });

  // 2. Notifications (start polling)
  const notifications = initNotifications(data.unreadCount ?? 0);

  // 3. Keyboard shortcuts (register handlers)
  onMount(() => {
    return initKeyboardHandler();
  });

  // 4. Sidebar state (loads from localStorage automatically)
  // Already initialized at module level
</script>
```

---

## Cross-Component Communication

### Event-Based Updates

When one component needs to trigger updates in another:

```typescript
// Option 1: Svelte 5 reactive state (preferred)
// Components import and react to shared state

// Option 2: Custom events for decoupled components
import { createEventDispatcher } from 'svelte';

// In notification card
function markAsRead() {
  // Update local state
  notification.read = true;

  // Notify sidebar badge
  window.dispatchEvent(new CustomEvent('notification:read'));
}

// In sidebar
$effect(() => {
  if (!browser) return;

  const handler = () => notifications.decrement();
  window.addEventListener('notification:read', handler);
  return () => window.removeEventListener('notification:read', handler);
});
```

### Data Flow Diagram

```
Server (load functions)
         │
         ▼
┌─────────────────────────────────────┐
│   +layout.svelte (root)             │
│   • Receives: user, session,        │
│     settings, unreadCount           │
│   • Initializes: theme, notifications│
│   • Provides: context               │
└─────────────────────────────────────┘
         │
         ├───────────────┬──────────────┐
         ▼               ▼              ▼
    ┌─────────┐    ┌─────────┐    ┌─────────┐
    │ Sidebar │    │ Content │    │ Modals  │
    │         │    │         │    │         │
    │ Reads:  │    │ Reads:  │    │ Reads:  │
    │ • user  │    │ • page  │    │ • modals│
    │ • notif │    │   data  │    │ • theme │
    │ • theme │    │         │    │         │
    └─────────┘    └─────────┘    └─────────┘
         │
         │ (user action)
         ▼
    localStorage / API
```

---

## Debugging State

Add a debug panel in development:

```svelte
<!-- src/lib/components/dev/StateDebugger.svelte -->
<script lang="ts">
  import { dev } from '$app/environment';
  import { sidebar } from '$lib/stores/sidebar.svelte';
  import { theme } from '$lib/stores/theme.svelte';
  import { modals } from '$lib/stores/modals.svelte';
  import { notifications } from '$lib/stores/notifications.svelte';

  let expanded = $state(false);
</script>

{#if dev}
  <div class="fixed bottom-4 right-4 z-debug">
    <button onclick={() => expanded = !expanded} class="btn btn-sm">
      🔧 State
    </button>

    {#if expanded}
      <div class="bg-surface border rounded-lg p-4 mt-2 text-xs font-mono">
        <pre>{JSON.stringify({
          sidebar: {
            expanded: sidebar.expanded,
            pinned: sidebar.pinned,
            mobileOpen: sidebar.mobileOpen,
          },
          theme: {
            mode: theme.mode,
            resolved: theme.resolvedMode,
          },
          modals: {
            active: modals.active,
          },
          notifications: {
            count: notifications.count,
          },
        }, null, 2)}</pre>
      </div>
    {/if}
  </div>
{/if}
```

---

## Component Location

```
src/lib/stores/
├── sidebar.svelte.ts      # Sidebar expanded/pinned/mobile state
├── theme.svelte.ts        # Theme mode and accent
├── modals.svelte.ts       # Active modal tracking
├── notifications.svelte.ts # Unread count, polling
└── index.ts               # Exports
```

---

## Related

- [./sidebar.md](./sidebar.md) - Sidebar component behavior
- [./settings.md](./settings.md) - User preferences
- [./session-lifecycle.md](./session-lifecycle.md) - Session state
- [../state.md](../state.md) - Svelte 5 state patterns
