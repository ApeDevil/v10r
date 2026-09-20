# Shell State

Orchestration of state across app shell components: sidebar, modals, theme, toasts, and user session.

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
│  │ • pinned     │   │ • resolved   │   │ • expiresAt  │            │
│  │ • activeNav  │   │              │   │              │            │
│  └──────────────┘   └──────────────┘   └──────────────┘            │
│         │                  │                  │                     │
│         │                  │                  │                     │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐            │
│  │    Modals    │   │    Toast     │   │  Preferences │            │
│  │              │   │              │   │              │            │
│  │ • quickSearch│   │ • queue      │   │ • locale     │            │
│  │ • shortcuts  │   │              │   │ • timezone   │            │
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
  const isDesktop = new MediaQuery('(min-width: 1024px)', true);

  // Auto-close mobile drawer on resize to desktop
  $effect(() => {
    if (isDesktop.current && sidebar.mobileOpen) {
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
import { getContext, setContext } from 'svelte';
import { browser } from '$app/environment';
import { apiFetch } from '$lib/api';
import type { Theme } from '$lib/types/db-enums';
import { setCookie } from '$lib/utils/cookies';

type ThemeMode = Theme;
interface ThemeState {
  mode: ThemeMode;
  resolvedMode: 'light' | 'dark'; // Computed from mode + system preference
}

const THEME_CTX = Symbol('theme');

/**
 * Create theme state instance.
 * @param initial - Initial theme settings from server
 */
export function createThemeState(initial: { mode: ThemeMode }) {
  const state = $state<ThemeState>({
    mode: initial.mode,
    resolvedMode: 'light',
  });

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

  $effect(() => {
    if (!browser) return;
    document.documentElement.classList.toggle('dark', state.resolvedMode === 'dark');
  });

  return {
    get mode() {
      return state.mode;
    },
    get resolvedMode() {
      return state.resolvedMode;
    },
    get isDark() {
      return state.resolvedMode === 'dark';
    },

    setMode(mode: ThemeMode) {
      state.mode = mode;
      if (browser) {
        setCookie('theme', mode, { maxAge: 31536000 });
        // Fire-and-forget DB persistence for authenticated users
        apiFetch('/api/preferences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ theme: mode }),
        }).catch(() => {});
      }
    },
  };
}

/**
 * Set theme context in component tree.
 * Call this in root layout with initial values from load function.
 */
export function setThemeContext(initial: { mode: ThemeMode }) {
  const theme = createThemeState(initial);
  setContext(THEME_CTX, theme);
  return theme;
}

/**
 * Get theme state from context.
 * Use this in child components.
 */
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


## Session State

Session is **server-authoritative**. Client receives session data from load functions.

```typescript
// src/routes/[[locale=locale]]/account/+layout.server.ts
export const load: LayoutServerLoad = async ({ locals, url }) => {
  const { user } = requireAuth(locals, url.pathname + url.search);
  return { user };
};
```

```svelte
<!-- src/lib/components/shell/AppShell.svelte -->
<script lang="ts">
  import { setSessionContext } from '$lib/state/session.svelte';

  let { session, children } = $props();

  // Make the session available to every shell child via getSession()
  setSessionContext(session);
</script>
```

**Important:** Never store session in module-level state. Always use `event.locals` on server and context/props on client.

---

## State Initialization Order

Shell initialization happens in a specific order to prevent flashes and ensure dependencies:

```svelte
<!-- src/routes/[[locale=locale]]/+layout.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { setSidebarContext } from '$lib/state/sidebar.svelte';
  import { setThemeContext } from '$lib/state/theme.svelte';
  import { setModalsContext } from '$lib/state/modals.svelte';
  import { setToastContext } from '$lib/state/toast.svelte';
  import { initKeyboardHandler } from '$lib/shortcuts';

  let { data, children } = $props();

  // Initialize all contexts (SSR-safe, request-scoped)
  // 1. Theme (already applied in app.html, just sync state)
  const theme = setThemeContext({ mode: data.themeMode });

  // 2. Sidebar (server-persisted width, expanded/pinned from localStorage on client)
  const sidebar = setSidebarContext(data.sidebarWidth);

  // 3. Modals + toasts (ephemeral client state)
  const modals = setModalsContext();
  const toast = setToastContext();

  // 4. Keyboard shortcuts (register handlers)
  onMount(() => {
    return initKeyboardHandler();
  });
</script>

{@render children()}
```

---

## Cross-Component Communication

### Event-Based Updates

```typescript
// Option 1: Svelte 5 reactive state (preferred)
// Components import and react to shared state

// Option 2: SvelteKit invalidation for server-owned data
// The notifications page marks a row read, then re-runs its own load:
async function markAsRead(id: string) {
  await fetch(`/api/notifications/${id}/read`, { method: 'POST', headers: { 'X-Requested-With': 'fetch' } });
  await invalidate('app:notifications'); // the page load declares depends('app:notifications')
}
```

### Data Flow Diagram

```
Server (load functions)
         │
         ▼
┌─────────────────────────────────────┐
│   +layout.svelte (root)             │
│   • Receives: themeMode, sidebarWidth│
│     style, session                  │
│   • Initializes: theme, sidebar,    │
│     modals, toast                   │
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
<!-- Illustrative — a dev-only panel; not shipped -->
<script lang="ts">
  import { dev } from '$app/environment';
  import { getSidebar } from '$lib/state/sidebar.svelte';
  import { getTheme } from '$lib/state/theme.svelte';
  import { getModals } from '$lib/state/modals.svelte';

  // Get all state from context (SSR-safe)
  const sidebar = getSidebar();
  const theme = getTheme();
  const modals = getModals();

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
├── theme.svelte.ts              # Theme mode
├── modals.svelte.ts             # Active modal tracking (quickSearch | shortcuts | sessionExpiry)
├── chatbot-session.svelte.ts    # Vely chatbot live thread (module singleton, NOT a context)
└── index.ts                     # Exports
```

---

## Related

- [./sidebar.md](./sidebar.md) - Sidebar component behavior
- [./settings.md](./settings.md) - Settings & Preferences
- [./session-lifecycle.md](./session-lifecycle.md) - Session state
- [../state.md](../state.md) - Svelte 5 state patterns
