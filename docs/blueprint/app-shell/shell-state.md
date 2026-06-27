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
│  │ • shortcuts  │   │ • lastFetched│   │ • timezone   │            │
│  │ • sessionExp.│   │              │   │ • a11y       │            │
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

> **SSR Safety:** Never export state at module level. Module-level state is shared across all SSR requests in Node.js. Always use factory functions + context.

```typescript
// src/lib/state/sidebar.svelte.ts
import { browser } from '$app/environment';
import { getContext, setContext } from 'svelte';

interface SidebarState {
  expanded: boolean;     // Rail vs full sidebar (desktop)
  pinned: boolean;       // Stay expanded vs collapse on blur
  mobileOpen: boolean;   // Drawer open (mobile)
}

const STORAGE_KEY = 'sidebar-state';
const SIDEBAR_CTX = Symbol('sidebar');

export function createSidebarState() {
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

// Context helpers for SSR-safe access
export function setSidebarContext() {
  const sidebar = createSidebarState();
  setContext(SIDEBAR_CTX, sidebar);
  return sidebar;
}

export function getSidebar() {
  return getContext<ReturnType<typeof createSidebarState>>(SIDEBAR_CTX);
}
```

### Integration with Breakpoints

```svelte
<script lang="ts">
  import { getSidebar } from '$lib/state/sidebar.svelte';
  import { MediaQuery } from 'svelte/reactivity';

  const sidebar = getSidebar(); // Get from context (SSR-safe)
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

> **SSR Safety:** Theme uses context pattern to avoid module-level state sharing across requests.

```typescript
// src/lib/state/theme.svelte.ts
import { browser } from '$app/environment';
import { getContext, setContext } from 'svelte';

type ThemeMode = 'light' | 'dark' | 'system';
type AccentColor = 'blue' | 'purple' | 'green' | 'orange';

interface ThemeState {
  mode: ThemeMode;
  accent: AccentColor;
  resolvedMode: 'light' | 'dark'; // Computed from mode + system preference
}

const THEME_CTX = Symbol('theme');

export function createThemeState(initial: { mode: ThemeMode; accent: AccentColor }) {
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
      // Persist to DB (async, fire-and-forget)
      fetch('/api/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: mode }),
      });
    },

    setAccent(accent: AccentColor) {
      state.accent = accent;
    },
  };
}

// Context helpers for SSR-safe access
export function setThemeContext(initial: { mode: ThemeMode; accent: AccentColor }) {
  const theme = createThemeState(initial);
  setContext(THEME_CTX, theme);
  return theme;
}

export function getTheme() {
  return getContext<ReturnType<typeof createThemeState>>(THEME_CTX);
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

> **SSR Safety:** Modals are client-only state but still use context pattern for consistency and testability.

```typescript
// src/lib/state/modals.svelte.ts
import { getContext, setContext } from 'svelte';

type ModalId = 'quickSearch' | 'shortcuts' | 'sessionExpiry' | null;

const MODALS_CTX = Symbol('modals');

export function createModalState() {
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

// Context helpers for SSR-safe access
export function setModalsContext() {
  const modals = createModalState();
  setContext(MODALS_CTX, modals);
  return modals;
}

export function getModals() {
  return getContext<ReturnType<typeof createModalState>>(MODALS_CTX);
}
```

### Focus Restoration

```svelte
<script lang="ts">
  import { getModals } from '$lib/state/modals.svelte';

  const modals = getModals(); // Get from context (SSR-safe)

  let triggerRef: HTMLButtonElement;
  let previousFocus: HTMLElement | null = null;

  function openPalette() {
    previousFocus = document.activeElement as HTMLElement;
    modals.open('quickSearch'); // ModalId 'quickSearch' — real shipped identifier
  }

  $effect(() => {
    if (!modals.isOpen('quickSearch') && previousFocus) {
      // Restore focus when modal closes
      previousFocus.focus();
      previousFocus = null;
    }
  });
</script>

<button bind:this={triggerRef} onclick={openPalette}>
  Search
</button>
```

---

## Chatbot Session State

The Vely chatbot is **not** a modal and **not** a context. Its live thread is owned by a deliberate **module singleton**, `src/lib/state/chatbot-session.svelte.ts` (`chatbotSession`), so it survives the chat panel unmounting — on minimize, on navigation, and on the cross-group `AppShell` remount. ESM module caching gives one instance per tab.

| Aspect | Detail |
|--------|--------|
| **Why a singleton, not context/modals** | The `@ai-sdk/svelte` `Chat` + its in-flight stream must outlive the component. It is kept out of the mutually-exclusive `modals` store so a minimized chat coexists with an open quick-search instead of being evicted. |
| **State** | `phase: 'closed' \| 'open' \| 'minimized'`, `chat` (null until first open), `conversationId`, `answerReady` (unread-reply flag) — all `$state`. |
| **SSR safety** | Top-level holds only inert primitives; `@ai-sdk/svelte` + `ai` load via `await import()` inside `ensureChat()` behind a `browser` gate; every mutator is browser-gated. No leak, no hydration mismatch. |
| **Teardown** | Named, not lifecycle-bound: `SessionMonitor` calls `chatbotSession.reset()` on logout/expiry (aborts the stream, clears the per-tab resume pointer). |
| **Resume** | A per-tab `sessionStorage` pointer `{conversationId, userId}` → owner-scoped `GET /api/ai/conversations/[id]` rehydrates messages with zero model calls. |

Full lifecycle and spatial spec: [../ai/persistent-chatbot.md](../ai/persistent-chatbot.md). App-shell view: [./ai-assistant.md](./ai-assistant.md).

---

## Notification Badge State

> **SSR Safety:** Notifications use the context pattern to avoid module-level state sharing.

The store is a minimal unread-count holder. It carries no polling and no fetch — real-time delivery lives in the `SidebarNotifications` consumer (SSE via `/api/notifications/stream`). The store just exposes the count and the mutations consumers call on incoming events.

```typescript
// src/lib/state/notifications.svelte.ts
import { getContext, setContext } from 'svelte';

const NOTIFICATION_CTX = Symbol('notifications');

export function createNotificationState(initialCount = 0) {
  let unreadCount = $state(initialCount);

  return {
    get unreadCount() {
      return unreadCount;
    },
    setCount(count: number) {
      unreadCount = count;
    },
    increment() {
      unreadCount++;
    },
    decrementBy(n: number) {
      unreadCount = Math.max(0, unreadCount - n);
    },
  };
}

// Call in the app layout.
export function setNotificationContext(initialCount = 0) {
  const state = createNotificationState(initialCount);
  setContext(NOTIFICATION_CTX, state);
  return state;
}

// Call in child components.
export function getNotifications() {
  return getContext<ReturnType<typeof createNotificationState>>(NOTIFICATION_CTX);
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

```svelte
<!-- src/routes/(app)/+layout.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { setSidebarContext } from '$lib/state/sidebar.svelte';
  import { setThemeContext } from '$lib/state/theme.svelte';
  import { setModalsContext } from '$lib/state/modals.svelte';
  import { setNotificationContext } from '$lib/state/notifications.svelte';
  import { initKeyboardHandler } from '$lib/shortcuts';

  let { data, children } = $props();

  // Initialize all contexts (SSR-safe, request-scoped)
  // 1. Theme (already applied in app.html, just sync state)
  const theme = setThemeContext({
    mode: data.settings?.theme ?? 'system',
    accent: data.settings?.accentColor ?? 'blue',
  });

  // 2. Sidebar (loads from localStorage on client)
  const sidebar = setSidebarContext();

  // 3. Modals (ephemeral client state)
  const modals = setModalsContext();

  // 4. Notifications (unread-count holder; SSE lives in SidebarNotifications)
  const notifications = setNotificationContext(data.unreadCount ?? 0);

  // 5. Keyboard shortcuts (register handlers)
  onMount(() => {
    return initKeyboardHandler();
  });
</script>

{@render children()}
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
const notifications = getNotifications(); // Get from context
$effect(() => {
  if (!browser) return;

  const handler = () => notifications.decrementBy(1);
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
  import { getSidebar } from '$lib/state/sidebar.svelte';
  import { getTheme } from '$lib/state/theme.svelte';
  import { getModals } from '$lib/state/modals.svelte';
  import { getNotifications } from '$lib/state/notifications.svelte';

  // Get all state from context (SSR-safe)
  const sidebar = getSidebar();
  const theme = getTheme();
  const modals = getModals();
  const notifications = getNotifications();

  let expanded = $state(false);
</script>

{#if dev}
  <div class="fixed bottom-4 right-4 z-debug">
    <button onclick={() => expanded = !expanded} class="btn btn-sm">
      State
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
            count: notifications.unreadCount,
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
src/lib/state/
├── sidebar.svelte.ts            # Sidebar expanded/pinned/mobile state
├── theme.svelte.ts              # Theme mode and accent
├── modals.svelte.ts             # Active modal tracking (quickSearch | shortcuts | sessionExpiry)
├── chatbot-session.svelte.ts    # Vely chatbot live thread (module singleton, NOT a context)
├── notifications.svelte.ts      # Unread count, polling
└── index.ts                     # Exports
```

---

## Related

- [./sidebar.md](./sidebar.md) - Sidebar component behavior
- [./settings.md](./settings.md) - Settings & Preferences
- [./session-lifecycle.md](./session-lifecycle.md) - Session state
- [../state.md](../state.md) - Svelte 5 state patterns
